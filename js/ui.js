'use strict';
// ============================================================
// UI: dialogue bubbles, HUD, slash FX, vignette, screens
// ============================================================

// ---------------- dialogue ----------------
const Dialogue = {
  queue: [], cur: null, charT: 0, holdT: 0,

  say(lines, anchor) {
    for (const ln of lines) this.queue.push({ s: ln.s, t: ln.t, anchor });
    if (!this.cur) this.next();
  },
  next() {
    this.cur = this.queue.shift() || null;
    this.charT = 0; this.holdT = 0;
  },
  clear() { this.queue = []; this.cur = null; },
  busy() { return !!this.cur || this.queue.length > 0; },

  update(dt) {
    if (!this.cur) return;
    const full = this.cur.t.length;
    if (this.charT < full) {
      this.charT += dt * 38;
      if (this.charT >= full) this.charT = full;
    } else {
      this.holdT += dt;
      const wait = clamp(1.0 + full * 0.035, 1.6, 4.2);
      if (this.holdT > wait) this.next();
    }
  },

  anchorPos(camX, camY) {
    const c = this.cur;
    if (c.s === 'dante') {
      const p = Game.player;
      return { x: p.x + p.w / 2 - camX, y: p.y - camY - 8 };
    }
    if (c.s === 'beatrice') {
      const b = Game.beatrice;
      return { x: b.x - camX, y: b.y - 24 - camY };
    }
    if (c.anchor) return { x: c.anchor.x - camX, y: c.anchor.y - camY };
    return { x: VW / 2, y: 130 };
  },

  draw(camX, camY, time) {
    if (!this.cur) return;
    const c = this.cur;
    const shown = c.t.slice(0, Math.floor(this.charT));
    if (c.s === 'voice') {
      // ominous full-width inscription
      ctx.save();
      ctx.font = '20px Georgia';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(10,4,8,0.55)';
      ctx.fillRect(0, 96, VW, 44);
      ctx.fillStyle = '#ff7848';
      ctx.shadowColor = '#ff3010';
      ctx.shadowBlur = 12;
      ctx.fillText(shown, VW / 2, 124);
      ctx.restore();
      return;
    }

    const pos = this.anchorPos(camX, camY);
    ctx.font = c.s === 'sign' ? '12px Georgia' : 'italic 13px Georgia';
    // word wrap
    const maxW = 300;
    const words = shown.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
      else line = test;
    }
    if (line) lines.push(line);
    // also measure against full text for stable box size
    ctx.save();
    const fullWords = c.t.split(' ');
    let fw = 0, fl = 1, fline = '';
    for (const w of fullWords) {
      const test = fline ? fline + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && fline) { fl++; fline = w; }
      else fline = test;
      fw = Math.max(fw, ctx.measureText(fline).width);
    }
    const bw = Math.min(maxW, fw) + 22;
    const bh = fl * 16 + 14;
    let bx = clamp(pos.x - bw / 2, 8, VW - bw - 8);
    let by = clamp(pos.y - bh - 14, 8, VH - bh - 8);

    // bubble
    const isSign = c.s === 'sign';
    const isBea = c.s === 'beatrice';
    ctx.fillStyle = isSign ? 'rgba(42,34,26,0.92)' : (isBea ? 'rgba(18,42,46,0.92)' : 'rgba(16,10,24,0.92)');
    ctx.strokeStyle = isSign ? '#a8895a' : (isBea ? '#7adcd8' : '#8a78b8');
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 6);
    ctx.fill();
    ctx.stroke();
    // tail
    if (!isSign) {
      ctx.beginPath();
      const tx = clamp(pos.x, bx + 14, bx + bw - 14);
      ctx.moveTo(tx - 6, by + bh);
      ctx.lineTo(tx, by + bh + 9);
      ctx.lineTo(tx + 6, by + bh);
      ctx.closePath();
      ctx.fill();
    }
    // text
    ctx.fillStyle = isSign ? '#e8d2a8' : (isBea ? '#cdf4f0' : '#e8e0f4');
    ctx.textAlign = 'left';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], bx + 11, by + 18 + i * 16);
    }
    ctx.restore();
  },
};

