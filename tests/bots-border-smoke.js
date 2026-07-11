const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = {
  window: { CubDep: {} },
  Math,
  Date,
  console,
};
vm.createContext(context);

function loadScript(relativePath) {
  const code = fs.readFileSync(path.join(root, relativePath), 'utf8');
  vm.runInContext(code, context, { filename: relativePath });
}

loadScript('src/world/blocks.js');

const Game = context.window.CubDep;
const { BLOCK } = Game.blocks;

assert.strictEqual(
  Game.blocks.BREAK_TIME[BLOCK.BORDER],
  Game.blocks.BREAK_TIME[BLOCK.DRY_BUSH],
  'BORDER should break like DRY_BUSH'
);

Game.world3d = {
  inBounds3D(world, x, y, z) {
    return x >= 0 && x < world.w && y >= 0 && y < world.h && z >= 0 && z < world.d;
  },
  getBlock3D(state, x, y, z) {
    if (!Game.world3d.inBounds3D(state.world, x, y, z)) return BLOCK.BEDROCK;
    const key = `${x},${y},${z}`;
    if (state.world.blocks && Object.prototype.hasOwnProperty.call(state.world.blocks, key)) return state.world.blocks[key];
    return y === 0 ? BLOCK.STONE : BLOCK.AIR;
  },
  setBlock3D(state, x, y, z, id) {
    if (!state.world.blocks) state.world.blocks = {};
    state.world.blocks[`${x},${y},${z}`] = id;
    return true;
  },
  isSolidBlock3D(id) {
    return id !== BLOCK.AIR
      && id !== BLOCK.WATER
      && id !== BLOCK.HOT_WATER
      && id !== BLOCK.LAVA
      && id !== BLOCK.DRY_BUSH
      && id !== BLOCK.ALGAE
      && id !== BLOCK.TALL_ALGAE
      && id !== BLOCK.ACTIVE_STRANGE_PORTAL;
  },
};

Game.generation3d = {
  getCaveEntrancesInArea3D() {
    return [{ x: 20, z: 20, startY: 5, endX: 22, endY: 4, endZ: 22, type: 'through' }];
  },
  getVillages3D(state) {
    return state.world.testVillages || [];
  },
  getPortalRuins3D(state) {
    return state.world.testPortalRuins || [];
  },
  getBearDens3D(state) {
    return state.world.testBearDens || [];
  },
  getWorldSpawn3D(state) {
    return state.world.testSpawn || null;
  },
};

loadScript('src/3d/bots3d.js');

Game.constants3d = {
  EYE_HEIGHT: 1.62,
  PLAYER_HEIGHT: 1.8,
  PLAYER_RADIUS: 0.3,
  REACH_DISTANCE: 6,
};
loadScript('src/3d/interaction3d.js');
loadScript('src/3d/inventory3d.js');

assert(
  Game.bots3d.BOT_BLUEPRINTS.some((bot) => bot.id === 'blaster'),
  'bot profiles should include the new blaster profile'
);
assert(
  Game.bots3d.MAX_CONNECTED_BOTS >= Game.bots3d.BOT_BLUEPRINTS.length * 3,
  'bot worlds should allow several bots with the same primary profile'
);
assert.strictEqual(
  Game.bots3d.BUILD_VARIANTS.length,
  100,
  'builder should have exactly 100 structure variants'
);
assert(
  Game.bots3d.BUILD_VARIANTS.includes('plan_99'),
  'builder structure list should include the hundredth generated plan'
);
const botEggRoles = Object.values(Game.interaction3d.BOT_SPAWN_EGG_ROLES);
for (const role of ['builder', 'explorer', 'digger', 'hunter', 'gatherer', 'miner', 'blaster']) {
  assert(
    botEggRoles.includes(role),
    `creative bot spawn eggs should include the ${role} role`
  );
}
for (const eggId of Object.keys(Game.interaction3d.BOT_SPAWN_EGG_ROLES).map(Number)) {
  assert(
    Game.interaction3d.CREATIVE_ITEMS.includes(eggId),
    `creative inventory should include bot spawn egg ${eggId}`
  );
}
const botEggInventoryState = {
  player: {
    inventory: [{ id: Game.interaction3d.ITEM.BUILDER_BOT_SPAWN_EGG, count: 7 }],
    hotbar: [],
  },
  worldMeta: { mode: 'creative' },
};
Game.inventory3d.ensureInventory(botEggInventoryState);
assert.strictEqual(
  botEggInventoryState.player.inventory[0].id,
  Game.interaction3d.ITEM.BUILDER_BOT_SPAWN_EGG,
  'bot spawn eggs should not disappear when normalized inside the player inventory'
);
assert.strictEqual(
  botEggInventoryState.player.inventory[0].count,
  7,
  'bot spawn egg stacks should keep their count in the player inventory'
);
const creativeItems = Game.interaction3d.CREATIVE_ITEMS;
const lastMobEggIndex = creativeItems.indexOf(Game.interaction3d.ITEM.POLAR_BEAR_SPAWN_EGG);
assert.strictEqual(
  creativeItems[lastMobEggIndex + 1],
  Game.interaction3d.ITEM.BUILDER_BOT_SPAWN_EGG,
  'bot spawn eggs should appear directly after mob spawn eggs in the creative inventory'
);
const firstLetterIndex = creativeItems.findIndex((id) => Game.blocks.LETTER_BLOCKS && Game.blocks.LETTER_BLOCKS[id]);
assert(
  firstLetterIndex > creativeItems.indexOf(Game.interaction3d.ITEM.BLASTER_BOT_SPAWN_EGG),
  'letter blocks should come after the mob and bot spawn egg groups'
);

const state = {
  world: { w: 16, h: 10, d: 16 },
  worldMeta: { botsEnabled: true, mode: 'survival' },
  player: { x: 8.5, y: 10, z: 8.5 },
  entities: {
    bots: [{
      id: 'bot-test',
      name: 'Test',
      role: 'explorer',
      x: 8.5,
      y: 10,
      z: 8.5,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      onGround: false,
      memory: { baseX: 8.5, baseY: 10, baseZ: 8.5 },
      goal: { type: 'wander', target: { x: 10, z: 8 }, stage: 0 },
      thinkTimer: 1,
      actionTimer: 1,
      lookTimer: 1,
      jumpTimer: 1,
      restlessness: 0.5,
      caution: 0.5,
    }],
  },
};

