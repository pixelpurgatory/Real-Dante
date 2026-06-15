'use strict';
// ============================================================
// Actors: particles, player (Dante), enemies, Beatrice
// ============================================================

// ---------------- particles ----------------
const Particles = {
  list: [],
  spawn(x, y, o) {
    if (this.list.length > 420) return;
    this.list.push({
      x, y,
      vx: o.vx || 0, vy: o.vy || 0,
      life: o.life || 0.6, maxLife: o.life || 0.6,
      size: o.size || 3, color: o.color || '#fff',
      grav: o.grav || 0, drag: o.drag || 1,
      glow: o.glow || false, target: o.target || null,
    });
  },
  burst(x, y, color, n, speed, opts = {}) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(speed * 0.3, speed);
      this.spawn(x, y, Object.assign({
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.2,
        life: rand(0.25, 0.7), size: rand(2, 4.5), color,
        grav: 500, drag: 0.92,
      }, opts));
    }
  },
  soulTo(x, y, n) {
    for (let i = 0; i < n; i++) {
      this.spawn(x + rand(-8, 8), y + rand(-8, 8), {
        vx: rand(-40, 40), vy: rand(-60, -10),
        life: rand(0.5, 0.8), size: rand(2, 3.5),
        color: '#bfe8ff', glow: true, target: 'player', drag: 0.97,
      });
    }
  },
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      if (p.target === 'player' && Game.player) {
        const px = Game.player.x + Game.player.w / 2, py = Game.player.y + 10;
        const dx = px - p.x, dy = py - p.y;
        const d = Math.hypot(dx, dy) || 1;
        p.vx += (dx / d) * 1400 * dt;
        p.vy += (dy / d) * 1400 * dt;
        if (d < 14) p.life = 0;
      }
      p.vy += p.grav * dt;
      p.vx *= p.drag; p.vy *= p.drag;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.list.splice(i, 1);
    }
  },
  draw(camX, camY) {
    for (const p of this.list) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = a;
      if (p.glow) {
        ctx.globalAlpha = a * 0.35;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - camX - p.size, p.y - camY - p.size, p.size * 3, p.size * 3);
        ctx.globalAlpha = a;
      }
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - camX, p.y - camY, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  },
};

// ---------------- shared physics ----------------
// integrates and collides ent {x,y,w,h,vx,vy} against PLATFORMS (+arena walls)
function moveAndCollide(ent, dt, opts = {}) {
  ent.onGround = false;
  ent.hitWall = 0;
  const solids = Game.arenaWalls.length ? PLATFORMS.concat(Game.arenaWalls) : PLATFORMS;

  // horizontal
  ent.x += ent.vx * dt;
  for (const p of solids) {
    if (p.type === 'oneway') continue;
    if (rectsOverlap(ent, p)) {
      if (ent.vx > 0) { ent.x = p.x - ent.w; ent.hitWall = 1; }
      else if (ent.vx < 0) { ent.x = p.x + p.w; ent.hitWall = -1; }
      if (ent.hitWall) ent.vx = 0;
    }
  }
  // vertical
  const prevBottom = ent.y + ent.h;
  ent.y += ent.vy * dt;
  for (const p of solids) {
    if (p.type === 'oneway') {
      if (opts.drop) continue;
      if (ent.vy >= 0 && prevBottom <= p.y + 0.5 && rectsOverlap(ent, p)) {
        ent.y = p.y - ent.h; ent.vy = 0; ent.onGround = true; ent.groundPlat = p;
      }
      continue;
    }
    if (rectsOverlap(ent, p)) {
      if (ent.vy > 0 && prevBottom <= p.y + Math.max(8, ent.vy * dt + 1)) {
        ent.y = p.y - ent.h; ent.vy = 0; ent.onGround = true; ent.groundPlat = p;
      } else if (ent.vy < 0) {
        ent.y = p.y + p.h; ent.vy = 0;
      } else if (ent.vy > 0) {
        // deep overlap fallback: push up
        ent.y = p.y - ent.h; ent.vy = 0; ent.onGround = true; ent.groundPlat = p;
      }
    }
  }
}

// is there ground just ahead? (for patrol edge turns)
function groundAhead(ent, dir) {
  const probe = { x: ent.x + ent.w / 2 + dir * (ent.w / 2 + 8), y: ent.y + ent.h + 4, w: 2, h: 8 };
  for (const p of PLATFORMS) {
    if (rectsOverlap(probe, p)) return true;
  }
  return false;
}

