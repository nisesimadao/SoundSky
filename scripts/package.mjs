import { execFileSync } from 'node:child_process';
execFileSync('zip', ['-r', '../SoundSky.zip', '.', '-x', '*.map'], { cwd: 'dist', stdio: 'inherit' });
