import { describe, expect, it } from 'vitest';
import { HangingTitleSign } from '../src/ui/HangingTitleSign';

// 입력 좌표도 함께 움직여야 하므로 판과 메뉴의 실제 부모 연결을 대역으로 검사한다.
class FakeNode {
  x = 0;
  y = 0;
  angle = 0;
  depth = 0;
  visible = true;
  children: FakeNode[] = [];
  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
    return this;
  }
  setAngle(value: number) {
    this.angle = value;
    return this;
  }
  setDepth(value: number) {
    this.depth = value;
    return this;
  }
  setVisible(value: boolean) {
    this.visible = value;
    return this;
  }
  add(child: FakeNode) {
    this.children.push(child);
    return this;
  }
  clear() {
    return this;
  }
  fillStyle() {
    return this;
  }
  fillRect() {
    return this;
  }
  lineStyle() {
    return this;
  }
  strokeRect() {
    return this;
  }
}

function setup() {
  const board = new FakeNode();
  const chains: FakeNode[] = [];
  const scene = {
    add: {
      graphics: () => {
        const node = new FakeNode();
        chains.push(node);
        return node;
      },
      container: () => board,
    },
  };
  const sign = new HangingTitleSign(
    scene as unknown as ConstructorParameters<typeof HangingTitleSign>[0],
  );
  const attach = (menu: FakeNode, mode: 'main' | 'settings') =>
    sign.attachMenu(menu as unknown as Parameters<HangingTitleSign['attachMenu']>[0], mode);
  return { sign, board, chains, attach };
}

describe('hanging sign menu integration', () => {
  it('keeps the menu on the moving board and behind the title logo', () => {
    const f = setup();
    const menu = new FakeNode();
    f.attach(menu, 'main');
    expect(f.board.children).toContain(menu);
    expect(f.board.visible).toBe(false);
    expect(f.sign.isReady).toBe(false);
    f.sign.update(1472);
    expect(f.board.angle).toBeCloseTo(5.5);
    expect(f.board.y).toBeCloseTo(132);
    expect(menu.y).toBe(20);
    expect(f.chains[0].depth).toBeLessThan(f.board.depth);
    expect(f.board.depth).toBeLessThan(100);
  });
  it('preserves settled main and settings positions without replaying the drop', () => {
    const f = setup();
    const main = new FakeNode();
    f.attach(main, 'main');
    f.sign.update(3000);
    expect(f.board.x + main.x).toBe(240);
    expect(f.board.y + main.y).toBe(150);
    const settings = new FakeNode();
    f.attach(settings, 'settings');
    expect(f.board.y + settings.y).toBe(80);
    expect(f.sign.isReady).toBe(true);
    f.attach(main, 'main');
    expect(f.board.y + main.y).toBe(150);
    expect(f.board.angle).toBe(0);
    expect(f.sign.isReady).toBe(true);
  });
  it('starts a new entrance for a new title instance', () => {
    const previous = setup();
    previous.sign.update(10000);
    const next = setup();
    expect(previous.sign.isReady).toBe(true);
    expect(next.sign.isReady).toBe(false);
    expect(next.board.visible).toBe(false);
  });
});
