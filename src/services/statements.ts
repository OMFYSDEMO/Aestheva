// Automatic money: deposit size, the figures for each booking, and the monthly statement with its GST invoice.
// Clients never pay commission: it is deducted from what each business receives, or invoiced to the business when
// clients pay it directly at the venue. Every figure is worked out here, so nobody calculates anything by hand.
import type { Env } from "../env";
import { BILLING, COMPANY, POLICY } from "../config";
import { audit, newId, nowIso } from "../db";
import { addDays, istToUtc, nowIst } from "../domain/time";
import { inr } from "../domain/money";
import { gatewayFor } from "./gateway";
import { sendEmail } from "./notify";

export type PayoutMode = "own" | "invoice" | "route";
const bp = (paise: number, rate: number) => Math.round((paise * rate) / 10000);
/** Haswel Care's GSTIN: the COMPANY_GSTIN variable if set, otherwise src/config.ts. */
export const companyGstin = (env: { COMPANY_GSTIN?: string }) => env.COMPANY_GSTIN?.trim() || COMPANY.gstin;

/**
 * The online deposit for a service at a business.
 *   own:     the deposit set on the service (a business Haswel Care runs itself).
 *   invoice: none. Clients pay at the venue and Aestheva invoices its commission, so no client money is held.
 *   route:   20% of the full price, rounded up to ₹10, or more if the business asks; never more than the price.
 */
export function depositFor(mode: string | null | undefined, s: { price_paise: number; deposit_paise: number }) {
  if (mode === "invoice") return 0;
  if (mode !== "route") return Math.min(s.deposit_paise, s.price_paise);
  const pct = Math.ceil((s.price_paise * POLICY.depositBp) / 10000 / 1000) * 1000;
  return Math.min(s.price_paise, Math.max(s.deposit_paise, pct));
}

export interface LineInput {
  status: string; source: string; price_paise: number; commission_bp: number; credit_paise: number;
  paid: number; refunded: number; cancelled_by?: string | null;
}
export interface Line { outcome: "completed" | "no_show" | "late_cancel"; price: number; collected: number; commissionBp: number; commission: number; gst: number; tds: number; tcs: number; net: number }

/**
 * The money for one finished marketplace booking.
 * collected: what Aestheva holds for the business: the deposit it kept, plus any welcome credit Aestheva pays on top.
 * Commission (and GST on it) applies only to completed bookings, on the price the client paid. TDS and TCS are
 * worked out on completed bookings only, and only while BILLING.withholding is on.
 */
export function lineFor(b: LineInput, opts: { gstRegistered: boolean }): Line | null {
  if (b.source !== "marketplace") return null;
  const kept = Math.max(0, b.paid - b.refunded);
  const outcome = b.status === "completed" ? "completed" : b.status === "no_show" ? "no_show" : b.status === "cancelled" && b.cancelled_by === "client" && kept > 0 ? "late_cancel" : null;
  if (!outcome) return null;
  const collected = kept + (b.paid && !b.refunded ? b.credit_paise : 0);
  const done = outcome === "completed";
  const commission = done ? bp(b.price_paise, b.commission_bp) : 0;
  const gst = bp(commission, BILLING.gstBp);
  const tds = done && BILLING.withholding ? bp(b.price_paise, BILLING.tdsBp) : 0;
  const tcs = done && BILLING.withholding && opts.gstRegistered ? bp(b.price_paise, BILLING.tcsBp) : 0;
  return { outcome, price: b.price_paise, collected, commissionBp: done ? b.commission_bp : 0, commission, gst, tds, tcs, net: collected - commission - gst - tds - tcs };
}

export const isGstin = (s: string) => /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(s);
/** CGST and SGST within Kerala; IGST when the business is registered in another state. */
export const gstSplit = (gstin: string, gst: number) =>
  gstin && gstin.slice(0, 2) !== BILLING.homeState ? { igst: gst, cgst: 0, sgst: 0 } : { igst: 0, cgst: Math.floor(gst / 2), sgst: gst - Math.floor(gst / 2) };

/** April to March: 2026-11-03 → "2627". */
export function financialYear(date: string) {
  const y = Number(date.slice(0, 4)), start = Number(date.slice(5, 7)) >= 4 ? y : y - 1;
  return `${String(start).slice(2)}${String(start + 1).slice(2)}`;
}
export const monthBefore = (date: string) => addDays(`${date.slice(0, 7)}-01`, -1).slice(0, 7);
export const monthLabel = (m: string) => new Date(m + "-01T00:00:00Z").toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

