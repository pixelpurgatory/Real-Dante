'use strict';
// ============================================================
// Procedural audio: SFX + generative ambient music per zone
// ============================================================

const AudioSys = {
  ctx: null, master: null, sfxGain: null, musGain: null,
  muted: false, noiseBuf: null,
  // music state
  zone: 'village', nextNote: 0, step: 0, padTimer: 0, curPad: null,

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return; }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.master);
    this.musGain = this.ctx.createGain();
    this.musGain.gain.value = 0.5;
    this.musGain.connect(this.master);
    // shared noise buffer
    const len = this.ctx.sampleRate * 1.0;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.nextNote = this.ctx.currentTime + 0.1;
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.55;
  },

  // ---------- SFX primitives ----------
  tone(freq, freqEnd, dur, type, vol, when) {
    if (!this.ctx) return;
    const t = when !== undefined ? when : this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  },

  noise(dur, vol, fLow, fHigh, sweepTo) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    const f0 = Math.sqrt(fLow * fHigh);
    bp.frequency.setValueAtTime(f0, t);
    if (sweepTo) bp.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    bp.Q.value = 0.9;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(bp); bp.connect(g); g.connect(this.sfxGain);
    src.start(t); src.stop(t + dur + 0.02);
  },

  sfx(name) {
    if (!this.ctx) return;
    switch (name) {
      case 'swing':   this.noise(0.12, 0.30, 900, 2600, 350); break;
      case 'hit':     this.tone(240, 80, 0.09, 'square', 0.22); this.noise(0.07, 0.25, 600, 2000); break;
      case 'clink':   this.tone(1900, 1500, 0.08, 'sine', 0.20); this.noise(0.05, 0.18, 2500, 6000); break;
      case 'pogo':    this.tone(300, 600, 0.12, 'square', 0.13); break;
      case 'hurt':    this.tone(170, 55, 0.30, 'sawtooth', 0.30); this.noise(0.18, 0.30, 150, 700); break;
      case 'die':     this.tone(220, 40, 0.9, 'sawtooth', 0.30); this.noise(0.7, 0.3, 100, 500); break;
      case 'edie':    this.tone(700, 1400, 0.22, 'sine', 0.14); this.tone(1050, 2100, 0.3, 'sine', 0.10); break;
      case 'jump':    this.tone(280, 460, 0.10, 'sine', 0.10); break;
      case 'land':    this.noise(0.06, 0.14, 120, 500); break;
      case 'dash':    this.noise(0.16, 0.25, 400, 1400, 2800); break;
      case 'heal':    this.tone(420, 880, 0.5, 'triangle', 0.16); break;
      case 'focus':   this.tone(220, 330, 0.25, 'sine', 0.06); break;
      case 'check':   this.tone(660, 660, 0.3, 'sine', 0.16); this.tone(990, 990, 0.5, 'sine', 0.12, this.ctx.currentTime + 0.15); break;
      case 'roar':    this.tone(85, 45, 0.9, 'sawtooth', 0.4); this.noise(0.8, 0.35, 80, 350); break;
      case 'slam':    this.tone(70, 35, 0.35, 'sine', 0.5); this.noise(0.3, 0.4, 60, 300); break;
      case 'stomp':   this.tone(90, 50, 0.15, 'sine', 0.3); this.noise(0.1, 0.2, 80, 400); break;
      case 'orb':     this.tone(620, 480, 0.25, 'sine', 0.12); break;
      case 'spirit':  this.tone(520, 1040, 0.8, 'sine', 0.07); break;
      case 'thrust':  this.noise(0.10, 0.22, 1200, 3200, 600); break;
      case 'shriek':  this.tone(1300, 1900, 0.25, 'sawtooth', 0.07); break;
      case 'gate':    this.tone(60, 40, 1.2, 'sawtooth', 0.25); this.noise(1.0, 0.2, 60, 240); break;
    }
  },

  // ---------- generative music ----------
  // A natural-minor scale on A
  freqOf(deg, oct) {
    const semis = [0, 2, 3, 5, 7, 8, 10];
    const s = semis[((deg % 7) + 7) % 7] + 12 * (oct + Math.floor(deg / 7));
    return 110 * Math.pow(2, s / 12);
  },

  pluck(freq, vol, when, dur) {
    const t = when, d = dur || 1.2;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    const o2 = this.ctx.createOscillator();
    o2.type = 'triangle';
    o2.frequency.value = freq * 2.003;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + d);
    const g2 = this.ctx.createGain();
    g2.gain.value = 0.25;
    o2.connect(g2); g2.connect(g);
    o.connect(g); g.connect(this.musGain);
    o.start(t); o.stop(t + d + 0.05);
    o2.start(t); o2.stop(t + d + 0.05);
  },

  padChord(degs, vol, when, dur) {
    for (const dg of degs) {
      const f = this.freqOf(dg, 0);
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = rand(-7, 7);
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.5;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(vol, when + dur * 0.35);
      g.gain.linearRampToValueAtTime(0, when + dur);
      o.connect(lp); lp.connect(g); g.connect(this.musGain);
      o.start(when); o.stop(when + dur + 0.1);
    }
  },

  kick(when, vol) {
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, when);
    o.frequency.exponentialRampToValueAtTime(40, when + 0.12);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.14);
    o.connect(g); g.connect(this.musGain);
    o.start(when); o.stop(when + 0.16);
  },

  hat(when, vol) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 6000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
    src.connect(hp); hp.connect(g); g.connect(this.musGain);
    src.start(when); src.stop(when + 0.07);
  },

  setZone(z) { this.zone = z; },

  // patterns: arrays of [deg, oct] or null per 8th-note step (16 steps)
  patterns: {
    village: { bpm: 72, mel: [[0,2],null,[4,2],null,[2,2],null,null,[4,2],[7,2],null,[4,2],null,[2,2],null,[1,2],null], pad: [[0,2,4],[5,7,9]], padBars: 4, drums: false, vol: 0.10 },
    descent: { bpm: 60, mel: [[0,1],null,null,null,[3,1],null,null,null,[2,1],null,null,null,[1,1],null,null,null], pad: [[0,2,4],[3,5,7]], padBars: 4, drums: false, vol: 0.09 },
    gates:   { bpm: 58, mel: [[0,1],null,null,null,null,null,[1,1],null,[0,1],null,null,null,null,null,null,null], pad: [[0,3,4]], padBars: 4, drums: false, vol: 0.10 },
    boss:    { bpm: 132, mel: [[0,1],[0,1],[3,1],[0,1],[5,1],null,[4,1],[3,1],[0,1],[0,1],[3,1],[0,1],[6,1],null,[5,1],[4,1]], pad: [[0,2,4]], padBars: 2, drums: true, vol: 0.13 },
    limbo:   { bpm: 50, mel: [[7,1],null,null,null,null,null,[5,1],null,null,null,[4,1],null,null,null,null,null], pad: [[0,2,4],[2,4,6]], padBars: 4, drums: false, vol: 0.08 },
    none:    { bpm: 60, mel: [null], pad: [], padBars: 4, drums: false, vol: 0 },
  },

  update() {
    if (!this.ctx || this.muted) return;
    const pat = this.patterns[this.zone] || this.patterns.none;
    const stepDur = 60 / pat.bpm / 2; // 8th notes
    const ahead = this.ctx.currentTime + 0.25;
    while (this.nextNote < ahead) {
      const idx = this.step % pat.mel.length;
      const n = pat.mel[idx];
      if (n && pat.vol > 0) this.pluck(this.freqOf(n[0], n[1]), pat.vol, this.nextNote, stepDur * 6);
      if (pat.drums) {
        if (this.step % 4 === 0) this.kick(this.nextNote, 0.22);
        if (this.step % 2 === 1) this.hat(this.nextNote, 0.05);
      }
      // pad chord every padBars bars (bar = 16 steps here)
      if (pat.pad.length && this.step % (16 * pat.padBars) === 0) {
        const chord = pat.pad[Math.floor(this.step / (16 * pat.padBars)) % pat.pad.length];
        this.padChord(chord, 0.035, this.nextNote, stepDur * 16 * pat.padBars + 0.5);
      }
      this.nextNote += stepDur;
      this.step++;
    }
  },
};
