// The team's private pages. Sign-in uses the OPS_KEY secret; the session is a signed, HttpOnly cookie scoped to /ops.
import { Hono, type Context, type Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Env } from "../env";
import { audit, hmacSha256Hex, safeEqual } from "../db";
import { categories } from "../services/catalog";
import { getApplication, listApplications, updateApplication, venueDraft } from "../services/applications";
import { layout } from "../views/layout";
import { opsClinicsPage, opsDetailPage, opsListPage, opsLoginPage, opsOffersPage, opsVenuePage, opsVenuesPage, type ClinicLoginRow } from "../views/ops";
import { offerAmount, offerServices, opsSetOffer, placesTaken, whenLabel, type OfferRow } from "../services/offers";
import { nowIst } from "../domain/time";
import { STAGE, addDocument, addVerification, approveApplication, checklist, listing, removeVerification, setVenueStage } from "../services/onboarding";
import { photosOf } from "../views/ui";
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
ops.post("/applications/:ref/approve", async (c) => {
  const db = c.env.DB, ref = c.req.param("ref");
  const r = await approveApplication(c.env, ref, c.env.SITE_URL || new URL(c.req.url).origin);
  const a = await getApplication(db, ref), cats = await categories(db);
  return page(c, a.business_name, opsDetailPage(a, c.get("csrf"), venueDraft(a), (id) => cats.find((x) => x.id === id)?.name ?? id, false, r));
});

ops.get("/offers", async (c) => {
  const db = c.env.DB, month = nowIst().date.slice(0, 7);
  const offers = (await db.prepare("SELECT o.*, p.name AS provider, p.slug FROM offers o JOIN providers p ON p.id = o.provider_id WHERE o.status <> 'ended' ORDER BY o.status, o.created_at DESC").all<OfferRow & { provider: string; slug: string }>()).results;
  const names = new Map((await db.prepare("SELECT id, name FROM services").all<{ id: string; name: string }>()).results.map((r) => [r.id, r.name]));
  const taken = await placesTaken(db, offers.map((o) => o.id));
  const rows = offers.map((o) => ({ id: o.id, provider: o.provider, slug: o.slug, amount: offerAmount(o), when: whenLabel(o), services: offerServices(o).map((id) => names.get(id) ?? id).join(", "),
    starts_on: o.starts_on, ends_on: o.ends_on, cap: o.monthly_cap, status: o.status, paused_by: o.paused_by, used: taken.get(`${o.id}|${month}`) ?? 0 }));
  const done = c.req.query("done");
  return page(c, "Offers", opsOffersPage({ rows, csrf: c.get("csrf"), message: done === "pause" ? "Offer paused. Its times are back at the full price." : done === "resume" ? "Pause lifted. The offer is on again." : undefined }));
});
for (const action of ["pause", "resume"] as const) {
  ops.post(`/offers/:id/${action}`, async (c) => { await opsSetOffer(c.env.DB, c.req.param("id"), action); return c.redirect(`/ops/offers?done=${action}`, 303); });
}

