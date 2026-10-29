/* AESTHEVA prototype — core state, helpers and shell */
const D = window.AE_DATA;
const KEY = 'aestheva.demo.v3';
const DEMO_PROVIDER = 'p1';           // the clinic signed in to the practitioner workspace
const COMMISSION = 0.10;              // platform commission on marketplace bookings (sample)
const A = {};                         // action handlers
let S;                                // app state
let MEM = null;                       // in-memory fallback when storage is unavailable

/* ---------- utilities ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');
const pad = n => String(n).padStart(2,'0');
const iso = d => d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parse = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate()+n); return iso(d); };
const TODAY = () => iso(new Date());
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtDate = (s, long) => { const d = parse(s); return long ? `${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}` : `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`; };
const toMin = t => { const [h,m] = t.split(':').map(Number); return h*60+m; };
const toT = m => pad(Math.floor(m/60))+':'+pad(m%60);
const fmtT = t => { let [h,m] = t.split(':').map(Number); const ap = h>=12?'pm':'am'; h = h%12||12; return `${h}:${pad(m)} ${ap}`; };
const nowMin = () => { const d = new Date(); return d.getHours()*60+d.getMinutes(); };
const dayDiff = (a,b) => Math.round((parse(b)-parse(a))/864e5);
function hash(s){ let h = 2166136261; for (let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619);} return h>>>0; }
function rng(seed){ let a = seed>>>0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a>>>15, 1|a); t = t + Math.imul(t ^ t>>>7, 61|t) ^ t; return ((t ^ t>>>14)>>>0)/4294967296; }; }
const uid = p => p + Math.random().toString(36).slice(2,8).toUpperCase();
const clone = o => JSON.parse(JSON.stringify(o));

/* ---------- lookups ---------- */
const prov = id => S.providers.find(p => p.id===id);
const svc = id => S.services.find(s => s.id===id);
const stf = id => S.staff.find(s => s.id===id);
const cat = id => D.CATEGORIES.find(c => c.id===id) || {name:id};
const svcsOf = pid => S.services.filter(s => s.providerId===pid && s.active!==false);
const staffOf = pid => S.staff.filter(s => s.providerId===pid);
const reviewsOf = pid => S.reviews.filter(r => r.providerId===pid);
const rating = pid => { const r = reviewsOf(pid); return r.length ? (r.reduce((a,b)=>a+b.rating,0)/r.length) : 0; };
const isMed = s => s.kind==='consult' || s.kind==='treatment';
const clientOf = id => S.clients.find(c => c.id===id);

