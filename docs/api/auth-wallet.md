# Wallet Auth Input Validation

`GET /api/auth/wallet` and `POST /api/auth/wallet` validate input at the
boundary with Zod schemas (`app/lib/auth-wallet-validation.ts`) before any
other processing.

## GET /api/auth/wallet

Issues a one-time challenge for wallet-based authentication. When `limit` or `cursor` is supplied, the endpoint instead returns a paginated list of previously issued wallet challenges ordered by `(created_at, id)` for stable navigation.

| Query param | Rules |
| ----------- | ----- |
| `address`   | Required for challenge issuance. Stellar public key, checksum-validated (strkey), not just shape. |
| `limit`     | Optional for pagination. Defaults to `20`, capped at `100`. |
| `cursor`    | Optional for pagination. Must be a valid composite cursor encoding `(created_at,id)`. |

## POST /api/auth/wallet

Verifies the signed challenge (double-submit CSRF protected) and issues a
bearer token. CSRF and signature checks run only after the body passes
validation.

| Body field  | Rules |
| ----------- | ----- |
| `address`   | Required string. Checksum-valid Stellar public key. |
| `challenge` | Required string. Must match the issued shape `streampay_auth_<timestamp>_<nonce>`, max 128 chars. |
| `signature` | Required non-empty string, max 1024 chars. |

Unknown body fields are ignored. A body that is not valid JSON is rejected
with a `422` and an `INVALID_JSON` detail.

## Validation failures

Invalid input returns `422` with the standard envelope and per-field details,
the same shape `/api/streams` uses:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid.",
    "details": [
      { "field": "address", "code": "CUSTOM", "message": "must be a valid Stellar public key." }
    ],
    "request_id": "req_..."
  }
}
```

Breaking change note: these endpoints previously returned `400 BAD_REQUEST`
for malformed input (and `500` for a non-JSON body); both now return `422`.

Rate limits are unchanged, see [rate-limits.md](../rate-limits.md).
