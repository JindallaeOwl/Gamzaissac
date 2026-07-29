/**
 * 오프닝 전용 폰트(`freesentation-black-subset.woff2`)에 포함된 글자 목록.
 *
 * 이 폰트는 용량을 줄이려고 오프닝에 쓰는 글자만 남긴 서브셋이라, 여기에 없는
 * 한글을 오프닝 문구에 새로 쓰면 그 글자만 다른 폰트로 표시된다. 문구를 바꿀 때는
 * 서브셋을 다시 만들고 이 상수도 함께 갱신해야 하며, 누락은 단위 테스트가 잡는다.
 *
 * 재생성 방법: `public/assets/fonts/freesentation/NOTICE.txt`
 */
export const INTRO_FONT_SUBSET_TEXT =
  '[ 땅속 깊은 곳 ]감자의 농장 탈출기몬스터를 피해 지상으로 탈출하기아무 키나 눌러 시작';

// 서브셋을 만들 때 --unicodes로 미리 넣어 둔 범위. 영문·숫자·기본 문장부호는
// 항상 들어 있으므로 영어 문구는 자유롭게 바꿔도 안전하다.
const PRESET_CODE_POINTS = new Set([0x00a0, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d]);

/** 해당 글자가 오프닝 폰트 서브셋에 들어 있는지 여부. */
export function isCoveredByIntroFont(character: string): boolean {
  const code = character.codePointAt(0);

  if (code === undefined) {
    return true;
  }

  // U+0020~U+007E: 영문·숫자·기본 문장부호
  if (code >= 0x20 && code <= 0x7e) {
    return true;
  }

  if (PRESET_CODE_POINTS.has(code)) {
    return true;
  }

  return INTRO_FONT_SUBSET_TEXT.includes(character);
}

/** 주어진 문구에서 서브셋에 없는 글자를 모아 돌려준다(중복 제거). */
export function findUncoveredIntroCharacters(text: string): string[] {
  return [...new Set(Array.from(text).filter((character) => !isCoveredByIntroFont(character)))];
}
