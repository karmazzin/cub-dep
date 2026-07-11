const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = {
  window: { CubDep: {} },
  console,
};
context.window.prompt = () => '1234';
vm.createContext(context);

function loadScript(relativePath) {
  const code = fs.readFileSync(path.join(root, relativePath), 'utf8');
  vm.runInContext(code, context, { filename: relativePath });
}

loadScript('src/world/blocks.js');

const Game = context.window.CubDep;
const { BLOCK } = Game.blocks;

Game.constants3d = {
  EYE_HEIGHT: 1.62,
  PLAYER_HEIGHT: 1.8,
  PLAYER_RADIUS: 0.3,
  REACH_DISTANCE: 6,
};

Game.world3d = {
  getBlock3D(state, x, y, z) {
    return state.world.blocks[`${x},${y},${z}`] || BLOCK.AIR;
  },
  markChunkModified3D(state, x, y, z) {
    state.world.modified = `${x},${y},${z}`;
  },
};

loadScript('src/3d/interaction3d.js');
loadScript('src/3d/inventory3d.js');

assert(Number.isFinite(BLOCK.STONE_CHEST), 'STONE_CHEST block id should exist');
assert(Game.blocks.PLACEABLE.has(BLOCK.STONE_CHEST), 'stone chest should be placeable');
assert(
  Game.interaction3d.CREATIVE_ITEMS.includes(BLOCK.STONE_CHEST),
  'creative inventory should include stone chest'
);
assert.strictEqual(Game.interaction3d.BLOCK_LABELS[BLOCK.STONE_CHEST], 'Каменный сундук');
assert(
  Game.interaction3d.CREATIVE_ITEMS.includes(BLOCK.COBWEB),
  'creative inventory should include cobweb'
);
assert.strictEqual(Game.interaction3d.BLOCK_LABELS[BLOCK.COBWEB], 'Паутина');
assert.strictEqual(
  Game.inventory3d.getStackLabel({ id: BLOCK.COBWEB, count: 1 }),
  'Паутина',
  'held cobweb should be named cobweb'
);
for (const id of Game.interaction3d.CREATIVE_ITEMS) {
  const label = Game.inventory3d.getStackLabel({ id, count: 1 });
  assert(
    label && label !== 'Предмет' && label !== 'Блок',
    `creative item ${id} should have an explicit label`
  );
}
for (const [name, id] of Object.entries(BLOCK)) {
  if (!Number.isFinite(id) || id === BLOCK.AIR) continue;
  const label = Game.interaction3d.BLOCK_LABELS[id];
  assert(
    label && label !== 'Предмет' && label !== 'Блок',
    `block ${name} (${id}) should have an explicit label`
  );
}
for (const id of Game.blocks.PLACEABLE) {
  const label = Game.inventory3d.getStackLabel({ id, count: 1 });
  assert(
    label && label !== 'Предмет' && label !== 'Блок' && !/^ID /.test(label),
    `placeable block ${id} should have an explicit label`
  );
}
for (const [name, id] of Object.entries(Game.interaction3d.ITEM)) {
  if (!Number.isFinite(id)) continue;
  const label = Game.inventory3d.getStackLabel({ id, count: 1 });
  assert(
    label && label !== 'Предмет' && label !== 'Блок' && !/^ID /.test(label),
    `item ${name} (${id}) should have an explicit label`
  );
}

const recipes = Game.inventory3d.recipeList();
const recipe = recipes.find((item) => item.id === 'stone_chest_from_stone_and_chest');
assert(recipe, 'survival craft should include stone chest recipe');
assert.strictEqual(
  JSON.stringify(recipe.ingredients),
  JSON.stringify([{ id: BLOCK.STONE, count: 8 }, { id: BLOCK.CHEST, count: 1 }]),
  'stone chest recipe should require 8 stone and 1 chest'
);
assert.strictEqual(recipe.result.id, BLOCK.STONE_CHEST);
assert.strictEqual(recipe.result.count, 1);

const state = {
  world: {
    blocks: { '1,2,3': BLOCK.STONE_CHEST },
    chests: {},
  },
  ui: {},
};

assert.strictEqual(Game.inventory3d.openChest(state, 1, 2, 3), true, 'stone chest should open after code prompt');
assert.strictEqual(state.ui.openChestKey, '1,2,3');
assert.strictEqual(state.world.chests['1,2,3'].code, '1234');
assert(Array.isArray(state.world.chests['1,2,3'].slots), 'stone chest should keep normal chest slots');

Game.inventory3d.closeChest(state);
context.window.prompt = () => '0000';
assert.strictEqual(Game.inventory3d.openChest(state, 1, 2, 3), false, 'wrong code should not open stone chest');
assert.strictEqual(state.ui.openChestKey, '');

context.window.prompt = () => '1234';
assert.strictEqual(Game.inventory3d.openChest(state, 1, 2, 3), true, 'saved code should reopen stone chest');
