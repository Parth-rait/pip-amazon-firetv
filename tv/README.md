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
