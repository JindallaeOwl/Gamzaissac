import Phaser from 'phaser';
import { DEPTH, FEEDBACK_TUNING, GAME_HEIGHT, GAME_WIDTH, ROOM_RECT } from '../config/gameConfig';
import { gameFontStack, t } from '../i18n';
import { getGameSettings, getRenderScale } from './GameSettings';
import { PixelDebris } from './PixelDebris';
import { ENEMY_PIXEL_FRAGMENTS, fragmentImpulse, type ColoredFragment } from './EnemyDamagePixels';
import { EnemyDamageVisual } from './EnemyDamageVisual';
import type { RoomNode } from './DungeonManager';
import { CaveAtmosphere, type LightProjectile } from './CaveAtmosphere';
import { CAVE_PALETTE } from './CaveArt';

type ShakeKind = keyof typeof FEEDBACK_TUNING.cameraShake;

export class EffectsSystem {
  private readonly scene: Phaser.Scene;
  private readonly debris = new PixelDebris(ROOM_RECT);
  private readonly debrisGraphics: Phaser.GameObjects.Graphics;
  private readonly atmosphere: CaveAtmosphere;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.atmosphere = new CaveAtmosphere(scene);
    // Keep debris below projectiles, pickups and actors so combat stays readable.
    this.debrisGraphics = scene.add.graphics().setDepth(DEPTH.floor + 1);
    scene.events.on(ENEMY_PIXEL_FRAGMENTS, this.enemyFragments, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.debris.clear();
      scene.events.off(ENEMY_PIXEL_FRAGMENTS, this.enemyFragments, this);
    });
  }

  private enemyFragments(fragments: ColoredFragment[], defeated: boolean): void {
    for (const fragment of fragments) {
      const impulse = fragmentImpulse(fragment.impact);
      this.debris.emit(
        fragment.x,
        fragment.y,
        fragment.color,
        1,
        fragment.impact ? impulse.power : defeated ? 1.1 : 0.65,
        true,
      );
      const piece = this.debris.pieces[this.debris.pieces.length - 1];
      piece.size = fragment.size;
      piece.y += piece.z; // The initial rendered pixel matches the removed sprite pixel.
      piece.vx = fragment.impact
        ? piece.vx * 0.35 + impulse.x
        : piece.vx + fragment.dx * (defeated ? 38 : 24);
      piece.vy = fragment.impact
        ? piece.vy * 0.35 + impulse.y
        : piece.vy + fragment.dy * (defeated ? 28 : 18);
    }
  }

  update(deltaMs: number, projectiles: readonly LightProjectile[] = []): void {
    this.atmosphere.update(deltaMs, projectiles);
    this.debris.update(deltaMs);
    const graphics = this.debrisGraphics.clear();
    for (const p of this.debris.ground) {
      graphics.fillStyle(p.color, 0.58);
      graphics.fillRect(p.x, p.y, p.size, p.size);
    }
    for (const p of this.debris.pieces) {
      const alpha = p.retain ? 1 : Math.min(1, (p.lifetime - p.age) / 0.45);
      const x = Math.round(p.x - p.size / 2);
      const floorY = Math.round(p.y);
      if (p.z > 1) {
        graphics.fillStyle(0x211b18, 0.22 * alpha);
        graphics.fillRect(x, floorY, p.size, 1);
      }
      graphics.fillStyle(p.color, alpha * (p.z > 0 ? 1 : 0.7));
      graphics.fillRect(x, Math.round(p.y - p.z - p.size / 2), p.size, p.size);
    }
  }

  clearDebris(): void {
    this.debris.clear();
    this.debrisGraphics.clear();
  }

  enterRoom(room: RoomNode, floor: number): void {
    this.atmosphere.enterRoom(room, floor);
    room.groundDebris ??= [];
    this.debris.enterRoom(room.groundDebris);
    this.update(0);
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
    this.debris.emit(x, y, color, 4, 0.7);
  }

  enemyDeath(x: number, y: number, score: number): void {
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

  /** 아이템 흡수. 분류 색 두 겹 링 + 파편을 플레이어 위에 터뜨려, 두루마리 UI가
      아니라 게임 세계 안에서도 "몸에 들어왔다"가 보이게 한다. */
  itemAbsorb(x: number, y: number, color: number): void {
    this.burst(x, y, color, 10);
    this.expandingRing(x, y, color, 9, 260);
    this.expandingRing(x, y, color, 16, 380);
  }

  /** 시너지 발동. 아이템 흡수(분류 색)와 구별되는 금·백색 링을 더 크고 길게
      터뜨린다. 흡수 연출과 같은 프레임에 겹쳐 재생되므로 색으로 구별해야 한다. */
  synergyActivate(x: number, y: number): void {
    this.burst(x, y, 0xfff3c4, 14);
    this.expandingRing(x, y, 0xffd166, 12, 320);
    this.expandingRing(x, y, 0xffffff, 20, 480);
  }

  beamChargePulse(x: number, y: number, ready: boolean): void {
    this.atmosphere.pulse({
      x,
      y,
      color: ready ? CAVE_PALETTE.prism : CAVE_PALETTE.blue,
      radius: ready ? 48 : 28,
      duration: 180,
    });
    this.expandingRing(x, y, ready ? 0xff7af2 : 0x8beeff, ready ? 10 : 6, 180);
  }

  beamFire(x: number, y: number): void {
    this.atmosphere.pulse({ x, y, color: CAVE_PALETTE.prism, radius: 90, duration: 320 });
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
    this.debris.emitBomb(x, y);
    this.atmosphere.pulse({ x, y, color: CAVE_PALETTE.fire, radius: 155, duration: 480 });
    this.atmosphere.blast(x, y);
    this.expandingRing(x, y, 0xffd166, 20, 320);
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

  /** 상인의 현재 프레임에서 색을 뽑아 폭발 반대 방향으로 튀기고 작은 잔해를 남긴다. */
  shopNpcBlast(npc: Phaser.GameObjects.Sprite, sourceX: number, sourceY: number): void {
    const visual = new EnemyDamageVisual(npc);
    visual.hit(sourceX, sourceY, 0xffffff, true, {
      kind: 'explosion',
      x: npc.x - sourceX,
      y: npc.y - sourceY,
    });
    visual.destroy();
    this.expandingRing(npc.x, npc.y, 0xffb35a, 12, 260);
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
