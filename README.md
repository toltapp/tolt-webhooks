# @tolt/webhooks

Verify and type [Tolt](https://tolt.com) webhooks. A dependency-free signature verifier plus typed events, so you can react to program activity without trusting an unverified payload.

## Install

```bash
npm install @tolt/webhooks
```

## Verify a webhook

Pass the **raw** request body, the request headers, and your endpoint's signing secret (`whsec_...`). You get back a typed event, or a `WebhookVerificationError` if it can't be trusted.

### Next.js (App Router)

```ts
import { verifyWebhook } from "@tolt/webhooks";

export async function POST(req: Request) {
  const event = verifyWebhook({
    payload: await req.text(), // raw body
    headers: req.headers,
    secret: process.env.TOLT_WEBHOOK_SECRET!,
  });

  switch (event.type) {
    case "commission.created":
      // event.data is a ToltCommission; money fields are cents as strings
      await payPartner(event.data.partner_id, Number(event.data.amount));
      break;
    case "partner.created":
      await onboard(event.data.email);
      break;
  }

  return new Response("ok");
}
```

### Express

```ts
import express from "express";
import { verifyWebhook, WebhookVerificationError } from "@tolt/webhooks";

// IMPORTANT: use the raw body, not express.json()
app.post("/tolt/webhook", express.raw({ type: "application/json" }), (req, res) => {
  try {
    const event = verifyWebhook({
      payload: req.body.toString("utf8"),
      headers: req.headers,
      secret: process.env.TOLT_WEBHOOK_SECRET!,
    });
    // handle event...
    res.sendStatus(200);
  } catch (err) {
    if (err instanceof WebhookVerificationError) return res.sendStatus(400);
    throw err;
  }
});
```

## Events

Narrow on `event.type` and `event.data` is typed for you.

| Event | `data` |
| --- | --- |
| `partner.created`, `partner.updated` | `ToltPartner` |
| `link.created`, `link.updated` | `ToltLink` |
| `customer.created`, `customer.updated` | `ToltCustomer` |
| `transaction.created`, `transaction.updated` | `ToltTransaction` |
| `commission.created`, `commission.updated` | `ToltCommission` |

Every event is `{ type, data, timestamp }`.

## Notes

- **Always pass the raw body.** Re-serializing a parsed JSON object changes the bytes and the signature won't match.
- Verification includes a timestamp check (default 5 minutes) to guard against replays. Adjust with `toleranceInSeconds`.

## License

Apache-2.0
