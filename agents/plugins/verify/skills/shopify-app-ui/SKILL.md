---
name: shopify-app-ui
description: "Prove a change to a Shopify app's embedded admin UI works in the running Phoenix app before calling it done. Use in any project with .verify/shopify-app-ui.json when you change Inertia pages, components, CSS, or the controllers and templates under lib/*_web, when the Stop hook says shopify-app-ui changes have no passing run, or when asked to verify or screenshot the admin UI. Also use to set it up in a new app."
argument-hint: "[page names, or nothing for all]"
---

# verify:shopify-app-ui

`verify shopify-app-ui run` loads each page in `.verify/shopify-app-ui.json` in headless Chromium, through the app's standalone (non-iframe) admin view, and fails on:

- JS errors, console errors, failed requests, HTTP 4xx/5xx from the app's origin; a Phoenix dev error page shows its exception, e.g. `(KeyError at GET /app)`
- an Inertia visit answered by a non-Inertia response
- a redirect away from the page (usually an expired session)
- an undefined custom element: a misspelled `<s-*>` Polaris tag, or polaris.js not loaded
- a screenshot that differs from `.verify/shopify-app-ui/baseline/<page>.png` by any pixel

App Bridge is replaced by a stub that records calls; the run prints them as `app bridge: shopify.toast.show, …`.

A full passing run writes `.verify/shopify-app-ui/pass`. The Stop hook blocks you from finishing while watched files have uncommitted changes and no passing run matches them.

## Loop

1. Make the change. If it adds a route to the admin UI, add it to `pages` in `.verify/shopify-app-ui.json`.
2. Run `verify shopify-app-ui run` once, when you think you are done. Not after every edit: it takes up to a minute. Run `verify shopify-app-ui run <page>` to iterate on one page; only a full run writes the stamp.
3. Fix every non-visual failure in the code. Never loosen `maxDiffPixels`, add a `mask`, or remove a page to get green.
4. For each `no baseline` or `pixels differ` line, Read the screenshot in `.verify/shopify-app-ui/out/<page>.png` (and `<page>.diff.png` for a diff; changed pixels are red). Say what you see.
   - The change is the one you meant to make → `verify shopify-app-ui approve <page>`.
   - Anything else (layout shift, missing section, unstyled component, a page you did not touch) → it is a bug. Fix it.
5. In your final message list the baselines you approved and why.

The Phoenix server (`mix phx.server`) must already run at `baseUrl`. If the run cannot reach it, say so and stop; do not start servers the user did not ask for. The first request after an edit recompiles, so a slow first page is normal; a compile error shows up as an HTTP 500 with the exception.

## Setting up an app

1. In the app root, run `verify shopify-app-ui init`. It writes `.verify/shopify-app-ui.json` with Phoenix defaults: `baseUrl` `http://localhost:4000`, and `watch` set to `assets/js`, `assets/css`, and the `lib/*_web` layer.
2. Set `loginPath` to the standalone admin view's login.
3. Add a page per screen worth guarding: `{ "name": "discounts", "path": "/admin/discounts" }`. Optional per page: `waitFor` (a selector to wait for), `mask` (selectors to black out, for clocks and live data only), `maxDiffPixels`.
4. Ask the user to run `~/.claude/skills/verify/bin/verify shopify-app-ui login` in their own terminal: it opens a browser for them to log in and saves `.verify/shopify-app-ui/auth.json`.
5. Run, review every screenshot, approve, and commit `.verify/shopify-app-ui.json`, `.verify/shopify-app-ui/.gitignore`, and `.verify/shopify-app-ui/baseline/`.

Set `VERIFY_GATE=off` to turn the Stop hook off for a project or session.
