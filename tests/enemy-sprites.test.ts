import { describe, expect, it } from 'vitest';
import {
  buildChaser,
  buildDasher,
  buildShooter,
  buildSplitter,
  buildSplitterling,
  PixelSprite,
  type EnemySpriteBuilder,
} from '../src/systems/enemyPixelSprites';

const BUILDERS: Record<string, EnemySpriteBuilder> = {
  chaser: buildChaser,
  shooter: buildShooter,
  dasher: buildDasher,
  splitter: buildSplitter,
  splitterling: buildSplitterling,
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
