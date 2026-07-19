import { describe, expect, it } from 'vitest';
import {
  HUD_ICON_ASSETS,
  ITEM_IMAGE_ASSETS,
  PLAYER_DIRECTION_ROWS,
  PLAYER_IMAGE_ASSETS,
  PLAYER_SPRITESHEET_ASSETS,
  SHOP_NPC_IMAGE_ASSETS,
  TextureKeys,
} from '../src/config/assets';
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  PIXEL_ART_SIZES,
  PIXEL_GRID_SIZE,
} from '../src/config/gameConfig';
import { calculateFitViewport } from '../src/utils/render';
import { BOLD_PIXELS_FONT_FAMILY, gameFontStack } from '../src/i18n';
import { resolvePlayerFacing } from '../src/utils/playerFacing';

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

  it('registers the inventory, health, and stat HUD icons', () => {
    expect(HUD_ICON_ASSETS).toEqual([
      { key: TextureKeys.hudHeart, path: 'assets/icons/nikoichu/hud-heart.png' },
      { key: TextureKeys.hudKey, path: 'assets/icons/nikoichu/hud-key.png' },
      { key: TextureKeys.hudBomb, path: 'assets/icons/nikoichu/hud-bomb.png' },
      { key: TextureKeys.hudCoin, path: 'assets/icons/nikoichu/hud-coin.png' },
      {
        key: TextureKeys.hudStatMoveSpeed,
        path: 'assets/icons/nikoichu/hud-stat-move-speed.png',
      },
      {
        key: TextureKeys.hudStatFireRate,
        path: 'assets/icons/nikoichu/hud-stat-fire-rate.png',
      },
      {
        key: TextureKeys.hudStatDamage,
        path: 'assets/icons/nikoichu/hud-stat-damage.png',
      },
      {
        key: TextureKeys.hudStatRange,
        path: 'assets/icons/nikoichu/hud-stat-range.png',
      },
      {
        key: TextureKeys.hudStatProjectileSpeed,
        path: 'assets/icons/nikoichu/hud-stat-projectile-speed.png',
      },
      {
        key: TextureKeys.hudStatLuck,
        path: 'assets/icons/nikoichu/hud-stat-luck.png',
      },
    ]);
  });

  it('registers the original Red Mushroom item icon', () => {
    expect(ITEM_IMAGE_ASSETS).toEqual([
      {
        key: 'item-icon-red-mushroom',
        path: 'assets/items/red-mushroom.png',
      },
    ]);
  });

  it('registers the two 48-pixel potato merchant idle frames', () => {
    expect(SHOP_NPC_IMAGE_ASSETS).toEqual([
      {
        key: TextureKeys.shopNpcIdleA,
        path: 'assets/npcs/potato-merchant/idle-a.png',
      },
      {
        key: TextureKeys.shopNpcIdleB,
        path: 'assets/npcs/potato-merchant/idle-b.png',
      },
    ]);
  });

  it('registers the Yellow player as 32-pixel directional spritesheets', () => {
    expect(PLAYER_SPRITESHEET_ASSETS).toHaveLength(5);
    expect(
      PLAYER_SPRITESHEET_ASSETS.every(
        (asset) => asset.frameWidth === 32 && asset.frameHeight === 32,
      ),
    ).toBe(true);
    expect(PLAYER_IMAGE_ASSETS).toEqual([
      {
        key: TextureKeys.playerYellowShadow,
        path: 'assets/characters/snoblin-yellow/shadow/shadow_static.png',
      },
    ]);
    expect(PLAYER_DIRECTION_ROWS).toEqual({ down: 0, side: 1, up: 2 });
  });

  it('faces front while idle and maps movement directions correctly', () => {
    expect(resolvePlayerFacing(0, 0)).toEqual({ facing: 'down', flipX: false });
    expect(resolvePlayerFacing(0, -1)).toEqual({ facing: 'up', flipX: false });
    expect(resolvePlayerFacing(-1, 0)).toEqual({ facing: 'side', flipX: true });
    expect(resolvePlayerFacing(1, 0)).toEqual({ facing: 'side', flipX: false });
  });

  it('uses BoldPixels for Latin UI and keeps the Korean fallback fonts', () => {
    expect(gameFontStack()).toContain(`"${BOLD_PIXELS_FONT_FAMILY}"`);
    expect(gameFontStack()).toContain('Noto Sans KR');
    expect(gameFontStack()).toContain('Malgun Gothic');
  });

  it('fits the whole game inside a tall window without cropping', () => {
    expect(calculateFitViewport(960, 800)).toEqual({
      scale: 2,
      renderedWidth: 960,
      renderedHeight: 544,
      letterboxX: 0,
      letterboxY: 128,
    });
  });
});
