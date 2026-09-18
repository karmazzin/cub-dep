const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = {
  window: { CubDep: {} },
  console,
};
vm.createContext(context);

function loadScript(relativePath) {
  const code = fs.readFileSync(path.join(root, relativePath), 'utf8');
  vm.runInContext(code, context, { filename: relativePath });
}

loadScript('src/world/blocks.js');
loadScript('src/3d/constants3d.js');
loadScript('src/3d/easterEggs3d.js');
loadScript('src/3d/world3d.js');
loadScript('src/3d/state3d.js');
loadScript('src/3d/generation3d.js');

const Game = context.window.CubDep;

assert(Game.easterEggs3d, 'the Cavern Fall configuration API should be available');

const directSelection = Game.easterEggs3d.resolveCavernFallSelection('cavern_fall', () => 0);
assert.strictEqual(directSelection.easterEgg, 'cavern_fall', 'Cavern Fall should work without prior activation');
assert.strictEqual(directSelection.cavernFallAxis, 'x', 'Cavern Fall should choose an axis without prior activation');

const xSelection = Game.easterEggs3d.resolveCavernFallSelection('cavern_fall', () => 0.49);
assert.strictEqual(xSelection.easterEgg, 'cavern_fall', 'an activated Cavern Fall should be stored on the world');
assert.strictEqual(xSelection.cavernFallAxis, 'x', 'an activated Cavern Fall should be able to choose X');

const zSelection = Game.easterEggs3d.resolveCavernFallSelection('cavern_fall', () => 0.5);
assert.strictEqual(zSelection.easterEgg, 'cavern_fall', 'an activated Cavern Fall should stay active when Z is chosen');
assert.strictEqual(zSelection.cavernFallAxis, 'z', 'an activated Cavern Fall should be able to choose Z');

assert.strictEqual(typeof Game.easterEggs3d.shouldShowCavernFallLink, 'function', 'the world UI should expose a Cavern Fall link rule');
assert.strictEqual(
  Game.easterEggs3d.shouldShowCavernFallLink({ easterEgg: 'cavern_fall' }, true),
  true,
  'the Cavernfall link should be shown while a Cavern Fall world is visible'
);
assert.strictEqual(
  Game.easterEggs3d.shouldShowCavernFallLink({ easterEgg: 'cavern_fall' }, false),
  false,
  'the Cavernfall link should be hidden outside the world view'
);
assert.strictEqual(
  Game.easterEggs3d.shouldShowCavernFallLink({ easterEgg: '' }, true),
  false,
  'normal worlds should not show the Cavernfall link'
);

const xState = Game.state3d.createGameState3D({
  easterEgg: 'cavern_fall',
  cavernFallAxis: 'x',
});
assert.strictEqual(xState.world.w, 1, 'Cavern Fall on X should crop the physical world to one block');
assert.strictEqual(xState.world.h, 128, 'Cavern Fall should keep the normal world height');
assert.strictEqual(xState.world.d, 2048, 'Cavern Fall should keep the full coordinate depth');
assert.strictEqual(xState.player.x, 0.5, 'the player should start inside the cropped X slice');
const xVillages = Game.generation3d.getVillages3D(xState);
assert(xVillages.length > 0, 'Cavern Fall should plan villages in the full source world');
assert(
  xVillages.some((village) => village.x > 1),
  'Cavern Fall village coordinates should come from the full source world, not the one-block target world'
);

const zState = Game.state3d.createGameState3D({
  easterEgg: 'cavern_fall',
  cavernFallAxis: 'z',
});
assert.strictEqual(zState.world.w, 2048, 'Cavern Fall on Z should keep the normal X size');
assert.strictEqual(zState.world.d, 1, 'Cavern Fall on Z should crop the physical world to one block');
assert.strictEqual(zState.player.z, 0.5, 'the player should start inside the cropped Z slice');

const inactiveState = Game.state3d.createGameState3D({
  easterEgg: 'cavern_fall',
});
assert.strictEqual(inactiveState.world.w, 2048, 'Cavern Fall without a stored axis should fall back to a normal world');
assert.strictEqual(inactiveState.world.d, 2048, 'Cavern Fall without a stored axis should keep a normal world depth');
assert.strictEqual(inactiveState.worldMeta.easterEgg, '', 'Cavern Fall without a valid axis should normalize to a normal world');

assert.strictEqual(typeof Game.easterEggs3d.getCavernFallSourceCell, 'function', 'generation should expose central-source coordinate mapping');
const xSource = Game.easterEggs3d.getCavernFallSourceCell(xState.worldMeta, 0, 400, 'overworld');
assert.strictEqual(xSource.x, 1024, 'the local X slice should sample the center of the full world');
assert.strictEqual(xSource.z, 400, 'the long Z coordinate should remain unchanged');
const zSource = Game.easterEggs3d.getCavernFallSourceCell(zState.worldMeta, 400, 0, 'overworld');
assert.strictEqual(zSource.x, 400, 'the long X coordinate should remain unchanged');
assert.strictEqual(zSource.z, 1024, 'the local Z slice should sample the center of the full world');
const undergroundSource = Game.easterEggs3d.getCavernFallSourceCell(xState.worldMeta, 0, 400, 'underground');
assert.strictEqual(undergroundSource.x, 0, 'the underground dimension should not use the surface slice offset');

xState.world.worldMeta = xState.worldMeta;
xState.world.dimension = 'overworld';
xState.worldMeta.seed = 'cavern-fall-x-generation';
const xSpawn = Game.generation3d.getWorldSpawn3D(xState);
assert.strictEqual(xSpawn.x, 0, 'an X-oriented Cavern Fall spawn should use the only physical X coordinate');
Game.generation3d.generateChunk3D(xState, 0, 0, Math.floor(xSpawn.z / 16));
assert.strictEqual(Game.world3d.getBlock3D(xState, 0, 0, xSpawn.z), Game.blocks.BLOCK.BEDROCK, 'the cropped X slice should keep generated terrain');
assert.strictEqual(Game.world3d.inBounds3D(xState.world, 1, 0, xSpawn.z), false, 'the area beyond the X slice should be outside the world boundary');

zState.world.worldMeta = zState.worldMeta;
zState.world.dimension = 'overworld';
zState.worldMeta.seed = 'cavern-fall-z-generation';
const zSpawn = Game.generation3d.getWorldSpawn3D(zState);
assert.strictEqual(zSpawn.z, 0, 'a Z-oriented Cavern Fall spawn should use the only physical Z coordinate');
Game.generation3d.generateChunk3D(zState, Math.floor(zSpawn.x / 16), 0, 0);
assert.strictEqual(Game.world3d.getBlock3D(zState, zSpawn.x, 0, 0), Game.blocks.BLOCK.BEDROCK, 'the cropped Z slice should keep generated terrain');
assert.strictEqual(Game.world3d.inBounds3D(zState.world, zSpawn.x, 0, 1), false, 'the area beyond the Z slice should be outside the world boundary');

console.log('cavern fall smoke tests passed');
