// Lets the app open with no signal: the page comes from the network when it answers within 3 seconds, else from the
// last copy kept here; the Firebase SDK, the font and the word lists are kept once fetched. Each build has its own
// cache (tools/build.py stamps it), so an update drops the old copies.
var CACHE = "grid-__BUILT__";
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
function keep(key, r) {
  // The SDK's script tags fetch without CORS, so its answers are opaque.
  if (r.ok || r.type === "opaque") { var c = r.clone(); caches.open(CACHE).then(function (ch) { ch.put(key, c); }); }
  return r;
}
self.addEventListener("fetch", function (e) {
  var q = e.request, u = q.url;
  if (q.method !== "GET") return;
  if (q.mode === "navigate") {
    var net = fetch(q).then(function (r) { return keep("index.html", r); });
    var late = new Promise(function (ok) { setTimeout(ok, 3000); });
    return e.respondWith(Promise.race([net, late]).then(function (r) { return r || caches.match("index.html").then(function (c) { return c || net; }); })
      .catch(function () { return caches.match("index.html").then(function (c) { return c || Response.error(); }); }));
  }
  // Fixed files: the versioned SDK, the font, the word lists (a build's own), and the icons and manifest.
  if (/^https:\/\/www\.gstatic\.com\/firebasejs\/|^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u) ||
      (u.indexOf(self.registration.scope) === 0 && /\/words\/\d+\.txt$|\.(png|webmanifest)$/.test(u)))
    e.respondWith(caches.match(q).then(function (c) { return c || fetch(q).then(function (r) { return keep(q, r); }); }));
});
