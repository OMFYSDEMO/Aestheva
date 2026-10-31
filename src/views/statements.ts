// Monthly statements and GST invoices: the business's list, the printable statement and invoice, and the team's view.
import { BILLING, COMPANY, POLICY } from "../config";
import { fmtDate } from "../domain/time";
import { amountDue, gstSplit, monthLabel, type StatementRow } from "../services/statements";
import { esc, ic, inr } from "./ui";

type Detail = NonNullable<Awaited<ReturnType<typeof import("../services/statements").statementWithLines>>>;

const STATUS: Record<StatementRow["status"], [string, string]> = {
  draft: ["b-plain", "Being prepared"], issued: ["b-warn", "Due"], paid: ["b-ok", "Paid"], settled: ["b-ok", "Settled"], nothing_due: ["b-plain", "Nothing due"],
};
const badge = (s: StatementRow["status"]) => `<span class="badge ${STATUS[s][0]}">${STATUS[s][1]}</span>`;

/** The statements card on the business's Payments page. */
export function statementsCard(list: StatementRow[]) {
  return `<section class="card mt24"><div class="row between wrap" style="gap:8px"><h3 style="font-size:20px">Statements and invoices</h3><span class="xs muted">Made automatically on the ${BILLING.issueDay}rd of each month</span></div>
    ${list.length ? `<div class="tbl-wrap mt12"><table class="tbl"><thead><tr><th>Month</th><th>Bookings</th><th>Commission + GST</th><th>Status</th><th></th></tr></thead><tbody>
      ${list.map((s) => `<tr><td><b>${monthLabel(s.month)}</b>${s.invoice_no ? `<div class="xs muted">Invoice ${esc(s.invoice_no)}</div>` : ""}</td><td class="small">${s.bookings}</td><td class="small">${inr(s.commission_paise + s.gst_paise)}</td>
        <td>${badge(s.status)}${s.status === "issued" ? `<div class="xs">${inr(amountDue(s))} to pay</div>` : ""}</td>
        <td class="small" style="white-space:nowrap"><a href="/clinic/statements/${esc(s.id)}">View</a>${s.status === "issued" && s.payment_link_url ? ` · <a href="${esc(s.payment_link_url)}" target="_blank" rel="noopener"><b>Pay now</b></a>` : ""}</td></tr>`).join("")}
    </tbody></table></div>` : `<p class="small muted mt8">Your first statement appears here after your first month of online bookings.</p>`}
    <p class="xs muted mt12">Clients never pay Aestheva's commission: it is charged to you, ${POLICY.commissionBp / 100}% of what the client paid (less while you're a founding partner), plus 18% GST. When clients pay you at the venue, you pay it with the link on each statement. Confirmed bookings you don't mark within ${POLICY.autoCompleteHours} hours of the appointment count as completed, so mark no-shows promptly.</p>
  </section>`;
}

