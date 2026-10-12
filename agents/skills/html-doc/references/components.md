# Component catalog

Copy-paste HTML blocks for the `html-doc` skill. The styling for all of these is
already in `template.html`, so they work as-is. They are a **floor, not a ceiling**:
extend them, add CSS to the `<style>` block, and invent new layouts or a little JS
when the content calls for richer visuals. Style through the theme tokens only, so a
theme swap restyles every block, and keep the output a single `.html` file with
JavaScript kept to a minimum.

The header, lead, callouts, and footer are **shared**. Everything else is grouped
by doc type. Mix freely, but lead with the type's primary components.

---

## Shared

### Header (`.doc-head`)
Badges: `status` (warn colour), `aud` (accent, "For: …"), `repo` (monospace), or a
plain badge for the date. The doc type goes in a badge, never in a label above the title.

```html
<header class="doc-head">
  <h1>Document Title</h1>
  <div class="subtitle">One-line description of what this document covers.</div>
  <div class="meta-row">
    <span class="badge status"><span class="dot"></span>MVP · Proposed</span>
    <span class="badge">Updated 2026-06-03</span>
    <span class="badge repo">repo-name/path</span>
  </div>
</header>
```

### Lead / TL;DR (`.lead`)
One bold-accented paragraph right after the header.

```html
<p class="lead">
  A two-to-four sentence summary. Use <strong>strong</strong> for the key idea.
</p>
```

### Callout (`.callout info` / `.callout warn`)
`info` = good news, confirmed fact. `warn` = caveat, gotcha. The title carries the tone.

```html
<div class="callout info">
  <span class="ctitle">Short title</span>
  <p>The body of the callout. The title is optional.</p>
</div>
```

### Section heading
The `id` lets the TOC link to it. Add `<span class="num">01</span>` before the title
only when readers will cite sections by number, as in a design doc reviewed in threads.

```html
<h2 id="context">Section title</h2>
```

### Footer

```html
<footer>
  Design document · 2026-06-03 · repo-name
</footer>
```

---

## Design docs (developers)

Type badge: `Design doc`, `Proposal`, `RFC`, `Explainer`, etc.
Lead with technical depth. Typical flow: Context → Goals/Non-goals → Architecture →
Sequence → Components → Data/constraints → Implementation steps → Testing → Risks.
An explainer of an existing system drops the goals and the steps: Context → How it works
(diagram, sequence) → Worked example → Where it breaks.

### Table of contents (`.toc`)
Two-column list of the sections. Drop the `.tnum` spans when the sections are not numbered.

```html
<nav class="toc">
  <a href="#context"><span class="tnum">1</span>Context &amp; motivation</a>
  <a href="#goals"><span class="tnum">2</span>Goals &amp; non-goals</a>
  <a href="#architecture"><span class="tnum">3</span>Architecture</a>
</nav>
```

### Goals / non-goals (`.two-col` + `.panel goals|nongoals`)

```html
<div class="two-col">
  <div class="panel goals">
    <h3>Goals</h3>
    <ul><li>What this delivers.</li></ul>
  </div>
  <div class="panel nongoals">
    <h3>Non-goals (v1)</h3>
    <ul><li>What is explicitly out of scope.</li></ul>
  </div>
</div>
```

### Architecture diagram (`.diagram` → `.flow` of `.node` + `.arrow`)
Vertical flow. `.node.accent` highlights the key step; `.node.terminal` (dashed) is
an end state; `.node.muted` is a no-op branch. Use `.branch` for a fork.

```html
<div class="diagram">
  <div class="flow">
    <div class="node">
      <div class="nlabel">Entry point</div>
      <div class="nsub">subtitle · <code>code ref</code></div>
    </div>
    <div class="arrow"><span class="alabel">branch on result</span></div>
    <div class="branch">
      <div class="branch-col">
        <div class="branch-tag">case A</div>
        <div class="node muted terminal"><div class="nlabel">No-op</div></div>
      </div>
      <div class="branch-col">
        <div class="branch-tag fire">case B · the path that matters</div>
        <div class="node accent"><div class="nlabel">Do the work</div></div>
        <div class="arrow"></div>
        <div class="node terminal"><div class="nlabel">Done</div></div>
      </div>
    </div>
  </div>
</div>
```

### Sequence / timeline (`ol.timeline`)
Numbered runtime order. `.who` is a monospace actor chip.

```html
<ol class="timeline">
  <li>
    <div class="actor"><span class="who">Component</span> does a thing</div>
    <div class="desc">What happens, with <code>code refs</code>.</div>
  </li>
</ol>
```

### Code block (`.filelabel` + `<pre>`)
Hand-apply syntax colors with token spans: `tok-c` comment, `tok-k` keyword,
`tok-s` string, `tok-a` atom/symbol/literal, `tok-f` function/module name.

```html
<div class="filelabel">path/to/file.ex</div>
<pre><code><span class="tok-k">def</span> <span class="tok-f">handle</span>(arg) <span class="tok-k">do</span>
  <span class="tok-c"># a comment</span>
  {<span class="tok-a">:ok</span>, <span class="tok-s">"value"</span>}
<span class="tok-k">end</span></code></pre>
```