// ---------- reading ----------

export interface StatementRow {
  id: string; provider_id: string; month: string; payout_mode: PayoutMode; bookings: number; gross_paise: number; collected_paise: number;
  commission_paise: number; gst_paise: number; tds_paise: number; tcs_paise: number; net_paise: number; invoice_no: string | null;
  status: "draft" | "issued" | "paid" | "settled" | "nothing_due"; payment_link_id: string | null; payment_link_url: string | null;
  issued_at: string | null; paid_at: string | null; emailed_at: string | null; created_at: string;
}
/** What the business owes Aestheva on a statement (invoice mode), or 0. */
export const amountDue = (s: Pick<StatementRow, "net_paise">) => Math.max(0, -s.net_paise);

const FINISHED_SQL = `SELECT b.id, b.ref, b.date, b.start_min, b.service_name, b.status, b.source, b.price_paise, b.commission_bp, b.credit_paise, b.cancelled_by,
    (SELECT COALESCE(SUM(p.amount_paise), 0) FROM payments p WHERE p.booking_id = b.id AND p.status IN ('captured','refunded','partially_refunded')) AS paid,
    (SELECT COALESCE(SUM(r.amount_paise), 0) FROM refunds r JOIN payments p ON p.id = r.payment_id WHERE p.booking_id = b.id AND r.status <> 'failed') AS refunded
  FROM bookings b WHERE b.provider_id = ? AND substr(b.date, 1, 7) = ? AND b.source = 'marketplace' AND b.status IN ('completed','no_show','cancelled')`;

export async function statementWithLines(db: D1Database, id: string, providerId?: string) {
  const s = await db.prepare(`SELECT * FROM statements WHERE id = ?${providerId ? " AND provider_id = ?" : ""}`).bind(...(providerId ? [id, providerId] : [id])).first<StatementRow>();
  if (!s) return null;
  const [p, lines] = await Promise.all([
    db.prepare("SELECT id, name, address, gstin, payout_mode FROM providers WHERE id = ?").bind(s.provider_id).first<{ id: string; name: string; address: string; gstin: string; payout_mode: string }>(),
    db.prepare(`SELECT l.*, b.ref, b.date, b.service_name FROM statement_lines l JOIN bookings b ON b.id = l.booking_id WHERE l.statement_id = ? ORDER BY b.date, b.start_min`).bind(id)
      .all<{ ref: string; date: string; service_name: string; outcome: string; price_paise: number; collected_paise: number; commission_bp: number; commission_paise: number; gst_paise: number; tds_paise: number; tcs_paise: number; net_paise: number }>(),
  ]);
  return { s, p: p!, lines: lines.results };
}

export const providerStatements = async (db: D1Database, providerId: string) =>
  (await db.prepare("SELECT * FROM statements WHERE provider_id = ? ORDER BY month DESC").bind(providerId).all<StatementRow>()).results;

// ---------- scheduled work ----------

/** Confirmed bookings nobody marked within 48 hours of their end count as completed, so commission is never missed. */
export async function autoComplete(db: D1Database, now: Date = new Date()) {
  const today = nowIst(now).date;
  const due = (await db.prepare("SELECT id, date, start_min, dur_min FROM bookings WHERE status = 'confirmed' AND date <= ?").bind(addDays(today, -1)).all<{ id: string; date: string; start_min: number; dur_min: number }>()).results
    .filter((b) => istToUtc(b.date, b.start_min + b.dur_min).getTime() + POLICY.autoCompleteHours * 36e5 < now.getTime());
  for (const b of due) {
    await db.batch([
      db.prepare("UPDATE bookings SET status = 'completed', updated_at = ? WHERE id = ? AND status = 'confirmed'").bind(nowIso(), b.id),
      audit(db, "system", "booking.auto_completed", "booking", b.id),
    ]);
  }
  return due.length;
}