/** The printable statement, with the GST tax invoice on top when commission was charged. */
export function statementPage(d: Detail & { gstin: string; back: string; draftNote?: boolean }) {
  const { s, p } = d, split = gstSplit(p.gstin, s.gst_paise), due = amountDue(s);
  const rate = (bp: number) => (bp ? `${bp / 100}%` : "0%");
  const invoice = s.invoice_no ? `<section class="invoice card mt16">
      <div class="row between wrap" style="gap:16px;align-items:flex-start">
        <div><div class="eyebrow">Tax invoice</div><h2 class="mt8" style="font-size:26px">${esc(s.invoice_no)}</h2><p class="small muted mt8">Date: ${s.issued_at ? fmtDate(s.issued_at.slice(0, 10), true) : ""}</p></div>
        <div class="small" style="text-align:right"><b>${esc(COMPANY.legalName)}</b><br>${esc(COMPANY.registeredAddress)}<br>GSTIN ${esc(d.gstin)} · CIN ${esc(COMPANY.cin)}</div>
      </div>
      <div class="grid g2 mt16 small"><div><div class="xs muted">Billed to</div><b>${esc(p.name)}</b><br>${esc(p.address)}${p.gstin ? `<br>GSTIN ${esc(p.gstin)}` : ""}</div>
        <div><div class="xs muted">Place of supply</div>Kerala (${BILLING.homeState})</div></div>
      <div class="tbl-wrap mt16"><table class="tbl"><thead><tr><th>Description</th><th>SAC</th><th style="text-align:right">Amount</th></tr></thead><tbody>
        <tr><td>Aestheva marketplace commission on completed bookings, ${monthLabel(s.month)}</td><td>${BILLING.sac}</td><td style="text-align:right">${inr(s.commission_paise)}</td></tr>
        ${split.igst ? `<tr><td>IGST 18%</td><td></td><td style="text-align:right">${inr(split.igst)}</td></tr>` : `<tr><td>CGST 9%</td><td></td><td style="text-align:right">${inr(split.cgst)}</td></tr><tr><td>SGST 9%</td><td></td><td style="text-align:right">${inr(split.sgst)}</td></tr>`}
        <tr><td><b>Invoice total</b></td><td></td><td style="text-align:right"><b>${inr(s.commission_paise + s.gst_paise)}</b></td></tr>
      </tbody></table></div>
    </section>` : "";
  const summary = [
    ["Completed bookings: what clients paid", inr(s.gross_paise)],
    ["Held by Aestheva for you (deposits kept and welcome credits)", inr(s.collected_paise)],
    ["Aestheva commission", `−${inr(s.commission_paise)}`],
    ["GST on commission", `−${inr(s.gst_paise)}`],
    ...(s.tds_paise ? [["Income-tax TDS", `−${inr(s.tds_paise)}`]] : []),
    ...(s.tcs_paise ? [["GST TCS", `−${inr(s.tcs_paise)}`]] : []),
  ];
  return `<div class="page narrow statement">
    <div class="row between wrap no-print" style="gap:8px"><a class="btn btn-g btn-s" href="${esc(d.back)}" style="margin-left:-10px">${ic("chevL", 16)} Payments</a><button class="btn btn-o btn-s" type="button" onclick="window.print()">Print or save as PDF</button></div>
    <div class="row between wrap mt12" style="gap:8px"><div><div class="eyebrow">Statement · ${esc(p.name)}</div><h1 class="mt8" style="font-size:clamp(30px,4vw,40px)">${monthLabel(s.month)}</h1></div>${badge(s.status)}</div>
    ${d.draftNote ? `<div class="note n-plain mt12">${ic("info", 16)}<div>This statement is waiting for Haswel Care's GSTIN to be set before its invoice is issued.</div></div>` : ""}
    ${invoice}
    <section class="card mt16"><h3 style="font-size:20px">Summary</h3><dl class="kv mt12">${summary.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}
      <dt><b>${s.net_paise >= 0 ? "Due to you" : "You pay Aestheva"}</b></dt><dd><b>${inr(Math.abs(s.net_paise))}</b></dd></dl>
      ${s.status === "issued" && s.payment_link_url ? `<a class="btn btn-p mt16 no-print" href="${esc(s.payment_link_url)}" target="_blank" rel="noopener">Pay ${inr(due)} online</a><p class="xs muted mt8 no-print">UPI, cards or netbanking, through Razorpay. This statement updates by itself once paid.</p>` : ""}
      ${s.status === "paid" && s.paid_at ? `<p class="small mt12" style="color:var(--sage-d)">${ic("check", 14)} Paid on ${fmtDate(s.paid_at.slice(0, 10), true)}. Thank you.</p>` : ""}
    </section>
    <section class="card mt16"><h3 style="font-size:20px">Bookings</h3>
      ${d.lines.length ? `<div class="tbl-wrap mt12"><table class="tbl"><thead><tr><th>Date</th><th>Booking</th><th>Outcome</th><th>Client paid</th><th>Rate</th><th>Commission</th></tr></thead><tbody>
        ${d.lines.map((l) => `<tr><td class="small" style="white-space:nowrap">${fmtDate(l.date)}</td><td class="small">${esc(l.ref)}<div class="xs muted">${esc(l.service_name)}</div></td><td class="small">${l.outcome === "completed" ? "Completed" : `${l.outcome === "no_show" ? "No-show" : "Late cancellation"}${l.collected_paise ? ", deposit kept" : ""}`}</td><td class="small">${l.outcome === "completed" ? inr(l.price_paise) : l.collected_paise ? `${inr(l.collected_paise)} deposit` : "—"}</td><td class="small">${rate(l.commission_bp)}</td><td class="small">${inr(l.commission_paise)}</td></tr>`).join("")}
      </tbody></table></div>` : `<p class="small muted mt8">No online bookings finished this month.</p>`}
      <p class="xs muted mt12">Only bookings made online through Aestheva appear here. Bookings you added yourself carry no commission. Commission is charged only on completed bookings, at the rate on each booking when it was made.</p>
    </section>
  </div>`;
}

/** The team's view of every statement. */
export function opsMoneyPage(d: { rows: (StatementRow & { name: string })[]; gstinSet: boolean }) {
  const total = (k: "commission_paise" | "gst_paise") => d.rows.reduce((a, r) => a + r[k], 0);
  return `<h1 class="mt8" style="font-size:40px">Statements and invoices</h1>
    <p class="small muted mt8">Made automatically on the ${BILLING.issueDay}rd of each month for the month before, issued with a numbered GST invoice and, when a business owes commission, a Razorpay payment link. Paid links are marked by themselves.</p>
    ${d.gstinSet ? "" : `<div class="note n-warn mt12">${ic("alert", 16)}<div><b>Haswel Care's GSTIN isn't set.</b> Statements are prepared but no invoice is issued until it is. Add it to COMPANY.gstin in src/config.ts, or as the COMPANY_GSTIN variable in Cloudflare.</div></div>`}
    <p class="small mt12">Commission invoiced: <b>${inr(total("commission_paise"))}</b> · GST: <b>${inr(total("gst_paise"))}</b></p>
    ${d.rows.length ? `<div class="tbl-wrap mt16"><table class="tbl"><thead><tr><th>Month</th><th>Business</th><th>Invoice</th><th>Commission + GST</th><th>Net</th><th>Status</th></tr></thead><tbody>
      ${d.rows.map((r) => `<tr><td class="small">${monthLabel(r.month)}</td><td><a href="/ops/statements/${esc(r.id)}"><b>${esc(r.name)}</b></a><div class="xs muted">${esc(r.payout_mode)}</div></td><td class="small">${r.invoice_no ? esc(r.invoice_no) : "—"}</td>
        <td class="small">${inr(r.commission_paise + r.gst_paise)}</td><td class="small">${r.net_paise < 0 ? `owes ${inr(-r.net_paise)}` : r.net_paise > 0 ? `due ${inr(r.net_paise)}` : "—"}</td><td>${badge(r.status)}</td></tr>`).join("")}
    </tbody></table></div>` : `<div class="card mt16" style="text-align:center;padding:40px"><p class="muted">No statements yet. The first ones are made on ${BILLING.issueDay} December 2026, for November.</p></div>`}`;
}