Game.bots3d.updateBots3D(state, 0.1);

assert(
  state.entities.bots[0].y < state.world.h,
  `survival bot should start falling from world top, got y=${state.entities.bots[0].y}`
);

const joiningState = {
  world: { w: 16, h: 10, d: 16 },
  worldMeta: { botsEnabled: true, mode: 'survival', botNextBlueprintIndex: 4 },
  player: { x: 8.5, y: 10, z: 8.5 },
  entities: { bots: [] },
};

Game.bots3d.updateBots3D(joiningState, 0.1);
assert.strictEqual(
  joiningState.entities.bots.length,
  1,
  'bots world should start with one connected bot'
);
assert.strictEqual(
  joiningState.entities.bots[0].role,
  'builder',
  'the first connected bot should always be the builder-primary profile'
);

joiningState.worldMeta.botJoinTimer = 0;
Game.bots3d.updateBots3D(joiningState, 0.1);
assert.strictEqual(
  joiningState.entities.bots.length,
  2,
  'a new bot should be able to join after the first one'
);
assert(
  Math.hypot(joiningState.entities.bots[1].x - joiningState.entities.bots[0].x, joiningState.entities.bots[1].z - joiningState.entities.bots[0].z) > 1.25,
  'joined bots should spawn visibly away from the first bot instead of inside it'
);
assert(
  joiningState.entities.bots[1].y < joiningState.world.h - 1,
  'joined bots should spawn at a visible world height, not above the world top'
);
for (let i = 0; i < Game.bots3d.BOT_BLUEPRINTS.length; i += 1) {
  joiningState.worldMeta.botJoinTimer = 0;
  joiningState.worldMeta.botLeaveTimer = 999;
  Game.bots3d.updateBots3D(joiningState, 0.1);
}
assert(
  joiningState.entities.bots.filter((bot) => bot.role === 'builder').length >= 2,
  'connected bot profiles should repeat so one world can have multiple builders'
);

const eggSpawnState = {
  world: { w: 20, h: 12, d: 20 },
  worldMeta: { botsEnabled: false, mode: 'creative' },
  player: { x: 10.5, y: 4, z: 10.5 },
  entities: { bots: [] },
};
Game.bots3d.spawnBot3D(eggSpawnState, 'builder', 10, 2, 10);
Game.bots3d.spawnBot3D(eggSpawnState, 'builder', 10, 2, 10);
Game.bots3d.spawnBot3D(eggSpawnState, 'builder', 10, 2, 10);
assert.strictEqual(
  eggSpawnState.entities.bots.filter((bot) => bot.role === 'builder').length,
  3,
  'bot spawn eggs should be able to create several bots with the same profile'
);
eggSpawnState.entities.bots[0].goal = null;
eggSpawnState.entities.bots[0].thinkTimer = 0;
Game.bots3d.updateBots3D(eggSpawnState, 0.1);
assert(
  eggSpawnState.entities.bots[0].goal,
  'spawned bots should keep updating even when the world was not created with botsEnabled'
);

const botHealthState = {
  world: { w: 20, h: 12, d: 20 },
  worldMeta: { botsEnabled: true, mode: 'survival' },
  player: { x: 10.5, y: 2, z: 10.5 },
  entities: { bots: [] },
};
Game.bots3d.spawnBot3D(botHealthState, 'builder', 10, 2, 10);
Game.bots3d.updateBots3D(botHealthState, 0.1);
assert.strictEqual(
  botHealthState.entities.bots[0].health,
  100,
  'survival bots should have player-like health'
);
const hurtBotId = botHealthState.entities.bots[0].id;
const hurtResult = Game.bots3d.damageBot3D(botHealthState, hurtBotId, 25, 8, 8);
assert.strictEqual(hurtResult.hit, true, 'survival bot damage should register as a hit');
assert.strictEqual(botHealthState.entities.bots[0].health, 75, 'survival bot damage should reduce health');
const deadResult = Game.bots3d.damageBot3D(botHealthState, hurtBotId, 100, 8, 8);
assert.strictEqual(deadResult.dead, true, 'survival bot should die when health reaches zero');
assert.strictEqual(botHealthState.entities.bots.length, 0, 'dead survival bot should be removed from the world');

const creativeBotHealthState = {
  world: { w: 20, h: 12, d: 20 },
  worldMeta: { botsEnabled: false, mode: 'creative' },
  player: { x: 10.5, y: 2, z: 10.5 },
  entities: { bots: [] },
};
Game.bots3d.spawnBot3D(creativeBotHealthState, 'builder', 10, 2, 10);
const creativeDamage = Game.bots3d.damageBot3D(creativeBotHealthState, creativeBotHealthState.entities.bots[0].id, 100, 8, 8);
assert.strictEqual(creativeDamage.creative, true, 'creative bot damage should be rejected');
assert.strictEqual(creativeBotHealthState.entities.bots.length, 1, 'creative bot should not be removed by damage');

const builderState = {
  world: { w: 16, h: 10, d: 16 },
  worldMeta: { botsEnabled: true, mode: 'survival' },
  player: { x: 8.5, y: 2, z: 8.5 },
  entities: {
    bots: [{
      id: 'builder-test',
      name: 'Builder',
      role: 'builder',
      roleLabel: 'Строитель',
      modeWeights: { build: 1 },
      x: 8.5,
      y: 1,
      z: 8.5,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      onGround: true,
      memory: { baseX: 8.5, baseY: 1, baseZ: 8.5 },
      inventory: {},
      goal: null,
      thinkTimer: 0,
      actionTimer: 1,
      lookTimer: 1,
      jumpTimer: 1,
      restlessness: 0.5,
      caution: 0.5,
    }],
  },
};

Game.bots3d.updateBots3D(builderState, 0.1);
assert.strictEqual(
  builderState.entities.bots[0].goal.type,
  'gather_build_resources',
  'builder-weighted bot should gather resources before building in survival'
);
assert(
  builderState.entities.bots[0].goal.buildGoal.materials
    && Object.keys(builderState.entities.bots[0].goal.buildGoal.materials).length > 0,
  'survival builder should know the exact block materials required by its build plan'
);

