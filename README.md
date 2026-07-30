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

合集说明：[dev-kit](./dev-kit/)——规格驱动开发的技能集，链路走完整条：需求 →「spec 获批并提交」→ 隔离工作区 → 逐段实现（每段一轮 TDD，遇故障转系统化调试）→ 派发出去的整体评审加项目门禁 → 交付。链路之外另有 `init`，负责把项目自身的约束立起来：AGENTS.md、分层文档、接进 CI 的 lint 护栏，以及单测与 e2e 两条验证轨道。会话开始时有 SessionStart hook 把引导注入上下文。

| Skill | 说明 |
|-------|------|
| [dev-kit / using-dev-kit](./dev-kit/skills/using-dev-kit/) | dev-kit 引导：有哪些开发技能、何时用，以及共享的提问与派发规则 |
| [dev-kit / init](./dev-kit/skills/init/) | 扫描项目现状并初始化或补齐 AGENTS.md、分层文档、lint/CI 护栏、单元测试与 e2e 验证流程 |
| [dev-kit / brainstorming](./dev-kit/skills/brainstorming/) | 探索需求并逐节达成设计一致，必要时出 HTML mockup，写成 `docs/specs/<日期-短名>.md`，过用户后提交 |
| [dev-kit / using-git-worktrees](./dev-kit/skills/using-git-worktrees/) | 把一轮工作关进独立工作区再动手：先检测是否已隔离、问过用户、确认 spec 已提交，收尾时给出合并/PR/搁置的选项 |
| [dev-kit / test-driven-development](./dev-kit/skills/test-driven-development/) | 先写失败测试、确认它为「行为缺失」而红、再写最小实现；测试怎么设计交给项目的 `docs/testing.md` |
| [dev-kit / systematic-debugging](./dev-kit/skills/systematic-debugging/) | 没有复现和根因就不动生产代码：定义偏差、复现、归因、给组件边界埋点、一次只验一个假设，复现件交给 TDD 当红 |

### 其他 Skills

| Skill | 说明 |
|-------|------|
| [moviepilot](./moviepilot/) | 影视订阅与管理，支持搜索、订阅、下载电影和电视剧 |
| [nvim-helper](./nvim-helper/) | Neovim / LazyVim 配置助手，解答快捷键、插件、LSP 等问题 |
