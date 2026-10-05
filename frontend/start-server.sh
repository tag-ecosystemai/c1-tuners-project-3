#!/usr/bin/env bash
cd "$(dirname "$0")" || exit 1

echo "============================================"
echo "  Starting Kredt on http://localhost:3000"
echo "  Press Ctrl+C to stop it."
echo "============================================"
echo

open_browser() {
  ( sleep 1
    if command -v open >/dev/null 2>&1; then open "http://localhost:3000"
    elif command -v xdg-open >/dev/null 2>&1; then xdg-open "http://localhost:3000"
    fi
  ) &
}

# Python needs no internet access to serve local files, so it's tried
# first — Node's "npx serve" has to download the "serve" package on its
# first run, which fails on a machine without internet access even though
# Node itself is installed.
if command -v python3 >/dev/null 2>&1; then
  echo "Found python3. Starting server..."
  open_browser
  exec python3 -m http.server 3000 --bind 127.0.0.1
fi

if command -v python >/dev/null 2>&1; then
  echo "Found python. Starting server..."
  open_browser
  exec python -m http.server 3000 --bind 127.0.0.1
fi

if command -v npx >/dev/null 2>&1; then
  echo "Found Node.js. Starting server..."
  echo "Note: this needs an internet connection the first time it runs."
  open_browser
  exec npx --yes serve -l 3000 .
fi

echo
echo "============================================"
echo "  Could not start a local server."
echo
echo "  This machine doesn't appear to have a working"
echo "  Python or Node.js install. Install ONE of these,"
echo "  then re-run this script:"
echo
echo "    Python:  https://www.python.org/downloads/"
echo "    Node.js: https://nodejs.org/  (LTS version)"
echo "============================================"
exit 1
