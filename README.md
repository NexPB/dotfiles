# Dotfiles

My personal dotfiles.

## Dotbot

This repository uses [Dotbot](https://github.com/anishathalye/dotbot) to bootstrap my dotfiles.
Its pulled as a submodule to the `dotbot` directory.

## Tools

- [Ghostty](https://github.com/ghostty/ghostty) - A modern, minimal, and customizable terminal emulator.

## comment-guard (experimental)

A Claude Code `PostToolUse` hook that flags comments an edit added which break the comment rules in
`agents/AGENTS.md`. It reports; it never blocks an edit.

The binary is committed at `agents/bin/comment-guard-<sha>`, where `<sha>` is the `harness` commit it
was built from. It is `darwin/arm64`. The symlink `~/.claude/bin/comment-guard` keeps a stable name,
so the hook command in `agents/claude-settings.json` does not change when you build a new one.

To build a new one, replace the old file and point the link at the new name:

```sh
cd ~/personal/harness && make build
SHA=$(git rev-parse --short HEAD)
cd ~/personal/dotfiles
git rm agents/bin/comment-guard-*
cp ~/personal/harness/bin/comment-guard agents/bin/comment-guard-$SHA
# set the ~/.claude/bin/comment-guard link in install.conf.yaml to the new name, then:
./install
```

The name carries the source commit, so `ls agents/bin/` against `git -C ~/personal/harness log` says
whether the committed binary is stale. Each build adds about 2.8 MB to `.git` permanently; git stores
a new copy and cannot delta-compress it.

To turn the hook off, set `COMMENT_GUARD=off`. See [FLAGS.md](FLAGS.md).

## verify plugin

A Claude Code plugin at `agents/plugins/verify`, linked to `~/.claude/skills/verify`, which loads it in
place. Each skill verifies one surface and runs as `/verify:<surface>`. The plugin puts the Bun CLI
`bin/verify` on the Bash tool's `PATH` (`verify <surface> run`) and ships a `Stop` hook that blocks
Claude from finishing while a surface's watched files changed during the session and no passing run
covers them. The hook does nothing in a project without a `.verify/<surface>.json`. To turn it off, set
`VERIFY_GATE=off`. See [FLAGS.md](FLAGS.md).

| Skill | Checks |
| --- | --- |
| `verify:shopify-app-ui` | The embedded admin UI of a Shopify app on Phoenix and Inertia, through its standalone view: JS and console errors, failed requests, Phoenix error pages, Inertia protocol errors, undefined `<s-*>` web components, and pixel diffs against committed baselines. App Bridge is stubbed. |

To add a UI surface, list its checks in a `UiTool` under `src/tools/`, register it in
`src/tools/index.ts`, and add `skills/<surface>/SKILL.md`.

`./install` runs `bun install` in the plugin and installs Playwright's Chromium.

## Dev tools (managed by [mise](https://mise.jdx.dev))

Declared in `mise/config.toml`, symlinked to `~/.config/mise/config.toml`. Run `./install` (which calls `mise install`) to sync.

- [ripgrep](https://github.com/BurntSushi/ripgrep) - Fast recursive grep.
- [fd](https://github.com/sharkdp/fd) - User-friendly alternative to `find`.
- [Bun](https://bun.sh) - Runtime for the CLIs in `agents/`.
