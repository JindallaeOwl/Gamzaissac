import { TextureKeys } from '../config/assets';
import type { RoomType } from '../data/rooms';
import { getStageProgress } from '../data/stages';

// 층 출구의 종류: 일반 층은 다음 층으로 오르는 굴, 최종층(8층)은 지상 탈출구.
// 생성과 재입장 복원이 같은 규칙을 쓰도록 한 곳에 모은다.
export type FloorExitKind = 'next-floor' | 'escape';

export function floorExitKindForFloor(floor: number): FloorExitKind {
  return getStageProgress(floor).isFinalFloor ? 'escape' : 'next-floor';
}

export function floorExitTextureKey(kind: FloorExitKind): string {
  return kind === 'escape' ? TextureKeys.floorExitEscape : TextureKeys.floorExit;
}

// 방 재입장 시 출구 복원 판정: 클리어된 보스방에서만 복원하며,
// 복원되는 종류는 현재 층 규칙을 그대로 따른다 (최종층이면 escape).
export function restoredFloorExitKind(
  floor: number,
  roomType: RoomType,
  cleared: boolean,
): FloorExitKind | undefined {
  if (roomType !== 'boss' || !cleared) {
    return undefined;
  }

  return floorExitKindForFloor(floor);
}
