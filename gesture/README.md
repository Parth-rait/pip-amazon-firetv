# Pip gestures

Hand-gesture control for Pip from a webcam. The tracking and gesture logic is
[gesture-tv-remote](https://github.com/alexhovy/gesture-tv-remote) (MIT), vendored unchanged in
`vendor/gesture_tv_remote/`. `pip_bridge/` plugs Pip into its ports, and `server/` turns each gesture
into a semantic input (`server/src/core/gesture.ts`). What was taken, licences and evidence:
`docs/extractions/gesture-control.md`.

This runs on the computer with the webcam (the Mac), not on the Fire TV.

## Set up (once)

Needs Python 3.12 or newer.

```bash
cd gesture
python3.12 -m venv .venv
.venv/bin/pip install -r requirements.lock
```

The hand model (7.8 MB) downloads into `models/` on first camera or image use.

## Use

From `server/`, with the server running and a TV (or `npm run fake:tv`) showing a code:

```bash
npm run gesture -- ABCD --preview          # webcam; --preview shows the hand and joystick overlay
npm run gesture -- --replay evening ABCD   # a recorded trace of poses instead of the webcam
npm run gesture -- --replay evening --dry  # print the inputs, send nothing
```

The script joins as a player called "Gestures". Like `sim:touch`, media gestures need that player to
be the host (join it first). macOS asks once for camera access for the terminal.

| Gesture | Pip |
|---|---|
| Show two upright open palms | Turns gestures on (nothing happens before this) |
| Open palm, fist, open palm | Play or pause |
| Point, move left or right | Seek 10 s back or forward (once per point: return to the centre and point again for more) |
| Pinch, move up or down | Volume up or down (keeps going while you hold) |
| Hold a fist (1.2 s) | Open Pip (so open the hand again quickly for play or pause) |
| Two fingers, then open palm | Close Pip |

Settings are upstream's `GESTURE_TV_*` environment variables (for example
`GESTURE_TV_DEBOUNCE_SECONDS`, `GESTURE_TV_FIST_HOLD_HOME_SECONDS`, `GESTURE_TV_WEBCAM_INDEX`);
the bridge sets the fist hold to 1.2 s unless you set it (upstream has 0.7 s);
see `vendor/gesture_tv_remote/src/shared/config.py`. Logs: `logs/bridge.log`.
`GESTURE_VERBOSE=1` also prints MediaPipe's own output.

## Test

From the repository root:

```bash
(cd gesture && .venv/bin/python -m unittest discover -s tests -t .)   # the bridge, with replays
(cd gesture/vendor/gesture_tv_remote && ../../.venv/bin/python -m unittest discover -s tests)  # upstream
(cd server && npx vitest run src/lab/gesture.test.ts)   # Python pipeline into the real server
(cd gesture && .venv/bin/python -m pip_bridge image /path/to/photo.jpg)   # tracker on a photo
```

The lab test is skipped when `gesture/.venv` is missing.

A trace (`traces/*.json`) is a list of steps, each lasting `ms` and holding hands with a `pose`
(`open_palm`, `fist`, `point`, `pinch`, `two_fingers`) placed `at` a position or moving `from` one
`to` another (0 to 1 across the camera image). The replay runs upstream's whole service with only
the camera and MediaPipe replaced.
