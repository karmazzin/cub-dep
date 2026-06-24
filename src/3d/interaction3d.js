(() => {
  const Game = window.CubDep;
  const { BLOCK, BREAK_TIME } = Game.blocks;
  const { EYE_HEIGHT, PLAYER_HEIGHT, PLAYER_RADIUS, REACH_DISTANCE } = Game.constants3d;
  const { getBlock3D, setBlock3D, inBounds3D, isSolidBlock3D } = Game.world3d;

  const ITEM = {
    SHEEP_SPAWN_EGG: -1,
    BOAR_SPAWN_EGG: -2,
    TURTLE_SPAWN_EGG: -3,
    SNAKE_SPAWN_EGG: -4,
    GOAT_SPAWN_EGG: -5,
    FISH_SPAWN_EGG: -6,
  };

  const SPAWN_EGG_TYPES = {
    [ITEM.SHEEP_SPAWN_EGG]: 'sheep',
    [ITEM.BOAR_SPAWN_EGG]: 'boar',
    [ITEM.TURTLE_SPAWN_EGG]: 'turtle',
    [ITEM.SNAKE_SPAWN_EGG]: 'snake',
    [ITEM.GOAT_SPAWN_EGG]: 'goat',
    [ITEM.FISH_SPAWN_EGG]: 'fish',
  };

  const DEFAULT_HOTBAR_ITEMS = [
    BLOCK.DIRT,
    BLOCK.STONE,
    BLOCK.WOOD,
    BLOCK.PLANK,
    BLOCK.WATER,
    BLOCK.SAND,
    ITEM.SHEEP_SPAWN_EGG,
    BLOCK.LEAF,
    BLOCK.LAVA,
  ];

  const CREATIVE_ITEMS = [
    ...DEFAULT_HOTBAR_ITEMS,
    ITEM.BOAR_SPAWN_EGG,
    ITEM.TURTLE_SPAWN_EGG,
    ITEM.SNAKE_SPAWN_EGG,
    ITEM.GOAT_SPAWN_EGG,
    ITEM.FISH_SPAWN_EGG,
  ];
  const HOTBAR_BLOCKS = DEFAULT_HOTBAR_ITEMS;

  const BLOCK_LABELS = {
    [BLOCK.DIRT]: 'Земля',
    [BLOCK.STONE]: 'Камень',
    [BLOCK.WOOD]: 'Дерево',
    [BLOCK.LEAF]: 'Листья',
    [BLOCK.PLANK]: 'Доски',
    [BLOCK.WATER]: 'Вода',
    [BLOCK.HOT_WATER]: 'Горячая вода',
    [BLOCK.LAVA]: 'Лава',
    [BLOCK.SAND]: 'Песок',
    [ITEM.SHEEP_SPAWN_EGG]: 'Яйцо призыва овцы',
    [ITEM.BOAR_SPAWN_EGG]: 'Яйцо призыва кабана',
    [ITEM.TURTLE_SPAWN_EGG]: 'Яйцо призыва черепахи',
    [ITEM.SNAKE_SPAWN_EGG]: 'Яйцо призыва змеи',
    [ITEM.GOAT_SPAWN_EGG]: 'Яйцо призыва горного козла',
    [ITEM.FISH_SPAWN_EGG]: 'Яйцо призыва рыбы',
    [BLOCK.TORCH]: 'Факел',
    [BLOCK.FURNACE]: 'Печь',
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
        return { x, y, z, id, place: previous, normal, distance };
      }
      previous = current;
    }
    return null;
  }

  function raycastSheep(state) {
    const sheep = state.entities && Array.isArray(state.entities.sheep) ? state.entities.sheep : [];
    if (!sheep.length) return null;
    const player = state.player;
    const dir = getLookDirection(player);
    const origin = {
      x: player.x,
      y: player.y + EYE_HEIGHT,
      z: player.z,
    };
    let best = null;
    const step = 0.045;
    for (let distance = 0; distance <= REACH_DISTANCE; distance += step) {
      const px = origin.x + dir.x * distance;
      const py = origin.y + dir.y * distance;
      const pz = origin.z + dir.z * distance;
      for (const item of sheep) {
        const config = Game.entities3d && Game.entities3d.mobConfig ? Game.entities3d.mobConfig(item) : { radius: 0.42, height: 1.08 };
        const radius = Math.max(0.22, (config.radius || 0.34) + 0.08);
        const height = Math.max(0.25, config.height || 1.08);
        const minX = item.x - radius;
        const maxX = item.x + radius;
        const minY = item.y;
        const maxY = item.y + height + 0.12;
        const minZ = item.z - radius;
        const maxZ = item.z + radius;
        if (px < minX || px > maxX || py < minY || py > maxY || pz < minZ || pz > maxZ) continue;
        if (!best || distance < best.distance) best = { sheep: item, distance };
      }
      if (best) return best;
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

  function selectHotbarSlot(state, index) {
    const size = Game.inventory3d && Game.inventory3d.HOTBAR_SIZE ? Game.inventory3d.HOTBAR_SIZE : HOTBAR_BLOCKS.length;
    if (index < 0 || index >= size) return;
    state.player.selectedHotbarIndex = index;
    if (Game.inventory3d && Game.inventory3d.updateSelectedBlockFromHotbar) {
      Game.inventory3d.updateSelectedBlockFromHotbar(state);
    } else {
      state.player.selectedBlock = BLOCK.AIR;
    }
  }

  function updateSelectedBlock(state, input) {
    const size = Game.inventory3d && Game.inventory3d.HOTBAR_SIZE ? Game.inventory3d.HOTBAR_SIZE : HOTBAR_BLOCKS.length;
    for (let i = 0; i < size; i += 1) {
      const key = i === 9 ? 'Digit0' : `Digit${i + 1}`;
      if (input.keys[key]) selectHotbarSlot(state, i);
    }
  }

  function finishBreakingBlock(state, hit) {
    if (!hit) return;
    if (hit.id === BLOCK.BEDROCK) {
      setNotice(state, 'Бедрок нельзя добыть');
      return;
    }
    const dropId = hit.id;
    if (Game.inventory3d && Game.inventory3d.addMinedItem) {
      const result = Game.inventory3d.addMinedItem(state, dropId, 1);
      if (result.remaining > 0) {
        if (state.world.blockDamage) delete state.world.blockDamage[targetKey(hit)];
        setNotice(state, 'Инвентарь полон');
        return;
      }
    }
    if (setBlock3D(state, hit.x, hit.y, hit.z, BLOCK.AIR)) {
      if (state.world.blockDamage) delete state.world.blockDamage[targetKey(hit)];
      setNotice(state, `Добыто: ${BLOCK_LABELS[dropId] || 'Блок'}`);
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

  function attackTargetSheep(state, blockHit) {
    const hit = raycastSheep(state);
    if (!hit || !hit.sheep || !Game.entities3d || !Game.entities3d.damageSheep3D) return false;
    if (blockHit && Number.isFinite(blockHit.distance) && hit.distance > blockHit.distance) return false;
    const result = Game.entities3d.damageSheep3D(state, hit.sheep.id, 1, state.player.x, state.player.z);
    if (!result.hit) return false;
    resetMining(state);
    const label = MOB_LABELS[hit.sheep.type] || 'Моб';
    setNotice(state, result.dead ? `${label} погиб` : `${label} ранен`);
    if (Game.audio && Game.audio.playDig) Game.audio.playDig();
    return true;
  }

  function placeSelectedBlock(state) {
    const hit = raycastBlock(state);
    if (!hit || !hit.place) return;
    const stack = Game.inventory3d && Game.inventory3d.getSelectedHotbarStack
      ? Game.inventory3d.getSelectedHotbarStack(state)
      : null;
    const blockId = stack ? stack.id : BLOCK.AIR;
    if (!Number.isFinite(blockId) || blockId === BLOCK.AIR) return;
    const { x, y, z } = hit.place;
    if (!inBounds3D(state.world, x, y, z)) return;
    const survival = !state.worldMeta || state.worldMeta.mode !== 'creative';
    const mobType = SPAWN_EGG_TYPES[blockId];
    if (mobType) {
      if (Game.entities3d && Game.entities3d.spawnMob3D && Game.entities3d.spawnMob3D(state, mobType, x, y, z)) {
        if (survival && Game.inventory3d) Game.inventory3d.consumeSelectedHotbarItem(state, 1);
        setNotice(state, `Призван моб: ${MOB_LABELS[mobType] || 'Моб'}`);
      }
      return;
    }
    const targetId = getBlock3D(state, x, y, z);
    if (targetId !== BLOCK.AIR && targetId !== BLOCK.WATER && targetId !== BLOCK.HOT_WATER && targetId !== BLOCK.LAVA) return;
    if (blockOverlapsPlayer(state, x, y, z)) {
      setNotice(state, 'Нельзя поставить блок внутри себя');
      return;
    }
    if (setBlock3D(state, x, y, z, blockId)) {
      if (survival && Game.inventory3d) Game.inventory3d.consumeSelectedHotbarItem(state, 1);
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
    const attackedSheep = actions.breakPressed && attackTargetSheep(state, hit);
    if (attackedSheep) input.primaryDown = false;
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
    if (!attackedSheep) updateMining(state, input, hit, dt);
    if (actions.repairPressed) repairTargetBlock(state, hit);
    if (actions.placePressed) placeSelectedBlock(state);
  }

  const MOB_LABELS = {
    sheep: 'Овца',
    boar: 'Кабан',
    turtle: 'Черепаха',
    snake: 'Змея',
    goat: 'Горный козел',
    fish: 'Рыба',
  };

  Game.interaction3d = {
    updateInteraction3D,
    HOTBAR_BLOCKS,
    DEFAULT_HOTBAR_ITEMS,
    CREATIVE_ITEMS,
    BLOCK_LABELS,
    ITEM,
    SPAWN_EGG_TYPES,
    MOB_LABELS,
  };
})();
