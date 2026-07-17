import { describe, expect, it } from 'vitest';
import { HUD_ICON_ASSETS, TextureKeys } from '../src/config/assets';
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  PIXEL_ART_SIZES,
  PIXEL_GRID_SIZE,
} from '../src/config/gameConfig';
import { calculateCoverViewport } from '../src/utils/render';
import { BOLD_PIXELS_FONT_FAMILY, gameFontStack } from '../src/i18n';

describe('pixel art baseline', () => {
  it('uses the 480x272 logical canvas and a 16-pixel grid', () => {
    expect([GAME_WIDTH, GAME_HEIGHT]).toEqual([480, 272]);
    expect(GAME_WIDTH % PIXEL_GRID_SIZE).toBe(0);
    expect(GAME_HEIGHT % PIXEL_GRID_SIZE).toBe(0);
    expect([GAME_WIDTH / PIXEL_GRID_SIZE, GAME_HEIGHT / PIXEL_GRID_SIZE]).toEqual([30, 17]);
  });

  it('keeps the agreed asset sizes on the shared grid', () => {
    expect(PIXEL_ART_SIZES).toMatchObject({
      tile: 16,
      hudIcon: 16,
      collectible: 32,
      player: 32,
      normalEnemy: 32,
      largeEnemy: [48, 64],
      boss: [64, 96],
    });
  });

  it('registers the three 16-pixel inventory HUD icons', () => {
    expect(HUD_ICON_ASSETS).toEqual([
      { key: TextureKeys.hudKey, path: 'assets/icons/nikoichu/hud-key.png' },
      { key: TextureKeys.hudBomb, path: 'assets/icons/nikoichu/hud-bomb.png' },
      { key: TextureKeys.hudCoin, path: 'assets/icons/nikoichu/hud-coin.png' },
    ]);
  });

  it('uses BoldPixels for Latin UI and keeps the Korean fallback fonts', () => {
    expect(gameFontStack()).toContain(`"${BOLD_PIXELS_FONT_FAMILY}"`);
    expect(gameFontStack()).toContain('Noto Sans KR');
    expect(gameFontStack()).toContain('Malgun Gothic');
  });

  it('fills a 1920x1080 display at 4x with four pixels cropped at each vertical edge', () => {
    expect(calculateCoverViewport(1920, 1080)).toEqual({
      scale: 4,
      renderedWidth: 1920,
      renderedHeight: 1088,
      cropX: 0,
      cropY: 4,
    });
  });
});
