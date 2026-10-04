// Scroll the page step by step and screenshot each position, then tile the shots into contact sheets.
// usage: node scripts/shoot.mjs [url] [outDir] [stepFraction]     env: ONLY=desktop|mobile  FROM=<unit> TO=<unit>
import { chromium, webkit, devices } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, rmSync, readdirSync } from 'node:fs';

const url = process.argv[2] || 'http://localhost:5199/?capture';
const outDir = process.argv[3] || 'shots';
const stepFrac = +(process.argv[4] || 0.33);
const only = process.env.ONLY;

const targets = [
  { name: 'desktop', opts: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, cols: 4, tw: 480 },
  { name: 'mobile', opts: { ...devices['iPhone 13'], deviceScaleFactor: 1 }, cols: 8, tw: 240 },
  { name: 'small', opts: { viewport: { width: 360, height: 640 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, cols: 8, tw: 240 },
  { name: 'laptop', opts: { viewport: { width: 1280, height: 680 }, deviceScaleFactor: 1 }, cols: 4, tw: 480 },
  { name: 'landscape', opts: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, cols: 4, tw: 480 },
  { name: 'ipadland', opts: { viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 }, cols: 4, tw: 480 },
  { name: 'tablet', opts: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true }, cols: 8, tw: 240 },
].filter((t) => (only ? only.split(',').includes(t.name) : ['desktop', 'mobile'].includes(t.name)));

const browser = await (process.env.ENGINE === 'webkit' ? webkit : chromium).launch();
for (const t of targets) {
  const dir = `${outDir}/${t.name}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext(t.opts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.querySelectorAll('img[loading=lazy]').forEach((i) => (i.loading = 'eager')));
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);
  const { total, vh, T, units } = await page.evaluate(() => ({ total: document.documentElement.scrollHeight, vh: innerHeight, T: window.__T, units: window.__T?.end }));
  const unitPx = T ? (document => 0)() : 0;
  const perUnit = T ? await page.evaluate(() => (document.querySelector('.journey').offsetHeight - innerHeight) / window.__T.end) : 1;
  const from = process.env.FROM ? Math.round(+process.env.FROM * perUnit) : 0;
  const to = process.env.TO ? Math.round(+process.env.TO * perUnit) : total - vh;
  const step = Math.round(vh * stepFrac);
  let i = 0;
  for (let y = from; ; y += step) {
    const yy = Math.min(y, to);
    await page.evaluate((v) => window.scrollTo(0, v), yy);
    await page.waitForTimeout(140);
    const u = (yy / perUnit).toFixed(1);
    await page.screenshot({ path: `${dir}/${String(i).padStart(3, '0')}_u${u}.png` });
    i++;
    if (yy >= to) break;
  }
  console.log(t.name, 'shots:', i, 'page height:', total, 'px/unit:', perUnit.toFixed(1), 'errors:', errors.length ? errors : 'none');
  await ctx.close();

  // contact sheets
  const files = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
  const per = t.cols * (['desktop', 'laptop', 'landscape', 'ipadland'].includes(t.name) ? 4 : 2);
  const meta = await sharp(`${dir}/${files[0]}`).metadata();
  const th = Math.round((meta.height * t.tw) / meta.width);
  for (let s = 0; s < files.length; s += per) {
    const chunk = files.slice(s, s + per);
    const rows = Math.ceil(chunk.length / t.cols);
    const comps = [];
    for (const [k, f] of chunk.entries()) {
      const x = (k % t.cols) * (t.tw + 8), y = Math.floor(k / t.cols) * (th + 28);
      comps.push({ input: await sharp(`${dir}/${f}`).resize(t.tw, th).toBuffer(), left: x, top: y + 24 });
      const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${t.tw}" height="22"><text x="4" y="16" font-family="Menlo, monospace" font-size="14" fill="#ffe600">${f.replace('.png', '')}</text></svg>`);
      comps.push({ input: label, left: x, top: y + 2 });
    }
    const out = `${outDir}/${t.name}_sheet_${String(s / per).padStart(2, '0')}.jpg`;
    await sharp({ create: { width: t.cols * (t.tw + 8), height: rows * (th + 28), channels: 3, background: '#282828' } }).composite(comps).jpeg({ quality: 82 }).toFile(out);
  }
  console.log(t.name, 'sheets:', Math.ceil(files.length / per));
}
await browser.close();
