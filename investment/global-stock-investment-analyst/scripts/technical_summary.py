#!/usr/bin/env python3
"""Calculate a compact technical summary from global_market_snapshot JSONL."""
import json
import math
import statistics
import sys


def ema(values, period):
    alpha = 2 / (period + 1)
    out = []
    current = None
    for value in values:
        current = value if current is None else alpha * value + (1 - alpha) * current
        out.append(current)
    return out


def rsi(values, period=14):
    if len(values) <= period:
        return None
    changes = [b - a for a, b in zip(values, values[1:])]
    gains = [max(x, 0) for x in changes]
    losses = [max(-x, 0) for x in changes]
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    for gain, loss in zip(gains[period:], losses[period:]):
        avg_gain = (avg_gain * (period - 1) + gain) / period
        avg_loss = (avg_loss * (period - 1) + loss) / period
    return 100 if avg_loss == 0 else 100 - 100 / (1 + avg_gain / avg_loss)


def maximum_drawdown(values):
    peak = values[0]
    worst = 0
    for value in values:
        peak = max(peak, value)
        worst = min(worst, value / peak - 1)
    return worst * 100


def summarize(data):
    rows = data.get("daily") or []
    closes = [row.get("adjusted_close") or row["close"] for row in rows]
    volumes = [row.get("volume") or 0 for row in rows]
    if len(closes) < 20:
        return {"symbol": data.get("symbol"), "error": "insufficient daily data"}
    e12, e26 = ema(closes, 12), ema(closes, 26)
    dif = [a - b for a, b in zip(e12, e26)]
    dea = ema(dif, 9)
    returns = {
        f"{n}d_percent": round((closes[-1] / closes[-1-n] - 1) * 100, 2)
        for n in (5, 20, 60, 120, 250)
        if len(closes) > n
    }
    mas = {f"ma{n}": round(sum(closes[-n:]) / n, 4) for n in (5, 10, 20, 60, 120, 250) if len(closes) >= n}
    daily_returns = [b / a - 1 for a, b in zip(closes, closes[1:]) if a]
    volatility = statistics.pstdev(daily_returns[-60:]) * math.sqrt(252) * 100 if len(daily_returns) >= 20 else None
    current_rsi = rsi(closes)
    last_date = rows[-1].get("date_utc") or rows[-1].get("date")
    return {
        "symbol": data.get("symbol"),
        "currency": data.get("currency"),
        "last_date": last_date,
        "last_adjusted_close": closes[-1],
        "moving_averages": mas,
        "returns": returns,
        "rsi14": round(current_rsi, 2) if current_rsi is not None else None,
        "macd": {"dif": round(dif[-1], 4), "dea": round(dea[-1], 4), "histogram": round(2 * (dif[-1] - dea[-1]), 4)},
        "annualized_volatility_60d_percent": round(volatility, 2) if volatility is not None else None,
        "maximum_drawdown_available_percent": round(maximum_drawdown(closes), 2),
        "volume_vs_20d": round(volumes[-1] / (sum(volumes[-20:]) / 20), 2) if sum(volumes[-20:]) else None,
    }


for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    data = json.loads(line)
    print(json.dumps(summarize(data) if "error" not in data else data, ensure_ascii=False))
