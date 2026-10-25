import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { DEPTH, ROOM_RECT } from '../config/gameConfig';
import { getWaveAngleOffset } from '../systems/SeedWaveRules';
import {
  SEED_DROP_BOUNCE_MS,
  SEED_DROP_FADE_MS,
  seedDropFallMs,
  seedDropPose,
  seedFlightFrame,
} from '../systems/seedPixelSprites';

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
  /** 물결 궤적 진폭(도). 0 또는 생략이면 직선 */
  waveDegrees?: number;
  /** 물결 위상 부호. 부채꼴에서 이웃 씨앗과 엇갈리게 한다 */
  waveSign?: 1 | -1;
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
  private waveDegrees = 0;
  private waveSign: 1 | -1 = 1;
  private waveBaseAngle = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, TextureKeys.playerSeed, 0);
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
    this.waveDegrees = config.waveDegrees ?? 0;
    this.waveSign = config.waveSign ?? 1;
    this.setScale(config.displayScale ?? config.scale ?? 1);
    this.setTexture(
      config.owner === 'player' ? TextureKeys.playerSeed : TextureKeys.enemyBullet,
      config.owner === 'player' ? 0 : undefined,
    );
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

    const launchAngle = Math.atan2(config.direction.y, config.direction.x);
    this.waveBaseAngle = launchAngle;
    this.setRotation(launchAngle);
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

    if (this.owner === 'player') {
      const frame = seedFlightFrame(time - this.bornAt);
      // Atlas frames share dimensions. Leave the origin and Arcade body alone.
      if (Number(this.frame.name) !== frame) this.setFrame(frame, false, false);
    }

    // 물결 궤적: 발사 각에 조향 오프셋을 더해 속도의 "방향"만 돌린다. 크기는
    // body가 가진 현재 속력을 그대로 보존하므로(setAngle), 나중에 탄속을 바꾸는
    // 효과가 생겨도 물결이 그것을 덮어쓰지 않는다. 위치를 직접 옮기지 않으므로
    // 벽·장애물 충돌도 기존 콜라이더가 그대로 처리한다.
    if (this.waveDegrees > 0) {
      const body = this.body as Phaser.Physics.Arcade.Body | undefined;

      if (body) {
        const angle =
          this.waveBaseAngle +
          getWaveAngleOffset(time - this.bornAt, this.waveDegrees, this.waveSign);
        body.velocity.setAngle(angle);
        this.setRotation(angle);
      }
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
    const velocity = { x: body?.velocity.x ?? 0, y: body?.velocity.y ?? 0 };
    const fallMs = seedDropFallMs(Math.hypot(velocity.x, velocity.y));
    const duration = fallMs + SEED_DROP_BOUNCE_MS + SEED_DROP_FADE_MS;
    const startX = this.x;
    const startY = this.y;
    const startRotation = this.rotation;
    const flightAge = scene.time.now - this.bornAt;
    const seedScaleX = this.scaleX;
    const seedScaleY = this.scaleY;
    const shadow = scene.add
      .rectangle(startX, startY + 12, 6 * seedScaleX, 2 * seedScaleY, 0x07110a, 0.08)
      .setScale(0.35)
      .setDepth(DEPTH.bullet - 1);
    const fallenSeed = scene.add
      .image(this.x, this.y, TextureKeys.playerSeed, this.frame.name)
      .setScale(seedScaleX, seedScaleY)
      .setRotation(this.rotation)
      .setDepth(DEPTH.bullet);

    if (this.tintColor !== undefined) {
      fallenSeed.setTint(this.tintColor);
    }

    const clock = { elapsed: 0 };
    let landed = false;
    scene.tweens.add({
      targets: clock,
      elapsed: duration,
      duration,
      ease: 'Linear',
      onUpdate: () => {
        const pose = seedDropPose(clock.elapsed, velocity, fallMs);
        fallenSeed
          .setPosition(startX + pose.x, startY + pose.y)
          .setRotation(startRotation + (velocity.x < 0 ? -1 : 1) * 0.2 * pose.progress)
          .setScale(seedScaleX * (2 - pose.squash), seedScaleY * pose.squash)
          .setAlpha(pose.alpha);
        shadow
          .setPosition(startX + pose.x, startY + pose.groundY + 2)
          .setScale(0.35 + 0.65 * pose.progress)
          .setAlpha((0.08 + 0.14 * pose.progress) * pose.alpha);
        if (clock.elapsed < fallMs) {
          fallenSeed.setFrame(seedFlightFrame(flightAge + clock.elapsed));
        } else if (!landed) {
          landed = true;
          fallenSeed.setDepth(DEPTH.floor + 1.4);
        }
      },
      onComplete: () => {
        fallenSeed.destroy();
        shadow.destroy();
      },
    });
  }
}
