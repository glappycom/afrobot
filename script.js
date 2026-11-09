// ---- Logo: header lockup = navy icon, white face, navy eyes, navy wordmark. Footer lockup = white icon, navy face, white eyes, white wordmark.
// Archived directions for comparison: ?logo=e1 (Space Grotesk lockup) | d2 | a | b | c
const Q = new URLSearchParams(location.search);
const LOGO = Q.get('logo') || 'afrobot';
const BLUE = false;
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
    join: { note: '' },
    updates: { role: 'Parent/guardian', message: 'Please send me updates when a session is being planned.', note: '' },
    host: { role: 'Other', message: 'I would like to ask about hosting a session in our community.', note: '' },
    support: { role: 'Sponsor/partner', message: 'I would like to talk about supporting AfroBot.', note: 'Tax treatment of a gift is not stated on this form.' },
    parent: { role: 'Parent/guardian', message: 'Parent or guardian inquiry.', note: '' },
    student: { role: 'Parent/guardian', message: 'Parent or guardian submitting interest for a student.', note: 'If you are under 18, ask a parent or guardian to send this.' },
    mentor: { role: 'Volunteer/mentor', message: 'Mentor or volunteer inquiry.', note: '' },
    volunteer: { role: 'Volunteer/mentor', message: 'Mentor or volunteer inquiry.', note: '' },
    sponsor: { role: 'Sponsor/partner', message: 'I would like to ask about sponsoring a student or a program.', note: 'Tax treatment of a gift is not stated on this form.' },
    partner: { role: 'Sponsor/partner', message: 'Partnership inquiry.', note: '' },
    school: { role: 'School/educator', message: 'School or university inquiry.', note: '' },
    manufacturer: { role: 'Sponsor/partner', message: 'Manufacturer or equipment inquiry.', note: '' },
    assistance: { role: 'Parent/guardian', message: 'Financial assistance inquiry.', note: 'Do not send financial documents, tax forms, or account numbers.' },
    discover: { role: 'Parent/guardian', message: 'Interest in Discover (ages 6–9).', note: '' },
    build: { role: 'Parent/guardian', message: 'Interest in Build (ages 9–12).', note: '' },
    innovate: { role: 'Parent/guardian', message: 'Interest in Innovate (ages 13–17).', note: '' },
    compete: { role: 'Parent/guardian', message: 'Interest in Compete (ages 13–17).', note: '' },
    advance: { role: 'Parent/guardian', message: 'Interest in Advance (ages 13–17).', note: '' }
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
      const endpoint = f.getAttribute('action') || '/api/interest';
      const r = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(d) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) {
        f.classList.add('is-sent'); f.querySelector('.form__fields').hidden = true; btn.hidden = true;
        show('Sent. We’ll email you.', 'ok'); status.setAttribute('tabindex', '-1'); status.focus();
        return;
      }
      if (j.errors) { Object.keys(fields).forEach(k => setErr(k, j.errors[k])); show('Please check the highlighted fields.', 'error'); }
      else if (r.status === 429) show('Too many tries. Wait a few minutes.', 'error');
      else show('Not sent. Try again later.', 'error');
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
(() => { const n = document.querySelector('.nav'); const f = () => n.classList.toggle('is-compact', scrollY > 8); f(); addEventListener('scroll', f, { passive: true }); })();

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

document.querySelectorAll('.video-play').forEach((btn) => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.video;
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return;
    const frame = document.createElement('iframe');
    frame.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1';
    frame.title = btn.getAttribute('aria-label').replace(/^Play video:\s*/, '');
    frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    btn.parentElement.replaceChildren(frame);
  });
});

(() => {
  const access = [
    ['Access', 'A family starts with an affordable or sponsored place.'],
    ['Discover', 'Ages 6–9. Teams build a life-size vehicle by hand.'],
    ['Build', 'Ages 9–12. Teams carry a life-size vehicle through a longer build.'],
    ['Compete', 'Ages 13–17. Teams prepare humanoid robots for recognized robotics competitions.'],
    ['Advance', 'Ages 13–17. Older students mentor younger teams with an adult coach.'],
  ];
  const mode = Q.get('stages') || document.querySelector('[data-stage-mode]')?.dataset.stageMode || 'current';
  if (mode !== 'access') return;
  document.querySelectorAll('[data-stage-index]').forEach((item) => {
    const spec = access[Number(item.dataset.stageIndex)];
    if (!spec) return;
    item.querySelector('h3').textContent = spec[0];
    item.querySelector('p').textContent = spec[1];
  });
})();

(() => {
  const steps = document.querySelectorAll('.journey-step');
  if (!steps.length) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    steps.forEach((step) => step.classList.add('is-on'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => { if (entry.isIntersecting) entry.target.classList.add('is-on'); });
  }, { threshold: 0.6 });
  steps.forEach((step) => io.observe(step));
})();

(() => {
  const form = document.getElementById('journey-finder');
  const out = document.getElementById('finder-result');
  if (!form || !out) return;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const age = data.get('age');
    const interest = data.get('interest');
    const experience = data.get('experience');
    const format = data.get('format');
    const stage = age === '6-9' ? 'Discover' : 'Build';
    const ages = age === '6-9' ? '6–9' : '9–12';
    const practice = experience === 'new' ? 'new to this' : 'some practice';
    const shape = format === 'workshop' ? 'a workshop' : 'an ongoing program';
    let extra = '';
    if (interest === 'mentorship') extra = ' Mentorship is for adults.';
    if (interest === 'compete') extra = ' Compete is for ages 13–17.';
    out.textContent = stage + ' fits ages ' + ages + ', ' + practice + ', in ' + shape + '.' + extra;
  });
})();

(() => {
  document.documentElement.classList.add('js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reveal = document.querySelectorAll('[data-reveal]');
  if (!reduce && reveal.length && 'IntersectionObserver' in window) {
    reveal.forEach((el) => el.classList.add('will-reveal'));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.18 });
    reveal.forEach((el) => io.observe(el));
  }
  const nums = document.querySelectorAll('[data-count]');
  if (!nums.length || reduce || !('IntersectionObserver' in window)) return;
  const format = (n) => n.toLocaleString('en-US');
  const run = (el) => {
    const target = Number(el.dataset.count);
    if (!Number.isFinite(target)) return;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 900);
      const eased = 1 - (1 - t) ** 3;
      el.textContent = format(Math.round(target * eased));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const counts = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      run(entry.target);
      counts.unobserve(entry.target);
    });
  }, { threshold: 0.5 });
  nums.forEach((el) => counts.observe(el));
})();

if (Q.get('hero') === 'photo') {
  const fig = document.querySelector('.photo--hero');
  if (fig) {
    fig.classList.remove('photo--cutout');
    const src = fig.querySelector('source'), img = fig.querySelector('img');
    if (src) src.srcset = 'assets/photos/mckinney-build-day-2024.webp?v=5';
    if (img) { img.src = 'assets/photos/mckinney-build-day-2024.jpg?v=5'; img.width = 1000; img.height = 920; }
  }
}
