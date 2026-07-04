import Phaser from 'phaser';
import type { Player } from '../Player';
import { BaseEnemy } from './BaseEnemy';

export class DasherEnemy extends BaseEnemy {
  private nextDashAt = 0;
  private dashEndsAt = 0;
  private wanderAngle = Math.random() * Math.PI * 2;

  updateAI(time: number, player: Player): void {
    const body = this.body as Phaser.Physics.Arcade.Body;

    if (time < this.dashEndsAt) {
      this.constrainToRoom();
      return;
    }

    if (time >= this.nextDashAt) {
      const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
      const dashSpeed = this.definition.dashSpeed ?? 320;
      body.setVelocity(Math.cos(angle) * dashSpeed, Math.sin(angle) * dashSpeed);
      this.dashEndsAt = time + (this.definition.dashDurationMs ?? 280);
      this.nextDashAt = time + (this.definition.dashCooldownMs ?? 1500);
      return;
    }

    this.wanderAngle += Math.sin(time * 0.003 + this.x * 0.01) * 0.045;
    const speed = this.definition.wanderSpeed ?? this.definition.speed;
    body.setVelocity(Math.cos(this.wanderAngle) * speed, Math.sin(this.wanderAngle) * speed);
    this.constrainToRoom();
  }
}
