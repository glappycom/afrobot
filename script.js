// ---- Logo: E1 "Glow" is official. Archived directions: ?logo=d2|a|b|c
const LOGO = new URLSearchParams(location.search).get('logo') || 'e1';
document.querySelectorAll('img[data-logo]').forEach(img => {
  img.src = `assets/logo-${LOGO}${img.dataset.logo === 'reversed' ? '-reversed' : ''}.svg`;
});
// Accent preview: ?accent=blue swaps every clay accent for Cobalt #1E4BD2 (default stays clay)
if (new URLSearchParams(location.search).get('accent') === 'blue') document.documentElement.dataset.accent = 'blue';
// Header: bone with a thin clay rule (no full clay backgrounds; clay is accent only). ?header=none = plain paper header.
const HQ = new URLSearchParams(location.search).get('header');
const HEADER = HQ === 'none' ? 'none' : 'bone';
const topLogo = document.querySelector('.nav img[data-logo]');
// E1: the ink logo (white face, ink eyes) works on every header colour; the footer (ink) uses the reversed logo.
if (HEADER === 'none' || !['d2', 'e1'].includes(LOGO)) { delete document.body.dataset.header; }
else { document.body.dataset.header = HEADER; if (topLogo) topLogo.src = LOGO === 'e1' ? 'assets/logo-e1.svg' : `assets/logo-d2-on-${HEADER}.svg`; }
const fav = document.querySelector('[data-logo-favicon]'); if (fav) fav.href = `assets/favicon-${LOGO}.svg`;

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
