// The clinic portal. Venue staff sign in with a login issued by the Aestheva team; the session is a signed,
// HttpOnly cookie scoped to /clinic, and every query is limited to the signed-in user's venue.
import { Hono, type Context, type Next } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Env } from "../env";
import { HttpError, audit, hmacSha256Hex, safeEqual } from "../db";
import { addDays, hoursUntil, isIsoDate, nowIst } from "../domain/time";
import { categories, nextAvailable, providerBySlug } from "../services/catalog";
import {
  FormError, LANGS, STAGE, acceptTerms, addDocument, addPhoto, changePhoto, checklist, listing, removeDocument, removeService, removeStaff,
  saveDetails, saveService, saveStaff, submitForReview, validateDetails, validateService, validateStaff,
} from "../services/onboarding";
import { detailsPage, documentsPage, photosPage, serviceForm, setupHome, staffForm, teamPage, termsPage, treatmentsPage } from "../views/setup";
import { providerPage } from "../views/pages";
import {
  addBlock, cancelByClinic, checkPassword, requestPasswordReset, setPasswordWithLink, userForLink, clinicBooking, clinicClient, clinicClients, clinicStaff, createDirectBooking, dayView, listBookings,
  markOutcome, monthMoney, overview, removeBlock, sessionFor, userFromSession, type ClinicUser,
} from "../services/clinic";
import { layout } from "../views/layout";
import { emailBookingCancelled, emailBookingConfirmed } from "../services/booking-emails";
import { foundingTerms, ownLink } from "../services/incentives";
import {
  bookingCreatedPage, bookingDetailPage, bookingsPage, calendarPage, clientPage, clientsPage, clinicLoginPage, clinicShell, forgotPage, linkInvalidPage, newBookingPage, setPasswordPage,
  paymentsPage, servicesPage, signOutButton, todayPage, type Section,
} from "../views/clinic";

type Vars = { user: ClinicUser; providerName: string; csrf: string };
type C = Context<{ Bindings: Env; Variables: Vars }>;
const clinic = new Hono<{ Bindings: Env; Variables: Vars }>();
const COOKIE = "ae_clinic", HOURS = 12;
const key = (c: C) => c.env.OPS_KEY?.trim() ?? "";
const actor = (c: C) => `provider_user:${c.get("user").id}`;
const pid = (c: C) => c.get("user").provider_id;
const base = (c: C) => c.env.SITE_URL || new URL(c.req.url).origin;

const bare = (c: C, title: string, body: string, status = 200) => {
  c.header("cache-control", "no-store");
  return c.html(layout({ title: `${title} · Aestheva for business`, appEnv: c.env.APP_ENV, noindex: true, app: { label: "for business" } }, body), status as 200);
};
const page = (c: C, title: string, section: Section, body: string, status = 200) => {
  c.header("cache-control", "no-store");
  const u = c.get("user");
  return c.html(layout({ title: `${title} · ${c.get("providerName")} · Aestheva`, appEnv: c.env.APP_ENV, noindex: true, app: { label: "for business", right: signOutButton(c.get("csrf"), u.name) }, scripts: section === "setup" ? ["/setup.js"] : [] },
    clinicShell({ user: u, providerName: c.get("providerName"), section, csrf: c.get("csrf") }, body)), status as 200);
};

clinic.get("/login", async (c) => {
  if (key(c) && (await userFromSession(c.env.DB, key(c), getCookie(c, COOKIE) ?? ""))) return c.redirect("/clinic", 303);
  return bare(c, "Sign in", clinicLoginPage("", !!key(c), c.req.query("set") === "1" ? "Password saved. Sign in with your email and new password." : ""));
});

