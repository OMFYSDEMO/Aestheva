// The leadership record at /leadership. Leaders sign in with their own logins (never the team key); the session is a
// signed, HttpOnly cookie scoped to /leadership. Every leader sees every entry; nothing can be changed or deleted.
import { Hono, type Context, type Next } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Env } from "../env";
import { HttpError, audit, hmacSha256Hex, newId, safeEqual } from "../db";
import { nowIst } from "../domain/time";
import {
  agreementStatus, appendEntry, checkLeaderLogin, dropFiles, emailEntry, entries, entryBySeq, filesOf, leaderForLink, leaderFromSession, leaderSession,
  leaders, recordCsv, requestLeaderReset, setLeaderPassword, storeFiles, validateEntry, verifyChain, type Entry, type Leader,
} from "../services/leadership";
import { layout } from "../views/layout";
import {
  agreementsPage, entryPage, leaderForgotPage, leaderLinkInvalidPage, leaderLoginPage, leaderSetPasswordPage, leaderShell, newEntryPage, printPage, recordPage,
  type LeaderSection,
} from "../views/leadership";

type Vars = { leader: Leader; csrf: string };
type C = Context<{ Bindings: Env; Variables: Vars }>;
const lead = new Hono<{ Bindings: Env; Variables: Vars }>();
const COOKIE = "ae_lead", HOURS = 8;
const key = (c: C) => c.env.OPS_KEY?.trim() ?? "";
const base = (c: C) => c.env.SITE_URL || new URL(c.req.url).origin;
const NO_RESPONSE = new Set(["confirm", "dispute", "opened", "access"]);

const bare = (c: C, title: string, body: string, status = 200) => {
  c.header("cache-control", "no-store");
  return c.html(layout({ title: `${title} · Aestheva leadership`, appEnv: c.env.APP_ENV, noindex: true, app: { label: "leadership" } }, body), status as 200);
};
const page = (c: C, title: string, section: LeaderSection, body: string, status = 200) => {
  c.header("cache-control", "no-store");
  return c.html(layout({ title: `${title} · Aestheva leadership`, appEnv: c.env.APP_ENV, noindex: true, app: { label: "leadership" } },
    leaderShell({ leader: c.get("leader"), section, csrf: c.get("csrf") }, body)), status as 200);
};

lead.get("/login", async (c) => {
  if (key(c) && (await leaderFromSession(c.env.DB, key(c), getCookie(c, COOKIE) ?? ""))) return c.redirect("/leadership", 303);
  return bare(c, "Sign in", leaderLoginPage("", c.req.query("set") === "1" ? "Password saved. Sign in with your email and new password." : ""));
});
lead.post("/login", async (c) => {
  const k = key(c), db = c.env.DB;
  if (!k) return bare(c, "Sign in", leaderLoginPage("Sign-in isn't available right now."), 503);
  const f = await c.req.parseBody();
  const email = String(f.email ?? "").trim().toLowerCase(), password = String(f.password ?? "");
  const fails = await db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'leader.login_failed' AND entity_id = ? AND at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-15 minutes')").bind(email).first<{ n: number }>();
  if ((fails?.n ?? 0) >= 5) return bare(c, "Sign in", leaderLoginPage("Too many attempts for this email. Please wait 15 minutes and try again."), 429);
  const l = await checkLeaderLogin(db, email, password);
  if (!l) {
    await audit(db, "leader", "leader.login_failed", "leader", email).run();
    return bare(c, "Sign in", leaderLoginPage("That email and password don't match. Check for typing mistakes, or use Forgot your password."), 401);
  }
  const exp = Date.now() + HOURS * 36e5;
  setCookie(c, COOKIE, await leaderSession(k, l, exp), { path: "/leadership", httpOnly: true, secure: new URL(c.req.url).protocol === "https:", sameSite: "Strict", maxAge: HOURS * 3600 });
  await db.batch([db.prepare("UPDATE leaders SET last_login_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").bind(l.id), audit(db, `leader:${l.id}`, "leader.login", "leader", l.id)]);
  return c.redirect("/leadership", 303);
});
lead.post("/logout", (c) => { deleteCookie(c, COOKIE, { path: "/leadership" }); return c.redirect("/leadership/login", 303); });
lead.get("/set-password", async (c) => {
  c.header("referrer-policy", "no-referrer");
  const token = c.req.query("t") ?? "", l = await leaderForLink(c.env.DB, token);
  if (!l) return bare(c, "Link expired", leaderLinkInvalidPage(), 410);
  return bare(c, "Set your password", leaderSetPasswordPage({ token, email: l.email, invite: l.purpose === "invite" }));
});
lead.post("/set-password", async (c) => {
  c.header("referrer-policy", "no-referrer");
  const f = await c.req.parseBody(), token = String(f.t ?? "");
  try { await setLeaderPassword(c.env.DB, token, String(f.password ?? ""), String(f.confirm ?? "")); }
  catch (e) {
    if (!(e instanceof HttpError) || e.status >= 500) throw e;
    const l = await leaderForLink(c.env.DB, token);
    if (!l) return bare(c, "Link expired", leaderLinkInvalidPage(), 410);
    return bare(c, "Set your password", leaderSetPasswordPage({ token, email: l.email, invite: l.purpose === "invite", error: e.message }), e.status);
  }
  return c.redirect("/leadership/login?set=1", 303);
});
lead.get("/forgot", (c) => bare(c, "Forgot password", leaderForgotPage()));
lead.post("/forgot", async (c) => {
  const f = await c.req.parseBody();
  c.executionCtx.waitUntil(requestLeaderReset(c.env, String(f.email ?? ""), base(c)).catch((e) => console.error("leader reset failed", e)));
  return bare(c, "Forgot password", leaderForgotPage(true));
});

