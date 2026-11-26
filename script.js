document.documentElement.classList.add('js');
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
// Header: bone on white. ?header=none = plain paper header.
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
  const b = document.querySelector('.nav-btn');
  const menu = document.getElementById('site-nav');
  if (!b || !menu) return;
  const close = () => { menu.classList.remove('is-open'); b.setAttribute('aria-expanded', 'false'); document.documentElement.classList.remove('nav-lock'); };
  b.addEventListener('click', () => {
    const open = !menu.classList.contains('is-open');
    menu.classList.toggle('is-open', open);
    b.setAttribute('aria-expanded', String(open));
    document.documentElement.classList.toggle('nav-lock', open);
    if (open) menu.querySelector('a:not(.btn)')?.focus();
  });
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', close));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.classList.contains('is-open')) { close(); b.focus(); } });
  const here = (location.pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '').replace(/\/$/, '') || '/');
  menu.querySelectorAll('a').forEach((a) => {
    if (a.classList.contains('btn')) return;
    let path = '';
    try { path = new URL(a.getAttribute('href'), location.origin).pathname; } catch { return; }
    path = path.replace(/\.html$/, '').replace(/\/$/, '') || '/';
    if (path === here) a.setAttribute('aria-current', 'page');
  });
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
    support: { role: 'Sponsor/partner', message: 'I would like to talk about supporting AfroBot.', note: '' },
    parent: { role: 'Parent/guardian', message: 'Parent or guardian inquiry.', note: '' },
    student: { role: 'Parent/guardian', message: 'Parent or guardian submitting interest for a student.', note: '' },
    mentor: { role: 'Volunteer/mentor', message: 'Mentor or volunteer inquiry.', note: '' },
    volunteer: { role: 'Volunteer/mentor', message: 'Mentor or volunteer inquiry.', note: '' },
    sponsor: { role: 'Sponsor/partner', message: 'I would like to ask about sponsoring a student or a program.', note: '' },
    partner: { role: 'Sponsor/partner', message: 'Partnership inquiry.', note: '' },
    school: { role: 'School/educator', message: 'School or university inquiry.', note: '' },
    manufacturer: { role: 'Sponsor/partner', message: 'Manufacturer or equipment inquiry.', note: '' },
    assistance: { role: 'Parent/guardian', message: 'Financial assistance inquiry.', note: '' },
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
        show('Sent. We’ll email you about next steps. This does not enroll anyone.', 'ok'); status.setAttribute('tabindex', '-1'); status.focus();
        return;
      }
      if (j.errors) { Object.keys(fields).forEach(k => setErr(k, j.errors[k])); show('Please check the highlighted fields.', 'error'); }
      else if (r.status === 429) show('Too many tries. Wait a few minutes.', 'error');
      else show('Not sent. Try again later.', 'error');
    } catch { show('We couldn’t reach the server. Check your connection and try again.', 'error'); }
    btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = 'Send interest';
  });
})();

// ---- Footer updates: email only, stored with the interest records as source footer-updates.
(() => {
  const f = document.getElementById('footer-signup'); if (!f) return;
  const t0 = Date.now();
  const email = f.querySelector('#signup-email');
  const btn = f.querySelector('button[type="submit"]');
  const msg = f.querySelector('.signup__msg');
  const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/;
  const show = (text, html) => {
    msg.hidden = false;
    if (html) msg.innerHTML = html; else msg.textContent = text;
  };
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const value = email.value.trim();
    if (!EMAIL.test(value)) { email.setAttribute('aria-invalid', 'true'); email.focus(); show('Please enter a valid email address.'); return; }
    email.removeAttribute('aria-invalid');
    btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.textContent = 'Sending…';
    msg.hidden = true;
    try {
      const r = await fetch('/api/updates', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: value, website: f.elements.website.value, t: t0, page: location.href.split('#')[0] }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) {
        f.classList.add('is-sent');
        show('Thanks. We’ll email you.');
        msg.setAttribute('tabindex', '-1');
        msg.focus();
        return;
      }
      show('', 'Not saved yet. Email <a href="mailto:hello@afrobot.org">hello@afrobot.org</a>.');
    } catch {
      show('', 'Not saved yet. Email <a href="mailto:hello@afrobot.org">hello@afrobot.org</a>.');
    }
    btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = 'Sign up';
  });
})();

