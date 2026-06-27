(() => {
  const Game = window.CubDep;
  const { BLOCK, BREAK_TIME } = Game.blocks;
  const { EYE_HEIGHT, PLAYER_HEIGHT, PLAYER_RADIUS, REACH_DISTANCE } = Game.constants3d;
  const { getBlock3D, setBlock3D, inBounds3D, isSolidBlock3D } = Game.world3d;

  const ITEM = {
    SHEEP_SPAWN_EGG: -1,
    BOAR_SPAWN_EGG: -2,
    TURTLE_SPAWN_EGG: -3,
    SNAKE_SPAWN_EGG: -4,
    GOAT_SPAWN_EGG: -5,
    FISH_SPAWN_EGG: -6,
  };

  const SPAWN_EGG_TYPES = {
    [ITEM.SHEEP_SPAWN_EGG]: 'sheep',
    [ITEM.BOAR_SPAWN_EGG]: 'boar',
    [ITEM.TURTLE_SPAWN_EGG]: 'turtle',
    [ITEM.SNAKE_SPAWN_EGG]: 'snake',
    [ITEM.GOAT_SPAWN_EGG]: 'goat',
    [ITEM.FISH_SPAWN_EGG]: 'fish',
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
  ];

  const CREATIVE_ITEMS = [
    ...DEFAULT_HOTBAR_ITEMS,
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
    ITEM.BOAR_SPAWN_EGG,
    ITEM.TURTLE_SPAWN_EGG,
    ITEM.SNAKE_SPAWN_EGG,
    ITEM.GOAT_SPAWN_EGG,
    ITEM.FISH_SPAWN_EGG,
  ];
  const HOTBAR_BLOCKS = DEFAULT_HOTBAR_ITEMS;

  const BLOCK_LABELS = {
    [BLOCK.DIRT]: 'Земля',
    [BLOCK.STONE]: 'Камень',
    [BLOCK.WOOD]: 'Дерево',
    [BLOCK.LEAF]: 'Листья',
    [BLOCK.PLANK]: 'Доски',
    [BLOCK.WATER]: 'Вода',
    [BLOCK.HOT_WATER]: 'Горячая вода',
    [BLOCK.LAVA]: 'Лава',
    [BLOCK.SAND]: 'Песок',
    [ITEM.SHEEP_SPAWN_EGG]: 'Яйцо призыва овцы',
    [ITEM.BOAR_SPAWN_EGG]: 'Яйцо призыва кабана',
    [ITEM.TURTLE_SPAWN_EGG]: 'Яйцо призыва черепахи',
    [ITEM.SNAKE_SPAWN_EGG]: 'Яйцо призыва змеи',
    [ITEM.GOAT_SPAWN_EGG]: 'Яйцо призыва горного козла',
    [ITEM.FISH_SPAWN_EGG]: 'Яйцо призыва рыбы',
    [BLOCK.TORCH]: 'Факел',
    [BLOCK.FURNACE]: 'Печь',
    [BLOCK.DYNAMITE_SMALL]: 'ТНТ мощность 1',
    [BLOCK.DYNAMITE_MEDIUM]: 'ТНТ мощность 5',
    [BLOCK.DYNAMITE_LARGE]: 'ТНТ мощность 10',
    [BLOCK.DYNAMITE_HUGE]: 'ТНТ мощность 25',
    [BLOCK.DYNAMITE_MEGA_HUGE]: 'ТНТ мощность 50',
    [BLOCK.DYNAMITE_POWER_75]: 'ТНТ мощность 75',
    [BLOCK.DYNAMITE_POWER_100]: 'ТНТ мощность 100',
    [BLOCK.TNT_REMOTE]: 'Пульт от ТНТ',
    [BLOCK.STRANGE_PORTAL_STONE]: 'Камень странного портала',
    [BLOCK.STRANGE_PORTAL_CORE]: 'Сломанное ядро портала',
    [BLOCK.STRANGE_PORTAL_RUNE]: 'Руна странного портала',
    [BLOCK.ACTIVE_STRANGE_PORTAL]: 'Активный странный портал',
  };

  const DYNAMITE_CONFIG = {
    [BLOCK.DYNAMITE_SMALL]: { radius: 1, fuse: 2 },
    [BLOCK.DYNAMITE_MEDIUM]: { radius: 5, fuse: 3 },
    [BLOCK.DYNAMITE_LARGE]: { radius: 10, fuse: 4 },
    [BLOCK.DYNAMITE_HUGE]: { radius: 25, fuse: 5, chunked: true },
    [BLOCK.DYNAMITE_MEGA_HUGE]: { radius: 50, fuse: 6, chunked: true },
    [BLOCK.DYNAMITE_POWER_75]: { radius: 75, fuse: 7, chunked: true },
    [BLOCK.DYNAMITE_POWER_100]: { radius: 100, fuse: 8, chunked: true },
  };
  const CHUNKED_EXPLOSION_CHECK_BUDGET = 18000;
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

  function raycastBlock(state, includePreviewFluids = false) {
    const player = state.player;
    const dir = getLookDirection(player);
    const origin = {
      x: player.x,
      y: player.y + EYE_HEIGHT,
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
      if (isSolidBlock3D(id) || (includePreviewFluids && isPreviewFluid(id))) {
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
    const dir = getLookDirection(player);
    const origin = {
      x: player.x,
      y: player.y + EYE_HEIGHT,
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

  function blockOverlapsPlayer(state, x, y, z) {
    const player = state.player;
    const minX = player.x - PLAYER_RADIUS;
    const maxX = player.x + PLAYER_RADIUS;
    const minY = player.y;
    const maxY = player.y + PLAYER_HEIGHT;
    const minZ = player.z - PLAYER_RADIUS;
    const maxZ = player.z + PLAYER_RADIUS;
    return x < maxX && x + 1 > minX && y < maxY && y + 1 > minY && z < maxZ && z + 1 > minZ;
  }

  function setNotice(state, text) {
    state.ui.noticeText = text;
    state.ui.noticeTimer = 1.35;
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

  function isPreviewFluid(id) {
    return id === BLOCK.WATER || id === BLOCK.HOT_WATER || id === BLOCK.LAVA;
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
    return id !== BLOCK.AIR && id !== BLOCK.WATER && id !== BLOCK.HOT_WATER && id !== BLOCK.LAVA;
  }

  function ensureActiveDynamite(state) {
    if (!state.world.activeDynamite) state.world.activeDynamite = [];
    return state.world.activeDynamite;
  }

  function ensureActiveExplosions(state) {
    if (!state.world.activeExplosions) state.world.activeExplosions = [];
    return state.world.activeExplosions;
  }

  function activateDynamite(state, x, y, z, id) {
    const config = DYNAMITE_CONFIG[id];
    if (!config) return false;
    const list = ensureActiveDynamite(state);
    const key = coordKey(x, y, z);
    if (list.some((item) => item.key === key)) {
      setNotice(state, 'Динамит уже активирован');
      return true;
    }
    list.push({ key, x, y, z, id, radius: config.radius, fuse: config.fuse, timer: config.fuse, chunked: !!config.chunked });
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

  function buildFluidPreview(state, hit) {
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
    if (isDynamiteBlock(hit.id)) {
      state.ui.preview = {
        type: 'tnt',
        x: hit.x,
        y: hit.y,
        z: hit.z,
        radius: DYNAMITE_CONFIG[hit.id].radius,
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
      && id !== BLOCK.LAVA;
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

  function beginChunkedExplosion(state, item) {
    const world = state.world;
    const chunks = [];
    for (const [key, chunk] of world.chunks || []) {
      if (!chunk || !chunk.blocks || !chunkIntersectsSphere(world, chunk, item)) continue;
      chunks.push(key);
    }
    if (Game.inventory3d && Game.inventory3d.addMinedItem) Game.inventory3d.addMinedItem(state, item.id, 1);
    setBlock3D(state, item.x, item.y, item.z, BLOCK.AIR);
    ensureActiveExplosions(state).push({
      x: item.x,
      y: item.y,
      z: item.z,
      radius: item.radius,
      radiusSq: item.radius * item.radius,
      chunks,
      chunkIndex: 0,
      blockIndex: 0,
      broken: 0,
    });
    setNotice(state, `Взрыв начался: чанков ${chunks.length}`);
    if (Game.audio && Game.audio.playHit) Game.audio.playHit();
  }

  function explodeDynamite(state, item) {
    if (item.chunked) {
      beginChunkedExplosion(state, item);
      return;
    }
    const world = state.world;
    const radius = Math.max(1, item.radius | 0);
    const radiusSq = radius * radius;
    let broken = 0;
    const destroyedActiveKeys = new Set();
    for (let y = Math.max(1, item.y - radius); y <= Math.min(world.h - 1, item.y + radius); y += 1) {
      for (let z = Math.max(0, item.z - radius); z <= Math.min(world.d - 1, item.z + radius); z += 1) {
        for (let x = Math.max(0, item.x - radius); x <= Math.min(world.w - 1, item.x + radius); x += 1) {
          const dx = x - item.x;
          const dy = y - item.y;
          const dz = z - item.z;
          if (dx * dx + dy * dy + dz * dz > radiusSq) continue;
          const id = getBlock3D(state, x, y, z);
          if (!canExplodeBlock(id)) continue;
          if (Game.inventory3d && Game.inventory3d.addMinedItem) Game.inventory3d.addMinedItem(state, id, 1);
          if (setBlock3D(state, x, y, z, BLOCK.AIR)) {
            broken += 1;
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

  function updateDynamite3D(state, dt) {
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

  function processChunkedExplosions(state) {
    const world = state && state.world;
    const active = world && world.activeExplosions;
    if (!active || !active.length) return;
    const next = [];
    for (const explosion of active) {
      let checks = 0;
      while (explosion.chunkIndex < explosion.chunks.length && checks < CHUNKED_EXPLOSION_CHECK_BUDGET) {
        const key = explosion.chunks[explosion.chunkIndex];
        const chunk = world.chunks && world.chunks.get(key);
        if (!chunk || !chunk.blocks) {
          explosion.chunkIndex += 1;
          explosion.blockIndex = 0;
          continue;
        }
        const bounds = chunkBounds(world, chunk);
        const maxIndex = chunk.blocks.length;
        while (explosion.blockIndex < maxIndex && checks < CHUNKED_EXPLOSION_CHECK_BUDGET) {
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
          if (!canExplodeBlock(id)) continue;
          if (Game.inventory3d && Game.inventory3d.addMinedItem) Game.inventory3d.addMinedItem(state, id, 1);
          if (setBlock3D(state, x, y, z, BLOCK.AIR)) explosion.broken += 1;
        }
        if (explosion.blockIndex >= maxIndex) {
          explosion.chunkIndex += 1;
          explosion.blockIndex = 0;
        }
      }
      if (explosion.chunkIndex < explosion.chunks.length) next.push(explosion);
      else setNotice(state, `Взрыв: разрушено ${explosion.broken}`);
    }
    world.activeExplosions = next;
  }

  function getBreakDuration(blockId) {
    const base = BREAK_TIME && BREAK_TIME[blockId];
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

  function finishBreakingBlock(state, hit) {
    if (!hit) return;
    if (hit.id === BLOCK.BEDROCK) {
      setNotice(state, 'Бедрок нельзя добыть');
      return;
    }
    const dropId = hit.id;
    if (Game.inventory3d && Game.inventory3d.addMinedItem) {
      const result = Game.inventory3d.addMinedItem(state, dropId, 1);
      if (result.remaining > 0) {
        if (state.world.blockDamage) delete state.world.blockDamage[targetKey(hit)];
        setNotice(state, 'Инвентарь полон');
        return;
      }
    }
    if (setBlock3D(state, hit.x, hit.y, hit.z, BLOCK.AIR)) {
      if (state.world.blockDamage) delete state.world.blockDamage[targetKey(hit)];
      syncNearbyStrangePortals(state, hit.x, hit.y, hit.z);
      setNotice(state, `Добыто: ${BLOCK_LABELS[dropId] || 'Блок'}`);
      if (Game.audio && Game.audio.playDig) Game.audio.playDig();
    }
  }

  function updateMining(state, input, hit, dt) {
    if (!input.primaryDown) {
      state.ui.mineTarget = null;
      state.ui.mineSoundTimer = 0;
      return;
    }
    if (!hit) {
      resetMining(state);
      return;
    }
    if (hit.id === BLOCK.BEDROCK) {
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

    const duration = getBreakDuration(hit.id);
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

  function placeSelectedBlock(state) {
    const hit = raycastBlock(state);
    if (!hit || !hit.place) return;
    const stack = Game.inventory3d && Game.inventory3d.getSelectedHotbarStack
      ? Game.inventory3d.getSelectedHotbarStack(state)
      : null;
    const blockId = stack ? stack.id : BLOCK.AIR;
    if (isDynamiteBlock(hit.id) && blockId === BLOCK.TNT_REMOTE && bindTntRemoteTarget(state, hit)) return;
    if (hit.id === BLOCK.TNT_REMOTE && activateTntRemoteTarget(state)) return;
    if (isDynamiteBlock(hit.id) && activateDynamite(state, hit.x, hit.y, hit.z, hit.id)) return;
    if (!Number.isFinite(blockId) || blockId === BLOCK.AIR) return;
    const { x, y, z } = hit.place;
    if (!inBounds3D(state.world, x, y, z)) return;
    const survival = !state.worldMeta || state.worldMeta.mode !== 'creative';
    const mobType = SPAWN_EGG_TYPES[blockId];
    if (mobType) {
      if (Game.entities3d && Game.entities3d.spawnMob3D && Game.entities3d.spawnMob3D(state, mobType, x, y, z)) {
        if (survival && Game.inventory3d) Game.inventory3d.consumeSelectedHotbarItem(state, 1);
        setNotice(state, `Призван моб: ${MOB_LABELS[mobType] || 'Моб'}`);
      }
      return;
    }
    const targetId = getBlock3D(state, x, y, z);
    if (targetId !== BLOCK.AIR && targetId !== BLOCK.WATER && targetId !== BLOCK.HOT_WATER && targetId !== BLOCK.LAVA) return;
    if (blockOverlapsPlayer(state, x, y, z)) {
      setNotice(state, 'Нельзя поставить блок внутри себя');
      return;
    }
    if (setBlock3D(state, x, y, z, blockId)) {
      if (survival && Game.inventory3d) Game.inventory3d.consumeSelectedHotbarItem(state, 1);
      syncNearbyStrangePortals(state, x, y, z);
      setNotice(state, `Поставлено: ${BLOCK_LABELS[blockId] || 'Блок'}`);
    }
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
    const attackedSheep = actions.breakPressed && attackTargetSheep(state, hit);
    if (attackedSheep) input.primaryDown = false;
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
    if (!attackedSheep) updateMining(state, input, hit, dt);
    if (actions.repairPressed) repairTargetBlock(state, hit);
    if (actions.previewPressed) togglePreview(state, previewHit);
    if (actions.placePressed) placeSelectedBlock(state);
  }

  const MOB_LABELS = {
    sheep: 'Овца',
    boar: 'Кабан',
    turtle: 'Черепаха',
    snake: 'Змея',
    goat: 'Горный козел',
    fish: 'Рыба',
  };

  Game.interaction3d = {
    updateInteraction3D,
    HOTBAR_BLOCKS,
    DEFAULT_HOTBAR_ITEMS,
    CREATIVE_ITEMS,
    BLOCK_LABELS,
    ITEM,
    SPAWN_EGG_TYPES,
    MOB_LABELS,
    DYNAMITE_CONFIG,
    isDynamiteBlock,
    updateDynamite3D,
  };
})();
