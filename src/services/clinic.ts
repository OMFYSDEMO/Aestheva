// The clinic portal's data and actions. Every function takes the signed-in user's provider id and only ever
// touches that provider's rows, so one clinic can never see or change another's.
import { POLICY } from "../config";
import type { Env } from "../env";
import { HttpError, audit, hmacSha256Hex, isUniqueViolation, newId, newRef, newToken, nowIso, safeEqual, sha256Hex } from "../db";
import { addDays, dowOf, hoursUntil, isIsoDate, nowIst } from "../domain/time";
import { slotsFor } from "../domain/availability";
import { refundPayment, normalisePhone, type BookingRow, type PaymentRow } from "./bookings";
import { sendEmail } from "./notify";
import type { ServiceRow, StaffRow } from "./catalog";

// ---------- logins ----------

export interface ClinicUser { id: string; provider_id: string; name: string; email: string; password_hash: string; active: number; last_login_at: string | null; created_at: string }

const PBKDF2_ITERATIONS = 100_000;   // clinics choose their own passwords; this needs the Workers Paid CPU allowance
const hex = (b: ArrayBuffer | Uint8Array) => Array.from(b instanceof Uint8Array ? b : new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
const unhex = (h: string) => new Uint8Array((h.match(/../g) ?? []).map((x) => parseInt(x, 16)));

async function pbkdf2(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
}
export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${hex(salt)}$${await pbkdf2(password, salt, PBKDF2_ITERATIONS)}`;
}
export async function checkPassword(password: string, stored: string) {
  const [alg, it, salt, hash] = stored.split("$");
  if (alg !== "pbkdf2-sha256" || !hash) return false;
  return safeEqual(await pbkdf2(password, unhex(salt), Number(it)), hash);
}
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** A new login can't sign in until its owner sets a password from the invitation link. */
export async function createClinicUser(db: D1Database, providerId: string, name: string, email: string) {
  name = name.trim(); email = email.trim().toLowerCase();
  if (name.length < 2 || name.length > 80) throw new HttpError(400, "Please enter the person's name.");
  if (!EMAIL.test(email)) throw new HttpError(400, "Please enter a valid email address.");
  const p = await db.prepare("SELECT id FROM providers WHERE id = ?").bind(providerId).first();
  if (!p) throw new HttpError(404, "Unknown venue");
  const id = newId("pu"), unusable = `unset$${newToken()}`;
  try {
    await db.batch([
      db.prepare("INSERT INTO provider_users (id, provider_id, name, email, password_hash) VALUES (?, ?, ?, ?, ?)").bind(id, providerId, name, email, unusable),
      audit(db, "ops", "clinic_user.created", "provider_user", id, { providerId, email }),
    ]);
  } catch (e) { if (isUniqueViolation(e, "provider_users")) throw new HttpError(409, "That email already has a login."); throw e; }
  return (await db.prepare("SELECT * FROM provider_users WHERE id = ?").bind(id).first<ClinicUser>())!;
}
export async function setClinicUserActive(db: D1Database, userId: string, active: boolean) {
  await db.batch([
    db.prepare("UPDATE provider_users SET active = ?, updated_at = ? WHERE id = ?").bind(active ? 1 : 0, nowIso(), userId),
    audit(db, "ops", active ? "clinic_user.enabled" : "clinic_user.disabled", "provider_user", userId),
  ]);
}

// ---------- one-time password links ----------

export const LINK_HOURS = { invite: 72, reset: 1 } as const;
export type LinkPurpose = keyof typeof LINK_HOURS;

export async function issuePasswordLink(db: D1Database, userId: string, purpose: LinkPurpose, actor: string) {
  const token = newToken() + newToken();
  await db.batch([
    db.prepare("INSERT INTO password_links (id, user_id, token_hash, purpose, expires_at) VALUES (?, ?, ?, ?, ?)")
      .bind(newId("pl"), userId, await sha256Hex(token), purpose, new Date(Date.now() + LINK_HOURS[purpose] * 36e5).toISOString()),
    audit(db, actor, `clinic_user.${purpose}_link`, "provider_user", userId),
  ]);
  return token;
}

/** The login a link belongs to, if the link is unused, unexpired and the login is active. */
export async function userForLink(db: D1Database, token: string) {
  if (!/^[A-Za-z0-9_-]{40,}$/.test(token)) return null;
  const row = await db.prepare(`SELECT l.id AS link_id, l.purpose, u.* FROM password_links l JOIN provider_users u ON u.id = l.user_id
    WHERE l.token_hash = ? AND l.used_at IS NULL AND l.expires_at > ? AND u.active = 1`).bind(await sha256Hex(token), nowIso()).first<ClinicUser & { link_id: string; purpose: LinkPurpose }>();
  return row ?? null;
}

const COMMON = ["password", "qwerty", "123456", "aestheva", "letmein", "welcome", "hasta"];
export function passwordProblem(pw: string, email: string) {
  if (pw.length < 10) return "Use at least 10 characters. A short phrase is easiest to remember.";
  if (pw.length > 128) return "That's too long. Use at most 128 characters.";
  const low = pw.toLowerCase();
  if (/^(.)\1+$/.test(pw)) return "Use a mix of characters, not one repeated.";
  if (low.includes(email.split("@")[0].toLowerCase()) || COMMON.some((w) => low.includes(w) && low.length < w.length + 6)) return "That's too easy to guess. Try a short phrase only you would think of.";
  return null;
}

/** Sets the password from a link. The link and any other open links for the login stop working; old sessions end. */
export async function setPasswordWithLink(db: D1Database, token: string, password: string, confirm: string) {
  const u = await userForLink(db, token);
  if (!u) throw new HttpError(410, "This link has expired or has already been used.");
  if (password !== confirm) throw new HttpError(400, "The two passwords don't match.");
  const problem = passwordProblem(password, u.email);
  if (problem) throw new HttpError(400, problem);
  const ts = nowIso();
  await db.batch([
    db.prepare("UPDATE provider_users SET password_hash = ?, updated_at = ? WHERE id = ?").bind(await hashPassword(password), ts, u.id),
    db.prepare("UPDATE password_links SET used_at = ? WHERE user_id = ? AND used_at IS NULL").bind(ts, u.id),
    audit(db, `provider_user:${u.id}`, "clinic_user.password_set", "provider_user", u.id, { via: u.purpose }),
  ]);
  return u;
}

const escH = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
/** Emails a set-password link. Returns the email outcome; the caller decides whether to show the link instead. */
export async function emailPasswordLink(env: Env, u: { name: string; email: string }, venue: string, url: string, purpose: LinkPurpose) {
  const invite = purpose === "invite";
  const subject = invite ? `Your Aestheva login for ${venue}` : "Reset your Aestheva password";
  const lead = invite ? `You've been given a login to ${venue}'s portal on Aestheva, where you see your calendar, bookings and clients.` : "Someone asked to reset the password for your Aestheva login. If it wasn't you, ignore this email; your password stays the same.";
  const until = invite ? `${LINK_HOURS.invite / 24} days` : "1 hour";
  const text = `Hello ${u.name},\n\n${lead}\n\n${invite ? "Set your password" : "Choose a new password"} here (the link works once, for ${until}):\n${url}\n\nYour login email is ${u.email}. After that, sign in at ${new URL(url).origin}/clinic.\n\nAestheva`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#302A2E;line-height:1.55;max-width:520px">
    <p style="font-family:Arial,sans-serif;font-size:24px;font-weight:bold;letter-spacing:-0.5px;color:#8A2E5C;margin:0">aestheva <span style="font-size:15px;font-weight:normal;letter-spacing:0;color:#857A80">for business</span></p>
    <h1 style="font-family:Arial,sans-serif;font-weight:bold;font-size:24px;color:#1D1A1C;margin:18px 0 14px">${invite ? `Welcome, ${escH(u.name)}` : "Reset your password"}</h1>
    <p>${escH(lead)}</p>
    <p style="margin:24px 0"><a href="${escH(url)}" style="background:#8A2E5C;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none">${invite ? "Set your password" : "Choose a new password"}</a></p>
    <p style="color:#6B5F65;font-size:13px">The link works once, for ${until}. Your login email is <b>${escH(u.email)}</b>.</p>
    <p style="color:#8A7C83;font-size:12px">If the button doesn't work, copy this link into your browser:<br>${escH(url)}</p></div>`;
  return sendEmail(env, u.email, { subject, text, html });
}