// ---------------- PLAYER (Dante) ----------------
function makePlayer(x, y) {
  return {
    x, y, w: S(20), h: S(36), anchor: 'feet',
    vx: 0, vy: 0, facing: 1,
    onGround: false, groundPlat: null,
    coyote: 0, jumpBuf: 0, jumpHeld: false,
    airJumps: 0,                 // double-jump charges remaining (from WINGS buff)
    dashT: 0, dashCd: 0, canDash: true,
    atkT: 0, atkCd: 0, atkDir: 0, atkHitDone: false, combo: 0,
    recoilT: 0,
    hp: 5, maxHp: 5, soul: 0,
    invuln: 0, hitstun: 0,
    healT: 0, healing: false,
    dead: false, deathT: 0,
    lastSafe: { x, y }, safeT: 0,
    trail: [], stepT: 0, animT: 0,
    buffs: {}, regenT: 0, fireT: 0,    // active buff timers + cadence clocks

    rect() { return this; },

    addBuff(type) {
      const info = BUFF_INFO[type];
      this.buffs[type] = Math.max(this.buffs[type] || 0, info.dur);
      if (type === 'doublejump') this.airJumps = Math.max(this.airJumps, 1);
    },
    hasBuff(type) { return (this.buffs[type] || 0) > 0; },
    dmgMult() { return this.hasBuff('damage') ? 2 : 1; },

    hurt(dmg, fromX, opts = {}) {
      if (this.invuln > 0 || this.dead || Game.cinematic) return false;
      this.hp -= dmg;
      this.invuln = 1.15;
      this.healing = false; this.healT = 0;
      Game.shake(5, 0.3);
      Game.freeze(0.09);
      AudioSys.sfx('hurt');
      Particles.burst(this.x + this.w / 2, this.y + this.h / 2, '#ff6a6a', 14, 220);
      if (this.hp <= 0) {
        this.die();
        return true;
      }
      if (opts.toSafe) {
        // hazards: return to last solid ground
        this.x = this.lastSafe.x; this.y = this.lastSafe.y;
        this.vx = 0; this.vy = 0;
        this.invuln = 1.5;
      } else {
        const dir = (this.x + this.w / 2) < fromX ? -1 : 1;
        this.vx = dir * 270;
        this.vy = -220;
        this.hitstun = 0.28;
      }
      return true;
    },

    die() {
      if (this.dead) return;
      this.dead = true;
      this.deathT = 0;
      AudioSys.sfx('die');
      Game.shake(8, 0.5);
      Particles.burst(this.x + this.w / 2, this.y + this.h / 2, '#e8e0ff', 30, 320, { life: 1.1 });
      Particles.burst(this.x + this.w / 2, this.y + this.h / 2, '#b02a3a', 22, 260);
    },

    gainSoul(n) { this.soul = clamp(this.soul + n, 0, 99); },

    update(dt) {
      this.animT += dt;
      if (this.dead) { this.deathT += dt; return; }

      // timers
      this.coyote -= dt; this.jumpBuf -= dt;
      this.dashT -= dt; this.dashCd -= dt;
      this.atkT -= dt; this.atkCd -= dt;
      this.invuln -= dt; this.hitstun -= dt;
      this.recoilT -= dt;

      // ----- buffs (timed boons from shrine pickups) -----
      for (const k in this.buffs) {
        this.buffs[k] -= dt;
        if (this.buffs[k] <= 0) delete this.buffs[k];
      }
      if (!this.hasBuff('doublejump') && !Game.permaDoubleJump) this.airJumps = Math.min(this.airJumps, 0);
      if (this.hasBuff('regen')) {
        this.regenT += dt;
        if (this.regenT >= 4 && this.hp < this.maxHp) { this.regenT = 0; this.hp++; AudioSys.sfx('heal'); Particles.burst(this.x + this.w / 2, this.y + 10, '#cfe8ff', 8, 120, { grav: -120, life: 0.6 }); }
      } else this.regenT = 0;
      if (this.hasBuff('fireball') && !this.dead && !Game.cinematic) {
        this.fireT += dt;
        if (this.fireT >= 0.85) {
          this.fireT = 0;
          const sx = this.x + this.w / 2 + this.facing * 16, sy = this.y + this.h * 0.45;
          Game.shots.push(makeShot(sx, sy, this.facing * 420, 0, 'fireball', 'player', 1));
          AudioSys.sfx('orb');
        }
      } else this.fireT = 0;

      const inControl = this.hitstun <= 0 && !Game.cinematic;
      const dashing = this.dashT > 0;

      // ----- input -----
      let mx = 0;
      if (inControl && !dashing) {
        if (Input.left()) mx = -1;
        if (Input.right()) mx = 1;
        if (mx !== 0 && this.atkT <= 0.0) this.facing = mx;
      }

      // healing (focus)
      const wantHeal = inControl && Input.heal() && this.onGround && this.soul >= 33 && this.hp < this.maxHp && !dashing;
      if (wantHeal) {
        if (!this.healing) { this.healing = true; this.healT = 0; AudioSys.sfx('focus'); }
        this.healT += dt;
        mx = 0;
        if (this.healT > 0.85) {
          this.healing = false; this.healT = 0;
          this.soul -= 33;
          this.hp = clamp(this.hp + 1, 0, this.maxHp);
          AudioSys.sfx('heal');
          Particles.burst(this.x + this.w / 2, this.y + 10, '#cfe8ff', 18, 160, { grav: -150, life: 0.8 });
        } else if (Math.random() < 0.5) {
          Particles.spawn(this.x + rand(-6, 26), this.y + this.h, {
            vx: 0, vy: rand(-70, -30), life: 0.5, size: 2.5, color: '#bfe8ff', glow: true,
          });
        }
      } else {
        this.healing = false; this.healT = 0;
      }

      // ----- horizontal movement -----
      const RUN = 250, ACC = 2300, DEC = 2600;
      if (!dashing && this.recoilT <= 0) {
        if (mx !== 0) {
          this.vx += mx * ACC * dt;
          this.vx = clamp(this.vx, -RUN, RUN);
        } else if (this.hitstun <= 0) {
          const d = DEC * dt;
          if (Math.abs(this.vx) <= d) this.vx = 0; else this.vx -= sign(this.vx) * d;
        }
      }

      // ----- jump -----
      if (inControl && Input.jumpP()) this.jumpBuf = 0.12;
      if (this.onGround) { this.coyote = 0.1; this.canDash = true; if (this.hasBuff('doublejump') || Game.permaDoubleJump) this.airJumps = 1; }
      if (this.jumpBuf > 0 && this.coyote > 0 && !dashing) {
        // drop through one-way platforms
        if (Input.down() && this.groundPlat && this.groundPlat.type === 'oneway') {
          this.y += 4; this.vy = 80; this.dropT = 0.18;
        } else {
          this.vy = -566;
          AudioSys.sfx('jump');
          Particles.burst(this.x + this.w / 2, this.y + this.h, '#9a8cc8', 4, 70, { life: 0.3, grav: 200 });
        }
        this.jumpBuf = 0; this.coyote = 0;
        this.healing = false;
      } else if (this.jumpBuf > 0 && !dashing && this.coyote <= 0 && !this.onGround && this.airJumps > 0) {
        // double jump (WINGS buff)
        this.airJumps--;
        this.vy = -520;
        this.jumpBuf = 0;
        this.healing = false;
        AudioSys.sfx('jump');
        for (let i = 0; i < 8; i++) Particles.spawn(this.x + this.w / 2, this.y + this.h, { vx: rand(-90, 90), vy: rand(20, 90), life: 0.4, size: 3, color: '#9ad8ff', glow: true });
      }
      this.dropT = (this.dropT || 0) - dt;
      // variable jump height
      if (!Input.jump() && this.vy < -140 && !dashing) this.vy *= 0.86;

      // ----- dash -----
      if (inControl && Input.dashP() && this.dashCd <= 0 && this.canDash && !dashing) {
        this.dashT = 0.16; this.dashCd = 0.5;
        this.canDash = this.onGround; // air dash spends it until landing
        this.vx = this.facing * 580;
        this.vy = 0;
        this.invuln = Math.max(this.invuln, 0.18);
        this.healing = false;
        AudioSys.sfx('dash');
      }
      if (dashing) {
        this.vx = this.facing * 580;
        this.vy = 0;
        if (Math.random() < 0.8) {
          this.trail.push({ x: this.x, y: this.y, f: this.facing, t: 0.22 });
        }
      }
      for (let i = this.trail.length - 1; i >= 0; i--) {
        this.trail[i].t -= dt;
        if (this.trail[i].t <= 0) this.trail.splice(i, 1);
      }

      // ----- attack -----
      if (inControl && Input.atkP() && this.atkCd <= 0) {
        this.atkCd = 0.34;
        this.atkT = 0.20;
        this.atkHitDone = false;
        this.combo = (this.combo + 1) % 2;
        if (Input.up()) this.atkDir = 1;
        else if (Input.down() && !this.onGround) this.atkDir = 2;
        else this.atkDir = 0;
        this.healing = false;
        AudioSys.sfx('swing');
        const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
        if (this.atkDir === 0) Game.addFx('slash', cx + this.facing * 46, cy - 2, { flip: this.facing, rot: 0, alt: this.combo });
        else if (this.atkDir === 1) Game.addFx('slash', cx, cy - 52, { flip: this.facing, rot: -Math.PI / 2, alt: this.combo });
        else Game.addFx('slash', cx, cy + 50, { flip: this.facing, rot: Math.PI / 2, alt: this.combo });
      }

      // active attack hitbox
      if (this.atkT > 0.02 && this.atkT < 0.18 && !this.atkHitDone) {
        const hb = this.attackBox();
        let hitSomething = false, blocked = false, pogo = false;

        const dmg = this.dmgMult();
        // enemies
        for (const e of Game.enemies) {
          if (e.dead || e.noHit) continue;
          if (rectsOverlap(hb, e.rect())) {
            const res = e.takeHit(dmg, this.facing, this.atkDir);
            if (res === 'blocked') { blocked = true; continue; }
            if (res) {
              hitSomething = true;
              this.gainSoul(14);
              Particles.burst(hb.x + hb.w / 2, hb.y + hb.h / 2, '#fff1c8', 8, 240, { life: 0.3 });
              Particles.soulTo(e.x + e.w / 2, e.y + e.h / 2, 3);
            }
          }
        }
        // neutral NPCs (killable)
        for (const n of Game.npcs) {
          if (!n.dead && rectsOverlap(hb, n.rect())) { n.takeHit(dmg, this.facing); hitSomething = true; }
        }
        // falling sinners
        for (const sn of Game.sinners) {
          if (!sn.dead && rectsOverlap(hb, sn.rect())) { sn.takeHit(dmg, this.facing); hitSomething = true; this.gainSoul(6); }
        }
        // bosses (gates / Death / Lilith)
        for (const B of [Game.boss, Game.deathBoss, Game.lilithBoss]) {
          if (B && !B.dead && B.active && rectsOverlap(hb, B.rect())) {
            if (B.takeHit(dmg, this.facing, this.atkDir)) {
              hitSomething = true;
              this.gainSoul(14);
              Particles.burst(hb.x + hb.w / 2, hb.y + hb.h / 2, '#fff1c8', 8, 240, { life: 0.3 });
            }
          }
        }
        // destructible orbs
        for (const o of Game.orbs) {
          if (!o.dead && rectsOverlap(hb, o.rect())) {
            o.dead = true;
            hitSomething = true;
            this.gainSoul(6);
            Particles.burst(o.x, o.y, '#cfd8ff', 10, 180);
            AudioSys.sfx('edie');
          }
        }
        // pogo on spikes
        if (this.atkDir === 2) {
          for (const hz of HAZARDS) {
            if (hz.type === 'spikes' && rectsOverlap(hb, hz)) { pogo = true; }
          }
        }

        if (hitSomething || blocked || pogo) {
          this.atkHitDone = true;
          Game.freeze(hitSomething ? 0.05 : 0.03);
          AudioSys.sfx(blocked && !hitSomething ? 'clink' : 'hit');
          if (this.atkDir === 2) {
            this.vy = -460;
            this.canDash = true;
            this.dashCd = Math.min(this.dashCd, 0.05);
            AudioSys.sfx('pogo');
          } else if (this.atkDir === 0) {
            this.recoilT = 0.09;
            this.vx = -this.facing * ((blocked && !hitSomething) ? 260 : 150);
          } else if (this.atkDir === 1) {
            this.vy = Math.max(this.vy, 60);
          }
        }
      }

      // ----- gravity & integrate -----
      if (!dashing) {
        this.vy += GRAV * dt;
        if (this.vy > 760) this.vy = 760;
      }
      const wasGround = this.onGround;
      moveAndCollide(this, dt, { drop: this.dropT > 0 });
      if (!wasGround && this.onGround) {
        AudioSys.sfx('land');
        Particles.burst(this.x + this.w / 2, this.y + this.h, '#9a8cc8', 5, 90, { life: 0.25, grav: 300 });
      }
      if (dashing && this.hitWall) this.dashT = 0;

      // record safe spot (solid ground, well within platform)
      if (this.onGround && this.groundPlat && this.groundPlat.type === 'solid') {
        const p = this.groundPlat;
        if (this.x > p.x + 6 && this.x + this.w < p.x + p.w - 6) {
          this.safeT += dt;
          if (this.safeT > 0.1) { this.lastSafe.x = this.x; this.lastSafe.y = this.y - 2; }
        }
      } else this.safeT = 0;

      // footsteps dust
      if (this.onGround && Math.abs(this.vx) > 120) {
        this.stepT -= dt;
        if (this.stepT <= 0) {
          this.stepT = 0.22;
          Particles.spawn(this.x + this.w / 2 - this.facing * 8, this.y + this.h - 2, {
            vx: -this.facing * 30, vy: -20, life: 0.3, size: 2.5, color: '#8a7ab8',
          });
        }
      }
    },

    attackBox() {
      // melee reach increased ~60% over the original greatsword arc
      const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
      if (this.atkDir === 1) return { x: cx - 30, y: this.y - 74, w: 60, h: 80 };
      if (this.atkDir === 2) return { x: cx - 26, y: this.y + this.h - 4, w: 52, h: 74 };
      return this.facing > 0
        ? { x: cx + 6, y: cy - 26, w: 88, h: 52 }
        : { x: cx - 94, y: cy - 26, w: 88, h: 52 };
    },

    draw(camX, camY, time) {
      // dash afterimages
      for (const t of this.trail) {
        ctx.globalAlpha = t.t / 0.22 * 0.4;
        this.drawBody(t.x - camX, t.y - camY, t.f, time, true);
      }
      ctx.globalAlpha = 1;
      if (this.dead) return;
      // hurt flicker
      if (this.invuln > 0 && Math.floor(this.animT * 18) % 2 === 0 && this.dashT <= 0) ctx.globalAlpha = 0.45;
      this.drawBody(this.x - camX, this.y - camY, this.facing, time, false);
      ctx.globalAlpha = 1;

      // healing aura
      if (this.healing) {
        const p = this.healT / 0.85;
        ctx.strokeStyle = 'rgba(191,232,255,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x + this.w / 2 - camX, this.y + 16 - camY, 26 - p * 10, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
        ctx.stroke();
      }
    },

    drawBody(sx, sy, facing, time, ghost) {
      const g = ctx;
      g.save();
      g.translate(sx + this.w / 2, sy + this.h);
      g.scale(facing, 1);
      const run = this.onGround && Math.abs(this.vx) > 40;
      const bob = run ? Math.sin(time * 14) * 1.6 : Math.sin(time * 2.2) * 0.8;
      const lean = run ? 0.1 : 0;
      const air = !this.onGround;
      g.rotate(lean + (this.dashT > 0 ? 0.18 : 0));

      const cloak = ghost ? '#7a4458' : '#7e2638';
      const cloakD = ghost ? '#5a3044' : '#5c1a2a';
      const skin = '#f0e2d0';

      // 2H greatsword slung on the back when not swinging (always visible)
      if (this.atkT <= 0) {
        g.save();
        g.translate(-6, -24 + bob);
        g.rotate(-0.95);
        this.drawGreatsword(g, ghost);
        g.restore();
      }

      // legs
      g.fillStyle = '#241826';
      if (run) {
        const lp = Math.sin(time * 14);
        g.fillRect(-7 + lp * 3, -10, 5, 10);
        g.fillRect(2 - lp * 3, -10, 5, 10);
      } else if (air) {
        g.fillRect(-7, -10, 5, 8);
        g.fillRect(2, -8, 5, 8);
      } else {
        g.fillRect(-7, -10, 5, 10);
        g.fillRect(2, -10, 5, 10);
      }

      // cloak body (flares with motion)
      const flare = clamp(Math.abs(this.vx) / 250, 0, 1) * 6 + (air ? 4 : 0);
      g.fillStyle = cloak;
      g.beginPath();
      g.moveTo(0, -34 + bob);
      g.quadraticCurveTo(9, -30 + bob, 8, -16);
      g.quadraticCurveTo(9, -8, 11, -9 + Math.sin(time * 9) * 1.5);
      g.lineTo(-6 - flare, -8 + Math.sin(time * 9 + 1) * 2);
      g.quadraticCurveTo(-10 - flare, -18, -7, -28 + bob);
      g.closePath();
      g.fill();
      // cloak inner shadow
      g.fillStyle = cloakD;
      g.beginPath();
      g.moveTo(-2, -30 + bob);
      g.quadraticCurveTo(-8 - flare, -20, -6 - flare, -9);
      g.lineTo(-1, -10);
      g.closePath();
      g.fill();

      // head with hood
      g.fillStyle = cloak;
      g.beginPath();
      g.arc(1, -36 + bob, 8.5, Math.PI * 0.55, Math.PI * 2.45);
      g.closePath();
      g.fill();
      // face
      g.fillStyle = ghost ? '#cbb' : skin;
      g.beginPath();
      g.arc(3.5, -35 + bob, 5.2, -Math.PI * 0.5, Math.PI * 0.6);
      g.closePath();
      g.fill();
      // eye
      g.fillStyle = '#241826';
      g.fillRect(5, -37 + bob, 2, 3);
      // laurel wreath
      g.fillStyle = '#c8a84a';
      g.fillRect(-2, -42 + bob, 8, 2);
      g.fillRect(-4, -41 + bob, 3, 2);

      // arm
      g.fillStyle = cloakD;
      g.fillRect(2, -27 + bob, 6, 4);
      // 2H greatsword mid-swing — snaps through the arc in the first ~70ms so
      // the blade lands WITH the slash effect (no lag), then holds extended
      if (this.atkT > 0) {
        const p = clamp((0.20 - this.atkT) / 0.07, 0, 1);
        const e = 1 - (1 - p) * (1 - p); // ease-out so it whips fast then settles
        g.save();
        if (this.atkDir === 1) {            // up-strike
          g.translate(3, -34 + bob); g.rotate(lerp(0.9, -0.25, e));
        } else if (this.atkDir === 2) {     // down-strike
          g.translate(3, -16); g.rotate(lerp(Math.PI * 0.55, Math.PI + 0.08, e));
        } else {                            // forward chop (overhead → forward)
          g.translate(3, -30 + bob); g.rotate(lerp(-2.5, 0.35, e));
        }
        this.drawGreatsword(g, ghost);
        g.restore();
      }
      g.restore();
    },

    // a massive Berserk-style iron slab; handle at the origin, blade along -y
    drawGreatsword(g, ghost) {
      g.fillStyle = ghost ? '#3a2c34' : '#241c14';
      g.fillRect(-2.5, 0, 5, 13);                 // grip
      g.fillStyle = '#1a140e';
      g.fillRect(-2.5, 6, 5, 3);                  // grip wrap
      g.fillStyle = ghost ? '#8a7a4a' : '#caa84a';
      g.fillRect(-7, -2, 14, 4);                  // crossguard
      const steel = ghost ? '#7a8290' : '#9aa0aa';
      const edge = ghost ? '#a8b0bc' : '#cdd2d8';
      g.fillStyle = steel;
      g.beginPath();
      g.moveTo(-6, -2); g.lineTo(6, -2); g.lineTo(5, -46); g.lineTo(0, -54); g.lineTo(-5, -46);
      g.closePath(); g.fill();
      g.fillStyle = edge;                          // central fuller highlight
      g.fillRect(-1.4, -50, 2.8, 48);
      g.fillStyle = ghost ? '#566' : '#697079';    // forged notches
      for (let i = 0; i < 3; i++) g.fillRect(-5, -14 - i * 12, 10, 2);
    },
  };
}

