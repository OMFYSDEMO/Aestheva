import { Hono } from "hono";
import type { Env } from "../env";
import { HttpError } from "../db";
import { POLICY } from "../config";
import { addDays, daysBetween, fmtTime, isIsoDate, nowIst } from "../domain/time";
import { loadInventory, slotsOn, type ServiceRow } from "../services/catalog";
import { applyCapturedPayment, authorisedBooking, bookingByRef, cancelByClient, createBooking, type PaymentRow } from "../services/bookings";
import { gatewayFor, previewAllowed } from "../services/gateway";
import { COMPANY } from "../config";

const api = new Hono<{ Bindings: Env }>();

async function json<T>(req: Request): Promise<T> {
  try { return (await req.json()) as T; } catch { throw new HttpError(400, "Invalid request body"); }
}
const origin = (env: Env, req: Request) => env.SITE_URL || new URL(req.url).origin;

/** Free start times for a service over a run of days. staff = a staff id or "any". */
api.get("/slots", async (c) => {
  const serviceId = c.req.query("service") ?? "", staff = c.req.query("staff") || "any";
  const now = nowIst();
  const from = isIsoDate(c.req.query("from")) ? c.req.query("from")! : now.date;
  const days = Math.min(Math.max(Number(c.req.query("days")) || 14, 1), 21);
  if (daysBetween(now.date, from) < 0 || daysBetween(now.date, from) > POLICY.windowDays) throw new HttpError(400, "Dates outside the booking window");
  const statuses = previewAllowed(c.env, c.req.query("preview")) ? "'live','draft'" : "'live'";
  const svc = await c.env.DB.prepare(`SELECT s.* FROM services s JOIN providers p ON p.id = s.provider_id WHERE s.id = ? AND s.active = 1 AND p.status IN (${statuses})`)
    .bind(serviceId).first<ServiceRow>();
  if (!svc) throw new HttpError(404, "Service not found");
  const offered = (await c.env.DB.prepare("SELECT ss.staff_id FROM service_staff ss JOIN staff t ON t.id = ss.staff_id WHERE ss.service_id = ? AND t.active = 1 ORDER BY t.rowid")
    .bind(svc.id).all<{ staff_id: string }>()).results.map((r) => r.staff_id);
  const ids = staff === "any" ? offered : offered.filter((x) => x === staff);
  if (!ids.length) throw new HttpError(400, "That practitioner doesn't offer this service");
  const to = addDays(from, days - 1);
  const inv = await loadInventory(c.env.DB, ids, from, to, [svc.id]);
  const out = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    out.push({ date, slots: slotsOn(inv, ids, date, svc.dur_min, now, svc.id).map((s) => ({ min: s.min, label: fmtTime(s.min), staffId: s.staffId })) });
  }
  c.header("cache-control", "no-store");
  return c.json({ service: svc.id, staff, days: out });
});

/** Reserve a slot. Returns the payment order to open in Razorpay Checkout, or a confirmed booking when no deposit is due. */
api.post("/bookings", async (c) => {
  const b = await json<Record<string, unknown>>(c.req.raw);
  const created = await createBooking(c.env, {
    serviceId: String(b.serviceId ?? ""), staffId: String(b.staffId ?? "any"), date: String(b.date ?? ""), start: Number(b.start),
    name: String(b.name ?? ""), phone: String(b.phone ?? ""), email: String(b.email ?? ""), note: String(b.note ?? ""),
    ackMedical: b.ackMedical === true, ackTreatment: b.ackTreatment === true,
    allowDraft: previewAllowed(c.env, b.preview),
  });
  const bk = created.booking;
  const manageUrl = `${origin(c.env, c.req.raw)}/booking/${bk.ref}?t=${created.manageToken}`;
  return c.json({
    ref: bk.ref, status: bk.status, manageUrl, holdExpiresAt: bk.hold_expires_at,
    payment: created.payment && {
      ...created.payment, currency: "INR", name: COMPANY.brand, description: `Deposit · ${bk.service_name}`,
      prefill: { name: String(b.name ?? ""), email: String(b.email ?? ""), contact: String(b.phone ?? "") },
    },
  }, 201);
});

async function paymentFor(db: D1Database, ref: string, orderId: string) {
  const bk = await bookingByRef(db, ref);
  if (!bk) throw new HttpError(404, "Booking not found");
  const pay = await db.prepare("SELECT * FROM payments WHERE booking_id = ? AND order_id = ?").bind(bk.id, orderId).first<PaymentRow>();
  if (!pay) throw new HttpError(404, "Payment not found for this booking");
  return { bk, pay };
}

/** Razorpay Checkout success callback: verify the signature, make sure the payment is captured, confirm the booking. */
api.post("/bookings/:ref/payment", async (c) => {
  const b = await json<Record<string, string>>(c.req.raw);
  const orderId = String(b.razorpay_order_id ?? ""), paymentId = String(b.razorpay_payment_id ?? ""), signature = String(b.razorpay_signature ?? "");
  const { pay } = await paymentFor(c.env.DB, c.req.param("ref"), orderId);
  const gw = gatewayFor(c.env);
  if (!(await gw.verifyCheckout(orderId, paymentId, signature))) throw new HttpError(400, "Payment could not be verified");
  let p = await gw.fetchPayment(paymentId);
  if (p.order_id && p.order_id !== orderId) throw new HttpError(400, "Payment belongs to a different order");
  if (p.status === "authorized") p = await gw.capture(paymentId, pay.amount_paise);
  if (p.status !== "captured") throw new HttpError(402, "The payment has not completed yet");
  const r = await applyCapturedPayment(c.env, { orderId, paymentId, amount: p.amount || pay.amount_paise, method: p.method }, "client");
  const bk = (await bookingByRef(c.env.DB, c.req.param("ref")))!;
  return c.json({ outcome: r.outcome, status: bk.status });
});

/** Development only: completes a deposit without a real gateway. */
api.post("/bookings/:ref/simulate-payment", async (c) => {
  const gw = gatewayFor(c.env);
  if (gw.kind !== "simulated" || c.env.APP_ENV === "production") throw new HttpError(404, "Not found");
  const b = await json<{ token?: string; orderId?: string }>(c.req.raw);
  const bk = await authorisedBooking(c.env.DB, c.req.param("ref"), String(b.token ?? ""));
  const { pay } = await paymentFor(c.env.DB, bk.ref, String(b.orderId ?? ""));
  const r = await applyCapturedPayment(c.env, { orderId: pay.order_id, paymentId: "sim_pay_" + crypto.randomUUID().slice(0, 12), amount: pay.amount_paise, method: "upi" }, "client");
  return c.json({ outcome: r.outcome, status: (await bookingByRef(c.env.DB, bk.ref))!.status });
});

api.post("/bookings/:ref/cancel", async (c) => {
  const b = await json<{ token?: string; requestReview?: boolean; reason?: string }>(c.req.raw);
  const bk = await authorisedBooking(c.env.DB, c.req.param("ref"), String(b.token ?? ""));
  const r = await cancelByClient(c.env, bk, { requestReview: b.requestReview === true, reason: b.reason });
  return c.json({ status: "cancelled", refund: r.refund });
});

export default api;
