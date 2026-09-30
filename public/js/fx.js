// Particles, floating text and synthesized sound effects.
import { LOOKS } from './art.js';

export class Particles {
  constructor() { this.list = []; this.texts = []; }

  add(p) { if (this.list.length < 2500) this.list.push(p); }

  trail(look, x, y) {
    const L = LOOKS[look] || LOOKS.fire;
    const color = L.trail === 'rainbow' ? `hsl(${(performance.now() / 4) % 360},100%,65%)` : L.trail;
    this.add({ x, y, vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6, life: 26, max: 26, r: (L.r || 4) * 0.8, color, glow: true });
  }

  boom(look, x, y, r, big) {
    const L = LOOKS[look] || LOOKS.fire;
    const cols = L.boom || ['#fff', '#ffcf3a', '#ff7a1a', '#555'];
    const n = Math.min(160, 20 + r * (big ? 2.4 : 1.4));
    this.add({ x, y, ring: true, life: 22, max: 22, r: r * 0.3, grow: r * 0.09, color: cols[0] });
    this.add({ x, y, flash: true, life: 16, max: 16, r: r * 2.4, color: cols[1] });
    // bright fireball core
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * r * 0.5;
      this.add({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: Math.cos(a) * 0.6, vy: Math.sin(a) * 0.6 - 0.3, life: 14 + Math.random() * 10, max: 24, r: r * (0.35 + Math.random() * 0.35), color: i % 3 ? cols[1] : cols[0], glow: true });
    }
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = Math.random() * r * 0.14 + 0.5;
      this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.6, g: -0.02, drag: 0.93, life: 30 + Math.random() * 30, max: 60, r: 3 + Math.random() * r * 0.18, color: cols[1 + (i % (cols.length - 1))], glow: i % 3 !== 0 });
    }
    for (let i = 0; i < n * 0.2; i++) {
      const a = Math.random() * Math.PI * 2, s = Math.random() * r * 0.08;
      this.add({ x, y: y - r * 0.3, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.9, g: -0.012, drag: 0.96, life: 50 + Math.random() * 40, max: 90, r: 6 + Math.random() * r * 0.25, color: 'rgba(120,110,110,0.22)', smoke: true });
    }
  }

  // Terrain chunks flung out of the crater, tumbling (colours sampled from the ground that was blown away).
  debris(x, y, r, colors) {
    const cols = Array.isArray(colors) ? colors : [colors];
    const n = Math.min(70, 18 + r * 1.1);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * (0.1 + Math.random() * 0.8), s = 2.5 + Math.random() * (3 + r * 0.12);
      this.add({ x: x + (Math.random() - 0.5) * r, y: y + (Math.random() - 0.5) * r * 0.5, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.22, drag: 0.995,
        life: 60 + Math.random() * 50, max: 110, r: 2.5 + Math.random() * Math.min(7, r * 0.12), color: cols[i % cols.length], chunk: true, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 0.4 });
    }
  }

  // Gunbound's translucent blast bubble that swells and fades over the crater.
  bubble(x, y, r) {
    this.add({ x, y, bubble: true, life: 26, max: 26, r: r * 0.6, grow: r * 0.035 });
  }

  splash(x, y, lava) {
    for (let i = 0; i < 30; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.2, s = 3 + Math.random() * 6;
      this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0.3, life: 45, max: 45, r: 2 + Math.random() * 3, color: lava ? '#ffb030' : '#bfe8ff', glow: lava });
    }
  }

  flame(x, y) {
    this.add({ x: x + (Math.random() - 0.5) * 6, y, vx: (Math.random() - 0.5) * 0.3, vy: -0.6 - Math.random() * 0.8, life: 30, max: 30, r: 3 + Math.random() * 4, color: Math.random() < 0.5 ? '#ff7a1a' : '#ffd23a', glow: true });
  }

  sparkle(x, y, color) {
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2, s = Math.random() * 2.5;
      this.add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, g: -0.02, life: 40, max: 40, r: 2 + Math.random() * 2, color, glow: true, star: true });
    }
  }

  text(x, y, str, color, size = 26, style) {
    this.texts.push({ x, y, str, color, size, style, life: 80, max: 80 });
  }

  update() {
    for (const p of this.list) {
      p.life--;
      if (p.vx !== undefined) {
        if (p.drag) { p.vx *= p.drag; p.vy *= p.drag; }
        p.vy += p.g || 0;
        p.x += p.vx; p.y += p.vy;
      }
      if (p.grow) p.r += p.grow;
    }
    this.list = this.list.filter(p => p.life > 0);
    for (const t of this.texts) { t.life--; t.y -= 0.6; }
    this.texts = this.texts.filter(t => t.life > 0);
  }

  draw(ctx) {
    for (const p of this.list) {
      const k = p.life / p.max;
      if (p.ring) {
        ctx.strokeStyle = p.color; ctx.globalAlpha = k; ctx.lineWidth = 4 * k + 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
        continue;
      }
      if (p.bubble) {
        ctx.globalAlpha = k * 0.9;
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        continue;
      }
      if (p.chunk) {
        p.rot += p.spin;
        ctx.globalAlpha = Math.min(1, k * 2);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color; ctx.strokeStyle = 'rgba(20,10,5,0.9)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-p.r, -p.r * 0.6); ctx.lineTo(p.r * 0.8, -p.r); ctx.lineTo(p.r, p.r * 0.7); ctx.lineTo(-p.r * 0.6, p.r); ctx.closePath();
        ctx.fill(); ctx.stroke(); ctx.restore();
        continue;
      }
      if (p.flash) {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, 'rgba(255,255,255,' + k + ')'); g.addColorStop(0.4, p.color); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = k; ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        continue;
      }
      ctx.globalAlpha = p.smoke ? k * 0.9 : Math.min(1, k * 1.5);
      ctx.fillStyle = p.color;
      if (p.glow) ctx.globalCompositeOperation = 'lighter';
      if (p.square) ctx.fillRect(p.x, p.y, p.r, p.r);
      else if (p.star) {
        ctx.beginPath();
        for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, rr = i % 2 ? p.r * 0.4 : p.r * 1.4; ctx.lineTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr); }
        ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (p.smoke ? 2 - k : k * 0.7 + 0.3), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const k = t.life / t.max;
      const pop = t.life > t.max - 8 ? 1 + (t.life - (t.max - 8)) * 0.08 : 1;
      ctx.globalAlpha = Math.min(1, k * 2);
      if (t.style === 'digit') {
        // Gunbound damage digits: small, red, thick white rim
        ctx.font = `900 ${t.size * pop}px Orbitron, sans-serif`;
        ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; ctx.strokeText(t.str, t.x, t.y);
        ctx.lineWidth = 2; ctx.strokeStyle = '#3a0000'; ctx.strokeText(t.str, t.x, t.y);
      } else {
        ctx.font = `800 ${t.size * pop}px 'Baloo 2', sans-serif`;
        ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.strokeText(t.str, t.x, t.y);
      }
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}

