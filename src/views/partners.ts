// Team pages for Regional Partners: the list, each partner's record, businesses, scorecard and statements.
import { COMPANY, PARTNERS } from "../config";
import { PARTNER_STATUSES, type PartnerLineRow, type PartnerRow, type PartnerStatementRow, type Scorecard } from "../services/partners";
import { monthLabel } from "../services/statements";
import { APPLICATION_STATUSES, PARTNER_TERMS_VERSION, type PartnerApplication, type PartnerUser } from "../services/partner-portal";
import { esc, ic } from "./ui";

const inr = (p: number) => "₹" + (p / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const STATUS_LABEL: Record<string, string> = { active: "Active", paused: "Paused", ended: "Ended", terminated: "Terminated" };
const badge = (s: string) => `<span class="badge ${s === "active" ? "b-ok" : s === "paid" ? "b-ok" : "b-blush"}">${esc(STATUS_LABEL[s] ?? (s === "issued" ? "To pay" : s === "paid" ? "Paid" : s))}</span>`;
const masked = (acct: string) => (acct ? `•••• ${esc(acct.slice(-4))}` : "<span class='muted'>Not given</span>");

export interface PartnerListRow extends PartnerRow { businesses: number; live: number; earned: number; unpaid: number }

function partnerForm(p: Partial<PartnerRow>, csrf: string, action: string, submit: string, fromRef = "") {
  const f = (k: keyof PartnerRow, label: string, attrs = "", hint = "") =>
    `<label class="f">${label}${hint ? ` <span class="hint">${hint}</span>` : ""}<input class="in" name="${k}" value="${esc(String(p[k] ?? ""))}" ${attrs}></label>`;
  return `<form class="card col" style="gap:12px" method="post" action="${esc(action)}"><input type="hidden" name="csrf" value="${esc(csrf)}">${fromRef ? `<input type="hidden" name="application_ref" value="${esc(fromRef)}">` : ""}
    <div class="grid g2">${f("name", "Full name", 'required maxlength="80"')}${f("region", "City or region", 'required maxlength="60" placeholder="Kochi"')}</div>
    <div class="grid g2">${f("code", "Partner code", 'required maxlength="12" placeholder="KOCHI01" autocapitalize="characters"', "on their link and the application form")}${f("agreement_date", "Agreement signed", 'type="date"')}</div>
    <div class="grid g2">${f("email", "Email", 'type="email" maxlength="120"', "statements are sent here")}${f("phone", "Mobile", 'type="tel" maxlength="20"')}</div>
    <div class="grid g2">${f("pan", "PAN", 'maxlength="10" autocapitalize="characters"', "for TDS; without it 20% is deducted")}${f("gstin", "GSTIN", 'maxlength="15" autocapitalize="characters"', "only if registered")}</div>
    <div class="grid g2">${f("bank_name", "Account holder's name", 'maxlength="80"')}${f("bank_account", "Bank account number", 'inputmode="numeric" maxlength="18"')}</div>
    <div class="grid g2">${f("bank_ifsc", "IFSC", 'maxlength="11" autocapitalize="characters"')}
      <label class="f">Status<select class="in" name="status">${PARTNER_STATUSES.map((s) => `<option value="${s}" ${(p.status ?? "active") === s ? "selected" : ""}>${STATUS_LABEL[s]}</option>`).join("")}</select></label></div>
    <div class="grid g2">${f("ended_on", "Agreement ended", 'type="date"', "for Ended or Terminated")}<span></span></div>
    <label class="f">Notes <span class="hint">only the team sees these</span><textarea class="in" name="notes" rows="2" maxlength="2000">${esc(p.notes ?? "")}</textarea></label>
    <p class="xs muted">Ended: shares continue for ${PARTNERS.tailMonths} months on businesses already brought in. Terminated (a breach): shares stop. Bank details and PAN are seen only by the Aestheva team.</p>
    <div><button class="btn btn-p btn-s" type="submit">${submit}</button></div></form>`;
}

const APP_LABEL: Record<string, string> = { new: "New", talking: "Talking", accepted: "Accepted", declined: "Declined" };
const appBadge = (s: string) => `<span class="badge ${s === "accepted" ? "b-ok" : s === "new" ? "b-med" : "b-blush"}">${esc(APP_LABEL[s] ?? s)}</span>`;

function applicationsCard(apps: PartnerApplication[]) {
  const open = apps.filter((a) => a.status === "new" || a.status === "talking"), closed = apps.length - open.length;
  return `<div class="card mt24"><div class="row wrap between"><h2 style="font-size:24px">Applications to become a partner</h2><a class="small" href="/become-a-partner" target="_blank" rel="noopener">The public page</a></div>
    ${open.length ? `<div class="tbl-wrap mt12"><table class="tbl"><thead><tr><th>Applicant</th><th>City</th><th>Background</th><th>Could bring in 90 days</th><th>Received</th><th>Status</th></tr></thead><tbody>
      ${open.map((a) => `<tr><td><a href="/ops/partners/applications/${esc(a.ref)}"><b>${esc(a.name)}</b></a><div class="xs muted">${esc(a.ref)}</div></td><td class="small">${esc(a.city)}</td><td class="small">${esc(a.background)}</td><td>${a.businesses_90}</td><td class="small">${esc(a.created_at.slice(0, 10))}</td><td>${appBadge(a.status)}</td></tr>`).join("")}
    </tbody></table></div>` : `<p class="small muted mt8">No open applications.</p>`}
    ${closed ? `<details class="mt12"><summary class="small">${closed} accepted or declined</summary><ul class="mt8 small" style="padding-left:18px">${apps.filter((a) => a.status === "accepted" || a.status === "declined").map((a) => `<li><a href="/ops/partners/applications/${esc(a.ref)}">${esc(a.name)}</a> · ${esc(a.city)} · ${esc(APP_LABEL[a.status])}</li>`).join("")}</ul></details>` : ""}</div>`;
}

export function partnerApplicationPage(d: { a: PartnerApplication; csrf: string; message?: string; error?: string }) {
  const a = d.a;
  return `<a class="btn btn-g btn-s" href="/ops/partners" style="margin-left:-10px">${ic("chevL", 16)} Regional Partners</a>
    ${d.message ? `<div class="form-ok mt12" role="status">${esc(d.message)}</div>` : ""}${d.error ? `<div class="form-error mt12" role="alert">${esc(d.error)}</div>` : ""}
    <div class="row wrap between mt12"><div><div class="eyebrow">Partner application · ${esc(a.ref)}</div><h1 class="mt8" style="font-size:38px">${esc(a.name)}</h1></div>${appBadge(a.status)}</div>
    <div class="apply-layout mt24"><div class="col" style="gap:16px">
      <div class="card"><dl class="kv"><dt>City</dt><dd>${esc(a.city)}</dd><dt>Background</dt><dd>${esc(a.background)}</dd><dt>Could bring live in 90 days</dt><dd>${a.businesses_90}</dd>
        <dt>Mobile</dt><dd><a href="tel:${esc(a.phone)}">${esc(a.phone)}</a></dd><dt>Email</dt><dd><a href="mailto:${esc(a.email)}">${esc(a.email)}</a></dd>
        <dt>Online</dt><dd>${a.online ? esc(a.online) : "—"}</dd><dt>Received</dt><dd>${esc(a.created_at.slice(0, 16).replace("T", " "))} UTC</dd></dl>
        <h3 class="mt16" style="font-size:16px">Who they know</h3><p class="small mt8" style="white-space:pre-wrap">${esc(a.network)}</p></div>
      <form class="card col" style="gap:12px" method="post" action="/ops/partners/applications/${esc(a.ref)}"><input type="hidden" name="csrf" value="${esc(d.csrf)}">
        <label class="f">Status<select class="in" name="status" style="max-width:240px">${APPLICATION_STATUSES.map((s) => `<option value="${s}" ${a.status === s ? "selected" : ""}>${APP_LABEL[s]}</option>`).join("")}</select></label>
        <label class="f">Team notes <span class="hint">calls, references checked, what was agreed</span><textarea class="in" name="team_notes" rows="5" maxlength="4000">${esc(a.team_notes)}</textarea></label>
        <div><button class="btn btn-p btn-s" type="submit">Save</button></div></form>
    </div><aside class="col" style="gap:16px">
      <div class="card"><h2 style="font-size:20px">Next steps</h2><ol class="small mt8" style="padding-left:18px;line-height:1.7"><li>Call them; check two references from the trade.</li><li>Agree the region and sign the Regional Partner agreement.</li><li>Collect PAN and bank details from them directly (never by WhatsApp photo).</li><li>Create the partner, then invite them to the portal.</li></ol>
        ${a.partner_id ? `<a class="btn btn-o btn-s mt12" href="/ops/partners/${esc(a.partner_id)}">Open their partner record</a>` : a.status === "declined" ? "" : `<a class="btn btn-p btn-s mt12" href="/ops/partners?from=${esc(a.ref)}#add">Create partner from this</a>`}</div>
    </aside></div>`;
}

export function portalLoginCard(d: { p: PartnerRow; login: PartnerUser | null; csrf: string; link?: string }) {
  const { p, login } = d, set = login && !login.password_hash.startsWith("unset$");
  const btn = (action: string, label: string, cls = "btn-o") => `<form method="post" action="/ops/partners/${esc(p.id)}/portal"><input type="hidden" name="csrf" value="${esc(d.csrf)}"><input type="hidden" name="action" value="${action}"><button class="btn ${cls} btn-s" type="submit">${label}</button></form>`;
  const terms = p.terms_version === PARTNER_TERMS_VERSION ? `Accepted ${esc((p.terms_accepted_at ?? "").slice(0, 10))}` : p.terms_version ? `Accepted an earlier version (${esc(p.terms_version)}); asked again at sign-in` : "Not yet accepted";
  return `<div class="card"><h2 style="font-size:22px">Partner portal</h2>
    <dl class="kv mt12"><dt>Login</dt><dd>${login ? esc(login.email) : "None yet"}</dd>
      ${login ? `<dt>Status</dt><dd>${!login.active ? "Turned off" : set ? "Password set" : "Invited; password not set yet"}</dd><dt>Last sign-in</dt><dd>${login.last_login_at ? esc(login.last_login_at.slice(0, 10)) : "—"}</dd>` : ""}
      <dt>Partner terms</dt><dd>${terms}</dd></dl>
    ${d.link ? `<div class="note n-warn mt12">${ic("alert", 16)}<div class="small">The email couldn't be sent. Send this one-time link to ${esc(p.name.split(" ")[0])} yourself, by a private message only to them. It works for 3 days:<br><code style="word-break:break-all">${esc(d.link)}</code></div></div>` : ""}
    <div class="row wrap mt12" style="gap:8px">${!login ? btn("invite", "Invite to the portal", "btn-p") : login.active ? `${btn("invite", set ? "Send a new set-password link" : "Resend the invitation")}${btn("disable", "Turn off login", "btn-g")}` : btn("enable", "Turn login back on")}</div>
    <p class="xs muted mt8">The invitation goes to the partner's email above, which becomes their login. They see only their own businesses' names, setup progress and booking totals, and their own earnings: never client details.</p></div>`;
}

export function partnersListPage(d: { rows: PartnerListRow[]; csrf: string; month: string; error?: string; values?: Record<string, string>; applications?: PartnerApplication[]; fromRef?: string }) {
  return `<div class="row wrap between mt8"><h1 style="font-size:40px">Regional Partners</h1>
      <div class="row wrap" style="gap:8px"><a class="btn btn-o btn-s" href="/ops/partners.csv?month=${esc(d.month)}">${ic("doc", 15)} Accounts for ${esc(monthLabel(d.month))} (CSV)</a><a class="btn btn-o btn-s" href="/ops/partners/bank.csv">${ic("wallet", 15)} Bank file: statements to pay</a></div></div>
    <p class="small muted mt8" style="max-width:780px">Each partner earns ${PARTNERS.shareBp / 100}% of the commission Aestheva receives (excluding GST) from the businesses they brought, for ${PARTNERS.months} months from each business's go-live, plus ${inr(PARTNERS.bonusPaise)} when a new business has ${PARTNERS.bonusBookings} completed online bookings within ${PARTNERS.bonusDays} days. Statements are made on the ${PARTNERS.issueDay}th for the month before, with TDS, and emailed to the partner.</p>
    ${d.error ? `<div class="form-error mt12" role="alert">${esc(d.error)}</div>` : ""}
    ${d.rows.length ? `<div class="tbl-wrap mt24"><table class="tbl"><thead><tr><th>Partner</th><th>Region</th><th>Businesses</th><th>Live</th><th>Earned to date</th><th>To pay</th><th>Status</th></tr></thead><tbody>
      ${d.rows.map((r) => `<tr><td><a href="/ops/partners/${esc(r.id)}"><b>${esc(r.name)}</b></a><div class="xs muted">${esc(r.code)} · bookaestheva.com/partner/${esc(r.code)}</div></td><td class="small">${esc(r.region)}</td><td>${r.businesses}</td><td>${r.live}</td><td>${inr(r.earned)}</td><td>${r.unpaid ? `<b>${inr(r.unpaid)}</b>` : "—"}</td><td>${badge(r.status)}</td></tr>`).join("")}
    </tbody></table></div>` : `<div class="card mt24" style="text-align:center;padding:36px"><p class="muted">No partners yet. Add the first one below.</p></div>`}
    ${applicationsCard(d.applications ?? [])}
    <h2 class="mt32" style="font-size:24px" id="add">Add a partner</h2>${d.fromRef ? `<p class="small muted mt8">From application ${esc(d.fromRef)}. Check every detail with them, choose their code, and add PAN and bank details once you have them.</p>` : ""}<div class="mt12" style="max-width:760px">${partnerForm(d.values ?? {}, d.csrf, "/ops/partners", "Add partner", d.fromRef)}</div>`;
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

export function scorecardCard(sc: Scorecard, month: string) {
  const rows: [string, string, string][] = [
    ["Pipeline", "Applications with their code · approved · live", `${sc.applications} · ${sc.approved} · ${sc.live}`],
    ["Speed", "Days from application to live (middle value)", sc.daysToLive === null ? "—" : `${sc.daysToLive} days`],
    ["Quality", "Live listings with 3+ photos and 5+ services", `${sc.complete} of ${sc.live}`],
    ["Activation", "First online booking within 30 days of going live", `${sc.firstBooking30} of ${sc.live} (${pct(sc.firstBooking30, sc.live)})`],
    ["Active", `Businesses with ${PARTNERS.bonusBookings}+ completed online bookings in ${monthLabel(month)}`, `${sc.active} of ${sc.live}`],
    ["Sales", `Value of completed online bookings in ${monthLabel(month)}`, inr(sc.bookingValue)],
    ["Revenue", `Aestheva commission received · partner's earnings for ${monthLabel(month)}`, `${inr(sc.commission)} · ${inr(sc.share)}`],
    ["Retention", "Live 90+ days and still active this month", `${sc.retained90} of ${sc.eligible90}`],
  ];
  return `<div class="card"><h2 style="font-size:22px">Scorecard · ${esc(monthLabel(month))}</h2>
    <div class="tbl-wrap mt12"><table class="tbl"><tbody>${rows.map(([a, b, v]) => `<tr><td><b class="small">${a}</b><div class="xs muted">${b}</div></td><td style="white-space:nowrap"><b>${v}</b></td></tr>`).join("")}</tbody></table></div>
    <p class="xs muted mt8">Targets: 10 businesses live with ${PARTNERS.bonusBookings} bookings each by day 90, 25 by day 180. Meeting them keeps the region exclusive.</p></div>`;
}

