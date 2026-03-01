# Local Neovim Configuration Snapshot

Last scanned: 2026-03-01

## Overview

- Framework: **LazyVim** (based on lazy.nvim)
- Config path: `~/.config/nvim/`
- Entry point: `init.lua` -> `require("config.lazy")`

## Directory Structure

```
~/.config/nvim/
├── init.lua                    # Entry point
├── lazy-lock.json              # Plugin version lock
├── lazyvim.json                # LazyVim extras config
├── .neoconf.json               # Neoconf server settings
├── stylua.toml                 # Lua formatter (spaces, 2-indent, 120 cols)
├── lua/
│   ├── config/
│   │   ├── lazy.lua            # Plugin manager setup
│   │   ├── options.lua         # Custom options (OSC 52 clipboard)
│   │   ├── keymaps.lua         # Custom keybindings (currently empty)
│   │   └── autocmds.lua        # Custom autocommands (currently empty)
│   └── plugins/
│       └── example.lua         # Example plugin config (disabled, template only)
```

## LazyVim Extras Enabled

From `lazyvim.json`:
- `lazyvim.plugins.extras.ai.copilot` — GitHub Copilot
- `lazyvim.plugins.extras.lang.docker` — Docker support
- `lazyvim.plugins.extras.lang.go` — Go language support
- `lazyvim.plugins.extras.lang.json` — JSON/JSON5/JSONC with schemas
- `lazyvim.plugins.extras.lang.markdown` — Markdown support

## Installed Plugins (38 total)

### Core
- LazyVim, lazy.nvim

### Completion & Snippets
- blink.cmp (completion engine)
- blink-copilot (Copilot integration for blink)
- copilot.lua (GitHub Copilot)
- friendly-snippets
- lazydev.nvim (Lua dev)

### LSP & Linting
- nvim-lspconfig
- mason.nvim (tool installer)
- mason-lspconfig.nvim
- nvim-lint

### Treesitter
- nvim-treesitter
- nvim-treesitter-textobjects
- ts-comments.nvim
- nvim-ts-autotag

### UI & Navigation
- lualine.nvim (status line)
- bufferline.nvim (buffer tabs)
- which-key.nvim (keybinding popup)
- noice.nvim (enhanced UI)
- nui.nvim (UI components)
- snacks.nvim (utilities)
- mini.icons
- mini.ai (text objects)
- mini.pairs (auto-pairing)

### Search & Motion
- flash.nvim (fast motion/search)
- grug-far.nvim (find & replace)

### Git
- gitsigns.nvim

### Formatting
- conform.nvim

### Diagnostics
- trouble.nvim

### Markdown
- markdown-preview.nvim
- render-markdown.nvim

### Themes
- catppuccin
- tokyonight.nvim (default)

### Utilities
- plenary.nvim
- SchemaStore.nvim
- persistence.nvim (session)
- todo-comments.nvim

## Custom Options

Only customization in `options.lua`:
- OSC 52 clipboard support (copy/paste via SSH)

## Custom Keybindings

`keymaps.lua` is empty — all keybindings are LazyVim defaults:
- `<leader>` = Space
- `<leader>f` — Find files (Telescope/snacks)
- `<leader>b` — Buffer management
- `<leader>c` — Code actions / LSP
- `<leader>g` — Git operations
- `<leader>w` — Window management
- `<leader>x` — Diagnostics (trouble.nvim)
- `<leader>s` — Search
- `<leader>u` — UI toggles
- `<leader>q` — Session/quit
- `<leader>l` — Lazy plugin manager
- `s` / `S` — Flash jump (forward/backward)
- `gcc` — Toggle line comment
- `gc` — Toggle comment (visual)
- `]d` / `[d` — Next/prev diagnostic
- `gd` — Go to definition
- `gr` — Go to references
- `K` — Hover documentation

## Custom Autocommands

`autocmds.lua` is empty — all autocommands are LazyVim defaults.
