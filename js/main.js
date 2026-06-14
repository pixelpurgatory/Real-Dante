'use strict';
// ============================================================
// Main: game state machine, loop, camera, world interactions
// ============================================================

const Game = {
  state: 'title',          // title | play | victory
  paused: false,
  player: null, enemies: [], boss: null, beatrice: null,
  orbs: [], waves: [], fx: [],
  arenaWalls: [],
  triggers: [],
  camX: 0, camY: 0,
  shakeT: 0, shakeMag: 0, freezeT: 0,
  respawn: { x: 120, y: 402 },
  activeCheckpoint: 0,
  stats: { time: 0, deaths: 0, kills: 0 },
  cinematic: false,
  endStarted: false, endT: 0, victoryT: 0,
  respawnFade: 0,
  bossDefeated: false,
  titleCam: 0, titleDir: 1,
  time: 0,
  beatriceScene: null,

  init() {
    BG.init();
    Vignette.init();
    TouchUI.init();
    this.resetWorld(true);
  },

  resetWorld(full) {
    this.player = makePlayer(this.respawn.x, this.respawn.y);
    if (full) {
      this.respawn = { x: CHECKPOINTS[0].x, y: CHECKPOINTS[0].y };
      this.activeCheckpoint = 0;
      this.player = makePlayer(this.respawn.x, this.respawn.y);
      this.stats = { time: 0, deaths: 0, kills: 0 };
      this.bossDefeated = false;
      this.triggers = TRIGGERS.map(t => Object.assign({ fired: false }, t));
      this.beatrice = makeBeatrice();
      this.endStarted = false;
      this.cinematic = false;
      this.endT = 0; this.victoryT = 0;
      HUD.prevHp = this.player.hp;
    }
    this.enemies = ENEMY_SPAWNS.map(s => spawnEnemy(s)).filter(Boolean);
    this.orbs = [];
    this.waves = [];
    this.fx = [];
    this.arenaWalls = [];
    if (!this.boss || !this.bossDefeated) {
      this.boss = makeMinotaur();
    } else {
      this.boss.finished = true;
      this.boss.dead = true;
      this.boss.active = false;
    }
    if (this.bossDefeated) {
      this.boss = makeMinotaur();
      this.boss.dead = true;
      this.boss.finished = true;
      this.boss.active = false;
      this.boss.state = 'gone';
    }
    Dialogue.clear();
  },

  shake(mag, dur) {
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeT = Math.max(this.shakeT, dur);
  },
  freeze(t) { this.freezeT = Math.max(this.freezeT, t); },
  addFx(type, x, y, opts) {
    this.fx.push(Object.assign({ type, x, y, t: 0, life: type === 'bigslash' ? 0.22 : 0.16 }, opts));
  },

  onBossDead() {
    this.bossDefeated = true;
    this.arenaWalls = [];
    this.waves = [];
    AudioSys.setZone(musicZoneAt(this.player.x));
    Dialogue.say([
      { s: 'dante', t: "Even Hell's wardens fall. Hold on, Beatrice — I am coming." },
    ]);
    // set forward checkpoint automatically
    this.respawn = { x: CHECKPOINTS[3].x, y: CHECKPOINTS[3].y };
    this.activeCheckpoint = 3;
  },

  respawnPlayer() {
    this.stats.deaths++;
    const keepBossDead = this.bossDefeated;
    this.resetWorld(false);
    this.player.x = this.respawn.x;
    this.player.y = this.respawn.y;
    this.player.lastSafe = { x: this.respawn.x, y: this.respawn.y };
    this.respawnFade = 0.9;
    if (!keepBossDead) AudioSys.setZone(musicZoneAt(this.player.x));
  },

  startEnding() {
    this.endStarted = true;
    this.cinematic = true;
    this.endT = 0;
    AudioSys.setZone('limbo');
    Dialogue.say([
      { s: 'beatrice', t: "You should not have come, beloved. But since you have—" },
      { s: 'beatrice', t: "—know that I am not lost. Only kept. Eight circles below, the Keeper holds my light." },
      { s: 'dante', t: "Then circle by circle, I will unmake his hold." },
      { s: 'beatrice', t: "I know. That is why I love you. Walk with the morning star, my Dante." },
    ]);
  },

  // -------------- update --------------
  update(dt) {
    this.time += dt;
    AudioSys.update();

    if (Input.muteP()) AudioSys.toggleMute();

    if (this.state === 'title') {
      this.titleCam += this.titleDir * 26 * dt;
      if (this.titleCam > 1500) this.titleDir = -1;
      if (this.titleCam < 0) this.titleDir = 1;
      this.camX = this.titleCam;
      AudioSys.setZone('village');
      if (Input.confirmP()) {
        this.state = 'play';
        this.resetWorld(true);
        this.respawnFade = 0.6;
      }
      return;
    }

    if (this.state === 'victory') {
      this.victoryT += dt;
      if (this.victoryT > 2 && Input.restartP()) {
        this.state = 'title';
        this.titleCam = 0; this.titleDir = 1;
        this.resetWorld(true);
      }
      Particles.update(dt);
      return;
    }

    // ----- play -----
    if (Input.pauseP() && !this.player.dead) this.paused = !this.paused;
    if (this.paused) return;

    if (this.freezeT > 0) { this.freezeT -= dt; return; }

    this.shakeT -= dt;
    this.respawnFade -= dt;
    if (!this.cinematic && !this.player.dead) this.stats.time += dt;

    const pl = this.player;

    // music zone
    if (this.boss && this.boss.active && !this.boss.dead) AudioSys.setZone('boss');
    else AudioSys.setZone(musicZoneAt(pl.x));

    // player
    pl.update(dt);

    // death & respawn
    if (pl.dead) {
      if (pl.deathT > 2.1) this.respawnPlayer();
      Particles.update(dt);
      Dialogue.update(dt);
      this.updateCamera(dt);
      return;
    }

    // abyss fall
    if (pl.y > KILL_Y) {
      pl.hurt(1, pl.x, { toSafe: true });
    }

    // hazards
    const feet = { x: pl.x + 4, y: pl.y + pl.h - 6, w: pl.w - 8, h: 6 };
    for (const hz of HAZARDS) {
      if (hz.type === 'spikes') {
        if (rectsOverlap(pl, { x: hz.x + 2, y: hz.y - 2, w: hz.w - 4, h: 20 })) {
          pl.hurt(1, pl.x, { toSafe: true });
        }
      } else if (hz.type === 'water') {
        if (pl.y + pl.h > hz.surf + 14 && pl.x + pl.w > hz.x && pl.x < hz.x + hz.w) {
          Particles.burst(pl.x + pl.w / 2, hz.surf, '#9ab0e8', 14, 200, { life: 0.5 });
          AudioSys.sfx('land');
          pl.hurt(1, pl.x, { toSafe: true });
        }
      }
    }

    // enemies
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = Math.abs((e.x + e.w / 2) - (pl.x + pl.w / 2));
      if (dx > 760) { // off-screen enemies idle cheaply
        if (e.flash > 0) e.flash -= dt;
        continue;
      }
      e.update(dt, pl);
      // contact damage
      if (!e.dead && pl.invuln <= 0) {
        if (rectsOverlap(e.rect(), pl)) {
          pl.hurt(e.touchDmg, e.x + e.w / 2);
        } else if (e.thrustBox && rectsOverlap(e.thrustBox, pl)) {
          pl.hurt(1, e.x + e.w / 2);
        }
      }
    }
    this.enemies = this.enemies.filter(e => !e.dead);

    // orbs
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      o.update(dt, pl);
      if (!o.dead && rectsOverlap(o.rect(), pl)) {
        o.dead = true;
        pl.hurt(1, o.x);
      }
      if (o.dead) {
        if (o.owner) o.owner.myOrbs--;
        this.orbs.splice(i, 1);
      }
    }

    // shockwaves
    for (let i = this.waves.length - 1; i >= 0; i--) {
      this.waves[i].update(dt, pl);
      if (this.waves[i].dead) this.waves.splice(i, 1);
    }

    // boss
    if (this.boss && !this.boss.finished) {
      if (!this.bossDefeated && this.boss.state === 'dormant' && pl.x > 6920 && pl.x < ARENA_R) {
        this.boss.start();
      }
      if (this.boss.active || this.boss.state === 'dormant') {
        this.boss.update(dt, pl);
      }
    }

    // beatrice
    this.beatrice.update(dt);

    // dialogue triggers
    for (const t of this.triggers) {
      if (t.fired) continue;
      if (pl.x + pl.w > t.x && pl.x < t.x + t.w) {
        t.fired = true;
        const anchor = { x: t.x + t.w / 2, y: 350 };
        Dialogue.say(t.lines, anchor);
        if (t.beatrice !== undefined) this.beatriceScene = t;
      }
    }
    // when a beatrice conversation finishes, she drifts onward
    if (this.beatriceScene && !Dialogue.busy()) {
      this.beatrice.advance();
      this.beatriceScene = null;
    }

    // checkpoints
    for (let i = 0; i < CHECKPOINTS.length; i++) {
      const cp = CHECKPOINTS[i];
      if (i !== this.activeCheckpoint &&
          Math.abs(pl.x - cp.x) < 30 && Math.abs((pl.y + pl.h) - (cp.y + 36)) < 60) {
        this.activeCheckpoint = i;
        this.respawn = { x: cp.x, y: cp.y };
        AudioSys.sfx('check');
        Particles.burst(cp.x + 10, cp.y + 16, '#bfeef0', 16, 160, { life: 0.8, grav: -120 });
        if (pl.hp < pl.maxHp) pl.hp = Math.min(pl.maxHp, pl.hp + 1);
      }
    }

    // ending
    if (!this.endStarted && pl.x > FINAL_SCENE_X && this.bossDefeated) {
      this.startEnding();
    }
    if (this.endStarted) {
      this.endT += dt;
      pl.vx = 0;
      if (!Dialogue.busy() && this.endT > 3) {
        this.state = 'victory';
        this.victoryT = 0;
        this.beatrice.advance();
      }
    }

    // fx
    for (let i = this.fx.length - 1; i >= 0; i--) {
      this.fx[i].t += dt;
      if (this.fx[i].t > this.fx[i].life) this.fx.splice(i, 1);
    }

    Particles.update(dt);
    Dialogue.update(dt);
    HUD.update(dt, pl);
    this.updateCamera(dt);
  },

  updateCamera(dt) {
    const pl = this.player;
    let target = pl.x + pl.w / 2 - VW / 2 + pl.facing * 46;
    if (this.boss && this.boss.active && !this.boss.dead) {
      target = clamp(target, ARENA_L - 30, ARENA_R + 70 - VW);
    }
    if (this.endStarted) target = this.beatrice.x - VW / 2 - 60;
    target = clamp(target, 0, WORLD_W - VW);
    const k = 1 - Math.pow(0.0001, dt); // smooth, framerate independent
    this.camX += (target - this.camX) * k * 1.1;
    this.camX = clamp(this.camX, 0, WORLD_W - VW);
    this.camY = 0;
  },

  // -------------- draw --------------
  // Renders the full screen: clear, place the fixed game view inside the
  // current STAGE (fills in landscape; a top band in portrait), then draw
  // touch controls in screen space on top.
  draw(dt) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05030a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.setTransform(STAGE.scale, 0, 0, STAGE.scale, STAGE.ox, STAGE.oy);
    ctx.beginPath(); ctx.rect(0, 0, VW, VH); ctx.clip();
    this.drawScene(dt);
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (TouchUI.active) TouchUI.draw();
  },

  drawScene(dt) {
    let cx = this.camX, cy = this.camY;
    if (this.shakeT > 0) {
      cx += rand(-this.shakeMag, this.shakeMag);
      cy += rand(-this.shakeMag, this.shakeMag) * 0.6;
      if (this.shakeT <= 0) this.shakeMag = 0;
    } else this.shakeMag = 0;

    const pal = BG.draw(cx, cy, this.time, dt);

    // checkpoint shrines (dynamic flame)
    for (let i = 0; i < CHECKPOINTS.length; i++) {
      const cp = CHECKPOINTS[i];
      const sx = cp.x - cx, syg = cp.y + 36 - cy; // ground level
      if (sx < -60 || sx > VW + 60) continue;
      // pedestal
      ctx.fillStyle = '#3a3152';
      ctx.fillRect(sx - 9, syg - 26, 22, 26);
      ctx.fillRect(sx - 13, syg - 4, 30, 4);
      ctx.fillRect(sx - 12, syg - 30, 28, 5);
      const active = i === this.activeCheckpoint && this.state === 'play';
      const fl = active ? '#9adcf0' : '#ffae58';
      const flH = 7 + Math.sin(this.time * 9 + i) * 2.5;
      const gl = ctx.createRadialGradient(sx + 2, syg - 36, 2, sx + 2, syg - 36, 26);
      const c = hexToRgb(fl);
      gl.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${active ? 0.5 : 0.3})`);
      gl.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
      ctx.fillStyle = gl;
      ctx.fillRect(sx - 24, syg - 62, 52, 52);
      ctx.fillStyle = fl;
      ctx.beginPath();
      ctx.moveTo(sx - 3, syg - 30);
      ctx.quadraticCurveTo(sx + 2, syg - 30 - flH * 2, sx + 7, syg - 30);
      ctx.closePath();
      ctx.fill();
    }

    if (this.state !== 'title') {
      this.beatrice.draw(cx, cy, this.time);
      for (const e of this.enemies) if (!e.dead) e.draw(cx, cy, this.time);
      if (this.boss && !this.boss.finished) this.boss.draw(cx, cy, this.time);
      for (const o of this.orbs) o.draw(cx, cy, this.time);
      for (const w of this.waves) w.draw(cx, cy, this.time);
      this.player.draw(cx, cy, this.time);
      for (const f of this.fx) drawFx(f, cx, cy);
    }

    Particles.draw(cx, cy);
    BG.drawFog(pal, cx, this.time);
    Vignette.draw();

    // low-hp pulse
    if (this.state === 'play' && this.player.hp <= 1 && !this.player.dead) {
      ctx.fillStyle = `rgba(160,20,30,${0.10 + Math.sin(this.time * 5) * 0.06})`;
      ctx.fillRect(0, 0, VW, VH);
    }

    if (this.state === 'title') {
      Screens.drawTitle(this.time);
      return;
    }

    // HUD & dialogue
    if (this.state === 'play') {
      HUD.draw(this.player, this.time);
      if (this.boss) HUD.drawBossBar(this.boss, this.time);
      Dialogue.draw(cx, cy, this.time);
      if (AudioSys.muted) {
        ctx.font = '11px Georgia';
        ctx.fillStyle = 'rgba(200,190,220,0.6)';
        ctx.fillText('muted [M]', VW - 64, 20);
      }
      // cinematic letterbox
      if (this.cinematic) {
        ctx.fillStyle = '#06040a';
        ctx.fillRect(0, 0, VW, 40);
        ctx.fillRect(0, VH - 40, VW, 40);
      }
      if (this.player.dead) Screens.drawDeath(this.player.deathT);
      if (this.respawnFade > 0) {
        ctx.fillStyle = `rgba(6,2,8,${clamp(this.respawnFade / 0.9, 0, 1)})`;
        ctx.fillRect(0, 0, VW, VH);
      }
      if (this.paused) Screens.drawPause();
    }

    if (this.state === 'victory') {
      Screens.drawVictory(this.victoryT, this.stats, this.time);
    }
  },
};

// ---------------- main loop ----------------
let _last = performance.now();
let _acc = 0;
const STEP = 1 / 60;

function frame(now) {
  let dt = (now - _last) / 1000;
  _last = now;
  if (dt > 0.25) dt = 0.25; // tab-switch guard
  _acc += dt;
  let steps = 0;
  while (_acc >= STEP && steps < 4) {
    Game.update(STEP);
    Input.endFrame();
    _acc -= STEP;
    steps++;
  }
  if (steps === 4) _acc = 0;
  Game.draw(STEP);
  requestAnimationFrame(frame);
}

Game.init();
requestAnimationFrame(frame);