// Set-password links (invitations and resets) and "Forgot password". The token is the only credential here.
const venueName = async (c: C, providerId: string) => (await c.env.DB.prepare("SELECT name FROM providers WHERE id = ?").bind(providerId).first<{ name: string }>())?.name ?? "Your clinic";
clinic.get("/set-password", async (c) => {
  c.header("referrer-policy", "no-referrer");
  const token = c.req.query("t") ?? "", u = await userForLink(c.env.DB, token);
  if (!u) return bare(c, "Link expired", linkInvalidPage(), 410);
  return bare(c, "Set your password", setPasswordPage({ token, email: u.email, venue: await venueName(c, u.provider_id), invite: u.purpose === "invite" }));
});
clinic.post("/set-password", async (c) => {
  c.header("referrer-policy", "no-referrer");
  const f = await c.req.parseBody(), token = String(f.t ?? "");
  try { await setPasswordWithLink(c.env.DB, token, String(f.password ?? ""), String(f.confirm ?? "")); }
  catch (e) {
    if (!(e instanceof HttpError) || e.status >= 500) throw e;
    const u = await userForLink(c.env.DB, token);
    if (!u) return bare(c, "Link expired", linkInvalidPage(), 410);
    return bare(c, "Set your password", setPasswordPage({ token, email: u.email, venue: await venueName(c, u.provider_id), invite: u.purpose === "invite", error: e.message }), e.status);
  }
  return c.redirect("/clinic/login?set=1", 303);
});
clinic.get("/forgot", (c) => bare(c, "Forgot password", forgotPage()));
clinic.post("/forgot", async (c) => {
  const f = await c.req.parseBody();
  // Send after responding, so the time taken never hints at whether the email has a login.
  c.executionCtx.waitUntil(requestPasswordReset(c.env, String(f.email ?? ""), base(c)).catch((e) => console.error("reset failed", e)));
  return bare(c, "Forgot password", forgotPage(true));
});
clinic.post("/login", async (c) => {
  const k = key(c), db = c.env.DB;
  if (!k) return bare(c, "Sign in", clinicLoginPage("", false), 503);
  const form = await c.req.parseBody();
  const email = String(form.email ?? "").trim().toLowerCase(), password = String(form.password ?? "").trim();
  const fails = await db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'clinic.login_failed' AND entity_id = ? AND at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-15 minutes')").bind(email).first<{ n: number }>();
  if ((fails?.n ?? 0) >= 5) return bare(c, "Sign in", clinicLoginPage("Too many attempts for this email. Please wait 15 minutes and try again."), 429);
  const u = await db.prepare("SELECT * FROM provider_users WHERE email = ?").bind(email).first<ClinicUser>();
  if (!u || !u.active || !(await checkPassword(password, u.password_hash))) {
    await audit(db, "clinic", "clinic.login_failed", "provider_user", email).run();
    return bare(c, "Sign in", clinicLoginPage("That email and password don't match. Check for typing mistakes; the password has dashes."), 401);
  }
  const exp = Date.now() + HOURS * 36e5;
  setCookie(c, COOKIE, await sessionFor(k, u, exp), { path: "/clinic", httpOnly: true, secure: new URL(c.req.url).protocol === "https:", sameSite: "Strict", maxAge: HOURS * 3600 });
  await db.batch([db.prepare("UPDATE provider_users SET last_login_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").bind(u.id), audit(db, `provider_user:${u.id}`, "clinic.login", "provider_user", u.id)]);
  return c.redirect("/clinic", 303);
});
clinic.post("/logout", (c) => { deleteCookie(c, COOKIE, { path: "/clinic" }); return c.redirect("/clinic/login", 303); });

// Everything below needs a signed-in user; POSTs also need the per-session form token.
clinic.use("*", async (c: C, next: Next) => {
  const s = key(c) ? await userFromSession(c.env.DB, key(c), getCookie(c, COOKIE) ?? "") : null;
  if (!s) return c.redirect("/clinic/login", 303);
  const p = await c.env.DB.prepare("SELECT name FROM providers WHERE id = ?").bind(s.user.provider_id).first<{ name: string }>();
  c.set("user", s.user); c.set("providerName", p?.name ?? "Your clinic");
  c.set("csrf", await hmacSha256Hex(key(c), `clinic-csrf|${s.user.id}|${s.exp}`));
  if (c.req.method === "POST") {
    const form = await c.req.parseBody();
    if (!safeEqual(String(form.csrf ?? ""), c.get("csrf"))) return bare(c, "Expired", clinicLoginPage("Your session has changed. Please sign in again."), 403);
  }
  await next();
});

