import { describe, expect, it } from 'vitest';
import {
  buildChaser,
  buildDasher,
  buildFlanker,
  buildPitchforkFarmer,
  buildShooter,
  buildSplitter,
  buildSplitterling,
  buildSummoner,
  buildWormKing,
  buildWormKingDigFrame,
  buildWormKingFrame,
  PixelSprite,
  WORM_KING_DIG_FRAME_COUNT,
  type EnemySpriteBuilder,
} from '../src/systems/enemyPixelSprites';

const BUILDERS: Record<string, EnemySpriteBuilder> = {
  chaser: buildChaser,
  shooter: buildShooter,
  dasher: buildDasher,
  flanker: buildFlanker,
  splitter: buildSplitter,
  splitterling: buildSplitterling,
  summoner: buildSummoner,
  wormKing: buildWormKing,
};

describe('enemy pixel sprites', () => {
  for (const [name, build] of Object.entries(BUILDERS)) {
    it(`${name} is perfectly left-right symmetric`, () => {
      const sprite = new PixelSprite();
      build(sprite);

      expect(sprite.isHorizontallySymmetric()).toBe(true);
    });

    it(`${name} actually draws something`, () => {
      const sprite = new PixelSprite();
      build(sprite);

      expect(sprite.filledCount()).toBeGreaterThan(20);
    });
  }
});

describe('worm king wriggle animation frames', () => {
  it('stays perfectly symmetric and non-empty across every animation phase', () => {
    for (const phase of [0, 0.25, 0.5, 0.75]) {
      const sprite = new PixelSprite();
      buildWormKingFrame(phase)(sprite);

      expect(sprite.isHorizontallySymmetric(), `phase ${phase}`).toBe(true);
      expect(sprite.filledCount(), `phase ${phase}`).toBeGreaterThan(20);
    }
  });

  it('exposes the static build as the first (phase 0) frame', () => {
    const frameSprite = new PixelSprite();
    buildWormKingFrame(0)(frameSprite);
    const staticSprite = new PixelSprite();
    buildWormKing(staticSprite);

    expect(staticSprite.filledCount()).toBe(frameSprite.filledCount());
  });
});

describe('pitchfork farmer sprite', () => {
  it('draws a detailed figure on the 32x32 grid', () => {
    const sprite = new PixelSprite(32);
    buildPitchforkFarmer(sprite);

    expect(sprite.filledCount()).toBeGreaterThan(80);
  });

  it('is intentionally asymmetric — the pitchfork sits on one side only', () => {
    const sprite = new PixelSprite(32);
    buildPitchforkFarmer(sprite);

    expect(sprite.isHorizontallySymmetric()).toBe(false);
  });
});

describe('worm king burrow (dig) frames', () => {
  it('stays symmetric across every dig step', () => {
    for (let step = 0; step < WORM_KING_DIG_FRAME_COUNT; step += 1) {
      const sprite = new PixelSprite();
      buildWormKingDigFrame(step)(sprite);

      expect(sprite.isHorizontallySymmetric(), `step ${step}`).toBe(true);
    }
  });

  it('starts as a full worm and burrows away by the last frame', () => {
    const first = new PixelSprite();
    buildWormKingDigFrame(0)(first);
    const last = new PixelSprite();
    buildWormKingDigFrame(WORM_KING_DIG_FRAME_COUNT - 1)(last);

    expect(first.filledCount()).toBeGreaterThan(20);
    expect(last.filledCount()).toBeLessThan(first.filledCount());
  });
});