/** Builds last month's statements once the issue day has come; each business gets at most one per month. */
export async function makeStatements(env: Env, now: Date = new Date()) {
  const db = env.DB, today = nowIst(now).date;
  if (Number(today.slice(8, 10)) < BILLING.issueDay) return 0;
  const month = monthBefore(today);
  const providers = (await db.prepare(`SELECT p.id, p.payout_mode, p.gstin FROM providers p WHERE NOT EXISTS (SELECT 1 FROM statements s WHERE s.provider_id = p.id AND s.month = ?)
      AND EXISTS (SELECT 1 FROM bookings b WHERE b.provider_id = p.id AND substr(b.date, 1, 7) = ? AND b.source = 'marketplace')`).bind(month, month)
    .all<{ id: string; payout_mode: PayoutMode; gstin: string }>()).results;
  let made = 0;
  for (const p of providers) {
    const rows = (await db.prepare(FINISHED_SQL).bind(p.id, month).all<LineInput & { id: string }>()).results;
    const lines = rows.map((r) => ({ id: r.id, l: lineFor(r, { gstRegistered: isGstin(p.gstin) }) })).filter((x): x is { id: string; l: Line } => !!x.l);
    if (!lines.length) continue;   // nothing finished that month: no statement
    const sum = (k: keyof Line) => lines.reduce((a, x) => a + (x.l[k] as number), 0);
    const t = { gross: lines.filter((x) => x.l.outcome === "completed").reduce((a, x) => a + x.l.price, 0), collected: sum("collected"), commission: sum("commission"), gst: sum("gst"), tds: sum("tds"), tcs: sum("tcs"), net: sum("net") };
    // Haswel Care doesn't invoice itself; nothing to invoice when no commission was charged (for example a founding month).
    const status = p.payout_mode === "own" || t.commission === 0 ? "nothing_due" : "draft";
    const id = newId("stm");
    try {
      await db.batch([
        db.prepare(`INSERT INTO statements (id, provider_id, month, payout_mode, bookings, gross_paise, collected_paise, commission_paise, gst_paise, tds_paise, tcs_paise, net_paise, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, p.id, month, p.payout_mode, lines.length, t.gross, t.collected, t.commission, t.gst, t.tds, t.tcs, t.net, status),
        ...lines.map(({ id: bid, l }) => db.prepare(`INSERT INTO statement_lines (statement_id, booking_id, outcome, price_paise, collected_paise, commission_bp, commission_paise, gst_paise, tds_paise, tcs_paise, net_paise)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, bid, l.outcome, l.price, l.collected, l.commissionBp, l.commission, l.gst, l.tds, l.tcs, l.net)),
        audit(db, "system", "statement.created", "statement", id, { provider: p.id, month, ...t }),
      ]);
      made++;
    } catch (e) { if (!String((e as Error).message).includes("UNIQUE")) throw e; }   // another run made it first
  }
  return made;
}

/**
 * Issues draft statements: a GST invoice number, a Razorpay payment link when the business owes commission
 * (clients paid it directly), and an email. Waits while the company GSTIN isn't set, so no invoice goes out without it.
 */
export async function issueStatements(env: Env, site: string, now: Date = new Date()) {
  if (!companyGstin(env)) return 0;
  const db = env.DB, today = nowIst(now).date;
  const drafts = (await db.prepare("SELECT * FROM statements WHERE status = 'draft' ORDER BY created_at").all<StatementRow>()).results;
  let issued = 0;
  for (const s of drafts) {
    let invoice = s.invoice_no;
    if (!invoice) {
      const fy = financialYear(today);
      const n = await db.prepare("INSERT INTO invoice_counters (fy, last_no) VALUES (?, 1) ON CONFLICT(fy) DO UPDATE SET last_no = last_no + 1 RETURNING last_no").bind(fy).first<{ last_no: number }>();
      invoice = `${BILLING.invoicePrefix}/${fy}/${String(n!.last_no).padStart(4, "0")}`;
      // Claim the draft with its number; if another run already did, skip it.
      const claim = await db.prepare("UPDATE statements SET invoice_no = ?, issued_at = ? WHERE id = ? AND invoice_no IS NULL").bind(invoice, nowIso(), s.id).run();
      if (!claim.meta.changes) continue;
    }
    const due = amountDue(s);
    let link = { id: s.payment_link_id, url: s.payment_link_url };
    if (due > 0 && !link.id) {
      try { link = await createLink(env, s, invoice, due); }
      catch (e) { console.error("payment link failed", s.id, e); continue; }   // tried again on the next run
    }
    const status = due > 0 ? "issued" : "settled";
    await db.batch([
      db.prepare("UPDATE statements SET status = ?, payment_link_id = ?, payment_link_url = ? WHERE id = ?").bind(status, link.id, link.url, s.id),
      audit(db, "system", "statement.issued", "statement", s.id, { invoice, due }),
    ]);
    await emailStatement(env, s.id, site);
    issued++;
  }
  return issued;
}

