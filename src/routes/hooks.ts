import { Hono } from "hono";
import type { Env } from "../env";
import { audit } from "../db";
import { applyCapturedPayment } from "../services/bookings";
import { gatewayFor, verifyWebhook } from "../services/gateway";

const hooks = new Hono<{ Bindings: Env }>();

/**
 * Razorpay webhook. Subscribe to payment.captured, payment.authorized, order.paid and refund.processed.
 * Confirms bookings whose client closed the browser before the checkout callback, and records refund outcomes.
 * Each event id is processed once; Razorpay retries anything that does not get a 2xx.
 */
/** Opening this address in a browser confirms the webhook route is reachable. Razorpay itself only POSTs. */
hooks.get("/razorpay", (c) => c.json({ ok: true, endpoint: "Razorpay webhook", accepts: "POST from Razorpay", secretConfigured: !!c.env.RAZORPAY_WEBHOOK_SECRET }));

/** Rejected deliveries are recorded (reason and event name only, never the body or secrets) so failures can be diagnosed. */
async function rejected(db: D1Database, reason: string, raw: string, signed: boolean) {
  let event = "unknown";
  try { event = String(JSON.parse(raw)?.event ?? "unknown"); } catch { /* not JSON */ }
  await audit(db, "razorpay", "webhook.rejected", "event", event, { reason, signed, bytes: raw.length }).run();
}

hooks.post("/razorpay", async (c) => {
  const raw = await c.req.text();
  const sig = c.req.header("x-razorpay-signature") ?? null;
  if (!c.env.RAZORPAY_WEBHOOK_SECRET?.trim()) { await rejected(c.env.DB, "webhook secret not configured", raw, !!sig); return c.json({ error: "webhook secret not configured" }, 503); }
  if (!(await verifyWebhook(c.env, raw, sig))) { await rejected(c.env.DB, sig ? "signature does not match the webhook secret" : "no signature header", raw, !!sig); return c.json({ error: "invalid signature" }, 401); }
  let evt: any; try { evt = JSON.parse(raw); } catch { await rejected(c.env.DB, "body is not JSON", raw, true); return c.json({ error: "invalid body" }, 400); }
  const eventId = c.req.header("x-razorpay-event-id") || `${evt.event}:${evt.payload?.payment?.entity?.id ?? evt.payload?.refund?.entity?.id ?? evt.created_at}`;
  const db = c.env.DB;
  if (await db.prepare("SELECT 1 FROM webhook_events WHERE id = ?").bind(eventId).first()) return c.json({ ok: true, duplicate: true });

  const pay = evt.payload?.payment?.entity;
  let result: unknown = "ignored";
  if ((evt.event === "payment.captured" || evt.event === "order.paid") && pay?.order_id) {
    result = await applyCapturedPayment(c.env, { orderId: pay.order_id, paymentId: pay.id, amount: pay.amount, method: pay.method ?? null }, "razorpay");
  } else if (evt.event === "payment.authorized" && pay?.order_id) {
    const known = await db.prepare("SELECT amount_paise FROM payments WHERE order_id = ? AND status = 'created'").bind(pay.order_id).first<{ amount_paise: number }>();
    if (known) {
      const p = await gatewayFor(c.env).capture(pay.id, known.amount_paise);
      if (p.status === "captured") result = await applyCapturedPayment(c.env, { orderId: pay.order_id, paymentId: pay.id, amount: p.amount, method: p.method }, "razorpay");
    }
  } else if (evt.event === "refund.processed" || evt.event === "refund.failed") {
    const rf = evt.payload?.refund?.entity;
    if (rf?.id) {
      await db.prepare("UPDATE refunds SET status = ? WHERE gateway_refund_id = ?").bind(evt.event === "refund.processed" ? "processed" : "failed", rf.id).run();
      result = "refund updated";
    }
  }
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO webhook_events (id, event) VALUES (?, ?)").bind(eventId, String(evt.event)),
    audit(db, "razorpay", "webhook", "event", eventId, { event: evt.event, result }),
  ]);
  return c.json({ ok: true });
});

export default hooks;