/** "Forgot password": always the same answer, so the page never reveals which emails have logins. */
export async function requestPasswordReset(env: Env, email: string, siteUrl: string) {
  const db = env.DB;
  const u = await db.prepare("SELECT u.*, p.name AS venue FROM provider_users u JOIN providers p ON p.id = u.provider_id WHERE u.email = ? AND u.active = 1")
    .bind(email.trim().toLowerCase()).first<ClinicUser & { venue: string }>();
  if (!u) return;
  const recent = await db.prepare("SELECT COUNT(*) AS n FROM password_links WHERE user_id = ? AND purpose = 'reset' AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 hour')").bind(u.id).first<{ n: number }>();
  if ((recent?.n ?? 0) >= 3) return;
  const token = await issuePasswordLink(db, u.id, "reset", "clinic");
  await emailPasswordLink(env, u, u.venue, `${siteUrl}/clinic/set-password?t=${token}`, "reset");
}

/** Sessions are signed with OPS_KEY and tied to the password hash, so a reset or a disabled login ends them. */
export async function sessionFor(key: string, u: ClinicUser, exp: number) {
  return `${u.id}.${exp}.${await hmacSha256Hex(key, `clinic|${u.id}|${exp}|${u.password_hash.slice(-16)}|${u.active}`)}`;
}
export async function userFromSession(db: D1Database, key: string, cookie: string): Promise<{ user: ClinicUser; exp: number } | null> {
  const [id, expS, sig] = cookie.split(".");
  const exp = Number(expS);
  if (!key || !id || !sig || !(exp > Date.now())) return null;
  const u = await db.prepare("SELECT * FROM provider_users WHERE id = ?").bind(id).first<ClinicUser>();
  if (!u || !u.active) return null;
  return safeEqual(sig, (await sessionFor(key, u, exp)).split(".")[2]) ? { user: u, exp } : null;
}

