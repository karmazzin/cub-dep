(() => {
  const Game = window.CubDep;

  function updateFrameBudget3D(state, frameMs, cpuMs) {
    if (!state) return;
    if (!state.worldMeta || !state.worldMeta.superOptimization) {
      state.performance3d = null;
      return;
    }
    const budget = state.performance3d || (state.performance3d = { frameMs: 1000 / 60, cpuMs: 0 });
    // Track throughput without changing graphics or simulation quality.
    if (!Number.isFinite(frameMs) || frameMs <= 0 || frameMs > 250) return;
    budget.frameMs += (frameMs - budget.frameMs) * 0.1;
    if (Number.isFinite(cpuMs)) budget.cpuMs += (cpuMs - budget.cpuMs) * 0.1;
  }

  function getRenderPixelRatio3D(state, width, height, deviceRatio) {
    return Math.min(deviceRatio || 1, 1.5);
  }

  Game.performance3d = { updateFrameBudget3D, getRenderPixelRatio3D };
})();