const craftBeforeBuildState = {
  world: { w: 16, h: 10, d: 16, blocks: { '8,1,8': BLOCK.STONE } },
  worldMeta: { botsEnabled: true, mode: 'survival', botJoinTimer: 999, botLeaveTimer: 999 },
  player: { x: 8.5, y: 2, z: 8.5 },
  entities: {
    bots: [{
      id: 'builder-craft-material-test',
      name: 'Builder',
      role: 'builder',
      roleLabel: 'Строитель',
      modeWeights: { build: 1 },
      x: 8.5,
      y: 1,
      z: 8.5,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      onGround: true,
      memory: { baseX: 8.5, baseY: 1, baseZ: 8.5 },
      inventory: { wood: 0, plank: 0, stone: 0, blocks: { [BLOCK.WOOD]: 1 } },
      goal: {
        type: 'gather_build_resources',
        target: { x: 8, y: 1, z: 8 },
        stage: 0,
        cursor: 0,
        buildGoal: {
          type: 'build_structure',
          structure: 'cabin',
          target: { x: 8, y: 1, z: 8 },
          stage: 0,
          cursor: 0,
          materials: { [BLOCK.PLANK]: 4 },
        },
      },
      thinkTimer: 999,
      actionTimer: 0,
      lookTimer: 999,
      jumpTimer: 1,
      restlessness: 0.5,
      caution: 0.5,
    }],
  },
};

Game.bots3d.updateBots3D(craftBeforeBuildState, 0.1);
assert.strictEqual(
  craftBeforeBuildState.entities.bots[0].goal.type,
  'build_structure',
  'survival builder should craft required planks from gathered wood before building'
);

const consumeBuildMaterialState = {
  world: { w: 16, h: 10, d: 16, blocks: {} },
  worldMeta: { botsEnabled: true, mode: 'survival', botJoinTimer: 999, botLeaveTimer: 999 },
  player: { x: 8.5, y: 2, z: 8.5 },
  entities: {
    bots: [{
      id: 'builder-consume-material-test',
      name: 'Builder',
      role: 'builder',
      roleLabel: 'Строитель',
      modeWeights: { build: 1 },
      x: 8.5,
      y: 1,
      z: 8.5,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      onGround: true,
      memory: { baseX: 8.5, baseY: 1, baseZ: 8.5 },
      inventory: { wood: 0, plank: 0, stone: 0, blocks: { [BLOCK.PLANK]: 1 } },
      goal: {
        type: 'build_structure',
        structure: 'cabin',
        target: { x: 8, y: 1, z: 8 },
        stage: 2,
        cursor: 0,
        materials: { [BLOCK.PLANK]: 1 },
        steps: [{ x: 8, y: 1, z: 8, id: BLOCK.PLANK }],
      },
      thinkTimer: 999,
      actionTimer: 0,
      lookTimer: 999,
      jumpTimer: 1,
      restlessness: 0.5,
      caution: 0.5,
    }],
  },
};

Game.bots3d.updateBots3D(consumeBuildMaterialState, 0.1);
assert.strictEqual(
  Game.world3d.getBlock3D(consumeBuildMaterialState, 8, 1, 8),
  BLOCK.PLANK,
  'survival builder should place a block only from its gathered material inventory'
);
assert.strictEqual(
  consumeBuildMaterialState.entities.bots[0].inventory.blocks[BLOCK.PLANK],
  0,
  'survival builder should consume exact block materials while building'
);

const exitState = {
  world: { w: 24, h: 12, d: 24 },
  worldMeta: { botsEnabled: true, mode: 'survival', botJoinTimer: 999, botLeaveTimer: 999 },
  player: { x: 12.5, y: 2, z: 12.5 },
  entities: {
    bots: [{
      id: 'builder-exit-test',
      name: 'Builder',
      role: 'builder',
      roleLabel: 'Строитель',
      modeWeights: { wander: 1 },
      x: 12.5,
      y: 1,
      z: 12.5,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      onGround: true,
      memory: { baseX: 12.5, baseY: 1, baseZ: 12.5 },
      inventory: { wood: 99, plank: 99, stone: 99 },
      goal: {
        type: 'build_structure',
        structure: 'cabin',
        target: { x: 12, y: 1, z: 12 },
        stage: 1,
        cursor: 0,
        cost: { wood: 0, plank: 0, stone: 0 },
      },
      thinkTimer: 999,
      actionTimer: 0,
      lookTimer: 999,
      jumpTimer: 1,
      restlessness: 0.5,
      caution: 0.5,
    }],
  },
};

for (let i = 0; i < 160; i += 1) {
  exitState.entities.bots[0].actionTimer = 0;
  Game.bots3d.updateBots3D(exitState, 0.1);
  if (exitState.entities.bots[0].goal && exitState.entities.bots[0].goal.type !== 'build_structure') break;
}

assert.strictEqual(
  exitState.entities.bots[0].goal.type,
  'exit_structure',
  'builder should route to the finished structure entrance before choosing another goal'
);

const detailedBuildState = {
  world: { w: 48, h: 16, d: 48, blocks: {} },
  worldMeta: { botsEnabled: true, mode: 'creative', botJoinTimer: 999, botLeaveTimer: 999 },
  player: { x: 20.5, y: 2, z: 20.5 },
  entities: {
    bots: [{
      id: 'builder-detailed-plan-test',
      name: 'Builder',
      role: 'builder',
      roleLabel: 'Строитель',
      modeWeights: { build: 1 },
      x: 20.5,
      y: 1,
      z: 20.5,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      onGround: true,
      memory: { baseX: 20.5, baseY: 1, baseZ: 20.5 },
      inventory: { wood: 99, plank: 99, stone: 99 },
      goal: {
        type: 'build_structure',
        structure: 'plan_98',
        target: { x: 20, y: 1, z: 20 },
        stage: 2,
        cursor: 0,
        cost: { wood: 0, plank: 0, stone: 0 },
      },
      thinkTimer: 999,
      actionTimer: 0,
      lookTimer: 999,
      jumpTimer: 1,
      restlessness: 0.5,
      caution: 0.5,
    }],
  },
};

