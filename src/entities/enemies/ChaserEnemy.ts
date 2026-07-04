import Phaser from 'phaser';
import type { Player } from '../Player';
import { BaseEnemy } from './BaseEnemy';

export class ChaserEnemy extends BaseEnemy {
  updateAI(_time: number, player: Player, _enemyBullets: Phaser.Physics.Arcade.Group): void {
    this.moveToward(player.x, player.y, this.definition.speed * this.floorScale);
  }
}
