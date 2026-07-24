# 스테이지 구조 도입 설계안 v2.2 (Codex 최종 승인 반영)

작성: 2026-07-25, Claude. Codex 최종 검토에서 지적된 논리 충돌 1건(탈출 시퀀스 시작 조건)과
설치된 폭탄 처리를 반영한 확정판. ShooterEnemy 스케일 버그 수정안은 Codex가 코드·Git 이력
확인 후 승인함. 이 문서 기준으로 구현을 진행하며, 완료 후 문서는 삭제한다.

## 0. 확정 사항 요약

- 4스테이지 × 2층 = 8층. **모든 층 마지막에 보스방** (A안).
- 계층형 보스: I층 = 중간보스 4종(기존 AI 재사용), II층 = 스테이지 보스.
- 스테이지 데이터: `bossIds: readonly [EnemyId, EnemyId]`.
- 8층 보스 처치 → 탈출(런 클리어) → 승리 화면 → TitleTransitionScene 경유 타이틀.
- 콘텐츠 상한 없음, 단 버전 단위 완성 (v1.0 = 탈출 스토리 완성판).

| 스테이지                      | 층  | I층 중간보스    | II층 스테이지 보스                                 |
| ----------------------------- | --- | --------------- | -------------------------------------------------- |
| 1. 지하 깊은 곳 — 썩은 뿌리   | 1–2 | 뿌리 옹이       | rootKernel → 표시명 "썩은 뿌리핵"                  |
| 2. 어두운 흙 속 — 지렁이 소굴 | 3–4 | 꿈틀대는 덩어리 | (임시) faultWarden → 추후 신규 "늙은 지렁이 왕"    |
| 3. 김 나는 퇴비더미           | 5–6 | 파리 여왕       | faultWarden → 표시명 "퇴비 파수꾼"                 |
| 4. 빛이 새는 넝쿨 통로        | 7–8 | 가시넝쿨 뭉치   | (임시) rootKernel → 추후 신규 "녹슨 쇠스랑의 농부" |

## 1. 현재 구조 (코드 대조 완료)

- `RunState.floor` 무한 증가. `advanceRunToNextFloor`가 +1과 회복.
- `DungeonManager.generateFloor`: 보스 템플릿 홀짝 교대. 범위 검증 없음.
- 보스 처치 → 보스방 `FloorExit` → `advanceFloor()`. `restoreFloorExit`로 재입장 복원.
- 게임오버: `gameOverStarted`(Scene 필드) + DOM 오버레이 + `physics.world.pause()`
  (GameScene.ts:534) + TitleTransitionScene 경유 복귀. `runElapsedMs`는 update에서 증가.
- `isGameOver: () => this.gameOverStarted` 콜백이 **BombSystem·CombatCollisionSystem·
  DeveloperConsoleController** 세 곳에 주입됨 (GameScene.ts:225·256·277).
- `utils/gameOverInput.ts`: `isGameOverRestartCode(code)` — **키 코드만 검사하는 순수 함수**.
- `ShooterEnemy.updateAI`: 예고 시 `setScale(0.9)`, 발사 시 `setScale(0.8)` **하드코딩**.
- 음악·보스 보상은 `room.type === 'boss'` 기준. `kind: 'boss'`가 직접 주는 것은
  보스 체력바(BossHud의 isBoss 추적)뿐.
- 확장 미니맵에는 시간·점수만 있음(층 표시 없음). 디버그 오버레이에 `{floor}층`.
- 개발자 콘솔 `floor <1~99>`.

## 2. 설계

### 2-1. `src/data/stages.ts`

```ts
export interface StageDefinition {
  id: string;
  nameKey: string; // i18n
  bossIds: readonly [EnemyId, EnemyId]; // [I층, II층]
  accentColor: number;
}
export const FLOORS_PER_STAGE = 2;
export const STAGES: readonly StageDefinition[]; // 길이 4
export const TOTAL_FLOORS = STAGES.length * FLOORS_PER_STAGE; // 8

export interface StageProgress {
  stage: StageDefinition;
  stageNumber: number; // 1~4
  floorInStage: 1 | 2;
  bossId: EnemyId;
  isFinalFloor: boolean;
}
export function getStageProgress(floor: number): StageProgress; // 범위 밖·비정수 = throw
```

`DungeonManager.generateFloor`도 `1..TOTAL_FLOORS`를 직접 검증해 throw.
개발자 콘솔은 호출 전에 입력을 `1..TOTAL_FLOORS`로 제한.

### 2-2. 중간보스 4종 (Codex #1 반영)

