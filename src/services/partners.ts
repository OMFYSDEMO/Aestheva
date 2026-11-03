// Regional Partners: who brought which business, what each partner earns each month, and how they are doing.
// The money comes from the business statements Aestheva already issues: a partner earns 25% of the commission Aestheva
// actually received (excluding GST) from their businesses, for 24 months from each business's go-live date, plus a ₹750
// bonus once a new business has 5 completed online bookings within 60 days of going live.
import type { Env } from "../env";
import { COMPANY, PARTNERS } from "../config";
import { HttpError, audit, newId, nowIso } from "../db";
import { addDays, nowIst } from "../domain/time";
import { financialYear, monthLabel } from "./statements";
import { sendEmail } from "./notify";

export interface PartnerRow {
  id: string; code: string; name: string; region: string; email: string; phone: string; pan: string; gstin: string;
  bank_name: string; bank_account: string; bank_ifsc: string; agreement_date: string | null;
  status: "active" | "paused" | "ended" | "terminated"; ended_on: string | null; notes: string; created_at: string;
}
export interface PartnerStatementRow {
  id: string; partner_id: string; month: string; number: string; share_paise: number; bonus_paise: number; gross_paise: number;
  gst_paise: number; tds_paise: number; net_paise: number; status: "issued" | "paid"; paid_on: string | null; paid_ref: string;
  emailed_at: string | null; created_at: string;
}
export interface PartnerLineRow { statement_id: string; provider_id: string; kind: "share" | "bonus"; source_statement_id: string | null; base_paise: number; amount_paise: number; note: string; name?: string }

export const PARTNER_STATUSES = ["active", "paused", "ended", "terminated"] as const;
const CODE = /^[A-Z][A-Z0-9]{2,11}$/;
const PAN = /^[A-Z]{5}\d{4}[A-Z]$/;
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const normaliseCode = (s: unknown) => String(s ?? "").trim().toUpperCase().replace(/\s+/g, "");
export const validPan = (pan: string) => PAN.test(pan);

// ---------- months ----------
export const ym = (date: string) => date.slice(0, 7);
export function addMonths(month: string, n: number) {
  const [y, m] = month.split("-").map(Number), t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}
export const prevMonth = (date: string) => addMonths(ym(date), -1);
const monthEnd = (month: string) => addDays(addMonths(month, 1) + "-01", -1);

/** A business earns its partner a share for service months from its go-live month, for 24 months. */
export const inWindow = (serviceMonth: string, liveSince: string | null) =>
  !!liveSince && serviceMonth >= ym(liveSince) && serviceMonth < addMonths(ym(liveSince), PARTNERS.months);

/** Whether a partner earns for a month: until an ordinary ending plus 6 months; until termination, nothing after. */
export function partnerEarns(p: Pick<PartnerRow, "status" | "ended_on">, month: string) {
  if (p.status === "active" || p.status === "paused") return true;
  if (!p.ended_on) return p.status === "ended";
  return p.status === "ended" ? month < addMonths(ym(p.ended_on), PARTNERS.tailMonths + 1) : month <= ym(p.ended_on);
}