// ---------------- HUD ----------------
const HUD = {
  hpPop: 0, prevHp: 5,

  update(dt, pl) {
    if (pl.hp < this.prevHp) this.hpPop = 0.4;
    this.prevHp = pl.hp;
    this.hpPop -= dt;
  },

  drawMask(x, y, filled, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    // laurel-leaf shaped soul mask
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.quadraticCurveTo(8, -4, 0, 9);
    ctx.quadraticCurveTo(-8, -4, 0, -9);
    ctx.closePath();
    if (filled) {
      ctx.fillStyle = '#f4ecd8';
      ctx.fill();
      ctx.strokeStyle = '#b8a44a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#c8a84a';
      ctx.fillRect(-1, -6, 2, 12);
    } else {
      ctx.fillStyle = 'rgba(20,14,30,0.7)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(184,164,74,0.4)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.restore();
  },

  draw(pl, time) {
    // soul orb
    const ox = 36, oy = 40, r = 17;
    ctx.fillStyle = 'rgba(14,10,24,0.8)';
    ctx.beginPath(); ctx.arc(ox, oy, r + 3, 0, 7); ctx.fill();
    ctx.strokeStyle = '#8a78b8';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ox, oy, r + 3, 0, 7); ctx.stroke();
    // fill level
    const f = pl.soul / 99;
    if (f > 0.01) {
      ctx.save();
      ctx.beginPath(); ctx.arc(ox, oy, r, 0, 7); ctx.clip();
      const lvl = oy + r - f * r * 2;
      ctx.fillStyle = pl.soul >= 33 ? '#cfeaff' : '#7d96b8';
      ctx.fillRect(ox - r, lvl + Math.sin(time * 3) * 1.5, r * 2, r * 2.2);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(ox - r, lvl + Math.sin(time * 3) * 1.5, r * 2, 3);
      ctx.restore();
    }
    if (pl.soul >= 33) {
      ctx.strokeStyle = `rgba(207,234,255,${0.4 + Math.sin(time * 4) * 0.25})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(ox, oy, r + 6, 0, 7); ctx.stroke();
    }
    // masks
    for (let i = 0; i < pl.maxHp; i++) {
      const filled = i < pl.hp;
      let s = 1;
      if (i === pl.hp && this.hpPop > 0) s = 1 + this.hpPop * 1.2;
      this.drawMask(70 + i * 24, 34, filled, s);
    }
  },

  drawBossBar(boss, time) {
    if (!boss.active || boss.finished) return;
    const w = 420, x = VW / 2 - w / 2, y = VH - 34;
    ctx.fillStyle = 'rgba(10,6,14,0.75)';
    ctx.fillRect(x - 4, y - 4, w + 8, 16);
    ctx.strokeStyle = '#6a4448';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 4, y - 4, w + 8, 16);
    const f = clamp(boss.hp / boss.maxHp, 0, 1);
    const grad = ctx.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, '#a82a2a');
    grad.addColorStop(1, '#ff6838');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w * f, 8);
    ctx.font = '11px Georgia';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#d8b8a8';
    ctx.fillText(boss.barName || 'BOSS', VW / 2, y - 9);
    ctx.textAlign = 'left';
    // name banner on intro
    if (boss.nameT > 0) {
      const a = clamp(Math.min(boss.nameT, 3.4 - boss.nameT) * 1.4, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = '34px Georgia';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f4d8c0';
      ctx.shadowColor = '#ff5020';
      ctx.shadowBlur = 16;
      ctx.fillText(boss.title || '', VW / 2, 150);
      ctx.font = 'italic 15px Georgia';
      ctx.fillText(boss.subtitle || '', VW / 2, 176);
      ctx.restore();
      ctx.textAlign = 'left';
    }
  },

  // active buff icons + remaining time (top-left under the masks)
  drawBuffs(pl, time) {
    if (!pl.buffs) return;
    const keys = Object.keys(pl.buffs);
    let i = 0;
    for (const k of keys) {
      const info = BUFF_INFO[k];
      if (!info) continue;
      const x = 22 + i * 92, y = 64;
      const tleft = pl.buffs[k];
      ctx.globalAlpha = tleft < 5 && Math.floor(time * 6) % 2 === 0 ? 0.4 : 1; // blink when expiring
      ctx.fillStyle = 'rgba(12,8,20,0.7)';
      ctx.fillRect(x - 2, y - 11, 88, 18);
      ctx.fillStyle = info.col;
      ctx.fillRect(x, y - 9, 6, 14);
      ctx.font = '11px Georgia';
      ctx.fillStyle = '#e8e0f4';
      ctx.textAlign = 'left';
      ctx.fillText(info.label + ' ' + Math.ceil(tleft) + 's', x + 11, y + 2);
      ctx.globalAlpha = 1;
      i++;
    }
  },
};

// ---------------- slash FX drawing ----------------
function drawFx(fx, camX, camY) {
  const g = ctx;
  const p = fx.t / fx.life; // 0..1
  const sx = fx.x - camX, sy = fx.y - camY;
  if (fx.type === 'slash' || fx.type === 'bigslash') {
    const big = fx.type === 'bigslash';
    const R = big ? 64 : 52;
    g.save();
    g.translate(sx, sy);
    g.rotate(fx.rot || 0);
    if (fx.rot === 0 || fx.rot === undefined) g.scale(fx.flip || 1, fx.alt ? -1 : 1);
    else g.scale(1, (fx.flip || 1) * (fx.alt ? -1 : 1));
    const sweep = lerp(-1.5, 1.2, Math.min(p * 1.6, 1));
    g.globalAlpha = (1 - p) * 0.9;
    g.fillStyle = big ? '#ffb890' : '#eee6ff';
    g.beginPath();
    g.arc(0, 0, R, sweep - 0.9, sweep + 0.55);
    g.arc(0, 0, R * 0.45, sweep + 0.55, sweep - 0.9, true);
    g.closePath();
    g.fill();
    g.globalAlpha = (1 - p) * 0.5;
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(0, 0, R * 0.8, sweep - 0.5, sweep + 0.3);
    g.arc(0, 0, R * 0.55, sweep + 0.3, sweep - 0.5, true);
    g.closePath();
    g.fill();
    g.globalAlpha = 1;
    g.restore();
  }
}

// ---------------- vignette ----------------
const Vignette = {
  cv: null,
  init() {
    this.cv = document.createElement('canvas');
    this.cv.width = VW; this.cv.height = VH;
    const g = this.cv.getContext('2d');
    const gr = g.createRadialGradient(VW / 2, VH / 2, VH * 0.45, VW / 2, VH / 2, VH * 0.95);
    gr.addColorStop(0, 'rgba(8,4,14,0)');
    gr.addColorStop(1, 'rgba(8,4,14,0.55)');
    g.fillStyle = gr;
    g.fillRect(0, 0, VW, VH);
  },
  draw() {
    // rebake if the view width changed (rotation) so it always covers the
    // whole view — otherwise its edge shows as a vertical seam
    if (!this.cv || this.cv.width !== VW || this.cv.height !== VH) this.init();
    ctx.drawImage(this.cv, 0, 0);
  },
};

// ---------------- screens ----------------
const Screens = {
  drawTitle(time) {
    // dark gradient panel + title
    ctx.fillStyle = 'rgba(10,6,18,0.45)';
    ctx.fillRect(0, 0, VW, VH);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0a0612';
    ctx.font = '64px Georgia';
    ctx.shadowColor = '#2a1030';
    ctx.shadowBlur = 0;
    // title with warm gradient
    const grad = ctx.createLinearGradient(0, 150, 0, 230);
    grad.addColorStop(0, '#f8e8d0');
    grad.addColorStop(1, '#c89058');
    ctx.fillStyle = grad;
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 18;
    ctx.fillText('D A N T E', VW / 2, 200);
    ctx.shadowBlur = 0;
    ctx.font = 'italic 22px Georgia';
    ctx.fillStyle = '#c8b8e0';
    ctx.fillText('— The Descent —', VW / 2, 236);
    ctx.font = '15px Georgia';
    ctx.fillStyle = `rgba(244,236,216,${0.55 + Math.sin(time * 3) * 0.35})`;
    ctx.fillText(TouchUI.active ? 'TAP  TO  BEGIN' : 'PRESS  ENTER  ·  OR  TAP', VW / 2, 330);
    ctx.font = '12px Georgia';
    ctx.fillStyle = '#9a8cb8';
    ctx.fillText('A/D move · SPACE jump · J or CLICK strike · SHIFT dash · S+strike (air) pogo · F focus/heal · P pause · M mute', VW / 2, 470);
    ctx.fillStyle = '#6e6090';
    ctx.fillText('a short tale of love, loss, and the first circle of Hell', VW / 2, 492);
    ctx.restore();
  },

  drawDeath(t) {
    const a = clamp(t / 0.9, 0, 1);
    ctx.fillStyle = `rgba(6,2,8,${a * 0.85})`;
    ctx.fillRect(0, 0, VW, VH);
    if (t > 0.5) {
      ctx.save();
      ctx.globalAlpha = clamp((t - 0.5) / 0.5, 0, 1);
      ctx.textAlign = 'center';
      ctx.font = '30px Georgia';
      ctx.fillStyle = '#a83848';
      ctx.fillText('The dark claims you...', VW / 2, VH / 2 - 10);
      ctx.font = 'italic 13px Georgia';
      ctx.fillStyle = '#8a78a8';
      ctx.fillText('but love is stubborn', VW / 2, VH / 2 + 20);
      ctx.restore();
    }
  },

  drawVictory(t, stats, time) {
    const a = clamp(t / 1.6, 0, 1);
    ctx.fillStyle = `rgba(6,4,10,${a * 0.88})`;
    ctx.fillRect(0, 0, VW, VH);
    if (a < 0.6) return;
    ctx.save();
    ctx.globalAlpha = clamp((t - 1.2) / 1.0, 0, 1);
    ctx.textAlign = 'center';
    const grad = ctx.createLinearGradient(0, 180, 0, 250);
    grad.addColorStop(0, '#f8e8d0');
    grad.addColorStop(1, '#c89058');
    ctx.fillStyle = grad;
    ctx.font = '40px Georgia';
    ctx.fillText('THE DESCENT CONTINUES…', VW / 2, 230);
    ctx.font = 'italic 16px Georgia';
    ctx.fillStyle = '#9adcd8';
    ctx.fillText('"Eight circles remain, beloved. I will be waiting in each one."', VW / 2, 272);
    ctx.font = '13px Georgia';
    ctx.fillStyle = '#9a8cb8';
    const mm = Math.floor(stats.time / 60), ss = Math.floor(stats.time % 60);
    ctx.fillText(`Time ${mm}:${String(ss).padStart(2, '0')}   ·   Deaths ${stats.deaths}   ·   Shades returned to rest ${stats.kills}`, VW / 2, 330);
    ctx.fillStyle = `rgba(244,236,216,${0.5 + Math.sin(time * 3) * 0.3})`;
    ctx.fillText(TouchUI.active ? 'TAP  TO  DESCEND  AGAIN' : 'PRESS  R  ·  OR  TAP  TO  DESCEND  AGAIN', VW / 2, 380);
    ctx.restore();
  },

  drawAreaTitle(name, sub, t) {
    // fade in/out over the 4.2s lifetime
    const a = clamp(Math.min(t, 4.2 - t) * 1.3, 0, 1);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f4ecd8';
    ctx.shadowColor = '#000'; ctx.shadowBlur = 12;
    ctx.font = '36px Georgia';
    ctx.fillText(name, VW / 2, VH * 0.36);
    // underline flourish
    ctx.shadowBlur = 0;
    const w = ctx.measureText(name).width;
    ctx.strokeStyle = `rgba(200,168,90,${a})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(VW / 2 - w / 2 - 10, VH * 0.36 + 12); ctx.lineTo(VW / 2 + w / 2 + 10, VH * 0.36 + 12); ctx.stroke();
    ctx.font = 'italic 16px Georgia';
    ctx.fillStyle = '#c8b8e0';
    ctx.fillText(sub, VW / 2, VH * 0.36 + 36);
    ctx.restore();
    ctx.textAlign = 'left';
  },

  drawPause() {
    ctx.fillStyle = 'rgba(8,4,14,0.7)';
    ctx.fillRect(0, 0, VW, VH);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '34px Georgia';
    ctx.fillStyle = '#e8d8c0';
    ctx.fillText('PAUSED', VW / 2, 180);
    ctx.font = '14px Georgia';
    ctx.fillStyle = '#b8a8d0';
    const lines = [
      'A / D  or  ← / →   — move',
      'SPACE  — jump (hold for height)  ·  S+SPACE on ledges — drop',
      'J  /  X  /  LEFT CLICK  — strike   (W+strike up, S+strike down in air)',
      'SHIFT / C / K  — dash (brief invulnerability)',
      'F (hold, grounded)  — focus soul to heal',
      'M — mute    ·    P / ESC — resume',
    ];
    for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], VW / 2, 240 + i * 28);
    ctx.restore();
  },
};
