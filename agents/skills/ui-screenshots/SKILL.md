---
name: ui-screenshots
description: "Capture before/after screenshots of a UI change and frame each pair into one labelled image for a PR. Runs the base branch in a git worktree beside the current branch, seeds a test account, captures the same state in both with agent-browser, and saves local files to drag into GitHub. Use when asked for screenshots of a UI or UX change, or when the pr skill needs visual Evidence."
argument-hint: "[base branch] [route or URL…]"
---

# UI screenshots

Capture each changed screen on the base branch and on this branch. Frame each pair into one Before/After image. Hand back local files. GitHub has no upload API, so the user drags the files into the PR.

Tools: `agent-browser` for capture, `scripts/frame.sh` (ImageMagick) for framing.

## 1. List the shots

Find the base: the argument, else `gh pr view --json baseRefName`, else the default branch. Read `git diff <base>...HEAD` for changes to templates, components, CSS and assets.

Write one entry per visible change:

- **route**: the path, on both apps
- **steps**: what reaches the state (log in, click, fill, open the modal, trigger the error)
- **data**: the role and the records the state needs (an admin, an org with three projects, an empty inbox)
- **selector**: the smallest region that shows the change and its context. Use the page only for a page-wide change
- **viewport**: `1440 900`; also `390 844` if the diff touches responsive CSS, and `1920 1080` if it touches wide-screen layout
- **theme**: `light`, plus `dark` if the change is theme-specific

Show the list to the user before you capture. Ask only for routes or steps that the diff does not show. Routes from the arguments win.

## 2. Find running servers

Before you start a server, check the port (the repo's `PORT`, else 4000, then each next port):

```bash
pid=$(lsof -nP -tiTCP:<port> -sTCP:LISTEN | head -1)
[ -n "$pid" ] && lsof -a -p "$pid" -d cwd -Fn | sed -n 's/^n//p'
```

- No listener: the port is free.
- The cwd is this checkout or `$base_dir` (step 4): reuse that server for its side. If the diff changes config, deps or a migration, ask the user before you restart it.
- Any other cwd: leave it running and try the next port.

Never stop a server you did not start.

## 3. Run "after"

If step 2 found no server for this checkout, run `PORT=<port> mix phx.server` from the repo root in the background. Poll the port until it answers.

## 4. Run "before"

```bash
base_dir="${TMPDIR}ui-screenshots/worktrees/<repo>-<base>"
git worktree add --detach "$base_dir" <base>   # if it exists: git -C "$base_dir" checkout --detach <base>
```

In `$base_dir`, copy the untracked dev config the app needs (`.env`, `config/*.secret.exs`, `.envrc`), install deps and build assets (`mix deps.get`, `npm ci --prefix assets`, …). If step 2 found no server in `$base_dir`, run `PORT=<next free port> mix phx.server` there in the background.

- Both apps share the dev database. If the diff has a migration, tell the user: the base app now runs against the migrated schema.
- If the base app does not boot, stop and show the error. Never pass off a shot of this branch as "before".
- For a new screen with no before, skip this step and frame the after shot alone.

## 5. Seed a test account

Both apps share the dev database, so seed once, from this checkout. Use the account `ui-screenshots@example.com` with the password `ui-screenshots-pass-1`.

Find how the app makes users: `priv/repo/seeds.exs`, a dev seed task, or the accounts context (`Accounts.register_user/1`). Call the same functions with `mix run -e '…'`. Never insert rows that skip the app's own logic.

- Look up the email first and reuse the account if it exists. Bring it to the state that step 1 needs.
- Give it the role, the confirmation and the records from the **data** of each shot. Use the app's own functions for those too.
- If login is by magic link only, open the link from the dev mailbox (`/dev/mailbox`) in each session.
- If login is by SSO only, run `agent-browser --auto-connect state save "$out/auth.json"` from the user's Chrome instead, and pass `--state "$out/auth.json"` to both sessions. Never type the user's own credentials.

Keep the account after the run, so the next run reuses it.

## 6. Capture

Use one session per side, `before` and `after`, and run the same commands on both. `a` stands for `agent-browser --session <side>`.

```bash
a set viewport 1440 900 2
a set media light reduced-motion
a open http://localhost:<port>/users/log-in
# log in as the test account: a fill / click …
a open http://localhost:<port><route>
# replay the steps: a click / fill / press / find …
a wait '<selector>'
a eval "document.head.insertAdjacentHTML('beforeend','<style>*,*::before,*::after{caret-color:transparent!important;animation:none!important;transition:none!important}html{scrollbar-width:none}::-webkit-scrollbar{display:none}</style>'); document.fonts.ready.then(() => 'ok')"
a screenshot '<selector>' "$out/<n>-<slug>-<side>.png"
```

- `$out` is `${TMPDIR}ui-screenshots/<repo>-<branch>/`. Name each pair by its number and a short slug: `1-settings-form-before.png`.
- LiveView: wait for `.phx-connected` before the steps, and for the patched element after each step.
- Show only seed data in a shot, never real customer data.
- Read every PNG. Recapture a shot that shows a spinner, a flash, an error page, a cut-off region or a different state from its pair.

## 7. Frame

```bash
scripts/frame.sh "$out/1-settings-form-before.png" "$out/1-settings-form-after.png" "$out/1-settings-form.png"
scripts/frame.sh "$out/2-empty-state-after.png" "$out/2-empty-state.png"
```

Two inputs give one labelled image: stacked when both are landscape, side by side otherwise. One input is framed alone. `FRAME_LABELS="Light,Dark"` changes the labels. `FRAME_BG` changes the background. Read each result.

## 8. Clean up

Stop the servers you started. Run `agent-browser --session before close` and `agent-browser --session after close`. Run `git worktree remove "$base_dir"` if you created it and no reused server runs there. Delete `auth.json`. Keep `$out` and the test account.

## 9. Hand back

Print each framed file's full path with a one-line caption. Then print the Evidence snippet. It has one placeholder per image, which the user replaces by dragging the file into the GitHub editor:

```markdown
**Settings form**: the Save button moves under the field and reads "Save changes".

<!-- drag 1-settings-form.png here -->
```
