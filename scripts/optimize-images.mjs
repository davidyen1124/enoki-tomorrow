// Trim + resize generated images from ./assets-src/gen into ./public/img as WebP.
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

mkdirSync('public/img', { recursive: true });

const jobs = [
  // cut-outs: shot on a chroma-key backdrop, keyed to alpha by scripts/key.mjs (assets-src/gen/*-cut.png), trimmed
  ['assets-src/gen/bunch-cut.png', 'bunch', { h: 1400, trim: true }],
  ['assets-src/gen/bottle-cut.png', 'bottle', { h: 1400, trim: true }],
  ['assets-src/gen/pack-cut.png', 'pack', { h: 1300, trim: true }],
  ['assets-src/gen/chopsticks-cut.png', 'chopsticks', { h: 1300, trim: true }],
  ['assets-src/gen/strands-cut.png', 'strands', { h: 800, trim: true }],
  // full-bleed plates
  ['assets-src/gen/farm-room.png', 'farm-room', { w: 1536, q: 76 }],
  ['assets-src/gen/store-shelf.png', 'store-shelf', { w: 1536, q: 72 }],
  ['assets-src/gen/hotpot.png', 'hotpot', { w: 1536, q: 78 }],
  ['assets-src/gen/hotpot-enoki.png', 'hotpot-enoki', { w: 1536, q: 78 }],
  ['assets-src/gen/diner.png', 'diner', { w: 1536, q: 78 }],
  ['assets-src/gen/stomach.png', 'stomach', { w: 1536, q: 80 }],
  ['assets-src/gen/toilet.png', 'toilet', { w: 1536, q: 78 }],
  ['assets-src/gen/intestine.png', 'intestine', { w: 1536, q: 82 }],
  // portrait plates for phones
  ['assets-src/gen/farm-room-p.png', 'farm-room-p', { w: 1024, q: 74 }],
  ['assets-src/gen/diner-p.png', 'diner-p', { w: 1024, q: 76 }],
  ['assets-src/gen/stomach-p.png', 'stomach-p', { w: 1024, q: 78 }],
  ['assets-src/gen/toilet-p.png', 'toilet-p', { w: 1024, q: 76 }],
  // photo cards
  ['assets-src/gen/card-wild.png', 'card-wild', { w: 720 }],
  ['assets-src/gen/card-substrate.png', 'card-substrate', { w: 720 }],
  ['assets-src/gen/card-mycelium.png', 'card-mycelium', { w: 720 }],
  ['assets-src/gen/card-pins.png', 'card-pins', { w: 720 }],
];

const manifest = {};
for (const [src, name, o] of jobs) {
  try {
    let img = sharp(src);
    if (o.trim) img = sharp(await img.trim({ threshold: 4 }).toBuffer());
    img = img.resize(o.w ? { width: o.w, withoutEnlargement: true } : { height: o.h, withoutEnlargement: true });
    const info = await img.webp({ quality: o.q ?? 82, alphaQuality: 92, effort: 5 }).toFile(`public/img/${name}.webp`);
    manifest[name] = { w: info.width, h: info.height, ar: +(info.width / info.height).toFixed(4), kb: Math.round(info.size / 1024) };
    console.log(name.padEnd(16), `${info.width}x${info.height}`, `ar ${manifest[name].ar}`, `${manifest[name].kb}KB`);
  } catch (e) {
    console.log('skip', name, e.message);
  }
}
writeFileSync('scripts/image-manifest.json', JSON.stringify(manifest, null, 2));
