// audio.js — all sound is synthesized with WebAudio: no audio files.
// Engine hum, gunshots, sirens, pickups, UI blips and a funk bassline.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicTimer = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.muted = false;
    this.musicStep = 0;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // engine hum
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 40;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
      this.engineOsc.connect(lp); lp.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
      // police siren (two-tone)
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start();
    } catch (e) { this.ctx = null; }
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.5; }
  setEngine(speed01) {
    if (!this.ctx) return;
    this.engineOsc.frequency.value = 45 + speed01 * 130;
    this.engineGain.gain.value = speed01 > 0.02 ? 0.05 + speed01 * 0.05 : 0;
  }
  setSiren(on) {
    if (!this.ctx) return;
    if (on) {
      this.sirenGain.gain.value = 0.035;
      const t = this.ctx.currentTime;
      this.sirenOsc.frequency.cancelScheduledValues(t);
      this.sirenOsc.frequency.setValueAtTime(660, t);
      this.sirenOsc.frequency.linearRampToValueAtTime(920, t + 0.45);
      this.sirenOsc.frequency.linearRampToValueAtTime(660, t + 0.9);
    } else this.sirenGain.gain.value = 0;
  }
  blip(freq, dur, type, vol) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = type || 'square'; o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, vol, freq) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1800;
    const g = this.ctx.createGain(); g.gain.value = vol || 0.25;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }
  shoot() { this.noise(0.12, 0.3, 2400); this.blip(180, 0.08, 'square', 0.1); }
  enemyShoot() { this.noise(0.1, 0.12, 1600); }
  hit() { this.blip(220, 0.06, 'sawtooth', 0.08); }
  pickup() { this.blip(660, 0.09, 'sine', 0.14); setTimeout(() => this.blip(990, 0.12, 'sine', 0.14), 90); }
  cash() { this.blip(880, 0.08, 'sine', 0.12); setTimeout(() => this.blip(1174, 0.1, 'sine', 0.12), 80); setTimeout(() => this.blip(1568, 0.16, 'sine', 0.12), 160); }
  mission() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.18, 'triangle', 0.14), i * 110)); }
  fail() { [400, 300, 220].forEach((f, i) => setTimeout(() => this.blip(f, 0.2, 'sawtooth', 0.1), i * 130)); }
  crash() { this.noise(0.25, 0.3, 900); }
  click() { this.blip(700, 0.05, 'square', 0.07); }
  // PD dispatch chirp: two short radio blips, like a mic keying open
  radio() { this.blip(1250, 0.06, 'square', 0.09); setTimeout(() => this.blip(950, 0.08, 'square', 0.09), 90); }
  // a tire blowing on a spike strip: a sharp pop, then air hissing out
  tirePop() { this.noise(0.08, 0.4, 3000); this.blip(140, 0.25, 'sawtooth', 0.14); setTimeout(() => this.noise(0.5, 0.08, 5000), 60); }
  // tyres scrubbing in a hard turn or on wet asphalt
  skid() { this.noise(0.35, 0.1, 2600); }
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    // Funk bassline + hats, E minor groove, 112 BPM. Notes are MIDI numbers
    // (40 = E2); 0 is a rest, so the groove breathes between notes.
    const bass = [40, 0, 40, 47, 0, 40, 52, 45, 40, 0, 43, 47, 50, 47, 43, 0];
    const stepDur = 60 / 112 / 2;
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const n = bass[this.musicStep % bass.length];
      if (n) {
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator(); o.type = 'triangle';
        o.frequency.value = 82.41 * Math.pow(2, (n - 40) / 12);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.11, t); g.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 0.9);
        o.connect(g); g.connect(this.master); o.start(t); o.stop(t + stepDur);
      }
      if (this.musicStep % 2 === 0) this.noise(0.03, 0.03, 6000);
      this.musicStep++;
    }, stepDur * 1000);
  }
}
