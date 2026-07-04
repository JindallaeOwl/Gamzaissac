import { FEEDBACK_TUNING } from '../config/gameConfig';

export type SoundCue =
  | 'shoot'
  | 'hit'
  | 'enemyDeath'
  | 'playerHurt'
  | 'pickup'
  | 'roomClear'
  | 'beamCharge'
  | 'beamFire';

const CUE_SETTINGS: Record<
  SoundCue,
  { frequency: number; durationMs: number; type: OscillatorType }
> = {
  shoot: { frequency: 540, durationMs: 42, type: 'square' },
  hit: { frequency: 170, durationMs: 55, type: 'triangle' },
  enemyDeath: { frequency: 92, durationMs: 130, type: 'sawtooth' },
  playerHurt: { frequency: 76, durationMs: 180, type: 'sawtooth' },
  pickup: { frequency: 720, durationMs: 90, type: 'sine' },
  roomClear: { frequency: 440, durationMs: 180, type: 'triangle' },
  beamCharge: { frequency: 310, durationMs: 95, type: 'sine' },
  beamFire: { frequency: 120, durationMs: 220, type: 'sawtooth' },
};

export class AudioSystem {
  private context?: AudioContext;
  private unlocked = false;

  unlock(): void {
    if (!FEEDBACK_TUNING.audio.enabled) {
      return;
    }

    const context = this.getContext();

    if (!context) {
      return;
    }

    try {
      void context.resume().then(() => {
        this.unlocked = true;
      });
    } catch {
      this.unlocked = false;
    }
  }

  play(cue: SoundCue): void {
    if (!FEEDBACK_TUNING.audio.enabled) {
      return;
    }

    const context = this.getContext();

    if (!context || !this.unlocked) {
      return;
    }

    try {
      const settings = CUE_SETTINGS[cue];
      const now = context.currentTime;
      const duration = settings.durationMs / 1000;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = settings.type;
      oscillator.frequency.setValueAtTime(settings.frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(40, settings.frequency * 0.55),
        now + duration,
      );

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(FEEDBACK_TUNING.audio.masterVolume, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + duration);
    } catch {
      this.unlocked = false;
    }
  }

  private getContext(): AudioContext | undefined {
    if (this.context) {
      return this.context;
    }

    const windowWithWebkit = window as Window & {
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioCtor = window.AudioContext ?? windowWithWebkit.webkitAudioContext;

    if (!AudioCtor) {
      return undefined;
    }

    try {
      this.context = new AudioCtor();
      return this.context;
    } catch {
      return undefined;
    }
  }
}