// ---- School sign-up: same /api/interest store as the partnership form, tagged School sign-up.
(() => {
  const f = document.getElementById('school-signup'); if (!f) return;
  const t0 = Date.now();
  const status = document.getElementById('sch-status');
  const btn = f.querySelector('button[type="submit"]');
  const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/;
  const fields = {
    school: f.elements.school,
    schoolType: f.elements.schoolType,
    city: f.elements.city,
    region: f.elements.region,
    country: f.elements.country,
    contact: f.elements.contact,
    contactRole: f.elements.contactRole,
    email: f.elements.email,
    ages: f.querySelector('fieldset[aria-describedby="sch-ages-err"]'),
    count: f.elements.count,
    wants: f.querySelector('fieldset[aria-describedby="sch-wants-err"]'),
    consent: f.elements.consent,
  };
  const setErr = (key, msg) => {
    const el = fields[key];
    const err = document.getElementById(el.getAttribute('aria-describedby'));
    if (msg) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
    if (err) err.textContent = msg || '';
  };
  const chosen = (name) => [...f.querySelectorAll('input[name="' + name + '"]:checked')].map((el) => el.value);
  const check = () => {
    const e = {};
    if (fields.school.value.trim().length < 2) e.school = 'Please enter the school name.';
    if (!fields.schoolType.value) e.schoolType = 'Please choose a school type.';
    if (fields.city.value.trim().length < 2) e.city = 'Please enter the city.';
    if (fields.region.value.trim().length < 2) e.region = 'Please enter the state or region.';
    if (fields.country.value.trim().length < 2) e.country = 'Please enter the country.';
    if (fields.contact.value.trim().length < 2) e.contact = 'Please enter a contact name.';
    if (!fields.contactRole.value) e.contactRole = 'Please choose a role.';
    if (!EMAIL.test(fields.email.value.trim())) e.email = 'Please enter a valid email address.';
    if (!chosen('ages').length) e.ages = 'Please choose at least one age band.';
    if (!/\d/.test(fields.count.value.trim())) e.count = 'Please enter a number.';
    if (!chosen('wants').length) e.wants = 'Please choose at least one.';
    if (!fields.consent.checked) e.consent = 'Please confirm we may contact you.';
    return e;
  };
  const focusOf = (key) => key === 'ages' || key === 'wants' ? fields[key].querySelector('input') : fields[key];
  Object.keys(fields).forEach((key) => {
    const el = fields[key];
    const watch = key === 'ages' || key === 'wants' ? 'change' : (el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'blur');
    el.addEventListener(watch, () => { if (el.getAttribute('aria-invalid')) setErr(key, check()[key]); });
  });
  const show = (msg, kind) => { status.textContent = msg; status.dataset.kind = kind; status.hidden = false; };
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const errs = check();
    Object.keys(fields).forEach((key) => setErr(key, errs[key]));
    const first = Object.keys(fields).find((key) => errs[key]);
    if (first) { focusOf(first).focus(); show('Please check the highlighted fields.', 'error'); return; }
    const ages = chosen('ages');
    const wants = chosen('wants');
    const phone = f.elements.phone.value.trim();
    const note = f.elements.message.value.trim();
    const place = [fields.city.value.trim(), fields.region.value.trim(), fields.country.value.trim()].join(', ');
    const lines = [
      'School sign-up',
      'School type: ' + fields.schoolType.value,
      'Role: ' + fields.contactRole.value,
      phone ? 'Phone: ' + phone : '',
      'Interested students: ' + fields.count.value.trim(),
      'Ages: ' + ages.join(', '),
      'Interested in: ' + wants.join('; '),
      note,
    ].filter(Boolean);
    const payload = {
      name: fields.contact.value.trim(),
      email: fields.email.value.trim(),
      role: 'School/educator',
      city: place.slice(0, 120),
      organization: fields.school.value.trim().slice(0, 160),
      kids: ('Ages ' + ages.join(', ') + '; ' + fields.count.value.trim() + ' students').slice(0, 120),
      message: lines.join('\n').slice(0, 2000),
      consent: true,
      website: f.elements.website.value,
      t: t0,
      page: location.href.split('#')[0],
    };
    btn.disabled = true; btn.setAttribute('aria-busy', 'true'); btn.textContent = 'Sending…'; status.hidden = true;
    try {
      const r = await fetch(f.getAttribute('action') || '/api/interest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) {
        f.classList.add('is-sent'); f.querySelector('.form__fields').hidden = true; btn.hidden = true;
        show('Sent. We’ll email you about a first learning session. This does not enroll students yet.', 'ok'); status.setAttribute('tabindex', '-1'); status.focus();
        return;
      }
      if (r.status === 429) show('Too many tries. Wait a few minutes.', 'error');
      else show('Not sent. Try again later.', 'error');
    } catch { show('We couldn’t reach the server. Check your connection and try again.', 'error'); }
    btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = 'Send school sign-up';
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

// Header chrome appears only after a short scroll. Position never changes.
(() => {
  const n = document.querySelector('nav');
  if (!n) return;
  const apply = () => n.classList.toggle('is-scrolled', window.scrollY > 20);
  apply();
  addEventListener('scroll', apply, { passive: true });
})();

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

(() => {
  const dialog = document.getElementById('watch-dialog');
  const stage = dialog && dialog.querySelector('.watch__stage');
  const closeBtn = dialog && dialog.querySelector('.watch__x');
  const titleEl = document.getElementById('watch-title');
  if (!dialog || !stage || !closeBtn || typeof dialog.showModal !== 'function') return;
  let lastFocus = null;
  const lock = (on) => document.documentElement.classList.toggle('watch-lock', on);
  const openWatch = (id, title, trigger) => {
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return;
    lastFocus = trigger || null;
    stage.replaceChildren();
    const frame = document.createElement('iframe');
    frame.src = 'https://www.youtube-nocookie.com/embed/' + id + '?rel=0';
    frame.title = title || 'Video';
    frame.allow = 'clipboard-write; encrypted-media; picture-in-picture; web-share';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    stage.appendChild(frame);
    if (titleEl) titleEl.textContent = title || 'Video';
    lock(true);
    dialog.showModal();
    closeBtn.focus();
  };
  const watchOpen = document.getElementById('watch-open');
  if (watchOpen) {
    watchOpen.addEventListener('click', (event) => {
      event.preventDefault();
      openWatch(stage.dataset.video || '4F1Jm0-rMM0', 'Build Day presentation, Texas', watchOpen);
    });
  }
  document.querySelectorAll('.video-play').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      const title = (btn.getAttribute('aria-label') || '').replace(/^Play video:\s*/, '');
      if (btn.dataset.file) {
        const video = document.createElement('video');
        video.controls = true;
        video.playsInline = true;
        video.src = btn.dataset.file;
        video.setAttribute('aria-label', title);
        btn.replaceWith(video);
        video.play();
        return;
      }
      openWatch(btn.dataset.video, title, btn);
    });
  });
  closeBtn.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    stage.replaceChildren();
    lock(false);
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  });
})();

