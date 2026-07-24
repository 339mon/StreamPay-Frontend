//! # Read-only paginated stream enumeration views
//!
//! This module provides efficient paginated read-only access to streams
//! for off-chain consumers (indexers, frontends, analytics tools).
//!
//! ## Design
//!
//! - **Read-only**: All functions in this module are pure views that never
//!   mutate state or require auth.
//! - **Pagination**: Stream IDs are monotonic and start at 1. Pagination
//!   uses `start_after` cursors (exclusive) for forward iteration.
//! - **Limit bounds**: The `limit` parameter is capped at `MAX_PAGE_SIZE`
//!   to prevent excessive resource consumption on a single query.
//! - **Filtering**: Views support filtering by sender, recipient, and status.
//!
//! ## Security
//!
//! - No auth checks: these are public read-only views.
//! - TTL extension is performed on every stream read to keep active streams
//!   from expiring mid-flight (delegated to `storage::get_stream`).
//! - No unbounded loops: all iteration is bounded by `MAX_PAGE_SIZE`.
//!
//! ## Examples
//!
//! ```ignore
//! // Get first 10 streams
//! let page = Contract::list_streams(env, None, 10);
//!
//! // Get next page after stream ID 10
//! let next_page = Contract::list_streams(env, Some(10), 10);
//!
//! // Get streams for a specific sender
//! let sender_streams = Contract::list_streams_by_sender(env, sender, None, 10);
//!
//! // Get active streams for a recipient
//! let active = Contract::list_streams_by_recipient_and_status(
//!     env, recipient, StreamStatus::Active, None, 10
//! );
//! ```

use crate::{storage, Stream, StreamStatus};
use soroban_sdk::{contracttype, Address, Env, Vec};

/// Maximum number of streams returned in a single paginated query.
///
/// This limit prevents excessive resource consumption on Soroban and keeps
/// query response times predictable. Off-chain consumers can make multiple
/// paginated requests to enumerate large stream sets.
pub const MAX_PAGE_SIZE: u64 = 100;

/// Paginated result containing streams and an optional continuation cursor.
///
/// Off-chain consumers should check `next_cursor` after each query:
/// - `Some(id)` → more streams exist; pass `id` as `start_after` to the next call.
/// - `None` → end of result set; no further pages.
#[derive(Clone, Debug)]
#[contracttype]
pub struct StreamPage {
    /// Streams in this page, ordered by ascending stream ID.
    pub streams: Vec<Stream>,
    /// Exclusive cursor for the next page. `None` if this is the last page.
    pub next_cursor: Option<u64>,
}

/// Returns a paginated list of all streams, ordered by ascending stream ID.
///
/// This is the broadest enumeration view; it does not filter by sender,
/// recipient, or status. Use the more specific views below to narrow results.
///
/// # Parameters
///
/// - `start_after` — Exclusive cursor: return streams with `id > start_after`.
///   Pass `None` to start from the beginning (stream ID 1).
/// - `limit` — Maximum number of streams to return. Capped at [`MAX_PAGE_SIZE`].
///
/// # Returns
///
/// A [`StreamPage`] with up to `limit` streams. If `next_cursor` is `Some(id)`,
/// there are more streams; pass `id` as `start_after` to the next call.
///
/// # Errors
///
/// This function does not return errors; if no streams exist, `streams` is empty.
///
/// # Performance
///
/// This function performs a linear scan over stream IDs from `start_after + 1`
/// up to the next stream counter, stopping when `limit` streams have been
/// collected or the end is reached. Average case: O(limit + gaps), where
/// "gaps" are deleted or settled stream IDs that were skipped.
pub fn list_streams(env: &Env, start_after: Option<u64>, limit: u64) -> StreamPage {
    let effective_limit = limit.min(MAX_PAGE_SIZE);
    let start_id = start_after.unwrap_or(0).saturating_add(1);
    let max_id = storage::peek_next_stream_id(env);

    let mut streams = Vec::new(env);
    let mut current_id = start_id;
    let mut collected = 0u64;

    while current_id < max_id && collected < effective_limit {
        if let Some(stream) = storage::get_stream(env, current_id) {
            streams.push_back(stream);
            collected = collected.saturating_add(1);
        }
        current_id = current_id.saturating_add(1);
    }

    let next_cursor = if current_id < max_id {
        Some(current_id.saturating_sub(1))
    } else {
        None
    };

    StreamPage {
        streams,
        next_cursor,
    }
}

