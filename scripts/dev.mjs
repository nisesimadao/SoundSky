import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { build } from 'esbuild';
await mkdir('artifacts', { recursive: true });
await build({ entryPoints: ['src/content.ts'], outfile: 'artifacts/preview.js', bundle: true, target: 'chrome120', format: 'iife', loader: { '.css': 'text' }, define: { 'process.env.NODE_ENV': '"production"' } });
const files = { '/settings': ['tests/fixture.html','text/html'], '/': ['tests/fixture.html','text/html'], '/responsive': ['tests/responsive.html','text/html'], '/preview.js': ['artifacts/preview.js','text/javascript'], '/fixture.js': ['tests/fixture.js','text/javascript'], '/artwork.jpg': ['tests/artwork.jpg','image/jpeg'] };
createServer(async (req,res) => {
  const file = files[new URL(req.url,'http://localhost').pathname];
  if (!file) { res.writeHead(404); res.end(); return; }
  try { const bytes = await readFile(file[0]); res.writeHead(200, {'Content-Type': file[1], 'Cache-Control': 'no-store'}); res.end(bytes); }
  catch { res.writeHead(404); res.end(); }
}).listen(4173, '127.0.0.1', () => console.log('SoundSky fixture → http://127.0.0.1:4173'));