// ---------------- ENEMIES ----------------
function spawnEnemy(spec) {
  switch (spec.type) {
    case 'shade': return makeShade(spec);
    case 'harpy': return makeHarpy(spec);
    case 'hoplite': return makeHoplite(spec);
    case 'hound': return makeHound(spec, false);
    case 'wraith': return makeHound(spec, true);
    case 'weeper': return makeWeeper(spec);
    case 'bowman': return makeBowman(spec);
    case 'soul': return makeSoul(spec);
    case 'succubus': return makeSuccubus(spec);
    case 'imp': return makeImp(spec);
  }
  return null;
}

// overall actor scale (player + enemies a little bigger)
const ASCALE = 1.18;
const S = n => Math.round(n * ASCALE);

function baseEnemy(spec, w, h) {
  return {
    type: spec.type,
    x: spec.gy !== undefined ? spec.x - w / 2 : spec.x - w / 2,
    y: spec.gy !== undefined ? spec.gy - h : spec.y,
    w, h, vx: 0, vy: 0,
    hp: 1, maxHp: 1, touchDmg: 1,
    facing: -1, flash: 0, dead: false,
    gore: 'blood',
    state: 'idle', t: 0, animT: rand(0, 9),
    home: { x: spec.x, y: spec.gy !== undefined ? spec.gy - h : spec.y },
    min: spec.min, max: spec.max,
    rect() { return this; },
    takeHit(dmg, dir, atkDir) {
      this.hp -= dmg;
      this.flash = 0.12;
      this.aggro = true;
      Gore.hit(this.x + this.w / 2, this.y + this.h / 2, dir, this.gore, dmg > 1);
      if (this.knockable) this.vx += dir * 160;
      if (this.hp <= 0) this.die();
      return true;
    },
    die() {
      this.dead = true;
      if (typeof Game !== 'undefined') Game.stats.kills++;
      AudioSys.sfx('edie');
      Gore.death(this);
      Particles.soulTo(this.x + this.w / 2, this.y + this.h / 2, 5);
    },
  };
}

