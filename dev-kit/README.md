# dev-kit

规格驱动开发的控制流程：获批 spec → 隔离分支 → 长任务 plan → TDD 实现与独立审查 → 两轴静态收尾 → 主会话 runtime 验证 → 用户选择交付。`init` 独立负责项目约束、文档、guardrail 与 e2e harness。

## 安装

> **dev-kit 还没合并进 `main`。** 下面凡是指向 `main` 的地方，合并之前都要换成带 dev-kit 的分支。

### 作为 Pi package

```bash
pi install /path/to/skills/dev-kit
```

执行 `/reload` 后，Pi 加载 bootstrap extension 与共享 skills。基础包不包含进程派发工具，计划 ready 闸门只提供 `inline`。

需要 subagent 时再单独安装可选包：

```bash
pi install /path/to/skills/dev-kit/.pi/extensions/subagent
```

当前会话的工具集合要到 `/reload` 后才更新；工具列表出现 `subagent` 后，后续 ready 闸门才同时提供 `subagent` 与 `inline`。移除时用 `pi remove <pi list 中显示的本地 source>`，再执行 `/reload`。

该包不创建或读取用户/项目 agent profile，也不保存 `cheap / mid / strong` 模型映射。主会话在每次派发时从当前可用模型中选择真实 `provider/model`。参数、权限 profile 与安全边界见[包内 README](./.pi/extensions/subagent/README.md)。

### 作为 Claude Code plugin

插件清单在仓库根 `.claude-plugin/marketplace.json`，`source` 为 `./dev-kit`：

```text
/plugin marketplace add CodFrm/skills    # 合并前改用本地路径：/path/to/skills
/plugin install dev-kit@codfrm-skills
```

### 要改 dev-kit 本体：软链接

插件安装是**拷贝**目录到 `~/.claude/plugins/cache/`，工作区里未提交的改动它一律看不见。软链接过去，加载的就是工作区本身：

```bash
ln -s /path/to/skills/dev-kit ~/.claude/skills/dev-kit          # skill 正文 + SessionStart hook
ln -s /path/to/skills/dev-kit/bin/devkit ~/.local/bin/devkit     # 可选 CLI；换成你 PATH 上的目录
```

- **两种装法不能并存，冲突时不报错。** 插件按名字抢先，软链接那份会在 `claude plugin list` 里变成 `✘ Not loaded`，症状只是「改动突然不生效了」。先 `claude plugin uninstall dev-kit@codfrm-skills`。
- 生效时机分三档：**skill 正文**下次 invoke 即生效；**hook 注入的引导**是会话开始时的快照，要新会话或 `/clear`；**改 `hooks.json` 本身**要重启 Claude Code。

### 只装某几个 Skill

按仓库根 README 的方式把链接交给智能体（`main` 换成带 dev-kit 的分支）：

```text
帮我安装这个 skill：https://github.com/CodFrm/skills/tree/main/dev-kit/skills/brainstorming
```

这样只拿到 skill 正文，没有下面的 SessionStart hook 和 `devkit` 命令。

## 包含的 Skills

| Skill | 什么时候用 |
|---|---|
| [using-dev-kit](./skills/using-dev-kit/) | 每个开发会话的开头，以及写代码、跑命令、向用户提问之前——这套 kit 的引导页 |
| [init](./skills/init/) | 项目要立规矩，或老项目文档过期、没有护栏、同一类问题反复出现 |
| [brainstorming](./skills/brainstorming/) | 要加功能、改行为或设计 UI，且需求或边界仍未确定；已经定案、可在一个会话完成的小改动直接进入 TDD 或项目检查 |
| [writing-plans](./skills/writing-plans/) | spec 获批之后，改动拆下来超过约三步，或要跨会话 |
| [using-git-worktrees](./skills/using-git-worktrees/) | 用户确认 spec 草稿没有问题、要把它和实现放进独立分支时，以及分支收尾交付时 |
| [executing-plans](./skills/executing-plans/) | 已有定稿的 `.dev-kit/plans/*.yaml` 要推进或收尾 |
| [test-driven-development](./skills/test-driven-development/) | 实现新行为、修可复现的 bug、改公开契约——在写生产代码之前 |
| [systematic-debugging](./skills/systematic-debugging/) | bug、测试失败、构建报错、性能回退、偶发故障、行为与 spec 不符——在提出修复方案之前 |

## 链路

When design remains unsettled: `brainstorming` → `using-git-worktrees` → (`writing-plans` for long work) → `test-driven-development` inside implementation → `executing-plans` for independent task/batch review, two-axis static wrap-up and main-session runtime verification → `using-git-worktrees` for delivery. A settled small change starts at `test-driven-development` or the applicable project checks.

Each skill owns its entry gate, state transitions and hand-off. [`using-dev-kit`](./skills/using-dev-kit/SKILL.md) routes the initial request; [`executing-plans`](./skills/executing-plans/SKILL.md) exclusively owns concurrency authorization and subagent review boundaries. `init` triggers independently.

## 可选 CLI

`devkit serve [--port <n>]`——对 `docs/specs/` 和 `.dev-kit/artifacts/` 起一个只读静态服务器，让跑不起 dev server 的 mockup 也能在浏览器里打开。装成 plugin 后会话内直接可用，否则按路径 `node <plugin 根目录>/bin/devkit serve`。

`devkit plan <子命令> [--plan <slug>]`——读写 `.dev-kit/plans/` 下的 plan：`next` 列 ready 任务，`show` 出状态摘要或单个任务，`check` 把坏状态值与悬空 deps 报为错误、schema 外的键报为提示；`set`、`task`、`review`、`context`、`verification` 写回执行期可变字段——替换只改被寻址那个值所占的行（折叠标量会收成一行），追加插入新行、并把模板出厂的空列表 `[]` 那一行改写成键行，其余字节不变。逐条 flag 见 `devkit help`。

## SessionStart hook

插件通过 `hooks/hooks.json` 注册，在会话 startup / clear / compact 时把 `using-dev-kit` 引导注入上下文，省掉每次手动唤起。

## 跑测试

```bash
node --test dev-kit/tests/*.test.js
```

**必须带上 `*.test.js`**，写成 `node --test dev-kit/tests/` 会以 `MODULE_NOT_FOUND` 失败。
