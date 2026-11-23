import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir=new URL('../public/',import.meta.url);
const files=(await readdir(dir)).filter(x=>x!=='sw.js').sort();
const hash=createHash('sha256');
for(const file of files){hash.update(file);hash.update(await readFile(new URL(file,dir)))}
const version=hash.digest('hex').slice(0,20);
const source=`const prefix='ajisai:'+self.registration.scope+':';
const cacheName=prefix+'${version}';
const files=${JSON.stringify(files)}.map(file=>new URL(file,self.registration.scope).href);
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll(files.map(url=>new Request(url,{cache:'reload'})))));
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    for(const key of await caches.keys())if(key.startsWith(prefix)&&key!==cacheName)await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  const entry=new URL('index.html',self.registration.scope).href;
  const target=event.request.mode==='navigate' && [self.registration.scope,entry].includes(url.origin+url.pathname)?entry:event.request.url;
  if(!files.includes(target))return;
  event.respondWith(caches.open(cacheName).then(async cache=>(await cache.match(target))||fetch(event.request)));
});\n`;
await writeFile(new URL('sw.js',dir),source);
console.log('PWA shell',version,files.length,'assets');

