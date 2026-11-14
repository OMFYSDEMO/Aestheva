// Pages for the leadership record (/leadership) and the team area's page for managing leaders' logins.
import { ADD_KINDS, CHANNELS, KIND_LABEL, MAX_FILES, filesOf, type AgreementStatus, type Entry, type Kind, type Leader } from "../services/leadership";
import { esc, ic } from "./ui";

const logo = `<div class="logo"><span class="wm">aestheva</span><span class="logo-sub">leadership</span></div>`;
const card = (inner: string) => `<div class="page narrow" style="max-width:480px;padding-top:56px"><div class="card">${logo}${inner}</div></div>`;
const when = (iso: string) => iso.replace("T", " ").slice(0, 16) + " UTC";
const kb = (n: number) => (n < 1024 * 1024 ? `${Math.ceil(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);
const KIND_BADGE: Partial<Record<Kind, string>> = { agreement: "b-blush", revision: "b-blush", confirm: "b-ok", dispute: "b-med", correction: "b-med", access: "", opened: "" };
export const kindBadge = (k: Kind) => `<span class="badge ${KIND_BADGE[k] ?? ""}">${esc(KIND_LABEL[k])}</span>`;

// ---------- sign-in ----------
export function leaderLoginPage(error = "", notice = "") {
  return card(`<h1 class="mt8" style="font-size:34px">Sign in</h1><p class="small muted mt8">The private record of Aestheva’s leadership. Only leaders with their own login can open it.</p>
    ${notice ? `<div class="form-ok mt12" role="status">${esc(notice)}</div>` : ""}${error ? `<div class="form-error mt12" role="alert">${esc(error)}</div>` : ""}
    <form method="post" action="/leadership/login" class="col mt16" style="gap:12px">
      <label class="f" for="ll-email">Email<input class="in" id="ll-email" name="email" type="email" autocomplete="username" required autofocus></label>
      <label class="f" for="ll-pw">Password<input class="in" id="ll-pw" name="password" type="password" autocomplete="current-password" required></label>
      <button class="btn btn-p" type="submit">Sign in</button></form>
    <p class="small mt16"><a href="/leadership/forgot">Forgot your password?</a></p>`);
}
export function leaderSetPasswordPage(d: { token: string; email: string; invite: boolean; error?: string }) {
  return card(`<h1 class="mt8" style="font-size:32px">${d.invite ? "Set your password" : "Choose a new password"}</h1>
    <p class="small muted mt8">For <b>${esc(d.email)}</b>. Use at least 10 characters; a short phrase only you would think of is easy to remember and hard to guess.</p>
    ${d.error ? `<div class="form-error mt12" role="alert">${esc(d.error)}</div>` : ""}
    <form method="post" action="/leadership/set-password" class="col mt16" style="gap:12px"><input type="hidden" name="t" value="${esc(d.token)}">
      <input type="text" name="username" value="${esc(d.email)}" autocomplete="username" hidden>
      <label class="f" for="lp1">New password<input class="in" id="lp1" name="password" type="password" autocomplete="new-password" minlength="10" required></label>
      <label class="f" for="lp2">Type it again<input class="in" id="lp2" name="confirm" type="password" autocomplete="new-password" minlength="10" required></label>
      <button class="btn btn-p" type="submit">Save password</button></form>`);
}
export const leaderLinkInvalidPage = () => card(`<h1 class="mt8" style="font-size:30px">This link has expired</h1>
  <p class="small muted mt8">Set-password links work once, for a limited time. Ask for a new one below.</p>
  <div class="row wrap mt16" style="gap:8px"><a class="btn btn-p btn-s" href="/leadership/forgot">Email me a new link</a><a class="btn btn-o btn-s" href="/leadership/login">Sign in</a></div>`);
export function leaderForgotPage(sent = false) {
  return card(`<h1 class="mt8" style="font-size:30px">Forgot your password?</h1>
    ${sent ? `<div class="form-ok mt12" role="status">If that email has a leadership login, we’ve sent it a link to choose a new password. It works for 1 hour.</div><p class="small mt16"><a href="/leadership/login">Back to sign in</a></p>`
    : `<p class="small muted mt8">Enter your login email and we’ll send you a link to choose a new password.</p>
      <form method="post" action="/leadership/forgot" class="col mt16" style="gap:12px"><label class="f" for="lf">Email<input class="in" id="lf" name="email" type="email" autocomplete="username" required></label><button class="btn btn-p" type="submit">Send the link</button></form>
      <p class="small mt16"><a href="/leadership/login">Back to sign in</a></p>`}`);
}

// ---------- the record ----------
export type LeaderSection = "record" | "agreements" | "new";
const NAV: [LeaderSection, string, string][] = [["record", "/leadership", "The record"], ["agreements", "/leadership/agreements", "Agreements"], ["new", "/leadership/new", "Add an entry"]];
export function leaderShell(d: { leader: Leader; section: LeaderSection; csrf: string }, body: string) {
  return `<div class="page">
    <div class="row wrap between" style="gap:12px"><div><div class="eyebrow">Aestheva · Leadership record</div><div class="small muted">${esc(d.leader.name)} · ${esc(d.leader.role)}</div></div>
      <form method="post" action="/leadership/logout"><input type="hidden" name="csrf" value="${esc(d.csrf)}"><button class="btn btn-g btn-s" type="submit">${ic("out", 15)} Sign out</button></form></div>
    <nav class="chips mt16 scroll-x" style="flex-wrap:nowrap" aria-label="Leadership record">${NAV.map(([k, href, label]) => `<a class="chip ${d.section === k ? "on" : ""}" href="${href}"${d.section === k ? ' aria-current="page"' : ""}>${label}</a>`).join("")}
      <a class="chip" href="/leadership/print">Print the whole record</a><a class="chip" href="/leadership/record.csv">Download (CSV)</a></nav>
    <div class="mt24">${body}</div></div>`;
}

export function chainNote(chain: { ok: boolean; count: number; brokenAt?: number; last?: string }) {
  return chain.ok
    ? `<div class="note n-plain">${ic("shield", 16)}<div><b>Record intact.</b> ${chain.count} ${chain.count === 1 ? "entry" : "entries"}, each linked to the one before; nothing has been changed or removed. Latest fingerprint <code style="font-size:12px">${esc((chain.last ?? "").slice(0, 16))}…</code></div></div>`
    : `<div class="note n-warn" role="alert">${ic("alert", 16)}<div><b>The record does not check out from entry #${chain.brokenAt}.</b> An entry has been changed, removed or reordered outside this page. Compare with your emailed copies and tell the other leader.</div></div>`;
}

