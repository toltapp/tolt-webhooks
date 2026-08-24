import express from "express";
import {
  verifyWebhook,
  WebhookVerificationError,
  type ToltWebhookEvent,
  type ToltPartner,
  type ToltLink,
  type ToltCustomer,
  type ToltTransaction,
  type ToltCommission,
} from "@tolt/webhooks";

const app = express();
const secret = process.env.TOLT_WEBHOOK_SECRET ?? "whsec_example";

app.post(
  "/webhooks/tolt",
  express.raw({ type: "application/json" }),
  (req, res) => {
    let event: ToltWebhookEvent;

    try {
      event = verifyWebhook({
        payload: req.body.toString("utf8"),
        headers: req.headers,
        secret,
      });
    } catch (err) {
      if (err instanceof WebhookVerificationError) {
        return res.status(400).json({ error: err.message });
      }
      throw err;
    }

    // `event.type` narrows `event.data`, so each handler gets exactly its resource.
    switch (event.type) {
      case "partner.created":
      case "partner.updated":
        onPartner(event.data);
        break;
      case "link.created":
      case "link.updated":
        onLink(event.data);
        break;
      case "customer.created":
      case "customer.updated":
        onCustomer(event.data);
        break;
      case "transaction.created":
      case "transaction.updated":
        onTransaction(event.data);
        break;
      case "commission.created":
      case "commission.updated":
        onCommission(event.data);
        break;
    }

    res.sendStatus(200);
  },
);

function onPartner(partner: ToltPartner) {
  console.log(`partner ${partner.email}: ${partner.first_name} ${partner.last_name}`);
}

function onLink(link: ToltLink) {
  console.log(`link ${link.id} (${link.param}=${link.value}) for partner ${link.partner_id}`);
}

function onCustomer(customer: ToltCustomer) {
  console.log(`customer ${customer.id} (${customer.email}) is ${customer.status}`);
}

function onTransaction(transaction: ToltTransaction) {
  console.log(`transaction ${transaction.id}: ${transaction.amount} ${transaction.currency} (${transaction.status})`);
}

function onCommission(commission: ToltCommission) {
  console.log(`commission ${commission.id}: ${commission.amount} (${commission.status})`);
}

app.listen(3000, () => {
  console.log("listening on http://localhost:3000/webhooks/tolt");
});
