#!/usr/bin/env python3
"""Fetch a public A-share quote and adjusted daily K-lines from Tencent.

Usage: python3 tencent_kline_snapshot.py 601939 601398
Output: one JSON object per stock. Public market data can be delayed; verify
source availability and timestamp before using it for analysis.
"""
import json
import sys
import urllib.request


def get_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Referer": "https://gu.qq.com/"})
    with urllib.request.urlopen(req, timeout=20) as response:
        return json.load(response)


def get_text(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Referer": "https://gu.qq.com/"})
    with urllib.request.urlopen(req, timeout=20) as response:
        return response.read().decode("gbk")


def parse_quote(code):
    body = get_text("https://qt.gtimg.cn/q=sh" + code).split('="', 1)[1].rsplit('"', 1)[0].split("~")
    return {
        "name": body[1], "code": body[2], "price": float(body[3]),
        "previous_close": float(body[4]), "open": float(body[5]),
        "volume_hands": int(body[6]), "timestamp": body[30],
        "change": float(body[31]), "change_percent": float(body[32]),
        "high": float(body[33]), "low": float(body[34]),
        "amount_10k_cny": float(body[37]), "turnover_percent": float(body[38]),
        "pe_ttm": float(body[39]) if body[39] else None,
        "amplitude_percent": float(body[43]), "market_cap_100m_cny": float(body[45]),
        "pb": float(body[46]), "volume_ratio": float(body[49]),
    }


def main(codes):
    for code in codes:
        quote = parse_quote(code)
        url = f"https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh{code},day,,,260,qfq"
        stock = get_json(url)["data"]["sh" + code]
        rows = stock.get("qfqday") or stock.get("day") or []
        quote["adjustment"] = "qfq"
        quote["daily_klines"] = rows
        print(json.dumps(quote, ensure_ascii=False))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("usage: tencent_kline_snapshot.py CODE [CODE ...]")
    main(sys.argv[1:])
