// Aestheva booking flow: service → practitioner → date & time → details → deposit.
// Reads the provider's services and team from #bk-data, live slots from /api/slots, and takes the deposit with
// Razorpay Checkout (or the simulated gateway in development). Also powers "Pay deposit" on a held booking's page.
(() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const inr = (p) => '₹' + (p / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dParts = (iso) => { const d = new Date(iso + 'T00:00:00Z'); return { dow: DOW[d.getUTCDay()], day: d.getUTCDate(), mon: MON[d.getUTCMonth()], long: `${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getUTCDay()]}, ${d.getUTCDate()} ${MON[d.getUTCMonth()]}` }; };
  const isMed = (s) => s.kind === 'consult' || s.kind === 'treatment';
  const kindBadge = (s) => s.kind === 'beauty' ? '<span class="badge b-beauty">Beauty &amp; wellness</span>' : s.kind === 'consult' ? '<span class="badge b-med">Medical consultation</span>' : '<span class="badge b-med">Medical · prior assessment required</span>';
  const errBox = (m) => `<div class="form-error mt16" role="alert">${esc(m)}</div>`;

  async function post(url, body) {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Something went wrong. Please try again.');
    return j;
  }

  // ---------- payment (shared by the booking flow and the held-booking page) ----------
  function pay(res, mount, onError) {
    const p = res.payment;
    if (p.gateway === 'simulated') {
      mount.innerHTML = `<div class="devpay"><b>Test payment</b><p class="small muted mt8">This environment has no Razorpay keys, so the deposit is simulated. No money moves.</p>
        <button class="btn btn-p mt16" type="button" id="sim-pay">Simulate a successful ${inr(p.amount)} payment</button></div>`;
      mount.querySelector('#sim-pay').addEventListener('click', async (e) => {
        e.target.disabled = true; e.target.textContent = 'Confirming…';
        try { const t = new URL(res.manageUrl).searchParams.get('t'); await post(`/api/bookings/${res.ref}/simulate-payment`, { token: t, orderId: p.orderId }); location.href = res.manageUrl; }
        catch (err) { e.target.disabled = false; e.target.textContent = 'Try again'; onError(err.message); }
      });
      return;
    }
    if (typeof window.Razorpay !== 'function') { onError('The payment window could not load. Check your connection and try again.'); return; }
    const rzp = new window.Razorpay({
      key: p.keyId, amount: p.amount, currency: p.currency, name: p.name, description: p.description, order_id: p.orderId,
      prefill: p.prefill, notes: { booking_ref: res.ref }, theme: { color: '#713F54' },
      handler: async (r) => {
        mount.innerHTML = '<p class="small muted">Confirming your payment…</p>';
        try { await post(`/api/bookings/${res.ref}/payment`, r); location.href = res.manageUrl; }
        catch (err) { onError(`${err.message} If money left your account, your booking will confirm automatically within a few minutes. Your booking page: ${res.manageUrl}`); }
      },
      modal: { ondismiss: () => onError('Payment was not completed. Your time is held for a few minutes; you can try again.') },
    });
    rzp.on('payment.failed', (r) => onError(r?.error?.description || 'The payment failed. Please try another method.'));
    rzp.open();
  }

  // ---------- held booking page ----------
  const resume = document.getElementById('resume-data');
  if (resume) {
    const res = JSON.parse(resume.textContent), mount = document.getElementById('resume-pay');
    const show = () => { mount.innerHTML = `<button class="btn btn-p" type="button" id="resume-btn">Pay ${inr(res.payment.amount)} deposit</button><div id="resume-err"></div>`;
      mount.querySelector('#resume-btn').addEventListener('click', () => pay(res, res.payment.gateway === 'simulated' ? mount : mount.querySelector('#resume-err'), (m) => { show(); mount.querySelector('#resume-err').innerHTML = errBox(m); })); };
    show();
  }

  // ---------- booking flow ----------
  const dataEl = document.getElementById('bk-data');
  if (!dataEl) return;
  const D = JSON.parse(dataEl.textContent);
  const main = document.getElementById('bk-main'), summary = document.getElementById('bk-summary'), steps = document.getElementById('bk-steps');
  const staffById = Object.fromEntries(D.staff.map((s) => [s.id, s]));
  const MED_NOTE = document.getElementById('tpl-med').innerHTML;
  const F = { svc: null, staff: null, date: null, slot: null, details: { name: '', phone: '', email: '', note: '', ackMed: false, ackTreat: false }, step: 1, days: null, error: '' };
  const svcOf = (id) => D.services.find((s) => s.id === id);

  function chooseService(id) {
    F.svc = svcOf(id); F.staff = F.svc.staff.length === 1 ? F.svc.staff[0] : null; F.date = null; F.slot = null; F.days = null;
    F.step = F.staff ? 3 : 2;
  }
  if (D.preselect) chooseService(D.preselect);

  const stepTxt = document.getElementById('bk-steptxt'), stepFill = document.getElementById('bk-stepfill');
  function renderSteps() {
    [...steps.children].forEach((li, i) => { const n = i + 1; li.className = 'st ' + (F.step === n ? 'on' : F.step > n ? 'done' : ''); li.querySelector('i').textContent = F.step > n ? '✓' : n; li.toggleAttribute('aria-current', F.step === n); });
    const total = steps.children.length;
    if (stepTxt) stepTxt.textContent = `Step ${F.step} of ${total} · ${steps.children[F.step - 1].lastChild.textContent}`;
    if (stepFill) stepFill.style.width = `${(F.step / total) * 100}%`;
  }
  function renderSummary() {
    const head = summary.querySelector('.divider');
    while (head.nextSibling) head.nextSibling.remove();
    const s = F.svc;
    const who = F.slot ? staffById[F.slot.staffId] : F.staff && F.staff !== 'any' ? staffById[F.staff] : null;
    head.insertAdjacentHTML('afterend', s ? `<div class="line"><span>${esc(s.name)}<div class="xs muted">${s.dur} min${who ? ' · ' + esc(who.name) : F.staff === 'any' ? ' · any practitioner' : ''}</div></span><b>${inr(s.price)}</b></div>
      ${F.date && F.slot ? `<div class="line small muted"><span>${dParts(F.date).long}</span><span>${esc(F.slot.label)}</span></div>` : ''}
      <div class="line tot"><span>Due now (deposit)</span><span>${inr(s.deposit)}</span></div><div class="line small muted"><span>Pay at the venue</span><span>${inr(s.price - s.deposit)}</span></div>
      <div class="mt8">${kindBadge(s)}</div>` : '<p class="small muted">Select a service to see pricing.</p>');
  }
  const nav = (canNext) => `<div class="row between mt32">${F.step > 1 ? '<button class="btn btn-o" type="button" data-act="back">Back</button>' : '<span></span>'}<button class="btn btn-p" type="button" data-act="next" ${canNext ? '' : 'disabled'}>Continue</button></div>`;

  async function loadDays() {
    const today = new Date(Date.now() + 330 * 6e4).toISOString().slice(0, 10);
    const r = await fetch(`/api/slots?service=${encodeURIComponent(F.svc.id)}&staff=${encodeURIComponent(F.staff)}&from=${today}&days=14${D.preview ? '&preview=' + encodeURIComponent(D.preview) : ''}`);
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Could not load availability');
    F.days = j.days;
    if (!F.date || !F.days.some((d) => d.date === F.date && d.slots.length)) F.date = (F.days.find((d) => d.slots.length) || F.days[0]).date;
  }

  function render() {
    renderSteps(); renderSummary();
    const s = F.svc;
    let html = '';
    if (F.step === 1) {
      const opt = (x) => `<button type="button" class="opt ${s && s.id === x.id ? 'on' : ''}" role="radio" aria-checked="${s && s.id === x.id}" data-act="svc" data-id="${esc(x.id)}"><div class="col" style="gap:4px;text-align:left"><b>${esc(x.name)}</b><div class="row wrap" style="gap:8px">${kindBadge(x)}<span class="xs muted">${x.dur} min${x.deposit ? ' · ' + inr(x.deposit) + ' deposit' : ''}</span></div></div><b>${inr(x.price)}</b></button>`;
      const groups = (D.categories || []).map((c) => [c.name, D.services.filter((x) => x.cat === c.id)]).filter(([, xs]) => xs.length);
      const known = new Set((D.categories || []).map((c) => c.id)), rest = D.services.filter((x) => !known.has(x.cat));
      if (rest.length || !groups.length) groups.push([groups.length ? 'Other' : '', rest.length ? rest : D.services]);
      html = `<h2>Choose a treatment</h2><p class="muted mt8">Prices are in full. ${D.services.some((x) => x.deposit) ? 'Where there\'s a deposit, it counts towards your bill.' : ''}</p>${D.services.some(isMed) ? `<div class="mt16">${MED_NOTE}</div>` : ''}<div role="radiogroup" aria-label="Treatments">${groups.map(([name, xs]) => `${name && groups.length > 1 ? `<p class="grp-h">${esc(name)}</p>` : '<div class="mt16"></div>'}<div class="col" style="gap:10px">${xs.map(opt).join('')}</div>`).join('')}</div>${nav(!!s)}`;
    }
    if (F.step === 2) {
      html = `<h2>Choose a practitioner</h2><p class="muted mt8">${esc(s.name)} is offered by ${s.staff.length} team members.</p><div class="col mt16" style="gap:10px" role="radiogroup" aria-label="Practitioner">
        <button type="button" class="opt ${F.staff === 'any' ? 'on' : ''}" role="radio" aria-checked="${F.staff === 'any'}" data-act="staff" data-id="any"><div class="col" style="text-align:left"><b>Any available practitioner</b><div class="small muted">The most times to choose from</div></div></button>
        ${s.staff.map((id) => { const t = staffById[id]; return `<button type="button" class="opt ${F.staff === id ? 'on' : ''}" role="radio" aria-checked="${F.staff === id}" data-act="staff" data-id="${esc(id)}"><div class="col" style="text-align:left;gap:2px"><b>${esc(t.name)}</b><div class="small muted">${esc(t.role)}</div>${t.quals ? `<div class="xs soft">${esc(t.quals)}</div>` : ''}</div><span class="badge ${t.medical ? 'b-med' : 'b-beauty'}">${t.medical ? 'Registered' : 'Certified'}</span></button>`; }).join('')}</div>${nav(!!F.staff)}`;
    }
    if (F.step === 3) {
      if (!F.days) { main.innerHTML = '<h2>Pick a date &amp; time</h2><p class="muted mt16">Loading availability…</p>'; loadDays().then(render, (e) => { main.innerHTML = `<h2>Pick a date &amp; time</h2>${errBox(e.message)}${nav(false)}`; }); return; }
      const day = F.days.find((d) => d.date === F.date);
      const parts = [['Morning', 0, 720], ['Afternoon', 720, 1020], ['Evening', 1020, 1440]];
      html = `<h2>Pick a date &amp; time</h2><p class="muted mt8">${esc(s.name)} · ${s.dur} min · ${F.staff === 'any' ? 'any available practitioner' : 'with ' + esc(staffById[F.staff].name)}</p>
        <div class="dates mt24" role="radiogroup" aria-label="Date">${F.days.map((d, i) => { const p = dParts(d.date); return `<button type="button" class="date ${F.date === d.date ? 'on' : ''}" ${d.slots.length ? '' : 'disabled'} role="radio" aria-checked="${F.date === d.date}" aria-label="${p.long}${d.slots.length ? '' : ', fully booked'}" data-act="date" data-d="${d.date}"><span>${i === 0 ? 'Today' : p.dow}</span><b>${p.day}</b><span>${p.mon}</span></button>`; }).join('')}</div>
        <p class="small mt16"><b>${dParts(F.date).long}</b></p>
        ${day && day.slots.length ? parts.map(([lbl, a, b]) => { const xs = day.slots.filter((x) => x.min >= a && x.min < b); return xs.length ? `<p class="xs muted mt16" style="text-transform:uppercase;letter-spacing:.1em;font-weight:700">${lbl}</p><div class="slots mt8">${xs.map((x) => `<button type="button" class="slot ${F.slot && F.slot.min === x.min ? 'on' : ''}" data-act="slot" data-min="${x.min}" data-staff="${esc(x.staffId)}" data-label="${esc(x.label)}">${esc(x.label)}</button>`).join('')}</div>` : ''; }).join('')
          : `<div class="note n-plain mt16">No times left on this day. Try another date.</div>`}
        ${F.error ? errBox(F.error) : ''}${nav(!!F.slot)}`;
    }
    if (F.step === 4) {
      const d = F.details;
      html = `<h2>Your details</h2><p class="muted mt8">We share these with ${esc(D.provider.name)} to manage your appointment.</p>
        <form class="col mt24" style="gap:16px" id="bk-form" novalidate>
          <div class="grid g2"><label class="f">Full name<input class="in" name="name" required autocomplete="name" value="${esc(d.name)}"></label><label class="f">Mobile number<input class="in" name="phone" required type="tel" inputmode="tel" autocomplete="tel" placeholder="98765 43210" value="${esc(d.phone)}"></label></div>
          <label class="f">Email<input class="in" type="email" name="email" required autocomplete="email" value="${esc(d.email)}"></label>
          <label class="f">Anything the clinic should know? <span class="hint">Optional, for example access needs. Please keep health details for your practitioner in person.</span><textarea class="in" name="note" maxlength="240">${esc(d.note)}</textarea></label>
          ${isMed(s) ? `<label class="check consent"><input type="checkbox" name="ackMed" required ${d.ackMed ? 'checked' : ''}> <span>${s.kind === 'consult' ? 'I understand this is a consultation with a registered practitioner, who will advise me on what suits me.' : 'I understand this is a medical treatment. My practitioner will first check it suits me, and may suggest a consultation or a different treatment instead.'}</span></label>` : ''}
          <div class="note n-plain"><div>Free cancellation up to ${D.freeCancelHours} hours before. Within ${D.freeCancelHours} hours the deposit is normally kept; you can ask for a review. <a href="/policies/cancellation" target="_blank" rel="noopener">Cancellation policy</a></div></div>
          ${F.error ? errBox(F.error) : ''}
          <div class="row between mt8"><button type="button" class="btn btn-o" data-act="back">Back</button><button class="btn btn-p" type="submit">Continue to ${s.deposit ? 'deposit' : 'confirm'}</button></div>
        </form>`;
    }
    if (F.step === 5) {
      const ok = D.gateway !== 'unavailable';
      html = `<h2>${s.deposit ? 'Hold your time with a deposit' : 'Confirm your booking'}</h2>
        <p class="muted mt8">${s.deposit ? `Pay ${inr(s.deposit)} now to confirm. The remaining ${inr(s.price - s.deposit)} is paid at the venue.` : 'No deposit is needed for this service.'}</p>
        <div class="card mt16 review-card"><b class="serif" style="font-size:20px">${esc(s.name)}</b>
          <dl class="kv mt12"><dt>When</dt><dd>${dParts(F.date).long} · ${esc(F.slot.label)}</dd><dt>With</dt><dd>${esc(staffById[F.slot.staffId].name)}, ${esc(staffById[F.slot.staffId].role)}</dd><dt>For</dt><dd>${esc(F.details.name)} · ${esc(F.details.phone)}<br>${esc(F.details.email)}</dd></dl></div>
        ${s.deposit ? `<p class="xs muted mt16">Payments are processed securely by Razorpay: UPI, cards, netbanking and wallets. We hold your time for ${D.holdMinutes} minutes while you pay.</p>` : ''}
        ${!ok && s.deposit ? errBox('Online payments are not available yet. Please try again later.') : ''}
        <div id="pay-mount" class="mt16"></div><div id="pay-err">${F.error ? errBox(F.error) : ''}</div>
        <div class="row between mt24"><button type="button" class="btn btn-o" data-act="back">Back</button><button type="button" class="btn btn-p" data-act="confirm" ${ok || !s.deposit ? '' : 'disabled'}>${s.deposit ? `Pay ${inr(s.deposit)} &amp; confirm` : 'Confirm booking'}</button></div>`;
    }
    main.innerHTML = html;
    const h = main.querySelector('h2'); if (h && document.activeElement && document.activeElement !== document.body && !main.contains(document.activeElement)) { h.tabIndex = -1; h.focus(); }
  }

  let created = null;   // the booking created in step 5, reused if the client retries payment
  main.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const act = el.dataset.act; F.error = '';
    if (act === 'svc') { chooseService(el.dataset.id); F.step = 1; render(); return; }
    if (act === 'staff') { F.staff = el.dataset.id; F.days = null; F.date = null; F.slot = null; render(); return; }
    if (act === 'date') { F.date = el.dataset.d; F.slot = null; render(); return; }
    if (act === 'slot') {
      F.slot = { min: +el.dataset.min, staffId: el.dataset.staff, label: el.dataset.label }; render();
      // On a phone the Continue button is below the fold once a time is picked; bring it into view.
      if (window.innerWidth < 760) main.querySelector('[data-act=next]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (act === 'back') {
      if (created && created.status === 'held') {   // release our own hold so a changed choice doesn't collide with it
        const t = new URL(created.manageUrl).searchParams.get('t');
        post(`/api/bookings/${created.ref}/cancel`, { token: t, reason: 'changed selection before paying' }).catch(() => {});
      }
      created = null;
      F.step = F.step === 3 && F.svc.staff.length === 1 ? 1 : F.step - 1; if (F.step === 3) F.days = null; render(); window.scrollTo(0, 0); return;
    }
    if (act === 'next') { F.step = F.step === 1 ? (F.svc.staff.length === 1 ? 3 : 2) : F.step + 1; render(); window.scrollTo(0, 0); return; }
    if (act === 'confirm') {
      el.disabled = true; el.textContent = 'Reserving your time…';
      const fail = (m) => { const box = document.getElementById('pay-err'); if (box) box.innerHTML = errBox(m); el.disabled = false; el.textContent = 'Try again'; };
      try {
        if (!created) created = await post('/api/bookings', { serviceId: F.svc.id, staffId: F.staff === 'any' ? 'any' : F.slot.staffId, date: F.date, start: F.slot.min, ...F.details, ackMedical: F.details.ackMed, ackTreatment: F.details.ackTreat, preview: D.preview || undefined });
        if (!created.payment) { location.href = created.manageUrl; return; }
        el.textContent = 'Waiting for payment…';
        pay(created, document.getElementById('pay-mount'), fail);
      } catch (err) {
        if (/no longer available|just taken/i.test(err.message)) { F.step = 3; F.days = null; F.slot = null; F.error = err.message; render(); return; }
        fail(err.message);
      }
    }
  });
  main.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target, d = F.details, s = F.svc;
    d.name = f.name.value.trim(); d.phone = f.phone.value.trim(); d.email = f.email.value.trim(); d.note = f.note.value.trim();
    // One consent covers both acknowledgements: its wording includes the prior-assessment requirement for treatments.
    d.ackMed = !!(f.ackMed && f.ackMed.checked); d.ackTreat = d.ackMed && s.kind === 'treatment';
    const digits = d.phone.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
    if (d.name.length < 2) F.error = 'Please enter your full name.';
    else if (!/^[6-9]\d{9}$/.test(digits)) F.error = 'Please enter a 10-digit Indian mobile number.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) F.error = 'Please enter a valid email address.';
    else if (f.ackMed && !d.ackMed) F.error = 'Please tick the box to confirm you understand this is a medical appointment.';
    else { F.error = ''; F.step = 5; }
    render(); if (!F.error) window.scrollTo(0, 0);
  });
  render();
})();
