/* AESTHEVA prototype — platform admin */
const AV = {};
AV.shell = r => {
  const items = [
    {v:'apps', label:'Provider applications', icon:'doc', count:S.applications.filter(a=>a.status==='pending').length},
    {v:'bookings', label:'Bookings & commission', icon:'chart'},
    {v:'tickets', label:'Complaints & refunds', icon:'inbox', count:S.tickets.filter(t=>t.status!=='resolved').length},
    {v:'cities', label:'City expansion', icon:'map'}];
  const who = `<div class="who"><div class="avatar" style="width:42px;height:42px;background:var(--mulberry);color:#fff;font-size:15px;border-radius:12px">AE</div><div><b class="small">Operations</b><div class="xs muted">Trust & marketplace team</div></div></div>`;
  return wsShell(items, r.v, who, (AV[r.v] || AV.apps)(r.p || {}));
};
const appBadge = s => ({pending:'<span class="badge b-warn">Pending review</span>', info:'<span class="badge b-blush">Info requested</span>', approved:'<span class="badge b-ok">Approved</span>', rejected:'<span class="badge b-err">Not approved</span>'}[s]);

/* ---------- applications ---------- */
AV.apps = ({id}) => {
  const f = S.ui.appF || 'open';
  const list = S.applications.filter(a => f==='all' || (f==='open' ? ['pending','info'].includes(a.status) : a.status===f));
  const sel = S.applications.find(a=>a.id===id) || list[0];
  return `<div class="ws-head"><div><div class="eyebrow">Trust & safety</div><h2 class="mt8">Provider applications</h2></div><span class="small muted">Verification is recorded by scope — never as a guarantee of outcomes.</span></div>
  <div class="chips" style="margin-bottom:16px">${[['open','Open'],['pending','Pending'],['info','Info requested'],['approved','Approved'],['rejected','Not approved'],['all','All']].map(([k,l])=>`<button class="chip ${f===k?'on':''}" data-a="appF" data-f="${k}">${l} (${S.applications.filter(a=>k==='all'||(k==='open'?['pending','info'].includes(a.status):a.status===k)).length})</button>`).join('')}</div>
  <div class="grid" style="grid-template-columns:minmax(0,.8fr) minmax(0,1.5fr);align-items:start">
    <div class="col" style="gap:10px">${list.length?list.map(a=>`<button class="app-item ${sel&&sel.id===a.id?'on':''}" ${goAttr('apps',{id:a.id})}>${avatar(a.name,42,a.id)}<div class="grow col" style="gap:2px"><b class="small">${esc(a.name)}</b><span class="xs muted">${esc(a.type)} · ${esc(a.area)} · ${fmtDate(a.submitted)}</span><div class="row" style="gap:6px;margin-top:4px">${appBadge(a.status)}${a.medical?'<span class="badge b-med">Medical</span>':''}${a.fromOnboarding?'<span class="badge b-dark">Your demo</span>':''}</div></div></button>`).join(''):'<div class="card"><p class="muted small">No applications in this view.</p></div>'}</div>
    <div>${sel?appDetail(sel):''}</div>
  </div>`;
};
A.appF = el => { S.ui.appF = el.dataset.f; save(); go('apps', {}, true); };
function scopeLabel(doc){ const d = doc.toLowerCase();
  if (d.includes('council') || d.includes('medical council')) return 'Practitioner registration checked';
  if (d.includes('clinical establishment')) return 'Clinical establishment registration checked';
  if (d.includes('indemnity')) return 'Professional indemnity cover checked';
  if (d.includes('certif') || d.includes('fellowship')) return 'Professional certificates checked';
  if (d.includes('gst') || d.includes('trade') || d.includes('business')) return 'Business identity checked';
  if (d.includes('id')) return 'Identity checked';
  return doc + ' checked'; }
