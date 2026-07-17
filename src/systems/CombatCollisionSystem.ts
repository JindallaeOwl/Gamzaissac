import Phaser from 'phaser';
import { COMBAT_TUNING, FEEDBACK_TUNING } from '../config/gameConfig';
import { BeamAttack } from '../entities/BeamAttack';
import { Bullet } from '../entities/Bullet';
import { Obstacle } from '../entities/Obstacle';
import type { Player } from '../entities/Player';
import { BaseEnemy } from '../entities/enemies/BaseEnemy';
import type { AudioSystem } from './AudioSystem';
import type { EffectsSystem } from './EffectsSystem';

interface CombatCollisionConfig {
  scene: Phaser.Scene;
  player: Player;
  enemies: Phaser.Physics.Arcade.Group;
  playerBullets: Phaser.Physics.Arcade.Group;
  enemyBullets: Phaser.Physics.Arcade.Group;
  beams: Phaser.Physics.Arcade.Group;
  walls: Phaser.Physics.Arcade.StaticGroup;
  obstacles: Phaser.Physics.Arcade.StaticGroup;
  effects: EffectsSystem;
  audio: AudioSystem;
  isGameOver: () => boolean;
  onPlayerDamaged: () => void;
}

export class CombatCollisionSystem {
  private readonly scene: Phaser.Scene;
  private readonly player: Player;
  private readonly enemies: Phaser.Physics.Arcade.Group;
  private readonly playerBullets: Phaser.Physics.Arcade.Group;
  private readonly enemyBullets: Phaser.Physics.Arcade.Group;
  private readonly beams: Phaser.Physics.Arcade.Group;
  private readonly walls: Phaser.Physics.Arcade.StaticGroup;
  private readonly obstacles: Phaser.Physics.Arcade.StaticGroup;
  private readonly effects: EffectsSystem;
  private readonly audio: AudioSystem;
  private readonly isGameOver: () => boolean;
  private readonly onPlayerDamaged: () => void;

  constructor(config: CombatCollisionConfig) {
    this.scene = config.scene;
    this.player = config.player;
    this.enemies = config.enemies;
    this.playerBullets = config.playerBullets;
    this.enemyBullets = config.enemyBullets;
    this.beams = config.beams;
    this.walls = config.walls;
    this.obstacles = config.obstacles;
    this.effects = config.effects;
    this.audio = config.audio;
    this.isGameOver = config.isGameOver;
    this.onPlayerDamaged = config.onPlayerDamaged;
  }

  register(): void {
    this.scene.physics.add.collider(this.player, this.walls);
    this.scene.physics.add.collider(this.enemies, this.walls);
    this.scene.physics.add.collider(this.player, this.obstacles);
    this.scene.physics.add.collider(this.enemies, this.obstacles);

    this.scene.physics.add.collider(this.playerBullets, this.walls, (bulletObject) => {
      this.consumeBulletAtSurface(bulletObject as Bullet, 0xc7fff4);
    });
    this.scene.physics.add.collider(this.enemyBullets, this.walls, (bulletObject) => {
      this.consumeBulletAtSurface(bulletObject as Bullet, 0xffb347);
    });
    this.scene.physics.add.collider(
      this.playerBullets,
      this.obstacles,
      (bulletObject, obstacleObject) => {
        this.handlePlayerBulletObstacle(bulletObject as Bullet, obstacleObject as Obstacle);
      },
    );
    this.scene.physics.add.collider(this.enemyBullets, this.obstacles, (bulletObject) => {
      this.consumeBulletAtSurface(bulletObject as Bullet, 0xffb347);
    });

    this.scene.physics.add.overlap(
      this.playerBullets,
      this.enemies,
      (bulletObject, enemyObject) => {
        this.handlePlayerBulletEnemy(bulletObject as Bullet, enemyObject as BaseEnemy);
      },
    );
    this.scene.physics.add.overlap(this.player, this.enemies, (_playerObject, enemyObject) => {
      this.handlePlayerEnemyContact(enemyObject as BaseEnemy);
    });
    this.scene.physics.add.overlap(this.beams, this.enemies, (beamObject, enemyObject) => {
      this.handleBeamEnemy(beamObject as BeamAttack, enemyObject as BaseEnemy);
    });
  }

