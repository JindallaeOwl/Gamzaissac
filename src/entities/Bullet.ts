import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { ROOM_RECT } from '../config/gameConfig';

export type BulletOwner = 'player' | 'enemy';

interface BulletLaunchConfig {
  x: number;
  y: number;
  direction: { x: number; y: number };
  owner: BulletOwner;
  speed: number;
  damage: number;
  lifeMs: number;
}

export class Bullet extends Phaser.Physics.Arcade.Sprite {
  owner: BulletOwner = 'player';
  damage = 1;

  private bornAt = 0;
  private lifeMs = 1000;
  private consumed = false;
  private destroyQueued = false;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, TextureKeys.playerBullet);
  }

  static spawn(
    scene: Phaser.Scene,
    group: Phaser.Physics.Arcade.Group,
    config: BulletLaunchConfig,
  ): Bullet {
    const bullet = new Bullet(scene);
    scene.add.existing(bullet);
    scene.physics.add.existing(bullet);
    group.add(bullet);
    bullet.launch(config);
    return bullet;
  }

  launch(config: BulletLaunchConfig): void {
    this.owner = config.owner;
    this.damage = config.damage;
    this.lifeMs = config.lifeMs;
    this.bornAt = this.scene.time.now;
    this.consumed = false;
    this.destroyQueued = false;
    this.setTexture(config.owner === 'player' ? TextureKeys.playerBullet : TextureKeys.enemyBullet);
    this.setPosition(config.x, config.y);
    this.setActive(true);
    this.setVisible(true);
    this.setDepth(10);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setCircle(config.owner === 'player' ? 5 : 6);
    body.enable = true;
    body.checkCollision.none = false;
    body.setVelocity(config.direction.x * config.speed, config.direction.y * config.speed);
  }

  consume(): boolean {
    if (!this.active || this.consumed || this.destroyQueued) {
      return false;
    }

    this.consumed = true;
    this.setActive(false);
    this.setVisible(false);

    const body = this.body as Phaser.Physics.Arcade.Body | undefined;

    if (body) {
      body.stop();
      body.enable = false;
      body.checkCollision.none = true;
    }

    return true;
  }

  queueDestroy(): void {
    if (this.destroyQueued) {
      return;
    }

    this.destroyQueued = true;
    this.scene.time.delayedCall(0, () => {
      if (this.scene) {
        this.destroy();
      }
    });
  }

  update(time: number): void {
    if (!this.active || this.consumed || this.destroyQueued) {
      return;
    }

    if (time - this.bornAt > this.lifeMs) {
      this.consume();
      this.queueDestroy();
      return;
    }

    const margin = 28;

    if (
      this.x < ROOM_RECT.left - margin ||
      this.x > ROOM_RECT.right + margin ||
      this.y < ROOM_RECT.top - margin ||
      this.y > ROOM_RECT.bottom + margin
    ) {
      this.consume();
      this.queueDestroy();
    }
  }
}
