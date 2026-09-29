const V='dreamtx-offline-v22';
const CORE=['./','./index.html'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(V).then(c=>Promise.allSettled(CORE.map(u=>c.add(new Request(u,{cache:'reload'}))))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET'||!r.url.startsWith('http'))return;
  e.respondWith(
    caches.match(r,{ignoreSearch:false}).then(hit=>{
      const net=()=>fetch(r).then(res=>{
        try{if(res&&res.status===200){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp))}}catch(x){}
        return res;
      }).catch(()=>null);
      if(hit){ if(r.mode==='navigate') net(); return hit; }
      return net().then(x=>x||caches.match('./index.html',{ignoreSearch:true}).then(y=>y||caches.match('./')))
        .then(x=>x||Response.error());
    })
  );
});
