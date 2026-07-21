import type { TranslationTree } from './types';

export const en: TranslationTree = {
  title: {
    name: 'GAMZAISSAC',
  },
  menu: {
    start: 'Start',
    settings: 'Settings',
    quit: 'Quit',
    back: 'Back',
  },
  settings: {
    title: 'Settings',
    language: 'Language',
    sound: 'Sound',
    soundOn: 'On',
    soundOff: 'Off',
    volume: 'Effects volume',
    screenShake: 'Screen shake',
    renderQuality: 'Render quality',
    fullscreen: 'Fullscreen',
    low: 'Low',
    balanced: 'Balanced',
    high: 'High',
  },
  pause: {
    title: 'PAUSED',
    continue: 'Continue',
    settings: 'Settings',
    exit: 'Exit',
    fullscreen: 'Fullscreen',
    titleScreen: 'Return to title',
  },
  bosses: {
    faultWarden: 'Fault Warden',
    rootKernel: 'ROOT KERNEL',
  },
  gameOver: {
    title: 'GAME OVER',
    summary: 'Rooms {rooms}   Items {items}   Score {score}',
    restart: 'Restart (Enter / Space)',
  },
  hud: {
    hp: 'HP',
    key: 'KEY',
    bomb: 'BOMB',
    coin: 'COIN',
    damage: 'DMG',
    range: 'RNG',
    fireRate: 'RATE',
    luck: 'LUCK',
    speed: 'SPD',
    floor: 'Floor',
    cleared: 'Cleared',
    left: 'Left',
    room: 'Room',
    enemies: 'Enemies',
    bullets: 'Bullets',
    fps: 'FPS',
    player: 'Player',
    items: 'Items',
    abilities: 'Abilities',
    score: 'Score',
    time: 'Time',
    open: 'open',
    locked: 'locked',
  },
  messages: {
    floor: 'Floor {floor}',
    roomClear: 'Room clear',
    floorCleared: 'Floor cleared',
    nextFloorOpening: 'The passage to the next floor is open',
    stageClear: 'Stage clear',
    shopRoom: 'Shop',
    treasureRoom: 'Treasure room',
    bossRoom: 'Boss room',
    bossPhaseTwo: 'Fault Warden: Phase II',
    rootKernelPhaseTwo: 'ROOT KERNEL: ROOT ACCESS OVERRIDE',
    treasureUnlocked: 'Treasure room unlocked',
    shopUnlocked: 'Shop unlocked',
    keyNeeded: 'A key is needed',
    shopOffer: '{name} · {price} coins · Press F to buy',
    shopCoinsNeeded: 'Not enough coins (need {price})',
    shopHealthFull: 'Health is already full',
    shopResourceFull: 'You cannot carry any more',
    shopPurchased: 'Purchased {name}',
    shopPurchasedSynergy: 'Purchased {name} · Synergy activated: {synergy}',
    itemMaxStacks: '{name}: maximum stack count is {max}',
    itemPickupSynergy: '{name}: {description} · Synergy activated: {synergy}',
    noBombs: 'No bombs left',
    rewardGain: '+{amount} {resource}',
    resourceFull: '{resource} is full',
    chestHealed: 'Chest: healed {amount}',
    chestConsumable: 'Chest: +{amount} {resource}',
    itemPickup: '{name}: {description}',
    itemPreview: '[{rarity} · {category}] {name}: {description}',
    secretItemSpawned: 'Secret input detected: Prism Lance + Quad Shot spawned',
    clear: 'CLEAR',
    localeKo: 'Korean',
    localeEn: 'English',
    quitHint: 'Close the browser tab to quit',
    startFailed: 'Failed to start the game. Please try again',
  },
  resources: {
    hearts: 'Hearts',
    keys: 'Keys',
    bombs: 'Bombs',
    coins: 'Coins',
    chest: 'Chest',
  },
  roomTypes: {
    start: 'Start',
    combat: 'Combat',
    shop: 'Shop',
    treasure: 'Treasure',
    boss: 'Boss',
  },
  shop: {
    greeting: 'Well, look who came by! Come on in.',
    greetingFollowUp: "Take your time. There's no rush at all.",
    products: {
      heart: {
        name: 'Healing Heart',
        description: 'Restores one full heart.',
      },
      key: {
        name: 'Key',
        description: 'Adds one key.',
      },
      bomb: {
        name: 'Bomb',
        description: 'Adds one bomb.',
      },
    },
  },
  items: {
    redMushroom: {
      name: 'Red Mushroom',
      description: 'Adds one maximum heart and restores one full heart.',
    },
    pulseRelay: {
      name: 'Pulse Relay',
      description: 'Fire rate increases (+0.55).',
    },
    glassFern: {
      name: 'Glass Fern',
      description: 'Damage increases (+0.45).',
    },
    featherCoil: {
      name: 'Feather Coil',
      description: 'Move speed increases (+34).',
    },
    hotPebble: {
      name: 'Hot Pebble',
      description:
        'Range, seed speed, and damage all increase (+85 range, +72 seed speed, +0.15 damage).',
    },
    pocketBattery: {
      name: 'Pocket Battery',
      description: 'Adds one maximum heart and restores one full heart.',
    },
    steadyPin: {
      name: 'Steady Pin',
      description: 'Attack speed and seed speed both increase (+0.35 rate, +40 seed speed).',
    },
    moonDial: {
      name: 'Moon Dial',
      description: 'Luck increases, improving reward odds (+1 luck).',
    },
    longEcho: {
      name: 'Long Echo',
      description: 'Range increases significantly (+115).',
    },
    prismLance: {
      name: 'Prism Lance',
      description: 'Replaces seeds with a charged piercing beam. Quad Shot splits it four ways.',
    },
    quadShot: {
      name: 'Quad Shot',
      description:
        'Fires four seeds in a fan. Prism Lance beams also split four ways (attack speed multiplier ×0.42).',
    },
    megaSeed: {
      name: 'Mega Seed',
      description:
        'A huge seed carries excess killing damage through enemies (+4 damage, ×2 damage, ×0.42 attack speed).',
    },
    toothpick: {
      name: 'Toothpick',
      description: 'Attacks faster and turns seeds red (+0.7 attack speed, ×1.16 seed speed).',
    },
    seedPouch: {
      name: 'Seed Pouch',
      description: 'Slightly raises damage and seed speed. Stacks up to 5 times.',
    },
    barkVest: {
      name: 'Bark Vest',
      description: 'Adds and restores half a heart. Stacks up to 3 times.',
    },
    runnerRoots: {
      name: 'Runner Roots',
      description: 'Raises movement speed. Stacks up to 4 times.',
    },
    cloverSprout: {
      name: 'Clover Sprout',
      description: 'Raises luck by 0.5. Stacks up to 4 times.',
    },
    scopeLens: {
      name: 'Scope Lens',
      description: 'Raises range and seed speed. Stacks up to 3 times.',
    },
    thornCrown: {
      name: 'Thorn Crown',
      description: 'Sacrifices half a maximum heart for a large damage increase.',
    },
    rainBoots: {
      name: 'Rain Boots',
      description: 'Greatly raises movement speed and slightly raises range.',
    },
    amberHeart: {
      name: 'Amber Heart',
      description: 'Adds two maximum hearts and restores one. Stacks up to 2 times.',
    },
    overclockBulb: {
      name: 'Overclock Bulb',
      description: 'Greatly raises fire-rate and seed-speed multipliers.',
    },
    luckyLedger: {
      name: 'Lucky Ledger',
      description: 'Raises luck by 2 and slightly raises movement speed.',
    },
    ironHusk: {
      name: 'Iron Husk',
      description:
        'Trades a little speed for one maximum heart and half-heart healing. Stacks up to 3 times.',
    },
    starFertilizer: {
      name: 'Star Fertilizer',
      description: 'Raises the damage multiplier and range. Stacks up to 2 times.',
    },
  },
  rarities: {
    common: 'Common',
    uncommon: 'Uncommon',
    rare: 'Rare',
    legendary: 'Legendary',
  },
  itemCategories: {
    offense: 'Offense',
    defense: 'Defense',
    utility: 'Utility',
    resource: 'Resource',
  },
  synergies: {
    prismArray: 'Prism Array',
    glassHorizon: 'Glass Horizon',
    tunedCircuit: 'Tuned Circuit',
    backupShell: 'Backup Shell',
    compoundLuck: 'Compound Luck',
    meteorSeed: 'Meteor Seed',
  },
};
