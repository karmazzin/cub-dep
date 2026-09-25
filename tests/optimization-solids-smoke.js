const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.resolve(__dirname, '..');
const context = { window: { CubDep: {} }, console, performance: { now: () => 0 } };
vm.createContext(context);
function load(file, extra = '') {
  let code = fs.readFileSync(path.join(root, file), 'utf8');
  if (extra) code = code.replace(/\}\)\(\);\s*$/, `${extra}\n})();`);
  vm.runInContext(code, context, { filename: file });
}
for (const file of ['world/blocks', '3d/constants3d', '3d/world3d', '3d/fluids3d', '3d/generation3d']) load(`src/${file}.js`);
const G = context.window.CubDep;
const B = G.blocks.BLOCK;
const W = G.world3d;
function state() {
  const s = { world: W.createWorld3D(48, 32, 48), player: { x: 8, y: 8, z: 8 }, worldMeta: { seed: 'solid-fluid', superOptimization: true, chunkRenderDistance: 8 } };
  s.world.allowChunkCreationWrites = 1;
  return s;
}
const s = state();
assert.equal(G.constants3d.getChunkRenderDistanceValue(s.worldMeta), 1);
for (const [id, replacement] of [[B.WATER, B.SNOW], [B.HOT_WATER, B.SNOW], [B.LAVA, B.STONE], [B.VOLCANIC_LAVA, B.STONE]]) {
  W.setBlock3D(s, 8, 8, 8, id);
  assert.equal(W.getBlock3D(s, 8, 8, 8), replacement, 'gameplay must read a solid replacement');
  assert(W.isSolidBlock3D(W.getBlock3D(s, 8, 8, 8)));
  assert.equal(W.getStoredBlock3D(s, 8, 8, 8), id, 'texture/save identity must survive');
  G.fluids3d.activateFluidAround3D(s, 8, 8, 8);
  for (let i = 0; i < 20; i++) G.fluids3d.updateFluids3D(s, 0.14);
  assert.equal(W.getStoredBlock3D(s, 8, 7, 8), B.AIR, 'replacement must not flow down');
  s.worldMeta.superOptimization = false;
  assert.equal(W.getBlock3D(s, 8, 8, 8), id);
  s.worldMeta.superOptimization = true;
}
assert.equal(s.fluids3d.active.size, 0, 'optimized placements must not enqueue fluid work');
const snapshot = W.getChunkSnapshot3D(s, '0,0,0');
const restored = state();
W.installSavedChunk3D(restored, 0, 0, 0, snapshot.blocks, snapshot.fluidLevel, snapshot);
assert.equal(W.getBlock3D(restored, 8, 8, 8), B.STONE);
restored.worldMeta.superOptimization = false;
assert.equal(W.getBlock3D(restored, 8, 8, 8), B.VOLCANIC_LAVA);
W.setBlock3D(s, 8, 8, 8, B.AIR);
s.worldMeta.superOptimization = false;
assert.equal(W.getBlock3D(s, 8, 8, 8), B.AIR, 'mined replacement must not resurrect');
assert.equal(G.constants3d.getChunkRenderDistanceValue(s.worldMeta), 8);

const flowing = state();
for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) W.setBlock3D(flowing, x, 0, z, B.STONE);
G.fluids3d.addWaterSource3D(flowing, 8, 1, 8);
G.fluids3d.updateFluids3D(flowing, 0.14);
assert.equal(W.getStoredBlock3D(flowing, 9, 1, 8), B.AIR);
flowing.worldMeta.superOptimization = false;
for (let i = 0; i < 12; i++) G.fluids3d.updateFluids3D(flowing, 0.14);
assert.equal(W.getBlock3D(flowing, 9, 1, 8), B.WATER, 'flow must resume after optimization');

const generated = state();
const generatedBlocks = new Uint16Array(4096);
const generatedLevels = new Uint8Array(4096);
generatedBlocks[8 + 16 * (8 + 16 * 8)] = B.VOLCANIC_LAVA;
W.installGeneratedChunk3D(generated, 0, 0, 0, generatedBlocks, generatedLevels);
assert.equal(W.getBlock3D(generated, 8, 8, 8), B.STONE, 'generated fluids must immediately have solid properties');
assert(!generated.fluids3d || !generated.fluids3d.active.size);

// Geyser lift is independent of liquid simulation and particle rendering.
s.worldMeta.superOptimization = true;
W.setLava3D(s, 8, 5, 8, 0, true);
W.setBlock3D(s, 8, 6, 8, B.STONE);
W.setHotWater3D(s, 8, 7, 8, 0, true);
assert(G.fluids3d.getGeyserInfo3D(s, 8, 7, 8).height > 0);
W.setBlock3D(s, 8, 5, 8, B.AIR);
assert.equal(G.fluids3d.getGeyserInfo3D(s, 8, 7, 8), null, 'removed heat must stop lift');

s.volcanoes = { time: 12, active: new Map([['v', {}]]), forcedEruptions: new Map(), coolingWaves: new Map(), shake: 1 };
G.generation3d.updateVolcanoes3D(s, 1);
assert.equal(s.volcanoes.time, 12);
assert.equal(s.volcanoes.active.size, 0);
assert.equal(s.volcanoes.shake, 0);
assert(!s.worldMeta.volcanoFirstEruptions);
console.log('solid fluid properties, restoration, snapshots, geyser lift and eruption suppression passed');

