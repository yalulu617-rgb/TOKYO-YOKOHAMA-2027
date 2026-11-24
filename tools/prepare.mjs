import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=new URL('../',import.meta.url);
const read=p=>readFile(new URL(p,root),'utf8');
const write=(p,s)=>writeFile(new URL(p,root),s);
const hash=s=>createHash('sha256').update(s).digest('hex');
const data=JSON.parse(await read('private/source/data.json'));
const ids=(rows,key)=>new Set(rows.map(row=>row[key])).size===rows.length&&rows.every(row=>row[key]);
if(!ids(data.days,'id')||!ids(data.timeline,'id')||!ids(data.hotels,'rank')||
   !data.timeline.every(row=>data.days.some(day=>day.id===row.day)))throw Error('Invalid itinerary IDs or links');
const renderer=await read('private/source/app.js');
const layout=(await read('private/source/index.html')).split('<body>')[1].split('<script')[0];
const payload=JSON.stringify({renderer,layout,data});
if(Buffer.byteLength(payload)>950000)throw Error('Release exceeds document limit');
await write('private/release.json',JSON.stringify({fields:{payload:{stringValue:payload}}}));
let existing;
try{
  // Keep artifacts that shipped, not transient renderer hashes from local QA builds.
  existing=execFileSync('git',['show','HEAD:public/integrity.js'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']});
}catch{existing=await read('public/integrity.js')}
const current=hash(renderer);
const previous=existing.match(/rendererHash="([a-f0-9]{64})"/)?.[1];
const known=existing.match(/offlineRenderers=(\[[^\]]*\])/)?.[1]||'[]';
const offlineRenderers=Array.from(new Set([previous,...JSON.parse(known)].filter(x=>x&&x!==current))).slice(0,3);
await write('public/integrity.js','export const rendererHash='+JSON.stringify(current)+';\nexport const layoutHash='+JSON.stringify(hash(layout))+';\nexport const releaseId='+JSON.stringify(hash(payload))+';\nexport const offlineRenderers='+JSON.stringify(offlineRenderers)+';\n');

