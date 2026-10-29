import { APP_STATUSES, type ApplicationRow } from "../services/applications";
import { esc, ic } from "./ui";

const STATUS_BADGE: Record<string, string> = { new: "b-blush", reviewing: "b-warn", approved: "b-ok", declined: "b-plain" };
const badge = (s: string) => `<span class="badge ${STATUS_BADGE[s] ?? "b-plain"}">${esc(s[0].toUpperCase() + s.slice(1))}</span>`;
const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

const shell = (body: string) => `<div class="page"><div class="ops-bar"><span class="eyebrow">Aestheva team</span><form method="post" action="/ops/logout"><button class="btn btn-g btn-s" type="submit">${ic("out", 15)} Sign out</button></form></div>${body}</div>`;

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

export function opsDetailPage(a: ApplicationRow, csrf: string, draft: unknown, catName: (id: string) => string, saved = false) {
  const cats: string[] = (() => { try { return JSON.parse(a.categories_json); } catch { return []; } })();
  const row = (k: string, v: string) => v ? `<dt>${k}</dt><dd>${v}</dd>` : "";
  const web = a.website ? (/^https?:\/\//i.test(a.website) ? `<a href="${esc(a.website)}" target="_blank" rel="noopener noreferrer">${esc(a.website)}</a>` : esc(a.website)) : "";
  return shell(`<a class="btn btn-g btn-s" href="/ops/applications" style="margin-left:-10px">${ic("chevL", 16)} All applications</a>
    ${saved ? `<div class="form-ok mt12" role="status">Saved.</div>` : ""}
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
