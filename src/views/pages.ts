import { AREAS, COMPANY, POLICY, WAITLIST_CITIES } from "../config";
import { fmtTime, relDay } from "../domain/time";
import type { ProviderDetail, ProviderRow, Rating, ServiceRow } from "../services/catalog";
import { isMedical } from "../services/catalog";
import { MED_NOTE, artBox, avatar, esc, ic, inr, kindBadge, stars } from "./ui";

type Next = Map<string, { date: string; min: number }>;
const quals = (t: { quals_json: string }): string[] => { try { const q = JSON.parse(t.quals_json || "[]"); return Array.isArray(q) ? q.map(String) : []; } catch { return []; } };
const nextLabel = (n: { date: string; min: number } | undefined, today: string) => n ? `${relDay(n.date, today)}, ${fmtTime(n.min)}` : "";
const minPrice = (svcs: ServiceRow[]) => Math.min(...svcs.map((s) => s.price_paise));

function providerCard(p: ProviderRow, svcs: ServiceRow[], rating: Rating | undefined, next: Next, today: string) {
  const na = next.get(p.id);
  return `<a class="pcard" href="/p/${esc(p.slug)}">
    ${artBox(p.id, p.art)}
    <div class="body">
      <div class="row between"><span class="eyebrow" style="color:var(--muted)">${esc(p.type)}</span>${rating ? stars(rating.avg, rating.n) : '<span class="badge b-blush">New</span>'}</div>
      <h3 style="font-size:21px;font-weight:500">${esc(p.name)}</h3>
      <div class="row small muted">${ic("pin", 14)} ${esc(p.area)}, ${esc(p.city)}</div>
      <div class="small muted">From ${inr(minPrice(svcs))} · ${na ? `<span style="color:var(--sage-d);font-weight:600">Next: ${nextLabel(na, today)}</span>` : "No slots in the next 10 days"}</div>
    </div>
  </a>`;
}

// ---------- home ----------

