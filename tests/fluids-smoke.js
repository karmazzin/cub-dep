const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = {
  window: { CubDep: {} },
  console,
  Math,
  Date,
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
loadScript('src/3d/fluids3d.js');

const Game = context.window.CubDep;
const { BLOCK } = Game.blocks;

function createFluidTestState() {
  const state = {
    world: Game.world3d.createWorld3D(32, 16, 32),
    player: { x: 8, z: 8 },
    worldMeta: { seed: 'fluid-smoke' },
  };
  state.world.allowChunkCreationWrites = 1;
  for (let z = 0; z < 16; z += 1) {
    for (let x = 0; x < 16; x += 1) {
      Game.world3d.setBlock3D(state, x, 0, z, BLOCK.STONE);
    }
  }
  state.world.allowChunkCreationWrites = 0;
  return state;
}

function tickFluids(state, count = 40) {
  for (let i = 0; i < count; i += 1) {
    Game.fluids3d.updateFluids3D(state, 0.14);
  }
}

let state = createFluidTestState();
assert(Game.fluids3d.addWaterSource3D(state, 8, 1, 8), 'floor water source should be placed');
assert.strictEqual(
  Game.world3d.getBlock3D(state, 9, 1, 8),
  BLOCK.WATER,
  'placed floor water should spread on the same call'
);

state = createFluidTestState();
assert(Game.fluids3d.addLavaSource3D(state, 8, 1, 8), 'floor lava source should be placed');
assert.strictEqual(
  Game.world3d.getBlock3D(state, 9, 1, 8),
  BLOCK.LAVA,
  'placed floor lava should spread on the same call'
);

state = createFluidTestState();
Game.world3d.setBlock3D(state, 8, 1, 8, BLOCK.LAVA);
Game.world3d.setBlock3D(state, 8, 2, 8, BLOCK.STONE);
assert(Game.fluids3d.addWaterSource3D(state, 8, 3, 8), 'geyser water source should be placed');
assert.strictEqual(
  Game.world3d.getBlock3D(state, 8, 3, 8),
  BLOCK.HOT_WATER,
  'water placed over a geyser should immediately become hot water'
);
assert.strictEqual(
  Game.world3d.getBlock3D(state, 9, 3, 8),
  BLOCK.AIR,
  'active geyser source should not spread sideways immediately'
);
assert(
  Game.fluids3d.getGeyserInfo3D(state, 8, 3, 8),
  'active geyser should be cached immediately'
);

state = createFluidTestState();
assert(Game.fluids3d.addWaterSource3D(state, 8, 5, 8), 'water source should be placed');
tickFluids(state);
assert.strictEqual(
  Game.world3d.getBlock3D(state, 8, 2, 8),
  BLOCK.WATER,
  'falling water should keep a continuous vertical column'
);
assert.strictEqual(
  Game.world3d.getBlock3D(state, 9, 1, 8),
  BLOCK.WATER,
  'falling water should spread sideways after reaching solid support'
);

state = createFluidTestState();
assert(Game.fluids3d.addLavaSource3D(state, 8, 5, 8), 'lava source should be placed');
tickFluids(state);
assert.strictEqual(
  Game.world3d.getBlock3D(state, 8, 2, 8),
  BLOCK.LAVA,
  'falling lava should keep a continuous vertical column'
);
assert.strictEqual(
  Game.world3d.getBlock3D(state, 9, 1, 8),
  BLOCK.LAVA,
  'falling lava should spread sideways after reaching solid support'
);