// --- Shade: floating lost soul, lunges ---
function makeShade(spec) {
  const e = baseEnemy(spec, 26, 28);
  e.hp = e.maxHp = 2;
  e.knockable = true;
  e.deathColor = '#9a8cd8';
  e.gore = 'soul';
  e.anchor = 'center';
  e.hover = spec.hover;
  e.update = function (dt, pl) {
    this.animT += dt; this.flash -= dt; this.t += dt;
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    const px = pl.x + pl.w / 2, py = pl.y + pl.h / 2;
    const d2 = dist2(cx, cy, px, py);
    if (this.hover) {
      // pogo helper: drifts in place
      this.y = this.home.y + Math.sin(this.animT * 1.8) * 10;
      this.x += (this.home.x - 13 - this.x) * dt * 1.2;
      this.vx = 0;
      return;
    }
    if (this.state === 'idle') {
      this.x = this.home.x - 13 + Math.sin(this.animT * 0.8) * 26;
      this.y = this.home.y + Math.sin(this.animT * 1.6) * 12;
      if (d2 < 280 * 280 || this.aggro) { this.state = 'chase'; }
    } else {
      const d = Math.sqrt(d2) || 1;
      const sp = 120;
      this.vx += ((px - cx) / d * sp - this.vx) * dt * 2.2;
      this.vy += ((py - cy) / d * sp - this.vy) * dt * 2.2;
      this.vy += Math.sin(this.animT * 3) * 18 * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (d2 > 560 * 560) { this.state = 'idle'; this.aggro = false; }
    }
    this.facing = (pl.x > this.x) ? 1 : -1;
  };
  e.draw = function (camX, camY, time) {
    const sx = this.x + this.w / 2 - camX, sy = this.y + this.h / 2 - camY;
    const g = ctx;
    const a = this.flash > 0 ? 1 : 0.85;
    g.save();
    g.translate(sx, sy);
    const col = this.flash > 0 ? '#fff' : '#3a3354';
    const eye = this.flash > 0 ? '#fff' : '#b8e0ff';
    g.globalAlpha = a;
    // wispy body
    g.fillStyle = col;
    g.beginPath();
    g.arc(0, -4, 11, Math.PI, 0);
    const wob = Math.sin(time * 6 + this.animT) * 3;
    g.quadraticCurveTo(12, 8, 6 + wob, 15);
    g.quadraticCurveTo(2, 9, 0 - wob, 15);
    g.quadraticCurveTo(-4, 9, -8 - wob, 14);
    g.quadraticCurveTo(-12, 6, -11, -4);
    g.closePath();
    g.fill();
    // eyes
    g.fillStyle = eye;
    g.fillRect(-5, -7, 3, 5);
    g.fillRect(2, -7, 3, 5);
    g.globalAlpha = 1;
    g.restore();
  };
  return e;
}

// --- Harpy: patrols air, telegraphed dive ---
function makeHarpy(spec) {
  const e = baseEnemy(spec, 34, 26);
  e.hp = e.maxHp = 1;          // birds drop in a single strike
  e.deathColor = '#d8b08a';
  e.gore = 'blood';
  e.anchor = 'center';
  e.baseY = spec.y;
  e.dir = 1;
  e.cd = 0;
  e.update = function (dt, pl) {
    this.animT += dt; this.flash -= dt; this.t += dt; this.cd -= dt;
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    const px = pl.x + pl.w / 2, py = pl.y + pl.h / 2;
    switch (this.state) {
      case 'idle': {
        this.x += this.dir * 70 * dt;
        if (this.x < this.min) { this.x = this.min; this.dir = 1; }
        if (this.x + this.w > this.max) { this.x = this.max - this.w; this.dir = -1; }
        this.y = this.baseY + Math.sin(this.animT * 2.4) * 14;
        this.facing = this.dir;
        if (this.cd <= 0 && Math.abs(px - cx) < 200 && py > cy && dist2(cx, cy, px, py) < 340 * 340) {
          this.state = 'tele'; this.t = 0;
          AudioSys.sfx('shriek');
        }
        break;
      }
      case 'tele': {
        this.y += Math.sin(this.animT * 18) * 0.8;
        this.facing = (px > cx) ? 1 : -1;
        if (this.t > 0.45) {
          this.state = 'dive'; this.t = 0;
          const dx = px - cx, dy = (py - cy) + 10;
          const d = Math.hypot(dx, dy) || 1;
          this.vx = dx / d * 430;
          this.vy = dy / d * 430;
        }
        break;
      }
      case 'dive': {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vy += 60 * dt;
        // pull out of dive
        if (this.t > 0.55 || this.y > 420) { this.state = 'return'; this.t = 0; }
        break;
      }
      case 'return': {
        this.x += ((this.min + this.max) / 2 - cx) * dt * 1.4;
        this.y += (this.baseY - this.y) * dt * 2.4;
        if (Math.abs(this.y - this.baseY) < 8 && this.t > 0.8) { this.state = 'idle'; this.cd = 1.3; }
        break;
      }
    }
  };
  e.draw = function (camX, camY, time) {
    const g = ctx;
    const sx = this.x + this.w / 2 - camX, sy = this.y + this.h / 2 - camY;
    g.save();
    g.translate(sx, sy);
    g.scale(this.facing, 1);
    const body = this.flash > 0 ? '#fff' : '#6a4a52';
    const wing = this.flash > 0 ? '#fff' : '#503842';
    const skin = this.flash > 0 ? '#fff' : '#d8c0a8';
    const flap = this.state === 'dive' ? 0.9 : Math.sin(time * (this.state === 'tele' ? 26 : 10)) * 0.7;
    // wings
    g.fillStyle = wing;
    g.save();
    g.rotate(-flap * 0.5 - 0.3);
    g.beginPath();
    g.moveTo(-2, -2);
    g.quadraticCurveTo(-16, -16, -30, -10);
    g.quadraticCurveTo(-18, -4, -14, 2);
    g.closePath(); g.fill();
    g.restore();
    g.save();
    g.rotate(flap * 0.5 + 0.3);
    g.beginPath();
    g.moveTo(2, -4);
    g.quadraticCurveTo(14, -20, 30, -14);
    g.quadraticCurveTo(16, -6, 12, 0);
    g.closePath(); g.fill();
    g.restore();
    // body
    g.fillStyle = body;
    g.beginPath();
    g.ellipse(0, 2, 12, 8, 0, 0, 7);
    g.fill();
    // tail feathers
    g.beginPath();
    g.moveTo(-10, 2);
    g.lineTo(-19, 6 + Math.sin(time * 8) * 2);
    g.lineTo(-10, 7);
    g.closePath(); g.fill();
    // head (pale, hollow eyed)
    g.fillStyle = skin;
    g.beginPath(); g.arc(9, -5, 6, 0, 7); g.fill();
    g.fillStyle = '#2a1a22';
    g.fillRect(10, -7, 2.5, 3);
    // hair streaming
    g.strokeStyle = wing;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(6, -9);
    g.quadraticCurveTo(-2, -13 - Math.sin(time * 7) * 2, -8, -9);
    g.stroke();
    // talons
    g.strokeStyle = skin;
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(-2, 9); g.lineTo(-2, 13); g.moveTo(3, 9); g.lineTo(4, 13);
    g.stroke();
    g.restore();
  };
  return e;
}

