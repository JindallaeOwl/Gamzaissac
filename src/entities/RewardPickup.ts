import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { DEPTH } from '../config/gameConfig';
import type { RewardDrop } from '../systems/RewardSystem';

export class RewardPickup extends Phaser.Physics.Arcade.Sprite {
  readonly reward: RewardDrop;

  constructor(scene: Phaser.Scene, x: number, y: number, reward: RewardDrop) {
    super(scene, x, y, textureForReward(reward.kind));
    this.reward = reward;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setTint(reward.tint);
    this.setDepth(DEPTH.item);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setCircle(reward.kind === 'chest' ? 17 : 12);

    scene.tweens.add({
      targets: this,
      scale: 1.08,
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}

function textureForReward(kind: RewardDrop['kind']): string {
  if (kind === 'keys') {
    return TextureKeys.keyPickup;
  }

  if (kind === 'bombs') {
    return TextureKeys.bombPickup;
  }

  if (kind === 'coins') {
    return TextureKeys.coinPickup;
  }

  return TextureKeys.chestPickup;
}
