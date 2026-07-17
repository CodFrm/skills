# building-harnesses

把「靠人记忆/文档/评审维持的团队约定」钉成机械化检查（harness），并可一键为新仓库搭起整套工程流程（原则层 + 文档层 + 验证层）的通用方法论技能。

## 解决什么问题

约定写进 AGENTS.md / CLAUDE.md、评审反复强调，但违规还是不断混进主干——因为文档不会执行。
本技能指导把约定固化为**会让现有合并闸门（lint / test / CI）变红**的机械检查，并给检查本身配守护测试，防止它悄悄失效（假护栏）。

## 核心内容

- **升级阶梯**：优先用现成规则 → 声明式禁令（`no-restricted-imports` 等）→ AST 选择器（`no-restricted-syntax`）→ 自定义 lint 规则 → 仓库扫描测试 → CI 脚本，够用就不下探。
- **五件套合同**：接入已有闸门、精确作用域 + 合法实现豁免、报错信息指明正解、加载真实配置的双向守护测试、文档回指 harness 且落地时全绿。
- **拦截入口而非形态**：禁 `import dayjs` 而不是匹配 `.format()` 调用，变体绕不过、也不误伤。
- **规则包化**：约定成规模后给诊断编稳定 ID + 规则手册、机械修复配自动 fix、规则忠实于运行时语义、编译型 linter 插件（golangci-lint module plugin）用「插件单测 + 真实二进制扫已知合规语料 + 源码变更重建」守护接线。
- **整套流程 bootstrap（三层）**：
  - *原则层*：AGENTS.md 瘦身为入口页（CLAUDE.md 仅导入），原则含「确认 bug 存在→失败测试→修复」、TDD/BDD 先行（行为化标题；测试挂了改代码不改测试、删无意义测试）、修根因禁 `as any`/吞异常、SOLID 走既有扩展点+构造注入窄接口、直接替换不加适配层、**复用先于新造**（第二次出现才提取共享实现、一个概念一个实现）、范围纪律、注释只写非显然的为什么、无死代码；每条标注「已由门禁强制/仅评审」并配一行 why。
  - *文档层*：入口 `docs/<topic>.md` + 重细节拆 `docs/references/`、`docs/README.md` 索引+归属表、事实单一归属交叉链接；最小文档集=入口页/how 文档（命令、风格、测试机制、提交与 PR 规范）/验证手册/维护指南/索引；「grep 不到就别写」、git-aware 校验防未提交内容冒充已发布、数字必须枚举、漂移以码为准清理过期内容、链接一键校验。
  - *验证层*：`docs/verification.md` 负责「怎么确认真的能用」——廉价信号先行、一次性 scratch 脚本驱动真实应用（≠扩充永久 E2E 套件）、证据本地留档不入库、复现=确认 bug 存在那一步随后必须升级为失败的提交测试。
  - *存量仓库 retrofit*：从盘点入手（重复评审意见/过期文档主张/历史事故）→ 每项成为原则或 harness 候选，从复发率最高的一条开始机械化。

工具无关：ESLint（JS/TS）、ruff/flake8（Python）、golangci-lint depguard/forbidigo（Go）、semgrep，仓库扫描测试适用于任意测试框架。

## 来源

模式提炼自 [scriptcat](https://github.com/scriptscat/scriptcat) 仓库的 `eslint-rules/` 机械护栏实践
（自定义规则 + `harness.test.mjs` 真实配置守护测试 + i18n-usage 仓库扫描测试），
以及一个 Go 框架仓库的 golangci-lint module plugin 结构检查器实践
（分层依赖规则、规则编号手册、`analysistest` fixture、Makefile 接线守护、自动修复）。

## 安装

```bash
ln -s "$(pwd)/building-harnesses" ~/.claude/skills/building-harnesses
ln -s "$(pwd)/building-harnesses" ~/.codex/skills/building-harnesses
```
