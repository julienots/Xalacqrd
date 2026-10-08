// End-to-end smoke test of the production bundle (the same files packaged in
// the Android APK). Starts `vite preview`, drives the game in Chromium at a
// phone viewport and asserts every major feature works.
//
//   npm run build && npm run test:e2e
//
// Env: CHROME_PATH to override the Chromium binary, SHOTS=1 to save screenshots.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const SHOTS = process.env.SHOTS ? path.join(ROOT, 'tests/e2e/screens') : null;
const PORT = 4791;
const chromePath = process.env.CHROME_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/chromium', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p));

const results = [];
let failed = 0;
async function step(name, fn) {
  const t0 = Date.now();
  try { await fn(); results.push(`✔ ${name} (${Date.now() - t0}ms)`); }
  catch (e) {
    failed++;
    results.push(`✘ ${name}: ${e.message.split('\n').slice(0, 3).join(' / ')}`);
    try { fs.mkdirSync(path.join(ROOT, 'tests/e2e/screens'), { recursive: true }); await page.screenshot({ path: path.join(ROOT, 'tests/e2e/screens', `FAIL-${name.replace(/\W+/g, '_')}.png`) }); } catch { /* ignore */ }
  }
}
const assert = (c, msg) => { if (!c) throw new Error(msg); };

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'pipe' });
await new Promise((res) => { server.stdout.on('data', (d) => { if (String(d).includes(String(PORT))) res(); }); setTimeout(res, 6000); });

const browser = await chromium.launch({ executablePath: chromePath, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 1, hasTouch: false, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const shot = async (n) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `${n}.png`) }); } };
const game = (fn, arg) => page.evaluate(fn, arg);
const closeModals = async () => { for (let i = 0; i < 6 && (await page.locator('.modal-back').count()); i++) { await page.locator('.modal-x').first().click().catch(() => {}); await page.waitForTimeout(350); } };
const nav = async (id) => { await closeModals(); await page.locator(`.nav-btn[data-nav=${id}]`).click(); await page.waitForTimeout(900); };

await step('launch & loading screen', async () => {
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForSelector('.loading', { timeout: 5000 });
  await shot('01-loading');
  await page.waitForSelector('.loading', { state: 'detached', timeout: 15000 });
});

await step('welcome + daily login', async () => {
  await page.getByText('Begin', { exact: true }).click({ timeout: 5000 });
  await page.waitForTimeout(600);
  await page.getByText('Claim', { exact: true }).first().click({ timeout: 5000 });
  await page.waitForTimeout(600);
  await page.getByText('Collect', { exact: true }).click({ timeout: 5000 });
  await page.waitForTimeout(500);
  await closeModals();
  assert(await page.locator('.home-play').count(), 'home PLAY button missing');
  assert(await game(() => window.__xala.data.decks.length === 2), 'starter decks missing');
  await shot('02-home');
});

await step('main menu 3D scene renders', async () => {
  assert(await page.locator('.home-scene canvas').count(), 'no WebGL canvas on home');
});

await step('booster opening (swipe, reveals, summary)', async () => {
  await game(() => { window.__xala.data.pity = 29; window.__xala.data.settings.fastReveal = true; });
  const before = await game(() => window.__xala.collection.uniqueOwned());
  await page.locator('.home-tile', { hasText: 'Boosters' }).click();
  await page.waitForTimeout(700);
  await page.locator('.offer button.primary').first().click();
  await page.waitForTimeout(2200);
  await shot('03-pack');
  await page.mouse.move(80, 320); await page.mouse.down();
  for (let x = 80; x <= 370; x += 18) { await page.mouse.move(x, 322); await page.waitForTimeout(16); }
  await page.mouse.up();
  await page.waitForTimeout(2000);
  let sawLegendary = false;
  for (let i = 0; i < 60 && !(await page.locator('.booster-summary').count()); i++) {
    await page.mouse.click(206, 450);
    await page.waitForTimeout(650);
    const rar = await page.evaluate(() => document.querySelector('.rt-rar')?.textContent ?? '');
    if (/LEGENDARY|MYTHIC|ANCIENT|CELESTIAL|SECRET|PRISMATIC/.test(rar)) { sawLegendary = true; await shot('04-reveal-big'); }
  }
  assert(await page.locator('.booster-summary').count(), 'summary not reached');
  assert(sawLegendary, 'pity Legendary+ reveal not shown');
  const after = await game(() => window.__xala.collection.uniqueOwned());
  assert(after > before, 'collection did not grow');
  await shot('05-summary');
  await page.getByText('Done', { exact: true }).click();
  await page.waitForTimeout(800);
});

