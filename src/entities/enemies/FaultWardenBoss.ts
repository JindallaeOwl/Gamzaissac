import Phaser from 'phaser';
import { BOSS_TUNING, ROOM_RECT } from '../../config/gameConfig';
import type { Player } from '../Player';
import { normalizeVector } from '../../utils/math';
import { BaseEnemy } from './BaseEnemy';

export class FaultWardenBoss extends BaseEnemy {
  private nextShotAt = 0;
  private nextDashAt = 0;
  private dashUntil = 0;
  private dashDirection = { x: 0, y: 0 };

  updateAI(time: number, player: Player, enemyBullets: Phaser.Physics.Arcade.Group): void {
    const body = this.body as Phaser.Physics.Arcade.Body | undefined;

    if (!this.active || !body) {
      return;
    }

    const enraged = this.getHealthRatio() <= 0.45;

    if (time < this.dashUntil) {
      body.setVelocity(
        this.dashDirection.x * BOSS_TUNING.dashSpeed,
        this.dashDirection.y * BOSS_TUNING.dashSpeed,
      );
      this.constrainToRoom();
      return;
    }

    const drift = normalizeVector(player.x - this.x, player.y - this.y);
    body.setVelocity(
      drift.x * this.definition.speed * 0.55,
      drift.y * this.definition.speed * 0.55,
    );

    if (time >= this.nextShotAt) {
      this.nextShotAt =
        time + (enraged ? BOSS_TUNING.enragedFireCooldownMs : BOSS_TUNING.fireCooldownMs);
      this.fireBurst(player, enemyBullets, enraged);
    }

    if (time >= this.nextDashAt) {
      this.nextDashAt =
        time + (enraged ? BOSS_TUNING.enragedDashCooldownMs : BOSS_TUNING.dashCooldownMs);
      this.dashUntil = time + BOSS_TUNING.dashDurationMs;
      this.dashDirection = normalizeVector(player.x - this.x, player.y - this.y);
    }

    this.constrainToRoom();
  }

  private fireBurst(
    player: Player,
    enemyBullets: Phaser.Physics.Arcade.Group,
    enraged: boolean,
  ): void {
    const baseAngle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
    const spread = enraged ? 0.72 : 0.48;
    const count = enraged ? BOSS_TUNING.burstCount + 2 : BOSS_TUNING.burstCount;

    for (let i = 0; i < count; i += 1) {
      const offset = count === 1 ? 0 : Phaser.Math.Linear(-spread, spread, i / (count - 1));
      const direction = {
        x: Math.cos(baseAngle + offset),
        y: Math.sin(baseAngle + offset),
      };

      this.fireDirection(enemyBullets, direction);
    }
  }

  private fireDirection(
    enemyBullets: Phaser.Physics.Arcade.Group,
    direction: { x: number; y: number },
  ): void {
    const x = Phaser.Math.Clamp(
      this.x + direction.x * 36,
      ROOM_RECT.left + 30,
      ROOM_RECT.right - 30,
    );
    const y = Phaser.Math.Clamp(
      this.y + direction.y * 36,
      ROOM_RECT.top + 30,
      ROOM_RECT.bottom - 30,
    );

    this.fireBullet(
      x,
      y,
      direction,
      enemyBullets,
      this.definition.bulletSpeed ?? BOSS_TUNING.bulletSpeed,
      this.definition.bulletDamage ?? BOSS_TUNING.bulletDamage,
    );
  }
}
