import { AudioPrefetch } from './prefetch';
import { Turntable } from './turntable';
import { SpectrumDetector, silentFeatures, type AudioFeatures } from './audio-analysis';

/** Observe the final output in parallel; never replace SoundCloud's output path. */
(() => {
  const version = '1.3.25';
  const bridgeKey = Symbol.for('soundsky:audio-bridge');
  const previousBridge = Reflect.get(window, bridgeKey) as { version: string; destroy(): void } | undefined;
  if (previousBridge?.version === version) return;
  previousBridge?.destroy();

  const turntable = new Turntable();
  const prefetch = typeof window.fetch==='function' && typeof Request!=='undefined' ? new AudioPrefetch() : null;
  let active = false, disposed = false;
  let frame = 0, last = 0;
  let media: HTMLMediaElement | null = null;
  let fallbackContext: AudioContext | null = null;
  let fallbackStream: MediaStream | null = null;
  let fallbackAnalyser: AnalyserNode | null = null;
  type Route = { destination: AudioDestinationNode; output: number; input: number };
  const outputs = new Map<AudioNode, { routes: Route[]; taps: Map<number, AnalyserNode> }>();
  const connect = AudioNode.prototype.connect;
  const disconnect = AudioNode.prototype.disconnect;
  const play = HTMLMediaElement.prototype.play;
  const samples = new Float32Array(2048);
  const decibels = new Float32Array(samples.length / 2);
  const detectors = new WeakMap<AnalyserNode, SpectrumDetector>();
  const events = new AbortController();

  function detachTap(node: AudioNode, output: number, analyser: AnalyserNode) {
    try { Reflect.apply(disconnect, node, [analyser, output]); } catch { /* native disconnect may already have removed the edge */ }
    analyser.disconnect(); detectors.delete(analyser);
  }
  function tap(node: AudioNode) {
    const entry = outputs.get(node);
    if (!entry || node.context.state === 'closed') return;
    for (const output of new Set(entry.routes.map(route => route.output))) {
      if (entry.taps.has(output)) continue;
      let analyser: AnalyserNode | null = null;
      try {
        analyser = node.context.createAnalyser();
        analyser.fftSize = samples.length;
        analyser.smoothingTimeConstant = 0;
        Reflect.apply(connect, node, [analyser, output]);
        entry.taps.set(output, analyser);
      } catch { analyser?.disconnect(); }
    }
  }
  const connectHook = function(this: AudioNode, ...args: unknown[]) {
    // Preserve native overloads, arguments, return values and exceptions.
    const result = Reflect.apply(connect, this, args);
    const destination = args[0];
    if (!disposed && destination instanceof AudioDestinationNode) {
      const output = Number(args[1] ?? 0) >>> 0, input = Number(args[2] ?? 0) >>> 0;
      const entry = outputs.get(this) ?? { routes: [], taps: new Map<number, AnalyserNode>() };
      if (!entry.routes.some(route => route.destination === destination && route.output === output && route.input === input)) entry.routes.push({ destination, output, input });
      outputs.set(this, entry);
      if (active) { tap(this); detachFallback(); }
    }
    return result;
  } as AudioNode['connect'];
  const disconnectHook = function(this: AudioNode, ...args: unknown[]) {
    Reflect.apply(disconnect, this, args);
    const entry = outputs.get(this);
    if (!entry || disposed) return;
    entry.routes = entry.routes.filter(route => {
      if (!args.length) return false;
      if (typeof args[0] === 'number') return route.output !== (Number(args[0]) >>> 0);
      if (args[0] !== route.destination) return true;
      return (args.length > 1 && route.output !== (Number(args[1]) >>> 0)) || (args.length > 2 && route.input !== (Number(args[2]) >>> 0));
    });
    for (const [output, analyser] of entry.taps) if (!entry.routes.some(route => route.output === output)) {
      detachTap(this, output, analyser); entry.taps.delete(output);
    }
    if (!entry.routes.length) outputs.delete(this);
  } as AudioNode['disconnect'];
  AudioNode.prototype.connect = connectHook;
  AudioNode.prototype.disconnect = disconnectHook;

  function detachFallback() {
    fallbackAnalyser?.disconnect(); fallbackAnalyser = null;
    fallbackStream?.getTracks().forEach(track => track.stop()); fallbackStream = null;
    if (fallbackContext) void fallbackContext.close().catch(() => {});
    fallbackContext = null;
  }
  function attachFallback() {
    detachFallback();
    if (!active || disposed || !media || outputs.size) return;
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
      const context = fallbackContext;
      void context.resume().catch(() => { if (fallbackContext === context) detachFallback(); });
    } catch { detachFallback(); }
  }
  const playHook = function(this: HTMLMediaElement) {
    turntable.startMedia(this);
    const result = play.call(this);
    if (!disposed) {
      media = this;
      void result.then(() => { if (active && !disposed && media === this) attachFallback(); }, () => {});
    }
    return result;
  };
  HTMLMediaElement.prototype.play = playHook;

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
    if (!active || disposed) return;
    if (now - last >= 32) {
      last = now;
      const features = silentFeatures();
      for (const [node, entry] of outputs) {
        if (node.context.state === 'closed') { outputs.delete(node); continue; }
        if (node.context.state === 'running') for (const analyser of entry.taps.values()) combine(features, analyse(analyser));
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
  function deactivate() {
    active = false; cancelAnimationFrame(frame);
    for (const [node, entry] of outputs) {
      for (const [output, analyser] of entry.taps) detachTap(node, output, analyser);
      entry.taps.clear();
    }
    detachFallback();
  }
  document.addEventListener('loadeddata', event => {
    if (active && event.target === media) attachFallback();
  }, { capture: true, signal: events.signal });
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin) return;
    if (event.data?.type === 'soundsky:turntable') {
      if (typeof event.data.speed === 'number') turntable.setSpeed(event.data.speed);
      if (typeof event.data.enabled === 'boolean') turntable.setEnabled(event.data.enabled);
      const state = event.data.playbackState;
      if (state === 'playing' || state === 'paused' || state === 'none') turntable.syncNativePlaybackState(state);
      return;
    }
    if (event.data?.type !== 'soundsky:analysis') return;
    if (event.data.active !== true) { deactivate(); return; }
    if (active) return;
    active = true; last = 0;
    for (const node of outputs.keys()) tap(node);
    media ||= [...document.querySelectorAll('audio,video')].find(el => !(el as HTMLMediaElement).paused) as HTMLMediaElement || null;
    attachFallback(); frame = requestAnimationFrame(tick);
  }, { signal: events.signal });
  window.addEventListener('pagehide', event => { if (!event.persisted) destroy(); }, { signal: events.signal });
  function destroy() {
    if (disposed) return;
    prefetch?.destroy(); turntable.destroy(); deactivate(); disposed = true; events.abort(); outputs.clear();
    if (AudioNode.prototype.connect === connectHook) AudioNode.prototype.connect = connect;
    if (AudioNode.prototype.disconnect === disconnectHook) AudioNode.prototype.disconnect = disconnect;
    if (HTMLMediaElement.prototype.play === playHook) HTMLMediaElement.prototype.play = play;
    if (Reflect.get(window, bridgeKey)?.destroy === destroy) Reflect.deleteProperty(window, bridgeKey);
  }
  Reflect.set(window, bridgeKey, { version, destroy });
})();
