(() => {
  const Game = window.CubDep;
  const { BLOCK, BLOCK_COLORS } = Game.blocks;
  const { EYE_HEIGHT } = Game.constants3d;
  const { getBlock3D, getWaterLevel3D } = Game.world3d;
  const { drawUI3D } = Game.ui3d;

  let renderer = null;
  let scene = null;
  let camera = null;
  let mesh = null;
  let waterMesh = null;
  let light = null;
  let targetBox = null;
  let crackLines = null;
  let textureAtlas = null;
  let atlasMeta = null;
  let atlasEntries = null;
  let debugInfo = null;

  const faces = [
    { dir: [1, 0, 0], type: 'side', corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], shade: 0.86 },
    { dir: [-1, 0, 0], type: 'side', corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], shade: 0.72 },
    { dir: [0, 1, 0], type: 'top', corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1 },
    { dir: [0, -1, 0], type: 'bottom', corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.56 },
    { dir: [0, 0, 1], type: 'side', corners: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], shade: 0.8 },
    { dir: [0, 0, -1], type: 'side', corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], shade: 0.9 },
  ];

  const uvCorners = [[1, 0], [1, 1], [0, 1], [0, 0]];
  const crackSegments = [
    [0.50, 0.50, 0.38, 0.48],
    [0.38, 0.48, 0.28, 0.36],
    [0.50, 0.50, 0.60, 0.38],
    [0.60, 0.38, 0.73, 0.28],
    [0.50, 0.50, 0.54, 0.64],
    [0.54, 0.64, 0.48, 0.78],
    [0.38, 0.48, 0.30, 0.60],
    [0.60, 0.38, 0.69, 0.50],
    [0.54, 0.64, 0.68, 0.73],
    [0.28, 0.36, 0.18, 0.25],
    [0.73, 0.28, 0.86, 0.22],
    [0.48, 0.78, 0.43, 0.91],
    [0.30, 0.60, 0.18, 0.68],
    [0.68, 0.73, 0.81, 0.84],
  ];

  function faceShade(shade) {
    return new THREE.Color(shade, shade, shade);
  }

  function hexToRgb(hex) {
    const value = parseInt(String(hex || '#ffffff').slice(1), 16);
    return {
      r: (value >> 16) & 255,
      g: (value >> 8) & 255,
      b: value & 255,
    };
  }

  function rgbToCss(rgb) {
    return `rgb(${Math.max(0, Math.min(255, Math.round(rgb.r)))},${Math.max(0, Math.min(255, Math.round(rgb.g)))},${Math.max(0, Math.min(255, Math.round(rgb.b)))})`;
  }

  function adjustColor(rgb, amount) {
    return {
      r: rgb.r + amount,
      g: rgb.g + amount,
      b: rgb.b + amount,
    };
  }

  function mulberry32(seed) {
    let t = seed >>> 0;
    return () => {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function blockKind(id) {
    const B = BLOCK;
    if (id === B.GRASS || id === B.MOSS || id === B.MUSHROOM_SOIL || id === B.RED_EARTH || id === B.ASH) return 'soil';
    if (id === B.DIRT || id === B.PATH || id === B.SAND || id === B.SANDSTONE || id === B.SNOW || id === B.CLOUD) return 'soft';
    if (id === B.WOOD || id === B.SPRUCE_WOOD || id === B.GREAT_TREE_WOOD || id === B.SEQUOIA_WOOD || id === B.PILLAR) return 'wood';
    if (id === B.PLANK || id === B.SEQUOIA_PLANK || id === B.DOOR || id === B.CHEST || id === B.LADDER) return 'plank';
    if (id === B.LEAF || id === B.SPRUCE_LEAF || id === B.SEQUOIA_LEAF || id === B.DRY_BUSH || id === B.CACTUS) return 'leaf';
    if (id === B.WATER || id === B.STEAM_WATER) return 'water';
    if (id === B.LAVA || id === B.FIRE_PORTAL || id === B.AIR_DIMENSION_PORTAL || id === B.AIR_THIEF_PORTAL || id === B.AIR_HOME_PORTAL || id === B.ELEMENTAL_RETURN_PORTAL || id === B.END_GATE || id === B.WATER_DIMENSION_PORTAL) return 'glow';
    if (id === B.COAL_ORE || id === B.GOLD_ORE || id === B.IRON_ORE || id === B.DIAMOND_ORE || id === B.DEEP_ORE || id === B.FRIENDSHIP_ORE || id === B.STEAM_ORE || id === B.INVISIBLE_ORE) return 'ore';
    if (id === B.TORCH || id === B.GOLDEN_FLOWER || id === B.EMBER_FLOWER || id === B.EMBER_SHRUB || id === B.GLOW_ALGAE || id === B.TALL_GLOW_ALGAE || id === B.SMALL_GLOW_MUSHROOM) return 'plant';
    if (id === B.WHITE_MUSHROOM_STEM || id === B.WHITE_MUSHROOM_CAP || id === B.FLY_AGARIC_STEM || id === B.FLY_AGARIC_CAP || id === B.GLOW_MUSHROOM_STEM || id === B.GLOW_MUSHROOM_CAP || id === B.SMALL_WHITE_MUSHROOM || id === B.SMALL_FLY_AGARIC) return 'mushroom';
    if (id === B.PINK_CORAL || id === B.BLUE_CORAL || id === B.GOLD_CORAL || id === B.CORAL_STONE) return 'coral';
    if (id === B.WATER_CRYSTAL || id === B.AIR_CRYSTAL || id === B.ECHO_CORE || id === B.ROOT_CORE || id === B.FRIENDSHIP_AMULET) return 'crystal';
    if (id === B.COBWEB) return 'web';
    if (id === B.BEDROCK || id === B.STONE || id === B.BLACKSTONE || id === B.DEEPSTONE || id === B.BASALT || id === B.ROOT_STONE || id === B.ASH_STONE || id === B.FURNACE || id === B.WATER_FRAME || id === B.WATER_WELL_FRAME || id === B.MAIN_WELL_FRAME || id === B.AIR_ENTRANCE_FRAME || id === B.GOLDEN_GARDEN_SHELL || id === B.FIRE_SEAL || id === B.ROOT_PLATFORM || id === B.ECHO_SHARD_PEDESTAL || id === B.ROOT_NODE) return 'stone';
    return 'generic';
  }

  function dirtPalette(id) {
    if (id === BLOCK.RED_EARTH) return { r: 128, g: 72, b: 50 };
    if (id === BLOCK.MUSHROOM_SOIL) return { r: 93, g: 78, b: 62 };
    if (id === BLOCK.ASH) return { r: 130, g: 124, b: 118 };
    if (id === BLOCK.PATH) return { r: 136, g: 104, b: 62 };
    return { r: 126, g: 84, b: 48 };
  }

  function stonePalette(id) {
    if (id === BLOCK.BEDROCK) return { r: 44, g: 44, b: 44 };
    if (id === BLOCK.BLACKSTONE) return { r: 48, g: 48, b: 52 };
    if (id === BLOCK.DEEPSTONE) return { r: 72, g: 76, b: 82 };
    if (id === BLOCK.BASALT) return { r: 76, g: 72, b: 74 };
    if (id === BLOCK.ASH_STONE) return { r: 88, g: 84, b: 82 };
    if (id === BLOCK.ROOT_STONE) return { r: 82, g: 76, b: 68 };
    if (id === BLOCK.CORAL_STONE) return { r: 96, g: 122, b: 130 };
    return { r: 128, g: 128, b: 128 };
  }

  function drawNoise(ctx, rng, base, x, y, size, strength, count) {
    for (let i = 0; i < count; i += 1) {
      const px = x + Math.floor(rng() * size);
      const py = y + Math.floor(rng() * size);
      const s = 1 + Math.floor(rng() * 2);
      ctx.fillStyle = rgbToCss(adjustColor(base, (rng() - 0.5) * strength));
      ctx.fillRect(px, py, s, s);
    }
  }

  function fillPixelNoise(ctx, rng, base, x, y, size, strength, cell) {
    for (let yy = 0; yy < size; yy += cell) {
      for (let xx = 0; xx < size; xx += cell) {
        ctx.fillStyle = rgbToCss(adjustColor(base, (rng() - 0.5) * strength));
        ctx.fillRect(x + xx, y + yy, cell, cell);
      }
    }
  }

  function drawDirt(ctx, rng, x, y, size, base) {
    fillPixelNoise(ctx, rng, base, x, y, size, 34, 2);
    for (let i = 0; i < 28; i += 1) {
      ctx.fillStyle = rgbToCss(adjustColor(base, rng() > 0.5 ? 32 : -28));
      ctx.fillRect(x + Math.floor(rng() * size), y + Math.floor(rng() * size), 2, 2);
    }
  }

  function drawGrassTop(ctx, rng, x, y, size, variant) {
    const base = variant % 2 ? { r: 86, g: 156, b: 56 } : { r: 94, g: 168, b: 62 };
    fillPixelNoise(ctx, rng, base, x, y, size, 44, 2);
    for (let i = 0; i < 38; i += 1) {
      ctx.fillStyle = rgbToCss(adjustColor(base, rng() > 0.5 ? 36 : -32));
      ctx.fillRect(x + Math.floor(rng() * size), y + Math.floor(rng() * size), 2, 4);
    }
  }

  function drawGrassSide(ctx, rng, x, y, size, variant) {
    drawDirt(ctx, rng, x, y, size, { r: 126, g: 84, b: 48 });
    const grass = variant % 2 ? { r: 86, g: 156, b: 56 } : { r: 94, g: 168, b: 62 };
    const strip = 6 + Math.floor(rng() * 3);
    for (let xx = 0; xx < size; xx += 2) {
      const drop = Math.floor(rng() * 7);
      ctx.fillStyle = rgbToCss(adjustColor(grass, (rng() - 0.5) * 38));
      ctx.fillRect(x + xx, y, 2, strip + drop);
    }
  }

  function drawStoneBase(ctx, rng, x, y, size, base, darkCracks) {
    fillPixelNoise(ctx, rng, base, x, y, size, 38, 2);
    ctx.strokeStyle = rgbToCss(adjustColor(base, darkCracks ? -62 : -34));
    ctx.lineWidth = 1;
    for (let i = 0; i < 7; i += 1) {
      const sx = x + Math.floor(rng() * size);
      const sy = y + Math.floor(rng() * size);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.floor((rng() - 0.5) * 22), sy + Math.floor((rng() - 0.5) * 18));
      ctx.stroke();
    }
  }

  function drawOreBits(ctx, rng, x, y, size, ore) {
    for (let i = 0; i < 8; i += 1) {
      ctx.fillStyle = rgbToCss(adjustColor(ore, 18 + rng() * 60));
      const px = x + 4 + Math.floor(rng() * (size - 9));
      const py = y + 4 + Math.floor(rng() * (size - 9));
      ctx.fillRect(px, py, 2 + Math.floor(rng() * 3), 2 + Math.floor(rng() * 3));
    }
  }

  function drawWoodTile(ctx, rng, x, y, size, base, faceType) {
    if (faceType === 'top' || faceType === 'bottom') {
      fillPixelNoise(ctx, rng, base, x, y, size, 22, 2);
      ctx.strokeStyle = rgbToCss(adjustColor(base, -44));
      ctx.lineWidth = 2;
      for (let r = 5; r < size / 2; r += 5) {
        ctx.strokeRect(x + size / 2 - r, y + size / 2 - r, r * 2, r * 2);
      }
    } else {
      ctx.fillStyle = rgbToCss(base);
      ctx.fillRect(x, y, size, size);
      for (let xx = 0; xx < size; xx += 2) {
        const band = xx % 8 === 0 ? -42 : (xx % 8 === 2 ? 24 : ((xx % 4 === 0) ? -12 : 8));
        ctx.fillStyle = rgbToCss(adjustColor(base, band));
        ctx.fillRect(x + xx, y, 2, size);
      }
      for (let yy = 0; yy < size; yy += 4) {
        for (let xx = 0; xx < size; xx += 4) {
          ctx.fillStyle = rgbToCss(adjustColor(base, ((xx * 13 + yy * 7) % 5 - 2) * 7));
          ctx.fillRect(x + xx, y + yy, 4, 4);
        }
      }
      ctx.strokeStyle = rgbToCss(adjustColor(base, -58));
      ctx.lineWidth = 1;
      for (let xx = 0; xx <= size; xx += 8) {
        ctx.beginPath();
        ctx.moveTo(x + xx + 0.5, y);
        ctx.lineTo(x + xx + 0.5, y + size);
        ctx.stroke();
      }
    }
  }

  function drawPlankTile(ctx, rng, x, y, size, base) {
    fillPixelNoise(ctx, rng, base, x, y, size, 26, 2);
    ctx.strokeStyle = rgbToCss(adjustColor(base, -54));
    ctx.lineWidth = 2;
    for (let yy = y + 8; yy < y + size; yy += 8) {
      ctx.beginPath();
      ctx.moveTo(x, yy);
      ctx.lineTo(x + size, yy);
      ctx.stroke();
    }
    for (let xx = x + 10; xx < x + size; xx += 14) {
      ctx.beginPath();
      ctx.moveTo(xx, y);
      ctx.lineTo(xx, y + size);
      ctx.stroke();
    }
  }

  function drawBlockTile(ctx, id, faceType, variant, x, y, size) {
    const rng = mulberry32(id * 9973 + variant * 131 + faceType.charCodeAt(0) * 17);
    const base = hexToRgb(BLOCK_COLORS[id] || '#ffffff');
    const kind = blockKind(id);

    if (id === BLOCK.GRASS) {
      if (faceType === 'top') drawGrassTop(ctx, rng, x, y, size, variant);
      else if (faceType === 'bottom') drawDirt(ctx, rng, x, y, size, { r: 126, g: 84, b: 48 });
      else drawGrassSide(ctx, rng, x, y, size, variant);
    } else if (id === BLOCK.DIRT || id === BLOCK.PATH || id === BLOCK.MUSHROOM_SOIL || id === BLOCK.RED_EARTH || id === BLOCK.ASH) {
      drawDirt(ctx, rng, x, y, size, dirtPalette(id));
    } else if (kind === 'stone' || kind === 'ore') {
      drawStoneBase(ctx, rng, x, y, size, stonePalette(id), id === BLOCK.BEDROCK || id === BLOCK.BLACKSTONE || id === BLOCK.DEEPSTONE);
    } else if (kind === 'wood') {
      drawWoodTile(ctx, rng, x, y, size, base, faceType);
    } else if (kind === 'plank') {
      drawPlankTile(ctx, rng, x, y, size, base);
    } else {
      ctx.fillStyle = rgbToCss(base);
      ctx.fillRect(x, y, size, size);
      drawNoise(ctx, rng, base, x, y, size, 36, 120);
    }

    if (kind === 'ore') {
      const ore = id === BLOCK.COAL_ORE ? { r: 20, g: 20, b: 24 } : hexToRgb(BLOCK_COLORS[id] || '#ffffff');
      drawOreBits(ctx, rng, x, y, size, ore);
    }

    if (kind === 'leaf') {
      for (let i = 0; i < 28; i += 1) {
        ctx.fillStyle = rgbToCss(adjustColor(base, (rng() - 0.4) * 64));
        ctx.fillRect(x + Math.floor(rng() * size), y + Math.floor(rng() * size), 2 + Math.floor(rng() * 4), 2 + Math.floor(rng() * 4));
      }
    }

    if ((kind === 'soil' || kind === 'soft') && id !== BLOCK.GRASS && id !== BLOCK.DIRT && id !== BLOCK.PATH && id !== BLOCK.MUSHROOM_SOIL && id !== BLOCK.RED_EARTH && id !== BLOCK.ASH) {
      for (let i = 0; i < 24; i += 1) {
        ctx.fillStyle = rgbToCss(adjustColor(base, kind === 'soil' ? 36 : -24));
        ctx.fillRect(x + Math.floor(rng() * size), y + Math.floor(rng() * size), 1, 3 + Math.floor(rng() * 4));
      }
    }

    if (kind === 'water') {
      const waterBase = { r: 58, g: 128, b: 222 };
      ctx.fillStyle = rgbToCss(waterBase);
      ctx.fillRect(x, y, size, size);
      for (let yy = 0; yy < size; yy += 4) {
        for (let xx = 0; xx < size; xx += 4) {
          const amount = ((xx * 5 + yy * 3) % 4 - 1.5) * 7;
          ctx.fillStyle = rgbToCss(adjustColor(waterBase, amount));
          ctx.fillRect(x + xx, y + yy, 4, 4);
        }
      }
    }

    if (kind === 'glow' || kind === 'crystal') {
      const grad = ctx.createRadialGradient(x + size * 0.5, y + size * 0.45, 2, x + size * 0.5, y + size * 0.5, size * 0.72);
      grad.addColorStop(0, 'rgba(255,255,255,0.92)');
      grad.addColorStop(0.35, rgbToCss(adjustColor(base, 42)));
      grad.addColorStop(1, rgbToCss(adjustColor(base, -36)));
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, size, size);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.moveTo(x + size * 0.24, y + size * 0.78);
      ctx.lineTo(x + size * 0.52, y + size * 0.12);
      ctx.lineTo(x + size * 0.78, y + size * 0.78);
      ctx.stroke();
    }

    if (kind === 'plant' || kind === 'mushroom' || kind === 'coral') {
      ctx.strokeStyle = rgbToCss(adjustColor(base, -36));
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i += 1) {
        const px = x + 4 + rng() * (size - 8);
        ctx.beginPath();
        ctx.moveTo(px, y + size);
        ctx.quadraticCurveTo(px + (rng() - 0.5) * 14, y + size * 0.55, px + (rng() - 0.5) * 18, y + 4 + rng() * 10);
        ctx.stroke();
      }
      ctx.fillStyle = rgbToCss(adjustColor(base, 38));
      for (let i = 0; i < 10; i += 1) ctx.fillRect(x + rng() * size, y + rng() * size, 2, 2);
    }

    if (kind === 'web') {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x, y, size, size);
      ctx.strokeStyle = 'rgba(255,255,255,0.82)';
      for (let i = 0; i <= size; i += 8) {
        ctx.beginPath();
        ctx.moveTo(x + i, y);
        ctx.lineTo(x + size - i, y + size);
        ctx.moveTo(x, y + i);
        ctx.lineTo(x + size, y + size - i);
        ctx.stroke();
      }
    }

    if (kind !== 'soil' && kind !== 'soft' && kind !== 'stone' && kind !== 'ore' && kind !== 'leaf' && id !== BLOCK.GRASS && id !== BLOCK.DIRT) {
      ctx.strokeStyle = 'rgba(0,0,0,0.16)';
      ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
    }
  }

  function createTextureAtlas() {
    if (textureAtlas) return textureAtlas;
    const blockIds = Object.values(BLOCK).filter((id) => Number.isFinite(id) && id !== BLOCK.AIR);
    const tileSize = 32;
    const variants = 4;
    const faceTypes = ['top', 'side', 'bottom'];
    const totalTiles = blockIds.length * faceTypes.length * variants;
    const columns = 16;
    const rows = Math.ceil(totalTiles / columns);
    const canvas = document.createElement('canvas');
    canvas.width = columns * tileSize;
    canvas.height = rows * tileSize;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    atlasEntries = new Map();
    let tileIndex = 0;
    for (const id of blockIds) {
      for (const faceType of faceTypes) {
        for (let variant = 0; variant < variants; variant += 1) {
          const col = tileIndex % columns;
          const row = Math.floor(tileIndex / columns);
          atlasEntries.set(`${id}:${faceType}:${variant}`, { col, row });
          drawBlockTile(ctx, id, faceType, variant, col * tileSize, row * tileSize, tileSize);
          tileIndex += 1;
        }
      }
    }
    textureAtlas = new THREE.CanvasTexture(canvas);
    textureAtlas.magFilter = THREE.NearestFilter;
    textureAtlas.minFilter = THREE.NearestFilter;
    textureAtlas.wrapS = THREE.ClampToEdgeWrapping;
    textureAtlas.wrapT = THREE.ClampToEdgeWrapping;
    textureAtlas.generateMipmaps = false;
    textureAtlas.needsUpdate = true;
    atlasMeta = { tileSize, columns, rows, variants, width: canvas.width, height: canvas.height, totalTiles };
    return textureAtlas;
  }

  function hashBlockVariant(x, y, z, id, face) {
    if (id === BLOCK.GRASS && face.type === 'top') return 0;
    if (id === BLOCK.WATER || id === BLOCK.STEAM_WATER) return 0;
    if (id === BLOCK.DIRT || id === BLOCK.PATH || id === BLOCK.MUSHROOM_SOIL || id === BLOCK.RED_EARTH || id === BLOCK.ASH) return 0;
    if ((id === BLOCK.WOOD || id === BLOCK.SPRUCE_WOOD || id === BLOCK.GREAT_TREE_WOOD || id === BLOCK.SEQUOIA_WOOD) && face.type === 'side') return 0;
    let hash = Math.imul(x + 101, 374761393) ^ Math.imul(y + 59, 668265263) ^ Math.imul(z + 211, 2147483647);
    hash ^= Math.imul(id + 17, 1274126177);
    hash ^= Math.imul(face.dir[0] + 3, 1103515245) ^ Math.imul(face.dir[1] + 5, 12345) ^ Math.imul(face.dir[2] + 7, 2654435761);
    return (hash >>> 0) % atlasMeta.variants;
  }

  function pushTileUv(uvs, id, face, x, y, z) {
    const meta = atlasMeta;
    const variant = hashBlockVariant(x, y, z, id, face);
    const entry = atlasEntries.get(`${id}:${face.type}:${variant}`) || atlasEntries.get(`${id}:side:0`);
    const col = entry ? entry.col : 0;
    const row = entry ? entry.row : 0;
    const inset = 0.05;
    const u0 = (col * meta.tileSize + inset) / meta.width;
    const v0 = 1 - ((row + 1) * meta.tileSize - inset) / meta.height;
    const u1 = ((col + 1) * meta.tileSize - inset) / meta.width;
    const v1 = 1 - (row * meta.tileSize + inset) / meta.height;
    for (const corner of uvCorners) {
      uvs.push(corner[0] ? u1 : u0, corner[1] ? v1 : v0);
    }
  }

  function isNeighborOpen(state, x, y, z, mode) {
    const world = state.world;
    if (x < 0 || x >= world.w || y < 0 || y >= world.h || z < 0 || z >= world.d) return true;
    const id = getBlock3D(state, x, y, z);
    if (mode === 'water') return id !== BLOCK.WATER;
    return id === BLOCK.AIR || id === BLOCK.WATER;
  }

  function getWaterSurfaceHeight(state, x, y, z) {
    if (getBlock3D(state, x, y + 1, z) === BLOCK.WATER) return 1;
    const level = getWaterLevel3D(state, x, y, z);
    return Math.max(0.32, 0.9 - Math.min(7, level) * 0.075);
  }

  function pushBlockPosition(positions, id, state, x, y, z, corner) {
    const height = id === BLOCK.WATER && corner[1] === 1 ? getWaterSurfaceHeight(state, x, y, z) : corner[1];
    positions.push(x + corner[0], y + height, z + corner[2]);
  }

  function addFacePoint(points, target, u, v, offset) {
    const normal = target.normal || { x: 0, y: 1, z: 0 };
    const x0 = target.x;
    const y0 = target.y;
    const z0 = target.z;
    if (normal.x !== 0) points.push(x0 + (normal.x > 0 ? 1 + offset : -offset), y0 + v, z0 + u);
    else if (normal.y !== 0) points.push(x0 + u, y0 + (normal.y > 0 ? 1 + offset : -offset), z0 + v);
    else points.push(x0 + u, y0 + v, z0 + (normal.z > 0 ? 1 + offset : -offset));
  }

  function pushCrackFace(points, target, progress) {
    const stage = Math.max(1, Math.min(crackSegments.length, Math.ceil(progress * crackSegments.length)));
    const offset = 0.008;
    for (let i = 0; i < stage; i += 1) {
      const segment = crackSegments[i];
      addFacePoint(points, target, segment[0], segment[1], offset);
      addFacePoint(points, target, segment[2], segment[3], offset);
    }
  }

  function buildCrackGeometry(state) {
    const points = [];
    const damage = state.world && state.world.blockDamage;
    if (!damage) {
      const empty = new THREE.BufferGeometry();
      empty.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
      return empty;
    }
    for (const [key, progress] of Object.entries(damage)) {
      if (progress <= 0) continue;
      const parts = key.split(',').map(Number);
      if (parts.length !== 3) continue;
      const [x, y, z] = parts;
      const id = getBlock3D(state, x, y, z);
      if (id === BLOCK.AIR) continue;
      for (const face of faces) {
        const nx = x + face.dir[0];
        const ny = y + face.dir[1];
        const nz = z + face.dir[2];
        if (!isNeighborOpen(state, nx, ny, nz, 'solid')) continue;
        pushCrackFace(points, { x, y, z, normal: { x: face.dir[0], y: face.dir[1], z: face.dir[2] } }, progress);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    return geometry;
  }

  function updateCracks(state) {
    if (!crackLines) return;
    const damage = state.world && state.world.blockDamage;
    crackLines.visible = !!(damage && Object.keys(damage).length > 0);
    if (!crackLines.visible) return;
    crackLines.geometry.dispose();
    crackLines.geometry = buildCrackGeometry(state);
    crackLines.material.opacity = 0.86;
  }

  function buildWorldMesh(state, mode = 'solid') {
    const positions = [];
    const normals = [];
    const colors = [];
    const uvs = [];
    const indices = [];
    const world = state.world;
    for (let y = 0; y < world.h; y += 1) {
      for (let z = 0; z < world.d; z += 1) {
        for (let x = 0; x < world.w; x += 1) {
          const id = getBlock3D(state, x, y, z);
          if (id === BLOCK.AIR) continue;
          if (mode === 'solid' && id === BLOCK.WATER) continue;
          if (mode === 'water' && id !== BLOCK.WATER) continue;
          for (const face of faces) {
            const nx = x + face.dir[0];
            const ny = y + face.dir[1];
            const nz = z + face.dir[2];
            if (!isNeighborOpen(state, nx, ny, nz, mode)) continue;
            const base = positions.length / 3;
            const color = faceShade(face.shade);
            for (const corner of face.corners) {
              pushBlockPosition(positions, id, state, x, y, z, corner);
              normals.push(face.dir[0], face.dir[1], face.dir[2]);
              colors.push(color.r, color.g, color.b);
            }
            pushTileUv(uvs, id, face, x, y, z);
            indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
          }
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    debugInfo = {
      vertices: positions.length / 3,
      triangles: indices.length / 3,
      textureTiles: atlasMeta ? atlasMeta.totalTiles : 0,
    };
    return geometry;
  }

  function init(canvas) {
    if (!window.THREE) return false;
    if (!renderer) {
      try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
      } catch (error) {
        renderer = null;
        return false;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setClearColor(0x87bfe8, 1);
      createTextureAtlas();
      scene = new THREE.Scene();
      scene.fog = new THREE.Fog(0x87bfe8, 36, 92);
      camera = new THREE.PerspectiveCamera(72, 1, 0.05, 140);
      light = new THREE.DirectionalLight(0xffffff, 1.3);
      light.position.set(0.35, 1, 0.45);
      scene.add(light);
      scene.add(new THREE.HemisphereLight(0xbfe4ff, 0x3e3428, 1.35));
      targetBox = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 1.02, 1.02)),
        new THREE.LineBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0.85 })
      );
      targetBox.visible = false;
      scene.add(targetBox);
      crackLines = new THREE.LineSegments(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ color: 0x191512, transparent: true, opacity: 0.8, depthTest: true })
      );
      crackLines.visible = false;
      scene.add(crackLines);
    }
    return true;
  }

  function setWorld(state) {
    if (!scene || !window.THREE) return;
    if (mesh) {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
      mesh = null;
    }
    if (waterMesh) {
      scene.remove(waterMesh);
      waterMesh.geometry.dispose();
      waterMesh.material.dispose();
      waterMesh = null;
    }
    const material = new THREE.MeshBasicMaterial({ map: createTextureAtlas(), vertexColors: true, side: THREE.DoubleSide });
    mesh = new THREE.Mesh(buildWorldMesh(state, 'solid'), material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    const waterMaterial = new THREE.MeshBasicMaterial({
      map: createTextureAtlas(),
      vertexColors: true,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.68,
      depthWrite: true,
    });
    waterMesh = new THREE.Mesh(buildWorldMesh(state, 'water'), waterMaterial);
    waterMesh.frustumCulled = false;
    scene.add(waterMesh);
    state.world.dirtyAll = false;
    state.world.dirtyChunks.clear();
  }

  function resize(canvas, overlayCanvas) {
    if (!renderer || !camera) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    if (overlayCanvas) {
      overlayCanvas.width = w;
      overlayCanvas.height = h;
    }
  }

  function render(state, overlayCtx, overlayCanvas) {
    if (!renderer || !scene || !camera) return;
    if (state.world.dirtyAll || state.world.dirtyChunks.size > 0) setWorld(state);
    const player = state.player;
    camera.position.set(player.x, player.y + EYE_HEIGHT, player.z);
    const cosPitch = Math.cos(player.pitch);
    const lookX = Math.sin(player.yaw) * cosPitch;
    const lookY = Math.sin(player.pitch);
    const lookZ = Math.cos(player.yaw) * cosPitch;
    camera.lookAt(camera.position.x + lookX, camera.position.y + lookY, camera.position.z + lookZ);
    if (targetBox) {
      const target = state.ui && state.ui.targetBlock;
      targetBox.visible = !!target;
      if (target) {
        const pulse = 0.01 * Math.sin((state.ui.minePulse || 0) * 5);
        targetBox.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5);
        targetBox.scale.setScalar(1 + pulse);
      }
    }
    updateCracks(state);
    if (debugInfo) {
      debugInfo.camera = [camera.position.x, camera.position.y, camera.position.z];
      debugInfo.rotation = [camera.rotation.x, camera.rotation.y, camera.rotation.z];
    }
    renderer.render(scene, camera);
    drawUI3D(overlayCtx, overlayCanvas, state);
  }

  function setVisible(canvas, visible) {
    canvas.classList.toggle('is-hidden', !visible);
  }

  function getDebugInfo() {
    return debugInfo;
  }

  Game.renderer3d = { init, resize, setWorld, render, setVisible, getDebugInfo };
})();
