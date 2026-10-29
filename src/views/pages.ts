import { AREAS, COMPANY, POLICY, WAITLIST_CITIES } from "../config";
import { fmtTime, relDay } from "../domain/time";
import type { ProviderDetail, ProviderRow, Rating, ServiceRow } from "../services/catalog";
import { isMedical } from "../services/catalog";
import { CAT_META, MED_NOTE, artBox, avatar, catIcon, esc, ic, inr, linkPhones, mapsUrl, photoImg, photosOf, stars, venueMark, venueThumb } from "./ui";

type Next = Map<string, { date: string; min: number }>;
const quals = (t: { quals_json: string }): string[] => { try { const q = JSON.parse(t.quals_json || "[]"); return Array.isArray(q) ? q.map(String) : []; } catch { return []; } };
const nextLabel = (n: { date: string; min: number } | undefined, today: string) => n ? `${relDay(n.date, today)}, ${fmtTime(n.min)}` : "";
const minPrice = (svcs: ServiceRow[]) => Math.min(...svcs.map((s) => s.price_paise));

/** Venue card for the home page: mark, name, what it offers, from-price and its next free time. */
function venueCard(p: ProviderRow, svcs: ServiceRow[], rating: Rating | undefined, next: Next, today: string, catName: (id: string) => string) {
  const na = next.get(p.id);
  const cats = [...new Set(svcs.map((s) => s.cat))].map(catName);
  const cover = photosOf(p)[0];
  return `<a class="vcard${cover ? " has-cover" : ""}" href="/p/${esc(p.slug)}">
    ${cover ? `<div class="vcard-cover">${photoImg(cover, "(max-width:760px) 100vw, 560px")}</div>` : ""}
    <div class="vcard-top">${cover ? "" : venueMark(p.name, p.id, p.art)}<div class="col" style="gap:2px;min-width:0"><span class="eyebrow" style="color:var(--muted)">${esc(p.type)} · ${esc(p.area)}</span><h3>${esc(p.name)}</h3></div>${rating ? stars(rating.avg, rating.n) : '<span class="badge b-blush">New</span>'}</div>
    <p class="small muted">${esc(p.tagline)}</p>
    <div class="vcard-cats">${cats.map((c) => `<span>${esc(c)}</span>`).join("")}</div>
    <div class="vcard-foot"><span class="small">From <b>${inr(minPrice(svcs))}</b></span>${na ? `<span class="next-pill">${ic("clock", 14)} ${nextLabel(na, today)}</span>` : '<span class="small muted">Fully booked for 10 days</span>'}</div>
  </a>`;
}

const BEATS = [
  ["Choose", "Every treatment shows how long it takes and what it costs. No calling around to ask for rates."],
  ["Know who", "Each practitioner is named, with qualifications and registration number. Medical care is marked apart from beauty and wellness."],
  ["Hold your time", `Where there's a deposit, it holds the time and counts towards your bill. Plans change: cancel free up to ${POLICY.freeCancelHours} hours before.`],
  ["Arrive", "For medical treatments, your doctor first checks the treatment is right for you, and says so if something else would suit you better."],
];

// ---------- home ----------

