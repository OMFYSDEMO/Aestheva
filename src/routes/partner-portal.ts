// The Regional Partner portal at /partners. Partners sign in with a login the Aestheva team issues (an invitation link
// sets the password); the session is a signed, HttpOnly cookie scoped to /partners, and every page shows only the
// signed-in partner's own businesses, statements and details.
import { Hono, type Context, type Next } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Env } from "../env";
import { HttpError, audit, hmacSha256Hex, safeEqual } from "../db";
import { nowIst } from "../domain/time";
import {
  acceptPartnerTerms, checkPartnerLogin, partnerBusinesses, partnerFromSession, partnerSession, partnerUserForLink, requestPartnerReset,
  setPartnerPassword, termsCurrent, type PartnerUser,
} from "../services/partner-portal";
import { partnerStatement, scorecard, type PartnerRow, type PartnerStatementRow } from "../services/partners";
import { foundingPlacesLeft } from "../services/incentives";
import { layout } from "../views/layout";
import {
  partnerForgotPage, partnerHomePage, partnerLinkInvalidPage, partnerLoginPage, partnerProfilePage, partnerSetPasswordPage, partnerShell,
  partnerStatementsPage, partnerTermsPage, partnerToolkitPage, type PartnerSection,
} from "../views/partner-portal";
import { partnerStatementPage } from "../views/partners";

type Vars = { user: PartnerUser; partner: PartnerRow; csrf: string };
type C = Context<{ Bindings: Env; Variables: Vars }>;
const portal = new Hono<{ Bindings: Env; Variables: Vars }>();
const COOKIE = "ae_partner", HOURS = 12;
const key = (c: C) => c.env.OPS_KEY?.trim() ?? "";
const base = (c: C) => c.env.SITE_URL || new URL(c.req.url).origin;
const linkFor = (c: C, p: PartnerRow) => `${base(c)}/partner/${p.code}`;

const bare = (c: C, title: string, body: string, status = 200) => {
  c.header("cache-control", "no-store");
  return c.html(layout({ title: `${title} · Aestheva partners`, appEnv: c.env.APP_ENV, noindex: true, app: { label: "partners" } }, body), status as 200);
};
const page = (c: C, title: string, section: PartnerSection, body: string, status = 200) => {
  c.header("cache-control", "no-store");
  return c.html(layout({ title: `${title} · Aestheva partners`, appEnv: c.env.APP_ENV, noindex: true, app: { label: "partners" } },
    partnerShell({ partner: c.get("partner"), section, csrf: c.get("csrf") }, body)), status as 200);
};

portal.get("/login", async (c) => {
  if (key(c) && (await partnerFromSession(c.env.DB, key(c), getCookie(c, COOKIE) ?? ""))) return c.redirect("/partners", 303);
  return bare(c, "Sign in", partnerLoginPage("", c.req.query("set") === "1" ? "Password saved. Sign in with your email and new password." : ""));
});
portal.post("/login", async (c) => {
  const k = key(c), db = c.env.DB;
  if (!k) return bare(c, "Sign in", partnerLoginPage("Sign-in isn't available right now."), 503);
  const f = await c.req.parseBody();
  const email = String(f.email ?? "").trim().toLowerCase(), password = String(f.password ?? "");
  const fails = await db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'partner.login_failed' AND entity_id = ? AND at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-15 minutes')").bind(email).first<{ n: number }>();
  if ((fails?.n ?? 0) >= 5) return bare(c, "Sign in", partnerLoginPage("Too many attempts for this email. Please wait 15 minutes and try again."), 429);
  const u = await checkPartnerLogin(db, email, password);
  const p = u ? await db.prepare("SELECT status FROM partners WHERE id = ?").bind(u.partner_id).first<{ status: string }>() : null;
  if (!u || !p || p.status === "terminated") {
    await audit(db, "partner", "partner.login_failed", "partner_user", email).run();
    return bare(c, "Sign in", partnerLoginPage("That email and password don't match. Check for typing mistakes, or use Forgot your password."), 401);
  }
  const exp = Date.now() + HOURS * 36e5;
  setCookie(c, COOKIE, await partnerSession(k, u, exp), { path: "/partners", httpOnly: true, secure: new URL(c.req.url).protocol === "https:", sameSite: "Strict", maxAge: HOURS * 3600 });
  await db.batch([db.prepare("UPDATE partner_users SET last_login_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").bind(u.id), audit(db, `partner_user:${u.id}`, "partner.login", "partner_user", u.id)]);
  return c.redirect("/partners", 303);
});
portal.post("/logout", (c) => { deleteCookie(c, COOKIE, { path: "/partners" }); return c.redirect("/partners/login", 303); });

