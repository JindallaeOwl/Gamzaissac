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
  private isPhaseTwo = false;
  private phaseTransitionUntil = 0;
  private phaseTwoVolleyCount = 0;

  override takeDamage(amount: number, sourceX: number, sourceY: number): boolean {
    const defeated = super.takeDamage(amount, sourceX, sourceY);

    if (!defeated) {
      this.tryEnterPhaseTwo(this.scene.time.now);
    }

    return defeated;
  }

  updateAI(time: number, player: Player, enemyBullets: Phaser.Physics.Arcade.Group): void {
    const body = this.body as Phaser.Physics.Arcade.Body | undefined;

    if (!this.active || !body) {
      return;
    }

    if (time < this.phaseTransitionUntil) {
      body.setVelocity(0, 0);
      return;
    }

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
      this.nextShotAt = time + this.getFireCooldownMs();
      this.fireBurst(player, enemyBullets);
    }

    if (time >= this.nextDashAt) {
      this.nextDashAt = time + this.getDashCooldownMs();
      this.dashUntil = time + BOSS_TUNING.dashDurationMs;
      this.dashDirection = normalizeVector(player.x - this.x, player.y - this.y);
    }

    this.constrainToRoom();
  }

  override getDisplayName(): string {
    return this.isPhaseTwo ? `${this.definition.displayName} II` : this.definition.displayName;
  }

  isInPhaseTwo(): boolean {
    return this.isPhaseTwo;
  }

  private tryEnterPhaseTwo(time: number): void {
    if (
      this.isPhaseTwo ||
      !this.active ||
      !this.body ||
      this.getHealthRatio() > BOSS_TUNING.phaseTwoThreshold
    ) {
      return;
    }

    this.isPhaseTwo = true;
    this.phaseTransitionUntil = time + BOSS_TUNING.phaseTwoTransitionLockMs;
    this.nextShotAt = this.phaseTransitionUntil;
    this.nextDashAt = this.phaseTransitionUntil + 250;
    this.dashUntil = 0;
    this.setPersistentTint(BOSS_TUNING.phaseTwoTint);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.stop();
    this.emit('boss-phase-two', this);
  }

  private getFireCooldownMs(): number {
    return this.isPhaseTwo ? BOSS_TUNING.phaseTwoFireCooldownMs : BOSS_TUNING.fireCooldownMs;
  }

  private getDashCooldownMs(): number {
    return this.isPhaseTwo ? BOSS_TUNING.phaseTwoDashCooldownMs : BOSS_TUNING.dashCooldownMs;
  }

  private fireBurst(player: Player, enemyBullets: Phaser.Physics.Arcade.Group): void {
    const baseAngle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
    const spread = this.isPhaseTwo ? 0.78 : 0.48;
    const count = this.isPhaseTwo ? BOSS_TUNING.phaseTwoBurstCount : BOSS_TUNING.burstCount;

    for (let i = 0; i < count; i += 1) {
      const offset = count === 1 ? 0 : Phaser.Math.Linear(-spread, spread, i / (count - 1));
      const direction = {
        x: Math.cos(baseAngle + offset),
        y: Math.sin(baseAngle + offset),
      };

      this.fireDirection(enemyBullets, direction);
    }

    if (this.isPhaseTwo) {
      this.phaseTwoVolleyCount += 1;

      if (this.phaseTwoVolleyCount % 2 === 0) {
        this.fireRadial(enemyBullets);
      }
    }
  }

  private fireRadial(enemyBullets: Phaser.Physics.Arcade.Group): void {
    const angleOffset =
      this.phaseTwoVolleyCount % 4 === 0 ? Math.PI / BOSS_TUNING.phaseTwoRadialCount : 0;

    for (let i = 0; i < BOSS_TUNING.phaseTwoRadialCount; i += 1) {
      const angle = angleOffset + (Math.PI * 2 * i) / BOSS_TUNING.phaseTwoRadialCount;
      this.fireDirection(enemyBullets, {
        x: Math.cos(angle),
        y: Math.sin(angle),
      });
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
      this.isPhaseTwo ? BOSS_TUNING.phaseTwoBulletSpeed : BOSS_TUNING.bulletSpeed,
      this.definition.bulletDamage ?? BOSS_TUNING.bulletDamage,
    );
  }
}
