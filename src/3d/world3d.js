(() => {
  const Game = window.CubDep;
  const { BLOCK } = Game.blocks;

  function createWorld3D(w, h, d) {
    return {
      w,
      h,
      d,
      blocks: new Uint16Array(w * h * d),
      waterLevel: new Uint8Array(w * h * d).fill(255),
      waterSources: new Set(),
      blockDamage: {},
      dirtyAll: true,
      dirtyChunks: new Set(),
    };
  }

  function index3D(world, x, y, z) {
    return x + world.w * (z + world.d * y);
  }

  function inBounds3D(world, x, y, z) {
    return x >= 0 && x < world.w && y >= 0 && y < world.h && z >= 0 && z < world.d;
  }

  function getBlock3D(state, x, y, z) {
    const world = state && state.world;
    if (!world || !inBounds3D(world, x, y, z)) return BLOCK.BEDROCK;
    return world.blocks[index3D(world, x, y, z)];
  }

  function chunkKey3D(x, y, z) {
    const size = Game.constants3d.CHUNK_SIZE;
    return `${Math.floor(x / size)},${Math.floor(y / size)},${Math.floor(z / size)}`;
  }

  function markChunkDirty3D(state, x, y, z) {
    const world = state && state.world;
    if (!world || !world.dirtyChunks || !inBounds3D(world, x, y, z)) return;
    const size = Game.constants3d.CHUNK_SIZE;
    const chunks = world.dirtyChunks;
    const cx = Math.floor(x / size);
    const cy = Math.floor(y / size);
    const cz = Math.floor(z / size);
    chunks.add(`${cx},${cy},${cz}`);

    if (x % size === 0 && x > 0) chunks.add(`${cx - 1},${cy},${cz}`);
    if (x % size === size - 1 && x < world.w - 1) chunks.add(`${cx + 1},${cy},${cz}`);
    if (y % size === 0 && y > 0) chunks.add(`${cx},${cy - 1},${cz}`);
    if (y % size === size - 1 && y < world.h - 1) chunks.add(`${cx},${cy + 1},${cz}`);
    if (z % size === 0 && z > 0) chunks.add(`${cx},${cy},${cz - 1}`);
    if (z % size === size - 1 && z < world.d - 1) chunks.add(`${cx},${cy},${cz + 1}`);
  }

  function setBlock3D(state, x, y, z, id) {
    const world = state && state.world;
    if (!world || !inBounds3D(world, x, y, z)) return false;
    const index = index3D(world, x, y, z);
    if (world.blocks[index] === id) return false;
    world.blocks[index] = id;
    if (id === BLOCK.WATER) {
      world.waterLevel[index] = 0;
      world.waterSources.add(`${x},${y},${z}`);
    } else if (world.waterLevel) {
      world.waterLevel[index] = 255;
      if (world.waterSources) world.waterSources.delete(`${x},${y},${z}`);
    }
    if (world.blockDamage) delete world.blockDamage[`${x},${y},${z}`];
    markChunkDirty3D(state, x, y, z);
    return true;
  }

  function getWaterLevel3D(state, x, y, z) {
    const world = state && state.world;
    if (!world || !world.waterLevel || !inBounds3D(world, x, y, z)) return 255;
    if (world.blocks[index3D(world, x, y, z)] !== BLOCK.WATER) return 255;
    return world.waterLevel[index3D(world, x, y, z)];
  }

  function setWater3D(state, x, y, z, level = 0, source = false) {
    const world = state && state.world;
    if (!world || !inBounds3D(world, x, y, z)) return false;
    const index = index3D(world, x, y, z);
    const key = `${x},${y},${z}`;
    const nextLevel = Math.max(0, Math.min(7, level | 0));
    const changed = world.blocks[index] !== BLOCK.WATER || world.waterLevel[index] !== nextLevel || (!!world.waterSources.has(key)) !== !!source;
    world.blocks[index] = BLOCK.WATER;
    world.waterLevel[index] = nextLevel;
    if (source) world.waterSources.add(key);
    else world.waterSources.delete(key);
    if (world.blockDamage) delete world.blockDamage[key];
    if (changed) markChunkDirty3D(state, x, y, z);
    return changed;
  }

  function isWaterSource3D(state, x, y, z) {
    const world = state && state.world;
    return !!(world && world.waterSources && world.waterSources.has(`${x},${y},${z}`));
  }

  function isSolidBlock3D(id) {
    return id !== BLOCK.AIR && id !== BLOCK.WATER && id !== BLOCK.LAVA && id !== BLOCK.TORCH;
  }

  Game.world3d = {
    createWorld3D,
    getBlock3D,
    setBlock3D,
    getWaterLevel3D,
    setWater3D,
    isWaterSource3D,
    inBounds3D,
    isSolidBlock3D,
    index3D,
    chunkKey3D,
    markChunkDirty3D,
  };
})();
