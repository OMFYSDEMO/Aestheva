/* AESTHEVA prototype — practitioner / clinic workspace (signed in as Lumière Skin & Laser Clinic) */
const PV = {};
const myBk = () => S.bookings.filter(b => b.providerId===DEMO_PROVIDER);
const live = b => !['cancelled','no-show'].includes(b.status);
const weekStart = d => { const x = parse(d); const w = (x.getDay()+6)%7; return addDays(d, -w); };

PV.shell = r => {
  const p = prov(DEMO_PROVIDER);
  const todayN = myBk().filter(b=>b.date===TODAY() && live(b)).length;
  const items = [
    {v:'dash', label:'Overview', icon:'home'}, {v:'calendar', label:'Calendar', icon:'cal', count: todayN},
    {v:'clients', label:'Clients', icon:'users'}, {v:'services', label:'Services & team', icon:'list'},
    {v:'profile', label:'Marketplace profile', icon:'edit'}, {v:'payments', label:'Payments', icon:'wallet'},
    {v:'onboard', label:'Onboarding', icon:'doc'}];
  const who = `<div class="who">${artBox(p.id,p.art,'','width:42px;height:42px;border-radius:12px;flex-shrink:0')}<div><b class="small" style="line-height:1.2;display:block">${esc(p.name)}</b><span class="xs muted">${esc(p.area)} · Clinic</span></div></div>`;
  const cur = r.v==='client' ? 'clients' : r.v;
  return wsShell(items, cur, who, (PV[r.v] || PV.dash)(r.p || {}));
};

/* ---------- overview ---------- */
PV.dash = () => {
  const bk = myBk(); const t = TODAY(); const ws = weekStart(t);
  const today = bk.filter(b=>b.date===t && b.status!=='cancelled').sort((a,b)=>a.time.localeCompare(b.time));
  const weekRev = bk.filter(b=>b.date>=ws && b.date<=addDays(ws,6) && ['completed','confirmed','arrived'].includes(b.status)).reduce((a,b)=>a+b.price,0);
  const lastWeekRev = bk.filter(b=>b.date>=addDays(ws,-7) && b.date<ws && b.status==='completed').reduce((a,b)=>a+b.price,0);
  const newC = S.clients.filter(c=>c.providerId===DEMO_PROVIDER && c.since >= addDays(t,-30)).length;
  const held = bk.filter(b=>b.date>=t && b.status==='confirmed' && b.source==='marketplace').reduce((a,b)=>a+b.paid,0);
  const days = Array.from({length:14},(_,i)=>addDays(t,i-13));
  const rev = days.map(d=>bk.filter(b=>b.date===d && b.status==='completed').reduce((a,b)=>a+b.price,0));
  const mx = Math.max(...rev, 1);
  const team = staffOf(DEMO_PROVIDER).map(s => { const dow = parse(t).getDay(); const cap = s.avail.days.includes(dow) ? toMin(s.avail.end)-toMin(s.avail.start) : 0; const used = today.filter(b=>b.staffId===s.id && live(b)).reduce((a,b)=>a+b.dur,0); return {s, cap, used}; });
  const h = new Date().getHours();
  return `<div class="ws-head"><div><div class="eyebrow">${fmtDate(t,true)}</div><h2 class="mt8">Good ${h<12?'morning':h<17?'afternoon':'evening'}, Lumière team</h2></div>
    <div class="row wrap"><button class="btn btn-o btn-s" data-a="go" data-v="calendar">${ic('cal',16)} Open calendar</button><button class="btn btn-p btn-s" data-a="newAppt">${ic('plus',16)} New appointment</button></div></div>
  <div class="grid g4 kpis">
    <div class="kpi feature"><div class="l">Today</div><div class="v">${today.filter(live).length}</div><div class="d">appointments · ${today.filter(b=>b.status==='completed').length} completed</div></div>
    <div class="kpi"><div class="l">Revenue this week</div><div class="v">${inr(weekRev)}</div><div class="d muted">booked & completed · last week ${inr(lastWeekRev)}</div></div>
    <div class="kpi"><div class="l">New clients</div><div class="v">${newC}</div><div class="d muted">last 30 days</div></div>
    <div class="kpi"><div class="l">Deposits held</div><div class="v">${inr(held)}</div><div class="d muted">for upcoming marketplace bookings</div></div>
  </div>
  <div class="grid mt24" style="grid-template-columns:minmax(0,1.4fr) minmax(0,1fr)">
    <div class="card"><div class="row between"><h3>Today's schedule</h3><button class="btn btn-g btn-s" data-a="go" data-v="calendar">Calendar ${ic('chevR',14)}</button></div>
      <div class="mt12">${today.length?today.map(b=>`<div class="list-item" style="cursor:pointer" data-a="appt" data-id="${b.id}"><div style="width:70px"><b>${fmtT(b.time)}</b><div class="xs muted">${b.dur} min</div></div><div class="grow"><b class="small">${esc(b.clientName)}</b><div class="xs muted">${esc(b.serviceName)} · ${esc(stf(b.staffId).name)}</div></div>${b.source==='marketplace'?'<span class="badge b-plain xs">Marketplace</span>':''}${statusBadge(b.status)}</div>`).join(''):'<p class="muted small">No appointments today.</p>'}</div></div>
    <div class="col" style="gap:20px">
      <div class="card"><h4>Completed revenue · 14 days</h4>
        <svg viewBox="0 0 280 120" style="width:100%;height:140px;margin-top:12px" role="img" aria-label="Daily completed revenue for the last 14 days">${rev.map((v,i)=>`<rect x="${i*20+3}" y="${100-v/mx*90}" width="14" height="${Math.max(1,v/mx*90)}" rx="3" fill="${i===13?'#713F54':'#C58F9D'}"><title>${fmtDate(days[i])}: ${inr(v)}</title></rect>`).join('')}<text x="3" y="116" font-size="9" fill="#6B5F65">${fmtDate(days[0])}</text><text x="277" y="116" font-size="9" fill="#6B5F65" text-anchor="end">Today</text></svg></div>
      <div class="card"><h4>Team today</h4>${team.map(x=>`<div class="list-item">${avatar(x.s.name,36,x.s.id)}<div class="grow"><div class="row between small"><b>${esc(x.s.name)}</b><span class="muted">${x.cap?Math.round(x.used/x.cap*100)+'% booked':'Off today'}</span></div><div class="bar-track mt8"><div class="bar-fill" style="width:${x.cap?Math.min(100,x.used/x.cap*100):0}%"></div></div></div></div>`).join('')}</div>
    </div>
  </div>
  <div class="card mt24"><div class="row between"><h3>Latest marketplace reviews</h3>${stars(rating(DEMO_PROVIDER), reviewsOf(DEMO_PROVIDER).length)}</div>${reviewsOf(DEMO_PROVIDER).slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3).map(reviewHtml).join('')}</div>`;
};

