import { APP_STATUSES, type ApplicationRow } from "../services/applications";
import { esc, ic } from "./ui";

const STATUS_BADGE: Record<string, string> = { new: "b-blush", reviewing: "b-warn", approved: "b-ok", declined: "b-plain" };
const badge = (s: string) => `<span class="badge ${STATUS_BADGE[s] ?? "b-plain"}">${esc(s[0].toUpperCase() + s.slice(1))}</span>`;
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

const shell = (body: string) => `<div class="page"><div class="ops-bar"><div class="row wrap" style="gap:4px"><span class="eyebrow" style="margin-right:10px">Aestheva team</span><a class="btn btn-g btn-s" href="/ops/applications">Applications</a><a class="btn btn-g btn-s" href="/ops/venues">Venues</a><a class="btn btn-g btn-s" href="/ops/clinics">Clinic logins</a></div><form method="post" action="/ops/logout"><button class="btn btn-g btn-s" type="submit">${ic("out", 15)} Sign out</button></form></div>${body}</div>`;

const STAGE_BADGE: Record<string, [string, string]> = { setup: ["b-plain", "Setting up"], review: ["b-warn", "Ready for review"], live: ["b-ok", "Live"], paused: ["b-err", "Paused"] };
const stageBadge = (s: string) => `<span class="badge ${STAGE_BADGE[s]?.[0] ?? "b-plain"}">${STAGE_BADGE[s]?.[1] ?? esc(s)}</span>`;
const inrP = (p: number) => "₹" + (p / 100).toLocaleString("en-IN");