/* ---------- seed ---------- */
function seed(){
  const r = rng(20261028);
  const pick = a => a[Math.floor(r()*a.length)];
  const st = {
    v: 3, seeded: TODAY(), mode: 'consumer',
    route: {consumer:{v:'home',p:{}}, practitioner:{v:'dash',p:{}}, admin:{v:'apps',p:{}}},
    providers: clone(D.providers), staff: clone(D.staff), services: clone(D.services).map(s=>({...s, active:true})),
    reviews: clone(D.reviews), applications: clone(D.applications), tickets: clone(D.tickets), cities: clone(D.cities),
    bookings: [], clients: [], favourites: ['p3','p2'],
    user: {name:'Ananya Krishnan', phone:'+91 90000 00001', email:'ananya.demo@example.com'},
    search: {q:'', area:'', cats:[], types:[], kind:'all', max:16000, avail:'any', rating:false, sort:'rec'},
    flow: null, onboarding: null, ui: {}
  };
  S = st;
  // clients per provider
  D.providers.forEach(p => {
    const n = p.id===DEMO_PROVIDER ? 26 : 12;
    const names = [...D.CLIENT_NAMES].sort(()=>r()-.5).slice(0,n);
    names.forEach((nm,i) => st.clients.push({
      id: p.id+'-c'+i, providerId: p.id, name: nm,
      phone: '+91 9' + String(Math.floor(r()*1e9)).padStart(9,'0').replace(/^(\d{4})\d{3}/, '$1XXX'),
      email: nm.toLowerCase().replace(/[^a-z]+/g,'.') + '@example.com',
      since: addDays(TODAY(), -Math.floor(r()*240)-2), tags: r()<.3?['VIP']:(r()<.3?['Prefers female practitioner']:[]),
      optIn: r()<.6, notes: ''
    }));
  });
  // bookings
  const base = TODAY();
  D.providers.forEach(p => {
    const n = p.id===DEMO_PROVIDER ? 230 : 44;
    const pc = st.clients.filter(c => c.providerId===p.id);
    const ps = st.services.filter(s => s.providerId===p.id);
    for (let i=0;i<n;i++){
      const day = Math.floor(r()*44) - 30;
      const date = addDays(base, day);
      const sv = pick(ps); const sid = pick(sv.staff); const sf = st.staff.find(x=>x.id===sid);
      if (!sf.avail.days.includes(parse(date).getDay())) continue;
      const s0 = toMin(sf.avail.start), e0 = toMin(sf.avail.end);
      const t = s0 + Math.floor(r()*((e0-s0-sv.dur)/30+1))*30;
      if (t+sv.dur > e0) continue;
      if (overlaps(st.bookings, sid, date, t, sv.dur)) continue;
      const cl = pick(pc);
      let status = 'confirmed';
      if (day<0) status = r()<.86?'completed':(r()<.5?'no-show':'cancelled');
      if (day===0 && t+sv.dur < nowMin()) status = 'completed';
      st.bookings.push(mkBooking({providerId:p.id, serviceId:sv.id, staffId:sid, date, time:toT(t), clientId:cl.id, clientName:cl.name, source: r()<.62?'marketplace':'direct', status, created: addDays(date, -Math.floor(r()*10)-1)}, st));
    }
  });
  // the demo consumer's own bookings
  const me = (pid, sid, staffId, d, t, status) => {
    const c = ensureClient(pid, st.user.name, st.user.phone, st.user.email, st);
    const date = nextWorkingDate(staffId, addDays(base, d), st);
    if (overlaps(st.bookings, staffId, date, toMin(t), svc2(st,sid).dur)) st.bookings = st.bookings.filter(b=>!(b.staffId===staffId && b.date===date));
    st.bookings.push(mkBooking({providerId:pid, serviceId:sid, staffId, date, time:t, clientId:c.id, clientName:c.name, source:'marketplace', status, mine:true, created:addDays(date,-5)}, st));
  };
  me('p3','v11','s7', 3, '11:00', 'confirmed');
  me('p1','v1','s1', 9, '15:30', 'confirmed');
  me('p6','v23','s13', -12, '17:00', 'completed');
  me('p2','v7','s6', -26, '10:00', 'completed');
  st.bookings.sort((a,b)=> (a.date+a.time).localeCompare(b.date+b.time));
  return st;
}
const svc2 = (st,id) => st.services.find(s=>s.id===id);
function nextWorkingDate(staffId, date, st){ const sf = (st||S).staff.find(x=>x.id===staffId); let d = date; for (let i=0;i<7;i++){ if (sf.avail.days.includes(parse(d).getDay())) return d; d = addDays(d,1);} return date; }
function overlaps(list, staffId, date, t, dur, ignore){
  return list.some(b => b.staffId===staffId && b.date===date && b.id!==ignore && !['cancelled','no-show'].includes(b.status) && t < toMin(b.time)+b.dur && toMin(b.time) < t+dur);
}
function mkBooking(o, st){
  st = st || S; const sv = st.services.find(s=>s.id===o.serviceId);
  return Object.assign({id: uid('B'), ref: 'AE-' + (10000 + Math.floor(Math.random()*89999)), dur: sv.dur, price: sv.price, deposit: sv.deposit, kind: sv.kind,
    serviceName: sv.name, paid: o.status==='completed' ? sv.price : sv.deposit, refund: null, history: [], notes: ''}, o);
}
function ensureClient(pid, name, phone, email, st){
  st = st || S;
  let c = st.clients.find(c => c.providerId===pid && (c.phone===phone || c.name.toLowerCase()===String(name).toLowerCase()));
  if (!c){ c = {id: pid+'-c'+uid(''), providerId: pid, name, phone: phone||'—', email: email||'', since: TODAY(), tags: ['New via marketplace'], optIn: false, notes: ''}; st.clients.push(c); }
  return c;
}

