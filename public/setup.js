// Clinic setup: resizes a chosen photo in the browser (400, 800 and 1500 px wide, plus a 1200×630 crop for link
// previews) and uploads the set. Re-drawing the image on a canvas also drops location and camera metadata.
(() => {
  const form = document.getElementById('photo-form');
  if (!form) return;
  const input = form.querySelector('input[type=file]'), status = document.getElementById('photo-status'), preview = document.getElementById('photo-preview');
  const say = (m, err) => { status.textContent = m; status.className = err ? 'form-error' : 'xs muted'; };
  const encode = (canvas, type, q) => new Promise((res) => canvas.toBlob((b) => res(b), type, q));
  async function variant(bmp, w, h, crop) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
    if (crop) { // cover-fit crop, centred
      const s = Math.max(w / bmp.width, h / bmp.height), sw = w / s, sh = h / s;
      g.drawImage(bmp, (bmp.width - sw) / 2, (bmp.height - sh) / 2, sw, sh, 0, 0, w, h);
      return encode(c, 'image/jpeg', 0.84);
    }
    g.drawImage(bmp, 0, 0, w, h);
    const webp = await encode(c, 'image/webp', 0.82);
    return webp && webp.type === 'image/webp' ? webp : encode(c, 'image/jpeg', 0.85);   // Safari can't make WebP
  }
  input.addEventListener('change', () => {
    const f = input.files[0]; if (!f) return;
    preview.innerHTML = ''; const img = document.createElement('img'); img.alt = ''; img.src = URL.createObjectURL(f); preview.append(img); preview.classList.remove('hide');
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = input.files[0], alt = form.alt.value.trim();
    if (!f) return say('Please choose a photo.', true);
    if (alt.length < 10) return say('Please describe the photo in a short sentence.', true);
    const btn = form.querySelector('button[type=submit]'); btn.disabled = true;
    try {
      say('Preparing your photo…');
      const bmp = await createImageBitmap(f);
      if (bmp.width < 600) throw new Error('That photo is quite small. Please choose one at least 600 pixels wide.');
      const fd = new FormData();
      fd.append('csrf', form.csrf.value); fd.append('alt', alt);
      for (const w of [400, 800, 1500]) { const ww = Math.min(w, bmp.width); fd.append('w' + w, await variant(bmp, ww, Math.round(bmp.height * ww / bmp.width)), 'w' + w); }
      fd.append('og', await variant(bmp, 1200, 630, true), 'og.jpg');
      say('Uploading…');
      const r = await fetch(form.action, { method: 'POST', body: fd, headers: { 'x-requested-with': 'fetch' } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'The upload didn\'t work. Please try again.');
      location.href = '/clinic/setup/photos?added=1';
    } catch (err) {
      say(err.message && !/decode|bitmap|source/i.test(err.message) ? err.message : 'That photo couldn\'t be read. Please try a JPEG or PNG.', true);
      btn.disabled = false;
    }
  });
})();
