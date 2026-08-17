import Phaser from 'phaser';
import { DEPTH } from '../config/gameConfig';
import { floorExitTextureKey, type FloorExitKind } from '../systems/FloorExitRules';

const ACTIVATION_DELAY_MS = 700;

export class FloorExit extends Phaser.Physics.Arcade.Sprite {
  readonly kind: FloorExitKind;
  private readonly usableAt: number;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: FloorExitKind = 'next-floor') {
    super(scene, x, y, floorExitTextureKey(kind));
    this.kind = kind;
    this.usableAt = scene.time.now + ACTIVATION_DELAY_MS;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(DEPTH.item);
    this.setScale(0.5);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setSize(50, 24);
    body.setOffset(7, 8);
  }

  canEnter(time: number): boolean {
    return this.active && time >= this.usableAt;
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    // 구멍은 바닥에 파인 것이다. 반투명하게 깜빡이면 바닥에서 붕 뜬 홀로그램처럼
    // 보여 "따로 노는" 느낌을 만든다 — 쓸 수 있게 되면 완전히 불투명하게 두고,
    // 시선을 끌 정도의 아주 작은 숨(배율)만 남긴다.
    const pulse = (Math.sin(time * 0.005) + 1) / 2;
    this.setScale(0.5 + pulse * 0.012);
    this.setAlpha(time < this.usableAt ? 0.65 : 1);
  }
}
