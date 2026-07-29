import { describe, expect, it } from 'vitest';
import { findUncoveredIntroCharacters } from '../src/config/introFont';
import { ko } from '../src/i18n/ko';
import { en } from '../src/i18n/en';
import type { TranslationTree } from '../src/i18n/types';

function introKey(tree: TranslationTree, key: string): unknown {
  const intro = tree.intro;
  return typeof intro === 'object' ? (intro as Record<string, unknown>)[key] : undefined;
}

// 오프닝은 네 조각(작은 머리말·큰 제목·부제·스킵 안내)을 채운다.
// 하나라도 비면 연출 중 빈 줄이 남으므로 양 언어 모두 검증한다.
const INTRO_KEYS = ['kicker', 'title', 'subtitle', 'skip'] as const;

describe('intro copy', () => {
  for (const [locale, tree] of [
    ['ko', ko],
    ['en', en],
  ] as const) {
    for (const key of INTRO_KEYS) {
      it(`${locale} defines a non-empty intro.${key}`, () => {
        const value = introKey(tree, key);

        expect(value).toBeTypeOf('string');
        expect((value as string).trim().length).toBeGreaterThan(0);
      });

      // 오프닝 폰트는 쓰는 글자만 남긴 서브셋이라, 문구에 새 한글을 넣고 폰트를
      // 다시 만들지 않으면 그 글자만 다른 폰트로 나온다. 여기서 미리 잡는다.
      it(`${locale} intro.${key} only uses characters bundled in the intro font`, () => {
        const missing = findUncoveredIntroCharacters(String(introKey(tree, key) ?? ''));

        expect(
          missing,
          `서브셋에 없는 글자: ${missing.join(' ')} — public/assets/fonts/freesentation/NOTICE.txt 참고해 폰트를 재생성하고 INTRO_FONT_SUBSET_TEXT를 갱신하세요`,
        ).toEqual([]);
      });
    }
  }
});
