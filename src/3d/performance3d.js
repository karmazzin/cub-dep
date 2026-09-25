(() => {
  const Game = window.CubDep;

  function isMobileOptimization3D(state) {
    return !!(state && state.worldMeta && state.worldMeta.superOptimization
      && ((window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
        || (window.innerWidth > 0 && window.innerWidth <= 820)));
  }

  function updateFrameBudget3D(state, frameMs, cpuMs) {
    if (!state) return;
    if (!state.worldMeta || !state.worldMeta.superOptimization) {
      state.performance3d = null;
      return;
    }
    const budget = state.performance3d || (state.performance3d = {
      frameMs: 1000 / 60, cpuMs: 0, scale: 1, slowMs: 0, fastMs: 0,
    });
    // Ignore suspended tabs and require sustained load before resizing buffers.
    if (!Number.isFinite(frameMs) || frameMs <= 0 || frameMs > 250) {
      budget.slowMs = 0;
      budget.fastMs = 0;
      return;
    }
    budget.frameMs += (frameMs - budget.frameMs) * 0.1;
    if (Number.isFinite(cpuMs)) budget.cpuMs += (cpuMs - budget.cpuMs) * 0.1;
    if (!isMobileOptimization3D(state)) {
      budget.scale = 1;
      budget.slowMs = 0;
      budget.fastMs = 0;
      return;
    }
    budget.slowMs = budget.frameMs > 18.5 ? budget.slowMs + frameMs : 0;
    budget.fastMs = budget.frameMs < 17.2 && budget.cpuMs < 12 ? budget.fastMs + frameMs : 0;
    if (budget.slowMs >= 750) {
      budget.scale = Math.max(0.5, Math.round((budget.scale - 0.1) * 10) / 10);
      budget.slowMs = 0;
      budget.fastMs = 0;
    } else if (budget.fastMs >= 4000) {
      budget.scale = Math.min(1, Math.round((budget.scale + 0.1) * 10) / 10);
      budget.fastMs = 0;
    }
  }

  function getRenderPixelRatio3D(state, width, height, deviceRatio) {
    if (isMobileOptimization3D(state)) {
      const scale = state.performance3d ? state.performance3d.scale : 1;
      const pixelCap = Math.sqrt(900000 / Math.max(1, width * height));
      return Math.min(deviceRatio || 1, 1, pixelCap) * scale;
    }
    return Math.min(deviceRatio || 1, 1.5);
  }

  function getMobileWorkBudget3D(state, normalBudget) {
    return isMobileOptimization3D(state) ? Math.min(normalBudget, 2) : normalBudget;
  }

  Game.performance3d = { updateFrameBudget3D, getRenderPixelRatio3D, isMobileOptimization3D, getMobileWorkBudget3D };
})();
