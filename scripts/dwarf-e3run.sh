#!/usr/bin/env bash
# Dwarf tournament run (team lead, F3-1): frozen build -> every variant in every shot -> contact sheets ->
# metric table. A frozen build avoids hot reloads of other agents on the dev server.
# Usage: bash scripts/dwarf-e3run.sh <outDir> [variantsCsv|all] [extraQuery, e.g. "scale=1.2&pxGrod=95"]
# Env: DWARF_TMP (frozen build + server log, default /tmp/underhearth-dwarf), DWARF_PORT (default 5179).
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:?usage: dwarf-e3run.sh <outDir> [variants] [extraQuery]}"
VARS="${2:-all}"
EXTRA="${3:-}"
TMP="${DWARF_TMP:-/tmp/underhearth-dwarf}"
PORT="${DWARF_PORT:-5179}"
mkdir -p "$TMP"
cd "$REPO"
git rev-parse --short HEAD > "$TMP/commit.txt"
pkill -f "http.server $PORT" || true
npx vite build --outDir "$TMP/frozen" --emptyOutDir > "$TMP/build.log" 2>&1
nohup python3 -m http.server "$PORT" --directory "$TMP/frozen" > "$TMP/http.log" 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
sleep 2
rm -rf "$OUT"
node scripts/dwarf-tournament.mjs "http://127.0.0.1:$PORT" "$OUT" "$VARS" 960 540 "$EXTRA" | tee "$OUT.log" || true
cp "$TMP/commit.txt" "$OUT/commit.txt"
python3 scripts/contact-sheet.py "$OUT" "$OUT/names.json"
python3 scripts/dwarf-evaltable.py "$OUT" --json "$OUT/eval.json" > "$OUT/table.md"
echo "done: $OUT (commit $(cat "$OUT/commit.txt"))"
