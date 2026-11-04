// ŻELAZO — Praca bez internetu, wersja aplikacji, co nowego, czyszczenie danych.
// Moduł zawiera tylko deklaracje; kod startowy jest w __init_N, wywoływanych przez main.js w stałej kolejności.
import { applyFeatures } from '../features/plan-limits';
import { refreshNotifUI, showInAppReminder } from '../features/reminders';
import { isNetworkError } from '../lib/api';
import { renderWeight } from '../screens/progress';
import { renderShop } from '../screens/shop';
import { refreshSyncUI } from '../screens/sync-ui';
import { renderToday } from '../screens/train';
import { WO } from '../screens/workout';
import { __set_fileHandle, __set_viewOffset, delHandle, fileHandle, viewOffset } from './backup';
import { CLOUD, LS, S, __set_S, appChannel, cloudPush, load } from './state';

export let netPillT, APP_VER, APP_REL;

// wersja aplikacji: zaznacz tę, w której jesteś
/* ---- praca bez internetu ----
   Kopia aplikacji na telefonie (sw.js, tylko /beta/). Zmiany zapisują się lokalnie jak zawsze;
   bez sieci synchronizacja czeka (CLOUD.pending) i rusza sama po powrocie zasięgu. */
export function netDown(e){ return isNetworkError(e, navigator.onLine); }

export function updateNetPill(flash?){
  const p=document.getElementById('netPill'), t=document.getElementById('netTxt'); if(!p) return;
  clearTimeout(netPillT);
  const w=document.getElementById('woPTxt'); if(w && WO) w.textContent=w.textContent.replace(/ · offline$/,'')+(navigator.onLine?'':' · offline');
  if(!navigator.onLine){ p.classList.remove('ok'); t.textContent='Offline'; p.style.display='inline-flex'; return; }
  if(flash){ p.classList.add('ok'); t.textContent='Online'; p.style.display='inline-flex'; netPillT=setTimeout(()=>{ p.style.display='none'; }, 3000); return; }
  p.style.display='none';
}

export function netResync(){ if(navigator.onLine && CLOUD.on && CLOUD.url && CLOUD.account && CLOUD.pending) cloudPush(); }

// Early Access i USERS widać w wersji, w której jesteś, i u administratora
export function verVisible(admin){
  document.getElementById('verEarly').style.display=(admin || APP_VER==='early' || APP_VER==='users')?'':'none';
  document.getElementById('verUsers').style.display=(admin || APP_VER==='users')?'':'none';
}

export function __init_21(){
netPillT = null;
document.getElementById('netPill').onclick=()=>showInAppReminder(navigator.onLine?'Znów online':'Brak internetu',
  navigator.onLine?'Wysyłam zmiany zapisane bez zasięgu.':'Aplikacja działa dalej: serie, posiłki i waga zapisują się na telefonie. Zsynchronizuję je, gdy wróci zasięg. Trener i ocena techniki potrzebują internetu.');
window.addEventListener('online', ()=>{ updateNetPill(true); netResync(); });
window.addEventListener('offline', ()=>updateNetPill());
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) netResync(); });
setTimeout(updateNetPill, 0);   // po całym skrypcie — WO jest zadeklarowane niżej
if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost')) navigator.serviceWorker.register('sw.js', {scope:'./'}).catch(()=>{});

APP_VER = appChannel();
document.getElementById(({stable:'verStable', early:'verEarly', users:'verUsers'})[APP_VER]||'verBeta').classList.add('on');
// wszystkie wersje budowane z jednego źródła (tools/build.py) — linki i znaczek zależą od adresu
{ const up=APP_VER==='stable'?'':'../';
  [['verStable',up||'./'],['verBeta',up+'beta/'],['verEarly',up+'early/'],['verUsers',up+'users/'],['verOld',up+'v1.0/']].forEach(([id,h])=>{ document.getElementById(id).href=h; }); }
if(APP_VER==='stable') document.querySelectorAll('.beta-tag').forEach(x=>x.remove());
verVisible(false);
setTimeout(applyFeatures, 0);   // ostatni znany plan z telefonu; serwer potwierdzi przy starcie (checkAdmin)
// pierwsze otwarcie USERS: po co ta wersja
try{
  if(APP_VER==='users' && localStorage.getItem('zelazo_seen_users')!=='1'){
    setTimeout(()=>showInAppReminder('ŻELAZO USERS',
      'Wersja robocza kont i planów: tu powstają plany Darmowy i Premium, limity, panel administratora i płatności. Funkcje są takie jak w becie. Twój plan i limity: Więcej → Pakiet i limity AI.'), 1200);
    localStorage.setItem('zelazo_seen_users','1');
  }
}catch(e){}
// pierwsze otwarcie Early Access
try{
  if(APP_VER==='early' && localStorage.getItem('zelazo_seen_ea')!=='1'){
    setTimeout(()=>showInAppReminder('ŻELAZO Early Access',
      'Nowe funkcje przed wersją stabilną — dla Premium. Limity Twojego planu widzisz w rozmowie z Trenerem i w Więcej → Pakiet i limity AI. Krótkie „dzięki” i „ok” nie liczą się do limitu.'), 1200);
    localStorage.setItem('zelazo_seen_ea','1');
  }
}catch(e){}
// jednorazowo po aktualizacji do 1.3: co nowego (tylko w stabilnej i tylko u osób, które już korzystały)
APP_REL = '1.3';
try{
  if(APP_VER==="stable" && localStorage.getItem('zelazo_seen_rel')!==APP_REL){
    if(Object.keys(S.log||{}).length) setTimeout(()=>showInAppReminder('ŻELAZO 1.3 — co nowego',
      'Kalorie z trendu wagi: wydatek liczony z Twoich danych i propozycja celu. Zdjęcie posiłku — Trener rozpoznaje składniki, gramatury i kalorie. Godziny posiłków, przypomnienie po zwykłej porze i karta „Twoje nawyki”. Cykl: prognoza okresu i wzorce z check-inów. Szybsza aplikacja, która działa też bez internetu.'), 1200);
    localStorage.setItem('zelazo_seen_rel', APP_REL);
  }
}catch(e){}

// wipe
document.getElementById('wipe').onclick=()=>{
  if(confirm('Na pewno wyczyścić cały postęp? Tego nie da się cofnąć.')){
    localStorage.removeItem(LS);__set_S(load());__set_fileHandle(null);delHandle();
    __set_viewOffset(0);renderToday();renderWeight();renderShop();refreshNotifUI();refreshSyncUI();
    alert('Wyczyszczono. Zaczynamy od zera 💪');
  }
};
}
