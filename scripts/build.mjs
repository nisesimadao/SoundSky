import { build } from 'esbuild';
import { cp, mkdir } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
await mkdir('dist/licenses/paper-shaders', { recursive: true });
for (const file of ['LICENSE', 'NOTICE']) {
  await cp(`node_modules/@paper-design/shaders/${file}`, `dist/licenses/paper-shaders/${file}`);
}
for (const [name, directory] of [['paper-shaders-react', '@paper-design/shaders-react'], ['react', 'react'], ['react-dom', 'react-dom'], ['scheduler', 'scheduler']]) {
  await mkdir(`dist/licenses/${name}`, { recursive: true });
  await cp(`node_modules/${directory}/LICENSE`, `dist/licenses/${name}/LICENSE`);
  if (name === 'paper-shaders-react') await cp(`node_modules/${directory}/NOTICE`, `dist/licenses/${name}/NOTICE`);
}
await build({ entryPoints: ['src/content.ts', 'src/background.ts', 'src/audio.ts'], outdir: 'dist', bundle: true, target: 'chrome120', format: 'iife', loader: { '.css': 'text' }, legalComments: 'none', sourcemap: true, define: { 'process.env.NODE_ENV': '"production"' } });
console.log('SoundSky built → dist/');