// Everything below needs a signed-in leader; POSTs also need the per-session form token.
lead.use("*", async (c: C, next: Next) => {
  const s = key(c) ? await leaderFromSession(c.env.DB, key(c), getCookie(c, COOKIE) ?? "") : null;
  if (!s) return c.redirect("/leadership/login", 303);
  c.set("leader", s.leader);
  c.set("csrf", await hmacSha256Hex(key(c), `leader-csrf|${s.leader.id}|${s.exp}`));
  if (c.req.method === "POST") {
    const form = await c.req.parseBody({ all: true });
    if (!safeEqual(String(form.csrf ?? ""), c.get("csrf"))) return bare(c, "Expired", leaderLoginPage("Your session has changed. Please sign in again."), 403);
  }
  await next();
});

const statuses = async (db: D1Database, all: Entry[]) => agreementStatus(all, await leaders(db));

lead.get("/", async (c) => {
  const all = await entries(c.env.DB);
  return page(c, "The record", "record", recordPage({ all, chain: await verifyChain(c.env.DB), statuses: await statuses(c.env.DB, all), newest: c.req.query("order") === "newest" }));
});
lead.get("/agreements", async (c) => {
  const all = await entries(c.env.DB);
  return page(c, "Agreements", "agreements", agreementsPage({ statuses: (await statuses(c.env.DB, all)).reverse() }));
});

async function showEntry(c: C, seq: number, extra: { error?: string; message?: string } = {}, status = 200) {
  const all = await entries(c.env.DB), e = all.find((x) => x.seq === seq);
  if (!e) throw new HttpError(404, "There's no entry with that number.");
  const st = (await statuses(c.env.DB, all)).find((s) => s.entry.seq === seq);
  const canRespond = !NO_RESPONSE.has(e.kind) && e.author_id !== c.get("leader").id;
  return page(c, `#${seq} ${e.title}`, "record", entryPage({ e, responses: all.filter((x) => x.refers_to === seq), status: st, canRespond, csrf: c.get("csrf"), ...extra }), status);
}
const seqParam = (c: C) => { const n = Number(c.req.param("seq")); if (!Number.isInteger(n) || n < 1) throw new HttpError(404, "There's no entry with that number."); return n; };
lead.get("/entries/:seq", (c) => showEntry(c, seqParam(c), { message: c.req.query("done") ? "Added to the record and emailed to every leader." : undefined }));

