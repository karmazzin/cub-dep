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
// Optimization must preserve world loading and simulation.
for (const distance of [1, 6, 10, 'auto']) {
  const plain = { chunkRenderDistance: distance };
  const optimized = { ...plain, superOptimization: true };
  assert.equal(C.getChunkRenderDistanceValue(optimized), C.getChunkRenderDistanceValue(plain));
  assert.equal(C.isManualChunkRenderDistance(optimized), C.isManualChunkRenderDistance(plain));
}
function createState(enabled) {
  return { world: Game.world3d.createWorld3D(128, 128, 128), player: { x: 40, y: 20, z: 40 }, worldMeta: { seed: 'optimization-smoke', chunkRenderDistance: 6, superOptimization: enabled }, ui: {} };
}
const state = createState(true);
const plain = createState(false);
for (const current of [state, plain]) {
  assert(C.isActiveSimulationPosition3D(current, 104, 104));
  current.world.allowChunkCreationWrites = 1;
  for (let z = 32; z < 48; z++) for (let x = 32; x < 48; x++) Game.world3d.setBlock3D(current, x, 0, z, B.STONE);
  current.world.allowChunkCreationWrites = 0;
  Game.fluids3d.addWaterSource3D(current, 40, 1, 40);
  for (let i = 0; i < 12; i++) Game.fluids3d.updateFluids3D(current, 0.14);
  Game.loadingTest.queueChunksAroundPlayer3D(current, 6);
}
const blocks = current => JSON.stringify(Array.from(current.world.chunks, ([key, chunk]) => [key, Array.from(chunk.blocks)]));
assert.equal(blocks(state), blocks(plain), 'water simulation must match normal gameplay');
assert.equal(Game.world3d.getBlock3D(state, 41, 1, 40), B.WATER);
const jobs = current => JSON.stringify(current.world.chunkLoading.queue.map(job => job.key));
assert.equal(jobs(state), jobs(plain), 'generation queues must be identical');
assert(state.world.chunkLoading.queue.some(job => (job.cx - 2) ** 2 + (job.cz - 2) ** 2 > 1));

// Observe actual visibility writes, including invalidation within the same chunk.
context.THREE = context.window.THREE = require('../vendor/three.min.js');
Game.ui3d = { drawUI3D() {} };
load('src/3d/renderer3d.js', `Game.optimizationTest = {
  updateChunkVisibility, drawBlockIcon,
  setIcons: value => { optimizeIcons = value; },
  cacheSize: () => blockIconCache.size,
  addMesh: (key, entry) => { chunkMeshes.set(key, entry); chunkMeshRevision += 1; },
};`);
const api = Game.optimizationTest;
let writes = 0;
let visible = false;
const mesh = { set visible(value) { writes++; visible = value; } };
api.addMesh('5,0,2', { cx: 5, cz: 2, solid: mesh });
api.updateChunkVisibility(state);
assert(visible, 'full configured radius must be displayed');
const firstWrites = writes;
for (let i = 0; i < 100; i++) api.updateChunkVisibility(state);
assert.equal(writes, firstWrites, 'stationary view must reuse visibility results');
state.worldMeta.chunkRenderDistance = 1;
api.updateChunkVisibility(state);
assert(!visible);
state.worldMeta.chunkRenderDistance = 6;
api.updateChunkVisibility(state);
assert(visible);
api.addMesh('5,0,2', { cx: 5, cz: 2, solid: mesh });
const beforeReplace = writes;
api.updateChunkVisibility(state);
assert(writes > beforeReplace, 'same-size mesh replacement must invalidate the cache');
state.player.x = 127;
api.updateChunkVisibility(state);
const beforeWorld = writes;
state.world = Game.world3d.createWorld3D(128, 128, 128);
api.updateChunkVisibility(state);
assert(writes > beforeWorld, 'world changes must invalidate the cache');

let paintCalls = 0;
let imageCalls = 0;
const canvasContext = new Proxy({}, { get: (obj, key) => obj[key] || (() => { paintCalls++; }) });
context.document = { createElement: () => ({ getContext: () => canvasContext }), addEventListener() {} };
const target = { drawImage() { imageCalls++; } };
api.setIcons(true);
api.drawBlockIcon(target, B.STONE, 10, 10, 32);
const firstPaint = paintCalls;
assert(firstPaint > 0);
for (let i = 0; i < 100; i++) api.drawBlockIcon(target, B.STONE, 10 + i, 10, 32);
assert.equal(paintCalls, firstPaint, 'cached icons must skip procedural drawing');
assert.equal(imageCalls, 101);
api.drawBlockIcon(target, B.STONE, 10, 10, 40);
assert(paintCalls > firstPaint, 'new sizes must get their own image');
for (let size = 1; size <= 150; size++) api.drawBlockIcon(target, B.STONE, 0, 0, size);
assert.equal(api.cacheSize(), 128, 'icon cache must stay bounded');

const listeners = {};
context.window.addEventListener = (name, fn) => { (listeners[name] ||= []).push(fn); };
load('src/3d/input3d.js');
const input = Game.input3d.createInput3D({ addEventListener() {} }, () => state);
function key(type, extra = {}) { for (const fn of listeners[type] || []) fn({ code: 'KeyO', ...extra }); }
key('keydown');
assert(input.consumeActions().optimizationTogglePressed);
key('keydown', { repeat: true });
const held = input.consumeActions();
assert(!held.optimizationTogglePressed);
assert(!('hyperOptimizationTogglePressed' in held), 'hyper mode must be removed');
key('keyup');
key('keydown', { target: { tagName: 'INPUT' } });
assert(!input.consumeActions().optimizationTogglePressed);
key('keyup');
state.pause = { open: true };
key('keydown');
assert(!input.consumeActions().optimizationTogglePressed);
console.log('optimization: unchanged simulation/loading, visibility and icon caches, keyboard passed');
