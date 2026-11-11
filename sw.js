// 梦境传讯 · 配套 Service Worker (v38)
// 缓存名 dreamtx-offline-v38；导航网络优先、离线兜底，永不返回错误页；静态资源缓存优先。
const CACHE='dreamtx-offline-v38';
const PRE=['./','./index.html','./manifest.webmanifest'];

self.addEventListener('install',e=>{ self.skipWaiting(); });

self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    try{ const ks=await caches.keys(); await Promise.all(ks.filter(k=>/^dreamtx-offline-/.test(k)&&k!==CACHE).map(k=>caches.delete(k))); }catch(e){}
    try{ await self.clients.claim(); }catch(e){}
  })());
});

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  if(req.mode==='navigate'){
    e.respondWith((async()=>{
      try{ const r=await fetch(req); const c=await caches.open(CACHE); c.put('./index.html',r.clone()); return r; }
      catch(err){ const c=await caches.open(CACHE); return (await c.match('./index.html'))||(await c.match('./'))||Response.error(); }
    })());
    return;
  }
  e.respondWith((async()=>{
    const c=await caches.open(CACHE);
    const hit=await c.match(req);
    if(hit){ fetch(req).then(r=>{ if(r&&r.ok)c.put(req,r.clone()); }).catch(()=>{}); return hit; }
    try{ const r=await fetch(req); if(r&&r.ok)c.put(req,r.clone()); return r; }
    catch(err){ return Response.error(); }
  })());
});
