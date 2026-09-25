(() => {
  const Game = window.CubDep;
  const { BLOCK } = Game.blocks;
  const { clearWorld3D, setBlock3D, getStoredBlock3D: getBlock3D, setStaticWater3D, setLava3D, setVolcanicLava3D, setGrassLevel3D, getGrassLevel3D, removeChunk3D, installGeneratedChunk3D, installSavedChunk3D, getChunkSnapshot3D } = Game.world3d;
  const {
    CHUNK_SIZE,
    CHUNK_UNLOAD_DISTANCE,
    CHUNK_START_SYNC_RADIUS,
    CHUNK_WORKER_MAX_PENDING,
    CHUNK_WORKER_MAX_COUNT,
    CHUNK_SYNC_GENERATE_TIME_BUDGET_MS,
    CHUNK_SYNC_GENERATE_MAX_TIME_BUDGET_MS,
    CHUNK_SYNC_FALLBACK_RADIUS,
    CHUNK_DECORATE_BUDGET,
    CHUNK_DECORATE_MAX_BUDGET,
    CHUNK_DECORATE_TIME_BUDGET_MS,
    CHUNK_UNLOAD_COLUMN_BUDGET,
    getChunkRenderDistanceValue,
    isManualChunkRenderDistance,
  } = Game.constants3d;

  const TERRAIN_SURFACE_PRIORITY_WEIGHT = 0.45;

  const WATER_LEVEL = 14;
  const SNOW_LEVEL = 48;
  const DRY_MOUNTAIN_LEVEL = 36;
  const BIOME_TRANSITION_RADIUS = 18;
  const BIOME_TRANSITION_OFFSETS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  let chunkWorker = null;
  let chunkWorkers = [];
  let chunkWorkerAvailable = true;
  let nextWorkerJobId = 1;
  let nextWorkerIndex = 0;
  let activeState = null;
  const guaranteedVolcanicCache = new Map();

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

  function seededRandom(seedText) {
    let state = hash(seedText) || 1;
    return () => {
      state = Math.imul(state + 0x6D2B79F5, 1) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
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
    if (climate.heat < 0.26 && climate.moisture < 0.62) return 'snow_plains';
    if (climate.heat < 0.38 && climate.moisture >= 0.48) return 'spruce_forest';
    const dry = climate.heat > 0.54 && climate.moisture < 0.48;
    if (dry && climate.moisture < 0.54 - climate.heat * 0.18) return 'desert';
    if (climate.moisture > 0.56 || (climate.moisture > 0.5 && climate.heat < 0.46)) return 'forest';
    return 'plains';
  }

  function mountainForestInfluence(seed, x, z) {
    let count = 0;
    for (const [dx, dz] of BIOME_TRANSITION_OFFSETS) {
      const sampleX = x + dx * 34;
      const sampleZ = z + dz * 34;
      if (mountainStrength(seed, sampleX, sampleZ) <= 0.52 && lowlandBiome(seed, sampleX, sampleZ) === 'forest') count += 1;
    }
    return count / BIOME_TRANSITION_OFFSETS.length;
  }

  function guaranteedVolcanicFeature(seed) {
    if (guaranteedVolcanicCache.has(seed)) return guaranteedVolcanicCache.get(seed);
    const worldSize = 2048;
    const margin = 220;
    let best = null;
    for (let i = 0; i < 24; i += 1) {
      const x = margin + Math.floor(noise2(seed + 2711, i, 0) * (worldSize - margin * 2));
      const z = margin + Math.floor(noise2(seed + 2713, 0, i) * (worldSize - margin * 2));
      const mountain = mountainStrength(seed, x, z);
      const ridge = ridgeNoise(seed + 2715, x, z, 70);
      const score = mountain * 0.82 + ridge * 0.18;
      if (!best || score > best.score) best = { x, z, score, index: i };
    }
    const feature = best
      ? {
        x: best.x,
        z: best.z,
        radius: 42 + noise2(seed + 2717, best.index, 0) * 34,
      }
      : null;
    guaranteedVolcanicCache.set(seed, feature);
    return feature;
  }

  function volcanicInfo(seed, x, z) {
    let best = null;
    const guaranteed = guaranteedVolcanicFeature(seed);
    if (guaranteed) {
      const edgeNoise = (smoothNoise(seed + 2719, x / 24, z / 24) - 0.5) * 10;
      const dist = Math.hypot(x - guaranteed.x, z - guaranteed.z) + edgeNoise;
      if (dist <= guaranteed.radius + 28) {
        const edge = guaranteed.radius - dist;
        best = { inVolcanic: edge >= 0, fringe: edge < 0, edge, centerX: guaranteed.x, centerZ: guaranteed.z, radius: guaranteed.radius, key: 'guaranteed' };
      }
    }
    if (mountainStrength(seed, x, z) < 0.58) return best || { inVolcanic: false, fringe: false, edge: 99 };
    const cellSize = 420;
    const cellX = Math.floor(x / cellSize);
    const cellZ = Math.floor(z / cellSize);
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const cx = cellX + dx;
        const cz = cellZ + dz;
        if (noise2(seed + 2701, cx, cz) > 0.095) continue;
        const centerX = cx * cellSize + Math.floor(cellSize * (0.24 + noise2(seed + 2703, cx, cz) * 0.52));
        const centerZ = cz * cellSize + Math.floor(cellSize * (0.24 + noise2(seed + 2705, cx, cz) * 0.52));
        if (mountainStrength(seed, centerX, centerZ) < 0.64) continue;
        const radius = 30 + noise2(seed + 2707, cx, cz) * 42;
        const edgeNoise = (smoothNoise(seed + 2709, x / 24, z / 24) - 0.5) * 10;
        const dist = Math.hypot(x - centerX, z - centerZ) + edgeNoise;
        if (dist > radius + 28) continue;
        const edge = radius - dist;
        if (!best || edge > best.edge) best = { inVolcanic: edge >= 0, fringe: edge < 0, edge, centerX, centerZ, radius, key: `${cx},${cz}` };
      }
    }
    return best || { inVolcanic: false, fringe: false, edge: 99 };
  }

  function volcanoInfo(seed, x, z) {
    const volcanic = volcanicInfo(seed, x, z);
    if (!volcanic.inVolcanic || !Number.isFinite(volcanic.centerX) || !Number.isFinite(volcanic.centerZ)) return null;
    const radius = Math.max(16, Math.min(28, volcanic.radius * 0.42));
    const dx = x - volcanic.centerX;
    const dz = z - volcanic.centerZ;
    const dist = Math.hypot(dx, dz);
    if (dist > radius + 2) return null;
    const height = 22 + Math.floor(noise2(seed + 2741, Math.floor(volcanic.centerX), Math.floor(volcanic.centerZ)) * 12);
    return {
      x: volcanic.centerX,
      z: volcanic.centerZ,
      key: volcanic.key || `${Math.floor(volcanic.centerX)},${Math.floor(volcanic.centerZ)}`,
      radius,
      craterRadius: 5 + noise2(seed + 2743, Math.floor(volcanic.centerX), Math.floor(volcanic.centerZ)) * 2.5,
      ventRadius: 2.2 + noise2(seed + 2745, Math.floor(volcanic.centerX), Math.floor(volcanic.centerZ)) * 1.2,
      height,
      dist,
    };
  }

  function volcanoTerrainOffset(info) {
    if (!info) return 0;
    const slope = Math.max(0, 1 - info.dist / info.radius);
    const cone = Math.pow(slope, 1.45) * info.height;
    const rim = info.dist >= info.craterRadius && info.dist <= info.craterRadius + 3
      ? (1 - Math.abs(info.dist - (info.craterRadius + 1.5)) / 1.5) * 4
      : 0;
    const crater = info.dist < info.craterRadius
      ? (1 - info.dist / Math.max(1, info.craterRadius)) * 8
      : 0;
    return Math.floor(Math.max(0, cone + Math.max(0, rim) - crater));
  }

  function isVolcanoVentCell(seed, x, y, z) {
    const info = volcanoInfo(seed, x, z);
    if (!info || info.dist > info.ventRadius) return false;
    const floorY = 1 + Math.floor(noise2(seed + 2747, Math.floor(info.x), Math.floor(info.z)) * 2);
    return y > floorY && y <= terrainHeight(seed, x, z) + 1;
  }

  function baseLandBiome(seed, x, z) {
    const mountain = mountainStrength(seed, x, z);
    const volcanic = volcanicInfo(seed, x, z);
    if (volcanic.inVolcanic) return 'volcanic';
    if (mountain > 0.62) {
      if (mountainForestInfluence(seed, x, z) > 0.18) return 'mountain_forest';
      if (ridgeNoise(seed + 740, x, z, 54) > 0.72 && noise2(seed + 741, Math.floor(x / 18), Math.floor(z / 18)) > 0.48) return 'cliffs';
      return 'mountains';
    }
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
    const volcanic = volcanicInfo(seed, x, z);
    if (!volcanic.inVolcanic && volcanic.fringe) return { inValley: true, edge: Math.max(1, 28 + volcanic.edge) };
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
    if (biome === 'lake' || biome === 'beach' || biome === 'mountains' || biome === 'geysers' || biome === 'cliffs' || biome === 'volcanic' || biome === 'mountain_forest') return BLOCK.AIR;
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

  function lowlandForestBlend(climate) {
    const wetForest = smoothstep(0.48, 0.64, climate.moisture);
    const coolForest = smoothstep(0.44, 0.54, climate.moisture) * (1 - smoothstep(0.42, 0.52, climate.heat));
    return Math.max(wetForest, coolForest);
  }

  function terrainBaseHeight(seed, x, z) {
    const biome = lowlandBiome(seed, x, z);
    const climate = climateAt(seed, x, z);
    const broad = smoothNoise(seed, x / 28, z / 28);
    const detail = smoothNoise(seed + 91, x / 7, z / 7);
    const plains = 10 + broad * 7 + detail * 2;
    const forest = 11 + broad * 8 + detail * 2 + climate.moisture * 2;
    const desert = 10 + broad * 6 + detail * 2;
    const forestBlend = lowlandForestBlend(climate);
    const greenLowland = plains * (1 - forestBlend) + forest * forestBlend;
    const lowland = biome === 'desert' ? desert : greenLowland;
    const ridge = ridgeNoise(seed + 97, x, z, 44);
    const mountain = 18 + broad * 15 + ridge * 18 + detail * 3;
    const strength = mountainStrength(seed, x, z);
    return Math.max(5, Math.min(58, Math.floor(lowland * (1 - strength) + mountain * strength)));
  }

  function terrainHeight(seed, x, z) {
    const river = riverInfo(seed, x, z);
    const riverCut = river.inRiver ? river.depth + 2 : (river.shore ? 1 : 0);
    const base = terrainBaseHeight(seed, x, z) - riverCut;
    return Math.max(5, Math.min(92, base + volcanoTerrainOffset(volcanoInfo(seed, x, z))));
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
    cliffs: 'Скалы',
    volcanic: 'Вулканический биом',
    snow_plains: 'Снежная равнина',
    spruce_forest: 'Хвойный лес',
    mountain_forest: 'Горный лес',
    lake: 'Озеро',
    beach: 'Пляж',
    geysers: 'Долина гейзеров',
    deep_cavern: 'Подземное измерение',
  };

  function surfaceSourceCell(state, x, z) {
    return Game.easterEggs3d
      ? Game.easterEggs3d.getCavernFallSourceCell(state && state.worldMeta, Math.floor(x), Math.floor(z), currentDimension(state))
      : { x: Math.floor(x), z: Math.floor(z) };
  }

  function getBiomeAt3D(state, x, z) {
    if (!state || !state.worldMeta) return 'plains';
    if (state.worldMeta.currentDimension === 'underground') return 'deep_cavern';
    const source = surfaceSourceCell(state, x, z);
    return biomeAt(worldSeed(state), source.x, source.z);
  }

  function getVolcanoAt3D(state, x, z) {
    if (!state || !state.worldMeta || currentDimension(state) === 'underground') return null;
    const source = surfaceSourceCell(state, x, z);
    return volcanoInfo(worldSeed(state), source.x, source.z);
  }

  function isVolcanoVentCell3D(state, x, y, z) {
    if (!state || !state.worldMeta || currentDimension(state) === 'underground') return false;
    const source = surfaceSourceCell(state, x, z);
    return isVolcanoVentCell(worldSeed(state), source.x, Math.floor(y), source.z);
  }

  function volcanoEruptionIntensity(state, info) {
    if (!state || !info) return 0;
    const volcanoes = state.volcanoes || {};
    const forced = volcanoes.forcedEruptions && volcanoes.forcedEruptions.get(info.key);
    if (forced) {
      const elapsed = Math.max(0, (Number.isFinite(volcanoes.time) ? volcanoes.time : 0) - forced.startedAt);
      if (elapsed <= forced.duration) {
        if (elapsed < 6) return elapsed / 6;
        if (elapsed > forced.duration - 10) return Math.max(0, (forced.duration - elapsed) / 10);
        return 1;
      }
      volcanoes.forcedEruptions.delete(info.key);
    }
    const time = Number.isFinite(volcanoes.time) ? volcanoes.time : 0;
    const phaseOffset = noise2(worldSeed(state) + 2751, Math.floor(info.x), Math.floor(info.z)) * 360;
    const local = (time + phaseOffset) % 360;
    if (local > 78) return 0;
    if (local < 10) return local / 10;
    if (local > 64) return Math.max(0, (78 - local) / 14);
    return 1;
  }

  function findNearbyVolcano3D(state, x, z, radius = 96) {
    const seed = worldSeed(state);
    let best = null;
    const offsets = [[0, 0], [radius * 0.5, 0], [-radius * 0.5, 0], [0, radius * 0.5], [0, -radius * 0.5], [radius, 0], [-radius, 0], [0, radius], [0, -radius], [radius * 0.7, radius * 0.7], [radius * 0.7, -radius * 0.7], [-radius * 0.7, radius * 0.7], [-radius * 0.7, -radius * 0.7]];
    for (const [ox, oz] of offsets) {
      const info = volcanoInfo(seed, Math.floor(x + ox), Math.floor(z + oz));
      if (!info) continue;
      const dist = Math.hypot(x - info.x, z - info.z);
      if (dist > info.radius + 112) continue;
      if (!best || dist < best.dist) best = { ...info, dist };
    }
    return best;
  }

  function ensureVolcanoState(state) {
    if (!state.volcanoes) state.volcanoes = {};
    if (!state.volcanoes.active) state.volcanoes.active = new Map();
    if (!state.volcanoes.forcedEruptions) state.volcanoes.forcedEruptions = new Map();
    if (!state.volcanoes.coolingWaves) state.volcanoes.coolingWaves = new Map();
    if (!Number.isFinite(state.volcanoes.time)) state.volcanoes.time = 0;
    if (!Number.isFinite(state.volcanoes.lavaTimer)) state.volcanoes.lavaTimer = 0;
    return state.volcanoes;
  }

  function maybeStartFirstVolcanoEruption(state, info) {
    if (!state || !state.worldMeta || !info) return;
    if (getBiomeAt3D(state, state.player.x || 0, state.player.z || 0) !== 'volcanic') return;
    const meta = state.worldMeta;
    if (!meta.volcanoFirstEruptions || typeof meta.volcanoFirstEruptions !== 'object') meta.volcanoFirstEruptions = {};
    if (meta.volcanoFirstEruptions[info.key]) return;
    const volcanoes = ensureVolcanoState(state);
    meta.volcanoFirstEruptions[info.key] = true;
    volcanoes.forcedEruptions.set(info.key, {
      startedAt: volcanoes.time,
      duration: 78,
    });
  }

  function startVolcanicCoolingWave(state, info) {
    if (!state || !info) return;
    const volcanoes = ensureVolcanoState(state);
    const wave = {
      x: info.x,
      z: info.z,
      outerRadius: Math.max(info.radius + 28, info.radius + 100),
      ventRadius: Math.max(1.5, info.ventRadius || 2.4),
      elapsed: 0,
      speed: 5.5,
      activateTimer: 0,
    };
    volcanoes.coolingWaves.set(info.key, wave);
    if (Game.fluids3d && Game.fluids3d.activateVolcanicLavaCoolingWave3D) {
      Game.fluids3d.activateVolcanicLavaCoolingWave3D(state, wave);
    }
  }

  function updateVolcanicCoolingWaves(state, dt) {
    const volcanoes = ensureVolcanoState(state);
    for (const [key, wave] of Array.from(volcanoes.coolingWaves.entries())) {
      wave.elapsed += Math.max(0, dt || 0);
      wave.activateTimer = Math.max(0, (wave.activateTimer || 0) - Math.max(0, dt || 0));
      if (wave.activateTimer <= 0 && Game.fluids3d && Game.fluids3d.activateVolcanicLavaCoolingWave3D) {
        Game.fluids3d.activateVolcanicLavaCoolingWave3D(state, wave);
        wave.activateTimer = 0.45;
      }
      if (wave.outerRadius - wave.elapsed * wave.speed <= wave.ventRadius - 2) {
        volcanoes.coolingWaves.delete(key);
      }
    }
  }

  function emitVolcanicLava(state, info) {
    if (!state || !state.world || !info || !Game.fluids3d || !Game.fluids3d.addVolcanicLavaSource3D) return false;
    const volcanoes = ensureVolcanoState(state);
    const seed = worldSeed(state);
    const step = Math.floor(volcanoes.time * 2);
    const angle = noise2(seed + 2753, Math.floor(info.x), step) * Math.PI * 2;
    const radius = info.craterRadius + 1 + noise2(seed + 2755, step, Math.floor(info.z)) * 3;
    const x = Math.floor(info.x + Math.cos(angle) * radius);
    const z = Math.floor(info.z + Math.sin(angle) * radius);
    if (!state.world || x <= 1 || z <= 1 || x >= state.world.w - 2 || z >= state.world.d - 2) return false;
    const y = Math.min(state.world.h - 2, terrainHeight(seed, x, z) + 1);
    if (getBlock3D(state, x, y, z) !== BLOCK.AIR && getBlock3D(state, x, y, z) !== BLOCK.VOLCANIC_LAVA) return false;
    return Game.fluids3d.addVolcanicLavaSource3D(state, x, y, z);
  }

  function updateVolcanoes3D(state, dt) {
    if (!state || !state.world || currentDimension(state) === 'underground') return;
    const volcanoes = ensureVolcanoState(state);
    if (state.worldMeta && state.worldMeta.superOptimization) {
      volcanoes.active.clear();
      volcanoes.shake = 0;
      return;
    }
    volcanoes.time += Math.max(0, dt || 0);
    volcanoes.lavaTimer = Math.max(0, volcanoes.lavaTimer - dt);
    updateVolcanicCoolingWaves(state, dt);
    const player = state.player || { x: 0, z: 0 };
    const info = findNearbyVolcano3D(state, player.x || 0, player.z || 0, 128);
    const previous = info && volcanoes.active ? volcanoes.active.get(info.key) : null;
    volcanoes.active.clear();
    volcanoes.shake = 0;
    if (!info) return;
    maybeStartFirstVolcanoEruption(state, info);
    const intensity = volcanoEruptionIntensity(state, info);
    if (intensity <= 0) {
      if (previous && (previous.intensity || 0) > 0) startVolcanicCoolingWave(state, info);
      return;
    }
    const ventX = Math.round(info.x);
    const ventZ = Math.round(info.z);
    const ventY = Math.min(state.world.h - 2, terrainHeight(worldSeed(state), ventX, ventZ) + 1);
    volcanoes.active.set(info.key, { x: info.x, y: ventY, z: info.z, radius: info.radius, craterRadius: info.craterRadius, ventRadius: info.ventRadius, steamHeight: 15, intensity });
    const dist = Math.hypot((player.x || 0) - info.x, (player.z || 0) - info.z);
    volcanoes.shake = intensity * Math.max(0, 1 - Math.max(0, dist - info.radius) / 96);
    if (intensity > 0.8 && volcanoes.lavaTimer <= 0) {
      if (emitVolcanicLava(state, info)) volcanoes.lavaTimer = 1.8 + noise2(worldSeed(state) + 2757, Math.floor(volcanoes.time), Math.floor(info.x)) * 1.6;
      else volcanoes.lavaTimer = 0.8;
    }
  }

  function getActiveVolcanicEruption3D(state, x, z) {
    const active = state && state.volcanoes && state.volcanoes.active ? Array.from(state.volcanoes.active.values()) : [];
    let best = null;
    for (const info of active) {
      const dist = Math.hypot((x || 0) - info.x, (z || 0) - info.z);
      const limit = (info.radius || 0) + 100;
      if (dist > limit) continue;
      const threat = { ...info, dist, intensity: info.intensity * Math.max(0, 1 - Math.max(0, dist - (info.radius || 0)) / 100) };
      if (!best || threat.intensity > best.intensity) best = threat;
    }
    return best;
  }

  function getVolcanicSkyInfluence3D(state, x, z) {
    const threat = getActiveVolcanicEruption3D(state, x, z);
    if (!threat) return 0;
    const biome = getBiomeAt3D(state, x, z);
    const biomeFactor = biome === 'volcanic' ? 1 : 0.45;
    return Math.max(0, Math.min(1, threat.intensity * biomeFactor));
  }

  function getActiveVolcanicVents3D(state) {
    const active = state && state.volcanoes && state.volcanoes.active ? Array.from(state.volcanoes.active.values()) : [];
    return active
      .filter((info) => info && Number.isFinite(info.y) && (info.intensity || 0) > 0)
      .map((info) => ({
        x: Math.round(info.x),
        y: info.y,
        z: Math.round(info.z),
        height: info.steamHeight || 15,
        radius: Math.max(1.4, info.ventRadius || 2.4),
        intensity: Math.max(0, Math.min(1, info.intensity || 0)),
        volcanic: true,
      }));
  }

  function getVolcanicCoolingWave3D(state, x, z) {
    const waves = state && state.volcanoes && state.volcanoes.coolingWaves ? Array.from(state.volcanoes.coolingWaves.values()) : [];
    let best = null;
    for (const wave of waves) {
      const dist = Math.hypot((x || 0) - wave.x, (z || 0) - wave.z);
      const threshold = wave.outerRadius - wave.elapsed * wave.speed;
      if (dist < Math.max(wave.ventRadius, threshold)) continue;
      const info = { ...wave, dist, threshold };
      if (!best || dist > best.dist) best = info;
    }
    return best;
  }

  function caveFeatureForCell(seed, world, cellX, cellZ) {
    if (!world) return null;
    const cellSize = 96;
    const centerX = cellX * cellSize + Math.floor(cellSize * (0.24 + noise2(seed + 2111, cellX, cellZ) * 0.52));
    const centerZ = cellZ * cellSize + Math.floor(cellSize * (0.24 + noise2(seed + 2113, cellX, cellZ) * 0.52));
    if (centerX <= 2 || centerZ <= 2 || centerX >= world.w - 3 || centerZ >= world.d - 3) return null;
    if (!farFromSpawn(world, centerX, centerZ, 28)) return null;
    const centerBiome = baseLandBiome(seed, centerX, centerZ);
    const featureChance = centerBiome === 'mountains' ? 0.7 : 0.18;
    if (noise2(seed + 2115, cellX, cellZ) > featureChance) return null;
    const isThrough = centerBiome === 'mountains' || noise2(seed + 2117, cellX, cellZ) < 0.1;
    const startY = terrainHeight(seed, centerX, centerZ) + 1;
    const length = isThrough
      ? 58 + Math.floor(noise2(seed + 2119, cellX, cellZ) * 26)
      : 22 + Math.floor(noise2(seed + 2121, cellX, cellZ) * 18);
    const angle = noise2(seed + 2123, cellX, cellZ) * Math.PI * 2;
    const endX = Math.max(3, Math.min(world.w - 4, centerX + Math.round(Math.cos(angle) * length)));
    const endZ = Math.max(3, Math.min(world.d - 4, centerZ + Math.round(Math.sin(angle) * length)));
    const throughTargetY = 18 + Math.floor(noise2(seed + 2125, cellX, cellZ) * 7);
    const endY = isThrough
      ? Math.max(4, Math.min(throughTargetY, startY - 12 - Math.floor(noise2(seed + 2127, cellX, cellZ) * 10)))
      : Math.max(5, startY - 16 - Math.floor(noise2(seed + 2127, cellX, cellZ) * 16));
    const hasStream = isThrough
      ? noise2(seed + 2133, cellX, cellZ) < 0.28
      : noise2(seed + 2135, cellX, cellZ) < 0.34;
    const hasEndPool = !isThrough && noise2(seed + 2137, cellX, cellZ) < (hasStream ? 1 : 0.45);
    return {
      x: centerX,
      z: centerZ,
      startY,
      endX,
      endY,
      endZ,
      radius: 2.2 + noise2(seed + 2129, cellX, cellZ) * 1.4,
      type: isThrough ? 'through' : 'deadend',
      hasStream,
      hasEndPool,
      biome: centerBiome,
    };
  }

  function getCaveEntrancesInArea3D(state, minX, minZ, maxX, maxZ) {
    const world = state && state.world;
    if (!world || !state.worldMeta) return [];
    const seed = worldSeed(state);
    const cellSize = 96;
    const fromCellX = Math.floor(Math.max(0, minX) / cellSize) - 1;
    const toCellX = Math.floor(Math.min(world.w - 1, maxX) / cellSize) + 1;
    const fromCellZ = Math.floor(Math.max(0, minZ) / cellSize) - 1;
    const toCellZ = Math.floor(Math.min(world.d - 1, maxZ) / cellSize) + 1;
    const entrances = [];
    for (let cz = fromCellZ; cz <= toCellZ; cz += 1) {
      for (let cx = fromCellX; cx <= toCellX; cx += 1) {
        const entrance = caveFeatureForCell(seed, world, cx, cz);
        if (!entrance) continue;
        if (entrance.x < minX || entrance.x > maxX || entrance.z < minZ || entrance.z > maxZ) continue;
        entrances.push(entrance);
      }
    }
    return entrances;
  }

  const VILLAGE_COUNT = 4;
  const VILLAGE_BLOCK_GENERATION_ENABLED = true;
  const VILLAGE_PATHS_ENABLED = true;
  const VILLAGE_BUILDINGS_ENABLED = true;
  const VILLAGE_WORK_AREAS_ENABLED = true;
  const VILLAGE_TERRAIN_FLATTEN_ENABLED = false;
  const VILLAGE_MIN_SPAWN_DISTANCE = 220;
  const VILLAGE_MIN_DISTANCE = 300;
  const VILLAGE_MARGIN = 128;
  const DECORATION_MIN_WRITE_BELOW = 3;
  const DECORATION_MAX_WRITE_ABOVE = 26;
  const VILLAGE_BUILDING_CLEAR_HEIGHT = 8;
  const VILLAGE_BUILDING_FOUNDATION_DEPTH = 16;
  const TREE_CROWN_RADIUS = 2;
  const DECORATION_COLUMN_MAX_FAILURES = 3;
  const VILLAGE_PROFESSIONS = [
    'animal_farmer',
    'crop_farmer',
    'merchant',
    'mason',
    'builder',
    'lumberjack',
  ];
  const VILLAGE_STYLES = [
    { id: 'green', color: '#4f9f5f', roof: BLOCK.LEAF, wall: BLOCK.PLANK },
    { id: 'blue', color: '#4f80c8', roof: BLOCK.SPRUCE_LEAF || BLOCK.LEAF, wall: BLOCK.WOOD },
    { id: 'red', color: '#b65b48', roof: BLOCK.RED_EARTH || BLOCK.DIRT, wall: BLOCK.PLANK },
    { id: 'gold', color: '#c6a348', roof: BLOCK.SAND, wall: BLOCK.STONE },
  ];

  function villageProfessionSet(seed, index) {
    const professions = ['elder', 'guard'];
    for (let i = 0; i < VILLAGE_PROFESSIONS.length; i += 1) {
      const profession = VILLAGE_PROFESSIONS[i];
      const mustHave = index === i % VILLAGE_COUNT;
      if (mustHave || noise2(seed + 4101 + i * 17, index, i) < 0.58) professions.push(profession);
    }
    return professions;
  }

  function villageResidents(seed, index, professions) {
    const residents = [];
    residents.push({ id: `${index}-elder`, profession: 'elder' });
    residents.push({ id: `${index}-guard`, profession: 'guard' });
    const workerProfessions = professions.filter((profession) => profession !== 'elder' && profession !== 'guard');
    for (let i = 0; residents.length < 12; i += 1) {
      const profession = workerProfessions.length
        ? workerProfessions[Math.floor(noise2(seed + 4201, index, i) * workerProfessions.length) % workerProfessions.length]
        : 'guard';
      residents.push({ id: `${index}-${residents.length}`, profession });
    }
    return residents;
  }

  function scoreVillageSite(seed, world, x, z, chosen) {
    if (x < VILLAGE_MARGIN || z < VILLAGE_MARGIN || x > world.w - VILLAGE_MARGIN || z > world.d - VILLAGE_MARGIN) return null;
    if (!farFromSpawn(world, x, z, VILLAGE_MIN_SPAWN_DISTANCE)) return null;
    for (const village of chosen) {
      if (Math.hypot(x - village.x, z - village.z) < VILLAGE_MIN_DISTANCE) return null;
    }
    const biome = biomeAt(seed, x, z);
    if (biome === 'lake' || biome === 'beach' || biome === 'mountains' || biome === 'geysers') return null;

    let minH = Infinity;
    let maxH = -Infinity;
    let forest = 0;
    let plains = 0;
    let desert = 0;
    let waterNearby = 0;
    for (let dz = -24; dz <= 24; dz += 12) {
      for (let dx = -24; dx <= 24; dx += 12) {
        const sx = Math.max(1, Math.min(world.w - 2, x + dx));
        const sz = Math.max(1, Math.min(world.d - 2, z + dz));
        const h = terrainHeight(seed, sx, sz);
        minH = Math.min(minH, h);
        maxH = Math.max(maxH, h);
        const sampleBiome = biomeAt(seed, sx, sz);
        if (sampleBiome === 'lake') waterNearby += 1;
        else if (sampleBiome === 'forest') forest += 1;
        else if (sampleBiome === 'plains') plains += 1;
        else if (sampleBiome === 'desert') desert += 1;
      }
    }
    const roughness = maxH - minH;
    if (roughness > 7) return null;
    const usefulMix = Math.min(1, (forest + plains + desert) / 12);
    const biomeScore = biome === 'plains' ? 1 : (biome === 'forest' ? 0.82 : 0.68);
    const waterScore = Math.min(0.16, waterNearby * 0.025);
    const roughScore = Math.max(0, 1 - roughness / 8);
    return biomeScore * 0.45 + roughScore * 0.42 + usefulMix * 0.18 + waterScore;
  }

  function fallbackVillageSiteScore(seed, world, x, z, chosen) {
    if (x < VILLAGE_MARGIN || z < VILLAGE_MARGIN || x > world.w - VILLAGE_MARGIN || z > world.d - VILLAGE_MARGIN) return null;
    if (!farFromSpawn(world, x, z, VILLAGE_MIN_SPAWN_DISTANCE * 0.72)) return null;
    let distanceScore = 1;
    for (const village of chosen) {
      const distance = Math.hypot(x - village.x, z - village.z);
      if (distance < VILLAGE_MIN_DISTANCE * 0.58) return null;
      distanceScore = Math.min(distanceScore, Math.max(0, Math.min(1, (distance - VILLAGE_MIN_DISTANCE * 0.58) / (VILLAGE_MIN_DISTANCE * 0.34))));
    }
    const biome = biomeAt(seed, x, z);
    const biomeScore = biome === 'plains' ? 1
      : (biome === 'forest' ? 0.86
        : (biome === 'desert' ? 0.72
          : (biome === 'beach' ? 0.32
            : (biome === 'mountains' ? 0.18 : 0.06))));
    let minH = Infinity;
    let maxH = -Infinity;
    for (let dz = -30; dz <= 30; dz += 10) {
      for (let dx = -30; dx <= 30; dx += 10) {
        const sx = Math.max(1, Math.min(world.w - 2, x + dx));
        const sz = Math.max(1, Math.min(world.d - 2, z + dz));
        const h = terrainHeight(seed, sx, sz);
        minH = Math.min(minH, h);
        maxH = Math.max(maxH, h);
      }
    }
    const roughness = maxH - minH;
    const roughScore = Math.max(0, 1 - roughness / 18);
    return biomeScore * 0.5 + roughScore * 0.38 + distanceScore * 0.22;
  }

  function villageCandidateInRegion(seed, world, index, region, chosen) {
    let best = null;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const roll = index * 101 + attempt;
      const x = Math.floor(region.minX + noise2(seed + 4001, roll, index) * Math.max(1, region.maxX - region.minX));
      const z = Math.floor(region.minZ + noise2(seed + 4003, index, roll) * Math.max(1, region.maxZ - region.minZ));
      const score = scoreVillageSite(seed, world, x, z, chosen);
      if (score === null) continue;
      if (!best || score > best.score) best = { x, z, score };
    }
    return best;
  }

  function fallbackVillageCandidateInRegion(seed, world, index, region, chosen) {
    let best = null;
    const step = 32;
    let ordinal = 0;
    for (let z = region.minZ; z <= region.maxZ; z += step) {
      for (let x = region.minX; x <= region.maxX; x += step) {
        const jitterX = Math.floor((noise2(seed + 4041, index, ordinal) - 0.5) * step * 0.7);
        const jitterZ = Math.floor((noise2(seed + 4043, ordinal, index) - 0.5) * step * 0.7);
        const sx = Math.floor(Math.max(region.minX, Math.min(region.maxX, x + jitterX)));
        const sz = Math.floor(Math.max(region.minZ, Math.min(region.maxZ, z + jitterZ)));
        const score = fallbackVillageSiteScore(seed, world, sx, sz, chosen);
        if (score !== null && (!best || score > best.score)) best = { x: sx, z: sz, score, relaxed: true };
        ordinal += 1;
      }
    }
    return best;
  }

  function getVillages3D(state) {
    const world = state && state.world;
    if (!world || !state.worldMeta || state.worldMeta.currentDimension === 'underground') return [];
    const cavernAxis = state.worldMeta.easterEgg === 'cavern_fall' ? state.worldMeta.cavernFallAxis : '';
    const planningWorld = cavernAxis ? {
      ...world,
      w: Game.constants3d.WORLD_W,
      d: Game.constants3d.WORLD_D,
    } : world;
    const villagesKey = `${state.worldMeta.seed || ''}:${planningWorld.w}:${planningWorld.d}:${cavernAxis}`;
    if (world.villagesKey === villagesKey && Array.isArray(world.villages)) {
      return world.villages;
    }
    const seed = worldSeed(state);
    const halfW = planningWorld.w / 2;
    const halfD = planningWorld.d / 2;
    const regions = [
      { minX: VILLAGE_MARGIN, minZ: VILLAGE_MARGIN, maxX: halfW - 48, maxZ: halfD - 48 },
      { minX: halfW + 48, minZ: VILLAGE_MARGIN, maxX: planningWorld.w - VILLAGE_MARGIN, maxZ: halfD - 48 },
      { minX: VILLAGE_MARGIN, minZ: halfD + 48, maxX: halfW - 48, maxZ: planningWorld.d - VILLAGE_MARGIN },
      { minX: halfW + 48, minZ: halfD + 48, maxX: planningWorld.w - VILLAGE_MARGIN, maxZ: planningWorld.d - VILLAGE_MARGIN },
    ];
    const villages = [];
    for (let i = 0; i < VILLAGE_COUNT; i += 1) {
      let candidate = villageCandidateInRegion(seed, planningWorld, i, regions[i], villages);
      if (!candidate) candidate = fallbackVillageCandidateInRegion(seed, planningWorld, i, regions[i], villages);
      if (!candidate) continue;
      const professions = villageProfessionSet(seed, i);
      const style = VILLAGE_STYLES[i % VILLAGE_STYLES.length];
      villages.push({
        id: `village-${i}`,
        name: `Деревня ${i + 1}`,
        x: candidate.x,
        y: terrainHeight(seed, candidate.x, candidate.z) + 1,
        z: candidate.z,
        radius: 42 + Math.floor(noise2(seed + 4301, i, 0) * 18),
        styleId: style.id,
        color: style.color,
        professions,
        residents: villageResidents(seed, i, professions),
      });
    }
    world.villagesKey = villagesKey;
    world.villages = villages;
    return villages;
  }

  function getVillageRoadLinks3D(state) {
    const villages = getVillages3D(state);
    if (villages.length < 2) return [];
    const connected = new Set([0]);
    const links = [];
    while (connected.size < villages.length) {
      let best = null;
      for (const from of connected) {
        for (let to = 0; to < villages.length; to += 1) {
          if (connected.has(to)) continue;
          const a = villages[from];
          const b = villages[to];
          const distance = Math.hypot(a.x - b.x, a.z - b.z);
          if (!best || distance < best.distance) best = { from, to, distance };
        }
      }
      if (!best) break;
      connected.add(best.to);
      links.push(best);
    }
    let extra = null;
    for (let from = 0; from < villages.length; from += 1) {
      for (let to = from + 1; to < villages.length; to += 1) {
        if (links.some((link) => (link.from === from && link.to === to) || (link.from === to && link.to === from))) continue;
        const a = villages[from];
        const b = villages[to];
        const distance = Math.hypot(a.x - b.x, a.z - b.z);
        if (!extra || distance < extra.distance) extra = { from, to, distance };
      }
    }
    if (extra) links.push(extra);
    return links.map((link) => ({
      from: villages[link.from].id,
      to: villages[link.to].id,
      fromX: villages[link.from].x,
      fromZ: villages[link.from].z,
      toX: villages[link.to].x,
      toZ: villages[link.to].z,
      planned: true,
    }));
  }

  const TREASURY_COUNT_MIN = 3;
  const TREASURY_COUNT_MAX = 4;
  const TREASURY_MARGIN = 96;
  const TREASURY_MIN_DISTANCE = 260;
  const TREASURY_SURFACE_NEAR_MIN = 100;
  const TREASURY_SURFACE_NEAR_MAX = 200;
  const TREASURY_PARKOUR_SNAKES = 10;

  function randInt(rng, min, max) {
    return min + Math.floor(rng() * (max - min + 1));
  }

  function shuffleDeterministic(list, rng) {
    const result = list.slice();
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      const temp = result[i];
      result[i] = result[j];
      result[j] = temp;
    }
    return result;
  }

  function treasurySiteAllowed(seed, world, x, z, chosen, options = {}) {
    if (!world) return false;
    if (x < TREASURY_MARGIN || z < TREASURY_MARGIN || x > world.w - TREASURY_MARGIN || z > world.d - TREASURY_MARGIN) return false;
    const biome = biomeAt(seed, x, z);
    if (biome === 'lake' || biome === 'beach' || biome === 'geysers' || biome === 'volcanic') return false;
    const ground = terrainHeight(seed, x, z);
    if (ground < 14 || ground > world.h - 18) return false;
    for (const treasury of chosen) {
      if (Math.hypot(x - treasury.x, z - treasury.z) < TREASURY_MIN_DISTANCE) return false;
    }
    const villages = options.villages || [];
    for (const village of villages) {
      if (Math.hypot(x - village.x, z - village.z) < village.radius + 80) return false;
    }
    return true;
  }

  function findNearSpawnTreasurySite(seed, world, villages) {
    const rng = seededRandom(`${seed}:treasury-near-spawn`);
    const spawnX = Math.floor(world.w / 2);
    const spawnZ = Math.floor(world.d / 2);
    let best = null;
    for (let attempt = 0; attempt < 64; attempt += 1) {
      const angle = rng() * Math.PI * 2;
      const distance = TREASURY_SURFACE_NEAR_MIN + rng() * (TREASURY_SURFACE_NEAR_MAX - TREASURY_SURFACE_NEAR_MIN);
      const x = Math.round(spawnX + Math.cos(angle) * distance);
      const z = Math.round(spawnZ + Math.sin(angle) * distance);
      if (!treasurySiteAllowed(seed, world, x, z, [], { villages })) continue;
      let roughness = 0;
      let minH = Infinity;
      let maxH = -Infinity;
      for (let dz = -5; dz <= 5; dz += 5) {
        for (let dx = -5; dx <= 5; dx += 5) {
          const h = terrainHeight(seed, x + dx, z + dz);
          minH = Math.min(minH, h);
          maxH = Math.max(maxH, h);
        }
      }
      roughness = maxH - minH;
      const score = Math.max(0, 1 - roughness / 12) + (1 - Math.abs(distance - 150) / 80) * 0.35;
      if (!best || score > best.score) best = { x, z, score };
    }
    if (!best) {
      for (let distance = TREASURY_SURFACE_NEAR_MIN; distance <= TREASURY_SURFACE_NEAR_MAX && !best; distance += 16) {
        for (let step = 0; step < 24; step += 1) {
          const angle = (step / 24) * Math.PI * 2;
          const x = Math.round(spawnX + Math.cos(angle) * distance);
          const z = Math.round(spawnZ + Math.sin(angle) * distance);
          if (treasurySiteAllowed(seed, world, x, z, [], { villages })) {
            best = { x, z, score: 0 };
            break;
          }
        }
      }
    }
    if (!best) {
      const x = Math.max(TREASURY_MARGIN, Math.min(world.w - TREASURY_MARGIN, spawnX + 150));
      const z = Math.max(TREASURY_MARGIN, Math.min(world.d - TREASURY_MARGIN, spawnZ));
      best = { x, z, score: -1 };
    }
    return {
      id: 'treasury-0',
      type: 'surface',
      x: best.x,
      y: terrainHeight(seed, best.x, best.z) + 1,
      z: best.z,
    };
  }

  function findSurfaceTreasurySite(seed, world, index, chosen, villages) {
    const rng = seededRandom(`${seed}:treasury-surface:${index}`);
    let best = null;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const x = TREASURY_MARGIN + Math.floor(rng() * Math.max(1, world.w - TREASURY_MARGIN * 2));
      const z = TREASURY_MARGIN + Math.floor(rng() * Math.max(1, world.d - TREASURY_MARGIN * 2));
      if (!farFromSpawn(world, x, z, 260)) continue;
      if (!treasurySiteAllowed(seed, world, x, z, chosen, { villages })) continue;
      const biome = biomeAt(seed, x, z);
      const biomeScore = biome === 'plains' ? 1 : (biome === 'forest' || biome === 'spruce_forest' ? 0.82 : 0.62);
      const score = biomeScore + rng() * 0.18;
      if (!best || score > best.score) best = { x, z, score };
    }
    if (!best) {
      const rng2 = seededRandom(`${seed}:treasury-surface-fallback:${index}`);
      for (let ring = 0; ring < 10 && !best; ring += 1) {
        const distance = 280 + ring * 80;
        for (let step = 0; step < 32; step += 1) {
          const angle = ((step + rng2()) / 32) * Math.PI * 2;
          const x = Math.round(world.w / 2 + Math.cos(angle) * distance);
          const z = Math.round(world.d / 2 + Math.sin(angle) * distance);
          if (treasurySiteAllowed(seed, world, x, z, chosen, { villages })) {
            best = { x, z, score: 0 };
            break;
          }
        }
      }
    }
    if (!best) {
      const offset = 320 + index * 170;
      const side = index % 4;
      const x = Math.max(TREASURY_MARGIN, Math.min(world.w - TREASURY_MARGIN, world.w / 2 + (side === 0 ? offset : side === 1 ? -offset : 0)));
      const z = Math.max(TREASURY_MARGIN, Math.min(world.d - TREASURY_MARGIN, world.d / 2 + (side === 2 ? offset : side === 3 ? -offset : 0)));
      best = { x: Math.round(x), z: Math.round(z), score: -1 };
    }
    return {
      id: `treasury-${index}`,
      type: 'surface',
      x: best.x,
      y: terrainHeight(seed, best.x, best.z) + 1,
      z: best.z,
    };
  }

  function addPlanCell(map, x, z, kind = 'corridor') {
    const key = `${x},${z}`;
    const existing = map.get(key);
    if (existing) {
      if (kind === 'room' || kind === 'final') existing.kind = kind;
      if (kind === 'parkour' && existing.kind !== 'final') existing.kind = kind;
      return existing;
    }
    const cell = { x, z, kind };
    map.set(key, cell);
    return cell;
  }

  function addRoomCells(map, room, kind) {
    for (let z = room.z0; z <= room.z1; z += 1) {
      for (let x = room.x0; x <= room.x1; x += 1) addPlanCell(map, x, z, kind);
    }
  }

  function addCorridorCells(map, ax, az, bx, bz, rng) {
    addCorridorCellsOfKind(map, ax, az, bx, bz, rng, 'corridor');
  }

  function addCorridorCellsOfKind(map, ax, az, bx, bz, rng, kind) {
    const firstX = rng() < 0.5;
    const draw = (x0, z0, x1, z1) => {
      const dx = Math.sign(x1 - x0);
      const dz = Math.sign(z1 - z0);
      let x = x0;
      let z = z0;
      for (;;) {
        addPlanCell(map, x, z, kind);
        if (x === x1 && z === z1) break;
        if (x !== x1) x += dx;
        if (z !== z1) z += dz;
      }
    };
    if (firstX) {
      draw(ax, az, bx, az);
      draw(bx, az, bx, bz);
    } else {
      draw(ax, az, ax, bz);
      draw(ax, bz, bx, bz);
    }
  }

  function treasuryRoomFits(room, limit) {
    return room.x0 >= -limit && room.z0 >= -limit && room.x1 <= limit && room.z1 <= limit;
  }

  function addTreasuryParkourRoom(cells, finalRoom, rng) {
    const horizontal = Math.abs(finalRoom.cx) >= Math.abs(finalRoom.cz);
    const positive = horizontal ? finalRoom.cx >= 0 : finalRoom.cz >= 0;
    const length = randInt(rng, 12, 16);
    const halfWidth = 2;
    let room;
    if (horizontal) {
      const endX = positive ? finalRoom.x0 - 1 : finalRoom.x1 + 1;
      const startX = endX + (positive ? -length + 1 : length - 1);
      room = {
        x0: Math.min(startX, endX),
        x1: Math.max(startX, endX),
        z0: finalRoom.cz - halfWidth,
        z1: finalRoom.cz + halfWidth,
        axis: 'x',
        positive,
      };
    } else {
      const endZ = positive ? finalRoom.z0 - 1 : finalRoom.z1 + 1;
      const startZ = endZ + (positive ? -length + 1 : length - 1);
      room = {
        x0: finalRoom.cx - halfWidth,
        x1: finalRoom.cx + halfWidth,
        z0: Math.min(startZ, endZ),
        z1: Math.max(startZ, endZ),
        axis: 'z',
        positive,
      };
    }
    const safe = [];
    const steps = 7;
    for (let i = 0; i < steps; i += 1) {
      const t = steps === 1 ? 0 : i / (steps - 1);
      const wiggle = i === 0 || i === steps - 1 ? 0 : randInt(rng, -1, 1);
      if (room.axis === 'x') {
        const x = Math.round((room.positive ? room.x0 : room.x1) + (room.positive ? 1 : -1) * t * (length - 1));
        safe.push({ x, z: finalRoom.cz + wiggle });
      } else {
        const z = Math.round((room.positive ? room.z0 : room.z1) + (room.positive ? 1 : -1) * t * (length - 1));
        safe.push({ x: finalRoom.cx + wiggle, z });
      }
    }
    for (let z = room.z0; z <= room.z1; z += 1) {
      for (let x = room.x0; x <= room.x1; x += 1) addPlanCell(cells, x, z, 'parkour');
    }
    if (finalRoom.parent) {
      addCorridorCellsOfKind(cells, finalRoom.parent.cx, finalRoom.parent.cz, safe[0].x, safe[0].z, rng, 'parkour');
      addCorridorCellsOfKind(cells, safe[safe.length - 1].x, safe[safe.length - 1].z, finalRoom.cx, finalRoom.cz, rng, 'parkour');
    }
    return { ...room, safe };
  }

  function generateTreasuryLayout(treasury, seed, world) {
    if (treasury.layout) return treasury.layout;
    const rng = seededRandom(`${seed}:treasury-layout:${treasury.id}:${treasury.type}`);
    const roomTarget = randInt(rng, 10, 15);
    const limit = 64;
    const cells = new Map();
    const rooms = [];
    const startRoom = {
      x0: -randInt(rng, 3, 5),
      z0: -randInt(rng, 3, 5),
      x1: randInt(rng, 3, 5),
      z1: randInt(rng, 3, 5),
      cx: 0,
      cz: 0,
    };
    rooms.push(startRoom);
    addRoomCells(cells, startRoom, 'room');
    for (let i = 1; i < roomTarget; i += 1) {
      let placed = null;
      for (let attempt = 0; attempt < 40 && !placed; attempt += 1) {
        const parent = rooms[Math.floor(rng() * rooms.length)];
        const dir = shuffleDeterministic([[1, 0], [-1, 0], [0, 1], [0, -1]], rng)[0];
        const distance = randInt(rng, 14, 28);
        const w = randInt(rng, 6, 13);
        const d = randInt(rng, 6, 13);
        const cx = parent.cx + dir[0] * distance + randInt(rng, -6, 6);
        const cz = parent.cz + dir[1] * distance + randInt(rng, -6, 6);
        const room = {
          x0: cx - Math.floor(w / 2),
          z0: cz - Math.floor(d / 2),
          x1: cx + Math.ceil(w / 2),
          z1: cz + Math.ceil(d / 2),
          cx,
          cz,
          parent,
        };
        if (!treasuryRoomFits(room, limit)) continue;
        placed = room;
      }
      if (!placed) continue;
      rooms.push(placed);
      addRoomCells(cells, placed, 'room');
      addCorridorCells(cells, placed.parent.cx, placed.parent.cz, placed.cx, placed.cz, rng);
    }
    let finalRoom = rooms[0];
    for (const room of rooms) {
      if (Math.hypot(room.cx, room.cz) > Math.hypot(finalRoom.cx, finalRoom.cz)) finalRoom = room;
    }
    addRoomCells(cells, finalRoom, 'final');
    const parkour = addTreasuryParkourRoom(cells, finalRoom, rng);

    const sideRooms = shuffleDeterministic(rooms.filter((room) => room !== finalRoom && room !== startRoom), rng);
    const sideChestCount = Math.min(sideRooms.length, randInt(rng, 1, 3));
    const chests = [{ x: treasury.x + finalRoom.cx, z: treasury.z + finalRoom.cz, table: 'treasury_final' }];
    for (let i = 0; i < sideChestCount; i += 1) {
      const room = sideRooms[i];
      chests.push({
        x: treasury.x + randInt(rng, room.x0 + 1, room.x1 - 1),
        z: treasury.z + randInt(rng, room.z0 + 1, room.z1 - 1),
        table: 'treasury_side',
      });
    }

    let minX = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxZ = -Infinity;
    const worldCells = new Map();
    for (const cell of cells.values()) {
      cell.x += treasury.x;
      cell.z += treasury.z;
      worldCells.set(`${cell.x},${cell.z}`, cell);
      minX = Math.min(minX, cell.x);
      minZ = Math.min(minZ, cell.z);
      maxX = Math.max(maxX, cell.x);
      maxZ = Math.max(maxZ, cell.z);
    }
    const worldParkour = parkour ? {
      x0: parkour.x0 + treasury.x,
      x1: parkour.x1 + treasury.x,
      z0: parkour.z0 + treasury.z,
      z1: parkour.z1 + treasury.z,
      axis: parkour.axis,
      safe: parkour.safe.map((cell) => ({ x: cell.x + treasury.x, z: cell.z + treasury.z })),
      safeKeys: new Set(parkour.safe.map((cell) => `${cell.x + treasury.x},${cell.z + treasury.z}`)),
    } : null;
    const floorY = Math.max(7, Math.min(world.h - 8, treasury.y - randInt(rng, 11, 18)));
    const entranceDepth = Math.max(1, treasury.y - floorY);
    const layout = {
      y: floorY,
      entranceDepth,
      parkour: worldParkour,
      cells: worldCells,
      rooms,
      chests,
      minX: minX - 2,
      minZ: minZ - 2,
      maxX: maxX + 2,
      maxZ: maxZ + 2 + entranceDepth,
    };
    treasury.layout = layout;
    treasury.radius = Math.ceil(Math.max(
      Math.abs(layout.minX - treasury.x),
      Math.abs(layout.maxX - treasury.x),
      Math.abs(layout.minZ - treasury.z),
      Math.abs(layout.maxZ - treasury.z),
    ));
    return layout;
  }

  function getTreasuries3D(state) {
    const world = state && state.world;
    if (world) {
      world.treasuriesKey = 'disabled';
      world.treasuries = [];
    }
    return [];
  }

  function treasuryIntersectsBounds(treasury, bounds) {
    const layout = treasury && treasury.layout;
    return !!(layout
      && layout.maxX >= bounds.minX
      && layout.minX < bounds.maxX
      && layout.maxZ >= bounds.minZ
      && layout.minZ < bounds.maxZ);
  }

  function isChunkRangeGenerated(world, cx, cz, minCy, maxCy, counts) {
    if (cx < 0 || cz < 0 || cx >= counts.x || cz >= counts.z || !world || !world.generatedChunks) return false;
    for (let cy = Math.max(0, minCy); cy <= Math.min(counts.y - 1, maxCy); cy += 1) {
      if (!world.generatedChunks.has(chunkKey(cx, cy, cz))) return false;
    }
    return true;
  }

  function treasuryChunkRange(treasury, counts) {
    const layout = treasury && treasury.layout;
    if (!layout) return { minCy: 0, maxCy: 0 };
    const minY = Math.max(1, layout.y - 6);
    const maxY = Math.min((counts.y * CHUNK_SIZE) - 1, Math.max(layout.y + 5, treasury.y + 2));
    return {
      minCy: Math.max(0, Math.floor(minY / CHUNK_SIZE)),
      maxCy: Math.min(counts.y - 1, Math.floor(maxY / CHUNK_SIZE)),
    };
  }

  function isTreasuryDecorationReady(world, treasury, cx, cz, counts) {
    const range = treasuryChunkRange(treasury, counts);
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= counts.x || nz >= counts.z) continue;
        if (!isChunkRangeGenerated(world, nx, nz, range.minCy, range.maxCy, counts)) return false;
      }
    }
    return true;
  }

  function treasuryFloorCell(layout, x, z) {
    return layout.cells.get(`${x},${z}`) || null;
  }

  function treasuryNearFloor(layout, x, z) {
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dz === 0) continue;
        if (treasuryFloorCell(layout, x + dx, z + dz)) return true;
      }
    }
    return false;
  }

  function placeTreasuryRoomColumn(state, layout, x, z, cell) {
    const y = layout.y;
    setBlock3D(state, x, y - 1, z, cell.kind === 'final' ? BLOCK.BLACKSTONE : BLOCK.STONE);
    const clearTop = cell.kind === 'corridor' ? y + 1 : y + 3;
    for (let yy = y; yy <= clearTop; yy += 1) setBlock3D(state, x, yy, z, BLOCK.AIR);
    setBlock3D(state, x, clearTop + 1, z, cell.kind === 'final' ? BLOCK.BLACKSTONE : BLOCK.STONE);
  }

  function placeTreasuryWallColumn(state, layout, x, z) {
    const y = layout.y;
    setBlock3D(state, x, y - 1, z, BLOCK.STONE);
    for (let yy = y; yy <= y + 3; yy += 1) setBlock3D(state, x, yy, z, BLOCK.STONE);
    setBlock3D(state, x, y + 4, z, BLOCK.STONE);
  }

  function isTreasuryParkourSafe(layout, x, z) {
    return !!(layout.parkour && layout.parkour.safeKeys && layout.parkour.safeKeys.has(`${x},${z}`));
  }

  function placeTreasuryParkourColumn(state, layout, x, z) {
    const y = layout.y;
    const safe = isTreasuryParkourSafe(layout, x, z);
    const pitFloorY = y - 5;
    if (pitFloorY >= 1) {
      setBlock3D(state, x, pitFloorY, z, BLOCK.STONE);
      for (let yy = pitFloorY + 1; yy <= y - 2; yy += 1) setBlock3D(state, x, yy, z, BLOCK.AIR);
    }
    setBlock3D(state, x, y - 1, z, safe ? BLOCK.STONE : BLOCK.BROKEN_STONE);
    for (let yy = y; yy <= y + 3; yy += 1) setBlock3D(state, x, yy, z, BLOCK.AIR);
    setBlock3D(state, x, y + 4, z, safe ? BLOCK.DIRT : BLOCK.STONE);
  }

  function placeTreasuryEntranceColumn(state, treasury, layout, x, z) {
    if (treasury.type === 'surface') {
      const dx = x - treasury.x;
      const dz = z - treasury.z;
      if (Math.abs(dx) <= 2 && dz >= -2 && dz <= 1) {
        setBlock3D(state, x, treasury.y - 1, z, BLOCK.STONE);
        if (Math.abs(dx) === 2 || dz === -2 || dz === 1) {
          setBlock3D(state, x, treasury.y, z, BLOCK.PILLAR);
          return true;
        } else {
          setBlock3D(state, x, treasury.y, z, BLOCK.AIR);
          setBlock3D(state, x, treasury.y + 1, z, BLOCK.AIR);
        }
      }
      const depth = Math.max(1, layout.entranceDepth || treasury.y - layout.y);
      if (Math.abs(dx) > 1 || dz < 0 || dz > depth + 2) return false;
      const y = treasury.y - dz;
      if (y >= layout.y && y <= treasury.y) {
        setBlock3D(state, x, y - 1, z, BLOCK.STONE);
        setBlock3D(state, x, y, z, BLOCK.AIR);
        setBlock3D(state, x, y + 1, z, BLOCK.AIR);
        setBlock3D(state, x, y + 2, z, BLOCK.AIR);
      }
      setBlock3D(state, x, layout.y - 1, z, BLOCK.STONE);
      for (let yy = layout.y; yy <= layout.y + 3; yy += 1) setBlock3D(state, x, yy, z, BLOCK.AIR);
      setBlock3D(state, x, layout.y + 4, z, BLOCK.STONE);
      if (Math.abs(dx) === 1) {
        setBlock3D(state, x, layout.y, z, BLOCK.STONE);
        setBlock3D(state, x, layout.y + 1, z, BLOCK.STONE);
      }
      return true;
    }
    return false;
  }

  function forceGenerateChunkRange(state, seed, minX, minY, minZ, maxX, maxY, maxZ) {
    const world = state && state.world;
    if (!world) return 0;
    const counts = chunkCounts(world);
    const minCx = Math.max(0, Math.floor(minX / CHUNK_SIZE));
    const maxCx = Math.min(counts.x - 1, Math.floor(maxX / CHUNK_SIZE));
    const minCy = Math.max(0, Math.floor(minY / CHUNK_SIZE));
    const maxCy = Math.min(counts.y - 1, Math.floor(maxY / CHUNK_SIZE));
    const minCz = Math.max(0, Math.floor(minZ / CHUNK_SIZE));
    const maxCz = Math.min(counts.z - 1, Math.floor(maxZ / CHUNK_SIZE));
    let generated = 0;
    for (let cz = minCz; cz <= maxCz; cz += 1) {
      for (let cx = minCx; cx <= maxCx; cx += 1) {
        for (let cy = minCy; cy <= maxCy; cy += 1) {
          if (generateTerrainChunk3D(state, seed, cx, cy, cz)) {
            if (world.dirtyChunks) world.dirtyChunks.add(chunkKey(cx, cy, cz));
            generated += 1;
          }
        }
      }
    }
    return generated;
  }

  function forceGenerateChunkColumns(state, seed, columns, minY, maxY) {
    const world = state && state.world;
    if (!world || !columns || !columns.length) return 0;
    const counts = chunkCounts(world);
    const minCy = Math.max(0, Math.floor(minY / CHUNK_SIZE));
    const maxCy = Math.min(counts.y - 1, Math.floor(maxY / CHUNK_SIZE));
    let generated = 0;
    for (const column of columns) {
      for (let cy = minCy; cy <= maxCy; cy += 1) {
        if (generateTerrainChunk3D(state, seed, column.cx, cy, column.cz)) {
          if (world.dirtyChunks) world.dirtyChunks.add(chunkKey(column.cx, cy, column.cz));
          generated += 1;
        }
      }
    }
    return generated;
  }

  function treasuryBodyChunkColumns(treasury, counts) {
    const layout = treasury && treasury.layout;
    if (!layout) return [];
    const columns = new Map();
    function add(x, z) {
      if (x < 0 || z < 0) return;
      const cx = Math.floor(x / CHUNK_SIZE);
      const cz = Math.floor(z / CHUNK_SIZE);
      if (cx < 0 || cz < 0 || cx >= counts.x || cz >= counts.z) return;
      columns.set(columnKey(cx, cz), { cx, cz });
    }
    for (const cell of layout.cells.values()) {
      for (let dz = -1; dz <= 1; dz += 1) {
        for (let dx = -1; dx <= 1; dx += 1) add(cell.x + dx, cell.z + dz);
      }
    }
    const depth = Math.max(1, layout.entranceDepth || treasury.y - layout.y);
    for (let z = treasury.z - 2; z <= treasury.z + depth + 2; z += 1) {
      for (let x = treasury.x - 2; x <= treasury.x + 2; x += 1) add(x, z);
    }
    return Array.from(columns.values());
  }

  function ensureTreasuryEntranceNow(state, seed, treasury) {
    const world = state && state.world;
    const layout = treasury && treasury.layout;
    if (!world || !layout || treasury.type !== 'surface') return 0;
    if (!world.ensuredTreasuryEntrances) world.ensuredTreasuryEntrances = new Set();
    if (world.ensuredTreasuryEntrances.has(treasury.id)) return 0;

    const depth = Math.max(1, layout.entranceDepth || treasury.y - layout.y);
    const minX = Math.max(0, treasury.x - 2);
    const maxX = Math.min(world.w - 1, treasury.x + 2);
    const minZ = Math.max(0, treasury.z - 2);
    const maxZ = Math.min(world.d - 1, treasury.z + depth + 2);
    let changed = forceGenerateChunkRange(state, seed, minX, layout.y - 1, minZ, maxX, treasury.y + 2, maxZ);

    world.suppressChunkModification = (world.suppressChunkModification || 0) + 1;
    try {
      for (let z = minZ; z <= maxZ; z += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          if (placeTreasuryEntranceColumn(state, treasury, layout, x, z)) changed += 1;
        }
      }
    } finally {
      world.suppressChunkModification -= 1;
    }
    world.ensuredTreasuryEntrances.add(treasury.id);
    return changed;
  }

  function ensureTreasuryBodyNow(state, seed, treasury) {
    const world = state && state.world;
    const layout = treasury && treasury.layout;
    if (!world || !layout) return 0;
    if (!world.ensuredTreasuryBodies) world.ensuredTreasuryBodies = new Set();
    if (world.ensuredTreasuryBodies.has(treasury.id)) return 0;

    const minY = Math.max(1, layout.y - 6);
    const maxY = Math.min(world.h - 1, Math.max(layout.y + 5, treasury.y + 2));
    const counts = chunkCounts(world);
    const columns = treasuryBodyChunkColumns(treasury, counts);
    let changed = forceGenerateChunkColumns(state, seed, columns, minY, maxY);

    world.suppressChunkModification = (world.suppressChunkModification || 0) + 1;
    try {
      for (const column of columns) {
        const bounds = {
          minX: column.cx * CHUNK_SIZE,
          minZ: column.cz * CHUNK_SIZE,
          maxX: Math.min(world.w, (column.cx + 1) * CHUNK_SIZE),
          maxZ: Math.min(world.d, (column.cz + 1) * CHUNK_SIZE),
        };
        if (decorateTreasuriesForColumn(state, [treasury], bounds)) changed += 1;
        if (!world.ensuredTreasuryColumns) world.ensuredTreasuryColumns = new Set();
        world.ensuredTreasuryColumns.add(`${treasury.id}:${columnKey(column.cx, column.cz)}`);
        if (!world.decoratedColumns) world.decoratedColumns = new Set();
        world.decoratedColumns.add(columnKey(column.cx, column.cz));
      }
    } finally {
      world.suppressChunkModification -= 1;
    }
    world.ensuredTreasuryBodies.add(treasury.id);
    return changed;
  }

  function placeTreasuryChests(state, layout, x, z) {
    for (const chest of layout.chests) {
      if (chest.x !== x || chest.z !== z) continue;
      const y = layout.y;
      setBlock3D(state, x, y, z, BLOCK.CHEST);
      markStructureChestLoot(state, x, y, z, chest.table);
    }
  }

  function spawnTreasuryParkourSnakes(state, treasury, layout, bounds) {
    const parkour = layout && layout.parkour;
    if (!parkour || !Game.entities3d || !Game.entities3d.spawnMob3D) return;
    const y = layout.y - 4;
    if (y < 2) return;
    const width = Math.max(1, parkour.x1 - parkour.x0 + 1);
    const depth = Math.max(1, parkour.z1 - parkour.z0 + 1);
    for (let i = 0; i < TREASURY_PARKOUR_SNAKES; i += 1) {
      const sx = parkour.x0 + Math.floor((i * 3 + 1) % width);
      const sz = parkour.z0 + Math.floor((i * 5 + 2) % depth);
      if (sx < bounds.minX || sx >= bounds.maxX || sz < bounds.minZ || sz >= bounds.maxZ) continue;
      const id = `${treasury.id}-parkour-snake-${i}`;
      if (hasMob(state, id)) continue;
      Game.entities3d.spawnMob3D(state, 'snake', sx, y, sz, id);
    }
  }

  function decorateTreasuryColumnAt(state, treasury, x, z) {
    const layout = treasury.layout;
    if (!layout) return false;
    let changed = false;
    if (placeTreasuryEntranceColumn(state, treasury, layout, x, z)) changed = true;
    const cell = treasuryFloorCell(layout, x, z);
    if (cell) {
      if (cell.kind === 'parkour') {
        placeTreasuryParkourColumn(state, layout, x, z);
        return true;
      }
      placeTreasuryRoomColumn(state, layout, x, z, cell);
      placeTreasuryChests(state, layout, x, z);
      return true;
    }
    if (treasuryNearFloor(layout, x, z)) {
      placeTreasuryWallColumn(state, layout, x, z);
      return true;
    }
    return changed;
  }

  function decorateTreasuriesForColumn(state, treasuries, bounds) {
    let changed = false;
    for (const treasury of treasuries) {
      if (!treasuryIntersectsBounds(treasury, bounds)) continue;
      const layout = treasury.layout;
      const minX = Math.max(bounds.minX, layout.minX);
      const maxX = Math.min(bounds.maxX - 1, layout.maxX);
      const minZ = Math.max(bounds.minZ, layout.minZ);
      const maxZ = Math.min(bounds.maxZ - 1, layout.maxZ);
      for (let z = minZ; z <= maxZ; z += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          if (decorateTreasuryColumnAt(state, treasury, x, z)) changed = true;
        }
      }
      spawnTreasuryParkourSnakes(state, treasury, layout, bounds);
    }
    return changed;
  }

  function ensureTreasuriesAroundPlayer3D() {
    return 0;
  }

  function villageStyle(village) {
    return VILLAGE_STYLES.find((style) => style.id === village.styleId) || VILLAGE_STYLES[0];
  }

  function villageHasProfession(village, profession) {
    return village && Array.isArray(village.professions) && village.professions.includes(profession);
  }

  function villageRectContains(rect, lx, lz) {
    return lx >= rect.x && lx < rect.x + rect.w && lz >= rect.z && lz < rect.z + rect.d;
  }

  function villageRectNear(rect, lx, lz, margin) {
    return lx >= rect.x - margin && lx < rect.x + rect.w + margin && lz >= rect.z - margin && lz < rect.z + rect.d + margin;
  }

  function villageRects(village) {
    const rects = [
      { id: 'elder', kind: 'house', x: -5, z: -8, w: 10, d: 8, wall: 'plank', roof: 'style', door: 'south' },
      { id: 'guard', kind: 'house', x: -21, z: -7, w: 7, d: 7, wall: 'stone', roof: 'style', door: 'east' },
      { id: 'storage', kind: 'house', x: 12, z: -7, w: 8, d: 7, wall: 'wood', roof: 'style', door: 'west' },
      { id: 'home-a', kind: 'house', x: -19, z: 11, w: 7, d: 7, wall: 'plank', roof: 'style', door: 'north' },
      { id: 'home-b', kind: 'house', x: 11, z: 11, w: 7, d: 7, wall: 'plank', roof: 'style', door: 'north' },
    ];
    if (villageHasProfession(village, 'merchant')) rects.push({ id: 'shop', kind: 'house', x: 22, z: -2, w: 7, d: 7, wall: 'wood', roof: 'style', door: 'west' });
    if (villageHasProfession(village, 'builder')) rects.push({ id: 'builder', kind: 'house', x: 21, z: 10, w: 8, d: 6, wall: 'stone', roof: 'style', door: 'west' });
    return rects;
  }

  function villageWorkAreaAt(village, lx, lz) {
    if (villageHasProfession(village, 'crop_farmer') && lx >= -31 && lx <= -22 && lz >= -2 && lz <= 19) return 'field';
    if (villageHasProfession(village, 'animal_farmer') && lx >= -31 && lx <= -23 && lz >= -20 && lz <= -11) return 'pen';
    if (villageHasProfession(village, 'mason') && lx >= 22 && lx <= 31 && lz >= -21 && lz <= -13) return 'quarry';
    if (villageHasProfession(village, 'lumberjack') && lx >= 22 && lx <= 31 && lz >= 20 && lz <= 28) return 'woodpile';
    return null;
  }

  function villageRoofOverhangAt(village, lx, lz) {
    if (!VILLAGE_BUILDINGS_ENABLED) return null;
    for (const rect of villageRects(village)) {
      if (villageRectContains(rect, lx, lz)) continue;
      if (villageRectNear(rect, lx, lz, 1)) return { kind: 'roof', rect, lx, lz };
    }
    return null;
  }

  function rectEntrancePoint(rect) {
    const doorX = Math.floor(rect.w / 2);
    const doorZ = Math.floor(rect.d / 2);
    if (rect.door === 'south') return { x: rect.x + doorX, z: rect.z + rect.d, axis: 'z' };
    if (rect.door === 'north') return { x: rect.x + doorX, z: rect.z - 1, axis: 'z' };
    if (rect.door === 'east') return { x: rect.x + rect.w, z: rect.z + doorZ, axis: 'x' };
    return { x: rect.x - 1, z: rect.z + doorZ, axis: 'x' };
  }

  function betweenInclusive(value, a, b) {
    return value >= Math.min(a, b) && value <= Math.max(a, b);
  }

  function villageDoorPathAt(village, lx, lz) {
    for (const rect of villageRects(village)) {
      const entrance = rectEntrancePoint(rect);
      if (entrance.axis === 'z') {
        if (Math.abs(lx - entrance.x) <= 1 && betweenInclusive(lz, entrance.z, 0)) return true;
      } else if (Math.abs(lz - entrance.z) <= 1 && betweenInclusive(lx, entrance.x, 0)) {
        return true;
      }
    }
    return false;
  }

  function villageCellAt(village, x, z) {
    const lx = x - village.x;
    const lz = z - village.z;
    const dist = Math.hypot(lx, lz);
    if (dist > village.radius) return null;

    if (VILLAGE_BUILDINGS_ENABLED) {
      for (const rect of villageRects(village)) {
        if (villageRectContains(rect, lx, lz)) return { kind: 'building', rect, lx, lz };
      }
    }

    if (VILLAGE_WORK_AREAS_ENABLED) {
      const workArea = villageWorkAreaAt(village, lx, lz);
      if (workArea) return { kind: workArea, lx, lz };
    }

    if (VILLAGE_PATHS_ENABLED && villageDoorPathAt(village, lx, lz)) return { kind: 'path', lx, lz };
    if (VILLAGE_PATHS_ENABLED && Math.abs(lx) <= 2 && Math.abs(lz) <= village.radius - 8) return { kind: 'path', lx, lz };
    if (VILLAGE_PATHS_ENABLED && Math.abs(lz) <= 2 && Math.abs(lx) <= village.radius - 8) return { kind: 'path', lx, lz };
    if (VILLAGE_PATHS_ENABLED && dist <= 7) return { kind: 'plaza', lx, lz };
    if (VILLAGE_BUILDINGS_ENABLED) {
      const roof = villageRoofOverhangAt(village, lx, lz);
      if (roof) return roof;
    }
    return null;
  }

  function findVillageForCell(state, x, z) {
    const villages = getVillages3D(state);
    return findVillageForCellInList(villages, x, z);
  }

  function findVillageForCellInList(villages, x, z) {
    for (const village of villages) {
      if (Math.hypot(x - village.x, z - village.z) <= village.radius) return village;
    }
    return null;
  }

  function findVillageGroundY(state, seed, x, z) {
    return terrainHeight(seed, x, z);
  }

  function villageBuildingBaseY(state, seed, village, rect) {
    if (!village.buildingBaseY) village.buildingBaseY = {};
    if (Number.isFinite(village.buildingBaseY[rect.id])) return village.buildingBaseY[rect.id];
    let maxY = -Infinity;
    let samples = 0;
    const sourceW = Number.isFinite(state.world.cavernFallProjectionX) ? Game.constants3d.WORLD_W : state.world.w;
    const sourceD = Number.isFinite(state.world.cavernFallProjectionZ) ? Game.constants3d.WORLD_D : state.world.d;
    for (let dz = 0; dz < rect.d; dz += 1) {
      for (let dx = 0; dx < rect.w; dx += 1) {
        const x = village.x + rect.x + dx;
        const z = village.z + rect.z + dz;
        if (x < 1 || z < 1 || x >= sourceW - 1 || z >= sourceD - 1) continue;
        const y = terrainHeight(seed, x, z);
        maxY = Math.max(maxY, y);
        samples += 1;
      }
    }
    const targetY = samples ? maxY : terrainHeight(seed, village.x, village.z);
    const baseY = Math.max(2, Math.min(state.world.h - 8, targetY));
    village.buildingBaseY[rect.id] = baseY;
    return baseY;
  }

  function clearVillageColumnSpace(state, x, baseY, z, height) {
    for (let y = baseY + 1; y <= Math.min(state.world.h - 2, baseY + height); y += 1) {
      setBlock3D(state, x, y, z, BLOCK.AIR);
    }
  }

  function prepareVillageSurface(state, x, z, baseY, surfaceBlock, options = {}) {
    const flatten = VILLAGE_TERRAIN_FLATTEN_ENABLED || options.flatten;
    if (flatten) {
      const foundationBlock = options.foundationBlock || BLOCK.DIRT;
      const foundationDepth = options.foundationDepth || 4;
      for (let y = Math.max(1, baseY - foundationDepth); y < baseY; y += 1) {
        const block = getBlock3D(state, x, y, z);
        if (block === BLOCK.AIR || block === BLOCK.WATER || block === BLOCK.HOT_WATER || block === BLOCK.LAVA || block === BLOCK.VOLCANIC_LAVA) setBlock3D(state, x, y, z, foundationBlock);
      }
    }
    setBlock3D(state, x, baseY, z, surfaceBlock);
    setGrassLevel3D(state, x, baseY, z, 0, { skipModified: true });
    if (flatten) clearVillageColumnSpace(state, x, baseY, z, options.clearHeight || 7);
  }

  function roofYForCell(rect, localX, localZ, baseY) {
    const cx = Math.max(0, Math.min(rect.w - 1, localX));
    const cz = Math.max(0, Math.min(rect.d - 1, localZ));
    const distToSide = Math.min(cx, rect.w - 1 - cx, cz, rect.d - 1 - cz);
    const ridge = rect.w >= rect.d
      ? Math.abs(cz - Math.floor((rect.d - 1) / 2)) <= 1
      : Math.abs(cx - Math.floor((rect.w - 1) / 2)) <= 1;
    return baseY + 4 + Math.min(2, Math.max(0, distToSide)) + (ridge ? 1 : 0);
  }

  function wallBlockForRect(style, rect, localX, localZ) {
    const corner = (localX === 0 || localX === rect.w - 1) && (localZ === 0 || localZ === rect.d - 1);
    if (corner) return BLOCK.WOOD;
    if (rect.wall === 'stone') return BLOCK.STONE;
    if (rect.wall === 'wood') return BLOCK.WOOD;
    return style.wall || BLOCK.PLANK;
  }

  function placeVillageRoofCell(state, village, rect, x, z, baseY, localX, localZ) {
    const style = villageStyle(village);
    const roofY = roofYForCell(rect, localX, localZ, baseY);
    setBlock3D(state, x, roofY, z, style.roof || BLOCK.PLANK);
    if ((localX < 0 || localX >= rect.w || localZ < 0 || localZ >= rect.d) && roofY > baseY + 4) {
      setBlock3D(state, x, roofY - 1, z, style.roof || BLOCK.PLANK);
    }
  }

  function buildingBlockForCell(state, village, cell, x, z, baseY) {
    const rect = cell.rect;
    const lx = cell.lx;
    const lz = cell.lz;
    const localX = lx - rect.x;
    const localZ = lz - rect.z;
    const edge = localX === 0 || localZ === 0 || localX === rect.w - 1 || localZ === rect.d - 1;
    const doorX = Math.floor(rect.w / 2);
    const doorZ = Math.floor(rect.d / 2);
    const isDoor = (rect.door === 'south' && localZ === rect.d - 1 && localX === doorX)
      || (rect.door === 'north' && localZ === 0 && localX === doorX)
      || (rect.door === 'east' && localX === rect.w - 1 && localZ === doorZ)
      || (rect.door === 'west' && localX === 0 && localZ === doorZ);
    const style = villageStyle(village);
    const wallBlock = wallBlockForRect(style, rect, localX, localZ);
    const roofBlock = style.roof || BLOCK.PLANK;
    const roofY = roofYForCell(rect, localX, localZ, baseY);
    if (isDoor) {
      setBlock3D(state, x, baseY + 1, z, BLOCK.AIR);
      setBlock3D(state, x, baseY + 2, z, BLOCK.AIR);
      setBlock3D(state, x, baseY + 3, z, edge ? wallBlock : BLOCK.AIR);
      setBlock3D(state, x, roofY, z, roofBlock);
      return;
    }
    if (edge) {
      for (let y = baseY + 1; y <= baseY + 3; y += 1) setBlock3D(state, x, y, z, wallBlock);
      const windowLine = (localX === Math.floor(rect.w / 2) || localZ === Math.floor(rect.d / 2)) && !isDoor;
      if (windowLine && rect.w >= 7 && rect.d >= 6) setBlock3D(state, x, baseY + 2, z, BLOCK.AIR);
    } else {
      for (let y = baseY + 1; y <= baseY + 3; y += 1) setBlock3D(state, x, y, z, BLOCK.AIR);
      if (rect.id === 'storage' && localX === 2 && localZ === 2) {
        setBlock3D(state, x, baseY + 1, z, BLOCK.CHEST);
        markStructureChestLoot(state, x, baseY + 1, z, 'village_storage');
      }
      if (rect.id.startsWith('home') && localX === 2 && localZ === 2) setBlock3D(state, x, baseY + 1, z, BLOCK.PILLOW);
      if (rect.id === 'shop' && localX === 2 && localZ === 3) {
        setBlock3D(state, x, baseY + 1, z, BLOCK.CHEST);
        markStructureChestLoot(state, x, baseY + 1, z, 'village_shop');
      }
    }
    setBlock3D(state, x, roofY, z, roofBlock);
  }

  function placeVillageBuildingCell(state, village, cell, x, z, baseY) {
    const floorBlock = cell.rect.id === 'guard' || cell.rect.id === 'builder' ? BLOCK.STONE : BLOCK.PLANK;
    prepareVillageSurface(state, x, z, baseY, floorBlock, {
      flatten: true,
      clearHeight: VILLAGE_BUILDING_CLEAR_HEIGHT,
      foundationDepth: VILLAGE_BUILDING_FOUNDATION_DEPTH,
      foundationBlock: floorBlock === BLOCK.STONE ? BLOCK.STONE : BLOCK.DIRT,
    });
    buildingBlockForCell(state, village, cell, x, z, baseY);
  }

  function placeVillageRoofOverhangCell(state, village, cell, x, z, baseY) {
    const localX = cell.lx - cell.rect.x;
    const localZ = cell.lz - cell.rect.z;
    placeVillageRoofCell(state, village, cell.rect, x, z, baseY, localX, localZ);
  }

  function placeVillageWorkCell(state, village, cell, x, z, baseY) {
    if (cell.kind === 'field') {
      const row = Math.abs(cell.lx + 26) % 3;
      const edge = cell.lx === -31 || cell.lx === -22 || cell.lz === -2 || cell.lz === 19;
      prepareVillageSurface(state, x, z, baseY, edge ? BLOCK.PATH : (row === 0 ? BLOCK.PATH : BLOCK.DIRT));
      if (!edge && row !== 0 && ((cell.lx + cell.lz) & 3) === 0) setBlock3D(state, x, baseY + 1, z, BLOCK.DRY_BUSH);
      return;
    }
    if (cell.kind === 'pen') {
      const border = cell.lx === -31 || cell.lx === -23 || cell.lz === -20 || cell.lz === -11;
      prepareVillageSurface(state, x, z, baseY, border ? BLOCK.PATH : BLOCK.DIRT);
      if (border) setBlock3D(state, x, baseY + 1, z, BLOCK.WOOD);
      return;
    }
    if (cell.kind === 'quarry') {
      const pit = cell.lx > 24 && cell.lx < 30 && cell.lz > -20 && cell.lz < -14;
      prepareVillageSurface(state, x, z, baseY, pit ? BLOCK.STONE : BLOCK.PATH);
      if (pit && (cell.lx + cell.lz) % 4 === 0) setBlock3D(state, x, baseY + 1, z, BLOCK.STONE);
      return;
    }
    if (cell.kind === 'woodpile') {
      prepareVillageSurface(state, x, z, baseY, BLOCK.PATH);
      if (cell.lz % 3 === 0 && Math.abs(cell.lx) % 2 === 0) {
        setBlock3D(state, x, baseY + 1, z, BLOCK.WOOD);
        if (Math.abs(cell.lx) % 4 === 0) setBlock3D(state, x, baseY + 2, z, BLOCK.WOOD);
      }
      return;
    }
  }

  function placeVillageCell(state, seed, village, cell, x, z) {
    if (cell.kind === 'building') {
      const baseY = villageBuildingBaseY(state, seed, village, cell.rect);
      placeVillageBuildingCell(state, village, cell, x, z, baseY);
      return true;
    }
    if (cell.kind === 'roof') {
      const baseY = villageBuildingBaseY(state, seed, village, cell.rect);
      placeVillageRoofOverhangCell(state, village, cell, x, z, baseY);
      return true;
    }
    const baseY = Math.max(2, Math.min(state.world.h - 8, findVillageGroundY(state, seed, x, z)));
    if (cell.kind === 'path' || cell.kind === 'plaza') {
      prepareVillageSurface(state, x, z, baseY, BLOCK.PATH);
      return true;
    }
    placeVillageWorkCell(state, village, cell, x, z, baseY);
    return true;
  }

  function decorateVillageCellAt(state, seed, x, z, village = null) {
    const player = state && state.player;
    if (player && Math.hypot((player.x || 0) - (x + 0.5), (player.z || 0) - (z + 0.5)) < 4.5) return true;
    village = village || findVillageForCell(state, x, z);
    if (!village) return false;
    const cell = villageCellAt(village, x, z);
    if (!cell) return true;
    return placeVillageCell(state, seed, village, cell, x, z);
  }

  function portalRuinCount(seed) {
    return 2 + (noise2(seed + 3301, 0, 0) < 0.58 ? 1 : 0);
  }

  function portalRuinAt(seed, world, index) {
    if (!world) return null;
    const margin = 96;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const roll = index * 17 + attempt;
      const x = margin + Math.floor(noise2(seed + 3311, roll, index) * Math.max(1, world.w - margin * 2));
      const z = margin + Math.floor(noise2(seed + 3313, index, roll) * Math.max(1, world.d - margin * 2));
      if (!farFromSpawn(world, x, z, 180)) continue;
      const y = 18 + Math.floor(noise2(seed + 3315, roll, index) * 13);
      if (terrainHeight(seed, x, z) < y + 10) continue;
      return {
        id: index,
        x,
        y,
        z,
        axis: noise2(seed + 3317, index, roll) < 0.5 ? 'x' : 'z',
      };
    }
    return null;
  }

  function getPortalRuins3D(state) {
    const world = state && state.world;
    if (!world || !state.worldMeta) return [];
    const seed = worldSeed(state);
    const count = portalRuinCount(seed);
    const cavernAxis = currentDimension(state) === 'overworld' && state.worldMeta.easterEgg === 'cavern_fall'
      ? state.worldMeta.cavernFallAxis
      : '';
    const sourceWorld = cavernAxis
      ? { ...world, w: Game.constants3d.WORLD_W, d: Game.constants3d.WORLD_D }
      : world;
    const ruins = [];
    for (let i = 0; i < count; i += 1) {
      const ruin = portalRuinAt(seed, sourceWorld, i);
      if (!ruin) continue;
      if (cavernAxis === 'x') {
        if (Math.abs(ruin.x - Game.constants3d.WORLD_W / 2) > 8) continue;
        ruins.push({ ...ruin, sourceX: ruin.x, x: 0 });
      } else if (cavernAxis === 'z') {
        if (Math.abs(ruin.z - Game.constants3d.WORLD_D / 2) > 8) continue;
        ruins.push({ ...ruin, sourceZ: ruin.z, z: 0 });
      } else {
        ruins.push(ruin);
      }
    }
    return ruins;
  }

  function portalRuinBlock(seed, x, y, z, ruin) {
    const rx = x - ruin.x;
    const ry = y - ruin.y;
    const rz = z - ruin.z;
    if (Math.abs(rx) > 8 || Math.abs(ry) > 6 || Math.abs(rz) > 8) return null;
    const u = ruin.axis === 'x' ? rz : rx;
    const w = ruin.axis === 'x' ? rx : rz;
    const floorY = -4;
    const room = (rx * rx) / 49 + ((ry + 1) * (ry + 1)) / 25 + (rz * rz) / 36 <= 1;
    const inPortalPlane = Math.abs(w) <= 0;
    const v = ry - floorY;
    const absU = Math.abs(u);
    if (inPortalPlane && v >= 0 && v <= 6 && (absU === 2 || (v === 6 && absU <= 2) || (v === 0 && absU <= 1))) {
      const broken = (v === 6 && u === 2) || (v === 5 && u === -2) || (v === 1 && u === 2 && noise2(seed + 3321, ruin.id, 0) < 0.7);
      if (!broken) return BLOCK.STRANGE_PORTAL_STONE;
    }
    if (inPortalPlane && u === 0 && v === 2) return BLOCK.STRANGE_PORTAL_CORE;
    if (room && ry === floorY) {
      const rune = (Math.abs(rx) === 3 && Math.abs(rz) <= 1) || (Math.abs(rz) === 3 && Math.abs(rx) <= 1);
      if (rune && noise2(seed + 3323, x, z) < 0.56) return BLOCK.STRANGE_PORTAL_RUNE;
      return noise2(seed + 3325, x, z) < 0.18 ? BLOCK.STRANGE_PORTAL_STONE : BLOCK.DEEPSTONE;
    }
    if (room && ry <= floorY + 1 && Math.abs(w) + Math.abs(u) > 4 && noise2(seed + 3327, x, z) < 0.08) {
      return BLOCK.STRANGE_PORTAL_STONE;
    }
    if (room) return BLOCK.AIR;
    return null;
  }

  function portalRuinBlockAt(seed, x, y, z, groundH, world) {
    if (!world || y <= 2 || y >= groundH - 4 || !farFromSpawn(world, x, z, 160)) return null;
    const count = portalRuinCount(seed);
    for (let i = 0; i < count; i += 1) {
      const ruin = portalRuinAt(seed, world, i);
      if (!ruin) continue;
      const block = portalRuinBlock(seed, x, y, z, ruin);
      if (block !== null) return block;
    }
    return null;
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
    const biome = biomeAt(seed, x, z);
    if (biome === 'volcanic') {
      const volcanicLava = basinLiquidAt(seed, x, y, z, h, world, {
        block: BLOCK.LAVA,
        cellSize: 18,
        salt: 1721,
        chanceSalt: 1723,
        radiusSalt: 1725,
        chance: 0.22,
        minRadius: 2.1,
        radiusRange: 3.4,
        minHeight: WATER_LEVEL + 3,
        spawnDistance: 18,
      });
      if (volcanicLava !== BLOCK.AIR) return volcanicLava;
    }
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

  function pointSegmentInfo(x, y, z, ax, ay, az, bx, by, bz) {
    const abx = bx - ax;
    const aby = by - ay;
    const abz = bz - az;
    const lengthSq = abx * abx + aby * aby + abz * abz;
    const rawT = lengthSq > 0 ? ((x - ax) * abx + (y - ay) * aby + (z - az) * abz) / lengthSq : 0;
    const t = Math.max(0, Math.min(1, rawT));
    const px = ax + abx * t;
    const py = ay + aby * t;
    const pz = az + abz * t;
    const dx = x - px;
    const dy = y - py;
    const dz = z - pz;
    return { t, px, py, pz, distanceSq: dx * dx + dy * dy + dz * dz };
  }

  function passageCaveBlockAt(seed, x, y, z, groundH, biome, world) {
    if (!world || y <= 1 || y > groundH + 1 || !farFromSpawn(world, x, z, 28)) return null;
    const cellSize = 96;
    const cellX = Math.floor(x / cellSize);
    const cellZ = Math.floor(z / cellSize);
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const cx = cellX + dx;
        const cz = cellZ + dz;
        const entrance = caveFeatureForCell(seed, world, cx, cz);
        if (!entrance) continue;
        const isThrough = entrance.type === 'through';
        const wobble = (smoothNoise(seed + 2131, x / 13, z / 13) - 0.5) * 0.9;
        const info = pointSegmentInfo(x, y, z, entrance.x, entrance.startY, entrance.z, entrance.endX, entrance.endY, entrance.endZ);
        const localRadius = entrance.radius + Math.sin(info.t * Math.PI) * 0.9 + wobble;
        if (info.distanceSq > localRadius * localRadius) continue;

        const bottomBand = y <= info.py - localRadius * 0.42;
        const centerBand = Math.abs(x - info.px) + Math.abs(z - info.pz) <= 1.25;
        if (entrance.hasStream && bottomBand && centerBand && info.t > 0.12 && info.t < 0.88) return BLOCK.WATER;

        if (!isThrough && entrance.hasEndPool && info.t > 0.82 && y <= entrance.endY + 1 && Math.hypot(x - entrance.endX, z - entrance.endZ) <= entrance.radius * 1.8) {
          return BLOCK.WATER;
        }

        return BLOCK.AIR;
      }
    }
    if (biome !== 'mountains' && biome !== 'geysers') return null;
    return null;
  }

  function caveRoomBlock(seed, x, y, z, centerX, centerY, centerZ, radiusX, radiusY, radiusZ, salt) {
    const nx = (x - centerX) / radiusX;
    const nz = (z - centerZ) / radiusZ;
    const horizontal = nx * nx + nz * nz;
    if (horizontal > 1) return null;
    const verticalHalf = radiusY * Math.sqrt(Math.max(0, 1 - horizontal));
    const floorY = centerY - verticalHalf;
    const ceilingY = centerY + verticalHalf;
    const ny = (y - centerY) / Math.max(1, verticalHalf);
    if (ny * ny > 1) return null;

    const pillarCellX = Math.floor(x / 13);
    const pillarCellZ = Math.floor(z / 13);
    const pillarX = pillarCellX * 13 + 6;
    const pillarZ = pillarCellZ * 13 + 6;
    const pillarRoll = noise2(seed + salt + 1, pillarCellX, pillarCellZ);
    if (pillarRoll < 0.14 && Math.hypot(x - pillarX, z - pillarZ) <= 1.45) return BLOCK.STONE;

    const spikeCellX = Math.floor(x / 7);
    const spikeCellZ = Math.floor(z / 7);
    const spikeX = spikeCellX * 7 + 3;
    const spikeZ = spikeCellZ * 7 + 3;
    const spikeDistance = Math.hypot(x - spikeX, z - spikeZ);
    if (spikeDistance <= 1.3) {
      const length = 1 + Math.floor(noise2(seed + salt + 5, spikeCellX, spikeCellZ) * 4);
      if (noise2(seed + salt + 3, spikeCellX, spikeCellZ) < 0.24 && y >= ceilingY - length + spikeDistance) return BLOCK.STONE;
      if (noise2(seed + salt + 7, spikeCellX, spikeCellZ) < 0.18 && y <= floorY + length - spikeDistance) return BLOCK.STONE;
    }

    const lakeRoll = noise2(seed + salt + 11, Math.floor(centerX / 16), Math.floor(centerZ / 16));
    if (lakeRoll < 0.42 && y <= floorY + 1.4 && horizontal < 0.58) {
      return lakeRoll < 0.16 ? BLOCK.LAVA : BLOCK.WATER;
    }
    return BLOCK.AIR;
  }

  function throughCaveRoomBlockAt(seed, x, y, z, groundH, world) {
    if (!world || y <= 1 || y > groundH - 5 || !farFromSpawn(world, x, z, 36)) return null;
    const cellSize = 96;
    const cellX = Math.floor(x / cellSize);
    const cellZ = Math.floor(z / cellSize);
    for (let dz = -2; dz <= 2; dz += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        const cx = cellX + dx;
        const cz = cellZ + dz;
        const feature = caveFeatureForCell(seed, world, cx, cz);
        if (!feature || feature.type !== 'through') continue;
        const radiusX = 30 + noise2(seed + 2141, cx, cz) * 18;
        const radiusZ = 30 + noise2(seed + 2143, cx, cz) * 18;
        const radiusY = 7 + noise2(seed + 2145, cx, cz) * 5;
        const block = caveRoomBlock(seed, x, y, z, feature.endX, feature.endY, feature.endZ, radiusX, radiusY, radiusZ, 2147);
        if (block !== null) return block;
      }
    }
    return null;
  }

  function deepCaveBlockAt(seed, x, y, z, groundH, world) {
    if (!world || y <= 1 || y > groundH - 5 || !farFromSpawn(world, x, z, 36)) return null;
    const cellSize = 128;
    const cellX = Math.floor(x / cellSize);
    const cellZ = Math.floor(z / cellSize);
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const cx = cellX + dx;
        const cz = cellZ + dz;
        if (noise2(seed + 2201, cx, cz) > 0.38) continue;
        const centerX = cx * cellSize + Math.floor(cellSize * (0.22 + noise2(seed + 2203, cx, cz) * 0.56));
        const centerZ = cz * cellSize + Math.floor(cellSize * (0.22 + noise2(seed + 2205, cx, cz) * 0.56));
        const centerY = 9 + Math.floor(noise2(seed + 2207, cx, cz) * 12);
        const radiusX = 38 + noise2(seed + 2209, cx, cz) * 24;
        const radiusZ = 38 + noise2(seed + 2211, cx, cz) * 24;
        const radiusY = 6 + noise2(seed + 2213, cx, cz) * 7;
        const warpX = (smoothNoise(seed + 2215, x / 29, z / 29) - 0.5) * 8;
        const warpZ = (smoothNoise(seed + 2217, x / 31, z / 31) - 0.5) * 8;
        const nx = (x + warpX - centerX) / radiusX;
        const nz = (z + warpZ - centerZ) / radiusZ;
        const horizontal = nx * nx + nz * nz;
        if (horizontal > 1) continue;
        const verticalHalf = radiusY * Math.sqrt(Math.max(0, 1 - horizontal));
        const floorY = centerY - verticalHalf;
        const ceilingY = centerY + verticalHalf;
        const ny = (y - centerY) / Math.max(1, verticalHalf);
        if (ny * ny > 1) continue;

        return caveRoomBlock(seed, x, y, z, centerX, centerY, centerZ, radiusX, radiusY, radiusZ, 2220);
      }
    }
    return null;
  }

  function caveBlockAt(seed, x, y, z, groundH, biome, world) {
    const passage = passageCaveBlockAt(seed, x, y, z, groundH, biome, world);
    if (passage !== null) return passage;
    const throughRoom = throughCaveRoomBlockAt(seed, x, y, z, groundH, world);
    if (throughRoom !== null) return throughRoom;
    return deepCaveBlockAt(seed, x, y, z, groundH, world);
  }

  function worldSeed(state) {
    return hash(state.worldMeta.seed || state.worldMeta.name || Date.now());
  }

  function currentDimension(state) {
    return state && state.worldMeta && state.worldMeta.currentDimension === 'underground' ? 'underground' : 'overworld';
  }

  function dimensionWorldId(baseWorldId, dimension) {
    if (!baseWorldId) return '';
    return dimension === 'underground' ? `${baseWorldId}:underground` : baseWorldId;
  }

  function currentStorageWorldId(state, targetWorldId = null) {
    const base = targetWorldId || (state && state.worldMeta ? state.worldMeta.id : '');
    return dimensionWorldId(base, currentDimension(state));
  }

  function undergroundPortalBlockAt(seed, x, y, z, worldMeta) {
    const links = worldMeta && Array.isArray(worldMeta.portalLinks) ? worldMeta.portalLinks : [];
    for (const link of links) {
      const portal = link && link.underground;
      if (!portal) continue;
      const axis = portal.axis || 'x';
      const rx = x - portal.x;
      const ry = y - portal.y;
      const rz = z - portal.z;
      const u = axis === 'x' ? rz : rx;
      const w = axis === 'x' ? rx : rz;
      const v = ry + 4;
      if (w === 0 && Math.abs(u) <= 1 && v >= 1 && v <= 5) return BLOCK.ACTIVE_STRANGE_PORTAL;
      const ruin = { id: link.id || 0, x: portal.x, y: portal.y, z: portal.z, axis: portal.axis || 'x' };
      const block = portalRuinBlock(seed, x, y, z, ruin);
      if (block === BLOCK.AIR) return BLOCK.AIR;
      if (block === BLOCK.STRANGE_PORTAL_CORE) return BLOCK.ACTIVE_STRANGE_PORTAL;
      if (block !== null) return block;
    }
    return null;
  }

  function undergroundTerrainBlockAt(seed, x, y, z, world, worldMeta) {
    if (y === 0) return BLOCK.BEDROCK;
    if (x <= 0 || z <= 0 || x >= world.w - 1 || z >= world.d - 1) return BLOCK.BEDROCK;
    const portal = undergroundPortalBlockAt(seed, x, y, z, worldMeta);
    if (portal !== null) return portal;
    const floor = 8 + Math.floor(smoothNoise(seed + 4101, x / 55, z / 55) * 7);
    const ceiling = 86 + Math.floor(smoothNoise(seed + 4103, x / 70, z / 70) * 22);
    if (y <= floor) return y === floor && smoothNoise(seed + 4105, x / 13, z / 13) > 0.72 ? BLOCK.DEEPSTONE : BLOCK.STONE;
    if (y >= ceiling) return BLOCK.STONE;
    const cellX = Math.floor(x / 31);
    const cellZ = Math.floor(z / 31);
    const px = cellX * 31 + 15;
    const pz = cellZ * 31 + 15;
    const pillar = noise2(seed + 4111, cellX, cellZ) < 0.22 && Math.hypot(x - px, z - pz) <= 2.1;
    if (pillar && y > floor + 1 && y < ceiling - 1) return BLOCK.STONE;
    return BLOCK.AIR;
  }

  function surfaceTerrainBlockAt(seed, x, y, z, world = null) {
    const h = terrainHeight(seed, x, z);
    const lake = lakeInfo(seed, x, z);
    const biome = lake.inLake ? 'lake' : (lake.shore ? 'beach' : (geyserValleyInfo(seed, x, z).inValley ? 'geysers' : baseLandBiome(seed, x, z)));
    const waterLevel = lake.inLake && Number.isFinite(lake.waterLevel) ? lake.waterLevel : WATER_LEVEL;
    const groundH = lake.inLake ? waterLevel - lake.depth : h;
    if (y === 0) return BLOCK.BEDROCK;
    const volcano = volcanoInfo(seed, x, z);
    if (volcano && volcano.dist <= volcano.ventRadius && y <= groundH + 1) {
      return y <= Math.max(2, groundH - 4) ? BLOCK.VOLCANIC_LAVA : BLOCK.AIR;
    }
    if (y <= groundH) {
      const portalRuin = portalRuinBlockAt(seed, x, y, z, groundH, world);
      if (portalRuin !== null) return portalRuin;
      const caveBlock = caveBlockAt(seed, x, y, z, groundH, biome, world);
      if (caveBlock !== null) return caveBlock;
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
      if (biome === 'volcanic') {
        if (y >= groundH - 4) return BLOCK.BLACKSTONE;
        return BLOCK.STONE;
      }
      if (biome === 'cliffs') {
        return BLOCK.STONE;
      }
      if (biome === 'snow_plains' || biome === 'spruce_forest') {
        if (y === groundH) return BLOCK.SNOW;
        if (y >= groundH - 3) return BLOCK.DIRT;
        return BLOCK.STONE;
      }
      if (biome === 'mountains' || biome === 'geysers' || biome === 'mountain_forest') {
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

  function terrainBlockAt(seed, x, y, z, world = null) {
    if (world && world.dimension === 'underground') return undergroundTerrainBlockAt(seed, x, y, z, world, world.worldMeta);
    const meta = world && world.worldMeta;
    const source = Game.easterEggs3d
      ? Game.easterEggs3d.getCavernFallSourceCell(meta, x, z, 'overworld')
      : { x, z };
    const sourceWorld = source.x === x && source.z === z
      ? world
      : { ...world, w: Game.constants3d.WORLD_W, d: Game.constants3d.WORLD_D };
    return surfaceTerrainBlockAt(seed, source.x, y, source.z, sourceWorld);
  }

  function getSurfaceSpawnY3D(state, x, z) {
    const world = state && state.world;
    if (!world) return 2;
    const seed = worldSeed(state);
    const sx = Math.max(1, Math.min(world.w - 2, Math.floor(x)));
    const sz = Math.max(1, Math.min(world.d - 2, Math.floor(z)));
    for (let y = world.h - 2; y >= 1; y -= 1) {
      const id = terrainBlockAt(seed, sx, y, sz, world);
      if (id !== BLOCK.AIR && id !== BLOCK.WATER && id !== BLOCK.HOT_WATER && id !== BLOCK.LAVA && id !== BLOCK.VOLCANIC_LAVA) {
        return Math.min(world.h + 4, y + 2);
      }
    }
    return Math.min(world.h + 4, terrainHeight(seed, sx, sz) + 2);
  }

  function normalizeSpawnBiome(value) {
    const id = String(value || 'any').trim();
    return id === 'plains' || id === 'forest' || id === 'desert' || id === 'mountains' || id === 'cliffs' || id === 'volcanic' || id === 'snow_plains' || id === 'spruce_forest' || id === 'mountain_forest' || id === 'beach' || id === 'geysers'
      ? id
      : 'any';
  }

  function selectedSpawnBiome(state) {
    const meta = state && state.worldMeta ? state.worldMeta : null;
    if (meta && meta.spawnBiomeSeedSearch) return 'any';
    return normalizeSpawnBiome(meta && meta.spawnBiome);
  }

  function spawnTentCandidatesForSpawn(spawnX, spawnZ) {
    return [
      { x0: spawnX - SPAWN_TENT_CENTER, z0: spawnZ + 3, door: 'north' },
      { x0: spawnX + 3, z0: spawnZ - SPAWN_TENT_CENTER, door: 'west' },
      { x0: spawnX - SPAWN_TENT_SIZE - 2, z0: spawnZ - SPAWN_TENT_CENTER, door: 'east' },
      { x0: spawnX - SPAWN_TENT_CENTER, z0: spawnZ - SPAWN_TENT_SIZE - 2, door: 'south' },
    ];
  }

  function hasSpawnTentSite(state, seed, spawnX, spawnZ) {
    return spawnTentCandidatesForSpawn(spawnX, spawnZ)
      .some((candidate) => canPlaceSpawnTent(state, seed, candidate.x0, candidate.z0) !== null);
  }

  function scoreSpawnSite(state, seed, world, x, z, targetBiome = 'any') {
    if (!world || x < 8 || z < 8 || x >= world.w - 8 || z >= world.d - 8) return null;
    const biome = biomeAt(seed, x, z);
    if (biome === 'lake') return null;
    const wantedBiome = normalizeSpawnBiome(targetBiome);
    if (wantedBiome !== 'any' && biome !== wantedBiome) return null;
    let minH = Infinity;
    let maxH = -Infinity;
    for (let dz = -2; dz <= 2; dz += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        const h = terrainHeight(seed, x + dx, z + dz);
        minH = Math.min(minH, h);
        maxH = Math.max(maxH, h);
      }
    }
    const roughness = maxH - minH;
    const roughScore = Math.max(0, 1 - roughness / 7);
    const tentScore = hasSpawnTentSite(state, seed, x, z) ? 1 : (wantedBiome === 'any' ? 0.35 : 0);
    if (wantedBiome !== 'any' && tentScore <= 0) return null;
    let biomeScore = 0.34;
    if (wantedBiome !== 'any') biomeScore = 1;
    else if (biome === 'plains') biomeScore = 1;
    else if (biome === 'forest') biomeScore = 0.92;
    else if (biome === 'spruce_forest') biomeScore = 0.9;
    else if (biome === 'snow_plains') biomeScore = 0.82;
    else if (biome === 'beach') biomeScore = 0.78;
    else if (biome === 'desert') biomeScore = 0.72;
    else if (biome === 'mountain_forest') biomeScore = 0.5;
    else if (biome === 'mountains' || biome === 'cliffs') biomeScore = 0.46;
    return biomeScore * 0.46 + roughScore * 0.36 + tentScore * 0.18;
  }

  function findCavernFallSpawn3D(state, seed, axis, targetBiome) {
    const world = state.world;
    const sourceWorld = { ...world, w: Game.constants3d.WORLD_W, d: Game.constants3d.WORLD_D };
    const sourceState = { ...state, world: sourceWorld };
    const centerX = Math.floor(sourceWorld.w / 2);
    const centerZ = Math.floor(sourceWorld.d / 2);
    let best = null;
    for (let distance = 0; distance <= Math.max(centerX, centerZ) - 12; distance += 4) {
      const offsets = distance === 0 ? [0] : [distance, -distance];
      for (const offset of offsets) {
        const x = axis === 'x' ? centerX : centerX + offset;
        const z = axis === 'z' ? centerZ : centerZ + offset;
        const score = scoreSpawnSite(sourceState, seed, sourceWorld, x, z, targetBiome);
        if (score === null) continue;
        const value = score - Math.min(0.28, distance / 420);
        if (!best || value > best.value) best = { x, z, value };
      }
      if (best && distance >= (targetBiome === 'any' ? 16 : 32)) break;
    }
    if (!best && targetBiome !== 'any') return findCavernFallSpawn3D(state, seed, axis, 'any');
    const source = best || { x: centerX, z: centerZ };
    return {
      x: axis === 'x' ? 0 : source.x,
      z: axis === 'z' ? 0 : source.z,
    };
  }

  function findWorldSpawn3D(state, seed, options = {}) {
    const world = state && state.world;
    const centerX = Math.floor((world && world.w ? world.w : 0) / 2);
    const centerZ = Math.floor((world && world.d ? world.d : 0) / 2);
    const targetBiome = options.anyBiome ? 'any' : selectedSpawnBiome(state);
    const cavernFallAxis = currentDimension(state) === 'overworld' && state && state.worldMeta && state.worldMeta.easterEgg === 'cavern_fall'
      ? state.worldMeta.cavernFallAxis
      : '';
    if (cavernFallAxis === 'x' || cavernFallAxis === 'z') {
      return findCavernFallSpawn3D(state, seed, cavernFallAxis, targetBiome);
    }
    const maxRadius = Math.max(384, Math.ceil(Math.max(world && world.w ? world.w : 0, world && world.d ? world.d : 0) / 2) - 12);
    let best = null;
    for (let radius = 0; radius <= maxRadius; radius += 4) {
      for (let dz = -radius; dz <= radius; dz += 4) {
        for (let dx = -radius; dx <= radius; dx += 4) {
          if (radius > 0 && Math.abs(dx) !== radius && Math.abs(dz) !== radius) continue;
          const x = centerX + dx;
          const z = centerZ + dz;
          const score = scoreSpawnSite(state, seed, world, x, z, targetBiome);
          if (score === null) continue;
          const distancePenalty = Math.min(0.28, Math.hypot(dx, dz) / 420);
          const value = score - distancePenalty;
          if (!best || value > best.value) best = { x, z, value };
        }
      }
      if (best && radius >= (targetBiome === 'any' ? 16 : 32)) return best;
    }
    if (!best && targetBiome !== 'any') {
      const previous = state.worldMeta.spawnBiome;
      state.worldMeta.spawnBiome = 'any';
      best = findWorldSpawn3D(state, seed);
      state.worldMeta.spawnBiome = previous;
    }
    return best || { x: centerX, z: centerZ };
  }

  function seedHasDefaultSpawnBiome3D(seedText, spawnBiome) {
    const targetBiome = normalizeSpawnBiome(spawnBiome);
    if (targetBiome === 'any') return true;
    const constants = Game.constants3d || {};
    const world = {
      w: constants.WORLD_W || 2048,
      h: constants.WORLD_H || 128,
      d: constants.WORLD_D || 2048,
    };
    const seed = hash(String(seedText || ''));
    const state = {
      world,
      worldMeta: {
        seed: String(seedText || ''),
        spawnBiome: 'any',
        spawnBiomeSeedSearch: true,
      },
    };
    const spawn = findWorldSpawn3D(state, seed, { anyBiome: true });
    return biomeAt(seed, spawn.x, spawn.z) === targetBiome
      && hasSpawnTentSite(state, seed, spawn.x, spawn.z);
  }

  function getWorldSpawn3D(state) {
    return findWorldSpawn3D(state, worldSeed(state));
  }

  function isReplaceableForTent(id) {
    return id === BLOCK.AIR || id === BLOCK.WATER || id === BLOCK.HOT_WATER || id === BLOCK.LAVA || id === BLOCK.VOLCANIC_LAVA
      || id === BLOCK.DRY_BUSH || id === BLOCK.ALGAE || id === BLOCK.TALL_ALGAE;
  }

  const SPAWN_TENT_SIZE = 9;
  const SPAWN_TENT_MAX = SPAWN_TENT_SIZE - 1;
  const SPAWN_TENT_CENTER = Math.floor(SPAWN_TENT_SIZE / 2);
  const SPAWN_TENT_HEIGHT = 7;

  function canPlaceSpawnTent(state, seed, x0, z0) {
    const world = state && state.world;
    if (!world || x0 < 2 || z0 < 2 || x0 + SPAWN_TENT_MAX >= world.w - 2 || z0 + SPAWN_TENT_MAX >= world.d - 2) return null;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let z = z0; z <= z0 + SPAWN_TENT_MAX; z += 1) {
      for (let x = x0; x <= x0 + SPAWN_TENT_MAX; x += 1) {
        if (biomeAt(seed, x, z) === 'lake') return null;
        const y = terrainHeight(seed, x, z);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
    if (maxY - minY > 6 || maxY + SPAWN_TENT_HEIGHT >= world.h) return null;
    return maxY;
  }

  function clearTentVolume(state, x0, baseY, z0) {
    for (let z = z0; z <= z0 + SPAWN_TENT_MAX; z += 1) {
      for (let x = x0; x <= x0 + SPAWN_TENT_MAX; x += 1) {
        for (let y = Math.max(1, baseY - 4); y < baseY; y += 1) {
          if (isReplaceableForTent(getBlock3D(state, x, y, z))) setBlock3D(state, x, y, z, BLOCK.DIRT);
        }
        for (let y = baseY + 1; y <= baseY + SPAWN_TENT_HEIGHT; y += 1) {
          if (getBlock3D(state, x, y, z) !== BLOCK.AIR) setBlock3D(state, x, y, z, BLOCK.AIR);
        }
      }
    }
  }

  function markStructureChestLoot(state, x, y, z, lootTable) {
    if (!state || !state.world || !lootTable) return;
    if (Number.isFinite(state.world.cavernFallProjectionX)) x -= state.world.cavernFallProjectionX;
    if (Number.isFinite(state.world.cavernFallProjectionZ)) z -= state.world.cavernFallProjectionZ;
    if (x < 0 || x >= state.world.w || z < 0 || z >= state.world.d) return;
    if (!state.world.chests) state.world.chests = {};
    state.world.chests[`${x},${y},${z}`] = { lootTable };
  }

  const BLASTER_MINER_SAFE_CODE = 'если пришел с миром - забирай';
  const BLASTER_MINER_NOTE_TEXT = 'пароль от сейфа: "если пришел с миром - забирай"';

  function noteStack(text, readOnly) {
    const item = Game.interaction3d && Game.interaction3d.ITEM;
    if (!item || !Number.isFinite(item.NOTE)) return null;
    const data = Game.inventory3d && Game.inventory3d.createNoteData
      ? Game.inventory3d.createNoteData(text, readOnly)
      : { text: String(text || ''), readOnly: !!readOnly };
    return { id: item.NOTE, count: 1, data };
  }

  function emptyChestSlots() {
    return Array.from({ length: 36 }, () => null);
  }

  function dynamiteIds() {
    const config = Game.interaction3d && Game.interaction3d.DYNAMITE_CONFIG;
    return Object.keys(config || {}).map(Number).filter((id) => Number.isFinite(id)).sort((a, b) => a - b);
  }

  function blasterMinerSafeSlots() {
    const slots = emptyChestSlots();
    const ids = dynamiteIds();
    ids.forEach((id, index) => {
      slots[index] = { id, count: 1 };
    });
    if (ids.length) slots[ids.length] = { id: BLOCK.TNT_REMOTE, count: ids.length };
    return slots;
  }

  function setStructureChest(state, x, y, z, slots, extra = {}) {
    if (!state || !state.world) return;
    if (Number.isFinite(state.world.cavernFallProjectionX)) x -= state.world.cavernFallProjectionX;
    if (Number.isFinite(state.world.cavernFallProjectionZ)) z -= state.world.cavernFallProjectionZ;
    if (x < 0 || x >= state.world.w || z < 0 || z >= state.world.d) return;
    if (!state.world.chests) state.world.chests = {};
    state.world.chests[`${x},${y},${z}`] = {
      slots,
      lootGenerated: true,
      ...extra,
    };
  }

  function registerBlasterMinerHouse(state, house) {
    if (!state || !state.world || !house) return;
    if (!Array.isArray(state.world.blasterMinerHouses)) state.world.blasterMinerHouses = [];
    const existing = state.world.blasterMinerHouses.find((item) => item && item.key === house.key);
    if (existing) Object.assign(existing, house);
    else state.world.blasterMinerHouses.push(house);
  }

  function blasterMinerHouseCandidates(state) {
    const world = state && state.world;
    if (!world || !state.worldMeta) return [];
    const cavernAxis = currentDimension(state) === 'overworld' && state.worldMeta.easterEgg === 'cavern_fall'
      ? state.worldMeta.cavernFallAxis
      : '';
    const planningWorld = cavernAxis ? { ...world, w: Game.constants3d.WORLD_W, d: Game.constants3d.WORLD_D } : world;
    const planningState = cavernAxis ? { ...state, world: planningWorld } : state;
    const seed = worldSeed(state);
    const count = 2 + Math.floor(noise2(seed + 5601, 0, 0) * 3);
    const candidates = [];
    const margin = Math.min(180, Math.max(36, Math.floor(Math.min(planningWorld.w, planningWorld.d) * 0.12)));
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + noise2(seed + 5603, i, 0) * 0.8;
      const radius = Math.min(planningWorld.w, planningWorld.d) * (0.28 + noise2(seed + 5605, i, 0) * 0.28);
      let x = Math.round(planningWorld.w * 0.5 + Math.cos(angle) * radius);
      let z = Math.round(planningWorld.d * 0.5 + Math.sin(angle) * radius);
      x = Math.max(margin, Math.min(planningWorld.w - margin, x));
      z = Math.max(margin, Math.min(planningWorld.d - margin, z));
      if (!farFromSpawn(planningWorld, x, z, 72)) {
        x = Math.max(margin, Math.min(planningWorld.w - margin, x + (x < planningWorld.w / 2 ? 72 : -72)));
        z = Math.max(margin, Math.min(planningWorld.d - margin, z + (z < planningWorld.d / 2 ? 72 : -72)));
      }
      const cave = nearestCaveFeature(planningState, x, z, 260);
      if (cave) {
        x = Math.round((x * 2 + cave.x) / 3);
        z = Math.round((z * 2 + cave.z) / 3);
      }
      candidates.push({
        key: `blaster-miner-house-${i}`,
        type: 'blaster_miner_house',
        x,
        z,
        cave: cave ? { x: cave.endX, y: cave.endY, z: cave.endZ } : null,
        generated: false,
      });
    }
    return candidates;
  }

  function nearestCaveFeature(state, x, z, radius) {
    const world = state && state.world;
    if (!world) return null;
    const entrances = getCaveEntrancesInArea3D(state, x - radius, z - radius, x + radius, z + radius)
      .filter((item) => item && item.type === 'through');
    let best = null;
    for (const entrance of entrances) {
      const dist = Math.hypot(entrance.x - x, entrance.z - z);
      if (!best || dist < best.dist) best = { entrance, dist };
    }
    return best ? best.entrance : null;
  }

  function surfaceYForStructure(state, x, z) {
    if (!state || !state.world) return 24;
    const world = state.world;
    const localX = Number.isFinite(world.cavernFallProjectionX) ? x - world.cavernFallProjectionX : x;
    const localZ = Number.isFinite(world.cavernFallProjectionZ) ? z - world.cavernFallProjectionZ : z;
    if (localX < 0 || localX >= world.w || localZ < 0 || localZ >= world.d) {
      return terrainHeight(worldSeed(state), x, z);
    }
    for (let y = state.world.h - 2; y >= 1; y -= 1) {
      const id = getBlock3D(state, x, y, z);
      if (id !== BLOCK.AIR && id !== BLOCK.WATER && id !== BLOCK.HOT_WATER && id !== BLOCK.LAVA && id !== BLOCK.VOLCANIC_LAVA) return y;
    }
    return Math.max(5, Math.min(state.world.h - 8, terrainHeight(worldSeed(state), x, z)));
  }

  function fillBox(state, minX, minY, minZ, maxX, maxY, maxZ, id) {
    for (let y = minY; y <= maxY; y += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        for (let x = minX; x <= maxX; x += 1) setBlock3D(state, x, y, z, id);
      }
    }
  }

  function clearBox(state, minX, minY, minZ, maxX, maxY, maxZ) {
    fillBox(state, minX, minY, minZ, maxX, maxY, maxZ, BLOCK.AIR);
  }

  function carveTunnelLine(state, from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy, dz)));
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const x = Math.round(from.x + dx * t);
      const y = Math.round(from.y + dy * t);
      const z = Math.round(from.z + dz * t);
      clearBox(state, x - 1, y, z - 1, x + 1, y + 2, z + 1);
      if (y - 1 >= 1) {
        for (let sx = x - 1; sx <= x + 1; sx += 1) {
          for (let sz = z - 1; sz <= z + 1; sz += 1) {
            if (getBlock3D(state, sx, y - 1, sz) === BLOCK.AIR) setBlock3D(state, sx, y - 1, sz, BLOCK.STONE);
          }
        }
      }
    }
  }

  function buildAbandonedHouseShell(state, x, baseY, z) {
    clearBox(state, x - 4, baseY, z - 4, x + 4, baseY + 6, z + 4);
    fillBox(state, x - 4, baseY - 1, z - 4, x + 4, baseY - 1, z + 4, BLOCK.STONE);
    fillBox(state, x - 3, baseY, z - 3, x + 3, baseY, z + 3, BLOCK.PLANK);
    for (let y = baseY + 1; y <= baseY + 3; y += 1) {
      for (let xx = x - 3; xx <= x + 3; xx += 1) {
        setBlock3D(state, xx, y, z - 3, BLOCK.WOOD);
        setBlock3D(state, xx, y, z + 3, BLOCK.WOOD);
      }
      for (let zz = z - 2; zz <= z + 2; zz += 1) {
        setBlock3D(state, x - 3, y, zz, BLOCK.WOOD);
        setBlock3D(state, x + 3, y, zz, BLOCK.WOOD);
      }
    }
    clearBox(state, x - 1, baseY + 1, z - 3, x + 1, baseY + 2, z - 3);
    clearBox(state, x - 3, baseY + 2, z, x - 3, baseY + 2, z + 1);
    clearBox(state, x + 3, baseY + 2, z - 1, x + 3, baseY + 2, z);
    for (let dx = -4; dx <= 4; dx += 1) {
      const roofY = baseY + 4 + Math.max(0, 3 - Math.abs(dx)) % 2;
      for (let zz = z - 4; zz <= z + 4; zz += 1) setBlock3D(state, x + dx, roofY, zz, dx % 2 === 0 ? BLOCK.PLANK : BLOCK.WOOD);
    }
    setBlock3D(state, x + 2, baseY + 1, z + 1, BLOCK.COBWEB);
    setBlock3D(state, x - 2, baseY + 1, z + 2, BLOCK.MOSS);
  }

  function buildBlasterMinerInterior(state, x, baseY, z) {
    const slots = emptyChestSlots();
    slots[0] = noteStack(BLASTER_MINER_NOTE_TEXT, true);
    setBlock3D(state, x + 2, baseY + 1, z + 2, BLOCK.CHEST);
    setStructureChest(state, x + 2, baseY + 1, z + 2, slots);
  }

  function buildStairToBasement(state, x, baseY, z) {
    let sx = x - 1;
    let sy = baseY;
    const sz = z + 1;
    for (let i = 0; i < 8; i += 1) {
      sx += 1;
      sy -= 1;
      clearBox(state, sx - 1, sy, sz - 1, sx + 1, sy + 2, sz + 1);
      fillBox(state, sx - 1, sy - 1, sz - 1, sx + 1, sy - 1, sz + 1, BLOCK.STONE);
    }
    return { x: sx, y: sy, z: sz };
  }

  function buildBlasterMinerBasementAndSafe(state, entry, caveTarget) {
    const bx = entry.x + 4;
    const by = Math.max(4, entry.y);
    const bz = entry.z;
    clearBox(state, bx - 3, by, bz - 3, bx + 3, by + 3, bz + 3);
    fillBox(state, bx - 4, by - 1, bz - 4, bx + 4, by - 1, bz + 4, BLOCK.STONE);
    for (let x = bx - 4; x <= bx + 4; x += 1) {
      for (let z = bz - 4; z <= bz + 4; z += 1) {
        if (Math.abs(x - bx) === 4 || Math.abs(z - bz) === 4) {
          setBlock3D(state, x, by, z, BLOCK.STONE);
          setBlock3D(state, x, by + 1, z, BLOCK.STONE);
          setBlock3D(state, x, by + 2, z, BLOCK.STONE);
        }
        setBlock3D(state, x, by + 4, z, BLOCK.STONE);
      }
    }
    const safe = { x: bx + 1, y: by + 4, z: bz - 1 };
    setBlock3D(state, safe.x, safe.y, safe.z, BLOCK.STONE_CHEST);
    setBlock3D(state, safe.x, safe.y - 1, safe.z, BLOCK.AIR);
    setStructureChest(state, safe.x, safe.y, safe.z, blasterMinerSafeSlots(), { code: BLASTER_MINER_SAFE_CODE });
    carveTunnelLine(state, { x: bx + 3, y: by, z: bz }, caveTarget || { x: bx + 42, y: Math.max(5, by - 8), z: bz + 18 });
    return { basement: { x: bx, y: by, z: bz }, safe };
  }

  function createBlasterMinerHouseAt3D(state, centerX, centerZ, options = {}) {
    if (!state || !state.world) return null;
    const world = state.world;
    const sourceW = Number.isFinite(world.cavernFallProjectionX) ? Game.constants3d.WORLD_W : world.w;
    const sourceD = Number.isFinite(world.cavernFallProjectionZ) ? Game.constants3d.WORLD_D : world.d;
    const x = Math.max(8, Math.min(sourceW - 9, Math.round(centerX)));
    const z = Math.max(8, Math.min(sourceD - 9, Math.round(centerZ)));
    const groundY = Number.isFinite(options.groundY) ? options.groundY : surfaceYForStructure(state, x, z);
    if (!options.allowNearSpawn && !farFromSpawn({ w: sourceW, d: sourceD }, x, z, 56)) return null;
    const baseY = Math.max(8, Math.min(world.h - 12, groundY + 1));
    const cave = options.cave || nearestCaveFeature(state, x, z, 260);
    const caveTarget = cave ? { x: cave.endX || cave.x, y: cave.endY || Math.max(5, baseY - 18), z: cave.endZ || cave.z } : { x: x + 46, y: Math.max(5, baseY - 26), z: z + 19 };
    if (!structureWriteVolumeReady(
      state,
      Math.min(x - 8, caveTarget.x - 2),
      Math.min(1, caveTarget.y - 2),
      Math.min(z - 8, caveTarget.z - 2),
      Math.max(x + 48, caveTarget.x + 2),
      baseY + 8,
      Math.max(z + 20, caveTarget.z + 2)
    )) return null;
    buildAbandonedHouseShell(state, x, baseY, z);
    buildBlasterMinerInterior(state, x, baseY, z);
    const stairEnd = buildStairToBasement(state, x, baseY, z);
    const underground = buildBlasterMinerBasementAndSafe(state, stairEnd, caveTarget);
    const key = options.key || `blaster-miner-house-${x}-${z}`;
    const projectionX = Number.isFinite(world.cavernFallProjectionX) ? world.cavernFallProjectionX : 0;
    const projectionZ = Number.isFinite(world.cavernFallProjectionZ) ? world.cavernFallProjectionZ : 0;
    const house = {
      key,
      type: 'blaster_miner_house',
      x: projectionX ? 0 : x,
      y: baseY,
      z: projectionZ ? 0 : z,
      generated: true,
      noteChest: { x: projectionX ? 0 : x + 2, y: baseY + 1, z: projectionZ ? 0 : z + 2 },
      safeChest: { ...underground.safe, x: underground.safe.x - projectionX, z: underground.safe.z - projectionZ },
      basement: { ...underground.basement, x: underground.basement.x - projectionX, z: underground.basement.z - projectionZ },
      cave: { ...caveTarget, x: caveTarget.x - projectionX, z: caveTarget.z - projectionZ },
    };
    registerBlasterMinerHouse(state, house);
    return house;
  }

  function getBlasterMinerHouses3D(state) {
    const generated = state && state.world && Array.isArray(state.world.blasterMinerHouses) ? state.world.blasterMinerHouses : [];
    const byKey = new Map();
    for (const candidate of blasterMinerHouseCandidates(state)) byKey.set(candidate.key, candidate);
    for (const house of generated) byKey.set(house.key, house);
    return Array.from(byKey.values());
  }

  function generateBlasterMinerHousesForColumn(state, bounds) {
    if (!state || !state.world || state.worldMeta && state.worldMeta.currentDimension === 'underground') return;
    const generated = state.world.blasterMinerHouses || [];
    const axis = state.worldMeta && state.worldMeta.easterEgg === 'cavern_fall' ? state.worldMeta.cavernFallAxis : '';
    const centerX = Math.floor(Game.constants3d.WORLD_W / 2);
    const centerZ = Math.floor(Game.constants3d.WORLD_D / 2);
    for (const candidate of blasterMinerHouseCandidates(state)) {
      if (generated.some((house) => house && house.key === candidate.key && house.generated)) continue;
      const caveTarget = candidate.cave || { x: candidate.x + 46, z: candidate.z + 19 };
      const minX = Math.min(candidate.x - 8, caveTarget.x - 2);
      const maxX = Math.max(candidate.x + 48, caveTarget.x + 2);
      const minZ = Math.min(candidate.z - 8, caveTarget.z - 2);
      const maxZ = Math.max(candidate.z + 20, caveTarget.z + 2);
      const intersects = axis === 'x'
        ? minX <= centerX && maxX >= centerX && maxZ >= bounds.minZ && minZ < bounds.maxZ
        : (axis === 'z'
          ? minZ <= centerZ && maxZ >= centerZ && maxX >= bounds.minX && minX < bounds.maxX
          : candidate.x >= bounds.minX && candidate.x < bounds.maxX && candidate.z >= bounds.minZ && candidate.z < bounds.maxZ);
      if (!intersects) continue;
      if (axis === 'x') state.world.cavernFallProjectionX = centerX;
      if (axis === 'z') state.world.cavernFallProjectionZ = centerZ;
      try {
        createBlasterMinerHouseAt3D(state, candidate.x, candidate.z, {
          key: candidate.key,
          cave: candidate.cave,
        });
      } finally {
        delete state.world.cavernFallProjectionX;
        delete state.world.cavernFallProjectionZ;
      }
    }
  }

  const TREE_HOUSE_FOREST_SAMPLE_STEP = 96;
  const TREE_HOUSE_MIN_SPAWN_DISTANCE = 160;
  const TREE_HOUSE_MIN_VILLAGE_DISTANCE = 92;
  const TREE_HOUSE_MIN_HOUSE_DISTANCE = 72;
  const TREE_HOUSE_FOOTPRINT_RADIUS = 8;
  const TREE_HOUSE_CLEAR_HEIGHT = 22;

  function treeHouseCountForForestComponent(seed, component) {
    const samples = component && Number.isFinite(component.samples) ? component.samples : 0;
    const roll = noise2(seed + 5821, component.id, samples);
    if (samples >= 10) return roll < 0.5 ? 3 : 4;
    if (samples >= 4) return 3;
    return roll < 0.5 ? 1 : 2;
  }

  function treeHouseSiteAllowed(state, seed, x, z, villages, chosen) {
    const world = state && state.world;
    if (!world) return null;
    if (x < TREE_HOUSE_FOOTPRINT_RADIUS + 2 || z < TREE_HOUSE_FOOTPRINT_RADIUS + 2) return false;
    if (x >= world.w - TREE_HOUSE_FOOTPRINT_RADIUS - 2 || z >= world.d - TREE_HOUSE_FOOTPRINT_RADIUS - 2) return false;
    if (!farFromSpawn(world, x, z, TREE_HOUSE_MIN_SPAWN_DISTANCE)) return false;
    if (biomeAt(seed, x, z) !== 'forest') return false;
    const groundY = terrainHeight(seed, x, z);
    if (groundY < 8 || groundY + TREE_HOUSE_CLEAR_HEIGHT >= world.h) return false;
    let forestSamples = 0;
    const forestChecks = [[0, 0], [16, 0], [-16, 0], [0, 16], [0, -16]];
    for (const [dx, dz] of forestChecks) {
      if (baseLandBiome(seed, x + dx, z + dz) === 'forest') forestSamples += 1;
    }
    if (forestSamples < 4) return false;
    for (const village of villages || []) {
      if (Math.hypot(x - village.x, z - village.z) < village.radius + TREE_HOUSE_MIN_VILLAGE_DISTANCE) return false;
    }
    for (const house of chosen || []) {
      if (Math.hypot(x - house.x, z - house.z) < TREE_HOUSE_MIN_HOUSE_DISTANCE) return false;
    }
    return { x, z, groundY };
  }

  function treeHouseCandidateAt(state, seed, key, x, z, villages, chosen) {
    const site = treeHouseSiteAllowed(state, seed, x, z, villages, chosen);
    if (!site) return null;
    return {
      key,
      type: 'tree_house',
      name: 'Домик на дереве',
      x: site.x,
      y: site.groundY + 1,
      z: site.z,
      groundY: site.groundY,
      generated: false,
    };
  }

  function scanForestComponentsForTreeHouses(state, seed) {
    const world = state && state.world;
    if (!world) return [];
    const step = TREE_HOUSE_FOREST_SAMPLE_STEP;
    const cols = Math.ceil(world.w / step);
    const rows = Math.ceil(world.d / step);
    const forest = new Uint8Array(cols * rows);
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const x = Math.min(world.w - 1, col * step + Math.floor(step / 2));
        const z = Math.min(world.d - 1, row * step + Math.floor(step / 2));
        if (baseLandBiome(seed, x, z) === 'forest') forest[row * cols + col] = 1;
      }
    }
    const visited = new Uint8Array(cols * rows);
    const components = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const start = row * cols + col;
        if (!forest[start] || visited[start]) continue;
        const stack = [[col, row]];
        const cells = [];
        visited[start] = 1;
        let minCol = col;
        let maxCol = col;
        let minRow = row;
        let maxRow = row;
        while (stack.length) {
          const [cx, cz] = stack.pop();
          cells.push({ col: cx, row: cz });
          minCol = Math.min(minCol, cx);
          maxCol = Math.max(maxCol, cx);
          minRow = Math.min(minRow, cz);
          maxRow = Math.max(maxRow, cz);
          const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]];
          for (const [dx, dz] of neighbors) {
            const nx = cx + dx;
            const nz = cz + dz;
            if (nx < 0 || nz < 0 || nx >= cols || nz >= rows) continue;
            const key = nz * cols + nx;
            if (!forest[key] || visited[key]) continue;
            visited[key] = 1;
            stack.push([nx, nz]);
          }
        }
        if (cells.length < 1) continue;
        components.push({
          id: components.length,
          samples: cells.length,
          cells,
          minX: minCol * step,
          maxX: Math.min(world.w - 1, (maxCol + 1) * step - 1),
          minZ: minRow * step,
          maxZ: Math.min(world.d - 1, (maxRow + 1) * step - 1),
        });
      }
    }
    return components;
  }

  function treeHouseCandidatesForComponent(state, seed, component, villages, chosen) {
    const targetCount = treeHouseCountForForestComponent(seed, component);
    const sortedCells = component.cells
      .map((cell) => ({ ...cell, order: noise2(seed + 5831 + component.id, cell.col, cell.row) }))
      .sort((a, b) => a.order - b.order);
    const houses = [];
    const maxAttempts = Math.min(sortedCells.length * 2, Math.max(18, targetCount * 24));
    for (let attempt = 0; attempt < maxAttempts && houses.length < targetCount; attempt += 1) {
      const cell = sortedCells[attempt % sortedCells.length];
      const pass = Math.floor(attempt / sortedCells.length);
      const baseX = cell.col * TREE_HOUSE_FOREST_SAMPLE_STEP;
      const baseZ = cell.row * TREE_HOUSE_FOREST_SAMPLE_STEP;
      const jitterX = Math.floor(noise2(seed + 5833 + pass, cell.col, cell.row) * (TREE_HOUSE_FOREST_SAMPLE_STEP - TREE_HOUSE_FOOTPRINT_RADIUS * 2));
      const jitterZ = Math.floor(noise2(seed + 5835 + pass, cell.row, cell.col) * (TREE_HOUSE_FOREST_SAMPLE_STEP - TREE_HOUSE_FOOTPRINT_RADIUS * 2));
      const x = baseX + TREE_HOUSE_FOOTPRINT_RADIUS + jitterX;
      const z = baseZ + TREE_HOUSE_FOOTPRINT_RADIUS + jitterZ;
      const key = `tree-house-${component.id}-${houses.length}`;
      const house = treeHouseCandidateAt(state, seed, key, x, z, villages, chosen.concat(houses));
      if (house) houses.push(house);
    }
    return houses;
  }

  function treeHouseCandidates(state) {
    const world = state && state.world;
    if (!world || !state.worldMeta || state.worldMeta.currentDimension === 'underground') return [];
    const axis = state.worldMeta.easterEgg === 'cavern_fall' ? state.worldMeta.cavernFallAxis : '';
    const planningWorld = axis ? { ...world, w: Game.constants3d.WORLD_W, d: Game.constants3d.WORLD_D } : world;
    const planningState = axis ? { ...state, world: planningWorld } : state;
    const cacheKey = `${state.worldMeta.seed || ''}:${planningWorld.w}:${planningWorld.d}:${axis}:forest-components-v2`;
    if (world.treeHousePlanKey === cacheKey && Array.isArray(world.treeHousePlan)) return world.treeHousePlan;
    const seed = worldSeed(state);
    const villages = VILLAGE_BLOCK_GENERATION_ENABLED ? getVillages3D(state) : [];
    const candidates = [];
    const components = scanForestComponentsForTreeHouses(planningState, seed);
    for (const component of components) {
      const componentHouses = treeHouseCandidatesForComponent(planningState, seed, component, villages, candidates);
      candidates.push(...componentHouses);
    }
    world.treeHousePlanKey = cacheKey;
    world.treeHousePlan = candidates;
    return candidates;
  }

  function registerTreeHouse(state, house) {
    if (!state || !state.world || !house) return;
    if (!Array.isArray(state.world.treeHouses)) state.world.treeHouses = [];
    const existing = state.world.treeHouses.find((item) => item && item.key === house.key);
    if (existing) Object.assign(existing, house);
    else state.world.treeHouses.push(house);
  }

  function canBuildTreeHouseAt(state, x, groundY, z) {
    const world = state && state.world;
    const sourceW = Number.isFinite(world && world.cavernFallProjectionX) ? Game.constants3d.WORLD_W : world && world.w;
    const sourceD = Number.isFinite(world && world.cavernFallProjectionZ) ? Game.constants3d.WORLD_D : world && world.d;
    if (!world || x < TREE_HOUSE_FOOTPRINT_RADIUS + 2 || z < TREE_HOUSE_FOOTPRINT_RADIUS + 2) return false;
    if (x >= sourceW - TREE_HOUSE_FOOTPRINT_RADIUS - 2 || z >= sourceD - TREE_HOUSE_FOOTPRINT_RADIUS - 2) return false;
    const localX = Number.isFinite(world.cavernFallProjectionX) ? x - world.cavernFallProjectionX : x;
    const localZ = Number.isFinite(world.cavernFallProjectionZ) ? z - world.cavernFallProjectionZ : z;
    if (localX < 0 || localX >= world.w || localZ < 0 || localZ >= world.d) {
      const seed = worldSeed(state);
      return terrainBlockAt(seed, x, groundY, z, { w: sourceW, h: world.h, d: sourceD }) === BLOCK.DIRT
        && hasInitialGrass(seed, x, groundY, z, { w: sourceW, h: world.h, d: sourceD });
    }
    const ground = getBlock3D(state, x, groundY, z);
    if (ground !== BLOCK.DIRT || getGrassLevel3D(state, x, groundY, z) <= 0) return false;
    return true;
  }

  function placeTreeHouseCrown(state, seed, x, z, floorY) {
    for (let yy = floorY - 4; yy <= floorY + 7; yy += 1) {
      const dy = yy - floorY;
      const radius = dy < -1 ? 3 : (dy > 4 ? 4 : 5);
      for (let zz = z - radius; zz <= z + radius; zz += 1) {
        for (let xx = x - radius; xx <= x + radius; xx += 1) {
          const dist = Math.abs(xx - x) + Math.abs(zz - z);
          if (dist > radius + 2) continue;
          if (noise2(seed + 5811 + yy, xx, zz) < 0.18 && dist > radius - 1) continue;
          if (getBlock3D(state, xx, yy, zz) === BLOCK.AIR) setBlock3D(state, xx, yy, zz, BLOCK.LEAF);
        }
      }
    }
  }

  function buildTreeHouseRoom(state, x, floorY, z) {
    clearBox(state, x - 3, floorY, z - 3, x + 3, floorY + 4, z + 3);
    fillBox(state, x - 3, floorY, z - 3, x + 3, floorY, z + 3, BLOCK.PLANK);
    for (let yy = floorY + 1; yy <= floorY + 3; yy += 1) {
      for (let xx = x - 3; xx <= x + 3; xx += 1) {
        setBlock3D(state, xx, yy, z - 3, BLOCK.PLANK);
        setBlock3D(state, xx, yy, z + 3, BLOCK.PLANK);
      }
      for (let zz = z - 2; zz <= z + 2; zz += 1) {
        setBlock3D(state, x - 3, yy, zz, BLOCK.PLANK);
        setBlock3D(state, x + 3, yy, zz, BLOCK.PLANK);
      }
    }
    for (let yy = floorY + 1; yy <= floorY + 3; yy += 1) {
      setBlock3D(state, x - 3, yy, z - 3, BLOCK.WOOD);
      setBlock3D(state, x + 3, yy, z - 3, BLOCK.WOOD);
      setBlock3D(state, x - 3, yy, z + 3, BLOCK.WOOD);
      setBlock3D(state, x + 3, yy, z + 3, BLOCK.WOOD);
    }
    clearBox(state, x - 1, floorY + 1, z - 3, x + 1, floorY + 2, z - 3);
    clearBox(state, x - 3, floorY + 2, z, x - 3, floorY + 2, z + 1);
    clearBox(state, x + 3, floorY + 2, z - 1, x + 3, floorY + 2, z);
    fillBox(state, x - 4, floorY + 4, z - 4, x + 4, floorY + 4, z + 4, BLOCK.PLANK);
    fillBox(state, x - 3, floorY + 5, z - 3, x + 3, floorY + 5, z + 3, BLOCK.LEAF);

    setBlock3D(state, x + 2, floorY + 1, z + 1, BLOCK.CHEST);
    markStructureChestLoot(state, x + 2, floorY + 1, z + 1, 'tree_house');
    setBlock3D(state, x - 2, floorY + 1, z + 1, BLOCK.PILLOW);
    setBlock3D(state, x - 2, floorY + 1, z + 2, BLOCK.WOOL);
    setBlock3D(state, x + 1, floorY + 1, z - 2, BLOCK.PLANK);
  }

  function buildTreeHouseBalcony(state, x, floorY, z) {
    clearBox(state, x - 2, floorY + 1, z + 4, x + 2, floorY + 3, z + 7);
    fillBox(state, x - 2, floorY, z + 4, x + 2, floorY, z + 7, BLOCK.PLANK);
    for (let zz = z + 4; zz <= z + 7; zz += 1) {
      setBlock3D(state, x - 3, floorY + 1, zz, BLOCK.WOOD);
      setBlock3D(state, x + 3, floorY + 1, zz, BLOCK.WOOD);
    }
    for (let xx = x - 3; xx <= x + 3; xx += 1) setBlock3D(state, xx, floorY + 1, z + 8, BLOCK.WOOD);
    setBlock3D(state, x - 3, floorY + 2, z + 4, BLOCK.WOOD);
    setBlock3D(state, x + 3, floorY + 2, z + 4, BLOCK.WOOD);
    setBlock3D(state, x - 3, floorY + 2, z + 8, BLOCK.WOOD);
    setBlock3D(state, x + 3, floorY + 2, z + 8, BLOCK.WOOD);
    clearBox(state, x - 1, floorY + 1, z + 3, x + 1, floorY + 2, z + 3);
  }

  function buildTreeHouseStair(state, x, groundY, z, floorY) {
    const steps = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    for (let y = groundY + 1; y <= floorY; y += 1) {
      const step = steps[(y - groundY - 1) % steps.length];
      const sx = x + step[0];
      const sz = z + step[1];
      setBlock3D(state, sx, y, sz, y % 3 === 0 || y === floorY ? BLOCK.PLANK : BLOCK.LADDER);
    }
  }

  function createTreeHouseAt3D(state, candidate) {
    if (!state || !state.world || !candidate) return null;
    const x = Math.round(candidate.x);
    const z = Math.round(candidate.z);
    const groundY = Number.isFinite(candidate.groundY) ? candidate.groundY : surfaceYForStructure(state, x, z);
    if (!canBuildTreeHouseAt(state, x, groundY, z)) return null;
    const trunkHeight = 11 + Math.floor(noise2(worldSeed(state) + 5807, x, z) * 2);
    const floorY = groundY + trunkHeight;
    if (!structureWriteVolumeReady(
      state,
      x - TREE_HOUSE_FOOTPRINT_RADIUS,
      groundY,
      z - TREE_HOUSE_FOOTPRINT_RADIUS,
      x + TREE_HOUSE_FOOTPRINT_RADIUS,
      groundY + TREE_HOUSE_CLEAR_HEIGHT,
      z + TREE_HOUSE_FOOTPRINT_RADIUS
    )) return null;
    state.world.suppressChunkModification = (state.world.suppressChunkModification || 0) + 1;
    state.world.allowChunkCreationWrites = (state.world.allowChunkCreationWrites || 0) + 1;
    try {
      clearBox(state, x - TREE_HOUSE_FOOTPRINT_RADIUS, groundY + 1, z - TREE_HOUSE_FOOTPRINT_RADIUS, x + TREE_HOUSE_FOOTPRINT_RADIUS, groundY + TREE_HOUSE_CLEAR_HEIGHT, z + TREE_HOUSE_FOOTPRINT_RADIUS);
      for (let y = groundY + 1; y <= floorY + 5; y += 1) setBlock3D(state, x, y, z, BLOCK.WOOD);
      placeTreeHouseCrown(state, worldSeed(state), x, z, floorY);
      buildTreeHouseStair(state, x, groundY, z, floorY);
      buildTreeHouseRoom(state, x, floorY, z);
      buildTreeHouseBalcony(state, x, floorY, z);
    } finally {
      state.world.allowChunkCreationWrites -= 1;
      state.world.suppressChunkModification -= 1;
    }
    const house = {
      ...candidate,
      x: Number.isFinite(state.world.cavernFallProjectionX) ? 0 : x,
      y: floorY,
      z: Number.isFinite(state.world.cavernFallProjectionZ) ? 0 : z,
      groundY,
      generated: true,
      chest: {
        x: Number.isFinite(state.world.cavernFallProjectionX) ? 0 : x + 2,
        y: floorY + 1,
        z: Number.isFinite(state.world.cavernFallProjectionZ) ? 0 : z + 1,
      },
    };
    registerTreeHouse(state, house);
    return house;
  }

  function getTreeHouses3D(state) {
    const byKey = new Map();
    for (const candidate of treeHouseCandidates(state)) byKey.set(candidate.key, candidate);
    const generated = state && state.world && Array.isArray(state.world.treeHouses) ? state.world.treeHouses : [];
    for (const house of generated) byKey.set(house.key, house);
    return Array.from(byKey.values());
  }

  function generateTreeHousesForColumn(state, bounds) {
    if (!state || !state.world || state.worldMeta && state.worldMeta.currentDimension === 'underground') return;
    const generated = state.world.treeHouses || [];
    const axis = state.worldMeta && state.worldMeta.easterEgg === 'cavern_fall' ? state.worldMeta.cavernFallAxis : '';
    const centerX = Math.floor(Game.constants3d.WORLD_W / 2);
    const centerZ = Math.floor(Game.constants3d.WORLD_D / 2);
    for (const candidate of treeHouseCandidates(state)) {
      if (generated.some((house) => house && house.key === candidate.key && house.generated)) continue;
      const intersects = axis === 'x'
        ? Math.abs(candidate.x - centerX) <= TREE_HOUSE_FOOTPRINT_RADIUS && candidate.z + TREE_HOUSE_FOOTPRINT_RADIUS >= bounds.minZ && candidate.z - TREE_HOUSE_FOOTPRINT_RADIUS < bounds.maxZ
        : (axis === 'z'
          ? Math.abs(candidate.z - centerZ) <= TREE_HOUSE_FOOTPRINT_RADIUS && candidate.x + TREE_HOUSE_FOOTPRINT_RADIUS >= bounds.minX && candidate.x - TREE_HOUSE_FOOTPRINT_RADIUS < bounds.maxX
          : candidate.x >= bounds.minX && candidate.x < bounds.maxX && candidate.z >= bounds.minZ && candidate.z < bounds.maxZ);
      if (!intersects) continue;
      if (axis === 'x') state.world.cavernFallProjectionX = centerX;
      if (axis === 'z') state.world.cavernFallProjectionZ = centerZ;
      try {
        createTreeHouseAt3D(state, candidate);
      } finally {
        delete state.world.cavernFallProjectionX;
        delete state.world.cavernFallProjectionZ;
      }
    }
  }

  function ensureTreeHousesAroundPlayer3D(state, radius = 56) {
    if (!state || !state.world || !state.player || state.worldMeta && state.worldMeta.currentDimension === 'underground') return 0;
    const generated = state.world.treeHouses || [];
    let created = 0;
    for (const candidate of treeHouseCandidates(state)) {
      if (generated.some((house) => house && house.key === candidate.key && house.generated)) continue;
      if (Math.hypot(candidate.x - state.player.x, candidate.z - state.player.z) > radius) continue;
      if (createTreeHouseAt3D(state, candidate)) created += 1;
    }
    return created;
  }

  function ensureBlasterMinerHousesAroundPlayer3D(state, radius = 40) {
    if (!state || !state.world || !state.player || state.worldMeta && state.worldMeta.currentDimension === 'underground') return 0;
    const generated = state.world.blasterMinerHouses || [];
    let created = 0;
    for (const candidate of blasterMinerHouseCandidates(state)) {
      if (generated.some((house) => house && house.key === candidate.key && house.generated)) continue;
      if (Math.hypot(candidate.x - state.player.x, candidate.z - state.player.z) > radius) continue;
      const house = createBlasterMinerHouseAt3D(state, candidate.x, candidate.z, {
        key: candidate.key,
        cave: candidate.cave,
        allowNearSpawn: true,
      });
      if (house) created += 1;
    }
    return created;
  }

  function spawnTentLootTableForBiome(biome) {
    if (biome === 'forest') return 'spawn_tent_forest';
    if (biome === 'desert') return 'spawn_tent_desert';
    if (biome === 'mountains') return 'spawn_tent_mountains';
    if (biome === 'cliffs') return 'spawn_tent_cliffs';
    if (biome === 'volcanic') return 'spawn_tent_volcanic';
    if (biome === 'snow_plains') return 'spawn_tent_snow_plains';
    if (biome === 'spruce_forest') return 'spawn_tent_spruce_forest';
    if (biome === 'mountain_forest') return 'spawn_tent_mountain_forest';
    if (biome === 'beach') return 'spawn_tent_beach';
    if (biome === 'lake') return 'spawn_tent_lake';
    if (biome === 'geysers') return 'spawn_tent_geysers';
    return 'spawn_tent_plains';
  }

  function spawnTentStyleForBiome(biome) {
    return { biome: biome || 'plains', floor: BLOCK.PLANK, wall: BLOCK.WOOL, roof: BLOCK.WOOL };
  }

  function placeTentStepBlock(state, x, y, z) {
    for (let yy = Math.max(1, y - 3); yy < y; yy += 1) {
      if (isReplaceableForTent(getBlock3D(state, x, yy, z))) setBlock3D(state, x, yy, z, BLOCK.DIRT);
    }
    setBlock3D(state, x, y, z, BLOCK.PLANK);
    for (let yy = y + 1; yy <= y + 3; yy += 1) {
      if (getBlock3D(state, x, yy, z) !== BLOCK.AIR) setBlock3D(state, x, yy, z, BLOCK.AIR);
    }
  }

  function placeTentEntranceStep(state, x0, baseY, z0, door) {
    if (door === 'north' || door === 'south') {
      const nearZ = door === 'north' ? z0 - 1 : z0 + SPAWN_TENT_SIZE;
      const farZ = door === 'north' ? z0 - 2 : z0 + SPAWN_TENT_SIZE + 1;
      for (const [z, y] of [[nearZ, baseY], [farZ, baseY - 1]]) {
        for (let x = x0 + SPAWN_TENT_CENTER - 2; x <= x0 + SPAWN_TENT_CENTER + 2; x += 1) placeTentStepBlock(state, x, y, z);
      }
      return;
    }
    const nearX = door === 'west' ? x0 - 1 : x0 + SPAWN_TENT_SIZE;
    const farX = door === 'west' ? x0 - 2 : x0 + SPAWN_TENT_SIZE + 1;
    for (const [x, y] of [[nearX, baseY], [farX, baseY - 1]]) {
      for (let z = z0 + SPAWN_TENT_CENTER - 2; z <= z0 + SPAWN_TENT_CENTER + 2; z += 1) placeTentStepBlock(state, x, y, z);
    }
  }

  function clearTentDoor(state, x0, baseY, z0, door) {
    if (door === 'north' || door === 'south') {
      const start = door === 'north' ? z0 : z0 + SPAWN_TENT_MAX;
      const end = door === 'north' ? z0 + 2 : z0 + SPAWN_TENT_MAX - 2;
      for (let zz = start; door === 'north' ? zz <= end : zz >= end; zz += (door === 'north' ? 1 : -1)) {
        for (let x = x0 + SPAWN_TENT_CENTER - 1; x <= x0 + SPAWN_TENT_CENTER + 1; x += 1) {
          for (let y = baseY + 1; y <= baseY + 2; y += 1) setBlock3D(state, x, y, zz, BLOCK.AIR);
        }
      }
      return;
    }
    const start = door === 'west' ? x0 : x0 + SPAWN_TENT_MAX;
    const end = door === 'west' ? x0 + 2 : x0 + SPAWN_TENT_MAX - 2;
    for (let xx = start; door === 'west' ? xx <= end : xx >= end; xx += (door === 'west' ? 1 : -1)) {
      for (let z = z0 + SPAWN_TENT_CENTER - 1; z <= z0 + SPAWN_TENT_CENTER + 1; z += 1) {
        for (let y = baseY + 1; y <= baseY + 2; y += 1) setBlock3D(state, xx, y, z, BLOCK.AIR);
      }
    }
  }

  function tentInteriorPositions(x0, z0, door) {
    const chest = { x: x0 + 6, z: z0 + 2 };
    const bedWool = [{ x: x0 + 2, z: z0 + 6 }, { x: x0 + 3, z: z0 + 6 }];
    const pillow = { x: x0 + 4, z: z0 + 6 };
    const planks = [
      { x: x0 + 2, z: z0 + 5 },
      { x: x0 + 6, z: z0 + 5 },
      { x: x0 + 6, z: z0 + 6 },
      { x: x0 + 2, z: z0 + 2 },
      { x: x0 + 2, z: z0 + 3 },
    ];
    if (door === 'south') {
      chest.z = z0 + 6;
      bedWool[0].z = z0 + 2;
      bedWool[1].z = z0 + 2;
      pillow.z = z0 + 2;
      planks[0].z = z0 + 5;
      planks[1].z = z0 + 5;
      planks[2].z = z0 + 2;
      planks[3].z = z0 + 6;
      planks[4].x = x0 + 3;
      planks[4].z = z0 + 6;
    } else if (door === 'east') {
      chest.x = x0 + 2;
      chest.z = z0 + SPAWN_TENT_CENTER;
      bedWool[0].x = x0 + 2;
      bedWool[0].z = z0 + 6;
      bedWool[1].x = x0 + 3;
      bedWool[1].z = z0 + 6;
      pillow.x = x0 + 4;
      pillow.z = z0 + 6;
      planks[0].x = x0 + 3;
      planks[0].z = z0 + 2;
      planks[1].x = x0 + 6;
      planks[1].z = z0 + 2;
      planks[2].x = x0 + 6;
      planks[2].z = z0 + 6;
      planks[3].x = x0 + 2;
      planks[3].z = z0 + 3;
      planks[4].x = x0 + 6;
      planks[4].z = z0 + 5;
    } else if (door === 'west') {
      chest.x = x0 + 6;
      chest.z = z0 + SPAWN_TENT_CENTER;
      bedWool[0].x = x0 + 4;
      bedWool[0].z = z0 + 6;
      bedWool[1].x = x0 + 5;
      bedWool[1].z = z0 + 6;
      pillow.x = x0 + 6;
      pillow.z = z0 + 6;
      planks[0].x = x0 + 5;
      planks[0].z = z0 + 2;
      planks[1].x = x0 + 2;
      planks[1].z = z0 + 2;
      planks[2].x = x0 + 2;
      planks[2].z = z0 + 6;
      planks[3].x = x0 + 6;
      planks[3].z = z0 + 2;
      planks[4].x = x0 + 5;
      planks[4].z = z0 + 3;
    }
    return { chest, bedWool, pillow, planks };
  }

  function placeTentShell(state, x0, baseY, z0, style) {
    for (let z = z0; z <= z0 + SPAWN_TENT_MAX; z += 1) {
      for (let x = x0; x <= x0 + SPAWN_TENT_MAX; x += 1) setBlock3D(state, x, baseY, z, style.floor);
    }
    for (let z = z0; z <= z0 + SPAWN_TENT_MAX; z += 1) {
      for (let y = baseY + 1; y <= baseY + 2; y += 1) {
        setBlock3D(state, x0, y, z, style.wall);
        setBlock3D(state, x0 + SPAWN_TENT_MAX, y, z, style.wall);
      }
      for (const sideX of [x0 + 1, x0 + 7]) {
        setBlock3D(state, sideX, baseY + 3, z, style.wall);
        setBlock3D(state, sideX, baseY + 4, z, style.roof);
      }
      for (const sideX of [x0 + 2, x0 + 6]) setBlock3D(state, sideX, baseY + 5, z, style.roof);
      for (const sideX of [x0 + 3, x0 + 5]) setBlock3D(state, sideX, baseY + 6, z, style.roof);
      setBlock3D(state, x0 + SPAWN_TENT_CENTER, baseY + 7, z, style.roof);
    }
    for (const z of [z0, z0 + SPAWN_TENT_MAX]) {
      for (let x = x0 + 1; x <= x0 + SPAWN_TENT_MAX - 1; x += 1) {
        const dist = Math.abs((x - x0) - SPAWN_TENT_CENTER);
        const maxY = baseY + Math.max(2, SPAWN_TENT_HEIGHT - dist);
        for (let y = baseY + 1; y <= maxY; y += 1) setBlock3D(state, x, y, z, y >= baseY + 5 ? style.roof : style.wall);
      }
    }
  }

  function placeSpawnTent3D(state, spawnX, spawnZ) {
    const meta = state && state.worldMeta;
    if (!meta || (meta.mode !== 'survival' && meta.mode !== 'creative')) return false;
    const seed = worldSeed(state);
    const cavernAxis = currentDimension(state) === 'overworld' && meta.easterEgg === 'cavern_fall'
      ? meta.cavernFallAxis
      : '';
    const sourceSpawnX = cavernAxis === 'x' ? Math.floor(Game.constants3d.WORLD_W / 2) : spawnX;
    const sourceSpawnZ = cavernAxis === 'z' ? Math.floor(Game.constants3d.WORLD_D / 2) : spawnZ;
    const placementState = cavernAxis
      ? { ...state, world: { ...state.world, w: Game.constants3d.WORLD_W, d: Game.constants3d.WORLD_D } }
      : state;
    const candidates = spawnTentCandidatesForSpawn(sourceSpawnX, sourceSpawnZ);
    let site = null;
    for (const candidate of candidates) {
      const baseY = canPlaceSpawnTent(placementState, seed, candidate.x0, candidate.z0);
      if (baseY !== null) {
        site = { ...candidate, baseY };
        break;
      }
    }
    if (!site) return false;
    const { x0, z0, baseY, door } = site;
    if (!cavernAxis && !structureWriteVolumeReady(
      state,
      x0 - 2,
      Math.max(1, baseY - 4),
      z0 - 2,
      x0 + SPAWN_TENT_SIZE + 1,
      baseY + SPAWN_TENT_HEIGHT,
      z0 + SPAWN_TENT_SIZE + 1
    )) return false;
    if (cavernAxis === 'x') state.world.cavernFallProjectionX = Math.floor(Game.constants3d.WORLD_W / 2);
    if (cavernAxis === 'z') state.world.cavernFallProjectionZ = Math.floor(Game.constants3d.WORLD_D / 2);
    const spawnBiome = biomeAt(seed, sourceSpawnX, sourceSpawnZ);
    const style = spawnTentStyleForBiome(spawnBiome);
    try {
      clearTentVolume(state, x0, baseY, z0);
      placeTentShell(state, x0, baseY, z0, style);
      clearTentDoor(state, x0, baseY, z0, door);
      placeTentEntranceStep(state, x0, baseY, z0, door);
      clearTentDoor(state, x0, baseY, z0, door);
      const interior = tentInteriorPositions(x0, z0, door);
      for (const wool of interior.bedWool) setBlock3D(state, wool.x, baseY + 1, wool.z, BLOCK.WOOL);
      setBlock3D(state, interior.pillow.x, baseY + 1, interior.pillow.z, BLOCK.PILLOW);
      for (const plank of interior.planks) setBlock3D(state, plank.x, baseY + 1, plank.z, BLOCK.PLANK);
      const chestX = interior.chest.x;
      const chestY = baseY + 1;
      const chestZ = interior.chest.z;
      if (setBlock3D(state, chestX, chestY, chestZ, BLOCK.CHEST)) {
        const localChestX = cavernAxis === 'x' ? chestX - Math.floor(Game.constants3d.WORLD_W / 2) : chestX;
        const localChestZ = cavernAxis === 'z' ? chestZ - Math.floor(Game.constants3d.WORLD_D / 2) : chestZ;
        markStructureChestLoot(state, localChestX, chestY, localChestZ, spawnTentLootTableForBiome(spawnBiome));
      }
      return true;
    } finally {
      delete state.world.cavernFallProjectionX;
      delete state.world.cavernFallProjectionZ;
    }
  }

  function hasInitialGrass(seed, x, y, z, world) {
    const source = Game.easterEggs3d
      ? Game.easterEggs3d.getCavernFallSourceCell(world && world.worldMeta, x, z, world && world.dimension)
      : { x, z };
    const biome = biomeAt(seed, source.x, source.z);
    return y === terrainHeight(seed, source.x, source.z)
      && (biome === 'plains' || biome === 'forest' || biome === 'spruce_forest')
      && dryTransitionSurface(seed, source.x, source.z, biome) === BLOCK.AIR
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

  function estimateSurfaceChunkRange(state, seed, cx, cz, counts) {
    const minX = cx * CHUNK_SIZE;
    const minZ = cz * CHUNK_SIZE;
    const maxX = Math.min(minX + CHUNK_SIZE - 1, counts.x * CHUNK_SIZE - 1);
    const maxZ = Math.min(minZ + CHUNK_SIZE - 1, counts.z * CHUNK_SIZE - 1);
    const samples = [
      [minX + Math.floor((maxX - minX) / 2), minZ + Math.floor((maxZ - minZ) / 2)],
      [minX, minZ],
      [maxX, minZ],
      [minX, maxZ],
      [maxX, maxZ],
    ];
    let minCy = counts.y - 1;
    let maxCy = 0;
    for (const [x, z] of samples) {
      const source = surfaceSourceCell(state, x, z);
      const cy = Math.max(0, Math.min(counts.y - 1, Math.floor(terrainHeight(seed, source.x, source.z) / CHUNK_SIZE)));
      minCy = Math.min(minCy, cy);
      maxCy = Math.max(maxCy, cy);
    }
    return { minCy, maxCy, centerCy: Math.floor((minCy + maxCy) / 2) };
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

  function maxChunkWorkerCount() {
    const configured = Math.max(1, Math.floor(CHUNK_WORKER_MAX_COUNT || 1));
    const cores = typeof navigator !== 'undefined' && Number.isFinite(navigator.hardwareConcurrency)
      ? Math.max(1, navigator.hardwareConcurrency - 1)
      : 2;
    return Math.max(1, Math.min(configured, cores));
  }

  function requeuePendingWorkerJobs(stateRef) {
    if (!stateRef || !stateRef.world || !stateRef.world.chunkLoading) return;
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

  function disableChunkWorkers() {
    for (const worker of chunkWorkers) {
      try {
        worker.terminate();
      } catch (error) {
        // Worker termination can fail during browser shutdown.
      }
    }
    chunkWorkers = [];
    chunkWorker = null;
    chunkWorkerAvailable = false;
  }

  function isPendingTeleportColumn(state, cx, cz) {
    const target = state.ui && state.ui.pendingMapTeleport;
    if (!target) return false;
    const dx = cx - Math.floor(target.x / CHUNK_SIZE);
    const dz = cz - Math.floor(target.z / CHUNK_SIZE);
    const radius = Number.isFinite(target.radius) ? target.radius : 1;
    return dx * dx + dz * dz <= radius * radius;
  }

  function isOptimizationChunkNeeded(state, cx, cz) {
    if (state.worldMeta && state.worldMeta.superOptimization) {
      const dx = cx - Math.floor(state.player.x / CHUNK_SIZE);
      const dz = cz - Math.floor(state.player.z / CHUNK_SIZE);
      const radius = Game.constants3d.CHUNK_OPTIMIZATION_PRELOAD_RADIUS + 1;
      return dx * dx + dz * dz <= radius * radius || isPendingTeleportColumn(state, cx, cz);
    }
    return Game.constants3d.isActiveSimulationPosition3D(state, cx * CHUNK_SIZE, cz * CHUNK_SIZE)
      || isPendingTeleportColumn(state, cx, cz);
  }

  function initChunkWorker(state) {
    if (chunkWorkers.length > 0) return true;
    if (!chunkWorkerAvailable || typeof Worker === 'undefined') return false;
    try {
      const count = maxChunkWorkerCount();
      for (let i = 0; i < count; i += 1) {
        const worker = new Worker('./src/3d/chunkWorker3d.js');
        worker.onmessage = (event) => {
          const data = event && event.data ? event.data : null;
          const stateRef = activeState;
          if (!data || !stateRef || !stateRef.world) return;
          const loading = ensureChunkLoading(stateRef);
          const job = loading.pendingIds.get(data.id);
          if (!job) return;
          loading.pendingIds.delete(data.id);
          loading.pendingKeys.delete(job.key);
          if (job.worldId !== currentStorageWorldId(stateRef) || job.seed !== worldSeed(stateRef)) return;
          if (!isOptimizationChunkNeeded(stateRef, data.cx, data.cz)) return;
          installGeneratedChunk3D(stateRef, data.cx, data.cy, data.cz, data.blocks, data.fluidLevel, data.grassLevel || null);
        };
        worker.onerror = () => {
          requeuePendingWorkerJobs(activeState);
          disableChunkWorkers();
        };
        chunkWorkers.push(worker);
      }
      chunkWorker = chunkWorkers[0] || null;
    } catch (error) {
      requeuePendingWorkerJobs(state);
      disableChunkWorkers();
    }
    return chunkWorkers.length > 0;
  }

  function hasTerrainChunk(state, cx, cy, cz) {
    const key = chunkKey(cx, cy, cz);
    return !!((state.world.generatedChunks && state.world.generatedChunks.has(key)) || (state.world.modifiedChunks && state.world.modifiedChunks.has(key)));
  }

  function structureWriteVolumeReady(state, minX, minY, minZ, maxX, maxY, maxZ) {
    const world = state && state.world;
    if (!world) return false;
    if (Number.isFinite(world.cavernFallProjectionX)) {
      minX -= world.cavernFallProjectionX;
      maxX -= world.cavernFallProjectionX;
    }
    if (Number.isFinite(world.cavernFallProjectionZ)) {
      minZ -= world.cavernFallProjectionZ;
      maxZ -= world.cavernFallProjectionZ;
    }
    const counts = chunkCounts(world);
    const x0 = Math.max(0, Math.floor(minX));
    const y0 = Math.max(0, Math.floor(minY));
    const z0 = Math.max(0, Math.floor(minZ));
    const x1 = Math.min(world.w - 1, Math.floor(maxX));
    const y1 = Math.min(world.h - 1, Math.floor(maxY));
    const z1 = Math.min(world.d - 1, Math.floor(maxZ));
    if (x0 > x1 || y0 > y1 || z0 > z1) return false;
    const minCx = Math.floor(x0 / CHUNK_SIZE);
    const maxCx = Math.floor(x1 / CHUNK_SIZE);
    const minCy = Math.floor(y0 / CHUNK_SIZE);
    const maxCy = Math.floor(y1 / CHUNK_SIZE);
    const minCz = Math.floor(z0 / CHUNK_SIZE);
    const maxCz = Math.floor(z1 / CHUNK_SIZE);
    for (let cz = minCz; cz <= maxCz; cz += 1) {
      for (let cx = minCx; cx <= maxCx; cx += 1) {
        for (let cy = minCy; cy <= maxCy; cy += 1) {
          if (cx < 0 || cy < 0 || cz < 0 || cx >= counts.x || cy >= counts.y || cz >= counts.z) return false;
          if (!hasTerrainChunk(state, cx, cy, cz)) return false;
        }
      }
    }
    return true;
  }

  function queueTerrainChunk3D(state, cx, cy, cz, mandatory = false) {
    if (hasTerrainChunk(state, cx, cy, cz)) return false;
    const loading = ensureChunkLoading(state);
    const key = chunkKey(cx, cy, cz);
    if (loading.queued.has(key)) {
      if (mandatory) {
        const job = loading.queue.find((item) => item.key === key);
        if (job) job.mandatory = true;
      }
      return false;
    }
    if (loading.pendingKeys.has(key) || loading.loadingSaved.has(key)) return false;
    loading.queue.push({ cx, cy, cz, key, mandatory });
    loading.queued.add(key);
    return true;
  }

  function loadSavedChunkJob(state, job) {
    const storage = Game.storage3d;
    const loading = ensureChunkLoading(state);
    if (!storage || !storage.isAvailable || !storage.isAvailable() || !state.world.savedChunks || !state.world.savedChunks.has(job.key)) return false;
    loading.loadingSaved.add(job.key);
    storage.loadChunkSnapshot(currentStorageWorldId(state), job.key).then((snapshot) => {
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

  function queueChunksAroundPoint3D(state, centerX, centerY, centerZ, radius, options = {}) {
    const counts = chunkCounts(state.world);
    const loading = ensureChunkLoading(state);
    const seed = worldSeed(state);
    const manualDistance = isManualChunkRenderDistance(state.worldMeta);
    const usingSyncFallback = !chunkWorker && (!chunkWorkerAvailable || typeof Worker === 'undefined');
    const effectiveRadius = usingSyncFallback && !manualDistance ? Math.min(radius, CHUNK_SYNC_FALLBACK_RADIUS || radius) : radius;
    const pcx = Math.max(0, Math.min(counts.x - 1, Math.floor(centerX / CHUNK_SIZE)));
    const pcy = Math.max(0, Math.min(counts.y - 1, Math.floor(centerY / CHUNK_SIZE)));
    const pcz = Math.max(0, Math.min(counts.z - 1, Math.floor(centerZ / CHUNK_SIZE)));
    const surfaceRangeCache = new Map();
    const surfaceChunkRange = (cx, cz) => {
      const key = `${cx},${cz}`;
      if (surfaceRangeCache.has(key)) return surfaceRangeCache.get(key);
      const value = estimateSurfaceChunkRange(state, seed, cx, cz, counts);
      surfaceRangeCache.set(key, value);
      return value;
    };
    const shouldQueueVerticalChunk = (cx, cy, cz) => {
      if (state.worldMeta && state.worldMeta.superOptimization) return true;
      if (!usingSyncFallback || manualDistance) return true;
      const surface = surfaceChunkRange(cx, cz);
      if (Math.abs(cy - pcy) <= 1) return true;
      return cy >= Math.max(0, surface.minCy - 2) && cy <= Math.min(counts.y - 1, surface.maxCy + 2);
    };
    const verticalPriorityFor = (cx, cy, cz) => {
      const surface = surfaceChunkRange(cx, cz);
      const surfaceDistance = cy < surface.minCy ? surface.minCy - cy : (cy > surface.maxCy ? cy - surface.maxCy : 0);
      return Math.min(Math.abs(cy - pcy), surfaceDistance);
    };
    const compareTerrainJobs = (a, b) => {
      if (!!a.mandatory !== !!b.mandatory) return a.mandatory ? -1 : 1;
      const adx = a.cx - pcx;
      const adz = a.cz - pcz;
      const bdx = b.cx - pcx;
      const bdz = b.cz - pcz;
      const distanceDelta = (adx * adx + adz * adz) - (bdx * bdx + bdz * bdz);
      const playerYDelta = Math.abs(a.cy - pcy) - Math.abs(b.cy - pcy);
      const verticalDelta = verticalPriorityFor(a.cx, a.cy, a.cz) - verticalPriorityFor(b.cx, b.cy, b.cz);
      if (!usingSyncFallback) {
        const aSurfaceScore = verticalPriorityFor(a.cx, a.cy, a.cz) + (adx * adx + adz * adz) * TERRAIN_SURFACE_PRIORITY_WEIGHT;
        const bSurfaceScore = verticalPriorityFor(b.cx, b.cy, b.cz) + (bdx * bdx + bdz * bdz) * TERRAIN_SURFACE_PRIORITY_WEIGHT;
        return (aSurfaceScore - bSurfaceScore) || playerYDelta || distanceDelta;
      }
      return verticalDelta || distanceDelta || playerYDelta;
    };
    const queueKeyPrefix = options.queueKeyPrefix || 'player';
    const queueKey = `${queueKeyPrefix}:${currentStorageWorldId(state)}:${seed}:${pcx}:${pcy}:${pcz}:${effectiveRadius}:${chunkWorker ? 'worker' : 'sync'}:${manualDistance ? 'manual' : 'auto'}`;
    if (loading.lastQueueKey === queueKey && loading.queue.length > 0) {
      loading.queue.sort(compareTerrainJobs);
      state.world.lastQueuedChunks = loading.queue.length;
      return 0;
    }
    loading.lastQueueKey = queueKey;
    const candidates = [];
    for (let cz = Math.max(0, pcz - effectiveRadius); cz < Math.min(counts.z, pcz + effectiveRadius + 1); cz += 1) {
      for (let cx = Math.max(0, pcx - effectiveRadius); cx < Math.min(counts.x, pcx + effectiveRadius + 1); cx += 1) {
        const dx = cx - pcx;
        const dz = cz - pcz;
        const distanceSq = dx * dx + dz * dz;
        if (distanceSq > effectiveRadius * effectiveRadius) continue;
        for (let cy = 0; cy < counts.y; cy += 1) {
          if (!shouldQueueVerticalChunk(cx, cy, cz)) continue;
          const verticalPriority = verticalPriorityFor(cx, cy, cz);
          candidates.push({ cx, cy, cz, distanceSq, verticalPriority, mandatory: manualDistance });
        }
      }
    }
    candidates.sort(compareTerrainJobs);
    let queued = 0;
    for (const item of candidates) {
      if (queueTerrainChunk3D(state, item.cx, item.cy, item.cz, item.mandatory)) queued += 1;
    }
    if (options.pruneQueue !== false) {
      loading.queue = loading.queue.filter((job) => {
        const dx = job.cx - pcx;
        const dz = job.cz - pcz;
        const keepRadius = manualDistance || (state.worldMeta && state.worldMeta.superOptimization)
          ? effectiveRadius + 1
          : (usingSyncFallback ? effectiveRadius : CHUNK_UNLOAD_DISTANCE);
        const keep = (dx * dx + dz * dz <= keepRadius * keepRadius || isPendingTeleportColumn(state, job.cx, job.cz))
          && shouldQueueVerticalChunk(job.cx, job.cy, job.cz);
        if (!keep) loading.queued.delete(job.key);
        return keep;
      });
    }
    loading.queue.sort(compareTerrainJobs);
    return queued;
  }

  function queueChunksAroundPlayer3D(state, radius) {
    return queueChunksAroundPoint3D(state, state.player.x, state.player.y, state.player.z, radius, { queueKeyPrefix: 'player' });
  }

  function postWorkerChunkJob(state, job, seed) {
    const loading = ensureChunkLoading(state);
    const workers = chunkWorkers.length ? chunkWorkers : (chunkWorker ? [chunkWorker] : []);
    if (!workers.length) return false;
    const worker = workers[nextWorkerIndex % workers.length];
    nextWorkerIndex += 1;
    const id = nextWorkerJobId;
    nextWorkerJobId += 1;
    loading.pendingIds.set(id, {
      key: job.key,
      worldId: currentStorageWorldId(state),
      seed,
    });
    loading.pendingKeys.add(job.key);
    worker.postMessage({
      type: 'generate',
      id,
      seed,
      world: { w: state.world.w, h: state.world.h, d: state.world.d, dimension: currentDimension(state), worldMeta: state.worldMeta },
      blockIds: BLOCK,
      cx: job.cx,
      cy: job.cy,
      cz: job.cz,
    });
    return true;
  }

  function beginSyncTerrainJob(state, job) {
    const bounds = chunkBounds(state.world, job.cx, job.cy, job.cz);
    if (!bounds) return null;
    const size = CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE;
    const fluidLevel = new Uint8Array(size);
    fluidLevel.fill(255);
    return {
      cx: job.cx,
      cy: job.cy,
      cz: job.cz,
      key: job.key,
      bounds,
      blocks: new Uint16Array(size),
      fluidLevel,
      grassLevel: new Uint8Array(size),
      x: bounds.minX,
      y: bounds.minY,
      z: bounds.minZ,
    };
  }

  function syncLocalIndex(job, x, y, z) {
    return (x - job.bounds.minX) + CHUNK_SIZE * ((z - job.bounds.minZ) + CHUNK_SIZE * (y - job.bounds.minY));
  }

  function processSyncTerrainJob(state, seed, loading, budgetMs) {
    const start = performance.now();
    let completed = 0;
    while (performance.now() - start < budgetMs) {
      if (!loading.syncJob) {
        while (loading.queue.length > 0 && !loading.syncJob) {
          const next = loading.queue.shift();
          loading.queued.delete(next.key);
          if (hasTerrainChunk(state, next.cx, next.cy, next.cz)) continue;
          if (loadSavedChunkJob(state, next)) {
            completed += 1;
            continue;
          }
          loading.syncJob = beginSyncTerrainJob(state, next);
        }
        if (!loading.syncJob) break;
      }

      const job = loading.syncJob;
      const block = terrainBlockAt(seed, job.x, job.y, job.z, state.world);
      const index = syncLocalIndex(job, job.x, job.y, job.z);
      job.blocks[index] = block;
      if (block === BLOCK.WATER) job.fluidLevel[index] = 8;
      else if (block === BLOCK.LAVA || block === BLOCK.VOLCANIC_LAVA) job.fluidLevel[index] = 0;
      else if (block === BLOCK.DIRT && hasInitialGrass(seed, job.x, job.y, job.z, state.world)) job.grassLevel[index] = 1;

      job.x += 1;
      if (job.x >= job.bounds.maxX) {
        job.x = job.bounds.minX;
        job.z += 1;
        if (job.z >= job.bounds.maxZ) {
          job.z = job.bounds.minZ;
          job.y += 1;
        }
      }
      if (job.y >= job.bounds.maxY) {
        installGeneratedChunk3D(state, job.cx, job.cy, job.cz, job.blocks, job.fluidLevel, job.grassLevel);
        state.world.dirtyChunks.add(job.key);
        loading.syncJob = null;
        completed += 1;
      }
    }
    state.world.lastSyncChunkProgress = loading.syncJob
      ? Math.max(0, Math.min(1, (loading.syncJob.y - loading.syncJob.bounds.minY) / Math.max(1, loading.syncJob.bounds.maxY - loading.syncJob.bounds.minY)))
      : 0;
    return completed;
  }

  function syncTerrainBudgetMs(state) {
    const base = Math.max(0.5, CHUNK_SYNC_GENERATE_TIME_BUDGET_MS || 3);
    if (Game.performance3d && Game.performance3d.isMobileOptimization3D(state)) {
      return Game.performance3d.getMobileWorkBudget3D(state, base);
    }
    const maxBudget = Math.max(base, CHUNK_SYNC_GENERATE_MAX_TIME_BUDGET_MS || base);
    const fps = state && state.ui ? state.ui.fps : 0;
    if (!Number.isFinite(fps) || fps <= 0) return base;
    if (fps >= 85) return maxBudget;
    if (fps >= 65) return Math.min(maxBudget, base * 1.5);
    return base;
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
        if (postWorkerChunkJob(state, job, seed)) processed += 1;
      }
      state.world.lastQueuedChunks = loading.queue.length;
      state.world.lastPendingChunks = loading.pendingIds.size + loading.loadingSaved.size;
      return processed;
    }

    processed += processSyncTerrainJob(state, seed, loading, syncTerrainBudgetMs(state));
    state.world.lastQueuedChunks = loading.queue.length;
    state.world.lastPendingChunks = loading.syncJob ? 1 : 0;
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
      const saved = await storage.saveChunkSnapshot(currentStorageWorldId(state, targetWorldId), key, snapshot);
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
    state.world.allowChunkCreationWrites = (state.world.allowChunkCreationWrites || 0) + 1;
    try {
      for (let y = bounds.minY; y < bounds.maxY; y += 1) {
        for (let z = bounds.minZ; z < bounds.maxZ; z += 1) {
          for (let x = bounds.minX; x < bounds.maxX; x += 1) {
            const block = terrainBlockAt(seed, x, y, z, state.world);
            if (block === BLOCK.WATER) setStaticWater3D(state, x, y, z);
            else if (block === BLOCK.LAVA) setLava3D(state, x, y, z, 0, true);
            else if (block === BLOCK.VOLCANIC_LAVA) setVolcanicLava3D(state, x, y, z, 0, true);
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
      state.world.allowChunkCreationWrites -= 1;
      state.world.suppressChunkModification -= 1;
    }
    // AIR writes do not allocate chunks. Materialize empty terrain too, so
    // structures can write above the surface after the chunk is marked ready.
    if (!state.world.chunks.has(key)) {
      const volume = CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE;
      installGeneratedChunk3D(state, cx, cy, cz, new Uint16Array(volume), new Uint8Array(volume).fill(255));
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

  function isSurfaceColumnGenerated(state, seed, cx, cz, counts) {
    const world = state && state.world;
    if (!world || !world.generatedChunks || cx < 0 || cz < 0 || cx >= counts.x || cz >= counts.z) return false;
    const range = decorationChunkRange(state, seed, cx, cz, counts);
    for (let cy = range.minCy; cy <= range.maxCy; cy += 1) {
      if (!world.generatedChunks.has(chunkKey(cx, cy, cz))) return false;
    }
    return true;
  }

  function decorationChunkRange(state, seed, cx, cz, counts) {
    const world = state && state.world;
    const dimension = currentDimension(state);
    const axis = dimension === 'overworld' && state.worldMeta && state.worldMeta.easterEgg === 'cavern_fall'
      ? state.worldMeta.cavernFallAxis
      : '';
    const cacheKey = `${seed}:${dimension}:${axis}:${cx},${cz}`;
    if (world.decorationChunkRangeCache && world.decorationChunkRangeCache.has(cacheKey)) {
      return world.decorationChunkRangeCache.get(cacheKey);
    }
    if (!world.decorationChunkRangeCache) world.decorationChunkRangeCache = new Map();
    const minX = cx * CHUNK_SIZE;
    const minZ = cz * CHUNK_SIZE;
    const maxX = Math.min(world.w, minX + CHUNK_SIZE);
    const maxZ = Math.min(world.d, minZ + CHUNK_SIZE);
    let minY = world.h - 1;
    let maxY = 0;
    for (let z = minZ; z < maxZ; z += 1) {
      for (let x = minX; x < maxX; x += 1) {
        const source = surfaceSourceCell(state, x, z);
        const y = terrainHeight(seed, source.x, source.z);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
    const range = {
      minCy: Math.max(0, Math.floor((minY - DECORATION_MIN_WRITE_BELOW) / CHUNK_SIZE)),
      maxCy: Math.min(counts.y - 1, Math.floor((maxY + DECORATION_MAX_WRITE_ABOVE) / CHUNK_SIZE)),
    };
    world.decorationChunkRangeCache.set(cacheKey, range);
    return range;
  }

  function isSurfaceDecorationReady(state, seed, cx, cz, counts) {
    if (!isSurfaceColumnGenerated(state, seed, cx, cz, counts)) return false;
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= counts.x || nz >= counts.z) continue;
        if (!isSurfaceColumnGenerated(state, seed, nx, nz, counts)) return false;
      }
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

  function canPlaceTree(state, x, groundY, z, height, groundBlocks = null) {
    const world = state.world;
    const projectedX = Number.isFinite(world.cavernFallProjectionX);
    const projectedZ = Number.isFinite(world.cavernFallProjectionZ);
    const boundsW = projectedX ? Game.constants3d.WORLD_W : world.w;
    const boundsD = projectedZ ? Game.constants3d.WORLD_D : world.d;
    if (x < 3 || x >= boundsW - 3 || z < 3 || z >= boundsD - 3) return false;
    const localX = x % CHUNK_SIZE;
    const localZ = z % CHUNK_SIZE;
    if (!projectedX && (localX < TREE_CROWN_RADIUS || localX >= CHUNK_SIZE - TREE_CROWN_RADIUS)) return false;
    if (!projectedZ && (localZ < TREE_CROWN_RADIUS || localZ >= CHUNK_SIZE - TREE_CROWN_RADIUS)) return false;
    if (groundY + height + 3 >= world.h) return false;
    const spawnX = Math.floor(boundsW / 2);
    const spawnZ = Math.floor(boundsD / 2);
    if (Math.hypot(x - spawnX, z - spawnZ) < 8) return false;
    const projectedGroundX = projectedX ? x - world.cavernFallProjectionX : x;
    const projectedGroundZ = projectedZ ? z - world.cavernFallProjectionZ : z;
    const groundOnSlice = projectedGroundX >= 0 && projectedGroundX < world.w && projectedGroundZ >= 0 && projectedGroundZ < world.d;
    const sourceWorld = { w: boundsW, h: world.h, d: boundsD };
    const ground = groundOnSlice
      ? getBlock3D(state, x, groundY, z)
      : terrainBlockAt(worldSeed(state), x, groundY, z, sourceWorld);
    if (Array.isArray(groundBlocks)) {
      if (!groundBlocks.includes(ground)) return false;
    } else if (ground !== BLOCK.DIRT || (groundOnSlice
      ? getGrassLevel3D(state, x, groundY, z) <= 0
      : !hasInitialGrass(worldSeed(state), x, groundY, z, sourceWorld))) {
      return false;
    }
    for (let y = groundY + 1; y <= groundY + height + 3; y += 1) {
      for (let zz = z - 2; zz <= z + 2; zz += 1) {
        for (let xx = x - 2; xx <= x + 2; xx += 1) {
          const localProjectedX = projectedX ? xx - world.cavernFallProjectionX : xx;
          const localProjectedZ = projectedZ ? zz - world.cavernFallProjectionZ : zz;
          const insideSlice = localProjectedX >= 0 && localProjectedX < world.w && localProjectedZ >= 0 && localProjectedZ < world.d;
          const id = insideSlice
            ? getBlock3D(state, xx, y, zz)
            : terrainBlockAt(worldSeed(state), xx, y, zz, sourceWorld);
          if (id !== BLOCK.AIR) return false;
        }
      }
    }
    return true;
  }

  function placeTree(state, seed, x, groundY, z, options = {}) {
    const height = 4 + Math.floor(noise2(seed + 511, x, z) * 3);
    if (!canPlaceTree(state, x, groundY, z, height, options.groundBlocks || null)) return false;
    const woodBlock = options.wood || BLOCK.WOOD;
    const leafBlock = options.leaf || BLOCK.LEAF;
    for (let y = groundY + 1; y <= groundY + height; y += 1) {
      setBlock3D(state, x, y, z, woodBlock);
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
          if (getBlock3D(state, xx, yy, zz) === BLOCK.AIR) setBlock3D(state, xx, yy, zz, leafBlock);
        }
      }
    }
    return true;
  }

  function placeSpruceTree(state, seed, x, groundY, z) {
    const height = 5 + Math.floor(noise2(seed + 531, x, z) * 4);
    if (!canPlaceTree(state, x, groundY, z, height, [BLOCK.DIRT, BLOCK.SNOW])) return false;
    for (let y = groundY + 1; y <= groundY + height; y += 1) setBlock3D(state, x, y, z, BLOCK.SPRUCE_WOOD);
    for (let yy = groundY + 2; yy <= groundY + height + 2; yy += 1) {
      const fromTop = groundY + height + 2 - yy;
      const layerRadius = fromTop <= 1 ? 1 : (fromTop <= 3 ? 2 : 1);
      for (let zz = z - layerRadius; zz <= z + layerRadius; zz += 1) {
        for (let xx = x - layerRadius; xx <= x + layerRadius; xx += 1) {
          const dx = Math.abs(xx - x);
          const dz = Math.abs(zz - z);
          if (dx === layerRadius && dz === layerRadius && noise2(seed + 931, xx, zz + yy) < 0.38) continue;
          if (getBlock3D(state, xx, yy, zz) === BLOCK.AIR) setBlock3D(state, xx, yy, zz, BLOCK.SPRUCE_LEAF);
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
    const projectedX = Number.isFinite(state.world.cavernFallProjectionX);
    const projectedZ = Number.isFinite(state.world.cavernFallProjectionZ);
    const localCenterX = projectedX ? x - state.world.cavernFallProjectionX : x;
    const localCenterZ = projectedZ ? z - state.world.cavernFallProjectionZ : z;
    const centerOnSlice = localCenterX >= 0 && localCenterX < state.world.w && localCenterZ >= 0 && localCenterZ < state.world.d;
    const sourceWorld = { w: Game.constants3d.WORLD_W, h: state.world.h, d: Game.constants3d.WORLD_D };
    const ground = centerOnSlice
      ? getBlock3D(state, x, groundY, z)
      : terrainBlockAt(worldSeed(state), x, groundY, z, sourceWorld);
    if (ground !== BLOCK.STONE && ground !== BLOCK.RED_EARTH && ground !== BLOCK.SNOW && ground !== BLOCK.BLACKSTONE) return false;
    const centerAir = centerOnSlice
      ? getBlock3D(state, x, groundY + 1, z)
      : terrainBlockAt(worldSeed(state), x, groundY + 1, z, sourceWorld);
    if (centerAir !== BLOCK.AIR) return false;
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dz === 0) continue;
        const localX = Number.isFinite(state.world.cavernFallProjectionX) ? x + dx - state.world.cavernFallProjectionX : x + dx;
        const localZ = Number.isFinite(state.world.cavernFallProjectionZ) ? z + dz - state.world.cavernFallProjectionZ : z + dz;
        const insideSlice = localX >= 0 && localX < state.world.w && localZ >= 0 && localZ < state.world.d;
        const id = insideSlice
          ? getBlock3D(state, x + dx, groundY + 1, z + dz)
          : terrainBlockAt(worldSeed(state), x + dx, groundY + 1, z + dz, sourceWorld);
        if (id !== BLOCK.AIR) return false;
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
    const fluidX = Number.isFinite(state.world.cavernFallProjectionX) ? x - state.world.cavernFallProjectionX : x;
    const fluidZ = Number.isFinite(state.world.cavernFallProjectionZ) ? z - state.world.cavernFallProjectionZ : z;
    if (Game.fluids3d && Game.fluids3d.activateFluidAround3D) Game.fluids3d.activateFluidAround3D(state, fluidX, groundY - 1, fluidZ);
    if (Game.fluids3d && Game.fluids3d.stepImmediateFluid3D) Game.fluids3d.stepImmediateFluid3D(state);
    return true;
  }

  function bearInfoForBiome(biome) {
    if (biome === 'snow_plains' || biome === 'spruce_forest') return { variant: 'snow', sleeping: true };
    if (biome === 'forest' || biome === 'mountain_forest') return { variant: 'brown', sleeping: false };
    return null;
  }

  function canPlaceBearDen(state, x, groundY, z, options = {}) {
    const world = state.world;
    const projectedX = Number.isFinite(world.cavernFallProjectionX);
    const projectedZ = Number.isFinite(world.cavernFallProjectionZ);
    const sourceW = projectedX ? Game.constants3d.WORLD_W : world.w;
    const sourceD = projectedZ ? Game.constants3d.WORLD_D : world.d;
    if (x < 4 || x >= sourceW - 4 || z < 4 || z >= sourceD - 4) return false;
    if (groundY < 3 || groundY + 4 >= world.h) return false;
    if (!options.allowNearSpawn && !farFromSpawn({ w: sourceW, d: sourceD }, x, z, 24)) return false;
    if (!options.loose) {
      const localCenterX = projectedX ? x - world.cavernFallProjectionX : x;
      const localCenterZ = projectedZ ? z - world.cavernFallProjectionZ : z;
      const centerOnSlice = localCenterX >= 0 && localCenterX < world.w && localCenterZ >= 0 && localCenterZ < world.d;
      const sourceWorld = { w: sourceW, h: world.h, d: sourceD };
      const ground = centerOnSlice ? getBlock3D(state, x, groundY, z) : terrainBlockAt(worldSeed(state), x, groundY, z, sourceWorld);
      if (ground !== BLOCK.DIRT && ground !== BLOCK.STONE && ground !== BLOCK.RED_EARTH && ground !== BLOCK.SNOW) return false;
      for (let dz = -1; dz <= 1; dz += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          const gx = x + dx;
          const gz = z + dz;
          const localX = projectedX ? gx - world.cavernFallProjectionX : gx;
          const localZ = projectedZ ? gz - world.cavernFallProjectionZ : gz;
          const insideSlice = localX >= 0 && localX < world.w && localZ >= 0 && localZ < world.d;
          const base = insideSlice
            ? getBlock3D(state, gx, groundY, gz)
            : terrainBlockAt(worldSeed(state), gx, groundY, gz, sourceWorld);
          if (base !== BLOCK.DIRT && base !== BLOCK.STONE && base !== BLOCK.RED_EARTH && base !== BLOCK.SNOW) return false;
          for (let y = groundY + 1; y <= groundY + 4; y += 1) {
            const id = insideSlice
              ? getBlock3D(state, gx, y, gz)
              : terrainBlockAt(worldSeed(state), gx, y, gz, sourceWorld);
            if (id !== BLOCK.AIR && id !== BLOCK.LEAF && id !== BLOCK.SPRUCE_LEAF && id !== BLOCK.SNOW && id !== BLOCK.DRY_BUSH) return false;
          }
        }
      }
    }
    return true;
  }

  function placeBearDen(state, x, groundY, z, biome, options = {}) {
    if (!canPlaceBearDen(state, x, groundY, z, options)) return null;
    const snowy = biome === 'snow_plains' || biome === 'spruce_forest';
    const wall = snowy ? BLOCK.SNOW : (biome === 'mountain_forest' ? BLOCK.STONE : BLOCK.DIRT);
    const floorY = Math.max(1, groundY - 2);
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        const px = x + dx;
        const pz = z + dz;
        setBlock3D(state, px, floorY, pz, snowy ? BLOCK.SNOW : BLOCK.DIRT);
        for (let y = floorY + 1; y <= floorY + 4; y += 1) setBlock3D(state, px, y, pz, BLOCK.AIR);
      }
    }
    for (let dx = -2; dx <= 2; dx += 1) {
      setBlock3D(state, x + dx, floorY + 1, z - 2, wall);
      setBlock3D(state, x + dx, floorY + 2, z - 2, wall);
      setBlock3D(state, x + dx, floorY + 3, z - 2, wall);
      setBlock3D(state, x + dx, floorY + 1, z + 2, wall);
      setBlock3D(state, x + dx, floorY + 2, z + 2, wall);
      setBlock3D(state, x + dx, floorY + 3, z + 2, wall);
    }
    for (let dz = -2; dz <= 2; dz += 1) {
      setBlock3D(state, x - 3, floorY + 1, z + dz, wall);
      setBlock3D(state, x - 3, floorY + 2, z + dz, wall);
      setBlock3D(state, x - 3, floorY + 3, z + dz, wall);
    }
    for (let dx = -3; dx <= 2; dx += 1) {
      for (let dz = -2; dz <= 2; dz += 1) {
        if (Math.abs(dz) === 2 || dx === -3 || dx <= 0) setBlock3D(state, x + dx, floorY + 4, z + dz, wall);
      }
    }
    for (let dx = -1; dx <= 3; dx += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        setBlock3D(state, x + dx, groundY, z + dz, BLOCK.AIR);
        if (groundY + 1 < state.world.h) setBlock3D(state, x + dx, groundY + 1, z + dz, BLOCK.AIR);
      }
    }
    for (let dx = 1; dx <= 3; dx += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        if (groundY + 2 < state.world.h) setBlock3D(state, x + dx, groundY + 2, z + dz, BLOCK.AIR);
        if (groundY + 3 < state.world.h) setBlock3D(state, x + dx, groundY + 3, z + dz, BLOCK.AIR);
      }
    }
    const localX = Number.isFinite(state.world.cavernFallProjectionX) ? 0 : x;
    const localZ = Number.isFinite(state.world.cavernFallProjectionZ) ? 0 : z;
    registerBearDen(state, localX, floorY + 1, localZ, biome);
    return { x: localX, y: floorY + 1, z: localZ, yaw: 0 };
  }

  function registerBearDen(state, x, y, z, biome) {
    if (!state || !state.world) return;
    const key = `${x},${y},${z}`;
    if (!Array.isArray(state.world.bearDens)) state.world.bearDens = [];
    if (state.world.bearDens.some((den) => den && den.key === key)) return;
    state.world.bearDens.push({ key, x, y, z, biome: biome || 'forest' });
  }

  function getBearDens3D(state) {
    return state && state.world && Array.isArray(state.world.bearDens) ? state.world.bearDens : [];
  }

  function createBearDenAt3D(state, centerX, centerZ, options = {}) {
    if (!state || !state.world) return null;
    const seed = worldSeed(state);
    for (let radius = 0; radius <= 8; radius += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
          const x = centerX + dx;
          const z = centerZ + dz;
          if (x < 4 || x >= state.world.w - 4 || z < 4 || z >= state.world.d - 4) continue;
          const biome = biomeAt(seed, x, z);
          if (biome === 'lake' || biome === 'beach' || biome === 'geysers' || biome === 'volcanic') continue;
          for (let y = state.world.h - 2; y >= 1; y -= 1) {
            if (getBlock3D(state, x, y, z) === BLOCK.AIR) continue;
            const den = placeBearDen(state, x, y, z, biome, {
              allowNearSpawn: options.allowNearSpawn !== false,
              loose: !!options.loose,
            });
            if (den) return den;
            break;
          }
        }
      }
    }
    return null;
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
    if (type === 'fox' && ground !== BLOCK.DIRT && ground !== BLOCK.SNOW) return false;
    if (type === 'polar_bear' && ground !== BLOCK.SNOW && ground !== BLOCK.DIRT) return false;
    if (type === 'bear' && ground !== BLOCK.SNOW && ground !== BLOCK.DIRT && ground !== BLOCK.STONE && ground !== BLOCK.RED_EARTH) return false;
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
    if (biome === 'cliffs') return { type: 'goat', chance: 0.07, cellSize: 22 };
    if (biome === 'mountain_forest') return { type: 'goat', chance: 0.08, cellSize: 20 };
    if (biome === 'spruce_forest') return { type: 'fox', chance: 0.075, cellSize: 20 };
    if (biome === 'lake') return { type: 'fish', chance: 0.2, cellSize: 16 };
    return null;
  }

  function bearDecorationForBiome(biome) {
    const bear = bearInfoForBiome(biome);
    if (!bear) return null;
    const chance = biome === 'mountain_forest' ? 0.09 : (biome === 'forest' ? 0.035 : 0.045);
    return { type: 'bear', chance, cellSize: 28, bear };
  }

  function mobForPosition(seed, x, z) {
    const biome = biomeAt(seed, x, z);
    if (biome === 'geysers' || biome === 'volcanic') return null;
    const forest = baseBiomeInfluence(seed, x, z, 'forest');
    const plains = baseBiomeInfluence(seed, x, z, 'plains');
    const desert = baseBiomeInfluence(seed, x, z, 'desert');
    const roll = noise2(seed + 2311, Math.floor(x / 16), Math.floor(z / 16));
    if (biome === 'plains' && forest > 0.18 && roll < forest * 0.4) return { type: 'boar', chance: 0.05, cellSize: 20 };
    if (biome === 'forest' && plains > 0.18 && roll < plains * 0.45) return { type: 'sheep', chance: 0.075, cellSize: 18 };
    if (biome === 'beach' && desert > 0.22 && roll < desert * 0.32) return { type: 'snake', chance: 0.05, cellSize: 20 };
    if (biome === 'desert' && plains + forest > 0.22 && roll < (plains + forest) * 0.18) return { type: 'sheep', chance: 0.045, cellSize: 18 };
    if (biome === 'mountain_forest' && roll < 0.45) return { type: 'boar', chance: 0.075, cellSize: 20 };
    return mobForBiome(biome);
  }

  function bearDecorationForPosition(seed, x, z) {
    const biome = biomeAt(seed, x, z);
    if (biome === 'geysers' || biome === 'volcanic') return null;
    return bearDecorationForBiome(biome);
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
    const villages = getVillages3D(state);

    const cellSize = 16;
    const minCellX = Math.floor(bounds.minX / cellSize);
    const maxCellX = Math.floor((bounds.maxX - 1) / cellSize);
    const minCellZ = Math.floor(bounds.minZ / cellSize);
    const maxCellZ = Math.floor((bounds.maxZ - 1) / cellSize);

    for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ += 1) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
        const sampleX = cellX * cellSize + Math.floor(cellSize * 0.5);
        const sampleZ = cellZ * cellSize + Math.floor(cellSize * 0.5);
        if (findVillageForCellInList(villages, sampleX, sampleZ)) continue;
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

  function generateBearDecorationsForColumn(state, seed, cx, cz, bounds) {
    if (!state.entities) state.entities = {};
    if (!Array.isArray(state.entities.sheep)) state.entities.sheep = [];
    const cellSize = 28;
    const axis = currentDimension(state) === 'overworld' && state.worldMeta && state.worldMeta.easterEgg === 'cavern_fall'
      ? state.worldMeta.cavernFallAxis
      : '';
    const centerX = Math.floor(Game.constants3d.WORLD_W / 2);
    const centerZ = Math.floor(Game.constants3d.WORLD_D / 2);
    const minCellX = Math.floor((axis === 'x' ? centerX - 3 : bounds.minX) / cellSize);
    const maxCellX = Math.floor(((axis === 'x' ? centerX + 3 : bounds.maxX - 1)) / cellSize);
    const minCellZ = Math.floor((axis === 'z' ? centerZ - 3 : bounds.minZ) / cellSize);
    const maxCellZ = Math.floor(((axis === 'z' ? centerZ + 3 : bounds.maxZ - 1)) / cellSize);
    for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ += 1) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
        const sampleX = cellX * cellSize + Math.floor(cellSize * 0.5);
        const sampleZ = cellZ * cellSize + Math.floor(cellSize * 0.5);
        const info = bearDecorationForPosition(seed, sampleX, sampleZ);
        if (!info) continue;
        if (noise2(seed + 3401, cellX, cellZ) > info.chance) continue;
        const x = cellX * cellSize + Math.floor(5 + noise2(seed + 3403, cellX, cellZ) * (cellSize - 10));
        const z = cellZ * cellSize + Math.floor(5 + noise2(seed + 3405, cellX, cellZ) * (cellSize - 10));
        const intersects = axis === 'x'
          ? Math.abs(x - centerX) <= 3 && z + 3 >= bounds.minZ && z - 3 < bounds.maxZ
          : (axis === 'z'
            ? Math.abs(z - centerZ) <= 3 && x + 3 >= bounds.minX && x - 3 < bounds.maxX
            : x >= bounds.minX && x < bounds.maxX && z >= bounds.minZ && z < bounds.maxZ);
        if (!intersects) continue;
        const biome = biomeAt(seed, x, z);
        const bear = bearInfoForBiome(biome);
        if (!bear) continue;
        const id = `bear-den-${cellX}-${cellZ}`;
        if (hasMob(state, id)) continue;
        let groundY = axis ? terrainHeight(seed, x, z) : 0;
        if (!axis) {
          for (let y = state.world.h - 2; y >= 1; y -= 1) {
            if (getBlock3D(state, x, y, z) !== BLOCK.AIR) {
              groundY = y;
              break;
            }
          }
        }
        if (axis === 'x') state.world.cavernFallProjectionX = centerX;
        if (axis === 'z') state.world.cavernFallProjectionZ = centerZ;
        let den = null;
        try {
          den = placeBearDen(state, x, groundY, z, biome);
        } finally {
          delete state.world.cavernFallProjectionX;
          delete state.world.cavernFallProjectionZ;
        }
        if (!den || !Game.entities3d || !Game.entities3d.spawnMob3D) continue;
        Game.entities3d.spawnMob3D(state, 'bear', den.x, den.y, den.z, id, {
          variant: bear.variant,
          sleeping: bear.sleeping,
          denTask: bear.sleeping ? '' : 'leave_den',
          denTarget: {
            x: state.world.w === 1 ? 0.5 : den.x + 2,
            y: den.y + 2,
            z: state.world.d === 1 ? 0.5 : den.z,
          },
          yaw: den.yaw,
        });
      }
    }
  }

  function treeChanceAt(seed, x, z, biome) {
    if (biome === 'lake' || biome === 'beach' || biome === 'desert' || biome === 'mountains' || biome === 'geysers' || biome === 'cliffs' || biome === 'volcanic') return 0;
    if (biome === 'mountain_forest') return 0.42;
    if (biome === 'spruce_forest') return 0.032;
    if (biome === 'snow_plains') return 0.018;
    const forest = baseBiomeInfluence(seed, x, z, 'forest', 22);
    const desert = baseBiomeInfluence(seed, x, z, 'desert', 20);
    if (desert > 0.18) return 0;
    return 0.003 + forest * 0.082;
  }

  function treeCandidateCellSize(biome) {
    if (biome === 'mountain_forest') return 2;
    if (biome === 'spruce_forest') return 5;
    if (biome === 'snow_plains') return 8;
    return 5;
  }

  function shouldTryTreeAt(seed, x, z, biome, chance) {
    if (chance <= 0) return false;
    const cellSize = treeCandidateCellSize(biome);
    const cellX = Math.floor(x / cellSize);
    const cellZ = Math.floor(z / cellSize);
    const targetX = cellX * cellSize + Math.floor(noise2(seed + 315, cellX, cellZ) * cellSize);
    const targetZ = cellZ * cellSize + Math.floor(noise2(seed + 317, cellX, cellZ) * cellSize);
    if (x !== targetX || z !== targetZ) return false;
    const probability = Math.min(0.96, chance * cellSize * cellSize);
    return noise2(seed + 303, x, z) <= probability;
  }

  function desertDecorationStrength(seed, x, z, biome) {
    if (biome === 'lake' || biome === 'beach' || biome === 'mountains' || biome === 'geysers' || biome === 'cliffs' || biome === 'volcanic' || biome === 'mountain_forest' || biome === 'snow_plains' || biome === 'spruce_forest') return 0;
    if (biome === 'desert') return Math.max(0.55, baseBiomeInfluence(seed, x, z, 'desert'));
    return Math.max(0, baseBiomeInfluence(seed, x, z, 'desert') - 0.16);
  }

  function flushSuppressedDirtyChunks(state) {
    const world = state && state.world;
    if (!world || !world.dirtyChunks || !world.suppressedDirtyChunks) return;
    for (const key of world.suppressedDirtyChunks) world.dirtyChunks.add(key);
    world.suppressedDirtyChunks.clear();
  }

  function decorateColumn3D(state, seed, cx, cz) {
    const world = state.world;
    const counts = chunkCounts(world);
    const cavernAxis = currentDimension(state) === 'overworld' && state.worldMeta && state.worldMeta.easterEgg === 'cavern_fall'
      ? state.worldMeta.cavernFallAxis
      : '';
    if (!world.decoratedColumns) world.decoratedColumns = new Set();
    const key = columnKey(cx, cz);
    if (world.decoratedColumns.has(key)) return false;

    const bounds = {
      minX: cx * CHUNK_SIZE,
      minZ: cz * CHUNK_SIZE,
      maxX: Math.min(world.w, (cx + 1) * CHUNK_SIZE),
      maxZ: Math.min(world.d, (cz + 1) * CHUNK_SIZE),
    };
    const villages = VILLAGE_BLOCK_GENERATION_ENABLED ? getVillages3D(state) : [];
    const treasuries = getTreasuries3D(state);
    const centerX = Math.floor(Game.constants3d.WORLD_W / 2);
    const centerZ = Math.floor(Game.constants3d.WORLD_D / 2);
    const hasVillageInColumn = VILLAGE_BLOCK_GENERATION_ENABLED && villages.some((village) => {
      if (cavernAxis === 'x') {
        return Math.abs(village.x - centerX) <= village.radius
          && village.z + village.radius >= bounds.minZ
          && village.z - village.radius < bounds.maxZ;
      }
      if (cavernAxis === 'z') {
        return Math.abs(village.z - centerZ) <= village.radius
          && village.x + village.radius >= bounds.minX
          && village.x - village.radius < bounds.maxX;
      }
      return village.x + village.radius >= bounds.minX
        && village.x - village.radius < bounds.maxX
        && village.z + village.radius >= bounds.minZ
        && village.z - village.radius < bounds.maxZ;
    });
    const treasuriesInColumn = treasuries.filter((treasury) => treasuryIntersectsBounds(treasury, bounds));
    const hasTreasuryInColumn = treasuriesInColumn.length > 0;
    if (hasVillageInColumn) {
      if (!isDecorationReady(world, cx, cz, counts)) return false;
    } else if (hasTreasuryInColumn) {
      if (!treasuriesInColumn.every((treasury) => isTreasuryDecorationReady(world, treasury, cx, cz, counts))) return false;
    } else if (!isSurfaceDecorationReady(state, seed, cx, cz, counts)) {
      return false;
    }

    world.suppressChunkModification = (world.suppressChunkModification || 0) + 1;
    if (hasVillageInColumn || hasTreasuryInColumn) world.suppressChunkDirty = (world.suppressChunkDirty || 0) + 1;
    if (hasVillageInColumn || hasTreasuryInColumn) {
      if (!world.suppressedDirtyChunks) world.suppressedDirtyChunks = new Set();
      else world.suppressedDirtyChunks.clear();
    }
    try {
      generateBlasterMinerHousesForColumn(state, bounds);
      generateTreeHousesForColumn(state, bounds);
      if (hasTreasuryInColumn) decorateTreasuriesForColumn(state, treasuriesInColumn, bounds);
      const startX = cavernAxis === 'x' ? bounds.minX : Math.max(4, bounds.minX);
      const endX = cavernAxis === 'x' ? bounds.maxX : Math.min(world.w - 4, bounds.maxX);
      const startZ = cavernAxis === 'z' ? bounds.minZ : Math.max(4, bounds.minZ);
      const endZ = cavernAxis === 'z' ? bounds.maxZ : Math.min(world.d - 4, bounds.maxZ);
      for (let x = startX; x < endX; x += 1) {
        for (let z = startZ; z < endZ; z += 1) {
          const source = Game.easterEggs3d
            ? Game.easterEggs3d.getCavernFallSourceCell(state.worldMeta, x, z, currentDimension(state))
            : { x, z };
          const village = VILLAGE_BLOCK_GENERATION_ENABLED ? findVillageForCellInList(villages, source.x, source.z) : null;
          if (village) {
            if (cavernAxis === 'x') world.cavernFallProjectionX = centerX;
            if (cavernAxis === 'z') world.cavernFallProjectionZ = centerZ;
            try {
              decorateVillageCellAt(state, seed, source.x, source.z, village);
            } finally {
              delete world.cavernFallProjectionX;
              delete world.cavernFallProjectionZ;
            }
            continue;
          }
          const offsets = cavernAxis ? [-2, -1, 0, 1, 2] : [0];
          for (const offset of offsets) {
            const candidate = {
              x: source.x + (cavernAxis === 'x' ? offset : 0),
              z: source.z + (cavernAxis === 'z' ? offset : 0),
            };
            const candidateBiome = biomeAt(seed, candidate.x, candidate.z);
            const treeChance = treeChanceAt(seed, candidate.x, candidate.z, candidateBiome);
            const tryTree = shouldTryTreeAt(seed, candidate.x, candidate.z, candidateBiome, treeChance);
            const desertDecor = desertDecorationStrength(seed, candidate.x, candidate.z, candidateBiome);
            const centralCandidate = offset === 0;
            const tryCactus = centralCandidate && desertDecor > 0 && noise2(seed + 305, candidate.x, candidate.z) <= 0.0014 * desertDecor;
            const tryDryBush = centralCandidate && desertDecor > 0 && !tryCactus && noise2(seed + 306, candidate.x, candidate.z) <= 0.013 * desertDecor;
            const tryAlgae = centralCandidate && candidateBiome === 'lake' && noise2(seed + 307, candidate.x, candidate.z) <= 0.008;
            const tryGeyser = Math.abs(offset) <= 1 && (
              (candidateBiome === 'geysers' && noise2(seed + 309, candidate.x, candidate.z) <= 0.012)
              || (candidateBiome === 'volcanic' && noise2(seed + 310, candidate.x, candidate.z) <= 0.045)
              || (candidateBiome === 'mountains' && noise2(seed + 308, candidate.x, candidate.z) <= 0.0018)
            );
            if (!tryTree && !tryCactus && !tryDryBush && !tryAlgae && !tryGeyser) continue;

            let groundY = cavernAxis ? terrainHeight(seed, candidate.x, candidate.z) : 0;
            if (!cavernAxis) {
              for (let y = world.h - 2; y >= 1; y -= 1) {
                if (getBlock3D(state, x, y, z) !== BLOCK.AIR) {
                  groundY = y;
                  break;
                }
              }
            }
            if (cavernAxis === 'x') world.cavernFallProjectionX = centerX;
            if (cavernAxis === 'z') world.cavernFallProjectionZ = centerZ;
            try {
              if (tryTree) {
                if (candidateBiome === 'spruce_forest' || candidateBiome === 'snow_plains') {
                  placeSpruceTree(state, seed, candidate.x, groundY, candidate.z);
                } else if (candidateBiome === 'mountain_forest') {
                  placeTree(state, seed, candidate.x, groundY, candidate.z, { groundBlocks: [BLOCK.STONE, BLOCK.RED_EARTH, BLOCK.DIRT, BLOCK.SNOW] });
                } else {
                  placeTree(state, seed, candidate.x, groundY, candidate.z);
                }
              } else if (tryCactus) placeCactus(state, seed, candidate.x, groundY, candidate.z);
              else if (tryDryBush) placeDryBush(state, candidate.x, groundY, candidate.z);
              else if (tryAlgae) placeAlgae(state, seed, candidate.x, groundY, candidate.z);
              else if (tryGeyser) placeGeyser(state, candidate.x, groundY, candidate.z);
            } finally {
              delete world.cavernFallProjectionX;
              delete world.cavernFallProjectionZ;
            }
          }
        }
      }
      generateBearDecorationsForColumn(state, seed, cx, cz, bounds);
    } finally {
      world.suppressChunkModification -= 1;
      if (hasVillageInColumn || hasTreasuryInColumn) world.suppressChunkDirty -= 1;
    }

    generateMobsForColumn(state, seed, cx, cz, bounds);
    world.decoratedColumns.add(key);
    if (hasVillageInColumn || hasTreasuryInColumn) flushSuppressedDirtyChunks(state);
    return true;
  }

  function decorationBudgetForFrame(state) {
    const base = Math.max(1, Math.floor(CHUNK_DECORATE_BUDGET || 1));
    const maxBudget = Math.max(base, Math.floor(CHUNK_DECORATE_MAX_BUDGET || base));
    const fps = state && state.ui ? state.ui.fps : 0;
    const dirtyCount = state && state.world && state.world.dirtyChunks ? state.world.dirtyChunks.size : 0;
    if (!Number.isFinite(fps) || fps <= 0) return base;
    if (fps >= 75 && dirtyCount < 96) return maxBudget;
    if (fps >= 60 && dirtyCount < 64) return Math.min(maxBudget, base + 2);
    if (fps >= 50) return Math.min(maxBudget, base + 1);
    return base;
  }

  function decorateReadyColumnsAround(state, seed, pcx, pcz, radius, budget = CHUNK_DECORATE_BUDGET) {
    const counts = chunkCounts(state.world);
    const world = state.world;
    let decorated = 0;
    const startedAt = performance.now();
    const normalBudget = Math.max(1, CHUNK_DECORATE_TIME_BUDGET_MS || 3);
    const timeBudget = Game.performance3d ? Game.performance3d.getMobileWorkBudget3D(state, normalBudget) : normalBudget;
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
      if (decorated > 0 && performance.now() - startedAt >= timeBudget) break;
      const key = columnKey(item.cx, item.cz);
      const failures = world.decorationFailedColumns && world.decorationFailedColumns.get(key);
      if (failures && failures >= DECORATION_COLUMN_MAX_FAILURES) continue;
      try {
        if (decorateColumn3D(state, seed, item.cx, item.cz)) {
          if (world.decorationFailedColumns) world.decorationFailedColumns.delete(key);
          decorated += 1;
        }
      } catch (error) {
        const nextFailures = (failures || 0) + 1;
        if (!world.decorationFailedColumns) world.decorationFailedColumns = new Map();
        world.decorationFailedColumns.set(key, nextFailures);
        world.lastGenerationError = {
          type: 'decorate',
          column: key,
          failures: nextFailures,
          message: error && error.message ? error.message : String(error),
        };
        console.error('[CubicDepths] decorate column failed', { cx: item.cx, cz: item.cz, failures: nextFailures }, error);
      }
    }
    state.world.lastDecoratedColumns = decorated;
    return decorated;
  }

  function isColumnProtectedFromUnload(state, cx, cz, counts) {
    if (isPendingTeleportColumn(state, cx, cz)) return true;
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

  function ensureChunksAroundPlayer3D(state, radius = null) {
    if (!state || !state.world || !state.player) return 0;
    const effectiveRadius = Number.isFinite(radius) ? radius : (state.worldMeta && state.worldMeta.superOptimization
      ? Game.constants3d.CHUNK_OPTIMIZATION_PRELOAD_RADIUS : getChunkRenderDistanceValue(state.worldMeta));
    const manualDistance = isManualChunkRenderDistance(state.worldMeta);
    const seed = worldSeed(state);
    const pcx = Math.floor(state.player.x / CHUNK_SIZE);
    const pcz = Math.floor(state.player.z / CHUNK_SIZE);
    const perf = state.perf || (state.perf = {});
    let generated = 0;
    let t0 = performance.now();
    activeState = state;
    initChunkWorker(state);
    const currentLoading = ensureChunkLoading(state);
    if (currentLoading.syncJob && !isOptimizationChunkNeeded(state, currentLoading.syncJob.cx, currentLoading.syncJob.cz)) {
      currentLoading.syncJob = null;
    }
    queueChunksAroundPlayer3D(state, effectiveRadius);
    perf.queueMs = performance.now() - t0;
    t0 = performance.now();
    generated += processTerrainQueue3D(state, seed);
    perf.terrainMs = performance.now() - t0;
    t0 = performance.now();
    if (currentDimension(state) !== 'underground') generated += decorateReadyColumnsAround(state, seed, pcx, pcz, effectiveRadius, decorationBudgetForFrame(state));
    if (currentDimension(state) !== 'underground') generated += ensureBlasterMinerHousesAroundPlayer3D(state);
    if (currentDimension(state) !== 'underground') generated += ensureTreasuriesAroundPlayer3D(state);
    if (currentDimension(state) !== 'underground') generated += ensureTreeHousesAroundPlayer3D(state);
    perf.decorateMs = performance.now() - t0;
    t0 = performance.now();
    unloadDistantChunks3D(state, manualDistance || (state.worldMeta && state.worldMeta.superOptimization) ? effectiveRadius + 1 : CHUNK_UNLOAD_DISTANCE);
    perf.unloadMs = performance.now() - t0;
    const loading = state.world.chunkLoading;
    perf.terrainQueue = loading ? loading.queue.length : 0;
    perf.terrainPending = loading ? loading.pendingIds.size + loading.loadingSaved.size + (loading.syncJob ? 1 : 0) : 0;
    perf.worker = chunkWorkers.length > 0 ? `x${chunkWorkers.length}` : 'off';
    perf.syncProgress = state.world.lastSyncChunkProgress || 0;
    perf.dirtyChunks = state.world.dirtyChunks ? state.world.dirtyChunks.size : 0;
    perf.generationError = state.world.lastGenerationError || null;
    perf.renderDistanceChunks = effectiveRadius;
    perf.renderDistanceMode = manualDistance ? 'manual' : 'auto';
    return generated;
  }

  function chunksAroundPointReady3D(state, centerX, centerY, centerZ, radius = 1) {
    const world = state && state.world;
    if (!world) return false;
    const counts = chunkCounts(world);
    const pcx = Math.max(0, Math.min(counts.x - 1, Math.floor(centerX / CHUNK_SIZE)));
    const pcy = Math.max(0, Math.min(counts.y - 1, Math.floor(centerY / CHUNK_SIZE)));
    const pcz = Math.max(0, Math.min(counts.z - 1, Math.floor(centerZ / CHUNK_SIZE)));
    const effectiveRadius = Math.max(0, Math.floor(radius));
    for (let cz = Math.max(0, pcz - effectiveRadius); cz < Math.min(counts.z, pcz + effectiveRadius + 1); cz += 1) {
      for (let cx = Math.max(0, pcx - effectiveRadius); cx < Math.min(counts.x, pcx + effectiveRadius + 1); cx += 1) {
        const dx = cx - pcx;
        const dz = cz - pcz;
        if (dx * dx + dz * dz > effectiveRadius * effectiveRadius) continue;
        for (let cy = Math.max(0, pcy - 1); cy <= Math.min(counts.y - 1, pcy + 1); cy += 1) {
          if (!hasTerrainChunk(state, cx, cy, cz)) return false;
        }
      }
    }
    return true;
  }

  function ensureChunksAroundPoint3D(state, centerX, centerY, centerZ, radius = 1) {
    if (!state || !state.world) return 0;
    const effectiveRadius = Math.max(0, Math.floor(Number.isFinite(radius) ? radius : 1));
    const seed = worldSeed(state);
    const counts = chunkCounts(state.world);
    const pcx = Math.max(0, Math.min(counts.x - 1, Math.floor(centerX / CHUNK_SIZE)));
    const pcz = Math.max(0, Math.min(counts.z - 1, Math.floor(centerZ / CHUNK_SIZE)));
    let generated = 0;
    activeState = state;
    initChunkWorker(state);
    queueChunksAroundPoint3D(state, centerX, centerY, centerZ, effectiveRadius, { queueKeyPrefix: 'teleport', pruneQueue: false });
    generated += processTerrainQueue3D(state, seed);
    if (currentDimension(state) !== 'underground') generated += decorateReadyColumnsAround(state, seed, pcx, pcz, effectiveRadius, 1);
    return generated;
  }

  function generateWorld3D(state) {
    const seed = worldSeed(state);
    const world = state.world;
    const savedChunks = new Set(world.savedChunks || []);
    const savedPlayer = state.worldMeta && state.worldMeta.player ? state.worldMeta.player : null;
    const hasSavedPlayer = !!(savedPlayer && Number.isFinite(savedPlayer.x) && Number.isFinite(savedPlayer.y) && Number.isFinite(savedPlayer.z));
    activeState = state;
    world.dimension = currentDimension(state);
    world.worldMeta = state.worldMeta;
    clearWorld3D(state);
    state.world.dimension = currentDimension(state);
    state.world.worldMeta = state.worldMeta;
    state.world.savedChunks = savedChunks;
    if (!state.entities) state.entities = {};
    state.entities.sheep = [];

    if (hasSavedPlayer) {
      state.player.x = Math.max(0.5, Math.min(world.w - 0.5, savedPlayer.x));
      state.player.y = Math.max(1, Math.min(world.h + 4, savedPlayer.y));
      state.player.z = Math.max(0.5, Math.min(world.d - 0.5, savedPlayer.z));
      if (Number.isFinite(savedPlayer.yaw)) state.player.yaw = savedPlayer.yaw;
      if (Number.isFinite(savedPlayer.pitch)) state.player.pitch = savedPlayer.pitch;
      if (Number.isFinite(savedPlayer.scale)) state.player.scale = savedPlayer.scale;
      if (Number.isFinite(savedPlayer.targetScale)) state.player.targetScale = savedPlayer.targetScale;
      else if (Number.isFinite(savedPlayer.scale)) state.player.targetScale = savedPlayer.scale;
      if (Number.isFinite(savedPlayer.maxHealth)) state.player.maxHealth = Math.max(1, savedPlayer.maxHealth);
      if (Number.isFinite(savedPlayer.health)) state.player.health = Math.max(1, Math.min(state.player.maxHealth || 100, savedPlayer.health));
    } else {
      const spawn = findWorldSpawn3D(state, seed);
      state.player.x = spawn.x + 0.5;
      state.player.y = getSurfaceSpawnY3D(state, spawn.x, spawn.z);
      state.player.z = spawn.z + 0.5;
    }

    generateChunksAroundPlayerSync3D(state, seed, CHUNK_START_SYNC_RADIUS);

    if (!hasSavedPlayer) {
      placeSpawnTent3D(state, Math.floor(state.player.x), Math.floor(state.player.z));
    }
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.vz = 0;
    ensureChunksAroundPlayer3D(state, getChunkRenderDistanceValue(state.worldMeta));
    state.world.dirtyAll = false;
  }

  Game.generation3d = {
    generateWorld3D,
    generateChunk3D,
    ensureChunksAroundPlayer3D,
    ensureChunksAroundPoint3D,
    chunksAroundPointReady3D,
    unloadDistantChunks3D,
    saveAllModifiedChunks3D,
    saveModifiedChunks3D,
    getBiomeAt3D,
    getVolcanoAt3D,
    isVolcanoVentCell3D,
    updateVolcanoes3D,
    getActiveVolcanicEruption3D,
    getVolcanicSkyInfluence3D,
    getActiveVolcanicVents3D,
    getVolcanicCoolingWave3D,
    getWorldSpawn3D,
    seedHasDefaultSpawnBiome3D,
    getCaveEntrancesInArea3D,
    getPortalRuins3D,
    getVillages3D,
    getVillageRoadLinks3D,
    getTreasuries3D,
    ensureTreasuriesAroundPlayer3D,
    getSurfaceSpawnY3D,
    createBearDenAt3D,
    getBearDens3D,
    createBlasterMinerHouseAt3D,
    getBlasterMinerHouses3D,
    ensureBlasterMinerHousesAroundPlayer3D,
    getTreeHouses3D,
    ensureTreeHousesAroundPlayer3D,
    dimensionWorldId,
    currentStorageWorldId,
    BIOME_LABELS,
  };
})();
