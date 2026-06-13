'use strict';
// ============================================================
// Background renderer: pre-baked parallax layers + dynamic sky,
// water, clouds, fog and ambient particles.
// ============================================================

const BG = {
  far: null, mid: null, deco: null, terrain: null,
  FAR_P: 0.25, MID_P: 0.55,
  clouds: [], motes: [], stars: [],

  init() {
    this.bakeFar();
    this.bakeMid();
    this.bakeDeco();
    this.bakeTerrain();
    // clouds: world-ish positions, drawn with parallax 0.12
    const rng = makeRng(7777);
    this.clouds = [];
    for (let i = 0; i < 26; i++) {
      this.clouds.push({
        x: rng() * (WORLD_W * 0.12 + VW * 2) - VW * 0.5,
        y: 30 + rng() * 200,
        s: 0.6 + rng() * 1.1,
        v: 2 + rng() * 5,
        seed: Math.floor(rng() * 99999),
        layer: rng() < 0.5 ? 0 : 1,
      });
    }
    for (let i = 0; i < 60; i++) {
      this.stars.push({ x: rng() * VW, y: rng() * 260, a: 0.3 + rng() * 0.7, tw: rng() * 6 });
    }
  },

  mkCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w); c.height = Math.ceil(h);
    return c;
  },

  // ----------------------------------------------------------
  // FAR LAYER (parallax 0.25): castle, mountains, hell wall, arches
  // Place feature so it's at screen sx when camera is at camX0:
  //   farX = camX0 * FAR_P + sx
  // ----------------------------------------------------------
  bakeFar() {
    const W = WORLD_W * this.FAR_P + VW + 100;
    this.far = this.mkCanvas(W, VH);
    const g = this.far.getContext('2d');

    // --- village: distant town silhouette on the left
    this.silTown(g, 60, 470, '#5b4d8c');
    // --- THE CASTLE (centerpiece, like the painting) visible while camera 200..1900
    this.castle(g, 0.25 * 700 + 430, 470);
    // small distant tower across the water
    this.tower(g, 0.25 * 1800 + 700, 462, 26, 90, '#564886', '#2e2552');

    // --- descent: jagged mountains with ember glow behind
    for (let i = 0; i < 9; i++) {
      const bx = 0.25 * (2700 + i * 360) + 480;
      const h = 150 + ((i * 73) % 110);
      this.mountain(g, bx, 478, 150 + (i % 3) * 40, h, mixColor('#3a2348', '#240e20', i / 9));
    }
    // volcano glow
    const vg = g.createRadialGradient(0.25 * 5300 + 520, 420, 10, 0.25 * 5300 + 520, 420, 240);
    vg.addColorStop(0, 'rgba(255,90,40,0.5)');
    vg.addColorStop(1, 'rgba(255,90,40,0)');
    g.fillStyle = vg;
    g.fillRect(0.25 * 5300 + 280, 180, 480, 300);

    // --- gates: colossal black wall with horned gate
    this.hellWall(g, 0.25 * 6500 + 480, 478);

    // --- limbo: endless pale arcade
    for (let i = 0; i < 16; i++) {
      const bx = 0.25 * (8200 + i * 260) + 480;
      this.paleArch(g, bx, 470, 46, 130 + (i % 3) * 24, '#4a525e');
    }
  },

  silTown(g, x, gy, c) {
    g.fillStyle = c;
    const rng = makeRng(31);
    let cx = x;
    for (let i = 0; i < 7; i++) {
      const w = 30 + rng() * 50, h = 40 + rng() * 80;
      g.fillRect(cx, gy - h, w, h);
      if (rng() < 0.5) { // little roof
        g.beginPath();
        g.moveTo(cx - 3, gy - h); g.lineTo(cx + w / 2, gy - h - 14); g.lineTo(cx + w + 3, gy - h);
        g.fill();
      }
      cx += w + rng() * 18;
    }
  },

  castle(g, cx, gy) {
    // rocky island
    const rock = '#473a6e', rockD = '#352a58';
    g.fillStyle = rockD;
    g.beginPath();
    g.moveTo(cx - 230, gy);
    g.lineTo(cx - 190, gy - 60); g.lineTo(cx - 120, gy - 95); g.lineTo(cx - 30, gy - 110);
    g.lineTo(cx + 80, gy - 100); g.lineTo(cx + 170, gy - 70); g.lineTo(cx + 230, gy - 30);
    g.lineTo(cx + 250, gy);
    g.closePath(); g.fill();
    g.fillStyle = rock;
    g.beginPath();
    g.moveTo(cx - 180, gy);
    g.lineTo(cx - 140, gy - 70); g.lineTo(cx - 50, gy - 100) ; g.lineTo(cx + 60, gy - 92);
    g.lineTo(cx + 150, gy - 55); g.lineTo(cx + 200, gy);
    g.closePath(); g.fill();

    const wall = '#e8d8d2', wallSh = '#c8b2bc', roof = '#3a2e4e', roofL = '#4e4064';
    const win = '#2e2548';
    const T = (x, y, w, h, coneH) => {     // tower with conical roof
      g.fillStyle = wall; g.fillRect(x - w / 2, y - h, w, h);
      g.fillStyle = wallSh; g.fillRect(x + w / 2 - Math.max(3, w * 0.3), y - h, Math.max(3, w * 0.3), h);
      g.fillStyle = roof;
      g.beginPath();
      g.moveTo(x - w / 2 - 5, y - h); g.lineTo(x, y - h - coneH); g.lineTo(x + w / 2 + 5, y - h);
      g.closePath(); g.fill();
      g.fillStyle = roofL;
      g.beginPath();
      g.moveTo(x - w / 2 - 5, y - h); g.lineTo(x, y - h - coneH); g.lineTo(x, y - h);
      g.closePath(); g.fill();
      g.fillStyle = win;
      for (let wy = y - h + 12; wy < y - 14; wy += 22) g.fillRect(x - 2, wy, 5, 9);
    };
    const B = (x, y, w, h, roofH) => {     // building with pitched roof
      g.fillStyle = wall; g.fillRect(x - w / 2, y - h, w, h);
      g.fillStyle = wallSh; g.fillRect(x + w / 2 - w * 0.22, y - h, w * 0.22, h);
      g.fillStyle = roof;
      g.beginPath();
      g.moveTo(x - w / 2 - 6, y - h); g.lineTo(x, y - h - roofH); g.lineTo(x + w / 2 + 6, y - h);
      g.closePath(); g.fill();
      g.fillStyle = win;
      for (let wx = x - w / 2 + 10; wx < x + w / 2 - 8; wx += 18)
        for (let wy = y - h + 12; wy < y - 16; wy += 24) g.fillRect(wx, wy, 5, 9);
    };
    const base = gy - 88;
    B(cx - 70, base - 4, 90, 70, 30);      // left hall
    T(cx - 115, base, 34, 95, 34);         // left tower
    B(cx + 65, base - 10, 110, 85, 36);    // right hall
    T(cx + 10, base, 44, 165, 48);         // main keep (tall)
    T(cx + 10, base, 24, 215, 30);         // spire on keep
    T(cx + 130, base - 5, 28, 80, 30);     // right tower
    // warm lit windows
    g.fillStyle = '#ffd98a';
    [[cx + 8, base - 130], [cx - 72, base - 40], [cx + 60, base - 50], [cx + 12, base - 80]].forEach(p => {
      g.fillRect(p[0], p[1], 5, 9);
    });
    // greenery patches on the rock
    g.fillStyle = '#7fc8a8';
    g.globalAlpha = 0.8;
    [[-150, -68, 30], [-40, -98, 36], [70, -88, 30], [150, -52, 26]].forEach(p => {
      g.beginPath(); g.arc(cx + p[0], gy + p[1], p[2] * 0.4, 0, 7); g.fill();
      g.beginPath(); g.arc(cx + p[0] + 14, gy + p[1] + 6, p[2] * 0.3, 0, 7); g.fill();
    });
    g.globalAlpha = 1;
  },

  tower(g, x, gy, w, h, c, roofC) {
    g.fillStyle = c; g.fillRect(x - w / 2, gy - h, w, h);
    g.fillStyle = roofC;
    g.beginPath();
    g.moveTo(x - w / 2 - 4, gy - h); g.lineTo(x, gy - h - w); g.lineTo(x + w / 2 + 4, gy - h);
    g.fill();
  },

  mountain(g, x, gy, hw, h, c) {
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(x - hw, gy);
    g.lineTo(x - hw * 0.4, gy - h * 0.7);
    g.lineTo(x - hw * 0.15, gy - h * 0.55);
    g.lineTo(x + hw * 0.1, gy - h);
    g.lineTo(x + hw * 0.45, gy - h * 0.5);
    g.lineTo(x + hw, gy);
    g.closePath(); g.fill();
  },

  hellWall(g, cx, gy) {
    const c = '#16070f', glow = '#ff5a28';
    // wall spanning wide
    g.fillStyle = c;
    g.fillRect(cx - 520, gy - 240, 1040, 240);
    // crenellation
    for (let i = 0; i < 26; i++) g.fillRect(cx - 520 + i * 40, gy - 262, 24, 26);
    // gate horns
    g.beginPath();
    g.moveTo(cx - 120, gy - 240);
    g.quadraticCurveTo(cx - 180, gy - 360, cx - 90, gy - 430);
    g.quadraticCurveTo(cx - 130, gy - 330, cx - 70, gy - 250);
    g.closePath(); g.fill();
    g.beginPath();
    g.moveTo(cx + 120, gy - 240);
    g.quadraticCurveTo(cx + 180, gy - 360, cx + 90, gy - 430);
    g.quadraticCurveTo(cx + 130, gy - 330, cx + 70, gy - 250);
    g.closePath(); g.fill();
    // gate maw glow
    const gg = g.createRadialGradient(cx, gy - 60, 8, cx, gy - 60, 180);
    gg.addColorStop(0, 'rgba(255,110,40,0.9)');
    gg.addColorStop(1, 'rgba(255,110,40,0)');
    g.fillStyle = gg;
    g.beginPath();
    g.moveTo(cx - 90, gy); g.quadraticCurveTo(cx, gy - 290, cx + 90, gy); g.closePath();
    g.fill();
  },

  paleArch(g, x, gy, w, h, c) {
    g.fillStyle = c;
    g.fillRect(x - w / 2, gy - h, 10, h);
    g.fillRect(x + w / 2 - 10, gy - h, 10, h);
    g.beginPath();
    g.arc(x, gy - h + 6, w / 2, Math.PI, 0);
    g.lineTo(x + w / 2 - 10, gy - h + 6);
    g.arc(x, gy - h + 6, w / 2 - 10, 0, Math.PI, true);
    g.closePath(); g.fill();
  },

  // ----------------------------------------------------------
  // MID LAYER (parallax 0.55)
  // ----------------------------------------------------------
  bakeMid() {
    const W = WORLD_W * this.MID_P + VW + 100;
    this.mid = this.mkCanvas(W, VH);
    const g = this.mid.getContext('2d');
    const P = this.MID_P;
    const at = (wx, sx) => P * wx + sx;

    // village rooftops & campanile
    const vc = '#3f3468', vc2 = '#473b73';
    const rng = makeRng(99);
    for (let i = 0; i < 12; i++) {
      const x = at(120 + i * 200, 200) + rng() * 60;
      const w = 60 + rng() * 70, h = 60 + rng() * 90;
      g.fillStyle = i % 2 ? vc : vc2;
      g.fillRect(x, 470 - h, w, h);
      g.beginPath();
      g.moveTo(x - 8, 470 - h); g.lineTo(x + w / 2, 470 - h - 26 - rng() * 18); g.lineTo(x + w + 8, 470 - h);
      g.fill();
      // lit window
      if (rng() < 0.7) { g.fillStyle = 'rgba(255,215,140,0.85)'; g.fillRect(x + 10 + rng() * (w - 24), 470 - h + 14 + rng() * (h - 30), 5, 8); }
    }
    // campanile (bell tower)
    const bx = at(1080, 420);
    g.fillStyle = vc2;
    g.fillRect(bx, 240, 40, 230);
    g.fillStyle = vc;
    g.fillRect(bx - 5, 230, 50, 16);
    g.beginPath(); g.moveTo(bx - 5, 230); g.lineTo(bx + 20, 196); g.lineTo(bx + 45, 230); g.fill();
    g.fillStyle = 'rgba(255,215,140,0.9)'; g.fillRect(bx + 14, 246, 12, 18);

    // trees along village (round canopies)
    g.fillStyle = '#3a4a6e';
    for (let i = 0; i < 10; i++) {
      const x = at(200 + i * 260, 300) + rng() * 80;
      const r = 16 + rng() * 14;
      g.beginPath(); g.arc(x, 452 - r, r, 0, 7); g.fill();
      g.beginPath(); g.arc(x + r * 0.8, 456 - r * 0.6, r * 0.7, 0, 7); g.fill();
      g.fillRect(x - 3, 452 - r * 0.4, 6, r * 0.5 + 18);
    }

    // descent: dead trees + broken Greek columns
    for (let i = 0; i < 14; i++) {
      const x = at(2750 + i * 230, 300) + rng() * 70;
      if (i % 3 === 2) this.brokenColumn(g, x, 470, 16, 60 + rng() * 70, '#2b1a38');
      else this.deadTree(g, x, 470, 50 + rng() * 50, '#241430', rng);
    }
    // ruined pediment
    this.pediment(g, at(4600, 380), 470, '#2b1a38');

    // gates: chained obelisks and spikes
    for (let i = 0; i < 6; i++) {
      const x = at(5900 + i * 330, 320);
      g.fillStyle = '#190a18';
      g.beginPath();
      g.moveTo(x - 16, 470); g.lineTo(x - 8, 470 - 150 - (i % 2) * 40); g.lineTo(x, 470 - 170 - (i % 2) * 40);
      g.lineTo(x + 8, 470 - 150 - (i % 2) * 40); g.lineTo(x + 16, 470); g.fill();
    }

    // limbo: marble ruins + cypress
    for (let i = 0; i < 16; i++) {
      const x = at(8050 + i * 200, 300) + rng() * 60;
      if (i % 4 === 0) this.brokenColumn(g, x, 470, 14, 50 + rng() * 80, '#3a4250');
      else if (i % 4 === 1) this.cypress(g, x, 470, 70 + rng() * 60, '#343c49');
      else if (i % 4 === 2) this.paleArch(g, x, 470, 40, 90 + rng() * 40, '#3a4250');
      else this.deadTree(g, x, 470, 40 + rng() * 40, '#39414e', rng);
    }
  },

  deadTree(g, x, gy, h, c, rng) {
    g.strokeStyle = c; g.fillStyle = c;
    g.lineWidth = 5;
    g.beginPath(); g.moveTo(x, gy); g.lineTo(x + 2, gy - h); g.stroke();
    g.lineWidth = 2.5;
    const n = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const by = gy - h * (0.4 + 0.5 * rng());
      const dir = rng() < 0.5 ? -1 : 1;
      g.beginPath(); g.moveTo(x + 1, by);
      g.quadraticCurveTo(x + dir * 12, by - 8, x + dir * (16 + rng() * 14), by - 14 - rng() * 12);
      g.stroke();
    }
  },

  brokenColumn(g, x, gy, w, h, c) {
    g.fillStyle = c;
    g.fillRect(x - w / 2 - 4, gy - 8, w + 8, 8);      // base
    g.fillRect(x - w / 2, gy - h, w, h);
    // flutes
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let fx = x - w / 2 + 2; fx < x + w / 2 - 2; fx += 5) g.fillRect(fx, gy - h, 2, h);
    // jagged broken top
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(x - w / 2, gy - h);
    g.lineTo(x - w / 4, gy - h - 7); g.lineTo(x, gy - h - 2); g.lineTo(x + w / 4, gy - h - 9); g.lineTo(x + w / 2, gy - h);
    g.fill();
  },

  pediment(g, x, gy, c) {
    g.fillStyle = c;
    for (let i = 0; i < 4; i++) this.brokenColumn(g, x + i * 36, gy, 14, i === 2 ? 70 : 110, c);
    g.beginPath();
    g.moveTo(x - 26, gy - 110); g.lineTo(x + 54, gy - 150); g.lineTo(x + 134, gy - 110);
    g.lineTo(x + 134, gy - 100); g.lineTo(x - 26, gy - 100);
    g.closePath(); g.fill();
  },

  cypress(g, x, gy, h, c) {
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(x, gy - h);
    g.quadraticCurveTo(x + 10, gy - h * 0.6, x + 7, gy);
    g.lineTo(x - 7, gy);
    g.quadraticCurveTo(x - 10, gy - h * 0.6, x, gy - h);
    g.fill();
  },

  // ----------------------------------------------------------
  // DECO LAYER (parallax 1, behind terrain): houses, gate, props
  // ----------------------------------------------------------
  bakeDeco() {
    this.deco = this.mkCanvas(WORLD_W + 200, VH);
    const g = this.deco.getContext('2d');
    g.translate(100, 0); // allow content at slightly negative world x
    const rng = makeRng(555);

    // village houses along shore A & B
    const houses = [
      [480, 430, 130, 95], [660, 430, 100, 80], [980, 430, 150, 110],
      [1230, 430, 110, 88], [2100, 430, 120, 92], [2300, 430, 96, 78],
    ];
    for (const hh of houses) this.house(g, hh[0], hh[1], hh[2], hh[3], rng);

    // lamp posts (village)
    for (const lx of [420, 840, 1410, 2060, 2480]) this.lamp(g, lx, 430);

    // dock posts & rowboat
    g.fillStyle = '#5a4632';
    for (let i = 0; i < 6; i++) g.fillRect(-60 + i * 78, 446, 8, 56);
    this.boat(g, 250, 476);

    // bridge deck + arches (player walks the deck; arches stand in water)
    g.fillStyle = '#4a3d72';
    g.fillRect(1540, 438, 60, 84);
    g.fillRect(1755, 438, 70, 84);
    g.fillRect(1980, 438, 60, 84);
    g.fillStyle = '#574a86';
    g.fillRect(1540, 422, 500, 16);
    g.fillStyle = '#6e5d9e';
    g.fillRect(1540, 422, 500, 4);
    // low parapet
    g.fillStyle = '#574a86';
    for (let bx = 1548; bx < 2030; bx += 36) g.fillRect(bx, 410, 20, 12);

    // village gate arch (end of village)
    this.villageGate(g, 2560, 430);

    // descent props: columns and statues by the road
    this.brokenColumn(g, 2800, 430, 22, 110, '#332544');
    this.brokenColumn(g, 3030, 430, 22, 70, '#332544');
    this.statue(g, 3260, 412, '#3a2a4a');
    this.brokenColumn(g, 3640, 424, 24, 110, '#332544');
    this.statue(g, 4120, 430, '#3a2a4a');
    this.brokenColumn(g, 4980, 426, 22, 90, '#2e2040');
    this.brokenColumn(g, 5500, 436, 24, 120, '#2e2040');

    // gates zone: grand colonnade + THE GATE
    for (let i = 0; i < 4; i++) this.brokenColumn(g, 5850 + i * 170, 436, 26, 150 + (i % 2) * 40, '#231126');
    this.hellGate(g, 6620, 436);

    // arena back wall texture: hanging chains
    g.fillStyle = '#1c0d18';
    for (let i = 0; i < 12; i++) {
      const x = 6820 + i * 90;
      g.fillRect(x, 266 + (i % 3) * 40, 6, 170 - (i % 3) * 40);
    }

    // limbo props
    this.statue(g, 8100, 436, '#525c68');
    this.brokenColumn(g, 8260, 436, 20, 90, '#525c68');
    this.paleArch(g, 9650, 426, 70, 130, '#525c68');
    this.statue(g, 9850, 426, '#525c68');
    this.brokenColumn(g, 10080, 426, 22, 110, '#525c68');
    this.paleArch(g, 10380, 426, 80, 150, '#525c68');
    // final garden of unlit candles
    g.fillStyle = '#7a8694';
    for (let i = 0; i < 14; i++) {
      const x = 10300 + rng() * 380;
      g.fillRect(x, 412 + rng() * 8, 4, 12);
    }
  },

  house(g, x, gy, w, h, rng) {
    const body = '#564a8a', bodyD = '#473b73', roof = '#2c2347', winC = '#ffd98a';
    g.fillStyle = body;
    g.fillRect(x, gy - h, w, h);
    g.fillStyle = bodyD;
    g.fillRect(x + w * 0.75, gy - h, w * 0.25, h);
    g.fillStyle = roof;
    g.beginPath();
    g.moveTo(x - 10, gy - h);
    g.lineTo(x + w / 2, gy - h - 30 - rng() * 14);
    g.lineTo(x + w + 10, gy - h);
    g.closePath(); g.fill();
    // door
    g.fillStyle = '#2c2347';
    g.fillRect(x + w / 2 - 9, gy - 30, 18, 30);
    // windows with warm glow
    for (let wx = x + 12; wx < x + w - 16; wx += 30) {
      if (rng() < 0.75) {
        const wy = gy - h + 16 + Math.floor(rng() * 2) * 26;
        const gl = g.createRadialGradient(wx + 5, wy + 7, 2, wx + 5, wy + 7, 22);
        gl.addColorStop(0, 'rgba(255,215,140,0.5)');
        gl.addColorStop(1, 'rgba(255,215,140,0)');
        g.fillStyle = gl;
        g.fillRect(wx - 17, wy - 15, 44, 44);
        g.fillStyle = winC;
        g.fillRect(wx, wy, 10, 14);
        g.fillStyle = '#2c2347';
        g.fillRect(wx + 4, wy, 2, 14);
        g.fillRect(wx, wy + 6, 10, 2);
      }
    }
  },

  lamp(g, x, gy) {
    g.fillStyle = '#241c3e';
    g.fillRect(x - 2, gy - 74, 5, 74);
    g.fillRect(x - 7, gy - 78, 15, 7);
    const gl = g.createRadialGradient(x, gy - 84, 2, x, gy - 84, 34);
    gl.addColorStop(0, 'rgba(255,205,120,0.65)');
    gl.addColorStop(1, 'rgba(255,205,120,0)');
    g.fillStyle = gl;
    g.fillRect(x - 34, gy - 118, 68, 68);
    g.fillStyle = '#ffd98a';
    g.fillRect(x - 3, gy - 90, 7, 12);
  },

  boat(g, x, y) {
    g.fillStyle = '#6e5238';
    g.beginPath();
    g.moveTo(x - 34, y);
    g.quadraticCurveTo(x, y + 16, x + 34, y);
    g.lineTo(x + 26, y + 2);
    g.quadraticCurveTo(x, y + 13, x - 26, y + 2);
    g.closePath(); g.fill();
    g.fillRect(x - 30, y - 2, 60, 4);
    g.fillRect(x - 2, y - 10, 3, 10);
  },

  villageGate(g, x, gy) {
    const c = '#473b73', cD = '#352a58';
    g.fillStyle = c;
    g.fillRect(x - 70, gy - 150, 26, 150);
    g.fillRect(x + 44, gy - 150, 26, 150);
    g.fillStyle = cD;
    g.beginPath();
    g.moveTo(x - 70, gy - 130);
    g.arc(x, gy - 130, 70, Math.PI, 0);
    g.lineTo(x + 70, gy - 110);
    g.arc(x, gy - 110, 70, 0, Math.PI, true);
    g.closePath(); g.fill();
    g.fillStyle = c;
    g.fillRect(x - 80, gy - 168, 160, 22);
    for (let i = 0; i < 5; i++) g.fillRect(x - 76 + i * 34, gy - 182, 18, 16);
  },

  statue(g, x, gy, c) {
    g.fillStyle = c;
    g.fillRect(x - 16, gy - 12, 32, 12);              // plinth
    g.fillRect(x - 11, gy - 18, 22, 6);
    // robed figure, head bowed
    g.beginPath();
    g.moveTo(x - 9, gy - 18);
    g.quadraticCurveTo(x - 13, gy - 52, x - 4, gy - 62);
    g.arc(x, gy - 66, 6, Math.PI * 0.8, Math.PI * 2.25);
    g.quadraticCurveTo(x + 13, gy - 48, x + 9, gy - 18);
    g.closePath(); g.fill();
    // arm raised across
    g.beginPath();
    g.moveTo(x - 6, gy - 44);
    g.quadraticCurveTo(x + 4, gy - 52, x + 10, gy - 46);
    g.quadraticCurveTo(x + 4, gy - 42, x - 4, gy - 40);
    g.closePath(); g.fill();
  },

  hellGate(g, x, gy) {
    // colossal gate the player walks through
    const dark = '#19081a', darker = '#0e040e';
    g.fillStyle = darker;
    g.fillRect(x - 150, gy - 330, 56, 330);
    g.fillRect(x + 94, gy - 330, 56, 330);
    g.fillStyle = dark;
    g.fillRect(x - 138, gy - 330, 28, 330);
    g.fillRect(x + 106, gy - 330, 28, 330);
    // arch
    g.fillStyle = darker;
    g.beginPath();
    g.moveTo(x - 150, gy - 300);
    g.quadraticCurveTo(x, gy - 470, x + 150, gy - 300);
    g.lineTo(x + 150, gy - 250);
    g.quadraticCurveTo(x, gy - 410, x - 150, gy - 250);
    g.closePath(); g.fill();
    // horns on top
    g.beginPath();
    g.moveTo(x - 120, gy - 360);
    g.quadraticCurveTo(x - 170, gy - 450, x - 110, gy - 500);
    g.quadraticCurveTo(x - 135, gy - 420, x - 90, gy - 372);
    g.closePath(); g.fill();
    g.beginPath();
    g.moveTo(x + 120, gy - 360);
    g.quadraticCurveTo(x + 170, gy - 450, x + 110, gy - 500);
    g.quadraticCurveTo(x + 135, gy - 420, x + 90, gy - 372);
    g.closePath(); g.fill();
    // inner red glow
    const gl = g.createRadialGradient(x, gy - 120, 20, x, gy - 120, 260);
    gl.addColorStop(0, 'rgba(255,80,30,0.55)');
    gl.addColorStop(1, 'rgba(255,80,30,0)');
    g.fillStyle = gl;
    g.beginPath();
    g.moveTo(x - 94, gy);
    g.quadraticCurveTo(x, gy - 380, x + 94, gy);
    g.closePath(); g.fill();
    // inscription plate
    g.fillStyle = '#2a1020';
    g.fillRect(x - 80, gy - 392, 160, 26);
    g.fillStyle = 'rgba(255,110,50,0.9)';
    g.font = '10px Georgia';
    g.textAlign = 'center';
    g.fillText('LASCIATE OGNE SPERANZA', x, gy - 375);
    g.textAlign = 'left';
  },

  // ----------------------------------------------------------
  // TERRAIN LAYER (parallax 1): the platforms themselves
  // ----------------------------------------------------------
  bakeTerrain() {
    this.terrain = this.mkCanvas(WORLD_W + 200, VH + 200);
    const g = this.terrain.getContext('2d');
    g.translate(100, 0); // same offset as deco layer
    const rng = makeRng(2024);

    for (const p of PLATFORMS) {
      if (p.x < -100 || p.x > WORLD_W) continue; // skip border walls
      const pal = PALETTES[this.zoneOf(p.x + p.w / 2)];
      if (p.type === 'oneway') {
        g.fillStyle = '#3a2e58';
        g.fillRect(p.x, p.y, p.w, 6);
        g.fillStyle = pal.terrainTop;
        g.fillRect(p.x, p.y, p.w, 3);
        // support brackets
        g.fillStyle = '#2c2347';
        g.fillRect(p.x + 6, p.y + 6, 5, 12);
        g.fillRect(p.x + p.w - 11, p.y + 6, 5, 12);
        continue;
      }
      const isDock = p.deco === 'dock';
      const isBridge = p.deco === 'bridge';
      if (isDock) {
        g.fillStyle = '#6e5238';
        g.fillRect(p.x, p.y, p.w, p.h);
        g.fillStyle = '#5a4128';
        for (let x = p.x; x < p.x + p.w; x += 26) g.fillRect(x, p.y, 2, p.h);
        g.fillStyle = '#8a6a48';
        g.fillRect(p.x, p.y, p.w, 3);
        continue;
      }
      if (isBridge) continue; // baked in deco
      // stone body
      g.fillStyle = pal.terrain;
      g.fillRect(p.x, p.y, p.w, p.h);
      // darker bottom gradient
      const gr = g.createLinearGradient(0, p.y, 0, p.y + Math.min(p.h, 220));
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(1, 'rgba(0,0,0,0.5)');
      g.fillStyle = gr;
      g.fillRect(p.x, p.y, p.w, Math.min(p.h, 220));
      // brick cracks
      g.fillStyle = 'rgba(0,0,0,0.22)';
      for (let yy = p.y + 16; yy < p.y + Math.min(p.h, 200); yy += 18) {
        for (let xx = p.x + ((yy / 18) % 2) * 22; xx < p.x + p.w - 8; xx += 44) {
          if (rng() < 0.8) g.fillRect(xx, yy, 20, 2);
        }
      }
      // edge shading
      g.fillStyle = pal.terrainEdge;
      g.fillRect(p.x, p.y, 4, p.h);
      g.fillRect(p.x + p.w - 4, p.y, 4, p.h);
      // top surface
      g.fillStyle = pal.terrainTop;
      g.fillRect(p.x, p.y, p.w, 6);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(p.x, p.y, p.w, 2);
      // grass tufts in village / ash in limbo
      const zone = this.zoneOf(p.x + p.w / 2);
      if (zone === 'village') {
        g.fillStyle = '#7fc8a8';
        for (let x = p.x + 6; x < p.x + p.w - 6; x += 14) {
          if (rng() < 0.5) g.fillRect(x, p.y - 3, 3, 4);
        }
      } else if (zone === 'limbo') {
        g.fillStyle = '#aab4c0';
        for (let x = p.x + 6; x < p.x + p.w - 6; x += 18) {
          if (rng() < 0.4) g.fillRect(x, p.y - 2, 4, 2);
        }
      }
    }

    // spike pits: dark backdrop so gaps read as pits, then spikes
    for (const hz of HAZARDS) {
      if (hz.type !== 'spikes') continue;
      const gr2 = g.createLinearGradient(0, hz.y - 110, 0, hz.y + 10);
      gr2.addColorStop(0, 'rgba(10,7,18,0)');
      gr2.addColorStop(1, 'rgba(10,7,18,0.92)');
      g.fillStyle = gr2;
      g.fillRect(hz.x - 4, hz.y - 110, hz.w + 8, hz.h + 120);
      g.fillStyle = '#1a1224';
      g.fillRect(hz.x, hz.y + 14, hz.w, hz.h);
      g.fillStyle = '#3c2e50';
      for (let x = hz.x; x < hz.x + hz.w - 6; x += 14) {
        g.beginPath();
        g.moveTo(x, hz.y + 16); g.lineTo(x + 7, hz.y - 4); g.lineTo(x + 14, hz.y + 16);
        g.closePath(); g.fill();
      }
      g.fillStyle = '#564670';
      for (let x = hz.x; x < hz.x + hz.w - 6; x += 14) {
        g.beginPath();
        g.moveTo(x + 4, hz.y + 16); g.lineTo(x + 7, hz.y + 2); g.lineTo(x + 10, hz.y + 16);
        g.closePath(); g.fill();
      }
    }
  },

  zoneOf(x) {
    if (x < 2660) return 'village';
    if (x < 5700) return 'descent';
    if (x < 7900) return 'gates';
    return 'limbo';
  },

  // ----------------------------------------------------------
  // PER-FRAME DRAWING
  // ----------------------------------------------------------
  drawSky(pal, camX, time) {
    const gr = ctx.createLinearGradient(0, 0, 0, VH);
    gr.addColorStop(0, pal.skyTop);
    gr.addColorStop(0.55, pal.skyMid);
    gr.addColorStop(1, pal.skyBot);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, VW, VH);

    // stars (fade out near gates)
    const zone = this.zoneOf(camX + VW / 2);
    const starA = zone === 'gates' ? 0.25 : 0.8;
    ctx.fillStyle = '#fff';
    for (const s of this.stars) {
      const a = s.a * starA * (0.5 + 0.5 * Math.sin(time * 1.5 + s.tw));
      ctx.globalAlpha = a * 0.5;
      ctx.fillRect(s.x, s.y, 2, 2);
    }
    ctx.globalAlpha = 1;

    // moon (parallax ~0.05) — pink moon like the painting
    const mx = ((VW * 0.62 - camX * 0.05) % (VW * 1.6) + VW * 1.6) % (VW * 1.6) - VW * 0.2;
    const my = 86;
    const glow = ctx.createRadialGradient(mx, my, 20, mx, my, 150);
    glow.addColorStop(0, pal.moonGlow.replace('rgb', 'rgba').replace(')', ',0.55)'));
    glow.addColorStop(1, pal.moonGlow.replace('rgb', 'rgba').replace(')', ',0)'));
    // moonGlow may be a hex string when not blended
    if (pal.moonGlow[0] === '#') {
      const c = hexToRgb(pal.moonGlow);
      const glow2 = ctx.createRadialGradient(mx, my, 20, mx, my, 150);
      glow2.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},0.55)`);
      glow2.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
      ctx.fillStyle = glow2;
    } else {
      ctx.fillStyle = glow;
    }
    ctx.fillRect(mx - 150, my - 150, 300, 300);
    ctx.fillStyle = pal.moon;
    ctx.beginPath(); ctx.arc(mx, my, 46, 0, 7); ctx.fill();
    // craters
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.beginPath(); ctx.arc(mx - 14, my - 8, 9, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(mx + 12, my + 14, 6, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(mx + 18, my - 16, 5, 0, 7); ctx.fill();
  },

  drawClouds(pal, camX, time, behind) {
    const P = 0.12;
    const span = WORLD_W * P + VW * 2;
    for (const c of this.clouds) {
      if ((c.layer === 0) !== behind) continue;
      let sx = c.x - camX * P + Math.sin(time * 0.08 + c.seed) * 14;
      sx = ((sx % span) + span) % span - VW * 0.5;
      if (sx < -260 || sx > VW + 260) continue;
      this.puffCloud(ctx, sx, c.y, c.s, c.layer === 0 ? pal.cloud1 : pal.cloud2, c.seed);
    }
  },

  puffCloud(g, x, y, s, color, seed) {
    const rng = makeRng(seed);
    g.fillStyle = color;
    g.beginPath();
    const n = 6;
    for (let i = 0; i < n; i++) {
      const px = x + (i - n / 2) * 34 * s + rng() * 14;
      const py = y + (rng() - 0.5) * 22 * s;
      const r = (26 + rng() * 22) * s;
      g.moveTo(px + r, py);
      g.arc(px, py, r, 0, 7);
    }
    g.fill();
    // highlight puffs on top
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.beginPath();
    for (let i = 0; i < 3; i++) {
      const px = x + (i - 1) * 40 * s + rng() * 10;
      const py = y - 14 * s;
      const r = (18 + rng() * 12) * s;
      g.moveTo(px + r, py);
      g.arc(px, py, r, 0, 7);
    }
    g.fill();
  },

  drawWater(camX, time) {
    for (const hz of HAZARDS) {
      if (hz.type !== 'water') continue;
      const sx = hz.x - camX;
      if (sx > VW || sx + hz.w < 0) continue;
      const top = hz.y - 16;
      const gr = ctx.createLinearGradient(0, top, 0, VH);
      gr.addColorStop(0, '#7a64b4');
      gr.addColorStop(0.25, '#4a3c88');
      gr.addColorStop(1, '#241c4e');
      ctx.fillStyle = gr;
      ctx.fillRect(sx, top, hz.w, VH - top);
      // surface line
      ctx.fillStyle = 'rgba(255,220,235,0.55)';
      ctx.fillRect(sx, top, hz.w, 2);
      // shimmer streaks
      ctx.fillStyle = 'rgba(255,200,225,0.22)';
      for (let i = 0; i < 14; i++) {
        const wx = sx + ((i * 73 + time * 26) % hz.w);
        const wy = top + 10 + (i * 37) % 60;
        const ww = 16 + (i * 13) % 30;
        ctx.fillRect(wx, wy + Math.sin(time * 2 + i) * 2, ww, 2);
      }
      // moon glint
      ctx.fillStyle = 'rgba(255,190,215,0.13)';
      const gx = sx + hz.w * 0.55;
      ctx.fillRect(gx - 30, top + 4, 60, VH - top - 8);
    }
  },

  // ambient floating particles per zone
  updateMotes(dt, camX, pal) {
    const zone = this.zoneOf(camX + VW / 2);
    const want = zone === 'gates' ? 50 : 34;
    while (this.motes.length < want) {
      this.motes.push({
        x: camX + rand(-40, VW + 40),
        y: rand(0, VH),
        vx: rand(-6, 6), vy: 0,
        r: rand(1, 2.4), a: rand(0.2, 0.7),
        ph: rand(0, 9),
      });
    }
    for (const m of this.motes) {
      if (zone === 'gates' || zone === 'descent') m.vy = -rand(12, 30); // embers rise
      else if (zone === 'limbo') m.vy = rand(8, 18);                    // ash falls
      else m.vy = Math.sin(performance.now() / 900 + m.ph) * 6;        // fireflies drift
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.y < -10) { m.y = VH + 8; m.x = camX + rand(0, VW); }
      if (m.y > VH + 10) { m.y = -8; m.x = camX + rand(0, VW); }
      if (m.x < camX - 60) m.x += VW + 100;
      if (m.x > camX + VW + 60) m.x -= VW + 100;
    }
  },

  drawMotes(camX, pal, time) {
    for (const m of this.motes) {
      const a = m.a * (0.5 + 0.5 * Math.sin(time * 2 + m.ph));
      ctx.globalAlpha = a;
      ctx.fillStyle = pal.ambient;
      ctx.fillRect(m.x - camX, m.y, m.r, m.r);
    }
    ctx.globalAlpha = 1;
  },

  drawFog(pal, camX, time) {
    if (pal.fogA <= 0.01) return;
    ctx.globalAlpha = pal.fogA;
    for (let i = 0; i < 3; i++) {
      const y = 300 + i * 70;
      const off = (time * (8 + i * 5) + i * 300) % (VW + 600) - 300;
      const gr = ctx.createLinearGradient(0, y, 0, y + 90);
      gr.addColorStop(0, 'rgba(220,228,238,0)');
      gr.addColorStop(0.5, 'rgba(220,228,238,0.8)');
      gr.addColorStop(1, 'rgba(220,228,238,0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.ellipse(off, y + 45, 380, 45, 0, 0, 7);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(off + 560, y + 65, 320, 38, 0, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },

  // master draw, called from main loop (behind entities)
  draw(camX, camY, time, dt) {
    const pal = paletteAt(camX + VW / 2);
    this.drawSky(pal, camX, time);
    this.drawClouds(pal, camX, time, true);

    // far layer
    ctx.drawImage(this.far, clamp(camX * this.FAR_P, 0, this.far.width - VW), 0, VW, VH, 0, 0, VW, VH);

    this.drawClouds(pal, camX, time, false);

    // mid layer
    ctx.drawImage(this.mid, clamp(camX * this.MID_P, 0, this.mid.width - VW), 0, VW, VH, 0, 0, VW, VH);

    // water behind deco
    this.drawWater(camX, time);

    // deco + terrain (world-locked)
    const tx = clamp(camX + 100, 0, this.deco.width - VW);
    ctx.drawImage(this.deco, tx, 0, VW, VH, 0, 0, VW, VH);
    ctx.drawImage(this.terrain, tx, 0, VW, Math.min(VH, this.terrain.height), 0, 0, VW, Math.min(VH, this.terrain.height));

    this.updateMotes(dt, camX, pal);
    this.drawMotes(camX, pal, time);
    return pal;
  },
};