for (let i = 0; i < 360; i += 1) {
  detailedBuildState.entities.bots[0].actionTimer = 0;
  Game.bots3d.updateBots3D(detailedBuildState, 0.1);
  if (detailedBuildState.entities.bots[0].goal && detailedBuildState.entities.bots[0].goal.type !== 'build_structure') break;
}
assert.strictEqual(
  Game.world3d.getBlock3D(detailedBuildState, 20, 0, 20),
  BLOCK.PLANK,
  'generated builder structures should replace the ground with a real floor'
);
assert.strictEqual(
  Game.world3d.getBlock3D(detailedBuildState, 18, 1, 19),
  BLOCK.CHEST,
  'detailed builder structures should include interior details'
);

const availableBuildMaterialState = {
  world: { w: 48, h: 16, d: 48, blocks: {} },
  worldMeta: { botsEnabled: true, mode: 'creative', botJoinTimer: 999, botLeaveTimer: 999 },
  player: { x: 20.5, y: 2, z: 20.5 },
  entities: {
    bots: [{
      id: 'builder-available-material-test',
      name: 'Builder',
      role: 'builder',
      roleLabel: 'Строитель',
      modeWeights: { build: 1 },
      x: 20.5,
      y: 1,
      z: 20.5,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      onGround: true,
      memory: { baseX: 20.5, baseY: 1, baseZ: 20.5 },
      inventory: { wood: 99, plank: 99, stone: 99 },
      goal: {
        type: 'build_structure',
        structure: 'plan_07',
        target: { x: 20, y: 1, z: 20 },
        stage: 2,
        cursor: 0,
        cost: { wood: 0, plank: 0, stone: 0 },
      },
      thinkTimer: 999,
      actionTimer: 0,
      lookTimer: 999,
      jumpTimer: 1,
      restlessness: 0.5,
      caution: 0.5,
    }],
  },
};

for (let i = 0; i < 420; i += 1) {
  availableBuildMaterialState.entities.bots[0].actionTimer = 0;
  Game.bots3d.updateBots3D(availableBuildMaterialState, 0.1);
  if (availableBuildMaterialState.entities.bots[0].goal && availableBuildMaterialState.entities.bots[0].goal.type !== 'build_structure') break;
}
const unavailableBuildMaterials = new Set([BLOCK.SEQUOIA_WOOD, BLOCK.SEQUOIA_LEAF, BLOCK.SEQUOIA_PLANK]);
assert(
  Object.values(availableBuildMaterialState.world.blocks).every((id) => !unavailableBuildMaterials.has(id)),
  'builder structures should use blocks available in the actual creative inventory, not sequoia-only code blocks'
);

function runCreativeBuildVariant(variant, targetX, targetZ) {
  const state = {
    world: { w: 64, h: 20, d: 64, blocks: {} },
    worldMeta: { botsEnabled: true, mode: 'creative', botJoinTimer: 999, botLeaveTimer: 999 },
    player: { x: targetX + 0.5, y: 3, z: targetZ + 0.5 },
    entities: {
      bots: [{
        id: `builder-${variant}-test`,
        name: 'Builder',
        role: 'builder',
        roleLabel: 'Строитель',
        modeWeights: { build: 1 },
        x: targetX + 0.5,
        y: 1,
        z: targetZ + 0.5,
        vx: 0,
        vy: 0,
        vz: 0,
        yaw: 0,
        onGround: true,
        memory: { baseX: targetX + 0.5, baseY: 1, baseZ: targetZ + 0.5 },
        inventory: { wood: 99, plank: 99, stone: 99 },
        goal: {
          type: 'build_structure',
          structure: variant,
          target: { x: targetX, y: 1, z: targetZ },
          stage: 2,
          cursor: 0,
          cost: { wood: 0, plank: 0, stone: 0 },
        },
        thinkTimer: 999,
        actionTimer: 0,
        lookTimer: 999,
        jumpTimer: 1,
        restlessness: 0.5,
        caution: 0.5,
      }],
    },
  };
  for (let i = 0; i < 320; i += 1) {
    state.entities.bots[0].actionTimer = 0;
    Game.bots3d.updateBots3D(state, 0.1);
    if (state.entities.bots[0].goal && state.entities.bots[0].goal.type !== 'build_structure') break;
  }
  return state;
}

const castleBuildState = runCreativeBuildVariant('plan_10', 30, 30);
assert.strictEqual(
  Game.world3d.getBlock3D(castleBuildState, 26, 1, 26),
  BLOCK.PILLAR,
  'diverse builder plans should include castle corner towers'
);
assert.strictEqual(
  Game.world3d.getBlock3D(castleBuildState, 30, 1, 26),
  BLOCK.AIR,
  'castle-style builder plans should keep a real gate opening'
);

const fountainBuildState = runCreativeBuildVariant('plan_11', 30, 30);
assert.strictEqual(
  Game.world3d.getBlock3D(fountainBuildState, 30, 4, 30),
  BLOCK.WATER,
  'creative builder plans should include fountain water for fountain variants'
);

const parkBuildState = runCreativeBuildVariant('plan_12', 30, 30);
assert.strictEqual(
  Game.world3d.getBlock3D(parkBuildState, 26, 3, 26),
  BLOCK.LEAF,
  'diverse builder plans should include park trees and leaves'
);

const highBuildState = {
  world: { w: 24, h: 12, d: 24, blocks: {} },
  worldMeta: { botsEnabled: true, mode: 'survival', botJoinTimer: 999, botLeaveTimer: 999 },
  player: { x: 12.5, y: 2, z: 12.5 },
  entities: {
    bots: [{
      id: 'builder-high-step-test',
      name: 'Builder',
      role: 'builder',
      roleLabel: 'Строитель',
      modeWeights: { build: 1 },
      x: 12.5,
      y: 1,
      z: 12.5,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      onGround: true,
      memory: { baseX: 12.5, baseY: 1, baseZ: 12.5 },
      inventory: { wood: 99, plank: 99, stone: 99 },
      goal: {
        type: 'build_structure',
        structure: 'tower',
        target: { x: 12, y: 1, z: 12 },
        stage: 2,
        cursor: 0,
        cost: { wood: 0, plank: 0, stone: 0 },
        steps: [{ x: 12, y: 6, z: 12, id: BLOCK.PLANK }],
      },
      thinkTimer: 999,
      actionTimer: 0,
      lookTimer: 999,
      jumpTimer: 1,
      restlessness: 0.5,
      caution: 0.5,
    }],
  },
};

