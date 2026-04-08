---
name: commit-all
description: "Commit ALL current changes (staged, unstaged, and untracked) with an AI-generated commit message. Use when the user wants to quickly commit everything without manually staging."
argument-hint: "[--mine | optional commit message override]"
user-invocable: true
---

# Commit All Skill

Commit **all** current changes — staged, unstaged, and untracked files — with an automatically generated commit message.

## Modes

- **Default:** Commit all changes (staged, unstaged, untracked).
- **`--mine`:** Only commit files that Claude touched during this conversation. Determine which files Claude touched by reviewing the conversation history for Edit, Write, and MultiEdit tool calls. Ignore files the user changed outside of Claude's tool calls.

## Steps

1. **Check for changes.** Run `git status` (never use `-uall`). If there are no changes at all (no modified, staged, or untracked files), tell the user there is nothing to commit and stop.

2. **Review changes.** Run these in parallel:
   - `git diff` — unstaged changes
   - `git diff --cached` — staged changes
   - `git status` — untracked files
   - `git log --oneline -5` — recent commit style

3. **Stage files.**
   - **Default mode:** Run `git add -A` to stage all changes.
   - **`--mine` mode:** Review the conversation history and collect the list of file paths from all Edit, Write, and MultiEdit tool calls made by Claude. Stage only those files with `git add <file1> <file2> ...`. If none of Claude's files have changes, tell the user and stop.

4. **Generate commit message.** Analyze the staged changes and write a concise commit message:
   - First line: imperative mood summary, under 72 characters (e.g. "Add user auth flow" not "Added user auth flow")
   - If the changes warrant it, add a blank line then a short body with bullet points
   - Match the style of recent commits in the repo
   - Focus on the *why* not the *what*
   - If the user provided a message (not `--mine`), use that instead of generating one

5. **Commit.** Create the commit with attribution using a HEREDOC for the message:
   ```
   git commit -m "$(cat <<'EOF'
   [message here]

   [attribution line if applicable]
   EOF
   )"
   ```

6. **Verify.** Run `git status` to confirm the commit succeeded.

7. **Report.** Show the user a brief summary: commit hash, message, and number of files changed.

## Important rules

- NEVER skip pre-commit hooks (no `--no-verify`)
- NEVER push to remote unless the user explicitly asked
- NEVER amend an existing commit — always create a new one
- If a pre-commit hook fails, fix the issue, re-stage with `git add -A`, and create a NEW commit
- Do not commit files that look like secrets (`.env`, credentials, tokens). Warn the user if such files are present in the changes.
- If the working directory is not a git repository, tell the user and stop.
