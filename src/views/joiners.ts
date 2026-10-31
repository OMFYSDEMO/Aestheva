// The onboarding desk: every new joiner's progress in one grid, with a one-click reminder of what's left.
import { fmtDate } from "../domain/time";
import type { JoinerRow } from "../services/joiners";
import { esc, ic } from "./ui";

const ago = (iso: string | null, now: number) => {
  if (!iso) return "never";
  const h = Math.floor((now - Date.parse(iso)) / 36e5);
  return h < 1 ? "just now" : h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
};
const STAGE: Record<string, [string, string]> = { setup: ["b-plain", "Setting up"], review: ["b-warn", "Ready for your review"], live: ["b-ok", "Live, steps left"] };
const SHORT: Record<string, string> = { details: "Business", photos: "Photos", team: "Team", treatments: "Services", documents: "Documents", terms: "Terms" };

export function joinersPage(d: { rows: JoinerRow[]; csrf: string; now: number; message?: string }) {
  const count = (f: (r: JoinerRow) => boolean) => d.rows.filter(f).length;
  const tick = (ok: boolean, title: string) => `<span class="jx ${ok ? "ok" : "no"}" title="${esc(title)}">${ok ? ic("check", 14) : "–"}</span>`;
  const keys = Object.keys(SHORT);
  return `<h1 class="mt8" style="font-size:40px">New joiners</h1>
    <p class="small muted mt8" style="max-width:760px">Every business that hasn't finished joining, with each step it has done. Hover a cell for detail. <b>Email what's left</b> sends each person at the business a list of their outstanding steps, a line on why each matters and a link straight to it, plus your note. Anyone who hasn't set a password gets a fresh link.</p>
    ${d.message ? `<div class="form-ok mt12" role="status">${esc(d.message)}</div>` : ""}
    <div class="grid g4 kpis mt16">
      <div class="kpi"><div class="l">Ready for your review</div><div class="v">${count((r) => r.stage === "review")}</div><div class="d">check documents, then publish</div></div>
      <div class="kpi"><div class="l">Setting up</div><div class="v">${count((r) => r.stage === "setup")}</div><div class="d">working through the steps</div></div>
      <div class="kpi"><div class="l">Not signed in yet</div><div class="v">${count((r) => !r.users.some((u) => u.lastLogin))}</div><div class="d">invitation not used</div></div>
      <div class="kpi"><div class="l">Stuck</div><div class="v">${count((r) => r.stuck)}</div><div class="d">nothing from them in 3 days</div></div>
    </div>
    ${d.rows.length ? `<div class="tbl-wrap mt16"><table class="tbl joiners"><thead><tr><th>Business</th><th>Signed in</th>${keys.map((k) => `<th>${SHORT[k]}</th>`).join("")}<th>Last activity</th><th>Reminder</th></tr></thead><tbody>
      ${d.rows.map((r) => {
        const signed = r.users.find((u) => u.lastLogin);
        return `<tr class="${r.stuck ? "stuck" : ""}">
          <td><a href="/ops/venues/${esc(r.id)}"><b>${esc(r.name)}</b></a><div class="xs muted">${esc(r.type)}${r.area ? ` · ${esc(r.area)}` : ""} · joined ${r.joined ? fmtDate(r.joined.slice(0, 10)) : ""}</div>
            <div class="row wrap mt8" style="gap:6px"><span class="badge ${STAGE[r.stage]?.[0] ?? "b-plain"}">${STAGE[r.stage]?.[1] ?? esc(r.stage)}</span>${r.stuck ? '<span class="badge b-err">Stuck</span>' : ""}<span class="xs muted">${r.done} of ${r.total} steps</span></div></td>
          <td>${tick(!!signed, signed ? `Signed in ${ago(signed.lastLogin, d.now)}` : r.users.length ? `Invited: ${r.users.map((u) => u.email).join(", ")}` : "No login yet: create one in Clinic logins")}</td>
          ${keys.map((k) => { const s = r.steps.find((x) => x.key === k)!; return `<td>${tick(s.done, `${s.title}: ${s.summary}`)}</td>`; }).join("")}
          <td class="small">${ago(r.lastActivity, d.now)}</td>
          <td style="min-width:220px">${r.stage === "review" ? `<a class="btn btn-p btn-x" href="/ops/venues/${esc(r.id)}">Review now</a>`
            : r.tasks.length && r.users.length ? `<details><summary class="small"><b>Email what's left</b> <span class="xs muted">(${r.tasks.length})</span></summary>
              <form method="post" action="/ops/joiners/${esc(r.id)}/nudge" class="col mt8" style="gap:6px"><input type="hidden" name="csrf" value="${esc(d.csrf)}">
                <ul class="xs muted" style="margin:0;padding-left:16px">${r.tasks.map((t) => `<li>${esc(t.title)}</li>`).join("")}</ul>
                <textarea class="in" name="note" rows="2" maxlength="600" placeholder="Optional note, for example: Your photos look great. Just the PAN and documents left."></textarea>
                <button class="btn btn-p btn-x" type="submit">Send to ${r.users.length === 1 ? esc(r.users[0].email) : `${r.users.length} people`}</button></form></details>` : r.users.length ? "" : `<a class="small" href="/ops/clinics">Create a login</a>`}
            <div class="xs muted mt8">Last reminder: ${ago(r.lastNudge, d.now)}</div></td>
        </tr>`;
      }).join("")}
    </tbody></table></div>` : `<div class="card mt16" style="text-align:center;padding:40px"><p class="muted">Everyone who joined has finished. New applications appear under Applications.</p></div>`}
    <aside class="card tips mt24"><b>The onboarding desk, every day</b><ul>
      <li><b>Ready for your review</b> first: open each, check every document against its council or register, add verification labels, then publish or send back with a note. Aim for two working days.</li>
      <li><b>Not signed in</b> after 2 days: email what's left (it includes a fresh password link), then call if there's still nothing a day later.</li>
      <li><b>Stuck</b> (nothing for 3 days): email what's left with a short personal note; call the next day.</li>
      <li>New applications are under Applications: approve the right ones the same day, so they appear here.</li>
    </ul></aside>`;
}
