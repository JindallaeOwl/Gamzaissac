import Phaser from 'phaser';
import { ALLY_TUNING, ROOM_RECT } from '../config/gameConfig';
import { Bullet } from '../entities/Bullet';
import type { Player } from '../entities/Player';
import { SeedlingAlly } from '../entities/SeedlingAlly';
import type { BaseEnemy } from '../entities/enemies/BaseEnemy';
import {
  allyDistance,
  canAllyFire,
  canSummonAllies,
  clampAllyToRoom,
  getAllyDamage,
  getAllyEngageVelocity,
  getAllyFollowMotion,
  getAllySpawnPositions,
  resolveAllyMode,
  selectAllyTarget,
  smoothAllyVelocity,
} from './AllyRules';

interface AllySystemConfig {
  scene: Phaser.Scene;
  player: Player;
  enemies: Phaser.Physics.Arcade.Group;
  enemyBullets: Phaser.Physics.Arcade.Group;
  playerBullets: Phaser.Physics.Arcade.Group;
  walls: Phaser.Physics.Arcade.StaticGroup;
  obstacles: Phaser.Physics.Arcade.StaticGroup;
  getEffectiveDamage: () => number;
  isRunEnded: () => boolean;
}

export class AllySystem {
  private readonly allies: Phaser.Physics.Arcade.Group;

  constructor(private readonly config: AllySystemConfig) {
    const { scene, walls, obstacles, enemies } = config;
    // 적 그룹과 분리해야 방 클리어·폭탄·보스 HUD에서 동료를 적으로 세지 않는다.
    this.allies = scene.physics.add.group({ allowGravity: false });
    scene.physics.add.collider(this.allies, walls);
    scene.physics.add.collider(this.allies, obstacles);
    scene.physics.add.overlap(this.allies, enemies, (allyObject, enemyObject) => {
      const ally = allyObject as SeedlingAlly;
      const enemy = enemyObject as BaseEnemy;
      if (config.isRunEnded() || !enemy.active || !enemy.body?.enable) return;
      // 적의 접촉 쿨다운을 소비하면 플레이어에게 공짜 무적이 생기므로 동료 시각만 쓴다.
      ally.takeDamage(enemy.contactDamage, scene.time.now, ALLY_TUNING.contactInvulnMs);
    });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.clear());
  }

  summon(): boolean {
    const { scene, player, enemies } = this.config;
    if (this.config.isRunEnded() || !canSummonAllies(enemies.countActive(true))) return false;
    this.clear();
    const positions = getAllySpawnPositions(
      player,
      ROOM_RECT,
      ALLY_TUNING.bodyRadius + ALLY_TUNING.roomPadding,
      ALLY_TUNING.followOffset,
    );
    for (const [index, position] of positions.slice(0, ALLY_TUNING.maxAllies).entries()) {
      this.allies.add(
        new SeedlingAlly(
          scene,
          position.x,
          position.y,
          index === 0 ? -1 : 1,
          ALLY_TUNING.maxHealth,
          ALLY_TUNING.displaySize,
          ALLY_TUNING.bodyRadius,
        ),
      );
    }
    return true;
  }

  update(time: number, deltaMs = 0): void {
    const { player, enemies, scene, playerBullets } = this.config;
    if (this.config.isRunEnded() || !player.active) return;
    const tuning = ALLY_TUNING;
    const margin = tuning.bodyRadius + tuning.roomPadding;
    const candidates = enemies.getChildren() as BaseEnemy[];
    for (const ally of this.allies.getChildren() as SeedlingAlly[]) {
      if (!ally.active || !ally.body?.enable) continue;
      const position = clampAllyToRoom(ally, ROOM_RECT, margin);
      ally.setPosition(position.x, position.y);
      ally.target = selectAllyTarget(
        ally,
        ally.target,
        candidates,
        tuning.detectionRange,
        tuning.disengageMargin,
      );
      const distance = ally.target ? allyDistance(ally, ally.target) : null;
      ally.mode = resolveAllyMode(
        ally.mode,
        distance,
        tuning.detectionRange,
        tuning.disengageMargin,
      );
      const velocity =
        ally.mode === 'engage' && ally.target
          ? getAllyEngageVelocity(
              ally,
              ally.target,
              tuning.moveSpeed,
              tuning.preferredMinDistance,
              tuning.preferredMaxDistance,
              ally.side,
            )
          : getAllyFollowMotion(ally, player, ally.side, time, ROOM_RECT, margin, tuning);
      const body = ally.body as Phaser.Physics.Arcade.Body;
      const smoothed = smoothAllyVelocity(
        body.velocity,
        velocity,
        deltaMs,
        tuning.motionResponseMs,
      );
      body.setVelocity(smoothed.x, smoothed.y);
      ally.setAlpha(time < ally.invulnerableUntil ? 0.55 : 1);
      if (
        ally.target &&
        distance !== null &&
        canAllyFire(time, ally.nextFireAt, distance, tuning.attackRange)
      ) {
        const direction =
          distance === 0
            ? { x: ally.side, y: 0 }
            : { x: (ally.target.x - ally.x) / distance, y: (ally.target.y - ally.y) / distance };
        Bullet.spawn(scene, playerBullets, {
          x: ally.x,
          y: ally.y,
          direction,
          owner: 'player',
          damage: getAllyDamage(
            this.config.getEffectiveDamage(),
            tuning.damageMultiplier,
            tuning.damageFloor,
          ),
          speed: tuning.seedSpeed,
          lifeMs: tuning.seedLifeMs,
        });
        ally.nextFireAt = time + tuning.fireIntervalMs;
      }
    }
    this.hitAlliesWithBullets(time);
  }

  clear(): void {
    this.allies.clear(true, true);
  }

  private hitAlliesWithBullets(time: number): void {
    for (const bullet of this.config.enemyBullets.getChildren() as Bullet[]) {
      if (!bullet.active || !bullet.body?.enable) continue;
      for (const ally of this.allies.getChildren() as SeedlingAlly[]) {
        if (!ally.active || !ally.body?.enable) continue;
        const radius = ALLY_TUNING.bodyRadius + bullet.body.halfWidth;
        if (allyDistance(bullet, ally) > radius || !bullet.consume()) continue;
        ally.takeDamage(bullet.damage, time, ALLY_TUNING.contactInvulnMs);
        bullet.queueDestroy();
        // 먼저 소비한 탄은 뒤의 플레이어 판정에서 다시 맞지 않는다.
        break;
      }
    }
  }
}
