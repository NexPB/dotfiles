# Dotfiles

My personal dotfiles.

## Dotbot

This repository uses [Dotbot](https://github.com/anishathalye/dotbot) to bootstrap my dotfiles.
Its pulled as a submodule to the `dotbot` directory.

## Tools

- [Ghostty](https://github.com/ghostty/ghostty) - A modern, minimal, and customizable terminal emulator.

## Dev tools (managed by [mise](https://mise.jdx.dev))

Declared in `mise/config.toml`, symlinked to `~/.config/mise/config.toml`. Run `./install` (which calls `mise install`) to sync.

- [ripgrep](https://github.com/BurntSushi/ripgrep) - Fast recursive grep.
- [fd](https://github.com/sharkdp/fd) - User-friendly alternative to `find`.
