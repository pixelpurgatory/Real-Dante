'use strict';
// ============================================================
// ASTERION, THE INFERNAL BULL — Minotaur boss at the Gates
// Arena: x 6760..7860, floor y=436
// ============================================================

const ARENA_L = 6760, ARENA_R = 7860, ARENA_FLOOR = 436;

function makeMinotaur() {
  return {
    x: 7560, y: ARENA_FLOOR - 92, w: 64, h: 92,
    vx: 0, vy: 0, facing: -1,
    hp: 50, maxHp: 50,
    state: 'dormant', t: 0, animT: 0,
    flash: 0, active: false, dead: false, phase2: false,
    nameT: 0, // name banner timer
    attackBox: null, lastAtk: '',

    rect() { return { x: this.x + 8, y: this.y + 6, w: this.w - 16, h: this.h - 6 }; },

    start() {
      if (this.state !== 'dormant') return;
      this.state = 'intro'; this.t = 0;
      this.active = true;
      this.nameT = 3.2;
      AudioSys.sfx('roar');
      AudioSys.setZone('boss');
      Game.shake(7, 0.8);
      Game.arenaWalls = [
        { x: ARENA_L - 40, y: 96, w: 40, h: 340, type: 'solid' },
        { x: ARENA_R, y: 96, w: 40, h: 340, type: 'solid' },
      ];
      AudioSys.sfx('gate');
    },

    reset() {
      this.x = 7560; this.y = ARENA_FLOOR - 92;
      this.vx = 0; this.vy = 0;
      this.hp = this.maxHp;
      this.state = 'dormant'; this.t = 0;
      this.active = false; this.dead = false; this.phase2 = false;
      this.attackBox = null;
      Game.arenaWalls = [];
      Game.waves = [];
    },

    takeHit(dmg, dir, atkDir) {
      if (this.dead || !this.active || this.state === 'intro') return false;
      const mult = this.state === 'crashed' ? 2 : 1;
      this.hp -= dmg * mult;
      this.flash = 0.1;
      Particles.burst(this.x + this.w / 2 + dir * 20, this.y + 40, '#ffd8a8', 6, 200, { life: 0.3 });
      if (!this.phase2 && this.hp <= this.maxHp / 2) {
        this.phase2 = true;
        this.state = 'enrage'; this.t = 0;
        this.attackBox = null;
        AudioSys.sfx('roar');
        Game.shake(6, 0.6);
      }
      if (this.hp <= 0) this.die();
      return true;
    },

    die() {
      this.dead = true;
      this.state = 'dying'; this.t = 0;
      this.attackBox = null;
      this.vx = 0;
      AudioSys.sfx('roar');
      AudioSys.sfx('die');
      Game.shake(10, 1.0);
      Game.freeze(0.25);
    },

    spd(v) { return this.phase2 ? v * 1.25 : v; },
    tel(v) { return this.phase2 ? v * 0.72 : v; },

    update(dt, pl) {
      this.animT += dt; this.flash -= dt; this.t += dt;
      if (this.nameT > 0) this.nameT -= dt;
      this.attackBox = null;
      const cx = this.x + this.w / 2;
      const px = pl.x + pl.w / 2;

      switch (this.state) {
        case 'dormant':
          // hulking shape waiting in the dark
          this.facing = -1;
          break;

        case 'intro':
          if (this.t > 0.4 && this.t < 1.2 && Math.random() < 0.5) {
            Particles.spawn(this.x + rand(0, this.w), this.y + rand(10, 50), {
              vx: rand(-20, 20), vy: rand(-60, -20), life: 0.5, size: 3, color: '#ff7838',
            });
          }
          if (this.t > 1.6) { this.state = 'choose'; this.t = 0; }
          break;

        case 'enrage':
          this.vx = 0;
          if (Math.random() < 0.6) {
            Particles.spawn(this.x + rand(0, this.w), this.y + rand(0, 60), {
              vx: rand(-30, 30), vy: rand(-90, -30), life: 0.5, size: 3, color: '#ff4828', glow: true,
            });
          }
          if (this.t > 1.0) { this.state = 'choose'; this.t = 0; }
          break;

        case 'choose': {
          this.facing = px > cx ? 1 : -1;
          if (this.t < 0.25) break;
          const d = Math.abs(px - cx);
          if (d < 150) {
            this.state = 'tele_axe'; this.t = 0;
          } else if (this.phase2 && Math.random() < 0.45 && this.lastAtk !== 'leap') {
            this.state = 'tele_leap'; this.t = 0;
          } else if (Math.random() < 0.72) {
            this.state = 'tele_charge'; this.t = 0;
            AudioSys.sfx('stomp');
          } else {
            this.state = 'walk'; this.t = 0;
          }
          break;
        }

        case 'walk':
          this.facing = px > cx ? 1 : -1;
          this.vx = this.facing * this.spd(95);
          if (this.t > 0.7) { this.state = 'choose'; this.t = 0; this.vx = 0; }
          break;

        case 'tele_charge': {
          this.vx = 0;
          this.facing = px > cx ? 1 : -1;
          // paw the ground: dust kicks
          if (Math.random() < 0.5) {
            Particles.spawn(this.x + this.w / 2 - this.facing * 20, this.y + this.h, {
              vx: -this.facing * rand(60, 130), vy: rand(-40, -10), life: 0.4, size: 3, color: '#8a5a3a',
            });
          }
          if (this.t > this.tel(0.7)) {
            this.state = 'charge'; this.t = 0;
            this.lastAtk = 'charge';
            this.vx = this.facing * this.spd(520);
            AudioSys.sfx('roar');
          }
          break;
        }

        case 'charge': {
          this.attackBox = { x: this.x + (this.facing > 0 ? 18 : -10), y: this.y + 16, w: this.w - 8, h: this.h - 16, dmg: 1, kb: 380 };
          if (Math.random() < 0.7) {
            Particles.spawn(this.x + this.w / 2 - this.facing * 26, this.y + this.h - 4, {
              vx: -this.facing * rand(40, 100), vy: rand(-60, -10), life: 0.35, size: 3.5, color: '#8a5a3a',
            });
          }
          if (this.hitWall) {
            this.state = 'crashed'; this.t = 0; this.vx = 0;
            Game.shake(9, 0.5);
            AudioSys.sfx('slam');
            Particles.burst(this.x + this.w / 2 + this.facing * 30, this.y + 40, '#caa', 18, 300);
          } else if (this.t > 2.2) {
            this.state = 'choose'; this.t = 0; this.vx = 0;
          }
          break;
        }

        case 'crashed':
          this.vx = 0;
          if (this.t > (this.phase2 ? 1.0 : 1.5)) { this.state = 'choose'; this.t = 0; }
          break;

        case 'tele_axe':
          this.vx = 0;
          this.facing = px > cx ? 1 : -1;
          if (this.t > this.tel(0.55)) {
            this.state = 'axe'; this.t = 0;
            this.lastAtk = 'axe';
            AudioSys.sfx('thrust');
            Game.addFx('bigslash', this.x + this.w / 2 + this.facing * 56, this.y + 52, { flip: this.facing, rot: 0 });
          }
          break;

        case 'axe': {
          if (this.t < 0.2) {
            const bx = this.facing > 0 ? this.x + this.w - 6 : this.x - 96;
            this.attackBox = { x: bx, y: this.y + 8, w: 102, h: this.h - 8, dmg: 2, kb: 320 };
          }
          if (this.t > this.tel(0.75)) { this.state = 'choose'; this.t = 0; }
          break;
        }

        case 'tele_leap':
          this.vx = 0;
          this.facing = px > cx ? 1 : -1;
          if (this.t > this.tel(0.45)) {
            this.state = 'leap'; this.t = 0;
            this.lastAtk = 'leap';
            this.vy = -640;
            const tx = clamp(px - this.w / 2, ARENA_L + 30, ARENA_R - this.w - 30);
            this.vx = (tx - this.x) / 0.86; // reach target at landing time
            AudioSys.sfx('stomp');
          }
          break;

        case 'leap':
          if (this.t > 0.15 && this.onGround) {
            this.state = 'slam'; this.t = 0; this.vx = 0;
            Game.shake(10, 0.5);
            AudioSys.sfx('slam');
            Particles.burst(this.x + this.w / 2, this.y + this.h, '#c8a06a', 22, 280, { life: 0.5 });
            // twin shockwaves
            Game.waves.push(makeWave(this.x + this.w / 2 - 14, ARENA_FLOOR, -1));
            Game.waves.push(makeWave(this.x + this.w / 2 + 14, ARENA_FLOOR, 1));
          }
          break;

        case 'slam':
          this.attackBox = this.t < 0.12 ? { x: this.x - 14, y: this.y + this.h - 40, w: this.w + 28, h: 44, dmg: 1, kb: 300 } : null;
          if (this.t > 0.7) { this.state = 'choose'; this.t = 0; }
          break;

        case 'dying': {
          this.vx = 0;
          if (Math.random() < 0.8) {
            Particles.spawn(this.x + rand(0, this.w), this.y + rand(0, this.h), {
              vx: rand(-60, 60), vy: rand(-160, -40), life: rand(0.4, 1.0),
              size: rand(2, 4), color: Math.random() < 0.5 ? '#ff6838' : '#3a2030', glow: true,
            });
          }
          if (this.t > 2.2 && !this.finished) {
            this.finished = true;
            Particles.burst(this.x + this.w / 2, this.y + 40, '#ffd9a8', 40, 420, { life: 1.2 });
            Particles.soulTo(this.x + this.w / 2, this.y + 40, 20);
            Game.onBossDead();
          }
          break;
        }
      }

      // physics (skip when dormant/dying-finished)
      if (this.state !== 'dormant') {
        this.vy += GRAV * dt;
        if (this.vy > 900) this.vy = 900;
        moveAndCollide(this, dt);
      }

      // contact + attack damage to player
      if (!this.dead && this.active && this.state !== 'intro') {
        if (this.attackBox && rectsOverlap(this.attackBox, pl)) {
          pl.hurt(this.attackBox.dmg, this.x + this.w / 2);
        } else if (rectsOverlap(this.rect(), pl)) {
          pl.hurt(1, this.x + this.w / 2);
        }
      }
    },

    draw(camX, camY, time) {
      if (this.finished) return;
      const g = ctx;
      const sx = this.x + this.w / 2 - camX, sy = this.y + this.h - camY;
      if (sx < -200 || sx > VW + 200) return;
      g.save();
      g.translate(sx, sy);
      g.scale(this.facing, 1);

      const dyingFade = this.state === 'dying' ? clamp(1 - this.t / 2.2, 0, 1) : 1;
      g.globalAlpha = dyingFade;

      const fur = this.flash > 0 ? '#fff' : '#33222c';
      const furD = this.flash > 0 ? '#fff' : '#241620';
      const skin = this.flash > 0 ? '#fff' : '#7a4a3c';
      const horn = this.flash > 0 ? '#fff' : '#d8cdb8';
      const eye = this.phase2 ? '#ff3020' : '#ffb030';

      const crouchT = (this.state === 'tele_charge' || this.state === 'tele_leap') ? Math.min(this.t * 3, 1) : 0;
      const crash = this.state === 'crashed';
      const lean = this.state === 'charge' ? 0.35 : crouchT * -0.15;
      const breathe = Math.sin(time * (this.state === 'choose' ? 3 : 6)) * 2;

      g.rotate(lean);
      if (crash) g.rotate(-0.25);

      // legs
      const lp = (Math.abs(this.vx) > 40) ? Math.sin(time * 14) * 6 : 0;
      g.fillStyle = furD;
      g.fillRect(-22 + lp * 0.5, -34, 13, 34);
      g.fillRect(6 - lp * 0.5, -34, 13, 34);
      // hooves
      g.fillStyle = '#16101a';
      g.fillRect(-22 + lp * 0.5, -7, 13, 7);
      g.fillRect(6 - lp * 0.5, -7, 13, 7);

      // massive torso
      g.fillStyle = fur;
      g.beginPath();
      g.moveTo(-26, -30);
      g.quadraticCurveTo(-34, -62 + breathe, -18, -76 + breathe);
      g.quadraticCurveTo(2, -86 + breathe, 22, -74 + breathe);
      g.quadraticCurveTo(34, -62, 28, -36);
      g.quadraticCurveTo(12, -26, -26, -30);
      g.closePath();
      g.fill();
      // chest muscle highlight
      g.fillStyle = skin;
      g.beginPath();
      g.ellipse(8, -52 + breathe, 13, 16, -0.2, 0, 7);
      g.fill();
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.beginPath();
      g.ellipse(8, -46 + breathe, 10, 7, -0.2, 0, 7);
      g.fill();

      // head (bull)
      const hy = -78 + breathe + (crash ? 14 : 0);
      g.fillStyle = fur;
      g.beginPath();
      g.ellipse(18, hy, 14, 11, 0.15, 0, 7);
      g.fill();
      // snout
      g.fillStyle = skin;
      g.beginPath();
      g.ellipse(30, hy + 4, 8, 6, 0.2, 0, 7);
      g.fill();
      g.fillStyle = '#241620';
      g.fillRect(33, hy + 2, 2.5, 2.5);
      // nose ring
      g.strokeStyle = '#c8a84a'; g.lineWidth = 2;
      g.beginPath(); g.arc(36, hy + 8, 3.5, -0.4, Math.PI - 0.4); g.stroke();
      // horns
      g.fillStyle = horn;
      g.beginPath();
      g.moveTo(10, hy - 7);
      g.quadraticCurveTo(2, hy - 26, 14, hy - 34);
      g.quadraticCurveTo(8, hy - 22, 16, hy - 9);
      g.closePath(); g.fill();
      g.beginPath();
      g.moveTo(22, hy - 9);
      g.quadraticCurveTo(34, hy - 26, 24, hy - 38);
      g.quadraticCurveTo(32, hy - 22, 17, hy - 11);
      g.closePath(); g.fill();
      // eye
      g.fillStyle = eye;
      const telegraphing = this.state.startsWith('tele');
      const ew = telegraphing && Math.floor(time * 12) % 2 === 0 ? 5 : 3.5;
      g.fillRect(16, hy - 4, ew, 3.5);
      // breath steam when telegraphing charge
      if (this.state === 'tele_charge' && Math.random() < 0.6) {
        Particles.spawn(this.x + this.w / 2 + this.facing * 36, this.y + 16, {
          vx: this.facing * rand(40, 90), vy: rand(-20, 5), life: 0.35, size: 3, color: '#d8c8c0',
        });
      }

      // arms
      g.fillStyle = furD;
      if (this.state === 'tele_axe') {
        // axe raised
        g.save();
        g.translate(10, -64);
        g.rotate(-1.9);
        this.drawAxe(g, horn);
        g.restore();
        g.fillRect(6, -72, 10, 26);
      } else if (this.state === 'axe') {
        g.save();
        g.translate(14, -54);
        g.rotate(0.9);
        this.drawAxe(g, horn);
        g.restore();
        g.fillRect(8, -60, 10, 24);
      } else {
        // arm hanging with axe down
        g.fillRect(-22, -62, 11, 34);
        g.fillRect(14, -62, 11, 32);
        g.save();
        g.translate(20, -32);
        g.rotate(0.2);
        this.drawAxe(g, horn);
        g.restore();
      }

      g.globalAlpha = 1;
      g.restore();
    },

    drawAxe(g, edge) {
      // haft
      g.fillStyle = '#4a3424';
      g.fillRect(-3, 0, 6, 44);
      // double head
      g.fillStyle = '#6a6a74';
      g.beginPath();
      g.moveTo(-3, 34);
      g.quadraticCurveTo(-22, 30, -24, 46);
      g.quadraticCurveTo(-14, 44, -3, 46);
      g.closePath(); g.fill();
      g.beginPath();
      g.moveTo(3, 34);
      g.quadraticCurveTo(22, 30, 24, 46);
      g.quadraticCurveTo(14, 44, 3, 46);
      g.closePath(); g.fill();
      g.fillStyle = edge;
      g.fillRect(-24, 44, 48, 3);
    },
  };
}

