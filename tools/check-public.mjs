import {readdir,readFile} from 'node:fs/promises';
const dir=new URL('../public/',import.meta.url);
const allowed=/^(index\.html|(?:art|google|membership|cloud|vault|config|integrity|boot|sw)\.js|(?:access|style)\.css|manifest\.webmanifest|(?:hero|day-[1-6])\.webp|icon-(?:192|512)\.png)$/;
for(const entry of await readdir(dir,{withFileTypes:true})){
  if(!entry.isFile()||!allowed.test(entry.name))throw Error('Unexpected public asset '+entry.name);
  if(/\.(js|css|html|webmanifest)$/.test(entry.name)){
    const text=await readFile(new URL(entry.name,dir),'utf8');
    if(/BEGIN PRIVATE KEY|private_key_id|refresh_token"\s*:|passportNumber|boardingPassNumber|serviceAccountKey/i.test(text))throw Error('Private or unrelated content: '+entry.name);
  }
}
const config=await readFile(new URL('config.js',dir),'utf8');
if(process.env.GITHUB_ACTIONS && !/projectId\s*=\s*'[^']+'/.test(config))throw Error('Production Firebase is not configured');
console.log('Public asset allowlist passed');

