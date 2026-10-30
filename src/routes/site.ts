import { Hono, type Context } from "hono";
import type { Env } from "../env";
import { AREAS, COMPANY, INCENTIVES, WAITLIST_CITIES, typeLabel } from "../config";
import { setCookie } from "hono/cookie";
import { VIA_COOKIE, foundingPlacesLeft, welcomeAmount } from "../services/incentives";
import { breadcrumbs, business, faqPage, itemList, organisation, serviceOffer, website } from "../views/seo";
import { TOPICS, topicBySlug, type Topic } from "../content/topics";
import { topicIndexPage, topicPage, type TopicRow } from "../views/topics";
import { isMedical, type ProviderRow, type ServiceRow } from "../services/catalog";
import { CAT_META, photosOf } from "../views/ui";
import { HttpError, isUniqueViolation } from "../db";
import { nowIst } from "../domain/time";
import { inServiceArea, km, locality, parseNear } from "../domain/geo";
import { categories, liveProviders, liveServices, nextAvailable, providerBySlug, ratings } from "../services/catalog";
import { authorisedBooking, bookingView, cancelByClient, cancellationTerms, type PaymentRow } from "../services/bookings";
import { gatewayFor, paymentMode, previewAllowed } from "../services/gateway";
import { layout, type PageOpts } from "../views/layout";
import { homePage, matchServices, notFoundPage, providerPage, searchPage, type SearchQuery } from "../views/pages";
import { bookPage, managePage } from "../views/booking";
import { applyPage, applyThanksPage } from "../views/apply";
import { createApplication, validateApplication, type ApplicationForm } from "../services/applications";
import { notifyNewApplication } from "../services/notify";
import { afterClientCancel } from "./api";
import { icsFor } from "../services/booking-emails";
import { aboutPage, cancellationPage, contactPage, practitionersPage, privacyPage, termsPage } from "../views/static";

type C = Context<{ Bindings: Env }>;
const site = new Hono<{ Bindings: Env }>();
const inrPlain = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
const base = (c: C) => c.env.SITE_URL || new URL(c.req.url).origin;
const page = (c: C, o: Omit<PageOpts, "appEnv">, body: string, status = 200) =>
  c.html(layout({ ...o, appEnv: c.env.APP_ENV }, body), status as 200);

site.get("/", async (c) => {
  const db = c.env.DB, today = nowIst().date;
  const [providers, services, cats, rt] = await Promise.all([liveProviders(db), liveServices(db), categories(db), ratings(db)]);
  const next = await nextAvailable(db, services);
  const joined = c.req.query("joined");
  return page(c, {
    title: "Book beauty, wellness & care in Trivandrum · Aestheva",
    description: "Find salons, clinics, studios and independent beauty professionals near you in Thiruvananthapuram. See full prices and real free times, and book in a minute.",
    canonical: base(c) + "/", joinPromo: true, jsonLd: [organisation(base(c)), website(base(c))],
  }, homePage({ providers, services, categories: cats, ratings: rt, next, today, welcome: welcomeAmount(c.env), joined: joined && (WAITLIST_CITIES as readonly string[]).includes(joined) ? joined : undefined }));
});