// --- Hoplite: shielded skeleton warrior ---
function makeHoplite(spec) {
  const e = baseEnemy(spec, 26, 44);
  e.hp = e.maxHp = 4;
  e.deathColor = '#d8d2b8';
  e.gore = 'bone';
  e.dir = -1;
  e.thrustBox = null;
  e.takeHit = function (dmg, dir, atkDir) {
    // shield blocks level horizontal hits coming from the front, unless mid-thrust/recover
    const shielded = (this.state === 'walk' || this.state === 'brace' || this.state === 'idle');
    const fromFront = (Game.player.x + Game.player.w / 2 < this.x + this.w / 2) === (this.facing < 0);
    if (shielded && fromFront && atkDir === 0) {
      Particles.burst(this.x + this.w / 2 + this.facing * 12, this.y + 18, '#fff8c8', 6, 160, { life: 0.25 });
      this.aggro = true;
      return 'blocked';
    }
    this.hp -= dmg;
    this.flash = 0.12;
    this.aggro = true;
    Gore.hit(this.x + this.w / 2, this.y + this.h / 2, dir, 'bone', dmg > 1);
    if (this.hp <= 0) this.die();
    return true;
  };
  e.update = function (dt, pl) {
    this.animT += dt; this.flash -= dt; this.t += dt;
    const cx = this.x + this.w / 2;
    const px = pl.x + pl.w / 2;
    this.thrustBox = null;
    switch (this.state) {
      case 'idle':
      case 'walk': {
        this.state = 'walk';
        this.facing = this.dir;
        this.vx = this.dir * 46;
        if (this.x < this.min) this.dir = 1;
        if (this.x + this.w > this.max) this.dir = -1;
        if (!groundAhead(this, this.dir) && this.onGround) this.dir = -this.dir;
        // spot player: in front, similar height, close
        const sameLevel = Math.abs((pl.y + pl.h) - (this.y + this.h)) < 60;
        const inFront = (px - cx) * this.facing > 0;
        if (sameLevel && Math.abs(px - cx) < 190 && (inFront || this.aggro)) {
          this.facing = px > cx ? 1 : -1;
          this.dir = this.facing;
          this.state = 'brace'; this.t = 0; this.vx = 0;
        }
        break;
      }
      case 'brace': {
        this.vx = 0;
        if (this.t > 0.55) {
          this.state = 'thrust'; this.t = 0;
          AudioSys.sfx('thrust');
        }
        break;
      }
      case 'thrust': {
        this.vx = this.facing * 60;
        const bx = this.facing > 0 ? this.x + this.w : this.x - 64;
        this.thrustBox = { x: bx, y: this.y + 14, w: 64, h: 14 };
        if (this.t > 0.22) { this.state = 'recover'; this.t = 0; this.vx = 0; }
        break;
      }
      case 'recover': {
        this.vx = 0;
        if (this.t > 0.7) { this.state = 'walk'; this.aggro = false; }
        break;
      }
    }
    this.vy += GRAV * dt;
    if (this.vy > 700) this.vy = 700;
    moveAndCollide(this, dt);
  };
  e.draw = function (camX, camY, time) {
    const g = ctx;
    const sx = this.x + this.w / 2 - camX, sy = this.y + this.h - camY;
    g.save();
    g.translate(sx, sy);
    g.scale(this.facing, 1);
    const bone = this.flash > 0 ? '#fff' : '#cfc8ae';
    const dark = this.flash > 0 ? '#fff' : '#5c5644';
    const bronze = this.flash > 0 ? '#fff' : '#8a7340';
    const crest = this.flash > 0 ? '#fff' : '#a83838';
    const walk = this.state === 'walk' ? Math.sin(time * 8) : 0;
    // legs
    g.strokeStyle = bone; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-3, -16); g.lineTo(-5 + walk * 3, 0); g.stroke();
    g.beginPath(); g.moveTo(3, -16); g.lineTo(5 - walk * 3, 0); g.stroke();
    // torso (ribs)
    g.strokeStyle = bone; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -16); g.lineTo(0, -30); g.stroke();
    for (let i = 0; i < 3; i++) {
      g.beginPath(); g.moveTo(-5, -20 - i * 4); g.lineTo(5, -20 - i * 4); g.stroke();
    }
    // skull + corinthian helmet
    g.fillStyle = bone;
    g.beginPath(); g.arc(1, -36, 5.5, 0, 7); g.fill();
    g.fillStyle = bronze;
    g.beginPath();
    g.arc(1, -37, 6, Math.PI * 0.9, Math.PI * 2.35);
    g.lineTo(7, -33);
    g.lineTo(4, -33);
    g.closePath(); g.fill();
    // crest
    g.fillStyle = crest;
    g.beginPath();
    g.moveTo(-5, -40);
    g.quadraticCurveTo(1, -50, 8, -40);
    g.quadraticCurveTo(1, -44, -5, -40);
    g.closePath(); g.fill();
    // eye glow
    g.fillStyle = this.state === 'brace' ? '#ff5040' : '#7090b0';
    g.fillRect(3, -38, 2, 3);

    // spear
    g.strokeStyle = dark; g.lineWidth = 2.5;
    const ext = this.state === 'thrust' ? 38 : (this.state === 'brace' ? -6 : 0);
    g.beginPath(); g.moveTo(-4 + ext * 0.2, -24); g.lineTo(26 + ext, -24); g.stroke();
    g.fillStyle = bone;
    g.beginPath();
    g.moveTo(26 + ext, -27); g.lineTo(34 + ext, -24); g.lineTo(26 + ext, -21);
    g.closePath(); g.fill();

    // shield (front)
    if (this.state !== 'recover') {
      g.fillStyle = bronze;
      g.beginPath(); g.ellipse(10, -22, 5, 12, 0, 0, 7); g.fill();
      g.fillStyle = this.flash > 0 ? '#fff' : '#6e5a30';
      g.beginPath(); g.ellipse(10, -22, 2.5, 8, 0, 0, 7); g.fill();
    }
    g.restore();
  };
  return e;
}

