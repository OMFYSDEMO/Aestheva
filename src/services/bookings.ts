import type { Env } from "../env";
import { POLICY } from "../config";
import { HttpError, audit, isUniqueViolation, newId, newRef, newToken, nowIso, sha256Hex } from "../db";
import { addDays, hoursUntil, isIsoDate, nowIst, type IstNow } from "../domain/time";
import { slotsFor } from "../domain/availability";
import { canStart, isMedical, loadInventory, type ServiceRow } from "./catalog";
import { gatewayFor } from "./gateway";

export interface BookingRow {
  id: string; ref: string; provider_id: string; service_id: string; staff_id: string; client_id: string; date: string; start_min: number;
  dur_min: number; service_name: string; kind: string; price_paise: number; deposit_paise: number; commission_bp: number; source: string;
  status: "held" | "confirmed" | "completed" | "cancelled" | "no_show" | "expired"; hold_expires_at: string | null; manage_token_hash: string;
  client_note: string; confirmed_at: string | null; cancelled_at: string | null; cancelled_by: string | null; cancel_reason: string | null; created_at: string;
}
export interface PaymentRow {
  id: string; booking_id: string; gateway: "razorpay" | "simulated"; order_id: string; payment_id: string | null; amount_paise: number;
  status: "created" | "captured" | "failed" | "refunded" | "partially_refunded"; method: string | null; captured_at: string | null;
}

// ---------- input ----------

export interface NewBooking {
  serviceId: string; staffId: string; date: string; start: number;
  name: string; phone: string; email: string; note?: string; ackMedical?: boolean; ackTreatment?: boolean;
  allowDraft?: boolean;   // set only when the request carried a valid preview key
}

/** Indian mobile numbers to E.164: 98765 43210, 098765..., +91 98765... all become +919876543210. */
export function normalisePhone(raw: string): string | null {
  const d = String(raw || "").replace(/[^\d+]/g, "").replace(/^\+?91(?=\d{10}$)/, "").replace(/^0(?=\d{10}$)/, "");
  return /^[6-9]\d{9}$/.test(d) ? "+91" + d : null;
}
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(b: NewBooking, service: ServiceRow) {
  const name = String(b.name ?? "").trim();
  if (name.length < 2 || name.length > 80) throw new HttpError(400, "Please enter your full name");
  const phone = normalisePhone(b.phone);
  if (!phone) throw new HttpError(400, "Please enter a 10-digit Indian mobile number");
  const email = String(b.email ?? "").trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 120) throw new HttpError(400, "Please enter a valid email address");
  const note = String(b.note ?? "").trim();
  if (note.length > 240) throw new HttpError(400, "The note can be at most 240 characters");
  if (!isIsoDate(b.date)) throw new HttpError(400, "Choose a date");
  if (!Number.isInteger(b.start) || b.start < 0 || b.start >= 1440) throw new HttpError(400, "Choose a time");
  if (isMedical(service) && !b.ackMedical) throw new HttpError(400, "Please confirm you understand this is a medical appointment");
  if (service.kind === "treatment" && !b.ackTreatment) throw new HttpError(400, "Please confirm the prior-assessment requirement");
  return { name, phone, email, note };
}

// ---------- create ----------

export interface CreatedBooking {
  booking: BookingRow; manageToken: string;
  payment: null | { gateway: "razorpay" | "simulated"; keyId: string; orderId: string; amount: number };
}

/**
 * Reserves the slot and, when the service takes a deposit, opens a payment order.
 * The booking and its inventory slots are written in one batch: if another client took any of the slots first,
 * the primary key on staff_slots rejects the whole batch and the next practitioner is tried.
 */
