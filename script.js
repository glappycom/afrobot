// ---- Logo: official lockup = H3 "Cutout" icon + "afrobot" wordmark (one solid colour: ink on light, bone on ink).
// Archived directions for comparison: ?logo=e1 (Space Grotesk lockup) | d2 | a | b | c
const Q = new URLSearchParams(location.search);
const LOGO = Q.get('logo') || 'afrobot';
// Accent preview: ?accent=blue swaps every clay accent for Cobalt #1E4BD2 (default stays clay)
const BLUE = Q.get('accent') === 'blue';
if (BLUE) document.documentElement.dataset.accent = 'blue';
if (Q.get('bg') === 'steel') document.documentElement.dataset.bg = 'steel';   // preview: cool stainless-steel page (bone is the default)
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

// ---- Countdown (proposed: Dallas Regional, Sat 26 Jun 2027, 9:00 AM CT)
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

// ---- Placeholder form: nothing is sent
(() => {
  const f = document.getElementById('interest');
  f.addEventListener('submit', e => { e.preventDefault(); f.querySelector('.form__msg').hidden = false; });
  document.querySelectorAll('[data-sponsor]').forEach(a => a.addEventListener('click', () => { document.getElementById('role').value = 'Sponsor'; }));
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
