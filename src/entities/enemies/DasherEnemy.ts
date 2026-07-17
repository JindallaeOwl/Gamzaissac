import Phaser from 'phaser';
import type { Player } from '../Player';
import { BaseEnemy } from './BaseEnemy';

export class DasherEnemy extends BaseEnemy {
  private nextDashAt = 0;
  private dashEndsAt = 0;
  private windupEndsAt = 0;
  private pendingDashDirection = { x: 0, y: 0 };
  private telegraph?: Phaser.GameObjects.Graphics;
  private wanderAngle = Math.random() * Math.PI * 2;

  updateAI(time: number, player: Player): void {
    const body = this.body as Phaser.Physics.Arcade.Body;

    if (this.windupEndsAt > 0) {
      body.stop();

      if (time < this.windupEndsAt) {
        return;
      }

      this.windupEndsAt = 0;
      this.telegraph?.destroy();
      this.telegraph = undefined;
      const dashSpeed = this.definition.dashSpeed ?? 160;
      body.setVelocity(
        this.pendingDashDirection.x * dashSpeed,
        this.pendingDashDirection.y * dashSpeed,
      );
      this.dashEndsAt = time + (this.definition.dashDurationMs ?? 280);
      return;
    }

    if (time < this.dashEndsAt) {
      this.constrainToRoom();
      return;
    }

    if (time >= this.nextDashAt) {
      const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
      this.pendingDashDirection = { x: Math.cos(angle), y: Math.sin(angle) };
      this.windupEndsAt = time + 260;
      this.nextDashAt = time + (this.definition.dashCooldownMs ?? 1500);
      this.showDashTelegraph();
      return;
    }

    this.wanderAngle += Math.sin(time * 0.003 + this.x * 0.01) * 0.045;
    const speed = this.definition.wanderSpeed ?? this.definition.speed;
    body.setVelocity(Math.cos(this.wanderAngle) * speed, Math.sin(this.wanderAngle) * speed);
    this.constrainToRoom();
  }

  override destroy(fromScene?: boolean): void {
    this.telegraph?.destroy(fromScene);
    this.telegraph = undefined;
    super.destroy(fromScene);
  }

  private showDashTelegraph(): void {
    this.telegraph?.destroy();
    this.telegraph = this.scene.add.graphics().setDepth(this.depth - 1);
    this.telegraph.lineStyle(3, 0xb58cff, 0.72);
    this.telegraph.lineBetween(
      this.x,
      this.y,
      this.x + this.pendingDashDirection.x * 90,
      this.y + this.pendingDashDirection.y * 90,
    );
    this.telegraph.lineStyle(5, 0xb58cff, 0.12);
    this.telegraph.lineBetween(
      this.x,
      this.y,
      this.x + this.pendingDashDirection.x * 90,
      this.y + this.pendingDashDirection.y * 90,
    );
  }
}