lead.post("/entries/:seq/respond", async (c) => {
  const seq = seqParam(c), me = c.get("leader"), f = await c.req.parseBody();
  const e = await entryBySeq(c.env.DB, seq);
  if (!e) throw new HttpError(404, "There's no entry with that number.");
  const answer = String(f.answer ?? ""), comment = String(f.comment ?? "").trim().slice(0, 4000);
  if (NO_RESPONSE.has(e.kind) || e.author_id === me.id) return showEntry(c, seq, { error: "You can confirm or dispute only an entry another leader added." }, 400);
  if (answer !== "confirm" && answer !== "dispute") return showEntry(c, seq, { error: "Please choose Confirm or Dispute." }, 400);
  if (answer === "dispute" && comment.length < 5) return showEntry(c, seq, { error: "Please say what you dispute, so the record shows why." }, 400);
  const added = await appendEntry(c.env.DB, { occurred_on: nowIst().date, kind: answer, channel: "", title: `${answer === "confirm" ? "Confirms" : "Disputes"} #${seq}: ${e.title}`.slice(0, 140),
    body: comment, author_id: me.id, author_name: `${me.name} (${me.role})`, refers_to: seq, files: [] });
  await audit(c.env.DB, `leader:${me.id}`, `leader.entry_${answer}`, "leader_entry", String(added.seq)).run();
  c.executionCtx.waitUntil(emailEntry(c.env, added, base(c)).catch((x) => console.error("leadership email failed", x)));
  return c.redirect(`/leadership/entries/${added.seq}?done=1`, 303);
});

lead.get("/new", async (c) => {
  const q = c.req.query();
  return page(c, "Add an entry", "new", newEntryPage({ values: { kind: q.kind ?? "", refers_to: q.ref ?? "" }, errors: {}, csrf: c.get("csrf"), today: nowIst().date }));
});
lead.post("/new", async (c) => {
  const me = c.get("leader"), db = c.env.DB, today = nowIst().date;
  const f = (await c.req.parseBody({ all: true })) as Record<string, string | File | (string | File)[]>;
  const text = Object.fromEntries(Object.entries(f).filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const files = ([] as unknown[]).concat(f.files ?? []).filter((x): x is File => x instanceof File && x.size > 0);
  const max = (await db.prepare("SELECT COALESCE(MAX(seq), 0) AS n FROM leader_entries").first<{ n: number }>())?.n ?? 0;
  const v = validateEntry(text, today, max);
  if (!v.ok) return page(c, "Add an entry", "new", newEntryPage({ values: text, errors: v.errors, csrf: c.get("csrf"), today }), 400);
  const id = newId("le");
  let stored: Awaited<ReturnType<typeof storeFiles>> = [];
  try { stored = await storeFiles(c.env, id, files); }
  catch (e) { if (e instanceof HttpError && e.status < 500) return page(c, "Add an entry", "new", newEntryPage({ values: text, errors: { files: e.message }, csrf: c.get("csrf"), today }), e.status); throw e; }
  let added: Entry;
  try {
    added = await appendEntry(db, { ...v.value, author_id: me.id, author_name: `${me.name} (${me.role})`, files: stored }, id);
  } catch (e) { await dropFiles(c.env, stored); throw e; }
  await audit(db, `leader:${me.id}`, "leader.entry_added", "leader_entry", String(added.seq), { kind: added.kind }).run();
  c.executionCtx.waitUntil(emailEntry(c.env, added, base(c)).catch((x) => console.error("leadership email failed", x)));
  return c.redirect(`/leadership/entries/${added.seq}?done=1`, 303);
});

lead.get("/files/:seq/:n", async (c) => {
  const e = await entryBySeq(c.env.DB, seqParam(c));
  const f = e ? filesOf(e)[Number(c.req.param("n")) - 1] : undefined;
  const obj = f && c.env.MEDIA ? await c.env.MEDIA.get(f.key) : null;
  if (!f || !obj) throw new HttpError(404, "That file isn't there.");
  return new Response(obj.body, { headers: { "content-type": f.type, "content-disposition": `attachment; filename="${f.name.replace(/"/g, "")}"`, "cache-control": "no-store", "x-content-type-options": "nosniff" } });
});
lead.get("/record.csv", async (c) => {
  await audit(c.env.DB, `leader:${c.get("leader").id}`, "leader.record_exported", "leader_entry", "all").run();
  return new Response(recordCsv(await entries(c.env.DB)), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="aestheva-leadership-record-${nowIst().date}.csv"`, "cache-control": "no-store" } });
});
lead.get("/print", async (c) => {
  c.header("cache-control", "no-store");
  const l = c.get("leader");
  return c.html(layout({ title: "Leadership record · Aestheva", appEnv: c.env.APP_ENV, noindex: true, app: { label: "leadership" } },
    printPage({ all: await entries(c.env.DB), chain: await verifyChain(c.env.DB), printedBy: `${l.name} (${l.role})`, at: new Date().toISOString() })));
});

export default lead;