// ---------- partner records ----------
export type PartnerForm = Record<string, unknown>;
export function cleanPartner(f: PartnerForm): { ok: true; value: Omit<PartnerRow, "id" | "created_at"> } | { ok: false; errors: string[] } {
  const s = (k: string) => String(f[k] ?? "").trim();
  const v = {
    code: normaliseCode(f.code), name: s("name"), region: s("region"), email: s("email").toLowerCase(), phone: s("phone"),
    pan: s("pan").toUpperCase(), gstin: s("gstin").toUpperCase().replace(/\s/g, ""), bank_name: s("bank_name"),
    bank_account: s("bank_account").replace(/\s/g, ""), bank_ifsc: s("bank_ifsc").toUpperCase(), agreement_date: s("agreement_date") || null,
    status: (PARTNER_STATUSES as readonly string[]).includes(s("status")) ? (s("status") as PartnerRow["status"]) : "active",
    ended_on: s("ended_on") || null, notes: s("notes").slice(0, 2000),
  };
  const e: string[] = [];
  if (!CODE.test(v.code)) e.push("The partner code is 3 to 12 letters and numbers, starting with a letter, for example KOCHI01.");
  if (v.name.length < 2 || v.name.length > 80) e.push("Please enter the partner's full name.");
  if (v.region.length < 2 || v.region.length > 60) e.push("Please enter the partner's city or region.");
  if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) e.push("That email address doesn't look right.");
  if (v.pan && !PAN.test(v.pan)) e.push("A PAN has 10 characters, for example ABCDE1234F.");
  if (v.gstin && !GSTIN.test(v.gstin)) e.push("That doesn't look like a GSTIN (15 characters). Leave it blank if the partner isn't registered.");
  if (v.bank_ifsc && !IFSC.test(v.bank_ifsc)) e.push("An IFSC has 11 characters, for example SBIN0070123.");
  if (v.bank_account && !/^\d{6,18}$/.test(v.bank_account)) e.push("The bank account number should be 6 to 18 digits.");
  for (const [k, label] of [["agreement_date", "agreement date"], ["ended_on", "end date"]] as const)
    if (v[k] && !/^\d{4}-\d{2}-\d{2}$/.test(v[k]!)) e.push(`Please give the ${label} as a date.`);
  if ((v.status === "ended" || v.status === "terminated") && !v.ended_on) e.push("Please give the date the agreement ended.");
  return e.length ? { ok: false, errors: e } : { ok: true, value: v };
}

export async function savePartner(db: D1Database, f: PartnerForm, id?: string) {
  const r = cleanPartner(f);
  if (!r.ok) throw new HttpError(400, r.errors.join(" "));
  const v = r.value;
  const clash = await db.prepare("SELECT id FROM partners WHERE code = ? AND id <> ?").bind(v.code, id ?? "").first();
  if (clash) throw new HttpError(409, `The code ${v.code} is already used by another partner.`);
  const cols = ["code", "name", "region", "email", "phone", "pan", "gstin", "bank_name", "bank_account", "bank_ifsc", "agreement_date", "status", "ended_on", "notes"] as const;
  if (id) {
    const res = await db.prepare(`UPDATE partners SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`).bind(...cols.map((c) => v[c]), id).run();
    if (!res.meta.changes) throw new HttpError(404, "Unknown partner");
    await audit(db, "ops", "partner.updated", "partner", id, { status: v.status }).run();
    return id;
  }
  const nid = newId("pt");
  await db.batch([
    db.prepare(`INSERT INTO partners (id, ${cols.join(", ")}) VALUES (?, ${cols.map(() => "?").join(", ")})`).bind(nid, ...cols.map((c) => v[c])),
    audit(db, "ops", "partner.created", "partner", nid, { code: v.code, region: v.region }),
  ]);
  return nid;
}

export const getPartner = (db: D1Database, id: string) => db.prepare("SELECT * FROM partners WHERE id = ?").bind(id).first<PartnerRow>();
export const partnerByCode = (db: D1Database, code: string) =>
  db.prepare("SELECT * FROM partners WHERE code = ? AND status IN ('active', 'paused')").bind(normaliseCode(code)).first<PartnerRow>();

/** Fix a business to a partner (or clear it). Haswel Care's own businesses never earn a partner a share. */
export async function setProviderPartner(db: D1Database, providerId: string, partnerId: string | null, actor: string) {
  const p = await db.prepare("SELECT payout_mode FROM providers WHERE id = ?").bind(providerId).first<{ payout_mode: string }>();
  if (!p) throw new HttpError(404, "Unknown venue");
  if (partnerId && p.payout_mode === "own") throw new HttpError(400, "This is one of Haswel Care's own businesses, so it can't be credited to a partner.");
  if (partnerId && !(await getPartner(db, partnerId))) throw new HttpError(404, "Unknown partner");
  await db.batch([
    db.prepare("UPDATE providers SET partner_id = ? WHERE id = ?").bind(partnerId, providerId),
    audit(db, actor, partnerId ? "provider.partner_set" : "provider.partner_cleared", "provider", providerId, partnerId ? { partnerId } : undefined),
  ]);
}

