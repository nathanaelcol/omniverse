export class AudioBus {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.4;
    this.drones = [];
    this.theme = 'zero';
  }

  ensure() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  resume() {
    this.ensure();
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  tone(freq, dur = 0.12, type = 'sine', gain = 0.08) {
    if (!this.ctx || this.volume <= 0) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  blip() { this.tone(660, 0.07, 'triangle', 0.05); }
  ok() { this.tone(520, 0.08, 'sine', 0.06); this.tone(780, 0.12, 'sine', 0.04); }
  hit() { this.tone(140, 0.1, 'square', 0.05); }
  hurt() { this.tone(90, 0.18, 'sawtooth', 0.04); }
  law() { this.tone(220, 0.2, 'sine', 0.05); this.tone(440, 0.28, 'triangle', 0.04); }

  setTheme(name) {
    this.theme = name;
    if (!this.ctx) return;
    this.stop();
    const notes = {
      zero: [98, 146],
      giants: [82, 123],
      inverted: [110, 175],
      arena: [73, 110],
      custom: [130, 196],
    }[name] || [98, 146];
    const now = this.ctx.currentTime;
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      g.gain.value = 0.012;
      osc.connect(g);
      g.connect(this.master);
      osc.start(now);
      this.drones.push(osc);
    });
  }

  stop() {
    for (const osc of this.drones) {
      try { osc.stop(); } catch { /* already stopped */ }
    }
    this.drones = [];
  }
}