ops.get("/venues", async (c) => {
  const db = c.env.DB;
  const ps = (await db.prepare("SELECT id FROM providers ORDER BY created_at DESC").all<{ id: string }>()).results;
  const logins = new Map((await db.prepare("SELECT provider_id, COUNT(*) AS n FROM provider_users WHERE active = 1 GROUP BY provider_id").all<{ provider_id: string; n: number }>()).results.map((r) => [r.provider_id, r.n]));
  const rows = await Promise.all(ps.map(async ({ id }) => { const l = await listing(db, id); return { id, name: l.p.name, type: l.p.type, area: l.p.area, founding: (l.p as { founding_no?: number | null }).founding_no ?? null, stage: STAGE(l.p), missing: checklist(l).steps.filter((x) => !x.done).map((x) => x.title), submitted_at: l.p.submitted_at, logins: logins.get(id) ?? 0 }; }));
  return page(c, "Venues", opsVenuesPage({ rows }));
});
async function venuePage(c: C, id: string, extra: { message?: string; error?: string } = {}, status = 200) {
  const db = c.env.DB;
  if (!(await db.prepare("SELECT 1 FROM providers WHERE id = ?").bind(id).first())) throw new HttpError(404, "Unknown venue");
  const l = await listing(db, id), ch = checklist(l);
  const ver = (await db.prepare("SELECT id, label, scope, checked_on FROM verifications WHERE provider_id = ? ORDER BY sort").bind(id).all<{ id: number; label: string; scope: string; checked_on: string }>()).results;
  const previewUrl = `/p/${l.p.slug}${l.p.status === "live" ? "" : `?preview=${encodeURIComponent(c.env.PREVIEW_KEY ?? "")}`}`;
  return page(c, l.p.name, opsVenuePage({ p: l.p, stage: STAGE(l.p), steps: ch.steps, staff: l.staff, services: l.services, photos: photosOf(l.p), docs: l.docs, verifications: ver, previewUrl, csrf: c.get("csrf"), ...extra }), status);
}
const STAGE_DONE: Record<string, string> = { document: "Document uploaded.", publish: "Published. The clinic has been emailed.", send_back: "Sent back. The clinic has been emailed your note.", pause: "Paused. The clinic has been emailed." };
ops.get("/venues/:id", (c) => venuePage(c, c.req.param("id"), { message: STAGE_DONE[c.req.query("done") ?? ""] }));
ops.post("/venues/:id/stage", async (c) => {
  const f = await c.req.parseBody(), id = c.req.param("id"), action = String(f.action ?? "");
  if (!["publish", "send_back", "pause"].includes(action)) throw new HttpError(400, "Unknown action");
  try { await setVenueStage(c.env, id, action as "publish", String(f.note ?? ""), c.env.SITE_URL || new URL(c.req.url).origin); }
  catch (e) { if (e instanceof HttpError && e.status < 500 && e.status !== 404) return venuePage(c, id, { error: e.message }, e.status); throw e; }
  return c.redirect(`/ops/venues/${encodeURIComponent(id)}?done=${action}`, 303);
});
ops.post("/venues/:id/verifications", async (c) => {
  const f = await c.req.parseBody(), id = c.req.param("id");
  try { await addVerification(c.env.DB, id, String(f.label ?? ""), String(f.scope ?? ""), String(f.checked_on ?? "")); }
  catch (e) { if (e instanceof HttpError && e.status < 500) return venuePage(c, id, { error: e.message }, e.status); throw e; }
  return c.redirect(`/ops/venues/${encodeURIComponent(id)}`, 303);
});
ops.post("/venues/:id/verifications/:vid/remove", async (c) => { await removeVerification(c.env.DB, c.req.param("id"), Number(c.req.param("vid"))); return c.redirect(`/ops/venues/${encodeURIComponent(c.req.param("id"))}`, 303); });
// Verification documents open only here, for signed-in team members, sandboxed and never cached.
// For documents a clinic sent by email or WhatsApp: the team files them against the venue.
ops.post("/venues/:id/documents", async (c) => {
  const id = c.req.param("id"), f = await c.req.parseBody();
  if (!(await c.env.DB.prepare("SELECT 1 FROM providers WHERE id = ?").bind(id).first())) throw new HttpError(404, "Unknown venue");
  try { await addDocument(c.env, id, String(f.kind ?? ""), f.file, "ops"); }
  catch (e) { if (e instanceof HttpError && (e.status < 500 || e.status === 503)) return venuePage(c, id, { error: e.message }, e.status); throw e; }
  return c.redirect(`/ops/venues/${encodeURIComponent(id)}?done=document`, 303);
});
ops.get("/documents/:id", async (c) => {
  const d = await c.env.DB.prepare("SELECT * FROM provider_documents WHERE id = ?").bind(c.req.param("id")).first<{ r2_key: string; content_type: string; filename: string }>();
  const obj = d && c.env.MEDIA ? await c.env.MEDIA.get(d.r2_key) : null;
  if (!d || !obj) throw new HttpError(404, "Document not found");
  await audit(c.env.DB, "ops", "document.viewed", "document", c.req.param("id")).run();
  return new Response(obj.body, { headers: { "content-type": d.content_type, "content-disposition": `inline; filename="${d.filename.replace(/"/g, "")}"`, "cache-control": "no-store", "x-content-type-options": "nosniff", "content-security-policy": "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'" } });
});

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
  await audit(c.env.DB, "ops", r.ok ? "clinic_user.invite_emailed" : "clinic_user.invite_email_failed", "provider_user", u.id, r.ok ? { to: u.email } : { to: u.email, code: r.code }).run();
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
