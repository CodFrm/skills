: << 'CMDBLOCK'
@echo off
REM Cross-platform polyglot dispatcher (modelled on obra/superpowers, MIT).
REM Windows: cmd.exe takes the batch branch, locates bash and calls it.
REM Unix: the shell runs the whole file as a script (: is a no-op in bash).
REM
REM Hook scripts are named without an extension ("session-start", not "session-start.sh") so
REM that Claude Code on Windows does not auto-prefix bash onto commands containing .sh.
REM
REM Stored with LF endings on purpose (see .gitattributes): the bash half below does not
REM survive CRLF. cmd.exe reads LF-only batch files fine as long as there are no labels —
REM so **do not add a label or a `goto` here**.
REM
REM Usage: run-hook.cmd <script-name> [args...]

if "%~1"=="" (
    echo run-hook.cmd: missing script name >&2
    exit /b 1
)

set "HOOK_DIR=%~dp0"
set "BASH_EXE="

REM 1. The two default Git for Windows locations.
if exist "C:\Program Files\Git\bin\bash.exe" set "BASH_EXE=C:\Program Files\Git\bin\bash.exe"
if not defined BASH_EXE if exist "C:\Program Files (x86)\Git\bin\bash.exe" set "BASH_EXE=C:\Program Files (x86)\Git\bin\bash.exe"

REM 2. Installed somewhere else (scoop / winget / portable): derive bash from git's own
REM    location rather than from PATH — <git root>\cmd\git.exe sits next to <git root>\bin\bash.exe.
if not defined BASH_EXE for /f "delims=" %%G in ('where git 2^>nul') do if not defined BASH_EXE if exist "%%~dpG..\bin\bash.exe" set "BASH_EXE=%%~dpG..\bin\bash.exe"

REM 3. Last resort: bash on PATH — **skipping System32's bash.exe**, the WSL launcher. WSL bash
REM    cannot open a Windows path like C:\Users\...\hooks\session-start, so handing it the hook
REM    fails outright, and `where bash` finds it first on exactly the machines this branch is for
REM    (WSL enabled, Git installed outside the two locations above).
if not defined BASH_EXE for /f "delims=" %%B in ('where bash 2^>nul') do if not defined BASH_EXE if /i not "%%~dpB"=="%SystemRoot%\System32\" if /i not "%%~dpB"=="%SystemRoot%\SysWOW64\" set "BASH_EXE=%%B"

REM No bash: exit silently — the plugin still works, just without the hooks. This has to be its
REM own statement, because `where bash` failing above leaves a non-zero ERRORLEVEL behind that a
REM bare `exit /b` would report as the hook's own failure.
if not defined BASH_EXE exit /b 0

REM Not inside a parenthesised block, and a bare `exit /b` on purpose: inside a block cmd expands
REM `%ERRORLEVEL%` when it parses the block — before bash runs — so `exit /b %ERRORLEVEL%` hands
REM back a stale code. A bare `exit /b` preserves whatever bash just returned.
REM (%2..%9 rather than %* because %~1 has to be dropped; hooks.json passes no further arguments.)
"%BASH_EXE%" "%HOOK_DIR%%~1" %2 %3 %4 %5 %6 %7 %8 %9
exit /b
CMDBLOCK

# Unix: run the named script directly. The empty-argument check mirrors the batch branch above —
# without it, `run-hook.cmd` execs its own directory and reports "is a directory".
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT_NAME="${1:-}"
if [ -z "$SCRIPT_NAME" ]; then
    echo "run-hook.cmd: missing script name" >&2
    exit 1
fi
shift
exec bash "${SCRIPT_DIR}/${SCRIPT_NAME}" "$@"