// ---------- sound ----------
// Everything is synthesised with WebAudio (no audio files): layered SFX and a little procedural
// background tune per map. A master gain makes muting instant.

// Battle theme, written for this game. Its character matches what we measured from Gunbound match
// audio (2026-09-30): F major, ~144 BPM, syncopated kick and stepping bass, a bright square lead with
// harmonics, sustained mid pads, and music sitting ~20 dB under the explosions.
// Progression F – Dm – B♭ – C. Melody = semitones above F4 per eighth note (null = rest).
const THEME = {
  chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]], // F, Dm, Bb, C as semitones from F4
  bass: [0, -3, -7, -5], // chord roots (played 2 octaves down)
  melody: [
    [7, null, 4, 7, 9, 7, 4, null], [9, null, 7, 9, 12, 9, 7, null],
    [12, null, 9, 5, 7, 9, null, null], [11, 12, 14, 11, 7, null, 7, 9],
    [12, null, 12, 14, 16, 14, 12, null], [14, 12, 9, null, 9, 12, 14, null],
    [17, null, 14, 12, 9, 12, 14, 12], [11, null, 14, null, 12, null, null, null],
  ],
};
// same song, different colour per map
const TUNES = {
  'dong-co': { bpm: 144, lead: 'square', transpose: 0 },
  'sa-mac': { bpm: 138, lead: 'sawtooth', transpose: -2 },
  'bang-gia': { bpm: 132, lead: 'triangle', transpose: 2 },
  'nui-lua': { bpm: 150, lead: 'square', transpose: -5 },
};
const F4 = 349.23;

