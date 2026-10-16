// End-to-end in real browsers (Virtual Pip Lab): the TV simulator, a host phone and a guest tablet.
// Run the server first with LAB_CONTENT=true and the built pad, then:
//   node scripts/e2e-browser.mjs http://localhost:8787 <screenshot folder>
// Prints PASS/FAIL per check and exits 1 on any failure.
import { createRequire } from 'node:module';
// Uses Playwright from PLAYWRIGHT_MODULE_DIR (a node_modules folder) or a global install.
const require = createRequire(process.env.PLAYWRIGHT_MODULE_DIR ?? '/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const [base, out] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const checks = [];
const check = (name, ok, detail = '') => { checks.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' - ' + detail : ''}`); };
async function open(name, url, viewport, scale = 1) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(`${name}: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  await page.goto(url);
  return page;
}
const shot = (page, file) => page.screenshot({ path: `${out}/${file}` });

const tv = await open('tv', `${base}/tv.html`, { width: 1920, height: 1080 });
await tv.waitForSelector('.tv-code');
const code = (await tv.textContent('.tv-code')).trim();
check('TV shows a pairing code and QR', /^[A-Z0-9]{4}$/.test(code) && (await tv.isVisible('.tv-qr img')), code);

const host = await open('host', `${base}/?code=${code}`, { width: 390, height: 844 }, 2);
await host.fill('#name', 'Sam');
await host.click('button[type=submit]');
await host.waitForSelector('.film-card');
const guest = await open('guest', `${base}/?code=${code}&lab=1`, { width: 820, height: 1180 });
await guest.fill('#name', 'Mia');
await guest.click('button[type=submit]');
await guest.waitForSelector('text=Waiting for Sam');
await tv.waitForSelector('.tv-player >> text=Mia');
await shot(tv, 'tv-lobby.png');
await shot(host, 'pad-lobby-host.png');

await host.click('.film-card >> text=The Lantern Fox');
await tv.waitForSelector('video.tv-video');
await tv.waitForFunction(() => { const v = document.querySelector('video'); return v && v.readyState >= 2 && !v.paused; }, null, { timeout: 15000 });
check('TV plays the film after the host picks it', true);
// Someone scrubs on the TV to the owl scene (42 s); the TV reports it.
await tv.evaluate(() => { document.querySelector('video').currentTime = 42; });
await tv.waitForTimeout(800);
await shot(tv, 'tv-watch-quiet.png');
check('watch is quiet: no Pip, no quiz, no prompts on the TV', !(await tv.isVisible('.tv-assist')) && !(await tv.isVisible('text=quiz')));
await host.waitForSelector('.host-controls');
check('host pad has no quiz button', !(await host.isVisible('text=The quiz unlocks')));
await shot(host, 'pad-watch-host.png');
await shot(guest, 'pad-watch-guest-tablet.png');

// Mia asks with a starter chip.
await guest.click('.chip >> text=Who is that?');
await tv.waitForSelector('.tv-assist__text', { timeout: 8000 });
const tvText = await tv.textContent('.tv-assist__text');
check('the reply shows on the TV with the asker', (await tv.textContent('.tv-assist__asked')).includes('Mia asked'), tvText);
check('the reply is grounded in what was seen', /Hoot|owl|lantern/i.test(tvText), tvText);
await guest.waitForSelector('.reply__text');
await shot(tv, 'tv-assist-reply.png');
await shot(guest, 'pad-reply-guest-tablet.png');
check('the host pad does not show Mia\'s reply', !(await host.isVisible('.reply__text')));

// Host pauses: "Pausing..." then "Paused" only after the TV confirms.
await host.click('button:has-text("Pause")');
await host.waitForSelector('.action-line:has-text("Paused")', { timeout: 6000 });
check('host sees "Paused" after the TV confirms it', true);
await shot(host, 'pad-paused-confirmed.png');
await tv.waitForSelector('.tv-pausebar');
await shot(tv, 'tv-paused.png');

// Mia taps Done: Pip leaves the TV.
await guest.click('.reply >> text=Done');
await tv.waitForSelector('.tv-assist', { state: 'detached', timeout: 4000 });
check('Done hides Pip on the TV', true);

// Spoiler and future probes at 42 s, typed and via the chip area.
await host.click('button:has-text("Play")');
await tv.waitForTimeout(2200); // the ask limit is one question per 2 s per player
await guest.fill('.ask__form input', 'Who does the lantern belong to?');
await guest.click('.ask__form button[type=submit]');
await guest.waitForSelector('.reply__text');
const spoiler = await guest.textContent('.reply__text');
check('a spoiler question gets no spoiler', !/Moss|badger|keeper/i.test(spoiler), spoiler);
await guest.click('.reply >> text=Done');
await tv.waitForTimeout(2200);
await guest.fill('.ask__form input', 'What happens next?');
await guest.click('.ask__form button[type=submit]');
await guest.waitForFunction(() => document.querySelector('.reply__text')?.textContent?.includes('No spoilers'));
check('"What happens next?" gets the no-spoiler line', true);
await shot(guest, 'pad-no-spoiler-tablet.png');

// The simulated Pip button: a double press pauses through the same command path.
await guest.click('.reply >> text=Done');
const lab = guest.locator('.lab__button');
await lab.dispatchEvent('pointerdown'); await lab.dispatchEvent('pointerup');
await guest.waitForTimeout(100);
await lab.dispatchEvent('pointerdown'); await lab.dispatchEvent('pointerup');
await guest.waitForSelector('.lab >> text=not-allowed');
check('a non-host Pip button cannot pause the film', true);
await shot(guest, 'pad-lab-panel-tablet.png');

// Small phone.
const small = await open('small', `${base}/?code=${code}`, { width: 360, height: 640 }, 2);
await small.fill('#name', 'Gran');
await small.click('button[type=submit]');
await small.waitForSelector('.ask');
await shot(small, 'pad-watch-small-phone.png');
const overflow = await small.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
check('no horizontal scroll at 360 px', !overflow);

check('no browser console errors', errors.length === 0, errors.join(' | '));
await browser.close();
const failed = checks.filter((c) => !c.ok).length;
console.log(`${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed ? 1 : 0);
