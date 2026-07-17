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
  private dashWindupUntil = 0;
  private volleyAt = 0;
  private dashTelegraph?: Phaser.GameObjects.Graphics;
  private volleyTelegraph?: Phaser.GameObjects.Arc;

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

    if (this.dashWindupUntil > 0) {
      body.setVelocity(0, 0);

      if (time < this.dashWindupUntil) {
        return;
      }

      this.dashWindupUntil = 0;
      this.dashTelegraph?.destroy();
      this.dashTelegraph = undefined;
      this.dashUntil = time + BOSS_TUNING.dashDurationMs;
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

    if (this.volleyAt > 0) {
      this.volleyTelegraph?.setPosition(this.x, this.y);

      if (time >= this.volleyAt) {
        this.volleyAt = 0;
        this.volleyTelegraph?.destroy();
        this.volleyTelegraph = undefined;
        this.fireBurst(player, enemyBullets);
      }
    } else if (time >= this.nextShotAt) {
      this.nextShotAt = time + this.getFireCooldownMs();
      this.volleyAt = time + 180;
      this.volleyTelegraph = this.scene.add
        .circle(this.x, this.y, 24, 0xff7aee, 0.12)
        .setStrokeStyle(2, 0xffb6f4, 0.9)
        .setDepth(this.depth - 1);
    }

    if (time >= this.nextDashAt) {
      this.nextDashAt = time + this.getDashCooldownMs();
      this.dashDirection = normalizeVector(player.x - this.x, player.y - this.y);
      this.dashWindupUntil = time + 320;
      this.dashTelegraph?.destroy();
      this.dashTelegraph = this.scene.add.graphics().setDepth(this.depth - 1);
      this.dashTelegraph.lineStyle(4, 0xca72ff, 0.28);
      this.dashTelegraph.lineBetween(
        this.x,
        this.y,
        this.x + this.dashDirection.x * 110,
        this.y + this.dashDirection.y * 110,
      );
    }

    this.constrainToRoom();
  }

  override getDisplayName(): string {
    const displayName = super.getDisplayName();
    return this.isPhaseTwo ? `${displayName} II` : displayName;
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
    this.clearTelegraphs();
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
      this.x + direction.x * 30,
      ROOM_RECT.left + 26,
      ROOM_RECT.right - 26,
    );
    const y = Phaser.Math.Clamp(
      this.y + direction.y * 30,
      ROOM_RECT.top + 26,
      ROOM_RECT.bottom - 26,
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

  override destroy(fromScene?: boolean): void {
    this.clearTelegraphs();
    super.destroy(fromScene);
  }

  private clearTelegraphs(): void {
    this.dashWindupUntil = 0;
    this.volleyAt = 0;
    this.dashTelegraph?.destroy();
    this.volleyTelegraph?.destroy();
    this.dashTelegraph = undefined;
    this.volleyTelegraph = undefined;
  }
}
