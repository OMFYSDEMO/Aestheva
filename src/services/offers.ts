// Quiet-hour offers: a business takes an amount off chosen non-medical services, for appointments that start in hours it
// is usually quiet. The business pays for the discount, and commission is charged on what the client actually pays.
import { HttpError, audit, newId, nowIso } from "../db";
import { addDays, dowOf, DOW, fmtDate, fmtTime } from "../domain/time";
import { inr } from "../domain/money";
import { isMedical, type ServiceRow } from "./catalog";

export interface OfferRow {
  id: string; provider_id: string; amount_type: "fixed" | "percent"; amount: number; services_json: string; days: string;
  start_min: number; end_min: number; starts_on: string; ends_on: string; monthly_cap: number;
  status: "on" | "paused" | "ended"; paused_by: string | null; created_at: string; updated_at: string;
}

export const OFFER_RULES = {
  maxShare: 0.5,                 // never more than half the price off
  fixedMinPaise: 5000, fixedMaxPaise: 500000,
  percentMin: 5, percentMax: 50,
  maxDays: 180,                  // every offer ends within six months
  maxCap: 500,
  maxLive: 5,                    // offers on at once, per business
} as const;

/** Statuses that hold an offer place: a held booking counts, so two tabs can't both take the last place. */
const TAKEN = "('held','confirmed','completed','no_show')";

export const offerServices = (o: OfferRow): string[] => { try { return JSON.parse(o.services_json) as string[]; } catch { return []; } };
export const offerDays = (o: OfferRow) => o.days.split(",").filter(Boolean).map(Number);

/** The discount on a price in paise: whole rupees, never more than half the price. */
export function discountFor(o: Pick<OfferRow, "amount_type" | "amount">, pricePaise: number) {
  const raw = o.amount_type === "percent" ? Math.round((pricePaise * o.amount) / 10000) * 100 : o.amount;
  const cap = Math.floor((pricePaise * OFFER_RULES.maxShare) / 100) * 100;
  return Math.max(0, Math.min(raw, cap));
}

/** Whether an offer covers a service at a start time on a date (ignoring its monthly limit). Medical services never qualify. */
export function offerCovers(o: OfferRow, s: Pick<ServiceRow, "id" | "kind">, date: string, startMin: number) {
  return o.status === "on" && !isMedical(s) && date >= o.starts_on && date <= o.ends_on && offerDays(o).includes(dowOf(date))
    && startMin >= o.start_min && startMin < o.end_min && offerServices(o).includes(s.id);
}

/** "₹200 off" or "20% off" */
export const offerAmount = (o: Pick<OfferRow, "amount_type" | "amount">) => o.amount_type === "percent" ? `${o.amount}% off` : `${inr(o.amount)} off`;

/** "Tue–Thu" for a run of days, otherwise "Mon, Wed, Fri"; "Every day" for all seven. */
export function daysLabel(days: number[]) {
  const d = [...new Set(days)].sort((a, b) => a - b);
  if (d.length === 7) return "Every day";
  const run = d.length >= 3 && d.every((x, i) => i === 0 || x === d[i - 1] + 1);
  return run ? `${DOW[d[0]]}–${DOW[d[d.length - 1]]}` : d.map((x) => DOW[x]).join(", ");
}
/** "Tue–Thu, 11:00 am – 3:00 pm" */
export const whenLabel = (o: OfferRow) => `${daysLabel(offerDays(o))}, ${fmtTime(o.start_min)} – ${fmtTime(o.end_min)}`;

/** How an offer stands today, in words a business understands. */
export function offerState(o: OfferRow, today: string, usedThisMonth: number): { key: "on" | "scheduled" | "full" | "paused" | "ops" | "finished" | "ended"; label: string } {
  if (o.status === "ended") return { key: "ended", label: "Ended" };
  if (o.status === "paused") return o.paused_by === "ops" ? { key: "ops", label: "Paused by Aestheva" } : { key: "paused", label: "Paused" };
  if (o.ends_on < today) return { key: "finished", label: "Finished" };
  if (o.starts_on > today) return { key: "scheduled", label: `Starts ${fmtDate(o.starts_on)}` };
  if (usedThisMonth >= o.monthly_cap) return { key: "full", label: "Limit reached this month" };
  return { key: "on", label: "On" };
}

// ---------- reading ----------

