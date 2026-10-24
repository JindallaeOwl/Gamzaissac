import Phaser from 'phaser';
import { BEAM_TUNING, DEPTH } from '../config/gameConfig';
import { distanceToSegmentSquared, type AttackDirection } from '../utils/attackDirections';
import { beamSections } from '../systems/BeamVisualRules';
import { CAVE_LIGHT_EVENT, CAVE_PALETTE } from '../systems/CaveArt';

export class BeamAttack extends Phaser.GameObjects.Rectangle {
  readonly damage: number;
  readonly direction: AttackDirection;

  private readonly bornAt: number;
  private readonly startPoint: AttackDirection;
  private readonly endPoint: AttackDirection;
  private readonly damagedAt = new WeakMap<object, number>();
  private beamGraphics?: Phaser.GameObjects.Graphics;
  private readonly range: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    direction: AttackDirection,
    range: number,
    damage: number,
  ) {
    const magnitude = Math.hypot(direction.x, direction.y) || 1;
    const unitDirection = {
      x: direction.x / magnitude,
      y: direction.y / magnitude,
    };
    const startPoint = {
      x: x + unitDirection.x * 12,
      y: y + unitDirection.y * 12,
    };
    const endPoint = {
      x: startPoint.x + unitDirection.x * range,
      y: startPoint.y + unitDirection.y * range,
    };
    const centerX = (startPoint.x + endPoint.x) / 2;
    const centerY = (startPoint.y + endPoint.y) / 2;
    const angle = Math.atan2(unitDirection.y, unitDirection.x);

    super(scene, centerX, centerY, range, BEAM_TUNING.width, 0xff7af2, 0);
    this.direction = unitDirection;
    this.range = range;
    this.damage = damage;
    this.bornAt = scene.time.now;
    this.startPoint = startPoint;
    this.endPoint = endPoint;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(DEPTH.effect).setRotation(angle);
    this.beamGraphics = scene.add
      .graphics()
      .setPosition(startPoint.x, startPoint.y)
      .setRotation(angle)
      .setDepth(DEPTH.effect + 1);
    this.drawBeam(0);
    for (let i = 0; i < 4; i += 1) {
      const distance = (range * (i + 0.5)) / 4;
      scene.events.emit(CAVE_LIGHT_EVENT, {
        x: startPoint.x + unitDirection.x * distance,
        y: startPoint.y + unitDirection.y * distance,
        color: CAVE_PALETTE.prism,
        radius: 64,
        duration: BEAM_TUNING.durationMs,
      });
    }

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
  }

  update(time: number): void {
    if (time - this.bornAt > BEAM_TUNING.durationMs) {
      this.destroy();
      return;
    }
    this.drawBeam(time - this.bornAt);
  }

  private drawBeam(ageMs: number): void {
    const graphics = this.beamGraphics;
    if (!graphics) return;
    graphics.clear();
    const sections = beamSections(this.range, ageMs, BEAM_TUNING.durationMs, BEAM_TUNING.width);
    for (const section of sections) {
      const { x, offset, radius, core } = section;
      const span = Math.min(3, this.range - x);
      graphics.fillStyle(CAVE_PALETTE.prism, 0.08);
      graphics.fillRect(x, offset - radius - 9, span, radius * 2 + 18);
      graphics.fillStyle(CAVE_PALETTE.prism, 0.12);
      graphics.fillRect(x, offset - radius - 5, span, radius * 2 + 10);
      graphics.fillStyle(0x672b87, 0.7);
      graphics.fillRect(x, offset - radius - 2, span, radius * 2 + 4);
      graphics.fillStyle(0xc845de, 0.95);
      graphics.fillRect(x, offset - radius, span, radius * 2);
      graphics.fillStyle(0xff85f0, 1);
      graphics.fillRect(x, offset - radius * 0.6, span, Math.ceil(radius * 1.2));
      graphics.fillStyle(0xfff1df, 1);
      graphics.fillRect(x, offset - core, span, core * 2);
    }
    if (sections.length) {
      const radius = sections[0].radius;
      graphics.fillStyle(0xffa4f5, 0.9);
      graphics.fillRect(-3, -radius, 6, radius * 2);
      graphics.fillStyle(0xfff6ee, 1);
      graphics.fillRect(-2, -Math.ceil(radius * 0.5), 4, radius);
    }
  }

  canDamage(target: object, time: number): boolean {
    const lastHitAt = this.damagedAt.get(target) ?? -Infinity;

    if (time - lastHitAt < BEAM_TUNING.tickMs) {
      return false;
    }

    this.damagedAt.set(target, time);
    return true;
  }

  intersectsCircle(x: number, y: number, radius: number): boolean {
    const hitRadius = BEAM_TUNING.width / 2 + Math.max(0, radius);

    return (
      distanceToSegmentSquared({ x, y }, this.startPoint, this.endPoint) <= hitRadius * hitRadius
    );
  }

  override destroy(fromScene?: boolean): void {
    this.beamGraphics?.destroy(fromScene);
    this.beamGraphics = undefined;
    super.destroy(fromScene);
  }
}