| enemyId     | 표시명 (ko/en)                 | 재사용 AI    | v1.0 차별 요소                      |
| ----------- | ------------------------------ | ------------ | ----------------------------------- |
| rootGnarl   | 뿌리 옹이 / Root Gnarl         | ChaserEnemy  | 크고 느린 추적, 높은 접촉 피해      |
| wriggleMass | 꿈틀대는 덩어리 / Wriggle Mass | Chaser+분열  | 처치 시 splitterling 4마리로 갈라짐 |
| flyQueen    | 파리 여왕 / Fly Queen          | ShooterEnemy | **빠른 단발 사격** (쿨다운 축소)    |
| thornTangle | 가시넝쿨 뭉치 / Thorn Tangle   | DasherEnemy  | 짧은 간격 연속 돌진 (쿨다운 축소)   |

- **flyQueen 3연발은 v1.0에서 제외** — 현재 ShooterEnemy는 공격 1회당 1발 구조라
  파라미터로 3연발 표현 불가(Codex 지적 확인). 실제 연발 패턴은 후속 작업으로 분리.
- **kind: 'boss'의 효과 정정**: 보스 체력바만 kind에서 나온다. 보스방 음악·보스 보상은
  `room.type === 'boss'` 때문에 적용된다 (중간보스도 보스방에 배치되므로 결과적으로 동일).
- **외형 정책**: v1.0 중간보스는 **기존 일반 적 텍스처를 임시 재사용**하고, 크기는
  정의 필드(신규 `displayScale?: number`)로 확대한다 (BaseEnemy가 정의를 읽어 적용).
  전용 도트는 "placeholder 교체" 작업에서 제작. 따라서 assets.ts/AssetFactory는
  이 작업에서 변경하지 않는다 (escape 출구 텍스처는 별개 — 2-5).
- **ShooterEnemy 스케일 처리 (기존 버그 수정 포함)**: 예고/발사 시 `setScale(0.9)/(0.8)`
  하드코딩은 도트 교체(기본 배율 0.8→1) 이후 **일반 사수 적도 첫 공격 후 0.8로 줄어든 채
  고정되는 현행 버그**가 되어 있음. 수정: 스폰 시점의 기본 배율을 기준으로 한 순수 헬퍼
  `shooterPulseScale(baseScale, phase: 'telegraph' | 'idle')`를 추가해 예고 = 기준×1.12,
  평상 = 기준×1로 계산 (flyQueen의 displayScale에도 자동 대응). 회귀 테스트:
  기준 배율 1과 확대 배율 모두에서 발사 후 기준 배율로 복귀.

### 2-3. 보스방 템플릿 파생

```ts
export function bossRoomTemplateId(bossId: EnemyId): string; // `boss-${bossId}`
// BOSS_ROOM_TEMPLATES = STAGES에 등장하는 모든 bossId(중복 제거)로부터 생성
```

기존 `error-sanctum`/`root-cellar` id는 제거하고 참조(코드·테스트)를 전수 교체.
**보스별 전용 방 구조(장애물 배치 등)는 v1.0 이후 별도 확장 작업으로 남긴다** — v1.0은
공통 보스방 구조에 보스만 다르게 배치.

### 2-4. 런 종료 상태 — 단일 기준 (Codex #2 반영)

```ts
// RunState — 런 종료의 유일한 논리 기준
outcome: 'playing' | 'defeated' | 'escaped';
```

- `runEnded: boolean` 안은 **폐기**. `RunState.outcome`이 유일한 판정 기준.
- Scene 필드(`gameOverStarted`, `escapeStarted`)는 **오버레이·전환의 중복 실행을 막는
  표시용 상태로만** 유지하고, 패배/탈출 "판정"은 항상 `outcome`에서 읽는다.
- 플레이어 사망 처리 시 `outcome = 'defeated'` 설정 (기존 흐름에 연결).

```ts
export type FloorExitOutcome =
  | { kind: 'advance'; previousFloor: number; nextFloor: number; healthRecovered: number }
  | { kind: 'run-clear' }
  | { kind: 'ignored' }; // outcome이 이미 defeated/escaped인 경우
export function resolveFloorExit(state: RunState): FloorExitOutcome;
// floor < TOTAL_FLOORS: advance (기존 advanceRunToNextFloor 동작 흡수)
// floor === TOTAL_FLOORS && outcome === 'playing': outcome = 'escaped' 후 run-clear
// outcome !== 'playing': 아무것도 바꾸지 않고 ignored
```

### 2-5. 탈출 시퀀스와 차단 범위 (Codex #3 반영)

`isGameOver` 콜백은 **`isRunEnded`로 개명**하고 `outcome !== 'playing'` 검사로 변경 —
패배·탈출을 공통 차단. 주입처 3곳(BombSystem·CombatCollisionSystem·
DeveloperConsoleController) + GameScene 내부 사용처를 함께 정리한다.