export async function providerOffers(db: D1Database, providerId: string) {
  return (await db.prepare("SELECT * FROM offers WHERE provider_id = ? ORDER BY CASE status WHEN 'on' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END, created_at DESC").bind(providerId).all<OfferRow>()).results;
}

/** Offers that can apply from today on, for some providers (or all). */
export async function liveOffers(db: D1Database, today: string, providerIds?: string[]) {
  if (providerIds?.length === 1) return (await db.prepare("SELECT * FROM offers WHERE provider_id = ? AND status = 'on' AND ends_on >= ?").bind(providerIds[0], today).all<OfferRow>()).results;
  const all = (await db.prepare("SELECT * FROM offers WHERE status = 'on' AND ends_on >= ?").bind(today).all<OfferRow>()).results;
  return providerIds ? all.filter((o) => providerIds.includes(o.provider_id)) : all;
}

/** Places taken per offer and month: "offerId|2026-11" → count. */
export async function placesTaken(db: D1Database, offerIds: string[]) {
  const out = new Map<string, number>();
  if (!offerIds.length) return out;
  const rows = (await db.prepare(`SELECT offer_id, substr(date, 1, 7) AS m, COUNT(*) AS n FROM bookings WHERE status IN ${TAKEN} AND offer_id IN (${offerIds.map(() => "?").join(",")}) GROUP BY offer_id, m`)
    .bind(...offerIds).all<{ offer_id: string; m: string; n: number }>()).results;
  for (const r of rows) out.set(`${r.offer_id}|${r.m}`, r.n);
  return out;
}

/** The best offer for a service at a time, with places left that month: the biggest discount wins. */
export function bestOffer(offers: OfferRow[], taken: Map<string, number>, s: Pick<ServiceRow, "id" | "kind" | "price_paise">, date: string, startMin: number) {
  let best: { offer: OfferRow; off: number } | null = null;
  for (const o of offers) {
    if (!offerCovers(o, s, date, startMin)) continue;
    if ((taken.get(`${o.id}|${date.slice(0, 7)}`) ?? 0) >= o.monthly_cap) continue;
    const off = discountFor(o, s.price_paise);
    if (off > 0 && (!best || off > best.off)) best = { offer: o, off };
  }
  return best;
}

/**
 * The offer for a new online booking, checked again at the moment of booking: still on, places left this month,
 * and not already used by this client (one booking per mobile number per offer; a cancelled booking gives it back).
 */
export async function offerForBooking(db: D1Database, s: ServiceRow, date: string, startMin: number, clientId: string, today: string) {
  const offers = (await liveOffers(db, today, [s.provider_id])).filter((o) => offerCovers(o, s, date, startMin));
  if (!offers.length) return { offer: null, reason: "none" as const };
  const used = new Set((await db.prepare(`SELECT DISTINCT offer_id FROM bookings WHERE client_id = ? AND status IN ${TAKEN} AND offer_id IN (${offers.map(() => "?").join(",")})`)
    .bind(clientId, ...offers.map((o) => o.id)).all<{ offer_id: string }>()).results.map((r) => r.offer_id));
  const unused = offers.filter((o) => !used.has(o.id));
  if (!unused.length) return { offer: null, reason: "used" as const };
  const best = bestOffer(unused, await placesTaken(db, unused.map((o) => o.id)), s, date, startMin);
  return best ? { offer: best, reason: "ok" as const } : { offer: null, reason: "full" as const };
}

// ---------- the business's Offers page ----------

export interface OfferInput {
  amount_type: "fixed" | "percent"; amount: number; services: string[]; days: number[];
  start_min: number; end_min: number; starts_on: string; ends_on: string; monthly_cap: number;
}
export class OfferFormError extends Error { constructor(public errors: Record<string, string>) { super("Please check the form"); } }

const one = (v: unknown) => String(Array.isArray(v) ? v[0] ?? "" : v ?? "").trim();
const many = (v: unknown) => (Array.isArray(v) ? v : v === undefined || v === null || v === "" ? [] : [v]).map((x) => String(x));
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z")) && new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;

