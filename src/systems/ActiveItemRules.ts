import { ACTIVE_ITEMS, findActiveItem, type ActiveItemDefinition } from '../data/activeItems';
import { randomOf, type RandomSource } from '../utils/random';

/**
 * 액티브 아이템 슬롯의 판정 규칙 — 전부 순수 함수다.
 *
 * "쓸 수 있는가 / 충전이 얼마나 찼는가 / 주웠을 때 무엇이 밀려나는가"만 여기서
 * 정하고, 실제 효과 실행과 연출은 GameScene이 맡는다. 판정과 연출을 나눠 두면
 * 이 규칙들을 Phaser 없이 테스트로 고정할 수 있다.
 */

export interface ActiveItemSlot {
  id: string;
  /** 지금까지 채운 칸 수. 0 이상 chargeCost 이하로 유지된다. */
  charge: number;
}

export type ActiveItemUseRefusal = 'no-item' | 'not-charged' | 'run-ended';

export interface ActiveItemUseContext {
  slot?: ActiveItemSlot;
  runEnded: boolean;
}

/** 쓸 수 있으면 null, 아니면 거절 사유. */
export function getActiveItemUseRefusal(
  context: ActiveItemUseContext,
): ActiveItemUseRefusal | null {
  if (context.runEnded) {
    return 'run-ended';
  }

  if (!context.slot) {
    return 'no-item';
  }

  const definition = findActiveItem(context.slot.id);

  // 정의가 없는 id가 슬롯에 들어 있으면 데이터 실수다. 조용히 쓸 수 있다고
  // 답하는 대신 "아이템 없음"으로 막는다.
  if (!definition) {
    return 'no-item';
  }

  return context.slot.charge >= definition.chargeCost ? null : 'not-charged';
}

export function canUseActiveItem(context: ActiveItemUseContext): boolean {
  return getActiveItemUseRefusal(context) === null;
}

/**
 * 방을 클리어했을 때의 충전. 상한을 넘겨 쌓아 두지 않는다 — 넘겨서 쌓으면
 * 연속 발동이 가능해져 "언제 쓸까"라는 판단이 사라진다.
 */
export function chargeOnRoomCleared(slot: ActiveItemSlot | undefined): ActiveItemSlot | undefined {
  if (!slot) {
    return undefined;
  }

  const definition = findActiveItem(slot.id);

  if (!definition) {
    return slot;
  }

  return { ...slot, charge: Math.min(definition.chargeCost, slot.charge + 1) };
}

/** 발동 직후의 슬롯. 아이템은 남고 충전만 비운다. */
export function consumeActiveItemCharge(slot: ActiveItemSlot): ActiveItemSlot {
  return { ...slot, charge: 0 };
}

/**
 * 주울 때 들고 시작할 충전량.
 *
 * **이번 런에서 처음 줍는 아이템은 가득 찬 채로 들어온다** — 주운 자리에서 바로
 * 한 번 써 보게 해 "이게 뭐 하는 물건인지" 알려 주기 위해서다.
 *
 * 두 번째부터는 그 아이템이 바닥에 떨어질 때 안고 있던 충전만 돌려받는다.
 * 이 구분이 없으면 아이템 둘을 번갈아 주웠다 떨어뜨리는 것만으로 만충을 무한히
 * 만들 수 있다 — 슬롯 교체가 밀려난 아이템을 바닥에 남기기 때문에 두 개만 있으면
 * 방을 클리어하지 않고도 계속 발동할 수 있게 된다.
 *
 * 처음 줍는 것만 공짜이므로 한 런에서 얻는 공짜 발동은 **아이템 종류 수만큼**으로
 * 묶인다.
 */
export function resolvePickupCharge(
  definition: ActiveItemDefinition,
  carriedCharge: number,
  seenActiveItemIds: readonly string[],
): number {
  if (!seenActiveItemIds.includes(definition.id)) {
    return definition.chargeCost;
  }

  return Math.min(definition.chargeCost, Math.max(0, carriedCharge));
}

export interface ActiveItemPickupResult {
  slot: ActiveItemSlot;
  /** 슬롯에서 밀려나 바닥에 남는 아이템. 슬롯이 비어 있었으면 없다. */
  displacedId?: string;
  /** 밀려난 아이템이 들고 있던 충전. 다시 주우면 그대로 돌아온다. */
  displacedCharge?: number;
}

/**
 * 액티브 아이템을 주웠을 때.
 *
 * 슬롯은 하나뿐이라 이미 들고 있으면 **교체하고 기존 것을 그 자리에 떨군다**
 * (버리지 않는다 — 다시 주울 수 있어야 바꿔 보는 선택이 성립한다).
 *
 * 들고 시작할 충전은 이 함수가 정하지 않는다. 부르는 쪽이 `resolvePickupCharge`로
 * 먼저 구해 넘긴다 — 교체라는 기계적인 동작과 "얼마나 채워 주는가"라는 정책을
 * 섞지 않기 위해서다. 밀려난 아이템의 충전은 그대로 실려 나가므로, 잘못 바꿨다가
 * 되돌려도 모아 둔 충전을 잃지 않는다.
 */
export function pickUpActiveItem(
  current: ActiveItemSlot | undefined,
  incomingId: string,
  incomingCharge = 0,
): ActiveItemPickupResult {
  const slot: ActiveItemSlot = { id: incomingId, charge: incomingCharge };

  if (!current) {
    return { slot };
  }

  return { slot, displacedId: current.id, displacedCharge: current.charge };
}

/** 충전 게이지 표시용 0~1 비율. 정의가 없으면 0. */
export function getActiveItemChargeRatio(slot: ActiveItemSlot | undefined): number {
  if (!slot) {
    return 0;
  }

  const definition = findActiveItem(slot.id);

  if (!definition || definition.chargeCost <= 0) {
    return 0;
  }

  return Math.min(1, Math.max(0, slot.charge / definition.chargeCost));
}

/** 슬롯에 든 아이템 정의. 없거나 알 수 없는 id면 undefined. */
export function getSlotDefinition(
  slot: ActiveItemSlot | undefined,
): ActiveItemDefinition | undefined {
  return slot ? findActiveItem(slot.id) : undefined;
}

/**
 * 보물방이 패시브 대신 액티브를 낼 확률.
 *
 * 액티브는 6종뿐이라 자주 나오면 금방 다 보게 된다. 반대로 너무 드물면 슬롯이
 * 빈 채로 런이 끝나 시스템 자체가 없는 것과 같아진다. 보물방은 한 층에 하나이고
 * 열쇠를 써야 하므로, 세 번에 한 번쯤이 "가끔 나오는 특별한 것"으로 읽힌다.
 */
export const ACTIVE_ITEM_TREASURE_CHANCE = 0.35;

/**
 * 보물방에서 뽑을 액티브 아이템. 뽑히지 않으면 null이고 기존 패시브 추첨으로 넘어간다.
 *
 * 이미 들고 있는 것은 후보에서 뺀다 — 슬롯이 하나뿐이라 같은 것이 또 나오면
 * 열쇠를 쓰고 얻는 것이 없다. 그래서 후보가 비면 패시브로 넘긴다.
 */
export function rollTreasureActiveItem(
  random: RandomSource,
  heldActiveItemId?: string,
): ActiveItemDefinition | null {
  const pool = ACTIVE_ITEMS.filter(
    (item) => item.dropSources.includes('treasure') && item.id !== heldActiveItemId,
  );

  if (pool.length === 0 || random() >= ACTIVE_ITEM_TREASURE_CHANCE) {
    return null;
  }

  return randomOf(pool, random);
}
