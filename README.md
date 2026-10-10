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

## verify-admin-ui

A Playwright check for the embedded admin UI of the Shopify apps (Phoenix, Inertia, Polaris web
components), linked to `~/.claude/bin/verify-admin-ui` and run with Bun. In an app with a
`.verify/admin-ui.json`, `verify-admin-ui run` loads each listed page through the standalone admin
view against the running Phoenix server and fails on JS and console errors, failed requests, Phoenix
error pages, undefined `<s-*>` web components, and any pixel of difference from the committed
baselines in `.verify/admin-ui/baseline/`. App Bridge is stubbed.

The `Stop` hook `verify-admin-ui gate` blocks Claude from finishing while `assets/` or `lib/*_web`
have uncommitted changes that no passing run covers. It does nothing in a project without
`.verify/admin-ui.json`. The `verify-admin-ui` skill teaches the loop and the setup. To turn the hook
off, set `VERIFY_ADMIN_UI_GATE=off`. See [FLAGS.md](FLAGS.md).

`./install` runs `bun install` in `agents/verify-admin-ui` and installs Playwright's Chromium.

## Dev tools (managed by [mise](https://mise.jdx.dev))

Declared in `mise/config.toml`, symlinked to `~/.config/mise/config.toml`. Run `./install` (which calls `mise install`) to sync.

- [ripgrep](https://github.com/BurntSushi/ripgrep) - Fast recursive grep.
- [fd](https://github.com/sharkdp/fd) - User-friendly alternative to `find`.
- [Bun](https://bun.sh) - Runtime for the CLIs in `agents/`.
