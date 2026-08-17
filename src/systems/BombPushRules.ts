import { normalizeVector } from '../utils/math';

/**
 * 설치된 폭탄을 밀 때의 수치. 상자(ChestPushRules)와 같은 구조지만 감각이 다르다 —
 * 폭탄은 둥근 공이라 **얼음 위처럼 관성이 조금 남아 미끄러진다**. 그렇다고 스케이트가
 * 되면 조준이 불가능하므로, 한 번 밀 때 미끄러지는 거리를 사람이 눈으로 가늠할 수
 * 있는 범위(몸 두 배 정도)로 묶어 둔다.
 *
 * 미끄러지는 거리 = 속도² / (2 × 감속). 상자는 76²/(2·420) ≈ 7px로 "툭 밀린다"에
 * 가깝고, 폭탄은 감속을 절반 이하로 낮춰 몸으로 밀면 약 24px, 씨앗에 맞으면 약
 * 46px를 흘러간다.
 */

/** 몸으로 밀 때의 초기 속도 */
export const BOMB_BODY_PUSH_SPEED = 96;
/** 씨앗에 맞았을 때의 초기 속도. 날아온 탄이라 몸보다 세게 굴린다 */
export const BOMB_SEED_PUSH_SPEED = 132;
/** 감속(px/s²). 낮을수록 더 미끄럽다 */
export const BOMB_PUSH_DRAG = 190;
/** 벽·장애물에 부딪혔을 때의 반발. 공이라 살짝 튀지만 고무처럼 튀지는 않는다 */
export const BOMB_PUSH_BOUNCE = 0.12;
/**
 * 몸으로 미는 것의 최소 간격. 접촉은 매 프레임 들어오므로, 간격을 두지 않으면
 * 속도가 매 프레임 다시 채워져 감속이 없는 것과 같아진다(관성이 사라진다).
 */
export const BOMB_BODY_PUSH_COOLDOWN_MS = 90;
/**
 * 심은 폭탄이 "밀 수 있는 물체"가 되는 최소 이격 거리.
 *
 * 폭탄은 플레이어 발밑에 생기므로, 처음부터 단단한 물체면 심는 순간 플레이어가
 * 밀려나고 자기 씨앗도 발밑에서 전부 사라진다. 플레이어가 폭탄에서 한 번 벗어난
 * 뒤부터 상호작용을 켜면 그 두 가지가 함께 사라진다.
 */
export const BOMB_PUSH_ARM_DISTANCE = 24;
/**
 * 방에 다시 들어올 때 되살아난 폭탄이 입장 지점에서 최소한 떨어져 있어야 하는 거리.
 *
 * 문 앞에 심어 두면 저장된 자리가 곧 다음 입장 지점이라, 그대로 되살리면 플레이어와
 * 겹친 채 시작한다 — 겹친 동안에는 상호작용이 꺼져 있어(BOMB_PUSH_ARM_DISTANCE)
 * 밀 수도 없다. 그래서 되살릴 때만 방 안쪽으로 조금 밀어 놓는다.
 * 이격 거리가 상호작용이 켜지는 거리보다 커야 되살아난 즉시 밀 수 있다.
 */
export const BOMB_RESTORE_ENTRY_CLEARANCE = 34;

export interface BombPushVelocity {
  x: number;
  y: number;
}

/** 방향이 0이면(정확히 겹쳐 있으면) 밀 방향을 정할 수 없으므로 null. */
export function getBombPushVelocity(x: number, y: number, speed: number): BombPushVelocity | null {
  const direction = normalizeVector(x, y);

  if (direction.x === 0 && direction.y === 0) {
    return null;
  }

  return { x: direction.x * speed, y: direction.y * speed };
}

/** 한 번 밀었을 때 미끄러지는 거리. 튜닝이 "적당히"에서 벗어나지 않는지 재는 용도. */
export function estimateBombSlideDistance(speed: number): number {
  return (speed * speed) / (2 * BOMB_PUSH_DRAG);
}
