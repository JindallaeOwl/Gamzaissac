import Phaser from 'phaser';
import { DEPTH, GAME_WIDTH, TITLE_SIGN_TUNING } from '../config/gameConfig';
import { getTitleChainPoints, getTitleSignHook, getTitleSignPose } from '../systems/TitleSignRules';
import type { TitleMenuMode } from './TitleMenuRules';

export class HangingTitleSign {
  private readonly board: Phaser.GameObjects.Container;
  private readonly wood: Phaser.GameObjects.Graphics;
  private readonly chains: Phaser.GameObjects.Graphics;
  private elapsedMs = 0;
  private restingY = 130;
  private width = 156;
  private ready = false;

  constructor(scene: Phaser.Scene) {
    // 로고보다 뒤에 둬 낙하 중에도 판과 사슬이 타이틀 글자를 가리지 않게 한다.
    this.chains = scene.add.graphics().setDepth(DEPTH.ui - 2);
    this.board = scene.add.container(GAME_WIDTH / 2, this.restingY).setDepth(DEPTH.ui - 1);
    this.wood = scene.add.graphics();
    this.board.add(this.wood);
    this.update(0);
  }

  get isReady(): boolean {
    return this.ready;
  }

  attachMenu(menu: Phaser.GameObjects.Container, mode: TitleMenuMode): void {
    const main = mode === 'main';
    this.width = main ? 156 : 278;
    this.restingY = main ? 130 : 65;
    this.drawWood(main ? 101 : 177);
    this.board.add(menu);
    menu.setPosition(0, main ? 20 : 15);
    // 설정을 열고 닫을 때에는 기존 경과 시간을 유지해 낙하를 반복하지 않는다.
    this.update(0);
  }

  update(deltaMs: number): void {
    this.elapsedMs += Math.max(0, deltaMs);
    const pose = getTitleSignPose(this.elapsedMs, TITLE_SIGN_TUNING);
    this.ready = pose.ready;
    this.board
      .setVisible(pose.visible)
      .setPosition(GAME_WIDTH / 2 + pose.x, this.restingY + pose.y)
      .setAngle(pose.angle);
    this.chains.clear();
    if (!pose.visible) return;
    for (const side of [-1, 1] as const) {
      const localX = side * (this.width / 2 - 10);
      const hook = getTitleSignHook(this.board, localX, 3, pose.angle);
      const points = getTitleChainPoints(
        { x: GAME_WIDTH / 2 + localX, y: -10 },
        hook,
        // 기울어져 올라간 쪽 사슬만 느슨해져 양쪽이 한꺼번에 탄성 운동하지 않게 한다.
        pose.ready ? Math.max(0, this.restingY + 3 - hook.y) * 0.6 : 0,
        side,
      );
      for (const [index, point] of points.entries()) {
        if (point.y < -6) continue;
        const width = index % 2 === 0 ? 4 : 2;
        this.chains.lineStyle(2, 0x201b16);
        this.chains.strokeRect(Math.round(point.x - width / 2), Math.round(point.y - 2), width, 5);
        this.chains.lineStyle(1, index % 2 === 0 ? 0x9a8865 : 0x695f4b);
        this.chains.strokeRect(Math.round(point.x - width / 2), Math.round(point.y - 2), width, 5);
      }
    }
  }

  private drawWood(height: number): void {
    const left = -this.width / 2;
    const g = this.wood.clear();
    g.fillStyle(0x16120f, 0.55);
    g.fillRect(left + 3, 5, this.width, height);
    g.fillStyle(0x38271b);
    g.fillRect(left + 2, 0, this.width - 4, height);
    g.fillRect(left, 3, this.width, height - 6);
    // 가운데는 어두운 판재로 비워 메뉴 글자가 나뭇결에 묻히지 않게 한다.
    g.fillStyle(0x281e16);
    g.fillRect(left + 5, 5, this.width - 10, height - 10);
    for (let row = 0; row < height - 10; row += 25) {
      g.fillStyle(row % 50 === 0 ? 0x302218 : 0x2b2018);
      g.fillRect(left + 6, 6 + row, this.width - 12, Math.min(23, height - 12 - row));
      g.fillStyle(0x735033, 0.22);
      g.fillRect(left + 9, 10 + row, 18 + (row % 13), 1);
      g.fillRect(this.width / 2 - 34, 18 + row, 20, 1);
    }
    g.fillStyle(0x9c7142);
    g.fillRect(left + 3, 1, this.width - 6, 2);
    g.fillStyle(0x5d4029);
    g.fillRect(left + 3, height - 4, this.width - 6, 2);
    for (const x of [left + 10, -left - 10]) {
      g.fillStyle(0x171511);
      g.fillRect(x - 3, 0, 6, 9);
      g.lineStyle(1, 0xb19a70);
      g.strokeRect(x - 2, 0, 4, 7);
      g.fillStyle(0x8b7855);
      g.fillRect(x - 1, height - 10, 2, 2);
    }
  }
}
