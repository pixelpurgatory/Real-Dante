'use strict';
// ============================================================
// DANTE: The Descent — core utilities, input, constants
// ============================================================

// The game renders into a FIXED logical view (VW x VH). The physical canvas
// fills the whole screen; STAGE describes where/how that logical view is
// placed inside the canvas. Landscape: the view fills the canvas. Portrait:
// the view sits in a band at the top and touch controls live below it.
let VW = 960;                      // current logical view width
const VH = 540;                    // logical view height (fixed)
const VW_MIN = 760, VW_MAX = 1366; // clamp for the aspect-matched landscape width
const VW_BAKE = VW_MAX;            // background layers are baked this wide
const RENDER_CAP = 1600;           // max internal canvas dimension (perf budget)
const WORLD_W = 16800;             // total world width (village → ... → Purgatory)
const GRAV = 1500;
const KILL_Y = 720;                // fell into the abyss

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// placement of the logical view within the physical canvas (canvas pixels)
const STAGE = { scale: 1, ox: 0, oy: 0, portrait: false, viewH: VH };

// optional hook other modules register to react to a viewport change
let resizeHook = null;

// fit canvas to the viewport. Internal resolution fills the screen (capped for
// performance); the logical VW x VH view is centered/scaled inside it.
function fitCanvas() {
  const cssW = Math.max(1, window.innerWidth), cssH = Math.max(1, window.innerHeight);
  let rw = cssW, rh = cssH;
  const big = Math.max(rw, rh);
  if (big > RENDER_CAP) { const k = RENDER_CAP / big; rw = Math.round(rw * k); rh = Math.round(rh * k); }
  canvas.width = rw;
  canvas.height = rh;
  ctx.imageSmoothingEnabled = false; // reset — resizing the canvas clears state
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';

  const portrait = cssH > cssW;
  STAGE.portrait = portrait;
  if (!portrait) {
    // landscape: match the view width to the aspect ratio so it fills exactly
    VW = Math.round(VH * rw / rh);
    if (VW < VW_MIN) VW = VW_MIN;
    if (VW > VW_MAX) VW = VW_MAX;
    const scale = Math.min(rw / VW, rh / VH);
    STAGE.scale = scale;
    STAGE.ox = Math.round((rw - VW * scale) / 2);
    STAGE.oy = Math.round((rh - VH * scale) / 2);
  } else {
    // portrait: standard landscape view in a band at the top; controls below
    VW = 960;
    const scale = rw / VW;             // fit to width
    STAGE.scale = scale;
    STAGE.ox = 0;
    STAGE.oy = 0;
  }
  if (resizeHook) resizeHook();
}
window.addEventListener('resize', fitCanvas);
window.addEventListener('orientationchange', () => setTimeout(fitCanvas, 120));
if (window.visualViewport) window.visualViewport.addEventListener('resize', fitCanvas);
fitCanvas();

// ---------- fullscreen + screen wake lock (best-effort, all guarded) ----------
const Fullscreen = {
  el() { return (typeof document !== 'undefined' && document.documentElement) || null; },
  supported() { const e = this.el(); return !!(e && (e.requestFullscreen || e.webkitRequestFullscreen)); },
  active() { return typeof document !== 'undefined' && !!(document.fullscreenElement || document.webkitFullscreenElement); },
  request() {
    if (!this.supported() || this.active()) return;
    const e = this.el();
    try { (e.requestFullscreen || e.webkitRequestFullscreen).call(e); } catch (err) {}
  },
  toggle() {
    if (this.active()) {
      try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (err) {}
    } else { this.request(); }
  },
};

const WakeLock = {
  lock: null,
  request() {
    try {
      if (typeof navigator !== 'undefined' && navigator.wakeLock && !this.lock) {
        navigator.wakeLock.request('screen').then(l => { this.lock = l; l.addEventListener && l.addEventListener('release', () => { this.lock = null; }); }).catch(() => {});
      }
    } catch (e) {}
  },
};
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') WakeLock.request();
  });
}

// ---------- math helpers ----------
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const sign = v => v < 0 ? -1 : 1;
const dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// true when the player is descending onto the top of a target (a "stomp"),
// so they should NOT take contact damage from it
function isStomp(pl, r) {
  return pl.vy > 30 && (pl.y + pl.h) - r.y < r.h * 0.55;
}

// color lerp for palette blending: '#rrggbb'
function hexToRgb(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
function mixColor(c1, c2, t) {
  const a = hexToRgb(c1), b = hexToRgb(c2);
  return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
}

// ---------- input ----------
const Input = {
  keys: {},
  pressed: {},          // true only on the frame the key went down
  mouseDown: false,
  mousePressed: false,
  anyKey: false,
  // virtual (touch) input, merged into the accessors below
  vheld: {},            // action -> bool (held this frame)
  vpressed: {},         // action -> bool (went down this frame)

  init() {
    window.addEventListener('keydown', e => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!this.keys[e.code]) this.pressed[e.code] = true;
      this.keys[e.code] = true;
      this.anyKey = true;
      AudioSys.unlock();
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    canvas.addEventListener('mousedown', e => {
      if (e.button === 0) { this.mouseDown = true; this.mousePressed = true; }
      AudioSys.unlock();
    });
    window.addEventListener('mouseup', e => { if (e.button === 0) this.mouseDown = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.mouseDown = false; this.vheld = {}; });
  },

  endFrame() {
    this.pressed = {};
    this.mousePressed = false;
    this.anyKey = false;
    this.vpressed = {};
  },

  left()   { return this.keys['KeyA'] || this.keys['ArrowLeft']  || this.vheld.left; },
  right()  { return this.keys['KeyD'] || this.keys['ArrowRight'] || this.vheld.right; },
  up()     { return this.keys['KeyW'] || this.keys['ArrowUp']    || this.vheld.up; },
  down()   { return this.keys['KeyS'] || this.keys['ArrowDown']  || this.vheld.down; },
  jumpP()  { return this.pressed['Space'] || this.pressed['KeyZ'] || this.vpressed.jump; },
  jump()   { return this.keys['Space'] || this.keys['KeyZ'] || this.vheld.jump; },
  atkP()   { return this.pressed['KeyJ'] || this.pressed['KeyX'] || this.mousePressed || this.vheld.atk; },
  dashP()  { return this.pressed['ShiftLeft'] || this.pressed['ShiftRight'] || this.pressed['KeyC'] || this.pressed['KeyK'] || this.vpressed.dash; },
  heal()   { return this.keys['KeyF'] || this.keys['KeyH'] || this.vheld.heal; },
  pauseP() { return this.pressed['KeyP'] || this.pressed['Escape'] || this.vpressed.pause; },
  muteP()  { return this.pressed['KeyM']; },
  confirmP() { return this.pressed['Enter'] || this.pressed['Space'] || this.vpressed.confirm; },
  restartP() { return this.pressed['KeyR'] || this.vpressed.confirm; },
};
Input.init();

// ---------- tiny seeded rng for deterministic art ----------
function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