clinic.get("/", async (c) => {
  // Until the listing is live, the clinic starts on its setup checklist.
  const p = await c.env.DB.prepare("SELECT status, slug, founding_no, live_since FROM providers WHERE id = ?").bind(pid(c)).first<{ status: string; slug: string; founding_no: number | null; live_since: string | null }>();
  if (p?.status !== "live" && c.req.query("today") !== "1") return c.redirect("/clinic/setup", 303);
  const todo = checklist(await listing(c.env.DB, pid(c))).steps.filter((s) => !s.done).map((s) => s.title);
  return page(c, "Today", "today", todayPage({ providerName: c.get("providerName"), ...(await overview(c.env.DB, pid(c))), todo,
    link: p?.status === "live" ? ownLink(base(c), p.slug) : undefined, founding: p ? foundingTerms(p, nowIst().date) : null }));
});

// ---------- set up your listing ----------

const form = async (c: C) => (await c.req.parseBody({ all: true })) as Record<string, string | string[] | File | (string | File)[]>;
const flat = (f: Record<string, unknown>) => Object.fromEntries(Object.entries(f).filter(([, v]) => typeof v === "string" || Array.isArray(v)));
const formFail = (e: unknown) => e instanceof FormError ? e.errors : null;

clinic.get("/setup", async (c) => {
  const l = await listing(c.env.DB, pid(c)), ch = checklist(l);
  return page(c, "Your listing", "setup", setupHome({ p: l.p, stage: STAGE(l.p), ...ch, csrf: c.get("csrf"), userName: c.get("user").name }));
});
clinic.get("/setup/preview", async (c) => {
  const db = c.env.DB, p = await db.prepare("SELECT slug FROM providers WHERE id = ?").bind(pid(c)).first<{ slug: string }>();
  const d = await providerBySlug(db, p!.slug, true);
  const [cats, next] = await Promise.all([categories(db), nextAvailable(db, d!.services)]);
  c.header("cache-control", "no-store");
  return c.html(layout({ title: `Preview · ${d!.provider.name}`, appEnv: c.env.APP_ENV, noindex: true },
    `<div class="preview-bar"><b>Preview of your page.</b> ${d!.provider.status === "live" ? "This is what clients see now." : "Clients can't see it until it's live; booking buttons work after that."} <a class="btn btn-light btn-s" href="/clinic/setup">Back to your listing</a></div>`
    + providerPage({ ...d!, categories: cats, next, today: nowIst().date })));
});

clinic.get("/setup/details", async (c) => {
  const p = (await listing(c.env.DB, pid(c))).p;
  const v = { name: p.name, type: p.type, area: p.area, address: p.address, phone: p.phone, tagline: p.tagline, about: p.about, hours_text: p.hours_text, amenities: (JSON.parse(p.amenities_json || "[]") as string[]).join("\n") };
  return page(c, "Your clinic", "setup", detailsPage({ v, e: {}, csrf: c.get("csrf") }));
});
clinic.post("/setup/details", async (c) => {
  const f = await form(c);
  try { await saveDetails(c.env.DB, pid(c), validateDetails(f), actor(c)); }
  catch (e) { const errs = formFail(e); if (errs) return page(c, "Your clinic", "setup", detailsPage({ v: flat(f), e: errs, csrf: c.get("csrf") }), 400); throw e; }
  return c.redirect("/clinic/setup?saved=details", 303);
});

