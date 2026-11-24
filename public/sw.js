const prefix='ajisai:'+self.registration.scope+':';
const cacheName=prefix+'0cfc09bb483386597116';
const files=["access.css","art.js","boot.js","cloud.js","config.js","day-1.webp","day-2.webp","day-3.webp","day-4.webp","day-5.webp","day-6.webp","google.js","hero.webp","icon-192.png","icon-512.png","index.html","integrity.js","manifest.webmanifest","membership.js","style.css","vault.js"].map(file=>new URL(file,self.registration.scope).href);
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
});
