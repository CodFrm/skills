: << 'CMDBLOCK'
@echo off
REM Cross-platform polyglot dispatcher (modelled on obra/superpowers, MIT).
REM Windows: cmd.exe takes the batch branch, locates bash and calls it.
REM Unix: the shell runs the whole file as a script (: is a no-op in bash).
REM
REM Hook scripts use extensionless file names (e.g. "session-start" rather than
REM "session-start.sh") to avoid Claude Code on Windows auto-prefixing bash onto commands
REM containing .sh, which would interfere.
REM
REM This file is stored with LF endings on purpose (see the repository .gitattributes): the
REM bash half below does not survive CRLF. cmd.exe reads LF-only batch files fine as long as
REM there are no labels — so **do not add a label or a `goto` here**.
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

REM 3. Last resort: bash on PATH — **skipping System32's bash.exe**, which is the WSL launcher.
REM    WSL bash cannot open a Windows path like C:\Users\...\hooks\session-start, so handing
REM    the hook to it does not degrade, it fails. `where bash` finds it first on any machine
REM    that has WSL enabled and Git installed outside the two locations above, which is
REM    exactly the case this branch exists to serve.
if not defined BASH_EXE for /f "delims=" %%B in ('where bash 2^>nul') do if not defined BASH_EXE if /i not "%%~dpB"=="%SystemRoot%\System32\" if /i not "%%~dpB"=="%SystemRoot%\SysWOW64\" set "BASH_EXE=%%B"

REM If bash cannot be found, exit silently: the plugin still works, just without the hooks.
REM This has to come first and be its own statement — `where bash` failing above leaves a
REM non-zero ERRORLEVEL behind, and falling through to a bare `exit /b` would report that as
REM the hook's own failure.
if not defined BASH_EXE exit /b 0

REM Deliberately not inside a parenthesised block, and deliberately a bare `exit /b`:
REM `%ERRORLEVEL%` inside a block is expanded when cmd parses the block, i.e. *before* bash
REM runs, so `exit /b %ERRORLEVEL%` there hands back a stale code and the hook's real result
REM never gets out. A bare `exit /b` preserves whatever bash just returned.
REM (%2..%9 rather than %* because %~1 has to be dropped; hooks.json passes no further
REM arguments, and anything that needs quoting-safe passthrough should go via the bash half.)
"%BASH_EXE%" "%HOOK_DIR%%~1" %2 %3 %4 %5 %6 %7 %8 %9
exit /b
CMDBLOCK

# Unix: run the named script directly. The empty-argument check has to stay aligned with the
# batch branch above — without it, `run-hook.cmd` would exec the directory itself and report
# an inscrutable "is a directory".
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPT_NAME="${1:-}"
if [ -z "$SCRIPT_NAME" ]; then
    echo "run-hook.cmd: missing script name" >&2
    exit 1
fi
shift
exec bash "${SCRIPT_DIR}/${SCRIPT_NAME}" "$@"
