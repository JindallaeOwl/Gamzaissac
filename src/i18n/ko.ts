import type { TranslationTree } from './types';

export const ko: TranslationTree = {
  title: {
    name: 'GAMZAISSAC',
  },
  menu: {
    start: '시작',
    settings: '설정',
    quit: '나가기',
    back: '뒤로',
  },
  settings: {
    title: '설정',
    language: '언어',
    sound: '사운드',
    soundOn: '켜기',
    soundOff: '끄기',
    volume: '효과음 볼륨',
    screenShake: '화면 흔들림',
    renderQuality: '렌더 품질',
    fullscreen: '전체화면',
    low: '낮음',
    balanced: '균형',
    high: '높음',
  },
  pause: {
    title: '일시정지',
    continue: '계속하기',
    settings: '설정',
    exit: '나가기',
    fullscreen: '전체화면',
    titleScreen: '타이틀로 돌아가기',
  },
  enemies: {
    summoner: '부르는 자',
    flanker: '옆파고드는 갈고리',
  },
  bosses: {
    faultWarden: '퇴비 파수꾼',
    rootKernel: '썩은 뿌리핵',
    rootGnarl: '뿌리 옹이',
    wriggleMass: '꿈틀대는 덩어리',
    flyQueen: '파리 여왕',
    thornTangle: '가시넝쿨 뭉치',
    wormKing: '늙은 지렁이 왕',
    pitchforkFarmer: '녹슨 쇠스랑의 농부',
  },
  stages: {
    rottenRoots: '썩은 뿌리',
    wormDen: '지렁이 소굴',
    compostHeap: '퇴비더미',
    vinePassage: '넝쿨 통로',
  },
  intro: {
    kicker: '[ GAMZAISSAC ]',
    title: 'Chapter 1 : 땅 속 깊은 곳',
    subtitle: '몬스터를 피해 지상으로 탈출하기',
    skip: '아무 키나 눌러 시작',
  },
  touch: {
    movement: '이동 스틱',
    fire: '사격 스틱',
    bomb: '폭탄 사용',
    purchase: '구매',
    pause: '일시정지',
    rotate: '기기를 가로로 돌려 주세요',
  },
  gameOver: {
    title: 'GAME OVER',
    summary: '방 {rooms}   아이템 {items}   점수 {score}',
    restart: '타이틀로 돌아가기 (Enter / Space)',
  },
  escape: {
    title: '탈출 성공!',
    summary: '방 {rooms}   아이템 {items}   점수 {score}   시간 {time}',
    returnToTitle: '타이틀로 돌아가기 (Enter / Space)',
  },
  hud: {
    hp: '체력',
    key: '열쇠',
    bomb: '폭탄',
    coin: '코인',
    damage: '공격',
    range: '사거리',
    fireRate: '연사',
    luck: '행운',
    speed: '속도',
    floor: '층',
    cleared: '클리어',
    left: '남음',
    room: '방',
    enemies: '적',
    bullets: '탄환',
    fps: 'FPS',
    player: '위치',
    items: '아이템',
    abilities: '능력',
    score: '점수',
    time: '시간',
    open: '열림',
    locked: '잠김',
  },
  messages: {
    floor: '{floor}층 · {stage} {roman}',
    roomClear: '방 클리어',
    floorCleared: '층 클리어',
    nextFloorOpening: '위로 뚫린 뿌리 굴이 열렸습니다',
    stageCleared: '스테이지 클리어! 위로 뚫린 뿌리 굴이 열렸습니다',
    escapeOpening: '지상으로 나가는 굴이 열렸습니다!',
    stageClear: '스테이지 클리어',
    shopRoom: '상점방',
    treasureRoom: '보물방',
    bossRoom: '보스방',
    bossPhaseTwo: 'Fault Warden: 2페이즈',
    rootKernelPhaseTwo: 'ROOT KERNEL: 루트 권한 폭주',
    wormKingPhaseTwo: '늙은 지렁이 왕: 허물을 벗다',
    pitchforkFarmerPhaseTwo: '녹슨 쇠스랑의 농부: 광란',
    treasureUnlocked: '보물방 개방',
    shopUnlocked: '상점방 개방',
    keyNeeded: '열쇠가 필요합니다',
    shopOffer: '{name} · {price}코인 · F 구매',
    shopCoinsNeeded: '코인이 부족합니다 (필요: {price})',
    shopHealthFull: '체력이 이미 가득 찼습니다',
    shopResourceFull: '더 이상 보유할 수 없습니다',
    shopPurchased: '{name} 구매 완료',
    itemMaxStacks: '{name}: 최대 {max}개까지 중첩할 수 있습니다',
    noBombs: '폭탄이 없습니다',
    rewardGain: '+{amount} {resource}',
    resourceFull: '{resource} 가득',
    chestHealed: '상자: 체력 {amount} 회복',
    chestConsumable: '상자: +{amount} {resource}',
    itemPreview: '[{rarity} · {category}] {name}: {description}',
    secretItemSpawned: '비밀 입력 감지: 프리즘 창 + 쿼드샷 생성',
    // 스크롤 알림 제목. 알림 UI가 끝에 !를 자동으로 붙이므로 문장 안에 !를 넣지 않는다
    synergyActivated: '{name} 시너지 발동',
    clear: '클리어',
    localeKo: '한국어',
    localeEn: '영어',
    quitHint: '브라우저 탭을 닫아 종료하세요',
    startFailed: '게임 시작에 실패했습니다. 다시 시도해주세요',
  },
  resources: {
    hearts: '하트',
    keys: '열쇠',
    bombs: '폭탄',
    coins: '코인',
    chest: '상자',
  },
  roomTypes: {
    start: '시작',
    combat: '전투',
    shop: '상점',
    treasure: '보물',
    boss: '보스',
  },
  shop: {
    greeting: '오메~ 왔능가~ 어여 들어오쇼.',
    greetingFollowUp: '천천히 둘러보쇼. 급헐 거 하나도 없응께.',
    products: {
      heart: {
        name: '회복 하트',
        description: '하트 1칸을 회복합니다.',
      },
      key: {
        name: '열쇠',
        description: '열쇠를 1개 얻습니다.',
      },
      bomb: {
        name: '폭탄',
        description: '폭탄을 1개 얻습니다.',
      },
    },
  },
  items: {
    redMushroom: {
      name: '빨간 버섯',
      description: '최대 하트가 1개 늘고 하트 1개를 회복합니다.',
    },
    pulseRelay: {
      name: '맥동 릴레이',
      description: '연사 속도가 빨라집니다 (연사 +0.55).',
    },
    glassFern: {
      name: '유리 고사리',
      description: '공격력이 올라갑니다 (공격 +0.45).',
    },
    featherCoil: {
      name: '깃털 코일',
      description: '이동 속도가 빨라집니다 (속도 +34).',
    },
    hotPebble: {
      name: '뜨거운 조약돌',
      description:
        '사거리, 씨앗 속도, 공격력이 함께 오릅니다 (사거리 +85, 씨앗 속도 +72, 공격 +0.15).',
    },
    pocketBattery: {
      name: '주머니 전지',
      description: '최대 하트가 1개 늘고 하트 1개를 회복합니다.',
    },
    steadyPin: {
      name: '고정 핀',
      description: '공격 속도와 씨앗 속도가 함께 오릅니다 (공속 +0.35, 씨앗 속도 +40).',
    },
    moonDial: {
      name: '달 시계',
      description: '행운이 올라 보상 확률이 좋아집니다 (행운 +1).',
    },
    longEcho: {
      name: '긴 메아리',
      description: '사거리가 크게 늘어납니다 (사거리 +115).',
    },
    prismLance: {
      name: '프리즘 창',
      description: '씨앗 공격을 차징 관통 빔으로 바꿉니다.',
    },
    quadShot: {
      name: '쿼드샷',
      description: '씨앗이 네 개씩 부채꼴로 발사됩니다.',
    },
    megaSeed: {
      name: '메가씨드',
      description:
        '거대한 씨앗이 처치 후 남은 피해로 관통합니다 (공격 +4, 공격력 ×2, 공격 속도 ×0.42).',
    },
    toothpick: {
      name: '이쑤시개',
      description: '공격이 빨라지고 씨앗이 붉어집니다 (공격 속도 +0.7, 씨앗 속도 ×1.16).',
    },
    seedPouch: {
      name: '씨앗 주머니',
      description: '공격력과 씨앗 속도가 조금 오릅니다. 최대 5회 중첩됩니다.',
    },
    barkVest: {
      name: '나무껍질 조끼',
      description: '최대 체력이 반 칸 늘고 반 칸을 회복합니다. 최대 3회 중첩됩니다.',
    },
    runnerRoots: {
      name: '달림뿌리',
      description: '이동 속도가 오릅니다. 최대 4회 중첩됩니다.',
    },
    cloverSprout: {
      name: '클로버 새싹',
      description: '행운이 0.5 오릅니다. 최대 4회 중첩됩니다.',
    },
    scopeLens: {
      name: '조준 렌즈',
      description: '사거리와 씨앗 속도가 오릅니다. 최대 3회 중첩됩니다.',
    },
    thornCrown: {
      name: '가시 왕관',
      description: '최대 체력 반 칸을 희생해 공격력을 크게 올립니다.',
    },
    rainBoots: {
      name: '빗물 장화',
      description: '이동 속도가 크게 오르고 사거리가 조금 늘어납니다.',
    },
    amberHeart: {
      name: '호박 심장',
      description: '최대 체력이 2칸 늘고 1칸을 회복합니다. 최대 2회 중첩됩니다.',
    },
    overclockBulb: {
      name: '오버클럭 구근',
      description: '공격 속도와 씨앗 속도 배율이 크게 오릅니다.',
    },
    luckyLedger: {
      name: '행운 장부',
      description: '행운이 2 오르고 이동 속도가 조금 빨라집니다.',
    },
    ironHusk: {
      name: '철 껍질',
      description:
        '이동 속도를 조금 잃고 최대 체력 1칸과 체력 반 칸을 얻습니다. 최대 3회 중첩됩니다.',
    },
    starFertilizer: {
      name: '별빛 비료',
      description: '공격력 배율과 사거리가 오릅니다. 최대 2회 중첩됩니다.',
    },
    twinSeed: {
      name: '쌍둥이 씨앗',
      description: '씨앗이 하나 더 갈라져 나갑니다. 대신 한 발의 위력은 조금 약해집니다.',
    },
    soilGlove: {
      name: '흙 묻은 장갑',
      description: '공격력과 행운이 함께 오릅니다. 최대 3회 중첩됩니다.',
    },
    heavyGravel: {
      name: '무거운 자갈',
      description: '씨앗이 크고 아파지지만 느리게 날아갑니다.',
    },
    thinRind: {
      name: '얇은 껍질',
      description: '최대 하트 1개를 잃는 대신 이동 속도와 연사가 크게 빨라집니다.',
    },
    silverDew: {
      name: '은빛 이슬',
      description: '행운이 크게 오르고 하트 1개를 회복합니다.',
    },
    spikeRind: {
      name: '가시 껍질',
      description: '공격력이 오르고 최대 체력이 반 칸 늘지만 몸이 무거워집니다.',
    },
    deepRoot: {
      name: '깊은 뿌리',
      description: '최대 하트와 사거리가 크게 오릅니다. 대신 발이 느려집니다.',
    },
    boreAwl: {
      name: '관통 송곳',
      description: '적을 처치하고 남은 피해가 뒤의 적에게 이어집니다. 대신 연사가 조금 느려집니다.',
    },
  },
  rarities: {
    common: '일반',
    uncommon: '고급',
    rare: '희귀',
    legendary: '전설',
  },
  itemCategories: {
    offense: '공격',
    defense: '방어',
    utility: '기동',
    resource: '자원',
  },
  synergies: {
    prismArray: {
      name: '프리즘 배열',
      description: '빔 모으는 시간이 30% 짧아집니다.',
    },
    glassHorizon: {
      name: '유리 지평선',
      description: '공격력과 사거리가 함께 오릅니다 (공격 +0.55, 사거리 +45).',
    },
    tunedCircuit: {
      name: '조율 회로',
      description: '연사와 씨앗 속도가 함께 오릅니다 (연사 +0.4, 씨앗 속도 +30).',
    },
    backupShell: {
      name: '예비 껍질',
      description: '최대 하트가 1개 늘고 하트 1개를 회복합니다.',
    },
    compoundLuck: {
      name: '복리 행운',
      description: '행운이 2 오릅니다.',
    },
    meteorSeed: {
      name: '유성 씨앗',
      description: '씨앗이 더 크고 빠르고 아파집니다 (공격 +0.75, 씨앗 속도 +60, 크기 ×1.15).',
    },
  },
};