### Component card (`.comp`)
A self-contained sub-component write-up; the `.repo` chip tags its location.

```html
<div class="comp">
  <h3>Component name <span class="repo">repo/path</span></h3>
  <p>What it does and how.</p>
</div>
```

### Table (with `.new-row` / `.tag-new` for additions)

```html
<table>
  <thead><tr><th>Field</th><th>Type</th><th>Notes</th></tr></thead>
  <tbody>
    <tr><td><code>existing</code></td><td>integer</td><td>unchanged</td></tr>
    <tr class="new-row"><td><code>added</code> <span class="tag-new">new</span></td><td>string</td><td>what it's for</td></tr>
  </tbody>
</table>
```

### Implementation steps (`ol.steps`)
Boxed, numbered. `.repohint` is a monospace location note.

```html
<ol class="steps">
  <li><strong>Do the first thing</strong>
    <span class="repohint">repo/ — where</span></li>
  <li><strong>Then the next</strong></li>
</ol>
```


### Worked example (`.example`)
One concrete case with real numbers, before and after. Mark each changed cell with
`.changed`. Use it where the rules are hard to follow in the abstract.

```html
<div class="example">
  <h3>A customer who spent ¥30,000</h3>
  <p class="given">Tiers at ¥20,000 (Silver) and ¥30,000 (Gold). The Gold tier is created after the purchase.</p>
  <div class="two-col">
    <div>
      <div class="colhead">Before the recalculation</div>
      <table><tbody>
        <tr><td>Spent</td><td>¥30,000</td></tr>
        <tr><td>Tier</td><td>Silver</td></tr>
      </tbody></table>
    </div>
    <div>
      <div class="colhead">After the recalculation</div>
      <table><tbody>
        <tr><td>Spent</td><td>¥30,000</td></tr>
        <tr><td>Tier</td><td class="changed">Gold</td></tr>
      </tbody></table>
    </div>
  </div>
  <p class="result">The customer moves to Gold only when the recalculation runs.</p>
</div>
```

---

## Communication docs (stakeholders)

Type badge: `Feature overview`, `Product update`, `Launch brief`, etc.
Plain language, benefits first, **no code or jargon**. Typical flow: Why it matters →
How it works (simple) → What's needed → In/out of scope → Roadmap → Talking points → FAQ
→ Decisions needed, when the doc asks the reader to decide.

### Value cards (`.cards` → `.card`)
Three parallel benefits, one sentence each. Use them for one section at most, never as
the structure of the page. No emoji: add an inline SVG icon only when the theme has an
icon style.

```html
<div class="cards">
  <div class="card">
    <h3>Benefit headline</h3>
    <p>One sentence on why it's good for them.</p>
  </div>
  <div class="card"><h3>…</h3><p>…</p></div>
  <div class="card"><h3>…</h3><p>…</p></div>
</div>
```

### Friendly step flow (`.fflow` → `.fstep`)
Horizontal numbered steps with arrows — the "simple version" of how it works.

```html
<div class="fflow">
  <div class="fstep">
    <div class="circle">1</div>
    <h4>Step name</h4>
    <p>Plain-language description.</p>
  </div>
  <div class="fstep"><div class="circle">2</div><h4>…</h4><p>…</p></div>
</div>
```

### In / out of scope (`.two-col` + `.panel in|out`)

```html
<div class="two-col">
  <div class="panel in">
    <h3>In this release</h3>
    <ul><li>What ships now.</li></ul>
  </div>
  <div class="panel out">
    <h3>Not in this release</h3>
    <ul><li>What's deferred.</li></ul>
  </div>
</div>
```

### Setup checklist (`ul.check`)

```html
<ul class="check">
  <li><strong>Prerequisite one</strong> — short explanation.</li>
  <li><strong>Prerequisite two</strong> — short explanation.</li>
</ul>
```

### Release roadmap (`ol.roadmap`)
Vertical timeline of milestones. `.kick` marks the starting milestone. Pair with a
`.callout warn` reminding readers the dates are estimates if they aren't committed.

```html
<ol class="roadmap">
  <li class="kick">
    <span class="when">Jun 10 · Sprint start</span>
    <h4>Milestone name</h4>
    <p>What happens in this phase.</p>
  </li>
  <li>
    <span class="when">Early July (target)</span>
    <h4>General availability</h4>
    <p>…</p>
  </li>
</ol>
```

### Talking points (`.quotes` → `.quote`)
Ready-to-say lines, each labelled by purpose.

```html
<div class="quotes">
  <div class="quote">
    <span class="who">Positioning</span>
    "A quotable one-liner the team can say to a customer."
  </div>
</div>
```

### FAQ (`.faq` → `<details>`)
Native expand/collapse — the only interactivity allowed (no JS).

```html
<div class="faq">
  <details>
    <summary>A question someone will ask?</summary>
    <div class="answer"><p>The plain-language answer.</p></div>
  </details>
  <details>
    <summary>Another question?</summary>
    <div class="answer"><p>…</p></div>
  </details>
</div>
```

