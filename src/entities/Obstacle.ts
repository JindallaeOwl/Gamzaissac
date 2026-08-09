import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { DEPTH, OBSTACLE_TUNING } from '../config/gameConfig';

export class Obstacle extends Phaser.Physics.Arcade.Sprite {
  private hp: number;
  private destroyQueued = false;
  private readonly onHealthChanged?: (remainingHealth: number) => void;
  private readonly onDestroyed?: (x: number, y: number) => void;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    initialHealth = OBSTACLE_TUNING.maxHealth,
    onHealthChanged?: (remainingHealth: number) => void,
    onDestroyed?: (x: number, y: number) => void,
  ) {
    super(scene, x, y, TextureKeys.obstacleCrate);
    this.hp = initialHealth;
    this.onHealthChanged = onHealthChanged;
    this.onDestroyed = onDestroyed;
    scene.add.existing(this);
    // 축소를 먼저 하고 바디를 만든다. 정적 바디는 나중에 setScale을 해도 따라
    // 줄지 않아, 순서가 바뀌면 그림보다 큰 충돌 범위가 남는다.
    this.setDepth(DEPTH.item).setScale(OBSTACLE_TUNING.displayScale);
    scene.physics.add.existing(this, true);

    const body = this.body as Phaser.Physics.Arcade.StaticBody | undefined;

    // 텍스처 여백과 접지 그림자를 뺀, 실제로 그려진 상자만 막는다.
    body?.setSize(OBSTACLE_TUNING.bodyWidth, OBSTACLE_TUNING.bodyHeight);
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

    this.onDestroyed?.(this.x, this.y);

    this.scene.time.delayedCall(0, () => {
      if (this.scene) {
        this.destroy();
      }
    });

    return true;
  }
}
