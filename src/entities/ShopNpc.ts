import Phaser from 'phaser';
import { AnimationKeys, TextureKeys } from '../config/assets';
import { DEPTH } from '../config/gameConfig';
import { SHOP_NPC_DISPLAY_SIZE } from '../data/shop';
import {
  clampShopNpcToHome,
  getShopNpcPushVelocity,
  getShopNpcReturnVelocity,
  SHOP_NPC_MAX_DISPLACEMENT,
  SHOP_NPC_PUSH_SPEED,
  SHOP_NPC_RETURN_DELAY_MS,
} from '../systems/ShopNpcMotion';

const HOME_SNAP_DISTANCE = 0.4;

export class ShopNpc extends Phaser.Physics.Arcade.Sprite {
  private readonly homeX: number;
  private readonly homeY: number;
  private lastPushedAt = Number.NEGATIVE_INFINITY;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TextureKeys.shopNpcIdleA);
    this.homeX = x;
    this.homeY = y;
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDisplaySize(SHOP_NPC_DISPLAY_SIZE, SHOP_NPC_DISPLAY_SIZE);
    this.setDepth(DEPTH.actor);

    if (scene.anims.exists(AnimationKeys.shopNpcIdle)) {
      this.play(AnimationKeys.shopNpcIdle);
    }

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setCircle(9, 15, 23);
    body.setMass(8);
    body.setDrag(260, 260);
    body.setMaxVelocity(SHOP_NPC_PUSH_SPEED, SHOP_NPC_PUSH_SPEED);
    body.setBounce(0.04, 0.04);
  }

  pushFrom(sourceX: number, sourceY: number, time: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body | undefined;

    if (!body?.enable) {
      return;
    }

    const distanceFromHome = Phaser.Math.Distance.Between(this.x, this.y, this.homeX, this.homeY);

    if (distanceFromHome >= SHOP_NPC_MAX_DISPLACEMENT) {
      body.setVelocity(0, 0);
      this.lastPushedAt = time;
      return;
    }

    const velocity = getShopNpcPushVelocity(this.x, this.y, sourceX, sourceY);

    if (velocity) {
      body.setVelocity(velocity.x, velocity.y);
      this.lastPushedAt = time;
    }
  }

  updateMotion(time: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body | undefined;

    if (!body?.enable) {
      return;
    }

    const clampedPosition = clampShopNpcToHome(this.x, this.y, this.homeX, this.homeY);

    if (clampedPosition.x !== this.x || clampedPosition.y !== this.y) {
      this.setPosition(clampedPosition.x, clampedPosition.y);
    }

    if (time - this.lastPushedAt < SHOP_NPC_RETURN_DELAY_MS) {
      return;
    }

    const distanceFromHome = Phaser.Math.Distance.Between(this.x, this.y, this.homeX, this.homeY);

    if (distanceFromHome <= HOME_SNAP_DISTANCE) {
      this.setPosition(this.homeX, this.homeY);
      body.setVelocity(0, 0);
      return;
    }

    const velocity = getShopNpcReturnVelocity(this.x, this.y, this.homeX, this.homeY);

    if (velocity) {
      body.setVelocity(velocity.x, velocity.y);
    }
  }
}