/* ---------- calendar ---------- */
const CAL_START = 8, CAL_END = 21, HPX = 64;
PV.calendar = () => {
  const u = S.ui; u.calDate = u.calDate || TODAY(); u.calView = u.calView || 'day'; u.calStaff = u.calStaff || 'all';
  const team = staffOf(DEMO_PROVIDER).filter(s => u.calStaff==='all' || s.id===u.calStaff);
  const hours = Array.from({length:CAL_END-CAL_START},(_,i)=>CAL_START+i);
  const cols = u.calView==='day' ? team.map(s=>({key:s.id, label:`${avatar(s.name,26,s.id)} ${esc(s.name)}`, date:u.calDate, staff:[s]})) :
    Array.from({length:7},(_,i)=>{ const d = addDays(weekStart(u.calDate), i); return {key:d, label:`<span class="${d===TODAY()?'':'muted'}" style="${d===TODAY()?'color:var(--mulberry)':''}">${fmtDate(d)}</span>`, date:d, staff:team}; });
  const tmpl = `56px repeat(${cols.length}, minmax(${u.calView==='day'?170:120}px,1fr))`;
  const colHtml = c => {
    const dow = parse(c.date).getDay();
    let off = '';
    if (u.calView==='day'){ const s = c.staff[0]; if (!s.avail.days.includes(dow)) off = `<div style="position:absolute;inset:0;background:repeating-linear-gradient(135deg,#FAF6F7 0 6px,#F3ECEE 6px 7px)"></div><div class="xs muted" style="position:absolute;top:12px;left:10px">Not working</div>`;
      else { const a = (toMin(s.avail.start)-CAL_START*60)/60*HPX, e = (toMin(s.avail.end)-CAL_START*60)/60*HPX; off = `<div style="position:absolute;left:0;right:0;top:0;height:${a}px;background:#FAF6F7"></div><div style="position:absolute;left:0;right:0;top:${e}px;bottom:0;background:#FAF6F7"></div>`; } }
    const bks = myBk().filter(b => b.date===c.date && c.staff.some(s=>s.id===b.staffId) && (u.showCancelled || b.status!=='cancelled'));
    // greedy lane assignment so overlapping appointments sit side by side
    const sorted = bks.slice().sort((a,b)=>a.time.localeCompare(b.time)); const laneEnd = []; const laneOf = {};
    sorted.forEach(b => { const s0 = toMin(b.time); let li = laneEnd.findIndex(e => e <= s0); if (li<0){ li = laneEnd.length; laneEnd.push(0);} laneEnd[li] = s0 + b.dur; laneOf[b.id] = li; });
    const nL = Math.max(1, laneEnd.length);
    const blocks = bks.map(b => { const top = (toMin(b.time)-CAL_START*60)/60*HPX; const h = b.dur/60*HPX-2; const li = laneOf[b.id]; const n = nL;
      return `<button class="appt s-${b.status} ${b.kind!=='beauty'?'med':''}" style="top:${top}px;height:${h}px;${n>1?`left:calc(${li/n*100}% + 2px);right:auto;width:calc(${100/n}% - 4px);`:''}" data-a="appt" data-id="${b.id}" data-stop="1" title="${esc(b.clientName)} · ${esc(b.serviceName)}"><b>${fmtT(b.time)} ${esc(b.clientName)}</b>${h>34?`<span class="muted">${esc(b.serviceName)}</span>`:''}${u.calView==='week'&&h>56?`<br><span class="xs soft">${esc(stf(b.staffId).name)}</span>`:''}</button>`; }).join('');
    const nowL = c.date===TODAY() && nowMin()>CAL_START*60 && nowMin()<CAL_END*60 ? `<div class="now-line" style="top:${(nowMin()-CAL_START*60)/60*HPX}px"></div>` : '';
    return `<div class="cal-col" data-a="calNew" data-date="${c.date}" data-staff="${u.calView==='day'?c.staff[0].id:''}" style="height:${hours.length*HPX}px">${off}${hours.map(()=>`<div class="cal-slot"></div>`).join('')}${blocks}${nowL}</div>`;
  };
  const dayBk = myBk().filter(b=>b.date===u.calDate && live(b));
  return `<div class="ws-head"><div><div class="eyebrow">Calendar</div><h2 class="mt8">${u.calView==='day'?fmtDate(u.calDate,true):'Week of '+fmtDate(weekStart(u.calDate))}</h2></div>
    <button class="btn btn-p btn-s" data-a="newAppt">${ic('plus',16)} New appointment</button></div>
  <div class="cal-tools">
    <div class="row" style="gap:4px"><button class="icon-btn" data-a="calNav" data-n="-1" aria-label="Previous">${ic('chevL',16)}</button><button class="btn btn-o btn-s" data-a="calToday">Today</button><button class="icon-btn" data-a="calNav" data-n="1" aria-label="Next">${ic('chevR',16)}</button></div>
    <input type="date" class="in" style="width:auto" value="${u.calDate}" data-ch="calPick" aria-label="Go to date">
    <div class="modes" style="padding:2px"><button class="${u.calView==='day'?'on':''}" data-a="calView" data-x="day">Day</button><button class="${u.calView==='week'?'on':''}" data-a="calView" data-x="week">Week</button></div>
    <select class="in" style="width:auto" data-ch="calStaff" aria-label="Team member"><option value="all">All team</option>${staffOf(DEMO_PROVIDER).map(s=>`<option value="${s.id}" ${u.calStaff===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select>
    <label class="check small" style="align-items:center"><input type="checkbox" data-ch="calCanc" ${u.showCancelled?'checked':''}> Show cancelled</label>
    <span class="small muted" style="margin-left:auto">${u.calView==='day'?`${dayBk.length} appointments · ${inr(dayBk.reduce((a,b)=>a+b.price,0))}`:''}</span>
  </div>
  <div class="legend" style="margin-bottom:10px"><span><i style="background:var(--mulberry-l);border-left:3px solid var(--mulberry)"></i>Confirmed</span><span><i style="background:#FBF1E3"></i>Arrived</span><span><i style="background:var(--sage)"></i>Completed</span><span><i style="background:#F5F2F3"></i>No-show / cancelled</span><span><i style="background:repeating-linear-gradient(135deg,var(--mulberry-l) 0 3px,#E9D6DD 3px 5px)"></i>Medical</span><span>Click an empty slot to add</span></div>
  <div class="cal"><div class="cal-grid" style="grid-template-columns:${tmpl}"><div class="cal-head" style="border-right:0"></div>${cols.map(c=>`<div class="cal-head" style="border-left:1px solid var(--line)">${c.label}</div>`).join('')}</div>
    <div class="cal-grid" style="grid-template-columns:${tmpl}"><div>${hours.map(h=>`<div class="cal-hour">${h%12||12}${h<12?'am':'pm'}</div>`).join('')}</div>${cols.map(colHtml).join('')}</div></div>`;
};
A.calNav = el => { const u = S.ui; u.calDate = addDays(u.calDate, (+el.dataset.n)*(u.calView==='day'?1:7)); render(); };
A.calToday = () => { S.ui.calDate = TODAY(); render(); };
A.calPick = el => { if (el.value){ S.ui.calDate = el.value; render(); } };
A.calView = el => { S.ui.calView = el.dataset.x; render(); };
A.calStaff = el => { S.ui.calStaff = el.value; render(); };
A.calCanc = el => { S.ui.showCancelled = el.checked; render(); };
A.calNew = (el, e) => {
  if (e.target.closest('.appt')) return;
  const y = e.clientY - el.getBoundingClientRect().top; const m = CAL_START*60 + Math.floor(y/HPX*2)*30;
  openNewAppt({date: el.dataset.date, staffId: el.dataset.staff || null, time: toT(m)});
};

/* appointment drawer */
A.appt = el => apptDrawer(el.dataset.id);
function apptDrawer(id){
  const b = S.bookings.find(x=>x.id===id); const c = clientOf(b.clientId); const t = stf(b.staffId); const s = svc(b.serviceId);
  const prior = myBk().filter(x=>x.clientId===b.clientId && x.status==='completed').length;
  const flow = ['confirmed','arrived','completed'];
  modal(esc(b.clientName), `
    <div class="row wrap" style="gap:8px">${statusBadge(b.status)}${s?kindBadge(s):''}<span class="badge b-plain">${b.source==='marketplace'?'Marketplace booking':'Direct booking'}</span>${prior?`<span class="badge b-plain">${prior} previous visit${prior>1?'s':''}</span>`:'<span class="badge b-blush">First visit</span>'}</div>
    <div class="card mt16" style="padding:16px">
      <div class="summary"><div class="line"><span class="muted">Service</span><b>${esc(b.serviceName)}</b></div><div class="line"><span class="muted">When</span><span>${fmtDate(b.date)} · ${fmtT(b.time)}–${fmtT(toT(toMin(b.time)+b.dur))}</span></div><div class="line"><span class="muted">With</span><span>${esc(t.name)}</span></div><div class="line"><span class="muted">Price</span><span>${inr(b.price)}</span></div><div class="line"><span class="muted">Deposit</span><span>${b.paid?inr(Math.min(b.paid,b.deposit))+' paid':'Not paid'}${b.refund?` · ${b.refund.status}`:''}</span></div><div class="line"><span class="muted">Reference</span><span>${b.ref}</span></div></div>
      ${b.note?`<div class="note n-plain mt12">${ic('info',14)}<div><b>Client note:</b> ${esc(b.note)}</div></div>`:''}
    </div>
    ${b.kind!=='beauty'?`<div class="note n-med mt12">${ic('shield',16)}<div>Medical service — record clinical assessment and consent in your clinical records system. AESTHEVA doesn't store health information.</div></div>`:''}
    <h4 class="mt24">Status</h4>
    <div class="row wrap mt12" style="gap:8px">${flow.map(st=>`<button class="btn btn-s ${b.status===st?'btn-p':'btn-o'}" data-a="setStatus" data-id="${b.id}" data-st="${st}">${st[0].toUpperCase()+st.slice(1)}</button>`).join('')}<button class="btn btn-s ${b.status==='no-show'?'btn-p':'btn-o'}" data-a="setStatus" data-id="${b.id}" data-st="no-show">No-show</button></div>
    ${b.status!=='cancelled'?`<h4 class="mt24">Move appointment</h4><div class="row wrap mt12"><input type="date" class="in" style="width:auto" id="mvD" value="${b.date}" data-ch="mvDate" data-id="${b.id}"><select class="in" style="width:auto" id="mvT">${(()=>{ const sl = staffSlots(b.staffId, b.date, b.dur, b.id); if (!sl.includes(b.time)) sl.unshift(b.time); return sl.sort().map(x=>`<option ${x===b.time?'selected':''} value="${x}">${fmtT(x)}</option>`).join(''); })()}</select><button class="btn btn-o btn-s" data-a="mvSave" data-id="${b.id}">Move</button></div>`:''}
    <h4 class="mt24">Client</h4>
    <div class="list-item">${avatar(b.clientName,40)}<div class="grow"><b class="small">${esc(b.clientName)}</b><div class="xs muted">${esc(c?c.phone:'')} ${c&&c.tags.length?' · '+c.tags.map(esc).join(', '):''}</div></div>${c?`<button class="btn btn-g btn-s" data-a="openClient" data-id="${c.id}">Profile</button>`:''}</div>
    ${b.history.length?`<h4 class="mt24">History</h4>${b.history.slice().reverse().map(h=>`<div class="xs muted mt8">${new Date(h.at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})} — ${esc(h.text)}</div>`).join('')}`:''}`,
    b.status!=='cancelled'?`<button class="btn btn-d btn-s" data-a="provCancel" data-id="${b.id}">Cancel appointment</button>`:`<span class="small muted">This appointment was cancelled.</span>`, {drawer:true, eyebrow:'Appointment'});
}
A.setStatus = el => { const b = S.bookings.find(x=>x.id===el.dataset.id); const st = el.dataset.st; b.history.push({at:new Date().toISOString(), text:`Status: ${b.status} → ${st}`}); b.status = st; if (st==='completed') b.paid = b.price; save(); render(); apptDrawer(b.id); toast(`Marked as ${st}`); };
A.mvDate = el => { const b = S.bookings.find(x=>x.id===el.dataset.id); const sl = staffSlots(b.staffId, el.value, b.dur, b.id); $('#mvT').innerHTML = sl.length ? sl.map(x=>`<option value="${x}">${fmtT(x)}</option>`).join('') : '<option value="">No free times</option>'; };
A.mvSave = el => { const b = S.bookings.find(x=>x.id===el.dataset.id); const d = $('#mvD').value, t = $('#mvT').value; if (!t){ toast('Choose a free time'); return; } b.history.push({at:new Date().toISOString(), text:`Moved by clinic from ${fmtDate(b.date)} ${fmtT(b.time)}`}); b.date = d; b.time = t; S.ui.calDate = d; save(); render(); apptDrawer(b.id); toast(`Moved to ${fmtDate(d)}, ${fmtT(t)}`); };
A.provCancel = el => { const b = S.bookings.find(x=>x.id===el.dataset.id); b.status = 'cancelled'; if (b.paid) b.refund = {status:'refunded', amount:b.paid}; b.history.push({at:new Date().toISOString(), text:'Cancelled by clinic · deposit auto-refunded'}); save(); render(); closeModal(); toast('Cancelled · client deposit refunded (simulated)'); };
A.openClient = el => { closeModal(); go('client', {id: el.dataset.id}); };

/* new appointment */
A.newAppt = el => openNewAppt({clientId: el && el.dataset && el.dataset.client});
function openNewAppt(o){
  const sv = svcsOf(DEMO_PROVIDER);
  const serviceId = o.serviceId || sv[0].id;
  let staffId = o.staffId && svc(serviceId).staff.includes(o.staffId) ? o.staffId : null;
  if (o.staffId && !staffId){ const alt = sv.find(s=>s.staff.includes(o.staffId)); if (alt) return openNewAppt({...o, serviceId: alt.id}); }
  staffId = staffId || svc(serviceId).staff[0];
  let date = o.date;
  if (!date){ date = TODAY(); for (let i=0;i<14;i++){ const d = addDays(TODAY(),i); if (staffSlots(staffId, d, svc(serviceId).dur).length){ date = d; break; } } }
  S.ui.na = {clientId: o.clientId || '', newName:'', serviceId, staffId, date, time: o.time || ''};
  naModal();
}
function naModal(){
  const n = S.ui.na; const s = svc(n.serviceId); const cl = S.clients.filter(c=>c.providerId===DEMO_PROVIDER).sort((a,b)=>a.name.localeCompare(b.name));
  const sl = staffSlots(n.staffId, n.date, s.dur); if (n.time && !sl.includes(n.time)) n.time = '';
  modal('New appointment', `<div class="col" style="gap:14px">
    <label class="f">Client<select class="in" data-ch="naSet" data-k="clientId"><option value="">+ New client</option>${cl.map(c=>`<option value="${c.id}" ${n.clientId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>
    ${n.clientId?'':`<label class="f">New client name<input class="in" id="naName" value="${esc(n.newName)}" data-in="naName" placeholder="Full name"></label>`}
    <div class="grid g2"><label class="f">Service<select class="in" data-ch="naSet" data-k="serviceId">${svcsOf(DEMO_PROVIDER).map(x=>`<option value="${x.id}" ${x.id===n.serviceId?'selected':''}>${esc(x.name)} · ${x.dur}m</option>`).join('')}</select></label>
    <label class="f">Practitioner<select class="in" data-ch="naSet" data-k="staffId">${s.staff.map(id=>`<option value="${id}" ${id===n.staffId?'selected':''}>${esc(stf(id).name)}</option>`).join('')}</select></label></div>
    <div class="grid g2"><label class="f">Date<input type="date" class="in" value="${n.date}" data-ch="naSet" data-k="date"></label>
    <label class="f">Time<select class="in" data-ch="naSet" data-k="time"><option value="">${sl.length?'Choose a time':'No free times'}</option>${sl.map(t=>`<option value="${t}" ${t===n.time?'selected':''}>${fmtT(t)}</option>`).join('')}</select></label></div>
    ${isMed(s)?`<div class="note n-med">${ic('shield',16)}<div>Medical service — clinical suitability is assessed by the practitioner at the appointment.</div></div>`:''}
  </div>`, `<button class="btn btn-o" data-a="closeModal">Cancel</button><button class="btn btn-p" data-a="naSave">Add appointment</button>`, {eyebrow:'Calendar'});
}
A.naSet = el => { const n = S.ui.na; n[el.dataset.k] = el.value; if (el.dataset.k==='serviceId'){ const s = svc(el.value); if (!s.staff.includes(n.staffId)) n.staffId = s.staff[0]; } naModal(); };
A.naName = el => { S.ui.na.newName = el.value; };
A.naSave = () => {
  const n = S.ui.na; if (!n.time){ toast('Choose a time'); return; }
  let c = n.clientId ? clientOf(n.clientId) : null;
  if (!c){ if (!n.newName.trim()){ toast('Enter the client name'); return; } c = ensureClient(DEMO_PROVIDER, n.newName.trim(), '', ''); c.tags = ['Walk-in / phone']; }
  const b = mkBooking({providerId:DEMO_PROVIDER, serviceId:n.serviceId, staffId:n.staffId, date:n.date, time:n.time, clientId:c.id, clientName:c.name, source:'direct', status:'confirmed', created:TODAY()});
  b.paid = 0; b.history.push({at:new Date().toISOString(), text:'Added by clinic'}); S.bookings.push(b);
  S.ui.calDate = n.date; save(); closeModal(); render(); toast(`Booked ${c.name} · ${fmtDate(n.date)} ${fmtT(n.time)}`);
};

/* ---------- clients ---------- */
function clientStats(c){ const bk = myBk().filter(b=>b.clientId===c.id); const done = bk.filter(b=>b.status==='completed'); const last = done.map(b=>b.date).sort().pop(); const next = bk.filter(b=>b.status==='confirmed' && b.date>=TODAY()).map(b=>b.date).sort()[0]; return {bk, visits:done.length, spend:done.reduce((a,b)=>a+b.price,0), last, next}; }
PV.clients = () => {
  const q = (S.ui.cq||'').toLowerCase();
  const list = S.clients.filter(c=>c.providerId===DEMO_PROVIDER).map(c=>({c, st:clientStats(c)})).filter(x=>!q || x.c.name.toLowerCase().includes(q) || x.c.phone.includes(q));
  list.sort((a,b)=> (b.st.last||'').localeCompare(a.st.last||''));
  return `<div class="ws-head"><div><div class="eyebrow">Client directory</div><h2 class="mt8">Clients</h2></div><button class="btn btn-p btn-s" data-a="newAppt">${ic('plus',16)} Book a client</button></div>
  <div class="row wrap" style="margin-bottom:16px"><div class="searchbar" style="margin:0;box-shadow:none;padding:3px;max-width:380px;flex:1"><div class="seg" style="padding:2px 12px">${ic('search',16)}<input placeholder="Search by name or phone" value="${esc(S.ui.cq||'')}" data-in="cq" aria-label="Search clients"></div></div><span class="small muted">${list.length} clients · sample data</span></div>
  <div class="tbl-wrap" id="ctbl">${clientTable(list)}</div>`;
};
const clientTable = list => `<table class="tbl"><thead><tr><th>Client</th><th>Phone</th><th>Visits</th><th>Last visit</th><th>Next</th><th>Spend</th><th>Tags</th></tr></thead><tbody>${list.map(({c,st})=>`<tr class="click" data-a="go" data-v="client" data-p='${JSON.stringify({id:c.id})}'><td><div class="row">${avatar(c.name,32)}<b class="small">${esc(c.name)}</b></div></td><td class="small muted">${esc(c.phone)}</td><td>${st.visits}</td><td class="small">${st.last?fmtDate(st.last):'—'}</td><td class="small">${st.next?fmtDate(st.next):'—'}</td><td>${inr(st.spend)}</td><td>${c.tags.map(t=>`<span class="badge b-plain">${esc(t)}</span>`).join(' ')}</td></tr>`).join('')}</tbody></table>`;
A.cq = el => { S.ui.cq = el.value; const q = el.value.toLowerCase(); const list = S.clients.filter(c=>c.providerId===DEMO_PROVIDER).map(c=>({c, st:clientStats(c)})).filter(x=>!q || x.c.name.toLowerCase().includes(q) || x.c.phone.includes(q)).sort((a,b)=> (b.st.last||'').localeCompare(a.st.last||'')); $('#ctbl').innerHTML = clientTable(list); };
PV.client = ({id}) => {
  const c = clientOf(id); if (!c) return PV.clients(); const st = clientStats(c);
  const bk = st.bk.slice().sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time));
  return `<button class="btn btn-g btn-s" data-a="go" data-v="clients" style="margin-left:-10px">${ic('chevL',16)} All clients</button>
  <div class="soft-card mt12 row wrap" style="gap:22px">${avatar(c.name,84)}<div class="grow"><div class="eyebrow">Client since ${fmtDate(c.since)}</div><h2 class="mt8">${esc(c.name)}</h2><div class="row wrap small mt8" style="gap:14px"><span>${ic('user',14)} ${esc(c.phone)}</span><span class="muted">${esc(c.email)}</span></div>
    <div class="chips mt12">${c.tags.map((t,i)=>`<span class="badge b-plain" style="padding:5px 10px">${esc(t)} <button class="btn-g" style="border:0;background:none;padding:0 0 0 4px;color:var(--soft)" data-a="rmTag" data-id="${c.id}" data-i="${i}" aria-label="Remove tag">×</button></span>`).join('')}<button class="badge b-blush" style="cursor:pointer" data-a="addTag" data-id="${c.id}">+ Tag</button></div></div>
    <button class="btn btn-p btn-s" data-a="newAppt" data-client="${c.id}">${ic('plus',16)} Book appointment</button></div>
  <div class="grid g3 kpis mt24"><div class="kpi"><div class="l">Visits</div><div class="v">${st.visits}</div></div><div class="kpi"><div class="l">Lifetime spend</div><div class="v">${inr(st.spend)}</div></div><div class="kpi"><div class="l">Next appointment</div><div class="v" style="font-size:26px">${st.next?fmtDate(st.next):'—'}</div></div></div>
  <div class="grid mt24" style="grid-template-columns:minmax(0,1.3fr) minmax(0,1fr)">
    <div class="card"><h3>Appointments</h3><div class="mt12">${bk.length?bk.map(b=>`<div class="list-item" style="cursor:pointer" data-a="appt" data-id="${b.id}"><div style="width:96px"><b class="small">${fmtDate(b.date)}</b><div class="xs muted">${fmtT(b.time)}</div></div><div class="grow"><b class="small">${esc(b.serviceName)}</b><div class="xs muted">${esc(stf(b.staffId).name)} · ${inr(b.price)}</div></div>${statusBadge(b.status)}</div>`).join(''):'<p class="muted small">No appointments yet.</p>'}</div></div>
    <div class="col" style="gap:20px">
      <div class="card"><h4>Preferences & admin notes</h4><p class="xs muted mt8">Non-clinical notes only (e.g. preferred practitioner, timing). Clinical records stay in your EMR — the prototype doesn't collect health information.</p><textarea class="in mt12" data-ch="cNote" data-id="${c.id}" maxlength="300" placeholder="e.g. Prefers late-afternoon slots">${esc(c.notes)}</textarea></div>
      <div class="card row between"><div><h4>Marketing consent</h4><p class="xs muted mt8">Offers and reminders by WhatsApp & email</p></div><button class="toggle ${c.optIn?'on':''}" data-a="cOpt" data-id="${c.id}" aria-label="Marketing consent"></button></div>
    </div></div>`;
};
A.cNote = el => { clientOf(el.dataset.id).notes = el.value; save(); toast('Note saved'); };
A.cOpt = el => { const c = clientOf(el.dataset.id); c.optIn = !c.optIn; save(); render(); };
A.addTag = el => modal('Add a tag', `<form data-sub="saveTag" class="col" style="gap:12px"><input type="hidden" name="id" value="${el.dataset.id}"><input class="in" name="tag" required maxlength="30" placeholder="e.g. Prefers Dr. Meera" autofocus><div class="chips">${['VIP','Prefers female practitioner','Bridal 2026','Corporate (Technopark)'].map(t=>`<button type="button" class="chip" data-a="tagPick" data-t="${t}">${t}</button>`).join('')}</div><button class="btn btn-p" type="submit">Add tag</button></form>`);
A.tagPick = el => { el.closest('form').tag.value = el.dataset.t; };
A.saveTag = f => { clientOf(f.id.value).tags.push(f.tag.value.trim()); save(); closeModal(); render(); };
A.rmTag = el => { clientOf(el.dataset.id).tags.splice(+el.dataset.i,1); save(); render(); };

