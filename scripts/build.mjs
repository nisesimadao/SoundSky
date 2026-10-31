import { build } from 'esbuild';
import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { publishBuild } from './publish-build.mjs';
import { verifyBuild } from './verify-package.mjs';
// Build away from the installed directory; failed compilation leaves it usable.
const work = await mkdtemp(join(process.cwd(), '.soundsky-build-'));
const staged = join(work, 'dist');
try {
  await cp('public', staged, { recursive: true });
  await mkdir(join(staged, 'licenses/paper-shaders'), { recursive: true });
  for (const file of ['LICENSE', 'NOTICE']) {
    await cp(`node_modules/@paper-design/shaders/${file}`, join(staged, 'licenses/paper-shaders', file));
  }
  for (const [name, directory] of [['paper-shaders-react', '@paper-design/shaders-react'], ['react', 'react'], ['react-dom', 'react-dom'], ['scheduler', 'scheduler']]) {
    await mkdir(join(staged, 'licenses', name), { recursive: true });
    await cp(`node_modules/${directory}/LICENSE`, join(staged, 'licenses', name, 'LICENSE'));
    if (name === 'paper-shaders-react') await cp(`node_modules/${directory}/NOTICE`, join(staged, 'licenses', name, 'NOTICE'));
  }
  await build({ entryPoints: ['src/content.ts', 'src/background.ts', 'src/audio.ts', 'src/theme-frame.ts'], outdir: staged, bundle: true, target: 'chrome120', format: 'iife', loader: { '.css': 'text' }, legalComments: 'none', sourcemap: 'external', define: { 'process.env.NODE_ENV': '"production"' } });
  await verifyBuild(staged);
  await publishBuild(staged, resolve('dist'));
  console.log('SoundSky built → dist/');
} finally { await rm(work, { recursive: true, force: true }); }
