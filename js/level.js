'use strict';
// ============================================================
// Level data: geometry, palettes, spawns, lore triggers
// World layout (x):
//   0    - 2660 : Italian fantasy village (violet dusk, castle, water)
//   2660 - 5700 : The Descent (ruined Greek road, red glow grows)
//   5700 - 7900 : Gates of Hell + Minotaur arena (6760-7860)
//   7900 - 10800: Limbo, the First Circle (pale ash)
// Main ground line sits around y=430 so water/pits stay visible.
// ============================================================

// ---------- solid geometry ----------
// type: 'solid' | 'oneway'
const PLATFORMS = [
  // world borders
  { x: -120, y: -400, w: 40, h: 1200, type: 'solid' },
  { x: 10780, y: -400, w: 60, h: 1200, type: 'solid' },

  // VILLAGE
  { x: -80,  y: 438, w: 420, h: 12,  type: 'solid', deco: 'dock' },
  { x: 340,  y: 430, w: 1220, h: 290, type: 'solid' },  // shore A
  { x: 880,  y: 358, w: 100, h: 10,  type: 'oneway' },  // balcony
  { x: 1150, y: 322, w: 100, h: 10,  type: 'oneway' },  // balcony
  { x: 1540, y: 422, w: 500, h: 16,  type: 'solid', deco: 'bridge' },
  { x: 2040, y: 430, w: 620, h: 290, type: 'solid' },   // shore B

  // DESCENT — a staircase of jumpable gaps (each ≤ ~150px)
  { x: 2660, y: 430, w: 420, h: 290, type: 'solid' },   // D1  2660-3080
  { x: 3180, y: 412, w: 280, h: 308, type: 'solid' },   // D2  3180-3460
  { x: 3570, y: 424, w: 320, h: 296, type: 'solid' },   // D3  3570-3890
  { x: 4010, y: 430, w: 300, h: 290, type: 'solid' },   // D4  4010-4310
  { x: 4420, y: 424, w: 170, h: 16,  type: 'solid' },   // wide slab over the big pit (4420-4590)
  { x: 4690, y: 426, w: 400, h: 294, type: 'solid' },   // D5  4690-5090
  { x: 5210, y: 436, w: 490, h: 284, type: 'solid' },   // D6  5210-5700

  // GATES + ARENA floor
  { x: 5700, y: 436, w: 2200, h: 284, type: 'solid' },

  // LIMBO
  { x: 7900, y: 436, w: 520, h: 284, type: 'solid' },   // L1
  { x: 8500, y: 396, w: 170, h: 16,  type: 'solid' },   // floating isles
  { x: 8760, y: 346, w: 150, h: 16,  type: 'solid' },
  { x: 8990, y: 406, w: 190, h: 16,  type: 'solid' },
  { x: 9270, y: 366, w: 160, h: 16,  type: 'solid' },
  { x: 9520, y: 426, w: 1280, h: 294, type: 'solid' },  // final shore
];

// ---------- hazards ----------
const HAZARDS = [
  { x: -240, y: 492, w: 820, h: 240, type: 'water', surf: 480 },
  { x: 1560, y: 500, w: 480, h: 230, type: 'water', surf: 488 },
  { x: 3080, y: 505, w: 100, h: 215, type: 'spikes' },  // gap D1->D2
  { x: 3460, y: 505, w: 110, h: 215, type: 'spikes' },  // gap D2->D3
  { x: 3890, y: 505, w: 120, h: 215, type: 'spikes' },  // gap D3->D4
  { x: 4310, y: 505, w: 380, h: 215, type: 'spikes' },  // big pit under the slab (D4->D5)
  { x: 5090, y: 505, w: 120, h: 215, type: 'spikes' },  // gap D5->D6
];

// ---------- checkpoints (lit shrines) ----------
const CHECKPOINTS = [
  { x: 120,  y: 402 },
  { x: 2440, y: 394 },
  { x: 5830, y: 400 },
  { x: 7990, y: 400 },
];

