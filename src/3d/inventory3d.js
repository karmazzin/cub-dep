(() => {
  const Game = window.CubDep;

  const INVENTORY_SIZE = 36;
  const HOTBAR_SIZE = 10;
  const MAX_STACK = 100;
  let carried = null;
  let carriedOrigin = null;
  let carriedReturnOrigin = null;
  let pointer = { x: 0, y: 0 };
  let activeTab = 'inventory';

  function cloneStack(stack) {
    return stack ? { id: stack.id, count: stack.count } : null;
  }

  function normalizeStack(stack) {
    if (!stack || !Number.isFinite(stack.id) || !Number.isFinite(stack.count) || stack.count <= 0) return null;
    return { id: stack.id, count: Math.max(1, Math.min(MAX_STACK, stack.count | 0)) };
  }

  function normalizeSlots(slots, size) {
    if (!Array.isArray(slots)) slots = [];
    while (slots.length < size) slots.push(null);
    if (slots.length > size) slots.length = size;
    for (let i = 0; i < slots.length; i += 1) slots[i] = normalizeStack(slots[i]);
    return slots;
  }

  function defaultHotbarItems() {
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
    if (!hadHotbar && state.worldMeta && state.worldMeta.mode === 'creative') {
      const items = defaultHotbarItems();
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

  function addInventoryItem(state, id, count = 1) {
    const inventory = ensureInventory(state);
    return addToSlots(inventory, id, count);
  }

  function addMinedItem(state, id, count = 1) {
    const hotbar = ensureHotbar(state);
    const inventory = ensureInventory(state);
    let remaining = Math.max(0, count | 0);
    if (!Number.isFinite(id) || remaining <= 0) return { added: 0, remaining };
    let added = 0;

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
    return null;
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
    if (slot.id === carried.id && slot.count < MAX_STACK) {
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

  function creativeItems() {
    const items = Game.interaction3d && Game.interaction3d.CREATIVE_ITEMS;
    return Array.isArray(items) ? items.filter((id) => Number.isFinite(id)) : defaultHotbarItems();
  }

  function renderStack(stack) {
    if (!stack) return '<span class="inventory-empty"></span>';
    return `
      <span class="inventory-item">
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
    const isCreative = state.worldMeta && state.worldMeta.mode === 'creative';
    if (!isCreative) activeTab = 'inventory';
    const carriedLabel = carried ? `${getLabel(carried.id)} x${carried.count}` : 'Пусто';
    root.innerHTML = `
      <section class="inventory-panel">
        <div class="inventory-head">
          <h2>Инвентарь</h2>
          <button class="inventory-close" type="button" data-inventory-action="close">x</button>
        </div>
        <div class="inventory-tabs">
          <button class="inventory-tab ${activeTab === 'inventory' ? 'is-active' : ''}" type="button" data-inventory-tab="inventory">Инвентарь</button>
          ${isCreative ? `<button class="inventory-tab ${activeTab === 'creative' ? 'is-active' : ''}" type="button" data-inventory-tab="creative">Творческий инвентарь</button>` : ''}
        </div>
        <div class="inventory-carried">В руке: ${escapeHtml(carriedLabel)}</div>
        ${activeTab === 'creative' && isCreative ? renderCreativeTab() : renderInventoryTab(inventory)}
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

  function renderCreativeTab() {
    return `
      <div class="inventory-section-title">Творческий инвентарь</div>
      <div class="inventory-grid inventory-grid-creative">
        ${creativeItems().map((id) => `
          <button class="inventory-slot" type="button" data-creative-item="${id}" title="${escapeHtml(getLabel(id))}">
            ${renderStack({ id, count: MAX_STACK })}
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
    const selector = '[data-inventory-action],[data-inventory-tab],[data-inventory-slot],[data-hotbar-slot],[data-creative-item]';
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
      const slots = getSlotsByOrigin(state, carriedOrigin);
      const index = carriedOrigin.index;
      if (slots && index >= 0 && index < slots.length) {
        const slot = slots[index];
        if (!slot) {
          slots[index] = carried;
          carried = null;
          carriedOrigin = null;
          carriedReturnOrigin = null;
          updateSelectedBlockFromHotbar(state);
          return;
        }
        if (slot.id === carried.id && slot.count < MAX_STACK) {
          const move = Math.min(MAX_STACK - slot.count, carried.count);
          slot.count += move;
          carried.count -= move;
          if (carried.count <= 0) {
            carried = null;
            carriedOrigin = null;
            carriedReturnOrigin = null;
          }
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
          updateSelectedBlockFromHotbar(state);
          return;
        }
        slots[index] = carried;
        carried = null;
        carriedOrigin = null;
        carriedReturnOrigin = null;
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
    updateSelectedBlockFromHotbar,
    renderInventory,
    handleInventoryClick,
    updatePointer,
    hasCarried,
    clearCarried,
  };
})();
