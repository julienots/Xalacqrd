// Procedural audio identity for XALACARDS — every sound is synthesised with
// WebAudio, so the game ships with zero audio assets and a unique sound.

type MusicMode = 'none' | 'menu' | 'battle' | 'tension' | 'victory';

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class AudioSystem {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private musicFilter!: BiquadFilterNode;
  private reverb!: ConvolverNode;
  private reverbSend!: GainNode;
  private noiseBuf!: AudioBuffer;
  private musicMode: MusicMode = 'none';
  private schedTimer: ReturnType<typeof setInterval> | null = null;
  private nextBeat = 0;
  private beat = 0;
  sfxVolume = 0.8;
  musicVolume = 0.5;

  /** Must be called from a user gesture (browser autoplay rules). */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx: AudioContext = new AC();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    this.master.connect(comp).connect(ctx.destination);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = this.sfxVolume; this.sfxBus.connect(this.master);
    this.musicFilter = ctx.createBiquadFilter(); this.musicFilter.type = 'lowpass'; this.musicFilter.frequency.value = 2400;
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = this.musicVolume * 0.5;
    this.musicFilter.connect(this.musicBus).connect(this.master);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.6);
    this.reverbSend = ctx.createGain(); this.reverbSend.gain.value = 0.35;
    this.reverbSend.connect(this.reverb).connect(this.master);
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (this.musicMode !== 'none') { const m = this.musicMode; this.musicMode = 'none'; this.music(m); }
  }

  private impulse(sec: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = buf.getChannelData(c);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }

  setVolumes(sfx: number, music: number) {
    this.sfxVolume = sfx; this.musicVolume = music;
    if (this.ctx) {
      this.sfxBus.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.05);
      this.musicBus.gain.setTargetAtTime(music * 0.5, this.ctx.currentTime, 0.1);
    }
  }

  // ---------- primitives ----------
  private tone(freq: number, dur: number, opts: { type?: OscillatorType; vol?: number; at?: number; attack?: number; slide?: number; rev?: number; bus?: AudioNode; detune?: number } = {}) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime + (opts.at ?? 0);
    const o = ctx.createOscillator();
    o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts.detune) o.detune.value = opts.detune;
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * opts.slide), t + dur);
    const g = ctx.createGain();
    const v = opts.vol ?? 0.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (opts.attack ?? 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(opts.bus ?? this.sfxBus);
    if (opts.rev) { const s = ctx.createGain(); s.gain.value = opts.rev; g.connect(s).connect(this.reverbSend); }
    o.start(t); o.stop(t + dur + 0.05);
  }

  private noise(dur: number, opts: { at?: number; vol?: number; type?: BiquadFilterType; freq?: number; freqEnd?: number; q?: number; rev?: number; attack?: number } = {}) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime + (opts.at ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = opts.type ?? 'bandpass';
    f.frequency.setValueAtTime(opts.freq ?? 1200, t);
    if (opts.freqEnd) f.frequency.exponentialRampToValueAtTime(opts.freqEnd, t + dur);
    f.Q.value = opts.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.vol ?? 0.2, t + (opts.attack ?? 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    if (opts.rev) { const s = ctx.createGain(); s.gain.value = opts.rev; g.connect(s).connect(this.reverbSend); }
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  private chord(notes: number[], dur: number, opts: { type?: OscillatorType; vol?: number; at?: number; spread?: number; rev?: number; attack?: number } = {}) {
    notes.forEach((n, i) => this.tone(NOTE(n), dur, { type: opts.type ?? 'triangle', vol: (opts.vol ?? 0.12) / Math.sqrt(notes.length), at: (opts.at ?? 0) + i * (opts.spread ?? 0), rev: opts.rev ?? 0.5, attack: opts.attack }));
  }

  // ---------- SFX ----------
  play(name: string, arg?: any) {
    if (!this.ctx || this.sfxVolume <= 0) return;
    const fn = (this as any)['sfx_' + name];
    if (fn) fn.call(this, arg);
  }

  sfx_tap() { this.tone(1400, 0.05, { type: 'sine', vol: 0.06 }); }
  sfx_menu() { this.tone(660, 0.08, { type: 'triangle', vol: 0.08 }); this.tone(990, 0.1, { type: 'sine', vol: 0.05, at: 0.04 }); }
  sfx_back() { this.tone(520, 0.08, { type: 'triangle', vol: 0.07, slide: 0.7 }); }
  sfx_error() { this.tone(220, 0.15, { type: 'square', vol: 0.05 }); this.tone(180, 0.2, { type: 'square', vol: 0.05, at: 0.1 }); }
  sfx_cardPlace() { this.tone(120, 0.18, { type: 'sine', vol: 0.35, slide: 0.5 }); this.noise(0.08, { freq: 2500, vol: 0.12, type: 'highpass' }); }
  sfx_cardFlip() { this.noise(0.16, { freq: 800, freqEnd: 4000, vol: 0.15, q: 2 }); }
  sfx_cardSlide() { this.noise(0.22, { freq: 3000, freqEnd: 1500, vol: 0.08, q: 0.7 }); }
  sfx_draw() { this.noise(0.12, { freq: 2000, freqEnd: 5000, vol: 0.07, q: 1.5 }); }
  sfx_packShake() { this.noise(0.1, { freq: 1500, vol: 0.06, q: 3 }); }
  sfx_packTear() {
    this.noise(0.5, { freq: 600, freqEnd: 6000, vol: 0.3, q: 0.8, attack: 0.02 });
    for (let i = 0; i < 8; i++) this.noise(0.03, { at: i * 0.05, freq: 3000 + Math.random() * 3000, vol: 0.12, q: 5 });
    this.tone(90, 0.4, { vol: 0.2, slide: 0.6, at: 0.3 });
  }
  sfx_whoosh() { this.noise(0.4, { freq: 300, freqEnd: 2500, vol: 0.18, q: 1.2, attack: 0.1 }); }
  sfx_buildup(sec = 1.2) {
    this.noise(sec, { freq: 200, freqEnd: 8000, vol: 0.2, q: 1.5, attack: sec * 0.9 });
    this.tone(NOTE(45), sec, { type: 'sawtooth', vol: 0.05, slide: 2, attack: sec * 0.8 });
  }
  sfx_reveal(tier: number) {
    // rarity-specific reveal stingers: subtle for commons, enormous for Secret/Prismatic
    if (tier <= 0) { this.tone(NOTE(84), 0.12, { vol: 0.05, type: 'sine' }); return; }
    if (tier === 1) { this.tone(NOTE(81), 0.2, { vol: 0.07, type: 'triangle', rev: 0.3 }); return; }
    if (tier === 2) { this.chord([76, 83], 0.6, { spread: 0.06, vol: 0.18 }); return; }
    if (tier === 3) { this.chord([72, 76, 79, 84], 1, { spread: 0.07, vol: 0.22, rev: 0.7 }); this.shimmer(0.6, 0.06); return; }
    if (tier === 4) { // legendary — golden fanfare
      this.chord([60, 67, 72, 76, 79], 2, { type: 'sawtooth', vol: 0.12, rev: 0.8, attack: 0.05 });
      this.chord([84, 88, 91], 1.6, { spread: 0.1, vol: 0.18, at: 0.15 });
      this.tone(NOTE(36), 1.5, { vol: 0.3, type: 'sine' });
      this.shimmer(1.4, 0.08); return;
    }
    if (tier === 5) { // mythic — cosmic swell
      this.chord([61, 68, 73, 77, 80], 2.6, { type: 'sawtooth', vol: 0.12, attack: 0.3, rev: 1 });
      this.chord([85, 89, 92, 97], 2, { spread: 0.12, vol: 0.16, at: 0.3 });
      this.tone(NOTE(37), 2, { vol: 0.3 }); this.shimmer(2, 0.1); return;
    }
    if (tier === 6) { // ancient — distortion drone
      this.tone(NOTE(33), 3, { type: 'sawtooth', vol: 0.12, slide: 1.02, attack: 0.4, rev: 0.8 });
      this.tone(NOTE(33), 3, { type: 'sawtooth', vol: 0.12, detune: 18, attack: 0.4 });
      this.chord([57, 64, 69, 72, 76], 2.8, { vol: 0.14, attack: 0.5, at: 0.3, rev: 1 });
      this.noise(2, { freq: 100, freqEnd: 900, vol: 0.12, type: 'lowpass', attack: 0.8 }); return;
    }
    if (tier === 7) { // celestial — choir
      [0, 7, 12, 16, 19, 24].forEach((iv, i) => {
        this.tone(NOTE(62 + iv), 3.2, { type: 'triangle', vol: 0.06, attack: 0.6, at: i * 0.08, rev: 1 });
        this.tone(NOTE(62 + iv), 3.2, { type: 'sine', vol: 0.05, attack: 0.6, at: i * 0.08, detune: 9 });
      });
      this.shimmer(3, 0.12); return;
    }
    // Secret & Prismatic — impact + huge chord + sparkles
    this.tone(NOTE(28), 2.4, { type: 'sine', vol: 0.5, slide: 0.5 });
    this.noise(1.2, { freq: 6000, freqEnd: 200, vol: 0.35, type: 'lowpass' });
    const base = tier === 8 ? 57 : 60;
    this.chord(tier === 8 ? [base, base + 3, base + 7, base + 10, base + 15, base + 19] : [base, base + 4, base + 7, base + 11, base + 14, base + 19], 4, { type: 'sawtooth', vol: 0.16, attack: 0.05, rev: 1.2 });
    for (let i = 0; i < 12; i++) this.tone(NOTE(base + 24 + [0, 4, 7, 11, 12, 16][i % 6]), 0.4, { at: 0.2 + i * 0.09, vol: 0.06, type: 'sine', rev: 1 });
    this.shimmer(3.5, 0.14);
  }
  private shimmer(dur: number, vol: number) {
    for (let i = 0; i < 14; i++) this.tone(2000 + Math.random() * 4000, 0.15, { at: Math.random() * dur * 0.7, vol: vol * 0.4, type: 'sine', rev: 1 });
  }
  sfx_attack() { this.noise(0.25, { freq: 500, freqEnd: 3000, vol: 0.2, q: 1 }); }
  sfx_hit() { this.tone(160, 0.15, { type: 'square', vol: 0.12, slide: 0.4 }); this.noise(0.1, { freq: 1800, vol: 0.2, q: 0.8 }); }
  sfx_heroHit() { this.tone(90, 0.35, { type: 'sine', vol: 0.4, slide: 0.5 }); this.noise(0.2, { freq: 900, vol: 0.2 }); }
  sfx_death() { this.noise(0.6, { freq: 3000, freqEnd: 150, vol: 0.2, q: 1 }); this.tone(220, 0.5, { type: 'triangle', vol: 0.1, slide: 0.3 }); }
  sfx_heal() { this.chord([79, 83, 86], 0.6, { spread: 0.06, vol: 0.12, type: 'sine' }); }
  sfx_shield() { this.tone(880, 0.4, { type: 'triangle', vol: 0.1, rev: 0.6 }); this.tone(1320, 0.4, { type: 'sine', vol: 0.06, at: 0.05, rev: 0.6 }); }
  sfx_shieldBreak() { this.noise(0.3, { freq: 5000, vol: 0.18, q: 3 }); this.tone(1760, 0.2, { vol: 0.05, slide: 0.5 }); }
  sfx_freeze() { this.noise(0.5, { freq: 7000, freqEnd: 3000, vol: 0.12, q: 4 }); this.tone(1568, 0.5, { vol: 0.05, rev: 0.8 }); }
  sfx_spell() { this.chord([67, 74, 79], 0.5, { spread: 0.03, vol: 0.12, type: 'sine' }); this.noise(0.4, { freq: 1000, freqEnd: 6000, vol: 0.1 }); }
  sfx_buff() { this.tone(NOTE(72), 0.15, { vol: 0.08 }); this.tone(NOTE(79), 0.25, { vol: 0.08, at: 0.08 }); }
  sfx_summon() { this.tone(NOTE(55), 0.5, { type: 'sawtooth', vol: 0.06, slide: 2, attack: 0.1 }); this.noise(0.4, { freq: 400, freqEnd: 3000, vol: 0.1 }); }
  sfx_roar() {
    this.tone(110, 0.9, { type: 'sawtooth', vol: 0.12, slide: 0.6, attack: 0.05 });
    this.tone(116, 0.9, { type: 'sawtooth', vol: 0.12, slide: 0.55, attack: 0.05 });
    this.noise(0.9, { freq: 700, freqEnd: 250, vol: 0.25, q: 0.8, attack: 0.05 });
  }
  sfx_turn() { this.chord([67, 72], 0.4, { spread: 0.08, vol: 0.1 }); }
  sfx_victory() { [60, 64, 67, 72].forEach((n, i) => this.chord([n, n + 7], 0.5, { at: i * 0.14, vol: 0.18, type: 'sawtooth' })); this.chord([72, 76, 79, 84], 2, { at: 0.6, vol: 0.2, rev: 1 }); }
  sfx_defeat() { [67, 63, 60, 55].forEach((n, i) => this.tone(NOTE(n), 0.6, { at: i * 0.22, vol: 0.12, type: 'triangle', rev: 0.6 })); }
  sfx_reward() { [84, 88, 91, 96].forEach((n, i) => this.tone(NOTE(n), 0.25, { at: i * 0.06, vol: 0.08, type: 'sine', rev: 0.4 })); }
  sfx_coins() { for (let i = 0; i < 5; i++) this.tone(2400 + i * 200, 0.08, { at: i * 0.05, vol: 0.05, type: 'square' }); }
  sfx_purchase() { this.sfx_coins(); this.chord([72, 79, 84], 0.6, { at: 0.2, vol: 0.12 }); }
  sfx_chestOpen() { this.tone(80, 0.5, { type: 'sawtooth', vol: 0.1, slide: 1.5 }); this.noise(0.6, { freq: 300, freqEnd: 5000, vol: 0.2, at: 0.3 }); this.sfx_reveal(3); }
  sfx_levelUp() { this.chord([60, 64, 67, 72, 76], 1.2, { spread: 0.05, vol: 0.18, rev: 0.8 }); }
  sfx_page() { this.chord([72, 76, 79, 84, 88], 1.4, { spread: 0.08, vol: 0.18, rev: 1 }); this.shimmer(1, 0.08); }

  // ---------- generative music ----------
  music(mode: MusicMode) {
    if (mode === this.musicMode) return;
    this.musicMode = mode;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const target = mode === 'tension' ? 500 : mode === 'battle' ? 3200 : 2200;
    this.musicFilter.frequency.cancelScheduledValues(t);
    this.musicFilter.frequency.setTargetAtTime(target, t, 0.4);
    if (mode === 'none') { if (this.schedTimer) clearInterval(this.schedTimer); this.schedTimer = null; return; }
    if (!this.schedTimer) {
      this.nextBeat = this.ctx.currentTime + 0.1;
      this.schedTimer = setInterval(() => this.schedule(), 90);
    }
  }

  private schedule() {
    const ctx = this.ctx; if (!ctx || this.musicMode === 'none' || this.musicVolume <= 0) return;
    const bpm = this.musicMode === 'battle' ? 104 : this.musicMode === 'tension' ? 60 : 76;
    const spb = 60 / bpm / 2; // eighth notes
    // progression (original): i - VI - III - VII in D minor-ish, lifted for menus
    const prog = this.musicMode === 'battle' ? [[50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55]] : [[50, 57, 62], [46, 53, 58], [43, 50, 55], [45, 52, 57]];
    while (this.nextBeat < ctx.currentTime + 0.4) {
      const at = this.nextBeat - ctx.currentTime;
      const bar = Math.floor(this.beat / 8) % prog.length;
      const step = this.beat % 8;
      const chord = prog[bar];
      if (step === 0) {
        // pad
        for (const n of chord) {
          this.tone(NOTE(n), spb * 8.5, { type: 'sawtooth', vol: 0.035, at, attack: 0.6, bus: this.musicFilter, detune: -7 });
          this.tone(NOTE(n + 12), spb * 8.5, { type: 'triangle', vol: 0.03, at, attack: 0.8, bus: this.musicFilter, detune: 6 });
        }
        this.tone(NOTE(chord[0] - 12), spb * 8, { type: 'sine', vol: 0.09, at, attack: 0.2, bus: this.musicFilter });
      }
      if (this.musicMode !== 'tension') {
        // arpeggio pluck
        const arpSeq = [0, 1, 2, 1, 2, 0, 2, 1];
        const n = chord[arpSeq[step]] + 24;
        if (this.musicMode === 'battle' || step % 2 === 0) this.tone(NOTE(n), spb * 1.6, { type: 'triangle', vol: 0.03, at, bus: this.musicFilter });
        if (this.musicMode === 'battle') {
          if (step % 4 === 0) this.tone(65, 0.25, { vol: 0.16, slide: 0.4, at, bus: this.musicFilter });
          if (step % 4 === 2) this.noise(0.06, { at, freq: 7000, vol: 0.025, type: 'highpass' });
        }
      } else if (step % 4 === 0) {
        this.tone(NOTE(chord[0] + 24), spb * 3, { type: 'sine', vol: 0.02, at, bus: this.musicFilter });
      }
      this.nextBeat += spb;
      this.beat++;
    }
  }
}