// --- Hound / Wraith: charger (wraith teleports before charging) ---
function makeHound(spec, isWraith) {
  const e = baseEnemy(spec, 40, 24);
  e.hp = e.maxHp = 3;
  e.knockable = true;
  e.isWraith = isWraith;
  e.deathColor = isWraith ? '#cfd8e2' : '#c86a3a';
  e.gore = isWraith ? 'soul' : 'blood';
  e.cd = 0;
  e.alpha = 1;
  e.update = function (dt, pl) {
    this.animT += dt; this.flash -= dt; this.t += dt; this.cd -= dt;
    const cx = this.x + this.w / 2;
    const px = pl.x + pl.w / 2;
    switch (this.state) {
      case 'idle': {
        this.alpha = 1;
        this.vx = 0;
        this.facing = px > cx ? 1 : -1;
        const sameLevel = Math.abs((pl.y + pl.h) - (this.y + this.h)) < 70;
        if (this.cd <= 0 && sameLevel && Math.abs(px - cx) < 260) {
          if (this.isWraith) { this.state = 'fade'; this.t = 0; }
          else { this.state = 'crouch'; this.t = 0; }
        }
        break;
      }
      case 'fade': {
        this.alpha = 1 - this.t / 0.4;
        this.vx = 0;
        if (this.t > 0.4) {
          // reappear flanking the player, inside patrol bounds
          const side = (px - 120 > this.min + 20) && Math.random() < 0.6 ? -1 : 1;
          let nx = clamp(px + side * 130 - this.w / 2, this.min, this.max - this.w);
          this.x = nx;
          this.state = 'appear'; this.t = 0;
          AudioSys.sfx('spirit');
          Particles.burst(this.x + this.w / 2, this.y + this.h / 2, '#cfd8e2', 8, 120);
        }
        break;
      }
      case 'appear': {
        this.alpha = this.t / 0.25;
        this.facing = px > cx ? 1 : -1;
        if (this.t > 0.25) { this.alpha = 1; this.state = 'crouch'; this.t = 0; }
        break;
      }
      case 'crouch': {
        this.vx = 0;
        this.facing = px > cx ? 1 : -1;
        if (this.t > (this.isWraith ? 0.32 : 0.42)) {
          this.state = 'charge'; this.t = 0;
          this.vx = this.facing * (this.isWraith ? 400 : 440);
          AudioSys.sfx(this.isWraith ? 'spirit' : 'thrust');
        }
        break;
      }
      case 'charge': {
        // dust
        if (Math.random() < 0.4) Particles.spawn(this.x + this.w / 2, this.y + this.h, {
          vx: -this.facing * 40, vy: -30, life: 0.3, size: 2.5,
          color: this.isWraith ? '#cfd8e2' : '#a85a32',
        });
        const offEdge = this.onGround && !groundAhead(this, this.facing);
        if (this.hitWall || offEdge || this.t > 0.85 ||
            this.x <= this.min - 30 || this.x + this.w >= this.max + 30) {
          this.state = 'skid'; this.t = 0; this.vx = this.facing * 60;
        }
        break;
      }
      case 'skid': {
        this.vx *= 0.85;
        if (this.t > 0.55) { this.state = 'idle'; this.cd = 1.1; }
        break;
      }
    }
    this.vy += GRAV * dt;
    if (this.vy > 700) this.vy = 700;
    moveAndCollide(this, dt);
  };
  e.draw = function (camX, camY, time) {
    const g = ctx;
    const sx = this.x + this.w / 2 - camX, sy = this.y + this.h - camY;
    g.save();
    g.translate(sx, sy);
    g.scale(this.facing, 1);
    g.globalAlpha = clamp(this.alpha, 0, 1);
    const body = this.flash > 0 ? '#fff' : (this.isWraith ? '#8a96a8' : '#3c2030');
    const eye = this.isWraith ? '#dff0ff' : '#ff7838';
    const crouch = this.state === 'crouch' ? 3 : 0;
    const stretch = this.state === 'charge' ? 1.25 : 1;
    g.scale(stretch, 1 / Math.sqrt(stretch));
    // body
    g.fillStyle = body;
    g.beginPath();
    g.ellipse(0, -12 + crouch, 17, 9, 0, 0, 7);
    g.fill();
    // head
    g.beginPath();
    g.ellipse(14, -16 + crouch, 8, 6, 0.2, 0, 7);
    g.fill();
    // snout + jaw
    g.beginPath();
    g.moveTo(19, -16 + crouch); g.lineTo(26, -13 + crouch); g.lineTo(19, -11 + crouch);
    g.closePath(); g.fill();
    // ears
    g.beginPath();
    g.moveTo(10, -21 + crouch); g.lineTo(8, -27 + crouch); g.lineTo(13, -22 + crouch);
    g.closePath(); g.fill();
    // legs
    const lp = (this.state === 'charge') ? Math.sin(time * 22) * 4 : (Math.abs(this.vx) > 5 ? Math.sin(time * 10) * 3 : 0);
    g.strokeStyle = body; g.lineWidth = 3.5;
    g.beginPath(); g.moveTo(-10, -8 + crouch); g.lineTo(-12 - lp, 0); g.stroke();
    g.beginPath(); g.moveTo(-4, -8 + crouch); g.lineTo(-2 + lp, 0); g.stroke();
    g.beginPath(); g.moveTo(8, -8 + crouch); g.lineTo(6 - lp, 0); g.stroke();
    g.beginPath(); g.moveTo(13, -8 + crouch); g.lineTo(15 + lp, 0); g.stroke();
    // tail
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-15, -14 + crouch);
    g.quadraticCurveTo(-22, -18 - Math.sin(time * 6) * 3, -26, -14);
    g.stroke();
    // eyes
    g.fillStyle = this.state === 'crouch' ? '#ff3030' : eye;
    g.fillRect(14, -19 + crouch, 3, 2.5);
    // wraith mist
    if (this.isWraith) {
      g.fillStyle = 'rgba(207,216,226,0.35)';
      g.beginPath();
      g.ellipse(-6, -6, 14, 4, 0, 0, 7);
      g.fill();
    }
    g.globalAlpha = 1;
    g.restore();
  };
  return e;
}

// --- Bowman: skeleton archer (ranged) ---
function makeBowman(spec) {
  const e = baseEnemy(spec, 26, 44);
  e.hp = e.maxHp = 3;
  e.gore = 'bone';
  e.deathColor = '#d8d2b8';
  e.dir = -1; e.cd = rand(0.6, 1.6);
  e.update = function (dt, pl) {
    this.animT += dt; this.flash -= dt; this.t += dt; this.cd -= dt;
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    const px = pl.x + pl.w / 2, py = pl.y + pl.h / 2;
    const sameLevel = Math.abs((pl.y + pl.h) - (this.y + this.h)) < 90;
    const inRange = Math.abs(px - cx) < 460 && sameLevel;
    switch (this.state) {
      case 'idle':
      case 'walk': {
        this.state = 'walk';
        this.facing = this.dir;
        this.vx = this.dir * 34;
        if (this.x < this.min) this.dir = 1;
        if (this.x + this.w > this.max) this.dir = -1;
        if (!groundAhead(this, this.dir) && this.onGround) this.dir = -this.dir;
        if (inRange && this.cd <= 0) { this.state = 'aim'; this.t = 0; this.vx = 0; this.facing = px > cx ? 1 : -1; AudioSys.sfx('focus'); }
        break;
      }
      case 'aim': {
        this.vx = 0;
        this.facing = px > cx ? 1 : -1;
        if (this.t > 0.55) {
          this.state = 'walk'; this.cd = rand(1.6, 2.6);
          const dir = this.facing;
          const sx = this.x + this.w / 2 + dir * 16, sy = this.y + 16;
          const dx = px - sx, dy = (py - sy) - 30;
          const d = Math.hypot(dx, dy) || 1;
          const sp = 340;
          Game.shots.push(makeShot(sx, sy, dx / d * sp, dy / d * sp, 'arrow', 'enemy', 1));
          AudioSys.sfx('thrust');
        }
        break;
      }
    }
    this.vy += GRAV * dt; if (this.vy > 700) this.vy = 700;
    moveAndCollide(this, dt);
  };
  e.draw = function (camX, camY, time) {
    const g = ctx, sx = this.x + this.w / 2 - camX, sy = this.y + this.h - camY;
    g.save(); g.translate(sx, sy); g.scale(this.facing, 1);
    const bone = this.flash > 0 ? '#fff' : '#cfc8ae';
    const dark = this.flash > 0 ? '#fff' : '#5c5644';
    const walk = this.state === 'walk' ? Math.sin(time * 7) : 0;
    // legs + ribs
    g.strokeStyle = bone; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-3, -16); g.lineTo(-5 + walk * 3, 0); g.stroke();
    g.beginPath(); g.moveTo(3, -16); g.lineTo(5 - walk * 3, 0); g.stroke();
    g.lineWidth = 2; g.beginPath(); g.moveTo(0, -16); g.lineTo(0, -32); g.stroke();
    for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-5, -20 - i * 4); g.lineTo(5, -20 - i * 4); g.stroke(); }
    // skull
    g.fillStyle = bone; g.beginPath(); g.arc(1, -37, 6, 0, 7); g.fill();
    g.fillStyle = '#3a3020'; g.fillRect(3, -39, 2.5, 3);
    // bow
    const draw = this.state === 'aim' ? Math.min(this.t / 0.55, 1) : 0.1;
    g.strokeStyle = dark; g.lineWidth = 2.5;
    g.beginPath(); g.arc(16, -26, 14, -1.1, 1.1); g.stroke();
    g.strokeStyle = '#e8e0c8'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(16 + Math.cos(-1.1) * 14, -26 + Math.sin(-1.1) * 14);
    g.lineTo(16 - draw * 12, -26); g.lineTo(16 + Math.cos(1.1) * 14, -26 + Math.sin(1.1) * 14); g.stroke();
    if (this.state === 'aim') { g.strokeStyle = bone; g.beginPath(); g.moveTo(16 - draw * 12, -26); g.lineTo(28, -26); g.stroke(); }
    g.restore();
  };
  return e;
}

