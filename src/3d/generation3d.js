(() => {
  const Game = window.CubDep;
  const { BLOCK } = Game.blocks;
  const { setBlock3D, getBlock3D, setWater3D } = Game.world3d;

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

  function generateWorld3D(state) {
    const seed = hash(state.worldMeta.seed || state.worldMeta.name || Date.now());
    const world = state.world;
    const seaLevel = 11;
    const heightMap = new Int16Array(world.w * world.d);
    world.blocks.fill(BLOCK.AIR);
    if (world.waterLevel) world.waterLevel.fill(255);
    if (world.waterSources) world.waterSources.clear();
    for (let x = 0; x < world.w; x += 1) {
      for (let z = 0; z < world.d; z += 1) {
        const h = terrainHeight(seed, x, z);
        heightMap[x + world.w * z] = h;
        for (let y = 0; y <= h; y += 1) {
          let block = BLOCK.STONE;
          if (y === 0) block = BLOCK.BEDROCK;
          else if (y === h) block = h <= seaLevel + 1 ? BLOCK.SAND : BLOCK.GRASS;
          else if (y >= h - 3) block = BLOCK.DIRT;
          setBlock3D(state, x, y, z, block);
        }
      }
    }

    for (let x = 1; x < world.w - 1; x += 1) {
      for (let z = 1; z < world.d - 1; z += 1) {
        const h = heightMap[x + world.w * z];
        if (h >= seaLevel) continue;
        for (let y = h + 1; y <= seaLevel; y += 1) {
          setWater3D(state, x, y, z, 0, true);
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

  Game.generation3d = { generateWorld3D };
})();
