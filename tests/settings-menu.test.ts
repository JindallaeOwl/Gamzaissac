import { describe, expect, it } from 'vitest';
import { getGameSettings, getRenderScale, type GameSettings } from '../src/systems/GameSettings';
import { getSettingsPatch } from '../src/ui/SettingsMenu';

const settings: GameSettings = {
  soundEnabled: true,
  effectsVolume: 0.75,
  screenShake: 1,
  renderQuality: 'balanced',
};

describe('SettingsMenu rules', () => {
  it('starts new players at high render quality', () => {
    expect(getGameSettings().renderQuality).toBe('high');
    expect(getGameSettings().screenShake).toBe(0.5);
    expect(getRenderScale()).toBe(4);
  });

  it('toggles sound without changing unrelated settings', () => {
    expect(getSettingsPatch('sound', settings)).toEqual({ soundEnabled: false });
  });

  it('moves volume, screen shake, and render quality to their next values', () => {
    expect(getSettingsPatch('volume', settings)).toEqual({ effectsVolume: 1 });
    expect(getSettingsPatch('shake', settings)).toEqual({ screenShake: 0 });
    expect(getSettingsPatch('quality', settings)).toEqual({ renderQuality: 'high' });
  });

  it('wraps values after their final option', () => {
    expect(getSettingsPatch('volume', { ...settings, effectsVolume: 1 })).toEqual({
      effectsVolume: 0,
    });
    expect(getSettingsPatch('quality', { ...settings, renderQuality: 'high' })).toEqual({
      renderQuality: 'low',
    });
  });
});