site.get("/search", async (c) => {
  const db = c.env.DB, today = nowIst().date;
  const q = c.req.query();
  const near = parseNear(q.near);
  const f: SearchQuery = {
    q: String(q.q ?? "").slice(0, 80), area: AREAS.includes(q.area) ? q.area : "", near: near ? `${near.lat},${near.lng}` : "", cat: String(q.cat ?? ""),
    kind: q.kind === "medical" || q.kind === "beauty" ? q.kind : "all", sort: q.sort === "price" || q.sort === "rating" || q.sort === "near" ? q.sort : "rec",
  };
  // Searching from a locality or "near me" ranks every venue by distance instead of hiding the ones next door.
  if (f.area) f.near = "";   // choosing a locality replaces an earlier "near me"
  const from = f.area ? locality(f.area) : near;
  if (from && f.sort === "rec") f.sort = "near";
  if (!from && f.sort === "near") f.sort = "rec";
  const [providers, services, cats, rt, ver] = await Promise.all([liveProviders(db), liveServices(db), categories(db), ratings(db),
    db.prepare("SELECT provider_id, COUNT(*) AS n FROM verifications GROUP BY provider_id").all<{ provider_id: string; n: number }>()]);
  if (f.cat && !cats.some((x) => x.id === f.cat)) f.cat = "";
  const catName = (id: string) => cats.find((x) => x.id === id)?.name ?? id;
  const vcount = new Map(ver.results.map((r) => [r.provider_id, r.n]));
  const distance = (area: string) => { const at = locality(area); return from && at ? km(from, at) : undefined; };
  let results = providers
    .map((p) => ({ p, svcs: matchServices(services.filter((s) => s.provider_id === p.id), p, f, catName), verifications: vcount.get(p.id) ?? 0, km: distance(p.area) }))
    .filter((x) => x.svcs.length);
  const next = await nextAvailable(db, results.flatMap((x) => x.svcs));
  const score = (id: string) => (rt.get(id)?.avg ?? 0) * (rt.get(id)?.n ?? 0);
  if (f.sort === "price") results.sort((a, b) => Math.min(...a.svcs.map((s) => s.price_paise)) - Math.min(...b.svcs.map((s) => s.price_paise)));
  else if (f.sort === "rating") results.sort((a, b) => (rt.get(b.p.id)?.avg ?? 0) - (rt.get(a.p.id)?.avg ?? 0));
  else if (f.sort === "near") results.sort((a, b) => (a.km ?? 999) - (b.km ?? 999));
  else results.sort((a, b) => score(b.p.id) - score(a.p.id));
  // A plain category listing ("Nails, lashes & brows") is a page worth finding on Google; filtered or typed searches are not.
  const catPage = !!f.cat && !f.q && !f.area && !f.near && f.kind === "all" && f.sort === "rec";
  const b = base(c), where = f.area || "Trivandrum";
  return page(c, {
    title: catPage ? `${catName(f.cat)} in Trivandrum · Book online · Aestheva` : `${f.q ? f.q + " · " : f.cat ? catName(f.cat) + " · " : ""}${where} · Aestheva`,
    description: catPage ? `${CAT_META[f.cat]?.line ?? ""} Compare full prices and book ${catName(f.cat).toLowerCase()} in Thiruvananthapuram (Trivandrum) online.`.trim()
      : `Find and book ${f.cat ? catName(f.cat).toLowerCase() : "beauty, wellness and care"} near ${where}: salons, clinics, studios and independent professionals, with full prices.`,
    canonical: catPage ? `${b}/search?cat=${encodeURIComponent(f.cat)}` : `${b}/search`, nav: "explore", noindex: !!f.q || (catPage && !results.length), joinPromo: true,
    jsonLd: catPage && results.length ? [breadcrumbs(b, [["Home", "/"], [catName(f.cat), `/search?cat=${encodeURIComponent(f.cat)}`]]), itemList(b, results.map((r) => r.p))] : undefined,
  }, searchPage({ f, results, outside: !f.area && !!near && !inServiceArea(near), categories: providers.length ? cats.filter((x) => services.some((s) => s.cat === x.id)) : cats, ratings: rt, next, today, anyLive: providers.length > 0 }));
});

/** A business's own booking link: remembers where the client came from for 30 days, then opens the business's page. */
site.get("/b/:slug", async (c) => {
  const p = await c.env.DB.prepare("SELECT slug FROM providers WHERE slug = ? AND status = 'live'").bind(c.req.param("slug")).first<{ slug: string }>();
  if (!p) return c.redirect("/", 302);
  setCookie(c, VIA_COOKIE, p.slug, { path: "/", maxAge: INCENTIVES.ownLinkDays * 86400, sameSite: "Lax", httpOnly: true, secure: new URL(c.req.url).protocol === "https:" });
  return c.redirect(`/p/${p.slug}`, 302);
});

