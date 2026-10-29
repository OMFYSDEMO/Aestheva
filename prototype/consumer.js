/* AESTHEVA prototype — consumer marketplace */
const CV = {};

/* ---------- search logic ---------- */
function matchSvcs(p){
  const f = S.search; const q = f.q.trim().toLowerCase();
  let list = svcsOf(p.id);
  if (q){
    const provHit = (p.name+' '+p.tagline+' '+p.type).toLowerCase().includes(q);
    if (!provHit) list = list.filter(s => (s.name+' '+cat(s.cat).name+' '+s.desc).toLowerCase().includes(q) || q.split(/\s+/).every(w => (s.name+' '+cat(s.cat).name).toLowerCase().includes(w)));
  }
  if (f.cats.length) list = list.filter(s => f.cats.includes(s.cat));
  if (f.kind==='medical') list = list.filter(isMed);
  if (f.kind==='beauty') list = list.filter(s => s.kind==='beauty');
  list = list.filter(s => s.price <= f.max);
  return list;
}
function searchResults(){
  const f = S.search;
  let out = S.providers.filter(p => p.active).map(p => ({p, svcs: matchSvcs(p)})).filter(x => x.svcs.length);
  if (f.area) out = out.filter(x => x.p.area===f.area);
  if (f.types.length) out = out.filter(x => f.types.includes(x.p.type));
  if (f.rating) out = out.filter(x => rating(x.p.id) >= 4.5);
  if (f.avail!=='any') out = out.filter(x => availOn(x.p.id, f.avail, x.svcs));
  const minP = x => Math.min(...x.svcs.map(s=>s.price));
  if (f.sort==='price') out.sort((a,b)=>minP(a)-minP(b));
  if (f.sort==='rating') out.sort((a,b)=>rating(b.p.id)-rating(a.p.id));
  if (f.sort==='rec') out.sort((a,b)=> (b.p.isNew?1:0)-(a.p.isNew?1:0) || rating(b.p.id)*reviewsOf(b.p.id).length - rating(a.p.id)*reviewsOf(a.p.id).length);
  return out;
}
const favBtn = (pid, cls='') => { const on = S.favourites.includes(pid); return `<button class="icon-btn heart ${on?'on':''} ${cls}" data-a="fav" data-id="${pid}" data-stop="1" aria-label="${on?'Remove from':'Save to'} favourites">${ic('heart',17)}</button>`; };
A.fav = el => { const id = el.dataset.id; const i = S.favourites.indexOf(id); if (i>-1){ S.favourites.splice(i,1); toast('Removed from favourites'); } else { S.favourites.push(id); toast('Saved to favourites'); } save(); render(); };

function providerCard(p, svcs){
  svcs = svcs || svcsOf(p.id); const rv = reviewsOf(p.id); const na = nextAvailable(p.id, svcs);
  return `<article class="pcard" data-a="go" data-v="provider" data-p='${JSON.stringify({id:p.id})}' style="position:relative">
    <div class="fav">${favBtn(p.id)}</div>
    ${artBox(p.id, p.art)}
    <div class="body">
      <div class="row between"><span class="eyebrow" style="color:var(--muted)">${esc(p.type)}</span>${rv.length?stars(rating(p.id), rv.length):'<span class="badge b-blush">New</span>'}</div>
      <h4 style="font-size:21px">${esc(p.name)}</h4>
      <div class="row small muted">${ic('pin',14)} ${esc(p.area)}, Thiruvananthapuram</div>
      <div class="small muted">From ${inr(Math.min(...svcs.map(s=>s.price)))} · ${na?`<span style="color:var(--sage-d);font-weight:600">Next: ${na.label}</span>`:'No slots this week'}</div>
    </div>
  </article>`;
}

