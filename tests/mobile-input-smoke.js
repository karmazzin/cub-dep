const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function fakeEventTarget(extra = {}) {
  const listeners = new Map();
  return {
    ...extra,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    dispatch(type, event) {
      for (const listener of listeners.get(type) || []) listener(event);
    },
  };
}

const inputCanvas = fakeEventTarget({
  width: 780,
  height: 1688,
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 390, height: 844 };
  },
  setPointerCapture() {},
});
const hudCanvas = {
  width: 390,
  height: 844,
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 390, height: 844 };
  },
};
const windowTarget = fakeEventTarget({ CubDep: {} });
const documentTarget = fakeEventTarget({ pointerLockElement: null });
let now = 1000;
const context = {
  window: windowTarget,
  document: documentTarget,
  performance: { now: () => now },
  console,
  Map,
  Math,
};
vm.createContext(context);

const code = fs.readFileSync(path.join(root, 'src/3d/input3d.js'), 'utf8');
vm.runInContext(code, context, { filename: 'src/3d/input3d.js' });

const Game = context.window.CubDep;
const state = { pause: { open: false } };
Game.ui3d = {
  getMobileHudControl(surface, currentState, x, y) {
    assert.strictEqual(currentState, state);
    if (surface === hudCanvas && x === 350 && y === 34) return { type: 'pause' };
    return null;
  },
};

const input = Game.input3d.createInput3D(inputCanvas, () => state, hudCanvas);
inputCanvas.dispatch('pointerdown', {
  pointerId: 1,
  pointerType: 'touch',
  clientX: 350,
  clientY: 34,
  preventDefault() {},
});

assert.strictEqual(
  JSON.stringify(input.consumeUiActions()),
  JSON.stringify([{ type: 'pause' }]),
  'touch hit-testing should use the HUD canvas coordinate system when WebGL uses a larger backing buffer'
);

now = 2000;
inputCanvas.dispatch('mousedown', {
  button: 2,
  clientX: 195,
  clientY: 422,
  preventDefault() {},
});
let mouseActions = input.consumeActions();
assert.strictEqual(input.input.secondaryDown, true, 'right mouse down must remain observable for long pet interaction');
assert.strictEqual(mouseActions.placePressed, true, 'right mouse down must keep the existing place action');

windowTarget.dispatch('mouseup', { button: 2 });
mouseActions = input.consumeActions();
assert.strictEqual(input.input.secondaryDown, false, 'right mouse up must clear the held state');
assert.strictEqual(mouseActions.secondaryReleased, true, 'right mouse release must be consumed once by pet interaction');
assert.strictEqual(input.consumeActions().secondaryReleased, false, 'right mouse release must not repeat on later frames');

console.log('mobile input smoke tests passed');
