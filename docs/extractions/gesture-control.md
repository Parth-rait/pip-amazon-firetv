# Extraction manifest: hand-gesture control

Hand tracking and gesture control for Pip, taken as working code from an open-source project and
connected to Pip's existing semantic inputs. Extracted 17 Oct 2026. How to run it: `gesture/README.md`.

## Source

| | |
|---|---|
| Repository | https://github.com/alexhovy/gesture-tv-remote |
| Commit | `8accb574e3851b2c1cbca288ab52424728d03ad3` (7 Jul 2026, "build pipeline workflow") |
| Licence | MIT, Copyright (c) 2026 Alex Hovy. Copied unchanged to `gesture/vendor/gesture_tv_remote/LICENSE` |
| Where it lives in Pip | `gesture/vendor/gesture_tv_remote/` (`src/`, `tests/`, `LICENSE`) |
| Changes to upstream files | None. All 115 files are byte-identical to the commit (checked with `cmp`) |

What it does (upstream `docs/gestures.md`): two upright open palms activate it; then open palm, fist,
open palm selects; holding a fist is HOME; two fingers then palm is BACK; a pinch moved up or down is
volume; a pointing hand moved left, right, up or down is the D-pad. It covers MediaPipe's 21 hand
landmarks, pose classification, the active-hand lock and handoff, joystick-style neutral zones with
hysteresis, debounce and repeat, grace frames for missed detections, auto-zoom on the hand, the
tracking loop, and command dispatch with a bounded queue.

## Imported files

79 source files (5,865 lines) and 36 test files. That is the import closure of
`GestureRemoteService`, `RemoteCommandDispatcher`, upstream's camera builder, the MediaPipe tracker,
the OpenCV webcam source and both displays, plus `direct_remote_service.py` and
`infrastructure/camera/landmark_projection.py` so that two more upstream test modules run.

- `src/application/`: `pipelines/` (command_dispatch, detection, frame_capture, gesture_decision),
  `ports/` (all 12), `services/` (direct_remote_service, gesture_remote_service, pipeline_metrics,
  remote_command_dispatcher), `services/coordinators/` (cleanup, config_reload, display_debug, runtime_loop)
- `src/domain/`: constants, `commands/` (2), `evaluators/` (6), `geometry/` (4), `gestures/` (6),
  `session/` (4)
- `src/infrastructure/`: `camera/` (camera_zoom, crop_geometry, display, frame_processor,
  headless_display, landmark_projection, local_frame_source, video_overlay, video_preprocessing),
  `hand_tracking/` (hand_model, hand_tracking, model_store)
- `src/runtime/builders/camera.py`, `src/shared/` (config, logging), and every package's `__init__.py`
- `tests/`: `application/` (2), `architecture/test_layer_boundaries.py`, `domain/` (12),
  `infrastructure/` (hand_model, video_overlay, video_preprocessing), `shared/` (config, logging),
  `fakes/` (6), `helpers/` (2)

Not imported, and why:

| Upstream part | Why not |
|---|---|
| `infrastructure/tv/` (Samsung, webOS, Android TV, Roku, Apple TV, Wake-on-LAN) | Pip's TV is the Vega app, driven by Pip's server; replaced by `PipRemote` |
| `web/`, `runtime/web_app.py`, browser capture and debug stream (aiohttp, aiortc, Jinja) | Pip has its own pad and server; the bridge runs locally |
| `infrastructure/audio/` (microphone, voice search) | Pip's voice input is on the pad; replaced by `NoVoiceCapture` |
| `data_access/`, `repositories/` (SQLite settings), `network/` (mDNS, MAC), `runtime/` CLI and container | Settings come from `GESTURE_TV_*` variables; `pip_bridge/runtime.py` is the composition root |
| Tests for the parts above | They import code that was not imported |

## Dependencies

Python 3.12 or newer (upstream uses PEP 695 generics). `gesture/requirements.txt` pins what upstream's
`uv.lock` pins; `gesture/requirements.lock` is the full `pip freeze` that was tested.

| Package | Version | Licence | Why |
|---|---|---|---|
| mediapipe | 0.10.35 | Apache-2.0 | Hand landmarker (Tasks API) |
| opencv-contrib-python | 4.13.0.92 | Apache-2.0 | Webcam, colour conversion, preview window; mediapipe requires it |
| numpy | 2.4.6 | BSD-3-Clause and others | Frames |
| Pulled in by mediapipe | | absl-py, flatbuffers (Apache-2.0); matplotlib (PSF-style); sounddevice, pillow, six, fonttools, pyparsing (MIT family); contourpy, pycparser, kiwisolver (BSD); cffi (MIT-0); certifi (MPL-2.0, unmodified); packaging, python-dateutil (dual) | |
| Hand model `hand_landmarker.task` (float16, 7.8 MB) | sha256 `fbc2a300…cde1` | Google MediaPipe model card (Apache-2.0 there; not re-checked in this session) | Downloaded on first use by upstream's own `model_store` into `gesture/models/` (git-ignored); not committed |

Only `pip install` into `gesture/.venv`; nothing system-wide. No Node dependency was added.

## Changes required in Pip

New: `gesture/pip_bridge/` (the composition root `runtime.py`; `pip_remote.py`, upstream's
`TVRemotePort` writing JSON lines; `no_voice.py`; `scripted.py`, a trace-driven `HandTrackerPort` that
feeds upstream's own `raw_hand_to_state`; `still.py`, photo check and inference timing;
`__main__.py`), `gesture/tests/`, `gesture/traces/`, `server/src/core/gesture.ts` (command to
semantic input, and bridge line parsing), `server/src/gesture-bridge.ts` (spawns the bridge),
`server/scripts/gesture.ts` (`npm run gesture`), `server/src/lab/gesture.test.ts`.