Game.bots3d.updateBots3D(highBuildState, 0.1);
assert(
  highBuildState.entities.bots[0].y > 1,
  'builder should climb toward high build steps instead of staying on the ground'
);
assert.strictEqual(
  highBuildState.entities.bots[0].goal.cursor,
  0,
  'builder should not consume a high build step until it has climbed into reach'
);

const originalRandomBeforeExit = Math.random;
Math.random = () => 0;
const exitThinkState = {
  world: { w: 24, h: 12, d: 24 },
  worldMeta: { botsEnabled: true, mode: 'survival', botJoinTimer: 999, botLeaveTimer: 999 },
  player: { x: 12.5, y: 2, z: 12.5 },
  entities: {
    bots: [{
      id: 'builder-exit-think-test',
      name: 'Builder',
      role: 'builder',
      roleLabel: 'Строитель',
      modeWeights: { wander: 1 },
      x: 12.5,
      y: 1,
      z: 12.5,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      onGround: true,
      memory: { baseX: 12.5, baseY: 1, baseZ: 12.5, buildSites: [{ x: 12.5, z: 12.5, radius: 11 }] },
      inventory: { wood: 99, plank: 99, stone: 99 },
      goal: {
        type: 'exit_structure',
        route: [{ x: 13, y: 1, z: 9 }, { x: 13, y: 1, z: 8 }],
        stage: 0,
      },
      thinkTimer: 0,
      actionTimer: 0,
      lookTimer: 999,
      jumpTimer: 1,
      restlessness: 0.5,
      caution: 0.5,
    }],
  },
};

Game.bots3d.updateBots3D(exitThinkState, 0.1);
Math.random = originalRandomBeforeExit;
assert.strictEqual(
  exitThinkState.entities.bots[0].goal.type,
  'exit_structure',
  'builder should not replace the exit route with a random idle goal before leaving the finished structure'
);
assert(
  Math.hypot(exitThinkState.entities.bots[0].vx, exitThinkState.entities.bots[0].vz) > 0,
  'builder should keep moving while following the exit route'
);

const originalRandom = Math.random;
Math.random = () => 0;
const oldBuildState = {
  world: { w: 64, h: 16, d: 64 },
  worldMeta: { botsEnabled: true, mode: 'creative', botJoinTimer: 999, botLeaveTimer: 999 },
  player: { x: 32.5, y: 8, z: 32.5 },
  entities: {
    bots: [{
      id: 'builder-old-site-test',
      name: 'Builder',
      role: 'builder',
      roleLabel: 'Строитель',
      modeWeights: { build: 1 },
      x: 32.5,
      y: 8,
      z: 32.5,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      onGround: false,
      memory: {
        baseX: 32.5,
        baseY: 8,
        baseZ: 32.5,
        buildSites: [{ x: 38.5, z: 32.5, radius: 14 }],
      },
      inventory: { wood: 99, plank: 99, stone: 99 },
      goal: null,
      thinkTimer: 0,
      actionTimer: 1,
      lookTimer: 999,
      jumpTimer: 1,
      restlessness: 0.5,
      caution: 0.5,
    }],
  },
};

Game.bots3d.updateBots3D(oldBuildState, 0.1);
Math.random = originalRandom;
const oldSiteBot = oldBuildState.entities.bots[0];
const oldSite = oldSiteBot.memory.buildSites[0];
const buildTarget = oldSiteBot.goal.target;
assert(
  Math.hypot(buildTarget.x - oldSite.x, buildTarget.z - oldSite.z) >= oldSite.radius,
  'builder should not choose a new build target inside an old build site'
);

Math.random = () => 0;
const protectedBuildState = {
  world: {
    w: 64,
    h: 16,
    d: 64,
    testVillages: [{ x: 38.5, z: 32.5, radius: 14 }],
  },
  worldMeta: { botsEnabled: true, mode: 'creative', botJoinTimer: 999, botLeaveTimer: 999 },
  player: { x: 32.5, y: 8, z: 32.5 },
  entities: {
    bots: [{
      id: 'builder-structure-test',
      name: 'Builder',
      role: 'builder',
      roleLabel: 'Строитель',
      modeWeights: { build: 1 },
      x: 32.5,
      y: 8,
      z: 32.5,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      onGround: false,
      memory: { baseX: 32.5, baseY: 8, baseZ: 32.5 },
      inventory: { wood: 99, plank: 99, stone: 99 },
      goal: null,
      thinkTimer: 0,
      actionTimer: 1,
      lookTimer: 999,
      jumpTimer: 1,
      restlessness: 0.5,
      caution: 0.5,
    }],
  },
};

Game.bots3d.updateBots3D(protectedBuildState, 0.1);
Math.random = originalRandom;
const protectedTarget = protectedBuildState.entities.bots[0].goal.target;
const village = protectedBuildState.world.testVillages[0];
assert(
  Math.hypot(protectedTarget.x - village.x, protectedTarget.z - village.z) >= village.radius + 8,
  'builder should not choose a build target inside a village or protected structure'
);

const lavaRepairState = {
  world: {
    w: 32,
    h: 12,
    d: 32,
    blocks: { '9,2,8': BLOCK.LAVA },
    modifiedChunks: new Set(['0,0,0']),
    generatedChunks: new Set(),
    lavaSources: new Set(['9,2,8']),
  },
  worldMeta: { botsEnabled: true, mode: 'survival', botJoinTimer: 999, botLeaveTimer: 999 },
  player: { x: 8.5, y: 2, z: 8.5 },
  entities: {
    bots: [{
      id: 'builder-lava-repair-test',
      name: 'Builder',
      role: 'builder',
      roleLabel: 'Строитель',
      modeWeights: { build: 1 },
      x: 8.5,
      y: 2,
      z: 8.5,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      onGround: true,
      memory: { baseX: 8.5, baseY: 2, baseZ: 8.5 },
      inventory: { wood: 99, plank: 99, stone: 99 },
      goal: { type: 'wander', target: { x: 12, z: 8 }, stage: 0 },
      thinkTimer: 999,
      actionTimer: 1,
      lookTimer: 999,
      jumpTimer: 1,
      restlessness: 0.5,
      caution: 0.5,
    }],
  },
};