/* ---------- persistence ---------- */
function load(){
  try { const raw = localStorage.getItem(KEY); if (raw){ const o = JSON.parse(raw); if (o && o.v===3 && dayDiff(o.seeded, TODAY()) < 21) return o; } } catch(e){}
  return MEM || null;
}
function save(){ try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(e){ MEM = S; } }
function resetDemo(){ try { localStorage.removeItem(KEY); } catch(e){} MEM = null; S = seed(); save(); render(); toast('Demo data reset'); }

/* ---------- availability ---------- */
function staffSlots(staffId, date, dur, ignore){
  const sf = stf(staffId); if (!sf) return [];
  const dow = parse(date).getDay();
  if (!sf.avail.days.includes(dow)) return [];
  const s0 = toMin(sf.avail.start), e0 = toMin(sf.avail.end), out = [];
  const isToday = date===TODAY(); const cut = nowMin()+45;
  if (date < TODAY()) return [];
  for (let t=s0; t+dur<=e0; t+=30){
    if (isToday && t < cut) continue;
    if (overlaps(S.bookings, staffId, date, t, dur, ignore)) continue;
    if (hash(staffId+date+t) % 6 === 0) continue;  // simulated blocks (breaks, offline bookings)
    out.push(toT(t));
  }
  return out;
}
function serviceSlots(serviceId, staffChoice, date, ignore){
  const sv = svc(serviceId); const ids = staffChoice && staffChoice!=='any' ? [staffChoice] : sv.staff;
  const map = {};
  ids.forEach(id => staffSlots(id, date, sv.dur, ignore).forEach(t => { if (!map[t]) map[t] = id; }));
  return Object.keys(map).sort().map(t => ({t, staffId: map[t]}));
}
function nextAvailable(pid, filterSvcs){
  const list = filterSvcs && filterSvcs.length ? filterSvcs : svcsOf(pid);
  for (let i=0;i<10;i++){
    const d = addDays(TODAY(), i); let best = null;
    list.forEach(sv => { const s = serviceSlots(sv.id,'any',d); if (s.length && (!best || s[0].t < best)) best = s[0].t; });
    if (best) return {date:d, t:best, label: (i===0?'Today':i===1?'Tomorrow':fmtDate(d)) + ', ' + fmtT(best)};
  }
  return null;
}
function availOn(pid, which, list){
  if (which==='any') return true;
  let days = [];
  if (which==='today') days = [TODAY()];
  if (which==='tomorrow') days = [addDays(TODAY(),1)];
  if (which==='weekend'){ for (let i=0;i<7;i++){ const d = addDays(TODAY(),i); const w = parse(d).getDay(); if (w===0||w===6) days.push(d);} }
  if (which==='week'){ for (let i=0;i<7;i++) days.push(addDays(TODAY(),i)); }
  return days.some(d => (list.length?list:svcsOf(pid)).some(sv => serviceSlots(sv.id,'any',d).length));
}

/* ---------- visuals ---------- */
const PAL = [
  ['#F3E5E8','#E8CDD4','#C58F9D','#713F54'], ['#E5EBE5','#CBD8CC','#93A898','#4C6352'],
  ['#F7EEE8','#ECD8CB','#C9A08B','#7A4E3E'], ['#F1E9EF','#DFCCDC','#AC8EA9','#5E3F5C'],
  ['#FBF2F1','#F2D6D5','#D99C9E','#8B4A55'], ['#E7EEEA','#CFDDD5','#91B1A2','#3F5E54'],
  ['#F5F1EB','#E5DCCF','#BBA98F','#6B5A45'], ['#EFE7E4','#D8C8C2','#A0867F','#4A3A37']];
