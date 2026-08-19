---
name: pr-review-comments
description: "Fetch unresolved review comments on a GitHub pull request and post a reply to each one analysing whether it should be addressed, with concrete steps when it should. Every reply is written in ASD-STE100 Simplified Technical English. Makes NO codebase changes. Use when asked to review PR comments, triage review feedback, or draft reply plans for PR threads."
user-invocable: true
---

# Reviewing PR Comments

Fetch unresolved review comments from a GitHub PR, analyse each one, and post a reply saying whether it should be addressed and — if so — the exact steps to do it.

**Do not make any codebase changes.** This skill is purely analytical and communicative.

All text you post to GitHub, and the final summary you give the user, must obey the writing standard below.

## Writing standard: ASD-STE100

Every reply body and every summary line uses ASD-STE100 Simplified Technical English. The rules
that matter for review replies:

**Words**

- Use one word for one meaning. Once you name a thing (`the handler`, `the cache`), use that same
  name every time. Do not use synonyms for variety.
- Use approved words in their approved part of speech. Prefer short, common verbs: *add*, *remove*,
  *change*, *move*, *set*, *make*, *give*, *find*, *start*, *stop*, *keep*, *let*, *put*, *read*,
  *send*, *show*, *tell*, *use*.
- Replace unapproved words with approved ones, for example:
  | Do not write | Write |
  | --- | --- |
  | utilise, leverage | use |
  | implement, introduce | add, write |
  | refactor | change the structure of |
  | ensure, guarantee | make sure |
  | verify, validate | check |
  | approximately | about |
  | prior to | before |
  | in order to | to |
  | due to the fact that | because |
  | perform a check | check |
- Do not use technical jargon, slang, idioms, or metaphors ("bite you later", "code smell",
  "footgun"). State the technical fact instead.
- Keep the names of code identifiers, files, and libraries as they are. The standard applies to the
  prose around them, not to the code.

**Sentences**

- Write a maximum of 20 words in an instruction sentence, and 25 words in a descriptive sentence.
- Write one instruction in one sentence. Split a compound instruction into separate steps.
- Use the imperative for every instruction: "Add a null check", not "A null check should be added"
  and not "You could add a null check".
- Use the active voice. Name the thing that does the action.
- Use simple tenses only: simple present, simple past, simple future.
- Do not omit `that` or `which`: "the value that the parser returns".
- Keep articles: "the function", "a list" — not "function returns list".
- Do not use `-ing` forms as verbs or nouns. Write "To parse the header, use …", not "Parsing the
  header uses …".
- Use a maximum of three nouns together. Break longer noun clusters with prepositions:
  "the timeout for the retry queue", not "the retry queue timeout value".
- Write `do not`, `cannot`, `it is`. Do not use contractions.

**Paragraphs**

- Write a maximum of six sentences in a paragraph of instructions.
- Put one topic in one paragraph. Put the topic in the first sentence.
- Use a numbered list for steps in a sequence. Use a bullet list for items with no sequence.

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
3. **Draft a reply** using the format below, in ASD-STE100.

#### Reply format

```markdown
**Should be addressed: Yes** ✅

<One sentence that gives the problem and its effect.>

**Steps to address:**
1. In `<file path>`, in the function `<name>` (near line <N>):
   - <One instruction. Start the sentence with a command verb.>
   - <One more instruction, if it is necessary.>
   - Add a code example when it makes the instruction more clear:
     ```<language>
     <example code>
     ```
```

or, when the comment should **not** be addressed:

```markdown
**Should be addressed: No** ❌

<One or two sentences that give the reason. For example: "The code does this on purpose, because …"
or "The check at line N does this already.">
```

Steps must be specific enough that a separate agent can implement them without reading any other
discussion.

#### Check the reply before you post it

Read the draft again and correct it against this list:

- Each sentence has 20 words or fewer.
- Each sentence gives one instruction.
- Each instruction starts with a command verb.
- No sentence uses the passive voice.
- No sentence uses an `-ing` verb form.
- The reply uses the same name for the same thing every time.
- The reply has no jargon, no idioms, and no contractions.

#### Examples

Bad (long, passive, unapproved words, `-ing` forms):

> It's probably worth refactoring this to ensure that the caching layer isn't being hit before the
> user has been authenticated, otherwise you're leveraging stale permissions which could bite you
> later on.

Good (ASD-STE100):

> The cache returns data before the code authenticates the user. This gives the user the permissions
> from the previous session.
>
> **Steps to address:**
> 1. In `src/api/handler.ts`, in the function `handleRequest` (near line 42):
>    - Move the call to `authenticate()` above the call to `cache.get()`.
>    - Return a 401 response when `authenticate()` fails.

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

After posting all replies, summarise to the user in ASD-STE100:
- How many threads were analysed
- How many were marked **Yes** (should be addressed)
- How many were marked **No**
- List each thread (file + line) alongside its verdict in a short table

Do not make any code edits.
