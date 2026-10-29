import { Hono, type Context } from "hono";
import type { Env } from "../env";
import { AREAS, COMPANY, WAITLIST_CITIES } from "../config";
import { HttpError, isUniqueViolation } from "../db";
import { nowIst } from "../domain/time";
import { categories, liveProviders, liveServices, nextAvailable, providerBySlug, ratings } from "../services/catalog";
import { authorisedBooking, bookingView, cancelByClient, cancellationTerms, type PaymentRow } from "../services/bookings";
import { gatewayFor, paymentMode, previewAllowed } from "../services/gateway";
import { layout, type PageOpts } from "../views/layout";
import { homePage, matchServices, notFoundPage, providerPage, searchPage, type SearchQuery } from "../views/pages";
import { bookPage, managePage } from "../views/booking";
import { cancellationPage, contactPage, practitionersPage, privacyPage, termsPage } from "../views/static";

type C = Context<{ Bindings: Env }>;
const site = new Hono<{ Bindings: Env }>();
const base = (c: C) => c.env.SITE_URL || new URL(c.req.url).origin;
const page = (c: C, o: Omit<PageOpts, "appEnv">, body: string, status = 200) =>
  c.html(layout({ ...o, appEnv: c.env.APP_ENV }, body), status as 200);

site.get("/", async (c) => {
  const db = c.env.DB, today = nowIst().date;
  const [providers, services, cats, rt] = await Promise.all([liveProviders(db), liveServices(db), categories(db), ratings(db)]);
  const next = await nextAvailable(db, services);
  const joined = c.req.query("joined");
  return page(c, {
    title: "Aestheva · Verified skin, hair & wellness care in Thiruvananthapuram",
    description: "Find and book verified clinics, salons, Ayurveda centres and practitioners in Thiruvananthapuram. Medical and beauty services clearly labelled.",
    canonical: base(c) + "/",
  }, homePage({ providers, services, categories: cats, ratings: rt, next, today, joined: joined && (WAITLIST_CITIES as readonly string[]).includes(joined) ? joined : undefined }));
});

site.get("/search", async (c) => {
  const db = c.env.DB, today = nowIst().date;
  const q = c.req.query();
  const f: SearchQuery = {
    q: String(q.q ?? "").slice(0, 80), area: AREAS.includes(q.area as never) ? q.area : "", cat: String(q.cat ?? ""),
    kind: q.kind === "medical" || q.kind === "beauty" ? q.kind : "all", sort: q.sort === "price" || q.sort === "rating" ? q.sort : "rec",
  };
  const [providers, services, cats, rt, ver] = await Promise.all([liveProviders(db), liveServices(db), categories(db), ratings(db),
    db.prepare("SELECT provider_id, COUNT(*) AS n FROM verifications GROUP BY provider_id").all<{ provider_id: string; n: number }>()]);
  if (f.cat && !cats.some((x) => x.id === f.cat)) f.cat = "";
  const catName = (id: string) => cats.find((x) => x.id === id)?.name ?? id;
  const vcount = new Map(ver.results.map((r) => [r.provider_id, r.n]));
  let results = providers
    .filter((p) => !f.area || p.area === f.area)
    .map((p) => ({ p, svcs: matchServices(services.filter((s) => s.provider_id === p.id), p, f, catName), verifications: vcount.get(p.id) ?? 0 }))
    .filter((x) => x.svcs.length);
  const next = await nextAvailable(db, results.flatMap((x) => x.svcs));
  const score = (id: string) => (rt.get(id)?.avg ?? 0) * (rt.get(id)?.n ?? 0);
  if (f.sort === "price") results.sort((a, b) => Math.min(...a.svcs.map((s) => s.price_paise)) - Math.min(...b.svcs.map((s) => s.price_paise)));
  else if (f.sort === "rating") results.sort((a, b) => (rt.get(b.p.id)?.avg ?? 0) - (rt.get(a.p.id)?.avg ?? 0));
  else results.sort((a, b) => score(b.p.id) - score(a.p.id));
  return page(c, {
    title: `${f.q ? f.q + " · " : f.cat ? catName(f.cat) + " · " : ""}${f.area || COMPANY.launchCity} · Aestheva`,
    description: `Book ${f.cat ? catName(f.cat).toLowerCase() : "aesthetic and wellness services"} in ${f.area || COMPANY.launchCity} with verified providers.`,
    canonical: base(c) + "/search", nav: "explore", noindex: !!f.q,
  }, searchPage({ f, results, categories: cats, ratings: rt, next, today, anyLive: providers.length > 0 }));
});

site.get("/p/:slug", async (c) => {
  const preview = previewAllowed(c.env, c.req.query("preview")) ? c.req.query("preview") : undefined;
  const db = c.env.DB, d = await providerBySlug(db, c.req.param("slug"), !!preview);
  if (!d && c.req.query("preview") !== undefined && !preview)
    return page(c, { title: "Preview link not valid · Aestheva", noindex: true }, notFoundPage("This preview link isn't valid. Check the whole link was copied."), 404);
  if (!d) return page(c, { title: "Not found · Aestheva", noindex: true }, notFoundPage("We couldn't find that venue."), 404);
  const [cats, next] = await Promise.all([categories(db), nextAvailable(db, d.services)]);
  return page(c, {
    title: `${d.provider.name} · ${d.provider.area}, ${d.provider.city} · Aestheva`,
    description: `${d.provider.tagline}. ${d.provider.type} in ${d.provider.area}, ${d.provider.city}. See services, prices and live availability, and book online.`,
    canonical: `${base(c)}/p/${d.provider.slug}`, nav: "explore", noindex: d.provider.status !== "live",
  }, providerPage({ ...d, categories: cats, next, today: nowIst().date, preview }));
});

