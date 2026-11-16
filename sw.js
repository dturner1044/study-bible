// Keeps pages on the device so the site opens again without a connection.
var CACHE = 'gsb-202611151434';
var SHELL = ["index.html", "manifest.webmanifest", "assets/style.css", "assets/app.js", "assets/books.js", "assets/garamond.woff2", "assets/garamond-italic.woff2", "assets/icon-180.png", "assets/icon-192.png", "kjv/index.html", "bsb/index.html", "msb/index.html"];

function plain(res) {
  // some hosts answer "page.html" with a redirect to "page"; a redirected answer cannot be replayed for a page load
  if (!res.redirected) return Promise.resolve(res);
  return res.blob().then(function (b) { return new Response(b, { status: res.status, statusText: res.statusText, headers: res.headers }); });
}

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(SHELL.map(function (u) {
      return fetch(u).then(function (r) { return r.ok ? plain(r).then(function (p) { return c.put(u, p); }) : null; }).catch(function () {});
    }));
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { return k.indexOf('gsb-') === 0 && k !== CACHE ? caches.delete(k) : null; }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  var key = url.origin + url.pathname.replace(/\/$/, '/index.html');
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(key).then(function (hit) {
      return hit || (/\.[a-z0-9]+$/i.test(url.pathname) ? null : c.match(key + '.html'));
    }).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (!res.ok) return res;
        var copy = res.clone();
        plain(copy).then(function (p) { return c.put(key, p); }).catch(function () {});
        return res;
      });
    });
  }));
});