export function homePage(d: {
  providers: ProviderRow[]; services: ServiceRow[]; categories: { id: string; name: string }[]; ratings: Map<string, Rating>; next: Next; today: string; joined?: string;
}) {
  const byProv = (id: string) => d.services.filter((s) => s.provider_id === id);
  const catName = (id: string) => d.categories.find((c) => c.id === id)?.name ?? id;
  const live = d.providers.filter((p) => byProv(p.id).length);
  const open = live.length > 0;
  // Soonest free time first, so the venue you could walk into today leads.
  const soon = (id: string) => { const n = d.next.get(id); return n ? `${n.date} ${String(n.min).padStart(4, "0")}` : "9999"; };
  const featured = [...live].sort((a, b) => soon(a.id).localeCompare(soon(b.id))).slice(0, 6);
  const names = [...new Set(d.services.map((s) => s.name))];
  const cats = d.categories.map((c) => ({ ...c, svcs: d.services.filter((s) => s.cat === c.id) })).filter((c) => c.svcs.length);
  // Suggestions: the first treatment of each category on offer, so every link finds something.
  const popular = cats.map((c) => c.svcs[0].name).slice(0, 5);
  const others = WAITLIST_CITIES.filter((c) => c !== COMPANY.launchCity);
  const liveCard = `<div class="live-card" aria-label="Next free times">
      <div class="row between"><span class="eyebrow">Next free times</span><span class="live-dot">Live</span></div>
      <div class="mt12">${featured.slice(0, 4).map((p) => { const n = d.next.get(p.id); return `<a class="live-row" href="/p/${esc(p.slug)}">${venueThumb(p, "s")}<div class="grow col" style="gap:0;min-width:0"><b>${esc(p.name)}</b><span class="xs muted">${esc(p.area)}</span></div><span class="live-time">${n ? nextLabel(n, d.today) : "Fully booked"}</span></a>`; }).join("")}</div>
      <p class="xs muted mt12">Times update as people book. What you see is what's free.</p>
    </div>`;
  return `<div class="page" style="padding-top:0">
  <section class="hero"><div class="hero-grid">
    <div>
      <div class="eyebrow">${esc(COMPANY.launchCity)} · ${open ? "Now booking" : "Opening soon"}</div>
      <h1 class="mt16">Good care, <em>in step</em> with your day.</h1>
      ${open ? `<p class="lede mt16">Book verified doctors and clinics for skin, hair and dental care in ${esc(COMPANY.launchCity)}. See the full price, who will treat you and the times that are genuinely free, then hold your appointment in a minute.</p>
      <form class="searchbar" action="/search" method="get" role="search">
        <div class="seg">${ic("search", 18, 'style="color:var(--rose)"')}<div class="grow"><label for="hq">Treatment or clinic</label><input id="hq" name="q" list="svc-list" placeholder="Search treatments or clinics" autocomplete="off"></div></div>
        <datalist id="svc-list">${cats.map((c) => `<option value="${esc(c.name)}">`).join("")}${names.map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
        <div class="seg" style="flex:.75">${ic("pin", 18, 'style="color:var(--rose)"')}<div class="grow"><label for="ha">Area</label><select id="ha" name="area"><option value="">All of ${esc(COMPANY.launchCity)}</option>${AREAS.map((a) => `<option>${a}</option>`).join("")}</select></div></div>
        <button class="btn btn-p" type="submit" style="padding:14px 26px">Search</button>
      </form>
      ${popular.length ? `<div class="chips mt16"><span class="small muted" style="align-self:center">Try:</span>${popular.map((t) => `<a class="chip" href="/search?q=${encodeURIComponent(t)}">${esc(t)}</a>`).join("")}</div>` : ""}`
      : `<p class="lede mt16">Verified doctors and clinics for skin, hair and dental care in ${esc(COMPANY.launchCity)}, with the price, the practitioner and a genuinely free time on one page. We're checking our first clinics now, and bookings open as each one goes live.</p>
      <div id="notify" class="mt24" style="max-width:540px">
        ${d.joined === COMPANY.launchCity ? `<p class="form-ok" role="status">Thank you. We'll email you when bookings open in ${esc(COMPANY.launchCity)}.</p>` : `
        <form class="row wrap" method="post" action="/waitlist" style="gap:10px">
          <input type="hidden" name="city" value="${esc(COMPANY.launchCity)}">
          <label class="sr" for="notify-email">Email</label><input class="in grow" id="notify-email" name="email" type="email" required placeholder="you@example.com" style="min-width:200px">
          <button class="btn btn-p" type="submit">Tell me when bookings open</button>
        </form>`}
        <p class="small muted mt16">Run a clinic, salon or wellness centre? <a href="/for-practitioners">Join Aestheva</a></p>
      </div>`}
    </div>
    ${open ? `<div class="hero-visual">${artBox("hero-aestheva", 0, "hero-art")}${liveCard}</div>` : artBox("hero-aestheva", 0, "hero-art")}
  </div></section>

  ${open ? `<section><div class="section-head"><div><div class="eyebrow">Treatments</div><h2 class="mt8">What would you like to book?</h2></div><a class="btn btn-o btn-s" href="/search">See everything</a></div>
    <div class="grid g4 cat2-grid">${cats.map((c) => `<a class="cat2" href="/search?cat=${c.id}"><span class="cat2-ic">${catIcon(c.id, 22)}</span><b>${esc(c.name)}</b><span class="small muted">${esc(CAT_META[c.id]?.line ?? "")}</span><span class="xs cat2-n">${c.svcs.length} treatment${c.svcs.length === 1 ? "" : "s"} · from ${inr(minPrice(c.svcs))}</span></a>`).join("")}</div>
  </section>

  <section class="mt64"><div class="section-head"><div><div class="eyebrow">Now booking</div><h2 class="mt8">Clinics you can book today</h2></div></div>
    <div class="grid g3 vgrid${featured.length === 1 ? " vgrid-one" : ""}">${featured.map((p) => venueCard(p, byProv(p.id), d.ratings.get(p.id), d.next, d.today, catName)).join("")}</div>
  </section>` : ""}

  <section class="mt64 beats-wrap">
    <div class="eyebrow">How it works</div><h2 class="mt8" style="max-width:620px">Four steps from searching to sitting in the chair.</h2>
    <ol class="beats mt32">${BEATS.map(([t, b], i) => `<li class="beat"><span class="beat-n">0${i + 1}</span><h3>${t}</h3><p class="small muted mt8">${b}</p></li>`).join("")}</ol>
  </section>

  <section class="mt64 story-band">
    <div class="story-in">
      <div class="eyebrow" style="color:#E9C9D4">Made in Kazhakkoottam</div>
      <h2 class="mt12">Built for a city that keeps long days.</h2>
      <p class="mt16">Technopark shifts, school runs, the evening drive home along the bypass. Booking care in ${esc(COMPANY.launchCity)} should take a minute, not an afternoon of phone calls, and you should know exactly who you're seeing before you leave home.</p>
      <p class="mt12">So we're starting close to home, and adding the city's clinics and practitioners one neighbourhood at a time.</p>
      <a class="btn btn-light mt24" href="/about">Read our story ${ic("arrowR", 16)}</a>
    </div>
  </section>

  <section class="mt64 grid g2" style="align-items:stretch">
    <div class="sage-card"><div class="eyebrow" style="color:var(--sage-d)">For clinics &amp; practitioners</div><h3 class="mt8">Bring your practice to Aestheva</h3><p class="small mt8" style="color:#33463A">A verified profile, your real availability and deposits taken at booking, so the people who book are the people who come.</p><a class="btn btn-ok btn-s mt16" href="/for-practitioners">How joining works</a></div>
    <div class="card" id="waitlist"><div class="eyebrow">Coming next</div><h3 class="mt8">Kochi · Kozhikode · Thrissur</h3><p class="small muted mt8">We're growing city by city. Leave your email and we'll tell you when we open in yours.</p>
      ${d.joined && d.joined !== COMPANY.launchCity ? `<p class="form-ok mt16" role="status">You're on the ${esc(d.joined)} waitlist. We'll email you when we open there.</p>` : ""}
      <form class="row wrap mt16" method="post" action="/waitlist" style="gap:10px">
        <label class="sr" for="wl-city">City</label><select class="in" id="wl-city" name="city" style="width:auto">${others.map((c) => `<option>${c}</option>`).join("")}</select>
        <label class="sr" for="wl-email">Email</label><input class="in grow" id="wl-email" name="email" type="email" required placeholder="you@example.com" style="min-width:180px">
        <button class="btn btn-o btn-s" type="submit">Join the waitlist</button>
      </form></div>
  </section>
  </div>`;
}

// ---------- search ----------

export interface SearchQuery { q: string; area: string; cat: string; kind: "all" | "medical" | "beauty"; sort: "rec" | "price" | "rating" }

export function matchServices(svcs: ServiceRow[], p: ProviderRow, f: SearchQuery, catName: (id: string) => string) {
  const q = f.q.trim().toLowerCase();
  let list = svcs;
  if (q) {
    const provHit = `${p.name} ${p.tagline} ${p.type}`.toLowerCase().includes(q);
    if (!provHit) list = list.filter((s) => {
      const hay = `${s.name} ${catName(s.cat)} ${s.description}`.toLowerCase();
      return hay.includes(q) || q.split(/\s+/).every((w) => hay.includes(w));
    });
  }
  if (f.cat) list = list.filter((s) => s.cat === f.cat);
  if (f.kind === "medical") list = list.filter(isMedical);
  if (f.kind === "beauty") list = list.filter((s) => s.kind === "beauty");
  return list;
}

export function searchPage(d: {
  f: SearchQuery; results: { p: ProviderRow; svcs: ServiceRow[]; verifications: number }[]; categories: { id: string; name: string }[];
  ratings: Map<string, Rating>; next: Next; today: string; anyLive: boolean;
}) {
  const { f } = d;
  const catName = (id: string) => d.categories.find((c) => c.id === id)?.name ?? id;
  const title = f.q ? `“${esc(f.q)}”` : f.cat ? esc(catName(f.cat)) : "Explore treatments";
  const qs = (patch: Partial<SearchQuery>) => { const u = new URLSearchParams(); const m = { ...f, ...patch }; for (const [k, v] of Object.entries(m)) if (v && !(k === "kind" && v === "all") && !(k === "sort" && v === "rec")) u.set(k, v); const s = u.toString(); return s ? "/search?" + s : "/search"; };
  const radio = (name: string, val: string, label: string, cur: string) => `<label class="check"><input type="radio" name="${name}" value="${val}" ${cur === val ? "checked" : ""}> ${label}</label>`;
  const list = d.results.map(({ p, svcs, verifications }) => {
    const r = d.ratings.get(p.id), na = d.next.get(p.id);
    return `<article class="rcard">
      ${photosOf(p)[0] ? `<a class="rcard-photo" href="/p/${esc(p.slug)}" tabindex="-1" aria-hidden="true">${photoImg(photosOf(p)[0], "(max-width:760px) 100vw, 260px", { decorative: true })}</a>` : `<a class="rcard-mark" href="/p/${esc(p.slug)}" tabindex="-1" aria-hidden="true">${venueMark(p.name, p.id, p.art, "l")}</a>`}
      <div style="padding:18px 20px" class="col">
        <span class="eyebrow" style="color:var(--muted)">${esc(p.type)}</span>
        <h3><a href="/p/${esc(p.slug)}" style="color:inherit;text-decoration:none">${esc(p.name)}</a></h3><p class="small muted">${esc(p.tagline)}</p>
        <div class="row wrap small muted" style="gap:14px">${r ? stars(r.avg, r.n) : "<span>No reviews yet</span>"}<span class="row" style="gap:4px">${ic("pin", 14)} ${esc(p.area)}</span>${verifications ? `<span class="row" style="gap:4px;color:var(--sage-d)">${ic("shield", 14)} ${verifications} checks by scope</span>` : ""}</div>
        <div class="mt8">${svcs.slice(0, 3).map((s) => `<div class="svc-line"><span>${esc(s.name)} ${isMedical(s) ? '<span class="badge b-med" style="padding:1px 7px;font-size:10.5px">Medical</span>' : ""}</span><span class="muted" style="white-space:nowrap">${s.dur_min} min · <b style="color:var(--charcoal)">${inr(s.price_paise)}</b></span></div>`).join("")}${svcs.length > 3 ? `<div class="xs muted mt8">+ ${svcs.length - 3} more matching</div>` : ""}</div>
        <div class="row between wrap mt8"><span class="small" style="color:var(--sage-d);font-weight:600">${na ? ic("clock", 14) + " Next available: " + nextLabel(na, d.today) : "No availability in the next 10 days"}</span>
          <a class="btn btn-p btn-s" href="/p/${esc(p.slug)}">See treatments &amp; times</a></div>
      </div></article>`;
  }).join("");
  return `<div class="page">
    <div class="row between wrap" style="gap:16px">
      <div><div class="eyebrow">${esc(COMPANY.launchCity)}${f.area ? " · " + esc(f.area) : ""}</div><h1 class="mt8" style="font-size:clamp(30px,3.6vw,40px)">${title}</h1></div>
      <button class="btn btn-o btn-s filter-toggle" type="button" data-toggle="filters" aria-expanded="false" aria-controls="filters">${ic("filter", 16)} Filters</button>
    </div>
    <div class="chips mt16 scroll-x" style="flex-wrap:nowrap">${d.categories.map((c) => `<a class="chip chip-ic ${f.cat === c.id ? "on" : ""}" href="${qs({ cat: f.cat === c.id ? "" : c.id })}">${catIcon(c.id, 15)} ${esc(c.name)}</a>`).join("")}</div>
    <div class="results-layout mt24">
      <form class="filters" id="filters" method="get" action="/search" data-autosubmit role="search" aria-label="Filters">
        <div><h4><label for="sq">Search</label></h4><input class="in" id="sq" name="q" value="${esc(f.q)}" placeholder="Treatment or venue"></div>
        <div><h4><label for="sa">Location</label></h4><select class="in" id="sa" name="area"><option value="">All Trivandrum</option>${AREAS.map((a) => `<option ${f.area === a ? "selected" : ""}>${a}</option>`).join("")}</select></div>
        <div><h4><label for="sc">Category</label></h4><select class="in" id="sc" name="cat"><option value="">All categories</option>${d.categories.map((c) => `<option value="${c.id}" ${f.cat === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div>
        <fieldset style="border:0;padding:0;margin:0"><legend><h4>Service type</h4></legend>${radio("kind", "all", "All services", f.kind)}${radio("kind", "medical", "Medical consultations &amp; treatments", f.kind)}${radio("kind", "beauty", "Beauty &amp; wellness (non-medical)", f.kind)}</fieldset>
        <div><h4><label for="ss">Sort by</label></h4><select class="in" id="ss" name="sort"><option value="rec" ${f.sort === "rec" ? "selected" : ""}>Recommended</option><option value="price" ${f.sort === "price" ? "selected" : ""}>Lowest price</option><option value="rating" ${f.sort === "rating" ? "selected" : ""}>Top rated</option></select></div>
        <div class="row wrap" style="gap:8px"><button class="btn btn-p btn-s" type="submit">Apply</button><a class="btn btn-o btn-s" href="/search">Clear all</a></div>
      </form>
      <div>
        <div class="row between small muted" style="margin-bottom:14px"><span><b style="color:var(--charcoal)">${d.results.length}</b> venue${d.results.length === 1 ? "" : "s"} · ${d.results.reduce((a, x) => a + x.svcs.length, 0)} matching services</span>${f.kind === "medical" ? '<span class="badge b-med">Medical only</span>' : ""}</div>
        ${d.results.length ? `<div class="col" style="gap:16px">${list}</div>` :
          d.anyLive ? `<div class="card" style="text-align:center;padding:48px 24px"><h2 style="font-size:26px">No matches yet</h2><p class="muted mt8">Try another treatment, neighbourhood or service type.</p><a class="btn btn-p mt16" href="/search">Clear filters</a></div>`
          : `<div class="card" style="text-align:center;padding:48px 24px"><h2 style="font-size:26px">Opening soon</h2><p class="muted mt8">We're verifying our first venues in ${esc(COMPANY.launchCity)}. Bookings open as each one goes live.</p><a class="btn btn-o mt16" href="/for-practitioners">Run a clinic or salon? Join us</a></div>`}
      </div>
    </div></div>`;
}

// ---------- provider ----------

const langs = (t: { langs_json: string }): string[] => { try { const l = JSON.parse(t.langs_json || "[]"); return Array.isArray(l) ? l.map(String) : []; } catch { return []; } };
const kindTag = (s: { kind: string }) => s.kind === "beauty" ? '<span class="tag tag-beauty">Beauty &amp; wellness</span>'
  : s.kind === "consult" ? '<span class="tag tag-med">Consultation</span>' : '<span class="tag tag-med">Medical</span>';

export function providerPage(d: ProviderDetail & { categories: { id: string; name: string }[]; next: Next; today: string; preview?: string }) {
  const pv = d.preview ? `preview=${encodeURIComponent(d.preview)}` : "";
  const draftBanner = d.provider.status === "draft" ? `<div class="note n-plain" role="status" style="margin-bottom:16px">${ic("info", 16)}<div><b>Preview.</b> This venue isn't public yet. Only people with this link can see it or book it.</div></div>` : "";
  const p = d.provider, staffById = new Map(d.staff.map((s) => [s.id, s]));
  const catName = (id: string) => d.categories.find((c) => c.id === id)?.name ?? id;
  const cats = [...new Set(d.services.map((s) => s.cat))];
  const medical = d.services.some(isMedical);
  // Label each treatment only when a venue mixes medical and beauty services; otherwise the note above says it once.
  const mixed = medical && d.services.some((s) => !isMedical(s));
  const amen: string[] = JSON.parse(p.amenities_json || "[]");
  const photos = photosOf(p);
  const na = d.next.get(p.id);
  const bookHref = (svc?: string) => `/book/${esc(p.slug)}${svc ? `?service=${esc(svc)}${pv ? "&amp;" + pv : ""}` : pv ? "?" + pv : ""}`;
  const spoken = [...new Set(d.staff.flatMap(langs))];
  const deposits = d.services.map((s) => s.deposit_paise).filter((x) => x > 0);
  const facts = [
    [ic("users", 18), `${d.staff.length} ${medical ? "practitioner" : "professional"}${d.staff.length === 1 ? "" : "s"}`, d.staff.some((t) => t.medical) ? "Registration numbers shown" : "Certifications shown"],
    [ic("receipt", 18), `${d.services.length} treatment${d.services.length === 1 ? "" : "s"}`, d.services.length ? `From ${inr(minPrice(d.services))}, prices in full` : ""],
    [ic("wallet", 18), deposits.length ? `Deposit from ${inr(Math.min(...deposits))}` : "No deposit", `Free cancellation up to ${POLICY.freeCancelHours}h before`],
    ...(spoken.length ? [[ic("chat", 18), spoken.join(", "), "Languages spoken"]] : []),
  ];
  return `<div class="page">
    ${draftBanner}
    <a class="btn btn-g btn-s" href="/search" style="margin-left:-10px">${ic("chevL", 16)} All clinics</a>
    ${photos.length ? `<div class="v-photos mt12${photos.length > 1 ? " multi" : ""}">${photos.slice(0, 3).map((ph, i) => `<figure>${photoImg(ph, i ? "(max-width:760px) 100vw, 420px" : "(max-width:1280px) 100vw, 1232px", { eager: i === 0 })}</figure>`).join("")}</div>` : ""}
    <header class="v-head ${photos.length ? "mt24" : "mt12"}">
      ${photos.length ? "" : venueMark(p.name, p.id, p.art, "l")}
      <div class="col" style="gap:6px;min-width:0">
        <div class="row wrap" style="gap:8px"><span class="eyebrow">${esc(p.type)} · ${esc(p.area)}</span>${medical ? `<span class="badge b-med">${ic("shield", 12)} Doctor-led</span>` : `<span class="badge b-beauty">${ic("leaf", 12)} Beauty &amp; wellness</span>`}</div>
        <h1>${esc(p.name)}</h1>
        <p class="lede">${esc(p.tagline)}</p>
        <div class="row wrap small muted" style="gap:6px 16px">${d.rating ? stars(d.rating.avg, d.rating.n) : '<span class="badge b-blush">New on Aestheva</span>'}<span class="row" style="gap:4px">${ic("pin", 15)} ${esc(p.area)}, ${esc(p.city)}</span><span class="row" style="gap:4px;align-items:flex-start">${ic("clock", 15, 'style="flex-shrink:0;margin-top:2px"')} <span>${linkPhones(p.hours_text)}</span></span></div>
      </div>
    </header>
    <div class="facts mt24">${facts.map(([i, a, b]) => `<div class="fact">${i}<div><b>${a}</b>${b ? `<span>${b}</span>` : ""}</div></div>`).join("")}</div>
    <div class="p-layout mt32">
      <div>
        <section id="sec-about"><h2 class="sec-h">About ${esc(p.name)}</h2><p class="mt12 about-p">${esc(p.about)}</p>
          ${amen.length ? `<ul class="amen mt16">${amen.map((a) => `<li>${ic("check", 15)} ${esc(a)}</li>`).join("")}</ul>` : ""}
        </section>
        <section id="sec-services" class="mt48">
          <h2 class="sec-h">Treatments &amp; prices</h2>
          ${cats.length > 1 ? `<nav class="jump mt16 scroll-x" aria-label="Treatment categories">${cats.map((c) => `<a href="#cat-${c}">${catIcon(c, 15)} ${esc(catName(c))} <span>${d.services.filter((s) => s.cat === c).length}</span></a>`).join("")}</nav>` : ""}
          ${medical ? `<div class="mt16">${MED_NOTE}</div>` : ""}
          ${cats.map((c) => `<div class="cat-block" id="cat-${c}"><h3 class="cat-h">${catIcon(c, 18)} ${esc(catName(c))}</h3>${d.services.filter((s) => s.cat === c).map((s) => `
            <div class="svc2"><div class="grow col" style="gap:4px;min-width:0"><div class="row wrap" style="gap:8px"><b class="svc2-name">${esc(s.name)}</b>${mixed ? kindTag(s) : ""}</div>${s.description ? `<p class="small muted">${esc(s.description)}</p>` : ""}<span class="xs soft">${s.dur_min} min · ${s.deposit_paise ? `${inr(s.deposit_paise)} deposit at booking` : "No deposit"} · with ${s.staff.map((x) => esc(staffById.get(x)?.name ?? "")).join(" or ")}</span></div>
            <div class="svc2-buy"><b>${inr(s.price_paise)}</b><a class="btn btn-p btn-s" href="${bookHref(s.id)}" aria-label="Book ${esc(s.name)}">Book</a></div></div>`).join("")}</div>`).join("")}
        </section>
        <section id="sec-team" class="mt48"><h2 class="sec-h">Who will see you</h2><p class="small muted mt8">Qualifications and registration numbers as provided${d.verifications.length ? ", checked within the scope listed" : ""}.</p>
          <div class="grid g2 mt16">${d.staff.map((t) => `<div class="team2">${avatar(t.name, 56, t.id)}<div class="col" style="gap:3px;min-width:0"><b class="serif" style="font-size:20px">${esc(t.name)}</b><span class="small">${esc(t.role)}</span><span class="xs" style="color:${t.medical ? "var(--mulberry)" : "var(--sage-d)"};font-weight:700">${t.medical ? "Registered practitioner" : "Certified professional (non-medical)"}</span>${quals(t).length ? `<span class="xs muted">${esc(quals(t).join(", "))}</span>` : ""}${t.registration ? `<span class="xs muted">${esc(t.registration)}</span>` : ""}${langs(t).length ? `<span class="xs soft">${ic("chat", 12)} ${esc(langs(t).join(", "))}</span>` : ""}</div></div>`).join("")}</div>
        </section>
        <section id="sec-visit" class="mt48"><h2 class="sec-h">Visiting</h2>
          <div class="visit mt16">
            <div class="row" style="gap:12px;align-items:flex-start">${ic("pin", 20, 'style="color:var(--rose);flex-shrink:0;margin-top:2px"')}<div><b>Address</b><p class="small muted mt8">${esc(p.address)}</p></div></div>
            <div class="row" style="gap:12px;align-items:flex-start">${ic("clock", 20, 'style="color:var(--rose);flex-shrink:0;margin-top:2px"')}<div><b>Opening hours</b><p class="small muted mt8">${linkPhones(p.hours_text)}</p><p class="xs soft mt8">Online booking shows each practitioner's own hours.</p></div></div>
            <a class="btn btn-o btn-s" href="${mapsUrl(`${p.name}, ${p.address}`)}" target="_blank" rel="noopener">${ic("nav", 15)} Get directions</a>
          </div>
        </section>
        <section id="sec-reviews" class="mt48"><div class="row between"><h2 class="sec-h">Reviews</h2>${d.rating ? stars(d.rating.avg, d.rating.n) : ""}</div>
          <p class="xs soft mt8">Reviews come only from people who booked on Aestheva, and describe individual experiences, not typical results.</p>
          <div class="mt12">${d.reviews.length ? d.reviews.map((r) => `<div class="review"><div class="row between"><div class="row">${avatar(r.author, 34)}<div><b class="small">${esc(r.author)}</b><div class="xs muted">${esc(r.service_name)}${r.staff_id && staffById.get(r.staff_id) ? " · with " + esc(staffById.get(r.staff_id)!.name) : ""}</div></div></div><div class="col" style="align-items:flex-end;gap:0"><span class="stars" aria-label="${r.rating} out of 5">${"★".repeat(r.rating)}<span style="color:#E6D6DB">${"★".repeat(5 - r.rating)}</span></span><span class="xs soft">${esc(r.created_on)}</span></div></div><p class="small mt8">${esc(r.body)}</p></div>`).join("") : `<div class="empty-note">${ic("star", 18)}<div><b>New on Aestheva</b><p class="small muted">Reviews appear here after completed appointments.</p></div></div>`}</div>
        </section>
      </div>
      <aside class="sticky col" style="gap:16px">
        <div class="card book-card"><div class="eyebrow">Book an appointment</div>
          <p class="mt12 small muted">Next free time</p><p class="serif" style="font-size:28px;font-weight:600;line-height:1.15">${na ? nextLabel(na, d.today) : "Fully booked for 10 days"}</p>
          <a class="btn btn-p mt16" style="width:100%" href="${bookHref()}">Choose a time</a>
          <ul class="ticks mt16"><li>${ic("check", 14)} Full price shown before you book</li><li>${ic("check", 14)} Free cancellation up to ${POLICY.freeCancelHours} hours before</li><li>${ic("check", 14)} Pay the balance at the clinic</li></ul></div>
        <div class="card"><div class="row" style="gap:8px">${ic("shield", 18, 'style="color:var(--sage-d)"')}<b>What we've verified</b></div>
          ${d.verifications.length ? d.verifications.map((v) => `<div class="verify">${ic("check", 16)}<div><b>${esc(v.label)}</b><div class="xs muted">${esc(v.scope)} · checked ${esc(v.checked_on)}</div></div></div>`).join("")
            : `<p class="small muted mt12">Verification in progress. We list each check here, with its scope and date, once it's complete.</p>`}
          <p class="xs soft mt8">Verification confirms documents within the stated scope on the date checked. It doesn't guarantee outcomes or suitability for you.</p></div>
      </aside>
    </div>
    <div class="mbar"><div class="col" style="gap:0"><span class="xs muted">Next free time</span><b>${na ? nextLabel(na, d.today) : "Fully booked"}</b></div><a class="btn btn-p" href="${bookHref()}">Choose a time</a></div>
  </div>`;
}

export function notFoundPage(msg = "We couldn't find that page.") {
  return `<div class="page narrow" style="text-align:center;padding-top:80px"><div class="eyebrow">Not found</div><h1 class="mt12" style="font-size:44px">${esc(msg)}</h1><p class="muted mt12">It may have moved, or the link may be incomplete.</p><div class="row wrap mt24" style="justify-content:center"><a class="btn btn-p" href="/search">Explore venues</a><a class="btn btn-o" href="/">Home</a></div></div>`;
}