load('src/3d/interaction3d.js', 'Game.solidInteractionTest = { breakBlockAt, placeBlockAt, processCustomExplosionBlock };');
load('src/3d/player3d.js', 'Game.solidPlayerTest = { overlapsSolid };');
s.player = { x: 8.5, y: 8, z: 8.5, scale: 1 };
const drops = [];
G.inventory3d = { addMinedItem: (state, id) => { drops.push(id); return { remaining: 0 }; } };
s.worldMeta.mode = 'creative';
for (const [id, replacement] of [[B.WATER, B.SNOW], [B.HOT_WATER, B.SNOW], [B.LAVA, B.STONE], [B.VOLCANIC_LAVA, B.STONE]]) {
  W.setBlock3D(s, 8, 8, 8, id);
  assert(G.solidPlayerTest.overlapsSolid(s, 8.5, 8, 8.5), 'replacement must collide with the player');
  const broken = G.solidInteractionTest.breakBlockAt(s, 8, 8, 8);
  assert.equal(broken.dropId, replacement);
  assert.equal(drops.pop(), replacement);
  assert(!G.solidInteractionTest.placeBlockAt(s, id, id, null, false, 8, 8, 8), 'replacement cannot be placed inside player');
}
for (const mode of ['survival', undefined]) {
  s.worldMeta.mode = mode;
  for (const id of [B.WATER, B.HOT_WATER, B.LAVA, B.VOLCANIC_LAVA]) {
    W.setBlock3D(s, 8, 8, 8, id);
    const broken = G.solidInteractionTest.breakBlockAt(s, 8, 8, 8);
    assert(broken);
    assert.equal(broken.dropId, B.AIR, 'survival fluid replacements must not award resources');
    assert.equal(drops.length, 0);
    s.worldMeta.superOptimization = false;
    assert.equal(W.getBlock3D(s, 8, 8, 8), B.AIR, 'removed liquid must stay removed');
    s.worldMeta.superOptimization = true;
  }
  for (const id of [B.SNOW, B.STONE]) {
    W.setBlock3D(s, 8, 8, 8, id);
    assert.equal(G.solidInteractionTest.breakBlockAt(s, 8, 8, 8).dropId, id);
    assert.equal(drops.pop(), id, 'real snow and stone still drop normally');
  }
}
load('src/3d/bots3d.js', 'Game.solidBotTest = { tryMine };');
for (const id of [B.WATER, B.HOT_WATER, B.LAVA, B.VOLCANIC_LAVA]) {
  W.setBlock3D(s, 8, 8, 8, id);
  assert.equal(G.solidBotTest.tryMine(s, {}, 8, 8, 8, 999), B.AIR, 'bots must not receive replacement resources');
  assert.equal(W.getStoredBlock3D(s, 8, 8, 8), B.AIR);
  W.setBlock3D(s, 8, 8, 8, id);
  assert(G.solidInteractionTest.processCustomExplosionBlock(s, { custom: { power: 3, movingBlocks: true }, broken: 0 }, 8, 8, 8, W.getBlock3D(s, 8, 8, 8)));
  assert.equal(drops.length, 0, 'explosions must not award replacement resources');
  assert.equal(W.getStoredBlock3D(s, 8, 8, 8), B.AIR);
  assert(!s.world.movingBlocks || !s.world.movingBlocks.length, 'liquids must not turn into collectible moving stone/snow');
}
context.THREE = context.window.THREE = require('../vendor/three.min.js');
G.ui3d = { drawUI3D() {} };
load('src/3d/renderer3d.js', `Game.solidRendererTest = {
  buildWorldMesh, getRenderedBlockId, updateSteamParticles, updateLavaEmbers,
  syncOptimizationMode,
  fixture: () => {
    atlasMeta = { tileSize: 32, width: 512, height: 512, variants: 1 };
    atlasEntries = new Map();
  },
  effects: () => [steamGroup, lavaEmberGroup],
  enqueueDirtyChunkMeshes,
  setImageCache: cache => { distantImages = cache; },
};`);
const render = G.solidRendererTest;
render.fixture();
W.setBlock3D(s, 8, 8, 8, B.WATER);
const bounds = { minX: 8, maxX: 9, minY: 8, maxY: 9, minZ: 8, maxZ: 9 };
const solid = render.buildWorldMesh(s, 'solid', bounds);
assert(solid.getAttribute('position').count > 0);
solid.computeBoundingBox();
assert.equal(solid.boundingBox.max.y, 9, 'solid water must have full cube height');
assert.equal(render.getRenderedBlockId(s, B.SNOW, 8, 8, 8), B.WATER, 'water keeps its texture');
assert.equal(render.buildWorldMesh(s, 'water', bounds).getAttribute('position').count, 0);
render.updateSteamParticles(s);
render.updateLavaEmbers(s);
assert(Array.from(render.effects()).every(value => value === null), 'optimized effects must not even allocate particle pools');
// A neighbor-only dirty flag must not erase an image we cannot rebuild yet.
let invalidations = 0;
render.setImageCache({ hasColumn: () => true, invalidate() { invalidations++; } });
s.player.x = 40;
s.player.z = 40;
s.world.dirtyChunks.clear();
s.world.dirtyChunks.add('0,0,0');
render.enqueueDirtyChunkMeshes(s);
assert.equal(invalidations, 0, 'distant boundary edits must retain the last captured image');
assert(s.world.dirtyChunks.has('0,0,0'), 'deferred geometry must still rebuild on return');
render.setImageCache(null);
render.syncOptimizationMode(s);
s.world.dirtyChunks.clear();
s.worldMeta.superOptimization = false;
render.syncOptimizationMode(s);
assert(s.world.dirtyChunks.has('0,0,0'), 'disabling optimization must rebuild retained distant data');
console.log('solid collision, mining drops, placement, geometry, textures and particle allocation passed');
