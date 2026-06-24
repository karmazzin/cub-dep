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
  const SIDE_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

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

  function removeFluid(state, fluidId, x, y, z) {
    if (getBlock3D(state, x, y, z) !== fluidId) return false;
    return setBlock3D(state, x, y, z, BLOCK.AIR);
  }

  function coolHotWater(state, x, y, z, source) {
    const level = getFluidLevel3D(state, x, y, z, BLOCK.HOT_WATER);
    const nextLevel = level === 255 ? 0 : level;
    return setWater3D(state, x, y, z, nextLevel, source);
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
      const aboveFluid = getBlock3D(state, x, y + 1, z) === fluidId;
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
    const world = state.world;
    const moves = [];
    const px = Math.floor(state.player.x);
    const py = Math.floor(state.player.y);
    const pz = Math.floor(state.player.z);
    const radius = 32;
    const minX = Math.max(0, px - radius);
    const maxX = Math.min(world.w - 1, px + radius);
    const minY = Math.max(0, py - 20);
    const maxY = Math.min(world.h - 1, py + 20);
    const minZ = Math.max(0, pz - radius);
    const maxZ = Math.min(world.d - 1, pz + radius);
    const bounds = { minX, maxX, minY, maxY, minZ, maxZ };

    for (let y = maxY; y >= minY; y -= 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          const id = getBlock3D(state, x, y, z);
          if (isWaterFluid(id) || id === BLOCK.LAVA) stepFluidCell(state, id, x, y, z, moves);
        }
      }
    }

    for (const move of moves) {
      if (move.type === 'air') {
        if (!isFluidSource3D(state, move.x, move.y, move.z, move.fluidId)) removeFluid(state, move.fluidId, move.x, move.y, move.z);
      } else if (move.type === 'cool') {
        coolHotWater(state, move.x, move.y, move.z, move.source);
      } else {
        setFluid(state, move.fluidId, move.x, move.y, move.z, move.level, move.source);
      }
    }

    rebuildGeyserCache(state, bounds);
  }

  function updateFluids3D(state, dt) {
    const fluids = ensureFluidState(state);
    fluids.accumulator += dt;
    while (fluids.accumulator >= TICK_INTERVAL) {
      fluids.accumulator -= TICK_INTERVAL;
      tickFluids(state);
    }
  }

  function addWaterSource3D(state, x, y, z) {
    return setWater3D(state, x, y, z, 0, true);
  }

  function addLavaSource3D(state, x, y, z) {
    return setLava3D(state, x, y, z, 0, true);
  }

  Game.fluids3d = {
    addWaterSource3D,
    addLavaSource3D,
    updateFluids3D,
    isActiveGeyser3D,
    getGeyserInfo3D,
    getActiveGeysers3D,
    geyserHeightForHotWaterCount,
  };
})();