(() => {
  const form = document.getElementById('program-finder');
  if (!form) return;
  form.addEventListener('submit', (event) => {
    const age = new FormData(form).get('age');
    if (age !== 'discover' && age !== 'build' && age !== 'innovate') return;
    event.preventDefault();
    location.href = '/programs#' + age;
  });
})();


document.querySelectorAll('.work-gallery').forEach((gallery) => {
  const dialog = gallery.querySelector('.work-lightbox');
  const img = dialog.querySelector('img');
  const cap = dialog.querySelector('p');
  gallery.querySelectorAll('.work-shot').forEach((shot) => {
    shot.addEventListener('click', () => {
      img.src = shot.dataset.full;
      img.alt = shot.dataset.alt || '';
      cap.textContent = shot.dataset.caption || '';
      dialog.showModal();
    });
  });
  dialog.querySelector('.work-lightbox__close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => { img.removeAttribute('src'); });
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
    let stage = 'Build';
    let ages = '9–12';
    if (age === '6-9') { stage = 'Discover'; ages = '6–9'; }
    if (age === '13-17') {
      ages = '13–17';
      stage = interest === 'mentorship' ? 'Advance' : interest === 'compete' ? 'Compete' : 'Innovate';
    }
    const practice = experience === 'new' ? 'new to this' : 'some practice';
    const shape = format === 'workshop' ? 'a workshop' : 'an ongoing program';
    let extra = '';
    if (interest === 'mentorship' && stage !== 'Advance') extra = ' Mentorship is for adults.';
    if (interest === 'compete' && stage !== 'Compete') extra = ' Compete is for ages 13–17.';
    out.textContent = stage + ' fits ages ' + ages + ', ' + practice + ', in ' + shape + '.' + extra;
    const id = stage === 'Discover' ? 'discover' : stage === 'Build' ? 'build' : 'innovate';
    const card = document.getElementById(id);
    document.querySelectorAll('.ladder .card.is-picked').forEach((el) => el.classList.remove('is-picked'));
    if (card) {
      card.classList.add('is-picked');
      card.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    }
  });
})();

