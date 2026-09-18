(() => {
  const Game = window.CubDep;
  const MAX_ACTIVE_PETS = 5;
  const PET_TYPES = Object.freeze({
    cat: { label: 'Кошка' },
    dog: { label: 'Собака' },
    capybara: { label: 'Капибара' },
    parrot: { label: 'Попугай' },
  });
  const PET_MODES = new Set(['follow', 'wait', 'wander']);
  const AIRBORNE_PET_ERROR = 'Сначала приземлитесь — питомец испугается высоты';
  const MODE_LABELS = Object.freeze({ follow: 'Следовать', wait: 'Ждать', wander: 'Гулять' });
  const PET_SIZES = Object.freeze({
    cat: { radius: 0.36, height: 0.86 },
    dog: { radius: 0.4, height: 0.92 },
    capybara: { radius: 0.5, height: 0.82 },
    parrot: { radius: 0.32, height: 0.72 },
  });
  let petsRoot = null;
  let getCurrentState = null;
  let gameCanvas = null;
  let petsUiVisible = false;
  let collectionOpen = false;
  let modePetId = '';
  let recordingSession = null;
  let pendingRecordingPetId = '';

  function cleanName(value) {
    return String(value || '').trim().slice(0, 32);
  }

  function finiteOr(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function normalizePet(record, fallbackIndex, state) {
    if (!record || !PET_TYPES[record.type]) return null;
    const name = cleanName(record.name);
    if (!name) return null;
    const player = state && state.player ? state.player : { x: 0.5, y: 1, z: 0.5 };
    return {
      id: String(record.id || `pet-${Date.now().toString(36)}-${fallbackIndex.toString(36)}`),
      type: record.type,
      name,
      active: !!record.active,
      mode: PET_MODES.has(record.mode) ? record.mode : 'follow',
      x: finiteOr(record.x, player.x + 1 + fallbackIndex * 0.3),
      y: finiteOr(record.y, player.y),
      z: finiteOr(record.z, player.z + 1),
      yaw: finiteOr(record.yaw, 0),
      anchorX: finiteOr(record.anchorX, finiteOr(record.x, player.x)),
      anchorZ: finiteOr(record.anchorZ, finiteOr(record.z, player.z)),
      wanderTimer: finiteOr(record.wanderTimer, 0),
    };
  }

  function ensurePets3D(state) {
    if (!state) return [];
    if (!state.worldMeta) state.worldMeta = {};
    if (!state.entities) state.entities = {};
    if (!state.ui) state.ui = {};
    if (state.ui.petsNormalized && Array.isArray(state.worldMeta.pets) && state.entities.pets === state.worldMeta.pets) {
      return state.worldMeta.pets;
    }
    const source = Array.isArray(state.worldMeta.pets) ? state.worldMeta.pets : [];
    const pets = [];
    let activeCount = 0;
    for (let index = 0; index < source.length; index += 1) {
      const pet = normalizePet(source[index], index, state);
      if (!pet) continue;
      if (pet.active && activeCount >= MAX_ACTIVE_PETS) pet.active = false;
      if (pet.active) activeCount += 1;
      pets.push(pet);
    }
    state.worldMeta.pets = pets;
    state.entities.pets = pets;
    state.ui.petsNormalized = true;
    return pets;
  }

  function activePetCount3D(state) {
    return ensurePets3D(state).filter((pet) => pet.active).length;
  }

  function positionNearPlayer(state, pet, index = 0) {
    const player = state && state.player ? state.player : { x: 0.5, y: 1, z: 0.5, yaw: 0 };
    const distance = 1.6 + (index % 2) * 0.45;
    pet.y = player.y;
    let angle = finiteOr(player.yaw, 0) + Math.PI + (index - 2) * 0.42;
    let found = false;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const candidateAngle = angle + attempt * Math.PI / 6;
      const candidateX = player.x + Math.sin(candidateAngle) * distance;
      const candidateZ = player.z + Math.cos(candidateAngle) * distance;
      if (petPositionClear(state, pet, candidateX, candidateZ)) {
        angle = candidateAngle;
        pet.x = candidateX;
        pet.z = candidateZ;
        found = true;
        break;
      }
    }
    if (!found) {
      pet.x = player.x;
      pet.z = player.z;
    }
    pet.yaw = angle + Math.PI;
    pet.anchorX = pet.x;
    pet.anchorZ = pet.z;
    pet.wanderTimer = 0;
  }

  function createPet3D(state, type, name) {
    const normalizedName = cleanName(name);
    if (!normalizedName) return { ok: false, error: 'Введите имя питомца' };
    if (!PET_TYPES[type]) return { ok: false, error: 'Неизвестный вид питомца' };
    if (!state || !state.player || state.player.onGround !== true) return { ok: false, error: AIRBORNE_PET_ERROR };
    const pets = ensurePets3D(state);
    const active = activePetCount3D(state) < MAX_ACTIVE_PETS;
    const pet = normalizePet({
      id: `pet-${Date.now().toString(36)}-${Math.floor(Math.random() * 0x100000).toString(36)}`,
      type,
      name: normalizedName,
      active,
      mode: 'follow',
    }, pets.length, state);
    positionNearPlayer(state, pet, activePetCount3D(state));
    pets.push(pet);
    if (state.worldMeta) state.worldMeta.updatedAt = Date.now();
    return { ok: true, pet };
  }

  function findPet(state, id) {
    return ensurePets3D(state).find((pet) => pet.id === id) || null;
  }

  function hidePet3D(state, id) {
    const pet = findPet(state, id);
    if (!pet || !pet.active) return false;
    if (isPetRecording3D(id) || isPetSpeaking3D(id)) cancelPetRecording3D();
    pet.active = false;
    if (state.worldMeta) state.worldMeta.updatedAt = Date.now();
    return true;
  }

  function resumePet3D(state, id) {
    const pet = findPet(state, id);
    if (!pet) return { ok: false, error: 'Питомец не найден' };
    if (pet.active) return { ok: true, pet };
    if (!state.player || state.player.onGround !== true) return { ok: false, error: AIRBORNE_PET_ERROR };
    if (activePetCount3D(state) >= MAX_ACTIVE_PETS) {
      return { ok: false, error: 'Можно выпустить не больше 5 питомцев' };
    }
    pet.active = true;
    positionNearPlayer(state, pet, activePetCount3D(state));
    if (state.worldMeta) state.worldMeta.updatedAt = Date.now();
    return { ok: true, pet };
  }

  function setPetMode3D(state, id, mode) {
    if (!PET_MODES.has(mode)) return false;
    const pet = findPet(state, id);
    if (!pet) return false;
    pet.mode = mode;
    pet.anchorX = pet.x;
    pet.anchorZ = pet.z;
    pet.wanderTimer = 0;
    if (state.worldMeta) state.worldMeta.updatedAt = Date.now();
    return true;
  }

  function getPetsViewModel3D(state) {
    const pets = ensurePets3D(state);
    const activeCount = pets.filter((pet) => pet.active).length;
    return {
      activeCount,
      maxActive: MAX_ACTIVE_PETS,
      pets: pets.map((pet) => ({
        ...pet,
        typeLabel: PET_TYPES[pet.type].label,
        modeLabel: MODE_LABELS[pet.mode],
        canResume: !pet.active && activeCount < MAX_ACTIVE_PETS,
        canHide: !!pet.active,
        actionLabel: pet.active
          ? `Убрать ${pet.name} в Переноску`
          : `Продолжить играть с питомцем ${pet.name}`,
      })),
    };
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function pauseForPetUi(state, paused) {
    if (state && state.pause) state.pause.open = !!paused;
    if (paused && typeof document !== 'undefined' && document.pointerLockElement && document.exitPointerLock) {
      document.exitPointerLock();
    }
  }

  function renderPetsUI() {
    if (!petsRoot) return;
    const state = getCurrentState && getCurrentState();
    const view = state ? getPetsViewModel3D(state) : { activeCount: 0, maxActive: MAX_ACTIVE_PETS, pets: [] };
    const selectedPet = modePetId ? view.pets.find((pet) => pet.id === modePetId && pet.active) : null;
    const petRows = view.pets.length
      ? view.pets.map((pet) => `
          <div class="pet-collection-row pet-kind-${escapeHtml(pet.type)}">
            <div class="pet-collection-copy">
              <strong>${escapeHtml(pet.name)}</strong>
              <span>${escapeHtml(pet.typeLabel)} · ${escapeHtml(pet.modeLabel)}</span>
            </div>
            ${pet.active
              ? `<button class="pet-hide-button" type="button" data-pet-action="hide" data-pet-id="${escapeHtml(pet.id)}">${escapeHtml(pet.actionLabel)}</button>`
              : `<button class="pet-resume-button" type="button" data-pet-action="resume" data-pet-id="${escapeHtml(pet.id)}" ${pet.canResume ? '' : 'disabled'}>${escapeHtml(pet.actionLabel)}</button>`}
          </div>
        `).join('')
      : '<p class="pet-empty">Переноска пока пуста. Создайте первого друга.</p>';
    petsRoot.innerHTML = `
      <button class="pets-open-button" type="button" data-pet-action="open" aria-label="Создать питомца">🐾 <span>Создать питомца</span></button>
      ${collectionOpen ? `
        <div class="pets-backdrop" data-pet-action="close"></div>
        <section class="pets-dialog" role="dialog" aria-modal="true" aria-label="Питомцы">
          <button class="pets-close-button" type="button" data-pet-action="close" aria-label="Закрыть">×</button>
          <h2>Питомцы</h2>
          <p class="pets-limit">Рядом с вами: ${view.activeCount}/${view.maxActive}</p>
          <form class="pet-create-form" data-pet-form="create">
            <label>Кого создать
              <select name="type">
                <option value="cat">Кошка</option>
                <option value="dog">Собака</option>
                <option value="capybara">Капибара</option>
                <option value="parrot">Попугай</option>
              </select>
            </label>
            <label>Имя питомца
              <input name="name" maxlength="32" required autocomplete="off" placeholder="Например, Барсик" />
            </label>
            <button type="submit">Создать</button>
          </form>
          <h3 class="pets-carrier-title">Переноска</h3>
          <div class="pet-collection">${petRows}</div>
          ${view.activeCount >= view.maxActive ? '<p class="pets-cap-note">Чтобы выпустить другого питомца, сначала уберите одного активного питомца в Переноску.</p>' : ''}
        </section>
      ` : ''}
      ${selectedPet ? `
        <div class="pets-backdrop" data-pet-action="close-mode"></div>
        <section class="pet-mode-dialog" role="dialog" aria-modal="true" aria-label="Режим питомца">
          <h3>${escapeHtml(selectedPet.name)}</h3>
          <p>Выберите режим</p>
          ${Object.keys(MODE_LABELS).map((mode) => `<button type="button" data-pet-action="mode" data-pet-id="${escapeHtml(selectedPet.id)}" data-pet-mode="${mode}" class="${selectedPet.mode === mode ? 'is-selected' : ''}">${MODE_LABELS[mode]}</button>`).join('')}
          <button type="button" data-pet-action="close-mode">Отмена</button>
        </section>
      ` : ''}
    `;
    petsRoot.classList.toggle('is-hidden', !petsUiVisible);
  }

  function closePetPanels() {
    collectionOpen = false;
    modePetId = '';
    const state = getCurrentState && getCurrentState();
    pauseForPetUi(state, false);
    renderPetsUI();
  }

  function openPetModeChooser(id) {
    const state = getCurrentState && getCurrentState();
    if (!state || !findPet(state, id)) return;
    collectionOpen = false;
    modePetId = id;
    pauseForPetUi(state, true);
    renderPetsUI();
  }

  function initPetsUI(root, stateGetter, canvas) {
    petsRoot = root || null;
    getCurrentState = typeof stateGetter === 'function' ? stateGetter : null;
    gameCanvas = canvas || null;
    if (!petsRoot || petsRoot.dataset.petsBound === '1') {
      renderPetsUI();
      return;
    }
    petsRoot.dataset.petsBound = '1';
    petsRoot.addEventListener('click', (event) => {
      const target = event.target && event.target.closest ? event.target.closest('[data-pet-action]') : null;
      if (!target) return;
      const state = getCurrentState && getCurrentState();
      if (!state) return;
      const action = target.dataset.petAction;
      if (action === 'open') {
        collectionOpen = true;
        modePetId = '';
        pauseForPetUi(state, true);
      } else if (action === 'close' || action === 'close-mode') {
        closePetPanels();
        return;
      } else if (action === 'resume') {
        const result = resumePet3D(state, target.dataset.petId || '');
        setNotice(state, result.ok ? `${result.pet.name} снова рядом` : result.error);
      } else if (action === 'hide') {
        const pet = findPet(state, target.dataset.petId || '');
        if (pet && hidePet3D(state, pet.id)) setNotice(state, `${pet.name} теперь в Переноске`);
      } else if (action === 'mode') {
        const pet = findPet(state, target.dataset.petId || '');
        if (pet && setPetMode3D(state, pet.id, target.dataset.petMode || '')) {
          setNotice(state, `${pet.name}: ${MODE_LABELS[pet.mode]}`);
          closePetPanels();
          return;
        }
      }
      renderPetsUI();
    });
    petsRoot.addEventListener('submit', (event) => {
      if (!event.target || event.target.dataset.petForm !== 'create') return;
      event.preventDefault();
      const state = getCurrentState && getCurrentState();
      if (!state) return;
      const data = new FormData(event.target);
      const result = createPet3D(state, String(data.get('type') || ''), String(data.get('name') || ''));
      setNotice(state, result.ok ? `${result.pet.name} теперь ваш питомец` : result.error);
      if (result.ok) event.target.reset();
      renderPetsUI();
    });
    renderPetsUI();
  }

  function setPetsUIVisible(visible) {
    petsUiVisible = !!visible;
    if (!petsUiVisible) {
      collectionOpen = false;
      modePetId = '';
    }
    renderPetsUI();
  }

  function setNotice(state, text, duration = 1.8) {
    if (!state || !state.ui) return;
    state.ui.noticeText = String(text || '');
    state.ui.noticeTimer = duration;
  }

  function raycastPet3D(state) {
    const pets = ensurePets3D(state).filter((pet) => pet.active);
    if (!pets.length || !state.player) return null;
    const player = state.player;
    const scale = Number.isFinite(player.scale) ? Math.max(0.25, Math.min(1024, player.scale)) : 1;
    const cosPitch = Math.cos(player.pitch || 0);
    const direction = {
      x: Math.sin(player.yaw || 0) * cosPitch,
      y: Math.sin(player.pitch || 0),
      z: Math.cos(player.yaw || 0) * cosPitch,
    };
    const eyeHeight = Game.constants3d && Number.isFinite(Game.constants3d.EYE_HEIGHT) ? Game.constants3d.EYE_HEIGHT : 1.58;
    const origin = { x: player.x, y: player.y + eyeHeight * scale, z: player.z };
    for (let distance = 0; distance <= 5.5 * scale; distance += 0.05) {
      const px = origin.x + direction.x * distance;
      const py = origin.y + direction.y * distance;
      const pz = origin.z + direction.z * distance;
      if (Game.world3d && Game.world3d.getBlock3D && Game.world3d.isSolidBlock3D) {
        const block = Game.world3d.getBlock3D(state, Math.floor(px), Math.floor(py), Math.floor(pz));
        if (Game.world3d.isSolidBlock3D(block)) return null;
      }
      for (const pet of pets) {
        const size = PET_SIZES[pet.type];
        if (px < pet.x - size.radius || px > pet.x + size.radius) continue;
        if (py < pet.y || py > pet.y + size.height) continue;
        if (pz < pet.z - size.radius || pz > pet.z + size.radius) continue;
        return { pet, distance };
      }
    }
    return null;
  }

  function isPetRecording3D(id) {
    return !!((recordingSession && recordingSession.petId === id && !recordingSession.speakingPetId) || pendingRecordingPetId === id);
  }

  function isPetSpeaking3D(id) {
    return !!(recordingSession && recordingSession.speakingPetId === id);
  }

  function stopTracks(stream) {
    if (!stream || typeof stream.getTracks !== 'function') return;
    for (const track of stream.getTracks()) track.stop();
  }

  function playRecordedParrotAudio(session) {
    if (!session || session.canceled || !session.chunks.length) return;
    const BlobCtor = window.Blob;
    const AudioCtor = window.Audio;
    const URLApi = window.URL;
    if (!BlobCtor || !AudioCtor || !URLApi || !URLApi.createObjectURL) return;
    const blob = new BlobCtor(session.chunks, { type: session.mimeType || 'audio/webm' });
    const url = URLApi.createObjectURL(blob);
    const audio = new AudioCtor(url);
    session.audio = audio;
    session.speakingPetId = session.petId;
    recordingSession = session;
    const forget = () => {
      if (recordingSession === session) recordingSession = null;
      URLApi.revokeObjectURL(url);
      session.audio = null;
    };
    session.forget = forget;
    audio.addEventListener('ended', forget, { once: true });
    audio.addEventListener('error', forget, { once: true });
    const playResult = audio.play();
    if (playResult && typeof playResult.catch === 'function') playResult.catch(forget);
  }

  async function beginParrotRecording(state, pet) {
    if (!state || !pet || pet.type !== 'parrot' || isPetRecording3D(pet.id)) return false;
    const mediaDevices = window.navigator && window.navigator.mediaDevices;
    const Recorder = window.MediaRecorder;
    if (!mediaDevices || !mediaDevices.getUserMedia || !Recorder) {
      setNotice(state, 'Запись с микрофона недоступна в этом браузере', 2.4);
      return false;
    }
    pendingRecordingPetId = pet.id;
    setNotice(state, 'Разрешите доступ к микрофону', 2.4);
    try {
      const stream = await mediaDevices.getUserMedia({ audio: true });
      if (pendingRecordingPetId !== pet.id || !pet.active) {
        stopTracks(stream);
        return false;
      }
      const recorder = new Recorder(stream);
      const session = {
        petId: pet.id,
        state,
        stream,
        recorder,
        chunks: [],
        mimeType: recorder.mimeType,
        canceled: false,
        speakingPetId: '',
      };
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data && event.data.size > 0) session.chunks.push(event.data);
      });
      recorder.addEventListener('stop', () => {
        stopTracks(stream);
        if (!session.canceled) playRecordedParrotAudio(session);
        else if (recordingSession === session) recordingSession = null;
      }, { once: true });
      recorder.addEventListener('error', () => {
        session.canceled = true;
        stopTracks(stream);
        if (recordingSession === session) recordingSession = null;
        setNotice(state, 'Не удалось записать звук', 2.2);
      }, { once: true });
      pendingRecordingPetId = '';
      recordingSession = session;
      recorder.start();
      setNotice(state, 'Запись идет. Коротко нажмите ПКМ по попугаю, чтобы закончить', 3.2);
      return true;
    } catch (error) {
      pendingRecordingPetId = '';
      setNotice(state, 'Нет доступа к микрофону', 2.4);
      return false;
    }
  }

  function finishParrotRecording(state, petId) {
    if (pendingRecordingPetId === petId) {
      pendingRecordingPetId = '';
      setNotice(state, 'Запись отменена', 1.4);
      return true;
    }
    const session = recordingSession;
    if (!session || session.petId !== petId || session.speakingPetId) return false;
    if (session.recorder && session.recorder.state !== 'inactive') {
      session.recorder.stop();
      recordingSession = null;
      setNotice(state, 'Попугай повторяет запись', 1.8);
      return true;
    }
    return false;
  }

  function cancelPetRecording3D() {
    pendingRecordingPetId = '';
    const session = recordingSession;
    recordingSession = null;
    if (!session) return;
    session.canceled = true;
    if (session.audio) {
      session.audio.pause();
      session.audio.currentTime = 0;
      if (session.forget) session.forget();
    }
    if (session.recorder && session.recorder.state !== 'inactive') session.recorder.stop();
    else stopTracks(session.stream);
  }

  function petPositionClear(state, pet, x, z) {
    if (pet.type === 'parrot' || !Game.world3d || !Game.world3d.getBlock3D || !Game.world3d.isSolidBlock3D) return true;
    const y = Math.floor(pet.y + 0.05);
    const block = Game.world3d.getBlock3D(state, Math.floor(x), y, Math.floor(z));
    return !Game.world3d.isSolidBlock3D(block);
  }

  function settlePetOnGround(state, pet) {
    if (pet.type === 'parrot' || !Game.world3d || !Game.world3d.getBlock3D || !Game.world3d.isSolidBlock3D) return;
    const x = Math.floor(pet.x);
    const z = Math.floor(pet.z);
    const start = Math.min((state.world && state.world.h ? state.world.h - 2 : 126), Math.floor(pet.y) + 3);
    for (let y = start; y >= Math.max(0, Math.floor(pet.y) - 6); y -= 1) {
      const support = Game.world3d.getBlock3D(state, x, y, z);
      const above = Game.world3d.getBlock3D(state, x, y + 1, z);
      if (Game.world3d.isSolidBlock3D(support) && !Game.world3d.isSolidBlock3D(above)) {
        pet.y = y + 1;
        return;
      }
    }
  }

  function tryPetStepUp(state, pet, x, z) {
    if (pet.type === 'parrot' || !Game.world3d || !Game.world3d.getBlock3D || !Game.world3d.isSolidBlock3D) return false;
    const blockX = Math.floor(x);
    const blockZ = Math.floor(z);
    const baseY = Math.floor(pet.y + 0.05);
    const obstacle = Game.world3d.getBlock3D(state, blockX, baseY, blockZ);
    const landing = Game.world3d.getBlock3D(state, blockX, baseY + 1, blockZ);
    const headroom = Game.world3d.getBlock3D(state, blockX, baseY + 2, blockZ);
    if (!Game.world3d.isSolidBlock3D(obstacle)) return false;
    if (Game.world3d.isSolidBlock3D(landing) || Game.world3d.isSolidBlock3D(headroom)) return false;
    pet.y = baseY + 1;
    pet.jumpDuration = 0.42;
    pet.jumpTimer = pet.jumpDuration;
    return true;
  }

  function moveToward(state, pet, targetX, targetZ, speed, dt) {
    const dx = targetX - pet.x;
    const dz = targetZ - pet.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.001) {
      pet.moving = false;
      return false;
    }
    const step = Math.min(distance, Math.max(0, speed * dt));
    const nextX = pet.x + dx / distance * step;
    const nextZ = pet.z + dz / distance * step;
    if (!petPositionClear(state, pet, nextX, nextZ) && !tryPetStepUp(state, pet, nextX, nextZ)) {
      pet.moving = false;
      pet.wanderTimer = 0;
      return false;
    }
    pet.x = nextX;
    pet.z = nextZ;
    pet.yaw = Math.atan2(dz, dx);
    pet.moving = step > 0.0001;
    return pet.moving;
  }

  function updatePetMovement(state, pet, dt) {
    if (!pet.active) return;
    const player = state.player;
    pet.animationTime = finiteOr(pet.animationTime, 0) + dt;
    pet.jumpTimer = Math.max(0, finiteOr(pet.jumpTimer, 0) - dt);
    if (pet.mode === 'wait') {
      pet.moving = false;
      return;
    }
    if (pet.mode === 'follow') {
      const dx = player.x - pet.x;
      const dz = player.z - pet.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 12 || Math.abs(player.y - pet.y) > 4) {
        positionNearPlayer(state, pet, 0);
        pet.moving = false;
        pet.stuckTimer = 0;
        return;
      }
      if (distance > 2.2) {
        const moved = moveToward(state, pet, player.x, player.z, pet.type === 'capybara' ? 1.8 : 2.7, dt);
        pet.stuckTimer = moved ? 0 : finiteOr(pet.stuckTimer, 0) + dt;
        if (pet.stuckTimer >= 1.25) {
          positionNearPlayer(state, pet, 0);
          pet.moving = false;
          pet.stuckTimer = 0;
        }
      } else {
        pet.moving = false;
        pet.stuckTimer = 0;
      }
      if (pet.type === 'parrot') pet.y = player.y + 1.35 + Math.sin(pet.animationTime * 3) * 0.12;
      else settlePetOnGround(state, pet);
      return;
    }
    pet.wanderTimer -= dt;
    if (pet.wanderTimer <= 0 || !Number.isFinite(pet.wanderTargetX) || !Number.isFinite(pet.wanderTargetZ)) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 1.5 + Math.random() * 4;
      pet.wanderTargetX = pet.anchorX + Math.cos(angle) * radius;
      pet.wanderTargetZ = pet.anchorZ + Math.sin(angle) * radius;
      pet.wanderTimer = 2 + Math.random() * 3;
    }
    moveToward(state, pet, pet.wanderTargetX, pet.wanderTargetZ, pet.type === 'capybara' ? 0.7 : 1.1, dt);
    if (pet.type === 'parrot') pet.y = player.y + 1.1 + Math.sin(pet.animationTime * 2.7) * 0.14;
    else settlePetOnGround(state, pet);
  }

  function updatePetInteraction(state, input, actions, dt) {
    const hit = raycastPet3D(state);
    state.ui.petTargetName = hit && hit.pet ? hit.pet.name : '';

    if (hit && actions.breakPressed) {
      const name = hit.pet.name;
      hidePet3D(state, hit.pet.id);
      actions.breakPressed = false;
      input.primaryDown = false;
      setNotice(state, `${name} теперь в Переноске`);
      renderPetsUI();
      return;
    }

    if (hit && actions.placePressed) {
      state.ui.petRightHold = { petId: hit.pet.id, elapsed: 0, startedRecording: false };
      actions.placePressed = false;
    }

    const hold = state.ui.petRightHold;
    if (!hold) return;
    const pet = findPet(state, hold.petId);
    if (!pet || !pet.active) {
      state.ui.petRightHold = null;
      return;
    }
    if (input.secondaryDown) {
      hold.elapsed += dt;
      if (hold.elapsed >= 1 && pet.type === 'parrot' && !hold.startedRecording && !isPetRecording3D(pet.id)) {
        hold.startedRecording = true;
        beginParrotRecording(state, pet);
      }
    }
    if (!actions.secondaryReleased) return;
    actions.secondaryReleased = false;
    state.ui.petRightHold = null;
    if (hold.startedRecording) return;
    if (pet.type === 'parrot' && isPetRecording3D(pet.id)) {
      finishParrotRecording(state, pet.id);
      return;
    }
    openPetModeChooser(pet.id);
  }

  function updatePets3D(state, input, actions, dt) {
    const pets = ensurePets3D(state);
    const safeDt = Math.max(0, Math.min(0.05, dt));
    for (const pet of pets) updatePetMovement(state, pet, safeDt);
    updatePetInteraction(state, input || {}, actions || {}, safeDt);
  }

  Game.pets3d = {
    MAX_ACTIVE_PETS,
    PET_TYPES,
    PET_MODES,
    ensurePets3D,
    activePetCount3D,
    createPet3D,
    hidePet3D,
    resumePet3D,
    setPetMode3D,
    getPetsViewModel3D,
    updatePets3D,
    raycastPet3D,
    initPetsUI,
    setPetsUIVisible,
    cancelPetRecording3D,
    isPetRecording3D,
    isPetSpeaking3D,
  };
})();