/* ---------- services & team ---------- */
PV.services = () => {
  const all = S.services.filter(s=>s.providerId===DEMO_PROVIDER); const team = staffOf(DEMO_PROVIDER);
  const durs = [15,20,30,45,60,75,90,120];
  return `<div class="ws-head"><div><div class="eyebrow">Menu & availability</div><h2 class="mt8">Services & team</h2></div><div class="row"><button class="btn btn-o btn-s" data-a="previewProfile">Preview on marketplace</button><button class="btn btn-p btn-s" data-a="addSvc">${ic('plus',16)} Add service</button></div></div>
  <div class="note n-plain" style="margin-bottom:16px">${ic('info',16)}<div>Changes publish to your marketplace listing straight away. Medical services must be delivered by a registered practitioner on your team.</div></div>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th style="min-width:220px">Service</th><th>Type</th><th>Duration</th><th>Price (₹)</th><th>Deposit (₹)</th><th>Team</th><th>Live</th></tr></thead><tbody>
  ${all.map(s=>`<tr style="${s.active?'':'opacity:.55'}"><td><input class="in" style="padding:8px 10px" value="${esc(s.name)}" data-ch="svcEdit" data-id="${s.id}" data-k="name"></td>
    <td><select class="in" style="padding:8px" data-ch="svcEdit" data-id="${s.id}" data-k="kind"><option value="beauty" ${s.kind==='beauty'?'selected':''}>Beauty & wellness</option><option value="consult" ${s.kind==='consult'?'selected':''}>Medical consultation</option><option value="treatment" ${s.kind==='treatment'?'selected':''}>Medical · needs assessment</option></select></td>
    <td><select class="in" style="padding:8px" data-ch="svcEdit" data-id="${s.id}" data-k="dur">${durs.map(d=>`<option ${d===s.dur?'selected':''} value="${d}">${d} min</option>`).join('')}</select></td>
    <td><input class="in" type="number" min="0" step="50" style="padding:8px;width:100px" value="${s.price}" data-ch="svcEdit" data-id="${s.id}" data-k="price"></td>
    <td><input class="in" type="number" min="0" step="50" style="padding:8px;width:90px" value="${s.deposit}" data-ch="svcEdit" data-id="${s.id}" data-k="deposit"></td>
    <td><div class="chips" style="gap:4px">${team.map(t=>`<button class="chip ${s.staff.includes(t.id)?'on':''}" style="padding:4px 9px;font-size:12px" data-a="svcStaff" data-id="${s.id}" data-t="${t.id}" title="${esc(t.name)}">${esc(t.name.replace('Dr. ','').split(' ')[0])}</button>`).join('')}</div></td>
    <td><button class="toggle ${s.active?'on':''}" data-a="svcActive" data-id="${s.id}" aria-label="Show on marketplace"></button></td></tr>`).join('')}
  </tbody></table></div>
  <h3 class="mt48">Team availability</h3><p class="small muted mt8">Working days and hours drive the times clients can book.</p>
  <div class="grid g3 mt16">${team.map(t=>`<div class="card"><div class="row">${avatar(t.name,42,t.id)}<div><b>${esc(t.name)}</b><div class="xs muted">${esc(t.role)}</div></div></div>
    <div class="chips mt16" style="gap:5px">${[1,2,3,4,5,6,0].map(d=>`<button class="chip ${t.avail.days.includes(d)?'on':''}" style="padding:5px 9px;font-size:12px" data-a="availDay" data-id="${t.id}" data-d="${d}">${DOW[d]}</button>`).join('')}</div>
    <div class="row mt16"><select class="in" data-ch="availT" data-id="${t.id}" data-k="start" aria-label="Start time">${Array.from({length:14},(_,i)=>toT(420+i*60)).map(x=>`<option ${x===t.avail.start?'selected':''}>${x}</option>`).join('')}</select><span class="muted">to</span><select class="in" data-ch="availT" data-id="${t.id}" data-k="end" aria-label="End time">${Array.from({length:14},(_,i)=>toT(660+i*60)).map(x=>`<option ${x===t.avail.end?'selected':''}>${x}</option>`).join('')}</select></div></div>`).join('')}</div>`;
};
A.svcEdit = el => { const s = svc(el.dataset.id); const k = el.dataset.k; let v = el.value; if (['dur','price','deposit'].includes(k)) v = Math.max(0, +v||0); if (k==='kind' && v!=='beauty' && !s.staff.some(id=>stf(id).medical)){ toast('Assign a registered practitioner before marking this as medical'); render(); return; } s[k] = v; if (k==='deposit' && s.deposit > s.price) s.deposit = s.price; save(); toast('Saved · live on marketplace'); };
A.svcStaff = el => { const s = svc(el.dataset.id); const t = el.dataset.t; const i = s.staff.indexOf(t); if (i>-1){ if (s.staff.length===1){ toast('A service needs at least one team member'); return; } s.staff.splice(i,1); } else { if (s.kind!=='beauty' && !stf(t).medical){ toast('Only registered practitioners can deliver medical services'); return; } s.staff.push(t); } save(); render(); };
A.svcActive = el => { const s = svc(el.dataset.id); s.active = !s.active; save(); render(); toast(s.active?'Service visible on marketplace':'Service hidden from marketplace'); };
A.addSvc = () => { S.services.push({id:uid('v'), providerId:DEMO_PROVIDER, name:'New service', cat:'skin', kind:'beauty', dur:45, price:1500, deposit:300, staff:[staffOf(DEMO_PROVIDER).find(s=>!s.medical)?.id || staffOf(DEMO_PROVIDER)[0].id], desc:'Describe what’s included.', active:false}); save(); render(); toast('Draft service added — switch it live when ready'); };
A.availDay = el => { const t = stf(el.dataset.id); const d = +el.dataset.d; const i = t.avail.days.indexOf(d); i>-1 ? t.avail.days.splice(i,1) : t.avail.days.push(d); save(); render(); };
A.availT = el => { const t = stf(el.dataset.id); t.avail[el.dataset.k] = el.value; if (toMin(t.avail.end) <= toMin(t.avail.start)) toast('End time should be after start time'); save(); };
A.previewProfile = () => { S.mode = 'consumer'; S.route.consumer = {v:'provider', p:{id:DEMO_PROVIDER}}; save(); render(); window.scrollTo(0,0); toast('Viewing your public listing'); };

