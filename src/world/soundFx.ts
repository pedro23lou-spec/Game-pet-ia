import type { TimeOfDay } from '../types/game';

interface ChordCycle {
  chords: number[][];
  melody: number[];
  stepMs: number;
}

const AMBIENT_CYCLES: Record<TimeOfDay, ChordCycle> = {
  day: {
    // Cheerful Cmaj7 -> Am7 -> Fmaj7 -> G6 with C major pentatonic marimba
    chords: [
      [261.63, 329.63, 392.0, 493.88],
      [220.0, 261.63, 329.63, 392.0],
      [174.61, 220.0, 261.63, 329.63],
      [196.0, 246.94, 293.66, 329.63],
    ],
    melody: [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5],
    stepMs: 560,
  },
  dusk: {
    // Warm sunset Dm7 -> G7sus4 -> Cmaj7 -> Am9
    chords: [
      [293.66, 349.23, 440.0, 523.25],
      [196.0, 261.63, 293.66, 349.23],
      [261.63, 329.63, 392.0, 493.88],
      [220.0, 261.63, 329.63, 493.88],
    ],
    melody: [440.0, 493.88, 523.25, 587.33, 659.25, 783.99],
    stepMs: 650,
  },
  night: {
    // Calm nocturnal Am7 -> Fmaj7 -> Dm7 -> Em7 with gentle lower piano/celesta
    chords: [
      [220.0, 261.63, 329.63, 392.0],
      [174.61, 220.0, 261.63, 329.63],
      [146.83, 174.61, 220.0, 261.63],
      [164.81, 196.0, 246.94, 293.66],
    ],
    melody: [392.0, 440.0, 493.88, 523.25, 659.25],
    stepMs: 780,
  },
};

class CozySoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private unlocked = false;
  private timeOfDay: TimeOfDay = 'day';
  private ambientGain: GainNode | null = null;
  private ambientFilter: BiquadFilterNode | null = null;
  private ambientTimerId: number | null = null;
  private stepIndex = 0;
  private lastNoteIdx = 1;

  public setTimeOfDay(tod: TimeOfDay): void {
    this.timeOfDay = tod;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.ambientGain) {
      const target = muted ? 0 : 0.42;
      this.ambientGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    }
    if (muted) {
      this.stopAmbientLoop();
    } else if (this.unlocked) {
      this.startAmbientLoop();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private ensureAudioGraph(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (!this.ambientGain || !this.ambientFilter) {
      this.ambientFilter = this.ctx.createBiquadFilter();
      this.ambientFilter.type = 'lowpass';
      this.ambientFilter.frequency.value = 1050;
      this.ambientFilter.Q.value = 0.7;

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = this.muted ? 0 : 0.42;

      this.ambientFilter.connect(this.ambientGain);
      this.ambientGain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  public unlock(): void {
    if (typeof window === 'undefined') return;
    this.unlocked = true;
    const ctx = this.ensureAudioGraph();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume().catch(() => {
        // Ignore resume restrictions before interaction
      });
    }
    if (!this.muted) {
      this.startAmbientLoop();
    }
  }

  private getContext(): AudioContext | null {
    if (this.muted || !this.unlocked || typeof window === 'undefined') return null;
    const ctx = this.ensureAudioGraph();
    if (!ctx) return null;
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {
        // Ignore resume errors
      });
    }
    return ctx;
  }

  private playAmbientPad(chord: number[], durationSec: number): void {
    const ctx = this.getContext();
    if (!ctx || !this.ambientFilter) return;

    const now = ctx.currentTime;
    const vol = this.timeOfDay === 'night' ? 0.016 : 0.02;

    for (const freq of chord) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.45);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

      osc.connect(gain);
      gain.connect(this.ambientFilter);

      osc.start(now);
      osc.stop(now + durationSec + 0.05);
    }
  }

  private playAmbientMarimba(freq: number, durationSec: number): void {
    const ctx = this.getContext();
    if (!ctx || !this.ambientFilter) return;

    const now = ctx.currentTime;
    const oscMain = ctx.createOscillator();
    const oscSoft = ctx.createOscillator();
    const gain = ctx.createGain();

    oscMain.type = 'sine';
    oscMain.frequency.setValueAtTime(freq, now);

    // Subtle marimba overtone an octave up for warm wooden bell shimmer
    oscSoft.type = 'triangle';
    oscSoft.frequency.setValueAtTime(freq * 2, now);

    const overtoneGain = ctx.createGain();
    overtoneGain.gain.setValueAtTime(0.18, now);

    const peakVol = this.timeOfDay === 'night' ? 0.024 : 0.032;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peakVol, now + 0.016);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    oscMain.connect(gain);
    oscSoft.connect(overtoneGain);
    overtoneGain.connect(gain);
    gain.connect(this.ambientFilter);

    oscMain.start(now);
    oscSoft.start(now);
    oscMain.stop(now + durationSec + 0.04);
    oscSoft.stop(now + durationSec + 0.04);
  }

  private scheduleAmbientStep = (): void => {
    this.ambientTimerId = null;
    if (
      this.muted ||
      !this.unlocked ||
      typeof document === 'undefined' ||
      document.visibilityState === 'hidden'
    ) {
      return;
    }

    const ctx = this.getContext();
    if (!ctx) return;

    if (ctx.state !== 'running') {
      this.ambientTimerId = window.setTimeout(this.scheduleAmbientStep, 500);
      return;
    }

    const cycle = AMBIENT_CYCLES[this.timeOfDay];
    const barBeat = this.stepIndex % 8;
    const chordIdx = Math.floor(this.stepIndex / 8) % cycle.chords.length;

    if (barBeat === 0) {
      const chordDur = (cycle.stepMs * 7.6) / 1000;
      this.playAmbientPad(cycle.chords[chordIdx], chordDur);
    }

    // Play delicate marimba/piano notes on soothing lo-fi beats with organic rests
    const activeBeats = this.timeOfDay === 'night' ? [0, 2, 5] : [0, 2, 3, 5, 6];
    if (activeBeats.includes(barBeat) && Math.random() < (this.timeOfDay === 'night' ? 0.72 : 0.85)) {
      const scale = cycle.melody;
      const stepMove = Math.floor(Math.random() * 3) - 1; // -1, 0, +1 for smooth stepwise melody
      const nextIdx = Math.max(0, Math.min(scale.length - 1, this.lastNoteIdx + stepMove));
      this.lastNoteIdx = nextIdx;
      const noteDur = this.timeOfDay === 'night' ? 1.15 : 0.75;
      this.playAmbientMarimba(scale[nextIdx], noteDur);
    }

    this.stepIndex = (this.stepIndex + 1) % (cycle.chords.length * 8);

    // Reschedule using current timeOfDay's tempo
    this.ambientTimerId = window.setTimeout(this.scheduleAmbientStep, cycle.stepMs);
  };

  public resumeIfUnlocked(): void {
    if (!this.unlocked || this.muted) return;
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {
        // Ignore resume errors
      });
    }
    this.startAmbientLoop();
  }

  private startAmbientLoop(): void {
    if (typeof window === 'undefined' || this.ambientTimerId !== null) return;
    const cycle = AMBIENT_CYCLES[this.timeOfDay];
    this.ambientTimerId = window.setTimeout(this.scheduleAmbientStep, Math.min(400, cycle.stepMs));
  }

  private stopAmbientLoop(): void {
    if (typeof window === 'undefined') return;
    if (this.ambientTimerId !== null) {
      window.clearTimeout(this.ambientTimerId);
      this.ambientTimerId = null;
    }
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
