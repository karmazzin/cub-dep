(() => {
  const Game = window.CubDep;
  const canvas3d = document.getElementById('game3d');
  const overlay = document.getElementById('game3dOverlay');
  const overlayCtx = overlay.getContext('2d');
  const menuRoot = document.getElementById('menuRoot');
  const inventoryRoot = document.getElementById('inventoryRoot');

  let state = null;
  let screen = 'menu';
  let last = performance.now();
  let lastMetaSave = 0;
  let savedWorlds = new Map();
  const input = Game.input3d.createInput3D(canvas3d, () => state);

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
    const worldVisible = screen === 'playing' || screen === 'paused' || screen === 'inventory';
    const menuVisible = screen === 'menu' || screen === 'paused';
    const inventoryVisible = screen === 'inventory';
    menuRoot.classList.toggle('is-hidden', !menuVisible);
    if (inventoryRoot) inventoryRoot.classList.toggle('is-hidden', !inventoryVisible);
    canvas3d.classList.toggle('is-hidden', !worldVisible);
    overlay.classList.toggle('is-hidden', !worldVisible);
    menuRoot.classList.toggle('is-pause-menu', screen === 'paused');
    if (Game.renderer3d) Game.renderer3d.setVisible(canvas3d, worldVisible);
    if (state && state.pause) state.pause.open = screen === 'paused' || screen === 'inventory';
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

  function persistWorldMeta(force = false) {
    if (!state || !state.worldMeta || !Game.storage3d || !Game.storage3d.saveWorldMeta) return;
    const now = performance.now();
    if (!force && now - lastMetaSave < 2000) return;
    lastMetaSave = now;
    state.worldMeta.player = capturePlayerMeta();
    state.worldMeta.updatedAt = Date.now();
    Game.storage3d.saveWorldMeta(state.worldMeta);
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
    persistWorldMeta(true);
  }

  async function startWorld(form) {
    const meta = createWorldMeta(form);
    if (Game.storage3d && Game.storage3d.saveWorldMeta) Game.storage3d.saveWorldMeta(meta);
    await startWorldFromMeta(meta);
  }

  async function loadWorld(worldId) {
    persistWorldMeta(true);
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
    if ((screen === 'playing' || screen === 'paused' || screen === 'inventory') && Game.renderer3d) Game.renderer3d.resize(canvas3d, overlay);
  }

  function openPauseMenu() {
    if (!state || screen !== 'playing') return;
    persistWorldMeta(true);
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
    persistWorldMeta(true);
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

  function returnToMainMenu() {
    persistWorldMeta(true);
    input.resetMovement();
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
    const mouse = input.consumeMouse();
    Game.player3d.updatePlayer3D(state, input.input, mouse, dt);
    persistWorldMeta(false);
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
    } else if ((screen === 'paused' || screen === 'inventory') && state) {
      if (Game.generation3d.ensureChunksAroundPlayer3D) Game.generation3d.ensureChunksAroundPlayer3D(state);
      Game.renderer3d.resize(canvas3d, overlay);
      Game.renderer3d.render(state, overlayCtx, overlay);
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

  window.addEventListener('keydown', (event) => {
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
    }
  });

  window.addEventListener('resize', resize);
  window.addEventListener('beforeunload', () => persistWorldMeta(true));
  renderUnifiedMenu('start', 'main');
  setScreen('menu');
  requestAnimationFrame(loop);
})();
