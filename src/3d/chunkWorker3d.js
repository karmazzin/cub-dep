(() => {
  const WATER_LEVEL = 14;
  const SNOW_LEVEL = 48;
  const DRY_MOUNTAIN_LEVEL = 36;
  const CHUNK_SIZE = 16;
  const BIOME_TRANSITION_RADIUS = 18;
  const BIOME_TRANSITION_OFFSETS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

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

  function smoothstep(edge0, edge1, value) {
    const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  function mountainNoise(seed, x, z) {
    return smoothNoise(seed + 710, x / 170, z / 170);
  }

  function mountainStrength(seed, x, z) {
    return smoothstep(0.56, 0.76, mountainNoise(seed, x, z));
  }

  function lowlandBiome(seed, x, z) {
    const moisture = smoothNoise(seed + 721, x / 210, z / 210);
    const heat = smoothNoise(seed + 733, x / 230, z / 230);
    if (heat > 0.58 && moisture < 0.43) return 'desert';
    if (moisture > 0.58) return 'forest';
    return 'plains';
  }

  function baseLandBiome(seed, x, z) {
    if (mountainStrength(seed, x, z) > 0.62) return 'mountains';
    return lowlandBiome(seed, x, z);
  }

  function baseBiomeInfluence(seed, x, z, target, radius = BIOME_TRANSITION_RADIUS) {
    let count = 0;
    for (const [dx, dz] of BIOME_TRANSITION_OFFSETS) {
      if (baseLandBiome(seed, x + dx * radius, z + dz * radius) === target) count += 1;
    }
    return count / BIOME_TRANSITION_OFFSETS.length;
  }

  function geyserValleyInfo(seed, x, z) {
    if (mountainStrength(seed, x, z) < 0.58) return { inValley: false, edge: 99 };
    const cellSize = 320;
    const cellX = Math.floor(x / cellSize);
    const cellZ = Math.floor(z / cellSize);
    let best = null;
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const cx = cellX + dx;
        const cz = cellZ + dz;
        if (noise2(seed + 2601, cx, cz) > 0.12) continue;
        const centerX = cx * cellSize + Math.floor(cellSize * (0.28 + noise2(seed + 2603, cx, cz) * 0.44));
        const centerZ = cz * cellSize + Math.floor(cellSize * (0.28 + noise2(seed + 2605, cx, cz) * 0.44));
        if (mountainStrength(seed, centerX, centerZ) < 0.62) continue;
        const radius = 22 + noise2(seed + 2607, cx, cz) * 34;
        const edgeNoise = (smoothNoise(seed + 2609, x / 20, z / 20) - 0.5) * 8;
        const dist = Math.hypot(x - centerX, z - centerZ) + edgeNoise;
        if (dist > radius) continue;
        const edge = radius - dist;
        if (!best || edge > best.edge) best = { inValley: true, edge };
      }
    }
    return best || { inValley: false, edge: 99 };
  }

  function dryTransitionSurface(seed, x, z, biome, blockIds) {
    if (biome === 'lake' || biome === 'beach' || biome === 'mountains' || biome === 'geysers') return blockIds.AIR;
    const desert = baseBiomeInfluence(seed, x, z, 'desert');
    const green = baseBiomeInfluence(seed, x, z, 'plains') + baseBiomeInfluence(seed, x, z, 'forest');
    const noise = smoothNoise(seed + 913, x / 5, z / 5);
    if (biome === 'desert' && green > 0.12) {
      if (noise < green * 0.18) return blockIds.RED_EARTH;
      return blockIds.SAND;
    }
    if (biome !== 'desert' && desert > 0.12 && mountainStrength(seed, x, z) < 0.38) {
      if (noise < desert * 0.34) return blockIds.SAND;
      if (noise < desert * 0.58) return blockIds.RED_EARTH;
    }
    return blockIds.AIR;
  }

  function lakeInfo(seed, x, z) {
    if (mountainStrength(seed, x, z) > 0.5) return { inLake: false, shore: false, depth: 0, edge: 99 };
    const cellSize = 256;
    const cellX = Math.floor(x / cellSize);
    const cellZ = Math.floor(z / cellSize);
    let best = null;
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const cx = cellX + dx;
        const cz = cellZ + dz;
        const roll = noise2(seed + 811, cx, cz);
        if (roll > 0.46) continue;
        const large = noise2(seed + 812, cx, cz);
        const radius = large > 0.9
          ? 80 + noise2(seed + 813, cx, cz) * 80
          : (large > 0.55 ? 44 + noise2(seed + 814, cx, cz) * 42 : 24 + noise2(seed + 815, cx, cz) * 18);
        const centerX = cx * cellSize + Math.floor(cellSize * (0.25 + noise2(seed + 816, cx, cz) * 0.5));
        const centerZ = cz * cellSize + Math.floor(cellSize * (0.25 + noise2(seed + 817, cx, cz) * 0.5));
        const edgeNoise = (smoothNoise(seed + 818, x / 28, z / 28) - 0.5) * 10;
        const dist = Math.hypot(x - centerX, z - centerZ) + edgeNoise;
        if (dist > radius + 10) continue;
        const score = dist - radius;
        if (!best || score < best.score) best = { score, dist, radius, centerX, centerZ };
      }
    }
    if (!best) return { inLake: false, shore: false, depth: 0, edge: 99 };
    const rimRadius = Math.ceil(best.radius + 11);
    const rimOffsets = [[rimRadius, 0], [-rimRadius, 0], [0, rimRadius], [0, -rimRadius], [rimRadius, rimRadius], [rimRadius, -rimRadius], [-rimRadius, rimRadius], [-rimRadius, -rimRadius]];
    let lowRimCount = 0;
    for (const [rx, rz] of rimOffsets) {
      if (terrainHeight(seed, best.centerX + rx, best.centerZ + rz) <= WATER_LEVEL) lowRimCount += 1;
    }
    if (lowRimCount > 1) return { inLake: false, shore: false, depth: 0, edge: 99 };
    const edge = best.radius - best.dist;
    if (edge >= 0) {
      const depth = Math.max(1, Math.min(7, Math.floor(1 + 6 * Math.min(1, edge / Math.max(1, best.radius * 0.38)))));
      return { inLake: true, shore: false, depth, edge };
    }
    return { inLake: false, shore: best.dist <= best.radius + 10, depth: 0, edge };
  }

  function terrainHeight(seed, x, z) {
    const biome = lowlandBiome(seed, x, z);
    const broad = smoothNoise(seed, x / 22, z / 22);
    const detail = smoothNoise(seed + 91, x / 7, z / 7);
    const lowland = biome === 'forest'
      ? 11 + broad * 8 + detail * 3
      : 10 + broad * 7 + detail * 2;
    const ridge = smoothNoise(seed + 97, x / 36, z / 36);
    const mountain = 18 + broad * 22 + ridge * 18 + detail * 4;
    const cliffBoost = smoothNoise(seed + 739, x / 55, z / 55) > 0.82 ? 0.16 : 0;
    const strength = Math.min(1, mountainStrength(seed, x, z) + cliffBoost * mountainStrength(seed, x, z));
    return Math.max(5, Math.min(58, Math.floor(lowland * (1 - strength) + mountain * strength)));
  }

  function biomeAt(seed, x, z) {
    const lake = lakeInfo(seed, x, z);
    if (lake.inLake) return 'lake';
    if (lake.shore) return 'beach';
    if (geyserValleyInfo(seed, x, z).inValley) return 'geysers';
    return baseLandBiome(seed, x, z);
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
      minHeight: WATER_LEVEL + 3,
      spawnDistance: 18,
    });
    if (lava !== blockIds.AIR) return lava;

    if (mountainStrength(seed, x, z) > 0.38) return blockIds.AIR;

    return basinLiquidAt(seed, x, y, z, h, world, blockIds, {
      block: blockIds.WATER,
      cellSize: 22,
      salt: 1301,
      chanceSalt: 1303,
      radiusSalt: 1305,
      chance: 0.04,
      minRadius: 1.8,
      radiusRange: 1.7,
      minHeight: WATER_LEVEL + 2,
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
    const lake = lakeInfo(seed, x, z);
    const biome = lake.inLake ? 'lake' : (lake.shore ? 'beach' : (geyserValleyInfo(seed, x, z).inValley ? 'geysers' : baseLandBiome(seed, x, z)));
    const groundH = lake.inLake ? WATER_LEVEL - lake.depth : h;
    if (y === 0) return blockIds.BEDROCK;
    if (y <= groundH) {
      if (undergroundLavaAt(seed, x, y, z, groundH, world)) return blockIds.LAVA;
      if (lake.inLake) {
        if (y >= groundH - 1) return blockIds.SAND;
        return blockIds.STONE;
      }
      if (biome === 'beach') return y >= groundH - 2 ? blockIds.SAND : blockIds.STONE;
      if (biome === 'desert') {
        if (y === groundH) {
          const transition = dryTransitionSurface(seed, x, z, biome, blockIds);
          return transition !== blockIds.AIR ? transition : blockIds.SAND;
        }
        return y >= groundH - 4 ? blockIds.SAND : blockIds.STONE;
      }
      if (biome === 'mountains' || biome === 'geysers') {
        if (y === groundH && y >= SNOW_LEVEL) return blockIds.SNOW;
        if (y >= groundH - 1 && y >= DRY_MOUNTAIN_LEVEL) return blockIds.RED_EARTH;
        if (y >= groundH - 2 && y < DRY_MOUNTAIN_LEVEL) return blockIds.DIRT;
        return blockIds.STONE;
      }
      if (y === groundH) {
        const transition = dryTransitionSurface(seed, x, z, biome, blockIds);
        if (transition !== blockIds.AIR) return transition;
        return blockIds.DIRT;
      }
      if (y >= groundH - 3) return blockIds.DIRT;
      return blockIds.STONE;
    }
    if (x <= 0 || x >= world.w - 1 || z <= 0 || z >= world.d - 1) return blockIds.AIR;
    if (lake.inLake && y <= WATER_LEVEL) return blockIds.WATER;
    const surfaceLiquid = surfaceLiquidAt(seed, x, y, z, h, world, blockIds);
    if (surfaceLiquid !== blockIds.AIR) return surfaceLiquid;
    return blockIds.AIR;
  }

  function hasInitialGrass(seed, x, y, z, world, blockIds) {
    const biome = biomeAt(seed, x, z);
    return y === terrainHeight(seed, x, z)
      && (biome === 'plains' || biome === 'forest')
      && dryTransitionSurface(seed, x, z, biome, blockIds) === blockIds.AIR
      && terrainBlockAt(seed, x, y + 1, z, world, blockIds) === blockIds.AIR;
  }

  function localIndex(lx, ly, lz) {
    return lx + CHUNK_SIZE * (lz + CHUNK_SIZE * ly);
  }

  function generateChunk(message) {
    const { id, seed, world, blockIds, cx, cy, cz } = message;
    const blocks = new Uint16Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE);
    const fluidLevel = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE);
    const grassLevel = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE);
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
          if (block === blockIds.WATER) fluidLevel[index] = 1;
          else if (block === blockIds.LAVA) fluidLevel[index] = 0;
          else if (block === blockIds.DIRT && hasInitialGrass(seed, x, y, z, world, blockIds)) grassLevel[index] = 1;
        }
      }
    }

    self.postMessage({ id, cx, cy, cz, blocks, fluidLevel, grassLevel }, [blocks.buffer, fluidLevel.buffer, grassLevel.buffer]);
  }

  self.onmessage = (event) => {
    if (!event || !event.data || event.data.type !== 'generate') return;
    generateChunk(event.data);
  };
})();
