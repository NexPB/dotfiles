---
name: prompt-analysis
description: "Analyze AI coding sessions from Git AI: prompting patterns, acceptance, cost, and what ships. Use when asked how well prompts or agents perform, to grade or categorize prompts, or to compare models, agents or people."
argument-hint: "[question about prompts or sessions]"
user-invocable: true
---

# Prompt analysis

Answer questions about AI coding sessions with `git-ai analyze`, which queries the Git AI backend.

## Before you start

`git-ai analyze` needs an org API key in `GIT_AI_API_KEY` or in `api_key` of `~/.git-ai/config.json`. Check with `git-ai config api_key`. If it prints `null` and the variable is empty, stop. Tell the user to set a key with the `organization:admin:read` scope. Offer `git-ai usage --period <1d|3d|7d|30d> --json` as the local fallback: it gives lines, sessions, tokens and cost for this machine, with no transcripts.

Read `git-ai analyze --help` and `git-ai analyze sessions --help` first. They hold the current cubes, the flags, the user-id lookup and the cursor rules. Trust them over this file where the two differ.

## Scope

| The user says | Scope |
| --- | --- |
| "my", or nothing | the current user (resolve `git config user.email` to a `user_id`, as the help shows), last 30 days |
| "team", "everyone" | no user filter |
| a person | that person's email, resolved to a `user_id` |
| a repo, "this repo" | `--repo <url>` from `git remote get-url origin` |
| a time range | `--since "<range>"` |

Widen the scope only when the user asks for it.

## Aggregate questions

Answer counts, rates, costs and funnels with `git-ai analyze query`, or with SQL over a pulled DB (`sessions exec`). The funnel columns (`committed_lines` → `production_lines`, and the precomputed gaps) already answer "what shipped". Read transcripts only for the why.

## Per-session questions

To grade or categorize sessions, read their transcripts:

1. Pull the population: `DB=$(git-ai analyze sessions pull --since "last 30 days" [filters])`.
2. Add one column per criterion, plus a notes or evidence column, with `ALTER TABLE sessions ADD COLUMN …`. Store every result in the DB, so the synthesis is one query.
3. Read the transcripts. Up to about 10 sessions, read them yourself. Above that, spawn subagents so the transcripts stay out of this context: one per 20 sessions, and 5 at most. The cursor serves each session once, so the subagents never overlap. Give each one the rubric and this loop:

   ```
   Loop until `git-ai analyze sessions next "<DB>"` prints {"done": true}. Do not
   stop after one session. For each session:
   - The human prompts are the transcript events with event_kind "user_message".
     The agent's work is the tool_call and assistant_message events between them.
     Everything you need is in this JSON; do not run git commands.
   - Apply the rubric below.
   - Write the result: git-ai analyze sessions exec "<DB>" "UPDATE sessions SET
     <col>='<value>', … WHERE session_id='<id>'"
   Return the count of sessions that you graded and any that you could not grade.

   RUBRIC:
   <rubric>
   ```

4. Check that the cursor is at the end with `git-ai analyze sessions stats "$DB"`, then synthesize with `sessions exec`.

Subagents do not inherit skill permissions. Without `Bash(git-ai:*)` in `.claude/settings.json` or `~/.claude/settings.json`, every call asks the user.

## Rubrics

Pick the one that fits the question, or derive a new one in the same shape. Give each label a one-sentence reason from the transcript.

**Work type** (`work_type`): `bug_fix`, `feature`, `refactor`, `docs`, `test`, `config`, `other`.

**Why little shipped** (`low_ship_reason`, for sessions with a low `production_rate`): `vague_request`, `wrong_approach`, `style_mismatch`, `partial_solution`, `overengineered`, `context_missing`, `abandoned`, `other`.

**Prompt clarity** (`clarity_score`, 1–5, plus `clarity_feedback`):
5 specific goal, context and constraints; 4 clear intent, minor gaps; 3 understandable, missing useful context; 2 the agent had to assume a lot; 1 the agent had to guess.

**Technique** (`technique`, plus `technique_notes`): `example_driven`, `step_by_step`, `context_heavy`, `minimal`, `iterative`, `constraint_focused`, `reference_based`, or `multiple` with the list in the notes.

**Grade** (`grade` A–F, `grade_breakdown` JSON, `grade_feedback`): score each 0–2, then A 9–10, B 7–8, C 5–6, D 3–4, F 0–2.
- Specificity: 0 "fix this"; 1 a direction; 2 a specific outcome.
- Context: 0 none; 1 partial; 2 the files, constraints or patterns that matter.
- Scope: 0 "rewrite the app"; 1 large but workable; 2 one focused task.
- Constraints: 0 none where they would help; 1 some; 2 what to do and what not to do.
- Testability: 0 no way to tell success; 1 implicit; 2 explicit expected behavior.

## Report

Lead with the answer to the question. Then give the synthesis table, the population (who, which repos, which dates, how many sessions) and two or three sessions that show the pattern, by `session_id`.
