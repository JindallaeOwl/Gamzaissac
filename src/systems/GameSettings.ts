export type RenderQuality = 'low' | 'balanced' | 'high';

export interface GameSettings {
  soundEnabled: boolean;
  effectsVolume: number;
  screenShake: number;
  renderQuality: RenderQuality;
}

const STORAGE_KEY = 'die-al-and-error-settings-v1';
const DEFAULT_SETTINGS: GameSettings = {
  soundEnabled: true,
  effectsVolume: 0.75,
  screenShake: 0.5,
  renderQuality: 'high',
};

const RENDER_SCALES: Record<RenderQuality, number> = {
  low: 1,
  balanced: 2,
  high: 4,
};

let settings = loadSettings();

export function getGameSettings(): Readonly<GameSettings> {
  return settings;
}

export function updateGameSettings(patch: Partial<GameSettings>): Readonly<GameSettings> {
  settings = sanitizeSettings({ ...settings, ...patch });
  saveSettings(settings);
  return settings;
}

export function getRenderScale(): number {
  return RENDER_SCALES[settings.renderQuality];
}

export function nextRenderQuality(current: RenderQuality): RenderQuality {
  if (current === 'low') {
    return 'balanced';
  }

  if (current === 'balanced') {
    return 'high';
  }

  return 'low';
}

export function nextScreenShake(current: number): number {
  if (current < 0.25) {
    return 0.5;
  }

  if (current < 0.75) {
    return 1;
  }

  return 0;
}

export function nextEffectsVolume(current: number): number {
  return current >= 1 ? 0 : Math.round((current + 0.25) * 100) / 100;
}

function loadSettings(): GameSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return { ...DEFAULT_SETTINGS };
    }

    return sanitizeSettings({ ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as object) });
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function sanitizeSettings(candidate: GameSettings): GameSettings {
  const renderQuality: RenderQuality = ['low', 'balanced', 'high'].includes(candidate.renderQuality)
    ? candidate.renderQuality
    : DEFAULT_SETTINGS.renderQuality;

  return {
    soundEnabled: Boolean(candidate.soundEnabled),
    effectsVolume: clamp(Number(candidate.effectsVolume), 0, 1),
    screenShake: clamp(Number(candidate.screenShake), 0, 1),
    renderQuality,
  };
}

function saveSettings(next: GameSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage can be unavailable in private or embedded browser contexts.
  }
}

function clamp(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
}