/* ---------- home ---------- */
CV.home = () => {
  const allSvcNames = [...new Set(S.services.filter(s=>s.active!==false).map(s=>s.name))];
  const featured = S.providers.filter(p=>p.active).slice().sort((a,b)=>rating(b.id)-rating(a.id)).slice(0,4);
  const countIn = a => S.providers.filter(p=>p.active && p.area===a).length;
  return `<div class="page" style="padding-top:0">
  <section class="hero"><div class="hero-grid">
    <div>
      <div class="eyebrow">Now open in Thiruvananthapuram</div>
      <h1 class="mt16">Considered care for <em>skin, hair</em> &amp; wellbeing.</h1>
      <p class="muted mt16" style="font-size:17px;max-width:540px">Discover verified clinics, studios and independent practitioners across Trivandrum — and book in a few calm steps. Medical consultations and beauty services, always clearly labelled.</p>
      <form class="searchbar" data-sub="homeSearch">
        <div class="seg">${ic('search',18,'style="color:var(--rose)"')}<div class="grow"><label for="hq">Treatment or venue</label><input id="hq" name="q" list="svc-list" placeholder="Facial, hair loss, Shirodhara…" value="${esc(S.search.q)}" autocomplete="off"></div></div>
        <datalist id="svc-list">${D.CATEGORIES.map(c=>`<option value="${esc(c.name)}">`).join('')}${allSvcNames.map(n=>`<option value="${esc(n)}">`).join('')}</datalist>
        <div class="seg" style="flex:.75">${ic('pin',18,'style="color:var(--rose)"')}<div class="grow"><label for="ha">Location</label><select id="ha" name="area"><option value="">All Trivandrum</option>${D.AREAS.map(a=>`<option ${S.search.area===a?'selected':''}>${a}</option>`).join('')}</select></div></div>
        <button class="btn btn-p" type="submit" style="padding:14px 26px">Search</button>
      </form>
      <div class="chips mt16"><span class="small muted" style="align-self:center">Popular:</span>${['Hydrating facial','Hair loss consultation','Abhyanga','Gel manicure','Bridal makeup'].map(t=>`<button class="chip" data-a="quick" data-q="${t}">${t}</button>`).join('')}</div>
    </div>
    ${artBox('hero-aestheva', 0, 'hero-art')}
  </div></section>

  <section><div class="section-head"><div><div class="eyebrow">Browse by neighbourhood</div><h2 class="mt8">Across Trivandrum</h2></div></div>
    <div class="grid g4">${D.AREAS.map((a,i)=>`<button class="cat-tile" data-a="areaGo" data-area="${a}">${artBox('area'+a, [1,5,2,3][i])}<div class="t"><h4>${a}</h4><div class="small muted">${countIn(a)} venues · Thiruvananthapuram</div></div></button>`).join('')}</div>
  </section>

  <section class="mt48"><div class="section-head"><div><div class="eyebrow">Treatments</div><h2 class="mt8">What are you looking for?</h2></div><button class="btn btn-o btn-s" data-a="go" data-v="results">View all</button></div>
    <div class="grid g4 cat-grid">${D.CATEGORIES.map(c=>`<button class="cat-tile" data-a="catGo" data-cat="${c.id}">${artBox('cat'+c.id, c.art)}<div class="t"><h4 style="font-size:18px">${c.name}</h4><div class="xs muted">${S.services.filter(s=>s.cat===c.id&&s.active!==false).length} services</div></div></button>`).join('')}</div>
  </section>

  <section class="mt48"><div class="section-head"><div><div class="eyebrow">Well reviewed this month</div><h2 class="mt8">Featured in Trivandrum</h2></div></div>
    <div class="grid g4 pgrid">${featured.map(p=>providerCard(p)).join('')}</div>
  </section>

  <section class="mt48 soft-card" style="padding:clamp(24px,4vw,48px)">
    <div class="eyebrow">How AESTHEVA works</div><h2 class="mt8" style="max-width:640px">Clear about what you're booking — and who you're seeing.</h2>
    <div class="grid g3 mt32">
      <div><span class="badge b-med">${ic('shield',12)} Medical consultation</span><h4 class="mt12">Assessment first</h4><p class="muted small mt8">Medical services are delivered by registered practitioners. Booking reserves a consultation; your practitioner decides whether any treatment is suitable.</p></div>
      <div><span class="badge b-beauty">${ic('leaf',12)} Beauty & wellness</span><h4 class="mt12">Non-medical services</h4><p class="muted small mt8">Facials, hair, nails, massage and Ayurveda therapies delivered by certified professionals — labelled separately from medical care.</p></div>
      <div><span class="badge b-plain">${ic('check',12)} Verified by scope</span><h4 class="mt12">We say what we checked</h4><p class="muted small mt8">Each profile lists exactly what was verified — registration, certification or business identity — and when. It isn't a promise of results.</p></div>
    </div>
  </section>

  <section class="mt48 grid g2" style="align-items:center">
    <div class="sage-card"><div class="eyebrow" style="color:var(--sage-d)">For practitioners & clinics</div><h3 class="mt8">Bring your practice to AESTHEVA</h3><p class="small mt8" style="color:#33463A">Calendar, client records, deposits and a marketplace profile in one place. Applications are reviewed by scope before going live.</p><button class="btn btn-ok btn-s mt16" data-a="toOnboard">Start an application</button></div>
    <div class="card"><div class="eyebrow">Coming next</div><h3 class="mt8">Kochi · Kozhikode · Thrissur</h3><p class="small muted mt8">We're launching city by city, starting with Trivandrum. Join the waitlist when we open in your city.</p><button class="btn btn-o btn-s mt16" data-a="waitlist">Join the waitlist</button></div>
  </section>
  </div>`;
};
A.homeSearch = f => { S.search.q = f.q.value; S.search.area = f.area.value; S.search.cats = []; go('results'); };
A.quick = el => { Object.assign(S.search, {q: el.dataset.q, cats: [], area: ''}); go('results'); };
A.catGo = el => { Object.assign(S.search, {q:'', cats:[el.dataset.cat]}); go('results'); };
A.areaGo = el => { Object.assign(S.search, {q:'', cats:[], area: el.dataset.area}); go('results'); };
A.toOnboard = () => { S.mode = 'practitioner'; S.route.practitioner = {v:'onboard', p:{}}; save(); render(); window.scrollTo(0,0); };
A.waitlist = () => modal('Join the city waitlist', `<form data-sub="joinWait" class="col" style="gap:14px"><label class="f">Your city<select class="in" name="city">${S.cities.filter(c=>c.status!=='active').map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select></label><label class="f">Email <span class="hint">Demo only — not stored outside this browser</span><input class="in" name="email" type="email" required placeholder="you@example.com"></label><button class="btn btn-p" type="submit">Join waitlist</button></form>`);
A.joinWait = f => { const c = S.cities.find(c=>c.id===f.city.value); c.waitlist++; save(); closeModal(); toast(`You're on the ${c.name} waitlist`); };

