(() => {
  const Game = window.CubDep;
  const { BLOCK } = Game.blocks;
  const { clearWorld3D, setBlock3D, getBlock3D, setWater3D, setLava3D, removeChunk3D, installGeneratedChunk3D, installSavedChunk3D, getChunkSnapshot3D } = Game.world3d;
  const {
    CHUNK_SIZE,
    CHUNK_RENDER_DISTANCE,
    CHUNK_UNLOAD_DISTANCE,
    CHUNK_START_SYNC_RADIUS,
    CHUNK_WORKER_MAX_PENDING,
    CHUNK_SYNC_GENERATE_BUDGET,
    CHUNK_DECORATE_BUDGET,
    CHUNK_UNLOAD_COLUMN_BUDGET,
    CHUNK_SAVE_BUDGET,
  } = Game.constants3d;

  const SEA_LEVEL = 11;
  let chunkWorker = null;
  let chunkWorkerAvailable = true;
  let nextWorkerJobId = 1;
  let activeState = null;

  function hash(seed) {
    let h = 2166136261;
    const text = String(seed || '3d');
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function noise2(seed, x, z) {
    let n = seed + Math.imul(x, 374761393) + Math.imul(z, 668265263);
    n = (n ^ (n >>> 13)) >>> 0;
    n = Math.imul(n, 1274126177) >>> 0;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  }

  function smoothNoise(seed, x, z) {
    const x0 = Math.floor(x);
    const z0 = Math.floor(z);
    const fx = x - x0;
    const fz = z - z0;
    const a = noise2(seed, x0, z0);
    const b = noise2(seed, x0 + 1, z0);
    const c = noise2(seed, x0, z0 + 1);
    const d = noise2(seed, x0 + 1, z0 + 1);
    const sx = fx * fx * (3 - 2 * fx);
    const sz = fz * fz * (3 - 2 * fz);
    return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sz;
  }

  function terrainHeight(seed, x, z) {
    const broad = smoothNoise(seed, x / 18, z / 18);
    const detail = smoothNoise(seed + 91, x / 6, z / 6);
    return Math.max(4, Math.min(24, Math.floor(10 + broad * 9 + detail * 3)));
  }

  function featureCenter(seed, x, z, cellSize, salt) {
    const cellX = Math.floor(x / cellSize);
    const cellZ = Math.floor(z / cellSize);
    const baseX = cellX * cellSize;
    const baseZ = cellZ * cellSize;
    return {
      cellX,
      cellZ,
      x: baseX + Math.floor(cellSize * (0.3 + noise2(seed + salt, cellX, cellZ) * 0.4)),
      z: baseZ + Math.floor(cellSize * (0.3 + noise2(seed + salt + 1, cellX, cellZ) * 0.4)),
    };
  }

  function farFromSpawn(world, x, z, distance) {
    if (!world) return true;
    return Math.hypot(x - world.w / 2, z - world.d / 2) >= distance;
  }

  function basinLiquidAt(seed, x, y, z, h, world, options) {
    if (!world || x <= 2 || z <= 2 || x >= world.w - 3 || z >= world.d - 3) return BLOCK.AIR;
    if (!farFromSpawn(world, x, z, options.spawnDistance)) return BLOCK.AIR;

    const feature = featureCenter(seed, x, z, options.cellSize, options.salt);
    if (noise2(seed + options.chanceSalt, feature.cellX, feature.cellZ) >= options.chance) return BLOCK.AIR;

    const radius = options.minRadius + noise2(seed + options.radiusSalt, feature.cellX, feature.cellZ) * options.radiusRange;
    const dx = x - feature.x;
    const dz = z - feature.z;
    if (dx * dx + dz * dz > radius * radius) return BLOCK.AIR;

    const centerH = terrainHeight(seed, feature.x, feature.z);
    if (centerH < options.minHeight) return BLOCK.AIR;
    const liquidLevel = centerH + 1;
    if (h >= liquidLevel || y <= h || y > liquidLevel) return BLOCK.AIR;

    const rim = Math.ceil(radius) + 2;
    const rimOffsets = [[rim, 0], [-rim, 0], [0, rim], [0, -rim], [rim, rim], [rim, -rim], [-rim, rim], [-rim, -rim]];
    for (const [rx, rz] of rimOffsets) {
      const sx = feature.x + rx;
      const sz = feature.z + rz;
      if (sx <= 1 || sz <= 1 || sx >= world.w - 2 || sz >= world.d - 2) return BLOCK.AIR;
      if (terrainHeight(seed, sx, sz) < liquidLevel) return BLOCK.AIR;
    }

    return options.block;
  }

  function surfaceLiquidAt(seed, x, y, z, h, world) {
    const lava = basinLiquidAt(seed, x, y, z, h, world, {
      block: BLOCK.LAVA,
      cellSize: 32,
      salt: 1701,
      chanceSalt: 1703,
      radiusSalt: 1705,
      chance: 0.018,
      minRadius: 1.35,
      radiusRange: 1.1,
      minHeight: SEA_LEVEL + 3,
      spawnDistance: 18,
    });
    if (lava !== BLOCK.AIR) return lava;

    return basinLiquidAt(seed, x, y, z, h, world, {
      block: BLOCK.WATER,
      cellSize: 22,
      salt: 1301,
      chanceSalt: 1303,
      radiusSalt: 1305,
      chance: 0.04,
      minRadius: 1.8,
      radiusRange: 1.7,
      minHeight: SEA_LEVEL + 2,
      spawnDistance: 18,
    });
  }

  function undergroundLavaAt(seed, x, y, z, h, world) {
    if (!world || y <= 1 || y >= Math.min(10, h - 2)) return false;
    if (!farFromSpawn(world, x, z, 24)) return false;
    const lava = featureCenter(seed, x, z, 18, 1901);
    if (noise2(seed + 1903, lava.cellX, lava.cellZ) >= 0.055) return false;
    const centerY = 3 + Math.floor(noise2(seed + 1905, lava.cellX, lava.cellZ) * 5);
    const radius = 1.45 + noise2(seed + 1907, lava.cellX, lava.cellZ) * 1.35;
    const dx = x - lava.x;
    const dy = (y - centerY) * 1.25;
    const dz = z - lava.z;
    return dx * dx + dy * dy + dz * dz <= radius * radius;
  }

  function worldSeed(state) {
    return hash(state.worldMeta.seed || state.worldMeta.name || Date.now());
  }

  function terrainBlockAt(seed, x, y, z, world = null) {
    const h = terrainHeight(seed, x, z);
    if (y === 0) return BLOCK.BEDROCK;
    if (y <= h) {
      if (undergroundLavaAt(seed, x, y, z, h, world)) return BLOCK.LAVA;
      if (y === h) return h <= SEA_LEVEL + 1 ? BLOCK.SAND : BLOCK.GRASS;
      if (y >= h - 3) return BLOCK.DIRT;
      return BLOCK.STONE;
    }
    if (world && (x <= 0 || x >= world.w - 1 || z <= 0 || z >= world.d - 1)) return BLOCK.AIR;
    const surfaceLiquid = surfaceLiquidAt(seed, x, y, z, h, world);
    if (surfaceLiquid !== BLOCK.AIR) return surfaceLiquid;
    if (h < SEA_LEVEL && y <= SEA_LEVEL) return BLOCK.WATER;
    return BLOCK.AIR;
  }

  function chunkBounds(world, cx, cy, cz) {
    const minX = cx * CHUNK_SIZE;
    const minY = cy * CHUNK_SIZE;
    const minZ = cz * CHUNK_SIZE;
    if (minX >= world.w || minY >= world.h || minZ >= world.d || minX < 0 || minY < 0 || minZ < 0) return null;
    return {
      minX,
      minY,
      minZ,
      maxX: Math.min(world.w, minX + CHUNK_SIZE),
      maxY: Math.min(world.h, minY + CHUNK_SIZE),
      maxZ: Math.min(world.d, minZ + CHUNK_SIZE),
    };
  }

  function chunkKey(cx, cy, cz) {
    return `${cx},${cy},${cz}`;
  }

  function columnKey(cx, cz) {
    return `${cx},${cz}`;
  }

  function chunkCounts(world) {
    return {
      x: Math.ceil(world.w / CHUNK_SIZE),
      y: Math.ceil(world.h / CHUNK_SIZE),
      z: Math.ceil(world.d / CHUNK_SIZE),
    };
  }

  function ensureChunkLoading(state) {
    const world = state && state.world;
    if (!world.chunkLoading) {
      world.chunkLoading = {
        queue: [],
        queued: new Set(),
        pendingIds: new Map(),
        pendingKeys: new Set(),
        loadingSaved: new Set(),
        saving: new Set(),
      };
    }
    return world.chunkLoading;
  }

  function initChunkWorker(state) {
    if (!chunkWorkerAvailable || chunkWorker || typeof Worker === 'undefined') return false;
    try {
      chunkWorker = new Worker('./src/3d/chunkWorker3d.js');
      chunkWorker.onmessage = (event) => {
        const data = event && event.data ? event.data : null;
        const stateRef = activeState;
        if (!data || !stateRef || !stateRef.world) return;
        const loading = ensureChunkLoading(stateRef);
        const job = loading.pendingIds.get(data.id);
        if (!job) return;
        loading.pendingIds.delete(data.id);
        loading.pendingKeys.delete(job.key);
        if (job.worldId !== stateRef.worldMeta.id || job.seed !== worldSeed(stateRef)) return;
        installGeneratedChunk3D(stateRef, data.cx, data.cy, data.cz, data.blocks, data.fluidLevel);
      };
      chunkWorker.onerror = () => {
        const stateRef = activeState;
        if (stateRef && stateRef.world && stateRef.world.chunkLoading) {
          const loading = stateRef.world.chunkLoading;
          for (const job of loading.pendingIds.values()) {
            if (!loading.queued.has(job.key)) {
              const parts = job.key.split(',').map(Number);
              if (parts.length === 3 && parts.every((part) => Number.isFinite(part))) {
                loading.queue.unshift({ cx: parts[0], cy: parts[1], cz: parts[2], key: job.key });
                loading.queued.add(job.key);
              }
            }
          }
          loading.pendingIds.clear();
          loading.pendingKeys.clear();
        }
        chunkWorkerAvailable = false;
        if (chunkWorker) {
          chunkWorker.terminate();
          chunkWorker = null;
        }
      };
    } catch (error) {
      chunkWorkerAvailable = false;
      chunkWorker = null;
    }
    return !!chunkWorker;
  }

  function hasTerrainChunk(state, cx, cy, cz) {
    const key = chunkKey(cx, cy, cz);
    return !!((state.world.generatedChunks && state.world.generatedChunks.has(key)) || (state.world.modifiedChunks && state.world.modifiedChunks.has(key)));
  }

  function queueTerrainChunk3D(state, cx, cy, cz) {
    if (hasTerrainChunk(state, cx, cy, cz)) return false;
    const loading = ensureChunkLoading(state);
    const key = chunkKey(cx, cy, cz);
    if (loading.queued.has(key) || loading.pendingKeys.has(key) || loading.loadingSaved.has(key)) return false;
    loading.queue.push({ cx, cy, cz, key });
    loading.queued.add(key);
    return true;
  }

  function loadSavedChunkJob(state, job) {
    const storage = Game.storage3d;
    const loading = ensureChunkLoading(state);
    if (!storage || !storage.isAvailable || !storage.isAvailable() || !state.world.savedChunks || !state.world.savedChunks.has(job.key)) return false;
    loading.loadingSaved.add(job.key);
    storage.loadChunkSnapshot(state.worldMeta.id, job.key).then((snapshot) => {
      loading.loadingSaved.delete(job.key);
      if (!snapshot) {
        if (state.world.savedChunks) state.world.savedChunks.delete(job.key);
        if (!hasTerrainChunk(state, job.cx, job.cy, job.cz) && !loading.queued.has(job.key) && !loading.pendingKeys.has(job.key)) {
          loading.queue.unshift(job);
          loading.queued.add(job.key);
        }
        return;
      }
      installSavedChunk3D(state, snapshot.cx, snapshot.cy, snapshot.cz, snapshot.blocks, snapshot.fluidLevel, snapshot);
    });
    return true;
  }

  function queueChunksAroundPlayer3D(state, radius) {
    const counts = chunkCounts(state.world);
    const loading = ensureChunkLoading(state);
    const pcx = Math.floor(state.player.x / CHUNK_SIZE);
    const pcz = Math.floor(state.player.z / CHUNK_SIZE);
    const candidates = [];
    for (let cz = Math.max(0, pcz - radius); cz < Math.min(counts.z, pcz + radius + 1); cz += 1) {
      for (let cx = Math.max(0, pcx - radius); cx < Math.min(counts.x, pcx + radius + 1); cx += 1) {
        const dx = cx - pcx;
        const dz = cz - pcz;
        const distanceSq = dx * dx + dz * dz;
        if (distanceSq > radius * radius) continue;
        for (let cy = 0; cy < counts.y; cy += 1) {
          candidates.push({ cx, cy, cz, distanceSq });
        }
      }
    }
    candidates.sort((a, b) => a.distanceSq - b.distanceSq || a.cy - b.cy);
    let queued = 0;
    for (const item of candidates) {
      if (queueTerrainChunk3D(state, item.cx, item.cy, item.cz)) queued += 1;
    }
    loading.queue = loading.queue.filter((job) => {
      const dx = job.cx - pcx;
      const dz = job.cz - pcz;
      const keep = dx * dx + dz * dz <= CHUNK_UNLOAD_DISTANCE * CHUNK_UNLOAD_DISTANCE;
      if (!keep) loading.queued.delete(job.key);
      return keep;
    });
    loading.queue.sort((a, b) => {
      const adx = a.cx - pcx;
      const adz = a.cz - pcz;
      const bdx = b.cx - pcx;
      const bdz = b.cz - pcz;
      return (adx * adx + adz * adz) - (bdx * bdx + bdz * bdz) || a.cy - b.cy;
    });
    return queued;
  }

  function postWorkerChunkJob(state, job, seed) {
    const loading = ensureChunkLoading(state);
    const id = nextWorkerJobId;
    nextWorkerJobId += 1;
    loading.pendingIds.set(id, {
      key: job.key,
      worldId: state.worldMeta.id,
      seed,
    });
    loading.pendingKeys.add(job.key);
    chunkWorker.postMessage({
      type: 'generate',
      id,
      seed,
      world: { w: state.world.w, h: state.world.h, d: state.world.d },
      blockIds: BLOCK,
      cx: job.cx,
      cy: job.cy,
      cz: job.cz,
    });
  }

  function processTerrainQueue3D(state, seed) {
    const loading = ensureChunkLoading(state);
    let processed = 0;
    activeState = state;

    if (initChunkWorker(state)) {
      while (loading.queue.length > 0 && loading.pendingIds.size < CHUNK_WORKER_MAX_PENDING) {
        const job = loading.queue.shift();
        loading.queued.delete(job.key);
        if (hasTerrainChunk(state, job.cx, job.cy, job.cz)) continue;
        if (loadSavedChunkJob(state, job)) {
          processed += 1;
          continue;
        }
        postWorkerChunkJob(state, job, seed);
        processed += 1;
      }
      state.world.lastQueuedChunks = loading.queue.length;
      state.world.lastPendingChunks = loading.pendingIds.size + loading.loadingSaved.size;
      return processed;
    }

    while (loading.queue.length > 0 && processed < CHUNK_SYNC_GENERATE_BUDGET) {
      const job = loading.queue.shift();
      loading.queued.delete(job.key);
      if (loadSavedChunkJob(state, job)) {
        processed += 1;
        continue;
      }
      if (generateTerrainChunk3D(state, seed, job.cx, job.cy, job.cz)) {
        state.world.dirtyChunks.add(job.key);
        processed += 1;
      }
    }
    state.world.lastQueuedChunks = loading.queue.length;
    state.world.lastPendingChunks = 0;
    return processed;
  }

  function processChunkSaves3D(state, budget = CHUNK_SAVE_BUDGET) {
    const storage = Game.storage3d;
    const world = state && state.world;
    if (!storage || !storage.isAvailable || !storage.isAvailable() || !world || !world.unsavedChunks) return 0;
    const loading = ensureChunkLoading(state);
    let started = 0;
    for (const key of Array.from(world.unsavedChunks)) {
      if (started >= budget) break;
      if (loading.saving.has(key)) continue;
      const snapshot = getChunkSnapshot3D(state, key);
      if (!snapshot) {
        world.unsavedChunks.delete(key);
        continue;
      }
      loading.saving.add(key);
      started += 1;
      storage.saveChunkSnapshot(state.worldMeta.id, key, snapshot).then((saved) => {
        loading.saving.delete(key);
        if (!saved) return;
        world.unsavedChunks.delete(key);
        if (!world.savedChunks) world.savedChunks = new Set();
        world.savedChunks.add(key);
        if (state.worldMeta) {
          state.worldMeta.updatedAt = Date.now();
          if (Game.storage3d && Game.storage3d.saveWorldMeta) Game.storage3d.saveWorldMeta(state.worldMeta);
        }
      });
    }
    world.lastUnsavedChunks = world.unsavedChunks.size;
    world.lastSavingChunks = loading.saving.size;
    return started;
  }

  function generateTerrainChunk3D(state, seed, cx, cy, cz) {
    const bounds = chunkBounds(state.world, cx, cy, cz);
    if (!bounds) return false;
    const key = chunkKey(cx, cy, cz);
    if (state.world.generatedChunks && state.world.generatedChunks.has(key)) return false;
    if (state.world.modifiedChunks && state.world.modifiedChunks.has(key)) return false;
    if (state.world.savedChunks && state.world.savedChunks.has(key)) return false;
    state.world.suppressChunkModification = (state.world.suppressChunkModification || 0) + 1;
    try {
      for (let y = bounds.minY; y < bounds.maxY; y += 1) {
        for (let z = bounds.minZ; z < bounds.maxZ; z += 1) {
          for (let x = bounds.minX; x < bounds.maxX; x += 1) {
            const block = terrainBlockAt(seed, x, y, z, state.world);
            if (block === BLOCK.WATER) setWater3D(state, x, y, z, 0, true);
            else if (block === BLOCK.LAVA) setLava3D(state, x, y, z, 0, true);
            else setBlock3D(state, x, y, z, block);
          }
        }
      }
    } finally {
      state.world.suppressChunkModification -= 1;
    }
    if (!state.world.generatedChunks) state.world.generatedChunks = new Set();
    state.world.generatedChunks.add(key);
    return true;
  }

  function isTerrainColumnGenerated(world, cx, cz, counts) {
    if (cx < 0 || cz < 0 || cx >= counts.x || cz >= counts.z) return false;
    if (!world.generatedChunks) return false;
    for (let cy = 0; cy < counts.y; cy += 1) {
      if (!world.generatedChunks.has(chunkKey(cx, cy, cz))) return false;
    }
    return true;
  }

  function isDecorationReady(world, cx, cz, counts) {
    if (!isTerrainColumnGenerated(world, cx, cz, counts)) return false;
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= counts.x || nz >= counts.z) continue;
        if (!isTerrainColumnGenerated(world, nx, nz, counts)) return false;
      }
    }
    return true;
  }

  function canPlaceTree(state, x, groundY, z, height) {
    const world = state.world;
    if (x < 3 || x >= world.w - 3 || z < 3 || z >= world.d - 3) return false;
    if (groundY + height + 3 >= world.h) return false;
    const spawnX = Math.floor(world.w / 2);
    const spawnZ = Math.floor(world.d / 2);
    if (Math.hypot(x - spawnX, z - spawnZ) < 8) return false;
    if (getBlock3D(state, x, groundY, z) !== BLOCK.GRASS) return false;
    for (let y = groundY + 1; y <= groundY + height + 3; y += 1) {
      for (let zz = z - 2; zz <= z + 2; zz += 1) {
        for (let xx = x - 2; xx <= x + 2; xx += 1) {
          if (getBlock3D(state, xx, y, zz) !== BLOCK.AIR) return false;
        }
      }
    }
    return true;
  }

  function placeTree(state, seed, x, groundY, z) {
    const height = 4 + Math.floor(noise2(seed + 511, x, z) * 3);
    if (!canPlaceTree(state, x, groundY, z, height)) return false;
    for (let y = groundY + 1; y <= groundY + height; y += 1) {
      setBlock3D(state, x, y, z, BLOCK.WOOD);
    }
    const crownY = groundY + height;
    for (let yy = crownY - 1; yy <= crownY + 2; yy += 1) {
      const layerRadius = yy >= crownY + 2 ? 1 : 2;
      for (let zz = z - layerRadius; zz <= z + layerRadius; zz += 1) {
        for (let xx = x - layerRadius; xx <= x + layerRadius; xx += 1) {
          const dx = Math.abs(xx - x);
          const dz = Math.abs(zz - z);
          const corner = dx === layerRadius && dz === layerRadius;
          if (corner && noise2(seed + 907, xx, zz + yy) < 0.42) continue;
          if (getBlock3D(state, xx, yy, zz) === BLOCK.AIR) setBlock3D(state, xx, yy, zz, BLOCK.LEAF);
        }
      }
    }
    return true;
  }

  function canPlaceSheep(state, x, groundY, z) {
    const world = state.world;
    if (x < 2 || x >= world.w - 2 || z < 2 || z >= world.d - 2) return false;
    if (!farFromSpawn(world, x, z, 18)) return false;
    if (getBlock3D(state, x, groundY, z) !== BLOCK.GRASS) return false;
    return getBlock3D(state, x, groundY + 1, z) === BLOCK.AIR && getBlock3D(state, x, groundY + 2, z) === BLOCK.AIR;
  }

  function findSheepGround(state, centerX, centerZ) {
    const world = state.world;
    for (let radius = 0; radius <= 3; radius += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
          const x = centerX + dx;
          const z = centerZ + dz;
          if (x < 2 || x >= world.w - 2 || z < 2 || z >= world.d - 2) continue;
          for (let y = world.h - 2; y >= 1; y -= 1) {
            if (canPlaceSheep(state, x, y, z)) return { x, y, z };
            if (getBlock3D(state, x, y, z) !== BLOCK.AIR) break;
          }
        }
      }
    }
    return null;
  }

  function hasSheep(state, id) {
    const sheep = state.entities && Array.isArray(state.entities.sheep) ? state.entities.sheep : [];
    return sheep.some((item) => item.id === id);
  }

  function generateSheepForColumn(state, seed, cx, cz, bounds) {
    if (!state.entities) state.entities = {};
    if (!Array.isArray(state.entities.sheep)) state.entities.sheep = [];

    const cellSize = 18;
    const minCellX = Math.floor(bounds.minX / cellSize);
    const maxCellX = Math.floor((bounds.maxX - 1) / cellSize);
    const minCellZ = Math.floor(bounds.minZ / cellSize);
    const maxCellZ = Math.floor((bounds.maxZ - 1) / cellSize);

    for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ += 1) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
        if (noise2(seed + 2301, cellX, cellZ) > 0.08) continue;
        const x = cellX * cellSize + Math.floor(4 + noise2(seed + 2303, cellX, cellZ) * (cellSize - 8));
        const z = cellZ * cellSize + Math.floor(4 + noise2(seed + 2305, cellX, cellZ) * (cellSize - 8));
        if (x < bounds.minX || x >= bounds.maxX || z < bounds.minZ || z >= bounds.maxZ) continue;
        const id = `sheep-${cellX}-${cellZ}`;
        if (hasSheep(state, id)) continue;
        const ground = findSheepGround(state, x, z);
        if (!ground) continue;
        state.entities.sheep.push({
          id,
          type: 'sheep',
          x: ground.x + 0.5,
          y: ground.y + 1,
          z: ground.z + 0.5,
          yaw: noise2(seed + 2307, cellX, cellZ) * Math.PI * 2,
        });
      }
    }
  }

  function decorateColumn3D(state, seed, cx, cz) {
    const world = state.world;
    const counts = chunkCounts(world);
    if (!world.decoratedColumns) world.decoratedColumns = new Set();
    const key = columnKey(cx, cz);
    if (world.decoratedColumns.has(key)) return false;
    if (!isDecorationReady(world, cx, cz, counts)) return false;

    const bounds = {
      minX: cx * CHUNK_SIZE,
      minZ: cz * CHUNK_SIZE,
      maxX: Math.min(world.w, (cx + 1) * CHUNK_SIZE),
      maxZ: Math.min(world.d, (cz + 1) * CHUNK_SIZE),
    };

    world.suppressChunkModification = (world.suppressChunkModification || 0) + 1;
    try {
      for (let x = Math.max(4, bounds.minX); x < Math.min(world.w - 4, bounds.maxX); x += 1) {
        for (let z = Math.max(4, bounds.minZ); z < Math.min(world.d - 4, bounds.maxZ); z += 1) {
          if (noise2(seed + 303, x, z) > 0.028) continue;
          let groundY = 0;
          for (let y = world.h - 2; y >= 1; y -= 1) {
            if (getBlock3D(state, x, y, z) !== BLOCK.AIR) {
              groundY = y;
              break;
            }
          }
          placeTree(state, seed, x, groundY, z);
        }
      }
    } finally {
      world.suppressChunkModification -= 1;
    }

    generateSheepForColumn(state, seed, cx, cz, bounds);
    world.decoratedColumns.add(key);
    return true;
  }

  function decorateReadyColumnsAround(state, seed, pcx, pcz, radius, budget = CHUNK_DECORATE_BUDGET) {
    const counts = chunkCounts(state.world);
    let decorated = 0;
    const candidates = [];
    for (let cz = Math.max(0, pcz - radius); cz < Math.min(counts.z, pcz + radius + 1); cz += 1) {
      for (let cx = Math.max(0, pcx - radius); cx < Math.min(counts.x, pcx + radius + 1); cx += 1) {
        const dx = cx - pcx;
        const dz = cz - pcz;
        const distanceSq = dx * dx + dz * dz;
        if (distanceSq > radius * radius) continue;
        candidates.push({ cx, cz, distanceSq });
      }
    }
    candidates.sort((a, b) => a.distanceSq - b.distanceSq);
    for (const item of candidates) {
      if (decorated >= budget) break;
      if (decorateColumn3D(state, seed, item.cx, item.cz)) decorated += 1;
    }
    state.world.lastDecoratedColumns = decorated;
    return decorated;
  }

  function isColumnProtectedFromUnload(state, cx, cz, counts) {
    const world = state.world;
    const loading = ensureChunkLoading(state);
    if (!world.modifiedChunks) return false;
    for (let cy = 0; cy < counts.y; cy += 1) {
      const key = chunkKey(cx, cy, cz);
      if (!world.modifiedChunks.has(key)) continue;
      if (!world.savedChunks || !world.savedChunks.has(key)) return true;
      if (world.unsavedChunks && world.unsavedChunks.has(key)) return true;
      if (loading.saving && loading.saving.has(key)) return true;
    }
    return false;
  }

  function clearNearbyDecorationFlags(world, cx, cz) {
    if (!world.decoratedColumns) return;
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        world.decoratedColumns.delete(columnKey(cx + dx, cz + dz));
      }
    }
  }

  function removeSheepInColumn(state, cx, cz) {
    const sheep = state.entities && Array.isArray(state.entities.sheep) ? state.entities.sheep : null;
    if (!sheep) return 0;
    const before = sheep.length;
    state.entities.sheep = sheep.filter((item) => Math.floor(item.x / CHUNK_SIZE) !== cx || Math.floor(item.z / CHUNK_SIZE) !== cz);
    return before - state.entities.sheep.length;
  }

  function unloadDistantChunks3D(state, radius = CHUNK_UNLOAD_DISTANCE, budget = CHUNK_UNLOAD_COLUMN_BUDGET) {
    if (!state || !state.world || !state.player || !state.world.chunks) return 0;
    const world = state.world;
    const counts = chunkCounts(world);
    const pcx = Math.floor(state.player.x / CHUNK_SIZE);
    const pcz = Math.floor(state.player.z / CHUNK_SIZE);
    const columns = new Map();

    for (const key of world.chunks.keys()) {
      const parts = key.split(',').map(Number);
      if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) continue;
      const [cx, cy, cz] = parts;
      const dx = cx - pcx;
      const dz = cz - pcz;
      if (dx * dx + dz * dz <= radius * radius) continue;
      const column = columnKey(cx, cz);
      if (!columns.has(column)) columns.set(column, { cx, cz, cy: [] });
      columns.get(column).cy.push(cy);
    }

    let unloaded = 0;
    let unloadedColumns = 0;
    for (const column of columns.values()) {
      if (unloadedColumns >= budget) break;
      if (isColumnProtectedFromUnload(state, column.cx, column.cz, counts)) continue;
      clearNearbyDecorationFlags(world, column.cx, column.cz);
      removeSheepInColumn(state, column.cx, column.cz);
      for (let cy = 0; cy < counts.y; cy += 1) {
        if (removeChunk3D(state, column.cx, cy, column.cz, { clearModified: true })) unloaded += 1;
      }
      unloadedColumns += 1;
    }
    world.lastUnloadedChunks = unloaded;
    return unloaded;
  }

  function generateChunksAroundPlayerSync3D(state, seed, radius) {
    const counts = chunkCounts(state.world);
    const pcx = Math.floor(state.player.x / CHUNK_SIZE);
    const pcz = Math.floor(state.player.z / CHUNK_SIZE);
    let generated = 0;
    for (let cz = Math.max(0, pcz - radius); cz < Math.min(counts.z, pcz + radius + 1); cz += 1) {
      for (let cx = Math.max(0, pcx - radius); cx < Math.min(counts.x, pcx + radius + 1); cx += 1) {
        const dx = cx - pcx;
        const dz = cz - pcz;
        if (dx * dx + dz * dz > radius * radius) continue;
        for (let cy = 0; cy < counts.y; cy += 1) {
          if (generateTerrainChunk3D(state, seed, cx, cy, cz)) {
            state.world.dirtyChunks.add(chunkKey(cx, cy, cz));
            generated += 1;
          }
        }
      }
    }
    return generated;
  }

  function generateChunk3D(state, cx, cy, cz) {
    const seed = worldSeed(state);
    const changed = generateTerrainChunk3D(state, seed, cx, cy, cz);
    if (!changed) return false;
    state.world.dirtyChunks.add(chunkKey(cx, cy, cz));
    return true;
  }

  function ensureChunksAroundPlayer3D(state, radius = CHUNK_RENDER_DISTANCE) {
    if (!state || !state.world || !state.player) return 0;
    const seed = worldSeed(state);
    const pcx = Math.floor(state.player.x / CHUNK_SIZE);
    const pcz = Math.floor(state.player.z / CHUNK_SIZE);
    let generated = 0;
    queueChunksAroundPlayer3D(state, radius);
    generated += processTerrainQueue3D(state, seed);
    generated += decorateReadyColumnsAround(state, seed, pcx, pcz, radius);
    processChunkSaves3D(state);
    unloadDistantChunks3D(state);
    return generated;
  }

  function generateWorld3D(state) {
    const seed = worldSeed(state);
    const world = state.world;
    const savedChunks = new Set(world.savedChunks || []);
    const savedPlayer = state.worldMeta && state.worldMeta.player ? state.worldMeta.player : null;
    const hasSavedPlayer = !!(savedPlayer && Number.isFinite(savedPlayer.x) && Number.isFinite(savedPlayer.y) && Number.isFinite(savedPlayer.z));
    activeState = state;
    clearWorld3D(state);
    state.world.savedChunks = savedChunks;
    if (!state.entities) state.entities = {};
    state.entities.sheep = [];

    if (hasSavedPlayer) {
      state.player.x = Math.max(0.5, Math.min(world.w - 0.5, savedPlayer.x));
      state.player.y = Math.max(1, Math.min(world.h + 4, savedPlayer.y));
      state.player.z = Math.max(0.5, Math.min(world.d - 0.5, savedPlayer.z));
      if (Number.isFinite(savedPlayer.yaw)) state.player.yaw = savedPlayer.yaw;
      if (Number.isFinite(savedPlayer.pitch)) state.player.pitch = savedPlayer.pitch;
    }

    generateChunksAroundPlayerSync3D(state, seed, CHUNK_START_SYNC_RADIUS);

    if (!hasSavedPlayer) {
      const spawnX = Math.floor(world.w / 2);
      const spawnZ = Math.floor(world.d / 2);
      let spawnY = world.h - 2;
      for (let y = world.h - 2; y >= 1; y -= 1) {
        if (getBlock3D(state, spawnX, y, spawnZ) !== BLOCK.AIR) {
          spawnY = y + 2;
          break;
        }
      }
      state.player.x = spawnX + 0.5;
      state.player.y = spawnY;
      state.player.z = spawnZ + 0.5;
    }
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.vz = 0;
    ensureChunksAroundPlayer3D(state, CHUNK_RENDER_DISTANCE);
    state.world.dirtyAll = false;
  }

  Game.generation3d = { generateWorld3D, generateChunk3D, ensureChunksAroundPlayer3D, unloadDistantChunks3D };
})();
