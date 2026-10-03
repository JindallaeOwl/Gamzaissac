import { describe, expect, it } from 'vitest';
import {
  getGameSettings,
  getRenderScale,
  getRenderScaleForQuality,
  type GameSettings,
} from '../src/systems/GameSettings';
import { getSettingsPatch, preserveMenuSelection } from '../src/ui/SettingsMenu';

const settings: GameSettings = {
  soundEnabled: true,
  musicEnabled: true,
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

  it('maps every render quality to a distinct internal scale', () => {
    expect(getRenderScaleForQuality('low')).toBe(1);
    expect(getRenderScaleForQuality('balanced')).toBe(2);
    expect(getRenderScaleForQuality('high')).toBe(4);
  });

  it('toggles sound without changing unrelated settings', () => {
    expect(getSettingsPatch('sound', settings)).toEqual({ soundEnabled: false });
  });

  it('toggles music without changing master sound or effects volume', () => {
    expect(getSettingsPatch('music', settings)).toEqual({ musicEnabled: false });
    expect(getSettingsPatch('music', { ...settings, musicEnabled: false })).toEqual({
      musicEnabled: true,
    });
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

  it('keeps the selected setting after its displayed value is refreshed', () => {
    expect(preserveMenuSelection(3, 6)).toBe(3);
    expect(preserveMenuSelection(8, 6)).toBe(5);
  });
});
