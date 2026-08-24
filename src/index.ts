/**
 * @tolt/webhooks
 *
 * Verify and type Tolt webhooks. `verifyWebhook()` checks the signature on an
 * incoming request and hands you back a typed event, so you can react to
 * `commission.created`, `partner.created`, and the rest with confidence and
 * without trusting an unverified payload.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/** Thrown when a webhook can't be trusted: bad signature, replay, or malformed request. */
export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookVerificationError";
  }
}

/** Every event Tolt can send. */
export type ToltEventType =
  | "partner.created"
  | "partner.updated"
  | "link.created"
  | "link.updated"
  | "customer.created"
  | "customer.updated"
  | "transaction.created"
  | "transaction.updated"
  | "commission.created"
  | "commission.updated";

// Resource shapes carry the fields you reach for most, and stay open (`[key: string]`)
// so a payload with extra or missing fields is never a type error.
type Resource = { id: string; organization_id: string; created_at?: string; [key: string]: unknown };
export type ToltPartner = Resource & { program_id?: string; email?: string; first_name?: string; last_name?: string };
export type ToltLink = Resource & { param?: string; value?: string; partner_id?: string };
export type ToltCustomer = Resource & { email?: string; status?: string; partner_id?: string };
export type ToltTransaction = Resource & { amount?: number; currency?: string; status?: string; customer_id?: string };
export type ToltCommission = Resource & { amount?: number; status?: string; transaction_id?: string; partner_id?: string };

type Envelope<T extends ToltEventType, D> = {
  /** The event name, e.g. `"commission.created"`. */
  type: T;
  /** The resource the event is about. */
  data: D;
  /** ISO 8601 time the event was emitted. */
  timestamp: string;
};

/** A verified Tolt webhook. Narrow on `event.type` to get a typed `event.data`. */
export type ToltWebhookEvent =
  | Envelope<"partner.created", ToltPartner>
  | Envelope<"partner.updated", ToltPartner>
  | Envelope<"link.created", ToltLink>
  | Envelope<"link.updated", ToltLink>
  | Envelope<"customer.created", ToltCustomer>
  | Envelope<"customer.updated", ToltCustomer>
  | Envelope<"transaction.created", ToltTransaction>
  | Envelope<"transaction.updated", ToltTransaction>
  | Envelope<"commission.created", ToltCommission>
  | Envelope<"commission.updated", ToltCommission>;

type HeadersLike =
  | Record<string, string | string[] | undefined>
  | { get(name: string): string | null };

function readHeader(headers: HeadersLike, name: string): string | undefined {
  const alt = name.replace("svix-", "webhook-");
  if (typeof (headers as { get?: unknown }).get === "function") {
    const h = headers as { get(n: string): string | null };
    return h.get(name) ?? h.get(alt) ?? undefined;
  }
  const record = headers as Record<string, string | string[] | undefined>;
  const value = record[name] ?? record[name.toLowerCase()] ?? record[alt];
  return Array.isArray(value) ? value[0] : value;
}

export type VerifyWebhookOptions = {
  /** The raw request body, exactly as received (a string, not re-serialized JSON). */
  payload: string;
  /** The incoming request headers (a plain object or a Fetch `Headers`). */
  headers: HeadersLike;
  /** Your endpoint's signing secret (`whsec_...`), from the webhook settings. */
  secret: string;
  /** How far the timestamp may drift, in seconds. Defaults to 300 (5 minutes). */
  toleranceInSeconds?: number;
};

/**
 * Verify an incoming webhook and return it typed. Throws
 * {@link WebhookVerificationError} if the signature is invalid, the timestamp
 * is outside the tolerance (replay protection), or the body is malformed.
 *
 * Pass the **raw** request body. If your framework parses JSON for you, reach
 * for the raw/unparsed body instead, verifying a re-serialized object will fail.
 */
export function verifyWebhook(options: VerifyWebhookOptions): ToltWebhookEvent {
  const { payload, headers, secret } = options;
  const tolerance = options.toleranceInSeconds ?? 300;

  const id = readHeader(headers, "svix-id");
  const timestamp = readHeader(headers, "svix-timestamp");
  const signatureHeader = readHeader(headers, "svix-signature");
  if (!id || !timestamp || !signatureHeader) {
    throw new WebhookVerificationError("Missing one of the signature headers.");
  }

  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt)) {
    throw new WebhookVerificationError("Invalid timestamp header.");
  }
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - sentAt) > tolerance) {
    throw new WebhookVerificationError("Timestamp is outside the allowed tolerance (possible replay).");
  }

  const key = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  const secretBytes = Buffer.from(key, "base64");
  const signedContent = `${id}.${timestamp}.${payload}`;
  const expected = Buffer.from(createHmac("sha256", secretBytes).update(signedContent).digest("base64"));

  // The header is a space-separated list of `version,signature` pairs (for key rotation).
  const matches = signatureHeader.split(" ").some((entry) => {
    const signature = entry.includes(",") ? entry.slice(entry.indexOf(",") + 1) : entry;
    const candidate = Buffer.from(signature);
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  });
  if (!matches) {
    throw new WebhookVerificationError("Signature does not match.");
  }

  let event: unknown;
  try {
    event = JSON.parse(payload);
  } catch {
    throw new WebhookVerificationError("Payload is not valid JSON.");
  }
  return event as ToltWebhookEvent;
}