export function homePage(d: {
  providers: ProviderRow[]; services: ServiceRow[]; categories: { id: string; name: string }[]; ratings: Map<string, Rating>; next: Next; today: string; joined?: string;
}) {
  const byProv = (id: string) => d.services.filter((s) => s.provider_id === id);
  const featured = d.providers.filter((p) => byProv(p.id).length)
    .sort((a, b) => (d.ratings.get(b.id)?.avg ?? 0) * (d.ratings.get(b.id)?.n ?? 0) - (d.ratings.get(a.id)?.avg ?? 0) * (d.ratings.get(a.id)?.n ?? 0)).slice(0, 4);
  const names = [...new Set(d.services.map((s) => s.name))];
  const open = d.providers.length > 0;
  // Popular searches: the names of the most-offered services, so every link finds something.
  const counts = new Map<string, number>(); for (const s of d.services) counts.set(s.name, (counts.get(s.name) ?? 0) + 1);
  const popular = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n]) => n);
  const others = WAITLIST_CITIES.filter((c) => c !== COMPANY.launchCity);
  return `<div class="page" style="padding-top:0">
  <section class="hero"><div class="hero-grid">
    <div>
      <div class="eyebrow">${open ? "Now open" : "Opening soon"} in ${esc(COMPANY.launchCity)}</div>
      <h1 class="mt16">Considered care for <em>skin, hair</em> &amp; wellbeing.</h1>
      ${open ? `<p class="muted mt16" style="font-size:17px;max-width:540px">Discover verified clinics, studios and independent practitioners across Trivandrum, and book in a few calm steps. Medical consultations and beauty services are always clearly labelled.</p>
      <form class="searchbar" action="/search" method="get" role="search">
        <div class="seg">${ic("search", 18, 'style="color:var(--rose)"')}<div class="grow"><label for="hq">Treatment or venue</label><input id="hq" name="q" list="svc-list" placeholder="Facial, hair loss, Shirodhara…" autocomplete="off"></div></div>
        <datalist id="svc-list">${d.categories.map((c) => `<option value="${esc(c.name)}">`).join("")}${names.map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
        <div class="seg" style="flex:.75">${ic("pin", 18, 'style="color:var(--rose)"')}<div class="grow"><label for="ha">Location</label><select id="ha" name="area"><option value="">All Trivandrum</option>${AREAS.map((a) => `<option>${a}</option>`).join("")}</select></div></div>
        <button class="btn btn-p" type="submit" style="padding:14px 26px">Search</button>
      </form>
      ${popular.length ? `<div class="chips mt16"><span class="small muted" style="align-self:center">Popular:</span>${popular.map((t) => `<a class="chip" href="/search?q=${encodeURIComponent(t)}">${esc(t)}</a>`).join("")}</div>` : ""}`
      : `<p class="muted mt16" style="font-size:17px;max-width:540px">Verified clinics, studios and independent practitioners across Trivandrum, bookable in a few calm steps. We're checking our first venues now, and bookings open as each one goes live.</p>
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
    ${artBox("hero-aestheva", 0, "hero-art")}
  </div></section>

  <section><div class="section-head"><div><div class="eyebrow">Browse by neighbourhood</div><h2 class="mt8">Across Trivandrum</h2></div></div>
    <div class="grid g4">${AREAS.map((a, i) => `<a class="cat-tile" href="/search?area=${encodeURIComponent(a)}">${artBox("area" + a, [1, 5, 2, 3][i])}<div class="t"><h3 style="font-size:19px;font-weight:600">${a}</h3><div class="small muted">${open ? `${d.providers.filter((p) => p.area === a).length} venues` : "Opening soon"}</div></div></a>`).join("")}</div>
  </section>

  <section class="mt48"><div class="section-head"><div><div class="eyebrow">Treatments</div><h2 class="mt8">What are you looking for?</h2></div><a class="btn btn-o btn-s" href="/search">View all</a></div>
    <div class="grid g4 cat-grid">${d.categories.map((c, i) => `<a class="cat-tile" href="/search?cat=${c.id}">${artBox("cat" + c.id, [2, 0, 3, 1, 4, 5, 6, 7][i])}<div class="t"><h3 style="font-size:18px;font-weight:600">${esc(c.name)}</h3><div class="xs muted">${open ? `${d.services.filter((s) => s.cat === c.id).length} services` : "Opening soon"}</div></div></a>`).join("")}</div>
  </section>

  ${featured.length ? `<section class="mt48"><div class="section-head"><div><div class="eyebrow">Well reviewed</div><h2 class="mt8">Featured in Trivandrum</h2></div></div>
    <div class="grid g4 pgrid">${featured.map((p) => providerCard(p, byProv(p.id), d.ratings.get(p.id), d.next, d.today)).join("")}</div>
  </section>` : ""}

  <section class="mt48 soft-card" style="padding:clamp(24px,4vw,48px)">
    <div class="eyebrow">How Aestheva works</div><h2 class="mt8" style="max-width:640px">Clear about what you're booking, and who you're seeing.</h2>
    <div class="grid g3 mt32">
      <div><span class="badge b-med">${ic("shield", 12)} Medical consultation</span><h3 class="mt12" style="font-size:19px;font-weight:600">Assessment first</h3><p class="muted small mt8">Medical services are delivered by registered practitioners. Booking reserves a consultation; your practitioner decides whether any treatment is suitable.</p></div>
      <div><span class="badge b-beauty">${ic("leaf", 12)} Beauty &amp; wellness</span><h3 class="mt12" style="font-size:19px;font-weight:600">Non-medical services</h3><p class="muted small mt8">Facials, hair, nails, massage and Ayurveda therapies delivered by certified professionals, labelled separately from medical care.</p></div>
      <div><span class="badge b-plain">${ic("check", 12)} Verified by scope</span><h3 class="mt12" style="font-size:19px;font-weight:600">We say what we checked</h3><p class="muted small mt8">Each profile lists exactly what was verified (registration, certification or business identity) and when. It isn't a promise of results.</p></div>
    </div>
  </section>

  <section class="mt48 grid g2" style="align-items:start">
    <div class="sage-card"><div class="eyebrow" style="color:var(--sage-d)">For practitioners &amp; clinics</div><h3 class="mt8">Bring your practice to Aestheva</h3><p class="small mt8" style="color:#33463A">A verified profile, live availability and deposits taken online at booking. Applications are reviewed by scope before going live.</p><a class="btn btn-ok btn-s mt16" href="/for-practitioners">How joining works</a></div>
    <div class="card" id="waitlist"><div class="eyebrow">Coming next</div><h3 class="mt8">Kochi · Kozhikode · Thrissur</h3><p class="small muted mt8">We're launching city by city. Leave your email and we'll tell you when we open in your city.</p>
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
      <a class="art" href="/p/${esc(p.slug)}" tabindex="-1" aria-hidden="true">${artBox(p.id, p.art)}</a>
      <div style="padding:18px 20px" class="col">
        <span class="eyebrow" style="color:var(--muted)">${esc(p.type)}</span>
        <h3><a href="/p/${esc(p.slug)}" style="color:inherit;text-decoration:none">${esc(p.name)}</a></h3>
        <div class="row wrap small muted" style="gap:14px">${r ? stars(r.avg, r.n) : "<span>No reviews yet</span>"}<span class="row" style="gap:4px">${ic("pin", 14)} ${esc(p.area)}</span>${verifications ? `<span class="row" style="gap:4px;color:var(--sage-d)">${ic("shield", 14)} ${verifications} checks by scope</span>` : ""}</div>
        <div class="mt8">${svcs.slice(0, 3).map((s) => `<div class="svc-line"><span>${esc(s.name)} ${isMedical(s) ? '<span class="badge b-med" style="padding:1px 7px;font-size:10.5px">Medical</span>' : ""}</span><span class="muted" style="white-space:nowrap">${s.dur_min} min · <b style="color:var(--charcoal)">${inr(s.price_paise)}</b></span></div>`).join("")}${svcs.length > 3 ? `<div class="xs muted mt8">+ ${svcs.length - 3} more matching</div>` : ""}</div>
        <div class="row between wrap mt8"><span class="small" style="color:var(--sage-d);font-weight:600">${na ? ic("clock", 14) + " Next available: " + nextLabel(na, d.today) : "No availability in the next 10 days"}</span>
          <a class="btn btn-p btn-s" href="/p/${esc(p.slug)}">View &amp; book</a></div>
      </div></article>`;
  }).join("");
  return `<div class="page">
    <div class="row between wrap" style="gap:16px">
      <div><div class="eyebrow">${esc(COMPANY.launchCity)}${f.area ? " · " + esc(f.area) : ""}</div><h1 class="mt8" style="font-size:clamp(30px,3.6vw,40px)">${title}</h1></div>
      <button class="btn btn-o btn-s filter-toggle" type="button" data-toggle="filters" aria-expanded="false" aria-controls="filters">${ic("filter", 16)} Filters</button>
    </div>
    <div class="chips mt16 scroll-x" style="flex-wrap:nowrap">${d.categories.map((c) => `<a class="chip ${f.cat === c.id ? "on" : ""}" href="${qs({ cat: f.cat === c.id ? "" : c.id })}">${esc(c.name)}</a>`).join("")}</div>
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

export function providerPage(d: ProviderDetail & { categories: { id: string; name: string }[]; next: Next; today: string; preview?: string }) {
  const pv = d.preview ? `preview=${encodeURIComponent(d.preview)}` : "";
  const draftBanner = d.provider.status === "draft" ? `<div class="note n-plain" role="status" style="margin-bottom:16px">${ic("info", 16)}<div><b>Preview.</b> This venue isn't public yet. Only people with this link can see it or book it.</div></div>` : "";
  const p = d.provider, staffById = new Map(d.staff.map((s) => [s.id, s]));
  const catName = (id: string) => d.categories.find((c) => c.id === id)?.name ?? id;
  const cats = [...new Set(d.services.map((s) => s.cat))];
  const medical = d.services.some(isMedical);
  const amen: string[] = JSON.parse(p.amenities_json || "[]");
  const na = d.next.get(p.id);
  return `<div class="page">
    ${draftBanner}
    <a class="btn btn-g btn-s" href="/search" style="margin-left:-10px">${ic("chevL", 16)} All venues</a>
    <div class="p-hero mt12">${artBox(p.id, p.art)}${artBox(p.id + "b", p.art + 1)}${artBox(p.id + "c", p.art + 3)}</div>
    <div class="p-layout mt32">
      <div>
        <div class="row wrap" style="gap:8px"><span class="eyebrow">${esc(p.type)}</span>${medical ? `<span class="badge b-med">${ic("shield", 12)} Offers medical consultations</span>` : `<span class="badge b-beauty">${ic("leaf", 12)} Non-medical services</span>`}</div>
        <h1 class="mt12" style="font-size:clamp(34px,4.6vw,52px)">${esc(p.name)}</h1>
        <p class="muted mt8" style="font-size:17px">${esc(p.tagline)}</p>
        <div class="row wrap mt12 small" style="gap:16px">${d.rating ? stars(d.rating.avg, d.rating.n) : ""}<span class="row muted" style="gap:4px">${ic("pin", 15)} ${esc(p.area)}, ${esc(p.city)}</span><span class="row muted" style="gap:4px">${ic("clock", 15)} ${esc(p.hours_text)}</span></div>
        <nav class="tabs mt32 scroll-x" aria-label="Sections">${["Services", "Team", "Reviews", "About"].map((t, i) => `<a class="${i === 0 ? "on" : ""}" href="#sec-${t.toLowerCase()}" style="text-decoration:none">${t}</a>`).join("")}</nav>
        <section id="sec-services">
          <h2 class="sr">Services</h2>
          ${medical ? MED_NOTE : ""}
          ${cats.map((c) => `<h3 class="mt24" style="margin-bottom:6px;font-size:19px;font-weight:600">${esc(catName(c))}</h3>${d.services.filter((s) => s.cat === c).map((s) => `
            <div class="svc-row"><div class="col grow" style="gap:4px"><div class="row wrap" style="gap:8px"><b style="font-size:15.5px">${esc(s.name)}</b>${kindBadge(s)}</div><span class="small muted">${esc(s.description)}</span><span class="xs soft">${s.dur_min} min · ${s.deposit_paise ? `${inr(s.deposit_paise)} deposit at booking` : "No deposit"} · with ${s.staff.map((x) => esc(staffById.get(x)?.name ?? "")).join(", ")}</span></div>
            <div class="row" style="gap:14px"><b style="font-size:16px;white-space:nowrap">${inr(s.price_paise)}</b><a class="btn btn-p btn-s" href="/book/${esc(p.slug)}?service=${esc(s.id)}${pv ? "&amp;" + pv : ""}" aria-label="Book ${esc(s.name)}">Book</a></div></div>`).join("")}`).join("")}
        </section>
        <section id="sec-team" class="mt48"><h2 style="font-size:28px">Team</h2><p class="small muted mt8">Qualifications are shown as provided and checked within the scope listed.</p>
          <div class="grid g2 mt16">${d.staff.map((t) => `<div class="team-card">${avatar(t.name, 52, t.id)}<div class="col" style="gap:2px"><b>${esc(t.name)}</b><span class="small muted">${esc(t.role)}</span><span class="xs" style="color:${t.medical ? "var(--mulberry)" : "var(--sage-d)"};font-weight:600">${t.medical ? "Registered practitioner" : "Certified professional (non-medical)"}</span>${quals(t).length ? `<span class="xs">${esc(quals(t).join(", "))}</span>` : ""}${t.registration ? `<span class="xs muted">${esc(t.registration)}</span>` : ""}</div></div>`).join("")}</div>
        </section>
        <section id="sec-reviews" class="mt48"><div class="row between"><h2 style="font-size:28px">Reviews</h2>${d.rating ? stars(d.rating.avg, d.rating.n) : ""}</div>
          <p class="xs soft mt8">Reviews come from Aestheva bookings and describe individual experiences, not typical results.</p>
          <div class="mt12">${d.reviews.length ? d.reviews.map((r) => `<div class="review"><div class="row between"><div class="row">${avatar(r.author, 34)}<div><b class="small">${esc(r.author)}</b><div class="xs muted">${esc(r.service_name)}${r.staff_id && staffById.get(r.staff_id) ? " · with " + esc(staffById.get(r.staff_id)!.name) : ""}</div></div></div><div class="col" style="align-items:flex-end;gap:0"><span class="stars" aria-label="${r.rating} out of 5">${"★".repeat(r.rating)}<span style="color:#E6D6DB">${"★".repeat(5 - r.rating)}</span></span><span class="xs soft">${esc(r.created_on)}</span></div></div><p class="small mt8">${esc(r.body)}</p></div>`).join("") : '<p class="muted">No reviews yet.</p>'}</div>
        </section>
        <section id="sec-about" class="mt48"><h2 style="font-size:28px">About</h2><p class="mt12" style="max-width:680px">${esc(p.about)}</p>
          <div class="chips mt16">${amen.map((a) => `<span class="badge b-plain" style="padding:6px 12px">${esc(a)}</span>`).join("")}</div>
          <div class="card mt24 row" style="gap:16px;align-items:flex-start">${ic("pin", 20, 'style="color:var(--rose);flex-shrink:0"')}<div><b>Address</b><p class="small muted mt8">${esc(p.address)}</p></div></div>
        </section>
      </div>
      <aside class="sticky col" style="gap:16px">
        <div class="card"><div class="eyebrow">Book an appointment</div>
          <p class="mt12 small muted">Next available</p><p class="serif" style="font-size:26px;font-weight:600">${na ? nextLabel(na, d.today) : "Fully booked for 10 days"}</p>
          <a class="btn btn-p mt16" style="width:100%" href="/book/${esc(p.slug)}${pv ? "?" + pv : ""}">Book now</a>
          <p class="xs muted mt12">Free cancellation up to ${POLICY.freeCancelHours} hours before. <a href="/policies/cancellation">Cancellation policy</a></p></div>
        <div class="card"><div class="row" style="gap:8px">${ic("shield", 18, 'style="color:var(--sage-d)"')}<b>What we've verified</b></div>
          ${d.verifications.length ? d.verifications.map((v) => `<div class="verify">${ic("check", 16)}<div><b>${esc(v.label)}</b><div class="xs muted">${esc(v.scope)} · checked ${esc(v.checked_on)}</div></div></div>`).join("")
            : `<p class="small muted mt12">Verification in progress. We list each check here, with its scope and date, once it's complete.</p>`}
          <p class="xs soft mt8">Verification confirms documents within the stated scope on the date checked. It doesn't guarantee outcomes or suitability for you.</p></div>
      </aside>
    </div></div>`;
}

export function notFoundPage(msg = "We couldn't find that page.") {
  return `<div class="page narrow" style="text-align:center;padding-top:80px"><div class="eyebrow">Not found</div><h1 class="mt12" style="font-size:44px">${esc(msg)}</h1><p class="muted mt12">It may have moved, or the link may be incomplete.</p><div class="row wrap mt24" style="justify-content:center"><a class="btn btn-p" href="/search">Explore venues</a><a class="btn btn-o" href="/">Home</a></div></div>`;
}
