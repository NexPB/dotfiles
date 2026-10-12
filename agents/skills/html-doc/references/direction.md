# Design direction

Adapted from the Read mode and the craft floor of [Impeccable](https://github.com/pbakaus/impeccable) (Apache 2.0, commit `c63b8dd`), narrowed to documents.

## Frame and column

A document is read, so it reads as a document first: a design doc, a guide, a review. The theme owns the frame and stays out of the column.

- **Frame:** the header, the section openers, the TOC, and how code, tables, diagrams and callouts are set. Here the theme commits fully: its palette, its display face, and one signature move.
- **Column:** the running text. A reading face, body near 16px, a measure of 60 to 75 characters, contrast of at least 4.5:1. Nothing decorative behind the text.

## Choosing a world

Take the world from the subject and the reader, not from habit. Publishing traditions transfer best: reference manuals, timetables, field guides, type specimens, lab notebooks, newspaper wayfinding. A brand's own site gives the palette and the display face.

Pick one signature move and use it where it earns its place: a masthead, a coloured rail, margin notes, a numbering scheme, a distinctive way of setting code or tables. Do not repeat it around every element.

Choose light or dark from where the page is read, then define the other set too.

## Self-check on the render

- Cover the title. If the page could belong to any other document, push the frame further into the world.
- If the page reads as a poster before it reads as a document, the world has reached the column. Pull it back to the frame.
- A reader can tell where they are and where to go next.

## Floor

Check these on the rendered page, together, once:

- Body and secondary text at least 4.5:1, large text at least 3:1. On a tinted ground, tint the secondary text from that hue instead of grey.
- More space above a heading than below it. Tight groups, generous separation.
- Shadows have an offset and a soft blur.
- Theme the browser defaults: `::selection`, `:focus-visible`, link underline offset, and `font-variant-numeric: tabular-nums` in tables.

## Refuse

These are defaults to avoid. The user's brief can earn any of them back, except the eyebrow.

- An eyebrow or kicker label above a heading.
- Section numbers, unless readers cite sections by number.
- Same-size cards of icon, heading and text as the page structure. Nested cards.
- Emoji or Unicode glyphs standing in for icons. Draw an SVG or drop the icon.
- A coloured `border-left` or `border-right` wider than 1px on a callout, quote or list item.
- Gradient text, decorative glass or blur.
- Hard offset shadows (`4px 4px 0`), unless the world is brutalist.
- Monospace as a costume for "technical". Mono is for code, paths, identifiers and measurements.
