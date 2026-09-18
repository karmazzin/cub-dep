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

function loadScript(relativePath, injection = '') {
  let code = fs.readFileSync(path.join(root, relativePath), 'utf8');
  if (injection) code = code.replace(/\}\)\(\);\s*$/, `${injection}\n})();`);
  vm.runInContext(code, context, { filename: relativePath });
}

loadScript('src/world/blocks.js');
loadScript('src/3d/constants3d.js');
loadScript('src/3d/world3d.js');
loadScript(
  'src/3d/interaction3d.js',
  'Game.__interactionPortalTestApi = { placeBlockAt, portalFramePositions, portalInnerPositions, activatePortalAtCore };'
);
loadScript(
  'src/3d/inventory3d.js',
  'Game.__inventoryTestApi = { creativeItems };'
);

const Game = context.window.CubDep;
const { BLOCK } = Game.blocks;

const expandedItems = Game.__inventoryTestApi.creativeItems({
  worldMeta: { mode: 'creative', expandedBlockAssortment: true },
});
assert(!expandedItems.includes(BLOCK.TNT_TABLE), 'expanded inventory must hide the retired TNT table');
assert(!expandedItems.includes(BLOCK.CUSTOM_TNT), 'expanded inventory must hide custom TNT');

const legacyPackItems = Game.__inventoryTestApi.creativeItems({
  worldMeta: { mode: 'creative', explosionPackEnabled: true },
});
assert(!legacyPackItems.includes(BLOCK.TNT_TABLE), 'legacy worlds must no longer expose the TNT table in creative inventory');
assert(!legacyPackItems.includes(BLOCK.CUSTOM_TNT), 'legacy worlds must no longer expose custom TNT in creative inventory');

const state = {
  world: Game.world3d.createWorld3D(64, 64, 64),
  worldMeta: {
    id: 'portal-smoke',
    mode: 'creative',
    currentDimension: 'overworld',
    portalLinks: [],
  },
  player: { x: 2.5, y: 2, z: 2.5, scale: 1 },
  ui: {},
};
const chunkVolume = 16 * 16 * 16;
Game.world3d.installGeneratedChunk3D(
  state,
  1,
  1,
  1,
  new Uint16Array(chunkVolume),
  new Uint8Array(chunkVolume).fill(255)
);

const placed = Game.__interactionPortalTestApi.placeBlockAt(
  state,
  BLOCK.ACTIVE_STRANGE_PORTAL,
  BLOCK.ACTIVE_STRANGE_PORTAL,
  { id: BLOCK.ACTIVE_STRANGE_PORTAL, count: 1 },
  false,
  20,
  20,
  20
);
assert.strictEqual(placed, true, 'active portal block should be placeable in a loaded chunk');
assert.strictEqual(state.worldMeta.portalLinks.length, 1, 'placing an active portal should immediately register a dimension link');
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(state.worldMeta.portalLinks[0].overworld)),
  { x: 20, y: 20, z: 20, axis: 'x' },
  'the registered link should match the manually placed active portal'
);
assert(state.worldMeta.portalLinks[0].underground, 'the active portal should get an underground destination');

Game.__interactionPortalTestApi.placeBlockAt(
  state,
  BLOCK.STONE,
  BLOCK.STONE,
  { id: BLOCK.STONE, count: 1 },
  false,
  21,
  20,
  20
);
assert.strictEqual(
  Game.world3d.getBlock3D(state, 20, 20, 20),
  BLOCK.ACTIVE_STRANGE_PORTAL,
  'placing a nearby block must not erase a registered standalone active portal'
);

const frameState = {
  world: Game.world3d.createWorld3D(64, 64, 64),
  worldMeta: { id: 'frame-portal-smoke', mode: 'creative', currentDimension: 'overworld', portalLinks: [] },
  player: { x: 2.5, y: 2, z: 2.5, scale: 1 },
  ui: {},
};
Game.world3d.installGeneratedChunk3D(
  frameState,
  1,
  1,
  1,
  new Uint16Array(chunkVolume),
  new Uint8Array(chunkVolume).fill(255)
);
Game.world3d.setBlock3D(frameState, 20, 20, 20, BLOCK.STRANGE_PORTAL_CORE);
for (const pos of Game.__interactionPortalTestApi.portalFramePositions(20, 20, 20, 'x')) {
  Game.world3d.setBlock3D(frameState, pos.x, pos.y, pos.z, BLOCK.STRANGE_PORTAL_STONE);
}
assert.strictEqual(
  Game.__interactionPortalTestApi.activatePortalAtCore(frameState, 20, 20, 20, 'x'),
  true,
  'a restored strange-portal frame should still activate'
);
const activeInner = Game.__interactionPortalTestApi.portalInnerPositions(20, 20, 20, 'x')[0];
assert.strictEqual(
  Game.world3d.getBlock3D(frameState, activeInner.x, activeInner.y, activeInner.z),
  BLOCK.ACTIVE_STRANGE_PORTAL,
  'frame activation should fill the portal interior with active portal blocks'
);
assert.strictEqual(frameState.worldMeta.portalLinks.length, 1, 'frame activation should retain its dimension link');

console.log('portal and retired inventory smoke tests passed');
