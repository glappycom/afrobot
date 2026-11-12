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
const facts = JSON.parse(read('content/facts.json'));
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
  ['index.html', 'home.html', 'AfroBot · Building the Next Generation of Global Innovators.', 'Established programs in Cameroon and growing initiatives in the United States.', '/', orgJson + '\n<link rel="preload" as="image" href="assets/photos/mckinney-build-day-2024-960.avif" imagesrcset="assets/photos/mckinney-build-day-2024-960.avif 960w, assets/photos/mckinney-build-day-2024.avif 1000w" imagesizes="100vw" type="image/avif" fetchpriority="high">'],
  ['mentorship.html', 'mentorship.html', 'Mentorship · AfroBot', 'Mentor with AfroBot. Screening is required before working with students.', '/mentorship', ''],
  ['about.html', 'about.html', 'About · AfroBot', 'AfroBot is a program of Glappy Foundation, a 501(c)(3) nonprofit organization. Programs in Cameroon, a US pilot, and a proposed US season.', '/about', ''],
  ['programs.html', 'programs.html', 'Programs · AfroBot', 'Academy, League, and Innovation Lab. Discover through Advance. $100 per child for a camp week is the participation goal.', '/programs', ''],
  ['usa.html', 'usa.html', 'AfroBot USA · AfroBot', 'Proposed US season from August 2027, with a Dallas championship in April 2028 pending partner confirmation.', '/usa', ''],
  ['africa.html', 'africa.html', 'AfroBot Africa · AfroBot', 'Cameroon is the operating foundation of AfroBot. About 5,000 children trained and about 1,500 learning now.', '/africa', ''],
  ['impact.html', 'impact.html', 'Our Impact · AfroBot', 'Founder-reported reach in Cameroon and the McKinney, Texas pilot.', '/impact', ''],
  ['moonshot.html', 'moonshot.html', 'Our Moonshot · AfroBot', 'An ambition to help many more young people learn robotics and AI without a matching rise in teachers and facilities.', '/moonshot', ''],
  ['collaboration.html', 'collaboration.html', 'Global Collaboration · AfroBot', 'A proposed program for virtual challenges, cross-border teams, mentoring, and showcases.', '/collaboration', ''],
  ['challenge.html', 'challenge.html', 'Global Innovation Challenge · AfroBot', 'A proposed challenge. No dates, awards, funding, or participant list yet.', '/challenge', ''],
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
];

for (const [out, src, title, description, urlPath, headExtra] of pages) {
  let content = read(path.join('src/pages', src)).trim();
  content = content.replaceAll('{{roles}}', roles);
  content = content.replaceAll('{{videos-home}}', videosHome);
  content = content.replaceAll('{{videos}}', videosAll);
  content = content.replace(/\{\{register(?::([a-z]+))?\}\}/g, (_, intent) => register.replaceAll('{{default-intent}}', intent || ''));
  for (const [key, value] of Object.entries(facts)) {
    if (key === 'verified' || key === 'source') continue;
    content = content.replaceAll('{{facts.' + key + '}}', esc(String(value)));
  }
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
