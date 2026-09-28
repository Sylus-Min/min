// ===== Mochi 单文件版 Service Worker：完全离线可用 =====
// 适配「单文件部署」（index.html 已内联全部 83 个模块，仓库无独立 js/ 目录）。
// 预缓存只列实际存在的文件，逐个容错（单文件部署通常只有 index.html + sw.js，
// 个别图标/manifest 缺失也不会拖垮安装）。策略：壳 = stale-while-revalidate，
// 断网时直接回退缓存的 index.html，保证离线、无信号也能秒开。
const CACHE = 'mochi-single-v20260929b';
const SHELL = ['./', './index.html'];
const OPTIONAL = ['./manifest.json', './icon-192.png', './icon-512.png', './icon-180.png'];
const NET_TIMEOUT = 7000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error('net-timeout')), ms))
  ]);
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // 核心壳：必须缓存成功，否则 SW 不安装
    for (const url of SHELL) {
      try { await cache.add(new Request(url, { cache: 'reload' })); }
      catch (err) { /* 单个失败忽略，下面再兜底一次 './' */ }
    }
    if (!(await cache.match('./index.html')) && !(await cache.match('./'))) {
      try { await cache.add(new Request('./index.html', { cache: 'reload' })); } catch (e2) {}
    }
    // 可选资源：失败不影响安装
    for (const url of OPTIONAL) {
      try { await cache.add(new Request(url, { cache: 'reload' })); } catch (e3) {}
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

function isNavigation(req) {
  return req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept') || '').includes('text/html');
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // 页面/导航：先回缓存(秒开、离线可用)，后台悄悄更新，下次生效
  if (isNavigation(req)) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = (await cache.match(req)) || (await cache.match('./index.html')) || (await cache.match('./'));
      const netTask = withTimeout(fetch(req.clone()), NET_TIMEOUT)
        .then(async (resp) => {
          try { if (resp && resp.ok) await cache.put(req.clone(), resp.clone()); } catch (_) {}
          return resp;
        })
        .catch(() => null);
      if (cached) { netTask.catch(() => {}); return cached; }   // 有缓存：先吐缓存，后台更新
      const net = await netTask;                                 // 无缓存：等网络
      return net || cached || Response.error();
    })());
    return;
  }

  // 其它资源：缓存优先，未命中走网络并回填
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    if (hit) return hit;
    try {
      const resp = await withTimeout(fetch(req.clone()), NET_TIMEOUT);
      if (resp && resp.ok) { try { await cache.put(req.clone(), resp.clone()); } catch (_) {} }
      return resp;
    } catch (_) {
      return hit || Response.error();
    }
  })());
});
