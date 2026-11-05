/* 梦境传讯 · 离线 Service Worker v30
   —— 关键修复：导航请求改为「网络优先」，在线时永远优先拿最新部署的页面（修好代码即时生效，
      不再被旧缓存挡住，从根本上解决「改了换头像还是像刷新/重新进入网站」）；
      断网/飞行模式时自动回落到本地缓存副本，无信号也能从主屏幕正常打开使用。 */
const V='dreamtx-offline-v30';
const CORE=['./','./index.html'];

self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(V).then(c=>Promise.allSettled(CORE.map(u=>c.add(new Request(u,{cache:'reload'}))))).then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys().then(ks=>Promise.all(ks.filter(k=>k.indexOf('dreamtx-offline-v')===0 && k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET'||!r.url.startsWith('http'))return;
  /* 页面导航：在线走网络拿最新，失败才回退缓存 —— 在线永远见新代码，离线仍能打开 */
  if(r.mode==='navigate'){
    e.respondWith(
      fetch(r).then(res=>{
        if(res&&res.status===200&&res.type==='basic'){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp));}
        return res;
      }).catch(()=>caches.match(r,{ignoreSearch:true})
        .then(h=>h||caches.match('./index.html',{ignoreSearch:true}))
        .then(y=>y||caches.match('./'))
        .then(x=>x||Response.error()))
    );
    return;
  }
  /* 静态资源：命中缓存先用、后台悄悄更新；未命中走网络 */
  e.respondWith(
    caches.match(r,{ignoreSearch:false}).then(hit=>{
      const net=()=>fetch(r).then(res=>{try{if(res&&res.status===200){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp));}}catch(x){}return res;}).catch(()=>null);
      if(hit){net();return hit;}
      return net().then(x=>x||caches.match('./index.html',{ignoreSearch:true})).then(x=>x||Response.error());
    })
  );
});
