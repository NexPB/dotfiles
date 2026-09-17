# Flags

Environment variables that change how the Claude Code setup behaves. Claude Code passes its `env`
block to the commands it spawns, so a flag set there reaches the hooks.

Set a flag for one project in `.claude/settings.local.json`. Claude Code applies the change when you
save the file:

```json
{ "env": { "COMMENT_GUARD": "off" } }
```

Set a flag for one session on the command line:

```sh
COMMENT_GUARD=off claude
```

Do not set a flag in `agents/claude-settings.json`. An `env` block in a settings file replaces the
value from the shell, which stops the second form from working.

## COMMENT_GUARD

Controls the [comment-guard](README.md#comment-guard-experimental) hook.

| Value | Effect |
| --- | --- |
| `off` | The hook returns before it reads the edit. |
| Unset, or any other value | The hook runs. |

The hook reads the variable on each call, so a change applies to the next edit.
