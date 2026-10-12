---
name: gh-stack
description: "Bring a stack of PRs up to date with gh stack: sync, rebase, resolve the conflicts layer by layer, then push. Use when asked to sync, rebase, update or fix a stack, when gh stack sync or gh stack rebase fails, or when a stack branch shows a conflict or needs a rebase."
argument-hint: "[--prune]"
---

# gh stack

Bring the current stack up to date with its trunk, and push it. Every write goes through `gh stack`.

`gh stack` runs non-interactive here, because stdout is not a TTY. It never prompts, and a prompt it needs becomes an abort.

## 1. Check the state

Run these and stop on the first problem.

- `gh stack view --json`. Exit 2: not on a stack branch. Exit 6 with "belongs to multiple stacks": you are on the trunk, so ask which stack and `gh stack checkout <branch>`.
- `git status --porcelain`. A dirty tree blocks sync. Ask the user to commit or stash. Do not stash on their behalf.
- `ls "$(git rev-parse --git-common-dir)"`:
  - `gh-stack-rebase-state`: a stack rebase is paused. Go to step 4.
  - `gh-stack-modify-state`: a `gh stack modify` was interrupted. Every other command fails with exit 10. Ask the user to run `! gh stack modify --abort` or finish it.
  - `rebase-merge` or `rebase-apply`: a raw git rebase is in progress. Show `git status` and ask the user how to proceed.

## 2. Sync

Run `gh stack sync`, with `--prune` if the user passed it or a PR in the stack is merged.

Sync fetches, fast-forwards the trunk, rebases every layer onto its parent, and pushes all branches atomically with `--force-with-lease`. Read the last lines. Do not trust the exit code alone.

| Output | Meaning | Next |
| --- | --- | --- |
| `Stack synced` or `Branches synced` | Done | Step 6 |
| `Sync aborted`, or a divergence message | The local and the GitHub stack differ, and sync needs a prompt to choose. It exits 0 and changes nothing | Tell the user to run `! gh stack sync` and pick in its prompt. Stop |
| Exit 3, rebase conflict | Sync restored every branch | Step 3 |
| Exit 4 | GitHub API failed | Run `gh auth status`, then retry once |
| Exit 8 | Stack file locked | Wait 5 seconds, retry once |

## 3. Rebase

Run `gh stack rebase`. It rebases each layer onto the tip of the layer below, bottom to top. On a conflict it exits 3 and pauses on the conflicted layer.

## 4. Resolve one layer

1. Find the layer: `conflictBranch` in `$(git rev-parse --git-common-dir)/gh-stack-rebase-state`, and the commit that git applies, from `git status`.
2. List the files: `git diff --name-only --diff-filter=U`.
3. For each file, read both sides before you edit. The parent layer is the new truth, and this layer's commit is the change to replay on top of it. Keep both intents. When the two changes cannot both be kept, stop and ask the user. Do not pick a side to get the rebase through.
4. Remove every conflict marker. Confirm with `git diff --check`.
5. Run the cheapest check the repo has for those files (the compiler, or the tests for that module).
6. `git add <files>`, then `GIT_EDITOR=true gh stack rebase --continue`.
7. On a new conflict, repeat this step for the next layer.

If a resolution goes wrong, `gh stack rebase --abort` restores every branch.

## 5. Push

If you resolved conflicts, first show the user each file you resolved and how. Push after they agree.

Run `gh stack push`. It pushes each active branch with `--force-with-lease` and skips merged ones. A branch can fail alone: read the rejected branch, fix it, and run `gh stack push` again.

## 6. Report

Run `gh stack view`. Report each layer, its PR and any `⚠`. Report what you resolved, and what is left.

If the same conflict came back on several layers and `git config rerere.enabled` is not `true`, suggest that the user turns it on.

## Rules

- Never run `git rebase`, `git rebase --continue`, `git pull` or `git push --force` on a stack branch. Each one moves one layer and leaves the layers above it on the old commits, which duplicates commits in their PRs. The gh-stack plugin blocks them.
- Never `--no-verify`.
- Never resolve a conflict by deleting the change of one side without the user's agreement.
- Never run `gh stack modify`, `merge`, `submit` or `unstack` from this skill. They are interactive or affect GitHub beyond the branches.
