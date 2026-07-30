# Skills

通用 Skills 合集

## 安装

将 `[SKILL_PATH]` 替换为仓库内的完整相对路径；嵌套 Skill 也可直接安装。

### Claude Code

```
帮我安装这个 skill：https://github.com/CodFrm/skills/tree/main/[SKILL_PATH]
```

### OpenClaw

```
帮我安装这个 skill：https://github.com/CodFrm/skills/tree/main/[SKILL_PATH]
```

## Skills 列表

### Coding Agent 编排

合集说明：[coding-agents](./coding-agents/)

| Skill | 说明 |
|-------|------|
| [pi-agent-orchestrator](./coding-agents/pi-agent-orchestrator/) | 可靠派发、监控、恢复并验收 Pi Coding Agent 编码任务 |

### 飞书生活管理

合集说明：[feishu-life](./feishu-life/)

| Skill | 说明 |
|-------|------|
| [feishu-personal-asset-ledger](./feishu-life/feishu-personal-asset-ledger/) | 用飞书多维表格建立和维护个人或家庭资产台账 |
| [feishu-investment-asset-manager](./feishu-life/feishu-investment-asset-manager/) | 用飞书管理股票、黄金、基金等投资资产及利润、做 T 收益 |
| [feishu-renovation-manager](./feishu-life/feishu-renovation-manager/) | 用飞书管理装修预算、采购、施工、验收、结算与资料归档 |

### 投资分析

合集说明：[investment](./investment/)

| Skill | 说明 |
|-------|------|
| [global-stock-investment-analyst](./investment/global-stock-investment-analyst/) | 分析A股、港股、美股和ETF，综合行情、财报、估值、新闻、宏观与持仓给建议 |

### 开发工具

合集说明：[dev-kit](./dev-kit/)——规格驱动开发的技能集。**spec 决定做什么，plan 决定怎么做**：需求 → spec 获批并提交 → 执行计划 → 隔离工作区 → 逐任务 TDD 推进并互审 → 两项静态收尾审查 → 独立 runtime 验证报告 → 交付。链路之外另有 `init`，负责立起项目自身的约束。

| Skill | 说明 |
|-------|------|
| [dev-kit / using-dev-kit](./dev-kit/skills/using-dev-kit/) | dev-kit 引导：有哪些技能、何时用，以及共享的提问与派发规则 |
| [dev-kit / init](./dev-kit/skills/init/) | 初始化或补齐 AGENTS.md、分层文档、lint/CI 护栏、单测与 e2e 验证流程 |
| [dev-kit / brainstorming](./dev-kit/skills/brainstorming/) | 探索需求并逐节达成一致，写成 `docs/specs/<日期-短名>.md`，过用户后提交 |
| [dev-kit / writing-plans](./dev-kit/skills/writing-plans/) | 把获批的 spec 转成执行计划：任务切成垂直切片，`deps` 排序、`files` 决定谁能并行 |
| [dev-kit / using-git-worktrees](./dev-kit/skills/using-git-worktrees/) | 把一轮工作关进独立工作区再动手，收尾时给出合并 / PR / 搁置的选项 |
| [dev-kit / executing-plans](./dev-kit/skills/executing-plans/) | 批量派发 ready 任务并行推进，每个 commit 由没写它的 subagent 审并修；收尾两个 subagent 静态审 spec 与代码，通过后由全新的第三 subagent 跑 runtime 验证并写报告 |
| [dev-kit / test-driven-development](./dev-kit/skills/test-driven-development/) | 先写失败测试、确认它为「行为缺失」而红、再写最小实现 |
| [dev-kit / systematic-debugging](./dev-kit/skills/systematic-debugging/) | 没有复现和根因就不动生产代码，复现件交给 TDD 当红 |

### 其他 Skills

| Skill | 说明 |
|-------|------|
| [moviepilot](./moviepilot/) | 影视订阅与管理，支持搜索、订阅、下载电影和电视剧 |
| [nvim-helper](./nvim-helper/) | Neovim / LazyVim 配置助手，解答快捷键、插件、LSP 等问题 |
