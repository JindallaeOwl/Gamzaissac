import type { ConsumableType } from '../data/rewards';

export type DeveloperCommand =
  | { type: 'help' }
  | { type: 'clear' }
  | { type: 'god' }
  | { type: 'heal' }
  | { type: 'items' }
  | { type: 'add-resource'; resource: ConsumableType; amount: number }
  | { type: 'kill' }
  | { type: 'boss' }
  | { type: 'shop' }
  | { type: 'treasure' }
  | { type: 'spawn'; itemId: string }
  | { type: 'sale' }
  | { type: 'floor'; floor: number };

export type DeveloperCommandParseResult =
  { ok: true; command: DeveloperCommand } | { ok: false; error: string };

export const DEVELOPER_CONSOLE_HELP = [
  'help                 명령어 목록',
  'god                  무적 켜기/끄기',
  'heal                 체력 완전 회복',
  'items                아이템 번호와 ID 목록',
  'coin 20              코인 추가',
  'key 5                열쇠 추가',
  'bomb 5               폭탄 추가',
  'kill                  현재 방의 적 전부 처치',
  'boss                  현재 층의 보스방으로 이동',
  'shop                  현재 층의 상점방으로 이동',
  'treasure              현재 층의 보물방으로 이동',
  'spawn 013            아이템 번호로 생성',
  'spawn prism-lance    영문 ID로 아이템 생성',
  'spawn chest          닫힌 상자 생성',
  'spawn coin           노란색 1코인 생성',
  'spawn five-coin      회색 5코인 생성',
  'sale                  현재 상점 상품 하나 강제 할인',
  'floor 2              지정한 층으로 이동',
  'clear                 콘솔 출력 지우기',
] as const;

const RESOURCE_COMMANDS: Record<string, ConsumableType> = {
  coin: 'coins',
  coins: 'coins',
  key: 'keys',
  keys: 'keys',
  bomb: 'bombs',
  bombs: 'bombs',
};

export function parseDeveloperCommand(input: string): DeveloperCommandParseResult {
  const parts = input.trim().split(/\s+/);
  const name = parts[0]?.toLowerCase() ?? '';
  const args = parts.slice(1);

  if (!name) {
    return { ok: false, error: '명령어를 입력해주세요.' };
  }

  if (
    name === 'help' ||
    name === 'clear' ||
    name === 'god' ||
    name === 'heal' ||
    name === 'items'
  ) {
    return args.length === 0 ? { ok: true, command: { type: name } } : usageError(name);
  }

  if (
    name === 'kill' ||
    name === 'boss' ||
    name === 'shop' ||
    name === 'treasure' ||
    name === 'sale'
  ) {
    return args.length === 0 ? { ok: true, command: { type: name } } : usageError(name);
  }

  const resource = RESOURCE_COMMANDS[name];

  if (resource) {
    const amount = parsePositiveInteger(args[0]);

    if (args.length !== 1 || amount === null) {
      return usageError(`${name} <1~99>`);
    }

    return { ok: true, command: { type: 'add-resource', resource, amount } };
  }

  if (name === 'spawn') {
    if (args.length !== 1 || !args[0]) {
      return usageError('spawn <item-id>');
    }

    return { ok: true, command: { type: 'spawn', itemId: args[0].toLowerCase() } };
  }

  if (name === 'floor') {
    const floor = parsePositiveInteger(args[0]);

    if (args.length !== 1 || floor === null) {
      return usageError('floor <1~99>');
    }

    return { ok: true, command: { type: 'floor', floor } };
  }

  return { ok: false, error: `알 수 없는 명령어: ${name} (help로 목록 확인)` };
}

function parsePositiveInteger(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= 99 ? parsed : null;
}

function usageError(usage: string): DeveloperCommandParseResult {
  return { ok: false, error: `사용법: ${usage}` };
}