export async function createBooking(env: Env, input: NewBooking, now: Date = new Date()): Promise<CreatedBooking> {
  const db = env.DB;
  const service = await db.prepare(
    `SELECT s.* FROM services s JOIN providers p ON p.id = s.provider_id WHERE s.id = ? AND s.active = 1 AND p.status IN (${input.allowDraft ? "'live','draft'" : "'live'"})`,
  ).bind(String(input.serviceId ?? "")).first<ServiceRow>();
  if (!service) throw new HttpError(404, "This service is no longer available");
  const { name, phone, email, note } = validate(input, service);

  const offered = (await db.prepare("SELECT ss.staff_id FROM service_staff ss JOIN staff t ON t.id = ss.staff_id WHERE ss.service_id = ? AND t.active = 1 ORDER BY t.rowid")
    .bind(service.id).all<{ staff_id: string }>()).results.map((r) => r.staff_id);
  const candidates = input.staffId === "any" ? offered : offered.filter((id) => id === input.staffId);
  if (!candidates.length) throw new HttpError(400, "That practitioner doesn't offer this service");

  const ist: IstNow = nowIst(now);
  const inv = await loadInventory(db, candidates, input.date, input.date, [service.id]);
  const free = candidates.filter((id) => canStart(inv, id, input.date, input.start, service.dur_min, ist, service.id));
  const resources = inv.svcRes.get(service.id) ?? [];
  if (!free.length) throw new HttpError(409, "That time is no longer available. Please choose another.");

  // Client identity is the mobile number; name and email follow the latest booking.
  let client = await db.prepare("SELECT id FROM clients WHERE phone = ?").bind(phone).first<{ id: string }>();
  if (!client) {
    client = { id: newId("cli") };
    try { await db.prepare("INSERT INTO clients (id, name, phone, email) VALUES (?, ?, ?, ?)").bind(client.id, name, phone, email).run(); }
    catch (e) { if (!isUniqueViolation(e, "clients")) throw e; client = (await db.prepare("SELECT id FROM clients WHERE phone = ?").bind(phone).first<{ id: string }>())!; }
  }
  await db.prepare("UPDATE clients SET name = ?, email = ? WHERE id = ?").bind(name, email, client.id).run();

  const needsDeposit = service.deposit_paise > 0;
  const token = newToken();
  const tokenHash = await sha256Hex(token);
  const holdUntil = new Date(now.getTime() + POLICY.holdMinutes * 6e4).toISOString();

  for (const staffId of free) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const id = newId("bkg"), ref = newRef(), ts = nowIso();
      const status = needsDeposit ? "held" : "confirmed";
      const stmts = [
        db.prepare(`INSERT INTO bookings (id, ref, provider_id, service_id, staff_id, client_id, date, start_min, dur_min, service_name, kind,
            price_paise, deposit_paise, commission_bp, source, status, hold_expires_at, manage_token_hash, client_note, confirmed_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'marketplace', ?, ?, ?, ?, ?, ?, ?)`)
          .bind(id, ref, service.provider_id, service.id, staffId, client.id, input.date, input.start, service.dur_min, service.name, service.kind,
            service.price_paise, service.deposit_paise, POLICY.commissionBp, status, needsDeposit ? holdUntil : null, tokenHash, note,
            needsDeposit ? null : ts, ts, ts),
        ...slotsFor(input.start, service.dur_min).map((slot) =>
          db.prepare("INSERT INTO staff_slots (staff_id, date, slot, booking_id) VALUES (?, ?, ?, ?)").bind(staffId, input.date, slot, id)),
        ...resources.flatMap((r) => slotsFor(input.start, service.dur_min).map((slot) =>
          db.prepare("INSERT INTO resource_slots (resource_id, date, slot, booking_id) VALUES (?, ?, ?, ?)").bind(r, input.date, slot, id))),
        audit(db, `client:${client.id}`, needsDeposit ? "booking.held" : "booking.confirmed", "booking", id, { ref, staffId, date: input.date, start: input.start }),
      ];
      try { await db.batch(stmts); }
      catch (e) {
        if (isUniqueViolation(e, "bookings.ref")) continue;          // reference collision: new ref
        if (isUniqueViolation(e, "staff_slots")) break;              // slot just taken: next practitioner
        if (isUniqueViolation(e, "resource_slots")) throw new HttpError(409, "That time was just taken. Please choose another.");
        throw e;
      }
      const booking = (await db.prepare("SELECT * FROM bookings WHERE id = ?").bind(id).first<BookingRow>())!;
      if (!needsDeposit) return { booking, manageToken: token, payment: null };
      return { booking, manageToken: token, payment: await openPayment(env, booking) };
    }
  }
  throw new HttpError(409, "That time was just taken. Please choose another.");
}

