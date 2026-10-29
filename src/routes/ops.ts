// The team's private pages. Sign-in uses the OPS_KEY secret; the session is a signed, HttpOnly cookie scoped to /ops.
import { Hono, type Context, type Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Env } from "../env";
import { audit, hmacSha256Hex, safeEqual } from "../db";
import { categories } from "../services/catalog";
import { getApplication, listApplications, updateApplication, venueDraft } from "../services/applications";
import { layout } from "../views/layout";
import { opsClinicsPage, opsDetailPage, opsListPage, opsLoginPage, type ClinicLoginRow } from "../views/ops";
import { createClinicUser, emailPasswordLink, issuePasswordLink, setClinicUserActive, type ClinicUser } from "../services/clinic";
import { HttpError } from "../db";
import { sendTestEmail, teamInbox } from "../services/notify";

type C = Context<{ Bindings: Env; Variables: { csrf: string } }>;
const ops = new Hono<{ Bindings: Env; Variables: { csrf: string } }>();
const COOKIE = "ae_ops", HOURS = 12;
const key = (c: C) => c.env.OPS_KEY?.trim() ?? "";
const page = (c: C, title: string, body: string, status = 200) => {
  c.header("cache-control", "no-store");
  return c.html(layout({ title: `${title} · Aestheva team`, appEnv: c.env.APP_ENV, noindex: true }, body), status as 200);
};

async function session(c: C): Promise<number | null> {
  const k = key(c), v = getCookie(c, COOKIE) ?? "";
  const [exp, sig] = v.split(".");
  if (!k || !exp || !sig || !(Number(exp) > Date.now())) return null;
  return safeEqual(sig, await hmacSha256Hex(k, `ops-session|${exp}`)) ? Number(exp) : null;
}

ops.get("/login", async (c) => (await session(c)) ? c.redirect("/ops/applications", 303) : page(c, "Sign in", opsLoginPage("", !!key(c))));
ops.post("/login", async (c) => {
  const k = key(c);
  if (!k) return page(c, "Sign in", opsLoginPage("", false), 503);
  const db = c.env.DB;
  const fails = await db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'ops.login_failed' AND at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-15 minutes')").first<{ n: number }>();
  if ((fails?.n ?? 0) >= 10) return page(c, "Sign in", opsLoginPage("Too many attempts. Please wait 15 minutes and try again."), 429);
  const form = await c.req.parseBody();
  if (!safeEqual(String(form.key ?? "").trim(), k)) {
    await audit(db, "ops", "ops.login_failed", "ops", "login").run();
    return page(c, "Sign in", opsLoginPage("That password isn't right."), 401);
  }
  const exp = Date.now() + HOURS * 36e5;
  setCookie(c, COOKIE, `${exp}.${await hmacSha256Hex(k, `ops-session|${exp}`)}`, {
    path: "/ops", httpOnly: true, secure: new URL(c.req.url).protocol === "https:", sameSite: "Strict", maxAge: HOURS * 3600,
  });
  await audit(db, "ops", "ops.login", "ops", "login").run();
  return c.redirect("/ops/applications", 303);
});
ops.post("/logout", (c) => { deleteCookie(c, COOKIE, { path: "/ops" }); return c.redirect("/ops/login", 303); });

// Everything below needs a valid session. POSTs also need the per-session form token.
ops.use("*", async (c: C, next: Next) => {
  const exp = await session(c);
  if (!exp) return c.redirect("/ops/login", 303);
  c.set("csrf", await hmacSha256Hex(key(c), `ops-csrf|${exp}`));
  if (c.req.method === "POST") {
    const form = await c.req.parseBody();
    if (!safeEqual(String(form.csrf ?? ""), c.get("csrf"))) return page(c, "Expired", opsLoginPage("Your session has changed. Please sign in again."), 403);
  }
  await next();
});

