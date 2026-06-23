(() => {
  const Game = window.CubDep;
  const { BLOCK } = Game.blocks;
  const { getBlock3D, setBlock3D, getFluidLevel3D, setWater3D, setLava3D, isFluidSource3D, inBounds3D } = Game.world3d;

  const MAX_FLUID_LEVEL = 4;
  const TICK_INTERVAL = 0.14;
  const SIDE_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  function setFluid(state, fluidId, x, y, z, level, source) {
    if (fluidId === BLOCK.LAVA) return setLava3D(state, x, y, z, level, source);
    return setWater3D(state, x, y, z, level, source);
  }

  function canFluidReplace(state, fluidId, x, y, z) {
    const id = getBlock3D(state, x, y, z);
    return id === BLOCK.AIR || id === fluidId;
  }

  function isSupportForFluid(state, x, y, z) {
    const id = getBlock3D(state, x, y, z);
    return id !== BLOCK.AIR && id !== BLOCK.WATER && id !== BLOCK.LAVA;
  }

  function ensureFluidState(state) {
    if (!state.fluids3d) state.fluids3d = { accumulator: 0 };
    return state.fluids3d;
  }

  function removeFluid(state, fluidId, x, y, z) {
    if (getBlock3D(state, x, y, z) !== fluidId) return false;
    return setBlock3D(state, x, y, z, BLOCK.AIR);
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
    const belowY = y - 1;

    if (inBounds3D(state.world, x, belowY, z) && canFluidReplace(state, fluidId, x, belowY, z)) {
      const belowLevel = getFluidLevel3D(state, x, belowY, z, fluidId);
      if (belowLevel > 0) moves.push({ type: 'fluid', fluidId, x, y: belowY, z, level: 0, source: false });
    }

    if (!source) {
      const aboveFluid = getBlock3D(state, x, y + 1, z) === fluidId;
      const best = getBestHorizontalLevel(state, fluidId, x, y, z);
      const supportedLevel = aboveFluid ? 0 : best + 1;
      if (supportedLevel > MAX_FLUID_LEVEL) {
        moves.push({ type: 'air', fluidId, x, y, z });
        return;
      }
      if (supportedLevel !== level) moves.push({ type: 'fluid', fluidId, x, y, z, level: supportedLevel, source: false });
    }

    const nextLevel = source ? 1 : level + 1;
    if (nextLevel > MAX_FLUID_LEVEL) return;
    if (!isSupportForFluid(state, x, y - 1, z) && getBlock3D(state, x, y - 1, z) !== fluidId) return;
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

    for (let y = maxY; y >= minY; y -= 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          const id = getBlock3D(state, x, y, z);
          if (id === BLOCK.WATER || id === BLOCK.LAVA) stepFluidCell(state, id, x, y, z, moves);
        }
      }
    }

    for (const move of moves) {
      if (move.type === 'air') {
        if (!isFluidSource3D(state, move.x, move.y, move.z, move.fluidId)) removeFluid(state, move.fluidId, move.x, move.y, move.z);
      } else {
        setFluid(state, move.fluidId, move.x, move.y, move.z, move.level, move.source);
      }
    }
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

  Game.fluids3d = { addWaterSource3D, addLavaSource3D, updateFluids3D };
})();
