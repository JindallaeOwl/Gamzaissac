import { describe, expect, it } from 'vitest';
import { ENEMY_DEFINITIONS, type EnemyId } from '../src/data/enemies';
import {
  BOSS_ROOM_TEMPLATES,
  COMBAT_ROOM_TEMPLATES,
  SHOP_ROOM_TEMPLATE,
  START_ROOM_TEMPLATE,
  TREASURE_ROOM_TEMPLATE,
} from '../src/data/rooms';

describe('splitter enemy data', () => {
  it('points at a child enemy that actually exists', () => {
    const splitter = ENEMY_DEFINITIONS.splitter;

    expect(splitter.splitChildId).toBe('splitterling');
    expect(splitter.splitChildCount ?? 0).toBeGreaterThan(0);
    expect(ENEMY_DEFINITIONS[splitter.splitChildId as EnemyId]).toBeDefined();
  });

  it('never lets the child split again, preventing an endless chain', () => {
    expect(ENEMY_DEFINITIONS.splitterling.splitChildId).toBeUndefined();
  });

  it('keeps both splitter forms as normal (non-boss) enemies', () => {
    expect(ENEMY_DEFINITIONS.splitter.kind).toBe('normal');
    expect(ENEMY_DEFINITIONS.splitterling.kind).toBe('normal');
  });

  it('makes the child smaller and faster than its parent', () => {
    expect(ENEMY_DEFINITIONS.splitterling.bodyRadius).toBeLessThan(
      ENEMY_DEFINITIONS.splitter.bodyRadius,
    );
    expect(ENEMY_DEFINITIONS.splitterling.speed).toBeGreaterThan(ENEMY_DEFINITIONS.splitter.speed);
  });
});

describe('room template enemy pools', () => {
  // 층 제한 적(분열형·플랭커·소환사)의 고정 배치는 이제 템플릿 minFloor가 막는다
  // (room-template-rules.test.ts). 여기서는 분열로만 태어나야 하는 새끼만 금지한다.
  it('keeps the split child out of every fixed spawn set', () => {
    const templates = [
      START_ROOM_TEMPLATE,
      SHOP_ROOM_TEMPLATE,
      TREASURE_ROOM_TEMPLATE,
      ...BOSS_ROOM_TEMPLATES,
      ...COMBAT_ROOM_TEMPLATES,
    ];
    const spawnedIds = templates.flatMap((template) =>
      template.spawnSets.flat().map((spawn) => spawn.enemyId),
    );

    expect(spawnedIds).not.toContain('splitterling');
  });
});