clinic.get("/setup/photos", async (c) => page(c, "Photos", "setup", photosPage({ p: (await listing(c.env.DB, pid(c))).p, csrf: c.get("csrf") })));
clinic.post("/setup/photos", async (c) => {
  const f = await form(c), viaFetch = c.req.header("x-requested-with") === "fetch";
  try { await addPhoto(c.env, pid(c), { w400: f.w400, w800: f.w800, w1500: f.w1500, og: f.og }, String(f.alt ?? ""), actor(c)); }
  catch (e) {
    if (!(e instanceof HttpError) || e.status >= 500 && e.status !== 503) throw e;
    if (viaFetch) return c.json({ error: e.message }, e.status as 400);
    return page(c, "Photos", "setup", photosPage({ p: (await listing(c.env.DB, pid(c))).p, csrf: c.get("csrf"), error: e.message }), e.status);
  }
  return viaFetch ? c.json({ ok: true }) : c.redirect("/clinic/setup/photos", 303);
});
clinic.post("/setup/photos/change", async (c) => {
  const f = await form(c);
  await changePhoto(c.env, pid(c), String(f.src ?? ""), f.action === "cover" ? "cover" : "remove", actor(c));
  return c.redirect("/clinic/setup/photos", 303);
});

clinic.get("/setup/team", async (c) => { const l = await listing(c.env.DB, pid(c)); return page(c, "Your team", "setup", teamPage({ staff: l.staff, hours: l.hours, csrf: c.get("csrf") })); });
clinic.get("/setup/team/new", (c) => page(c, "Add a team member", "setup", staffForm({ v: { langs: ["Malayalam", "English"] }, hours: [1, 2, 3, 4, 5, 6].map((dow) => ({ dow, start_min: 600, end_min: 1140 })), e: {}, csrf: c.get("csrf") })));
clinic.get("/setup/team/:id", async (c) => {
  const l = await listing(c.env.DB, pid(c)), t = l.staff.find((s) => s.id === c.req.param("id"));
  if (!t) throw new HttpError(404, "We couldn't find that team member.");
  const langs: string[] = JSON.parse(t.langs_json || "[]");
  const v = { name: t.name, role: t.role, medical: t.medical ? "yes" : "no", quals: (JSON.parse(t.quals_json || "[]") as string[]).join("\n"), registration: t.registration, langs, langs_other: langs.filter((x) => !LANGS.includes(x)).join(", "), bio: t.bio };
  return page(c, t.name, "setup", staffForm({ id: t.id, v, hours: l.hours.filter((h) => h.staff_id === t.id), e: {}, csrf: c.get("csrf") }));
});
clinic.post("/setup/team/:id", async (c) => {
  const f = await form(c), id = c.req.param("id") === "new" ? null : c.req.param("id");
  try { await saveStaff(c.env.DB, pid(c), id, validateStaff(f), actor(c)); }
  catch (e) { const errs = formFail(e); if (errs) return page(c, "Your team", "setup", staffForm({ id: id ?? undefined, v: flat(f), hours: [], e: errs, csrf: c.get("csrf") }), 400); throw e; }
  return c.redirect("/clinic/setup/team", 303);
});
clinic.post("/setup/team/:id/remove", async (c) => {
  try { await removeStaff(c.env.DB, pid(c), c.req.param("id"), actor(c)); }
  catch (e) { if (e instanceof HttpError && e.status === 409) { const l = await listing(c.env.DB, pid(c)); return page(c, "Your team", "setup", teamPage({ staff: l.staff, hours: l.hours, csrf: c.get("csrf"), error: e.message }), 409); } throw e; }
  return c.redirect("/clinic/setup/team", 303);
});

