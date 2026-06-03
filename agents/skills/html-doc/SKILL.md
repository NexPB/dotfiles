---
name: html-doc
description: "Generate a polished, self-contained HTML document in the claude.ai design system from the current conversation — a design doc for developers or a communication doc for stakeholders. Use when asked to turn a plan, design, or feature discussion into a shareable styled HTML page, design doc, or stakeholder overview."
argument-hint: "[design | stakeholder]"
user-invocable: true
---

# Styled HTML documents

Turn what we've discussed in this conversation into a single HTML document, styled in
the warm "claude.ai design system" (cream/ink palette, serif headings, embedded CSS,
minimal JavaScript). The HTML is rendered first, then you proofread it and iterate
before it's final.

Two modes:

- **`design`** — an engineering design doc for developers: architecture, sequence,
  components, code, data models, implementation steps, risks.
- **`stakeholder`** — a communication doc for non-technical readers: benefits,
  a simple how-it-works, roadmap, talking points, FAQ. **No code or jargon.**

## Inputs

- The content comes from the **current conversation** — a plan, design, or feature
  we have been working through. There is no file argument to parse.
- The argument (if given) is the doc type: `design` or `stakeholder`.

## Workflow

### Step 1 — Pick the doc type

Use the argument if present. Otherwise infer from the request ("design doc / for the
team / technical" → `design`; "for stakeholders / overview / customer success / non-
technical" → `stakeholder`). If it's genuinely ambiguous, ask the user which one.

### Step 2 — Gather the content

From the conversation, determine:

- the **title** and a one-line **subtitle**,
- the **sections** that matter for this doc type,
- supporting detail (for `design`: file paths, code, data shapes, sequence, risks;
  for `stakeholder`: benefits, plain-language steps, prerequisites, timeline, FAQs).

Do not invent facts. If a section has no basis in the conversation, leave it out
rather than padding. If something essential is missing, ask a brief question.

### Step 3 — Choose components

Read `references/components.md` and map the gathered content onto the best-fitting
visuals, following the recommended flow for the chosen type:

- **design**: Header → Lead/TL;DR → TOC → Context → Goals/Non-goals → Architecture
  diagram → Sequence → Components → Data/constraints → Implementation steps →
  Testing → Open questions/risks → Footer.
- **stakeholder**: Header → Lead → Why it matters (value cards) → How it works
  (friendly step flow) → What's needed (checklist) → In/out of scope → Roadmap →
  Talking points → FAQ → Footer.

Use the full visual range: diagrams, branches, cards, timelines, token-colored code.
The catalog is a starting point, not a ceiling — you may compose new layouts and add
CSS (or inline JS) to the page when the content calls for it, as long as you build on
the existing design tokens (palette, fonts, radius, shadow) and respect the
invariants below.

### Step 4 — Assemble the HTML

Start from `references/template.html`, but treat it as a **reference, not a fixed
scaffold.** It exists to give you a consistent, on-brand starting point — it shows the
design language (the `<style>` block, the header and section structure). You are free
to change it heavily for the doc at hand: restructure the layout, rewrite or extend
the CSS, drop components you don't need, and add entirely new ones. The template is a
floor, not a ceiling; the only things to carry through every doc are the design tokens
and the invariants below.

Replace `{{TITLE}}`, fill the header (eyebrow label, title, subtitle, meta badges —
include a status, the date `2026-06-03`, and a repo chip for design docs), build the
body from the chosen component blocks, and write the footer. Number `<h2>` sections
with `<span class="num">NN</span>` and (for design docs) link them from the TOC.

Write to `docs/<kebab-topic>-<type>.html` in the current repo — e.g.
`docs/payment-retries-design.html`. Create the `docs/` directory if it doesn't exist.

### Step 5 — Proofread gate (required)

**Open the rendered HTML for the user and have them proofread it** before treating
the doc as done: tell them the path and offer to open it (`open docs/<file>.html` on
macOS). Do **not** consider it final until they explicitly approve. Loop here: revise
the HTML on their feedback — content, structure, or visuals — and re-open it until
they sign off.

### Step 6 — Report

Once approved, confirm the final HTML path to the user.

## Invariants

These keep the output on-brand and shareable — they do **not** cap the visuals.

- A single `.html` file with all CSS in the `<style>` block.
- Keep JavaScript to a minimum — prefer pure HTML/CSS, and reach for JS only when it
  clearly earns its place (e.g. syntax highlighting). Offline use is not a requirement.
- Keep external resources limited (no CDN fonts or linked stylesheets, and no
  unconfirmed remote scripts) — a trusted library like `sugar-high` is fine.
- Visual freedom is encouraged: add CSS, invent new layouts/components, and use a
  little JS for richer or interactive visuals when the content benefits. The catalog
  is a floor, not a ceiling.
- Stay on-brand by reusing the design tokens (warm palette, serif/sans/mono, radius,
  shadow) rather than introducing off-palette colors or fonts.
- Color code with `https://cdn.jsdelivr.net/npm/sugar-high@1/lib/index.min.js`.
- Design docs get a TOC and numbered sections; stakeholder docs stay jargon-free.

## References

- https://thariqs.github.io/html-effectiveness/#code-review
