# nvim-helper

Neovim / LazyVim 配置助手。

## 功能

回答关于 Neovim 和 lazy.nvim/LazyVim 的配置、快捷键、插件及使用方法等问题。

## 适用场景

- 查询或修改 Neovim 快捷键
- 添加/配置插件
- LSP 语言服务器设置
- LazyVim extras 的启用与管理
- 排查 Neovim 配置问题

## 当前用户配置概览

- 框架：**LazyVim**（基于 lazy.nvim）
- 已安装 **38 个插件**，包括 blink.cmp、copilot、flash.nvim、trouble.nvim、gitsigns 等
- 已启用的 LazyVim extras：Copilot、Go、Docker、JSON、Markdown
- 主题：tokyonight（默认），catppuccin 可用
- Leader 键：Space

详见 `references/local-config.md`。

## 工作原理

1. 优先查阅 `references/local-config.md` 中的本地配置快照
2. 需要时扫描 `~/.config/nvim/` 下的实际配置文件
3. 结合上下文回答，区分 LazyVim 默认配置与用户自定义配置
4. 如发现配置有变更，自动更新快照文件

## 文件结构

```
nvim-helper/
├── SKILL.md                    # Skill 定义（英文）
├── README.md                   # 说明文档（本文件）
└── references/
    └── local-config.md         # 本地 Neovim 配置快照
```

## 安装

将本目录复制到 `~/.claude/skills/` 下即可：

```bash
cp -r nvim-helper ~/.claude/skills/
```
