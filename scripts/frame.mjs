// Screenshot exact timeline units (or px with "px:123") at full resolution.
// usage: node scripts/frame.mjs <desktop|mobile|small|laptop> <outDir> <unit> [unit…]
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
const [, , target, outDir, ...units] = process.argv;
const opts = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  laptop: { viewport: { width: 1280, height: 680 }, deviceScaleFactor: 1 },
  mobile: { ...devices['iPhone 13'], deviceScaleFactor: 2 },
  small: { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  tablet: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  landscape: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  wide: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
}[target];
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await (await browser.newContext(opts)).newPage();
await page.goto(process.env.URL || 'http://localhost:5199/?capture', { waitUntil: 'networkidle' });
await page.evaluate(() => document.querySelectorAll('img[loading=lazy]').forEach((i) => (i.loading = 'eager')));
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1000);
const perUnit = await page.evaluate(() => (document.querySelector('.journey').offsetHeight - innerHeight) / window.__T.end);
for (const u of units) {
  const y = u.startsWith('px:') ? +u.slice(3) : Math.round(+u * perUnit);
  await page.evaluate((v) => window.scrollTo(0, v), y);
  await page.waitForTimeout(180);
  await page.screenshot({ path: `${outDir}/${target}_${u.replace(':', '')}.png` });
}
await browser.close();