/* ---------- marketplace profile editor ---------- */
const AMENITIES = ['Private consultation rooms','Female practitioners available','Parking','Card & UPI','Wheelchair accessible','Evening appointments','Online follow-ups','Women-only'];
PV.profile = () => {
  const p = prov(DEMO_PROVIDER); const d = S.ui.draft = S.ui.draft || clone({name:p.name, tagline:p.tagline, about:p.about, area:p.area, address:p.address, hours:p.hours, amenities:p.amenities, art:p.art});
  const dirty = JSON.stringify(d) !== JSON.stringify({name:p.name, tagline:p.tagline, about:p.about, area:p.area, address:p.address, hours:p.hours, amenities:p.amenities, art:p.art});
  return `<div class="ws-head"><div><div class="eyebrow">Marketplace profile</div><h2 class="mt8">How clients see you</h2></div><div class="row"><button class="btn btn-o btn-s" data-a="previewProfile">View live listing</button><button class="btn btn-p btn-s" data-a="pubProfile" ${dirty?'':'disabled'}>${dirty?'Publish changes':'Published'}</button></div></div>
  <div class="grid" style="grid-template-columns:minmax(0,1.2fr) minmax(0,.8fr);align-items:start">
    <div class="card col" style="gap:16px">
      <label class="f">Display name<input class="in" value="${esc(d.name)}" data-in="dEdit" data-k="name" maxlength="60"></label>
      <label class="f">Tagline <span class="hint">One line shown on search results</span><input class="in" value="${esc(d.tagline)}" data-in="dEdit" data-k="tagline" maxlength="80"></label>
      <label class="f">About <span class="hint">Describe your approach. Avoid promising results — e.g. “we assess suitability first” rather than “guaranteed clear skin”.</span><textarea class="in" style="min-height:130px" data-in="dEdit" data-k="about" maxlength="600">${esc(d.about)}</textarea></label>
      <div id="claimWarn"></div>
      <div class="grid g2"><label class="f">Neighbourhood<select class="in" data-ch="dEdit" data-k="area">${D.AREAS.map(a=>`<option ${a===d.area?'selected':''}>${a}</option>`).join('')}</select></label><label class="f">Opening hours<input class="in" value="${esc(d.hours)}" data-in="dEdit" data-k="hours"></label></div>
      <label class="f">Address<input class="in" value="${esc(d.address)}" data-in="dEdit" data-k="address"></label>
      <div><div class="small" style="font-weight:600">Amenities</div><div class="chips mt8">${AMENITIES.map(a=>`<button class="chip ${d.amenities.includes(a)?'on':''}" data-a="dAmen" data-x="${esc(a)}">${esc(a)}</button>`).join('')}</div></div>
      <div><div class="small" style="font-weight:600">Cover style <span class="hint muted" style="font-weight:400">· replace with your own photography at launch</span></div><div class="row wrap mt8" style="gap:8px">${PAL.map((_,i)=>`<button data-a="dArt" data-i="${i}" style="width:64px;height:48px;border-radius:10px;overflow:hidden;padding:0;border:2px solid ${d.art===i?'var(--mulberry)':'transparent'};position:relative" aria-label="Cover style ${i+1}">${artBox(DEMO_PROVIDER,i,'','position:absolute;inset:0')}</button>`).join('')}</div></div>
      <div class="note n-sage">${ic('shield',16)}<div>Your verification labels are managed by AESTHEVA and can't be edited here: ${prov(DEMO_PROVIDER).verification.map(v=>esc(v.label)).join(' · ')}.</div></div>
    </div>
    <div class="sticky"><div class="eyebrow" style="margin-bottom:10px">Live preview</div><div id="pPrev">${profilePreview(d)}</div></div>
  </div>`;
};
const profilePreview = d => { const p = prov(DEMO_PROVIDER); return `<div class="pcard" style="cursor:default">${artBox(p.id, d.art)}<div class="body"><div class="row between"><span class="eyebrow" style="color:var(--muted)">${esc(p.type)}</span>${stars(rating(p.id), reviewsOf(p.id).length)}</div><h4 style="font-size:22px">${esc(d.name)}</h4><p class="small muted">${esc(d.tagline)}</p><div class="row small muted">${ic('pin',14)} ${esc(d.area)}</div><p class="small mt8">${esc(d.about.slice(0,160))}${d.about.length>160?'…':''}</p><div class="chips mt8">${d.amenities.slice(0,4).map(a=>`<span class="badge b-plain">${esc(a)}</span>`).join('')}</div></div></div>`; };
const CLAIMS = /guarantee|guaranteed|permanent|100%|risk[- ]free|miracle|cure/i;
A.dEdit = el => { S.ui.draft[el.dataset.k] = el.value; $('#pPrev').innerHTML = profilePreview(S.ui.draft); const w = $('#claimWarn'); if (w) w.innerHTML = CLAIMS.test(S.ui.draft.about+S.ui.draft.tagline) ? `<div class="note n-warn">${ic('alert',16)}<div>This wording may imply guaranteed outcomes. Listings with outcome claims are held for review.</div></div>` : ''; const b = document.querySelector('[data-a="pubProfile"]'); if (b){ b.disabled = false; b.textContent = 'Publish changes'; } };
A.dAmen = el => { const a = S.ui.draft.amenities; const i = a.indexOf(el.dataset.x); i>-1 ? a.splice(i,1) : a.push(el.dataset.x); render(); };
A.dArt = el => { S.ui.draft.art = +el.dataset.i; render(); };
A.pubProfile = () => { const d = S.ui.draft; if (CLAIMS.test(d.about+d.tagline)){ toast('Please remove outcome claims before publishing'); return; } Object.assign(prov(DEMO_PROVIDER), clone(d)); save(); render(); toast('Published to the marketplace'); };

