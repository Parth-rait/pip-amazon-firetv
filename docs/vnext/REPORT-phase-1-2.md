# vNext Phases 1 and 2: quiet viewing, Pip on demand, semantic inputs

Date: 16 Oct 2026. Branch `mac/film-and-tv`. Rollback point: tag `pre-vnext` (1a6c584).

## What changed

**Contract v5** (`shared/protocol.ts`, synced to every package; `server/src/validate.ts` updated in the same change)

- Removed Pip moods, colors and `pip-style`. One Pip, one voice.
- Removed play, pause and seek from `HostCommand`. Every control is now a semantic input: `pad:input` carries a `PipInput` (`id`, `source`, `at`, `event`) and gets an `InputResult` back.
- `InputSource` names the adapter, never the person: `pad_touch`, `pad_voice`, `tv_remote`, `touchwheel_proto`, `capacitive_button_proto`, `simulator`.
- `TvCommand` has an `id` and adds `volume` and `brightness`. The TV answers each command with `tv:applied`.
- `SessionView` adds `assistant` (Pip open, and who opened it), `device` (volume, brightness, light scene, whether lights are simulated, and the last action with its confirmation) and `kidsMode`.

**Server**

- `src/actions.ts` is the deterministic router. It refuses stale inputs (older than 10 s) and duplicates. Anyone can open or close Pip; media and device controls belong to the host and work only while a film is on. Lights are simulated and say so. Navigation answers `unsupported` until Phase 6. A TV action counts as done only after `tv:applied`; with no answer after 3 s it counts as failed. No model is called on any of these paths.
- `src/core/journal.ts` writes events to `data/events/events-YYYY-MM-DD.jsonl` (gitignored) through an async queue, so logging never waits on the disk. Each event has a schema version, a pseudonymous subject and session id, a consent scope, provenance, a source and a timestamp.
- Quizzes, guesses and reactions need `kidsMode`. Greetings are lobby only. Pip closes whenever the stage changes.
- `src/core/touch.ts` is the touch adapter. It turns raw button and touchwheel readings into the same semantic inputs the pad sends. Buttons are debounced at 30 ms. The wheel ignores movements under 3°, handles the jump across 0° and seeks 10 s per 30° of turn. These are starting values, to be calibrated on real hardware.
- `npm run sim:touch -- <trace> <code>` replays a trace (`sim/traces/*.json`) into a live session at the trace's own timing. `--dry` prints the inputs without sending anything.

**Pip Pad**

- Watch screen: the film's progress, the host's remote (play/pause, ±10 s, volume, brightness, light scenes with a "simulated" note), a status line that says whether the TV confirmed the last action, one voice button and the Pip button.
- Voice: plain rules in `lib/commands.ts` ("pause", "back 30 seconds", "louder", "dim it", "movie lights", "hey Pip"). Questions ("why did he stop?") are left for Pip. Commands never reach a model.
- The Pip button opens a sheet with Pip, its last answer, three quick questions and the Ask bar. Opening the sheet sends `pip.invoke`, closing it sends `pip.dismiss`.
- Removed from the default path: the Story and Who's who tabs, reactions, guesses, "Make Pip yours", avatar shapes and the avatar picker. Kids games is a switch in the lobby; when it is on, the quiz button, guesses and reactions come back.
- One mascot in the style of Bandhu.

**TV**

- Pip is drawn in Views to match the pad's mascot. It is hidden while the film plays, and it shows when someone opens it on a pad, while paused (with a hint) or with an answer.
- Volume uses the player's own `volume` (Vega keeps system volume for system apps). Brightness is a dim layer over the video.
- Each `tv:command` is confirmed with `tv:applied`, including failures ("not watching", no player).
- Guesses and reactions show only in kids mode.

## Evidence

Commands run at the repository root, with Node 22:

| Check | Result |
|---|---|
| `npm run check:shared` | pad and tv copies `ok` |
| `npm run typecheck` | clean in server, pad and tv |
| `npm run lint` | 0 errors; 4 warnings, all Vega "system distributed library" notices |
| `npm test` | server 181 passed (29 files), pad 27 passed, tv 10 passed |
| `npm run smoke:join` | `JOIN OK code=6X2C players=Sam,sam 2 host=Sam` |
| `npm run smoke:quiz` (now turns kids games on first) | `QUIZ OK questions=5 Sam=5 Mia=0` |

On the Vega Virtual Device (release build), driven by a headless pad through the Cloudflare tunnel:

- Playing: no overlay at all over the film.
- Paused: the pause bar, then Pip in the corner with "Paused. Tap Pip on your pad to ask about the film."
- Pip opened from the pad: Pip with "Ask me on your Pip Pad." An answer: "Mom asked: What just happened?" with the answer in a bubble. After closing, Pip is gone again.
- Every command was confirmed by the TV (`action.confirmed`, measured server to TV and back): pause 74–79 ms, play 73–74 ms, seek 74–120 ms, volume 75–77 ms, brightness 73–118 ms.
- Brightness on the same paused frame: mean luminance 225 at 100%, 152 at 70% (×0.68), and 225 again at 100%.
- Touch simulation, `npm run sim:touch -- evening ALHM`: 19 readings became 7 inputs, all accepted, and the TV confirmed each one (pause 79 ms, three seeks of −10 s at 120, 74 and 75 ms, play 73 ms). The journal recorded them with `source: "touchwheel_proto"` or `"capacitive_button_proto"`, plus pseudonymous ids.

Acceptance criteria from PLAN.md section 14 that these results cover:

- The same semantic command from the touchscreen and the simulated touch controls reaches the same handler and gives the same TV command (`actions.test.ts`: "gives the same command whichever adapter sent the input"; the live run above).
- Playback commands make no model call (`actions.test.ts`, where the model is set to reject every call).
- Duplicate and stale inputs cause no action (`actions.test.ts`).
- A failed device action is reported honestly. With no `tv:applied` within 3 s, the pad says "the TV did not confirm it".

## Not verified, and open questions

- Volume: the TV app confirmed that it set `player.volume`, but the audio level on the virtual device was not measured.
- No 10-minute viewing test yet (PLAN.md section 14). The runs above cover about two minutes of the film.
- The TV remote is not yet an input adapter. The source `tv_remote` exists in the contract, but the TV's D-pad still uses its old path in the lobby only.
- The touch adapter has not been tested on hardware. The thresholds are guesses until a board is calibrated (PLAN.md 4.3, Phase 5).
- `sim:touch` joins as a player called "Touch". Media inputs work only when that player is the host. A paired controller that acts for the host is not designed yet.
- Big Buck Bunny is still in the catalogue. Phase 3 replaces it with a short licensed film.
- Ask Pip still uses the local model (Ollama, qwen2.5:3b) until AWS is verified. The answer above took about 3 s.