(() => {
  document.documentElement.classList.add('js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reveal = document.querySelectorAll('[data-reveal], main > section:not(.oa-hero), main > .stats, main > .split, main > .spons');
  if (!reduce && reveal.length && 'IntersectionObserver' in window) {
    reveal.forEach((el, i) => { el.classList.add('will-reveal'); el.style.setProperty('--i', String(i % 6)); });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        io.unobserve(entry.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });
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

(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('.has-sub').forEach((item) => {
    const btn = item.querySelector('.sub-btn');
    const menu = item.querySelector('.sub-menu');
    if (!btn || !menu) return;
    const set = (open) => { item.classList.toggle('is-open', open); btn.setAttribute('aria-expanded', String(open)); };
    const wide = () => matchMedia('(min-width:901px)').matches;
    btn.addEventListener('click', (e) => { e.stopPropagation(); set(!item.classList.contains('is-open')); });
    item.addEventListener('mouseenter', () => { if (wide()) set(true); });
    item.addEventListener('mouseleave', () => { if (wide() && !item.contains(document.activeElement)) set(false); });
    item.addEventListener('keydown', (e) => { if (e.key === 'Escape') { set(false); btn.focus(); } });
  });
  document.addEventListener('click', () => document.querySelectorAll('.has-sub.is-open').forEach((item) => {
    item.classList.remove('is-open');
    item.querySelector('.sub-btn')?.setAttribute('aria-expanded', 'false');
  }));
  const top = document.querySelector('.to-top');
  if (top) {
    const footer = document.querySelector('footer');
    const sync = () => {
      const footerSeen = footer && footer.getBoundingClientRect().top < window.innerHeight - 8;
      top.hidden = window.scrollY < 700 || footerSeen;
    };
    addEventListener('scroll', sync, { passive: true });
    sync();
    top.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }));
  }
  document.querySelectorAll('img[loading="lazy"]').forEach((img) => {
    if (img.complete) return;
    img.classList.add('is-pending');
    img.addEventListener('load', () => img.classList.remove('is-pending'), { once: true });
  });
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
