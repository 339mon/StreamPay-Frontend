#![no_std]

mod error;
mod events;
mod release;
mod storage;
mod withdrawer;

pub use error::Error;
use soroban_sdk::{contract, contractimpl, token, Address, Env};
pub use storage::{Stream, StreamStatus};
pub(crate) use storage::DataKey;

#[contract]
pub struct Contract;

#[contractimpl]
impl Contract {
    /// One-time contract initialisation.
    ///
    /// Records `admin` as the privileged address for `set_paused` and
    /// `set_token_allowed`. Sets the global pause flag to `false`.
    ///
    /// # Errors
    /// - [`Error::InvalidState`] if the contract has already been initialised.
    ///
    /// # Auth
    /// Requires authorisation from `admin`.
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        if storage::has_admin(&env) {
            return Err(Error::InvalidState);
        }

        admin.require_auth();
        storage::set_admin(&env, &admin);
        storage::set_paused(&env, false);
        Ok(())
    }

    /// Sets the global emergency pause flag.
    ///
    /// When `paused` is `true`, `create_stream`, `start_stream`, and `withdraw`
    /// all return [`Error::ContractPaused`]. Read-only calls (`get_stream`,
    /// `withdrawable`) are unaffected.
    ///
    /// # Errors
    /// - [`Error::Unauthorized`] if `admin` is not the initialised admin.
    /// - [`Error::NotFound`] if the contract has not been initialised.
    ///
    /// # Auth
    /// Requires authorisation from `admin`.
    pub fn set_paused(env: Env, admin: Address, paused: bool) -> Result<(), Error> {
        require_admin(&env, &admin)?;
        storage::set_paused(&env, paused);
        Ok(())
    }

    /// Transfers the admin role to a new address.
    ///
    /// # Errors
    /// - [`Error::Unauthorized`] if `admin` is not the initialised admin.
    ///
    /// # Auth
    /// Requires authorisation from current `admin`.
    pub fn set_admin(env: Env, admin: Address, new_admin: Address) -> Result<(), Error> {
        require_admin(&env, &admin)?;
        storage::set_admin(&env, &new_admin);
        Ok(())
    }

    /// Allows or blocks a token for future stream creation.
    ///
    /// Tokens are allowed by default (no entry in storage). Setting
    /// `allowed = false` blocks the token; `allowed = true` re-enables it.
    /// Existing streams using a subsequently blocked token are unaffected.
    ///
    /// # Errors
    /// - [`Error::Unauthorized`] if `admin` is not the initialised admin.
    /// - [`Error::NotFound`] if the contract has not been initialised.
    ///
    /// # Auth
    /// Requires authorisation from `admin`.
    pub fn set_token_allowed(
        env: Env,
        admin: Address,
        token: Address,
        allowed: bool,
    ) -> Result<(), Error> {
        require_admin(&env, &admin)?;
        storage::set_token_allowed(&env, &token, allowed);
        Ok(())
    }

    /// Creates a funded stream and escrows `total_amount` from `sender`.
    ///
    /// **Token transfer**: `total_amount` is transferred from `sender` to the
    /// contract address immediately.
    ///
    /// If `draft = false` the stream is `Active` immediately with
    /// `start_time = start_time_or_duration` interpreted as `start_time` and
    /// `end_time_or_draft_flag` interpreted as `end_time`.
    ///
    /// If `draft = true` the stream is `Draft`; the second numeric argument is
    /// treated as `duration`. `start_time`, `end_time`, and `last_update` are
    /// all zero until `start_stream` is called.
    ///
    /// Returns the new stream's numeric ID.
    ///
    /// # Errors
    /// - [`Error::ContractPaused`] if the global pause flag is set.
    /// - [`Error::InvalidAmount`] if `total_amount <= 0`.
    /// - [`Error::InvalidState`] if `sender == recipient`.
    /// - [`Error::TokenNotAllowed`] if the token has been blocked by the admin.
    /// - [`Error::InvalidTimeRange`] if `end_time <= start_time` or `start_time < now` (active only).
    ///
    /// # Auth
    /// Requires authorisation from `sender`.
    pub fn create_stream(
        env: Env,
        sender: Address,
        recipient: Address,
        token: Address,
        total_amount: i128,
        start_time: u64,
        end_time: u64,
    ) -> Result<u64, Error> {
        require_not_paused(&env)?;
        sender.require_auth();

        if total_amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        if sender == recipient {
            return Err(Error::InvalidState);
        }

        if storage::is_token_blocked(&env, &token) {
            return Err(Error::TokenNotAllowed);
        }

        if end_time <= start_time {
            return Err(Error::InvalidTimeRange);
        }

        let now = env.ledger().timestamp();
        if start_time < now {
            return Err(Error::InvalidTimeRange);
        }

        let duration = end_time - start_time;
        let id = storage::next_stream_id(&env);
        let contract_address = env.current_contract_address();

        token::Client::new(&env, &token).transfer(&sender, &contract_address, &total_amount);

        let stream = Stream {
            id,
            sender,
            recipient,
            token,
            total_amount,
            released_amount: 0,
            start_time,
            end_time,
            duration,
            last_update: start_time,
            status: StreamStatus::Active,
            pause_time: 0,
            total_paused_duration: 0,
        };

        storage::set_stream(&env, id, &stream);
        events::created(
            &env,
            id,
            &stream.sender,
            &stream.recipient,
            &stream.token,
            stream.total_amount,
            now,
        );

        Ok(id)
    }

    /// Creates a funded draft stream, escrowing `total_amount` from `sender`.
    ///
    /// The stream starts in `Draft` status; `start_time`, `end_time`, and
    /// `last_update` are zero until [`start_stream`] is called, at which point
    /// the stream becomes `Active` with `end_time = now + duration`.
    ///
    /// **Token transfer**: `total_amount` is transferred from `sender` to the
    /// contract address immediately.
    ///
    /// Returns the new stream's numeric ID.
    ///
    /// # Errors
    /// - [`Error::ContractPaused`] if the global pause flag is set.
    /// - [`Error::InvalidAmount`] if `total_amount <= 0`.
    /// - [`Error::InvalidState`] if `sender == recipient`.
    /// - [`Error::TokenNotAllowed`] if the token has been blocked by the admin.
    /// - [`Error::InvalidTimeRange`] if `duration == 0`.
    ///
    /// # Auth
    /// Requires authorisation from `sender`.
    pub fn create_draft_stream(
        env: Env,
        sender: Address,
        recipient: Address,
        token: Address,
        total_amount: i128,
        duration: u64,
    ) -> Result<u64, Error> {
        require_not_paused(&env)?;
        sender.require_auth();

        if total_amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        if sender == recipient {
            return Err(Error::InvalidState);
        }

        if storage::is_token_blocked(&env, &token) {
            return Err(Error::TokenNotAllowed);
        }

        if duration == 0 {
            return Err(Error::InvalidTimeRange);
        }

        let now = env.ledger().timestamp();
        let id = storage::next_stream_id(&env);
        let contract_address = env.current_contract_address();

        token::Client::new(&env, &token).transfer(&sender, &contract_address, &total_amount);

        let stream = Stream {
            id,
            sender,
            recipient,
            token,
            total_amount,
            released_amount: 0,
            start_time: 0,
            end_time: 0,
            duration,
            last_update: 0,
            status: StreamStatus::Draft,
            pause_time: 0,
            total_paused_duration: 0,
        };

        storage::set_stream(&env, id, &stream);
        events::created(
            &env,
            id,
            &stream.sender,
            &stream.recipient,
            &stream.token,
            stream.total_amount,
            now,
        );

        Ok(id)
    }

    /// Activates a `Draft` stream, anchoring its time bounds to the current
    /// ledger timestamp.
    ///
    /// Sets `status = Active`, `start_time = now`, `last_update = now`, and
    /// `end_time = now + duration`. No token transfer occurs.
    ///
    /// # Errors
    /// - [`Error::ContractPaused`] if the global pause flag is set.
    /// - [`Error::NotFound`] if `stream_id` does not exist.
    /// - [`Error::InvalidState`] if the stream is not in `Draft` status.
    /// - [`Error::InvalidTimeRange`] if `now + duration` overflows `u64`.
    ///
    /// # Auth
    /// Requires authorisation from the stream's `sender`.
    pub fn start_stream(env: Env, stream_id: u64) -> Result<Stream, Error> {
        require_not_paused(&env)?;
        let mut stream = get_existing_stream(&env, stream_id)?;
        stream.sender.require_auth();

        if stream.status != StreamStatus::Draft {
            return Err(Error::InvalidState);
        }

        let now = env.ledger().timestamp();
        stream.status = StreamStatus::Active;
        stream.start_time = now;
        stream.last_update = now;
        stream.end_time = now
            .checked_add(stream.duration)
            .ok_or(Error::InvalidTimeRange)?;

        storage::set_stream(&env, stream_id, &stream);
        events::started(&env, stream_id, stream.start_time, stream.end_time, stream.start_time);

        Ok(stream)
    }

    /// Returns the stored stream record for `stream_id`.
    ///
    /// # Errors
    /// - [`Error::NotFound`] if `stream_id` does not exist.
    pub fn get_stream(env: Env, stream_id: u64) -> Result<Stream, Error> {
        get_existing_stream(&env, stream_id)
    }

    /// Returns the token amount currently accrued and available for withdrawal.
    ///
    /// # Errors
    /// - [`Error::NotFound`] if `stream_id` does not exist.
    pub fn withdrawable(env: Env, stream_id: u64) -> Result<i128, Error> {
        let stream = get_existing_stream(&env, stream_id)?;
        Ok(release::withdrawable(&stream, env.ledger().timestamp()))
    }

    /// Returns the stream balance (total vested amount) at the current ledger
    /// timestamp using overflow-safe linear accrual.
    ///
    /// # Errors
    /// - [`Error::NotFound`] if `stream_id` does not exist.
    pub fn stream_balance(env: Env, stream_id: u64) -> Result<i128, Error> {
        let stream = get_existing_stream(&env, stream_id)?;
        Ok(release::vested_amount(&stream, env.ledger().timestamp()))
    }

    /// Withdraws accrued escrow on behalf of `caller`.
    ///
    /// `caller` must be either the stream recipient or an address that has been
    /// added to the per-stream withdrawer allowlist via [`add_withdrawer`].
    /// Funds are always transferred to the stream recipient regardless of who
    /// initiates the withdrawal.
    ///
    /// # Errors
    /// - [`Error::ContractPaused`] if the global pause flag is set.
    /// - [`Error::InvalidAmount`] if `amount <= 0`.
    /// - [`Error::NotFound`] if `stream_id` does not exist.
    /// - [`Error::Unauthorized`] if `caller` is not the recipient or an
    ///   allowlisted withdrawer.
    /// - [`Error::AlreadySettled`] if the stream is already fully settled.
    /// - [`Error::InvalidState`] if the stream is not Active or Paused.
    /// - [`Error::OverWithdraw`] if `amount` exceeds accrued funds.
    ///
    /// # Auth
    /// Requires authorisation from `caller`.
    pub fn withdraw(env: Env, caller: Address, stream_id: u64, amount: i128) -> Result<i128, Error> {
        require_not_paused(&env)?;
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let mut stream = get_existing_stream(&env, stream_id)?;

        // Enforce allowlist authorization: caller must be recipient or allowlisted.
        withdrawer::require_withdraw_auth(&env, stream_id, &caller, &stream.recipient)?;

        if stream.status == StreamStatus::Settled {
            return Err(Error::AlreadySettled);
        }

        // Allow withdrawals from Active or Paused streams
        if stream.status != StreamStatus::Active && stream.status != StreamStatus::Paused {
            return Err(Error::InvalidState);
        }

        let now = env.ledger().timestamp();
        let available = release::withdrawable(&stream, now);
        if amount > available {
            return Err(Error::OverWithdraw);
        }

        stream.released_amount = stream
            .released_amount
            .checked_add(amount)
            .ok_or(Error::InvalidAmount)?;
        stream.last_update = now;

        if stream.released_amount == stream.total_amount {
            stream.status = StreamStatus::Settled;
        }

        #[allow(clippy::needless_borrows_for_generic_args)]
        token::Client::new(&env, &stream.token).transfer(
            &env.current_contract_address(),
            &stream.recipient,
            &amount,
        );

        storage::set_stream(&env, stream_id, &stream);
        let ts = stream.last_update;
        events::withdrawn(&env, stream_id, &stream.recipient, amount, ts);
        if stream.status == StreamStatus::Settled {
            events::settled(&env, stream_id, &stream.recipient, stream.total_amount, ts);
        }

        Ok(amount)
    }

    /// Adds `withdrawer` to the per-stream allowlist, granting them the right
    /// to call [`withdraw`] on behalf of the recipient.
    ///
    /// Only the stream sender may manage the allowlist. Adding an address that
    /// is already present is a no-op (idempotent).
    ///
    /// # Errors
    /// - [`Error::NotFound`] if `stream_id` does not exist.
    /// - [`Error::Unauthorized`] if the caller is not the stream sender.
    ///
    /// # Auth
    /// Requires authorisation from the stream's `sender`.
    pub fn add_withdrawer(
        env: Env,
        stream_id: u64,
        withdrawer: Address,
    ) -> Result<(), Error> {
        let stream = get_existing_stream(&env, stream_id)?;
        stream.sender.require_auth();
        storage::add_withdrawer(&env, stream_id, &withdrawer);
        Ok(())
    }

    /// Removes `withdrawer` from the per-stream allowlist.
    ///
    /// Only the stream sender may manage the allowlist. Removing an address
    /// that is not in the allowlist is a no-op (idempotent).
    ///
    /// # Errors
    /// - [`Error::NotFound`] if `stream_id` does not exist.
    /// - [`Error::Unauthorized`] if the caller is not the stream sender.
    ///
    /// # Auth
    /// Requires authorisation from the stream's `sender`.
    pub fn remove_withdrawer(
        env: Env,
        stream_id: u64,
        withdrawer: Address,
    ) -> Result<(), Error> {
        let stream = get_existing_stream(&env, stream_id)?;
        stream.sender.require_auth();
        storage::remove_withdrawer(&env, stream_id, &withdrawer);
        Ok(())
    }

    /// Returns the current withdrawer allowlist for a stream.
    ///
    /// Returns an empty list if no allowlist has been set.
    ///
    /// # Errors
    /// - [`Error::NotFound`] if `stream_id` does not exist.
    pub fn get_withdrawer_allowlist(
        env: Env,
        stream_id: u64,
    ) -> Result<soroban_sdk::Vec<Address>, Error> {
        // Verify the stream exists before returning the allowlist.
        get_existing_stream(&env, stream_id)?;
        Ok(storage::get_withdrawer_allowlist(&env, stream_id))
    }

    /// Cancels an active or paused stream before it reaches its end time.
    ///
    /// Only the stream sender may cancel. Unvested funds are refunded to the
    /// sender; any already-vested-but-undrawn funds remain claimable by the
    /// recipient (they stay in escrow and the stream transitions to Cancelled
    /// so that the recipient can still call `withdraw`). If all vested funds
    /// have already been withdrawn, the stream is settled immediately.
    ///
    /// # Errors
    /// - [`Error::NotFound`] if `stream_id` does not exist.
    /// - [`Error::InvalidState`] if the stream is not Active or Paused.
    ///
    /// # Auth
    /// Requires authorisation from the stream's `sender`.
    pub fn cancel_stream(env: Env, stream_id: u64) -> Result<(), Error> {
        let mut stream = get_existing_stream(&env, stream_id)?;
        stream.sender.require_auth();

        if stream.status != StreamStatus::Active && stream.status != StreamStatus::Paused {
            return Err(Error::InvalidState);
        }

        let now = env.ledger().timestamp();
        let vested = release::vested_amount(&stream, now);
        let unvested = stream
            .total_amount
            .checked_sub(vested)
            .ok_or(Error::InvalidAmount)?;

        if unvested > 0 {
            #[allow(clippy::needless_borrows_for_generic_args)]
            token::Client::new(&env, &stream.token).transfer(
                &env.current_contract_address(),
                &stream.sender,
                &unvested,
            );
        }

        stream.status = StreamStatus::Cancelled;
        stream.last_update = now;

        storage::set_stream(&env, stream_id, &stream);

        Ok(())
    }

    /// Pauses an active stream, freezing accrual while preserving vested funds.
    ///
    /// Only the stream sender may call this. On pause, status is set to Paused
    /// and pause_time is recorded. Vested amount remains withdrawable but does
    /// not increase while paused.
    pub fn pause(env: Env, stream_id: u64) -> Result<Stream, Error> {
        let mut stream = get_existing_stream(&env, stream_id)?;
        stream.sender.require_auth();

        if stream.status != StreamStatus::Active {
            return Err(Error::InvalidState);
        }

        let now = env.ledger().timestamp();

        stream.last_update = now;
        stream.status = StreamStatus::Paused;
        stream.pause_time = now;

        storage::set_stream(&env, stream_id, &stream);

        Ok(stream)
    }

    /// Resumes a paused stream, extending end_time to preserve unstreamed time.
    ///
    /// Only the stream sender may call this. On resume, the end_time is extended
    /// by the paused duration so the remaining streamable amount is preserved.
    /// Status is set back to Active.
    pub fn resume(env: Env, stream_id: u64) -> Result<Stream, Error> {
        let mut stream = get_existing_stream(&env, stream_id)?;
        stream.sender.require_auth();

        if stream.status != StreamStatus::Paused {
            return Err(Error::InvalidState);
        }

        let now = env.ledger().timestamp();
        let paused_duration = now
            .checked_sub(stream.pause_time)
            .ok_or(Error::InvalidTimeRange)?;

        // Track total paused duration for accrual calculations
        stream.total_paused_duration = stream
            .total_paused_duration
            .checked_add(paused_duration)
            .ok_or(Error::InvalidTimeRange)?;

        // Extend end_time by the paused duration to preserve unstreamed time
        stream.end_time = stream
            .end_time
            .checked_add(paused_duration)
            .ok_or(Error::InvalidTimeRange)?;

        stream.last_update = now;
        stream.status = StreamStatus::Active;
        stream.pause_time = 0;

        storage::set_stream(&env, stream_id, &stream);

        Ok(stream)
    }

    /// Finalizes a stream whose time window has fully elapsed, paying out
    /// any remaining vested funds to the recipient and transitioning it to a
    /// terminal `Settled` state.
    ///
    /// This function is permissionless and can be triggered by anyone after
    /// `end_time` has been reached. Calling it on an already `Settled` stream
    /// is a no-op (returns `Ok(())`).
    ///
    /// # Errors
    /// - [`Error::ContractPaused`] if the contract is paused.
    /// - [`Error::NotFound`] if `stream_id` does not exist.
    /// - [`Error::InvalidState`] if the stream is in `Draft` or cancelled state,
    ///   or if the current ledger timestamp has not yet reached `end_time`.
    pub fn settle(env: Env, stream_id: u64) -> Result<(), Error> {
        require_not_paused(&env)?;
        let mut stream = get_existing_stream(&env, stream_id)?;

        if stream.status == StreamStatus::Settled {
            return Ok(());
        }

        if stream.status != StreamStatus::Active && stream.status != StreamStatus::Paused {
            return Err(Error::InvalidState);
        }

        let now = env.ledger().timestamp();
        if now < stream.end_time {
            return Err(Error::InvalidState);
        }

        let payout_amount = stream.total_amount - stream.released_amount;
        if payout_amount > 0 {
            #[allow(clippy::needless_borrows_for_generic_args)]
            token::Client::new(&env, &stream.token).transfer(
                &env.current_contract_address(),
                &stream.recipient,
                &payout_amount,
            );
            stream.released_amount = stream.total_amount;
        }

        stream.status = StreamStatus::Settled;
        stream.last_update = now;

        storage::set_stream(&env, stream_id, &stream);

        Ok(())
    }
}

fn get_existing_stream(env: &Env, stream_id: u64) -> Result<Stream, Error> {
    storage::get_stream(env, stream_id).ok_or(Error::NotFound)
}

fn require_admin(env: &Env, caller: &Address) -> Result<(), Error> {
    caller.require_auth();

    let admin: Address = storage::get_admin(env).ok_or(Error::NotFound)?;

    if admin != *caller {
        return Err(Error::Unauthorized);
    }

    Ok(())
}

fn require_not_paused(env: &Env) -> Result<(), Error> {
    if storage::is_paused(env) {
        return Err(Error::ContractPaused);
    }

    Ok(())
}

#[cfg(test)]
mod test;

#[cfg(test)]
mod prop_test;
