(() => {
  const Game = window.CubDep;
  const { PLAYER_RADIUS, PLAYER_HEIGHT, GRAVITY, WALK_SPEED, SPRINT_MULTIPLIER, JUMP_SPEED, MOUSE_SENSITIVITY, MAX_PITCH } = Game.constants3d;
  const { BLOCK } = Game.blocks;
  const { getBlock3D, isSolidBlock3D } = Game.world3d;

  const PHYSICS_STEP = 1 / 120;
  const FLIGHT_SPEED_MULTIPLIER = 1.45;
  const FLIGHT_BOOST_MULTIPLIER = 2.35;
  const MIN_SCALE = 0.25;
  const MAX_SCALE = 1024;
  const SCALE_SPEED = Math.log(2) * 4;
  const MIN_COLLISION_RADIUS = 0.05;
  const MIN_COLLISION_HEIGHT = 0.22;
  const MAX_COLLISION_RADIUS = 8;
  const MAX_COLLISION_HEIGHT = 64;
  const DAMAGE_COOLDOWN = 0.65;
  const HAZARD_TICK = 0.55;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function playerScale(player) {
    const scale = Number(player && player.scale);
    return Number.isFinite(scale) ? clamp(scale, MIN_SCALE, MAX_SCALE) : 1;
  }

  function scaledRadius(player) {
    return clamp(PLAYER_RADIUS * playerScale(player), MIN_COLLISION_RADIUS, MAX_COLLISION_RADIUS);
  }

  function scaledHeight(player) {
    return clamp(PLAYER_HEIGHT * playerScale(player), MIN_COLLISION_HEIGHT, MAX_COLLISION_HEIGHT);
  }

  function updatePlayerScale(player, dt) {
    if (!player) return;
    const current = playerScale(player);
    const target = Number.isFinite(player.targetScale) ? clamp(player.targetScale, MIN_SCALE, MAX_SCALE) : current;
    if (Math.abs(current - target) <= 0.001) {
      player.scale = target;
      player.targetScale = target;
      return;
    }
    const currentLog = Math.log(current);
    const targetLog = Math.log(target);
    const step = SCALE_SPEED * dt;
    player.scale = Math.exp(currentLog + Math.sign(targetLog - currentLog) * Math.min(Math.abs(targetLog - currentLog), step));
    player.targetScale = target;
  }

  function overlapsSolid(state, x, y, z) {
    const world = state && state.world;
    if (!world) return true;
    const radius = scaledRadius(state.player);
    const height = scaledHeight(state.player);
    if (x - radius < 0 || x + radius >= world.w || y < 0 || z - radius < 0 || z + radius >= world.d) return true;
    const minX = Math.floor(x - radius);
    const maxX = Math.floor(x + radius);
    const minY = Math.max(0, Math.floor(y));
    const maxY = Math.min(world.h - 1, Math.floor(y + height));
    const minZ = Math.floor(z - radius);
    const maxZ = Math.floor(z + radius);
    if (minY > maxY) return false;
    for (let yy = minY; yy <= maxY; yy += 1) {
      for (let zz = minZ; zz <= maxZ; zz += 1) {
        for (let xx = minX; xx <= maxX; xx += 1) {
          const blockId = getBlock3D(state, xx, yy, zz);
          if (blockId === BLOCK.BORDER && state && state.worldMeta && state.worldMeta.customLessonEditor) continue;
          if (isSolidBlock3D(blockId)) return true;
          if (isCustomLessonBorderColumn(state, xx, zz)) return true;
        }
      }
    }
    return false;
  }

  function resolvePlayerOverlap(state) {
    const player = state && state.player;
    const world = state && state.world;
    if (!player || !world || !overlapsSolid(state, player.x, player.y, player.z)) return false;
    const radius = scaledRadius(player);
    const minX = radius + 0.01;
    const maxX = world.w - radius - 0.01;
    const minZ = radius + 0.01;
    const maxZ = world.d - radius - 0.01;
    if (minX > maxX || minZ > maxZ) return false;
    const baseX = clamp(player.x, minX, maxX);
    const baseZ = clamp(player.z, minZ, maxZ);
    const baseY = Math.max(0, player.y);
    const maxSearchY = world.h + 8;
    const horizontalLimit = Math.max(8, Math.ceil(radius) + 2);

    function tryCandidate(x, y, z) {
      if (overlapsSolid(state, x, y, z)) return false;
      player.x = x;
      player.y = y;
      player.z = z;
      player.vx = 0;
      player.vy = 0;
      player.vz = 0;
      player.onGround = false;
      return true;
    }

    for (let dy = 0; dy <= maxSearchY; dy += 1) {
      const upY = Math.min(maxSearchY, Math.ceil(baseY + dy));
      if (tryCandidate(baseX, upY, baseZ)) return true;
      const downY = Math.floor(baseY - dy);
      if (dy > 0 && downY >= 0 && tryCandidate(baseX, downY, baseZ)) return true;
    }

    for (let r = 1; r <= horizontalLimit; r += 1) {
      for (let dz = -r; dz <= r; dz += 1) {
        for (let dx = -r; dx <= r; dx += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const x = clamp(baseX + dx, minX, maxX);
          const z = clamp(baseZ + dz, minZ, maxZ);
          for (let dy = 0; dy <= maxSearchY; dy += 1) {
            const y = Math.min(maxSearchY, Math.ceil(baseY + dy));
            if (tryCandidate(x, y, z)) return true;
          }
        }
      }
    }
    return false;
  }

  function isCustomLessonBorderColumn(state, x, z) {
    const meta = state && state.worldMeta;
    if (!meta || meta.customLessonEditor || !meta.customLessonPlay) return false;
    if (!state.world || !Number.isFinite(BLOCK.BORDER)) return false;
    for (let y = 0; y < state.world.h; y += 1) {
      if (getBlock3D(state, x, y, z) === BLOCK.BORDER) return true;
    }
    return false;
  }

  function moveAxis(state, axis, delta) {
    const player = state.player;
    if (delta === 0) return;
    const next = { x: player.x, y: player.y, z: player.z };
    next[axis] += delta;
    if (!overlapsSolid(state, next.x, next.y, next.z)) {
      player[axis] = next[axis];
      return;
    }
    if (axis === 'y') {
      if (delta < 0) player.onGround = true;
      player.vy = 0;
    } else {
      player[axis === 'x' ? 'vx' : 'vz'] = 0;
    }
  }

  function isInLiquid(state) {
    const player = state.player;
    const radius = scaledRadius(player);
    const height = scaledHeight(player);
    const minX = Math.floor(player.x - radius);
    const maxX = Math.floor(player.x + radius);
    const minY = Math.floor(player.y + 0.15 * playerScale(player));
    const maxY = Math.floor(player.y + height * 0.82);
    const minZ = Math.floor(player.z - radius);
    const maxZ = Math.floor(player.z + radius);
    for (let yy = minY; yy <= maxY; yy += 1) {
      for (let zz = minZ; zz <= maxZ; zz += 1) {
        for (let xx = minX; xx <= maxX; xx += 1) {
          const id = getBlock3D(state, xx, yy, zz);
          if (id === BLOCK.WATER || id === BLOCK.HOT_WATER || id === BLOCK.LAVA) return true;
        }
      }
    }
    return false;
  }

  function getOverlappingBlocks(state) {
    const player = state.player;
    const radius = scaledRadius(player);
    const height = scaledHeight(player);
    const minX = Math.floor(player.x - radius);
    const maxX = Math.floor(player.x + radius);
    const minY = Math.floor(player.y + 0.08 * playerScale(player));
    const maxY = Math.floor(player.y + height * 0.9);
    const minZ = Math.floor(player.z - radius);
    const maxZ = Math.floor(player.z + radius);
    const ids = new Set();
    for (let yy = minY; yy <= maxY; yy += 1) {
      for (let zz = minZ; zz <= maxZ; zz += 1) {
        for (let xx = minX; xx <= maxX; xx += 1) ids.add(getBlock3D(state, xx, yy, zz));
      }
    }
    return ids;
  }

  function isSurvival(state) {
    return !!(state && state.worldMeta && state.worldMeta.mode === 'survival');
  }

  function setNotice(state, text, timer = 1.45) {
    if (!state || !state.ui) return;
    state.ui.noticeText = text;
    state.ui.noticeTimer = timer;
  }

  function fallbackSurfaceY(state, x, z) {
    if (!state || !state.world) return 1;
    const bx = clamp(Math.floor(x), 1, state.world.w - 2);
    const bz = clamp(Math.floor(z), 1, state.world.d - 2);
    for (let y = state.world.h - 2; y >= 1; y -= 1) {
      if (isSolidBlock3D(getBlock3D(state, bx, y, bz))) return Math.min(state.world.h - 2, y + 1);
    }
    return Math.min(state.world.h - 2, 1);
  }

  function respawnPosition(state) {
    const world = state && state.world;
    if (!world) return { x: 0.5, y: 1, z: 0.5 };
    const generation = Game.generation3d;
    const spawn = generation && generation.getWorldSpawn3D ? generation.getWorldSpawn3D(state) : null;
    const sx = spawn && Number.isFinite(spawn.x) ? spawn.x : Math.floor(world.w / 2);
    const sz = spawn && Number.isFinite(spawn.z) ? spawn.z : Math.floor(world.d / 2);
    const x = clamp(sx + 0.5, 0.5, world.w - 0.5);
    const z = clamp(sz + 0.5, 0.5, world.d - 0.5);
    const surfaceY = generation && generation.getSurfaceSpawnY3D
      ? generation.getSurfaceSpawnY3D(state, sx, sz)
      : fallbackSurfaceY(state, sx, sz);
    const y = clamp(Number.isFinite(surfaceY) ? surfaceY : fallbackSurfaceY(state, sx, sz), 1, world.h - 1);
    return { x, y, z };
  }

  function respawnPlayer(state) {
    const player = state.player;
    const spawn = respawnPosition(state);
    player.health = player.maxHealth || 100;
    player.damageCooldown = 1.2;
    player.damageFlash = 0;
    player.hazardTimer = 0;
    player.fallSpeed = 0;
    player.vx = 0;
    player.vy = 0;
    player.vz = 0;
    player.x = spawn.x;
    player.y = spawn.y;
    player.z = spawn.z;
    player.onGround = false;
    setNotice(state, 'Вы погибли и возродились', 2.4);
  }

  function applyPlayerDamage3D(state, amount, reason = 'урон', options = {}) {
    const player = state && state.player;
    if (!player || !isSurvival(state)) return false;
    if (!Number.isFinite(player.maxHealth) || player.maxHealth <= 0) player.maxHealth = 100;
    if (!Number.isFinite(player.health) || player.health <= 0) player.health = player.maxHealth;
    const ignoreCooldown = !!(options && options.ignoreCooldown);
    if (!ignoreCooldown && (player.damageCooldown || 0) > 0) return false;
    const damage = Math.max(0, Math.round(amount || 0));
    if (damage <= 0) return false;
    player.health = Math.max(0, player.health - damage);
    player.damageCooldown = Number.isFinite(options.cooldown) ? Math.max(0, options.cooldown) : DAMAGE_COOLDOWN;
    player.damageFlash = 0.28;
    setNotice(state, `Урон: ${reason} (-${damage})`, 1.4);
    if (player.health <= 0) respawnPlayer(state);
    return true;
  }

  function updateSurvivalHazards(state, dt, inLiquid) {
    const player = state.player;
    player.damageCooldown = Math.max(0, (player.damageCooldown || 0) - dt);
    player.damageFlash = Math.max(0, (player.damageFlash || 0) - dt);
    if (!isSurvival(state)) return;
    const blocks = getOverlappingBlocks(state);
    player.hazardTimer = Math.max(0, (player.hazardTimer || 0) - dt);
    if (player.hazardTimer <= 0) {
      if (blocks.has(BLOCK.LAVA)) {
        applyPlayerDamage3D(state, 8, 'лава', { ignoreCooldown: true, cooldown: 0.2 });
        player.hazardTimer = HAZARD_TICK;
      } else if (blocks.has(BLOCK.CACTUS)) {
        applyPlayerDamage3D(state, 2, 'кактус', { ignoreCooldown: true, cooldown: 0.15 });
        player.hazardTimer = HAZARD_TICK;
      }
    }
    if (inLiquid || player.vy >= 0) player.fallSpeed = 0;
    else player.fallSpeed = Math.max(player.fallSpeed || 0, -player.vy);
  }

  function overlapsColumn(player, x, z) {
    const radius = scaledRadius(player);
    const minX = player.x - radius;
    const maxX = player.x + radius;
    const minZ = player.z - radius;
    const maxZ = player.z + radius;
    return x < maxX && x + 1 > minX && z < maxZ && z + 1 > minZ;
  }

  function getPlayerGeyserLift(state) {
    const fluids = Game.fluids3d;
    if (!fluids || !fluids.getGeyserInfo3D) return null;
    const player = state.player;
    const radius = scaledRadius(player);
    const height = scaledHeight(player);
    const minX = Math.floor(player.x - radius);
    const maxX = Math.floor(player.x + radius);
    const minZ = Math.floor(player.z - radius);
    const maxZ = Math.floor(player.z + radius);
    const minY = Math.max(0, Math.floor(player.y - 8));
    const maxY = Math.min(state.world.h - 1, Math.floor(player.y + 1));
    let best = null;
    for (let y = minY; y <= maxY; y += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        for (let x = minX; x <= maxX; x += 1) {
          if (!overlapsColumn(player, x, z)) continue;
          const geyser = fluids.getGeyserInfo3D(state, x, y, z);
          if (!geyser) continue;
          const baseY = geyser.y + 0.9;
          const topY = baseY + geyser.height;
          if (player.y + height < baseY || player.y > topY + 0.24) continue;
          if (!best || topY > best.topY) best = { ...geyser, baseY, topY };
        }
      }
    }
    return best;
  }

  function applyGeyserLift(state) {
    const player = state.player;
    const lift = getPlayerGeyserLift(state);
    if (!lift) return false;
    const remaining = lift.topY - player.y;
    if (remaining > 0.08) {
      const ratio = clamp(remaining / Math.max(0.1, lift.height), 0, 1);
      player.vy = Math.max(player.vy, 5.5 + ratio * 5.2);
      player.onGround = false;
      return true;
    }
    if (player.y <= lift.topY + 0.24) {
      player.vy = Math.max(player.vy, 0);
      player.onGround = true;
      return true;
    }
    return false;
  }

  function updatePlayer3D(state, inputState, mouse, dt, actions = {}) {
    const player = state.player;
    if (!Number.isFinite(player.maxHealth) || player.maxHealth <= 0) player.maxHealth = 100;
    if (!Number.isFinite(player.health) || player.health <= 0) player.health = player.maxHealth;
    updatePlayerScale(player, dt);
    resolvePlayerOverlap(state);
    const scale = playerScale(player);
    const jumpScale = Math.sqrt(scale);
    player.yaw -= mouse.dx * MOUSE_SENSITIVITY;
    player.pitch = clamp(player.pitch - mouse.dy * MOUSE_SENSITIVITY, -MAX_PITCH, MAX_PITCH);
    const creative = state.worldMeta && state.worldMeta.mode === 'creative';
    if (!creative) {
      player.flying = false;
      player.flightBoost = false;
    } else if (actions.flyTogglePressed) {
      player.flying = !player.flying;
      if (player.flying) {
        player.vy = 0;
        player.onGround = false;
      }
      if (state.ui) {
        state.ui.noticeText = player.flying ? 'Полет включен' : 'Полет выключен';
        state.ui.noticeTimer = 1.35;
      }
    }
    if (creative && actions.boostTogglePressed) {
      player.flightBoost = !player.flightBoost;
      if (state.ui) {
        state.ui.noticeText = player.flightBoost ? 'Ускорение полета включено' : 'Ускорение полета выключено';
        state.ui.noticeTimer = 1.35;
      }
    }

    const mobileForward = Number.isFinite(inputState.mobileMoveY) ? -inputState.mobileMoveY : 0;
    const mobileStrafe = Number.isFinite(inputState.mobileMoveX) ? inputState.mobileMoveX : 0;
    const forward = clamp((inputState.keys.KeyW ? 1 : 0) - (inputState.keys.KeyS ? 1 : 0) + mobileForward, -1, 1);
    const strafe = clamp((inputState.keys.KeyD ? 1 : 0) - (inputState.keys.KeyA ? 1 : 0) + mobileStrafe, -1, 1);
    const inLiquid = isInLiquid(state);
    const wasOnGround = player.onGround;
    const impactSpeed = player.fallSpeed || 0;
    updateSurvivalHazards(state, dt, inLiquid);
    const descending = inputState.keys.ShiftLeft || inputState.keys.ShiftRight;
    const sprinting = !player.flying && !inLiquid && descending;
    const speed = (inLiquid ? WALK_SPEED * 0.55 : WALK_SPEED) * (sprinting ? SPRINT_MULTIPLIER : 1) * scale;
    const sin = Math.sin(player.yaw);
    const cos = Math.cos(player.yaw);
    let vx = (sin * forward - cos * strafe) * speed;
    let vz = (cos * forward + sin * strafe) * speed;
    if (forward !== 0 && strafe !== 0) {
      vx *= Math.SQRT1_2;
      vz *= Math.SQRT1_2;
    }
    player.vx = vx;
    player.vz = vz;

    if (creative && player.flying) {
      const boost = player.flightBoost ? FLIGHT_BOOST_MULTIPLIER : 1;
      const flightSpeed = WALK_SPEED * FLIGHT_SPEED_MULTIPLIER * boost * scale;
      const vertical = clamp((inputState.keys.Space || inputState.mobileJump ? 1 : 0) - (descending ? 1 : 0), -1, 1);
      player.vx = (sin * forward - cos * strafe) * flightSpeed;
      player.vz = (cos * forward + sin * strafe) * flightSpeed;
      if (forward !== 0 && strafe !== 0) {
        player.vx *= Math.SQRT1_2;
        player.vz *= Math.SQRT1_2;
      }
      player.vy = vertical * flightSpeed;
      player.onGround = false;
      let remaining = dt;
      while (remaining > 0) {
        const step = Math.min(PHYSICS_STEP, remaining);
        moveAxis(state, 'x', player.vx * step);
        moveAxis(state, 'z', player.vz * step);
        moveAxis(state, 'y', player.vy * step);
        remaining -= step;
      }
      return;
    }

    if (inLiquid) {
      player.vy *= 0.82;
      if (inputState.keys.Space || inputState.mobileJump) player.vy = Math.max(player.vy, 3.2 * jumpScale);
    } else if ((inputState.keys.Space || inputState.mobileJump) && player.onGround) {
      player.vy = JUMP_SPEED * jumpScale;
      player.onGround = false;
    }

    player.onGround = false;
    let remaining = dt;
    while (remaining > 0) {
      const step = Math.min(PHYSICS_STEP, remaining);
      player.vy -= (inLiquid ? GRAVITY * 0.24 : GRAVITY) * step;
      applyGeyserLift(state);
      moveAxis(state, 'x', player.vx * step);
      moveAxis(state, 'z', player.vz * step);
      moveAxis(state, 'y', player.vy * step);
      remaining -= step;
    }

    if (!wasOnGround && player.onGround && !inLiquid && impactSpeed > 11) {
      applyPlayerDamage3D(state, (impactSpeed - 10) * 4, 'падение', { cooldown: 0.35 });
      player.fallSpeed = 0;
    }

    if (player.y < -12) {
      const spawn = respawnPosition(state);
      player.x = spawn.x;
      player.y = spawn.y;
      player.z = spawn.z;
      player.vx = 0;
      player.vy = 0;
      player.vz = 0;
    }
  }

  Game.player3d = { updatePlayer3D, applyPlayerDamage3D };
})();