export function partnerPage(d: {
  p: PartnerRow; csrf: string; businesses: { id: string; name: string; area: string; status: string; live_since: string | null }[];
  others: { id: string; name: string; area: string }[]; statements: PartnerStatementRow[]; sc: Scorecard; month: string; message?: string; error?: string; site: string;
  login?: PartnerUser | null; inviteLink?: string;
}) {
  const p = d.p, link = `${d.site}/partner/${p.code}`;
  return `<a class="btn btn-g btn-s" href="/ops/partners" style="margin-left:-10px">${ic("chevL", 16)} All partners</a>
    ${d.message ? `<div class="form-ok mt12" role="status">${esc(d.message)}</div>` : ""}${d.error ? `<div class="form-error mt12" role="alert">${esc(d.error)}</div>` : ""}
    <div class="row wrap between mt12"><div><div class="eyebrow">Aestheva Regional Partner · ${esc(p.region)}</div><h1 class="mt8" style="font-size:38px">${esc(p.name)}</h1></div>${badge(p.status)}</div>
    <div class="apply-layout mt24"><div class="col" style="gap:16px">
      ${scorecardCard(d.sc, d.month)}
      <div class="card"><h2 style="font-size:22px">Their businesses</h2>
        ${d.businesses.length ? `<div class="tbl-wrap mt12"><table class="tbl"><thead><tr><th>Business</th><th>Status</th><th>Live since</th><th></th></tr></thead><tbody>
          ${d.businesses.map((b) => `<tr><td><a href="/ops/venues/${esc(b.id)}"><b>${esc(b.name)}</b></a><div class="xs muted">${esc(b.area)}</div></td><td class="small">${esc(b.status)}</td><td class="small">${esc(b.live_since ?? "—")}</td>
            <td><form method="post" action="/ops/partners/${esc(p.id)}/businesses"><input type="hidden" name="csrf" value="${esc(d.csrf)}"><input type="hidden" name="provider_id" value="${esc(b.id)}"><input type="hidden" name="remove" value="1"><button class="btn btn-g btn-x" type="submit">Remove</button></form></td></tr>`).join("")}
        </tbody></table></div>` : `<p class="small muted mt8">None yet. Businesses are added when the team approves an application with this partner's code, or here.</p>`}
        ${d.others.length ? `<form class="row wrap mt12" style="gap:8px" method="post" action="/ops/partners/${esc(p.id)}/businesses"><input type="hidden" name="csrf" value="${esc(d.csrf)}">
          <select class="in" name="provider_id" style="max-width:340px">${d.others.map((o) => `<option value="${esc(o.id)}">${esc(o.name)} · ${esc(o.area)}</option>`).join("")}</select><button class="btn btn-o btn-s" type="submit">Credit to ${esc(p.name.split(" ")[0])}</button></form>
          <p class="xs muted mt8">Only for a business this partner really brought, and that has no other partner. It's recorded in the activity log.</p>` : ""}</div>
      <div class="card"><h2 style="font-size:22px">Statements</h2>
        ${d.statements.length ? `<div class="tbl-wrap mt12"><table class="tbl"><thead><tr><th>Statement</th><th>Month</th><th>Earned</th><th>TDS</th><th>Paid to them</th><th>Status</th></tr></thead><tbody>
          ${d.statements.map((s) => `<tr><td><a href="/ops/partners/statements/${esc(s.id)}"><b>${esc(s.number)}</b></a></td><td class="small">${esc(monthLabel(s.month))}</td><td>${inr(s.gross_paise)}</td><td>${s.tds_paise ? inr(s.tds_paise) : "—"}</td><td><b>${inr(s.net_paise)}</b></td><td>${badge(s.status)}</td></tr>`).join("")}
        </tbody></table></div>` : `<p class="small muted mt8">The first statement is made on the ${PARTNERS.issueDay}th of the month after commission from one of their businesses is received.</p>`}</div>
    </div><aside class="col" style="gap:16px">
      <div class="card"><h2 style="font-size:22px">Their link</h2><p class="mt8"><code style="word-break:break-all">${esc(link)}</code></p>
        <p class="xs muted mt8">Opens the business pages with their code, which is then filled in on the application. Businesses can also type the code <b>${esc(p.code)}</b>.</p></div>
      ${portalLoginCard({ p, login: d.login ?? null, csrf: d.csrf, link: d.inviteLink })}
      <div class="card"><h2 style="font-size:22px">Payment details</h2><dl class="kv mt12"><dt>PAN</dt><dd>${p.pan ? esc(p.pan) : "<span class='f-err'>Not given: 20% TDS applies</span>"}</dd><dt>GSTIN</dt><dd>${p.gstin ? esc(p.gstin) : "Not registered"}</dd>
        <dt>Account</dt><dd>${esc(p.bank_name)} ${masked(p.bank_account)} ${p.bank_ifsc ? `· ${esc(p.bank_ifsc)}` : ""}</dd></dl></div>
      <details class="card"><summary><b>Edit details</b></summary><div class="mt12">${partnerForm(p, d.csrf, `/ops/partners/${p.id}`, "Save changes")}</div></details>
    </aside></div>`;
}

export function partnerStatementPage(d: { s: PartnerStatementRow; partner: PartnerRow; lines: PartnerLineRow[]; csrf: string; error?: string; today: string; portal?: boolean }) {
  const { s, partner } = d;
  return `<a class="btn btn-g btn-s no-print" href="${d.portal ? "/partners/statements" : `/ops/partners/${esc(partner.id)}`}" style="margin-left:-10px">${ic("chevL", 16)} ${d.portal ? "All statements" : esc(partner.name)}</a>
    ${d.error ? `<div class="form-error mt12" role="alert">${esc(d.error)}</div>` : ""}
    <div class="card mt12"><div class="row wrap between"><div><div class="eyebrow">Regional Partner statement</div><h1 class="mt8" style="font-size:32px">${esc(s.number)}</h1>
      <p class="small muted">${esc(monthLabel(s.month))} · ${esc(partner.name)}, ${esc(partner.region)} · PAN ${esc(partner.pan || "not given")}</p></div>${badge(s.status)}</div>
      <div class="tbl-wrap mt16"><table class="tbl"><thead><tr><th>Business</th><th>For</th><th>Commission received</th><th>Earned</th></tr></thead><tbody>
        ${d.lines.map((l) => `<tr><td><b>${esc(l.name ?? "")}</b></td><td class="small">${esc(l.note.replace(/^[^:]*: /, ""))}</td><td>${l.kind === "share" ? inr(l.base_paise) : "—"}</td><td>${inr(l.amount_paise)}${l.kind === "share" ? ` <span class="xs muted">(${PARTNERS.shareBp / 100}%)</span>` : ` <span class="xs muted">(bonus)</span>`}</td></tr>`).join("")}
      </tbody></table></div>
      <dl class="kv mt16"><dt>Share</dt><dd>${inr(s.share_paise)}</dd><dt>Bonuses</dt><dd>${inr(s.bonus_paise)}</dd><dt>Earned</dt><dd><b>${inr(s.gross_paise)}</b></dd>
        ${s.gst_paise ? `<dt>GST (${PARTNERS.gstBp / 100}%)</dt><dd>${inr(s.gst_paise)}</dd>` : ""}<dt>Income-tax TDS</dt><dd>${s.tds_paise ? `−${inr(s.tds_paise)}` : "None this month"}</dd>
        <dt>To pay</dt><dd><b>${inr(s.net_paise)}</b></dd>${s.status === "paid" ? `<dt>Paid</dt><dd>${esc(s.paid_on ?? "")} · ${esc(s.paid_ref)}</dd>` : ""}</dl>
      <p class="xs muted mt12">Made by Aestheva for ${esc(COMPANY.legalName)} (PAN ${esc(COMPANY.pan)}, TAN ${esc(COMPANY.tan)}, CIN ${esc(COMPANY.cin)}). TDS on commission under section 393(1) of the Income-tax Act, 2025 (formerly section 194H), applied once payments to the partner pass ₹20,000 in a financial year.</p></div>
    ${s.status === "issued" && !d.portal ? `<form class="card col mt16 no-print" style="gap:12px;max-width:520px" method="post" action="/ops/partners/statements/${esc(s.id)}/paid"><input type="hidden" name="csrf" value="${esc(d.csrf)}">
      <b>Mark as paid</b><div class="grid g2"><label class="f">Paid on<input class="in" type="date" name="paid_on" value="${esc(d.today)}" required></label><label class="f">Bank or UPI reference<input class="in" name="paid_ref" required maxlength="60"></label></div>
      <div><button class="btn btn-ok btn-s" type="submit">Mark ${inr(s.net_paise)} as paid</button></div></form>` : ""}
    <p class="no-print mt16"><button class="btn btn-o btn-s" type="button" onclick="print()">${ic("doc", 15)} Print or save as PDF</button></p>`;
}
