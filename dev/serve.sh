#!/usr/bin/env bash
# Local preview: PHP сървър на http://localhost:8000 (същото като на хостинга, без Apache).
# PHP пътят по подразбиране е от `winget install PHP.PHP.NTS.8.3`; задайте PHP_DIR за друг.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PHP_DIR="${PHP_DIR:-$LOCALAPPDATA/Microsoft/WinGet/Packages/PHP.PHP.NTS.8.3_Microsoft.Winget.Source_8wekyb3d8bbwe}"
cd "$ROOT/backend"
exec "$PHP_DIR/php.exe" -c "$ROOT/dev/php.ini" -d extension_dir="$PHP_DIR/ext" -S localhost:${PORT:-8000} index.php
