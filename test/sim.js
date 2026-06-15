'use strict';
// Headless harness: stub browser APIs, load game files, drive the loop.
const fs = require('fs');
const vm = require('vm');

function makeCtxStub() {
  const grad = { addColorStop() {} };
  const ctx = {};
  const methods = ['save','restore','translate','scale','rotate','beginPath','closePath',
    'moveTo','lineTo','quadraticCurveTo','bezierCurveTo','arc','ellipse','rect','roundRect',
    'fill','stroke','clip','fillRect','strokeRect','clearRect','drawImage','fillText','strokeText',
    'setTransform','resetTransform','setLineDash'];
  for (const m of methods) ctx[m] = function(){};
  ctx.createLinearGradient = () => grad;
  ctx.createRadialGradient = () => grad;
  ctx.createPattern = () => ({});
  ctx.measureText = (s) => ({ width: (s ? s.length : 0) * 6 });
  // settable props just exist
  ctx.canvas = null;
  return ctx;
}

function makeCanvas(w, h) {
  return {
    width: w || 300, height: h || 150,
    style: {},
    getContext() { const c = makeCtxStub(); c.canvas = this; return c; },
    addEventListener() {},
    getBoundingClientRect() { return { left:0, top:0, width:this.width, height:this.height }; },
  };
}

const listeners = {};
const windowStub = {
  innerWidth: 1280, innerHeight: 720,
  addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
  removeEventListener() {},
  AudioContext: function(){ throw new Error('no audio in headless'); },
};
const documentStub = {
  getElementById(id) {
    if (id === 'game') return canvasEl;
    return makeCanvas();
  },
  createElement(tag) { return makeCanvas(); },
  addEventListener() {},
};
const canvasEl = makeCanvas(960, 540);

let rafQueue = [];
const sandbox = {
  window: windowStub,
  document: documentStub,
  performance: { now: () => Date.now() },
  requestAnimationFrame: (fn) => { rafQueue.push(fn); return rafQueue.length; },
  Math, Date, console, parseInt, parseFloat, isNaN, isFinite,
  Object, Array, String, Number, Boolean, JSON,
};
sandbox.global = sandbox;
sandbox.globalThis = sandbox;
windowStub.AudioContext = undefined; // so AudioSys.unlock try/catch bails gracefully... actually it throws. Keep undefined -> "new undefined" throws TypeError caught by try.

vm.createContext(sandbox);

// load files in index.html order. Concatenate so top-level `const`s share
// one lexical scope (as separate <script> tags do in a browser), then export
// the globals we need for driving the sim.
const files = ['core.js','audio.js','level.js','background.js','actors.js','systems.js','boss.js','ui.js','touch.js','newsletter.js','main.js'];
let bundle = '';
for (const f of files) bundle += '\n//=== ' + f + ' ===\n' + fs.readFileSync('js/' + f, 'utf8');
bundle += '\n;globalThis.Game=Game;globalThis.Input=Input;globalThis.Particles=Particles;globalThis.FINAL_SCENE_X=FINAL_SCENE_X;globalThis.DEATH_ARENA_L=DEATH_ARENA_L;globalThis.DEATH_ARENA_R=DEATH_ARENA_R;globalThis.LILITH_L=LILITH_L;globalThis.LILITH_R=LILITH_R;';
try {
  vm.runInContext(bundle, sandbox, { filename: 'bundle.js' });
} catch (e) {
  console.error('LOAD ERROR\n', e.stack);
  process.exit(1);
}

const Game = sandbox.Game;
const Input = sandbox.Input;
if (!Game) { console.error('Game not defined'); process.exit(1); }

// helper to set input state
function setKeys(obj) { Input.keys = Object.assign({}, obj); }
function press(code) { Input.pressed[code] = true; }

const STEP = 1/60;
let errors = [];
function step(n, fn) {
  for (let i = 0; i < n; i++) {
    if (fn) fn(i);
    try { Game.update(STEP); } catch (e) { errors.push('UPDATE @'+Game.state+' '+e.stack); throw e; }
    try { Game.draw(STEP); } catch (e) { errors.push('DRAW @'+Game.state+' '+e.stack); throw e; }
    Input.endFrame();
  }
}

