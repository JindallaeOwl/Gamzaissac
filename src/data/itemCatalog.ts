import { ACTIVE_ITEMS, findActiveItemByReference, type ActiveItemDefinition } from './activeItems';
import { findItemByReference, PASSIVE_ITEMS, type PassiveItemDefinition } from './items';

/**
 * 패시브와 액티브를 한 목록으로 묶는다.
 *
 * 개발자 콘솔의 `spawn`·`items`, 자동완성, F2 아이템 선택기, 바닥 픽업은 모두
 * "아이템 하나"를 다루면 될 뿐 그것이 어느 종류인지 알 필요가 없다. 각자
 * `PASSIVE_ITEMS`와 `ACTIVE_ITEMS`를 따로 훑으면 새 종류가 늘 때마다 네 곳을
 * 똑같이 고쳐야 하고, 한 곳을 빠뜨리면 "콘솔로는 되는데 F2에는 안 보이는" 어긋남이
 * 생긴다. 그래서 목록과 조회를 여기 한 곳에 둔다.
 */

export interface PassiveCatalogEntry {
  kind: 'passive';
  definition: PassiveItemDefinition;
}

export interface ActiveCatalogEntry {
  kind: 'active';
  definition: ActiveItemDefinition;
}

export type CatalogEntry = PassiveCatalogEntry | ActiveCatalogEntry;

export function passiveEntry(definition: PassiveItemDefinition): PassiveCatalogEntry {
  return { kind: 'passive', definition };
}

export function activeEntry(definition: ActiveItemDefinition): ActiveCatalogEntry {
  return { kind: 'active', definition };
}

/** 번호순으로 정렬한 전체 목록. 패시브 1~36 다음에 액티브 37~ 이 온다. */
export const ITEM_CATALOG: readonly CatalogEntry[] = [
  ...PASSIVE_ITEMS.map(passiveEntry),
  ...ACTIVE_ITEMS.map(activeEntry),
].sort((left, right) => left.definition.itemNumber - right.definition.itemNumber);

/**
 * 번호("013")나 영문 id("prism-lance")로 찾는다.
 *
 * 패시브를 먼저 보고 없으면 액티브를 본다. 번호는 두 목록에 걸쳐 유일하므로
 * (테스트가 강제한다) 순서가 결과를 바꾸지 않는다.
 */
export function findCatalogEntry(reference: string): CatalogEntry | undefined {
  const passive = findItemByReference(reference);

  if (passive) {
    return passiveEntry(passive);
  }

  const active = findActiveItemByReference(reference);

  return active ? activeEntry(active) : undefined;
}

export function catalogEntryId(entry: CatalogEntry): string {
  return entry.definition.id;
}

export function catalogEntryNumber(entry: CatalogEntry): number {
  return entry.definition.itemNumber;
}

export function catalogEntryNameKey(entry: CatalogEntry): string {
  return entry.definition.nameKey;
}

export function catalogEntryDescriptionKey(entry: CatalogEntry): string {
  return entry.definition.descriptionKey;
}