// ---------- enemy spawns ----------
// grounded types give gy (ground top); fliers give y directly
const ENEMY_SPAWNS = [
  { type: 'shade',   x: 1290, y: 340 },
  { type: 'shade',   x: 1780, y: 310 },
  { type: 'shade',   x: 2330, y: 345 },

  { type: 'hoplite', x: 2880, gy: 430, min: 2700, max: 3060 },
  { type: 'harpy',   x: 3320, y: 210, min: 3200, max: 3450 },
  { type: 'shade',   x: 3700, y: 270 },
  { type: 'hoplite', x: 3720, gy: 424, min: 3590, max: 3870 },
  { type: 'hound',   x: 4150, gy: 430, min: 4030, max: 4290 },
  { type: 'shade',   x: 4505, y: 348, hover: true },
  { type: 'harpy',   x: 4900, y: 200, min: 4720, max: 5070 },
  { type: 'hoplite', x: 4850, gy: 426, min: 4710, max: 5070 },
  { type: 'shade',   x: 5380, y: 300 },
  { type: 'hound',   x: 5450, gy: 436, min: 5300, max: 5680 },

  { type: 'hoplite', x: 6120, gy: 436, min: 5990, max: 6320 },
  { type: 'harpy',   x: 6400, y: 190, min: 6280, max: 6560 },

  { type: 'weeper',  x: 8600, y: 270 },
  { type: 'shade',   x: 8870, y: 280 },
  { type: 'weeper',  x: 9120, y: 240 },
  { type: 'wraith',  x: 9750, gy: 426, min: 9560, max: 10120 },
  { type: 'weeper',  x: 9960, y: 270 },
  { type: 'wraith',  x: 10200, gy: 426, min: 9960, max: 10420 },
];

// ---------- Beatrice scripted appearances ----------
const BEATRICE_SPOTS = [
  { x: 770,   y: 384 },
  { x: 2480,  y: 384 },
  { x: 6480,  y: 390 },
  { x: 10480, y: 380 },
];

// ---------- lore / dialogue triggers ----------
// speaker: 'dante' | 'beatrice' | 'sign' | 'voice'
const TRIGGERS = [
  { x: 60, w: 180, once: true, lines: [
    { s: 'dante', t: "Florence sleeps beneath a violet sky... but I cannot." },
    { s: 'dante', t: "Her voice called to me across the dark water." },
  ]},
  { x: 380, w: 150, once: true, lines: [
    { s: 'sign', t: "[A]·[D] walk   ·   [SPACE] jump" },
  ]},
  { x: 690, w: 140, once: true, beatrice: 0, lines: [
    { s: 'beatrice', t: "Dante..." },
    { s: 'dante', t: "Beatrice?! I buried you with my own hands— wait!" },
  ]},
  { x: 1060, w: 160, once: true, lines: [
    { s: 'sign', t: "[J] / [CLICK] strike   ·   [SHIFT] dash through danger" },
  ]},
  { x: 1230, w: 130, once: true, lines: [
    { s: 'dante', t: "Shades. The dead do not rest tonight." },
  ]},
  { x: 1570, w: 150, once: true, lines: [
    { s: 'dante', t: "She crossed the old bridge... toward that burning glow in the mountains." },
  ]},
  { x: 2380, w: 150, once: true, beatrice: 1, lines: [
    { s: 'beatrice', t: "Turn back, my love. The road below is not for the living." },
    { s: 'dante', t: "Then I shall stop living by your side. Either way, I follow." },
  ]},
  { x: 2750, w: 160, once: true, lines: [
    { s: 'dante', t: "The path descends. The air smells of iron and ash." },
  ]},
  { x: 3300, w: 160, once: true, lines: [
    { s: 'sign', t: "Hold [F] (on solid ground) to focus gathered SOUL and mend a wound." },
  ]},
  { x: 4360, w: 160, once: true, lines: [
    { s: 'sign', t: "Over the pit: hold [S] and strike to slash downward and bounce off the spirit." },
  ]},
  { x: 5760, w: 180, once: true, lines: [
    { s: 'dante', t: "Greek ruins... columns older than Rome. Whose hell is this?" },
  ]},
  { x: 6300, w: 180, once: true, lines: [
    { s: 'voice', t: "THROUGH ME THE WAY INTO THE SUFFERING CITY." },
    { s: 'voice', t: "ABANDON ALL HOPE, YE WHO ENTER HERE." },
  ]},
  { x: 6520, w: 150, once: true, beatrice: 2, lines: [
    { s: 'beatrice', t: "The Judge of the Dead has claimed me, Dante. His warden guards the gate." },
    { s: 'dante', t: "Then I will argue my case before Hell itself." },
  ]},
  { x: 8000, w: 190, once: true, lines: [
    { s: 'dante', t: "Limbo. The first circle. Sighs, not screams..." },
    { s: 'dante', t: "...the grief of those who lived before grace." },
  ]},
  { x: 8550, w: 180, once: true, lines: [
    { s: 'dante', t: "The virtuous dead weep here. I would weep with them, had I the time." },
  ]},
];