// ---------- the clinic's day ----------

export interface Appt {
  id: string; ref: string; date: string; start_min: number; dur_min: number; service_name: string; kind: string; status: BookingRow["status"];
  price_paise: number; deposit_paise: number; source: string; staff_id: string; staff_name: string; client_id: string; client_name: string; client_phone: string;
  client_note: string; pay_status: string | null; channel: string; credit_paise: number;
}
const APPT_SQL = `SELECT b.id, b.ref, b.date, b.start_min, b.dur_min, b.service_name, b.kind, b.status, b.price_paise, b.deposit_paise, b.source, b.channel, b.credit_paise,
  b.staff_id, t.name AS staff_name, b.client_id, c.name AS client_name, c.phone AS client_phone, b.client_note,
  (SELECT p.status FROM payments p WHERE p.booking_id = b.id AND p.status <> 'created' ORDER BY p.created_at DESC LIMIT 1) AS pay_status
  FROM bookings b JOIN staff t ON t.id = b.staff_id JOIN clients c ON c.id = b.client_id`;

export async function clinicStaff(db: D1Database, providerId: string) {
  const staff = (await db.prepare("SELECT * FROM staff WHERE provider_id = ? AND active = 1 ORDER BY rowid").bind(providerId).all<StaffRow>()).results;
  const ids = staff.map((s) => s.id);
  const hours = ids.length ? (await db.prepare(`SELECT staff_id, dow, start_min, end_min FROM staff_hours WHERE staff_id IN (${ids.map(() => "?").join(",")})`).bind(...ids)
    .all<{ staff_id: string; dow: number; start_min: number; end_min: number }>()).results : [];
  return { staff, hours };
}

