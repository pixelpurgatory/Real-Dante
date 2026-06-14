'use strict';
// ============================================================
// Systems: gore (blood / bones), projectiles, buff pickups,
// neutral NPCs, and Purgatory's falling sinners.
// ============================================================

// ---------------- gore ----------------
const Gore = {
  // a hit spark sized to the blow; kind: 'blood' | 'bone' | 'soul'
  hit(x, y, dir, kind, big) {
    const n = big ? 14 : 8;
    if (kind === 'bone') {
      // white/ivory shards that tumble and fall
      for (let i = 0; i < n; i++) {
        Particles.spawn(x, y, {
          vx: dir * rand(40, 200) + rand(-60, 60), vy: rand(-220, -40),
          life: rand(0.5, 1.0), size: rand(2, 4), color: i % 3 ? '#e8e0c8' : '#cfc4a4',
          grav: 900, drag: 0.99,
        });
      }
    } else if (kind === 'soul') {
      for (let i = 0; i < n; i++) {
        Particles.spawn(x, y, {
          vx: dir * rand(20, 120) + rand(-40, 40), vy: rand(-120, -20),
          life: rand(0.4, 0.9), size: rand(2, 4), color: i % 2 ? '#bfe8ff' : '#8aa8d8',
          glow: true, grav: -60, drag: 0.95,
        });
      }
    } else {
      // blood: a directional spray plus drips
      for (let i = 0; i < n; i++) {
        Particles.spawn(x, y, {
          vx: dir * rand(60, 280) + rand(-50, 50), vy: rand(-180, 40),
          life: rand(0.4, 0.9), size: rand(2, 5), color: i % 4 ? '#9e1b2a' : '#c8364a',
          grav: 1100, drag: 0.98,
        });
      }
      for (let i = 0; i < (big ? 6 : 3); i++) {
        Particles.spawn(x, y, {
          vx: dir * rand(20, 90), vy: rand(-40, 20),
          life: rand(0.6, 1.1), size: rand(2, 3), color: '#7a1320', grav: 1300, drag: 0.99,
        });
      }
    }
  },
  // a bigger burst on death
  death(e) {
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    const kind = e.gore || 'blood';
    if (kind === 'bone') {
      for (let i = 0; i < 22; i++) {
        Particles.spawn(cx, cy, {
          vx: rand(-220, 220), vy: rand(-320, -40),
          life: rand(0.7, 1.4), size: rand(2.5, 5.5), color: i % 3 ? '#e8e0c8' : '#b8ac88',
          grav: 950, drag: 0.99,
        });
      }
      // a couple of larger “rib” shards
      for (let i = 0; i < 4; i++) {
        Particles.spawn(cx, cy, {
          vx: rand(-160, 160), vy: rand(-260, -60),
          life: rand(0.9, 1.5), size: rand(5, 8), color: '#d8cdaa', grav: 1000, drag: 0.99,
        });
      }
    } else if (kind === 'soul') {
      Particles.burst(cx, cy, '#bfe8ff', 18, 240, { life: 0.9, grav: -120, glow: true });
    } else {
      for (let i = 0; i < 26; i++) {
        Particles.spawn(cx, cy, {
          vx: rand(-260, 260), vy: rand(-300, 60),
          life: rand(0.5, 1.1), size: rand(2.5, 6), color: i % 4 ? '#9e1b2a' : '#c8364a',
          grav: 1200, drag: 0.98,
        });
      }
    }
  },
};

