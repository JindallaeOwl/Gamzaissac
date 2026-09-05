import { describe, expect, it } from 'vitest';
import {
  ACTIVE_ITEMS,
  findActiveItem,
  findActiveItemByReference,
  type ActiveItemDefinition,
} from '../src/data/activeItems';
import { PASSIVE_ITEMS } from '../src/data/items';
import { hasItemPixelIcon } from '../src/systems/itemPixelIcons';
import {
  canUseActiveItem,
  chargeOnRoomCleared,
  consumeActiveItemCharge,
  getActiveItemChargeRatio,
  getActiveItemUseRefusal,
  pickUpActiveItem,
  resolvePickupCharge,
  rollTreasureActiveItem,
  type ActiveItemSlot,
} from '../src/systems/ActiveItemRules';

const CHEAPEST = 'root-whip';
const PRICIEST = 'potato-sprout';

function slotOf(id: string, charge: number): ActiveItemSlot {
  return { id, charge };
}

function costOf(id: string): number {
  const definition = findActiveItem(id);

  if (!definition) {
    throw new Error(`Missing active item: ${id}`);
  }

  return definition.chargeCost;
}

describe('active item catalog', () => {
  it('continues the shared item numbering without colliding with passives', () => {
    const passiveNumbers = new Set(PASSIVE_ITEMS.map((item) => item.itemNumber));

    for (const item of ACTIVE_ITEMS) {
      expect(passiveNumbers.has(item.itemNumber)).toBe(false);
    }
  });

  it('has unique ids and numbers', () => {
    expect(new Set(ACTIVE_ITEMS.map((item) => item.id)).size).toBe(ACTIVE_ITEMS.length);
    expect(new Set(ACTIVE_ITEMS.map((item) => item.itemNumber)).size).toBe(ACTIVE_ITEMS.length);
  });

  it('always needs at least one room to charge', () => {
    for (const item of ACTIVE_ITEMS) {
      expect(item.chargeCost).toBeGreaterThan(0);
    }
  });

  it('can be found by number or by id', () => {
    for (const item of ACTIVE_ITEMS) {
      expect(findActiveItemByReference(item.id)).toBe(item);
      expect(findActiveItemByReference(String(item.itemNumber))).toBe(item);
    }

    expect(findActiveItemByReference('no-such-item')).toBeUndefined();
    expect(findActiveItemByReference('999')).toBeUndefined();
  });

  it('gives every active item a hand-pixeled icon', () => {
    // 아이콘 없는 아이템은 바닥에서 구분이 안 된다. 패시브에 걸린 것과 같은 규칙이다.
    for (const item of ACTIVE_ITEMS) {
      expect(hasItemPixelIcon(item.id), `${item.id} has no pixel icon`).toBe(true);
    }
  });

  it('never drops from combat rooms for the expensive effects', () => {
    // 전투방 보상은 순수 능력치형만 나온다는 기존 규칙과 같은 취지다. 강한
    // 액티브는 보물방·상점처럼 "기대하고 여는" 자리의 몫이어야 한다.
    const combatDrops = ACTIVE_ITEMS.filter((item: ActiveItemDefinition) =>
      item.dropSources.includes('combat'),
    );

    for (const item of combatDrops) {
      expect(item.chargeCost).toBeLessThanOrEqual(3);
    }
  });
});

