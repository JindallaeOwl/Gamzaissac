import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { DEPTH, ROOM_RECT } from '../config/gameConfig';

export type BulletOwner = 'player' | 'enemy';

interface BulletLaunchConfig {
  x: number;
  y: number;
  direction: { x: number; y: number };
  owner: BulletOwner;
  speed: number;
  damage: number;
  lifeMs: number;
  overflowPenetration?: boolean;
  scale?: number;
  /** 그리기에만 쓰는 배율. 생략하면 scale과 같다. 판정은 언제나 scale만 따른다. */
  displayScale?: number;
  tint?: number;
}

export class Bullet extends Phaser.Physics.Arcade.Sprite {
  owner: BulletOwner = 'player';
  damage = 1;
  overflowPenetration = false;

  private bornAt = 0;
  private lifeMs = 1000;
  private consumed = false;
  private destroyQueued = false;
  private tintColor?: number;
  private hitTargets = new Set<object>();

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, TextureKeys.playerSeed);
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
    this.overflowPenetration = config.overflowPenetration ?? false;
    this.lifeMs = config.lifeMs;
    this.bornAt = this.scene.time.now;
    this.consumed = false;
    this.destroyQueued = false;
    this.hitTargets.clear();
    this.clearTint();
    this.tintColor = config.tint;
    this.setScale(config.displayScale ?? config.scale ?? 1);
    this.setTexture(config.owner === 'player' ? TextureKeys.playerSeed : TextureKeys.enemyBullet);
    if (config.tint !== undefined) {
      this.setTint(config.tint);
    }
    this.setPosition(config.x, config.y);
    this.setActive(true);
    this.setVisible(true);
    this.setDepth(10);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    // Phaser는 원형 바디도 스프라이트 배율로 다시 곱한다(Body.updateBounds:
    // sourceWidth * scaleX). 그래서 이 게임의 월드 판정 반지름은 예전부터
    // round(3·scale)·scale — scale의 제곱꼴이었다. 여기서는 그 기존 동작을
    // 그대로 보존하면서, 표시 배율(displayScale)만 판정에서 상쇄한다:
    // 바디에 주는 값에서 미리 나누면 Phaser가 다시 곱해 원래 크기가 된다.
    // 즉 공격력이 키우는 것은 그림뿐이고, 판정은 아이템이 명시한 seedScale의
    // 함수로 남는다.
    const physicsScale = config.scale ?? 1;
    const visualScale = config.displayScale ?? physicsScale;
    const worldRadius = Math.round(3 * physicsScale) * physicsScale;
    // 나눴다 다시 곱하는 왕복에서 3이 2.99999…가 되면 Phaser의 floor(halfWidth)가
    // 한 픽셀을 통째로 깎는다. 미세한 여유로 그 절벽을 막는다.
    const playerRadius = (worldRadius + 0.0001) / visualScale;
    const radius = config.owner === 'player' ? playerRadius : 4;

    // 오프셋 없이 setCircle을 부르면 바디가 스프라이트의 왼쪽 위에 붙는다.
    // 표시 배율이 커질수록 그 어긋남도 함께 커져(배율 2에서 중심이 5px 이탈)
    // 그림의 오른쪽 아래 절반이 판정 밖이 된다. displayOrigin - 반지름 오프셋이
    // 원을 스프라이트 중심에 앉힌다(적 탄은 4-4=0이라 기존과 동일).
    body.setCircle(radius, this.displayOriginX - radius, this.displayOriginY - radius);
    body.enable = true;
    body.checkCollision.none = false;
    body.setVelocity(config.direction.x * config.speed, config.direction.y * config.speed);
    this.setRotation(Math.atan2(config.direction.y, config.direction.x));
  }

  hasHitTarget(target: object): boolean {
    return this.hitTargets.has(target);
  }

  markTargetHit(target: object): void {
    this.hitTargets.add(target);
  }

  retainOverflowDamage(damage: number): void {
    this.damage = damage;
    const body = this.body as Phaser.Physics.Arcade.Body | undefined;

    if (body) {
      const direction = body.velocity.clone().normalize();
      this.x += direction.x * 4;
      this.y += direction.y * 4;
    }
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
      this.spawnSeedDropEffect();
      this.consume();
      this.queueDestroy();
      return;
    }

    const margin = 14;

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

  private spawnSeedDropEffect(): void {
    if (this.owner !== 'player') {
      return;
    }

    const body = this.body as Phaser.Physics.Arcade.Body | undefined;
    const scene = this.scene;
    const direction = body?.velocity.clone().normalize() ?? new Phaser.Math.Vector2();
    const landingX = this.x + direction.x * 3;
    const landingY = this.y + direction.y * 3 + 4;
    const seedScaleX = this.scaleX;
    const seedScaleY = this.scaleY;
    const shadow = scene.add
      .ellipse(landingX, landingY + 2, 7 * seedScaleX, 3 * seedScaleY, 0x07110a, 0.08)
      .setScale(0.35)
      .setDepth(DEPTH.bullet - 1);
    const fallenSeed = scene.add
      .image(this.x, this.y, TextureKeys.playerSeed)
      .setScale(seedScaleX, seedScaleY)
      .setRotation(this.rotation)
      .setDepth(DEPTH.bullet);

    if (this.tintColor !== undefined) {
      fallenSeed.setTint(this.tintColor);
    }

    scene.tweens.add({
      targets: shadow,
      scaleX: 1,
      scaleY: 1,
      alpha: 0.28,
      duration: 130,
      ease: 'Quad.easeIn',
    });
    scene.tweens.add({
      targets: fallenSeed,
      x: landingX,
      y: landingY,
      rotation: this.rotation + Math.PI * 0.65,
      scaleX: seedScaleX * 1.05,
      scaleY: seedScaleY * 0.65,
      duration: 130,
      ease: 'Quad.easeIn',
      onComplete: () => {
        scene.tweens.add({
          targets: [fallenSeed, shadow],
          alpha: 0,
          scaleX: '*=0.75',
          scaleY: '*=0.75',
          delay: 140,
          duration: 180,
          ease: 'Quad.easeOut',
          onComplete: () => {
            fallenSeed.destroy();
            shadow.destroy();
          },
        });
      },
    });
  }
}
