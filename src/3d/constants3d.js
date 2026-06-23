(() => {
  const Game = window.CubDep;

  Game.constants3d = {
    WORLD_W: 256,
    WORLD_H: 32,
    WORLD_D: 256,
    CHUNK_SIZE: 16,
    CHUNK_RENDER_DISTANCE: 8,
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
  };
})();
