(() => {
  const Game = window.CubDep;
  const { BLOCK } = Game.blocks;
  const { getBlock3D, setBlock3D, getGrassLevel3D, setGrassLevel3D, inBounds3D, isSolidBlock3D } = Game.world3d;

  const MOB_CONFIG = {
    sheep: { health: 4, radius: 0.34, height: 0.86, speed: 0.85, panicSpeed: 1.35, gravity: 18, stepJump: 6.6, hitJump: 4.2, eatsGrass: true },
    boar: { health: 5, radius: 0.4, height: 0.72, speed: 1.0, panicSpeed: 1.75, gravity: 18, stepJump: 6.2, hitJump: 4.0, pauseScale: 0.7 },
    turtle: { health: 5, radius: 0.38, height: 0.42, speed: 0.34, panicSpeed: 0.62, gravity: 18, stepJump: 3.2, hitJump: 2.2, pauseScale: 1.8 },
    snake: { health: 3, radius: 0.38, height: 0.25, speed: 0.72, panicSpeed: 1.15, gravity: 18, stepJump: 2.0, hitJump: 1.2, pauseScale: 0.8 },
    goat: { health: 4, radius: 0.34, height: 0.82, speed: 1.05, panicSpeed: 1.8, gravity: 18, stepJump: 8.2, hitJump: 4.4, maxStepUp: 2 },
    fish: { health: 2, radius: 0.25, height: 0.25, speed: 0.62, panicSpeed: 1.25, hitJump: 0.8, waterMob: true },
  };

  function mobConfig(mob) {
    return MOB_CONFIG[mob && mob.type] || MOB_CONFIG.sheep;
  }

  function initMob(mob) {
    if (!mob.type) mob.type = 'sheep';
    const config = mobConfig(mob);
    if (!Number.isFinite(mob.vx)) mob.vx = 0;
    if (!Number.isFinite(mob.vy)) mob.vy = 0;
    if (!Number.isFinite(mob.vz)) mob.vz = 0;
    if (!Number.isFinite(mob.walkTimer)) mob.walkTimer = 0.8 + Math.random() * 2.2;
    if (!Number.isFinite(mob.pauseTimer)) mob.pauseTimer = Math.random() * 1.4;
    if (!Number.isFinite(mob.eatCooldown)) mob.eatCooldown = 2 + Math.random() * 5;
    if (!Number.isFinite(mob.eatTimer)) mob.eatTimer = 0;
    if (!Number.isFinite(mob.jumpCooldown)) mob.jumpCooldown = 0;
    if (!Number.isFinite(mob.panicTimer)) mob.panicTimer = 0;
    if (!Number.isFinite(mob.health)) mob.health = config.health;
    if (typeof mob.eating !== 'boolean') mob.eating = false;
    if (typeof mob.onGround !== 'boolean') mob.onGround = false;
  }

  function isFluidBlock(id) {
    return id === BLOCK.WATER || id === BLOCK.HOT_WATER || id === BLOCK.LAVA;
  }

  function isBlockingMob(id) {
    return isSolidBlock3D(id) || isFluidBlock(id);
  }

  function overlapsBlocking(state, mob, x, y, z) {
    const world = state.world;
    const config = mobConfig(mob);
    const radius = config.radius;
    const height = config.height;
    const minX = Math.floor(x - radius);
    const maxX = Math.floor(x + radius);
    const minY = Math.floor(y);
    const maxY = Math.floor(y + height);
    const minZ = Math.floor(z - radius);
    const maxZ = Math.floor(z + radius);
    for (let yy = minY; yy <= maxY; yy += 1) {
      for (let zz = minZ; zz <= maxZ; zz += 1) {
        for (let xx = minX; xx <= maxX; xx += 1) {
          if (!inBounds3D(world, xx, yy, zz)) return true;
          if (isBlockingMob(getBlock3D(state, xx, yy, zz))) return true;
        }
      }
    }
    return false;
  }

  function canOccupyAt(state, mob, x, y, z) {
    return !overlapsBlocking(state, mob, x, y, z);
  }

  function moveAxis(state, mob, axis, delta) {
    if (delta === 0) return true;
    const next = { x: mob.x, y: mob.y, z: mob.z };
    next[axis] += delta;
    if (!overlapsBlocking(state, mob, next.x, next.y, next.z)) {
      mob[axis] = next[axis];
      return true;
    }
    if (axis === 'y') {
      if (delta < 0) mob.onGround = true;
      mob.vy = 0;
    } else {
      mob[axis === 'x' ? 'vx' : 'vz'] = 0;
    }
    return false;
  }

  function blockBelow(mob) {
    return {
      x: Math.floor(mob.x),
      y: Math.floor(mob.y - 0.08),
      z: Math.floor(mob.z),
    };
  }

  function hasSafeSupport(state, x, groundY, z) {
    if (!inBounds3D(state.world, x, groundY, z)) return false;
    const id = getBlock3D(state, x, groundY, z);
    return isSolidBlock3D(id) && !isFluidBlock(id);
  }

  function findSafeStepY(state, mob, x, z) {
    const config = mobConfig(mob);
    const baseY = Math.floor(mob.y);
    const blockX = Math.floor(x);
    const blockZ = Math.floor(z);
    if (isFluidBlock(getBlock3D(state, blockX, baseY, blockZ))) return null;
    if (canOccupyAt(state, mob, x, baseY, z) && hasSafeSupport(state, blockX, baseY - 1, blockZ)) return baseY;
    if (canOccupyAt(state, mob, x, baseY - 1, z) && hasSafeSupport(state, blockX, baseY - 2, blockZ)) return baseY - 1;
    if (canOccupyAt(state, mob, x, baseY + 1, z) && hasSafeSupport(state, blockX, baseY, blockZ)) return baseY + 1;
    if ((config.maxStepUp || 1) >= 2 && canOccupyAt(state, mob, x, baseY + 2, z) && hasSafeSupport(state, blockX, baseY + 1, blockZ)) return baseY + 2;
    return null;
  }

  function getSafeStep(state, mob, yaw) {
    const ahead = 1.0;
    const x = mob.x + Math.cos(yaw) * ahead;
    const z = mob.z + Math.sin(yaw) * ahead;
    const y = findSafeStepY(state, mob, x, z);
    return y === null ? null : { x, y, z };
  }

  function tryStepJump(mob) {
    const config = mobConfig(mob);
    if (!mob.onGround || mob.eating || mob.jumpCooldown > 0) return false;
    mob.vy = Math.max(mob.vy, config.stepJump);
    mob.onGround = false;
    mob.jumpCooldown = 0.5;
    return true;
  }

  function hopFromHit(mob) {
    const config = mobConfig(mob);
    mob.vy = Math.max(mob.vy, config.hitJump);
    mob.onGround = false;
    mob.jumpCooldown = Math.max(mob.jumpCooldown || 0, 0.35);
  }

  function startEating(mob) {
    mob.eating = true;
    mob.eatTimer = 1.15;
    mob.pauseTimer = Math.max(mob.pauseTimer || 0, 1.15);
    mob.vx = 0;
    mob.vz = 0;
  }

  function finishEating(state, mob) {
    const below = blockBelow(mob);
    if (getBlock3D(state, below.x, below.y, below.z) === BLOCK.DIRT && getGrassLevel3D(state, below.x, below.y, below.z) > 0) {
      setGrassLevel3D(state, below.x, below.y, below.z, 0);
    }
    mob.eating = false;
    mob.eatTimer = 0;
    mob.eatCooldown = 6 + Math.random() * 10;
  }

  function chooseDirection(state, mob) {
    const config = mobConfig(mob);
    const startYaw = mob.yaw;
    let found = false;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const yaw = startYaw + (Math.random() - 0.5) * Math.PI * 1.8;
      if (!getSafeStep(state, mob, yaw)) continue;
      mob.yaw = yaw;
      found = true;
      break;
    }
    if (!found) {
      mob.yaw = startYaw + Math.PI * (0.65 + Math.random() * 0.7);
      mob.pauseTimer = 0.45 + Math.random();
    }
    mob.walkTimer = (1.2 + Math.random() * 3.2) * (config.pauseScale || 1);
    if (found) mob.pauseTimer = Math.random() < 0.34 ? (0.6 + Math.random() * 1.8) * (config.pauseScale || 1) : mob.pauseTimer;
  }

  function updateFish(state, fish, dt) {
    initMob(fish);
    const config = mobConfig(fish);
    fish.panicTimer = Math.max(0, fish.panicTimer - dt);
    fish.walkTimer -= dt;
    const block = getBlock3D(state, Math.floor(fish.x), Math.floor(fish.y), Math.floor(fish.z));
    if (block !== BLOCK.WATER) {
      fish.y -= dt;
      return;
    }
    if (fish.walkTimer <= 0) {
      fish.yaw += (Math.random() - 0.5) * Math.PI * 1.6;
      fish.vy = (Math.random() - 0.5) * 0.25;
      fish.walkTimer = 1.0 + Math.random() * 2.4;
    }
    const speed = fish.panicTimer > 0 ? config.panicSpeed : config.speed;
    const nx = fish.x + Math.cos(fish.yaw) * speed * dt;
    const ny = fish.y + fish.vy * dt;
    const nz = fish.z + Math.sin(fish.yaw) * speed * dt;
    if (getBlock3D(state, Math.floor(nx), Math.floor(ny), Math.floor(nz)) === BLOCK.WATER) {
      fish.x = nx;
      fish.y = ny;
      fish.z = nz;
    } else {
      fish.yaw += Math.PI * (0.5 + Math.random() * 0.5);
      fish.vy *= -0.4;
      fish.walkTimer = 0.4 + Math.random() * 0.6;
    }
  }

  function updateGroundMob(state, mob, dt) {
    initMob(mob);
    const config = mobConfig(mob);
    mob.eatCooldown = Math.max(0, mob.eatCooldown - dt);
    mob.jumpCooldown = Math.max(0, mob.jumpCooldown - dt);
    mob.panicTimer = Math.max(0, mob.panicTimer - dt);

    if (mob.eating) {
      mob.eatTimer -= dt;
      if (mob.eatTimer <= 0) finishEating(state, mob);
    } else if (config.eatsGrass && mob.onGround && mob.eatCooldown <= 0) {
      const below = blockBelow(mob);
      if (getBlock3D(state, below.x, below.y, below.z) === BLOCK.DIRT && getGrassLevel3D(state, below.x, below.y, below.z) > 0) startEating(mob);
      else mob.eatCooldown = 2 + Math.random() * 4;
    }

    mob.walkTimer -= dt;
    mob.pauseTimer = Math.max(0, mob.pauseTimer - dt);
    if (mob.walkTimer <= 0) chooseDirection(state, mob);

    const canWalk = !mob.eating && (mob.pauseTimer <= 0 || mob.panicTimer > 0);
    let step = canWalk ? getSafeStep(state, mob, mob.yaw) : null;
    if (canWalk && !step) {
      chooseDirection(state, mob);
      step = mob.pauseTimer <= 0 ? getSafeStep(state, mob, mob.yaw) : null;
    }
    if (step && step.y > Math.floor(mob.y)) tryStepJump(mob);
    const speed = canWalk && step ? (mob.panicTimer > 0 ? config.panicSpeed : config.speed) : 0;
    mob.vx = Math.cos(mob.yaw) * speed;
    mob.vz = Math.sin(mob.yaw) * speed;

    mob.vy -= config.gravity * dt;
    mob.onGround = false;
    if (mob.vy > 0) moveAxis(state, mob, 'y', mob.vy * dt);
    const movedX = moveAxis(state, mob, 'x', mob.vx * dt);
    const movedZ = moveAxis(state, mob, 'z', mob.vz * dt);
    if (mob.vy <= 0) moveAxis(state, mob, 'y', mob.vy * dt);
    if (canWalk && (!movedX || !movedZ)) {
      mob.yaw += Math.PI * (0.55 + Math.random() * 0.35);
      mob.walkTimer = 0.5 + Math.random();
    }
  }

  function updateMob(state, mob, dt) {
    if (mobConfig(mob).waterMob) updateFish(state, mob, dt);
    else updateGroundMob(state, mob, dt);
  }

  function damageSheep3D(state, mobId, amount = 1, sourceX = null, sourceZ = null) {
    const mobs = state.entities && Array.isArray(state.entities.sheep) ? state.entities.sheep : null;
    if (!mobs) return { hit: false, dead: false };
    const index = mobs.findIndex((item) => item.id === mobId);
    if (index < 0) return { hit: false, dead: false };
    const target = mobs[index];
    initMob(target);
    target.health -= amount;
    if (target.health <= 0) {
      mobs.splice(index, 1);
      return { hit: true, dead: true };
    }
    if (Number.isFinite(sourceX) && Number.isFinite(sourceZ)) target.yaw = Math.atan2(target.z - sourceZ, target.x - sourceX);
    else target.yaw += Math.PI;
    target.eating = false;
    target.eatTimer = 0;
    target.pauseTimer = 0;
    target.panicTimer = 1.4;
    target.walkTimer = 0.6 + Math.random() * 0.8;
    hopFromHit(target);
    return { hit: true, dead: false };
  }

  function spawnMob3D(state, type, x, y, z, id = null) {
    if (!state || !state.world || !state.entities) return false;
    const mob = {
      id: id || `${type}-spawn-${Date.now().toString(36)}-${Math.floor(Math.random() * 100000).toString(36)}`,
      type,
      x: x + 0.5,
      y,
      z: z + 0.5,
      yaw: Math.random() * Math.PI * 2,
    };
    initMob(mob);
    if (mobConfig(mob).waterMob) {
      if (getBlock3D(state, x, y, z) !== BLOCK.WATER) return false;
    } else {
      if (!inBounds3D(state.world, x, y, z)) return false;
      if (getBlock3D(state, x, y, z) !== BLOCK.AIR) return false;
      if (!hasSafeSupport(state, x, y - 1, z)) return false;
      if (!canOccupyAt(state, mob, mob.x, mob.y, mob.z)) return false;
    }
    if (!Array.isArray(state.entities.sheep)) state.entities.sheep = [];
    state.entities.sheep.push(mob);
    return true;
  }

  function spawnSheep3D(state, x, y, z) {
    return spawnMob3D(state, 'sheep', x, y, z);
  }

  function updateEntities3D(state, dt) {
    const mobs = state.entities && Array.isArray(state.entities.sheep) ? state.entities.sheep : [];
    for (const mob of mobs) updateMob(state, mob, dt);
  }

  Game.entities3d = {
    updateEntities3D,
    spawnSheep3D,
    spawnMob3D,
    damageSheep3D,
    mobConfig,
  };
})();
