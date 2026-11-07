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
if (serverRoles.length !== 6) fail('Could not read server roles');

const requiredHome = [
  'Every Child Deserves a Chance to Build the Future.',
  'Affordable robotics, AI, and engineering education that helps young people move from curiosity to creation, from local communities to recognized competitions, and from limited access to meaningful opportunity.',
  'Join the AfroBot Community',
  'Explore Programs',
  'Sponsor a Student',
  'Talent Is Everywhere. Opportunity Isn',
  'From Curiosity to Opportunity',
  'Find Your Starting Point',
  'World-Class Opportunities. Community-Friendly Costs.',
  'From Our Community to the Competition Stage.',
  'The Journey Doesn',
  'AfroBot helps students build more than robots. We help them build futures.',
  'It Takes a Community to Build the Future.',
  'Success Is Measured in Opportunity.',
  'The Future Is Being Built.',
  'Make Sure Every Child Has a Place in It.',
  'Join AfroBot',
  'Become a Mentor',
  'Sponsor Opportunity',
  'From Curiosity to Creation. From Community to the World.',
  'Coming soon / register interest',
  'not affiliated with FIRST',
  'The interest list is not team placement.',
];

const banned = [
  [/whalesbot/i, 'WhalesBot'],
  [/k-scale|kscale/i, 'K-Scale'],
  [/zeroth/i, 'Zeroth'],
  [/nsbe/i, 'NSBE'],
  [/baymax/i, 'Baymax'],
  [/disney/i, 'Disney'],
  [/ut dallas|university of texas/i, 'UT Dallas'],
  [/\blego\b/i, 'LEGO'],
  [/tax-deductible|tax deductible|501\s*\(c\)\s*\(3\)|501c3/i, 'tax status'],
  [/renner|75082/i, 'street address'],
  [/\bsuite\b|\bunit\s+\d|\bapt\b/i, 'unit number'],
  [/2025|2027|2028|2029|2030/, 'unconfirmed year'],
  [/\d+(?:\.\d+)?\s*%/, 'percentage'],
];

function localTarget(href) {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('http') || href.startsWith('tel:')) return null;
  return href.split('#')[0].split('?')[0];
}

for (const name of files) {
  const html = fs.readFileSync(path.join(root, name), 'utf8');
  if (html.includes('{{')) fail(name + ' has an unresolved placeholder');
  const h1 = html.match(/<h1\b/gi) || [];
  if (h1.length !== 1) fail(name + ' has ' + h1.length + ' h1 elements');
  if (!html.includes('lang="en"')) fail(name + ' missing lang');
  if (!html.includes('name="viewport"')) fail(name + ' missing viewport');
  if (!html.includes('href="#main"')) fail(name + ' missing skip link');
  if (!html.includes('<main id="main"')) fail(name + ' missing main');
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
  const money = html.match(/\$\d[\d,]*/g) || [];
  for (const amount of money) if (amount !== '$10') fail(name + ' unexpected amount ' + amount);
  if (money.includes('$10') && !/goal/i.test(html)) fail(name + ' uses $10 without calling it a goal');
  if (/\bFIRST\b/.test(html) && !/not affiliated with FIRST/.test(html)) fail(name + ' mentions FIRST without the non-affiliation sentence');
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
  if (html.includes('id="interest"')) {
    const options = [...html.matchAll(/<option>([^<]+)<\/option>/g)].map((m) => m[1]);
    if (options.join('|') !== serverRoles.join('|')) fail(name + ' form roles do not match the API');
    for (const field of ['name="name"', 'name="email"', 'name="role"', 'name="city"', 'name="organization"', 'name="kids"', 'name="message"', 'name="consent"', 'name="website"', 'action="/api/interest"']) {
      if (!html.includes(field)) fail(name + ' form missing ' + field);
    }
  }
}

const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const line of requiredHome) if (!home.includes(line)) fail('homepage missing: ' + line);
for (const label of ['Home', 'About', 'Programs', 'Competitions', 'University Pathways', 'Community', 'Partners', 'Events']) {
  if (!home.includes('>' + label + '<')) fail('nav missing ' + label);
}
for (const label of ['Contact', 'Privacy', 'Terms', 'Child Safety', 'Accessibility', 'Volunteer', 'Partnership Inquiries', 'Social']) {
  if (!home.includes('>' + label + '<')) fail('footer missing ' + label);
}
if (!home.includes('Join the Community') || !home.includes('Sponsor a Student')) fail('header CTAs missing');

const css = fs.readFileSync(path.join(root, 'components.css'), 'utf8');
if (/color:\s*var\(--ink-40\)/.test(css)) fail('components.css uses ink-40 as text');

function lum(hex) {
  const c = hex.slice(1).match(/../g).map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a, b) {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
for (const [fg, bg, min] of [['#0E0F12', '#E6E8EA', 4.5], ['#5A5D66', '#E6E8EA', 4.5], ['#AD3210', '#E6E8EA', 4.5], ['#FFFFFF', '#BF3712', 4.5], ['#FFFFFF', '#0E0F12', 4.5], ['#D5D7DC', '#0E0F12', 4.5], ['#F2F3F5', '#0E0F12', 4.5]]) {
  const ratio = contrast(fg, bg);
  if (ratio < min) fail('contrast ' + fg + ' on ' + bg + ' is ' + ratio.toFixed(2));
}

for (const file of ['script.js', 'api/interest.js', 'api/_lib.js', 'api/interest-export.js', 'scripts/build.mjs', 'scripts/lint.mjs']) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
  if (result.status !== 0) fail(file + ' failed node --check\n' + result.stderr);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('lint ok: ' + files.length + ' pages, ' + intents.size + ' intents');