Game.bots3d.updateBots3D(lavaRepairState, 0.1);
assert.notStrictEqual(
  Game.world3d.getBlock3D(lavaRepairState, 9, 2, 8),
  BLOCK.LAVA,
  'builder should immediately patch lava in a modified but ungenerated chunk'
);

const creativeFlightState = {
  world: { w: 32, h: 16, d: 32 },
  worldMeta: { botsEnabled: true, mode: 'creative', botJoinTimer: 999, botLeaveTimer: 999 },
  player: { x: 2.5, y: 8, z: 2.5 },
  entities: {
    bots: [{
      id: 'creative-flight-test',
      name: 'Builder',
      role: 'builder',
      roleLabel: 'Строитель',
      modeWeights: { wander: 1 },
      x: 2.5,
      y: 8,
      z: 2.5,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      onGround: false,
      memory: { baseX: 2.5, baseY: 8, baseZ: 2.5 },
      inventory: { wood: 99, plank: 99, stone: 99 },
      goal: {
        type: 'build_structure',
        structure: 'cabin',
        target: { x: 20, y: 1, z: 20 },
        stage: 1,
        cursor: 0,
        cost: { wood: 0, plank: 0, stone: 0 },
      },
      thinkTimer: 999,
      actionTimer: 0,
      lookTimer: 999,
      jumpTimer: 1,
      restlessness: 0.5,
      caution: 0.5,
    }],
  },
};

Game.bots3d.updateBots3D(creativeFlightState, 0.1);
assert(
  creativeFlightState.entities.bots[0].x < 8,
  `creative bot should fly toward build target instead of teleporting, got x=${creativeFlightState.entities.bots[0].x}`
);

const miningState = {
  world: { w: 16, h: 10, d: 16, blocks: { '8,2,8': BLOCK.STONE } },
  worldMeta: { botsEnabled: true, mode: 'survival', botJoinTimer: 999, botLeaveTimer: 999 },
  player: { x: 8.5, y: 2, z: 8.5 },
  entities: {
    bots: [{
      id: 'miner-delay-test',
      name: 'Miner',
      role: 'miner',
      x: 8.5,
      y: 1,
      z: 8.5,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      onGround: true,
      memory: { baseX: 8.5, baseY: 1, baseZ: 8.5 },
      goal: {
        type: 'dig_stair',
        target: { x: 8, y: 1, z: 8 },
        stage: 2,
        cursor: 0,
        length: 1,
        dir: 0,
      },
      thinkTimer: 999,
      actionTimer: 0,
      lookTimer: 999,
      jumpTimer: 1,
      restlessness: 0.5,
      caution: 0.5,
    }],
  },
};

Game.bots3d.updateBots3D(miningState, 0.1);
assert.strictEqual(
  Game.world3d.getBlock3D(miningState, 8, 2, 8),
  BLOCK.STONE,
  'bot mining should damage a block before breaking it'
);
assert(
  miningState.world.blockDamage && miningState.world.blockDamage['8,2,8'] > 0,
  'bot mining should store progress in world.blockDamage'
);

for (let i = 0; i < 80; i += 1) {
  miningState.entities.bots[0].actionTimer = 0;
  miningState.entities.bots[0].goal = {
    type: 'dig_stair',
    target: { x: 8, y: 1, z: 8 },
    stage: 2,
    cursor: 0,
    length: 1,
    dir: 0,
  };
  Game.bots3d.updateBots3D(miningState, 0.1);
  if (Game.world3d.getBlock3D(miningState, 8, 2, 8) === BLOCK.AIR) break;
}
assert.strictEqual(
  Game.world3d.getBlock3D(miningState, 8, 2, 8),
  BLOCK.AIR,
  'bot mining should eventually break the damaged block'
);

const occupiedMineState = {
  world: { w: 16, h: 10, d: 16, blocks: { '8,2,8': BLOCK.STONE } },
  worldMeta: { botsEnabled: true, mode: 'survival', botJoinTimer: 999, botLeaveTimer: 999 },
  player: { x: 8.5, y: 2, z: 8.5 },
  entities: {
    bots: [{
      id: 'miner-safe-test',
      name: 'Miner',
      role: 'miner',
      x: 6.5,
      y: 1,
      z: 8.5,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      onGround: true,
      memory: { baseX: 6.5, baseY: 1, baseZ: 8.5 },
      goal: { type: 'dig_stair', target: { x: 8, y: 1, z: 8 }, stage: 2, cursor: 0, length: 1, dir: 0 },
      thinkTimer: 999,
      actionTimer: 0,
      lookTimer: 999,
      jumpTimer: 1,
      restlessness: 0.5,
      caution: 0.5,
    }, {
      id: 'friend-in-block',
      name: 'Friend',
      role: 'explorer',
      x: 8.5,
      y: 1,
      z: 8.5,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      onGround: true,
      memory: { baseX: 8.5, baseY: 1, baseZ: 8.5 },
      goal: { type: 'wander', target: { x: 8, z: 8 }, stage: 0 },
      thinkTimer: 999,
      actionTimer: 999,
      lookTimer: 999,
      jumpTimer: 1,
      restlessness: 0.5,
      caution: 0.5,
    }],
  },
};

for (let i = 0; i < 80; i += 1) {
  occupiedMineState.entities.bots[0].actionTimer = 0;
  occupiedMineState.entities.bots[0].goal = { type: 'dig_stair', target: { x: 8, y: 1, z: 8 }, stage: 2, cursor: 0, length: 1, dir: 0 };
  Game.bots3d.updateBots3D(occupiedMineState, 0.1);
}
assert.strictEqual(
  Game.world3d.getBlock3D(occupiedMineState, 8, 2, 8),
  BLOCK.STONE,
  'miner should not dig through a block occupied by another bot'
);

