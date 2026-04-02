# Dotfiles

Personal dotfiles managed with [Dotbot](https://github.com/anishathalye/dotbot).

## Structure

- `install.conf.yaml` — Dotbot configuration (clean, create, link, shell directives)
- `install` — Bootstrap script that runs Dotbot
- `dotbot/` — Dotbot submodule
- Config directories (e.g. `ghostty/`, `.ssh/`) contain the actual dotfiles

## How it works

Dotbot symlinks config files from this repo to their expected locations on the system. The mapping is defined in `install.conf.yaml`. Run `./install` to apply.

## Conventions

- Each tool's config lives in its own directory (e.g. `ghostty/config`, `.ssh/config`)
- New configs should be added to `install.conf.yaml` with appropriate `create` and `link` entries
