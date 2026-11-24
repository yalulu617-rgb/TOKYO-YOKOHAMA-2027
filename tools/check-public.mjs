import {readdir,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const dir=new URL('../public/',import.meta.url);
const allowed=/^(index\.html|(?:art|google|membership|cloud|vault|device|outbox|expense|config|integrity|boot|sw)\.js|(?:access|style)\.css|(?:manifest\.webmanifest|release\.json)|(?:hero|day-[1-6])\.webp|icon-(?:192|512)\.png)$/;
for(const entry of await readdir(dir,{withFileTypes:true})){
  if(!entry.isFile()||!allowed.test(entry.name))throw Error('Unexpected public asset '+entry.name);
  if(/\.(js|css|html|webmanifest)$/.test(entry.name)){
    const text=await readFile(new URL(entry.name,dir),'utf8');
    if(/BEGIN PRIVATE KEY|private_key_id|refresh_token"\s*:|passportNumber|boardingPassNumber|serviceAccountKey/i.test(text))throw Error('Private or unrelated content: '+entry.name);
    if(entry.name.endsWith('.js')){
      const result=spawnSync(process.execPath,['--input-type=module','--check'],{input:text,encoding:'utf8'});
      if(result.status!==0)throw Error(entry.name+' syntax: '+result.stderr);
    }
  }
}
const manifest=JSON.parse(await readFile(new URL('manifest.webmanifest',dir),'utf8'));
for(const path of [manifest.id,manifest.start_url,manifest.scope,...manifest.icons.map(icon=>icon.src)]){
  if(!path||path.startsWith('/')||path.includes('://')||path.includes('..'))throw Error('Non-relative PWA path');
  if(path!=='./')await readFile(new URL(path,dir));
}
const worker=await readFile(new URL('sw.js',dir),'utf8');
const files=JSON.parse(worker.match(/^const files=(\[[^\r\n]+?\])\.map/m)[1]);
for(const file of files)await readFile(new URL(file,dir));
const metadata=JSON.parse(await readFile(new URL('release.json',dir),'utf8'));
if(!worker.includes("'"+metadata.cacheVersion+"'")||!/^[a-f0-9]{40}$/.test(metadata.gitCommit)||
   (process.env.GITHUB_ACTIONS&&metadata.gitCommit!==process.env.GITHUB_SHA))throw Error('Release metadata mismatch');
const git=spawnSync('git',['ls-files','-z'],{cwd:fileURLToPath(new URL('../',dir)),encoding:'utf8'});
for(const file of git.stdout.split('\0')){
  if(/(^|\/)(private|reference|node_modules|\.env)(\/|$)|\.(?:enc|clixml|pem|pfx)$/i.test(file))throw Error('Private tracked file: '+file);
  if(/\.(?:js|mjs|json|yml|md|html|rules)$/.test(file)){
    const content=await readFile(new URL('../'+file,dir),'utf8');
    if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bgh[pousr]_[a-zA-Z0-9]{30,}\b|\bgithub_pat_[a-zA-Z0-9_]{40,}\b/.test(content))throw Error('Secret-like value in '+file);
  }
}
const config=await readFile(new URL('config.js',dir),'utf8');
if(process.env.GITHUB_ACTIONS && !/projectId\s*=\s*'[^']+'/.test(config))throw Error('Production Firebase is not configured');
console.log('Public asset allowlist passed');

