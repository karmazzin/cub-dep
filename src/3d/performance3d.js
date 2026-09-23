(() => {
  const Game = window.CubDep;
  const PROFILES = [
    { level: 0, resolutionScale: 1, distantRadius: 6, sampleStep: 4 },
    { level: 1, resolutionScale: 0.85, distantRadius: 5, sampleStep: 4 },
    { level: 2, resolutionScale: 0.7, distantRadius: 4, sampleStep: 8 },
    { level: 3, resolutionScale: 0.55, distantRadius: 3, sampleStep: 8 },
    { level: 4, resolutionScale: 0.4, distantRadius: 2, sampleStep: 16 },
  ].map((profile) => Object.freeze(profile));

  function getQualityProfile3D(state) {
    const active = state && state.worldMeta && state.worldMeta.superOptimization;
    const level = active && state.performance3d ? state.performance3d.level : 0;
    const current = PROFILES[level] || PROFILES[0];
    const terrainLevel = active && state.performance3d ? Math.max(level, state.performance3d.terrainLevel || 0) : 0;
    const terrain = PROFILES[terrainLevel] || current;
    return { ...current, distantRadius: terrain.distantRadius, sampleStep: terrain.sampleStep };
  }

  function updateFrameBudget3D(state, frameMs, cpuMs) {
    if (!state) return;
    if (!state.worldMeta || !state.worldMeta.superOptimization) {
      state.performance3d = null;
      return;
    }
    const budget = state.performance3d || (state.performance3d = {
      level: 0, terrainLevel: 0, frameMs: 1000 / 60, cpuMs: 0, slowMs: 0, fastMs: 0,
    });
    // Background-tab pauses are not a measure of rendering throughput.
    if (!Number.isFinite(frameMs) || frameMs <= 0 || frameMs > 250) {
      budget.slowMs = 0;
      budget.fastMs = 0;
      return;
    }
    budget.frameMs += (frameMs - budget.frameMs) * 0.1;
    if (Number.isFinite(cpuMs)) budget.cpuMs += (cpuMs - budget.cpuMs) * 0.1;
    const slow = budget.frameMs > 17.8 || budget.cpuMs > 13;
    const spare = budget.frameMs < 17.3 && budget.cpuMs < 9;
    budget.slowMs = slow ? budget.slowMs + frameMs : 0;
    budget.fastMs = spare ? budget.fastMs + frameMs : 0;
    if (budget.slowMs >= 400 && budget.level < PROFILES.length - 1) {
      budget.level += 1;
      budget.slowMs = 0;
      budget.fastMs = 0;
    } else if (budget.fastMs >= 4000 && budget.level > 0) {
      budget.level -= 1;
      budget.fastMs = 0;
      budget.slowMs = 0;
    }
    // Resolution can recover, but distant terrain never oscillates back to
    // heavier geometry until optimization is switched off and on again.
    budget.terrainLevel = Math.max(budget.terrainLevel || 0, budget.level);
  }

  function getRenderPixelRatio3D(state, width, height, deviceRatio) {
    if (!state || !state.worldMeta || !state.worldMeta.superOptimization) return Math.min(deviceRatio || 1, 1.5);
    const base = Math.min(deviceRatio || 1, 1, 1280 / Math.max(1, width), 720 / Math.max(1, height));
    return base * getQualityProfile3D(state).resolutionScale;
  }

  Game.performance3d = { getQualityProfile3D, updateFrameBudget3D, getRenderPixelRatio3D };
})();
