#!/usr/bin/env bash
# npm run demo   (or: npm run demo -- --vega)
# Starts the whole demo in order: tunnel, model warm-up, pad build, server, checks. With --vega it
# also rebuilds the TV app for the new tunnel URL and installs it on the Vega Virtual Device.
# Ctrl+C stops everything it started. Logs: /tmp/pip-tunnel.log and /tmp/pip-server.log.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)
WITH_VEGA=false
[[ "${1:-}" == "--vega" ]] && WITH_VEGA=true

step() { printf '\n\033[1;34m%s\033[0m %s\n' "==>" "$1"; }
ok() { printf '    \033[32mok\033[0m %s\n' "$1"; }
fail() { printf '    \033[31mfailed\033[0m %s\n' "$1"; exit 1; }

PIDS=()
cleanup() {
  printf '\nStopping the tunnel and the server...\n'
  for pid in "${PIDS[@]:-}"; do kill "$pid" 2>/dev/null || true; done
  pkill -f cloudflared 2>/dev/null || true
}
trap cleanup EXIT

step "1/6 Stopping anything left over from earlier"
pkill -f cloudflared 2>/dev/null || true
lsof -ti :8787 | xargs kill 2>/dev/null || true
ok "port 8787 is free"

step "2/6 Opening the HTTPS tunnel (the QR code points here)"
node scripts/tunnel.mjs > /tmp/pip-tunnel.log 2>&1 &
PIDS+=($!)
for _ in $(seq 1 60); do
  grep -q "Tunnel ready" /tmp/pip-tunnel.log 2>/dev/null && break
  sleep 1
done
URL=$(grep -o "Tunnel ready: https://[^ ]*" /tmp/pip-tunnel.log | head -1 | cut -d' ' -f3)
[[ -n "$URL" ]] || fail "no tunnel after 60 s (see /tmp/pip-tunnel.log)"
ok "$URL (written into server/.env and tv/src/config.ts)"

step "3/6 Warming up the local model, so the first answer isn't slow"
if command -v ollama > /dev/null; then
  ollama run qwen2.5:3b "hi" > /dev/null 2>&1 && ok "qwen2.5:3b answered" || fail "Ollama didn't answer (is the Ollama app running?)"
else
  fail "Ollama is not installed (https://ollama.com)"
fi

step "4/6 Building the pad, the browser TV and the Command Center"
(cd pad && npm run build > /tmp/pip-build.log 2>&1) && ok "pad/dist is ready" || fail "pad build (see /tmp/pip-build.log)"

if $WITH_VEGA; then
  step "4b Rebuilding the Vega app for this tunnel and installing it on the VVD"
  vega virtual-device start > /dev/null 2>&1 || true
  (cd tv && npm run build:release > /tmp/pip-vega.log 2>&1) || fail "Vega build (see /tmp/pip-vega.log)"
  vega run-app tv/build/aarch64-release/piptv_aarch64.vpkg com.parthrait.piptv.main -d VirtualDevice \
    >> /tmp/pip-vega.log 2>&1 || fail "installing on the VVD (see /tmp/pip-vega.log)"
  ok "Pip is open on the Vega Virtual Device"
fi

step "5/6 Starting the Pip server"
(cd server && npm start > /tmp/pip-server.log 2>&1) &
PIDS+=($!)
for _ in $(seq 1 30); do
  curl -s localhost:8787/health > /dev/null 2>&1 && break
  sleep 1
done
curl -s localhost:8787/health > /dev/null || fail "the server didn't start (see /tmp/pip-server.log)"
ok "listening on 8787"

step "6/6 Checking everything (preflight)"
npm run -s preflight || printf '    \033[33mA check failed above.\033[0m Without --vega, "The TV app uses this tunnel URL" fails until you rebuild the Vega app.\n'

cat <<EOF

  Pip is running. Leave this window open; Ctrl+C stops it all.

  TV (browser)      http://localhost:8787/tv        press F for full screen
  Command Center    http://localhost:8787/hub       this Mac only
  Pads              scan the QR code on the TV      or open $URL/?code=XXXX
  Vega app          npm run demo -- --vega          rebuilds it for this tunnel

  Demo beats (Tears of Steel):
    3:40  Leo asks "Who is the old man?"            Pip doesn't name Thom yet
    4:10  Maya pauses, asks "What if Thom had never left Celia?"
          then Continue this story, Where did it split?, Back to the film
    Lock a phone for a minute, unlock it: "While you were away"

  Logs: /tmp/pip-server.log  /tmp/pip-tunnel.log
EOF
wait
