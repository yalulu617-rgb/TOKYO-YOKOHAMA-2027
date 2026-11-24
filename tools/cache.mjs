import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const dir=new URL('../public/',import.meta.url);
const files=(await readdir(dir)).filter(x=>x!=='sw.js').sort();
const hash=createHash('sha256');
hash.update(await readFile(new URL(import.meta.url)));
for(const file of files){hash.update(file);hash.update(await readFile(new URL(file,dir)))}
const version=hash.digest('hex').slice(0,20);
const source=`const prefix='ajisai:'+self.registration.scope+':';
const cacheName=prefix+'${version}';
const files=${JSON.stringify(files)}.map(file=>new URL(file,self.registration.scope).href);
const authFiles=['firebase-app.js','firebase-auth.js'].map(file=>'https://www.gstatic.com/firebasejs/13.4.0/'+file);
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(cacheName);
    await cache.addAll(files.map(url=>new Request(url,{cache:'reload'})));
    // Authentication code only. Firebase session and API responses are never cached here.
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),4000);
    await Promise.allSettled(authFiles.map(async url=>cache.add(new Request(url,{mode:'cors',credentials:'omit',signal:controller.signal}))));
    clearTimeout(timeout);
  })());
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
  if(authFiles.includes(target)){
    event.respondWith((async()=>{
      const cache=await caches.open(cacheName);
      const cached=await cache.match(target);
      if(cached)return cached;
      const response=await fetch(event.request);
      if(response.ok)try{await cache.put(target,response.clone())}catch{}
      return response;
    })());
    return;
  }
  if(!files.includes(target))return;
  event.respondWith(caches.open(cacheName).then(async cache=>(await cache.match(target))||fetch(event.request)));
});\n`;
await writeFile(new URL('sw.js',dir),source);
console.log('PWA shell',version,files.length,'assets');