/* ---------- results ---------- */
CV.results = () => {
  const f = S.search;
  const ck = (group, val, label) => `<label class="check"><input type="checkbox" data-ch="fCheck" data-g="${group}" value="${esc(val)}" ${f[group].includes(val)?'checked':''}> ${label}</label>`;
  const rd = (name, val, label) => `<label class="check"><input type="radio" name="${name}" data-ch="fRadio" data-g="${name}" value="${val}" ${f[name]===val?'checked':''}> ${label}</label>`;
  return `<div class="page">
    <div class="row between wrap" style="gap:16px">
      <div><div class="eyebrow">Thiruvananthapuram${f.area?' · '+esc(f.area):''}</div><h2 class="mt8">${f.q?`“${esc(f.q)}”`:f.cats.length===1?esc(cat(f.cats[0]).name):'Explore treatments'}</h2></div>
      <div class="row wrap">
        <div class="searchbar" style="margin:0;box-shadow:none;padding:3px;min-width:260px"><div class="seg" style="padding:2px 12px">${ic('search',16)}<input placeholder="Search treatments or venues" value="${esc(f.q)}" data-in="sq" aria-label="Search"></div></div>
        <select class="in" style="width:auto;border-radius:999px" data-ch="fSort" aria-label="Sort"><option value="rec" ${f.sort==='rec'?'selected':''}>Recommended</option><option value="price" ${f.sort==='price'?'selected':''}>Lowest price</option><option value="rating" ${f.sort==='rating'?'selected':''}>Top rated</option></select>
        <button class="btn btn-o btn-s filter-toggle" data-a="toggleFilters">${ic('filter',16)} Filters</button>
      </div>
    </div>
    <div class="chips mt16 scroll-x" style="flex-wrap:nowrap">${D.CATEGORIES.map(c=>`<button class="chip ${f.cats.includes(c.id)?'on':''}" data-a="catChip" data-cat="${c.id}">${c.name}</button>`).join('')}</div>
    <div class="results-layout mt24">
      <aside class="filters ${S.ui.filtersOpen?'open':''}">
        <div><h4>Location</h4><select class="in" data-ch="fArea"><option value="">All Trivandrum</option>${D.AREAS.map(a=>`<option ${f.area===a?'selected':''}>${a}</option>`).join('')}</select></div>
        <div><h4>Service type</h4>${rd('kind','all','All services')}${rd('kind','medical','Medical consultations & treatments')}${rd('kind','beauty','Beauty & wellness (non-medical)')}</div>
        <div><h4>Availability</h4>${rd('avail','any','Any time')}${rd('avail','today','Today')}${rd('avail','tomorrow','Tomorrow')}${rd('avail','weekend','This weekend')}${rd('avail','week','Next 7 days')}</div>
        <div><h4>Max price · <span style="color:var(--mulberry)" id="maxv">${f.max>=16000?'Any':inr(f.max)}</span></h4><input type="range" min="500" max="16000" step="500" value="${f.max}" data-in="fMaxLive" data-ch="fMax" aria-label="Maximum price"></div>
        <div><h4>Category</h4>${D.CATEGORIES.map(c=>ck('cats',c.id,c.name)).join('')}</div>
        <div><h4>Provider type</h4>${D.TYPES.map(t=>ck('types',t,t)).join('')}</div>
        <div><h4>Rating</h4><label class="check"><input type="checkbox" data-ch="fRating" ${f.rating?'checked':''}> 4.5 and above</label></div>
        <button class="btn btn-o btn-s" data-a="clearFilters">Clear all filters</button>
      </aside>
      <div id="rres">${resultsList()}</div>
    </div></div>`;
};
function resultsList(){
  const res = searchResults(); const f = S.search;
  const ms = x => x.svcs.slice(0,3).map(s=>`<div class="svc-line"><span>${esc(s.name)} ${isMed(s)?`<span class="badge b-med" style="padding:1px 7px;font-size:10.5px">Medical</span>`:''}</span><span class="muted" style="white-space:nowrap">${s.dur} min · <b style="color:var(--charcoal)">${inr(s.price)}</b></span></div>`).join('');
  return `<div class="row between small muted" style="margin-bottom:14px"><span><b style="color:var(--charcoal)">${res.length}</b> venue${res.length===1?'':'s'} · ${res.reduce((a,x)=>a+x.svcs.length,0)} matching services</span>${f.kind==='medical'?'<span class="badge b-med">Medical only</span>':''}</div>
  ${res.length ? `<div class="col" style="gap:16px">${res.map(x=>{ const p = x.p; const rv = reviewsOf(p.id); const na = nextAvailable(p.id, x.svcs);
    return `<article class="rcard">
      <div class="art" style="cursor:pointer;position:relative" data-a="go" data-v="provider" data-p='${JSON.stringify({id:p.id})}'>${art(p.id,p.art)}</div>
      <div style="padding:18px 20px" class="col">
        <div class="row between"><div class="row wrap" style="gap:8px"><span class="eyebrow" style="color:var(--muted)">${esc(p.type)}</span>${p.isNew?'<span class="badge b-blush">New on AESTHEVA</span>':''}</div>${favBtn(p.id)}</div>
        <h3 style="cursor:pointer" data-a="go" data-v="provider" data-p='${JSON.stringify({id:p.id})}'>${esc(p.name)}</h3>
        <div class="row wrap small muted" style="gap:14px">${rv.length?stars(rating(p.id), rv.length):'<span>No reviews yet</span>'}<span class="row" style="gap:4px">${ic('pin',14)} ${esc(p.area)}</span>${p.verification.length?`<span class="row" style="gap:4px;color:var(--sage-d)">${ic('shield',14)} ${p.verification.length} checks by scope</span>`:''}</div>
        <div class="mt8">${ms(x)}${x.svcs.length>3?`<div class="xs muted mt8">+ ${x.svcs.length-3} more matching</div>`:''}</div>
        <div class="row between wrap mt8"><span class="small" style="color:var(--sage-d);font-weight:600">${na?ic('clock',14)+' Next available: '+na.label:'No availability in the next 10 days'}</span>
          <button class="btn btn-p btn-s" data-a="go" data-v="provider" data-p='${JSON.stringify({id:p.id})}'>View & book</button></div>
      </div></article>`; }).join('')}</div>`
  : `<div class="card" style="text-align:center;padding:48px 24px"><h3>No matches yet</h3><p class="muted mt8">Try widening the price, availability or neighbourhood filters.</p><button class="btn btn-p mt16" data-a="clearFilters">Clear filters</button></div>`}`;
}
const refreshResults = () => { save(); const r = $('#rres'); if (r) r.innerHTML = resultsList(); };
A.sq = el => { S.search.q = el.value; refreshResults(); };
A.fSort = el => { S.search.sort = el.value; refreshResults(); };
A.fArea = el => { S.search.area = el.value; save(); render(); };
A.fRadio = el => { S.search[el.dataset.g] = el.value; refreshResults(); };
A.fCheck = el => { const g = S.search[el.dataset.g]; const i = g.indexOf(el.value); if (el.checked && i<0) g.push(el.value); if (!el.checked && i>-1) g.splice(i,1); save(); render(); };
A.fMaxLive = el => { const v = +el.value; $('#maxv').textContent = v>=16000?'Any':inr(v); };
A.fMax = el => { S.search.max = +el.value; refreshResults(); };
A.fRating = el => { S.search.rating = el.checked; refreshResults(); };
A.catChip = el => { const c = el.dataset.cat; const g = S.search.cats; const i = g.indexOf(c); i>-1 ? g.splice(i,1) : g.push(c); save(); render(); };
A.clearFilters = () => { Object.assign(S.search, {q:'', area:'', cats:[], types:[], kind:'all', max:16000, avail:'any', rating:false}); save(); render(); };
A.toggleFilters = () => { S.ui.filtersOpen = !S.ui.filtersOpen; render(); };

