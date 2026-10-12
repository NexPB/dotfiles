---
name: html-doc
description: "Generate a polished, self-contained local HTML document from the current conversation or from an existing file (a handoff, plan or research note) — a design doc, a stakeholder overview, a research write-up, a PR review or a setup guide — in a look taken from a named brand or page, the repo's DESIGN.md, or a direction chosen for the subject. Use when asked to turn a plan, design, findings, PR review, how-to or Markdown doc into a readable styled HTML page, or when the user points at impeccable.style for a doc."
argument-hint: "[source file] [design | stakeholder | research | review [reply] | guide] [look: claude | <brand> | <url> | <file.html>]"
user-invocable: true
---

# Styled HTML documents

Turn the plan, design or feature from this conversation, or a document the user names, into one local HTML file: embedded CSS, little JavaScript, and a look chosen for this document. The user proofreads the rendered page before it is final.

Five types:

- **`design`**: an engineering design doc. Architecture, sequence, components, code, data models, implementation steps, risks. It also explains an existing system, with a worked example.
- **`stakeholder`**: a doc for non-technical readers. Benefits, a plain how-it-works, roadmap, talking points, FAQ, and the decisions the reader must make. No code and no jargon, because the reader cannot use either.
- **`research`**: an answer to a question, backed by dated sources, that ends in a recommendation instead of a build plan.
- **`review`**: a review of someone else's change. Findings with a location, a severity and a fix. `review reply` keeps only what to post on the PR.
- **`guide`**: steps the reader runs. Copyable commands, the expected output, troubleshooting by error message, and a prompt for the reader's own LLM.

## 1. Pick the type

Use the argument. Otherwise infer it:

- "design doc", "proposal", "explain how X works", "for the team", "technical" → `design`
- "stakeholders", "overview", "customer success", "director", "non-technical" → `stakeholder`
- "research", "findings", "options", "compare", "what are our options" → `research`
- "review doc", "PR review as a page", "review reply" → `review`
- "guide", "how-to", "setup", "migration", "walk the team through" → `guide`

Ask only when the request fits two types equally.

## 2. Gather the content

The source is the file the user names, or else this conversation. Use only that source. Leave out a section that it gives no basis for, rather than invent facts. Ask one short question only when something essential is missing.

**A named file** (a handoff, a plan or research notes from another session) is already written. The page makes it readable and does not rewrite it. Keep its facts, its wording and its order, and do not summarize it or drop a part of it. Its headings become the sections, in place of the type's section order in step 4. Set each part in the component that reads best: a sequence as steps, a comparison as a table, a caveat as a callout, a file path or command as code. The type only decides whether the page may show code and jargon.

**The conversation**: take the title, a one-line subtitle, the sections this type needs, and the detail behind them:

- `design`: paths, code, data shapes, sequence, risks, and one case with real numbers.
- `stakeholder`: benefits, plain steps, prerequisites, timeline, FAQ, open decisions.
- `research`: the question, each source and the date it was checked, the options and the criteria, the pick and its reason.
- `review`: what the change does, each finding with its `file:line` and a fix, the questions for the author.
- `guide`: each command, the output that shows it worked, and each error met on the way with its fix.

Match the length to the content. Cover the substance, and add no filler section, repeated summary or boilerplate to fill the template.

## 3. Pick the look

Take the first source that applies:

1. **The user names one.** `claude` is the template's own tokens, unchanged. A brand, a site or a URL: fetch the page and its stylesheets with `curl -sL`, because WebFetch returns Markdown without the CSS. Take the colours, the fonts, the radius and the density from the CSS. A local `.html` or an earlier doc: reuse its `:root` tokens and fonts.
2. **The repo has a design system.** A `DESIGN.md` or a token file at the repo root: follow it.
3. **Otherwise**, choose a direction from the subject and the reader, as `references/direction.md` describes. Say it in one line before you build, for example "Look: a field-guide frame in the merchant's navy and amber, plain sans column."

Read `references/direction.md` in every case before you write CSS. A named look sets the palette and the fonts. The direction file still decides how the frame uses them and what the page must not do.

## 4. Choose the components

Read `references/components.md` and map the content onto it, in this order:

- **design**: Header → Lead/TL;DR → TOC → Context → Goals/Non-goals → Architecture diagram → Sequence → Components → Data/constraints → Implementation steps → Testing → Open questions/risks → Footer. To explain an existing system: Header → Lead → Context → How it works → Worked example → Where it breaks → Footer.
- **stakeholder**: Header → Lead → Why it matters (value cards) → How it works (step flow) → What's needed (checklist) → In/out of scope → Roadmap → Talking points → FAQ → Decisions needed → Footer.
- **research**: Header → Lead (the answer) → Question and context → Sources checked → Options comparison → Recommendation → Trade-offs → Open questions → Next steps → References → Footer.
- **review**: Header → Lead (the verdict) → What the change does → Direction → Blocking findings → Non-blocking findings → Questions for the author → Footer. A `reply` keeps Direction and Blocking findings, in ASD-STE100 Simplified Technical English.
- **guide**: Header → Lead (what the reader has at the end) → Prerequisites → Steps (commands and expected output) → Optional setup → Troubleshooting → Prompt for your LLM → Footer.

Use diagrams, branches, cards, timelines and highlighted code where they carry the content.

## 5. Assemble the HTML

Start from `references/template.html`. Its rules read only the tokens in the `:root` theme block, so a new look replaces that block, its dark set and the fonts. Then restyle the frame (header, section openers, TOC, code and tables) for the chosen direction. The template and the component catalog are a starting point. Restructure the layout, rewrite the CSS, drop components and compose new ones when the content calls for it, within the invariants below.

Fill `{{TITLE}}` and the header: the title, the subtitle, and meta badges for the doc type, the status, today's date and, for design docs, the repo. When the doc has a TOC, link each `<h2>` from it.

Write the page as a local file. For a named source file, write it next to that file with the same name, for example `.agents/tmp/handoff.md` → `.agents/tmp/handoff.html`. Otherwise write `docs/<kebab-topic>-<type>.html` in the current repo, for example `docs/payment-retries-design.html`.

## 6. Proofread

Open the file (`open <path>` on macOS) and ask the user to proofread it. Revise on their feedback, then open it again. The doc is final only when they approve it. Then give the path.

Publish only when the user asks to share the page: publish the local file with the Artifact tool. The local file stays the source. Edit it and publish again, and never edit the published copy alone.

## Invariants

- One `.html` file, with all CSS in the `<style>` block.
- Every colour, font, radius and shadow is a token in `:root`, with a dark set under `prefers-color-scheme: dark` and `[data-theme="dark"]`. Rules use tokens, never literal colours.
- Fonts come from the system or from Google Fonts, with a system fallback in each stack. No other linked stylesheet and no unknown remote script. Highlight code with `https://cdn.jsdelivr.net/npm/sugar-high@1.3.0/lib/index.min.js`.
- Prefer HTML and CSS. Add JavaScript only for a visual that needs it, or for the copy button in a guide.
- Design, research and guide docs longer than four sections get a TOC. Stakeholder docs stay free of jargon.

## References

- https://thariqs.github.io/html-effectiveness/#code-review
- https://impeccable.style/ (the source of `references/direction.md`)