function statusLine(s: AgreementStatus) {
  if (s.supersededBy) return `<span class="badge">Replaced by #${s.supersededBy}</span>`;
  const disputed = s.answers.filter((a) => a.kind === "dispute"), confirmed = s.answers.filter((a) => a.kind === "confirm");
  if (disputed.length) return `<span class="badge b-med">Disputed by ${esc(disputed.map((a) => a.leader).join(", "))}</span>`;
  if (s.awaiting.length) return `<span class="badge b-blush">Waiting for ${esc(s.awaiting.join(", "))}</span>`;
  return confirmed.length ? `<span class="badge b-ok">Agreed · confirmed ${esc(confirmed.map((a) => a.on).join(", "))}</span>` : `<span class="badge">No one else to confirm yet</span>`;
}

export function recordPage(d: { all: Entry[]; chain: Parameters<typeof chainNote>[0]; statuses: AgreementStatus[]; newest: boolean }) {
  const st = new Map(d.statuses.map((s) => [s.entry.seq, s]));
  const list = d.newest ? [...d.all].reverse() : d.all;
  return `${chainNote(d.chain)}
    <div class="row wrap between mt16" style="gap:8px"><h1 style="font-size:clamp(28px,4vw,36px)">The record</h1>
      <div class="row wrap" style="gap:8px"><a class="btn btn-o btn-s" href="/leadership${d.newest ? "" : "?order=newest"}">${d.newest ? "Oldest first" : "Newest first"}</a><a class="btn btn-p btn-s" href="/leadership/new">${ic("plus", 15)} Add an entry</a></div></div>
    <p class="small muted mt8">Every communication, document and agreement between Aestheva’s leaders, numbered in the order it was recorded. Entries can’t be changed or deleted: a correction or a new version is a new entry that points to the earlier one.</p>
    <div class="tbl-wrap mt16"><table class="tbl"><thead><tr><th>#</th><th>Happened</th><th>Entry</th><th>Recorded by</th><th>Status</th></tr></thead><tbody>
      ${list.map((e) => `<tr><td><a href="/leadership/entries/${e.seq}"><b>#${e.seq}</b></a></td>
        <td class="small">${esc(e.occurred_on)}${e.channel ? `<div class="xs muted">${esc(e.channel)}</div>` : ""}</td>
        <td>${kindBadge(e.kind)} <a href="/leadership/entries/${e.seq}"><b>${esc(e.title)}</b></a>${e.refers_to ? ` <span class="xs muted">→ #${e.refers_to}</span>` : ""}${filesOf(e).length ? ` <span class="xs muted">· ${filesOf(e).length} file${filesOf(e).length === 1 ? "" : "s"}</span>` : ""}</td>
        <td class="small">${esc(e.author_name)}<div class="xs muted">${esc(when(e.recorded_at))}</div></td>
        <td>${st.has(e.seq) ? statusLine(st.get(e.seq)!) : ""}</td></tr>`).join("")}
    </tbody></table></div>`;
}

