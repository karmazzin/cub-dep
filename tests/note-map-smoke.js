const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = {
  window: { CubDep: {} },
  console,
  performance: { now: () => 0 },
};
vm.createContext(context);

function loadScript(relativePath) {
  const code = fs.readFileSync(path.join(root, relativePath), 'utf8');
  vm.runInContext(code, context, { filename: relativePath });
}

loadScript('src/world/blocks.js');
loadScript('src/3d/constants3d.js');
loadScript('src/3d/world3d.js');

const Game = context.window.CubDep;
const { BLOCK } = Game.blocks;

Game.generation3d = {
  getBiomeAt3D() {
    return 'forest';
  },
};

loadScript('src/3d/interaction3d.js');
loadScript('src/3d/inventory3d.js');

const { ITEM } = Game.interaction3d;

assert(Number.isFinite(ITEM.MAP), 'map item should exist');
assert.strictEqual(Game.interaction3d.BLOCK_LABELS[ITEM.MAP], 'Карта');
assert(Game.interaction3d.CREATIVE_ITEMS.includes(ITEM.MAP), 'creative inventory should include map');

const recipes = Game.inventory3d.recipeList();
const mapRecipe = recipes.find((recipe) => recipe.id === 'map_from_paper_and_dirt');
assert(mapRecipe, 'survival craft should include map recipe');
assert.strictEqual(
  JSON.stringify(mapRecipe.ingredients),
  JSON.stringify([{ id: ITEM.PAPER, count: 4 }, { id: BLOCK.DIRT, count: 1 }])
);
assert.strictEqual(mapRecipe.result.id, ITEM.MAP);
assert.strictEqual(mapRecipe.result.count, 1);
assert(mapRecipe.result.data, 'crafted map should start with map data');

const noteStack = { id: ITEM.NOTE, count: 1 };
Game.inventory3d.saveNoteText(noteStack, 'мой текст 🙂');
assert.strictEqual(Game.inventory3d.noteTextFromStack(noteStack), 'мой текст 🙂');
Game.inventory3d.saveNoteText(noteStack, 'новый текст');
assert.strictEqual(Game.inventory3d.noteTextFromStack(noteStack), 'новый текст');
const readonlyNote = { id: ITEM.NOTE, count: 1, data: Game.inventory3d.createNoteData('готово', true) };
assert.strictEqual(Game.inventory3d.saveNoteText(readonlyNote, 'нельзя'), false);
assert.strictEqual(Game.inventory3d.noteTextFromStack(readonlyNote), 'готово');

const mapStack = { id: ITEM.MAP, count: 1, data: Game.inventory3d.createMapData() };
assert.strictEqual(mapStack.data.radius, 100, 'survival map should reveal around 100 blocks near the player');
assert.strictEqual(mapStack.data.mode, 'biome');
assert.strictEqual(mapStack.data.cells.block, undefined, 'map should not keep a block-mode layer');

const state = {
  world: Game.world3d.createWorld3D(64, 32, 64),
  worldMeta: { seed: 'note-map-smoke', mode: 'survival' },
  player: {
    x: 16.5,
    y: 10,
    z: 16.5,
    hotbar: [],
    inventory: [mapStack],
    selectedHotbarIndex: 0,
  },
  ui: {},
  pause: { open: false },
};
Game.world3d.setBlock3D(state, 16, 4, 16, BLOCK.STONE);
const updateResult = Game.inventory3d.updateInventoryMaps(state);
const storedMapStack = state.player.inventory[0];
assert(updateResult.updated > 0, 'map should update while it is just in inventory');
assert(Object.keys(storedMapStack.data.cells.biome).length > 0, 'map should reveal biome cells');
assert(
  Object.values(storedMapStack.data.cells.biome).some((cell) => cell && cell.biome === 'forest'),
  'map should record visible biomes'
);
const foundInventoryMap = Game.inventory3d.findFirstMapStack(state);
assert(foundInventoryMap && foundInventoryMap.id === ITEM.MAP, 'survival M should find a map item in inventory');
state.player.inventory[0] = null;
assert.strictEqual(
  Game.inventory3d.findFirstMapStack(state),
  null,
  'survival M should know when there is no map item'
);
