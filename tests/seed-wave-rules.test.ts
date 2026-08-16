import { describe, expect, it } from 'vitest';
import { getWaveAngleOffset, getWaveSign, WAVE_CYCLE_MS } from '../src/systems/SeedWaveRules';

const AMPLITUDE_DEGREES = 35;
const AMPLITUDE_RADIANS = (AMPLITUDE_DEGREES * Math.PI) / 180;

describe('getWaveAngleOffset', () => {
  it('steers nothing when the wave amplitude is zero', () => {
    // 물결 아이템이 없는 기본 상태. 조향이 조금이라도 섞이면 모든 씨앗의
    // 궤적이 바뀌는 회귀다.
    expect(getWaveAngleOffset(123, 0, 1)).toBe(0);
  });

  it('starts exactly on the aim direction', () => {
    // 발사 순간(경과 0ms)은 위상 0이라 조준 방향 그대로여야 한다. 그래야
    // 플레이어가 "내가 쏜 방향으로 나가기 시작한다"를 신뢰할 수 있다.
    expect(getWaveAngleOffset(0, AMPLITUDE_DEGREES, 1)).toBeCloseTo(0);
  });

  it('never deviates more than the wave amplitude', () => {
    for (let elapsed = 0; elapsed <= WAVE_CYCLE_MS * 2; elapsed += 16) {
      expect(Math.abs(getWaveAngleOffset(elapsed, AMPLITUDE_DEGREES, 1))).toBeLessThanOrEqual(
        AMPLITUDE_RADIANS + 1e-9,
      );
    }
  });

  it('reaches the full amplitude a quarter cycle in', () => {
    expect(getWaveAngleOffset(WAVE_CYCLE_MS / 4, AMPLITUDE_DEGREES, 1)).toBeCloseTo(
      AMPLITUDE_RADIANS,
    );
  });

  it('mirrors the path for the opposite phase sign', () => {
    expect(getWaveAngleOffset(120, AMPLITUDE_DEGREES, -1)).toBeCloseTo(
      -getWaveAngleOffset(120, AMPLITUDE_DEGREES, 1),
    );
  });
});

describe('getWaveSign', () => {
  it('alternates between neighbouring seeds in a fan', () => {
    expect(getWaveSign(0)).toBe(1);
    expect(getWaveSign(1)).toBe(-1);
    expect(getWaveSign(2)).toBe(1);
    expect(getWaveSign(3)).toBe(-1);
  });
});
