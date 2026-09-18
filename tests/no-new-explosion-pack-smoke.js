const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function fakeElement(extra = {}) {
  const listeners = {};
  return {
    innerHTML: '',
    hidden: false,
    classList: { toggle() {}, add() {}, remove() {} },
    addEventListener(type, listener) {
      listeners[type] = listener;
    },
    getContext() {
      return {};
    },
    querySelector() {
      return null;
    },
    listeners,
    ...extra,
  };
}

const elements = {
  game3d: fakeElement(),
  game3dOverlay: fakeElement(),
  menuRoot: fakeElement(),
  inventoryRoot: fakeElement(),
  mapRoot: fakeElement(),
};
const documentListeners = {};
const windowListeners = {};
const context = {
  console,
  performance: { now: () => 0 },
  requestAnimationFrame() {},
  document: {
    visibilityState: 'visible',
    pointerLockElement: null,
    getElementById(id) {
      return elements[id] || null;
    },
    addEventListener(type, listener) {
      documentListeners[type] = listener;
    },
  },
  window: {
    location: { protocol: 'http:', hostname: 'localhost', pathname: '/' },
    localStorage: { getItem: () => null, setItem() {} },
    addEventListener(type, listener) {
      windowListeners[type] = listener;
    },
    CubDep: {
      input3d: {
        createInput3D() {
          return { input: { keys: {} }, resetMovement() {} };
        },
      },
      constants3d: { normalizeChunkRenderDistance: (value) => value || 'auto' },
      state3d: { normalizePlayerSkin: (value) => (value === 'explorer_female' ? value : 'explorer') },
      easterEggs3d: {
        CAVERN_FALL_URL: '/Cavernfall/',
        activateCavernFallFromLocation: () => false,
        resolveCavernFallSelection: () => ({ easterEgg: '', cavernFallAxis: '' }),
      },
    },
  },
};
vm.createContext(context);

const mainPath = path.join(root, 'src/main3d.js');
const mainSource = fs.readFileSync(mainPath, 'utf8').replace(
  /\}\)\(\);\s*$/,
  'window.__newWorldTestApi = { createWorldMeta, renderUnifiedMenu };\n})();'
);
vm.runInContext(mainSource, context, { filename: 'src/main3d.js' });

context.window.__newWorldTestApi.renderUnifiedMenu('start', 'world-create');
assert(
  !elements.menuRoot.innerHTML.includes('explosionPackEnabled'),
  'new-world form should not offer the explosion pack'
);

const meta = context.window.__newWorldTestApi.createWorldMeta({
  name: 'Новый мир',
  seed: 'test-seed',
  mode: 'survival',
  chunkRenderDistance: 'auto',
  spawnBiome: 'any',
});
assert(
  !Object.prototype.hasOwnProperty.call(meta, 'explosionPackEnabled'),
  'new worlds should not store the retired explosion-pack flag'
);

const legacyContext = { window: { CubDep: {} }, console };
vm.createContext(legacyContext);
for (const relativePath of ['src/world/blocks.js', 'src/3d/constants3d.js', 'src/3d/world3d.js', 'src/3d/state3d.js']) {
  const code = fs.readFileSync(path.join(root, relativePath), 'utf8');
  vm.runInContext(code, legacyContext, { filename: relativePath });
}
const legacyState = legacyContext.window.CubDep.state3d.createGameState3D({
  mode: 'creative',
  explosionPackEnabled: true,
});
assert.strictEqual(
  legacyState.worldMeta.explosionPackEnabled,
  true,
  'old saves should retain explosion-pack support'
);

console.log('new-world explosion pack removal smoke tests passed');