function art(seed, idx){
  const r = rng(hash(String(seed)));
  const p = PAL[(idx ?? Math.floor(r()*PAL.length)) % PAL.length];
  const sx = 60 + r()*280, sy = 40 + r()*80, sr = 50 + r()*50;
  const ax = 120 + r()*160, aw = 110 + r()*40;
  const leaf = (x,y,rot,s,c,o) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" opacity="${o}"><path d="M0 0 C 28 -40 28 -100 0 -150 C -28 -100 -28 -40 0 0Z" fill="${c}"/><path d="M0 -4 L0 -146" stroke="${p[0]}" stroke-width="1.4" opacity=".55"/>${[30,60,90,115].map(k=>`<path d="M0 -${k} l14 -16 M0 -${k} l-14 -16" stroke="${p[0]}" stroke-width="1" opacity=".45"/>`).join('')}</g>`;
  const lotus = (x,y,s) => `<g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="${p[3]}" stroke-width="1.6" opacity=".55"><path d="M0 0 C -10 -18 -10 -34 0 -48 C 10 -34 10 -18 0 0Z"/><path d="M0 0 C -22 -8 -32 -24 -32 -38 C -16 -34 -6 -20 0 0Z"/><path d="M0 0 C 22 -8 32 -24 32 -38 C 16 -34 6 -20 0 0Z"/></g>`;
  return `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="400" height="300" fill="${p[0]}"/>
    <circle cx="${sx}" cy="${sy}" r="${sr}" fill="${p[1]}" opacity=".9"/>
    <path d="M${ax-aw/2} 300 V${170} A${aw/2} ${aw/2} 0 0 1 ${ax+aw/2} 170 V300Z" fill="${p[1]}"/>
    <path d="M${ax-aw/2+14} 300 V${176} A${aw/2-14} ${aw/2-14} 0 0 1 ${ax+aw/2-14} 176 V300Z" fill="none" stroke="${p[2]}" stroke-width="1.2" opacity=".7"/>
    ${leaf(30+r()*60, 320, -25+r()*20, .9+r()*.5, p[2], .55)}
    ${leaf(330+r()*50, 330, 15+r()*20, 1+r()*.5, p[3], .35)}
    ${leaf(260+r()*40, 320, -8, .7, p[2], .4)}
    ${lotus(ax, 262, 1.1)}
    <rect y="286" width="400" height="5" fill="#B99657" opacity=".55"/><rect y="294" width="400" height="2" fill="#B99657" opacity=".45"/>
  </svg>`;
}
const artBox = (seed, idx, cls='', style='') => `<div class="art ${cls}" style="${style}">${art(seed, idx)}</div>`;
function avatar(name, size=44, seed){
  const p = PAL[hash(seed||name)%PAL.length];
  const ini = name.replace(/^Dr\.\s*/,'').split(/\s+/).map(w=>w[0]).slice(0,2).join('');
  return `<div class="avatar" style="width:${size}px;height:${size}px;background:${p[0]};color:${p[3]};font-size:${size*.4}px;border:1px solid ${p[1]}">${esc(ini)}</div>`;
}
const ICONS = {
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', pin:'<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  heart:'<path d="M12 20s-7.5-4.6-9.2-9.4C1.6 7.2 4 4 7.2 4c2 0 3.4 1.1 4.8 2.8C13.4 5.1 14.8 4 16.8 4 20 4 22.4 7.2 21.2 10.6 19.5 15.4 12 20 12 20z"/>',
  star:'<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>', check:'<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  shield:'<path d="M12 3 4.5 6v6c0 4.5 3.2 7.9 7.5 9 4.3-1.1 7.5-4.5 7.5-9V6z"/><path d="m8.8 12 2.2 2.2 4.2-4.4"/>', info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.6v.1"/>',
  cal:'<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>', clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4.5 20c1.2-3.8 4-5.5 7.5-5.5s6.3 1.7 7.5 5.5"/>', users:'<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 19.5c.9-3.2 3.4-4.8 6.5-4.8s5.6 1.6 6.5 4.8"/><path d="M15.5 5.3a3.5 3.5 0 0 1 0 6.4M17.5 14.9c2 .6 3.4 2.1 4 4.6"/>',
  home:'<path d="M4 11 12 4l8 7v9h-5.5v-6h-5v6H4z"/>', grid:'<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  list:'<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>', edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  wallet:'<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18M16 14.5h2"/>', doc:'<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  inbox:'<path d="M4 13 6.5 5h11L20 13v6H4z"/><path d="M4 13h4.5l1 2.5h5l1-2.5H20"/>', chart:'<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
  map:'<path d="m9 4-5.5 2v14L9 18l6 2 5.5-2V4L15 6z"/><path d="M9 4v14M15 6v14"/>', alert:'<path d="M12 3 2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.1"/>',
  x:'<path d="M6 6l12 12M18 6 6 18"/>', chevL:'<path d="m15 5-7 7 7 7"/>', chevR:'<path d="m9 5 7 7-7 7"/>', plus:'<path d="M12 5v14M5 12h14"/>',
  filter:'<path d="M4 6h16M7 12h10M10 18h4"/>', leaf:'<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19 13 11"/>', sparkle:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  upload:'<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/>', card:'<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3 10h18"/>', refresh:'<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4"/>',
  out:'<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>', settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>'
};
const ic = (n, s=18, extra='') => `<svg ${extra} width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ${extra}>${ICONS[n]||''}</svg>`;
const stars = (v, n) => `<span class="stars">${ic('star',14,'fill="currentColor"')} ${v.toFixed(1)}${n!=null?` <span class="muted" style="font-weight:500">(${n})</span>`:''}</span>`;
const kindBadge = s => s.kind==='beauty' ? `<span class="badge b-beauty">${ic('leaf',12)} Beauty & wellness</span>` : s.kind==='consult' ? `<span class="badge b-med">${ic('shield',12)} Medical consultation</span>` : `<span class="badge b-med">${ic('shield',12)} Medical · prior assessment required</span>`;
const statusBadge = st => ({confirmed:'<span class="badge b-blush">Confirmed</span>', arrived:'<span class="badge b-warn">Arrived</span>', completed:'<span class="badge b-ok">Completed</span>', 'no-show':'<span class="badge b-err">No-show</span>', cancelled:'<span class="badge b-plain">Cancelled</span>'}[st] || st);
const MED_NOTE = `<div class="note n-med">${ic('info',16)}<div><b>Medical services:</b> booking reserves time with a registered practitioner. Your suitability for any treatment is decided at assessment — a booking doesn't imply a treatment is right for you.</div></div>`;

