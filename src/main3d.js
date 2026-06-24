(() => {
  const Game = window.CubDep;
  const canvas3d = document.getElementById('game3d');
  const overlay = document.getElementById('game3dOverlay');
  const overlayCtx = overlay.getContext('2d');
  const menuRoot = document.getElementById('menuRoot');
  const inventoryRoot = document.getElementById('inventoryRoot');
  const mapRoot = document.getElementById('mapRoot');

  let state = null;
  let screen = 'menu';
  let last = performance.now();
  let savedWorlds = new Map();
  let mapCanvas = null;
  let mapCtx = null;
  let mapDrag = null;
  const input = Game.input3d.createInput3D(canvas3d, () => state);
  const MAP_BITMAP_SIZE = 512;
  const MAP_MIN_ZOOM = 0.65;
  const MAP_MAX_ZOOM = 16;
  const MAP_BIOME_COLORS = {
    plains: '#6aa354',
    forest: '#2f6b42',
    desert: '#c9b36a',
    mountains: '#8f9693',
    lake: '#357fb3',
    beach: '#d8c78a',
    geysers: '#9a7b5a',
  };

  function makeSeed() {
    return Math.random().toString(36).slice(2, 10).toUpperCase();
  }

  function createWorldMeta(form) {
    return {
      id: `world-${Date.now().toString(36)}`,
      name: form.name && form.name.trim() ? form.name.trim() : 'Новый мир',
      seed: form.seed && form.seed.trim() ? form.seed.trim() : makeSeed(),
      mode: form.mode === 'creative' ? 'creative' : 'survival',
      worldType: 'normal',
      singleBiome: 'forest',
      cavernBiome: 'mix',
      kind: '3d',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      player: null,
    };
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[char]);
  }

  function setScreen(nextScreen) {
    screen = nextScreen;
    const worldVisible = screen === 'playing' || screen === 'paused' || screen === 'inventory' || screen === 'map';
    const menuVisible = screen === 'menu' || screen === 'paused';
    const inventoryVisible = screen === 'inventory';
    const mapVisible = screen === 'map';
    menuRoot.classList.toggle('is-hidden', !menuVisible);
    if (inventoryRoot) inventoryRoot.classList.toggle('is-hidden', !inventoryVisible);
    if (mapRoot) mapRoot.classList.toggle('is-hidden', !mapVisible);
    canvas3d.classList.toggle('is-hidden', !worldVisible);
    overlay.classList.toggle('is-hidden', !worldVisible);
    menuRoot.classList.toggle('is-pause-menu', screen === 'paused');
    if (Game.renderer3d) Game.renderer3d.setVisible(canvas3d, worldVisible);
    if (state && state.pause) state.pause.open = screen === 'paused' || screen === 'inventory' || screen === 'map';
  }

  function renderUnifiedMenu(context = screen === 'paused' ? 'pause' : 'start', view = 'main') {
    const isPause = context === 'pause';
    const name = state && state.worldMeta && state.worldMeta.name ? state.worldMeta.name : 'Мир';
    const seed = state && state.worldMeta && state.worldMeta.seed ? state.worldMeta.seed : '';
    const subtitle = isPause ? `${escapeHtml(name)}${seed ? ` / ${escapeHtml(seed)}` : ''}` : '3D voxel survival prototype';

    if (view === 'load') {
      menuRoot.innerHTML = `
        <div class="menu-panel ${isPause ? 'pause-panel' : ''}">
          <h1 class="menu-title">Загрузить мир</h1>
          <p class="menu-subtitle">${subtitle}</p>
          <div class="saved-worlds saved-worlds-standalone" id="savedWorlds">
            <div class="saved-worlds-empty">Загрузка...</div>
          </div>
          <div class="menu-actions">
            <button class="menu-btn" type="button" data-action="back-menu" data-context="${context}">Назад</button>
          </div>
        </div>
      `;
      renderSavedWorlds();
      return;
    }

    const fields = isPause ? '' : `
      <label class="menu-field">
        <span>Название мира</span>
        <input name="name" maxlength="40" placeholder="Новый мир" autocomplete="off" />
      </label>
      <label class="menu-field">
        <span>Сид</span>
        <input name="seed" maxlength="60" placeholder="Случайный сид" autocomplete="off" />
      </label>
      <div class="menu-field">
        <span>Режим</span>
        <div class="menu-mode-options">
          <label class="menu-mode-option">
            <input type="radio" name="mode" value="survival" checked />
            <span>Survival</span>
          </label>
          <label class="menu-mode-option">
            <input type="radio" name="mode" value="creative" />
            <span>Creative</span>
          </label>
        </div>
      </div>
    `;
    const primary = isPause
      ? '<button class="menu-btn menu-btn-primary" type="button" data-action="resume">Продолжить</button>'
      : '<button class="menu-btn menu-btn-primary" type="submit">Создать мир</button>';
    const pauseExit = isPause
      ? '<button class="menu-btn" type="button" data-action="main-menu">В главное меню</button>'
      : '';
    menuRoot.innerHTML = `
      <form class="menu-panel ${isPause ? 'pause-panel' : ''}" id="${isPause ? 'pauseMenuForm' : 'newWorldForm'}">
        <h1 class="menu-title">${isPause ? 'Пауза' : 'Cubic Depths'}</h1>
        <p class="menu-subtitle">${subtitle}</p>
        ${fields}
        <div class="menu-actions">
          ${primary}
          <button class="menu-btn" type="button" data-action="show-load" data-context="${context}">Загрузить мир</button>
          ${pauseExit}
        </div>
        <div class="menu-hint">${isPause ? 'После продолжения клик по миру снова захватит мышь.' : 'WASD - движение, Shift - ускорение, Space - прыжок/всплытие, ЛКМ - добыча, ПКМ - поставить, R - починить блок, 1-9/0 - выбор блока.'}</div>
      </form>
    `;
  }

  function formatDate(value) {
    if (!value) return '';
    try {
      return new Date(value).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
    } catch (error) {
      return '';
    }
  }

  async function renderSavedWorlds() {
    const root = document.getElementById('savedWorlds');
    if (!root) return;
    const storage = Game.storage3d;
    if (!storage || !storage.listWorldMetas || !storage.isAvailable()) {
      root.innerHTML = `
        <div class="saved-worlds-empty">IndexedDB недоступен.</div>
      `;
      return;
    }
    const worlds = await storage.listWorldMetas();
    savedWorlds = new Map(worlds.map((world) => [world.id, world]));
    if (!document.getElementById('savedWorlds')) return;
    if (!worlds.length) {
      root.innerHTML = `
        <div class="saved-worlds-empty">Пока нет сохраненных миров.</div>
      `;
      return;
    }
    root.innerHTML = `
      <div class="saved-worlds-list">
        ${worlds.map((world) => `
          <div class="saved-world-row">
            <button class="saved-world-load" type="button" data-action="load-world" data-world-id="${escapeHtml(world.id)}">
              <span class="saved-world-name">${escapeHtml(world.name || 'Мир')}</span>
              <span class="saved-world-meta">${escapeHtml(world.seed || '')}${world.updatedAt ? ` / ${escapeHtml(formatDate(world.updatedAt))}` : ''}</span>
            </button>
            <button class="saved-world-delete" type="button" data-action="delete-world" data-world-id="${escapeHtml(world.id)}" title="Удалить">x</button>
          </div>
        `).join('')}
      </div>
    `;
  }

  function capturePlayerMeta() {
    if (!state || !state.player) return null;
    return {
      x: state.player.x,
      y: state.player.y,
      z: state.player.z,
      yaw: state.player.yaw,
      pitch: state.player.pitch,
      inventory: Array.isArray(state.player.inventory)
        ? state.player.inventory.map((slot) => slot ? { id: slot.id, count: slot.count } : null)
        : [],
      hotbar: Array.isArray(state.player.hotbar)
        ? state.player.hotbar.map((slot) => slot ? { id: slot.id, count: slot.count } : null)
        : [],
    };
  }

  async function saveCurrentWorld() {
    if (!state || !state.worldMeta || !Game.storage3d || !Game.storage3d.saveWorldMeta) return false;
    state.worldMeta.player = capturePlayerMeta();
    state.worldMeta.updatedAt = Date.now();
    const metaSaved = await Game.storage3d.saveWorldMeta(state.worldMeta);
    if (!metaSaved) return false;
    if (Game.generation3d && Game.generation3d.saveAllModifiedChunks3D) {
      await Game.generation3d.saveAllModifiedChunks3D(state);
    }
    return true;
  }

  async function askSaveCurrentWorld() {
    if (!state || !state.worldMeta) return true;
    const name = state.worldMeta.name || 'Мир';
    if (!window.confirm(`Сохранить мир "${name}" перед выходом?`)) return true;
    const saved = await saveCurrentWorld();
    if (!saved) window.alert('Не удалось сохранить мир.');
    return saved;
  }

  async function startWorldFromMeta(meta, savedChunkKeys = []) {
    state = Game.state3d.createGameState3D(meta);
    if (Game.inventory3d) {
      if (Game.inventory3d.ensureInventory) Game.inventory3d.ensureInventory(state);
      if (Game.inventory3d.ensureHotbar) Game.inventory3d.ensureHotbar(state);
    }
    if (state.worldMeta.player && Number.isFinite(state.worldMeta.player.x)) {
      state.player.x = state.worldMeta.player.x;
      state.player.y = state.worldMeta.player.y;
      state.player.z = state.worldMeta.player.z;
      if (Number.isFinite(state.worldMeta.player.yaw)) state.player.yaw = state.worldMeta.player.yaw;
      if (Number.isFinite(state.worldMeta.player.pitch)) state.player.pitch = state.worldMeta.player.pitch;
    }
    if (savedChunkKeys.length > 0) state.world.savedChunks = new Set(savedChunkKeys);
    Game.generation3d.generateWorld3D(state);
    if (!Game.renderer3d.init(canvas3d)) {
      menuRoot.innerHTML = '<div class="menu-panel">WebGL не удалось запустить.</div>';
      setScreen('menu');
      return;
    }
    Game.renderer3d.resize(canvas3d, overlay);
    Game.renderer3d.setWorld(state);
    input.resetMovement();
    setScreen('playing');
  }

  async function startWorld(form) {
    const meta = createWorldMeta(form);
    await startWorldFromMeta(meta);
  }

  async function loadWorld(worldId) {
    if (state && screen !== 'menu') {
      const canLeave = await askSaveCurrentWorld();
      if (!canLeave) return;
    }
    const meta = savedWorlds.get(worldId);
    if (!meta) return;
    const savedChunkKeys = Game.storage3d && Game.storage3d.listChunkKeys ? await Game.storage3d.listChunkKeys(worldId) : [];
    await startWorldFromMeta(meta, savedChunkKeys);
  }

  async function deleteSavedWorld(worldId) {
    const meta = savedWorlds.get(worldId);
    if (!meta || !Game.storage3d || !Game.storage3d.deleteWorld) return;
    if (!window.confirm(`Удалить мир "${meta.name || 'Мир'}"?`)) return;
    await Game.storage3d.deleteWorld(worldId);
    renderSavedWorlds();
  }

  function resize() {
    if ((screen === 'playing' || screen === 'paused' || screen === 'inventory' || screen === 'map') && Game.renderer3d) Game.renderer3d.resize(canvas3d, overlay);
    if (screen === 'map') renderMap();
  }

  function openPauseMenu() {
    if (!state || screen !== 'playing') return;
    input.resetMovement();
    renderUnifiedMenu('pause', 'main');
    setScreen('paused');
  }

  function resumeWorld() {
    if (!state) return;
    input.resetMovement();
    if (Game.inventory3d && Game.inventory3d.clearCarried) Game.inventory3d.clearCarried(state);
    setScreen('playing');
  }

  function openInventory() {
    if (!state || screen !== 'playing') return;
    input.resetMovement();
    if (document.pointerLockElement === canvas3d && document.exitPointerLock) document.exitPointerLock();
    if (Game.inventory3d && inventoryRoot) Game.inventory3d.renderInventory(inventoryRoot, state);
    setScreen('inventory');
  }

  function closeInventory() {
    if (!state || screen !== 'inventory') return;
    if (Game.inventory3d && Game.inventory3d.clearCarried) Game.inventory3d.clearCarried(state);
    input.resetMovement();
    setScreen('playing');
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function ensureMapCanvas() {
    if (!mapRoot) return null;
    mapCanvas = mapRoot.querySelector('.map-canvas');
    if (!mapCanvas) return null;
    mapCtx = mapCanvas.getContext('2d');
    return mapCanvas;
  }

  function mapBitmapKey() {
    if (!state || !state.worldMeta) return '';
    return `${state.worldMeta.id || ''}:${state.worldMeta.seed || ''}:${MAP_BITMAP_SIZE}`;
  }

  function ensureMapBitmap() {
    if (!state || !state.world || !Game.generation3d || !Game.generation3d.getBiomeAt3D) return null;
    const key = mapBitmapKey();
    if (state.ui.mapBitmap && state.ui.mapBitmapKey === key) return state.ui.mapBitmap;
    const canvas = document.createElement('canvas');
    canvas.width = MAP_BITMAP_SIZE;
    canvas.height = MAP_BITMAP_SIZE;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(MAP_BITMAP_SIZE, MAP_BITMAP_SIZE);
    const world = state.world;
    const labels = Game.generation3d.BIOME_LABELS || {};
    const colorCache = {};
    for (const biome of Object.keys(labels)) {
      const color = MAP_BIOME_COLORS[biome] || '#777777';
      colorCache[biome] = [
        parseInt(color.slice(1, 3), 16),
        parseInt(color.slice(3, 5), 16),
        parseInt(color.slice(5, 7), 16),
      ];
    }
    for (let py = 0; py < MAP_BITMAP_SIZE; py += 1) {
      const z = Math.floor((py + 0.5) / MAP_BITMAP_SIZE * world.d);
      for (let px = 0; px < MAP_BITMAP_SIZE; px += 1) {
        const x = Math.floor((px + 0.5) / MAP_BITMAP_SIZE * world.w);
        const biome = Game.generation3d.getBiomeAt3D(state, x, z);
        const color = colorCache[biome] || [119, 119, 119];
        const i = (px + py * MAP_BITMAP_SIZE) * 4;
        image.data[i] = color[0];
        image.data[i + 1] = color[1];
        image.data[i + 2] = color[2];
        image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    state.ui.mapBitmap = canvas;
    state.ui.mapBitmapKey = key;
    return canvas;
  }

  function mapScreenToWorld(screenX, screenY) {
    if (!state || !mapCanvas) return { x: 0, z: 0 };
    const world = state.world;
    const zoom = clamp(state.ui.mapZoom || 1, MAP_MIN_ZOOM, MAP_MAX_ZOOM);
    const rect = mapCanvas.getBoundingClientRect();
    const scale = Math.min(rect.width / world.w, rect.height / world.d) * zoom;
    if (!Number.isFinite(scale) || scale <= 0) return { x: state.ui.mapCenterX || 0, z: state.ui.mapCenterZ || 0 };
    return {
      x: state.ui.mapCenterX + (screenX - rect.left - rect.width / 2) / scale,
      z: state.ui.mapCenterZ + (screenY - rect.top - rect.height / 2) / scale,
    };
  }

  function resizeMapCanvas() {
    const canvas = ensureMapCanvas();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width * window.devicePixelRatio));
    const height = Math.max(1, Math.floor(rect.height * window.devicePixelRatio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function renderMap() {
    const canvas = ensureMapCanvas();
    if (!canvas || !mapCtx || !state || !state.world) return;
    resizeMapCanvas();
    const bitmap = ensureMapBitmap();
    if (!bitmap) return;
    const ctx = mapCtx;
    const world = state.world;
    const width = canvas.width;
    const height = canvas.height;
    const zoom = clamp(state.ui.mapZoom || 1, MAP_MIN_ZOOM, MAP_MAX_ZOOM);
    const scale = Math.min(width / world.w, height / world.d) * zoom;
    const viewW = world.w * scale;
    const viewH = world.d * scale;
    const centerX = clamp(state.ui.mapCenterX || world.w / 2, 0, world.w);
    const centerZ = clamp(state.ui.mapCenterZ || world.d / 2, 0, world.d);
    state.ui.mapCenterX = centerX;
    state.ui.mapCenterZ = centerZ;

    const x = width / 2 - centerX * scale;
    const y = height / 2 - centerZ * scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#07090a';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bitmap, x, y, viewW, viewH);
    ctx.strokeStyle = 'rgba(255,255,255,0.42)';
    ctx.lineWidth = Math.max(1, window.devicePixelRatio);
    ctx.strokeRect(x + 0.5, y + 0.5, viewW - 1, viewH - 1);

    const playerX = x + state.player.x * scale;
    const playerY = y + state.player.z * scale;
    const marker = Math.max(7 * window.devicePixelRatio, Math.min(18 * window.devicePixelRatio, 10 * zoom));
    ctx.save();
    ctx.translate(playerX, playerY);
    ctx.rotate(Math.PI - (state.player.yaw || 0));
    ctx.fillStyle = '#ffdf7a';
    ctx.strokeStyle = 'rgba(0,0,0,0.72)';
    ctx.lineWidth = 2 * window.devicePixelRatio;
    ctx.beginPath();
    ctx.moveTo(0, -marker);
    ctx.lineTo(marker * 0.68, marker * 0.74);
    ctx.lineTo(0, marker * 0.42);
    ctx.lineTo(-marker * 0.68, marker * 0.74);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = 'rgba(8,12,16,0.72)';
    ctx.fillRect(12 * window.devicePixelRatio, 12 * window.devicePixelRatio, 180 * window.devicePixelRatio, 28 * window.devicePixelRatio);
    ctx.fillStyle = '#f5f0df';
    ctx.font = `${13 * window.devicePixelRatio}px Arial`;
    ctx.textBaseline = 'middle';
    ctx.fillText(`Zoom: ${zoom.toFixed(1)}x`, 24 * window.devicePixelRatio, 26 * window.devicePixelRatio);
  }

  function renderMapRoot() {
    if (!mapRoot || !state || !state.worldMeta) return;
    const labels = Game.generation3d && Game.generation3d.BIOME_LABELS ? Game.generation3d.BIOME_LABELS : {};
    const name = escapeHtml(state.worldMeta.name || 'Мир');
    const seed = escapeHtml(state.worldMeta.seed || '');
    mapRoot.innerHTML = `
      <div class="map-toolbar">
        <div class="map-title">
          <h2>Карта мира</h2>
          <div class="map-subtitle">${name}${seed ? ` / ${seed}` : ''}</div>
        </div>
        <div class="map-actions">
          <button class="map-btn" type="button" data-map-action="center">К игроку</button>
          <button class="map-btn" type="button" data-map-action="close">Закрыть</button>
        </div>
      </div>
      <div class="map-canvas-wrap">
        <canvas class="map-canvas"></canvas>
        <div class="map-legend">
          ${Object.keys(MAP_BIOME_COLORS).map((biome) => `
            <div class="map-legend-item">
              <span class="map-legend-swatch" style="background:${MAP_BIOME_COLORS[biome]}"></span>
              <span>${escapeHtml(labels[biome] || biome)}</span>
            </div>
          `).join('')}
        </div>
        <div class="map-hint">Колесо мыши - масштаб, перетаскивание - сдвиг, M или Escape - закрыть.</div>
      </div>
    `;
    ensureMapCanvas();
    renderMap();
  }

  function openMap() {
    if (!state || screen !== 'playing') return;
    input.resetMovement();
    if (document.pointerLockElement === canvas3d && document.exitPointerLock) document.exitPointerLock();
    state.ui.mapCenterX = state.player.x;
    state.ui.mapCenterZ = state.player.z;
    setScreen('map');
    renderMapRoot();
  }

  function closeMap() {
    if (!state || screen !== 'map') return;
    input.resetMovement();
    mapDrag = null;
    if (mapCanvas) mapCanvas.classList.remove('is-dragging');
    setScreen('playing');
  }

  function centerMapOnPlayer() {
    if (!state || !state.player) return;
    state.ui.mapCenterX = state.player.x;
    state.ui.mapCenterZ = state.player.z;
    renderMap();
  }

  function selectHotbarIndex(index) {
    if (!state || !Number.isInteger(index)) return;
    const hotbarSize = Game.inventory3d && Game.inventory3d.HOTBAR_SIZE ? Game.inventory3d.HOTBAR_SIZE : 10;
    if (index < 0 || index >= hotbarSize) return;
    state.player.selectedHotbarIndex = index;
    state.ui.mobileHotbarPage = Math.floor(index / 5);
    if (Game.inventory3d && Game.inventory3d.updateSelectedBlockFromHotbar) {
      Game.inventory3d.updateSelectedBlockFromHotbar(state);
    }
  }

  function handleMobileUiActions() {
    const actions = input.consumeUiActions ? input.consumeUiActions() : [];
    for (const action of actions) {
      if (action.type === 'pause') {
        openPauseMenu();
        return false;
      }
      if (action.type === 'inventory') {
        openInventory();
        return false;
      }
      if (action.type === 'hotbar') {
        selectHotbarIndex(action.index);
      } else if (action.type === 'hotbarPage') {
        const hotbar = Game.inventory3d && Game.inventory3d.ensureHotbar ? Game.inventory3d.ensureHotbar(state) : [];
        const maxPage = Math.max(0, Math.ceil(hotbar.length / 5) - 1);
        const current = Number.isInteger(state.ui.mobileHotbarPage)
          ? state.ui.mobileHotbarPage
          : Math.floor((state.player.selectedHotbarIndex || 0) / 5);
        state.ui.mobileHotbarPage = Math.max(0, Math.min(maxPage, current + action.delta));
      }
    }
    return true;
  }

  async function returnToMainMenu() {
    const canLeave = await askSaveCurrentWorld();
    if (!canLeave) return;
    input.resetMovement();
    mapDrag = null;
    state = null;
    renderUnifiedMenu('start', 'main');
    setScreen('menu');
  }

  function update(dt) {
    if (!state) return;
    if (Game.generation3d.ensureChunksAroundPlayer3D) Game.generation3d.ensureChunksAroundPlayer3D(state);
    state.ui.fpsFrames += 1;
    state.ui.fpsAccum += dt;
    if (state.ui.fpsAccum >= 0.25) {
      state.ui.fps = state.ui.fpsFrames / state.ui.fpsAccum;
      state.ui.fpsFrames = 0;
      state.ui.fpsAccum = 0;
    }
    if (input.input.keys.Escape && !input.input.pointerLocked) {
      input.input.keys.Escape = false;
      openPauseMenu();
      return;
    }
    state.ui.mobileMoveX = input.input.mobileMoveX || 0;
    state.ui.mobileMoveY = input.input.mobileMoveY || 0;
    if (!handleMobileUiActions()) return;
    const mouse = input.consumeMouse();
    Game.player3d.updatePlayer3D(state, input.input, mouse, dt);
    if (Game.entities3d) Game.entities3d.updateEntities3D(state, dt);
    Game.interaction3d.updateInteraction3D(state, input.input, input.consumeActions(), dt);
    if (Game.grass3d) Game.grass3d.updateGrass3D(state, dt);
    Game.fluids3d.updateFluids3D(state, dt);
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (screen === 'playing' && state) {
      update(dt);
      if (screen === 'playing') {
        Game.renderer3d.resize(canvas3d, overlay);
        Game.renderer3d.render(state, overlayCtx, overlay);
      }
    } else if ((screen === 'paused' || screen === 'inventory' || screen === 'map') && state) {
      if (Game.generation3d.ensureChunksAroundPlayer3D) Game.generation3d.ensureChunksAroundPlayer3D(state);
      Game.renderer3d.resize(canvas3d, overlay);
      Game.renderer3d.render(state, overlayCtx, overlay);
      if (screen === 'map') renderMap();
    }
    requestAnimationFrame(loop);
  }

  menuRoot.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.target);
    startWorld({
      name: data.get('name') || '',
      seed: data.get('seed') || '',
      mode: data.get('mode') || 'survival',
    });
  });

  menuRoot.addEventListener('click', (event) => {
    const target = event.target && event.target.closest ? event.target.closest('[data-action]') : event.target;
    const action = target && target.dataset ? target.dataset.action : '';
    if (action === 'resume') {
      resumeWorld();
    } else if (action === 'main-menu') {
      returnToMainMenu();
    } else if (action === 'show-load') {
      renderUnifiedMenu(target.dataset.context || (screen === 'paused' ? 'pause' : 'start'), 'load');
    } else if (action === 'back-menu') {
      renderUnifiedMenu(target.dataset.context || (screen === 'paused' ? 'pause' : 'start'), 'main');
    } else if (action === 'load-world') {
      loadWorld(target.dataset.worldId);
    } else if (action === 'delete-world') {
      deleteSavedWorld(target.dataset.worldId);
    }
  });

  if (inventoryRoot) {
    inventoryRoot.addEventListener('click', (event) => {
      if (!state || !Game.inventory3d) return;
      const result = Game.inventory3d.handleInventoryClick(state, event);
      if (result.close) {
        closeInventory();
        return;
      }
      if (result.full && state.ui) {
        state.ui.noticeText = 'Инвентарь полон';
        state.ui.noticeTimer = 1.35;
      }
      Game.inventory3d.renderInventory(inventoryRoot, state);
    });
    inventoryRoot.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      if (!state || !Game.inventory3d) return;
      const result = Game.inventory3d.handleInventoryClick(state, event);
      if (result.full && state.ui) {
        state.ui.noticeText = 'Инвентарь полон';
        state.ui.noticeTimer = 1.35;
      }
      Game.inventory3d.renderInventory(inventoryRoot, state);
    });
    inventoryRoot.addEventListener('mousemove', (event) => {
      if (!state || !Game.inventory3d || !Game.inventory3d.updatePointer) return;
      Game.inventory3d.updatePointer(event);
      if (Game.inventory3d.hasCarried && Game.inventory3d.hasCarried()) {
        Game.inventory3d.renderInventory(inventoryRoot, state);
      }
    });
  }

  if (mapRoot) {
    mapRoot.addEventListener('click', (event) => {
      const target = event.target && event.target.closest ? event.target.closest('[data-map-action]') : null;
      const action = target && target.dataset ? target.dataset.mapAction : '';
      if (action === 'close') closeMap();
      if (action === 'center') centerMapOnPlayer();
    });
    mapRoot.addEventListener('wheel', (event) => {
      if (!state || screen !== 'map') return;
      const canvas = ensureMapCanvas();
      if (!canvas) return;
      const before = mapScreenToWorld(event.clientX, event.clientY);
      const factor = event.deltaY < 0 ? 1.18 : 1 / 1.18;
      state.ui.mapZoom = clamp((state.ui.mapZoom || 1) * factor, MAP_MIN_ZOOM, MAP_MAX_ZOOM);
      const after = mapScreenToWorld(event.clientX, event.clientY);
      state.ui.mapCenterX = clamp((state.ui.mapCenterX || 0) + before.x - after.x, 0, state.world.w);
      state.ui.mapCenterZ = clamp((state.ui.mapCenterZ || 0) + before.z - after.z, 0, state.world.d);
      renderMap();
      event.preventDefault();
    }, { passive: false });
    mapRoot.addEventListener('pointerdown', (event) => {
      if (!state || screen !== 'map') return;
      const canvas = ensureMapCanvas();
      if (!canvas || event.target !== canvas) return;
      mapDrag = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        centerX: state.ui.mapCenterX || state.world.w / 2,
        centerZ: state.ui.mapCenterZ || state.world.d / 2,
      };
      canvas.classList.add('is-dragging');
      if (canvas.setPointerCapture) {
        try {
          canvas.setPointerCapture(event.pointerId);
        } catch (error) {
          // Pointer capture can fail if the browser has already canceled the pointer.
        }
      }
      event.preventDefault();
    });
    mapRoot.addEventListener('pointermove', (event) => {
      if (!state || screen !== 'map' || !mapDrag || mapDrag.pointerId !== event.pointerId) return;
      const canvas = ensureMapCanvas();
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const zoom = clamp(state.ui.mapZoom || 1, MAP_MIN_ZOOM, MAP_MAX_ZOOM);
      const scale = Math.min(rect.width / state.world.w, rect.height / state.world.d) * zoom;
      if (!Number.isFinite(scale) || scale <= 0) return;
      state.ui.mapCenterX = clamp(mapDrag.centerX - (event.clientX - mapDrag.x) / scale, 0, state.world.w);
      state.ui.mapCenterZ = clamp(mapDrag.centerZ - (event.clientY - mapDrag.y) / scale, 0, state.world.d);
      renderMap();
      event.preventDefault();
    });
    const endMapDrag = (event) => {
      if (!mapDrag || (event && mapDrag.pointerId !== event.pointerId)) return;
      mapDrag = null;
      if (mapCanvas) mapCanvas.classList.remove('is-dragging');
    };
    mapRoot.addEventListener('pointerup', endMapDrag);
    mapRoot.addEventListener('pointercancel', endMapDrag);
  }

  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyM' && screen === 'playing') {
      input.input.keys[event.code] = false;
      openMap();
      event.preventDefault();
      return;
    }
    if (event.code === 'KeyM' && screen === 'map') {
      input.input.keys[event.code] = false;
      closeMap();
      event.preventDefault();
      return;
    }
    if ((event.code === 'KeyE' || event.code === 'KeyY') && screen === 'playing') {
      input.input.keys[event.code] = false;
      openInventory();
      event.preventDefault();
      return;
    }
    if ((event.code === 'KeyE' || event.code === 'KeyY') && screen === 'inventory') {
      input.input.keys[event.code] = false;
      closeInventory();
      event.preventDefault();
      return;
    }
    if (event.code !== 'Escape') return;
    if (screen === 'playing') {
      input.input.keys.Escape = false;
      if (document.pointerLockElement === canvas3d && document.exitPointerLock) document.exitPointerLock();
      openPauseMenu();
      event.preventDefault();
    } else if (screen === 'paused') {
      input.input.keys.Escape = false;
      resumeWorld();
      event.preventDefault();
    } else if (screen === 'inventory') {
      input.input.keys.Escape = false;
      closeInventory();
      event.preventDefault();
    } else if (screen === 'map') {
      input.input.keys.Escape = false;
      closeMap();
      event.preventDefault();
    }
  });

  window.addEventListener('resize', resize);
  renderUnifiedMenu('start', 'main');
  setScreen('menu');
  requestAnimationFrame(loop);
})();
