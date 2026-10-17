# Pip Pad

## What it is

The touch pad that replaces the remote, as a web app (React + Vite, plain CSS). The host runs it on a tablet; everyone else opens it on their phone by scanning the QR code on the TV. It joins a session with a first name, follows the stage the server sends (`session:view`), and gives the host the film controls.

- `src/net/socket.ts`: the one typed socket; rejoins with the saved code after every reconnect.
- `src/state/store.ts`: the reducer (logic, tested).
- `src/screens/`, `src/components/`: the screens and parts from PROJECT.md section 3.3, including Ask Pip (chips, Ask box, mic), the quiz (four answer buttons, countdown, reveal) and the results.
- `src/lib/speech.ts`: the browser's speech recognition (Web Speech API) for the mic. Where the browser has none, the mic button does not show; the microphone needs HTTPS or localhost.
- `src/shared/protocol.ts`: generated from `shared/protocol.ts` by `npm run sync:shared` at the root. Do not edit it.

## The browser TV (`/tv`)

A second TV client beside the Vega app, in this same Vite project (`tv.html`, `src/tv/`), so the whole room can be built and shown on a laptop: open `/tv` in a browser and it pairs, plays and takes commands exactly like the Fire TV app (the same TV half of the protocol: `tv:hello`, `tv:watch`, `tv:playback`, `tv:command` with `tv:applied`, and `tv:home`). The pads and `npm run gesture` cannot tell the two apart.

- Home (the lobby): the featured film with Play, or Resume and Start over; rows of films; the Pip Pad QR, code and players always in view. The featured film follows the focus.
- Watch: the film full screen with Pip hidden; a transport bar on any key or mouse move and while paused; a short toast for each command from a pad or gesture; Pip with its bubble only when invoked, paused or answering. The quiz, results, guesses and reactions show only in kids mode.
- The keyboard is the remote: arrows (D-pad), Enter (OK), Escape or Backspace (Back), Space (play or pause), F (full screen). A 1920 x 1080 canvas is scaled to the window.
- The TV keeps its code in `sessionStorage`, so a reload keeps the pads paired. It loads the film by path from its own server, never through the tunnel.

Dependencies and why: `react`, `react-dom` (UI), `socket.io-client` (the realtime link). Dev: the Vite template's tools, `vitest` (tests).

## How to run

```bash
npm install
npm run dev        # http://localhost:5173; proxies /socket.io, /api, /qr and /media to the server on :8787
npm run build      # pad/dist, which the server serves at its own URL: the pad at /, the browser TV at /tv
```

For local work, also run `npm run dev` and `npm run fake:tv` in `server/`, then open `http://localhost:5173/?code=<code from fake:tv>` in two windows, one of them private, to be two players. Add `?debug=1` to see the ping round trip. With the server running and the pad built, `http://localhost:8787/tv` is a TV without the Vega Virtual Device (in development, `http://localhost:5173/tv`).

## How to test

```bash
npm test           # vitest: the reducer, the quiz lines, fullscreen and the wake lock
npm run typecheck
npm run lint       # oxlint (from the Vite template)
```

## Environment

None. The pad talks to the server it was loaded from.
