const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { performance } = require('perf_hooks');
const root = path.resolve(__dirname, '..');
const context = { window: { CubDep: {} }, console, performance };
vm.createContext(context);
for (const file of ['src/world/blocks.js', 'src/3d/constants3d.js', 'src/3d/world3d.js', 'src/3d/generation3d.js']) {
  let code = fs.readFileSync(path.join(root, file), 'utf8');
  if (file.endsWith('generation3d.js')) code = code.replace(/\}\)\(\);\s*$/, 'Game.structureTest = { placeSpawnTent3D };\n})();');
  vm.runInContext(code, context, { filename: file });
}
const Game = context.window.CubDep;
const B = Game.blocks.BLOCK;
const state = {
  world: Game.world3d.createWorld3D(128, 64, 128),
  worldMeta: { seed: 'tent-roof-0', mode: 'creative' },
  player: { x: 64.5, y: 16, z: 64.5 },
  ui: {},
};
// This seed places the tent at (60, 15, 67). Its roof crosses into a
// completely air-filled chunk above the ground, as well as an X boundary.
for (let cz = 4; cz <= 4; cz++) {
  for (let cx = 3; cx <= 4; cx++) {
    for (let cy = 0; cy <= 1; cy++) Game.generation3d.generateChunk3D(state, cx, cy, cz);
  }
}
assert(Game.structureTest.placeSpawnTent3D(state, 64, 64), 'tent should be placed');
for (let z = 67; z <= 75; z++) {
  for (let dx = 1; dx <= 7; dx++) {
    const y = 22 - Math.abs(dx - 4);
    assert.equal(Game.world3d.getBlock3D(state, 60 + dx, y, z), B.WOOL, `roof missing at ${60 + dx},${y},${z}`);
  }
}
assert.equal(Game.world3d.getBlock3D(state, 66, 16, 69), B.CHEST, 'interior chest should survive');
assert.equal(Game.world3d.getBlock3D(state, 64, 16, 67), B.AIR, 'doorway should remain open');
// A high air-only terrain chunk must accept ordinary structure and fluid writes,
// and unloading must remove its generated marker so it can be regenerated.
assert(Game.generation3d.generateChunk3D(state, 4, 3, 4));
assert(Game.world3d.isBlockChunkLoaded3D(state.world, 65, 50, 65), 'generated air chunk must be loaded');
assert(Game.world3d.setBlock3D(state, 65, 50, 65, B.PLANK));
assert(Game.world3d.setWater3D(state, 66, 50, 65, 0, true));
assert(Game.world3d.removeChunk3D(state, 4, 3, 4, { clearModified: true }));
assert(!state.world.generatedChunks.has('4,3,4'));
assert(!Game.world3d.setBlock3D(state, 65, 50, 65, B.PLANK), 'unloaded terrain must still reject writes');
assert(Game.generation3d.generateChunk3D(state, 4, 3, 4));
assert.equal(Game.world3d.getBlock3D(state, 65, 50, 65), B.AIR);
// Re-running terrain generation must not overwrite the completed tent.
assert(!Game.generation3d.generateChunk3D(state, 3, 1, 4));
assert.equal(Game.world3d.getBlock3D(state, 61, 19, 70), B.WOOL);
console.log('structure generation smoke tests passed');
