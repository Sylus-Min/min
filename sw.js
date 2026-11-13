// 梦境传讯 Service Worker v42（离线修复版）
// 修复1：上一版文件换行被写成 <br/> 文本导致 SW 语法报错、注册失败 -> 离线完全失效；本版为合法 JS。
// 修复2：导航请求断网时，除命中当前 URL 外，兜底命中首页缓存(index.html / ./)，杜绝返回"离线模式"白屏。
const CACHE = 'dreamtx-offline-v42';
// 预缓存：相对 sw.js 所在目录解析，确保 GitHub Pages 子目录(/repo/)也能命中
const PRE = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(async cache => {
      // 逐个 add，避免单个 manifest 缺失导致整体 addAll 失败、install 回滚
      await Promise.all(PRE.map(u => cache.add(u).catch(() => {})));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => /^dreamtx-offline-/.test(k) && k !== CACHE).map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return;

  // 页面导航：网络优先；断网时缓存兜底(index.html)，绝不返回白屏
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const netRes = await fetch(req);
        if (netRes && netRes.ok) cache.put(req, netRes.clone());
        return netRes;
      } catch {
        const cached =
          (await cache.match(req)) ||
          (await cache.match('./index.html')) ||
          (await cache.match('./')) ||
          (await cache.match('index.html'));
        if (cached) return cached;
        return new Response(
          '<!doctype html><meta charset="utf-8"><title>离线</title>' +
          '<body style="font-family:sans-serif;padding:24px">当前离线且本地暂无缓存，联网后打开一次即可离线使用。</body>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }
    })());
    return;
  }

  // 静态资源：stale-while-revalidate，先回缓存保稳定，后台静默更新
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cachedRes = await cache.match(req);
    const netPromise = fetch(req)
      .then(netRes => {
        if (netRes && netRes.ok) cache.put(req, netRes.clone());
        return netRes;
      })
      .catch(() => null);
    if (cachedRes) { e.waitUntil(netPromise); return cachedRes; }
    const netRes = await netPromise;
    return netRes || Response.error();
  })());
});