function appDetail(a){
  const allOk = a.docs.every(d=>d.ok); const medRegOk = !a.medical || a.docs.some(d=>/council/i.test(d.name) && d.ok);
  const open = ['pending','info'].includes(a.status);
  return `<div class="card">
    <div class="row between wrap" style="align-items:flex-start"><div><div class="eyebrow">${a.id} · submitted ${fmtDate(a.submitted)}</div><h3 class="mt8" style="font-size:30px">${esc(a.name)}</h3><p class="small muted mt8">${esc(a.type)} · ${esc(a.area)}, Thiruvananthapuram · ${esc(a.contact)}</p></div><div class="row" style="gap:6px">${appBadge(a.status)}${a.medical?'<span class="badge b-med">'+ic('shield',12)+' Medical scope</span>':'<span class="badge b-beauty">Beauty & wellness</span>'}</div></div>
    <div class="grid g2 mt24">
      <div class="card" style="background:var(--porcelain)"><h4>Lead practitioner</h4><p class="small mt8"><b>${esc(a.lead.name)}</b> · ${esc(a.lead.role)}</p>${a.lead.reg?`<p class="xs muted mt8">Registration: ${esc(a.lead.reg)}</p>`:''}<p class="xs muted mt8">Requested scope: ${esc(a.lead.scope||'—')}</p></div>
      <div class="card" style="background:var(--porcelain)"><h4>Launch services</h4>${a.services.length?a.services.map(s=>`<div class="svc-line"><span class="small">${esc(s.name)} ${s.kind!=='beauty'?'<span class="badge b-med" style="font-size:10px;padding:1px 6px">Medical</span>':''}</span><span class="small muted">${inr(s.price)}</span></div>`).join(''):'<p class="small muted mt8">—</p>'}</div>
    </div>
    <h4 class="mt24">Documents</h4><p class="xs muted mt8">Tick each document once checked against the issuing body. Approval publishes one verification label per checked document type.</p>
    <div class="col mt12" style="gap:8px">${a.docs.map((d,i)=>`<div class="doc">${ic('doc',20,'style="color:var(--rose)"')}<div class="grow"><b class="small">${esc(d.name)}</b><div class="xs muted">${esc(d.file)}</div></div>${open?`<label class="check small" style="align-items:center"><input type="checkbox" ${d.ok?'checked':''} data-ch="docOk" data-id="${a.id}" data-i="${i}" ${d.file==='—'?'disabled':''}> Verified</label>`:d.ok?'<span class="badge b-ok">Verified</span>':'<span class="badge b-plain">Not verified</span>'}</div>`).join('')}</div>
    ${open?`<div class="note ${allOk&&medRegOk?'n-sage':'n-plain'} mt16">${ic(allOk&&medRegOk?'check':'info',16)}<div>${allOk&&medRegOk?`Will publish: ${[...new Set(a.docs.map(d=>scopeLabel(d.name)))].map(esc).join(' · ')}`:a.medical&&!medRegOk?'Medical applications need the practitioner’s council registration verified before approval.':'Verify all documents to enable approval.'}</div></div>`:''}
    <h4 class="mt24">Notes</h4>${a.notes.length?a.notes.map(n=>`<div class="xs mt8"><b>${fmtDate(n.date)}</b> — ${esc(n.text)}</div>`).join(''):'<p class="xs muted mt8">No notes yet.</p>'}
    ${open?`<textarea class="in mt12" id="appNote" placeholder="Note to applicant (required to request info or decline)" maxlength="300"></textarea>
    <div class="row wrap mt16" style="justify-content:flex-end;gap:8px"><button class="btn btn-d btn-s" data-a="appDecide" data-id="${a.id}" data-x="rejected">Decline</button><button class="btn btn-o btn-s" data-a="appDecide" data-id="${a.id}" data-x="info">Request information</button><button class="btn btn-ok btn-s" data-a="appApprove" data-id="${a.id}" ${allOk&&medRegOk?'':'disabled'} style="${allOk&&medRegOk?'':'opacity:.5;cursor:not-allowed'}">${ic('check',15)} Approve & publish</button></div>`:''}
    ${a.status==='approved'&&a.providerId?`<button class="btn btn-o btn-s mt16" data-a="viewNew" data-id="${a.providerId}">View live listing</button>`:''}
  </div>`;
}
A.docOk = el => { const a = S.applications.find(x=>x.id===el.dataset.id); a.docs[+el.dataset.i].ok = el.checked; save(); go('apps', {id:a.id}, true); };
A.appDecide = el => { const a = S.applications.find(x=>x.id===el.dataset.id); const note = $('#appNote').value.trim(); if (!note){ toast('Add a note for the applicant first'); $('#appNote').focus(); return; } a.status = el.dataset.x; a.notes.push({date:TODAY(), text:note}); save(); go('apps', {id:a.id}, true); toast(el.dataset.x==='info'?'Information requested':'Application declined'); };
A.appApprove = el => {
  const a = S.applications.find(x=>x.id===el.dataset.id);
  const pid = 'p' + (S.providers.length + 1) + uid('').toLowerCase();
  const date = new Date().toLocaleString('en-GB',{month:'short', year:'numeric'});
  S.providers.push({id:pid, name:a.name, type:a.type, area:a.area, address:a.address || `${a.area}, Thiruvananthapuram`, art: hash(a.name)%PAL.length,
    tagline: a.lead.scope || a.lead.role, about:`${a.name} has joined AESTHEVA in ${a.area}. ${a.medical?'Medical services are delivered by a registered practitioner after assessment.':'Non-medical beauty and wellness services.'}`,
    amenities:['Card & UPI'], hours:'Mon–Sat · 10:00–19:00', medical:a.medical, active:true, isNew:true,
    verification:[...new Set(a.docs.map(d=>scopeLabel(d.name)))].map(l=>({label:l, scope: l.startsWith('Practitioner')? (a.lead.reg||a.lead.scope) : l.startsWith('Professional cert') ? (a.lead.scope||'As listed') : 'Documents as submitted', date}))});
  const sid = 's' + uid('');
  S.staff.push({id:sid, providerId:pid, name:a.lead.name, role:a.lead.role, medical:a.medical, quals:[a.lead.scope||a.lead.role], reg:a.lead.reg, years:5, langs:['Malayalam','English'], bio:`Lead practitioner at ${a.name}.`, avail:{days:[1,2,3,4,5,6], start:'10:00', end:'19:00'}});
  (a.services.length ? a.services : [{name:'Introductory consultation', cat:'skin', kind:a.medical?'consult':'beauty', dur:30, price:800, deposit:200}]).forEach(s => S.services.push({id:uid('v'), providerId:pid, name:s.name, cat:s.cat||'skin', kind:s.kind, dur:+s.dur||45, price:+s.price||1000, deposit:s.deposit ?? Math.round((+s.price||1000)*.2/50)*50, staff:[sid], desc: s.kind==='beauty'?'Non-medical service.':'Medical service — suitability decided at assessment.', active:true}));
  a.status = 'approved'; a.providerId = pid; a.notes.push({date:TODAY(), text:'Approved and published · verification labels issued by scope.'});
  S.cities.find(c=>c.id==='tvm').providers++;
  save(); go('apps', {id:a.id}, true); toast(`${a.name} is live on the marketplace`);
};

