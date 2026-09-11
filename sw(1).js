/* sw.js - 梦境传讯 v23：离线可用 + 不阻塞 + 自动清理旧缓存 */
const V='dreamtx-offline-v23',CORE=['./','./index.html'],MAXN=60;let Q=Promise.resolve();
const q=f=>{Q=Q.then(f).catch(()=>{})};
self.addEventListener('install',e=>{e.waitUntil(q(()=>caches.open(V).then(c=>Promise.allSettled(CORE.map(u=>c.add(new Request(u,{cache:'reload'})))))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(q(()=>caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k))))).then(()=>self.clients.claim()))});
const key=r=>{try{const u=new URL(r.url);return u.origin===self.location.origin?u.pathname+u.search:null}catch(x){return null}};
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;const k=key(r);if(!k)return;
  e.respondWith(caches.open(V).then(c=>c.match(r,{ignoreSearch:false}).then(hit=>{
    const net=()=>fetch(r).then(res=>{if(res&&res.status===200&&res.type==='basic')q(()=>{c.put(r,res.clone()).then(()=>c.keys().then(a=>{for(let i=0;i<a.length-MAXN;i++)c.delete(a[i])}))});return res}).catch(()=>null);
    if(hit){q(net);return hit}
    return net().then(x=>x||(r.mode==='navigate'?c.match('./index.html')||c.match('./'):null)||Response.error());
  })))});
