(() => {
  const Game = window.CubDep;
  const CAVERN_FALL_ID = 'cavern_fall';
  const CAVERN_FALL_URL = 'https://karmazzin.github.io/Cavernfall/';

  function resolveCavernFallSelection(selection, random = Math.random) {
    if (selection !== CAVERN_FALL_ID) {
      return { easterEgg: '', cavernFallAxis: '' };
    }
    return {
      easterEgg: CAVERN_FALL_ID,
      cavernFallAxis: random() < 0.5 ? 'x' : 'z',
    };
  }

  function shouldShowCavernFallLink(worldMeta, worldVisible) {
    return !!(worldVisible && worldMeta && worldMeta.easterEgg === CAVERN_FALL_ID);
  }

  function getCavernFallSourceCell(worldMeta, x, z, dimension = 'overworld') {
    if (!worldMeta || worldMeta.easterEgg !== CAVERN_FALL_ID || dimension === 'underground') return { x, z };
    if (worldMeta.cavernFallAxis === 'x') return { x: 1024, z };
    if (worldMeta.cavernFallAxis === 'z') return { x, z: 1024 };
    return { x, z };
  }

  Game.easterEggs3d = {
    CAVERN_FALL_ID,
    CAVERN_FALL_URL,
    getCavernFallSourceCell,
    resolveCavernFallSelection,
    shouldShowCavernFallLink,
  };
})();