### Decisions needed (`ol.decisions`)
The last section when the reader must decide. One item per decision: the question,
who decides and by when, and the options with the recommended one marked.

```html
<ol class="decisions">
  <li>
    <h4>Which markets do we launch in?</h4>
    <span class="by">Director · before discovery starts</span>
    <ul>
      <li>Japan only <span class="tag-rec">Recommended</span> — one tax setup to build and check.</li>
      <li>Japan and Korea — twice the tax setup work.</li>
    </ul>
  </li>
</ol>
```

---

## Research docs

Type badge: `Research`, `Findings`, `Options`. The doc answers a question with evidence
and ends in a recommendation, not a build plan. Typical flow: Lead (the answer) →
Question and context → Sources checked → Options considered → Recommendation →
Trade-offs → Open questions → Next steps → References.

### Sources checked (table)
Every source gets the date it was checked, because the facts in it can change.

```html
<table>
  <thead><tr><th>Source</th><th>What it gives</th><th>Checked</th></tr></thead>
  <tbody>
    <tr><td><a href="https://example.com">Source name</a></td><td>What it covers, and its limits.</td><td>2026-10-09</td></tr>
  </tbody>
</table>
```

### Options comparison (`table.compare`)
Options as columns, criteria as rows. Mark the recommended column with `.pick` on its
`th` and every `td`.

```html
<table class="compare">
  <thead><tr><th>Criterion</th><th>Option A</th><th class="pick">Option B</th></tr></thead>
  <tbody>
    <tr><td>Cost</td><td>High</td><td class="pick">Low</td></tr>
    <tr><td>Risk</td><td>Low</td><td class="pick">Medium</td></tr>
  </tbody>
</table>
```

### Recommendation (`.verdict`)
One per doc, right after the comparison. State the pick and the one reason that decides it.

```html
<div class="verdict">
  <h3>Use option B</h3>
  <p>The reason that decides it, and the condition that would change the answer.</p>
</div>
```

### References (`ol.refs`)

```html
<ol class="refs">
  <li><a href="https://example.com">Title of the source</a> · <span class="checked">checked 2026-10-09</span></li>
</ol>
```

---

## Review docs

Type badge: `PR review` plus the PR number and the author in the meta badges. The doc
reviews someone else's change. Typical flow: Lead (the verdict) → What the change does →
Direction → Blocking findings → Non-blocking findings → Questions for the author.
A `reply` keeps only Direction and Blocking findings, written to post on the PR.

### Finding (`.finding`)
One per issue: a title that states the defect, the location, the severity, the
evidence, and a suggested fix. Add `.blocking` to both the card and the `.sev` badge.

```html
<div class="finding blocking">
  <div class="fhead">
    <span class="sev blocking">Blocking</span>
    <h3>A lost batch is never sent again</h3>
    <span class="where">lib/app/batches.ex:42</span>
  </div>
  <p>What goes wrong, for which input, and how the code shows it.</p>
  <div class="fix"><strong>Suggested fix:</strong> the smallest change that removes the defect.</div>
</div>
```

Use `<span class="sev">Non-blocking</span>` and a plain `.finding` for the rest.

---

## Guides

Type badge: `Guide`, `Setup`, `Migration`. The reader does the work, so every command
is copyable and every step says what success looks like. Typical flow: Lead (what the
reader has at the end) → Prerequisites (checklist) → Steps → Optional setup →
Troubleshooting → Prompt for your LLM.

### Command with expected output (`.cmd` + `pre.output`)
A command block gets a copy button. Show the output the reader should see, so they
know the step worked.

```html
<div class="cmd">
  <pre><code>cloudflared tunnel create dev-tunnel</code></pre>
  <button class="copy" type="button">Copy</button>
</div>
<div class="outlabel">You should see</div>
<pre class="output"><code>Created tunnel dev-tunnel with id 87c920a3-…</code></pre>
```

Add this script once, at the end of `<body>`, when the page has a copy button. Where the
clipboard is blocked, it selects the text for a manual copy.

```html
<script>
document.addEventListener('click', (e) => {
  const button = e.target.closest('.copy');
  if (!button) return;
  const pre = button.parentElement.querySelector('pre');
  navigator.clipboard.writeText(pre.innerText).then(
    () => { button.textContent = 'Copied'; setTimeout(() => { button.textContent = 'Copy'; }, 1500); },
    () => getSelection().selectAllChildren(pre)
  );
});
</script>
```

### Troubleshooting (`.faq.trouble`)
The summary is the exact error the reader sees, so they can find it by searching the page.

```html
<div class="faq trouble">
  <details>
    <summary>ERR You have an existing certificate at ~/.cloudflared/cert.pem</summary>
    <div class="answer"><p>Why it happens, and the command that fixes it.</p></div>
  </details>
</div>
```

### Prompt for your LLM (`.cmd.prose`)
A prompt the reader pastes into their own assistant. Write it so the assistant guides
the reader through the steps and does not run them for the reader.

```html
<div class="cmd prose">
  <pre>I am following the guide "…". Walk me through it one step at a time. Ask me to run each command and to paste the output, and check the output before the next step.</pre>
  <button class="copy" type="button">Copy</button>
</div>
```