/// Returns a paginated list of streams sent by a given address.
///
/// # Parameters
///
/// - `sender` — Filter: only return streams where `stream.sender == sender`.
/// - `start_after` — Exclusive cursor: return streams with `id > start_after`.
/// - `limit` — Maximum number of streams to return. Capped at [`MAX_PAGE_SIZE`].
///
/// # Returns
///
/// A [`StreamPage`] with up to `limit` streams sent by `sender`.
pub fn list_streams_by_sender(
    env: &Env,
    sender: &Address,
    start_after: Option<u64>,
    limit: u64,
) -> StreamPage {
    let effective_limit = limit.min(MAX_PAGE_SIZE);
    let start_id = start_after.unwrap_or(0).saturating_add(1);
    let max_id = storage::peek_next_stream_id(env);

    let mut streams = Vec::new(env);
    let mut current_id = start_id;
    let mut collected = 0u64;

    while current_id < max_id && collected < effective_limit {
        if let Some(stream) = storage::get_stream(env, current_id) {
            if stream.sender == *sender {
                streams.push_back(stream);
                collected = collected.saturating_add(1);
            }
        }
        current_id = current_id.saturating_add(1);
    }

    let next_cursor = if current_id < max_id {
        Some(current_id.saturating_sub(1))
    } else {
        None
    };

    StreamPage {
        streams,
        next_cursor,
    }
}

/// Returns a paginated list of streams received by a given address.
///
/// # Parameters
///
/// - `recipient` — Filter: only return streams where `stream.recipient == recipient`.
/// - `start_after` — Exclusive cursor: return streams with `id > start_after`.
/// - `limit` — Maximum number of streams to return. Capped at [`MAX_PAGE_SIZE`].
///
/// # Returns
///
/// A [`StreamPage`] with up to `limit` streams received by `recipient`.
pub fn list_streams_by_recipient(
    env: &Env,
    recipient: &Address,
    start_after: Option<u64>,
    limit: u64,
) -> StreamPage {
    let effective_limit = limit.min(MAX_PAGE_SIZE);
    let start_id = start_after.unwrap_or(0).saturating_add(1);
    let max_id = storage::peek_next_stream_id(env);

    let mut streams = Vec::new(env);
    let mut current_id = start_id;
    let mut collected = 0u64;

    while current_id < max_id && collected < effective_limit {
        if let Some(stream) = storage::get_stream(env, current_id) {
            if stream.recipient == *recipient {
                streams.push_back(stream);
                collected = collected.saturating_add(1);
            }
        }
        current_id = current_id.saturating_add(1);
    }

    let next_cursor = if current_id < max_id {
        Some(current_id.saturating_sub(1))
    } else {
        None
    };

    StreamPage {
        streams,
        next_cursor,
    }
}

/// Returns a paginated list of streams filtered by status.
///
/// # Parameters
///
/// - `status` — Filter: only return streams where `stream.status == status`.
/// - `start_after` — Exclusive cursor: return streams with `id > start_after`.
/// - `limit` — Maximum number of streams to return. Capped at [`MAX_PAGE_SIZE`].
///
/// # Returns
///
/// A [`StreamPage`] with up to `limit` streams in the given status.
pub fn list_streams_by_status(
    env: &Env,
    status: StreamStatus,
    start_after: Option<u64>,
    limit: u64,
) -> StreamPage {
    let effective_limit = limit.min(MAX_PAGE_SIZE);
    let start_id = start_after.unwrap_or(0).saturating_add(1);
    let max_id = storage::peek_next_stream_id(env);

    let mut streams = Vec::new(env);
    let mut current_id = start_id;
    let mut collected = 0u64;

    while current_id < max_id && collected < effective_limit {
        if let Some(stream) = storage::get_stream(env, current_id) {
            if stream.status == status {
                streams.push_back(stream);
                collected = collected.saturating_add(1);
            }
        }
        current_id = current_id.saturating_add(1);
    }

    let next_cursor = if current_id < max_id {
        Some(current_id.saturating_sub(1))
    } else {
        None
    };

    StreamPage {
        streams,
        next_cursor,
    }
}

