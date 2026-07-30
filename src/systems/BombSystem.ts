import Phaser from 'phaser';
import { BOMB_TUNING } from '../config/gameConfig';
import { Bomb } from '../entities/Bomb';
import { Bullet } from '../entities/Bullet';
import { Obstacle } from '../entities/Obstacle';
import type { Player } from '../entities/Player';
import { ShopNpc } from '../entities/ShopNpc';
import { BaseEnemy } from '../entities/enemies/BaseEnemy';
import { normalizeVector } from '../utils/math';
import type { AudioSystem } from './AudioSystem';
import { isWithinBombRadius, resolveBombPlantAttempt, shouldDetonateBomb } from './BombRules';
import type { EffectsSystem } from './EffectsSystem';
import type { RunState } from './RunState';

interface BombSystemConfig {
  scene: Phaser.Scene;
  runState: RunState;
  player: Player;
  enemies: Phaser.Physics.Arcade.Group;
  enemyBullets: Phaser.Physics.Arcade.Group;
  obstacles: Phaser.Physics.Arcade.StaticGroup;
  shopNpcs: Phaser.GameObjects.Group;
  effects: EffectsSystem;
  audio: AudioSystem;
  isRunEnded: () => boolean;
  // 자기 폭발에 맞았을 때 공통 피격 피드백(점멸·화면 흔들림·효과음)으로 연결한다.
  onPlayerDamaged?: () => void;
  // 상인이 날아갔을 때. 방 상태에 기록해 다시 들어와도 상인이 없고 자국만 남게 한다.
  onShopNpcDestroyed?: (x: number, y: number, direction: { x: number; y: number }) => void;
}

export type BombPlantResult = 'planted' | 'no-bombs' | 'cooldown' | 'blocked';

export class BombSystem {
  private readonly scene: Phaser.Scene;
  private readonly runState: RunState;
  private readonly player: Player;
  private readonly enemies: Phaser.Physics.Arcade.Group;
  private readonly enemyBullets: Phaser.Physics.Arcade.Group;
  private readonly obstacles: Phaser.Physics.Arcade.StaticGroup;
  private readonly shopNpcs: Phaser.GameObjects.Group;
  private readonly effects: EffectsSystem;
  private readonly audio: AudioSystem;
  private readonly isRunEnded: () => boolean;
  private readonly onPlayerDamaged?: () => void;
  private readonly onShopNpcDestroyed?: (
    x: number,
    y: number,
    direction: { x: number; y: number },
  ) => void;
  private readonly plantedBombs: Phaser.GameObjects.Group;
  private nextBombAt = 0;

  constructor(config: BombSystemConfig) {
    this.scene = config.scene;
    this.runState = config.runState;
    this.player = config.player;
    this.enemies = config.enemies;
    this.enemyBullets = config.enemyBullets;
    this.obstacles = config.obstacles;
    this.shopNpcs = config.shopNpcs;
    this.effects = config.effects;
    this.audio = config.audio;
    this.isRunEnded = config.isRunEnded;
    this.onPlayerDamaged = config.onPlayerDamaged;
    this.onShopNpcDestroyed = config.onShopNpcDestroyed;
    this.plantedBombs = this.scene.add.group();
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.clear());
  }

  tryPlant(x: number, y: number): BombPlantResult {
    const decision = resolveBombPlantAttempt(
      this.runState,
      this.scene.time.now,
      this.nextBombAt,
      this.isRunEnded(),
    );

    if (decision.status !== 'planted') {
      return decision.status;
    }

    this.nextBombAt = decision.nextBombAt;
    const bomb = new Bomb(this.scene, x, y, (originX, originY) => {
      this.detonate(originX, originY);
    });
    this.plantedBombs.add(bomb);
    return 'planted';
  }

  clear(): void {
    this.plantedBombs.clear(true, true);
  }

  private detonate(originX: number, originY: number): void {
    if (!shouldDetonateBomb(this.isRunEnded())) {
      return;
    }

    const enemiesInRoom = [...(this.enemies.getChildren() as BaseEnemy[])];

    for (const enemy of enemiesInRoom) {
      if (!enemy.active || !enemy.body || !isWithinBombRadius(originX, originY, enemy.x, enemy.y)) {
        continue;
      }

      const enemyX = enemy.x;
      const enemyY = enemy.y;
      const defeated = enemy.takeDamage(BOMB_TUNING.damage, originX, originY);

      if (defeated) {
        this.effects.enemyDeath(enemyX, enemyY, enemy.scoreValue);
        this.audio.play('enemyDeath');
      }
    }

    const enemyBulletsInRoom = [...(this.enemyBullets.getChildren() as Bullet[])];

    for (const bullet of enemyBulletsInRoom) {
      if (!bullet.active || !isWithinBombRadius(originX, originY, bullet.x, bullet.y)) {
        continue;
      }

      if (bullet.consume()) {
        bullet.queueDestroy();
      }
    }

    const obstaclesInRoom = [...(this.obstacles.getChildren() as Obstacle[])];

    for (const obstacle of obstaclesInRoom) {
      if (!obstacle.active || !isWithinBombRadius(originX, originY, obstacle.x, obstacle.y)) {
        continue;
      }

      obstacle.destroyByBomb();
    }

    // 상점 상인은 전투 대상이 아니라 폭발에 날아가는 연출 전용이다. 물건을 사는 판정은
    // 상품과의 거리로 하므로, 상인이 사라져도 상점은 그대로 이용할 수 있다.
    const shopNpcsInRoom = [...(this.shopNpcs.getChildren() as ShopNpc[])];

    for (const npc of shopNpcsInRoom) {
      if (!npc.active || !isWithinBombRadius(originX, originY, npc.x, npc.y)) {
        continue;
      }

      // 폭발에서 상인 쪽으로 향하는 방향. 정확히 겹쳐 있으면 위로 날린다.
      const away = normalizeVector(npc.x - originX, npc.y - originY);
      const direction = away.x === 0 && away.y === 0 ? { x: 0, y: -1 } : away;

      this.effects.shopNpcBlast(npc.x, npc.y, direction);
      this.onShopNpcDestroyed?.(npc.x, npc.y, direction);
      npc.destroy();
    }

    // 플레이어 피해는 적·장애물 처리를 모두 끝낸 뒤 마지막에 판정한다. 자기 폭탄에
    // 죽으면 이 호출 안에서 'player-died'가 발생해 런이 종료되므로, 그 전에 폭발의
    // 나머지 결과가 모두 반영되게 한다.
    // 무적시간·갓모드·넉백·사망 판정은 Player.damage가 처리하고, 실제로 맞았을 때만
    // 공통 피격 피드백을 부른다(농부 보스의 근접 피해와 같은 방식).
    if (isWithinBombRadius(originX, originY, this.player.x, this.player.y)) {
      if (this.player.damage(BOMB_TUNING.selfDamage, originX, originY)) {
        this.onPlayerDamaged?.();
      }
    }

    this.effects.bombBlast(originX, originY);
    this.effects.shake('bombUse');
    this.scene.cameras.main.flash(140, 255, 176, 90, false);
    this.audio.play('bombUse');
  }
}