clinic.get("/setup/treatments", async (c) => {
  const [l, cats] = await Promise.all([listing(c.env.DB, pid(c)), categories(c.env.DB)]);
  return page(c, "Treatments & prices", "setup", treatmentsPage({ services: l.services, staff: l.staff, catName: (id) => cats.find((x) => x.id === id)?.name ?? id, csrf: c.get("csrf") }));
});
async function serviceFormPage(c: C, id: string | undefined, v: Record<string, unknown>, e: Record<string, string> = {}, status = 200) {
  const [l, cats] = await Promise.all([listing(c.env.DB, pid(c)), categories(c.env.DB)]);
  return page(c, "Treatments & prices", "setup", serviceForm({ id, v, e, csrf: c.get("csrf"), staff: l.staff, categories: cats }), status);
}
clinic.get("/setup/treatments/new", (c) => serviceFormPage(c, undefined, {}));
clinic.get("/setup/treatments/:id", async (c) => {
  const l = await listing(c.env.DB, pid(c)), s = l.services.find((x) => x.id === c.req.param("id"));
  if (!s) throw new HttpError(404, "We couldn't find that treatment.");
  return serviceFormPage(c, s.id, { name: s.name, cat: s.cat, kind: s.kind, dur: String(s.dur_min), price: String(s.price_paise / 100), description: s.description, staff: s.staff });
});
clinic.post("/setup/treatments/:id", async (c) => {
  const f = await form(c), id = c.req.param("id") === "new" ? null : c.req.param("id");
  const [l, cats] = await Promise.all([listing(c.env.DB, pid(c)), categories(c.env.DB)]);
  try { await saveService(c.env.DB, pid(c), id, validateService(f, l.staff, cats.map((x) => x.id)), actor(c)); }
  catch (e) { const errs = formFail(e); if (errs) return serviceFormPage(c, id ?? undefined, flat(f), errs, 400); throw e; }
  return c.redirect("/clinic/setup/treatments", 303);
});
clinic.post("/setup/treatments/:id/remove", async (c) => { await removeService(c.env.DB, pid(c), c.req.param("id"), actor(c)); return c.redirect("/clinic/setup/treatments", 303); });

async function documentsView(c: C, error?: string, status = 200) {
  const l = await listing(c.env.DB, pid(c));
  return page(c, "Verification documents", "setup", documentsPage({ docs: l.docs, medical: checklist(l).medical, csrf: c.get("csrf"), error, locked: l.p.status === "live" }), status);
}
clinic.get("/setup/documents", (c) => documentsView(c));
clinic.post("/setup/documents", async (c) => {
  const f = await form(c);
  try { await addDocument(c.env, pid(c), String(f.kind ?? ""), f.file, actor(c)); }
  catch (e) { if (e instanceof HttpError && (e.status < 500 || e.status === 503)) return documentsView(c, e.message, e.status); throw e; }
  return c.redirect("/clinic/setup/documents", 303);
});
clinic.post("/setup/documents/:id/remove", async (c) => {
  const p = await c.env.DB.prepare("SELECT status FROM providers WHERE id = ?").bind(pid(c)).first<{ status: string }>();
  if (p?.status === "live") return documentsView(c, "Documents can't be removed once your listing is live. Email us if one needs replacing.", 409);
  await removeDocument(c.env, pid(c), c.req.param("id"), actor(c));
  return c.redirect("/clinic/setup/documents", 303);
});

clinic.get("/setup/terms", async (c) => {
  const p = (await listing(c.env.DB, pid(c))).p;
  const by = p.terms_accepted_by ? (await c.env.DB.prepare("SELECT name FROM provider_users WHERE id = ?").bind(p.terms_accepted_by).first<{ name: string }>())?.name : undefined;
  return page(c, "Terms", "setup", termsPage({ p, csrf: c.get("csrf"), acceptedBy: by }));
});
clinic.post("/setup/terms", async (c) => {
  const f = await form(c);
  if (f.agree !== "yes") return page(c, "Terms", "setup", termsPage({ p: (await listing(c.env.DB, pid(c))).p, csrf: c.get("csrf"), error: "Please tick the box to agree." }), 400);
  await acceptTerms(c.env.DB, pid(c), c.get("user").id);
  return c.redirect("/clinic/setup", 303);
});
clinic.post("/setup/submit", async (c) => {
  await submitForReview(c.env, pid(c), c.get("user"), base(c));
  return c.redirect("/clinic/setup?submitted=1", 303);
});

