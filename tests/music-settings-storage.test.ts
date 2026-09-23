import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it('loads old settings with music enabled and persists the independent music choice', async () => {
  let stored = JSON.stringify({ soundEnabled: true, effectsVolume: 0.25 });
  vi.stubGlobal('window', {
    localStorage: {
      getItem: () => stored,
      setItem: (_key: string, value: string) => {
        stored = value;
      },
    },
  });
  vi.resetModules();
  const settings = await import('../src/systems/GameSettings');
  expect(settings.getGameSettings().musicEnabled).toBe(true);
  settings.updateGameSettings({ musicEnabled: false });
  vi.resetModules();
  const reloaded = await import('../src/systems/GameSettings');
  expect(reloaded.getGameSettings()).toMatchObject({
    musicEnabled: false,
    soundEnabled: true,
    effectsVolume: 0.25,
  });
});
