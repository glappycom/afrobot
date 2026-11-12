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
const media = JSON.parse(read('content/media.json'));
const site = JSON.parse(read('content/site.json'));

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function mediaLabel(item) {
  const name = item.caption || item.title || '';
  return item.year ? name + ', ' + item.year : name;
}

function galleryHtml(place) {
  const photos = (media.photos || []).filter((item) => item.place === place && item.consent);
  if (!photos.length) return '<p class="media-empty">' + esc(media.empty?.[place] || 'No photos of this place are on the site yet.') + '</p>';
  const shots = photos.map((item) => {
    const label = mediaLabel(item);
    return '<button type="button" class="work-shot" data-full="' + esc(item.src) + '" data-alt="' + esc(item.alt) + '" data-caption="' + esc(label) + '">'
      + '<img src="' + esc(item.src) + '" alt="' + esc(item.alt) + '" width="' + item.width + '" height="' + item.height + '" loading="lazy" decoding="async">'
      + '<span class="work-shot__cap">' + esc(label) + '</span></button>';
  }).join('\n');
  return '<div class="work-gallery">' + shots
    + '<dialog class="work-lightbox"><button type="button" class="work-lightbox__close">Close</button><img alt=""><p></p></dialog></div>';
}

function videoHtml(place) {
  const clips = (media.videos || []).filter((item) => item.place === place && item.consent);
  if (!clips.length) return '';
  return clips.map((item) => {
    const label = mediaLabel(item);
    if (item.kind === 'file') {
      return '<figure class="work-video"><video controls playsinline preload="metadata" poster="' + esc(item.poster) + '">'
        + '<source src="' + esc(item.src) + '" type="video/mp4"></video><figcaption>' + esc(label) + '</figcaption></figure>';
    }
    return '<figure class="work-video"><div class="video-facade"><button type="button" class="video-play" data-video="' + esc(item.id) + '" aria-label="Play video: ' + esc(item.title) + '">'
      + '<img src="' + esc(item.poster) + '" alt="Preview image: ' + esc(item.title) + '" width="480" height="360" loading="lazy" decoding="async">'
      + '<span class="video-play__icon" aria-hidden="true"></span></button></div><figcaption>' + esc(label) + '</figcaption></figure>';
  }).join('\n');
}

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
  ['index.html', 'home.html', 'AfroBot · Kids in Cameroon and the US learning to build robots and AI.', 'Kids in Cameroon have been building and coding robots since November 2022. A pilot in McKinney, Texas, followed in 2024.', '/', orgJson + '\n<link rel="preload" as="image" href="assets/photos/mckinney-build-day-2024-960.avif" imagesrcset="assets/photos/mckinney-build-day-2024-960.avif 960w, assets/photos/mckinney-build-day-2024.avif 1000w" imagesizes="100vw" type="image/avif" fetchpriority="high">'],
  ['mentorship.html', 'mentorship.html', 'Mentorship · AfroBot', 'Mentor with AfroBot. Screening is required before working with students.', '/mentorship', ''],
  ['about.html', 'about.html', 'About · AfroBot', 'AfroBot is a program of Glappy Foundation, a 501(c)(3) nonprofit organization. Kids in Cameroon have been building robots since November 2022.', '/about', ''],
  ['programs.html', 'programs.html', 'Programs · AfroBot', 'Academy, League, and Innovation Lab. Discover through Advance. $100 per child for a camp week is the participation goal.', '/programs', ''],
  ['usa.html', 'usa.html', 'AfroBot USA · AfroBot', 'We plan a US season. The four regions are tentative. A Dallas championship in April 2028 is proposed.', '/usa', ''],
  ['africa.html', 'africa.html', 'AfroBot Africa · AfroBot', 'Kids in Cameroon have been building and coding robots since November 2022. About 5,000 have trained and about 1,500 learn with us now.', '/africa', ''],
  ['impact.html', 'impact.html', 'Our Impact · AfroBot', 'About 5,000 kids trained in Cameroon and about 50 in the 2024 McKinney pilot.', '/impact', ''],
  ['moonshot.html', 'moonshot.html', 'Our Moonshot · AfroBot', 'A hope to teach many more kids to build robots without ten times the teachers or rooms. We have not done it.', '/moonshot', ''],
  ['collaboration.html', 'collaboration.html', 'Teams in two countries · AfroBot', 'We plan for a US group and a Cameroon group to share a project. No date yet.', '/collaboration', ''],
  ['challenge.html', 'challenge.html', 'Global Innovation Challenge · AfroBot', 'Project ideas for student teams. No date, prize, or list of kids yet.', '/challenge', ''],
  ['competitions.html', 'competitions.html', 'Competitions · AfroBot', 'The 2027 footprint is Texas (Dallas–Fort Worth) and Cameroon (a Yaoundé event that AfroBot is hosting). The first season is an 8-team pilot.', '/competitions', ''],
  ['university-pathways.html', 'university-pathways.html', 'University Pathways · AfroBot', 'Older students mentor younger teams with an adult coach.', '/university-pathways', ''],
  ['community.html', 'community.html', 'Community · AfroBot', 'Parents, students through a parent, mentors, sponsors, schools, and manufacturers can register interest.', '/community', ''],
  ['partners.html', 'partners.html', 'Partners · AfroBot', 'Ways to help pay for a child’s place. Partner names are not listed yet.', '/partners', ''],
  ['events.html', 'events.html', 'Events · AfroBot', 'McKinney Build Day, 2024. The 2027 footprint is Texas and Cameroon.', '/events', ''],
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
  content = content.replaceAll('{{gallery:cameroon}}', galleryHtml('cameroon'));
  content = content.replaceAll('{{gallery:usa}}', galleryHtml('usa'));
  content = content.replaceAll('{{videos:cameroon}}', videoHtml('cameroon'));
  content = content.replaceAll('{{videos:usa}}', videoHtml('usa'));
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
