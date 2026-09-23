const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { performance } = require('perf_hooks');
const root = path.resolve(__dirname, '..');
const context = { window: { CubDep: {} }, console, performance };
vm.createContext(context);
function load(file, extra = '') {
  let code = fs.readFileSync(path.join(root, file), 'utf8');
  if (extra) code = code.replace(/\}\)\(\);\s*$/, `${extra}\n})();`);
  vm.runInContext(code, context, { filename: file });
}
for (const file of ['src/world/blocks.js', 'src/3d/constants3d.js', 'src/3d/performance3d.js', 'src/3d/world3d.js', 'src/3d/fluids3d.js', 'src/3d/generation3d.js']) load(file, file.endsWith('generation3d.js') ? 'Game.loadingTest = { queueChunksAroundPlayer3D, isOptimizationChunkNeeded, isColumnProtectedFromUnload };' : '');
const Game = context.window.CubDep;
const C = Game.constants3d;
const B = Game.blocks.BLOCK;
const meta = { chunkRenderDistance: 6, superOptimization: true };
assert.equal(C.getChunkRenderDistanceValue(meta), 1, 'optimization must force an active radius of one');
meta.superOptimization = false;
assert.equal(C.getChunkRenderDistanceValue(meta), 6, 'turning off must restore the original radius');
const state = { world: Game.world3d.createWorld3D(128, 128, 128), player: { x: 40, y: 20, z: 40 }, worldMeta: { seed: 'optimization-smoke', superOptimization: true }, ui: {} };
assert(C.isActiveSimulationPosition3D(state, 56, 40), 'adjacent chunk should remain active');
assert(!C.isActiveSimulationPosition3D(state, 72, 40), 'distant chunks must be inactive');
assert(!C.isActiveSimulationPosition3D(state, 56, 56), 'active radius must agree with circular renderer distance');
state.world.allowChunkCreationWrites = 1;
for (let z = 32; z < 48; z++) for (let x = 32; x < 48; x++) Game.world3d.setBlock3D(state, x, 0, z, B.STONE);
state.world.allowChunkCreationWrites = 0;
Game.fluids3d.addWaterSource3D(state, 40, 1, 40);
assert.equal(Game.world3d.getBlock3D(state, 41, 1, 40), B.AIR, 'new water must not flow immediately while paused');
for (let i = 0; i < 12; i++) Game.fluids3d.updateFluids3D(state, 0.14);
assert.equal(Game.world3d.getBlock3D(state, 41, 1, 40), B.AIR, 'water must stay frozen across ticks');
state.worldMeta.superOptimization = false;
Game.fluids3d.updateFluids3D(state, 0.14);
assert.equal(Game.world3d.getBlock3D(state, 41, 1, 40), B.WATER, 'water must resume from its retained source');
state.worldMeta.superOptimization = true;
const frozenBlocks = JSON.stringify(Array.from(state.world.chunks, ([key, chunk]) => [key, Array.from(chunk.blocks)]));
for (let i = 0; i < 12; i++) Game.fluids3d.updateFluids3D(state, 0.14);
assert.equal(JSON.stringify(Array.from(state.world.chunks, ([key, chunk]) => [key, Array.from(chunk.blocks)])), frozenBlocks, 'an existing water front must freeze without disappearing');
Game.loadingTest.queueChunksAroundPlayer3D(state, C.getChunkRenderDistanceValue(state.worldMeta));
assert(state.world.chunkLoading.queue.length > 0);
for (const job of state.world.chunkLoading.queue) {
  assert((job.cx - 2) ** 2 + (job.cz - 2) ** 2 <= 1, 'terrain queue must stay inside one chunk');
}
state.ui.pendingMapTeleport = { x: 104, y: 20, z: 104, radius: 1 };
assert(Game.loadingTest.isOptimizationChunkNeeded(state, 6, 6), 'teleport destination must still be loadable');
assert(Game.loadingTest.isColumnProtectedFromUnload(state, 6, 6, { y: 8 }), 'teleport destination must not unload while waiting');
state.ui.pendingMapTeleport = null;
assert(!Game.loadingTest.isOptimizationChunkNeeded(state, 6, 6), 'ordinary distant jobs must be discarded');
const before = state.world.chunks.size;
const sample = Game.generation3d.getDistantTerrainSample3D(state, 80, 80);
assert(Number.isFinite(sample.height) && sample.height > 0);
assert(Number.isFinite(sample.blockId));
assert.equal(state.world.chunks.size, before, 'preview sampling must not generate chunks');
assert.deepStrictEqual(sample, Game.generation3d.getDistantTerrainSample3D(state, 80, 80), 'preview must be deterministic');
console.log('super optimization smoke tests passed');

