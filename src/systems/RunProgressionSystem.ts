import { TOTAL_FLOORS } from '../data/stages';
import { isRunEnded, type RunState } from './RunState';

export interface FloorAdvanceResult {
  previousFloor: number;
  nextFloor: number;
  healthRecovered: number;
}

// 층 출구에 들어갔을 때의 판정 결과.
// - advance: 다음 층으로 이동 (기존 층 이동·회복 동작)
// - run-clear: 최종층 탈출 — outcome을 'escaped'로 확정한다. 화면 연출은
//   GameScene의 startEscapeSequence가 담당한다 (판정과 연출의 분리).
// - ignored: 이미 런이 끝난 상태(defeated/escaped) — 아무것도 바꾸지 않는다.
export type FloorExitOutcome =
  ({ kind: 'advance' } & FloorAdvanceResult) | { kind: 'run-clear' } | { kind: 'ignored' };

export function resolveFloorExit(runState: RunState): FloorExitOutcome {
  // 1) 이미 종료된 런은 층 값과 무관하게 무시한다.
  if (isRunEnded(runState)) {
    return { kind: 'ignored' };
  }

  // 2) 진행 중인데 층 값이 범위 밖이면 상태를 바꾸지 않고 명시적으로 실패한다.
  //    (floor >= TOTAL_FLOORS로 판정하면 9층·99층도 탈출로 처리되므로 금지.)
  if (!Number.isInteger(runState.floor) || runState.floor < 1 || runState.floor > TOTAL_FLOORS) {
    throw new Error(`Invalid floor: ${runState.floor} (expected an integer in 1-${TOTAL_FLOORS})`);
  }

  // 3) 정확히 최종층일 때만 탈출로 확정한다.
  if (runState.floor === TOTAL_FLOORS) {
    runState.outcome = 'escaped';
    return { kind: 'run-clear' };
  }

  // 4) 그 외 1..TOTAL_FLOORS-1은 다음 층으로.
  return { kind: 'advance', ...advanceRunToNextFloor(runState) };
}

export function advanceRunToNextFloor(runState: RunState): FloorAdvanceResult {
  const previousFloor = runState.floor;
  const healthBefore = runState.stats.health;

  runState.floor += 1;
  runState.stats.health = Math.min(runState.stats.maxHealth, runState.stats.health + 1);

  return {
    previousFloor,
    nextFloor: runState.floor,
    healthRecovered: runState.stats.health - healthBefore,
  };
}
