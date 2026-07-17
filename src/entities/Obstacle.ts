import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { DEPTH, OBSTACLE_TUNING } from '../config/gameConfig';

export class Obstacle extends Phaser.Physics.Arcade.Sprite {
  private hp: number;
  private destroyQueued = false;
  private readonly onHealthChanged?: (remainingHealth: number) => void;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    initialHealth = OBSTACLE_TUNING.maxHealth,
    onHealthChanged?: (remainingHealth: number) => void,
  ) {
    super(scene, x, y, TextureKeys.obstacleCrate);
    this.hp = initialHealth;
    this.onHealthChanged = onHealthChanged;
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    this.setDepth(DEPTH.item).setScale(0.8);
  }

  takeDamage(amount: number): boolean {
    if (!this.active || this.destroyQueued) {
      return false;
    }

    this.hp -= amount;
    this.onHealthChanged?.(Math.max(0, this.hp));

    if (this.hp <= 0) {
      return this.destroyObstacle();
    }

    this.setTint(OBSTACLE_TUNING.hitTint);
    this.scene.time.delayedCall(OBSTACLE_TUNING.hitFlashMs, () => {
      if (this.active) {
        this.clearTint();
      }
    });

    return false;
  }

  destroyByBomb(): boolean {
    return this.destroyObstacle();
  }

  private destroyObstacle(): boolean {
    if (!this.active || this.destroyQueued) {
      return false;
    }

    this.destroyQueued = true;
    this.hp = 0;
    this.onHealthChanged?.(0);
    this.setActive(false);
    this.setVisible(false);

    const body = this.body as Phaser.Physics.Arcade.StaticBody | undefined;

    if (body) {
      body.enable = false;
    }

    this.scene.time.delayedCall(0, () => {
      if (this.scene) {
        this.destroy();
      }
    });

    return true;
  }
}
