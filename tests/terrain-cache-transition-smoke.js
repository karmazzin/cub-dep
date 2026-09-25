const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const THREE = require('../vendor/three.min.js');
let now = 0;
const context = { window: { CubDep: {}, THREE }, THREE, console, performance: { now: () => now } };
vm.createContext(context);
function load(file, extra = '') {
  let code = fs.readFileSync(`${__dirname}/../src/${file}.js`, 'utf8');
  if (extra) code = code.replace(/\}\)\(\);\s*$/, `${extra}\n})();`);
  vm.runInContext(code, context);
}
for (const file of ['world/blocks', '3d/constants3d', '3d/world3d', '3d/distantImages3d']) load(file);
const G = context.window.CubDep;
G.ui3d = { drawUI3D() {} };
load('3d/renderer3d', `Game.transitionTest = {
  updateDirtyChunks, updateDistantImages, updateChunkVisibility,
  fixture: (s, c) => {
    scene = s; camera = c; renderer = {}; optimizationEnabled = true;
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    solidMaterial = shaderSolidMaterial = waterMaterial = shaderWaterMaterial = lavaMaterial = shaderLavaMaterial = material;
    atlasMeta = { tileSize: 32, width: 512, height: 512, variants: 1 };
    atlasEntries = new Map();
  },
  liveCount: () => chunkMeshes.size,
  one: state => {
    enqueueDirtyChunkMeshes(state);
    const task = meshRebuildQueue.shift();
    meshRebuildQueued.delete(task.taskKey);
    setChunkMesh(state, task.cx, task.cy, task.cz, task.mode);
  },
  cached: () => distantImages,
};`);
const api = G.transitionTest;
const scene = new THREE.Scene();
api.fixture(scene, new THREE.PerspectiveCamera());
const s = { world: G.world3d.createWorld3D(64, 48, 64), player: { x: 40, y: 20, z: 8 }, worldMeta: { superOptimization: true }, ui: {} };
s.world.allowChunkCreationWrites = 1;
const B = G.blocks.BLOCK;
G.world3d.setBlock3D(s, 8, 1, 8, B.STONE);
G.world3d.setBlock3D(s, 8, 17, 8, B.STONE);
api.updateDirtyChunks(s);
assert.equal(api.liveCount(), 2);
api.updateChunkVisibility(s);
assert(scene.children.every(mesh => mesh.visible), 'live fallback must show before caching');
api.updateDistantImages(s);
assert.equal(api.liveCount(), 0, 'live column released only after successful caching');
function heights() {
  scene.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(8.5, 47, 8.5), new THREE.Vector3(0, -1, 0));
  return ray.intersectObjects(scene.children, true).map(hit => hit.point.y);
}
assert(heights().includes(2) && heights().includes(18));
// Edit only the upper vertical chunk after both live chunks were released.
G.world3d.setBlock3D(s, 8, 18, 8, B.STONE);
api.updateDirtyChunks(s);
assert.equal(api.liveCount(), 2, 'refresh must reconstruct all vertical chunks');
now = 250;
api.updateDistantImages(s);
assert.equal(api.liveCount(), 0);
assert(heights().includes(2), 'lower surface must survive an upper-only edit');
assert(heights().includes(19));
// Streaming completion is part of readiness, not merely mesh queue completion.
G.world3d.setBlock3D(s, 8, 19, 8, B.STONE);
s.world.chunkLoading = { queue: [{ cx: 0, cy: 2, cz: 0 }], pendingIds: new Map(), loadingSaved: new Set() };
api.updateDirtyChunks(s);
now = 500;
api.updateDistantImages(s);
assert.equal(api.liveCount(), 2, 'generation pending must retain source meshes');
assert(!api.cached().isCurrent(0, 0));
s.world.chunkLoading.queue = [];
G.world3d.setBlock3D(s, 8, 33, 8, B.STONE);
api.updateDirtyChunks(s);
now = 750;
api.updateDistantImages(s);
assert.equal(api.liveCount(), 0);
assert(heights().includes(2) && heights().includes(20) && heights().includes(34));
// Leaving mid-rebuild must not replace a complete cache with partial geometry.
G.world3d.setBlock3D(s, 8, 34, 8, B.STONE);
api.one(s);
for (let cy = 0; cy < 3; cy++) G.world3d.removeChunk3D(s, 0, cy, 0, { clearModified: true });
s.player.x = 56;
api.updateDirtyChunks(s);
now = 1000;
api.updateDistantImages(s);
assert(heights().includes(2), 'unloading during reconstruction must retain the complete old surface');
assert(!api.cached().isCurrent(0, 0));
// No timed deletion if the cache cannot accept the replacement.
api.cached().clear();
G.world3d.setBlock3D(s, 8, 34, 8, B.STONE);
api.updateDirtyChunks(s);
s.world.chunkLoading.queue = [{ cx: 0, cy: 2, cz: 0 }];
now = 10000;
api.updateDistantImages(s);
api.updateChunkVisibility(s);
assert(api.liveCount() > 0);
assert(scene.children.some(object => object.visible && object.isMesh));
console.log('renderer cache handoff, vertical column rebuild and streaming readiness passed');
