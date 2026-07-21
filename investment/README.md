# 投资分析 Skills

这组 Skills 用于公开市场数据查询、证券分析和持仓决策辅助，不连接券商、不自动下单，也不承诺收益。

## 包含内容

- [全球股票投资分析助手](./global-stock-investment-analyst/)：分析A股、港股、美股、ETF和REITs，综合行情、财报、估值、新闻、宏观、汇率和组合风险给出条件化建议。
- [A股银行股分析与做T助手](./a-share-bank-stock-analyst/)：获取银行股行情、前复权日K、公告和估值，结合真实交易费用生成有条件的做T方案。

全球股票 Skill 负责通用、跨市场和组合分析；银行股 Skill 保留为净息差、不良率、拨备、资本充足率和A股做T费用等专项工作流。

## 安装

```text
帮我安装这个 Skill：https://github.com/CodFrm/skills/tree/main/investment/global-stock-investment-analyst
```

```text
帮我安装这个 Skill：https://github.com/CodFrm/skills/tree/main/investment/a-share-bank-stock-analyst
```

## 边界

仓库只保存通用分析流程和公开行情获取脚本，不包含私人持仓、成本、交易流水、飞书入口、券商账户或登录凭据。运行时建议必须注明数据时间、来源、币种、复权口径、费用、交易规则和失效条件。
