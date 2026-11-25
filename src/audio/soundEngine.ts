const MAJOR_SCALE_HZ = [
  523.25, // C5
  587.33, // D5
  659.25, // E5
  698.46, // F5
  783.99, // G5
  880.0, // A5
  987.77, // B5
  1046.5, // C6
  1174.66, // D6
  1318.51, // E6
];

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private noiseBuffer: AudioBuffer | null = null;

  constructor(initialMuted = false) {
    this.muted = initialMuted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    this.unlock();
    return this.ctx;
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const length = Math.floor(ctx.sampleRate * 0.5);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  private playTone(
    freqStart: number,
    freqEnd: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainPeak = 0.14,
    delay = 0,
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playSelect(): void {
    this.playTone(540, 740, 0.06, 'sine', 0.08);
  }

  public playSwap(): void {
    this.playTone(340, 520, 0.09, 'triangle', 0.08);
  }

  public playRevert(): void {
    this.playTone(310, 210, 0.12, 'triangle', 0.11, 0);
    this.playTone(240, 165, 0.12, 'triangle', 0.09, 0.07);
  }

  public playMatch(cascade: number): void {
    const idx = Math.min(Math.max(0, cascade - 1), MAJOR_SCALE_HZ.length - 1);
    const base = MAJOR_SCALE_HZ[idx];
    // Marimba + wind-chime shimmer
    this.playTone(base, base * 1.01, 0.2, 'sine', 0.14, 0);
    this.playTone(base * 2, base * 2, 0.14, 'triangle', 0.055, 0.01);
    if (cascade >= 2) {
      this.playTone(base * 1.5, base * 1.5, 0.18, 'sine', 0.065, 0.03);
    }
  }

  public playSpecialCreate(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      this.playTone(f, f * 1.01, 0.16, 'triangle', 0.09, i * 0.045);
    });
  }

  public playLineLaser(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.playTone(1150, 240, 0.22, 'sawtooth', 0.065, 0);
    this.playTone(880, 440, 0.18, 'sine', 0.1, 0.02);
  }

  public playBombBlast(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    this.playTone(170, 38, 0.28, 'sine', 0.22, 0);

    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(140, now + 0.26);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.28);
  }

  public playMagicBirdLightning(): void {
    const freqs = [880, 1046.5, 1318.5, 1567.98, 1760];
    freqs.forEach((f, idx) => {
      this.playTone(f, f * 1.18, 0.16, 'sine', 0.075, idx * 0.035);
      this.playTone(f * 1.5, f * 0.9, 0.09, 'sawtooth', 0.03, idx * 0.035);
    });
  }

  public playIceBreak(): void {
    this.playTone(1760, 2240, 0.09, 'sine', 0.07, 0);
    this.playTone(2637, 1980, 0.11, 'triangle', 0.05, 0.015);
  }

  public playCrateBreak(): void {
    this.playTone(230, 95, 0.11, 'square', 0.06, 0);
    this.playTone(160, 80, 0.09, 'triangle', 0.08, 0.01);
  }

  public playVineBreak(): void {
    this.playTone(420, 760, 0.1, 'triangle', 0.08, 0);
    this.playTone(620, 320, 0.08, 'sine', 0.07, 0.03);
  }

  public playPodCollect(): void {
    this.playTone(783.99, 1046.5, 0.14, 'sine', 0.11, 0);
    this.playTone(1318.51, 1567.98, 0.2, 'triangle', 0.1, 0.07);
  }

  public playHammer(): void {
    this.playTone(210, 72, 0.14, 'triangle', 0.18, 0);
    this.playTone(540, 220, 0.07, 'square', 0.05, 0);
  }

  public playFlyHit(): void {
    this.playTone(1174.66, 1396.91, 0.07, 'sine', 0.045, 0);
  }

  public playHeartbeat(): void {
    this.playTone(110, 68, 0.12, 'sine', 0.14, 0);
    this.playTone(104, 62, 0.14, 'sine', 0.12, 0.16);
  }

  public playShuffle(): void {
    const notes = [440, 523.25, 587.33, 659.25, 783.99];
    notes.forEach((f, idx) => {
      this.playTone(f, f, 0.1, 'sine', 0.07, idx * 0.05);
    });
  }

  public playBonusTick(): void {
    this.playTone(987.77, 1318.51, 0.11, 'sine', 0.09);
  }

  public playWin(): void {
    const melody = [
      { f: 523.25, d: 0.14, t: 0 },
      { f: 659.25, d: 0.14, t: 0.11 },
      { f: 783.99, d: 0.14, t: 0.22 },
      { f: 1046.5, d: 0.36, t: 0.33 },
      { f: 783.99, d: 0.12, t: 0.5 },
      { f: 1046.5, d: 0.45, t: 0.62 },
    ];
    for (const n of melody) {
      this.playTone(n.f, n.f, n.d, 'triangle', 0.13, n.t);
      this.playTone(n.f * 0.5, n.f * 0.5, n.d, 'sine', 0.08, n.t);
    }
  }

  public playLose(): void {
    const notes = [440, 392, 349.23, 293.66];
    notes.forEach((f, idx) => {
      this.playTone(f, f * 0.96, 0.22, 'triangle', 0.1, idx * 0.15);
    });
  }
}
