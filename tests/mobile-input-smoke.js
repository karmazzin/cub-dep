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

// Exercise real HUD hit regions with the WebGL/HUD size mismatch above.
vm.runInContext(fs.readFileSync(path.join(root, 'src/3d/ui3d.js'), 'utf8'), context);
state.ui = {};
state.player = { selectedHotbarIndex: 0 };
state.worldMeta = {};
Game.inventory3d = { ensureHotbar: () => new Array(10).fill(null) };
for (const [width, height] of [[320, 568], [390, 844], [844, 390]]) {
  windowTarget.matchMedia = () => ({ matches: true });
  hudCanvas.width = width;
  hudCanvas.height = height;
  for (const [x, y, field] of [
    [width - 152, 34, 'optimizationTogglePressed'],
    [width - 150, height - 92, 'repairPressed'],
  ]) {
    inputCanvas.dispatch('pointerdown', {
      pointerId: 2, pointerType: 'touch', clientX: x, clientY: y, preventDefault() {},
    });
    assert.strictEqual(input.consumeActions()[field], true, `${field} must work at ${width}x${height}`);
    assert.strictEqual(input.consumeActions()[field], false, 'holding must not retrigger a tap');
    inputCanvas.dispatch('pointermove', {
      pointerId: 2, pointerType: 'touch', clientX: x + 10, clientY: y + 10, preventDefault() {},
    });
    assert.strictEqual(input.input.mouseDx, 0, 'button gestures must not turn the camera');
    windowTarget.dispatch('pointerup', { pointerId: 2, pointerType: 'touch' });
  }
}
state.pause.open = true;
inputCanvas.dispatch('pointerdown', {
  pointerId: 3, pointerType: 'touch', clientX: 692, clientY: 34, preventDefault() {},
});
assert.strictEqual(input.consumeActions().optimizationTogglePressed, false, 'pause must block optimization taps');
console.log('real mobile HUD: optimization and repair touch controls passed');

state.pause.open = false;
hudCanvas.width = 390;
hudCanvas.height = 844;
state.worldMeta.mode = 'creative';
function jumpTap() {
  inputCanvas.dispatch('pointerdown', { pointerId: 4, pointerType: 'touch', clientX: 344, clientY: 638, preventDefault() {} });
  windowTarget.dispatch('pointerup', { pointerId: 4, pointerType: 'touch' });
  now += 120;
  return input.consumeActions();
}
assert(!jumpTap().flyTogglePressed, 'single jump tap must not toggle flight');
assert(jumpTap().flyTogglePressed, 'double jump tap must toggle flight');
assert(!jumpTap().flyTogglePressed, 'third tap must begin a new pair');
assert(jumpTap().flyTogglePressed, 'second pair must allow flight to turn off');
state.worldMeta.mode = 'survival';
assert(!jumpTap().flyTogglePressed);
assert(!jumpTap().flyTogglePressed, 'survival double taps must not request flight');
state.worldMeta.mode = 'creative';
now += 1000;
assert(!jumpTap().flyTogglePressed);
input.resetMovement();
assert(!jumpTap().flyTogglePressed, 'menus must clear pending double taps');
console.log('mobile double jump flight gesture passed');

for (const [width, height] of [[320, 568], [390, 844], [844, 390]]) {
  hudCanvas.width = width; hudCanvas.height = height;
  inputCanvas.dispatch('pointerdown', { pointerId: 8, pointerType: 'touch', clientX: width - 148, clientY: height - 252, preventDefault() {} });
  const use = input.consumeActions();
  assert(use.usePressed, 'dedicated mobile use control should work in both orientations');
  assert(!use.placePressed, 'use must not request placement');
  assert(!input.consumeActions().usePressed, 'use must fire once per tap');
  windowTarget.dispatch('pointerup', { pointerId: 8 });
}
console.log('mobile use control passed');
hudCanvas.width = 390; hudCanvas.height = 844;
inputCanvas.dispatch('pointerdown', { pointerId: 9, pointerType: 'touch', clientX: 308, clientY: 720, preventDefault() {} });
assert(input.input.primaryDown, 'touch mining must start the normal mining action');
windowTarget.dispatch('pointercancel', { pointerId: 9 });
assert(!input.input.primaryDown, 'cancelling touch must stop mining');
inputCanvas.dispatch('pointerdown', { pointerId: 10, pointerType: 'touch', clientX: 242, clientY: 666, preventDefault() {} });
assert(input.consumeActions().mobilePlace, 'touch placement must use the placement-only path');
assert(!input.consumeActions().mobilePlace);
input.resetMovement();
assert(!input.consumeActions().usePressed);