/* ---------- payments ---------- */
PV.payments = () => {
  const t = TODAY(); const from = addDays(t,-30);
  const bk = myBk().filter(b=>b.date>=from && b.date<=addDays(t,14));
  const mk = bk.filter(b=>b.source==='marketplace');
  const deposits = mk.filter(b=>b.paid>0 && !(b.refund && b.refund.status==='refunded')).reduce((a,b)=>a+Math.min(b.paid,b.deposit),0);
  const refunds = mk.filter(b=>b.refund && b.refund.status==='refunded').reduce((a,b)=>a+b.refund.amount,0);
  const comm = mk.filter(b=>b.status==='completed' && b.date>=from && b.date<=t).reduce((a,b)=>a+b.price*COMMISSION,0);
  const gross = bk.filter(b=>b.status==='completed' && b.date<=t).reduce((a,b)=>a+b.price,0);
  const ws0 = weekStart(t);
  const weeks = Array.from({length:5},(_,i)=>addDays(ws0,-7*(4-i))).map(w => { const wb = myBk().filter(b=>b.source==='marketplace' && b.date>=w && b.date<=addDays(w,6));
    const dep = wb.filter(b=>b.status==='completed').reduce((a,b)=>a+b.deposit,0); const c = wb.filter(b=>b.status==='completed').reduce((a,b)=>a+b.price*COMMISSION,0); const rf = 0;
    return {w, dep, c, net: dep - c - rf, status: w===ws0 ? 'Scheduled' : 'Paid', payout: addDays(w,7)}; });
  const tx = myBk().filter(b=>b.source==='marketplace' && b.date<=addDays(t,14)).sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time)).slice(0,14);
  return `<div class="ws-head"><div><div class="eyebrow">Last 30 days</div><h2 class="mt8">Payments & settlements</h2></div><span class="badge b-warn">All payments simulated</span></div>
  <div class="grid g4 kpis">
    <div class="kpi"><div class="l">Completed service value</div><div class="v">${inr(gross)}</div><div class="d muted">all channels</div></div>
    <div class="kpi"><div class="l">Deposits via AESTHEVA</div><div class="v">${inr(deposits)}</div><div class="d muted">marketplace bookings</div></div>
    <div class="kpi"><div class="l">Platform commission</div><div class="v">${inr(comm)}</div><div class="d muted">${COMMISSION*100}% of completed marketplace bookings</div></div>
    <div class="kpi feature"><div class="l">Refunded to clients</div><div class="v">${inr(refunds)}</div><div class="d">cancellations & reviews</div></div>
  </div>
  <div class="grid mt24" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr)">
    <div class="card"><div class="row between"><h3>Weekly settlements</h3><span class="xs muted">Paid every Monday</span></div>
      <div class="tbl-wrap mt16" style="border:0"><table class="tbl"><thead><tr><th>Week</th><th>Deposits</th><th>Commission</th><th>Net payout</th><th></th></tr></thead><tbody>${weeks.slice().reverse().map(w=>`<tr><td class="small">${fmtDate(w.w)}</td><td>${inr(w.dep)}</td><td class="muted">−${inr(w.c)}</td><td><b>${inr(w.net)}</b></td><td>${w.status==='Paid'?`<span class="badge b-ok">Paid ${fmtDate(w.payout)}</span>`:`<span class="badge b-warn">Due ${fmtDate(w.payout)}</span>`}</td></tr>`).join('')}</tbody></table></div>
      <div class="note n-plain mt16">${ic('wallet',16)}<div>Payout account: Sample Bank ••••4821 (fictional). Balance payments taken at your venue aren't processed by AESTHEVA.</div></div></div>
    <div class="card"><h3>How a ₹4,200 facial settles</h3><div class="summary mt16"><div class="line"><span>Client pays deposit online</span><span>${inr(800)}</span></div><div class="line"><span>Client pays balance at venue</span><span>${inr(3400)}</span></div><div class="line"><span class="muted">AESTHEVA commission (10%)</span><span class="muted">−${inr(420)}</span></div><div class="line tot"><span>Settled to you on Monday</span><span>${inr(380)}</span></div><p class="xs muted mt8">Deposit minus commission. Repeat clients you book directly carry no commission.</p></div></div>
  </div>
  <h3 class="mt48">Recent marketplace transactions</h3>
  <div class="tbl-wrap mt16"><table class="tbl"><thead><tr><th>Date</th><th>Ref</th><th>Client</th><th>Service</th><th>Deposit</th><th>Commission</th><th>Status</th></tr></thead><tbody>${tx.map(b=>`<tr class="click" data-a="appt" data-id="${b.id}"><td class="small">${fmtDate(b.date)}</td><td class="small muted">${b.ref}</td><td class="small">${esc(b.clientName)}</td><td class="small">${esc(b.serviceName)}</td><td>${b.refund&&b.refund.status==='refunded'?`<span style="color:var(--err)">−${inr(b.refund.amount)} refund</span>`:b.paid?inr(Math.min(b.paid,b.deposit)):'—'}</td><td class="muted">${b.status==='completed'?'−'+inr(b.price*COMMISSION):'—'}</td><td>${statusBadge(b.status)}</td></tr>`).join('')}</tbody></table></div>`;
};

