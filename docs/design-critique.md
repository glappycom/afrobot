# Design critique

Reviewed from screenshots of every page at 1440 and 390, taken before this visual pass. The copy is in place. The interface is not ready to put in front of Bill Gates.

## What the screenshots show

The site reads as a competent document theme, not as a product. Every page opens the same way: a navy utility strip, a white bar, an orange kicker, and a left-aligned headline sitting in a wide empty field. Interior pages then drop into a pale gray band with one short paragraph and a large unused area. That rhythm is the same on Programs, Competitions, University Pathways, Community, Volunteer, and the policy pages. A visitor can tell the pages were assembled from one template.

### Home, 1440 and 390

- The first screen is a photo with three competing lines of type, three buttons, and a status line. Sponsor a Student wraps onto its own row. The eye has no single action.
- The headline is large, then the tagline and the supporting line repeat the same idea at almost the same size. Hierarchy collapses.
- White type sits across faces. On a phone the headline, three full-width buttons, and “Dates coming soon” cover the group. The robots are a sliver at the bottom.
- The impact numerals are cut off by the bottom edge of a 900px window. They do not land as a statement.
- Below that, the page keeps going: a map, a timeline, two photos, five stage cards, the same numbers again, eight measure chips, a $10 paragraph, a Dallas block, a budget line, a four-field finder, three photo cards, five session cards, a cost block, a McKinney story, three more photos, videos, a closing band, and a form. That is a brochure stacked on a brochure.
- Stage cards are small white boxes with a hairline border. The connecting line is a thin orange stroke that does not carry the section.
- The Cameroon-to-Dallas “map” is a curve floating in white space. It looks like a diagram that was not finished.

### Interior pages

- Programs at 1440: the headline block is short, then a gray band with “Access” and one sentence, then another white band whose first line is an orphan (“Ages 13–17…”) above cropped cards. The sections do not share a vertical rhythm.
- About: founder portraits are fine, then the names are sliced by the bottom of the viewport and a sentence floats alone on the right. The two-column split is unbalanced.
- Events: two photos side by side with different crops and no shared frame. The left image is an awkward tight crop of a shirt.
- Competitions and University Pathways: a headline, a gray void, then the form already intruding. The pages feel unfinished because the content block is one narrow column in a 1440px canvas.
- Partners: four bordered boxes, then a price list. The boxes have the same weight as the headline, so nothing is primary.
- Community: a stack of full-width rows that look like a settings screen. “Register interest” repeats in the same orange underline.
- Volunteer and Contact: the form is the most finished piece on the site, and it still looks like a default two-column layout. Labels are small. The page hero and the form heading compete.
- Mentorship on a phone: headline, then Responsibilities, Skills, Availability as the same bold heading plus one sentence, with no change in scale or space. It reads as an outline.
- Privacy, Terms, Child Safety, Accessibility, Social: the same hero and a narrow text column. Acceptable for policy pages, and still visually identical to the program pages, which makes the program pages feel like policy pages.

### System problems, on every page

- Two headers. The navy Contact / Support / Volunteer strip plus the logo bar eats height and looks like a free theme.
- One typeface at a few close sizes. Nothing is display type. Body copy is small against the empty space, so the pages feel both sparse and cramped.
- Spacing is not on a grid. Some bands are tight, some are empty gray fields, and the padding changes from page to page.
- Buttons disagree. Filled orange, white, and ghost buttons sit together, with square corners in one place and small radii in another. Text links are underlined in orange like a default anchor.
- Cards are boxes: 1px border, 8px radius, white fill. They tile the page instead of holding a photograph or a number.
- Photos do not share an aspect ratio or a crop. Some are 4:3, some are sliced by the next section, and the hero crop favors the middle of the group.
- Alignment is left-only, which is fine, but the measure of the text never changes. A 1440px screen shows a 600px column and a blank right half.
- The footer is a correct link list and nothing more. It does not close the page.

## What has to change

Fewer, larger moves. One header. A full-bleed hero with two actions. Impact numbers at a size you can read from across a room. One photographic story. One stage journey. Dallas 2027. A three-part close. Everything else belongs on Programs, About, or Events. The type, the spacing, the buttons, and the photographs have to come from one system, on an 8px grid, with real section padding and a container near 1200px.
