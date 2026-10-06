import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const result = await build({ entryPoints: ['src/accent.ts'], bundle: true, write: false, format: 'esm' });
const { artworkHue, hueAt, accentColor, accentShaderColor } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const pixels = (...colors) => new Uint8ClampedArray(colors.flatMap(color => [...color, 255]));

test('dominant artwork hue survives neutral pixels and opposing colors', () => {
  assert.equal(artworkHue(pixels([100,100,100], [0,0,0], [255,255,255])), null);
  assert.equal(artworkHue(pixels([255,0,0], [255,0,0], [0,255,255], [240,240,240])), 0);
  assert.equal(artworkHue(pixels([0,255,0])), 120);
  assert.ok(Math.abs(artworkHue(pixels([0,0,255])) - 240) < .00001);
});
test('color transitions cross the hue seam by the short arc without dimming or desaturating', () => {
  assert.equal(hueAt(350, 10, .5), 0);
  assert.equal(hueAt(10, 350, .5), 0);
  assert.equal(hueAt(350, 10, 1), 10);
  for (let i = 0; i <= 20; i++) assert.match(accentColor(hueAt(25, 240, i / 20)), / 55% 72%\)$/);
});

test('shader colors preserve the CSS accent hue in a format supported by Paper', async () => {
  const { getShaderColorFromString } = await import('@paper-design/shaders');
  const red = getShaderColorFromString(accentShaderColor(0));
  const green = getShaderColorFromString(accentShaderColor(120));
  const blue = getShaderColorFromString(accentShaderColor(240));
  assert.ok(red[0] > red[1] && red[1] === red[2]);
  assert.ok(green[1] > green[0] && green[0] === green[2]);
  assert.ok(blue[2] > blue[0] && blue[0] === blue[1]);
  for (const color of [red, green, blue]) {
    const lightness = (Math.max(...color.slice(0, 3)) + Math.min(...color.slice(0, 3))) / 2;
    assert.ok(Math.abs(lightness - .72) < .003);
  }
});