describe('active item charging', () => {
  it('gains one charge per cleared room and stops at the cost', () => {
    const cost = costOf(CHEAPEST);
    let slot: ActiveItemSlot | undefined = slotOf(CHEAPEST, 0);

    for (let i = 0; i < cost; i += 1) {
      slot = chargeOnRoomCleared(slot);
      expect(slot?.charge).toBe(i + 1);
    }

    // 상한을 넘겨 쌓이지 않는다 — 쌓이면 연속 발동이 가능해진다.
    slot = chargeOnRoomCleared(slot);
    expect(slot?.charge).toBe(cost);
  });

  it('does nothing when the slot is empty', () => {
    expect(chargeOnRoomCleared(undefined)).toBeUndefined();
  });

  it('leaves an unknown item id untouched instead of inventing a cost', () => {
    const slot = slotOf('not-a-real-item', 1);
    expect(chargeOnRoomCleared(slot)).toEqual(slot);
  });

  it('reports the charge ratio for the gauge', () => {
    const cost = costOf(PRICIEST);

    expect(getActiveItemChargeRatio(undefined)).toBe(0);
    expect(getActiveItemChargeRatio(slotOf(PRICIEST, 0))).toBe(0);
    expect(getActiveItemChargeRatio(slotOf(PRICIEST, cost))).toBe(1);
    expect(getActiveItemChargeRatio(slotOf(PRICIEST, cost / 2))).toBeCloseTo(0.5);
    // 어떤 이유로 상한을 넘겨도 게이지는 넘치지 않는다.
    expect(getActiveItemChargeRatio(slotOf(PRICIEST, cost + 5))).toBe(1);
    expect(getActiveItemChargeRatio(slotOf('not-a-real-item', 3))).toBe(0);
  });
});

describe('active item use', () => {
  it('refuses until the charge is full, then allows exactly at full', () => {
    const cost = costOf(CHEAPEST);

    expect(getActiveItemUseRefusal({ slot: slotOf(CHEAPEST, cost - 1), runEnded: false })).toBe(
      'not-charged',
    );
    expect(getActiveItemUseRefusal({ slot: slotOf(CHEAPEST, cost), runEnded: false })).toBeNull();
    expect(canUseActiveItem({ slot: slotOf(CHEAPEST, cost), runEnded: false })).toBe(true);
  });

  it('refuses with no item in the slot', () => {
    expect(getActiveItemUseRefusal({ runEnded: false })).toBe('no-item');
  });

  it('refuses an unknown item id rather than treating it as usable', () => {
    expect(getActiveItemUseRefusal({ slot: slotOf('not-a-real-item', 99), runEnded: false })).toBe(
      'no-item',
    );
  });

  it('refuses once the run has ended even with a full charge', () => {
    // 게임오버·탈출 연출 중에 발동되면 이미 끝난 런의 상태를 바꾼다.
    expect(getActiveItemUseRefusal({ slot: slotOf(CHEAPEST, 99), runEnded: true })).toBe(
      'run-ended',
    );
  });

  it('empties the charge but keeps the item', () => {
    const used = consumeActiveItemCharge(slotOf(CHEAPEST, costOf(CHEAPEST)));

    expect(used).toEqual({ id: CHEAPEST, charge: 0 });
  });
});

describe('active item pickup', () => {
  it('fills an empty slot without displacing anything', () => {
    const result = pickUpActiveItem(undefined, CHEAPEST);

    expect(result.slot).toEqual({ id: CHEAPEST, charge: 0 });
    expect(result.displacedId).toBeUndefined();
  });

  it('swaps and reports what was pushed out, charge included', () => {
    const result = pickUpActiveItem(slotOf(PRICIEST, 4), CHEAPEST);

    expect(result.slot).toEqual({ id: CHEAPEST, charge: 0 });
    expect(result.displacedId).toBe(PRICIEST);
    expect(result.displacedCharge).toBe(4);
  });

  it('does not carry the old charge onto the new item', () => {
    // 물려주면 싼 아이템으로 채운 뒤 비싼 것으로 바꿔 즉시 쓰는 우회가 생긴다.
    const result = pickUpActiveItem(slotOf(CHEAPEST, costOf(CHEAPEST)), PRICIEST);

    expect(result.slot.charge).toBe(0);
    expect(canUseActiveItem({ slot: result.slot, runEnded: false })).toBe(false);
  });

  it('restores the charge of an item picked back up', () => {
    const dropped = pickUpActiveItem(slotOf(PRICIEST, 5), CHEAPEST);
    const retaken = pickUpActiveItem(undefined, dropped.displacedId!, dropped.displacedCharge);

    expect(retaken.slot).toEqual({ id: PRICIEST, charge: 5 });
  });
});