// ---------- monthly statements ----------
interface ShareSource { id: string; provider_id: string; month: string; commission_paise: number; live_since: string | null; name: string }

/** The lines a partner has earned for a month: shares of commission received in it, and bonuses reached by its end. */
export async function partnerLines(db: D1Database, partner: PartnerRow, month: string) {
  const sources = (await db.prepare(`SELECT s.id, s.provider_id, s.month, s.commission_paise, p.live_since, p.name
      FROM statements s JOIN providers p ON p.id = s.provider_id
      WHERE p.partner_id = ? AND s.commission_paise > 0 AND (
        (s.status = 'paid' AND strftime('%Y-%m', datetime(s.paid_at, '+330 minutes')) = ?) OR
        (s.status = 'settled' AND strftime('%Y-%m', datetime(s.issued_at, '+330 minutes')) = ?))
      AND NOT EXISTS (SELECT 1 FROM partner_lines l WHERE l.kind = 'share' AND l.source_statement_id = s.id)
      ORDER BY p.name, s.month`).bind(partner.id, month, month).all<ShareSource>()).results;
  const lines: Omit<PartnerLineRow, "statement_id">[] = [];
  for (const s of sources) {
    if (!inWindow(s.month, s.live_since)) continue;
    lines.push({ provider_id: s.provider_id, kind: "share", source_statement_id: s.id, base_paise: s.commission_paise,
      amount_paise: Math.round((s.commission_paise * PARTNERS.shareBp) / 10000), note: `${s.name}: commission for ${monthLabel(s.month)}`, name: s.name });
  }
  const end = monthEnd(month);
  const candidates = (await db.prepare(`SELECT p.id, p.name, p.live_since FROM providers p WHERE p.partner_id = ? AND p.live_since IS NOT NULL AND p.live_since <= ?
      AND NOT EXISTS (SELECT 1 FROM partner_lines l WHERE l.kind = 'bonus' AND l.provider_id = p.id)`).bind(partner.id, end).all<{ id: string; name: string; live_since: string }>()).results;
  for (const c of candidates) {
    const until = addDays(c.live_since, PARTNERS.bonusDays);
    const fifth = await db.prepare(`SELECT date FROM bookings WHERE provider_id = ? AND source = 'marketplace' AND status = 'completed' AND date >= ? AND date <= ?
        ORDER BY date, start_min LIMIT 1 OFFSET ?`).bind(c.id, c.live_since, until, PARTNERS.bonusBookings - 1).first<{ date: string }>();
    if (fifth && fifth.date <= end)
      lines.push({ provider_id: c.id, kind: "bonus", source_statement_id: null, base_paise: 0, amount_paise: PARTNERS.bonusPaise,
        note: `${c.name}: ${PARTNERS.bonusBookings} online bookings within ${PARTNERS.bonusDays} days of going live`, name: c.name });
  }
  return lines;
}

/** TDS for a statement, catching up on earlier amounts in the year once the ₹20,000 threshold is passed. */
export async function tdsFor(db: D1Database, partner: PartnerRow, fy: string, gross: number) {
  const prior = await db.prepare(`SELECT COALESCE(SUM(gross_paise), 0) AS gross, COALESCE(SUM(CASE WHEN tds_paise = 0 THEN gross_paise ELSE 0 END), 0) AS untaxed
      FROM partner_statements WHERE partner_id = ? AND number LIKE ?`).bind(partner.id, `${PARTNERS.prefix}/${fy}/%`).first<{ gross: number; untaxed: number }>();
  if ((prior?.gross ?? 0) + gross <= PARTNERS.tdsThresholdPaise) return 0;
  const rate = validPan(partner.pan) ? PARTNERS.tdsBp : PARTNERS.tdsNoPanBp;
  return Math.round(((gross + (prior?.untaxed ?? 0)) * rate) / 10000);
}

