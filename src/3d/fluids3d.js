(() => {
  const Game = window.CubDep;
  const { BLOCK } = Game.blocks;
  const { getBlock3D, setBlock3D, getWaterLevel3D, setWater3D, isWaterSource3D, inBounds3D } = Game.world3d;

  const MAX_WATER_LEVEL = 4;
  const TICK_INTERVAL = 0.14;
  const SIDE_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function waterKey(x, y, z) {
    return `${x},${y},${z}`;
  }

  function canWaterReplace(state, x, y, z) {
    const id = getBlock3D(state, x, y, z);
    return id === BLOCK.AIR || id === BLOCK.WATER;
  }

  function isSupportForWater(state, x, y, z) {
    const id = getBlock3D(state, x, y, z);
    return id !== BLOCK.AIR && id !== BLOCK.WATER && id !== BLOCK.LAVA;
  }

  function ensureFluidState(state) {
    if (!state.fluids3d) state.fluids3d = { accumulator: 0 };
    return state.fluids3d;
  }

  function removeWater(state, x, y, z) {
    if (getBlock3D(state, x, y, z) !== BLOCK.WATER) return false;
    return setBlock3D(state, x, y, z, BLOCK.AIR);
  }

  function getBestHorizontalLevel(state, x, y, z) {
    let best = 255;
    for (const [dx, dz] of SIDE_DIRS) {
      const nx = x + dx;
      const nz = z + dz;
      if (!inBounds3D(state.world, nx, y, nz)) continue;
      if (getBlock3D(state, nx, y, nz) !== BLOCK.WATER) continue;
      best = Math.min(best, getWaterLevel3D(state, nx, y, nz));
    }
    return best;
  }

  function stepWaterCell(state, x, y, z, moves) {
    if (getBlock3D(state, x, y, z) !== BLOCK.WATER) return;
    const source = isWaterSource3D(state, x, y, z);
    const level = getWaterLevel3D(state, x, y, z);
    const belowY = y - 1;

    if (inBounds3D(state.world, x, belowY, z) && canWaterReplace(state, x, belowY, z)) {
      const belowLevel = getWaterLevel3D(state, x, belowY, z);
      if (belowLevel > 0) moves.push({ type: 'water', x, y: belowY, z, level: 0, source: false });
    }

    if (!source) {
      const aboveWater = getBlock3D(state, x, y + 1, z) === BLOCK.WATER;
      const best = getBestHorizontalLevel(state, x, y, z);
      const supportedLevel = aboveWater ? 0 : best + 1;
      if (supportedLevel > MAX_WATER_LEVEL) {
        moves.push({ type: 'air', x, y, z });
        return;
      }
      if (supportedLevel !== level) moves.push({ type: 'water', x, y, z, level: supportedLevel, source: false });
    }

    const nextLevel = source ? 1 : level + 1;
    if (nextLevel > MAX_WATER_LEVEL) return;
    if (!isSupportForWater(state, x, y - 1, z) && getBlock3D(state, x, y - 1, z) !== BLOCK.WATER) return;
    const dirs = ((x + y + z) & 1) ? SIDE_DIRS : [SIDE_DIRS[2], SIDE_DIRS[3], SIDE_DIRS[0], SIDE_DIRS[1]];
    for (const [dx, dz] of dirs) {
      const nx = x + dx;
      const nz = z + dz;
      if (!inBounds3D(state.world, nx, y, nz)) continue;
      if (!canWaterReplace(state, nx, y, nz)) continue;
      const sideLevel = getWaterLevel3D(state, nx, y, nz);
      if (sideLevel <= nextLevel) continue;
      moves.push({ type: 'water', x: nx, y, z: nz, level: nextLevel, source: false });
    }
  }

  function tickWater(state) {
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

    for (let y = maxY; y >= minY; y -= 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          if (getBlock3D(state, x, y, z) === BLOCK.WATER) stepWaterCell(state, x, y, z, moves);
        }
      }
    }

    for (const move of moves) {
      if (move.type === 'air') {
        if (!isWaterSource3D(state, move.x, move.y, move.z)) removeWater(state, move.x, move.y, move.z);
      } else {
        setWater3D(state, move.x, move.y, move.z, move.level, move.source);
      }
    }
  }

  function updateFluids3D(state, dt) {
    const fluids = ensureFluidState(state);
    fluids.accumulator += dt;
    while (fluids.accumulator >= TICK_INTERVAL) {
      fluids.accumulator -= TICK_INTERVAL;
      tickWater(state);
    }
  }

  function addWaterSource3D(state, x, y, z) {
    return setWater3D(state, x, y, z, 0, true);
  }

  Game.fluids3d = { addWaterSource3D, updateFluids3D };
})();
