import Phaser from 'phaser';
import { TextureKeys } from '../config/assets';
import { BOMB_TUNING, DEPTH, RENDER_SCALE } from '../config/gameConfig';
import { gameFontStack } from '../i18n';

type DetonateCallback = (x: number, y: number) => void;

export class Bomb extends Phaser.GameObjects.Sprite {
  private readonly plantedX: number;
  private readonly plantedY: number;
  private readonly plantedAt: number;
  private readonly detonateAt: number;
  private readonly onDetonate: DetonateCallback;
  private fuseTimer?: Phaser.Time.TimerEvent;
  private rangeIndicator?: Phaser.GameObjects.Arc;
  private countdownText?: Phaser.GameObjects.Text;
  private displayedSeconds = -1;
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

    this.rangeIndicator = scene.add
      .circle(x, y, BOMB_TUNING.radius, 0xff704d, 0.035)
      .setStrokeStyle(2, 0xff9a66, 0.38)
      .setDepth(DEPTH.item - 1);
    this.countdownText = scene.add
      .text(x, y - 20, '3', {
        fontFamily: gameFontStack(),
        fontSize: '8px',
        fontStyle: 'bold',
        color: '#fff2c7',
        stroke: '#35130e',
        strokeThickness: 2,
        resolution: RENDER_SCALE,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.item + 1);

    this.fuseTimer = scene.time.delayedCall(BOMB_TUNING.fuseMs, () => this.detonate());
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);

    if (this.detonated) {
      return;
    }

    this.setPosition(this.plantedX, this.plantedY);

    const remainingMs = Math.max(0, this.detonateAt - time);
    const remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000));

    if (remainingSeconds !== this.displayedSeconds) {
      this.displayedSeconds = remainingSeconds;
      this.countdownText?.setText(String(remainingSeconds));
    }
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
    this.rangeIndicator?.destroy();
    this.countdownText?.destroy();
    this.rangeIndicator = undefined;
    this.countdownText = undefined;
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
