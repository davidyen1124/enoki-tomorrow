import './style.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

// ?capture: no smoothing, no free-running animation, so every scroll position renders one exact frame
const CAPTURE = new URLSearchParams(location.search).has('capture');
if (CAPTURE) document.documentElement.classList.add('is-capture');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SCRUB = CAPTURE ? true : 0.6;

const stage = $('.stage');
const journey = $('.journey');
const nav = $('.nav');
const chapterEl = $('[data-chapter]');

/* ------------------------------------------------------------------
   Timeline map (units). One unit of timeline = PXU of a screen of scroll.
------------------------------------------------------------------ */
const PXU = 0.09;
const T = {
  cover: 0, farm: 9, cards: 22, grow: 44, harvest: 77, store: 90, prep: 110,
  pot: 128, eat: 144, fall: 164, stomach: 171, gut: 200, loo: 236, end: 277,
};
journey.style.height = `calc(100lvh * ${1 + T.end * PXU})`;

// [starts at, phone label, desktop label, dark nav?]
const CHAPTERS = [
  [0, 'The Round Trip Issue', 'The Round Trip Issue', false],
  [T.farm + 2, '01 · Farm', '01 · The Farm · Day 0', true],
  [T.grow + 1, '02 · The Wait', '02 · The Wait · Day 1–50', true],
  [T.harvest, '03 · Harvest', '03 · The Harvest · Day 50', true],
  [T.store, '04 · Store', '04 · The Store · Day 52', false],
  [T.prep + 2, '05 · The Pot', '05 · The Pot · 19:04', true],
  [T.eat + 4, '06 · Mouth', '06 · The Mouth · 19:06', true],
  [T.stomach - 3, '07 · Stomach', '07 · The Stomach · 19:07', true],
  [T.gut + 2, '08 · Intestine', '08 · The Small Intestine · 21:30', false],
  [T.loo + 1, '09 · Reunion', '09 · The Reunion · 07:15', false],
];
const wide = window.matchMedia('(min-width: 820px) and (min-aspect-ratio: 1/1)');
let chapterIndex = -1;
let finaleOn = false;
function setChapter(i) {
  if (i === chapterIndex) return;
  chapterIndex = i;
  const c = i === 'fin' ? [0, '10 · Tomorrow', '10 · Tomorrow · Same time', false] : CHAPTERS[i];
  chapterEl.textContent = wide.matches ? c[2] : c[1];
  nav.classList.toggle('is-dark', c[3]);
}
setChapter(0);

/* ------------------------------------------------------------------
   Intro (on load, not scroll-linked)
------------------------------------------------------------------ */
if (!reduce && !CAPTURE) {
  gsap.from('.cover__mast span', { yPercent: 40, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.06, delay: 0.1 });
  gsap.from('.cover__strap, .cover__deck > *', { y: 24, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.07, delay: 0.35 });
  gsap.from('.cover__lines li', { x: 30, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.06, delay: 0.5 });
  gsap.from('.cover__cjk', { opacity: 0, duration: 1, delay: 0.9 });
  // scale only: the scroll timeline animates x/y/rotation/alpha on the sticker, never scale
  gsap.from('.sticker--cover', { scale: 0, duration: 0.7, ease: 'back.out(2.5)', delay: 0.8 });
}

/* ------------------------------------------------------------------
   THE JOURNEY: one sticky stage, one scrubbed master timeline.
   Rebuilt from scratch whenever the layout width changes, so every
   pixel measurement below is a plain number.
------------------------------------------------------------------ */
let master;

