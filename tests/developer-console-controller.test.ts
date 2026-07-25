import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Math: {
      Clamp: (value: number, min: number, max: number) => Math.min(Math.max(value, min), max),
    },
    Physics: {
      Arcade: {
        Sprite: class {},
      },
    },
    Scenes: {
      Events: {
        SHUTDOWN: 'shutdown',
      },
    },
  },
}));

import {
  DeveloperConsoleController,
  type DeveloperConsoleControllerConfig,
} from '../src/systems/DeveloperConsoleController';
import { DungeonManager } from '../src/systems/DungeonManager';
import { createInitialRunState } from '../src/systems/RunState';

function createController(enemies: unknown = { getChildren: () => [] }) {
  const runState = createInitialRunState();
  const dungeon = new DungeonManager(() => 0);
  dungeon.generateFloor(1);
  const player = {
    x: 240,
    y: 136,
    setGodMode: vi.fn(),
    setStats: vi.fn(),
  };
  const hud = { setAdminVisible: vi.fn() };
  const roomTransitions = {
    spawnPersistentReward: vi.fn(() => true),
    enterFloor: vi.fn(),
    enterRoomDirect: vi.fn(),
  };
  const effects = { pickup: vi.fn() };
  const config = {
    runState,
    dungeon,
    player,
    hud,
    roomTransitions,
    effects,
    enemies,
    items: { add: vi.fn() },
    shopSystem: { forceDiscount: vi.fn() },
    roomController: { refreshCurrentShop: vi.fn() },
    isRunEnded: () => false,
    isPauseTransitionStarted: () => false,
    resetFloorTransition: vi.fn(),
    onRoomChanged: vi.fn(),
    getShopProductName: vi.fn(() => 'product'),
  } as unknown as DeveloperConsoleControllerConfig;

  return {
    controller: new DeveloperConsoleController(config),
    runState,
    dungeon,
    player,
    hud,
    roomTransitions,
    effects,
  };
}

describe('DeveloperConsoleController', () => {
  it('keeps informational commands from marking the run as admin-used', () => {
    const { controller, runState, hud } = createController();

    expect(controller.execute('help').lines?.length).toBeGreaterThan(0);
    expect(controller.execute('items')).toEqual({ openItemPicker: true });
    expect(controller.execute('clear')).toEqual({ clear: true });
    expect(runState.adminUsed).toBe(false);
    expect(hud.setAdminVisible).not.toHaveBeenCalled();
  });

  it('applies gameplay commands and marks the run as admin-used', () => {
    const { controller, runState, hud, player } = createController();

    controller.execute('coin 5');
    expect(runState.inventory.coins).toBe(5);
    expect(runState.adminUsed).toBe(true);
    expect(hud.setAdminVisible).toHaveBeenCalledWith(true);

    expect(controller.execute('god')).toEqual({ lines: ['무적 모드: ON'] });
    expect(player.setGodMode).toHaveBeenCalledWith(true);
  });

  it('routes console coin spawns through the persistent room reward API', () => {
    const { controller, dungeon, roomTransitions, effects } = createController();
    const room = dungeon.getCurrentRoom();

    controller.execute('spawn coin');
    controller.execute('spawn five-coin');

    expect(roomTransitions.spawnPersistentReward).toHaveBeenNthCalledWith(
      1,
      room,
      expect.objectContaining({ kind: 'coins', amount: 1 }),
      196,
      136,
    );
    expect(roomTransitions.spawnPersistentReward).toHaveBeenNthCalledWith(
      2,
      room,
      expect.objectContaining({ kind: 'coins', amount: 5, appearance: 'five-coin' }),
      196,
      136,
    );
    expect(effects.pickup).toHaveBeenCalledTimes(2);
  });

  it('force-defeats even an invulnerable enemy and counts only real kills', () => {
    // 잠수 중인 지렁이 왕처럼 일반 피해를 무시하는(takeDamage=false) 적도
    // forceDefeat로는 반드시 죽고, 처치 수는 실제로 죽은 수만 센다.
    const makeEnemy = () => {
      const enemy = {
        active: true,
        takeDamage: vi.fn(() => false),
        forceDefeat: vi.fn(() => {
          if (!enemy.active) {
            return false;
          }

          enemy.active = false;
          return true;
        }),
      };

      return enemy;
    };

    const boss = makeEnemy();
    const grunt = makeEnemy();
    const { controller } = createController({ getChildren: () => [boss, grunt] });

    const result = controller.execute('kill');

    expect(boss.forceDefeat).toHaveBeenCalled();
    expect(grunt.forceDefeat).toHaveBeenCalled();
    expect(boss.takeDamage).not.toHaveBeenCalled();
    expect(boss.active).toBe(false);
    expect(result.lines?.[0]).toContain('2');
  });
});
