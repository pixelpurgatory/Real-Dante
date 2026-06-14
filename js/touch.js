'use strict';
// ============================================================
// TouchUI — on-screen controls + multi-touch input for phones/tablets.
// Works in SCREEN (canvas-pixel) space so it can sit in the portrait control
// strip below the game band, or overlay the game in landscape. Inert on
// desktop: nothing shows until the screen is actually touched.
// ============================================================

const TouchUI = {
  active: false,
  touches: {},
  buttons: [],
  prevHeld: {},
  heldNow: {},

  // build button rects in CANVAS pixels for the current size/orientation
  layout() {
    const W = canvas.width, H = canvas.height;
    const b = [];
    if (!STAGE.portrait) {
      // landscape: overlay the corners of the full screen
      const u = H;
      const m = 0.04 * W;
      const by = H - 0.28 * u;
      const dcx = m + 0.17 * u;
      const g = 0.135 * u, R = 0.092 * u, r = 0.072 * u;
      b.push({ id: 'left',  x: dcx - g, y: by, r: R, icon: '◀' });
      b.push({ id: 'right', x: dcx + g, y: by, r: R, icon: '▶' });
      b.push({ id: 'up',    x: dcx, y: by - g, r: r, icon: '▲' });
      b.push({ id: 'down',  x: dcx, y: by + g, r: r, icon: '▼' });
      const ax = W - m - 0.12 * u, ay = H - 0.24 * u;
      b.push({ id: 'jump', x: ax,             y: ay,             r: 0.115 * u, icon: 'JUMP', col: '#6e8adc' });
      b.push({ id: 'atk',  x: ax - 0.225 * u, y: ay - 0.015 * u, r: 0.10 * u,  icon: 'HIT',  col: '#d86a6a' });
      b.push({ id: 'dash', x: ax - 0.17 * u,  y: ay - 0.235 * u, r: 0.082 * u, icon: 'DASH', col: '#6ec0c8' });
      b.push({ id: 'heal', x: ax + 0.02 * u,  y: ay - 0.27 * u,  r: 0.078 * u, icon: 'HEAL', col: '#cfa850' });
      b.push({ id: 'pause', x: W - 0.05 * u, y: 0.07 * u, r: 0.04 * u, icon: '❚❚' });
      b.push({ id: 'full',  x: W - 0.12 * u, y: 0.07 * u, r: 0.04 * u, icon: '⛶' });
    } else {
      // portrait: controls live in the strip below the game band
      const bandH = VH * STAGE.scale;
      const sH = Math.max(40, H - bandH);
      const cy = bandH + sH * 0.5;
      const u = W;
      const m = 0.05 * W;
      const dcx = m + 0.24 * u;
      const g = 0.13 * u, R = 0.10 * u, r = 0.085 * u;
      b.push({ id: 'left',  x: dcx - g, y: cy, r: R, icon: '◀' });
      b.push({ id: 'right', x: dcx + g, y: cy, r: R, icon: '▶' });
      b.push({ id: 'up',    x: dcx, y: cy - g, r: r, icon: '▲' });
      b.push({ id: 'down',  x: dcx, y: cy + g, r: r, icon: '▼' });
      const ax = W - m - 0.12 * u, ay = cy + 0.02 * u;
      b.push({ id: 'jump', x: ax,            y: ay,            r: 0.12 * u,  icon: 'JUMP', col: '#6e8adc' });
      b.push({ id: 'atk',  x: ax - 0.24 * u, y: ay,            r: 0.105 * u, icon: 'HIT',  col: '#d86a6a' });
      b.push({ id: 'dash', x: ax - 0.05 * u, y: ay - 0.24 * u, r: 0.085 * u, icon: 'DASH', col: '#6ec0c8' });
      b.push({ id: 'heal', x: ax - 0.26 * u, y: ay - 0.24 * u, r: 0.08 * u,  icon: 'HEAL', col: '#cfa850' });
      b.push({ id: 'pause', x: W - 0.08 * u, y: bandH + 0.10 * sH, r: 0.05 * u, icon: '❚❚' });
      b.push({ id: 'full',  x: 0.08 * u,     y: bandH + 0.10 * sH, r: 0.05 * u, icon: '⛶' });
      this.bandH = bandH;
    }
    this.buttons = b;
  },

  init() {
    this.layout();
    resizeHook = () => this.layout();
    const opts = { passive: false };
    canvas.addEventListener('touchstart', e => this.onTouch(e, 'start'), opts);
    canvas.addEventListener('touchmove',  e => this.onTouch(e, 'move'),  opts);
    canvas.addEventListener('touchend',   e => this.onTouch(e, 'end'),   opts);
    canvas.addEventListener('touchcancel',e => this.onTouch(e, 'end'),   opts);
  },

  toCanvas(t) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (t.clientX - r.left) / r.width * canvas.width,
      y: (t.clientY - r.top) / r.height * canvas.height,
    };
  },

  hitButton(x, y) {
    for (const btn of this.buttons) {
      const rr = btn.r * 1.18;
      if (dist2(x, y, btn.x, btn.y) <= rr * rr) return btn;
    }
    return null;
  },

  onTouch(e, phase) {
    e.preventDefault();
    if (!this.active) {
      this.active = true;
      this.layout();
      Fullscreen.request();   // Android Chrome/Brave: true fullscreen on a gesture
      WakeLock.request();
    }
    AudioSys.unlock();
    this.touches = {};
    for (const t of e.touches) this.touches[t.identifier] = this.toCanvas(t);

    // handle one-shot taps (start phase) for fullscreen toggle / menus
    if (phase === 'start' && e.changedTouches.length) {
      const v = this.toCanvas(e.changedTouches[0]);
      const hit = this.hitButton(v.x, v.y);
      if (hit && hit.id === 'full') { Fullscreen.toggle(); return; }
      const inMenu = (typeof Game === 'undefined') || Game.state !== 'play';
      if (inMenu) {
        Input.vpressed.confirm = true;
        Input.vheld = {}; this.heldNow = {}; this.prevHeld = {};
        return;
      }
      if (!hit) Input.vpressed.confirm = true;  // off-control tap also confirms
    }
    if ((typeof Game !== 'undefined') && Game.state !== 'play') return;
    this.apply();
  },

  apply() {
    const held = {};
    for (const id in this.touches) {
      const btn = this.hitButton(this.touches[id].x, this.touches[id].y);
      if (btn) held[btn.id] = true;
    }
    const map = { left:'left', right:'right', up:'up', down:'down', jump:'jump', heal:'heal', atk:'atk' };
    for (const k in map) Input.vheld[map[k]] = !!held[k];
    for (const k of ['jump', 'dash', 'pause']) {
      if (held[k] && !this.prevHeld[k]) Input.vpressed[k] = true;
    }
    this.prevHeld = held;
    this.heldNow = held;
  },

  portrait() { return STAGE.portrait; },

  draw() {
    if (!this.active) return;
    const g = ctx;
    g.save();
    // portrait: subtle hint above the controls
    if (STAGE.portrait) {
      g.globalAlpha = 0.5;
      g.fillStyle = '#9a8cb8';
      g.font = Math.round(canvas.width * 0.028) + 'px Georgia';
      g.textAlign = 'center';
      g.fillText('↻  rotate to landscape for a larger view', canvas.width / 2, this.bandH + canvas.width * 0.05);
      g.globalAlpha = 1;
    }
    g.lineWidth = Math.max(1.5, canvas.width * 0.002);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const btn of this.buttons) {
      const pressed = this.heldNow && this.heldNow[btn.id];
      const base = btn.col || '#b3a6d8';
      g.globalAlpha = pressed ? 0.55 : 0.26;
      g.fillStyle = base;
      g.beginPath(); g.arc(btn.x, btn.y, btn.r, 0, 7); g.fill();
      g.globalAlpha = pressed ? 0.95 : 0.6;
      g.strokeStyle = base;
      g.beginPath(); g.arc(btn.x, btn.y, btn.r, 0, 7); g.stroke();
      g.globalAlpha = 0.96;
      g.fillStyle = '#f4eeff';
      const big = btn.icon.length <= 1;
      g.font = Math.round(btn.r * (big ? 0.9 : 0.52)) + 'px Georgia';
      g.fillText(btn.icon, btn.x, btn.y + btn.r * 0.04);
    }
    g.restore();
    g.textBaseline = 'alphabetic';
    g.textAlign = 'left';
  },
};