export async function dayView(db: D1Database, providerId: string, date: string) {
  const { staff, hours } = await clinicStaff(db, providerId);
  const [appts, blocks] = await Promise.all([
    db.prepare(`${APPT_SQL} WHERE b.provider_id = ? AND b.date = ? AND b.status IN ('held','confirmed','completed','no_show') ORDER BY b.start_min`).bind(providerId, date).all<Appt>(),
    db.prepare(`SELECT k.* FROM staff_blocks k JOIN staff t ON t.id = k.staff_id WHERE t.provider_id = ? AND k.date = ? ORDER BY k.start_min`).bind(providerId, date)
      .all<{ id: string; staff_id: string; start_min: number; end_min: number; reason: string }>(),
  ]);
  const dow = dowOf(date);
  return { staff, rota: new Map(hours.filter((h) => h.dow === dow).map((h) => [h.staff_id, h])), appts: appts.results, blocks: blocks.results };
}

export async function overview(db: D1Database, providerId: string) {
  const now = nowIst(), today = now.date, week = addDays(today, 6), month = today.slice(0, 7);
  const [todayAppts, upcoming, recent, money] = await Promise.all([
    db.prepare(`${APPT_SQL} WHERE b.provider_id = ? AND b.date = ? AND b.status IN ('held','confirmed','completed','no_show') ORDER BY b.start_min`).bind(providerId, today).all<Appt>(),
    db.prepare(`${APPT_SQL} WHERE b.provider_id = ? AND b.date > ? AND b.date <= ? AND b.status = 'confirmed' ORDER BY b.date, b.start_min LIMIT 12`).bind(providerId, today, week).all<Appt>(),
    db.prepare("SELECT COUNT(*) AS n FROM bookings WHERE provider_id = ? AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-7 days') AND status IN ('confirmed','completed','no_show')").bind(providerId).first<{ n: number }>(),
    db.prepare(`SELECT COALESCE(SUM(p.amount_paise), 0) AS deposits FROM payments p JOIN bookings b ON b.id = p.booking_id
      WHERE b.provider_id = ? AND p.status = 'captured' AND substr(p.captured_at, 1, 7) = ?`).bind(providerId, month).first<{ deposits: number }>(),
  ]);
  const weekCount = await db.prepare("SELECT COUNT(*) AS n FROM bookings WHERE provider_id = ? AND date BETWEEN ? AND ? AND status = 'confirmed'").bind(providerId, today, week).first<{ n: number }>();
  return { now, today: todayAppts.results, upcoming: upcoming.results, newThisWeek: recent?.n ?? 0, weekCount: weekCount?.n ?? 0, depositsThisMonth: money?.deposits ?? 0 };
}

export async function listBookings(db: D1Database, providerId: string, view: string, q: string) {
  const today = nowIst().date;
  const where = view === "past" ? "b.date < ? AND b.status IN ('confirmed','completed','no_show')"
    : view === "cancelled" ? "b.status IN ('cancelled','expired') AND ? = ?"
    : "b.date >= ? AND b.status IN ('held','confirmed')";
  const args: unknown[] = view === "cancelled" ? [today, today] : [today];
  let sql = `${APPT_SQL} WHERE b.provider_id = ? AND ${where}`;
  const term = q.trim();
  if (term) { sql += " AND (c.name LIKE ? OR c.phone LIKE ? OR b.ref LIKE ?)"; const like = `%${term.replace(/[%_]/g, "")}%`; args.push(like, `%${term.replace(/\D/g, "") || "~"}%`, like.toUpperCase()); }
  sql += view === "upcoming" ? " ORDER BY b.date, b.start_min LIMIT 200" : " ORDER BY b.date DESC, b.start_min DESC LIMIT 200";
  return (await db.prepare(sql).bind(providerId, ...args).all<Appt>()).results;
}

