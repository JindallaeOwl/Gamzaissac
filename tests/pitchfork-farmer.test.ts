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

describe('pitchfork farmer boss definition', () => {
  const definition = ENEMY_DEFINITIONS.pitchforkFarmer;

  it('is a boss-kind enemy reusing a boss texture until it gets its own art', () => {
    expect(definition).toBeDefined();
    expect(definition.kind).toBe('boss');
    expect(definition.textureKey).toBe(TextureKeys.enemyBoss);
  });

  it('is the tankiest boss and deals standard half-heart damage', () => {
    expect(definition.contactDamage).toBe(PLAYER_DAMAGE_PER_HIT);
    expect(definition.bulletDamage).toBe(PLAYER_DAMAGE_PER_HIT);
    expect(definition.maxHealth).toBeGreaterThan(ENEMY_DEFINITIONS.rootKernel.maxHealth);
  });

  it('wires its own phase-two health bar and message', () => {
    expect(definition.bossBarColor).toBeTypeOf('number');
    expect(definition.bossPhaseTwoBarColor).toBeTypeOf('number');
    expect(definition.displayNameKey).toBe('bosses.pitchforkFarmer');
    expect(definition.phaseTwoMessageKey).toBe('messages.pitchforkFarmerPhaseTwo');
  });

  it('has a localized name and phase-two message in both languages', () => {
    expect(nested(ko, 'bosses', 'pitchforkFarmer')).toBeTypeOf('string');
    expect(nested(en, 'bosses', 'pitchforkFarmer')).toBeTypeOf('string');
    expect(nested(ko, 'messages', 'pitchforkFarmerPhaseTwo')).toBeTypeOf('string');
    expect(nested(en, 'messages', 'pitchforkFarmerPhaseTwo')).toBeTypeOf('string');
  });
});

describe('pitchfork farmer placement', () => {
  it('is the final boss: stage-4 II-floor (floor 8)', () => {
    const vinePassage = STAGES.find((stage) => stage.id === 'vine-passage');

    expect(vinePassage?.bossIds[1]).toBe('pitchforkFarmer');

    const progress = getStageProgress(8);
    expect(progress.bossId).toBe('pitchforkFarmer');
    expect(progress.stageNumber).toBe(4);
    expect(progress.floorInStage).toBe(2);
    expect(progress.isFinalFloor).toBe(true);
  });
});