site.get("/book/:slug", async (c) => {
  const preview = previewAllowed(c.env, c.req.query("preview")) ? c.req.query("preview") : undefined;
  const d = await providerBySlug(c.env.DB, c.req.param("slug"), !!preview);
  if (!d) return page(c, { title: "Not found · Aestheva", noindex: true }, notFoundPage("We couldn't find that venue."), 404);
  const pre = c.req.query("service");
  let gateway = "unavailable";
  try { gateway = gatewayFor(c.env).kind; } catch { /* production without keys: deposits can't be taken */ }
  const scripts = ["/book.js", ...(gateway === "razorpay" ? ["https://checkout.razorpay.com/v1/checkout.js"] : [])];
  return page(c, { title: `Book · ${d.provider.name} · Aestheva`, noindex: true, scripts },
    bookPage(d, pre && d.services.some((s) => s.id === pre) ? pre : null, { gateway, mode: paymentMode(c.env) }, preview));
});

async function renderManage(c: C, ref: string, token: string, message?: string) {
  const db = c.env.DB;
  const b = await authorisedBooking(db, ref, token);
  const v = await bookingView(db, b);
  let resume: unknown;
  if (b.status === "held") {
    const pay = await db.prepare("SELECT * FROM payments WHERE booking_id = ? AND status = 'created' ORDER BY created_at DESC").bind(b.id).first<PaymentRow>();
    if (pay) {
      const gw = gatewayFor(c.env);
      resume = { ref: b.ref, token, manageUrl: `${base(c)}/booking/${b.ref}?t=${token}`, payment: { gateway: pay.gateway, keyId: gw.keyId, orderId: pay.order_id, amount: pay.amount_paise, currency: "INR", name: COMPANY.brand, description: `Deposit · ${b.service_name}`, prefill: { name: v.client.name, email: v.client.email, contact: v.client.phone } } };
    }
  }
  const scripts = resume ? ["/book.js", ...((resume as { payment: { gateway: string } }).payment.gateway === "razorpay" ? ["https://checkout.razorpay.com/v1/checkout.js"] : [])] : [];
  return page(c, { title: `Booking ${b.ref} · Aestheva`, noindex: true, scripts }, managePage({ ...v, token, terms: cancellationTerms(b), message, resume }));
}

site.get("/booking/:ref", async (c) => {
  try { return await renderManage(c, c.req.param("ref"), c.req.query("t") ?? "", c.req.query("done") === "cancelled" ? "Your booking is cancelled." : undefined); }
  catch (e) { if (e instanceof HttpError && e.status === 404) return page(c, { title: "Booking not found · Aestheva", noindex: true }, notFoundPage("We couldn't find that booking."), 404); throw e; }
});

site.post("/booking/:ref/cancel", async (c) => {
  const form = await c.req.parseBody();
  const token = String(form.t ?? "");
  const b = await authorisedBooking(c.env.DB, c.req.param("ref"), token);
  const r = await cancelByClient(c.env, b, { requestReview: form.review === "1", reason: String(form.reason ?? "") });
  const msg = { refunded: "Your booking is cancelled and your deposit is being refunded.", review: "Your booking is cancelled. We've opened a refund review and will email you the outcome.", retained: "Your booking is cancelled.", none: "Your booking is cancelled.", failed: "Your booking is cancelled. The automatic refund didn't go through, so our team will process it manually." }[r.refund];
  return renderManage(c, b.ref, token, msg);
});

site.post("/waitlist", async (c) => {
  const form = await c.req.parseBody();
  const city = String(form.city ?? ""), email = String(form.email ?? "").trim().toLowerCase();
  if (!(WAITLIST_CITIES as readonly string[]).includes(city) || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return c.redirect("/#waitlist", 303);
  try { await c.env.DB.prepare("INSERT INTO waitlist (city, email) VALUES (?, ?)").bind(city, email).run(); }
  catch (e) { if (!isUniqueViolation(e)) throw e; }
  return c.redirect(`/?joined=${encodeURIComponent(city)}#${city === COMPANY.launchCity ? "notify" : "waitlist"}`, 303);
});

site.get("/policies/cancellation", (c) => page(c, { title: "Cancellation & refunds · Aestheva", canonical: base(c) + "/policies/cancellation" }, cancellationPage()));
site.get("/policies/terms", (c) => page(c, { title: "Terms of use · Aestheva", canonical: base(c) + "/policies/terms" }, termsPage()));
site.get("/policies/privacy", (c) => page(c, { title: "Privacy · Aestheva", canonical: base(c) + "/policies/privacy" }, privacyPage()));
site.get("/contact", (c) => page(c, { title: "Contact · Aestheva", canonical: base(c) + "/contact" }, contactPage()));
site.get("/for-practitioners", (c) => page(c, { title: "For practitioners & clinics · Aestheva", canonical: base(c) + "/for-practitioners", nav: "practitioners" }, practitionersPage()));

site.get("/robots.txt", (c) => c.text(c.env.APP_ENV === "production" ? `User-agent: *\nAllow: /\nDisallow: /book/\nDisallow: /booking/\nSitemap: ${base(c)}/sitemap.xml\n` : "User-agent: *\nDisallow: /\n"));
site.get("/sitemap.xml", async (c) => {
  const ps = await liveProviders(c.env.DB), b = base(c);
  const urls = ["/", "/search", "/for-practitioners", "/policies/cancellation", "/contact", ...ps.map((p) => `/p/${p.slug}`)];
  return c.body(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${b}${u}</loc></url>`).join("")}</urlset>`, 200, { "content-type": "application/xml" });
});

export { page, notFoundPage };
export default site;
