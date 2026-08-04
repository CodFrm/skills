# Skills

可独立安装的 Agent Skills 合集。

## 安装

用下表中的 Skill 目录路径替换 `[SKILL_PATH]`，再交给支持 Skills 安装的智能体：

```text
帮我安装这个 Skill：https://github.com/CodFrm/skills/tree/main/[SKILL_PATH]
```

`dev-kit` 的整套插件、开发软链接和单 Skill 安装方式见 [dev-kit/README.md](./dev-kit/README.md)。

## 目录

### [dev-kit](./dev-kit/) · 规格驱动开发

| Skill | 用途 |
|---|---|
| [using-dev-kit](./dev-kit/skills/using-dev-kit/) | 选择技能并遵守共享的提问、派发规则 |
| [init](./dev-kit/skills/init/) | 补齐项目文档、lint/CI 护栏、单测与 e2e 流程 |
| [brainstorming](./dev-kit/skills/brainstorming/) | 探索需求并将定稿设计写成 spec |
| [writing-plans](./dev-kit/skills/writing-plans/) | 将获批 spec 拆成可执行、可并行的计划 |
| [using-git-worktrees](./dev-kit/skills/using-git-worktrees/) | 在隔离工作区开发并处理分支交付 |
| [executing-plans](./dev-kit/skills/executing-plans/) | 按计划推进任务、互审、静态审查和运行时验证 |
| [test-driven-development](./dev-kit/skills/test-driven-development/) | 以失败测试驱动新行为和缺陷修复 |
| [systematic-debugging](./dev-kit/skills/systematic-debugging/) | 先复现并定位根因，再进入修复 |

可选 Pi 单任务派发集成：[dev-kit-pi-subagent](./dev-kit/.pi/extensions/subagent/)；单独安装后每次调用启动一个独立子进程，主会话负责串行依赖和获准的并行 sibling calls，基础 dev-kit 仍保持 inline。

### [coding-agents](./coding-agents/) · Coding Agent 编排

| Skill | 用途 |
|---|---|
| [pi-agent-orchestrator](./coding-agents/pi-agent-orchestrator/) | 可靠派发、监控、恢复并验收 Pi Coding Agent 任务 |

### [feishu-life](./feishu-life/) · 飞书生活管理

| Skill | 用途 |
|---|---|
| [feishu-personal-asset-ledger](./feishu-life/feishu-personal-asset-ledger/) | 建立和维护个人或家庭耐用品资产台账 |
| [feishu-investment-asset-manager](./feishu-life/feishu-investment-asset-manager/) | 管理股票、黄金、基金等投资资产及做 T 收益 |
| [feishu-renovation-manager](./feishu-life/feishu-renovation-manager/) | 管理装修预算、采购、施工、验收、结算与归档 |

### [investment](./investment/) · 投资分析

| Skill | 用途 |
|---|---|
| [global-stock-investment-analyst](./investment/global-stock-investment-analyst/) | 分析 A 股、港股、美股和 ETF，结合行情、财报、估值、新闻、宏观与持仓给出建议 |

### 独立 Skills

| Skill | 用途 |
|---|---|
| [moviepilot](./moviepilot/) | 搜索、订阅和下载电影、电视剧 |
| [nvim-helper](./nvim-helper/) | 解答 Neovim / LazyVim 配置、快捷键、插件和 LSP 问题 |