async function createLink(env: Env, s: StatementRow, invoice: string, due: number) {
  const db = env.DB;
  const p = (await db.prepare("SELECT name, phone FROM providers WHERE id = ?").bind(s.provider_id).first<{ name: string; phone: string }>())!;
  const u = await db.prepare("SELECT email FROM provider_users WHERE provider_id = ? AND active = 1 ORDER BY created_at LIMIT 1").bind(s.provider_id).first<{ email: string }>();
  const r = await gatewayFor(env).createPaymentLink({
    amount: due, reference_id: invoice, description: `Aestheva commission ${monthLabel(s.month)} · invoice ${invoice}`,
    customer: { name: p.name, email: u?.email, contact: p.phone || undefined }, expire_by: Math.floor(Date.now() / 1000) + 45 * 86400,
    notes: { statement_id: s.id, provider_id: s.provider_id },
  });
  return { id: r.id, url: r.short_url };
}

/** Marks a statement paid when its payment link is paid (from the webhook, or the hourly check). */
export async function markLinkPaid(db: D1Database, linkId: string, actor: string) {
  const r = await db.prepare("UPDATE statements SET status = 'paid', paid_at = ? WHERE payment_link_id = ? AND status = 'issued'").bind(nowIso(), linkId).run();
  if (r.meta.changes) await audit(db, actor, "statement.paid", "payment_link", linkId).run();
  return !!r.meta.changes;
}

/** Hourly: asks Razorpay about unpaid links, in case a webhook was missed. */
export async function checkLinks(env: Env) {
  const open = (await env.DB.prepare("SELECT payment_link_id FROM statements WHERE status = 'issued' AND payment_link_id IS NOT NULL").all<{ payment_link_id: string }>()).results;
  let paid = 0;
  for (const o of open) {
    try { if ((await gatewayFor(env).fetchPaymentLink(o.payment_link_id)).status === "paid" && (await markLinkPaid(env.DB, o.payment_link_id, "system"))) paid++; }
    catch (e) { console.error("payment link check failed", o.payment_link_id, e); }
  }
  return paid;
}

export async function emailStatement(env: Env, id: string, site: string) {
  const d = await statementWithLines(env.DB, id);
  if (!d) return;
  const due = amountDue(d.s), url = `${site}/clinic/statements/${d.s.id}`;
  const lines = [
    `Your Aestheva statement for ${monthLabel(d.s.month)} is ready${d.s.invoice_no ? `, with tax invoice ${d.s.invoice_no}` : ""}.`,
    `${d.s.bookings} booking${d.s.bookings === 1 ? "" : "s"} · completed value ${inr(d.s.gross_paise)} · Aestheva commission ${inr(d.s.commission_paise)} + GST ${inr(d.s.gst_paise)}.`,
    due > 0 ? `Amount due: ${inr(due)}. Pay online here: ${d.s.payment_link_url}` : d.s.net_paise > 0 ? `Paid to you: ${inr(d.s.net_paise)}, after commission and GST.` : "Nothing to pay.",
    `See the statement and download the invoice: ${url}`,
  ];
  const html = `<div style="font-family:Arial,sans-serif;color:#26141F;max-width:560px">${lines.map((l) => `<p>${l.replace(/(https:\/\/\S+)/g, '<a href="$1" style="color:#8A2E5C">$1</a>')}</p>`).join("")}<p style="color:#8A7C83;font-size:12px">${COMPANY.legalName} · GSTIN ${companyGstin(env)}</p></div>`;
  const to = (await env.DB.prepare("SELECT email FROM provider_users WHERE provider_id = ? AND active = 1").bind(d.s.provider_id).all<{ email: string }>()).results;
  for (const u of to) await sendEmail(env, u.email, { subject: `Aestheva statement, ${monthLabel(d.s.month)}${d.s.invoice_no ? ` · ${d.s.invoice_no}` : ""}`, text: lines.join("\n\n"), html });
  if (to.length) await env.DB.prepare("UPDATE statements SET emailed_at = ? WHERE id = ?").bind(nowIso(), id).run();
}

/** Everything the scheduled job does for money, in order. Safe to run every 5 minutes. */
export async function moneyJobs(env: Env, now: Date = new Date()) {
  const site = env.SITE_URL || "https://bookaestheva.com";
  const completed = await autoComplete(env.DB, now);
  const made = await makeStatements(env, now);
  const issued = await issueStatements(env, site, now);
  const paid = nowIst(now).min % 60 < 5 ? await checkLinks(env) : 0;   // first run of each hour
  return { completed, made, issued, paid };
}
