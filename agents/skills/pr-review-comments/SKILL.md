---
name: pr-review-comments
description: "Fetch unresolved review comments on a GitHub pull request, decide for each one whether it should be addressed, then discuss the verdicts, post replies, or fix the code, in any order. Every reply is written in ASD-STE100 Simplified Technical English. Use when asked to review PR comments, triage review feedback, draft or post replies to PR threads, or address review comments in code. When one request also commits, pushes or waits for CI, use pr-loop."
argument-hint: "[PR number] [discuss | post | fix] [thread numbers]"
user-invocable: true
---

# Reviewing PR Comments

Fetch the unresolved review threads on a GitHub PR and triage each one. Then do one of three
actions on the triage:

| Action | Does | Changes |
| --- | --- | --- |
| `discuss` | Shows the verdicts and the draft replies in the chat, then stops. | Nothing |
| `post` | Posts a reply to each selected thread. | GitHub only |
| `fix` | Changes the code for each selected thread. Does not commit. | The working tree only |

The user chains actions across turns, for example `discuss` → `fix 2 4` → `post`. Every action
works on the same numbered triage.

Write every reply and every draft to the standard below. Talk to the user in plain prose.

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

### Step 1: Identify the PR, the action, and the threads

Determine the PR number from:
1. The user's message (e.g., "review comments on PR #10")
2. The current branch: `gh pr view --json number --jq '.number'`

If neither works, ask the user which PR to address.

Determine the action from the user's words:

- `discuss`: "evaluate", "triage", "what do you think", "let's go through them", or no action named.
- `post`: "reply", "post", "answer the comments".
- `fix`: "address", "fix", "apply", "do it".

Determine the threads from the numbers in the triage table ("fix 2 and 4"). With no numbers,
`post` selects every thread and `fix` selects every thread with the verdict **Yes**.

### Step 2: Triage

Reuse the triage from earlier in this conversation when one exists. The verdicts and drafts that
the user changed in the discussion replace the original ones. Fetch again only when no triage
exists or the user asks to refresh it.

To triage, run the script to get all unresolved review threads, with the IDs needed to post replies:

```bash
bash ~/.claude/skills/pr-review-comments/scripts/fetch-comments.sh <PR_NUMBER>
```

This outputs JSON with each unresolved thread:
- `threadId` — GraphQL node ID of the thread
- `firstCommentDatabaseId` — REST API ID of the first comment in the thread (used to post a reply)
- `path`, `line`, `startLine` — file location
- `outdated` — whether the thread is on an outdated diff
- `comments` — list of `{author, body, createdAt}` objects (the conversation so far)

Number the threads from 1 in the order that the script returns them. For each thread:

1. **Read the referenced file** at `path` around the commented line to understand surrounding
   context. Skip this step for outdated threads where the path context is no longer relevant.
2. **Decide whether the comment should be addressed** using the following heuristics:
   - **Yes** — the comment identifies a real bug, a missing validation, a security concern, a
     factual error, or a clear improvement that aligns with the project's conventions.
   - **No** — the comment is a question already answered by context, a style preference that
     conflicts with existing conventions, out of scope for this PR, or already fixed by another
     commit.
3. **Draft a reply** in the plan format below. When the thread already holds a later comment,
   answer the latest one.

#### Plan reply format

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

Make the steps specific enough that a separate agent can do them without reading any other
discussion.

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

### Step 3: Do the action

#### `discuss`

Show a table with the number, the file, the line, the reviewer, and the verdict of each thread.
Under the table, show each thread: a one-line quote of the latest comment, then the draft reply.

Stop there. Post nothing and change no code. When the user disagrees with a verdict, give your
reasons once, then take the user's decision and rewrite the draft to match it.

#### `fix`

For each selected thread:

1. Do the steps from the plan reply. Keep each change to the scope of its thread.
2. When a **No** thread is selected, ask the user what to change before you change anything.
3. When the code shows that the plan is wrong, stop work on that thread and tell the user.

Run the formatter and the tests that cover the changed files when the project has them. Do not
commit and do not post: the user decides when to do each. Report the threads that you fixed and
the files that you changed.

#### `post`

For each selected thread, choose the reply:

- The thread was fixed in this conversation, and the fix is on the remote branch: use the fixed
  reply format below.
- The thread was fixed, but the fix is not on the remote branch: tell the user and offer to
  commit and push first. Do not post a fixed reply for code that the reviewer cannot see.
- The thread was not fixed: use the plan reply.

```markdown
**Addressed** ✅ in <short commit SHA>

<One or two sentences that tell what changed.>
```

Post each reply through the GitHub REST API. Write the body to a file first, because a reply
holds several lines and quote marks:

```bash
BODY=$(mktemp)
cat > "$BODY" << 'REPLY'
<formatted reply text>
REPLY

gh api \
  repos/{owner}/{repo}/pulls/<PR_NUMBER>/comments/<firstCommentDatabaseId>/replies \
  --method POST \
  --field body=@"$BODY"
```

Reply to every selected thread before you report. Do not stop after a few threads to show the
drafts: the user asked for the replies to be posted.

### Step 4: Report

After `post` or `fix`, give the counts first: the threads that you acted on, the **Yes** count and
the **No** count. Then give a short table with the number, the file, the line, the verdict, and
what you did on each thread (posted, fixed, skipped).
