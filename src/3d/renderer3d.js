(() => {
  const Game = window.CubDep;
  const { BLOCK, BLOCK_COLORS } = Game.blocks;
  const { EYE_HEIGHT, CHUNK_SIZE, CAMERA_FAR_CHUNKS, CHUNK_MESH_REBUILD_TIME_BUDGET_MS, CHUNK_MESH_REBUILD_MAX_TIME_BUDGET_MS, getChunkRenderDistanceValue } = Game.constants3d;
  const { getBlock3D, getFluidLevel3D, getGrassLevel3D, isSolidBlock3D } = Game.world3d;
  const { drawUI3D } = Game.ui3d;

  let renderer = null;
  let scene = null;
  let camera = null;
  let chunkMeshes = new Map();
  let chunkMeshRevision = 0;
  let visibilityCache = null;
  let optimizeIcons = false;
  const blockIconCache = new Map();
  let solidMaterial = null;
  let shaderSolidMaterial = null;
  let waterMaterial = null;
  let shaderWaterMaterial = null;
  let lavaMaterial = null;
  let shaderLavaMaterial = null;
  let shaderSolidUniforms = null;
  let waterTexture = null;
  let lavaTexture = null;
  let light = null;
  let hemiLight = null;
  let sunMesh = null;
  let sunGlowMesh = null;
  let skyDome = null;
  let firstPersonGroup = null;
  let firstPersonItem = null;
  let heldItemTexture = null;
  let playerModel = null;
  let playerModelSkin = '';
  let shaderProfileEnabled = false;
  let skyGroup = null;
  let cloudMaterial = null;
  let cloudPuffGeometry = null;
  let shaderCloudPuffGeometry = null;
  let cloudCells = [];
  let cloudCellMap = new Map();
  let cloudDriftX = 0;
  let cloudDriftZ = 0;
  let cloudWindX = 0;
  let cloudWindZ = 0;
  let cloudLastUpdateTime = 0;
  let targetBox = null;
  let crackLines = null;
  let dynamiteOverlayGroup = null;
  let dynamiteOverlayGeometry = null;
  let dynamiteOverlayMaterials = null;
  let shaderDynamiteOverlayMaterial = null;
  let dynamiteOverlayMeshes = [];
  let previewFluidMesh = null;
  let previewFluidGeometry = null;
  let lastResizeW = 0;
  let lastResizeH = 0;
  let meshRebuildQueue = [];
  let meshRebuildQueued = new Set();
  let previewFluidMaterial = null;
  let previewFluidCapacity = 0;
  let previewTntMesh = null;
  let sheepMeshes = new Map();
  let petMeshes = new Map();
  let botMeshes = new Map();
  let movingBlockMeshes = new Map();
  let customTntLabelSprites = new Map();
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
  let lavaEmberGroup = null;
  let lavaEmberMaterial = null;
  let lavaEmberGeometry = null;
  let lavaEmbers = [];
  let lastLavaEmberUpdate = 0;
  let explosionMushroomGroup = null;
  let explosionMushroomMeshes = new Map();
  let explosionMushroomStemGeometry = null;
  let explosionMushroomCapGeometry = null;
  let explosionMushroomFlashGeometry = null;
  let explosionMushroomRingGeometry = null;
  let lastExplosionMushroomUpdate = 0;

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
  const ERUPTION_SKY_COLOR = 0x3b3d40;
  const ERUPTION_FOG_COLOR = 0x2c2b2a;
  const CLOUD_HEIGHT = 88;
  const CLOUD_CELL_SIZE = 76;
  const CLOUD_GRID_RADIUS = 3;
  const CLOUDS_PER_CELL = 4;
  const CLOUD_PUFFS_PER_CLOUD = 9;
  const CLOUD_WEATHER_CYCLE = 120;
  const CLOUD_WIND_CYCLE = 46;
  const CLOUD_FADE_START = 118;
  const CLOUD_FADE_END = 182;
  const STEAM_PARTICLE_LIMIT = 160;
  const STEAM_GEYSER_SCAN_RADIUS = 24;
  const LAVA_EMBER_LIMIT = 64;
  const LAVA_EMBER_SCAN_RADIUS = 18;
  const EXPLOSION_MUSHROOM_LIFE = 3.8;
  const EXPLOSION_MUSHROOM_RENDER_LIMIT = 12;
  const SUN_POSITION = new THREE.Vector3(0.18, 0.84, -0.32).normalize();
  const MESH_VERTICAL_PRIORITY_WEIGHT = 0.35;
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
    if (id === B.GRASS || id === B.MOSS || id === B.MUSHROOM_SOIL || id === B.RED_EARTH || id === B.SCORCHED_DIRT || id === B.ASH) return 'soil';
    if (id === B.DIRT || id === B.PATH || id === B.SAND || id === B.SNOW || id === B.CLOUD || id === B.WOOL) return 'soft';
    if (id === B.WOOD || id === B.SPRUCE_WOOD || id === B.GREAT_TREE_WOOD || id === B.SEQUOIA_WOOD || id === B.PILLAR) return 'wood';
    if (id === B.CHEST || id === B.STONE_CHEST) return 'chest';
    if (id === B.PLANK || id === B.SEQUOIA_PLANK || id === B.DOOR || id === B.LADDER) return 'plank';
    if (id === B.LEAF || id === B.SPRUCE_LEAF || id === B.SEQUOIA_LEAF || id === B.DRY_BUSH || id === B.CACTUS) return 'leaf';
    if (id === B.WATER || id === B.HOT_WATER || id === B.STEAM_WATER) return 'water';
    if (id === B.LAVA || id === B.VOLCANIC_LAVA || id === B.FIRE_PORTAL || id === B.AIR_DIMENSION_PORTAL || id === B.AIR_THIEF_PORTAL || id === B.AIR_HOME_PORTAL || id === B.ELEMENTAL_RETURN_PORTAL || id === B.END_GATE || id === B.WATER_DIMENSION_PORTAL) return 'glow';
    if (id === B.COAL_ORE || id === B.GOLD_ORE || id === B.IRON_ORE || id === B.DIAMOND_ORE || id === B.DEEP_ORE || id === B.FRIENDSHIP_ORE || id === B.STEAM_ORE || id === B.INVISIBLE_ORE) return 'ore';
    if (id === B.GOLDEN_FLOWER || id === B.EMBER_FLOWER || id === B.EMBER_SHRUB || id === B.GLOW_ALGAE || id === B.TALL_GLOW_ALGAE || id === B.ALGAE || id === B.TALL_ALGAE || id === B.SMALL_GLOW_MUSHROOM) return 'plant';
    if (id === B.WHITE_MUSHROOM_STEM || id === B.WHITE_MUSHROOM_CAP || id === B.FLY_AGARIC_STEM || id === B.FLY_AGARIC_CAP || id === B.GLOW_MUSHROOM_STEM || id === B.GLOW_MUSHROOM_CAP || id === B.SMALL_WHITE_MUSHROOM || id === B.SMALL_FLY_AGARIC) return 'mushroom';
    if (id === B.PINK_CORAL || id === B.BLUE_CORAL || id === B.GOLD_CORAL || id === B.CORAL_STONE) return 'coral';
    if (id === B.WATER_CRYSTAL || id === B.AIR_CRYSTAL || id === B.ECHO_CORE || id === B.ROOT_CORE || id === B.FRIENDSHIP_AMULET) return 'crystal';
    if (id === B.COBWEB) return 'web';
    if (id === B.BEDROCK || id === B.STONE || id === B.BROKEN_STONE || id === B.BLACKSTONE || id === B.DEEPSTONE || id === B.BASALT || id === B.ROOT_STONE || id === B.ASH_STONE || id === B.WATER_FRAME || id === B.WATER_WELL_FRAME || id === B.MAIN_WELL_FRAME || id === B.AIR_ENTRANCE_FRAME || id === B.GOLDEN_GARDEN_SHELL || id === B.FIRE_SEAL || id === B.ROOT_PLATFORM || id === B.ECHO_SHARD_PEDESTAL || id === B.ROOT_NODE) return 'stone';
    return 'generic';
  }

  function isLeafBlock(id) {
    return id === BLOCK.LEAF || id === BLOCK.SPRUCE_LEAF || id === BLOCK.SEQUOIA_LEAF;
  }

  function dirtPalette(id) {
    if (id === BLOCK.RED_EARTH) return { r: 118, g: 62, b: 42 };
    if (id === BLOCK.SCORCHED_DIRT) return { r: 70, g: 45, b: 32 };
    if (id === BLOCK.MUSHROOM_SOIL) return { r: 82, g: 68, b: 52 };
    if (id === BLOCK.ASH) return { r: 108, g: 102, b: 98 };
    if (id === BLOCK.PATH) return { r: 118, g: 86, b: 46 };
    return { r: 116, g: 78, b: 44 };
  }

  function stonePalette(id) {
    if (id === BLOCK.BEDROCK) return { r: 34, g: 34, b: 34 };
    if (id === BLOCK.BLACKSTONE) return { r: 38, g: 38, b: 42 };
    if (id === BLOCK.DEEPSTONE) return { r: 62, g: 66, b: 72 };
    if (id === BLOCK.BASALT) return { r: 38, g: 38, b: 42 };
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

  function drawChestTile(ctx, rng, id, x, y, size, faceType) {
    const stone = id === BLOCK.STONE_CHEST;
    const body = stone ? { r: 112, g: 116, b: 120 } : { r: 132, g: 78, b: 32 };
    const lid = stone ? { r: 82, g: 86, b: 91 } : { r: 96, g: 55, b: 24 };
    const trim = stone ? { r: 48, g: 52, b: 56 } : { r: 56, g: 34, b: 22 };
    fillPixelNoise(ctx, rng, body, x, y, size, 18, 2);

    ctx.fillStyle = rgbToCss(lid);
    ctx.fillRect(x, y, size, Math.max(5, Math.floor(size * 0.32)));
    ctx.fillStyle = rgbToCss(trim);
    ctx.fillRect(x, y + Math.floor(size * 0.30), size, Math.max(2, Math.floor(size * 0.08)));
    ctx.fillRect(x, y, Math.max(2, Math.floor(size * 0.08)), size);
    ctx.fillRect(x + size - Math.max(2, Math.floor(size * 0.08)), y, Math.max(2, Math.floor(size * 0.08)), size);

    ctx.strokeStyle = rgbToCss(adjustColor(trim, -8));
    ctx.lineWidth = Math.max(1, Math.floor(size / 20));
    for (let xx = x + Math.floor(size * 0.24); xx < x + size; xx += Math.floor(size * 0.26)) {
      ctx.beginPath();
      ctx.moveTo(xx + 0.5, y + Math.floor(size * 0.38));
      ctx.lineTo(xx + 0.5, y + size);
      ctx.stroke();
    }

    if (faceType !== 'top' && faceType !== 'bottom') {
      const lockW = Math.max(5, Math.floor(size * 0.22));
      const lockH = Math.max(5, Math.floor(size * 0.20));
      const lockX = x + Math.floor((size - lockW) / 2);
      const lockY = y + Math.floor(size * 0.36);
      ctx.fillStyle = '#d8b04a';
      ctx.fillRect(lockX, lockY, lockW, lockH);
      ctx.fillStyle = '#7a5220';
      ctx.fillRect(lockX + Math.floor(lockW * 0.4), lockY + Math.floor(lockH * 0.48), Math.max(1, Math.floor(lockW * 0.22)), Math.max(2, Math.floor(lockH * 0.38)));
    } else {
      ctx.strokeStyle = rgbToCss(adjustColor(trim, -4));
      ctx.lineWidth = Math.max(1, Math.floor(size / 16));
      ctx.beginPath();
      ctx.moveTo(x + Math.floor(size * 0.12), y + Math.floor(size * 0.5));
      ctx.lineTo(x + Math.floor(size * 0.88), y + Math.floor(size * 0.5));
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(0,0,0,0.42)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
  }

  function drawDynamiteTile(ctx, rng, id, x, y, size) {
    const base = hexToRgb(BLOCK_COLORS[id] || '#b43a2f');
    ctx.fillStyle = rgbToCss(base);
    ctx.fillRect(x, y, size, size);
    const stickCount = id === BLOCK.CUSTOM_TNT ? 5 : (id === BLOCK.DYNAMITE_POWER_100 ? 7 : (id === BLOCK.DYNAMITE_POWER_75 ? 6 : (id === BLOCK.DYNAMITE_MEGA_HUGE ? 5 : (id === BLOCK.DYNAMITE_HUGE ? 4 : 3))));
    const stickW = Math.max(4, Math.floor(size / (stickCount + 2)));
    const startX = x + Math.floor((size - stickW * stickCount) / 2);
    for (let i = 0; i < stickCount; i += 1) {
      const sx = startX + i * stickW;
      ctx.fillStyle = rgbToCss(adjustColor(base, i % 2 === 0 ? 16 : -12));
      ctx.fillRect(sx, y + 3, stickW - 1, size - 6);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(sx + 1, y + 5, 1, size - 10);
    }
    ctx.fillStyle = '#2c2017';
    ctx.fillRect(x + 3, y + Math.floor(size * 0.42), size - 6, Math.max(3, Math.floor(size * 0.16)));
    ctx.strokeStyle = '#f2d38a';
    ctx.lineWidth = Math.max(1, Math.floor(size / 18));
    ctx.beginPath();
    ctx.moveTo(x + size * 0.52, y + size * 0.14);
    ctx.quadraticCurveTo(x + size * 0.68, y + size * 0.04, x + size * 0.82, y + size * 0.16);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
    for (let i = 0; i < 8; i += 1) {
      ctx.fillStyle = `rgba(0,0,0,${0.05 + rng() * 0.08})`;
      ctx.fillRect(x + Math.floor(rng() * size), y + Math.floor(rng() * size), 1, 1);
    }
  }

  function drawTntTableTile(ctx, rng, x, y, size) {
    const base = hexToRgb(BLOCK_COLORS[BLOCK.TNT_TABLE] || '#5a4638');
    fillPixelNoise(ctx, rng, base, x, y, size, 28, 2);
    ctx.fillStyle = '#2c241f';
    ctx.fillRect(x + Math.floor(size * 0.12), y + Math.floor(size * 0.16), Math.floor(size * 0.76), Math.floor(size * 0.20));
    ctx.fillStyle = '#c43b31';
    ctx.fillRect(x + Math.floor(size * 0.22), y + Math.floor(size * 0.46), Math.floor(size * 0.56), Math.floor(size * 0.32));
    ctx.fillStyle = '#f1d06a';
    ctx.fillRect(x + Math.floor(size * 0.48), y + Math.floor(size * 0.34), Math.max(2, Math.floor(size * 0.08)), Math.floor(size * 0.16));
    ctx.strokeStyle = 'rgba(0,0,0,0.42)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
  }

  function drawTntRemoteTile(ctx, rng, x, y, size) {
    const base = hexToRgb(BLOCK_COLORS[BLOCK.TNT_REMOTE] || '#4f6d78');
    fillPixelNoise(ctx, rng, base, x, y, size, 24, 2);
    ctx.fillStyle = '#263942';
    ctx.fillRect(x + Math.floor(size * 0.16), y + Math.floor(size * 0.18), Math.floor(size * 0.68), Math.floor(size * 0.64));
    ctx.fillStyle = '#6f8d98';
    ctx.fillRect(x + Math.floor(size * 0.22), y + Math.floor(size * 0.24), Math.floor(size * 0.56), Math.floor(size * 0.26));
    ctx.fillStyle = '#f0d05a';
    ctx.fillRect(x + Math.floor(size * 0.28), y + Math.floor(size * 0.30), Math.floor(size * 0.44), Math.max(2, Math.floor(size * 0.08)));
    ctx.fillStyle = '#cb3d33';
    ctx.beginPath();
    ctx.arc(x + size * 0.50, y + size * 0.66, Math.max(3, size * 0.13), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d9eef0';
    ctx.lineWidth = Math.max(1, Math.floor(size / 18));
    ctx.beginPath();
    ctx.moveTo(x + size * 0.62, y + size * 0.18);
    ctx.lineTo(x + size * 0.80, y + size * 0.04);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
  }

  function drawStrangePortalTile(ctx, rng, id, x, y, size) {
    const base = hexToRgb(BLOCK_COLORS[id] || '#251d31');
    if (id === BLOCK.ACTIVE_STRANGE_PORTAL) {
      fillPixelNoise(ctx, rng, { r: 44, g: 18, b: 74 }, x, y, size, 26, 4);
      ctx.fillStyle = '#6f32a8';
      ctx.fillRect(x + size * 0.12, y + size * 0.12, size * 0.76, size * 0.76);
      ctx.fillStyle = '#a860e2';
      ctx.fillRect(x + size * 0.22, y + size * 0.22, size * 0.56, size * 0.56);
      ctx.strokeStyle = '#f0c8ff';
      ctx.lineWidth = Math.max(2, Math.floor(size / 10));
      ctx.beginPath();
      ctx.moveTo(x + size * 0.20, y + size * 0.5);
      ctx.quadraticCurveTo(x + size * 0.5, y + size * 0.12, x + size * 0.80, y + size * 0.5);
      ctx.quadraticCurveTo(x + size * 0.5, y + size * 0.88, x + size * 0.20, y + size * 0.5);
      ctx.stroke();
      ctx.fillStyle = '#241036';
      ctx.fillRect(x + size * 0.45, y + size * 0.45, size * 0.10, size * 0.10);
      return;
    }
    fillPixelNoise(ctx, rng, base, x, y, size, 32, 2);
    if (id === BLOCK.STRANGE_PORTAL_CORE) {
      ctx.fillStyle = '#171120';
      ctx.fillRect(x + size * 0.18, y + size * 0.18, size * 0.64, size * 0.64);
      ctx.fillStyle = 'rgba(149,104,206,0.78)';
      ctx.beginPath();
      ctx.arc(x + size * 0.5, y + size * 0.5, size * 0.23, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#21152f';
      ctx.lineWidth = Math.max(1, Math.floor(size / 12));
      ctx.beginPath();
      ctx.moveTo(x + size * 0.34, y + size * 0.28);
      ctx.lineTo(x + size * 0.62, y + size * 0.72);
      ctx.moveTo(x + size * 0.68, y + size * 0.32);
      ctx.lineTo(x + size * 0.42, y + size * 0.62);
      ctx.stroke();
    } else if (id === BLOCK.STRANGE_PORTAL_RUNE) {
      ctx.strokeStyle = '#9d7ad4';
      ctx.lineWidth = Math.max(1, Math.floor(size / 13));
      ctx.beginPath();
      ctx.moveTo(x + size * 0.28, y + size * 0.72);
      ctx.lineTo(x + size * 0.5, y + size * 0.25);
      ctx.lineTo(x + size * 0.72, y + size * 0.72);
      ctx.moveTo(x + size * 0.38, y + size * 0.52);
      ctx.lineTo(x + size * 0.62, y + size * 0.52);
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#7a5aaa';
      ctx.lineWidth = Math.max(1, Math.floor(size / 16));
      for (let i = 0; i < 5; i += 1) {
        const sx = x + size * (0.18 + rng() * 0.64);
        const sy = y + size * (0.18 + rng() * 0.64);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + (rng() - 0.5) * size * 0.36, sy + (rng() - 0.5) * size * 0.36);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.34)';
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
  }

  function drawBlockTile(ctx, id, faceType, variant, x, y, size) {
    const rng = mulberry32(id * 9973 + variant * 131 + faceType.charCodeAt(0) * 17);
    const base = hexToRgb(BLOCK_COLORS[id] || '#ffffff');
    const kind = blockKind(id);
    const letter = Game.blocks.LETTER_BLOCKS && Game.blocks.LETTER_BLOCKS[id];

    if (id === BLOCK.STRANGE_PORTAL_STONE || id === BLOCK.STRANGE_PORTAL_CORE || id === BLOCK.STRANGE_PORTAL_RUNE || id === BLOCK.ACTIVE_STRANGE_PORTAL) {
      drawStrangePortalTile(ctx, rng, id, x, y, size);
    } else if (id === BLOCK.TNT_TABLE) {
      drawTntTableTile(ctx, rng, x, y, size);
    } else if (id === BLOCK.TNT_REMOTE) {
      drawTntRemoteTile(ctx, rng, x, y, size);
    } else if (id === BLOCK.CUSTOM_TNT || id === BLOCK.DYNAMITE_SMALL || id === BLOCK.DYNAMITE_MEDIUM || id === BLOCK.DYNAMITE_LARGE || id === BLOCK.DYNAMITE_HUGE || id === BLOCK.DYNAMITE_MEGA_HUGE || id === BLOCK.DYNAMITE_POWER_75 || id === BLOCK.DYNAMITE_POWER_100) {
      drawDynamiteTile(ctx, rng, id, x, y, size);
    } else if (id === BLOCK.GRASS) {
      if (faceType === 'top') drawGrassTop(ctx, rng, x, y, size, variant);
      else if (faceType === 'bottom') drawDirt(ctx, rng, x, y, size, { r: 126, g: 84, b: 48 });
      else drawGrassSide(ctx, rng, x, y, size, variant);
    } else if (id === BLOCK.DIRT || id === BLOCK.PATH || id === BLOCK.MUSHROOM_SOIL || id === BLOCK.RED_EARTH || id === BLOCK.SCORCHED_DIRT || id === BLOCK.ASH) {
      drawDirt(ctx, rng, x, y, size, dirtPalette(id));
    } else if (kind === 'stone' || kind === 'ore') {
      drawStoneBase(ctx, rng, x, y, size, stonePalette(id), id === BLOCK.BEDROCK || id === BLOCK.BLACKSTONE || id === BLOCK.DEEPSTONE);
    } else if (kind === 'wood') {
      drawWoodTile(ctx, rng, x, y, size, base, faceType);
    } else if (kind === 'chest') {
      drawChestTile(ctx, rng, id, x, y, size, faceType);
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

    if ((kind === 'soil' || kind === 'soft') && id !== BLOCK.GRASS && id !== BLOCK.DIRT && id !== BLOCK.PATH && id !== BLOCK.MUSHROOM_SOIL && id !== BLOCK.RED_EARTH && id !== BLOCK.SCORCHED_DIRT && id !== BLOCK.ASH) {
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

    if (letter) {
      ctx.fillStyle = 'rgba(42,31,22,0.86)';
      ctx.font = `bold ${Math.max(14, Math.floor(size * 0.62))}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(letter, x + size / 2, y + size / 2 + size * 0.03, size * 0.82);
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
    if (optimizeIcons && size > 0 && size <= 256) {
      const key = `${id}:${size}`;
      let cached = blockIconCache.get(key);
      if (!cached) {
        cached = document.createElement('canvas');
        cached.width = cached.height = Math.ceil(size + 2);
        const previous = optimizeIcons;
        optimizeIcons = false;
        try { drawBlockIcon(cached.getContext('2d'), id, 1, 1, size); }
        finally { optimizeIcons = previous; }
        blockIconCache.set(key, cached);
        if (blockIconCache.size > 128) blockIconCache.delete(blockIconCache.keys().next().value);
      }
      ctx.drawImage(cached, x - 1, y - 1);
      return;
    }
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

  function createSkyTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const vertical = ctx.createLinearGradient(0, 0, 0, canvas.height);
    vertical.addColorStop(0, '#1e73c8');
    vertical.addColorStop(0.28, '#4ea3df');
    vertical.addColorStop(0.58, '#93cfee');
    vertical.addColorStop(0.82, '#dceff6');
    vertical.addColorStop(1, '#f5e2bc');
    ctx.fillStyle = vertical;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const sunX = canvas.width * 0.62;
    const sunY = canvas.height * 0.27;
    let glow = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, canvas.width * 0.42);
    glow.addColorStop(0, 'rgba(255,255,245,0.92)');
    glow.addColorStop(0.1, 'rgba(255,239,188,0.5)');
    glow.addColorStop(0.35, 'rgba(255,210,126,0.18)');
    glow.addColorStop(1, 'rgba(255,210,126,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    glow = ctx.createRadialGradient(canvas.width * 0.5, canvas.height * 1.05, 8, canvas.width * 0.5, canvas.height * 1.05, canvas.width * 0.62);
    glow.addColorStop(0, 'rgba(255,244,210,0.38)');
    glow.addColorStop(0.5, 'rgba(255,244,210,0.18)');
    glow.addColorStop(1, 'rgba(255,244,210,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.globalAlpha = 0.06;
    for (let y = 0; y < canvas.height; y += 2) {
      const t = y / canvas.height;
      ctx.fillStyle = t < 0.55 ? '#ffffff' : '#f8e8c8';
      ctx.fillRect(0, y, canvas.width, 1);
    }
    ctx.globalAlpha = 1;
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    return texture;
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
    if (id === BLOCK.DIRT || id === BLOCK.PATH || id === BLOCK.MUSHROOM_SOIL || id === BLOCK.RED_EARTH || id === BLOCK.SCORCHED_DIRT || id === BLOCK.ASH) return 0;
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
    if (mode === 'lava') return id !== BLOCK.LAVA && id !== BLOCK.VOLCANIC_LAVA;
    return id === BLOCK.AIR || id === BLOCK.WATER || id === BLOCK.HOT_WATER || id === BLOCK.LAVA || id === BLOCK.VOLCANIC_LAVA;
  }

  function isFluidMode(mode) {
    return mode === 'water' || mode === 'lava';
  }

  function waterOpenToSky(state, x, y, z) {
    if (!state || !state.world) return 1;
    for (let yy = y + 1; yy < state.world.h; yy += 1) {
      const id = getBlock3D(state, x, yy, z);
      if (id === BLOCK.AIR || id === BLOCK.WATER || id === BLOCK.HOT_WATER || id === BLOCK.STEAM_WATER) continue;
      if (isSolidBlock3D(id)) return 0;
    }
    return 1;
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
    const height = (id === BLOCK.WATER || id === BLOCK.HOT_WATER || id === BLOCK.LAVA || id === BLOCK.VOLCANIC_LAVA) && corner[1] === 1 ? getFluidSurfaceHeight(state, id, x, y, z) : corner[1];
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

  function isChunkInRenderDistance(entry, playerChunk, renderDistance) {
    const dx = entry.cx - playerChunk.cx;
    const dz = entry.cz - playerChunk.cz;
    return dx * dx + dz * dz <= renderDistance * renderDistance;
  }

  function updateChunkVisibility(state) {
    const playerChunk = getPlayerChunk(state.player);
    const renderDistance = getChunkRenderDistanceValue(state.worldMeta);
    const cacheKey = `${playerChunk.cx},${playerChunk.cz},${renderDistance},${chunkMeshRevision}`;
    if (state.worldMeta && state.worldMeta.superOptimization && visibilityCache
      && visibilityCache.world === state.world && visibilityCache.key === cacheKey) {
      if (debugInfo) Object.assign(debugInfo, visibilityCache.stats);
      return;
    }
    let visibleChunks = 0;
    let visibleMeshes = 0;
    for (const entry of chunkMeshes.values()) {
      const visible = isChunkInRenderDistance(entry, playerChunk, renderDistance);
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
    const stats = { visibleChunks, visibleChunkMeshes: visibleMeshes, renderDistanceChunks: renderDistance };
    visibilityCache = { world: state.world, key: cacheKey, stats };
    if (debugInfo) Object.assign(debugInfo, stats);
  }

  function buildWorldMesh(state, mode = 'solid', bounds = null) {
    const positions = [];
    const normals = [];
    const colors = [];
    const uvs = [];
    const leafWind = [];
    const waterSun = [];
    const indices = [];
    const world = state.world;
    const range = bounds || { minX: 0, minY: 0, minZ: 0, maxX: world.w, maxY: world.h, maxZ: world.d };
    for (let y = range.minY; y < range.maxY; y += 1) {
      for (let z = range.minZ; z < range.maxZ; z += 1) {
        for (let x = range.minX; x < range.maxX; x += 1) {
          const id = getBlock3D(state, x, y, z);
          if (id === BLOCK.AIR) continue;
          const fluidMode = isFluidMode(mode);
          if (mode === 'solid' && (id === BLOCK.WATER || id === BLOCK.HOT_WATER || id === BLOCK.LAVA || id === BLOCK.VOLCANIC_LAVA)) continue;
          if (mode === 'water' && id !== BLOCK.WATER && id !== BLOCK.HOT_WATER) continue;
          if (mode === 'lava' && id !== BLOCK.LAVA && id !== BLOCK.VOLCANIC_LAVA) continue;
          for (const face of faces) {
            const nx = x + face.dir[0];
            const ny = y + face.dir[1];
            const nz = z + face.dir[2];
            const fluidRange = fluidMode ? getFluidFaceRange(state, id, x, y, z, face) : null;
            if (fluidMode && !fluidRange) continue;
            if (!fluidMode && !isNeighborOpen(state, nx, ny, nz, mode)) continue;
            const base = positions.length / 3;
            const color = faceShade(face.shade);
            const leaf = !fluidMode && isLeafBlock(id) ? 1 : 0;
            const sun = mode === 'water' ? waterOpenToSky(state, x, y, z) : 1;
            for (const corner of face.corners) {
              if (fluidMode) pushFluidBlockPosition(positions, x, y, z, corner, fluidRange);
              else pushBlockPosition(positions, id, state, x, y, z, corner);
              normals.push(face.dir[0], face.dir[1], face.dir[2]);
              colors.push(color.r, color.g, color.b);
              leafWind.push(leaf);
              waterSun.push(sun);
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
    geometry.setAttribute('leafWind', new THREE.Float32BufferAttribute(leafWind, 1));
    geometry.setAttribute('waterSun', new THREE.Float32BufferAttribute(waterSun, 1));
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
      const terrainFar = CAMERA_FAR_CHUNKS * CHUNK_SIZE;
      const cameraFar = Math.max(terrainFar, CLOUD_FADE_END + 24);
      scene.fog = new THREE.Fog(SKY_FOG_COLOR, Math.max(24, terrainFar * 0.34), Math.max(48, terrainFar * 0.74));
      camera = new THREE.PerspectiveCamera(72, 1, 0.05, cameraFar);
      scene.add(camera);
      light = new THREE.DirectionalLight(0xffffff, 1.3);
      light.position.set(0.35, 1, 0.45);
      scene.add(light);
      hemiLight = new THREE.HemisphereLight(0xbfe4ff, 0x3e3428, 1.35);
      scene.add(hemiLight);
      skyDome = new THREE.Mesh(
        new THREE.SphereGeometry(180, 32, 16),
        new THREE.MeshBasicMaterial({ map: createSkyTexture(), side: THREE.BackSide, fog: false, depthWrite: false })
      );
      skyDome.visible = false;
      scene.add(skyDome);
      sunMesh = new THREE.Mesh(
        new THREE.SphereGeometry(11, 32, 16),
        new THREE.MeshBasicMaterial({ color: 0xfff0a6, fog: false })
      );
      sunMesh.visible = false;
      scene.add(sunMesh);
      sunGlowMesh = new THREE.Mesh(
        new THREE.SphereGeometry(18, 32, 16),
        new THREE.MeshBasicMaterial({ color: 0xffd67a, transparent: true, opacity: 0.22, fog: false, depthWrite: false })
      );
      sunGlowMesh.visible = false;
      scene.add(sunGlowMesh);
      firstPersonGroup = new THREE.Group();
      firstPersonGroup.visible = false;
      camera.add(firstPersonGroup);
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
      dynamiteOverlayGroup = new THREE.Group();
      dynamiteOverlayGeometry = new THREE.BoxGeometry(1.04, 1.04, 1.04);
      dynamiteOverlayMaterials = [
        new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.34, depthWrite: false }),
        new THREE.MeshBasicMaterial({ color: 0xff3b28, transparent: true, opacity: 0.46, depthWrite: false }),
      ];
      shaderDynamiteOverlayMaterial = new THREE.MeshBasicMaterial({
        color: 0xffb45a,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      scene.add(dynamiteOverlayGroup);
      previewFluidGeometry = new THREE.BoxGeometry(1.02, 1.02, 1.02);
      previewFluidMaterial = new THREE.MeshBasicMaterial({
        color: 0x2f82d0,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
      });
      previewTntMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1, 48, 24),
        new THREE.MeshBasicMaterial({ color: 0xff3b28, transparent: true, opacity: 0.62, wireframe: true, depthWrite: false })
      );
      previewTntMesh.renderOrder = 3;
      previewTntMesh.visible = false;
      scene.add(previewTntMesh);
    }
    return true;
  }

  function updateDynamiteOverlays(state) {
    if (!dynamiteOverlayGroup || !dynamiteOverlayGeometry || !dynamiteOverlayMaterials) return;
    const active = state && state.world && Array.isArray(state.world.activeDynamite) ? state.world.activeDynamite : [];
    while (dynamiteOverlayMeshes.length < active.length) {
      const mesh = new THREE.Mesh(dynamiteOverlayGeometry, dynamiteOverlayMaterials[0]);
      mesh.renderOrder = 4;
      dynamiteOverlayGroup.add(mesh);
      dynamiteOverlayMeshes.push(mesh);
    }
    const now = performance.now() * 0.001;
    const shaders = shaderMode(state);
    for (let i = 0; i < dynamiteOverlayMeshes.length; i += 1) {
      const mesh = dynamiteOverlayMeshes[i];
      const item = active[i];
      if (!item) {
        mesh.visible = false;
        continue;
      }
      const urgent = item.fuse > 0 ? 1 - Math.max(0, Math.min(1, item.timer / item.fuse)) : 1;
      if (shaders && shaderDynamiteOverlayMaterial) {
        const pulseRate = 3.5 + urgent * 12;
        const pulse = 0.5 + 0.5 * Math.sin(now * pulseRate * Math.PI * 2);
        const heat = 0.26 + urgent * 0.42 + pulse * (0.08 + urgent * 0.14);
        const shake = urgent * urgent * 0.035;
        shaderDynamiteOverlayMaterial.color.setRGB(1, 0.42 + urgent * 0.28, 0.12);
        shaderDynamiteOverlayMaterial.opacity = Math.min(0.72, heat);
        mesh.material = shaderDynamiteOverlayMaterial;
        mesh.scale.setScalar(1.02 + urgent * 0.08 + pulse * (0.01 + urgent * 0.04));
        mesh.rotation.set(
          Math.sin(now * 19 + i) * urgent * 0.035,
          Math.cos(now * 17 + i * 2) * urgent * 0.035,
          Math.sin(now * 13 + i * 3) * urgent * 0.025
        );
        mesh.position.set(
          item.x + 0.5 + Math.sin(now * 31 + i) * shake,
          item.y + 0.5 + Math.sin(now * 37 + i) * shake * 0.55,
          item.z + 0.5 + Math.cos(now * 29 + i) * shake
        );
      } else {
        const flash = Math.floor(now * (4 + urgent * 10)) % 2;
        mesh.material = dynamiteOverlayMaterials[flash];
        mesh.material.opacity = flash ? 0.35 + urgent * 0.28 : 0.18 + urgent * 0.18;
        mesh.scale.setScalar(1);
        mesh.rotation.set(0, 0, 0);
        mesh.position.set(item.x + 0.5, item.y + 0.5, item.z + 0.5);
      }
      mesh.visible = true;
    }
  }

  function fluidPreviewColor(fluidId) {
    if (fluidId === BLOCK.LAVA) return 0xff7a1c;
    if (fluidId === BLOCK.HOT_WATER) return 0x2368b8;
    return 0x2f82d0;
  }

  function updatePreviewOverlay(state) {
    if (!scene || !previewFluidGeometry || !previewFluidMaterial || !previewTntMesh) return;
    const preview = state && state.ui ? state.ui.preview : null;
    const fluidVisible = preview && preview.type === 'fluid' && Array.isArray(preview.cells) && preview.cells.length > 0;
    if (fluidVisible) {
      const cells = preview.cells;
      if (!previewFluidMesh || previewFluidCapacity < cells.length) {
        if (previewFluidMesh) {
          scene.remove(previewFluidMesh);
          previewFluidMesh.dispose && previewFluidMesh.dispose();
        }
        previewFluidCapacity = Math.max(cells.length, previewFluidCapacity * 2, 64);
        previewFluidMesh = new THREE.InstancedMesh(previewFluidGeometry, previewFluidMaterial, previewFluidCapacity);
        previewFluidMesh.renderOrder = 3;
        scene.add(previewFluidMesh);
      }
      previewFluidMaterial.color.setHex(fluidPreviewColor(preview.fluidId));
      previewFluidMesh.count = cells.length;
      const matrix = new THREE.Matrix4();
      for (let i = 0; i < cells.length; i += 1) {
        const cell = cells[i];
        matrix.makeTranslation(cell.x + 0.5, cell.y + 0.5, cell.z + 0.5);
        previewFluidMesh.setMatrixAt(i, matrix);
      }
      previewFluidMesh.instanceMatrix.needsUpdate = true;
      previewFluidMesh.visible = true;
    } else if (previewFluidMesh) {
      previewFluidMesh.visible = false;
    }

    if (preview && preview.type === 'tnt') {
      const radius = Math.max(0.5, preview.radius || 1);
      previewTntMesh.position.set(preview.x + 0.5, preview.y + 0.5, preview.z + 0.5);
      previewTntMesh.scale.setScalar(radius);
      previewTntMesh.visible = true;
    } else {
      previewTntMesh.visible = false;
    }
  }

  function skinPalette(id) {
    if (id === 'explorer_female') {
      return {
        skin: 0xefb77f,
        hair: 0x6b4428,
        eye: 0x2aa7ad,
        hoodie: 0x111518,
        accent: 0x25b8c5,
        pants: 0x4c586c,
        shoe: 0x111518,
        denimPatch: 0xd79a67,
      };
    }
    return {
      skin: 0xefb77f,
      hair: 0x4a2f1d,
      eye: 0x1459b5,
      hoodie: 0x111518,
      accent: 0x25b8c5,
      pants: 0x1b2630,
      shoe: 0x111518,
      denimPatch: 0x16202a,
    };
  }

  function makeMat(color, lit = true) {
    return lit
      ? new THREE.MeshLambertMaterial({ color })
      : new THREE.MeshBasicMaterial({ color });
  }

  function addBox(parent, color, size, pos, lit = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), makeMat(color, lit));
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function disposeObject3D(root) {
    if (!root) return;
    root.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((mat) => {
          if (mat.map) mat.map.dispose && mat.map.dispose();
          mat.dispose && mat.dispose();
        });
      }
    });
  }

  function disposePlayerModel() {
    if (playerModel) {
      scene.remove(playerModel);
      disposeObject3D(playerModel);
      playerModel = null;
      playerModelSkin = '';
    }
  }

  function buildPlayerModel(skinId) {
    const p = skinPalette(skinId);
    const root = new THREE.Group();
    addBox(root, p.pants, [0.32, 0.78, 0.28], [-0.18, 0.39, 0]);
    addBox(root, p.pants, [0.32, 0.78, 0.28], [0.18, 0.39, 0]);
    if (skinId === 'explorer_female') {
      addBox(root, p.denimPatch, [0.13, 0.12, 0.03], [-0.18, 0.52, 0.155]);
      addBox(root, p.denimPatch, [0.13, 0.12, 0.03], [0.18, 0.52, 0.155]);
    }
    addBox(root, 0xf4f4f4, [0.34, 0.09, 0.3], [-0.18, 0.03, -0.03]);
    addBox(root, 0xf4f4f4, [0.34, 0.09, 0.3], [0.18, 0.03, -0.03]);
    addBox(root, p.accent, [0.22, 0.05, 0.31], [-0.18, 0.12, -0.02]);
    addBox(root, p.accent, [0.22, 0.05, 0.31], [0.18, 0.12, -0.02]);
    addBox(root, p.hoodie, [0.72, 0.82, 0.32], [0, 1.14, 0]);
    addBox(root, p.accent, [0.07, 0.54, 0.035], [-0.12, 1.22, 0.18]);
    addBox(root, p.accent, [0.07, 0.3, 0.035], [0.1, 1.05, 0.18]);
    addBox(root, p.accent, [0.28, 0.08, 0.035], [0.1, 1.24, -0.18]);
    addBox(root, p.hoodie, [0.24, 0.76, 0.26], [-0.52, 1.12, 0]);
    addBox(root, p.hoodie, [0.24, 0.76, 0.26], [0.52, 1.12, 0]);
    addBox(root, p.accent, [0.25, 0.08, 0.27], [-0.52, 0.84, 0]);
    addBox(root, p.accent, [0.25, 0.08, 0.27], [0.52, 0.84, 0]);
    addBox(root, p.accent, [0.2, 0.09, 0.035], [-0.52, 1.26, 0.15]);
    addBox(root, p.accent, [0.2, 0.09, 0.035], [0.52, 1.26, 0.15]);
    addBox(root, p.skin, [0.24, 0.14, 0.25], [-0.52, 0.72, 0]);
    addBox(root, p.skin, [0.24, 0.14, 0.25], [0.52, 0.72, 0]);
    addBox(root, p.skin, [0.52, 0.52, 0.52], [0, 1.82, 0]);
    addBox(root, p.hair, [0.58, 0.2, 0.58], [0, 2.1, 0]);
    addBox(root, p.hair, [0.14, skinId === 'explorer_female' ? 0.82 : 0.34, 0.56], [-0.28, skinId === 'explorer_female' ? 1.72 : 1.89, 0]);
    addBox(root, p.hair, [0.14, skinId === 'explorer_female' ? 0.82 : 0.34, 0.56], [0.28, skinId === 'explorer_female' ? 1.72 : 1.89, 0]);
    addBox(root, p.hair, [0.48, skinId === 'explorer_female' ? 0.88 : 0.42, 0.1], [0, skinId === 'explorer_female' ? 1.66 : 1.88, -0.3]);
    addBox(root, p.hair, [0.44, 0.18, 0.08], [-0.08, 1.98, 0.3]);
    addBox(root, p.hair, [0.18, 0.22, 0.08], [-0.22, 1.88, 0.3]);
    addBox(root, p.hair, [0.16, 0.18, 0.08], [0.22, 1.9, 0.3]);
    if (skinId === 'explorer_female') {
      addBox(root, p.accent, [0.22, 0.14, 0.08], [0.2, 2.08, -0.31]);
      addBox(root, p.accent, [0.22, 0.16, 0.04], [0.16, 1.84, -0.31]);
    }
    addBox(root, 0xffffff, [0.12, 0.12, 0.035], [-0.13, 1.84, 0.275], false);
    addBox(root, 0xffffff, [0.12, 0.12, 0.035], [0.13, 1.84, 0.275], false);
    addBox(root, p.eye, [0.055, 0.11, 0.04], [-0.11, 1.84, 0.3], false);
    addBox(root, p.eye, [0.055, 0.11, 0.04], [0.15, 1.84, 0.3], false);
    scene.add(root);
    playerModelSkin = skinId;
    return root;
  }

  function ensurePlayerModel(state) {
    if (!shaderMode(state)) {
      if (playerModel) playerModel.visible = false;
      return null;
    }
    const skin = state.worldMeta && state.worldMeta.playerSkin ? state.worldMeta.playerSkin : 'explorer';
    if (!playerModel || playerModelSkin !== skin) {
      disposePlayerModel();
      playerModel = buildPlayerModel(skin);
    }
    return playerModel;
  }

  function setPlayerModelShadowOnly(root, shadowOnly) {
    if (!root) return;
    root.traverse((child) => {
      if (!child.material) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        material.colorWrite = !shadowOnly;
        material.depthWrite = !shadowOnly;
        material.needsUpdate = true;
      }
      child.castShadow = true;
      child.receiveShadow = !shadowOnly;
    });
  }

  function buildFirstPersonHands(state) {
    if (!firstPersonGroup) return;
    firstPersonGroup.clear();
    firstPersonItem = null;
    const p = skinPalette(state && state.worldMeta ? state.worldMeta.playerSkin : 'explorer');
    const leftSleeve = addBox(firstPersonGroup, p.hoodie, [0.1, 0.1, 0.58], [-0.82, -0.78, -0.95], false);
    leftSleeve.rotation.set(-0.5, -0.2, 0.08);
    const rightSleeve = addBox(firstPersonGroup, p.hoodie, [0.1, 0.1, 0.58], [0.82, -0.78, -0.95], false);
    rightSleeve.rotation.set(-0.5, 0.2, -0.08);
    addBox(firstPersonGroup, p.accent, [0.11, 0.11, 0.06], [-0.76, -0.58, -1.2], false);
    addBox(firstPersonGroup, p.accent, [0.11, 0.11, 0.06], [0.76, -0.58, -1.2], false);
    addBox(firstPersonGroup, p.skin, [0.1, 0.1, 0.11], [-0.74, -0.55, -1.28], false);
    addBox(firstPersonGroup, p.skin, [0.1, 0.1, 0.11], [0.74, -0.55, -1.28], false);
    firstPersonGroup.traverse((child) => {
      child.castShadow = false;
      child.receiveShadow = false;
    });
  }

  function selectedStack(state) {
    return Game.inventory3d && Game.inventory3d.getSelectedHotbarStack
      ? Game.inventory3d.getSelectedHotbarStack(state)
      : null;
  }

  function updateFirstPersonItem(state) {
    if (!firstPersonGroup) return;
    const stack = selectedStack(state);
    const itemId = stack ? stack.id : 0;
    if (firstPersonItem && firstPersonItem.userData.itemId === itemId) return;
    if (firstPersonItem) {
      firstPersonGroup.remove(firstPersonItem);
      disposeObject3D(firstPersonItem);
      firstPersonItem = null;
    }
    if (heldItemTexture) {
      if (Array.isArray(heldItemTexture)) heldItemTexture.forEach((texture) => texture.dispose && texture.dispose());
      else heldItemTexture.dispose();
      heldItemTexture = null;
    }
    if (!stack) return;
    const item = Game.interaction3d && Game.interaction3d.ITEM;
    const block = Game.blocks && Game.blocks.BLOCK;
    const colors = Game.blocks && Game.blocks.BLOCK_COLORS ? Game.blocks.BLOCK_COLORS : {};
    const group = new THREE.Group();
    group.userData.itemId = itemId;
    if (item && itemId === item.MAP) {
      addBox(group, 0xd9bf82, [0.22, 0.018, 0.17], [0, 0, 0], false);
      addBox(group, 0x5f9d63, [0.06, 0.02, 0.04], [-0.04, 0.014, -0.02], false);
      addBox(group, 0x4d8fbd, [0.06, 0.02, 0.04], [0.045, 0.014, 0.015], false);
    } else if (!block || itemId !== block.AIR) {
      let blockId = itemId;
      if (item && itemId === item.FILLED_CHEST) blockId = block.CHEST;
      if (item && itemId === item.FILLED_STONE_CHEST) blockId = block.STONE_CHEST;
      const materials = createHeldBlockMaterials(blockId);
      heldItemTexture = materials.map((material) => material.map).filter(Boolean);
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), materials);
      cube.rotation.set(0.28, 0.55, 0.08);
      group.add(cube);
    }
    group.position.set(0.67, -0.53, -1.24);
    group.rotation.set(-0.22, 0.24, 0.06);
    firstPersonGroup.add(group);
    firstPersonItem = group;
  }

  function createBlockFaceTexture(blockId, faceType) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    drawBlockTile(ctx, blockId, faceType, 0, 0, 0, canvas.width);
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
  }

  function createHeldBlockMaterial(blockId, faceType, shade = 1) {
    const texture = createBlockFaceTexture(blockId, faceType);
    return new THREE.MeshBasicMaterial({ map: texture, color: new THREE.Color(shade, shade, shade) });
  }

  function createHeldBlockMaterials(blockId) {
    return [
      createHeldBlockMaterial(blockId, 'side', 0.86),
      createHeldBlockMaterial(blockId, 'side', 0.72),
      createHeldBlockMaterial(blockId, 'top', 1),
      createHeldBlockMaterial(blockId, 'bottom', 0.56),
      createHeldBlockMaterial(blockId, 'side', 0.9),
      createHeldBlockMaterial(blockId, 'side', 0.8),
    ];
  }

  function resolveThirdPersonCamera(state, target, desired) {
    if (!state || !state.world || !isSolidBlock3D) return desired;
    const dir = new THREE.Vector3().subVectors(desired, target);
    const distance = dir.length();
    if (distance <= 0.1) return desired;
    dir.normalize();
    const step = 0.18;
    let lastClear = target.clone();
    for (let d = 0.35; d <= distance; d += step) {
      const p = target.clone().addScaledVector(dir, d);
      const id = getBlock3D(state, Math.floor(p.x), Math.floor(p.y), Math.floor(p.z));
      if (isSolidBlock3D(id)) {
        return lastClear.addScaledVector(dir, -0.12);
      }
      lastClear = p;
    }
    return desired;
  }

  function applyThirdPersonCamera(state, player, mode, playerScale, look) {
    const target = new THREE.Vector3(player.x, player.y + 1.35 * playerScale, player.z);
    const eye = new THREE.Vector3(player.x, player.y + EYE_HEIGHT * playerScale, player.z);
    const radius = mode === 'second' ? 5.2 : 4.2;
    const sign = mode === 'second' ? -1 : 1;
    const desired = eye.clone().addScaledVector(look, sign * radius);
    if (mode === 'second') desired.y += 0.18;
    else desired.y += 0.45;
    const resolved = resolveThirdPersonCamera(state, target, desired);
    camera.position.copy(resolved);
    camera.lookAt(target);
  }

  function ensureMaterials() {
    if (!solidMaterial) {
      solidMaterial = new THREE.MeshBasicMaterial({ map: createTextureAtlas(), vertexColors: true, side: THREE.DoubleSide });
    }
    if (!shaderSolidMaterial) {
      shaderSolidMaterial = new THREE.MeshLambertMaterial({ map: createTextureAtlas(), vertexColors: true, side: THREE.DoubleSide });
      shaderSolidUniforms = { time: { value: 0 } };
      shaderSolidMaterial.onBeforeCompile = (shader) => {
        shader.uniforms.leafTime = shaderSolidUniforms.time;
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nattribute float leafWind;\nuniform float leafTime;')
          .replace('#include <begin_vertex>', `
            #include <begin_vertex>
            if (leafWind > 0.5) {
              float sway = sin(leafTime * 3.0 + position.x * 0.71 + position.z * 0.53 + position.y * 0.37) * 0.075;
              float flutter = sin(leafTime * 5.2 + position.x * 1.31 + position.z * 1.17) * 0.025;
              transformed.x += sway;
              transformed.z += cos(leafTime * 2.5 + position.x * 0.43 + position.z * 0.61) * 0.055;
              transformed.y += flutter;
            }
          `);
      };
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
    if (!shaderWaterMaterial) {
      shaderWaterMaterial = new THREE.MeshPhongMaterial({
        map: createWaterTexture(),
        color: 0x4bb2e6,
        specular: 0xfff2b2,
        shininess: 82,
        side: THREE.FrontSide,
        transparent: true,
        opacity: 0.68,
        depthWrite: false,
      });
      shaderWaterMaterial.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nattribute float waterSun;\nvarying float vWaterSun;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWaterSun = waterSun;');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying float vWaterSun;')
          .replace('#include <lights_fragment_end>', `
            #include <lights_fragment_end>
            float sunAccess = clamp(vWaterSun, 0.0, 1.0);
            reflectedLight.directSpecular *= sunAccess;
            reflectedLight.indirectSpecular *= mix(0.05, 1.0, sunAccess);
            reflectedLight.directDiffuse *= mix(0.54, 1.0, sunAccess);
            reflectedLight.indirectDiffuse *= mix(0.62, 1.0, sunAccess);
          `)
          .replace('#include <output_fragment>', `
            float sunAccessOut = clamp(vWaterSun, 0.0, 1.0);
            outgoingLight = mix(outgoingLight * vec3(0.34, 0.48, 0.58), outgoingLight, sunAccessOut);
            #include <output_fragment>
          `);
      };
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
    if (!shaderLavaMaterial) {
      shaderLavaMaterial = new THREE.MeshBasicMaterial({
        map: createLavaTexture(),
        color: 0x6e2416,
        side: THREE.FrontSide,
        transparent: true,
        opacity: 0.94,
        depthWrite: false,
      });
    }
  }

  function shaderMode(state) {
    return !!(state && state.worldMeta && state.worldMeta.shadersEnabled);
  }

  function mixHexColor(a, b, t) {
    const ar = (a >> 16) & 255;
    const ag = (a >> 8) & 255;
    const ab = a & 255;
    const br = (b >> 16) & 255;
    const bg = (b >> 8) & 255;
    const bb = b & 255;
    const k = Math.max(0, Math.min(1, t));
    return ((ar + (br - ar) * k) << 16) | ((ag + (bg - ag) * k) << 8) | (ab + (bb - ab) * k);
  }

  function applyVolcanicAtmosphere(state) {
    if (!renderer || !scene || !scene.fog) return;
    const enabled = shaderMode(state);
    const baseSky = enabled ? 0x9bd4f0 : SKY_COLOR;
    const baseFog = enabled ? 0x9bd4f0 : SKY_FOG_COLOR;
    const player = state && state.player ? state.player : { x: 0, z: 0 };
    const influence = Game.generation3d && Game.generation3d.getVolcanicSkyInfluence3D
      ? Game.generation3d.getVolcanicSkyInfluence3D(state, player.x || 0, player.z || 0)
      : 0;
    const sky = mixHexColor(baseSky, ERUPTION_SKY_COLOR, influence);
    const fog = mixHexColor(baseFog, ERUPTION_FOG_COLOR, influence);
    renderer.setClearColor(sky, 1);
    scene.background = new THREE.Color(sky);
    scene.fog.color.setHex(fog);
    if (skyDome && skyDome.material && skyDome.material.color) skyDome.material.color.setHex(mixHexColor(0xffffff, ERUPTION_SKY_COLOR, influence));
  }

  function materialForMode(state, mode) {
    const shaders = shaderMode(state);
    if (mode === 'water') return shaders ? shaderWaterMaterial : waterMaterial;
    if (mode === 'lava') return shaders ? shaderLavaMaterial : lavaMaterial;
    return shaders ? shaderSolidMaterial : solidMaterial;
  }

  function applyShaderProfile(state) {
    if (!renderer || !scene || !light || !hemiLight) return;
    const enabled = shaderMode(state);
    const shadows = enabled && !(Game.performance3d && Game.performance3d.isMobileOptimization3D(state));
    renderer.shadowMap.enabled = shadows;
    light.castShadow = shadows;
    if (shaderProfileEnabled === enabled) return;
    shaderProfileEnabled = enabled;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(enabled ? 0x9bd4f0 : SKY_COLOR, 1);
    scene.background = new THREE.Color(enabled ? 0x9bd4f0 : SKY_COLOR);
    if (skyDome) skyDome.visible = enabled;
    const terrainFar = CAMERA_FAR_CHUNKS * CHUNK_SIZE;
    scene.fog = enabled
      ? new THREE.Fog(0x9bd4f0, Math.max(30, terrainFar * 0.42), Math.max(58, terrainFar * 0.82))
      : new THREE.Fog(SKY_FOG_COLOR, Math.max(24, terrainFar * 0.34), Math.max(48, terrainFar * 0.74));
    light.color.setHex(enabled ? 0xfff0c4 : 0xffffff);
    light.intensity = enabled ? 1.85 : 1.3;
    hemiLight.color.setHex(enabled ? 0xcdefff : 0xbfe4ff);
    hemiLight.groundColor.setHex(enabled ? 0x5c4a36 : 0x3e3428);
    hemiLight.intensity = enabled ? 0.78 : 1.35;
    if (enabled) {
      light.shadow.mapSize.width = 1024;
      light.shadow.mapSize.height = 1024;
      light.shadow.camera.near = 1;
      light.shadow.camera.far = 96;
      light.shadow.camera.left = -34;
      light.shadow.camera.right = 34;
      light.shadow.camera.top = 34;
      light.shadow.camera.bottom = -34;
      light.shadow.bias = -0.0007;
    }
    for (const entry of chunkMeshes.values()) {
      for (const mode of ['solid', 'water', 'lava']) {
        if (!entry[mode]) continue;
        entry[mode].material = materialForMode(state, mode);
        entry[mode].castShadow = enabled && mode === 'solid';
        entry[mode].receiveShadow = enabled && mode === 'solid';
      }
    }
    applyCloudShaderGeometry(enabled);
    for (const cell of cloudCells) cell.key = '';
    cloudCellMap.clear();
  }

  function applyCloudShaderGeometry(enabled) {
    if (!cloudCells.length || !cloudPuffGeometry) return;
    if (!shaderCloudPuffGeometry) shaderCloudPuffGeometry = new THREE.BoxGeometry(1, 1, 1, 2, 1, 2);
    const geometry = enabled ? shaderCloudPuffGeometry : cloudPuffGeometry;
    for (const cell of cloudCells) {
      for (const cloud of cell.clouds) {
        cloud.material.color.setHex(enabled ? 0xf6fbff : 0xffffff);
        cloud.material.opacity = enabled ? 0.82 : 0.72;
        for (const puff of cloud.puffs) puff.geometry = geometry;
      }
    }
  }

  function updateFluidTextureAnimation() {
    const time = performance.now() * 0.001;
    if (shaderSolidUniforms) shaderSolidUniforms.time.value = time;
    if (waterTexture) waterTexture.offset.set((time * 0.045) % 1, (time * 0.025) % 1);
    if (lavaTexture) lavaTexture.offset.set((time * 0.035) % 1, (time * 0.055) % 1);
    if (shaderWaterMaterial) shaderWaterMaterial.shininess = 72 + Math.sin(time * 1.8) * 18;
    if (shaderLavaMaterial) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 2.1);
      shaderLavaMaterial.color.setRGB(0.34 + pulse * 0.12, 0.1 + pulse * 0.04, 0.055);
    }
  }

  function createSkyLayer() {
    if (skyGroup || !window.THREE) return;
    skyGroup = new THREE.Group();
    cloudMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.72,
      fog: false,
      depthWrite: false,
    });
    cloudPuffGeometry = new THREE.BoxGeometry(1, 1, 1);
    cloudCells = [];
    cloudCellMap = new Map();
    cloudDriftX = 0;
    cloudDriftZ = 0;
    cloudWindX = 0;
    cloudWindZ = 0;
    cloudLastUpdateTime = 0;
    const cellsPerAxis = CLOUD_GRID_RADIUS * 2 + 1;
    for (let i = 0; i < cellsPerAxis * cellsPerAxis; i += 1) {
      const cell = { key: '', group: new THREE.Group(), clouds: [] };
      for (let c = 0; c < CLOUDS_PER_CELL; c += 1) {
        const cloud = new THREE.Group();
        const material = cloudMaterial.clone();
        const puffs = [];
        for (let p = 0; p < CLOUD_PUFFS_PER_CLOUD; p += 1) {
          const puff = new THREE.Mesh(cloudPuffGeometry, material);
          cloud.add(puff);
          puffs.push(puff);
        }
        cell.group.add(cloud);
        cell.clouds.push({ group: cloud, material, puffs });
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

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep(t) {
    const v = Math.max(0, Math.min(1, t));
    return v * v * (3 - 2 * v);
  }

  function cloudProfileForTime(time) {
    const cycle = Math.floor(time / CLOUD_WEATHER_CYCLE);
    const fraction = (time / CLOUD_WEATHER_CYCLE) - cycle;
    const a = cloudProfileForCycle(cycle);
    const b = cloudProfileForCycle(cycle + 1);
    const t = smoothstep(fraction);
    return {
      density: lerp(a.density, b.density, t),
      minClouds: Math.round(lerp(a.minClouds, b.minClouds, t)),
      opacity: lerp(a.opacity, b.opacity, t),
    };
  }

  function cloudWindForCycle(cycle) {
    const rng = mulberry32(0x6e624eb7 ^ Math.imul(cycle + 31, 2246822519));
    const angle = rng() * Math.PI * 2;
    const speed = 0.42 + rng() * 0.42;
    return { x: Math.cos(angle) * speed, z: Math.sin(angle) * speed };
  }

  function updateCloudWind(time) {
    const cycle = Math.floor(time / CLOUD_WIND_CYCLE);
    const target = cloudWindForCycle(cycle);
    if (cloudLastUpdateTime === 0) {
      cloudWindX = target.x;
      cloudWindZ = target.z;
      cloudLastUpdateTime = time;
      return;
    }
    const dt = Math.max(0, Math.min(0.25, time - cloudLastUpdateTime));
    cloudLastUpdateTime = time;
    const blend = 1 - Math.exp(-dt * 0.035);
    cloudWindX = lerp(cloudWindX, target.x, blend);
    cloudWindZ = lerp(cloudWindZ, target.z, blend);
    cloudDriftX += cloudWindX * dt;
    cloudDriftZ += cloudWindZ * dt;
  }

  function cloudCellSeed(cx, cz) {
    let seed = Math.imul(cx + 4099, 374761393) ^ Math.imul(cz - 8191, 668265263);
    return seed >>> 0;
  }

  function rebuildCloudCell(cell, cx, cz) {
    const key = `${cx}:${cz}`;
    if (cell.key === key) return;
    cell.key = key;
    const rng = mulberry32(cloudCellSeed(cx, cz));
    for (let i = 0; i < cell.clouds.length; i += 1) {
      const cloud = cell.clouds[i];
      cloud.weatherRoll = rng();
      cloud.group.visible = true;
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
        const shaderCloud = shaderProfileEnabled;
        puff.scale.set(
          (shaderCloud ? 14 : 11) + rng() * (shaderCloud ? 16 : 12) + Math.max(0, centerBias) * (shaderCloud ? 11 : 8),
          (shaderCloud ? 1.05 : 1.8) + rng() * (shaderCloud ? 1.1 : 1.8) + Math.max(0, centerBias) * (shaderCloud ? 0.55 : 0.9),
          (shaderCloud ? 8 : 6) + rng() * (shaderCloud ? 10 : 8) + Math.max(0, centerBias) * (shaderCloud ? 6 : 4)
        );
      }
    }
  }

  function applyCloudProfile(cell, profile, player) {
    if (!cell) return;
    const eyeY = player ? player.y + EYE_HEIGHT : 0;
    for (let i = 0; i < cell.clouds.length; i += 1) {
      const cloud = cell.clouds[i];
      const weatherVisible = cloud.weatherRoll < profile.density || i < profile.minClouds;
      const wx = cell.group.position.x + cloud.group.position.x - (player ? player.x : 0);
      const wy = cloud.group.position.y - eyeY;
      const wz = cell.group.position.z + cloud.group.position.z - (player ? player.z : 0);
      const distance = Math.sqrt(wx * wx + wy * wy + wz * wz);
      const fade = 1 - smoothstep((distance - CLOUD_FADE_START) / (CLOUD_FADE_END - CLOUD_FADE_START));
      cloud.material.opacity = profile.opacity * Math.max(0, Math.min(1, fade));
      cloud.group.visible = weatherVisible && cloud.material.opacity > 0.02;
    }
  }

  function assignCloudCell(key, usedCells, reservedCells) {
    const existing = cloudCellMap.get(key);
    if (existing && !usedCells.has(existing)) return existing;
    let cell = cloudCells.find((item) => !usedCells.has(item) && !reservedCells.has(item));
    if (!cell) cell = cloudCells.find((item) => !usedCells.has(item));
    if (!cell) return null;
    if (cell.key && cloudCellMap.get(cell.key) === cell) cloudCellMap.delete(cell.key);
    cloudCellMap.set(key, cell);
    return cell;
  }

  function updateSkyLayer(player) {
    if (!skyGroup || !player) return;
    const time = performance.now() * 0.001;
    updateCloudWind(time);
    const baseProfile = cloudProfileForTime(time);
    const profile = shaderProfileEnabled
      ? { ...baseProfile, opacity: Math.min(0.9, baseProfile.opacity + 0.08), density: Math.min(1, baseProfile.density + 0.08) }
      : baseProfile;
    cloudMaterial.opacity = profile.opacity;
    const centerX = Math.floor((player.x + cloudDriftX) / CLOUD_CELL_SIZE);
    const centerZ = Math.floor((player.z + cloudDriftZ) / CLOUD_CELL_SIZE);
    const needed = [];
    const reservedCells = new Set();
    for (let dz = -CLOUD_GRID_RADIUS; dz <= CLOUD_GRID_RADIUS; dz += 1) {
      for (let dx = -CLOUD_GRID_RADIUS; dx <= CLOUD_GRID_RADIUS; dx += 1) {
        const cx = centerX + dx;
        const cz = centerZ + dz;
        const key = `${cx}:${cz}`;
        const existing = cloudCellMap.get(key);
        if (existing) reservedCells.add(existing);
        needed.push({ cx, cz, key });
      }
    }
    const usedCells = new Set();
    const usedKeys = new Set();
    for (const item of needed) {
      const cell = assignCloudCell(item.key, usedCells, reservedCells);
      if (!cell) continue;
      usedCells.add(cell);
      usedKeys.add(item.key);
      rebuildCloudCell(cell, item.cx, item.cz);
      cell.group.visible = true;
      cell.group.position.set(item.cx * CLOUD_CELL_SIZE - cloudDriftX, 0, item.cz * CLOUD_CELL_SIZE - cloudDriftZ);
      applyCloudProfile(cell, profile, player);
    }
    for (const cell of cloudCells) {
      if (!usedCells.has(cell)) cell.group.visible = false;
    }
    for (const key of Array.from(cloudCellMap.keys())) {
      if (!usedKeys.has(key)) cloudCellMap.delete(key);
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
    const generation = Game.generation3d;
    const vents = generation && generation.getActiveVolcanicVents3D ? generation.getActiveVolcanicVents3D(state) : [];
    for (const vent of vents) {
      if (Math.abs(vent.x - px) > STEAM_GEYSER_SCAN_RADIUS + 16) continue;
      if (Math.abs(vent.z - pz) > STEAM_GEYSER_SCAN_RADIUS + 16) continue;
      if (Math.abs(vent.y - py) > 28) continue;
      geysers.push(vent);
      if (geysers.length >= 32) return geysers;
    }
    return geysers;
  }

  function spawnSteamParticle(geyser) {
    const particle = steamParticles.find((item) => !item.active);
    if (!particle) return;
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * (geyser.volcanic ? Math.max(0.45, (geyser.radius || 2.4) * 0.45) : 0.28);
    particle.active = true;
    particle.baseY = geyser.y + 0.9;
    particle.maxHeight = geyser.volcanic ? Math.max(8, Math.min(16, geyser.height || 15)) : Math.max(1, Math.min(7, geyser.height || 1));
    particle.x = geyser.x + 0.5 + Math.cos(angle) * radius;
    particle.y = particle.baseY;
    particle.z = geyser.z + 0.5 + Math.sin(angle) * radius;
    particle.vx = (Math.random() - 0.5) * (geyser.volcanic ? 0.22 : 0.12);
    particle.vy = (geyser.volcanic ? 1.05 : 0.65) + particle.maxHeight * (geyser.volcanic ? 0.2 : 0.16) + Math.random() * 0.35;
    particle.vz = (Math.random() - 0.5) * (geyser.volcanic ? 0.22 : 0.12);
    particle.life = Math.max(1, particle.maxHeight / Math.max(0.1, particle.vy)) + Math.random() * 0.25;
    particle.age = 0;
    particle.mesh.visible = true;
    particle.mesh.scale.setScalar((geyser.volcanic ? 1.05 : 0.7) + Math.random() * (geyser.volcanic ? 1.05 : 0.8));
  }

  function updateSteamParticles(state) {
    ensureSteamParticles();
    if (!steamGroup) return;
    const now = performance.now() * 0.001;
    const dt = Math.min(0.05, lastSteamUpdate ? now - lastSteamUpdate : 0);
    lastSteamUpdate = now;
    const geysers = collectVisibleGeysers(state);
    if (geysers.length > 0 && !state.pause.open) {
      const volcanic = geysers.filter((geyser) => geyser.volcanic);
      const spawnCount = Math.min(geysers.length * 2 + volcanic.length * 8, 16);
      for (let i = 0; i < spawnCount; i += 1) {
        const source = volcanic.length && Math.random() < 0.7
          ? volcanic[Math.floor(Math.random() * volcanic.length)]
          : geysers[Math.floor(Math.random() * geysers.length)];
        if (!source.volcanic && Math.random() > 0.72) continue;
        spawnSteamParticle(source);
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

  function ensureLavaEmbers() {
    if (lavaEmberGroup || !window.THREE || !scene) return;
    lavaEmberGroup = new THREE.Group();
    lavaEmberMaterial = new THREE.MeshBasicMaterial({
      color: 0xff8a24,
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
    });
    lavaEmberGeometry = new THREE.BoxGeometry(0.055, 0.055, 0.055);
    lavaEmbers = [];
    for (let i = 0; i < LAVA_EMBER_LIMIT; i += 1) {
      const mesh = new THREE.Mesh(lavaEmberGeometry, lavaEmberMaterial);
      mesh.visible = false;
      lavaEmberGroup.add(mesh);
      lavaEmbers.push({ mesh, active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 0 });
    }
    scene.add(lavaEmberGroup);
  }

  function collectNearbyLava(state) {
    const cells = [];
    if (!state || !state.player || !state.world) return cells;
    const px = Math.floor(state.player.x);
    const py = Math.floor(state.player.y);
    const pz = Math.floor(state.player.z);
    const radius = LAVA_EMBER_SCAN_RADIUS;
    const minY = Math.max(0, py - 8);
    const maxY = Math.min(state.world.h - 1, py + 8);
    for (let y = minY; y <= maxY; y += 1) {
      for (let z = pz - radius; z <= pz + radius; z += 1) {
        for (let x = px - radius; x <= px + radius; x += 1) {
          if (Math.abs(x - px) + Math.abs(z - pz) > radius) continue;
          if (getBlock3D(state, x, y, z) !== BLOCK.LAVA && getBlock3D(state, x, y, z) !== BLOCK.VOLCANIC_LAVA) continue;
          if (getBlock3D(state, x, y + 1, z) !== BLOCK.AIR) continue;
          cells.push({ x, y, z });
          if (cells.length >= 36) return cells;
        }
      }
    }
    return cells;
  }

  function spawnLavaEmber(cell) {
    const ember = lavaEmbers.find((item) => !item.active);
    if (!ember) return;
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 0.34;
    ember.active = true;
    ember.x = cell.x + 0.5 + Math.cos(angle) * radius;
    ember.y = cell.y + 0.92;
    ember.z = cell.z + 0.5 + Math.sin(angle) * radius;
    ember.vx = (Math.random() - 0.5) * 0.24;
    ember.vy = 0.55 + Math.random() * 0.75;
    ember.vz = (Math.random() - 0.5) * 0.24;
    ember.age = 0;
    ember.life = 0.45 + Math.random() * 0.55;
    ember.mesh.visible = true;
    ember.mesh.scale.setScalar(0.7 + Math.random() * 0.9);
  }

  function updateLavaEmbers(state) {
    ensureLavaEmbers();
    if (!lavaEmberGroup) return;
    const enabled = shaderMode(state);
    lavaEmberGroup.visible = enabled;
    const now = performance.now() * 0.001;
    const dt = Math.min(0.05, lastLavaEmberUpdate ? now - lastLavaEmberUpdate : 0);
    lastLavaEmberUpdate = now;
    if (enabled && !state.pause.open && Math.random() > 0.62) {
      const cells = collectNearbyLava(state);
      if (cells.length) spawnLavaEmber(cells[Math.floor(Math.random() * cells.length)]);
    }
    for (const ember of lavaEmbers) {
      if (!ember.active) continue;
      ember.age += dt;
      if (ember.age >= ember.life || !enabled) {
        ember.active = false;
        ember.mesh.visible = false;
        continue;
      }
      ember.vy -= 0.6 * dt;
      ember.x += ember.vx * dt;
      ember.y += ember.vy * dt;
      ember.z += ember.vz * dt;
      const fade = 1 - ember.age / Math.max(0.1, ember.life);
      ember.mesh.position.set(ember.x, ember.y, ember.z);
      ember.mesh.scale.setScalar(Math.max(0.2, fade) * 0.9);
    }
  }

  function ensureExplosionMushrooms() {
    if (explosionMushroomGroup || !window.THREE || !scene) return;
    explosionMushroomGroup = new THREE.Group();
    explosionMushroomStemGeometry = new THREE.CylinderGeometry(0.34, 0.18, 1, 10, 1);
    explosionMushroomCapGeometry = new THREE.SphereGeometry(1, 16, 10);
    explosionMushroomFlashGeometry = new THREE.SphereGeometry(1, 16, 8);
    explosionMushroomRingGeometry = new THREE.TorusGeometry(1, 0.055, 8, 24);
    scene.add(explosionMushroomGroup);
  }

  function createExplosionMushroomMesh() {
    const root = new THREE.Group();
    const flash = new THREE.Mesh(
      explosionMushroomFlashGeometry,
      new THREE.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    const stem = new THREE.Mesh(
      explosionMushroomStemGeometry,
      new THREE.MeshBasicMaterial({ color: 0x8b8172, transparent: true, opacity: 0.58, depthWrite: false })
    );
    const cap = new THREE.Mesh(
      explosionMushroomCapGeometry,
      new THREE.MeshBasicMaterial({ color: 0x6f695f, transparent: true, opacity: 0.62, depthWrite: false })
    );
    const glow = new THREE.Mesh(
      explosionMushroomCapGeometry,
      new THREE.MeshBasicMaterial({ color: 0xff7b2c, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    const ring = new THREE.Mesh(
      explosionMushroomRingGeometry,
      new THREE.MeshBasicMaterial({ color: 0xb7aca0, transparent: true, opacity: 0.35, depthWrite: false })
    );
    root.add(flash);
    root.add(stem);
    root.add(cap);
    root.add(glow);
    root.add(ring);
    root.userData = { flash, stem, cap, glow, ring };
    root.visible = false;
    explosionMushroomGroup.add(root);
    return root;
  }

  function explosionMushroomSize(radius) {
    const value = Math.max(1, Number(radius) || 1);
    const log = Math.log10(value + 1);
    return Math.max(1.6, Math.min(140, 1.4 + log * log * 3.5));
  }

  function updateExplosionMushrooms(state) {
    ensureExplosionMushrooms();
    if (!explosionMushroomGroup) return;
    const enabled = shaderMode(state);
    explosionMushroomGroup.visible = enabled;
    const effects = state && state.world && Array.isArray(state.world.explosionEffects) ? state.world.explosionEffects : [];
    const now = performance.now() * 0.001;
    const dt = Math.min(0.05, lastExplosionMushroomUpdate ? now - lastExplosionMushroomUpdate : 0);
    lastExplosionMushroomUpdate = now;
    for (const effect of effects) effect.age = (effect.age || 0) + dt;
    const live = effects.filter((effect) => effect.age < EXPLOSION_MUSHROOM_LIFE);
    if (state && state.world) state.world.explosionEffects = live.slice(-EXPLOSION_MUSHROOM_RENDER_LIMIT);
    const visible = enabled ? state.world.explosionEffects : [];
    const liveIds = new Set();
    for (let i = 0; i < visible.length; i += 1) {
      const effect = visible[i];
      const id = effect.id || `${effect.x},${effect.y},${effect.z},${Math.round((effect.radius || 1) * 100)},${i}`;
      effect.id = id;
      liveIds.add(id);
      let mesh = explosionMushroomMeshes.get(id);
      if (!mesh) {
        mesh = createExplosionMushroomMesh();
        explosionMushroomMeshes.set(id, mesh);
      }
      const age = Math.max(0, effect.age || 0);
      const t = Math.min(1, age / EXPLOSION_MUSHROOM_LIFE);
      const grow = 1 - Math.pow(1 - Math.min(1, t * 1.35), 2);
      const fade = Math.max(0, 1 - t);
      const size = explosionMushroomSize(effect.radius);
      const stemH = size * (1.25 + grow * 1.15);
      const capY = stemH * (0.72 + grow * 0.18);
      mesh.position.set(effect.x, effect.y, effect.z);
      mesh.userData.flash.position.set(0, size * 0.16, 0);
      mesh.userData.flash.scale.setScalar(size * (0.35 + grow * 0.42));
      mesh.userData.flash.material.opacity = Math.max(0, 0.72 * (1 - Math.min(1, t * 3.2)));
      mesh.userData.stem.position.set(0, stemH * 0.42, 0);
      mesh.userData.stem.scale.set(size * (0.16 + grow * 0.08), stemH, size * (0.16 + grow * 0.08));
      mesh.userData.stem.material.opacity = 0.42 * fade;
      mesh.userData.cap.position.set(0, capY, 0);
      mesh.userData.cap.scale.set(size * (0.55 + grow * 0.7), size * (0.22 + grow * 0.24), size * (0.55 + grow * 0.7));
      mesh.userData.cap.material.opacity = 0.58 * fade;
      mesh.userData.glow.position.copy(mesh.userData.cap.position);
      mesh.userData.glow.scale.copy(mesh.userData.cap.scale).multiplyScalar(1.08);
      mesh.userData.glow.material.opacity = 0.28 * fade;
      mesh.userData.ring.position.set(0, size * 0.18, 0);
      mesh.userData.ring.rotation.x = Math.PI * 0.5;
      mesh.userData.ring.scale.setScalar(size * (0.45 + grow * 1.2));
      mesh.userData.ring.material.opacity = 0.32 * fade;
      mesh.visible = true;
    }
    for (const [id, mesh] of explosionMushroomMeshes) {
      if (liveIds.has(id)) continue;
      mesh.visible = false;
      if (explosionMushroomMeshes.size > EXPLOSION_MUSHROOM_RENDER_LIMIT) {
        explosionMushroomGroup.remove(mesh);
        disposeObject3D(mesh);
        explosionMushroomMeshes.delete(id);
      }
    }
  }

  function parseBlockDataKey(key) {
    const parts = String(key).split(',').map(Number);
    return parts.length === 3 && parts.every((part) => Number.isFinite(part))
      ? { x: parts[0], y: parts[1], z: parts[2] }
      : null;
  }

  function customTntLabelLines(data) {
    const source = data && typeof data === 'object' ? data : {};
    const power = Number.isFinite(Number(source.power)) ? Math.trunc(Number(source.power)) : 1;
    const flags = [];
    if (source.chainReaction === true) flags.push('цепь');
    if (source.knockback === true) flags.push('толчок');
    if (source.mobileTnt === true) flags.push('подвижное');
    if (source.movingBlocks === true) flags.push('блоки');
    return [`Сила: ${power}`, flags.length ? flags.join(' ') : 'без свойств'];
  }

  function createCustomTntLabelSprite(lines) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(20, 16, 14, 0.78)';
    ctx.fillRect(6, 10, 244, 76);
    ctx.strokeStyle = 'rgba(255, 224, 136, 0.82)';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 12, 240, 72);
    ctx.fillStyle = '#fff1b8';
    ctx.font = '700 24px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(lines[0] || 'Сила: 1', 128, 36, 226);
    ctx.fillStyle = '#ffd26a';
    ctx.font = '700 18px Arial, sans-serif';
    ctx.fillText(lines[1] || 'без свойств', 128, 63, 226);
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2.4, 0.9, 1);
    sprite.userData.texture = texture;
    sprite.userData.labelKey = lines.join('|');
    return sprite;
  }

  function disposeSprite(sprite) {
    if (!sprite) return;
    if (sprite.material && sprite.material.map && sprite.material.map.dispose) sprite.material.map.dispose();
    if (sprite.material && sprite.material.dispose) sprite.material.dispose();
  }

  function updateCustomTntLabels(state) {
    if (!scene) return;
    const blockData = state && state.world && state.world.blockData ? state.world.blockData : {};
    const player = state && state.player ? state.player : null;
    const maxDistSq = 34 * 34;
    const entries = [];
    if (player) {
      for (const [key, data] of Object.entries(blockData)) {
        if (!data || data.type !== 'customTnt') continue;
        const pos = parseBlockDataKey(key);
        if (!pos || getBlock3D(state, pos.x, pos.y, pos.z) !== BLOCK.CUSTOM_TNT) continue;
        const dx = pos.x + 0.5 - player.x;
        const dy = pos.y + 0.5 - player.y;
        const dz = pos.z + 0.5 - player.z;
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq > maxDistSq) continue;
        entries.push({ key, pos, data, distSq });
      }
    }
    entries.sort((a, b) => a.distSq - b.distSq);
    const visible = entries.slice(0, 48);
    const live = new Set();
    for (const item of visible) {
      live.add(item.key);
      const lines = customTntLabelLines(item.data);
      const labelKey = lines.join('|');
      let sprite = customTntLabelSprites.get(item.key);
      if (sprite && sprite.userData.labelKey !== labelKey) {
        scene.remove(sprite);
        disposeSprite(sprite);
        customTntLabelSprites.delete(item.key);
        sprite = null;
      }
      if (!sprite) {
        sprite = createCustomTntLabelSprite(lines);
        customTntLabelSprites.set(item.key, sprite);
        scene.add(sprite);
      }
      sprite.position.set(item.pos.x + 0.5, item.pos.y + 1.18, item.pos.z + 0.5);
      sprite.visible = true;
    }
    for (const [key, sprite] of customTntLabelSprites) {
      if (live.has(key)) continue;
      scene.remove(sprite);
      disposeSprite(sprite);
      customTntLabelSprites.delete(key);
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

  function mat(color) {
    return new THREE.MeshBasicMaterial({ color });
  }

  function addAnimalFace(root, head, type) {
    if (!root || !head || !Game.faces3d || !Game.faces3d.getFaceProfile3D) return;
    const profile = Game.faces3d.getFaceProfile3D(type);
    if (!profile) return;
    const eyeMaterial = mat(0xfffbec);
    const pupilMaterial = mat(0x181617);
    const highlightMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const faceEyes = [];
    for (const z of [-profile.eyeSpread, profile.eyeSpread]) {
      const group = new THREE.Group();
      group.position.set(profile.faceX, profile.eyeY, z);
      head.add(group);

      const eye = new THREE.Mesh(
        new THREE.BoxGeometry(profile.eyeDepth, profile.eyeHeight, profile.eyeWidth),
        eyeMaterial
      );
      group.add(eye);

      const pupil = new THREE.Mesh(
        new THREE.BoxGeometry(profile.pupilDepth, profile.pupilHeight, profile.pupilWidth),
        pupilMaterial
      );
      pupil.position.x = (profile.eyeDepth + profile.pupilDepth) * 0.5 + 0.001;
      group.add(pupil);

      const highlightDepth = Math.max(0.006, profile.pupilDepth * 0.65);
      const highlight = new THREE.Mesh(
        new THREE.BoxGeometry(
          highlightDepth,
          Math.max(0.012, profile.pupilHeight * 0.28),
          Math.max(0.01, profile.pupilWidth * 0.28)
        ),
        highlightMaterial
      );
      highlight.position.set(
        (profile.pupilDepth + highlightDepth) * 0.5 + 0.001,
        profile.pupilHeight * 0.2,
        -profile.pupilWidth * 0.18
      );
      pupil.add(highlight);
      faceEyes.push({ group, eye, pupil, highlight, profile });
    }
    root.userData.faceEyes = faceEyes;

    if (Number.isFinite(profile.mouthY)) {
      const mouth = new THREE.Mesh(
        new THREE.BoxGeometry(profile.mouthDepth, profile.mouthHeight, profile.mouthWidth),
        pupilMaterial
      );
      mouth.position.set(profile.faceX + 0.002, profile.mouthY, 0);
      head.add(mouth);
      root.userData.faceMouth = mouth;
    }
  }

  function updateAnimalFace(root, id, timeSeconds, forceClosed = false) {
    const eyes = root && root.userData && root.userData.faceEyes;
    if (!eyes || !eyes.length || !Game.faces3d || !Game.faces3d.getFaceAnimation3D) return;
    const animation = Game.faces3d.getFaceAnimation3D(id, timeSeconds);
    const eyeOpen = forceClosed ? 0.04 : Math.max(0.04, animation.eyeOpen);
    for (const assembly of eyes) {
      assembly.group.scale.set(1, eyeOpen, 1);
      assembly.pupil.position.y = animation.pupilY * assembly.profile.pupilTravelY;
      assembly.pupil.position.z = animation.pupilX * assembly.profile.pupilTravelX;
    }
  }

  function createSleepZSprite() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f4f7ff';
    ctx.strokeStyle = '#1f2430';
    ctx.lineWidth = 4;
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText('Z', 32, 32);
    ctx.fillText('Z', 32, 32);
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(0.55, 2.85, 0);
    sprite.scale.set(0.72, 0.72, 0.72);
    return sprite;
  }

  function createSimpleMobMesh(type) {
    const root = new THREE.Group();
    if (type === 'boar') {
      const bodyMat = mat(0x5a3928);
      const dark = mat(0x2f2018);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.42, 0.42), bodyMat);
      body.position.set(0, 0.45, 0);
      root.add(body);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.32, 0.34), dark);
      head.position.set(0.6, 0.48, 0);
      root.add(head);
      root.userData.head = head;
      addAnimalFace(root, head, 'boar');
      for (const [x, z] of [[-0.32, -0.15], [-0.32, 0.15], [0.28, -0.15], [0.28, 0.15]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, 0.1), dark);
        leg.position.set(x, 0.18, z);
        root.add(leg);
      }
      return root;
    }
    if (type === 'turtle') {
      const shell = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.22, 0.52), mat(0x42633b));
      shell.position.set(0, 0.28, 0);
      root.add(shell);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.18, 0.4), mat(0x6f7d45));
      body.position.set(0.04, 0.18, 0);
      root.add(body);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.16), mat(0x7f8f50));
      head.position.set(0.45, 0.2, 0);
      root.add(head);
      root.userData.head = head;
      addAnimalFace(root, head, 'turtle');
      return root;
    }
    if (type === 'snake') {
      const bodyMat = mat(0x6d7d2e);
      for (let i = 0; i < 9; i += 1) {
        const width = i === 8 ? 0.2 : 0.24;
        const part = new THREE.Mesh(new THREE.BoxGeometry(width, 0.14, 0.18), bodyMat);
        part.position.set(-0.52 + i * 0.15, 0.14, 0);
        root.add(part);
      }
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.22), mat(0x7f9138));
      head.position.set(0.78, 0.16, 0);
      root.add(head);
      root.userData.head = head;
      addAnimalFace(root, head, 'snake');
      return root;
    }
    if (type === 'goat') {
      const bodyMat = mat(0xb8b0a0);
      const dark = mat(0x554838);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.42, 0.38), bodyMat);
      body.position.set(0, 0.48, 0);
      root.add(body);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.26), dark);
      head.position.set(0.48, 0.62, 0);
      root.add(head);
      root.userData.head = head;
      addAnimalFace(root, head, 'goat');
      const hornA = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.05), mat(0xe8dfc6));
      hornA.position.set(0.48, 0.82, -0.09);
      root.add(hornA);
      const hornB = hornA.clone();
      hornB.position.z = 0.09;
      root.add(hornB);
      for (const [x, z] of [[-0.22, -0.13], [-0.22, 0.13], [0.24, -0.13], [0.24, 0.13]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 0.08), dark);
        leg.position.set(x, 0.2, z);
        root.add(leg);
      }
      return root;
    }
    if (type === 'fish') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.2), mat(0xd18a3a));
      body.position.set(0, 0.08, 0);
      root.add(body);
      root.userData.head = body;
      addAnimalFace(root, body, 'fish');
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 0.05), mat(0xb8662f));
      tail.position.set(-0.28, 0.08, 0);
      root.add(tail);
      return root;
    }
    if (type === 'fox') {
      const orange = mat(0xc96b2c);
      const dark = mat(0x34251c);
      const light = mat(0xf0d2a8);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.26, 0.28), orange);
      body.position.set(0, 0.34, 0);
      root.add(body);
      const chest = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.22), light);
      chest.position.set(0.22, 0.32, 0);
      root.add(chest);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.22), orange);
      head.position.set(0.48, 0.43, 0);
      root.add(head);
      root.userData.head = head;
      addAnimalFace(root, head, 'fox');
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.18), orange);
      tail.position.set(-0.52, 0.4, 0);
      tail.rotation.z = -0.25;
      root.add(tail);
      const tailTip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.16), light);
      tailTip.position.set(-0.78, 0.46, 0);
      root.add(tailTip);
      for (const [x, z] of [[-0.22, -0.1], [-0.22, 0.1], [0.22, -0.1], [0.22, 0.1]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.24, 0.07), dark);
        leg.position.set(x, 0.16, z);
        root.add(leg);
      }
      return root;
    }
    if (type === 'bear' || type === 'polar_bear') {
      const fur = mat(0x7b4d32);
      const shade = mat(0x5a3523);
      const dark = mat(0x27231f);
      const snowFur = mat(0xe8e3d4);
      const snowShade = mat(0xc9c3b5);
      const body = new THREE.Mesh(new THREE.BoxGeometry(3.24, 1.56, 1.38), fur);
      body.position.set(0, 1.5, 0);
      body.userData.brownMaterial = fur;
      body.userData.snowMaterial = snowFur;
      root.add(body);
      const shoulder = new THREE.Mesh(new THREE.BoxGeometry(1.26, 1.26, 1.26), shade);
      shoulder.position.set(1.02, 1.74, 0);
      shoulder.userData.brownMaterial = shade;
      shoulder.userData.snowMaterial = snowShade;
      root.add(shoulder);
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.9, 0.9), fur);
      head.position.set(2.16, 1.86, 0);
      head.userData.brownMaterial = fur;
      head.userData.snowMaterial = snowFur;
      root.add(head);
      root.userData.head = head;
      addAnimalFace(root, head, 'bear');
      const nose = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.36), dark);
      nose.position.set(2.82, 1.8, 0);
      root.add(nose);
      const frontLegs = [];
      for (const [x, z] of [[-1.02, -0.48], [-1.02, 0.48], [1.02, -0.48], [1.02, 0.48]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.08, 0.36), shade);
        leg.position.set(x, 0.6, z);
        leg.userData.brownMaterial = shade;
        leg.userData.snowMaterial = snowShade;
        root.add(leg);
        if (x > 0) frontLegs.push(leg);
      }
      root.userData.frontLegs = frontLegs;
      const digDust = new THREE.Group();
      const dustMat = mat(0x7a5438);
      for (let i = 0; i < 10; i += 1) {
        const dust = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), dustMat);
        dust.visible = false;
        digDust.add(dust);
      }
      root.add(digDust);
      root.userData.digDust = digDust;
      const splash = new THREE.Group();
      const splashMat = mat(0x7fc8ff);
      for (let i = 0; i < 10; i += 1) {
        const drop = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), splashMat);
        drop.visible = false;
        splash.add(drop);
      }
      root.add(splash);
      root.userData.splash = splash;
      const sleepZ = createSleepZSprite();
      sleepZ.visible = false;
      root.add(sleepZ);
      root.userData.sleepZ = sleepZ;
      return root;
    }
    return null;
  }

  function createSheepMesh(type = 'sheep') {
    const simple = createSimpleMobMesh(type);
    if (simple) return simple;
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
    addAnimalFace(root, head, 'sheep');

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

  function createPetMicrophoneSprite() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = 'rgba(20,24,30,0.72)';
    ctx.beginPath();
    ctx.arc(32, 32, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff665c';
    ctx.fillStyle = '#ff665c';
    ctx.lineWidth = 5;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(24, 12, 16, 29, 8);
      ctx.fill();
    } else {
      ctx.fillRect(24, 16, 16, 21);
      ctx.beginPath();
      ctx.arc(32, 16, 8, Math.PI, 0);
      ctx.arc(32, 37, 8, 0, Math.PI);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(32, 31, 15, 0, Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(32, 46);
    ctx.lineTo(32, 54);
    ctx.moveTo(23, 54);
    ctx.lineTo(41, 54);
    ctx.stroke();
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    sprite.position.set(0, 0.12, 0);
    sprite.scale.set(0.52, 0.52, 0.52);
    sprite.visible = false;
    return sprite;
  }

  function petPart(parent, color, size, position) {
    const part = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), mat(color));
    part.position.set(position[0], position[1], position[2]);
    parent.add(part);
    return part;
  }

  function createPetMesh(type) {
    const root = new THREE.Group();
    if (type === 'cat') {
      petPart(root, 0xd8904e, [0.62, 0.34, 0.34], [0, 0.42, 0]);
      const head = petPart(root, 0xe4a15b, [0.42, 0.42, 0.42], [0.43, 0.62, 0]);
      const earL = petPart(root, 0xd47d43, [0.16, 0.2, 0.12], [0.43, 0.9, -0.14]);
      const earR = petPart(root, 0xd47d43, [0.16, 0.2, 0.12], [0.43, 0.9, 0.14]);
      earL.rotation.z = 0.35;
      earR.rotation.z = 0.35;
      const tail = petPart(root, 0xd8904e, [0.12, 0.58, 0.12], [-0.42, 0.61, 0]);
      tail.rotation.z = -0.48;
      for (const [x, z] of [[-0.18, -0.12], [-0.18, 0.12], [0.18, -0.12], [0.18, 0.12]]) petPart(root, 0xb9663c, [0.09, 0.3, 0.09], [x, 0.17, z]);
      addAnimalFace(root, head, 'cat');
      petPart(root, 0xf6b2a0, [0.05, 0.07, 0.08], [0.68, 0.57, 0]);
      root.userData.head = head;
      root.userData.tail = tail;
    } else if (type === 'dog') {
      petPart(root, 0xb97843, [0.72, 0.4, 0.4], [0, 0.43, 0]);
      const head = petPart(root, 0xcf9258, [0.46, 0.48, 0.46], [0.48, 0.65, 0]);
      petPart(root, 0x78482f, [0.16, 0.34, 0.13], [0.47, 0.59, -0.28]);
      petPart(root, 0x78482f, [0.16, 0.34, 0.13], [0.47, 0.59, 0.28]);
      petPart(root, 0xe0aa72, [0.22, 0.18, 0.27], [0.74, 0.57, 0]);
      petPart(root, 0x28201d, [0.06, 0.08, 0.12], [0.88, 0.61, 0]);
      const tongue = petPart(root, 0xf17f91, [0.04, 0.14, 0.1], [0.83, 0.44, 0]);
      const tail = petPart(root, 0x9c6038, [0.4, 0.12, 0.12], [-0.52, 0.62, 0]);
      tail.rotation.z = 0.42;
      for (const [x, z] of [[-0.23, -0.14], [-0.23, 0.14], [0.23, -0.14], [0.23, 0.14]]) petPart(root, 0x875332, [0.1, 0.34, 0.1], [x, 0.18, z]);
      addAnimalFace(root, head, 'dog');
      root.userData.head = head;
      root.userData.tail = tail;
      root.userData.tongue = tongue;
    } else if (type === 'capybara') {
      petPart(root, 0x9b6b43, [0.9, 0.48, 0.5], [-0.04, 0.42, 0]);
      const head = petPart(root, 0xaa7950, [0.5, 0.52, 0.48], [0.48, 0.58, 0]);
      petPart(root, 0x6f4932, [0.14, 0.15, 0.13], [0.41, 0.9, -0.16]);
      petPart(root, 0x6f4932, [0.14, 0.15, 0.13], [0.41, 0.9, 0.16]);
      petPart(root, 0xb98a62, [0.26, 0.2, 0.34], [0.78, 0.54, 0]);
      petPart(root, 0x30251f, [0.06, 0.08, 0.16], [0.93, 0.6, 0]);
      for (const [x, z] of [[-0.3, -0.16], [-0.3, 0.16], [0.24, -0.16], [0.24, 0.16]]) petPart(root, 0x755039, [0.12, 0.3, 0.12], [x, 0.16, z]);
      addAnimalFace(root, head, 'capybara');
      root.userData.head = head;
    } else {
      petPart(root, 0x39a85a, [0.36, 0.48, 0.34], [0, 0.42, 0]);
      const head = petPart(root, 0xe9d94d, [0.42, 0.42, 0.4], [0.2, 0.76, 0]);
      const wingL = petPart(root, 0x2f73c8, [0.32, 0.38, 0.1], [-0.04, 0.48, -0.24]);
      const wingR = petPart(root, 0x2f73c8, [0.32, 0.38, 0.1], [-0.04, 0.48, 0.24]);
      const upperBeak = petPart(root, 0xf39a35, [0.24, 0.14, 0.18], [0.52, 0.75, 0]);
      const lowerBeak = petPart(root, 0xc9672d, [0.18, 0.08, 0.15], [0.47, 0.66, 0]);
      petPart(root, 0xd83f43, [0.34, 0.36, 0.12], [-0.13, 0.16, 0]);
      addAnimalFace(root, head, 'parrot');
      root.userData.head = head;
      root.userData.wingL = wingL;
      root.userData.wingR = wingR;
      root.userData.upperBeak = upperBeak;
      root.userData.lowerBeak = lowerBeak;
    }
    const microphone = createPetMicrophoneSprite();
    root.add(microphone);
    root.userData.microphone = microphone;
    root.userData.petType = type;
    return root;
  }

  function disposePetMeshes() {
    for (const mesh of petMeshes.values()) {
      scene.remove(mesh);
      disposeObject3D(mesh);
    }
    petMeshes.clear();
  }

  function applyBearVariant(mesh, variant) {
    if (!mesh || (variant !== 'snow' && variant !== 'brown')) return;
    mesh.traverse((child) => {
      if (!child.userData) return;
      const material = variant === 'snow' ? child.userData.snowMaterial : child.userData.brownMaterial;
      if (material) child.material = material;
    });
  }

  function disposeSheepMeshes() {
    for (const mesh of sheepMeshes.values()) scene.remove(mesh);
    sheepMeshes.clear();
  }

  function createBotLabel(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(8, 10, 240, 44);
    ctx.fillStyle = '#f4f0dc';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(text || 'Bot'), 128, 32, 228);
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(0, 2.34, 0);
    sprite.scale.set(1.8, 0.45, 0.45);
    return sprite;
  }

  function createBotHealthSprite() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 24;
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(0, 2.05, 0);
    sprite.scale.set(1.25, 0.23, 0.23);
    sprite.userData.canvas = canvas;
    sprite.userData.texture = texture;
    sprite.userData.lastHealthKey = '';
    return sprite;
  }

  function updateBotHealthSprite(sprite, bot, visible) {
    if (!sprite) return;
    sprite.visible = !!visible;
    if (!visible) return;
    const maxHealth = Number.isFinite(bot && bot.maxHealth) && bot.maxHealth > 0 ? bot.maxHealth : 100;
    const health = Math.max(0, Math.min(maxHealth, Number.isFinite(bot && bot.health) ? bot.health : maxHealth));
    const key = `${Math.ceil(health)}:${Math.ceil(maxHealth)}:${bot && bot.damageFlash > 0 ? 1 : 0}`;
    if (sprite.userData.lastHealthKey === key) return;
    sprite.userData.lastHealthKey = key;
    const canvas = sprite.userData.canvas;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0,0,0,0.58)';
    ctx.fillRect(8, 6, 112, 12);
    ctx.fillStyle = health <= maxHealth * 0.28 ? '#ff6247' : '#d9433b';
    ctx.fillRect(10, 8, 108 * (health / maxHealth), 8);
    ctx.strokeStyle = bot && bot.damageFlash > 0 ? '#fff0a8' : 'rgba(255,255,255,0.45)';
    ctx.strokeRect(8.5, 6.5, 111, 11);
    sprite.userData.texture.needsUpdate = true;
  }

  function createBotMesh(bot) {
    const root = new THREE.Group();
    const shirt = mat(Number.isFinite(bot && bot.color) ? bot.color : 0x3f7fd5);
    const skin = mat(0xd4a071);
    const dark = mat(0x2b2520);
    const pants = mat(0x2d3857);
    const tool = mat(0x9a7b42);

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.72, 0.28), shirt);
    body.position.set(0, 1.08, 0);
    root.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), skin);
    head.position.set(0, 1.72, 0);
    root.add(head);
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.4), dark);
    hair.position.set(0, 1.96, 0);
    root.add(hair);
    const armGeometry = new THREE.BoxGeometry(0.16, 0.62, 0.16);
    const armL = new THREE.Mesh(armGeometry, skin);
    armL.position.set(-0.42, 1.08, 0);
    root.add(armL);
    const armR = new THREE.Mesh(armGeometry, skin);
    armR.position.set(0.42, 1.08, 0);
    root.add(armR);
    const legGeometry = new THREE.BoxGeometry(0.18, 0.72, 0.18);
    const legL = new THREE.Mesh(legGeometry, pants);
    legL.position.set(-0.16, 0.36, 0);
    root.add(legL);
    const legR = new THREE.Mesh(legGeometry, pants);
    legR.position.set(0.16, 0.36, 0);
    root.add(legR);
    const held = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.62, 0.12), tool);
    held.position.set(0.55, 1.02, 0.08);
    held.rotation.z = -0.55;
    root.add(held);
    const label = createBotLabel(`${bot && bot.name ? bot.name : 'Bot'} / ${bot && bot.roleLabel ? bot.roleLabel : ''}`);
    root.add(label);
    const health = createBotHealthSprite();
    root.add(health);
    root.userData.armL = armL;
    root.userData.armR = armR;
    root.userData.legL = legL;
    root.userData.legR = legR;
    root.userData.held = held;
    root.userData.health = health;
    return root;
  }

  function disposeBotMeshes() {
    for (const mesh of botMeshes.values()) scene.remove(mesh);
    botMeshes.clear();
  }

  function syncSheepMeshes(state) {
    if (!scene) return;
    const sheep = state.entities && Array.isArray(state.entities.sheep) ? state.entities.sheep : [];
    const live = new Set();
    const playerChunk = getPlayerChunk(state.player);
    const renderDistance = getChunkRenderDistanceValue(state.worldMeta);
    for (const item of sheep) {
      live.add(item.id);
      if (!Game.constants3d.isActiveSimulationPosition3D(state, item.x, item.z)) {
        const distant = sheepMeshes.get(item.id);
        if (distant) distant.visible = false;
        continue;
      }
      const type = item.type === 'polar_bear' ? 'bear' : (item.type || 'sheep');
      let mesh = sheepMeshes.get(item.id);
      if (!mesh || (mesh.userData && mesh.userData.mobType !== type)) {
        if (mesh) scene.remove(mesh);
        mesh = createSheepMesh(type);
        if (!mesh.userData) mesh.userData = {};
        mesh.userData.mobType = type;
        sheepMeshes.set(item.id, mesh);
        scene.add(mesh);
      }
      if (type === 'bear') applyBearVariant(mesh, item.variant || 'brown');
      const mobScale = Number.isFinite(item.scale) ? Math.max(0.25, Math.min(1024, item.scale)) : 1;
      mesh.scale.setScalar(mobScale);
      mesh.position.set(item.x, item.y, item.z);
      mesh.rotation.y = -(item.yaw || 0);
      mesh.rotation.x = 0;
      mesh.rotation.z = 0;
      const threat = Game.generation3d && Game.generation3d.getActiveVolcanicEruption3D
        ? Game.generation3d.getActiveVolcanicEruption3D(state, item.x, item.z)
        : null;
      if (threat && type !== 'fish') {
        const t = performance.now() * 0.001;
        const shake = Math.max(0, Math.min(1, threat.intensity || 0));
        mesh.position.x += Math.sin(t * 42 + item.x) * 0.025 * shake;
        mesh.position.z += Math.cos(t * 39 + item.z) * 0.025 * shake;
        mesh.rotation.z += Math.sin(t * 46 + item.z) * 0.035 * shake;
      }
      if (type === 'bear' && item.sleeping) {
        mesh.rotation.y = -(item.yaw || 0);
        mesh.rotation.x = Math.PI * 0.5;
        mesh.position.y = item.y + 0.55;
      }
      const head = mesh.userData && mesh.userData.head;
      if (head) head.rotation.z = item.eating ? -0.65 : 0;
      updateAnimalFace(mesh, item.id, performance.now() * 0.001, type === 'bear' && !!item.sleeping);
      const sleepZ = mesh.userData && mesh.userData.sleepZ;
      if (sleepZ) {
        sleepZ.visible = !!item.sleeping;
        if (item.sleeping) {
          const t = performance.now() * 0.001;
          sleepZ.position.y = 2.85 + Math.sin(t * 2.2) * 0.18;
          sleepZ.scale.setScalar(0.72 + Math.sin(t * 3.1) * 0.08);
        }
      }
      if (type === 'bear') {
        const t = performance.now() * 0.001;
        const frontLegs = mesh.userData && mesh.userData.frontLegs ? mesh.userData.frontLegs : [];
        for (let i = 0; i < frontLegs.length; i += 1) {
          frontLegs[i].rotation.z = item.digging ? Math.sin(t * 12 + i * Math.PI) * 0.55 : 0;
        }
        const digDust = mesh.userData && mesh.userData.digDust;
        if (digDust) {
          for (let i = 0; i < digDust.children.length; i += 1) {
            const dust = digDust.children[i];
            dust.visible = !!item.digging;
            if (item.digging) {
              const phase = t * 5 + i * 0.7;
              const burst = (phase % 1);
              dust.position.set(1.65 + Math.sin(i * 2.1) * 0.55, 0.15 + burst * 0.55, Math.cos(i * 1.7) * 0.55);
              dust.scale.setScalar(Math.max(0.35, 1 - burst));
            }
          }
        }
        const splash = mesh.userData && mesh.userData.splash;
        const splashing = item.variant !== 'snow' && item.inWater && Math.hypot(item.vx || 0, item.vz || 0) > 0.05;
        if (splash) {
          for (let i = 0; i < splash.children.length; i += 1) {
            const drop = splash.children[i];
            drop.visible = splashing;
            if (splashing) {
              const phase = (t * 4.5 + i * 0.17) % 1;
              const angle = i * 2.399;
              const radius = 0.55 + phase * 0.75;
              drop.position.set(Math.cos(angle) * radius, 0.12 + Math.sin(phase * Math.PI) * 0.45, Math.sin(angle) * radius);
              drop.scale.setScalar(Math.max(0.3, 1 - phase * 0.55));
            }
          }
        }
      }
      const cx = Math.floor(item.x / CHUNK_SIZE);
      const cz = Math.floor(item.z / CHUNK_SIZE);
      const dx = cx - playerChunk.cx;
      const dz = cz - playerChunk.cz;
      mesh.visible = dx * dx + dz * dz <= renderDistance * renderDistance;
    }
    for (const [id, mesh] of sheepMeshes) {
      if (live.has(id)) continue;
      scene.remove(mesh);
      sheepMeshes.delete(id);
    }
    if (debugInfo) debugInfo.sheep = sheep.length;
  }

  function syncPetMeshes(state) {
    if (!scene) return;
    const pets = state.entities && Array.isArray(state.entities.pets)
      ? state.entities.pets.filter((pet) => pet && pet.active)
      : [];
    const live = new Set();
    const playerChunk = getPlayerChunk(state.player);
    const renderDistance = getChunkRenderDistanceValue(state.worldMeta);
    const now = performance.now() * 0.001;
    for (const pet of pets) {
      live.add(pet.id);
      let mesh = petMeshes.get(pet.id);
      if (!mesh || mesh.userData.petType !== pet.type) {
        if (mesh) {
          scene.remove(mesh);
          disposeObject3D(mesh);
        }
        mesh = createPetMesh(pet.type);
        petMeshes.set(pet.id, mesh);
        scene.add(mesh);
      }
      const walk = pet.moving ? Math.sin(now * (pet.type === 'capybara' ? 7 : 11)) : 0;
      const idle = Math.sin(now * 2.1 + pet.x * 0.7) * 0.025;
      const jumpDuration = Number.isFinite(pet.jumpDuration) && pet.jumpDuration > 0 ? pet.jumpDuration : 0.42;
      const jumpProgress = Math.max(0, Math.min(1, 1 - (pet.jumpTimer || 0) / jumpDuration));
      const jumpLift = pet.jumpTimer > 0 ? Math.sin(jumpProgress * Math.PI) * 0.28 : 0;
      mesh.position.set(pet.x, pet.y + jumpLift + (pet.moving ? Math.abs(walk) * 0.025 : idle), pet.z);
      mesh.rotation.set(0, -(pet.yaw || 0), 0);
      const head = mesh.userData.head;
      if (head) {
        head.rotation.z = pet.mode === 'wait' ? Math.sin(now * 1.5 + pet.z) * 0.08 : walk * 0.035;
        head.rotation.y = pet.mode === 'wait' ? Math.sin(now * 0.8 + pet.x) * 0.12 : 0;
      }
      updateAnimalFace(mesh, pet.id, now);
      const tail = mesh.userData.tail;
      if (tail) tail.rotation.y = Math.sin(now * (pet.type === 'dog' ? 10 : 4.5)) * (pet.type === 'dog' ? 0.65 : 0.28);
      const wingL = mesh.userData.wingL;
      const wingR = mesh.userData.wingR;
      if (wingL && wingR) {
        const flap = Math.sin(now * (pet.moving ? 13 : 4)) * (pet.moving ? 0.72 : 0.12);
        wingL.rotation.x = flap;
        wingR.rotation.x = -flap;
      }
      const speaking = Game.pets3d && Game.pets3d.isPetSpeaking3D && Game.pets3d.isPetSpeaking3D(pet.id);
      if (mesh.userData.lowerBeak) mesh.userData.lowerBeak.position.y = 0.66 - (speaking ? (0.04 + Math.abs(Math.sin(now * 16)) * 0.08) : 0);
      const microphone = mesh.userData.microphone;
      if (microphone) {
        microphone.visible = !!(Game.pets3d && Game.pets3d.isPetRecording3D && Game.pets3d.isPetRecording3D(pet.id));
        if (microphone.visible) microphone.scale.setScalar(0.48 + Math.sin(now * 5) * 0.05);
      }
      const cx = Math.floor(pet.x / CHUNK_SIZE);
      const cz = Math.floor(pet.z / CHUNK_SIZE);
      const dx = cx - playerChunk.cx;
      const dz = cz - playerChunk.cz;
      mesh.visible = dx * dx + dz * dz <= renderDistance * renderDistance;
    }
    for (const [id, mesh] of petMeshes) {
      if (live.has(id)) continue;
      scene.remove(mesh);
      disposeObject3D(mesh);
      petMeshes.delete(id);
    }
    if (debugInfo) debugInfo.pets = pets.length;
  }

  function syncBotMeshes(state) {
    if (!scene) return;
    const bots = state.entities && Array.isArray(state.entities.bots) ? state.entities.bots : [];
    const live = new Set();
    const playerChunk = getPlayerChunk(state.player);
    const renderDistance = getChunkRenderDistanceValue(state.worldMeta);
    const now = performance.now() * 0.001;
    for (const bot of bots) {
      live.add(bot.id);
      if (!Game.constants3d.isActiveSimulationPosition3D(state, bot.x, bot.z)) {
        const distant = botMeshes.get(bot.id);
        if (distant) distant.visible = false;
        continue;
      }
      let mesh = botMeshes.get(bot.id);
      if (!mesh) {
        mesh = createBotMesh(bot);
        botMeshes.set(bot.id, mesh);
        scene.add(mesh);
      }
      mesh.position.set(bot.x, bot.y, bot.z);
      mesh.rotation.y = -(bot.yaw || 0) + Math.PI * 0.5;
      const speed = Math.hypot(bot.vx || 0, bot.vz || 0);
      const swing = Math.sin(now * 8.5 + (bot.id || '').length) * Math.min(0.65, speed * 0.22);
      if (mesh.userData.armL) mesh.userData.armL.rotation.x = swing;
      if (mesh.userData.armR) mesh.userData.armR.rotation.x = -swing;
      if (mesh.userData.legL) mesh.userData.legL.rotation.x = -swing;
      if (mesh.userData.legR) mesh.userData.legR.rotation.x = swing;
      if (mesh.userData.held) mesh.userData.held.rotation.x = -Math.abs(swing) * 0.8;
      updateBotHealthSprite(mesh.userData.health, bot, state.worldMeta && state.worldMeta.mode === 'survival');
      const cx = Math.floor(bot.x / CHUNK_SIZE);
      const cz = Math.floor(bot.z / CHUNK_SIZE);
      const dx = cx - playerChunk.cx;
      const dz = cz - playerChunk.cz;
      mesh.visible = dx * dx + dz * dz <= renderDistance * renderDistance;
    }
    for (const [id, mesh] of botMeshes) {
      if (live.has(id)) continue;
      scene.remove(mesh);
      botMeshes.delete(id);
    }
    if (debugInfo) debugInfo.bots = bots.length;
  }

  function syncMovingBlockMeshes(state) {
    if (!scene) return;
    const items = state.world && Array.isArray(state.world.movingBlocks) ? state.world.movingBlocks : [];
    const live = new Set();
    for (const item of items) {
      if (!item || !item.id) continue;
      live.add(item.id);
      let mesh = movingBlockMeshes.get(item.id);
      if (!mesh || (mesh.userData && mesh.userData.blockId !== item.blockId)) {
        if (mesh) {
          scene.remove(mesh);
          disposeObject3D(mesh);
        }
        mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), createHeldBlockMaterials(item.blockId));
        mesh.userData.blockId = item.blockId;
        movingBlockMeshes.set(item.id, mesh);
        scene.add(mesh);
      }
      mesh.position.set(item.x, item.y, item.z);
      mesh.rotation.x += 0.045;
      mesh.rotation.y += 0.065;
      mesh.visible = true;
    }
    for (const [id, mesh] of movingBlockMeshes) {
      if (live.has(id)) continue;
      scene.remove(mesh);
      disposeObject3D(mesh);
      movingBlockMeshes.delete(id);
    }
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
    chunkMeshRevision += 1;
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
      previous.material = materialForMode(state, mode);
      previous.castShadow = shaderMode(state) && mode === 'solid';
      previous.receiveShadow = shaderMode(state) && mode === 'solid';
      previous.frustumCulled = true;
    } else {
      const material = materialForMode(state, mode);
      const nextMesh = new THREE.Mesh(geometry, material);
      nextMesh.frustumCulled = true;
      nextMesh.castShadow = shaderMode(state) && mode === 'solid';
      nextMesh.receiveShadow = shaderMode(state) && mode === 'solid';
      entry[mode] = nextMesh;
      scene.add(nextMesh);
    }

    chunkMeshRevision += 1;
    if (entry.solid || entry.water || entry.lava) chunkMeshes.set(key, entry);
    else chunkMeshes.delete(key);
    return { vertices, triangles };
  }

  function rebuildAllChunks(state) {
    if (!scene || !window.THREE) return;
    disposeChunkMeshes();
    meshRebuildQueue = [];
    meshRebuildQueued.clear();
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

  function meshStats(mesh) {
    if (!mesh || !mesh.geometry) return { vertices: 0, triangles: 0, meshes: 0 };
    return {
      vertices: mesh.geometry.getAttribute('position').count,
      triangles: mesh.geometry.index ? mesh.geometry.index.count / 3 : 0,
      meshes: 1,
    };
  }

  function chunkModeFlags(world, key) {
    const chunk = world && world.chunks ? world.chunks.get(key) : null;
    const flags = { solid: false, water: false, lava: false };
    if (!chunk || !chunk.blocks) return flags;
    for (let i = 0; i < chunk.blocks.length; i += 1) {
      const id = chunk.blocks[i];
      if (id === BLOCK.AIR) continue;
      if (id === BLOCK.WATER || id === BLOCK.HOT_WATER) flags.water = true;
      else if (id === BLOCK.LAVA || id === BLOCK.VOLCANIC_LAVA) flags.lava = true;
      else flags.solid = true;
      if (flags.solid && flags.water && flags.lava) break;
    }
    return flags;
  }

  function shouldQueueMeshMode(state, key, mode, flags) {
    if (mode === 'solid') return true;
    const entry = chunkMeshes.get(key);
    if (entry && entry[mode]) return true;
    return !!flags[mode];
  }

  function meshModePriority(mode) {
    if (mode === 'solid') return 0;
    if (mode === 'water') return 1;
    return 2;
  }

  function compareMeshTasksForPlayer(state, a, b) {
    const player = state && state.player ? state.player : { x: 0, y: 0, z: 0 };
    const pcx = Math.floor(player.x / CHUNK_SIZE);
    const pcy = Math.floor(player.y / CHUNK_SIZE);
    const pcz = Math.floor(player.z / CHUNK_SIZE);
    const adx = a.cx - pcx;
    const adz = a.cz - pcz;
    const bdx = b.cx - pcx;
    const bdz = b.cz - pcz;
    const distanceDelta = (adx * adx + adz * adz) - (bdx * bdx + bdz * bdz);
    const verticalDelta = Math.abs(a.cy - pcy) - Math.abs(b.cy - pcy);
    const modeDelta = meshModePriority(a.mode) - meshModePriority(b.mode);
    const aScore = Math.abs(a.cy - pcy) + (adx * adx + adz * adz) * MESH_VERTICAL_PRIORITY_WEIGHT;
    const bScore = Math.abs(b.cy - pcy) + (bdx * bdx + bdz * bdz) * MESH_VERTICAL_PRIORITY_WEIGHT;
    return (aScore - bScore) || modeDelta || verticalDelta || distanceDelta;
  }

  function enqueueDirtyChunkMeshes(state) {
    if (!state.world.dirtyChunks.size) return;
    const modes = ['solid', 'water', 'lava'];
    const deferred = new Set();
    for (const key of state.world.dirtyChunks) {
      const parsed = parseChunkKey(key);
      if (!parsed) continue;
      if (state.world.chunks.has(key) && !Game.constants3d.isActiveSimulationPosition3D(state, parsed.cx * CHUNK_SIZE, parsed.cz * CHUNK_SIZE)) {
        deferred.add(key);
        continue;
      }
      const flags = chunkModeFlags(state.world, key);
      for (const mode of modes) {
        if (!shouldQueueMeshMode(state, key, mode, flags)) continue;
        const taskKey = `${key}:${mode}`;
        if (meshRebuildQueued.has(taskKey)) continue;
        meshRebuildQueued.add(taskKey);
        meshRebuildQueue.push({ key, cx: parsed.cx, cy: parsed.cy, cz: parsed.cz, mode, taskKey });
      }
    }
    state.world.dirtyChunks.clear();
    for (const key of deferred) state.world.dirtyChunks.add(key);
  }

  function updateDirtyChunks(state) {
    if (!scene || !window.THREE) return;
    enqueueDirtyChunkMeshes(state);
    if (!meshRebuildQueue.length) return;
    const perf = state.perf || (state.perf = {});
    const totals = debugInfo || { vertices: 0, triangles: 0, chunks: 0, chunkMeshes: 0, textureTiles: atlasMeta ? atlasMeta.totalTiles : 0 };
    const start = performance.now();
    const baseBudget = Math.max(0.5, CHUNK_MESH_REBUILD_TIME_BUDGET_MS || 3);
    const maxBudget = Math.max(baseBudget, CHUNK_MESH_REBUILD_MAX_TIME_BUDGET_MS || baseBudget);
    const fps = state && state.ui ? state.ui.fps : 0;
    const backlogBoost = meshRebuildQueue.length > 80 ? 2 : (meshRebuildQueue.length > 30 ? 1 : 0);
    const fpsBudget = Number.isFinite(fps) && fps >= 70
      ? baseBudget + 2 + backlogBoost
      : (Number.isFinite(fps) && fps >= 55 ? baseBudget + backlogBoost : baseBudget);
    const normalBudget = Math.min(maxBudget, fpsBudget);
    const budget = Game.performance3d ? Game.performance3d.getMobileWorkBudget3D(state, normalBudget) : normalBudget;
    meshRebuildQueue.sort((a, b) => compareMeshTasksForPlayer(state, a, b));
    do {
      const task = meshRebuildQueue.shift();
      if (!task) break;
      meshRebuildQueued.delete(task.taskKey);
      if (state.world.chunks.has(task.key) && !Game.constants3d.isActiveSimulationPosition3D(state, task.cx * CHUNK_SIZE, task.cz * CHUNK_SIZE)) {
        state.world.dirtyChunks.add(task.key);
        continue;
      }
      const oldEntry = chunkMeshes.get(task.key);
      const oldStats = meshStats(oldEntry && oldEntry[task.mode]);
      const next = setChunkMesh(state, task.cx, task.cy, task.cz, task.mode);
      totals.vertices += next.vertices - oldStats.vertices;
      totals.triangles += next.triangles - oldStats.triangles;
      totals.chunkMeshes += (next.vertices > 0 ? 1 : 0) - oldStats.meshes;
      if (performance.now() - start >= budget) break;
    } while (meshRebuildQueue.length);

    const chunkTaskPrefixes = new Set(meshRebuildQueue.map((task) => task.key));
    for (const key of state.world.dirtyChunks) chunkTaskPrefixes.add(key);
    totals.pendingDirtyChunks = chunkTaskPrefixes.size;
    totals.pendingMeshTasks = meshRebuildQueue.length;
    perf.meshMs = performance.now() - start;
    perf.meshTasks = meshRebuildQueue.length;
    perf.dirtyChunks = totals.pendingDirtyChunks;
    totals.textureTiles = atlasMeta ? atlasMeta.totalTiles : 0;
    debugInfo = totals;
  }

  function setWorld(state) {
    disposeSheepMeshes();
    disposeBotMeshes();
    disposePetMeshes();
    applyShaderProfile(state);
    disposePlayerModel();
    if (firstPersonGroup) {
      disposeObject3D(firstPersonGroup);
      firstPersonGroup.clear();
    }
    firstPersonItem = null;
    if (heldItemTexture) {
      if (Array.isArray(heldItemTexture)) heldItemTexture.forEach((texture) => texture.dispose && texture.dispose());
      else heldItemTexture.dispose();
      heldItemTexture = null;
    }
    rebuildAllChunks(state);
  }

  function resize(canvas, overlayCanvas) {
    if (!renderer || !camera) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w !== lastResizeW || h !== lastResizeH) {
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      lastResizeW = w;
      lastResizeH = h;
    }
    if (overlayCanvas && (overlayCanvas.width !== w || overlayCanvas.height !== h)) {
      overlayCanvas.width = w;
      overlayCanvas.height = h;
    }
  }

  function render(state, overlayCtx, overlayCanvas) {
    if (!renderer || !scene || !camera) return;
    optimizeIcons = !!(state.worldMeta && state.worldMeta.superOptimization);
    if (!optimizeIcons && blockIconCache.size) blockIconCache.clear();
    if (Game.performance3d) {
      const ratio = Game.performance3d.getRenderPixelRatio3D(state, window.innerWidth, window.innerHeight, window.devicePixelRatio);
      if (Math.abs(renderer.getPixelRatio() - ratio) > 0.001) renderer.setPixelRatio(ratio);
    }
    applyShaderProfile(state);
    applyVolcanicAtmosphere(state);
    if (state.world.dirtyAll) rebuildAllChunks(state);
    else if (state.world.dirtyChunks.size > 0 || meshRebuildQueue.length > 0) updateDirtyChunks(state);
    const player = state.player;
    const playerScale = Number.isFinite(player.scale) ? Math.max(0.25, Math.min(1024, player.scale)) : 1;
    const cosPitch = Math.cos(player.pitch);
    const lookX = Math.sin(player.yaw) * cosPitch;
    const lookY = Math.sin(player.pitch);
    const lookZ = Math.cos(player.yaw) * cosPitch;
    const look = new THREE.Vector3(lookX, lookY, lookZ).normalize();
    const shaders = shaderMode(state);
    const mode = shaders ? (state.ui.cameraMode || 'first') : 'first';
    const eyeY = player.y + EYE_HEIGHT * playerScale;
    if (mode === 'second') {
      applyThirdPersonCamera(state, player, mode, playerScale, look);
    } else if (mode === 'third') {
      applyThirdPersonCamera(state, player, mode, playerScale, look);
    } else {
      camera.position.set(player.x, eyeY, player.z);
      camera.lookAt(camera.position.x + lookX, camera.position.y + lookY, camera.position.z + lookZ);
    }
    const volcanicShake = state.volcanoes && Number.isFinite(state.volcanoes.shake) ? state.volcanoes.shake : 0;
    if (volcanicShake > 0) {
      const t = performance.now() * 0.001;
      camera.rotation.z += Math.sin(t * 38) * 0.012 * volcanicShake + Math.sin(t * 71) * 0.006 * volcanicShake;
      camera.position.y += Math.sin(t * 44) * 0.035 * volcanicShake;
    }
    if (light && shaders) {
      light.position.set(player.x + SUN_POSITION.x * 42, player.y + 52, player.z + SUN_POSITION.z * 42);
      light.target.position.set(player.x, player.y, player.z);
      scene.add(light.target);
    }
    if (sunMesh) {
      sunMesh.visible = shaders;
      if (shaders) sunMesh.position.set(player.x + SUN_POSITION.x * 155, player.y + 120, player.z + SUN_POSITION.z * 155);
    }
    if (sunGlowMesh) {
      sunGlowMesh.visible = shaders;
      if (shaders) sunGlowMesh.position.copy(sunMesh.position);
    }
    if (skyDome) {
      skyDome.visible = shaders;
      if (shaders) skyDome.position.set(player.x, player.y, player.z);
    }
    const model = shaders ? ensurePlayerModel(state) : playerModel;
    if (model) {
      model.visible = shaders;
      setPlayerModelShadowOnly(model, mode === 'first');
      model.position.set(player.x, player.y, player.z);
      model.rotation.y = player.yaw;
      const walkPulse = Math.sin(performance.now() * 0.008) * Math.min(0.08, Math.hypot(player.vx || 0, player.vz || 0) * 0.018);
      model.children.forEach((child, index) => {
        if (index < 2 || (index >= 7 && index <= 8)) child.rotation.x = (index % 2 ? -walkPulse : walkPulse);
      });
    }
    if (firstPersonGroup) {
      if (firstPersonGroup.children.length > 0) {
        disposeObject3D(firstPersonGroup);
        firstPersonGroup.clear();
        firstPersonItem = null;
        if (heldItemTexture) {
          if (Array.isArray(heldItemTexture)) heldItemTexture.forEach((texture) => texture.dispose && texture.dispose());
          else heldItemTexture.dispose();
          heldItemTexture = null;
        }
      }
      firstPersonGroup.visible = false;
    }
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
    updateLavaEmbers(state);
    updateExplosionMushrooms(state);
    updateDynamiteOverlays(state);
    updatePreviewOverlay(state);
    syncSheepMeshes(state);
    syncPetMeshes(state);
    syncBotMeshes(state);
    syncMovingBlockMeshes(state);
    updateCustomTntLabels(state);
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
