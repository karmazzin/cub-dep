const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const context = { window: { CubDep: {}, innerWidth: 390 }, console };
vm.createContext(context);
function load(file) { vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context); }
load('src/world/blocks.js');
load('src/3d/constants3d.js');
const Game = context.window.CubDep;
const B = Game.blocks.BLOCK;
let wallHeight = 1;
Game.world3d = {
  getBlock3D(state, x, y, z) { return y === 0 || (z === 5 && y <= wallHeight) ? B.STONE : B.AIR; },
  isSolidBlock3D(id) { return id === B.STONE; },
};
load('src/3d/player3d.js');
function player() { return { world: { w: 32, h: 32, d: 32 }, worldMeta: { mode: 'survival' }, ui: {}, player: { x: 4.5, y: 1.001, z: 4.5, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, onGround: true } }; }
function step(s, input = {}, actions = {}) { Game.player3d.updatePlayer3D(s, { keys: {}, mobileMoveY: -1, ...input }, { dx: 0, dy: 0 }, 1/60, actions); }
let s = player(); step(s); assert(s.player.vy > 0, 'mobile movement should jump over a one-block obstacle');
wallHeight = 2; s = player(); step(s); assert(s.player.vy <= 0, 'do not autojump into a tall wall');
wallHeight = 0; s = player(); step(s); assert(s.player.vy <= 0, 'do not bounce on flat ground');
wallHeight = 1; s = player(); step(s, { mobileMoveY: 0, keys: { KeyW: true } }); assert(s.player.vy <= 0, 'keyboard movement should not autojump');
s = player(); step(s, {}, { flyTogglePressed: true }); assert(!s.player.flying);
s = player(); s.worldMeta.mode = 'creative'; step(s, { mobileMoveY: 0 }, { flyTogglePressed: true }); assert(s.player.flying);
step(s, { mobileMoveY: 0 }, { flyTogglePressed: true }); assert(!s.player.flying, 'second gesture must turn flight off');
load('src/3d/inventory3d.js');
s = player(); s.player.hotbar = [null, null, null, null, { id: B.STONE, count: 12 }];
Game.inventory3d.ensureHotbar(s);
assert.equal(s.player.hotbar[4].id, B.GLOBE, 'fifth real slot should contain the existing globe');
assert(s.player.hotbar.some(stack => stack && stack.id === B.STONE && stack.count === 12), 'displaced stack must be preserved');
Game.inventory3d.ensureHotbar(s);
assert.equal(s.player.hotbar.filter(stack => stack && stack.id === B.GLOBE).length, 1, 'normalization must not duplicate globes');
context.window.innerWidth = 1280;
s = player(); Game.inventory3d.ensureHotbar(s); assert.equal(s.player.hotbar[4], null, 'desktop starter inventory stays unchanged');
console.log('mobile autojump, flight, and globe inventory passed');

context.window.innerWidth = 390;
s = player();
s.player.hotbar = new Array(10).fill(null).map(() => ({ id: B.STONE, count: 100 }));
s.player.inventory = new Array(36).fill(null).map(() => ({ id: B.DIRT, count: 100 }));
Game.inventory3d.ensureHotbar(s);
assert.equal(s.player.hotbar[4].id, B.STONE, 'full inventories must not lose items');
s.player.inventory[12] = null;
Game.inventory3d.ensureHotbar(s);
assert.equal(s.player.hotbar[4].id, B.GLOBE);
assert.equal(s.player.inventory[12].count, 100, 'deferred grant must preserve displaced stack');
s = player();
s.player.hotbar = new Array(10).fill(null);
s.player.hotbar[4] = { id: B.STONE, count: 12, data: { marker: 'keep' } };
s.player.hotbar[8] = { id: B.GLOBE, count: 3 };
Game.inventory3d.ensureHotbar(s);
assert.equal(s.player.hotbar[4].count, 3, 'existing globe stack must be reused');
assert.equal(s.player.hotbar[8].data.marker, 'keep', 'swap must preserve item data');
wallHeight = 0;
s = player(); step(s, { mobileMoveY: 0 }, { jumpPressed: true });
assert(s.player.vy > 0, 'quick jump taps released before a frame must still jump');
console.log('mobile globe overflow, swap, and short jump tap passed');
