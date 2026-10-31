// New joiners: where every business that hasn't finished setting up stands, and a one-click reminder of what's left.
// This is the Aestheva onboarding desk's daily view (/ops/joiners).
import type { Env } from "../env";
import { COMPANY } from "../config";
import { audit } from "../db";
import { checklist, listing, STAGE } from "./onboarding";
import { issuePasswordLink } from "./clinic";
import { sendEmail } from "./notify";

export type TaskKey = "signin" | "details" | "photos" | "team" | "treatments" | "documents" | "terms" | "submit";
export interface Task { key: TaskKey; title: string; why: string; href: string }

/** What each outstanding step asks of the business, and why, in the words the reminder email uses. */
function taskFor(key: TaskKey, ctx: { medical: boolean; noPan: boolean; onlyPan: boolean }): Task {
  const t: Record<TaskKey, [string, string, string]> = {
    signin: ["Set your password and sign in", "Use the link below. It's how you'll see your bookings, calendar and payments.", "/clinic/login"],
    details: ctx.onlyPan
      ? ["Add your PAN under Your business", "Aestheva deducts a small income-tax TDS on your bookings, as every marketplace must, and it is credited against your PAN so you can claim it back.", "/clinic/setup/details"]
      : ["Fill in Your business", `Your address, phone, opening hours and a short introduction are what clients read first.${ctx.noPan ? " Add your PAN too: the small income-tax TDS deducted on your bookings is credited against it." : ""}`, "/clinic/setup/details"],
    photos: ["Add photos", "At least one photo of your space or your work. Listings with 3 or more photos get more bookings.", "/clinic/setup/photos"],
    team: ["Add yourself and your team, with working hours", "Clients book a person, and online booking only offers the hours you set for each of them.", "/clinic/setup/team"],
    treatments: ["Add your services and prices", "Each service needs a price, how long it takes and who does it, so clients can book it.", "/clinic/setup/treatments"],
    documents: ["Upload your verification documents",
      ctx.medical ? "The council registration for each doctor or dentist, and your clinic or business registration. Only the Aestheva team sees them."
        : "A training certificate or a portfolio of your work, and an ID or business proof such as PAN, GST or a trade licence. Only the Aestheva team sees them.", "/clinic/setup/documents"],
    terms: ["Read and accept the terms", "Commission, cancellations and data protection, in plain words. It takes a few minutes.", "/clinic/setup/terms"],
    submit: ["Submit for review", "Everything is filled in. Press Submit for review and we'll check your listing within two working days.", "/clinic/setup"],
  };
  const [title, why, href] = t[key];
  return { key, title, why, href };
}

export interface JoinerRow {
  id: string; name: string; type: string; area: string; stage: string; joined: string;
  users: { id: string; name: string; email: string; passwordSet: boolean; lastLogin: string | null }[];
  steps: { key: string; title: string; done: boolean; summary: string }[];
  done: number; total: number; tasks: Task[]; lastActivity: string | null; lastNudge: string | null; stuck: boolean;
}

const DAY = 864e5;

/** Every business still joining: not yet live, or live with steps left. Haswel Care's own businesses are left out. */
export async function joinerRows(db: D1Database, now: Date = new Date()): Promise<JoinerRow[]> {
  const ps = (await db.prepare("SELECT id FROM providers WHERE payout_mode <> 'own' AND status <> 'paused' ORDER BY created_at").all<{ id: string }>()).results;
  const rows: JoinerRow[] = [];
  for (const { id } of ps) {
    const l = await listing(db, id), ch = checklist(l), stage = STAGE(l.p);
    if (stage === "live" && ch.complete) continue;
    const users = (await db.prepare("SELECT id, name, email, password_hash, last_login_at FROM provider_users WHERE provider_id = ? AND active = 1 ORDER BY created_at").bind(id)
      .all<{ id: string; name: string; email: string; password_hash: string; last_login_at: string | null }>()).results
      .map((u) => ({ id: u.id, name: u.name, email: u.email, passwordSet: !u.password_hash.startsWith("unset$"), lastLogin: u.last_login_at }));
    const actors = users.map((u) => `provider_user:${u.id}`);
    const [act, nudge] = await Promise.all([
      actors.length ? db.prepare(`SELECT MAX(at) AS at FROM audit_log WHERE actor IN (${actors.map(() => "?").join(",")})`).bind(...actors).first<{ at: string | null }>() : Promise.resolve(null),
      db.prepare("SELECT MAX(at) AS at FROM audit_log WHERE action = 'provider.nudged' AND entity_id = ?").bind(id).first<{ at: string | null }>(),
    ]);
    const signedIn = users.some((u) => u.lastLogin);
    // A clinic counts as medical even before it has added doctors or treatments.
    const p = l.p, detailsFilled = !!(p.tagline && p.about && p.hours_text && p.area && p.phone);
    const ctx = { medical: ch.medical || p.type === "Clinic", noPan: !p.pan, onlyPan: detailsFilled && !p.pan };
    const tasks: Task[] = [
      ...(signedIn ? [] : [taskFor("signin", ctx)]),
      ...ch.steps.filter((s) => !s.done).map((s) => taskFor(s.key as TaskKey, ctx)),
      ...(stage === "setup" && ch.complete ? [taskFor("submit", ctx)] : []),
    ];
    const lastActivity = act?.at ?? null;
    const joined = (l.p as { created_at?: string }).created_at ?? "";
    const quietSince = Date.parse(lastActivity ?? (joined || now.toISOString()));
    rows.push({
      id, name: l.p.name, type: l.p.type, area: l.p.area, stage, joined,
      users, steps: ch.steps.map((s) => ({ key: s.key, title: s.title, done: s.done, summary: s.summary })), done: ch.done, total: ch.steps.length,
      tasks, lastActivity, lastNudge: nudge?.at ?? null,
      // Nothing from the business for 3 days, while it still has work to do.
      stuck: stage !== "review" && tasks.length > 0 && now.getTime() - quietSince > 3 * DAY,
    });
  }
  // Ready for the team to review first, then the stuck, then the rest by progress.
  const rank = (r: JoinerRow) => (r.stage === "review" ? 0 : r.stuck ? 1 : 2);
  return rows.sort((a, b) => rank(a) - rank(b) || a.done - b.done);
}

