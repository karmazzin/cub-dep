(() => {
  const Game = window.CubDep;
  const { WORLD_W, WORLD_H, WORLD_D } = Game.constants3d;
  const { BLOCK } = Game.blocks;
  const { createWorld3D } = Game.world3d;

  function cloneSlot(slot) {
    if (!slot) return null;
    const copy = { id: slot.id, count: slot.count };
    if (slot.data) {
      try {
        copy.data = JSON.parse(JSON.stringify(slot.data));
      } catch (error) {
        copy.data = null;
      }
    }
    return copy;
  }

  function createGameState3D(worldMeta = null) {
    return {
      worldMeta: {
        id: worldMeta && worldMeta.id ? worldMeta.id : null,
        name: worldMeta && worldMeta.name ? worldMeta.name : 'Новый 3D мир',
        seed: worldMeta && worldMeta.seed ? worldMeta.seed : '',
        mode: worldMeta && worldMeta.mode ? worldMeta.mode : 'survival',
        chunkRenderDistance: Game.constants3d.normalizeChunkRenderDistance(worldMeta && worldMeta.chunkRenderDistance),
        spawnBiome: worldMeta && worldMeta.spawnBiome ? worldMeta.spawnBiome : 'any',
        kind: '3d',
        worldType: worldMeta && worldMeta.worldType ? worldMeta.worldType : 'normal',
        singleBiome: worldMeta && worldMeta.singleBiome ? worldMeta.singleBiome : 'forest',
        cavernBiome: worldMeta && worldMeta.cavernBiome ? worldMeta.cavernBiome : 'mix',
        currentDimension: worldMeta && worldMeta.currentDimension ? worldMeta.currentDimension : 'overworld',
        portalLinks: worldMeta && Array.isArray(worldMeta.portalLinks) ? worldMeta.portalLinks.map((link) => ({ ...link })) : [],
        dimensionPlayers: worldMeta && worldMeta.dimensionPlayers ? { ...worldMeta.dimensionPlayers } : {},
        education: worldMeta && worldMeta.education ? { ...worldMeta.education } : null,
        customLessonEditor: worldMeta && worldMeta.customLessonEditor ? { ...worldMeta.customLessonEditor } : null,
        customLessonPlay: worldMeta && worldMeta.customLessonPlay ? { ...worldMeta.customLessonPlay } : null,
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
        scale: worldMeta && worldMeta.player && Number.isFinite(worldMeta.player.scale)
          ? worldMeta.player.scale
          : 1,
        targetScale: worldMeta && worldMeta.player && Number.isFinite(worldMeta.player.targetScale)
          ? worldMeta.player.targetScale
          : (worldMeta && worldMeta.player && Number.isFinite(worldMeta.player.scale) ? worldMeta.player.scale : 1),
        inventory: worldMeta && worldMeta.player && Array.isArray(worldMeta.player.inventory)
          ? worldMeta.player.inventory.map(cloneSlot)
          : [],
        hotbar: worldMeta && worldMeta.player && Array.isArray(worldMeta.player.hotbar)
          ? worldMeta.player.hotbar.map(cloneSlot)
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
