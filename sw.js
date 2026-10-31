// ŻELAZO — działanie bez internetu (np. siłownia w piwnicy).
// Ten sam plik działa w katalogu głównym (wersja stabilna) i w /beta/ — każda ma własną kopię.
// Strony: najpierw sieć (świeża wersja), po 3 s albo bez sieci — kopia z telefonu (osobno dla każdego adresu).
// Ikony, manifest i czcionki: kopia od razu, odświeżana w tle.
// Apps Script (POST: synchronizacja, Trener) i MediaPipe zawsze idą przez sieć.
const IS_BETA=/\/beta\/sw\.js$/.test(location.pathname);
const PREFIX=IS_BETA?'zelazo-beta-v':'zelazo-v';
const CACHE=PREFIX+'2';
const PAGE=new URL('./', location).href;
const ICONS=IS_BETA?'../icons/':'icons/';
const CORE=[PAGE,'manifest.webmanifest',...['icon.svg','favicon-32.png','apple-touch-icon.png','icon-192.png','icon-512.png','icon-maskable-512.png'].map(f=>ICONS+f)];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys()
    .then(ks=>Promise.all(ks.filter(k=>k.startsWith(PREFIX) && k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e=>{
  const r=e.request;
  if(r.method!=='GET') return;
  const u=new URL(r.url);
  if(r.mode==='navigate'){ e.respondWith(networkFirst(r)); return; }
  if(u.origin===location.origin || u.host==='fonts.googleapis.com' || u.host==='fonts.gstatic.com') e.respondWith(staleWhileRevalidate(r));
});

// adres strony bez ?v=… i „index.html” — /ProPlan/ i /ProPlan/index.html to ta sama kopia
function pageKey(url){ const u=new URL(url); u.search=''; u.hash=''; if(u.pathname.endsWith('/index.html')) u.pathname=u.pathname.slice(0,-10); return u.href; }
async function networkFirst(req){
  const c=await caches.open(CACHE), key=pageKey(req.url);
  const net=fetch(req).then(res=>{ if(res.ok) c.put(key, res.clone()); return res; });
  try{
    const res=await Promise.race([net, new Promise(r=>setTimeout(r,3000))]);   // słaby zasięg: nie czekaj w nieskończoność
    if(res) return res;
  }catch(err){}
  const hit=await c.match(key) || await c.match(PAGE);
  return hit || net;
}
async function staleWhileRevalidate(req){
  const c=await caches.open(CACHE), hit=await c.match(req);
  const net=fetch(req).then(res=>{ if(res.ok || res.type==='opaque') c.put(req, res.clone()); return res; }).catch(()=>hit);
  return hit || net;
}