/**
 * Emails each login at a business the steps it has left, each with a line on why, plus the team's note.
 * Anyone who hasn't set a password yet gets a fresh set-password link in their own email.
 */
export async function nudge(env: Env, providerId: string, note: string, site: string) {
  const row = (await joinerRows(env.DB)).find((r) => r.id === providerId);
  if (!row) return { sent: 0, tasks: 0 };
  note = note.trim().slice(0, 600);
  let sent = 0;
  for (const u of row.users) {
    const link = u.passwordSet ? null : `${site}/clinic/set-password?t=${await issuePasswordLink(env.DB, u.id, "invite", "ops")}`;
    const tasks = row.tasks.filter((t) => t.key !== "signin" || !u.passwordSet);
    if (!tasks.length) continue;
    const first = u.name.replace(/^(dr|mr|mrs|ms|miss|prof)\.?\s+/i, "").split(" ")[0] || u.name;
    const items = tasks.map((t, i) => ({ n: i + 1, t, url: t.key === "signin" && link ? link : site + t.href }));
    const subject = `${row.name}: ${tasks.length} step${tasks.length === 1 ? "" : "s"} left to go live on Aestheva`;
    const intro = row.stage === "live" ? `${row.name} is live on Aestheva. A few things on your listing still need finishing:` : `You're nearly there. To publish ${row.name} on Aestheva, here's what's left:`;
    const text = [`Hello ${first},`, ...(note ? [note] : []), intro, ...items.map((x) => `${x.n}. ${x.t.title}\n   ${x.t.why}\n   ${x.url}`),
      `Your checklist always shows where you are: ${site}/clinic/setup`, `Questions? Reply to this email or call us on ${COMPANY.supportPhone}.`, "Aestheva onboarding team"].join("\n\n");
    const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
    const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#302A2E;line-height:1.55;max-width:560px">
      <p>Hello ${esc(first)},</p>${note ? `<p style="background:#FBF5F7;border-left:3px solid #8A2E5C;padding:10px 14px">${esc(note).replace(/\n/g, "<br>")}</p>` : ""}<p>${esc(intro)}</p>
      <ol style="padding-left:20px">${items.map((x) => `<li style="margin-bottom:12px"><b>${esc(x.t.title)}</b><br><span style="color:#5F565B">${esc(x.t.why)}</span><br><a href="${esc(x.url)}" style="color:#8A2E5C">${x.t.key === "signin" ? "Set your password" : "Open this step"}</a></li>`).join("")}</ol>
      <p>Your checklist always shows where you are: <a href="${site}/clinic/setup" style="color:#8A2E5C">${site.replace(/^https?:\/\//, "")}/clinic/setup</a></p>
      <p>Questions? Reply to this email or call us on ${esc(COMPANY.supportPhone)}.</p><p>Aestheva onboarding team</p></div>`;
    const r = await sendEmail(env, u.email, { subject, text, html });
    if (r.ok) sent++;
  }
  await audit(env.DB, "ops", "provider.nudged", "provider", providerId, { sent, tasks: row.tasks.map((t) => t.key), note: note || undefined }).run();
  return { sent, tasks: row.tasks.length };
}
