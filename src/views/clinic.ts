import { COMPANY, POLICY } from "../config";
import { addDays, fmtDate, fmtTime, relDay } from "../domain/time";
import type { Appt, ClinicUser } from "../services/clinic";
import type { ServiceRow, StaffRow } from "../services/catalog";
import { avatar, esc, ic, inr } from "./ui";

export type Section = "setup" | "today" | "calendar" | "bookings" | "clients" | "services" | "payments" | "new";
const NAV: [Section, string, string, string][] = [
  ["setup", "/clinic/setup", "edit", "Your listing"],
  ["today", "/clinic", "home", "Today"], ["calendar", "/clinic/calendar", "cal", "Calendar"], ["bookings", "/clinic/bookings", "list", "Bookings"],
  ["clients", "/clinic/clients", "users", "Clients"], ["services", "/clinic/services", "grid", "Services & hours"], ["payments", "/clinic/payments", "wallet", "Payments"],
];
const STATUS: Record<string, [string, string]> = {
  held: ["b-warn", "Awaiting deposit"], confirmed: ["b-blush", "Confirmed"], completed: ["b-ok", "Completed"], no_show: ["b-err", "No-show"],
  cancelled: ["b-plain", "Cancelled"], expired: ["b-plain", "Not completed"],
};
export const statusBadge = (s: string) => `<span class="badge ${STATUS[s]?.[0] ?? "b-plain"}">${STATUS[s]?.[1] ?? esc(s)}</span>`;
/** +919847100005 → +91 98471 00005 */
export const fmtPhone = (p: string) => /^\+91\d{10}$/.test(p) ? `+91 ${p.slice(3, 8)} ${p.slice(8)}` : p;
const wa = (phone: string, text = "") => `https://wa.me/${phone.replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
const timeOpts = (from: number, to: number, sel?: number) => Array.from({ length: (to - from) / 30 + 1 }, (_, i) => from + i * 30).map((m) => `<option value="${m}" ${m === sel ? "selected" : ""}>${fmtTime(m)}</option>`).join("");

/** The signed-in frame: side navigation on wide screens, a scrolling tab row on phones. */
export function clinicShell(d: { user: ClinicUser; providerName: string; section: Section; csrf: string }, body: string) {
  const items = NAV.map(([k, href, icon, label]) => `<a class="nav ${d.section === k ? "on" : ""}" href="${href}"${d.section === k ? ' aria-current="page"' : ""}>${ic(icon, 18)} ${label}</a>`).join("");
  return `<div class="ws">
    <aside class="side" aria-label="Clinic">
      <div class="who">${avatar(d.providerName, 40, d.user.provider_id)}<div class="col" style="gap:0;min-width:0"><b style="font-size:14px">${esc(d.providerName)}</b><span class="xs muted">${esc(d.user.name)}</span></div></div>
      <a class="btn btn-p btn-s" href="/clinic/new" style="margin:0 8px 12px">${ic("plus", 15)} Add a booking</a>
      <nav class="col" style="gap:2px">${items}</nav>
    </aside>
    <nav class="mob-nav" aria-label="Clinic">${NAV.map(([k, href, , label]) => `<a class="${d.section === k ? "on" : ""}" href="${href}">${label}</a>`).join("")}<a href="/clinic/new">+ Add</a></nav>
    <div class="ws-main">${body}</div>
  </div>`;
}
export const signOutButton = (csrf: string, name: string) => `<span class="small muted hide-s">${esc(name)}</span><form method="post" action="/clinic/logout" style="display:inline"><input type="hidden" name="csrf" value="${esc(csrf)}"><button class="btn btn-g btn-s" type="submit">${ic("out", 15)} Sign out</button></form>`;

export function clinicLoginPage(error = "", configured = true, notice = "") {
  return `<div class="page narrow" style="max-width:460px;padding-top:56px">
    <div class="card"><div class="eyebrow">Aestheva for clinics</div><h1 class="mt8" style="font-size:34px">Sign in</h1>
    <p class="small muted mt8">For clinic teams listed on Aestheva. Your login comes from the Aestheva team.</p>
    ${notice ? `<div class="form-ok mt12" role="status">${esc(notice)}</div>` : ""}
    ${configured ? `<form method="post" action="/clinic/login" class="col mt16" style="gap:12px">
      <label class="f" for="cl-email">Email<input class="in" id="cl-email" name="email" type="email" autocomplete="username" required autofocus></label>
      <label class="f" for="cl-pw">Password<input class="in" id="cl-pw" name="password" type="password" autocomplete="current-password" required></label>
      ${error ? `<div class="form-error" role="alert">${esc(error)}</div>` : ""}
      <button class="btn btn-p" type="submit">Sign in</button></form>
      <p class="small mt16"><a href="/clinic/forgot">Forgot your password?</a></p>`
    : `<p class="small muted mt12">Clinic sign-in isn't switched on yet.</p>`}
    </div></div>`;
}

export function setPasswordPage(d: { token: string; email: string; venue: string; invite: boolean; error?: string }) {
  return `<div class="page narrow" style="max-width:480px;padding-top:56px"><div class="card">
    <div class="eyebrow">${esc(d.venue)}</div><h1 class="mt8" style="font-size:32px">${d.invite ? "Set your password" : "Choose a new password"}</h1>
    <p class="small muted mt8">For <b>${esc(d.email)}</b>. Use at least 10 characters; a short phrase only you would think of is easy to remember and hard to guess.</p>
    <form method="post" action="/clinic/set-password" class="col mt16" style="gap:12px">
      <input type="hidden" name="t" value="${esc(d.token)}">
      <input type="text" name="username" value="${esc(d.email)}" autocomplete="username" hidden>
      <label class="f" for="pw1">New password<input class="in" id="pw1" name="password" type="password" autocomplete="new-password" minlength="10" required autofocus></label>
      <label class="f" for="pw2">Type it again<input class="in" id="pw2" name="confirm" type="password" autocomplete="new-password" minlength="10" required></label>
      ${d.error ? `<div class="form-error" role="alert">${esc(d.error)}</div>` : ""}
      <button class="btn btn-p" type="submit">Save password</button>
    </form></div></div>`;
}
export function linkInvalidPage() {
  return `<div class="page narrow" style="max-width:480px;padding-top:56px"><div class="card"><div class="eyebrow">Aestheva for clinics</div><h1 class="mt8" style="font-size:30px">This link has expired</h1>
    <p class="small muted mt8">Set-password links work once, for a limited time. You can ask for a new one below, or ask the Aestheva team to send a fresh invitation.</p>
    <div class="row wrap mt16" style="gap:8px"><a class="btn btn-p btn-s" href="/clinic/forgot">Email me a new link</a><a class="btn btn-o btn-s" href="/clinic/login">Sign in</a></div></div></div>`;
}
export function forgotPage(sent = false) {
  return `<div class="page narrow" style="max-width:460px;padding-top:56px"><div class="card"><div class="eyebrow">Aestheva for clinics</div><h1 class="mt8" style="font-size:32px">Forgot your password?</h1>
    ${sent ? `<div class="form-ok mt12" role="status">If that email has a clinic login, we've sent it a link to choose a new password. It works for 1 hour. Check spam if it isn't there in a few minutes.</div><p class="small mt16"><a href="/clinic/login">Back to sign in</a></p>`
    : `<p class="small muted mt8">Enter your login email and we'll send you a link to choose a new password.</p>
      <form method="post" action="/clinic/forgot" class="col mt16" style="gap:12px"><label class="f" for="fe">Email<input class="in" id="fe" name="email" type="email" autocomplete="username" required autofocus></label><button class="btn btn-p" type="submit">Email me a link</button></form>
      <p class="small mt16"><a href="/clinic/login">Back to sign in</a></p>`}</div></div>`;
}

const apptRow = (a: Appt, today: string, showDate = false) => `<a class="appt-row" href="/clinic/bookings/${esc(a.ref)}">
  <span class="appt-time"><b>${fmtTime(a.start_min)}</b>${showDate ? `<span class="xs muted">${relDay(a.date, today)}</span>` : `<span class="xs muted">${a.dur_min} min</span>`}</span>
  <span class="grow col" style="gap:1px;min-width:0"><b>${esc(a.client_name)}</b><span class="small muted">${esc(a.service_name)} · ${esc(a.staff_name)}</span></span>
  <span class="col" style="gap:4px;align-items:flex-end">${statusBadge(a.status)}${a.source === "direct" ? '<span class="xs soft">Booked by clinic</span>' : a.pay_status === "captured" ? `<span class="xs" style="color:var(--ok)">Deposit ${inr(a.deposit_paise)} paid</span>` : ""}</span>
