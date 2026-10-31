import { COMPANY, POLICY } from "../config";
import { fmtDate, fmtTime, istToUtc } from "../domain/time";
import type { ProviderDetail } from "../services/catalog";
import { isMedical } from "../services/catalog";
import type { BookingRow, PaymentRow } from "../services/bookings";
import type { publicOffers } from "../services/offers";

export type PublicOffer = ReturnType<typeof publicOffers>[number];
import { MED_NOTE, esc, ic, inr, mapsUrl, venueThumb } from "./ui";

const STEPS = ["Service", "Who", "Date & time", "Your details"];

/** The booking flow. The page carries the provider's services and team as JSON; /book.js drives the steps. */
export function bookPage(d: ProviderDetail, preselect: string | null, payments: { gateway: string; mode: string }, preview?: string, categories: { id: string; name: string }[] = [], welcome = 0, offers: PublicOffer[] = []) {
  const p = d.provider;
  // A venue that takes no deposits (for example before online payments are switched on) ends with "Confirm".
  const takesDeposits = d.services.some((s) => s.deposit_paise > 0);
  const steps = [...STEPS, takesDeposits ? "Deposit" : "Confirm"];
  const data = {
    provider: { slug: p.slug, name: p.name, area: p.area, city: p.city },
    services: d.services.map((s) => ({ id: s.id, name: s.name, kind: s.kind, cat: s.cat, dur: s.dur_min, price: s.price_paise, deposit: s.deposit_paise, staff: s.staff })),
    staff: d.staff.map((t) => ({ id: t.id, name: t.name, role: t.role, photo: t.photo || "", medical: !!t.medical, quals: (() => { try { return (JSON.parse(t.quals_json || "[]") as string[]).join(", "); } catch { return ""; } })() })),
    categories: categories.filter((c) => d.services.some((s) => s.cat === c.id)),
    preselect, gateway: payments.gateway, freeCancelHours: POLICY.freeCancelHours, holdMinutes: POLICY.holdMinutes, preview: preview ?? null, welcome,
    offers: offers.map((o) => ({ amount: o.amount, when: o.when, until: fmtDate(o.until), from: o.from ? fmtDate(o.from) : null, services: o.services.map((x) => x.id) })),
  };
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<div class="page">
    <a class="btn btn-g btn-s" href="/p/${esc(p.slug)}" style="margin-left:-10px">${ic("chevL", 16)} ${esc(p.name)}</a>
    <h1 class="sr">Book at ${esc(p.name)}</h1>
    ${p.status === "draft" ? `<div class="note n-plain mt12" role="status">${ic("info", 16)}<div><b>Preview.</b> This venue isn't public yet.</div></div>` : ""}
    ${payments.mode === "test" && takesDeposits ? `<div class="note n-plain mt12" role="status">${ic("info", 16)}<div><b>Payments are in test mode.</b> No real money is charged. In Razorpay's test checkout, use the UPI ID <b>success@razorpay</b> or a Razorpay test card.</div></div>` : ""}
    <ol class="steps mt16" id="bk-steps" aria-label="Booking steps" style="list-style:none;padding:0;margin-left:0">${steps.map((n, i) => `<li class="st ${i === 0 ? "on" : ""}"><i>${i + 1}</i>${n}</li>`).join("")}</ol>
    <div class="stepbar mt16" aria-hidden="true"><div class="row between xs"><b id="bk-steptxt">Step 1 of ${steps.length} · ${steps[0]}</b><span class="muted">${esc(p.name)}</span></div><div class="stepbar-track"><i id="bk-stepfill" style="width:${100 / steps.length}%"></i></div></div>
    <div class="flow">
      <div id="bk-main" aria-live="polite">
        <noscript><div class="note n-plain">${ic("info", 16)}<div>Booking needs JavaScript to show live availability${takesDeposits ? " and take the deposit" : ""}. Please enable it, or call the venue directly.</div></div></noscript>
      </div>
      <aside class="sticky"><div class="card summary" id="bk-summary"><div class="row" style="gap:12px">${venueThumb(p, "s")}<div class="col" style="gap:0"><b class="serif" style="font-size:21px">${esc(p.name)}</b><span class="xs muted">${esc(p.area)}, ${esc(p.city)}</span></div></div><div class="divider"></div><p class="small muted">Choose a service to see the price.</p></div></aside>
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
  booking: BookingRow; provider: { slug: string; name: string; area: string; city: string; address: string; art: number; id: string; photos_json?: string };
  staff: { name: string; role: string }; client: { name: string; email: string }; payment: PaymentRow | null;
  token: string; terms: { hours: number; started: boolean; free: boolean }; message?: string; resume?: unknown;
}) {
  const b = d.booking, pay = d.payment;
  const start = istToUtc(b.date, b.start_min), end = new Date(start.getTime() + b.dur_min * 6e4);
  const gcal = (t: Date) => t.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const calUrl = "https://calendar.google.com/calendar/render?" + new URLSearchParams({ action: "TEMPLATE", text: `${b.service_name} · ${d.provider.name}`, dates: `${gcal(start)}/${gcal(end)}`, details: `With ${d.staff.name}. Booking ${b.ref}, booked on Aestheva.`, location: `${d.provider.name}, ${d.provider.address}` }).toString().replace(/&/g, "&amp;");
  const freeUntil = new Date(start.getTime() - POLICY.freeCancelHours * 36e5).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
  const paid = pay && (pay.status === "captured" || pay.status === "refunded" || pay.status === "partially_refunded") ? pay.amount_paise : 0;
  const hero = b.status === "confirmed"
    ? `<div class="confirm-hero"><div class="seal">${ic("check", 40)}</div><div class="eyebrow">Booking confirmed · ${esc(b.ref)}</div><h1 class="mt12" style="font-size:clamp(34px,5vw,52px)">See you on ${fmtDate(b.date)}.</h1><p class="lede mt12">${fmtTime(b.start_min)} with ${esc(d.staff.name)} at ${esc(d.provider.name)}.</p><p class="small muted mt8">Bookmark this page or save its link: it's how you view or cancel your booking.</p>
      <div class="row wrap mt24" style="justify-content:center;gap:10px"><a class="btn btn-o btn-s" href="${calUrl}" target="_blank" rel="noopener">${ic("cal", 15)} Add to Google Calendar</a><a class="btn btn-o btn-s" href="${mapsUrl(`${d.provider.name}, ${d.provider.address}`)}" target="_blank" rel="noopener">${ic("nav", 15)} Get directions</a></div></div>`
    : `<div class="confirm-hero"><div class="eyebrow">Booking ${esc(b.ref)}</div><h1 class="mt12" style="font-size:clamp(32px,4.6vw,46px)">${b.status === "held" ? "Almost done" : b.status === "cancelled" ? "This booking is cancelled" : b.status === "expired" ? "This booking wasn't completed" : "Your appointment"}</h1><p class="mt12">${STATUS[b.status] ?? ""}</p></div>`;

  const ended = b.status === "cancelled" || b.status === "expired";
  const refunded = !!pay && (pay.status === "refunded" || pay.status === "partially_refunded");
  const refundLine = (() => {
    if (b.status !== "cancelled" || !pay) return "";
    if (refunded) return `<div class="form-ok mt16">A refund of ${inr(pay.amount_paise)} has been issued to your original payment method. Refunds usually reach your account within 5 to 7 working days.</div>`;
    if (paid) return `<p class="small muted mt16">The ${inr(paid)} deposit was kept under the <a href="/policies/cancellation">cancellation policy</a>. If you asked for a review, we'll email you the outcome.</p>`;
    return "";
  })();
  // A cancelled or lapsed booking owes nothing at the venue; say what happened to the deposit instead.
  const summary = ended
    ? `<div class="line"><span>Service price</span><span>${inr(b.price_paise)}</span></div>
        ${paid ? `<div class="line"><span>Deposit paid</span><span>${inr(paid)}</span></div>` : ""}
        ${refunded ? `<div class="line"><span>Deposit refunded</span><span>−${inr(pay!.amount_paise)}</span></div>` : ""}
        <div class="line tot"><span>Nothing to pay at the venue</span><span>${inr(0)}</span></div>`
    : `${b.offer_paise ? `<div class="line"><span>Full price</span><span>${inr(b.price_paise + b.offer_paise)}</span></div>
        <div class="line small" style="color:var(--offer)"><span>Quiet-hour offer from ${esc(d.provider.name)}</span><span>−${inr(b.offer_paise)}</span></div>
        <div class="line"><span>Your price</span><span>${inr(b.price_paise)}</span></div>` : `<div class="line"><span>Service price</span><span>${inr(b.price_paise)}</span></div>`}
        ${b.deposit_paise ? `<div class="line"><span>Deposit ${paid ? "paid" : "due"}</span><span>${inr(b.deposit_paise)}</span></div>` : ""}
        ${b.credit_paise ? `<div class="line small" style="color:var(--sage-d)"><span>Welcome offer, paid by Aestheva</span><span>−${inr(b.credit_paise)}</span></div><div class="line small muted"><span>You ${paid ? "paid" : "pay"} online</span><span>${inr(b.deposit_paise - b.credit_paise)}</span></div>` : ""}
        <div class="line tot"><span>Pay on the day</span><span>${inr(b.price_paise - b.deposit_paise)}</span></div>`;

  const held = b.status === "held" && d.resume ? `
    <div class="card mt16"><h2 style="font-size:24px">Pay the deposit to confirm</h2>
      <p class="small muted mt8">We're holding this time for you until ${b.hold_expires_at ? new Date(b.hold_expires_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "shortly"}.</p>
      <div id="resume-pay" class="mt16"></div>
      <script type="application/json" id="resume-data">${JSON.stringify(d.resume).replace(/</g, "\\u003c")}</script></div>` : "";

  const cancel = b.status === "confirmed" && !d.terms.started ? `
    <div class="card mt16"><h2 style="font-size:24px">Need to cancel?</h2>
      ${d.terms.free
        ? `<p class="small mt8">It's more than ${POLICY.freeCancelHours} hours before your appointment, so ${paid ? `your ${inr(paid)} deposit will be refunded in full` : "there's nothing to pay"}.</p>`
        : paid ? `<p class="small mt8">Your appointment is less than ${POLICY.freeCancelHours} hours away, so the ${inr(paid)} deposit is normally kept by the venue. If something serious came up, ask for a review and our team will look at it.</p>`
        : `<p class="small mt8">There's nothing to pay. Please cancel here if you can't come, so someone else can have the time.</p>`}
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
      <div class="row" style="gap:16px;align-items:flex-start">${venueThumb(d.provider, "m")}
        <div class="grow col" style="gap:4px"><b class="serif" style="font-size:22px">${esc(b.service_name)}</b>
          <span class="small muted"><a href="/p/${esc(d.provider.slug)}">${esc(d.provider.name)}</a> · ${esc(d.provider.area)}</span>
          <span class="small">${ic("cal", 14)} ${fmtDate(b.date, true)} · ${fmtTime(b.start_min)} · ${b.dur_min} min</span>
          <span class="small">${ic("user", 14)} ${esc(d.staff.name)}, ${esc(d.staff.role)}</span>
          <span class="small">${ic("pin", 14)} ${esc(d.provider.address)}</span></div></div>
      <div class="divider"></div>
      <div class="summary">${summary}</div>
      ${refundLine}
    </div>
    ${b.status === "confirmed" ? `<div class="card mt16"><h2 style="font-size:24px">Before you go</h2><ul class="ticks mt12">
      <li>${ic("clock", 15)} Arrive about 10 minutes early, so there's time to settle in.</li>
      ${b.price_paise - b.deposit_paise > 0 ? `<li>${ic("wallet", 15)} Pay the remaining ${inr(b.price_paise - b.deposit_paise)} on the day.</li>` : ""}
      ${isMedical(b) ? `<li>${ic("shield", 15)} Tell your practitioner about any medicines you take or allergies you have.</li>` : ""}
      ${b.deposit_paise ? (d.terms.free ? `<li>${ic("cal", 15)} Plans changed? Cancel on this page; it's free until ${esc(freeUntil)}.</li>` : "")
        : `<li>${ic("cal", 15)} Plans changed? Please cancel on this page, so someone else can have the time.</li>`}
    </ul></div>` : ""}
    ${isMedical(b) ? `<div class="mt16">${MED_NOTE}</div>` : ""}
    ${held}
    ${cancel}
    <p class="xs muted mt24" style="text-align:center">Questions? ${COMPANY.supportEmail ? `Email <a href="mailto:${esc(COMPANY.supportEmail)}">${esc(COMPANY.supportEmail)}</a> with your reference ${esc(b.ref)}.` : `Contact us with your reference ${esc(b.ref)}.`} <a href="/policies/cancellation">Cancellation policy</a></p>
  </div>`;
}

