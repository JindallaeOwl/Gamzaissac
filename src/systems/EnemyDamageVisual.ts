import type Phaser from 'phaser';
import {
  ENEMY_PIXEL_FRAGMENTS,
  opaquePixels,
  selectChipPixels,
  tintPixel,
} from './EnemyDamagePixels';
import type { ColoredFragment, PixelSample, FragmentImpact, DamageScar } from './EnemyDamagePixels';

let nextDamageTexture = 0;

/** A private copy per wounded enemy: shared art and collision geometry stay intact. */
export class EnemyDamageVisual {
  private sourceFrame: Phaser.Textures.Frame;
  private texture: Phaser.Textures.CanvasTexture;
  private readonly holes: DamageScar[];
  private budget: number;

  constructor(
    private readonly sprite: Phaser.GameObjects.Sprite,
    scars: DamageScar[] = [],
  ) {
    this.holes = scars;
    this.sourceFrame = sprite.frame;
    const key = `enemy-damage-${nextDamageTexture++}`;
    this.texture = sprite.scene.textures.createCanvas(key, sprite.width, sprite.height)!;
    this.redraw();
    this.budget = Math.max(
      0,
      Math.floor((this.readPixels().length + scars.length) * 0.12) - scars.length,
    );
  }

  sync(): void {
    // AnimationState selects the original animation frame. Reapply the same
    // local scars to that frame without restarting or replacing the animation.
    if (this.sprite.frame.texture !== this.texture) {
      if (this.sprite.frame !== this.sourceFrame) {
        this.sourceFrame = this.sprite.frame;
        this.redraw();
      } else {
        this.sprite.setFrame(this.texture.get(), false, false);
      }
    }
  }

  hit(
    sourceX: number,
    sourceY: number,
    tint: number,
    defeated: boolean,
    impact?: FragmentImpact,
  ): void {
    this.sync();
    const pixels = this.readPixels();
    const width = this.texture.width;
    const height = this.texture.height;
    const local = this.sprite.getWorldTransformMatrix().applyInverse(sourceX, sourceY);
    const sx = (this.sprite.flipX ? -local.x : local.x) + this.sprite.displayOriginX;
    const sy = (this.sprite.flipY ? -local.y : local.y) + this.sprite.displayOriginY;
    const chipped = selectChipPixels(pixels, width, height, sx, sy, this.budget);
    const selected = defeated
      ? pixels.filter((_, i) => i % Math.max(1, Math.ceil(pixels.length / 42)) === 0)
      : chipped.length
        ? chipped
        : selectChipPixels(pixels, width, height, sx, sy, 7);

    const fragments: ColoredFragment[] = [];
    const matrix = this.sprite.getWorldTransformMatrix();
    const stride = defeated ? 1 : Math.max(1, Math.ceil(selected.length / 7));
    selected.forEach((pixel, i) => {
      if (i % stride !== 0) return;
      let x = pixel.x + 0.5 - this.sprite.displayOriginX;
      let y = pixel.y + 0.5 - this.sprite.displayOriginY;
      if (this.sprite.flipX) x = -x;
      if (this.sprite.flipY) y = -y;
      const world = matrix.transformPoint(x, y);
      const dx = defeated ? world.x - this.sprite.x : sourceX - this.sprite.x;
      const dy = defeated ? world.y - this.sprite.y : sourceY - this.sprite.y;
      const length = Math.hypot(dx, dy) || 1;
      fragments.push({
        x: world.x,
        y: world.y,
        color: tintPixel(pixel.color, tint),
        size: Math.max(1, Math.min(3, Math.round(Math.abs(this.sprite.scaleX) * 2))),
        dx: dx / length,
        dy: dy / length,
        impact,
      });
    });
    if (!defeated && chipped.length) {
      this.budget -= chipped.length;
      for (const pixel of chipped) this.holes.push({ x: pixel.x / width, y: pixel.y / height });
      this.redraw();
    }
    this.sprite.scene.events.emit(ENEMY_PIXEL_FRAGMENTS, fragments, defeated);
  }

  private readPixels(): PixelSample[] {
    return opaquePixels(
      this.texture.context.getImageData(0, 0, this.texture.width, this.texture.height).data,
      this.texture.width,
    );
  }

  private redraw(): void {
    const frame = this.sourceFrame;
    const width = frame.realWidth;
    const height = frame.realHeight;
    if (this.texture.width !== width || this.texture.height !== height) {
      this.texture.setSize(width, height);
    }
    const ctx = this.texture.context;
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      frame.source.image as CanvasImageSource,
      frame.cutX,
      frame.cutY,
      frame.cutWidth,
      frame.cutHeight,
      frame.x,
      frame.y,
      frame.cutWidth,
      frame.cutHeight,
    );
    for (const hole of this.holes) {
      ctx.clearRect(Math.floor(hole.x * width), Math.floor(hole.y * height), 1, 1);
    }
    this.texture.refresh();
    this.sprite.setFrame(this.texture.get(), false, false);
  }

  destroy(): void {
    this.sprite.setFrame(this.sourceFrame, false, false);
    this.sprite.scene.textures.remove(this.texture.key);
  }
}
