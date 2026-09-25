const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const context = { window: { CubDep: {} }, console };
vm.createContext(context);
function load(file) { vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context); }
load('src/world/blocks.js'); load('src/3d/constants3d.js'); load('src/3d/world3d.js');
const G = context.window.CubDep;
const B = G.blocks.BLOCK;
load('src/3d/interaction3d.js');
let opened = '';
G.openMap = options => { assert(options.allowAnyMode); opened = 'map'; };
G.openChestInventory = (x, y, z) => { assert.equal(`${x},${y},${z}`, '4,2,6'); opened = 'chest'; };
G.inventory3d = { getSelectedHotbarStack: () => ({ id: B.STONE, count: 10 }) };
function state(id) {
  const s = { world: G.world3d.createWorld3D(32,32,32), worldMeta: { mode: 'creative' }, ui: {}, player: { x:4.5,y:1,z:4.5,yaw:0,pitch:0 } };
  s.world.allowChunkCreationWrites = 1;
  G.world3d.setBlock3D(s,4,2,6,id);
  return s;
}
function step(s, actions = {}, input = {}) { G.interaction3d.updateInteraction3D(s, { keys:{}, primaryDown:false, ...input }, actions, 0.05); }
for (const id of [B.CHEST, B.STONE_CHEST, B.GLOBE]) {
  const s = state(id);
  opened = '';
  step(s, { placePressed:true, mobilePlace:true });
  assert.equal(opened,'','mobile placement must not open interactive blocks');
  G.world3d.setBlock3D(s,4,2,5,B.AIR);
  step(s, { usePressed:true });
  assert.equal(opened,id===B.GLOBE?'map':'chest');
  assert.equal(G.world3d.getBlock3D(s,4,2,6),id,'use must leave the target intact');
  opened = '';
  step(s, {}, { primaryDown:true });
  assert(s.world.blockDamage['4,2,6'] > 0,'mining must damage interactive blocks');
  for (let i=0;i<60;i++) step(s, {}, { primaryDown:true });
  assert.equal(G.world3d.getBlock3D(s,4,2,6),B.AIR,'mining must break interactive blocks');
  assert.equal(opened,'','mining must not open the chest or map');
}
const s = state(B.STONE);
step(s, { usePressed:true });
assert.equal(G.world3d.getBlock3D(s,4,2,5),B.AIR,'use must never place the held block');
step(s, {}, { primaryDown:true });
assert(s.world.blockDamage['4,2,6'] > 0,'normal blocks must remain mineable on mobile');
const desktop = state(B.CHEST);
step(desktop, {}, { primaryDown:true });
assert(desktop.world.blockDamage['4,2,6'] > 0,'desktop mining must remain unchanged');
console.log('mobile use: chest, globe, interactive-block mining, placement separation passed');
