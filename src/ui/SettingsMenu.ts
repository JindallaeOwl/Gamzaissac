import { getLocale, t, toggleLocale } from '../i18n';
import {
  getGameSettings,
  nextEffectsVolume,
  nextRenderQuality,
  nextScreenShake,
  updateGameSettings,
  type GameSettings,
} from '../systems/GameSettings';

export type SettingsMenuAction =
  'language' | 'sound' | 'volume' | 'shake' | 'quality' | 'fullscreen' | 'back';

export interface SettingsMenuItem {
  label: string;
  action: SettingsMenuAction;
}

export interface SettingsMenuActionResult {
  command: 'refresh' | 'fullscreen' | 'back';
  settings?: Readonly<GameSettings>;
  showRestartHint?: boolean;
}

export function buildSettingsMenuItems(includeFullscreen = false): SettingsMenuItem[] {
  const settings = getGameSettings();
  const items: SettingsMenuItem[] = [
    {
      label: `${t('settings.language')}: ${t(getLocale() === 'ko' ? 'messages.localeKo' : 'messages.localeEn')}`,
      action: 'language',
    },
    {
      label: `${t('settings.sound')}: ${t(settings.soundEnabled ? 'settings.soundOn' : 'settings.soundOff')}`,
      action: 'sound',
    },
    {
      label: `${t('settings.volume')}: ${Math.round(settings.effectsVolume * 100)}%`,
      action: 'volume',
    },
    {
      label: `${t('settings.screenShake')}: ${Math.round(settings.screenShake * 100)}%`,
      action: 'shake',
    },
    {
      label: `${t('settings.renderQuality')}: ${t(`settings.${settings.renderQuality}`)}`,
      action: 'quality',
    },
  ];

  if (includeFullscreen) {
    items.push({ label: t('settings.fullscreen'), action: 'fullscreen' });
  }

  items.push({ label: t('menu.back'), action: 'back' });
  return items;
}

export function activateSettingsMenuAction(action: SettingsMenuAction): SettingsMenuActionResult {
  if (action === 'back') {
    return { command: 'back' };
  }

  if (action === 'fullscreen') {
    return { command: 'fullscreen' };
  }

  if (action === 'language') {
    toggleLocale();
    return { command: 'refresh' };
  }

  const currentSettings = getGameSettings();
  const patch = getSettingsPatch(action, currentSettings);

  return {
    command: 'refresh',
    settings: updateGameSettings(patch),
    showRestartHint: action === 'quality',
  };
}

export function getSettingsPatch(
  action: Exclude<SettingsMenuAction, 'language' | 'fullscreen' | 'back'>,
  settings: Readonly<GameSettings>,
): Partial<GameSettings> {
  if (action === 'sound') {
    return { soundEnabled: !settings.soundEnabled };
  }

  if (action === 'volume') {
    return { effectsVolume: nextEffectsVolume(settings.effectsVolume) };
  }

  if (action === 'shake') {
    return { screenShake: nextScreenShake(settings.screenShake) };
  }

  return { renderQuality: nextRenderQuality(settings.renderQuality) };
}

export function preserveMenuSelection(selectedIndex: number, itemCount: number): number {
  return Math.max(0, Math.min(selectedIndex, Math.max(0, itemCount - 1)));
}
