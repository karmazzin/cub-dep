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
loadScript('src/3d/state3d.js');
loadScript('src/3d/entities3d.js');
loadScript('src/3d/interaction3d.js');
loadScript('src/3d/inventory3d.js');
loadScript('src/3d/generation3d.js');

const Game = context.window.CubDep;
const state = Game.state3d.createGameState3D({
  seed: 'no-treasury-smoke',
  mode: 'creative',
  currentDimension: 'overworld',
});
state.world.worldMeta = state.worldMeta;

const treasuries = Game.generation3d.getTreasuries3D(state);
assert(Array.isArray(treasuries) && treasuries.length === 0, 'treasuries should be disabled');
assert.strictEqual(Game.generation3d.ensureTreasuriesAroundPlayer3D(state), 0, 'treasury generation should stay disabled');
