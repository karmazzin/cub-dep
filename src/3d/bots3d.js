(() => {
  const Game = window.CubDep;
  const { BLOCK, BREAK_TIME } = Game.blocks;
  const { getBlock3D, setBlock3D, isBlockChunkLoaded3D, inBounds3D, isSolidBlock3D } = Game.world3d;

  const BOT_BLUEPRINTS = [
    { id: 'builder', label: 'Строитель', name: 'Саша', color: 0x4fa66a, weights: { build: 58, gather: 20, explore: 8, dig: 5, mine: 4, wander: 3, hunt: 2 } },
    { id: 'explorer', label: 'Исследователь', name: 'Артем', color: 0x3f7fd5, weights: { explore: 72, wander: 10, gather: 7, build: 4, dig: 3, mine: 3, hunt: 1 } },
    { id: 'digger', label: 'Копатель', name: 'Мира', color: 0x8c6a4a, weights: { dig: 62, mine: 13, gather: 8, explore: 7, build: 5, wander: 4, hunt: 1 } },
    { id: 'hunter', label: 'Охотник', name: 'Ренат', color: 0xb85a4c, weights: { hunt: 64, explore: 12, gather: 8, build: 5, dig: 4, mine: 4, wander: 3 } },
    { id: 'gatherer', label: 'Собиратель', name: 'Лена', color: 0xd0a13f, weights: { gather: 62, build: 12, explore: 10, dig: 5, mine: 5, wander: 4, hunt: 2 } },
    { id: 'miner', label: 'Шахтер', name: 'Ника', color: 0x777d8a, weights: { mine: 64, dig: 12, gather: 8, build: 6, explore: 5, wander: 4, hunt: 1 } },
    { id: 'blaster', label: 'Взрыватель', name: 'Даня', color: 0xc94f37, weights: { blast: 74, explore: 8, gather: 5, build: 4, dig: 3, mine: 3, wander: 2, hunt: 1 } },
  ];
  const MAX_BOTS_PER_PROFILE = 3;
  const MAX_CONNECTED_BOTS = BOT_BLUEPRINTS.length * MAX_BOTS_PER_PROFILE;
  const BOT_RADIUS = 0.32;
  const BOT_HEIGHT = 1.78;
  const GRAVITY = 18;
  const WALK_SPEED = 2.15;
  const FLY_SPEED = 5.6;
  const JUMP_SPEED = 6.2;
  const THINK_MIN = 0.7;
  const THINK_MAX = 2.2;
  const JOIN_MIN = 18;
  const JOIN_MAX = 42;
  const LEAVE_MIN = 75;
  const LEAVE_MAX = 150;
  const BUILD_VARIANTS = ['cabin', 'shed', 'tower', 'storehouse']
    .concat(Array.from({ length: 96 }, (_, index) => `plan_${String(index + 4).padStart(2, '0')}`));
  const CHUNK_SIZE = Game.constants3d && Game.constants3d.CHUNK_SIZE ? Game.constants3d.CHUNK_SIZE : 16;
  const LAVA_REPAIR_RADIUS = 20;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function randRange(min, max) {
    return min + Math.random() * (max - min);
  }

  function coordKey(x, y, z) {
    return `${x},${y},${z}`;
  }

  function chunkKeyForCell(x, y, z) {
    return `${Math.floor(x / CHUNK_SIZE)},${Math.floor(y / CHUNK_SIZE)},${Math.floor(z / CHUNK_SIZE)}`;
  }

  function isLoadedBotCell(world, x, y, z) {
    return !isBlockChunkLoaded3D || isBlockChunkLoaded3D(world, x, y, z);
  }

  function getBreakDuration(blockId) {
    const base = BREAK_TIME && BREAK_TIME[blockId];
    if (!Number.isFinite(base)) return Infinity;
    if (base > 0) return Math.max(0.18, base * 0.32);
    return 0.35;
  }

  function weightedChoice(weights, fallback) {
    if (!weights) return fallback;
    let total = 0;
    for (const key of Object.keys(weights)) {
      const value = Number(weights[key]);
      if (Number.isFinite(value) && value > 0) total += value;
    }
    if (total <= 0) return fallback;
    let roll = Math.random() * total;
    for (const key of Object.keys(weights)) {
      const value = Number(weights[key]);
      if (!Number.isFinite(value) || value <= 0) continue;
      roll -= value;
      if (roll <= 0) return key;
    }
    return fallback;
  }

  function isFluid(id) {
    return id === BLOCK.WATER || id === BLOCK.HOT_WATER || id === BLOCK.LAVA || id === BLOCK.VOLCANIC_LAVA;
  }

  function isBuilderBot(bot) {
    return !!bot && bot.role === 'builder';
  }

  function isPassable(id) {
    return id === BLOCK.AIR || isFluid(id);
  }

  function ensureInventory(bot) {
    if (!bot.inventory) bot.inventory = {};
    if (!Number.isFinite(bot.inventory.wood)) bot.inventory.wood = 0;
    if (!Number.isFinite(bot.inventory.plank)) bot.inventory.plank = 0;
    if (!Number.isFinite(bot.inventory.stone)) bot.inventory.stone = 0;
    if (!bot.inventory.blocks) bot.inventory.blocks = {};
    return bot.inventory;
  }

  function addResource(bot, resource, count = 1) {
    const inventory = ensureInventory(bot);
    inventory[resource] = Math.max(0, (inventory[resource] || 0) + count);
  }

  function blockInvKey(id) {
    return String(id);
  }

  function addBlockResource(bot, id, count = 1) {
    if (!Number.isFinite(id) || count <= 0) return;
    const inventory = ensureInventory(bot);
    inventory.blocks[blockInvKey(id)] = Math.max(0, (inventory.blocks[blockInvKey(id)] || 0) + count);
  }

  function blockResourceCount(bot, id) {
    const inventory = ensureInventory(bot);
    return inventory.blocks[blockInvKey(id)] || 0;
  }

  function consumeBlockResource(bot, id, count = 1) {
    const inventory = ensureInventory(bot);
    const key = blockInvKey(id);
    if ((inventory.blocks[key] || 0) < count) return false;
    inventory.blocks[key] -= count;
    return true;
  }

  function addMinedResource(bot, id) {
    addBlockResource(bot, id, 1);
    if (id === BLOCK.WOOD || id === BLOCK.SPRUCE_WOOD || id === BLOCK.SEQUOIA_WOOD) {
      addResource(bot, 'wood', 1);
      addResource(bot, 'plank', 2);
      return true;
    }
    if (id === BLOCK.PLANK) {
      addResource(bot, 'plank', 1);
      return true;
    }
    if (id === BLOCK.STONE || id === BLOCK.BLACKSTONE || id === BLOCK.BASALT) {
      addResource(bot, 'stone', 1);
      return true;
    }
    return false;
  }

  function canOccupyAt(state, x, y, z, requireSupport) {
    const world = state && state.world;
    if (!world || x - BOT_RADIUS < 0 || x + BOT_RADIUS >= world.w || z - BOT_RADIUS < 0 || z + BOT_RADIUS >= world.d || y < 0) return false;
    const minX = Math.floor(x - BOT_RADIUS);
    const maxX = Math.floor(x + BOT_RADIUS);
    const minY = Math.max(0, Math.floor(y));
    const maxY = Math.min(world.h - 1, Math.floor(y + BOT_HEIGHT));
    const minZ = Math.floor(z - BOT_RADIUS);
    const maxZ = Math.floor(z + BOT_RADIUS);
    if (minY > maxY) return !requireSupport;
    for (let yy = minY; yy <= maxY; yy += 1) {
      for (let zz = minZ; zz <= maxZ; zz += 1) {
        for (let xx = minX; xx <= maxX; xx += 1) {
          if (!inBounds3D(world, xx, yy, zz)) return false;
          if (!isLoadedBotCell(world, xx, yy, zz)) return false;
          const id = getBlock3D(state, xx, yy, zz);
          if (isSolidBlock3D(id) || id === BLOCK.LAVA || id === BLOCK.VOLCANIC_LAVA || id === BLOCK.HOT_WATER) return false;
        }
      }
    }
    if (!requireSupport) return true;
    const supportX = Math.floor(x);
    const supportY = Math.floor(y - 0.08);
    const supportZ = Math.floor(z);
    return isLoadedBotCell(world, supportX, supportY, supportZ) && isSolidBlock3D(getBlock3D(state, supportX, supportY, supportZ));
  }

  function canStandAt(state, x, y, z) {
    return canOccupyAt(state, x, y, z, true);
  }

  function canFlyAt(state, x, y, z) {
    return canOccupyAt(state, x, y, z, false);
  }

  function surfaceY(state, x, z) {
    if (!state || !state.world) return null;
    const bx = clamp(Math.floor(x), 1, state.world.w - 2);
    const bz = clamp(Math.floor(z), 1, state.world.d - 2);
    for (let y = state.world.h - 3; y >= 1; y -= 1) {
      const id = getBlock3D(state, bx, y, bz);
      if (isSolidBlock3D(id) && !isFluid(id) && isPassable(getBlock3D(state, bx, y + 1, bz)) && isPassable(getBlock3D(state, bx, y + 2, bz))) {
        return y + 1;
      }
    }
    return null;
  }

  function moveAxis(state, bot, axis, delta) {
    if (!delta) return true;
    const next = { x: bot.x, y: bot.y, z: bot.z };
    next[axis] += delta;
    if (canOccupyAt(state, next.x, next.y, next.z, false)) {
      bot[axis] = next[axis];
      return true;
    }
    if (axis === 'y') {
      if (delta < 0) bot.onGround = true;
      bot.vy = 0;
    } else {
      bot[axis === 'x' ? 'vx' : 'vz'] = 0;
    }
    return false;
  }

  function moveFlyAxis(state, bot, axis, delta) {
    if (!delta) return true;
    const next = { x: bot.x, y: bot.y, z: bot.z };
    next[axis] += delta;
    if (canFlyAt(state, next.x, next.y, next.z)) {
      bot[axis] = next[axis];
      return true;
    }
    bot[axis === 'x' ? 'vx' : axis === 'y' ? 'vy' : 'vz'] = 0;
    return false;
  }

  function tryPlace(state, x, y, z, id) {
    if (!state || !state.world || !inBounds3D(state.world, x, y, z)) return false;
    if (!isLoadedBotCell(state.world, x, y, z)) return false;
    if (getBlock3D(state, x, y, z) !== BLOCK.AIR) return false;
    return setBlock3D(state, x, y, z, id);
  }

  function tryPlaceFromInventory(state, bot, x, y, z, id) {
    return tryPlace(state, x, y, z, id);
  }

  function isDynamiteBlock(id) {
    return Game.interaction3d && Game.interaction3d.isDynamiteBlock
      ? Game.interaction3d.isDynamiteBlock(id)
      : id === BLOCK.DYNAMITE_SMALL
        || id === BLOCK.DYNAMITE_MEDIUM
        || id === BLOCK.DYNAMITE_LARGE
        || id === BLOCK.DYNAMITE_HUGE
        || id === BLOCK.DYNAMITE_MEGA_HUGE
        || id === BLOCK.DYNAMITE_POWER_75
        || id === BLOCK.DYNAMITE_POWER_100;
  }

  function dynamiteConfig(id) {
    if (Game.interaction3d && Game.interaction3d.DYNAMITE_CONFIG && Game.interaction3d.DYNAMITE_CONFIG[id]) return Game.interaction3d.DYNAMITE_CONFIG[id];
    if (id === BLOCK.DYNAMITE_SMALL) return { radius: 1, fuse: 2 };
    if (id === BLOCK.DYNAMITE_MEDIUM) return { radius: 5, fuse: 3 };
    if (id === BLOCK.DYNAMITE_LARGE) return { radius: 10, fuse: 4 };
    if (id === BLOCK.DYNAMITE_HUGE) return { radius: 25, fuse: 5, chunked: true };
    if (id === BLOCK.DYNAMITE_MEGA_HUGE) return { radius: 50, fuse: 6, chunked: true };
    if (id === BLOCK.DYNAMITE_POWER_75) return { radius: 75, fuse: 7, chunked: true };
    if (id === BLOCK.DYNAMITE_POWER_100) return { radius: 100, fuse: 8, chunked: true };
    return null;
  }

  function activateBotDynamite(state, x, y, z, id) {
    const config = dynamiteConfig(id);
    if (!config || !state || !state.world || !isDynamiteBlock(id)) return false;
    if (!Array.isArray(state.world.activeDynamite)) state.world.activeDynamite = [];
    const key = coordKey(x, y, z);
    if (state.world.activeDynamite.some((item) => item.key === key)) return true;
    state.world.activeDynamite.push({
      key,
      x,
      y,
      z,
      id,
      radius: config.radius,
      timer: config.fuse,
      chunked: !!config.chunked,
    });
    return true;
  }

  function isUngeneratedModifiedChunk(state, x, y, z) {
    const world = state && state.world;
    if (!world || !world.modifiedChunks || !world.generatedChunks) return false;
    const key = chunkKeyForCell(x, y, z);
    return world.modifiedChunks.has(key) && !world.generatedChunks.has(key);
  }

  function naturalPatchBlock(state, x, y, z) {
    const dirs = [
      [1, 0, 0], [-1, 0, 0], [0, -1, 0],
      [0, 1, 0], [0, 0, 1], [0, 0, -1],
    ];
    for (const dir of dirs) {
      const nx = x + dir[0];
      const ny = y + dir[1];
      const nz = z + dir[2];
      if (!state.world || !inBounds3D(state.world, nx, ny, nz)) continue;
      const id = getBlock3D(state, nx, ny, nz);
      if (id !== BLOCK.AIR && !isFluid(id) && id !== BLOCK.BEDROCK && isSolidBlock3D(id)) return id;
    }
    if (y >= state.world.h - 5 && BLOCK.DIRT) return BLOCK.DIRT;
    return BLOCK.STONE;
  }

  function repairNearbyUngeneratedLava(state, bot) {
    if (!isBuilderBot(bot) || !state || !state.world || !state.world.modifiedChunks || !state.world.generatedChunks) return false;
    const minX = clamp(Math.floor(bot.x - LAVA_REPAIR_RADIUS), 0, state.world.w - 1);
    const maxX = clamp(Math.floor(bot.x + LAVA_REPAIR_RADIUS), 0, state.world.w - 1);
    const minY = clamp(Math.floor(bot.y - 10), 1, state.world.h - 2);
    const maxY = clamp(Math.floor(bot.y + 10), 1, state.world.h - 2);
    const minZ = clamp(Math.floor(bot.z - LAVA_REPAIR_RADIUS), 0, state.world.d - 1);
    const maxZ = clamp(Math.floor(bot.z + LAVA_REPAIR_RADIUS), 0, state.world.d - 1);
    let fixed = 0;
    for (let y = minY; y <= maxY; y += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          if (!isUngeneratedModifiedChunk(state, x, y, z)) continue;
          if (getBlock3D(state, x, y, z) !== BLOCK.LAVA && getBlock3D(state, x, y, z) !== BLOCK.VOLCANIC_LAVA) continue;
          setBlock3D(state, x, y, z, naturalPatchBlock(state, x, y, z));
          fixed += 1;
          if (fixed >= 160) return true;
        }
      }
    }
    return fixed > 0;
  }

  function botOccupiesCell(other, x, y, z) {
    if (!other) return false;
    const minX = other.x - BOT_RADIUS;
    const maxX = other.x + BOT_RADIUS;
    const minY = other.y;
    const maxY = other.y + BOT_HEIGHT;
    const minZ = other.z - BOT_RADIUS;
    const maxZ = other.z + BOT_RADIUS;
    return x < maxX && x + 1 > minX && y < maxY && y + 1 > minY && z < maxZ && z + 1 > minZ;
  }

  function isCellOccupiedByOtherBot(state, bot, x, y, z) {
    const bots = state && state.entities && Array.isArray(state.entities.bots) ? state.entities.bots : [];
    for (const other of bots) {
      if (!other || other === bot || (bot && other.id === bot.id)) continue;
      if (botOccupiesCell(other, x, y, z)) return true;
    }
    return false;
  }

  function tryMine(state, bot, x, y, z, dt = 0.1) {
    if (!state || !state.world || !inBounds3D(state.world, x, y, z)) return false;
    if (isCellOccupiedByOtherBot(state, bot, x, y, z)) return false;
    const id = getBlock3D(state, x, y, z);
    if (id === BLOCK.AIR || id === BLOCK.BEDROCK || isFluid(id)) return false;
    const duration = getBreakDuration(id);
    if (!Number.isFinite(duration)) return false;
    if (!state.world.blockDamage) state.world.blockDamage = {};
    const key = coordKey(x, y, z);
    const progress = Math.min(1, (state.world.blockDamage[key] || 0) + Math.max(0.01, dt) / duration);
    state.world.blockDamage[key] = progress;
    if (progress < 1) return false;
    delete state.world.blockDamage[key];
    return setBlock3D(state, x, y, z, BLOCK.AIR) ? id : false;
  }

  function initBot(bot) {
    if (!bot) return;
    if (!Number.isFinite(bot.vx)) bot.vx = 0;
    if (!Number.isFinite(bot.vy)) bot.vy = 0;
    if (!Number.isFinite(bot.vz)) bot.vz = 0;
    if (!Number.isFinite(bot.yaw)) bot.yaw = Math.random() * Math.PI * 2;
    if (!Number.isFinite(bot.thinkTimer)) bot.thinkTimer = randRange(0.2, 1.4);
    if (!Number.isFinite(bot.actionTimer)) bot.actionTimer = randRange(0.25, 0.9);
    if (!Number.isFinite(bot.lookTimer)) bot.lookTimer = randRange(0.6, 2.0);
    if (!Number.isFinite(bot.jumpTimer)) bot.jumpTimer = randRange(0.4, 1.4);
    if (!Number.isFinite(bot.restlessness)) bot.restlessness = randRange(0.25, 0.85);
    if (!Number.isFinite(bot.caution)) bot.caution = randRange(0.25, 0.9);
    if (!bot.memory) bot.memory = {};
    ensureInventory(bot);
    if (!bot.modeWeights) {
      const blueprint = BOT_BLUEPRINTS.find((item) => item.id === bot.role);
      bot.modeWeights = blueprint && blueprint.weights ? { ...blueprint.weights } : { wander: 1 };
    }
    if (!bot.goal) bot.goal = null;
  }

  function ensureBotHealth(state, bot) {
    if (!bot || !state || !state.worldMeta || state.worldMeta.mode !== 'survival') return;
    if (!Number.isFinite(bot.maxHealth) || bot.maxHealth <= 0) bot.maxHealth = 100;
    if (!Number.isFinite(bot.health)) bot.health = bot.maxHealth;
    bot.health = clamp(bot.health, 0, bot.maxHealth);
  }

  function removeBotById(state, id) {
    const bots = state && state.entities && Array.isArray(state.entities.bots) ? state.entities.bots : null;
    if (!bots) return false;
    const index = bots.findIndex((bot) => bot && bot.id === id);
    if (index < 0) return false;
    bots.splice(index, 1);
    return true;
  }

  function damageBot3D(state, id, damage = 10, sourceX = null, sourceZ = null) {
    const survival = !!(state && state.worldMeta && state.worldMeta.mode === 'survival');
    if (!survival) return { hit: false, creative: true, dead: false };
    const bots = state && state.entities && Array.isArray(state.entities.bots) ? state.entities.bots : [];
    const bot = bots.find((item) => item && item.id === id);
    if (!bot) return { hit: false, creative: false, dead: false };
    ensureBotHealth(state, bot);
    const amount = Math.max(0, Number(damage) || 0);
    if (amount <= 0) return { hit: false, creative: false, dead: false };
    bot.health = Math.max(0, bot.health - amount);
    bot.damageFlash = 0.35;
    if (Number.isFinite(sourceX) && Number.isFinite(sourceZ)) {
      const dx = bot.x - sourceX;
      const dz = bot.z - sourceZ;
      const len = Math.hypot(dx, dz) || 1;
      bot.vx += (dx / len) * 2.2;
      bot.vz += (dz / len) * 2.2;
      bot.vy = Math.max(bot.vy || 0, 2.4);
    }
    const dead = bot.health <= 0;
    if (dead) removeBotById(state, bot.id);
    return { hit: true, creative: false, dead, health: bot.health, maxHealth: bot.maxHealth };
  }

  function createBotFromBlueprint(blueprint, index, baseX, baseY, baseZ) {
    const angle = index / BOT_BLUEPRINTS.length * Math.PI * 2;
    return {
      id: `bot-${Date.now().toString(36)}-${index}`,
      name: blueprint.name,
      role: blueprint.id,
      roleLabel: blueprint.label,
      color: blueprint.color,
      modeWeights: { ...blueprint.weights },
      x: baseX,
      y: baseY,
      z: baseZ,
      yaw: angle + Math.PI,
      vx: 0,
      vy: 0,
      vz: 0,
      onGround: false,
      memory: { baseX, baseY, baseZ },
      inventory: { wood: 0, plank: 0, stone: 0 },
      maxHealth: 100,
      health: 100,
      goal: null,
      thinkTimer: randRange(0.6, 1.8),
      actionTimer: randRange(0.04, 0.18),
      lookTimer: randRange(0.5, 2.2),
      jumpTimer: randRange(0.4, 1.4),
      restlessness: randRange(0.25, 0.9),
      caution: randRange(0.25, 0.9),
    };
  }

  function botBlueprintByRole(role) {
    return BOT_BLUEPRINTS.find((item) => item.id === role) || BOT_BLUEPRINTS[0];
  }

  function botSpawnOverlaps(state, x, z) {
    const bots = state && state.entities && Array.isArray(state.entities.bots) ? state.entities.bots : [];
    for (const bot of bots) {
      if (!bot) continue;
      if (Math.hypot((bot.x || 0) - x, (bot.z || 0) - z) < 1.35) return true;
    }
    return false;
  }

  function visibleSpawnY(state, x, z, fallbackY) {
    const y = surfaceY(state, x, z);
    if (Number.isFinite(y)) return y;
    const world = state && state.world;
    if (!world) return Number.isFinite(fallbackY) ? fallbackY : 1;
    const maxY = Math.max(1, world.h - BOT_HEIGHT - 1);
    return clamp(Number.isFinite(fallbackY) ? fallbackY : maxY, 1, maxY);
  }

  function botJoinAnchor(state) {
    const bots = state && state.entities && Array.isArray(state.entities.bots) ? state.entities.bots : [];
    const first = bots[0];
    if (first && Number.isFinite(first.x) && Number.isFinite(first.z)) {
      return { x: first.x, y: first.y, z: first.z };
    }
    return { x: state.player.x, y: state.player.y, z: state.player.z };
  }

  function findBotJoinSpawn(state) {
    const anchor = botJoinAnchor(state);
    const world = state.world;
    for (let i = 0; i < 16; i += 1) {
      const angle = Math.random() * Math.PI * 2 + i * 0.71;
      const radius = randRange(3.5, 6.5) + (i % 4) * 0.75;
      const x = clamp(anchor.x + Math.cos(angle) * radius, 2, world.w - 3);
      const z = clamp(anchor.z + Math.sin(angle) * radius, 2, world.d - 3);
      if (botSpawnOverlaps(state, x, z)) continue;
      return { x, y: visibleSpawnY(state, x, z, anchor.y), z };
    }
    const x = clamp(anchor.x + 4, 2, world.w - 3);
    const z = clamp(anchor.z + 4, 2, world.d - 3);
    return { x, y: visibleSpawnY(state, x, z, anchor.y), z };
  }

  function findBotSpawnNear(state, x, y, z) {
    const world = state && state.world;
    if (!world) return { x, y, z };
    const centerX = clamp(Number.isFinite(x) ? x + 0.5 : 2.5, 1.5, world.w - 2.5);
    const centerZ = clamp(Number.isFinite(z) ? z + 0.5 : 2.5, 1.5, world.d - 2.5);
    const fallbackY = Number.isFinite(y) ? y : 1;
    const offsets = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2]];
    for (const [dx, dz] of offsets) {
      const sx = clamp(centerX + dx, 1.5, world.w - 2.5);
      const sz = clamp(centerZ + dz, 1.5, world.d - 2.5);
      if (botSpawnOverlaps(state, sx, sz)) continue;
      return { x: sx, y: visibleSpawnY(state, sx, sz, fallbackY), z: sz };
    }
    return { x: centerX, y: visibleSpawnY(state, centerX, centerZ, fallbackY), z: centerZ };
  }

  function spawnBot3D(state, role, x, y, z) {
    if (!state || !state.world) return null;
    if (!state.entities) state.entities = {};
    if (!Array.isArray(state.entities.bots)) state.entities.bots = [];
    const spawn = findBotSpawnNear(state, x, y, z);
    const index = state.entities.bots.length;
    const bot = createBotFromBlueprint(botBlueprintByRole(role), index, spawn.x, spawn.y, spawn.z);
    bot.goal = chooseGoal(state, bot, true);
    bot.actionTimer = randRange(0.02, 0.12);
    state.entities.bots.push(bot);
    return bot;
  }

  function ensureCompanionBots3D(state) {
    if (!state || !state.worldMeta || !state.worldMeta.botsEnabled || !state.player) return;
    if (!state.entities) state.entities = {};
    if (!Array.isArray(state.entities.bots)) state.entities.bots = [];
    if (state.entities.bots.length) return;
    const spawn = { x: state.player.x, y: visibleSpawnY(state, state.player.x, state.player.z, state.player.y), z: state.player.z };
    const nextIndex = 0;
    const bot = createBotFromBlueprint(BOT_BLUEPRINTS[nextIndex % BOT_BLUEPRINTS.length], nextIndex, spawn.x, spawn.y, spawn.z);
    bot.goal = chooseGoal(state, bot, true);
    bot.actionTimer = randRange(0.02, 0.12);
    state.entities.bots.push(bot);
    state.worldMeta.botNextBlueprintIndex = nextIndex + 1;
    if (!Number.isFinite(state.worldMeta.botJoinTimer)) state.worldMeta.botJoinTimer = randRange(JOIN_MIN, JOIN_MAX);
    if (!Number.isFinite(state.worldMeta.botLeaveTimer)) state.worldMeta.botLeaveTimer = randRange(LEAVE_MIN, LEAVE_MAX);
  }

  function connectNextBot(state) {
    if (!state || !state.worldMeta || !state.player) return false;
    if (!state.entities) state.entities = {};
    if (!Array.isArray(state.entities.bots)) state.entities.bots = [];
    if (state.entities.bots.length >= MAX_CONNECTED_BOTS) return false;
    const index = Number.isFinite(state.worldMeta.botNextBlueprintIndex) ? state.worldMeta.botNextBlueprintIndex : state.entities.bots.length;
    const spawn = findBotJoinSpawn(state);
    const bot = createBotFromBlueprint(BOT_BLUEPRINTS[index % BOT_BLUEPRINTS.length], index, spawn.x, spawn.y, spawn.z);
    bot.goal = chooseGoal(state, bot, true);
    bot.actionTimer = randRange(0.02, 0.12);
    state.entities.bots.push(bot);
    state.worldMeta.botNextBlueprintIndex = index + 1;
    return true;
  }

  function updateBotConnections(state, dt) {
    const meta = state && state.worldMeta;
    const bots = state && state.entities && Array.isArray(state.entities.bots) ? state.entities.bots : null;
    if (!meta || !bots) return;
    meta.botJoinTimer = Number.isFinite(meta.botJoinTimer) ? meta.botJoinTimer - dt : randRange(JOIN_MIN, JOIN_MAX);
    if (meta.botJoinTimer <= 0) {
      connectNextBot(state);
      meta.botJoinTimer = bots.length >= MAX_CONNECTED_BOTS ? randRange(JOIN_MAX, JOIN_MAX * 2) : randRange(JOIN_MIN, JOIN_MAX);
    }
    meta.botLeaveTimer = Number.isFinite(meta.botLeaveTimer) ? meta.botLeaveTimer - dt : randRange(LEAVE_MIN, LEAVE_MAX);
    if (meta.botLeaveTimer <= 0) {
      if (bots.length > 1 && Math.random() < 0.55) bots.splice(Math.floor(Math.random() * bots.length), 1);
      meta.botLeaveTimer = randRange(LEAVE_MIN, LEAVE_MAX);
    }
  }

  function goalTargetAround(bot, minRadius, maxRadius) {
    const baseX = bot.memory && Number.isFinite(bot.memory.baseX) ? bot.memory.baseX : bot.x;
    const baseZ = bot.memory && Number.isFinite(bot.memory.baseZ) ? bot.memory.baseZ : bot.z;
    const angle = Math.random() * Math.PI * 2;
    const radius = randRange(minRadius, maxRadius);
    return {
      x: baseX + Math.cos(angle) * radius,
      z: baseZ + Math.sin(angle) * radius,
    };
  }

  function buildCost(variant, creative) {
    if (creative) return { wood: 0, plank: 0, stone: 0 };
    if (variant === 'shed') return { wood: 10, plank: 8, stone: 0 };
    if (variant === 'tower') return { wood: 18, plank: 14, stone: 0 };
    if (variant === 'storehouse') return { wood: 26, plank: 22, stone: 0 };
    const plan = buildPlanConfig(variant);
    if (plan) return { wood: 12 + plan.sizeX * plan.height, plank: 8 + plan.sizeZ * 2, stone: plan.stoneCost };
    return { wood: 18, plank: 16, stone: 0 };
  }

  function hasResources(bot, cost) {
    const inventory = ensureInventory(bot);
    return inventory.wood >= (cost.wood || 0)
      && inventory.plank >= (cost.plank || 0)
      && inventory.stone >= (cost.stone || 0);
  }

  function addMaterialCount(materials, id, count = 1) {
    if (!Number.isFinite(id) || count <= 0) return;
    const key = blockInvKey(id);
    materials[key] = (materials[key] || 0) + count;
  }

  function buildMaterialsForStructure(structure) {
    const tempGoal = { structure, target: { x: 20, y: 4, z: 20 }, cursor: 0 };
    const steps = createStructureSteps(tempGoal);
    const materials = {};
    for (const step of steps) {
      if (!step || step.mine || !Number.isFinite(step.id)) continue;
      addMaterialCount(materials, step.id, 1);
    }
    return materials;
  }

  function canCraftBuildMaterial(bot, id, missing) {
    if (id === BLOCK.PLANK) {
      let need = missing;
      while (need > 0 && blockResourceCount(bot, BLOCK.WOOD) > 0) {
        consumeBlockResource(bot, BLOCK.WOOD, 1);
        addBlockResource(bot, BLOCK.PLANK, 4);
        need -= 4;
      }
      while (need > 0 && blockResourceCount(bot, BLOCK.SPRUCE_WOOD) > 0) {
        consumeBlockResource(bot, BLOCK.SPRUCE_WOOD, 1);
        addBlockResource(bot, BLOCK.PLANK, 4);
        need -= 4;
      }
      return blockResourceCount(bot, BLOCK.PLANK) >= missing;
    }
    if (id === BLOCK.CHEST && blockResourceCount(bot, BLOCK.PLANK) >= missing * 8) {
      consumeBlockResource(bot, BLOCK.PLANK, missing * 8);
      addBlockResource(bot, BLOCK.CHEST, missing);
      return true;
    }
    if (id === BLOCK.PATH) {
      let need = missing;
      while (need > 0 && blockResourceCount(bot, BLOCK.DIRT) > 0) {
        consumeBlockResource(bot, BLOCK.DIRT, 1);
        addBlockResource(bot, BLOCK.PATH, 1);
        need -= 1;
      }
      while (need > 0 && blockResourceCount(bot, BLOCK.GRASS) > 0) {
        consumeBlockResource(bot, BLOCK.GRASS, 1);
        addBlockResource(bot, BLOCK.PATH, 1);
        need -= 1;
      }
      return blockResourceCount(bot, BLOCK.PATH) >= missing;
    }
    if (id === BLOCK.PILLAR && blockResourceCount(bot, BLOCK.STONE) >= missing * 2) {
      consumeBlockResource(bot, BLOCK.STONE, missing * 2);
      addBlockResource(bot, BLOCK.PILLAR, missing);
      return true;
    }
    return false;
  }

  function craftBuildMaterials(bot, materials) {
    if (!materials) return;
    for (const key of Object.keys(materials)) {
      const id = Number(key);
      const missing = (materials[key] || 0) - blockResourceCount(bot, id);
      if (missing > 0) canCraftBuildMaterial(bot, id, missing);
    }
  }

  function hasBuildMaterials(bot, materials) {
    if (!materials) return true;
    craftBuildMaterials(bot, materials);
    for (const key of Object.keys(materials)) {
      if (blockResourceCount(bot, Number(key)) < materials[key]) return false;
    }
    return true;
  }

  function missingBuildMaterialIds(bot, materials) {
    const missing = new Set();
    if (!materials) return missing;
    craftBuildMaterials(bot, materials);
    for (const key of Object.keys(materials)) {
      const id = Number(key);
      if (blockResourceCount(bot, id) < materials[key]) missing.add(id);
    }
    if (missing.has(BLOCK.PLANK)) {
      missing.add(BLOCK.WOOD);
      missing.add(BLOCK.SPRUCE_WOOD);
    }
    if (missing.has(BLOCK.CHEST)) missing.add(BLOCK.PLANK);
    if (missing.has(BLOCK.PATH)) {
      missing.add(BLOCK.DIRT);
      missing.add(BLOCK.GRASS);
    }
    if (missing.has(BLOCK.PILLAR)) missing.add(BLOCK.STONE);
    return missing;
  }

  function chooseBuildVariant() {
    return BUILD_VARIANTS[Math.floor(Math.random() * BUILD_VARIANTS.length)] || 'cabin';
  }

  function buildGoalTarget(state, bot, initial) {
    const creative = state.worldMeta && state.worldMeta.mode === 'creative';
    const minRadius = initial ? 6 : 14;
    const maxRadius = initial ? 14 : (creative ? 38 : 24);
    for (let i = 0; i < 12; i += 1) {
      const target = goalTargetAround(bot, minRadius, maxRadius);
      if (!isNearOldBuildSite(bot, target.x, target.z) && !isProtectedStructureSite(state, target.x, target.z)) return target;
    }
    const baseX = bot.memory && Number.isFinite(bot.memory.baseX) ? bot.memory.baseX : bot.x;
    const baseZ = bot.memory && Number.isFinite(bot.memory.baseZ) ? bot.memory.baseZ : bot.z;
    const radius = maxRadius + 10;
    for (let i = 0; i < 16; i += 1) {
      const angle = i * Math.PI * 0.5 + Math.floor(i / 4) * 0.45;
      const target = {
        x: baseX + Math.cos(angle) * radius,
        z: baseZ + Math.sin(angle) * radius,
      };
      if (!isNearOldBuildSite(bot, target.x, target.z) && !isProtectedStructureSite(state, target.x, target.z)) return target;
    }
    for (let i = 0; i < 16; i += 1) {
      const target = goalTargetAround(bot, maxRadius + 12, maxRadius + 24);
      if (!isProtectedStructureSite(state, target.x, target.z)) return target;
    }
    return goalTargetAround(bot, maxRadius + 24, maxRadius + 36);
  }

  function isNearOldBuildSite(bot, x, z) {
    const sites = bot && bot.memory && Array.isArray(bot.memory.buildSites) ? bot.memory.buildSites : [];
    for (const site of sites) {
      if (!site || !Number.isFinite(site.x) || !Number.isFinite(site.z)) continue;
      const radius = Number.isFinite(site.radius) ? site.radius : 12;
      if (Math.hypot(x - site.x, z - site.z) < radius) return true;
    }
    return false;
  }

  function pointNearAnyStructure(list, x, z, fallbackRadius, margin = 8) {
    if (!Array.isArray(list)) return false;
    for (const item of list) {
      if (!item || !Number.isFinite(item.x) || !Number.isFinite(item.z)) continue;
      const radius = (Number.isFinite(item.radius) ? item.radius : fallbackRadius) + margin;
      if (Math.hypot(x - item.x, z - item.z) < radius) return true;
    }
    return false;
  }

  function isProtectedStructureSite(state, x, z) {
    const gen = Game.generation3d;
    if (!gen) return false;
    if (gen.getVillages3D && pointNearAnyStructure(gen.getVillages3D(state), x, z, 18, 8)) return true;
    if (gen.getPortalRuins3D && pointNearAnyStructure(gen.getPortalRuins3D(state), x, z, 18, 8)) return true;
    if (gen.getTreasuries3D && pointNearAnyStructure(gen.getTreasuries3D(state), x, z, 42, 10)) return true;
    if (gen.getBearDens3D && pointNearAnyStructure(gen.getBearDens3D(state), x, z, 14, 8)) return true;
    const spawn = gen.getWorldSpawn3D ? gen.getWorldSpawn3D(state) : null;
    if (spawn && Number.isFinite(spawn.x) && Number.isFinite(spawn.z) && Math.hypot(x - spawn.x, z - spawn.z) < 18) return true;
    return false;
  }

  function rememberBuildSite(bot, goal) {
    if (!bot || !goal || !goal.target) return;
    if (!bot.memory) bot.memory = {};
    if (!Array.isArray(bot.memory.buildSites)) bot.memory.buildSites = [];
    const radius = Number.isFinite(goal.buildRadius) ? goal.buildRadius : (goal.structure === 'storehouse' ? 13 : goal.structure === 'tower' ? 10 : 11);
    bot.memory.buildSites.push({
      x: goal.target.x + 0.5,
      z: goal.target.z + 0.5,
      radius,
      structure: goal.structure || 'cabin',
    });
    if (bot.memory.buildSites.length > 8) bot.memory.buildSites.shift();
  }

  function createBuildGoal(state, bot, initial = false, variant = null) {
    const creative = state.worldMeta && state.worldMeta.mode === 'creative';
    const structure = variant || chooseBuildVariant();
    const materials = buildMaterialsForStructure(structure);
    return {
      type: 'build_structure',
      structure,
      target: buildGoalTarget(state, bot, initial),
      stage: 0,
      cursor: 0,
      cost: buildCost(structure, creative),
      materials,
      creative,
    };
  }

  function worldSpawnPoint(state) {
    const gen = Game.generation3d;
    const spawn = gen && gen.getWorldSpawn3D ? gen.getWorldSpawn3D(state) : null;
    if (spawn && Number.isFinite(spawn.x) && Number.isFinite(spawn.z)) return spawn;
    if (state && state.player && Number.isFinite(state.player.x) && Number.isFinite(state.player.z)) return state.player;
    return { x: state.world.w * 0.5, z: state.world.d * 0.5 };
  }

  function isNearBlastSite(bot, x, z, radius = 12) {
    const sites = bot && bot.memory && Array.isArray(bot.memory.blastSites) ? bot.memory.blastSites : [];
    for (const site of sites) {
      if (!site || !Number.isFinite(site.x) || !Number.isFinite(site.z)) continue;
      const limit = Number.isFinite(site.radius) ? site.radius : radius;
      if (Math.hypot(x - site.x, z - site.z) < limit) return true;
    }
    return false;
  }

  function isNearActiveDynamite(state, x, z, radius = 14) {
    const list = state && state.world && Array.isArray(state.world.activeDynamite) ? state.world.activeDynamite : [];
    for (const item of list) {
      if (!item || !Number.isFinite(item.x) || !Number.isFinite(item.z)) continue;
      const config = dynamiteConfig(item.id) || {};
      const limit = Math.max(radius, Number(config.radius) || 0);
      if (Math.hypot(x - (item.x + 0.5), z - (item.z + 0.5)) < limit) return true;
    }
    return false;
  }

  function isGoodBlastTarget(state, bot, x, z, radius = 16) {
    return !isNearBlastSite(bot, x, z, radius) && !isNearActiveDynamite(state, x, z, radius);
  }

  function rememberBlastSite(bot, goal, x, z) {
    if (!bot) return;
    if (!bot.memory) bot.memory = {};
    if (!Array.isArray(bot.memory.blastSites)) bot.memory.blastSites = [];
    bot.memory.blastSites.push({
      x: Number.isFinite(x) ? x + 0.5 : goal.target.x,
      z: Number.isFinite(z) ? z + 0.5 : goal.target.z,
      radius: goal && goal.powerful ? 36 : 20,
    });
    if (bot.memory.blastSites.length > 18) bot.memory.blastSites.shift();
  }

  function edgeBlastTarget(state, bot) {
    const spawn = worldSpawnPoint(state);
    const margin = 7;
    const candidates = [
      { x: margin, z: margin },
      { x: state.world.w - margin - 1, z: margin },
      { x: margin, z: state.world.d - margin - 1 },
      { x: state.world.w - margin - 1, z: state.world.d - margin - 1 },
      { x: state.world.w - margin - 1, z: state.world.d * 0.5 },
      { x: margin, z: state.world.d * 0.5 },
      { x: state.world.w * 0.5, z: state.world.d - margin - 1 },
      { x: state.world.w * 0.5, z: margin },
    ];
    let best = candidates[0];
    let bestDist = -Infinity;
    for (const candidate of candidates) {
      if (!isGoodBlastTarget(state, bot, candidate.x, candidate.z, 24)) continue;
      const dist = Math.hypot(candidate.x - spawn.x, candidate.z - spawn.z);
      if (dist > bestDist) {
        bestDist = dist;
        best = candidate;
      }
    }
    if (bestDist >= 0) return { x: best.x, z: best.z };
    best = candidates[0];
    bestDist = -Infinity;
    for (const candidate of candidates) {
      const dist = Math.hypot(candidate.x - spawn.x, candidate.z - spawn.z);
      if (dist > bestDist) {
        bestDist = dist;
        best = candidate;
      }
    }
    return { x: best.x, z: best.z };
  }

  function blastGoalTargetAround(state, bot, initial) {
    const minRadius = initial ? 10 : 20;
    const maxRadius = initial ? 24 : 48;
    for (let i = 0; i < 24; i += 1) {
      const target = goalTargetAround(bot, minRadius, maxRadius);
      if (isGoodBlastTarget(state, bot, target.x, target.z, 18)) return target;
    }
    const baseX = bot.memory && Number.isFinite(bot.memory.baseX) ? bot.memory.baseX : bot.x;
    const baseZ = bot.memory && Number.isFinite(bot.memory.baseZ) ? bot.memory.baseZ : bot.z;
    for (let i = 0; i < 32; i += 1) {
      const radius = minRadius + 8 + Math.floor(i / 8) * 10;
      const angle = i * Math.PI * 0.25 + Math.floor(i / 8) * 0.37;
      const target = {
        x: clamp(baseX + Math.cos(angle) * radius, 2, state.world.w - 3),
        z: clamp(baseZ + Math.sin(angle) * radius, 2, state.world.d - 3),
      };
      if (isGoodBlastTarget(state, bot, target.x, target.z, 18)) return target;
    }
    return goalTargetAround(bot, maxRadius + 12, maxRadius + 28);
  }

  function createBlastGoal(state, bot, initial = false) {
    const powerful = !initial && Math.random() > 0.82;
    const small = Math.random() < 0.78 ? BLOCK.DYNAMITE_SMALL : (Math.random() < 0.72 ? BLOCK.DYNAMITE_MEDIUM : BLOCK.DYNAMITE_LARGE);
    const powerfulBlocks = [BLOCK.DYNAMITE_HUGE, BLOCK.DYNAMITE_MEGA_HUGE, BLOCK.DYNAMITE_POWER_75, BLOCK.DYNAMITE_POWER_100];
    const id = powerful ? (powerfulBlocks[Math.floor(Math.random() * powerfulBlocks.length)] || BLOCK.DYNAMITE_HUGE) : small;
    const target = powerful ? edgeBlastTarget(state, bot) : blastGoalTargetAround(state, bot, initial);
    return {
      type: 'blast_tnt',
      target,
      stage: 0,
      cursor: 0,
      dynamite: id,
      powerful,
      teleportToEdge: powerful,
    };
  }

  function chooseGoal(state, bot, initial = false) {
    const creative = state.worldMeta && state.worldMeta.mode === 'creative';
    const mode = initial ? weightedChoice(bot.modeWeights, bot.role || 'explore') : weightedChoice(bot.modeWeights, 'wander');
    const base = { type: 'wander', target: goalTargetAround(bot, initial ? 8 : 18, initial ? 24 : (creative ? 80 : 54)), stage: 0 };
    if (mode === 'build' || mode === 'builder') {
      const goal = createBuildGoal(state, bot, initial);
      if (!creative && !hasBuildMaterials(bot, goal.materials)) {
        return { type: 'gather_build_resources', target: goalTargetAround(bot, 8, creative ? 42 : 28), stage: 0, cursor: 0, buildGoal: goal };
      }
      return goal;
    }
    if (mode === 'dig' || mode === 'digger') return { type: 'dig_stair', target: goalTargetAround(bot, initial ? 8 : 22, initial ? 18 : (creative ? 76 : 48)), stage: 0, cursor: 0, length: creative ? 18 : 11 };
    if (mode === 'mine' || mode === 'miner') return { type: 'mine_shaft', target: goalTargetAround(bot, initial ? 8 : 28, initial ? 18 : (creative ? 90 : 60)), stage: 0, cursor: 0, length: creative ? 26 : 16 };
    if (mode === 'gather' || mode === 'gatherer') return { type: 'gather_wood', target: goalTargetAround(bot, initial ? 10 : 22, initial ? 24 : (creative ? 96 : 62)), stage: 0, cursor: 0 };
    if (mode === 'hunt' || mode === 'hunter') return { type: 'patrol_mobs', target: goalTargetAround(bot, initial ? 14 : 28, initial ? 34 : (creative ? 110 : 70)), stage: 0, cursor: 0 };
    if (mode === 'blast' || mode === 'blaster') return createBlastGoal(state, bot, initial);
    if (mode === 'explore' || mode === 'explorer') return { type: 'explore', target: goalTargetAround(bot, initial ? 28 : 48, initial ? 58 : (creative ? 180 : 120)), stage: 0 };
    return base;
  }

  function isWorkGoal(goal) {
    return !!goal && (
      goal.type === 'build_house'
      || goal.type === 'build_structure'
      || goal.type === 'exit_structure'
      || goal.type === 'gather_build_resources'
      || goal.type === 'dig_stair'
      || goal.type === 'mine_shaft'
      || goal.type === 'mine_branch'
      || goal.type === 'dig_to_cave'
      || goal.type === 'gather_wood'
      || goal.type === 'blast_tnt'
    );
  }

  function tryJump(state, bot, strength = 1) {
    if (!bot.onGround || bot.jumpTimer > 0 || (state.worldMeta && state.worldMeta.mode === 'creative')) return false;
    bot.vy = Math.max(bot.vy, JUMP_SPEED * strength);
    bot.onGround = false;
    bot.jumpTimer = randRange(0.45, 1.15);
    return true;
  }

  function walkCandidateOpen(state, bot, yaw) {
    const step = 0.74;
    const x = bot.x + Math.cos(yaw) * step;
    const z = bot.z + Math.sin(yaw) * step;
    return canOccupyAt(state, x, bot.y, z, false);
  }

  function breakForwardObstacle(state, bot, yaw, dt) {
    const creative = state && state.worldMeta && state.worldMeta.mode === 'creative';
    const forwardX = Math.cos(yaw);
    const forwardZ = Math.sin(yaw);
    const centerX = Math.floor(bot.x + forwardX * 0.92);
    const centerZ = Math.floor(bot.z + forwardZ * 0.92);
    const y0 = Math.max(1, Math.floor(bot.y));
    const y1 = Math.min(state.world.h - 1, Math.floor(bot.y + BOT_HEIGHT));
    let touched = false;
    const mostlyX = Math.abs(forwardX) >= Math.abs(forwardZ);
    for (let side = -1; side <= 1; side += 1) {
      const x = mostlyX ? centerX : centerX + side;
      const z = mostlyX ? centerZ + side : centerZ;
      if (!inBounds3D(state.world, x, y0, z)) continue;
      for (let yy = y0; yy <= y1; yy += 1) {
        if (!isLoadedBotCell(state.world, x, yy, z)) continue;
        const id = getBlock3D(state, x, yy, z);
        if (id === BLOCK.AIR || isFluid(id) || id === BLOCK.BEDROCK) continue;
        touched = true;
        if (creative) setBlock3D(state, x, yy, z, BLOCK.AIR);
        else tryMine(state, bot, x, yy, z, dt || 0.1);
      }
    }
    if (touched && !creative) tryJump(state, bot, 1);
    return touched;
  }

  function chooseGroundYaw(state, bot, desiredYaw, dt) {
    const desiredOpen = walkCandidateOpen(state, bot, desiredYaw);
    if (!desiredOpen) breakForwardObstacle(state, bot, desiredYaw, dt);
    const candidates = [
      desiredYaw,
      desiredYaw - Math.PI * 0.5,
      desiredYaw + Math.PI * 0.5,
      desiredYaw - Math.PI * 0.25,
      desiredYaw + Math.PI * 0.25,
      desiredYaw + Math.PI,
    ];
    for (const yaw of candidates) {
      if (walkCandidateOpen(state, bot, yaw)) return yaw;
    }
    return null;
  }

  function walkToward(state, bot, target, dt, speedScale = 1) {
    if (!target) return true;
    const creative = state.worldMeta && state.worldMeta.mode === 'creative';
    const tx = clamp(target.x, 1, state.world.w - 2);
    const tz = clamp(target.z, 1, state.world.d - 2);
    const dx = tx + 0.5 - bot.x;
    const dz = tz + 0.5 - bot.z;
    const dist = Math.hypot(dx, dz);
    if (creative) {
      const groundY = Number.isFinite(target.y) ? target.y : (surfaceY(state, tx, tz) || bot.y);
      const flyY = clamp(groundY + 5.5, 3, state.world.h - 4);
      const dy = flyY - bot.y;
      if (dist < 1.2 && Math.abs(dy) < 1.4) {
        bot.vx = 0;
        bot.vy = 0;
        bot.vz = 0;
        return true;
      }
      bot.yaw = Math.atan2(dz, dx);
      const speed = FLY_SPEED * speedScale * (0.9 + bot.restlessness * 0.2);
      const horizontal = Math.max(0.001, dist);
      bot.vx = (dx / horizontal) * speed;
      bot.vz = (dz / horizontal) * speed;
      bot.vy = clamp(dy * 1.9, -speed, speed);
      bot.onGround = false;
      return false;
    }
    if (dist < 1.2) {
      bot.vx = 0;
      bot.vz = 0;
      return true;
    }
    const desiredYaw = Math.atan2(dz, dx);
    const speed = WALK_SPEED * speedScale * (0.86 + bot.restlessness * 0.28);
    const yaw = chooseGroundYaw(state, bot, desiredYaw, dt);
    if (yaw === null) {
      bot.vx = 0;
      bot.vz = 0;
      bot.yaw = desiredYaw;
      return false;
    }
    bot.yaw = yaw;
    bot.vx = Math.cos(bot.yaw) * speed;
    bot.vz = Math.sin(bot.yaw) * speed;
    if (bot.onGround) {
      const frontX = Math.floor(bot.x + Math.cos(desiredYaw) * 0.7);
      const frontZ = Math.floor(bot.z + Math.sin(desiredYaw) * 0.7);
      const footY = Math.floor(bot.y);
      if (!isPassable(getBlock3D(state, frontX, footY, frontZ)) && isPassable(getBlock3D(state, frontX, footY + 1, frontZ))) {
        tryJump(state, bot, 1);
      } else if (dist > 5 && Math.random() < 0.015 + bot.restlessness * 0.018) {
        tryJump(state, bot, 0.88);
      }
    }
    return false;
  }

  function applyCreativeFlight(state, bot, dt) {
    bot.onGround = false;
    const movedX = moveFlyAxis(state, bot, 'x', bot.vx * dt);
    const movedY = moveFlyAxis(state, bot, 'y', bot.vy * dt);
    const movedZ = moveFlyAxis(state, bot, 'z', bot.vz * dt);
    if (!movedX || !movedY || !movedZ) {
      breakForwardObstacle(state, bot, bot.yaw, dt);
      bot.vx = 0;
      bot.vy = 0;
      bot.vz = 0;
      bot.thinkTimer = Math.min(bot.thinkTimer, 0.2);
    }
  }

  function applyPhysics(state, bot, dt) {
    bot.vy -= GRAVITY * dt;
    bot.onGround = false;
    if (bot.vy > 0) moveAxis(state, bot, 'y', bot.vy * dt);
    const movedX = moveAxis(state, bot, 'x', bot.vx * dt);
    const movedZ = moveAxis(state, bot, 'z', bot.vz * dt);
    if (bot.vy <= 0) moveAxis(state, bot, 'y', bot.vy * dt);
    if (!movedX || !movedZ) {
      bot.vx = 0;
      bot.vz = 0;
      bot.thinkTimer = Math.min(bot.thinkTimer, 0.35);
    }
    if (bot.y < -8) {
      const y = surfaceY(state, bot.memory.baseX || state.player.x, bot.memory.baseZ || state.player.z) || state.player.y;
      bot.x = bot.memory.baseX || state.player.x;
      bot.y = y;
      bot.z = bot.memory.baseZ || state.player.z;
      bot.vx = 0;
      bot.vy = 0;
      bot.vz = 0;
      bot.goal = null;
    }
  }

  function prepareGoalSurface(state, bot) {
    const goal = bot.goal;
    if (!goal || !goal.target) return false;
    const y = surfaceY(state, goal.target.x, goal.target.z);
    if (y === null) {
      bot.goal = null;
      return false;
    }
    goal.target.x = clamp(Math.floor(goal.target.x), 3, state.world.w - 4);
    goal.target.y = y;
    goal.target.z = clamp(Math.floor(goal.target.z), 3, state.world.d - 4);
    goal.stage = 1;
    return false;
  }

  function addBoxBuildingSteps(goal, steps, options) {
    const { x0, z0, y, sizeX, sizeZ, height, wallId, roofId, floorId, doorX, doorZ, exitX, exitZ, tower, detail = 1 } = options;
    goal.entrance = { x: doorX, y, z: doorZ };
    goal.exitRoute = [
      { x: doorX, y, z: doorZ },
      { x: exitX, y, z: exitZ },
    ];
    for (let z = 0; z < sizeZ; z += 1) {
      for (let x = 0; x < sizeX; x += 1) {
        steps.push({ x: x0 + x, y: y - 1, z: z0 + z, id: floorId, replace: true });
      }
    }
    const cornerId = detail >= 2 ? BLOCK.PILLAR : wallId;
    for (let h = 0; h < height; h += 1) {
      for (let x = 0; x < sizeX; x += 1) {
        const northDoor = x0 + x === doorX && z0 === doorZ && h < 2;
        const northCorner = x === 0 || x === sizeX - 1;
        if (!northDoor) steps.push({ x: x0 + x, y: y + h, z: z0, id: northCorner ? cornerId : wallId });
        const southZ = z0 + sizeZ - 1;
        const southDoor = x0 + x === doorX && southZ === doorZ && h < 2;
        const southCorner = x === 0 || x === sizeX - 1;
        if (!southDoor) steps.push({ x: x0 + x, y: y + h, z: southZ, id: southCorner ? cornerId : wallId });
      }
      for (let z = 1; z < sizeZ - 1; z += 1) {
        const westDoor = x0 === doorX && z0 + z === doorZ && h < 2;
        if (!westDoor) steps.push({ x: x0, y: y + h, z: z0 + z, id: wallId });
        const eastX = x0 + sizeX - 1;
        const eastDoor = eastX === doorX && z0 + z === doorZ && h < 2;
        if (!eastDoor) steps.push({ x: eastX, y: y + h, z: z0 + z, id: wallId });
      }
    }
    for (let h = 0; h < 2; h += 1) steps.push({ x: doorX, y: y + h, z: doorZ, mine: true });
    if (detail >= 2 && height >= 3) {
      const windowY = y + 1;
      const wx1 = x0 + Math.floor(sizeX * 0.25);
      const wx2 = x0 + Math.floor(sizeX * 0.75);
      const wz1 = z0 + Math.floor(sizeZ * 0.25);
      const wz2 = z0 + Math.floor(sizeZ * 0.75);
      for (const item of [
        { x: wx1, z: z0 }, { x: wx2, z: z0 + sizeZ - 1 },
        { x: x0, z: wz1 }, { x: x0 + sizeX - 1, z: wz2 },
      ]) {
        if (item.x === doorX && item.z === doorZ) continue;
        steps.push({ x: item.x, y: windowY, z: item.z, mine: true });
      }
    }
    const overhang = tower ? 0 : 1;
    for (let z = -overhang; z < sizeZ + overhang; z += 1) {
      for (let x = -overhang; x < sizeX + overhang; x += 1) {
        steps.push({ x: x0 + x, y: y + height, z: z0 + z, id: roofId });
      }
    }
    if (detail >= 2) {
      for (let x = -1; x <= sizeX; x += 1) {
        steps.push({ x: x0 + x, y: y + height + 1, z: z0 - 1, id: roofId });
        steps.push({ x: x0 + x, y: y + height + 1, z: z0 + sizeZ, id: roofId });
      }
      steps.push({ x: doorX, y: y - 1, z: exitZ, id: BLOCK.PATH, replace: true });
      steps.push({ x: doorX, y, z: doorZ, mine: true });
      steps.push({ x: doorX, y: y + 1, z: doorZ, mine: true });
    }
    if (tower) {
      for (let x = 0; x < sizeX; x += 1) {
        if (x % 2 === 0) steps.push({ x: x0 + x, y: y + height + 1, z: z0, id: wallId });
        if (x % 2 === 1) steps.push({ x: x0 + x, y: y + height + 1, z: z0 + sizeZ - 1, id: wallId });
      }
      for (let z = 1; z < sizeZ - 1; z += 1) {
        if (z % 2 === 0) steps.push({ x: x0, y: y + height + 1, z: z0 + z, id: wallId });
        if (z % 2 === 1) steps.push({ x: x0 + sizeX - 1, y: y + height + 1, z: z0 + z, id: wallId });
      }
    }
    if (detail >= 3) {
      steps.push({ x: x0 + 1, y, z: z0 + 1, id: BLOCK.CHEST });
      steps.push({ x: x0 + sizeX - 2, y, z: z0 + sizeZ - 2, id: BLOCK.PILLAR });
      steps.push({ x: x0 + sizeX - 2, y: y + 1, z: z0 + sizeZ - 2, id: BLOCK.PILLAR });
      steps.push({ x: x0 + sizeX - 2, y: y + height + 1, z: z0 + sizeZ - 2, id: BLOCK.STONE });
    }
  }

  function setOpenBuildRoute(goal, x, y, z, exitX, exitZ, radius) {
    goal.entrance = { x, y, z };
    goal.exitRoute = [
      { x, y, z },
      { x: exitX, y, z: exitZ },
    ];
    goal.buildRadius = radius;
  }

  function addCastleSteps(goal, steps, plan) {
    const y = goal.target.y;
    const size = 9 + (plan.index % 2) * 2;
    const x0 = goal.target.x - Math.floor(size / 2);
    const z0 = goal.target.z - Math.floor(size / 2);
    const gateX = goal.target.x;
    const gateZ = z0;
    setOpenBuildRoute(goal, gateX, y, gateZ, gateX, z0 - 1, size + 5);
    for (let z = 0; z < size; z += 1) {
      for (let x = 0; x < size; x += 1) {
        const edge = x === 0 || z === 0 || x === size - 1 || z === size - 1;
        steps.push({ x: x0 + x, y: y - 1, z: z0 + z, id: edge ? BLOCK.STONE : BLOCK.PATH, replace: true });
      }
    }
    for (let h = 0; h < 3; h += 1) {
      for (let x = 0; x < size; x += 1) {
        const worldX = x0 + x;
        const gate = worldX === gateX && h < 2;
        if (!gate) steps.push({ x: worldX, y: y + h, z: z0, id: BLOCK.STONE });
        steps.push({ x: worldX, y: y + h, z: z0 + size - 1, id: BLOCK.STONE });
      }
      for (let z = 1; z < size - 1; z += 1) {
        steps.push({ x: x0, y: y + h, z: z0 + z, id: BLOCK.STONE });
        steps.push({ x: x0 + size - 1, y: y + h, z: z0 + z, id: BLOCK.STONE });
      }
    }
    for (const corner of [[x0, z0], [x0 + size - 1, z0], [x0, z0 + size - 1], [x0 + size - 1, z0 + size - 1]]) {
      const [cx, cz] = corner;
      for (let h = 0; h < 5; h += 1) steps.push({ x: cx, y: y + h, z: cz, id: h % 2 === 0 ? BLOCK.PILLAR : BLOCK.STONE, replace: true });
      steps.push({ x: cx, y: y + 5, z: cz, id: BLOCK.STONE, replace: true });
    }
    for (let h = 0; h < 2; h += 1) steps.push({ x: gateX, y: y + h, z: gateZ, mine: true });
    steps.push({ x: goal.target.x, y, z: goal.target.z, id: BLOCK.CHEST });
  }

  function addFountainSteps(goal, steps, plan) {
    const y = goal.target.y;
    const size = 5 + (plan.index % 2) * 2;
    const x0 = goal.target.x - Math.floor(size / 2);
    const z0 = goal.target.z - Math.floor(size / 2);
    setOpenBuildRoute(goal, x0 + Math.floor(size / 2), y, z0, x0 + Math.floor(size / 2), z0 - 1, size + 4);
    for (let z = -1; z <= size; z += 1) {
      for (let x = -1; x <= size; x += 1) {
        steps.push({ x: x0 + x, y: y - 1, z: z0 + z, id: BLOCK.PATH, replace: true });
      }
    }
    for (let z = 0; z < size; z += 1) {
      for (let x = 0; x < size; x += 1) {
        const edge = x === 0 || z === 0 || x === size - 1 || z === size - 1;
        if (edge) steps.push({ x: x0 + x, y, z: z0 + z, id: BLOCK.STONE });
        else steps.push({ x: x0 + x, y: y - 1, z: z0 + z, id: BLOCK.STONE, replace: true });
      }
    }
    const cx = goal.target.x;
    const cz = goal.target.z;
    steps.push({ x: cx, y, z: cz, id: BLOCK.PILLAR });
    steps.push({ x: cx, y: y + 1, z: cz, id: BLOCK.PILLAR });
    steps.push({ x: cx, y: y + 2, z: cz, id: BLOCK.STONE });
    if (goal.creative) {
      steps.push({ x: cx, y: y + 3, z: cz, id: BLOCK.WATER });
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) steps.push({ x: cx + dx, y, z: cz + dz, id: BLOCK.WATER });
    }
  }

  function addParkSteps(goal, steps, plan) {
    const y = goal.target.y;
    const size = 11;
    const x0 = goal.target.x - 5;
    const z0 = goal.target.z - 5;
    setOpenBuildRoute(goal, goal.target.x, y, z0, goal.target.x, z0 - 1, 15);
    for (let z = 0; z < size; z += 1) {
      for (let x = 0; x < size; x += 1) {
        if (x === 5 || z === 5 || x === z || x + z === size - 1) steps.push({ x: x0 + x, y: y - 1, z: z0 + z, id: BLOCK.PATH, replace: true });
      }
    }
    for (const [tx, tz] of [[1, 1], [9, 1], [1, 9], [9, 9]]) {
      const wx = x0 + tx;
      const wz = z0 + tz;
      steps.push({ x: wx, y, z: wz, id: BLOCK.WOOD });
      steps.push({ x: wx, y: y + 1, z: wz, id: BLOCK.WOOD });
      for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) steps.push({ x: wx + dx, y: y + 2, z: wz + dz, id: BLOCK.LEAF });
      steps.push({ x: wx, y: y + 3, z: wz, id: BLOCK.LEAF });
    }
    for (const [bx, bz] of [[3, 5], [7, 5], [5, 3], [5, 7]]) {
      steps.push({ x: x0 + bx, y, z: z0 + bz, id: BLOCK.PLANK });
      steps.push({ x: x0 + bx + (bx === 5 ? 1 : 0), y, z: z0 + bz + (bz === 5 ? 1 : 0), id: BLOCK.PLANK });
    }
  }

  function addMonumentSteps(goal, steps, plan) {
    const y = goal.target.y;
    const x0 = goal.target.x - 3;
    const z0 = goal.target.z - 3;
    setOpenBuildRoute(goal, goal.target.x, y, z0, goal.target.x, z0 - 1, 10);
    for (let z = 0; z < 7; z += 1) {
      for (let x = 0; x < 7; x += 1) steps.push({ x: x0 + x, y: y - 1, z: z0 + z, id: (x + z) % 2 === 0 ? BLOCK.STONE : BLOCK.PATH, replace: true });
    }
    for (const [px, pz] of [[1, 1], [5, 1], [1, 5], [5, 5]]) {
      for (let h = 0; h < 4; h += 1) steps.push({ x: x0 + px, y: y + h, z: z0 + pz, id: BLOCK.PILLAR });
    }
    for (let x = 1; x <= 5; x += 1) {
      steps.push({ x: x0 + x, y: y + 4, z: z0 + 1, id: BLOCK.STONE });
      steps.push({ x: x0 + x, y: y + 4, z: z0 + 5, id: BLOCK.STONE });
    }
    steps.push({ x: goal.target.x, y, z: goal.target.z, id: BLOCK.PLANK });
  }

  function addGardenSteps(goal, steps, plan) {
    const y = goal.target.y;
    const sizeX = 9;
    const sizeZ = 7;
    const x0 = goal.target.x - 4;
    const z0 = goal.target.z - 3;
    setOpenBuildRoute(goal, goal.target.x, y, z0, goal.target.x, z0 - 1, 13);
    for (let z = 0; z < sizeZ; z += 1) {
      for (let x = 0; x < sizeX; x += 1) {
        const edge = x === 0 || z === 0 || x === sizeX - 1 || z === sizeZ - 1;
        const cross = x === 4 || z === 3;
        if (edge) steps.push({ x: x0 + x, y, z: z0 + z, id: BLOCK.LEAF });
        if (cross) steps.push({ x: x0 + x, y: y - 1, z: z0 + z, id: BLOCK.PATH, replace: true });
      }
    }
    for (let h = 0; h < 3; h += 1) {
      steps.push({ x: goal.target.x - 1, y: y + h, z: goal.target.z, id: BLOCK.PILLAR });
      steps.push({ x: goal.target.x + 1, y: y + h, z: goal.target.z, id: BLOCK.PILLAR });
    }
    for (let x = -2; x <= 2; x += 1) steps.push({ x: goal.target.x + x, y: y + 3, z: goal.target.z, id: BLOCK.PLANK });
    steps.push({ x: goal.target.x, y, z: goal.target.z, id: BLOCK.CHEST });
  }

  function addDiverseStructureSteps(goal, steps, plan) {
    if (plan.kind === 'castle') addCastleSteps(goal, steps, plan);
    else if (plan.kind === 'fountain') addFountainSteps(goal, steps, plan);
    else if (plan.kind === 'park') addParkSteps(goal, steps, plan);
    else if (plan.kind === 'monument') addMonumentSteps(goal, steps, plan);
    else if (plan.kind === 'garden') addGardenSteps(goal, steps, plan);
  }

  function buildPlanIndex(variant) {
    if (typeof variant !== 'string') return null;
    const match = /^plan_(\d+)$/.exec(variant);
    if (!match) return null;
    const index = Number(match[1]);
    return Number.isFinite(index) ? index : null;
  }

  function buildPlanConfig(variant) {
    const index = buildPlanIndex(variant);
    if (index === null) return null;
    const kindPattern = index % 10;
    const kind = kindPattern === 0 ? 'castle'
      : kindPattern === 1 ? 'fountain'
        : kindPattern === 2 ? 'park'
          : kindPattern === 3 ? 'monument'
            : kindPattern === 4 ? 'garden'
              : 'house';
    const wallOptions = [BLOCK.WOOD, BLOCK.PLANK, BLOCK.SPRUCE_WOOD, BLOCK.PILLAR];
    const roofOptions = [BLOCK.PLANK, BLOCK.SPRUCE_LEAF, BLOCK.LEAF, BLOCK.WOOD];
    const floorOptions = [BLOCK.PLANK, BLOCK.SPRUCE_WOOD, BLOCK.WOOD, BLOCK.PATH];
    return {
      index,
      kind,
      sizeX: 5 + (index % 4),
      sizeZ: 4 + (Math.floor(index / 4) % 4),
      height: 2 + (Math.floor(index / 16) % 4),
      wallId: wallOptions[index % wallOptions.length],
      roofId: roofOptions[Math.floor(index / 2) % roofOptions.length],
      floorId: floorOptions[Math.floor(index / 3) % floorOptions.length],
      detail: 2 + (index % 3),
      tower: index % 11 === 0,
      stoneCost: index % 5 === 0 ? 4 : 0,
    };
  }

  function createStructureSteps(goal) {
    if (goal.steps) return goal.steps;
    const variant = goal.structure || 'cabin';
    const y = goal.target.y;
    const steps = [];
    const plan = buildPlanConfig(variant);
    if (plan && plan.kind !== 'house') {
      addDiverseStructureSteps(goal, steps, plan);
    } else if (plan) {
      const sizeX = plan.sizeX;
      const sizeZ = plan.sizeZ;
      const x0 = goal.target.x - Math.floor(sizeX / 2);
      const z0 = goal.target.z - Math.floor(sizeZ / 2);
      const doorSouth = z0 <= 1;
      const doorZ = doorSouth ? z0 + sizeZ - 1 : z0;
      const doorX = x0 + Math.floor(sizeX / 2);
      addBoxBuildingSteps(goal, steps, {
        x0,
        z0,
        y,
        sizeX,
        sizeZ,
        height: plan.height,
        wallId: plan.wallId,
        roofId: plan.roofId,
        floorId: plan.floorId,
        doorX,
        doorZ,
        exitX: doorX,
        exitZ: doorSouth ? z0 + sizeZ : z0 - 1,
        tower: plan.tower,
        detail: plan.detail,
      });
    } else if (variant === 'shed') {
      const sizeX = 5;
      const sizeZ = 4;
      const x0 = goal.target.x - 2;
      const z0 = goal.target.z - 2;
      const doorSouth = z0 <= 1;
      const doorZ = doorSouth ? z0 + sizeZ - 1 : z0;
      addBoxBuildingSteps(goal, steps, { x0, z0, y, sizeX, sizeZ, height: 2, wallId: BLOCK.WOOD, roofId: BLOCK.LEAF, floorId: BLOCK.PLANK, doorX: x0 + 2, doorZ, exitX: x0 + 2, exitZ: doorSouth ? z0 + sizeZ : z0 - 1, tower: false, detail: 2 });
    } else if (variant === 'tower') {
      const sizeX = 4;
      const sizeZ = 4;
      const x0 = goal.target.x - 2;
      const z0 = goal.target.z - 2;
      const doorSouth = z0 <= 1;
      const doorZ = doorSouth ? z0 + sizeZ - 1 : z0;
      addBoxBuildingSteps(goal, steps, { x0, z0, y, sizeX, sizeZ, height: 5, wallId: BLOCK.WOOD, roofId: BLOCK.PLANK, floorId: BLOCK.PLANK, doorX: x0 + 1, doorZ, exitX: x0 + 1, exitZ: doorSouth ? z0 + sizeZ : z0 - 1, tower: true, detail: 3 });
    } else if (variant === 'storehouse') {
      const sizeX = 7;
      const sizeZ = 6;
      const x0 = goal.target.x - 3;
      const z0 = goal.target.z - 3;
      const doorSouth = z0 <= 1;
      const doorZ = doorSouth ? z0 + sizeZ - 1 : z0;
      addBoxBuildingSteps(goal, steps, { x0, z0, y, sizeX, sizeZ, height: 3, wallId: BLOCK.WOOD, roofId: BLOCK.PLANK, floorId: BLOCK.PLANK, doorX: x0 + 3, doorZ, exitX: x0 + 3, exitZ: doorSouth ? z0 + sizeZ : z0 - 1, tower: false, detail: 3 });
      steps.push({ x: x0 + 1, y, z: z0 + 2, id: BLOCK.CHEST });
      steps.push({ x: x0 + 5, y, z: z0 + 2, id: BLOCK.CHEST });
    } else {
      const sizeX = 6;
      const sizeZ = 6;
      const x0 = goal.target.x - 3;
      const z0 = goal.target.z - 3;
      const doorSouth = z0 <= 1;
      const doorZ = doorSouth ? z0 + sizeZ - 1 : z0;
      addBoxBuildingSteps(goal, steps, { x0, z0, y, sizeX, sizeZ, height: 3, wallId: BLOCK.WOOD, roofId: BLOCK.PLANK, floorId: BLOCK.PLANK, doorX: x0 + 3, doorZ, exitX: x0 + 3, exitZ: doorSouth ? z0 + sizeZ : z0 - 1, tower: false, detail: 2 });
    }
    goal.steps = steps;
    return steps;
  }

  function climbTowardBuildStep(state, bot, step) {
    if (!state || !state.world || !bot || !step || (state.worldMeta && state.worldMeta.mode === 'creative')) return false;
    const currentY = Math.floor(bot.y);
    if (!Number.isFinite(step.y) || step.y <= currentY + 2) return false;
    const nextY = Math.min(step.y - 2, currentY + 1);
    const x = clamp(Math.floor(bot.x), 1, state.world.w - 2);
    const z = clamp(Math.floor(bot.z), 1, state.world.d - 2);
    const supportY = clamp(nextY - 1, 0, state.world.h - 2);
    if (!isLoadedBotCell(state.world, x, supportY, z)) return false;
    const supportId = getBlock3D(state, x, supportY, z);
    if (supportId === BLOCK.AIR || isFluid(supportId)) setBlock3D(state, x, supportY, z, BLOCK.PLANK);
    bot.x = x + 0.5;
    bot.y = nextY;
    bot.z = z + 0.5;
    bot.vx = 0;
    bot.vy = 0;
    bot.vz = 0;
    bot.onGround = true;
    bot.jumpTimer = Math.max(bot.jumpTimer || 0, 0.2);
    return true;
  }

  function consumeBuildStepMaterial(state, bot, goal, step) {
    if (!step || step.mine || !Number.isFinite(step.id)) return true;
    if (state.worldMeta && state.worldMeta.mode === 'creative') return true;
    if (!goal || !goal.materials) return true;
    if (consumeBlockResource(bot, step.id, 1)) return true;
    craftBuildMaterials(bot, goal.materials);
    return consumeBlockResource(bot, step.id, 1);
  }

  function buildStructureStep(state, bot, dt) {
    const goal = bot.goal;
    if (!goal || !goal.target) return true;
    if (goal.stage === 0) return prepareGoalSurface(state, bot);
    if (goal.stage === 1 && !walkToward(state, bot, goal.target, 0, state.worldMeta && state.worldMeta.mode === 'creative' ? 1.35 : 0.8)) return false;
    goal.stage = 2;
    if (typeof goal.creative !== 'boolean') goal.creative = !!(state.worldMeta && state.worldMeta.mode === 'creative');
    const steps = createStructureSteps(goal);
    const step = steps[goal.cursor || 0];
    if (!step) {
      const route = Array.isArray(goal.exitRoute) ? goal.exitRoute : [];
      rememberBuildSite(bot, goal);
      bot.goal = { type: 'exit_structure', route, stage: 0 };
      return false;
    }
    if (climbTowardBuildStep(state, bot, step)) return false;
    bot.yaw = Math.atan2(step.z + 0.5 - bot.z, step.x + 0.5 - bot.x);
    if (step.mine) tryMine(state, bot, step.x, step.y, step.z, dt);
    else if (!consumeBuildStepMaterial(state, bot, goal, step)) {
      bot.goal = { type: 'gather_build_resources', target: goalTargetAround(bot, 8, 28), stage: 0, cursor: 0, buildGoal: goal };
      return false;
    } else if (step.replace && isLoadedBotCell(state.world, step.x, step.y, step.z)) setBlock3D(state, step.x, step.y, step.z, step.id);
    else tryPlaceFromInventory(state, bot, step.x, step.y, step.z, step.id);
    goal.cursor = (goal.cursor || 0) + 1;
    return false;
  }

  function buildHouseStep(state, bot, dt) {
    if (bot && bot.goal && !bot.goal.structure) bot.goal.structure = 'cabin';
    return buildStructureStep(state, bot, dt);
  }

  function exitStructureStep(state, bot, dt) {
    const goal = bot.goal;
    if (!goal || !Array.isArray(goal.route) || goal.route.length === 0) return true;
    const stage = Number.isFinite(goal.stage) ? goal.stage : 0;
    const target = goal.route[stage];
    if (!target) return true;
    const y = Number.isFinite(target.y) ? target.y : Math.floor(bot.y);
    tryMine(state, bot, Math.floor(target.x), y, Math.floor(target.z), dt);
    tryMine(state, bot, Math.floor(target.x), y + 1, Math.floor(target.z), dt);
    if (!walkToward(state, bot, target, 0, 0.9)) return false;
    goal.stage = stage + 1;
    return goal.stage >= goal.route.length;
  }

  function digStairStep(state, bot, branch, dt) {
    const goal = bot.goal;
    if (!goal || !goal.target) return true;
    if (goal.stage === 0) return prepareGoalSurface(state, bot);
    if (goal.stage === 1 && !walkToward(state, bot, goal.target, 0, 0.9)) return false;
    goal.stage = 2;
    if (!Number.isFinite(goal.dir)) goal.dir = Math.floor(Math.random() * 4);
    const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    const dir = dirs[goal.dir];
    const len = goal.length || 12;
    const i = goal.cursor || 0;
    if (i >= len) return true;
    const depth = branch ? Math.floor(i / 3) : i;
    const side = branch ? ((i % 3) - 1) : 0;
    const x = goal.target.x + dir[0] * i + (dir[1] * side);
    const z = goal.target.z + dir[1] * i + (dir[0] * side);
    const y = Math.max(2, goal.target.y - depth);
    bot.yaw = Math.atan2(z + 0.5 - bot.z, x + 0.5 - bot.x);
    for (let yy = y; yy <= y + 2; yy += 1) {
      const mined = tryMine(state, bot, x, yy, z, dt);
      if (mined) addMinedResource(bot, mined);
    }
    if (!branch && i > 1) tryPlace(state, x - dir[0], y - 1, z - dir[1], BLOCK.STONE);
    if (i % 4 === 0 && !(state.worldMeta && state.worldMeta.mode === 'creative')) {
      bot.x = x + 0.5;
      bot.y = y;
      bot.z = z + 0.5;
    }
    goal.cursor = i + 1;
    return false;
  }

  function mineShaftStep(state, bot, dt) {
    const goal = bot.goal;
    if (!goal || !goal.target) return true;
    if (goal.stage === 0) return prepareGoalSurface(state, bot);
    if (goal.stage === 1 && !walkToward(state, bot, goal.target, 0, 0.95)) return false;
    goal.stage = 2;
    const depth = goal.cursor || 0;
    const length = goal.length || 16;
    if (depth >= length || goal.target.y - depth <= 2) {
      if (state.worldMeta && state.worldMeta.mode === 'creative') {
        const caveGoal = createDigToCaveGoal(state, bot, goal);
        if (caveGoal) {
          bot.goal = caveGoal;
          return false;
        }
      }
      if (!(state.worldMeta && state.worldMeta.mode === 'creative')) {
        bot.goal = {
          type: 'mine_branch',
          target: { x: Math.floor(bot.x), y: Math.max(2, Math.floor(bot.y)), z: Math.floor(bot.z) },
          stage: 2,
          cursor: 0,
          length: 10 + Math.floor(Math.random() * 8),
          dir: Math.floor(Math.random() * 4),
        };
        return false;
      }
      return true;
    }
    const cx = goal.target.x;
    const cz = goal.target.z;
    const y = goal.target.y - depth;
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const mined0 = tryMine(state, bot, cx + dx, y, cz + dz, dt);
        const mined1 = tryMine(state, bot, cx + dx, y + 1, cz + dz, dt);
        const mined2 = tryMine(state, bot, cx + dx, y + 2, cz + dz, dt);
        if (mined0) addMinedResource(bot, mined0);
        if (mined1) addMinedResource(bot, mined1);
        if (mined2) addMinedResource(bot, mined2);
      }
    }
    bot.yaw = Math.atan2(cz + 0.5 - bot.z, cx + 0.5 - bot.x);
    if (!(state.worldMeta && state.worldMeta.mode === 'creative') && depth % 2 === 0) {
      bot.x = cx + 0.5;
      bot.y = Math.max(2, y + 1);
      bot.z = cz + 0.5;
    }
    goal.cursor = depth + 1;
    return false;
  }

  function nearestCave(state, x, z) {
    const generation = Game.generation3d;
    if (!generation || !generation.getCaveEntrancesInArea3D) return null;
    const range = 160;
    const caves = generation.getCaveEntrancesInArea3D(state, x - range, z - range, x + range, z + range) || [];
    let best = null;
    let bestDist = Infinity;
    for (const cave of caves) {
      const cx = Number.isFinite(cave.x) ? cave.x : cave.endX;
      const cz = Number.isFinite(cave.z) ? cave.z : cave.endZ;
      if (!Number.isFinite(cx) || !Number.isFinite(cz)) continue;
      const dist = Math.hypot(cx - x, cz - z);
      if (dist < bestDist) {
        bestDist = dist;
        best = cave;
      }
    }
    return best;
  }

  function createDigToCaveGoal(state, bot, sourceGoal) {
    const sx = sourceGoal && sourceGoal.target && Number.isFinite(sourceGoal.target.x) ? sourceGoal.target.x : bot.x;
    const sz = sourceGoal && sourceGoal.target && Number.isFinite(sourceGoal.target.z) ? sourceGoal.target.z : bot.z;
    const sy = sourceGoal && sourceGoal.target && Number.isFinite(sourceGoal.target.y) ? sourceGoal.target.y : bot.y;
    const cave = nearestCave(state, sx, sz);
    if (!cave) return null;
    const targetX = Number.isFinite(cave.x) ? cave.x : cave.endX;
    const targetZ = Number.isFinite(cave.z) ? cave.z : cave.endZ;
    const targetY = Number.isFinite(cave.startY) ? cave.startY : (Number.isFinite(cave.endY) ? cave.endY : sy);
    return {
      type: 'dig_to_cave',
      from: { x: sx, y: sy, z: sz },
      target: { x: targetX, y: targetY, z: targetZ },
      stage: 0,
      cursor: 0,
      length: Math.max(1, Math.ceil(Math.hypot(targetX - sx, targetZ - sz))),
    };
  }

  function digToCaveStep(state, bot, dt) {
    const goal = bot.goal;
    if (!goal || !goal.target || !goal.from) return true;
    const length = Math.max(1, goal.length || 1);
    const cursor = Math.min(length, goal.cursor || 0);
    const t = cursor / length;
    const x = Math.round(goal.from.x + (goal.target.x - goal.from.x) * t);
    const z = Math.round(goal.from.z + (goal.target.z - goal.from.z) * t);
    const y = Math.round(goal.from.y + (goal.target.y - goal.from.y) * t);
    for (let yy = y; yy <= y + 2; yy += 1) {
      const mined = tryMine(state, bot, x, yy, z, dt);
      if (mined) addMinedResource(bot, mined);
    }
    const arrived = walkToward(state, bot, goal.target, 0, 1.25);
    if (Math.hypot(bot.x - (goal.target.x + 0.5), bot.z - (goal.target.z + 0.5)) < 1.4 || cursor >= length) return true;
    goal.cursor = cursor + 1;
    return arrived && goal.cursor >= goal.length;
  }

  function blastTntStep(state, bot, dt) {
    const goal = bot.goal;
    if (!goal || !goal.target) return true;
    if (goal.cooldown > 0) {
      goal.cooldown = Math.max(0, goal.cooldown - dt);
      return false;
    }
    const tx = clamp(Math.floor(goal.target.x), 1, state.world.w - 2);
    const tz = clamp(Math.floor(goal.target.z), 1, state.world.d - 2);
    if (isNearActiveDynamite(state, tx + 0.5, tz + 0.5, goal.powerful ? 24 : 12)) {
      rememberBlastSite(bot, goal, tx, tz);
      return true;
    }
    const groundY = surfaceY(state, tx, tz);
    const placeY = clamp(Number.isFinite(groundY) ? groundY : Math.floor(bot.y), 1, state.world.h - 2);
    goal.target.y = placeY;
    if (goal.teleportToEdge) {
      bot.x = tx + 0.5;
      bot.y = clamp(placeY + 5, 2, state.world.h - 3);
      bot.z = tz + 0.5;
      bot.vx = 0;
      bot.vy = 0;
      bot.vz = 0;
      bot.onGround = false;
      goal.teleportToEdge = false;
      goal.stage = 1;
      return false;
    }
    if (Math.hypot(bot.x - (tx + 0.5), bot.z - (tz + 0.5)) > 2.2) {
      return walkToward(state, bot, { x: tx, y: placeY, z: tz }, dt, goal.powerful ? 1.35 : 1.0);
    }
    const id = goal.dynamite || BLOCK.DYNAMITE_SMALL;
    const targetBlock = getBlock3D(state, tx, placeY, tz);
    if (isDynamiteBlock(targetBlock)) {
      rememberBlastSite(bot, goal, tx, tz);
      return true;
    }
    if (targetBlock !== BLOCK.AIR) {
      tryMine(state, bot, tx, placeY, tz, dt);
      goal.blockedTimer = (goal.blockedTimer || 0) + dt;
      if (goal.blockedTimer > 4) {
        rememberBlastSite(bot, goal, tx, tz);
        return true;
      }
      return false;
    }
    if (tryPlace(state, tx, placeY, tz, id)) {
      activateBotDynamite(state, tx, placeY, tz, id);
      rememberBlastSite(bot, goal, tx, tz);
      return true;
    }
    return false;
  }

  function gatherWoodStep(state, bot, dt) {
    const goal = bot.goal;
    if (!goal || !goal.target) return true;
    if (goal.stage === 0) return prepareGoalSurface(state, bot);
    if (goal.stage === 1 && !walkToward(state, bot, goal.target, 0, 0.9)) return false;
    goal.stage = 2;
    const bx = Math.floor(bot.x);
    const bz = Math.floor(bot.z);
    for (let r = 1; r <= 8; r += 1) {
      for (let dz = -r; dz <= r; dz += 1) {
        for (let dx = -r; dx <= r; dx += 1) {
          const x = bx + dx;
          const z = bz + dz;
          for (let y = Math.floor(bot.y) - 1; y <= Math.floor(bot.y) + 7; y += 1) {
            const id = getBlock3D(state, x, y, z);
            if (id === BLOCK.WOOD || id === BLOCK.SPRUCE_WOOD || id === BLOCK.LEAF) {
              bot.yaw = Math.atan2(z + 0.5 - bot.z, x + 0.5 - bot.x);
              const mined = tryMine(state, bot, x, y, z, dt);
              if (mined) addMinedResource(bot, mined);
              goal.cursor = (goal.cursor || 0) + 1;
              return goal.cursor > 28;
            }
          }
        }
      }
    }
    return true;
  }

  function gatherBuildResourcesStep(state, bot, dt) {
    const goal = bot.goal;
    if (!goal || !goal.buildGoal) return true;
    if (hasBuildMaterials(bot, goal.buildGoal.materials)) {
      bot.goal = goal.buildGoal;
      bot.goal.stage = 0;
      bot.goal.cursor = 0;
      return false;
    }
    if (!goal.target) goal.target = goalTargetAround(bot, 8, 28);
    if (goal.stage === 0) return prepareGoalSurface(state, bot);
    if (goal.stage === 1 && !walkToward(state, bot, goal.target, 0, 0.95)) return false;
    goal.stage = 2;
    const bx = Math.floor(bot.x);
    const bz = Math.floor(bot.z);
    const missing = missingBuildMaterialIds(bot, goal.buildGoal.materials);
    for (let r = 1; r <= 10; r += 1) {
      for (let dz = -r; dz <= r; dz += 1) {
        for (let dx = -r; dx <= r; dx += 1) {
          const x = bx + dx;
          const z = bz + dz;
          for (let y = Math.floor(bot.y) - 1; y <= Math.floor(bot.y) + 8; y += 1) {
            const id = getBlock3D(state, x, y, z);
            if (missing.has(id)) {
              bot.yaw = Math.atan2(z + 0.5 - bot.z, x + 0.5 - bot.x);
              const mined = tryMine(state, bot, x, y, z, dt);
              if (mined) addMinedResource(bot, mined);
              goal.cursor = (goal.cursor || 0) + 1;
              if (hasBuildMaterials(bot, goal.buildGoal.materials)) {
                bot.goal = goal.buildGoal;
                bot.goal.stage = 0;
                bot.goal.cursor = 0;
              }
              return false;
            }
          }
        }
      }
    }
    goal.target = goalTargetAround(bot, 8, 32);
    goal.stage = 0;
    goal.cursor = (goal.cursor || 0) + 1;
    return goal.cursor > 8;
  }

  function patrolMobsStep(state, bot) {
    const mobs = state.entities && Array.isArray(state.entities.sheep) ? state.entities.sheep : [];
    let target = null;
    let best = Infinity;
    for (const mob of mobs) {
      const dx = mob.x - bot.x;
      const dz = mob.z - bot.z;
      const dist = dx * dx + dz * dz;
      if (dist < best) {
        best = dist;
        target = mob;
      }
    }
    if (target && best < 28 * 28) {
      walkToward(state, bot, target, 0, 1.08);
      if (best < 2.4 * 2.4 && Game.entities3d && Game.entities3d.damageSheep3D) {
        Game.entities3d.damageSheep3D(state, target.id, 1, bot.x, bot.z);
        return Math.random() < 0.18;
      }
      return false;
    }
    if (!bot.goal.target) bot.goal.target = goalTargetAround(bot, 14, 34);
    return walkToward(state, bot, bot.goal.target, 0, 1.0);
  }

  function updateGoal(state, bot, dt) {
    const goal = bot.goal;
    if (!goal) return true;
    if (goal.type === 'build_house') return buildHouseStep(state, bot, dt);
    if (goal.type === 'build_structure') return buildStructureStep(state, bot, dt);
    if (goal.type === 'exit_structure') return exitStructureStep(state, bot, dt);
    if (goal.type === 'gather_build_resources') return gatherBuildResourcesStep(state, bot, dt);
    if (goal.type === 'dig_stair') return digStairStep(state, bot, false, dt);
    if (goal.type === 'mine_shaft') return mineShaftStep(state, bot, dt);
    if (goal.type === 'dig_to_cave') return digToCaveStep(state, bot, dt);
    if (goal.type === 'mine_branch') return digStairStep(state, bot, true, dt);
    if (goal.type === 'gather_wood') return gatherWoodStep(state, bot, dt);
    if (goal.type === 'blast_tnt') return blastTntStep(state, bot, dt);
    if (goal.type === 'patrol_mobs') return patrolMobsStep(state, bot);
    if (goal.type === 'explore' || goal.type === 'wander') return walkToward(state, bot, goal.target, 0, goal.type === 'explore' ? 1.05 : 0.75);
    return true;
  }

  function updateExplosionKnockbackBot(state, bot, dt) {
    if (!bot || !(bot.explosionKnockbackTimer > 0)) return false;
    bot.explosionKnockbackTimer = Math.max(0, bot.explosionKnockbackTimer - dt);
    bot.thinkTimer = Math.max(bot.thinkTimer || 0, bot.explosionKnockbackTimer);
    bot.actionTimer = Math.max(bot.actionTimer || 0, Math.min(0.25, bot.explosionKnockbackTimer));
    if (state.worldMeta && state.worldMeta.mode === 'creative') applyCreativeFlight(state, bot, dt);
    else applyPhysics(state, bot, dt);
    if (bot.explosionKnockbackTimer <= 0) {
      bot.vx *= 0.35;
      bot.vz *= 0.35;
    }
    return true;
  }

  function updateBot(state, bot, dt) {
    initBot(bot);
    ensureBotHealth(state, bot);
    bot.damageFlash = Math.max(0, (bot.damageFlash || 0) - dt);
    if (updateExplosionKnockbackBot(state, bot, dt)) return;
    bot.thinkTimer -= dt;
    bot.actionTimer -= dt;
    bot.lookTimer -= dt;
    bot.jumpTimer = Math.max(0, bot.jumpTimer - dt);
    if (bot.lookTimer <= 0) {
      bot.yaw += randRange(-0.28, 0.28);
      bot.lookTimer = randRange(0.8, 2.6);
    }
    if (repairNearbyUngeneratedLava(state, bot)) {
      bot.goal = { type: 'inspect_repaired_chunk', target: { x: bot.x, z: bot.z }, stage: 0 };
      bot.thinkTimer = Math.min(bot.thinkTimer, 0.25);
    }
    if (!bot.goal || bot.thinkTimer <= 0) {
      if (!bot.goal || (!isWorkGoal(bot.goal) && Math.random() < 0.35 + bot.restlessness * 0.25)) bot.goal = chooseGoal(state, bot);
      bot.thinkTimer = randRange(THINK_MIN, THINK_MAX);
    }
    if (bot.actionTimer <= 0) {
      const creative = state.worldMeta && state.worldMeta.mode === 'creative';
      const burst = creative ? 4 : 2;
      for (let i = 0; i < burst; i += 1) {
        const done = updateGoal(state, bot, dt);
        if (done) {
          bot.goal = chooseGoal(state, bot);
          break;
        }
        if (bot.goal && (bot.goal.type === 'explore' || bot.goal.type === 'wander' || bot.goal.type === 'patrol_mobs')) break;
      }
      bot.actionTimer = creative ? randRange(0.04, 0.12) : randRange(0.08, 0.22);
    }
    if (state.worldMeta && state.worldMeta.mode === 'creative') applyCreativeFlight(state, bot, dt);
    else applyPhysics(state, bot, dt);
  }

  function updateBots3D(state, dt) {
    let bots = state && state.entities && Array.isArray(state.entities.bots) ? state.entities.bots : [];
    const botsEnabled = !!(state && state.worldMeta && state.worldMeta.botsEnabled);
    if (!state || (!botsEnabled && !bots.length)) return;
    if (botsEnabled) {
      ensureCompanionBots3D(state);
      updateBotConnections(state, dt);
    }
    bots = state.entities && Array.isArray(state.entities.bots) ? state.entities.bots : [];
    for (const bot of bots) {
      if (Game.constants3d.isActiveSimulationPosition3D(state, bot.x, bot.z)) updateBot(state, bot, dt);
    }
  }

  Game.bots3d = {
    updateBots3D,
    ensureCompanionBots3D,
    spawnBot3D,
    damageBot3D,
    BOT_BLUEPRINTS,
    BUILD_VARIANTS,
    MAX_CONNECTED_BOTS,
  };
})();