// Exercise the real geometry and bounded preview cache without WebGL or a browser.
context.THREE = context.window.THREE = require('../vendor/three.min.js');
Game.ui3d = { drawUI3D() {} };
load('src/3d/renderer3d.js', 'scene = new THREE.Scene(); Game.previewTest = { buildDistantColumnData, updateDistantTerrain, updateChunkVisibility, disposeDistantTerrain, addMesh: (key, entry) => chunkMeshes.set(key, entry), get: () => distantTerrain };');
const data = Game.previewTest.buildDistantColumnData(state, 5, 5);
assert(data.positions.length > 0 && data.positions.length <= 16 * 36 * 3);
assert.equal(data.positions.length, data.colors.length);
assert(data.positions.every(Number.isFinite));
const initialChunks = state.world.chunks.size;
for (let i = 0; i < 40; i++) Game.previewTest.updateDistantTerrain(state);
assert.equal(state.world.chunks.size, initialChunks, 'drawing previews must not load world chunks');
const preview = Game.previewTest.get();
assert(preview.columns.size > 10, 'distant terrain should fill in incrementally');
for (let i = 0; i < 100; i++) Game.previewTest.updateDistantTerrain(state);
const stableVersion = preview.mesh.geometry.getAttribute('position').version;
Game.previewTest.updateDistantTerrain(state);
assert.equal(preview.mesh.geometry.getAttribute('position').version, stableVersion, 'settled scenery must not upload each frame');
assert(preview.mesh.geometry.drawRange.count < 441 * 16 * 36, 'unused preview slots must not be drawn');
assert(!preview.columns.has('2,2'), 'player column must never receive a flat preview, even while loading');
// Rebuilding an already detailed neighbor must not put a coarse mesh over it.
const neighborMesh = new context.THREE.Mesh(new context.THREE.BufferGeometry(), new context.THREE.MeshBasicMaterial());
Game.previewTest.addMesh('3,1,2', { cx: 3, cy: 1, cz: 2, solid: neighborMesh });
Game.previewTest.updateChunkVisibility(state);
assert.equal(neighborMesh.visible, false, 'partial real geometry must stay hidden behind a coarse preview');
for (let cy = 0; cy < 8; cy++) {
  Game.world3d.installGeneratedChunk3D(state, 3, cy, 2, new Uint16Array(4096), new Uint8Array(4096).fill(255));
  state.world.dirtyChunks.delete(`3,${cy},2`);
}
Game.previewTest.updateDistantTerrain(state);
assert(!preview.columns.has('3,2'), 'ready neighbor should have transitioned to full detail');
Game.previewTest.updateChunkVisibility(state);
assert.equal(neighborMesh.visible, true, 'ready neighbor should display its real mesh');
state.world.dirtyChunks.add('3,1,2');
for (let i = 0; i < 5; i++) Game.previewTest.updateDistantTerrain(state);
assert(!preview.columns.has('3,2'), 'mesh rebuilding must never demote a detailed neighbor to the coarse background');
Game.previewTest.updateChunkVisibility(state);
assert.equal(neighborMesh.visible, true, 'existing detailed geometry must stay visible during updates');
state.world.dirtyChunks.delete('3,1,2');

assert.equal(preview.mesh.geometry.getAttribute('position').array.length, 441 * 16 * 36 * 3, 'preview memory must stay bounded');
state.player.x = 104;
for (let i = 0; i < 40; i++) Game.previewTest.updateDistantTerrain(state);
assert.equal(preview.columns.size + preview.free.length, 441, 'moving must reclaim preview slots');
state.worldMeta.superOptimization = false;
Game.previewTest.updateDistantTerrain(state);
assert.equal(Game.previewTest.get(), null, 'disabling must release the preview');

load('src/3d/entities3d.js');
load('src/3d/bots3d.js');
state.worldMeta.superOptimization = true;
state.player.x = 40;
state.entities = { sheep: [{ id: 'far-mob', type: 'sheep', x: 100, y: 15, z: 100, health: 4, thinkTimer: 5 }], bots: [{ id: 'far-bot', x: 100, y: 15, z: 100, connected: true, thinkTimer: 5 }] };
const entitiesBefore = JSON.stringify(state.entities);
Game.entities3d.updateEntities3D(state, 0.05);
Game.bots3d.updateBots3D(state, 0.05);
assert.equal(JSON.stringify(state.entities), entitiesBefore, 'distant actors must not tick');

