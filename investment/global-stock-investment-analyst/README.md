# 全球股票投资分析助手

分析A股、港股、美股、中概股、ETF和REITs，综合行情、K线、财报、估值、公告新闻、宏观、行业周期、汇率、持仓和真实交易费用，输出长期与中短期分层建议。

## 安装

```text
帮我安装这个 Skill：https://github.com/CodFrm/skills/tree/main/investment/global-stock-investment-analyst
```

## 主要能力

- 区分盘中、盘前、盘后与正式收盘行情。
- 计算MA、阶段收益、RSI、MACD、波动率、最大回撤和相对成交量。
- 分析财务质量、现金流、估值、公司公告、SEC文件和未来催化剂。
- 按银行、保险、科技、半导体、消费、互联网、工业、资源、医药、REITs和ETF选择行业指标。
- 结合利率、汇率、商品、监管和地缘因素分析影响路径。
- 根据持仓成本、币种、费用和风险承受能力给出悲观、基准、乐观三种情景。
- 对A股、港股和美股分别核验交易规则与费用，不机械套用同一套做T模型。

## 行情脚本

`global_market_snapshot.py`：

- A股、港股使用腾讯公开行情与K线接口；
- 美股和美国ETF使用Nasdaq公开info与historical接口；
- 支持示例：`AAPL`、`QQQ`、`600519.SS`、`000001.SZ`、`0700.HK`。

```bash
python3 scripts/global_market_snapshot.py AAPL QQQ 600519.SS 0700.HK   | python3 scripts/technical_summary.py
```

公开接口可能延迟、限流或变更，运行时必须核验时间、时区、币种、交易状态及复权口径。

## 边界

不连接券商，不自动交易，不承诺收益，不保存私人持仓、成本、飞书入口、券商账户或登录凭据。

仅作持仓记录与信息分析，不构成投资建议。