const caveMineState = {
  world: { w: 32, h: 16, d: 32, blocks: {} },
  worldMeta: { botsEnabled: true, mode: 'creative', botJoinTimer: 999, botLeaveTimer: 999 },
  player: { x: 10.5, y: 8, z: 10.5 },
  entities: {
    bots: [{
      id: 'creative-cave-miner-test',
      name: 'Miner',
      role: 'miner',
      x: 10.5,
      y: 8,
      z: 10.5,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      onGround: false,
      memory: { baseX: 10.5, baseY: 8, baseZ: 10.5 },
      goal: { type: 'mine_shaft', target: { x: 10, y: 6, z: 10 }, stage: 2, cursor: 1, length: 1 },
      thinkTimer: 999,
      actionTimer: 0,
      lookTimer: 999,
      jumpTimer: 1,
      restlessness: 0.5,
      caution: 0.5,
    }],
  },
};

Game.bots3d.updateBots3D(caveMineState, 0.1);
assert.strictEqual(
  caveMineState.entities.bots[0].goal.type,
  'dig_to_cave',
  'creative miner should continue toward the nearest cave after finishing a shaft'
);

const originalRandomForNavigation = Math.random;
Math.random = () => 0;
const navigationState = {
  world: {
    w: 16,
    h: 8,
    d: 16,
    blocks: {
      '6,1,5': BLOCK.STONE,
      '6,2,5': BLOCK.STONE,
      '6,1,6': BLOCK.STONE,
      '6,2,6': BLOCK.STONE,
      '5,1,6': BLOCK.STONE,
      '5,2,6': BLOCK.STONE,
    },
  },
  worldMeta: { botsEnabled: true, mode: 'survival', botJoinTimer: 999, botLeaveTimer: 999 },
  player: { x: 5.5, y: 2, z: 5.5 },
  entities: {
    bots: [{
      id: 'navigation-test',
      name: 'Navigator',
      role: 'explorer',
      x: 5.5,
      y: 1,
      z: 5.5,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      onGround: true,
      memory: { baseX: 5.5, baseY: 1, baseZ: 5.5 },
      goal: { type: 'wander', target: { x: 12, z: 5 }, stage: 0 },
      thinkTimer: 999,
      actionTimer: 0,
      lookTimer: 999,
      jumpTimer: 1,
      restlessness: 0.5,
      caution: 0.5,
    }],
  },
};

Game.bots3d.updateBots3D(navigationState, 0.1);
Math.random = originalRandomForNavigation;
assert(
  navigationState.entities.bots[0].vz < 0,
  'bot should choose the only free side path instead of spinning into the blocked front'
);
assert(
  navigationState.world.blockDamage && navigationState.world.blockDamage['6,1,5'] > 0,
  'bot should also start mining the direct blocking block even when a side path is available'
);

const blockedPathState = {
  world: {
    w: 16,
    h: 8,
    d: 16,
    blocks: {
      '6,1,5': BLOCK.STONE,
      '6,2,5': BLOCK.STONE,
      '6,1,6': BLOCK.STONE,
      '6,2,6': BLOCK.STONE,
      '6,1,4': BLOCK.STONE,
      '6,2,4': BLOCK.STONE,
      '5,1,4': BLOCK.STONE,
      '5,2,4': BLOCK.STONE,
      '5,1,6': BLOCK.STONE,
      '5,2,6': BLOCK.STONE,
      '4,1,5': BLOCK.STONE,
      '4,2,5': BLOCK.STONE,
    },
  },
  worldMeta: { botsEnabled: true, mode: 'survival', botJoinTimer: 999, botLeaveTimer: 999 },
  player: { x: 5.5, y: 2, z: 5.5 },
  entities: {
    bots: [{
      id: 'blocked-path-test',
      name: 'Navigator',
      role: 'explorer',
      x: 5.5,
      y: 1,
      z: 5.5,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      onGround: true,
      memory: { baseX: 5.5, baseY: 1, baseZ: 5.5 },
      goal: { type: 'wander', target: { x: 12, z: 5 }, stage: 0 },
      thinkTimer: 999,
      actionTimer: 0,
      lookTimer: 999,
      jumpTimer: 1,
      restlessness: 0.5,
      caution: 0.5,
    }],
  },
};

Game.bots3d.updateBots3D(blockedPathState, 0.1);
assert(
  blockedPathState.world.blockDamage && blockedPathState.world.blockDamage['6,1,5'] > 0,
  'blocked bot should mine the center block in front of its body'
);
assert(
  blockedPathState.world.blockDamage && blockedPathState.world.blockDamage['6,1,6'] > 0,
  'blocked bot should also mine side blocks that overlap its movement volume'
);

const stuckJumpState = {
  world: {
    w: 16,
    h: 8,
    d: 16,
    blocks: {
      '6,1,5': BLOCK.STONE,
      '6,2,5': BLOCK.STONE,
      '6,1,6': BLOCK.STONE,
      '6,2,6': BLOCK.STONE,
      '6,1,4': BLOCK.STONE,
      '6,2,4': BLOCK.STONE,
      '5,1,4': BLOCK.STONE,
      '5,2,4': BLOCK.STONE,
      '5,1,6': BLOCK.STONE,
      '5,2,6': BLOCK.STONE,
      '4,1,5': BLOCK.STONE,
      '4,2,5': BLOCK.STONE,
    },
  },
  worldMeta: { botsEnabled: true, mode: 'survival', botJoinTimer: 999, botLeaveTimer: 999 },
  player: { x: 5.5, y: 2, z: 5.5 },
  entities: {
    bots: [{
      id: 'stuck-jump-test',
      name: 'Navigator',
      role: 'explorer',
      x: 5.5,
      y: 1,
      z: 5.5,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      onGround: true,
      memory: { baseX: 5.5, baseY: 1, baseZ: 5.5 },
      goal: { type: 'wander', target: { x: 12, z: 5 }, stage: 0 },
      thinkTimer: 999,
      actionTimer: 0,
      lookTimer: 999,
      jumpTimer: 0,
      restlessness: 0.5,
      caution: 0.5,
    }],
  },
};

Game.bots3d.updateBots3D(stuckJumpState, 0.1);
assert(
  stuckJumpState.entities.bots[0].vy > 0,
  'stuck survival bot should jump while breaking movement blockers'
);

