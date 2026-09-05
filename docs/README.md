# GAMZAISSAC 기능 문서

이 폴더는 **"지금 이 게임에 무엇이 들어가 있는가"를 기능별로 나눠 적어 둔 곳**입니다.
개발을 진행하면서 계속 고쳐 나가는 살아 있는 문서이고, Claude와 함께 작업할 때
"여기 적힌 것이 현재 상태다"라는 공통 기준이 됩니다.

마지막 코드 대조일: 2026-09-01 (기준 커밋 `e2bbc99`, 테스트 74파일 557개 전부 통과)

## 문서 지도

| 문서                                             | 이슈                                                        | 무엇이 적혀 있나                                                    |
| ------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------- |
| [00. 현황 한눈에 보기](00-status-overview.md)    | [#2](https://github.com/JindallaeOwl/Gamzaissac/issues/2)   | 기능별 완성도 표. **여기부터 보세요**                               |
| [01. 게임 개요와 개발 환경](01-overview.md)      | [#3](https://github.com/JindallaeOwl/Gamzaissac/issues/3)   | 어떤 게임인가, 기술 스택, 실행·검사 방법, 폴더 구조                 |
| [02. 플레이어와 전투](02-player-combat.md)       | [#4](https://github.com/JindallaeOwl/Gamzaissac/issues/4)   | 이동·사격·차징 빔·폭탄·피격, 능력치와 공격 프로필                   |
| [03. 아이템과 시너지](03-items-synergies.md)     | [#5](https://github.com/JindallaeOwl/Gamzaissac/issues/5)   | 아이템 36종, 희귀도·드랍표, 시너지 6종, 아이템 추가 원칙            |
| [04. 적과 보스](04-enemies-bosses.md)            | [#6](https://github.com/JindallaeOwl/Gamzaissac/issues/6)   | 일반 적 7종, 챔피언, 중간보스 4종, 스테이지 보스 4종, 층 배율       |
| [05. 던전과 방](05-dungeon-rooms.md)             | [#7](https://github.com/JindallaeOwl/Gamzaissac/issues/7)   | 방 생성 규칙, 방 종류 5가지, 전투방 템플릿 12종, 문·경계·장애물     |
| [06. 보상·상점·자원](06-rewards-shop-economy.md) | [#8](https://github.com/JindallaeOwl/Gamzaissac/issues/8)   | 방 클리어 보상, 상자, 상점, 코인·열쇠·폭탄 경제                     |
| [07. 진행과 스테이지](07-progression-stages.md)  | [#9](https://github.com/JindallaeOwl/Gamzaissac/issues/9)   | 8층 구조, 층 이동, 탈출 엔딩, 런 상태 유지 범위, 씨눈 심기          |
| [08. UI·입력·오디오](08-ui-input-audio.md)       | [#10](https://github.com/JindallaeOwl/Gamzaissac/issues/10) | 화면 구성, HUD·미니맵, 조작(키보드/터치), 설정, 다국어, 음악·효과음 |
| [09. 개발자 도구와 검사](09-devtools-testing.md) | [#11](https://github.com/JindallaeOwl/Gamzaissac/issues/11) | 개발자 콘솔, 아이템 선택기, 테스트·빌드 검사 절차                   |
| [10. 에셋과 아트](10-assets-art.md)              | [#12](https://github.com/JindallaeOwl/Gamzaissac/issues/12) | 픽셀 규격, 적용된 에셋, 아직 임시(placeholder)인 것, 도트 제작 규칙 |
| [11. 로드맵과 남은 작업](11-roadmap.md)          | [#13](https://github.com/JindallaeOwl/Gamzaissac/issues/13) | v1.0 남은 항목, v1.1 이후 후보, 확인 대기 중인 것, 협업 방식        |
| [12. 검수 워크플로](12-review-workflow.md)       | 아직 없음                                                   | **Codex에게 그대로 건네는 안내글** — 검수 순서·판정 형식·승인 기준  |
| 이 문서 (문서 지도)                              | [#1](https://github.com/JindallaeOwl/Gamzaissac/issues/1)   | 문서 목록과 갱신 규칙                                               |

## 이 문서를 고치는 방법

기능을 하나 추가하거나 바꿨다면, **같은 작업 안에서** 아래 네 곳을 고칩니다.

1. **해당 기능 문서**의 `지금 되는 것` 목록과 `핵심 수치` 표
2. **해당 기능 문서 맨 아래 `변경 기록`**에 한 줄 추가 (`날짜 | 무엇을 왜 바꿨나`)
3. **[00. 현황 한눈에 보기](00-status-overview.md)**의 상태 표시가 달라졌다면 그것도
4. **위 표의 짝 이슈 본문**도 같은 내용으로 갱신

수치를 바꿨을 때는 "코드에 적힌 값"과 "문서에 적힌 값"이 어긋나지 않게 합니다.
문서와 코드가 다르면 **언제나 코드가 맞습니다.** 문서에서 다른 값을 발견하면
고쳐 두는 것이 다음 작업을 빠르게 만듭니다.

### GitHub Issues와의 관계

이 폴더의 문서 13개는 [GitHub Issues](https://github.com/JindallaeOwl/Gamzaissac/issues)에
`[docs]` 이슈 #1~#13으로 그대로 올라가 있습니다. **원본은 언제나 저장소 파일**이고,
이슈는 웹에서 읽고 댓글로 논의하기 위한 사본입니다. 두 곳이 어긋나면 파일 쪽이 정답입니다.

4번(이슈 본문 갱신)은 손으로 하면 빠뜨리기 쉬우므로, 이슈 본문을 파일에서 자동으로
덮어쓰는 명령이나 GitHub Actions 자동화를 붙이는 것을 권장합니다.

### 이슈 라벨

| 라벨               | 무엇                             |
| ------------------ | -------------------------------- |
| `documentation`    | 문서 사본 이슈                   |
| `area:combat`      | 플레이어 조작과 전투             |
| `area:items`       | 아이템과 시너지                  |
| `area:enemy`       | 적과 보스                        |
| `area:dungeon`     | 던전 생성과 방                   |
| `area:economy`     | 보상·상점·자원                   |
| `area:progression` | 층 진행과 스테이지               |
| `area:ui`          | UI·입력·오디오                   |
| `area:devtools`    | 개발자 도구와 검사               |
| `area:art`         | 에셋과 픽셀 아트                 |
| `area:meta`        | 문서·프로젝트 전반               |
| `balance`          | 수치 밸런스 조정                 |
| `play-check`       | 직접 플레이로 확인이 필요한 항목 |

마일스톤은 **v1.0 — 탈출 스토리 완성판**과 **v1.1+ — 이후 확장** 두 개입니다.

### 상태 표시 약속

- ✅ **완료** — 지금 게임에서 동작하고, 더 손댈 계획이 없는 것
- 🟡 **부분** — 동작은 하지만 임시판이거나 다듬을 것이 남은 것
- ⛔ **미착수** — 아직 만들지 않은 것 (계획만 있음)

## 기존 문서들과의 관계

이 폴더가 생기기 전부터 저장소 루트에 있던 문서들입니다. 역할을 나눠 씁니다.

| 문서                                                | 역할                                                           |
| --------------------------------------------------- | -------------------------------------------------------------- |
| [`README.md`](../README.md)                         | 처음 보는 사람용 소개 — 게임 설명, 실행법, 조작법              |
| [`DEVELOPMENT_STATUS.md`](../DEVELOPMENT_STATUS.md) | 작업 일지 — 언제 무엇을 왜 그렇게 만들었는지의 **시간순 기록** |
| [`GAME_CONCEPT.md`](../GAME_CONCEPT.md)             | v1.0 **이후**에 만들 다음 게임의 컨셉 초안 (현재 게임과 별개)  |
| [`ASSET_CREDITS.md`](../ASSET_CREDITS.md)           | 외부 에셋 출처와 라이선스                                      |
| [`SPRITE_GUIDE.md`](../SPRITE_GUIDE.md)             | 스프라이트 제작 가이드                                         |
| **`docs/` (이 폴더)**                               | **기능별 현재 상태** — "지금 무엇이 어떻게 동작하는가"         |

쉽게 말하면 `DEVELOPMENT_STATUS.md`는 **일기**이고 `docs/`는 **설명서**입니다.
같은 내용이 양쪽에 조금씩 겹치는데, 겹치는 부분은 `docs/` 쪽을 정답으로 봅니다.
