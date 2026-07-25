import { describe, expect, it } from 'vitest';
import { TextureKeys } from '../src/config/assets';
import { PLAYER_DAMAGE_PER_HIT } from '../src/config/gameConfig';
import { ENEMY_DEFINITIONS } from '../src/data/enemies';
import { getStageProgress, STAGES } from '../src/data/stages';
import { ko } from '../src/i18n/ko';
import { en } from '../src/i18n/en';
import type { TranslationTree } from '../src/i18n/types';

function nested(tree: TranslationTree, group: string, key: string): unknown {
  const branch = tree[group];
  return typeof branch === 'object' ? (branch as Record<string, unknown>)[key] : undefined;
}

describe('worm king boss definition', () => {
  const definition = ENEMY_DEFINITIONS.wormKing;

  it('is a boss-kind enemy reusing the split texture until it gets its own art', () => {
    expect(definition).toBeDefined();
    expect(definition.kind).toBe('boss');
    expect(definition.textureKey).toBe(TextureKeys.enemySplitter);
    expect(definition.displayScale ?? 1).toBeGreaterThan(1);
  });

  it('deals the standard half-heart contact and bullet damage', () => {
    expect(definition.contactDamage).toBe(PLAYER_DAMAGE_PER_HIT);
    expect(definition.bulletDamage).toBe(PLAYER_DAMAGE_PER_HIT);
  });

  it('wires its own phase-two health bar and message', () => {
    expect(definition.bossBarColor).toBeTypeOf('number');
    expect(definition.bossPhaseTwoBarColor).toBeTypeOf('number');
    expect(definition.displayNameKey).toBe('bosses.wormKing');
    expect(definition.phaseTwoMessageKey).toBe('messages.wormKingPhaseTwo');
  });

  it('has a localized name and phase-two message in both languages', () => {
    expect(nested(ko, 'bosses', 'wormKing')).toBeTypeOf('string');
    expect(nested(en, 'bosses', 'wormKing')).toBeTypeOf('string');
    expect(nested(ko, 'messages', 'wormKingPhaseTwo')).toBeTypeOf('string');
    expect(nested(en, 'messages', 'wormKingPhaseTwo')).toBeTypeOf('string');
  });
});

describe('worm king placement', () => {
  it('is the stage-2 II-floor boss (floor 4), not the final boss', () => {
    const wormDen = STAGES.find((stage) => stage.id === 'worm-den');

    expect(wormDen?.bossIds[1]).toBe('wormKing');

    const progress = getStageProgress(4);
    expect(progress.bossId).toBe('wormKing');
    expect(progress.stageNumber).toBe(2);
    expect(progress.floorInStage).toBe(2);
    expect(progress.isFinalFloor).toBe(false);
  });
});