const creativeBreakState = {
  world: {
    w: 16,
    h: 8,
    d: 16,
    blocks: { '6,3,5': BLOCK.STONE },
  },
  worldMeta: { botsEnabled: true, mode: 'creative', botJoinTimer: 999, botLeaveTimer: 999 },
  player: { x: 5.5, y: 3, z: 5.5 },
  entities: {
    bots: [{
      id: 'creative-instant-break-test',
      name: 'Navigator',
      role: 'explorer',
      x: 5.5,
      y: 3,
      z: 5.5,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      onGround: false,
      memory: { baseX: 5.5, baseY: 3, baseZ: 5.5 },
      goal: { type: 'wander', target: { x: 12, z: 5 }, stage: 0 },
      thinkTimer: 999,
      actionTimer: 0,
      lookTimer: 999,
      jumpTimer: 1,
      restlessness: 0.5,
      caution: 0.5,
    }],
  },
};

Game.bots3d.updateBots3D(creativeBreakState, 0.1);
assert.strictEqual(
  Game.world3d.getBlock3D(creativeBreakState, 6, 3, 5),
  BLOCK.AIR,
  'creative bot should instantly break movement blockers'
);

const originalRandomForBlaster = Math.random;
Math.random = () => 0.99;
const blasterState = {
  world: { w: 96, h: 18, d: 96, blocks: {} },
  worldMeta: { botsEnabled: true, mode: 'creative', botJoinTimer: 999, botLeaveTimer: 999 },
  player: { x: 48.5, y: 8, z: 48.5 },
  entities: {
    bots: [{
      id: 'blaster-test',
      name: 'Blaster',
      role: 'blaster',
      roleLabel: 'Взрыватель',
      modeWeights: { blast: 1 },
      x: 48.5,
      y: 8,
      z: 48.5,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      onGround: false,
      memory: { baseX: 48.5, baseY: 8, baseZ: 48.5 },
      goal: null,
      thinkTimer: 0,
      actionTimer: 0,
      lookTimer: 999,
      jumpTimer: 1,
      restlessness: 0.5,
      caution: 0.5,
    }],
  },
};

Game.bots3d.updateBots3D(blasterState, 0.1);
Math.random = originalRandomForBlaster;
const blaster = blasterState.entities.bots[0];
assert.strictEqual(
  blaster.goal.type,
  'blast_tnt',
  'blaster should choose TNT placement as its main behavior'
);
assert(
  blaster.goal.powerful,
  'forced high roll should create a powerful TNT goal'
);
assert(
  Math.min(blaster.x, blaster.z, blasterState.world.w - blaster.x, blasterState.world.d - blaster.z) < 12,
  'powerful blaster should teleport roughly to the world edge before placing TNT'
);
assert(
  Math.hypot(blaster.goal.target.x - 48.5, blaster.goal.target.z - 48.5) > 30,
  'powerful TNT target should be far away from spawn'
);

const originalRandomForRepeatedBlaster = Math.random;
Math.random = () => 0;
const repeatedBlasterState = {
  world: { w: 96, h: 18, d: 96, blocks: {} },
  worldMeta: { botsEnabled: true, mode: 'creative', botJoinTimer: 999, botLeaveTimer: 999 },
  player: { x: 48.5, y: 8, z: 48.5 },
  entities: {
    bots: [{
      id: 'blaster-repeat-test',
      name: 'Blaster',
      role: 'blaster',
      roleLabel: 'Взрыватель',
      modeWeights: { blast: 1 },
      x: 48.5,
      y: 8,
      z: 48.5,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      onGround: false,
      memory: {
        baseX: 48.5,
        baseY: 8,
        baseZ: 48.5,
        blastSites: [{ x: 68.5, z: 48.5, radius: 12 }],
      },
      goal: null,
      thinkTimer: 0,
      actionTimer: 1,
      lookTimer: 999,
      jumpTimer: 1,
      restlessness: 0.5,
      caution: 0.5,
    }],
  },
};

Game.bots3d.updateBots3D(repeatedBlasterState, 0.1);
Math.random = originalRandomForRepeatedBlaster;
const repeatedTarget = repeatedBlasterState.entities.bots[0].goal.target;
assert(
  Math.hypot(repeatedTarget.x - 68.5, repeatedTarget.z - 48.5) >= 12,
  'blaster should not choose a new TNT target at the same recent blast site'
);

const originalRandomForSingleCharge = Math.random;
Math.random = () => 0.25;
const singleChargeBlasterState = {
  world: { w: 96, h: 18, d: 96, blocks: {} },
  worldMeta: { botsEnabled: true, mode: 'creative', botJoinTimer: 999, botLeaveTimer: 999 },
  player: { x: 48.5, y: 8, z: 48.5 },
  entities: {
    bots: [{
      id: 'blaster-single-charge-test',
      name: 'Blaster',
      role: 'blaster',
      roleLabel: 'Взрыватель',
      modeWeights: { blast: 1 },
      x: 48.5,
      y: 2,
      z: 48.5,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      onGround: false,
      memory: { baseX: 48.5, baseY: 2, baseZ: 48.5 },
      goal: {
        type: 'blast_tnt',
        target: { x: 48, z: 48 },
        stage: 0,
        cursor: 0,
        dynamite: BLOCK.DYNAMITE_SMALL,
        powerful: false,
      },
      thinkTimer: 999,
      actionTimer: 0,
      lookTimer: 999,
      jumpTimer: 1,
      restlessness: 0.5,
      caution: 0.5,
    }],
  },
};

Game.bots3d.updateBots3D(singleChargeBlasterState, 0.1);
Math.random = originalRandomForSingleCharge;
const singleChargeBot = singleChargeBlasterState.entities.bots[0];
assert.strictEqual(
  singleChargeBlasterState.world.activeDynamite.length,
  1,
  'blaster should place exactly one TNT before choosing a new blast target'
);
assert(
  singleChargeBot.goal && singleChargeBot.goal.type === 'blast_tnt',
  'blast-weighted blaster should choose another blast goal after placing one TNT'
);
assert(
  Math.hypot(singleChargeBot.goal.target.x - 48.5, singleChargeBot.goal.target.z - 48.5) >= 18,
  'next blaster target should move away from the active TNT site instead of stuffing the same place'
);
