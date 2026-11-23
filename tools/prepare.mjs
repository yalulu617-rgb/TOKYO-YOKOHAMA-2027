import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const read=p=>readFile(new URL(p,root),'utf8');
const write=(p,s)=>writeFile(new URL(p,root),s);
const hash=s=>createHash('sha256').update(s).digest('hex');
const data=JSON.parse(await read('private/source/data.json'));
const renderer=await read('private/source/app.js');
const layout=(await read('private/source/index.html')).split('<body>')[1].split('<script')[0];
const payload=JSON.stringify({renderer,layout,data});
if(Buffer.byteLength(payload)>950000)throw Error('Release exceeds document limit');
await write('private/release.json',JSON.stringify({fields:{payload:{stringValue:payload}}}));
await write('public/integrity.js','export const rendererHash='+JSON.stringify(hash(renderer))+';\nexport const layoutHash='+JSON.stringify(hash(layout))+';\nexport const releaseId='+JSON.stringify(hash(payload))+';\n');

