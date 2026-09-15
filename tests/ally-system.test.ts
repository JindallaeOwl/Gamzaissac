import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { ALLY_TUNING } from '../src/config/gameConfig';
import { AllySystem } from '../src/systems/AllySystem';
import { SeedlingAlly } from '../src/entities/SeedlingAlly';
import { Bullet } from '../src/entities/Bullet';

// 물리 엔진 대신 작은 입출력 대역을 써서 실제 시스템의 호출 순서와 상태 변화를 검사한다.
vi.mock('phaser', () => ({
  default: {
    Scenes: { Events: { SHUTDOWN: 'shutdown' } },
    Physics: {
      Arcade: {
        Sprite: class {
          active = true;
          scaleX = 1;
          displayOriginX = 24;
          displayOriginY = 24;
          body = {
            enable: true,
            velocity: { x: 0, y: 0 },
            setCircle: vi.fn(),
            setAllowGravity: vi.fn(),
            setVelocity: vi.fn(),
          };
          constructor(
            readonly scene: unknown,
            public x: number,
            public y: number,
          ) {}
          setDisplaySize(size: number) {
            this.scaleX = size / 48;
          }
          setDepth() {}
          setPosition(x: number, y: number) {
            this.x = x;
            this.y = y;
          }
          setAlpha() {}
          destroy() {
            this.active = false;
            this.body.enable = false;
          }
        },
      },
    },
  },
}));
vi.mock('../src/entities/Bullet', () => ({ Bullet: { spawn: vi.fn() } }));

class FakeGroup {
  children: Array<{ active: boolean; destroy?: () => void }> = [];
  add(child: { active: boolean; destroy?: () => void }) {
    this.children.push(child);
  }
  getChildren() {
    return this.children;
  }
  countActive() {
    return this.children.filter((child) => child.active).length;
  }
  clear = vi.fn(() => {
    this.children.forEach((child) => child.destroy?.());
    this.children = [];
  });
}

function fixture() {
  const allies = new FakeGroup();
  const enemies = new FakeGroup();
  const enemy = {
    x: 270,
    y: 136,
    active: true,
    body: { enable: true },
    contactDamage: 1,
    canDealContactDamage: vi.fn(),
  };
  enemies.add(enemy);
  const enemyBullets = new FakeGroup();
  const playerBullets = new FakeGroup();
  let ended = false;
  let damage = 4;
  const scene = {
    time: { now: 0 },
    add: { existing: vi.fn() },
    physics: {
      add: { existing: vi.fn(), group: vi.fn(() => allies), collider: vi.fn(), overlap: vi.fn() },
    },
    events: { once: vi.fn() },
  };
  const config = {
    scene,
    enemies,
    enemyBullets,
    playerBullets,
    player: { x: 240, y: 136, active: true },
    walls: {},
    obstacles: {},
    isRunEnded: () => ended,
    getEffectiveDamage: () => damage,
  };
  const system = new AllySystem(config as unknown as ConstructorParameters<typeof AllySystem>[0]);
  const getAllies = () => allies.getChildren() as SeedlingAlly[];
  const contact = (ally: SeedlingAlly) => scene.physics.add.overlap.mock.calls[0][2](ally, enemy);
  const shutdown = () => scene.events.once.mock.calls[0][1]();
  const setEnded = () => {
    ended = true;
  };
  const setDamage = (value: number) => {
    damage = value;
  };
  return {
    system,
    allies,
    enemies,
    enemy,
    enemyBullets,
    config,
    scene,
    contact,
    shutdown,
    getAllies,
    setEnded,
    setDamage,
  };
}

