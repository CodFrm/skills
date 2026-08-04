# AGENTS.md

本仓库是 skill 合集。`SKILL.md` 的 frontmatter 只有 `name` 和 `description`；顶层目录要么本身是一个 skill，要么是一个合集。根 `README.md` 是总目录，新增 skill 它和合集 README 两处都要进。

## 改之前读哪份

| 要动 | 读 | 它管什么 |
|---|---|---|
| 任何 `SKILL.md`，以及它引用的文件 | 本文件的三关 | 每句话留不留 |
| `dev-kit` 的 hook、插件清单、CLI | [dev-kit/README.md](./dev-kit/README.md) | 两种装法为什么不能并存、改完什么时候生效、怎么跑测试 |
| `dev-kit/bin` 或 `dev-kit/lib` | [lib/project.js](./dev-kit/lib/project.js) 顶部注释 | 路径边界为什么只有一处、谁必须过它 |
| `hooks/run-hook.cmd`，或任何会碰到行尾的改动 | [.gitattributes](./.gitattributes) 里的注释 | LF 为什么是承重的、那份文件里为什么不能有 label 或 `goto` |

## 结构

```text
<skill>/SKILL.md                 skill 正文；同级可有 references/ templates/ scripts/ examples/
<合集>/                          若干 skill 目录，加一份 README 索引
dev-kit/                         唯一带可执行代码的合集；根 .claude-plugin/ 与 .agents/plugins/ 两份 marketplace 都指向它
├── skills/                      同上
├── .claude-plugin/plugin.json   Claude Code 插件清单
├── .codex-plugin/plugin.json    Codex 插件清单
├── package.json                 Pi package 清单与 skill 发现
├── .pi/extensions/dev-kit.ts    Pi 的会话引导
├── hooks/                       SessionStart 把 using-dev-kit 的正文注入会话
├── bin/devkit + lib/            可选 CLI，零依赖
└── tests/                       node --test，覆盖 hooks、Pi extension、lib 和上面这些清单
```

`version` 和作者身份在 marketplace、两份 `plugin.json` 与 Pi `package.json` 里各有一份；Claude marketplace/plugin 共用长 description，Codex/Pi 共用短 description。由 `dev-kit/tests/manifests.test.js` 断言相等。

## DevKit 提示词是控制面

DevKit 应写成流程控制和状态机，不写成教程或百科：

- `SKILL.md` 只保留触发条件、入口前置、关键闸门、状态转换、职责边界、停止/升级条件和交接格式。
- `reference` 负责具体方法、命令和可复用规则；template 只保留落地骨架和局部承重说明。
- 优先删除重复理由、类比、文学化强调、目录式导语、多个相似例子，以及和正文重复的 Red Flags/checklist。
- 一条约束只有在删掉后会导致流程错误、安全问题、不可恢复状态或证据失真时才作为硬规则保留；偏好不要写成硬约束。
- 精简不能以歧义换长度：动作、状态、责任人、输入、输出和停止条件必须仍可直接执行。

以下属于流程承重边界，不因精简删除：用户审批及破坏性/外部副作用授权、TDD 与 systematic debugging、plan 单写者、wrap-up 两轴独立静态审查、主会话亲自跑的 runtime verification、证据真实性，以及两条编排硬约束：

1. 派发默认串行；唯一例外是 wrap-up 的两轴静态评审——只读、不写工作树/index/HEAD、不共享可变资源，同时发出。
2. `subagent` 模式下主会话不审 source、commit 或 diff，只依据 implementer/reviewer 的结构化报告、自己的 runtime 观察和机械检查做决策；报告不足时重新派发，不自行补审。runtime verification 例外：它由主会话亲自跑，为驱动目标而读启动方式、接口和选择器不算审查。

写 `SKILL.md` 及其引用文件时，每句话过三关。

## 一、这句话有没有动作

**模型能读懂结构，不需要被告知结构**——不改变读者行为的句子删掉：