// ---------------- projectiles ----------------
// kind: 'arrow' (enemy), 'soulbolt' (enemy), 'fireball' (player)
function makeShot(x, y, vx, vy, kind, from, dmg) {
  return {
    x, y, vx, vy, kind, from, dmg: dmg || 1, dead: false, t: 0,
    w: kind === 'fireball' ? 16 : 18, h: kind === 'fireball' ? 16 : 8,
    rect() {
      if (this.kind === 'arrow') {
        const len = 18, dir = this.vx >= 0 ? 1 : -1;
        return { x: this.x - (dir < 0 ? len : 0), y: this.y - 3, w: len, h: 6 };
      }
      return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
    },
    update(dt) {
      this.t += dt;
      if (this.kind === 'arrow') this.vy += 240 * dt; // arrows arc slightly
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.t > 5) this.dead = true;
      if (this.x < -50 || this.x > WORLD_W + 50) this.dead = true;
      // hit terrain
      for (const p of PLATFORMS) {
        if (p.type === 'oneway') continue;
        if (rectsOverlap(this.rect(), p)) { this.dead = true; break; }
      }
      if (this.kind === 'fireball' && Math.random() < 0.6)
        Particles.spawn(this.x, this.y, { vx: rand(-20, 20), vy: rand(-20, 20), life: 0.3, size: 3, color: '#ff9a40', glow: true });
      if (this.kind === 'soulbolt' && Math.random() < 0.5)
        Particles.spawn(this.x, this.y, { vx: 0, vy: 0, life: 0.3, size: 2.5, color: '#b8e0ff', glow: true });
    },
    draw(camX, camY) {
      const g = ctx, sx = this.x - camX, sy = this.y - camY;
      if (this.kind === 'arrow') {
        const dir = this.vx >= 0 ? 1 : -1;
        g.strokeStyle = '#caa'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(sx - dir * 16, sy); g.lineTo(sx, sy); g.stroke();
        g.fillStyle = '#e8e0c8';
        g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx - dir * 6, sy - 3); g.lineTo(sx - dir * 6, sy + 3); g.closePath(); g.fill();
      } else if (this.kind === 'fireball') {
        g.fillStyle = 'rgba(255,150,60,0.4)';
        g.beginPath(); g.arc(sx, sy, 11, 0, 7); g.fill();
        g.fillStyle = '#ffd070';
        g.beginPath(); g.arc(sx, sy, 6, 0, 7); g.fill();
      } else { // soulbolt
        g.fillStyle = 'rgba(160,200,255,0.4)';
        g.beginPath(); g.arc(sx, sy, 10, 0, 7); g.fill();
        g.fillStyle = '#dff0ff';
        g.beginPath(); g.arc(sx, sy, 5, 0, 7); g.fill();
      }
    },
  };
}

// ---------------- buff pickups ----------------
const BUFF_INFO = {
  damage:     { dur: 45, label: 'WRATH',     col: '#ff6a4a', desc: 'Double damage' },
  regen:      { dur: 40, label: 'GRACE',     col: '#7adca0', desc: 'Slow healing' },
  doublejump: { dur: 60, label: 'WINGS',     col: '#9ad8ff', desc: 'Double jump' },
  fireball:   { dur: 30, label: 'HELLFIRE',  col: '#ffb040', desc: 'Auto fireballs' },
};

