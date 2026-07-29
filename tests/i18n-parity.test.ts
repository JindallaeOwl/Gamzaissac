import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en';
import { ko } from '../src/i18n/ko';
import type { TranslationTree } from '../src/i18n/types';

// t()는 현재 언어에 키가 없으면 en으로 폴백하고, en에도 없으면 키 문자열을 그대로
// 돌려준다. 그래서 ko에만 추가된 키는 영어 모드에서 'messages.bossPhaseTwo' 같은
// 원시 키가 화면에 그대로 노출된다. TranslationTree가 인덱스 시그니처라 타입 검사로는
// 잡히지 않으므로, 두 사전을 직접 대조해 한쪽만 갱신하는 실수를 여기서 막는다.

function flatten(tree: TranslationTree, prefix = ''): Map<string, string> {
  const entries = new Map<string, string>();

  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      entries.set(path, value);
      continue;
    }

    for (const [nestedPath, nestedValue] of flatten(value, path)) {
      entries.set(nestedPath, nestedValue);
    }
  }

  return entries;
}

// '{score}' 같은 치환 자리표시자의 "이름 집합"을 뽑는다. 같은 파라미터를 문장에서 몇 번
// 쓰는지는 언어마다 자연스럽게 달라지므로('{name}님, 다시 {name}님!' vs 'Hello, {name}!')
// 중복을 제거하고 이름만 비교한다. 판단 기준은 필요한 파라미터가 같은지이지 횟수가 아니다.
function interpolationKeys(value: string): string[] {
  const names = [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);
  return [...new Set(names)].sort();
}

const koEntries = flatten(ko);
const enEntries = flatten(en);

describe('interpolationKeys', () => {
  it('같은 파라미터를 반복해 쓴 문장도 같은 것으로 본다', () => {
    // 아래 두 문장은 모두 {name} 하나만 있으면 되므로 사전 대조에서 통과해야 한다.
    expect(interpolationKeys('{name}님, 다시 한번 {name}님!')).toEqual(
      interpolationKeys('Hello, {name}!'),
    );
  });

  it('파라미터 이름이 다르면 다른 것으로 본다', () => {
    // {amount}를 {amt}로 잘못 적으면 치환되지 않고 화면에 그대로 남으므로 잡아야 한다.
    expect(interpolationKeys('+{amount} {resource}')).not.toEqual(
      interpolationKeys('+{amt} {resource}'),
    );
  });
});

describe('ko/en 번역 사전', () => {
  it('빈 사전이 아니다', () => {
    // 아래 대조 검사는 두 사전이 모두 비어도 통과하므로 최소 크기를 함께 잡아둔다.
    expect(koEntries.size).toBeGreaterThan(100);
  });

  it('같은 키 집합을 갖는다', () => {
    const missingInEn = [...koEntries.keys()].filter((key) => !enEntries.has(key));
    const missingInKo = [...enEntries.keys()].filter((key) => !koEntries.has(key));

    // en에 없으면 영어 모드에서 원시 키가 노출되고, ko에 없으면 한국어 모드에서
    // 영어 문구가 그대로 보인다.
    expect(missingInEn).toEqual([]);
    expect(missingInKo).toEqual([]);
  });

  it('같은 키에서 같은 치환 파라미터를 쓴다', () => {
    // 한쪽이 {rooms}, 다른 쪽이 {room}이면 치환되지 않은 '{room}'이 화면에 남는다.
    const mismatched = [...koEntries.entries()]
      .filter(([key, koValue]) => {
        const enValue = enEntries.get(key);
        return (
          enValue !== undefined &&
          interpolationKeys(koValue).join(',') !== interpolationKeys(enValue).join(',')
        );
      })
      .map(([key]) => key);

    expect(mismatched).toEqual([]);
  });

  it('빈 문자열 번역이 없다', () => {
    // t()는 빈 문자열도 유효한 번역으로 보고 폴백하지 않으므로, 화면에 아무것도
    // 표시되지 않는다.
    const empty = [...koEntries.entries(), ...enEntries.entries()]
      .filter((entry) => entry[1].trim() === '')
      .map((entry) => entry[0]);

    expect(empty).toEqual([]);
  });
});
