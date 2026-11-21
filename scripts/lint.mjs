import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const errors = [];
const fail = (msg) => errors.push(msg);

const files = fs.readdirSync(root).filter((name) => name.endsWith('.html')).sort();
if (!files.includes('index.html')) fail('index.html was not built');

const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const lib = fs.readFileSync(path.join(root, 'api/_lib.js'), 'utf8');
const intentBlock = script.match(/const INTENTS = \{([\s\S]*?)\n  \};/);
if (!intentBlock) fail('INTENTS block missing from script.js');
const intents = new Set();
if (intentBlock) for (const m of intentBlock[1].matchAll(/^\s{4}([a-z]+):/gm)) intents.add(m[1]);

const roleBlock = lib.match(/ROLES = \[([^\]]+)\]/);
const serverRoles = roleBlock ? [...roleBlock[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : [];
if (serverRoles.length !== 5) fail('Could not read server roles');
if (serverRoles.includes('Student')) fail('Student is still a server role');

const requiredHome = [
  'We give children with limited access the tools, mentors and confidence to build the future with robotics and AI.',
  'Find a program',
  'Partner with us',
  'Sponsor a student',
  'Parents',
  'children trained in holiday programs',
  'pupils aged 8–15 at EDUCARE School Bamenda, since June 2023',
  '3,200',
  'Inside the 2024 McKinney build day',
  'How holiday programs reached 5,000 children',
  'Our proposed plan for the first national season',
  'The first national season',
  'August 2027',
  'Regional launches',
  'National championship',
  'The camp-week participation goal is $100 per child.',
];

const retiredCopy = [
  'This page does not invent a statistic',
  'That line is a direction, not a promise',
  'This section has no counts and no percentages',
  'Success Is Measured in Opportunity',
  'World-Class Opportunities',
];

const banned = [
  [/whalesbot/i, 'WhalesBot'],
  [/k-scale|kscale/i, 'K-Scale'],
  [/zeroth/i, 'Zeroth'],
  [/nsbe/i, 'NSBE'],
  [/baymax/i, 'Baymax'],
  [/disney/i, 'Disney'],
  [/\blego\b/i, 'LEGO'],
  [/tax-deductible|tax deductible|501c3/i, 'tax status'],
  [/renner|75082/i, 'street address'],
  [/\bsuite\b|\bunit\s+\d|\bapt\b/i, 'unit number'],
  [/2025|2029|2030/, 'unconfirmed year'],
  [/\d+(?:\.\d+)?\s*%/, 'percentage'],
];

function localTarget(href) {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('http') || href.startsWith('tel:')) return null;
  let rel = href.split('#')[0].split('?')[0].replace(/^\/+/, '');
  if (rel === '') return 'index.html';
  if (!path.extname(rel)) rel += '.html';
  return rel;
}

for (const name of files) {
  const html = fs.readFileSync(path.join(root, name), 'utf8');
  if (html.includes('{{')) fail(name + ' has an unresolved placeholder');
  if (/#F6C445|#F6E4DC/i.test(html)) fail(name + ' contains yellow');
  const h1 = html.match(/<h1\b/gi) || [];
  if (h1.length !== 1) fail(name + ' has ' + h1.length + ' h1 elements');
  if (!html.includes('lang="en"')) fail(name + ' missing lang');
  if (!html.includes('name="viewport"')) fail(name + ' missing viewport');
  if (name !== 'index.html' && !html.includes('href="#main"')) fail(name + ' missing skip link');
  if (name !== 'index.html' && !html.includes('<main id="main"')) fail(name + ' missing main');
  for (const img of html.match(/<img\b[^>]*>/gi) || []) {
    if (!/\salt=/.test(img)) fail(name + ' img missing alt: ' + img.slice(0, 80));
  }
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) fail(name + ' duplicate id ' + id);
    seen.add(id);
  }
  for (const [re, label] of banned) if (re.test(html)) fail(name + ' contains banned pattern ' + label);
  if (html.includes('2028') && !html.includes('Proposed') && !html.includes('proposed')) fail(name + ' uses 2028 without marking it proposed');
  if (/ut dallas|university of texas|\bjsom\b|impactutd|\butd\b/i.test(html)) {
    fail(name + ' names an unconfirmed university or partner');
  }
  if (/8-team pilot/.test(html)) fail(name + ' still calls 2027 an 8-team pilot');
  if (html.includes('Registration is open')) fail(name + ' says registration is open');
  const allowedAmounts = new Set(['$10', '$100', '$1,000', '$5,000', '$10,000', '$25,000']);
  const money = html.match(/\$\d[\d,]*/g) || [];
  for (const amount of money) if (!allowedAmounts.has(amount)) fail(name + ' unexpected amount ' + amount);
  if (money.includes('$10') && !/not today’s price/i.test(html)) fail(name + ' uses $10 without saying it is not today’s price');
  const priced = money.filter((amount) => amount !== '$10');
  if (priced.length && !/goal/i.test(html)) fail(name + ' shows a dollar amount without calling it a goal');
  if (/\bFIRST\b/.test(html)) fail(name + ' names FIRST');
  if (/501\s*\(c\)\s*\(3\)/i.test(html)) fail(name + ' states 501(c)(3)');
  if (/scholarship/i.test(html) && !/does not guarantee|do not guarantee|no guarantee|not a scholarship|nothing here promises/i.test(html)) {
    fail(name + ' mentions scholarships without a non-guarantee');
  }
  for (const m of html.matchAll(/\bdata-intent="([^"]+)"/g)) {
    if (!intents.has(m[1])) fail(name + ' unknown data-intent ' + m[1]);
  }
  for (const m of html.matchAll(/\bdata-default-intent="([^"]*)"/g)) {
    if (m[1] && !intents.has(m[1])) fail(name + ' unknown default intent ' + m[1]);
  }
  for (const m of html.matchAll(/\shref="([^"]+)"/g)) {
    const target = localTarget(m[1]);
    if (!target) continue;
    if (!fs.existsSync(path.join(root, target))) fail(name + ' broken link ' + m[1]);
  }
  if (html.includes('To be added') || /cannot show yet/i.test(html) || html.includes('Evidence this site does not have yet')) fail(name + ' still shows a missing-evidence note');
  if (html.includes('id="interest"')) {
    const options = [...html.matchAll(/<option>([^<]+)<\/option>/g)].map((m) => m[1]);
    if (options.join('|') !== serverRoles.join('|')) fail(name + ' form roles do not match the API');
    const action = name === 'volunteer.html' ? 'action="/api/volunteer"' : 'action="/api/interest"';
    for (const field of ['name="name"', 'name="email"', 'name="role"', 'name="city"', 'name="organization"', 'name="kids"', 'name="message"', 'name="consent"', 'name="website"', action]) {
      if (!html.includes(field)) fail(name + ' form missing ' + field);
    }
  }
}