// --- Soul: flying tormented soul (Purgatory), fires slow soul-bolts ---
function makeSoul(spec) {
  const e = baseEnemy(spec, 30, 30);
  e.hp = e.maxHp = 3;
  e.gore = 'soul';
  e.anchor = 'center';
  e.deathColor = '#bfe0ff';
  e.baseY = spec.y; e.cd = rand(1.0, 2.4); e.dir = 1;
  e.update = function (dt, pl) {
    this.animT += dt; this.flash -= dt; this.t += dt; this.cd -= dt;
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    const px = pl.x + pl.w / 2, py = pl.y + pl.h / 2;
    // slow horizontal drift within bounds + gentle vertical bob toward player height
    this.x += this.dir * 46 * dt;
    if (this.x < this.min) this.dir = 1;
    if (this.x + this.w > this.max) this.dir = -1;
    const targetY = clamp(py - 60, 150, 360);
    this.y += (targetY + Math.sin(this.t * 1.6) * 16 - this.y) * dt * 1.2;
    this.facing = px > cx ? 1 : -1;
    if (dist2(cx, cy, px, py) < 520 * 520 && this.cd <= 0) {
      this.cd = rand(2.0, 3.2);
      const dx = px - cx, dy = py - cy, d = Math.hypot(dx, dy) || 1, sp = 165;
      Game.shots.push(makeShot(cx, cy, dx / d * sp, dy / d * sp, 'soulbolt', 'enemy', 1));
      AudioSys.sfx('orb');
    }
  };
  e.draw = function (camX, camY, time) {
    const g = ctx, sx = this.x + this.w / 2 - camX, sy = this.y + this.h / 2 - camY;
    g.save(); g.translate(sx, sy);
    const a = this.flash > 0 ? 1 : 0.85;
    g.globalAlpha = a;
    const body = this.flash > 0 ? '#fff' : '#8aa6c8';
    // glow
    g.globalAlpha = a * 0.3; g.fillStyle = '#bfe0ff';
    g.beginPath(); g.arc(0, 0, 22, 0, 7); g.fill();
    g.globalAlpha = a;
    // anguished wispy face/body
    g.fillStyle = body;
    g.beginPath();
    g.arc(0, -4, 11, Math.PI, 0);
    const wob = Math.sin(time * 5 + this.animT) * 4;
    g.quadraticCurveTo(12, 10, 5 + wob, 16);
    g.quadraticCurveTo(0, 9, -2 - wob, 16);
    g.quadraticCurveTo(-8, 11, -11, -4);
    g.closePath(); g.fill();
    // hollow mouth/eyes (torment)
    g.fillStyle = '#1a2a3e';
    g.fillRect(-5, -7, 3, 4); g.fillRect(3, -7, 3, 4);
    g.beginPath(); g.ellipse(0, 2, 2.5, 4, 0, 0, 7); g.fill();
    g.globalAlpha = 1; g.restore();
  };
  return e;
}

// --- Succubus: winged seductress of the Lust circle; lures, then dives ---
function makeSuccubus(spec) {
  const e = baseEnemy(spec, 32, 36);
  e.hp = e.maxHp = 2;
  e.gore = 'blood';
  e.anchor = 'center';
  e.baseY = spec.y; e.dir = 1; e.cd = rand(0.8, 2.0);
  e.update = function (dt, pl) {
    this.animT += dt; this.flash -= dt; this.t += dt; this.cd -= dt;
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2, px = pl.x + pl.w / 2, py = pl.y + pl.h / 2;
    switch (this.state) {
      case 'idle':
        this.x += this.dir * 74 * dt;
        if (this.x < this.min) { this.x = this.min; this.dir = 1; }
        if (this.x + this.w > this.max) { this.x = this.max - this.w; this.dir = -1; }
        this.y = this.baseY + Math.sin(this.animT * 2.2) * 16;
        this.facing = this.dir;
        if (this.cd <= 0 && Math.abs(px - cx) < 230 && py > cy - 40 && dist2(cx, cy, px, py) < 360 * 360) { this.state = 'tele'; this.t = 0; AudioSys.sfx('shriek'); }
        break;
      case 'tele':
        this.facing = px > cx ? 1 : -1;
        this.y += Math.sin(this.animT * 18) * 0.8;
        if (this.t > 0.42) { this.state = 'dive'; this.t = 0; const dx = px - cx, dy = (py - cy) + 8, d = Math.hypot(dx, dy) || 1; this.vx = dx / d * 440; this.vy = dy / d * 440; }
        break;
      case 'dive':
        this.x += this.vx * dt; this.y += this.vy * dt; this.vy += 70 * dt;
        if (Math.random() < 0.5) Particles.spawn(cx, cy, { vx: 0, vy: 0, life: 0.3, size: 3, color: '#e85a78', glow: true });
        if (this.t > 0.5 || this.y > 432) { this.state = 'return'; this.t = 0; }
        break;
      case 'return':
        this.x += ((this.min + this.max) / 2 - cx) * dt * 1.5;
        this.y += (this.baseY - this.y) * dt * 2.6;
        if (Math.abs(this.y - this.baseY) < 10 && this.t > 0.7) { this.state = 'idle'; this.cd = rand(1.2, 2.4); }
        break;
    }
  };
  e.draw = function (camX, camY, time) {
    const g = ctx, sx = this.x + this.w / 2 - camX, sy = this.y + this.h / 2 - camY;
    g.save(); g.translate(sx, sy); g.scale(this.facing, 1);
    const skin = this.flash > 0 ? '#fff' : '#c86a72';
    const robe = this.flash > 0 ? '#fff' : '#7a1838';
    const wing = this.flash > 0 ? '#fff' : '#4a1030';
    const flap = this.state === 'dive' ? 0.9 : Math.sin(time * 9) * 0.7;
    // bat-like wings
    g.fillStyle = wing;
    for (const s of [-1, 1]) {
      g.save(); g.scale(s, 1); g.rotate(-flap * 0.4 - 0.2);
      g.beginPath(); g.moveTo(2, -4);
      g.quadraticCurveTo(20, -18, 32, -6); g.quadraticCurveTo(24, -2, 26, 6);
      g.quadraticCurveTo(18, 0, 12, 4); g.closePath(); g.fill();
      g.restore();
    }
    // draped body (no nudity — a clad silhouette)
    g.fillStyle = robe;
    g.beginPath(); g.moveTo(0, -6); g.quadraticCurveTo(9, 4, 6, 18); g.lineTo(-6, 18); g.quadraticCurveTo(-9, 4, 0, -6); g.closePath(); g.fill();
    // head + flowing hair + small horns
    g.fillStyle = skin; g.beginPath(); g.arc(1, -12, 6, 0, 7); g.fill();
    g.fillStyle = wing; g.beginPath(); g.moveTo(-4, -16); g.quadraticCurveTo(-12, -8, -8, 8); g.quadraticCurveTo(-4, -2, -3, -12); g.closePath(); g.fill();
    g.fillStyle = '#2a0c1c'; g.beginPath(); g.moveTo(-3, -17); g.lineTo(-5, -23); g.lineTo(-1, -18); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(4, -17); g.lineTo(6, -23); g.lineTo(2, -18); g.closePath(); g.fill();
    g.fillStyle = this.state === 'tele' ? '#ff4060' : '#ffd0d8'; g.fillRect(2, -13, 2.5, 2);
    g.restore();
  };
  return e;
}

// --- Imp: small ground demon of Lust; scuttles and lunges ---
function makeImp(spec) {
  const e = baseEnemy(spec, 24, 26);
  e.hp = e.maxHp = 2;
  e.gore = 'blood';
  e.knockable = true;
  e.dir = -1; e.hopT = 0;
  e.update = function (dt, pl) {
    this.animT += dt; this.flash -= dt; this.t += dt; this.hopT -= dt;
    const cx = this.x + this.w / 2, px = pl.x + pl.w / 2;
    const sameLevel = Math.abs((pl.y + pl.h) - (this.y + this.h)) < 70;
    if (sameLevel && Math.abs(px - cx) < 260) this.dir = px > cx ? 1 : -1; // chase
    else { if (this.x < this.min) this.dir = 1; if (this.x + this.w > this.max) this.dir = -1; }
    if (!groundAhead(this, this.dir) && this.onGround) this.dir = -this.dir;
    this.facing = this.dir;
    this.vx = this.dir * 92;
    if (this.onGround && this.hopT <= 0 && sameLevel && Math.abs(px - cx) < 180) { this.vy = -300; this.hopT = 1.1; AudioSys.sfx('jump'); }
    this.vy += GRAV * dt; if (this.vy > 700) this.vy = 700;
    moveAndCollide(this, dt);
  };
  e.draw = function (camX, camY, time) {
    const g = ctx, sx = this.x + this.w / 2 - camX, sy = this.y + this.h - camY;
    g.save(); g.translate(sx, sy); g.scale(this.facing, 1);
    const body = this.flash > 0 ? '#fff' : '#8a1828';
    g.fillStyle = body;
    g.beginPath(); g.ellipse(0, -10, 11, 10, 0, 0, 7); g.fill();
    // legs
    const lp = Math.sin(time * 16) * 3;
    g.strokeStyle = body; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-5, -4); g.lineTo(-6 - lp, 0); g.moveTo(5, -4); g.lineTo(6 + lp, 0); g.stroke();
    // horns + eyes
    g.fillStyle = '#3a0a14';
    g.beginPath(); g.moveTo(-6, -18); g.lineTo(-9, -26); g.lineTo(-3, -19); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(6, -18); g.lineTo(9, -26); g.lineTo(3, -19); g.closePath(); g.fill();
    g.fillStyle = '#ffd23a'; g.fillRect(-5, -13, 3, 3); g.fillRect(3, -13, 3, 3);
    // little tail
    g.strokeStyle = body; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-9, -8); g.quadraticCurveTo(-16, -10 - Math.sin(time * 6) * 3, -14, -2); g.stroke();
    g.restore();
  };
  return e;
}