/* ---------- onboarding ---------- */
const OB_STEPS = ['Business','Lead practitioner','Services','Documents','Review'];
function obDocs(o){ return o.medical ? ['Business identity (GST or trade licence)','Lead practitioner ID (masked)','Medical / dental council registration','Clinical establishment registration','Professional indemnity cover'] : ['Business identity (GST or trade licence)','Owner ID (masked)','Professional certificates']; }
PV.onboard = () => {
  const o = S.onboarding = S.onboarding || {step:1, medical:false, biz:{name:'', type:'Salon & studio', area:'Kazhakkoottam', address:'', gst:''}, lead:{name:'', role:'', body:'', reg:'', scope:''}, services:[{name:'', kind:'beauty', dur:60, price:1500}], docs:{}};
  if (o.submittedId){ const a = S.applications.find(x=>x.id===o.submittedId); const st = a ? a.status : 'pending';
    const stages = [['Submitted',true],['In review',true],[st==='approved'?'Approved':st==='rejected'?'Not approved':st==='info'?'Information requested':'Decision', ['approved','rejected','info'].includes(st)]];
    return `<div class="ws-head"><div><div class="eyebrow">Application ${o.submittedId}</div><h2 class="mt8">${esc(o.biz.name)}</h2></div><button class="btn btn-o btn-s" data-a="obNew">Start another application</button></div>
      <div class="card"><div class="phase-line">${stages.map(([n,on])=>`<div class="phase ${on?'on':''}">${n}</div>`).join('')}</div>
      ${st==='approved'?`<div class="note n-sage">${ic('check',16)}<div><b>Approved and live.</b> Your listing now appears in marketplace search with verification labels for the scope reviewed.</div></div><button class="btn btn-p mt16" data-a="viewNew" data-id="${a.providerId}">View your listing</button>`:
        st==='info'?`<div class="note n-warn">${ic('alert',16)}<div><b>More information needed:</b> ${esc((a.notes.slice(-1)[0]||{}).text||'')}</div></div>`:
        st==='rejected'?`<div class="note n-warn">${ic('alert',16)}<div>${esc((a.notes.slice(-1)[0]||{}).text||'Application not approved.')}</div></div>`:
        `<p class="muted">Our team checks each document against the scope you've requested. Typical review time is 2 working days.</p><div class="note n-plain mt16">${ic('info',16)}<div>Demo tip: switch to <b>Admin</b> mode to review and approve this application, then come back here.</div></div><button class="btn btn-p mt16" data-a="toAdminApp" data-id="${o.submittedId}">Review as admin</button>`}</div>`;
  }
  const stepper = `<div class="steps">${OB_STEPS.map((n,i)=>`<span class="st ${o.step===i+1?'on':o.step>i+1?'done':''}"><i>${o.step>i+1?'✓':i+1}</i>${n}</span>`).join('')}</div>`;
  let b = '';
  if (o.step===1) b = `<div class="grid g2"><label class="f">Business name<input class="in" value="${esc(o.biz.name)}" data-in="obF" data-g="biz" data-k="name" placeholder="e.g. Nirvana Skin Studio"></label>
    <label class="f">Provider type<select class="in" data-ch="obF" data-g="biz" data-k="type">${D.TYPES.map(t=>`<option ${t===o.biz.type?'selected':''}>${t}</option>`).join('')}</select></label>
    <label class="f">Neighbourhood<select class="in" data-ch="obF" data-g="biz" data-k="area">${D.AREAS.map(a=>`<option ${a===o.biz.area?'selected':''}>${a}</option>`).join('')}</select></label>
    <label class="f">GST number <span class="hint">Optional · sample only</span><input class="in" value="${esc(o.biz.gst)}" data-in="obF" data-g="biz" data-k="gst" placeholder="32XXXXX0000X1Z5"></label></div>
    <label class="f mt16">Address<input class="in" value="${esc(o.biz.address)}" data-in="obF" data-g="biz" data-k="address"></label>
    <div class="card mt24" style="background:var(--porcelain)"><b>Will you offer medical services?</b><p class="small muted mt8">Consultations or treatments by doctors, dentists or physiotherapists. These require registration documents and are labelled separately from beauty services.</p>
      <div class="row mt12"><button class="chip ${!o.medical?'on':''}" data-a="obMed" data-x="0">No — beauty & wellness only</button><button class="chip ${o.medical?'on':''}" data-a="obMed" data-x="1">Yes — includes medical</button></div></div>`;
  if (o.step===2) b = `<div class="grid g2"><label class="f">Full name<input class="in" value="${esc(o.lead.name)}" data-in="obF" data-g="lead" data-k="name"></label><label class="f">Role<input class="in" value="${esc(o.lead.role)}" data-in="obF" data-g="lead" data-k="role" placeholder="${o.medical?'e.g. Dermatologist':'e.g. Senior stylist'}"></label>
    ${o.medical?`<label class="f">Registration body<select class="in" data-ch="obF" data-g="lead" data-k="body"><option value="">Select</option>${['Travancore-Cochin Medical Council','Kerala State Dental Council','Kerala State Physiotherapy Council','TCMC — Indian Systems of Medicine'].map(x=>`<option ${x===o.lead.body?'selected':''}>${x}</option>`).join('')}</select></label><label class="f">Registration number <span class="hint">Use a sample value in this demo</span><input class="in" value="${esc(o.lead.reg)}" data-in="obF" data-g="lead" data-k="reg" placeholder="SAMPLE-12345"></label>`:''}</div>
    <label class="f mt16">Scope you'd like verified <span class="hint">e.g. “Dermatology consultations” or “Hair & makeup”. We only label what we can check.</span><input class="in" value="${esc(o.lead.scope)}" data-in="obF" data-g="lead" data-k="scope"></label>`;
  if (o.step===3) b = `<p class="small muted">Add up to 4 launch services. You can refine them later.</p>${o.services.map((s,i)=>`<div class="card mt12" style="padding:16px"><div class="grid" style="grid-template-columns:2fr 1.4fr 1fr 1fr auto;gap:10px;align-items:end">
    <label class="f">Service<input class="in" value="${esc(s.name)}" data-in="obS" data-i="${i}" data-k="name"></label>
    <label class="f">Type<select class="in" data-ch="obS" data-i="${i}" data-k="kind"><option value="beauty">Beauty & wellness</option>${o.medical?`<option value="consult" ${s.kind==='consult'?'selected':''}>Medical consultation</option><option value="treatment" ${s.kind==='treatment'?'selected':''}>Medical · needs assessment</option>`:''}</select></label>
    <label class="f">Minutes<input class="in" type="number" value="${s.dur}" data-in="obS" data-i="${i}" data-k="dur"></label><label class="f">Price ₹<input class="in" type="number" value="${s.price}" data-in="obS" data-i="${i}" data-k="price"></label>
    <button class="icon-btn" data-a="obRmS" data-i="${i}" aria-label="Remove">${ic('x',14)}</button></div></div>`).join('')}
    ${o.services.length<4?`<button class="btn btn-o btn-s mt16" data-a="obAddS">${ic('plus',14)} Add service</button>`:''}`;
  if (o.step===4) b = `<div class="note n-plain">${ic('info',16)}<div>Demo: files stay on your device. Only the file name is recorded so the admin team can see what was "submitted".</div></div>
    <div class="col mt16" style="gap:10px">${obDocs(o).map(d=>{ const f = o.docs[d]; return `<div class="doc">${ic('doc',20,'style="color:var(--rose)"')}<div class="grow"><b class="small">${esc(d)}</b><div class="xs ${f?'':'muted'}" style="${f?'color:var(--sage-d)':''}">${f?'✓ '+esc(f):'Required · PDF or image'}</div></div><label class="btn btn-o btn-s" style="cursor:pointer">${ic('upload',14)} ${f?'Replace':'Upload'}<input type="file" class="sr" accept=".pdf,image/*" data-ch="obFile" data-k="${esc(d)}"></label></div>`; }).join('')}</div>
    <button class="btn btn-g btn-s mt12" data-a="obSample">Fill with sample files</button>`;
  if (o.step===5) b = `<div class="grid g2"><div class="card"><h4>Business</h4><p class="small mt8"><b>${esc(o.biz.name||'—')}</b><br>${esc(o.biz.type)} · ${esc(o.biz.area)}<br><span class="muted">${esc(o.biz.address)}</span></p><p class="mt12">${o.medical?'<span class="badge b-med">Includes medical services</span>':'<span class="badge b-beauty">Beauty & wellness only</span>'}</p></div>
    <div class="card"><h4>Lead practitioner</h4><p class="small mt8"><b>${esc(o.lead.name||'—')}</b><br>${esc(o.lead.role)}${o.medical?`<br><span class="muted">${esc(o.lead.body)} · ${esc(o.lead.reg)}</span>`:''}<br>Scope: ${esc(o.lead.scope||'—')}</p></div></div>
    <div class="card mt16"><h4>Services</h4>${o.services.filter(s=>s.name).map(s=>`<div class="svc-line"><span>${esc(s.name)} ${s.kind!=='beauty'?'<span class="badge b-med">Medical</span>':''}</span><span>${s.dur} min · ${inr(s.price)}</span></div>`).join('')}</div>
    <div class="card mt16"><h4>Documents</h4>${obDocs(o).map(d=>`<div class="verify">${o.docs[d]?ic('check',16):ic('alert',16,'style="color:var(--warn)"')}<span>${esc(d)} — <span class="muted">${esc(o.docs[d]||'missing')}</span></span></div>`).join('')}</div>
    <label class="check mt16"><input type="checkbox" id="obAgree"> I confirm these details are accurate and that I'll only describe outcomes my practitioners can responsibly offer.</label>`;
  return `<div class="ws-head"><div><div class="eyebrow">Join AESTHEVA</div><h2 class="mt8">Provider application</h2></div></div>${stepper}
    <div class="card" style="max-width:860px">${b}<div class="row between mt24">${o.step>1?'<button class="btn btn-o" data-a="obBack">Back</button>':'<span></span>'}${o.step<5?'<button class="btn btn-p" data-a="obNext">Continue</button>':'<button class="btn btn-p" data-a="obSubmit">Submit application</button>'}</div></div>`;
};
A.obF = el => { S.onboarding[el.dataset.g][el.dataset.k] = el.value; save(); };
A.obMed = el => { S.onboarding.medical = el.dataset.x==='1'; save(); render(); };
A.obS = el => { const s = S.onboarding.services[+el.dataset.i]; s[el.dataset.k] = ['dur','price'].includes(el.dataset.k) ? +el.value : el.value; save(); };
A.obAddS = () => { S.onboarding.services.push({name:'', kind:'beauty', dur:60, price:1500}); save(); render(); };
A.obRmS = el => { S.onboarding.services.splice(+el.dataset.i,1); if (!S.onboarding.services.length) S.onboarding.services.push({name:'', kind:'beauty', dur:60, price:1500}); save(); render(); };
A.obFile = el => { const f = el.files[0]; if (f){ S.onboarding.docs[el.dataset.k] = `${f.name} (${Math.max(1,Math.round(f.size/1024))} KB)`; save(); render(); } };
A.obSample = () => { obDocs(S.onboarding).forEach(d => S.onboarding.docs[d] = d.toLowerCase().replace(/[^a-z]+/g,'_').replace(/^_|_$/g,'') + '_sample.pdf'); save(); render(); };
A.obNext = () => { const o = S.onboarding;
  if (o.step===1 && !o.biz.name.trim()){ toast('Add your business name'); return; }
  if (o.step===2 && (!o.lead.name.trim() || (o.medical && (!o.lead.body || !o.lead.reg)))){ toast(o.medical?'Add the practitioner name, council and registration number':'Add the lead practitioner name'); return; }
  if (o.step===3 && !o.services.some(s=>s.name.trim())){ toast('Add at least one service'); return; }
  if (o.step===4 && obDocs(o).some(d=>!o.docs[d])){ toast('Upload every required document (or use sample files)'); return; }
  o.step++; save(); render(); window.scrollTo(0,0); };
