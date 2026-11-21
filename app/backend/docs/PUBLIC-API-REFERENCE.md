# Public API Reference

Base URL: `https://api.quickex.example`

All authenticated endpoints require a bearer token:

```
Authorization: Bearer <access_token>
```

---

## Webhooks

Register a webhook URL to receive a `POST` request whenever a payment to one of your QuickEx links is confirmed on the Stellar network.

### Register a webhook

`POST /webhooks`

Request body:

```json
{
  "url": "https://example.com/hooks/quickex",
  "secret": "optional-shared-secret"
}
```

- `url` (required) — HTTPS endpoint that will receive deliveries.
- `secret` (optional) — when provided, deliveries are signed with HMAC-SHA256 (see below).

Response `201 Created`:

```json
{
  "id": "wh_01HXYZ...",
  "url": "https://example.com/hooks/quickex",
  "is_active": true,
  "created_at": "2024-01-01T00:00:00.000Z"
}
```

### List webhooks

`GET /webhooks`

Returns the webhooks registered for the authenticated user. URLs are masked after the first 20 characters.

Response `200 OK`:

```json
[
  {
    "id": "wh_01HXYZ...",
    "url": "https://example.com/h...",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00.000Z"
  }
]
```

### Delete a webhook

`DELETE /webhooks/:id`

Response `204 No Content`.

---

## Notification preferences

Update the notification preferences for the authenticated user.

### Update notification preferences

`PUT /notifications/preferences`

Request body:

```json
{
  "channels": ["email", "push"],
  "frequency": "daily"
}
```

- `channels` (required) — array of supported channel names. Supported values: `email`, `push`, `sms`, `in_app`.
- `frequency` (required) — one of the supported frequency options: `instant`, `daily`, `weekly`, `never`.

Preferences are always scoped to the authenticated user; a request can only update the caller's own preferences. Attempts to update another user's preferences are rejected with `403 Forbidden`.

Response `200 OK`:

```json
{
  "channels": ["email", "push"],
  "frequency": "daily",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

### Validation errors

Unknown channel names or frequency options are rejected before persistence with `422 Unprocessable Entity` and field-level errors:

```json
{
  "error": "validation_failed",
  "fields": {
    "channels": "unsupported channel: 'carrier_pigeon'",
    "frequency": "unsupported frequency: 'hourly'"
  }
}
```

Existing preferences that were stored before validation was introduced remain readable via `GET /notifications/preferences`; only new updates are validated.

---

## Webhook payload

Deliveries are sent as `POST` requests with `Content-Type: application/json`.

```json
{
  "event": "payment.completed",
  "delivery_id": "wd_01HXYZ...",
  "subscription_id": "wh_01HXYZ...",
  "payment": {
    "id": "pay_01HXYZ...",
    "link_id": "link_01HXYZ...",
    "amount": "25.0000000",
    "asset": "XLM",
    "from": "G...",
    "to": "G...",
    "transaction_hash": "abc123...",
    "confirmed_at": "2024-01-01T00:00:00.000Z"
  },
  "triggered_at": "2024-01-01T00:00:01.000Z"
}
```

### Delivery & retries

- A delivery is considered successful when your endpoint responds with a `2xx` status code.
- Failed deliveries are retried with exponential backoff: up to **5 retries over 24 hours**.
- Each attempt is logged (timestamp, status code, response snippet) and can be inspected via the delivery log.

### Signature verification

When a `secret` was supplied at registration, each request includes an `X-QuickEx-Signature` header containing the hex-encoded HMAC-SHA256 of the raw request body, keyed with your secret.

Always verify the signature against the **raw** request body before trusting the payload.

#### Node.js

```js
const crypto = require('crypto');

function verifyQuickExSignature(rawBody, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature || '', 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Express example (raw body required)
app.post('/hooks/quickex', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.get('X-QuickEx-Signature');
  if (!verifyQuickExSignature(req.body, signature, process.env.QUICKEX_WEBHOOK_SECRET)) {
    return res.status(401).send('invalid signature');
  }
  const event = JSON.parse(req.body.toString('utf8'));
  // handle event...
  res.status(200).send('ok');
});
```

#### Python

```python
import hmac
import hashlib


def verify_quickex_signature(raw_body: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature or "")


# Flask example
from flask import Flask, request, abort

app = Flask(__name__)


@app.post("/hooks/quickex")
def quickex_hook():
    signature = request.headers.get("X-QuickEx-Signature", "")
    if not verify_quickex_signature(request.get_data(), signature, "your-secret"):
        abort(401)
    event = request.get_json(force=True)
    # handle event...
    return "ok", 200
```

---

## Contract registry

Read the currently active version of a contract from the registry.

### Get a contract registry entry

`GET /contracts/:id`

Response `200 OK` includes an `ETag` header derived from the active contract version:

```json
{
  "id": "contract_01HXYZ...",
  "version": 3,
  "etag": "\"v3\"",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

### Conditional requests

Send `If-None-Match` with a previously received `ETag` to avoid re-downloading an unchanged entry:

```
GET /contracts/contract_01HXYZ...
If-None-Match: "v3"
```

- `304 Not Modified` is returned only when the supplied `ETag` matches the **current** active version.
- `200 OK` with the current body and a new `ETag` is returned when the version has changed.

### Rollback

`POST /contracts/:id/rollback`

Rolls the contract back to a previous version. A successful rollback:

- Bumps the registry `version` and therefore changes the `ETag`.
- Invalidates the affected backend caches, so the next read returns the rolled-back version.
- Causes conditional requests carrying the pre-rollback `ETag` to return `200 OK` with the rolled-back version instead of a stale `304 Not Modified`.

Response `200 OK`:

```json
{
  "id": "contract_01HXYZ...",
  "version": 4,
  "etag": "\"v4\"",
  "updated_at": "2024-01-01T00:00:05.000Z"
}
```
