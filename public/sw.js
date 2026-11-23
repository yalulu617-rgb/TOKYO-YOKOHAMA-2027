const prefix='ajisai:'+self.registration.scope+':';
const cacheName=prefix+'f30bcacc40e65c24a66a';
const files=["access.css","art.js","boot.js","cloud.js","config.js","day-1.webp","day-2.webp","day-3.webp","day-4.webp","day-5.webp","day-6.webp","google.js","hero.webp","icon-192.png","icon-512.png","index.html","integrity.js","manifest.webmanifest","membership.js","style.css","vault.js"].map(file=>new URL(file,self.registration.scope).href);
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
});
