import Phaser from 'phaser';
import type { Player } from '../Player';
import { BaseEnemy } from './BaseEnemy';

export class ShooterEnemy extends BaseEnemy {
  private nextShotAt = 0;
  private fireAt = 0;

  updateAI(time: number, player: Player, enemyBullets: Phaser.Physics.Arcade.Group): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const keepAwayDistance = this.definition.keepAwayDistance ?? 125;
    const distance = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

    if (distance < keepAwayDistance - 24) {
      const angle = Phaser.Math.Angle.Between(player.x, player.y, this.x, this.y);
      body.setVelocity(
        Math.cos(angle) * this.definition.speed,
        Math.sin(angle) * this.definition.speed,
      );
    } else if (distance > keepAwayDistance + 30) {
      this.moveToward(player.x, player.y, this.definition.speed);
    } else {
      const strafeAngle =
        Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y) + Math.PI / 2;
      body.setVelocity(Math.cos(strafeAngle) * 22, Math.sin(strafeAngle) * 22);
    }

    this.constrainToRoom();

    if (this.fireAt > 0 && time >= this.fireAt) {
      this.fireAt = 0;
      this.clearTint();
      this.setScale(0.8);
      this.fireAtPlayer(
        player,
        enemyBullets,
        (this.definition.bulletSpeed ?? 112) * (1 + (this.floorScale - 1) * 0.35),
        this.definition.bulletDamage ?? 1,
      );
      return;
    }

    if (this.fireAt === 0 && time >= this.nextShotAt) {
      this.nextShotAt = time + (this.definition.fireCooldownMs ?? 1400);
      this.fireAt = time + 240;
      this.setTint(0xfff0ad);
      this.setScale(0.9);
    }
  }
}
