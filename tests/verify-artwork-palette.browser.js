async page => {
 let mono=false;
 await page.route('https://*.sndcdn.com/**',route=>route.fulfill({status:200,contentType:'image/svg+xml',headers:{'access-control-allow-origin':'*'},body:`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="red"/>${mono?'':'<rect x="20" width="20" height="40" fill="cyan"/>'}</svg>`}));
 try {
  await page.goto('http://127.0.0.1:4173');
  await page.getByRole('button',{name:'Open SoundSky',exact:true}).click();
  await page.waitForTimeout(1500);
  const read=()=>page.evaluate(()=>document.querySelector('soundsky-player').shadowRoot.querySelector('.atmosphere canvas')?.parentElement.paperShaderMount?.providedUniforms.u_colors);
  const colors=await read();
  if(!colors||colors.length<4)throw new Error('Background palette missing');
  if(!(colors[1][0]>colors[1][1]&&colors[1][1]===colors[1][2]))throw new Error('Extracted red absent');
  if(!(colors[2][1]>colors[2][0]&&colors[2][2]>colors[2][0]))throw new Error('Extracted cyan absent');
  mono=true;
  await page.evaluate(()=>document.querySelector('.playbackSoundBadge__avatar span').style.backgroundImage='url("https://i1.sndcdn.com/artworks-test-mono-t120x120.png")');
  await page.waitForTimeout(1500);
  const fallback=await read();
  if(Math.abs(fallback[1][0]-33/255)>.005||Math.abs(fallback[1][1]-68/255)>.005)throw new Error('Monochrome fallback absent');
  return {extractedColorsReachShader:true,monochromeFallback:true};
 } finally {await page.unroute('https://*.sndcdn.com/**');}
}
