import Phaser from 'phaser';
import { DEPTH, FEEDBACK_TUNING, GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig';
import { gameFontStack, t } from '../i18n';
import { getGameSettings, getRenderScale } from './GameSettings';

type ShakeKind = keyof typeof FEEDBACK_TUNING.cameraShake;

export class EffectsSystem {
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  shake(kind: ShakeKind): void {
    const shake = FEEDBACK_TUNING.cameraShake[kind];
    const intensity = shake.intensity * getGameSettings().screenShake;

    if (intensity > 0) {
      this.scene.cameras.main.shake(shake.durationMs, intensity);
    }
  }

  muzzleFlash(x: number, y: number, direction: { x: number; y: number }): void {
    const flash = this.scene.add.circle(
      x + direction.x * 5,
      y + direction.y * 5,
      4,
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
    const ring = this.scene.add.circle(x, y, 3, color, 0.2);
    ring.setDepth(DEPTH.effect);
    ring.setStrokeStyle(2, color, 0.9);
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
    this.expandingRing(x, y, 0xffd166, 10, 290);
    this.floatingText(x, y - 9, `+${score}`, 0xffd166);
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
    this.expandingRing(GAME_WIDTH / 2, GAME_HEIGHT / 2, 0x92e6a7, 35, 420);
    this.floatingText(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 17, t('messages.clear'), 0x92e6a7);
  }

  pickup(x: number, y: number): void {
    this.burst(x, y, 0xffe39b, 6);
    this.expandingRing(x, y, 0xffe39b, 7, 210);
  }

  beamChargePulse(x: number, y: number, ready: boolean): void {
    this.expandingRing(x, y, ready ? 0xff7af2 : 0x8beeff, ready ? 10 : 6, 180);
  }

  beamFire(x: number, y: number): void {
    this.burst(x, y, 0xff7af2, 12);
    this.expandingRing(x, y, 0xff7af2, 15, 240);
  }

  beamImpact(x: number, y: number): void {
    this.impact(x, y, 0xff7af2);
  }

  obstacleBreak(x: number, y: number): void {
    this.burst(x, y, 0xa87848, 8);
    this.expandingRing(x, y, 0x8a6640, 8, 200);
  }

  bombBlast(x: number, y: number): void {
    this.burst(x, y, 0xffb35a, 16);
    this.expandingRing(x, y, 0xffd166, 20, 320);
    this.expandingRing(x, y, 0xff8f4d, 12, 260);
  }

  floatingText(x: number, y: number, text: string, color: number): void {
    const label = this.scene.add
      .text(x, y, text, {
        fontFamily: gameFontStack(),
        fontSize: '7px',
        color: Phaser.Display.Color.IntegerToColor(color).rgba,
        stroke: '#090b10',
        strokeThickness: 2,
        resolution: getRenderScale(),
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.effect);

    this.scene.tweens.add({
      targets: label,
      y: y - 12,
      alpha: 0,
      duration: FEEDBACK_TUNING.effects.floatingTextMs,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  /**
   * 폭탄에 상인이 날아가는 연출. 폭발 반대 방향으로 조각과 잔해가 쏟아진다.
   *
   * 사방으로 흩어지는 burst와 달리 방향을 가진 부채꼴이라, 어느 쪽에서 터졌는지가
   * 그림으로 읽힌다. 조각은 살짝 떠올랐다 떨어지고(무게감), 회전하며, 크기·속도·수명을
   * 조금씩 흩뜨려 기계적으로 보이지 않게 한다.
   */
  shopNpcBlast(x: number, y: number, direction: { x: number; y: number }): void {
    const baseAngle = Math.atan2(direction.y, direction.x);

    this.expandingRing(x, y, 0xffb35a, 12, 260);

    // 큰 조각: 상인 몸에서 떨어져 나간 덩어리. 회전하며 포물선을 그린다.
    for (let i = 0; i < 9; i += 1) {
      const angle = baseAngle + Phaser.Math.FloatBetween(-0.85, 0.85);
      const distance = Phaser.Math.Between(26, 74);
      const width = Phaser.Math.Between(2, 5);
      const height = Phaser.Math.Between(2, 5);
      const color = Phaser.Utils.Array.GetRandom([0xb5834a, 0x8a5f38, 0xd8b07a, 0x6f4a2c]);
      const piece = this.scene.add.rectangle(x, y, width, height, color, 1);
      piece.setDepth(DEPTH.effect);

      const targetX = x + Math.cos(angle) * distance;
      const targetY = y + Math.sin(angle) * distance;
      const duration = Phaser.Math.Between(420, 700);

      // 가로 이동은 일정하게, 세로는 떠올랐다 떨어지게 나눠 포물선을 만든다.
      this.scene.tweens.add({
        targets: piece,
        x: targetX,
        angle: Phaser.Math.Between(-540, 540),
        duration,
        ease: 'Quad.easeOut',
      });
      this.scene.tweens.add({
        targets: piece,
        y: targetY - Phaser.Math.Between(6, 16),
        duration: duration * 0.4,
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.scene.tweens.add({
            targets: piece,
            y: targetY,
            alpha: 0,
            duration: duration * 0.6,
            ease: 'Quad.easeIn',
            onComplete: () => piece.destroy(),
          });
        },
      });
    }

    // 작은 잔해: 더 빠르고 짧게 튀어 조각보다 먼저 사라진다.
    for (let i = 0; i < 14; i += 1) {
      const angle = baseAngle + Phaser.Math.FloatBetween(-0.6, 0.6);
      const distance = Phaser.Math.Between(18, 56);
      const particle = this.scene.add.circle(x, y, Phaser.Math.Between(1, 2), 0x7a4a2a, 0.95);
      particle.setDepth(DEPTH.effect);

      this.scene.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.3,
        duration: Phaser.Math.Between(220, 420),
        ease: 'Quad.easeOut',
        onComplete: () => particle.destroy(),
      });
    }
  }

  /**
   * 말풍선이 픽셀 조각으로 부서져 날아가는 연출.
   *
   * 말풍선이 차지하던 사각형을 격자로 잘라 각 칸을 조각으로 만든다. 가장자리 칸은
   * 테두리 색을 써서 "말풍선이 깨졌다"는 게 읽히게 하고, 조각마다 방향·속도·회전을
   * 흩뜨려 폭발에 휩쓸린 것처럼 보이게 한다.
   */
  shatterSpeechBubble(bounds: Phaser.Geom.Rectangle, direction: { x: number; y: number }): void {
    const baseAngle = Math.atan2(direction.y, direction.x);
    const columns = 8;
    const rows = 3;
    const pieceWidth = bounds.width / columns;
    const pieceHeight = bounds.height / rows;

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const x = bounds.x + pieceWidth * (column + 0.5);
        const y = bounds.y + pieceHeight * (row + 0.5);
        const isEdge = row === 0 || row === rows - 1 || column === 0 || column === columns - 1;
        const piece = this.scene.add.rectangle(
          x,
          y,
          pieceWidth,
          pieceHeight,
          isEdge ? 0x3a2a20 : 0xf7f0d8,
          1,
        );
        piece.setDepth(DEPTH.actor + 2);

        const angle = baseAngle + Phaser.Math.FloatBetween(-0.75, 0.75);
        const distance = Phaser.Math.Between(16, 58);

        this.scene.tweens.add({
          targets: piece,
          x: x + Math.cos(angle) * distance,
          y: y + Math.sin(angle) * distance,
          angle: Phaser.Math.Between(-320, 320),
          alpha: 0,
          scale: Phaser.Math.FloatBetween(0.3, 0.7),
          duration: Phaser.Math.Between(300, 560),
          ease: 'Quad.easeOut',
          onComplete: () => piece.destroy(),
        });
      }
    }
  }

  private expandingRing(
    x: number,
    y: number,
    color: number,
    radius: number,
    durationMs: number,
  ): void {
    const ring = this.scene.add.circle(x, y, radius, color, 0);
    ring.setStrokeStyle(2, color, 0.8);
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
      const distance = Phaser.Math.Between(9, 21);
      const particle = this.scene.add.circle(x, y, Phaser.Math.Between(1, 2), color, 0.9);
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