/// Returns a paginated list of streams filtered by recipient and status.
///
/// This is a compound filter commonly used by frontends to show a user's
/// active/paused/settled streams.
///
/// # Parameters
///
/// - `recipient` — Filter: only return streams where `stream.recipient == recipient`.
/// - `status` — Filter: only return streams where `stream.status == status`.
/// - `start_after` — Exclusive cursor: return streams with `id > start_after`.
/// - `limit` — Maximum number of streams to return. Capped at [`MAX_PAGE_SIZE`].
///
/// # Returns
///
/// A [`StreamPage`] with up to `limit` streams matching both filters.
pub fn list_streams_by_recipient_and_status(
    env: &Env,
    recipient: &Address,
    status: StreamStatus,
    start_after: Option<u64>,
    limit: u64,
) -> StreamPage {
    let effective_limit = limit.min(MAX_PAGE_SIZE);
    let start_id = start_after.unwrap_or(0).saturating_add(1);
    let max_id = storage::peek_next_stream_id(env);

    let mut streams = Vec::new(env);
    let mut current_id = start_id;
    let mut collected = 0u64;

    while current_id < max_id && collected < effective_limit {
        if let Some(stream) = storage::get_stream(env, current_id) {
            if stream.recipient == *recipient && stream.status == status {
                streams.push_back(stream);
                collected = collected.saturating_add(1);
            }
        }
        current_id = current_id.saturating_add(1);
    }

    let next_cursor = if current_id < max_id {
        Some(current_id.saturating_sub(1))
    } else {
        None
    };

    StreamPage {
        streams,
        next_cursor,
    }
}

