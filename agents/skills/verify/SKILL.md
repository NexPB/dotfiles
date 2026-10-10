---
name: verify
description: "Prove a UI change works in the running app before calling it done. Use in any project with a verify.config.json when you change frontend code (Inertia pages, components, CSS, Blade/ERB layouts), when the Stop hook says UI files changed since the last passing run, or when asked to verify, screenshot, or check the app. Also use to set verify up in a new app."
argument-hint: "[page names, or nothing for all]"
---

# Verify

`~/.claude/bin/verify` loads each page in `verify.config.json` in headless Chromium and fails on:

- JS errors, console errors, failed requests, HTTP 4xx/5xx from the app's origin
- an Inertia visit answered by a non-Inertia response
- a redirect away from the page (usually an expired session)
- an undefined custom element: a misspelled `<s-*>` Polaris tag, or polaris.js not loaded
- a screenshot that differs from `.verify/baseline/<page>.png` by any pixel

App Bridge is replaced by a stub that records calls; the run prints them as `app bridge: shopify.toast.show, …`.

A full passing run writes `.verify/pass`. The Stop hook blocks you from finishing while watched files have uncommitted changes and no passing run matches them.

## Loop

1. Make the change. If it adds a route, add it to `pages` in `verify.config.json`.
2. Run `~/.claude/bin/verify run` once, when you think you are done. Not after every edit: it takes up to a minute. Run `verify run <page>` to iterate on one page; only a full run writes the stamp.
3. Fix every non-visual failure in the code. Never loosen `maxDiffPixels`, add a `mask`, or remove a page to get green.
4. For each `no baseline` or `pixels differ` line, Read the screenshot in `.verify/out/<page>.png` (and `<page>.diff.png` for a diff; changed pixels are red). Say what you see.
   - The change is the one you meant to make → `~/.claude/bin/verify approve <page>`.
   - Anything else (layout shift, missing section, unstyled component, a page you did not touch) → it is a bug. Fix it.
5. In your final message list the baselines you approved and why.

The dev server must already run at `baseUrl`. If the run cannot reach it, say so and stop; do not start servers the user did not ask for.

## Setting up an app

1. In the app root, run `~/.claude/bin/verify init`.
2. Set `baseUrl` to the dev server, `loginPath` to the standalone admin login, and `watch` to the frontend directories (`resources/js` for Laravel, `app/frontend` for Rails with Vite).
3. Add a page per screen worth guarding: `{ "name": "discounts", "path": "/app/discounts" }`. Optional per page: `waitFor` (a selector to wait for), `mask` (selectors to black out, for clocks and live data only), `maxDiffPixels`.
4. Ask the user to run `verify login` themselves: it opens a browser for them to log in and saves `.verify/auth.json`.
5. Run, review every screenshot, approve, and commit `verify.config.json`, `.verify/.gitignore`, and `.verify/baseline/`.

Set `VERIFY_GATE=off` to turn the Stop hook off for a project or session (see FLAGS.md).