try {
  // ---- title -> play
  press('Enter'); step(1);  // title -> select
  press('Enter'); step(1);  // select -> play (Florence)
  step(5);
  console.log('state after enter:', Game.state, 'player x', Math.round(Game.player.x));

  // ---- walk right across the whole world, jumping & attacking
  let maxX = 0, minHp = 5, bossSeen = false, bossDead = false, victory = false;
  let frames = 0;
  for (let seg = 0; seg < 9000; seg++) {
    frames++;
    setKeys({ KeyD: true });
    if (seg % 40 === 0) press('Space');
    if (seg % 14 === 0) press('KeyJ');
    if (seg % 90 === 0) press('ShiftLeft');
    // if blocked a while, try jump
    Game.update(STEP);
    Game.draw(STEP);
    Input.endFrame();
    const pl = Game.player;
    if (pl) { maxX = Math.max(maxX, pl.x); minHp = Math.min(minHp, pl.hp); }
    if (Game.boss && Game.boss.active) bossSeen = true;
    if (Game.bossDefeated) bossDead = true;
    if (Game.state === 'victory') { victory = true; break; }
    // if dead, wait for respawn
    if (pl && pl.dead) { /* loop continues, respawn handled */ }
  }
  console.log('frames', frames, 'maxX', Math.round(maxX), 'minHp', minHp,
    'bossSeen', bossSeen, 'bossDead', bossDead, 'victory', victory,
    'deaths', Game.stats.deaths, 'state', Game.state);
  console.log('enemies alive', Game.enemies.filter(e=>!e.dead).length, 'particles', sandbox.Particles.list.length);

  // ---- scripted GATES BOSS (Asterion) ----
  Game.state = 'title'; press('Enter'); step(1); press('Enter'); step(1);
  Input.keys = {};
  Game.player.x = 6940; Game.player.y = 400; Game.player.hp = 5; Game.player.dead = false;
  step(20);
  console.log('gates boss:', Game.boss.state, 'active', Game.boss.active);
  if (!Game.boss.active) errors.push('GATES BOSS did not activate on arena entry');
  let bossPhase2 = false;
  for (let i = 0; i < 4000 && !Game.bossDefeated; i++) {
    if (Game.player.dead) { Game.player.dead = false; Game.player.hp = 5; Game.player.x = 7100; Game.player.y = 400; }
    Game.player.invuln = 1;
    if (i % 8 === 0 && Game.boss.active && !Game.boss.dead) Game.boss.takeHit(1, 1, 0);
    if (Game.boss.phase2) bossPhase2 = true;
    Game.update(STEP); Game.draw(STEP); Input.endFrame();
  }
  console.log('gates boss phase2', bossPhase2, 'defeated', Game.bossDefeated, 'finished', Game.boss.finished);
  if (!Game.bossDefeated) errors.push('GATES BOSS never died under sustained damage');

  // ---- scripted DEATH BOSS (Purgatory) ----
  Input.keys = {};
  const dmid = (sandbox.DEATH_ARENA_L + sandbox.DEATH_ARENA_R) / 2;
  Game.player.x = dmid; Game.player.y = 400; Game.player.hp = 5; Game.player.dead = false;
  step(24);
  console.log('death boss:', Game.deathBoss.state, 'active', Game.deathBoss.active);
  if (!Game.deathBoss.active) errors.push('DEATH BOSS did not activate on arena entry');
  let dPhase2 = false;
  for (let i = 0; i < 6000 && !Game.deathDefeated; i++) {
    if (Game.player.dead) { Game.player.dead = false; Game.player.hp = 5; Game.player.x = dmid; Game.player.y = 400; }
    Game.player.invuln = 1;
    if (i % 8 === 0 && Game.deathBoss.active && !Game.deathBoss.dead) Game.deathBoss.takeHit(1, 1);
    if (Game.deathBoss.phase2) dPhase2 = true;
    Game.update(STEP); Game.draw(STEP); Input.endFrame();
  }
  console.log('death boss phase2', dPhase2, 'defeated', Game.deathDefeated, 'finished', Game.deathBoss.finished);
  if (!Game.deathDefeated) errors.push('DEATH BOSS never died under sustained damage');

  // ---- scripted LILITH BOSS (Lust) ----
  Input.keys = {};
  const lmid = (sandbox.LILITH_L + sandbox.LILITH_R) / 2;
  Game.player.x = lmid; Game.player.y = 400; Game.player.hp = 8; Game.player.dead = false;
  step(28);
  console.log('lilith boss:', Game.lilithBoss.state, 'active', Game.lilithBoss.active);
  if (!Game.lilithBoss.active) errors.push('LILITH did not activate on arena entry');
  let lPhase2 = false;
  for (let i = 0; i < 7000 && !Game.lilithDefeated; i++) {
    if (Game.player.dead) { Game.player.dead = false; Game.player.hp = 8; Game.player.x = lmid; Game.player.y = 400; }
    Game.player.invuln = 1;
    if (i % 8 === 0 && Game.lilithBoss.active && !Game.lilithBoss.dead) Game.lilithBoss.takeHit(1, 1);
    if (Game.lilithBoss.phase2) lPhase2 = true;
    Game.update(STEP); Game.draw(STEP); Input.endFrame();
  }
  console.log('lilith phase2', lPhase2, 'defeated', Game.lilithDefeated, 'finished', Game.lilithBoss.finished);
  if (!Game.lilithDefeated) errors.push('LILITH never died under sustained damage');

  // ---- scripted ENDING ----
  Game.enemies = []; Game.sinners = []; Game.fruits = [];
  sandbox.Game.beatrice && (sandbox.Game.beatrice.idx = 7);
  Game.player.x = sandbox.FINAL_SCENE_X + 20; Game.player.y = 410;
  Game.player.dead = false; Game.player.hp = 5;
  Game.player.lastSafe = { x: Game.player.x, y: Game.player.y };
  let endReached = false, endStarted = false;
  for (let i = 0; i < 5000; i++) {
    if (Game.endStarted) endStarted = true;
    Game.update(STEP); Game.draw(STEP); Input.endFrame();
    if (Game.state === 'victory') { endReached = true; break; }
  }
  console.log('ending startEnding fired:', endStarted, 'reached victory:', endReached, 'state', Game.state);
  if (!endReached) errors.push('ENDING never triggered victory after both bosses + final zone');

  // ---- restart from victory ----
  if (Game.state === 'victory') {
    Game.victoryT = 3;
    press('KeyR'); Game.update(STEP); Game.draw(STEP); Input.endFrame();
    console.log('after R from victory, state:', Game.state);
  }

  if (errors.length) {
    console.log('\nLOGIC ISSUES:');
    for (const e of errors) console.log(' -', e.split('\n')[0]);
  }
} catch (e) {
  console.error('SIM CRASH:', e.message);
  console.error(errors.slice(-3).join('\n---\n'));
  process.exit(2);
}
console.log('NO CRASH. Headless sim complete.');
