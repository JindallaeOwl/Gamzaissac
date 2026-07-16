import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { DEPTH } from '../config/gameConfig';

const ACTIVATION_DELAY_MS = 700;

export class FloorExit extends Phaser.Physics.Arcade.Sprite {
  private readonly usableAt: number;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TextureKeys.floorExit);
    this.usableAt = scene.time.now + ACTIVATION_DELAY_MS;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(DEPTH.item);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setSize(50, 24);
    body.setOffset(7, 8);
  }

  canEnter(time: number): boolean {
    return this.active && time >= this.usableAt;
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    const pulse = (Math.sin(time * 0.006) + 1) / 2;
    this.setScale(1 + pulse * 0.045);
    this.setAlpha(time < this.usableAt ? 0.55 : 0.82 + pulse * 0.18);
  }
}
