export type SoundId =
  | "button"
  | "spin"
  | "reel"
  | "land"
  | "hit"
  | "cascade"
  | "golden"
  | "feature"
  | "reveal"
  | "collect"
  | "tick"
  | "bonus"
  | "big"
  | "crowd"
  | "error";

type OscillatorKind = OscillatorType;

export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;
  private volume = 0.34;

  async unlock(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.context.destination);
    }

    if (this.context.state === "suspended") await this.context.resume();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.context && this.master) {
      this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.02);
    }
  }

  play(kind: SoundId): void {
    if (!this.enabled) return;

    this.unlock().then(() => {
      if (!this.context || !this.master) return;

      const map: Record<SoundId, () => void> = {
        button: () => this.tone(220, 0.05, "triangle", 0.04, 1.6),
        spin: () => {
          this.tone(110, 0.2, "sawtooth", 0.035, 2.4);
          this.noise(0.2, 0.025, "lowpass", 900);
        },
        reel: () => this.tone(180 + Math.random() * 90, 0.065, "square", 0.035, 1.22),
        land: () => this.tone(310 + Math.random() * 80, 0.055, "triangle", 0.024, 0.86),
        hit: () => {
          this.tone(420, 0.1, "triangle", 0.04, 1.4);
          this.tone(640, 0.08, "sine", 0.025, 1.18);
        },
        cascade: () => {
          this.noise(0.16, 0.04, "bandpass", 1400);
          this.tone(260, 0.08, "triangle", 0.032, 1.7);
        },
        golden: () => {
          this.tone(620, 0.08, "sine", 0.028, 1.18);
          this.tone(940, 0.07, "triangle", 0.022, 1.08, 0.035);
        },
        feature: () => {
          this.tone(380, 0.18, "sine", 0.04, 1.8);
          this.tone(720, 0.22, "triangle", 0.035, 1.25, 0.08);
        },
        reveal: () => {
          this.tone(840, 0.1, "sine", 0.035, 1.18);
          this.tone(1260, 0.09, "triangle", 0.02, 0.92, 0.04);
        },
        collect: () => {
          this.tone(520, 0.07, "triangle", 0.03, 1.35);
          this.tone(700, 0.07, "triangle", 0.026, 1.35, 0.05);
          this.tone(940, 0.09, "sine", 0.024, 1.1, 0.1);
        },
        tick: () => this.tone(900 + Math.random() * 180, 0.025, "sine", 0.012, 1.02),
        bonus: () => {
          this.tone(580, 0.16, "triangle", 0.04, 1.35);
          this.tone(760, 0.2, "triangle", 0.034, 1.28, 0.08);
          this.crowd(0.7, 0.04);
        },
        big: () => {
          this.tone(520, 0.24, "triangle", 0.045, 1.6);
          this.tone(780, 0.28, "sine", 0.04, 1.4, 0.09);
          this.tone(1040, 0.32, "sine", 0.035, 1.2, 0.18);
          this.crowd(1.05, 0.055);
        },
        crowd: () => this.crowd(0.55, 0.032),
        error: () => this.tone(130, 0.16, "sawtooth", 0.035, 0.62),
      };

      map[kind]();
    });
  }

  private tone(
    frequency: number,
    duration: number,
    type: OscillatorKind,
    level: number,
    slide = 1,
    delay = 0,
  ): void {
    if (!this.context || !this.master) return;

    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, frequency * slide), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(level, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  private noise(duration: number, level: number, filterType: BiquadFilterType, filterFrequency: number): void {
    if (!this.context || !this.master) return;

    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, Math.max(1, Math.floor(sampleRate * duration)), sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;

    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    filter.type = filterType;
    filter.frequency.value = filterFrequency;
    gain.gain.setValueAtTime(level, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.buffer = buffer;
    source.connect(filter).connect(gain).connect(this.master);
    source.start(now);
    source.stop(now + duration);
  }

  private crowd(duration: number, level: number): void {
    this.noise(duration, level, "bandpass", 520);
    this.noise(duration * 0.72, level * 0.72, "lowpass", 1200);
  }
}
