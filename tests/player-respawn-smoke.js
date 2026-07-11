const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = {
  window: { CubDep: {} },
  Math,
  Date,
  console,
};
vm.createContext(context);

function loadScript(relativePath) {
  const code = fs.readFileSync(path.join(root, relativePath), 'utf8');
  vm.runInContext(code, context, { filename: relativePath });
}

loadScript('src/world/blocks.js');
loadScript('src/3d/constants3d.js');

const Game = context.window.CubDep;
const { BLOCK } = Game.blocks;

Game.world3d = {
  getBlock3D(state, x, y, z) {
    if (!state.world || x < 0 || x >= state.world.w || y < 0 || y >= state.world.h || z < 0 || z >= state.world.d) return BLOCK.BEDROCK;
    if (y === 0) return BLOCK.STONE;
    return BLOCK.AIR;
  },
  isSolidBlock3D(id) {
    return id !== BLOCK.AIR
      && id !== BLOCK.WATER
      && id !== BLOCK.HOT_WATER
      && id !== BLOCK.LAVA;
  },
};

Game.generation3d = {
  getWorldSpawn3D() {
    return { x: 11, z: 13 };
  },
  getSurfaceSpawnY3D() {
    return 4;
  },
};

loadScript('src/3d/player3d.js');

const state = {
  world: { w: 32, h: 64, d: 32 },
  worldMeta: { mode: 'survival' },
  ui: {},
  player: {
    x: 25.5,
    y: 60,
    z: 25.5,
    vx: 1,
    vy: -20,
    vz: 1,
    yaw: 0,
    pitch: 0,
    onGround: false,
    maxHealth: 100,
    health: 5,
    damageCooldown: 0,
    damageFlash: 0,
    hazardTimer: 0,
    fallSpeed: 20,
  },
};

Game.player3d.applyPlayerDamage3D(state, 10, 'test', { ignoreCooldown: true });

assert.strictEqual(state.player.x, 11.5, 'dead player should respawn at world spawn X');
assert.strictEqual(state.player.y, 4, 'dead player should respawn at surface spawn Y, not world top');
assert.strictEqual(state.player.z, 13.5, 'dead player should respawn at world spawn Z');
assert.strictEqual(state.player.health, 100, 'respawn should restore health');
assert.strictEqual(state.player.vx, 0, 'respawn should clear horizontal velocity');
assert.strictEqual(state.player.vy, 0, 'respawn should clear vertical velocity');