/* ---------- bookings & commission ---------- */
AV.bookings = () => {
  const days = S.ui.abDays || 30; const t = TODAY(); const from = addDays(t, -days);
  const bk = S.bookings.filter(b => b.date>=from && b.date<=t);
  const nonCanc = bk.filter(b=>b.status!=='cancelled');
  const gmv = nonCanc.reduce((a,b)=>a+b.price,0);
  const mk = bk.filter(b=>b.source==='marketplace');
  const comm = mk.filter(b=>b.status==='completed').reduce((a,b)=>a+b.price*COMMISSION,0);
  const canc = bk.filter(b=>b.status==='cancelled').length;
  const rows = S.providers.map(p => { const pb = bk.filter(b=>b.providerId===p.id); const pm = pb.filter(b=>b.source==='marketplace'); return {p, n:pb.length, gmv:pb.filter(b=>b.status!=='cancelled').reduce((a,b)=>a+b.price,0), mshare: pb.length? pm.length/pb.length : 0, comm: pm.filter(b=>b.status==='completed').reduce((a,b)=>a+b.price*COMMISSION,0), canc: pb.filter(b=>b.status==='cancelled').length}; }).sort((a,b)=>b.gmv-a.gmv);
  const areas = D.AREAS.map(a => ({a, v: nonCanc.filter(b=>prov(b.providerId).area===a).reduce((x,b)=>x+b.price,0)})); const amx = Math.max(...areas.map(x=>x.v),1);
  const medShare = nonCanc.length ? nonCanc.filter(b=>b.kind!=='beauty').length / nonCanc.length : 0;
  const sf = S.ui.abStatus || 'all';
  const recent = S.bookings.filter(b => b.date<=addDays(t,14) && (sf==='all' || b.status===sf)).sort((a,b)=>(b.created||b.date).localeCompare(a.created||a.date) || (b.date+b.time).localeCompare(a.date+a.time)).slice(0,12);
  return `<div class="ws-head"><div><div class="eyebrow">Thiruvananthapuram · sample data</div><h2 class="mt8">Bookings & commission</h2></div>
    <div class="modes" style="padding:2px">${[7,30,90].map(n=>`<button class="${days===n?'on':''}" data-a="abDays" data-n="${n}">${n} days</button>`).join('')}</div></div>
  <div class="grid g4 kpis">
    <div class="kpi feature"><div class="l">Gross booking value</div><div class="v">${inr(gmv)}</div><div class="d">${nonCanc.length} bookings · ${days} days</div></div>
    <div class="kpi"><div class="l">Commission earned</div><div class="v">${inr(comm)}</div><div class="d muted">${COMMISSION*100}% on completed marketplace bookings</div></div>
    <div class="kpi"><div class="l">Marketplace share</div><div class="v">${bk.length?Math.round(mk.length/bk.length*100):0}%</div><div class="d muted">of all bookings on AESTHEVA calendars</div></div>
    <div class="kpi"><div class="l">Cancellation rate</div><div class="v">${bk.length?Math.round(canc/bk.length*100):0}%</div><div class="d muted">${Math.round(medShare*100)}% of bookings are medical</div></div>
  </div>
  <div class="grid mt24" style="grid-template-columns:minmax(0,1.6fr) minmax(0,1fr)">
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Provider</th><th>Bookings</th><th>GBV</th><th>Marketplace</th><th>Commission</th><th>Cancelled</th></tr></thead><tbody>${rows.map(r=>`<tr><td><b class="small">${esc(r.p.name)}</b><div class="xs muted">${esc(r.p.area)}${r.p.isNew?' · new':''}</div></td><td>${r.n}</td><td>${inr(r.gmv)}</td><td>${Math.round(r.mshare*100)}%</td><td>${inr(r.comm)}</td><td>${r.canc}</td></tr>`).join('')}</tbody></table></div>
    <div class="card"><h4>Booking value by neighbourhood</h4>${areas.map(x=>`<div class="mt16"><div class="row between small"><span>${x.a}</span><b>${inr(x.v)}</b></div><div class="bar-track mt8"><div class="bar-fill" style="width:${x.v/amx*100}%"></div></div></div>`).join('')}</div>
  </div>
  <div class="row between wrap mt48"><h3>Recent bookings</h3><select class="in" style="width:auto" data-ch="abStatus" aria-label="Status filter">${['all','confirmed','completed','cancelled','no-show'].map(s=>`<option value="${s}" ${sf===s?'selected':''}>${s==='all'?'All statuses':s}</option>`).join('')}</select></div>
  <div class="tbl-wrap mt16"><table class="tbl"><thead><tr><th>Ref</th><th>Appointment</th><th>Provider</th><th>Service</th><th>Channel</th><th>Value</th><th>Commission</th><th>Status</th></tr></thead><tbody>${recent.map(b=>`<tr><td class="small muted">${b.ref}</td><td class="small">${fmtDate(b.date)} ${fmtT(b.time)}</td><td class="small">${esc(prov(b.providerId).name)}</td><td class="small">${esc(b.serviceName)} ${b.kind!=='beauty'?'<span class="badge b-med" style="font-size:10px;padding:1px 6px">Med</span>':''}</td><td class="small">${b.source==='marketplace'?'Marketplace':'Direct'}</td><td>${inr(b.price)}</td><td class="muted">${b.source==='marketplace'&&b.status==='completed'?inr(b.price*COMMISSION):'—'}</td><td>${statusBadge(b.status)}</td></tr>`).join('')}</tbody></table></div>`;
};
A.abDays = el => { S.ui.abDays = +el.dataset.n; render(); };
A.abStatus = el => { S.ui.abStatus = el.value; render(); };

