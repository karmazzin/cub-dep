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
  let lastAutosaveAt = 0;
  let autosaveRunning = false;
  let autosavePending = false;
  let autosaveBaseWorldId = '';
  let dimensionSwitching = false;
  const input = Game.input3d.createInput3D(canvas3d, () => state);
  const AUTOSAVE_WORLD_ID = '__autosave__';
  const AUTOSAVE_INTERVAL_MS = 10000;
  const MAP_BITMAP_SIZE = 512;
  const MAP_MIN_ZOOM = 0.65;
  const MAP_MAX_ZOOM = 16;
  const MAP_TELEPORT_CHUNK_RADIUS = 1;
  const MAP_BIOME_COLORS = {
    plains: '#6aa354',
    forest: '#2f6b42',
    desert: '#c9b36a',
    mountains: '#8f9693',
    cliffs: '#6f7472',
    volcanic: '#2b2528',
    snow_plains: '#d8e5ea',
    spruce_forest: '#254f46',
    mountain_forest: '#4f6650',
    lake: '#357fb3',
    beach: '#d8c78a',
    geysers: '#9a7b5a',
    deep_cavern: '#35353a',
  };
  const SPAWN_SEED_SEARCH_ATTEMPTS = 3000;
  const PLAYER_SKIN_STORAGE_KEY = 'cubdep-player-skin';
  const PLAYER_SKINS = [
    {
      id: 'explorer',
      label: 'Cubic Explorer',
      description: 'Короткие волосы, синие глаза, черная худи.',
      hair: '#4a2f1d',
      eye: '#1459b5',
      accent: '#25b8c5',
      pants: '#1b2630',
    },
    {
      id: 'explorer_female',
      label: 'Cubic Explorer Female',
      description: 'Длинные волосы, бирюзовые глаза, черная худи.',
      hair: '#6b4428',
      eye: '#2aa7ad',
      accent: '#25b8c5',
      pants: '#4c586c',
    },
  ];
  const SPAWN_BIOME_OPTIONS = [
    { id: 'any', label: 'Любой' },
    { id: 'plains', label: 'Равнина' },
    { id: 'forest', label: 'Лес' },
    { id: 'desert', label: 'Пустыня' },
    { id: 'mountains', label: 'Горы' },
    { id: 'cliffs', label: 'Скалы' },
    { id: 'volcanic', label: 'Вулканический биом' },
    { id: 'snow_plains', label: 'Снежная равнина' },
    { id: 'spruce_forest', label: 'Хвойный лес' },
    { id: 'mountain_forest', label: 'Горный лес' },
    { id: 'beach', label: 'Пляж' },
    { id: 'geysers', label: 'Долина гейзеров' },
  ];
  const SPAWN_BIOME_IDS = new Set(SPAWN_BIOME_OPTIONS.map((item) => item.id));

  function makeSeed() {
    return Math.random().toString(36).slice(2, 10).toUpperCase();
  }

  function normalizeChunkRenderDistance(value) {
    return Game.constants3d && Game.constants3d.normalizeChunkRenderDistance
      ? Game.constants3d.normalizeChunkRenderDistance(value)
      : 'auto';
  }

  function renderChunkRenderDistanceOptions(selected = 'auto') {
    const normalized = normalizeChunkRenderDistance(selected);
    const options = [`<option value="auto" ${normalized === 'auto' ? 'selected' : ''}>Авто</option>`];
    for (let distance = 1; distance <= 10; distance += 1) {
      options.push(`<option value="${distance}" ${normalized === distance ? 'selected' : ''}>${distance}</option>`);
    }
    return options.join('');
  }

  function normalizeSpawnBiome(value) {
    const id = String(value || 'any').trim();
    return SPAWN_BIOME_IDS.has(id) ? id : 'any';
  }

  function renderSpawnBiomeOptions(selected = 'any') {
    const normalized = normalizeSpawnBiome(selected);
    return SPAWN_BIOME_OPTIONS.map((item) => (
      `<option value="${item.id}" ${item.id === normalized ? 'selected' : ''}>${escapeHtml(item.label)}</option>`
    )).join('');
  }

  function normalizePlayerSkin(value) {
    return Game.state3d && Game.state3d.normalizePlayerSkin
      ? Game.state3d.normalizePlayerSkin(value)
      : (value === 'explorer_female' ? 'explorer_female' : 'explorer');
  }

  function getStoredPlayerSkin() {
    try {
      return normalizePlayerSkin(window.localStorage && window.localStorage.getItem(PLAYER_SKIN_STORAGE_KEY));
    } catch (error) {
      return 'explorer';
    }
  }

  function setStoredPlayerSkin(id) {
    const normalized = normalizePlayerSkin(id);
    try {
      if (window.localStorage) window.localStorage.setItem(PLAYER_SKIN_STORAGE_KEY, normalized);
    } catch (error) {
      // localStorage can be unavailable in some browser modes.
    }
    return normalized;
  }

  function skinById(id) {
    const normalized = normalizePlayerSkin(id);
    return PLAYER_SKINS.find((skin) => skin.id === normalized) || PLAYER_SKINS[0];
  }

  function renderSkinPreviewHtml(id, small = false) {
    const skin = skinById(id);
    const longHair = skin.id === 'explorer_female';
    return `
      <div class="skin-preview ${small ? 'skin-preview-small' : ''}" aria-label="${escapeHtml(skin.label)}">
        <div class="skin-head" style="--hair:${skin.hair}; --eye:${skin.eye};">
          <span class="skin-hair skin-hair-top"></span>
          <span class="skin-hair skin-hair-left ${longHair ? 'is-long' : ''}"></span>
          <span class="skin-hair skin-hair-right ${longHair ? 'is-long' : ''}"></span>
          ${longHair ? '<span class="skin-bow"></span>' : ''}
          <span class="skin-eye skin-eye-left"></span>
          <span class="skin-eye skin-eye-right"></span>
        </div>
        <div class="skin-body" style="--accent:${skin.accent}; --pants:${skin.pants};">
          <span class="skin-arm skin-arm-left"></span>
          <span class="skin-torso"></span>
          <span class="skin-arm skin-arm-right"></span>
          <span class="skin-leg skin-leg-left"></span>
          <span class="skin-leg skin-leg-right"></span>
        </div>
      </div>
    `;
  }

  function renderSkinChooser(context = 'start', returnView = 'main') {
    const selected = getStoredPlayerSkin();
    menuRoot.innerHTML = `
      <div class="menu-panel">
        <h1 class="menu-title">Выбор скина</h1>
        <p class="menu-subtitle">Скин виден в шейдерном режиме при смене лица камеры.</p>
        <div class="skin-choice-grid">
          ${PLAYER_SKINS.map((skin) => `
            <button class="skin-choice ${skin.id === selected ? 'is-selected' : ''}" type="button" data-action="select-skin" data-skin-id="${skin.id}" data-context="${escapeHtml(context)}" data-return-view="${escapeHtml(returnView)}">
              ${renderSkinPreviewHtml(skin.id, true)}
              <span class="skin-choice-name">${escapeHtml(skin.label)}</span>
              <span class="skin-choice-desc">${escapeHtml(skin.description)}</span>
            </button>
          `).join('')}
        </div>
        <div class="menu-actions">
          <button class="menu-btn" type="button" data-action="back-menu" data-context="${escapeHtml(context)}" data-return-view="${escapeHtml(returnView)}">Назад</button>
        </div>
      </div>
    `;
    setScreen('menu');
  }

  function waitForNextFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
  }

  function renderWorldCreationStatus(spawnBiome = 'any') {
    const searchingSeed = normalizeSpawnBiome(spawnBiome) !== 'any';
    menuRoot.innerHTML = `
      <div class="menu-panel">
        <h1 class="menu-title">${searchingSeed ? 'Поиск сида' : 'Создание мира'}</h1>
        <p class="menu-subtitle">${searchingSeed ? 'Ищем подходящий стартовый биом.' : 'Готовим стартовую область.'}</p>
        ${searchingSeed ? '<p class="menu-hint" id="seedSearchStatus">Готовим проверку сидов.</p>' : ''}
      </div>
    `;
    setScreen('menu');
  }

  function updateSeedSearchStatus(seed) {
    const status = document.getElementById('seedSearchStatus');
    if (!status) return;
    status.textContent = seed ? `Проверяем сид ${seed}` : 'Готовим проверку сидов.';
  }

  function syncSpawnSeedInput() {
    const form = document.getElementById('newWorldForm');
    if (!form) return;
    const seedInput = form.querySelector('input[name="seed"]');
    const spawnSelect = form.querySelector('select[name="spawnBiome"]');
    if (!seedInput || !spawnSelect) return;
    const searchingSeed = normalizeSpawnBiome(spawnSelect.value) !== 'any';
    seedInput.disabled = searchingSeed;
    seedInput.placeholder = searchingSeed ? 'Сид будет найден автоматически' : 'Случайный сид';
    if (searchingSeed) seedInput.value = '';
  }

  function syncCreativeForcedInputs() {
    const form = document.getElementById('newWorldForm');
    if (!form) return;
    const expandedInput = form.querySelector('input[name="expandedBlockAssortment"]');
    const explosionInput = form.querySelector('input[name="explosionPackEnabled"]');
    const survivalInput = form.querySelector('input[name="mode"][value="survival"]');
    const creativeInput = form.querySelector('input[name="mode"][value="creative"]');
    if (!survivalInput || !creativeInput) return;
    const forced = !!((expandedInput && expandedInput.checked) || (explosionInput && explosionInput.checked));
    survivalInput.disabled = forced;
    if (forced) creativeInput.checked = true;
  }

  async function resolveSeedForSpawnBiome(form) {
    const spawnBiome = normalizeSpawnBiome(form && form.spawnBiome);
    if (spawnBiome === 'any') {
      const seed = form && form.seed && form.seed.trim ? form.seed.trim() : '';
      return { seed: seed || makeSeed(), usedSearch: false };
    }
    const generation = Game.generation3d;
    if (!generation || !generation.seedHasDefaultSpawnBiome3D) {
      return { seed: makeSeed(), usedSearch: false };
    }
    for (let attempt = 0; attempt < SPAWN_SEED_SEARCH_ATTEMPTS; attempt += 1) {
      const seed = makeSeed();
      updateSeedSearchStatus(seed);
      if (generation.seedHasDefaultSpawnBiome3D(seed, spawnBiome)) {
        return { seed, usedSearch: true };
      }
      if (attempt % 30 === 29) await waitForNextFrame();
    }
    return { seed: makeSeed(), usedSearch: false };
  }

  function createWorldMeta(form) {
    const chunkRenderDistance = normalizeChunkRenderDistance(form.chunkRenderDistance);
    const spawnBiome = normalizeSpawnBiome(form.spawnBiome);
    const expandedBlockAssortment = form.expandedBlockAssortment === true;
    const explosionPackEnabled = form.explosionPackEnabled === true;
    return {
      id: `world-${Date.now().toString(36)}`,
      name: form.name && form.name.trim() ? form.name.trim() : 'Новый мир',
      seed: form.seed && form.seed.trim() ? form.seed.trim() : makeSeed(),
      mode: expandedBlockAssortment || explosionPackEnabled || form.mode === 'creative' ? 'creative' : 'survival',
      shadersEnabled: form.shadersEnabled === true,
      expandedBlockAssortment,
      explosionPackEnabled,
      playerSkin: normalizePlayerSkin(form.playerSkin || getStoredPlayerSkin()),
      chunkRenderDistance,
      spawnBiome,
      spawnBiomeSeedSearch: form.spawnBiomeSeedSearch === true,
      botsEnabled: form.botsEnabled === true,
      worldType: 'normal',
      singleBiome: 'forest',
      cavernBiome: 'mix',
      kind: '3d',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      player: null,
    };
  }

  function createEducationWorldMeta(countryId, grade, subjectId, lesson) {
    const education = Game.education3d
      ? Game.education3d.createEducationMeta(countryId, grade, subjectId, lesson)
      : null;
    const subject = education && education.subjectLabel ? education.subjectLabel : 'Обучение';
    const lessonNumber = education && education.lesson ? education.lesson : 1;
    return {
      id: `education-${Date.now().toString(36)}`,
      name: `Обучение: ${subject}, урок ${lessonNumber}`,
      seed: makeSeed(),
      mode: 'education',
      worldType: 'normal',
      singleBiome: 'forest',
      cavernBiome: 'mix',
      kind: '3d',
      education,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      player: null,
    };
  }

  function createGrade5ExamWorldMeta(countryId) {
    const education = Game.education3d && Game.education3d.createGrade5ExamMeta
      ? Game.education3d.createGrade5ExamMeta(countryId)
      : null;
    return {
      id: `education-exam-${Date.now().toString(36)}`,
      name: 'Экзамен перед 5 классом',
      seed: makeSeed(),
      mode: 'education',
      worldType: 'normal',
      singleBiome: 'forest',
      cavernBiome: 'mix',
      kind: '3d',
      education,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      player: null,
    };
  }

  function createGrade6ExamWorldMeta(countryId) {
    const education = Game.education3d && Game.education3d.createGrade6ExamMeta
      ? Game.education3d.createGrade6ExamMeta(countryId)
      : null;
    return {
      id: `education-exam-${Date.now().toString(36)}`,
      name: 'Экзамен перед 6 классом',
      seed: makeSeed(),
      mode: 'education',
      worldType: 'normal',
      singleBiome: 'forest',
      cavernBiome: 'mix',
      kind: '3d',
      education,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      player: null,
    };
  }

  function createCustomLessonEditorWorldMeta(courseId, lesson) {
    const course = Game.education3d && Game.education3d.customCourseById ? Game.education3d.customCourseById(courseId) : null;
    const seed = lesson && lesson.seed ? lesson.seed : makeSeed();
    return {
      id: lesson && lesson.mapWorldId ? lesson.mapWorldId : `custom-map-${Date.now().toString(36)}`,
      name: `Редактор урока: ${lesson && lesson.title ? lesson.title : 'Урок'}`,
      seed,
      mode: 'creative',
      worldType: 'normal',
      singleBiome: 'forest',
      cavernBiome: 'mix',
      kind: '3d',
      customLessonEditor: {
        courseId,
        lessonId: lesson ? lesson.id : '',
        countryId: course ? course.countryId : 'ru',
        grade: course ? course.grade : 1,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      player: null,
    };
  }

  function createCustomLessonPlayWorldMeta(courseId, lesson, savedMapMeta = null) {
    const course = Game.education3d && Game.education3d.customCourseById ? Game.education3d.customCourseById(courseId) : null;
    const playMode = Game.education3d && Game.education3d.normalizeCustomLessonMode
      ? Game.education3d.normalizeCustomLessonMode(lesson && lesson.mode)
      : 'survival';
    const seed = lesson && lesson.seed ? lesson.seed : makeSeed();
    const spawnMode = Game.education3d && Game.education3d.normalizeCustomLessonSpawnMode
      ? Game.education3d.normalizeCustomLessonSpawnMode(lesson && lesson.spawnMode)
      : 'editor_position';
    const editorPlayer = savedMapMeta && savedMapMeta.player && Number.isFinite(savedMapMeta.player.x)
      ? { ...savedMapMeta.player }
      : null;
    return {
      id: lesson && lesson.hasMap && lesson.mapWorldId ? lesson.mapWorldId : `custom-play-${Date.now().toString(36)}`,
      name: `Урок: ${lesson && lesson.title ? lesson.title : 'Урок'}`,
      seed,
      mode: playMode === 'creative_adventure' ? 'creative' : 'survival',
      worldType: 'normal',
      singleBiome: 'forest',
      cavernBiome: 'mix',
      kind: '3d',
      customLessonPlay: {
        courseId,
        lessonId: lesson ? lesson.id : '',
        countryId: course ? course.countryId : 'ru',
        grade: course ? course.grade : 1,
        title: lesson && lesson.title ? lesson.title : 'Урок',
        code: lesson && lesson.code ? JSON.parse(JSON.stringify(lesson.code)) : null,
        mode: playMode,
        spawnMode,
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      player: spawnMode === 'editor_position' ? editorPlayer : null,
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

  function customLessonCodeActions(lesson) {
    const code = lesson && lesson.code && typeof lesson.code === 'object' ? lesson.code : {};
    const actions = Array.isArray(code.actions) ? code.actions : [];
    return actions.length ? actions : [{ number: 1, start: [], complete: [] }];
  }

  function customLessonCodeAction(lesson, number) {
    const actions = customLessonCodeActions(lesson);
    return actions.find((item) => Number(item.number) === Number(number)) || actions[0];
  }

  function formatCodeStartBlock(block) {
    if (!block) return '';
    if (block.type === 'give') return `Выдать предмет [${block.item || 'предмет'}] в ячейку [${block.slot || 1}]`;
    if (block.type === 'teleport') return `Телепортировать игрока в координаты [${block.coords || '0, 0, 0'}]`;
    if (block.type === 'say') return `Написать ему [${block.text || 'текст'}]`;
    if (block.type === 'thumbnail') return `Поставить миниатюру [${block.name || 'файл'}]`;
    return 'Неизвестный блок';
  }

  function formatCodeCompleteBlock(block) {
    if (!block) return '';
    if (block.type === 'place') return `Поставил блок [${block.block || 'блок'}]`;
    if (block.type === 'mine') return `Разрушил блок [${block.block || 'блок'}]`;
    if (block.type === 'biome') return `Попал в биом [${block.biome || 'биом'}]`;
    return 'Неизвестное условие';
  }

  function codeItemSortRank(id, label) {
    const block = Game.blocks && Game.blocks.BLOCK ? Game.blocks.BLOCK : {};
    const frequent = [
      block.DIRT, block.STONE, block.WOOD, block.PLANK, block.SAND, block.WATER,
      block.LEAF, block.GRASS, block.LAVA, block.BORDER,
    ];
    const index = frequent.indexOf(Number(id));
    if (index >= 0) return index;
    if (label && String(label).startsWith('Буква ')) return 200 + String(label).charCodeAt(6);
    if (Number(id) < 0) return 600 + Math.abs(Number(id));
    if (String(label || '').startsWith('ТНТ') || String(label || '').includes('портал')) return 700 + Number(id);
    return 300 + Number(id);
  }

  function lessonCodeItems(includeSpawnEggs = true) {
    const labels = Game.interaction3d && Game.interaction3d.BLOCK_LABELS ? Game.interaction3d.BLOCK_LABELS : {};
    const entries = Object.keys(labels)
      .map((id) => ({ id: Number(id), label: labels[id] }))
      .filter((item) => Number.isFinite(item.id) && item.label && (includeSpawnEggs || item.id >= 0));
    entries.sort((a, b) => {
      const rank = codeItemSortRank(a.id, a.label) - codeItemSortRank(b.id, b.label);
      return rank || String(a.label).localeCompare(String(b.label), 'ru');
    });
    return entries;
  }

  function lessonCodeItemLabel(id) {
    const labels = Game.interaction3d && Game.interaction3d.BLOCK_LABELS ? Game.interaction3d.BLOCK_LABELS : {};
    return labels[id] || '';
  }

  function defaultLessonCodeItem(includeSpawnEggs = true) {
    return lessonCodeItems(includeSpawnEggs)[0] || { id: 2, label: 'Земля' };
  }

  function selectedCodeItemId(value, fallbackLabel = '') {
    if (value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))) return Number(value);
    const wanted = String(fallbackLabel || value || '').trim().toLowerCase();
    const found = lessonCodeItems(true).find((item) => String(item.label).trim().toLowerCase() === wanted);
    return found ? found.id : null;
  }

  function renderCodeItemOptions(selected, includeSpawnEggs = true) {
    const selectedId = selectedCodeItemId(selected && selected.itemId, selected && (selected.item || selected.block));
    return lessonCodeItems(includeSpawnEggs).map((item) => `
      <option value="${item.id}" ${item.id === selectedId ? 'selected' : ''}>${escapeHtml(item.label)}</option>
    `).join('');
  }

  function renderBiomeOptions(selected) {
    const labels = Game.generation3d && Game.generation3d.BIOME_LABELS ? Game.generation3d.BIOME_LABELS : {};
    return Object.keys(labels).map((id) => `
      <option value="${escapeHtml(labels[id])}" ${String(selected || '').toLowerCase() === String(labels[id]).toLowerCase() || String(selected || '').toLowerCase() === id ? 'selected' : ''}>${escapeHtml(labels[id])}</option>
    `).join('');
  }

  function renderCodeBlockControls(block, actionNumber, blockKind, index, context) {
    const common = `data-country-id="${escapeHtml(context.countryId || 'ru')}" data-grade="${Number(context.grade) || 1}" data-course-id="${escapeHtml(context.courseId || '')}" data-lesson-id="${escapeHtml(context.lessonId || '')}" data-action-number="${actionNumber}" data-block-kind="${blockKind}" data-block-index="${index}"`;
    if (block.type === 'give') {
      return `
        <span>Выдать предмет</span>
        <select class="lesson-code-param lesson-code-param-wide" data-action="education-custom-code-edit-block" data-code-field="itemId" ${common}>${renderCodeItemOptions(block, true)}</select>
        <span>в ячейку</span>
        <input class="lesson-code-param lesson-code-param-small" type="number" min="1" max="10" value="${Number(block.slot) || 1}" data-action="education-custom-code-edit-block" data-code-field="slot" ${common} />
      `;
    }
    if (block.type === 'teleport') {
      return `
        <span>Телепортировать игрока в координаты</span>
        <input class="lesson-code-param lesson-code-param-wide" value="${escapeHtml(block.coords || '')}" placeholder="10, 65, 20" data-action="education-custom-code-edit-block" data-code-field="coords" ${common} />
      `;
    }
    if (block.type === 'say') {
      return `
        <span>Написать ему</span>
        <input class="lesson-code-param lesson-code-param-wide" value="${escapeHtml(block.text || '')}" placeholder="Текст" data-action="education-custom-code-edit-block" data-code-field="text" ${common} />
      `;
    }
    if (block.type === 'thumbnail') {
      return `<span>Поставить миниатюру</span><span class="lesson-code-param-label">${escapeHtml(block.name || 'файл')}</span>`;
    }
    if (block.type === 'place' || block.type === 'mine') {
      return `
        <span>${block.type === 'place' ? 'Поставил блок' : 'Разрушил блок'}</span>
        <select class="lesson-code-param lesson-code-param-wide" data-action="education-custom-code-edit-block" data-code-field="blockId" ${common}>${renderCodeItemOptions({ itemId: block.blockId, item: block.block }, false)}</select>
      `;
    }
    if (block.type === 'biome') {
      return `
        <span>Попал в биом</span>
        <select class="lesson-code-param lesson-code-param-wide" data-action="education-custom-code-edit-block" data-code-field="biome" ${common}>${renderBiomeOptions(block.biome)}</select>
      `;
    }
    return '<span>Неизвестный блок</span>';
  }

  function renderCodeBlockList(blocks, emptyText, removeAction, actionNumber, blockKind, context = {}) {
    if (!blocks || !blocks.length) {
      return `<div class="lesson-code-empty">${escapeHtml(emptyText)}</div>`;
    }
    return blocks.map((block, index) => `
      <div class="lesson-code-block lesson-code-block-${escapeHtml(block.type || 'unknown')}">
        <div class="lesson-code-block-content">
          ${renderCodeBlockControls(block, actionNumber, blockKind, index, context)}
        </div>
        <button class="lesson-code-remove" type="button" data-action="${removeAction}" data-country-id="${escapeHtml(context.countryId || 'ru')}" data-grade="${Number(context.grade) || 1}" data-course-id="${escapeHtml(context.courseId || '')}" data-lesson-id="${escapeHtml(context.lessonId || '')}" data-action-number="${actionNumber}" data-block-kind="${blockKind}" data-block-index="${index}" title="Удалить">x</button>
      </div>
    `).join('');
  }

  function getEducationCountryLabel(countryId) {
    const countries = Game.education3d && Array.isArray(Game.education3d.COUNTRIES) ? Game.education3d.COUNTRIES : [];
    const country = countries.find((item) => item.id === countryId);
    return country ? country.label : 'Россия';
  }

  function openEducationMenu() {
    const countryId = Game.education3d && Game.education3d.getSavedCountryId ? Game.education3d.getSavedCountryId() : '';
    if (countryId) renderUnifiedMenu('start', 'education-grade', { countryId });
    else renderUnifiedMenu('start', 'education-country');
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

  function renderUnifiedMenu(context = screen === 'paused' ? 'pause' : 'start', view = 'main', options = {}) {
    const isPause = context === 'pause';
    const creatingWorld = !isPause && (view === 'world-create' || view === 'bot-world');
    const creatingBotWorld = !isPause && view === 'bot-world';
    const name = state && state.worldMeta && state.worldMeta.name ? state.worldMeta.name : 'Мир';
    const seed = state && state.worldMeta && state.worldMeta.seed ? state.worldMeta.seed : '';
    const subtitle = isPause
      ? `${escapeHtml(name)}${seed ? ` / ${escapeHtml(seed)}` : ''}`
      : (creatingBotWorld ? 'Мир с алгоритмическими ботами-игроками' : '3D voxel survival prototype');

    if (!isPause && view === 'main') {
      const currentSkin = getStoredPlayerSkin();
      menuRoot.innerHTML = `
        <div class="menu-panel menu-panel-main">
          <h1 class="menu-title menu-title-cubic">Cubic Depths</h1>
          <p class="menu-subtitle">3D voxel survival prototype</p>
          <div class="menu-main-skin">
            ${renderSkinPreviewHtml(currentSkin)}
            <button class="menu-btn" type="button" data-action="show-skins" data-context="start" data-return-view="main">Выбрать скин</button>
          </div>
          <div class="menu-actions menu-actions-main">
            <button class="menu-btn menu-btn-primary" type="button" data-action="show-single-world">Одиночная игра</button>
            <button class="menu-btn" type="button" data-action="show-bot-world" data-context="start">Играть с ботами</button>
            <button class="menu-btn" type="button" data-action="show-load" data-context="start">Загрузить мир</button>
            <button class="menu-btn" type="button" data-action="show-education" data-context="start">Обучение</button>
          </div>
        </div>
      `;
      return;
    }

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

    if (!isPause && view === 'education-country') {
      const countries = Game.education3d ? Game.education3d.COUNTRIES : [];
      menuRoot.innerHTML = `
        <div class="menu-panel menu-panel-wide">
          <h1 class="menu-title">Обучение</h1>
          <p class="menu-subtitle">Выберите страну программы.</p>
          <div class="education-grid education-grid-countries">
            ${countries.map((country) => `
              <button class="menu-btn education-option" type="button" data-action="education-country" data-country-id="${escapeHtml(country.id)}">
                ${escapeHtml(country.label)}
              </button>
            `).join('')}
          </div>
          <div class="menu-actions">
            <button class="menu-btn" type="button" data-action="back-menu" data-context="start">Назад</button>
          </div>
        </div>
      `;
      return;
    }

    if (!isPause && view === 'education-grade') {
      const countryId = options.countryId || 'ru';
      menuRoot.innerHTML = `
        <div class="menu-panel">
          <h1 class="menu-title">Класс</h1>
          <p class="menu-subtitle">${escapeHtml(getEducationCountryLabel(countryId))}. Сейчас работают 1-11 классы.</p>
          <div class="education-grid education-grid-grades">
            ${Array.from({ length: 11 }, (_, i) => i + 1).map((grade) => `
              <button class="menu-btn education-option" type="button" data-action="education-grade" data-country-id="${escapeHtml(countryId)}" data-grade="${grade}">
                ${grade}
              </button>
            `).join('')}
          </div>
          <div class="menu-actions">
            <button class="menu-btn" type="button" data-action="change-education-country" data-context="start">Сменить страну</button>
            <button class="menu-btn" type="button" data-action="back-menu" data-context="start">Назад</button>
          </div>
        </div>
      `;
      return;
    }

    if (!isPause && view === 'education-unavailable') {
      const countryId = options.countryId || 'ru';
      menuRoot.innerHTML = `
        <div class="menu-panel">
          <h1 class="menu-title">Обучение</h1>
          <p class="menu-subtitle">Извините, пока что не работает</p>
          <div class="menu-actions">
            <button class="menu-btn" type="button" data-action="education-back-grade" data-country-id="${escapeHtml(countryId)}">Назад</button>
          </div>
        </div>
      `;
      return;
    }

    if (!isPause && view === 'education-grade5-exam') {
      const countryId = options.countryId || 'ru';
      const passCoins = Game.education3d && Game.education3d.GRADE5_EXAM_PASS_COINS
        ? Game.education3d.GRADE5_EXAM_PASS_COINS
        : 35;
      menuRoot.innerHTML = `
        <div class="menu-panel">
          <h1 class="menu-title">Экзамен перед 5 классом</h1>
          <p class="menu-subtitle">Чтобы открыть 5 класс, надо пройти один большой экзамен по программе 4 класса. В нем ${passCoins} заданий: по 5 заданий от каждого предмета 4 класса.</p>
          <div class="menu-actions">
            <button class="menu-btn menu-btn-primary" type="button" data-action="education-grade5-exam-start" data-country-id="${escapeHtml(countryId)}">Начать экзамен</button>
            <button class="menu-btn" type="button" data-action="education-back-grade" data-country-id="${escapeHtml(countryId)}">Назад</button>
          </div>
        </div>
      `;
      return;
    }

    if (!isPause && view === 'education-grade6-exam') {
      const countryId = options.countryId || 'ru';
      const passCoins = Game.education3d && Game.education3d.GRADE6_EXAM_PASS_COINS
        ? Game.education3d.GRADE6_EXAM_PASS_COINS
        : 45;
      menuRoot.innerHTML = `
        <div class="menu-panel">
          <h1 class="menu-title">Экзамен перед 6 классом</h1>
          <p class="menu-subtitle">Чтобы открыть 6 класс, надо пройти один большой экзамен по программе 5 класса. В нем ${passCoins} заданий: по 5 заданий от каждого предмета 5 класса.</p>
          <div class="menu-actions">
            <button class="menu-btn menu-btn-primary" type="button" data-action="education-grade6-exam-start" data-country-id="${escapeHtml(countryId)}">Начать экзамен</button>
            <button class="menu-btn" type="button" data-action="education-back-grade" data-country-id="${escapeHtml(countryId)}">Назад</button>
          </div>
        </div>
      `;
      return;
    }

    if (!isPause && view === 'education-subject') {
      const countryId = options.countryId || 'ru';
      const grade = Number(options.grade) || 1;
      const subjects = Game.education3d && Game.education3d.getSubjects ? Game.education3d.getSubjects(grade) : (Game.education3d ? Game.education3d.SUBJECTS : []);
      const customCourses = Game.education3d && Game.education3d.customCoursesFor ? Game.education3d.customCoursesFor(countryId, grade) : [];
      const lessonCount = Game.education3d && Game.education3d.LESSON_COUNT ? Game.education3d.LESSON_COUNT : 100;
      menuRoot.innerHTML = `
        <div class="menu-panel menu-panel-wide">
          <h1 class="menu-title">Предмет</h1>
          <p class="menu-subtitle">Выберите предмет. Предмет пройден после ${lessonCount}/${lessonCount} уроков.</p>
          <div class="education-grid education-grid-subjects">
            ${subjects.map((subject) => {
              const completedCount = Game.education3d && Game.education3d.completedLessonCount
                ? Game.education3d.completedLessonCount(countryId, grade, subject.id)
                : 0;
              const completed = completedCount >= lessonCount;
              return `
                <button class="menu-btn education-subject" type="button" data-action="education-subject" data-country-id="${escapeHtml(countryId)}" data-grade="${grade}" data-subject-id="${escapeHtml(subject.id)}">
                  <span>${escapeHtml(subject.label)}</span>
                  <span class="education-subject-status">${completed ? '✓' : ''} ${completedCount}/${lessonCount}</span>
                </button>
              `;
            }).join('')}
            ${customCourses.map((course) => `
              <button class="menu-btn education-subject" type="button" data-action="education-custom-course" data-country-id="${escapeHtml(countryId)}" data-grade="${grade}" data-course-id="${escapeHtml(course.id)}">
                <span>${escapeHtml(course.title)}</span>
                <span class="education-subject-status">${course.lessons.length} уроков</span>
              </button>
            `).join('')}
            <button class="menu-btn education-subject" type="button" data-action="education-custom-add" data-country-id="${escapeHtml(countryId)}" data-grade="${grade}">
              <span>+ Добавить свой</span>
              <span class="education-subject-status">Курс</span>
            </button>
          </div>
          <div class="menu-actions">
            <button class="menu-btn" type="button" data-action="education-back-grade" data-country-id="${escapeHtml(countryId)}">Назад</button>
          </div>
        </div>
      `;
      return;
    }

    if (!isPause && view === 'education-custom-course') {
      const countryId = options.countryId || 'ru';
      const grade = Number(options.grade) || 1;
      const courseId = options.courseId || '';
      const course = Game.education3d && Game.education3d.customCourseById ? Game.education3d.customCourseById(courseId) : null;
      if (!course) {
        renderUnifiedMenu('start', 'education-subject', { countryId, grade });
        return;
      }
      menuRoot.innerHTML = `
        <div class="menu-panel menu-panel-wide">
          <h1 class="menu-title">${escapeHtml(course.title)}</h1>
          <p class="menu-subtitle">Уроков: ${course.lessons.length}. Можно добавить сколько угодно уроков.</p>
          <div class="education-grid education-grid-lessons">
            ${course.lessons.map((lesson, index) => {
              const ready = !!lesson.ready;
              return `
              <button class="menu-btn education-lesson" type="button" data-action="${ready ? 'education-custom-play' : 'education-custom-creator'}" data-country-id="${escapeHtml(countryId)}" data-grade="${grade}" data-course-id="${escapeHtml(course.id)}" data-lesson-id="${escapeHtml(lesson.id)}">
                <span class="education-lesson-title">
                  <span>${escapeHtml(lesson.title || `Урок ${index + 1}`)}</span>
                  <span class="education-lesson-topic">${escapeHtml(lesson.seed || 'случайный seed')} / ${lesson.hasMap ? 'карта создана' : 'без карты'}${ready ? ' / готов' : ' / черновик'}</span>
                </span>
                <span class="education-subject-status">${ready ? 'Войти' : 'Создатель'}</span>
              </button>
            `;
            }).join('')}
            <button class="menu-btn education-lesson" type="button" data-action="education-custom-add-lesson" data-country-id="${escapeHtml(countryId)}" data-grade="${grade}" data-course-id="${escapeHtml(course.id)}">
              <span class="education-lesson-title">
                <span>+ Добавить урок</span>
                <span class="education-lesson-topic">Новый урок курса</span>
              </span>
              <span class="education-subject-status">+</span>
            </button>
          </div>
          <div class="menu-actions">
            <button class="menu-btn" type="button" data-action="education-back-subject" data-country-id="${escapeHtml(countryId)}" data-grade="${grade}">Назад</button>
          </div>
        </div>
      `;
      return;
    }

    if (!isPause && view === 'education-custom-creator') {
      const countryId = options.countryId || 'ru';
      const grade = Number(options.grade) || 1;
      const courseId = options.courseId || (state && state.worldMeta && state.worldMeta.customLessonEditor ? state.worldMeta.customLessonEditor.courseId : '');
      const lessonId = options.lessonId || (state && state.worldMeta && state.worldMeta.customLessonEditor ? state.worldMeta.customLessonEditor.lessonId : '');
      const course = Game.education3d && Game.education3d.customCourseById ? Game.education3d.customCourseById(courseId) : null;
      const lesson = Game.education3d && Game.education3d.customLessonById ? Game.education3d.customLessonById(courseId, lessonId) : null;
      if (!course || !lesson) {
        renderUnifiedMenu('start', 'education-subject', { countryId, grade });
        return;
      }
      const mode = Game.education3d && Game.education3d.normalizeCustomLessonMode ? Game.education3d.normalizeCustomLessonMode(lesson.mode) : 'survival';
      const spawnMode = Game.education3d && Game.education3d.normalizeCustomLessonSpawnMode ? Game.education3d.normalizeCustomLessonSpawnMode(lesson.spawnMode) : 'editor_position';
      menuRoot.innerHTML = `
        <div class="menu-panel menu-panel-wide">
          <h1 class="menu-title">Создатель</h1>
          <p class="menu-subtitle">${escapeHtml(course.title)} / ${escapeHtml(lesson.title)}. Seed: ${escapeHtml(lesson.seed || 'случайный')}</p>
          <div class="menu-field">
            <span>Режим прохождения</span>
            <div class="menu-mode-options">
              <label class="menu-mode-option">
                <input type="radio" name="customLessonMode" value="survival" ${mode === 'survival' ? 'checked' : ''} />
                <span>Выживание</span>
              </label>
              <label class="menu-mode-option">
                <input type="radio" name="customLessonMode" value="adventure" ${mode === 'adventure' ? 'checked' : ''} />
                <span>Приключение</span>
              </label>
              <label class="menu-mode-option">
                <input type="radio" name="customLessonMode" value="creative_adventure" ${mode === 'creative_adventure' ? 'checked' : ''} />
                <span>Приключенческий креатив</span>
              </label>
            </div>
          </div>
          <div class="menu-field">
            <span>Место старта</span>
            <div class="menu-mode-options">
              <label class="menu-mode-option">
                <input type="radio" name="customLessonSpawnMode" value="editor_position" ${spawnMode === 'editor_position' ? 'checked' : ''} />
                <span>Место редактора</span>
              </label>
              <label class="menu-mode-option">
                <input type="radio" name="customLessonSpawnMode" value="world_spawn" ${spawnMode === 'world_spawn' ? 'checked' : ''} />
                <span>Спавн мира</span>
              </label>
            </div>
          </div>
          <div class="menu-actions">
            <button class="menu-btn" type="button" data-action="education-custom-create-map" data-country-id="${escapeHtml(countryId)}" data-grade="${grade}" data-course-id="${escapeHtml(course.id)}" data-lesson-id="${escapeHtml(lesson.id)}">${lesson.hasMap ? 'Редактировать карту' : 'Создать карту'}</button>
            <button class="menu-btn" type="button" data-action="education-custom-code" data-country-id="${escapeHtml(countryId)}" data-grade="${grade}" data-course-id="${escapeHtml(course.id)}" data-lesson-id="${escapeHtml(lesson.id)}">Код</button>
            <button class="menu-btn menu-btn-primary" type="button" data-action="education-custom-done" data-country-id="${escapeHtml(countryId)}" data-grade="${grade}" data-course-id="${escapeHtml(course.id)}" data-lesson-id="${escapeHtml(lesson.id)}">Готово</button>
            <button class="menu-btn" type="button" data-action="education-custom-course" data-country-id="${escapeHtml(countryId)}" data-grade="${grade}" data-course-id="${escapeHtml(course.id)}">Назад</button>
          </div>
          <div class="menu-hint">Граница доступна только в редакторе карты пользовательского урока.</div>
        </div>
      `;
      return;
    }

    if (!isPause && view === 'education-custom-code') {
      const countryId = options.countryId || 'ru';
      const grade = Number(options.grade) || 1;
      const courseId = options.courseId || '';
      const lessonId = options.lessonId || '';
      const lesson = Game.education3d && Game.education3d.customLessonById ? Game.education3d.customLessonById(courseId, lessonId) : null;
      if (!lesson) {
        renderUnifiedMenu('start', 'education-subject', { countryId, grade });
        return;
      }
      const actions = customLessonCodeActions(lesson).slice().sort((a, b) => Number(a.number) - Number(b.number));
      const selectedNumber = Number(options.actionNumber) || (actions[0] ? actions[0].number : 1);
      const selectedAction = customLessonCodeAction(lesson, selectedNumber);
      const actionNumber = Number(selectedAction.number) || 1;
      menuRoot.innerHTML = `
        <div class="menu-panel menu-panel-wide">
          <h1 class="menu-title">Код</h1>
          <p class="menu-subtitle">${escapeHtml(lesson.title)}. Если условий завершения несколько, игрок должен выполнить их все.</p>
          <div class="lesson-code-toolbar">
            <label class="menu-field lesson-code-select">
              <span>Действие</span>
              <select data-action="education-custom-code-select" data-country-id="${escapeHtml(countryId)}" data-grade="${grade}" data-course-id="${escapeHtml(courseId)}" data-lesson-id="${escapeHtml(lessonId)}">
                ${actions.map((item) => `
                  <option value="${Number(item.number) || 1}" ${Number(item.number) === actionNumber ? 'selected' : ''}>Действие ${Number(item.number) || 1}</option>
                `).join('')}
              </select>
            </label>
            <button class="menu-btn" type="button" data-action="education-custom-code-add-action" data-country-id="${escapeHtml(countryId)}" data-grade="${grade}" data-course-id="${escapeHtml(courseId)}" data-lesson-id="${escapeHtml(lessonId)}">+ Действие</button>
          </div>
          <div class="lesson-code-workspace">
            <aside class="lesson-code-palette">
              <div class="lesson-code-palette-group">
                <h2>При начале</h2>
                <button class="menu-btn lesson-code-palette-block" draggable="true" type="button" data-action="education-custom-code-add-start" data-code-group="start" data-code-type="give" data-action-number="${actionNumber}" data-country-id="${escapeHtml(countryId)}" data-grade="${grade}" data-course-id="${escapeHtml(courseId)}" data-lesson-id="${escapeHtml(lessonId)}">Выдать предмет</button>
                <button class="menu-btn lesson-code-palette-block" draggable="true" type="button" data-action="education-custom-code-add-start" data-code-group="start" data-code-type="teleport" data-action-number="${actionNumber}" data-country-id="${escapeHtml(countryId)}" data-grade="${grade}" data-course-id="${escapeHtml(courseId)}" data-lesson-id="${escapeHtml(lessonId)}">Телепортировать</button>
                <button class="menu-btn lesson-code-palette-block" draggable="true" type="button" data-action="education-custom-code-add-start" data-code-group="start" data-code-type="say" data-action-number="${actionNumber}" data-country-id="${escapeHtml(countryId)}" data-grade="${grade}" data-course-id="${escapeHtml(courseId)}" data-lesson-id="${escapeHtml(lessonId)}">Написать</button>
                <label class="menu-btn lesson-code-file">
                  Поставить миниатюру
                  <input type="file" accept="image/*" data-action="education-custom-code-thumbnail" data-action-number="${actionNumber}" data-country-id="${escapeHtml(countryId)}" data-grade="${grade}" data-course-id="${escapeHtml(courseId)}" data-lesson-id="${escapeHtml(lessonId)}" />
                </label>
              </div>
              <div class="lesson-code-palette-group">
                <h2>Завершение</h2>
                <button class="menu-btn lesson-code-palette-block" draggable="true" type="button" data-action="education-custom-code-add-complete" data-code-group="complete" data-code-type="place" data-action-number="${actionNumber}" data-country-id="${escapeHtml(countryId)}" data-grade="${grade}" data-course-id="${escapeHtml(courseId)}" data-lesson-id="${escapeHtml(lessonId)}">Поставил блок</button>
                <button class="menu-btn lesson-code-palette-block" draggable="true" type="button" data-action="education-custom-code-add-complete" data-code-group="complete" data-code-type="mine" data-action-number="${actionNumber}" data-country-id="${escapeHtml(countryId)}" data-grade="${grade}" data-course-id="${escapeHtml(courseId)}" data-lesson-id="${escapeHtml(lessonId)}">Разрушил блок</button>
                <button class="menu-btn lesson-code-palette-block" draggable="true" type="button" data-action="education-custom-code-add-complete" data-code-group="complete" data-code-type="biome" data-action-number="${actionNumber}" data-country-id="${escapeHtml(countryId)}" data-grade="${grade}" data-course-id="${escapeHtml(courseId)}" data-lesson-id="${escapeHtml(lessonId)}">Попал в биом</button>
              </div>
            </aside>
            <main class="lesson-code-stage">
              <section class="lesson-code-stack">
                <h2>При начале действия [${actionNumber}]</h2>
                <div class="lesson-code-stack-body" data-code-drop-kind="start" data-action-number="${actionNumber}" data-country-id="${escapeHtml(countryId)}" data-grade="${grade}" data-course-id="${escapeHtml(courseId)}" data-lesson-id="${escapeHtml(lessonId)}">
                  ${renderCodeBlockList(selectedAction.start, 'Перетащи или нажми блоки слева, чтобы добавить команды.', 'education-custom-code-remove-block', actionNumber, 'start', { countryId, grade, courseId, lessonId })}
                </div>
              </section>
              <section class="lesson-code-stack lesson-code-stack-complete">
                <h2>Что нужно для игрока, чтобы выполнить действие [${actionNumber}]</h2>
                <div class="lesson-code-stack-body" data-code-drop-kind="complete" data-action-number="${actionNumber}" data-country-id="${escapeHtml(countryId)}" data-grade="${grade}" data-course-id="${escapeHtml(courseId)}" data-lesson-id="${escapeHtml(lessonId)}">
                  ${renderCodeBlockList(selectedAction.complete, 'Добавь условия слева. Если условий несколько, нужны все.', 'education-custom-code-remove-block', actionNumber, 'complete', { countryId, grade, courseId, lessonId })}
                </div>
              </section>
            </main>
          </div>
          <div class="menu-actions">
            <button class="menu-btn" type="button" data-action="education-custom-creator" data-country-id="${escapeHtml(countryId)}" data-grade="${grade}" data-course-id="${escapeHtml(courseId)}" data-lesson-id="${escapeHtml(lessonId)}">Назад</button>
          </div>
        </div>
      `;
      return;
    }

    if (!isPause && view === 'education-lesson') {
      const countryId = options.countryId || 'ru';
      const grade = Number(options.grade) || 1;
      const subjectId = options.subjectId || 'language';
      const subjects = Game.education3d && Game.education3d.getSubjects ? Game.education3d.getSubjects(grade) : (Game.education3d ? Game.education3d.SUBJECTS : []);
      const subject = subjects.find((item) => item.id === subjectId) || { id: subjectId, label: 'Предмет' };
      const lessonCount = Game.education3d && Game.education3d.LESSON_COUNT ? Game.education3d.LESSON_COUNT : 100;
      menuRoot.innerHTML = `
        <div class="menu-panel menu-panel-wide">
          <h1 class="menu-title">${escapeHtml(subject.label)}</h1>
          <p class="menu-subtitle">Выберите урок. В каждом уроке 10 заданий.</p>
          <div class="education-grid education-grid-lessons">
            ${Array.from({ length: lessonCount }, (_, i) => i + 1).map((lesson) => {
              const completed = Game.education3d && Game.education3d.isCompleted(countryId, grade, subject.id, lesson);
              const summary = Game.education3d && Game.education3d.getLessonSummary
                ? Game.education3d.getLessonSummary(subject.id, grade, lesson)
                : '';
              return `
                <button class="menu-btn education-lesson" type="button" data-action="education-lesson" data-country-id="${escapeHtml(countryId)}" data-grade="${grade}" data-subject-id="${escapeHtml(subject.id)}" data-lesson="${lesson}">
                  <span class="education-lesson-title">
                    <span>Урок ${lesson}</span>
                    ${summary ? `<span class="education-lesson-topic">${escapeHtml(summary)}</span>` : ''}
                  </span>
                  <span class="education-subject-status">${completed ? '✓ Перепройти' : 'Начать'}</span>
                </button>
              `;
            }).join('')}
          </div>
          <div class="menu-actions">
            <button class="menu-btn" type="button" data-action="education-back-subject" data-country-id="${escapeHtml(countryId)}" data-grade="${grade}">Назад</button>
          </div>
        </div>
      `;
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
      <label class="menu-field">
        <span>Прорисовка чанков</span>
        <select name="chunkRenderDistance">
          ${renderChunkRenderDistanceOptions()}
        </select>
      </label>
      <label class="menu-field">
        <span>Биом спавна</span>
        <select name="spawnBiome">
          ${renderSpawnBiomeOptions()}
        </select>
      </label>
      <label class="menu-check">
        <input type="checkbox" name="shadersEnabled" value="1" />
        <span>Шейдеры</span>
      </label>
      <label class="menu-check">
        <input type="checkbox" name="expandedBlockAssortment" value="1" />
        <span>Расширенный ассортимент блоков</span>
      </label>
      <label class="menu-check">
        <input type="checkbox" name="explosionPackEnabled" value="1" />
        <span>Дополнение "Куча взрывов"</span>
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
    const editor = state && state.worldMeta ? state.worldMeta.customLessonEditor : null;
    const creatorAction = isPause && state && state.worldMeta && state.worldMeta.customLessonEditor
      ? `<button class="menu-btn" type="button" data-action="education-custom-creator" data-country-id="${escapeHtml(editor.countryId || 'ru')}" data-grade="${Number(editor.grade) || 1}" data-course-id="${escapeHtml(editor.courseId)}" data-lesson-id="${escapeHtml(editor.lessonId)}">Доделать мир</button>`
      : '';
    const pauseExit = isPause
      ? '<button class="menu-btn" type="button" data-action="main-menu">В главное меню</button>'
      : '';
    const customPlay = state && state.worldMeta ? state.worldMeta.customLessonPlay : null;
    const editPlayAction = isPause && customPlay
      ? `<button class="menu-btn" type="button" data-action="education-custom-edit-map" data-country-id="${escapeHtml(customPlay.countryId || 'ru')}" data-grade="${Number(customPlay.grade) || 1}" data-course-id="${escapeHtml(customPlay.courseId)}" data-lesson-id="${escapeHtml(customPlay.lessonId)}">Редактировать</button>`
      : '';
    menuRoot.innerHTML = `
      <form class="menu-panel ${isPause ? 'pause-panel' : ''}" id="${isPause ? 'pauseMenuForm' : 'newWorldForm'}" data-bots-enabled="${creatingBotWorld ? 'true' : 'false'}">
        <h1 class="menu-title">${isPause ? 'Пауза' : (creatingBotWorld ? 'Играть с ботами' : 'Создание мира')}</h1>
        <p class="menu-subtitle">${subtitle}</p>
        ${fields}
        <div class="menu-actions">
          ${primary}
          ${creatorAction}
          ${editPlayAction}
          ${isPause ? `<button class="menu-btn" type="button" data-action="show-load" data-context="${context}">Загрузить мир</button>` : ''}
          ${creatingWorld ? '<button class="menu-btn" type="button" data-action="back-menu" data-context="start" data-return-view="main">Назад в главное меню</button>' : ''}
          ${pauseExit}
        </div>
        <div class="menu-hint">${isPause ? 'После продолжения клик по миру снова захватит мышь.' : (creatingBotWorld ? 'В мире появятся боты с разными характерами: они исследуют, строят, копают шахты, собирают дерево и охотятся алгоритмами без нейросетей.' : 'WASD - движение, Shift - ускорение, Space - прыжок/всплытие, F - полет в creative, ЛКМ - добыча, ПКМ - поставить, R - починить, P - предпросмотр, 1-9/0 - выбор блока.')}</div>
      </form>
    `;
    syncSpawnSeedInput();
    syncCreativeForcedInputs();
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
    const saveSlot = (slot) => slot ? {
      id: slot.id,
      count: slot.count,
      data: slot.data ? JSON.parse(JSON.stringify(slot.data)) : undefined,
    } : null;
    return {
      x: state.player.x,
      y: state.player.y,
      z: state.player.z,
      yaw: state.player.yaw,
      pitch: state.player.pitch,
      scale: Number.isFinite(state.player.scale) ? state.player.scale : 1,
      targetScale: Number.isFinite(state.player.targetScale) ? state.player.targetScale : (Number.isFinite(state.player.scale) ? state.player.scale : 1),
      maxHealth: Number.isFinite(state.player.maxHealth) ? state.player.maxHealth : 100,
      health: Number.isFinite(state.player.health) ? state.player.health : 100,
      inventory: Array.isArray(state.player.inventory)
        ? state.player.inventory.map(saveSlot)
        : [],
      hotbar: Array.isArray(state.player.hotbar)
        ? state.player.hotbar.map(saveSlot)
        : [],
    };
  }

  function currentDimension() {
    return state && state.worldMeta && state.worldMeta.currentDimension === 'underground' ? 'underground' : 'overworld';
  }

  function dimensionStorageWorldId(baseWorldId, dimension) {
    if (Game.generation3d && Game.generation3d.dimensionWorldId) return Game.generation3d.dimensionWorldId(baseWorldId, dimension);
    return dimension === 'underground' ? `${baseWorldId}:underground` : baseWorldId;
  }

  function captureDimensionPlayer() {
    if (!state || !state.player) return null;
    return {
      x: state.player.x,
      y: state.player.y,
      z: state.player.z,
      yaw: state.player.yaw,
      pitch: state.player.pitch,
      scale: Number.isFinite(state.player.scale) ? state.player.scale : 1,
      targetScale: Number.isFinite(state.player.targetScale) ? state.player.targetScale : (Number.isFinite(state.player.scale) ? state.player.scale : 1),
      maxHealth: Number.isFinite(state.player.maxHealth) ? state.player.maxHealth : 100,
      health: Number.isFinite(state.player.health) ? state.player.health : 100,
    };
  }

  function applyDimensionPlayer(playerMeta) {
    if (!state || !state.player || !playerMeta) return;
    if (Number.isFinite(playerMeta.x)) state.player.x = playerMeta.x;
    if (Number.isFinite(playerMeta.y)) state.player.y = playerMeta.y;
    if (Number.isFinite(playerMeta.z)) state.player.z = playerMeta.z;
    if (Number.isFinite(playerMeta.yaw)) state.player.yaw = playerMeta.yaw;
    if (Number.isFinite(playerMeta.pitch)) state.player.pitch = playerMeta.pitch;
    if (Number.isFinite(playerMeta.scale)) state.player.scale = playerMeta.scale;
    if (Number.isFinite(playerMeta.targetScale)) state.player.targetScale = playerMeta.targetScale;
    else if (Number.isFinite(playerMeta.scale)) state.player.targetScale = playerMeta.scale;
    if (Number.isFinite(playerMeta.maxHealth)) state.player.maxHealth = Math.max(1, playerMeta.maxHealth);
    if (Number.isFinite(playerMeta.health)) state.player.health = Math.max(1, Math.min(state.player.maxHealth || 100, playerMeta.health));
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.vz = 0;
  }

  function placeCustomLessonPlayerOnSurface() {
    if (!state || !state.world || !state.player || !state.worldMeta || !state.worldMeta.customLessonPlay) return;
    const block = Game.blocks && Game.blocks.BLOCK;
    if (!block) return;
    const x = Math.max(1, Math.min(state.world.w - 2, Math.floor(state.player.x)));
    const z = Math.max(1, Math.min(state.world.d - 2, Math.floor(state.player.z)));
    const passable = new Set([block.AIR, block.WATER, block.HOT_WATER, block.LAVA]);
    for (let y = state.world.h - 2; y >= 1; y -= 1) {
      const id = Game.world3d.getBlock3D(state, x, y, z);
      if (passable.has(id)) continue;
      state.player.y = Math.min(state.world.h + 4, y + 2);
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.vz = 0;
      state.worldMeta.player = capturePlayerMeta();
      return;
    }
    if (Game.generation3d && Game.generation3d.getSurfaceSpawnY3D) {
      state.player.y = Game.generation3d.getSurfaceSpawnY3D(state, x, z);
      state.player.vx = 0;
      state.player.vy = 0;
      state.player.vz = 0;
      state.worldMeta.player = capturePlayerMeta();
    }
  }

  async function saveAllDimensionChunks(targetWorldId, options = {}) {
    if (!state || !state.worldMeta || !Game.generation3d || !Game.generation3d.saveModifiedChunks3D) return 0;
    const originalWorld = state.world;
    const originalDimension = currentDimension();
    const worlds = state.dimensionWorlds || {};
    worlds[originalDimension] = originalWorld;
    let saved = 0;
    for (const dimension of Object.keys(worlds)) {
      state.world = worlds[dimension];
      state.worldMeta.currentDimension = dimension;
      if (state.world) {
        state.world.dimension = dimension;
        state.world.worldMeta = state.worldMeta;
      }
      saved += await Game.generation3d.saveModifiedChunks3D(state, targetWorldId, options);
    }
    state.world = originalWorld;
    state.worldMeta.currentDimension = originalDimension;
    if (state.world) {
      state.world.dimension = originalDimension;
      state.world.worldMeta = state.worldMeta;
    }
    return saved;
  }

  async function saveCurrentWorld() {
    if (!state || !state.worldMeta || !Game.storage3d || !Game.storage3d.saveWorldMeta) return false;
    state.worldMeta.player = capturePlayerMeta();
    state.worldMeta.updatedAt = Date.now();
    const metaSaved = await Game.storage3d.saveWorldMeta(state.worldMeta);
    if (!metaSaved) return false;
    await saveAllDimensionChunks(state.worldMeta.id, { keepUnsaved: false });
    return true;
  }

  async function saveAutosaveWorld() {
    const storage = Game.storage3d;
    if (!state || !state.worldMeta || !storage || !storage.saveWorldMeta || !storage.isAvailable()) return false;
    const sourceMeta = state.worldMeta;
    const sourceWorldId = sourceMeta.id || '';
    if (sourceWorldId !== AUTOSAVE_WORLD_ID && autosaveBaseWorldId !== sourceWorldId) {
      const prepared = storage.copyWorldChunks
        ? await storage.copyWorldChunks(sourceWorldId, AUTOSAVE_WORLD_ID)
        : storage.deleteWorldChunks
          ? await storage.deleteWorldChunks(AUTOSAVE_WORLD_ID)
          : true;
      if (!prepared) return false;
      autosaveBaseWorldId = sourceWorldId;
    }

    const now = Date.now();
    const meta = {
      ...sourceMeta,
      id: AUTOSAVE_WORLD_ID,
      name: `Автосейв: ${sourceMeta.name || 'Мир'}`,
      isAutosave: true,
      sourceWorldId,
      sourceWorldName: sourceMeta.name || 'Мир',
      player: capturePlayerMeta(),
      updatedAt: now,
      createdAt: sourceMeta.createdAt || now,
    };
    const metaSaved = await storage.saveWorldMeta(meta);
    if (!metaSaved) return false;
    await saveAllDimensionChunks(AUTOSAVE_WORLD_ID, { keepUnsaved: true });
    savedWorlds.set(AUTOSAVE_WORLD_ID, meta);
    return true;
  }

  function triggerAutosave(force = false) {
    if (!state || !state.worldMeta || screen === 'menu') return;
    const now = Date.now();
    if (!force && now - lastAutosaveAt < AUTOSAVE_INTERVAL_MS) return;
    if (autosaveRunning) {
      autosavePending = true;
      return;
    }
    lastAutosaveAt = now;
    autosaveRunning = true;
    saveAutosaveWorld().finally(() => {
      autosaveRunning = false;
      if (!autosavePending) return;
      autosavePending = false;
      triggerAutosave(true);
    });
  }

  async function askSaveCurrentWorld() {
    if (!state || !state.worldMeta) return true;
    const name = state.worldMeta.name || 'Мир';
    if (!window.confirm(`Сохранить мир "${name}" перед выходом?`)) return true;
    const saved = await saveCurrentWorld();
    if (!saved) window.alert('Не удалось сохранить мир.');
    return saved;
  }

  async function startWorldFromMeta(meta) {
    lastAutosaveAt = Date.now();
    autosaveBaseWorldId = meta && meta.id === AUTOSAVE_WORLD_ID ? AUTOSAVE_WORLD_ID : '';
    const normalizedMeta = meta ? { ...meta } : {};
    if (!normalizedMeta.playerSkin) normalizedMeta.playerSkin = getStoredPlayerSkin();
    state = Game.state3d.createGameState3D(normalizedMeta);
    state.dimensionWorlds = {};
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
      if (Number.isFinite(state.worldMeta.player.scale)) state.player.scale = state.worldMeta.player.scale;
      if (Number.isFinite(state.worldMeta.player.targetScale)) state.player.targetScale = state.worldMeta.player.targetScale;
      else if (Number.isFinite(state.worldMeta.player.scale)) state.player.targetScale = state.worldMeta.player.scale;
      if (Number.isFinite(state.worldMeta.player.maxHealth)) state.player.maxHealth = Math.max(1, state.worldMeta.player.maxHealth);
      if (Number.isFinite(state.worldMeta.player.health)) state.player.health = Math.max(1, Math.min(state.player.maxHealth || 100, state.worldMeta.player.health));
    }
    if (Game.storage3d && Game.storage3d.listChunkKeys && state.worldMeta.id) {
      const storageId = dimensionStorageWorldId(state.worldMeta.id, currentDimension());
      const savedChunkKeys = await Game.storage3d.listChunkKeys(storageId);
      if (savedChunkKeys.length > 0) state.world.savedChunks = new Set(savedChunkKeys);
    }
    Game.generation3d.generateWorld3D(state);
    placeCustomLessonPlayerOnSurface();
    if (Game.bots3d && Game.bots3d.ensureCompanionBots3D) Game.bots3d.ensureCompanionBots3D(state);
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
    renderWorldCreationStatus(form && form.spawnBiome);
    await waitForNextFrame();
    const resolvedSeed = await resolveSeedForSpawnBiome(form || {});
    const meta = createWorldMeta({
      ...(form || {}),
      seed: resolvedSeed.seed,
      spawnBiomeSeedSearch: resolvedSeed.usedSearch,
      botsEnabled: form && form.botsEnabled === true,
    });
    await startWorldFromMeta(meta);
  }

  async function startEducationWorld(countryId, grade, subjectId, lesson) {
    const meta = createEducationWorldMeta(countryId, grade, subjectId, lesson);
    await startWorldFromMeta(meta);
  }

  async function startGrade5ExamWorld(countryId) {
    const meta = createGrade5ExamWorldMeta(countryId);
    await startWorldFromMeta(meta);
  }

  async function startGrade6ExamWorld(countryId) {
    const meta = createGrade6ExamWorldMeta(countryId);
    await startWorldFromMeta(meta);
  }

  async function startCustomLessonMapEditor(courseId, lessonId) {
    const lesson = Game.education3d && Game.education3d.customLessonById
      ? Game.education3d.customLessonById(courseId, lessonId)
      : null;
    if (!lesson) return;
    const meta = createCustomLessonEditorWorldMeta(courseId, lesson);
    lesson.seed = meta.seed;
    lesson.hasMap = true;
    lesson.mapWorldId = meta.id;
    if (Game.education3d && Game.education3d.saveCustomLesson) Game.education3d.saveCustomLesson(courseId, lesson);
    await startWorldFromMeta(meta);
  }

  async function startCustomLessonPlay(courseId, lessonId) {
    const lesson = Game.education3d && Game.education3d.customLessonById
      ? Game.education3d.customLessonById(courseId, lessonId)
      : null;
    if (!lesson) return;
    if (!lesson.ready) {
      const course = Game.education3d && Game.education3d.customCourseById ? Game.education3d.customCourseById(courseId) : null;
      renderUnifiedMenu('start', 'education-custom-creator', {
        countryId: course ? course.countryId : 'ru',
        grade: course ? course.grade : 1,
        courseId,
        lessonId,
      });
      setScreen('menu');
      return;
    }
    let savedMapMeta = null;
    if (lesson.mapWorldId && Game.storage3d && Game.storage3d.listWorldMetas) {
      const worlds = await Game.storage3d.listWorldMetas();
      savedMapMeta = worlds.find((world) => world && world.id === lesson.mapWorldId) || null;
    }
    await startWorldFromMeta(createCustomLessonPlayWorldMeta(courseId, lesson, savedMapMeta));
  }

  function selectedCustomLessonMode() {
    const checked = menuRoot.querySelector('input[name="customLessonMode"]:checked');
    const value = checked && checked.value ? checked.value : 'survival';
    return Game.education3d && Game.education3d.normalizeCustomLessonMode
      ? Game.education3d.normalizeCustomLessonMode(value)
      : value;
  }

  function selectedCustomLessonSpawnMode() {
    const checked = menuRoot.querySelector('input[name="customLessonSpawnMode"]:checked');
    const value = checked && checked.value ? checked.value : 'editor_position';
    return Game.education3d && Game.education3d.normalizeCustomLessonSpawnMode
      ? Game.education3d.normalizeCustomLessonSpawnMode(value)
      : value;
  }

  async function saveCustomCreatorLesson(courseId, lessonId, options = {}) {
    const lesson = Game.education3d && Game.education3d.customLessonById
      ? Game.education3d.customLessonById(courseId, lessonId)
      : null;
    if (!lesson) return null;
    lesson.mode = selectedCustomLessonMode();
    lesson.spawnMode = selectedCustomLessonSpawnMode();
    if (options.ready) lesson.ready = true;
    if (state && state.worldMeta && state.worldMeta.customLessonEditor
      && state.worldMeta.customLessonEditor.courseId === courseId
      && state.worldMeta.customLessonEditor.lessonId === lessonId) {
      lesson.hasMap = true;
      lesson.mapWorldId = state.worldMeta.id || lesson.mapWorldId || '';
      lesson.seed = state.worldMeta.seed || lesson.seed || '';
      await saveCurrentWorld();
    }
    return Game.education3d && Game.education3d.saveCustomLesson
      ? Game.education3d.saveCustomLesson(courseId, lesson)
      : lesson;
  }

  function saveCustomLessonCode(courseId, lesson) {
    return Game.education3d && Game.education3d.saveCustomLesson
      ? Game.education3d.saveCustomLesson(courseId, lesson)
      : lesson;
  }

  function renderCustomLessonCodeMenuFromTarget(target, actionNumber) {
    renderUnifiedMenu('start', 'education-custom-code', {
      countryId: target.dataset.countryId || 'ru',
      grade: Number(target.dataset.grade) || 1,
      courseId: target.dataset.courseId || '',
      lessonId: target.dataset.lessonId || '',
      actionNumber: Number(actionNumber) || Number(target.dataset.actionNumber) || 1,
    });
    setScreen('menu');
  }

  function addCustomLessonCodeAction(target) {
    const courseId = target.dataset.courseId || '';
    const lessonId = target.dataset.lessonId || '';
    const lesson = Game.education3d && Game.education3d.customLessonById
      ? Game.education3d.customLessonById(courseId, lessonId)
      : null;
    if (!lesson) return;
    const actions = customLessonCodeActions(lesson);
    const maxNumber = actions.reduce((max, action) => Math.max(max, Number(action.number) || 1), 0);
    const number = maxNumber + 1;
    lesson.code = { actions: actions.concat([{ number, start: [], complete: [] }]) };
    saveCustomLessonCode(courseId, lesson);
    renderCustomLessonCodeMenuFromTarget(target, number);
  }

  function findCustomLessonCodeActionForEdit(lesson, number) {
    lesson.code = lesson.code && typeof lesson.code === 'object' ? lesson.code : { actions: [] };
    lesson.code.actions = customLessonCodeActions(lesson).slice();
    let action = lesson.code.actions.find((item) => Number(item.number) === Number(number));
    if (!action) {
      action = { number: Number(number) || 1, start: [], complete: [] };
      lesson.code.actions.push(action);
    }
    action.start = Array.isArray(action.start) ? action.start : [];
    action.complete = Array.isArray(action.complete) ? action.complete : [];
    return action;
  }

  function addCustomLessonStartBlock(target) {
    const courseId = target.dataset.courseId || '';
    const lessonId = target.dataset.lessonId || '';
    const lesson = Game.education3d && Game.education3d.customLessonById
      ? Game.education3d.customLessonById(courseId, lessonId)
      : null;
    if (!lesson) return;
    const actionNumber = Number(target.dataset.actionNumber) || 1;
    const action = findCustomLessonCodeActionForEdit(lesson, actionNumber);
    const type = target.dataset.codeType || '';
    if (type === 'give') {
      const item = defaultLessonCodeItem(true);
      action.start.push({ type, itemId: item.id, item: item.label, slot: 1 });
    } else if (type === 'teleport') {
      action.start.push({ type, coords: '0, 65, 0' });
    } else if (type === 'say') {
      action.start.push({ type, text: 'Текст задания' });
    }
    saveCustomLessonCode(courseId, lesson);
    renderCustomLessonCodeMenuFromTarget(target, actionNumber);
  }

  function addCustomLessonCompleteBlock(target) {
    const courseId = target.dataset.courseId || '';
    const lessonId = target.dataset.lessonId || '';
    const lesson = Game.education3d && Game.education3d.customLessonById
      ? Game.education3d.customLessonById(courseId, lessonId)
      : null;
    if (!lesson) return;
    const actionNumber = Number(target.dataset.actionNumber) || 1;
    const action = findCustomLessonCodeActionForEdit(lesson, actionNumber);
    const type = target.dataset.codeType || '';
    if (type === 'place' || type === 'mine') {
      const block = defaultLessonCodeItem(false);
      action.complete.push({ type, blockId: block.id, block: block.label });
    } else if (type === 'biome') {
      action.complete.push({ type, biome: 'Горы' });
    }
    saveCustomLessonCode(courseId, lesson);
    renderCustomLessonCodeMenuFromTarget(target, actionNumber);
  }

  function removeCustomLessonCodeBlock(target) {
    const courseId = target.dataset.courseId || '';
    const lessonId = target.dataset.lessonId || '';
    const lesson = Game.education3d && Game.education3d.customLessonById
      ? Game.education3d.customLessonById(courseId, lessonId)
      : null;
    if (!lesson) return;
    const actionNumber = Number(target.dataset.actionNumber) || 1;
    const action = findCustomLessonCodeActionForEdit(lesson, actionNumber);
    const list = target.dataset.blockKind === 'complete' ? action.complete : action.start;
    const index = Number(target.dataset.blockIndex);
    if (Number.isInteger(index) && index >= 0) list.splice(index, 1);
    saveCustomLessonCode(courseId, lesson);
    renderCustomLessonCodeMenuFromTarget(target, actionNumber);
  }

  function addCustomLessonThumbnail(input) {
    const file = input.files && input.files[0] ? input.files[0] : null;
    if (!file) return;
    const courseId = input.dataset.courseId || '';
    const lessonId = input.dataset.lessonId || '';
    const actionNumber = Number(input.dataset.actionNumber) || 1;
    const reader = new FileReader();
    reader.onload = () => {
      const lesson = Game.education3d && Game.education3d.customLessonById
        ? Game.education3d.customLessonById(courseId, lessonId)
        : null;
      if (!lesson) return;
      const action = findCustomLessonCodeActionForEdit(lesson, actionNumber);
      action.start.push({
        type: 'thumbnail',
        name: file.name || 'миниатюра',
        dataUrl: String(reader.result || ''),
      });
      saveCustomLessonCode(courseId, lesson);
    renderCustomLessonCodeMenuFromTarget(input, actionNumber);
    };
    reader.readAsDataURL(file);
  }

  function editCustomLessonCodeBlock(target) {
    const courseId = target.dataset.courseId || '';
    const lessonId = target.dataset.lessonId || '';
    const lesson = Game.education3d && Game.education3d.customLessonById
      ? Game.education3d.customLessonById(courseId, lessonId)
      : null;
    if (!lesson) return;
    const actionNumber = Number(target.dataset.actionNumber) || 1;
    const action = findCustomLessonCodeActionForEdit(lesson, actionNumber);
    const list = target.dataset.blockKind === 'complete' ? action.complete : action.start;
    const block = list[Number(target.dataset.blockIndex)];
    if (!block) return;
    const field = target.dataset.codeField || '';
    const value = target.value;
    if (field === 'itemId') {
      block.itemId = Number(value);
      block.item = lessonCodeItemLabel(block.itemId);
    } else if (field === 'blockId') {
      block.blockId = Number(value);
      block.block = lessonCodeItemLabel(block.blockId);
    } else if (field === 'slot') {
      block.slot = Math.max(1, Math.min(10, Number(value) || 1));
    } else if (field === 'coords') {
      block.coords = String(value || '').trim();
    } else if (field === 'text') {
      block.text = String(value || '').trim();
    } else if (field === 'biome') {
      block.biome = String(value || '').trim();
    }
    saveCustomLessonCode(courseId, lesson);
  }

  function addCustomLessonCodeBlockFromDrop(payload, dropTarget) {
    if (!payload || !dropTarget || payload.group !== dropTarget.dataset.codeDropKind) return;
    const fakeTarget = {
      dataset: {
        countryId: dropTarget.dataset.countryId || 'ru',
        grade: dropTarget.dataset.grade || '1',
        courseId: dropTarget.dataset.courseId || '',
        lessonId: dropTarget.dataset.lessonId || '',
        actionNumber: dropTarget.dataset.actionNumber || '1',
        codeType: payload.type || '',
      },
    };
    if (payload.group === 'start') addCustomLessonStartBlock(fakeTarget);
    else if (payload.group === 'complete') addCustomLessonCompleteBlock(fakeTarget);
  }

  async function loadWorld(worldId) {
    if (state && screen !== 'menu') {
      const canLeave = await askSaveCurrentWorld();
      if (!canLeave) return;
    }
    const meta = savedWorlds.get(worldId);
    if (!meta) return;
    await startWorldFromMeta(meta);
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
    if (Game.inventory3d && Game.inventory3d.closeChest) Game.inventory3d.closeChest(state);
    if (Game.inventory3d && inventoryRoot) Game.inventory3d.renderInventory(inventoryRoot, state);
    setScreen('inventory');
  }

  function openChestInventory(x, y, z) {
    if (!state || screen !== 'playing' || !Game.inventory3d || !inventoryRoot) return;
    if (!Game.inventory3d.openChest(state, x, y, z)) return;
    input.resetMovement();
    if (document.pointerLockElement === canvas3d && document.exitPointerLock) document.exitPointerLock();
    Game.inventory3d.renderInventory(inventoryRoot, state);
    setScreen('inventory');
  }

  function closeInventory() {
    if (!state || screen !== 'inventory') return;
    if (Game.inventory3d && Game.inventory3d.clearCarried) Game.inventory3d.clearCarried(state);
    if (Game.inventory3d && Game.inventory3d.closeChest) Game.inventory3d.closeChest(state);
    input.resetMovement();
    setScreen('playing');
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function setNotice(text) {
    if (!state || !state.ui) return;
    state.ui.noticeText = text;
    state.ui.noticeTimer = 1.35;
  }

  function parseHexColor(hex, fallback = [119, 119, 119]) {
    const value = String(hex || '');
    if (!/^#[0-9a-fA-F]{6}$/.test(value)) return fallback;
    return [
      parseInt(value.slice(1, 3), 16),
      parseInt(value.slice(3, 5), 16),
      parseInt(value.slice(5, 7), 16),
    ];
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
    return `${state.worldMeta.id || ''}:${state.worldMeta.seed || ''}:${state.worldMeta.currentDimension || 'overworld'}:${MAP_BITMAP_SIZE}`;
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
    for (const biome of Object.keys(labels)) colorCache[biome] = parseHexColor(MAP_BIOME_COLORS[biome] || '#777777');
    for (let py = 0; py < MAP_BITMAP_SIZE; py += 1) {
      const z = Math.floor((py + 0.5) / MAP_BITMAP_SIZE * world.d);
      for (let px = 0; px < MAP_BITMAP_SIZE; px += 1) {
        const x = Math.floor((px + 0.5) / MAP_BITMAP_SIZE * world.w);
        const color = colorCache[Game.generation3d.getBiomeAt3D(state, x, z)] || [119, 119, 119];
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

  function drawItemMapCells(ctx, mapX, mapY, scale, data) {
    const cells = data && data.cells && data.cells.biome ? data.cells.biome : {};
    ctx.save();
    ctx.fillStyle = '#101316';
    ctx.fillRect(mapX, mapY, state.world.w * scale, state.world.d * scale);
    for (const [key, cell] of Object.entries(cells)) {
      const parts = key.split(',').map(Number);
      if (parts.length !== 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) continue;
      const color = parseHexColor(MAP_BIOME_COLORS[cell && cell.biome] || '#777777');
      ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
      ctx.fillRect(mapX + parts[0] * scale, mapY + parts[1] * scale, Math.max(1, scale), Math.max(1, scale));
    }
    ctx.restore();
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

  function drawMineEntranceIcon(ctx, x, y, size, entrance) {
    const type = entrance && entrance.type ? entrance.type : 'deadend';
    ctx.save();
    ctx.translate(x, y);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath();
    ctx.ellipse(size * 0.08, size * 0.18, size * 0.72, size * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2b2119';
    ctx.beginPath();
    ctx.moveTo(-size * 0.42, size * 0.42);
    ctx.lineTo(-size * 0.42, -size * 0.06);
    ctx.quadraticCurveTo(0, -size * 0.56, size * 0.42, -size * 0.06);
    ctx.lineTo(size * 0.42, size * 0.42);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#7a5130';
    ctx.lineWidth = Math.max(2, size * 0.16);
    ctx.beginPath();
    ctx.moveTo(-size * 0.5, size * 0.42);
    ctx.lineTo(-size * 0.5, -size * 0.06);
    ctx.quadraticCurveTo(0, -size * 0.66, size * 0.5, -size * 0.06);
    ctx.lineTo(size * 0.5, size * 0.42);
    ctx.stroke();

    ctx.strokeStyle = '#b8874a';
    ctx.lineWidth = Math.max(1, size * 0.07);
    ctx.beginPath();
    ctx.moveTo(-size * 0.56, size * 0.42);
    ctx.lineTo(size * 0.56, size * 0.42);
    ctx.moveTo(-size * 0.28, size * 0.42);
    ctx.lineTo(-size * 0.28, -size * 0.2);
    ctx.moveTo(size * 0.28, size * 0.42);
    ctx.lineTo(size * 0.28, -size * 0.2);
    ctx.stroke();

    const markY = -size * 0.9;
    ctx.strokeStyle = 'rgba(0,0,0,0.76)';
    ctx.lineWidth = Math.max(3, size * 0.18);
    ctx.beginPath();
    if (type === 'through') {
      ctx.moveTo(-size * 0.22, markY + size * 0.12);
      ctx.lineTo(size * 0.22, markY - size * 0.12);
      ctx.lineTo(size * 0.02, markY - size * 0.18);
      ctx.moveTo(size * 0.22, markY - size * 0.12);
      ctx.lineTo(size * 0.14, markY + size * 0.08);
    } else {
      ctx.moveTo(-size * 0.18, markY - size * 0.16);
      ctx.lineTo(size * 0.18, markY + size * 0.16);
      ctx.moveTo(size * 0.18, markY - size * 0.16);
      ctx.lineTo(-size * 0.18, markY + size * 0.16);
    }
    ctx.stroke();

    ctx.strokeStyle = type === 'through' ? '#ffd36d' : '#f2f0e6';
    ctx.lineWidth = Math.max(1.5, size * 0.09);
    ctx.beginPath();
    if (type === 'through') {
      ctx.moveTo(-size * 0.22, markY + size * 0.12);
      ctx.lineTo(size * 0.22, markY - size * 0.12);
      ctx.lineTo(size * 0.02, markY - size * 0.18);
      ctx.moveTo(size * 0.22, markY - size * 0.12);
      ctx.lineTo(size * 0.14, markY + size * 0.08);
    } else {
      ctx.moveTo(-size * 0.18, markY - size * 0.16);
      ctx.lineTo(size * 0.18, markY + size * 0.16);
      ctx.moveTo(size * 0.18, markY - size * 0.16);
      ctx.lineTo(-size * 0.18, markY + size * 0.16);
    }
    ctx.stroke();

    if (entrance && entrance.hasEndPool) {
      const dropX = size * 0.38;
      const dropY = markY + size * 0.02;
      ctx.fillStyle = '#101820';
      ctx.beginPath();
      ctx.moveTo(dropX, dropY - size * 0.22);
      ctx.quadraticCurveTo(dropX + size * 0.24, dropY + size * 0.04, dropX, dropY + size * 0.24);
      ctx.quadraticCurveTo(dropX - size * 0.24, dropY + size * 0.04, dropX, dropY - size * 0.22);
      ctx.fill();
      ctx.fillStyle = '#61bdf2';
      ctx.beginPath();
      ctx.moveTo(dropX, dropY - size * 0.16);
      ctx.quadraticCurveTo(dropX + size * 0.16, dropY + size * 0.04, dropX, dropY + size * 0.16);
      ctx.quadraticCurveTo(dropX - size * 0.16, dropY + size * 0.04, dropX, dropY - size * 0.16);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCreativeCaveEntrances(ctx, mapX, mapY, scale, width, height, world) {
    if (!state || !state.worldMeta || state.worldMeta.mode !== 'creative') return;
    const generation = Game.generation3d;
    if (!generation || !generation.getCaveEntrancesInArea3D) return;
    const minX = clamp((-mapX) / scale, 0, world.w);
    const minZ = clamp((-mapY) / scale, 0, world.d);
    const maxX = clamp((width - mapX) / scale, 0, world.w);
    const maxZ = clamp((height - mapY) / scale, 0, world.d);
    const entrances = generation.getCaveEntrancesInArea3D(state, minX, minZ, maxX, maxZ);
    const iconSize = Math.max(9 * window.devicePixelRatio, Math.min(22 * window.devicePixelRatio, 7 * window.devicePixelRatio * Math.sqrt(scale)));
    for (const entrance of entrances) {
      drawMineEntranceIcon(ctx, mapX + entrance.x * scale, mapY + entrance.z * scale, iconSize, entrance);
    }
  }

  function drawPortalRuinIcon(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(0, size * 0.42, size * 0.78, size * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#14101d';
    ctx.lineWidth = Math.max(4, size * 0.28);
    ctx.beginPath();
    ctx.moveTo(-size * 0.42, size * 0.36);
    ctx.lineTo(-size * 0.42, -size * 0.32);
    ctx.moveTo(size * 0.42, size * 0.12);
    ctx.lineTo(size * 0.42, -size * 0.2);
    ctx.moveTo(-size * 0.42, -size * 0.32);
    ctx.lineTo(size * 0.14, -size * 0.48);
    ctx.stroke();
    ctx.strokeStyle = '#8f68c8';
    ctx.lineWidth = Math.max(2, size * 0.12);
    ctx.beginPath();
    ctx.moveTo(-size * 0.42, size * 0.36);
    ctx.lineTo(-size * 0.42, -size * 0.32);
    ctx.moveTo(size * 0.42, size * 0.12);
    ctx.lineTo(size * 0.42, -size * 0.2);
    ctx.moveTo(-size * 0.42, -size * 0.32);
    ctx.lineTo(size * 0.14, -size * 0.48);
    ctx.stroke();
    ctx.fillStyle = '#4d356f';
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.lineWidth = Math.max(1, size * 0.08);
    ctx.beginPath();
    ctx.arc(0, size * 0.1, size * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawCreativePortalRuins(ctx, mapX, mapY, scale, world) {
    if (!state || !state.worldMeta || state.worldMeta.mode !== 'creative') return;
    if (state.worldMeta.currentDimension === 'underground') {
      const links = Array.isArray(state.worldMeta.portalLinks) ? state.worldMeta.portalLinks : [];
      const iconSize = Math.max(11 * window.devicePixelRatio, Math.min(25 * window.devicePixelRatio, 8 * window.devicePixelRatio * Math.sqrt(scale)));
      for (const link of links) {
        const portal = link && link.underground;
        if (!portal) continue;
        drawPortalRuinIcon(ctx, mapX + portal.x * scale, mapY + portal.z * scale, iconSize);
      }
      return;
    }
    const generation = Game.generation3d;
    if (!generation || !generation.getPortalRuins3D) return;
    const ruins = generation.getPortalRuins3D(state);
    const iconSize = Math.max(11 * window.devicePixelRatio, Math.min(25 * window.devicePixelRatio, 8 * window.devicePixelRatio * Math.sqrt(scale)));
    for (const ruin of ruins) {
      if (ruin.x < 0 || ruin.x > world.w || ruin.z < 0 || ruin.z > world.d) continue;
      drawPortalRuinIcon(ctx, mapX + ruin.x * scale, mapY + ruin.z * scale, iconSize);
    }
  }

  function drawVillageIcon(ctx, x, y, size, village) {
    const color = village && village.color ? village.color : '#d6b45d';
    ctx.save();
    ctx.translate(x, y);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    ctx.ellipse(0, size * 0.42, size * 0.82, size * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f0d9a6';
    ctx.strokeStyle = 'rgba(0,0,0,0.72)';
    ctx.lineWidth = Math.max(1.5, size * 0.1);
    ctx.beginPath();
    ctx.rect(-size * 0.42, -size * 0.04, size * 0.84, size * 0.48);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(0,0,0,0.78)';
    ctx.lineWidth = Math.max(2, size * 0.12);
    ctx.beginPath();
    ctx.moveTo(-size * 0.54, -size * 0.04);
    ctx.lineTo(0, -size * 0.52);
    ctx.lineTo(size * 0.54, -size * 0.04);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#6b4a2e';
    ctx.fillRect(-size * 0.12, size * 0.14, size * 0.24, size * 0.3);
    ctx.fillStyle = '#2f5f7a';
    ctx.fillRect(size * 0.2, size * 0.12, size * 0.14, size * 0.14);
    ctx.restore();
  }

  function drawCreativeVillages(ctx, mapX, mapY, scale, world) {
    if (!state || !state.worldMeta || state.worldMeta.mode !== 'creative') return;
    if (state.worldMeta.currentDimension === 'underground') return;
    const generation = Game.generation3d;
    if (!generation || !generation.getVillages3D) return;
    const villages = generation.getVillages3D(state);
    if (!villages.length) return;
    const links = generation.getVillageRoadLinks3D ? generation.getVillageRoadLinks3D(state) : [];
    ctx.save();
    ctx.strokeStyle = 'rgba(68,44,24,0.76)';
    ctx.lineWidth = Math.max(2 * window.devicePixelRatio, Math.min(5 * window.devicePixelRatio, 2 * window.devicePixelRatio * Math.sqrt(scale)));
    ctx.setLineDash([5 * window.devicePixelRatio, 4 * window.devicePixelRatio]);
    for (const link of links) {
      ctx.beginPath();
      ctx.moveTo(mapX + link.fromX * scale, mapY + link.fromZ * scale);
      ctx.lineTo(mapX + link.toX * scale, mapY + link.toZ * scale);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();

    const iconSize = Math.max(12 * window.devicePixelRatio, Math.min(28 * window.devicePixelRatio, 9 * window.devicePixelRatio * Math.sqrt(scale)));
    for (const village of villages) {
      if (village.x < 0 || village.x > world.w || village.z < 0 || village.z > world.d) continue;
      drawVillageIcon(ctx, mapX + village.x * scale, mapY + village.z * scale, iconSize, village);
    }
  }

  function drawBearDenIcon(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    ctx.ellipse(0, size * 0.42, size * 0.86, size * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#7a5a37';
    ctx.strokeStyle = 'rgba(0,0,0,0.72)';
    ctx.lineWidth = Math.max(1.5, size * 0.1);
    ctx.beginPath();
    ctx.moveTo(-size * 0.68, size * 0.28);
    ctx.quadraticCurveTo(-size * 0.34, -size * 0.28, 0, -size * 0.26);
    ctx.quadraticCurveTo(size * 0.42, -size * 0.22, size * 0.68, size * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#11100d';
    ctx.beginPath();
    ctx.ellipse(size * 0.04, size * 0.22, size * 0.34, size * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#6a3f25';
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.lineWidth = Math.max(1, size * 0.07);
    ctx.beginPath();
    ctx.arc(size * 0.08, size * 0.18, size * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1d130e';
    ctx.beginPath();
    ctx.arc(size * 0.16, size * 0.16, size * 0.04, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#5a3820';
    ctx.lineWidth = Math.max(2, size * 0.12);
    ctx.beginPath();
    ctx.moveTo(-size * 0.1, -size * 0.18);
    ctx.lineTo(-size * 0.1, -size * 0.64);
    ctx.stroke();
    ctx.fillStyle = '#24533d';
    ctx.beginPath();
    ctx.moveTo(-size * 0.1, -size * 0.74);
    ctx.lineTo(-size * 0.42, -size * 0.28);
    ctx.lineTo(size * 0.22, -size * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.62)';
    ctx.lineWidth = Math.max(1, size * 0.06);
    ctx.stroke();
    ctx.restore();
  }

  function drawBearDens(ctx, mapX, mapY, scale, world) {
    if (!state || !state.worldMeta || state.worldMeta.currentDimension === 'underground') return;
    const generation = Game.generation3d;
    if (!generation || !generation.getBearDens3D) return;
    const dens = generation.getBearDens3D(state);
    if (!dens.length) return;
    const iconSize = Math.max(12 * window.devicePixelRatio, Math.min(28 * window.devicePixelRatio, 9 * window.devicePixelRatio * Math.sqrt(scale)));
    for (const den of dens) {
      if (!den || den.x < 0 || den.x > world.w || den.z < 0 || den.z > world.d) continue;
      drawBearDenIcon(ctx, mapX + den.x * scale, mapY + den.z * scale, iconSize);
    }
  }

  function drawBlasterMinerHouseIcon(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'square';
    ctx.fillStyle = 'rgba(0,0,0,0.46)';
    ctx.beginPath();
    ctx.ellipse(0, size * 0.43, size * 0.92, size * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#6b5a44';
    ctx.strokeStyle = 'rgba(0,0,0,0.78)';
    ctx.lineWidth = Math.max(1.5, size * 0.1);
    ctx.fillRect(-size * 0.45, -size * 0.02, size * 0.72, size * 0.48);
    ctx.strokeRect(-size * 0.45, -size * 0.02, size * 0.72, size * 0.48);

    ctx.fillStyle = '#4d3928';
    ctx.beginPath();
    ctx.moveTo(-size * 0.58, -size * 0.02);
    ctx.lineTo(-size * 0.12, -size * 0.48);
    ctx.lineTo(size * 0.38, -size * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#201915';
    ctx.fillRect(-size * 0.2, size * 0.2, size * 0.18, size * 0.26);
    ctx.fillStyle = '#8a7b63';
    ctx.fillRect(size * 0.06, size * 0.12, size * 0.14, size * 0.12);

    const tx = size * 0.44;
    const ty = size * 0.08;
    ctx.fillStyle = '#b43a2f';
    ctx.strokeStyle = 'rgba(0,0,0,0.78)';
    ctx.lineWidth = Math.max(1, size * 0.07);
    ctx.fillRect(tx - size * 0.16, ty - size * 0.22, size * 0.32, size * 0.44);
    ctx.strokeRect(tx - size * 0.16, ty - size * 0.22, size * 0.32, size * 0.44);
    ctx.fillStyle = '#f2d28a';
    ctx.fillRect(tx - size * 0.12, ty - size * 0.02, size * 0.24, size * 0.06);
    ctx.fillStyle = '#2b2119';
    ctx.font = `bold ${Math.max(7, Math.floor(size * 0.32))}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('T', tx, ty - size * 0.08);
    ctx.restore();
  }

  function drawBlasterMinerHouses(ctx, mapX, mapY, scale, world) {
    if (!state || !state.worldMeta || state.worldMeta.currentDimension === 'underground') return;
    const generation = Game.generation3d;
    if (!generation || !generation.getBlasterMinerHouses3D) return;
    const houses = generation.getBlasterMinerHouses3D(state);
    if (!houses.length) return;
    const iconSize = Math.max(12 * window.devicePixelRatio, Math.min(28 * window.devicePixelRatio, 9 * window.devicePixelRatio * Math.sqrt(scale)));
    for (const house of houses) {
      if (!house || house.x < 0 || house.x > world.w || house.z < 0 || house.z > world.d) continue;
      drawBlasterMinerHouseIcon(ctx, mapX + house.x * scale, mapY + house.z * scale, iconSize);
    }
  }

  function drawTreeHouseIcon(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    ctx.ellipse(0, size * 0.44, size * 0.82, size * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#5a3820';
    ctx.lineWidth = Math.max(2, size * 0.16);
    ctx.beginPath();
    ctx.moveTo(0, size * 0.5);
    ctx.lineTo(0, -size * 0.44);
    ctx.stroke();

    ctx.fillStyle = '#2f6b42';
    ctx.strokeStyle = 'rgba(0,0,0,0.72)';
    ctx.lineWidth = Math.max(1.5, size * 0.08);
    ctx.beginPath();
    ctx.arc(0, -size * 0.5, size * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#8a6236';
    ctx.strokeStyle = 'rgba(0,0,0,0.78)';
    ctx.lineWidth = Math.max(1.5, size * 0.08);
    ctx.fillRect(-size * 0.34, -size * 0.34, size * 0.68, size * 0.38);
    ctx.strokeRect(-size * 0.34, -size * 0.34, size * 0.68, size * 0.38);
    ctx.fillStyle = '#5f3c24';
    ctx.beginPath();
    ctx.moveTo(-size * 0.44, -size * 0.34);
    ctx.lineTo(0, -size * 0.68);
    ctx.lineTo(size * 0.44, -size * 0.34);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#a87c45';
    ctx.lineWidth = Math.max(1, size * 0.07);
    ctx.beginPath();
    ctx.moveTo(size * 0.22, size * 0.34);
    ctx.lineTo(size * 0.02, size * 0.12);
    ctx.lineTo(size * 0.22, -size * 0.08);
    ctx.stroke();
    ctx.restore();
  }

  function drawTreeHouses(ctx, mapX, mapY, scale, world) {
    if (!state || !state.worldMeta || state.worldMeta.currentDimension === 'underground') return;
    const generation = Game.generation3d;
    if (!generation || !generation.getTreeHouses3D) return;
    const houses = generation.getTreeHouses3D(state);
    if (!houses.length) return;
    const iconSize = Math.max(12 * window.devicePixelRatio, Math.min(28 * window.devicePixelRatio, 9 * window.devicePixelRatio * Math.sqrt(scale)));
    for (const house of houses) {
      if (!house || house.x < 0 || house.x > world.w || house.z < 0 || house.z > world.d) continue;
      drawTreeHouseIcon(ctx, mapX + house.x * scale, mapY + house.z * scale, iconSize);
    }
  }

  function drawTreasuryIcon(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'square';
    ctx.fillStyle = 'rgba(0,0,0,0.48)';
    ctx.beginPath();
    ctx.ellipse(0, size * 0.44, size * 0.9, size * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2d3130';
    ctx.strokeStyle = 'rgba(0,0,0,0.82)';
    ctx.lineWidth = Math.max(2, size * 0.12);
    ctx.fillRect(-size * 0.58, -size * 0.58, size * 1.16, size * 1.16);
    ctx.strokeRect(-size * 0.58, -size * 0.58, size * 1.16, size * 1.16);

    ctx.fillStyle = '#7a542f';
    ctx.strokeStyle = '#1c1209';
    ctx.lineWidth = Math.max(1.5, size * 0.08);
    ctx.fillRect(-size * 0.38, -size * 0.12, size * 0.76, size * 0.42);
    ctx.strokeRect(-size * 0.38, -size * 0.12, size * 0.76, size * 0.42);
    ctx.fillStyle = '#5a3921';
    ctx.fillRect(-size * 0.38, -size * 0.26, size * 0.76, size * 0.2);
    ctx.strokeRect(-size * 0.38, -size * 0.26, size * 0.76, size * 0.2);
    ctx.fillStyle = '#f1c85c';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = Math.max(1, size * 0.05);
    ctx.fillRect(-size * 0.08, -size * 0.08, size * 0.16, size * 0.18);
    ctx.strokeRect(-size * 0.08, -size * 0.08, size * 0.16, size * 0.18);
    ctx.restore();
  }

  function drawCreativeTreasuries(ctx, mapX, mapY, scale, world) {
    if (!state || !state.worldMeta || state.worldMeta.mode !== 'creative') return;
    if (state.worldMeta.currentDimension === 'underground') return;
    const generation = Game.generation3d;
    if (!generation || !generation.getTreasuries3D) return;
    const treasuries = generation.getTreasuries3D(state);
    if (!treasuries.length) return;
    const iconSize = Math.max(12 * window.devicePixelRatio, Math.min(28 * window.devicePixelRatio, 9 * window.devicePixelRatio * Math.sqrt(scale)));
    for (const treasury of treasuries) {
      if (!treasury || treasury.x < 0 || treasury.x > world.w || treasury.z < 0 || treasury.z > world.d) continue;
      drawTreasuryIcon(ctx, mapX + treasury.x * scale, mapY + treasury.z * scale, iconSize);
    }
  }

  function drawSpawnTentIcon(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.fillStyle = 'rgba(0,0,0,0.46)';
    ctx.beginPath();
    ctx.ellipse(0, size * 0.44, size * 0.88, size * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f2d28a';
    ctx.strokeStyle = 'rgba(0,0,0,0.78)';
    ctx.lineWidth = Math.max(2, size * 0.12);
    ctx.beginPath();
    ctx.moveTo(-size * 0.72, size * 0.34);
    ctx.lineTo(0, -size * 0.6);
    ctx.lineTo(size * 0.72, size * 0.34);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#7b4a2a';
    ctx.lineWidth = Math.max(1.5, size * 0.08);
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.56);
    ctx.lineTo(0, size * 0.34);
    ctx.moveTo(-size * 0.72, size * 0.34);
    ctx.lineTo(size * 0.72, size * 0.34);
    ctx.stroke();

    ctx.fillStyle = '#5b3522';
    ctx.beginPath();
    ctx.moveTo(-size * 0.18, size * 0.34);
    ctx.lineTo(0, -size * 0.06);
    ctx.lineTo(size * 0.18, size * 0.34);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawSpawnTentMarker(ctx, mapX, mapY, scale, world) {
    if (!state || !state.worldMeta || state.worldMeta.currentDimension === 'underground') return;
    const generation = Game.generation3d;
    if (!generation || !generation.getWorldSpawn3D) return;
    const spawn = generation.getWorldSpawn3D(state);
    if (!spawn || spawn.x < 0 || spawn.x > world.w || spawn.z < 0 || spawn.z > world.d) return;
    const iconSize = Math.max(12 * window.devicePixelRatio, Math.min(28 * window.devicePixelRatio, 9 * window.devicePixelRatio * Math.sqrt(scale)));
    drawSpawnTentIcon(ctx, mapX + (spawn.x + 0.5) * scale, mapY + (spawn.z + 0.5) * scale, iconSize);
  }

  function drawBotPlayerMarker(ctx, x, y, size, color, yaw) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI - (yaw || 0));
    ctx.fillStyle = color || '#8fd0ff';
    ctx.strokeStyle = 'rgba(0,0,0,0.72)';
    ctx.lineWidth = Math.max(1.5, size * 0.16);
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.68, size * 0.74);
    ctx.lineTo(0, size * 0.42);
    ctx.lineTo(-size * 0.68, size * 0.74);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function botMapColor(bot) {
    const value = Number(bot && bot.color);
    if (!Number.isFinite(value)) return '#8fd0ff';
    return `#${Math.max(0, Math.min(0xffffff, value)).toString(16).padStart(6, '0')}`;
  }

  function drawBotMarkers(ctx, mapX, mapY, scale, world) {
    if (!state || !state.entities || !Array.isArray(state.entities.bots)) return;
    const bots = state.entities.bots;
    if (!bots.length) return;
    const size = Math.max(8 * window.devicePixelRatio, Math.min(18 * window.devicePixelRatio, 9 * window.devicePixelRatio * Math.sqrt(scale)));
    ctx.save();
    ctx.font = `${Math.max(9, 11 * window.devicePixelRatio)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const bot of bots) {
      if (!bot || bot.x < 0 || bot.x > world.w || bot.z < 0 || bot.z > world.d) continue;
      const x = mapX + bot.x * scale;
      const y = mapY + bot.z * scale;
      const color = botMapColor(bot);
      drawBotPlayerMarker(ctx, x, y, size, color, bot.yaw || 0);
      if (scale > 0.9) {
        ctx.fillStyle = 'rgba(0,0,0,0.72)';
        ctx.fillText(bot.name || 'Bot', x + 1, y + size * 0.82 + 1);
        ctx.fillStyle = '#f5f0df';
        ctx.fillText(bot.name || 'Bot', x, y + size * 0.82);
      }
    }
    ctx.restore();
  }

  function drawMapWaypoint(ctx, mapX, mapY, scale) {
    const waypoint = state && state.ui ? state.ui.mapWaypoint : null;
    if (!waypoint) return;
    const x = mapX + waypoint.x * scale;
    const y = mapY + waypoint.z * scale;
    const size = Math.max(8 * window.devicePixelRatio, Math.min(18 * window.devicePixelRatio, 10 * Math.sqrt(scale)));
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = 'rgba(0,0,0,0.78)';
    ctx.lineWidth = Math.max(3, size * 0.28);
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(0, size);
    ctx.moveTo(-size, 0);
    ctx.lineTo(size, 0);
    ctx.stroke();
    ctx.strokeStyle = '#ffdf7a';
    ctx.lineWidth = Math.max(1.5, size * 0.14);
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(0, size);
    ctx.moveTo(-size, 0);
    ctx.lineTo(size, 0);
    ctx.stroke();
    ctx.fillStyle = '#ffdf7a';
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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
    const itemStack = state.ui.openItemMapStack || null;
    const bitmap = itemStack ? null : ensureMapBitmap();
    if (!itemStack && !bitmap) return;
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
    if (itemStack && Game.inventory3d && Game.inventory3d.ensureMapData) {
      drawItemMapCells(ctx, x, y, scale, Game.inventory3d.ensureMapData(itemStack));
    } else {
      ctx.drawImage(bitmap, x, y, viewW, viewH);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.42)';
    ctx.lineWidth = Math.max(1, window.devicePixelRatio);
    ctx.strokeRect(x + 0.5, y + 0.5, viewW - 1, viewH - 1);
    if (!itemStack) {
      drawCreativeCaveEntrances(ctx, x, y, scale, width, height, world);
      drawCreativePortalRuins(ctx, x, y, scale, world);
      drawCreativeVillages(ctx, x, y, scale, world);
      drawBearDens(ctx, x, y, scale, world);
      drawBlasterMinerHouses(ctx, x, y, scale, world);
      drawTreeHouses(ctx, x, y, scale, world);
      drawSpawnTentMarker(ctx, x, y, scale, world);
    }
    drawMapWaypoint(ctx, x, y, scale);
    drawBotMarkers(ctx, x, y, scale, world);

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
    const itemStack = state.ui.openItemMapStack || null;
    const canTeleport = !itemStack && state.worldMeta.mode === 'creative' && !!state.ui.mapWaypoint;
    const name = escapeHtml(state.worldMeta.name || 'Мир');
    const seed = escapeHtml(state.worldMeta.seed || '');
    mapRoot.innerHTML = `
      <div class="map-toolbar">
        <div class="map-title">
          <h2>${itemStack ? 'Карта' : 'Карта мира'}</h2>
          <div class="map-subtitle">${itemStack ? 'Заполняется по исследованию, структуры скрыты' : `${name}${seed ? ` / ${seed}` : ''}`}</div>
        </div>
        <div class="map-actions">
          <button class="map-btn" type="button" data-map-action="center">К игроку</button>
          ${canTeleport ? '<button class="map-btn" type="button" data-map-action="teleport">Телепортироваться</button>' : ''}
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
          ${itemStack ? '' : `<div class="map-legend-item">
            <span class="map-legend-swatch" style="background:#d6b45d"></span>
            <span>Деревня</span>
          </div>
          <div class="map-legend-item">
            <span class="map-legend-swatch" style="background:#7a5a37"></span>
            <span>Берлога</span>
          </div>
          <div class="map-legend-item">
            <span class="map-legend-swatch" style="background:#b43a2f"></span>
            <span>Дом взрывальщика-шахтера</span>
          </div>
          <div class="map-legend-item">
            <span class="map-legend-swatch" style="background:#2f6b42"></span>
            <span>Домик на дереве</span>
          </div>
          <div class="map-legend-item">
            <span class="map-legend-swatch" style="background:#f2d28a"></span>
            <span>Спавн</span>
          </div>
          <div class="map-legend-item">
            <span class="map-legend-swatch" style="background:#8fd0ff"></span>
            <span>Боты</span>
          </div>`}
        </div>
        <div class="map-hint">ЛКМ - поставить цель, C - сбросить цель${canTeleport ? ', кнопка вверху - телепорт' : ''}, колесо мыши - масштаб, перетаскивание - сдвиг, M или Escape - закрыть.</div>
      </div>
    `;
    ensureMapCanvas();
    renderMap();
  }

  function openMap(options = {}) {
    if (!state || screen !== 'playing') return;
    if (!options.allowAnyMode && (!state.worldMeta || state.worldMeta.mode !== 'creative')) {
      const mapStack = Game.inventory3d && Game.inventory3d.findFirstMapStack
        ? Game.inventory3d.findFirstMapStack(state)
        : null;
      if (mapStack) {
        openItemMap(mapStack);
      } else {
        setNotice('У вас в инвентаре нет карты');
      }
      return;
    }
    input.resetMovement();
    if (document.pointerLockElement === canvas3d && document.exitPointerLock) document.exitPointerLock();
    state.ui.openItemMapStack = null;
    state.ui.mapCenterX = state.player.x;
    state.ui.mapCenterZ = state.player.z;
    setScreen('map');
    renderMapRoot();
  }

  function closeMap() {
    if (!state || screen !== 'map') return;
    input.resetMovement();
    mapDrag = null;
    if (state.ui) state.ui.openItemMapStack = null;
    if (mapCanvas) mapCanvas.classList.remove('is-dragging');
    setScreen('playing');
  }

  Game.openMap = openMap;
  function openItemMap(stack) {
    if (!state || screen !== 'playing' || !stack) return;
    if (Game.inventory3d && Game.inventory3d.ensureMapData) Game.inventory3d.ensureMapData(stack);
    if (Game.inventory3d && Game.inventory3d.updateInventoryMaps) Game.inventory3d.updateInventoryMaps(state);
    input.resetMovement();
    if (document.pointerLockElement === canvas3d && document.exitPointerLock) document.exitPointerLock();
    state.ui.openItemMapStack = stack;
    state.ui.mapCenterX = state.player.x;
    state.ui.mapCenterZ = state.player.z;
    setScreen('map');
    renderMapRoot();
  }
  Game.openItemMap = openItemMap;
  Game.openChestInventory = openChestInventory;

  function centerMapOnPlayer() {
    if (!state || !state.player) return;
    state.ui.mapCenterX = state.player.x;
    state.ui.mapCenterZ = state.player.z;
    renderMap();
  }

  function setMapWaypointFromScreen(screenX, screenY) {
    if (!state || !state.ui || !state.world || !mapCanvas) return;
    const pos = mapScreenToWorld(screenX, screenY);
    state.ui.mapWaypoint = {
      x: clamp(pos.x, 0, state.world.w),
      z: clamp(pos.z, 0, state.world.d),
    };
    setNotice('Цель поставлена');
    renderMapRoot();
  }

  function clearMapWaypoint() {
    if (!state || !state.ui || !state.ui.mapWaypoint) return;
    state.ui.mapWaypoint = null;
    setNotice('Цель сброшена');
    if (screen === 'map') renderMapRoot();
    else renderMap();
  }

  function creativeMapTeleportToWaypoint() {
    if (!state || !state.ui || !state.player || !state.world || !state.worldMeta || state.worldMeta.mode !== 'creative') return;
    const waypoint = state.ui.mapWaypoint;
    if (!waypoint) return;
    const bx = Math.floor(clamp(waypoint.x, 1, state.world.w - 2));
    const bz = Math.floor(clamp(waypoint.z, 1, state.world.d - 2));
    const generation = Game.generation3d;
    const y = generation && generation.getSurfaceSpawnY3D
      ? generation.getSurfaceSpawnY3D(state, bx, bz)
      : Math.min(state.world.h - 1, Math.max(2, state.player.y));
    state.ui.pendingMapTeleport = {
      x: bx + 0.5,
      y: clamp(Number.isFinite(y) ? y : state.player.y, 1, state.world.h + 4),
      z: bz + 0.5,
      radius: MAP_TELEPORT_CHUNK_RADIUS,
    };
    state.ui.topNoticeText = 'Телепортация';
    state.ui.mapWaypoint = null;
    closeMap();
  }

  function finishPendingMapTeleport(teleport) {
    if (!state || !state.ui || !state.player || !teleport) return;
    state.player.x = teleport.x;
    state.player.y = teleport.y;
    state.player.z = teleport.z;
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.vz = 0;
    state.player.onGround = false;
    state.ui.mapCenterX = state.player.x;
    state.ui.mapCenterZ = state.player.z;
    state.ui.pendingMapTeleport = null;
    state.ui.topNoticeText = '';
    const generation = Game.generation3d;
    if (generation && generation.ensureChunksAroundPlayer3D) generation.ensureChunksAroundPlayer3D(state);
    setNotice('Телепортация выполнена');
  }

  function processPendingMapTeleport() {
    const teleport = state && state.ui ? state.ui.pendingMapTeleport : null;
    if (!teleport || !state.worldMeta || state.worldMeta.mode !== 'creative') {
      if (state && state.ui) state.ui.topNoticeText = '';
      return;
    }
    const generation = Game.generation3d;
    if (!generation || !generation.ensureChunksAroundPoint3D || !generation.chunksAroundPointReady3D) {
      finishPendingMapTeleport(teleport);
      return;
    }
    state.ui.topNoticeText = 'Телепортация';
    const radius = Number.isFinite(teleport.radius) ? teleport.radius : MAP_TELEPORT_CHUNK_RADIUS;
    generation.ensureChunksAroundPoint3D(state, teleport.x, teleport.y, teleport.z, radius);
    if (generation.chunksAroundPointReady3D(state, teleport.x, teleport.y, teleport.z, radius)) {
      finishPendingMapTeleport(teleport);
    }
  }

  function playerTouchingActivePortal() {
    if (!state || !state.player || !state.world) return null;
    const block = Game.blocks && Game.blocks.BLOCK;
    const player = state.player;
    const minX = Math.floor(player.x - 0.32);
    const maxX = Math.floor(player.x + 0.32);
    const minY = Math.floor(player.y);
    const maxY = Math.floor(player.y + 1.78);
    const minZ = Math.floor(player.z - 0.32);
    const maxZ = Math.floor(player.z + 0.32);
    for (let y = minY; y <= maxY; y += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          if (Game.world3d.getBlock3D(state, x, y, z) === block.ACTIVE_STRANGE_PORTAL) return { x, y, z };
        }
      }
    }
    return null;
  }

  function linkForPortalTouch(touch) {
    const links = state && state.worldMeta && Array.isArray(state.worldMeta.portalLinks) ? state.worldMeta.portalLinks : [];
    const dimension = currentDimension();
    for (const link of links) {
      const portal = link && link[dimension];
      if (!portal) continue;
      const dx = Math.abs(touch.x - portal.x);
      const dy = Math.abs(touch.y - portal.y);
      const dz = Math.abs(touch.z - portal.z);
      if (portal.axis === 'x') {
        if (dx <= 1 && dz <= 2 && dy <= 4) return link;
      } else if (dz <= 1 && dx <= 2 && dy <= 4) {
        return link;
      }
    }
    return null;
  }

  async function switchDimension(targetDimension, targetPortal) {
    if (!state || !state.worldMeta || !targetPortal || dimensionSwitching) return;
    dimensionSwitching = true;
    try {
      const fromDimension = currentDimension();
      if (!state.dimensionWorlds) state.dimensionWorlds = {};
      if (!state.dimensionEntities) state.dimensionEntities = {};
      if (!state.worldMeta.dimensionPlayers) state.worldMeta.dimensionPlayers = {};
      state.worldMeta.dimensionPlayers[fromDimension] = captureDimensionPlayer();
      state.dimensionWorlds[fromDimension] = state.world;
      state.dimensionEntities[fromDimension] = state.entities ? { sheep: Array.isArray(state.entities.sheep) ? state.entities.sheep : [] } : { sheep: [] };

      let nextWorld = state.dimensionWorlds[targetDimension];
      if (!nextWorld) {
        const constants = Game.constants3d;
        nextWorld = Game.world3d.createWorld3D(constants.WORLD_W, constants.WORLD_H, constants.WORLD_D);
        state.dimensionWorlds[targetDimension] = nextWorld;
      }
      state.world = nextWorld;
      state.entities = state.dimensionEntities[targetDimension] || { sheep: [] };
      state.worldMeta.currentDimension = targetDimension;
      state.world.dimension = targetDimension;
      state.world.worldMeta = state.worldMeta;
      const entryPlayer = {
        x: targetPortal.x + 0.5,
        y: targetPortal.y + 1.2,
        z: targetPortal.z + 0.5,
        yaw: state.player.yaw,
        pitch: state.player.pitch,
      };
      state.worldMeta.player = entryPlayer;
      applyDimensionPlayer(entryPlayer);

      if (Game.storage3d && Game.storage3d.listChunkKeys && state.worldMeta.id) {
        const storageId = dimensionStorageWorldId(state.worldMeta.id, targetDimension);
        const keys = await Game.storage3d.listChunkKeys(storageId);
        if (keys.length && (!state.world.savedChunks || state.world.savedChunks.size === 0)) state.world.savedChunks = new Set(keys);
      }
      const needsGenerate = !state.world.chunks || state.world.chunks.size === 0;
      if (needsGenerate) Game.generation3d.generateWorld3D(state);
      state.dimensionWorlds[targetDimension] = state.world;
      applyDimensionPlayer(entryPlayer);
      state.player.portalCooldown = 1.2;
      state.ui.mapBitmap = null;
      state.ui.mapBitmapKey = '';
      if (Game.renderer3d) Game.renderer3d.setWorld(state);
      setNotice(targetDimension === 'underground' ? 'Подземное измерение' : 'Обычный мир');
      if (Game.storage3d && Game.storage3d.saveWorldMeta && state.worldMeta.id) {
        state.worldMeta.player = capturePlayerMeta();
        state.worldMeta.updatedAt = Date.now();
        Game.storage3d.saveWorldMeta(state.worldMeta);
      }
    } finally {
      dimensionSwitching = false;
    }
  }

  function updatePortalTravel(dt) {
    if (!state || !state.player) return;
    state.player.portalCooldown = Math.max(0, (state.player.portalCooldown || 0) - dt);
    if (state.player.portalCooldown > 0 || dimensionSwitching) return;
    const touch = playerTouchingActivePortal();
    if (!touch) return;
    const link = linkForPortalTouch(touch);
    if (!link) return;
    const targetDimension = currentDimension() === 'underground' ? 'overworld' : 'underground';
    const targetPortal = link[targetDimension];
    if (!targetPortal) return;
    switchDimension(targetDimension, targetPortal);
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

  function toggleShaderCamera() {
    if (!state || !state.ui) return;
    if (!state.worldMeta || !state.worldMeta.shadersEnabled) {
      state.ui.noticeText = 'Смена лица доступна только с шейдерами';
      state.ui.noticeTimer = 1.6;
      return;
    }
    const current = state.ui.cameraMode || 'first';
    const next = current === 'first' ? 'second' : (current === 'second' ? 'third' : 'first');
    state.ui.cameraMode = next;
    state.ui.noticeText = next === 'first' ? 'Первое лицо' : (next === 'second' ? 'Вид со спины' : 'Вид на лицо');
    state.ui.noticeTimer = 1.2;
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
    if (state.pause && state.pause.open) return;
    if (!state.perf) state.perf = {};
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
    const actions = input.consumeActions();
    let t0 = performance.now();
    Game.player3d.updatePlayer3D(state, input.input, mouse, dt, actions);
    state.perf.playerMs = performance.now() - t0;
    if (Game.generation3d.updateVolcanoes3D) Game.generation3d.updateVolcanoes3D(state, dt);
    t0 = performance.now();
    if (Game.generation3d.ensureChunksAroundPlayer3D) Game.generation3d.ensureChunksAroundPlayer3D(state);
    processPendingMapTeleport();
    state.ui.mapRevealTimer = Math.max(0, (state.ui.mapRevealTimer || 0) - dt);
    if (state.ui.mapRevealTimer <= 0 && Game.inventory3d && Game.inventory3d.updateInventoryMaps) {
      Game.inventory3d.updateInventoryMaps(state);
      state.ui.mapRevealTimer = 1;
    }
    state.perf.chunksMs = performance.now() - t0;
    if (actions.cameraTogglePressed) toggleShaderCamera();
    updatePortalTravel(dt);
    t0 = performance.now();
    if (Game.entities3d) Game.entities3d.updateEntities3D(state, dt);
    if (Game.bots3d) Game.bots3d.updateBots3D(state, dt);
    state.perf.entitiesMs = performance.now() - t0;
    t0 = performance.now();
    Game.interaction3d.updateInteraction3D(state, input.input, actions, dt);
    if (Game.interaction3d.updateDynamite3D) Game.interaction3d.updateDynamite3D(state, dt);
    if (Game.education3d && Game.education3d.updateEducation) Game.education3d.updateEducation(state);
    state.perf.interactionMs = performance.now() - t0;
    t0 = performance.now();
    if (Game.grass3d) Game.grass3d.updateGrass3D(state, dt);
    state.perf.grassMs = performance.now() - t0;
    t0 = performance.now();
    Game.fluids3d.updateFluids3D(state, dt);
    state.perf.fluidMs = performance.now() - t0;
  }

  function updateMapLiveBots(dt) {
    if (!state || !state.worldMeta || !state.worldMeta.botsEnabled || !Game.bots3d) return;
    const t0 = performance.now();
    Game.bots3d.updateBots3D(state, dt);
    if (state.perf) state.perf.entitiesMs = performance.now() - t0;
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (screen === 'playing' && state) {
      update(dt);
      triggerAutosave();
      if (screen === 'playing') {
        Game.renderer3d.resize(canvas3d, overlay);
        const renderStart = performance.now();
        Game.renderer3d.render(state, overlayCtx, overlay);
        if (state.perf) state.perf.renderMs = performance.now() - renderStart;
      }
    } else if ((screen === 'paused' || screen === 'inventory' || screen === 'map') && state) {
      if (Game.generation3d.ensureChunksAroundPlayer3D) Game.generation3d.ensureChunksAroundPlayer3D(state);
      if (screen === 'map') updateMapLiveBots(dt);
      triggerAutosave();
      Game.renderer3d.resize(canvas3d, overlay);
      const renderStart = performance.now();
      Game.renderer3d.render(state, overlayCtx, overlay);
      if (state.perf) state.perf.renderMs = performance.now() - renderStart;
      if (screen === 'map') renderMap();
    }
    requestAnimationFrame(loop);
  }

  menuRoot.addEventListener('submit', (event) => {
    if (!event.target || event.target.id !== 'newWorldForm') return;
    event.preventDefault();
    const data = new FormData(event.target);
    startWorld({
      name: data.get('name') || '',
      seed: data.get('seed') || '',
      mode: data.get('mode') || 'survival',
      shadersEnabled: data.get('shadersEnabled') === '1',
      expandedBlockAssortment: data.get('expandedBlockAssortment') === '1',
      explosionPackEnabled: data.get('explosionPackEnabled') === '1',
      playerSkin: getStoredPlayerSkin(),
      chunkRenderDistance: data.get('chunkRenderDistance') || 'auto',
      spawnBiome: data.get('spawnBiome') || 'any',
      botsEnabled: event.target.dataset.botsEnabled === 'true',
    });
  });

  menuRoot.addEventListener('click', (event) => {
    const target = event.target && event.target.closest ? event.target.closest('[data-action]') : event.target;
    const action = target && target.dataset ? target.dataset.action : '';
    if (action === 'resume') {
      resumeWorld();
    } else if (action === 'main-menu') {
      returnToMainMenu();
    } else if (action === 'show-single-world') {
      renderUnifiedMenu('start', 'world-create');
    } else if (action === 'show-load') {
      renderUnifiedMenu(target.dataset.context || (screen === 'paused' ? 'pause' : 'start'), 'load');
    } else if (action === 'show-skins') {
      renderSkinChooser(target.dataset.context || 'start', target.dataset.returnView || 'main');
    } else if (action === 'select-skin') {
      setStoredPlayerSkin(target.dataset.skinId || 'explorer');
      renderUnifiedMenu(target.dataset.context || 'start', target.dataset.returnView || 'main');
    } else if (action === 'back-menu') {
      renderUnifiedMenu(target.dataset.context || (screen === 'paused' ? 'pause' : 'start'), target.dataset.returnView || 'main');
    } else if (action === 'show-bot-world') {
      renderUnifiedMenu('start', 'bot-world');
    } else if (action === 'show-education') {
      openEducationMenu();
    } else if (action === 'change-education-country') {
      renderUnifiedMenu('start', 'education-country');
    } else if (action === 'education-country') {
      const countryId = Game.education3d && Game.education3d.saveCountryId
        ? Game.education3d.saveCountryId(target.dataset.countryId || 'ru')
        : (target.dataset.countryId || 'ru');
      renderUnifiedMenu('start', 'education-grade', { countryId });
    } else if (action === 'education-back-grade') {
      renderUnifiedMenu('start', 'education-grade', { countryId: target.dataset.countryId || 'ru' });
    } else if (action === 'education-grade') {
      const grade = Number(target.dataset.grade) || 1;
      const countryId = target.dataset.countryId || 'ru';
      if (grade < 1 || grade > 11) renderUnifiedMenu('start', 'education-unavailable', { countryId, grade });
      else if (event.shiftKey && grade === 5 && Game.education3d && Game.education3d.markGrade5ExamCompleted) {
        Game.education3d.markGrade5ExamCompleted(countryId);
        renderUnifiedMenu('start', 'education-subject', { countryId, grade });
      }
      else if (event.shiftKey && grade === 6 && Game.education3d && Game.education3d.markGrade6ExamCompleted) {
        Game.education3d.markGrade6ExamCompleted(countryId);
        renderUnifiedMenu('start', 'education-subject', { countryId, grade });
      }
      else if (grade === 5 && Game.education3d && Game.education3d.isGrade5ExamCompleted && !Game.education3d.isGrade5ExamCompleted(countryId)) {
        renderUnifiedMenu('start', 'education-grade5-exam', { countryId });
      }
      else if (grade === 6 && Game.education3d && Game.education3d.isGrade6ExamCompleted && !Game.education3d.isGrade6ExamCompleted(countryId)) {
        renderUnifiedMenu('start', 'education-grade6-exam', { countryId });
      }
      else renderUnifiedMenu('start', 'education-subject', { countryId, grade });
    } else if (action === 'education-grade5-exam-start') {
      startGrade5ExamWorld(target.dataset.countryId || 'ru');
    } else if (action === 'education-grade6-exam-start') {
      startGrade6ExamWorld(target.dataset.countryId || 'ru');
    } else if (action === 'education-subject') {
      renderUnifiedMenu('start', 'education-lesson', {
        countryId: target.dataset.countryId || 'ru',
        grade: Number(target.dataset.grade) || 1,
        subjectId: target.dataset.subjectId || 'language',
      });
    } else if (action === 'education-back-subject') {
      renderUnifiedMenu('start', 'education-subject', {
        countryId: target.dataset.countryId || 'ru',
        grade: Number(target.dataset.grade) || 1,
      });
    } else if (action === 'education-lesson') {
      startEducationWorld(
        target.dataset.countryId || 'ru',
        Number(target.dataset.grade) || 1,
        target.dataset.subjectId || 'language',
        Number(target.dataset.lesson) || 1,
      );
    } else if (action === 'education-custom-add') {
      const title = window.prompt('Название курса');
      if (!title || !title.trim()) return;
      const countryId = target.dataset.countryId || 'ru';
      const grade = Number(target.dataset.grade) || 1;
      const course = Game.education3d && Game.education3d.createCustomCourse
        ? Game.education3d.createCustomCourse(countryId, grade, title.trim())
        : null;
      renderUnifiedMenu('start', course ? 'education-custom-course' : 'education-subject', {
        countryId,
        grade,
        courseId: course ? course.id : '',
      });
    } else if (action === 'education-custom-course') {
      renderUnifiedMenu('start', 'education-custom-course', {
        countryId: target.dataset.countryId || 'ru',
        grade: Number(target.dataset.grade) || 1,
        courseId: target.dataset.courseId || '',
      });
      setScreen('menu');
    } else if (action === 'education-custom-add-lesson') {
      const seed = window.prompt('Seed урока (можно оставить пустым)');
      if (seed === null) return;
      const countryId = target.dataset.countryId || 'ru';
      const grade = Number(target.dataset.grade) || 1;
      const courseId = target.dataset.courseId || '';
      const lesson = Game.education3d && Game.education3d.createCustomLesson
        ? Game.education3d.createCustomLesson(courseId, seed.trim())
        : null;
      renderUnifiedMenu('start', lesson ? 'education-custom-creator' : 'education-custom-course', {
        countryId,
        grade,
        courseId,
        lessonId: lesson ? lesson.id : '',
      });
      setScreen('menu');
    } else if (action === 'education-custom-creator') {
      renderUnifiedMenu('start', 'education-custom-creator', {
        countryId: target.dataset.countryId || 'ru',
        grade: Number(target.dataset.grade) || 1,
        courseId: target.dataset.courseId || '',
        lessonId: target.dataset.lessonId || '',
      });
      setScreen('menu');
    } else if (action === 'education-custom-play') {
      startCustomLessonPlay(target.dataset.courseId || '', target.dataset.lessonId || '');
    } else if (action === 'education-custom-code') {
      renderUnifiedMenu('start', 'education-custom-code', {
        countryId: target.dataset.countryId || 'ru',
        grade: Number(target.dataset.grade) || 1,
        courseId: target.dataset.courseId || '',
        lessonId: target.dataset.lessonId || '',
      });
      setScreen('menu');
    } else if (action === 'education-custom-code-add-action') {
      addCustomLessonCodeAction(target);
    } else if (action === 'education-custom-code-add-start') {
      addCustomLessonStartBlock(target);
    } else if (action === 'education-custom-code-add-complete') {
      addCustomLessonCompleteBlock(target);
    } else if (action === 'education-custom-code-remove-block') {
      removeCustomLessonCodeBlock(target);
    } else if (action === 'education-custom-create-map') {
      saveCustomCreatorLesson(target.dataset.courseId || '', target.dataset.lessonId || '').then(() => {
        startCustomLessonMapEditor(target.dataset.courseId || '', target.dataset.lessonId || '');
      });
    } else if (action === 'education-custom-edit-map') {
      startCustomLessonMapEditor(target.dataset.courseId || '', target.dataset.lessonId || '');
    } else if (action === 'education-custom-done') {
      const countryId = target.dataset.countryId || 'ru';
      const grade = Number(target.dataset.grade) || 1;
      const courseId = target.dataset.courseId || '';
      saveCustomCreatorLesson(courseId, target.dataset.lessonId || '', { ready: true }).then(() => {
        state = null;
        renderUnifiedMenu('start', 'education-custom-course', { countryId, grade, courseId });
        setScreen('menu');
      });
    } else if (action === 'load-world') {
      loadWorld(target.dataset.worldId);
    } else if (action === 'delete-world') {
      deleteSavedWorld(target.dataset.worldId);
    }
  });

  menuRoot.addEventListener('change', (event) => {
    const element = event.target;
    const target = element && element.closest ? element.closest('[data-action]') : element;
    const action = target && target.dataset ? target.dataset.action : '';
    if (element && element.name === 'spawnBiome') {
      syncSpawnSeedInput();
    }
    if (element && (element.name === 'expandedBlockAssortment' || element.name === 'explosionPackEnabled')) {
      syncCreativeForcedInputs();
    }
    if (action === 'education-custom-code-select') {
      renderCustomLessonCodeMenuFromTarget(target, Number(target.value) || 1);
    } else if (action === 'education-custom-code-thumbnail') {
      addCustomLessonThumbnail(target);
    } else if (action === 'education-custom-code-edit-block') {
      editCustomLessonCodeBlock(target);
    }
  });

  menuRoot.addEventListener('input', (event) => {
    const target = event.target && event.target.closest ? event.target.closest('[data-action]') : event.target;
    const action = target && target.dataset ? target.dataset.action : '';
    if (action === 'education-custom-code-edit-block') {
      editCustomLessonCodeBlock(target);
    }
  });

  menuRoot.addEventListener('dragstart', (event) => {
    const target = event.target && event.target.closest ? event.target.closest('.lesson-code-palette-block') : null;
    if (!target || !event.dataTransfer) return;
    event.dataTransfer.setData('application/x-cubdep-code-block', JSON.stringify({
      group: target.dataset.codeGroup || '',
      type: target.dataset.codeType || '',
    }));
    event.dataTransfer.effectAllowed = 'copy';
  });

  menuRoot.addEventListener('dragover', (event) => {
    const dropTarget = event.target && event.target.closest ? event.target.closest('[data-code-drop-kind]') : null;
    if (!dropTarget) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  });

  menuRoot.addEventListener('drop', (event) => {
    const dropTarget = event.target && event.target.closest ? event.target.closest('[data-code-drop-kind]') : null;
    if (!dropTarget || !event.dataTransfer) return;
    event.preventDefault();
    try {
      const payload = JSON.parse(event.dataTransfer.getData('application/x-cubdep-code-block') || '{}');
      addCustomLessonCodeBlockFromDrop(payload, dropTarget);
    } catch (error) {
      // Ignore malformed drag data.
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
      if (action === 'teleport') creativeMapTeleportToWaypoint();
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
        moved: false,
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
      if (Math.hypot(event.clientX - mapDrag.x, event.clientY - mapDrag.y) > 5) mapDrag.moved = true;
      renderMap();
      event.preventDefault();
    });
    const endMapDrag = (event) => {
      if (!mapDrag || (event && mapDrag.pointerId !== event.pointerId)) return;
      const wasClick = event && !mapDrag.moved && event.target === mapCanvas;
      if (wasClick) setMapWaypointFromScreen(event.clientX, event.clientY);
      mapDrag = null;
      if (mapCanvas) mapCanvas.classList.remove('is-dragging');
    };
    mapRoot.addEventListener('pointerup', endMapDrag);
    mapRoot.addEventListener('pointercancel', endMapDrag);
  }

  window.addEventListener('keydown', (event) => {
    if (state && state.ui && state.ui.noteOpen) {
      event.preventDefault();
      return;
    }
    if (event.code === 'KeyM' && screen === 'playing') {
      input.input.keys[event.code] = false;
      openMap();
      event.preventDefault();
      return;
    }
    if (event.code === 'KeyC' && (screen === 'playing' || screen === 'map')) {
      input.input.keys[event.code] = false;
      clearMapWaypoint();
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
  window.addEventListener('pagehide', () => triggerAutosave(true));
  window.addEventListener('beforeunload', () => triggerAutosave(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') triggerAutosave(true);
  });
  renderUnifiedMenu('start', 'main');
  setScreen('menu');
  requestAnimationFrame(loop);
})();
