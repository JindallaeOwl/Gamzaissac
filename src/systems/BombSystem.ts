import Phaser from 'phaser';
import { BOMB_TUNING } from '../config/gameConfig';
import { Bomb } from '../entities/Bomb';
import { Bullet } from '../entities/Bullet';
import { Obstacle } from '../entities/Obstacle';
import type { Player } from '../entities/Player';
import { BaseEnemy } from '../entities/enemies/BaseEnemy';
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
  effects: EffectsSystem;
  audio: AudioSystem;
  isRunEnded: () => boolean;
  // 자기 폭발에 맞았을 때 공통 피격 피드백(점멸·화면 흔들림·효과음)으로 연결한다.
  onPlayerDamaged?: () => void;
}

export type BombPlantResult = 'planted' | 'no-bombs' | 'cooldown' | 'blocked';

export class BombSystem {
  private readonly scene: Phaser.Scene;
  private readonly runState: RunState;
  private readonly player: Player;
  private readonly enemies: Phaser.Physics.Arcade.Group;
  private readonly enemyBullets: Phaser.Physics.Arcade.Group;
  private readonly obstacles: Phaser.Physics.Arcade.StaticGroup;
  private readonly effects: EffectsSystem;
  private readonly audio: AudioSystem;
  private readonly isRunEnded: () => boolean;
  private readonly onPlayerDamaged?: () => void;
  private readonly plantedBombs: Phaser.GameObjects.Group;
  private nextBombAt = 0;

  constructor(config: BombSystemConfig) {
    this.scene = config.scene;
    this.runState = config.runState;
    this.player = config.player;
    this.enemies = config.enemies;
    this.enemyBullets = config.enemyBullets;
    this.obstacles = config.obstacles;
    this.effects = config.effects;
    this.audio = config.audio;
    this.isRunEnded = config.isRunEnded;
    this.onPlayerDamaged = config.onPlayerDamaged;
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
