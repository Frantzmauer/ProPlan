// ŻELAZO beta — działanie bez internetu (np. siłownia w piwnicy).
// Zakres: tylko /beta/ — wersja stabilna działa jak dotąd.
// Strona: najpierw sieć (świeża wersja), po 3 s albo bez sieci — kopia z telefonu.
// Ikony, manifest i czcionki: kopia od razu, odświeżana w tle.
// Apps Script (POST: synchronizacja, Trener) i MediaPipe zawsze idą przez sieć.
const CACHE='zelazo-beta-v1';
const PAGE='./';
const CORE=[PAGE,'manifest.webmanifest','../icons/icon.svg','../icons/favicon-32.png','../icons/apple-touch-icon.png',
  '../icons/icon-192.png','../icons/icon-512.png','../icons/icon-maskable-512.png'];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys()
    .then(ks=>Promise.all(ks.filter(k=>k.startsWith('zelazo-beta-') && k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e=>{
  const r=e.request;
  if(r.method!=='GET') return;
  const u=new URL(r.url);
  if(r.mode==='navigate'){ e.respondWith(networkFirst(r)); return; }
  if(u.origin===location.origin || u.host==='fonts.googleapis.com' || u.host==='fonts.gstatic.com') e.respondWith(staleWhileRevalidate(r));
});

async function networkFirst(req){
  const c=await caches.open(CACHE);
  const net=fetch(req).then(res=>{ if(res.ok) c.put(PAGE, res.clone()); return res; });
  try{
    const res=await Promise.race([net, new Promise(r=>setTimeout(r,3000))]);   // słaby zasięg: nie czekaj w nieskończoność
    if(res) return res;
  }catch(err){}
  const hit=await c.match(PAGE);
  return hit || net;
}
async function staleWhileRevalidate(req){
  const c=await caches.open(CACHE), hit=await c.match(req);
  const net=fetch(req).then(res=>{ if(res.ok || res.type==='opaque') c.put(req, res.clone()); return res; }).catch(()=>hit);
  return hit || net;
}
