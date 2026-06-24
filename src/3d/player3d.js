(() => {
  const Game = window.CubDep;
  const { PLAYER_RADIUS, PLAYER_HEIGHT, GRAVITY, WALK_SPEED, SPRINT_MULTIPLIER, JUMP_SPEED, MOUSE_SENSITIVITY, MAX_PITCH } = Game.constants3d;
  const { BLOCK } = Game.blocks;
  const { getBlock3D, isSolidBlock3D } = Game.world3d;

  const PHYSICS_STEP = 1 / 120;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function overlapsSolid(state, x, y, z) {
    const minX = Math.floor(x - PLAYER_RADIUS);
    const maxX = Math.floor(x + PLAYER_RADIUS);
    const minY = Math.floor(y);
    const maxY = Math.floor(y + PLAYER_HEIGHT);
    const minZ = Math.floor(z - PLAYER_RADIUS);
    const maxZ = Math.floor(z + PLAYER_RADIUS);
    for (let yy = minY; yy <= maxY; yy += 1) {
      for (let zz = minZ; zz <= maxZ; zz += 1) {
        for (let xx = minX; xx <= maxX; xx += 1) {
          if (isSolidBlock3D(getBlock3D(state, xx, yy, zz))) return true;
        }
      }
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
    const minX = Math.floor(player.x - PLAYER_RADIUS);
    const maxX = Math.floor(player.x + PLAYER_RADIUS);
    const minY = Math.floor(player.y + 0.15);
    const maxY = Math.floor(player.y + PLAYER_HEIGHT * 0.82);
    const minZ = Math.floor(player.z - PLAYER_RADIUS);
    const maxZ = Math.floor(player.z + PLAYER_RADIUS);
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

  function overlapsColumn(player, x, z) {
    const minX = player.x - PLAYER_RADIUS;
    const maxX = player.x + PLAYER_RADIUS;
    const minZ = player.z - PLAYER_RADIUS;
    const maxZ = player.z + PLAYER_RADIUS;
    return x < maxX && x + 1 > minX && z < maxZ && z + 1 > minZ;
  }

  function getPlayerGeyserLift(state) {
    const fluids = Game.fluids3d;
    if (!fluids || !fluids.getGeyserInfo3D) return null;
    const player = state.player;
    const minX = Math.floor(player.x - PLAYER_RADIUS);
    const maxX = Math.floor(player.x + PLAYER_RADIUS);
    const minZ = Math.floor(player.z - PLAYER_RADIUS);
    const maxZ = Math.floor(player.z + PLAYER_RADIUS);
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
          if (player.y + PLAYER_HEIGHT < baseY || player.y > topY + 0.24) continue;
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

  function updatePlayer3D(state, inputState, mouse, dt) {
    const player = state.player;
    player.yaw -= mouse.dx * MOUSE_SENSITIVITY;
    player.pitch = clamp(player.pitch - mouse.dy * MOUSE_SENSITIVITY, -MAX_PITCH, MAX_PITCH);

    const forward = (inputState.keys.KeyW ? 1 : 0) - (inputState.keys.KeyS ? 1 : 0);
    const strafe = (inputState.keys.KeyD ? 1 : 0) - (inputState.keys.KeyA ? 1 : 0);
    const inLiquid = isInLiquid(state);
    const sprinting = !inLiquid && (inputState.keys.ShiftLeft || inputState.keys.ShiftRight);
    const speed = (inLiquid ? WALK_SPEED * 0.55 : WALK_SPEED) * (sprinting ? SPRINT_MULTIPLIER : 1);
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

    if (inLiquid) {
      player.vy *= 0.82;
      if (inputState.keys.Space) player.vy = Math.max(player.vy, 3.2);
    } else if (inputState.keys.Space && player.onGround) {
      player.vy = JUMP_SPEED;
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

    if (player.y < -12) {
      player.x = state.world.w / 2 + 0.5;
      player.y = state.world.h;
      player.z = state.world.d / 2 + 0.5;
      player.vy = 0;
    }
  }

  Game.player3d = { updatePlayer3D };
})();
