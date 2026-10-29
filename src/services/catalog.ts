import { addDays, dowOf, nowIst, type IstNow } from "../domain/time";
import { freeStarts, slotsFor, type Hours } from "../domain/availability";

export interface ProviderRow {
  id: string; slug: string; name: string; type: string; city: string; area: string; address: string; tagline: string; about: string;
  hours_text: string; amenities_json: string; art: number; status: string; live_since: string | null; razorpay_account_id: string | null;
}
export interface ServiceRow {
  id: string; provider_id: string; name: string; cat: string; kind: "consult" | "treatment" | "beauty"; dur_min: number;
  price_paise: number; deposit_paise: number; description: string; active: number; sort: number;
}
export interface StaffRow {
  id: string; provider_id: string; name: string; role: string; medical: number; quals_json: string; registration: string;
  years: number; langs_json: string; bio: string; active: number;
}
export interface ReviewRow { id: number; provider_id: string; staff_id: string | null; author: string; rating: number; service_name: string; body: string; created_on: string }
export interface Rating { avg: number; n: number }

export const isMedical = (s: { kind: string }) => s.kind === "consult" || s.kind === "treatment";

export async function categories(db: D1Database) {
  return (await db.prepare("SELECT id, name FROM categories ORDER BY sort").all<{ id: string; name: string }>()).results;
}

export async function ratings(db: D1Database): Promise<Map<string, Rating>> {
  const r = await db.prepare("SELECT provider_id, AVG(rating) AS avg, COUNT(*) AS n FROM reviews WHERE published = 1 GROUP BY provider_id").all<{ provider_id: string; avg: number; n: number }>();
  return new Map(r.results.map((x) => [x.provider_id, { avg: x.avg, n: x.n }]));
}

export async function liveProviders(db: D1Database) {
  return (await db.prepare("SELECT * FROM providers WHERE status = 'live' ORDER BY name").all<ProviderRow>()).results;
}
export async function liveServices(db: D1Database, providerIds?: string[]) {
  const all = (await db.prepare(
    "SELECT s.* FROM services s JOIN providers p ON p.id = s.provider_id WHERE s.active = 1 AND p.status = 'live' ORDER BY s.provider_id, s.sort",
  ).all<ServiceRow>()).results;
  return providerIds ? all.filter((s) => providerIds.includes(s.provider_id)) : all;
}

export async function providerBySlug(db: D1Database, slug: string) {
  const p = await db.prepare("SELECT * FROM providers WHERE slug = ? AND status = 'live'").bind(slug).first<ProviderRow>();
  if (!p) return null;
  const [services, staff, links, verifications, reviews] = await db.batch([
    db.prepare("SELECT * FROM services WHERE provider_id = ? AND active = 1 ORDER BY sort").bind(p.id),
    db.prepare("SELECT * FROM staff WHERE provider_id = ? AND active = 1 ORDER BY rowid").bind(p.id),
    db.prepare("SELECT ss.service_id, ss.staff_id FROM service_staff ss JOIN services s ON s.id = ss.service_id WHERE s.provider_id = ?").bind(p.id),
    db.prepare("SELECT label, scope, checked_on FROM verifications WHERE provider_id = ? ORDER BY sort").bind(p.id),
    db.prepare("SELECT * FROM reviews WHERE provider_id = ? AND published = 1 ORDER BY created_on DESC").bind(p.id),
  ]);
  const staffRows = staff.results as StaffRow[];
  const staffIds = new Set(staffRows.map((s) => s.id));
  const byService = new Map<string, string[]>();
  for (const l of links.results as { service_id: string; staff_id: string }[]) {
    if (!staffIds.has(l.staff_id)) continue;
    byService.set(l.service_id, [...(byService.get(l.service_id) ?? []), l.staff_id]);
  }
  const svc = (services.results as ServiceRow[]).map((s) => ({ ...s, staff: byService.get(s.id) ?? [] })).filter((s) => s.staff.length);
  const rv = reviews.results as ReviewRow[];
  const rating: Rating | null = rv.length ? { avg: rv.reduce((a, r) => a + r.rating, 0) / rv.length, n: rv.length } : null;
  return { provider: p, services: svc, staff: staffRows, verifications: verifications.results as { label: string; scope: string; checked_on: string }[], reviews: rv, rating };
}
export type ProviderDetail = NonNullable<Awaited<ReturnType<typeof providerBySlug>>>;

