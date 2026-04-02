---
name: commit-all
description: "Commit ALL current changes (staged, unstaged, and untracked) with an AI-generated commit message. Use when the user wants to quickly commit everything without manually staging."
argument-hint: "[optional commit message override]"
allowed-tools: ["Bash(git:*)", "Read"]
---

# Commit All Skill

Commit **all** current changes — staged, unstaged, and untracked files — with an automatically generated commit message.

## Steps

1. **Check for changes.** Run `git status` (never use `-uall`). If there are no changes at all (no modified, staged, or untracked files), tell the user there is nothing to commit and stop.

2. **Review changes.** Run these in parallel:
   - `git diff` — unstaged changes
   - `git diff --cached` — staged changes
   - `git status` — untracked files
   - `git log --oneline -5` — recent commit style

3. **Stage everything.** Run `git add -A` to stage all changes (modified, deleted, and untracked).

4. **Generate commit message.** Analyze all the changes and write a concise commit message:
   - First line: imperative mood summary, under 72 characters (e.g. "Add user auth flow" not "Added user auth flow")
   - If the changes warrant it, add a blank line then a short body with bullet points
   - Match the style of recent commits in the repo
   - Focus on the *why* not the *what*
   - If the user provided a message as an argument, use that instead of generating one

5. **Commit.** Create the commit using a HEREDOC for the message:
   ```
   git commit -m "$(cat <<'EOF'
   <message here>

   Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
   EOF
   )"
   ```

6. **Verify.** Run `git status` to confirm the commit succeeded and the working tree is clean.

7. **Report.** Show the user a brief summary: commit hash, message, and number of files changed.

## Important rules

- NEVER skip pre-commit hooks (no `--no-verify`)
- NEVER push to remote unless the user explicitly asked
- NEVER amend an existing commit — always create a new one
- If a pre-commit hook fails, fix the issue, re-stage with `git add -A`, and create a NEW commit
- Do not commit files that look like secrets (`.env`, credentials, tokens). Warn the user if such files are present in the changes.
- If the working directory is not a git repository, tell the user and stop.