await step('codex search, filter and card inspector', async () => {
  await nav('collection');
  await page.locator('.search-row input').fill('drake');
  await page.waitForTimeout(500);
  const n = await page.locator('.card-slot').count();
  assert(n > 0, 'search returned nothing');
  await page.locator('.search-row input').fill('');
  await page.locator('.tab', { hasText: 'Owned' }).click();
  await page.waitForTimeout(600);
  await page.locator('.card-thumb').first().click();
  await page.waitForTimeout(800);
  assert(await page.locator('.card-large').count(), 'card inspector missing');
  await shot('06-inspect');
  await closeModals();
});

await step('deck builder: create, add, validate, save', async () => {
  await nav('decks');
  const id = await game(() => { const g = window.__xala; const d = g.decks.create('E2E Deck'); return d.id; });
  await game((id) => { const g = window.__xala; g.decks.autoComplete(g.decks.get(id)); }, id);
  await nav('home'); await nav('decks');
  const errs = await game((id) => window.__xala.decks.validate(window.__xala.decks.get(id)), id);
  assert(errs.length === 0, `auto deck invalid: ${errs[0]}`);
  await page.locator('.deck-tile .grow', { hasText: 'E2E Deck' }).click();
  await page.waitForTimeout(900);
  assert(await page.locator('.ds-card').count() > 5, 'deck strip empty');
  await page.locator('button', { hasText: '📊' }).click();
  await page.waitForTimeout(300);
  assert(await page.locator('.curve').count(), 'stats missing');
  await shot('07-deck-editor');
  await page.getByText('Save', { exact: true }).click();
  await page.waitForTimeout(800);
});