| 类型 | 例子 |
|---|---|
| 文档谈论自己 | "这里不重复"、"本文件整份注入 session"、"触发条件见 frontmatter" |
| 目录式导语 | "下面讲 A、B、C"——小节标题已经说了 |
| 为自身结构辩护 | "之所以这样分节，是因为……" |
| 会漂移的硬编码清单 | 把别处的目录再抄一份，或正文里写死"三类""五种"。漏改的那处正是被读到的那处 |
| 强调升级 | "这是本 skill 里最贵的错误，而且当时看不出来"、"比什么都不写更糟"。规则本身已经写了后果，加戏不改变任何判断 |

看着像但留下的：**两份文件之间的职责划分**（"方法在 `lint-harness.md`，本文件是可直接复制的代码"——它告诉读者该打开哪份），以及**规则带的 why**。

**why 的判据收紧到：读者靠常识推不出来才留。**

| | 例 |
|---|---|
| 留 | "`.gitignore` 里写 `.dev-kit/` 盖不住这个软链接"——尾斜杠只匹配目录 |
| 留 | "别用 `git add -A`"——前提是同一个 worktree 里可能有兄弟任务在写 |
| 删 | "状态判完立刻写进 plan，攒着会话一结束就全丢"——后半句推得出来 |

看动作，不看长度：三行的理由可以留，十个字的"此处从略"要删。

## 二、这个动作是不是已经被另一句覆盖

同一段里两句触发同一个行为，删掉被包含的那句。

`using-dev-kit` 的 description 原本是"会话开始时，以及写代码、执行命令、提问之前……"——三件事之前都要触发，会话开始没有第四种情况能漏，前半句被后半句包含。

`description` 的"动作"= 能否改变触发判断。

## 三、这个动作归不归这份文件管

覆盖它的那句可能在另一份文件里。**每条规则只在拥有它的那个 skill 里写一遍**——搬过来的那份不会跟着改，而它正是被读到的那份。

| 类型 | 例子 | 归谁 |
|---|---|---|
| 复述目标 skill 的内容 | "`brainstorming`，它会带你走完剩下的路" | 进哪扇门已经说完，后半句是 `brainstorming` 自己的开场白 |
| 搬别的 skill 的规矩 | 证据写到哪个路径、交付菜单、三轮上限 | `executing-plans`、`using-git-worktrees` |
| 同一条规则写两遍 | "spec 说做什么，plan 说怎么做" | `writing-plans` 开头逐字有 |

判据是**读者此刻要做的那个动作归不归这份文件管**：路由文件的动作是"进哪扇门"，所以指路可以、复述不行，门后的事进去再读。

**唯一的例外是为独立分发而做的整段复制**，比如 `init` 里那份三闸门表，它要能单独丢进别人的项目。这种复制**必须就地写明"这里是副本，改那边就要改这里"**，否则下一个人会当成违规清掉。没有这行标注的重复，一律按重复处理。

## 删完之后

**改过标题就要验锚点。** 三关删下来常连标题一起改，而 `](别的文件.md#锚点)` 断了不报错也不影响渲染，只是点过去落在文件开头：

```bash
anchors() { grep -oE '^#{1,6} .+' "$1" | sed -E 's/^#+ //; s/[`*]//g' \
  | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9 _-]//g; s/ /-/g'; }
for f in $(git ls-files '*.md'); do d=$(dirname "$f")
  sed '/^```/,/^```/d' "$f" | sed -E 's/`[^`]*`//g' | grep -oE '\]\([^)]*#[^)]+\)' \
    | sed -E 's/^\]\(//; s/\)$//' | while read -r l; do
      t="${l%%#*}"; [ -n "$t" ] && { [ -e "$d/$t" ] || continue; } || t=$(basename "$f")
      anchors "$d/$t" | grep -qx "${l#*#}" || echo "断链 $f -> $l"
    done
done

node --test dev-kit/tests/*.test.js
```

**度量单位是词，不是行。** 这套文风一段就是一行，压缩发生在行内，行数几乎不动。

**不进三关的**：命令、表格、checklist、`<占位符>`、派发给 subagent 的 prompt 里的每一条指令——这些是被执行的，不是被读的。
