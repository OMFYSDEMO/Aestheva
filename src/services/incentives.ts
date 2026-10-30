// Phase 1 incentives: founding-partner commission, the business's own booking link, and the client welcome offer.
import { INCENTIVES, POLICY } from "../config";
import { addDays } from "../domain/time";

/** The date `months` calendar months after an ISO date (the 31st rolls into the next month, like most calendars). */
export function addMonths(date: string, months: number) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export interface FoundingTerms { no: number; freeUntil: string; foundingUntil: string; phase: "free" | "founding" | "standard"; rateBp: number }

/** A founding partner's commission timeline, or null for a business that isn't one (or isn't live yet). */
export function foundingTerms(p: { founding_no?: number | null; live_since?: string | null }, today: string): FoundingTerms | null {
  if (!p.founding_no || !p.live_since) return null;
  const freeUntil = addMonths(p.live_since, INCENTIVES.foundingFreeMonths), foundingUntil = addMonths(p.live_since, INCENTIVES.foundingMonths);
  const phase = today < freeUntil ? "free" : today < foundingUntil ? "founding" : "standard";
  return { no: p.founding_no, freeUntil, foundingUntil, phase, rateBp: phase === "free" ? 0 : phase === "founding" ? INCENTIVES.foundingRateBp : POLICY.commissionBp };
}

/** Commission on a new online booking, in basis points of the full price. */
export function commissionBp(p: { founding_no?: number | null; live_since?: string | null }, channel: string, today: string) {
  if (channel === "own_link") return 0;
  return foundingTerms(p, today)?.rateBp ?? POLICY.commissionBp;
}

/** The welcome offer amount: the WELCOME_CREDIT_PAISE variable when set ("0" pauses it), otherwise INCENTIVES. */
export function welcomeAmount(env: { WELCOME_CREDIT_PAISE?: string }) {
  const v = env.WELCOME_CREDIT_PAISE?.trim();
  const n = v ? Number(v) : INCENTIVES.welcomeCreditPaise;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/** The welcome offer for a new booking: a client's first booking that takes a deposit. Held bookings count, so two tabs can't both claim it. */
export async function welcomeCredit(env: { DB: D1Database; WELCOME_CREDIT_PAISE?: string }, clientId: string, depositPaise: number) {
  const db = env.DB, amount = welcomeAmount(env);
  if (depositPaise <= 0 || amount <= 0) return 0;
  const before = await db.prepare(
    "SELECT 1 FROM bookings WHERE client_id = ? AND (status IN ('confirmed','completed','no_show') OR (status = 'held' AND credit_paise > 0)) LIMIT 1",
  ).bind(clientId).first();
  return before ? 0 : Math.min(amount, depositPaise);
}

/** Gives a business the next founding-partner number when it goes live, while places remain. Returns the number, if any. */
export async function assignFoundingNo(db: D1Database, providerId: string) {
  const p = await db.prepare("SELECT founding_no FROM providers WHERE id = ?").bind(providerId).first<{ founding_no: number | null }>();
  if (!p || p.founding_no) return p?.founding_no ?? null;
  await db.prepare(`UPDATE providers SET founding_no = (SELECT COALESCE(MAX(founding_no), 0) + 1 FROM providers)
    WHERE id = ? AND founding_no IS NULL AND (SELECT COUNT(*) FROM providers WHERE founding_no IS NOT NULL) < ?`).bind(providerId, INCENTIVES.foundingPlaces).run();
  return (await db.prepare("SELECT founding_no FROM providers WHERE id = ?").bind(providerId).first<{ founding_no: number | null }>())?.founding_no ?? null;
}

export async function foundingPlacesLeft(db: D1Database) {
  const r = await db.prepare("SELECT COUNT(*) AS n FROM providers WHERE founding_no IS NOT NULL").first<{ n: number }>();
  return Math.max(0, INCENTIVES.foundingPlaces - (r?.n ?? 0));
}

// ---------- the business's own link ----------

export const VIA_COOKIE = "ae_via";
/** The short link a business shares: bookings after arriving through it carry no commission. */
export const ownLink = (site: string, slug: string) => `${site}/b/${slug}`;
export const ownLinkExpiry = (today: string) => addDays(today, INCENTIVES.ownLinkDays);
