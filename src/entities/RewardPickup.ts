import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { DEPTH } from '../config/gameConfig';
import {
  CHEST_PUSH_COOLDOWN_MS,
  CHEST_PUSH_DRAG,
  CHEST_PUSH_SPEED,
  getChestPushVelocity,
} from '../systems/ChestPushRules';
import { getRewardPickupPresentation } from '../systems/RewardPickupPresentation';
import type { RewardDrop } from '../systems/RewardSystem';

export class RewardPickup extends Phaser.Physics.Arcade.Sprite {
  readonly reward: RewardDrop;
  private chestOpened = false;
  private nextChestPushAt = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, reward: RewardDrop) {
    const presentation = getRewardPickupPresentation(reward);
    super(scene, x, y, presentation.textureKey);
    this.reward = reward;
    scene.add.existing(this);

    if (this.isChest && this.texture.has('0')) {
      this.setFrame('0');
    }

    scene.physics.add.existing(this);
    this.setDepth(DEPTH.item);
    const baseScale = presentation.scale;
    this.setScale(baseScale);

    if (presentation.tint !== null) {
      this.setTint(presentation.tint);
    }

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    const chestOffsetX = this.width >= 64 ? 19 : 3;
    const chestOffsetY = this.height >= 64 ? 27 : 3;
    body.setCircle(
      presentation.bodyRadius,
      this.isChest ? chestOffsetX : 0,
      this.isChest ? chestOffsetY : 0,
    );

    if (this.isChest) {
      body.setDrag(CHEST_PUSH_DRAG, CHEST_PUSH_DRAG);
      body.setMaxVelocity(CHEST_PUSH_SPEED, CHEST_PUSH_SPEED);
      body.setMass(2.5);
      body.setBounce(0.08, 0.08);
    } else {
      scene.tweens.add({
        targets: this,
        scale: baseScale * 1.08,
        duration: 520,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  get isChest(): boolean {
    return this.reward.kind === 'chest';
  }

  get isOpenedChest(): boolean {
    return this.isChest && this.chestOpened;
  }

  openChest(): boolean {
    if (!this.isChest || this.chestOpened) {
      return false;
    }

    this.chestOpened = true;
    this.clearTint();

    if (this.texture.key === TextureKeys.chestPickup && this.texture.has('1')) {
      this.setFrame('1');
    } else {
      this.setTexture(TextureKeys.chestOpenPickup);
    }

    return true;
  }

  push(directionX: number, directionY: number, time: number): boolean {
    if (!this.isChest || time < this.nextChestPushAt) {
      return false;
    }

    const velocity = getChestPushVelocity(directionX, directionY);

    if (!velocity) {
      return false;
    }

    const body = this.body as Phaser.Physics.Arcade.Body | undefined;

    if (!body?.enable) {
      return false;
    }

    body.setVelocity(velocity.x, velocity.y);
    this.nextChestPushAt = time + CHEST_PUSH_COOLDOWN_MS;
    return true;
  }
}
