(() => {
  const Game = window.CubDep;
  const canvas3d = document.getElementById('game3d');
  const overlay = document.getElementById('game3dOverlay');
  const overlayCtx = overlay.getContext('2d');
  const menuRoot = document.getElementById('menuRoot');

  let state = null;
  let screen = 'menu';
  let last = performance.now();
  const input = Game.input3d.createInput3D(canvas3d, () => state);

  function makeSeed() {
    return Math.random().toString(36).slice(2, 10).toUpperCase();
  }

  function createWorldMeta(form) {
    return {
      id: `world-${Date.now().toString(36)}`,
      name: form.name && form.name.trim() ? form.name.trim() : 'Новый мир',
      seed: form.seed && form.seed.trim() ? form.seed.trim() : makeSeed(),
      mode: 'survival',
      worldType: 'normal',
      singleBiome: 'forest',
      cavernBiome: 'mix',
      kind: '3d',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  function setPlaying(playing) {
    screen = playing ? 'playing' : 'menu';
    menuRoot.classList.toggle('is-hidden', playing);
    canvas3d.classList.toggle('is-hidden', !playing);
    overlay.classList.toggle('is-hidden', !playing);
    if (Game.renderer3d) Game.renderer3d.setVisible(canvas3d, playing);
  }

  function renderMenu() {
    menuRoot.innerHTML = `
      <form class="menu-panel" id="newWorldForm">
        <h1 class="menu-title">Cubic Depths</h1>
        <p class="menu-subtitle">3D voxel survival prototype</p>
        <label class="menu-field">
          <span>Название мира</span>
          <input name="name" maxlength="40" placeholder="Новый мир" autocomplete="off" />
        </label>
        <label class="menu-field">
          <span>Сид</span>
          <input name="seed" maxlength="60" placeholder="Случайный сид" autocomplete="off" />
        </label>
        <div class="menu-actions">
          <button class="menu-btn menu-btn-primary" type="submit">Создать мир</button>
        </div>
        <div class="menu-hint">WASD - движение, Space - прыжок/всплытие, ЛКМ - добыча, ПКМ - поставить, R - починить блок, 1-6 - выбор блока.</div>
      </form>
    `;
  }

  function startWorld(form) {
    const meta = createWorldMeta(form);
    state = Game.state3d.createGameState3D(meta);
    Game.generation3d.generateWorld3D(state);
    if (!Game.renderer3d.init(canvas3d)) {
      menuRoot.innerHTML = '<div class="menu-panel">WebGL не удалось запустить.</div>';
      setPlaying(false);
      return;
    }
    Game.renderer3d.resize(canvas3d, overlay);
    Game.renderer3d.setWorld(state);
    input.resetMovement();
    setPlaying(true);
  }

  function resize() {
    if (screen === 'playing' && Game.renderer3d) Game.renderer3d.resize(canvas3d, overlay);
  }

  function update(dt) {
    if (!state) return;
    state.ui.fpsFrames += 1;
    state.ui.fpsAccum += dt;
    if (state.ui.fpsAccum >= 0.25) {
      state.ui.fps = state.ui.fpsFrames / state.ui.fpsAccum;
      state.ui.fpsFrames = 0;
      state.ui.fpsAccum = 0;
    }
    if (input.input.keys.Escape && !input.input.pointerLocked) {
      input.input.keys.Escape = false;
      setPlaying(false);
      renderMenu();
      return;
    }
    const mouse = input.consumeMouse();
    Game.player3d.updatePlayer3D(state, input.input, mouse, dt);
    Game.interaction3d.updateInteraction3D(state, input.input, input.consumeActions(), dt);
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
    }
    requestAnimationFrame(loop);
  }

  menuRoot.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.target);
    startWorld({
      name: data.get('name') || '',
      seed: data.get('seed') || '',
    });
  });

  window.addEventListener('resize', resize);
  renderMenu();
  setPlaying(false);
  requestAnimationFrame(loop);
})();
