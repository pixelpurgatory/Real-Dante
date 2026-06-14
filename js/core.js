'use strict';
// ============================================================
// DANTE: The Descent — core utilities, input, constants
// ============================================================

const VW = 960, VH = 540;          // internal resolution
const WORLD_W = 10800;             // total world width
const GRAV = 1500;
const KILL_Y = 720;                // fell into the abyss

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// fit canvas to window, integer-ish scale, keep aspect
function fitCanvas() {
  const ww = window.innerWidth, wh = window.innerHeight;
  const s = Math.min(ww / VW, wh / VH);
  canvas.style.width = Math.floor(VW * s) + 'px';
  canvas.style.height = Math.floor(VH * s) + 'px';
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

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
  atkP()   { return this.pressed['KeyJ'] || this.pressed['KeyX'] || this.mousePressed || this.vpressed.atk; },
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
