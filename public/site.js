// Small enhancements for server-rendered pages. Everything works without this file.
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-toggle]');
  if (t) { const el = document.getElementById(t.dataset.toggle); if (el) { el.classList.toggle('open'); t.setAttribute('aria-expanded', el.classList.contains('open')); } }
});
// Search filters submit as soon as a choice changes.
document.querySelectorAll('form[data-autosubmit] select, form[data-autosubmit] input[type=radio], form[data-autosubmit] input[type=checkbox]').forEach((el) => {
  el.addEventListener('change', () => el.form.requestSubmit ? el.form.requestSubmit() : el.form.submit());
});
// Application form: move focus to the list of answers to fix, so screen readers announce it.
document.getElementById('apply-errors')?.focus();
// Clinic calendar: open at the current time, or at the first appointment, instead of the top of the day.
(() => {
  const cal = document.querySelector('.cal2'), mark = cal && (cal.querySelector('.cal2-now') || cal.querySelector('.cal2-appt, .cal2-on'));
  if (mark) cal.scrollTop = Math.max(0, mark.offsetTop - 120);
})();
// "Near me": ask for the browser's location once, rounded to about a kilometre, and search from there.
document.querySelectorAll('[data-near]').forEach((btn) => {
  if (!navigator.geolocation) return;
  const form = btn.dataset.near ? document.getElementById(btn.dataset.near) : btn.closest('form');
  if (!form) return;
  btn.hidden = false;
  const status = btn.parentElement.querySelector('[data-near-status]') || form.querySelector('[data-near-status]');
  const say = (t) => { if (status) status.textContent = t; };
  btn.addEventListener('click', () => {
    say('Finding where you are…'); btn.disabled = true;
    navigator.geolocation.getCurrentPosition((pos) => {
      let near = form.querySelector('input[name=near]');
      if (!near) { near = document.createElement('input'); near.type = 'hidden'; near.name = 'near'; form.appendChild(near); }
      near.value = pos.coords.latitude.toFixed(2) + ',' + pos.coords.longitude.toFixed(2);
      const area = form.querySelector('select[name=area]'); if (area) area.value = '';
      form.submit();
    }, () => { btn.disabled = false; say('We couldn’t get your location. Choose your area from the list instead.'); }, { timeout: 10000, maximumAge: 600000 });
  });
});
document.querySelectorAll('form select[name=area]').forEach((sel) => sel.addEventListener('change', () => { const n = sel.form.querySelector('input[name=near]'); if (n && sel.value) n.value = ''; }));
// "Join free" pop-up for businesses: appears once a visitor has looked around (20 seconds, or a good way down the page),
// and stays away for two weeks after it's closed or used.
(() => {
  const pop = document.getElementById('join-pop');
  if (!pop) return;
  const KEY = 'ae-join-pop', WAIT = 14 * 864e5;
  let seen = 0; try { seen = Number(localStorage.getItem(KEY)) || 0; } catch {}
  if (Date.now() - seen < WAIT) return;
  const remember = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch {} };
  let shown = false;
  const show = () => { if (shown) return; shown = true; pop.hidden = false; requestAnimationFrame(() => pop.classList.add('in')); removeEventListener('scroll', onScroll); };
  const onScroll = () => { if (scrollY > Math.min(1400, (document.documentElement.scrollHeight - innerHeight) * 0.4)) show(); };
  setTimeout(show, 20000); addEventListener('scroll', onScroll, { passive: true });
  pop.querySelectorAll('[data-join-close]').forEach((b) => b.addEventListener('click', () => { remember(); pop.classList.remove('in'); setTimeout(() => { pop.hidden = true; }, 250); }));
  pop.querySelector('[data-join-go]')?.addEventListener('click', remember);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && shown && !pop.hidden) pop.querySelector('[data-join-close]').click(); });
})();