// ground shockwave from the slam
function makeWave(x, floorY, dir) {
  return {
    x, y: floorY - 30, w: 20, h: 30, dir, dead: false,
    speed: 330, life: 4,
    rect() { return this; },
    update(dt, pl) {
      this.x += this.dir * this.speed * dt;
      this.life -= dt;
      if (this.x < ARENA_L - 10 || this.x + this.w > ARENA_R + 10 || this.life <= 0) this.dead = true;
      if (Math.random() < 0.8) {
        Particles.spawn(this.x + rand(0, this.w), this.y + rand(6, 28), {
          vx: rand(-20, 20), vy: rand(-120, -50), life: 0.3, size: 3, color: '#ff7838', glow: true,
        });
      }
      if (rectsOverlap(this, pl)) {
        if (pl.hurt(1, this.x + this.w / 2)) { /* hit */ }
      }
    },
    draw(camX, camY, time) {
      const g = ctx;
      const sx = this.x - camX, sy = this.y - camY;
      g.fillStyle = 'rgba(255,120,56,0.85)';
      g.beginPath();
      g.moveTo(sx, sy + 30);
      g.lineTo(sx + 10, sy + Math.sin(time * 30) * 3);
      g.lineTo(sx + 20, sy + 30);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(255,220,150,0.9)';
      g.beginPath();
      g.moveTo(sx + 4, sy + 30);
      g.lineTo(sx + 10, sy + 10);
      g.lineTo(sx + 16, sy + 30);
      g.closePath();
      g.fill();
    },
  };
}
