(() => {
  const Game = window.CubDep;
  const { BLOCK } = Game.blocks;
  const { clearWorld3D, setBlock3D, getBlock3D, setWater3D, setLava3D } = Game.world3d;
  const { CHUNK_SIZE, CHUNK_RENDER_DISTANCE } = Game.constants3d;

  const SEA_LEVEL = 11;

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

  function chunkCounts(world) {
    return {
      x: Math.ceil(world.w / CHUNK_SIZE),
      y: Math.ceil(world.h / CHUNK_SIZE),
      z: Math.ceil(world.d / CHUNK_SIZE),
    };
  }

  function generateTerrainChunk3D(state, seed, cx, cy, cz) {
    const bounds = chunkBounds(state.world, cx, cy, cz);
    if (!bounds) return false;
    const key = chunkKey(cx, cy, cz);
    if (state.world.generatedChunks && state.world.generatedChunks.has(key)) return false;
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
    if (!state.world.generatedChunks) state.world.generatedChunks = new Set();
    state.world.generatedChunks.add(key);
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

  function generateSheep(state, seed) {
    const world = state.world;
    const sheep = [];
    const cellSize = 18;
    let id = 1;
    for (let cellZ = 0; cellZ < Math.ceil(world.d / cellSize); cellZ += 1) {
      for (let cellX = 0; cellX < Math.ceil(world.w / cellSize); cellX += 1) {
        if (noise2(seed + 2301, cellX, cellZ) > 0.08) continue;
        const x = cellX * cellSize + Math.floor(4 + noise2(seed + 2303, cellX, cellZ) * (cellSize - 8));
        const z = cellZ * cellSize + Math.floor(4 + noise2(seed + 2305, cellX, cellZ) * (cellSize - 8));
        const ground = findSheepGround(state, x, z);
        if (!ground) continue;
        sheep.push({
          id: `sheep-${id}`,
          type: 'sheep',
          x: ground.x + 0.5,
          y: ground.y + 1,
          z: ground.z + 0.5,
          yaw: noise2(seed + 2307, cellX, cellZ) * Math.PI * 2,
        });
        id += 1;
      }
    }
    if (!state.entities) state.entities = {};
    state.entities.sheep = sheep;
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

  function generateWorld3D(state) {
    const seed = worldSeed(state);
    const world = state.world;
    clearWorld3D(state);
    if (!state.entities) state.entities = {};
    state.entities.sheep = [];

    const counts = chunkCounts(world);
    for (let cy = 0; cy < counts.y; cy += 1) {
      for (let cz = 0; cz < counts.z; cz += 1) {
        for (let cx = 0; cx < counts.x; cx += 1) {
          generateTerrainChunk3D(state, seed, cx, cy, cz);
        }
      }
    }

    for (let x = 4; x < world.w - 4; x += 1) {
      for (let z = 4; z < world.d - 4; z += 1) {
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

    generateSheep(state, seed);

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
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.vz = 0;
    state.world.dirtyAll = true;
    state.world.dirtyChunks.clear();
  }

  Game.generation3d = { generateWorld3D, generateChunk3D, ensureChunksAroundPlayer3D };
})();
