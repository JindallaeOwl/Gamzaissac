import { describe, expect, it } from 'vitest';
import {
  buildChaser,
  buildDasher,
  buildShooter,
  buildSplitter,
  buildSplitterling,
  buildWormKing,
  buildWormKingFrame,
  PixelSprite,
  type EnemySpriteBuilder,
} from '../src/systems/enemyPixelSprites';

const BUILDERS: Record<string, EnemySpriteBuilder> = {
  chaser: buildChaser,
  shooter: buildShooter,
  dasher: buildDasher,
  splitter: buildSplitter,
  splitterling: buildSplitterling,
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