const listeners = {};
context.window.addEventListener = (name, fn) => { (listeners[name] ||= []).push(fn); };
context.document = { addEventListener() {} };
load('src/3d/input3d.js');
const input = Game.input3d.createInput3D({ addEventListener() {} }, () => state);
function key(type, extra = {}) { for (const fn of listeners[type] || []) fn({ code: 'KeyO', ...extra }); }
let inputTime = 0;
context.performance = { now: () => inputTime };
key('keydown');
assert(!input.consumeActions().optimizationTogglePressed, 'press must wait to distinguish a hold');
key('keyup');
assert(input.consumeActions().optimizationTogglePressed, 'short O must emit the toggle on release');
key('keydown');
key('keydown', { repeat: true });
assert(!input.consumeActions().optimizationTogglePressed, 'holding O must not repeat the toggle');
inputTime = 1001;
assert(input.consumeActions().hyperOptimizationTogglePressed, 'one second must enable hyper mode');
inputTime = 2001;
assert(!input.consumeActions().hyperOptimizationTogglePressed, 'hold must fire only once');
key('keyup');
assert(!input.consumeActions().optimizationTogglePressed, 'hold release must not emit a short press');
key('keydown');
input.resetMovement();
inputTime += 2000;
key('keyup');
assert(!input.consumeActions().hyperOptimizationTogglePressed && !input.consumeActions().optimizationTogglePressed, 'reset must cancel a hold');
key('keydown', { target: { tagName: 'INPUT' } });
assert(!input.consumeActions().optimizationTogglePressed, 'typing O must not change gameplay');
key('keyup');
state.pause = { open: true };
key('keydown');
assert(!input.consumeActions().optimizationTogglePressed, 'O must not toggle in a menu');
context.performance = performance;
console.log('preview, distant simulation and keyboard smoke tests passed');

// Known terrain keeps its actual block colors when replaced by a distant preview.
state.pause.open = false;
state.player.x = 40;
state.worldMeta.superOptimization = true;
for (let cy = 0; cy < 8; cy++) {
  Game.world3d.installGeneratedChunk3D(state, 5, cy, 5, new Uint16Array(4096), new Uint8Array(4096).fill(255));
}
state.world.suppressChunkModification = 1;
Game.world3d.setBlock3D(state, 82, 30, 82, B.WOOL);
Game.world3d.setBlock3D(state, 86, 30, 82, B.PLANK);
Game.world3d.setBlock3D(state, 90, 30, 82, B.DIRT);
Game.world3d.setBlock3D(state, 94, 30, 82, B.DIRT);
Game.world3d.setGrassLevel3D(state, 94, 30, 82, 3);
state.world.suppressChunkModification = 0;
assert.equal(Game.generation3d.getDistantTerrainSample3D(state, 82, 82).blockId, B.WOOL);
const colored = Game.previewTest.buildDistantColumnData(state, 5, 5);
for (const [offset, hex] of [[0, '#ded8c8'], [90, '#a36f3a'], [180, '#785236'], [270, '#5c9a2c']]) {
  const color = new context.THREE.Color(hex);
  assert.deepStrictEqual(Array.from(colored.colors.slice(offset, offset + 3)), [color.r, color.g, color.b], 'preview must use the visible material color');
}
Game.generation3d.unloadDistantChunks3D(state, 1, 100);
assert(!state.world.chunks.has('5,1,5'), 'the real distant chunk should be unloaded');
assert.equal(Game.generation3d.getDistantTerrainSample3D(state, 82, 82).blockId, B.WOOL, 'wool must keep its color after unloading');
assert.equal(Game.generation3d.getDistantTerrainSample3D(state, 86, 82).blockId, B.PLANK, 'planks must keep their color after unloading');
assert.equal(Game.generation3d.getDistantTerrainSample3D(state, 94, 82).blockId, B.GRASS, 'grass cover must keep its green material after unloading');
assert.equal(Game.generation3d.getDistantTerrainSample3D(state, 90, 82).blockId, B.DIRT, 'bare dirt must remain brown after unloading');
Game.world3d.clearWorld3D(state);
assert(!state.world.distantTerrainColumns || state.world.distantTerrainColumns.size === 0, 'clearing a world must clear its preview samples');
console.log('preview material colors and player-column exclusion passed');

state.worldMeta.superOptimization = true;
for (let i = 0; i < 100; i++) Game.performance3d.updateFrameBudget3D(state, 35, 25);
for (let i = 0; i < 20; i++) Game.previewTest.updateDistantTerrain(state);
const degraded = Game.previewTest.get();
assert.equal(degraded.step, 16, 'sustained overload must reach coarse terrain');
assert(degraded.mesh.geometry.getAttribute('position').array.length <= 441 * 36 * 3, 'coarse quality must reduce geometry memory');
assert(!degraded.columns.has('2,2'), 'adaptive quality must still exclude the player column');
console.log('adaptive preview workload checks passed');