async function openPayment(env: Env, booking: BookingRow) {
  const gw = gatewayFor(env);
  try {
    const order = await gw.createOrder(booking.deposit_paise, booking.ref, { booking_id: booking.id, ref: booking.ref });
    await env.DB.prepare("INSERT INTO payments (id, booking_id, gateway, order_id, amount_paise) VALUES (?, ?, ?, ?, ?)")
      .bind(newId("pmt"), booking.id, gw.kind, order.id, booking.deposit_paise).run();
    return { gateway: gw.kind, keyId: gw.keyId, orderId: order.id, amount: booking.deposit_paise };
  } catch (e) {
    await releaseSlots(env.DB, booking.id, "expired", "system", "payment order could not be created");
    throw e;
  }
}

async function releaseSlots(db: D1Database, bookingId: string, status: "expired" | "cancelled", by: string, reason: string) {
  const ts = nowIso();
  await db.batch([
    db.prepare("DELETE FROM staff_slots WHERE booking_id = ?").bind(bookingId),
    db.prepare("DELETE FROM resource_slots WHERE booking_id = ?").bind(bookingId),
    db.prepare(`UPDATE bookings SET status = ?, hold_expires_at = NULL, updated_at = ?,
        cancelled_at = CASE WHEN ? = 'cancelled' THEN ? ELSE cancelled_at END,
        cancelled_by = CASE WHEN ? = 'cancelled' THEN ? ELSE cancelled_by END,
        cancel_reason = ? WHERE id = ?`).bind(status, ts, status, ts, status, by, reason, bookingId),
    audit(db, by === "client" ? "client" : "system", `booking.${status}`, "booking", bookingId, { reason }),
  ]);
}

// ---------- payment confirmation ----------

/**
 * Applies a captured deposit to its booking. Called from the checkout callback, the Razorpay webhook and the
 * simulated gateway; safe to call more than once for the same payment.
 * If the hold had already lapsed, the slot is re-taken when still free; otherwise the deposit is refunded.
 */
