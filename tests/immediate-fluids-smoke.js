const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const context = { window: { CubDep: {} }, console };
vm.createContext(context);
for (const file of ['world/blocks', '3d/constants3d', '3d/world3d', '3d/fluids3d', '3d/interaction3d']) {
  let code = fs.readFileSync(`${__dirname}/../src/${file}.js`, 'utf8');
  if (file.endsWith('interaction3d')) code = code.replace(/\}\)\(\);\s*$/, 'Game.placementTest = { placeBlockAt };\n})();');
  vm.runInContext(code, context);
}
const G = context.window.CubDep;
const B = G.blocks.BLOCK;
G.generation3d = { getBiomeAt3D: () => 'volcanic', isVolcanoVentCell3D: () => true };
for (const enabled of [false, true]) {
  for (const id of [B.WATER, B.LAVA, B.VOLCANIC_LAVA]) {
    const s = { world: G.world3d.createWorld3D(48, 16, 48), worldMeta: { superOptimization: enabled }, player: { x: 2, y: 1, z: 2 }, ui: {} };
    s.world.allowChunkCreationWrites = 1;
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) G.world3d.setBlock3D(s, x, 0, z, B.STONE);
    s.fluids3d = { accumulator: 0, geysers: new Map(), active: new Set() };
    for (let x = 16; x < 48; x++) for (let z = 16; z < 48; z++) s.fluids3d.active.add(`${x},0,${z}`);
    assert(G.placementTest.placeBlockAt(s, id, id, null, false, 8, 1, 8));
    assert.equal(G.world3d.getStoredBlock3D(s, 9, 1, 8), enabled ? B.AIR : id, 'placement must start flowing immediately despite a busy queue');
    assert(s.fluids3d.active.has('47,0,47'), 'local step must preserve pending distant work');
  }
}
console.log('immediate water/lava/volcanic placement with backlog and optimization exclusion passed');
