import { FEEDBACK_TUNING } from '../config/gameConfig';

import { getGameSettings } from './GameSettings';

export type SoundCue =
  | 'shoot'
  | 'hit'
  | 'enemyDeath'
  | 'playerHurt'
  | 'pickup'
  | 'synergy'
  | 'doorSlam'
  | 'roomClear'
  | 'bossPhaseTwo'
  | 'beamCharge'
  | 'beamFire'
  | 'bombUse';

const CUE_SETTINGS: Record<
  SoundCue,
  { frequency: number; durationMs: number; type: OscillatorType }
> = {
  shoot: { frequency: 540, durationMs: 42, type: 'square' },
  hit: { frequency: 170, durationMs: 55, type: 'triangle' },
  enemyDeath: { frequency: 92, durationMs: 130, type: 'sawtooth' },
  playerHurt: { frequency: 76, durationMs: 180, type: 'sawtooth' },
  pickup: { frequency: 720, durationMs: 90, type: 'sine' },
  // 줍기(720)보다 높고 길게 울려 "조합이 완성됐다"가 줍기 소리와 구별되게 한다
  synergy: { frequency: 880, durationMs: 230, type: 'triangle' },
  doorSlam: { frequency: 72, durationMs: 150, type: 'square' },
  roomClear: { frequency: 440, durationMs: 180, type: 'triangle' },
  bossPhaseTwo: { frequency: 64, durationMs: 260, type: 'sawtooth' },
  beamCharge: { frequency: 310, durationMs: 95, type: 'sine' },
  beamFire: { frequency: 120, durationMs: 220, type: 'sawtooth' },
  bombUse: { frequency: 58, durationMs: 300, type: 'square' },
};

// TitleScene and GameScene are recreated throughout a play session. Sharing
// one context prevents a new browser audio device from being allocated every
// time the player returns to the title.
let sharedContext: AudioContext | undefined;
let sharedContextUnlocked = false;

export class AudioSystem {
  unlock(): void {
    if (!FEEDBACK_TUNING.audio.enabled || !getGameSettings().soundEnabled) {
      return;
    }

    const context = this.getContext();

    if (!context) {
      return;
    }

    try {
      void context
        .resume()
        .then(() => {
          sharedContextUnlocked = context.state === 'running';
        })
        .catch(() => {
          sharedContextUnlocked = false;
        });
    } catch {
      sharedContextUnlocked = false;
    }
  }

  play(cue: SoundCue): void {
    const gameSettings = getGameSettings();

    if (!FEEDBACK_TUNING.audio.enabled || !gameSettings.soundEnabled) {
      return;
    }

    const context = this.getContext();

    if (!context || (!sharedContextUnlocked && context.state !== 'running')) {
      return;
    }

    sharedContextUnlocked = true;

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
      gain.gain.exponentialRampToValueAtTime(
        FEEDBACK_TUNING.audio.masterVolume * gameSettings.effectsVolume,
        now + 0.01,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + duration);
    } catch {
      // A single failed cue should not revoke the browser's audio permission.
    }
  }

  private getContext(): AudioContext | undefined {
    if (sharedContext && sharedContext.state !== 'closed') {
      return sharedContext;
    }

    sharedContext = undefined;
    sharedContextUnlocked = false;

    const windowWithWebkit = window as Window & {
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioCtor = window.AudioContext ?? windowWithWebkit.webkitAudioContext;

    if (!AudioCtor) {
      return undefined;
    }

    try {
      sharedContext = new AudioCtor();
      return sharedContext;
    } catch {
      return undefined;
    }
  }
}