/** On or after the 10th, makes each partner's statement for the month before, and emails it. Safe to run repeatedly. */
export async function makePartnerStatements(env: Env, now: Date = new Date()) {
  const db = env.DB, today = nowIst(now).date;
  if (Number(today.slice(8, 10)) < PARTNERS.issueDay) return 0;
  const month = prevMonth(today), fy = financialYear(today);
  const partners = (await db.prepare(`SELECT * FROM partners p WHERE NOT EXISTS (SELECT 1 FROM partner_statements s WHERE s.partner_id = p.id AND s.month = ?)`).bind(month).all<PartnerRow>()).results;
  let made = 0;
  for (const partner of partners) {
    if (!partnerEarns(partner, month)) continue;
    const lines = await partnerLines(db, partner, month);
    if (!lines.length) continue;
    const share = lines.filter((l) => l.kind === "share").reduce((a, l) => a + l.amount_paise, 0);
    const bonus = lines.filter((l) => l.kind === "bonus").reduce((a, l) => a + l.amount_paise, 0);
    const gross = share + bonus, gst = partner.gstin ? Math.round((gross * PARTNERS.gstBp) / 10000) : 0;
    const tds = await tdsFor(db, partner, fy, gross);
    const n = await db.prepare("INSERT INTO invoice_counters (fy, last_no) VALUES (?, 1) ON CONFLICT(fy) DO UPDATE SET last_no = last_no + 1 RETURNING last_no").bind(`${PARTNERS.prefix}${fy}`).first<{ last_no: number }>();
    const id = newId("ps"), number = `${PARTNERS.prefix}/${fy}/${String(n!.last_no).padStart(4, "0")}`;
    try {
      await db.batch([
        db.prepare(`INSERT INTO partner_statements (id, partner_id, month, number, share_paise, bonus_paise, gross_paise, gst_paise, tds_paise, net_paise, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'issued')`).bind(id, partner.id, month, number, share, bonus, gross, gst, tds, gross + gst - tds),
        ...lines.map((l) => db.prepare(`INSERT INTO partner_lines (statement_id, provider_id, kind, source_statement_id, base_paise, amount_paise, note) VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .bind(id, l.provider_id, l.kind, l.source_statement_id, l.base_paise, l.amount_paise, l.note)),
        audit(db, "system", "partner_statement.made", "partner", partner.id, { number, month, gross, tds }),
      ]);
    } catch (e) {
      if (String(e).includes("UNIQUE")) continue;   // another run made it first
      throw e;
    }
    made++;
    if (partner.email) await emailStatement(env, partner, id).catch((e) => console.error("partner statement email failed", id, e));
  }
  return made;
}

const rupees = (p: number) => "₹" + (p / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function emailStatement(env: Env, partner: PartnerRow, id: string) {
  const s = (await env.DB.prepare("SELECT * FROM partner_statements WHERE id = ?").bind(id).first<PartnerStatementRow>())!;
  const lines = (await env.DB.prepare("SELECT * FROM partner_lines WHERE statement_id = ? ORDER BY kind DESC, note").bind(id).all<PartnerLineRow>()).results;
  const first = partner.name.split(" ")[0];
  const rows = lines.map((l) => `${l.note}: ${rupees(l.amount_paise)}${l.kind === "share" ? ` (25% of ${rupees(l.base_paise)})` : ""}`);
  const totals = [`Earned: ${rupees(s.gross_paise)}`, ...(s.gst_paise ? [`GST: ${rupees(s.gst_paise)}`] : []), ...(s.tds_paise ? [`Income-tax TDS: −${rupees(s.tds_paise)}`] : []), `To be paid to your bank account: ${rupees(s.net_paise)}`];
  const text = [`Hello ${first},`, `Your Aestheva Regional Partner statement ${s.number} for ${monthLabel(s.month)}:`, ...rows, totals.join("\n"),
    ...(s.tds_paise ? [`The TDS is deducted by ${COMPANY.legalName} (TAN ${COMPANY.tan}) and appears in your Form 26AS against your PAN.`] : []),
    "Payment is made to the bank account we hold for you. Reply to this email with any question.", "Aestheva partners team"].join("\n\n");
  const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#302A2E;line-height:1.55;max-width:560px"><p>Hello ${esc(first)},</p>
    <p>Your Aestheva Regional Partner statement <b>${esc(s.number)}</b> for ${esc(monthLabel(s.month))}:</p><ul>${rows.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
    <p>${totals.map(esc).join("<br>")}</p>${s.tds_paise ? `<p>The TDS is deducted by ${esc(COMPANY.legalName)} (TAN ${esc(COMPANY.tan)}) and appears in your Form 26AS against your PAN.</p>` : ""}<p>Payment is made to the bank account we hold for you. Reply to this email with any question.</p><p>Aestheva partners team</p></div>`;
  const r = await sendEmail(env, partner.email, { subject: `Your Aestheva partner statement for ${monthLabel(s.month)}`, text, html });
  if (r.ok) await env.DB.prepare("UPDATE partner_statements SET emailed_at = ? WHERE id = ?").bind(nowIso(), id).run();
}

export async function markPartnerPaid(db: D1Database, id: string, paidOn: string, ref: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) throw new HttpError(400, "Please give the date it was paid.");
  if (ref.trim().length < 4) throw new HttpError(400, "Please give the bank or UPI reference of the payment.");
  const r = await db.prepare("UPDATE partner_statements SET status = 'paid', paid_on = ?, paid_ref = ? WHERE id = ? AND status = 'issued'").bind(paidOn, ref.trim().slice(0, 60), id).run();
  if (!r.meta.changes) throw new HttpError(409, "That statement is already marked paid.");
  await audit(db, "ops", "partner_statement.paid", "partner_statement", id, { ref: ref.trim() }).run();
}

export async function partnerStatement(db: D1Database, id: string) {
  const s = await db.prepare("SELECT * FROM partner_statements WHERE id = ?").bind(id).first<PartnerStatementRow>();
  if (!s) throw new HttpError(404, "Unknown statement");
  const partner = (await getPartner(db, s.partner_id))!;
  const lines = (await db.prepare("SELECT l.*, p.name FROM partner_lines l JOIN providers p ON p.id = l.provider_id WHERE l.statement_id = ? ORDER BY l.kind DESC, p.name").bind(id).all<PartnerLineRow>()).results;
  return { s, partner, lines };
}

// ---------- exports ----------
const csvCell = (v: unknown) => { const t = String(v ?? ""); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
const csv = (rows: unknown[][]) => rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
const money = (p: number) => (p / 100).toFixed(2);

/** For the accountant: every partner statement for a month, with PAN, TDS and payment. */
export async function partnerAccountsCsv(db: D1Database, month: string) {
  const rows = (await db.prepare(`SELECT s.*, p.name, p.code, p.region, p.pan, p.gstin FROM partner_statements s JOIN partners p ON p.id = s.partner_id WHERE s.month = ? ORDER BY s.number`)
    .bind(month).all<PartnerStatementRow & { name: string; code: string; region: string; pan: string; gstin: string }>()).results;
  return csv([["Statement", "Month", "Partner", "Code", "Region", "PAN", "GSTIN", "Share", "Bonus", "Gross", "GST", "TDS", "Net paid", "Status", "Paid on", "Reference", "Deductor TAN"],
    ...rows.map((r) => [r.number, r.month, r.name, r.code, r.region, r.pan, r.gstin, money(r.share_paise), money(r.bonus_paise), money(r.gross_paise), money(r.gst_paise), money(r.tds_paise), money(r.net_paise), r.status, r.paid_on ?? "", r.paid_ref, COMPANY.tan])]);
}

/** For the bank: one row per statement waiting to be paid, with the partner's account. */
export async function partnerBankCsv(db: D1Database) {
  const rows = (await db.prepare(`SELECT s.number, s.net_paise, p.name, p.bank_name, p.bank_account, p.bank_ifsc, p.email FROM partner_statements s JOIN partners p ON p.id = s.partner_id
      WHERE s.status = 'issued' AND s.net_paise > 0 ORDER BY s.number`).all<{ number: string; net_paise: number; name: string; bank_name: string; bank_account: string; bank_ifsc: string; email: string }>()).results;
  return csv([["Beneficiary name", "Account number", "IFSC", "Amount", "Narration", "Email"],
    ...rows.map((r) => [r.bank_name || r.name, r.bank_account, r.bank_ifsc, money(r.net_paise), `Aestheva partner ${r.number}`, r.email])]);
}

// ---------- scorecard ----------
export interface Scorecard {
  applications: number; approved: number; live: number; daysToLive: number | null; complete: number;
  firstBooking30: number; active: number; bookingValue: number; commission: number; share: number; retained90: number; eligible90: number;
}

/** How a partner is doing in a month (YYYY-MM): pipeline, speed and quality, activation, sales and retention. */
export async function scorecard(db: D1Database, partner: PartnerRow, month: string): Promise<Scorecard> {
  const end = monthEnd(month), start = month + "-01";
  const apps = await db.prepare(`SELECT COUNT(*) AS n, SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS ok FROM applications WHERE partner_code = ?`).bind(partner.code).first<{ n: number; ok: number }>();
  const provs = (await db.prepare(`SELECT p.id, p.status, p.live_since, p.photos_json,
      (SELECT MIN(a.created_at) FROM applications a WHERE a.provider_id = p.id) AS applied_at,
      (SELECT COUNT(*) FROM services s WHERE s.provider_id = p.id AND s.active = 1) AS services
      FROM providers p WHERE p.partner_id = ?`).bind(partner.id).all<{ id: string; status: string; live_since: string | null; photos_json: string; applied_at: string | null; services: number }>()).results;
  const live = provs.filter((p) => p.status === "live" && p.live_since);
  const days = live.filter((p) => p.applied_at).map((p) => (Date.parse(p.live_since!) - Date.parse(p.applied_at!.slice(0, 10))) / 864e5).sort((a, b) => a - b);
  const complete = live.filter((p) => { try { return JSON.parse(p.photos_json || "[]").length >= 3 && p.services >= 5; } catch { return false; } }).length;
  let firstBooking30 = 0, active = 0, bookingValue = 0, retained90 = 0, eligible90 = 0;
  for (const p of live) {
    const first = await db.prepare("SELECT MIN(date) AS d FROM bookings WHERE provider_id = ? AND source = 'marketplace' AND status IN ('confirmed', 'completed')").bind(p.id).first<{ d: string | null }>();
    if (first?.d && first.d <= addDays(p.live_since!, 30)) firstBooking30++;
    const m = await db.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(price_paise), 0) AS v FROM bookings WHERE provider_id = ? AND source = 'marketplace' AND status = 'completed' AND date BETWEEN ? AND ?").bind(p.id, start, end).first<{ n: number; v: number }>();
    if ((m?.n ?? 0) >= PARTNERS.bonusBookings) active++;
    bookingValue += m?.v ?? 0;
    if (addDays(p.live_since!, 90) <= end) { eligible90++; if ((m?.n ?? 0) >= PARTNERS.bonusBookings) retained90++; }
  }
  const money_ = await db.prepare(`SELECT COALESCE(SUM(CASE WHEN l.kind = 'share' THEN l.base_paise ELSE 0 END), 0) AS commission, COALESCE(SUM(l.amount_paise), 0) AS share
      FROM partner_lines l JOIN partner_statements s ON s.id = l.statement_id WHERE s.partner_id = ? AND s.month = ?`).bind(partner.id, month).first<{ commission: number; share: number }>();
  return {
    applications: apps?.n ?? 0, approved: apps?.ok ?? 0, live: live.length, daysToLive: days.length ? Math.round(days[Math.floor(days.length / 2)]) : null,
    complete, firstBooking30, active, bookingValue, commission: money_?.commission ?? 0, share: money_?.share ?? 0, retained90, eligible90,
  };
}
