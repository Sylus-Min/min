/* sw.js - 梦境传讯 修复版 v35
 * 策略：导航请求「网络优先」，失败才回退缓存/内联兜底，绝不让页面「打不开」；
 * 静态资源「命中即返回 + 后台刷新」。激活时清掉所有旧版本缓存（v34 及更早）。
 * 只动离线缓存，绝不触碰聊天记录（记录存在 IndexedDB / localStorage，删缓存也还在）。
 */
var V = 'dreamtx-offline-v35';
var CORE = ['./', './index.html'];
var MAXN = 60;
var Q = Promise.resolve();
var q = function (f) { Q = Q.then(f).catch(function () {}); };
self.addEventListener('install', function (e) {
  e.waitUntil(q(function () {
    return caches.open(V).then(function (c) {
      return Promise.allSettled(CORE.map(function (u) { return c.add(new Request(u, { cache: 'reload' })); }));
    });
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(q(function () {
    return caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k !== V; }).map(function (k) { return caches.delete(k); }));
    });
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET') return;
  var u; try { u = new URL(r.url); } catch (x) { return; }
  if (u.origin !== self.location.origin) return;
  if (r.mode === 'navigate') {
    e.respondWith(
      fetch(r).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') { var cl = res.clone(); q(function () { return caches.open(V).then(function (c) { return c.put(r, cl); }); }); }
        return res;
      }).catch(function () {
        return caches.open(V).then(function (c) { return c.match('./index.html', { ignoreSearch: true }) || c.match('./', { ignoreSearch: true }); }).then(function (h) {
          return h || new Response('<!doctype html><meta charset=utf-8><title>梦境传讯</title><body style="font-family:-apple-system,sans-serif;text-align:center;padding:48px;color:#6a5a7a">网络暂时不可用，连网后请下拉刷新重试。</body>', { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
        });
      })
    );
    return;
  }
  e.respondWith(caches.open(V).then(function (c) {
    return c.match(r, { ignoreSearch: false }).then(function (hit) {
      var net = function () {
        return fetch(r).then(function (res) {
          if (res && res.status === 200 && res.type === 'basic') { var cl = res.clone(); q(function () { c.put(r, cl).then(function () { return c.keys().then(function (a) { for (var i = 0; i < a.length - MAXN; i++) c.delete(a[i]); }); }); }); }
          return res;
        }).catch(function () { return null; });
      };
      if (hit) { q(net); return hit; }
      return net().then(function (x) { return x || Response.error(); });
    });
  }));
});