/* ---------- provider profile ---------- */
CV.provider = ({id}) => {
  const p = prov(id); if (!p) return CV.home();
  const sv = svcsOf(id); const team = staffOf(id); const rv = reviewsOf(id); const na = nextAvailable(id);
  const cats = [...new Set(sv.map(s=>s.cat))];
  return `<div class="page">
    <button class="btn btn-g btn-s" data-a="go" data-v="results" style="margin-left:-10px">${ic('chevL',16)} Back to results</button>
    <div class="p-hero mt12">${artBox(p.id,p.art)}${artBox(p.id+'b',(p.art+1))}${artBox(p.id+'c',(p.art+3))}</div>
    <div class="p-layout mt32">
      <div>
        <div class="row between" style="align-items:flex-start"><div>
          <div class="row wrap" style="gap:8px"><span class="eyebrow">${esc(p.type)}</span>${p.isNew?'<span class="badge b-blush">New on AESTHEVA</span>':''}${sv.some(isMed)?'<span class="badge b-med">'+ic('shield',12)+' Offers medical consultations</span>':'<span class="badge b-beauty">'+ic('leaf',12)+' Non-medical services</span>'}</div>
          <h1 class="mt12" style="font-size:clamp(34px,4.6vw,52px)">${esc(p.name)}</h1>
          <p class="muted mt8" style="font-size:17px">${esc(p.tagline)}</p>
          <div class="row wrap mt12 small" style="gap:16px">${rv.length?stars(rating(id), rv.length):''}<span class="row muted" style="gap:4px">${ic('pin',15)} ${esc(p.area)}, Thiruvananthapuram</span><span class="row muted" style="gap:4px">${ic('clock',15)} ${esc(p.hours)}</span></div>
        </div>${favBtn(p.id)}</div>
        <div class="tabs mt32 scroll-x">${['Services','Team','Reviews','About'].map((t,i)=>`<button class="${i===0?'on':''}" data-a="jump" data-to="sec-${t.toLowerCase()}">${t}</button>`).join('')}</div>
        <section id="sec-services">
          ${sv.some(isMed)?MED_NOTE:''}
          ${cats.map(c=>`<h4 class="mt24" style="margin-bottom:6px">${esc(cat(c).name)}</h4>${sv.filter(s=>s.cat===c).map(s=>`
            <div class="svc-row"><div class="col grow" style="gap:4px"><div class="row wrap" style="gap:8px"><b style="font-size:15.5px">${esc(s.name)}</b>${kindBadge(s)}</div><span class="small muted">${esc(s.desc)}</span><span class="xs soft">${s.dur} min · ${s.deposit?`${inr(s.deposit)} deposit at booking`:'No deposit'} · with ${s.staff.map(x=>esc(stf(x)?.name||'')).join(', ')}</span></div>
            <div class="row" style="gap:14px"><b style="font-size:16px;white-space:nowrap">${inr(s.price)}</b><button class="btn btn-p btn-s" data-a="book" data-pid="${p.id}" data-sid="${s.id}">Book</button></div></div>`).join('')}`).join('')}
        </section>
        <section id="sec-team" class="mt48"><h3>Team</h3><p class="small muted mt8">Qualifications are shown as provided and checked within the scope listed.</p>
          <div class="grid g2 mt16">${team.map(t=>`<button class="team-card" data-a="go" data-v="practitioner" data-p='${JSON.stringify({id:t.id})}'>${avatar(t.name,52,t.id)}<div class="col" style="gap:2px"><b>${esc(t.name)}</b><span class="small muted">${esc(t.role)}</span><span class="xs" style="color:${t.medical?'var(--mulberry)':'var(--sage-d)'};font-weight:600">${t.medical?'Registered medical practitioner':'Certified professional (non-medical)'}</span></div></button>`).join('')}</div>
        </section>
        <section id="sec-reviews" class="mt48"><div class="row between"><h3>Reviews</h3>${rv.length?stars(rating(id), rv.length):''}</div>
          <p class="xs soft mt8">Reviews come from verified AESTHEVA bookings and describe individual experiences, not typical results.</p>
          <div class="mt12">${rv.length?rv.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(r=>reviewHtml(r)).join(''):'<p class="muted">No reviews yet.</p>'}</div>
        </section>
        <section id="sec-about" class="mt48"><h3>About</h3><p class="mt12" style="max-width:680px">${esc(p.about)}</p>
          <div class="chips mt16">${p.amenities.map(a=>`<span class="badge b-plain" style="padding:6px 12px">${esc(a)}</span>`).join('')}</div>
          <div class="card mt24 row" style="gap:16px;align-items:flex-start">${ic('pin',20,'style="color:var(--rose);flex-shrink:0"')}<div><b>Address</b><p class="small muted mt8">${esc(p.address)}</p></div></div>
        </section>
      </div>
      <aside class="sticky col" style="gap:16px">
        <div class="card"><div class="eyebrow">Book an appointment</div>
          <p class="mt12 small muted">Next available</p><p class="serif" style="font-size:26px;font-weight:600">${na?na.label:'Fully booked this week'}</p>
          <button class="btn btn-p mt16" style="width:100%" data-a="book" data-pid="${p.id}">Book now</button>
          <p class="xs muted mt12">Deposits are simulated in this prototype. Free cancellation up to 24 hours before.</p></div>
        <div class="card"><div class="row" style="gap:8px">${ic('shield',18,'style="color:var(--sage-d)"')}<b>What we've verified</b></div>
          ${p.verification.map(v=>`<div class="verify">${ic('check',16)}<div><b>${esc(v.label)}</b><div class="xs muted">${esc(v.scope)} · checked ${esc(v.date)}</div></div></div>`).join('')}
          <p class="xs soft mt8">Verification confirms documents within the stated scope on the date checked. It doesn't guarantee outcomes or suitability for you.</p></div>
      </aside>
    </div></div>`;
};
const reviewHtml = r => `<div class="review"><div class="row between"><div class="row">${avatar(r.name,34)}<div><b class="small">${esc(r.name)}</b><div class="xs muted">${esc(r.service)}${r.staffId&&stf(r.staffId)?' · with '+esc(stf(r.staffId).name):''}</div></div></div><div class="col" style="align-items:flex-end;gap:0"><span class="stars">${'★'.repeat(r.rating)}<span style="color:#E6D6DB">${'★'.repeat(5-r.rating)}</span></span><span class="xs soft">${fmtDate(r.date)}</span></div></div><p class="small mt8">${esc(r.text)}</p></div>`;
A.jump = el => { const t = document.getElementById(el.dataset.to); if (t) window.scrollTo({top: t.getBoundingClientRect().top + scrollY - 90, behavior:'smooth'}); el.parentElement.querySelectorAll('button').forEach(b=>b.classList.toggle('on', b===el)); };

/* ---------- practitioner profile ---------- */
CV.practitioner = ({id}) => {
  const t = stf(id); if (!t) return CV.home(); const p = prov(t.providerId);
  const sv = svcsOf(p.id).filter(s => s.staff.includes(id)); const rv = S.reviews.filter(r=>r.staffId===id);
  return `<div class="page narrow">
    <button class="btn btn-g btn-s" data-a="go" data-v="provider" data-p='${JSON.stringify({id:p.id})}' style="margin-left:-10px">${ic('chevL',16)} ${esc(p.name)}</button>
    <div class="soft-card mt16 row wrap" style="gap:26px;align-items:center">${avatar(t.name,108,t.id)}
      <div class="grow"><span class="badge ${t.medical?'b-med':'b-beauty'}">${t.medical?ic('shield',12)+' Registered medical practitioner':ic('leaf',12)+' Certified professional · non-medical'}</span>
        <h1 class="mt12" style="font-size:clamp(32px,4vw,46px)">${esc(t.name)}</h1><p class="muted mt8">${esc(t.role)} · ${esc(p.name)}, ${esc(p.area)}</p>
        <div class="row wrap mt12 small" style="gap:14px">${rv.length?stars(rv.reduce((a,b)=>a+b.rating,0)/rv.length, rv.length):''}<span class="muted">${t.years} years' experience</span><span class="muted">Speaks ${t.langs.join(', ')}</span></div></div></div>
    <div class="grid g2 mt32">
      <div class="card"><h4>Qualifications</h4><div class="mt12">${t.quals.map(q=>`<div class="verify">${ic('check',16)}<span>${esc(q)}</span></div>`).join('')}</div></div>
      <div class="card"><h4>Verification scope</h4><div class="mt12">${t.medical?`<div class="verify">${ic('shield',16)}<div><b>Council registration checked</b><div class="xs muted">${esc(t.reg)}</div></div></div>`:`<div class="verify">${ic('shield',16)}<div><b>Certificates checked</b><div class="xs muted">Professional certificates as listed · non-medical scope</div></div></div>`}<p class="xs soft mt8">Checks confirm documents within this scope. They don't guarantee outcomes.</p></div></div>
    </div>
    <div class="card mt24"><h4>About</h4><p class="mt8">${esc(t.bio)}</p></div>
    <h3 class="mt48">Book with ${esc(t.name.split(' ').slice(0, t.name.startsWith('Dr')?2:1).join(' '))}</h3>
    ${sv.some(isMed)?`<div class="mt16">${MED_NOTE}</div>`:''}
    <div class="mt12">${sv.map(s=>`<div class="svc-row"><div class="col grow" style="gap:4px"><div class="row wrap" style="gap:8px"><b>${esc(s.name)}</b>${kindBadge(s)}</div><span class="xs soft">${s.dur} min</span></div><div class="row" style="gap:14px"><b>${inr(s.price)}</b><button class="btn btn-p btn-s" data-a="book" data-pid="${p.id}" data-sid="${s.id}" data-staff="${t.id}">Book</button></div></div>`).join('')}</div>
    ${rv.length?`<h3 class="mt48">Reviews</h3>${rv.map(reviewHtml).join('')}`:''}
  </div>`;
};