/** Checks the Offers form. `services` are the business's own active services. */
export function validateOffer(f: Record<string, unknown>, services: Pick<ServiceRow, "id" | "kind">[], today: string, existing?: OfferRow): OfferInput {
  const e: Record<string, string> = {};
  const amount_type = one(f.amount_type) === "percent" ? "percent" : "fixed";
  const n = Number(one(f.amount));
  let amount = 0;
  if (amount_type === "percent") {
    if (!Number.isInteger(n) || n < OFFER_RULES.percentMin || n > OFFER_RULES.percentMax) e.amount = `Enter a whole percentage from ${OFFER_RULES.percentMin} to ${OFFER_RULES.percentMax}.`;
    else amount = n;
  } else if (!Number.isInteger(n) || n * 100 < OFFER_RULES.fixedMinPaise || n * 100 > OFFER_RULES.fixedMaxPaise) {
    e.amount = `Enter an amount in whole rupees, from ${inr(OFFER_RULES.fixedMinPaise)} to ${inr(OFFER_RULES.fixedMaxPaise)}.`;
  } else amount = n * 100;

  const own = new Map(services.map((s) => [s.id, s]));
  const chosen = [...new Set(many(f.services))];
  if (!chosen.length) e.services = "Choose at least one service.";
  else if (chosen.some((id) => !own.has(id))) e.services = "One of those services is no longer on your listing.";
  else if (chosen.some((id) => isMedical(own.get(id)!))) e.services = "Medical consultations and treatments can't have offers.";

  const days = [...new Set(many(f.days).map(Number))].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort();
  if (!days.length) e.days = "Choose at least one day.";

  const start_min = Number(one(f.start)), end_min = Number(one(f.end));
  const onGrid = (m: number) => Number.isInteger(m) && m >= 0 && m <= 1440 && m % 30 === 0;
  if (!onGrid(start_min) || !onGrid(end_min) || end_min <= start_min) e.hours = "The quiet hours must end after they start.";

  const starts_on = one(f.starts_on), ends_on = one(f.ends_on);
  if (!isDate(starts_on)) e.starts_on = "Choose a start date.";
  else if (starts_on < today && starts_on !== existing?.starts_on) e.starts_on = "The start date can't be in the past.";
  if (!isDate(ends_on)) e.ends_on = "Choose an end date.";
  else if (isDate(starts_on) && ends_on < starts_on) e.ends_on = "The end date must be on or after the start date.";
  else if (ends_on < today) e.ends_on = "The end date can't be in the past.";
  else if (ends_on > addDays(today, OFFER_RULES.maxDays)) e.ends_on = `Offers can run for up to ${OFFER_RULES.maxDays / 30} months. Choose an earlier end date; you can make a new offer after.`;

  const cap = Number(one(f.monthly_cap));
  if (!Number.isInteger(cap) || cap < 1 || cap > OFFER_RULES.maxCap) e.monthly_cap = `Enter a number from 1 to ${OFFER_RULES.maxCap}.`;

  if (Object.keys(e).length) throw new OfferFormError(e);
  return { amount_type, amount, services: chosen, days, start_min, end_min, starts_on, ends_on, monthly_cap: cap };
}