/* ---------- complaints & refunds ---------- */
const tkBadge = s => ({open:'<span class="badge b-warn">Open</span>', escalated:'<span class="badge b-err">Escalated</span>', resolved:'<span class="badge b-ok">Resolved</span>'}[s]);
AV.tickets = ({id}) => {
  const f = S.ui.tkF || 'active';
  const list = S.tickets.filter(t => f==='all' || (f==='active' ? t.status!=='resolved' : t.type===f));
  const sel = S.tickets.find(t=>t.id===id) || list[0];
  const openRefunds = S.tickets.filter(t=>t.type==='refund' && t.status!=='resolved');
  return `<div class="ws-head"><div><div class="eyebrow">Customer care</div><h2 class="mt8">Complaints & refunds</h2></div><span class="small muted">${openRefunds.length} refund request${openRefunds.length===1?'':'s'} awaiting decision · ${inr(openRefunds.reduce((a,t)=>a+t.amount,0))}</span></div>
  <div class="chips" style="margin-bottom:16px">${[['active','Needs action'],['refund','Refunds'],['complaint','Complaints'],['all','All']].map(([k,l])=>`<button class="chip ${f===k?'on':''}" data-a="tkF" data-f="${k}">${l}</button>`).join('')}</div>
  <div class="grid" style="grid-template-columns:minmax(0,.85fr) minmax(0,1.4fr);align-items:start">
    <div class="col" style="gap:10px">${list.length?list.map(t=>`<button class="app-item ${sel&&sel.id===t.id?'on':''}" ${goAttr('tickets',{id:t.id})}><div class="avatar" style="width:40px;height:40px;background:${t.type==='refund'?'var(--blush)':'var(--sage)'};color:${t.type==='refund'?'var(--mulberry)':'var(--sage-d)'}">${ic(t.type==='refund'?'wallet':'inbox',18)}</div><div class="grow col" style="gap:2px"><b class="small">${t.id} · ${t.type==='refund'?'Refund request':'Complaint'}</b><span class="xs muted">${esc(t.customer)} · ${esc(prov(t.providerId).name)}</span><div class="row" style="gap:6px;margin-top:4px">${tkBadge(t.status)}${t.amount?`<span class="badge b-plain">${inr(t.amount)}</span>`:''}</div></div></button>`).join(''):'<div class="card"><p class="small muted">Nothing needs action. 🎉</p></div>'}</div>
    <div>${sel?tkDetail(sel):''}</div></div>`;
};
A.tkF = el => { S.ui.tkF = el.dataset.f; save(); go('tickets', {}, true); };
function tkDetail(t){
  const b = t.bookingId && S.bookings.find(x=>x.id===t.bookingId); const open = t.status!=='resolved';
  return `<div class="card"><div class="row between wrap"><div><div class="eyebrow">${t.id} · opened ${fmtDate(t.created)}</div><h3 class="mt8">${t.type==='refund'?'Refund request':'Complaint'} — ${esc(t.service)}</h3></div>${tkBadge(t.status)}</div>
    <div class="summary mt16"><div class="line"><span class="muted">Customer</span><span>${esc(t.customer)}</span></div><div class="line"><span class="muted">Provider</span><span>${esc(prov(t.providerId).name)}</span></div>${t.amount?`<div class="line"><span class="muted">Amount at stake</span><b>${inr(t.amount)}</b></div>`:''}${b?`<div class="line"><span class="muted">Booking</span><span>${b.ref} · ${fmtDate(b.date)} ${fmtT(b.time)}</span></div>`:''}</div>
    <div class="note n-plain mt16">${ic('info',16)}<div>${esc(t.reason)}</div></div>
    ${t.type==='refund'?`<div class="note n-sage mt12">${ic('shield',16)}<div>Policy: full refund if cancelled 24h+ before, or if the provider cancels. Late cancellations are at Operations' discretion; approved refunds are deducted from the provider's next settlement only when the provider is at fault.</div></div>`:''}
    <h4 class="mt24">Activity</h4>${t.notes.length?t.notes.map(n=>`<div class="xs mt8"><b>${fmtDate(n.date)}</b> — ${esc(n.text)}</div>`).join(''):'<p class="xs muted mt8">No activity yet.</p>'}
    ${open?`<textarea class="in mt12" id="tkNote" placeholder="Internal note or message to customer" maxlength="300"></textarea>
    <div class="row wrap mt16" style="justify-content:flex-end;gap:8px"><button class="btn btn-o btn-s" data-a="tkNoteAdd" data-id="${t.id}">Add note</button>${t.status!=='escalated'?`<button class="btn btn-o btn-s" data-a="tkSet" data-id="${t.id}" data-x="escalated">Escalate</button>`:''}
      ${t.type==='refund'?`<button class="btn btn-d btn-s" data-a="tkRefund" data-id="${t.id}" data-x="declined">Decline refund</button><button class="btn btn-ok btn-s" data-a="tkRefund" data-id="${t.id}" data-x="refunded">${ic('check',15)} Approve ${inr(t.amount)} refund</button>`:`<button class="btn btn-ok btn-s" data-a="tkSet" data-id="${t.id}" data-x="resolved">${ic('check',15)} Mark resolved</button>`}</div>`:''}
  </div>`;
}
const tkNote = (t, txt) => { const v = $('#tkNote') && $('#tkNote').value.trim(); t.notes.push({date:TODAY(), text: v ? `${txt} — ${v}` : txt}); };
A.tkNoteAdd = el => { const t = S.tickets.find(x=>x.id===el.dataset.id); const v = $('#tkNote').value.trim(); if (!v){ toast('Write a note first'); return; } t.notes.push({date:TODAY(), text:v}); save(); go('tickets',{id:t.id},true); };
A.tkSet = el => { const t = S.tickets.find(x=>x.id===el.dataset.id); t.status = el.dataset.x; tkNote(t, el.dataset.x==='resolved'?'Marked resolved':'Escalated to senior review'); save(); go('tickets',{id:t.id},true); toast(`${t.id} ${el.dataset.x}`); };
A.tkRefund = el => { const t = S.tickets.find(x=>x.id===el.dataset.id); const ok = el.dataset.x==='refunded'; t.status = 'resolved'; tkNote(t, ok?`Refund of ${inr(t.amount)} approved (simulated)`:'Refund declined under late-cancellation policy');
  const b = t.bookingId && S.bookings.find(x=>x.id===t.bookingId); if (b) b.refund = {status: ok?'refunded':'declined', amount:t.amount, ticket:t.id};
  save(); go('tickets',{id:t.id},true); toast(ok?'Refund approved · customer notified (simulated)':'Refund declined · customer notified (simulated)'); };

