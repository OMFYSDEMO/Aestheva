// The business portal's Offers section: quiet-hour offers a business sets up, pauses and ends itself.
import { POLICY } from "../config";
import { DOW_LONG, fmtDate, fmtTime } from "../domain/time";
import type { ServiceRow } from "../services/catalog";
import { isMedical } from "../services/catalog";
import { OFFER_RULES, discountFor, offerAmount, offerServices, offerState, whenLabel, type OfferRow } from "../services/offers";
import { esc, ic, inr } from "./ui";

type V = Record<string, unknown>;
type Errors = Record<string, string>;
const val = (v: V, k: string) => esc(Array.isArray(v[k]) ? (v[k] as unknown[])[0] : v[k] ?? "");
const has = (v: V, k: string, x: string) => (Array.isArray(v[k]) ? (v[k] as unknown[]) : [v[k]]).map(String).includes(x);
const errOf = (e: Errors, k: string) => e[k] ? `<span class="f-err" id="err-${k}">${esc(e[k])}</span>` : "";
const inv = (e: Errors, k: string) => e[k] ? ` aria-invalid="true" aria-describedby="err-${k}"` : "";
const hidden = (csrf: string) => `<input type="hidden" name="csrf" value="${esc(csrf)}">`;

const STATE_BADGE: Record<string, string> = { on: "b-ok", scheduled: "b-blush", full: "b-warn", paused: "b-plain", ops: "b-err", finished: "b-plain", ended: "b-plain" };
type Stats = { month: number; total: number; given: number; completed: number };