function build() {
  if (master) {
    master.scrollTrigger.kill();
    master.kill();
    gsap.set('.stage *', { clearProps: 'all' });
  }
  const desktop = wide.matches;
  const SW = stage.offsetWidth;
  const SH = stage.offsetHeight;

  // a landmark on a plate (its --tx/--ty etc. are % of the photo) → stage pixels
  const mark = (plate, kx = '--tx', ky = '--ty', scale = 1, ox = 0) => {
    const cs = getComputedStyle(plate);
    let dx = (parseFloat(cs.getPropertyValue(kx)) / 100 - 0.5) * plate.offsetWidth * scale;
    let dy = (parseFloat(cs.getPropertyValue(ky)) / 100 - 0.5) * plate.offsetHeight * scale;
    const rot = parseFloat(cs.getPropertyValue('--rot')) || 0;
    if (rot) {
      const r = (rot * Math.PI) / 180;
      [dx, dy] = [dx * Math.cos(r) - dy * Math.sin(r), dx * Math.sin(r) + dy * Math.cos(r)];
    }
    return { x: SW / 2 + ox + dx, y: SH / 2 + dy, rot };
  };

  const tl = gsap.timeline({
    defaults: { ease: 'none', duration: 1 },
    scrollTrigger: {
      trigger: journey,
      start: 'top top',
      end: 'bottom bottom',
      scrub: SCRUB,
      onUpdate(self) {
        if (finaleOn) return;
        const t = self.progress * T.end;
        let idx = 0;
        CHAPTERS.forEach(([at], i) => { if (t >= at) idx = i; });
        setChapter(idx);
      },
    },
  });
  master = tl;

  const inn = (el, at, from = { y: 40 }, dur = 3) =>
    tl.fromTo(el, { autoAlpha: 0, ...from }, { autoAlpha: 1, y: 0, x: 0, ...('scale' in from ? { scale: 1 } : {}), duration: dur, ease: 'power2.out' }, at);
  const out = (el, at, to = { y: -40 }, dur = 2) =>
    tl.to(el, { autoAlpha: 0, ...to, duration: dur, ease: 'power2.in' }, at);
  const show = (el, at) => tl.set(el, { autoAlpha: 1 }, at);
  const hide = (el, at) => tl.set(el, { autoAlpha: 0 }, at);

  // desktop: copy panels sit left, vertically centred
  if (desktop) gsap.set(['.copy--farm', '.copy--grow', '.copy--harvest', '.copy--store', '.copy--prep', '.copy--pot', '.copy--stomach', '.copy--why', '.copy--loo', '.copy--normal', '.label', '.stats'], { yPercent: -50 });

  /* ================= 0 · COVER ================= */
  let t = T.cover;
  tl.to(['.cover__deck', '.cover__lines', '.cover__cjk'], { autoAlpha: 0, y: -30, duration: 3, ease: 'power2.in' }, t + 0.4);
  tl.to('.sticker--cover', { x: SW * 0.5, y: -SH * 0.3, rotation: 50, autoAlpha: 0, duration: 4, ease: 'power2.in' }, t + 0.8);
  $$('.cover__mast span').forEach((s, i) => tl.to(s, { xPercent: (i - 2) * 26, duration: 10 }, t));
  tl.to('.cover__mast', { y: SH * 0.14, duration: 12 }, t);
  tl.to('.cover__bunch', { scale: 1.22, y: SH * 0.2, duration: 12 }, t);
  // the cover lifts like a page; the farm is already waiting underneath
  tl.to('.cover', { yPercent: -100, duration: 9, ease: 'power2.inOut' }, t + 3);
  hide('.cover', t + 12);

  /* ================= 01 · THE FARM ================= */
  t = T.farm;
  tl.fromTo('.plate--farm', { scale: 1.04 }, { scale: 1.42, duration: T.store - 2, ease: 'none' }, 2);
  tl.fromTo('.shade--farm', { opacity: 0 }, { opacity: 1, duration: 4 }, t - 3);
  inn('.copy--farm', t + 0.5);
  out('.copy--farm', T.cards - 2.5);

  t = T.cards;
  inn('.copy--recipe', t, { y: 30 });
  show('.cards', t);
  $$('.card-ph').forEach((c, i) => {
    const depth = [1, 1.5, 0.8, 1.3][i];
    const r0 = parseFloat(getComputedStyle(c).getPropertyValue('--r')) || 0;
    tl.fromTo(c, { y: SH * 0.9 * depth, rotation: r0 + (i % 2 ? 14 : -14) }, { y: 0, rotation: r0, duration: 5, ease: 'power3.out' }, t + 0.5 + i * 0.7);
    tl.to(c, { y: -SH * 0.04 * depth, duration: 9 }, t + 7);
    tl.to(c, { y: -SH * 1.1 * depth, rotation: r0 + (i % 2 ? -10 : 10), duration: 3.5, ease: 'power2.in' }, t + 16 + i * 0.3);
  });
  out('.copy--recipe', t + 16.5);
  hide('.cards', t + 21.5);

  /* ================= 02 · THE WAIT ================= */
  t = T.grow;
  tl.fromTo('.shade--dim', { opacity: 0 }, { opacity: 1, duration: 4 }, t - 1);
  const crop = $('.bottle__crop');
  gsap.set(crop, { scaleY: 0.02 });
  tl.fromTo('.bottle', { autoAlpha: 0, y: SH * 0.9 }, { autoAlpha: 1, y: 0, duration: 5, ease: 'power3.out' }, t);
  inn('.copy--grow', t + 1.5);
  inn('.meter', t + 3, desktop ? { x: 40, y: 0 } : { x: -30, y: 0 });
  if (!desktop) out('.copy--grow', t + 4.4);

  // days 0 → 50, one proxy drives the mushrooms, the read-outs and nothing else
  const G0 = t + 7, G1 = t + 29;
  const dayEl = $('[data-day]'), tempEl = $('[data-temp]'), cmEl = $('[data-cm]');
  const growth = (d) => (d < 25 ? 0.02 : d < 33 ? lerp(0.02, 0.13, Math.pow((d - 25) / 8, 1.6)) : lerp(0.13, 1, (d - 33) / 17));
  const grow = { d: 0 };
  tl.to(grow, {
    d: 50, duration: G1 - G0,
    onUpdate() {
      const d = grow.d;
      const g = growth(d);
      gsap.set(crop, { scaleY: g });
      dayEl.textContent = String(Math.round(d)).padStart(2, '0');
      tempEl.textContent = Math.round(d < 25 ? 20 : d < 28 ? lerp(20, 14, (d - 25) / 3) : d < 33 ? 14 : d < 37 ? lerp(14, 5, (d - 33) / 4) : 5);
      cmEl.textContent = Math.round(((g - 0.02) / 0.98) * 14);
    },
  }, G0);
  const dayAt = (d) => G0 + ((G1 - G0) * d) / 50;
  const phase = (i, from, to) => {
    const el = $(`.phase[data-phase="${i}"]`);
    tl.fromTo(el, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 1.4, ease: 'power2.out' }, from);
    tl.to(el, { autoAlpha: 0, y: -16, duration: 1, ease: 'power2.in' }, to);
  };
  show('.phases', G0 - 0.5);
  phase(0, G0 - 0.3, dayAt(25) - 1.2);
  phase(1, dayAt(25), dayAt(33) - 1);
  phase(2, dayAt(33) + 0.2, T.harvest - 1.5);
  hide('.phases', T.harvest);

  /* ================= 03 · THE HARVEST ================= */
  t = T.harvest;
  if (desktop) out('.copy--grow', t - 2);
  out('.meter', t, desktop ? { x: 40 } : { x: -30 }, 1.5);
  inn('.copy--harvest', t + 0.5);
  // the bottle drops away, the bunch stays in the air…
  tl.to('.bottle__jar', { y: SH * 0.75, rotation: 9, duration: 4.5, ease: 'power2.in' }, t + 0.5);
  tl.to('.bottle__jar', { autoAlpha: 0, duration: 1.6 }, t + 2.6);
  // …and a bag slides up over it
  const pack = $('.pack');
  const bottle = $('.bottle');
  tl.to(crop, { y: SH * 0.03, duration: 5, ease: 'power1.inOut' }, t + 1);
  tl.fromTo(pack, { autoAlpha: 0, clipPath: 'inset(100% -40% -40% -40%)' }, { autoAlpha: 1, clipPath: 'inset(-40% -40% -40% -40%)', duration: 4, ease: 'power2.inOut' }, t + 4.5);
  tl.to(bottle, { autoAlpha: 0, duration: 1.6 }, t + 6.6);
  out('.copy--harvest', T.store - 5);

  /* ================= 04 · THE STORE ================= */
  t = T.store;
  show('.plate--store', t - 3.5);
  tl.fromTo('.plate--store', { opacity: 0, scale: 1.14 }, { opacity: 1, scale: 1, duration: 5.5, ease: 'power1.out' }, t - 3.5);
  tl.fromTo('.shade--store', { opacity: 0 }, { opacity: 1, duration: 4 }, t - 3);
  tl.to(['.shade--farm', '.shade--dim'], { opacity: 0, duration: 3 }, t - 3);
  hide('.plate--farm', t + 2);
  tl.to('.plate--store', { scale: 1.08, duration: 18 }, t + 2);
  inn('.copy--store', t + 1);
  tl.fromTo('.tag', { autoAlpha: 0, scale: 0, rotation: -30 }, { autoAlpha: 1, scale: 1, rotation: 9, duration: 1.6, ease: 'back.out(2.2)' }, t + 2.5);
  tl.fromTo(pack, { y: 0, rotation: 0 }, { y: -SH * 0.015, rotation: -2.5, duration: 16, ease: 'sine.inOut', immediateRender: false }, t + 1);
  if (desktop) {
    inn('.label', t + 6, { x: 50, y: 0 });
    out('.copy--store', T.prep - 3);
  } else {
    out('.copy--store', t + 7.5);
    inn('.label', t + 9.5);
  }
  out('.label', T.prep - 3, desktop ? { x: 50 } : { y: 40 });
  tl.to('.tag', { autoAlpha: 0, scale: 0.4, rotation: 40, duration: 1.4, ease: 'power2.in' }, T.prep - 2.5);

  /* ================= 05 · THE POT ================= */
  t = T.prep;
  const pot = $('.plate--pot');
  const potX = desktop ? SW * 0.075 : 0;
  const potS = desktop ? 1 + (2 * potX) / pot.offsetWidth + 0.01 : 1;
  gsap.set(pot, { x: potX });
  show(pot, t - 3);
  const rot0 = parseFloat(getComputedStyle(pot).getPropertyValue('--rot')) || 0; // phones lay the flat-lay on its side
  tl.fromTo(pot, { opacity: 0, scale: potS * 1.5, rotation: rot0 - 8 }, { opacity: 1, scale: potS, rotation: rot0, duration: 11, ease: 'power2.out' }, t - 3);
  tl.fromTo('.shade--pot', { opacity: 0 }, { opacity: 1, duration: 4 }, t - 2);
  tl.to('.shade--store', { opacity: 0, duration: 3 }, t - 2);
  hide('.plate--store', t + 3);

  // the bag comes off
  const bunch = $('.bunch');
  gsap.set(bunch, { transformOrigin: '50% 40%' });
  tl.to(pack, { autoAlpha: 0, scale: 1.06, duration: 2.2, ease: 'power1.in' }, t - 2);
  tl.fromTo(bunch, { autoAlpha: 0, scale: 0.9 }, { autoAlpha: 1, scale: 1, duration: 2.4, ease: 'power2.out' }, t - 1.2);
  inn('.copy--prep', t + 1.5);

  // the haircut: a blade of light, then the woody base drops off
  const cutAt = t + 5.2;
  show('.blade', cutAt);
  tl.fromTo('.blade__line', { clipPath: 'inset(-40px 100% -40px 0)' }, { clipPath: 'inset(-40px 0% -40px 0)', duration: 2.2, ease: 'power2.inOut' }, cutAt);
  tl.fromTo('.blade__spark', { left: '0%' }, { left: '100%', duration: 2.2, ease: 'power2.inOut' }, cutAt);
  tl.set('.bunch__all', { clipPath: 'inset(-30% -30% 20% -30%)' }, cutAt + 2.2);
  tl.set('.bunch__base', { opacity: 1 }, cutAt + 2.2);
  tl.to('.blade', { autoAlpha: 0, duration: 1 }, cutAt + 2.3);
  tl.to('.bunch__base', { y: SH * 0.7, rotation: 28, duration: 4, ease: 'power2.in' }, cutAt + 2.4);
  tl.to('.bunch__base', { opacity: 0, duration: 1 }, cutAt + 5.4);
  out('.copy--prep', t + 11.5);

  // …and in it goes, landing where the second photo has it cooking
  const land = mark(pot, '--tx', '--ty', potS, potX);
  const bunchCx = bunch.offsetLeft + bunch.offsetWidth / 2;
  const bunchCy = bunch.offsetTop + bunch.offsetHeight * 0.4;
  const potScale = (0.27 * pot.offsetWidth * potS) / (bunch.offsetHeight * 0.8);
  const flyAt = t + 10.5;
  tl.to(bunch, { x: land.x - bunchCx, y: land.y - bunchCy, rotation: -48 + land.rot, scale: potScale, duration: 6.5, ease: 'power2.inOut' }, flyAt);
  const splashAt = flyAt + 6.2;
  gsap.set('.splash', { x: land.x, y: land.y });
  $$('.splash i').forEach((r, i) => {
    const k = (0.2 * pot.offsetWidth * potS) / 120; // rings sized to the bunch, not the screen
    tl.fromTo(r, { scale: k * 0.3, opacity: 0 }, { scale: k * (0.9 + i * 0.3), opacity: 0.9, duration: 0.7, ease: 'power1.out' }, splashAt + i * 0.5);
    tl.to(r, { scale: k * (1.5 + i * 0.4), opacity: 0, duration: 1.6, ease: 'power1.out' }, splashAt + 0.7 + i * 0.5);
  });
  tl.to('.pot__b', { opacity: 1, duration: 1.6 }, splashAt);
  tl.to(bunch, { autoAlpha: 0, duration: 1.2 }, splashAt + 0.2);

  t = T.pot;
  inn('.copy--pot', t + 1);
  tl.to(pot, { scale: potS * 1.07, duration: T.eat + 6 - t }, t);
  out('.copy--pot', T.eat - 3);

  /* ================= 06 · THE MOUTH ================= */
  t = T.eat;
  const chop = $('.chop');
  gsap.set(chop, { x: potX * 0.6, transformOrigin: '30% 30%' });
  tl.fromTo(chop, { autoAlpha: 0, y: SH * 0.75, scale: 0.7, rotation: -6 }, { autoAlpha: 1, y: 0, scale: 1, rotation: 0, duration: 4.5, ease: 'power2.out' }, t - 2.5);
  const diner = $('.plate--diner');
  // the bite leaves through the top of the frame; the diner is who it was heading for
  tl.to(chop, { y: -SH * 1.05, x: potX * 0.6 + SW * 0.1, scale: 1.3, duration: 3.6, ease: 'power2.in' }, t + 2);
  hide(chop, t + 5.7);
  show(diner, t + 3.4);
  tl.fromTo(diner, { opacity: 0, scale: 1.16 }, { opacity: 1, scale: 1, duration: 4.2, ease: 'power1.out' }, t + 3.4);
  tl.fromTo('.shade--diner', { opacity: 0 }, { opacity: 1, duration: 3 }, t + 4);
  tl.to('.shade--pot', { opacity: 0, duration: 2 }, t + 5);
  hide(pot, t + 7.6);
  inn('.copy--eat', t + 6);
  const chews = { n: 0 };
  const chewEl = $('[data-chews]');
  tl.to(chews, { n: 3, duration: 4, ease: 'steps(3)', onUpdate: () => (chewEl.textContent = Math.round(chews.n)) }, t + 9);
  tl.fromTo('.chew__gulp', { opacity: 0, scale: 2.2 }, { opacity: 1, scale: 1, duration: 0.9, ease: 'back.out(2)' }, t + 13.4);
  out('.copy--eat', T.fall - 4.5);
  tl.to('.shade--diner', { opacity: 0, duration: 2 }, T.fall - 4);
  // straight down the hatch: zoom on the mouth until the screen is throat
  tl.to(diner, { scale: 16, duration: 6.5, ease: 'power3.in' }, T.fall - 4.5);

  /* ================= THE FALL ================= */
  t = T.fall;
  tl.fromTo('.gullet', { autoAlpha: 0 }, { autoAlpha: 1, duration: 2 }, t);
  hide(diner, t + 2.1);
  $$('.gullet span').forEach((r, i) => tl.fromTo(r, { scale: 0.03 }, { scale: 3.6, duration: 6, ease: 'power2.in' }, t - 3 + i * 1.25));
  inn('.fall', t + 1.6, { y: 0, scale: 0.8 }, 1.5);
  out('.fall', t + 4.6, { scale: 1.3 }, 1.4);

  /* ================= 07 · THE STOMACH ================= */
  t = T.stomach;
  const stomach = $('.plate--stomach');
  const sS = 1.06;
  show(stomach, t - 2);
  tl.fromTo(stomach, { '--m': '0%', scale: 1.3 }, { '--m': '100%', scale: sS, duration: 5, ease: 'power1.out' }, t - 2);
  hide('.gullet', t + 3.2);
  tl.fromTo('.shade--stomach', { opacity: 0 }, { opacity: 1, duration: 3 }, t);

  const sIn = mark(stomach, '--inx', '--iny', sS);
  const sFloat = mark(stomach, '--tx', '--ty', sS);
  const sOut = mark(stomach, '--outx', '--outy', sS);
  const sEl = $('.strands--stomach');
  const sScale = desktop ? 0.9 : 0.85;
  tl.fromTo(sEl, { autoAlpha: 0, x: SW / 2, y: SH * 0.5, scale: 0.25, rotation: -140 }, { autoAlpha: 1, scale: sScale * 0.8, rotation: -40, duration: 3.4, ease: 'power1.out' }, t - 3.4);
  tl.to(sEl, { x: sFloat.x, y: sFloat.y, scale: sScale, rotation: 62, duration: 4, ease: 'power2.in' }, t);
  // bobbing in the acid like a pool float
  const bobAt = t + 4;
  tl.to(sEl, { keyframes: { y: [sFloat.y, sFloat.y - SH * 0.02, sFloat.y + SH * 0.008, sFloat.y - SH * 0.014, sFloat.y + SH * 0.006, sFloat.y - SH * 0.01, sFloat.y], rotation: [62, 74, 58, 70, 60, 68, 64], x: [sFloat.x, sFloat.x + SW * 0.012, sFloat.x - SW * 0.014, sFloat.x + SW * 0.01, sFloat.x - SW * 0.008, sFloat.x + SW * 0.006, sFloat.x], easeEach: 'sine.inOut' }, duration: 21 }, bobAt);
  show('.bubbles', t);
  $$('.bubbles i').forEach((b, i) => {
    const speed = [1, 1.6, 0.7, 1.9, 1.2, 0.6, 1.5, 0.9][i];
    tl.fromTo(b, { y: 0 }, { y: -SH * 0.62 * speed, x: (i % 2 ? 1 : -1) * 14, opacity: 0, duration: 26, ease: 'none' }, t + (i % 4) * 0.8);
  });
  hide('.bubbles', T.gut + 2);
  tl.to(stomach, { scale: sS * 1.1, duration: T.gut - t - 3 }, t + 3);

  inn('.copy--stomach', t + 2);
  show('.stats', t + 5);
  $$('.stat').forEach((s, i) => {
    tl.fromTo(s, { y: SH * 0.5, rotation: i % 2 ? 9 : -9, autoAlpha: 0 }, { y: 0, rotation: desktop ? [-3, 2, -1.5][i] : 0, autoAlpha: 1, duration: 3, ease: 'back.out(1.4)' }, t + 5 + i * 0.9);
  });
  out('.copy--stomach', t + 14.5);
  tl.to('.stat', { autoAlpha: 0, y: -40, duration: 1.6, stagger: 0.25, ease: 'power2.in' }, t + 14.2);
  hide('.stats', t + 16.6);
  inn('.copy--why', t + 16.6, { y: 60 });
  out('.copy--why', T.gut - 3.4);
  // out through the exit
  tl.to(sEl, { x: sOut.x, y: sOut.y, scale: sScale * 0.35, rotation: 190, duration: 3.6, ease: 'power2.in' }, T.gut - 4);
  tl.to(sEl, { autoAlpha: 0, duration: 0.8 }, T.gut - 1.1);
  tl.to('.shade--stomach', { opacity: 0, duration: 2 }, T.gut - 1);

  /* ================= 08 · THE SMALL INTESTINE ================= */
  t = T.gut;
  const gut = $('.gut');
  const map = $('.gut__map');
  // The photo was generated from a layout guide (ref/gut-guide.png, 1536×1024); these are that guide's numbers,
  // so the route the enoki rides is the route the intestine was painted along.
  const k = map.offsetWidth / 1536;
  const G = { tw: 92, rows: 5, x0: 110, x1: 1426, y0: 150, y1: 874 };
  const sp = (G.y1 - G.y0) / (G.rows - 1);
  const R = sp / 2;
  const xr = G.x1 - G.tw / 2 - R, xl = G.x0 + G.tw / 2 + R;
  const n = (v) => +(v * k).toFixed(2);
  let d = `M ${n(G.x0 + G.tw / 2)},${n(G.y0)}`;
  for (let i = 0; i < G.rows; i++) {
    const y = G.y0 + i * sp;
    const even = i % 2 === 0;
    const xe = even ? xr : xl;
    d += ` H ${n(i === G.rows - 1 ? (even ? G.x1 - G.tw / 2 : G.x0 + G.tw / 2) : xe)}`;
    if (i < G.rows - 1) d += ` A ${n(R)} ${n(R)} 0 0 ${even ? 1 : 0} ${n(xe)},${n(y + sp)}`;
  }
  const track = $('.gut__track');
  const done = $('.gut__reveal');
  [track, done, $('.gut__trail')].forEach((p) => p.setAttribute('d', d));
  const tw = 112 * k; // the painted tube runs a little fatter than the guide
  done.setAttribute('stroke-width', n(40));
  const L = track.getTotalLength();
  gsap.set(done, { strokeDasharray: `0 ${L + 10}` });

  show(gut, t - 3);
  tl.fromTo(gut, { yPercent: 100 }, { yPercent: 0, duration: 4.5, ease: 'power2.inOut' }, t - 3);
  hide(stomach, t + 1.6);
  inn('.copy--gut', t + 1.5);
  inn('.checks', t + 2.5);

  const gEl = $('.strands--gut');
  const gScale = (tw * 1.5) / gEl.offsetWidth;
  const mx = map.offsetLeft, my = map.offsetTop;
  const odoEl = $('[data-odo]');
  const checks = $$('.checks li').map((li) => [li, +li.dataset.at]);
  const ride = { p: 0 };
  const place = () => {
    const p = ride.p;
    const a = track.getPointAtLength(p * L);
    const b = track.getPointAtLength(Math.min(L, p * L + 2));
    const c = track.getPointAtLength(Math.max(0, p * L - 2));
    const ang = (Math.atan2(b.y - c.y, b.x - c.x) * 180) / Math.PI;
    gsap.set(gEl, { x: mx + a.x, y: my + a.y, rotation: ang + 118, scale: gScale });
    done.style.strokeDasharray = `${p * L} ${L + 10}`;
    odoEl.textContent = (p * 6).toFixed(1);
    checks.forEach(([li, at]) => li.classList.toggle('is-on', p >= at));
  };
  place();
  const rideAt = t + 4, rideDur = 22;
  tl.fromTo(gEl, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1 }, rideAt - 1);
  tl.to(ride, { p: 1, duration: rideDur, ease: 'sine.inOut', onUpdate: place }, rideAt);
  tl.to(gEl, { autoAlpha: 0, duration: 1 }, rideAt + rideDur + 0.3);
  inn('.colon', rideAt + rideDur + 0.6, { y: 30 }, 2);
  out('.colon', T.loo - 4.5, { y: -20 }, 1.5);
  out('.copy--gut', T.loo - 4);
  out('.checks', T.loo - 4, { y: 30 });

  /* ================= 09 · THE REUNION ================= */
  t = T.loo;
  const loo = $('.plate--loo');
  const lS = 1.03;
  gsap.set(loo, { scale: lS });
  show(loo, t - 4);
  gsap.set(loo, { opacity: 1 });
  tl.to(gut, { yPercent: -100, duration: 4.5, ease: 'power2.inOut' }, t - 3.5);
  hide(gut, t + 1.1);
  tl.fromTo('.shade--loo', { opacity: 0 }, { opacity: 1, duration: 2 }, t - 2);
  const bowl = mark(loo, '--tx', '--ty', lS);
  const lEl = $('.strands--loo');
  const lScale = ((desktop ? 0.092 : 0.15) * loo.offsetWidth) / lEl.offsetWidth;
  gsap.set(lEl, { x: bowl.x, y: -SH * 0.6, scale: lScale * 2.4, rotation: -160 });
  show(lEl, t - 1.2);
  tl.to(lEl, { y: bowl.y, scale: lScale, rotation: 18, duration: 4.2, ease: 'power2.in' }, t - 1.2);
  gsap.set(['.ripples', '.swirl'], { x: bowl.x, y: bowl.y });
  const rip = (0.085 * loo.offsetWidth * (desktop ? 1 : 1.7)) / 120;
  $$('.ripples i').forEach((r, i) => {
    tl.fromTo(r, { scale: rip * 0.4, opacity: 0 }, { scale: rip * (1.2 + i * 0.5), opacity: 0.9, duration: 0.8, ease: 'power1.out' }, t + 3 + i * 0.55);
    tl.to(r, { scale: rip * (2 + i * 0.6), opacity: 0, duration: 2, ease: 'power1.out' }, t + 3.8 + i * 0.55);
  });
  tl.to(lEl, { rotation: 46, duration: 22, ease: 'sine.inOut' }, t + 3);

  inn('.copy--loo', t + 3);
  if (desktop) {
    inn('.review', t + 8, { x: 50, y: 0 });
    out('.copy--loo', t + 17);
    inn('.copy--normal', t + 19, { y: 60 });
    out('.review', t + 28, { x: 50 }, 1.6);
    out('.copy--normal', t + 28);
  } else {
    out('.copy--loo', t + 9);
    inn('.review', t + 11);
    out('.review', t + 18.5, { y: 40 });
    inn('.copy--normal', t + 20.5, { y: 60 });
    out('.copy--normal', t + 28, { y: 40 });
  }
  // the flush
  const flushAt = t + 29.5;
  inn('.flush', flushAt, { y: 16 }, 1.2);
  gsap.set('.swirl', { '--sw': `${Math.round(0.2 * loo.offsetWidth * (desktop ? 1 : 1.75))}px` });
  tl.fromTo('.swirl', { opacity: 0, rotation: 0, scale: 1.25 }, { opacity: 1, rotation: 360, scale: 1, duration: 3, ease: 'power1.in' }, flushAt + 1);
  tl.to('.swirl', { rotation: 1260, scale: 0.55, duration: 5.4, ease: 'none' }, flushAt + 4);
  tl.to(lEl, { rotation: 46 + 1080, scale: 0, duration: 6.6, ease: 'power2.in' }, flushAt + 2.4);
  tl.to('.swirl', { opacity: 0, scale: 0.2, duration: 1.4 }, flushAt + 9.2);
  out('.flush', flushAt + 8, { y: 16 }, 1.4);
  tl.to({}, { duration: 0.01 }, T.end - 0.01);

  if (CAPTURE) window.__T = T;
}