  update(): void {
    if (!this.player.active || !this.player.body || this.isGameOver()) {
      return;
    }

    for (const bullet of this.enemyBullets.getChildren() as Bullet[]) {
      if (!bullet.active || !bullet.body) {
        continue;
      }

      if (!isWithinCollisionRadius(bullet, this.player, COMBAT_TUNING.enemyBulletHitRadius)) {
        continue;
      }

      const bulletX = bullet.x;
      const bulletY = bullet.y;

      if (!bullet.consume()) {
        continue;
      }

      const damaged = this.player.damage(bullet.damage, bulletX, bulletY);
      bullet.queueDestroy();

      if (damaged) {
        this.onPlayerDamaged();
      }
    }
  }

  private consumeBulletAtSurface(bullet: Bullet, color: number): void {
    const x = bullet.x;
    const y = bullet.y;

    if (!bullet.consume()) {
      return;
    }

    this.effects.impact(x, y, color);
    bullet.queueDestroy();
  }

  private handlePlayerBulletObstacle(bullet: Bullet, obstacle: Obstacle): void {
    const x = bullet.x;
    const y = bullet.y;

    if (!bullet.consume()) {
      return;
    }

    const destroyed = obstacle.takeDamage(bullet.damage);
    this.effects.impact(x, y, 0xc7fff4);

    if (destroyed) {
      this.effects.obstacleBreak(obstacle.x, obstacle.y);
      this.audio.play('hit');
    }

    bullet.queueDestroy();
  }

  private handlePlayerBulletEnemy(bullet: Bullet, enemy: BaseEnemy): void {
    if (
      !bullet.active ||
      !enemy.active ||
      !bullet.body ||
      !enemy.body ||
      bullet.hasHitTarget(enemy)
    ) {
      return;
    }

    const bulletX = bullet.x;
    const bulletY = bullet.y;
    const enemyX = enemy.x;
    const enemyY = enemy.y;

    bullet.markTargetHit(enemy);
    const { defeated, overflowDamage } = enemy.takeProjectileDamage(
      bullet.damage,
      bulletX,
      bulletY,
    );
    const continues = bullet.overflowPenetration && defeated && overflowDamage > 0;
    this.effects.impact(bulletX, bulletY, defeated ? 0xffd166 : 0xf7f3e8);

    if (continues) {
      bullet.retainOverflowDamage(overflowDamage);
    } else if (bullet.consume()) {
      bullet.queueDestroy();
    }

    this.handleEnemyDamageFeedback(enemy, enemyX, enemyY, defeated, 'bullet');
  }

  private handlePlayerEnemyContact(enemy: BaseEnemy): void {
    if (!enemy.active || !enemy.body || !enemy.canDealContactDamage(this.scene.time.now)) {
      return;
    }

    const damaged = this.player.damage(enemy.contactDamage, enemy.x, enemy.y);

    if (damaged) {
      this.onPlayerDamaged();
    }
  }

  private handleBeamEnemy(beam: BeamAttack, enemy: BaseEnemy): void {
    if (
      !beam.active ||
      !enemy.active ||
      !enemy.body ||
      !beam.canDamage(enemy, this.scene.time.now)
    ) {
      return;
    }

    const enemyX = enemy.x;
    const enemyY = enemy.y;
    const defeated = enemy.takeDamage(beam.damage, this.player.x, this.player.y);
    this.effects.beamImpact(enemyX, enemyY);
    this.handleEnemyDamageFeedback(enemy, enemyX, enemyY, defeated, 'beam');
  }

  private handleEnemyDamageFeedback(
    enemy: BaseEnemy,
    enemyX: number,
    enemyY: number,
    defeated: boolean,
    attackType: 'bullet' | 'beam',
  ): void {
    if (defeated) {
      this.effects.hitStop(FEEDBACK_TUNING.hitStop.enemyDeathMs);
      this.effects.shake('enemyDeath');
      this.effects.enemyDeath(enemyX, enemyY, enemy.scoreValue);
      this.audio.play('enemyDeath');
      return;
    }

    this.effects.hitStop(
      attackType === 'beam'
        ? FEEDBACK_TUNING.hitStop.beamHitMs
        : FEEDBACK_TUNING.hitStop.bulletHitMs,
    );
    this.effects.shake(attackType === 'beam' ? 'beamHit' : 'bulletHit');
    this.audio.play('hit');
  }
}

export function isWithinCollisionRadius(
  first: { x: number; y: number },
  second: { x: number; y: number },
  radius: number,
): boolean {
  const dx = first.x - second.x;
  const dy = first.y - second.y;
  return dx * dx + dy * dy <= radius * radius;
}