export async function applyCapturedPayment(env: Env, p: { orderId: string; paymentId: string; amount: number; method: string | null }, actor: string) {
  const db = env.DB;
  const pay = await db.prepare("SELECT * FROM payments WHERE order_id = ?").bind(p.orderId).first<PaymentRow>();
  if (!pay) return { outcome: "unknown_order" as const };
  if (pay.status !== "created") return { outcome: "already_applied" as const, bookingId: pay.booking_id };
  if (p.amount !== pay.amount_paise) throw new HttpError(400, "Payment amount does not match the deposit");

  const booking = (await db.prepare("SELECT * FROM bookings WHERE id = ?").bind(pay.booking_id).first<BookingRow>())!;
  const ts = nowIso();
  const markCaptured = db.prepare("UPDATE payments SET status = 'captured', payment_id = ?, method = ?, captured_at = ? WHERE id = ? AND status = 'created'")
    .bind(p.paymentId, p.method, ts, pay.id);

  if (booking.status === "held") {
    await db.batch([
      markCaptured,
      db.prepare("UPDATE bookings SET status = 'confirmed', confirmed_at = ?, hold_expires_at = NULL, updated_at = ? WHERE id = ? AND status = 'held'").bind(ts, ts, booking.id),
      audit(db, actor, "booking.confirmed", "booking", booking.id, { paymentId: p.paymentId, amount: p.amount }),
    ]);
    return { outcome: "confirmed" as const, bookingId: booking.id };
  }

  if (booking.status === "expired") {
    const resources = (await db.prepare("SELECT sr.resource_id FROM service_resources sr JOIN resources r ON r.id = sr.resource_id WHERE r.active = 1 AND sr.service_id = ?")
      .bind(booking.service_id).all<{ resource_id: string }>()).results.map((r) => r.resource_id);
    try {
      await db.batch([
        markCaptured,
        ...slotsFor(booking.start_min, booking.dur_min).map((slot) =>
          db.prepare("INSERT INTO staff_slots (staff_id, date, slot, booking_id) VALUES (?, ?, ?, ?)").bind(booking.staff_id, booking.date, slot, booking.id)),
        ...resources.flatMap((r) => slotsFor(booking.start_min, booking.dur_min).map((slot) =>
          db.prepare("INSERT INTO resource_slots (resource_id, date, slot, booking_id) VALUES (?, ?, ?, ?)").bind(r, booking.date, slot, booking.id))),
        db.prepare("UPDATE bookings SET status = 'confirmed', confirmed_at = ?, cancel_reason = NULL, updated_at = ? WHERE id = ? AND status = 'expired'").bind(ts, ts, booking.id),
        audit(db, actor, "booking.confirmed_after_hold", "booking", booking.id, { paymentId: p.paymentId }),
      ]);
      return { outcome: "confirmed" as const, bookingId: booking.id };
    } catch (e) {
      if (!isUniqueViolation(e, "staff_slots") && !isUniqueViolation(e, "resource_slots")) throw e;
    }
  }

  // The slot is gone (or the booking was cancelled while paying): keep the record and return the money.
  await db.batch([
    markCaptured,
    // A client cancellation keeps its own reason; a lapsed hold records why the late payment was refunded.
    db.prepare(`UPDATE bookings SET
        cancelled_at = CASE WHEN status = 'cancelled' THEN cancelled_at ELSE ? END,
        cancelled_by = CASE WHEN status = 'cancelled' THEN cancelled_by ELSE 'system' END,
        cancel_reason = CASE WHEN status = 'cancelled' THEN cancel_reason ELSE 'slot no longer available when payment arrived' END,
        status = 'cancelled', updated_at = ? WHERE id = ?`).bind(ts, ts, booking.id),
    audit(db, actor, "booking.payment_after_release", "booking", booking.id, { paymentId: p.paymentId }),
  ]);
  await refundPayment(env, { ...pay, status: "captured", payment_id: p.paymentId }, pay.amount_paise, "slot no longer available");
  return { outcome: "refunded" as const, bookingId: booking.id };
}

export async function refundPayment(env: Env, pay: PaymentRow, amount: number, reason: string) {
  const db = env.DB, id = newId("rfd");
  try {
    const r = await gatewayFor(env).refund(pay.payment_id!, amount, { booking_id: pay.booking_id, reason });
    await db.batch([
      db.prepare("INSERT INTO refunds (id, payment_id, gateway_refund_id, amount_paise, status, reason) VALUES (?, ?, ?, ?, ?, ?)").bind(id, pay.id, r.id, amount, r.status, reason),
      db.prepare("UPDATE payments SET status = ? WHERE id = ?").bind(amount >= pay.amount_paise ? "refunded" : "partially_refunded", pay.id),
      audit(db, "system", "payment.refund", "payment", pay.id, { amount, reason, gatewayRefund: r.id }),
    ]);
    return { ok: true as const, status: r.status };
  } catch (e) {
    // Record the failure and hand it to operations rather than losing it.
    await db.batch([
      db.prepare("INSERT INTO refunds (id, payment_id, amount_paise, status, reason) VALUES (?, ?, ?, 'failed', ?)").bind(id, pay.id, amount, reason),
      db.prepare("INSERT INTO tickets (id, type, status, booking_id, amount_paise, reason) VALUES (?, 'refund', 'escalated', ?, ?, ?)")
        .bind(newId("tkt"), pay.booking_id, amount, `Automatic refund failed: ${String((e as Error).message ?? e)}`),
    ]);
    return { ok: false as const, status: "failed" as const };
  }
}

// ---------- lookups ----------

