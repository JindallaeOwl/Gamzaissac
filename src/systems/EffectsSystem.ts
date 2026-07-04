import Phaser from 'phaser';
import { DEPTH, FEEDBACK_TUNING, GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig';
import { koreanFontStack, t } from '../i18n';

type ShakeKind = keyof typeof FEEDBACK_TUNING.cameraShake;

export class EffectsSystem {
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  hitStop(durationMs: number): void {
    if (durationMs <= 0) {
      return;
    }

    this.scene.cameras.main.flash(Math.min(durationMs, 55), 255, 255, 255, false);
  }

  shake(kind: ShakeKind): void {
    const shake = FEEDBACK_TUNING.cameraShake[kind];
    this.scene.cameras.main.shake(shake.durationMs, shake.intensity);
  }

  muzzleFlash(x: number, y: number, direction: { x: number; y: number }): void {
    const flash = this.scene.add.circle(
      x + direction.x * 10,
      y + direction.y * 10,
      7,
      0xf7f3e8,
      0.85,
    );
    flash.setDepth(DEPTH.effect);
    this.scene.tweens.add({
      targets: flash,
      scale: 1.8,
      alpha: 0,
      duration: FEEDBACK_TUNING.effects.muzzleMs,
      onComplete: () => flash.destroy(),
    });
  }

  impact(x: number, y: number, color = 0xf7f3e8): void {
    const ring = this.scene.add.circle(x, y, 6, color, 0.2);
    ring.setDepth(DEPTH.effect);
    ring.setStrokeStyle(3, color, 0.9);
    this.scene.tweens.add({
      targets: ring,
      scale: 2.2,
      alpha: 0,
      duration: FEEDBACK_TUNING.effects.impactMs,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  enemyDeath(x: number, y: number, score: number): void {
    this.burst(x, y, 0xff8aa3, FEEDBACK_TUNING.effects.deathParticleCount);
    this.expandingRing(x, y, 0xffd166, 20, 290);
    this.floatingText(x, y - 18, `+${score}`, 0xffd166);
  }

  playerHurtFlash(): void {
    const overlay = this.scene.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0xff3f4f,
      0.22,
    );
    overlay.setDepth(DEPTH.ui + 5);
    overlay.setScrollFactor(0);
    this.scene.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: FEEDBACK_TUNING.effects.playerFlashMs,
      onComplete: () => overlay.destroy(),
    });
  }

  roomClear(): void {
    this.expandingRing(GAME_WIDTH / 2, GAME_HEIGHT / 2, 0x92e6a7, 70, 420);
    this.floatingText(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 34, t('messages.clear'), 0x92e6a7);
  }

  pickup(x: number, y: number): void {
    this.burst(x, y, 0xffe39b, 6);
    this.expandingRing(x, y, 0xffe39b, 14, 210);
  }

  beamChargePulse(x: number, y: number, ready: boolean): void {
    this.expandingRing(x, y, ready ? 0xff7af2 : 0x8beeff, ready ? 20 : 12, 180);
  }

  beamFire(x: number, y: number): void {
    this.burst(x, y, 0xff7af2, 12);
    this.expandingRing(x, y, 0xff7af2, 30, 240);
  }

  beamImpact(x: number, y: number): void {
    this.impact(x, y, 0xff7af2);
  }

  floatingText(x: number, y: number, text: string, color: number): void {
    const label = this.scene.add
      .text(x, y, text, {
        fontFamily: koreanFontStack(),
        fontSize: '14px',
        color: Phaser.Display.Color.IntegerToColor(color).rgba,
        stroke: '#090b10',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.effect);

    this.scene.tweens.add({
      targets: label,
      y: y - 24,
      alpha: 0,
      duration: FEEDBACK_TUNING.effects.floatingTextMs,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  private expandingRing(
    x: number,
    y: number,
    color: number,
    radius: number,
    durationMs: number,
  ): void {
    const ring = this.scene.add.circle(x, y, radius, color, 0);
    ring.setStrokeStyle(3, color, 0.8);
    ring.setDepth(DEPTH.effect);
    this.scene.tweens.add({
      targets: ring,
      scale: 2.2,
      alpha: 0,
      duration: durationMs,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  private burst(x: number, y: number, color: number, count: number): void {
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + Phaser.Math.FloatBetween(-0.22, 0.22);
      const distance = Phaser.Math.Between(18, 42);
      const particle = this.scene.add.circle(x, y, Phaser.Math.Between(2, 4), color, 0.9);
      particle.setDepth(DEPTH.effect);

      this.scene.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.2,
        duration: Phaser.Math.Between(180, 320),
        ease: 'Quad.easeOut',
        onComplete: () => particle.destroy(),
      });
    }
  }
}
