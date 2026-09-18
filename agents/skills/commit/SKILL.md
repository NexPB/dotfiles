---
name: commit
description: "Commit the changes from this conversation with a generated message. Use when the user asks to commit."
argument-hint: "[--all] [optional commit message]"
user-invocable: true
---

# Commit

Commit only the changes that you made. The other changes belong to the user.

## Scope

1. Run `git status` (never `-uall`) and `git log --oneline -5`. Stop if the tree is clean or this is not a git repo.
2. List the files that you changed in this conversation, from your tool calls, not from the diff. With `--all`, take every dirty file.
3. State the scope before you commit: commit each dirty file that you changed; drop each file of yours that is now clean; name each dirty file that you did not change, leave it alone, and mention `--all`.
4. Stop if none of your files is dirty. Never widen the scope.

## Commit

5. Read `git diff -- <files>` and `git diff --cached -- <files>`.
6. Stage by name: `git add -- <file> <file>`. Use `git add -A` only for `--all`.
7. Write the message. Take the prefix and the shape from the recent commits, the words from the rules below.
   - Line 1 is one imperative sentence of 72 characters or fewer.
   - Add a body only if the reader needs the reason. Do not list the lines.
   - Use a message from the user as it is.
8. Commit with a HEREDOC, because the message can hold quote marks.
9. Run `git status`. Report the hash, the subject, the file count and what stays dirty.

## Simplified Technical English

Write the subject and the body to ASD-STE100.

- Give each word one meaning. Use the shortest correct word: "use", not "utilize".
- Use the active voice and a simple tense. Keep a sentence to 20 words.
- Keep the articles. Narrow the scope to shorten a line. Start each bullet with an imperative verb.
- Do not use jargon, an idiom, a metaphor, an `-ing` word as a noun or an adjective, or more than three joined nouns.
- Keep code and command names as they are.

## Rules

- Never use `--no-verify`. If a hook fails, fix the cause and commit again.
- Never amend. Never push, unless the user asks.
- Split unrelated changes into separate commits.
- Never commit a secret. Exclude the file and warn the user.
