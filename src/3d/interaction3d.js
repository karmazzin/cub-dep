(() => {
  const Game = window.CubDep;
  const { BLOCK, BREAK_TIME } = Game.blocks;
  const { EYE_HEIGHT, PLAYER_HEIGHT, PLAYER_RADIUS, REACH_DISTANCE } = Game.constants3d;
  const { getBlock3D, setBlock3D, inBounds3D, isSolidBlock3D, isBlockChunkLoaded3D } = Game.world3d;
  const MIN_SCALE = 0.25;
  const MAX_SCALE = 1024;
  const MIN_PLAYER_COLLISION_RADIUS = 0.05;
  const MIN_PLAYER_COLLISION_HEIGHT = 0.22;
  const MAX_PLAYER_COLLISION_RADIUS = 8;
  const MAX_PLAYER_COLLISION_HEIGHT = 64;
  const MAX_ACTION_CUBE_SIZE = 16;

  const ITEM = {
    SHEEP_SPAWN_EGG: -1,
    BOAR_SPAWN_EGG: -2,
    TURTLE_SPAWN_EGG: -3,
    SNAKE_SPAWN_EGG: -4,
    GOAT_SPAWN_EGG: -5,
    FISH_SPAWN_EGG: -6,
    FILLED_CHEST: -7,
    FOX_SPAWN_EGG: -8,
    POLAR_BEAR_SPAWN_EGG: -9,
    BUILDER_BOT_SPAWN_EGG: -20,
    EXPLORER_BOT_SPAWN_EGG: -21,
    DIGGER_BOT_SPAWN_EGG: -22,
    HUNTER_BOT_SPAWN_EGG: -23,
    GATHERER_BOT_SPAWN_EGG: -24,
    MINER_BOT_SPAWN_EGG: -25,
    BLASTER_BOT_SPAWN_EGG: -26,
    FILLED_STONE_CHEST: -27,
    PAPER: -28,
    NOTE: -29,
    MAP: -30,
  };

  const SPAWN_EGG_TYPES = {
    [ITEM.SHEEP_SPAWN_EGG]: 'sheep',
    [ITEM.BOAR_SPAWN_EGG]: 'boar',
    [ITEM.TURTLE_SPAWN_EGG]: 'turtle',
    [ITEM.SNAKE_SPAWN_EGG]: 'snake',
    [ITEM.GOAT_SPAWN_EGG]: 'goat',
    [ITEM.FISH_SPAWN_EGG]: 'fish',
    [ITEM.FOX_SPAWN_EGG]: 'fox',
    [ITEM.POLAR_BEAR_SPAWN_EGG]: 'bear',
  };

  const BOT_SPAWN_EGG_ROLES = {
    [ITEM.BUILDER_BOT_SPAWN_EGG]: 'builder',
    [ITEM.EXPLORER_BOT_SPAWN_EGG]: 'explorer',
    [ITEM.DIGGER_BOT_SPAWN_EGG]: 'digger',
    [ITEM.HUNTER_BOT_SPAWN_EGG]: 'hunter',
    [ITEM.GATHERER_BOT_SPAWN_EGG]: 'gatherer',
    [ITEM.MINER_BOT_SPAWN_EGG]: 'miner',
    [ITEM.BLASTER_BOT_SPAWN_EGG]: 'blaster',
  };

  const DEFAULT_HOTBAR_ITEMS = [
    BLOCK.DIRT,
    BLOCK.STONE,
    BLOCK.WOOD,
    BLOCK.PLANK,
    BLOCK.WATER,
    BLOCK.SAND,
    ITEM.SHEEP_SPAWN_EGG,
    BLOCK.LEAF,
    BLOCK.LAVA,
    BLOCK.CHEST,
  ];

  const LETTER_BLOCK_IDS = Object.keys(Game.blocks.LETTER_BLOCKS || {}).map(Number).filter((id) => Number.isFinite(id));
  const CREATIVE_BLOCK_ITEMS = [
    BLOCK.DIRT,
    BLOCK.RED_EARTH,
    BLOCK.STONE,
    BLOCK.BROKEN_STONE,
    BLOCK.WOOD,
    BLOCK.PLANK,
    BLOCK.WATER,
    BLOCK.SAND,
    BLOCK.LEAF,
    BLOCK.WOOL,
    BLOCK.LAVA,
    BLOCK.GRASS,
    BLOCK.CHEST,
    BLOCK.STONE_CHEST,
    BLOCK.COBWEB,
    BLOCK.MOSS,
    BLOCK.SMALL_WHITE_MUSHROOM,
    BLOCK.ALGAE,
    BLOCK.PILLAR,
    BLOCK.PATH,
    BLOCK.BLACKSTONE,
    BLOCK.GOLDEN_FLOWER,
    BLOCK.SNOW,
    BLOCK.SPRUCE_WOOD,
    BLOCK.SPRUCE_LEAF,
    BLOCK.DYNAMITE_SMALL,
    BLOCK.DYNAMITE_MEDIUM,
    BLOCK.DYNAMITE_LARGE,
    BLOCK.DYNAMITE_HUGE,
    BLOCK.DYNAMITE_MEGA_HUGE,
    BLOCK.DYNAMITE_POWER_75,
    BLOCK.DYNAMITE_POWER_100,
    BLOCK.TNT_REMOTE,
    BLOCK.STRANGE_PORTAL_STONE,
    BLOCK.STRANGE_PORTAL_CORE,
    BLOCK.STRANGE_PORTAL_RUNE,
    ITEM.PAPER,
    ITEM.NOTE,
    ITEM.MAP,
  ];

  const CREATIVE_ITEMS = [
    ...Array.from(new Set(CREATIVE_BLOCK_ITEMS.filter((id) => Number.isFinite(id)))),
    ITEM.SHEEP_SPAWN_EGG,
    ITEM.BOAR_SPAWN_EGG,
    ITEM.TURTLE_SPAWN_EGG,
    ITEM.SNAKE_SPAWN_EGG,
    ITEM.GOAT_SPAWN_EGG,
    ITEM.FISH_SPAWN_EGG,
    ITEM.FOX_SPAWN_EGG,
    ITEM.POLAR_BEAR_SPAWN_EGG,
    ITEM.BUILDER_BOT_SPAWN_EGG,
    ITEM.EXPLORER_BOT_SPAWN_EGG,
    ITEM.DIGGER_BOT_SPAWN_EGG,
    ITEM.HUNTER_BOT_SPAWN_EGG,
    ITEM.GATHERER_BOT_SPAWN_EGG,
    ITEM.MINER_BOT_SPAWN_EGG,
    ITEM.BLASTER_BOT_SPAWN_EGG,
    ...LETTER_BLOCK_IDS,
  ];
  const HOTBAR_BLOCKS = DEFAULT_HOTBAR_ITEMS;

  const BLOCK_LABELS = {
    [BLOCK.DIRT]: 'Земля',
    [BLOCK.RED_EARTH]: 'Каменистая земля',
    [BLOCK.SCORCHED_DIRT]: 'Обгоревшая земля',
    [BLOCK.STONE]: 'Камень',
    [BLOCK.BROKEN_STONE]: 'Ломанный камень',
    [BLOCK.WOOD]: 'Дерево',
    [BLOCK.LEAF]: 'Листья',
    [BLOCK.PLANK]: 'Доски',
    [BLOCK.WATER]: 'Вода',
    [BLOCK.HOT_WATER]: 'Горячая вода',
    [BLOCK.LAVA]: 'Лава',
    [BLOCK.VOLCANIC_LAVA]: 'Вулканическая лава',
    [BLOCK.BEDROCK]: 'Коренная порода',
    [BLOCK.SAND]: 'Песок',
    [BLOCK.CACTUS]: 'Кактус',
    [BLOCK.DRY_BUSH]: 'Сухой куст',
    [BLOCK.GRASS]: 'Трава',
    [BLOCK.COAL_ORE]: 'Угольная руда',
    [BLOCK.GOLD_ORE]: 'Золотая руда',
    [BLOCK.LADDER]: 'Лестница',
    [BLOCK.DEEPSTONE]: 'Глубинный камень',
    [BLOCK.DEEP_ORE]: 'Глубинная руда',
    [BLOCK.CHEST]: 'Сундук',
    [BLOCK.STONE_CHEST]: 'Каменный сундук',
    [BLOCK.COBWEB]: 'Паутина',
    [BLOCK.DOOR]: 'Дверь',
    [BLOCK.IRON_ORE]: 'Железная руда',
    [BLOCK.DIAMOND_ORE]: 'Алмазная руда',
    [BLOCK.FIRE_SEAL]: 'Огненная печать',
    [BLOCK.FIRE_PORTAL]: 'Огненный портал',
    [BLOCK.FRIENDSHIP_ORE]: 'Руда дружбы',
    [BLOCK.FRIENDSHIP_AMULET]: 'Амулет дружбы',
    [BLOCK.WATER_FRAME]: 'Рамка воды',
    [BLOCK.WATER_CRYSTAL]: 'Кристалл воды',
    [BLOCK.WATER_WELL_FRAME]: 'Рамка водного колодца',
    [BLOCK.WATER_DIMENSION_PORTAL]: 'Портал измерения воды',
    [BLOCK.GOLDEN_GARDEN_SHELL]: 'Оболочка золотого сада',
    [BLOCK.STEAM_ORE]: 'Паровая руда',
    [BLOCK.MAIN_WELL_FRAME]: 'Рамка главного колодца',
    [BLOCK.CLOUD]: 'Облако',
    [BLOCK.STEAM_WATER]: 'Паровая вода',
    [BLOCK.AIR_CRYSTAL]: 'Кристалл воздуха',
    [BLOCK.AIR_ENTRANCE_FRAME]: 'Рамка входа воздуха',
    [BLOCK.AIR_DIMENSION_PORTAL]: 'Портал измерения воздуха',
    [BLOCK.AIR_THIEF_PORTAL]: 'Портал воздушного вора',
    [BLOCK.INVISIBLE_BLOCK]: 'Невидимый блок',
    [BLOCK.INVISIBLE_ORE]: 'Невидимая руда',
    [BLOCK.AIR_HOME_PORTAL]: 'Портал воздушного дома',
    [BLOCK.GREAT_TREE_WOOD]: 'Древесина великого дерева',
    [BLOCK.END_GATE]: 'Конечные врата',
    [BLOCK.ELEMENTAL_RETURN_PORTAL]: 'Портал возвращения стихий',
    [ITEM.SHEEP_SPAWN_EGG]: 'Яйцо призыва овцы',
    [ITEM.BOAR_SPAWN_EGG]: 'Яйцо призыва кабана',
    [ITEM.TURTLE_SPAWN_EGG]: 'Яйцо призыва черепахи',
    [ITEM.SNAKE_SPAWN_EGG]: 'Яйцо призыва змеи',
    [ITEM.GOAT_SPAWN_EGG]: 'Яйцо призыва горного козла',
    [ITEM.FISH_SPAWN_EGG]: 'Яйцо призыва рыбы',
    [ITEM.FOX_SPAWN_EGG]: 'Яйцо призыва лисы',
    [ITEM.POLAR_BEAR_SPAWN_EGG]: 'Яйцо призыва медведя',
    [ITEM.BUILDER_BOT_SPAWN_EGG]: 'Яйцо призыва строителя',
    [ITEM.EXPLORER_BOT_SPAWN_EGG]: 'Яйцо призыва исследователя',
    [ITEM.DIGGER_BOT_SPAWN_EGG]: 'Яйцо призыва копателя',
    [ITEM.HUNTER_BOT_SPAWN_EGG]: 'Яйцо призыва охотника',
    [ITEM.GATHERER_BOT_SPAWN_EGG]: 'Яйцо призыва собирателя',
    [ITEM.MINER_BOT_SPAWN_EGG]: 'Яйцо призыва шахтера',
    [ITEM.BLASTER_BOT_SPAWN_EGG]: 'Яйцо призыва взрывателя',
    [ITEM.FILLED_CHEST]: 'Сундук с вещами',
    [ITEM.FILLED_STONE_CHEST]: 'Каменный сундук с вещами',
    [ITEM.PAPER]: 'Бумага',
    [ITEM.NOTE]: 'Записка',
    [ITEM.MAP]: 'Карта',
    [BLOCK.DYNAMITE_SMALL]: 'ТНТ мощность 1',
    [BLOCK.DYNAMITE_MEDIUM]: 'ТНТ мощность 5',
    [BLOCK.DYNAMITE_LARGE]: 'ТНТ мощность 10',
    [BLOCK.DYNAMITE_HUGE]: 'ТНТ мощность 25',
    [BLOCK.DYNAMITE_MEGA_HUGE]: 'ТНТ мощность 50',
    [BLOCK.DYNAMITE_POWER_75]: 'ТНТ мощность 75',
    [BLOCK.DYNAMITE_POWER_100]: 'ТНТ мощность 100',
    [BLOCK.TNT_REMOTE]: 'Пульт от ТНТ',
    [BLOCK.TNT_TABLE]: 'Стол для ТНТ',
    [BLOCK.CUSTOM_TNT]: 'ТНТ со свойствами',
    [BLOCK.STRANGE_PORTAL_STONE]: 'Камень странного портала',
    [BLOCK.STRANGE_PORTAL_CORE]: 'Сломанное ядро портала',
    [BLOCK.STRANGE_PORTAL_RUNE]: 'Руна странного портала',
    [BLOCK.ACTIVE_STRANGE_PORTAL]: 'Активный странный портал',
    [BLOCK.BORDER]: 'Граница',
    [BLOCK.CALCULATOR]: 'Калькулятор',
    [BLOCK.GLOBE]: 'Глобус',
    [BLOCK.RULER]: 'Линейка',
    [BLOCK.PILLOW]: 'Подушка',
    [BLOCK.WOOL]: 'Шерсть',
    [BLOCK.MOSS]: 'Мох',
    [BLOCK.MUSHROOM_SOIL]: 'Грибная почва',
    [BLOCK.WHITE_MUSHROOM_STEM]: 'Ножка белого гриба',
    [BLOCK.WHITE_MUSHROOM_CAP]: 'Шляпка белого гриба',
    [BLOCK.FLY_AGARIC_STEM]: 'Ножка мухомора',
    [BLOCK.FLY_AGARIC_CAP]: 'Шляпка мухомора',
    [BLOCK.GLOW_MUSHROOM_STEM]: 'Ножка светящегося гриба',
    [BLOCK.GLOW_MUSHROOM_CAP]: 'Шляпка светящегося гриба',
    [BLOCK.SMALL_WHITE_MUSHROOM]: 'Маленький белый гриб',
    [BLOCK.SMALL_FLY_AGARIC]: 'Маленький мухомор',
    [BLOCK.SMALL_GLOW_MUSHROOM]: 'Маленький светящийся гриб',
    [BLOCK.ECHO_CORE]: 'Эхо-ядро',
    [BLOCK.ECHO_SHARD_PEDESTAL]: 'Пьедестал эхо-осколка',
    [BLOCK.ROOT_NODE]: 'Корневой узел',
    [BLOCK.ROOT_CORE]: 'Корневое ядро',
    [BLOCK.ROOT_STONE]: 'Корневой камень',
    [BLOCK.ROOT_PLATFORM]: 'Корневая платформа',
    [BLOCK.PINK_CORAL]: 'Розовый коралл',
    [BLOCK.BLUE_CORAL]: 'Синий коралл',
    [BLOCK.GOLD_CORAL]: 'Золотой коралл',
    [BLOCK.CORAL_STONE]: 'Коралловый камень',
    [BLOCK.GLOW_ALGAE]: 'Светящиеся водоросли',
    [BLOCK.TALL_GLOW_ALGAE]: 'Высокие светящиеся водоросли',
    [BLOCK.ALGAE]: 'Водоросли',
    [BLOCK.TALL_ALGAE]: 'Высокие водоросли',
    [BLOCK.ASH]: 'Пепел',
    [BLOCK.ASH_STONE]: 'Пепельный камень',
    [BLOCK.EMBER_FLOWER]: 'Угольковый цветок',
    [BLOCK.EMBER_SHRUB]: 'Угольковый куст',
    [BLOCK.SEQUOIA_WOOD]: 'Древесина секвойи',
    [BLOCK.SEQUOIA_LEAF]: 'Листья секвойи',
    [BLOCK.SEQUOIA_PLANK]: 'Доски секвойи',
    [BLOCK.PILLAR]: 'Колонна',
    [BLOCK.PATH]: 'Тропа',
    [BLOCK.BLACKSTONE]: 'Черный камень',
    [BLOCK.BASALT]: 'Черный камень',
    [BLOCK.GOLDEN_FLOWER]: 'Золотой цветок',
    [BLOCK.SNOW]: 'Снег',
    [BLOCK.SPRUCE_WOOD]: 'Еловое дерево',
    [BLOCK.SPRUCE_LEAF]: 'Хвоя',
    [BLOCK.LETTER_A]: 'Буква А',
    [BLOCK.LETTER_D]: 'Буква Д',
    [BLOCK.LETTER_E]: 'Буква Е',
    [BLOCK.LETTER_K]: 'Буква К',
    [BLOCK.LETTER_L]: 'Буква Л',
    [BLOCK.LETTER_M]: 'Буква М',
    [BLOCK.LETTER_O]: 'Буква О',
    [BLOCK.LETTER_S]: 'Буква С',
    [BLOCK.LETTER_T]: 'Буква Т',
    [BLOCK.LETTER_YA]: 'Буква Я',
  };
  if (Game.blocks && Game.blocks.LETTER_BLOCKS) {
    for (const [id, letter] of Object.entries(Game.blocks.LETTER_BLOCKS)) {
      BLOCK_LABELS[id] = `Буква ${letter}`;
    }
  }
  for (let digit = 0; digit <= 9; digit += 1) {
    const id = BLOCK[`DIGIT_${digit}`];
    if (Number.isFinite(id)) BLOCK_LABELS[id] = `Цифра ${digit}`;
  }

  const DYNAMITE_CONFIG = {
    [BLOCK.DYNAMITE_SMALL]: { radius: 1, fuse: 2 },
    [BLOCK.DYNAMITE_MEDIUM]: { radius: 5, fuse: 3 },
    [BLOCK.DYNAMITE_LARGE]: { radius: 10, fuse: 4 },
    [BLOCK.DYNAMITE_HUGE]: { radius: 25, fuse: 5, chunked: true },
    [BLOCK.DYNAMITE_MEGA_HUGE]: { radius: 50, fuse: 6, chunked: true },
    [BLOCK.DYNAMITE_POWER_75]: { radius: 75, fuse: 7, chunked: true },
    [BLOCK.DYNAMITE_POWER_100]: { radius: 100, fuse: 8, chunked: true },
  };
  const CUSTOM_TNT_DEFAULTS = {
    power: 1,
    chainReaction: false,
    knockback: false,
    mobileTnt: false,
    movingBlocks: false,
  };
  const CHUNKED_EXPLOSION_CHECK_BUDGET = 18000;
  const CUSTOM_EXPLOSION_CHECK_BUDGET = 24000;
  const CUSTOM_EXPLOSION_IMMEDIATE_CHECK_BUDGET = 52000;
  const CUSTOM_EXPLOSION_TOTAL_CHECK_LIMIT = 480000;
  const CUSTOM_EXPLOSION_BLOCK_LIMIT = 4096;
  const CUSTOM_NEGATIVE_PLACE_LIMIT = 2048;
  const CUSTOM_EXPLOSION_MAX_BLOCK_LIMIT = 120000;
  const CUSTOM_NEGATIVE_MAX_PLACE_LIMIT = 32000;
  const CUSTOM_EXPLOSION_LOAD_CHUNK_RADIUS_MAX = 7;
  const MOVING_BLOCK_LIMIT = 600;
  const EXPLOSION_EFFECT_LIMIT = 24;
  const PREVIEW_FLUID_LIMIT = 1200;
  const PREVIEW_SIDE_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function getLookDirection(player) {
    const cosPitch = Math.cos(player.pitch);
    return {
      x: Math.sin(player.yaw) * cosPitch,
      y: Math.sin(player.pitch),
      z: Math.cos(player.yaw) * cosPitch,
    };
  }

  function isRaycastTargetBlock(id) {
    return isSolidBlock3D(id) || id === BLOCK.DRY_BUSH;
  }

  function raycastBlock(state, includePreviewFluids = false) {
    const player = state.player;
    const scale = Number.isFinite(player.scale) ? Math.max(MIN_SCALE, Math.min(MAX_SCALE, player.scale)) : 1;
    const dir = getLookDirection(player);
    const origin = {
      x: player.x,
      y: player.y + EYE_HEIGHT * scale,
      z: player.z,
    };
    let previous = null;
    const step = 0.045;
    for (let distance = 0; distance <= REACH_DISTANCE; distance += step) {
      const x = Math.floor(origin.x + dir.x * distance);
      const y = Math.floor(origin.y + dir.y * distance);
      const z = Math.floor(origin.z + dir.z * distance);
      const current = { x, y, z };
      if (!inBounds3D(state.world, x, y, z)) {
        previous = current;
        continue;
      }
      const id = getBlock3D(state, x, y, z);
      if (isRaycastTargetBlock(id) || (includePreviewFluids && isPreviewFluid(id))) {
        const normal = previous ? {
          x: Math.max(-1, Math.min(1, previous.x - x)),
          y: Math.max(-1, Math.min(1, previous.y - y)),
          z: Math.max(-1, Math.min(1, previous.z - z)),
        } : { x: 0, y: 1, z: 0 };
        return { x, y, z, id, place: previous, normal, distance };
      }
      previous = current;
    }
    return null;
  }

  function raycastSheep(state) {
    const sheep = state.entities && Array.isArray(state.entities.sheep) ? state.entities.sheep : [];
    if (!sheep.length) return null;
    const player = state.player;
    const scale = Number.isFinite(player.scale) ? Math.max(MIN_SCALE, Math.min(MAX_SCALE, player.scale)) : 1;
    const dir = getLookDirection(player);
    const origin = {
      x: player.x,
      y: player.y + EYE_HEIGHT * scale,
      z: player.z,
    };
    let best = null;
    const step = 0.045;
    for (let distance = 0; distance <= REACH_DISTANCE; distance += step) {
      const px = origin.x + dir.x * distance;
      const py = origin.y + dir.y * distance;
      const pz = origin.z + dir.z * distance;
      for (const item of sheep) {
        const config = Game.entities3d && Game.entities3d.mobConfig ? Game.entities3d.mobConfig(item) : { radius: 0.42, height: 1.08 };
        const radius = Math.max(0.22, (config.radius || 0.34) + 0.08);
        const height = Math.max(0.25, config.height || 1.08);
        const minX = item.x - radius;
        const maxX = item.x + radius;
        const minY = item.y;
        const maxY = item.y + height + 0.12;
        const minZ = item.z - radius;
        const maxZ = item.z + radius;
        if (px < minX || px > maxX || py < minY || py > maxY || pz < minZ || pz > maxZ) continue;
        if (!best || distance < best.distance) best = { sheep: item, distance };
      }
      if (best) return best;
    }
    return null;
  }

  function raycastBot(state) {
    const bots = state && state.entities && Array.isArray(state.entities.bots) ? state.entities.bots : [];
    if (!bots.length) return null;
    const player = state.player;
    const scale = Number.isFinite(player.scale) ? Math.max(MIN_SCALE, Math.min(MAX_SCALE, player.scale)) : 1;
    const dir = getLookDirection(player);
    const origin = {
      x: player.x,
      y: player.y + EYE_HEIGHT * scale,
      z: player.z,
    };
    let best = null;
    const step = 0.045;
    for (let distance = 0; distance <= REACH_DISTANCE; distance += step) {
      const px = origin.x + dir.x * distance;
      const py = origin.y + dir.y * distance;
      const pz = origin.z + dir.z * distance;
      for (const bot of bots) {
        if (!bot) continue;
        const radius = 0.42;
        const minX = bot.x - radius;
        const maxX = bot.x + radius;
        const minY = bot.y;
        const maxY = bot.y + PLAYER_HEIGHT + 0.12;
        const minZ = bot.z - radius;
        const maxZ = bot.z + radius;
        if (px < minX || px > maxX || py < minY || py > maxY || pz < minZ || pz > maxZ) continue;
        if (!best || distance < best.distance) best = { bot, distance };
      }
      if (best) return best;
    }
    return null;
  }

  function blockOverlapsPlayer(state, x, y, z) {
    const player = state.player;
    const scale = Number.isFinite(player.scale) ? Math.max(MIN_SCALE, Math.min(MAX_SCALE, player.scale)) : 1;
    const radius = Math.max(MIN_PLAYER_COLLISION_RADIUS, Math.min(MAX_PLAYER_COLLISION_RADIUS, PLAYER_RADIUS * scale));
    const height = Math.max(MIN_PLAYER_COLLISION_HEIGHT, Math.min(MAX_PLAYER_COLLISION_HEIGHT, PLAYER_HEIGHT * scale));
    const minX = player.x - radius;
    const maxX = player.x + radius;
    const minY = player.y;
    const maxY = player.y + height;
    const minZ = player.z - radius;
    const maxZ = player.z + radius;
    return x < maxX && x + 1 > minX && y < maxY && y + 1 > minY && z < maxZ && z + 1 > minZ;
  }

  function playerActionSize(state) {
    const player = state && state.player;
    const scale = player && Number.isFinite(player.scale) ? Math.max(MIN_SCALE, Math.min(MAX_SCALE, player.scale)) : 1;
    return Math.max(1, Math.min(MAX_ACTION_CUBE_SIZE, Math.floor(scale)));
  }

  function actionCubeCells(origin, size) {
    const cells = [];
    if (!origin) return cells;
    const safeSize = Math.max(1, Math.min(MAX_ACTION_CUBE_SIZE, size | 0));
    const start = -Math.floor((safeSize - 1) / 2);
    for (let dy = 0; dy < safeSize; dy += 1) {
      for (let dz = 0; dz < safeSize; dz += 1) {
        for (let dx = 0; dx < safeSize; dx += 1) {
          cells.push({
            x: origin.x + start + dx,
            y: origin.y + start + dy,
            z: origin.z + start + dz,
          });
        }
      }
    }
    return cells;
  }

  function setNotice(state, text) {
    state.ui.noticeText = text;
    state.ui.noticeTimer = 1.35;
  }

  function digitBlockId(digit) {
    return BLOCK[`DIGIT_${digit}`];
  }

  function buildCalculatorDigits(state, hit, value) {
    if (!state || !hit || !state.world) return false;
    if (!Number.isInteger(value) || value < 0 || value > 9999) {
      setNotice(state, 'Результат нельзя построить цифрами');
      return false;
    }
    const text = String(value);
    const cells = [];
    for (let i = 0; i < text.length; i += 1) {
      const x = hit.x + 1 + i;
      const y = hit.y;
      const z = hit.z;
      if (!inBounds3D(state.world, x, y, z) || getBlock3D(state, x, y, z) !== BLOCK.AIR) {
        setNotice(state, 'Нет места для результата');
        return false;
      }
      cells.push({ x, y, z, id: digitBlockId(text[i]) });
    }
    for (const cell of cells) {
      if (Number.isFinite(cell.id)) setBlock3D(state, cell.x, cell.y, cell.z, cell.id);
    }
    setNotice(state, `Калькулятор: ${value}`);
    return true;
  }

  function openCalculatorForm(state, hit) {
    if (!state || !hit || typeof document === 'undefined') return;
    if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock();
    let root = document.getElementById('calculatorRoot');
    if (!root) {
      root = document.createElement('div');
      root.id = 'calculatorRoot';
      root.className = 'calculator-root';
      document.body.appendChild(root);
    }
    root.classList.remove('is-hidden');
    root.innerHTML = `
      <form class="calculator-panel">
        <div class="calculator-title">Калькулятор</div>
        <div class="calculator-row">
          <input class="calculator-input" name="left" type="number" step="1" placeholder="Первое число" autocomplete="off" />
          <input class="calculator-input" name="right" type="number" step="1" placeholder="Второе число" autocomplete="off" />
        </div>
        <div class="calculator-actions">
          <button type="submit" data-op="+">+</button>
          <button type="submit" data-op="-">-</button>
          <button type="submit" data-op="*">x</button>
          <button type="submit" data-op="/">/</button>
        </div>
        <div class="calculator-result">Результат появится рядом с блоком цифрами.</div>
        <button class="calculator-close" type="button">Закрыть</button>
      </form>
    `;
    const form = root.querySelector('form');
    const result = root.querySelector('.calculator-result');
    const close = () => {
      root.classList.add('is-hidden');
      root.innerHTML = '';
    };
    const closeButton = root.querySelector('.calculator-close');
    if (closeButton) closeButton.addEventListener('click', close);
    if (!form) return;
    const firstInput = form.querySelector('input[name="left"]');
    if (firstInput) firstInput.focus();
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const op = event.submitter && event.submitter.dataset ? event.submitter.dataset.op : '+';
      const data = new FormData(form);
      const left = Number(data.get('left'));
      const right = Number(data.get('right'));
      if (!Number.isFinite(left) || !Number.isFinite(right)) {
        if (result) result.textContent = 'Введите два числа.';
        return;
      }
      if (op === '/' && right === 0) {
        if (result) result.textContent = 'На ноль делить нельзя.';
        return;
      }
      let value = left + right;
      if (op === '-') value = left - right;
      else if (op === '*') value = left * right;
      else if (op === '/') value = left / right;
      if (state.worldMeta && state.worldMeta.education) {
        state.worldMeta.education.calculatorResult = value;
      }
      if (result) result.textContent = `${left} ${op === '*' ? 'x' : op} ${right} = ${value}`;
      buildCalculatorDigits(state, hit, value);
    });
  }

  function openTntTableForm(state) {
    if (!state || !state.worldMeta || !state.worldMeta.explosionPackEnabled) {
      setNotice(state, 'Нужно дополнение "Куча взрывов"');
      return false;
    }
    if (typeof document === 'undefined' || !document.body) return false;
    if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
    let root = document.getElementById('tntTableRoot');
    if (!root) {
      root = document.createElement('div');
      root.id = 'tntTableRoot';
      document.body.appendChild(root);
    }
    root.className = 'calculator-root tnt-table-root';
    if (state.pause) state.pause.open = true;
    root.classList.remove('is-hidden');
    root.innerHTML = `
      <form class="calculator-panel tnt-table-panel">
        <div class="calculator-title">Создать ТНТ</div>
        <label class="tnt-table-field">
          <span>Сила ТНТ</span>
          <input class="calculator-input" name="power" type="number" step="1" value="10" autocomplete="off" />
        </label>
        <label class="tnt-table-check">
          <input type="checkbox" name="chainReaction" value="1" />
          <span>Цепная реакция</span>
        </label>
        <label class="tnt-table-check">
          <input type="checkbox" name="knockback" value="1" />
          <span>Отталкивание</span>
        </label>
        <label class="tnt-table-check">
          <input type="checkbox" name="mobileTnt" value="1" />
          <span>Подвижное ТНТ</span>
        </label>
        <label class="tnt-table-check">
          <input type="checkbox" name="movingBlocks" value="1" />
          <span>Движущиеся блоки</span>
        </label>
        <div class="calculator-result">Будет создан один блок ТНТ со свойствами.</div>
        <div class="calculator-actions">
          <button type="submit">Создать</button>
          <button class="calculator-close" type="button">Закрыть</button>
        </div>
      </form>
    `;
    const form = root.querySelector('form');
    const result = root.querySelector('.calculator-result');
    const close = () => {
      root.classList.add('is-hidden');
      root.innerHTML = '';
      if (state.pause) state.pause.open = false;
    };
    root.onkeydown = (event) => {
      event.stopPropagation();
    };
    const sync = () => {
      const chain = !!(form && form.chainReaction && form.chainReaction.checked);
      if (form && form.mobileTnt) {
        form.mobileTnt.disabled = !chain;
        if (!chain) form.mobileTnt.checked = false;
      }
    };
    const closeButton = root.querySelector('.calculator-close');
    if (closeButton) closeButton.addEventListener('click', close);
    if (!form) return true;
    form.addEventListener('change', sync);
    sync();
    const powerInput = form.querySelector('input[name="power"]');
    if (powerInput) powerInput.focus();
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const power = Number(data.get('power'));
      if (!Number.isFinite(power) || power === 0) {
        if (result) result.textContent = 'Введите любую силу, кроме 0.';
        return;
      }
      const stackData = customTntStackData({
        power,
        chainReaction: data.get('chainReaction') === '1',
        knockback: data.get('knockback') === '1',
        mobileTnt: data.get('mobileTnt') === '1',
        movingBlocks: data.get('movingBlocks') === '1',
      });
      const added = Game.inventory3d && Game.inventory3d.addMinedItem
        ? Game.inventory3d.addMinedItem(state, BLOCK.CUSTOM_TNT, 1, stackData)
        : { added: 0, remaining: 1 };
      if (result) result.textContent = added.remaining > 0 ? 'В инвентаре нет места.' : `Создано: ${customTntLabel(stackData)}`;
      if (added.remaining <= 0) setNotice(state, 'Создано ТНТ со свойствами');
    });
    return true;
  }

  function targetKey(hit) {
    return hit ? `${hit.x},${hit.y},${hit.z}` : '';
  }

  function coordKey(x, y, z) {
    return `${x},${y},${z}`;
  }

  function parseCoordKey(key) {
    const parts = String(key).split(',').map(Number);
    return parts.length === 3 && parts.every((part) => Number.isFinite(part))
      ? { x: parts[0], y: parts[1], z: parts[2] }
      : null;
  }

  function isDynamiteBlock(id) {
    return !!DYNAMITE_CONFIG[id];
  }

  function isAnyTntBlock(id) {
    return isDynamiteBlock(id) || id === BLOCK.CUSTOM_TNT;
  }

  function cloneData(data) {
    if (!data) return null;
    try {
      return JSON.parse(JSON.stringify(data));
    } catch (error) {
      return null;
    }
  }

  function normalizeCustomTntData(data) {
    const source = data && typeof data === 'object' ? data : {};
    const rawPower = Number(source.power);
    const power = Number.isFinite(rawPower) ? Math.max(-1000000, Math.min(1000000, Math.trunc(rawPower))) : 1;
    return {
      power: power === 0 ? 1 : power,
      chainReaction: source.chainReaction === true,
      knockback: source.knockback === true,
      mobileTnt: source.mobileTnt === true && source.chainReaction === true,
      movingBlocks: source.movingBlocks === true,
    };
  }

  function customTntDataAt(state, x, y, z) {
    const key = coordKey(x, y, z);
    const stored = state && state.world && state.world.blockData ? state.world.blockData[key] : null;
    if (stored && stored.type === 'customTnt') return normalizeCustomTntData(stored);
    return normalizeCustomTntData(CUSTOM_TNT_DEFAULTS);
  }

  function setBlockDataAt(state, x, y, z, data) {
    if (!state || !state.world) return;
    if (!state.world.blockData) state.world.blockData = {};
    const key = coordKey(x, y, z);
    if (data) state.world.blockData[key] = cloneData(data);
    else delete state.world.blockData[key];
    if (Game.world3d && Game.world3d.markChunkModified3D) Game.world3d.markChunkModified3D(state, x, y, z);
  }

  function customTntStackData(data) {
    const normalized = normalizeCustomTntData(data);
    return { type: 'customTnt', ...normalized };
  }

  function customTntLabel(data) {
    const normalized = normalizeCustomTntData(data);
    const flags = [];
    if (normalized.chainReaction) flags.push('цепь');
    if (normalized.knockback) flags.push('толчок');
    if (normalized.mobileTnt) flags.push('подвижное');
    if (normalized.movingBlocks) flags.push('блоки');
    return `ТНТ со свойствами: ${normalized.power}${flags.length ? ` (${flags.join(', ')})` : ''}`;
  }

  function isPreviewFluid(id) {
    return id === BLOCK.WATER || id === BLOCK.HOT_WATER || id === BLOCK.LAVA || id === BLOCK.VOLCANIC_LAVA;
  }

  function maxPreviewFluidLevel(fluidId) {
    return fluidId === BLOCK.HOT_WATER ? 7 : 4;
  }

  function canPreviewFluidReplace(state, fluidId, x, y, z) {
    const id = getBlock3D(state, x, y, z);
    if (fluidId === BLOCK.HOT_WATER) return id === BLOCK.AIR || id === BLOCK.WATER || id === BLOCK.HOT_WATER;
    if (fluidId === BLOCK.WATER) return id === BLOCK.AIR || id === BLOCK.WATER;
    return id === BLOCK.AIR || id === BLOCK.LAVA;
  }

  function isPreviewFluidSupport(state, x, y, z) {
    const id = getBlock3D(state, x, y, z);
    return id !== BLOCK.AIR && id !== BLOCK.WATER && id !== BLOCK.HOT_WATER && id !== BLOCK.LAVA && id !== BLOCK.VOLCANIC_LAVA;
  }

  function ensureActiveDynamite(state) {
    if (!state.world.activeDynamite) state.world.activeDynamite = [];
    return state.world.activeDynamite;
  }

  function ensureActiveExplosions(state) {
    if (!state.world.activeExplosions) state.world.activeExplosions = [];
    return state.world.activeExplosions;
  }

  function recordExplosionEffect(state, item) {
    if (!state || !state.world || !item) return;
    if (!Array.isArray(state.world.explosionEffects)) state.world.explosionEffects = [];
    const radius = Math.max(1, Math.abs(Number(item.radius) || 1));
    state.world.explosionEffects.push({
      x: item.x + 0.5,
      y: item.y + 0.5,
      z: item.z + 0.5,
      radius,
      age: 0,
    });
    if (state.world.explosionEffects.length > EXPLOSION_EFFECT_LIMIT) {
      state.world.explosionEffects.splice(0, state.world.explosionEffects.length - EXPLOSION_EFFECT_LIMIT);
    }
  }

  function activateDynamite(state, x, y, z, id) {
    const custom = id === BLOCK.CUSTOM_TNT ? customTntDataAt(state, x, y, z) : null;
    const config = custom ? null : DYNAMITE_CONFIG[id];
    if (!custom && !config) return false;
    const list = ensureActiveDynamite(state);
    const key = coordKey(x, y, z);
    if (list.some((item) => item.key === key)) {
      setNotice(state, 'Динамит уже активирован');
      return true;
    }
    const radius = custom ? Math.max(1, Math.abs(custom.power)) : config.radius;
    const fuse = custom ? 0.8 : config.fuse;
    list.push({
      key,
      x,
      y,
      z,
      id,
      radius,
      fuse,
      timer: fuse,
      chunked: custom ? true : !!config.chunked,
      custom,
    });
    setNotice(state, 'Динамит активирован');
    return true;
  }

  function bindTntRemoteTarget(state, hit) {
    if (!state.player) return false;
    const list = state.world && state.world.activeDynamite;
    const key = coordKey(hit.x, hit.y, hit.z);
    if (Array.isArray(list) && list.some((item) => item.key === key)) {
      setNotice(state, 'Динамит уже активирован');
      return true;
    }
    state.player.tntRemoteTarget = { x: hit.x, y: hit.y, z: hit.z };
    setNotice(state, 'ТНТ привязан к пульту');
    return true;
  }

  function activateTntRemoteTarget(state) {
    const target = state.player && state.player.tntRemoteTarget;
    if (!target) {
      setNotice(state, 'Пульт не привязан');
      return true;
    }
    const id = getBlock3D(state, target.x, target.y, target.z);
    if (!isDynamiteBlock(id)) {
      setNotice(state, 'ТНТ не найден');
      return true;
    }
    activateDynamite(state, target.x, target.y, target.z, id);
    return true;
  }

  function portalFramePositions(coreX, coreY, coreZ, axis) {
    const positions = [];
    const baseY = coreY - 2;
    for (let v = 0; v <= 6; v += 1) {
      for (const u of [-2, 2]) positions.push(axis === 'x' ? { x: coreX, y: baseY + v, z: coreZ + u } : { x: coreX + u, y: baseY + v, z: coreZ });
    }
    for (let u = -2; u <= 2; u += 1) positions.push(axis === 'x' ? { x: coreX, y: baseY + 6, z: coreZ + u } : { x: coreX + u, y: baseY + 6, z: coreZ });
    for (let u = -1; u <= 1; u += 1) positions.push(axis === 'x' ? { x: coreX, y: baseY, z: coreZ + u } : { x: coreX + u, y: baseY, z: coreZ });
    return positions;
  }

  function portalInnerPositions(coreX, coreY, coreZ, axis) {
    const positions = [];
    const baseY = coreY - 2;
    for (let v = 1; v <= 5; v += 1) {
      for (let u = -1; u <= 1; u += 1) {
        if (u === 0 && v === 2) continue;
        positions.push(axis === 'x' ? { x: coreX, y: baseY + v, z: coreZ + u } : { x: coreX + u, y: baseY + v, z: coreZ });
      }
    }
    return positions;
  }

  function isPortalFrameComplete(state, coreX, coreY, coreZ, axis) {
    if (getBlock3D(state, coreX, coreY, coreZ) !== BLOCK.STRANGE_PORTAL_CORE) return false;
    for (const pos of portalFramePositions(coreX, coreY, coreZ, axis)) {
      if (getBlock3D(state, pos.x, pos.y, pos.z) !== BLOCK.STRANGE_PORTAL_STONE) return false;
    }
    for (const pos of portalInnerPositions(coreX, coreY, coreZ, axis)) {
      const id = getBlock3D(state, pos.x, pos.y, pos.z);
      if (id !== BLOCK.AIR && id !== BLOCK.ACTIVE_STRANGE_PORTAL) return false;
    }
    return true;
  }

  function ensurePortalLink(state, coreX, coreY, coreZ, axis) {
    if (!state.worldMeta) return null;
    if (!Array.isArray(state.worldMeta.portalLinks)) state.worldMeta.portalLinks = [];
    const dimension = state.worldMeta.currentDimension === 'underground' ? 'underground' : 'overworld';
    const key = coordKey(coreX, coreY, coreZ);
    let link = state.worldMeta.portalLinks.find((item) => item && item[dimension] && coordKey(item[dimension].x, item[dimension].y, item[dimension].z) === key);
    if (link) return link;
    const id = `${Date.now().toString(36)}-${state.worldMeta.portalLinks.length}`;
    const undergroundX = 256 + ((state.worldMeta.portalLinks.length * 389) % Math.max(1, state.world.w - 512));
    const undergroundZ = 256 + ((state.worldMeta.portalLinks.length * 571) % Math.max(1, state.world.d - 512));
    link = {
      id,
      overworld: dimension === 'overworld' ? { x: coreX, y: coreY, z: coreZ, axis } : null,
      underground: dimension === 'underground'
        ? { x: coreX, y: coreY, z: coreZ, axis }
        : { x: Math.floor(undergroundX), y: 22, z: Math.floor(undergroundZ), axis },
    };
    state.worldMeta.portalLinks.push(link);
    state.worldMeta.updatedAt = Date.now();
    if (Game.storage3d && Game.storage3d.saveWorldMeta && state.worldMeta.id) Game.storage3d.saveWorldMeta(state.worldMeta);
    return link;
  }

  function activatePortalAtCore(state, coreX, coreY, coreZ, axis) {
    if (!isPortalFrameComplete(state, coreX, coreY, coreZ, axis)) return false;
    ensurePortalLink(state, coreX, coreY, coreZ, axis);
    for (const pos of portalInnerPositions(coreX, coreY, coreZ, axis)) setBlock3D(state, pos.x, pos.y, pos.z, BLOCK.ACTIVE_STRANGE_PORTAL);
    setNotice(state, 'Странный портал активирован');
    return true;
  }

  function deactivatePortalAtCore(state, coreX, coreY, coreZ, axis) {
    const dimension = state.worldMeta && state.worldMeta.currentDimension === 'underground' ? 'underground' : 'overworld';
    const links = state.worldMeta && Array.isArray(state.worldMeta.portalLinks) ? state.worldMeta.portalLinks : [];
    const hasRegisteredCore = links.some((link) => {
      const portal = link && link[dimension];
      return portal
        && (portal.axis || 'x') === axis
        && portal.x === coreX
        && portal.y === coreY
        && portal.z === coreZ;
    });
    if (!hasRegisteredCore) return;
    for (const pos of portalInnerPositions(coreX, coreY, coreZ, axis)) {
      if (getBlock3D(state, pos.x, pos.y, pos.z) === BLOCK.ACTIVE_STRANGE_PORTAL) setBlock3D(state, pos.x, pos.y, pos.z, BLOCK.AIR);
    }
  }

  function syncNearbyStrangePortals(state, x, y, z) {
    for (const axis of ['x', 'z']) {
      for (let dy = -5; dy <= 3; dy += 1) {
        for (let du = -2; du <= 2; du += 1) {
          const coreX = axis === 'x' ? x : x + du;
          const coreY = y + dy;
          const coreZ = axis === 'x' ? z + du : z;
          if (!inBounds3D(state.world, coreX, coreY, coreZ)) continue;
          if (isPortalFrameComplete(state, coreX, coreY, coreZ, axis)) activatePortalAtCore(state, coreX, coreY, coreZ, axis);
          else deactivatePortalAtCore(state, coreX, coreY, coreZ, axis);
        }
      }
    }
  }

  function activateFluidAroundChange(state, x, y, z) {
    if (Game.fluids3d && Game.fluids3d.activateFluidAround3D) Game.fluids3d.activateFluidAround3D(state, x, y, z);
  }

  function buildFluidPreview(state, hit) {
    if (state.worldMeta && state.worldMeta.superOptimization) return { type: 'fluid', fluidId: hit.id, cells: [], truncated: false };
    const fluidId = hit.id;
    const maxLevel = maxPreviewFluidLevel(fluidId);
    const queue = [{ x: hit.x, y: hit.y, z: hit.z, level: 0 }];
    const best = new Map();
    const cells = [];
    while (queue.length && cells.length < PREVIEW_FLUID_LIMIT) {
      const current = queue.shift();
      if (!inBounds3D(state.world, current.x, current.y, current.z)) continue;
      if (!(current.x === hit.x && current.y === hit.y && current.z === hit.z)
        && !canPreviewFluidReplace(state, fluidId, current.x, current.y, current.z)) continue;
      const key = coordKey(current.x, current.y, current.z);
      const previous = best.get(key);
      if (previous !== undefined && previous <= current.level) continue;
      best.set(key, current.level);
      cells.push({ x: current.x, y: current.y, z: current.z });

      const belowY = current.y - 1;
      if (inBounds3D(state.world, current.x, belowY, current.z)
        && canPreviewFluidReplace(state, fluidId, current.x, belowY, current.z)) {
        queue.push({ x: current.x, y: belowY, z: current.z, level: 0 });
      }

      const nextLevel = current.level + 1;
      if (nextLevel > maxLevel) continue;
      if (!isPreviewFluidSupport(state, current.x, current.y - 1, current.z)) continue;
      for (const [dx, dz] of PREVIEW_SIDE_DIRS) {
        const nx = current.x + dx;
        const nz = current.z + dz;
        if (!inBounds3D(state.world, nx, current.y, nz)) continue;
        if (!canPreviewFluidReplace(state, fluidId, nx, current.y, nz)) continue;
        queue.push({ x: nx, y: current.y, z: nz, level: nextLevel });
      }
    }
    return { type: 'fluid', fluidId, cells, truncated: queue.length > 0 };
  }

  function togglePreview(state, hit) {
    if (state.ui.preview) {
      state.ui.preview = null;
      setNotice(state, 'Предпросмотр выключен');
      return;
    }
    if (!hit) {
      setNotice(state, 'Нет блока для предпросмотра');
      return;
    }
    if (isPreviewFluid(hit.id)) {
      const preview = buildFluidPreview(state, hit);
      state.ui.preview = preview;
      setNotice(state, preview.truncated ? 'Предпросмотр жидкости ограничен' : 'Предпросмотр жидкости');
      return;
    }
    if (isAnyTntBlock(hit.id)) {
      const custom = hit.id === BLOCK.CUSTOM_TNT ? customTntDataAt(state, hit.x, hit.y, hit.z) : null;
      state.ui.preview = {
        type: 'tnt',
        x: hit.x,
        y: hit.y,
        z: hit.z,
        radius: custom ? Math.max(1, Math.abs(custom.power)) : DYNAMITE_CONFIG[hit.id].radius,
      };
      setNotice(state, 'Предпросмотр взрыва');
      return;
    }
    setNotice(state, 'Нет предпросмотра');
  }

  function canExplodeBlock(id) {
    return id !== BLOCK.AIR
      && id !== BLOCK.BEDROCK
      && id !== BLOCK.WATER
      && id !== BLOCK.HOT_WATER
      && id !== BLOCK.LAVA
      && id !== BLOCK.VOLCANIC_LAVA;
  }

  function movingBlocks(state) {
    if (!state.world.movingBlocks) state.world.movingBlocks = [];
    return state.world.movingBlocks;
  }

  function canSpawnMovingBlock(state) {
    return movingBlocks(state).length < MOVING_BLOCK_LIMIT;
  }

  function pushVelocityFromCenter(item, x, y, z, speed) {
    const dx = x + 0.5 - (item.x + 0.5);
    const dy = y + 0.5 - (item.y + 0.5);
    const dz = z + 0.5 - (item.z + 0.5);
    const len = Math.max(0.01, Math.hypot(dx, dy, dz));
    return {
      vx: dx / len * speed,
      vy: dy / len * speed + Math.min(2.5, speed * 0.28),
      vz: dz / len * speed,
    };
  }

  function spawnMovingBlock(state, x, y, z, id, data, velocity, options = {}) {
    if (!canSpawnMovingBlock(state)) return false;
    movingBlocks(state).push({
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      blockId: id,
      data: cloneData(data),
      x: x + 0.5,
      y: y + 0.5,
      z: z + 0.5,
      vx: velocity.vx || 0,
      vy: velocity.vy || 0,
      vz: velocity.vz || 0,
      gravitySuspendedRadius: Number.isFinite(options.gravitySuspendedRadius) ? Math.max(0, options.gravitySuspendedRadius) : 0,
      ox: Number.isFinite(options.ox) ? options.ox : x + 0.5,
      oy: Number.isFinite(options.oy) ? options.oy : y + 0.5,
      oz: Number.isFinite(options.oz) ? options.oz : z + 0.5,
      mobileTnt: options.mobileTnt === true,
    });
    return true;
  }

  function entityNearPoint(state, x, y, z, radius) {
    const r = Math.max(0.1, radius || 0.7);
    const rSq = r * r;
    const sheep = state.entities && Array.isArray(state.entities.sheep) ? state.entities.sheep : [];
    for (const mob of sheep) {
      const dx = (mob.x || 0) - x;
      const dy = ((mob.y || 0) + 0.7) - y;
      const dz = (mob.z || 0) - z;
      if (dx * dx + dy * dy + dz * dz <= rSq) return true;
    }
    const bots = state.entities && Array.isArray(state.entities.bots) ? state.entities.bots : [];
    for (const bot of bots) {
      const dx = (bot.x || 0) - x;
      const dy = ((bot.y || 0) + 0.9) - y;
      const dz = (bot.z || 0) - z;
      if (dx * dx + dy * dy + dz * dz <= rSq) return true;
    }
    return false;
  }

  function placeMovingBlock(state, item, bx, by, bz) {
    if (!inBounds3D(state.world, bx, by, bz)) return false;
    const target = getBlock3D(state, bx, by, bz);
    if (target !== BLOCK.AIR) return false;
    if (!setBlock3D(state, bx, by, bz, item.blockId)) return false;
    if (item.blockId === BLOCK.CUSTOM_TNT) setBlockDataAt(state, bx, by, bz, item.data);
    return true;
  }

  function applyExplosionKnockback(state, item) {
    const radius = Math.max(1, Number(item && item.radius) || 1);
    const push = (entity, height = PLAYER_HEIGHT * 0.5, options = {}) => {
      if (!entity) return;
      let dx = entity.x - (item.x + 0.5);
      const dy = (entity.y + height) - (item.y + 0.5);
      let dz = entity.z - (item.z + 0.5);
      const horizontal = Math.hypot(dx, dz);
      if (horizontal < 0.001) {
        dx = 1;
        dz = 0;
      }
      const dist = Math.max(0.01, Math.hypot(dx, dy, dz));
      if (dist > radius + 1) return;
      const targetDist = Math.max(1.8, radius + 0.8);
      const remaining = Math.max(0.8, targetDist - dist);
      const maxSpeed = options.maxSpeed || 44;
      const speed = Math.min(maxSpeed, Math.max(6, remaining / 0.55));
      const dirLen = Math.max(0.001, Math.hypot(dx, dz));
      entity.vx = dx / dirLen * speed;
      entity.vz = dz / dirLen * speed;
      entity.vy = Math.min(options.maxY || 32, Math.max(entity.vy || 0, 3.5 + Math.min(18, speed * 0.26)));
      if (options.markMob) {
        entity.explosionKnockbackTimer = Math.min(1.4, Math.max(0.35, remaining / Math.max(1, speed)));
        entity.panicTimer = Math.max(entity.panicTimer || 0, entity.explosionKnockbackTimer);
        entity.pauseTimer = 0;
        entity.eating = false;
        entity.sleeping = false;
      }
      entity.onGround = false;
    };
    push(state.player, PLAYER_HEIGHT * 0.5, { maxSpeed: 38, maxY: 28 });
    const sheep = state.entities && Array.isArray(state.entities.sheep) ? state.entities.sheep : [];
    sheep.forEach((mob) => push(mob, 0.7, { markMob: true, maxSpeed: 62, maxY: 34 }));
    const bots = state.entities && Array.isArray(state.entities.bots) ? state.entities.bots : [];
    bots.forEach((bot) => push(bot, 0.9, { markMob: true, maxSpeed: 62, maxY: 34 }));
  }

  function queueChainReaction(state, sourceItem, x, y, z, id, data) {
    if (!sourceItem.custom || !sourceItem.custom.chainReaction) return false;
    if (!isAnyTntBlock(id)) return false;
    const key = coordKey(x, y, z);
    const active = ensureActiveDynamite(state);
    if (active.some((item) => item.key === key)) return true;
    if (id === BLOCK.CUSTOM_TNT) {
      const tntData = normalizeCustomTntData(data || customTntDataAt(state, x, y, z));
      if (tntData.mobileTnt) {
        const speed = Math.min(34, Math.max(7, Math.sqrt(Math.abs(sourceItem.custom.power)) * 1.8));
        const velocity = pushVelocityFromCenter(sourceItem, x, y, z, speed);
        if (setBlock3D(state, x, y, z, BLOCK.AIR)) {
          spawnMovingBlock(state, x, y, z, BLOCK.CUSTOM_TNT, customTntStackData(tntData), velocity, { mobileTnt: true });
          return true;
        }
      }
      active.push({
        key,
        x,
        y,
        z,
        id,
        radius: Math.max(1, Math.abs(tntData.power)),
        fuse: 0.25,
        timer: 0.25,
        chunked: true,
        custom: tntData,
      });
      return true;
    }
    const config = DYNAMITE_CONFIG[id];
    if (!config) return false;
    active.push({ key, x, y, z, id, radius: config.radius, fuse: 0.25, timer: 0.25, chunked: !!config.chunked });
    return true;
  }

  function processCustomExplosionBlock(state, explosion, x, y, z, id) {
    const custom = normalizeCustomTntData(explosion.custom);
    const data = id === BLOCK.CUSTOM_TNT ? customTntStackData(customTntDataAt(state, x, y, z)) : null;
    if (queueChainReaction(state, explosion, x, y, z, id, data)) return true;
    if (custom.power < 0) {
      if (explosion.spawned >= (explosion.placeLimit || CUSTOM_NEGATIVE_PLACE_LIMIT) || id !== BLOCK.AIR) return false;
      if (setBlock3D(state, x, y, z, BLOCK.CUSTOM_TNT)) {
        setBlockDataAt(state, x, y, z, customTntStackData({ ...custom, power: Math.abs(custom.power) }));
        explosion.spawned += 1;
        return true;
      }
      return false;
    }
    if (!canExplodeBlock(id) || explosion.broken >= (explosion.blockLimit || CUSTOM_EXPLOSION_BLOCK_LIMIT)) return false;
    if (suppressFluidDrop(state, x, y, z)) {
      const removed = setBlock3D(state, x, y, z, BLOCK.AIR);
      if (removed) activateFluidAroundChange(state, x, y, z);
      return removed;
    }
    if (custom.movingBlocks && id !== BLOCK.CUSTOM_TNT && !isDynamiteBlock(id) && canSpawnMovingBlock(state)) {
      const speed = Math.min(30, Math.max(5, Math.sqrt(Math.abs(custom.power)) * 1.4));
      const velocity = pushVelocityFromCenter(explosion, x, y, z, speed);
      if (setBlock3D(state, x, y, z, BLOCK.AIR)) {
        spawnMovingBlock(state, x, y, z, id, null, velocity, {
          gravitySuspendedRadius: Math.min(Math.max(1, Math.abs(custom.power)), 96),
          ox: explosion.x + 0.5,
          oy: explosion.y + 0.5,
          oz: explosion.z + 0.5,
        });
        activateFluidAroundChange(state, x, y, z);
        return true;
      }
      return false;
    }
    if (Game.inventory3d && Game.inventory3d.addMinedItem) Game.inventory3d.addMinedItem(state, id, 1, data);
    if (setBlock3D(state, x, y, z, BLOCK.AIR)) {
      activateFluidAroundChange(state, x, y, z);
      return true;
    }
    return false;
  }

  function explodeMovingTnt(state, item) {
    const bx = Math.max(0, Math.min(state.world.w - 1, Math.floor(item.x)));
    const by = Math.max(1, Math.min(state.world.h - 1, Math.floor(item.y)));
    const bz = Math.max(0, Math.min(state.world.d - 1, Math.floor(item.z)));
    const data = customTntStackData(item.data);
    setBlock3D(state, bx, by, bz, BLOCK.CUSTOM_TNT);
    setBlockDataAt(state, bx, by, bz, data);
    explodeDynamite(state, {
      key: coordKey(bx, by, bz),
      x: bx,
      y: by,
      z: bz,
      id: BLOCK.CUSTOM_TNT,
      radius: Math.max(1, Math.abs(data.power)),
      custom: normalizeCustomTntData(data),
      chunked: true,
    });
    return true;
  }

  function updateMovingBlocks(state, dt) {
    const list = state && state.world && Array.isArray(state.world.movingBlocks) ? state.world.movingBlocks : [];
    if (!list.length) return;
    const next = [];
    for (const item of list) {
      const ox = Number.isFinite(item.ox) ? item.ox : item.x;
      const oy = Number.isFinite(item.oy) ? item.oy : item.y;
      const oz = Number.isFinite(item.oz) ? item.oz : item.z;
      const suspended = item.gravitySuspendedRadius > 0
        && Math.hypot(item.x - ox, item.y - oy, item.z - oz) <= item.gravitySuspendedRadius;
      if (!suspended) item.vy -= 18 * dt;
      item.x += item.vx * dt;
      item.y += item.vy * dt;
      item.z += item.vz * dt;
      const bx = Math.floor(item.x);
      const by = Math.floor(item.y);
      const bz = Math.floor(item.z);
      const hitWorld = !inBounds3D(state.world, bx, by, bz) || getBlock3D(state, bx, by, bz) !== BLOCK.AIR;
      const hitMob = entityNearPoint(state, item.x, item.y, item.z, 0.7);
      if (item.mobileTnt && (hitWorld || hitMob || isAnyTntBlock(getBlock3D(state, bx, by, bz)))) {
        explodeMovingTnt(state, item);
        continue;
      }
      if (hitWorld || hitMob) {
        const px = Math.floor(item.x - item.vx * dt);
        const py = Math.floor(item.y - item.vy * dt);
        const pz = Math.floor(item.z - item.vz * dt);
        if (!placeMovingBlock(state, item, px, py, pz)) {
          Game.inventory3d && Game.inventory3d.addMinedItem && Game.inventory3d.addMinedItem(state, item.blockId, 1, item.data);
        }
        continue;
      }
      next.push(item);
    }
    state.world.movingBlocks = next.slice(0, MOVING_BLOCK_LIMIT);
  }

  function chunkBounds(world, chunk) {
    const size = Game.constants3d && Game.constants3d.CHUNK_SIZE ? Game.constants3d.CHUNK_SIZE : 16;
    return {
      minX: chunk.cx * size,
      minY: chunk.cy * size,
      minZ: chunk.cz * size,
      maxX: Math.min(world.w, chunk.cx * size + size),
      maxY: Math.min(world.h, chunk.cy * size + size),
      maxZ: Math.min(world.d, chunk.cz * size + size),
      size,
    };
  }

  function chunkIntersectsSphere(world, chunk, item) {
    const bounds = chunkBounds(world, chunk);
    const cx = Math.max(bounds.minX, Math.min(item.x, bounds.maxX - 1));
    const cy = Math.max(bounds.minY, Math.min(item.y, bounds.maxY - 1));
    const cz = Math.max(bounds.minZ, Math.min(item.z, bounds.maxZ - 1));
    const dx = cx - item.x;
    const dy = cy - item.y;
    const dz = cz - item.z;
    return dx * dx + dy * dy + dz * dz <= item.radius * item.radius;
  }

  function chunkDistanceScore(world, chunk, item) {
    const bounds = chunkBounds(world, chunk);
    const cx = (bounds.minX + bounds.maxX - 1) * 0.5;
    const cy = (bounds.minY + bounds.maxY - 1) * 0.5;
    const cz = (bounds.minZ + bounds.maxZ - 1) * 0.5;
    const dx = cx - item.x;
    const dy = cy - item.y;
    const dz = cz - item.z;
    return dx * dx + dy * dy + dz * dz;
  }

  function customExplosionScale(radius) {
    return Math.max(1, Math.log10(Math.max(1, Number(radius) || 1) + 1));
  }

  function customExplosionBlockLimit(radius) {
    const scale = customExplosionScale(radius);
    return Math.min(CUSTOM_EXPLOSION_MAX_BLOCK_LIMIT, Math.max(CUSTOM_EXPLOSION_BLOCK_LIMIT, Math.floor(2200 * scale * scale * scale)));
  }

  function customNegativePlaceLimit(radius) {
    const scale = customExplosionScale(radius);
    return Math.min(CUSTOM_NEGATIVE_MAX_PLACE_LIMIT, Math.max(CUSTOM_NEGATIVE_PLACE_LIMIT, Math.floor(850 * scale * scale * scale)));
  }

  function customExplosionTotalCheckLimit(radius) {
    const scale = customExplosionScale(radius);
    return Math.min(1800000, Math.max(CUSTOM_EXPLOSION_TOTAL_CHECK_LIMIT, Math.floor(160000 * scale * scale)));
  }

  function customExplosionLoadChunkRadius(radius) {
    if (!Number.isFinite(radius) || radius <= 0) return 1;
    const chunkSize = Game.constants3d && Game.constants3d.CHUNK_SIZE ? Game.constants3d.CHUNK_SIZE : 16;
    return Math.min(CUSTOM_EXPLOSION_LOAD_CHUNK_RADIUS_MAX, Math.max(1, Math.ceil(Math.min(radius, 112) / chunkSize)));
  }

  function collectExplosionChunks(state, explosion) {
    const world = state && state.world;
    if (!world || !world.chunks || !explosion) return;
    const seen = explosion.chunkSet || (explosion.chunkSet = {});
    const entries = [];
    for (const [key, chunk] of world.chunks || []) {
      if (seen[key] || !chunk || !chunk.blocks || !chunkIntersectsSphere(world, chunk, explosion)) continue;
      entries.push({ key, score: chunkDistanceScore(world, chunk, explosion) });
    }
    entries.sort((a, b) => a.score - b.score);
    if (!Array.isArray(explosion.chunks)) explosion.chunks = [];
    for (const entry of entries) {
      seen[entry.key] = true;
      explosion.chunks.push(entry.key);
    }
  }

  function ensureCustomExplosionChunks(state, explosion) {
    if (!explosion || !explosion.custom || !Game.generation3d || !Game.generation3d.ensureChunksAroundPoint3D) return;
    const radius = Number.isFinite(explosion.loadChunkRadius) ? explosion.loadChunkRadius : customExplosionLoadChunkRadius(explosion.radius);
    Game.generation3d.ensureChunksAroundPoint3D(state, explosion.x + 0.5, explosion.y + 0.5, explosion.z + 0.5, radius);
    collectExplosionChunks(state, explosion);
  }

  function beginChunkedExplosion(state, item) {
    const world = state.world;
    const custom = item.custom ? normalizeCustomTntData(item.custom) : null;
    recordExplosionEffect(state, item);
    const chunks = [];
    const chunkSet = {};
    const temporaryExplosion = { ...item, chunks, chunkSet };
    if (custom && Game.generation3d && Game.generation3d.ensureChunksAroundPoint3D) {
      temporaryExplosion.loadChunkRadius = customExplosionLoadChunkRadius(item.radius);
      Game.generation3d.ensureChunksAroundPoint3D(state, item.x + 0.5, item.y + 0.5, item.z + 0.5, temporaryExplosion.loadChunkRadius);
    }
    collectExplosionChunks(state, temporaryExplosion);
    if (!custom && Game.inventory3d && Game.inventory3d.addMinedItem) Game.inventory3d.addMinedItem(state, item.id, 1);
    if (setBlock3D(state, item.x, item.y, item.z, BLOCK.AIR)) activateFluidAroundChange(state, item.x, item.y, item.z);
    damageEntitiesFromExplosion(state, item);
    if (custom && custom.knockback) applyExplosionKnockback(state, item);
    const explosion = {
      x: item.x,
      y: item.y,
      z: item.z,
      radius: item.radius,
      radiusSq: item.radius * item.radius,
      custom,
      chunks,
      chunkSet,
      loadChunkRadius: custom ? customExplosionLoadChunkRadius(item.radius) : 0,
      blockLimit: custom ? customExplosionBlockLimit(item.radius) : 0,
      placeLimit: custom ? customNegativePlaceLimit(item.radius) : 0,
      totalCheckLimit: custom ? customExplosionTotalCheckLimit(item.radius) : 0,
      chunkIndex: 0,
      blockIndex: 0,
      broken: 0,
      checks: 0,
      spawned: 0,
    };
    ensureActiveExplosions(state).push(explosion);
    if (custom) processChunkedExplosions(state, { budgetOverride: CUSTOM_EXPLOSION_IMMEDIATE_CHECK_BUDGET });
    const changed = custom ? (explosion.broken || explosion.spawned || 0) : 0;
    setNotice(state, custom && changed > 0 ? `Взрыв начался: сразу ${changed}` : `Взрыв начался: чанков ${chunks.length}`);
    if (Game.audio && Game.audio.playHit) Game.audio.playHit();
  }

  function explodeDynamite(state, item) {
    if (item.custom) {
      item.radius = Math.max(1, Math.abs(normalizeCustomTntData(item.custom).power));
      item.chunked = true;
    }
    if (item.chunked) {
      beginChunkedExplosion(state, item);
      return;
    }
    const world = state.world;
    const radius = Math.max(1, item.radius | 0);
    const radiusSq = radius * radius;
    let broken = 0;
    const destroyedActiveKeys = new Set();
    recordExplosionEffect(state, item);
    damageEntitiesFromExplosion(state, item);
    for (let y = Math.max(1, item.y - radius); y <= Math.min(world.h - 1, item.y + radius); y += 1) {
      for (let z = Math.max(0, item.z - radius); z <= Math.min(world.d - 1, item.z + radius); z += 1) {
        for (let x = Math.max(0, item.x - radius); x <= Math.min(world.w - 1, item.x + radius); x += 1) {
          const dx = x - item.x;
          const dy = y - item.y;
          const dz = z - item.z;
          if (dx * dx + dy * dy + dz * dz > radiusSq) continue;
          const id = getBlock3D(state, x, y, z);
          if (!canExplodeBlock(id)) continue;
          if (item.custom && processCustomExplosionBlock(state, item, x, y, z, id)) {
            broken += 1;
            destroyedActiveKeys.add(coordKey(x, y, z));
            continue;
          }
          if (!suppressFluidDrop(state, x, y, z) && Game.inventory3d && Game.inventory3d.addMinedItem) Game.inventory3d.addMinedItem(state, id, 1);
          if (setBlock3D(state, x, y, z, BLOCK.AIR)) {
            broken += 1;
            activateFluidAroundChange(state, x, y, z);
            destroyedActiveKeys.add(coordKey(x, y, z));
          }
        }
      }
    }
    if (state.world.activeDynamite && destroyedActiveKeys.size) {
      state.world.activeDynamite = state.world.activeDynamite.filter((active) => !destroyedActiveKeys.has(active.key));
    }
    setNotice(state, broken > 0 ? `Взрыв: разрушено ${broken}` : 'Взрыв');
    if (Game.audio && Game.audio.playHit) Game.audio.playHit();
  }

  function damagePlayerFromExplosion(state, item) {
    const player = state && state.player;
    if (!player || !Game.player3d || !Game.player3d.applyPlayerDamage3D) return;
    const radius = Math.max(1, Number(item && item.radius) || 1);
    const dx = player.x - (item.x + 0.5);
    const dy = (player.y + PLAYER_HEIGHT * 0.5) - (item.y + 0.5);
    const dz = player.z - (item.z + 0.5);
    const dist = Math.hypot(dx, dy, dz);
    const effectiveRadius = Math.max(radius + 0.8, 1.8);
    if (dist > effectiveRadius) return;
    const maxDamage = Math.max(30, Math.min(140, radius * 12));
    const damage = maxDamage * (1 - dist / effectiveRadius);
    Game.player3d.applyPlayerDamage3D(state, damage, 'взрыв ТНТ', { cooldown: 0.45 });
  }

  function damageBotsFromExplosion(state, item) {
    if (!state || !state.entities || !Array.isArray(state.entities.bots) || !Game.bots3d || !Game.bots3d.damageBot3D) return;
    const radius = Math.max(1, Number(item && item.radius) || 1);
    const effectiveRadius = Math.max(radius + 0.8, 1.8);
    const bots = state.entities.bots.slice();
    for (const bot of bots) {
      if (!bot) continue;
      const dx = bot.x - (item.x + 0.5);
      const dy = (bot.y + PLAYER_HEIGHT * 0.5) - (item.y + 0.5);
      const dz = bot.z - (item.z + 0.5);
      const dist = Math.hypot(dx, dy, dz);
      if (dist > effectiveRadius) continue;
      const maxDamage = Math.max(30, Math.min(140, radius * 12));
      const damage = maxDamage * (1 - dist / effectiveRadius);
      Game.bots3d.damageBot3D(state, bot.id, damage, item.x + 0.5, item.z + 0.5);
    }
  }

  function damageEntitiesFromExplosion(state, item) {
    damagePlayerFromExplosion(state, item);
    damageBotsFromExplosion(state, item);
  }

  function updateDynamite3D(state, dt) {
    updateMovingBlocks(state, dt);
    processChunkedExplosions(state);
    const list = state && state.world ? ensureActiveDynamite(state) : [];
    if (!list.length) return;
    const remaining = [];
    for (const item of list) {
      const current = getBlock3D(state, item.x, item.y, item.z);
      if (current !== item.id) continue;
      item.timer -= dt;
      if (item.timer <= 0) explodeDynamite(state, item);
      else remaining.push(item);
    }
    state.world.activeDynamite = remaining.filter((item) => {
      const pos = parseCoordKey(item.key);
      return pos && getBlock3D(state, pos.x, pos.y, pos.z) === item.id;
    });
  }

  function processChunkedExplosions(state, options = {}) {
    const world = state && state.world;
    const active = world && world.activeExplosions;
    if (!active || !active.length) return;
    const next = [];
    for (const explosion of active) {
      if (explosion.custom) ensureCustomExplosionChunks(state, explosion);
      let checks = 0;
      const budget = Number.isFinite(options.budgetOverride)
        ? Math.max(1, options.budgetOverride | 0)
        : (explosion.custom ? CUSTOM_EXPLOSION_CHECK_BUDGET : CHUNKED_EXPLOSION_CHECK_BUDGET);
      while (explosion.chunkIndex < explosion.chunks.length && checks < budget) {
        const key = explosion.chunks[explosion.chunkIndex];
        const chunk = world.chunks && world.chunks.get(key);
        if (!chunk || !chunk.blocks) {
          explosion.chunkIndex += 1;
          explosion.blockIndex = 0;
          continue;
        }
        const bounds = chunkBounds(world, chunk);
        const maxIndex = chunk.blocks.length;
        while (explosion.blockIndex < maxIndex && checks < budget) {
          const index = explosion.blockIndex;
          explosion.blockIndex += 1;
          checks += 1;
          const lx = index % bounds.size;
          const ly = Math.floor(index / (bounds.size * bounds.size));
          const lz = Math.floor(index / bounds.size) % bounds.size;
          const x = bounds.minX + lx;
          const y = bounds.minY + ly;
          const z = bounds.minZ + lz;
          if (x >= bounds.maxX || y >= bounds.maxY || z >= bounds.maxZ) continue;
          const dx = x - explosion.x;
          const dy = y - explosion.y;
          const dz = z - explosion.z;
          if (dx * dx + dy * dy + dz * dz > explosion.radiusSq) continue;
          const id = getBlock3D(state, x, y, z);
          if (explosion.custom) {
            if (processCustomExplosionBlock(state, explosion, x, y, z, id)) explosion.broken += 1;
            if (explosion.broken >= (explosion.blockLimit || CUSTOM_EXPLOSION_BLOCK_LIMIT) || explosion.spawned >= (explosion.placeLimit || CUSTOM_NEGATIVE_PLACE_LIMIT)) {
              explosion.chunkIndex = explosion.chunks.length;
              break;
            }
            continue;
          }
          if (!canExplodeBlock(id)) continue;
          if (!suppressFluidDrop(state, x, y, z) && Game.inventory3d && Game.inventory3d.addMinedItem) Game.inventory3d.addMinedItem(state, id, 1);
          if (setBlock3D(state, x, y, z, BLOCK.AIR)) {
            explosion.broken += 1;
            activateFluidAroundChange(state, x, y, z);
          }
        }
        if (explosion.blockIndex >= maxIndex) {
          explosion.chunkIndex += 1;
          explosion.blockIndex = 0;
        }
      }
      explosion.checks = (explosion.checks || 0) + checks;
      if (explosion.custom && explosion.checks >= (explosion.totalCheckLimit || CUSTOM_EXPLOSION_TOTAL_CHECK_LIMIT)) explosion.chunkIndex = explosion.chunks.length;
      if (explosion.chunkIndex < explosion.chunks.length) next.push(explosion);
      else setNotice(state, `Взрыв: разрушено ${explosion.broken}`);
    }
    world.activeExplosions = next;
  }

  function isExpandedBlockAssortmentWorld(state) {
    return !!(state && state.worldMeta
      && state.worldMeta.mode === 'creative'
      && (state.worldMeta.expandedBlockAssortment || state.worldMeta.customLessonEditor));
  }

  function isRegisteredBlockId(blockId) {
    return !!(Number.isFinite(blockId)
      && blockId !== BLOCK.AIR
      && Object.values(BLOCK).includes(blockId));
  }

  function getBreakDuration(state, blockId) {
    const base = BREAK_TIME && BREAK_TIME[blockId];
    if (isExpandedBlockAssortmentWorld(state) && isRegisteredBlockId(blockId)) {
      return Number.isFinite(base) && base > 0 ? Math.max(0.18, base * 0.32) : 0.35;
    }
    if (!Number.isFinite(base)) return Infinity;
    if (base > 0) return Math.max(0.18, base * 0.32);
    return 0.35;
  }

  function resetMining(state) {
    state.ui.mineTarget = null;
    state.ui.mineProgress = 0;
    state.ui.mineBlock = BLOCK.AIR;
    state.ui.minePulse = 0;
    state.ui.mineSoundTimer = 0;
  }

  function isChestBlock(id) {
    return id === BLOCK.CHEST || id === BLOCK.STONE_CHEST;
  }

  function customLessonPlayMode(state) {
    const meta = state && state.worldMeta;
    return meta && meta.customLessonPlay ? meta.customLessonPlay.mode : '';
  }

  function canEditBlocks(state) {
    const mode = customLessonPlayMode(state);
    return mode !== 'adventure';
  }

  function selectHotbarSlot(state, index) {
    const size = Game.inventory3d && Game.inventory3d.HOTBAR_SIZE ? Game.inventory3d.HOTBAR_SIZE : HOTBAR_BLOCKS.length;
    if (index < 0 || index >= size) return;
    state.player.selectedHotbarIndex = index;
    if (Game.inventory3d && Game.inventory3d.updateSelectedBlockFromHotbar) {
      Game.inventory3d.updateSelectedBlockFromHotbar(state);
    } else {
      state.player.selectedBlock = BLOCK.AIR;
    }
  }

  function updateSelectedBlock(state, input) {
    const size = Game.inventory3d && Game.inventory3d.HOTBAR_SIZE ? Game.inventory3d.HOTBAR_SIZE : HOTBAR_BLOCKS.length;
    for (let i = 0; i < size; i += 1) {
      const key = i === 9 ? 'Digit0' : `Digit${i + 1}`;
      if (input.keys[key]) selectHotbarSlot(state, i);
    }
  }

  function suppressFluidDrop(state, x, y, z) {
    return !!(Game.world3d.isOptimizedFluidWithoutDrop3D && Game.world3d.isOptimizedFluidWithoutDrop3D(state, x, y, z));
  }

  function breakBlockAt(state, x, y, z) {
    if (!inBounds3D(state.world, x, y, z)) return null;
    const id = getBlock3D(state, x, y, z);
    const expandedBreakable = isExpandedBlockAssortmentWorld(state) && isRegisteredBlockId(id);
    if (id === BLOCK.AIR) return null;
    if (!expandedBreakable && (id === BLOCK.BEDROCK || id === BLOCK.WATER || id === BLOCK.HOT_WATER || id === BLOCK.LAVA || id === BLOCK.VOLCANIC_LAVA)) return null;
    const noDrop = suppressFluidDrop(state, x, y, z);
    const originalId = noDrop ? Game.world3d.getStoredBlock3D(state, x, y, z) : id;
    const dropId = noDrop ? BLOCK.AIR : isChestBlock(id) && Game.inventory3d && Game.inventory3d.filledChestDataFromWorld
      ? (id === BLOCK.STONE_CHEST ? ITEM.FILLED_STONE_CHEST : ITEM.FILLED_CHEST)
      : (id === BLOCK.BASALT ? BLOCK.BLACKSTONE : id);
    const dropData = isChestBlock(id) && Game.inventory3d && Game.inventory3d.filledChestDataFromWorld
      ? Game.inventory3d.filledChestDataFromWorld(state, x, y, z)
      : (id === BLOCK.CUSTOM_TNT ? customTntStackData(customTntDataAt(state, x, y, z)) : null);
    let collected = true;
    if (!noDrop && Game.inventory3d && Game.inventory3d.addMinedItem) {
      const result = Game.inventory3d.addMinedItem(state, dropId, 1, dropData);
      if (result.remaining > 0) {
        collected = false;
      }
    }
    if (setBlock3D(state, x, y, z, BLOCK.AIR)) {
      activateFluidAroundChange(state, x, y, z);
      if (state.world.blockDamage) delete state.world.blockDamage[coordKey(x, y, z)];
      syncNearbyStrangePortals(state, x, y, z);
      const label = noDrop ? BLOCK_LABELS[originalId] : Game.inventory3d && Game.inventory3d.getStackLabel ? Game.inventory3d.getStackLabel({ id: dropId, count: 1, data: dropData || undefined }) : (BLOCK_LABELS[dropId] || `ID ${dropId}`);
      if (Game.education3d && Game.education3d.onBlockMined) Game.education3d.onBlockMined(state, id);
      return { id, dropId, dropData, label, collected, noDrop };
    }
    return null;
  }

  function finishBreakingBlock(state, hit) {
    if (!hit) return;
    if (hit.id === BLOCK.BEDROCK && !isExpandedBlockAssortmentWorld(state)) {
      setNotice(state, 'Бедрок нельзя добыть');
      return;
    }
    const cells = actionCubeCells(hit, playerActionSize(state));
    let broken = 0;
    let allCollected = true;
    let firstLabel = '';
    let removedWithoutDrops = 0;
    for (const cell of cells) {
      const result = breakBlockAt(state, cell.x, cell.y, cell.z);
      if (!result) continue;
      broken += 1;
      if (result.noDrop) removedWithoutDrops += 1;
      if (!firstLabel) firstLabel = result.label;
      if (!result.collected) allCollected = false;
    }
    if (!broken) return;
    if (removedWithoutDrops === broken) setNotice(state, broken === 1 ? `Убрано: ${firstLabel}` : `Убрано блоков: ${broken}`);
    else if (broken === 1) setNotice(state, allCollected ? `Добыто: ${firstLabel}` : `Сломано: ${firstLabel}, инвентарь полон`);
    else setNotice(state, allCollected ? `Добыто блоков: ${broken}` : `Сломано блоков: ${broken}, инвентарь полон`);
    if (Game.audio && Game.audio.playDig) Game.audio.playDig();
  }

  function updateMining(state, input, hit, dt) {
    if (!canEditBlocks(state)) {
      if (input.primaryDown) setNotice(state, 'В этом режиме нельзя ломать блоки');
      resetMining(state);
      return;
    }
    if (!input.primaryDown) {
      state.ui.mineTarget = null;
      state.ui.mineSoundTimer = 0;
      return;
    }
    if (!hit) {
      resetMining(state);
      return;
    }
    if (hit.id === BLOCK.BEDROCK && !isExpandedBlockAssortmentWorld(state)) {
      resetMining(state);
      setNotice(state, 'Бедрок нельзя добыть');
      return;
    }

    const key = targetKey(hit);
    if (!state.ui.mineTarget || state.ui.mineTarget.key !== key) {
      state.ui.mineTarget = { key, x: hit.x, y: hit.y, z: hit.z };
      state.ui.mineProgress = (state.world.blockDamage && state.world.blockDamage[key]) || 0;
      state.ui.mineBlock = hit.id;
      state.ui.minePulse = 0;
      state.ui.mineSoundTimer = 0;
    }

    const duration = getBreakDuration(state, hit.id);
    if (!Number.isFinite(duration)) return;
    state.ui.mineProgress = Math.min(1, state.ui.mineProgress + dt / duration);
    if (!state.world.blockDamage) state.world.blockDamage = {};
    state.world.blockDamage[key] = state.ui.mineProgress;
    state.ui.minePulse += dt * (8 + state.ui.mineProgress * 10);
    state.ui.mineSoundTimer -= dt;
    if (state.ui.mineSoundTimer <= 0) {
      state.ui.mineSoundTimer = Math.max(0.08, 0.18 - state.ui.mineProgress * 0.08);
      if (Game.audio && Game.audio.playDig) Game.audio.playDig();
    }
    if (state.ui.mineProgress >= 1) {
      finishBreakingBlock(state, hit);
      resetMining(state);
    }
  }

  function attackTargetSheep(state, blockHit) {
    const hit = raycastSheep(state);
    if (!hit || !hit.sheep || !Game.entities3d || !Game.entities3d.damageSheep3D) return false;
    if (blockHit && Number.isFinite(blockHit.distance) && hit.distance > blockHit.distance) return false;
    const result = Game.entities3d.damageSheep3D(state, hit.sheep.id, 1, state.player.x, state.player.z);
    if (!result.hit) return false;
    resetMining(state);
    const label = MOB_LABELS[hit.sheep.type] || 'Моб';
    setNotice(state, result.dead ? `${label} погиб` : `${label} ранен`);
    if (Game.audio && Game.audio.playDig) Game.audio.playDig();
    return true;
  }

  function attackTargetBot(state, blockHit) {
    const hit = raycastBot(state);
    if (!hit || !hit.bot || !Game.bots3d || !Game.bots3d.damageBot3D) return false;
    if (blockHit && Number.isFinite(blockHit.distance) && hit.distance > blockHit.distance) return false;
    if (state.worldMeta && state.worldMeta.mode === 'creative') {
      resetMining(state);
      setNotice(state, 'В creative ботов нельзя бить');
      return true;
    }
    const result = Game.bots3d.damageBot3D(state, hit.bot.id, 12, state.player.x, state.player.z);
    if (!result.hit) return false;
    resetMining(state);
    const label = hit.bot.roleLabel || hit.bot.name || 'Бот';
    setNotice(state, result.dead ? `${label} отключился` : `${label}: ${Math.ceil(result.health)}/${Math.ceil(result.maxHealth)} HP`);
    if (Game.audio && Game.audio.playDig) Game.audio.playDig();
    return true;
  }

  function handleRulerPlaced(state, x, y, z) {
    if (!state || !state.worldMeta) return;
    const first = state.worldMeta.rulerFirstPoint;
    if (!first) {
      state.worldMeta.rulerFirstPoint = { x, y, z };
      setNotice(state, 'Линейка: первая точка выбрана');
      return;
    }
    const dx = x - first.x;
    const dy = y - first.y;
    const dz = z - first.z;
    const distance = Math.round(Math.sqrt(dx * dx + dy * dy + dz * dz) * 100) / 100;
    state.worldMeta.rulerFirstPoint = null;
    state.worldMeta.rulerLastDistance = distance;
    const shown = Number.isInteger(distance) ? String(distance) : distance.toFixed(2);
    setNotice(state, `Линейка: ${shown} блоков`);
    if (Game.education3d && Game.education3d.onRulerMeasured) Game.education3d.onRulerMeasured(state, distance);
  }

  function canReplaceForPlacement(id) {
    return id === BLOCK.AIR || id === BLOCK.WATER || id === BLOCK.HOT_WATER || id === BLOCK.LAVA || id === BLOCK.VOLCANIC_LAVA;
  }

  function placeBlockAt(state, blockId, placedBlockId, stack, survival, x, y, z) {
    placeBlockAt.lastBlockedByUnloadedChunk = false;
    if (!inBounds3D(state.world, x, y, z)) return false;
    if (!isBlockChunkLoaded3D || !isBlockChunkLoaded3D(state.world, x, y, z)) {
      placeBlockAt.lastBlockedByUnloadedChunk = true;
      return false;
    }
    const targetId = getBlock3D(state, x, y, z);
    if (!canReplaceForPlacement(targetId)) return false;
    const gameplayId = Game.world3d.getGameplayBlockId3D ? Game.world3d.getGameplayBlockId3D(state, placedBlockId) : placedBlockId;
    if (isSolidBlock3D(gameplayId) && blockOverlapsPlayer(state, x, y, z)) return false;
    let placed = false;
    if (blockId === BLOCK.WATER && Game.fluids3d && Game.fluids3d.addWaterSource3D) {
      placed = Game.fluids3d.addWaterSource3D(state, x, y, z);
    } else if (blockId === BLOCK.LAVA && Game.fluids3d && Game.fluids3d.addLavaSource3D) {
      placed = Game.fluids3d.addLavaSource3D(state, x, y, z);
    } else if (blockId === BLOCK.VOLCANIC_LAVA && Game.fluids3d && Game.fluids3d.addVolcanicLavaSource3D) {
      placed = Game.fluids3d.addVolcanicLavaSource3D(state, x, y, z);
    } else {
      placed = setBlock3D(state, x, y, z, placedBlockId);
    }
    if (!placed) return false;
    if (targetId === BLOCK.WATER || targetId === BLOCK.HOT_WATER || targetId === BLOCK.LAVA || targetId === BLOCK.VOLCANIC_LAVA) activateFluidAroundChange(state, x, y, z);
    if ((blockId === ITEM.FILLED_CHEST || blockId === ITEM.FILLED_STONE_CHEST) && Game.inventory3d && Game.inventory3d.restoreFilledChest) Game.inventory3d.restoreFilledChest(state, x, y, z, stack && stack.data);
    if (placedBlockId === BLOCK.CUSTOM_TNT) setBlockDataAt(state, x, y, z, customTntStackData(stack && stack.data));
    if (survival && Game.inventory3d) Game.inventory3d.consumeSelectedHotbarItem(state, 1);
    if (placedBlockId === BLOCK.ACTIVE_STRANGE_PORTAL) ensurePortalLink(state, x, y, z, 'x');
    else syncNearbyStrangePortals(state, x, y, z);
    if (Game.education3d && Game.education3d.onBlockPlaced) Game.education3d.onBlockPlaced(state, placedBlockId);
    if (placedBlockId === BLOCK.RULER) handleRulerPlaced(state, x, y, z);
    return true;
  }

  function placeSelectedBlock(state, useOnly = false, placeOnly = false) {
    const stack = Game.inventory3d && Game.inventory3d.getSelectedHotbarStack
      ? Game.inventory3d.getSelectedHotbarStack(state)
      : null;
    const blockId = stack ? stack.id : BLOCK.AIR;
    if (placeOnly && (blockId === ITEM.NOTE || blockId === ITEM.MAP)) return;
    if (blockId === ITEM.NOTE) {
      if (Game.inventory3d && Game.inventory3d.openNote) Game.inventory3d.openNote(state, stack);
      else setNotice(state, 'Записка недоступна');
      return;
    }
    if (blockId === ITEM.MAP) {
      if (Game.openItemMap) Game.openItemMap(stack);
      else setNotice(state, 'Карта недоступна');
      return;
    }
    const hit = raycastBlock(state);
    if (!hit) return;
    if (!placeOnly && hit.id === BLOCK.CALCULATOR) {
      openCalculatorForm(state, hit);
      return;
    }
    if (!placeOnly && hit.id === BLOCK.TNT_TABLE) {
      openTntTableForm(state);
      return;
    }
    if (!placeOnly && hit.id === BLOCK.GLOBE) {
      if (Game.openMap) Game.openMap({ allowAnyMode: true });
      else setNotice(state, 'Карта недоступна');
      return;
    }
    if (!placeOnly && isChestBlock(hit.id)) {
      if (Game.openChestInventory) Game.openChestInventory(hit.x, hit.y, hit.z);
      else setNotice(state, 'Сундук недоступен');
      return;
    }
    if (!canEditBlocks(state)) {
      setNotice(state, 'В этом режиме нельзя ставить блоки');
      return;
    }
    if (blockId === BLOCK.BORDER && (!state.worldMeta || !state.worldMeta.customLessonEditor)) {
      setNotice(state, 'Граница доступна только в редакторе урока');
      return;
    }
    if (!placeOnly && isAnyTntBlock(hit.id) && blockId === BLOCK.TNT_REMOTE && bindTntRemoteTarget(state, hit)) return;
    if (!placeOnly && hit.id === BLOCK.TNT_REMOTE && activateTntRemoteTarget(state)) return;
    if (!placeOnly && isAnyTntBlock(hit.id) && activateDynamite(state, hit.x, hit.y, hit.z, hit.id)) return;
    if (useOnly) {
      setNotice(state, 'Этот блок нельзя использовать');
      return;
    }
    if (!hit.place) return;
    if (!Number.isFinite(blockId) || blockId === BLOCK.AIR) return;
    const { x, y, z } = hit.place;
    if (!inBounds3D(state.world, x, y, z)) return;
    const survival = !state.worldMeta || (state.worldMeta.mode !== 'creative' && state.worldMeta.mode !== 'education');
    const mobType = SPAWN_EGG_TYPES[blockId];
    if (mobType) {
      const options = mobSpawnOptionsForEgg(state, mobType, x, z);
      if (spawnMobFromEgg(state, mobType, x, y, z, options)) {
        if (survival && Game.inventory3d) Game.inventory3d.consumeSelectedHotbarItem(state, 1);
        setNotice(state, `Призван моб: ${MOB_LABELS[mobType] || 'Моб'}`);
      }
      return;
    }
    const botRole = BOT_SPAWN_EGG_ROLES[blockId];
    if (botRole) {
      if (spawnBotFromEgg(state, botRole, x, y, z)) {
        if (survival && Game.inventory3d) Game.inventory3d.consumeSelectedHotbarItem(state, 1);
        setNotice(state, `Призван бот: ${BOT_ROLE_LABELS[botRole] || 'Бот'}`);
      }
      return;
    }
    const retiredExplosionBlock = blockId === BLOCK.TNT_TABLE || blockId === BLOCK.CUSTOM_TNT;
    const expandedCreativeBlock = !!(!retiredExplosionBlock
      && state.worldMeta
      && isExpandedBlockAssortmentWorld(state)
      && Object.values(BLOCK).includes(blockId)
      && blockId !== BLOCK.AIR
      && blockId !== BLOCK.TNT_TABLE
      && blockId !== BLOCK.CUSTOM_TNT);
    const canPlaceSelected = !retiredExplosionBlock && (expandedCreativeBlock
      || blockId === BLOCK.WATER
      || blockId === BLOCK.LAVA
      || blockId === ITEM.FILLED_CHEST
      || blockId === ITEM.FILLED_STONE_CHEST
      || (Game.blocks.PLACEABLE && Game.blocks.PLACEABLE.has(blockId)));
    if (!canPlaceSelected) {
      setNotice(state, 'Этот предмет нельзя поставить');
      return;
    }
    const placedBlockId = blockId === ITEM.FILLED_CHEST
      ? BLOCK.CHEST
      : (blockId === ITEM.FILLED_STONE_CHEST ? BLOCK.STONE_CHEST : blockId);
    const cells = actionCubeCells(hit.place, playerActionSize(state));
    const available = survival && stack && Number.isFinite(stack.count) ? Math.max(0, stack.count | 0) : Infinity;
    let placed = 0;
    let blockedByPlayer = false;
    let blockedByUnloadedChunk = false;
    const selectedBlockIsSolid = isSolidBlock3D(Game.world3d.getGameplayBlockId3D ? Game.world3d.getGameplayBlockId3D(state, placedBlockId) : placedBlockId);
    for (const cell of cells) {
      if (placed >= available) break;
      if (selectedBlockIsSolid && inBounds3D(state.world, cell.x, cell.y, cell.z) && blockOverlapsPlayer(state, cell.x, cell.y, cell.z)) blockedByPlayer = true;
      if (placeBlockAt(state, blockId, placedBlockId, stack, survival, cell.x, cell.y, cell.z)) placed += 1;
      if (placeBlockAt.lastBlockedByUnloadedChunk) blockedByUnloadedChunk = true;
    }
    if (placed > 0) {
      const placedLabel = Game.inventory3d && Game.inventory3d.getStackLabel ? Game.inventory3d.getStackLabel(stack) : (BLOCK_LABELS[blockId] || `ID ${blockId}`);
      setNotice(state, placed === 1 ? `Поставлено: ${placedLabel}` : `Поставлено блоков: ${placed}`);
    } else if (blockedByPlayer) {
      setNotice(state, 'Нельзя поставить блок внутри себя');
    } else if (blockedByUnloadedChunk) {
      setNotice(state, 'Этот чанк не прогружен, сюда ничего нельзя ставить и заливать');
    }
  }

  function mobSpawnOptionsForEgg(state, mobType, x, z) {
    if (mobType !== 'bear') return {};
    const biome = Game.generation3d && Game.generation3d.getBiomeAt3D
      ? Game.generation3d.getBiomeAt3D(state, x, z)
      : 'forest';
    const snow = biome === 'snow_plains' || biome === 'spruce_forest';
    return {
      variant: snow ? 'snow' : 'brown',
      denTask: 'dig_here',
    };
  }

  function spawnMobFromEgg(state, mobType, x, y, z, options = {}) {
    if (!Game.entities3d || !Game.entities3d.spawnMob3D) return false;
    const offsets = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2]];
    for (const [dx, dz] of offsets) {
      for (const dy of [0, 1]) {
        const sx = x + dx;
        const sy = y + dy;
        const sz = z + dz;
        if (!inBounds3D(state.world, sx, sy, sz)) continue;
        if (Game.entities3d.spawnMob3D(state, mobType, sx, sy, sz, null, options)) return true;
      }
    }
    return false;
  }

  function spawnBotFromEgg(state, botRole, x, y, z) {
    if (!Game.bots3d || !Game.bots3d.spawnBot3D) return false;
    return !!Game.bots3d.spawnBot3D(state, botRole, x, y, z);
  }

  function showTargetLootTable(state, hit) {
    if (!hit || !isChestBlock(hit.id)) {
      setNotice(state, 'Наведи прицел на сундук');
      return;
    }
    if (Game.inventory3d && Game.inventory3d.showLootTableForChest && Game.inventory3d.showLootTableForChest(state, hit.x, hit.y, hit.z)) return;
    setNotice(state, 'Таблица лута недоступна');
  }

  function repairTargetBlock(state, hit) {
    if (!hit || !state.world.blockDamage) return;
    const key = targetKey(hit);
    if (!state.world.blockDamage[key]) return;
    delete state.world.blockDamage[key];
    if (state.ui.mineTarget && state.ui.mineTarget.key === key) resetMining(state);
    else state.ui.mineProgress = 0;
    setNotice(state, 'Блок починен');
  }

  function updateInteraction3D(state, input, actions, dt) {
    updateSelectedBlock(state, input);
    const hit = raycastBlock(state);
    const previewHit = actions.previewPressed ? raycastBlock(state, true) : hit;
    const attackedBot = actions.breakPressed && attackTargetBot(state, hit);
    const attackedSheep = !attackedBot && actions.breakPressed && attackTargetSheep(state, hit);
    if (attackedBot || attackedSheep) input.primaryDown = false;
    state.ui.targetBlock = hit ? { x: hit.x, y: hit.y, z: hit.z, id: hit.id, normal: hit.normal } : null;
    if (hit && (!state.ui.mineTarget || state.ui.mineTarget.key !== targetKey(hit))) {
      state.ui.mineProgress = (state.world.blockDamage && state.world.blockDamage[targetKey(hit)]) || 0;
    } else if (!hit && !input.primaryDown) {
      state.ui.mineProgress = 0;
    }
    if (state.ui.noticeTimer > 0) {
      state.ui.noticeTimer = Math.max(0, state.ui.noticeTimer - dt);
      if (state.ui.noticeTimer === 0) state.ui.noticeText = '';
    }
    if (state.ui.lootTableTimer > 0) {
      state.ui.lootTableTimer = Math.max(0, state.ui.lootTableTimer - dt);
      if (state.ui.lootTableTimer === 0) state.ui.lootTableLines = null;
    }
    if (!attackedBot && !attackedSheep) updateMining(state, input, hit, dt);
    if (actions.repairPressed) repairTargetBlock(state, hit);
    if (actions.previewPressed) togglePreview(state, previewHit);
    if (actions.lootTablePressed) showTargetLootTable(state, hit);
    if (actions.usePressed) placeSelectedBlock(state, true);
    else if (actions.placePressed) placeSelectedBlock(state, false, !!actions.mobilePlace);
  }

  const MOB_LABELS = {
    sheep: 'Овца',
    boar: 'Кабан',
    turtle: 'Черепаха',
    snake: 'Змея',
    goat: 'Горный козел',
    fish: 'Рыба',
    fox: 'Лиса',
    bear: 'Медведь',
    polar_bear: 'Белый медведь',
  };

  const BOT_ROLE_LABELS = {
    builder: 'Строитель',
    explorer: 'Исследователь',
    digger: 'Копатель',
    hunter: 'Охотник',
    gatherer: 'Собиратель',
    miner: 'Шахтер',
    blaster: 'Взрыватель',
  };

  Game.interaction3d = {
    updateInteraction3D,
    HOTBAR_BLOCKS,
    DEFAULT_HOTBAR_ITEMS,
    CREATIVE_ITEMS,
    BLOCK_LABELS,
    ITEM,
    SPAWN_EGG_TYPES,
    BOT_SPAWN_EGG_ROLES,
    MOB_LABELS,
    BOT_ROLE_LABELS,
    DYNAMITE_CONFIG,
    isDynamiteBlock,
    isAnyTntBlock,
    customTntLabel,
    customTntStackData,
    updateDynamite3D,
  };
})();