/// Returns a paginated list of streams filtered by sender and status.
///
/// # Parameters
///
/// - `sender` — Filter: only return streams where `stream.sender == sender`.
/// - `status` — Filter: only return streams where `stream.status == status`.
/// - `start_after` — Exclusive cursor: return streams with `id > start_after`.
/// - `limit` — Maximum number of streams to return. Capped at [`MAX_PAGE_SIZE`].
///
/// # Returns
///
/// A [`StreamPage`] with up to `limit` streams matching both filters.
pub fn list_streams_by_sender_and_status(
    env: &Env,
    sender: &Address,
    status: StreamStatus,
    start_after: Option<u64>,
    limit: u64,
) -> StreamPage {
    let effective_limit = limit.min(MAX_PAGE_SIZE);
    let start_id = start_after.unwrap_or(0).saturating_add(1);
    let max_id = storage::peek_next_stream_id(env);

    let mut streams = Vec::new(env);
    let mut current_id = start_id;
    let mut collected = 0u64;

    while current_id < max_id && collected < effective_limit {
        if let Some(stream) = storage::get_stream(env, current_id) {
            if stream.sender == *sender && stream.status == status {
                streams.push_back(stream);
                collected = collected.saturating_add(1);
            }
        }
        current_id = current_id.saturating_add(1);
    }

    let next_cursor = if current_id < max_id {
        Some(current_id.saturating_sub(1))
    } else {
        None
    };

    StreamPage {
        streams,
        next_cursor,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Contract;
    use soroban_sdk::testutils::Address as _;

    /// Register a contract instance and return `(env, contract_id)`.
    ///
    /// All storage calls (both `instance()` and `persistent()`) must be issued
    /// from within `env.as_contract(&contract_id, || { … })` so that the
    /// Soroban host associates them with the correct contract instance.
    fn setup_env() -> (Env, soroban_sdk::Address) {
        let env = Env::default();
        let contract_id = env.register(Contract, ());
        (env, contract_id)
    }

    /// Seed six streams with mixed senders/recipients/statuses and set the
    /// stream-ID counter to 7.  Must be called from within
    /// `env.as_contract(&contract_id, || { … })`.
    fn seed_streams(env: &Env) -> (Address, Address, Address) {
        let sender_a = Address::generate(env);
        let sender_b = Address::generate(env);
        let recipient = Address::generate(env);
        let token = Address::generate(env);

        // Stream IDs 1–6 with varied senders/statuses
        for i in 1u64..=6 {
            let stream = Stream {
                id: i,
                sender: if i % 2 == 0 {
                    sender_b.clone()
                } else {
                    sender_a.clone()
                },
                recipient: recipient.clone(),
                token: token.clone(),
                total_amount: 1000 * i128::from(i),
                released_amount: 0,
                start_time: 1000,
                end_time: 2000,
                duration: 1000,
                last_update: 1000,
                status: match i {
                    3 | 4 => StreamStatus::Paused,
                    5 => StreamStatus::Settled,
                    6 => StreamStatus::Draft,
                    _ => StreamStatus::Active,
                },
                paused_at: 0,
                total_paused_duration: 0,
            };
            storage::set_stream(env, i, &stream);
        }
        storage::set_next_stream_id_for_test(env, 7);

        (sender_a, sender_b, recipient)
    }

    #[test]
    fn test_list_streams_empty() {
        let (env, contract_id) = setup_env();
        env.as_contract(&contract_id, || {
            storage::set_next_stream_id_for_test(&env, 1);
            let page = list_streams(&env, None, 10);
            assert_eq!(page.streams.len(), 0);
            assert_eq!(page.next_cursor, None);
        });
    }

    #[test]
    fn test_list_streams_all_fit_in_one_page() {
        let (env, contract_id) = setup_env();
        env.as_contract(&contract_id, || {
            seed_streams(&env);
            let page = list_streams(&env, None, 10);
            assert_eq!(page.streams.len(), 6);
            assert_eq!(page.next_cursor, None);
        });
    }

    #[test]
    fn test_list_streams_pagination() {
        let (env, contract_id) = setup_env();
        env.as_contract(&contract_id, || {
            seed_streams(&env);

            let page1 = list_streams(&env, None, 2);
            assert_eq!(page1.streams.len(), 2);
            assert_eq!(page1.streams.get(0).unwrap().id, 1);
            assert_eq!(page1.streams.get(1).unwrap().id, 2);
            assert!(page1.next_cursor.is_some());

            let page2 = list_streams(&env, page1.next_cursor, 2);
            assert_eq!(page2.streams.len(), 2);
            assert_eq!(page2.streams.get(0).unwrap().id, 3);
            assert_eq!(page2.streams.get(1).unwrap().id, 4);
            assert!(page2.next_cursor.is_some());

            let page3 = list_streams(&env, page2.next_cursor, 2);
            assert_eq!(page3.streams.len(), 2);
            assert_eq!(page3.streams.get(0).unwrap().id, 5);
            assert_eq!(page3.streams.get(1).unwrap().id, 6);
            assert_eq!(page3.next_cursor, None);
        });
    }

    #[test]
    fn test_list_streams_respects_max_page_size() {
        let (env, contract_id) = setup_env();
        env.as_contract(&contract_id, || {
            seed_streams(&env);
            let page = list_streams(&env, None, MAX_PAGE_SIZE + 100);
            // Capped at min(6, MAX_PAGE_SIZE) = 6
            assert_eq!(page.streams.len(), 6);
        });
    }

    #[test]
    fn test_list_streams_by_sender() {
        let (env, contract_id) = setup_env();
        env.as_contract(&contract_id, || {
            let (sender_a, _sender_b, _recipient) = seed_streams(&env);
            let page = list_streams_by_sender(&env, &sender_a, None, 10);
            // sender_a has streams 1, 3, 5 (odd IDs)
            assert_eq!(page.streams.len(), 3);
            assert_eq!(page.streams.get(0).unwrap().id, 1);
            assert_eq!(page.streams.get(1).unwrap().id, 3);
            assert_eq!(page.streams.get(2).unwrap().id, 5);
            assert_eq!(page.next_cursor, None);
        });
    }

    #[test]
    fn test_list_streams_by_recipient() {
        let (env, contract_id) = setup_env();
        env.as_contract(&contract_id, || {
            let (_sender_a, _sender_b, recipient) = seed_streams(&env);
            let page = list_streams_by_recipient(&env, &recipient, None, 10);
            // All 6 streams share the same recipient
            assert_eq!(page.streams.len(), 6);
            assert_eq!(page.next_cursor, None);
        });
    }

    #[test]
    fn test_list_streams_by_status() {
        let (env, contract_id) = setup_env();
        env.as_contract(&contract_id, || {
            seed_streams(&env);
            let page = list_streams_by_status(&env, StreamStatus::Active, None, 10);
            // Streams 1, 2 are Active
            assert_eq!(page.streams.len(), 2);
            assert_eq!(page.streams.get(0).unwrap().id, 1);
            assert_eq!(page.streams.get(1).unwrap().id, 2);
            assert_eq!(page.next_cursor, None);
        });
    }

    #[test]
    fn test_list_streams_by_recipient_and_status() {
        let (env, contract_id) = setup_env();
        env.as_contract(&contract_id, || {
            let (_sender_a, _sender_b, recipient) = seed_streams(&env);
            let page = list_streams_by_recipient_and_status(
                &env,
                &recipient,
                StreamStatus::Paused,
                None,
                10,
            );
            // Streams 3, 4 are Paused
            assert_eq!(page.streams.len(), 2);
            assert_eq!(page.streams.get(0).unwrap().id, 3);
            assert_eq!(page.streams.get(1).unwrap().id, 4);
            assert_eq!(page.next_cursor, None);
        });
    }

    #[test]
    fn test_list_streams_by_sender_and_status() {
        let (env, contract_id) = setup_env();
        env.as_contract(&contract_id, || {
            let (sender_a, _sender_b, _recipient) = seed_streams(&env);
            let page = list_streams_by_sender_and_status(
                &env,
                &sender_a,
                StreamStatus::Active,
                None,
                10,
            );
            // sender_a has odd IDs (1, 3, 5); only 1 is Active
            assert_eq!(page.streams.len(), 1);
            assert_eq!(page.streams.get(0).unwrap().id, 1);
            assert_eq!(page.next_cursor, None);
        });
    }

    #[test]
    fn test_pagination_with_gaps() {
        let (env, contract_id) = setup_env();
        env.as_contract(&contract_id, || {
            let sender = Address::generate(&env);
            let recipient = Address::generate(&env);
            let token = Address::generate(&env);

        // Create streams 1, 2, 4, 5 (skip 3)
        for i in &[1u64, 2, 4, 5] {
            let stream = Stream {
                id: *i,
                sender: sender.clone(),
                recipient: recipient.clone(),
                token: token.clone(),
                total_amount: 1000,
                released_amount: 0,
                start_time: 1000,
                end_time: 2000,
                duration: 1000,
                last_update: 1000,
                status: StreamStatus::Active,
                paused_at: 0,
                total_paused_duration: 0,
            };
            storage::set_stream(&env, *i, &stream);
        }
        storage::set_next_stream_id_for_test(&env, 6);

            let page = list_streams(&env, None, 10);
            // Should return 4 streams (1, 2, 4, 5), skipping the gap at 3
            assert_eq!(page.streams.len(), 4);
            assert_eq!(page.streams.get(0).unwrap().id, 1);
            assert_eq!(page.streams.get(1).unwrap().id, 2);
            assert_eq!(page.streams.get(2).unwrap().id, 4);
            assert_eq!(page.streams.get(3).unwrap().id, 5);
            assert_eq!(page.next_cursor, None);
        });
    }

    #[test]
    fn test_no_streams_match_filter() {
        let (env, contract_id) = setup_env();
        env.as_contract(&contract_id, || {
            seed_streams(&env);
            let non_existent_sender = Address::generate(&env);
            let page = list_streams_by_sender(&env, &non_existent_sender, None, 10);
            assert_eq!(page.streams.len(), 0);
            assert_eq!(page.next_cursor, None);
        });
    }

    #[test]
    fn test_start_after_beyond_last_stream() {
        let (env, contract_id) = setup_env();
        env.as_contract(&contract_id, || {
            seed_streams(&env);
            let page = list_streams(&env, Some(100), 10);
            assert_eq!(page.streams.len(), 0);
            assert_eq!(page.next_cursor, None);
        });
    }

    // ── Overflow safety ───────────────────────────────────────────────────────

    /// `start_after = u64::MAX` must not panic. `saturating_add(1)` on `MAX`
    /// stays at `MAX`, and since no stream ID can equal or exceed `max_id`
    /// (which is at most `u64::MAX`), the loop terminates immediately.
    #[test]
    fn test_start_after_u64_max_is_overflow_safe() {
        let (env, contract_id) = setup_env();
        env.as_contract(&contract_id, || {
            seed_streams(&env);
            let page = list_streams(&env, Some(u64::MAX), 10);
            assert_eq!(page.streams.len(), 0);
            assert_eq!(page.next_cursor, None);
        });
    }

    /// `limit = 0` returns empty streams. A `next_cursor` of `Some(0)` is
    /// produced because the loop never ran and `current_id (1) < max_id (7)`.
    #[test]
    fn test_limit_zero_returns_empty_page() {
        let (env, contract_id) = setup_env();
        env.as_contract(&contract_id, || {
            seed_streams(&env);
            let page = list_streams(&env, None, 0);
            assert_eq!(page.streams.len(), 0);
            assert_eq!(page.next_cursor, Some(0));
        });
    }

    /// `start_after = Some(0)` is identical to `start_after = None`:
    /// both start from stream ID 1.
    #[test]
    fn test_start_after_zero_is_same_as_none() {
        let (env, contract_id) = setup_env();
        env.as_contract(&contract_id, || {
            seed_streams(&env);
            let page_none = list_streams(&env, None, 10);
            let page_zero = list_streams(&env, Some(0), 10);
            assert_eq!(page_none.streams.len(), page_zero.streams.len());
            assert_eq!(page_none.next_cursor, page_zero.next_cursor);
            for i in 0..page_none.streams.len() {
                assert_eq!(
                    page_none.streams.get(i).unwrap().id,
                    page_zero.streams.get(i).unwrap().id
                );
            }
        });
    }

    /// `limit = u64::MAX` is capped to `MAX_PAGE_SIZE` safely.
    #[test]
    fn test_limit_near_u64_max_is_capped_safely() {
        let (env, contract_id) = setup_env();
        env.as_contract(&contract_id, || {
            seed_streams(&env);
            let page = list_streams(&env, None, u64::MAX);
            // 6 streams exist, all < MAX_PAGE_SIZE, so all returned
            assert_eq!(page.streams.len(), 6);
            assert_eq!(page.next_cursor, None);
        });
    }

    /// Cursor-chaining across pages must enumerate every stream exactly once.
    #[test]
    fn test_cursor_continuity_no_duplicates_or_gaps() {
        let (env, contract_id) = setup_env();
        env.as_contract(&contract_id, || {
            seed_streams(&env);
            let mut all_ids: soroban_sdk::Vec<u64> = soroban_sdk::Vec::new(&env);
            let mut cursor: Option<u64> = None;
            loop {
                let page = list_streams(&env, cursor, 2);
                for stream in page.streams.iter() {
                    all_ids.push_back(stream.id);
                }
                cursor = page.next_cursor;
                if cursor.is_none() {
                    break;
                }
            }
            assert_eq!(all_ids.len(), 6);
            for (i, id) in all_ids.iter().enumerate() {
                assert_eq!(id, (i as u64) + 1, "stream IDs must be 1–6 in order");
            }
        });
    }

    /// Status filter with no matches returns empty and no cursor.
    /// `StreamStatus::Cancelled` has no streams in the fixture.
    #[test]
    fn test_list_streams_by_status_no_match_returns_empty() {
        let (env, contract_id) = setup_env();
        env.as_contract(&contract_id, || {
            seed_streams(&env);
            let page = list_streams_by_status(&env, StreamStatus::Cancelled, None, 10);
            assert_eq!(page.streams.len(), 0);
            assert_eq!(page.next_cursor, None);
        });
    }

    /// Combined (sender + status) filter: no stream matches both conditions.
    #[test]
    fn test_sender_status_no_match_returns_empty() {
        let (env, contract_id) = setup_env();
        env.as_contract(&contract_id, || {
            let (sender_a, _sender_b, _recipient) = seed_streams(&env);
            // sender_a has odd IDs (1, 3, 5). None are Settled.
            let page = list_streams_by_sender_and_status(
                &env,
                &sender_a,
                StreamStatus::Settled,
                None,
                10,
            );
            assert_eq!(page.streams.len(), 0);
            assert_eq!(page.next_cursor, None);
        });
    }

    /// Multi-page cursor-chaining for a filtered view (by sender).
    #[test]
    fn test_filtered_pagination_with_cursor_chaining() {
        let (env, contract_id) = setup_env();
        env.as_contract(&contract_id, || {
            let (sender_a, _sender_b, _recipient) = seed_streams(&env);

            // sender_a has streams 1, 3, 5 (odd IDs). Paginate with limit=1.
            let page1 = list_streams_by_sender(&env, &sender_a, None, 1);
            assert_eq!(page1.streams.len(), 1);
            assert_eq!(page1.streams.get(0).unwrap().id, 1);
            assert!(page1.next_cursor.is_some());

            let page2 = list_streams_by_sender(&env, &sender_a, page1.next_cursor, 1);
            assert_eq!(page2.streams.len(), 1);
            assert_eq!(page2.streams.get(0).unwrap().id, 3);
            assert!(page2.next_cursor.is_some());

            let page3 = list_streams_by_sender(&env, &sender_a, page2.next_cursor, 1);
            assert_eq!(page3.streams.len(), 1);
            assert_eq!(page3.streams.get(0).unwrap().id, 5);
            assert_eq!(page3.next_cursor, None);
        });
    }
}
