# Pip TV app (Vega)

The Fire TV side of Pip, a React Native for Vega app. It talks to the server in `../server` through the Cloudflare tunnel.

## Versions that worked

Vega SDK 0.24.12112, Vega CLI 1.4.4, Node 22, React Native 0.83 (`@amazon-devices/react-native-kepler` 4.0), `@amazon-devices/react-native-w3cmedia` 2.3.2, `socket.io-client` 4.7.5.

## Commands that worked (Step 3, Mac, Oct 16 2026)

```bash
export PATH="/opt/homebrew/opt/node@22/bin:$HOME/vega/bin:$PATH"   # in ~/.zshrc; there is no ~/vega/env in CLI 1.4.4

vega virtual-device start            # once per boot; `vega virtual-device status` prints {"running":true}

# repo root: the tunnel first (it rewrites src/config.ts and server/.env), then the server
npm run tunnel
(cd server && npm start)

# tv/: build and run. Rebuild after every tunnel restart, because the URL changes.
npm run build:release
vega run-app build/aarch64-release/piptv_aarch64.vpkg com.parthrait.piptv.main -d VirtualDevice

# device logs; the diagnostics screen mirrors each line as "[pip-diag] OK|FAIL|WAIT <check>"
vega device start-log-stream > device.log
```

Harmless noise: `vvman not found` warnings from the CLI, and `Watchman crawl failed ... Operation not permitted` from Metro, which then falls back to its node crawler.

## Step 3 result (gate 1)

On the Virtual Device, through the tunnel, every diagnostics line is green: `/health` ok, Socket.IO connected with a `sys:ping` round trip of 28 to 104 ms, `/api/films` returns Big Buck Bunny, and the film plays (596 s) with its position counting up.

The player uses URL mode: `VideoPlayer` from `@amazon-devices/react-native-w3cmedia`, with the surface attached before `src` is set (Amazon's URL-mode pattern), in `src/player/use-player.ts`.

Remote play and pause (Vega Media Controls, PROJECT.md section 6): works with no extra code. `KEY_PLAYPAUSE` paused the film at 50.0 s and a second press resumed it; the player's own `pause` and `play` events reported both.

```bash
vega exec vda devices                                                        # emulator-5554 for the VVD
vega exec vda -s emulator-5554 shell "inputd-cli button_press KEY_PLAYPAUSE"  # also KEY_ENTER, KEY_UP, KEY_BACK, ...
```

Alexa voice can only be checked on a real Fire TV device (PROJECT.md section 14.2, check 10).

## Step 6 result (gate 2)

Lobby (QR code, code, film cards, players), watch (film, credit line, pause bar, answer bubble, Pip) and placeholders for the quiz and results. Checked on the VVD through the tunnel on Oct 16 2026: phones join by QR and appear on the TV; the host's Pause and Play reach the TV and come back as playback in 177 to 239 ms; skips land in 1.1 to 1.6 s (the player re-buffers); the remote's OK starts the film from the lobby; a server restart mid-film shows "Reconnecting", the film keeps playing from its buffer, and the TV takes its code back in watch.

## Sizes on Vega

React Native 0.83 on Vega lays out on a 960 x 540 dp canvas (scale factor 2 on a 1080p screen). PROJECT.md gives TV sizes in pixels at 1080p, so `src/theme.ts` converts every size with `dp()`. Animations use only transform and opacity with the native driver: on RN 0.83, mixing native and JS drivers on one view aborts the app.

## Step 9 result (TV part)

The quiz screen (`QuizScreen`, `ChoiceGrid`, `CountdownBar`) and the results screen, checked on the VVD with three players on Oct 16 2026: names light up as players answer, the reveal comes as soon as everyone has answered, the right choice turns Pip's color with each player's avatar under their pick, Pip explains, and the results match the taps. The countdown bar empties with a native-driven `scaleX` and `transformOrigin: 'left'`, which Vega's RN 0.83 supports.

Remote focus: `hasTVPreferredFocus` on the first film card landed on the last card, so the lobby calls `FocusManager.focus(findNodeHandle(ref))` from `@amazon-devices/react-native-kepler` once the films have loaded.

## Known issue

Once, the TV's socket closed (`transport close`) just as the film started loading, and reconnected in about 1 s with the same code. Watch for it in rehearsals.
