import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, readdir, rename, cp, symlink, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {publishBuild} from '../scripts/publish-build.mjs';
const exec=promisify(execFile),root=process.cwd(),buildScript=resolve('scripts/build.mjs'),packScript=resolve('scripts/package.mjs'),verifyScript=resolve('scripts/verify-package.mjs');
async function workspace(t){const directory=await mkdtemp(join(tmpdir(),'soundsky-dist-'));t.after(()=>rm(directory,{recursive:true,force:true}));return directory;}
async function fixture(t,invalid=false){
 const directory=await workspace(t);await cp('public',join(directory,'public'),{recursive:true});await cp('package.json',join(directory,'package.json'));
 await symlink(join(root,'node_modules'),join(directory,'node_modules'),'dir');await mkdir(join(directory,'src'));await mkdir(join(directory,'dist'));
 await writeFile(join(directory,'dist','old.js'),'last working build');
 for(const file of ['content','audio','background','theme-frame'])await writeFile(join(directory,'src',file+'.ts'),invalid&&file==='content'?'const invalid = ;':'console.log("'+file+'");');
 return directory;
}
test('compilation failure preserves the installed build and removes only staging files',async t=>{
 const directory=await fixture(t,true);await assert.rejects(exec(process.execPath,[buildScript],{cwd:directory}));
 assert.equal(await readFile(join(directory,'dist/old.js'),'utf8'),'last working build');assert.deepEqual((await readdir(directory)).filter(name=>name.startsWith('.soundsky-build-')),[]);
});
test('a validated build replaces stale assets and produces a verified archive',async t=>{
 const directory=await fixture(t);await exec(process.execPath,[buildScript],{cwd:directory});
 await assert.rejects(readFile(join(directory,'dist/old.js')),{code:'ENOENT'});assert.ok((await readFile(join(directory,'dist/content.js'),'utf8')).includes('content'));
 await exec(process.execPath,[packScript],{cwd:directory});await exec(process.execPath,[verifyScript],{cwd:directory});
 const names=(await exec('unzip',['-Z1',join(directory,'SoundSky.zip')])).stdout;
 assert.ok(names.includes('licenses/paper-shaders/NOTICE'));assert.ok(names.includes('START-HERE.txt'));assert.equal(names.includes('.map'),false);
 // Same paths/version, wrong bytes: the old artifact must fail validation.
 await writeFile(join(directory,'dist/content.js'),'changed after packaging');await assert.rejects(exec(process.execPath,[verifyScript],{cwd:directory}),/stale or changed bytes/);
 // A failed package must not replace the last verified ZIP.
 const archive=await readFile(join(directory,'SoundSky.zip'));await rm(join(directory,'dist/licenses/react/LICENSE'));
 await assert.rejects(exec(process.execPath,[packScript],{cwd:directory}));assert.deepEqual(await readFile(join(directory,'SoundSky.zip')),archive);
});
test('validation failure before publishing also preserves the installed build',async t=>{
 const directory=await fixture(t);const manifest=JSON.parse(await readFile(join(directory,'public/manifest.json'),'utf8'));manifest.icons['128']='icons/missing.png';await writeFile(join(directory,'public/manifest.json'),JSON.stringify(manifest));
 await assert.rejects(exec(process.execPath,[buildScript],{cwd:directory}),/Required distribution file is missing/);assert.equal(await readFile(join(directory,'dist/old.js'),'utf8'),'last working build');
});
test('failed directory replacement rolls back to the old build',async t=>{
 const directory=await workspace(t),target=join(directory,'dist'),staged=join(directory,'next');await mkdir(target);await mkdir(staged);await writeFile(join(target,'old'),'working');
 let moves=0;await assert.rejects(publishBuild(staged,target,async(...args)=>{if(++moves===2)throw Error('publish failed');return rename(...args);}),/publish failed/);
 assert.equal(await readFile(join(target,'old'),'utf8'),'working');assert.deepEqual((await readdir(directory)).sort(),['dist','next']);
});
test('a failed rollback retains the only copy of the previous build outside staging',async t=>{
 const directory=await workspace(t),target=join(directory,'dist'),staged=join(directory,'next');await mkdir(target);await mkdir(staged);await writeFile(join(target,'old'),'working');
 let moves=0;await assert.rejects(publishBuild(staged,target,async(...args)=>{if(++moves>1)throw Error('filesystem failure');return rename(...args);}),/Previous build preserved at/);
 const backup=(await readdir(directory)).find(name=>name.startsWith('dist.previous-'));assert.ok(backup);assert.equal(await readFile(join(directory,backup,'old'),'utf8'),'working');
});
