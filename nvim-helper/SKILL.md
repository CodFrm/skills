---
name: nvim-helper
description: Answer questions about Neovim and lazy.nvim/LazyVim configuration, keybindings, plugins, and usage. Use this skill whenever the user asks about nvim, neovim, lazy.nvim, LazyVim, vim keybindings, plugin configuration, LSP setup, or any Neovim-related topic — even if they just say something like "how do I do X in vim" or ask about a specific keybinding or plugin.
---

# Neovim / LazyVim Helper

Help the user understand and work with their Neovim setup. The user runs a **LazyVim**-based configuration with lazy.nvim as the plugin manager.

## How to answer questions

1. **Check local config first.** Read `references/local-config.md` in this skill's directory for a snapshot of the user's actual configuration — installed plugins, keybindings, options, and directory structure. This gives you grounding so you don't guess about what's installed.

2. **Scan live config when needed.** The snapshot may be outdated. If the user asks about something that might have changed, or if you need details not in the snapshot, read the actual config files:
   - `~/.config/nvim/init.lua` — entry point
   - `~/.config/nvim/lua/config/options.lua` — custom options
   - `~/.config/nvim/lua/config/keymaps.lua` — custom keybindings
   - `~/.config/nvim/lua/config/autocmds.lua` — custom autocommands
   - `~/.config/nvim/lua/plugins/` — plugin configurations
   - `~/.config/nvim/lazyvim.json` — enabled LazyVim extras
   - `~/.config/nvim/lazy-lock.json` — installed plugin versions

3. **Answer in context.** When explaining keybindings, mention whether they come from LazyVim defaults or a custom config. When discussing plugins, note whether they're already installed. When suggesting configuration changes, show the exact file to edit and the Lua code to add.

4. **Be practical.** Prefer short, actionable answers. Show the keybinding or config snippet directly. Add brief explanation of *why* it works that way only when helpful.

## What you know about this setup

The user's config is a LazyVim starter with:
- **38 plugins** including blink.cmp, copilot, flash.nvim, trouble.nvim, gitsigns, etc.
- **LazyVim extras**: Copilot, Go, Docker, JSON, Markdown
- **Theme**: tokyonight (default), catppuccin available
- **Custom options**: OSC 52 clipboard for SSH
- **No custom keymaps or autocommands yet** — all defaults from LazyVim
- **Leader key**: Space

See `references/local-config.md` for full details.

## Updating the snapshot

If you scan the live config and find significant changes (new plugins, new keymaps, changed options), update `references/local-config.md` to keep it current. This way future questions can be answered faster without re-scanning.

## Common question patterns

- **"How do I X?"** — Check if there's already a keybinding or plugin for it. If yes, tell them. If not, suggest the config change.
- **"What does key X do?"** — Look up in LazyVim defaults or custom keymaps.
- **"How do I add plugin X?"** — Show how to create a file in `lua/plugins/` with the lazy.nvim spec.
- **"How do I configure LSP for language X?"** — Check if there's a LazyVim extra for it, or show manual lspconfig setup.
- **"Something is broken"** — Ask them to check `:checkhealth`, `:Lazy`, or specific error messages. Guide debugging.
