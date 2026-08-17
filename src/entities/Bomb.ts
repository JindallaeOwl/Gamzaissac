import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { BOMB_TUNING, DEPTH } from '../config/gameConfig';

type DetonateCallback = (x: number, y: number) => void;

/**
 * 설치된 폭탄.
 *
 * 폭발 범위 원과 남은 초 숫자는 2026-08-17 사용자 요청으로 없앴다. 임박함은
 * 이제 폭탄 자체로만 알린다 — 심장처럼 커졌다 작아지는 박동이 점점 빨라지고,
 * 터지기 직전에는 도화선 불꽃이 붉게 번쩍인다. 검은 몸통은 곱셈 tint에 거의
 * 반응하지 않아 밝은 불꽃·광택만 물들기 때문에, 불꽃이 타오르는 것으로 읽힌다.
 */
export class Bomb extends Phaser.GameObjects.Sprite {
  private readonly plantedX: number;
  private readonly plantedY: number;
  private readonly plantedAt: number;
  private readonly detonateAt: number;
  private readonly onDetonate: DetonateCallback;
  private fuseTimer?: Phaser.Time.TimerEvent;
  private detonated = false;

  constructor(scene: Phaser.Scene, x: number, y: number, onDetonate: DetonateCallback) {
    super(scene, x, y, TextureKeys.bombPlaced);
    this.plantedX = x;
    this.plantedY = y;
    this.plantedAt = scene.time.now;
    this.detonateAt = this.plantedAt + BOMB_TUNING.fuseMs;
    this.onDetonate = onDetonate;

    scene.add.existing(this);
    this.setDepth(DEPTH.item);

    this.fuseTimer = scene.time.delayedCall(BOMB_TUNING.fuseMs, () => this.detonate());
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);

    if (this.detonated) {
      return;
    }

    this.setPosition(this.plantedX, this.plantedY);

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
    const { x, y } = this;
    this.destroy();
    this.onDetonate(x, y);
  }
}
