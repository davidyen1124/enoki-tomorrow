// Chroma-key a magenta studio backdrop to real alpha (with colour un-mixing so edges carry no pink spill).
// usage: node scripts/key.mjs assets-src/gen/foo.png [assets-src/gen/foo-cut.png]
import sharp from 'sharp';

const src = process.argv[2];
const out = process.argv[3] || src.replace(/\.png$/, '-cut.png');

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h } = info;
const px = (x, y) => (y * w + x) * 4;

// key colour = median of a border ring
const ring = [];
for (let x = 0; x < w; x += 4) for (const y of [2, h - 3]) ring.push(px(x, y));
for (let y = 0; y < h; y += 4) for (const x of [2, w - 3]) ring.push(px(x, y));
const med = (c) => ring.map((i) => data[i + c]).sort((a, b) => a - b)[ring.length >> 1];
const K = [med(0), med(1), med(2)];
const km = Math.min(K[0], K[2]) - K[1]; // "magenta-ness" of the backdrop
console.log('key', K, 'magenta-ness', km);

const LO = 0.06, HI = 0.9; // fraction of backdrop magenta-ness: below = opaque, above = transparent
for (let i = 0; i < data.length; i += 4) {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  const m = (Math.min(r, b) - g) / km;
  let t = (m - LO) / (HI - LO); // 0 = subject, 1 = backdrop
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const a = 1 - t;
  if (a <= 0.02) { data[i + 3] = 0; continue; }
  if (t > 0) {
    // un-mix: P = a*C + (1-a)*K  →  C = (P - (1-a)K) / a, then clamp any leftover magenta
    let cr = (r - t * K[0]) / a, cg = (g - t * K[1]) / a, cb = (b - t * K[2]) / a;
    const ex = Math.min(cr, cb) - cg;
    if (ex > 0) { cr -= ex; cb -= ex; }
    data[i] = Math.max(0, Math.min(255, cr));
    data[i + 1] = Math.max(0, Math.min(255, cg));
    data[i + 2] = Math.max(0, Math.min(255, cb));
  } else {
    const ex = Math.min(r, b) - g; // faint spill on opaque pixels
    if (ex > 6) { data[i] = r - ex * 0.8; data[i + 2] = b - ex * 0.8; }
  }
  // nothing in these subjects is genuinely pink/violet: blue above green is backdrop light bleeding through film or gloss
  if (!process.env.KEEP_PINK && data[i + 2] > data[i + 1]) {
    const ex2 = data[i + 2] - data[i + 1];
    data[i + 2] = data[i + 1];
    data[i] = Math.max(data[i + 1], data[i] - ex2 * 1.3);
  }
  data[i + 3] = Math.round(a * 255);
}
await sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toFile(out);
console.log('wrote', out);
