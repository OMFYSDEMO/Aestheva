// Booking emails: the client's confirmation and cancellation, and alerts to the business's logins.
// Every function here never throws, so an email problem can't undo or block a booking; each send is audited.
import { COMPANY, POLICY } from "../config";
import type { Env } from "../env";
import { audit, newToken, sha256Hex } from "../db";
import { DOW, MON, fmtDate, fmtTime, istToUtc } from "../domain/time";
import { inr } from "../domain/money";
import { isMedical } from "./catalog";
import { sendEmail } from "./notify";
import type { BookingRow, PaymentRow } from "./bookings";

export interface Detail {
  b: BookingRow;
  p: { name: string; slug: string; address: string; area: string; phone: string };
  staff: { name: string } | null;
  client: { name: string; phone: string; email: string };
  paid: PaymentRow | null;
}

async function detail(db: D1Database, bookingId: string): Promise<Detail | null> {
  const b = await db.prepare("SELECT * FROM bookings WHERE id = ?").bind(bookingId).first<BookingRow>();
  if (!b) return null;
  const [p, staff, client, paid] = await Promise.all([
    db.prepare("SELECT name, slug, address, area, phone FROM providers WHERE id = ?").bind(b.provider_id).first<Detail["p"]>(),
    db.prepare("SELECT name FROM staff WHERE id = ?").bind(b.staff_id).first<{ name: string }>(),
    db.prepare("SELECT name, phone, email FROM clients WHERE id = ?").bind(b.client_id).first<Detail["client"]>(),
    db.prepare("SELECT * FROM payments WHERE booking_id = ? AND status IN ('captured','refunded','partially_refunded') ORDER BY created_at DESC").bind(b.id).first<PaymentRow>(),
  ]);
  return p && client ? { b, p, staff, client, paid } : null;
}

// ---------- shared layout ----------

const esc = (s: string) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const first = (name: string) => name.trim().split(/\s+/)[0] || name;
const when = (b: BookingRow) => `${fmtDate(b.date, true)}, ${fmtTime(b.start_min)}`;
const shortWhen = (b: BookingRow) => { const d = new Date(b.date + "T00:00:00Z"); return `${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]} at ${fmtTime(b.start_min)}`; };
const prettyPhone = (e164: string) => e164.replace(/^\+91(\d{5})(\d{5})$/, "+91 $1 $2");
const maps = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

function layout(o: { kicker?: string; title: string; intro: string; rows: [string, string][]; buttons: [string, string][]; notes: string[]; footer: string }) {
  const btn = ([label, href]: [string, string], i: number) =>
    `<a href="${esc(href)}" style="display:inline-block;margin:0 8px 8px 0;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold;${i === 0 ? "background:#8A2E5C;color:#ffffff" : "background:#ffffff;color:#8A2E5C;border:1px solid #E2D6DB"}">${esc(label)}</a>`;
  const html = `<div style="background:#FBF5F7;padding:24px 12px"><div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #EFE7EA;border-radius:16px;padding:28px 26px;font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#1D1A1C">
    <p style="margin:0;font-size:24px;font-weight:bold;letter-spacing:-0.5px;color:#8A2E5C">aestheva${o.kicker ? ` <span style="font-size:15px;font-weight:normal;letter-spacing:0;color:#857A80">${esc(o.kicker)}</span>` : ""}</p>
    <h1 style="font-size:24px;line-height:1.25;margin:20px 0 10px">${esc(o.title)}</h1>
    <p style="margin:0 0 18px;color:#5F565B">${esc(o.intro)}</p>
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 20px">${o.rows.map(([k, v]) => `<tr><td style="padding:9px 14px 9px 0;border-top:1px solid #EFE7EA;color:#857A80;vertical-align:top;white-space:nowrap;width:1%">${esc(k)}</td><td style="padding:9px 0;border-top:1px solid #EFE7EA">${v}</td></tr>`).join("")}</table>
    <div>${o.buttons.map(btn).join("")}</div>
    ${o.notes.map((n) => `<p style="margin:14px 0 0;font-size:14px;color:#5F565B">${n}</p>`).join("")}
    <p style="margin:26px 0 0;padding-top:16px;border-top:1px solid #EFE7EA;font-size:12px;color:#857A80">${o.footer}</p>
  </div></div>`;
  const strip = (s: string) => s.replace(/<br>/g, ", ").replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g, "$2 ($1)").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  const text = [o.title, "", o.intro, "", ...o.rows.map(([k, v]) => `${k}: ${strip(v)}`), "", ...o.buttons.map(([l, h]) => `${l}: ${h}`), "", ...o.notes.map(strip), "", strip(o.footer)].join("\n");
  return { html, text };
}

const clientFooter = (d: Detail, site: string) => `Booked through <a href="${esc(site)}" style="color:#857A80">Aestheva</a>. ${esc(d.p.name)} provides your appointment. Questions about it? ${d.p.phone ? `Call ${esc(d.p.name)} on <a href="tel:${esc(d.p.phone)}" style="color:#857A80">${esc(prettyPhone(d.p.phone))}</a>, or reply` : "Reply"} to this email.`;