const FINAL_SCENE_X = 10380;

// ---------- zone palettes ----------
const PALETTES = {
  village: {
    skyTop: '#5b4f9e', skyMid: '#8a6fb8', skyBot: '#d8a8c8',
    moon: '#f2a8c0', moonGlow: '#c87da8',
    cloud1: '#8d7cc4', cloud2: '#a995da',
    far: '#51437f', mid: '#3f3468',
    terrain: '#4a3d72', terrainTop: '#6e5d9e', terrainEdge: '#2c2347',
    ambient: '#ffe9a8', fogA: 0.0,
  },
  descent: {
    skyTop: '#38244e', skyMid: '#6e3a62', skyBot: '#c46a5a',
    moon: '#e88a78', moonGlow: '#a84858',
    cloud1: '#5c3a64', cloud2: '#74486e',
    far: '#3a2348', mid: '#2b1a38',
    terrain: '#3a2a4a', terrainTop: '#5a4068', terrainEdge: '#1f1430',
    ambient: '#ff9a58', fogA: 0.0,
  },
  gates: {
    skyTop: '#1c0f26', skyMid: '#58182c', skyBot: '#c43d2a',
    moon: '#ff7040', moonGlow: '#902818',
    cloud1: '#4a1830', cloud2: '#66202e',
    far: '#240e20', mid: '#190a18',
    terrain: '#2a1626', terrainTop: '#4e2230', terrainEdge: '#120814',
    ambient: '#ff6838', fogA: 0.08,
  },
  limbo: {
    skyTop: '#353d4d', skyMid: '#5d6878', skyBot: '#9aa6ae',
    moon: '#dde4ea', moonGlow: '#8a96a4',
    cloud1: '#6a7484', cloud2: '#828e9c',
    far: '#4a525e', mid: '#3a4250',
    terrain: '#46505c', terrainTop: '#6e7a86', terrainEdge: '#272d36',
    ambient: '#cfd8e2', fogA: 0.16,
  },
};

// palette key stops along x (camera center)
const PAL_STOPS = [
  { x: 0,     p: 'village' },
  { x: 2500,  p: 'village' },
  { x: 3500,  p: 'descent' },
  { x: 5300,  p: 'descent' },
  { x: 6300,  p: 'gates' },
  { x: 7800,  p: 'gates' },
  { x: 8600,  p: 'limbo' },
  { x: 99999, p: 'limbo' },
];

const PAL_FIELDS = ['skyTop','skyMid','skyBot','moon','moonGlow','cloud1','cloud2','far','mid','terrain','terrainTop','terrainEdge','ambient'];

// returns a blended palette object for camera center x
function paletteAt(cx) {
  let i = 0;
  while (i < PAL_STOPS.length - 2 && cx > PAL_STOPS[i + 1].x) i++;
  const a = PAL_STOPS[i], b = PAL_STOPS[i + 1];
  const t = clamp((cx - a.x) / Math.max(1, b.x - a.x), 0, 1);
  const pa = PALETTES[a.p], pb = PALETTES[b.p];
  if (a.p === b.p) return Object.assign({ t: 0 }, pa);
  const out = {};
  for (const f of PAL_FIELDS) out[f] = mixColor(pa[f], pb[f], t);
  out.fogA = lerp(pa.fogA, pb.fogA, t);
  return out;
}

// which music zone for player x
function musicZoneAt(x) {
  if (x < 2560) return 'village';
  if (x < 5700) return 'descent';
  if (x < 7900) return 'gates';
  return 'limbo';
}
