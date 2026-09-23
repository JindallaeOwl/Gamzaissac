import { afterEach, describe, expect, it, vi } from 'vitest';
import { getGameSettings, updateGameSettings } from '../src/systems/GameSettings';
import { MusicKeys } from '../src/config/assets';
import { getRoomMusicKey, MusicSystem } from '../src/systems/MusicSystem';

function createMusicScene(activeKey?: string) {
  const previousSound = {
    isPlaying: true,
    isPaused: false,
    play: vi.fn(),
    stop: vi.fn(),
    destroy: vi.fn(),
  };
  const nextSound = {
    isPlaying: false,
    isPaused: false,
    play: vi.fn(),
    stop: vi.fn(),
    destroy: vi.fn(),
  };
  let registryState = activeKey ? { key: activeKey, sound: previousSound } : undefined;
  const registry = {
    get: vi.fn(() => registryState),
    set: vi.fn((_key: string, value: typeof registryState) => {
      registryState = value;
    }),
  };
  const scene = {
    sound: { pauseOnBlur: true, mute: false, add: vi.fn(() => nextSound) },
    events: { once: vi.fn() },
    cache: { audio: { exists: vi.fn(() => true) } },
    scene: { isActive: vi.fn(() => false) },
    game: { registry },
    tweens: { add: vi.fn(), killTweensOf: vi.fn() },
  };

  return { scene, nextSound, previousSound, registry };
}

describe('background music rules', () => {
  afterEach(() => {
    updateGameSettings({ soundEnabled: true, musicEnabled: true });
  });

  it('keeps music muted across room changes without disabling effects', () => {
    updateGameSettings({ musicEnabled: false });
    const { scene } = createMusicScene(MusicKeys.journey);
    const music = new MusicSystem(scene as never);
    music.play(MusicKeys.boss);
    expect(scene.sound.mute).toBe(true);
    expect(getGameSettings().soundEnabled).toBe(true);
    music.setEnabled(true);
    expect(scene.sound.mute).toBe(true);
    updateGameSettings({ musicEnabled: true });
    music.setEnabled(true);
    expect(scene.sound.mute).toBe(false);
    music.setEnabled(false);
    expect(scene.sound.mute).toBe(true);
  });

  it('uses dedicated music for shop and boss rooms', () => {
    expect(getRoomMusicKey('shop')).toBe(MusicKeys.shop);
    expect(getRoomMusicKey('boss')).toBe(MusicKeys.boss);
  });

  it('uses journey music for regular, start, and treasure rooms', () => {
    expect(getRoomMusicKey('start')).toBe(MusicKeys.journey);
    expect(getRoomMusicKey('combat')).toBe(MusicKeys.journey);
    expect(getRoomMusicKey('treasure')).toBe(MusicKeys.journey);
  });

  it('starts cached title music while TitleScene is still being created', () => {
    const { scene, nextSound } = createMusicScene();

    new MusicSystem(scene as never).play(MusicKeys.title);

    expect(scene.sound.add).toHaveBeenCalledWith(MusicKeys.title, { loop: true, volume: 0 });
    expect(nextSound.play).toHaveBeenCalledOnce();
  });

  it('replaces room music with title music when returning after game over', () => {
    const { scene, nextSound, previousSound, registry } = createMusicScene(MusicKeys.journey);

    new MusicSystem(scene as never).play(MusicKeys.title);

    expect(nextSound.play).toHaveBeenCalledOnce();
    expect(registry.set).toHaveBeenCalledWith(
      'active-background-music',
      expect.objectContaining({ key: MusicKeys.title }),
    );
    expect(scene.tweens.killTweensOf).toHaveBeenCalledWith(previousSound);
  });
});
