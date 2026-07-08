(() => {
  const Game = window.CubDep;
  const { BLOCK } = Game.blocks;
  const { getBlock3D, setBlock3D, getFluidLevel3D, setWater3D, setLava3D, setHotWater3D, isFluidSource3D, inBounds3D, isSolidBlock3D } = Game.world3d;
  const STATIC_WATER_LEVEL = Game.world3d.STATIC_WATER_LEVEL;

  const MAX_FLUID_LEVEL = 4;
  const HOT_WATER_MAX_FLUID_LEVEL = 7;
  const GEYSER_MIN_HEIGHT = 1;
  const GEYSER_MAX_HEIGHT = 7;
  const TICK_INTERVAL = 0.14;
  const MAX_TICKS_PER_FRAME = 1;
  const SOURCE_SCAN_RADIUS = 44;
  const SOURCE_SCAN_MARGIN = 10;
  const ACTIVE_FLUID_TICK_LIMIT = 900;
  const SIDE_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const ACTIVE_DIRS = [[0, 0, 0], [0, -1, 0], [0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];

  function setFluid(state, fluidId, x, y, z, level, source) {
    if (fluidId === BLOCK.LAVA) return setLava3D(state, x, y, z, level, source);
    if (fluidId === BLOCK.HOT_WATER) return setHotWater3D(state, x, y, z, level, source);
    return setWater3D(state, x, y, z, level, source);
  }

  function isWaterFluid(fluidId) {
    return fluidId === BLOCK.WATER || fluidId === BLOCK.HOT_WATER;
  }

  function maxLevelForFluid(fluidId) {
    return fluidId === BLOCK.HOT_WATER ? HOT_WATER_MAX_FLUID_LEVEL : MAX_FLUID_LEVEL;
  }

  function canFluidReplace(state, fluidId, x, y, z) {
    const id = getBlock3D(state, x, y, z);
    if (fluidId === BLOCK.HOT_WATER) return id === BLOCK.AIR || id === BLOCK.WATER || id === BLOCK.HOT_WATER;
    if (fluidId === BLOCK.WATER) return id === BLOCK.AIR || id === BLOCK.WATER;
    return id === BLOCK.AIR || id === fluidId;
  }

  function isSupportForFluid(state, x, y, z) {
    const id = getBlock3D(state, x, y, z);
    return id !== BLOCK.AIR && id !== BLOCK.WATER && id !== BLOCK.HOT_WATER && id !== BLOCK.LAVA;
  }

  function isActiveGeyser3D(state, x, y, z) {
    const world = state && state.world;
    if (!world || !inBounds3D(world, x, y, z) || !inBounds3D(world, x, y - 2, z)) return false;
    const middle = getBlock3D(state, x, y - 1, z);
    return isSolidBlock3D(middle) && getBlock3D(state, x, y - 2, z) === BLOCK.LAVA;
  }

  function ensureFluidState(state) {
    if (!state.fluids3d) state.fluids3d = { accumulator: 0, geysers: new Map() };
    if (!state.fluids3d.geysers) state.fluids3d.geysers = new Map();
    if (!state.fluids3d.active) state.fluids3d.active = new Set();
    return state.fluids3d;
  }

  function geyserKey(x, y, z) {
    return `${x},${y},${z}`;
  }

  function countHotWaterNearGeyser(state, x, y, z) {
    let count = 0;
    const radius = HOT_WATER_MAX_FLUID_LEVEL;
    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.abs(dx) + Math.abs(dz) > radius) continue;
        const nx = x + dx;
        const nz = z + dz;
        if (!inBounds3D(state.world, nx, y, nz)) continue;
        if (getBlock3D(state, nx, y, nz) === BLOCK.HOT_WATER) count += 1;
      }
    }
    return Math.max(1, count);
  }

  function getMaxHotWaterCount() {
    const radius = HOT_WATER_MAX_FLUID_LEVEL;
    return 1 + radius * (radius + 1) * 2;
  }

  function geyserHeightForHotWaterCount(count) {
    const maxCount = getMaxHotWaterCount();
    const ratio = Math.max(0, Math.min(1, (count - 1) / Math.max(1, maxCount - 1)));
    return GEYSER_MAX_HEIGHT - (GEYSER_MAX_HEIGHT - GEYSER_MIN_HEIGHT) * ratio;
  }

  function rebuildGeyserCache(state, bounds) {
    const fluids = ensureFluidState(state);
    fluids.geysers.clear();
    const world = state && state.world;
    if (!world || !bounds) return;
    const minY = Math.max(2, bounds.minY);
    for (let y = minY; y <= bounds.maxY; y += 1) {
      for (let z = bounds.minZ; z <= bounds.maxZ; z += 1) {
        for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
          if (getBlock3D(state, x, y, z) !== BLOCK.HOT_WATER) continue;
          if (!isFluidSource3D(state, x, y, z, BLOCK.HOT_WATER)) continue;
          if (!isActiveGeyser3D(state, x, y, z)) continue;
          const hotWaterCount = countHotWaterNearGeyser(state, x, y, z);
          const height = geyserHeightForHotWaterCount(hotWaterCount);
          fluids.geysers.set(geyserKey(x, y, z), { x, y, z, height, hotWaterCount });
        }
      }
    }
  }

  function getGeyserInfo3D(state, x, y, z) {
    const fluids = ensureFluidState(state);
    return fluids.geysers.get(geyserKey(x, y, z)) || null;
  }

  function getActiveGeysers3D(state) {
    const fluids = ensureFluidState(state);
    return Array.from(fluids.geysers.values());
  }

  function parseSourceKey(key) {
    const parts = String(key).split(',').map(Number);
    if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;
    return { x: parts[0], y: parts[1], z: parts[2] };
  }

  function addActiveFluidCell(state, x, y, z) {
    const world = state && state.world;
    if (!world || !inBounds3D(world, x, y, z)) return;
    ensureFluidState(state).active.add(geyserKey(x, y, z));
  }

  function addActiveFluidNeighbors(state, x, y, z, target = null) {
    const set = target || ensureFluidState(state).active;
    const world = state && state.world;
    if (!world) return;
    for (const [dx, dy, dz] of ACTIVE_DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      const nz = z + dz;
      if (inBounds3D(world, nx, ny, nz)) set.add(geyserKey(nx, ny, nz));
    }
  }

  function cleanupDisconnectedFluidFrom(state, x, y, z) {
    const world = state && state.world;
    if (!world || !inBounds3D(world, x, y, z)) return;
    const fluidId = getBlock3D(state, x, y, z);
    if (!isWaterFluid(fluidId) && fluidId !== BLOCK.LAVA) return;
    const startLevel = getFluidLevel3D(state, x, y, z, fluidId);
    if (fluidId === BLOCK.WATER && startLevel === STATIC_WATER_LEVEL) return;

    function isStableSource(cx, cy, cz) {
      if (!isFluidSource3D(state, cx, cy, cz, fluidId)) return false;
      return getBlock3D(state, cx, cy + 1, cz) !== fluidId;
    }

    const queue = [{ x, y, z }];
    const seen = new Set([geyserKey(x, y, z)]);
    const cells = [];
    let supported = false;
    const limit = 1800;

    for (let index = 0; index < queue.length && index < limit; index += 1) {
      const current = queue[index];
      const level = getFluidLevel3D(state, current.x, current.y, current.z, fluidId);
      if (fluidId === BLOCK.WATER && level === STATIC_WATER_LEVEL) {
        supported = true;
        continue;
      }
      if (isStableSource(current.x, current.y, current.z)) supported = true;
      cells.push(current);
      for (const [dx, dy, dz] of ACTIVE_DIRS) {
        if (dx === 0 && dy === 0 && dz === 0) continue;
        const nx = current.x + dx;
        const ny = current.y + dy;
        const nz = current.z + dz;
        if (!inBounds3D(world, nx, ny, nz)) continue;
        if (getBlock3D(state, nx, ny, nz) !== fluidId) continue;
        const key = geyserKey(nx, ny, nz);
        if (seen.has(key)) continue;
        seen.add(key);
        queue.push({ x: nx, y: ny, z: nz });
      }
    }

    if (supported || queue.length >= limit) return;
    for (const cell of cells) {
      removeFluid(state, fluidId, cell.x, cell.y, cell.z);
    }
  }

  function cleanupDisconnectedFluidsNear(state, x, y, z) {
    const world = state && state.world;
    if (!world) return;
    for (const [dx, dy, dz] of ACTIVE_DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      const nz = z + dz;
      if (!inBounds3D(world, nx, ny, nz)) continue;
      cleanupDisconnectedFluidFrom(state, nx, ny, nz);
    }
  }

  function seedActiveFluidCellsNearPlayer(state, px, pz) {
    const world = state.world;
    const radiusSq = SOURCE_SCAN_RADIUS * SOURCE_SCAN_RADIUS;
    const active = ensureFluidState(state).active;

    function includeSource(pos, expected) {
      if (!pos || !inBounds3D(world, pos.x, pos.y, pos.z)) return;
      const dx = pos.x - px;
      const dz = pos.z - pz;
      if (dx * dx + dz * dz > radiusSq) return;
      const id = getBlock3D(state, pos.x, pos.y, pos.z);
      if (expected === BLOCK.LAVA) {
        if (id !== BLOCK.LAVA) return;
      } else if (!isWaterFluid(id)) {
        return;
      }
      for (let dz = -SOURCE_SCAN_MARGIN; dz <= SOURCE_SCAN_MARGIN; dz += 1) {
        for (let dx = -SOURCE_SCAN_MARGIN; dx <= SOURCE_SCAN_MARGIN; dx += 1) {
          if (Math.abs(dx) + Math.abs(dz) > SOURCE_SCAN_MARGIN) continue;
          addActiveFluidNeighbors(state, pos.x + dx, pos.y, pos.z + dz, active);
        }
      }
    }

    const waterSources = world && world.waterSources ? world.waterSources : null;
    const lavaSources = world && world.lavaSources ? world.lavaSources : null;
    if (waterSources) {
      for (const key of waterSources) includeSource(parseSourceKey(key), BLOCK.WATER);
    }
    if (lavaSources) {
      for (const key of lavaSources) includeSource(parseSourceKey(key), BLOCK.LAVA);
    }
  }

  function removeFluid(state, fluidId, x, y, z) {
    if (getBlock3D(state, x, y, z) !== fluidId) return false;
    const changed = setBlock3D(state, x, y, z, BLOCK.AIR);
    if (changed) addActiveFluidNeighbors(state, x, y, z);
    return changed;
  }

  function coolHotWater(state, x, y, z, source) {
    const level = getFluidLevel3D(state, x, y, z, BLOCK.HOT_WATER);
    const nextLevel = level === 255 ? 0 : level;
    const changed = setWater3D(state, x, y, z, nextLevel, source);
    if (changed) addActiveFluidNeighbors(state, x, y, z);
    return changed;
  }

  function getBestHorizontalLevel(state, fluidId, x, y, z) {
    let best = 255;
    for (const [dx, dz] of SIDE_DIRS) {
      const nx = x + dx;
      const nz = z + dz;
      if (!inBounds3D(state.world, nx, y, nz)) continue;
      if (getBlock3D(state, nx, y, nz) !== fluidId) continue;
      best = Math.min(best, getFluidLevel3D(state, nx, y, nz, fluidId));
    }
    return best;
  }

  function hasVerticalFluidSupport(state, fluidId, x, y, z, maxLevel) {
    const aboveY = y + 1;
    if (!inBounds3D(state.world, x, aboveY, z)) return false;
    if (getBlock3D(state, x, aboveY, z) !== fluidId) return false;
    if (isFluidSource3D(state, x, aboveY, z, fluidId)) return true;
    const aboveLevel = getFluidLevel3D(state, x, aboveY, z, fluidId);
    if (aboveLevel === STATIC_WATER_LEVEL) return false;
    const aboveBest = getBestHorizontalLevel(state, fluidId, x, aboveY, z);
    return aboveBest + 1 <= maxLevel;
  }

  function stepFluidCell(state, fluidId, x, y, z, moves) {
    if (getBlock3D(state, x, y, z) !== fluidId) return;
    const source = isFluidSource3D(state, x, y, z, fluidId);
    const level = getFluidLevel3D(state, x, y, z, fluidId);
    if (fluidId === BLOCK.WATER && level === STATIC_WATER_LEVEL) return;
    const maxLevel = maxLevelForFluid(fluidId);
    const belowY = y - 1;

    if (fluidId === BLOCK.WATER && isActiveGeyser3D(state, x, y, z)) {
      moves.push({ type: 'fluid', fluidId: BLOCK.HOT_WATER, x, y, z, level: 0, source: true });
      return;
    }

    if (fluidId === BLOCK.HOT_WATER && source && !isActiveGeyser3D(state, x, y, z)) {
      moves.push({ type: 'cool', x, y, z, source: true });
      return;
    }

    if (inBounds3D(state.world, x, belowY, z) && canFluidReplace(state, fluidId, x, belowY, z)) {
      const belowLevel = getFluidLevel3D(state, x, belowY, z, fluidId);
      if (belowLevel > 0) moves.push({ type: 'fluid', fluidId, x, y: belowY, z, level: 0, source: false });
    }

    if (!source) {
      const aboveFluid = hasVerticalFluidSupport(state, fluidId, x, y, z, maxLevel);
      const best = getBestHorizontalLevel(state, fluidId, x, y, z);
      const supportedLevel = aboveFluid ? 0 : best + 1;
      if (supportedLevel > maxLevel) {
        moves.push(fluidId === BLOCK.HOT_WATER ? { type: 'cool', x, y, z, source: false } : { type: 'air', fluidId, x, y, z });
        return;
      }
      if (supportedLevel !== level) moves.push({ type: 'fluid', fluidId, x, y, z, level: supportedLevel, source: false });
    }

    const nextLevel = source ? 1 : level + 1;
    if (nextLevel > maxLevel) return;
    if (!isSupportForFluid(state, x, y - 1, z)) return;
    const dirs = ((x + y + z) & 1) ? SIDE_DIRS : [SIDE_DIRS[2], SIDE_DIRS[3], SIDE_DIRS[0], SIDE_DIRS[1]];
    for (const [dx, dz] of dirs) {
      const nx = x + dx;
      const nz = z + dz;
      if (!inBounds3D(state.world, nx, y, nz)) continue;
      if (!canFluidReplace(state, fluidId, nx, y, nz)) continue;
      const sideLevel = getFluidLevel3D(state, nx, y, nz, fluidId);
      if (sideLevel <= nextLevel) continue;
      moves.push({ type: 'fluid', fluidId, x: nx, y, z: nz, level: nextLevel, source: false });
    }
  }

  function tickFluids(state) {
    const fluids = ensureFluidState(state);
    const moves = [];
    const px = Math.floor(state.player.x);
    const pz = Math.floor(state.player.z);
    if (!fluids.active.size) seedActiveFluidCellsNearPlayer(state, px, pz);
    if (!fluids.active.size) {
      fluids.geysers.clear();
      return;
    }
    const allActiveKeys = Array.from(fluids.active);
    const activeKeys = allActiveKeys.slice(0, ACTIVE_FLUID_TICK_LIMIT);
    fluids.active.clear();
    let bounds = null;
    for (const key of activeKeys) {
      const pos = parseSourceKey(key);
      if (!pos || !inBounds3D(state.world, pos.x, pos.y, pos.z)) continue;
      const id = getBlock3D(state, pos.x, pos.y, pos.z);
      if (isWaterFluid(id) || id === BLOCK.LAVA) stepFluidCell(state, id, pos.x, pos.y, pos.z, moves);
      if (!bounds) bounds = { minX: pos.x, maxX: pos.x, minY: pos.y, maxY: pos.y, minZ: pos.z, maxZ: pos.z };
      else {
        bounds.minX = Math.min(bounds.minX, pos.x);
        bounds.maxX = Math.max(bounds.maxX, pos.x);
        bounds.minY = Math.min(bounds.minY, pos.y);
        bounds.maxY = Math.max(bounds.maxY, pos.y);
        bounds.minZ = Math.min(bounds.minZ, pos.z);
        bounds.maxZ = Math.max(bounds.maxZ, pos.z);
      }
    }

    for (const move of moves) {
      if (move.type === 'air') {
        if (!isFluidSource3D(state, move.x, move.y, move.z, move.fluidId)) removeFluid(state, move.fluidId, move.x, move.y, move.z);
      } else if (move.type === 'cool') {
        coolHotWater(state, move.x, move.y, move.z, move.source);
      } else {
        if (setFluid(state, move.fluidId, move.x, move.y, move.z, move.level, move.source)) {
          addActiveFluidNeighbors(state, move.x, move.y, move.z);
        }
      }
    }

    if (allActiveKeys.length > ACTIVE_FLUID_TICK_LIMIT) {
      for (let i = ACTIVE_FLUID_TICK_LIMIT; i < allActiveKeys.length; i += 1) fluids.active.add(allActiveKeys[i]);
    }
    if (bounds) {
      bounds.minX = Math.max(0, bounds.minX - 2);
      bounds.maxX = Math.min(state.world.w - 1, bounds.maxX + 2);
      bounds.minY = Math.max(0, bounds.minY - 2);
      bounds.maxY = Math.min(state.world.h - 1, bounds.maxY + 2);
      bounds.minZ = Math.max(0, bounds.minZ - 2);
      bounds.maxZ = Math.min(state.world.d - 1, bounds.maxZ + 2);
      rebuildGeyserCache(state, bounds);
    }
  }

  function updateFluids3D(state, dt) {
    const fluids = ensureFluidState(state);
    fluids.accumulator += dt;
    let ticks = 0;
    while (fluids.accumulator >= TICK_INTERVAL && ticks < MAX_TICKS_PER_FRAME) {
      fluids.accumulator -= TICK_INTERVAL;
      tickFluids(state);
      ticks += 1;
    }
    if (fluids.accumulator >= TICK_INTERVAL) fluids.accumulator = TICK_INTERVAL * 0.5;
  }

  function addWaterSource3D(state, x, y, z) {
    const changed = setWater3D(state, x, y, z, 0, true);
    addActiveFluidNeighbors(state, x, y, z);
    return changed;
  }

  function addLavaSource3D(state, x, y, z) {
    const changed = setLava3D(state, x, y, z, 0, true);
    addActiveFluidNeighbors(state, x, y, z);
    return changed;
  }

  function activateFluidAround3D(state, x, y, z) {
    addActiveFluidNeighbors(state, x, y, z);
    cleanupDisconnectedFluidsNear(state, x, y, z);
  }

  Game.fluids3d = {
    addWaterSource3D,
    addLavaSource3D,
    activateFluidAround3D,
    updateFluids3D,
    isActiveGeyser3D,
    getGeyserInfo3D,
    getActiveGeysers3D,
    geyserHeightForHotWaterCount,
  };
})();
