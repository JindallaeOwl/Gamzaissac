import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const touchControlsSource = readFileSync(
  new URL('../src/ui/TouchControls.ts', import.meta.url),
  'utf8',
);

// TouchControls가 실제로 찾는 id를 소스에서 뽑아낸다. 목록을 손으로 적어 두면 새 버튼을
// 추가할 때 빼먹어도 검사가 통과한다. findTouchControlElements는 하나라도 없으면 null을
// 돌려주고, 그러면 터치 조작 전체가 조용히 사라진다 — 반드시 막아야 하는 실패다.
const wiredIds = [
  ...touchControlsSource.matchAll(/querySelector<[^>]+>\(\s*'#([\w-]+)'\s*\)/g),
].map((match) => match[1]);
const stickPng = readFileSync(
  new URL('../public/assets/ui/vryell/touch-stick.png', import.meta.url),
);

describe('mobile touch control assets', () => {
  it('ships only the cropped 16x16 stick tile used by both virtual sticks', () => {
    expect(stickPng.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect(stickPng.readUInt32BE(16)).toBe(16);
    expect(stickPng.readUInt32BE(20)).toBe(16);
    expect(index.match(/\/assets\/ui\/vryell\/touch-stick\.png/g)).toHaveLength(2);
  });

  it('extracts every querySelector call, so none can slip past the coverage check', () => {
    // 정규식이 호출 하나를 놓치면 그 요소는 아래 검사에서 그대로 빠진다. 임의의 최소
    // 개수로는 그걸 못 잡으므로(줄바꿈 하나로 조용히 줄어든다), 서식과 무관한 단순
    // 등장 횟수와 뽑아낸 개수가 정확히 같은지를 본다.
    const callCount = (touchControlsSource.match(/querySelector/g) ?? []).length;

    expect(wiredIds.length).toBe(callCount);
    expect(wiredIds).toContain('touch-controls');
    expect(wiredIds).toContain('touch-active-item');
  });

  it('contains every DOM control that TouchControls wires', () => {
    for (const id of wiredIds) {
      expect(
        index.match(new RegExp(`id="${id}"`, 'g')),
        `${id} must exist exactly once`,
      ).toHaveLength(1);
    }

    expect(index).not.toContain('id="touch-minimap"');
  });

  it('disables browser gestures on sticks and supplies a portrait rotation notice', () => {
    expect(styles).toMatch(/\.touch-stick\s*\{[\s\S]*?touch-action:\s*none;/);
    expect(styles).toContain('@media (orientation: portrait)');
    expect(styles).toContain('.touch-orientation-hint');
  });

  it('uses the visible iOS viewport and keeps sticks above the home indicator', () => {
    expect(index).toContain('viewport-fit=cover');
    expect(index).toContain('apple-mobile-web-app-capable');
    expect(styles).toContain('@supports (height: 100dvh)');
    expect(styles).toContain('height: 100dvh');
    expect(styles).toMatch(
      /--touch-bottom-offset:\s*max\(34px,\s*calc\(env\(safe-area-inset-bottom\) \+ 16px\)\)/,
    );
    expect(styles).toMatch(
      /\.touch-stick--movement\s*\{[\s\S]*?bottom:\s*var\(--touch-bottom-offset\)/,
    );
    expect(styles).toMatch(
      /\.touch-fire-cluster\s*\{[\s\S]*?bottom:\s*var\(--touch-bottom-offset\)/,
    );
  });
});
