---
name: pr-review-comments
description: "Fetch unresolved review comments on a GitHub pull request and post a reply to each one analysing whether it should be addressed, with concrete steps when it should. Makes NO codebase changes. Use when asked to review PR comments, triage review feedback, or draft reply plans for PR threads."
---

# Reviewing PR Comments

Fetch unresolved review comments from a GitHub PR, analyse each one, and post a reply saying whether it should be addressed and — if so — the exact steps to do it.

**Do not make any codebase changes.** This skill is purely analytical and communicative.

## Workflow

### Step 1: Identify the PR

Determine the PR number from:
1. The user's message (e.g., "review comments on PR #10")
2. The current branch: `gh pr view --json number --jq '.number'`

If neither works, ask the user which PR to address.

### Step 2: Fetch unresolved review comments

Run the script to get all unresolved (pending) review threads, including the IDs needed to post replies:

```bash
bash ~/.claude/skills/pr-review-comments/scripts/fetch-comments.sh <PR_NUMBER>
```

This outputs JSON with each unresolved thread:
- `threadId` — GraphQL node ID of the thread
- `firstCommentDatabaseId` — REST API ID of the first comment in the thread (used to post a reply)
- `path`, `line`, `startLine` — file location
- `outdated` — whether the thread is on an outdated diff
- `comments` — list of `{author, body, createdAt}` objects (the conversation so far)

### Step 3: For each thread, read context and form a reply

For each unresolved thread:

1. **Read the referenced file** at `path` around the commented line to understand surrounding context. Skip this step for outdated threads where the path context is no longer relevant.
2. **Decide whether the comment should be addressed** using the following heuristics:
   - **Yes** — the comment identifies a real bug, a missing validation, a security concern, a factual error, or a clear improvement that aligns with the project's conventions.
   - **No** — the comment is a question already answered by context, a style preference that conflicts with existing conventions, out of scope for this PR, or already fixed by another commit.
3. **Draft a reply** using the format below.

#### Reply format

```markdown
**Should be addressed: Yes** ✅

<One-sentence explanation of what the problem is and why it matters.>

**Steps to address:**
1. In `<file path>`, function `<name>` (~line <N>):
   - <Concrete action to take, e.g. add/remove/change something>
   - Include a code snippet when helpful:
     ```<language>
     <example code>
     ```
```

or, when the comment should **not** be addressed:

```markdown
**Should be addressed: No** ❌

<One- or two-sentence explanation of why no change is needed — e.g. "This is intentional because …" or "Already handled by … at line N.">
```

Keep replies concise. Steps must be specific enough that a separate agent can implement them without reading any other discussion.

### Step 4: Post each reply

Post the reply to the corresponding thread using the GitHub REST API. Write the reply body to a temporary file first to handle multi-line content safely:

```bash
# Write the reply to a temp file
cat > /tmp/pr_reply.md << 'REPLY'
<formatted reply text>
REPLY

# Post the reply using the first comment's database ID
gh api \
  repos/{owner}/{repo}/pulls/<PR_NUMBER>/comments/<firstCommentDatabaseId>/replies \
  --method POST \
  --field body=@/tmp/pr_reply.md
```

Repeat for every unresolved thread.

### Step 5: Report

After posting all replies, summarise to the user:
- How many threads were analysed
- How many were marked **Yes** (should be addressed)
- How many were marked **No**
- List each thread (file + line) alongside its verdict in a short table

Do not make any code edits.
