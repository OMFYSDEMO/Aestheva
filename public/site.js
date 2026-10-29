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
