/**
 * 게임 UI 공용 팔레트.
 *
 * 오프닝 연출(검은 배경 + 금색 띠 + 따뜻한 흙색 글자)의 색 언어를 게임 안 UI에도
 * 맞춰, 타이틀 → 오프닝 → 게임이 한 톤으로 읽히게 한다. 이전 UI는 차가운 청록
 * 계열이라 흙 테마 방·오프닝과 나란히 두면 색이 튀었다.
 *
 * 폰트는 의도적으로 픽셀 폰트를 유지한다. 오프닝 폰트는 그 문구 글자만 남긴
 * 서브셋이라 메뉴 글자가 없고, 게임 캔버스는 nearest-neighbor로 확대되므로
 * 매끈한 글꼴을 넣으면 뭉개진다. 여기서 통일하는 것은 색과 형태뿐이다.
 *
 * 의미를 전달하는 색(하트, 능력치 아이콘, 방 종류)은 가독성이 우선이라 그대로
 * 두고, 여기서는 UI 외곽(패널·테두리·글자·강조)만 다룬다.
 */

/** 오프닝 띠와 같은 금색. UI 강조·테두리의 기준색. */
export const UI_GOLD = 0xe8b04b;
/** 금색 위에 얹는 어두운 잉크색(오프닝 제목과 동일). */
export const UI_INK = 0x17120a;

export const UI_THEME = {
  /** 패널 바닥. 거의 검정이지만 살짝 따뜻하게 눌러 흙 배경과 붙는다. */
  panelFill: 0x0b0805,
  panelFillAlpha: 0.86,
  /** 패널 테두리 — 오프닝 보조선과 같은 금색을 옅게. */
  panelStroke: UI_GOLD,
  panelStrokeAlpha: 0.42,

  /** 화면 전체를 덮는 어둠(일시정지 등). */
  backdropFill: 0x000000,
  backdropAlpha: 0.5,

  /**
   * 일시정지 창 안쪽 면. 멈춘 게임 화면이 뒤로 비쳐 보이는 것이 이 UI의 성격이라
   * 옅게 유지한다(불투명하게 만들면 그냥 검은 상자가 된다).
   */
  dialogFill: 0x0b0805,
  dialogFillAlpha: 0.22,
  dialogStroke: UI_GOLD,
  dialogStrokeAlpha: 0.72,
} as const;

/** 글자색. Phaser 텍스트 스타일에 넣기 위해 CSS 문자열로 둔다. */
export const UI_TEXT = {
  /** 제목·강조 문구. */
  heading: '#e8b04b',
  /** 본문. 오프닝 부제와 같은 따뜻한 회색. */
  body: '#d8c9a4',
  /** 부가 설명처럼 한 단계 낮춘 글자. */
  muted: '#b9ad8e',
  /** 선택된 항목. */
  selected: '#17120a',
  /** 글자 외곽선 — 흙 배경 위에서도 읽히게 한다. */
  outline: '#0b0805',
  /** 선택된 항목의 배경(금색 띠). 오프닝 띠와 같은 문법. */
  selectedBackground: '#e8b04b',
  /** 선택되지 않은 항목의 배경(투명). */
  transparentBackground: '#00000000',
} as const;