site.get("/p/:slug", async (c) => {
  const preview = previewAllowed(c.env, c.req.query("preview")) ? c.req.query("preview") : undefined;
  const db = c.env.DB, d = await providerBySlug(db, c.req.param("slug"), !!preview);
  if (!d && c.req.query("preview") !== undefined && !preview)
    return page(c, { title: "Preview link not valid · Aestheva", noindex: true }, notFoundPage("This preview link isn't valid. Check the whole link was copied."), 404);
  if (!d) return page(c, { title: "Not found · Aestheva", noindex: true }, notFoundPage("We couldn't find that venue."), 404);
  const [cats, next] = await Promise.all([categories(db), nextAvailable(db, d.services)]);
  return page(c, {
    title: `${d.provider.name}, ${d.provider.area} · Prices & booking · Aestheva`,
    description: `${d.provider.tagline}. ${typeLabel(d.provider.type)} in ${d.provider.area}, ${d.provider.city}: ${d.services.length ? `${d.services.length} services from ${inrPlain(Math.min(...d.services.map((s) => s.price_paise)))}, with live free times. Book online.` : "see services, prices and free times."}`,
    canonical: `${base(c)}/p/${d.provider.slug}`, nav: "explore", noindex: d.provider.status !== "live",
    jsonLd: d.provider.status === "live" ? [business(base(c), d), breadcrumbs(base(c), [["Home", "/"], [d.provider.area, `/search?area=${encodeURIComponent(d.provider.area)}`], [d.provider.name, `/p/${d.provider.slug}`]])] : undefined,
    ogImage: photosOf(d.provider)[0] ? `${base(c)}${photosOf(d.provider)[0].src}-og.jpg` : undefined,
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
    bookPage(d, pre && d.services.some((s) => s.id === pre) ? pre : null, { gateway, mode: paymentMode(c.env) }, preview, await categories(c.env.DB), welcomeAmount(c.env)));
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

/** The booking as a calendar file, for Apple Calendar and Outlook. Needs the booking's private link. */
site.get("/booking/:ref/calendar.ics", async (c) => {
  const token = c.req.query("t") ?? "";
  const b = await authorisedBooking(c.env.DB, c.req.param("ref"), token);
  const p = (await c.env.DB.prepare("SELECT name, address FROM providers WHERE id = ?").bind(b.provider_id).first<{ name: string; address: string }>())!;
  return c.body(icsFor({ b, p }, `${base(c)}/booking/${b.ref}?t=${token}`), 200, { "content-type": "text/calendar; charset=utf-8", "content-disposition": `attachment; filename="aestheva-${b.ref}.ics"`, "cache-control": "no-store" });
});

site.post("/booking/:ref/cancel", async (c) => {
  const form = await c.req.parseBody();
  const token = String(form.t ?? "");
  const b = await authorisedBooking(c.env.DB, c.req.param("ref"), token);
  const r = await cancelByClient(c.env, b, { requestReview: form.review === "1", reason: String(form.reason ?? "") });
  afterClientCancel(c, b.id, r.refund);
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
site.get("/about", (c) => page(c, { jsonLd: [organisation(base(c))], title: "Our story · Aestheva", description: `Why we built Aestheva, who runs it, and what you can count on when you book care in ${COMPANY.launchCity}.`, canonical: base(c) + "/about", nav: "story", joinPromo: true }, aboutPage()));
site.get("/for-practitioners", async (c) => page(c, { title: "List your business · Aestheva", description: `Salons, studios, clinics and independent professionals: list your beauty, wellness or care business on Aestheva in ${COMPANY.launchCity}.`, canonical: base(c) + "/for-practitioners", nav: "practitioners" }, practitionersPage(await categories(c.env.DB), await foundingPlacesLeft(c.env.DB))));

const applyMeta = (c: C) => ({ title: "Apply to join · Aestheva", description: `Apply to list your salon, studio, clinic or independent business on Aestheva in ${COMPANY.launchCity}.`, canonical: base(c) + "/for-practitioners/apply", nav: "practitioners" as const });
site.get("/for-practitioners/apply", async (c) => {
  const cats = await categories(c.env.DB), pre = c.req.query("cat");
  return page(c, applyMeta(c), applyPage({ values: pre && cats.some((x) => x.id === pre) ? { categories: [pre] } : {}, errors: {}, categories: cats, started: Date.now() }));
});
site.post("/for-practitioners/apply", async (c) => {
  const form = (await c.req.parseBody({ all: true })) as ApplicationForm;
  const cats = await categories(c.env.DB);
  // Bots: the hidden field is filled in, or the form came back faster than a person could fill it. Thank them and store nothing.
  const started = Number(form.t);
  if (String(form.company_website ?? "") !== "" || !(started > 0) || Date.now() - started < 3000) {
    console.log("application ignored as automated");
    return page(c, { ...applyMeta(c), noindex: true }, applyThanksPage(`AP-${crypto.randomUUID().slice(0, 6).toUpperCase()}`, ""));
  }
  const r = validateApplication(form, cats.map((x) => x.id));
  if (!r.ok) return page(c, { ...applyMeta(c), noindex: true }, applyPage({ values: form, errors: r.errors, categories: cats, started }), 400);
  const { ref, repeat } = await createApplication(c.env, r.value, c.req.header("cf-connecting-ip") ?? "");
  // Email the team after responding; a failed email never loses the application, which is already saved.
  if (!repeat) c.executionCtx.waitUntil(notifyNewApplication(c.env, ref, r.value, base(c), r.value.categories.map((id) => cats.find((x) => x.id === id)?.name ?? id)));
  return page(c, { ...applyMeta(c), noindex: true }, applyThanksPage(ref, r.value.contact_name));
});

// ---------- service guides: /trivandrum/<service> ----------

/** Live services matching a guide. Medical guides list only medical services, beauty guides only non-medical ones. */
function topicMatches(t: Topic, providers: ProviderRow[], services: ServiceRow[], catName: (id: string) => string) {
  const f: SearchQuery = { q: t.q, area: "", near: "", cat: "", kind: "all", sort: "rec" };
  return providers.flatMap((p) => matchServices(services.filter((s) => s.provider_id === p.id), p, f, catName)
    .filter((s) => (t.medical ? isMedical(s) : !isMedical(s))).map((s) => ({ p, s })))
    .sort((a, b) => a.s.price_paise - b.s.price_paise);
}
async function topicData(db: D1Database) {
  const [providers, services, cats] = await Promise.all([liveProviders(db), liveServices(db), categories(db)]);
  const catName = (id: string) => cats.find((x) => x.id === id)?.name ?? id;
  return TOPICS.map((t) => ({ t, rows: topicMatches(t, providers, services, catName) }));
}

site.get("/trivandrum", async (c) => {
  const all = await topicData(c.env.DB);
  const live = all.filter((x) => x.rows.length).map(({ t, rows }) => ({ t, n: rows.length, from: rows[0].s.price_paise }));
  return page(c, {
    title: "Beauty, wellness & care prices in Trivandrum · Aestheva",
    description: `Guides to ${live.slice(0, 4).map((x) => x.t.name.toLowerCase()).join(", ")} and more in Thiruvananthapuram (Trivandrum), with full prices and online booking.`,
    canonical: base(c) + "/trivandrum", nav: "explore",
    jsonLd: [breadcrumbs(base(c), [["Home", "/"], ["Service guides", "/trivandrum"]])],
  }, topicIndexPage({ live, soon: all.filter((x) => !x.rows.length).map((x) => x.t) }));
});

site.get("/trivandrum/:slug", async (c) => {
  const t = topicBySlug(c.req.param("slug"));
  if (!t) return page(c, { title: "Not found · Aestheva", noindex: true }, notFoundPage("We couldn't find that guide."), 404);
  const db = c.env.DB, all = await topicData(db), b = base(c);
  const found = all.find((x) => x.t.slug === t.slug)!.rows;
  const next = await nextAvailable(db, found.map((r) => r.s));
  const rows: TopicRow[] = found.map((r) => ({ ...r, next: next.get(r.p.id) }));
  // Related guides: the same kind of care first, then anything else bookable.
  const related = all.filter((x) => x.t.slug !== t.slug && x.rows.length).sort((a, z) => Number(z.t.cat === t.cat) - Number(a.t.cat === t.cat)).slice(0, 6).map((x) => x.t);
  const prices = rows.map((r) => r.s.price_paise);
  return page(c, {
    title: rows.length ? `${t.name} in Trivandrum · Price from ₹${Math.round(Math.min(...prices) / 100).toLocaleString("en-IN")} · Aestheva` : `${t.name} in Trivandrum · Aestheva`,
    description: rows.length
      ? `${t.name}${t.alt ? ` (${t.alt})` : ""} in Thiruvananthapuram: compare ${rows.length} option${rows.length === 1 ? "" : "s"} with full prices from ₹${Math.round(Math.min(...prices) / 100).toLocaleString("en-IN")}, see free times and book online.`
      : `${t.name} in Thiruvananthapuram (Trivandrum): what to expect and common questions. Booking opens as businesses join Aestheva.`,
    canonical: `${b}/trivandrum/${t.slug}`, nav: "explore", noindex: !rows.length,
    jsonLd: [breadcrumbs(b, [["Home", "/"], ["Service guides", "/trivandrum"], [t.name, `/trivandrum/${t.slug}`]]), faqPage(t.faqs),
      ...(rows.length ? [serviceOffer(b, t, prices)] : [])],
  }, topicPage({ t, rows, related, today: nowIst().date }));
});

site.get("/robots.txt", (c) => c.text(c.env.APP_ENV === "production" ? `User-agent: *\nAllow: /\nDisallow: /book/\nDisallow: /booking/\nDisallow: /ops/\nDisallow: /clinic/\nSitemap: ${base(c)}/sitemap.xml\n` : "User-agent: *\nDisallow: /\n"));
site.get("/sitemap.xml", async (c) => {
  const db = c.env.DB, b = base(c);
  const [ps, svcs, guides] = await Promise.all([liveProviders(db), liveServices(db), topicData(db)]);
  const cats = [...new Set(svcs.map((s) => s.cat))];
  const xmlEsc = (u: string) => u.replace(/&/g, "&amp;");
  const urls: [string, string][] = [["/", "daily"], ["/search", "daily"], ...cats.map((id): [string, string] => [`/search?cat=${id}`, "weekly"]), ...ps.map((p): [string, string] => [`/p/${p.slug}`, "daily"]),
    ["/trivandrum", "weekly"], ...guides.filter((g) => g.rows.length).map((g): [string, string] => [`/trivandrum/${g.t.slug}`, "weekly"]),
    ["/about", "monthly"], ["/for-practitioners", "monthly"], ["/for-practitioners/apply", "monthly"], ["/contact", "monthly"], ["/policies/cancellation", "yearly"], ["/policies/terms", "yearly"], ["/policies/privacy", "yearly"]];
  return c.body(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(([u, f]) => `<url><loc>${xmlEsc(b + u)}</loc><changefreq>${f}</changefreq></url>`).join("")}</urlset>`, 200, { "content-type": "application/xml" });
});

export { page, notFoundPage };
export default site;