export class Sfx {
  constructor() {
    this.ctx = null;
    try { this.muted = localStorage.getItem('tc-mute') === '1'; } catch { this.muted = false; }
  }
  ensure() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 1;
        // limiter so stacked blasts (split shots, big SS) don't clip
        const lim = this.ctx.createDynamicsCompressor();
        lim.threshold.value = -8; lim.knee.value = 6; lim.ratio.value = 12; lim.attack.value = 0.003; lim.release.value = 0.25;
        this.master.connect(lim).connect(this.ctx.destination);
      } catch { return null; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('tc-mute', m ? '1' : '0'); } catch {}
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.05);
  }
  out() { return this.master || this.ctx.destination; }
  noise(dur, freq, vol, type = 'lowpass', when = 0, dest = null) {
    const a = this.ensure(); if (!a) return;
    const buf = a.createBuffer(1, Math.max(1, a.sampleRate * dur), a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
    const src = a.createBufferSource(); src.buffer = buf;
    const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = a.createGain(); g.gain.value = vol;
    src.connect(f).connect(g).connect(dest || this.out());
    src.start(a.currentTime + when);
  }
  tone(freq, dur, vol = 0.15, type = 'sine', slide = 0, when = 0, dest = null) {
    const a = this.ensure(); if (!a) return;
    const t0 = a.currentTime + when;
    const o = a.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    const g = a.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(dest || this.out());
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  // cannon thump: short falling tone, a burst of mid noise, and a click
  fire() {
    this.tone(130, 0.28, 0.35, 'sine', -75);
    this.noise(0.16, 900, 0.4, 'bandpass');
    this.noise(0.03, 4000, 0.25, 'highpass');
  }
  // Explosion, shaped on measured Gunbound blasts: sharp crack, sub boom falling 90→40 Hz over ~0.9 s,
  // a low-passed body that closes down, and debris crackle spread over 0.8 s. Scales with blast radius.
  boom(r) {
    const a = this.ensure(); if (!a) return;
    const s = Math.min(1.7, Math.max(0.4, r / 42)), t0 = a.currentTime;
    this.noise(0.03, 3500, 0.35 * s, 'highpass');
    const o = a.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(90, t0); o.frequency.exponentialRampToValueAtTime(38, t0 + 0.9);
    const og = a.createGain(); og.gain.setValueAtTime(0.0001, t0); og.gain.linearRampToValueAtTime(0.55 * s, t0 + 0.012); og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.95 + 0.2 * s);
    o.connect(og).connect(this.out()); o.start(t0); o.stop(t0 + 1.3);
    const len = 0.9 + 0.3 * s, buf = a.createBuffer(1, a.sampleRate * len, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 1.6;
    const src = a.createBufferSource(); src.buffer = buf;
    const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(1600, t0); f.frequency.exponentialRampToValueAtTime(180, t0 + len);
    const g = a.createGain(); g.gain.value = 0.6 * s;
    src.connect(f).connect(g).connect(this.out()); src.start(t0);
    const n = Math.round(6 + 6 * s);
    for (let i = 0; i < n; i++) this.noise(0.04 + Math.random() * 0.05, 1800 + Math.random() * 3500, 0.07 * s, 'bandpass', 0.08 + Math.random() * 0.75);
  }
  // falling-shell whistle heard ~0.6 s before impact
  whistle() { this.tone(1900, 0.6, 0.05, 'sine', -1000); this.noise(0.6, 2200, 0.05, 'bandpass'); }
  ding() { this.tone(880, 0.25, 0.12, 'triangle'); this.tone(1320, 0.35, 0.12, 'triangle', 0, 0.12); }
  tick() { this.tone(1200, 0.05, 0.06, 'square'); }
  charge(p) { this.tone(200 + p * 6, 0.05, 0.03, 'sawtooth'); }
  heal() { [660, 880, 1100].forEach((f, i) => this.tone(f, 0.25, 0.08, 'sine', 0, i * 0.07)); }
  splash() { this.noise(0.6, 2500, 0.25, 'highpass'); this.tone(300, 0.3, 0.1, 'sine', -200); }
  die() { this.tone(400, 0.8, 0.18, 'sawtooth', -330); this.noise(0.9, 600, 0.3); }
  ss() { [440, 554, 659, 880].forEach((f, i) => this.tone(f, 0.4, 0.1, 'square', 0, i * 0.06)); }
  // Thunder, shaped on the measured strike: a bright crack, then 3-4 rolling rumbles that get darker
  thunder() {
    this.noise(0.06, 5000, 0.55, 'highpass');
    this.noise(0.4, 3000, 0.18, 'highpass', 0.02);
    [0, 0.28, 0.7, 1.1].forEach((w, i) => this.noise(0.55 - i * 0.05, 420 - i * 90, 0.5 - i * 0.08, 'lowpass', w));
    this.tone(48, 1.5, 0.3, 'sine', -12, 0.03);
  }
  // electric crackle when a shell is electrified
  zap() { for (let i = 0; i < 5; i++) this.noise(0.03, 3000 + Math.random() * 3000, 0.2, 'bandpass', i * 0.035); this.tone(90, 0.25, 0.08, 'sawtooth', 0); }
  whoosh() { this.noise(0.9, 700, 0.3, 'bandpass'); this.tone(220, 0.8, 0.06, 'sawtooth', 300); }

  // Background music: THEME at the map's tempo. Kick on 1 and 3 plus a syncopated eighth, snare on 2 and 4,
  // eighth hi-hats, stepping bass, a sustained pad and the square lead. Scheduled ~1 s ahead, loops forever.
  startMusic(mapId) {
    const a = this.ensure(); if (!a) return;
    this.stopMusic();
    const tune = TUNES[mapId] || TUNES['dong-co'];
    const bus = a.createGain(); bus.gain.value = 0.1; bus.connect(this.out());
    const e8 = 60 / tune.bpm / 2;
    const hz = st => F4 * 2 ** ((st + tune.transpose) / 12);
    let bar = 0, next = a.currentTime + 0.15;
    const kick = w => { const o = a.createOscillator(), g = a.createGain(); o.frequency.setValueAtTime(150, next + w); o.frequency.exponentialRampToValueAtTime(45, next + w + 0.12); g.gain.setValueAtTime(0.9, next + w); g.gain.exponentialRampToValueAtTime(0.001, next + w + 0.16); o.connect(g).connect(bus); o.start(next + w); o.stop(next + w + 0.2); };
    const schedule = () => {
      if (next < a.currentTime) next = a.currentTime + 0.05; // tab was throttled: skip ahead, don't pile notes up
      while (next < a.currentTime + 1.0) {
        const c = bar % 4, off = next - a.currentTime;
        for (const w of [0, 4, 7]) kick(w * e8);
        for (const w of [2, 6]) { this.noise(0.14, 1800, 0.5, 'bandpass', off + w * e8, bus); this.tone(190, 0.08, 0.25, 'triangle', -60, off + w * e8, bus); }
        for (let i = 0; i < 8; i++) this.noise(0.03, 7000, 0.18, 'highpass', off + i * e8, bus);
        const root = THEME.bass[c] - 24;
        [0, 0, 7, 12, 0, 7, 9, 7].forEach((iv, i) => this.tone(hz(root + iv), e8 * 0.9, 0.42, 'sawtooth', 0, off + i * e8, bus));
        for (const st of THEME.chords[c]) this.tone(hz(st), e8 * 7.6, 0.07, 'triangle', 0, off, bus);
        THEME.melody[bar % 8].forEach((st, i) => { if (st !== null) this.tone(hz(st), e8 * 0.85, 0.16, tune.lead, 0, off + i * e8, bus); });
        next += e8 * 8;
        bar++;
      }
    };
    schedule();
    this.music = { bus, timer: setInterval(schedule, 250) };
  }
  stopMusic() {
    if (!this.music) return;
    clearInterval(this.music.timer);
    const { bus } = this.music;
    bus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    setTimeout(() => bus.disconnect(), 1500);
    this.music = null;
  }
}