export async function clinicBooking(db: D1Database, providerId: string, ref: string) {
  const a = await db.prepare(`${APPT_SQL} WHERE b.provider_id = ? AND b.ref = ?`).bind(providerId, ref.toUpperCase()).first<Appt>();
  if (!a) throw new HttpError(404, "We couldn't find that booking.");
  const [b, pays, client] = await Promise.all([
    db.prepare("SELECT * FROM bookings WHERE id = ?").bind(a.id).first<BookingRow>(),
    db.prepare("SELECT * FROM payments WHERE booking_id = ? ORDER BY created_at DESC").bind(a.id).all<PaymentRow>(),
    db.prepare("SELECT name, phone, email FROM clients WHERE id = ?").bind(a.client_id).first<{ name: string; phone: string; email: string }>(),
  ]);
  const refunds = (await db.prepare("SELECT r.* FROM refunds r JOIN payments p ON p.id = r.payment_id WHERE p.booking_id = ? ORDER BY r.created_at").bind(a.id).all<{ amount_paise: number; status: string; reason: string; created_at: string }>()).results;
  return { a, b: b!, payment: pays.results.find((p) => p.status !== "created") ?? null, refunds, client: client! };
}

// ---------- booking actions ----------

const started = (b: { date: string; start_min: number }) => hoursUntil(b.date, b.start_min) <= 0;

/** Completed or no-show, once the appointment time has come. A no-show keeps the deposit, as the policy says. */
export async function markOutcome(db: D1Database, providerId: string, ref: string, outcome: "completed" | "no_show", actor: string) {
  const { b } = await clinicBooking(db, providerId, ref);
  if (b.status !== "confirmed") throw new HttpError(409, "Only a confirmed booking can be marked.");
  if (!started(b)) throw new HttpError(409, "You can mark this once the appointment time has come.");
  await db.batch([
    db.prepare("UPDATE bookings SET status = ?, updated_at = ? WHERE id = ? AND status = 'confirmed'").bind(outcome, nowIso(), b.id),
    audit(db, actor, `booking.${outcome}`, "booking", b.id),
  ]);
}

/** The clinic cancels: the slot is freed and any deposit is refunded in full, whatever the timing. */
export async function cancelByClinic(env: Env, providerId: string, ref: string, reason: string, actor: string) {
  const db = env.DB;
  const { b } = await clinicBooking(db, providerId, ref);
  if (b.status !== "confirmed" && b.status !== "held") throw new HttpError(409, "This booking can no longer be cancelled.");
  reason = reason.trim().slice(0, 300);
  if (reason.length < 3) throw new HttpError(400, "Please give a short reason. It is kept with the booking.");
  const ts = nowIso();
  await db.batch([
    db.prepare("DELETE FROM staff_slots WHERE booking_id = ?").bind(b.id),
    db.prepare("DELETE FROM resource_slots WHERE booking_id = ?").bind(b.id),
    db.prepare("UPDATE bookings SET status = 'cancelled', hold_expires_at = NULL, cancelled_at = ?, cancelled_by = 'provider', cancel_reason = ?, updated_at = ? WHERE id = ?").bind(ts, reason, ts, b.id),
    audit(db, actor, "booking.cancelled", "booking", b.id, { by: "provider", reason }),
  ]);
  const pay = await db.prepare("SELECT * FROM payments WHERE booking_id = ? AND status = 'captured'").bind(b.id).first<PaymentRow>();
  if (!pay) return { refund: "none" as const };
  const r = await refundPayment(env, pay, pay.amount_paise, "cancelled by the venue");
  return { refund: r.ok ? ("refunded" as const) : ("failed" as const), amount: pay.amount_paise };
}

// ---------- bookings made by the clinic (phone, walk-in) ----------

export const CLINIC_DAY = { from: 6 * 60, to: 23 * 60 };   // the clinic may book outside online hours, within these bounds

