import { verifyPackage } from './verify-package.mjs';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
// Build a fresh archive: updating an existing zip retains files deleted from dist.
const work = await mkdtemp(join(process.cwd(), '.soundsky-package-'));
try {
  const archive = join(work, 'SoundSky.zip');
  execFileSync('zip', ['-r', archive, '.', '-x', '*.map', '.DS_Store'], { cwd: 'dist', stdio: 'inherit' });
  await verifyPackage(archive);
  await rename(archive, 'SoundSky.zip');
} finally {
  await rm(work, { recursive: true, force: true });
}
