(() => {
  const Game = window.CubDep;
  const { BLOCK } = Game.blocks;
  const { getBlock3D, setBlock3D, getGrassLevel3D, setGrassLevel3D, inBounds3D, isSolidBlock3D } = Game.world3d;

  const SHEEP_RADIUS = 0.34;
  const SHEEP_HEIGHT = 0.86;
  const SHEEP_SPEED = 0.85;
  const SHEEP_GRAVITY = 18;
  const SHEEP_EAT_TIME = 1.15;
  const SHEEP_MAX_HEALTH = 4;
  const SHEEP_STEP_JUMP_SPEED = 6.6;
  const SHEEP_HIT_JUMP_SPEED = 4.2;
  const SHEEP_PANIC_SPEED = 1.35;

  function initSheep(sheep) {
    if (!Number.isFinite(sheep.vx)) sheep.vx = 0;
    if (!Number.isFinite(sheep.vy)) sheep.vy = 0;
    if (!Number.isFinite(sheep.vz)) sheep.vz = 0;
    if (!Number.isFinite(sheep.walkTimer)) sheep.walkTimer = 0.8 + Math.random() * 2.2;
    if (!Number.isFinite(sheep.pauseTimer)) sheep.pauseTimer = Math.random() * 1.4;
    if (!Number.isFinite(sheep.eatCooldown)) sheep.eatCooldown = 2 + Math.random() * 5;
    if (!Number.isFinite(sheep.eatTimer)) sheep.eatTimer = 0;
    if (!Number.isFinite(sheep.jumpCooldown)) sheep.jumpCooldown = 0;
    if (!Number.isFinite(sheep.panicTimer)) sheep.panicTimer = 0;
    if (!Number.isFinite(sheep.health)) sheep.health = SHEEP_MAX_HEALTH;
    if (typeof sheep.eating !== 'boolean') sheep.eating = false;
    if (typeof sheep.onGround !== 'boolean') sheep.onGround = false;
  }

  function isFluidBlock(id) {
    return id === BLOCK.WATER || id === BLOCK.HOT_WATER || id === BLOCK.LAVA;
  }

  function isBlockingSheep(state, id) {
    return isSolidBlock3D(id) || isFluidBlock(id);
  }

  function overlapsBlocking(state, x, y, z) {
    const world = state.world;
    const minX = Math.floor(x - SHEEP_RADIUS);
    const maxX = Math.floor(x + SHEEP_RADIUS);
    const minY = Math.floor(y);
    const maxY = Math.floor(y + SHEEP_HEIGHT);
    const minZ = Math.floor(z - SHEEP_RADIUS);
    const maxZ = Math.floor(z + SHEEP_RADIUS);
    for (let yy = minY; yy <= maxY; yy += 1) {
      for (let zz = minZ; zz <= maxZ; zz += 1) {
        for (let xx = minX; xx <= maxX; xx += 1) {
          if (!inBounds3D(world, xx, yy, zz)) return true;
          if (isBlockingSheep(state, getBlock3D(state, xx, yy, zz))) return true;
        }
      }
    }
    return false;
  }

  function moveAxis(state, sheep, axis, delta) {
    if (delta === 0) return true;
    const next = { x: sheep.x, y: sheep.y, z: sheep.z };
    next[axis] += delta;
    if (!overlapsBlocking(state, next.x, next.y, next.z)) {
      sheep[axis] = next[axis];
      return true;
    }
    if (axis === 'y') {
      if (delta < 0) sheep.onGround = true;
      sheep.vy = 0;
    } else {
      sheep[axis === 'x' ? 'vx' : 'vz'] = 0;
    }
    return false;
  }

  function canOccupySheepAt(state, x, y, z) {
    return !overlapsBlocking(state, x, y, z);
  }

  function blockBelow(sheep) {
    return {
      x: Math.floor(sheep.x),
      y: Math.floor(sheep.y - 0.08),
      z: Math.floor(sheep.z),
    };
  }

  function hasSafeSupport(state, x, groundY, z) {
    if (!inBounds3D(state.world, x, groundY, z)) return false;
    const id = getBlock3D(state, x, groundY, z);
    return isSolidBlock3D(id) && !isFluidBlock(id);
  }

  function findSafeStepY(state, sheep, x, z) {
    const baseY = Math.floor(sheep.y);
    const blockX = Math.floor(x);
    const blockZ = Math.floor(z);
    if (isFluidBlock(getBlock3D(state, blockX, baseY, blockZ))) return null;
    if (canOccupySheepAt(state, x, baseY, z) && hasSafeSupport(state, blockX, baseY - 1, blockZ)) return baseY;
    if (canOccupySheepAt(state, x, baseY - 1, z) && hasSafeSupport(state, blockX, baseY - 2, blockZ)) return baseY - 1;
    if (canOccupySheepAt(state, x, baseY + 1, z) && hasSafeSupport(state, blockX, baseY, blockZ)) return baseY + 1;
    return null;
  }

  function getSafeSheepStep(state, sheep, yaw) {
    const ahead = 1.0;
    const x = sheep.x + Math.cos(yaw) * ahead;
    const z = sheep.z + Math.sin(yaw) * ahead;
    const y = findSafeStepY(state, sheep, x, z);
    return y === null ? null : { x, y, z };
  }

  function isSafeSheepDirection(state, sheep, yaw) {
    return getSafeSheepStep(state, sheep, yaw) !== null;
  }

  function tryStepJumpSheep(sheep) {
    if (!sheep.onGround || sheep.eating || sheep.jumpCooldown > 0) return false;
    sheep.vy = Math.max(sheep.vy, SHEEP_STEP_JUMP_SPEED);
    sheep.onGround = false;
    sheep.jumpCooldown = 0.5;
    return true;
  }

  function hopFromHit(sheep) {
    sheep.vy = Math.max(sheep.vy, SHEEP_HIT_JUMP_SPEED);
    sheep.onGround = false;
    sheep.jumpCooldown = Math.max(sheep.jumpCooldown || 0, 0.35);
  }

  function startEating(sheep) {
    sheep.eating = true;
    sheep.eatTimer = SHEEP_EAT_TIME;
    sheep.pauseTimer = Math.max(sheep.pauseTimer || 0, SHEEP_EAT_TIME);
    sheep.vx = 0;
    sheep.vz = 0;
  }

  function finishEating(state, sheep) {
    const below = blockBelow(sheep);
    if (getBlock3D(state, below.x, below.y, below.z) === BLOCK.DIRT && getGrassLevel3D(state, below.x, below.y, below.z) > 0) {
      setGrassLevel3D(state, below.x, below.y, below.z, 0);
    }
    sheep.eating = false;
    sheep.eatTimer = 0;
    sheep.eatCooldown = 6 + Math.random() * 10;
  }

  function chooseDirection(state, sheep) {
    const startYaw = sheep.yaw;
    let found = false;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const yaw = startYaw + (Math.random() - 0.5) * Math.PI * 1.8;
      if (!isSafeSheepDirection(state, sheep, yaw)) continue;
      sheep.yaw = yaw;
      found = true;
      break;
    }
    if (!found) {
      sheep.yaw = startYaw + Math.PI * (0.65 + Math.random() * 0.7);
      sheep.pauseTimer = 0.45 + Math.random() * 1.0;
    }
    sheep.walkTimer = 1.2 + Math.random() * 3.2;
    if (found) sheep.pauseTimer = Math.random() < 0.34 ? 0.6 + Math.random() * 1.8 : sheep.pauseTimer;
  }

  function updateSheep(state, sheep, dt) {
    initSheep(sheep);
    sheep.eatCooldown = Math.max(0, sheep.eatCooldown - dt);
    sheep.jumpCooldown = Math.max(0, sheep.jumpCooldown - dt);
    sheep.panicTimer = Math.max(0, sheep.panicTimer - dt);

    if (sheep.eating) {
      sheep.eatTimer -= dt;
      if (sheep.eatTimer <= 0) finishEating(state, sheep);
    } else if (sheep.onGround && sheep.eatCooldown <= 0) {
      const below = blockBelow(sheep);
      if (getBlock3D(state, below.x, below.y, below.z) === BLOCK.DIRT && getGrassLevel3D(state, below.x, below.y, below.z) > 0) startEating(sheep);
      else sheep.eatCooldown = 2 + Math.random() * 4;
    }

    sheep.walkTimer -= dt;
    sheep.pauseTimer = Math.max(0, sheep.pauseTimer - dt);
    if (sheep.walkTimer <= 0) chooseDirection(state, sheep);

    const canWalk = !sheep.eating && (sheep.pauseTimer <= 0 || sheep.panicTimer > 0);
    let step = canWalk ? getSafeSheepStep(state, sheep, sheep.yaw) : null;
    let safeAhead = !!step;
    if (canWalk && !safeAhead) {
      chooseDirection(state, sheep);
      step = sheep.pauseTimer <= 0 ? getSafeSheepStep(state, sheep, sheep.yaw) : null;
      safeAhead = !!step;
    }
    if (safeAhead && step.y > Math.floor(sheep.y)) tryStepJumpSheep(sheep);
    const speed = canWalk && safeAhead ? (sheep.panicTimer > 0 ? SHEEP_PANIC_SPEED : SHEEP_SPEED) : 0;
    sheep.vx = Math.cos(sheep.yaw) * speed;
    sheep.vz = Math.sin(sheep.yaw) * speed;

    sheep.vy -= SHEEP_GRAVITY * dt;
    sheep.onGround = false;
    if (sheep.vy > 0) moveAxis(state, sheep, 'y', sheep.vy * dt);
    const movedX = moveAxis(state, sheep, 'x', sheep.vx * dt);
    const movedZ = moveAxis(state, sheep, 'z', sheep.vz * dt);
    if (sheep.vy <= 0) moveAxis(state, sheep, 'y', sheep.vy * dt);
    if (canWalk && (!movedX || !movedZ)) {
      sheep.yaw += Math.PI * (0.55 + Math.random() * 0.35);
      sheep.walkTimer = 0.5 + Math.random();
    }
  }

  function damageSheep3D(state, sheepId, amount = 1, sourceX = null, sourceZ = null) {
    const sheep = state.entities && Array.isArray(state.entities.sheep) ? state.entities.sheep : null;
    if (!sheep) return { hit: false, dead: false };
    const index = sheep.findIndex((item) => item.id === sheepId);
    if (index < 0) return { hit: false, dead: false };
    const target = sheep[index];
    initSheep(target);
    target.health -= amount;
    if (target.health <= 0) {
      sheep.splice(index, 1);
      return { hit: true, dead: true };
    }
    if (Number.isFinite(sourceX) && Number.isFinite(sourceZ)) {
      target.yaw = Math.atan2(target.z - sourceZ, target.x - sourceX);
    } else {
      target.yaw += Math.PI;
    }
    target.eating = false;
    target.eatTimer = 0;
    target.pauseTimer = 0;
    target.panicTimer = 1.4;
    target.walkTimer = 0.6 + Math.random() * 0.8;
    hopFromHit(target);
    return { hit: true, dead: false };
  }

  function spawnSheep3D(state, x, y, z) {
    if (!state || !state.world || !state.entities) return false;
    if (!inBounds3D(state.world, x, y, z)) return false;
    if (getBlock3D(state, x, y, z) !== BLOCK.AIR) return false;
    if (!hasSafeSupport(state, x, y - 1, z)) return false;
    const sheep = {
      id: `sheep-spawn-${Date.now().toString(36)}-${Math.floor(Math.random() * 100000).toString(36)}`,
      type: 'sheep',
      x: x + 0.5,
      y,
      z: z + 0.5,
      yaw: Math.random() * Math.PI * 2,
      vx: 0,
      vy: 0,
      vz: 0,
      walkTimer: 0.4 + Math.random() * 1.2,
      pauseTimer: 0,
      eatCooldown: 2 + Math.random() * 4,
      onGround: false,
    };
    if (!canOccupySheepAt(state, sheep.x, sheep.y, sheep.z)) return false;
    if (!Array.isArray(state.entities.sheep)) state.entities.sheep = [];
    state.entities.sheep.push(sheep);
    return true;
  }

  function updateEntities3D(state, dt) {
    const sheep = state.entities && Array.isArray(state.entities.sheep) ? state.entities.sheep : [];
    for (const item of sheep) updateSheep(state, item, dt);
  }

  Game.entities3d = { updateEntities3D, spawnSheep3D, isSafeSheepDirection, damageSheep3D };
})();
