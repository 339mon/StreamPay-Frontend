# StreamPay Stream Smart Contract

Linear payment streams on Stellar/Soroban.

## Entrypoints

| Entrypoint | Mutating | Required Authorizer | Description |
| :--- | :--- | :--- | :--- |
| `initialize` | Yes | `admin` | Initialises the contract with an admin and pause state. |
| `init_with_token_allowlist` | Yes | `admin` | Atomic deployment-time initialisation + per-token allowlist; equivalent to `initialize` followed by one `set_token_allowed(allowed = true)` per token, committed in a single transaction. |
| `set_paused` | Yes | `admin` | Sets the global emergency pause flag. |
| `set_admin` | Yes | `admin` | Transfers the admin role to a new address. |
| `set_token_allowed` | Yes | `admin` | Allows or blocks a token for future stream creation. |
| `create_stream` | Yes | `sender` | Creates a stream and escrows funds from the sender. |
| `start_stream` | Yes | `stream.sender` | Activates a draft stream, anchoring its time bounds. |
| `pause` | Yes | `stream.sender` | Freezes accrual for an active stream. |
| `resume` | Yes | `stream.sender` | Resumes a paused stream, extending the end time. |
| `cancel_stream` | Yes | `stream.sender` | Ends a stream early, refunding unvested funds to sender. |
| `withdraw` | Yes | `stream.recipient` | Withdraws vested funds to the recipient. |
| `settle` | Yes | `stream.recipient` | Ends a stream and releases all remaining funds to recipient. |
| `get_stream` | No | None | Returns the stream record. |
| `withdrawable` | No | None | Returns the currently withdrawable amount. |
| `stream_balance` | No | None | Returns the vested balance at the current time. |

## Lifecycle events

All state-changing entrypoints emit a structured Soroban contract event
**after** the successful mutation and any token transfer. Failed calls emit
no events.

Every stream-level event uses a two-topic layout:

```
topic[0] = Symbol("stream")
topic[1] = Symbol("<event_name>")
data     = vec-encoded payload fields
```

| Event | Emitted by | Payload fields |
|-------|-----------|----------------|
| `created`   | `create_stream`       | `stream_id`, `sender`, `recipient`, `token`, `total_amount`, `timestamp` |
| `started`   | `start_stream`        | `stream_id`, `start_time`, `end_time`, `timestamp` |
| `paused`    | `pause`               | `stream_id`, `sender`, `pause_time`, `timestamp` |
| `resumed`   | `resume`              | `stream_id`, `sender`, `end_time`, `timestamp` |
| `withdrawn` | `withdraw`            | `stream_id`, `recipient`, `amount`, `timestamp` |
| `settled`   | `withdraw` (full) or `settle` | `stream_id`, `recipient`, `total_amount`, `timestamp` |
| `cancelled` | `cancel_stream`       | `stream_id`, `cancelled_by`, `returned_amount`, `released_amount`, `timestamp` |
| `amended`   | `amend_stream`        | `stream_id`, `amended_by`, `new_rate_per_second`, `new_end_time`, `timestamp` |
| `upgraded`  | `upgrade`             | `new_wasm_hash` (topics: `"StreamPay"/"upgraded"`) |

When a `withdraw` fully drains the stream it emits two events in order:
`withdrawn` then `settled`.

Admin utility events (`set_pause`, `set_admin`, `set_token`) use
`symbol_short!` two-tuples — see `src/events.rs` for the exact encoding.

## Development

```bash
# Build
cargo build --target wasm32-unknown-unknown --release

# Test
cargo test

# Coverage gate (≥ 95 % lines / regions / functions)
make coverage
```

## Benchmark harness

Criterion benchmarks live in `benches/entrypoints.rs`.  There is one
`BenchmarkGroup` per public entrypoint; each group has sub-benchmarks for
representative pre-conditions (e.g. partial vs. full withdrawal).

The Soroban in-process test host is used so results are stable and
deterministic — no network or ledger overhead.

```bash
# Build the benchmark binary without running it (also what CI does)
make bench-compile

# Run all groups and open the HTML report
make bench
open target/criterion/report/index.html

# Run a single group (substring match)
make bench-withdraw
make bench-create
make bench-read      # get_stream, withdrawable, stream_balance, ...
make bench-lifecycle # pause, resume, settle, cancel_stream, amend_stream
make bench-admin     # initialize, set_paused, set_admin, ...

# Save a baseline before a refactor, then compare afterwards
make bench-baseline NAME=before-refactor
# ... make changes ...
make bench-compare  NAME=before-refactor
```

**Reading results:** Criterion reports a lower/upper confidence interval for
each measurement.  A red regression flag in the HTML report means the new run
is statistically slower at the configured confidence level (95 %).  Run
benchmarks on a quiet machine — shared CI runners have high timing variance.

| Group | Sub-benchmark | What is measured |
| :--- | :--- | :--- |
| `initialize` | `initialize` | Admin write + paused-flag write |
| `init_with_token_allowlist` | `three_tokens` | Admin + 3 × allowlist writes |
| `set_paused` | `pause` / `unpause` | Admin lookup + flag write |
| `set_admin` | `set_admin` | Admin lookup + key overwrite |
| `set_token_allowed` | `allow` / `block` | Admin lookup + allowlist write |
| `set_max_streams_per_sender` | `set_max_streams_per_sender` | Admin lookup + instance write |
| `max_streams_per_sender` | `max_streams_per_sender` | Single instance read |
| `sender_stream_count` | `zero_streams` / `one_stream` | Single persistent read |
| `get_stream` | `get_stream` | Persistent read + TTL extend |
| `withdrawable` | `at_midpoint` / `at_end` | Linear-interpolation math |
| `stream_balance` | `at_midpoint` / `at_end` | Vested-amount calculation |
| `create_stream` | `create_stream` | Token transfer + stream write + event |
| `start_stream` | `start_stream` | Stream read + timestamp write + event |
| `withdraw` | `partial` / `full_settle` | Token transfer + stream write + events |
| `pause` | `pause` | Stream read + status write + event |
| `resume` | `resume` | Stream read + checked arithmetic + write |
| `settle` | `full_payout` / `zero_payout` | Token transfer (optional) + finalization |
| `cancel_stream` | `mid_stream` / `at_start` | Token return + stream finalization |
| `amend_stream` | `extend_end_time` | Stream read + end-time update + event |
