'use strict';
// ============================================================
// TouchUI — analog movement stick + action buttons for phones/tablets.
// Screen-space (canvas-pixel) layout: fills landscape, sits in the control
// strip in portrait. Inert on desktop until the screen is first touched.
// ============================================================

const TouchUI = {
  active: false,
  touches: {},
  buttons: [],          // action buttons only (jump/atk/dash/heal/pause/full)
  stick: null,          // { x, y, r } movement base
  knob: null,           // { x, y, active } thumb position (for drawing)
  prevHeld: {},
  heldNow: {},
  bandH: 0,

  layout() {
    const W = canvas.width, H = canvas.height;
    const b = [];
    if (!STAGE.portrait) {
      // ---- landscape: overlay corners of the full screen ----
      const u = H, m = 0.045 * W;
      this.stick = { x: m + 0.16 * u, y: H - 0.21 * u, r: 0.135 * u };
      const ax = W - m - 0.13 * u, ay = H - 0.21 * u;
      b.push({ id: 'jump', x: ax,             y: ay,             r: 0.12 * u,  icon: 'JUMP', col: '#6e8adc' });
      b.push({ id: 'atk',  x: ax - 0.235 * u, y: ay - 0.01 * u,  r: 0.105 * u, icon: 'HIT',  col: '#d86a6a' });
      b.push({ id: 'dash', x: ax - 0.175 * u, y: ay - 0.245 * u, r: 0.085 * u, icon: 'DASH', col: '#6ec0c8' });
      b.push({ id: 'heal', x: ax + 0.02 * u,  y: ay - 0.285 * u, r: 0.082 * u, icon: 'HEAL', col: '#cfa850' });
      b.push({ id: 'pause', x: W - 0.055 * u, y: 0.08 * u, r: 0.045 * u, icon: '❚❚' });
      b.push({ id: 'full',  x: W - 0.175 * u, y: 0.08 * u, r: 0.062 * u, icon: '⛶' });
    } else {
      // ---- portrait: stick + actions in the strip below the game band ----
      const bandH = VH * STAGE.scale;
      const sH = Math.max(40, H - bandH);
      const cy = bandH + sH * 0.52;
      const u = W;
      this.stick = { x: 0.23 * W, y: cy, r: 0.16 * W };
      b.push({ id: 'jump', x: W - 0.17 * u, y: cy + 0.06 * u, r: 0.135 * u, icon: 'JUMP', col: '#6e8adc' });
      b.push({ id: 'atk',  x: W - 0.44 * u, y: cy + 0.06 * u, r: 0.115 * u, icon: 'HIT',  col: '#d86a6a' });
      b.push({ id: 'dash', x: W - 0.40 * u, y: cy - 0.20 * u, r: 0.095 * u, icon: 'DASH', col: '#6ec0c8' });
      b.push({ id: 'heal', x: W - 0.15 * u, y: cy - 0.22 * u, r: 0.09 * u,  icon: 'HEAL', col: '#cfa850' });
      b.push({ id: 'pause', x: W - 0.09 * u, y: bandH + 0.10 * sH, r: 0.055 * u, icon: '❚❚' });
      b.push({ id: 'full',  x: 0.09 * u,     y: bandH + 0.10 * sH, r: 0.07 * u,  icon: '⛶' });
      this.bandH = bandH;
    }
    this.buttons = b;
    if (!this.knob) this.knob = { x: this.stick.x, y: this.stick.y, active: false };
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

  inStick(p) {
    const s = this.stick, rr = s.r * 1.7;
    return dist2(p.x, p.y, s.x, s.y) <= rr * rr;
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
      Fullscreen.request();
      WakeLock.request();
    }
    AudioSys.unlock();
    this.touches = {};
    for (const t of e.touches) this.touches[t.identifier] = this.toCanvas(t);

    if (phase === 'start' && e.changedTouches.length) {
      const ct = e.changedTouches[0];
      const v = this.toCanvas(ct);
      const hit = this.hitButton(v.x, v.y);
      if (hit && hit.id === 'full') { Fullscreen.toggle(); return; }
      const inMenu = (typeof Game === 'undefined') || Game.state !== 'play';
      if (inMenu) {
        Input.setPointer(ct.clientX, ct.clientY);  // for menu hit-testing
        Input.vpressed.confirm = true;
        Input.vheld = {}; this.heldNow = {}; this.prevHeld = {};
        this.knob.active = false;
        return;
      }
      if (!hit && !this.inStick(v)) Input.vpressed.confirm = true;
    }
    if ((typeof Game !== 'undefined') && Game.state !== 'play') return;
    this.apply();
  },

  apply() {
    const held = {};
    let stickP = null;
    for (const id in this.touches) {
      const p = this.touches[id];
      if (this.inStick(p)) { if (!stickP) stickP = p; continue; }
      const btn = this.hitButton(p.x, p.y);
      if (btn) held[btn.id] = true;
    }
    // analog stick -> directional holds
    const s = this.stick;
    if (stickP) {
      let dx = stickP.x - s.x, dy = stickP.y - s.y;
      const len = Math.hypot(dx, dy) || 1;
      const cl = Math.min(len, s.r);
      this.knob.x = s.x + dx / len * cl;
      this.knob.y = s.y + dy / len * cl;
      this.knob.active = true;
      const hDead = s.r * 0.30, vDead = s.r * 0.52;
      if (dx < -hDead) held.left = true; else if (dx > hDead) held.right = true;
      if (dy < -vDead) held.up = true;  else if (dy > vDead) held.down = true;
    } else {
      this.knob.x = s.x; this.knob.y = s.y; this.knob.active = false;
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

    // movement stick: base ring + directional ticks + thumb knob
    const s = this.stick, k = this.knob;
    g.globalAlpha = 0.22;
    g.fillStyle = '#b3a6d8';
    g.beginPath(); g.arc(s.x, s.y, s.r, 0, 7); g.fill();
    g.globalAlpha = 0.5;
    g.strokeStyle = '#b3a6d8';
    g.beginPath(); g.arc(s.x, s.y, s.r, 0, 7); g.stroke();
    g.globalAlpha = 0.3;
    g.fillStyle = '#e8e0ff';
    const tk = s.r * 0.62;
    for (const d of [[-1,0],[1,0],[0,-1],[0,1]]) {
      g.beginPath();
      g.arc(s.x + d[0] * tk, s.y + d[1] * tk, s.r * 0.06, 0, 7);
      g.fill();
    }
    g.globalAlpha = k.active ? 0.85 : 0.55;
    g.fillStyle = '#d8cdf2';
    g.beginPath(); g.arc(k.x, k.y, s.r * 0.46, 0, 7); g.fill();
    g.globalAlpha = 0.9;
    g.strokeStyle = '#fff';
    g.beginPath(); g.arc(k.x, k.y, s.r * 0.46, 0, 7); g.stroke();

    // action buttons
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