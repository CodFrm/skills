#!/usr/bin/env python3
"""Watch or summarize Pi JSONL without exposing prompts, reasoning, tool args/results."""

from __future__ import annotations

import argparse
import collections
import datetime as dt
import json
import sys
from pathlib import Path
from typing import Any, Iterable


def stamp() -> str:
    return dt.datetime.now().astimezone().strftime("%H:%M:%S")


def text_blocks(message: dict[str, Any]) -> str:
    parts: list[str] = []
    for block in message.get("content") or []:
        if isinstance(block, dict) and block.get("type") == "text":
            value = block.get("text")
            if isinstance(value, str):
                parts.append(value)
    return "\n".join(parts).strip()


def compact(value: str, limit: int = 800) -> str:
    value = " ".join(value.split())
    return value if len(value) <= limit else value[: limit - 1] + "…"


def safe_event_line(event: dict[str, Any]) -> str | None:
    kind = str(event.get("type") or "")
    if kind == "session":
        return f"session id={event.get('id', '?')} cwd={event.get('cwd', '?')}"
    if kind in {"agent_start", "agent_settled"}:
        return kind
    if kind == "agent_end":
        return f"agent_end retry={bool(event.get('willRetry'))}"
    if kind == "tool_execution_start":
        return f"tool_start {event.get('toolName', '?')}"
    if kind == "tool_execution_end":
        status = "error" if event.get("isError") else "ok"
        return f"tool_end {event.get('toolName', '?')} {status}"
    if "compaction" in kind or "retry" in kind or kind.endswith("error"):
        return kind
    if kind == "message_end":
        message = event.get("message") or {}
        if message.get("role") == "assistant" and message.get("stopReason") not in {"toolUse", None}:
            text = text_blocks(message)
            if text:
                return f"assistant_final {compact(text)}"
    return None


def watch(events_path: Path) -> int:
    events_path.parent.mkdir(parents=True, exist_ok=True)
    with events_path.open("w", encoding="utf-8") as out:
        for raw in sys.stdin:
            out.write(raw)
            out.flush()
            try:
                event = json.loads(raw)
            except json.JSONDecodeError:
                print(f"[{stamp()}] invalid_json_event", flush=True)
                continue
            if not isinstance(event, dict):
                continue
            line = safe_event_line(event)
            if line:
                print(f"[{stamp()}] {line}", flush=True)
    return 0


def read_events(path: Path) -> Iterable[dict[str, Any]]:
    with path.open(encoding="utf-8") as stream:
        for number, raw in enumerate(stream, 1):
            try:
                event = json.loads(raw)
            except json.JSONDecodeError:
                yield {"type": "invalid_json", "line": number}
                continue
            if isinstance(event, dict):
                yield event


def summary(path: Path) -> int:
    session_id = "?"
    cwd = "?"
    settled = False
    ended = False
    will_retry = False
    invalid = 0
    tools: collections.Counter[str] = collections.Counter()
    tool_errors: collections.Counter[str] = collections.Counter()
    notable: collections.Counter[str] = collections.Counter()
    last_tool = "none"
    final_text = ""
    input_tokens = output_tokens = reasoning_tokens = 0

    for event in read_events(path):
        kind = str(event.get("type") or "")
        if kind == "invalid_json":
            invalid += 1
        elif kind == "session":
            session_id = str(event.get("id") or "?")
            cwd = str(event.get("cwd") or "?")
        elif kind == "agent_settled":
            settled = True
        elif kind == "agent_end":
            ended = True
            will_retry = bool(event.get("willRetry"))
        elif kind == "tool_execution_end":
            tool = str(event.get("toolName") or "?")
            tools[tool] += 1
            last_tool = tool
            if event.get("isError"):
                tool_errors[tool] += 1
        elif "compaction" in kind or "retry" in kind or kind.endswith("error"):
            notable[kind] += 1
        elif kind == "message_end":
            message = event.get("message") or {}
            if message.get("role") == "assistant":
                usage = message.get("usage") or {}
                input_tokens += int(usage.get("input") or 0)
                output_tokens += int(usage.get("output") or 0)
                reasoning_tokens += int(usage.get("reasoning") or 0)
                if message.get("stopReason") not in {"toolUse", None}:
                    text = text_blocks(message)
                    if text:
                        final_text = text

    state = "settled" if settled else "ended" if ended and not will_retry else "retrying" if will_retry else "incomplete"
    tool_text = ", ".join(f"{name}:{count}" for name, count in sorted(tools.items())) or "none"
    error_text = ", ".join(f"{name}:{count}" for name, count in sorted(tool_errors.items())) or "none"
    notable_text = ", ".join(f"{name}:{count}" for name, count in sorted(notable.items())) or "none"

    print(f"state: {state}")
    print(f"session: {session_id}")
    print(f"cwd: {cwd}")
    print(f"tools: {tool_text}")
    print(f"tool_errors: {error_text}")
    print(f"last_tool: {last_tool}")
    print(f"notable_events: {notable_text}")
    print(f"invalid_json_lines: {invalid}")
    print(f"usage: input={input_tokens} output={output_tokens} reasoning={reasoning_tokens}")
    print(f"final: {compact(final_text, 1600) if final_text else 'none'}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    watch_parser = sub.add_parser("watch")
    watch_parser.add_argument("events", type=Path)
    summary_parser = sub.add_parser("summary")
    summary_parser.add_argument("events", type=Path)
    args = parser.parse_args()
    if args.command == "watch":
        return watch(args.events)
    return summary(args.events)


if __name__ == "__main__":
    raise SystemExit(main())
