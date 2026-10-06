import { SpectrumDetector, silentFeatures, type AudioFeatures } from './audio-analysis';

/** Tap the final Web Audio output in parallel; SoundCloud also uses buffer sources. */
(() => {
  let active = false;
  let frame = 0;
  let last = 0;
  let media: HTMLMediaElement | null = null;
  let fallbackContext: AudioContext | null = null;
  let fallbackStream: MediaStream | null = null;
  let fallbackAnalyser: AnalyserNode | null = null;
  const outputs = new Map<AudioNode, { destination: AudioDestinationNode; analyser: AnalyserNode | null; output: number }>();
  const connect = AudioNode.prototype.connect;
  const disconnect = AudioNode.prototype.disconnect;
  const samples = new Float32Array(2048);
  const decibels = new Float32Array(samples.length / 2);
  const detectors = new WeakMap<AnalyserNode, SpectrumDetector>();
  function tap(node: AudioNode) {
    const entry = outputs.get(node);
    if (!entry || entry.analyser || node.context.state === 'closed') return;
    try {
      entry.analyser = node.context.createAnalyser();
      entry.analyser.fftSize = samples.length;
      entry.analyser.smoothingTimeConstant = 0;
      Reflect.apply(connect, node, [entry.analyser, entry.output]);
    } catch { entry.analyser = null; }
  }
  AudioNode.prototype.connect = function(this: AudioNode, destination: AudioNode | AudioParam, output?: number, input?: number) {
    const result = destination instanceof AudioNode
      ? Reflect.apply(connect, this, [destination, output ?? 0, input ?? 0])
      : Reflect.apply(connect, this, [destination, output ?? 0]);
    if (destination instanceof AudioDestinationNode) {
      outputs.set(this, { destination, analyser: outputs.get(this)?.analyser || null, output: output ?? 0 });
      if (active) tap(this);
    }
    return result;
  } as AudioNode['connect'];
  AudioNode.prototype.disconnect = function(this: AudioNode, ...args: unknown[]) {
    Reflect.apply(disconnect, this, args);
    const entry = outputs.get(this);
    if (entry && (!args.length || args[0] === entry.destination || typeof args[0] === 'number')) {
      if (entry.analyser) {
        try { Reflect.apply(disconnect, this, [entry.analyser]); } catch { /* already disconnected */ }
        entry.analyser.disconnect();
      }
      outputs.delete(this);
    }
  } as AudioNode['disconnect'];
  function detachFallback() {
    fallbackAnalyser?.disconnect(); fallbackAnalyser = null;
    fallbackStream?.getTracks().forEach(track => track.stop()); fallbackStream = null;
    if (fallbackContext) void fallbackContext.close(); fallbackContext = null;
  }
  function attachFallback() {
    detachFallback();
    if (!media || outputs.size) return;
    try {
      const capture = (media as HTMLMediaElement & { captureStream?: () => MediaStream }).captureStream;
      if (!capture) return;
      fallbackStream = capture.call(media);
      if (!fallbackStream.getAudioTracks().length) { detachFallback(); return; }
      fallbackContext = new AudioContext();
      fallbackAnalyser = fallbackContext.createAnalyser();
      fallbackAnalyser.fftSize = samples.length;
      fallbackAnalyser.smoothingTimeConstant = 0;
      fallbackContext.createMediaStreamSource(fallbackStream).connect(fallbackAnalyser);
      void fallbackContext.resume();
    } catch { detachFallback(); }
  }
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function() {
    media = this;
    const result = play.call(this);
    void result.then(() => { if (active && media === this) attachFallback(); }, () => {});
    return result;
  };
  function analyse(analyser: AnalyserNode) {
    let detector = detectors.get(analyser);
    if (!detector) {
      detector = new SpectrumDetector(analyser.context.sampleRate, samples.length);
      detectors.set(analyser, detector);
    }
    analyser.getFloatTimeDomainData(samples);
    analyser.getFloatFrequencyData(decibels);
    return detector.read(samples, decibels);
  }
  function combine(a: AudioFeatures, b: AudioFeatures) {
    for (const key of ['level', 'bass', 'mid', 'high', 'onset', 'highOnset', 'bassOnset'] as const) a[key] = Math.max(a[key], b[key]);
  }
  function tick(now: number) {
    if (!active) return;
    if (now - last >= 32) {
      last = now;
      const features = silentFeatures();
      for (const [node, entry] of outputs) {
        if (node.context.state === 'closed') { outputs.delete(node); continue; }
        if (entry.analyser && node.context.state === 'running') combine(features, analyse(entry.analyser));
      }
      if (!outputs.size && fallbackAnalyser && media && !media.paused && !media.muted) {
        const measured = analyse(fallbackAnalyser);
        for (const key of ['level', 'bass', 'mid', 'high', 'onset', 'highOnset', 'bassOnset'] as const) measured[key] *= media.volume;
        combine(features, measured);
      }
      window.postMessage({ type: 'soundsky:audio', ...features }, location.origin);
    }
    frame = requestAnimationFrame(tick);
  }
  document.addEventListener('loadeddata', event => {
    if (active && event.target === media) attachFallback();
  }, true);
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.type !== 'soundsky:analysis') return;
    active = event.data.active === true;
    cancelAnimationFrame(frame);
    if (active) {
      for (const node of outputs.keys()) tap(node);
      media ||= [...document.querySelectorAll('audio,video')].find(el => !(el as HTMLMediaElement).paused) as HTMLMediaElement || null;
      attachFallback(); frame = requestAnimationFrame(tick);
    } else {
      for (const [node, entry] of outputs) if (entry.analyser) {
        try { Reflect.apply(disconnect, node, [entry.analyser]); } catch { /* already disconnected */ }
        entry.analyser.disconnect(); entry.analyser = null;
      }
      detachFallback();
    }
  });
})();
