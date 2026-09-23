---
name: git-ai-search
description: "Find which AI sessions wrote a commit, a file or a line range, read their transcripts, and resume them. Use when asked what AI wrote something, to see the conversation behind a change, or to pick up someone's AI session."
argument-hint: "[commit, file, line range, or question]"
user-invocable: true
---

# Git AI search

Git AI (1.7.4) records, in git notes, which agent session wrote each line. The notes hold the session identity and line stats, not the conversation. For Claude Code sessions, the conversation lives in the local transcript that the session id names.

## Find the sessions

| To find the sessions for… | Run |
| --- | --- |
| a line range | `git-ai blame <file> -L <start>,<end> --json` |
| a whole file | `git-ai blame <file> --json` |
| a commit | `git-ai diff <sha> --json` (`.sessions`, `.files`) |
| a range of commits | `for c in $(git rev-list <sha1>..<sha2>); do git-ai diff $c --json \| jq -c '.sessions'; done` |
| the raw note of a commit | `git-ai show <sha>` |
| the AI share per commit | `git-ai log [git log filters] [-- <path>]` |
| the AI share of one commit | `git-ai stats <sha> --json` |
| a prompt key's line stats | `git-ai show-prompt <key>` |
| local totals per repo | `git-ai usage --period 30d --json` |

`blame --json` gives `lines` (range → prompt key) and `prompts` (key → `agent_id`, `human_author`, line stats, commits). A key that starts with `h_` is a human. `agent_id` has the `tool`, the `model` and the session `id`.

For a PR, take its range from `gh pr view <n> --json baseRefOid,headRefOid`. A range diff (`git-ai diff <a>..<b> --json`) holds each note only as a string, so loop over the commits instead.

There is no full-text search over prompts. To find sessions by topic, collect the session ids with the commands above, then grep the transcripts.

## Read a transcript

For `tool: "claude"`, the transcript is at `~/.claude/projects/<project>/<id>.jsonl`, where `<project>` is the session's working directory with each `/` replaced by `-`. Find it with `ls ~/.claude/projects/*/<id>.jsonl`. It exists only on the machine that ran the session, and only until Claude Code prunes it.

Each line is one JSON event. The human prompts are the `user` events with string content:

```bash
jq -r 'select(.type=="user" and (.message.content|type)=="string") | .message.content' <path>
```

The `assistant` events hold the replies and the tool calls. Transcripts reach hundreds of kilobytes: filter with `jq` or `grep` rather than read one whole.

## Resume a session

Run `claude --resume <id>` from the session's working directory, which the project folder name gives. There is no resume for other tools.

## Team-wide questions

The notes cover one repo and the transcripts cover one machine. For sessions across the team, with their transcripts, use the `prompt-analysis` skill, which queries the Git AI backend.