function makePickup(spec) {
  return {
    x: spec.x, y: spec.y, buff: spec.buff, taken: false, t: rand(0, 9),
    rect() { return { x: this.x - 14, y: this.y - 14, w: 28, h: 28 }; },
    update(dt, pl) {
      this.t += dt;
      if (this.taken) return;
      if (rectsOverlap(this.rect(), pl)) {
        this.taken = true;
        pl.addBuff(this.buff);
        const info = BUFF_INFO[this.buff];
        AudioSys.sfx('heal');
        Particles.burst(this.x, this.y, info.col, 26, 240, { life: 0.9, grav: -120, glow: true });
      }
    },
    draw(camX, camY, time) {
      if (this.taken) return;
      const info = BUFF_INFO[this.buff];
      const sx = this.x - camX, sy = this.y - camY + Math.sin(this.t * 2) * 4;
      const g = ctx;
      const c = hexToRgb(info.col);
      const gl = g.createRadialGradient(sx, sy, 2, sx, sy, 26);
      gl.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},0.6)`);
      gl.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
      g.fillStyle = gl; g.fillRect(sx - 26, sy - 26, 52, 52);
      g.fillStyle = info.col;
      g.save(); g.translate(sx, sy); g.rotate(this.t);
      g.beginPath();
      for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; g.lineTo(Math.cos(a) * 10, Math.sin(a) * 10); g.lineTo(Math.cos(a + 0.39) * 4, Math.sin(a + 0.39) * 4); }
      g.closePath(); g.fill();
      g.restore();
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath(); g.arc(sx, sy, 3, 0, 7); g.fill();
    },
  };
}

// ---------------- neutral NPC ----------------
function makeNPC(spec) {
  const w = 26, h = 48;
  return {
    type: 'npc', x: spec.x - w / 2, y: spec.gy - h, w, h,
    name: spec.name, lines: spec.lines, gore: spec.gore || 'blood',
    hp: 2, dead: false, flash: 0, said: 0, t: rand(0, 9), facing: -1, neutral: true,
    rect() { return this; },
    takeHit(dmg, dir) {
      this.hp -= dmg; this.flash = 0.12;
      Gore.hit(this.x + this.w / 2, this.y + this.h / 2, dir, this.gore);
      // speak when struck (not killed)
      if (this.hp > 0 && this.lines && this.lines.length) {
        Dialogue.say([{ s: 'npc', t: this.lines[Math.min(this.said, this.lines.length - 1)] }], { x: this.x + this.w / 2, y: this.y - 6 });
        this.said++;
      }
      if (this.hp <= 0) this.die(dir);
      return true;
    },
    die(dir) {
      this.dead = true;
      if (this.lines && this.lines.length) {
        Dialogue.say([{ s: 'npc', t: this.lines[this.lines.length - 1] }], { x: this.x + this.w / 2, y: this.y - 6 });
      }
      Gore.death(this);
      AudioSys.sfx('edie');
    },
    update(dt, pl) {
      this.t += dt; this.flash -= dt;
      this.facing = (pl.x > this.x) ? 1 : -1;
    },
    draw(camX, camY, time) {
      const g = ctx, sx = this.x + this.w / 2 - camX, sy = this.y + this.h - camY;
      g.save(); g.translate(sx, sy); g.scale(this.facing, 1);
      const robe = this.flash > 0 ? '#fff' : '#6a6276';
      const robeD = this.flash > 0 ? '#fff' : '#4e4858';
      const sway = Math.sin(this.t * 1.4) * 2;
      g.fillStyle = robe;
      g.beginPath();
      g.moveTo(0, -h + 8 + sway);
      g.quadraticCurveTo(-13, -h * 0.4, -10, 0);
      g.lineTo(10, 0);
      g.quadraticCurveTo(13, -h * 0.4, 0, -h + 8 + sway);
      g.closePath(); g.fill();
      g.fillStyle = robeD;
      g.beginPath(); g.arc(0, -h + 10 + sway, 8, 0, 7); g.fill();
      g.fillStyle = this.flash > 0 ? '#fff' : '#d8ccc0';
      g.beginPath(); g.arc(2, -h + 11 + sway, 5, 0, 7); g.fill();
      g.restore();
    },
  };
}

// ---------------- falling sinners (Purgatory ambient hazard-enemy) ----------------
function makeSinner(x) {
  const w = 22, h = 30;
  return {
    type: 'sinner', x: x - w / 2, y: -40 - rand(0, 120), w, h, anchor: 'center',
    vx: rand(-20, 20), vy: rand(60, 120), gore: 'blood',
    hp: 1, dead: false, flash: 0, touchDmg: 1, t: rand(0, 9), spin: rand(-4, 4), ang: 0,
    rect() { return this; },
    takeHit(dmg, dir) { this.hp -= dmg; this.flash = 0.1; Gore.hit(this.x + this.w / 2, this.y + this.h / 2, dir, 'blood'); if (this.hp <= 0) this.die(); return true; },
    die() { this.dead = true; Gore.death(this); AudioSys.sfx('edie'); },
    update(dt, pl) {
      this.t += dt; this.flash -= dt; this.ang += this.spin * dt;
      this.vy += 220 * dt;
      this.x += this.vx * dt; this.y += this.vy * dt;
      // land / splat on any platform
      for (const p of PLATFORMS) {
        if (p.type === 'oneway') continue;
        if (rectsOverlap(this.rect(), p) && this.vy > 0) { this.die(); break; }
      }
      if (this.y > KILL_Y + 80) this.dead = true;
    },
    draw(camX, camY, time) {
      const g = ctx, sx = this.x + this.w / 2 - camX, sy = this.y + this.h / 2 - camY;
      g.save(); g.translate(sx, sy); g.rotate(this.ang);
      g.fillStyle = this.flash > 0 ? '#fff' : '#7a5a52';
      // a tumbling tormented figure
      g.beginPath(); g.ellipse(0, 0, 7, 11, 0, 0, 7); g.fill();
      g.fillStyle = this.flash > 0 ? '#fff' : '#caa090';
      g.beginPath(); g.arc(0, -10, 4.5, 0, 7); g.fill();
      g.strokeStyle = this.flash > 0 ? '#fff' : '#5a4038'; g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(-5, -2); g.lineTo(-12, -8 + Math.sin(this.t * 12) * 3); g.stroke();
      g.beginPath(); g.moveTo(5, -2); g.lineTo(12, -10 + Math.cos(this.t * 12) * 3); g.stroke();
      g.restore();
    },
  };
}
