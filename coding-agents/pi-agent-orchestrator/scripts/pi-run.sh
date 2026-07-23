#!/usr/bin/env bash
set -uo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: pi-run.sh <research|write> <cwd> <session-name> <prompt-file> <run-dir>

Environment:
  PI_NO_CONTEXT_FILES=1  Do not load AGENTS.md or other context files.
EOF
  exit 64
}

[[ $# -eq 5 ]] || usage
MODE=$1
CWD=$2
SESSION_NAME=$3
PROMPT_FILE=$4
RUN_DIR=$5

case "$MODE" in
  research) TOOLS="read,grep,find,ls" ;;
  write) TOOLS="read,bash,edit,write,grep,find,ls" ;;
  *) usage ;;
esac

command -v pi >/dev/null 2>&1 || { echo "pi not found" >&2; exit 127; }
command -v python3 >/dev/null 2>&1 || { echo "python3 not found" >&2; exit 127; }
[[ -d "$CWD" ]] || { echo "cwd is not a directory: $CWD" >&2; exit 66; }
[[ -f "$PROMPT_FILE" ]] || { echo "prompt file not found: $PROMPT_FILE" >&2; exit 66; }
[[ -n "$SESSION_NAME" ]] || { echo "session name must not be empty" >&2; exit 64; }

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
mkdir -p -- "$RUN_DIR"
RUN_DIR=$(cd -- "$RUN_DIR" && pwd)
CWD=$(cd -- "$CWD" && pwd)
PROMPT_FILE=$(cd -- "$(dirname -- "$PROMPT_FILE")" && pwd)/$(basename -- "$PROMPT_FILE")
umask 077

EVENTS="$RUN_DIR/events.jsonl"
STDERR_LOG="$RUN_DIR/stderr.log"
EXIT_FILE="$RUN_DIR/exit-code"
META_FILE="$RUN_DIR/run.meta"

{
  printf 'mode=%s\n' "$MODE"
  printf 'cwd=%s\n' "$CWD"
  printf 'session_name=%s\n' "$SESSION_NAME"
  printf 'prompt_file=%s\n' "$PROMPT_FILE"
  printf 'started_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'pi_version=%s\n' "$(pi --version 2>/dev/null | head -n 1)"
} > "$META_FILE"

ARGS=(
  --mode json
  --name "$SESSION_NAME"
  --no-approve
  --no-extensions
  --no-skills
  --no-prompt-templates
  --tools "$TOOLS"
)
if [[ "${PI_NO_CONTEXT_FILES:-0}" == "1" ]]; then
  ARGS+=(--no-context-files)
fi

PROMPT=$(cat -- "$PROMPT_FILE")
cd -- "$CWD"

echo "Pi task started: mode=$MODE name=$SESSION_NAME cwd=$CWD"
set +e
PI_TELEMETRY=0 PI_SKIP_VERSION_CHECK=1 \
  pi "${ARGS[@]}" "$PROMPT" \
  2> >(tee "$STDERR_LOG" >&2) \
  | python3 "$SCRIPT_DIR/pi-events.py" watch "$EVENTS"
PIPE_RC=("${PIPESTATUS[@]}")
RC=${PIPE_RC[0]:-1}
set -e

printf '%s\n' "$RC" > "$EXIT_FILE"
printf 'finished_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$META_FILE"
printf 'exit_code=%s\n' "$RC" >> "$META_FILE"
echo "Pi task exited: code=$RC run_dir=$RUN_DIR"
exit "$RC"