탈출 상태에서도 게임이 뒤에서 돌지 않도록 차단 범위 (게임오버와 동일 수준):

- `GameScene.update` (탈출 시 게임 루프 갱신 중단 — `runElapsedMs` 증가 정지 포함)
- 일시정지 입력 (ESC 무시)
- BombSystem (폭탄 설치·폭발 처리 차단)
- CombatCollisionSystem (피해 차단)
- DeveloperConsoleController (콘솔 명령 차단)
- 플레이어 입력·이동 정지
- 출구 접촉 처리 (아래 중복 가드)

**논리 책임 분담 (Codex 최종 지적 반영)**: `resolveFloorExit`가 탈출을 판정하고
`outcome`을 `'escaped'`로 확정한다. `startEscapeSequence`는 **확정된 escaped 상태의
연출(화면·입력·물리·음악)만** 담당한다. 따라서 시작 조건은 다음과 같다
(v2.1의 "`playing`이 아니면 반환"은 정상 첫 탈출도 차단하는 모순이므로 폐기):

```ts
if (runState.outcome !== 'escaped' || this.escapeStarted) {
  return;
}
```

`startEscapeSequence()` 명세:

1. 위 시작 조건 검사 — `outcome !== 'escaped'`이거나 이미 연출이 시작됐으면 반환
2. `escapeStarted` 표시 상태 설정 (전환 중복 차단)
3. 플레이어 이동·입력 정지, `physics.world.pause()` (게임오버와 동일 방식)
4. **`bombSystem.clear()` 호출** — 설치된 폭탄 제거. `physics.world.pause()`만으로는
   Phaser Scene 타이머(`delayedCall` 기반 fuse)가 중단되지 않으므로, 탈출 화면 중
   기존 폭탄이 터지는 것을 막는다 (`clear()`는 씬 종료 시에도 쓰는 기존 메서드 재사용).
   추가 방어: BombSystem의 폭발 콜백 자체에도 `isRunEnded()` 검사를 넣어, 어떤 경로로든
   런 종료 후에는 피해·장애물 파괴를 실행하지 않는다 (규칙 테스트 포함)
5. 음악 페이드아웃 (신규 트랙 없이 타이틀곡으로)
6. **승리 전용 DOM 오버레이** 표시: "탈출 성공!" + 점수·플레이 시간 +
   "타이틀로 돌아가기 (Enter/Space)" — 게임오버 오버레이와 별도 마크업(index.html)·
   별도 클래스(styles.css). 추후 엔딩 연출은 이 오버레이를 확장
7. 확인 입력 시 TitleTransitionScene 경유 타이틀 복귀 (fallback 타이머 포함 기존 안전장치)
8. **TitleTransitionScene은 게임오버 오버레이와 승리 오버레이를 모두 정리**하도록 확장

### 2-6. 런 종료 입력 유틸 (Codex #4 반영)

- `isGameOverRestartCode`를 **`isRunEndConfirmCode`로 일반화** (동일한 순수 함수,
  키 코드만 검사 — "인스턴스" 아님. 기존 호출처 개명 반영).
- 게임오버·승리 오버레이는 **각자 별도의 keydown 리스너**를 가진다.
- 각 리스너는 `RunState.outcome`(자기 상태가 맞는지)과 전환 중복 표시 상태를 확인한 뒤 동작.
- **Scene shutdown 시 각 리스너를 반드시 제거** (등록/해제를 쌍으로).

### 2-7. 최종 탈출구 (FloorExit)

- `FloorExit`에 `kind: 'next-floor' | 'escape'` 추가. 최종층 보스방에는 escape로 생성.
- escape 전용 텍스처 추가 (assets.ts 키 + AssetFactory 생성 함수 — 위로 뚫린 굴 + 새어드는 빛).
- i18n: 일반 출구 "위로 뚫린 뿌리 굴", 최종 "지상으로 나가는 굴" (상승 스토리 반영).
- `restoreFloorExit`: 재입장 복원 시 kind까지 복원 (최종 보스방 재입장 → escape 복원).
- 출구 overlap: `resolveFloorExit`의 ignored + Scene 표시 상태로 이중 가드.

### 2-8. 표시·색조

- 전투방·시작방 색조 = 스테이지 `accentColor` (RoomController.drawRoom에서
  `getStageProgress` 참조). 상점·보물·보스방은 기존 방 종류 색 유지.
- 확장 미니맵: 시간·점수 옆에 "스테이지명 I/II" **신규 추가**. 디버그 오버레이 갱신.
- `handleRoomCleared` 메시지 3분화: I층 보스 처치 / II층(스테이지 클리어) / 최종층(탈출구).
- i18n: 스테이지 이름 4종, 보스 리네임(썩은 뿌리핵/Rotten Root Core,
  퇴비 파수꾼/Compost Warden), 탈출 문구 일체 (ko/en 동시).