export function offersPage(d: { offers: OfferRow[]; services: ServiceRow[]; stats: Map<string, Stats>; today: string; csrf: string; message?: string; error?: string }) {
  const beauty = d.services.filter((s) => !isMedical(s));
  const current = d.offers.filter((o) => o.status !== "ended" && o.ends_on >= d.today), past = d.offers.filter((o) => !current.includes(o));
  const svcName = new Map(d.services.map((s) => [s.id, s]));
  const card = (o: OfferRow) => {
    const st = d.stats.get(o.id) ?? { month: 0, total: 0, given: 0, completed: 0 };
    const state = offerState(o, d.today, st.month);
    const svcs = offerServices(o).map((id) => svcName.get(id)).filter((s): s is ServiceRow => !!s);
    const eg = svcs[0];
    const act = (action: string, label: string, cls: string) => `<form method="post" action="/clinic/offers/${esc(o.id)}/${action}">${hidden(d.csrf)}<button class="btn ${cls} btn-s" type="submit">${label}</button></form>`;
    const open = o.status !== "ended" && o.ends_on >= d.today;
    return `<div class="offer-row">
      <div class="col" style="gap:6px;min-width:0;flex:1 1 320px">
        <div class="row wrap" style="gap:8px"><span class="offer-amt">${esc(offerAmount(o))}</span><span class="badge ${STATE_BADGE[state.key]}">${esc(state.label)}</span></div>
        <b>${svcs.length ? esc(svcs.map((s) => s.name).join(", ")) : "No services (they were removed from your listing)"}</b>
        <span class="small muted">${esc(whenLabel(o))} · ${fmtDate(o.starts_on)} to ${fmtDate(o.ends_on, true)}</span>
        ${eg ? `<span class="small">Example: ${esc(eg.name)} <s class="muted">${inr(eg.price_paise)}</s> → <b>${inr(eg.price_paise - discountFor(o, eg.price_paise))}</b></span>` : ""}
        <span class="xs muted">${open ? `${st.month} of ${o.monthly_cap} places used this month · ` : ""}${st.total} booking${st.total === 1 ? "" : "s"} so far${st.given ? `, ${inr(st.given)} off in total` : ""}${st.completed ? ` · ${st.completed} completed` : ""}</span>
        ${state.key === "ops" ? `<span class="xs" style="color:var(--err)">The Aestheva team paused this offer. Email us and we'll go through it with you.</span>` : ""}
      </div>
      ${open ? `<div class="row wrap" style="gap:8px">
        <a class="btn btn-o btn-s" href="/clinic/offers/${esc(o.id)}">${ic("edit", 14)} Edit</a>
        ${o.status === "on" ? act("pause", "Pause", "btn-o") : o.paused_by !== "ops" ? act("resume", "Turn back on", "btn-p") : ""}
        ${act("end", "End offer", "btn-g")}</div>` : ""}
    </div>`;
  };
  return `<div class="ws-head"><div><div class="eyebrow">Offers</div><h2 class="mt8">Quiet-hour offers</h2></div>${beauty.length ? `<a class="btn btn-p btn-s" href="/clinic/offers/new">${ic("plus", 15)} New quiet-hour offer</a>` : ""}</div>
    ${d.message ? `<div class="form-ok mt12" role="status">${esc(d.message)}</div>` : ""}${d.error ? `<div class="form-error mt12" role="alert">${esc(d.error)}</div>` : ""}
    <p class="small muted mt8" style="max-width:720px">Fill the hours that are usually empty. Choose an amount off, the services and the quiet hours. Those times show in gold when clients book, and the offer applies by itself. You pay for the discount; commission is only on what the client pays.</p>
    ${!beauty.length ? `<div class="note n-plain mt16">${ic("info", 16)}<div><b>Offers are for non-medical services.</b> Every service on your listing is a medical consultation or treatment, and the professional rules for doctors and dentists don't allow discounts on them. If you add a non-medical service, such as a facial or a massage, you can make an offer for it.</div></div>` : ""}
    ${current.length ? `<section class="card mt16">${current.map(card).join("")}</section>`
      : beauty.length ? `<div class="card mt16" style="text-align:center;padding:36px 24px"><h3 style="font-size:22px">No offers yet</h3><p class="small muted mt8">A good first offer: ₹200 off your most popular service, on the two or three quietest weekday afternoons, for a month.</p><a class="btn btn-p btn-s mt16" href="/clinic/offers/new">${ic("plus", 15)} New quiet-hour offer</a></div>` : ""}
    ${past.length ? `<details class="card mt16"><summary><b>Past offers</b> <span class="small muted">${past.length}</span></summary><div class="mt12">${past.map(card).join("")}</div></details>` : ""}
    <aside class="card tips mt16"><b>How offers work</b><ul>
      <li>Only appointments that <b>start</b> inside your quiet hours get the offer. Other times stay at the full price.</li>
      <li>Each client can use an offer once (one booking per mobile number). If they cancel, it's free for them to use again.</li>
      <li>When the month's places are used up, times go back to the full price until the 1st of the next month.</li>
      <li>Pausing or ending an offer never changes bookings already made.</li>
      <li>Never more than ${Math.round(OFFER_RULES.maxShare * 100)}% off a price. The deposit stays the same, unless the new price is lower than the deposit.</li>
      <li>Commission is ${POLICY.commissionBp / 100}% of what the client pays, so you never pay commission on your own discount.</li>
    </ul></aside>`;
}

export function offerDefaults(services: ServiceRow[], today: string, addDays: (d: string, n: number) => string): V {
  return { amount_type: "fixed", amount: "200", services: services.filter((s) => !isMedical(s)).map((s) => s.id), days: ["2", "3", "4"], start: "660", end: "900", starts_on: today, ends_on: addDays(today, 30), monthly_cap: "20" };
}
export function offerToForm(o: OfferRow): V {
  return { amount_type: o.amount_type, amount: String(o.amount_type === "fixed" ? o.amount / 100 : o.amount), services: offerServices(o), days: o.days.split(","),
    start: String(o.start_min), end: String(o.end_min), starts_on: o.starts_on, ends_on: o.ends_on, monthly_cap: String(o.monthly_cap) };
}

export function offerForm(d: { id?: string; v: V; e: Errors; services: ServiceRow[]; csrf: string; today: string }) {
  const { v, e } = d;
  const beauty = d.services.filter((s) => !isMedical(s)), medical = d.services.filter(isMedical);
  const times = (sel: string, from: number, to: number) => Array.from({ length: (to - from) / 30 + 1 }, (_, i) => from + i * 30).map((m) => `<option value="${m}" ${sel === String(m) ? "selected" : ""}>${fmtTime(m)}</option>`).join("");
  const order = [1, 2, 3, 4, 5, 6, 0];
  const n = Object.keys(e).length;
  return `<a class="btn btn-g btn-s" href="/clinic/offers" style="margin-left:-10px">${ic("chevL", 16)} Offers</a>
    <div class="ws-head mt8"><div><div class="eyebrow">Quiet-hour offer</div><h2 class="mt8">${d.id ? "Edit offer" : "New quiet-hour offer"}</h2></div></div>
    ${n ? `<div class="form-error mt16" role="alert" tabindex="-1" id="apply-errors"><b>${e.form ? esc(e.form) : `Please check ${n === 1 ? "one answer" : `${n} answers`}.`}</b>${e.form ? "" : " They're marked below."}</div>` : ""}
    <div class="setup-grid mt16"><form method="post" action="/clinic/offers/${d.id ? esc(d.id) : "new"}" class="card col" style="gap:18px" novalidate>${hidden(d.csrf)}
      <fieldset class="f" style="border:0;padding:0;margin:0" id="amount"><legend style="margin-bottom:6px">How much off?</legend>
        <div class="row wrap" style="gap:10px;align-items:center">
          <label class="check"><input type="radio" name="amount_type" value="fixed" ${val(v, "amount_type") !== "percent" ? "checked" : ""}> Rupees off</label>
          <label class="check"><input type="radio" name="amount_type" value="percent" ${val(v, "amount_type") === "percent" ? "checked" : ""}> Percent off</label>
          <input class="in" name="amount" inputmode="numeric" value="${val(v, "amount")}" style="max-width:120px" aria-label="Amount off"${inv(e, "amount")}></div>
        <span class="hint xs muted">For example ₹200, or 15%. Never more than ${Math.round(OFFER_RULES.maxShare * 100)}% off any price.</span>${errOf(e, "amount")}</fieldset>
      <div class="f" id="services"><span>Which services?</span>
        <div class="check-grid mt8">${beauty.map((s) => `<label class="pick-item"><input type="checkbox" name="services" value="${esc(s.id)}" ${has(v, "services", s.id) ? "checked" : ""}> ${esc(s.name)} <span class="xs soft">${inr(s.price_paise)}</span></label>`).join("")}</div>
        ${medical.length ? `<span class="hint mt8">Not available for medical consultations and treatments: ${esc(medical.map((s) => s.name).join(", "))}.</span>` : ""}${errOf(e, "services")}</div>
      <fieldset class="f" style="border:0;padding:0;margin:0" id="days"><legend style="margin-bottom:6px">On which days?</legend>
        <div class="day-picks">${order.map((x) => `<label><input type="checkbox" name="days" value="${x}" ${has(v, "days", String(x)) ? "checked" : ""}> ${DOW_LONG[x].slice(0, 3)}</label>`).join("")}</div>${errOf(e, "days")}</fieldset>
      <div class="f" id="hours"><span>Quiet hours <span class="hint">Appointments that start from the first time and before the second get the offer</span></span>
        <div class="row wrap mt8" style="gap:10px;align-items:center"><select class="in" name="start" style="max-width:150px" aria-label="From"${inv(e, "hours")}>${times(val(v, "start"), 360, 1380)}</select> to
          <select class="in" name="end" style="max-width:150px" aria-label="Until"${inv(e, "hours")}>${times(val(v, "end"), 390, 1410)}</select></div>${errOf(e, "hours")}</div>
      <div class="grid g2"><label class="f" for="f-starts">Starts<input class="in" type="date" id="f-starts" name="starts_on" value="${val(v, "starts_on")}" min="${esc(d.today)}"${inv(e, "starts_on")}>${errOf(e, "starts_on")}</label>
        <label class="f" for="f-ends">Ends <span class="hint">Up to ${OFFER_RULES.maxDays / 30} months ahead</span><input class="in" type="date" id="f-ends" name="ends_on" value="${val(v, "ends_on")}" min="${esc(d.today)}"${inv(e, "ends_on")}>${errOf(e, "ends_on")}</label></div>
      <label class="f" for="f-cap">Places each month <span class="hint">How many discounted bookings you want a month. After that, times go back to the full price.</span><input class="in" id="f-cap" name="monthly_cap" inputmode="numeric" value="${val(v, "monthly_cap")}" style="max-width:120px"${inv(e, "monthly_cap")}>${errOf(e, "monthly_cap")}</label>
      <div class="row wrap" style="gap:10px"><button class="btn btn-p" type="submit">${d.id ? "Save changes" : "Turn on offer"}</button><a class="btn btn-o" href="/clinic/offers">Cancel</a></div>
      ${d.id ? `<p class="xs muted">Changes apply to new bookings only. Bookings already made keep their price.</p>` : ""}
    </form>
    <aside class="card tips"><b>Choosing your quiet hours</b><ul>
      <li>Look at your <a href="/clinic/calendar">calendar</a> for the hours that are usually empty, for example weekday afternoons.</li>
      <li>Keep busy times at the full price: an offer should move flexible clients, not discount everyone.</li>
      <li>₹150 to ₹300 off, or 10 to 20%, usually works. Bigger isn't always better.</li>
      <li>Start with one month and a limit you're comfortable with, then look at the bookings it brought on this page.</li>
    </ul></aside></div>`;
}
