import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { build } from 'esbuild';
await mkdir('artifacts', { recursive: true });
await build({ entryPoints: ['src/content.ts'], outfile: 'artifacts/preview.js', bundle: true, target: 'chrome120', format: 'iife', loader: { '.css': 'text' }, define: { 'process.env.NODE_ENV': '"production"' } });
await build({ entryPoints: ['src/audio.ts'], outfile: 'artifacts/audio-preview.js', bundle: true, target: 'chrome120', format: 'iife' });
await build({ entryPoints: ['tests/prefetch-lifecycle.js'], outfile: 'artifacts/prefetch-lifecycle.js', bundle: true, target: 'chrome120', format: 'iife' });
const files = { '/prefetch-lifecycle': ['tests/prefetch-lifecycle.html','text/html'], '/prefetch-lifecycle.js': ['artifacts/prefetch-lifecycle.js','text/javascript'], '/audio-lifecycle': ['tests/audio-lifecycle.html','text/html'], '/audio-lifecycle-monitor.js': ['tests/audio-lifecycle-monitor.js','text/javascript'], '/audio-lifecycle.js': ['tests/audio-lifecycle.js','text/javascript'], '/audio-preview.js': ['artifacts/audio-preview.js','text/javascript'], '/settings': ['tests/fixture.html','text/html'], '/': ['tests/fixture.html','text/html'], '/responsive': ['tests/responsive.html','text/html'], '/preview.js': ['artifacts/preview.js','text/javascript'], '/fixture.js': ['tests/fixture.js','text/javascript'], '/artwork.jpg': ['tests/artwork.jpg','image/jpeg'] };
createServer(async (req,res) => {
  if(new URL(req.url,'http://localhost').pathname==='/prefetch-response') {
    if(new URL(req.url,'http://localhost').searchParams.has('slow'))await new Promise(resolve=>setTimeout(resolve,800));
    res.writeHead(200,{'Content-Type':'text/plain','Cache-Control':'no-store'});res.end('native-audio');return;
  }
  const file = files[new URL(req.url,'http://localhost').pathname];
  if (!file) { res.writeHead(404); res.end(); return; }
  try { const bytes = await readFile(file[0]); res.writeHead(200, {'Content-Type': file[1], 'Cache-Control': 'no-store'}); res.end(bytes); }
  catch { res.writeHead(404); res.end(); }
}).listen(Number(process.env.SOUNDSKY_DEV_PORT||4173), '127.0.0.1', () => console.log(`SoundSky fixture → http://127.0.0.1:${process.env.SOUNDSKY_DEV_PORT||4173}`));
