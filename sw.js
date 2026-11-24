// HORUS Terrain : fonctionnement hors connexion (version 74072c9d)
const CACHE = "horus-terrain-74072c9d", CACHE_PDF = "horus-pdfjs-6.2.108";
const FICHIERS = ["./", "index.html", "manifest.webmanifest", "icone-180.png", "icone-192.png", "icone-512.png"];
const PDFJS = ["pdfjs/pdf.min.mjs", "pdfjs/pdf.worker.min.mjs"];
self.addEventListener("install", e => { e.waitUntil(Promise.all([
  caches.open(CACHE).then(c => c.addAll(FICHIERS)),
  caches.open(CACHE_PDF).then(c => c.match(PDFJS[1]).then(r => r ? null : c.addAll(PDFJS))).catch(() => null),
]).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== CACHE_PDF).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (u.hostname === "data.geopf.fr" && u.pathname.startsWith("/wmts")) {   // fonds IGN : gardés pour les chantiers préparés hors réseau
    e.respondWith(caches.match(e.request.url).then(r => r || fetch(e.request)));
    return;
  }
  if (u.origin !== self.location.origin) return;   // autres cartes et services : toujours en ligne
  if (u.pathname.includes("/pdfjs/")) {          // lecteur PDF : cache d'abord (il ne change qu'avec sa version)
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(x => { const c = x.clone(); caches.open(CACHE_PDF).then(k => k.put(e.request, c)); return x; })));
    return;
  }
  // page : réseau d'abord (nouvelle version), mais 3 s au plus ; réseau faible ou absent -> copie du téléphone
  const reseau = fetch(e.request.url, { cache: "no-cache", credentials: "same-origin" }).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(k => k.put(e.request, c)); } return r; });
  const copie = () => caches.match(e.request).then(r => r || caches.match("index.html"));
  e.respondWith(new Promise(ok => {
    let fini = false;
    const t = setTimeout(() => copie().then(r => { if (r && !fini) { fini = true; ok(r); } }), 3000);
    reseau.then(r => { if (!fini) { fini = true; clearTimeout(t); ok(r); } })
      .catch(() => copie().then(r => { if (!fini) { fini = true; clearTimeout(t); ok(r || Response.error()); } }));
  }));
});
