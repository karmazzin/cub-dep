(() => {
  const SEA_LEVEL = 11;
  const CHUNK_SIZE = 16;

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
    return Math.hypot(x - world.w / 2, z - world.d / 2) >= distance;
  }

  function basinLiquidAt(seed, x, y, z, h, world, blockIds, options) {
    if (x <= 2 || z <= 2 || x >= world.w - 3 || z >= world.d - 3) return blockIds.AIR;
    if (!farFromSpawn(world, x, z, options.spawnDistance)) return blockIds.AIR;

    const feature = featureCenter(seed, x, z, options.cellSize, options.salt);
    if (noise2(seed + options.chanceSalt, feature.cellX, feature.cellZ) >= options.chance) return blockIds.AIR;

    const radius = options.minRadius + noise2(seed + options.radiusSalt, feature.cellX, feature.cellZ) * options.radiusRange;
    const dx = x - feature.x;
    const dz = z - feature.z;
    if (dx * dx + dz * dz > radius * radius) return blockIds.AIR;

    const centerH = terrainHeight(seed, feature.x, feature.z);
    if (centerH < options.minHeight) return blockIds.AIR;
    const liquidLevel = centerH + 1;
    if (h >= liquidLevel || y <= h || y > liquidLevel) return blockIds.AIR;

    const rim = Math.ceil(radius) + 2;
    const rimOffsets = [[rim, 0], [-rim, 0], [0, rim], [0, -rim], [rim, rim], [rim, -rim], [-rim, rim], [-rim, -rim]];
    for (const [rx, rz] of rimOffsets) {
      const sx = feature.x + rx;
      const sz = feature.z + rz;
      if (sx <= 1 || sz <= 1 || sx >= world.w - 2 || sz >= world.d - 2) return blockIds.AIR;
      if (terrainHeight(seed, sx, sz) < liquidLevel) return blockIds.AIR;
    }

    return options.block;
  }

  function surfaceLiquidAt(seed, x, y, z, h, world, blockIds) {
    const lava = basinLiquidAt(seed, x, y, z, h, world, blockIds, {
      block: blockIds.LAVA,
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
    if (lava !== blockIds.AIR) return lava;

    return basinLiquidAt(seed, x, y, z, h, world, blockIds, {
      block: blockIds.WATER,
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
    if (y <= 1 || y >= Math.min(10, h - 2)) return false;
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

  function terrainBlockAt(seed, x, y, z, world, blockIds) {
    const h = terrainHeight(seed, x, z);
    if (y === 0) return blockIds.BEDROCK;
    if (y <= h) {
      if (undergroundLavaAt(seed, x, y, z, h, world)) return blockIds.LAVA;
      if (y === h) return h <= SEA_LEVEL + 1 ? blockIds.SAND : blockIds.GRASS;
      if (y >= h - 3) return blockIds.DIRT;
      return blockIds.STONE;
    }
    if (x <= 0 || x >= world.w - 1 || z <= 0 || z >= world.d - 1) return blockIds.AIR;
    const surfaceLiquid = surfaceLiquidAt(seed, x, y, z, h, world, blockIds);
    if (surfaceLiquid !== blockIds.AIR) return surfaceLiquid;
    if (h < SEA_LEVEL && y <= SEA_LEVEL) return blockIds.WATER;
    return blockIds.AIR;
  }

  function localIndex(lx, ly, lz) {
    return lx + CHUNK_SIZE * (lz + CHUNK_SIZE * ly);
  }

  function generateChunk(message) {
    const { id, seed, world, blockIds, cx, cy, cz } = message;
    const blocks = new Uint16Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE);
    const fluidLevel = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE);
    fluidLevel.fill(255);

    const minX = cx * CHUNK_SIZE;
    const minY = cy * CHUNK_SIZE;
    const minZ = cz * CHUNK_SIZE;
    const maxX = Math.min(world.w, minX + CHUNK_SIZE);
    const maxY = Math.min(world.h, minY + CHUNK_SIZE);
    const maxZ = Math.min(world.d, minZ + CHUNK_SIZE);

    for (let y = minY; y < maxY; y += 1) {
      for (let z = minZ; z < maxZ; z += 1) {
        for (let x = minX; x < maxX; x += 1) {
          const index = localIndex(x - minX, y - minY, z - minZ);
          const block = terrainBlockAt(seed, x, y, z, world, blockIds);
          blocks[index] = block;
          if (block === blockIds.WATER || block === blockIds.LAVA) fluidLevel[index] = 0;
        }
      }
    }

    self.postMessage({ id, cx, cy, cz, blocks, fluidLevel }, [blocks.buffer, fluidLevel.buffer]);
  }

  self.onmessage = (event) => {
    if (!event || !event.data || event.data.type !== 'generate') return;
    generateChunk(event.data);
  };
})();
