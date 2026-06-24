(() => {
  const Game = window.CubDep;
  const { BLOCK } = Game.blocks;
  const { clearWorld3D, setBlock3D, getBlock3D, setStaticWater3D, setLava3D, setGrassLevel3D, getGrassLevel3D, removeChunk3D, installGeneratedChunk3D, installSavedChunk3D, getChunkSnapshot3D } = Game.world3d;
  const {
    CHUNK_SIZE,
    CHUNK_RENDER_DISTANCE,
    CHUNK_UNLOAD_DISTANCE,
    CHUNK_START_SYNC_RADIUS,
    CHUNK_WORKER_MAX_PENDING,
    CHUNK_SYNC_GENERATE_BUDGET,
    CHUNK_DECORATE_BUDGET,
    CHUNK_UNLOAD_COLUMN_BUDGET,
  } = Game.constants3d;

  const WATER_LEVEL = 14;
  const SNOW_LEVEL = 48;
  const DRY_MOUNTAIN_LEVEL = 36;
  const BIOME_TRANSITION_RADIUS = 18;
  const BIOME_TRANSITION_OFFSETS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
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

  function smoothstep(edge0, edge1, value) {
    const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  function ridgeNoise(seed, x, z, scale) {
    return 1 - Math.abs(smoothNoise(seed, x / scale, z / scale) * 2 - 1);
  }

  function mountainNoise(seed, x, z) {
    const longRidges = ridgeNoise(seed + 710, x, z, 310);
    const crossRidges = ridgeNoise(seed + 711, x + z * 0.35, z - x * 0.18, 190);
    const massif = smoothNoise(seed + 712, x / 460, z / 460);
    const detail = ridgeNoise(seed + 713, x, z, 92);
    return longRidges * 0.36 + crossRidges * 0.2 + massif * 0.34 + detail * 0.1;
  }

  function mountainStrength(seed, x, z) {
    const base = mountainNoise(seed, x, z);
    const foothills = smoothNoise(seed + 714, x / 260, z / 260) * 0.06;
    return smoothstep(0.66, 0.86, base + foothills);
  }

  function climateAt(seed, x, z) {
    const heat = smoothNoise(seed + 733, x / 620, z / 620) * 0.72
      + smoothNoise(seed + 734, x / 210, z / 210) * 0.28;
    const moisture = smoothNoise(seed + 721, x / 560, z / 560) * 0.68
      + smoothNoise(seed + 722, x / 190, z / 190) * 0.32;
    const latitude = Math.abs(z - 1024) / 1024;
    return {
      heat: Math.max(0, Math.min(1, heat * 0.88 + (1 - latitude) * 0.12)),
      moisture: Math.max(0, Math.min(1, moisture)),
    };
  }

  function lowlandBiome(seed, x, z) {
    const climate = climateAt(seed, x, z);
    const dry = climate.heat > 0.54 && climate.moisture < 0.48;
    if (dry && climate.moisture < 0.54 - climate.heat * 0.18) return 'desert';
    if (climate.moisture > 0.56 || (climate.moisture > 0.5 && climate.heat < 0.46)) return 'forest';
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

  function dryTransitionSurface(seed, x, z, biome) {
    if (biome === 'lake' || biome === 'beach' || biome === 'mountains' || biome === 'geysers') return BLOCK.AIR;
    const desert = baseBiomeInfluence(seed, x, z, 'desert');
    const green = baseBiomeInfluence(seed, x, z, 'plains') + baseBiomeInfluence(seed, x, z, 'forest');
    const noise = smoothNoise(seed + 913, x / 5, z / 5);
    if (biome === 'desert' && green > 0.12) {
      if (noise < green * 0.18) return BLOCK.RED_EARTH;
      return BLOCK.SAND;
    }
    if (biome !== 'desert' && desert > 0.12 && mountainStrength(seed, x, z) < 0.38) {
      if (noise < desert * 0.34) return BLOCK.SAND;
      if (noise < desert * 0.58) return BLOCK.RED_EARTH;
    }
    return BLOCK.AIR;
  }

  function riverInfo(seed, x, z) {
    if (mountainStrength(seed, x, z) > 0.96) return { inRiver: false, shore: false, depth: 0, edge: 99 };
    const cellSize = 640;
    const cellX = Math.floor(x / cellSize);
    const cellZ = Math.floor(z / cellSize);
    let best = null;
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const cx = cellX + dx;
        const cz = cellZ + dz;
        if (noise2(seed + 1201, cx, cz) > 0.2) continue;
        const vertical = noise2(seed + 1203, cx, cz) > 0.5;
        const width = 2.8 + noise2(seed + 1205, cx, cz) * 3.2;
        const baseX = cx * cellSize;
        const baseZ = cz * cellSize;
        const localA = vertical ? z - baseZ : x - baseX;
        if (localA < -24 || localA > cellSize + 24) continue;
        const t = localA / cellSize;
        const side = vertical ? x - baseX : z - baseZ;
        const start = cellSize * (0.18 + noise2(seed + 1207, cx, cz) * 0.64);
        const end = cellSize * (0.18 + noise2(seed + 1209, cx, cz) * 0.64);
        const bend = (smoothNoise(seed + 1211, (vertical ? z : x) / 92, (vertical ? x : z) / 92) - 0.5) * 74;
        const broadBend = Math.sin(Math.max(0, Math.min(1, t)) * Math.PI) * (noise2(seed + 1213, cx, cz) - 0.5) * 92;
        const center = start + (end - start) * t + bend + broadBend;
        const distance = Math.abs(side - center);
        if (distance > width + 9) continue;
        const score = distance - width;
        if (!best || score < best.score) best = { score, distance, width };
      }
    }
    if (!best) return { inRiver: false, shore: false, depth: 0, edge: 99 };
    const edge = best.width - best.distance;
    if (edge >= 0) {
      const depth = Math.max(1, Math.min(3, Math.floor(1 + 2 * Math.min(1, edge / Math.max(1, best.width)))));
      return { inRiver: true, shore: false, depth, edge };
    }
    const shoreBand = best.distance <= best.width + 5;
    const sandyShore = shoreBand && smoothNoise(seed + 1221, x / 24, z / 24) > 0.86;
    return { inRiver: false, shore: sandyShore, depth: 0, edge };
  }

  function warpedLakeDistance(seed, x, z, centerX, centerZ, radiusX, radiusZ, angle) {
    const warpX = (smoothNoise(seed + 821, x / 78, z / 78) - 0.5) * radiusX * 0.42
      + (smoothNoise(seed + 822, x / 31, z / 31) - 0.5) * radiusX * 0.14;
    const warpZ = (smoothNoise(seed + 823, x / 84, z / 84) - 0.5) * radiusZ * 0.42
      + (smoothNoise(seed + 824, x / 29, z / 29) - 0.5) * radiusZ * 0.14;
    const dx = x + warpX - centerX;
    const dz = z + warpZ - centerZ;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const rx = dx * cos + dz * sin;
    const rz = -dx * sin + dz * cos;
    const cove = (smoothNoise(seed + 825, x / 46, z / 46) - 0.5) * 0.18;
    return Math.hypot(rx / radiusX, rz / radiusZ) + cove;
  }

  function riverWaterLevel(seed, x, z) {
    return Math.max(2, Math.min(58, terrainBaseHeight(seed, x, z) - 1));
  }

  function lakeInfo(seed, x, z) {
    const river = riverInfo(seed, x, z);
    const tooHighForLake = mountainStrength(seed, x, z) > 0.68;
    if (tooHighForLake && !(river.inRiver || river.shore)) return { inLake: false, shore: false, depth: 0, edge: 99 };
    const climate = climateAt(seed, x, z);
    const cellSize = 280;
    const cellX = Math.floor(x / cellSize);
    const cellZ = Math.floor(z / cellSize);
    let best = null;
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const cx = cellX + dx;
        const cz = cellZ + dz;
        const roll = noise2(seed + 811, cx, cz);
        const lakeChance = 0.34 + Math.max(0, climate.moisture - 0.38) * 0.36;
        if (roll > lakeChance) continue;
        const large = noise2(seed + 812, cx, cz);
        const baseRadius = large > 0.88
          ? 76 + noise2(seed + 813, cx, cz) * 86
          : (large > 0.48 ? 42 + noise2(seed + 814, cx, cz) * 52 : 24 + noise2(seed + 815, cx, cz) * 24);
        const centerX = cx * cellSize + Math.floor(cellSize * (0.2 + noise2(seed + 816, cx, cz) * 0.6));
        const centerZ = cz * cellSize + Math.floor(cellSize * (0.2 + noise2(seed + 817, cx, cz) * 0.6));
        if (mountainStrength(seed, centerX, centerZ) > 0.62) continue;
        const stretch = 0.62 + noise2(seed + 826, cx, cz) * 0.92;
        const radiusX = baseRadius * (large > 0.48 ? stretch : 1);
        const radiusZ = baseRadius * (large > 0.48 ? 1.55 - stretch * 0.45 : 1);
        const angle = noise2(seed + 827, cx, cz) * Math.PI;
        const dist = warpedLakeDistance(seed, x, z, centerX, centerZ, radiusX, radiusZ, angle);
        const shoreWidth = 0.09 + Math.min(0.08, 7 / Math.max(24, baseRadius));
        if (dist > 1 + shoreWidth) continue;
        const score = dist - 1;
        if (!best || score < best.score) best = { score, dist, radius: baseRadius, centerX, centerZ };
      }
    }
    if (!best || tooHighForLake) {
      if (river.inRiver || river.shore) {
        return {
          inLake: river.inRiver,
          shore: river.shore,
          depth: river.depth,
          edge: river.edge,
          kind: 'river',
          waterLevel: riverWaterLevel(seed, x, z),
        };
      }
      return { inLake: false, shore: false, depth: 0, edge: 99 };
    }
    const rimRadius = Math.ceil(best.radius + 16);
    const rimOffsets = [[rimRadius, 0], [-rimRadius, 0], [0, rimRadius], [0, -rimRadius], [rimRadius, rimRadius], [rimRadius, -rimRadius], [-rimRadius, rimRadius], [-rimRadius, -rimRadius]];
    let lowRimCount = 0;
    for (const [rx, rz] of rimOffsets) {
      if (terrainHeight(seed, best.centerX + rx, best.centerZ + rz) <= WATER_LEVEL) lowRimCount += 1;
    }
    if (lowRimCount > 1) return { inLake: false, shore: false, depth: 0, edge: 99 };
    const edge = 1 - best.dist;
    if (best.dist <= 1) {
      const depth = Math.max(1, Math.min(7, Math.floor(1 + 6 * Math.min(1, edge / 0.42))));
      return { inLake: true, shore: false, depth, edge, kind: 'lake' };
    }
    if (river.inRiver) {
      return {
        inLake: true,
        shore: false,
        depth: river.depth,
        edge: river.edge,
        kind: 'river',
        waterLevel: riverWaterLevel(seed, x, z),
      };
    }
    const slope = Math.abs(terrainHeight(seed, x + 2, z) - terrainHeight(seed, x - 2, z))
      + Math.abs(terrainHeight(seed, x, z + 2) - terrainHeight(seed, x, z - 2));
    const shoreNoise = smoothNoise(seed + 829, x / 30, z / 30);
    const beachChance = lowlandBiome(seed, x, z) === 'desert'
      ? 0.22
      : (slope <= 5 ? 0.14 : 0.06);
    const sandyShore = river.shore || shoreNoise > 1 - beachChance;
    return { inLake: false, shore: sandyShore, depth: 0, edge, kind: 'lake' };
  }

  function terrainBaseHeight(seed, x, z) {
    const biome = lowlandBiome(seed, x, z);
    const climate = climateAt(seed, x, z);
    const broad = smoothNoise(seed, x / 28, z / 28);
    const detail = smoothNoise(seed + 91, x / 7, z / 7);
    const lowland = biome === 'forest'
      ? 11 + broad * 8 + detail * 2 + climate.moisture * 2
      : (biome === 'desert' ? 10 + broad * 6 + detail * 2 : 10 + broad * 7 + detail * 2);
    const ridge = ridgeNoise(seed + 97, x, z, 44);
    const mountain = 18 + broad * 15 + ridge * 18 + detail * 3;
    const strength = mountainStrength(seed, x, z);
    return Math.max(5, Math.min(58, Math.floor(lowland * (1 - strength) + mountain * strength)));
  }

  function terrainHeight(seed, x, z) {
    const river = riverInfo(seed, x, z);
    const riverCut = river.inRiver ? river.depth + 2 : (river.shore ? 1 : 0);
    return Math.max(5, Math.min(58, terrainBaseHeight(seed, x, z) - riverCut));
  }

  function biomeAt(seed, x, z) {
    const lake = lakeInfo(seed, x, z);
    if (lake.inLake) return 'lake';
    if (lake.shore) return 'beach';
    if (geyserValleyInfo(seed, x, z).inValley) return 'geysers';
    return baseLandBiome(seed, x, z);
  }

  const BIOME_LABELS = {
    plains: 'Равнина',
    forest: 'Лес',
    desert: 'Пустыня',
    mountains: 'Горы',
    lake: 'Озеро',
    beach: 'Пляж',
    geysers: 'Долина гейзеров',
  };

  function getBiomeAt3D(state, x, z) {
    if (!state || !state.worldMeta) return 'plains';
    return biomeAt(worldSeed(state), Math.floor(x), Math.floor(z));
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
      minHeight: WATER_LEVEL + 3,
      spawnDistance: 18,
    });
    if (lava !== BLOCK.AIR) return lava;

    if (mountainStrength(seed, x, z) > 0.38) return BLOCK.AIR;

    return basinLiquidAt(seed, x, y, z, h, world, {
      block: BLOCK.WATER,
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
    const lake = lakeInfo(seed, x, z);
    const biome = lake.inLake ? 'lake' : (lake.shore ? 'beach' : (geyserValleyInfo(seed, x, z).inValley ? 'geysers' : baseLandBiome(seed, x, z)));
    const waterLevel = lake.inLake && Number.isFinite(lake.waterLevel) ? lake.waterLevel : WATER_LEVEL;
    const groundH = lake.inLake ? waterLevel - lake.depth : h;
    if (y === 0) return BLOCK.BEDROCK;
    if (y <= groundH) {
      if (undergroundLavaAt(seed, x, y, z, groundH, world)) return BLOCK.LAVA;
      if (lake.inLake) {
        if (y >= groundH - 1) return BLOCK.SAND;
        return BLOCK.STONE;
      }
      if (biome === 'beach') return y >= groundH - 2 ? BLOCK.SAND : BLOCK.STONE;
      if (biome === 'desert') {
        if (y === groundH) {
          const transition = dryTransitionSurface(seed, x, z, biome);
          return transition !== BLOCK.AIR ? transition : BLOCK.SAND;
        }
        return y >= groundH - 4 ? BLOCK.SAND : BLOCK.STONE;
      }
      if (biome === 'mountains' || biome === 'geysers') {
        if (y === groundH && y >= SNOW_LEVEL) return BLOCK.SNOW;
        if (y >= groundH - 1 && y >= DRY_MOUNTAIN_LEVEL) return BLOCK.RED_EARTH;
        if (y >= groundH - 2 && y < DRY_MOUNTAIN_LEVEL) return BLOCK.DIRT;
        return BLOCK.STONE;
      }
      if (y === groundH) {
        const transition = dryTransitionSurface(seed, x, z, biome);
        if (transition !== BLOCK.AIR) return transition;
        return BLOCK.DIRT;
      }
      if (y >= groundH - 3) return BLOCK.DIRT;
      return BLOCK.STONE;
    }
    if (world && (x <= 0 || x >= world.w - 1 || z <= 0 || z >= world.d - 1)) return BLOCK.AIR;
    if (lake.inLake && y <= waterLevel) return BLOCK.WATER;
    const surfaceLiquid = surfaceLiquidAt(seed, x, y, z, h, world);
    if (surfaceLiquid !== BLOCK.AIR) return surfaceLiquid;
    return BLOCK.AIR;
  }

  function hasInitialGrass(seed, x, y, z, world) {
    const biome = biomeAt(seed, x, z);
    return y === terrainHeight(seed, x, z)
      && (biome === 'plains' || biome === 'forest')
      && dryTransitionSurface(seed, x, z, biome) === BLOCK.AIR
      && terrainBlockAt(seed, x, y + 1, z, world) === BLOCK.AIR;
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
        installGeneratedChunk3D(stateRef, data.cx, data.cy, data.cz, data.blocks, data.fluidLevel, data.grassLevel || null);
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

  async function saveModifiedChunks3D(state, targetWorldId, options = {}) {
    const storage = Game.storage3d;
    const world = state && state.world;
    if (!storage || !storage.isAvailable || !storage.isAvailable() || !world || !world.unsavedChunks || !targetWorldId) return 0;
    const keepUnsaved = Boolean(options.keepUnsaved);
    let savedCount = 0;
    for (const key of Array.from(world.unsavedChunks)) {
      const snapshot = getChunkSnapshot3D(state, key);
      if (!snapshot) {
        if (!keepUnsaved) world.unsavedChunks.delete(key);
        continue;
      }
      const saved = await storage.saveChunkSnapshot(targetWorldId, key, snapshot);
      if (!saved) continue;
      if (!keepUnsaved) {
        world.unsavedChunks.delete(key);
        if (!world.savedChunks) world.savedChunks = new Set();
        world.savedChunks.add(key);
      }
      savedCount += 1;
    }
    world.lastUnsavedChunks = world.unsavedChunks.size;
    return savedCount;
  }

  async function saveAllModifiedChunks3D(state) {
    return saveModifiedChunks3D(state, state && state.worldMeta ? state.worldMeta.id : '', { keepUnsaved: false });
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
            if (block === BLOCK.WATER) setStaticWater3D(state, x, y, z);
            else if (block === BLOCK.LAVA) setLava3D(state, x, y, z, 0, true);
            else {
              setBlock3D(state, x, y, z, block);
              if (block === BLOCK.DIRT && hasInitialGrass(seed, x, y, z, state.world)) {
                setGrassLevel3D(state, x, y, z, 1, { skipModified: true });
              }
            }
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
    if (getBlock3D(state, x, groundY, z) !== BLOCK.DIRT || getGrassLevel3D(state, x, groundY, z) <= 0) return false;
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

  function placeCactus(state, seed, x, groundY, z) {
    if (getBlock3D(state, x, groundY, z) !== BLOCK.SAND) return false;
    const height = 2 + Math.floor(noise2(seed + 1801, x, z) * 3);
    if (groundY + height >= state.world.h) return false;
    for (let y = groundY + 1; y <= groundY + height; y += 1) {
      if (getBlock3D(state, x, y, z) !== BLOCK.AIR) return false;
    }
    for (let y = groundY + 1; y <= groundY + height; y += 1) setBlock3D(state, x, y, z, BLOCK.CACTUS);
    return true;
  }

  function placeDryBush(state, x, groundY, z) {
    if (getBlock3D(state, x, groundY, z) !== BLOCK.SAND) return false;
    if (getBlock3D(state, x, groundY + 1, z) !== BLOCK.AIR) return false;
    return setBlock3D(state, x, groundY + 1, z, BLOCK.DRY_BUSH);
  }

  function placeAlgae(state, seed, x, groundY, z) {
    if (getBlock3D(state, x, groundY, z) !== BLOCK.SAND) return false;
    if (getBlock3D(state, x, groundY + 1, z) !== BLOCK.WATER) return false;
    if (getBlock3D(state, x, groundY + 2, z) !== BLOCK.WATER) return false;
    const tall = noise2(seed + 1901, x, z) > 0.68 && getBlock3D(state, x, groundY + 3, z) === BLOCK.WATER;
    setBlock3D(state, x, groundY + 1, z, tall ? BLOCK.TALL_ALGAE : BLOCK.ALGAE);
    if (tall) setBlock3D(state, x, groundY + 2, z, BLOCK.TALL_ALGAE);
    return true;
  }

  function placeGeyser(state, x, groundY, z) {
    if (groundY < 4 || groundY + 2 >= state.world.h) return false;
    const ground = getBlock3D(state, x, groundY, z);
    if (ground !== BLOCK.STONE && ground !== BLOCK.RED_EARTH && ground !== BLOCK.SNOW) return false;
    if (getBlock3D(state, x, groundY + 1, z) !== BLOCK.AIR) return false;
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dz === 0) continue;
        if (getBlock3D(state, x + dx, groundY + 1, z + dz) !== BLOCK.AIR) return false;
      }
    }
    const wallBlock = ground === BLOCK.SNOW ? BLOCK.STONE : ground;
    setBlock3D(state, x, groundY - 3, z, BLOCK.LAVA);
    setBlock3D(state, x, groundY - 2, z, BLOCK.STONE);
    setBlock3D(state, x, groundY - 1, z, BLOCK.HOT_WATER);
    setBlock3D(state, x, groundY, z, BLOCK.AIR);
    setBlock3D(state, x, groundY + 1, z, BLOCK.AIR);
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dz === 0) continue;
        setBlock3D(state, x + dx, groundY - 1, z + dz, wallBlock);
        setBlock3D(state, x + dx, groundY, z + dz, wallBlock);
      }
    }
    return true;
  }

  function canPlaceGroundMob(state, type, x, groundY, z) {
    const world = state.world;
    if (x < 2 || x >= world.w - 2 || z < 2 || z >= world.d - 2) return false;
    if (!farFromSpawn(world, x, z, 18)) return false;
    const ground = getBlock3D(state, x, groundY, z);
    if (type === 'sheep' && (ground !== BLOCK.DIRT || getGrassLevel3D(state, x, groundY, z) <= 0)) return false;
    if (type === 'boar' && ground !== BLOCK.DIRT && ground !== BLOCK.RED_EARTH) return false;
    if (type === 'turtle' && ground !== BLOCK.SAND) return false;
    if (type === 'snake' && ground !== BLOCK.SAND && ground !== BLOCK.RED_EARTH) return false;
    if (type === 'goat' && ground !== BLOCK.STONE && ground !== BLOCK.RED_EARTH && ground !== BLOCK.SNOW && ground !== BLOCK.DIRT) return false;
    return getBlock3D(state, x, groundY + 1, z) === BLOCK.AIR && getBlock3D(state, x, groundY + 2, z) === BLOCK.AIR;
  }

  function findGroundMobPlace(state, type, centerX, centerZ) {
    const world = state.world;
    for (let radius = 0; radius <= 3; radius += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
          const x = centerX + dx;
          const z = centerZ + dz;
          if (x < 2 || x >= world.w - 2 || z < 2 || z >= world.d - 2) continue;
          for (let y = world.h - 2; y >= 1; y -= 1) {
            if (canPlaceGroundMob(state, type, x, y, z)) return { x, y, z };
            if (getBlock3D(state, x, y, z) !== BLOCK.AIR) break;
          }
        }
      }
    }
    return null;
  }

  function hasMob(state, id) {
    const sheep = state.entities && Array.isArray(state.entities.sheep) ? state.entities.sheep : [];
    return sheep.some((item) => item.id === id);
  }

  function mobForBiome(biome) {
    if (biome === 'plains') return { type: 'sheep', chance: 0.12, cellSize: 18 };
    if (biome === 'forest') return { type: 'boar', chance: 0.08, cellSize: 20 };
    if (biome === 'beach') return { type: 'turtle', chance: 0.075, cellSize: 18 };
    if (biome === 'desert') return { type: 'snake', chance: 0.07, cellSize: 20 };
    if (biome === 'mountains') return { type: 'goat', chance: 0.075, cellSize: 22 };
    if (biome === 'lake') return { type: 'fish', chance: 0.2, cellSize: 16 };
    return null;
  }

  function mobForPosition(seed, x, z) {
    const biome = biomeAt(seed, x, z);
    if (biome === 'geysers') return null;
    const forest = baseBiomeInfluence(seed, x, z, 'forest');
    const plains = baseBiomeInfluence(seed, x, z, 'plains');
    const desert = baseBiomeInfluence(seed, x, z, 'desert');
    const roll = noise2(seed + 2311, Math.floor(x / 16), Math.floor(z / 16));
    if (biome === 'plains' && forest > 0.18 && roll < forest * 0.4) return { type: 'boar', chance: 0.05, cellSize: 20 };
    if (biome === 'forest' && plains > 0.18 && roll < plains * 0.45) return { type: 'sheep', chance: 0.075, cellSize: 18 };
    if (biome === 'beach' && desert > 0.22 && roll < desert * 0.32) return { type: 'snake', chance: 0.05, cellSize: 20 };
    if (biome === 'desert' && plains + forest > 0.22 && roll < (plains + forest) * 0.18) return { type: 'sheep', chance: 0.045, cellSize: 18 };
    return mobForBiome(biome);
  }

  function findFishPlace(state, centerX, centerZ) {
    for (let radius = 0; radius <= 4; radius += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
          const x = centerX + dx;
          const z = centerZ + dz;
          for (let y = WATER_LEVEL - 1; y >= Math.max(1, WATER_LEVEL - 6); y -= 1) {
            if (getBlock3D(state, x, y, z) === BLOCK.WATER && getBlock3D(state, x, y - 1, z) === BLOCK.WATER) return { x, y, z };
          }
        }
      }
    }
    return null;
  }

  function generateMobsForColumn(state, seed, cx, cz, bounds) {
    if (!state.entities) state.entities = {};
    if (!Array.isArray(state.entities.sheep)) state.entities.sheep = [];

    const cellSize = 16;
    const minCellX = Math.floor(bounds.minX / cellSize);
    const maxCellX = Math.floor((bounds.maxX - 1) / cellSize);
    const minCellZ = Math.floor(bounds.minZ / cellSize);
    const maxCellZ = Math.floor((bounds.maxZ - 1) / cellSize);

    for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ += 1) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
        const sampleX = cellX * cellSize + Math.floor(cellSize * 0.5);
        const sampleZ = cellZ * cellSize + Math.floor(cellSize * 0.5);
        const info = mobForPosition(seed, sampleX, sampleZ);
        if (!info) continue;
        if (noise2(seed + 2301, cellX, cellZ) > info.chance) continue;
        const x = cellX * cellSize + Math.floor(4 + noise2(seed + 2303, cellX, cellZ) * (cellSize - 8));
        const z = cellZ * cellSize + Math.floor(4 + noise2(seed + 2305, cellX, cellZ) * (cellSize - 8));
        if (x < bounds.minX || x >= bounds.maxX || z < bounds.minZ || z >= bounds.maxZ) continue;
        const id = `${info.type}-${cellX}-${cellZ}`;
        if (hasMob(state, id)) continue;
        const herdSize = 1 + (noise2(seed + 2313, cellX, cellZ) < 0.34 ? 1 : 0) + (noise2(seed + 2315, cellX, cellZ) < 0.12 ? 1 : 0);
        for (let i = 0; i < herdSize; i += 1) {
          const ox = i === 0 ? 0 : Math.floor(noise2(seed + 2321 + i, cellX, cellZ) * 5) - 2;
          const oz = i === 0 ? 0 : Math.floor(noise2(seed + 2331 + i, cellX, cellZ) * 5) - 2;
          const place = info.type === 'fish' ? findFishPlace(state, x + ox, z + oz) : findGroundMobPlace(state, info.type, x + ox, z + oz);
          if (!place) continue;
          const mobId = i === 0 ? id : `${id}-${i}`;
          if (hasMob(state, mobId)) continue;
          if (Game.entities3d && Game.entities3d.spawnMob3D) {
            Game.entities3d.spawnMob3D(state, info.type, place.x, info.type === 'fish' ? place.y : place.y + 1, place.z, mobId);
          }
        }
      }
    }
  }

  function treeChanceAt(seed, x, z, biome) {
    if (biome === 'lake' || biome === 'beach' || biome === 'desert' || biome === 'mountains' || biome === 'geysers') return 0;
    const forest = baseBiomeInfluence(seed, x, z, 'forest', 22);
    const desert = baseBiomeInfluence(seed, x, z, 'desert', 20);
    if (desert > 0.18) return 0;
    return 0.003 + forest * 0.082;
  }

  function desertDecorationStrength(seed, x, z, biome) {
    if (biome === 'lake' || biome === 'beach' || biome === 'mountains' || biome === 'geysers') return 0;
    if (biome === 'desert') return Math.max(0.55, baseBiomeInfluence(seed, x, z, 'desert'));
    return Math.max(0, baseBiomeInfluence(seed, x, z, 'desert') - 0.16);
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
          const biome = biomeAt(seed, x, z);
          let groundY = 0;
          for (let y = world.h - 2; y >= 1; y -= 1) {
            if (getBlock3D(state, x, y, z) !== BLOCK.AIR) {
              groundY = y;
              break;
            }
          }
          const treeChance = treeChanceAt(seed, x, z, biome);
          const desertDecor = desertDecorationStrength(seed, x, z, biome);
          if (treeChance > 0 && noise2(seed + 303, x, z) <= treeChance) {
            placeTree(state, seed, x, groundY, z);
          } else if (desertDecor > 0) {
            if (noise2(seed + 305, x, z) <= 0.0014 * desertDecor) placeCactus(state, seed, x, groundY, z);
            else if (noise2(seed + 306, x, z) <= 0.013 * desertDecor) placeDryBush(state, x, groundY, z);
          } else if (biome === 'lake') {
            if (noise2(seed + 307, x, z) <= 0.008) placeAlgae(state, seed, x, groundY, z);
          } else if (biome === 'geysers') {
            if (noise2(seed + 309, x, z) <= 0.012) placeGeyser(state, x, groundY, z);
          } else if (biome === 'mountains') {
            if (noise2(seed + 308, x, z) <= 0.0018) placeGeyser(state, x, groundY, z);
          }
        }
      }
    } finally {
      world.suppressChunkModification -= 1;
    }

    generateMobsForColumn(state, seed, cx, cz, bounds);
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

  Game.generation3d = {
    generateWorld3D,
    generateChunk3D,
    ensureChunksAroundPlayer3D,
    unloadDistantChunks3D,
    saveAllModifiedChunks3D,
    saveModifiedChunks3D,
    getBiomeAt3D,
    BIOME_LABELS,
  };
})();
