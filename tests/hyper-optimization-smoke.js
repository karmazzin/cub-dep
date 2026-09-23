const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const THREE = require('../vendor/three.min.js');
const fills = [];
const ctx = { fillRect(x, y, w, h) { fills.push([this.fillStyle, x, y, w, h]); } };
const context = {
  window: { CubDep: {}, THREE }, THREE,
  document: { createElement: () => ({ getContext: () => ctx }) },
};
vm.createContext(context);
for (const file of ['src/world/blocks.js', 'src/3d/constants3d.js', 'src/3d/world3d.js']) {
  vm.runInContext(fs.readFileSync(file, 'utf8'), context);
}
const Game = context.window.CubDep;
Game.ui3d = {};
let code = fs.readFileSync('src/3d/renderer3d.js', 'utf8');
code = code.replace(/\}\)\(\);\s*$/, `
  textureAtlas = new THREE.Texture();
  waterTexture = new THREE.Texture();
  lavaTexture = new THREE.Texture();
  atlasMeta = { columns: 16, rows: 2 };
  atlasEntries = new Map([[BLOCK.GRASS + ':top:0', {col: 0, row: 0}], [BLOCK.DIRT + ':side:0', {col: 1, row: 0}]]);
  solidMaterial = new THREE.MeshBasicMaterial({map: textureAtlas});
  waterMaterial = new THREE.MeshBasicMaterial({map: waterTexture});
  lavaMaterial = new THREE.MeshBasicMaterial({map: lavaTexture});
  shaderSolidMaterial = shaderWaterMaterial = shaderLavaMaterial = new THREE.MeshBasicMaterial();
  Game.hyperTest = { applyHyperProfile, solidMaterial, waterMaterial, lavaMaterial, textureAtlas, waterTexture, lavaTexture };
})();`);
vm.runInContext(code, context);
const api = Game.hyperTest;
const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), api.solidMaterial);
const geometry = mesh.geometry;
const state = { worldMeta: { superOptimization: true, hyperOptimization: true } };
api.applyHyperProfile(state);
assert.notStrictEqual(api.solidMaterial.map, api.textureAtlas);
assert.equal(api.solidMaterial.map.image.width, 16);
assert.deepStrictEqual(fills.map(fill => fill[0]), ['#5c9a2c', '#785236']);
assert.strictEqual(api.waterMaterial.map, null);
assert.strictEqual(api.lavaMaterial.map, null);
assert.strictEqual(mesh.geometry, geometry, 'hyper mode must preserve exact block geometry');
const flat = api.solidMaterial.map;
const version = api.solidMaterial.version;
api.applyHyperProfile(state);
assert.equal(api.solidMaterial.version, version, 'steady mode must not recompile materials');
state.worldMeta.hyperOptimization = false;
api.applyHyperProfile(state);
assert.strictEqual(api.solidMaterial.map, api.textureAtlas);
assert.strictEqual(api.waterMaterial.map, api.waterTexture);
assert.strictEqual(api.lavaMaterial.map, api.lavaTexture);
state.worldMeta.hyperOptimization = true;
api.applyHyperProfile(state);
assert.strictEqual(api.solidMaterial.map, flat, 'palette must be reused');
state.worldMeta.superOptimization = false;
api.applyHyperProfile(state);
assert.strictEqual(api.solidMaterial.map, api.textureAtlas, 'disabling optimization restores textures');
console.log('hyper optimization palette, geometry and restoration checks passed');
