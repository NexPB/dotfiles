---
name: simplify-docs
description: "Rewrite code comments, docstrings and prose docs into ASD-STE100 Simplified Technical English. Remove narration of the edit, conversational asides and implementation history, so each comment describes the code next to it. Changes no code. Use when asked to simplify, clean up, tidy or rewrite comments, docstrings, README or other docs."
argument-hint: "[paths or globs] [--all]"
user-invocable: true
---

# Simplify Docs

Rewrite the prose in the code into Simplified Technical English. Each comment describes the code
beside it. Each docstring gives the contract.

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

## What to remove

Remove text that speaks about the edit, the author or the conversation.

| Remove | Reason |
| --- | --- |
| `// Changed this to use a Map for speed` | It describes the edit, not the code. |
| `// Previously we called fetchAll() here` | It describes an old version. Git holds that. |
| `// NOTE: I moved this above the guard clause` | It is a note to a reviewer. |
| `// As discussed, this now returns null` | It is part of a conversation. |
| `// Simple helper that just adds two numbers` | It restates the code. |
| `// TODO: ask Sam if this is still needed` | It is a question for one person, not a task. |
| `# ---- section ----` banners with no content | They carry no information. |

Delete a comment that only restates the line below it. Do not replace it with a shorter restatement.

## What to keep

Keep, and rewrite, the text that the reader cannot get from the code:

- the contract: the inputs, the output, the errors, the units and the valid ranges
- a gotcha: an order that matters, a lock, a limit, a race, a rate limit
- an unknown: a value that the team measured, a case that nobody tested
- a reason that stays true: a protocol rule, a spec, a hardware limit, a ticket link
- an example that teaches the consumer

## Where each kind of text belongs

- A **docstring** states what the code does and the contract. Keep the reason for the
  implementation out of it.
- A **code comment** holds the reason, the workaround and the defect in other code. Put it on the
  line that it explains.

Move misplaced text to the correct place. Delete it if it only describes the edit.

## Writing standard: ASD-STE100

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
3. For each candidate, choose one action: **delete**, **rewrite** or **keep as it is**.
4. Apply the edits file by file. Keep the comment marker, the indent and the docstring syntax of
   the language.
5. Keep the language of the file. Do not translate.

## Check before you report

- Run `git diff`. Every changed line is a comment, a docstring or markdown prose.
- No identifier, no string literal and no line of code changed.
- The file compiles or the linter passes, if the project has that command.
- Each new sentence obeys the rules above. Read the diff again and correct it.
- No comment states a fact that the code contradicts.

## Report

Give the user a short table: the file, the count of the comments that you deleted, and the count
that you rewrote. Name each fact that you removed and that the code no longer records, so the user
can put it in a ticket.

## Examples

Bad:

```ts
/**
 * Gets the user. I refactored this to use the cache because the old version hit the DB
 * on every call, which was slow. Note that we should probably add a TTL later.
 */
```

Good:

```ts
/**
 * Returns the user for the id. Returns null when no user has that id.
 */
// The cache holds the user for the life of the process. Restart the process after you
// change a user row.
```

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
So basically what this module does is it kind of wraps the API client, and we ended up
going with retries here because we were seeing a bunch of flaky 502s from upstream.
```

Good:

```md
This module wraps the API client. It sends a request again after a 502 response, a
maximum of three times.
```
