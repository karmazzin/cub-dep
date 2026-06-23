(() => {
  const Game = window.CubDep;
  const { BLOCK, BLOCK_COLORS } = Game.blocks;
  const { EYE_HEIGHT, CHUNK_SIZE, CHUNK_RENDER_DISTANCE, CAMERA_FAR_CHUNKS, CHUNK_MESH_REBUILD_BUDGET } = Game.constants3d;
  const { getBlock3D, getFluidLevel3D } = Game.world3d;
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
  let targetBox = null;
  let crackLines = null;
  let sheepMeshes = new Map();
  let sheepMaterials = null;
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
    if (mode === 'water') return id !== BLOCK.WATER;
    if (mode === 'lava') return id !== BLOCK.LAVA;
    return id === BLOCK.AIR || id === BLOCK.WATER || id === BLOCK.LAVA;
  }

  function fluidIdForMode(mode) {
    return mode === 'lava' ? BLOCK.LAVA : BLOCK.WATER;
  }

  function isFluidMode(mode) {
    return mode === 'water' || mode === 'lava';
  }

  function getFluidSurfaceHeight(state, fluidId, x, y, z) {
    if (getBlock3D(state, x, y + 1, z) === fluidId) return 1;
    const level = getFluidLevel3D(state, x, y, z, fluidId);
    return Math.max(0.32, 0.9 - Math.min(7, level) * 0.075);
  }

  function pushBlockPosition(positions, id, state, x, y, z, corner) {
    const height = (id === BLOCK.WATER || id === BLOCK.LAVA) && corner[1] === 1 ? getFluidSurfaceHeight(state, id, x, y, z) : corner[1];
    positions.push(x + corner[0], y + height, z + corner[2]);
  }

  function getFluidFaceRange(state, fluidId, x, y, z, face) {
    const nx = x + face.dir[0];
    const ny = y + face.dir[1];
    const nz = z + face.dir[2];
    const height = getFluidSurfaceHeight(state, fluidId, x, y, z);
    if (getBlock3D(state, nx, ny, nz) !== fluidId) return { lower: 0, upper: height };
    if (face.dir[1] !== 0) return null;
    const neighborHeight = getFluidSurfaceHeight(state, fluidId, nx, ny, nz);
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
          const fluidId = fluidIdForMode(mode);
          if (mode === 'solid' && (id === BLOCK.WATER || id === BLOCK.LAVA)) continue;
          if (mode === 'water' && id !== BLOCK.WATER) continue;
          if (mode === 'lava' && id !== BLOCK.LAVA) continue;
          for (const face of faces) {
            const nx = x + face.dir[0];
            const ny = y + face.dir[1];
            const nz = z + face.dir[2];
            const fluidRange = fluidMode ? getFluidFaceRange(state, fluidId, x, y, z, face) : null;
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
            else pushTileUv(uvs, id, face, x, y, z);
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
      renderer.setClearColor(0x87bfe8, 1);
      createTextureAtlas();
      scene = new THREE.Scene();
      const cameraFar = CAMERA_FAR_CHUNKS * CHUNK_SIZE;
      scene.fog = new THREE.Fog(0x87bfe8, Math.max(24, cameraFar * 0.34), Math.max(48, cameraFar * 0.74));
      camera = new THREE.PerspectiveCamera(72, 1, 0.05, cameraFar);
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

  function getSheepMaterials() {
    if (!sheepMaterials) {
      sheepMaterials = {
        wool: new THREE.MeshBasicMaterial({ color: 0xf2f0df }),
        woolShade: new THREE.MeshBasicMaterial({ color: 0xd7d2bd }),
        face: new THREE.MeshBasicMaterial({ color: 0x2f2b27 }),
        leg: new THREE.MeshBasicMaterial({ color: 0x24211e }),
      };
    }
    return sheepMaterials;
  }

  function createSheepMesh() {
    const mats = getSheepMaterials();
    const root = new THREE.Group();

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.58, 0.52), mats.wool);
    body.position.set(0, 0.64, 0);
    root.add(body);

    const bodyTop = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.16, 0.42), mats.woolShade);
    bodyTop.position.set(-0.02, 0.99, 0);
    root.add(bodyTop);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), mats.face);
    head.position.set(0.56, 0.72, 0);
    root.add(head);

    const woolCap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.3), mats.wool);
    woolCap.position.set(0.56, 0.96, 0);
    root.add(woolCap);

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
      const head = mesh.children[2];
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
