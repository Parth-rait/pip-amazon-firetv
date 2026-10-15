# Pip Pad

## What it is

The touch pad that replaces the remote, as a web app (React + Vite, plain CSS). The host runs it on a tablet; everyone else opens it on their phone by scanning the QR code on the TV. It joins a session with a first name, follows the stage the server sends (`session:view`), and gives the host the film controls.

- `src/net/socket.ts`: the one typed socket; rejoins with the saved code after every reconnect.
- `src/state/store.ts`: the reducer (logic, tested).
- `src/screens/`, `src/components/`: the screens and parts from PROJECT.md section 3.3.
- `src/shared/protocol.ts`: generated from `shared/protocol.ts` by `npm run sync:shared` at the root. Do not edit it.

Dependencies and why: `react`, `react-dom` (UI), `socket.io-client` (the realtime link). Dev: the Vite template's tools, `vitest` (tests).

## How to run

```bash
npm install
npm run dev        # http://localhost:5173; proxies /socket.io, /api, /qr and /media to the server on :8787
npm run build      # pad/dist, which the server serves at its own URL (the demo uses this)
```

For local work, also run `npm run dev` and `npm run fake:tv` in `server/`, then open `http://localhost:5173/?code=<code from fake:tv>` in two windows, one of them private, to be two players. Add `?debug=1` to see the ping round trip.

## How to test

```bash
npm test           # vitest: the reducer
npm run typecheck
npm run lint       # oxlint (from the Vite template)
```

## Environment

None. The pad talks to the server it was loaded from.
