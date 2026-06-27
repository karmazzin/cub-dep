(() => {
  const Game = window.CubDep;
  const { WORLD_W, WORLD_H, WORLD_D } = Game.constants3d;
  const { BLOCK } = Game.blocks;
  const { createWorld3D } = Game.world3d;

  function createGameState3D(worldMeta = null) {
    return {
      worldMeta: {
        id: worldMeta && worldMeta.id ? worldMeta.id : null,
        name: worldMeta && worldMeta.name ? worldMeta.name : 'Новый 3D мир',
        seed: worldMeta && worldMeta.seed ? worldMeta.seed : '',
        mode: worldMeta && worldMeta.mode ? worldMeta.mode : 'survival',
        kind: '3d',
        worldType: worldMeta && worldMeta.worldType ? worldMeta.worldType : 'normal',
        singleBiome: worldMeta && worldMeta.singleBiome ? worldMeta.singleBiome : 'forest',
        cavernBiome: worldMeta && worldMeta.cavernBiome ? worldMeta.cavernBiome : 'mix',
        currentDimension: worldMeta && worldMeta.currentDimension ? worldMeta.currentDimension : 'overworld',
        portalLinks: worldMeta && Array.isArray(worldMeta.portalLinks) ? worldMeta.portalLinks.map((link) => ({ ...link })) : [],
        dimensionPlayers: worldMeta && worldMeta.dimensionPlayers ? { ...worldMeta.dimensionPlayers } : {},
        createdAt: worldMeta && worldMeta.createdAt ? worldMeta.createdAt : Date.now(),
        updatedAt: worldMeta && worldMeta.updatedAt ? worldMeta.updatedAt : Date.now(),
        player: worldMeta && worldMeta.player ? { ...worldMeta.player } : null,
      },
      world: createWorld3D(WORLD_W, WORLD_H, WORLD_D),
      player: {
        x: WORLD_W / 2,
        y: WORLD_H,
        z: WORLD_D / 2,
        vx: 0,
        vy: 0,
        vz: 0,
        yaw: Math.PI,
        pitch: -0.42,
        onGround: false,
        selectedHotbarIndex: 0,
        selectedBlock: BLOCK.AIR,
        inventory: worldMeta && worldMeta.player && Array.isArray(worldMeta.player.inventory)
          ? worldMeta.player.inventory.map((slot) => slot ? { id: slot.id, count: slot.count } : null)
          : [],
        hotbar: worldMeta && worldMeta.player && Array.isArray(worldMeta.player.hotbar)
          ? worldMeta.player.hotbar.map((slot) => slot ? { id: slot.id, count: slot.count } : null)
          : [],
      },
      ui: {
        fps: 0,
        fpsFrames: 0,
        fpsAccum: 0,
        noticeText: '',
        noticeTimer: 0,
        pointerLocked: false,
        targetBlock: null,
        mineTarget: null,
        mineProgress: 0,
        mineBlock: BLOCK.AIR,
        minePulse: 0,
        mineSoundTimer: 0,
        mobileMoveX: 0,
        mobileMoveY: 0,
        mobileHotbarPage: 0,
        mapZoom: 1,
        mapCenterX: WORLD_W / 2,
        mapCenterZ: WORLD_D / 2,
        mapBitmap: null,
        mapBitmapKey: '',
        mapWaypoint: null,
      },
      entities: {
        sheep: [],
      },
      pause: {
        open: false,
      },
    };
  }

  Game.state3d = { createGameState3D };
})();
