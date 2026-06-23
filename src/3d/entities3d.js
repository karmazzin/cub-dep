(() => {
  const Game = window.CubDep;
  const { BLOCK } = Game.blocks;
  const { getBlock3D, setBlock3D, inBounds3D, isSolidBlock3D } = Game.world3d;

  const SHEEP_RADIUS = 0.34;
  const SHEEP_HEIGHT = 0.86;
  const SHEEP_SPEED = 0.85;
  const SHEEP_GRAVITY = 18;
  const SHEEP_EAT_TIME = 1.15;

  function initSheep(sheep) {
    if (!Number.isFinite(sheep.vx)) sheep.vx = 0;
    if (!Number.isFinite(sheep.vy)) sheep.vy = 0;
    if (!Number.isFinite(sheep.vz)) sheep.vz = 0;
    if (!Number.isFinite(sheep.walkTimer)) sheep.walkTimer = 0.8 + Math.random() * 2.2;
    if (!Number.isFinite(sheep.pauseTimer)) sheep.pauseTimer = Math.random() * 1.4;
    if (!Number.isFinite(sheep.eatCooldown)) sheep.eatCooldown = 2 + Math.random() * 5;
    if (!Number.isFinite(sheep.eatTimer)) sheep.eatTimer = 0;
    if (typeof sheep.eating !== 'boolean') sheep.eating = false;
    if (typeof sheep.onGround !== 'boolean') sheep.onGround = false;
  }

  function isBlockingSheep(state, id) {
    return isSolidBlock3D(id) || id === BLOCK.WATER || id === BLOCK.LAVA;
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

  function blockBelow(sheep) {
    return {
      x: Math.floor(sheep.x),
      y: Math.floor(sheep.y - 0.08),
      z: Math.floor(sheep.z),
    };
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
    if (getBlock3D(state, below.x, below.y, below.z) === BLOCK.GRASS) {
      setBlock3D(state, below.x, below.y, below.z, BLOCK.DIRT);
    }
    sheep.eating = false;
    sheep.eatTimer = 0;
    sheep.eatCooldown = 6 + Math.random() * 10;
  }

  function chooseDirection(sheep) {
    sheep.yaw += (Math.random() - 0.5) * Math.PI * 1.4;
    sheep.walkTimer = 1.2 + Math.random() * 3.2;
    sheep.pauseTimer = Math.random() < 0.34 ? 0.6 + Math.random() * 1.8 : 0;
  }

  function updateSheep(state, sheep, dt) {
    initSheep(sheep);
    sheep.eatCooldown = Math.max(0, sheep.eatCooldown - dt);

    if (sheep.eating) {
      sheep.eatTimer -= dt;
      if (sheep.eatTimer <= 0) finishEating(state, sheep);
    } else if (sheep.onGround && sheep.eatCooldown <= 0) {
      const below = blockBelow(sheep);
      if (getBlock3D(state, below.x, below.y, below.z) === BLOCK.GRASS) startEating(sheep);
      else sheep.eatCooldown = 2 + Math.random() * 4;
    }

    sheep.walkTimer -= dt;
    sheep.pauseTimer = Math.max(0, sheep.pauseTimer - dt);
    if (sheep.walkTimer <= 0) chooseDirection(sheep);

    const canWalk = !sheep.eating && sheep.pauseTimer <= 0;
    const speed = canWalk ? SHEEP_SPEED : 0;
    sheep.vx = Math.cos(sheep.yaw) * speed;
    sheep.vz = Math.sin(sheep.yaw) * speed;

    sheep.vy -= SHEEP_GRAVITY * dt;
    sheep.onGround = false;
    const movedX = moveAxis(state, sheep, 'x', sheep.vx * dt);
    const movedZ = moveAxis(state, sheep, 'z', sheep.vz * dt);
    moveAxis(state, sheep, 'y', sheep.vy * dt);
    if (canWalk && (!movedX || !movedZ)) {
      sheep.yaw += Math.PI * (0.55 + Math.random() * 0.35);
      sheep.walkTimer = 0.5 + Math.random();
    }
  }

  function updateEntities3D(state, dt) {
    const sheep = state.entities && Array.isArray(state.entities.sheep) ? state.entities.sheep : [];
    for (const item of sheep) updateSheep(state, item, dt);
  }

  Game.entities3d = { updateEntities3D };
})();
