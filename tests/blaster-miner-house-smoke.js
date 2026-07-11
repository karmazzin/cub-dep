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
context.window.prompt = () => 'если пришел с миром-забирай';
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

loadScript('src/3d/interaction3d.js');
loadScript('src/3d/inventory3d.js');
loadScript('src/3d/generation3d.js');

const { ITEM } = Game.interaction3d;

assert(Number.isFinite(ITEM.PAPER), 'paper item should exist');
assert(Number.isFinite(ITEM.NOTE), 'note item should exist');
assert.strictEqual(Game.interaction3d.BLOCK_LABELS[ITEM.PAPER], 'Бумага');
assert.strictEqual(Game.interaction3d.BLOCK_LABELS[ITEM.NOTE], 'Записка');

const recipes = Game.inventory3d.recipeList();
const paperRecipe = recipes.find((recipe) => recipe.id === 'paper_from_wood');
assert(paperRecipe, 'survival craft should include paper recipe');
assert.strictEqual(JSON.stringify(paperRecipe.ingredients), JSON.stringify([{ id: BLOCK.WOOD, count: 4 }]));
assert.strictEqual(paperRecipe.result.id, ITEM.PAPER);
assert.strictEqual(paperRecipe.result.count, 16);

const noteRecipe = recipes.find((recipe) => recipe.id === 'note_from_paper_and_stone');
assert(noteRecipe, 'survival craft should include note recipe');
assert.strictEqual(JSON.stringify(noteRecipe.ingredients), JSON.stringify([{ id: ITEM.PAPER, count: 1 }, { id: BLOCK.STONE, count: 1 }]));
assert.strictEqual(noteRecipe.result.id, ITEM.NOTE);
assert.strictEqual(noteRecipe.result.count, 1);

assert.strictEqual(
  Game.inventory3d.normalizeChestCode('Если пришёл с миром - забирай'),
  Game.inventory3d.normalizeChestCode(' если пришел с миром-забирай '),
  'stone chest code should ignore case, e/yo, edge spaces, and dash spaces'
);

const noteData = Game.inventory3d.createNoteData('текст 🙂', true);
assert.strictEqual(noteData.text, 'текст 🙂');
assert.strictEqual(noteData.readOnly, true);
assert.strictEqual(Game.inventory3d.noteTextFromStack({ id: ITEM.NOTE, count: 1, data: noteData }), 'текст 🙂');

const state = {
  world: Game.world3d.createWorld3D(160, 80, 160),
  worldMeta: { seed: 'blaster-miner-house-smoke', mode: 'survival' },
  player: { x: 80.5, y: 40, z: 80.5 },
  entities: { sheep: [] },
  ui: {},
};
state.world.worldMeta = state.worldMeta;

const house = Game.generation3d.createBlasterMinerHouseAt3D(state, 72, 72, { allowNearSpawn: true });
assert(house, 'blaster miner house should be created for a direct test placement');
assert.strictEqual(house.type, 'blaster_miner_house');

const houses = Game.generation3d.getBlasterMinerHouses3D(state);
assert(houses.some((item) => item.key === house.key), 'created house should be available for map markers');

const topChest = state.world.chests[`${house.noteChest.x},${house.noteChest.y},${house.noteChest.z}`];
assert(topChest && Array.isArray(topChest.slots), 'house top chest should have slots');
const foundNote = topChest.slots.find((slot) => slot && slot.id === ITEM.NOTE);
assert(foundNote, 'house top chest should contain the ready note');
assert.strictEqual(foundNote.data.readOnly, true);
assert.strictEqual(foundNote.data.text, 'пароль от сейфа: "если пришел с миром - забирай"');

const safeKey = `${house.safeChest.x},${house.safeChest.y},${house.safeChest.z}`;
const safe = state.world.chests[safeKey];
assert(safe && Array.isArray(safe.slots), 'hidden stone chest should have slots');
assert.strictEqual(safe.code, 'если пришел с миром - забирай');
assert.strictEqual(Game.world3d.getBlock3D(state, house.safeChest.x, house.safeChest.y, house.safeChest.z), BLOCK.STONE_CHEST);
for (const dynamiteId of Object.keys(Game.interaction3d.DYNAMITE_CONFIG).map(Number)) {
  assert(safe.slots.some((slot) => slot && slot.id === dynamiteId && slot.count === 1), `safe should include dynamite ${dynamiteId}`);
}
const remoteStack = safe.slots.find((slot) => slot && slot.id === BLOCK.TNT_REMOTE);
assert(remoteStack, 'safe should include TNT remotes');
assert.strictEqual(remoteStack.count, Object.keys(Game.interaction3d.DYNAMITE_CONFIG).length);

assert.strictEqual(Game.inventory3d.openChest(state, house.safeChest.x, house.safeChest.y, house.safeChest.z), true, 'safe should open with normalized password');

const markerOnlyState = {
  world: Game.world3d.createWorld3D(160, 80, 160),
  worldMeta: { seed: 'blaster-miner-house-smoke', mode: 'survival' },
  player: { x: 80.5, y: 40, z: 80.5 },
  entities: { sheep: [] },
  ui: {},
};
markerOnlyState.world.worldMeta = markerOnlyState.worldMeta;
const candidate = Game.generation3d.getBlasterMinerHouses3D(markerOnlyState)[0];
assert(candidate, 'map should have at least one blaster miner house marker for this seed');
const markerBlockBefore = Game.world3d.getBlock3D(markerOnlyState, candidate.x, candidate.y || 1, candidate.z);
assert.strictEqual(markerBlockBefore, BLOCK.AIR, 'a marker candidate should not pretend an ungenerated structure exists');
markerOnlyState.player.x = candidate.x + 0.5;
markerOnlyState.player.z = candidate.z + 0.5;
Game.generation3d.ensureBlasterMinerHousesAroundPlayer3D(markerOnlyState);
const generatedCandidate = Game.generation3d.getBlasterMinerHouses3D(markerOnlyState)
  .find((item) => item && item.key === candidate.key && item.generated);
assert(generatedCandidate, 'nearby marker candidate should generate even if normal decoration already ran before this feature existed');
assert.notStrictEqual(
  Game.world3d.getBlock3D(markerOnlyState, generatedCandidate.noteChest.x, generatedCandidate.noteChest.y, generatedCandidate.noteChest.z),
  BLOCK.AIR,
  'generated marker should point to a real built structure'
);
