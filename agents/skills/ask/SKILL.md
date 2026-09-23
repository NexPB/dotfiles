---
name: ask
description: "Answer a question about AI-written code as the agent that wrote it, from the original conversation. Use when exploring code and the user asks why or how a piece of code was built the way it was."
argument-hint: "[a question to the AI who authored the code you're looking at]"
allowed-tools: ["Bash(git-ai:*)", "Bash(ls:*)", "Bash(jq:*)", "Read", "Glob", "Grep", "Task"]
---

# Ask

Find the conversation that produced the code, then answer as its author.

## 1. Resolve the code

Take the first source that applies:

1. An editor selection. A `<system-reminder>` like "The user selected the lines 2 to 4 from /path/to/file.rs" gives the file and the range. Most `/ask` calls come this way, with no file named in the question.
2. A file and lines named in the question.
3. A named symbol. Read the file and take the lines of its definition.
4. A file with no lines. Use the whole file.

If none applies, reply "Select some code or mention a specific file or symbol, then `/ask` your question." and stop.

## 2. Find the sessions

```bash
git-ai blame <file> -L <start>,<end> --json
```

`lines` maps each range to a prompt key. `prompts.<key>.agent_id` gives the `tool`, the `model` and the `id`. For `tool: "claude"`, the `id` is a Claude Code session, and its transcript is at:

```bash
ls ~/.claude/projects/*/<id>.jsonl
```

Only Claude sessions recorded on this machine resolve. For any other tool, or a missing file, answer from the code (step 4).

## 3. Read the transcript in a subagent

A transcript runs to hundreds of kilobytes, so read it in one subagent and keep it out of this context. Spawn one `general-purpose` subagent per `/ask`, even when the range has several sessions, with this prompt:

```
Answer a question about code as the agent that wrote it, in the first person.

QUESTION: {question}
CODE: {file_path} lines {start}-{end}
TRANSCRIPTS: {jsonl paths, oldest first}

Read the code. Then read the transcripts. Each line is a JSON event: the user's
prompts are `type == "user"` events whose `.message.content` is a string, and the
assistant's reasoning and edits are the `type == "assistant"` events. Filter with
jq, for example:
  jq -r 'select(.type=="user" and (.message.content|type)=="string") | .message.content' <path>
Find the part of the conversation that produced these lines. Read only the
transcripts listed above: other sessions are about other code.

Reply in this form:
- **Answer**: the direct answer, in the author's voice ("I wrote this because…").
- **Original context**: what the human asked for, and why.
- **Dates**: when the work happened, and the human author.
```

Relay the answer.

## 4. No transcript

Say that no AI conversation was found for this code: it may be human-written, predate git-ai, come from another machine or tool, or be older than Claude Code keeps transcripts. Then answer from the code, in the third person.