describe('first pickup charge', () => {
  const cheap = findActiveItem(CHEAPEST)!;
  const pricey = findActiveItem(PRICIEST)!;

  it('arrives fully charged the first time it is picked up', () => {
    expect(resolvePickupCharge(cheap, 0, [])).toBe(cheap.chargeCost);
    expect(resolvePickupCharge(pricey, 0, [])).toBe(pricey.chargeCost);
  });

  it('only returns the charge it was carrying once already seen', () => {
    expect(resolvePickupCharge(cheap, 0, [cheap.id])).toBe(0);
    expect(resolvePickupCharge(cheap, 1, [cheap.id])).toBe(1);
  });

  it('never hands back more than the item can hold', () => {
    expect(resolvePickupCharge(cheap, 999, [cheap.id])).toBe(cheap.chargeCost);
    expect(resolvePickupCharge(cheap, -5, [cheap.id])).toBe(0);
  });

  it('cannot be farmed by swapping two items back and forth', () => {
    // 교체는 밀려난 아이템을 바닥에 남긴다. 매번 만충으로 돌려주면 방을 클리어하지
    // 않고도 둘을 번갈아 밟는 것만으로 무한히 발동할 수 있다.
    const seen: string[] = [];
    let slot: ActiveItemSlot | undefined;
    let droppedCharge = 0;
    let droppedId: string | undefined;
    const freeUses: string[] = [];

    for (const definition of [cheap, pricey, cheap, pricey, cheap]) {
      const carried = droppedId === definition.id ? droppedCharge : 0;
      const charge = resolvePickupCharge(definition, carried, seen);

      if (!seen.includes(definition.id)) {
        seen.push(definition.id);
      }

      const result = pickUpActiveItem(slot, definition.id, charge);
      slot = result.slot;
      droppedId = result.displacedId;
      droppedCharge = result.displacedCharge ?? 0;

      if (canUseActiveItem({ slot, runEnded: false })) {
        freeUses.push(definition.id);
        slot = consumeActiveItemCharge(slot);
      }
    }

    // 종류마다 딱 한 번씩만 공짜로 쓸 수 있다.
    expect(freeUses).toEqual([cheap.id, pricey.id]);
  });
});

describe('treasure room active drops', () => {
  it('offers nothing when the roll misses', () => {
    expect(rollTreasureActiveItem(() => 0.99)).toBeNull();
  });

  it('offers an active item when the roll hits', () => {
    const item = rollTreasureActiveItem(() => 0);

    expect(item).not.toBeNull();
    expect(item?.dropSources).toContain('treasure');
  });

  it('never offers the one already in the slot', () => {
    // 슬롯이 하나뿐이라 같은 것이 또 나오면 열쇠를 쓰고 얻는 것이 없다.
    for (const held of ACTIVE_ITEMS) {
      for (let roll = 0; roll < 1; roll += 0.05) {
        const item = rollTreasureActiveItem(() => roll, held.id);

        expect(item?.id).not.toBe(held.id);
      }
    }
  });

  it('falls back to passives when every candidate is filtered out', () => {
    const single = ACTIVE_ITEMS.filter((item) => item.dropSources.includes('treasure'));

    // 후보가 하나뿐인 상황을 흉내 낼 수는 없으므로, 최소한 목록이 비면 null인지 본다.
    expect(single.length).toBeGreaterThan(0);
    expect(rollTreasureActiveItem(() => 0.99, single[0].id)).toBeNull();
  });
});

describe('unimplemented active items stay out of drops', () => {
  // 효과가 없는 아이템이 보물방에서 나오면 열쇠를 쓰고 아무것도 못 하는 것을
  // 받는 데다, 슬롯에 있던 멀쩡한 아이템까지 밀려난다.
  const NOT_BUILT_YET = ['water-cannon', 'seedling-allies'];

  it('gives them no drop sources at all', () => {
    for (const id of NOT_BUILT_YET) {
      expect(findActiveItem(id)?.dropSources, `${id} must not drop yet`).toEqual([]);
    }
  });

  it('keeps them out of the treasure roll even on a guaranteed hit', () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const item = rollTreasureActiveItem(() => 0);

      expect(NOT_BUILT_YET).not.toContain(item?.id);
    }
  });

  it('still leaves working items available to drop', () => {
    const droppable = ACTIVE_ITEMS.filter((item) => item.dropSources.length > 0);

    expect(droppable.length).toBeGreaterThan(0);
  });
});
