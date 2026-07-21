#!/usr/bin/env python3
"""Fetch public daily OHLCV for A-shares, Hong Kong and US securities.

Examples:
  python3 global_market_snapshot.py AAPL QQQ 600519.SS 000001.SZ 0700.HK

Sources:
- A/H shares: Tencent public quote and K-line endpoints.
- US stocks/ETFs: Nasdaq public info and historical endpoints.

Public data can be delayed, rate-limited or changed. Always verify timestamp,
currency, adjustment policy and trading-session state before analysis.
"""
import datetime as dt
import json
import re
import sys
import urllib.parse
import urllib.request

HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36",
    "Accept": "application/json,text/plain,*/*",
}


def get_json(url, referer=None):
    headers = dict(HEADERS)
    if referer:
        headers["Referer"] = referer
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def get_text(url, referer=None):
    headers = dict(HEADERS)
    if referer:
        headers["Referer"] = referer
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("gbk", "replace")


def number(value):
    if value is None:
        return None
    cleaned = re.sub(r"[^0-9.\-]", "", str(value))
    return float(cleaned) if cleaned not in ("", "-", ".") else None


def tencent_symbol(symbol):
    upper = symbol.upper()
    if upper.endswith(".SS"):
        return "sh" + upper[:-3], "CNY", "Shanghai Stock Exchange", "Asia/Shanghai"
    if upper.endswith(".SZ"):
        return "sz" + upper[:-3], "CNY", "Shenzhen Stock Exchange", "Asia/Shanghai"
    if upper.endswith(".HK"):
        return "hk" + upper[:-3].zfill(5), "HKD", "Hong Kong Stock Exchange", "Asia/Hong_Kong"
    return None


def fetch_tencent(symbol):
    mapped, currency, exchange, timezone = tencent_symbol(symbol)
    kline_url = "https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?" + urllib.parse.urlencode({"param": f"{mapped},day,,,260,qfq"})
    payload = get_json(kline_url, "https://gu.qq.com/")
    stock = (payload.get("data") or {}).get(mapped) or {}
    source_rows = stock.get("qfqday") or stock.get("day") or []
    rows = []
    for row in source_rows:
        if len(row) < 6:
            continue
        rows.append({
            "date": row[0], "open": number(row[1]), "close": number(row[2]),
            "high": number(row[3]), "low": number(row[4]), "volume": number(row[5]),
            "adjusted_close": number(row[2]),
        })
    quote_text = get_text("https://qt.gtimg.cn/q=" + mapped, "https://gu.qq.com/")
    fields = quote_text.split('="', 1)[1].rsplit('"', 1)[0].split("~")
    return {
        "symbol": symbol.upper(), "name": fields[1], "source": "Tencent",
        "exchange": exchange, "currency": currency, "timezone": timezone,
        "market_time": fields[30] if len(fields) > 30 else None,
        "regular_market_price": number(fields[3]) if len(fields) > 3 else None,
        "previous_close": number(fields[4]) if len(fields) > 4 else None,
        "market_state": "regular_or_latest", "adjustment": "qfq",
        "daily": rows,
    }


def fetch_nasdaq(symbol):
    upper = symbol.upper()
    end = dt.date.today()
    start = end - dt.timedelta(days=420)
    common = {"fromdate": start.isoformat(), "todate": end.isoformat(), "limit": "5000"}
    selected_class = None
    rows_raw = []
    for asset_class in ("stocks", "etf"):
        query = dict(common, assetclass=asset_class)
        url = f"https://api.nasdaq.com/api/quote/{urllib.parse.quote(upper)}/historical?" + urllib.parse.urlencode(query)
        payload = get_json(url, f"https://www.nasdaq.com/market-activity/{asset_class}/{upper.lower()}/historical")
        rows_raw = ((((payload.get("data") or {}).get("tradesTable") or {}).get("rows")) or [])
        if rows_raw:
            selected_class = asset_class
            break
    if not rows_raw:
        raise RuntimeError("Nasdaq returned no historical rows")
    info_url = f"https://api.nasdaq.com/api/quote/{urllib.parse.quote(upper)}/info?" + urllib.parse.urlencode({"assetclass": selected_class})
    info = get_json(info_url, f"https://www.nasdaq.com/market-activity/{selected_class}/{upper.lower()}").get("data") or {}
    rows = []
    for row in reversed(rows_raw):
        date_value = dt.datetime.strptime(row["date"], "%m/%d/%Y").date().isoformat()
        close = number(row.get("close"))
        rows.append({
            "date": date_value, "open": number(row.get("open")), "close": close,
            "high": number(row.get("high")), "low": number(row.get("low")),
            "volume": number(row.get("volume")), "adjusted_close": None,
        })
    primary = info.get("primaryData") or {}
    return {
        "symbol": upper, "name": info.get("companyName"), "source": "Nasdaq",
        "exchange": info.get("exchange"), "currency": "USD", "timezone": "America/New_York",
        "market_time": primary.get("lastTradeTimestamp"),
        "regular_market_price": number(primary.get("lastSalePrice")),
        "previous_close": number((info.get("secondaryData") or {}).get("lastSalePrice")),
        "market_state": info.get("marketStatus"), "adjustment": "unadjusted",
        "asset_class": selected_class, "daily": rows,
    }


def fetch(symbol):
    return fetch_tencent(symbol) if tencent_symbol(symbol) else fetch_nasdaq(symbol)


def main(symbols):
    for symbol in symbols:
        try:
            print(json.dumps(fetch(symbol), ensure_ascii=False))
        except Exception as error:
            print(json.dumps({"symbol": symbol, "error": str(error)}, ensure_ascii=False))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("usage: global_market_snapshot.py TICKER [TICKER ...]")
    main(sys.argv[1:])