/** "Add to Google Calendar" link, in India time. */
function calendarLink(d: Detail, manage: string) {
  const fmt = (dt: Date) => dt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = istToUtc(d.b.date, d.b.start_min), end = istToUtc(d.b.date, d.b.start_min + d.b.dur_min);
  const q = new URLSearchParams({ action: "TEMPLATE", text: `${d.b.service_name} at ${d.p.name}`, dates: `${fmt(start)}/${fmt(end)}`, location: `${d.p.name}, ${d.p.address}`, details: `Booking ${d.b.ref}. View or cancel: ${manage}` });
  return `https://calendar.google.com/calendar/render?${q}`;
}

/** An .ics file for Apple Calendar and Outlook. */
export function icsFor(v: { b: BookingRow; p: { name: string; address: string } }, manage: string) {
  const fmt = (dt: Date) => dt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const e = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Aestheva//Booking//EN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:${v.b.id}@bookaestheva.com`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(istToUtc(v.b.date, v.b.start_min))}`, `DTEND:${fmt(istToUtc(v.b.date, v.b.start_min + v.b.dur_min))}`,
    `SUMMARY:${e(`${v.b.service_name} at ${v.p.name}`)}`, `LOCATION:${e(`${v.p.name}, ${v.p.address}`)}`, `DESCRIPTION:${e(`Booking ${v.b.ref}. View or cancel: ${manage}`)}`,
    "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", `DESCRIPTION:${e(v.b.service_name)}`, "END:VALARM", "END:VEVENT", "END:VCALENDAR", ""].join("\r\n");
}

/** A private link for this email. The booking page link is only known at the moment of booking, so each confirmation gets its own. */
async function emailLink(db: D1Database, b: BookingRow, site: string) {
  const token = newToken();
  await db.prepare("UPDATE bookings SET email_token_hash = ? WHERE id = ?").bind(await sha256Hex(token), b.id).run();
  return { manage: `${site}/booking/${b.ref}?t=${token}`, ics: `${site}/booking/${b.ref}/calendar.ics?t=${token}` };
}

async function logged(env: Env, bookingId: string, kind: string, r: { ok: boolean; code?: string }) {
  await audit(env.DB, "system", `email.${kind}${r.ok ? "" : "_failed"}`, "booking", bookingId, r.ok ? undefined : { code: r.code }).run().catch(() => {});
}

// ---------- to the client ----------

/** The client's confirmation email, from a loaded booking and its private links. */
export function confirmationMail(d: Detail, manage: string, ics: string, site: string) {
  const direct = d.b.source === "direct";
  const balance = d.b.price_paise - (d.paid && d.paid.status === "captured" ? d.paid.amount_paise : 0);
  const rows: [string, string][] = [
    ["What", `<b>${esc(d.b.service_name)}</b>${d.staff ? ` with ${esc(d.staff.name)}` : ""}`],
    ["When", `<b>${esc(when(d.b))}</b> · ${d.b.dur_min} minutes`],
    ["Where", `<b>${esc(d.p.name)}</b><br>${esc(d.p.address)}<br><a href="${esc(maps(`${d.p.name}, ${d.p.address}`))}" style="color:#8A2E5C">Get directions</a>`],
    ["Price", d.paid && d.paid.status === "captured" ? `${esc(inr(d.b.price_paise))} in full · ${esc(inr(d.paid.amount_paise))} deposit paid · <b>${esc(inr(balance))} to pay on the day</b>` : `<b>${esc(inr(d.b.price_paise))}</b>, paid on the day. Nothing to pay online.`],
    ["Booking", esc(d.b.ref)],
  ];
  const notes = [
    ...(isMedical(d.b) ? [`Please tell ${esc(d.staff?.name ?? d.p.name)} about any medicines you take or allergies you have. They'll check the treatment suits you before starting.`] : []),
    d.paid && d.paid.status === "captured"
      ? `Plans change? Cancel free up to ${POLICY.freeCancelHours} hours before from your booking page and the deposit comes back in full.`
      : "Can't make it? Please cancel from your booking page, so someone else can have the time.",
    `<a href="${esc(ics)}" style="color:#8A2E5C">Add to Apple Calendar or Outlook</a>`,
  ];
  return { subject: `Booked: ${d.b.service_name} at ${d.p.name}, ${shortWhen(d.b)}`, ...layout({
    title: `You're booked, ${first(d.client.name)}`,
    intro: direct ? `${d.p.name} has booked this appointment for you.` : `Your appointment at ${d.p.name} is confirmed.`,
    rows, buttons: [["View or cancel your booking", manage], ["Add to Google Calendar", calendarLink(d, manage)]], notes, footer: clientFooter(d, site),
  }) };
}

export async function emailBookingConfirmed(env: Env, bookingId: string, site: string) {
  try {
    const d = await detail(env.DB, bookingId);
    if (!d || !d.client.email || d.b.status !== "confirmed") return;
    const { manage, ics } = await emailLink(env.DB, d.b, site);
    const r = await sendEmail(env, d.client.email, confirmationMail(d, manage, ics, site));
    await logged(env, d.b.id, "booking_confirmed", r);
  } catch (e) { console.error("confirmation email failed", e); }
}

