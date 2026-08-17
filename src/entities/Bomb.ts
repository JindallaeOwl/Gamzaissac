import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { BOMB_TUNING, DEPTH } from '../config/gameConfig';
import {
  BOMB_BODY_PUSH_COOLDOWN_MS,
  BOMB_BODY_PUSH_SPEED,
  BOMB_PUSH_ARM_DISTANCE,
  BOMB_SEED_PUSH_SPEED,
  getBombPushVelocity,
} from '../systems/BombPushRules';

type DetonateCallback = (x: number, y: number) => void;

// 도트에서 몸통(공)이 차지하는 자리. 텍스처 44×44 안에서 공은 격자 x5~17·y8~20을
// 채우므로, 배율 1 기준으로 반지름 13에 좌상단 오프셋 (10, 16)이다. 도화선·불꽃은
// 판정에서 빠진다 — 그림의 공만 실제로 밀 수 있는 몸이어야 한다.
const BODY_RADIUS = 13;
const BODY_OFFSET_X = 10;
const BODY_OFFSET_Y = 16;

/**
 * 설치된 폭탄.
 *
 * 폭발 범위 원과 남은 초 숫자는 2026-08-17 사용자 요청으로 없앴다. 임박함은
 * 이제 폭탄 자체로만 알린다 — 심장처럼 커졌다 작아지는 박동이 점점 빨라지고,
 * 터지기 직전에는 도화선 불꽃이 붉게 번쩍인다. 검은 몸통은 곱셈 tint에 거의
 * 반응하지 않아 밝은 불꽃·광택만 물들기 때문에, 불꽃이 타오르는 것으로 읽힌다.
 *
 * 심은 뒤에는 밀 수 있는 물체다 — 몸으로 밀거나 씨앗으로 맞혀 굴린다. 얼음처럼
 * 관성이 조금 남아 미끄러지며, 수치는 BombPushRules에 모여 있다. 터지는 자리는
 * 심은 자리가 아니라 **터질 때 있는 자리**다(detonate가 현재 좌표를 넘긴다).
 */
export class Bomb extends Phaser.Physics.Arcade.Sprite {
  private readonly plantedAt: number;
  private readonly detonateAt: number;
  private readonly onDetonate: DetonateCallback;
  private fuseTimer?: Phaser.Time.TimerEvent;
  private detonated = false;
  private pushArmed = false;
  private nextBodyPushAt = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, onDetonate: DetonateCallback) {
    super(scene, x, y, TextureKeys.bombPlaced);
    this.plantedAt = scene.time.now;
    this.detonateAt = this.plantedAt + BOMB_TUNING.fuseMs;
    this.onDetonate = onDetonate;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(DEPTH.item);

    // 바디 모양만 여기서 정한다. 감속·반발·최대 속도는 BombSystem이 물리 그룹
    // 설정으로 주는데, Phaser의 물리 그룹은 자식을 추가할 때 바디에 그룹 기본값을
    // 덮어써서(PhysicsGroup.createCallbackHandler) 여기서 설정해도 지워지기 때문이다.
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(BODY_RADIUS, BODY_OFFSET_X, BODY_OFFSET_Y);

    this.fuseTimer = scene.time.delayedCall(BOMB_TUNING.fuseMs, () => this.detonate());
  }

  /**
   * 밀 수 있는 상태인지. 심는 순간에는 플레이어 발밑이라 꺼져 있고, 플레이어가
   * 한 번 벗어나면 켜진다 — 그래서 심자마자 밀려나거나 자기 씨앗이 발밑에서
   * 사라지는 일이 없다.
   */
  get isPushArmed(): boolean {
    return this.pushArmed;
  }

  /** 플레이어가 폭탄에서 충분히 떨어졌는지 보고 상호작용을 켠다. */
  updatePushArming(playerX: number, playerY: number): void {
    if (this.pushArmed || !this.active) {
      return;
    }

    if (Phaser.Math.Distance.Between(this.x, this.y, playerX, playerY) > BOMB_PUSH_ARM_DISTANCE) {
      this.pushArmed = true;
    }
  }

  /** 몸으로 미는 것 — 접촉이 매 프레임 들어오므로 쿨다운으로 간격을 둔다. */
  pushByBody(directionX: number, directionY: number, time: number): boolean {
    if (time < this.nextBodyPushAt) {
      return false;
    }

    if (!this.applyPush(directionX, directionY, BOMB_BODY_PUSH_SPEED)) {
      return false;
    }

    this.nextBodyPushAt = time + BOMB_BODY_PUSH_COOLDOWN_MS;
    return true;
  }

  /** 씨앗에 맞아 밀리는 것 — 한 발당 한 번뿐이라 쿨다운이 필요 없다. */
  pushBySeed(directionX: number, directionY: number): boolean {
    return this.applyPush(directionX, directionY, BOMB_SEED_PUSH_SPEED);
  }

  private applyPush(directionX: number, directionY: number, speed: number): boolean {
    const velocity = getBombPushVelocity(directionX, directionY, speed);
    const body = this.body as Phaser.Physics.Arcade.Body | undefined;

    if (!velocity || !body?.enable || this.detonated) {
      return false;
    }

    body.setVelocity(velocity.x, velocity.y);
    return true;
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);

    if (this.detonated) {
      return;
    }

    const remainingMs = Math.max(0, this.detonateAt - time);
    const progress = Phaser.Math.Clamp((time - this.plantedAt) / BOMB_TUNING.fuseMs, 0, 1);
    const pulseSpeed = Phaser.Math.Linear(0.008, 0.028, progress);
    const pulse = (Math.sin(time * pulseSpeed) + 1) / 2;
    this.setScale(0.8 + pulse * Phaser.Math.Linear(0.03, 0.1, progress));

    const flashIntervalMs = Phaser.Math.Linear(420, 90, progress);
    const flashing = Math.floor(remainingMs / flashIntervalMs) % 2 === 0;

    if (remainingMs <= 500) {
      this.setTint(flashing ? 0xff5a36 : 0xffb35a);
    } else if (flashing && progress >= 0.25) {
      this.setTint(0xffd166);
    } else {
      this.clearTint();
    }
  }

  override destroy(fromScene?: boolean): void {
    this.fuseTimer?.remove(false);
    this.fuseTimer = undefined;
    super.destroy(fromScene);
  }

  private detonate(): void {
    if (this.detonated || !this.active) {
      return;
    }

    this.detonated = true;
    this.fuseTimer = undefined;
    // 폭발 중심은 스프라이트 원점이 아니라 공(바디)의 중심이다. 도화선·불꽃이
    // 그림 위쪽을 차지해 원점이 공보다 6px쯤 위에 있고, 범위 표시를 없앤 뒤로는
    // 어긋남을 눈으로 확인할 수단도 없다.
    const body = this.body as Phaser.Physics.Arcade.Body | undefined;
    const x = body?.center.x ?? this.x;
    const y = body?.center.y ?? this.y;
    this.destroy();
    this.onDetonate(x, y);
  }
}
