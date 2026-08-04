# 执行模式并入 plan 的 ready 闸门

> Status: Draft
> Owner: dev-kit
> Last updated: 2026-07-31

**Objective:** 把「subagent 还是 inline」这一问并进 plan 转 `ready` 的那一次闸门，让用户一条消息里答完切分与执行模式。

**Hard invariant:** 不论模式由谁问、什么时候问，什么都不能免的那三样不变——TDD 全程、证据门槛（命令、退出码、观察），以及[两道静态审查](../../dev-kit/skills/executing-plans/SKILL.md#wrap-up-two-static-reviews)加其后[一次运行时验证](../../dev-kit/skills/executing-plans/SKILL.md#runtime-verification-the-main-session-drives-it)。

## Problem

1. **执行模式的提问和切分闸门是两次连续打断，且分在两份 skill 里。** `writing-plans/SKILL.md:118` 让用户否决切分并置 `status: ready`；`executing-plans/SKILL.md:29` 紧接着在第一个 task 之前再问一次模式。用户连着被打断两次，第二次发生在换了一份 SKILL.md 之后。**观察到的代价**：2026-07-31 这次会话里，用户以为这道闸门根本不存在，提了一遍需求要求加上——它存在，但不在用户预期它出现的那一刻。

2. **`mode` 的归属被写死成「下一份 skill 的事」。** `writing-plans/SKILL.md:40` 的模板注释是 `mode: null # subagent | inline — executing-plans writes this, not you`，所以 plan 转 `ready` 的那一刻 `mode` 必然是 null，两次提问的先后被这行注释固定住。（弱证据：文档陈述，不是观察到的故障。）

3. **`executing-plans` 的问法没有条件。** `:29` 是 "Ask once, before the first task"，没写「`mode` 已有就不问」。这份 skill 同时也是会话中途恢复未完成 plan 的入口（`:9`），按字面，一个 `mode` 已写好的 plan 被恢复时会再问一遍。（弱证据：文档陈述。）

## Actors and user stories

1. 作为**要求这轮工作开跑的用户**，我想在认可任务切分的同一条消息里定下执行模式，这样我只被打断一次，且这一问出现在我正在做决定的那一刻。
2. 作为**接手一份 `ready` plan 的 agent**，我想直接从 `mode` 读出该怎么跑，这样已经答过的问题不会被再问一遍。
3. 作为**捡起一份手写或旧格式 plan 的 agent**，我想在 `mode` 为空时就地把这一问补上，这样缺字段不会让这份 plan 卡死，也不会让用户在没选过的情况下被派出一批 subagent。

## Design decisions

| # | Decision | Why（以及被否掉的） |
|---|---|---|
| 1 | 模式那一问并进 `writing-plans` 的 ready 闸门，一条消息问两件事 | 用户选定。Rejected：闸门留在原处、只加红旗和 checklist 防跳过——打断次数不变，问题 1 的代价一分不减 |
| 2 | 选项文案、推荐及其理由、harness 认定那一步，整段**搬进** `writing-plans`，`executing-plans` 不留副本 | AGENTS.md 三关之三：每条规则只在拥有它的 skill 里写一遍。ready 闸门是 `writing-plans` 的动作，问法就该在它手里。Rejected：文案留在 `executing-plans`、`writing-plans` 链过去——读者要跳一次文件才能把问题问出口 |
| 3 | `mode` 为空的 plan 就地补问，不退回 `writing-plans` | 用户选定。Rejected：整份 plan 退回重走 ready 闸门——恢复半途 plan 时会把已认可的切分再问一遍；Rejected：为空即默认 `subagent`——用户在没选过的情况下被派出一批 subagent |
| 4 | 不为这次改动加断言正文的测试 | 见[测试决策](#testing-decisions)。Rejected：加一条 grep 正文关键词的断言——下次改措辞就红，且绿了也不证明 agent 会照做 |
| 5 | `executing-plans` 的 `## The one gate` 改标题，并同步仓库里指向它的锚点 | 闸门搬走后这个标题名不副实；`#the-one-gate` 有一处引用在 `using-git-worktrees/SKILL.md:46`，AGENTS.md 要求改过标题就验锚点 |

## 合并后的 ready 闸门

**前提**：spec 已批准并提交在本轮分支上，tasks 已切好，plan 的 `status` 仍是 `draft`，`mode` 为空。

`writing-plans` 发出**一条**消息，同时承载切分与执行模式两问。这条消息里必须能读到：plan 的 slug 与 task 数、哪些 task 能同时跑、已经存在的 workspace 路径与「spec 已提交在它的分支上」、逐条 task 的 goal 与 `deps`、以及切分是拿来否决的（用户裁的是活怎么切，不是它做什么）；再加执行模式的两个选项、推荐哪个、以及每个选项各拿掉什么——`subagent` 给每个 task 一份干净上下文并让互不相干的几个并行，`inline` 没有逐 task 审查，且收尾的两道静态审查与运行时验证都在本会话内跑，等于除了主会话没有第二个上下文读过这份代码。

用户答完，`writing-plans` 同时写入 `status: ready` 和 `mode`，然后才交给 `executing-plans`。**在此之前不得开始第一个 task。**

**harness 没有原生 dispatch 工具时**（按 [using-dev-kit 的 platform mapping](../../dev-kit/skills/using-dev-kit/SKILL.md#platform-tools) 认定，认定发生在发消息之前），消息里只出现 `inline` 一个选项，`mode` 直接写 `inline`，切分那一问照常。

**用户只否决了切分、没答模式**：改完切分后重发整条消息——新的切分会改变哪些 task 能并行，模式推荐所依据的事实跟着变。

## `mode` 的值与谁能写它

合法值只有 `subagent` 和 `inline`，`ready` 之前是 `null`。能把它从 `null` 写成实值的只有两件事：用户在闸门上的回答，或「此 harness 无原生 dispatch，故 `inline`」这一条推导。**`writing-plans` 不得自己挑一个值填进去**，模板注释相应从「executing-plans writes this, not you」改成「ready 闸门从用户的回答写入」。

`mode` 仍属于 plan 的状态字段，冻结表里的位置不变。

## `executing-plans` 到达时的两种状态

**`mode` 有值**——不再问任何关于执行模式的问题，置 `status: running` 直接进循环。工作区校验（plan 里记的 workspace 就是脚下这个 checkout、spec 在其分支上被跟踪、`.dev-kit` 解析得到、基线在建 workspace 时跑过）原样保留，它不是闸门的一部分。

**`mode` 为 `null`**——这份 plan 没过 ready 闸门（手写的、旧格式的、或上一会话在用户答之前就断了）。就地把模式那一问补上，用 ready 闸门那份文案，答完写 `mode` 再开跑。**切分不重问**：`status: ready` 意味着它已经被认可过。

## 单一副本与锚点

执行模式的选项文字、推荐及其理由、harness 认定那一步，全仓库只在 `writing-plans` 出现一次；`executing-plans` 的兜底以链接指过去。

`executing-plans` 那节标题改掉之后，仓库里指向旧锚点的引用同步改到新锚点，AGENTS.md 那段锚点脚本跑完没有 `断链` 输出。

## 兼容性、安全与可访问性

只改三份 `SKILL.md` 的散文，不动 hook、清单、CLI 或 plan 的字段集合——`mode` 字段本身及其取值不变，所以已存在的 `.dev-kit/plans/*.yaml` 照旧能被读。安全、隐私、可访问性无涉：改动不碰凭据、不碰用户数据、产物是纯文本。

## Out of scope

- **≤3 步的短路线**（`brainstorming` 直接进 `test-driven-development`、根本没有 plan）现在不问模式，本轮不补。
- **中途换模式**（`subagent` 跑一半改 `inline`）——没有现成需求。
- `systematic-debugging` 单独进入的路线。
- `mode` 在 `writing-plans` 冻结表里的归属，维持现状。

## Testing decisions

| Seam | What it verifies | Prior art |
|---|---|---|
| AGENTS.md「删完之后」的锚点脚本 | 改标题之后跨文件链接没断 | AGENTS.md 内该段 |
| `node --test dev-kit/tests/*.test.js` | 改动没碰坏 hook 注入的 `using-dev-kit` 全文、以及各份清单的一致性 | `dev-kit/tests/hooks.test.js:60` |
| 收尾的两道静态审查读 branch diff | 三关合规、文案确实只剩一份、上面每条行为要求逐条落地 | `executing-plans` 的 wrap-up |

**不自动化的部分，以及为什么。** `dev-kit/tests/` 的七个测试文件里没有任何一处断言 `writing-plans` 或 `executing-plans` 的正文；唯一锁正文的是 `hooks.test.js:60`，它锁的是 `using-dev-kit/SKILL.md` 整份文件被 hook 原样吐出来，管的是 hook 与文件不许漂开，不是文案本身。合并后那条消息的措辞、以及 `mode` 兜底的触发条件，都是 SKILL.md 散文——能判它的只有读它的人和审查。把断言写成 grep 关键词，改一次措辞红一次，而且绿了也不证明 agent 会照做。所以这两项**由审查验证**，写在这里而不是伪装成自动化。

## Open questions

无。
