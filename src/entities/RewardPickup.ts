import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { DEPTH } from '../config/gameConfig';
import {
  CHEST_PUSH_COOLDOWN_MS,
  CHEST_PUSH_DRAG,
  CHEST_PUSH_SPEED,
  HEART_PUSH_COOLDOWN_MS,
  HEART_PUSH_DRAG,
  HEART_PUSH_SPEED,
  getChestPushVelocity,
  getHeartPushVelocity,
} from '../systems/ChestPushRules';
import { getRewardPickupPresentation } from '../systems/RewardPickupPresentation';
import type { RewardDrop } from '../systems/RewardSystem';

export class RewardPickup extends Phaser.Physics.Arcade.Sprite {
  readonly reward: RewardDrop;
  private chestOpened = false;
  private nextPushAt = 0;

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
    const chestOffsetX = this.width >= 64 ? 19 : 3;
    const chestOffsetY = this.height >= 64 ? 27 : 3;
    body.setCircle(
      presentation.bodyRadius,
      this.isChest ? chestOffsetX : 0,
      this.isChest ? chestOffsetY : 0,
    );
    this.applyBodyPhysics();

    if (!this.isChest) {
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

  get isHeart(): boolean {
    return this.reward.kind === 'heart';
  }

  get isPushable(): boolean {
    return this.isChest || this.isHeart;
  }

  /**
   * 바디의 물리 성질(중력 없음 + 미는 물체의 감속·반발·질량)을 다시 적용한다.
   *
   * 생성자에서 한 번 부르지만, **물리 그룹에 추가된 뒤 한 번 더 불러야 한다.**
   * Phaser의 물리 그룹은 자식을 추가하는 순간 바디에 그룹 기본값을 덮어써
   * (PhysicsGroup.createCallbackHandler) 감속이 0, 중력 허용이 true로 되돌아간다 —
   * 그래서 상자·하트가 벽에 닿을 때까지 등속으로 미끄러지고 있었다(2026-08-17 수정).
   * 상자와 하트가 서로 다른 수치를 쓰므로 그룹 설정 하나로는 대신할 수 없어,
   * 그룹의 createCallback이 이것을 다시 부른다.
   */
  applyBodyPhysics(): void {
    const body = this.body as Phaser.Physics.Arcade.Body | undefined;

    if (!body) {
      return;
    }

    body.setAllowGravity(false);

    if (!this.isPushable) {
      return;
    }

    const drag = this.isChest ? CHEST_PUSH_DRAG : HEART_PUSH_DRAG;
    const speed = this.isChest ? CHEST_PUSH_SPEED : HEART_PUSH_SPEED;
    body.setDrag(drag, drag);
    body.setMaxVelocity(speed, speed);
    body.setMass(this.isChest ? 2.5 : 0.7);
    body.setBounce(this.isChest ? 0.08 : 0.16, this.isChest ? 0.08 : 0.16);
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
    if (!this.isPushable || time < this.nextPushAt) {
      return false;
    }

    const velocity = this.isChest
      ? getChestPushVelocity(directionX, directionY)
      : getHeartPushVelocity(directionX, directionY);

    if (!velocity) {
      return false;
    }

    const body = this.body as Phaser.Physics.Arcade.Body | undefined;

    if (!body?.enable) {
      return false;
    }

    body.setVelocity(velocity.x, velocity.y);
    this.nextPushAt = time + (this.isChest ? CHEST_PUSH_COOLDOWN_MS : HEART_PUSH_COOLDOWN_MS);
    return true;
  }
}