const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const programs = fs.readFileSync(path.join(root, 'programs.html'), 'utf8');
for (const line of requiredHome) if (!home.includes(line)) fail('homepage missing: ' + line);
if (home.includes('From Curiosity to Creation. From Community to the World.')) fail('old hero tagline still present');
if (home.includes('From Curiosity to Creativity. From Africa to the World.')) fail('story heading is still the long line');
if (home.includes('hero__tag')) fail('homepage still uses the tag sticker');
if (home.includes('may shift') || home.includes('fee charged') || home.includes('not a new pilot')) fail('homepage still hedges in the body');
if (!home.includes('The first national season')) fail('homepage missing the 2027 season');
const homeCss = fs.readFileSync(path.join(root, 'home.css'), 'utf8');
if (!home.includes('assets/photos/bamenda-circuit-team.jpg')) fail('homepage hero is missing the build photo');
if (/body\{[^}]*width:\s*1440px/.test(homeCss)) fail('homepage css still locks the body to 1440px');
if (!homeCss.includes('@media (max-width:900px)')) fail('homepage missing the mobile layout');
for (const sheet of ['styles.css', 'components.css', 'visual.css', 'funder.css', 'finish.css', 'inst.css', 'tokens.css']) {
  if (home.includes(sheet)) fail('homepage loads ' + sheet);
}
if (!home.includes('href="home.css"')) fail('homepage missing home.css');
if (home.includes('Annual report') || home.includes('1,500') || home.includes('children learning now')) fail('homepage still has retired mockup copy');
const about = fs.readFileSync(path.join(root, 'about.html'), 'utf8');
const events = fs.readFileSync(path.join(root, 'events.html'), 'utf8');
for (const line of ['Planned sessions', 'Affordable sessions', 'The camp-week cost has a $100 goal.', '$100 per child for a camp week is the participation goal.', 'A $10 workshop is a hope, not today’s price.', 'Which stage fits?', 'Ask about financial assistance']) {
  if (!programs.includes(line)) fail('programs missing: ' + line);
}
const legalHome = 'AfroBot is a program of Glappy Foundation, a Texas nonprofit corporation.';
for (const line of [legalHome, 'About 5,000 children have been trained through our holiday programs in Cameroon.', 'About 3,200 pupils aged 8–15 are in EDUCARE School Bamenda\'s primary and secondary schools. The partnership has run since June 2023.', 'Access for every child', 'Robotics and AI should not depend on a family’s income or zip code.']) {
  if (!about.includes(line)) fail('about missing: ' + line);
}
if (/>([^<]*\b[Dd]raft\b[^<]*)</.test(about)) fail('about shows the word Draft');
if (about.includes('We intend to measure these')) fail('about still uses measure scaffolding');
const partners = fs.readFileSync(path.join(root, 'partners.html'), 'utf8');
for (const line of [legalHome, 'Ways to take part', 'partnerships@afrobot.org', 'does not guarantee an award or a place']) {
  if (!partners.includes(line)) fail('partners missing: ' + line);
}
if (partners.includes('EduCare Schools') || partners.includes('Gateway Schools') || partners.includes('Sure Starts')) fail('partners still names a school');
const safety = fs.readFileSync(path.join(root, 'child-safety.html'), 'utf8');
for (const line of ['Screening', 'Supervision', 'two-adult rule', 'Photo and media consent', 'Reporting concerns', 'Health and safety at events', 'mailto:info@afrobot.org']) {
  if (!safety.includes(line)) fail('child safety missing: ' + line);
}
const competitions = fs.readFileSync(path.join(root, 'competitions.html'), 'utf8');
if (!competitions.includes('The 2027 season in Dallas–Fort Worth scales the 2024 pilot to about 15 teams and about 90 students.')) fail('competitions missing the 2027 season story');
if (!competitions.includes('complementary to other youth robotics programs')) fail('competitions missing the season model');
if (home.includes('Dates coming soon') || programs.includes('Dates coming soon') || competitions.includes('Dates coming soon')) fail('Dates coming soon is still on a primary page');
if (home.includes('No social accounts') || fs.readFileSync(path.join(root, 'contact.html'), 'utf8').includes('No social accounts') || fs.readFileSync(path.join(root, 'social.html'), 'utf8').includes('No social accounts')) fail('social placeholder is still present');
for (const line of ['McKinney Build Day', 'Kids and mentors worked with robots in McKinney, Texas, in 2024.', 'From the program']) {
  if (!events.includes(line)) fail('events missing: ' + line);
}
if (!home.includes('>Partner with us<')) fail('homepage missing Partner with us');
for (const line of retiredCopy) if (home.includes(line) || programs.includes(line)) fail('retired copy still present: ' + line);
if (/coming soon/i.test(home) || /coming soon/i.test(programs)) fail('Home or Programs still says coming soon');
const mainNav = home.match(/<nav>[\s\S]*?<\/nav>/);
if (!mainNav) fail('main nav missing');
else {
  for (const label of ['Programs', 'Get Involved', 'Partners', 'Impact', 'About']) {
    if (!mainNav[0].includes(label)) fail('nav missing ' + label);
  }
  if (mainNav[0].includes('>More<')) fail('header nav still has More');
  if (mainNav[0].includes('social.html')) fail('empty directory is in the primary nav');
}
if (!home.includes('>Get updates<')) fail('header CTA missing');
if (!home.includes('>Donate<')) fail('donate link missing');
const footer = home.slice(home.lastIndexOf('<footer'));
for (const label of ['Programs', 'Events', 'About', 'Mentors', 'Contact', 'Privacy', 'Terms', 'Child Safety', 'Accessibility', 'Parents']) {
  if (!footer.includes('>' + label + '<')) fail('footer missing ' + label);
}
if (!footer.includes('href="mailto:info@afrobot.org"')) fail('footer missing email');
if (!footer.includes('© 2026 AfroBot. AfroBot is a program of Glappy Foundation, a Texas nonprofit corporation.')) fail('footer missing the Glappy legal line');
if (!footer.includes('assets/logo-afrobot-reversed.svg')) fail('footer logo missing');
if (!home.includes('Sponsor a student') || !home.includes('The camp-week participation goal is $100 per child.')) fail('sponsor band missing');
if (footer.includes('Our classrooms in Cameroon') || footer.includes('close__photos')) fail('footer still has the classroom photo strip');
if (home.includes('stickycta') || programs.includes('stickycta')) fail('sticky mobile bar is still in the page');
if (home.includes('<option>Student</option>')) fail('Student role option is still on the form');
if (home.includes('mckinney-build-day-2024-cutout')) fail('homepage still uses the group cutout');
if (!home.includes('assets/photos/mckinney-build-day-2024.jpg')) fail('homepage missing the McKinney build-day photo');
const robots = fs.readFileSync(path.join(root, 'robots.txt'), 'utf8');
const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
if (!robots.includes('Sitemap: https://afrobot.org/sitemap.xml')) fail('robots.txt missing canonical sitemap');
if (!sitemap.includes('https://afrobot.org/') || !sitemap.includes('https://afrobot.org/programs')) fail('sitemap missing canonical urls');