export interface DirectBookingInput { serviceId: string; staffId: string; date: string; start: number; name: string; phone: string; email?: string; note?: string }

/**
 * A booking the clinic takes itself. It can be outside online hours (morning sessions, Sundays), takes no deposit
 * and no commission, and still occupies the practitioner's slots so online clients can't take the same time.
 */
export async function createDirectBooking(db: D1Database, providerId: string, input: DirectBookingInput, actor: string) {
  const service = await db.prepare("SELECT * FROM services WHERE id = ? AND provider_id = ? AND active = 1").bind(input.serviceId, providerId).first<ServiceRow>();
  if (!service) throw new HttpError(400, "Please choose a treatment.");
  const staff = await db.prepare("SELECT t.id, t.name FROM staff t JOIN service_staff ss ON ss.staff_id = t.id WHERE t.id = ? AND t.provider_id = ? AND t.active = 1 AND ss.service_id = ?")
    .bind(input.staffId, providerId, service.id).first<{ id: string; name: string }>();
  if (!staff) throw new HttpError(400, "That practitioner doesn't offer this treatment.");
  if (!isIsoDate(input.date) || input.date < nowIst().date || input.date > addDays(nowIst().date, 365)) throw new HttpError(400, "Please choose a date from today onwards.");
  const start = Number(input.start);
  if (!Number.isInteger(start) || start % 30 !== 0 || start < CLINIC_DAY.from || start + service.dur_min > CLINIC_DAY.to) throw new HttpError(400, "Please choose a time between 6 am and 11 pm.");
  const name = String(input.name ?? "").trim(), phone = normalisePhone(String(input.phone ?? ""));
  const email = String(input.email ?? "").trim().toLowerCase(), note = String(input.note ?? "").trim().slice(0, 240);
  if (name.length < 2 || name.length > 80) throw new HttpError(400, "Please enter the client's name.");
  if (!phone) throw new HttpError(400, "Please enter the client's 10-digit mobile number.");
  if (email && !EMAIL.test(email)) throw new HttpError(400, "That email address doesn't look right. Leave it blank if you don't have it.");

  const slots = slotsFor(start, service.dur_min);
  const blocked = await db.prepare("SELECT reason, start_min, end_min FROM staff_blocks WHERE staff_id = ? AND date = ? AND start_min < ? AND end_min > ?")
    .bind(staff.id, input.date, start + service.dur_min, start).first<{ reason: string }>();
  if (blocked) throw new HttpError(409, `${staff.name} is marked unavailable then${blocked.reason ? ` (${blocked.reason})` : ""}. Remove that block first, or choose another time.`);
  const resources = (await db.prepare("SELECT sr.resource_id FROM service_resources sr JOIN resources r ON r.id = sr.resource_id WHERE r.active = 1 AND sr.service_id = ?")
    .bind(service.id).all<{ resource_id: string }>()).results.map((r) => r.resource_id);

  let client = await db.prepare("SELECT id, email FROM clients WHERE phone = ?").bind(phone).first<{ id: string; email: string }>();
  if (!client) {
    client = { id: newId("cli"), email };
    try { await db.prepare("INSERT INTO clients (id, name, phone, email) VALUES (?, ?, ?, ?)").bind(client.id, name, phone, email).run(); }
    catch (e) { if (!isUniqueViolation(e, "clients")) throw e; client = (await db.prepare("SELECT id, email FROM clients WHERE phone = ?").bind(phone).first<{ id: string; email: string }>())!; }
  }
  await db.prepare("UPDATE clients SET name = ?, email = ? WHERE id = ?").bind(name, email || client.email, client.id).run();

  const token = newToken(), tokenHash = await sha256Hex(token);
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = newId("bkg"), ref = newRef(), ts = nowIso();
    try {
      await db.batch([
        db.prepare(`INSERT INTO bookings (id, ref, provider_id, service_id, staff_id, client_id, date, start_min, dur_min, service_name, kind,
            price_paise, deposit_paise, commission_bp, source, status, manage_token_hash, client_note, confirmed_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'direct', 'confirmed', ?, ?, ?, ?, ?)`)
          .bind(id, ref, providerId, service.id, staff.id, client.id, input.date, start, service.dur_min, service.name, service.kind, service.price_paise, tokenHash, note, ts, ts, ts),
        ...slots.map((slot) => db.prepare("INSERT INTO staff_slots (staff_id, date, slot, booking_id) VALUES (?, ?, ?, ?)").bind(staff.id, input.date, slot, id)),
        ...resources.flatMap((r) => slots.map((slot) => db.prepare("INSERT INTO resource_slots (resource_id, date, slot, booking_id) VALUES (?, ?, ?, ?)").bind(r, input.date, slot, id))),
        audit(db, actor, "booking.created_by_clinic", "booking", id, { ref, staffId: staff.id, date: input.date, start }),
      ]);
      return { ref, token };
    } catch (e) {
      if (isUniqueViolation(e, "bookings.ref")) continue;
      if (isUniqueViolation(e, "staff_slots")) throw new HttpError(409, `${staff.name} already has a booking at that time. Check the calendar and choose another time.`);
      if (isUniqueViolation(e, "resource_slots")) throw new HttpError(409, "The equipment this treatment needs is booked at that time. Choose another time.");
      throw e;
    }
  }
  throw new HttpError(409, "Please try again.");
}

