# ZFunnel API and webhooks

## Authentication

Create a key under **Settings → Developers**. The key is shown once; only a SHA-256 hash is stored. Send it on every request:

```
Authorization: Bearer zf_…
```

Base URL: `https://app.<ROOT_DOMAIN>/api/v1`. Each key belongs to one workspace. Rate limit: 120 requests per minute per key (HTTP 429 above that). Errors look like `{ "error": { "message": "…" } }`.

## Endpoints

| Method | Path                        | Body / query                                                       | Returns                                                                                                                                                                                                                      |
| ------ | --------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/me`                       | —                                                                  | The workspace the key belongs to (use it to test a key)                                                                                                                                                                      |
| GET    | `/contacts`                 | `email`, `limit` (max 200), `before` (ISO date, for paging)        | `{ data: Contact[], nextBefore }`                                                                                                                                                                                            |
| POST   | `/contacts`                 | `{ email, name?, phone?, tags?: string[], fields?: {key: value} }` | Creates the contact or updates it by email. Tags are added, never removed. Responds 201 when created, 200 when updated. Adding tags fires “Tag is added” automations. Responds 402 when the plan's contact limit is reached. |
| GET    | `/contacts/{id}`            | —                                                                  | The contact plus its last 50 activities                                                                                                                                                                                      |
| GET    | `/orders`                   | `limit`                                                            | Newest orders with items and buyer email. Amounts are in cents.                                                                                                                                                              |
| POST   | `/courses/{id}/enrollments` | `{ email, name? }`                                                 | Gives the person access to the course (creates the contact if needed)                                                                                                                                                        |

Example:

```bash
curl -X POST https://app.example.com/api/v1/contacts \
  -H "Authorization: Bearer zf_…" -H "content-type: application/json" \
  -d '{"email":"jane@example.com","tags":["webinar"],"fields":{"company":"Acme"}}'
```

## Webhooks

Add an https endpoint under **Settings → Developers** and pick events:

| Event              | When                                                |
| ------------------ | --------------------------------------------------- |
| `contact.opted_in` | An opt-in form or survey with an email is submitted |
| `contact.tagged`   | A tag is added (dashboard, API or a survey)         |
| `order.paid`       | A checkout or one-click upsell is paid              |
| `form.submitted`   | A form, survey or quiz is submitted                 |
| `booking.created`  | An appointment is booked                            |

Each delivery is a `POST` with this JSON body:

```json
{
  "id": "evt_…",
  "type": "order.paid",
  "createdAt": "2026-10-10T12:00:00Z",
  "data": {
    "contact": { "id": "…", "email": "…", "name": "…", "tags": [], "fields": {} },
    "orderId": "…",
    "productIds": "…"
  }
}
```

Failed deliveries (non-2xx, timeouts) are retried up to 6 times with exponential backoff. Private, loopback and link-local addresses are refused.

### Verifying signatures

Every request carries `ZFunnel-Signature: t=<unix seconds>,v1=<hex>`, where `v1 = HMAC-SHA256(secret, "<t>.<raw body>")`. Reject requests whose timestamp is more than 5 minutes old.

```js
import { createHmac, timingSafeEqual } from "node:crypto";

function verify(rawBody, header, secret) {
  const { t, v1 } = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  return timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}
```

Zapier, Make and n8n: use their generic “Webhooks / Catch hook” trigger with the URL they give you.
