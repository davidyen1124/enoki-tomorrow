// Walk the whole page in small scroll steps and, at every step, measure every visible piece of text:
//  - no two text blocks may overlap
//  - no settled text may be cut off by the viewport
//  - the page may never scroll sideways
// usage: node scripts/audit.mjs [stepPx]      env: ONLY=desktop,mobile,small,laptop
import { chromium, devices } from 'playwright';

const url = process.env.URL || 'http://localhost:5199/?capture';
const stepPx = +(process.argv[2] || 24);
const targets = [
  { name: 'desktop', opts: { viewport: { width: 1440, height: 900 } } },
  { name: 'laptop', opts: { viewport: { width: 1280, height: 680 } } },
  { name: 'mobile', opts: { ...devices['iPhone 13'] } },
  { name: 'small', opts: { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true } },
  { name: 'tablet', opts: { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true } },
  { name: 'wide', opts: { viewport: { width: 1920, height: 1080 } } },
  { name: 'squat', opts: { viewport: { width: 1100, height: 560 } } },
  { name: 'landscape', opts: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } },
].filter((t) => (process.env.ONLY ? process.env.ONLY.split(',').includes(t.name) : true));

const browser = await chromium.launch();
let bad = 0;
for (const t of targets) {
  const page = await (await browser.newContext({ ...t.opts, deviceScaleFactor: 1 })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.querySelectorAll('img[loading=lazy]').forEach((i) => (i.loading = 'eager')));
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  const res = await page.evaluate(async (stepPx) => {
    const W = innerWidth, H = innerHeight;
    const perUnit = (document.querySelector('.journey').offsetHeight - H) / window.__T.end;
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    // text leaves: elements that directly own visible text
    const leaves = [...document.querySelectorAll('body *')].filter((el) => {
      if (el.closest('.ticker, .grain, svg, .cover__mast, [aria-hidden="true"]') && !el.closest('.cover__cjk')) return false;
      return [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
    });
    const name = (el) => {
      const host = el.closest('[data-copy], .nav, .cover, .finale, .recap, .foot, .tag, .gut__map') || el;
      const cls = (e) => (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : e.tagName.toLowerCase());
      return host === el ? cls(el) : `${cls(host)} ${cls(el)}:"${el.textContent.trim().slice(0, 18)}"`;
    };
    const alpha = (el) => {
      let a = 1;
      for (let e = el; e && e !== document.body; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.visibility === 'hidden' || cs.display === 'none') return 0;
        a *= +cs.opacity;
        if (a < 0.05) return 0;
      }
      return a;
    };
    const moving = '.card-ph, .stat, .tag, .sticker, .cover__mast, .review, .label, .colon';
    const issues = new Map();
    const note = (key, u, extra) => {
      const it = issues.get(key) || { from: u, to: u, n: 0, extra };
      it.to = u; it.n++; issues.set(key, it);
    };
    const total = document.documentElement.scrollHeight - H;
    let maxSide = 0, steps = 0;
    for (let y = 0; y <= total; y += stepPx) {
      window.scrollTo(0, y);
      await frame();
      steps++;
      const u = +(y / perUnit).toFixed(1);
      maxSide = Math.max(maxSide, document.documentElement.scrollWidth - W);
      const vis = [];
      for (const el of leaves) {
        const a = alpha(el);
        if (a < 0.6) continue;
        const range = document.createRange();
        range.selectNodeContents(el);
        const box = range.getBoundingClientRect();
        if (box.width < 2 || box.height < 2) continue;
        // a line box is taller than the ink it holds: trim to roughly cap-height/descender
        const fs = parseFloat(getComputedStyle(el).fontSize);
        const lines = Math.max(1, Math.round(box.height / (parseFloat(getComputedStyle(el).lineHeight) || fs * 1.2)));
        const trim = lines === 1 ? Math.min(fs * 0.2, box.height * 0.3) : fs * 0.12;
        const r = { left: box.left, right: box.right, top: box.top + trim, bottom: box.bottom - trim, width: box.width, height: box.height - 2 * trim };
        if (r.bottom < 0 || r.top > H || r.right < 0 || r.left > W) continue;
        vis.push({ el, r, a });
        // cut off by the viewport edge while fully settled (inside the pinned stage or nav only)
        const pinned = el.closest('.stage, .nav');
        if (pinned && a > 0.95 && !el.closest(moving) && !el.closest('.cover')) {
          const cut = Math.max(-r.left, r.right - W, -r.top, r.bottom - H);
          if (cut > 3) note(`CUT ${name(el)}`, u, `${Math.round(cut)}px`);
        }
      }
      for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
        const A = vis[i], B = vis[j];
        if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
        // tilted cards: axis-aligned boxes of their own lines always intersect a little
        const tilt = '.card-ph, .stat, .review, .label, .tag, .sticker, .colon';
        const ta = A.el.closest(tilt), tb = B.el.closest(tilt);
        if (ta && ta === tb) continue;
        // things in flight are allowed to pass the nav
        if ((A.el.closest('.nav') && tb && tb.matches('.card-ph, .stat, .tag')) || (B.el.closest('.nav') && ta && ta.matches('.card-ph, .stat, .tag'))) continue;
        const ha = A.el.closest('[data-copy], .nav, .cover, .finale, .recap, .foot, .tag');
        const hb = B.el.closest('[data-copy], .nav, .cover, .finale, .recap, .foot, .tag');
        // text flowing past the fixed nav in ordinary (non-pinned) sections is expected
        const navA = !!A.el.closest('.nav'), navB = !!B.el.closest('.nav');
        if (navA !== navB && !(navA ? B : A).el.closest('.stage')) continue;
        if (navA !== navB && (navA ? B : A).el.closest('.cover')) continue;
        const w = Math.min(A.r.right, B.r.right) - Math.max(A.r.left, B.r.left);
        const h = Math.min(A.r.bottom, B.r.bottom) - Math.max(A.r.top, B.r.top);
        if (w > 3 && h > 3) {
          if (ha === hb && ha && A.el.parentElement === B.el.parentElement && getComputedStyle(A.el).display.startsWith('inline')) continue;
          note(`OVERLAP ${name(A.el)}  ×  ${name(B.el)}`, u, `${Math.round(w)}x${Math.round(h)}`);
        }
      }
    }
    return { steps, maxSide, perUnit, issues: [...issues.entries()] };
  }, stepPx);
  console.log(`\n== ${t.name} ${t.opts.viewport.width}x${t.opts.viewport.height}: ${res.steps} positions checked, sideways overflow ${res.maxSide}px, js errors ${errors.length}`);
  for (const [k, v] of res.issues) { bad++; console.log(`  u${v.from}–u${v.to} (${v.n} frames) ${k}  [${v.extra}]`); }
  if (!res.issues.length) console.log('  clean');
  if (res.maxSide > 0 || errors.length) { bad++; console.log('  ', errors.join('; ')); }
  await page.close();
}
await browser.close();
console.log(bad ? `\n${bad} issue group(s)` : '\nall clean');
