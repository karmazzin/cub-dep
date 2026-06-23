(() => {
  const Game = window.CubDep;
  const { BLOCK, BREAK_TIME } = Game.blocks;
  const { EYE_HEIGHT, PLAYER_HEIGHT, PLAYER_RADIUS, REACH_DISTANCE } = Game.constants3d;
  const { getBlock3D, setBlock3D, inBounds3D, isSolidBlock3D } = Game.world3d;

  const HOTBAR_BLOCKS = [BLOCK.DIRT, BLOCK.GRASS, BLOCK.STONE, BLOCK.WOOD, BLOCK.PLANK, BLOCK.WATER];
  const BLOCK_LABELS = {
    [BLOCK.GRASS]: 'Трава',
    [BLOCK.DIRT]: 'Земля',
    [BLOCK.STONE]: 'Камень',
    [BLOCK.WOOD]: 'Дерево',
    [BLOCK.PLANK]: 'Доски',
    [BLOCK.WATER]: 'Вода',
  };

  function getLookDirection(player) {
    const cosPitch = Math.cos(player.pitch);
    return {
      x: Math.sin(player.yaw) * cosPitch,
      y: Math.sin(player.pitch),
      z: Math.cos(player.yaw) * cosPitch,
    };
  }

  function raycastBlock(state) {
    const player = state.player;
    const dir = getLookDirection(player);
    const origin = {
      x: player.x,
      y: player.y + EYE_HEIGHT,
      z: player.z,
    };
    let previous = null;
    const step = 0.045;
    for (let distance = 0; distance <= REACH_DISTANCE; distance += step) {
      const x = Math.floor(origin.x + dir.x * distance);
      const y = Math.floor(origin.y + dir.y * distance);
      const z = Math.floor(origin.z + dir.z * distance);
      const current = { x, y, z };
      if (!inBounds3D(state.world, x, y, z)) {
        previous = current;
        continue;
      }
      const id = getBlock3D(state, x, y, z);
      if (isSolidBlock3D(id)) {
        const normal = previous ? {
          x: Math.max(-1, Math.min(1, previous.x - x)),
          y: Math.max(-1, Math.min(1, previous.y - y)),
          z: Math.max(-1, Math.min(1, previous.z - z)),
        } : { x: 0, y: 1, z: 0 };
        return { x, y, z, id, place: previous, normal };
      }
      previous = current;
    }
    return null;
  }

  function blockOverlapsPlayer(state, x, y, z) {
    const player = state.player;
    const minX = player.x - PLAYER_RADIUS;
    const maxX = player.x + PLAYER_RADIUS;
    const minY = player.y;
    const maxY = player.y + PLAYER_HEIGHT;
    const minZ = player.z - PLAYER_RADIUS;
    const maxZ = player.z + PLAYER_RADIUS;
    return x < maxX && x + 1 > minX && y < maxY && y + 1 > minY && z < maxZ && z + 1 > minZ;
  }

  function setNotice(state, text) {
    state.ui.noticeText = text;
    state.ui.noticeTimer = 1.35;
  }

  function targetKey(hit) {
    return hit ? `${hit.x},${hit.y},${hit.z}` : '';
  }

  function getBreakDuration(blockId) {
    const base = BREAK_TIME && BREAK_TIME[blockId];
    if (!Number.isFinite(base)) return Infinity;
    if (base > 0) return Math.max(0.18, base * 0.32);
    return 0.35;
  }

  function resetMining(state) {
    state.ui.mineTarget = null;
    state.ui.mineProgress = 0;
    state.ui.mineBlock = BLOCK.AIR;
    state.ui.minePulse = 0;
    state.ui.mineSoundTimer = 0;
  }

  function updateSelectedBlock(state, input) {
    for (let i = 0; i < HOTBAR_BLOCKS.length; i += 1) {
      if (input.keys[`Digit${i + 1}`]) state.player.selectedBlock = HOTBAR_BLOCKS[i];
    }
  }

  function finishBreakingBlock(state, hit) {
    if (!hit) return;
    if (hit.id === BLOCK.BEDROCK) {
      setNotice(state, 'Бедрок нельзя добыть');
      return;
    }
    if (setBlock3D(state, hit.x, hit.y, hit.z, BLOCK.AIR)) {
      if (state.world.blockDamage) delete state.world.blockDamage[targetKey(hit)];
      state.player.selectedBlock = hit.id;
      setNotice(state, `Добыто: ${BLOCK_LABELS[hit.id] || 'Блок'}`);
      if (Game.audio && Game.audio.playDig) Game.audio.playDig();
    }
  }

  function updateMining(state, input, hit, dt) {
    if (!input.primaryDown) {
      state.ui.mineTarget = null;
      state.ui.mineSoundTimer = 0;
      return;
    }
    if (!hit) {
      resetMining(state);
      return;
    }
    if (hit.id === BLOCK.BEDROCK) {
      resetMining(state);
      setNotice(state, 'Бедрок нельзя добыть');
      return;
    }

    const key = targetKey(hit);
    if (!state.ui.mineTarget || state.ui.mineTarget.key !== key) {
      state.ui.mineTarget = { key, x: hit.x, y: hit.y, z: hit.z };
      state.ui.mineProgress = (state.world.blockDamage && state.world.blockDamage[key]) || 0;
      state.ui.mineBlock = hit.id;
      state.ui.minePulse = 0;
      state.ui.mineSoundTimer = 0;
    }

    const duration = getBreakDuration(hit.id);
    if (!Number.isFinite(duration)) return;
    state.ui.mineProgress = Math.min(1, state.ui.mineProgress + dt / duration);
    if (!state.world.blockDamage) state.world.blockDamage = {};
    state.world.blockDamage[key] = state.ui.mineProgress;
    state.ui.minePulse += dt * (8 + state.ui.mineProgress * 10);
    state.ui.mineSoundTimer -= dt;
    if (state.ui.mineSoundTimer <= 0) {
      state.ui.mineSoundTimer = Math.max(0.08, 0.18 - state.ui.mineProgress * 0.08);
      if (Game.audio && Game.audio.playDig) Game.audio.playDig();
    }
    if (state.ui.mineProgress >= 1) {
      finishBreakingBlock(state, hit);
      resetMining(state);
    }
  }

  function placeSelectedBlock(state) {
    const hit = raycastBlock(state);
    if (!hit || !hit.place) return;
    const blockId = state.player.selectedBlock || BLOCK.DIRT;
    const { x, y, z } = hit.place;
    if (!inBounds3D(state.world, x, y, z)) return;
    const targetId = getBlock3D(state, x, y, z);
    if (targetId !== BLOCK.AIR && targetId !== BLOCK.WATER) return;
    if (blockOverlapsPlayer(state, x, y, z)) {
      setNotice(state, 'Нельзя поставить блок внутри себя');
      return;
    }
    if (setBlock3D(state, x, y, z, blockId)) {
      setNotice(state, `Поставлено: ${BLOCK_LABELS[blockId] || 'Блок'}`);
    }
  }

  function repairTargetBlock(state, hit) {
    if (!hit || !state.world.blockDamage) return;
    const key = targetKey(hit);
    if (!state.world.blockDamage[key]) return;
    delete state.world.blockDamage[key];
    if (state.ui.mineTarget && state.ui.mineTarget.key === key) resetMining(state);
    else state.ui.mineProgress = 0;
    setNotice(state, 'Блок починен');
  }

  function updateInteraction3D(state, input, actions, dt) {
    updateSelectedBlock(state, input);
    const hit = raycastBlock(state);
    state.ui.targetBlock = hit ? { x: hit.x, y: hit.y, z: hit.z, id: hit.id, normal: hit.normal } : null;
    if (hit && (!state.ui.mineTarget || state.ui.mineTarget.key !== targetKey(hit))) {
      state.ui.mineProgress = (state.world.blockDamage && state.world.blockDamage[targetKey(hit)]) || 0;
    } else if (!hit && !input.primaryDown) {
      state.ui.mineProgress = 0;
    }
    if (state.ui.noticeTimer > 0) {
      state.ui.noticeTimer = Math.max(0, state.ui.noticeTimer - dt);
      if (state.ui.noticeTimer === 0) state.ui.noticeText = '';
    }
    updateMining(state, input, hit, dt);
    if (actions.repairPressed) repairTargetBlock(state, hit);
    if (actions.placePressed) placeSelectedBlock(state);
  }

  Game.interaction3d = { updateInteraction3D, HOTBAR_BLOCKS, BLOCK_LABELS };
})();