// ---------- unavailable time ----------

export async function addBlock(db: D1Database, providerId: string, staffId: string, date: string, start: number, end: number, reason: string, actor: string) {
  const staff = await db.prepare("SELECT id, name FROM staff WHERE id = ? AND provider_id = ? AND active = 1").bind(staffId, providerId).first<{ id: string; name: string }>();
  if (!staff) throw new HttpError(400, "Please choose a practitioner.");
  if (!isIsoDate(date) || date < nowIst().date) throw new HttpError(400, "Please choose a date from today onwards.");
  if (!(Number.isInteger(start) && Number.isInteger(end) && start % 30 === 0 && end % 30 === 0 && start >= 0 && end <= 1440 && end > start)) throw new HttpError(400, "Please choose a start and an end time.");
  const clash = await db.prepare(`SELECT b.ref, b.start_min FROM bookings b WHERE b.staff_id = ? AND b.date = ? AND b.status IN ('held','confirmed') AND b.start_min < ? AND b.start_min + b.dur_min > ? LIMIT 1`)
    .bind(staff.id, date, end, start).first<{ ref: string }>();
  if (clash) throw new HttpError(409, `${staff.name} has a booking (${clash.ref}) in that time. Cancel or move it first.`);
  const id = newId("blk");
  await db.batch([
    db.prepare("INSERT INTO staff_blocks (id, staff_id, date, start_min, end_min, reason, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, staff.id, date, start, end, reason.trim().slice(0, 80), actor),
    audit(db, actor, "staff.blocked", "staff", staff.id, { date, start, end, reason }),
  ]);
}
export async function removeBlock(db: D1Database, providerId: string, blockId: string, actor: string) {
  const k = await db.prepare("SELECT k.id, k.staff_id FROM staff_blocks k JOIN staff t ON t.id = k.staff_id WHERE k.id = ? AND t.provider_id = ?").bind(blockId, providerId).first<{ id: string; staff_id: string }>();
  if (!k) throw new HttpError(404, "That block no longer exists.");
  await db.batch([db.prepare("DELETE FROM staff_blocks WHERE id = ?").bind(k.id), audit(db, actor, "staff.unblocked", "staff", k.staff_id, { block: k.id })]);
}

// ---------- clients and money ----------

export async function clinicClients(db: D1Database, providerId: string, q: string) {
  const today = nowIst().date, term = q.trim();
  const like = `%${term.replace(/[%_]/g, "")}%`, digits = `%${term.replace(/\D/g, "") || "~"}%`;
  return (await db.prepare(`SELECT c.id, c.name, c.phone, c.email,
      SUM(CASE WHEN b.status = 'completed' THEN 1 ELSE 0 END) AS visits,
      MAX(CASE WHEN b.status = 'completed' THEN b.date END) AS last_visit,
      MIN(CASE WHEN b.status = 'confirmed' AND b.date >= ? THEN b.date END) AS next_visit,
      COUNT(*) AS bookings
    FROM bookings b JOIN clients c ON c.id = b.client_id
    WHERE b.provider_id = ? AND b.status <> 'expired' ${term ? "AND (c.name LIKE ? OR c.phone LIKE ?)" : ""}
    GROUP BY c.id ORDER BY COALESCE(next_visit, last_visit, '') DESC, c.name LIMIT 300`).bind(today, providerId, ...(term ? [like, digits] : []))
    .all<{ id: string; name: string; phone: string; email: string; visits: number; last_visit: string | null; next_visit: string | null; bookings: number }>()).results;
}
export async function clinicClient(db: D1Database, providerId: string, clientId: string) {
  const c = await db.prepare("SELECT id, name, phone, email FROM clients WHERE id = ?").bind(clientId).first<{ id: string; name: string; phone: string; email: string }>();
  const bookings = (await db.prepare(`${APPT_SQL} WHERE b.provider_id = ? AND b.client_id = ? AND b.status <> 'expired' ORDER BY b.date DESC, b.start_min DESC`).bind(providerId, clientId).all<Appt>()).results;
  if (!c || !bookings.length) throw new HttpError(404, "We couldn't find that client.");
  return { c, bookings };
}

export async function monthMoney(db: D1Database, providerId: string, month: string) {
  const rows = (await db.prepare(`SELECT b.ref, b.date, b.start_min, b.service_name, b.status, b.source, b.price_paise, b.commission_bp, b.channel, b.credit_paise, c.name AS client_name,
      (SELECT COALESCE(SUM(p.amount_paise), 0) FROM payments p WHERE p.booking_id = b.id AND p.status IN ('captured','refunded','partially_refunded')) AS paid,
      (SELECT COALESCE(SUM(r.amount_paise), 0) FROM refunds r JOIN payments p ON p.id = r.payment_id WHERE p.booking_id = b.id AND r.status <> 'failed') AS refunded
    FROM bookings b JOIN clients c ON c.id = b.client_id
    WHERE b.provider_id = ? AND substr(b.date, 1, 7) = ? AND b.status IN ('confirmed','completed','no_show','cancelled')
    ORDER BY b.date, b.start_min`).bind(providerId, month)
    .all<{ ref: string; date: string; start_min: number; service_name: string; status: string; source: string; price_paise: number; commission_bp: number; channel: string; credit_paise: number; client_name: string; paid: number; refunded: number }>()).results;
  const completed = rows.filter((r) => r.status === "completed");
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  return {
    rows,
    completedCount: completed.length,
    completedValue: sum(completed.map((r) => r.price_paise)),
    depositsPaid: sum(rows.map((r) => r.paid)),
    refunded: sum(rows.map((r) => r.refunded)),
    keptOnCancellation: sum(rows.filter((r) => r.status === "cancelled" || r.status === "no_show").map((r) => r.paid - r.refunded)),
    // A welcome credit is part of the deposit: Aestheva pays it to the business, so the client owes that much less on the day.
    balanceAtClinic: sum(completed.map((r) => r.price_paise - (r.paid - r.refunded) - (r.paid ? r.credit_paise : 0))),
    welcomeCredits: sum(completed.filter((r) => r.paid).map((r) => r.credit_paise)),
    ownLinkBookings: completed.filter((r) => r.channel === "own_link").length,
    commission: sum(completed.filter((r) => r.source === "marketplace").map((r) => Math.round((r.price_paise * r.commission_bp) / 10000))),
  };
}

