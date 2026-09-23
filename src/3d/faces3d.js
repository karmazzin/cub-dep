(() => {
  const Game = window.CubDep;

  const FACE_PROFILES = Object.freeze({
    cat: faceProfile(0.222, 0.06, 0.12, 0.12, 0.085, -0.11, 0.1),
    dog: faceProfile(0.242, 0.08, 0.13, 0.13, 0.09, -0.13, 0.11),
    capybara: faceProfile(0.262, 0.12, 0.14, 0.13, 0.09, -0.1, 0.12),
    parrot: faceProfile(0.222, 0.07, 0.12, 0.11, 0.075, null, 0),
    sheep: faceProfile(0.182, 0.06, 0.105, 0.1, 0.07, null, 0),
    boar: faceProfile(0.182, 0.05, 0.105, 0.1, 0.07, -0.085, 0.09),
    turtle: faceProfile(0.102, 0.035, 0.05, 0.06, 0.042, -0.04, 0.05),
    snake: faceProfile(0.152, 0.03, 0.07, 0.065, 0.045, -0.045, 0.06),
    goat: faceProfile(0.152, 0.05, 0.08, 0.085, 0.06, -0.075, 0.075),
    fish: faceProfile(0.222, 0.035, 0.06, 0.07, 0.05, -0.045, 0.06),
    fox: faceProfile(0.142, 0.045, 0.07, 0.085, 0.06, -0.065, 0.075),
    bear: faceProfile(0.522, 0.14, 0.28, 0.22, 0.16, null, 0, 0.025, 0.035),
  });

  function faceProfile(faceX, eyeY, eyeSpread, eyeHeight, eyeWidth, mouthY, mouthWidth, pupilTravelX = 0.012, pupilTravelY = 0.016) {
    return Object.freeze({
      faceX,
      eyeY,
      eyeSpread,
      eyeHeight,
      eyeWidth,
      eyeDepth: 0.018,
      pupilHeight: eyeHeight * 0.46,
      pupilWidth: eyeWidth * 0.42,
      pupilDepth: 0.012,
      pupilTravelX,
      pupilTravelY,
      mouthY,
      mouthWidth,
      mouthHeight: Math.max(0.018, eyeHeight * 0.2),
      mouthDepth: 0.014,
    });
  }

  function stableHash(value) {
    const text = String(value == null ? '' : value);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function positiveModulo(value, divisor) {
    return ((value % divisor) + divisor) % divisor;
  }

  function signedTarget(hash, shift, minimum, range) {
    const bits = hash >>> shift;
    const sign = bits & 1 ? 1 : -1;
    return sign * (minimum + ((bits >>> 1) % 101) / 100 * range);
  }

  function blinkOpenAmount(phase) {
    if (phase >= 0.22) return 1;
    if (phase < 0.06) return Math.max(0.04, 1 - phase / 0.06);
    if (phase < 0.14) return 0.04;
    return Math.min(1, 0.04 + ((phase - 0.14) / 0.08) * 0.96);
  }

  function getFaceAnimation3D(id, timeSeconds) {
    const hash = stableHash(id);
    const time = Number.isFinite(timeSeconds) ? timeSeconds : 0;
    const blinkPeriod = 3.2 + (hash % 3000) / 1000;
    const blinkOffset = (((hash >>> 7) % 10000) / 10000) * blinkPeriod;
    const eyeOpen = blinkOpenAmount(positiveModulo(time + blinkOffset, blinkPeriod));

    const glancePeriod = 4.1 + ((hash >>> 15) % 1800) / 1000;
    const glanceOffset = (((hash >>> 5) % 10000) / 10000) * glancePeriod;
    const glancePhase = positiveModulo(time + glanceOffset, glancePeriod);
    let pupilX = 0;
    let pupilY = 0;
    if (glancePhase < 1.25) {
      const ease = Math.sin((glancePhase / 1.25) * Math.PI);
      pupilX = signedTarget(hash, 3, 0.35, 0.55) * ease;
      pupilY = signedTarget(hash, 12, 0.2, 0.4) * ease;
    }

    return {
      eyeOpen: Math.max(0, Math.min(1, eyeOpen)),
      pupilX: Math.max(-1, Math.min(1, pupilX)),
      pupilY: Math.max(-1, Math.min(1, pupilY)),
    };
  }

  function getFaceProfile3D(type) {
    const profile = FACE_PROFILES[type];
    return profile ? { ...profile } : null;
  }

  Game.faces3d = { getFaceAnimation3D, getFaceProfile3D };
})();
