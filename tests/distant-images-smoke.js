const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const THREE = require('../vendor/three.min.js');
const context = { window: { CubDep: {} }, THREE };
vm.createContext(context);
for (const name of ['constants3d', 'distantImages3d']) vm.runInContext(fs.readFileSync(`${__dirname}/../src/3d/${name}.js`, 'utf8'), context);
const scene = new THREE.Scene();
const cache = context.window.CubDep.distantImages3d.create(scene);
const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 300);
camera.position.set(8, 40, 40);
camera.lookAt(8, 0, 8);
const state = { world: {}, player: { x: 8, z: 56 }, worldMeta: { superOptimization: true } };
const texture = new THREE.Texture();
const sources = [0, 1].map(cx => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(16, 10, 16), new THREE.MeshLambertMaterial({ map: texture }));
  mesh.position.set(cx * 16 + 8, 5, 8);
  mesh.updateMatrixWorld(true);
  return { cx, cz: 0, meshes: [mesh], ready: true };
});
let renderPasses = 0;
const renderer = {
  shadowMap: { enabled: false }, getRenderTarget: () => null, setRenderTarget() {},
  getClearColor: color => color.set(0), getClearAlpha: () => 1, setClearColor() {}, clear() {},
  render() { renderPasses++; },
};
cache.update(state, renderer, camera, sources, 0, []);
cache.update(state, renderer, camera, sources, 250, []);
assert.equal(cache.size(), 2);
assert.equal(renderPasses, 0, 'surface cache must not render flat screenshots');
const ray = new THREE.Raycaster();
scene.updateMatrixWorld(true);
for (const x of [0.01, 8, 15.999, 16.001, 24, 31.99]) {
  ray.set(new THREE.Vector3(x, 40, 8), new THREE.Vector3(0, -1, 0));
  const hits = ray.intersectObjects(scene.children, true);
  assert(hits.length, `terrain must cover x=${x}, including both sides of the seam`);
  assert(Math.abs(hits[0].point.y - 10) < 0.001, 'cached surface must retain actual height');
}
const oldObjects = scene.children.slice();
camera.position.set(-30, 60, -50);
camera.lookAt(16, 0, 8);
cache.update(state, renderer, camera, sources, 500, []);
assert.deepEqual(scene.children, oldObjects, 'rotating or flying must not replace/reorient surfaces');
scene.traverse(object => {
  if (!object.isMesh) return;
  assert.equal(object.material.map, texture);
  assert(object.material.isMeshBasicMaterial);
  assert(!object.castShadow);
  assert(!object.geometry.getAttribute('normal'), 'cached geometry drops lighting attributes');
  assert.notEqual(object.geometry, sources[0].meshes[0].geometry);
});
cache.invalidate(0, 0);
sources[0].ready = false;
cache.update(state, renderer, camera, sources, 750, []);
assert(cache.hasColumn(0, 0), 'invalidation must preserve fallback until replacement exists');
state.player.z = 8;
cache.update(state, renderer, camera, sources, 1000, []);
assert(scene.children.some(object => object.visible), 'pending near mesh must keep its fallback');
sources[0].ready = true;
cache.update(state, renderer, camera, sources, 1250, []);
assert(scene.children.every(object => !object.visible), 'complete near geometry takes over atomically');
let disposed = 0;
let textureDisposed = 0;
texture.addEventListener('dispose', () => textureDisposed++);
scene.traverse(object => { if (object.isMesh) object.geometry.addEventListener('dispose', () => disposed++); });
state.world = {};
cache.update(state, renderer, camera, [], 1500, []);
assert.equal(cache.size(), 0);
assert(disposed > 0);
assert.equal(textureDisposed, 0, 'shared terrain atlas is not owned by the cache');
for (let cx = 0; cx < 40; cx++) {
  state.player.x = cx * 16 + 8;
  cache.update(state, renderer, camera, [{ ...sources[0], cx }], 2000 + cx * 250, []);
}
assert(cache.size() <= 32);
cache.clear();
assert.equal(scene.children.length, 0);
console.log('terrain surface seams, height, camera independence, atomic fallback and resource disposal passed');