## 3. 구현 순서 (Codex #6 반영 — 단계별 `npm run check` 통과 보장)

각 단계는 앞 단계의 타입만 참조하므로 순서대로 항상 컴파일이 성립한다.

1. **중간보스 4종**: EnemyId·정의(`displayScale` 필드 포함)·EnemyFactory 등록·i18n 표시명
   - ShooterEnemy 스케일 순수 헬퍼(기존 버그 수정) + 임시 텍스처 정책 적용 + 테스트
     (이 단계에서 중간보스는 아직 어디에도 스폰되지 않음 — 정의만 존재해도 check 통과)
2. **stages.ts**: STAGES(1단계의 id 참조)·getStageProgress + 1~8 매핑·경계값(0/9/비정수) 테스트
3. **보스방 템플릿 파생 + DungeonManager**: 범위 검증, 스테이지 기반 보스 선택,
   기존 템플릿 id 참조 전수 교체 + 테스트 (모든 bossId 정의 존재·kind boss·템플릿 존재·
   템플릿 id 중복 없음·1~8층 보스 선택 정확)
4. **RunState.outcome 도입**: 사망 처리 연결, `isGameOver` → `isRunEnded` 개명·의미 확장
   (주입처 3곳 + GameScene) + 테스트 (패배 상태에서 탈출 불가 등)
5. **resolveFloorExit**: 순수 진행 규칙 + 테스트 (8층 advance 불가·run-clear·중복 호출 ignored)
6. **FloorExit kind + escape 텍스처 + 재입장 복원** + 테스트 (최종 보스방 재입장 시 escape 복원)
7. **탈출 시퀀스**: DOM 오버레이·입력 리스너(등록/해제)·물리/시간 정지·차단 범위·
   TitleTransitionScene 정리 확장 + 테스트
8. **표시·색조**: 스테이지 색조, 미니맵/디버그 표시, 클리어 메시지 3분화, 보스 리네임
9. **개발자 콘솔 상한·도움말·자동완성 + README/DEVELOPMENT_STATUS 갱신 + 본 문서 삭제**

## 4. 테스트 계획 (Codex #5·#7 반영)

구조 검증: 1~8층 stage 매핑 / 0·9·비정수 throw / 층별 보스 선택 / STAGES의 모든 bossId가
ENEMY_DEFINITIONS에 존재 / 모든 층 보스가 kind 'boss' / 모든 bossId에 템플릿 존재 /
파생 템플릿 id 중복 없음.

회귀·행동 검증: ShooterEnemy 계열이 공격 후 기준 배율로 복귀(기본·확대 배율 모두) /
패배 상태에서 탈출 처리 불가 / 탈출 상태에서 피해·폭탄·콘솔·일시정지 차단 /
런 종료 후 폭발 콜백이 피해·장애물 파괴를 실행하지 않음(설치된 폭탄 fuse 타이머 대비) /
resolveFloorExit 중복 호출 ignored / 승리 오버레이 키 입력 중복 처리 방지 /
Scene shutdown 후 승리 입력 리스너 제거 / TitleTransitionScene이 승리 오버레이까지 정리 /
최종 보스방 재입장 시 escape 출구 복원 / 개발자 콘솔 floor 상한·자동완성·도움말.

Scene·DOM에 걸친 항목(리스너 해제, 오버레이 정리)은 이 프로젝트의 테스트 방식대로
로직을 순수 함수/헬퍼로 추출해 단위 테스트하고, 실제 화면 동작은 QA 단계에서 수동 확인한다.

## 5. 바꾸지 않는 것

- 적 체력 스케일 공식·증원 규칙 (밸런스 작업에서 8층 곡선으로 별도 조정)
- 방 생성 알고리즘·전투방 템플릿·아이템/보상 시스템 (보스 보상 매 층 유지 = 현행 동일)
- 신규 스테이지 보스 2종(지렁이 왕, 농부), flyQueen 3연발 패턴 — 후속 작업
- 보스별 전용 방 구조 — 후속 확장
- 저장/해금 메타 시스템 — v1.1 이후

## 6. 리스크

- 전환 상태 얽힘 재발 방지: 판정은 `RunState.outcome` 단일 기준, Scene 필드는 표시용.
  단계 7에서 게임오버↔탈출 상호 트리거 불가를 테스트로 고정.
- 중간보스 체감: AI 재사용이라 싱거울 수 있음 → 수치 1차 조정, 부족분은 밸런스 작업에서 결정.
- 임시 보스 배치(S2-II/S4-II)와 임시 텍스처(중간보스)는 과도기로 허용, 후속 작업에서 교체.
