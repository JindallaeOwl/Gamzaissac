import Phaser from 'phaser';
import type { Player } from '../Player';
import { BaseEnemy } from './BaseEnemy';

export class ShooterEnemy extends BaseEnemy {
  private nextShotAt = 0;

  updateAI(time: number, player: Player, enemyBullets: Phaser.Physics.Arcade.Group): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const keepAwayDistance = this.definition.keepAwayDistance ?? 250;
    const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

    if (distance < keepAwayDistance - 45) {
      const angle = Phaser.Math.Angle.Between(player.x, player.y, this.x, this.y);
      body.setVelocity(
        Math.cos(angle) * this.definition.speed,
        Math.sin(angle) * this.definition.speed,
      );
    } else if (distance > keepAwayDistance + 60) {
      this.moveToward(player.x, player.y, this.definition.speed);
    } else {
      const strafeAngle =
        Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y) + Math.PI / 2;
      body.setVelocity(Math.cos(strafeAngle) * 42, Math.sin(strafeAngle) * 42);
    }

    this.constrainToRoom();

    if (time >= this.nextShotAt) {
      this.nextShotAt = time + (this.definition.fireCooldownMs ?? 1400);
      this.fireAtPlayer(
        player,
        enemyBullets,
        (this.definition.bulletSpeed ?? 220) * (1 + (this.floorScale - 1) * 0.35),
        this.definition.bulletDamage ?? 1,
      );
    }
  }
}
