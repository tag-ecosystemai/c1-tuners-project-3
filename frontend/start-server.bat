@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo   Starting Kredt on http://localhost:3000
echo   Press Ctrl+C in this window to stop it.
echo ============================================
echo.

REM --- Try the Python launcher first. Plain "python" on Windows can
REM     silently be a Microsoft Store stub that "where" finds even when
REM     Python isn't really installed, so "py -3" is checked first since
REM     it's a more reliable signal that a real Python is present. ---

py -3 --version >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Found Python via the "py" launcher. Starting server...
    start "" http://localhost:3000
    py -3 -m http.server 3000 --bind 127.0.0.1
    goto :eof
)

echo [1/3] "py -3" not available, trying "python"...
python --version >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Found Python. Starting server...
    start "" http://localhost:3000
    python -m http.server 3000 --bind 127.0.0.1
    goto :eof
)

echo [2/3] "python" not available, trying "python3"...
python3 --version >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Found Python3. Starting server...
    start "" http://localhost:3000
    python3 -m http.server 3000 --bind 127.0.0.1
    goto :eof
)

echo [3/3] Python not available, trying Node.js (npx serve)...
echo        Note: this needs an internet connection the first time it runs.
where npx >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Found Node.js. Starting server...
    start "" http://localhost:3000
    npx --yes serve -l 3000 .
    goto :eof
)

echo.
echo ============================================
echo   Could not start a local server.
echo.
echo   This machine doesn't appear to have a working
echo   Python or Node.js install that this script can
echo   find and use. Install ONE of these, then
echo   re-run this script:
echo.
echo     Python:  https://www.python.org/downloads/
echo              (when installing, tick "Add python.exe to PATH")
echo     Node.js: https://nodejs.org/  (LTS version)
echo ============================================
echo.
pause
