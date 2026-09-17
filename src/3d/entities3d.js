(() => {
  const Game = window.CubDep;
  const { BLOCK } = Game.blocks;
  const { getBlock3D, setBlock3D, getGrassLevel3D, setGrassLevel3D, isBlockChunkLoaded3D, inBounds3D, isSolidBlock3D } = Game.world3d;
  const MIN_SCALE = 0.25;
  const MAX_SCALE = 1024;
  const SCALE_SPEED = Math.log(2) * 4;

  const MOB_CONFIG = {
    sheep: { health: 4, radius: 0.34, height: 0.86, speed: 0.85, panicSpeed: 1.35, gravity: 18, stepJump: 6.6, hitJump: 4.2, eatsGrass: true },
    boar: { health: 5, radius: 0.4, height: 0.72, speed: 1.0, panicSpeed: 1.75, gravity: 18, stepJump: 6.2, hitJump: 4.0, pauseScale: 0.7 },
    turtle: { health: 5, radius: 0.38, height: 0.42, speed: 0.34, panicSpeed: 0.62, gravity: 18, stepJump: 3.2, hitJump: 2.2, pauseScale: 1.8 },
    snake: { health: 3, radius: 0.38, height: 0.25, speed: 0.72, panicSpeed: 1.15, gravity: 18, stepJump: 2.0, hitJump: 1.2, pauseScale: 0.8 },
    goat: { health: 4, radius: 0.34, height: 0.82, speed: 1.05, panicSpeed: 1.8, gravity: 18, stepJump: 8.2, hitJump: 4.4, maxStepUp: 2 },
    fish: { health: 2, radius: 0.25, height: 0.25, speed: 0.62, panicSpeed: 1.25, hitJump: 0.8, waterMob: true },
    fox: { health: 3, radius: 0.32, height: 0.46, speed: 1.18, panicSpeed: 2.05, gravity: 18, stepJump: 5.8, hitJump: 3.4, pauseScale: 0.7 },
    bear: { health: 12, radius: 1.44, height: 2.7, speed: 0.62, panicSpeed: 1.05, gravity: 18, stepJump: 6.8, hitJump: 3.8, pauseScale: 1.45, maxStepUp: 2 },
    polar_bear: { health: 12, radius: 1.44, height: 2.7, speed: 0.62, panicSpeed: 1.05, gravity: 18, stepJump: 6.8, hitJump: 3.8, pauseScale: 1.45, maxStepUp: 2 },
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function mobScale(mob) {
    const scale = Number(mob && mob.scale);
    return Number.isFinite(scale) ? clamp(scale, MIN_SCALE, MAX_SCALE) : 1;
  }

  function mobConfig(mob) {
    const base = MOB_CONFIG[mob && mob.type] || MOB_CONFIG.sheep;
    const scale = mobScale(mob);
    if (scale === 1) return base;
    const config = {
      ...base,
      radius: base.radius * scale,
      height: base.height * scale,
    };
    if (Number.isFinite(base.speed)) config.speed = base.speed * scale;
    if (Number.isFinite(base.panicSpeed)) config.panicSpeed = base.panicSpeed * scale;
    if (Number.isFinite(base.stepJump)) config.stepJump = base.stepJump * Math.sqrt(scale);
    if (Number.isFinite(base.hitJump)) config.hitJump = base.hitJump * Math.sqrt(scale);
    return config;
  }

  function baseMobConfig(mob) {
    return MOB_CONFIG[mob && mob.type] || MOB_CONFIG.sheep;
  }

  function updateMobScale(mob, dt) {
    if (!mob) return;
    const current = mobScale(mob);
    const target = Number.isFinite(mob.targetScale) ? clamp(mob.targetScale, MIN_SCALE, MAX_SCALE) : current;
    if (Math.abs(current - target) <= 0.001) {
      mob.scale = target;
      mob.targetScale = target;
      return;
    }
    const currentLog = Math.log(current);
    const targetLog = Math.log(target);
    const step = SCALE_SPEED * dt;
    mob.scale = Math.exp(currentLog + Math.sign(targetLog - currentLog) * Math.min(Math.abs(targetLog - currentLog), step));
    mob.targetScale = target;
  }

  function initMob(mob) {
    if (!mob.type) mob.type = 'sheep';
    if (mob.type === 'polar_bear') {
      mob.type = 'bear';
      if (!mob.variant) mob.variant = 'snow';
    }
    if (mob.type === 'bear' && !mob.variant) mob.variant = 'brown';
    const config = baseMobConfig(mob);
    if (!Number.isFinite(mob.vx)) mob.vx = 0;
    if (!Number.isFinite(mob.vy)) mob.vy = 0;
    if (!Number.isFinite(mob.vz)) mob.vz = 0;
    if (!Number.isFinite(mob.walkTimer)) mob.walkTimer = 0.8 + Math.random() * 2.2;
    if (!Number.isFinite(mob.pauseTimer)) mob.pauseTimer = Math.random() * 1.4;
    if (!Number.isFinite(mob.eatCooldown)) mob.eatCooldown = 2 + Math.random() * 5;
    if (!Number.isFinite(mob.eatTimer)) mob.eatTimer = 0;
    if (!Number.isFinite(mob.jumpCooldown)) mob.jumpCooldown = 0;
    if (!Number.isFinite(mob.panicTimer)) mob.panicTimer = 0;
    if (!Number.isFinite(mob.hostileTimer)) mob.hostileTimer = 0;
    if (!Number.isFinite(mob.attackCooldown)) mob.attackCooldown = 0;
    if (!Number.isFinite(mob.scale)) mob.scale = 1;
    if (!Number.isFinite(mob.targetScale)) mob.targetScale = mob.scale;
    if (!Number.isFinite(mob.health)) mob.health = config.health;
    if (typeof mob.eating !== 'boolean') mob.eating = false;
    if (typeof mob.sleeping !== 'boolean') mob.sleeping = false;
    if (typeof mob.onGround !== 'boolean') mob.onGround = false;
  }

  function isFluidBlock(id) {
    return id === BLOCK.WATER || id === BLOCK.HOT_WATER || id === BLOCK.LAVA || id === BLOCK.VOLCANIC_LAVA;
  }

  function eruptionThreatForMob(state, mob) {
    if (!Game.generation3d || !Game.generation3d.getActiveVolcanicEruption3D) return null;
    return Game.generation3d.getActiveVolcanicEruption3D(state, mob.x, mob.z);
  }

  function updateVolcanicPanicMob(state, mob, threat, dt) {
    if (!threat || mobConfig(mob).waterMob) return false;
    const config = mobConfig(mob);
    const dx = mob.x - threat.x;
    const dz = mob.z - threat.z;
    const dist = Math.max(0.001, Math.hypot(dx, dz));
    const targetDist = Math.max(100, (threat.radius || 0) + 100);
    if (dist >= targetDist) return false;
    mob.sleeping = false;
    mob.eating = false;
    mob.digging = false;
    mob.panicTimer = 1.2;
    mob.pauseTimer = 0;
    mob.walkTimer = 0.2;
    mob.hostileTimer = 0;
    mob.attackCooldown = Math.max(mob.attackCooldown || 0, 0.4);
    mob.yaw = Math.atan2(dz, dx);
    const step = getSafeStep(state, mob, mob.yaw);
    if (step && step.y > Math.floor(mob.y)) tryStepJump(mob);
    const speed = step ? Math.max(config.panicSpeed || config.speed, (config.speed || 1) * 2.35) : 0;
    mob.vx = Math.cos(mob.yaw) * speed;
    mob.vz = Math.sin(mob.yaw) * speed;
    if (bearCanEnterWater(mob) && mob.inWater) mob.vy = Math.max(-0.08, Math.min(0.08, mob.vy || 0));
    else mob.vy -= config.gravity * dt;
    mob.onGround = false;
    if (mob.vy > 0) moveAxis(state, mob, 'y', mob.vy * dt);
    const movedX = moveAxis(state, mob, 'x', mob.vx * dt);
    const movedZ = moveAxis(state, mob, 'z', mob.vz * dt);
    if (mob.vy <= 0) moveAxis(state, mob, 'y', mob.vy * dt);
    if (!step || !movedX || !movedZ) {
      mob.yaw += (Math.random() - 0.5) * 0.8;
      tryStepJump(mob);
    }
    return true;
  }

  function applyVolcanicSteamLiftToMob(state, mob) {
    if (!mob || mobConfig(mob).waterMob) return false;
    const generation = Game.generation3d;
    if (!generation || !generation.getActiveVolcanicVents3D) return false;
    const config = mobConfig(mob);
    const vents = generation.getActiveVolcanicVents3D(state);
    for (const vent of vents) {
      const liftRadius = Math.max(1.2, (vent.radius || 2.4) + config.radius);
      const dx = mob.x - (vent.x + 0.5);
      const dz = mob.z - (vent.z + 0.5);
      if (dx * dx + dz * dz > liftRadius * liftRadius) continue;
      const baseY = vent.y + 0.6;
      const topY = baseY + (vent.height || 15);
      if (mob.y + config.height < baseY || mob.y > topY + 0.32) continue;
      const remaining = topY - mob.y;
      const ratio = clamp(remaining / Math.max(0.1, vent.height || 15), 0, 1);
      mob.sleeping = false;
      mob.eating = false;
      mob.vy = Math.max(mob.vy || 0, 6.5 + ratio * 6.2);
      mob.onGround = false;
      return true;
    }
    return false;
  }

  function bearCanEnterWater(mob) {
    return mob && mob.type === 'bear' && mob.variant !== 'snow';
  }

  function isBlockingMob(mob, id) {
    if (bearCanEnterWater(mob) && id === BLOCK.WATER) return false;
    return isSolidBlock3D(id) || isFluidBlock(id);
  }

  function isLoadedMobCell(world, x, y, z) {
    return !isBlockChunkLoaded3D || isBlockChunkLoaded3D(world, x, y, z);
  }

  function overlapsBlocking(state, mob, x, y, z) {
    const world = state.world;
    const config = mobConfig(mob);
    const radius = config.radius;
    const height = config.height;
    if (!world || x - radius < 0 || x + radius >= world.w || y < 0 || y + height >= world.h || z - radius < 0 || z + radius >= world.d) return true;
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
          if (!isLoadedMobCell(world, xx, yy, zz)) return true;
          if (isBlockingMob(mob, getBlock3D(state, xx, yy, zz))) return true;
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

  function updateExplosionKnockbackMob(state, mob, dt) {
    if (!mob || !(mob.explosionKnockbackTimer > 0)) return false;
    const config = mobConfig(mob);
    mob.explosionKnockbackTimer = Math.max(0, mob.explosionKnockbackTimer - dt);
    mob.eating = false;
    mob.sleeping = false;
    mob.pauseTimer = 0;
    if (!config.waterMob) mob.vy -= config.gravity * dt;
    mob.onGround = false;
    if (mob.vy > 0) moveAxis(state, mob, 'y', mob.vy * dt);
    moveAxis(state, mob, 'x', mob.vx * dt);
    moveAxis(state, mob, 'z', mob.vz * dt);
    if (mob.vy <= 0) moveAxis(state, mob, 'y', mob.vy * dt);
    if (mob.explosionKnockbackTimer <= 0) {
      mob.vx *= 0.35;
      mob.vz *= 0.35;
    }
    return true;
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
    if (!isLoadedMobCell(state.world, x, groundY, z)) return false;
    const id = getBlock3D(state, x, groundY, z);
    return isSolidBlock3D(id) && !isFluidBlock(id);
  }

  function findSafeStepY(state, mob, x, z) {
    const config = mobConfig(mob);
    const baseY = Math.floor(mob.y);
    const blockX = Math.floor(x);
    const blockZ = Math.floor(z);
    const footBlock = getBlock3D(state, blockX, baseY, blockZ);
    if (bearCanEnterWater(mob) && footBlock === BLOCK.WATER && canOccupyAt(state, mob, x, baseY, z)) return baseY;
    if (isFluidBlock(footBlock)) return null;
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

  function findNearestTree(state, mob, radius = 36) {
    const woodIds = new Set([BLOCK.WOOD, BLOCK.SPRUCE_WOOD]);
    const mx = Math.floor(mob.x);
    const my = Math.floor(mob.y);
    const mz = Math.floor(mob.z);
    let best = null;
    for (let dz = -radius; dz <= radius; dz += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const distSq = dx * dx + dz * dz;
        if (distSq > radius * radius) continue;
        const x = mx + dx;
        const z = mz + dz;
        for (let y = Math.min(state.world.h - 2, my + 8); y >= Math.max(1, my - 5); y -= 1) {
          if (!woodIds.has(getBlock3D(state, x, y, z))) continue;
          if (!best || distSq < best.distSq) best = { x, y, z, distSq };
          break;
        }
      }
    }
    return best;
  }

  function updateBearDenTask(state, mob, dt) {
    if (mob.type !== 'bear' || !mob.denTask || mob.denTask === 'done') return false;
    mob.sleeping = false;
    mob.eating = false;
    mob.panicTimer = 0;
    mob.inWater = getBlock3D(state, Math.floor(mob.x), Math.floor(mob.y), Math.floor(mob.z)) === BLOCK.WATER;
    mob.digging = false;

    function startDigging() {
      mob.denTask = 'digging';
      mob.digTimer = 3.2;
      mob.digging = true;
      mob.vx = 0;
      mob.vz = 0;
      const frontX = Math.floor(mob.x + Math.cos(mob.yaw || 0) * 3);
      const frontZ = Math.floor(mob.z + Math.sin(mob.yaw || 0) * 3);
      const madeDen = Game.generation3d && Game.generation3d.createBearDenAt3D
        ? Game.generation3d.createBearDenAt3D(state, frontX, frontZ, { allowNearSpawn: true, loose: true })
        : null;
      if (madeDen) {
        mob.denMade = madeDen;
        mob.denTarget = { x: madeDen.x, y: madeDen.y, z: madeDen.z };
        mob.yaw = Number.isFinite(madeDen.yaw) ? madeDen.yaw : mob.yaw;
      }
      mob.denStuckTimer = 0;
      return true;
    }

    function stepTowardTarget(target, speedScale = 1) {
      if (!target) return false;
      const dx = target.x + 0.5 - mob.x;
      const dz = target.z + 0.5 - mob.z;
      mob.yaw = Math.atan2(dz, dx);
      const step = getSafeStep(state, mob, mob.yaw);
      if (!step) {
        mob.denStuckTimer = (mob.denStuckTimer || 0) + dt;
        mob.vx = 0;
        mob.vz = 0;
        mob.vy -= mobConfig(mob).gravity * dt;
        mob.onGround = false;
        if (mob.vy > 0) moveAxis(state, mob, 'y', mob.vy * dt);
        if (mob.vy <= 0) moveAxis(state, mob, 'y', mob.vy * dt);
        return false;
      }
      mob.denStuckTimer = 0;
      const speed = mobConfig(mob).speed * speedScale;
      mob.vx = Math.cos(mob.yaw) * speed;
      mob.vz = Math.sin(mob.yaw) * speed;
      if (bearCanEnterWater(mob) && mob.inWater) mob.vy = Math.max(-0.08, Math.min(0.08, mob.vy || 0));
      else mob.vy -= mobConfig(mob).gravity * dt;
      mob.onGround = false;
      if (mob.vy > 0) moveAxis(state, mob, 'y', mob.vy * dt);
      moveAxis(state, mob, 'x', mob.vx * dt);
      moveAxis(state, mob, 'z', mob.vz * dt);
      if (mob.vy <= 0) moveAxis(state, mob, 'y', mob.vy * dt);
      return true;
    }

    if (mob.denTask === 'dig_here') {
      return startDigging();
    }

    if (mob.denTask === 'find_tree') {
      const tree = findNearestTree(state, mob);
      if (!tree) {
        mob.denTarget = { x: Math.floor(mob.x) + Math.round(Math.cos(mob.yaw || 0) * 2), y: Math.floor(mob.y), z: Math.floor(mob.z) + Math.round(Math.sin(mob.yaw || 0) * 2) };
        return startDigging();
      }
      mob.denTarget = tree;
      mob.denTask = 'walk_to_tree';
    }

    if (mob.denTask === 'walk_to_tree') {
      const target = mob.denTarget;
      if (!target) {
        mob.denTask = 'find_tree';
        return true;
      }
      const dx = target.x + 0.5 - mob.x;
      const dz = target.z + 0.5 - mob.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= 3.2) {
        mob.yaw = Math.atan2(dz, dx);
        return startDigging();
      }
      stepTowardTarget(target, 1.15);
      if ((mob.denStuckTimer || 0) > 1.2) return startDigging();
      return true;
    }

    if (mob.denTask === 'leave_den') {
      const target = mob.denTarget;
      if (!target) {
        mob.denTask = 'done';
        return false;
      }
      const dx = target.x + 0.5 - mob.x;
      const dz = target.z + 0.5 - mob.z;
      if (Math.hypot(dx, dz) <= 1.2 || (mob.denStuckTimer || 0) > 2.5) {
        mob.denTask = 'done';
        mob.denTarget = null;
        mob.denStuckTimer = 0;
        return false;
      }
      stepTowardTarget(target, 1.05);
      return true;
    }

    if (mob.denTask === 'digging') {
      mob.digging = true;
      mob.digTimer = Math.max(0, (mob.digTimer || 0) - dt);
      mob.vx = 0;
      mob.vz = 0;
      if (mob.denTarget) mob.yaw = Math.atan2(mob.denTarget.z + 0.5 - mob.z, mob.denTarget.x + 0.5 - mob.x);
      if (mob.digTimer <= 0) {
        const madeDen = mob.denMade || null;
        mob.denTask = 'done';
        mob.digging = false;
        mob.denMade = null;
        if (madeDen) {
          mob.x = madeDen.x + 0.5;
          mob.y = madeDen.y;
          mob.z = madeDen.z + 0.5;
          if (Number.isFinite(madeDen.yaw)) mob.yaw = madeDen.yaw;
          if (mob.variant === 'snow') mob.sleeping = true;
        }
      }
      return true;
    }

    return false;
  }

  function updateFish(state, fish, dt) {
    initMob(fish);
    const config = mobConfig(fish);
    if (updateExplosionKnockbackMob(state, fish, dt)) return;
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
    if (isLoadedMobCell(state.world, Math.floor(nx), Math.floor(ny), Math.floor(nz)) && getBlock3D(state, Math.floor(nx), Math.floor(ny), Math.floor(nz)) === BLOCK.WATER) {
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
    if (updateExplosionKnockbackMob(state, mob, dt)) return;
    mob.inWater = getBlock3D(state, Math.floor(mob.x), Math.floor(mob.y), Math.floor(mob.z)) === BLOCK.WATER;
    const eruptionThreat = eruptionThreatForMob(state, mob);
    if (updateVolcanicPanicMob(state, mob, eruptionThreat, dt)) return;
    if (mob.sleeping) {
      mob.vx = 0;
      mob.vy = 0;
      mob.vz = 0;
      mob.eating = false;
      mob.pauseTimer = Math.max(mob.pauseTimer || 0, 1);
      mob.panicTimer = 0;
      return;
    }
    if (updateBearDenTask(state, mob, dt)) return;
    mob.hostileTimer = Math.max(0, (mob.hostileTimer || 0) - dt);
    mob.attackCooldown = Math.max(0, (mob.attackCooldown || 0) - dt);
    if (updateHostileMob(state, mob, dt)) return;
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

    if (bearCanEnterWater(mob) && mob.inWater) mob.vy = Math.max(-0.08, Math.min(0.08, mob.vy || 0));
    else mob.vy -= config.gravity * dt;
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

  function hostileStats(mob) {
    if (!mob) return null;
    if (mob.type === 'snake') return { damage: 8, range: 1.25, cooldown: 1.45, chase: 7, speed: 1.05, always: true, label: 'змея' };
    if (mob.type === 'boar') return { damage: 12, range: 1.45, cooldown: 1.7, chase: 12, speed: 1.35, label: 'кабан' };
    if (mob.type === 'bear') return { damage: 25, range: 2.25, cooldown: 1.5, chase: 18, speed: 1.18, label: 'медведь' };
    if (mob.type === 'goat') return { damage: 10, range: 1.45, cooldown: 1.8, chase: 10, speed: 1.35, label: 'горный козел' };
    return null;
  }

  function updateHostileMob(state, mob, dt) {
    const stats = hostileStats(mob);
    const player = state && state.player;
    if (!state || !state.worldMeta || state.worldMeta.mode !== 'survival') return false;
    if (!stats || !player || mob.eating || mob.digging) return false;
    const dx = player.x - mob.x;
    const dy = player.y - mob.y;
    const dz = player.z - mob.z;
    const flatDist = Math.hypot(dx, dz);
    const verticalOk = Math.abs(dy) <= Math.max(2.4, mobConfig(mob).height + 0.8);
    const active = stats.always ? flatDist <= stats.chase && verticalOk : (mob.hostileTimer || 0) > 0 && flatDist <= stats.chase * 1.7 && verticalOk;
    if (!active) return false;

    mob.sleeping = false;
    mob.eating = false;
    mob.panicTimer = 0;
    mob.pauseTimer = 0;
    mob.walkTimer = Math.max(mob.walkTimer || 0, 0.25);
    mob.yaw = Math.atan2(dz, dx);
    if (flatDist <= stats.range && mob.attackCooldown <= 0) {
      if (Game.player3d && Game.player3d.applyPlayerDamage3D) {
        Game.player3d.applyPlayerDamage3D(state, stats.damage, stats.label, { cooldown: 0.45 });
      }
      mob.attackCooldown = stats.cooldown;
      mob.vx = 0;
      mob.vz = 0;
      return true;
    }

    const step = getSafeStep(state, mob, mob.yaw);
    const config = mobConfig(mob);
    if (step && step.y > Math.floor(mob.y)) tryStepJump(mob);
    const speed = step ? Math.max(config.speed, stats.speed) : 0;
    mob.vx = Math.cos(mob.yaw) * speed;
    mob.vz = Math.sin(mob.yaw) * speed;
    if (bearCanEnterWater(mob) && mob.inWater) mob.vy = Math.max(-0.08, Math.min(0.08, mob.vy || 0));
    else mob.vy -= config.gravity * dt;
    mob.onGround = false;
    if (mob.vy > 0) moveAxis(state, mob, 'y', mob.vy * dt);
    const movedX = moveAxis(state, mob, 'x', mob.vx * dt);
    const movedZ = moveAxis(state, mob, 'z', mob.vz * dt);
    if (mob.vy <= 0) moveAxis(state, mob, 'y', mob.vy * dt);
    if (!step || !movedX || !movedZ) {
      mob.yaw += Math.PI * (0.5 + Math.random() * 0.35);
      mob.walkTimer = 0.45 + Math.random() * 0.5;
    }
    return true;
  }

  function updateMob(state, mob, dt) {
    updateMobScale(mob, dt);
    if (mobConfig(mob).waterMob) updateFish(state, mob, dt);
    else {
      updateGroundMob(state, mob, dt);
      applyVolcanicSteamLiftToMob(state, mob);
    }
  }

  function damageSheep3D(state, mobId, amount = 1, sourceX = null, sourceZ = null) {
    const mobs = state.entities && Array.isArray(state.entities.sheep) ? state.entities.sheep : null;
    if (!mobs) return { hit: false, dead: false };
    const index = mobs.findIndex((item) => item.id === mobId);
    if (index < 0) return { hit: false, dead: false };
    const target = mobs[index];
    initMob(target);
    if (target.sleeping) {
      target.sleeping = false;
      if (target.variant === 'snow') {
        target.denTask = 'done';
        target.digging = false;
        target.denMade = null;
        target.denTarget = null;
      }
      target.eating = false;
      target.eatTimer = 0;
      target.pauseTimer = 0.8;
      target.panicTimer = 0;
      if (target.type === 'bear') target.hostileTimer = 18;
      target.walkTimer = 0.8 + Math.random() * 0.8;
      target.vx = 0;
      target.vz = 0;
      return { hit: true, dead: false, woke: true };
    }
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
    if (hostileStats(target) && target.type !== 'snake') {
      target.hostileTimer = target.type === 'bear' ? 18 : 10;
      target.panicTimer = 0;
    } else {
      target.panicTimer = 1.4;
    }
    target.walkTimer = 0.6 + Math.random() * 0.8;
    hopFromHit(target);
    return { hit: true, dead: false };
  }

  function spawnMob3D(state, type, x, y, z, id = null, options = {}) {
    if (!state || !state.world || !state.entities) return false;
    const mob = {
      id: id || `${type}-spawn-${Date.now().toString(36)}-${Math.floor(Math.random() * 100000).toString(36)}`,
      type,
      x: x + 0.5,
      y,
      z: z + 0.5,
      yaw: Math.random() * Math.PI * 2,
    };
    if (options && options.variant) mob.variant = options.variant;
    if (options && options.sleeping) mob.sleeping = true;
    if (options && options.denTask) mob.denTask = options.denTask;
    if (options && options.denTarget) mob.denTarget = { ...options.denTarget };
    if (Number.isFinite(options && options.yaw)) mob.yaw = options.yaw;
    initMob(mob);
    if (mobConfig(mob).waterMob) {
      if (!isLoadedMobCell(state.world, x, y, z)) return false;
      if (getBlock3D(state, x, y, z) !== BLOCK.WATER) return false;
    } else {
      if (!inBounds3D(state.world, x, y, z)) return false;
      if (!isLoadedMobCell(state.world, x, y, z)) return false;
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
