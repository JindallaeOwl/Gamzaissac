import { ENEMY_DEFINITIONS } from '../data/enemies';
import { formatItemNumber } from '../data/items';
import { catalogEntryId, catalogEntryNumber, ITEM_CATALOG } from '../data/itemCatalog';
import { TOTAL_FLOORS } from '../data/stages';

export interface DeveloperConsoleSuggestion {
  completion: string;
  label: string;
}

const COMMAND_SUGGESTIONS: readonly DeveloperConsoleSuggestion[] = [
  { completion: 'help', label: 'help — 명령어 목록' },
  { completion: 'items', label: 'items — 아이템 번호와 ID 목록' },
  { completion: 'god', label: 'god — 무적 켜기/끄기' },
  { completion: 'heal', label: 'heal — 체력 완전 회복' },
  { completion: 'coin ', label: 'coin <수량> — 코인 추가' },
  { completion: 'key ', label: 'key <수량> — 열쇠 추가' },
  { completion: 'bomb ', label: 'bomb <수량> — 폭탄 추가' },
  { completion: 'kill', label: 'kill — 현재 방 적 처치' },
  { completion: 'boss', label: 'boss — 보스방 이동' },
  { completion: 'shop', label: 'shop — 상점방 이동' },
  { completion: 'treasure', label: 'treasure — 보물방 이동' },
  { completion: 'spawn ', label: 'spawn <번호 또는 ID> — 대상 생성' },
  { completion: 'enemy ', label: 'enemy <적 ID> — 현재 방에 적 생성' },
  { completion: 'sale', label: 'sale — 상점 상품 할인' },
  { completion: 'floor ', label: `floor <층> — 지정한 층으로 이동 (1~${TOTAL_FLOORS})` },
  { completion: 'clear', label: 'clear — 콘솔 출력 지우기' },
];

const SPECIAL_SPAWN_TARGETS: readonly DeveloperConsoleSuggestion[] = [
  { completion: 'spawn chest', label: 'spawn chest — 닫힌 상자' },
  { completion: 'spawn coin', label: 'spawn coin — 노란색 1코인' },
  { completion: 'spawn five-coin', label: 'spawn five-coin — 회색 5코인' },
  { completion: 'spawn heart', label: 'spawn heart — 회복 하트' },
];

export function getDeveloperConsoleSuggestions(
  rawInput: string,
  limit = 8,
): DeveloperConsoleSuggestion[] {
  const input = rawInput.trimStart().toLowerCase();

  if (!input) {
    return [];
  }

  if (!input.includes(' ')) {
    return COMMAND_SUGGESTIONS.filter((suggestion) =>
      suggestion.completion.trimEnd().startsWith(input),
    )
      .filter((suggestion) => suggestion.completion !== input)
      .slice(0, limit);
  }

  const [command, ...argumentParts] = input.split(/\s+/);

  if (command === 'enemy') {
    const argument = argumentParts.join(' ');

    return Object.values(ENEMY_DEFINITIONS)
      .filter((definition) => !argument || definition.id.toLowerCase().startsWith(argument))
      .map((definition) => ({
        completion: `enemy ${definition.id}`,
        label: `enemy ${definition.id} — ${definition.displayName}`,
      }))
      .slice(0, limit);
  }

  if (command !== 'spawn') {
    return [];
  }

  const argument = argumentParts.join(' ');
  // 패시브와 액티브를 함께 제안한다 (ITEM_CATALOG는 번호순으로 정렬되어 있다).
  const itemSuggestions = ITEM_CATALOG.flatMap((entry) => {
    const itemNumber = catalogEntryNumber(entry);
    const id = catalogEntryId(entry);
    const number = itemNumber.toString().padStart(3, '0');
    const label = `${formatItemNumber(itemNumber)}  ${id}`;
    const suggestions: DeveloperConsoleSuggestion[] = [];

    if (!argument || number.startsWith(argument) || itemNumber.toString() === argument) {
      suggestions.push({ completion: `spawn ${number}`, label });
    }

    if (argument && id.startsWith(argument)) {
      suggestions.push({ completion: `spawn ${id}`, label });
    }

    return suggestions;
  });
  const specialSuggestions = SPECIAL_SPAWN_TARGETS.filter((suggestion) => {
    const target = suggestion.completion.slice('spawn '.length);
    return !argument || target.startsWith(argument);
  });

  return [...specialSuggestions, ...itemSuggestions]
    .filter((suggestion) => suggestion.completion !== input)
    .slice(0, limit);
}