await step('battle vs AI plays to completion', async () => {
  await nav('play');
  await page.locator('.mode-card', { hasText: 'Practice' }).click();
  await page.waitForTimeout(400);
  await page.locator('.list-item', { hasText: 'EASY' }).click();
  await page.waitForTimeout(1200);
  await page.locator('.mulligan .btn').click();
  await page.waitForTimeout(1500);
  await shot('08-battle');
  for (let turn = 0; turn < 40 && !(await page.locator('.result').count()); turn++) {
    for (let k = 0; k < 80; k++) { const t = await page.locator('.end-turn').textContent().catch(() => ''); if (t === 'END TURN' && !(await page.locator('.end-turn.disabled').count())) break; if (await page.locator('.result').count()) break; await page.waitForTimeout(400); }
    if (await page.locator('.result').count()) break;
    for (let k = 0; k < 4; k++) {
      const c = page.locator('.hand-card.playable').first();
      if (!(await c.count())) break;
      await c.click({ force: true, timeout: 2500 }).catch(() => {}); await page.waitForTimeout(200); await c.click({ force: true, timeout: 2500 }).catch(() => {}); await page.waitForTimeout(350);
      const tgt = page.locator('.targetable, .ally-target').first();
      if (await tgt.count()) await tgt.click({ force: true, timeout: 2500 }).catch(() => {}); else if ((await page.locator('.target-hint').textContent()) !== '') await page.mouse.click(206, 330);
      await page.waitForTimeout(900);
    }
    for (let k = 0; k < 6; k++) {
      const u = page.locator('.lane.mine .unit.can-attack').first();
      if (!(await u.count())) break;
      await u.click({ force: true, timeout: 2500 }).catch(() => {}); await page.waitForTimeout(250);
      const t = page.locator('.targetable').last();
      if (await t.count()) await t.click({ force: true, timeout: 2500 }).catch(() => {});
      await page.waitForTimeout(900);
      if (await page.locator('.result').count()) break;
    }
    if (await page.locator('.result').count()) break;
    await page.locator('.end-turn').click({ force: true, timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(600);
  }
  assert(await page.locator('.result').count(), 'match did not finish within 40 turns');
  await shot('09-result');
  const matches = await game(() => window.__xala.data.stats.matches);
  assert(matches >= 1, 'match not recorded');
  await page.getByText('Continue', { exact: true }).click({ timeout: 10000 });
  await page.waitForTimeout(800);
});

await step('shop purchase + double-purchase prevention', async () => {
  await nav('shop');
  await page.locator('.tab', { hasText: 'Boosters' }).click();
  await page.waitForTimeout(400);
  const coins = await game(() => window.__xala.data.currencies.coins);
  await page.locator('.offer', { hasText: 'Basic Pack' }).first().locator('button').click();
  await page.waitForTimeout(400);
  await page.getByText('Buy', { exact: true }).click();
  await page.waitForTimeout(700);
  await closeModals();
  const coins2 = await game(() => window.__xala.data.currencies.coins);
  assert(coins2 === coins - 400, `coins ${coins} -> ${coins2}`);
  await page.locator('.tab', { hasText: 'Gems' }).click();
  await page.waitForTimeout(300);
  const gems = await game(() => window.__xala.data.currencies.gems);
  await page.locator('.offer button', { hasText: 'Store unavailable' }).first().click();
  await page.waitForTimeout(500);
  assert((await game(() => window.__xala.data.currencies.gems)) === gems, 'IAP granted gems without a store');
  await shot('10-shop');
});

await step('pass, events, missions, chests, profile', async () => {
  await nav('pass'); assert(await page.locator('.pass-row').count() > 50, 'pass tiers missing');
  await nav('events'); assert(await page.locator('.list-item').count() >= 3, 'event missions missing');
  await nav('home');
  await page.locator('.home-tile', { hasText: 'Missions' }).click(); await page.waitForTimeout(600);
  assert(await page.locator('.list-item').count() >= 6, 'missions missing');
  await nav('home');
  await page.locator('.home-tile', { hasText: 'Chests' }).click(); await page.waitForTimeout(600);
  const before = await game(() => window.__xala.data.stats.chestsOpened ?? 0);
  await page.locator('.list-item .btn.primary').first().click(); await page.waitForTimeout(1200);
  await page.locator('.chest-stage').click(); await page.waitForTimeout(2200);
  await shot('11-chest');
  assert((await game(() => window.__xala.data.stats.chestsOpened ?? 0)) === before + 1, 'chest not opened');
  await closeModals();
  await nav('home');
  await page.locator('.home-tile', { hasText: 'Profile' }).click(); await page.waitForTimeout(600);
  assert(await page.locator('.stat-box').count() >= 9, 'profile stats missing');
});

await step('save persists across reload', async () => {
  const snap = await game(async () => { const g = window.__xala; g.data.currencies.coins = 4321; await g.save.flush(g.data); return { cards: g.collection.uniqueOwned(), decks: g.data.decks.length }; });
  await page.reload();
  await page.waitForSelector('.loading', { state: 'detached', timeout: 15000 });
  const now = await game(() => ({ coins: window.__xala.data.currencies.coins, cards: window.__xala.collection.uniqueOwned(), decks: window.__xala.data.decks.length }));
  assert(now.coins === 4321 && now.cards === snap.cards && now.decks === snap.decks, `mismatch ${JSON.stringify(now)} vs ${JSON.stringify(snap)}`);
});

await step('frame rate sample (software GL, indicative only)', async () => {
  await closeModals();
  const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(Math.round(n / 2)); }; requestAnimationFrame(f); }));
  results.push(`  ↳ home scene: ~${fps} fps in headless SwiftShader (real GPUs are far faster)`);
});

await step('no uncaught errors', async () => { assert(errors.length === 0, `errors: ${errors.slice(0, 3).join(' | ')}`); });

await browser.close();
server.kill();
console.log(results.join('\n'));
console.log(failed ? `\n${failed} step(s) FAILED` : '\nAll E2E steps passed');
process.exit(failed ? 1 : 0);