export function opsVenuesPage(d: { rows: { id: string; name: string; type: string; area: string; stage: string; percent: number; submitted_at: string | null; logins: number }[] }) {
  const order = ["review", "setup", "live", "paused"];
  const rows = [...d.rows].sort((a, b) => order.indexOf(a.stage) - order.indexOf(b.stage));
  return shell(`<h1 class="mt8" style="font-size:40px">Venues</h1><p class="small muted mt8">Listings that are ready for review come first.</p>
    <div class="tbl-wrap mt16"><table class="tbl"><thead><tr><th>Venue</th><th>Stage</th><th>Setup</th><th>Logins</th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td><a href="/ops/venues/${esc(r.id)}"><b>${esc(r.name)}</b></a><div class="xs muted">${esc(r.type)}${r.area ? ` · ${esc(r.area)}` : ""}</div></td><td>${stageBadge(r.stage)}${r.submitted_at && r.stage === "review" ? `<div class="xs muted">since ${when(r.submitted_at)}</div>` : ""}</td><td class="small">${r.percent}%</td><td class="small">${r.logins}</td></tr>`).join("")}
    </tbody></table></div>`);
}

export function opsVenuePage(d: { p: { id: string; name: string; slug: string; type: string; area: string; address: string; phone: string; tagline: string; about: string; hours_text: string; review_note: string; terms_accepted_at: string | null };
  stage: string; steps: { title: string; done: boolean; summary: string }[]; staff: { name: string; role: string; medical: number; registration: string; quals_json: string }[];
  services: { name: string; kind: string; dur_min: number; price_paise: number }[]; photos: { src: string; alt: string }[];
  docs: { id: string; kind: string; filename: string; size_bytes: number; created_at: string }[]; verifications: { id: number; label: string; scope: string; checked_on: string }[];
  previewUrl: string; csrf: string; message?: string; error?: string }) {
  const tok = `<input type="hidden" name="csrf" value="${esc(d.csrf)}">`;
  const q = (j: string) => { try { return (JSON.parse(j) as string[]).join(", "); } catch { return ""; } };
  const action = (a: string, label: string, cls: string, note = false) => `<form method="post" action="/ops/venues/${esc(d.p.id)}/stage" class="col" style="gap:8px">${tok}<input type="hidden" name="action" value="${a}">${note ? `<textarea class="in" name="note" rows="3" placeholder="${a === "pause" ? "Optional note for the clinic" : "What needs changing? The clinic sees this."}"></textarea>` : ""}<button class="btn ${cls} btn-s" type="submit">${label}</button></form>`;
  return shell(`<a class="btn btn-g btn-s" href="/ops/venues" style="margin-left:-10px">${ic("chevL", 16)} Venues</a>
    ${d.message ? `<div class="form-ok mt12" role="status">${esc(d.message)}</div>` : ""}${d.error ? `<div class="form-error mt12" role="alert">${esc(d.error)}</div>` : ""}
    <div class="row wrap between mt12"><div><div class="eyebrow">${esc(d.p.type)}${d.p.area ? ` · ${esc(d.p.area)}` : ""}</div><h1 class="mt8" style="font-size:38px">${esc(d.p.name)}</h1></div><div class="row" style="gap:8px">${stageBadge(d.stage)}<a class="btn btn-o btn-s" href="${esc(d.previewUrl)}" target="_blank" rel="noopener">Preview page</a></div></div>
    <div class="apply-layout mt16"><div class="col" style="gap:16px">
      <div class="card"><h2 style="font-size:22px">Checklist</h2><ul class="ticks mt12">${d.steps.map((s) => `<li style="color:${s.done ? "inherit" : "var(--err)"}">${ic(s.done ? "check" : "x", 15)} <span><b>${esc(s.title)}</b> · ${esc(s.summary)}</span></li>`).join("")}</ul></div>
      <div class="card"><h2 style="font-size:22px">Clinic</h2><dl class="kv mt12"><dt>Tagline</dt><dd>${esc(d.p.tagline)}</dd><dt>About</dt><dd>${esc(d.p.about)}</dd><dt>Address</dt><dd>${esc(d.p.address)}</dd><dt>Phone</dt><dd>${esc(d.p.phone)}</dd><dt>Hours</dt><dd>${esc(d.p.hours_text)}</dd><dt>Terms</dt><dd>${d.p.terms_accepted_at ? `Accepted ${when(d.p.terms_accepted_at)}` : "Not yet"}</dd></dl></div>
      <div class="card"><h2 style="font-size:22px">Team</h2>${d.staff.length ? `<div class="mt8">${d.staff.map((t) => `<div style="padding:8px 0;border-top:1px solid var(--line)"><b>${esc(t.name)}</b> <span class="small muted">${esc(t.role)} · ${t.medical ? "registered practitioner" : "non-medical"}</span><div class="xs muted">${esc(q(t.quals_json))}${t.registration ? ` · <b>${esc(t.registration)}</b>` : ""}</div></div>`).join("")}</div>` : '<p class="small muted mt8">None yet.</p>'}</div>
      <div class="card"><h2 style="font-size:22px">Treatments</h2>${d.services.length ? `<div class="mt8">${d.services.map((s) => `<div class="row between small" style="padding:6px 0;border-top:1px solid var(--line)"><span>${esc(s.name)} <span class="xs muted">${s.kind === "beauty" ? "beauty" : "medical"} · ${s.dur_min} min</span></span><b>${inrP(s.price_paise)}</b></div>`).join("")}</div>` : '<p class="small muted mt8">None yet.</p>'}</div>
      ${d.photos.length ? `<div class="card"><h2 style="font-size:22px">Photos</h2><div class="photo-grid mt12">${d.photos.map((ph) => `<img src="${esc(ph.src)}-400.webp" alt="${esc(ph.alt)}" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px">`).join("")}</div></div>` : ""}
    </div><aside class="col" style="gap:16px">
      <div class="card"><h2 style="font-size:22px">Documents</h2>${d.docs.length ? `<div class="mt8">${d.docs.map((x) => `<div style="padding:8px 0;border-top:1px solid var(--line)"><a href="/ops/documents/${esc(x.id)}" target="_blank" rel="noopener"><b class="small">${esc(x.kind)}</b></a><div class="xs muted">${esc(x.filename)} · ${Math.max(1, Math.round(x.size_bytes / 1024))} KB · ${when(x.created_at)}</div></div>`).join("")}</div>` : '<p class="small muted mt8">None uploaded.</p>'}</div>
      <div class="card"><h2 style="font-size:22px">What we verified</h2><p class="xs muted mt8">Shown on the public page. Add only what you've actually checked.</p>
        ${d.verifications.map((v) => `<div class="row between" style="padding:8px 0;border-top:1px solid var(--line);gap:8px"><div class="small"><b>${esc(v.label)}</b><div class="xs muted">${esc(v.scope)} · ${esc(v.checked_on)}</div></div><form method="post" action="/ops/venues/${esc(d.p.id)}/verifications/${v.id}/remove">${tok}<button class="btn btn-g btn-x" type="submit">Remove</button></form></div>`).join("")}
        <form method="post" action="/ops/venues/${esc(d.p.id)}/verifications" class="col mt12" style="gap:8px">${tok}
          <input class="in" name="label" placeholder="Practitioner registration checked" required><input class="in" name="scope" placeholder="1 dentist · Kerala State Dental Council" required><input class="in" name="checked_on" placeholder="Oct 2026" value="${new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}" required>
          <button class="btn btn-o btn-s" type="submit">Add</button></form></div>
      <div class="card col" style="gap:12px"><h2 style="font-size:22px">Decision</h2>
        ${d.stage !== "live" ? action("publish", "Publish now", "btn-ok") : ""}
        ${d.stage === "review" || d.stage === "setup" ? `<details><summary class="small"><b>Send back with a note</b></summary><div class="mt8">${action("send_back", "Send to the clinic", "btn-o", true)}</div></details>` : ""}
        ${d.stage === "live" ? `<details><summary class="small"><b>Pause this listing</b></summary><div class="mt8">${action("pause", "Pause", "btn-d", true)}</div></details>` : ""}
        ${d.p.review_note ? `<p class="xs muted">Last note sent: ${esc(d.p.review_note)}</p>` : ""}</div>
    </aside></div>`);
}

export interface ClinicLoginRow { id: string; provider_id: string; name: string; email: string; active: number; last_login_at: string | null }
export function opsClinicsPage(d: { providers: { id: string; name: string; status: string }[]; users: ClinicLoginRow[]; csrf: string; issued?: { email: string; sent: boolean; code?: string; link?: string; what: string }; error?: string }) {
  const tok = `<input type="hidden" name="csrf" value="${esc(d.csrf)}">`;
  return shell(`<h1 class="mt8" style="font-size:40px">Clinic logins</h1>
    <p class="small muted mt8" style="max-width:680px">Each login opens that venue's clinic portal at <b>/clinic</b>: its calendar, bookings, clients and payments. The person gets an email with a one-time link to choose their own password. Nobody at Aestheva ever sees it.</p>
    ${d.issued ? (d.issued.sent
      ? `<div class="form-ok mt16" role="status"><b>${esc(d.issued.what)}.</b> We've emailed ${esc(d.issued.email)} a link to set their password. It works once, for 3 days.</div>`
      : `<div class="card mt16" style="border-color:var(--warn)"><b>${esc(d.issued.what)}, but the email didn't send${d.issued.code ? ` (${esc(d.issued.code)})` : ""}.</b>
          <p class="small mt8">Share this one-time link with ${esc(d.issued.email)} privately, for example in a direct WhatsApp message. It lets them set their password, works once and expires in 3 days. It won't be shown again.</p>
          <p class="mt8"><code style="word-break:break-all;font-size:13px">${esc(d.issued.link ?? "")}</code></p>
          ${d.issued.code === "E_RECIPIENT_NOT_ALLOWED" || d.issued.code === "E_SENDER_DOMAIN_NOT_AVAILABLE" ? `<p class="xs muted mt8">To email any address, Cloudflare needs Workers Paid and Email Sending switched on for bookaestheva.com (Email Service → Email Sending → Onboard Domain).</p>` : ""}</div>`) : ""}
    ${d.error ? `<div class="form-error mt16" role="alert">${esc(d.error)}</div>` : ""}
    ${d.providers.map((p) => { const us = d.users.filter((u) => u.provider_id === p.id); return `<div class="card mt16"><div class="row between wrap"><h2 style="font-size:24px">${esc(p.name)}</h2><span class="badge ${p.status === "live" ? "b-ok" : "b-plain"}">${esc(p.status)}</span></div>
      ${us.length ? `<div class="tbl-wrap mt12"><table class="tbl"><tbody>${us.map((u) => `<tr><td><b>${esc(u.name)}</b><div class="xs muted">${esc(u.email)}</div></td><td class="small">${u.active ? (u.last_login_at ? `Last signed in ${when(u.last_login_at)}` : "Invited, not signed in yet") : '<span class="badge b-plain">Disabled</span>'}</td>
        <td style="text-align:right;white-space:nowrap"><form method="post" action="/ops/clinics/${esc(u.id)}/link" style="display:inline">${tok}<button class="btn btn-o btn-x" type="submit">Email a set-password link</button></form>
        <form method="post" action="/ops/clinics/${esc(u.id)}/active" style="display:inline">${tok}<input type="hidden" name="active" value="${u.active ? "0" : "1"}"><button class="btn btn-g btn-x" type="submit">${u.active ? "Disable" : "Enable"}</button></form></td></tr>`).join("")}</tbody></table></div>` : `<p class="small muted mt8">No logins yet.</p>`}
      <form method="post" action="/ops/clinics" class="row wrap mt12" style="gap:8px;align-items:flex-end">${tok}<input type="hidden" name="provider" value="${esc(p.id)}">
        <label class="f">Name<input class="in" name="name" required maxlength="80" placeholder="e.g. Front desk"></label>
        <label class="f">Email<input class="in" name="email" type="email" required placeholder="name@example.com"></label>
        <button class="btn btn-p btn-s" type="submit">Create login and send invitation</button></form></div>`; }).join("")}`);
}

export function opsLoginPage(error = "", configured = true) {
  return `<div class="page narrow" style="max-width:440px;padding-top:64px">
    <div class="card"><div class="eyebrow">Aestheva team</div><h1 class="mt8" style="font-size:32px">Sign in</h1>
    ${configured ? `<form method="post" action="/ops/login" class="col mt16" style="gap:12px">
      <label class="f" for="ops-key">Team password<input class="in" id="ops-key" name="key" type="password" autocomplete="current-password" required autofocus></label>
      ${error ? `<div class="form-error" role="alert">${esc(error)}</div>` : ""}
      <button class="btn btn-p" type="submit">Sign in</button></form>`
    : `<p class="small muted mt12">The team pages aren't switched on yet. Add a Worker secret called <b>OPS_KEY</b> in Cloudflare (Settings → Variables and Secrets) and use it as the password.</p>`}
    </div></div>`;
}

const EMAIL_HELP: Record<string, string> = {
  NO_BINDING: "The email binding isn't available here. It only exists on the deployed site.",
  E_SENDER_DOMAIN_NOT_AVAILABLE: "Email Routing isn't switched on for bookaestheva.com yet. Turn it on in Cloudflare: Email Service → Email Routing.",
  E_SENDER_NOT_VERIFIED: "Email Routing isn't switched on for bookaestheva.com yet. Turn it on in Cloudflare: Email Service → Email Routing.",
  E_SENDER_DOMAIN_NOT_CONFIGURED: "bookaestheva.com isn't set up in Email Routing yet. In Cloudflare go to Compute → Email Service → Email Routing, onboard bookaestheva.com, and check its DNS records under Settings are all configured.",
  E_RECIPIENT_NOT_ALLOWED: "Cloudflare will only email a verified inbox. Add the inbox under Email Routing → Destination addresses, verify it, and set NOTIFY_EMAIL to it.",
};
export function opsListPage(d: { rows: ApplicationRow[]; counts: Record<string, number>; status: string; csrf: string; emailResult?: { ok: boolean; to: string; code?: string } }) {
  const total = Object.values(d.counts).reduce((a, b) => a + b, 0);
  const tab = (s: string, label: string, n: number) => `<a class="chip ${d.status === s ? "on" : ""}" href="/ops/applications${s ? "?status=" + s : ""}">${label} <b>${n}</b></a>`;
  const er = d.emailResult;
  const emailNote = er ? (er.ok ? `<div class="form-ok mt12" role="status">Test email sent to ${esc(er.to)}. Check that inbox, including spam.</div>`
    : `<div class="form-error mt12" role="alert">The test email to ${esc(er.to)} didn't send${er.code ? ` (${esc(er.code)})` : ""}. ${esc(EMAIL_HELP[er.code ?? ""] ?? "Check Email Routing in Cloudflare, then try again.")}</div>`) : "";
  return shell(`${emailNote}<div class="row wrap between mt8"><h1 style="font-size:40px">Applications</h1>
    <form method="post" action="/ops/test-email"><input type="hidden" name="csrf" value="${esc(d.csrf)}"><button class="btn btn-o btn-s" type="submit">${ic("mail", 15)} Send a test email</button></form></div>
    <div class="chips mt16">${tab("", "All", total)}${APP_STATUSES.map((s) => tab(s, s[0].toUpperCase() + s.slice(1), d.counts[s] ?? 0)).join("")}</div>
    ${d.rows.length ? `<div class="tbl-wrap mt24"><table class="tbl"><thead><tr><th>Received</th><th>Business</th><th>Area</th><th>Contact</th><th>Status</th></tr></thead><tbody>
      ${d.rows.map((a) => `<tr><td class="small" style="white-space:nowrap">${when(a.created_at)}</td><td><a href="/ops/applications/${esc(a.ref)}"><b>${esc(a.business_name)}</b></a><div class="xs muted">${esc(a.business_type)}${a.medical ? " · medical" : ""} · ${esc(a.ref)}</div></td><td class="small">${esc(a.area)}</td><td class="small">${esc(a.contact_name)}<div class="xs muted">${esc(a.phone)}</div></td><td>${badge(a.status)}</td></tr>`).join("")}
    </tbody></table></div>` : `<div class="card mt24" style="text-align:center;padding:40px"><p class="muted">No applications${d.status ? ` marked ${esc(d.status)}` : " yet"}.</p></div>`}`);
}

