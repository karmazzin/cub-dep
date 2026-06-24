(() => {
  const Game = window.CubDep;
  const { BLOCK, BLOCK_COLORS } = Game.blocks;
  const { EYE_HEIGHT, CHUNK_SIZE, CHUNK_RENDER_DISTANCE, CAMERA_FAR_CHUNKS, CHUNK_MESH_REBUILD_BUDGET } = Game.constants3d;
  const { getBlock3D, getFluidLevel3D, getGrassLevel3D } = Game.world3d;
  const { drawUI3D } = Game.ui3d;

  let renderer = null;
  let scene = null;
  let camera = null;
  let chunkMeshes = new Map();
  let solidMaterial = null;
  let waterMaterial = null;
  let lavaMaterial = null;
  let waterTexture = null;
  let lavaTexture = null;
  let light = null;
  let skyGroup = null;
  let cloudMaterial = null;
  let cloudPuffGeometry = null;
  let cloudCells = [];
  let targetBox = null;
  let crackLines = null;
  let sheepMeshes = new Map();
  let sheepMaterials = null;
  let textureAtlas = null;
  let atlasMeta = null;
  let atlasEntries = null;
  let debugInfo = null;
  let steamGroup = null;
  let steamMaterial = null;
  let steamGeometry = null;
  let steamParticles = [];
  let lastSteamUpdate = 0;

  const faces = [
    { dir: [1, 0, 0], type: 'side', corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], shade: 0.86 },
    { dir: [-1, 0, 0], type: 'side', corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], shade: 0.72 },
    { dir: [0, 1, 0], type: 'top', corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1 },
    { dir: [0, -1, 0], type: 'bottom', corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.56 },
    { dir: [0, 0, 1], type: 'side', corners: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], shade: 0.8 },
    { dir: [0, 0, -1], type: 'side', corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], shade: 0.9 },
  ];

  const uvCorners = [[1, 0], [1, 1], [0, 1], [0, 0]];
  const SKY_COLOR = 0x87bfe8;
  const SKY_FOG_COLOR = 0x87bfe8;
  const CLOUD_HEIGHT = 64;
  const CLOUD_CELL_SIZE = 76;
  const CLOUD_GRID_RADIUS = 2;
  const CLOUDS_PER_CELL = 4;
  const CLOUD_PUFFS_PER_CLOUD = 9;
  const CLOUD_WEATHER_CYCLE = 120;
  const STEAM_PARTICLE_LIMIT = 90;
  const STEAM_GEYSER_SCAN_RADIUS = 24;
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
    if (id === B.DIRT || id === B.PATH || id === B.SAND || id === B.SNOW || id === B.CLOUD) return 'soft';
    if (id === B.WOOD || id === B.SPRUCE_WOOD || id === B.GREAT_TREE_WOOD || id === B.SEQUOIA_WOOD || id === B.PILLAR) return 'wood';
    if (id === B.PLANK || id === B.SEQUOIA_PLANK || id === B.DOOR || id === B.CHEST || id === B.LADDER) return 'plank';
    if (id === B.LEAF || id === B.SPRUCE_LEAF || id === B.SEQUOIA_LEAF || id === B.DRY_BUSH || id === B.CACTUS) return 'leaf';
    if (id === B.WATER || id === B.HOT_WATER || id === B.STEAM_WATER) return 'water';
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
    if (id === BLOCK.RED_EARTH) return { r: 118, g: 62, b: 42 };
    if (id === BLOCK.MUSHROOM_SOIL) return { r: 82, g: 68, b: 52 };
    if (id === BLOCK.ASH) return { r: 108, g: 102, b: 98 };
    if (id === BLOCK.PATH) return { r: 118, g: 86, b: 46 };
    return { r: 116, g: 78, b: 44 };
  }

  function stonePalette(id) {
    if (id === BLOCK.BEDROCK) return { r: 34, g: 34, b: 34 };
    if (id === BLOCK.BLACKSTONE) return { r: 38, g: 38, b: 42 };
    if (id === BLOCK.DEEPSTONE) return { r: 62, g: 66, b: 72 };
    if (id === BLOCK.BASALT) return { r: 60, g: 56, b: 60 };
    if (id === BLOCK.ASH_STONE) return { r: 72, g: 68, b: 66 };
    if (id === BLOCK.ROOT_STONE) return { r: 70, g: 62, b: 52 };
    if (id === BLOCK.CORAL_STONE) return { r: 74, g: 104, b: 112 };
    return { r: 116, g: 116, b: 116 };
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
    const base = variant % 2 ? { r: 78, g: 142, b: 38 } : { r: 92, g: 154, b: 44 };
    fillPixelNoise(ctx, rng, base, x, y, size, 54, 2);
    for (let i = 0; i < 38; i += 1) {
      ctx.fillStyle = rgbToCss(adjustColor(base, rng() > 0.5 ? 42 : -40));
      ctx.fillRect(x + Math.floor(rng() * size), y + Math.floor(rng() * size), 2, 4);
    }
  }

  function drawGrassSide(ctx, rng, x, y, size, variant) {
    drawDirt(ctx, rng, x, y, size, { r: 116, g: 78, b: 44 });
    const grass = variant % 2 ? { r: 78, g: 142, b: 38 } : { r: 92, g: 154, b: 44 };
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

  function drawTexturedFace(ctx, id, faceType, points, x, y, w, h) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
    ctx.clip();
    drawBlockTile(ctx, id, faceType, 0, x, y, w);
    if (h > w) drawBlockTile(ctx, id, faceType, 1, x, y + w, w);
    ctx.restore();
  }

  function drawBlockIcon(ctx, id, x, y, size) {
    if (!Number.isFinite(id) || id === BLOCK.AIR) return;
    const cubeX = x + size * 0.14;
    const cubeY = y + size * 0.2;
    const cubeW = size * 0.58;
    const cubeH = size * 0.48;
    const depth = size * 0.17;

    const topFace = [
      [cubeX, cubeY + depth],
      [cubeX + depth, cubeY],
      [cubeX + cubeW + depth, cubeY],
      [cubeX + cubeW, cubeY + depth],
    ];
    const leftFace = [
      [cubeX, cubeY + depth],
      [cubeX + cubeW, cubeY + depth],
      [cubeX + cubeW, cubeY + depth + cubeH],
      [cubeX, cubeY + depth + cubeH],
    ];
    const rightFace = [
      [cubeX + cubeW, cubeY + depth],
      [cubeX + cubeW + depth, cubeY],
      [cubeX + cubeW + depth, cubeY + cubeH],
      [cubeX + cubeW, cubeY + depth + cubeH],
    ];

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    drawTexturedFace(ctx, id, 'side', leftFace, cubeX, cubeY + depth, cubeW, cubeH);
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.beginPath();
    ctx.moveTo(leftFace[0][0], leftFace[0][1]);
    for (let i = 1; i < leftFace.length; i += 1) ctx.lineTo(leftFace[i][0], leftFace[i][1]);
    ctx.closePath();
    ctx.fill();
    drawTexturedFace(ctx, id, 'side', rightFace, cubeX + cubeW, cubeY, cubeW, cubeH);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.moveTo(rightFace[0][0], rightFace[0][1]);
    for (let i = 1; i < rightFace.length; i += 1) ctx.lineTo(rightFace[i][0], rightFace[i][1]);
    ctx.closePath();
    ctx.fill();
    drawTexturedFace(ctx, id, 'top', topFace, cubeX, cubeY, cubeW + depth, depth * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.36)';
    ctx.lineWidth = 1;
    for (const face of [leftFace, rightFace, topFace]) {
      ctx.beginPath();
      ctx.moveTo(face[0][0], face[0][1]);
      for (let i = 1; i < face.length; i += 1) ctx.lineTo(face[i][0], face[i][1]);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  function createWaterTexture() {
    if (waterTexture) return waterTexture;
    waterTexture = createFluidTexture(42, 126, 204);
    return waterTexture;
  }

  function createLavaTexture() {
    if (lavaTexture) return lavaTexture;
    lavaTexture = createFluidTexture(230, 95, 0);
    return lavaTexture;
  }

  function createFluidTexture(r, g, b) {
    const size = 2;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = `rgba(${r},${g},${b},1)`;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
  }

  function hashBlockVariant(x, y, z, id, face) {
    if (id === BLOCK.GRASS && face.type === 'top') return 0;
    if (id === BLOCK.WATER || id === BLOCK.HOT_WATER || id === BLOCK.STEAM_WATER) return 0;
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

  function getRenderedBlockId(state, id, x, y, z) {
    if (id === BLOCK.DIRT && getGrassLevel3D && getGrassLevel3D(state, x, y, z) > 0) return BLOCK.GRASS;
    if (id === BLOCK.GRASS) return BLOCK.GRASS;
    return id;
  }

  function pushWaterUv(uvs, face, x, y, z) {
    const scale = 0.5;
    for (const corner of face.corners) {
      const wx = x + corner[0];
      const wy = y + corner[1];
      const wz = z + corner[2];
      if (face.dir[1] !== 0) uvs.push(wx * scale, wz * scale);
      else if (face.dir[0] !== 0) uvs.push(wz * scale, wy * scale);
      else uvs.push(wx * scale, wy * scale);
    }
  }

  function isNeighborOpen(state, x, y, z, mode) {
    const world = state.world;
    if (x < 0 || x >= world.w || y < 0 || y >= world.h || z < 0 || z >= world.d) return true;
    const id = getBlock3D(state, x, y, z);
    if (mode === 'water') return id !== BLOCK.WATER && id !== BLOCK.HOT_WATER;
    if (mode === 'lava') return id !== BLOCK.LAVA;
    return id === BLOCK.AIR || id === BLOCK.WATER || id === BLOCK.HOT_WATER || id === BLOCK.LAVA;
  }

  function isFluidMode(mode) {
    return mode === 'water' || mode === 'lava';
  }

  function isSameRenderedFluid(a, b) {
    if ((a === BLOCK.WATER || a === BLOCK.HOT_WATER) && (b === BLOCK.WATER || b === BLOCK.HOT_WATER)) return true;
    return a === b;
  }

  function getFluidSurfaceHeight(state, fluidId, x, y, z) {
    if (isSameRenderedFluid(getBlock3D(state, x, y + 1, z), fluidId)) return 1;
    const level = getFluidLevel3D(state, x, y, z, fluidId);
    return Math.max(0.32, 0.9 - Math.min(7, level) * 0.075);
  }

  function pushBlockPosition(positions, id, state, x, y, z, corner) {
    const height = (id === BLOCK.WATER || id === BLOCK.HOT_WATER || id === BLOCK.LAVA) && corner[1] === 1 ? getFluidSurfaceHeight(state, id, x, y, z) : corner[1];
    positions.push(x + corner[0], y + height, z + corner[2]);
  }

  function getFluidFaceRange(state, fluidId, x, y, z, face) {
    const nx = x + face.dir[0];
    const ny = y + face.dir[1];
    const nz = z + face.dir[2];
    const height = getFluidSurfaceHeight(state, fluidId, x, y, z);
    const neighborId = getBlock3D(state, nx, ny, nz);
    if (!isSameRenderedFluid(neighborId, fluidId)) return { lower: 0, upper: height };
    if (face.dir[1] !== 0) return null;
    const neighborHeight = getFluidSurfaceHeight(state, neighborId, nx, ny, nz);
    if (height <= neighborHeight + 0.001) return null;
    return { lower: neighborHeight, upper: height };
  }

  function pushFluidBlockPosition(positions, x, y, z, corner, range) {
    const height = corner[1] === 1 ? range.upper : range.lower;
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

  function chunkKey(cx, cy, cz) {
    return `${cx},${cy},${cz}`;
  }

  function parseChunkKey(key) {
    const parts = String(key).split(',').map(Number);
    if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;
    return { cx: parts[0], cy: parts[1], cz: parts[2] };
  }

  function getChunkBounds(world, cx, cy, cz) {
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

  function getExistingChunkKeys(world) {
    if (!world || !world.chunks) return [];
    return Array.from(world.chunks.keys());
  }

  function getPlayerChunk(player) {
    return {
      cx: Math.floor(player.x / CHUNK_SIZE),
      cz: Math.floor(player.z / CHUNK_SIZE),
    };
  }

  function isChunkInRenderDistance(entry, playerChunk) {
    const dx = entry.cx - playerChunk.cx;
    const dz = entry.cz - playerChunk.cz;
    return dx * dx + dz * dz <= CHUNK_RENDER_DISTANCE * CHUNK_RENDER_DISTANCE;
  }

  function updateChunkVisibility(state) {
    const playerChunk = getPlayerChunk(state.player);
    let visibleChunks = 0;
    let visibleMeshes = 0;
    for (const entry of chunkMeshes.values()) {
      const visible = isChunkInRenderDistance(entry, playerChunk);
      if (entry.solid) entry.solid.visible = visible;
      if (entry.water) entry.water.visible = visible;
      if (entry.lava) entry.lava.visible = visible;
      if (visible) {
        visibleChunks += 1;
        if (entry.solid) visibleMeshes += 1;
        if (entry.water) visibleMeshes += 1;
        if (entry.lava) visibleMeshes += 1;
      }
    }
    if (debugInfo) {
      debugInfo.visibleChunks = visibleChunks;
      debugInfo.visibleChunkMeshes = visibleMeshes;
      debugInfo.renderDistanceChunks = CHUNK_RENDER_DISTANCE;
    }
  }

  function buildWorldMesh(state, mode = 'solid', bounds = null) {
    const positions = [];
    const normals = [];
    const colors = [];
    const uvs = [];
    const indices = [];
    const world = state.world;
    const range = bounds || { minX: 0, minY: 0, minZ: 0, maxX: world.w, maxY: world.h, maxZ: world.d };
    for (let y = range.minY; y < range.maxY; y += 1) {
      for (let z = range.minZ; z < range.maxZ; z += 1) {
        for (let x = range.minX; x < range.maxX; x += 1) {
          const id = getBlock3D(state, x, y, z);
          if (id === BLOCK.AIR) continue;
          const fluidMode = isFluidMode(mode);
          if (mode === 'solid' && (id === BLOCK.WATER || id === BLOCK.HOT_WATER || id === BLOCK.LAVA)) continue;
          if (mode === 'water' && id !== BLOCK.WATER && id !== BLOCK.HOT_WATER) continue;
          if (mode === 'lava' && id !== BLOCK.LAVA) continue;
          for (const face of faces) {
            const nx = x + face.dir[0];
            const ny = y + face.dir[1];
            const nz = z + face.dir[2];
            const fluidRange = fluidMode ? getFluidFaceRange(state, id, x, y, z, face) : null;
            if (fluidMode && !fluidRange) continue;
            if (!fluidMode && !isNeighborOpen(state, nx, ny, nz, mode)) continue;
            const base = positions.length / 3;
            const color = faceShade(face.shade);
            for (const corner of face.corners) {
              if (fluidMode) pushFluidBlockPosition(positions, x, y, z, corner, fluidRange);
              else pushBlockPosition(positions, id, state, x, y, z, corner);
              normals.push(face.dir[0], face.dir[1], face.dir[2]);
              colors.push(color.r, color.g, color.b);
            }
            if (fluidMode) pushWaterUv(uvs, face, x, y, z);
            else pushTileUv(uvs, getRenderedBlockId(state, id, x, y, z), face, x, y, z);
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
    if (positions.length > 0) geometry.computeBoundingSphere();
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
      renderer.setClearColor(SKY_COLOR, 1);
      createTextureAtlas();
      scene = new THREE.Scene();
      scene.background = new THREE.Color(SKY_COLOR);
      const cameraFar = CAMERA_FAR_CHUNKS * CHUNK_SIZE;
      scene.fog = new THREE.Fog(SKY_FOG_COLOR, Math.max(24, cameraFar * 0.34), Math.max(48, cameraFar * 0.74));
      camera = new THREE.PerspectiveCamera(72, 1, 0.05, cameraFar);
      light = new THREE.DirectionalLight(0xffffff, 1.3);
      light.position.set(0.35, 1, 0.45);
      scene.add(light);
      scene.add(new THREE.HemisphereLight(0xbfe4ff, 0x3e3428, 1.35));
      createSkyLayer();
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

  function ensureMaterials() {
    if (!solidMaterial) {
      solidMaterial = new THREE.MeshBasicMaterial({ map: createTextureAtlas(), vertexColors: true, side: THREE.DoubleSide });
    }
    if (!waterMaterial) {
      waterMaterial = new THREE.MeshBasicMaterial({
        map: createWaterTexture(),
        color: 0x2f82d0,
        vertexColors: false,
        side: THREE.FrontSide,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
      });
    }
    if (!lavaMaterial) {
      lavaMaterial = new THREE.MeshBasicMaterial({
        map: createLavaTexture(),
        color: 0xff7818,
        vertexColors: false,
        side: THREE.FrontSide,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
      });
    }
  }

  function updateFluidTextureAnimation() {
    const time = performance.now() * 0.001;
    if (waterTexture) waterTexture.offset.set((time * 0.045) % 1, (time * 0.025) % 1);
    if (lavaTexture) lavaTexture.offset.set((time * 0.035) % 1, (time * 0.055) % 1);
  }

  function createSkyLayer() {
    if (skyGroup || !window.THREE) return;
    skyGroup = new THREE.Group();
    cloudMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    cloudPuffGeometry = new THREE.BoxGeometry(1, 1, 1);
    cloudCells = [];
    const cellsPerAxis = CLOUD_GRID_RADIUS * 2 + 1;
    for (let i = 0; i < cellsPerAxis * cellsPerAxis; i += 1) {
      const cell = { key: '', group: new THREE.Group(), clouds: [] };
      for (let c = 0; c < CLOUDS_PER_CELL; c += 1) {
        const cloud = new THREE.Group();
        const puffs = [];
        for (let p = 0; p < CLOUD_PUFFS_PER_CLOUD; p += 1) {
          const puff = new THREE.Mesh(cloudPuffGeometry, cloudMaterial);
          cloud.add(puff);
          puffs.push(puff);
        }
        cell.group.add(cloud);
        cell.clouds.push({ group: cloud, puffs });
      }
      skyGroup.add(cell.group);
      cloudCells.push(cell);
    }
    scene.add(skyGroup);
  }

  function cloudProfileForCycle(cycle) {
    const rng = mulberry32(0x3b9ac9f1 ^ Math.imul(cycle + 19, 2654435761));
    const roll = rng();
    if (roll < 0.18) return { density: 0.1, minClouds: 0, opacity: 0.6 };
    if (roll < 0.46) return { density: 0.38, minClouds: 1, opacity: 0.68 };
    if (roll < 0.8) return { density: 0.7, minClouds: 2, opacity: 0.74 };
    return { density: 0.96, minClouds: 3, opacity: 0.8 };
  }

  function cloudCellSeed(cx, cz, cycle) {
    let seed = Math.imul(cx + 4099, 374761393) ^ Math.imul(cz - 8191, 668265263);
    seed ^= Math.imul(cycle + 97, 2246822519);
    return seed >>> 0;
  }

  function rebuildCloudCell(cell, cx, cz, cycle, profile) {
    const key = `${cx}:${cz}:${cycle}`;
    if (cell.key === key) return;
    cell.key = key;
    const rng = mulberry32(cloudCellSeed(cx, cz, cycle));
    let visibleCount = 0;
    for (let i = 0; i < cell.clouds.length; i += 1) {
      const cloud = cell.clouds[i];
      const visible = rng() < profile.density || visibleCount < profile.minClouds;
      cloud.group.visible = visible;
      if (!visible) continue;
      visibleCount += 1;
      cloud.group.position.set(
        (rng() - 0.5) * CLOUD_CELL_SIZE,
        CLOUD_HEIGHT + (rng() - 0.5) * 10,
        (rng() - 0.5) * CLOUD_CELL_SIZE
      );
      cloud.group.rotation.y = -0.25 + (rng() - 0.5) * 0.45;
      const activePuffs = 5 + Math.floor(rng() * (CLOUD_PUFFS_PER_CLOUD - 4));
      const length = 28 + rng() * 22;
      const width = 10 + rng() * 9;
      for (let p = 0; p < cloud.puffs.length; p += 1) {
        const puff = cloud.puffs[p];
        puff.visible = p < activePuffs;
        if (!puff.visible) continue;
        const t = activePuffs === 1 ? 0.5 : p / (activePuffs - 1);
        const centerBias = 1 - Math.abs(t - 0.5) * 1.4;
        const layer = p % 3;
        const x = (t - 0.5) * length + (rng() - 0.5) * 8;
        const z = (layer - 1) * width * 0.34 + (rng() - 0.5) * 6;
        const y = (rng() - 0.5) * 1.2 + Math.max(0, centerBias) * 0.7;
        puff.position.set(x, y, z);
        puff.scale.set(
          11 + rng() * 12 + Math.max(0, centerBias) * 8,
          1.8 + rng() * 1.8 + Math.max(0, centerBias) * 0.9,
          6 + rng() * 8 + Math.max(0, centerBias) * 4
        );
      }
    }
  }

  function updateSkyLayer(player) {
    if (!skyGroup || !player) return;
    const time = performance.now() * 0.001;
    const driftX = time * 0.7;
    const driftZ = time * 0.18;
    const cycle = Math.floor(time / CLOUD_WEATHER_CYCLE);
    const profile = cloudProfileForCycle(cycle);
    cloudMaterial.opacity = profile.opacity;
    const centerX = Math.floor((player.x + driftX) / CLOUD_CELL_SIZE);
    const centerZ = Math.floor((player.z + driftZ) / CLOUD_CELL_SIZE);
    let slot = 0;
    for (let dz = -CLOUD_GRID_RADIUS; dz <= CLOUD_GRID_RADIUS; dz += 1) {
      for (let dx = -CLOUD_GRID_RADIUS; dx <= CLOUD_GRID_RADIUS; dx += 1) {
        const cell = cloudCells[slot];
        slot += 1;
        if (!cell) continue;
        const cx = centerX + dx;
        const cz = centerZ + dz;
        rebuildCloudCell(cell, cx, cz, cycle, profile);
        cell.group.position.set(cx * CLOUD_CELL_SIZE - driftX, 0, cz * CLOUD_CELL_SIZE - driftZ);
      }
    }
  }

  function ensureSteamParticles() {
    if (steamGroup || !window.THREE || !scene) return;
    steamGroup = new THREE.Group();
    steamMaterial = new THREE.MeshBasicMaterial({
      color: 0xeef8ff,
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
    });
    steamGeometry = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    steamParticles = [];
    for (let i = 0; i < STEAM_PARTICLE_LIMIT; i += 1) {
      const mesh = new THREE.Mesh(steamGeometry, steamMaterial);
      mesh.visible = false;
      steamGroup.add(mesh);
      steamParticles.push({
        mesh,
        active: false,
        x: 0,
        y: 0,
        z: 0,
        baseY: 0,
        maxHeight: 1,
        life: 0,
        age: 0,
        vx: 0,
        vy: 0,
        vz: 0,
      });
    }
    scene.add(steamGroup);
  }

  function collectVisibleGeysers(state) {
    const geysers = [];
    const player = state.player;
    const fluids = Game.fluids3d;
    if (!player || !fluids || !fluids.getActiveGeysers3D) return geysers;
    const px = Math.floor(player.x);
    const py = Math.floor(player.y);
    const pz = Math.floor(player.z);
    const geyserList = fluids.getActiveGeysers3D(state);
    for (const geyser of geyserList) {
      if (Math.abs(geyser.x - px) > STEAM_GEYSER_SCAN_RADIUS) continue;
      if (Math.abs(geyser.z - pz) > STEAM_GEYSER_SCAN_RADIUS) continue;
      if (Math.abs(geyser.y - py) > 12) continue;
      geysers.push(geyser);
      if (geysers.length >= 24) return geysers;
    }
    return geysers;
  }

  function spawnSteamParticle(geyser) {
    const particle = steamParticles.find((item) => !item.active);
    if (!particle) return;
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 0.28;
    particle.active = true;
    particle.baseY = geyser.y + 0.9;
    particle.maxHeight = Math.max(1, Math.min(7, geyser.height || 1));
    particle.x = geyser.x + 0.5 + Math.cos(angle) * radius;
    particle.y = particle.baseY;
    particle.z = geyser.z + 0.5 + Math.sin(angle) * radius;
    particle.vx = (Math.random() - 0.5) * 0.12;
    particle.vy = 0.65 + particle.maxHeight * 0.16 + Math.random() * 0.35;
    particle.vz = (Math.random() - 0.5) * 0.12;
    particle.life = Math.max(1, particle.maxHeight / Math.max(0.1, particle.vy)) + Math.random() * 0.25;
    particle.age = 0;
    particle.mesh.visible = true;
    particle.mesh.scale.setScalar(0.7 + Math.random() * 0.8);
  }

  function updateSteamParticles(state) {
    ensureSteamParticles();
    if (!steamGroup) return;
    const now = performance.now() * 0.001;
    const dt = Math.min(0.05, lastSteamUpdate ? now - lastSteamUpdate : 0);
    lastSteamUpdate = now;
    const geysers = collectVisibleGeysers(state);
    if (geysers.length > 0 && !state.pause.open) {
      const spawnCount = Math.min(geysers.length * 2, 8);
      for (let i = 0; i < spawnCount; i += 1) {
        if (Math.random() > 0.72) continue;
        spawnSteamParticle(geysers[Math.floor(Math.random() * geysers.length)]);
      }
    }
    for (const particle of steamParticles) {
      if (!particle.active) continue;
      particle.age += dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.z += particle.vz * dt;
      const height = particle.y - particle.baseY;
      if (particle.age >= particle.life || height >= particle.maxHeight) {
        particle.active = false;
        particle.mesh.visible = false;
        continue;
      }
      const fade = 1 - Math.max(0, height) / Math.max(0.1, particle.maxHeight);
      particle.mesh.position.set(particle.x, particle.y, particle.z);
      particle.mesh.scale.setScalar(Math.max(0.25, fade) * 1.25);
    }
  }

  function getSheepMaterials() {
    if (!sheepMaterials) {
      sheepMaterials = {
        wool: new THREE.MeshBasicMaterial({ color: 0xd8d0b8 }),
        woolLight: new THREE.MeshBasicMaterial({ color: 0xf0e8d2 }),
        woolShade: new THREE.MeshBasicMaterial({ color: 0xa89b80 }),
        face: new THREE.MeshBasicMaterial({ color: 0x3a3128 }),
        leg: new THREE.MeshBasicMaterial({ color: 0x2a241e }),
      };
    }
    return sheepMaterials;
  }

  function createSheepMesh() {
    const mats = getSheepMaterials();
    const root = new THREE.Group();

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.54, 0.5), mats.wool);
    body.position.set(0, 0.64, 0);
    root.add(body);

    const bodyTop = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.16, 0.42), mats.woolLight);
    bodyTop.position.set(-0.02, 0.99, 0);
    root.add(bodyTop);

    const bodySide = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 0.56), mats.woolShade);
    bodySide.position.set(-0.35, 0.62, 0);
    root.add(bodySide);

    const rump = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.36, 0.44), mats.woolShade);
    rump.position.set(-0.52, 0.66, 0);
    root.add(rump);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), mats.face);
    head.position.set(0.56, 0.72, 0);
    root.add(head);
    root.userData.head = head;

    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.24), mats.leg);
    snout.position.set(0.76, 0.67, 0);
    root.add(snout);

    const woolCap = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.32), mats.woolLight);
    woolCap.position.set(0.56, 0.96, 0);
    root.add(woolCap);

    const hornLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.08), mats.woolShade);
    hornLeft.position.set(0.52, 0.88, -0.2);
    root.add(hornLeft);

    const hornRight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.08), mats.woolShade);
    hornRight.position.set(0.52, 0.88, 0.2);
    root.add(hornRight);

    const legGeometry = new THREE.BoxGeometry(0.12, 0.36, 0.12);
    for (const [x, z] of [[-0.28, -0.18], [-0.28, 0.18], [0.28, -0.18], [0.28, 0.18]]) {
      const leg = new THREE.Mesh(legGeometry, mats.leg);
      leg.position.set(x, 0.22, z);
      root.add(leg);
    }

    return root;
  }

  function disposeSheepMeshes() {
    for (const mesh of sheepMeshes.values()) scene.remove(mesh);
    sheepMeshes.clear();
  }

  function syncSheepMeshes(state) {
    if (!scene) return;
    const sheep = state.entities && Array.isArray(state.entities.sheep) ? state.entities.sheep : [];
    const live = new Set();
    const playerChunk = getPlayerChunk(state.player);
    for (const item of sheep) {
      live.add(item.id);
      let mesh = sheepMeshes.get(item.id);
      if (!mesh) {
        mesh = createSheepMesh();
        sheepMeshes.set(item.id, mesh);
        scene.add(mesh);
      }
      mesh.position.set(item.x, item.y, item.z);
      mesh.rotation.y = -(item.yaw || 0);
      const head = mesh.userData && mesh.userData.head;
      if (head) head.rotation.z = item.eating ? -0.65 : 0;
      const cx = Math.floor(item.x / CHUNK_SIZE);
      const cz = Math.floor(item.z / CHUNK_SIZE);
      const dx = cx - playerChunk.cx;
      const dz = cz - playerChunk.cz;
      mesh.visible = dx * dx + dz * dz <= CHUNK_RENDER_DISTANCE * CHUNK_RENDER_DISTANCE;
    }
    for (const [id, mesh] of sheepMeshes) {
      if (live.has(id)) continue;
      scene.remove(mesh);
      sheepMeshes.delete(id);
    }
    if (debugInfo) debugInfo.sheep = sheep.length;
  }

  function disposeChunkMeshes() {
    for (const entry of chunkMeshes.values()) {
      if (entry.solid) {
        scene.remove(entry.solid);
        entry.solid.geometry.dispose();
      }
      if (entry.water) {
        scene.remove(entry.water);
        entry.water.geometry.dispose();
      }
      if (entry.lava) {
        scene.remove(entry.lava);
        entry.lava.geometry.dispose();
      }
    }
    chunkMeshes.clear();
  }

  function setChunkMesh(state, cx, cy, cz, mode) {
    const bounds = getChunkBounds(state.world, cx, cy, cz);
    if (!bounds) return { vertices: 0, triangles: 0 };
    ensureMaterials();

    const key = chunkKey(cx, cy, cz);
    const entry = chunkMeshes.get(key) || { cx, cy, cz, solid: null, water: null, lava: null };
    entry.cx = cx;
    entry.cy = cy;
    entry.cz = cz;
    const previous = entry[mode];
    const geometry = buildWorldMesh(state, mode, bounds);
    const vertices = geometry.getAttribute('position').count;
    const triangles = geometry.index ? geometry.index.count / 3 : 0;

    if (vertices === 0) {
      if (previous) {
        scene.remove(previous);
        previous.geometry.dispose();
        entry[mode] = null;
      }
      geometry.dispose();
    } else if (previous) {
      previous.geometry.dispose();
      previous.geometry = geometry;
      previous.frustumCulled = true;
    } else {
      const material = mode === 'water' ? waterMaterial : (mode === 'lava' ? lavaMaterial : solidMaterial);
      const nextMesh = new THREE.Mesh(geometry, material);
      nextMesh.frustumCulled = true;
      entry[mode] = nextMesh;
      scene.add(nextMesh);
    }

    if (entry.solid || entry.water || entry.lava) chunkMeshes.set(key, entry);
    else chunkMeshes.delete(key);
    return { vertices, triangles };
  }

  function rebuildAllChunks(state) {
    if (!scene || !window.THREE) return;
    disposeChunkMeshes();
    const chunkKeys = getExistingChunkKeys(state.world);
    const totals = { vertices: 0, triangles: 0, chunks: 0, chunkMeshes: 0 };
    for (const key of chunkKeys) {
      const parsed = parseChunkKey(key);
      if (!parsed) continue;
      const solid = setChunkMesh(state, parsed.cx, parsed.cy, parsed.cz, 'solid');
      const water = setChunkMesh(state, parsed.cx, parsed.cy, parsed.cz, 'water');
      const lava = setChunkMesh(state, parsed.cx, parsed.cy, parsed.cz, 'lava');
      totals.vertices += solid.vertices + water.vertices + lava.vertices;
      totals.triangles += solid.triangles + water.triangles + lava.triangles;
      totals.chunks += 1;
      if (solid.vertices > 0) totals.chunkMeshes += 1;
      if (water.vertices > 0) totals.chunkMeshes += 1;
      if (lava.vertices > 0) totals.chunkMeshes += 1;
    }
    debugInfo = {
      vertices: totals.vertices,
      triangles: totals.triangles,
      chunks: totals.chunks,
      chunkMeshes: totals.chunkMeshes,
      textureTiles: atlasMeta ? atlasMeta.totalTiles : 0,
    };
    state.world.dirtyAll = false;
    state.world.dirtyChunks.clear();
  }

  function updateDirtyChunks(state) {
    if (!scene || !window.THREE || !state.world.dirtyChunks.size) return;
    const totals = debugInfo || { vertices: 0, triangles: 0, chunks: 0, chunkMeshes: 0, textureTiles: atlasMeta ? atlasMeta.totalTiles : 0 };
    const keys = Array.from(state.world.dirtyChunks).slice(0, CHUNK_MESH_REBUILD_BUDGET);
    for (const key of keys) {
      const parsed = parseChunkKey(key);
      state.world.dirtyChunks.delete(key);
      if (!parsed) continue;
      const oldEntry = chunkMeshes.get(key);
      let oldVertices = 0;
      let oldTriangles = 0;
      let oldMeshes = 0;
      if (oldEntry && oldEntry.solid) {
        oldVertices += oldEntry.solid.geometry.getAttribute('position').count;
        oldTriangles += oldEntry.solid.geometry.index ? oldEntry.solid.geometry.index.count / 3 : 0;
        oldMeshes += 1;
      }
      if (oldEntry && oldEntry.water) {
        oldVertices += oldEntry.water.geometry.getAttribute('position').count;
        oldTriangles += oldEntry.water.geometry.index ? oldEntry.water.geometry.index.count / 3 : 0;
        oldMeshes += 1;
      }
      if (oldEntry && oldEntry.lava) {
        oldVertices += oldEntry.lava.geometry.getAttribute('position').count;
        oldTriangles += oldEntry.lava.geometry.index ? oldEntry.lava.geometry.index.count / 3 : 0;
        oldMeshes += 1;
      }

      const solid = setChunkMesh(state, parsed.cx, parsed.cy, parsed.cz, 'solid');
      const water = setChunkMesh(state, parsed.cx, parsed.cy, parsed.cz, 'water');
      const lava = setChunkMesh(state, parsed.cx, parsed.cy, parsed.cz, 'lava');
      const nextMeshes = (solid.vertices > 0 ? 1 : 0) + (water.vertices > 0 ? 1 : 0) + (lava.vertices > 0 ? 1 : 0);
      totals.vertices += solid.vertices + water.vertices + lava.vertices - oldVertices;
      totals.triangles += solid.triangles + water.triangles + lava.triangles - oldTriangles;
      totals.chunkMeshes += nextMeshes - oldMeshes;
    }
    totals.textureTiles = atlasMeta ? atlasMeta.totalTiles : 0;
    totals.pendingDirtyChunks = state.world.dirtyChunks.size;
    debugInfo = totals;
  }

  function setWorld(state) {
    disposeSheepMeshes();
    rebuildAllChunks(state);
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
    if (state.world.dirtyAll) rebuildAllChunks(state);
    else if (state.world.dirtyChunks.size > 0) updateDirtyChunks(state);
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
    updateFluidTextureAnimation();
    updateSkyLayer(player);
    updateSteamParticles(state);
    syncSheepMeshes(state);
    if (debugInfo) {
      debugInfo.camera = [camera.position.x, camera.position.y, camera.position.z];
      debugInfo.rotation = [camera.rotation.x, camera.rotation.y, camera.rotation.z];
      debugInfo.loadedChunks = state.world && state.world.chunks ? state.world.chunks.size : 0;
      debugInfo.modifiedChunks = state.world && state.world.modifiedChunks ? state.world.modifiedChunks.size : 0;
      debugInfo.unsavedChunks = state.world && state.world.unsavedChunks ? state.world.unsavedChunks.size : 0;
      debugInfo.savedChunks = state.world && state.world.savedChunks ? state.world.savedChunks.size : 0;
      debugInfo.lastUnloadedChunks = state.world && state.world.lastUnloadedChunks ? state.world.lastUnloadedChunks : 0;
      debugInfo.queuedChunks = state.world && state.world.lastQueuedChunks ? state.world.lastQueuedChunks : 0;
      debugInfo.pendingChunks = state.world && state.world.lastPendingChunks ? state.world.lastPendingChunks : 0;
    }
    updateChunkVisibility(state);
    renderer.render(scene, camera);
    drawUI3D(overlayCtx, overlayCanvas, state);
  }

  function setVisible(canvas, visible) {
    canvas.classList.toggle('is-hidden', !visible);
  }

  function getDebugInfo() {
    return debugInfo;
  }

  Game.renderer3d = { init, resize, setWorld, render, setVisible, getDebugInfo, drawBlockIcon };
})();