/* ---------- toast & modal ---------- */
let toastT;
function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(()=>t.classList.remove('show'), 2600); }
function modal(title, body, foot='', opts={}){
  const m = $('#modal');
  m.innerHTML = `<div class="modal-bg ${opts.drawer?'drawer-bg':''}" data-a="closeModalBg"><div class="modal ${opts.wide?'wide':''}" role="dialog" aria-modal="true">
    <div class="modal-h"><div>${opts.eyebrow?`<div class="eyebrow">${opts.eyebrow}</div>`:''}<h3 class="mt8">${title}</h3></div><button class="icon-btn" data-a="closeModal" aria-label="Close">${ic('x',16)}</button></div>
    <div class="modal-b">${body}</div>${foot?`<div class="modal-f">${foot}</div>`:''}</div></div>`;
}
function closeModal(){ $('#modal').innerHTML = ''; }
A.closeModal = closeModal;
A.closeModalBg = (el, e) => { if (e.target === el) closeModal(); };
document.addEventListener('keydown', e => { if (e.key==='Escape') closeModal(); });

/* ---------- routing & shell ---------- */
function route(){ return S.route[S.mode]; }
function go(v, p={}, keepScroll){ S.route[S.mode] = {v, p}; save(); render(); if (!keepScroll) window.scrollTo(0,0); }
A.go = el => go(el.dataset.v, el.dataset.p ? JSON.parse(el.dataset.p) : {});
A.mode = el => { S.mode = el.dataset.m; save(); render(); window.scrollTo(0,0); };
A.reset = () => modal('Reset demo data?', `<p class="muted">This restores the original sample providers, bookings, applications and tickets. Changes you've made in this browser will be cleared.</p>`, `<button class="btn btn-o" data-a="closeModal">Keep my changes</button><button class="btn btn-p" data-a="doReset">Reset demo</button>`);
A.doReset = () => { closeModal(); resetDemo(); };
const goAttr = (v, p) => `data-a="go" data-v="${v}"${p?` data-p='${esc(JSON.stringify(p))}'`:''}`;

