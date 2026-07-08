(() => {
  const Game = window.CubDep;

  const INVENTORY_SIZE = 36;
  const CHEST_SIZE = 36;
  const HOTBAR_SIZE = 10;
  const MAX_STACK = 100;
  let carried = null;
  let carriedOrigin = null;
  let carriedReturnOrigin = null;
  let pointer = { x: 0, y: 0 };
  let activeTab = 'inventory';

  function cloneData(data) {
    if (!data || typeof data !== 'object') return null;
    try {
      return JSON.parse(JSON.stringify(data));
    } catch (error) {
      return null;
    }
  }

  function cloneStack(stack) {
    return stack ? { id: stack.id, count: stack.count, data: cloneData(stack.data) || undefined } : null;
  }

  function normalizeStack(stack) {
    if (!stack || !Number.isFinite(stack.id) || !Number.isFinite(stack.count) || stack.count <= 0) return null;
    const normalized = { id: stack.id, count: Math.max(1, Math.min(MAX_STACK, stack.count | 0)) };
    const data = cloneData(stack.data);
    if (data) normalized.data = data;
    return normalized;
  }

  function normalizeSlots(slots, size) {
    if (!Array.isArray(slots)) slots = [];
    while (slots.length < size) slots.push(null);
    if (slots.length > size) slots.length = size;
    for (let i = 0; i < slots.length; i += 1) slots[i] = normalizeStack(slots[i]);
    return slots;
  }

  function canMergeStacks(a, b) {
    return !!(a && b && a.id === b.id && !a.data && !b.data);
  }

  function isEducationCreativeEditor(state) {
    return !!(state && state.worldMeta && state.worldMeta.customLessonEditor);
  }

  function educationCreativeItems() {
    const block = Game.blocks && Game.blocks.BLOCK;
    if (!block) return [];
    return [
      block.DIRT,
      block.STONE,
      block.WOOD,
      block.PLANK,
      block.SAND,
      block.LEAF,
      block.WATER,
      block.GRASS,
      block.BORDER,
    ].filter((id) => Number.isFinite(id));
  }

  function defaultHotbarItems(state = null) {
    if (state && state.worldMeta && state.worldMeta.mode === 'education' && Game.education3d && Game.education3d.getHotbarItems) {
      const educationItems = Game.education3d.getHotbarItems(state.worldMeta.education);
      if (Array.isArray(educationItems) && educationItems.length) return educationItems.slice(0, HOTBAR_SIZE);
    }
    if (isEducationCreativeEditor(state)) return educationCreativeItems().slice(0, HOTBAR_SIZE);
    const hotbar = Game.interaction3d && (Game.interaction3d.DEFAULT_HOTBAR_ITEMS || Game.interaction3d.HOTBAR_BLOCKS);
    return Array.isArray(hotbar) ? hotbar.filter((id) => Number.isFinite(id)).slice(0, HOTBAR_SIZE) : [];
  }

  function ensureInventory(state) {
    const player = state && state.player;
    if (!player) return [];
    player.inventory = normalizeSlots(player.inventory, INVENTORY_SIZE);
    return player.inventory;
  }

  function ensureHotbar(state) {
    const player = state && state.player;
    if (!player) return [];
    const hadHotbar = Array.isArray(player.hotbar) && player.hotbar.length > 0;
    player.hotbar = normalizeSlots(player.hotbar, HOTBAR_SIZE);
    if (isEducationCreativeEditor(state)) {
      const items = educationCreativeItems();
      let changed = false;
      for (let i = 0; i < HOTBAR_SIZE; i += 1) {
        const id = items[i];
        const next = Number.isFinite(id) ? { id, count: MAX_STACK } : null;
        const current = player.hotbar[i];
        if ((!current && next) || (current && !next) || (current && next && (current.id !== next.id || current.count !== next.count))) {
          player.hotbar[i] = next;
          changed = true;
        }
      }
      if (changed) updateSelectedBlockFromHotbar(state);
      return player.hotbar;
    }
    if (!hadHotbar && state.worldMeta && (state.worldMeta.mode === 'creative' || state.worldMeta.mode === 'education')) {
      const items = defaultHotbarItems(state);
      for (let i = 0; i < HOTBAR_SIZE; i += 1) {
        player.hotbar[i] = Number.isFinite(items[i]) ? { id: items[i], count: MAX_STACK } : null;
      }
    }
    updateSelectedBlockFromHotbar(state);
    return player.hotbar;
  }

  function updateSelectedBlockFromHotbar(state) {
    if (!state || !state.player) return;
    const hotbar = state.player.hotbar || [];
    const index = Number.isInteger(state.player.selectedHotbarIndex) ? state.player.selectedHotbarIndex : 0;
    const stack = hotbar[index];
    state.player.selectedBlock = stack ? stack.id : Game.blocks.BLOCK.AIR;
  }

  function getSelectedHotbarStack(state) {
    const hotbar = ensureHotbar(state);
    const index = Number.isInteger(state.player.selectedHotbarIndex) ? state.player.selectedHotbarIndex : 0;
    return hotbar[index] || null;
  }

  function getLabel(id) {
    const labels = Game.interaction3d && Game.interaction3d.BLOCK_LABELS;
    return (labels && labels[id]) || 'Предмет';
  }

  function itemCountsFromSlots(slots) {
    const counts = new Map();
    const labels = Game.interaction3d && Game.interaction3d.BLOCK_LABELS;
    for (const slot of normalizeSlots(cloneData(slots) || [], CHEST_SIZE)) {
      if (!slot) continue;
      const label = (labels && labels[slot.id]) || `ID ${slot.id}`;
      counts.set(label, (counts.get(label) || 0) + slot.count);
    }
    return Array.from(counts.entries()).map(([label, count]) => `${label} x${count}`);
  }

  function getStackLabel(stack) {
    if (!stack) return 'Пусто';
    const item = Game.interaction3d && Game.interaction3d.ITEM;
    if (item && stack.id === item.FILLED_CHEST) {
      const items = itemCountsFromSlots(stack.data && stack.data.slots);
      return items.length ? `Сундук с вещами: ${items.slice(0, 4).join(', ')}${items.length > 4 ? '...' : ''}` : 'Сундук с вещами: пусто';
    }
    return getLabel(stack.id);
  }

  function addInventoryItem(state, id, count = 1) {
    const inventory = ensureInventory(state);
    return addToSlots(inventory, id, count);
  }

  function addMinedItem(state, id, count = 1, data = null) {
    const hotbar = ensureHotbar(state);
    const inventory = ensureInventory(state);
    let remaining = Math.max(0, count | 0);
    if (!Number.isFinite(id) || remaining <= 0) return { added: 0, remaining };
    let added = 0;
    const hasData = !!data;

    if (hasData) {
      for (let i = 0; i < hotbar.length; i += 1) {
        if (hotbar[i]) continue;
        hotbar[i] = { id, count: 1, data: cloneData(data) || {} };
        updateSelectedBlockFromHotbar(state);
        return { added: 1, remaining: remaining - 1 };
      }
      for (let i = 0; i < inventory.length; i += 1) {
        if (inventory[i]) continue;
        inventory[i] = { id, count: 1, data: cloneData(data) || {} };
        updateSelectedBlockFromHotbar(state);
        return { added: 1, remaining: remaining - 1 };
      }
      return { added: 0, remaining };
    }

    for (const slot of hotbar) {
      if (!slot || slot.id !== id || slot.count >= MAX_STACK) continue;
      const move = Math.min(MAX_STACK - slot.count, remaining);
      slot.count += move;
      remaining -= move;
      added += move;
      if (remaining <= 0) {
        updateSelectedBlockFromHotbar(state);
        return { added, remaining: 0 };
      }
    }

    for (let i = 0; i < hotbar.length; i += 1) {
      if (hotbar[i]) continue;
      const move = Math.min(MAX_STACK, remaining);
      hotbar[i] = { id, count: move };
      remaining -= move;
      added += move;
      if (remaining <= 0) {
        updateSelectedBlockFromHotbar(state);
        return { added, remaining: 0 };
      }
    }

    const result = addToSlots(inventory, id, remaining);
    updateSelectedBlockFromHotbar(state);
    return { added: added + result.added, remaining: result.remaining };
  }

  function addToSlots(slots, id, count) {
    let remaining = Math.max(0, count | 0);
    if (!Number.isFinite(id) || remaining <= 0) return { added: 0, remaining };
    let added = 0;
    for (const slot of slots) {
      if (!slot || slot.id !== id || slot.count >= MAX_STACK) continue;
      const move = Math.min(MAX_STACK - slot.count, remaining);
      slot.count += move;
      remaining -= move;
      added += move;
      if (remaining <= 0) return { added, remaining: 0 };
    }
    for (let i = 0; i < slots.length; i += 1) {
      if (slots[i]) continue;
      const move = Math.min(MAX_STACK, remaining);
      slots[i] = { id, count: move };
      remaining -= move;
      added += move;
      if (remaining <= 0) return { added, remaining: 0 };
    }
    return { added, remaining };
  }

  function filledChestDataFromWorld(state, x, y, z) {
    const key = `${x},${y},${z}`;
    const stored = state && state.world && state.world.chests ? state.world.chests[key] : null;
    let slots = chestSlotsFromStored(stored);
    if (stored && !Array.isArray(stored) && stored.lootTable) slots = generateLootSlots(state, key, resolveChestLootTableId(state, { x, y, z }, stored.lootTable));
    return { slots: normalizeSlots(cloneData(slots) || [], CHEST_SIZE) };
  }

  function restoreFilledChest(state, x, y, z, data) {
    if (!state || !state.world || !data) return false;
    if (!state.world.chests) state.world.chests = {};
    state.world.chests[`${x},${y},${z}`] = { slots: normalizeSlots(cloneData(data.slots) || [], CHEST_SIZE), lootGenerated: true };
    return true;
  }

  function countInventoryItem(state, id) {
    return ensureInventory(state).reduce((sum, slot) => slot && slot.id === id ? sum + slot.count : sum, 0);
  }

  function hasInventoryItem(state, id, count = 1) {
    return countInventoryItem(state, id) >= count;
  }

  function removeInventoryItem(state, id, count = 1) {
    const inventory = ensureInventory(state);
    let remaining = Math.max(0, count | 0);
    if (!hasInventoryItem(state, id, remaining)) return false;
    for (let i = 0; i < inventory.length; i += 1) {
      const slot = inventory[i];
      if (!slot || slot.id !== id) continue;
      const move = Math.min(slot.count, remaining);
      slot.count -= move;
      remaining -= move;
      if (slot.count <= 0) inventory[i] = null;
      if (remaining <= 0) return true;
    }
    return true;
  }

  function consumeSelectedHotbarItem(state, count = 1) {
    const hotbar = ensureHotbar(state);
    const index = Number.isInteger(state.player.selectedHotbarIndex) ? state.player.selectedHotbarIndex : 0;
    const slot = hotbar[index];
    if (!slot || slot.count < count) return false;
    slot.count -= count;
    if (slot.count <= 0) hotbar[index] = null;
    updateSelectedBlockFromHotbar(state);
    return true;
  }

  function getSlotsByOrigin(state, origin) {
    if (!origin) return null;
    if (origin.type === 'inventory') return ensureInventory(state);
    if (origin.type === 'hotbar') return ensureHotbar(state);
    if (origin.type === 'chest') return ensureOpenChestSlots(state);
    return null;
  }

  function parseChestKey(key) {
    const parts = String(key || '').split(',').map(Number);
    if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;
    return { x: parts[0], y: parts[1], z: parts[2] };
  }

  function hashText(text) {
    let h = 2166136261;
    const value = String(text || '');
    for (let i = 0; i < value.length; i += 1) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function rngForChest(state, key, tableId) {
    let seed = hashText(`${state && state.worldMeta ? state.worldMeta.seed || '' : ''}:${key}:${tableId}`);
    return () => {
      seed = (seed + 0x6D2B79F5) >>> 0;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rollCount(rng, min, max) {
    const lo = Math.max(1, min | 0);
    const hi = Math.max(lo, max | 0);
    return lo + Math.floor(rng() * (hi - lo + 1));
  }

  const LOOT_TABLES = {
    spawn_tent_plains: [
      { id: () => Game.blocks.BLOCK.PLANK, chance: 0.85, min: 8, max: 18 },
      { id: () => Game.blocks.BLOCK.WOOD, chance: 0.75, min: 4, max: 9 },
      { id: () => Game.blocks.BLOCK.DIRT, chance: 0.55, min: 6, max: 12 },
      { id: () => Game.blocks.BLOCK.WOOL, chance: 0.4, min: 2, max: 5 },
    ],
    spawn_tent_forest: [
      { id: () => Game.blocks.BLOCK.WOOD, chance: 0.9, min: 6, max: 14 },
      { id: () => Game.blocks.BLOCK.PLANK, chance: 0.75, min: 8, max: 16 },
      { id: () => Game.blocks.BLOCK.LEAF, chance: 0.55, min: 4, max: 10 },
      { id: () => Game.blocks.BLOCK.MOSS, chance: 0.35, min: 2, max: 6 },
    ],
    spawn_tent_desert: [
      { id: () => Game.blocks.BLOCK.SAND, chance: 0.9, min: 10, max: 24 },
      { id: () => Game.blocks.BLOCK.CACTUS, chance: 0.55, min: 1, max: 3 },
      { id: () => Game.blocks.BLOCK.DRY_BUSH, chance: 0.45, min: 1, max: 4 },
      { id: () => Game.blocks.BLOCK.STONE, chance: 0.35, min: 4, max: 9 },
    ],
    spawn_tent_mountains: [
      { id: () => Game.blocks.BLOCK.STONE, chance: 0.9, min: 10, max: 22 },
      { id: () => Game.blocks.BLOCK.SNOW, chance: 0.5, min: 3, max: 8 },
      { id: () => Game.blocks.BLOCK.WOOD, chance: 0.45, min: 3, max: 7 },
      { id: () => Game.blocks.BLOCK.PLANK, chance: 0.55, min: 5, max: 12 },
    ],
    spawn_tent_cliffs: [
      { id: () => Game.blocks.BLOCK.STONE, chance: 0.95, min: 12, max: 26 },
      { id: () => Game.blocks.BLOCK.BLACKSTONE, chance: 0.25, min: 2, max: 6 },
      { id: () => Game.blocks.BLOCK.PLANK, chance: 0.45, min: 4, max: 10 },
      { id: () => Game.blocks.BLOCK.SNOW, chance: 0.35, min: 2, max: 6 },
    ],
    spawn_tent_volcanic: [
      { id: () => Game.blocks.BLOCK.BLACKSTONE, chance: 0.95, min: 10, max: 24 },
      { id: () => Game.blocks.BLOCK.STONE, chance: 0.65, min: 6, max: 14 },
      { id: () => Game.blocks.BLOCK.LAVA, chance: 0.2, min: 1, max: 1 },
      { id: () => Game.blocks.BLOCK.PLANK, chance: 0.4, min: 4, max: 9 },
    ],
    spawn_tent_snow_plains: [
      { id: () => Game.blocks.BLOCK.SNOW, chance: 0.9, min: 8, max: 18 },
      { id: () => Game.blocks.BLOCK.SPRUCE_WOOD, chance: 0.75, min: 4, max: 10 },
      { id: () => Game.blocks.BLOCK.SPRUCE_LEAF, chance: 0.45, min: 3, max: 8 },
      { id: () => Game.blocks.BLOCK.PLANK, chance: 0.55, min: 5, max: 12 },
    ],
    spawn_tent_spruce_forest: [
      { id: () => Game.blocks.BLOCK.SPRUCE_WOOD, chance: 0.9, min: 6, max: 14 },
      { id: () => Game.blocks.BLOCK.SPRUCE_LEAF, chance: 0.6, min: 4, max: 10 },
      { id: () => Game.blocks.BLOCK.PLANK, chance: 0.7, min: 8, max: 16 },
      { id: () => Game.blocks.BLOCK.MOSS, chance: 0.3, min: 2, max: 6 },
    ],
    spawn_tent_mountain_forest: [
      { id: () => Game.blocks.BLOCK.STONE, chance: 0.8, min: 8, max: 18 },
      { id: () => Game.blocks.BLOCK.WOOD, chance: 0.8, min: 5, max: 12 },
      { id: () => Game.blocks.BLOCK.LEAF, chance: 0.55, min: 4, max: 10 },
      { id: () => Game.blocks.BLOCK.PLANK, chance: 0.6, min: 6, max: 14 },
    ],
    spawn_tent_beach: [
      { id: () => Game.blocks.BLOCK.SAND, chance: 0.9, min: 10, max: 22 },
      { id: () => Game.blocks.BLOCK.WATER, chance: 0.55, min: 1, max: 2 },
      { id: () => Game.blocks.BLOCK.STONE, chance: 0.4, min: 4, max: 9 },
      { id: () => Game.blocks.BLOCK.PLANK, chance: 0.55, min: 5, max: 12 },
    ],
    spawn_tent_lake: [
      { id: () => Game.blocks.BLOCK.SAND, chance: 0.85, min: 8, max: 18 },
      { id: () => Game.blocks.BLOCK.WATER, chance: 0.7, min: 1, max: 3 },
      { id: () => Game.blocks.BLOCK.ALGAE, chance: 0.45, min: 2, max: 6 },
      { id: () => Game.blocks.BLOCK.STONE, chance: 0.35, min: 4, max: 8 },
    ],
    spawn_tent_geysers: [
      { id: () => Game.blocks.BLOCK.STONE, chance: 0.85, min: 8, max: 18 },
      { id: () => Game.blocks.BLOCK.HOT_WATER, chance: 0.35, min: 1, max: 2 },
      { id: () => Game.blocks.BLOCK.BLACKSTONE, chance: 0.45, min: 3, max: 8 },
      { id: () => Game.blocks.BLOCK.PLANK, chance: 0.45, min: 4, max: 10 },
    ],
    village_storage: [
      { id: () => Game.blocks.BLOCK.PLANK, chance: 0.9, min: 8, max: 18 },
      { id: () => Game.blocks.BLOCK.WOOD, chance: 0.75, min: 5, max: 12 },
      { id: () => Game.blocks.BLOCK.STONE, chance: 0.7, min: 8, max: 16 },
      { id: () => Game.blocks.BLOCK.SAND, chance: 0.35, min: 4, max: 10 },
    ],
    village_shop: [
      { id: () => Game.blocks.BLOCK.PLANK, chance: 0.8, min: 6, max: 14 },
      { id: () => Game.blocks.BLOCK.STONE, chance: 0.55, min: 5, max: 12 },
      { id: () => Game.blocks.BLOCK.GOLDEN_FLOWER, chance: 0.25, min: 1, max: 2 },
      { id: () => Game.blocks.BLOCK.WOOL, chance: 0.4, min: 2, max: 5 },
    ],
  };

  const SPAWN_TENT_LOOT_BY_BIOME = {
    plains: 'spawn_tent_plains',
    forest: 'spawn_tent_forest',
    desert: 'spawn_tent_desert',
    mountains: 'spawn_tent_mountains',
    cliffs: 'spawn_tent_cliffs',
    volcanic: 'spawn_tent_volcanic',
    snow_plains: 'spawn_tent_snow_plains',
    spruce_forest: 'spawn_tent_spruce_forest',
    mountain_forest: 'spawn_tent_mountain_forest',
    beach: 'spawn_tent_beach',
    lake: 'spawn_tent_lake',
    geysers: 'spawn_tent_geysers',
  };

  function spawnTentLootTableForBiome(biome) {
    return SPAWN_TENT_LOOT_BY_BIOME[biome] || 'spawn_tent_plains';
  }

  function spawnTentLootTableForChest(state, pos) {
    const biome = Game.generation3d && Game.generation3d.getBiomeAt3D
      ? Game.generation3d.getBiomeAt3D(state, pos.x, pos.z)
      : 'plains';
    return spawnTentLootTableForBiome(biome);
  }

  function resolveChestLootTableId(state, pos, tableId) {
    return tableId === 'spawn_tent' ? spawnTentLootTableForChest(state, pos) : tableId;
  }

  function generateLootSlots(state, key, tableId) {
    const table = LOOT_TABLES[tableId] || [];
    const rng = rngForChest(state, key, tableId);
    const slots = new Array(CHEST_SIZE).fill(null);
    let index = 0;
    for (const entry of table) {
      if (index >= slots.length || rng() > entry.chance) continue;
      const id = typeof entry.id === 'function' ? entry.id() : entry.id;
      if (!Number.isFinite(id)) continue;
      slots[index] = { id, count: rollCount(rng, entry.min, entry.max) };
      index += 1;
    }
    return normalizeSlots(slots, CHEST_SIZE);
  }

  function lootEntryLabel(entry) {
    const id = typeof entry.id === 'function' ? entry.id() : entry.id;
    const labels = Game.interaction3d && Game.interaction3d.BLOCK_LABELS;
    return (labels && labels[id]) || `ID ${id}`;
  }

  function lootChanceLabel(chance) {
    const percent = Math.max(0, Math.min(100, Math.round((chance || 0) * 100)));
    return `${percent}%`;
  }

  function lootCountLabel(entry) {
    const min = Math.max(1, entry.min | 0);
    const max = Math.max(min, entry.max | 0);
    return min === max ? `${min}` : `${min}-${max}`;
  }

  function describeLootTable(tableId) {
    const table = LOOT_TABLES[tableId] || [];
    return table.map((entry) => `${lootEntryLabel(entry)} ${lootChanceLabel(entry.chance)} x${lootCountLabel(entry)}`);
  }

  function slotsAreEmpty(slots) {
    return Array.isArray(slots) && slots.every((slot) => !slot);
  }

  function chestSlotsFromStored(stored) {
    if (Array.isArray(stored)) return stored;
    if (stored && Array.isArray(stored.slots)) return stored.slots;
    return null;
  }

  function chestLootAlreadyGenerated(stored) {
    return !!(stored && !Array.isArray(stored) && stored.lootGenerated);
  }

  function generatedChestState(slots, tableId = '') {
    const state = { slots: normalizeSlots(cloneData(slots) || [], CHEST_SIZE), lootGenerated: true };
    if (tableId) state.lootTableId = tableId;
    return state;
  }

  function isLikelySpawnTentChest(state, pos) {
    const block = Game.blocks && Game.blocks.BLOCK;
    const world3d = Game.world3d;
    if (!state || !pos || !block || !world3d || !world3d.getBlock3D) return false;
    if (!state.worldMeta || (state.worldMeta.mode !== 'survival' && state.worldMeta.mode !== 'creative')) return false;
    if (world3d.getBlock3D(state, pos.x, pos.y - 1, pos.z) !== block.PLANK) return false;
    let shell = 0;
    let planks = 0;
    for (let z = pos.z - 5; z <= pos.z + 5; z += 1) {
      for (let y = pos.y; y <= pos.y + 7; y += 1) {
        for (let x = pos.x - 5; x <= pos.x + 5; x += 1) {
          const id = world3d.getBlock3D(state, x, y, z);
          if (id === block.WOOL || id === block.LEAF || id === block.SNOW || id === block.BLACKSTONE || id === block.SAND || id === block.STONE) shell += 1;
          else if (id === block.PLANK) planks += 1;
        }
      }
    }
    return shell >= 10 && planks >= 4;
  }

  function openChest(state, x, y, z) {
    const block = Game.blocks && Game.blocks.BLOCK;
    if (!state || !state.world || !block || !Game.world3d || Game.world3d.getBlock3D(state, x, y, z) !== block.CHEST) return false;
    if (!state.ui) state.ui = {};
    state.ui.openChestKey = `${x},${y},${z}`;
    ensureOpenChestSlots(state);
    return true;
  }

  function closeChest(state) {
    if (state && state.ui) state.ui.openChestKey = '';
  }

  function markOpenChestModified(state) {
    const pos = parseChestKey(state && state.ui && state.ui.openChestKey);
    if (!pos || !Game.world3d || !Game.world3d.markChunkModified3D) return;
    Game.world3d.markChunkModified3D(state, pos.x, pos.y, pos.z);
  }

  function ensureOpenChestSlots(state) {
    const key = state && state.ui && state.ui.openChestKey;
    const pos = parseChestKey(key);
    const block = Game.blocks && Game.blocks.BLOCK;
    if (!state || !state.world || !pos || !block || !Game.world3d || Game.world3d.getBlock3D(state, pos.x, pos.y, pos.z) !== block.CHEST) {
      closeChest(state);
      return [];
    }
    if (!state.world.chests) state.world.chests = {};
    const stored = state.world.chests[key];
    if (stored && !Array.isArray(stored) && stored.lootTable) {
      const tableId = resolveChestLootTableId(state, pos, stored.lootTable);
      state.world.chests[key] = generatedChestState(generateLootSlots(state, key, tableId), tableId);
      markOpenChestModified(state);
      return state.world.chests[key].slots;
    }
    let slots = normalizeSlots(chestSlotsFromStored(stored), CHEST_SIZE);
    if (stored && !Array.isArray(stored)) {
      stored.slots = slots;
      state.world.chests[key] = stored;
    } else {
      state.world.chests[key] = slots;
    }
    if (slotsAreEmpty(slots) && !chestLootAlreadyGenerated(stored) && isLikelySpawnTentChest(state, pos)) {
      const tableId = spawnTentLootTableForChest(state, pos);
      state.world.chests[key] = generatedChestState(generateLootSlots(state, key, tableId), tableId);
      markOpenChestModified(state);
      slots = state.world.chests[key].slots;
    }
    return slots;
  }

  function showLootTableForChest(state, x, y, z) {
    const block = Game.blocks && Game.blocks.BLOCK;
    const key = `${x},${y},${z}`;
    const pos = { x, y, z };
    if (!state || !state.world || !block || !Game.world3d || Game.world3d.getBlock3D(state, x, y, z) !== block.CHEST) return false;
    if (!state.ui) state.ui = {};
    const stored = state.world.chests && state.world.chests[key];
    let tableId = stored && !Array.isArray(stored) && stored.lootTable ? resolveChestLootTableId(state, pos, stored.lootTable) : '';
    const slots = chestSlotsFromStored(stored);
    if (!tableId && !chestLootAlreadyGenerated(stored) && slotsAreEmpty(slots) && isLikelySpawnTentChest(state, pos)) tableId = spawnTentLootTableForChest(state, pos);
    if (!tableId || !LOOT_TABLES[tableId]) {
      state.ui.lootTableLines = ['Таблица лута недоступна'];
      state.ui.lootTableTimer = 3.2;
      return true;
    }
    state.ui.lootTableLines = [`Лут: ${tableId}`, ...describeLootTable(tableId)];
    state.ui.lootTableTimer = 5.5;
    return true;
  }

  function setCarried(stack, origin) {
    carried = cloneStack(stack);
    carriedOrigin = carried ? origin : null;
    if (!carried) carriedReturnOrigin = null;
  }

  function mergeOrSwap(slots, index, state, type) {
    const slot = slots[index];
    if (!carried) {
      setCarried(slot, slot ? { type, index } : null);
      carriedReturnOrigin = null;
      slots[index] = null;
      if (state) updateSelectedBlockFromHotbar(state);
      return;
    }
    if (!slot) {
      slots[index] = carried;
      carried = null;
      carriedOrigin = null;
      carriedReturnOrigin = null;
      if (state) updateSelectedBlockFromHotbar(state);
      return;
    }
    if (canMergeStacks(slot, carried) && slot.count < MAX_STACK) {
      const move = Math.min(MAX_STACK - slot.count, carried.count);
      slot.count += move;
      carried.count -= move;
      if (carried.count <= 0) {
        carried = null;
        carriedOrigin = null;
        carriedReturnOrigin = null;
      }
      if (state) updateSelectedBlockFromHotbar(state);
      return;
    }
    const previousOrigin = carriedOrigin;
    slots[index] = carried;
    setCarried(slot, { type, index });
    carriedReturnOrigin = previousOrigin;
    if (state) updateSelectedBlockFromHotbar(state);
  }

  function creativeItems(state = null) {
    if (isEducationCreativeEditor(state)) return educationCreativeItems();
    const items = Game.interaction3d && Game.interaction3d.CREATIVE_ITEMS;
    return Array.isArray(items) ? items.filter((id) => Number.isFinite(id)) : defaultHotbarItems();
  }

  function renderStack(stack) {
    if (!stack) return '<span class="inventory-empty"></span>';
    return `
      <span class="inventory-item" title="${escapeHtml(getStackLabel(stack))}">
        <canvas class="inventory-icon" width="48" height="48" data-inventory-icon="${stack.id}"></canvas>
        <span class="inventory-item-count">${stack.count}</span>
      </span>
    `;
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

  function renderInventory(root, state) {
    if (!root || !state) return;
    const inventory = ensureInventory(state);
    const hotbar = ensureHotbar(state);
    const chest = ensureOpenChestSlots(state);
    const hasChest = chest.length > 0;
    const isCreative = state.worldMeta && state.worldMeta.mode === 'creative';
    const creativeTabLabel = isEducationCreativeEditor(state) ? 'Учебно-творческий инвентарь' : 'Творческий инвентарь';
    if (!isCreative) activeTab = 'inventory';
    const carriedLabel = carried ? `${getStackLabel(carried)} x${carried.count}` : 'Пусто';
    root.innerHTML = `
      <section class="inventory-panel">
        <div class="inventory-head">
          <h2>Инвентарь</h2>
          <button class="inventory-close" type="button" data-inventory-action="close">x</button>
        </div>
        <div class="inventory-tabs">
          <button class="inventory-tab ${activeTab === 'inventory' ? 'is-active' : ''}" type="button" data-inventory-tab="inventory">Инвентарь</button>
          ${isCreative ? `<button class="inventory-tab ${activeTab === 'creative' ? 'is-active' : ''}" type="button" data-inventory-tab="creative">${creativeTabLabel}</button>` : ''}
        </div>
        <div class="inventory-carried">В руке: ${escapeHtml(carriedLabel)}</div>
        ${activeTab === 'creative' && isCreative ? renderCreativeTab(state) : renderInventoryTab(inventory)}
        ${hasChest ? renderChestTab(chest) : ''}
        ${renderHotbarStrip(hotbar, state.player.selectedHotbarIndex)}
        ${renderCarriedCursor()}
      </section>
    `;
    drawInventoryIcons(root);
  }

  function renderCarriedCursor() {
    if (!carried) return '';
    return `
      <div class="inventory-cursor-item" style="left:${pointer.x}px; top:${pointer.y}px;">
        ${renderStack(carried)}
      </div>
    `;
  }

  function renderInventoryTab(inventory) {
    return `
      <div class="inventory-section-title">Рюкзак</div>
      <div class="inventory-grid">
        ${inventory.map((slot, index) => `
          <button class="inventory-slot ${slot ? '' : 'is-empty'}" type="button" data-inventory-slot="${index}">
            ${renderStack(slot)}
          </button>
        `).join('')}
      </div>
    `;
  }

  function renderCreativeTab(state) {
    return `
      <div class="inventory-section-title">Творческий инвентарь</div>
      <div class="inventory-grid inventory-grid-creative">
        ${creativeItems(state).map((id) => `
          <button class="inventory-slot" type="button" data-creative-item="${id}" title="${escapeHtml(getLabel(id))}">
            ${renderStack({ id, count: MAX_STACK })}
          </button>
        `).join('')}
      </div>
    `;
  }

  function renderChestTab(chest) {
    return `
      <div class="inventory-section-title">Сундук</div>
      <div class="inventory-grid">
        ${chest.map((slot, index) => `
          <button class="inventory-slot ${slot ? '' : 'is-empty'}" type="button" data-chest-slot="${index}">
            ${renderStack(slot)}
          </button>
        `).join('')}
      </div>
    `;
  }

  function renderHotbarStrip(hotbar, selectedIndex) {
    return `
      <div class="inventory-hotbar-wrap">
        <div class="inventory-section-title">Хотбар</div>
        <div class="inventory-hotbar">
          ${hotbar.map((slot, index) => `
            <button class="inventory-slot inventory-hotbar-slot ${slot ? '' : 'is-empty'} ${index === selectedIndex ? 'is-selected' : ''}" type="button" data-hotbar-slot="${index}">
              ${renderStack(slot)}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  function drawInventoryIcons(root) {
    const canvases = root.querySelectorAll('canvas[data-inventory-icon]');
    canvases.forEach((canvas) => {
      const id = Number(canvas.dataset.inventoryIcon);
      const ctx = canvas.getContext('2d');
      if (!ctx || !Game.ui3d || !Game.ui3d.drawItemIcon) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      Game.ui3d.drawItemIcon(ctx, id, 0, 0, canvas.width);
    });
  }

  function hasData(target, name) {
    return Object.prototype.hasOwnProperty.call(target.dataset, name);
  }

  function handleInventoryClick(state, event) {
    updatePointer(event);
    const selector = '[data-inventory-action],[data-inventory-tab],[data-inventory-slot],[data-hotbar-slot],[data-chest-slot],[data-creative-item]';
    const target = event.target && event.target.closest ? event.target.closest(selector) : null;
    if (!target) return { close: false };
    if (target.dataset.inventoryAction === 'close') return { close: true };
    if (hasData(target, 'inventoryTab')) {
      activeTab = target.dataset.inventoryTab;
      return { changed: true };
    }
    if (hasData(target, 'inventorySlot')) {
      if (event.button === 2) return { changed: false };
      const index = Number(target.dataset.inventorySlot);
      if (Number.isInteger(index) && index >= 0 && index < INVENTORY_SIZE) mergeOrSwap(ensureInventory(state), index, state, 'inventory');
      return { changed: true };
    }
    if (hasData(target, 'hotbarSlot')) {
      if (event.button === 2) return { changed: false };
      const index = Number(target.dataset.hotbarSlot);
      if (Number.isInteger(index) && index >= 0 && index < HOTBAR_SIZE) mergeOrSwap(ensureHotbar(state), index, state, 'hotbar');
      return { changed: true };
    }
    if (hasData(target, 'chestSlot')) {
      if (event.button === 2) return { changed: false };
      const index = Number(target.dataset.chestSlot);
      if (Number.isInteger(index) && index >= 0 && index < CHEST_SIZE) {
        mergeOrSwap(ensureOpenChestSlots(state), index, state, 'chest');
        markOpenChestModified(state);
      }
      return { changed: true };
    }
    if (hasData(target, 'creativeItem')) {
      const id = Number(target.dataset.creativeItem);
      if (!Number.isFinite(id)) return { changed: false };
      if (carried) return { changed: false };
      carried = { id, count: event.shiftKey || event.button === 2 ? 1 : MAX_STACK };
      carriedOrigin = null;
      carriedReturnOrigin = null;
      return { changed: true };
    }
    return { changed: false };
  }

  function updatePointer(event) {
    if (!event || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
    pointer = { x: event.clientX, y: event.clientY };
  }

  function hasCarried() {
    return !!carried;
  }

  function clearCarried(state) {
    if (carried && state && carriedOrigin) {
      const shouldMarkChest = carriedOrigin.type === 'chest' || (carriedReturnOrigin && carriedReturnOrigin.type === 'chest');
      const slots = getSlotsByOrigin(state, carriedOrigin);
      const index = carriedOrigin.index;
      if (slots && index >= 0 && index < slots.length) {
        const slot = slots[index];
        if (!slot) {
          slots[index] = carried;
          carried = null;
          carriedOrigin = null;
          carriedReturnOrigin = null;
          if (shouldMarkChest) markOpenChestModified(state);
          updateSelectedBlockFromHotbar(state);
          return;
        }
        if (canMergeStacks(slot, carried) && slot.count < MAX_STACK) {
          const move = Math.min(MAX_STACK - slot.count, carried.count);
          slot.count += move;
          carried.count -= move;
          if (carried.count <= 0) {
            carried = null;
            carriedOrigin = null;
            carriedReturnOrigin = null;
          }
          if (shouldMarkChest) markOpenChestModified(state);
          updateSelectedBlockFromHotbar(state);
          return;
        }
        const returnSlots = getSlotsByOrigin(state, carriedReturnOrigin);
        const returnIndex = carriedReturnOrigin ? carriedReturnOrigin.index : -1;
        if (returnSlots && returnIndex >= 0 && returnIndex < returnSlots.length && !returnSlots[returnIndex]) {
          returnSlots[returnIndex] = slot;
          slots[index] = carried;
          carried = null;
          carriedOrigin = null;
          carriedReturnOrigin = null;
          if (shouldMarkChest) markOpenChestModified(state);
          updateSelectedBlockFromHotbar(state);
          return;
        }
        slots[index] = carried;
        carried = null;
        carriedOrigin = null;
        carriedReturnOrigin = null;
        if (shouldMarkChest) markOpenChestModified(state);
        updateSelectedBlockFromHotbar(state);
        return;
      }
    }
    if (carried && state) updateSelectedBlockFromHotbar(state);
    carried = null;
    carriedOrigin = null;
    carriedReturnOrigin = null;
  }

  Game.inventory3d = {
    INVENTORY_SIZE,
    CHEST_SIZE,
    HOTBAR_SIZE,
    MAX_STACK,
    ensureInventory,
    ensureHotbar,
    addInventoryItem,
    addMinedItem,
    hasInventoryItem,
    removeInventoryItem,
    countInventoryItem,
    consumeSelectedHotbarItem,
    getSelectedHotbarStack,
    getStackLabel,
    filledChestDataFromWorld,
    restoreFilledChest,
    updateSelectedBlockFromHotbar,
    openChest,
    closeChest,
    showLootTableForChest,
    renderInventory,
    handleInventoryClick,
    updatePointer,
    hasCarried,
    clearCarried,
  };
})();