// --- Weeper: floating mourner, fires homing tear-orbs ---
function makeWeeper(spec) {
  const e = baseEnemy(spec, 26, 38);
  e.hp = e.maxHp = 2;
  e.deathColor = '#cfe0f0';
  e.gore = 'soul';
  e.anchor = 'center';
  e.cd = rand(1.0, 2.0);
  e.myOrbs = 0;
  e.update = function (dt, pl) {
    this.animT += dt; this.flash -= dt; this.cd -= dt;
    this.y = this.home.y + Math.sin(this.animT * 1.5) * 14;
    this.x = this.home.x - 13 + Math.sin(this.animT * 0.7) * 20;
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    const px = pl.x + pl.w / 2, py = pl.y + pl.h / 2;
    this.facing = px > cx ? 1 : -1;
    // tears
    if (Math.random() < 0.1) {
      Particles.spawn(cx + rand(-4, 4), cy - 8, { vx: 0, vy: 40, life: 0.6, size: 2, color: '#bcd8f0' });
    }
    if (dist2(cx, cy, px, py) < 430 * 430 && this.cd <= 0 && this.myOrbs < 2) {
      this.cd = 2.6;
      this.myOrbs++;
      const orb = makeOrb(cx, cy, this);
      Game.orbs.push(orb);
      AudioSys.sfx('orb');
    }
  };
  e.draw = function (camX, camY, time) {
    const g = ctx;
    const sx = this.x + this.w / 2 - camX, sy = this.y - camY;
    g.save();
    g.translate(sx, sy);
    const robe = this.flash > 0 ? '#fff' : '#7e8a9c';
    const robeD = this.flash > 0 ? '#fff' : '#5e6a7c';
    const face = this.flash > 0 ? '#fff' : '#dde6ee';
    // hooded floating figure, tattered hem
    g.fillStyle = robe;
    g.beginPath();
    g.moveTo(0, 2);
    g.quadraticCurveTo(-13, 10, -12, 26);
    const wob = Math.sin(time * 4 + this.animT) * 3;
    g.lineTo(-9, 36 + wob);
    g.lineTo(-4, 30);
    g.lineTo(0, 37 - wob);
    g.lineTo(4, 30);
    g.lineTo(9, 36 + wob);
    g.lineTo(12, 26);
    g.quadraticCurveTo(13, 10, 0, 2);
    g.closePath();
    g.fill();
    // hood shadow + face
    g.fillStyle = robeD;
    g.beginPath(); g.arc(0, 9, 8, 0, 7); g.fill();
    g.fillStyle = face;
    g.beginPath(); g.arc(this.facing * 1.5, 10, 5.5, 0, 7); g.fill();
    // weeping eyes (dark streaks)
    g.fillStyle = '#3a4654';
    g.fillRect(this.facing * 1.5 - 3, 8, 2, 6);
    g.fillRect(this.facing * 1.5 + 2, 8, 2, 6);
    g.restore();
  };
  return e;
}

// homing tear-orb projectile
function makeOrb(x, y, owner) {
  return {
    x, y, w: 12, h: 12, vx: 0, vy: 0,
    life: 6, dead: false, owner,
    rect() { return { x: this.x - 6, y: this.y - 6, w: 12, h: 12 }; },
    update(dt, pl) {
      this.life -= dt;
      if (this.life <= 0) this.dead = true;
      const px = pl.x + pl.w / 2, py = pl.y + pl.h / 2;
      const dx = px - this.x, dy = py - this.y;
      const d = Math.hypot(dx, dy) || 1;
      const sp = 105;
      // limited steering
      this.vx += (dx / d * sp - this.vx) * dt * 1.4;
      this.vy += (dy / d * sp - this.vy) * dt * 1.4;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (Math.random() < 0.3) Particles.spawn(this.x, this.y, {
        vx: -this.vx * 0.1, vy: -this.vy * 0.1, life: 0.4, size: 2, color: '#bcd8f0', glow: true,
      });
    },
    draw(camX, camY, time) {
      const g = ctx;
      const sx = this.x - camX, sy = this.y - camY;
      g.fillStyle = 'rgba(188,216,240,0.3)';
      g.beginPath(); g.arc(sx, sy, 9 + Math.sin(time * 9) * 1.5, 0, 7); g.fill();
      g.fillStyle = '#e8f2fc';
      g.beginPath(); g.arc(sx, sy, 4.5, 0, 7); g.fill();
    },
  };
}

// ---------------- BEATRICE (spirit guide) ----------------
function makeBeatrice() {
  return {
    idx: 0, x: BEATRICE_SPOTS[0].x, y: BEATRICE_SPOTS[0].y,
    state: 'visible', // visible | vanishing | hidden
    t: 0, animT: 0,
    advance() {
      if (this.state !== 'visible') return;
      this.state = 'vanishing';
      this.t = 0;
      AudioSys.sfx('spirit');
    },
    update(dt) {
      this.animT += dt;
      if (this.state === 'vanishing') {
        this.t += dt;
        if (Math.random() < 0.7) {
          Particles.spawn(this.x + rand(-8, 8), this.y + rand(0, 36), {
            vx: rand(20, 70), vy: rand(-50, -15), life: rand(0.5, 1.0),
            size: 2.5, color: '#bfeef0', glow: true,
          });
        }
        if (this.t > 0.9) {
          this.idx++;
          if (this.idx < BEATRICE_SPOTS.length) {
            this.x = BEATRICE_SPOTS[this.idx].x;
            this.y = BEATRICE_SPOTS[this.idx].y;
            this.state = 'visible';
          } else {
            this.state = 'hidden';
          }
        }
      }
    },
    draw(camX, camY, time) {
      if (this.state === 'hidden') return;
      const g = ctx;
      const sx = this.x - camX, sy = this.y - camY;
      if (sx < -80 || sx > VW + 80) return;
      let a = 0.9;
      if (this.state === 'vanishing') a = 0.9 * (1 - this.t / 0.9);
      const hover = Math.sin(time * 1.8) * 4;
      g.save();
      g.translate(sx, sy + hover);
      g.globalAlpha = a * 0.35;
      // glow
      const gl = g.createRadialGradient(0, 18, 4, 0, 18, 50);
      gl.addColorStop(0, 'rgba(160,235,235,0.9)');
      gl.addColorStop(1, 'rgba(160,235,235,0)');
      g.fillStyle = gl;
      g.fillRect(-50, -32, 100, 100);
      g.globalAlpha = a;
      // flowing dress
      g.fillStyle = '#d8f4f2';
      g.beginPath();
      g.moveTo(0, -6);
      g.quadraticCurveTo(-10, 8, -12, 30);
      g.quadraticCurveTo(-6 - Math.sin(time * 2.5) * 4, 38, 0, 34);
      g.quadraticCurveTo(8 + Math.sin(time * 2.2) * 4, 40, 12, 28);
      g.quadraticCurveTo(10, 6, 0, -6);
      g.closePath();
      g.fill();
      // head + hair
      g.beginPath(); g.arc(0, -12, 6.5, 0, 7); g.fill();
      g.fillStyle = '#aadede';
      g.beginPath();
      g.moveTo(-5, -17);
      g.quadraticCurveTo(-13, -8, -10, 8 + Math.sin(time * 2) * 3);
      g.quadraticCurveTo(-6, -2, -6, -10);
      g.closePath(); g.fill();
      // eyes closed (serene)
      g.fillStyle = '#5a8a8c';
      g.fillRect(-3, -12, 2.5, 1.5);
      g.fillRect(1, -12, 2.5, 1.5);
      g.globalAlpha = 1;
      g.restore();
      // rising motes
      if (Math.random() < 0.2 && this.state === 'visible') {
        Particles.spawn(this.x + rand(-12, 12), this.y + rand(10, 40), {
          vx: 0, vy: rand(-30, -12), life: rand(0.6, 1.2), size: 2, color: '#bfeef0', glow: true,
        });
      }
    },
  };
}