/* ---------- booking flow ---------- */
const STEPS = ['Service','Practitioner','Date & time','Your details','Deposit','Confirmed'];
A.book = el => {
  const sid = el.dataset.sid || null; const staff = el.dataset.staff || null;
  S.flow = {providerId: el.dataset.pid, serviceId: sid, staffId: staff || (sid && svc(sid).staff.length===1 ? svc(sid).staff[0] : null), date: null, time: null, assigned: null,
    step: sid ? (staff || svc(sid).staff.length===1 ? 3 : 2) : 1,
    details: {name: S.user.name, phone: S.user.phone, email: S.user.email, note: '', ack: false, ack2: false}, pay: 'upi'};
  go('book');
};
CV.book = () => {
  const F = S.flow; if (!F) return CV.home();
  const p = prov(F.providerId); const s = F.serviceId && svc(F.serviceId);
  const stepper = `<div class="steps">${STEPS.map((n,i)=>`<span class="st ${F.step===i+1?'on':F.step>i+1?'done':''}"><i>${F.step>i+1?'✓':i+1}</i>${n}</span>`).join('')}</div>`;
  let main = '';
  if (F.step===1){
    main = `<h2>Choose a service</h2>${svcsOf(p.id).some(isMed)?`<div class="mt16">${MED_NOTE}</div>`:''}<div class="col mt16" style="gap:10px">${svcsOf(p.id).map(x=>`<button class="opt ${F.serviceId===x.id?'on':''}" data-a="fSvc" data-id="${x.id}"><div class="col" style="gap:4px"><b>${esc(x.name)}</b><div class="row wrap" style="gap:8px">${kindBadge(x)}<span class="xs muted">${x.dur} min</span></div></div><b>${inr(x.price)}</b></button>`).join('')}</div>`;
  }
  if (F.step===2){
    main = `<h2>Choose a practitioner</h2><p class="muted mt8">${esc(s.name)} is offered by ${s.staff.length} team member${s.staff.length>1?'s':''}.</p><div class="col mt16" style="gap:10px">
      <button class="opt ${F.staffId==='any'?'on':''}" data-a="fStaff" data-id="any"><div class="row">${`<div class="avatar" style="width:46px;height:46px;background:var(--sage);color:var(--sage-d)">${ic('users',20)}</div>`}<div><b>Any available practitioner</b><div class="small muted">Most availability</div></div></div></button>
      ${s.staff.map(id=>{const t=stf(id); return `<button class="opt ${F.staffId===id?'on':''}" data-a="fStaff" data-id="${id}"><div class="row">${avatar(t.name,46,t.id)}<div><b>${esc(t.name)}</b><div class="small muted">${esc(t.role)} · ${t.quals[0]?esc(t.quals.slice(-1)[0]):''}</div></div></div><span class="badge ${t.medical?'b-med':'b-beauty'}">${t.medical?'Registered':'Certified'}</span></button>`}).join('')}</div>`;
  }
  if (F.step===3){
    const days = Array.from({length:14}, (_,i)=>addDays(TODAY(), i));
    if (!F.date){ F.date = days.find(d => serviceSlots(s.id, F.staffId, d).length) || days[0]; }
    const sl = serviceSlots(s.id, F.staffId, F.date);
    const parts = [['Morning',0,720],['Afternoon',720,1020],['Evening',1020,1440]];
    main = `<h2>Pick a date & time</h2><p class="muted mt8">${esc(s.name)} · ${s.dur} min · ${F.staffId==='any'?'any available practitioner':'with '+esc(stf(F.staffId).name)}</p>
      <div class="dates mt24">${days.map(d=>{ const n = serviceSlots(s.id,F.staffId,d).length; const dt = parse(d); return `<button class="date ${F.date===d?'on':''}" ${n?'':'disabled'} data-a="fDate" data-d="${d}"><span>${d===TODAY()?'Today':DOW[dt.getDay()]}</span><b>${dt.getDate()}</b><span>${MON[dt.getMonth()]}</span></button>`;}).join('')}</div>
      <p class="small mt16"><b>${fmtDate(F.date,true)}</b></p>
      ${sl.length? parts.map(([lbl,a,b])=>{ const xs = sl.filter(x=>toMin(x.t)>=a && toMin(x.t)<b); return xs.length?`<p class="xs muted mt16" style="text-transform:uppercase;letter-spacing:.1em;font-weight:700">${lbl}</p><div class="slots mt8">${xs.map(x=>`<button class="slot ${F.time===x.t?'on':''}" data-a="fTime" data-t="${x.t}" data-s="${x.staffId}">${fmtT(x.t)}</button>`).join('')}</div>`:''}).join('') : `<div class="note n-plain mt16">No times left on this day — try another date.</div>`}`;
  }
  if (F.step===4){
    const d = F.details;
    main = `<h2>Your details</h2><p class="muted mt8">We share these with ${esc(p.name)} to manage your appointment.</p>
      <form class="col mt24" style="gap:16px" data-sub="fDetails">
        <div class="grid g2"><label class="f">Full name<input class="in" name="name" required value="${esc(d.name)}" data-in="fd" data-k="name"></label><label class="f">Mobile number<input class="in" name="phone" required value="${esc(d.phone)}" data-in="fd" data-k="phone"></label></div>
        <label class="f">Email<input class="in" type="email" name="email" required value="${esc(d.email)}" data-in="fd" data-k="email"></label>
        <label class="f">Note for the provider <span class="hint">Optional — e.g. accessibility needs or a preference for a female practitioner. Please don't share medical history here; your practitioner will discuss it in person.</span><textarea class="in" maxlength="240" data-in="fd" data-k="note">${esc(d.note)}</textarea></label>
        ${isMed(s)?`${MED_NOTE}<label class="check"><input type="checkbox" required ${d.ack?'checked':''} data-ch="fAck" data-k="ack"> I understand this booking is for ${s.kind==='consult'?'a consultation':'an appointment'} with a registered practitioner, who will decide whether any treatment is suitable for me.</label>`:''}
        ${s.kind==='treatment'?`<label class="check"><input type="checkbox" required ${d.ack2?'checked':''} data-ch="fAck" data-k="ack2"> I've already been assessed by this provider for this treatment, or I understand I may be moved to a consultation first.</label>`:''}
        <div class="note n-plain">${ic('info',16)}<div>Cancellation policy: free cancellation or rescheduling up to 24 hours before. Within 24 hours the deposit is normally retained; you can request a refund review.</div></div>
        <div class="row between mt8"><button type="button" class="btn btn-o" data-a="fBack">Back</button><button class="btn btn-p" type="submit">Continue to ${s.deposit?'deposit':'confirm'}</button></div>
      </form>`;
  }
  if (F.step===5){
    main = `<h2>${s.deposit?'Secure with a deposit':'Confirm your booking'}</h2>
      <p class="muted mt8">${s.deposit?`Pay ${inr(s.deposit)} now. The remaining ${inr(s.price-s.deposit)} is paid at the venue.`:'No deposit is needed for this service.'}</p>
      ${s.deposit?`<div class="paybox mt24"><div class="row between"><b>Payment method</b><span class="badge b-warn">Simulated · test mode</span></div>
        <div class="grid g3 mt16">${[['upi','UPI','wallet'],['card','Card','card'],['venue','Pay deposit later','clock']].map(([k,l,i])=>`<button class="opt ${F.pay===k?'on':''}" style="justify-content:flex-start" data-a="fPay" data-k="${k}">${ic(i,18)} <b class="small">${l}</b></button>`).join('')}</div>
        ${F.pay==='upi'?`<p class="small muted mt16">In the live product you'd approve the request in your UPI app. Here, pressing pay simulates approval.</p><div class="in mt8" style="background:var(--porcelain);color:var(--muted)">ananya@okdemo (sample UPI ID)</div>`:''}
        ${F.pay==='card'?`<p class="small muted mt16">Card entry is disabled in this prototype — no card details are collected.</p><div class="grid g2 mt8"><div class="in" style="background:var(--porcelain);color:var(--soft)">•••• •••• •••• 4242 (test)</div><div class="in" style="background:var(--porcelain);color:var(--soft)">12/29 · •••</div></div>`:''}
        ${F.pay==='venue'?`<p class="small muted mt16">The venue will hold your slot for 2 hours while you pay the deposit by link (simulated).</p>`:''}
      </div>`:''}
      <div class="row between mt24"><button class="btn btn-o" data-a="fBack">Back</button><button class="btn btn-p" data-a="fConfirm" id="paybtn">${s.deposit?`Pay ${inr(s.deposit)} & confirm`:'Confirm booking'}</button></div>`;
  }
  if (F.step===6){
    const b = S.bookings.find(x=>x.id===F.bookingId); if (!b) return CV.home();
    return `<div class="page narrow"><div class="confirm-hero"><div class="seal">${ic('check',40)}</div><div class="eyebrow">Booking confirmed · ${b.ref}</div><h1 class="mt12" style="font-size:clamp(34px,5vw,52px)">See you ${b.date===TODAY()?'today':'on '+fmtDate(b.date)}.</h1><p class="muted mt12">A confirmation would be sent to ${esc(b.email||S.user.email)} and by SMS (simulated).</p></div>
      <div class="card">${bookingSummary(b)}</div>
      ${isMed(svc(b.serviceId)||b)?`<div class="mt16">${MED_NOTE}</div>`:''}
      <div class="row wrap mt24" style="justify-content:center"><button class="btn btn-p" data-a="go" data-v="bookings">View my bookings</button><button class="btn btn-o" data-a="go" data-v="results">Keep exploring</button></div></div>`;
  }
  return `<div class="page"><button class="btn btn-g btn-s" data-a="go" data-v="provider" data-p='${JSON.stringify({id:p.id})}' style="margin-left:-10px">${ic('chevL',16)} ${esc(p.name)}</button>
    <div class="mt16">${stepper}</div><div class="flow"><div>${main}
    ${F.step<4?`<div class="row between mt32">${F.step>1?'<button class="btn btn-o" data-a="fBack">Back</button>':'<span></span>'}<button class="btn btn-p" data-a="fNext" ${(F.step===1&&!F.serviceId)||(F.step===2&&!F.staffId)||(F.step===3&&!F.time)?'disabled':''}>Continue</button></div>`:''}</div>
    <aside class="sticky">${flowSummary()}</aside></div></div>`;
};
function flowSummary(){
  const F = S.flow; const p = prov(F.providerId); const s = F.serviceId && svc(F.serviceId);
  const who = F.assigned ? stf(F.assigned) : (F.staffId && F.staffId!=='any' ? stf(F.staffId) : null);
  return `<div class="card summary">${artBox(p.id,p.art,'','aspect-ratio:16/8;border-radius:10px;margin:-6px -6px 14px')}<b class="serif" style="font-size:22px">${esc(p.name)}</b><div class="xs muted">${esc(p.area)}, Thiruvananthapuram</div>
    <div class="divider"></div>
    ${s?`<div class="line"><span>${esc(s.name)}<div class="xs muted">${s.dur} min${who?' · '+esc(who.name):F.staffId==='any'?' · any practitioner':''}</div></span><b>${inr(s.price)}</b></div>${F.date&&F.time?`<div class="line small muted"><span>${ic('cal',14)} ${fmtDate(F.date,true)}</span><span>${fmtT(F.time)}</span></div>`:''}
    <div class="line tot"><span>Due now (deposit)</span><span>${inr(s.deposit)}</span></div><div class="line small muted"><span>Pay at venue</span><span>${inr(s.price-s.deposit)}</span></div>
    <div class="mt8">${kindBadge(s)}</div>`:'<p class="small muted">Select a service to see pricing.</p>'}</div>`;
}
A.fSvc = el => { const s = svc(el.dataset.id); Object.assign(S.flow, {serviceId: s.id, staffId: s.staff.length===1? s.staff[0] : null, date:null, time:null}); save(); render(); };
A.fStaff = el => { Object.assign(S.flow, {staffId: el.dataset.id, date:null, time:null}); save(); render(); };
A.fDate = el => { Object.assign(S.flow, {date: el.dataset.d, time:null, assigned:null}); save(); render(); };
A.fTime = el => { Object.assign(S.flow, {time: el.dataset.t, assigned: el.dataset.s}); save(); render(); };
A.fNext = () => { const F = S.flow; if (F.step===1 && svc(F.serviceId).staff.length===1){ F.staffId = svc(F.serviceId).staff[0]; F.step = 3; } else F.step++; save(); render(); window.scrollTo(0,0); };
A.fBack = () => { const F = S.flow; F.step--; if (F.step===2 && F.serviceId && svc(F.serviceId).staff.length===1) F.step = 1; save(); render(); window.scrollTo(0,0); };
A.fd = el => { S.flow.details[el.dataset.k] = el.value; save(); };
A.fAck = el => { S.flow.details[el.dataset.k] = el.checked; save(); };
A.fDetails = f => { if (!f.reportValidity()) return; S.flow.step = 5; save(); render(); window.scrollTo(0,0); };
A.fPay = el => { S.flow.pay = el.dataset.k; save(); render(); };
A.fConfirm = el => {
  const F = S.flow; const s = svc(F.serviceId);
  el.disabled = true; el.innerHTML = 'Processing…';
  setTimeout(() => {
    if (overlaps(S.bookings, F.assigned, F.date, toMin(F.time), s.dur)){ toast('That time was just taken — please choose another'); F.step = 3; F.time = null; save(); render(); return; }
    const d = F.details; const c = ensureClient(F.providerId, d.name, d.phone, d.email);
    const b = mkBooking({providerId:F.providerId, serviceId:s.id, staffId:F.assigned, date:F.date, time:F.time, clientId:c.id, clientName:d.name, email:d.email, phone:d.phone, source:'marketplace', status:'confirmed', mine:true, created:TODAY(), note:d.note, payMethod: s.deposit?F.pay:'none'});
    if (F.pay==='venue' && s.deposit) b.paid = 0;
    b.history.push({at: new Date().toISOString(), text:'Booked via AESTHEVA marketplace'});
    S.bookings.push(b); F.step = 6; F.bookingId = b.id; save(); render(); window.scrollTo(0,0);
  }, 900);
};
function bookingSummary(b){
  const p = prov(b.providerId), t = stf(b.staffId);
  return `<div class="row" style="gap:16px;align-items:flex-start">${artBox(p.id,p.art,'','width:84px;height:84px;border-radius:12px;flex-shrink:0')}
    <div class="grow col" style="gap:4px"><b class="serif" style="font-size:22px">${esc(b.serviceName)}</b><span class="small muted">${esc(p.name)} · ${esc(p.area)}</span><span class="small">${ic('cal',14)} ${fmtDate(b.date,true)} · ${fmtT(b.time)} · ${b.dur} min</span><span class="small">${ic('user',14)} ${t?esc(t.name)+', '+esc(t.role):''}</span></div></div>
    <div class="divider"></div>
    <div class="summary"><div class="line"><span>Service price</span><span>${inr(b.price)}</span></div><div class="line"><span>Deposit ${b.paid?'paid (simulated)':'due'}</span><span>${inr(b.deposit)}</span></div><div class="line tot"><span>Pay at venue</span><span>${inr(b.price-b.paid)}</span></div></div>`;
}

/* ---------- my bookings ---------- */
CV.bookings = ({tab}) => {
  tab = tab || 'upcoming';
  const mine = S.bookings.filter(b => b.mine);
  const up = mine.filter(b => ['confirmed','arrived'].includes(b.status) && b.date >= TODAY()).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  const past = mine.filter(b => b.status!=='cancelled' && !up.includes(b)).sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time));
  const canc = mine.filter(b => b.status==='cancelled');
  const list = {upcoming:up, past, cancelled:canc}[tab];
  return `<div class="page narrow"><div class="eyebrow">Signed in as ${esc(S.user.name)} (demo)</div><h2 class="mt8">My bookings</h2>
    <div class="tabs mt24">${[['upcoming','Upcoming',up.length],['past','Past',past.length],['cancelled','Cancelled',canc.length]].map(([k,l,n])=>`<button class="${tab===k?'on':''}" ${goAttr('bookings',{tab:k})}>${l} (${n})</button>`).join('')}</div>
    ${list.length?`<div class="col" style="gap:14px">${list.map(b=>bookingCard(b,tab)).join('')}</div>`:`<div class="card" style="text-align:center;padding:44px"><h3>Nothing here yet</h3><p class="muted mt8">${tab==='upcoming'?'Find a treatment and book in a few steps.':''}</p><button class="btn btn-p mt16" data-a="go" data-v="results">Explore treatments</button></div>`}
  </div>`;
};
function bookingCard(b, tab){
  const p = prov(b.providerId); const t = stf(b.staffId); const d = parse(b.date);
  const reviewed = S.reviews.some(r => r.bookingId===b.id);
  return `<div class="bk">${artBox(p.id,p.art)}
    <div class="row" style="gap:18px;align-items:flex-start"><div class="datebox"><div class="xs muted" style="text-transform:uppercase;font-weight:700;letter-spacing:.1em">${DOW[d.getDay()]}</div><div class="serif" style="font-size:34px;font-weight:600;line-height:1">${d.getDate()}</div><div class="xs muted">${MON[d.getMonth()]} · ${fmtT(b.time)}</div></div>
      <div class="col" style="gap:3px"><div class="row wrap" style="gap:8px"><b style="font-size:16px">${esc(b.serviceName)}</b>${statusBadge(b.status)}</div><span class="small muted">${esc(p.name)} · ${esc(p.area)}</span><span class="small muted">with ${t?esc(t.name):'—'} · ${b.dur} min · Ref ${b.ref}</span>
      <span class="xs" style="margin-top:4px">${b.status==='cancelled'?(b.refund?`<span class="badge ${b.refund.status==='refunded'?'b-ok':b.refund.status==='declined'?'b-err':'b-warn'}">Deposit ${b.refund.status==='refunded'?'refunded':b.refund.status==='declined'?'retained':'refund under review'} · ${inr(b.deposit)}</span>`:''):`Deposit ${b.paid?'paid':'due'}: ${inr(b.deposit)} · Balance ${inr(b.price-b.paid)}`}</span></div></div>
    <div class="row wrap" style="gap:8px;justify-content:flex-end">
      ${tab==='upcoming'?`<button class="btn btn-o btn-s" data-a="resched" data-id="${b.id}">Reschedule</button><button class="btn btn-d btn-s" data-a="cancelBk" data-id="${b.id}">Cancel</button>`:''}
      ${tab==='past'&&b.status==='completed'&&!reviewed?`<button class="btn btn-o btn-s" data-a="review" data-id="${b.id}">Leave a review</button>`:''}
      ${tab!=='upcoming'?`<button class="btn btn-p btn-s" data-a="book" data-pid="${b.providerId}" data-sid="${b.serviceId}">Book again</button>`:''}
    </div></div>`;
}
A.resched = el => { const b = S.bookings.find(x=>x.id===el.dataset.id); S.ui.rs = {id:b.id, date: b.date, time:null, staffId:b.staffId}; reschedModal(); };
function reschedModal(){
  const R = S.ui.rs; const b = S.bookings.find(x=>x.id===R.id); const days = Array.from({length:14},(_,i)=>addDays(TODAY(),i));
  const sl = staffSlots(b.staffId, R.date, b.dur, b.id);
  modal('Reschedule appointment', `<p class="small muted">${esc(b.serviceName)} with ${esc(stf(b.staffId).name)} · currently ${fmtDate(b.date)}, ${fmtT(b.time)}</p>
    <div class="dates mt16">${days.map(d=>{ const n = staffSlots(b.staffId,d,b.dur,b.id).length; const dt=parse(d); return `<button class="date ${R.date===d?'on':''}" ${n?'':'disabled'} data-a="rsDate" data-d="${d}"><span>${d===TODAY()?'Today':DOW[dt.getDay()]}</span><b>${dt.getDate()}</b><span>${MON[dt.getMonth()]}</span></button>`;}).join('')}</div>
    <div class="slots mt16">${sl.length?sl.map(t=>`<button class="slot ${R.time===t?'on':''}" data-a="rsTime" data-t="${t}">${fmtT(t)}</button>`).join(''):'<p class="small muted">No times on this day.</p>'}</div>
    <p class="xs muted mt16">Free to reschedule more than 24 hours before. Your deposit carries over.</p>`,
    `<button class="btn btn-o" data-a="closeModal">Keep current time</button><button class="btn btn-p" data-a="rsSave" ${R.time?'':'disabled'}>Confirm new time</button>`, {eyebrow:'My bookings'});
}
A.rsDate = el => { S.ui.rs.date = el.dataset.d; S.ui.rs.time = null; reschedModal(); };
A.rsTime = el => { S.ui.rs.time = el.dataset.t; reschedModal(); };
A.rsSave = () => { const R = S.ui.rs; const b = S.bookings.find(x=>x.id===R.id); b.history.push({at:new Date().toISOString(), text:`Rescheduled by client from ${fmtDate(b.date)} ${fmtT(b.time)}`}); b.date = R.date; b.time = R.time; S.ui.rs = null; save(); closeModal(); render(); toast(`Moved to ${fmtDate(b.date)}, ${fmtT(b.time)}`); };
const hoursUntil = b => (new Date(parse(b.date).getTime() + toMin(b.time)*6e4) - new Date())/36e5;
A.cancelBk = el => {
  const b = S.bookings.find(x=>x.id===el.dataset.id); const h = hoursUntil(b); const free = h >= 24;
  modal('Cancel this booking?', `<p>${esc(b.serviceName)} · ${fmtDate(b.date)}, ${fmtT(b.time)} at ${esc(prov(b.providerId).name)}</p>
    <div class="note ${free?'n-sage':'n-warn'} mt16">${ic('info',16)}<div>${!b.paid?'No deposit has been paid for this booking.':free?`You're more than 24 hours ahead, so your <b>${inr(b.deposit)}</b> deposit will be refunded in full (simulated).`:`This is within 24 hours (${Math.max(0,Math.round(h))}h to go). The ${inr(b.deposit)} deposit is normally retained, but you can ask us to review it.`}</div></div>
    ${!free&&b.paid?`<label class="check mt16"><input type="checkbox" id="rq" checked> Request a refund review</label><label class="f mt12">Reason <span class="hint">Brief, non-medical detail is enough</span><textarea class="in" id="rqr" maxlength="200">Unexpected work commitment</textarea></label>`:''}`,
    `<button class="btn btn-o" data-a="closeModal">Keep booking</button><button class="btn btn-d" data-a="doCancel" data-id="${b.id}">Cancel booking</button>`);
};
A.doCancel = el => {
  const b = S.bookings.find(x=>x.id===el.dataset.id); const free = hoursUntil(b) >= 24;
  b.status = 'cancelled'; b.history.push({at:new Date().toISOString(), text:'Cancelled by client'});
  if (b.paid){
    if (free){ b.refund = {status:'refunded', amount:b.deposit}; toast('Booking cancelled · deposit refunded (simulated)'); }
    else if ($('#rq') && $('#rq').checked){ const t = {id:'T-'+(1044+S.tickets.length), type:'refund', status:'open', created:TODAY(), providerId:b.providerId, customer:b.clientName, amount:b.deposit, service:b.serviceName, bookingId:b.id, reason:'Late cancellation: '+($('#rqr').value||'No reason given'), notes:[]}; S.tickets.unshift(t); b.refund = {status:'review', amount:b.deposit, ticket:t.id}; toast(`Cancelled · refund review ${t.id} opened`); }
    else { b.refund = {status:'declined', amount:b.deposit}; toast('Booking cancelled'); }
  } else toast('Booking cancelled');
  save(); closeModal(); render();
};
A.review = el => { S.ui.rv = {id: el.dataset.id, rating: 5}; reviewModal(); };
function reviewModal(){
  const b = S.bookings.find(x=>x.id===S.ui.rv.id);
  modal('Review your visit', `<p class="small muted">${esc(b.serviceName)} at ${esc(prov(b.providerId).name)}</p>
    <div class="row mt16" style="gap:4px">${[1,2,3,4,5].map(n=>`<button class="btn btn-g" style="font-size:28px;padding:2px 6px;color:${n<=S.ui.rv.rating?'var(--mulberry)':'#E6D6DB'}" data-a="rvStar" data-n="${n}" aria-label="${n} stars">★</button>`).join('')}</div>
    <label class="f mt16">Your experience <span class="hint">Describe the service and environment. Please avoid personal medical details.</span><textarea class="in" id="rvt" maxlength="300" placeholder="What stood out?">${esc(S.ui.rv.text||'')}</textarea></label>`,
    `<button class="btn btn-o" data-a="closeModal">Not now</button><button class="btn btn-p" data-a="rvSave">Publish review</button>`);
}
A.rvStar = el => { S.ui.rv.text = $('#rvt').value; S.ui.rv.rating = +el.dataset.n; reviewModal(); };
A.rvSave = () => { const b = S.bookings.find(x=>x.id===S.ui.rv.id); const txt = $('#rvt').value.trim() || 'Lovely experience.'; S.reviews.push({providerId:b.providerId, staffId:b.staffId, bookingId:b.id, name: S.user.name.split(' ')[0]+' '+S.user.name.split(' ')[1][0]+'.', rating:S.ui.rv.rating, date:TODAY(), service:b.serviceName, text:txt}); save(); closeModal(); render(); toast('Thanks — your review is live'); };

/* ---------- favourites ---------- */
CV.favs = () => {
  const ps = S.favourites.map(prov).filter(Boolean);
  return `<div class="page"><div class="eyebrow">Saved</div><h2 class="mt8">Favourites</h2>
    ${ps.length?`<div class="grid g4 pgrid mt24">${ps.map(p=>providerCard(p)).join('')}</div>`:`<div class="card mt24" style="text-align:center;padding:48px"><h3>No favourites yet</h3><p class="muted mt8">Tap the heart on any venue to save it here.</p><button class="btn btn-p mt16" data-a="go" data-v="results">Explore</button></div>`}</div>`;
};