Changed: `shared/protocol.ts` gains the input source `hand_gesture_cam` (copied by `sync:shared`;
`PROTOCOL_VERSION` stays 5: additive, and no client reads the source); `server/src/validate.ts`
accepts it; `server/package.json` adds the script; `.gitignore` adds `gesture/.venv/`, `models/`,
`logs/`, `__pycache__/`. Nothing in the router, sessions, pad or TV app changed.

| Gesture (upstream command) | Pip input | Router outcome |
|---|---|---|
| Open palm, fist, open palm (`DPAD_CENTER`) | `media.playPause` | play or pause |
| Point and move left or right (`DPAD_LEFT`, `DPAD_RIGHT`) | `media.seekRelative` -10 / +10 | seek |
| Pinch and move up or down (`VOLUME_UP`, `VOLUME_DOWN`) | `media.volumeDelta` +0.1 / -0.1 | volume |
| Hold a fist (`HOME`) | `pip.invoke` | Pip opens |
| Two fingers, then palm (`BACK`) | `pip.dismiss` | Pip closes |
| Point and move up or down (`DPAD_UP`, `DPAD_DOWN`) | `navigation.move` | refused `unsupported` until browsing exists (Phase 6) |
| Two-finger hold (upstream's voice) | none | ignored and logged |

Every gesture uses the same host check, the stale and duplicate checks, the journal and TV
confirmation as a tap on the pad. All targets are reversible, so none needs a confirmation step.

## Evidence (17 Oct 2026, MacBook Apple M2, macOS 27)

- Upstream's own suite before extraction: 280 tests ran; 273 passed; the 7 errors are modules for
  web or TLS parts whose libraries were not installed.
- Vendored tests in Pip (`cd gesture/vendor/gesture_tv_remote && ../../.venv/bin/python -m unittest
  discover -s tests`): 202 passed.
- Bridge tests (`cd gesture && .venv/bin/python -m unittest discover -s tests -t .`): 9 passed. They
  include whole-service replays: `evening` sends exactly SELECT, RIGHT, LEFT, VOLUME_UP, HOME, BACK, UP;
  `no-activation` (one palm, every gesture at full strength) sends nothing; `point-jitter` sends nothing.
  Each trace gave the same result in 10 of 10 runs.
- Server: 305 tests passed, three runs in a row (296 before; +6 adapter, +1 validation, +3 lab). The lab
  scenario runs the real Python pipeline into the real server and fake TV: 4 TV commands confirmed,
  Pip opened and closed, a guest's gestures refused `not-allowed`. Typecheck and lint clean.
- `npm run gesture -- --replay evening <code>` against `npm start` and a TV client: 7 sent, 6
  accepted, 1 refused (`unsupported`); bridge to script 1 to 3 ms, `pad:input` ack 4 to 11 ms, TV
  confirmation 2 to 4 ms (all on localhost).
- Real MediaPipe on Google's sample photos, through upstream's tracker and classifier:
  `pointing_up.jpg` POINT, `victory.jpg` TWO_FINGERS, `thumbs_up.jpg` no pose (not a gesture here),
  `woman_hands.jpg` two hands found, both not upright, so no pose. Inference p50 25 ms, p95 26 ms
  (single hand, 420 px); p50 36 ms (two hands, 640x960).

The first evening trace missed VOLUME_UP in about 1 run in 6: the pinch reached 0.178 to 0.196 of the
frame against upstream's activation distance of 0.184 (0.16 neutral x 1.15 hysteresis). The traces now
move 0.25 and hold for 100 ms. This is upstream behaving as designed. For real users, expect a pinch
to need about a fifth of the frame height at the default `GESTURE_TV_VOLUME_MAX_DISTANCE`.

## Not verified, and limits

- No live webcam session with a person was run in this extraction (it needs camera permission and
  someone gesturing). Accuracy, false triggers and end-to-end latency with real hands are unmeasured;
  the next step is a short session with `npm run gesture -- <code> --preview`.
- The bridge runs on the computer with the webcam, not on the Fire TV: Vega does not run Python or
  MediaPipe. The TV only sees Pip's usual `tv:command`s.
- Media gestures work only when the "Gestures" player is the session's host, as with `sim:touch`.
- Upstream's Python formatters and type checker (ruff, black, mypy) were not run here.

## Rejected: raechao93/OpenGestureXR

MIT, commit `13d3b5416abd92994feed7a8d1fb59a33241a1fa`. Nothing imported:

- `ai_engine/gesture_detector.py` calls `mediapipe.solutions.hands`; `mediapipe.solutions` does not
  exist in mediapipe 0.10.35 (checked: `hasattr(mediapipe, "solutions")` is False), so it cannot run.
- `ai_engine/gesture_classifier.py` returns fixed numbers as "confidence" (0.93, 0.87 and so on) and
  labels any pose it cannot read as `open_hand` (0.55). That would turn noise into a pose, which is the
  accidental trigger this work must avoid.
- `sensor_fusion/kalman.py` calls itself a skeleton whose matrices "need tuning".
- The OpenXR part is Unity C# (`unity_plugin/`), which does not apply to a Vega TV app. The ONNX path
  needs a trained model, and the repository ships none.

gesture-tv-remote already covers the same ground (classification, smoothing through neutral zones and
grace frames, debounce) with tests, so no fallback was needed.
