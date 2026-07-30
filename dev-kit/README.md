# dev-kit

规格驱动开发的技能集。一轮开发按这条链路走完：探索需求 →「spec 获批并提交」→ 写成执行计划 → 隔离工作区 → 逐任务推进（默认派发 subagent，依赖允许就并行，每个任务强制一轮 TDD，实现完这个 commit 再交给没写它的 subagent 审一遍、并由它把查出来的问题修掉；选 inline 则没有这道逐任务审查）→ 两个 subagent 对整条分支分别审 spec 与代码 → 出验证报告 → 交付。

**spec 决定做什么，plan 决定怎么做**，两者都不因为「代码写出来不一样」而被回头改。判「完成」只认命令、退出码和观察到的现象，任何东西都不在生产它的上下文里被判定完成。链路之外另有 `init`，负责把项目自身的约束立起来：AGENTS.md、分层文档、接进 CI 的 lint 护栏，以及单测与 e2e 两条验证轨道。

## 安装

> **dev-kit 目前还没有合并进默认分支 `main`。** `origin/main` 上既没有 `dev-kit/` 也没有 `.claude-plugin/marketplace.json`，所以下面凡是指向 `main` 的地方，合并之前都要换成带 dev-kit 的分支。

### 作为 Claude Code plugin

插件清单在仓库根目录的 `.claude-plugin/marketplace.json`，其中 `source` 为 `./dev-kit`。合并到 `main` 之后：

```text
/plugin marketplace add CodFrm/skills
/plugin install dev-kit@codfrm-skills
```

在此之前，先把仓库 clone 到本地、切到带 dev-kit 的分支，再按本地目录添加 marketplace：

```text
/plugin marketplace add /path/to/skills
/plugin install dev-kit@codfrm-skills
```

### 要改 dev-kit 本体：软链接

上面那种装法**拷贝**目录：`claude plugin install` 把 `dev-kit/` 复制进 `~/.claude/plugins/cache/`，并在 `installed_plugins.json` 里记下安装那一刻的 `gitCommitSha`。所以工作区里还没提交的改动它一律看不见，改完不 `claude plugin update` 就不同步——开发 dev-kit 自己的时候，这是个会让你怀疑改动没生效的坑。软链接过去，加载的就是工作区本身：

```bash
ln -s /path/to/skills/dev-kit ~/.claude/skills/dev-kit          # skill 正文 + SessionStart hook
ln -s /path/to/skills/dev-kit/bin/devkit ~/.local/bin/devkit     # 可选，会话之外也能用 CLI；换成你 PATH 上的目录
```

`~/.claude/skills/<name>/` 下的目录会在下个会话自动以 `<name>@skills-dir` 加载，八个 skill 和那个 hook 都算数——拿 `claude plugin details dev-kit@skills-dir` 看它的组件清单可以确认。

**两种装法不能并存，而且冲突时不报错。** 插件按名字抢先：`dev-kit@codfrm-skills` 一旦装上，软链接那份就在 `claude plugin list` 里变成 `✘ Not loaded`，症状只是「改动突然不生效了」。要软链接生效，先 `claude plugin uninstall dev-kit@codfrm-skills`。

软链接之后，改动的生效时机分三档：**skill 正文**下次被 invoke 就是新的；**hook 注入的 `using-dev-kit` 引导**是会话开始时的快照，要新会话或 `/clear`；**改 `hooks.json` 的注册本身**要重启 Claude Code。

### 只装某几个 Skill

不需要插件、只想要其中的 skill，用仓库根 README 的方式，把链接交给智能体（把 `main` 换成带 dev-kit 的分支名）：

```text
帮我安装这个 skill：https://github.com/CodFrm/skills/tree/main/dev-kit/skills/brainstorming
```

