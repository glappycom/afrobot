// ---- Logo: official lockup = H3 "Cutout" icon + "afrobot" wordmark (one solid colour: ink on light, bone on ink).
// Archived directions for comparison: ?logo=e1 (Space Grotesk lockup) | d2 | a | b | c
const Q = new URLSearchParams(location.search);
const LOGO = Q.get('logo') || 'afrobot';
// Accent preview: ?accent=blue swaps every clay accent for Cobalt #1E4BD2 (default stays clay)
const BLUE = Q.get('accent') === 'blue';
if (BLUE) document.documentElement.dataset.accent = 'blue';
// Background: steel is the default (set on <html> in index.html). ?bg=bone previews the previous warm bone/paper theme.
if (Q.get('bg') === 'bone') { delete document.documentElement.dataset.bg; const tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.content = '#F3EEE5'; }
const logoSrc = kind => LOGO === 'afrobot'
  ? `assets/logo-afrobot${kind === 'reversed' ? '-reversed' : ''}${BLUE ? '-blue' : ''}.svg`
  : `assets/logo-${LOGO}${kind === 'reversed' ? '-reversed' : ''}.svg`;
if (LOGO !== 'afrobot' || BLUE) document.querySelectorAll('img[data-logo]').forEach(img => { img.src = logoSrc(img.dataset.logo); });
// Header: bone with a thin clay rule (no full clay backgrounds; clay is accent only). ?header=none = plain paper header.
const HEADER = Q.get('header') === 'none' ? 'none' : 'bone';
const topLogo = document.querySelector('.nav img[data-logo]');
if (HEADER === 'none' || !['afrobot', 'e1', 'd2'].includes(LOGO)) { delete document.body.dataset.header; }
else { document.body.dataset.header = HEADER; if (topLogo && LOGO === 'd2') topLogo.src = `assets/logo-d2-on-${HEADER}.svg`; }
// Favicon is always the icon alone (H3 bone tile) unless an archived direction is previewed.
const fav = document.querySelector('[data-logo-favicon]'); if (fav && LOGO !== 'afrobot') fav.href = `assets/favicon-${LOGO}.svg`;

// ---- Countdown (proposed: Dallas Regional, Sat 22 Jan 2028, 9:00 AM CT)
(() => {
  const el = document.getElementById('countdown'); if (!el) return;
  const t = new Date(el.dataset.target).getTime(), q = k => el.querySelector(`[data-u="${k}"]`);
  const p = (n, l = 2) => String(n).padStart(l, '0');
  const tick = () => {
    const s = Math.max(0, Math.floor((t - Date.now()) / 1000));
    q('d').textContent = p(Math.floor(s / 86400), 3); q('h').textContent = p(Math.floor(s % 86400 / 3600));
    q('m').textContent = p(Math.floor(s % 3600 / 60)); q('s').textContent = p(s % 60);
  };
  tick(); setInterval(tick, 1000);
})();

// ---- Mobile nav
(() => {
  const b = document.querySelector('.nav__toggle'), n = document.querySelector('.nav');
  b.addEventListener('click', () => b.setAttribute('aria-expanded', n.classList.toggle('is-open')));
  document.querySelectorAll('.mnav a').forEach(a => a.addEventListener('click', () => { n.classList.remove('is-open'); b.setAttribute('aria-expanded', 'false'); }));
})();

