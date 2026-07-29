import { readFileSync } from 'node:fs';
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

// 제목은 노란 띠 안에서 한 줄로 끝나야 한다. 넘치면 마지막 글자만 다음 줄로 떨어져
// 연출이 깨진다(실제로 'Chapter 1 : Deep Underground'에서 발생했다).
//
// 띠 안쪽 폭 = .intro-stage 폭(400) - .intro-band 좌우 패딩(11×2) = 378 논리 픽셀.
// 제목 크기가 29 논리 픽셀이므로 쓸 수 있는 폭은 글꼴 크기의 378/29 ≈ 13.0배다.
//
// 이 비율이 창 크기와 무관하려면 제목 크기와 띠 폭이 "같은 배율에만" 비례해야 한다.
// 한쪽에 px 하한(max(30px, ...))을 두면 작은 창에서 글자는 멈추고 띠만 줄어들어
// 이 검사가 통과하는데도 실제로는 넘친다. 그래서 아래 CSS 전제 검사로 못을 박는다.
//
// 글자당 폭은 실제 렌더링을 측정해 얻은 근삿값이다(Freesentation Black 기준).
// 폰트나 위 CSS 값을 바꾸면 여기 상수도 다시 재야 한다.
const TITLE_EM_PER_KOREAN = 1;
const TITLE_EM_PER_LATIN = 0.543;
const TITLE_EM_PER_SPACE = 0.25;
// 측정 오차를 감안해 사용 가능한 13.0em에서 5% 여유를 남긴다.
const TITLE_WIDTH_BUDGET_EM = 12.4;
const KOREAN_CHARACTER = /[ᄀ-ᇿ㄰-㆏가-힣]/;

function estimateTitleWidthEm(text: string): number {
  return Array.from(text).reduce((total, character) => {
    if (character === ' ') {
      return total + TITLE_EM_PER_SPACE;
    }

    return total + (KOREAN_CHARACTER.test(character) ? TITLE_EM_PER_KOREAN : TITLE_EM_PER_LATIN);
  }, 0);
}

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

    it(`${locale} intro.title fits on one line inside the band`, () => {
      const title = String(introKey(tree, 'title') ?? '');
      const widthEm = estimateTitleWidthEm(title);

      expect(
        widthEm,
        `"${title}" 제목이 노란 띠보다 넓어 줄바꿈된다 (${widthEm.toFixed(2)}em > ${TITLE_WIDTH_BUDGET_EM}em). 문구를 줄이거나 styles.css의 .intro-title 배율(29)을 낮추세요`,
      ).toBeLessThanOrEqual(TITLE_WIDTH_BUDGET_EM);
    });
  }
});

// 폭 추정 모델 자체가 맞는지 확인한다. 실제로 줄바꿈이 났던 문구를 기준점으로 삼아,
// 이 검사가 통과만 하는 껍데기가 되지 않게 한다.
// 위 폭 검사는 "제목 크기와 띠 폭이 오직 --intro-scale에만 비례한다"는 전제 위에 서 있다.
// 전제가 깨지면 검사는 통과하면서 화면만 깨지므로, CSS를 직접 읽어 전제를 확인한다.
describe('오프닝 CSS 전제', () => {
  const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

  // 검사 대상: 폭 계산에 쓰인 세 값이 실제 CSS와 같은지, 그리고 하한/상한이 없는지.
  const EXPECTED_RULES = [
    { name: '.intro-title 글꼴 크기', pattern: /font-size:\s*calc\(var\(--intro-scale\) \* 29\)/ },
    { name: '.intro-stage 폭', pattern: /width:\s*calc\(var\(--intro-scale\) \* 400\)/ },
    {
      name: '.intro-band 좌우 패딩',
      pattern: /padding:\s*calc\(var\(--intro-scale\) \* 8\.4\) calc\(var\(--intro-scale\) \* 11\)/,
    },
  ];

  for (const rule of EXPECTED_RULES) {
    it(`${rule.name}가 배율에만 비례한다`, () => {
      expect(
        styles,
        `${rule.name} 값이 바뀌었다. styles.css를 고쳤다면 이 테스트의 폭 예산(${TITLE_WIDTH_BUDGET_EM}em)도 다시 계산하세요`,
      ).toMatch(rule.pattern);
    });
  }

  // max()/clamp()가 섞이면 작은 창에서 글자만 멈추고 띠는 계속 줄어든다.
  // 네 조각 모두 순수 비례식이어야 오프닝 전체가 게임 화면과 같은 배율로 움직인다.
  for (const selector of ['.intro-kicker', '.intro-title', '.intro-subtitle', '.intro-skip']) {
    it(`${selector} 글꼴 크기에 px 하한·상한이 없다`, () => {
      const start = styles.indexOf(`${selector} {`);
      expect(start, `${selector} 규칙을 찾지 못했다`).toBeGreaterThanOrEqual(0);

      const block = styles.slice(start, styles.indexOf('}', start));
      const fontSize = /font-size:\s*([^;]+);/.exec(block)?.[1];

      expect(
        fontSize,
        `${selector}의 글꼴 크기는 calc(var(--intro-scale) * N) 형태만 쓴다`,
      ).toMatch(/^calc\(var\(--intro-scale\) \* [\d.]+\)$/);
    });
  }
});

describe('estimateTitleWidthEm', () => {
  it('실제로 줄바꿈이 발생했던 제목을 예산 초과로 판정한다', () => {
    expect(estimateTitleWidthEm('Chapter 1 : Deep Underground')).toBeGreaterThan(
      TITLE_WIDTH_BUDGET_EM,
    );
  });

  it('한글을 영문보다 넓게 계산한다', () => {
    // 한글 한 글자가 영문 한 글자보다 넓지 않으면 한국어 제목을 과소평가하게 된다.
    expect(estimateTitleWidthEm('가')).toBeGreaterThan(estimateTitleWidthEm('a'));
  });
});
