import type { ItemDropSource } from './items';

/**
 * 액티브 아이템 — 슬롯에 하나만 들고 다니며 Space로 직접 발동한다.
 *
 * 패시브(줍기만 하면 계속 적용)와 달리 **언제 쓸지 고르는 것**이 재미의 축이다.
 * 충전은 방을 클리어할 때마다 한 칸씩 차고, 다 차야 쓸 수 있으며 쓰면 0이 된다.
 * 강한 효과일수록 필요한 방 수가 많다.
 *
 * `itemNumber`는 패시브와 같은 목록을 쓴다(패시브 1~36에 이어 37번부터). 개발자
 * 콘솔의 번호 지정과 아이템 선택기가 두 종류를 한 체계로 다루기 위해서다.
 */
export type ActiveItemId =
  'potato-sprout' | 'water-cannon' | 'seedling-allies' | 'root-whip' | 'dust-sack' | 'lucky-eye';

/**
 * 발동이 즉시 끝나는가, 아니면 플레이어가 이어서 조작해야 하는가.
 *
 * - `instant`: 누르는 순간 효과가 끝난다 (회복·방사·상자 생성 등)
 * - `armed`: 발동은 "장전"이고, 이어지는 조작으로 완성된다 (물총포)
 * - `summon`: 동료를 불러내고 그들이 스스로 행동한다
 *
 * 씬 코드가 아이템 id로 분기하지 않고 이 종류로 분기하도록 두어, 같은 종류의
 * 아이템이 늘어나도 배선이 그대로다.
 */
export type ActiveItemKind = 'instant' | 'armed' | 'summon';

export interface ActiveItemDefinition {
  itemNumber: number;
  id: ActiveItemId;
  kind: ActiveItemKind;
  nameKey: string;
  descriptionKey: string;
  tint: number;
  /** 발동에 필요한 방 클리어 수. 클수록 강한 효과다. */
  chargeCost: number;
  dropSources: readonly ItemDropSource[];
}

export const ACTIVE_ITEMS: readonly ActiveItemDefinition[] = [
  {
    itemNumber: 37,
    id: 'potato-sprout',
    kind: 'instant',
    nameKey: 'activeItems.potatoSprout.name',
    descriptionKey: 'activeItems.potatoSprout.description',
    tint: 0x7ed98a,
    // 하트 한 칸은 이 게임에서 가장 큰 즉시 이득이다(피격 두 번을 되돌린다).
    // 그래서 6방으로 가장 길게 잡았다 — 한 층에 한 번 쓸까 말까다.
    chargeCost: 6,
    dropSources: ['treasure', 'shop'],
  },
  {
    itemNumber: 38,
    id: 'water-cannon',
    kind: 'armed',
    nameKey: 'activeItems.waterCannon.name',
    descriptionKey: 'activeItems.waterCannon.description',
    tint: 0x5fc8ec,
    chargeCost: 4,
    // 효과는 2단계에서 만든다. 그 전까지 떨어지면 열쇠를 쓰고 아무것도
    // 못 하는 아이템을 받는 데다, 슬롯의 멀쩡한 아이템까지 밀려난다.
    dropSources: [],
  },
  {
    itemNumber: 39,
    id: 'seedling-allies',
    kind: 'summon',
    nameKey: 'activeItems.seedlingAllies.name',
    descriptionKey: 'activeItems.seedlingAllies.description',
    tint: 0xd8a765,
    chargeCost: 4,
    // 효과는 2단계에서 만든다. 그 전까지 떨어지면 열쇠를 쓰고 아무것도
    // 못 하는 아이템을 받는 데다, 슬롯의 멀쩡한 아이템까지 밀려난다.
    dropSources: [],
  },
  {
    itemNumber: 40,
    id: 'root-whip',
    kind: 'instant',
    nameKey: 'activeItems.rootWhip.name',
    descriptionKey: 'activeItems.rootWhip.description',
    tint: 0x9c6a2e,
    // 가장 싸다. 씨앗을 사방으로 뿌릴 뿐이라 화력은 플레이어 빌드에 비례하고,
    // 그래서 자주 써도 런을 깨지 않는다.
    chargeCost: 2,
    dropSources: ['combat', 'treasure', 'shop'],
  },
  {
    itemNumber: 41,
    id: 'dust-sack',
    kind: 'instant',
    nameKey: 'activeItems.dustSack.name',
    descriptionKey: 'activeItems.dustSack.description',
    tint: 0xd9c08a,
    // 회복이 없는 순수 위기탈출이다. 감자 새싹과 역할이 겹치지 않게 일부러 뺐다.
    chargeCost: 3,
    dropSources: ['combat', 'treasure', 'shop'],
  },
  {
    itemNumber: 42,
    id: 'lucky-eye',
    kind: 'instant',
    nameKey: 'activeItems.luckyEye.name',
    descriptionKey: 'activeItems.luckyEye.description',
    tint: 0xffd166,
    chargeCost: 4,
    dropSources: ['treasure', 'shop'],
  },
];

/**
 * 슬롯 교체로 밀려난 아이템이 다시 주울 수 있게 되는 이격 거리.
 * 교체는 플레이어가 선 자리에 아이템을 놓으므로, 벗어나기 전에는 잠가 둔다.
 */
export const ACTIVE_ITEM_SWAP_ARM_DISTANCE = 30;

/** 흙먼지 자루가 걸어 주는 무적 시간. */
export const DUST_SACK_INVULNERABLE_MS = 3000;

/** 뿌리 채찍이 사방으로 뿌리는 씨앗 수. */
export const ROOT_WHIP_SEED_COUNT = 12;

/** 감자 새싹이 회복하는 체력(반 칸 단위이므로 2 = 하트 한 칸). */
export const POTATO_SPROUT_HEAL_UNITS = 2;

export function findActiveItem(id: string): ActiveItemDefinition | undefined {
  return ACTIVE_ITEMS.find((item) => item.id === id);
}

/**
 * 번호 또는 영문 id로 액티브 아이템을 찾는다. 패시브의 `findItemByReference`와
 * 짝을 이루며, 개발자 콘솔과 아이템 선택기가 두 종류를 같은 방식으로 다룬다.
 */
export function findActiveItemByReference(reference: string): ActiveItemDefinition | undefined {
  if (/^\d+$/.test(reference)) {
    const itemNumber = Number(reference);
    return ACTIVE_ITEMS.find((item) => item.itemNumber === itemNumber);
  }

  return findActiveItem(reference);
}
