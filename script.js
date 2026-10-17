// ---- Logo direction: 'a' (default), 'b' or 'c'. Override with ?logo=b
const LOGO = new URLSearchParams(location.search).get('logo') || 'd2';
document.querySelectorAll('img[data-logo]').forEach(img => {
  img.src = `assets/logo-${LOGO}${img.dataset.logo === 'reversed' ? '-reversed' : ''}.svg`;
});
// Header colour mocks (?header=green|green-signal|blue|clay)
// Default header is clay with the ink logo and white visor. ?header=none shows the plain paper header.
const HEADER = new URLSearchParams(location.search).get('header') || 'clay';
const topLogo = document.querySelector('.nav img[data-logo]');
if (HEADER === 'none' || LOGO !== 'd2') { delete document.body.dataset.header; }
else { document.body.dataset.header = HEADER; if (topLogo) topLogo.src = `assets/logo-d2-on-${HEADER}.svg`; }
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