async function calendar(c: C, date: string, extra: { error?: string; saved?: string } = {}, status = 200) {
  const now = nowIst();
  const d = await dayView(c.env.DB, pid(c), date);
  return page(c, "Calendar", "calendar", calendarPage({ date, today: now.date, nowMin: now.min, ...d, csrf: c.get("csrf"), ...extra }), status);
}
clinic.get("/calendar", async (c) => {
  const q = c.req.query("date") ?? "";
  return calendar(c, isIsoDate(q) ? q : nowIst().date, { saved: c.req.query("saved") === "block" ? "Time blocked. Online booking skips it." : c.req.query("saved") === "unblock" ? "Block removed." : undefined });
});
clinic.post("/blocks", async (c) => {
  const f = await c.req.parseBody(), date = String(f.date ?? "");
  try { await addBlock(c.env.DB, pid(c), String(f.staff ?? ""), date, Number(f.start), Number(f.end), String(f.reason ?? ""), actor(c)); }
  catch (e) { if (e instanceof HttpError && e.status < 500) return calendar(c, isIsoDate(date) ? date : nowIst().date, { error: e.message }, e.status); throw e; }
  return c.redirect(`/clinic/calendar?date=${date}&saved=block`, 303);
});
clinic.post("/blocks/:id/delete", async (c) => {
  const f = await c.req.parseBody(), date = String(f.date ?? "");
  await removeBlock(c.env.DB, pid(c), c.req.param("id"), actor(c));
  return c.redirect(`/clinic/calendar?date=${isIsoDate(date) ? date : nowIst().date}&saved=unblock`, 303);
});

clinic.get("/bookings", async (c) => {
  const view = ["upcoming", "past", "cancelled"].includes(c.req.query("view") ?? "") ? c.req.query("view")! : "upcoming";
  const q = (c.req.query("q") ?? "").slice(0, 60);
  return page(c, "Bookings", "bookings", bookingsPage({ list: await listBookings(c.env.DB, pid(c), view, q), view, q, today: nowIst().date }));
});

const DONE: Record<string, string> = {
  completed: "Marked as completed.", no_show: "Marked as a no-show. Any deposit is kept.",
  cancelled: "Booking cancelled. Please let the client know.", refunded: "Booking cancelled and the deposit refunded in full. Please let the client know.",
  refund_failed: "Booking cancelled. The automatic refund didn't go through, so the Aestheva team will refund the client manually.",
};
async function detail(c: C, ref: string, extra: { message?: string; error?: string } = {}, status = 200) {
  const d = await clinicBooking(c.env.DB, pid(c), ref);
  return page(c, d.a.ref, "bookings", bookingDetailPage({ ...d, csrf: c.get("csrf"), canMark: d.b.status === "confirmed" && hoursUntil(d.b.date, d.b.start_min) <= 0, siteName: c.get("providerName"), ...extra }), status);
}
clinic.get("/bookings/:ref", (c) => detail(c, c.req.param("ref"), { message: DONE[c.req.query("done") ?? ""] }));
clinic.post("/bookings/:ref", async (c) => {
  const f = await c.req.parseBody(), ref = c.req.param("ref"), action = String(f.action ?? "");
  try {
    if (action === "completed" || action === "no_show") { await markOutcome(c.env.DB, pid(c), ref, action, actor(c)); return c.redirect(`/clinic/bookings/${encodeURIComponent(ref)}?done=${action}`, 303); }
    if (action === "cancel") {
      const r = await cancelByClinic(c.env, pid(c), ref, String(f.reason ?? ""), actor(c));
      const { b } = await clinicBooking(c.env.DB, pid(c), ref);
      c.executionCtx.waitUntil(emailBookingCancelled(c.env, b.id, base(c), r.refund));
      return c.redirect(`/clinic/bookings/${encodeURIComponent(ref)}?done=${r.refund === "refunded" ? "refunded" : r.refund === "failed" ? "refund_failed" : "cancelled"}`, 303);
    }
    throw new HttpError(400, "Unknown action");
  } catch (e) { if (e instanceof HttpError && e.status < 500 && e.status !== 404) return detail(c, ref, { error: e.message }, e.status); throw e; }
});

