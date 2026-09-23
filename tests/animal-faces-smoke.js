const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.set(x, y, z);
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  setScalar(value) {
    return this.set(value, value, value);
  }

  normalize() {
    const length = Math.hypot(this.x, this.y, this.z) || 1;
    return this.set(this.x / length, this.y / length, this.z / length);
  }
}

class Object3D {
  constructor() {
    this.children = [];
    this.userData = {};
    this.position = new Vector3();
    this.rotation = new Vector3();
    this.scale = new Vector3(1, 1, 1);
  }

  add(child) {
    this.children.push(child);
    child.parent = this;
  }
}

class Group extends Object3D {}

class Mesh extends Object3D {
  constructor(geometry, material) {
    super();
    this.geometry = geometry;
    this.material = material;
  }
}

class BoxGeometry {
  constructor(width, height, depth) {
    this.parameters = { width, height, depth };
  }
}

class MeshBasicMaterial {
  constructor(options) {
    this.color = options.color;
    this.isMeshBasicMaterial = true;
  }
}

const THREE = { Vector3, Group, Mesh, BoxGeometry, MeshBasicMaterial };
const context = {
  window: { CubDep: {} },
  console,
  Math,
  performance: { now: () => 1000 },
  THREE,
};
vm.createContext(context);

function loadScript(relativePath, injection = '') {
  let code = fs.readFileSync(path.join(root, relativePath), 'utf8');
  if (injection) code = code.replace(/\}\)\(\);\s*$/, `${injection}\n})();`);
  vm.runInContext(code, context, { filename: relativePath });
}

loadScript('src/3d/faces3d.js');

const Game = context.window.CubDep;
const supportedTypes = [
  'cat', 'dog', 'capybara', 'parrot',
  'sheep', 'boar', 'turtle', 'snake', 'goat', 'fish', 'fox', 'bear',
];

for (const type of supportedTypes) {
  const profile = Game.faces3d.getFaceProfile3D(type);
  assert(profile, `${type} must have a face profile`);
  assert(profile.eyeHeight > 0 && profile.eyeWidth > 0, `${type} eyes must have positive dimensions`);
  assert(profile.eyeDepth > 0 && profile.eyeDepth <= 0.035, `${type} eyes must stay thin instead of bulging`);
  assert(profile.pupilTravelX >= 0 && profile.pupilTravelY >= 0, `${type} pupil travel must be bounded`);
}
assert.strictEqual(Game.faces3d.getFaceProfile3D('dragon'), null, 'unknown animals must not receive an accidental face profile');

const first = Game.faces3d.getFaceAnimation3D('pet-musia', 12.345);
const repeated = Game.faces3d.getFaceAnimation3D('pet-musia', 12.345);
assert.deepStrictEqual(first, repeated, 'eye animation must be deterministic for the same animal and time');

for (const id of ['', 'pet-musia', 'mob-42']) {
  for (let sample = 0; sample <= 200; sample += 1) {
    const animation = Game.faces3d.getFaceAnimation3D(id, sample * 0.05);
    assert(Number.isFinite(animation.eyeOpen), 'eye openness must stay finite');
    assert(animation.eyeOpen >= 0 && animation.eyeOpen <= 1, 'eye openness must stay normalized');
    assert(animation.pupilX >= -1 && animation.pupilX <= 1, 'horizontal pupil motion must stay normalized');
    assert(animation.pupilY >= -1 && animation.pupilY <= 1, 'vertical pupil motion must stay normalized');
  }
}

const samples = Array.from({ length: 241 }, (_, index) => Game.faces3d.getFaceAnimation3D('pet-musia', index * 0.05));
assert(samples.some((sample) => sample.eyeOpen < 0.08), 'a sampled animal must fully blink');
assert(samples.some((sample) => sample.eyeOpen === 1), 'eyes must stay fully open between blinks');
assert(samples.some((sample) => Math.abs(sample.pupilX) + Math.abs(sample.pupilY) > 0.1), 'pupils must occasionally glance away');
assert(samples.some((sample) => sample.pupilX === 0 && sample.pupilY === 0), 'pupils must rest between glances');

const otherSamples = Array.from({ length: 241 }, (_, index) => Game.faces3d.getFaceAnimation3D('mob-boris', index * 0.05));
assert(
  samples.some((sample, index) => Math.abs(sample.eyeOpen - otherSamples[index].eyeOpen) > 0.2),
  'different animals must not blink in lockstep'
);

Game.blocks = { BLOCK: {}, BLOCK_COLORS: {} };
Game.constants3d = {
  EYE_HEIGHT: 1.58,
  CHUNK_SIZE: 16,
  CAMERA_FAR_CHUNKS: 9,
  CHUNK_MESH_REBUILD_TIME_BUDGET_MS: 1,
  CHUNK_MESH_REBUILD_MAX_TIME_BUDGET_MS: 2,
  getChunkRenderDistanceValue: () => 8,
};
Game.world3d = {
  getBlock3D: () => 0,
  getFluidLevel3D: () => 0,
  getGrassLevel3D: () => 0,
  isSolidBlock3D: () => false,
};
Game.ui3d = { drawUI3D: () => {} };

loadScript(
  'src/3d/renderer3d.js',
  'Game.__animalFaceTestApi = { addAnimalFace, updateAnimalFace };'
);

for (const type of supportedTypes) {
  const animal = new Group();
  const head = new Group();
  animal.add(head);
  Game.__animalFaceTestApi.addAnimalFace(animal, head, type);
  assert.strictEqual(animal.userData.faceEyes.length, 2, `${type} must receive two eyes`);
  for (const assembly of animal.userData.faceEyes) {
    assert(assembly.eye.geometry.parameters.width <= 0.035, `${type} eye geometry must remain thin`);
    assert(assembly.pupil, `${type} must receive a pupil`);
    assert(assembly.highlight, `${type} must receive an eye highlight`);
    assert.strictEqual(assembly.highlight.material.isMeshBasicMaterial, true, `${type} highlight must work without shaders`);
    assert.strictEqual(assembly.highlight.parent, assembly.pupil, `${type} highlight must follow pupil movement`);
  }
}

const sleepingBear = new Group();
const bearHead = new Group();
sleepingBear.add(bearHead);
Game.__animalFaceTestApi.addAnimalFace(sleepingBear, bearHead, 'bear');
Game.__animalFaceTestApi.updateAnimalFace(sleepingBear, 'sleeping-bear', 3, true);
assert(
  sleepingBear.userData.faceEyes.every((assembly) => assembly.group.scale.y <= 0.08),
  'a sleeping bear must keep its eyes closed'
);

console.log('animal faces smoke tests passed');
