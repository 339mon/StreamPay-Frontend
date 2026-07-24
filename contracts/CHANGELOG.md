# StreamPay contract changelog

This changelog tracks user-visible changes to the Soroban contract
under `contracts/contracts/streampay-stream/`. Backend changes are
tracked in the repository-root `CHANGELOG.md`.

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Discriminant numbers in `error.rs` are part of the public contract API
and must never be reused — see the module rustdoc for details.

## [Unreleased]

### Added
- **Admin nonce / replay prevention** (`#949`).
  - New entrypoint `get_admin_nonce() → u64` — read-only query for the
    next expected nonce value.
  - New entrypoint `admin_override(admin, nonce, stream_id, new_end_time) → Stream`
    — privileged override of a stream's `end_time`, guarded by a
    monotonic nonce that prevents replay attacks.
  - New error codes: `NonceTooLow = 14`, `NonceOutOfOrder = 15`.
  - New error code: `RecipientTrustlineMissing = 16` (was already
    referenced in `lib.rs`; now formally declared in `error.rs`).
  - New module `src/admin.rs` containing the nonce storage key,
    `consume_nonce`, and the `admin_override` implementation.
  - New test module `src/admin_nonce_test.rs` with 14 focused tests
    covering replay prevention, out-of-order nonces, auth failures,
    terminal-state guards, and time-range validation.
  - See `contracts/ADMIN_NONCE.md` for design rationale and usage.
- Module-level documentation for `error.rs`, `storage.rs`, and events
  schema in `events.rs`.
- `init_with_token_allowlist(admin, tokens)` entrypoint. Performs the
  work of `initialize` and then marks every address in `tokens` as
  `allowed = true` in a single transaction, replacing the
  previously-required `initialize` + N `set_token_allowed` two-step
  deploy flow. Old `initialize` path is unchanged for backward
  compatibility.

### Notes
- TTL tuning for stream and instance keys remains at the same constants
  the operational runbook assumes.

## [0.1.0] - Initial draft

### Added
- `initialize`, `create_stream`, `start_stream`, `withdraw`, `pause`,
  `resume`, `settle` entry points.
- Per-token allowlist via `set_token_allowed`.
- Global emergency pause via `set_paused`.
- `created`, `started`, `withdrawn`, `settled`, `paused`, `resumed`
  events.