/** The client's cancellation email. */
export function cancellationMail(d: Detail, site: string, refund: "refunded" | "review" | "retained" | "failed" | "none") {
  const byBusiness = d.b.cancelled_by === "provider", bySystem = d.b.cancelled_by === "system";
  const dep = d.paid ? inr(d.paid.amount_paise) : "";
  const money = refund === "refunded" ? `Your ${dep} deposit is being refunded to the way you paid. It usually arrives in 5 to 7 working days.`
    : refund === "failed" ? `We're refunding your ${dep} deposit and will email you when it's on its way.`
    : refund === "review" ? `You asked us to review the deposit. We'll email you the outcome.`
    : refund === "retained" ? `As this was within ${POLICY.freeCancelHours} hours of the appointment, the ${dep} deposit is kept, as set out in the cancellation policy.`
    : "";
  return { subject: `Cancelled: ${d.b.service_name} at ${d.p.name}, ${shortWhen(d.b)}`, ...layout({
    title: byBusiness ? `${d.p.name} has cancelled your appointment` : bySystem ? "Your booking couldn't be completed" : "Your booking is cancelled",
    intro: byBusiness ? `We're sorry: ${d.p.name} can't see you at this time. Please book another time, or call them to rearrange.`
      : bySystem ? `The time was taken before your payment arrived, so we couldn't confirm it.` : `You've cancelled this appointment. Thanks for letting ${d.p.name} know.`,
    rows: [["What", esc(d.b.service_name)], ["When", esc(when(d.b))], ["Where", esc(d.p.name)], ["Booking", esc(d.b.ref)]],
    buttons: [["Book another time", `${site}/p/${d.p.slug}`]], notes: money ? [money] : [], footer: clientFooter(d, site),
  }) };
}

export async function emailBookingCancelled(env: Env, bookingId: string, site: string, refund: "refunded" | "review" | "retained" | "failed" | "none" = "none") {
  try {
    const d = await detail(env.DB, bookingId);
    if (!d || !d.client.email || d.b.status !== "cancelled") return;
    const r = await sendEmail(env, d.client.email, cancellationMail(d, site, refund));
    await logged(env, d.b.id, "booking_cancelled", r);
  } catch (e) { console.error("cancellation email failed", e); }
}

// ---------- to the business ----------

async function businessInboxes(db: D1Database, providerId: string) {
  return (await db.prepare("SELECT email FROM provider_users WHERE provider_id = ? AND active = 1").bind(providerId).all<{ email: string }>()).results.map((r) => r.email);
}

/** The business's alert for a new online booking or a client cancellation. */
export function businessMail(d: Detail, site: string, event: "new" | "cancelled") {
  const m = layout({
    kicker: "for business",
    title: event === "new" ? `New booking: ${d.client.name}` : `Cancelled by the client: ${d.client.name}`,
    intro: event === "new" ? "A client has booked online through Aestheva. It's already in your calendar." : "The client cancelled online. The time is free again in your calendar.",
    rows: [
      ["Client", `<b>${esc(d.client.name)}</b> · <a href="tel:${esc(d.client.phone)}" style="color:#8A2E5C">${esc(prettyPhone(d.client.phone))}</a>`],
      ["What", `${esc(d.b.service_name)}${d.staff ? ` with ${esc(d.staff.name)}` : ""}`],
      ["When", `<b>${esc(when(d.b))}</b> · ${d.b.dur_min} minutes`],
      ...(d.b.client_note && event === "new" ? [["Note", esc(d.b.client_note)] as [string, string]] : []),
      ["Booking", esc(d.b.ref)],
    ],
    buttons: [["Open the booking", `${site}/clinic/bookings/${d.b.ref}`]], notes: [],
    footer: `You get these emails because you have a login for ${esc(d.p.name)} on Aestheva.`,
  });
  const subject = event === "new" ? `New booking: ${d.client.name} · ${d.b.service_name}, ${shortWhen(d.b)}` : `Cancelled: ${d.client.name} · ${d.b.service_name}, ${shortWhen(d.b)}`;
  return { subject, ...m };
}

export async function alertBusiness(env: Env, bookingId: string, site: string, event: "new" | "cancelled") {
  try {
    const d = await detail(env.DB, bookingId);
    if (!d || d.b.source === "direct") return;   // the business added it themselves
    const to = await businessInboxes(env.DB, d.b.provider_id);
    for (const email of to) await logged(env, d.b.id, event === "new" ? "business_new_booking" : "business_cancelled", await sendEmail(env, email, businessMail(d, site, event)));
  } catch (e) { console.error("business alert failed", e); }
}

/** The public address for links in emails. */
export const siteOf = (env: Env, req: Request) => env.SITE_URL || new URL(req.url).origin;

/** After a booking is confirmed: the client's confirmation and the business's alert. */
export const afterConfirmed = (env: Env, bookingId: string, site: string) =>
  Promise.all([emailBookingConfirmed(env, bookingId, site), alertBusiness(env, bookingId, site, "new")]);