// Set-password links (invitations and resets) and "Forgot password". The token is the only credential here.
portal.get("/set-password", async (c) => {
  c.header("referrer-policy", "no-referrer");
  const token = c.req.query("t") ?? "", u = await partnerUserForLink(c.env.DB, token);
  if (!u) return bare(c, "Link expired", partnerLinkInvalidPage(), 410);
  return bare(c, "Set your password", partnerSetPasswordPage({ token, email: u.email, invite: u.purpose === "invite" }));
});
portal.post("/set-password", async (c) => {
  c.header("referrer-policy", "no-referrer");
  const f = await c.req.parseBody(), token = String(f.t ?? "");
  try { await setPartnerPassword(c.env.DB, token, String(f.password ?? ""), String(f.confirm ?? "")); }
  catch (e) {
    if (!(e instanceof HttpError) || e.status >= 500) throw e;
    const u = await partnerUserForLink(c.env.DB, token);
    if (!u) return bare(c, "Link expired", partnerLinkInvalidPage(), 410);
    return bare(c, "Set your password", partnerSetPasswordPage({ token, email: u.email, invite: u.purpose === "invite", error: e.message }), e.status);
  }
  return c.redirect("/partners/login?set=1", 303);
});
portal.get("/forgot", (c) => bare(c, "Forgot password", partnerForgotPage()));
portal.post("/forgot", async (c) => {
  const f = await c.req.parseBody();
  // Send after responding, so the time taken never hints at whether the email has a login.
  c.executionCtx.waitUntil(requestPartnerReset(c.env, String(f.email ?? ""), base(c)).catch((e) => console.error("partner reset failed", e)));
  return bare(c, "Forgot password", partnerForgotPage(true));
});

// Everything below needs a signed-in partner; POSTs also need the per-session form token.
portal.use("*", async (c: C, next: Next) => {
  const s = key(c) ? await partnerFromSession(c.env.DB, key(c), getCookie(c, COOKIE) ?? "") : null;
  if (!s) return c.redirect("/partners/login", 303);
  c.set("user", s.user); c.set("partner", s.partner);
  c.set("csrf", await hmacSha256Hex(key(c), `partner-csrf|${s.user.id}|${s.exp}`));
  if (c.req.method === "POST") {
    const form = await c.req.parseBody();
    if (!safeEqual(String(form.csrf ?? ""), c.get("csrf"))) return bare(c, "Expired", partnerLoginPage("Your session has changed. Please sign in again."), 403);
  }
  await next();
});

/** The Indian financial year (April to March) a date falls in, as its first and last months. */
const fyMonths = (date: string) => {
  const y = Number(date.slice(0, 4)), start = Number(date.slice(5, 7)) >= 4 ? y : y - 1;
  return { from: `${start}-04`, to: `${start + 1}-03` };
};

portal.get("/", async (c) => {
  const db = c.env.DB, p = c.get("partner"), today = nowIst().date, month = today.slice(0, 7), fy = fyMonths(today);
  const [sc, businesses, statements] = await Promise.all([
    scorecard(db, p, month), partnerBusinesses(db, p.id, month),
    db.prepare("SELECT * FROM partner_statements WHERE partner_id = ? ORDER BY month DESC").bind(p.id).all<PartnerStatementRow>().then((r) => r.results),
  ]);
  const inFy = statements.filter((s) => s.month >= fy.from && s.month <= fy.to);
  return page(c, "Dashboard", "home", partnerHomePage({
    partner: p, link: linkFor(c, p), sc, month, businesses, termsOk: termsCurrent(p),
    earnedYear: inFy.reduce((a, s) => a + s.gross_paise, 0), paidYear: inFy.filter((s) => s.status === "paid").reduce((a, s) => a + s.net_paise, 0),
    toPay: statements.filter((s) => s.status === "issued").reduce((a, s) => a + s.net_paise, 0), latest: statements[0],
  }));
});
portal.get("/statements", async (c) => {
  const rows = (await c.env.DB.prepare("SELECT * FROM partner_statements WHERE partner_id = ? ORDER BY month DESC").bind(c.get("partner").id).all<PartnerStatementRow>()).results;
  return page(c, "Statements", "statements", partnerStatementsPage({ statements: rows }));
});
portal.get("/statements/:id", async (c) => {
  // Another partner's statement is answered exactly like one that doesn't exist.
  const d = await partnerStatement(c.env.DB, c.req.param("id")).catch(() => null);
  if (!d || d.s.partner_id !== c.get("partner").id) throw new HttpError(404, "Unknown statement");
  return page(c, d.s.number, "statements", `<div class="statement">${partnerStatementPage({ ...d, csrf: "", today: nowIst().date, portal: true })}</div>`);
});
portal.get("/toolkit", async (c) => {
  const p = c.get("partner");
  return page(c, "Toolkit", "toolkit", partnerToolkitPage({ partner: p, link: linkFor(c, p), placesLeft: await foundingPlacesLeft(c.env.DB) }));
});
portal.get("/terms", (c) => {
  const p = c.get("partner") as PartnerRow & { terms_accepted_at?: string | null };
  return page(c, "Partner terms", "terms", partnerTermsPage({ partner: p, accepted: termsCurrent(p), acceptedAt: p.terms_accepted_at, csrf: c.get("csrf") }));
});
portal.post("/terms", async (c) => {
  const f = await c.req.parseBody(), p = c.get("partner");
  if (f.agree !== "yes") return page(c, "Partner terms", "terms", `<div class="form-error" role="alert">Please tick the box to accept the terms.</div>` + partnerTermsPage({ partner: p, accepted: false, csrf: c.get("csrf") }), 400);
  if (!termsCurrent(p)) await acceptPartnerTerms(c.env.DB, p, c.get("user").id);
  return c.redirect("/partners", 303);
});
portal.get("/profile", (c) => page(c, "Your details", "profile", partnerProfilePage({ partner: c.get("partner") })));

export default portal;
