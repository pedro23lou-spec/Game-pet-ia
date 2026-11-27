class CozySoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private unlocked = false;

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public unlock(): void {
    if (typeof window === 'undefined') return;
    this.unlocked = true;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {
        // Ignore resume restrictions before interaction
      });
    }
  }

  private getContext(): AudioContext | null {
    if (this.muted || !this.unlocked || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {
        // Ignore resume errors
      });
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume = 0.08,
    delay = 0,
    slideToFreq?: number
  ): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(40, freq), now);
    if (slideToFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideToFreq), now + duration);
    }

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.002, volume), now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.025);
  }

  /** Animal Crossing-inspired melodic voice blips */
  public playPetVoice(mood: 'happy' | 'grumpy' | 'thought' = 'happy', count = 3): void {
    const ctx = this.getContext();
    if (!ctx) return;

    if (mood === 'grumpy') {
      const notes = [210, 185, 165];
      const steps = Math.min(3, Math.max(2, count));
      for (let i = 0; i < steps; i++) {
        const base = notes[i % notes.length] + (Math.random() * 14 - 7);
        this.playTone(base, 0.055, 'triangle', 0.055, i * 0.075, base * 0.88);
      }
      return;
    }

    if (mood === 'thought') {
      const softNotes = [523.25, 587.33, 659.25];
      const steps = Math.min(2, Math.max(1, count));
      for (let i = 0; i < steps; i++) {
        const f = softNotes[Math.floor(Math.random() * softNotes.length)];
        this.playTone(f, 0.06, 'sine', 0.032, i * 0.085, f * 1.06);
      }
      return;
    }

    // Happy / expressive pentatonic blips
    const happyScale = [523.25, 587.33, 659.25, 783.99, 880];
    const steps = Math.min(5, Math.max(2, count));
    for (let i = 0; i < steps; i++) {
      const f = happyScale[Math.floor(Math.random() * happyScale.length)];
      const pitchShift = 1 + (Math.random() * 0.08 - 0.04);
      this.playTone(f * pitchShift, 0.058, 'triangle', 0.048, i * 0.068, f * 1.12);
    }
  }

  /** Soft purr + warm chime when petting */
  public playPetPurr(): void {
    this.playTone(138, 0.24, 'triangle', 0.05, 0, 156);
    this.playTone(207, 0.22, 'sine', 0.035, 0.03, 224);
    this.playTone(659.25, 0.11, 'sine', 0.045, 0.05, 880);
  }

  /** Cheerful 3-note chime when praising / giving attention */
  public playCheer(): void {
    this.playTone(523.25, 0.09, 'triangle', 0.065, 0);
    this.playTone(659.25, 0.09, 'triangle', 0.065, 0.07);
    this.playTone(783.99, 0.14, 'sine', 0.07, 0.14, 987.77);
  }

  public playPlace(): void {
    this.playTone(340, 0.11, 'triangle', 0.09, 0, 520);
  }

  public playRemove(): void {
    this.playTone(380, 0.12, 'triangle', 0.07, 0, 210);
  }

  public playRefill(): void {
    this.playTone(523.25, 0.12, 'sine', 0.07, 0);
    this.playTone(659.25, 0.14, 'sine', 0.07, 0.07);
    this.playTone(783.99, 0.18, 'sine', 0.07, 0.14);
  }

  /** Cozy munch/chew blips */
  public playEat(): void {
    this.playTone(290, 0.065, 'triangle', 0.065, 0, 420);
    this.playTone(340, 0.065, 'triangle', 0.065, 0.1, 480);
    this.playTone(310, 0.075, 'sine', 0.06, 0.2, 520);
  }

  public playArtworkReady(): void {
    this.playTone(523.25, 0.16, 'triangle', 0.08, 0);
    this.playTone(659.25, 0.16, 'triangle', 0.08, 0.1);
    this.playTone(783.99, 0.18, 'triangle', 0.08, 0.2);
    this.playTone(1046.5, 0.34, 'sine', 0.09, 0.3);
  }

  public playDiscovery(): void {
    this.playTone(587.33, 0.12, 'sine', 0.07, 0);
    this.playTone(880, 0.22, 'triangle', 0.08, 0.09);
  }

  /** Funny dramatic alert when caught peeking in diary or sus PC */
  public playCaught(): void {
    this.playTone(620, 0.09, 'sawtooth', 0.055, 0, 320);
    this.playTone(460, 0.1, 'sawtooth', 0.055, 0.09, 240);
    this.playTone(330, 0.19, 'triangle', 0.07, 0.19, 175);
  }

  public playChatReply(): void {
    this.playPetVoice('happy', 4);
  }

  public playCoin(): void {
    this.playTone(987.77, 0.08, 'triangle', 0.07, 0);
    this.playTone(1318.51, 0.15, 'triangle', 0.08, 0.065, 1567.98);
  }

  /** Refreshing water splash drops */
  public playWater(): void {
    this.playTone(460, 0.09, 'sine', 0.06, 0, 820);
    this.playTone(620, 0.11, 'sine', 0.055, 0.07, 1080);
    this.playTone(520, 0.08, 'sine', 0.045, 0.15, 760);
  }

  public playKick(): void {
    this.playTone(175, 0.095, 'triangle', 0.11, 0, 68);
  }

  /** Crisp goalkeeper save deflection */
  public playSave(): void {
    this.playTone(280, 0.07, 'triangle', 0.075, 0, 520);
    this.playTone(640, 0.11, 'sine', 0.06, 0.05, 480);
  }

  /** Upbeat goal fanfare */
  public playGoal(): void {
    this.playTone(523.25, 0.09, 'triangle', 0.075, 0);
    this.playTone(659.25, 0.09, 'triangle', 0.075, 0.075);
    this.playTone(783.99, 0.16, 'triangle', 0.08, 0.15);
  }

  public playStartle(): void {
    this.playCaught();
  }
}

export const soundFx = new CozySoundEngine();