这样只拿到 skill 正文——`hooks/` 和 `bin/` 都留在仓库里，所以没有下面那个 [SessionStart hook](#sessionstart-hook) 的自动注入，也没有 [`devkit` 命令](#可选-cli)。

## 包含的 Skills

| Skill | 什么时候用 |
|---|---|
| [using-dev-kit](./skills/using-dev-kit/) | 每个开发会话的开头，以及写代码、跑命令、向用户提问之前——这套 kit 的引导页 |
| [init](./skills/init/) | 项目要立规矩：初始化 AGENTS.md / 开发规范 / 护栏；或老项目文档过期、没有护栏、同一类问题反复出现 |
| [brainstorming](./skills/brainstorming/) | 要加功能、改行为、设计 UI，需求还模糊；需求已经清楚但只是没写下来时同样适用——在任何实现动作之前 |
| [writing-plans](./skills/writing-plans/) | spec 获批之后，改动拆下来超过约三步，或要跨会话 |
| [using-git-worktrees](./skills/using-git-worktrees/) | 开始实现之前、以及分支收尾交付时；也用于可能整个丢弃的尝试，或当前工作区还压着别的未提交改动 |
| [executing-plans](./skills/executing-plans/) | 已有定稿的 `.dev-kit/plans/*.yaml` 要推进或收尾；会话开头发现有未完成的计划时同样 |
| [test-driven-development](./skills/test-driven-development/) | 实现新行为、修可复现的 bug、改公开契约——在写生产代码之前 |
| [systematic-debugging](./skills/systematic-debugging/) | 碰到 bug、测试失败、构建报错、性能回退、偶发故障，或行为与 spec 不符——在提出修复方案之前 |

## 链路

1. `brainstorming`——需求探索，写成 `docs/specs/<slug>.md`，过用户后提交
2. `writing-plans`——转成 `.dev-kit/plans/<同一个 slug>.yaml`（gitignored）：只写怎么做，任务切成垂直切片，`deps` 排序、`files` 决定谁能并行；过用户后定稿
3. `using-git-worktrees`——把这一轮关进独立的工作区和分支
4. `executing-plans`——**只问一个问题**（subagent 还是 inline，worktree 是直接决定并告知的），然后不停：每一批 ready 的任务派发出去，`files` 不重叠就并行，每个任务强制一轮 TDD（遇到故障转 `systematic-debugging`）
   - **证据站得住不等于 done**（派发模式）：那个 commit（`git show <sha>`，不是工作区——旁边可能还有任务在写）交给另一个没写它的 subagent，审三条轴：任务目标、项目自己的规范、代码本身。选 inline 就没有这一步，第一次外部阅读要等到收尾
   - **它审完自己修**：每条 findings 一轮 TDD，落在自己的 commit 里；findings 本身要跟着报回来（每条配上现在覆盖它的测试），只说「修好了」等于没东西可判。一个任务两个 subagent
   - 两种它不修、直接交回来：修法属于设计决策而不是纠错的，以及说 plan 本身错了的。**一审一修**：还剩 blocking 的任务转 `blocked`，其余记进 `note` 带到收尾
5. 收尾——两个 subagent 同时跑：一个对着 spec 验，一个只看代码。修完再跑一遍，**最多三轮**，还不行就停下来告诉用户。逐任务审过不代表这步能缩：跨任务的重复实现、两端对不齐的接口，只拿着一个 commit 的审查者看不见
6. 验证报告——有可驱动的界面且项目有 e2e 就跑一轮取截图/录屏，否则用命令和输出；报告里必须有**用户自己怎么复现**
7. 交付——回到 `using-git-worktrees`：先讲清楚收尾留下了什么，再给 merge / PR / 先放着的菜单

**一个 slug 贯穿全链路**：spec 文件名、plan 文件名、分支、工作区目录、产物目录，全都是它，不存在第二个名字要对齐。

带闸门、产物和分支点的完整那张图在 [skills/using-dev-kit/SKILL.md](./skills/using-dev-kit/SKILL.md)，这里不重复。`init` 不是链路的一环——它设置链路运行所在的那个项目，单独触发。

## 可选 CLI

零依赖、只读，一个子命令：

- `devkit serve [--port <n>]`——对 `docs/specs/` 和 `.dev-kit/artifacts/` 起一个只读静态服务器，让跑不起 dev server 的 mockup 也能在浏览器里打开。

装成 plugin 后，Claude Code 会把插件的 `bin/` 加进会话的 PATH，会话内直接 `devkit serve` 即可；会话外，或 `command -v devkit` 找不到时，按路径调用 `node <plugin 根目录>/bin/devkit serve`。它不是必需的——只服务于「mockup 在浏览器里打不开」这一个场景。

## SessionStart hook

插件通过 `hooks/hooks.json` 注册了一个 SessionStart hook，在会话 startup / clear / compact 时把 `using-dev-kit` 引导注入上下文，省掉每次手动唤起。

## 跑测试

从仓库根目录：

```bash
node --test dev-kit/tests/*.test.js
```

**必须带上 `*.test.js`。** 写成 `node --test dev-kit/tests/` 会以 `MODULE_NOT_FOUND`（`Cannot find module .../dev-kit/tests`）失败——这是所有人第一次都会踩的坑。
