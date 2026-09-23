import type Phaser from 'phaser';
import { MusicKeys } from '../config/assets';
import type { RoomType } from '../data/rooms';
import { getGameSettings } from './GameSettings';

export type MusicKey = (typeof MusicKeys)[keyof typeof MusicKeys];

interface ActiveMusicState {
  key: MusicKey;
  sound: Phaser.Sound.BaseSound;
}

const MUSIC_STATE_REGISTRY_KEY = 'active-background-music';
const MUSIC_VOLUME = 0.5;
const MUSIC_FADE_IN_MS = 420;
const MUSIC_FADE_OUT_MS = 260;

export class MusicSystem {
  constructor(private readonly scene: Phaser.Scene) {
    this.scene.sound.pauseOnBlur = false;
    this.setEnabled(getGameSettings().soundEnabled);
  }

  play(key: MusicKey): void {
    const current = this.getActiveState();

    if (current?.key === key) {
      if (!current.sound.isPlaying && !current.sound.isPaused) {
        current.sound.play({ loop: true, volume: MUSIC_VOLUME });
      }

      return;
    }

    const nextSound = this.scene.sound.add(key, { loop: true, volume: 0 });
    nextSound.play();
    this.scene.game.registry.set(MUSIC_STATE_REGISTRY_KEY, {
      key,
      sound: nextSound,
    } satisfies ActiveMusicState);

    this.scene.tweens.add({
      targets: nextSound,
      volume: MUSIC_VOLUME,
      duration: MUSIC_FADE_IN_MS,
      ease: 'Sine.easeOut',
    });

    if (current) {
      this.scene.tweens.killTweensOf(current.sound);
      this.scene.tweens.add({
        targets: current.sound,
        volume: 0,
        duration: MUSIC_FADE_OUT_MS,
        ease: 'Sine.easeIn',
        onComplete: () => {
          current.sound.stop();
          current.sound.destroy();
        },
      });
    }
  }

  setEnabled(enabled: boolean): void {
    // Phaser carries BGM only; AudioSystem generates effects separately.
    this.scene.sound.mute = !enabled || !getGameSettings().musicEnabled;
  }

  private getActiveState(): ActiveMusicState | undefined {
    return this.scene.game.registry.get(MUSIC_STATE_REGISTRY_KEY) as ActiveMusicState | undefined;
  }
}

export function getRoomMusicKey(roomType: RoomType): MusicKey {
  if (roomType === 'shop') {
    return MusicKeys.shop;
  }

  if (roomType === 'boss') {
    return MusicKeys.boss;
  }

  return MusicKeys.journey;
}
