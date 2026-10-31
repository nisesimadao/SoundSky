import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const licenses = [
  'licenses/paper-shaders/LICENSE', 'licenses/paper-shaders/NOTICE',
  'licenses/paper-shaders-react/LICENSE', 'licenses/paper-shaders-react/NOTICE',
  'licenses/react/LICENSE', 'licenses/react-dom/LICENSE', 'licenses/scheduler/LICENSE',
];
async function filesIn(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Symlinks cannot ship: ${name}`);
    if (entry.isDirectory()) files.push(...await filesIn(join(directory, entry.name), name + '/'));
    else files.push(name);
  }
  return files.sort();
}
function manifestFiles(manifest, version) {
  if (manifest.manifest_version !== 3 || manifest.version !== version) throw new Error('Manifest release identity does not match package.json');
  if (JSON.stringify([...(manifest.permissions || [])].sort()) !== JSON.stringify(['activeTab', 'scripting', 'storage'].sort()) || manifest.host_permissions?.length) throw new Error('Unexpected extension permissions');
  const scripts = manifest.content_scripts || [];
  for (const file of ['audio.js','content.js','theme-frame.js']) {
    const matches = scripts.filter(script=>script.js?.includes(file));
    if (matches.length !== 1) throw new Error(`Missing or duplicate script entry: ${file}`);
    const script=matches[0];
    if (file==='audio.js' && (script.world!=='MAIN'||script.run_at!=='document_start'||script.all_frames===true)) throw new Error('Audio bridge must start in the top-level MAIN world');
    if (file==='content.js' && (script.world==='MAIN'||script.all_frames===true)) throw new Error('Player must stay in the top-level isolated world');
    if (file==='theme-frame.js' && (script.world==='MAIN'||script.all_frames!==true)) throw new Error('Frame theme must stay isolated');
  }
  const files = [manifest.background?.service_worker, 'START-HERE.txt', ...licenses, ...Object.values(manifest.icons || {}), ...Object.values(manifest.action?.default_icon || {})];
  for (const script of manifest.content_scripts || []) {
    if (!script.matches?.length || script.matches.some(value => !['https://soundcloud.com/*', 'https://www.soundcloud.com/*'].includes(value))) throw new Error('Content script has an unexpected origin');
    files.push(...script.js || [], ...script.css || []);
  }
  for (const file of files) if (typeof file !== 'string' || !file || file.startsWith('/') || file.includes('..') || file.includes('\\') || file.includes(':')) throw new Error(`Invalid package path: ${file}`);
  return files;
}
export async function verifyBuild(directory = 'dist') {
  const { version } = JSON.parse(await readFile('package.json', 'utf8'));
  const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
  const files = await filesIn(directory);
  for (const file of manifestFiles(manifest, version)) {
    if (!files.includes(file)) throw new Error(`Required distribution file is missing: ${file}`);
    if (!(await readFile(join(directory, file))).length) throw new Error(`Required distribution file is empty: ${file}`);
  }
  return { version, manifest, files };
}
export async function verifyPackage(archive = 'SoundSky.zip', directory = 'dist') {
  const build = await verifyBuild(directory);
  execFileSync('unzip', ['-t', resolve(archive)], { stdio: 'pipe' });
  const entries = execFileSync('unzip', ['-Z1', resolve(archive)], { encoding: 'utf8' }).trim().split('\n').filter(name => name && !name.endsWith('/'));
  if (new Set(entries).size !== entries.length) throw new Error('Duplicate ZIP entries');
  const expected = build.files.filter(file => !file.endsWith('.map') && !file.split('/').includes('.DS_Store'));
  if (JSON.stringify(entries.sort()) !== JSON.stringify(expected.sort())) throw new Error('ZIP contents differ from the verified build');
  // Check bytes as well as names: a ZIP from a prior build must never pass by name alone.
  for (const file of expected) {
    const bytes = execFileSync('unzip', ['-p', resolve(archive), file], { maxBuffer: 16 * 1024 * 1024 });
    if (!bytes.equals(await readFile(join(directory, file)))) throw new Error(`ZIP contains stale or changed bytes: ${file}`);
  }
  return build;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await verifyPackage();
  console.log(`Verified SoundSky ${result.version}: manifest, assets, licenses and ZIP contents`);
}
