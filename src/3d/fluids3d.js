(() => {
  const Game = window.CubDep;
  const { BLOCK } = Game.blocks;
  const { getBlock3D, setBlock3D, getFluidLevel3D, setWater3D, setLava3D, setVolcanicLava3D, setHotWater3D, isFluidSource3D, isBlockChunkLoaded3D, inBounds3D, isSolidBlock3D } = Game.world3d;
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
    if (!isFluidCellLoaded(state, x, y, z)) return false;
    if (fluidId === BLOCK.LAVA) return setLava3D(state, x, y, z, level, source);
    if (fluidId === BLOCK.VOLCANIC_LAVA) return setVolcanicLava3D(state, x, y, z, level, source);
    if (fluidId === BLOCK.HOT_WATER) return setHotWater3D(state, x, y, z, level, source);
    return setWater3D(state, x, y, z, level, source);
  }

  function isFluidCellLoaded(state, x, y, z) {
    return !!(state && state.world && inBounds3D(state.world, x, y, z) && isBlockChunkLoaded3D(state.world, x, y, z));
  }

  function isWaterFluid(fluidId) {
    return fluidId === BLOCK.WATER || fluidId === BLOCK.HOT_WATER;
  }

  function maxLevelForFluid(fluidId) {
    return fluidId === BLOCK.HOT_WATER ? HOT_WATER_MAX_FLUID_LEVEL : MAX_FLUID_LEVEL;
  }

  function canFluidReplace(state, fluidId, x, y, z) {
    if (!isFluidCellLoaded(state, x, y, z)) return false;
    const id = getBlock3D(state, x, y, z);
    if (fluidId === BLOCK.HOT_WATER) return id === BLOCK.AIR || id === BLOCK.WATER || id === BLOCK.HOT_WATER;
    if (fluidId === BLOCK.WATER) return id === BLOCK.AIR || id === BLOCK.WATER;
    return id === BLOCK.AIR || id === fluidId;
  }

  function isSupportForFluid(state, x, y, z) {
    const id = getBlock3D(state, x, y, z);
    return id !== BLOCK.AIR && id !== BLOCK.WATER && id !== BLOCK.HOT_WATER && id !== BLOCK.LAVA && id !== BLOCK.VOLCANIC_LAVA;
  }

  function isActiveGeyser3D(state, x, y, z) {
    const world = state && state.world;
    if (!world || !inBounds3D(world, x, y, z) || !inBounds3D(world, x, y - 2, z)) return false;
    const middle = getBlock3D(state, x, y - 1, z);
    const heat = getBlock3D(state, x, y - 2, z);
    return isSolidBlock3D(middle) && (heat === BLOCK.LAVA || heat === BLOCK.VOLCANIC_LAVA);
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
    if (!isWaterFluid(fluidId) && fluidId !== BLOCK.LAVA && fluidId !== BLOCK.VOLCANIC_LAVA) return;
    if (!Game.constants3d.isActiveSimulationPosition3D(state, x, z)) return;
    if (state.worldMeta && state.worldMeta.superOptimization && isWaterFluid(fluidId)) return;
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
      if (fluidId === BLOCK.VOLCANIC_LAVA) {
        setBlock3D(state, cell.x, cell.y, cell.z, solidBlockForCooledLava(state, cell.x, cell.z));
        addActiveFluidNeighbors(state, cell.x, cell.y, cell.z);
      } else {
        removeFluid(state, fluidId, cell.x, cell.y, cell.z);
      }
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
        if (id !== BLOCK.LAVA && id !== BLOCK.VOLCANIC_LAVA) return;
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

  function volcanicLavaAgeMap(state) {
    if (!state.volcanoes) state.volcanoes = {};
    if (!state.volcanoes.lavaAges) state.volcanoes.lavaAges = new Map();
    return state.volcanoes.lavaAges;
  }

  function shouldCoolVolcanicLava(state, x, y, z, source) {
    const generation = Game.generation3d;
    if (generation && generation.isVolcanoVentCell3D && generation.isVolcanoVentCell3D(state, x, y, z)) return false;
    const wave = generation && generation.getVolcanicCoolingWave3D ? generation.getVolcanicCoolingWave3D(state, x, z) : null;
    if (wave) return true;
    const biome = Game.generation3d && Game.generation3d.getBiomeAt3D ? Game.generation3d.getBiomeAt3D(state, x, z) : 'plains';
    if (biome !== 'volcanic') return true;
    const key = geyserKey(x, y, z);
    const ages = volcanicLavaAgeMap(state);
    const age = (ages.get(key) || 0) + TICK_INTERVAL;
    ages.set(key, age);
    return age >= 30;
  }

  function isVolcanicBiomeCell(state, x, z) {
    const generation = Game.generation3d;
    const biome = generation && generation.getBiomeAt3D ? generation.getBiomeAt3D(state, x, z) : 'plains';
    return biome === 'volcanic';
  }

  function solidBlockForCooledLava(state, x, z) {
    return BLOCK.BLACKSTONE;
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
    const world = state && state.world;
    if (!world) return false;
    for (let aboveY = y + 1; aboveY < world.h; aboveY += 1) {
      if (!isFluidCellLoaded(state, x, aboveY, z)) return false;
      if (getBlock3D(state, x, aboveY, z) !== fluidId) return false;
      if (isFluidSource3D(state, x, aboveY, z, fluidId)) return true;
      const aboveLevel = getFluidLevel3D(state, x, aboveY, z, fluidId);
      if (fluidId === BLOCK.WATER && aboveLevel === STATIC_WATER_LEVEL) return true;
      const aboveBest = getBestHorizontalLevel(state, fluidId, x, aboveY, z);
      if (aboveBest + 1 <= maxLevel) return true;
    }
    return false;
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

    if (fluidId === BLOCK.HOT_WATER && source) {
      if (!isActiveGeyser3D(state, x, y, z)) moves.push({ type: 'cool', x, y, z, source: true });
      return;
    }

    if (fluidId === BLOCK.VOLCANIC_LAVA && shouldCoolVolcanicLava(state, x, y, z, source)) {
      moves.push({ type: 'solid', x, y, z, block: solidBlockForCooledLava(state, x, z) });
      return;
    }

    if (fluidId === BLOCK.LAVA && isVolcanicBiomeCell(state, x, z) && Game.generation3d && Game.generation3d.getVolcanicCoolingWave3D && Game.generation3d.getVolcanicCoolingWave3D(state, x, z)) {
      if (Game.generation3d.isVolcanoVentCell3D && Game.generation3d.isVolcanoVentCell3D(state, x, y, z)) return;
      moves.push({ type: 'solid', x, y, z, block: solidBlockForCooledLava(state, x, z) });
      return;
    }

    if (canFluidReplace(state, fluidId, x, belowY, z)) {
      const belowLevel = getFluidLevel3D(state, x, belowY, z, fluidId);
      if (belowLevel > 0) moves.push({ type: 'fluid', fluidId, x, y: belowY, z, level: 0, source: false });
    }

    if (!source) {
      const aboveFluid = hasVerticalFluidSupport(state, fluidId, x, y, z, maxLevel);
      const best = getBestHorizontalLevel(state, fluidId, x, y, z);
      const supportedLevel = aboveFluid ? 0 : best + 1;
      if (supportedLevel > maxLevel) {
        if (fluidId === BLOCK.VOLCANIC_LAVA) moves.push({ type: 'solid', x, y, z, block: solidBlockForCooledLava(state, x, z) });
        else moves.push(fluidId === BLOCK.HOT_WATER ? { type: 'cool', x, y, z, source: false } : { type: 'air', fluidId, x, y, z });
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
      if (!canFluidReplace(state, fluidId, nx, y, nz)) continue;
      const sideLevel = getFluidLevel3D(state, nx, y, nz, fluidId);
      if (sideLevel <= nextLevel) continue;
      moves.push({ type: 'fluid', fluidId, x: nx, y, z: nz, level: nextLevel, source: false });
    }
  }

  function tickFluids(state) {
    if (state.worldMeta && state.worldMeta.superOptimization) return;
    const fluids = ensureFluidState(state);
    const moves = [];
    const px = Math.floor(state.player.x);
    const pz = Math.floor(state.player.z);
    if (!fluids.active.size) seedActiveFluidCellsNearPlayer(state, px, pz);
    if (!fluids.active.size) {
      fluids.geysers.clear();
      return;
    }
    const queuedKeys = Array.from(fluids.active);
    fluids.active.clear();
    const allActiveKeys = queuedKeys.filter((key) => {
      if (!state.worldMeta || !state.worldMeta.superOptimization) return true;
      const pos = parseSourceKey(key);
      if (!pos) return false;
      if (!Game.constants3d.isActiveSimulationPosition3D(state, pos.x, pos.z)
        || isWaterFluid(getBlock3D(state, pos.x, pos.y, pos.z))) {
        fluids.active.add(key);
        return false;
      }
      return true;
    });
    const activeKeys = allActiveKeys.slice(0, ACTIVE_FLUID_TICK_LIMIT);
    let bounds = null;
    for (const key of activeKeys) {
      const pos = parseSourceKey(key);
      if (!pos || !inBounds3D(state.world, pos.x, pos.y, pos.z)) continue;
      const id = getBlock3D(state, pos.x, pos.y, pos.z);
      if (isWaterFluid(id) || id === BLOCK.LAVA || id === BLOCK.VOLCANIC_LAVA) stepFluidCell(state, id, pos.x, pos.y, pos.z, moves);
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
      } else if (move.type === 'solid') {
        setBlock3D(state, move.x, move.y, move.z, move.block);
        addActiveFluidNeighbors(state, move.x, move.y, move.z);
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

  function stepImmediateFluid3D(state) {
    const fluids = ensureFluidState(state);
    if (!fluids.active.size || !state || !state.player) return;
    tickFluids(state);
  }

  function addWaterSource3D(state, x, y, z) {
    if (!isFluidCellLoaded(state, x, y, z)) return false;
    const changed = setWater3D(state, x, y, z, 0, true);
    addActiveFluidNeighbors(state, x, y, z);
    if (changed) stepImmediateFluid3D(state);
    return changed;
  }

  function addLavaSource3D(state, x, y, z) {
    if (!isFluidCellLoaded(state, x, y, z)) return false;
    const changed = setLava3D(state, x, y, z, 0, true);
    addActiveFluidNeighbors(state, x, y, z);
    if (changed) stepImmediateFluid3D(state);
    return changed;
  }

  function addVolcanicLavaSource3D(state, x, y, z) {
    if (!isFluidCellLoaded(state, x, y, z)) return false;
    const changed = setVolcanicLava3D(state, x, y, z, 0, true);
    addActiveFluidNeighbors(state, x, y, z);
    if (changed) stepImmediateFluid3D(state);
    return changed;
  }

  function activateFluidAround3D(state, x, y, z) {
    addActiveFluidNeighbors(state, x, y, z);
    cleanupDisconnectedFluidsNear(state, x, y, z);
  }

  function activateFluidAroundLoadedChunk3D(state, bounds) {
    const world = state && state.world;
    if (!world || !bounds) return;
    for (let y = bounds.minY; y < bounds.maxY; y += 1) {
      for (let z = bounds.minZ; z < bounds.maxZ; z += 1) {
        addActiveFluidNeighbors(state, bounds.minX, y, z);
        addActiveFluidNeighbors(state, bounds.maxX - 1, y, z);
      }
      for (let x = bounds.minX; x < bounds.maxX; x += 1) {
        addActiveFluidNeighbors(state, x, y, bounds.minZ);
        addActiveFluidNeighbors(state, x, y, bounds.maxZ - 1);
      }
    }
  }

  function activateVolcanicLavaCoolingWave3D(state, wave) {
    const world = state && state.world;
    if (!world || !world.chunks || !wave) return;
    const size = Game.constants3d.CHUNK_SIZE;
    const radius = Math.ceil(wave.outerRadius || 0);
    const minX = Math.max(0, Math.floor(wave.x - radius));
    const maxX = Math.min(world.w - 1, Math.ceil(wave.x + radius));
    const minZ = Math.max(0, Math.floor(wave.z - radius));
    const maxZ = Math.min(world.d - 1, Math.ceil(wave.z + radius));
    for (const chunk of world.chunks.values()) {
      if (!chunk || !chunk.blocks) continue;
      const chunkMinX = chunk.cx * size;
      const chunkMinY = chunk.cy * size;
      const chunkMinZ = chunk.cz * size;
      const chunkMaxX = Math.min(world.w, chunkMinX + size);
      const chunkMaxY = Math.min(world.h, chunkMinY + size);
      const chunkMaxZ = Math.min(world.d, chunkMinZ + size);
      if (chunkMaxX <= minX || chunkMinX > maxX || chunkMaxZ <= minZ || chunkMinZ > maxZ) continue;
      for (let ly = 0; ly < size; ly += 1) {
        const y = chunkMinY + ly;
        if (y < 0 || y >= chunkMaxY) continue;
        for (let lz = 0; lz < size; lz += 1) {
          const z = chunkMinZ + lz;
          if (z < minZ || z > maxZ || z >= chunkMaxZ) continue;
          for (let lx = 0; lx < size; lx += 1) {
            const x = chunkMinX + lx;
            if (x < minX || x > maxX || x >= chunkMaxX) continue;
            const index = lx + size * (lz + size * ly);
            if (chunk.blocks[index] !== BLOCK.VOLCANIC_LAVA && chunk.blocks[index] !== BLOCK.LAVA) continue;
            addActiveFluidNeighbors(state, x, y, z);
          }
        }
      }
    }
  }

  Game.fluids3d = {
    addWaterSource3D,
    addLavaSource3D,
    addVolcanicLavaSource3D,
    activateFluidAround3D,
    activateFluidAroundLoadedChunk3D,
    activateVolcanicLavaCoolingWave3D,
    stepImmediateFluid3D,
    updateFluids3D,
    isActiveGeyser3D,
    getGeyserInfo3D,
    getActiveGeysers3D,
    geyserHeightForHotWaterCount,
  };
})();
