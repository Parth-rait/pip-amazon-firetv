---
name: run-pip
description: Use to start or restart the whole Pip stack on the Mac (tunnel, server, pad, TV app on the Vega Virtual Device) and confirm it works end to end.
---

# Run Pip

Every shell needs `export PATH="/opt/homebrew/opt/node@22/bin:$HOME/vega/bin:$PATH"` (Node 22 and the Vega CLI).

1. Tunnel, repo root: `npm run tunnel`. Wait for "Tunnel ready". It rewrites `PUBLIC_URL` in server/.env and `SERVER_URL` in tv/src/config.ts. A new tunnel means a new URL, so steps 2 and 4 must follow every tunnel restart.
2. Server: `npm run build --prefix pad` (only if pad/ changed), then `cd server && npm start` (`npm run dev` restarts on file changes). Check `curl -s <PUBLIC_URL>/health` prints `"ok":true`.
3. Virtual Device: `vega virtual-device status`; if it is not running, `vega virtual-device start`.
4. TV app, in tv/: `npm run build:release`, then `vega run-app build/aarch64-release/piptv_aarch64.vpkg com.parthrait.piptv.main -d VirtualDevice`. Logs: `vega device start-log-stream > device.log`.
5. Check: the TV shows the QR code and a 4-letter code (the server logs `tv.hello` with it). Open the pad URL on a phone, or `http://localhost:8787/?code=<code>` on the Mac, and join with a name; the TV shows the name and Pip wakes. Pick the film, tap Pause.
6. Remote without clicking: `vega exec vda devices`, then `vega exec vda -s emulator-5554 shell "inputd-cli button_press KEY_ENTER"` (also KEY_PLAYPAUSE, KEY_UP, KEY_BACK).
7. Screenshots of the VVD: bring its window forward (`osascript -e 'tell application "System Events" to set frontmost of (first process whose name is "vega-virtual-device") to true'`), then `screencapture -x shot.png`. The terminal app needs the Screen Recording permission.
8. If something fails, follow PROJECT.md section 18.
