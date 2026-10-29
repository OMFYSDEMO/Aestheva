// Emails sent with Cloudflare Email Service's `EMAIL` binding (see wrangler.jsonc), from notifications@ with replies to hello@.
// Team emails go to NOTIFY_EMAIL (falling back to the support address). Emails to anyone else, such as clinic invitations,
// need Email Sending onboarded for the domain on the Workers Paid plan.
import { COMPANY } from "../config";
import type { Env } from "../env";
import { audit } from "../db";
import type { CleanApplication } from "./applications";

export interface SendOutcome { ok: boolean; code?: string; to: string }

const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim().slice(0, 180);
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const teamInbox = (env: Env) => env.NOTIFY_EMAIL?.trim() || COMPANY.supportEmail;
const sender = () => ({ name: "Aestheva", email: `notifications@${COMPANY.supportEmail.split("@")[1]}` });

/** Sends one email. Never throws; the outcome carries Cloudflare's error code when it fails. */
export async function sendEmail(env: Env, to: string, m: { subject: string; text: string; html: string; replyTo?: { email: string; name: string } }): Promise<SendOutcome> {
  if (!env.EMAIL) return { ok: false, code: "NO_BINDING", to };
  try {
    await env.EMAIL.send({ from: sender(), to, subject: oneLine(m.subject), text: m.text, html: m.html, replyTo: m.replyTo ?? { email: COMPANY.supportEmail, name: "Aestheva" } });
    return { ok: true, to };
  } catch (e) {
    const code = String((e as { code?: string })?.code ?? "SEND_FAILED");
    console.error("email failed", code, (e as Error)?.message);
    return { ok: false, code, to };
  }
}
export const sendTeamEmail = (env: Env, m: Parameters<typeof sendEmail>[2]) => sendEmail(env, teamInbox(env), m);

/** Tells the team a new application has arrived. Never throws: the application is already saved. */
export async function notifyNewApplication(env: Env, ref: string, a: CleanApplication, siteUrl: string, catNames: string[]) {
  const link = `${siteUrl}/ops/applications/${ref}`;
  const rows: [string, string][] = [
    ["Business", a.business_name], ["Kind", a.business_type], ["Area", a.area], ["Address", a.address], ["Services", catNames.join(", ")],
    ["Medical", a.medical ? "Yes" : "No"], ["Practitioners", String(a.team_size)], ["Contact", `${a.contact_name} (${a.contact_role})`],
    ["Mobile", a.phone], ["Email", a.email], ...(a.website ? [["Online", a.website] as [string, string]] : []),
  ];
  const text = `New application ${ref}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nServices and prices, as written:\n${a.services_text}\n\nReview it: ${link}\nReply to this email to write to ${a.contact_name}.`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#302A2E;line-height:1.5">
    <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#713F54;font-weight:bold;margin:0">New application · ${esc(ref)}</p>
    <h1 style="font-family:Georgia,serif;font-weight:normal;font-size:26px;margin:6px 0 16px">${esc(a.business_name)}</h1>
    <table style="border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#6B5F65;vertical-align:top">${esc(k)}</td><td style="padding:4px 0">${esc(v)}</td></tr>`).join("")}</table>
    <p style="margin:16px 0 4px;color:#6B5F65">Services and prices, as written</p><p style="white-space:pre-wrap;margin:0">${esc(a.services_text)}</p>
    <p style="margin:24px 0"><a href="${esc(link)}" style="background:#713F54;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Review the application</a></p>
    <p style="color:#8A7C83;font-size:12px">Reply to this email to write to ${esc(a.contact_name)}. Registrations are as given by the applicant and not yet verified.</p></div>`;
  const r = await sendTeamEmail(env, {
    subject: `New application: ${a.business_name} (${a.business_type}, ${a.area}) · ${ref}`, text, html, replyTo: { email: a.email, name: oneLine(a.contact_name) },
  });
  await audit(env.DB, "system", r.ok ? "application.notified" : "application.notify_failed", "application", ref, r.ok ? undefined : { code: r.code }).run().catch(() => {});
  return r;
}

export async function sendTestEmail(env: Env, siteUrl: string) {
  const r = await sendTeamEmail(env, {
    subject: "Aestheva test email",
    text: `This is a test from ${siteUrl}/ops. If you can read this, new applications will be emailed to this inbox.`,
    html: `<p style="font-family:Arial,sans-serif">This is a test from <a href="${esc(siteUrl)}/ops">the Aestheva team pages</a>. If you can read this, new applications will be emailed to this inbox.</p>`,
  });
  await audit(env.DB, "ops", r.ok ? "email.test_sent" : "email.test_failed", "email", "test", r.ok ? undefined : { code: r.code }).run().catch(() => {});
  return r;
}
