const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = {
  window: { CubDep: {} },
  console,
  Date,
  Math,
  performance: { now: () => 1000 },
};
vm.createContext(context);

const code = fs.readFileSync(path.join(root, 'src/3d/pets3d.js'), 'utf8');
vm.runInContext(code, context, { filename: 'src/3d/pets3d.js' });

const Game = context.window.CubDep;

function createState(savedPets = []) {
  return {
    worldMeta: { pets: savedPets },
    world: { w: 64, h: 32, d: 64 },
    player: { x: 20.5, y: 4, z: 20.5, yaw: 0, onGround: true },
    entities: { pets: [] },
    ui: {},
  };
}

{
  const state = createState();
  const empty = Game.pets3d.createPet3D(state, 'cat', '   ');
  assert.strictEqual(empty.ok, false, 'an empty pet name must be rejected');
  assert.strictEqual(state.worldMeta.pets.length, 0, 'a rejected pet must not enter the collection');

  const unknown = Game.pets3d.createPet3D(state, 'dragon', 'Искорка');
  assert.strictEqual(unknown.ok, false, 'an unknown pet type must be rejected');
}

{
  const state = createState();
  state.player.onGround = false;
  const created = Game.pets3d.createPet3D(state, 'dog', 'Шарик');
  assert.strictEqual(created.ok, false, 'creating a pet while airborne must be rejected');
  assert.strictEqual(created.error, 'Сначала приземлитесь — питомец испугается высоты', 'airborne creation must explain why it was rejected');
  assert.strictEqual(state.worldMeta.pets.length, 0, 'airborne creation must not change the collection');

  state.worldMeta.pets.push({ id: 'hidden-cat', type: 'cat', name: 'Муся', active: false, mode: 'follow' });
  state.ui.petsNormalized = false;
  const resumed = Game.pets3d.resumePet3D(state, 'hidden-cat');
  assert.strictEqual(resumed.ok, false, 'resuming a pet while airborne must be rejected');
  assert.strictEqual(resumed.error, 'Сначала приземлитесь — питомец испугается высоты', 'airborne resume must explain why it was rejected');
  assert.strictEqual(Game.pets3d.ensurePets3D(state)[0].active, false, 'airborne resume must keep the pet hidden');
}

{
  const state = createState();
  const types = ['cat', 'dog', 'capybara', 'parrot', 'cat', 'dog'];
  const names = ['Муся', 'Шарик', 'Булочка', 'Кеша', 'Соня', 'Бим'];
  const created = types.map((type, index) => Game.pets3d.createPet3D(state, type, names[index]));

  assert.strictEqual(created.every((result) => result.ok), true, 'the collection must accept every supported pet type');
  assert.strictEqual(state.worldMeta.pets.length, 6, 'the saved collection must be unlimited by the active cap');
  assert.strictEqual(state.worldMeta.pets.filter((pet) => pet.active).length, 5, 'only five pets may be active at once');
  assert.strictEqual(created[5].pet.active, false, 'a pet created after the active cap must stay in the collection');
  assert.strictEqual(state.entities.pets, state.worldMeta.pets, 'runtime pets and saved pets must share the serializable records');

  const first = created[0].pet;
  assert.strictEqual(Game.pets3d.hidePet3D(state, first.id), true, 'left-click behavior must be able to hide an active pet');
  assert.strictEqual(first.active, false, 'hiding must keep the pet but mark it inactive');
  assert.strictEqual(Game.pets3d.resumePet3D(state, created[5].pet.id).ok, true, 'an inactive pet must resume after a slot is freed');
  assert.strictEqual(created[5].pet.active, true, 'resuming must reactivate the same named record');
  assert.strictEqual(created[5].pet.name, 'Бим', 'resuming must preserve the pet name');

  assert.strictEqual(Game.pets3d.setPetMode3D(state, created[5].pet.id, 'wait'), true, 'wait is a supported pet mode');
  assert.strictEqual(created[5].pet.mode, 'wait', 'the selected mode must be stored on the pet');
  assert.strictEqual(Game.pets3d.setPetMode3D(state, created[5].pet.id, 'attack'), false, 'unsupported modes must be rejected');
  assert.strictEqual(created[5].pet.mode, 'wait', 'a rejected mode must not change the pet');

  const view = Game.pets3d.getPetsViewModel3D(state);
  assert.strictEqual(view.activeCount, 5, 'the pet menu must report the active count');
  assert.strictEqual(view.maxActive, 5, 'the pet menu must report the active limit');
  const hiddenCard = view.pets.find((pet) => pet.id === first.id);
  assert.strictEqual(hiddenCard.actionLabel, 'Продолжить играть с питомцем Муся', 'an inactive pet must have a named resume action');
  assert.strictEqual(hiddenCard.canResume, false, 'resume actions must be blocked while five pets are active');
  const activeCard = view.pets.find((pet) => pet.id === created[1].pet.id);
  assert.strictEqual(activeCard.actionLabel, 'Убрать Шарик в Переноску', 'an active pet must have a named carrier action');
  assert.strictEqual(activeCard.canHide, true, 'an active pet must be removable through the pet menu');
}