function shell(){
  const m = S.mode;
  const upcomingMine = S.bookings.filter(b => b.mine && b.status==='confirmed' && b.date >= TODAY()).length;
  const pendingApps = S.applications.filter(a => a.status==='pending').length;
  const consumerNav = `<nav class="topnav">
      <button class="${route().v==='results'?'on':''}" data-a="go" data-v="results">${ic('search',17)} <span class="lbl">Explore</span></button>
      <button class="${route().v==='favs'?'on':''}" data-a="go" data-v="favs">${ic('heart',17)} <span class="lbl">Favourites</span></button>
      <button class="${route().v==='bookings'?'on':''}" data-a="go" data-v="bookings">${ic('cal',17)} <span class="lbl">My bookings</span>${upcomingMine?`<span class="count">${upcomingMine}</span>`:''}</button>
    </nav>`;
  const wsNav = m==='practitioner' ? `<nav class="topnav"><span class="small muted lbl">Signed in as</span> <b class="small">${esc(prov(DEMO_PROVIDER).name)}</b></nav>`
    : `<nav class="topnav"><span class="small muted lbl">AESTHEVA Operations</span>${pendingApps?`<span class="badge b-blush">${pendingApps} to review</span>`:''}</nav>`;
  return `<div class="ribbon"><span><b>Prototype</b> · fictional providers & sample data · payments are simulated · no real health information is collected</span><button data-a="reset">Reset demo data</button></div>
  <header class="topbar"><div class="topbar-in">
    <button class="logo" data-a="go" data-v="${m==='consumer'?'home':m==='practitioner'?'dash':'apps'}">AESTHEVA<small>${m==='consumer'?'AESTHETICS · WELLNESS':m==='practitioner'?'FOR PRACTITIONERS':'PLATFORM ADMIN'}</small></button>
    <div class="modes" role="tablist" aria-label="Demo workspace">
      <button class="${m==='consumer'?'on':''}" data-a="mode" data-m="consumer">Consumer</button>
      <button class="${m==='practitioner'?'on':''}" data-a="mode" data-m="practitioner">Practitioner</button>
      <button class="${m==='admin'?'on':''}" data-a="mode" data-m="admin">Admin</button>
    </div>
    ${m==='consumer'?consumerNav:wsNav}
  </div></header>`;
}
function wsShell(items, current, who, content){
  return `<div class="mob-nav">${items.map(i=>`<button class="${current===i.v?'on':''}" data-a="go" data-v="${i.v}">${i.label}${i.count?` (${i.count})`:''}</button>`).join('')}</div>
  <div class="ws"><aside class="side">${who}${items.map(i=>`<button class="nav ${current===i.v?'on':''}" data-a="go" data-v="${i.v}">${ic(i.icon,18)}<span class="grow">${i.label}</span>${i.count?`<span class="count">${i.count}</span>`:''}</button>`).join('')}</aside>
  <main class="ws-main">${content}</main></div>`;
}

function render(){
  const r = route(); let body = '';
  try {
    if (S.mode==='consumer') body = (CV[r.v] || CV.home)(r.p || {}) + `<footer class="footer"><div class="serif" style="font-size:22px;letter-spacing:.2em;color:var(--mulberry)">AESTHEVA</div><p class="mt8">Launching in Thiruvananthapuram · Kochi, Kozhikode & Thrissur next · Prototype with fictional sample data</p><p class="mt8 xs">Verification labels describe what was checked and its scope. They are not a guarantee of results.</p></footer>`;
    if (S.mode==='practitioner') body = PV.shell(r);
    if (S.mode==='admin') body = AV.shell(r);
  } catch (e){ console.error(e); body = `<div class="page"><div class="card"><h3>Something went wrong in this view</h3><p class="muted mt8">${esc(e.message)}</p><button class="btn btn-p mt16" data-a="go" data-v="home">Back</button></div></div>`; }
  $('#app').innerHTML = shell() + body;
}

/* ---------- event delegation ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  const fn = A[el.dataset.a]; if (!fn) return;
  if (el.tagName==='A' || el.type==='submit') e.preventDefault();
  if (el.dataset.stop) e.stopPropagation();
  fn(el, e);
});
document.addEventListener('change', e => { const el = e.target.closest('[data-ch]'); if (el && A[el.dataset.ch]) A[el.dataset.ch](el, e); });
document.addEventListener('input', e => { const el = e.target.closest('[data-in]'); if (el && A[el.dataset.in]) A[el.dataset.in](el, e); });
document.addEventListener('submit', e => { const f = e.target.closest('form[data-sub]'); if (f){ e.preventDefault(); A[f.dataset.sub] && A[f.dataset.sub](f, e); } });
