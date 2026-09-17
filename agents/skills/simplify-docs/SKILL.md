---
name: simplify-docs
description: "Delete and shorten code comments, docstrings and prose docs. Remove every comment that the code, the types or git already state, then write the few facts that remain in ASD-STE100 Simplified Technical English. The diff must remove more lines than it adds. Changes no code. Use when asked to simplify, clean up, tidy, shorten or rewrite comments, docstrings, README or other docs."
argument-hint: "[paths or globs] [--all]"
user-invocable: true
---

# Simplify Docs

Make the prose smaller. Delete first. Rewrite only the fact that the reader cannot get from the
code, and write it in the fewest words.

The result of this skill is less text, not better text. A file with ten good comments and no
deletions is a failed run.

**Never change the code.** Edit comment text, docstring text and markdown prose only.

## Scope

1. Use the paths in the arguments, if the user gives them.
2. Else use the files that you changed in this conversation.
3. Else use the dirty files: `git status --porcelain`. With `--all`, use every tracked file that the user names or the repository holds.
4. Ask the user for a path if the list is empty.

Do not touch:

- a vendored, generated or third-party directory
- a lockfile, a snapshot or a test fixture
- a `CHANGELOG`, a migration note or a commit message, because these record history on purpose
- a license header or a copyright header
- a string literal, a log line, a CLI message or a user-facing text
- the code inside a fenced block in a markdown file

## The default action is delete

Each comment, each docstring and each paragraph starts as a deletion. Keep it only when you can
name the one fact that it holds, and the code does not hold that fact.

- Delete. Do not shorten, if the text holds no fact.
- Do not replace a deleted comment with a shorter comment.
- Never add a new comment, a new docstring or a new section. This skill removes text.
- Delete the text if you are not sure. Git holds it.
- Delete the whole docstring when the name, the types and the arguments give the contract.

## The keep test

Ask these questions in order. Stop at the first *yes*.

1. Does the code on the next line state this? **Delete.**
2. Do the names, the types or the signature state this? **Delete.**
3. Does git, the ticket or the test state this? **Delete.**
4. Does it speak to a person, to a reviewer or to the conversation? **Delete.**
5. Is it true today, but only about one past edit? **Delete.**

If every answer is *no*, keep the fact. Write it in one sentence.

## Budgets

- A code comment: two lines maximum.
- A docstring: one sentence for the behaviour. Add one line for each error, unit or range that the
  signature does not give.
- A markdown section: five sentences maximum.
- A rewrite that is longer than the original text is wrong. Delete the original instead.

## What to remove

| Remove | Reason |
| --- | --- |
| `// Changed this to use a Map for speed` | It describes the edit, not the code. |
| `// Previously we called fetchAll() here` | It describes an old version. Git holds that. |
| `// NOTE: I moved this above the guard clause` | It is a note to a reviewer. |
| `// As discussed, this now returns null` | It is part of a conversation. |
| `// Simple helper that just adds two numbers` | It restates the code. |
| `// Increment the counter` | It restates the code. |
| `/** @param id The id */` | It restates the signature. |
| `// TODO: ask Sam if this is still needed` | It is a question for one person, not a task. |
| `# ---- section ----` banners with no content | They carry no information. |
| A docstring that repeats the function name in a sentence | It carries no information. |
| A README section that lists the files of the repository | The reader can list the directory. |

## What to keep

Keep the fact, not the discussion around the fact:

- the contract that the signature does not give: the errors, the units, the valid ranges
- a gotcha: an order that matters, a lock, a limit, a race, a rate limit
- an unknown: a value that the team measured, a case that nobody tested
- a reason that stays true: a protocol rule, a spec, a hardware limit, a ticket link
- one example, when the consumer cannot use the code without it

Keep one example for each module, not one for each function.

## Where each kind of text belongs

- A **docstring** states what the code does and the contract. Keep the reason for the
  implementation out of it.
- A **code comment** holds the reason, the workaround and the defect in other code. Put it on the
  line that it explains.

Move a misplaced fact to the correct place. Delete it if it only describes the edit.

## Writing standard: ASD-STE100

Apply these rules to the text that survives the keep test.

- Give each word one meaning. Use one name for one thing every time. Do not use a synonym for
  variety.
- Use the shortest correct word: *use*, not *utilize*; *check*, not *verify*; *about*, not
  *approximately*; *before*, not *prior to*; *to*, not *in order to*; *make sure*, not *ensure*.
- Do not use jargon, an idiom, a metaphor or a joke. State the technical fact.
- Keep the names of identifiers, files, commands and libraries as they are.
- Keep a sentence to 20 words for an instruction, and 25 words for a description.
- Give one instruction in one sentence. Start it with an imperative verb.
- Use the active voice. Name the thing that does the action.
- Use a simple tense: simple present, simple past or simple future.
- Do not use an `-ing` word as a noun or an adjective.
- Do not join more than three nouns. Write "the timeout for the retry queue", not "the retry queue
  timeout value".
- Keep `that`, `which` and the articles.
- Write `do not` and `cannot`. Do not use a contraction.
- Keep a paragraph to six sentences. Put the topic in the first sentence.
- Start each bullet with an imperative verb.

## Procedure

1. Read each file in full before you edit it. A comment gets its meaning from the code around it.
2. List the candidates in the file: the comment blocks, the docstrings and the prose paragraphs.
3. Apply the keep test to each candidate. Delete the candidate, or name the fact that it holds.
4. Rewrite only the candidates that hold a fact. Stay inside the budgets.
5. Apply the edits file by file. Keep the comment marker, the indent and the docstring syntax of
   the language.
6. Keep the language of the file. Do not translate.

## Check before you report

- Run `git diff --numstat`. The deleted lines outnumber the added lines. If they do not, apply the
  keep test again and delete more.
- Every changed line is a comment, a docstring or markdown prose.
- No identifier, no string literal and no line of code changed.
- No comment is new.
- The file compiles or the linter passes, if the project has that command.
- Each new sentence obeys the writing rules above.
- No comment states a fact that the code contradicts.

## Report

Give the user a short table: the file, the count of the comments that you deleted, the count that
you rewrote, and the net line change. Then name each fact that you removed and that the code no
longer records, so the user can put it in a ticket.

Keep the report to the table and that list.

## Examples

Delete the whole docstring when the signature gives the contract:

Bad:

```ts
/**
 * Gets the user. I refactored this to use the cache because the old version hit the DB
 * on every call, which was slow. Note that we should probably add a TTL later.
 */
function getUser(id: string): User | null
```

Good:

```ts
// The cache holds the user for the life of the process. Restart the process after you
// change a user row.
function getUser(id: string): User | null
```

The signature gives the id, the return type and the null case. Only the cache lifetime survives.

Bad:

```python
# Loop over the items and add each one to the list
for item in items:
    results.append(transform(item))
```

Good:

```python
for item in items:
    results.append(transform(item))
```

Bad:

```md
## Overview

So basically what this module does is it kind of wraps the API client, and we ended up
going with retries here because we were seeing a bunch of flaky 502s from upstream. The
module lives in `src/api/` and exports a single class.
```

Good:

```md
This module wraps the API client. It sends a request again after a 502 response, a
maximum of three times.
```

The heading, the path and the export list add nothing. Delete them.