export function agreementsPage(d: { statuses: AgreementStatus[] }) {
  return `<h1 style="font-size:clamp(28px,4vw,36px)">Agreements</h1>
    <p class="small muted mt8">What the leaders have agreed in principle (objectives, roadmaps, terms), and where each stands. An agreement is agreed once every other leader has confirmed it. A new version replaces the old one, which stays in the record.</p>
    ${d.statuses.length ? `<div class="tbl-wrap mt16"><table class="tbl"><thead><tr><th>#</th><th>Agreement</th><th>Proposed</th><th>Where it stands</th></tr></thead><tbody>
      ${d.statuses.map((s) => `<tr><td><a href="/leadership/entries/${s.entry.seq}"><b>#${s.entry.seq}</b></a></td><td><b>${esc(s.entry.title)}</b>${s.entry.kind === "revision" ? `<div class="xs muted">New version of #${s.entry.refers_to}</div>` : ""}</td>
        <td class="small">${esc(s.entry.author_name)}<div class="xs muted">${esc(s.entry.occurred_on)}</div></td><td>${statusLine(s)}${s.answers.length ? `<div class="xs muted mt4">${s.answers.map((a) => `${esc(a.leader)}: ${a.kind === "confirm" ? "confirmed" : "disputed"} in #${a.seq}`).join(" · ")}</div>` : ""}</td></tr>`).join("")}
    </tbody></table></div>` : `<div class="card mt16" style="text-align:center;padding:36px"><p class="muted">No agreements yet. Add one with <a href="/leadership/new?kind=agreement">Add an entry › Agreement in principle</a>.</p></div>`}`;
}

export function entryPage(d: { e: Entry; responses: Entry[]; status?: AgreementStatus; canRespond: boolean; csrf: string; error?: string; message?: string }) {
  const e = d.e, files = filesOf(e);
  return `<a class="btn btn-g btn-s" href="/leadership" style="margin-left:-10px">${ic("chevL", 16)} The record</a>
    ${d.message ? `<div class="form-ok mt12" role="status">${esc(d.message)}</div>` : ""}${d.error ? `<div class="form-error mt12" role="alert">${esc(d.error)}</div>` : ""}
    <div class="card mt12"><div class="row wrap between" style="gap:8px"><div><div class="eyebrow">Entry #${e.seq} · ${esc(KIND_LABEL[e.kind])}</div><h1 class="mt8" style="font-size:30px">${esc(e.title)}</h1></div>${d.status ? statusLine(d.status) : ""}</div>
      <dl class="kv mt16"><dt>Happened on</dt><dd>${esc(e.occurred_on)}${e.channel ? ` · ${esc(e.channel)}` : ""}</dd><dt>Recorded</dt><dd>${esc(when(e.recorded_at))} by ${esc(e.author_name)}</dd>
        ${e.refers_to ? `<dt>Refers to</dt><dd><a href="/leadership/entries/${e.refers_to}">Entry #${e.refers_to}</a></dd>` : ""}</dl>
      ${e.body ? `<div class="mt16" style="white-space:pre-wrap;line-height:1.6">${esc(e.body)}</div>` : ""}
      ${files.length ? `<h2 class="mt24" style="font-size:18px">Files</h2><ul class="mt8" style="padding-left:18px">${files.map((f, i) => `<li class="small"><a href="/leadership/files/${e.seq}/${i + 1}">${esc(f.name)}</a> <span class="muted">· ${kb(f.size)}</span><div class="xs muted" style="word-break:break-all">SHA-256 ${esc(f.sha256)}</div></li>`).join("")}</ul>` : ""}
      <p class="xs muted mt16" style="word-break:break-all">Fingerprint ${esc(e.hash)}<br>Previous ${esc(e.prev_hash)}</p></div>
    ${d.responses.length ? `<div class="card mt16"><h2 style="font-size:20px">Later entries about this one</h2><ul class="mt8" style="padding-left:18px">${d.responses.map((r) => `<li class="small">${kindBadge(r.kind)} <a href="/leadership/entries/${r.seq}">#${r.seq} ${esc(r.title)}</a> <span class="muted">· ${esc(r.author_name)}, ${esc(r.recorded_at.slice(0, 10))}</span>${r.body && (r.kind === "confirm" || r.kind === "dispute") ? `<div class="muted" style="white-space:pre-wrap">${esc(r.body)}</div>` : ""}</li>`).join("")}</ul></div>` : ""}
    ${d.canRespond ? `<form class="card mt16 col" style="gap:12px;max-width:720px" method="post" action="/leadership/entries/${e.seq}/respond"><input type="hidden" name="csrf" value="${esc(d.csrf)}">
      <b>Confirm or dispute this entry</b><p class="small muted">Your answer is added to the record as a new entry and emailed to every leader. You can change your mind later with a new answer; both stay in the record.</p>
      <label class="f" for="rc">Comment <span class="hint">needed to dispute; optional to confirm</span><textarea class="in" id="rc" name="comment" rows="3" maxlength="4000"></textarea></label>
      <div class="row wrap" style="gap:8px"><button class="btn btn-ok btn-s" type="submit" name="answer" value="confirm">Confirm</button><button class="btn btn-o btn-s" type="submit" name="answer" value="dispute">Dispute</button></div></form>` : ""}
    <p class="small mt16"><a href="/leadership/new?kind=correction&amp;ref=${e.seq}">Add a correction to this entry</a>${e.kind === "agreement" || e.kind === "revision" ? ` · <a href="/leadership/new?kind=revision&amp;ref=${e.seq}">Propose a new version</a>` : ""}</p>`;
}

type Form = Record<string, string>;
export function newEntryPage(d: { values: Form; errors: Record<string, string>; csrf: string; today: string }) {
  const v = d.values, e = d.errors;
  const err = (k: string) => (e[k] ? `<span class="f-err" id="err-${k}">${esc(e[k])}</span>` : "");
  const inv = (k: string) => (e[k] ? ` aria-invalid="true" aria-describedby="err-${k}"` : "");
  const n = Object.keys(e).length;
  return `<h1 style="font-size:clamp(28px,4vw,36px)">Add an entry</h1>
    <p class="small muted mt8">Add things in the order they happen, or record something earlier by giving the date it happened. Once saved, an entry can’t be changed or deleted, and it is emailed to every leader.</p>
    ${n ? `<div class="form-error mt12" role="alert">Please check ${n} answer${n === 1 ? "" : "s"} below.</div>` : ""}
    <form class="card mt16 col" style="gap:14px;max-width:820px" method="post" action="/leadership/new" enctype="multipart/form-data"><input type="hidden" name="csrf" value="${esc(d.csrf)}">
      <fieldset class="f"><legend>What is it?</legend>${err("kind")}<div class="col mt8" style="gap:8px">${ADD_KINDS.map(([k, label, hint]) => `<label class="row" style="gap:10px;align-items:flex-start"><input type="radio" name="kind" value="${k}" ${v.kind === k ? "checked" : ""} required style="margin-top:4px"><span><b>${label}</b><br><span class="xs muted">${hint}</span></span></label>`).join("")}</div></fieldset>
      <div class="grid g2"><label class="f" for="ne-on">Date it happened<input class="in" id="ne-on" name="occurred_on" type="date" max="${esc(d.today)}" value="${esc(v.occurred_on ?? d.today)}" required${inv("occurred_on")}>${err("occurred_on")}</label>
        <label class="f" for="ne-ch">How<select class="in" id="ne-ch" name="channel"${inv("channel")}><option value="">Choose one</option>${CHANNELS.map((c) => `<option ${v.channel === c ? "selected" : ""}>${c}</option>`).join("")}</select>${err("channel")}</label></div>
      <label class="f" for="ne-t">Title<input class="in" id="ne-t" name="title" maxlength="140" required value="${esc(v.title ?? "")}" placeholder="12-month plan agreed in principle"${inv("title")}>${err("title")}</label>
      <label class="f" for="ne-b">What was said, shared or agreed <span class="hint">in full, or a faithful summary</span><textarea class="in" id="ne-b" name="body" rows="8" maxlength="20000"${inv("body")}>${esc(v.body ?? "")}</textarea>${err("body")}</label>
      <label class="f" for="ne-r">Refers to entry number <span class="hint">needed for a correction or a new version</span><input class="in" id="ne-r" name="refers_to" inputmode="numeric" style="max-width:160px" value="${esc(v.refers_to ?? "")}"${inv("refers_to")}>${err("refers_to")}</label>
      <label class="f" for="ne-f">Files <span class="hint">up to ${MAX_FILES}, 10 MB each: PDF, Word, Excel, PowerPoint, photos, text or a saved email (.eml)</span><input class="in" id="ne-f" name="files" type="file" multiple accept=".pdf,.docx,.xlsx,.pptx,.jpg,.jpeg,.png,.webp,.txt,.eml"${inv("files")}>${err("files")}</label>
      <div><button class="btn btn-p" type="submit">Add to the record</button></div></form>`;
}

export function printPage(d: { all: Entry[]; chain: Parameters<typeof chainNote>[0]; printedBy: string; at: string }) {
  return `<div class="page statement"><div class="row wrap between"><div><div class="eyebrow">Aestheva · Leadership record</div><h1 class="mt8" style="font-size:32px">The complete record</h1>
      <p class="small muted">Printed ${esc(when(d.at))} by ${esc(d.printedBy)} · ${d.all.length} entries</p></div><p class="no-print"><button class="btn btn-o btn-s" type="button" onclick="print()">${ic("doc", 15)} Print or save as PDF</button></p></div>
    <div class="mt16">${chainNote(d.chain)}</div>
    ${d.all.map((e) => `<div class="mt16" style="border-top:1px solid var(--line);padding-top:12px;break-inside:avoid"><div class="row wrap between"><b>#${e.seq} · ${esc(KIND_LABEL[e.kind])}: ${esc(e.title)}</b><span class="xs muted">Happened ${esc(e.occurred_on)}${e.channel ? `, ${esc(e.channel)}` : ""}</span></div>
      <div class="xs muted">Recorded ${esc(when(e.recorded_at))} by ${esc(e.author_name)}${e.refers_to ? ` · refers to #${e.refers_to}` : ""}</div>
      ${e.body ? `<div class="small mt8" style="white-space:pre-wrap">${esc(e.body)}</div>` : ""}
      ${filesOf(e).length ? `<div class="xs mt8">Files: ${filesOf(e).map((f) => `${esc(f.name)} (SHA-256 ${esc(f.sha256)})`).join("; ")}</div>` : ""}
      <div class="xs muted mt4" style="word-break:break-all">Fingerprint ${esc(e.hash)}</div></div>`).join("")}</div>`;
}

// ---------- the team area: managing leaders' logins ----------
export function leadersAdminPage(d: { leaders: Leader[]; csrf: string; message?: string; error?: string; link?: string; values?: Record<string, string> }) {
  const set = (l: Leader) => !l.password_hash.startsWith("unset$");
  const btn = (l: Leader, path: string, label: string, cls = "btn-o") => `<form method="post" action="/ops/leadership/${esc(l.id)}/${path}"><input type="hidden" name="csrf" value="${esc(d.csrf)}"><button class="btn ${cls} btn-x" type="submit">${label}</button></form>`;
  const v = d.values ?? {};
  return `<div class="row wrap between mt8"><h1 style="font-size:40px">Leadership</h1><a class="btn btn-p btn-s" href="/leadership">Open the leadership record</a></div>
    <p class="small muted mt8" style="max-width:780px">The leadership record is a private, append-only record of the communications, documents and agreements between Aestheva’s leaders. It has its own logins: the team key gives no access to it. Here you can give a leader a login. Every change of access is added to the record itself, so every leader sees it.</p>
    ${d.message ? `<div class="form-ok mt12" role="status">${esc(d.message)}</div>` : ""}${d.error ? `<div class="form-error mt12" role="alert">${esc(d.error)}</div>` : ""}
    ${d.link ? `<div class="note n-warn mt12">${ic("alert", 16)}<div class="small">The email couldn’t be sent. Send this one-time link yourself, privately, to that leader only. It works for 3 days:<br><code style="word-break:break-all">${esc(d.link)}</code></div></div>` : ""}
    ${d.leaders.length ? `<div class="tbl-wrap mt16"><table class="tbl"><thead><tr><th>Leader</th><th>Login</th><th>Last sign-in</th><th></th></tr></thead><tbody>
      ${d.leaders.map((l) => `<tr><td><b>${esc(l.name)}</b><div class="xs muted">${esc(l.role)}</div></td><td class="small">${esc(l.email)}<div class="xs muted">${!l.active ? "Turned off" : set(l) ? "Password set" : "Invited; password not set yet"}</div></td>
        <td class="small">${l.last_login_at ? esc(l.last_login_at.slice(0, 10)) : "—"}</td>
        <td><div class="row wrap" style="gap:6px">${l.active ? `${btn(l, "invite", set(l) ? "Send a set-password link" : "Send the invitation")}${btn(l, "off", "Turn off", "btn-g")}` : btn(l, "on", "Turn back on")}</div></td></tr>`).join("")}
    </tbody></table></div>` : ""}
    <h2 class="mt32" style="font-size:24px">Give a leader a login</h2>
    <form class="card col mt12" style="gap:12px;max-width:640px" method="post" action="/ops/leadership"><input type="hidden" name="csrf" value="${esc(d.csrf)}">
      <div class="grid g2"><label class="f">Full name<input class="in" name="name" required maxlength="80" value="${esc(v.name ?? "")}"></label><label class="f">Role<input class="in" name="role" required maxlength="80" placeholder="Chief Executive Officer" value="${esc(v.role ?? "")}"></label></div>
      <label class="f">Email <span class="hint">their login; the invitation goes here</span><input class="in" name="email" type="email" required maxlength="120" value="${esc(v.email ?? "")}"></label>
      <div><button class="btn btn-p btn-s" type="submit">Add leader</button></div></form>`;
}
