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

// ---- Countdown (proposed: DC/Maryland Regional, Sat 11 Dec 2027, 9:00 AM ET)
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
  const close = () => { n.classList.remove('is-open'); b.setAttribute('aria-expanded', 'false'); };
  b.addEventListener('click', () => {
    const open = n.classList.toggle('is-open');
    b.setAttribute('aria-expanded', String(open));
    if (open) n.querySelector('.mnav a')?.focus();
  });
  document.querySelectorAll('.mnav a').forEach(a => a.addEventListener('click', close));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && n.classList.contains('is-open')) { close(); b.focus(); } });
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
  const INTENTS = {
    join: { note: 'Joining the interest list is not enrollment and not team placement.' },
    updates: { role: 'Parent/guardian', message: 'Please send me updates when a session is being planned.', note: 'This asks for session updates. It is not enrollment, and it does not hold a seat.' },
    host: { role: 'Other', message: 'I would like to ask about hosting a session in our community.', note: 'This is a hosting question. It does not put a date on the calendar.' },
    support: { role: 'Sponsor/partner', message: 'I would like to talk about supporting AfroBot.', note: 'This is a conversation about support. This form does not confirm tax deductibility.' },
    parent: { role: 'Parent/guardian', message: 'Parent or guardian inquiry.', note: 'You are writing as a parent or guardian. Ages are enough. Please do not add a full date of birth or a school ID.' },
    student: { role: 'Parent/guardian', message: 'Parent or guardian submitting interest for a student. Participation is parent-managed.', note: 'Students take part through a parent or guardian. We do not create public profiles for children. If you are under 18, please ask a parent or guardian to send this.' },
    mentor: { role: 'Volunteer/mentor', message: 'Mentor or volunteer inquiry. I understand screening is required before working with students.', note: 'Mentors and volunteers are screened before they work with students. Sending this form starts a conversation. It is not an approval.' },
    volunteer: { role: 'Volunteer/mentor', message: 'Mentor or volunteer inquiry. I understand screening is required before working with students.', note: 'Mentors and volunteers are screened before they work with students. Sending this form starts a conversation. It is not an approval.' },
    sponsor: { role: 'Sponsor/partner', message: 'Sponsorship inquiry. I would like to ask about sponsoring a student or a program.', note: 'This is a sponsorship inquiry. This form does not confirm tax deductibility.' },
    partner: { role: 'Sponsor/partner', message: 'Partnership inquiry.', note: 'This is a partnership inquiry.' },
    school: { role: 'School/educator', message: 'School or university inquiry.', note: 'Schools and universities can ask about a workshop or a pathway conversation.' },
    manufacturer: { role: 'Sponsor/partner', message: 'Manufacturer or equipment inquiry.', note: 'This is an equipment or materials inquiry.' },
    assistance: { role: 'Parent/guardian', message: 'Financial assistance inquiry. I will not send financial documents.', note: 'Financial assistance inquiries do not ask for pay stubs, tax returns, benefit letters, or account numbers. Please do not send them.' },
    discover: { role: 'Parent/guardian', message: 'Interest in Discover (suggested ages 5–8). I understand registration is not open yet.', note: 'Discover is not open for registration. Ages 5–8 are guidance. This list is not a place on a team.' },
    build: { role: 'Parent/guardian', message: 'Interest in Build (suggested ages 9–12). I understand registration is not open yet.', note: 'Build is not open for registration. Ages 9–12 are guidance. This list is not a place on a team.' },
    innovate: { role: 'Parent/guardian', message: 'Interest in Innovate (suggested ages 12–15). I understand registration is not open yet.', note: 'Innovate is not open for registration. Ages 12–15 are guidance. This list is not a place on a team.' },
    compete: { role: 'Parent/guardian', message: 'Interest in competition preparation. I understand this is not team placement.', note: 'AfroBot is not affiliated with FIRST. The interest list is not team placement. Eligibility is set by the competition, not by this form.' },
    advance: { role: 'Parent/guardian', message: 'Interest in Advance (suggested ages 15–18). I understand this is not an application for admission or a scholarship.', note: 'Advance does not guarantee admission, credit, or scholarships. Ages 15–18 are guidance.' }
  };
  const note = document.getElementById('form-context');
  const msg = f.elements.message;
  const prefills = new Set(Object.values(INTENTS).map((spec) => spec.message).filter(Boolean));
  const applyIntent = (key) => {
    const spec = INTENTS[key];
    if (!spec) return;
    if (spec.role) { role.value = spec.role; role.dispatchEvent(new Event('change')); }
    if (msg) {
      if (spec.message && (!msg.value.trim() || prefills.has(msg.value))) msg.value = spec.message;
      else if (!spec.message && prefills.has(msg.value)) msg.value = '';
    }
    if (note) note.textContent = spec.note || '';
  };
  document.querySelectorAll('[data-intent]').forEach((a) => a.addEventListener('click', () => applyIntent(a.dataset.intent)));
  const preset = document.getElementById('register')?.dataset.defaultIntent;
  if (Q.get('intent')) applyIntent(Q.get('intent'));
  else if (preset) applyIntent(preset);
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
        show('Thank you. You’re on the list. We’ll email you about AfroBot. This is not team placement.', 'ok'); status.setAttribute('tabindex', '-1'); status.focus();
        return;
      }
      if (j.errors) { Object.keys(fields).forEach(k => setErr(k, j.errors[k])); show('Please check the highlighted fields.', 'error'); }
      else show('Sorry, something went wrong and your details weren’t sent. Please try again in a moment.', 'error');
    } catch { show('We couldn’t reach the server. Check your connection and try again.', 'error'); }
    btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = 'Send interest';
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
(() => {
  const norm = (p) => {
    const last = (p || '').split('?')[0].split('#')[0].replace(/\/+$/, '').split('/').filter(Boolean).pop() || 'index';
    return last.replace(/\.html$/, '') || 'index';
  };
  const here = norm(location.pathname);
  document.querySelectorAll('a[data-nav]').forEach((a) => {
    if (norm(a.getAttribute('href')) === here) a.setAttribute('aria-current', 'page');
  });
})();

if (Q.get('hero') === 'photo') {
  const fig = document.querySelector('.photo--hero');
  if (fig) {
    fig.classList.remove('photo--cutout');
    const src = fig.querySelector('source'), img = fig.querySelector('img');
    if (src) src.srcset = 'assets/photos/mckinney-build-day-2024.webp?v=5';
    if (img) { img.src = 'assets/photos/mckinney-build-day-2024.jpg?v=5'; img.width = 1800; img.height = 1350; }
  }
}
