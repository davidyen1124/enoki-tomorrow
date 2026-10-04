// Record the whole scroll, one frame every few pixels, and encode it as an MP4.
// usage: node scripts/record.mjs <desktop|mobile> [stepPx]      env: URL
import { chromium, devices } from 'playwright';
import { mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const target = process.argv[2] || 'desktop';
const stepPx = +(process.argv[3] || 12);
const url = process.env.URL || 'http://localhost:5199/?capture';
const opts = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  mobile: { ...devices['iPhone 13'], deviceScaleFactor: 2 },
}[target];
const dir = `shots/rec/${target}`;
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
mkdirSync('recordings', { recursive: true });

const browser = await chromium.launch();
const page = await (await browser.newContext(opts)).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => document.querySelectorAll('img[loading=lazy]').forEach((i) => (i.loading = 'eager')));
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1500);
const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
let i = 0;
for (let y = 0; ; y += stepPx) {
  const yy = Math.min(y, total);
  await page.evaluate((v) => new Promise((r) => { window.scrollTo(0, v); requestAnimationFrame(() => requestAnimationFrame(r)); }), yy);
  await page.screenshot({ path: `${dir}/${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
  i++;
  if (yy >= total) break;
}
await browser.close();
console.log(target, 'frames:', i, 'scroll px:', total, 'step:', stepPx, 'errors:', errors.length ? errors : 'none');
const out = `recordings/enoki-scroll-${target}.mp4`;
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '60', '-i', `${dir}/%05d.jpg`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '21', '-movflags', '+faststart', out]);
console.log('wrote', out);
