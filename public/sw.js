const prefix='ajisai:'+self.registration.scope+':';
const cacheName=prefix+'176af9c0c5c8cb00ca7d';
const files=["access.css","art.js","boot.js","cloud.js","config.js","day-1.webp","day-2.webp","day-3.webp","day-4.webp","day-5.webp","day-6.webp","device.js","expense.js","google.js","hero.webp","icon-192.png","icon-512.png","index.html","integrity.js","manifest.webmanifest","membership.js","outbox.js","style.css","vault.js","version.js","view-state.js","release.json"].map(file=>new URL(file,self.registration.scope).href);
const authFiles=['firebase-app.js','firebase-auth.js'].map(file=>'https://www.gstatic.com/firebasejs/13.4.0/'+file);
const entry=new URL('index.html',self.registration.scope).href;
async function isCurrentShell(response){
  if(!response.ok)return false;
  const bytes=await crypto.subtle.digest('SHA-256',await response.clone().arrayBuffer());
  const fingerprint=Array.from(new Uint8Array(bytes),value=>value.toString(16).padStart(2,'0')).join('');
  return fingerprint==='830364100eb819b59b1bdec4d3cb6d57cc4e9b32bd2cc946ed255e28c71ebb4a';
}
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(cacheName);
    await Promise.all(files.map(async url=>{
      const staging=new URL(url);
      staging.searchParams.set('app-build','176af9c0c5c8cb00ca7d');
      const response=await fetch(staging,{cache:'no-store'});
      if(!response.ok||url===entry&&!await isCurrentShell(response))throw Error('Incomplete App release');
      await cache.put(url,response);
    }));
    // Authentication code only. Firebase session and API responses are never cached here.
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),4000);
    await Promise.allSettled(authFiles.map(async url=>cache.add(new Request(url,{mode:'cors',credentials:'omit',signal:controller.signal}))));
    clearTimeout(timeout);
    // Activate the fully staged shell even if an installed PWA was suspended before it closed.
    // Open pages keep their current renderer; the next navigation loads the new shell.
    await self.skipWaiting();
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
  const target=event.request.mode==='navigate' && [self.registration.scope,entry].includes(url.origin+url.pathname)?entry:event.request.url;
  if(event.request.mode==='navigate'&&target===entry){
    event.respondWith((async()=>{
      const cache=await caches.open(cacheName);
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),3000);
      try{
        const response=await fetch(entry,{cache:'no-cache',signal:controller.signal});
        if(await isCurrentShell(response))return response;
      }catch{}finally{clearTimeout(timeout)}
      return (await cache.match(entry))||Response.error();
    })());
    return;
  }
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
