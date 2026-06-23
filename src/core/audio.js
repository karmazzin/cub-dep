(() => {
  const Game = window.CubDep;

  let audioContext = null;
  let unlocked = false;

  function getContext() {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      audioContext = new AudioCtx();
    }
    return audioContext;
  }

  function unlock() {
    unlocked = true;
    const ctx = getContext();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function withContext(callback) {
    const ctx = getContext();
    if (!ctx || !unlocked) return;
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => callback(ctx));
      return;
    }
    callback(ctx);
  }

  function createNoiseBuffer(ctx) {
    const length = Math.max(1, Math.floor(ctx.sampleRate * 0.12));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function playOscillator(ctx, options) {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = options.type || 'sine';
    osc.frequency.setValueAtTime(options.from, now);
    if (options.to !== undefined) osc.frequency.exponentialRampToValueAtTime(options.to, now + options.duration);
    gain.gain.setValueAtTime(options.volume || 0.001, now);
    gain.gain.exponentialRampToValueAtTime((options.peak || 0.08), now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + options.duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + options.duration + 0.02);
  }

  function playNoise(ctx, options) {
    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = createNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = options.filterType || 'lowpass';
    filter.frequency.setValueAtTime(options.frequency || 900, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(options.volume || 0.001, now);
    gain.gain.exponentialRampToValueAtTime(options.peak || 0.05, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + options.duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(now);
    source.stop(now + options.duration + 0.02);
  }

  function playStep() {
    withContext((ctx) => {
      playNoise(ctx, { duration: 0.08, frequency: 280, peak: 0.035, filterType: 'bandpass' });
      playOscillator(ctx, { type: 'triangle', from: 120, to: 90, duration: 0.07, peak: 0.02 });
    });
  }

  function playJump() {
    withContext((ctx) => {
      playOscillator(ctx, { type: 'square', from: 220, to: 420, duration: 0.12, peak: 0.03 });
    });
  }

  function playSwim() {
    withContext((ctx) => {
      playNoise(ctx, { duration: 0.12, frequency: 600, peak: 0.03, filterType: 'lowpass' });
      playOscillator(ctx, { type: 'sine', from: 260, to: 180, duration: 0.13, peak: 0.02 });
    });
  }

  function playHit() {
    withContext((ctx) => {
      playNoise(ctx, { duration: 0.09, frequency: 900, peak: 0.04, filterType: 'bandpass' });
      playOscillator(ctx, { type: 'square', from: 180, to: 120, duration: 0.08, peak: 0.025 });
    });
  }

  function playBurn() {
    withContext((ctx) => {
      playNoise(ctx, { duration: 0.14, frequency: 1500, peak: 0.03, filterType: 'highpass' });
      playOscillator(ctx, { type: 'sawtooth', from: 260, to: 120, duration: 0.16, peak: 0.025 });
    });
  }

  function playDig() {
    withContext((ctx) => {
      playNoise(ctx, { duration: 0.08, frequency: 700, peak: 0.05, filterType: 'lowpass' });
      playOscillator(ctx, { type: 'triangle', from: 110, to: 80, duration: 0.07, peak: 0.015 });
    });
  }

  Game.audio = {
    unlock,
    playStep,
    playJump,
    playSwim,
    playHit,
    playBurn,
    playDig,
  };
})();
