import { describe, expect, it } from 'vitest';
import { TITLE_SIGN_TUNING } from '../src/config/gameConfig';
import {
  getTitleChainPoints,
  getTitleSignHook,
  getTitleSignPose,
} from '../src/systems/TitleSignRules';

const pose = (time: number) => getTitleSignPose(time, TITLE_SIGN_TUNING);
const catchTime = TITLE_SIGN_TUNING.delayMs + TITLE_SIGN_TUNING.dropMs;

describe('hanging title sign entrance', () => {
  it('waits one second offscreen without accepting menu actions', () => {
    for (const time of [-1, 0, 999]) {
      expect(pose(time)).toMatchObject({ visible: false, ready: false, y: -255 });
    }
    expect(pose(1000)).toMatchObject({ visible: true, ready: false, y: -255 });
  });
  it('accelerates downward and only enables the menu when the chains catch it', () => {
    const firstHalf = pose(1220).y - pose(1000).y;
    const secondHalf = pose(1440).y - pose(1220).y;
    expect(secondHalf).toBeGreaterThan(firstHalf * 2);
    expect(pose(1439).ready).toBe(false);
    expect(pose(1440)).toMatchObject({ ready: true, y: 0 });
  });
  it('uses small vertical recoil and uneven double catches instead of a large spring bounce', () => {
    for (let time = 0; time <= 1150; time += 5) {
      expect(pose(catchTime + time).y).toBeGreaterThanOrEqual(-4.5);
      expect(pose(catchTime + time).y).toBeLessThanOrEqual(2);
    }
    expect(pose(catchTime + 32).angle).toBeCloseTo(5.5);
    expect(pose(catchTime + 82).angle).toBeCloseTo(3.8);
    expect(pose(catchTime + 146).angle).toBeCloseTo(-3.2);
    expect(pose(catchTime + 171).angle).toBeCloseTo(-4.2);
    expect(pose(catchTime + 278).angle).toBeCloseTo(1.8);
  });
  it('kicks immediately after a catch, then accelerates into the next catch', () => {
    const kickStart = pose(catchTime + 37).y - pose(catchTime + 32).y;
    const kickEnd = pose(catchTime + 82).y - pose(catchTime + 77).y;
    expect(Math.abs(kickStart)).toBeGreaterThan(Math.abs(kickEnd) * 4);
    const fallStart = pose(catchTime + 87).y - pose(catchTime + 82).y;
    const fallEnd = pose(catchTime + 146).y - pose(catchTime + 141).y;
    expect(fallEnd).toBeGreaterThan(fallStart * 4);
  });
  it('settles exactly at the original location without residual drift or replay', () => {
    for (const time of [2890, 10000, 3600000]) {
      expect(pose(time)).toEqual({ x: 0, y: 0, angle: 0, visible: true, ready: true });
    }
    expect(pose(0).ready).toBe(false);
  });
  it('stays continuous at every impact and rebound boundary', () => {
    for (const frame of TITLE_SIGN_TUNING.settleFrames) {
      const before = pose(catchTime + frame.time - 0.01);
      const after = pose(catchTime + frame.time);
      expect(Math.abs(after.y - before.y)).toBeLessThan(0.02);
      expect(Math.abs(after.angle - before.angle)).toBeLessThan(0.01);
    }
  });
});

describe('chains follow both attachment points', () => {
  it('keeps the resting hooks at the top corners and follows a tilted board', () => {
    expect(getTitleSignHook({ x: 240, y: 130 }, -68, 3, 0)).toEqual({ x: 172, y: 133 });
    const left = getTitleSignHook({ x: 240, y: 130 }, -68, 3, 5);
    const right = getTitleSignHook({ x: 240, y: 130 }, 68, 3, 5);
    expect(left.y).toBeLessThan(right.y);
    expect(Math.hypot(right.x - left.x, right.y - left.y)).toBeCloseTo(136);
  });
  it('attaches chain ends exactly and bows the middle during upward recoil', () => {
    const anchor = { x: 100, y: -10 };
    const hook = { x: 100, y: 130 };
    const taut = getTitleChainPoints(anchor, hook, 0, 1);
    const slack = getTitleChainPoints(anchor, hook, 10, 1);
    expect(slack[0]).toEqual(anchor);
    expect(slack.at(-1)?.x).toBeCloseTo(hook.x);
    expect(slack.at(-1)?.y).toBe(hook.y);
    expect(taut.every((point) => point.x === 100)).toBe(true);
    expect(Math.max(...slack.map((point) => point.x))).toBeGreaterThan(109);
    const opposite = getTitleChainPoints(anchor, hook, 10, -1);
    expect(Math.min(...opposite.map((point) => point.x))).toBeLessThan(91);
  });
  it('handles coincident endpoints without invalid coordinates', () => {
    expect(getTitleChainPoints({ x: 0, y: 0 }, { x: 0, y: 0 }, 0, 1)).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ]);
  });
});
