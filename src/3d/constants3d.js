(() => {
  const Game = window.CubDep;
  const CHUNK_RENDER_DISTANCE = 8;
  const CHUNK_UNLOAD_DISTANCE = 10;
  const CHUNK_RENDER_DISTANCE_AUTO = 'auto';
  const CHUNK_RENDER_DISTANCE_MIN = 1;
  const CHUNK_RENDER_DISTANCE_MAX = 10;

  function normalizeChunkRenderDistance(value) {
    if (value === CHUNK_RENDER_DISTANCE_AUTO || value === '' || value == null) return CHUNK_RENDER_DISTANCE_AUTO;
    const number = Number(value);
    if (!Number.isFinite(number)) return CHUNK_RENDER_DISTANCE_AUTO;
    const rounded = Math.round(number);
    if (rounded < CHUNK_RENDER_DISTANCE_MIN || rounded > CHUNK_RENDER_DISTANCE_MAX) return CHUNK_RENDER_DISTANCE_AUTO;
    return rounded;
  }

  function getChunkRenderDistanceValue(worldMeta) {
    if (worldMeta && worldMeta.superOptimization) return 1;
    const normalized = normalizeChunkRenderDistance(worldMeta && worldMeta.chunkRenderDistance);
    return normalized === CHUNK_RENDER_DISTANCE_AUTO ? CHUNK_RENDER_DISTANCE : normalized;
  }

  function isManualChunkRenderDistance(worldMeta) {
    return normalizeChunkRenderDistance(worldMeta && worldMeta.chunkRenderDistance) !== CHUNK_RENDER_DISTANCE_AUTO;
  }

  // Retained for callers; optimization does not change the simulation area.
  function isActiveSimulationPosition3D() {
    return true;
  }

  Game.constants3d = {
    WORLD_W: 2048,
    WORLD_H: 128,
    WORLD_D: 2048,
    CHUNK_SIZE: 16,
    CHUNK_OPTIMIZATION_PRELOAD_RADIUS: 2,
    CHUNK_RENDER_DISTANCE,
    CHUNK_UNLOAD_DISTANCE,
    CHUNK_RENDER_DISTANCE_AUTO,
    CHUNK_RENDER_DISTANCE_MIN,
    CHUNK_RENDER_DISTANCE_MAX,
    CHUNK_START_SYNC_RADIUS: 2,
    CHUNK_WORKER_MAX_PENDING: 24,
    CHUNK_WORKER_MAX_COUNT: 4,
    CHUNK_SYNC_GENERATE_TIME_BUDGET_MS: 5,
    CHUNK_SYNC_GENERATE_MAX_TIME_BUDGET_MS: 10,
    CHUNK_SYNC_FALLBACK_RADIUS: 8,
    CHUNK_DECORATE_BUDGET: 2,
    CHUNK_DECORATE_MAX_BUDGET: 5,
    CHUNK_DECORATE_TIME_BUDGET_MS: 4,
    CHUNK_UNLOAD_COLUMN_BUDGET: 2,
    CHUNK_MESH_REBUILD_TIME_BUDGET_MS: 3,
    CHUNK_MESH_REBUILD_MAX_TIME_BUDGET_MS: 7,
    CHUNK_SAVE_BUDGET: 1,
    CAMERA_FAR_CHUNKS: 9,
    PLAYER_HEIGHT: 1.78,
    PLAYER_RADIUS: 0.32,
    EYE_HEIGHT: 1.58,
    GRAVITY: 24,
    WALK_SPEED: 5.2,
    SPRINT_MULTIPLIER: 1.55,
    JUMP_SPEED: 8.0,
    REACH_DISTANCE: 5.2,
    MOUSE_SENSITIVITY: 0.0022,
    MAX_PITCH: Math.PI * 0.47,
    isActiveSimulationPosition3D,
    normalizeChunkRenderDistance,
    getChunkRenderDistanceValue,
    isManualChunkRenderDistance,
  };
})();
