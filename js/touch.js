'use strict';
// ============================================================
// TouchUI — on-screen controls + multi-touch input for phones/tablets.
// Inert on desktop: nothing shows until the screen is actually touched,
// so mouse+keyboard play is completely unaffected.
// ============================================================

const TouchUI = {
  active: false,           // becomes true on first touch
  touches: {},             // identifier -> {x,y} in virtual coords
  buttons: [],
  prevHeld: {},

  // layout is rebuilt for the current resolution (VW x VH is fixed here)
  layout() {
    const b = [];
    // movement d-pad (left side)
    const dpx = 96, dpy = VH - 92, R = 34, g = 46;
    b.push({ id: 'left',  shape: 'circ', x: dpx - g, y: dpy, r: R, icon: '◀' });
    b.push({ id: 'right', shape: 'circ', x: dpx + g, y: dpy, r: R, icon: '▶' });
    b.push({ id: 'up',    shape: 'circ', x: dpx, y: dpy - g, r: 30, icon: '▲' });
    b.push({ id: 'down',  shape: 'circ', x: dpx, y: dpy + g, r: 30, icon: '▼' });
    // action cluster (right side)
    const ax = VW - 80, ay = VH - 80;
    b.push({ id: 'jump', shape: 'circ', x: ax,       y: ay,        r: 42, icon: 'JUMP', col: '#6e8adc' });
    b.push({ id: 'atk',  shape: 'circ', x: ax - 96,  y: ay - 8,    r: 38, icon: 'STRIKE', col: '#d86a6a' });
    b.push({ id: 'dash', shape: 'circ', x: ax - 70,  y: ay - 92,   r: 32, icon: 'DASH', col: '#6ec0c8' });
    b.push({ id: 'heal', shape: 'circ', x: ax + 8,   y: ay - 108,  r: 30, icon: 'HEAL', col: '#cfa850' });
    // pause (top-right)
    b.push({ id: 'pause', shape: 'circ', x: VW - 28, y: 28, r: 18, icon: '❚❚' });
    this.buttons = b;
  },

  init() {
    this.layout();
    const opts = { passive: false };
    canvas.addEventListener('touchstart', e => this.onTouch(e, 'start'), opts);
    canvas.addEventListener('touchmove',  e => this.onTouch(e, 'move'),  opts);
    canvas.addEventListener('touchend',   e => this.onTouch(e, 'end'),   opts);
    canvas.addEventListener('touchcancel',e => this.onTouch(e, 'end'),   opts);
  },

  toVirtual(t) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (t.clientX - r.left) / r.width * VW,
      y: (t.clientY - r.top) / r.height * VH,
    };
  },

  hitButton(x, y) {
    for (const btn of this.buttons) {
      if (dist2(x, y, btn.x, btn.y) <= (btn.r + 6) * (btn.r + 6)) return btn;
    }
    return null;
  },

  onTouch(e, phase) {
    e.preventDefault();
    if (!this.active) { this.active = true; this.layout(); }
    AudioSys.unlock();
    // rebuild active touch set from the live touch list
    this.touches = {};
    for (const t of e.touches) {
      this.touches[t.identifier] = this.toVirtual(t);
    }
    // a tap that isn't on any control acts as "confirm" (title / victory / advance)
    if (phase === 'start' && e.changedTouches.length) {
      const v = this.toVirtual(e.changedTouches[0]);
      if (!this.hitButton(v.x, v.y)) Input.vpressed.confirm = true;
    }
    this.apply();
  },

  // recompute held/pressed virtual buttons from current touches
  apply() {
    const held = {};
    for (const id in this.touches) {
      const p = this.touches[id];
      const btn = this.hitButton(p.x, p.y);
      if (btn) held[btn.id] = true;
    }
    // map button ids -> input actions
    const map = { left:'left', right:'right', up:'up', down:'down', jump:'jump', heal:'heal' };
    for (const k in map) Input.vheld[map[k]] = !!held[k];
    // edge-triggered actions
    for (const k of ['jump', 'atk', 'dash', 'pause']) {
      if (held[k] && !this.prevHeld[k]) Input.vpressed[k] = true;
    }
    this.prevHeld = held;
    this.heldNow = held;
  },

  portrait() {
    return this.active && window.innerHeight > window.innerWidth * 1.05;
  },

  draw() {
    if (!this.active) return;
    const g = ctx;
    g.save();
    g.lineWidth = 2;
    g.font = '11px Georgia';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const btn of this.buttons) {
      const pressed = this.heldNow && this.heldNow[btn.id];
      const base = btn.col || '#b3a6d8';
      g.globalAlpha = pressed ? 0.55 : 0.28;
      g.fillStyle = base;
      g.beginPath();
      g.arc(btn.x, btn.y, btn.r, 0, 7);
      g.fill();
      g.globalAlpha = pressed ? 0.95 : 0.6;
      g.strokeStyle = base;
      g.beginPath();
      g.arc(btn.x, btn.y, btn.r, 0, 7);
      g.stroke();
      g.globalAlpha = 0.95;
      g.fillStyle = '#f4eeff';
      const big = btn.icon.length <= 1;
      g.font = (big ? '18px' : '10px') + ' Georgia';
      g.fillText(btn.icon, btn.x, btn.y + (big ? 1 : 0));
    }
    g.restore();
    g.textBaseline = 'alphabetic';
    g.textAlign = 'left';
  },

  drawRotatePrompt() {
    const g = ctx;
    g.fillStyle = 'rgba(6,3,12,0.94)';
    g.fillRect(0, 0, VW, VH);
    g.save();
    g.textAlign = 'center';
    g.fillStyle = '#e8d8c0';
    g.font = '26px Georgia';
    g.fillText('Rotate your phone', VW / 2, VH / 2 - 14);
    g.font = 'italic 15px Georgia';
    g.fillStyle = '#b8a8d0';
    g.fillText('DANTE plays in landscape', VW / 2, VH / 2 + 16);
    // little rotate glyph
    g.strokeStyle = '#9adcd8';
    g.lineWidth = 3;
    g.strokeRect(VW / 2 - 26, VH / 2 + 40, 52, 32);
    g.restore();
    g.textAlign = 'left';
  },
};
