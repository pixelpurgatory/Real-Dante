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
    hp: 34, maxHp: 34,
    state: 'dormant', t: 0, animT: 0,
    flash: 0, active: false, dead: false, phase2: false,
    nameT: 0, // name banner timer
    attackBox: null, lastAtk: '',
    stillT: 0, lastX: 7560,
    gore: 'blood',
    barName: 'ASTERION, THE INFERNAL BULL',
    title: 'A S T E R I O N', subtitle: 'Warden of the Gate, the Bull of Crete',

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
      this.stillT = 0; this.lastX = this.x;
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
        if (Game.bossLine) Game.bossLine('asterion', "NO MORE GAMES, LITTLE KING. THE LABYRINTH ENDS IN BLOOD.");
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

      // watchdog: never loiter in one place for 4s — leap back to the centre
      if (this.active && !this.dead) {
        if (Math.abs(this.x - this.lastX) > 6) { this.lastX = this.x; this.stillT = 0; }
        else this.stillT += dt;
        if (this.stillT > 4 && (this.state === 'choose' || this.state === 'walk' || this.state === 'crashed')) {
          this.stillT = 0; this.state = 'tele_recover'; this.t = 0;
        }
      }

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
          if (this.t < 0.22) break;
          const d = Math.abs(px - cx);
          const r = Math.random();
          if (d < 170) {
            // close: alternate between the axe cleave and a wide horn sweep
            this.state = (r < 0.5) ? 'tele_axe' : 'tele_sweep'; this.t = 0;
          } else if (this.phase2 && r < 0.45 && this.lastAtk !== 'leap') {
            this.state = 'tele_leap'; this.t = 0;
          } else if (r < 0.74) {
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
          // dazed against the wall, double-damage window — then he ALWAYS
          // recovers by leaping back to the middle (never camps the corner)
          this.vx = 0;
          if (this.t > (this.phase2 ? 0.8 : 1.1)) { this.state = 'tele_recover'; this.t = 0; }
          break;

        case 'tele_recover':
          // crouch then leap to the centre of the arena
          this.vx = 0;
          if (Math.random() < 0.5) Particles.spawn(this.x + rand(0, this.w), this.y + this.h, { vx: rand(-40, 40), vy: rand(-30, -5), life: 0.3, size: 3, color: '#8a5a3a' });
          if (this.t > 0.4) {
            this.state = 'recover_leap'; this.t = 0;
            this.vy = -560;
            const tx = (ARENA_L + ARENA_R) / 2 - this.w / 2;
            this.vx = (tx - this.x) / 0.78;
            AudioSys.sfx('stomp');
          }
          break;

        case 'recover_leap':
          if (this.t > 0.15 && this.onGround) {
            this.state = 'slam'; this.t = 0; this.vx = 0;
            Game.shake(8, 0.4);
            AudioSys.sfx('slam');
            Particles.burst(this.x + this.w / 2, this.y + this.h, '#c8a06a', 18, 240, { life: 0.5 });
            Game.waves.push(makeWave(this.x + this.w / 2 - 14, ARENA_FLOOR, -1));
            Game.waves.push(makeWave(this.x + this.w / 2 + 14, ARENA_FLOOR, 1));
          }
          break;

        case 'tele_sweep':
          this.vx = 0;
          this.facing = px > cx ? 1 : -1;
          if (this.t > this.tel(0.5)) {
            this.state = 'sweep'; this.t = 0; this.lastAtk = 'sweep';
            AudioSys.sfx('roar');
            Game.addFx('bigslash', this.x + this.w / 2 + this.facing * 50, this.y + 40, { flip: this.facing, rot: 0 });
          }
          break;

        case 'sweep': {
          // a fast wide horn swing that also lunges him forward a little
          this.vx = this.facing * this.spd(120);
          if (this.t < 0.26) {
            const bx = this.facing > 0 ? this.x + this.w - 14 : this.x - 78;
            this.attackBox = { x: bx, y: this.y + 24, w: 92, h: this.h - 24, dmg: 1, kb: 360 };
          } else this.vx = 0;
          if (this.t > this.tel(0.6)) { this.state = 'choose'; this.t = 0; }
          break;
        }

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

      // contact + attack damage to player (stomping his back is safe + bounces)
      if (!this.dead && this.active && this.state !== 'intro') {
        if (this.attackBox && rectsOverlap(this.attackBox, pl)) {
          pl.hurt(this.attackBox.dmg, this.x + this.w / 2);
        } else if (rectsOverlap(this.rect(), pl)) {
          if (isStomp(pl, this.rect())) { pl.vy = -380; pl.canDash = true; }
          else pl.hurt(1, this.x + this.w / 2);
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

      const crouchT = (this.state === 'tele_charge' || this.state === 'tele_leap' || this.state === 'tele_recover' || this.state === 'tele_sweep') ? Math.min(this.t * 3, 1) : 0;
      const crash = this.state === 'crashed';
      const lean = (this.state === 'charge' || this.state === 'sweep' || this.state === 'recover_leap') ? 0.32 : crouchT * -0.15;
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

// ============================================================
// LILITH, Mother of First Desire — boss of the Lust circle
// Seduction as a weapon: a pulling song, a smoke-teleport kiss-slash, fruit
// you must read by its glow, and a corrupted-Eden second phase of red beams.
// ============================================================
function makeLilith() {
  return {
    x: (LILITH_L + LILITH_R) / 2 - 28, y: LILITH_FLOOR - 150,
    w: 56, h: 138, hoverY: LILITH_FLOOR - 150,
    vx: 0, vy: 0, facing: -1, alpha: 1,
    hp: 40, maxHp: 40,
    state: 'dormant', t: 0, animT: 0, flash: 0,
    active: false, dead: false, finished: false, phase2: false,
    nameT: 0, attackBox: null, gore: 'blood',
    beamAng: 0, beamN: 4, lastAtk: '',
    barName: 'LILITH, MOTHER OF FIRST DESIRE',
    title: 'L I L I T H', subtitle: 'The First Wife, the First Refusal',

    rect() { return { x: this.x + 12, y: this.y + 8, w: this.w - 24, h: this.h - 12 }; },

    start() {
      if (this.state !== 'dormant') return;
      this.state = 'intro'; this.t = 0; this.active = true; this.nameT = 3.6;
      if (Game.bossLine) Game.bossLine('lilith', "At last. A heart that still beats. Come closer, poet — I only want to look at you.");
      AudioSys.sfx('roar'); AudioSys.setZone('boss'); Game.shake(7, 0.8);
      Game.arenaWalls = [
        { x: LILITH_L - 40, y: 60, w: 40, h: 420, type: 'solid' },
        { x: LILITH_R, y: 60, w: 40, h: 420, type: 'solid' },
      ];
      AudioSys.sfx('gate');
    },
    reset() {
      this.x = (LILITH_L + LILITH_R) / 2 - 28; this.y = LILITH_FLOOR - 150;
      this.vx = 0; this.vy = 0; this.alpha = 1; this.hp = this.maxHp;
      this.state = 'dormant'; this.t = 0; this.active = false; this.dead = false;
      this.finished = false; this.phase2 = false; this.attackBox = null;
      Game.arenaWalls = []; Game.fruits = []; Game.lilithCorrupted = false;
    },
    takeHit(dmg, dir) {
      if (this.dead || !this.active || this.state === 'intro' || this.state === 'vanish' || this.alpha < 0.4) return false;
      this.hp -= dmg; this.flash = 0.1;
      Gore.hit(this.x + this.w / 2, this.y + this.h / 2, dir, 'blood', dmg > 1);
      if (!this.phase2 && this.hp <= this.maxHp * 0.5) {
        this.phase2 = true; this.state = 'corrupt'; this.t = 0; this.attackBox = null;
        Game.lilithCorrupted = true;
        if (Game.bossLine) Game.bossLine('lilith', "You refuse me? Then see what refusal made of ME.");
        AudioSys.sfx('roar'); Game.shake(9, 1.0);
      }
      if (this.hp <= 0) this.die();
      return true;
    },
    die() {
      this.dead = true; this.state = 'dying'; this.t = 0; this.attackBox = null; this.vx = 0;
      AudioSys.sfx('spirit'); Game.freeze(0.3);
    },
    tel(v) { return this.phase2 ? v * 0.74 : v; },

    update(dt, pl) {
      this.animT += dt; this.flash -= dt; this.t += dt;
      if (this.nameT > 0) this.nameT -= dt;
      this.attackBox = null;
      const lcx = this.x + this.w / 2, lcy = this.y + this.h * 0.45;
      const px = pl.x + pl.w / 2, py = pl.y + pl.h / 2;
      if (this.state !== 'kiss_appear' && this.state !== 'kiss_slash') this.facing = px > lcx ? 1 : -1;

      switch (this.state) {
        case 'dormant': break;
        case 'intro':
          if (this.t > 1.9) { this.state = 'choose'; this.t = 0; }
          break;
        case 'corrupt': // brief enrage transformation
          if (Math.random() < 0.7) Particles.spawn(lcx + rand(-30, 30), this.y + rand(0, this.h), { vx: rand(-40, 40), vy: rand(-80, -20), life: 0.6, size: 3, color: '#ff2840', glow: true });
          if (this.t > 1.1) { this.state = 'choose'; this.t = 0; }
          break;

        case 'choose': {
          this.y += (this.hoverY - this.y) * dt * 2;
          if (this.t < 0.35) break;
          const r = Math.random();
          if (this.phase2 && r < 0.34) { this.state = 'tele_beams'; this.t = 0; }
          else if (r < 0.34) { this.state = 'song'; this.t = 0; this.lastAtk = 'song'; }
          else if (r < 0.7) { this.state = 'vanish'; this.t = 0; this.lastAtk = 'kiss'; }
          else { this.state = 'fruit'; this.t = 0; }
          break;
        }

        case 'song': {
          // she sings; the player is pulled toward her and must walk away
          this.y += (this.hoverY - this.y) * dt * 2;
          const pull = this.phase2 ? 150 : 110;
          if (pl.hitstun <= 0 && !pl.dead) pl.x += (lcx > px ? 1 : -1) * pull * dt;
          if (Math.random() < 0.5) Particles.spawn(lcx + rand(-10, 10), this.y + 30, { vx: (px - lcx) * 0.4 * dt * 60 * 0.05, vy: 0, life: 0.6, size: 2.5, color: '#ff9ec0', glow: true });
          if (this.t > this.tel(1.8)) { this.state = 'choose'; this.t = 0; }
          break;
        }

        case 'vanish':
          this.alpha = 1 - this.t / 0.4;
          if (Math.random() < 0.8) Particles.spawn(lcx + rand(-20, 20), this.y + rand(0, this.h), { vx: rand(-30, 30), vy: rand(-20, 20), life: 0.5, size: 3, color: '#c83a66', glow: true });
          if (this.t > 0.4) {
            // reappear just behind the player for a kiss-slash
            const side = (pl.facing >= 0) ? -1 : 1; // behind their back
            this.x = clamp(px + side * 56 - this.w / 2, LILITH_L + 20, LILITH_R - this.w - 20);
            this.y = LILITH_FLOOR - this.h - 4;
            this.facing = px > (this.x + this.w / 2) ? 1 : -1;
            this.state = 'kiss_appear'; this.t = 0; this.alpha = 0;
            AudioSys.sfx('spirit');
          }
          break;
        case 'kiss_appear':
          this.alpha = Math.min(1, this.t / 0.22);
          if (this.t > 0.26) { this.state = 'kiss_slash'; this.t = 0; AudioSys.sfx('swing'); Game.addFx('slash', this.x + this.w / 2 + this.facing * 30, this.y + 50, { flip: this.facing, rot: 0 }); }
          break;
        case 'kiss_slash': {
          if (this.t < 0.18) { const bx = this.facing > 0 ? this.x + this.w - 6 : this.x - 52; this.attackBox = { x: bx, y: this.y + 30, w: 58, h: 60, dmg: 1, kb: 300 }; }
          if (this.t > this.tel(0.5)) { this.state = 'choose'; this.t = 0; }
          break;
        }

        case 'fruit':
          this.y += (this.hoverY - this.y) * dt * 2;
          if (this.t > 0.5 && !this._dropped) {
            this._dropped = true;
            const count = this.phase2 ? 5 : 4;
            for (let i = 0; i < count; i++) {
              const fx = clamp(px + rand(-220, 220), LILITH_L + 40, LILITH_R - 40);
              Game.fruits.push(makeFruit(fx, Math.random() < 0.5 ? 'heal' : 'poison'));
            }
            AudioSys.sfx('orb');
          }
          if (this.t > 1.0) { this._dropped = false; this.state = 'choose'; this.t = 0; }
          break;

        case 'tele_beams':
          this.y += (this.hoverY - this.y) * dt * 2;
          if (Math.random() < 0.6) Particles.spawn(lcx, lcy, { vx: rand(-60, 60), vy: rand(-60, 60), life: 0.4, size: 3, color: '#ff2030', glow: true });
          if (this.t > 0.9) { this.state = 'beams'; this.t = 0; this.beamAng = Math.random() * 6.28; AudioSys.sfx('shriek'); }
          break;
        case 'beams': {
          // halo split into rotating red beams (readable, telegraphed above)
          this.beamAng += dt * 1.3;
          const ang = Math.atan2(py - lcy, px - lcx);
          const dist = Math.hypot(px - lcx, py - lcy);
          if (dist > 46 && pl.invuln <= 0) {
            for (let k = 0; k < this.beamN; k++) {
              let ba = this.beamAng + k * (Math.PI * 2 / this.beamN);
              let d = Math.atan2(Math.sin(ang - ba), Math.cos(ang - ba));
              if (Math.abs(d) < 0.11) { pl.hurt(1, lcx); break; }
            }
          }
          if (this.t > 2.4) { this.state = 'choose'; this.t = 0; }
          break;
        }

        case 'dying': {
          this.alpha = clamp(1 - this.t / 2.6, 0, 1);
          // she does not explode — she dissolves into red moths
          if (Math.random() < 0.9) Particles.spawn(lcx + rand(-20, 20), this.y + rand(0, this.h), { vx: rand(-50, 50), vy: rand(-80, -10), life: rand(0.8, 1.6), size: rand(2, 4), color: Math.random() < 0.5 ? '#c81830' : '#e85a78', glow: true, grav: -30 });
          if (this.t > 0.6 && !this._line1) { this._line1 = true; if (Game.bossLine) Game.bossLine('lilith', "Mmm... you truly won't be tempted. How rare. How... disappointing."); }
          if (this.t > 2.0 && !this._line2) { this._line2 = true; if (Game.bossLine) Game.bossLine('lilith', "Ask your Beatrice what she dreamed of, down here in the dark... and whose name. Father will be so pleased you came this far."); }
          if (this.t > 2.6 && !this.finished) {
            this.finished = true;
            Game.lilithCorrupted = false;
            Game.onLilithDead();
          }
          break;
        }
      }

      // her attacks hurt; her body does not (per design)
      if (!this.dead && this.active && this.state !== 'intro' && this.alpha > 0.5) {
        if (this.attackBox && rectsOverlap(this.attackBox, pl)) pl.hurt(this.attackBox.dmg, this.x + this.w / 2);
      }
    },

    draw(camX, camY, time) {
      if (this.finished) return;
      const g = ctx;
      const sx = this.x + this.w / 2 - camX, sy = this.y + this.h - camY;
      if (sx < -260 || sx > VW + 260) return;
      // telegraph / active beams drawn from her centre
      if (this.state === 'beams' || this.state === 'tele_beams') {
        const lcx = this.x + this.w / 2 - camX, lcy = this.y + this.h * 0.45 - camY;
        const active = this.state === 'beams';
        const len = active ? 900 : 260 * Math.min(1, this.t / 0.9);
        g.save();
        for (let k = 0; k < this.beamN; k++) {
          const ba = (active ? this.beamAng : 0) + k * (Math.PI * 2 / this.beamN);
          g.strokeStyle = active ? 'rgba(255,40,56,0.85)' : 'rgba(255,60,80,0.35)';
          g.lineWidth = active ? 7 : 4;
          g.beginPath(); g.moveTo(lcx, lcy); g.lineTo(lcx + Math.cos(ba) * len, lcy + Math.sin(ba) * len); g.stroke();
        }
        g.restore();
      }
      g.save();
      g.translate(sx, sy);
      g.globalAlpha = clamp(this.alpha, 0, 1) * (this.state === 'dying' ? clamp(1 - this.t / 2.6, 0, 1) : 1);
      g.scale(this.facing, 1);
      const skin = this.flash > 0 ? '#fff' : '#cf7a82';
      const gown = this.flash > 0 ? '#fff' : (this.phase2 ? '#3a0814' : '#8a1840');
      const hair = this.flash > 0 ? '#fff' : '#1a0610';
      const wing = this.phase2 ? '#0a0408' : '#5a1230';
      const float = Math.sin(time * 1.6) * 5;
      // wings: feathered in P1, black angel wings in P2
      g.fillStyle = wing;
      for (const s of [-1, 1]) {
        g.save(); g.scale(s, 1); g.rotate(-0.3 + Math.sin(time * 3) * 0.1);
        g.beginPath(); g.moveTo(0, -80 + float);
        if (this.phase2) { g.quadraticCurveTo(54, -120, 70, -54); g.quadraticCurveTo(48, -70, 30, -50); g.quadraticCurveTo(50, -40, 24, -36); }
        else { g.quadraticCurveTo(46, -104, 60, -60); g.quadraticCurveTo(40, -70, 22, -54); }
        g.closePath(); g.fill();
        g.restore();
      }
      // flowing gown
      g.fillStyle = gown;
      g.beginPath(); g.moveTo(0, -104 + float);
      g.quadraticCurveTo(26, -70, 18, -2); g.lineTo(-18, -2); g.quadraticCurveTo(-26, -70, 0, -104 + float);
      g.closePath(); g.fill();
      // bodice highlight
      g.fillStyle = skin; g.beginPath(); g.ellipse(0, -82 + float, 11, 16, 0, 0, 7); g.fill();
      g.fillStyle = gown; g.beginPath(); g.ellipse(0, -74 + float, 13, 12, 0, 0, 7); g.fill();
      // head + long hair
      g.fillStyle = skin; g.beginPath(); g.arc(0, -114 + float, 9, 0, 7); g.fill();
      g.fillStyle = hair;
      g.beginPath(); g.moveTo(-8, -120 + float); g.quadraticCurveTo(-20, -90, -12, -40); g.quadraticCurveTo(-6, -80, -6, -116 + float); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(8, -120 + float); g.quadraticCurveTo(18, -92, 12, -46); g.quadraticCurveTo(6, -82, 6, -116 + float); g.closePath(); g.fill();
      // eyes (glowing red in P2 / when singing)
      g.fillStyle = (this.phase2 || this.state === 'song') ? '#ff2840' : '#3a1018';
      g.fillRect(2, -116 + float, 3, 2.5);
      // crown / halo (splits in P2)
      if (this.phase2) { g.strokeStyle = '#ff2030'; g.lineWidth = 2; g.beginPath(); g.arc(0, -126 + float, 11, -0.6, Math.PI + 0.6); g.stroke(); }
      else { g.strokeStyle = '#caa84a'; g.lineWidth = 2; g.beginPath(); g.arc(0, -128 + float, 10, Math.PI, 0); g.stroke(); }
      g.globalAlpha = 1;
      g.restore();
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

// ============================================================
// DEATH — the Pale Reaper, boss of Purgatory's summit
// Arena: DEATH_ARENA_L..R, floor DEATH_FLOOR. He hovers and teleports.
// ============================================================
function makeDeath() {
  return {
    x: (DEATH_ARENA_L + DEATH_ARENA_R) / 2 - 34, y: DEATH_FLOOR - 158,
    w: 68, h: 150,
    vx: 0, vy: 0, facing: -1, hoverY: DEATH_FLOOR - 158, // floats low enough to hit
    hp: 44, maxHp: 44, alpha: 1,
    state: 'dormant', t: 0, animT: 0, flash: 0,
    active: false, dead: false, finished: false, phase2: false, phase3: false,
    nameT: 0, attackBox: null, scytheAng: 0, gore: 'soul', lastAtk: '',
    barName: 'DEATH, THE PALE REAPER',
    title: 'D E A T H', subtitle: 'Who keeps all that the world lets fall',

    rect() { return { x: this.x + 14, y: this.y + 10, w: this.w - 28, h: this.h - 14 }; },

    start() {
      if (this.state !== 'dormant') return;
      this.state = 'intro'; this.t = 0; this.active = true; this.nameT = 3.4;
      if (Game.bossLine) Game.bossLine('death', "You are early, pilgrim. They always are. Come — let me make you punctual.");
      AudioSys.sfx('roar'); AudioSys.setZone('boss'); Game.shake(8, 0.9);
      Game.arenaWalls = [
        { x: DEATH_ARENA_L - 40, y: 60, w: 40, h: 400, type: 'solid' },
        { x: DEATH_ARENA_R, y: 60, w: 40, h: 400, type: 'solid' },
      ];
      AudioSys.sfx('gate');
    },
    reset() {
      this.x = (DEATH_ARENA_L + DEATH_ARENA_R) / 2 - 34; this.y = DEATH_FLOOR - 158;
      this.vx = 0; this.vy = 0; this.alpha = 1;
      this.hp = this.maxHp; this.state = 'dormant'; this.t = 0;
      this.active = false; this.dead = false; this.finished = false; this.phase2 = false; this.phase3 = false;
      this.attackBox = null; Game.arenaWalls = [];
    },
    takeHit(dmg, dir) {
      if (this.dead || !this.active || this.state === 'intro' || this.state === 'vanish' || this.alpha < 0.4) return false;
      this.hp -= dmg; this.flash = 0.1;
      Gore.hit(this.x + this.w / 2, this.y + this.h / 2, dir, 'soul', dmg > 1);
      if (!this.phase2 && this.hp <= this.maxHp * 0.5) {
        this.phase2 = true; this.state = 'enrage'; this.t = 0; this.attackBox = null;
        if (Game.bossLine) Game.bossLine('death', "You are stubborn, little flame. Good. Embers burn longest.");
        AudioSys.sfx('roar'); Game.shake(7, 0.7);
      } else if (!this.phase3 && this.hp <= this.maxHp * 0.4) {
        this.phase3 = true; this.state = 'enrage'; this.t = 0; this.attackBox = null;
        if (Game.bossLine) Game.bossLine('death', "Then I stop playing the patient harvester.");
        AudioSys.sfx('roar'); Game.shake(9, 0.9);
      }
      if (this.hp <= 0) this.die();
      return true;
    },
    die() {
      this.dead = true; this.state = 'dying'; this.t = 0; this.attackBox = null; this.vx = 0;
      if (Game.bossLine) Game.bossLine('death', "Spared... for now. But no one cheats me twice. I will be there at the end of all your circles.");
      AudioSys.sfx('die'); Game.shake(10, 1.1); Game.freeze(0.3);
    },
    tel(v) { return this.phase2 ? v * 0.72 : v; },

    update(dt, pl) {
      this.animT += dt; this.flash -= dt; this.t += dt;
      if (this.nameT > 0) this.nameT -= dt;
      this.attackBox = null; this.scytheAng = Math.sin(this.animT * 2) * 0.15;
      const cx = this.x + this.w / 2, px = pl.x + pl.w / 2, py = pl.y + pl.h / 2;
      this.facing = px > cx ? 1 : -1;

      switch (this.state) {
        case 'dormant': break;
        case 'intro':
          if (Math.random() < 0.5) Particles.spawn(this.x + rand(0, this.w), this.y + rand(0, this.h), { vx: rand(-20, 20), vy: rand(-40, -10), life: 0.6, size: 3, color: '#bfe0ff', glow: true });
          if (this.t > 1.8) { this.state = 'choose'; this.t = 0; }
          break;
        case 'enrage':
          if (Math.random() < 0.7) Particles.spawn(this.x + rand(0, this.w), this.y + rand(0, this.h), { vx: rand(-40, 40), vy: rand(-80, -20), life: 0.6, size: 3, color: '#dff0ff', glow: true });
          if (this.t > 1.0) { this.state = 'choose'; this.t = 0; }
          break;

        case 'choose': {
          // gentle hover toward a holding position
          this.y += (this.hoverY - this.y) * dt * 2;
          if (this.t < 0.3) break;
          const d = Math.abs(px - cx);
          const r = Math.random();
          if (this.phase3 && r < 0.4) { this.state = 'tele_spin'; this.t = 0; }      // phase-3 reaping spin
          else if (this.phase3 && r < 0.6) { this.state = 'tele_nova'; this.t = 0; } // phase-3 soul nova
          else if (d < 150 && r < 0.6) { this.state = 'tele_scythe'; this.t = 0; }
          else if (r < 0.5) { this.state = 'tele_volley'; this.t = 0; }
          else if (r < 0.78) { this.state = 'vanish'; this.t = 0; this.lastAtk = 'tp'; }
          else { this.state = 'summon'; this.t = 0; }
          break;
        }

        case 'tele_spin':
          this.y += (this.hoverY - this.y) * dt * 2;
          if (Math.random() < 0.6) Particles.spawn(cx + rand(-40, 40), this.y + rand(20, 120), { vx: 0, vy: rand(-30, -5), life: 0.4, size: 3, color: '#bfe0ff', glow: true });
          if (this.t > this.tel(0.55)) { this.state = 'spin'; this.t = 0; AudioSys.sfx('roar'); }
          break;
        case 'spin': {
          // whirling scythe — a wide AoE around Death as he drifts at the player
          this.scytheAng = this.t * 22;
          this.x += (px > cx ? 1 : -1) * 90 * dt;
          this.attackBox = { x: this.x - 36, y: this.y + 6, w: this.w + 72, h: this.h - 12, dmg: 1, kb: 300 };
          if (Math.random() < 0.8) Particles.spawn(cx + Math.cos(this.scytheAng) * 70, this.y + 70 + Math.sin(this.scytheAng) * 50, { vx: 0, vy: 0, life: 0.25, size: 3, color: '#dff0ff', glow: true });
          if (this.t > this.tel(1.1)) { this.state = 'choose'; this.t = 0; }
          break;
        }

        case 'tele_nova':
          this.y += (this.hoverY - this.y) * dt * 2;
          if (this.t > this.tel(0.6)) {
            this.state = 'choose'; this.t = 0;
            // radial burst of soul-bolts in all directions
            const n = 12;
            for (let i = 0; i < n; i++) {
              const a = (i / n) * Math.PI * 2;
              const sp = 175;
              Game.shots.push(makeShot(cx, this.y + this.h * 0.5, Math.cos(a) * sp, Math.sin(a) * sp, 'soulbolt', 'enemy', 1));
            }
            AudioSys.sfx('shriek');
          }
          break;

        case 'tele_scythe':
          this.y += (this.hoverY - this.y) * dt * 2;
          if (this.t > this.tel(0.5)) {
            this.state = 'scythe'; this.t = 0;
            AudioSys.sfx('thrust');
            Game.addFx('bigslash', cx + this.facing * 70, this.y + this.h * 0.5, { flip: this.facing, rot: 0 });
          }
          break;
        case 'scythe': {
          // sweeping arc in front + a small forward glide
          this.x += this.facing * 130 * dt;
          if (this.t < 0.3) {
            const bx = this.facing > 0 ? this.x + this.w - 16 : this.x - 104;
            this.attackBox = { x: bx, y: this.y + 20, w: 120, h: this.h - 30, dmg: 1, kb: 320 };
          }
          if (this.t > this.tel(0.7)) { this.state = 'choose'; this.t = 0; }
          break;
        }

        case 'tele_volley':
          this.y += (this.hoverY - this.y) * dt * 2;
          if (this.t > this.tel(0.55)) {
            this.state = 'choose'; this.t = 0;
            // fan of soul-bolts toward the player
            const n = this.phase2 ? 5 : 3;
            const base = Math.atan2(py - (this.y + 40), px - cx);
            for (let i = 0; i < n; i++) {
              const a = base + (i - (n - 1) / 2) * 0.22;
              const sp = 200;
              Game.shots.push(makeShot(cx, this.y + 40, Math.cos(a) * sp, Math.sin(a) * sp, 'soulbolt', 'enemy', 1));
            }
            AudioSys.sfx('orb');
          }
          break;

        case 'vanish':
          this.alpha = 1 - this.t / 0.45;
          if (Math.random() < 0.8) Particles.spawn(this.x + rand(0, this.w), this.y + rand(0, this.h), { vx: rand(-30, 30), vy: rand(-30, 30), life: 0.5, size: 3, color: '#bfe0ff', glow: true });
          if (this.t > 0.45) {
            // reappear flanking the player, inside the arena
            const side = (px > (DEATH_ARENA_L + DEATH_ARENA_R) / 2) ? -1 : 1;
            this.x = clamp(px + side * 170 - this.w / 2, DEATH_ARENA_L + 20, DEATH_ARENA_R - this.w - 20);
            this.y = this.hoverY;
            this.state = 'appear'; this.t = 0;
            AudioSys.sfx('spirit');
          }
          break;
        case 'appear':
          this.alpha = this.t / 0.3;
          if (this.t > 0.3) { this.alpha = 1; this.state = 'tele_scythe'; this.t = 0; }
          break;

        case 'summon':
          this.y += (this.hoverY - this.y) * dt * 2;
          if (this.t > this.tel(0.6)) {
            this.state = 'choose'; this.t = 0;
            const n = this.phase2 ? 4 : 3;
            for (let i = 0; i < n; i++) Game.sinners.push(makeSinner(rand(DEATH_ARENA_L + 60, DEATH_ARENA_R - 60)));
            AudioSys.sfx('shriek');
          }
          break;

        case 'dying':
          this.alpha = clamp(1 - this.t / 2.4, 0, 1);
          if (Math.random() < 0.85) Particles.spawn(this.x + rand(0, this.w), this.y + rand(0, this.h), { vx: rand(-50, 50), vy: rand(-120, -20), life: rand(0.5, 1.2), size: rand(2, 4), color: Math.random() < 0.5 ? '#bfe0ff' : '#dff0ff', glow: true });
          if (this.t > 2.4 && !this.finished) {
            this.finished = true;
            Particles.burst(this.x + this.w / 2, this.y + this.h / 2, '#eaf4ff', 44, 420, { life: 1.3, glow: true });
            Game.onDeathBossDead();
          }
          break;
      }

      // only his attacks hurt — bumping into his body is safe (per design)
      if (!this.dead && this.active && this.state !== 'intro' && this.alpha > 0.5) {
        if (this.attackBox && rectsOverlap(this.attackBox, pl)) pl.hurt(this.attackBox.dmg, this.x + this.w / 2);
      }
    },

    draw(camX, camY, time) {
      if (this.finished) return;
      const g = ctx;
      const sx = this.x + this.w / 2 - camX, sy = this.y + this.h - camY;
      if (sx < -260 || sx > VW + 260) return;
      g.save();
      g.translate(sx, sy);
      g.globalAlpha = clamp(this.alpha, 0, 1) * (this.state === 'dying' ? clamp(1 - this.t / 2.4, 0, 1) : 1);
      g.scale(this.facing, 1);

      const robe = this.flash > 0 ? '#fff' : '#16131c';
      const robeHi = this.flash > 0 ? '#fff' : '#2a2434';
      const bone = this.flash > 0 ? '#fff' : '#d8d2c0';
      const eye = this.phase2 ? '#ff3a3a' : '#9ad8ff';
      const float = Math.sin(time * 1.6) * 5;

      // tattered robe (no legs — he floats, hem frays into wisps)
      g.fillStyle = robe;
      g.beginPath();
      g.moveTo(0, -120 + float);
      g.quadraticCurveTo(-34, -90 + float, -30, -30);
      const hem = -2 + float;
      g.lineTo(-26, hem + Math.sin(time * 6) * 6);
      g.lineTo(-18, hem - 8);
      g.lineTo(-10, hem + Math.sin(time * 6 + 1) * 8);
      g.lineTo(-2, hem - 6);
      g.lineTo(6, hem + Math.sin(time * 6 + 2) * 8);
      g.lineTo(14, hem - 8);
      g.lineTo(22, hem + Math.sin(time * 6 + 3) * 6);
      g.quadraticCurveTo(34, -90 + float, 0, -120 + float);
      g.closePath(); g.fill();
      // inner robe shading + ribs showing through
      g.fillStyle = robeHi;
      g.beginPath(); g.moveTo(-6, -116 + float); g.quadraticCurveTo(-20, -70 + float, -14, -30); g.lineTo(-2, -34); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(200,196,180,0.18)'; g.lineWidth = 2;
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-10, -96 + i * 12 + float); g.lineTo(8, -96 + i * 12 + float); g.stroke(); }

      // hood + skull
      const hy = -120 + float;
      g.fillStyle = robe;
      g.beginPath(); g.arc(2, hy, 18, Math.PI * 0.75, Math.PI * 2.3); g.closePath(); g.fill();
      g.fillStyle = bone;
      g.beginPath(); g.arc(5, hy + 2, 10, 0, 7); g.fill();
      g.fillStyle = '#0a0a12';
      g.beginPath(); g.arc(3, hy, 3, 0, 7); g.fill();
      g.beginPath(); g.arc(10, hy, 3, 0, 7); g.fill();
      g.fillStyle = eye; // glowing sockets
      g.beginPath(); g.arc(3, hy, 1.6, 0, 7); g.fill();
      g.beginPath(); g.arc(10, hy, 1.6, 0, 7); g.fill();
      // ram horns on the hood
      g.fillStyle = bone;
      g.beginPath(); g.moveTo(-12, hy - 8); g.quadraticCurveTo(-28, hy - 4, -24, hy + 12); g.quadraticCurveTo(-20, hy - 2, -8, hy - 4); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(18, hy - 8); g.quadraticCurveTo(34, hy - 4, 30, hy + 12); g.quadraticCurveTo(26, hy - 2, 14, hy - 4); g.closePath(); g.fill();

      // skeletal arm + the great scythe
      const swing = (this.state === 'scythe') ? lerp(-1.0, 1.1, clamp(this.t / 0.3, 0, 1))
                  : (this.state === 'tele_scythe') ? -1.1 : this.scytheAng;
      g.save();
      g.translate(16, -84 + float);
      g.rotate(swing);
      // haft
      g.strokeStyle = '#2a1c14'; g.lineWidth = 4;
      g.beginPath(); g.moveTo(0, 30); g.lineTo(0, -56); g.stroke();
      // blade
      g.fillStyle = '#b8bcc4';
      g.beginPath();
      g.moveTo(0, -56);
      g.quadraticCurveTo(54, -60, 64, -18);
      g.quadraticCurveTo(40, -40, 2, -40);
      g.closePath(); g.fill();
      g.strokeStyle = '#eef2f6'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(2, -56); g.quadraticCurveTo(48, -58, 60, -22); g.stroke();
      g.restore();
      // forearm
      g.fillStyle = bone; g.fillRect(8, -86 + float, 6, 26);

      g.globalAlpha = 1;
      g.restore();
    },
  };
}
