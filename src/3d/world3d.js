(() => {
  const Game = window.CubDep;
  const { BLOCK } = Game.blocks;

  function createWorld3D(w, h, d) {
    return {
      w,
      h,
      d,
      chunks: new Map(),
      generatedChunks: new Set(),
      waterSources: new Set(),
      lavaSources: new Set(),
      blockDamage: {},
      dirtyAll: true,
      dirtyChunks: new Set(),
    };
  }

  function index3D(world, x, y, z) {
    return x + world.w * (z + world.d * y);
  }

  function chunkCoords3D(x, y, z) {
    const size = Game.constants3d.CHUNK_SIZE;
    return {
      cx: Math.floor(x / size),
      cy: Math.floor(y / size),
      cz: Math.floor(z / size),
      lx: x % size,
      ly: y % size,
      lz: z % size,
    };
  }

  function chunkLocalIndex3D(lx, ly, lz) {
    const size = Game.constants3d.CHUNK_SIZE;
    return lx + size * (lz + size * ly);
  }

  function createChunk3D(cx, cy, cz) {
    const size = Game.constants3d.CHUNK_SIZE;
    return {
      cx,
      cy,
      cz,
      blocks: new Uint16Array(size * size * size),
      fluidLevel: new Uint8Array(size * size * size).fill(255),
    };
  }

  function getChunk3D(world, cx, cy, cz, create = false) {
    if (!world || !world.chunks) return null;
    const key = `${cx},${cy},${cz}`;
    let chunk = world.chunks.get(key);
    if (!chunk && create) {
      chunk = createChunk3D(cx, cy, cz);
      world.chunks.set(key, chunk);
    }
    return chunk || null;
  }

  function getChunkForBlock3D(world, x, y, z, create = false) {
    const coords = chunkCoords3D(x, y, z);
    const chunk = getChunk3D(world, coords.cx, coords.cy, coords.cz, create);
    return chunk ? { chunk, coords, index: chunkLocalIndex3D(coords.lx, coords.ly, coords.lz) } : null;
  }

  function clearWorld3D(state) {
    const world = state && state.world;
    if (!world) return;
    if (!world.chunks) world.chunks = new Map();
    world.chunks.clear();
    if (world.generatedChunks) world.generatedChunks.clear();
    else world.generatedChunks = new Set();
    if (world.waterSources) world.waterSources.clear();
    else world.waterSources = new Set();
    if (world.lavaSources) world.lavaSources.clear();
    else world.lavaSources = new Set();
    world.blockDamage = {};
    world.dirtyAll = true;
    if (world.dirtyChunks) world.dirtyChunks.clear();
    else world.dirtyChunks = new Set();
  }

  function inBounds3D(world, x, y, z) {
    return x >= 0 && x < world.w && y >= 0 && y < world.h && z >= 0 && z < world.d;
  }

  function getBlock3D(state, x, y, z) {
    const world = state && state.world;
    if (!world || !inBounds3D(world, x, y, z)) return BLOCK.BEDROCK;
    const entry = getChunkForBlock3D(world, x, y, z, false);
    return entry ? entry.chunk.blocks[entry.index] : BLOCK.AIR;
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
    let entry = getChunkForBlock3D(world, x, y, z, false);
    if (!entry && id === BLOCK.AIR) return false;
    if (!entry) entry = getChunkForBlock3D(world, x, y, z, true);
    if (entry.chunk.blocks[entry.index] === id) return false;
    entry.chunk.blocks[entry.index] = id;
    const key = `${x},${y},${z}`;
    if (id === BLOCK.WATER || id === BLOCK.LAVA) {
      entry.chunk.fluidLevel[entry.index] = 0;
      if (id === BLOCK.WATER) {
        world.waterSources.add(key);
        if (world.lavaSources) world.lavaSources.delete(key);
      } else {
        world.lavaSources.add(key);
        if (world.waterSources) world.waterSources.delete(key);
      }
    } else {
      entry.chunk.fluidLevel[entry.index] = 255;
      if (world.waterSources) world.waterSources.delete(key);
      if (world.lavaSources) world.lavaSources.delete(key);
    }
    if (world.blockDamage) delete world.blockDamage[key];
    markChunkDirty3D(state, x, y, z);
    return true;
  }

  function getFluidLevel3D(state, x, y, z, fluidId) {
    const world = state && state.world;
    if (!world || !inBounds3D(world, x, y, z)) return 255;
    const entry = getChunkForBlock3D(world, x, y, z, false);
    if (!entry || entry.chunk.blocks[entry.index] !== fluidId) return 255;
    return entry.chunk.fluidLevel[entry.index];
  }

  function getWaterLevel3D(state, x, y, z) {
    return getFluidLevel3D(state, x, y, z, BLOCK.WATER);
  }

  function getLavaLevel3D(state, x, y, z) {
    return getFluidLevel3D(state, x, y, z, BLOCK.LAVA);
  }

  function setFluid3D(state, x, y, z, fluidId, level = 0, source = false) {
    const world = state && state.world;
    if (!world || !inBounds3D(world, x, y, z)) return false;
    const entry = getChunkForBlock3D(world, x, y, z, true);
    const key = `${x},${y},${z}`;
    const nextLevel = Math.max(0, Math.min(7, level | 0));
    const sources = fluidId === BLOCK.LAVA ? world.lavaSources : world.waterSources;
    const otherSources = fluidId === BLOCK.LAVA ? world.waterSources : world.lavaSources;
    const changed = entry.chunk.blocks[entry.index] !== fluidId || entry.chunk.fluidLevel[entry.index] !== nextLevel || (!!sources.has(key)) !== !!source;
    entry.chunk.blocks[entry.index] = fluidId;
    entry.chunk.fluidLevel[entry.index] = nextLevel;
    if (source) sources.add(key);
    else sources.delete(key);
    if (otherSources) otherSources.delete(key);
    if (world.blockDamage) delete world.blockDamage[key];
    if (changed) markChunkDirty3D(state, x, y, z);
    return changed;
  }

  function setWater3D(state, x, y, z, level = 0, source = false) {
    return setFluid3D(state, x, y, z, BLOCK.WATER, level, source);
  }

  function setLava3D(state, x, y, z, level = 0, source = false) {
    return setFluid3D(state, x, y, z, BLOCK.LAVA, level, source);
  }

  function isFluidSource3D(state, x, y, z, fluidId) {
    const world = state && state.world;
    const sources = fluidId === BLOCK.LAVA ? world && world.lavaSources : world && world.waterSources;
    return !!(sources && sources.has(`${x},${y},${z}`));
  }

  function isWaterSource3D(state, x, y, z) {
    return isFluidSource3D(state, x, y, z, BLOCK.WATER);
  }

  function isLavaSource3D(state, x, y, z) {
    return isFluidSource3D(state, x, y, z, BLOCK.LAVA);
  }

  function isSolidBlock3D(id) {
    return id !== BLOCK.AIR && id !== BLOCK.WATER && id !== BLOCK.LAVA && id !== BLOCK.TORCH;
  }

  Game.world3d = {
    createWorld3D,
    clearWorld3D,
    getBlock3D,
    setBlock3D,
    getFluidLevel3D,
    getWaterLevel3D,
    getLavaLevel3D,
    setWater3D,
    setLava3D,
    isFluidSource3D,
    isWaterSource3D,
    isLavaSource3D,
    inBounds3D,
    isSolidBlock3D,
    index3D,
    chunkKey3D,
    markChunkDirty3D,
  };
})();