async function newForm(c: C, v: Record<string, string>, error?: string, status = 200) {
  const db = c.env.DB, { staff } = await clinicStaff(db, pid(c));
  const services = (await db.prepare("SELECT * FROM services WHERE provider_id = ? AND active = 1 ORDER BY sort").bind(pid(c)).all<import("../services/catalog").ServiceRow>()).results.map((s) => ({ ...s, staff: [] as string[] }));
  return page(c, "Add a booking", "new", newBookingPage({ services, staff, v: { ...v, csrf: c.get("csrf") }, error, today: nowIst().date }), status);
}
clinic.get("/new", (c) => newForm(c, { date: c.req.query("date") ?? "", staff: c.req.query("staff") ?? "", start: c.req.query("start") ?? "" }));
clinic.post("/new", async (c) => {
  const f = Object.fromEntries(Object.entries(await c.req.parseBody()).map(([k, v]) => [k, String(v ?? "")]));
  try {
    const r = await createDirectBooking(c.env.DB, pid(c), { serviceId: f.service, staffId: f.staff, date: f.date, start: Number(f.start), name: f.name, phone: f.phone, email: f.email, note: f.note }, actor(c));
    const { a, b } = await clinicBooking(c.env.DB, pid(c), r.ref);
    c.executionCtx.waitUntil(emailBookingConfirmed(c.env, b.id, base(c)));
    return page(c, "Booked", "new", bookingCreatedPage({ ref: r.ref, manageUrl: `${base(c)}/booking/${r.ref}?t=${r.token}`, a, siteName: c.get("providerName") }));
  } catch (e) { if (e instanceof HttpError && e.status < 500) return newForm(c, f, e.message, e.status); throw e; }
});

clinic.get("/clients", async (c) => {
  const q = (c.req.query("q") ?? "").slice(0, 60);
  return page(c, "Clients", "clients", clientsPage({ list: await clinicClients(c.env.DB, pid(c), q), q, today: nowIst().date }));
});
clinic.get("/clients/:id", async (c) => page(c, "Client", "clients", clientPage({ ...(await clinicClient(c.env.DB, pid(c), c.req.param("id"))), today: nowIst().date })));

clinic.get("/services", async (c) => {
  const db = c.env.DB, { staff, hours } = await clinicStaff(db, pid(c));
  const [svc, links, cats] = await Promise.all([
    db.prepare("SELECT * FROM services WHERE provider_id = ? AND active = 1 ORDER BY sort").bind(pid(c)).all<import("../services/catalog").ServiceRow>(),
    db.prepare("SELECT ss.service_id, ss.staff_id FROM service_staff ss JOIN services s ON s.id = ss.service_id WHERE s.provider_id = ?").bind(pid(c)).all<{ service_id: string; staff_id: string }>(),
    categories(db),
  ]);
  const services = svc.results.map((s) => ({ ...s, staff: links.results.filter((l) => l.service_id === s.id).map((l) => l.staff_id) }));
  return page(c, "Services & hours", "services", servicesPage({ services, staff, hours, catName: (id) => cats.find((x) => x.id === id)?.name ?? id }));
});

clinic.get("/payments", async (c) => {
  const thisMonth = nowIst().date.slice(0, 7), q = c.req.query("month") ?? "";
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(q) && q <= thisMonth ? q : thisMonth;
  const shift = (m: string, n: number) => addDays(`${m}-15`, n * 30).slice(0, 7);
  const p = await c.env.DB.prepare("SELECT status, slug, founding_no, live_since FROM providers WHERE id = ?").bind(pid(c)).first<{ status: string; slug: string; founding_no: number | null; live_since: string | null }>();
  return page(c, "Payments", "payments", paymentsPage({ month, m: await monthMoney(c.env.DB, pid(c), month), prev: shift(month, -1), next: month < thisMonth ? shift(month, 1) : null,
    founding: p ? foundingTerms(p, nowIst().date) : null, link: p?.status === "live" ? ownLink(base(c), p.slug) : undefined }));
});

export default clinic;