export async function saveOffer(db: D1Database, providerId: string, id: string | null, v: OfferInput, actor: string) {
  const ts = nowIso();
  if (!id) {
    const live = await db.prepare("SELECT COUNT(*) AS n FROM offers WHERE provider_id = ? AND status <> 'ended'").bind(providerId).first<{ n: number }>();
    if ((live?.n ?? 0) >= OFFER_RULES.maxLive) throw new OfferFormError({ form: `You can have up to ${OFFER_RULES.maxLive} offers at once. End one you no longer need first.` });
    id = newId("off");
    await db.batch([
      db.prepare(`INSERT INTO offers (id, provider_id, amount_type, amount, services_json, days, start_min, end_min, starts_on, ends_on, monthly_cap, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, providerId, v.amount_type, v.amount, JSON.stringify(v.services), v.days.join(","), v.start_min, v.end_min, v.starts_on, v.ends_on, v.monthly_cap, ts, ts),
      audit(db, actor, "offer.created", "offer", id, v),
    ]);
    return id;
  }
  const o = await offerOf(db, providerId, id);
  if (o.status === "ended") throw new HttpError(409, "This offer has ended. Make a new one instead.");
  await db.batch([
    db.prepare(`UPDATE offers SET amount_type = ?, amount = ?, services_json = ?, days = ?, start_min = ?, end_min = ?, starts_on = ?, ends_on = ?, monthly_cap = ?, updated_at = ?
      WHERE id = ? AND provider_id = ?`).bind(v.amount_type, v.amount, JSON.stringify(v.services), v.days.join(","), v.start_min, v.end_min, v.starts_on, v.ends_on, v.monthly_cap, ts, id, providerId),
    audit(db, actor, "offer.updated", "offer", id, v),
  ]);
  return id;
}

export async function offerOf(db: D1Database, providerId: string, id: string) {
  const o = await db.prepare("SELECT * FROM offers WHERE id = ? AND provider_id = ?").bind(id, providerId).first<OfferRow>();
  if (!o) throw new HttpError(404, "We couldn't find that offer.");
  return o;
}

/** Pause, resume or end, by the business. An offer the Aestheva team paused stays paused until the team lifts it. */
export async function setOfferStatus(db: D1Database, providerId: string, id: string, action: "pause" | "resume" | "end", actor: string) {
  const o = await offerOf(db, providerId, id);
  if (o.status === "ended") throw new HttpError(409, "This offer has already ended.");
  if (action === "resume" && o.paused_by === "ops") throw new HttpError(409, "The Aestheva team paused this offer. Email us to talk it through.");
  const [status, by] = action === "pause" ? ["paused", "provider"] : action === "resume" ? ["on", null] : ["ended", o.paused_by];
  if (action === "resume") {
    const live = await db.prepare("SELECT COUNT(*) AS n FROM offers WHERE provider_id = ? AND status = 'on'").bind(providerId).first<{ n: number }>();
    if ((live?.n ?? 0) >= OFFER_RULES.maxLive) throw new HttpError(409, `You can have up to ${OFFER_RULES.maxLive} offers on at once. Pause or end another first.`);
  }
  await db.batch([
    db.prepare("UPDATE offers SET status = ?, paused_by = ?, updated_at = ? WHERE id = ?").bind(status, by, nowIso(), id),
    audit(db, actor, `offer.${action}`, "offer", id),
  ]);
}

/** The Aestheva team pauses (or lifts its pause on) any business's offer, for example when its wording or terms need a look. */
export async function opsSetOffer(db: D1Database, id: string, action: "pause" | "resume") {
  const o = await db.prepare("SELECT * FROM offers WHERE id = ?").bind(id).first<OfferRow>();
  if (!o || o.status === "ended") throw new HttpError(404, "Offer not found");
  await db.batch([
    db.prepare("UPDATE offers SET status = ?, paused_by = ?, updated_at = ? WHERE id = ?").bind(action === "pause" ? "paused" : "on", action === "pause" ? "ops" : null, nowIso(), id),
    audit(db, "ops", `offer.ops_${action}`, "offer", id),
  ]);
}

/** Per-offer figures for the business: bookings and the amount given, this month and in total. */
export async function offerStats(db: D1Database, providerId: string, month: string) {
  const rows = (await db.prepare(`SELECT offer_id, substr(date, 1, 7) = ? AS this_month, COUNT(*) AS n, SUM(offer_paise) AS off,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS done FROM bookings
    WHERE provider_id = ? AND offer_id IS NOT NULL AND status IN ${TAKEN} GROUP BY offer_id, this_month`).bind(month, providerId)
    .all<{ offer_id: string; this_month: number; n: number; off: number; done: number }>()).results;
  const out = new Map<string, { month: number; total: number; given: number; completed: number }>();
  for (const r of rows) {
    const s = out.get(r.offer_id) ?? { month: 0, total: 0, given: 0, completed: 0 };
    if (r.this_month) s.month += r.n;
    s.total += r.n; s.given += r.off; s.completed += r.done;
    out.set(r.offer_id, s);
  }
  return out;
}

/** What a client sees on a venue page and in the booking flow, one entry per offer running now or soon. */
export function publicOffers(offers: OfferRow[], services: Pick<ServiceRow, "id" | "name" | "kind" | "price_paise">[], today: string) {
  return offers.filter((o) => o.status === "on" && o.ends_on >= today).map((o) => {
    const svcs = services.filter((s) => offerServices(o).includes(s.id) && !isMedical(s));
    return { id: o.id, amount: offerAmount(o), when: whenLabel(o), until: o.ends_on, from: o.starts_on > today ? o.starts_on : null, services: svcs.map((s) => ({ id: s.id, name: s.name, off: discountFor(o, s.price_paise) })) };
  }).filter((o) => o.services.length);
}