export function opsDetailPage(a: ApplicationRow, csrf: string, draft: unknown, catName: (id: string) => string, saved = false, approved?: { invited: boolean; reason?: string; email?: string; sent?: boolean; code?: string; link?: string }) {
  const cats: string[] = (() => { try { return JSON.parse(a.categories_json); } catch { return []; } })();
  const row = (k: string, v: string) => v ? `<dt>${k}</dt><dd>${v}</dd>` : "";
  const web = a.website ? (/^https?:\/\//i.test(a.website) ? `<a href="${esc(a.website)}" target="_blank" rel="noopener noreferrer">${esc(a.website)}</a>` : esc(a.website)) : "";
  return shell(`<a class="btn btn-g btn-s" href="/ops/applications" style="margin-left:-10px">${ic("chevL", 16)} All applications</a>
    ${saved ? `<div class="form-ok mt12" role="status">Saved.</div>` : ""}
    ${approved ? (!approved.invited ? `<div class="note n-warn mt12">${esc(approved.reason ?? "")}</div>` : approved.sent ? `<div class="form-ok mt12" role="status"><b>Approved.</b> A draft listing is ready and ${esc(approved.email ?? "")} has been emailed an invitation to set it up.</div>`
      : `<div class="card mt12" style="border-color:var(--warn)"><b>Approved, but the invitation email didn't send${approved.code ? ` (${esc(approved.code)})` : ""}.</b><p class="small mt8">Share this one-time link with ${esc(approved.email ?? "")} privately. It works once, for 3 days.</p><p class="mt8"><code style="word-break:break-all;font-size:13px">${esc(approved.link ?? "")}</code></p></div>`) : ""}
    <div class="row wrap between mt12"><div><div class="eyebrow">${esc(a.ref)} · received ${when(a.created_at)}</div><h1 class="mt8" style="font-size:38px">${esc(a.business_name)}</h1></div>${badge(a.status)}</div>
    <div class="apply-layout mt24">
      <div class="col" style="gap:16px">
        <div class="card"><h2 style="font-size:22px">Practice</h2><dl class="kv mt12">
          ${row("Kind", esc(a.business_type))}${row("Area", esc(a.area))}${row("Address", esc(a.address))}${row("Online", web)}
          ${row("Services", esc(cats.map(catName).join(", ")))}${row("Medical", a.medical ? "Yes" : "No")}${row("Practitioners", String(a.team_size))}</dl></div>
        <div class="card"><h2 style="font-size:22px">Services and prices, as written</h2><p class="small mt12" style="white-space:pre-wrap">${esc(a.services_text)}</p></div>
        <div class="card"><h2 style="font-size:22px">Registrations</h2><dl class="kv mt12">
          ${row("Establishment", esc(a.establishment_reg) || "<span class='muted'>Not given</span>")}${row("Practitioner", esc(a.practitioner_reg) || "<span class='muted'>Not given</span>")}${row("GSTIN", esc(a.gstin) || "<span class='muted'>Not given</span>")}</dl>
          <p class="xs muted mt12">Nothing here is verified yet. Check each registration with the issuing council or authority before the venue goes live.</p></div>
        <div class="card"><h2 style="font-size:22px">Venue file draft</h2><p class="small muted mt8">Once approved, save this as <code>providers/${esc((draft as { id: string }).id)}.json</code>, fill in every TODO and load it with <code>scripts/provider-sql.mjs</code>.</p>
          <pre class="code mt12">${esc(JSON.stringify(draft, null, 2))}</pre></div>
      </div>
      <aside class="sticky col" style="gap:16px">
        <div class="card"><h2 style="font-size:22px">Contact</h2><dl class="kv mt12">${row("Name", esc(a.contact_name))}${row("Role", esc(a.contact_role))}
          ${row("Mobile", `<a href="tel:${esc(a.phone)}">${esc(a.phone)}</a>`)}${row("Email", `<a href="mailto:${esc(a.email)}?subject=${encodeURIComponent(`Your Aestheva application ${a.ref}`)}">${esc(a.email)}</a>`)}${row("Heard via", esc(a.heard_from))}</dl></div>
        <div class="card">${a.provider_id ? `<b>Listing created</b><p class="small muted mt8">The clinic is setting up its listing.</p><a class="btn btn-o btn-s mt12" href="/ops/venues/${esc(a.provider_id)}">Open the venue</a>`
          : `<b>Approve</b><p class="small muted mt8">Creates a draft listing from this application and emails ${esc(a.contact_name)} an invitation to set it up: photos, team, treatments and documents. Nothing is public until you publish it.</p>
          <form method="post" action="/ops/applications/${esc(a.ref)}/approve" class="mt12"><input type="hidden" name="csrf" value="${esc(csrf)}"><button class="btn btn-ok btn-s" type="submit">Approve and invite to set up</button></form>`}</div>
        <form class="card col" style="gap:12px" method="post" action="/ops/applications/${esc(a.ref)}">
          <input type="hidden" name="csrf" value="${esc(csrf)}">
          <h2 style="font-size:22px">Review</h2>
          <label class="f" for="st">Status<select class="in" id="st" name="status">${APP_STATUSES.map((s) => `<option value="${s}" ${a.status === s ? "selected" : ""}>${s[0].toUpperCase() + s.slice(1)}</option>`).join("")}</select></label>
          <label class="f" for="nt">Team notes <span class="hint">Only the team sees these</span><textarea class="in" id="nt" name="notes" rows="6" maxlength="4000">${esc(a.team_notes)}</textarea></label>
          <button class="btn btn-p" type="submit">Save</button>
          <p class="xs muted">Last updated ${when(a.updated_at)}</p>
        </form>
      </aside>
    </div>`);
}
