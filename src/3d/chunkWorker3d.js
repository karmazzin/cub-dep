(() => {
  const WATER_LEVEL = 14;
  const STATIC_WATER_LEVEL = 8;
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

  function caveFeatureForCell(seed, world, cellX, cellZ) {
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
    };
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

  function passageCaveBlockAt(seed, x, y, z, groundH, world, blockIds) {
    if (y <= 1 || y > groundH + 1 || !farFromSpawn(world, x, z, 28)) return null;
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
        if (entrance.hasStream && bottomBand && centerBand && info.t > 0.12 && info.t < 0.88) return blockIds.WATER;

        if (!isThrough && entrance.hasEndPool && info.t > 0.82 && y <= entrance.endY + 1 && Math.hypot(x - entrance.endX, z - entrance.endZ) <= entrance.radius * 1.8) {
          return blockIds.WATER;
        }

        return blockIds.AIR;
      }
    }
    return null;
  }

  function caveRoomBlock(seed, x, y, z, centerX, centerY, centerZ, radiusX, radiusY, radiusZ, salt, blockIds) {
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
    if (pillarRoll < 0.14 && Math.hypot(x - pillarX, z - pillarZ) <= 1.45) return blockIds.STONE;

    const spikeCellX = Math.floor(x / 7);
    const spikeCellZ = Math.floor(z / 7);
    const spikeX = spikeCellX * 7 + 3;
    const spikeZ = spikeCellZ * 7 + 3;
    const spikeDistance = Math.hypot(x - spikeX, z - spikeZ);
    if (spikeDistance <= 1.3) {
      const length = 1 + Math.floor(noise2(seed + salt + 5, spikeCellX, spikeCellZ) * 4);
      if (noise2(seed + salt + 3, spikeCellX, spikeCellZ) < 0.24 && y >= ceilingY - length + spikeDistance) return blockIds.STONE;
      if (noise2(seed + salt + 7, spikeCellX, spikeCellZ) < 0.18 && y <= floorY + length - spikeDistance) return blockIds.STONE;
    }

    const lakeRoll = noise2(seed + salt + 11, Math.floor(centerX / 16), Math.floor(centerZ / 16));
    if (lakeRoll < 0.42 && y <= floorY + 1.4 && horizontal < 0.58) {
      return lakeRoll < 0.16 ? blockIds.LAVA : blockIds.WATER;
    }
    return blockIds.AIR;
  }

  function throughCaveRoomBlockAt(seed, x, y, z, groundH, world, blockIds) {
    if (y <= 1 || y > groundH - 5 || !farFromSpawn(world, x, z, 36)) return null;
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
        const block = caveRoomBlock(seed, x, y, z, feature.endX, feature.endY, feature.endZ, radiusX, radiusY, radiusZ, 2147, blockIds);
        if (block !== null) return block;
      }
    }
    return null;
  }

  function deepCaveBlockAt(seed, x, y, z, groundH, world, blockIds) {
    if (y <= 1 || y > groundH - 5 || !farFromSpawn(world, x, z, 36)) return null;
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

        return caveRoomBlock(seed, x, y, z, centerX, centerY, centerZ, radiusX, radiusY, radiusZ, 2220, blockIds);
      }
    }
    return null;
  }

  function caveBlockAt(seed, x, y, z, groundH, world, blockIds) {
    const passage = passageCaveBlockAt(seed, x, y, z, groundH, world, blockIds);
    if (passage !== null) return passage;
    const throughRoom = throughCaveRoomBlockAt(seed, x, y, z, groundH, world, blockIds);
    if (throughRoom !== null) return throughRoom;
    return deepCaveBlockAt(seed, x, y, z, groundH, world, blockIds);
  }

  function terrainBlockAt(seed, x, y, z, world, blockIds) {
    const h = terrainHeight(seed, x, z);
    const lake = lakeInfo(seed, x, z);
    const biome = lake.inLake ? 'lake' : (lake.shore ? 'beach' : (geyserValleyInfo(seed, x, z).inValley ? 'geysers' : baseLandBiome(seed, x, z)));
    const waterLevel = lake.inLake && Number.isFinite(lake.waterLevel) ? lake.waterLevel : WATER_LEVEL;
    const groundH = lake.inLake ? waterLevel - lake.depth : h;
    if (y === 0) return blockIds.BEDROCK;
    if (y <= groundH) {
      const caveBlock = caveBlockAt(seed, x, y, z, groundH, world, blockIds);
      if (caveBlock !== null) return caveBlock;
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
    if (lake.inLake && y <= waterLevel) return blockIds.WATER;
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
          if (block === blockIds.WATER) fluidLevel[index] = STATIC_WATER_LEVEL;
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
