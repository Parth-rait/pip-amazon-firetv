// npm run fake:tv: acts like the TV app, for pad development without a Fire TV.
// The same FakeTv runs in the Virtual Pip Lab (src/lab/); here it plays by the real clock.
import 'dotenv/config';
import { loadConfig } from '../src/config.js';
import { FakeTv } from '../src/lab/fake-tv.js';

const REPORT_EVERY_MS = 5000;
const config = loadConfig();
const url = process.argv[2] ?? `http://localhost:${config.PORT}`;
const tv = new FakeTv({ url, log: (line) => console.log(line) });

tv.socket.on('session:view', (view) => {
  const names = view.players.map((p) => `${p.name}${p.online ? '' : ' (away)'}`).join(', ');
  const pip = view.assist ? ` pip-says="${view.assist.text ?? '...'}"` : '';
  const action = view.lastAction ? ` last=${view.lastAction.type}:${view.lastAction.status}` : '';
  console.log(`view stage=${view.stage} pip=${view.pip} players=[${names}]${action}${pip}`);
});
tv.socket.on('disconnect', (reason) => console.log(`disconnected: ${reason}`));

setInterval(() => {
  if (tv.playback && !tv.playback.paused && !tv.playback.ended) tv.report();
}, REPORT_EVERY_MS);
