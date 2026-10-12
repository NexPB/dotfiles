---
name: pr
description: "Write a pull request body that follows the repo's own PR template and guidelines and always states the Merge Danger: one-way or two-way door, and blast radius. Use when asked to write, draft, open or update a PR, or to fill in a PR description."
argument-hint: "[base branch] [--create | --update]"
metadata:
  credits:
    skill: pr
    author: Matt Pocock
    url: "https://github.com/mattpocock/skills/blob/main/skills/engineering/pr/SKILL.md"
---

# PR

Write the PR body. The repo decides the shape. This skill makes sure the Merge Danger is in it.

## 1. Read the repo's rules

Look for each of these. Read every one that exists before you write.

- **PR template.** Match case-insensitively: `.github/pull_request_template.md`, `.github/PULL_REQUEST_TEMPLATE/*.md`, `docs/pull_request_template.md`, `pull_request_template.md` at the root. If there is none, check the org default: `gh api repos/<owner>/.github/contents/.github/pull_request_template.md -H "Accept: application/vnd.github.raw"`. If the folder holds several templates, pick the one that fits the change and say which.
- **PR guidelines.** The PR, review or merge sections of `CONTRIBUTING.md`, `CLAUDE.md`, `AGENTS.md` and `docs/`.
- **Domain words.** `GLOSSARY.md`, `CONTEXT.md` or the like. Use its terms.
- **Title convention.** `git log --oneline -20` on the base branch and `gh pr list --state merged --limit 10`.

## 2. Read the change

- Find the base: the argument, else `gh pr view --json baseRefName`, else the default branch.
- Read `git log <base>..HEAD` and `git diff <base>...HEAD`, and the existing body from `gh pr view` if a PR is open.
- Note every migration, schema, config, env var, public API, wire format, event, job, cache key, feature flag and dependency the diff touches. These decide the Merge Danger.

## 3. Pick the shape

The repo's template and guidelines win over the default below.

- **Template exists:** keep every heading, checklist and required field in its order. Fill each one. Write `N/A` and a reason for a section that does not apply; never delete it. Tick a checkbox only if you verified it. Remove the template's instruction comments after you follow them.
- **Template has a risk section** (Risk, Impact, Rollback, Deployment notes or the like): put the Merge Danger content in it under the template's heading. Do not add a second one.
- **Template has no risk section:** append `## Merge Danger` as the last section.
- **A guideline forbids extra sections:** put the Merge Danger content in the closest section and tell the user where it went.
- **No template:** use the default.

```markdown
## Summary

<diagram, diff-sketch, or tree>

## Evidence

**Before:** <output, failing test, screenshot>
**After:** <output, passing test, screenshot>

## Merge Danger

**Door:** <one-way or two-way>

<optional: what makes it one-way, and what must happen before merge>

**Blast Radius:** <one word>

<optional: what breaks, and for whom, if this is wrong>
```

## 4. Merge Danger

This is the part that matters most. Get it right before you polish the rest.

### Door

A two-way door can be walked back with a revert and a deploy. A one-way door cannot: a revert leaves something behind.

Call it one-way if the merge does any of these:

- drops, renames or rewrites data, columns or tables, or runs a backfill
- changes a format that something else stores or reads: an event, a queue message, a cache key, a file, a webhook payload
- changes a public API, a published package or a contract that other teams or customers call
- sends something out: emails, notifications, payments, third-party writes
- removes a feature flag, rotates a secret or deletes infra

For a one-way door, name the step that cannot be undone and what must happen first: a backup, a deploy order, a flag, a consumer that must ship first. If a small change to the PR would make it two-way, say so.

### Blast Radius

One word for the widest scope it can reach if it is wrong, for example `none`, `local`, `module`, `service`, `cross-service`, `customers`. Then list the ways it can break, each with who sees it: consumers of a changed API, other services that read the same data, mobile or old clients, layout shift, performance, jobs in flight during deploy, migrations on large tables.

Trace each claim to a real `file:line` or caller. Never invent one. If you did not check a consumer, say it is unchecked. For a wide or risky change, suggest the `blast-radius` skill.

## 5. Summary and Evidence

Keep both short. Skip preambles.

**Summary.** Show the smallest view that makes the point: pseudocode, a call tree, a component tree, a shallow file tree, a Mermaid diagram, or a `diff` of one of these. Use one or two, not all. Put each next to the sentence it supports.

**Evidence.** Show before and after. A screenshot is best for a visual change; test or command output is next. Run the relevant test if it is cheap. Never invent output; if you have no evidence, say what is unverified.

## 6. Hand it back

- Default: print the title and the body for the user to review.
- `--create`: run `gh pr create --title <title> --body-file <file>` with the base from step 2. Follow the repo's draft convention.
- `--update`: run `gh pr edit --body-file <file>`. Keep the parts of the existing body that a human wrote.
- Never push or open a PR unless the user asks. Write the body file to a temp path, not the repo.