// ---- Register interest form: posts to /api/interest (stored server-side), inline errors, success/error states
(() => {
  const f = document.getElementById('interest'); if (!f) return;
  const t0 = Date.now(), role = f.querySelector('#role'), kids = f.querySelector('#if-kids-wrap');
  const status = f.querySelector('#if-status'), btn = f.querySelector('button[type="submit"]');
  const KIDS = ['Parent/guardian', 'School/educator'];
  const syncKids = () => { kids.hidden = !KIDS.includes(role.value); };
  role.addEventListener('change', syncKids); syncKids();
  document.querySelectorAll('[data-sponsor]').forEach(a => a.addEventListener('click', () => { role.value = 'Sponsor/partner'; syncKids(); }));
  const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/;
  const fields = { name: f.elements.name, email: f.elements.email, role, city: f.elements.city, consent: f.elements.consent };
  const setErr = (k, msg) => {
    const el = fields[k], err = document.getElementById(el.getAttribute('aria-describedby'));
    if (msg) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
    if (err) err.textContent = msg || '';
  };
  const check = () => {
    const e = {};
    if (fields.name.value.trim().length < 2) e.name = 'Please enter your name.';
    if (!EMAIL.test(fields.email.value.trim())) e.email = 'Please enter a valid email address.';
    if (!role.value) e.role = 'Please choose the option that fits you best.';
    if (fields.city.value.trim().length < 2) e.city = 'Please enter your city and state.';
    if (!fields.consent.checked) e.consent = 'Please confirm we may contact you.';
    return e;
  };
  Object.entries(fields).forEach(([k, el]) => el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'blur', () => {
    if (el.getAttribute('aria-invalid')) setErr(k, check()[k]);
  }));
  const show = (msg, kind) => { status.textContent = msg; status.dataset.kind = kind; status.hidden = false; };
  f.addEventListener('submit', async ev => {
    ev.preventDefault();
    const errs = check(); Object.keys(fields).forEach(k => setErr(k, errs[k]));
    const first = Object.keys(fields).find(k => errs[k]);
    if (first) { fields[first].focus(); show('Please check the highlighted fields.', 'error'); return; }
    const d = Object.fromEntries(new FormData(f).entries());
    d.consent = fields.consent.checked; d.t = t0; d.page = location.href.split('#')[0];
    if (kids.hidden) d.kids = '';
    btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.textContent = 'Sending…'; status.hidden = true;
    try {
      const r = await fetch('/api/interest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(d) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) {
        f.classList.add('is-sent'); f.querySelector('.form__fields').hidden = true; btn.hidden = true;
        show('Thank you! You’re on the list. We’ll email you when Season 1 opens.', 'ok'); status.setAttribute('tabindex', '-1'); status.focus();
        return;
      }
      if (j.errors) { Object.keys(fields).forEach(k => setErr(k, j.errors[k])); show('Please check the highlighted fields.', 'error'); }
      else show('Sorry, something went wrong and your details weren’t sent. Please try again in a moment.', 'error');
    } catch { show('We couldn’t reach the server. Check your connection and try again.', 'error'); }
    btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = 'Keep me posted';
  });
})();

// ---- Restrained reveal
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).has('static')) return;
  const els = document.querySelectorAll('.section .grid > *, .sponsor .grid > *');
  els.forEach(e => e.classList.add('rv'));
  const io = new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }), { rootMargin: '0px 0px -8% 0px' });
  els.forEach(e => io.observe(e));
})();

// ---- Nav hairline on scroll
(() => { const n = document.querySelector('.nav'); const f = () => n.classList.toggle('is-scrolled', scrollY > 8); f(); addEventListener('scroll', f, { passive: true }); })();

// v5 font preview: ?font=poppins swaps headline face; default unchanged
const FONT = new URLSearchParams(location.search).get('font');
if (FONT) document.body.dataset.font = FONT;

// ---- v18: FAQ deep links open their answer (e.g. #safety, #faq-included)
(() => {
  const open = () => { const t = location.hash && document.querySelector(location.hash); if (t && t.tagName === 'DETAILS') t.open = true; };
  addEventListener('hashchange', open); open();
  document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', () => { const t = document.querySelector(a.getAttribute('href')); if (t && t.tagName === 'DETAILS') t.open = true; }));
})();

// ---- v18: sticky "Register interest" on small screens; hidden at the top (hero CTA visible) and near the form/footer
(() => {
  const btn = document.querySelector('.stickycta'); if (!btn) return;
  const heroCta = document.querySelector('.hero .actions'), stops = [document.getElementById('register'), document.querySelector('.footer')];
  const seen = new Map();
  const update = () => {
    const show = matchMedia('(max-width: 900px)').matches && !seen.get(heroCta) && !stops.some(s => seen.get(s)) && scrollY > 200;
    btn.classList.toggle('is-on', show); btn.setAttribute('aria-hidden', String(!show)); btn.tabIndex = show ? 0 : -1;
  };
  const io = new IntersectionObserver(es => { es.forEach(e => seen.set(e.target, e.isIntersecting)); update(); }, { rootMargin: '0px 0px 120px 0px' });
  [heroCta, ...stops].forEach(el => el && io.observe(el));
  addEventListener('scroll', update, { passive: true }); addEventListener('resize', update);
})();

// v25: founder photos lift on tap / keyboard press and settle on a second press (mouse uses :hover)
document.querySelectorAll('.founder__photo').forEach(btn => {
  btn.addEventListener('click', e => {
    if (e.pointerType === 'mouse') return;
    const on = btn.getAttribute('aria-pressed') !== 'true';
    document.querySelectorAll('.founder__photo[aria-pressed="true"]').forEach(b => b.setAttribute('aria-pressed', 'false'));
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  btn.addEventListener('blur', () => btn.setAttribute('aria-pressed', 'false'));
});

// Default hero is the background-removed McKinney group (v4 cut-out). Preview switch: ?hero=photo shows the full photo.
if (Q.get('hero') === 'photo') {
  const fig = document.querySelector('.photo--hero');
  if (fig) {
    fig.classList.remove('photo--cutout');
    const src = fig.querySelector('source'), img = fig.querySelector('img');
    if (src) src.srcset = 'assets/photos/mckinney-build-day-2024.webp?v=5';
    if (img) { img.src = 'assets/photos/mckinney-build-day-2024.jpg?v=5'; img.width = 1800; img.height = 1350; }
  }
}