ops.get("/", (c) => c.redirect("/ops/applications", 303));
ops.get("/applications", async (c) => {
  const status = c.req.query("status") ?? "";
  const e = c.req.query("email");
  const emailResult = e === "sent" ? { ok: true, to: teamInbox(c.env) } : e === "failed" ? { ok: false, to: teamInbox(c.env), code: c.req.query("code") ?? "" } : undefined;
  return page(c, "Applications", opsListPage({ ...(await listApplications(c.env.DB, status)), status, csrf: c.get("csrf"), emailResult }));
});
type Issued = { email: string; sent: boolean; code?: string; link?: string; what: string };
async function clinicsPage(c: C, extra: { issued?: Issued; error?: string } = {}, status = 200) {
  const db = c.env.DB;
  const [providers, users] = await Promise.all([
    db.prepare("SELECT id, name, status FROM providers ORDER BY status = 'live' DESC, name").all<{ id: string; name: string; status: string }>(),
    db.prepare("SELECT id, provider_id, name, email, active, last_login_at FROM provider_users ORDER BY created_at").all<ClinicLoginRow>(),
  ]);
  return page(c, "Clinic logins", opsClinicsPage({ providers: providers.results, users: users.results, csrf: c.get("csrf"), ...extra }), status);
}
ops.get("/clinics", (c) => clinicsPage(c));
ops.post("/clinics", async (c) => {
  const f = await c.req.parseBody();
  try {
    const u = await createClinicUser(c.env.DB, String(f.provider ?? ""), String(f.name ?? ""), String(f.email ?? ""));
    return clinicsPage(c, { issued: await invite(c, u, "Login created") });
  } catch (e) { if (e instanceof HttpError && e.status < 500) return clinicsPage(c, { error: e.message }, e.status); throw e; }
});
ops.post("/clinics/:id/link", async (c) => {
  const u = await c.env.DB.prepare("SELECT * FROM provider_users WHERE id = ?").bind(c.req.param("id")).first<ClinicUser>();
  if (!u) throw new HttpError(404, "Unknown login");
  return clinicsPage(c, { issued: await invite(c, u, "New set-password link") });
});
/** Emails the person a link to set their password; if the email can't be sent, the link is shown once instead. */
async function invite(c: C, u: ClinicUser, what: string): Promise<Issued> {
  const venue = (await c.env.DB.prepare("SELECT name FROM providers WHERE id = ?").bind(u.provider_id).first<{ name: string }>())?.name ?? "your clinic";
  const link = `${c.env.SITE_URL || new URL(c.req.url).origin}/clinic/set-password?t=${await issuePasswordLink(c.env.DB, u.id, "invite", "ops")}`;
  const r = await emailPasswordLink(c.env, u, venue, link, "invite");
  return r.ok ? { email: u.email, sent: true, what } : { email: u.email, sent: false, code: r.code, link, what };
}
ops.post("/clinics/:id/active", async (c) => {
  const f = await c.req.parseBody();
  await setClinicUserActive(c.env.DB, c.req.param("id"), f.active === "1");
  return c.redirect("/ops/clinics", 303);
});
ops.post("/test-email", async (c) => {
  const r = await sendTestEmail(c.env, new URL(c.req.url).origin);
  return c.redirect(`/ops/applications?email=${r.ok ? "sent" : "failed&code=" + encodeURIComponent(r.code ?? "")}`, 303);
});
ops.get("/applications/:ref", async (c) => {
  const a = await getApplication(c.env.DB, c.req.param("ref"));
  const cats = await categories(c.env.DB);
  return page(c, a.business_name, opsDetailPage(a, c.get("csrf"), venueDraft(a), (id) => cats.find((x) => x.id === id)?.name ?? id, c.req.query("saved") === "1"));
});
ops.post("/applications/:ref", async (c) => {
  const form = await c.req.parseBody();
  await updateApplication(c.env.DB, c.req.param("ref"), String(form.status ?? ""), String(form.notes ?? ""));
  return c.redirect(`/ops/applications/${encodeURIComponent(c.req.param("ref"))}?saved=1`, 303);
});

export default ops;