describe('ally system integration without Phaser runtime', () => {
  it('applies gentle roaming velocity using the supplied frame delta', () => {
    const f = fixture();
    f.system.summon();
    f.enemy.active = false;
    const first = f.getAllies()[0];
    f.system.update(1500, 16);
    const [x, y] = vi.mocked(first.body!.setVelocity).mock.calls[0];
    expect(x).toBeGreaterThan(0);
    expect(y).toBeLessThan(0);
    expect(Math.hypot(x, y)).toBeGreaterThan(0);
    expect(Math.hypot(x, y)).toBeLessThan(ALLY_TUNING.wanderSpeed);
  });
  it('keeps enemies separate, replaces old allies, and never exceeds two', () => {
    const f = fixture();
    expect(f.system.summon()).toBe(true);
    const first = [...f.getAllies()];
    for (let i = 0; i < 5; i += 1) {
      expect(f.system.summon()).toBe(true);
      expect(f.allies.countActive()).toBe(2);
      expect(f.enemies.getChildren()).toEqual([f.enemy]);
    }
    expect(first.every((ally) => !ally.active)).toBe(true);
    expect(f.scene.physics.add.collider.mock.calls).toEqual([
      [f.allies, f.config.walls],
      [f.allies, f.config.obstacles],
    ]);
  });
  it('refuses an empty room before destroying or spawning allies', () => {
    const f = fixture();
    f.system.summon();
    const previous = [...f.getAllies()];
    f.enemy.active = false;
    expect(f.system.summon()).toBe(false);
    expect(f.getAllies()).toEqual(previous);
  });
  it('uses independent contact immunity without consuming the enemy cooldown', () => {
    const f = fixture();
    f.system.summon();
    const [first, second] = f.getAllies();
    f.contact(first);
    f.contact(first);
    f.contact(second);
    expect(first.health).toBe(1);
    expect(second.health).toBe(1);
    expect(f.enemy.canDealContactDamage).not.toHaveBeenCalled();
    f.scene.time.now = 499;
    f.contact(first);
    expect(first.active).toBe(true);
    f.scene.time.now = 500;
    f.contact(first);
    expect(first.active).toBe(false);
    expect(second.active).toBe(true);
  });
  it('ignores disabled enemy bodies on contact', () => {
    const f = fixture();
    f.system.summon();
    f.enemy.body.enable = false;
    f.contact(f.getAllies()[0]);
    expect(f.getAllies()[0].health).toBe(2);
  });
  it('consumes one overlapping enemy bullet only once across both allies and later player checks', () => {
    const f = fixture();
    f.system.summon();
    const [first, second] = f.getAllies();
    second.setPosition(first.x, first.y);
    const bullet = {
      x: first.x,
      y: first.y,
      damage: 1,
      active: true,
      body: { enable: true, halfWidth: 4 },
      consume: vi.fn(() => {
        if (!bullet.active) return false;
        bullet.active = false;
        return true;
      }),
      queueDestroy: vi.fn(),
    };
    f.enemyBullets.add(bullet);
    f.system.update(0);
    expect(first.health).toBe(1);
    expect(second.health).toBe(2);
    expect(bullet.queueDestroy).toHaveBeenCalledOnce();
    expect(bullet.consume()).toBe(false);
  });
  it('fires player-owned straight seeds using current effective damage and cooldown', () => {
    vi.mocked(Bullet.spawn).mockClear();
    const f = fixture();
    f.system.summon();
    f.system.update(0);
    expect(Bullet.spawn).toHaveBeenCalledTimes(2);
    const shot = vi.mocked(Bullet.spawn).mock.calls[0][2];
    expect(shot).toMatchObject({
      owner: 'player',
      damage: 2,
      speed: 240,
      lifeMs: 700,
      direction: { x: 1, y: 0 },
    });
    expect(vi.mocked(Bullet.spawn).mock.calls[0][1]).toBe(f.config.playerBullets);
    f.system.update(699);
    expect(Bullet.spawn).toHaveBeenCalledTimes(2);
    f.setDamage(6);
    f.system.update(700);
    expect(Bullet.spawn).toHaveBeenCalledTimes(4);
    expect(vi.mocked(Bullet.spawn).mock.calls[2][2].damage).toBe(3);
  });
  it('halts update, contact damage and summoning after the run ends; shutdown empties the group', () => {
    vi.mocked(Bullet.spawn).mockClear();
    const f = fixture();
    f.system.summon();
    const first = f.getAllies()[0];
    f.setEnded();
    f.system.update(1000);
    f.contact(first);
    expect(Bullet.spawn).not.toHaveBeenCalled();
    expect(first.health).toBe(ALLY_TUNING.maxHealth);
    expect(f.system.summon()).toBe(false);
    f.shutdown();
    expect(f.allies.countActive()).toBe(0);
    expect(first.active).toBe(false);
    const nextRun = fixture();
    expect(nextRun.allies).not.toBe(f.allies);
    expect(nextRun.allies.countActive()).toBe(0);
  });
});

describe('ally scene wiring guards', () => {
  const source = (path: string) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
  it('updates allies before manual player collision checks and creates the system on each create', () => {
    const game = source('scenes/GameScene.ts');
    const update = game.slice(
      game.indexOf('  update(time:'),
      game.indexOf('  update(time:') + 5000,
    );
    expect(update.indexOf('this.allySystem.update(time, delta)')).toBeGreaterThan(0);
    expect(update.indexOf('this.allySystem.update(time, delta)')).toBeLessThan(
      update.indexOf('this.combatCollisions.update()'),
    );
    expect(game.slice(game.indexOf('  create():'), game.indexOf('  update(time:'))).toContain(
      'this.allySystem = new AllySystem(',
    );
  });
  it('clears allies for both room and floor transitions independently of includeRoomEntities', () => {
    const transition = source('systems/RoomTransitionSystem.ts');
    const clearing = transition.slice(
      transition.indexOf('  private clearTransientObjects('),
      transition.indexOf('  private savePendingRewardPositions('),
    );
    expect(clearing).toContain('this.allySystem.clear();');
    expect(clearing.indexOf('this.allySystem.clear();')).toBeLessThan(
      clearing.indexOf('if (includeRoomEntities)'),
    );
    expect(transition).toContain('this.clearTransientObjects(false);');
    expect(transition).toContain('this.clearTransientObjects(true);');
  });
});