A.obBack = () => { S.onboarding.step--; save(); render(); };
A.obSubmit = () => { if (!$('#obAgree').checked){ toast('Please confirm the declaration'); return; } const o = S.onboarding;
  const id = 'A-' + (2210 + S.applications.length);
  S.applications.unshift({id, name:o.biz.name, type:o.biz.type, area:o.biz.area, address:o.biz.address, submitted:TODAY(), status:'pending', medical:o.medical, contact:`${o.lead.name} · ${o.lead.role}`,
    lead:{name:o.lead.name, role:o.lead.role, reg:o.medical?`${o.lead.body} · ${o.lead.reg}`:'', scope:o.lead.scope}, services:o.services.filter(s=>s.name.trim()).map(s=>({...s, cat:s.kind==='beauty'?'skin':'medaes', deposit:Math.round(s.price*.2/50)*50})),
    docs: obDocs(o).map(d=>({name:d, file:o.docs[d], ok:false})), notes:[], fromOnboarding:true});
  o.submittedId = id; save(); render(); toast(`Application ${id} submitted`); };
A.obNew = () => { S.onboarding = null; save(); render(); };
A.toAdminApp = el => { S.mode = 'admin'; S.route.admin = {v:'apps', p:{id: el.dataset.id}}; save(); render(); window.scrollTo(0,0); };
A.viewNew = el => { S.mode = 'consumer'; S.route.consumer = {v:'provider', p:{id: el.dataset.id}}; save(); render(); window.scrollTo(0,0); };