</a>`;

export function todayPage(o: { providerName: string; now: { date: string; min: number }; today: Appt[]; upcoming: Appt[]; newThisWeek: number; weekCount: number; depositsThisMonth: number }) {
  const h = Math.floor(o.now.min / 60);
  const active = o.today.filter((a) => a.status !== "cancelled");
  const next = active.find((a) => a.status === "confirmed" && a.start_min + a.dur_min > o.now.min);
  const kpi = (l: string, v: string, d: string, feature = false) => `<div class="kpi${feature ? " feature" : ""}"><div class="l">${l}</div><div class="v">${v}</div><div class="d">${d}</div></div>`;
  return `<div class="ws-head"><div><div class="eyebrow">${fmtDate(o.now.date, true)}</div><h2 class="mt8">Good ${h < 12 ? "morning" : h < 17 ? "afternoon" : "evening"}, ${esc(o.providerName)}</h2></div><a class="btn btn-p btn-s" href="/clinic/new">${ic("plus", 15)} Add a booking</a></div>
    <div class="grid g4 kpis">
      ${kpi("Today", String(active.length), next ? `Next: ${fmtTime(next.start_min)}, ${esc(next.client_name)}` : active.length ? "All done for today" : "Nothing booked yet", true)}
      ${kpi("Next 7 days", String(o.weekCount), "confirmed appointments")}
      ${kpi("New this week", String(o.newThisWeek), "bookings made in the last 7 days")}
      ${kpi("Deposits this month", inr(o.depositsThisMonth), "paid online by clients")}
    </div>
    <div class="grid g2 mt24" style="align-items:start">
      <section class="card"><div class="row between"><h3 style="font-size:22px">Today's appointments</h3><a class="small" href="/clinic/calendar">Calendar</a></div>
        <div class="mt12">${active.length ? active.map((a) => apptRow(a, o.now.date)).join("") : `<p class="muted small mt8">No appointments today. Phone and walk-in bookings you add appear here too.</p>`}</div></section>
      <section class="card"><div class="row between"><h3 style="font-size:22px">Coming up</h3><a class="small" href="/clinic/bookings">All bookings</a></div>
        <div class="mt12">${o.upcoming.length ? o.upcoming.map((a) => apptRow(a, o.now.date, true)).join("") : `<p class="muted small mt8">Nothing booked for the next 7 days yet.</p>`}</div></section>
    </div>`;
}

export function calendarPage(d: { date: string; today: string; nowMin: number; staff: StaffRow[]; rota: Map<string, { start_min: number; end_min: number }>; appts: Appt[]; blocks: { id: string; staff_id: string; start_min: number; end_min: number; reason: string }[]; csrf: string; error?: string; saved?: string }) {
  const ROW = 40;
  const mins = [9 * 60, 20 * 60, ...[...d.rota.values()].flatMap((r) => [r.start_min, r.end_min]), ...d.appts.flatMap((a) => [a.start_min, a.start_min + a.dur_min]), ...d.blocks.flatMap((b) => [b.start_min, b.end_min])];
  const from = Math.floor(Math.min(...mins) / 60) * 60, to = Math.ceil(Math.max(...mins) / 60) * 60;
  const rows = (to - from) / 30, y = (m: number) => ((m - from) / 30) * ROW;
  const col = (t: StaffRow) => {
    const r = d.rota.get(t.id);
    const slots = Array.from({ length: rows }, (_, i) => from + i * 30).map((m) => `<a class="cal2-slot" style="top:${y(m)}px;height:${ROW}px" href="/clinic/new?date=${d.date}&amp;staff=${esc(t.id)}&amp;start=${m}" aria-label="Book ${esc(t.name)} at ${fmtTime(m)}"><span>+ ${fmtTime(m)}</span></a>`).join("");
    const appts = d.appts.filter((a) => a.staff_id === t.id).map((a) => `<a class="cal2-appt s-${a.status}" style="top:${y(a.start_min) + 1}px;height:${Math.max(ROW - 2, y(a.start_min + a.dur_min) - y(a.start_min) - 2)}px" href="/clinic/bookings/${esc(a.ref)}"><b>${fmtTime(a.start_min)} ${esc(a.client_name)}</b><span>${esc(a.service_name)}</span></a>`).join("");
    const blocks = d.blocks.filter((b) => b.staff_id === t.id).map((b) => `<div class="cal2-block" style="top:${y(b.start_min) + 1}px;height:${y(b.end_min) - y(b.start_min) - 2}px"><b>${esc(b.reason || "Unavailable")}</b><span>${fmtTime(b.start_min)}–${fmtTime(b.end_min)}</span>
      <form method="post" action="/clinic/blocks/${esc(b.id)}/delete"><input type="hidden" name="csrf" value="${esc(d.csrf)}"><input type="hidden" name="date" value="${d.date}"><button type="submit" class="linkish">Remove</button></form></div>`).join("");
    return `<div class="cal2-col"><div class="cal2-head">${avatar(t.name, 28, t.id)}<div class="col" style="gap:0;min-width:0"><b>${esc(t.name)}</b><span class="xs muted">${r ? `Online ${fmtTime(r.start_min)}–${fmtTime(r.end_min)}` : "No online hours today"}</span></div></div>
      <div class="cal2-body" style="height:${rows * ROW}px">${r ? `<div class="cal2-on" style="top:${y(r.start_min)}px;height:${y(r.end_min) - y(r.start_min)}px"></div>` : ""}${slots}${blocks}${appts}</div></div>`;
  };
  const isToday = d.date === d.today;
  return `<div class="ws-head"><div><div class="eyebrow">Calendar</div><h2 class="mt8">${relDay(d.date, d.today) === "Today" ? "Today, " : ""}${fmtDate(d.date, true)}</h2></div>
      <div class="row wrap" style="gap:8px"><a class="btn btn-o btn-s" href="/clinic/calendar?date=${addDays(d.date, -1)}" aria-label="Previous day">${ic("chevL", 15)}</a>${isToday ? "" : `<a class="btn btn-o btn-s" href="/clinic/calendar">Today</a>`}<a class="btn btn-o btn-s" href="/clinic/calendar?date=${addDays(d.date, 1)}" aria-label="Next day">${ic("chevR", 15)}</a>
      <form method="get" action="/clinic/calendar" class="row" style="gap:6px"><label class="sr" for="cal-date">Go to date</label><input class="in" id="cal-date" type="date" name="date" value="${d.date}" style="width:auto;padding:6px 10px" onchange="this.form.submit()"></form></div></div>
    ${d.error ? `<div class="form-error" role="alert">${esc(d.error)}</div>` : ""}${d.saved ? `<div class="form-ok" role="status">${esc(d.saved)}</div>` : ""}
    <div class="legend mt12"><span><i style="background:#fff;border:1px solid var(--line-2)"></i>Online booking hours</span><span><i style="background:var(--mulberry-l)"></i>Booked</span><span><i style="background:#EEE9EB"></i>Unavailable</span><span>Tap an empty time to add a booking, even outside online hours.</span></div>
    <div class="cal2 mt12"><div class="cal2-grid" style="grid-template-columns:56px repeat(${d.staff.length},minmax(170px,1fr))">
      <div class="cal2-times"><div class="cal2-head"></div><div class="cal2-body" style="height:${rows * ROW}px">${Array.from({ length: rows / 2 }, (_, i) => `<span style="top:${i * ROW * 2}px">${fmtTime(from + i * 60)}</span>`).join("")}${isToday && d.nowMin > from && d.nowMin < to ? `<i class="cal2-now" style="top:${y(d.nowMin)}px"></i>` : ""}</div></div>
      ${d.staff.map(col).join("")}
    </div></div>
    <details class="card mt24"><summary><b>Block time</b> <span class="small muted">for leave, a break or anything else that should stop online bookings</span></summary>
      <form method="post" action="/clinic/blocks" class="grid g4 mt16" style="align-items:end">
        <input type="hidden" name="csrf" value="${esc(d.csrf)}"><input type="hidden" name="date" value="${d.date}">
        <label class="f">Practitioner<select class="in" name="staff">${d.staff.map((t) => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join("")}</select></label>
        <label class="f">From<select class="in" name="start">${timeOpts(6 * 60, 22 * 60 + 30, 13 * 60)}</select></label>
        <label class="f">To<select class="in" name="end">${timeOpts(6 * 60 + 30, 23 * 60, 14 * 60)}</select></label>
        <label class="f">Reason <span class="hint">Optional</span><input class="in" name="reason" maxlength="80" placeholder="e.g. Leave"></label>
        <div><button class="btn btn-o btn-s" type="submit">Block ${fmtDate(d.date)}</button></div>
      </form></details>`;
}

export function bookingsPage(d: { list: Appt[]; view: string; q: string; today: string }) {
  const tab = (v: string, label: string) => `<a class="chip ${d.view === v ? "on" : ""}" href="/clinic/bookings?view=${v}${d.q ? "&amp;q=" + encodeURIComponent(d.q) : ""}">${label}</a>`;
  return `<div class="ws-head"><div><div class="eyebrow">Bookings</div><h2 class="mt8">${d.view === "past" ? "Past appointments" : d.view === "cancelled" ? "Cancelled" : "Upcoming"}</h2></div><a class="btn btn-p btn-s" href="/clinic/new">${ic("plus", 15)} Add a booking</a></div>
    <div class="row wrap between" style="gap:12px"><div class="chips">${tab("upcoming", "Upcoming")}${tab("past", "Past")}${tab("cancelled", "Cancelled")}</div>
      <form method="get" action="/clinic/bookings" class="row" style="gap:8px"><input type="hidden" name="view" value="${esc(d.view)}"><label class="sr" for="bq">Search</label><input class="in" id="bq" name="q" value="${esc(d.q)}" placeholder="Name, mobile or AE- reference" style="min-width:240px"><button class="btn btn-o btn-s" type="submit">Search</button></form></div>
    ${d.list.length ? `<div class="card mt16 only-s">${d.list.map((a) => apptRow(a, d.today, true)).join("")}</div><div class="tbl-wrap mt16 hide-s"><table class="tbl"><thead><tr><th>When</th><th>Client</th><th>Treatment</th><th>Practitioner</th><th>Status</th></tr></thead><tbody>
      ${d.list.map((a) => `<tr class="click"><td style="white-space:nowrap"><a href="/clinic/bookings/${esc(a.ref)}"><b>${relDay(a.date, d.today)}</b></a><div class="xs muted">${fmtTime(a.start_min)}</div></td><td>${esc(a.client_name)}<div class="xs muted">${esc(fmtPhone(a.client_phone))}</div></td><td class="small">${esc(a.service_name)}${a.source === "direct" ? '<div class="xs soft">Booked by clinic</div>' : ""}</td><td class="small">${esc(a.staff_name)}</td><td>${statusBadge(a.status)}</td></tr>`).join("")}
    </tbody></table></div>` : `<div class="card mt16" style="text-align:center;padding:40px"><p class="muted">${d.q ? "No bookings match that search." : d.view === "upcoming" ? "No upcoming bookings yet." : "Nothing here yet."}</p></div>`}`;
}

export function bookingDetailPage(d: { a: Appt; b: { status: string; date: string; start_min: number; cancel_reason: string | null; cancelled_by: string | null; created_at: string; source: string }; payment: { status: string; amount_paise: number; method: string | null } | null; refunds: { amount_paise: number; status: string; reason: string }[]; client: { name: string; phone: string; email: string }; csrf: string; canMark: boolean; message?: string; error?: string; siteName: string }) {
  const { a } = d;
  const paid = d.payment && d.payment.status !== "created" ? d.payment.amount_paise : 0;
  const refunded = d.refunds.filter((r) => r.status !== "failed").reduce((x, r) => x + r.amount_paise, 0);
  const balance = a.price_paise - (paid - refunded);
  const remind = `Hello ${d.client.name.split(" ")[0]}, a reminder of your ${a.service_name} at ${d.siteName} on ${fmtDate(a.date)} at ${fmtTime(a.start_min)} with ${a.staff_name}. Booking ${a.ref}.`;
  const actionable = a.status === "confirmed" || a.status === "held";
  const upcoming = actionable && !d.canMark;
  return `<a class="btn btn-g btn-s" href="/clinic/bookings" style="margin-left:-10px">${ic("chevL", 16)} Bookings</a>
    ${d.message ? `<div class="form-ok mt12" role="status">${esc(d.message)}</div>` : ""}${d.error ? `<div class="form-error mt12" role="alert">${esc(d.error)}</div>` : ""}
    <div class="row wrap between mt12"><div><div class="eyebrow">${esc(a.ref)}${a.source === "direct" ? " · booked by clinic" : " · booked on Aestheva"}</div><h2 class="mt8" style="font-size:clamp(28px,3vw,36px)">${esc(a.service_name)}</h2></div>${statusBadge(a.status)}</div>
    <div class="apply-layout mt16">
      <div class="col" style="gap:16px">
        <div class="card"><dl class="kv">
          <dt>When</dt><dd>${fmtDate(a.date, true)}, ${fmtTime(a.start_min)} to ${fmtTime(a.start_min + a.dur_min)}</dd>
          <dt>With</dt><dd>${esc(a.staff_name)}</dd>
          <dt>Price</dt><dd>${inr(a.price_paise)}</dd>
          <dt>Deposit</dt><dd>${paid ? `${inr(paid)} paid online${d.payment?.method ? ` (${esc(d.payment.method)})` : ""}${refunded ? ` · ${inr(refunded)} refunded` : ""}` : a.status === "held" ? "Waiting for the client to pay" : "None"}</dd>
          ${a.status === "confirmed" || a.status === "completed" ? `<dt>To collect</dt><dd><b>${inr(Math.max(0, balance))}</b> at the clinic</dd>` : ""}
          ${a.client_note ? `<dt>Client's note</dt><dd>${esc(a.client_note)}</dd>` : ""}
          ${d.b.cancel_reason && a.status === "cancelled" ? `<dt>Cancelled</dt><dd>By ${esc(d.b.cancelled_by === "provider" ? "the clinic" : d.b.cancelled_by ?? "")}: ${esc(d.b.cancel_reason)}</dd>` : ""}
        </dl></div>
        ${actionable ? `<div class="card"><h3 style="font-size:22px">After the appointment</h3>
          ${d.canMark ? `<div class="row wrap mt12" style="gap:8px">
            <form method="post" action="/clinic/bookings/${esc(a.ref)}"><input type="hidden" name="csrf" value="${esc(d.csrf)}"><input type="hidden" name="action" value="completed"><button class="btn btn-ok btn-s" type="submit">${ic("check", 15)} Mark completed</button></form>
            <form method="post" action="/clinic/bookings/${esc(a.ref)}"><input type="hidden" name="csrf" value="${esc(d.csrf)}"><input type="hidden" name="action" value="no_show"><button class="btn btn-o btn-s" type="submit">Client didn't come</button></form></div>
            <p class="xs muted mt8">A no-show keeps any deposit, as the cancellation policy says.</p>`
          : `<p class="small muted mt8">You can mark it completed or as a no-show once the appointment time has come.</p>`}</div>
        <details class="card"><summary><b>Cancel this booking</b> <span class="small muted">${paid ? `the ${inr(paid)} deposit is refunded in full` : "no payment to refund"}</span></summary>
          <form method="post" action="/clinic/bookings/${esc(a.ref)}" class="col mt12" style="gap:10px"><input type="hidden" name="csrf" value="${esc(d.csrf)}"><input type="hidden" name="action" value="cancel">
            <label class="f">Reason <span class="hint">Kept with the booking</span><input class="in" name="reason" required maxlength="300" placeholder="e.g. Doctor unwell"></label>
            <p class="xs muted">When the clinic cancels, any deposit goes back to the client in full. Please also call or message them.</p>
            <div><button class="btn btn-d btn-s" type="submit">Cancel booking</button></div></form></details>` : ""}
      </div>
      <aside class="col" style="gap:16px">
        <div class="card"><h3 style="font-size:22px">Client</h3><p class="mt8"><b>${esc(d.client.name)}</b></p>
          <div class="col mt8" style="gap:8px"><a class="btn btn-o btn-s" href="tel:${esc(d.client.phone)}">${ic("phone", 15)} ${esc(fmtPhone(d.client.phone))}</a>
          <a class="btn btn-o btn-s" href="${wa(d.client.phone, upcoming ? remind : "")}" target="_blank" rel="noopener">${ic("chat", 15)} WhatsApp${upcoming ? " a reminder" : ""}</a>
          ${d.client.email ? `<a class="btn btn-o btn-s" href="mailto:${esc(d.client.email)}">${ic("mail", 15)} Email</a>` : ""}
          <a class="small mt8" href="/clinic/clients/${esc(a.client_id)}">See their history</a></div></div>
      </aside>
    </div>`;
}

export function newBookingPage(d: { services: (ServiceRow & { staff: string[] })[]; staff: StaffRow[]; v: Record<string, string>; error?: string; today: string }) {
  const v = d.v, start = Number(v.start || 600);
  return `<div class="ws-head"><div><div class="eyebrow">Phone, walk-in or Sunday</div><h2 class="mt8">Add a booking</h2></div></div>
    <p class="small muted" style="max-width:640px">Bookings you add here can be at any time, including outside online hours. They take no deposit and no Aestheva commission, and they hold the practitioner's time so online clients can't take it.</p>
    ${d.error ? `<div class="form-error mt16" role="alert">${esc(d.error)}</div>` : ""}
    <form method="post" action="/clinic/new" class="card col mt16" style="gap:16px;max-width:760px">
      <input type="hidden" name="csrf" value="${esc(v.csrf ?? "")}">
      <label class="f">Treatment<select class="in" name="service" required><option value="">Choose a treatment</option>${d.services.map((s) => `<option value="${esc(s.id)}" ${v.service === s.id ? "selected" : ""}>${esc(s.name)} · ${s.dur_min} min · ${inr(s.price_paise)}</option>`).join("")}</select></label>
      <div class="grid g3"><label class="f">Practitioner<select class="in" name="staff" required>${d.staff.map((t) => `<option value="${esc(t.id)}" ${v.staff === t.id ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select></label>
        <label class="f">Date<input class="in" type="date" name="date" min="${d.today}" value="${esc(v.date || d.today)}" required></label>
        <label class="f">Time<select class="in" name="start">${timeOpts(6 * 60, 22 * 60 + 30, start)}</select></label></div>
      <div class="grid g2"><label class="f">Client's name<input class="in" name="name" required maxlength="80" value="${esc(v.name ?? "")}" autocomplete="off"></label>
        <label class="f">Mobile number<input class="in" name="phone" required type="tel" inputmode="tel" placeholder="98765 43210" value="${esc(v.phone ?? "")}" autocomplete="off"></label></div>
      <label class="f">Email <span class="hint">Optional</span><input class="in" name="email" type="email" value="${esc(v.email ?? "")}" autocomplete="off"></label>
      <label class="f">Note <span class="hint">Optional, seen only by your team</span><input class="in" name="note" maxlength="240" value="${esc(v.note ?? "")}"></label>
      <p class="xs muted">Only the practitioners who offer the chosen treatment can be booked for it. The client's details are used only for this booking.</p>
      <div><button class="btn btn-p" type="submit">Save booking</button></div>
    </form>`;
}

export function bookingCreatedPage(d: { ref: string; manageUrl: string; a: Appt; siteName: string }) {
  const text = `Hello ${d.a.client_name.split(" ")[0]}, your ${d.a.service_name} at ${d.siteName} is booked for ${fmtDate(d.a.date)} at ${fmtTime(d.a.start_min)} with ${d.a.staff_name}. Booking ${d.ref}. View or cancel: ${d.manageUrl}`;
  return `<div class="card" style="max-width:640px"><div class="seal" style="margin:0 0 14px">${ic("check", 36)}</div><div class="eyebrow">Booked · ${esc(d.ref)}</div>
    <h2 class="mt8">${esc(d.a.client_name)}, ${fmtDate(d.a.date)} at ${fmtTime(d.a.start_min)}</h2><p class="muted mt8">${esc(d.a.service_name)} with ${esc(d.a.staff_name)}. It's on the calendar.</p>
    <div class="row wrap mt16" style="gap:8px"><a class="btn btn-p btn-s" href="${wa(d.a.client_phone, text)}" target="_blank" rel="noopener">${ic("chat", 15)} Send confirmation on WhatsApp</a><a class="btn btn-o btn-s" href="/clinic/calendar?date=${d.a.date}">See the calendar</a><a class="btn btn-o btn-s" href="/clinic/new">Add another</a></div>
    <p class="xs muted mt12">The WhatsApp message includes a private link where the client can view or cancel. This page is the only time the link is shown.</p></div>`;
}

export function clientsPage(d: { list: { id: string; name: string; phone: string; visits: number; last_visit: string | null; next_visit: string | null; bookings: number }[]; q: string; today: string }) {
  return `<div class="ws-head"><div><div class="eyebrow">Clients</div><h2 class="mt8">People who've booked</h2></div>
      <form method="get" action="/clinic/clients" class="row" style="gap:8px"><label class="sr" for="cq">Search</label><input class="in" id="cq" name="q" value="${esc(d.q)}" placeholder="Name or mobile" style="min-width:220px"><button class="btn btn-o btn-s" type="submit">Search</button></form></div>
    ${d.list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Client</th><th>Visits</th><th>Last visit</th><th>Next</th></tr></thead><tbody>
      ${d.list.map((c) => `<tr><td><a href="/clinic/clients/${esc(c.id)}"><b>${esc(c.name)}</b></a><div class="xs muted">${esc(fmtPhone(c.phone))}</div></td><td>${c.visits}</td><td class="small">${c.last_visit ? fmtDate(c.last_visit) : "—"}</td><td class="small">${c.next_visit ? relDay(c.next_visit, d.today) : "—"}</td></tr>`).join("")}
    </tbody></table></div>` : `<div class="card" style="text-align:center;padding:40px"><p class="muted">${d.q ? "No clients match that search." : "Clients appear here after their first booking."}</p></div>`}`;
}

export function clientPage(d: { c: { name: string; phone: string; email: string }; bookings: Appt[]; today: string }) {
  const done = d.bookings.filter((b) => b.status === "completed");
  return `<a class="btn btn-g btn-s" href="/clinic/clients" style="margin-left:-10px">${ic("chevL", 16)} Clients</a>
    <div class="soft-card mt12 row wrap" style="gap:18px">${avatar(d.c.name, 64)}<div class="grow"><h2>${esc(d.c.name)}</h2><div class="row wrap small mt8" style="gap:14px"><a href="tel:${esc(d.c.phone)}">${esc(fmtPhone(d.c.phone))}</a>${d.c.email ? `<a href="mailto:${esc(d.c.email)}">${esc(d.c.email)}</a>` : ""}<a href="${wa(d.c.phone)}" target="_blank" rel="noopener">WhatsApp</a></div></div>
      <div class="col" style="gap:0;text-align:right"><b class="serif" style="font-size:28px">${done.length}</b><span class="xs muted">visit${done.length === 1 ? "" : "s"}, ${inr(done.reduce((x, b) => x + b.price_paise, 0))}</span></div></div>
    <div class="mt16">${d.bookings.map((a) => apptRow(a, d.today, true)).join("")}</div>`;
}

export function servicesPage(d: { services: (ServiceRow & { staff: string[] })[]; staff: StaffRow[]; hours: { staff_id: string; dow: number; start_min: number; end_min: number }[]; catName: (id: string) => string }) {
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const name = (id: string) => d.staff.find((t) => t.id === id)?.name ?? id;
  return `<div class="ws-head"><div><div class="eyebrow">What clients see</div><h2 class="mt8">Services &amp; hours</h2></div><a class="btn btn-o btn-s" href="/clinic/setup">${ic("edit", 15)} Edit your listing</a></div>
    <p class="small muted" style="max-width:680px">Change treatments, prices, team and online hours under <a href="/clinic/setup">Your listing</a>. Changes appear on your page straight away.</p>
    <h3 class="mt24" style="font-size:22px">Online booking hours</h3>
    <div class="tbl-wrap mt12"><table class="tbl"><thead><tr><th>Practitioner</th>${[1, 2, 3, 4, 5, 6, 0].map((x) => `<th>${DOW[x]}</th>`).join("")}</tr></thead><tbody>
      ${d.staff.map((t) => `<tr><td><b>${esc(t.name)}</b><div class="xs muted">${esc(t.role)}</div></td>${[1, 2, 3, 4, 5, 6, 0].map((x) => { const h = d.hours.find((r) => r.staff_id === t.id && r.dow === x); return `<td class="small">${h ? `${fmtTime(h.start_min)}–${fmtTime(h.end_min)}` : '<span class="soft">—</span>'}</td>`; }).join("")}</tr>`).join("")}
    </tbody></table></div>
    <h3 class="mt32" style="font-size:22px">Treatments</h3>
    <div class="tbl-wrap mt12"><table class="tbl"><thead><tr><th>Treatment</th><th>Time</th><th>Price</th><th>Deposit</th><th>Who</th></tr></thead><tbody>
      ${d.services.map((s) => `<tr><td><b>${esc(s.name)}</b><div class="xs muted">${esc(d.catName(s.cat))}</div></td><td class="small">${s.dur_min} min</td><td>${inr(s.price_paise)}</td><td class="small">${s.deposit_paise ? inr(s.deposit_paise) : "None"}</td><td class="small">${s.staff.map(name).map(esc).join(", ")}</td></tr>`).join("")}
    </tbody></table></div>`;
}

export function paymentsPage(d: { month: string; m: Awaited<ReturnType<typeof import("../services/clinic").monthMoney>>; prev: string; next: string | null }) {
  const label = new Date(d.month + "-01T00:00:00Z").toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
  const kpi = (l: string, v: string, s: string) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="d">${s}</div></div>`;
  return `<div class="ws-head"><div><div class="eyebrow">Payments</div><h2 class="mt8">${label}</h2></div><div class="row" style="gap:8px"><a class="btn btn-o btn-s" href="/clinic/payments?month=${d.prev}">${ic("chevL", 15)}</a>${d.next ? `<a class="btn btn-o btn-s" href="/clinic/payments?month=${d.next}">${ic("chevR", 15)}</a>` : ""}</div></div>
    <div class="grid g4 kpis">
      ${kpi("Completed", String(d.m.completedCount), `appointments worth ${inr(d.m.completedValue)}`)}
      ${kpi("Deposits paid online", inr(d.m.depositsPaid), d.m.refunded ? `${inr(d.m.refunded)} refunded` : "nothing refunded")}
      ${kpi("Collected at the clinic", inr(d.m.balanceAtClinic), "balance on completed visits")}
      ${kpi("Aestheva commission", inr(d.m.commission), `${POLICY.commissionBp / 100}% of completed online bookings`)}
    </div>
    ${d.m.keptOnCancellation ? `<p class="small muted mt12">Deposits kept on late cancellations and no-shows: <b>${inr(d.m.keptOnCancellation)}</b>.</p>` : ""}
    <p class="xs muted mt12">Bookings your team adds carry no commission. Settlement statements will appear here once payouts to clinics start.</p>
    ${d.m.rows.length ? `<div class="tbl-wrap mt16"><table class="tbl"><thead><tr><th>Date</th><th>Client</th><th>Treatment</th><th>Status</th><th>Price</th><th>Deposit</th></tr></thead><tbody>
      ${d.m.rows.map((r) => `<tr><td class="small" style="white-space:nowrap"><a href="/clinic/bookings/${esc(r.ref)}">${fmtDate(r.date)}</a></td><td class="small">${esc(r.client_name)}</td><td class="small">${esc(r.service_name)}${r.source === "direct" ? '<div class="xs soft">Booked by clinic</div>' : ""}</td><td>${statusBadge(r.status)}</td><td>${inr(r.price_paise)}</td><td class="small">${r.paid ? inr(r.paid) + (r.refunded ? ` <span class="soft">(−${inr(r.refunded)})</span>` : "") : "—"}</td></tr>`).join("")}
    </tbody></table></div>` : `<div class="card mt16" style="text-align:center;padding:40px"><p class="muted">No appointments this month yet.</p></div>`}`;
}
