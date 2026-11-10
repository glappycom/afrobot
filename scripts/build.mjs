import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const header = read('src/partials/header.html').trim();
const footer = read('src/partials/footer.html').trim();
const roles = read('src/partials/roles.html').trim();
const register = read('src/partials/register.html').trim();
const videoItems = read('src/partials/videos.html').trim().split(/(?=<article\b)/).map((item) => item.trim()).filter(Boolean);
const videosHome = videoItems.slice(0, 3).join('\n');
const videosAll = videoItems.join('\n');
const layout = read('src/layout.html');
const impact = JSON.parse(read('content/impact.json'));
const site = JSON.parse(read('content/site.json'));

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

const orgJson = `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  "name": "AfroBot",
  "url": "https://afrobot.org/",
  "email": "info@afrobot.org",
  "description": "Kids-only youth robotics and AI program."
}
</script>`;

const pages = [
  ['index.html', 'home.html', 'AfroBot · Every Child Deserves a Chance to Build the Future.', 'Affordable workshops lead to robotics, AI, mentorship, and pathways.', '/', orgJson + '\n<link rel="preload" as="image" href="assets/photos/mckinney-build-day-2024-960.avif" imagesrcset="assets/photos/mckinney-build-day-2024-960.avif 960w, assets/photos/mckinney-build-day-2024.avif 1000w" imagesizes="100vw" type="image/avif" fetchpriority="high">'],
  ['mentorship.html', 'mentorship.html', 'Mentorship · AfroBot', 'Mentor with AfroBot. Screening is required before working with students.', '/mentorship', ''],
  ['about.html', 'about.html', 'About · AfroBot', 'AfroBot is a program of Glappy Foundation, a 501(c)(3) nonprofit organization.', '/about', ''],
  ['programs.html', 'programs.html', 'Programs · AfroBot', 'Discover through Advance. $100 per child for a camp week is the participation goal.', '/programs', ''],
  ['competitions.html', 'competitions.html', 'Competitions · AfroBot', 'The 2027 footprint is Texas (Dallas–Fort Worth), Cameroon (a Yaoundé event that AfroBot is hosting), and Tanzania. The first season is an 8-team pilot.', '/competitions', ''],
  ['university-pathways.html', 'university-pathways.html', 'University Pathways · AfroBot', 'Older students mentor younger teams with an adult coach.', '/university-pathways', ''],
  ['community.html', 'community.html', 'Community · AfroBot', 'Parents, students through a parent, mentors, sponsors, schools, and manufacturers can register interest.', '/community', ''],
  ['partners.html', 'partners.html', 'Partners · AfroBot', 'Partner schools in Cameroon and Tanzania, and sponsor goals for Discover, Build, Innovate, Compete, and Advance.', '/partners', ''],
  ['events.html', 'events.html', 'Events · AfroBot', 'McKinney Build Day, 2024. The 2027 footprint is Texas, Cameroon, and Tanzania.', '/events', ''],
  ['contact.html', 'contact.html', 'Contact · AfroBot', 'Write to AfroBot at info@afrobot.org.', '/contact', ''],
  ['privacy.html', 'privacy.html', 'Privacy · AfroBot', 'What the AfroBot interest form collects.', '/privacy', ''],
  ['terms.html', 'terms.html', 'Terms · AfroBot', 'Sessions aren’t open for registration on this site yet.', '/terms', ''],
  ['child-safety.html', 'child-safety.html', 'Child safety · AfroBot', 'AfroBot commitments on screening, supervision, photo consent, reporting, and event safety.', '/child-safety', ''],
  ['accessibility.html', 'accessibility.html', 'Accessibility · AfroBot', 'AfroBot aims for WCAG 2.2 AA. Report a barrier to info@afrobot.org.', '/accessibility', ''],
  ['volunteer.html', 'volunteer.html', 'Volunteer · AfroBot', 'Mentor and volunteer inquiries. Screening is required before working with students.', '/volunteer', ''],
  ['partnership.html', 'partnership.html', 'Partnership inquiries · AfroBot', 'Sponsorship and partnership inquiries.', '/partnership', ''],
  ['social.html', 'social.html', 'Social · AfroBot', 'Reach AfroBot at info@afrobot.org for session updates.', '/social', ''],
  ['concepts/audience-a.html', 'audience-a.html', 'Concept A · Editorial rows · AfroBot', 'Preview of three full-width audience bands. Not the home page.', '/concepts/audience-a', '<base href="/"><meta name="robots" content="noindex">'],
  ['concepts/audience-b.html', 'audience-b.html', 'Concept B · Audience selector · AfroBot', 'Preview of an accessible audience selector. Not the home page.', '/concepts/audience-b', '<base href="/"><meta name="robots" content="noindex">'],
  ['concepts/audience-c.html', 'audience-c.html', 'Concept C · Sticky audience list · AfroBot', 'Preview of a sticky heading with scrolling audience entries. Not the home page.', '/concepts/audience-c', '<base href="/"><meta name="robots" content="noindex">'],
];

for (const [out, src, title, description, urlPath, headExtra] of pages) {
  let content = read(path.join('src/pages', src)).trim();
  content = content.replaceAll('{{roles}}', roles);
  content = content.replaceAll('{{videos-home}}', videosHome);
  content = content.replaceAll('{{videos}}', videosAll);
  content = content.replace(/\{\{register(?::([a-z]+))?\}\}/g, (_, intent) => register.replaceAll('{{default-intent}}', intent || ''));
  for (const [key, value] of Object.entries(impact)) content = content.replaceAll('{{impact.' + key + '}}', esc(String(value)));
  content = content.replaceAll('{{stage-mode}}', site.stageNames === 'access' ? 'access' : 'current');
  if (out === 'volunteer.html') content = content.replace('action="/api/interest"', 'action="/api/volunteer"');
  if (content.includes('{{')) throw new Error('Unresolved placeholder in ' + src);
  const html = layout
    .replaceAll('{{TITLE}}', esc(title))
    .replaceAll('{{DESCRIPTION}}', esc(description))
    .replaceAll('{{CANONICAL}}', 'https://afrobot.org' + urlPath)
    .replaceAll('{{HEAD_EXTRA}}', headExtra)
    .replaceAll('{{HEADER}}', header)
    .replaceAll('{{FOOTER}}', footer)
    .replaceAll('{{CONTENT}}', content);
  if (html.includes('{{')) throw new Error('Unresolved layout placeholder for ' + out);
  const banner = '<!-- Generated by scripts/build.mjs from src/pages/' + src + '. Edit the source, then npm run site:build. -->\n';
  const dest = path.join(root, out);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, banner + html);
  process.stdout.write('wrote ' + out + '\n');
}