export async function bookingByRef(db: D1Database, ref: string) {
  return db.prepare("SELECT * FROM bookings WHERE ref = ?").bind(String(ref).toUpperCase()).first<BookingRow>();
}
export async function authorisedBooking(db: D1Database, ref: string, token: string) {
  const b = await bookingByRef(db, ref);
  if (!b || !token || (await sha256Hex(token)) !== b.manage_token_hash) throw new HttpError(404, "Booking not found");
  return b;
}
export async function bookingView(db: D1Database, b: BookingRow) {
  const [prov, staff, client, pays] = await db.batch([
    db.prepare("SELECT id, slug, name, area, city, address, art, type FROM providers WHERE id = ?").bind(b.provider_id),
    db.prepare("SELECT name, role FROM staff WHERE id = ?").bind(b.staff_id),
    db.prepare("SELECT name, phone, email FROM clients WHERE id = ?").bind(b.client_id),
    db.prepare("SELECT * FROM payments WHERE booking_id = ? ORDER BY created_at DESC").bind(b.id),
  ]);
  const payments = pays.results as PaymentRow[];
  return {
    booking: b,
    provider: prov.results[0] as { id: string; slug: string; name: string; area: string; city: string; address: string; art: number; type: string },
    staff: staff.results[0] as { name: string; role: string },
    client: client.results[0] as { name: string; phone: string; email: string },
    payment: payments.find((p) => p.status !== "created") ?? payments[0] ?? null,
  };
}

// ---------- cancellation ----------

export function cancellationTerms(b: BookingRow, now: Date = new Date()) {
  const hours = hoursUntil(b.date, b.start_min, now);
  return { hours, started: hours <= 0, free: hours >= POLICY.freeCancelHours };
}

/**
 * Client cancellation. At least 24 hours before: the deposit is refunded in full.
 * Inside 24 hours: the deposit is kept, unless the client asks for a review, which opens a ticket for operations.
 */
export async function cancelByClient(env: Env, b: BookingRow, opts: { requestReview?: boolean; reason?: string }, now: Date = new Date()) {
  const db = env.DB;
  if (b.status === "held") { await releaseSlots(db, b.id, "cancelled", "client", "cancelled before payment"); return { refund: "none" as const }; }
  if (b.status !== "confirmed") throw new HttpError(409, "This booking can no longer be cancelled");
  const terms = cancellationTerms(b, now);
  if (terms.started) throw new HttpError(409, "This appointment has already started");
  const reason = String(opts.reason ?? "").trim().slice(0, 300);
  await releaseSlots(db, b.id, "cancelled", "client", reason || (terms.free ? "cancelled by client" : "late cancellation by client"));

  const pay = await db.prepare("SELECT * FROM payments WHERE booking_id = ? AND status = 'captured'").bind(b.id).first<PaymentRow>();
  if (!pay) return { refund: "none" as const };
  if (terms.free) {
    const r = await refundPayment(env, pay, pay.amount_paise, "cancelled 24 hours or more before");
    return { refund: r.ok ? ("refunded" as const) : ("failed" as const) };
  }
  if (opts.requestReview) {
    await db.prepare("INSERT INTO tickets (id, type, status, booking_id, provider_id, amount_paise, reason) VALUES (?, 'refund', 'open', ?, ?, ?, ?)")
      .bind(newId("tkt"), b.id, b.provider_id, pay.amount_paise, `Late cancellation (${Math.max(0, Math.round(terms.hours))}h before): ${reason || "no reason given"}`).run();
    return { refund: "review" as const };
  }
  return { refund: "retained" as const };
}

// ---------- scheduled ----------

/** Releases holds whose payment never arrived. */
export async function expireHolds(env: Env, now: Date = new Date()) {
  const due = (await env.DB.prepare("SELECT id FROM bookings WHERE status = 'held' AND hold_expires_at < ?").bind(now.toISOString()).all<{ id: string }>()).results;
  for (const b of due) await releaseSlots(env.DB, b.id, "expired", "system", "deposit not paid in time");
  return due.length;
}

export const BOOKABLE_UNTIL = (now = nowIst()) => addDays(now.date, POLICY.windowDays);