const css = ['components.css', 'styles.css', 'tokens.css', 'visual.css', 'funder.css', 'finish.css'].map((name) => fs.readFileSync(path.join(root, name), 'utf8')).join('\n');
if (/#F6C445|#F6E4DC/i.test(css)) fail('yellow remains in css');
if (/color:\s*var\(--ink-40\)/.test(fs.readFileSync(path.join(root, 'components.css'), 'utf8'))) fail('components.css uses ink-40 as text');
if (!css.includes('Public Sans') || !css.includes('PublicSans-VF.woff2')) fail('Public Sans WOFF2 is not served');
if (/url\(fonts\/Inter/.test(css)) fail('old body font is still requested');
if (!css.includes('fonts/Outfit-Latin.woff2')) fail('Outfit wordmark font is not served');

function lum(hex) {
  const c = hex.slice(1).match(/../g).map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a, b) {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
for (const [fg, bg, min] of [['#142033', '#FFFFFF', 4.5], ['#142033', '#F3F6F4', 4.5], ['#1E2326', '#F3F6F4', 4.5], ['#3E4C5E', '#FFFFFF', 4.5], ['#3E4C5E', '#F3F6F4', 4.5], ['#FFFFFF', '#164A38', 4.5], ['#FFFFFF', '#0F3D32', 4.5], ['#164A38', '#FFFFFF', 4.5], ['#164A38', '#F3F6F4', 4.5], ['#FFFFFF', '#B9380F', 4.5], ['#FFFFFF', '#8C2A0A', 4.5], ['#B9380F', '#FFFFFF', 4.5], ['#FFFFFF', '#142033', 4.5], ['#D6DEEA', '#142033', 4.5]]) {
  const ratio = contrast(fg, bg);
  if (ratio < min) fail('contrast ' + fg + ' on ' + bg + ' is ' + ratio.toFixed(2));
}

for (const file of ['script.js', 'api/interest.js', 'api/volunteer.js', 'api/_lib.js', 'api/interest-export.js', 'scripts/build.mjs', 'scripts/lint.mjs', 'scripts/responsive-check.mjs']) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
  if (result.status !== 0) fail(file + ' failed node --check\n' + result.stderr);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('lint ok: ' + files.length + ' pages, ' + intents.size + ' intents');
