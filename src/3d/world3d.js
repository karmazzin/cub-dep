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
      decoratedColumns: new Set(),
      modifiedChunks: new Set(),
      unsavedChunks: new Set(),
      savedChunks: new Set(),
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
      grassLevel: new Uint8Array(size * size * size),
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

  function chunkBounds3D(world, cx, cy, cz) {
    const size = Game.constants3d.CHUNK_SIZE;
    const minX = cx * size;
    const minY = cy * size;
    const minZ = cz * size;
    if (minX >= world.w || minY >= world.h || minZ >= world.d || minX < 0 || minY < 0 || minZ < 0) return null;
    return {
      minX,
      minY,
      minZ,
      maxX: Math.min(world.w, minX + size),
      maxY: Math.min(world.h, minY + size),
      maxZ: Math.min(world.d, minZ + size),
    };
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
    if (world.decoratedColumns) world.decoratedColumns.clear();
    else world.decoratedColumns = new Set();
    if (world.modifiedChunks) world.modifiedChunks.clear();
    else world.modifiedChunks = new Set();
    if (world.unsavedChunks) world.unsavedChunks.clear();
    else world.unsavedChunks = new Set();
    if (world.savedChunks) world.savedChunks.clear();
    else world.savedChunks = new Set();
    if (world.waterSources) world.waterSources.clear();
    else world.waterSources = new Set();
    if (world.lavaSources) world.lavaSources.clear();
    else world.lavaSources = new Set();
    world.blockDamage = {};
    world.chunkLoading = null;
    world.lastQueuedChunks = 0;
    world.lastPendingChunks = 0;
    world.lastDecoratedColumns = 0;
    world.lastUnloadedChunks = 0;
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

  function chunkKeyFromCoords3D(cx, cy, cz) {
    return `${cx},${cy},${cz}`;
  }

  function markChunkModified3D(state, x, y, z) {
    const world = state && state.world;
    if (!world || !inBounds3D(world, x, y, z) || world.suppressChunkModification) return;
    if (!world.modifiedChunks) world.modifiedChunks = new Set();
    world.modifiedChunks.add(chunkKey3D(x, y, z));
    if (!world.unsavedChunks) world.unsavedChunks = new Set();
    world.unsavedChunks.add(chunkKey3D(x, y, z));
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
    if (!entry.chunk.grassLevel) entry.chunk.grassLevel = new Uint8Array(entry.chunk.blocks.length);
    if (entry.chunk.blocks[entry.index] === id) return false;
    entry.chunk.blocks[entry.index] = id;
    entry.chunk.grassLevel[entry.index] = 0;
    const key = `${x},${y},${z}`;
    if (id === BLOCK.WATER || id === BLOCK.HOT_WATER || id === BLOCK.LAVA) {
      entry.chunk.fluidLevel[entry.index] = 0;
      if (id === BLOCK.WATER || id === BLOCK.HOT_WATER) {
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
    markChunkDirty3D(state, x, y - 1, z);
    markChunkModified3D(state, x, y, z);
    return true;
  }

  function getGrassLevel3D(state, x, y, z) {
    const world = state && state.world;
    if (!world || !inBounds3D(world, x, y, z)) return 0;
    const entry = getChunkForBlock3D(world, x, y, z, false);
    if (!entry) return 0;
    const id = entry.chunk.blocks[entry.index];
    if (id !== BLOCK.DIRT) return 0;
    return entry.chunk.grassLevel && entry.chunk.grassLevel[entry.index] ? 1 : 0;
  }

  function setGrassLevel3D(state, x, y, z, level, options = {}) {
    const world = state && state.world;
    if (!world || !inBounds3D(world, x, y, z)) return false;
    const entry = getChunkForBlock3D(world, x, y, z, false);
    if (!entry) return false;
    const id = entry.chunk.blocks[entry.index];
    if (id !== BLOCK.DIRT) return false;
    const next = level ? 1 : 0;
    const current = entry.chunk.grassLevel && entry.chunk.grassLevel[entry.index] ? 1 : 0;
    if (!entry.chunk.grassLevel) {
      const size = Game.constants3d.CHUNK_SIZE;
      entry.chunk.grassLevel = new Uint8Array(size * size * size);
    }
    if (current === next) return false;
    entry.chunk.grassLevel[entry.index] = next;
    markChunkDirty3D(state, x, y, z);
    if (!options.skipModified) markChunkModified3D(state, x, y, z);
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
    if (changed) {
      markChunkDirty3D(state, x, y, z);
      markChunkModified3D(state, x, y, z);
    }
    return changed;
  }

  function setWater3D(state, x, y, z, level = 0, source = false) {
    return setFluid3D(state, x, y, z, BLOCK.WATER, level, source);
  }

  function setLava3D(state, x, y, z, level = 0, source = false) {
    return setFluid3D(state, x, y, z, BLOCK.LAVA, level, source);
  }

  function setHotWater3D(state, x, y, z, level = 0, source = false) {
    return setFluid3D(state, x, y, z, BLOCK.HOT_WATER, level, source);
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
    return id !== BLOCK.AIR && id !== BLOCK.WATER && id !== BLOCK.HOT_WATER && id !== BLOCK.LAVA && id !== BLOCK.TORCH;
  }

  function pruneKeySetInChunk(set, bounds) {
    if (!set) return;
    for (const key of Array.from(set)) {
      const parts = key.split(',').map(Number);
      if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) continue;
      const [x, y, z] = parts;
      if (x >= bounds.minX && x < bounds.maxX && y >= bounds.minY && y < bounds.maxY && z >= bounds.minZ && z < bounds.maxZ) {
        set.delete(key);
      }
    }
  }

  function pruneObjectKeysInChunk(object, bounds) {
    if (!object) return;
    for (const key of Object.keys(object)) {
      const parts = key.split(',').map(Number);
      if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) continue;
      const [x, y, z] = parts;
      if (x >= bounds.minX && x < bounds.maxX && y >= bounds.minY && y < bounds.maxY && z >= bounds.minZ && z < bounds.maxZ) {
        delete object[key];
      }
    }
  }

  function removeChunk3D(state, cx, cy, cz, options = {}) {
    const world = state && state.world;
    if (!world || !world.chunks) return false;
    const size = Game.constants3d.CHUNK_SIZE;
    const key = chunkKeyFromCoords3D(cx, cy, cz);
    const chunk = world.chunks.get(key);
    if (!chunk) return false;
    const bounds = {
      minX: cx * size,
      minY: cy * size,
      minZ: cz * size,
      maxX: Math.min(world.w, (cx + 1) * size),
      maxY: Math.min(world.h, (cy + 1) * size),
      maxZ: Math.min(world.d, (cz + 1) * size),
    };
    world.chunks.delete(key);
    if (world.generatedChunks) world.generatedChunks.delete(key);
    if (options.clearModified && world.modifiedChunks) world.modifiedChunks.delete(key);
    if (options.clearModified && world.unsavedChunks) world.unsavedChunks.delete(key);
    if (world.dirtyChunks) world.dirtyChunks.add(key);
    pruneKeySetInChunk(world.waterSources, bounds);
    pruneKeySetInChunk(world.lavaSources, bounds);
    pruneObjectKeysInChunk(world.blockDamage, bounds);
    return true;
  }

  function rebuildChunkDerivedState3D(state, cx, cy, cz) {
    const world = state && state.world;
    const chunk = getChunk3D(world, cx, cy, cz, false);
    if (!world || !chunk) return false;
    const key = chunkKeyFromCoords3D(cx, cy, cz);
    const bounds = chunkBounds3D(world, cx, cy, cz);
    if (!bounds) return false;
    pruneKeySetInChunk(world.waterSources, bounds);
    pruneKeySetInChunk(world.lavaSources, bounds);
    pruneObjectKeysInChunk(world.blockDamage, bounds);
    const size = Game.constants3d.CHUNK_SIZE;
    for (let ly = 0; ly < size; ly += 1) {
      const y = cy * size + ly;
      if (y < 0 || y >= world.h) continue;
      for (let lz = 0; lz < size; lz += 1) {
        const z = cz * size + lz;
        if (z < 0 || z >= world.d) continue;
        for (let lx = 0; lx < size; lx += 1) {
          const x = cx * size + lx;
          if (x < 0 || x >= world.w) continue;
          const index = chunkLocalIndex3D(lx, ly, lz);
          const id = chunk.blocks[index];
          const sourceKey = `${x},${y},${z}`;
          if (id === BLOCK.WATER || id === BLOCK.HOT_WATER) world.waterSources.add(sourceKey);
          else if (id === BLOCK.LAVA) world.lavaSources.add(sourceKey);
        }
      }
    }
    if (world.dirtyChunks) world.dirtyChunks.add(key);
    return true;
  }

  function installChunkArrays3D(state, cx, cy, cz, blocks, fluidLevel, grassLevel = null, options = {}) {
    const world = state && state.world;
    if (!world || !inBounds3D(world, cx * Game.constants3d.CHUNK_SIZE, cy * Game.constants3d.CHUNK_SIZE, cz * Game.constants3d.CHUNK_SIZE)) return false;
    const key = chunkKeyFromCoords3D(cx, cy, cz);
    const chunk = getChunk3D(world, cx, cy, cz, true);
    chunk.blocks.set(blocks);
    chunk.fluidLevel.set(fluidLevel);
    if (!chunk.grassLevel) chunk.grassLevel = new Uint8Array(chunk.blocks.length);
    if (grassLevel) chunk.grassLevel.set(grassLevel);
    else chunk.grassLevel.fill(0);
    if (options.generated !== false) {
      if (!world.generatedChunks) world.generatedChunks = new Set();
      world.generatedChunks.add(key);
    }
    if (options.modified) {
      if (!world.modifiedChunks) world.modifiedChunks = new Set();
      world.modifiedChunks.add(key);
    }
    if (options.unsaved === false && world.unsavedChunks) world.unsavedChunks.delete(key);
    return rebuildChunkDerivedState3D(state, cx, cy, cz);
  }

  function installGeneratedChunk3D(state, cx, cy, cz, blocks, fluidLevel, grassLevel = null) {
    const world = state && state.world;
    const key = chunkKeyFromCoords3D(cx, cy, cz);
    if (world && world.generatedChunks && world.generatedChunks.has(key)) return false;
    if (world && world.modifiedChunks && world.modifiedChunks.has(key)) return false;
    return installChunkArrays3D(state, cx, cy, cz, blocks, fluidLevel, grassLevel, { generated: true, modified: false });
  }

  function installSavedChunk3D(state, cx, cy, cz, blocks, fluidLevel, savedState = {}) {
    const installed = installChunkArrays3D(state, cx, cy, cz, blocks, fluidLevel, savedState.grassLevel || null, { generated: true, modified: true, unsaved: false });
    if (!installed) return false;
    const world = state.world;
    const bounds = chunkBounds3D(world, cx, cy, cz);
    if (!bounds) return true;
    pruneKeySetInChunk(world.waterSources, bounds);
    pruneKeySetInChunk(world.lavaSources, bounds);
    pruneObjectKeysInChunk(world.blockDamage, bounds);
    for (const key of savedState.waterSources || []) world.waterSources.add(key);
    for (const key of savedState.lavaSources || []) world.lavaSources.add(key);
    for (const [key, value] of Object.entries(savedState.blockDamage || {})) world.blockDamage[key] = value;
    if (world.dirtyChunks) world.dirtyChunks.add(chunkKeyFromCoords3D(cx, cy, cz));
    return true;
  }

  function getChunkSnapshot3D(state, chunkKey) {
    const world = state && state.world;
    if (!world || !world.chunks) return null;
    const chunk = world.chunks.get(chunkKey);
    if (!chunk) return null;
    const bounds = chunkBounds3D(world, chunk.cx, chunk.cy, chunk.cz);
    const waterSources = [];
    const lavaSources = [];
    const blockDamage = {};
    const isInBounds = (key) => {
      if (!bounds) return false;
      const parts = key.split(',').map(Number);
      if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return false;
      const [x, y, z] = parts;
      return x >= bounds.minX && x < bounds.maxX && y >= bounds.minY && y < bounds.maxY && z >= bounds.minZ && z < bounds.maxZ;
    };
    for (const key of world.waterSources || []) {
      if (isInBounds(key)) waterSources.push(key);
    }
    for (const key of world.lavaSources || []) {
      if (isInBounds(key)) lavaSources.push(key);
    }
    for (const [key, value] of Object.entries(world.blockDamage || {})) {
      if (isInBounds(key)) blockDamage[key] = value;
    }
    return {
      cx: chunk.cx,
      cy: chunk.cy,
      cz: chunk.cz,
      blocks: chunk.blocks,
      fluidLevel: chunk.fluidLevel,
      grassLevel: chunk.grassLevel,
      waterSources,
      lavaSources,
      blockDamage,
    };
  }

  Game.world3d = {
    createWorld3D,
    clearWorld3D,
    getBlock3D,
    setBlock3D,
    getGrassLevel3D,
    setGrassLevel3D,
    getFluidLevel3D,
    getWaterLevel3D,
    getLavaLevel3D,
    setWater3D,
    setLava3D,
    setHotWater3D,
    isFluidSource3D,
    isWaterSource3D,
    isLavaSource3D,
    inBounds3D,
    isSolidBlock3D,
    index3D,
    chunkKey3D,
    markChunkDirty3D,
    removeChunk3D,
    installGeneratedChunk3D,
    installSavedChunk3D,
    getChunkSnapshot3D,
  };
})();
