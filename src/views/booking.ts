import { COMPANY, POLICY } from "../config";
import { fmtDate, fmtTime } from "../domain/time";
import type { ProviderDetail } from "../services/catalog";
import { isMedical } from "../services/catalog";
import type { BookingRow, PaymentRow } from "../services/bookings";
import { MED_NOTE, artBox, esc, ic, inr } from "./ui";

const STEPS = ["Service", "Practitioner", "Date & time", "Your details", "Deposit"];

/** The booking flow. The page carries the provider's services and team as JSON; /book.js drives the steps. */
export function bookPage(d: ProviderDetail, preselect: string | null, payments: { gateway: string }) {
  const p = d.provider;
  const data = {
    provider: { slug: p.slug, name: p.name, area: p.area, city: p.city },
    services: d.services.map((s) => ({ id: s.id, name: s.name, kind: s.kind, cat: s.cat, dur: s.dur_min, price: s.price_paise, deposit: s.deposit_paise, staff: s.staff })),
    staff: d.staff.map((t) => ({ id: t.id, name: t.name, role: t.role, medical: !!t.medical })),
    preselect, gateway: payments.gateway, freeCancelHours: POLICY.freeCancelHours, holdMinutes: POLICY.holdMinutes,
  };
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<div class="page">
    <a class="btn btn-g btn-s" href="/p/${esc(p.slug)}" style="margin-left:-10px">${ic("chevL", 16)} ${esc(p.name)}</a>
    <h1 class="sr">Book at ${esc(p.name)}</h1>
    <ol class="steps mt16" id="bk-steps" aria-label="Booking steps" style="list-style:none;padding:0;margin-left:0">${STEPS.map((n, i) => `<li class="st ${i === 0 ? "on" : ""}"><i>${i + 1}</i>${n}</li>`).join("")}</ol>
    <div class="flow">
      <div id="bk-main" aria-live="polite">
        <noscript><div class="note n-plain">${ic("info", 16)}<div>Booking needs JavaScript to show live availability and take the deposit. Please enable it, or call the venue directly.</div></div></noscript>
      </div>
      <aside class="sticky"><div class="card summary" id="bk-summary">${artBox(p.id, p.art, "", "aspect-ratio:16/8;border-radius:10px;margin:-6px -6px 14px")}<b class="serif" style="font-size:22px">${esc(p.name)}</b><div class="xs muted">${esc(p.area)}, ${esc(p.city)}</div><div class="divider"></div><p class="small muted">Select a service to see pricing.</p></div></aside>
    </div>
    <script type="application/json" id="bk-data">${json}</script>
    <template id="tpl-med">${MED_NOTE}</template>
  </div>`;
}

const STATUS: Record<string, string> = {
  held: '<span class="badge b-warn">Waiting for deposit</span>', confirmed: '<span class="badge b-blush">Confirmed</span>',
  completed: '<span class="badge b-ok">Completed</span>', cancelled: '<span class="badge b-plain">Cancelled</span>',
  no_show: '<span class="badge b-err">Missed</span>', expired: '<span class="badge b-plain">Not completed</span>',
};

export function managePage(d: {
  booking: BookingRow; provider: { slug: string; name: string; area: string; city: string; address: string; art: number; id: string };
  staff: { name: string; role: string }; client: { name: string; email: string }; payment: PaymentRow | null;
  token: string; terms: { hours: number; started: boolean; free: boolean }; message?: string; resume?: unknown;
}) {
  const b = d.booking, pay = d.payment;
  const paid = pay && (pay.status === "captured" || pay.status === "refunded" || pay.status === "partially_refunded") ? pay.amount_paise : 0;
  const hero = b.status === "confirmed"
    ? `<div class="confirm-hero"><div class="seal">${ic("check", 40)}</div><div class="eyebrow">Booking confirmed · ${esc(b.ref)}</div><h1 class="mt12" style="font-size:clamp(34px,5vw,52px)">See you on ${fmtDate(b.date)}.</h1><p class="muted mt12">Keep this page's link to view or cancel your booking. ${d.client.email ? `Your booking reference is ${esc(b.ref)}.` : ""}</p></div>`
    : `<div class="confirm-hero"><div class="eyebrow">Booking ${esc(b.ref)}</div><h1 class="mt12" style="font-size:clamp(32px,4.6vw,46px)">${b.status === "held" ? "Almost done" : b.status === "cancelled" ? "This booking is cancelled" : b.status === "expired" ? "This booking wasn't completed" : "Your appointment"}</h1><p class="mt12">${STATUS[b.status] ?? ""}</p></div>`;

  const refundLine = (() => {
    if (b.status !== "cancelled" || !pay) return "";
    if (pay.status === "refunded") return `<div class="form-ok mt16">Your ${inr(pay.amount_paise)} deposit has been refunded. Refunds usually reach your account in 5 to 7 working days.</div>`;
    return "";
  })();

  const held = b.status === "held" && d.resume ? `
    <div class="card mt16"><h2 style="font-size:24px">Pay the deposit to confirm</h2>
      <p class="small muted mt8">We're holding this time for you until ${b.hold_expires_at ? new Date(b.hold_expires_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "shortly"}.</p>
      <div id="resume-pay" class="mt16"></div>
      <script type="application/json" id="resume-data">${JSON.stringify(d.resume).replace(/</g, "\\u003c")}</script></div>` : "";

  const cancel = b.status === "confirmed" && !d.terms.started ? `
    <div class="card mt16"><h2 style="font-size:24px">Need to cancel?</h2>
      ${d.terms.free
        ? `<p class="small mt8">It's more than ${POLICY.freeCancelHours} hours before your appointment, so ${paid ? `your ${inr(paid)} deposit will be refunded in full` : "there's nothing to pay"}.</p>`
        : `<p class="small mt8">Your appointment is less than ${POLICY.freeCancelHours} hours away, so the ${inr(paid)} deposit is normally kept by the venue. If something serious came up, ask for a review and our team will look at it.</p>`}
      <form method="post" action="/booking/${esc(b.ref)}/cancel" class="col mt16" style="gap:12px">
        <input type="hidden" name="t" value="${esc(d.token)}">
        <label class="f">Reason <span class="hint">Optional</span><textarea class="in" name="reason" maxlength="300" rows="2"></textarea></label>
        ${!d.terms.free && paid ? `<label class="check"><input type="checkbox" name="review" value="1"> Ask the Aestheva team to review a refund</label>` : ""}
        <div><button class="btn btn-d" type="submit">Cancel this booking</button></div>
      </form></div>` : "";

  return `<div class="page narrow">
    ${d.message ? `<div class="form-ok" role="status">${esc(d.message)}</div>` : ""}
    ${hero}
    <div class="card">
      <div class="row" style="gap:16px;align-items:flex-start">${artBox(d.provider.id, d.provider.art, "", "width:84px;height:84px;border-radius:12px;flex-shrink:0")}
        <div class="grow col" style="gap:4px"><b class="serif" style="font-size:22px">${esc(b.service_name)}</b>
          <span class="small muted"><a href="/p/${esc(d.provider.slug)}">${esc(d.provider.name)}</a> · ${esc(d.provider.area)}</span>
          <span class="small">${ic("cal", 14)} ${fmtDate(b.date, true)} · ${fmtTime(b.start_min)} · ${b.dur_min} min</span>
          <span class="small">${ic("user", 14)} ${esc(d.staff.name)}, ${esc(d.staff.role)}</span>
          <span class="small">${ic("pin", 14)} ${esc(d.provider.address)}</span></div></div>
      <div class="divider"></div>
      <div class="summary"><div class="line"><span>Service price</span><span>${inr(b.price_paise)}</span></div>
        <div class="line"><span>Deposit ${paid ? "paid" : b.deposit_paise ? "due" : ""}</span><span>${inr(b.deposit_paise)}</span></div>
        <div class="line tot"><span>Pay at the venue</span><span>${inr(b.price_paise - b.deposit_paise)}</span></div></div>
      ${refundLine}
    </div>
    ${isMedical(b) ? `<div class="mt16">${MED_NOTE}</div>` : ""}
    ${held}
    ${cancel}
    <p class="xs muted mt24" style="text-align:center">Questions? ${COMPANY.supportEmail ? `Email <a href="mailto:${esc(COMPANY.supportEmail)}">${esc(COMPANY.supportEmail)}</a> with your reference ${esc(b.ref)}.` : `Contact us with your reference ${esc(b.ref)}.`} <a href="/policies/cancellation">Cancellation policy</a></p>
  </div>`;
}

