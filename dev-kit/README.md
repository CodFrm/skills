# dev-kit

规格驱动开发的技能集。一轮开发的链路：需求与设计达成一致 → 隔离工作区 →「spec 获批并提交到该分支」→ 执行计划 → 逐任务 TDD 推进并互审 → 两项静态收尾审查 → 独立 runtime 验证报告 → 交付。

**spec 决定做什么，plan 决定怎么做**，两者都不因为「代码写出来不一样」而回头改。判「完成」只认命令、退出码和观察到的现象，且不在生产它的上下文里判定。链路之外另有 `init`，负责立起项目自身的约束：AGENTS.md、分层文档、接进 CI 的 lint 护栏，以及单测与 e2e 两条验证轨道。

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
| [brainstorming](./skills/brainstorming/) | 要加功能、改行为、设计 UI——在任何实现动作之前，需求已清楚但没写下来时同样适用 |
| [writing-plans](./skills/writing-plans/) | spec 获批之后，改动拆下来超过约三步，或要跨会话 |
| [using-git-worktrees](./skills/using-git-worktrees/) | 用户确认 spec 草稿没有问题、要把它和实现放进独立分支时，以及分支收尾交付时 |
| [executing-plans](./skills/executing-plans/) | 已有定稿的 `.dev-kit/plans/*.yaml` 要推进或收尾 |
| [test-driven-development](./skills/test-driven-development/) | 实现新行为、修可复现的 bug、改公开契约——在写生产代码之前 |
| [systematic-debugging](./skills/systematic-debugging/) | bug、测试失败、构建报错、性能回退、偶发故障、行为与 spec 不符——在提出修复方案之前 |

## 链路

1. `brainstorming`——探索需求并把设计谈定，确定贯穿全轮的 slug
2. `brainstorming`——把设计写成当前 checkout 中未提交的 `docs/specs/<slug>.md`，按用户意见持续修改，直到用户明确说没有问题
3. `using-git-worktrees`——这时才把这一轮关进独立工作区和分支；用 `mv` 将最终草稿移入并提交，随后安装依赖、跑 baseline
4. `writing-plans`——转成 `.dev-kit/plans/<同一个 slug>.yaml`（gitignored）：只写怎么做，任务切成垂直切片，`deps` 排序、`files` 只作为并发判断的第一层输入；在同一条消息里让用户确认任务拆分与 subagent/inline mode
5. `executing-plans`——读取 ready plan 里已经选定的 mode，然后不停：每批 ready 的任务默认串行；只有 plan 事实或只读 subagent 报告充分证明写集、语义依赖、共享资源和独立验证都隔离，才记录 `parallel_evidence` 并并行。每个任务强制一轮 TDD（遇故障转 `systematic-debugging`）
   - **证据站得住不等于 done**（派发模式）：那个 commit（`git show <sha>`，不是工作区）交给另一个没写它的 subagent，审任务目标、项目规范、代码本身三条轴，**审完自己修**——每条 finding 一轮 TDD 落在自己的 commit 里，并配上覆盖它的测试报回来
   - 两种它不修、直接交回：修法属于设计决策的，以及说 plan 本身错了的。**一审一修**：还剩 blocking 的任务转 `blocked`，其余记进 `note` 带到收尾
6. 静态收尾——两个 subagent 同时跑，一个只拿 spec + diff 验实现范围，一个只看代码；第一次修复后再做第二次静态审查，仍有 blocking 才做最后一次修复，**静态审查最多两轮**。跨任务的重复实现、两端对不齐的接口，只拿着一个 commit 的审查者看不见
7. Runtime 验证——静态审查通过后派一个全新的第三 subagent，启动真实目标并按需驱动 UI / e2e，把逐项 verdict、证据和**用户自己怎么复现**写进 gitignored `e2e/scratch/<spec-slug>/report.md`；它只报告不修复，也不判整轮 done
8. 编排验收——主会话只依据 subagent 的结构化 findings、验证报告和运行证据做决定，不再打开源码、commit 或 diff 做第三次代码审查；逐项讲清所有 `does not hold` / `not observed`，只有它写 `status: done`
9. 交付——回到 `using-git-worktrees`，先讲清收尾留下了什么，再给 merge / PR / 先放着的菜单

**一个 slug 贯穿全链路**：spec 文件名、plan 文件名、分支、工作区目录、产物目录都是它。

闸门和分支点写在各个 skill 自己的 SKILL.md 里：每一环结尾都会点名下一环和选中它的条件，路线一次读一步。[skills/using-dev-kit/SKILL.md](./skills/using-dev-kit/SKILL.md) 只管接不上任何单个 skill 的那部分——怎么找到 skill，以及一个请求该从哪扇门进来、什么时候一扇都不用进。`init` 不是链路的一环，单独触发。

## 可选 CLI

`devkit serve [--port <n>]`——对 `docs/specs/` 和 `.dev-kit/artifacts/` 起一个只读静态服务器，让跑不起 dev server 的 mockup 也能在浏览器里打开。装成 plugin 后会话内直接可用，否则按路径 `node <plugin 根目录>/bin/devkit serve`。

## SessionStart hook

插件通过 `hooks/hooks.json` 注册，在会话 startup / clear / compact 时把 `using-dev-kit` 引导注入上下文，省掉每次手动唤起。

## 跑测试

```bash
node --test dev-kit/tests/*.test.js
```

**必须带上 `*.test.js`**，写成 `node --test dev-kit/tests/` 会以 `MODULE_NOT_FOUND` 失败。
