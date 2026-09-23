---
name: html-doc
description: "Generate a polished, self-contained HTML document in the claude.ai design system from the current conversation — a design doc for developers or a communication doc for stakeholders. Use when asked to turn a plan, design, or feature discussion into a shareable styled HTML page, design doc, or stakeholder overview."
argument-hint: "[design | stakeholder]"
user-invocable: true
---

# Styled HTML documents

Turn the plan, design or feature from this conversation into one HTML file in the warm claude.ai design system: cream and ink palette, serif headings, embedded CSS, little JavaScript. The user proofreads the rendered page before it is final.

Two types:

- **`design`**: an engineering design doc. Architecture, sequence, components, code, data models, implementation steps, risks.
- **`stakeholder`**: a doc for non-technical readers. Benefits, a plain how-it-works, roadmap, talking points, FAQ. No code and no jargon, because the reader cannot use either.

## 1. Pick the type

Use the argument. Otherwise infer it: "design doc", "for the team", "technical" → `design`; "stakeholders", "overview", "customer success", "non-technical" → `stakeholder`. Ask only when the request fits both.

## 2. Gather the content

From the conversation, take the title, a one-line subtitle, the sections this type needs, and the detail behind them (`design`: paths, code, data shapes, sequence, risks; `stakeholder`: benefits, plain steps, prerequisites, timeline, FAQ).

The conversation is the only source. Leave out a section that it gives no basis for, rather than invent facts. Ask one short question only when something essential is missing.

Match the length to the content. Cover the substance, and add no filler section, repeated summary or boilerplate to fill the template.

## 3. Choose the components

Read `references/components.md` and map the content onto it, in this order:

- **design**: Header → Lead/TL;DR → TOC → Context → Goals/Non-goals → Architecture diagram → Sequence → Components → Data/constraints → Implementation steps → Testing → Open questions/risks → Footer.
- **stakeholder**: Header → Lead → Why it matters (value cards) → How it works (step flow) → What's needed (checklist) → In/out of scope → Roadmap → Talking points → FAQ → Footer.

Use diagrams, branches, cards, timelines and highlighted code where they carry the content.

## 4. Assemble the HTML

Start from `references/template.html`. It shows the design language: the `<style>` block, the header and the section structure. The template and the component catalog are a starting point. Restructure the layout, rewrite the CSS, drop components and compose new ones when the content calls for it, within the invariants below.

Fill `{{TITLE}}` and the header: the eyebrow label, the title, the subtitle, and meta badges for the status, today's date and, for design docs, the repo. Number each `<h2>` with `<span class="num">NN</span>`, and link the sections from the TOC in design docs.

Write to `docs/<kebab-topic>-<type>.html` in the current repo, for example `docs/payment-retries-design.html`.

## 5. Proofread

Open the file (`open docs/<file>.html` on macOS) and ask the user to proofread it. Revise on their feedback, then open it again. The doc is final only when they approve it. Then give the path.

## Invariants

- One `.html` file, with all CSS in the `<style>` block.
- Reuse the design tokens: the warm palette, the serif, sans and mono fonts, the radius and the shadow. Add no off-palette color or font.
- Use no CDN font, no linked stylesheet and no unknown remote script. Highlight code with `https://cdn.jsdelivr.net/npm/sugar-high@1/lib/index.min.js`.
- Prefer HTML and CSS. Add JavaScript only for a visual that needs it.
- Design docs get a TOC and numbered sections. Stakeholder docs stay free of jargon.

## References

- https://thariqs.github.io/html-effectiveness/#code-review
