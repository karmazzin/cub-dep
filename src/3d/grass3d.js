(() => {
  const Game = window.CubDep;
  const { BLOCK } = Game.blocks;
  const { getBlock3D, setBlock3D, getGrassLevel3D, setGrassLevel3D, inBounds3D } = Game.world3d;

  const TICK_INTERVAL = 0.45;
  const SCAN_RADIUS = 26;
  const MIN_DELAY = 10;
  const MAX_DELAY = 30;
  const CELLS_PER_TICK = 180;
  const WATER_RESTORE_MIN_DELAY = 3;
  const WATER_RESTORE_MAX_DELAY = 8;
  const SCORCH_BIOMES = new Set(['desert', 'volcanic']);
  const NO_GRASS_BIOMES = new Set(['mountains', 'cliffs', 'mountain_forest', 'geysers', 'desert', 'volcanic']);
  const GREEN_BIOMES = new Set(['plains', 'forest', 'spruce_forest']);
  const LAVA_BLOCKS = new Set([BLOCK.LAVA, BLOCK.VOLCANIC_LAVA]);
  const WATER_BLOCKS = new Set([BLOCK.WATER]);
  const HOT_WATER_BLOCKS = new Set([BLOCK.HOT_WATER]);
  const NEIGHBOR_DIRS = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];

  function keyOf(x, y, z) {
    return `${x},${y},${z}`;
  }

  function randomDelay() {
    return MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);
  }

  function randomDelayBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function ensureGrassState(state) {
    if (!state.grass3d) state.grass3d = { accumulator: 0, timers: {}, time: 0 };
    if (!state.grass3d.timers) state.grass3d.timers = {};
    if (!Number.isFinite(state.grass3d.time)) state.grass3d.time = 0;
    return state.grass3d;
  }

  function isAirAbove(state, x, y, z) {
    return inBounds3D(state.world, x, y + 1, z) && getBlock3D(state, x, y + 1, z) === BLOCK.AIR;
  }

  function getBiomeAt(state, x, z) {
    return Game.generation3d && Game.generation3d.getBiomeAt3D
      ? Game.generation3d.getBiomeAt3D(state, x, z)
      : 'plains';
  }

  function timerKey(x, y, z, action) {
    return `${keyOf(x, y, z)}:${action}`;
  }

  function clearCellTimers(grass, x, y, z) {
    const baseKey = keyOf(x, y, z);
    delete grass.timers[baseKey];
    delete grass.timers[timerKey(x, y, z, 'grass')];
    delete grass.timers[timerKey(x, y, z, 'scorch')];
    delete grass.timers[timerKey(x, y, z, 'restore')];
    delete grass.timers[timerKey(x, y, z, 'water_restore')];
  }

  function ensureTimer(grass, key, min = MIN_DELAY, max = MAX_DELAY) {
    if (!Number.isFinite(grass.timers[key])) grass.timers[key] = grass.time + randomDelayBetween(min, max);
    return grass.time >= grass.timers[key];
  }

  function hasNeighborBlock(state, x, y, z, ids) {
    for (const [dx, dy, dz] of NEIGHBOR_DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      const nz = z + dz;
      if (!inBounds3D(state.world, nx, ny, nz)) continue;
      if (ids.has(getBlock3D(state, nx, ny, nz))) return true;
    }
    return false;
  }

  function updateGrassCell(state, grass, x, y, z) {
    const block = getBlock3D(state, x, y, z);
    if (block !== BLOCK.DIRT && block !== BLOCK.SCORCHED_DIRT) return;

    const biome = getBiomeAt(state, x, z);
    const openTop = isAirAbove(state, x, y, z);
    const nearLava = hasNeighborBlock(state, x, y, z, LAVA_BLOCKS);
    const nearWater = hasNeighborBlock(state, x, y, z, WATER_BLOCKS);
    const nearHotWater = hasNeighborBlock(state, x, y, z, HOT_WATER_BLOCKS);

    if (nearLava && block === BLOCK.DIRT) {
      setBlock3D(state, x, y, z, BLOCK.SCORCHED_DIRT);
      clearCellTimers(grass, x, y, z);
      return;
    }

    if (block === BLOCK.SCORCHED_DIRT) {
      if (nearWater) {
        const key = timerKey(x, y, z, 'water_restore');
        if (ensureTimer(grass, key, WATER_RESTORE_MIN_DELAY, WATER_RESTORE_MAX_DELAY)) {
          setBlock3D(state, x, y, z, BLOCK.DIRT);
          clearCellTimers(grass, x, y, z);
        }
        return;
      }
      if (!GREEN_BIOMES.has(biome)) {
        clearCellTimers(grass, x, y, z);
        return;
      }
      const key = timerKey(x, y, z, 'restore');
      if (ensureTimer(grass, key)) {
        setBlock3D(state, x, y, z, BLOCK.DIRT);
        clearCellTimers(grass, x, y, z);
      }
      return;
    }

    const hasGrass = getGrassLevel3D(state, x, y, z) > 0;

    if (nearHotWater || SCORCH_BIOMES.has(biome)) {
      const key = timerKey(x, y, z, 'scorch');
      if (ensureTimer(grass, key)) {
        if (hasGrass) setGrassLevel3D(state, x, y, z, 0);
        else setBlock3D(state, x, y, z, BLOCK.SCORCHED_DIRT);
        clearCellTimers(grass, x, y, z);
      }
      return;
    }

    if (NO_GRASS_BIOMES.has(biome)) {
      if (!hasGrass) {
        clearCellTimers(grass, x, y, z);
        return;
      }
      const key = timerKey(x, y, z, 'grass');
      if (ensureTimer(grass, key)) {
        setGrassLevel3D(state, x, y, z, 0);
        clearCellTimers(grass, x, y, z);
      }
      return;
    }

    if (hasGrass && openTop) {
      clearCellTimers(grass, x, y, z);
      return;
    }
    if (!hasGrass && !openTop) {
      clearCellTimers(grass, x, y, z);
      return;
    }

    const key = timerKey(x, y, z, 'grass');
    if (ensureTimer(grass, key)) {
      setGrassLevel3D(state, x, y, z, openTop ? 1 : 0);
      clearCellTimers(grass, x, y, z);
    }
  }

  function tickGrass(state, dt) {
    const grass = ensureGrassState(state);
    const world = state.world;
    const px = Math.floor(state.player.x);
    const pz = Math.floor(state.player.z);
    let checked = 0;

    while (checked < CELLS_PER_TICK) {
      const x = Math.max(0, Math.min(world.w - 1, px + Math.floor((Math.random() * 2 - 1) * SCAN_RADIUS)));
      const z = Math.max(0, Math.min(world.d - 1, pz + Math.floor((Math.random() * 2 - 1) * SCAN_RADIUS)));
      if (!Game.constants3d.isActiveSimulationPosition3D(state, x, z)) {
        checked += 1;
        continue;
      }
      for (let y = world.h - 2; y >= 1; y -= 1) {
        const block = getBlock3D(state, x, y, z);
        if (block === BLOCK.DIRT || block === BLOCK.SCORCHED_DIRT) {
          updateGrassCell(state, grass, x, y, z);
          break;
        }
      }
      checked += 1;
    }
  }

  function updateGrass3D(state, dt) {
    const grass = ensureGrassState(state);
    grass.time += dt;
    grass.accumulator += dt;
    while (grass.accumulator >= TICK_INTERVAL) {
      grass.accumulator -= TICK_INTERVAL;
      tickGrass(state, TICK_INTERVAL);
    }
  }

  Game.grass3d = { updateGrass3D };
})();
