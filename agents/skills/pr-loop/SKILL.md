---
name: pr-loop
description: "Run the review cycle on the current branch's PR: triage the review threads and Copilot's suppressed comments, fix the chosen ones with one fixup! commit each, push, wait for CI and fix what fails, post the replies, then update the PR description. Use for 'fix 1 2 and then post', 'a fixup! commit for each', 'push and wait for CI to pass', 'update the PR description', or when CI fails on the PR."
argument-hint: "[thread numbers] [fix] [push] [ci] [post] [describe]"
---

# PR loop

One pass of the review cycle on the current branch's PR. It chains four skills: `pr-review-comments` (triage, fix, post), `commit` (the commit rules), `pr` (the PR body) and `blast-radius` (offered, never run).

The pr-loop plugin draws a band above the prompt with the PR's CI, open threads, suppressed comments and review state. When CI fails, it adds the failing step of each job to the conversation as a row that starts with `[pr-loop] CI failed`.

## Steps

The user names the steps, for example "fix 1 2 and then post". Run the named steps in the order below and skip the others. `fix` always commits, and `post` pushes first when a fix is not on the remote. When the user names no step, run step 1 and stop.

### 1. Triage

1. Run the `pr-review-comments` skill with `discuss`. It reuses a triage from earlier in this conversation.
2. Run `bash ~/.claude/skills/pr-loop/scripts/copilot-suppressed.sh <PR>`. GitHub opens no thread for a suppressed comment, so step 1 does not find them.
3. Triage each suppressed comment with the same rules. Number them S1, S2, after the threads. Each Copilot review lists only its new comments, so read every review. Merge the duplicates, and mark a comment that a later commit already fixed.

### 2. Fix and commit

Do one item at a time: fix it, commit it, then go to the next item. Each commit then holds one item only.

1. Fix the item with the `pr-review-comments` skill, `fix <number>`. Fix a suppressed comment with the same rules.
2. Find the commit on this branch that the fix corrects: `git blame -L <start>,<end> <base>..HEAD -- <file>` on the lines that the comment is about. On a gh stack branch, `<base>` is the layer below, not the trunk. A line that starts with `^` is older than the branch.
3. Commit with the rules of the `commit` skill, by name: `git commit --fixup=<sha> -- <files>`. When the lines are older than the branch, write a normal commit message instead.
4. Do not run `git rebase --autosquash`. It rewrites the pushed commits. The user squashes at merge.

### 3. Push

Run `git push`. Never force-push unless the user asks.

On a gh stack branch, run the `gh-stack` skill instead. A new commit on a lower layer must reach the layers above it, so `gh stack sync` rebases those layers and pushes them. Only gh stack may rebase pushed commits.

### 4. Wait for CI

1. Run `gh pr checks <PR> --watch --fail-fast --interval 20` in the background and wait for it to end.
2. On a failure, read the `[pr-loop] CI failed` row in the conversation. When there is none, run `gh pr checks <PR> --json name,state,link` and `gh run view --job <id> --log-failed`, and read only the failing step.
3. When the failure is in code that this branch did not change (a deadlock, a timeout, a flaky test), do not change code. Tell the user, and offer `gh run rerun <run id> --failed`.
4. Else fix it. Run the same check on your machine first: `mix credo --strict <files>`, `mix format --check-formatted`, the failing test file. Commit the fix as in step 2, push, and wait again.
5. Stop after two failed rounds and report.

### 5. Post

Run step 3 first when a fix is not on the remote. Then run the `pr-review-comments` skill with `post <numbers>`, so that each reply names a commit that the reviewer can see.

A suppressed comment has no thread to reply in. Post one PR comment for all of them with `gh pr comment <PR> --body-file <file>`: a heading, the counts, then the verdict and the commit of each one. Use the ASD-STE100 rules of `pr-review-comments`.

### 6. Describe

Run the `pr` skill with `--update`. When the new commits touch a migration, a public API or another one-way door that the `pr` skill names, tell the user to run `/blast-radius`. That skill runs only on the user's command.

## Report

Give one line for each step that ran. End with the CI state and the count of the threads and the suppressed comments that stay open.

## Rules

- Never use `--no-verify`, never amend, and never rebase the pushed commits outside gh stack.
- Never push unless the user names `push`, `ci` or `post`. Never post unless the user names `post`.