/* ---------- city expansion ---------- */
AV.cities = () => {
  const tvmBk = S.bookings.filter(b=>b.date>=addDays(TODAY(),-30) && b.date<=TODAY() && b.status!=='cancelled');
  const phases = ['Phase 1 · Trivandrum','Phase 2 · Kerala','Phase 3 · India'];
  const phaseOn = i => S.cities.filter(c=>c.phase===phases[i]).some(c=>c.status!=='planned');
  const ready = c => { const k = Object.values(c.checks); return Math.round(k.filter(Boolean).length/k.length*100); };
  return `<div class="ws-head"><div><div class="eyebrow">Growth</div><h2 class="mt8">City expansion</h2></div><span class="small muted">Trivandrum first, then Kerala, then India</span></div>
  <div class="card"><div class="phase-line">${phases.map((p,i)=>`<div class="phase ${phaseOn(i)?'on':''}">${p}</div>`).join('')}</div>
    <div class="grid g4 kpis"><div class="kpi feature"><div class="l">Live providers · TVM</div><div class="v">${S.providers.filter(p=>p.active).length}</div><div class="d">across ${D.AREAS.length} neighbourhoods</div></div><div class="kpi"><div class="l">Bookings · 30 days</div><div class="v">${tvmBk.length}</div><div class="d muted">${inr(tvmBk.reduce((a,b)=>a+b.price,0))} GBV</div></div><div class="kpi"><div class="l">Pipeline</div><div class="v">${S.applications.filter(a=>['pending','info'].includes(a.status)).length}</div><div class="d muted">applications in review</div></div><div class="kpi"><div class="l">Waitlist · other cities</div><div class="v">${S.cities.filter(c=>c.id!=='tvm').reduce((a,c)=>a+c.waitlist,0)}</div><div class="d muted">consumers & providers</div></div></div></div>
  ${phases.map(ph=>`<h3 class="mt48">${ph}</h3><div class="grid g3 mt16">${S.cities.filter(c=>c.phase===ph).map(c=>`<div class="city ${c.status==='active'?'active':''}">
    <div class="row between"><h3>${esc(c.name)}</h3><select class="in" style="width:auto;padding:6px 10px;font-size:13px" data-ch="cityStatus" data-id="${c.id}" aria-label="Status">${['planned','pilot','active'].map(s=>`<option value="${s}" ${c.status===s?'selected':''}>${s[0].toUpperCase()+s.slice(1)}</option>`).join('')}</select></div>
    <div class="small muted">${esc(c.target)}${c.id==='tvm'?` · ${S.providers.filter(p=>p.active).length} live providers`:''}</div>
    ${c.id==='tvm'?`<div class="row wrap" style="gap:6px">${D.AREAS.map(a=>`<span class="badge" style="background:rgba(255,255,255,.16);color:#fff">${a}</span>`).join('')}</div>`:`
    <div><div class="row between small"><span>Launch readiness</span><b>${ready(c)}%</b></div><div class="bar-track mt8"><div class="bar-fill" style="width:${ready(c)}%"></div></div></div>
    <div class="col" style="gap:4px">${Object.entries(c.checks).map(([k,v])=>`<label class="check small"><input type="checkbox" ${v?'checked':''} data-ch="cityCheck" data-id="${c.id}" data-k="${esc(k)}"> ${esc(k)}</label>`).join('')}</div>
    <div class="row between small"><span class="muted">Waitlist</span><b>${c.waitlist}</b></div><div class="row between small"><span class="muted">Search demand index</span><b>${c.demand}</b></div>`}
  </div>`).join('')}</div>`).join('')}`;
};
A.cityStatus = el => { const c = S.cities.find(x=>x.id===el.dataset.id); if (el.value==='active' && c.id!=='tvm' && Object.values(c.checks).some(v=>!v)){ toast('Complete every readiness check before going active'); render(); return; } c.status = el.value; save(); render(); toast(`${c.name} set to ${el.value}`); };
A.cityCheck = el => { const c = S.cities.find(x=>x.id===el.dataset.id); c.checks[el.dataset.k] = el.checked; save(); render(); };