// ---------- availability ----------

interface Inventory { hours: Map<string, Hours>; occupied: Map<string, Set<number>> }
const key = (staffId: string, x: string | number) => `${staffId}|${x}`;

/** Rotas and occupied slots for a set of staff over a date range: two queries. */
export async function loadInventory(db: D1Database, staffIds: string[], from: string, to: string): Promise<Inventory> {
  const hours = new Map<string, Hours>(), occupied = new Map<string, Set<number>>();
  if (!staffIds.length) return { hours, occupied };
  const ph = staffIds.map(() => "?").join(",");
  const [h, o] = await db.batch([
    db.prepare(`SELECT staff_id, dow, start_min, end_min FROM staff_hours WHERE staff_id IN (${ph})`).bind(...staffIds),
    db.prepare(`SELECT staff_id, date, slot FROM staff_slots WHERE staff_id IN (${ph}) AND date BETWEEN ? AND ?`).bind(...staffIds, from, to),
  ]);
  for (const r of h.results as { staff_id: string; dow: number; start_min: number; end_min: number }[]) hours.set(key(r.staff_id, r.dow), r);
  for (const r of o.results as { staff_id: string; date: string; slot: number }[]) {
    const k = key(r.staff_id, r.date);
    if (!occupied.has(k)) occupied.set(k, new Set());
    occupied.get(k)!.add(r.slot);
  }
  return { hours, occupied };
}

export interface Slot { min: number; staffId: string }

/** Bookable start times on a date for a service, across the chosen staff ("any" = earliest free practitioner per time). */
export function slotsOn(inv: Inventory, staffIds: string[], date: string, durMin: number, now: IstNow): Slot[] {
  const dow = dowOf(date), best = new Map<number, string>();
  for (const id of staffIds) {
    const starts = freeStarts({ date, hours: inv.hours.get(key(id, dow)), durMin, occupied: inv.occupied.get(key(id, date)) ?? new Set(), now });
    for (const t of starts) if (!best.has(t)) best.set(t, id);
  }
  return [...best.entries()].sort((a, b) => a[0] - b[0]).map(([min, staffId]) => ({ min, staffId }));
}

/** Whether a specific staff member can start at a time; used to re-check just before writing a booking. */
export function canStart(inv: Inventory, staffId: string, date: string, startMin: number, durMin: number, now: IstNow): boolean {
  return slotsOn(inv, [staffId], date, durMin, now).some((s) => s.min === startMin);
}

/** The earliest bookable time for each provider over the next `days` days. */
export async function nextAvailable(db: D1Database, services: (ServiceRow & { staff?: string[] })[], days = 10, now = nowIst()) {
  const links = (await db.prepare("SELECT service_id, staff_id FROM service_staff").all<{ service_id: string; staff_id: string }>()).results;
  const staffBySvc = new Map<string, string[]>();
  for (const l of links) staffBySvc.set(l.service_id, [...(staffBySvc.get(l.service_id) ?? []), l.staff_id]);
  const staffIds = [...new Set(services.flatMap((s) => staffBySvc.get(s.id) ?? []))];
  const to = addDays(now.date, days - 1);
  const inv = await loadInventory(db, staffIds, now.date, to);
  const out = new Map<string, { date: string; min: number }>();
  for (let i = 0; i < days; i++) {
    const date = addDays(now.date, i);
    for (const s of services) {
      if (out.has(s.provider_id) && out.get(s.provider_id)!.date < date) continue;
      const first = slotsOn(inv, staffBySvc.get(s.id) ?? [], date, s.dur_min, now)[0];
      if (!first) continue;
      const cur = out.get(s.provider_id);
      if (!cur || (cur.date === date && first.min < cur.min)) out.set(s.provider_id, { date, min: first.min });
    }
  }
  return out;
}

export { slotsFor };