/* ------------------------------------------------------------------
   Post-journey sections
------------------------------------------------------------------ */
$$('[data-speed]').forEach((el) => {
  const s = +el.dataset.speed;
  gsap.fromTo(el, { y: () => -s * window.innerHeight * 0.5 }, {
    y: () => s * window.innerHeight * 0.5,
    ease: 'none',
    scrollTrigger: { trigger: el.closest('section'), start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
  });
});
gsap.from('.finale__title span', {
  yPercent: 70, opacity: 0, stagger: 0.14, ease: 'power3.out',
  scrollTrigger: { trigger: '.finale', start: 'top 80%', end: 'top 15%', scrub: SCRUB },
});
gsap.from('.sticker--fin', {
  scale: 0, rotation: -80, ease: 'back.out(2)',
  scrollTrigger: { trigger: '.finale', start: 'top 45%', end: 'top 5%', scrub: SCRUB },
});
gsap.from('.facts li', {
  y: 50, opacity: 0, stagger: 0.12, ease: 'power2.out',
  scrollTrigger: { trigger: '.facts', start: 'top 92%', end: 'top 55%', scrub: SCRUB },
});
ScrollTrigger.create({ trigger: '.finale', start: 'top -6%', onEnter: () => nav.classList.add('is-done'), onLeaveBack: () => nav.classList.remove('is-done') });
ScrollTrigger.create({
  trigger: '.finale', start: 'top 55%',
  onEnter: () => { finaleOn = true; setChapter('fin'); },
  onLeaveBack: () => { finaleOn = false; chapterIndex = -1; setChapter(CHAPTERS.length - 1); },
});

// page progress bar
gsap.to('.nav__progress span', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

/* ------------------------------------------------------------------
   Buttons
------------------------------------------------------------------ */
const jumpTo = (unit) => {
  const st = master.scrollTrigger;
  window.scrollTo({ top: st.start + ((st.end - st.start) * unit) / T.end, behavior: reduce ? 'auto' : 'smooth' });
};
$('[data-skip]').addEventListener('click', (e) => { e.preventDefault(); jumpTo(T.loo + 6); });
$$('[data-again], .nav__logo').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); }));

/* ------------------------------------------------------------------
   Boot + rebuild on real layout changes (not mobile URL-bar resizes)
------------------------------------------------------------------ */
build();
let lastW = window.innerWidth, lastH = window.innerHeight, timer;
window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  const touch = window.matchMedia('(pointer: coarse)').matches;
  if (w === lastW && (touch || h === lastH)) return;
  lastW = w; lastH = h;
  clearTimeout(timer);
  timer = setTimeout(() => { chapterIndex = -1; build(); ScrollTrigger.refresh(); }, 180);
});
window.addEventListener('load', () => ScrollTrigger.refresh());
document.fonts?.ready.then(() => ScrollTrigger.refresh());
