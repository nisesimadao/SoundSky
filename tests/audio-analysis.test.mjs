import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const result = await build({entryPoints:['src/audio-analysis.ts'],bundle:true,write:false,format:'esm'});
const { SpectrumDetector } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const samples = gain => new Float32Array(2048).fill(.4 * gain);
function spectrum(gain, bin) {
  const bins = new Float32Array(1024).fill(-Infinity);
  bins[bin] = 20 * Math.log10(.2 * gain);
  return bins;
}
test('constant overall loudness still detects a kick through frequency changes', () => {
  const detector = new SpectrumDetector(48000, 2048);
  const sustained = detector.read(samples(1), spectrum(1, 50));
  const kick = detector.read(samples(1), spectrum(1, 4));
  assert.equal(kick.level, sustained.level);
  assert.ok(kick.onset > .45);
  assert.ok(kick.bass > .19);
  assert.equal(detector.read(samples(1), spectrum(1,4)).onset, 0);
});
test('different sample rates place the same note in the same frequency band', () => {
  for (const sampleRate of [44100,48000,96000]) {
    const detector = new SpectrumDetector(sampleRate,2048);
    const feature = detector.read(samples(1),spectrum(1,Math.round(100 * 2048 / sampleRate)));
    assert.ok(feature.bass > .19);assert.equal(feature.mid,0);assert.equal(feature.high,0);
  }
});
test('detection preserves loudness differences without per-track normalization', () => {
  const measure = gain => {
    const detector = new SpectrumDetector(48000,2048);
    detector.read(samples(gain),spectrum(gain,50));
    return detector.read(samples(gain),spectrum(gain,4));
  };
  const loud=measure(1),quiet=measure(.5);
  assert.ok(Math.abs(quiet.level / loud.level - .5) < .00001);
  assert.ok(Math.abs(quiet.onset / loud.onset - .5) < .00001);
});
test('silence resets history and reopening does not invent a first-frame attack', () => {
  const detector = new SpectrumDetector(48000,2048);
  assert.equal(detector.read(samples(1),spectrum(1,4)).onset,0);
  const silence = detector.read(samples(0),new Float32Array(1024).fill(-Infinity));
  assert.deepEqual(silence,{level:0,bass:0,mid:0,high:0,onset:0,highOnset:0,bassOnset:0});
  assert.equal(detector.read(samples(1),spectrum(1,4)).onset,0);
});

test('high attacks distinguish repeated hats from sustained highs and bass hits', () => {
  for (const sampleRate of [44100, 48000, 96000]) {
    const detector = new SpectrumDetector(sampleRate, 2048);
    const highBin = Math.round(6000 * 2048 / sampleRate);
    detector.read(samples(1), spectrum(1, 4));
    assert.equal(detector.read(samples(1), spectrum(1, 4)).highOnset, 0);
    assert.ok(detector.read(samples(1), spectrum(1, highBin)).highOnset > .19);
    assert.equal(detector.read(samples(1), spectrum(1, highBin)).highOnset, 0);
    detector.read(samples(1), spectrum(.1, highBin));
    assert.ok(detector.read(samples(1), spectrum(1, highBin)).highOnset > .17);
  }
});

test('sustained high energy cannot launch ribbons just by changing its frequency content', () => {
  const detector = new SpectrumDetector(48000, 2048);
  detector.read(samples(1), spectrum(1, 4));
  assert.ok(detector.read(samples(1), spectrum(1, 256)).highOnset > .19);
  for (let i = 0; i < 30; i++) {
    const features = detector.read(samples(1), spectrum(1, i % 2 ? 256 : 400));
    assert.ok(features.onset > .19);
    assert.equal(features.highOnset, 0);
  }
  detector.read(samples(1), spectrum(.2, 256));
  assert.ok(detector.read(samples(1), spectrum(1, 256)).highOnset > .15);
});

test('small fluctuations in a sustained high tone stay below the ribbon trigger even at maximum sensitivity', () => {
  const detector = new SpectrumDetector(48000, 2048);
  detector.read(samples(1), spectrum(1, 256));
  for (let i = 0; i < 30; i++) {
    const features = detector.read(samples(1), spectrum(i % 2 ? 1 : 1.005, 256));
    assert.ok(features.highOnset * 12 < .024);
  }
});

test('percussion response includes snare and rimshot presence as well as hi-hats at every sample rate', () => {
  for (const rate of [44100, 48000, 96000]) {
    for (const hz of [1600, 2200, 6000, 10000]) {
      const detector = new SpectrumDetector(rate, 2048);
      detector.read(samples(1), spectrum(1, Math.round(150 * 2048 / rate)));
      const bin = Math.round(hz * 2048 / rate);
      assert.ok(detector.read(samples(1), spectrum(1, bin)).highOnset > .19, `${hz}Hz at ${rate}`);
      assert.equal(detector.read(samples(1), spectrum(1, bin)).highOnset, 0);
    }
    const detector = new SpectrumDetector(rate, 2048);
    detector.read(samples(1), spectrum(.1, 3));
    assert.equal(detector.read(samples(1), spectrum(1, Math.round(800 * 2048 / rate))).highOnset, 0);
  }
});

test('bass attacks drive red travel independently from hats and sustained bass', () => {
  const detector = new SpectrumDetector(48000, 2048);
  detector.read(samples(1), spectrum(.1, 4));
  const kick = detector.read(samples(1), spectrum(1, 4));
  assert.ok(kick.bassOnset > .17);
  assert.equal(kick.highOnset, 0);
  assert.equal(detector.read(samples(1), spectrum(1, 4)).bassOnset, 0);
  assert.equal(detector.read(samples(1), spectrum(1, 256)).bassOnset, 0);
});

test('quiet broadband percussion is detected over louder decaying highs without a net energy rise', () => {
  for (const sampleRate of [44100, 48000, 96000]) {
    const detector = new SpectrumDetector(sampleRate, 2048);
    const bed = new Float32Array(1024).fill(-Infinity);
    const bin = Math.round(6000 * 2048 / sampleRate);
    bed[bin] = 20 * Math.log10(.3);
    detector.read(samples(1), bed);
    detector.read(samples(1), bed);
    const hit = bed.slice();
    hit[bin] = 20 * Math.log10(.299);
    for (const hz of [1800, 2400, 4000, 8000, 10000]) hit[Math.round(hz * 2048 / sampleRate)] = 20 * Math.log10(.003);
    const features = detector.read(samples(1), hit);
    assert.ok(features.highOnset > .006, `masked percussion at ${sampleRate}`);
    assert.equal(detector.read(samples(1), hit).highOnset, 0, 'the sustained tail does not launch another band');
  }
});
