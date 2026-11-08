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
  ['about.html', 'about.html', 'About · AfroBot', 'AfroBot is a kids-only youth robotics and AI program, founded by Dr. Unoma Okorafor and Dr. Russell Avre.', '/about', ''],
  ['programs.html', 'programs.html', 'Programs · AfroBot', 'Discover through Advance. $100 per child for a camp week is the participation goal.', '/programs', ''],
  ['competitions.html', 'competitions.html', 'Competitions · AfroBot', 'One yearly competition, with 2027 hubs in Texas (DFW), Cameroon (Yaoundé), and Tanzania. Dates coming soon.', '/competitions', ''],
  ['university-pathways.html', 'university-pathways.html', 'University Pathways · AfroBot', 'Older students mentor younger teams with an adult coach. AfroBot does not guarantee admission or scholarships.', '/university-pathways', ''],
  ['community.html', 'community.html', 'Community · AfroBot', 'Parents, students through a parent, mentors, sponsors, schools, and manufacturers can register interest.', '/community', ''],
  ['partners.html', 'partners.html', 'Partners · AfroBot', 'Sponsor goals for Discover, Build, Innovate, Compete, and Advance. No partners are named.', '/partners', ''],
  ['events.html', 'events.html', 'Events · AfroBot', 'McKinney Build Day, 2024. No upcoming event is on the calendar. Dates coming soon.', '/events', ''],
  ['contact.html', 'contact.html', 'Contact · AfroBot', 'Write to AfroBot at info@afrobot.org.', '/contact', ''],
  ['privacy.html', 'privacy.html', 'Privacy · AfroBot', 'What the AfroBot interest form collects.', '/privacy', ''],
  ['terms.html', 'terms.html', 'Terms · AfroBot', 'No session is open for registration from this site.', '/terms', ''],
  ['child-safety.html', 'child-safety.html', 'Child safety · AfroBot', 'Children take part through a parent or guardian.', '/child-safety', ''],
  ['accessibility.html', 'accessibility.html', 'Accessibility · AfroBot', 'AfroBot aims for WCAG 2.2 AA. Report a barrier to info@afrobot.org.', '/accessibility', ''],
  ['volunteer.html', 'volunteer.html', 'Volunteer · AfroBot', 'Mentor and volunteer inquiries. Screening is required before working with students.', '/volunteer', ''],
  ['partnership.html', 'partnership.html', 'Partnership inquiries · AfroBot', 'Sponsorship and partnership inquiries.', '/partnership', ''],
  ['social.html', 'social.html', 'Social · AfroBot', 'No social accounts are listed. Reach AfroBot at info@afrobot.org.', '/social', ''],
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
  fs.writeFileSync(path.join(root, out), banner + html);
  process.stdout.write('wrote ' + out + '\n');
}