{
  const state = createState([{
    id: 'saved-parrot',
    type: 'parrot',
    name: '  Кеша  ',
    active: true,
    mode: 'wander',
    x: 4,
    y: 5,
    z: 6,
    yaw: 1,
    recording: true,
    audio: 'must-not-survive',
  }]);
  const pets = Game.pets3d.ensurePets3D(state);
  assert.strictEqual(pets.length, 1, 'a saved supported pet must be restored');
  assert.strictEqual(pets[0].name, 'Кеша', 'restored names must be normalized');
  assert.strictEqual(pets[0].mode, 'wander', 'a supported saved mode must be preserved');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(pets[0], 'audio'), false, 'recorded audio must never survive in saved pet data');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(pets[0], 'recording'), false, 'recording state must remain transient');
}

{
  const saved = [{ id: 'same-ref', type: 'cat', name: '  Муся  ', active: true, audio: 'bad' }];
  const state = createState(saved);
  state.entities.pets = state.worldMeta.pets;
  const pets = Game.pets3d.ensurePets3D(state);
  assert.strictEqual(pets[0].name, 'Муся', 'state restoration must normalize pets even when runtime and world metadata initially share an array');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(pets[0], 'audio'), false, 'same-reference restoration must still discard transient audio');
}

{
  const followState = createState([{
    id: 'follower', type: 'dog', name: 'Шарик', active: true, mode: 'follow',
    x: 10.5, y: 4, z: 10.5, yaw: 0,
  }]);
  Game.pets3d.ensurePets3D(followState);
  const before = Math.hypot(
    followState.entities.pets[0].x - followState.player.x,
    followState.entities.pets[0].z - followState.player.z
  );
  Game.pets3d.updatePets3D(followState, { secondaryDown: false }, {}, 0.5);
  const after = Math.hypot(
    followState.entities.pets[0].x - followState.player.x,
    followState.entities.pets[0].z - followState.player.z
  );
  assert.strictEqual(after < before, true, 'a following pet must move closer to a distant player');

  const waiting = followState.entities.pets[0];
  waiting.mode = 'wait';
  const waitX = waiting.x;
  const waitZ = waiting.z;
  Game.pets3d.updatePets3D(followState, { secondaryDown: false }, {}, 0.5);
  assert.strictEqual(waiting.x, waitX, 'a waiting pet must not move horizontally');
  assert.strictEqual(waiting.z, waitZ, 'a waiting pet must not move horizontally');
}

{
  const state = createState([{
    id: 'aimed-cat', type: 'cat', name: 'Муся', active: true, mode: 'wait',
    x: 20.5, y: 4, z: 22.5, yaw: 0,
  }]);
  state.player.pitch = -0.5;
  Game.pets3d.ensurePets3D(state);
  const actions = { breakPressed: true, placePressed: false, secondaryReleased: false };
  const input = { primaryDown: true, secondaryDown: false };
  Game.pets3d.updatePets3D(state, input, actions, 0.016);
  assert.strictEqual(state.entities.pets[0].active, false, 'left-clicking an aimed pet must hide it instead of damaging it');
  assert.strictEqual(actions.breakPressed, false, 'a pet left-click must consume the attack/mining action');
  assert.strictEqual(input.primaryDown, false, 'hiding a pet must stop held mining');
}

{
  Game.world3d = {
    getBlock3D(state, x, y, z) {
      if (y <= 3) return 1;
      if (z === 21 && y === 4) return 1;
      return 0;
    },
    isSolidBlock3D(id) {
      return id === 1;
    },
  };
  const state = createState([{
    id: 'jumping-dog', type: 'dog', name: 'Шарик', active: true, mode: 'follow',
    x: 20.5, y: 4, z: 20.5, yaw: 0,
  }]);
  state.player.z = 24.5;
  state.player.pitch = 0;
  Game.pets3d.ensurePets3D(state);
  let maxY = state.entities.pets[0].y;
  for (let frame = 0; frame < 30; frame += 1) {
    Game.pets3d.updatePets3D(state, { secondaryDown: false }, {}, 0.05);
    maxY = Math.max(maxY, state.entities.pets[0].y);
  }
  assert.strictEqual(maxY >= 5, true, 'a following pet must jump onto a one-block obstacle');
  assert.strictEqual(state.entities.pets[0].z > 21.5, true, 'a following pet must continue past a one-block obstacle');
}

{
  Game.world3d = {
    getBlock3D(state, x, y, z) {
      if (y <= 3) return 1;
      if (z === 21 && y >= 4 && y <= 6) return 1;
      return 0;
    },
    isSolidBlock3D(id) {
      return id === 1;
    },
  };
  const state = createState([{
    id: 'stuck-capybara', type: 'capybara', name: 'Плюша', active: true, mode: 'follow',
    x: 20.5, y: 4, z: 20.5, yaw: 0,
  }]);
  state.player.z = 24.5;
  state.player.pitch = 0;
  Game.pets3d.ensurePets3D(state);
  for (let frame = 0; frame < 80; frame += 1) {
    Game.pets3d.updatePets3D(state, { secondaryDown: false }, {}, 0.05);
  }
  const pet = state.entities.pets[0];
  const distance = Math.hypot(pet.x - state.player.x, pet.z - state.player.z);
  assert.strictEqual(distance < 3, true, 'a following pet that stays blocked must catch up beside the player');
}

console.log('pets smoke tests passed');
