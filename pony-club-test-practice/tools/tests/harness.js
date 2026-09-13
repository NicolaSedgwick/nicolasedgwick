/* Shared plumbing for the browser tests.
   Serves the app on a free port, opens each build in Chromium, and gives the
   test files a few helpers. Nothing here knows what is being tested. */

const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..', '..');   // the app folder
const PORT = 8731;

/* The card flip runs for about half a second. A click during it hit-tests
   against the face that is rotating away, so every test settles after a flip
   before aiming at anything on the new face. */
const FLIP_MS = 700;

/* speechSynthesis is a read-only accessor — it has to be redefined, not
   assigned. getVoices() returns nothing on purpose: a plain object cannot be
   assigned to utterance.voice, and the voice choice is tested elsewhere. */
const SPEECH_STUB = () => {
  window.__spoken = [];
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      speaking: false,
      cancel() {},
      onvoiceschanged: null,
      speak(u) { window.__spoken.push(u.text); },
      getVoices() { return []; }
    }
  });
};

let failures = 0;

function check(name, ok, extra) {
  if (!ok) failures++;
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (extra !== undefined && extra !== null ? '  [' + extra + ']' : ''));
}

function serve() {
  return new Promise((resolve, reject) => {
    const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'],
      { cwd: ROOT, stdio: 'ignore' });
    srv.on('error', reject);
    const tryOnce = tries => {
      http.get('http://127.0.0.1:' + PORT + '/index.html', r => { r.resume(); resolve(srv); })
        .on('error', () => tries > 0 ? setTimeout(() => tryOnce(tries - 1), 200) : reject(new Error('server did not start')));
    };
    setTimeout(() => tryOnce(25), 200);
  });
}

/* Both builds, because a bug has hidden in only the bundled one before. */
const BUILDS = [
  { label: 'index.html (served over http)', url: 'http://127.0.0.1:' + PORT + '/index.html' },
  { label: 'standalone single-file build', url: pathToFileURL(path.join(ROOT, 'pony-club-c-test-standalone.html')).href }
];

async function openApp(url) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  await ctx.addInitScript(SPEECH_STUB);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url);
  await page.waitForSelector('#card');
  await page.waitForTimeout(400);
  return { browser, page, errors };
}

/* Walk the deck to a known card. The deck is shuffled, so index is no use. */
async function gotoCard(page, ref) {
  for (let i = 0; i < 90; i++) {
    if ((await page.textContent('#backRef')) === ref) return true;
    await page.click('#next');
  }
  return false;
}

const flipped = page => page.evaluate(() => document.getElementById('card').classList.contains('is-flipped'));

async function flip(page) {                 // turn the card over and let it settle
  await page.click('#card');
  await page.waitForTimeout(FLIP_MS);
}

const deckTotal = async page => parseInt((await page.textContent('#counter')).split('/')[1].trim(), 10);

async function runAll(name, body) {
  const srv = await serve();
  try {
    for (const build of BUILDS) {
      console.log('\n=== ' + name + ' — ' + build.label + ' ===');
      const app = await openApp(build.url);
      try {
        await body(app.page, app.errors);
        check('no page errors throughout', app.errors.length === 0, app.errors.join('; '));
      } finally {
        await app.browser.close();
      }
    }
  } finally {
    srv.kill();
  }
  console.log('\n' + (failures ? failures + ' FAILURE(S)' : 'All checks passed'));
  process.exit(failures ? 1 : 0);
}

module.exports = { check, runAll, gotoCard, flip, flipped, deckTotal, FLIP_MS };
