// Against npm run dev: playwright-cli run-code --filename tests/verify-heatmap.browser.js
async page => {
  // SHA-256 of the unmodified Heatmap fragment from the pinned Paper 0.0.81 package.
  const officialDigest = '3c0a2ca72910b2f4bb71c92d98869b459fd814aaa117647e8819ad6b66a6e2c9';
  await page.goto('http://127.0.0.1:4173');
  await page.getByRole('button', { name: 'Open SoundSky', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('soundsky-player').shadowRoot.querySelector('.heatmap-surface')?.paperShaderMount?.providedUniforms.u_image?.naturalWidth > 100);
  const result = await page.evaluate(async expected => {
    const s = document.querySelector('soundsky-player').shadowRoot;
    const mount = s.querySelector('.heatmap-surface').paperShaderMount;
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(mount.fragmentShader));
    const digest = [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    if (digest !== expected) throw new Error('Heatmap shader differs from the official Paper shader');
    if (s.querySelector('.title-heat')) throw new Error('Title shader remains');
    if (s.querySelectorAll('.cover-heat canvas').length !== 2) throw new Error('Cover Heatmaps are missing');
    const shape = s.querySelector('.heatmap-surface');
    if (getComputedStyle(shape).maskImage !== 'none' || getComputedStyle(shape.parentElement).maskImage !== 'none') throw new Error('Heatmap is cropped by a CSS mask');
    if (mount.providedUniforms.u_colorBack[3] !== 0) throw new Error('The floating shape has an opaque rectangular background');
    const gl = mount.gl;
    const read = frame => {
      mount.setFrame(frame);
      const pixels = new Uint8Array(gl.canvas.width * gl.canvas.height * 4);
      gl.readPixels(0, 0, gl.canvas.width, gl.canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return pixels;
    };
    const first = read(0), next = read(2000);
    let changed = 0;
    for (let i = 0; i < first.length; i++) if (first[i] !== next[i]) changed++;
    if (!changed) throw new Error('Official Heatmap is frozen');
    return { officialShader: true, layers: 2, changedChannels: changed };
  }, officialDigest);
  await page.getByRole('button', { name: 'Play', exact: true }).last().click();
  await page.waitForFunction(() => document.querySelector('soundsky-player').shadowRoot.querySelector('.player').dataset.playing === 'true');
  const initial = await page.evaluate(() => document.querySelector('soundsky-player').shadowRoot.querySelector('.heatmap-surface').paperShaderMount.getCurrentFrame());
  await page.waitForTimeout(180);
  const flowing = await page.evaluate(() => document.querySelector('soundsky-player').shadowRoot.querySelector('.heatmap-surface').paperShaderMount.getCurrentFrame());
  if (flowing <= initial) throw new Error('Native Heatmap does not advance during playback');
  const audio = await page.evaluate(async () => {
    const s = document.querySelector('soundsky-player').shadowRoot;
    const cool = s.querySelector('.heatmap-cool').paperShaderMount;
    const warm = s.querySelector('.heatmap-warm').paperShaderMount;
    const input = s.querySelector('.art-image').src;
    if (!input.includes('artwork')) throw new Error('Fixture artwork missing');
    const speed = cool.speed;
    const frame = cool.getCurrentFrame();
    window.postMessage({type:'soundsky:audio',level:.16,onset:.1}, location.origin);
    await new Promise(resolve => setTimeout(resolve, 70));
    if (warm.providedUniforms.u_innerGlow <= 0) throw new Error('Warm heat ignores audio');
    if (cool.speed !== speed || cool.getCurrentFrame() < frame) throw new Error('Audio changed cool animation timing');
    if (cool.providedUniforms.u_innerGlow !== 0 || cool.providedUniforms.u_outerGlow !== .5) throw new Error('Cool parameters changed with audio');
    window.postMessage({type:'soundsky:audio',level:0,onset:0}, location.origin);
    await new Promise(resolve => setTimeout(resolve, 70));
    if (warm.providedUniforms.u_innerGlow !== 0) throw new Error('Heat remains during silence');
    return { audioHeat: true, nativeCoolTiming: true };
  });
  await page.getByRole('button', { name: 'Pause', exact: true }).last().click();
  await page.waitForFunction(() => document.querySelector('soundsky-player').shadowRoot.querySelector('.player').dataset.playing === 'false');
  const paused = await page.evaluate(() => document.querySelector('soundsky-player').shadowRoot.querySelector('.heatmap-surface').paperShaderMount.getCurrentFrame());
  await page.waitForTimeout(150);
  const still = await page.evaluate(() => document.querySelector('soundsky-player').shadowRoot.querySelector('.heatmap-surface').paperShaderMount.getCurrentFrame());
  if (still !== paused) throw new Error('Heatmap continues animating while paused');
  await page.getByRole('button', { name: 'Visual settings', exact: true }).click();
  await page.getByRole('tab', { name: 'Light', exact: true }).click();
  await page.getByRole('switch', { name: 'Cover Heatmap', exact: true }).uncheck();
  await page.waitForFunction(() => !document.querySelector('soundsky-player').shadowRoot.querySelector('.cover-heat canvas'));
  await page.reload();
  await page.getByRole('button', { name: 'Open SoundSky', exact: true }).click();
  await page.getByRole('button', { name: 'Visual settings', exact: true }).click();
  await page.getByRole('tab', { name: 'Light', exact: true }).click();
  if (await page.getByRole('switch', { name: 'Cover Heatmap', exact: true }).isChecked()) throw new Error('Heatmap preference did not persist');
  await page.getByRole('switch', { name: 'Cover Heatmap', exact: true }).check();
  await page.getByRole('button', { name: 'Visual settings', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('soundsky-player').shadowRoot.querySelector('.heatmap-surface')?.paperShaderMount?.providedUniforms.u_image?.naturalWidth > 100);
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'output/playwright/cover-heatmap.png' });
  await page.evaluate(() => document.getElementById('no-art').click());
  await page.waitForFunction(() => !document.querySelector('soundsky-player').shadowRoot.querySelector('.cover-heat canvas'));
  return { ...result, ...audio, missingArtwork: true, flowing: true, stopsOnPause: true, togglePersists: true };
}
