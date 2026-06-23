(() => {
  const Game = window.CubDep;
  const { BLOCK } = Game.blocks;
  const { getBlock3D, setBlock3D, inBounds3D } = Game.world3d;

  const TICK_INTERVAL = 0.45;
  const SCAN_RADIUS = 26;
  const MIN_DELAY = 10;
  const MAX_DELAY = 30;
  const CELLS_PER_TICK = 180;

  function keyOf(x, y, z) {
    return `${x},${y},${z}`;
  }

  function randomDelay() {
    return MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);
  }

  function ensureGrassState(state) {
    if (!state.grass3d) state.grass3d = { accumulator: 0, timers: {} };
    if (!state.grass3d.timers) state.grass3d.timers = {};
    return state.grass3d;
  }

  function isAirAbove(state, x, y, z) {
    return inBounds3D(state.world, x, y + 1, z) && getBlock3D(state, x, y + 1, z) === BLOCK.AIR;
  }

  function updateGrassCell(state, grass, x, y, z, dt) {
    const block = getBlock3D(state, x, y, z);
    if (block !== BLOCK.GRASS && block !== BLOCK.DIRT) return;

    const key = keyOf(x, y, z);
    if (block === BLOCK.GRASS) {
      if (isAirAbove(state, x, y, z)) {
        delete grass.timers[key];
        return;
      }
      if (!Number.isFinite(grass.timers[key])) grass.timers[key] = randomDelay();
      grass.timers[key] -= dt;
      if (grass.timers[key] <= 0) {
        setBlock3D(state, x, y, z, BLOCK.DIRT);
        delete grass.timers[key];
      }
      return;
    }

    if (block === BLOCK.DIRT) {
      if (!isAirAbove(state, x, y, z)) {
        delete grass.timers[key];
        return;
      }
      if (!Number.isFinite(grass.timers[key])) grass.timers[key] = randomDelay();
      grass.timers[key] -= dt;
      if (grass.timers[key] <= 0) {
        setBlock3D(state, x, y, z, BLOCK.GRASS);
        delete grass.timers[key];
      }
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
      for (let y = world.h - 2; y >= 1; y -= 1) {
        const block = getBlock3D(state, x, y, z);
        if (block === BLOCK.GRASS || block === BLOCK.DIRT) {
          updateGrassCell(state, grass, x, y, z, dt);
          break;
        }
        if (block !== BLOCK.AIR && block !== BLOCK.WATER && block !== BLOCK.LAVA) break;
      }
      checked += 1;
    }
  }

  function updateGrass3D(state, dt) {
    const grass = ensureGrassState(state);
    grass.accumulator += dt;
    while (grass.accumulator >= TICK_INTERVAL) {
      grass.accumulator -= TICK_INTERVAL;
      tickGrass(state, TICK_INTERVAL);
    }
  }

  Game.grass3d = { updateGrass3D };
})();
