// ŻELAZO — Stan aplikacji (S), konfiguracja serwera (CLOUD) i synchronizacja — połączenie lib/state, lib/api, lib/sync z ekranem.
// Moduł zawiera tylko deklaracje; kod startowy jest w __init_N, wywoływanych przez main.js w stałej kolejności.
import { curLang, t } from '../lib/i18n';
import { showInAppReminder } from '../features/reminders';
import { EMPTY_CLOUD, apiCall, channelFromPath } from '../lib/api';
import { langOf } from '../lib/lang';
import { mergeState } from '../lib/merge.js';
import { defaultState, hasUserData, migrateState, normalizeIncoming } from '../lib/state';
import { KEYS, readJSON, writeJSON } from '../lib/storage';
import { createSync } from '../lib/sync';
import { DEFAULT_KCAL } from '../plan/data';
import { setAdmin } from '../screens/admin';
import { renderCoach } from '../screens/coach';
import { __set_exIdxCache, exIdxCache } from '../screens/history';
import { renderWeight } from '../screens/progress';
import { renderShop } from '../screens/shop';
import { refreshCloudUI } from '../screens/sync-ui';
import { renderToday } from '../screens/train';
import { fileHandle, scheduleFileWrite, upcomingMondayISO } from './backup';
import { netDown, updateNetPill } from './shell';

export let LS, S, CLOUD_LS, CLOUD, SYNC, pendingRefresh;
export function __set_S(v){ S=v; return v; }
export function __set_CLOUD(v){ CLOUD=v; return v; }

export function load(){
  const r=readJSON(LS, null);
  return r ? migrateState(r, DEFAULT_KCAL) : defaultState(upcomingMondayISO(), DEFAULT_KCAL);
}

// czy na urządzeniu są czyjeś dane (dziennik, waga, obwody, posiłki, profil)
export function deviceHasData(){ return hasUserData(S); }

export function save(){__set_exIdxCache(null); writeJSON(LS, S); if(fileHandle) scheduleFileWrite(); scheduleCloudPush();}

export function loadCloud(){ return readJSON(CLOUD_LS, null) || Object.assign({}, EMPTY_CLOUD); }

export function saveCloud(){ writeJSON(CLOUD_LS, CLOUD); }

export function scheduleCloudPush(){ SYNC.schedule(); }

// wspólne wywołanie do Apps Script. Używamy text/plain, by uniknąć preflightu CORS.
// wersja aplikacji z adresu: stabilna w katalogu głównym, pozostałe w /beta/, /early/, /users/ (funkcja, bo potrzebna od startu)
export function appChannel(){ return channelFromPath(location.pathname); }

// pliki bibliotek w paczce aplikacji: vendor/ obok wersji stabilnej (beta, Early Access, USERS — piętro wyżej)
export function vendorUrl(p){ return new URL((appChannel()==='stable'?'':'../')+'vendor/'+p, location.href).href; }

// lang: język konta — Trener, ocena techniki i szacowanie AI odpowiadają w nim (serwer: langOf / accountLang w Kod.js)
// langAt: kiedy ustawiony; język od administratora wygrywa tylko, gdy jest nowszy (wybór sprzed tej zmiany = 1)
export function cloudCall(action, payload){
  const p=S.profile||{};
  return apiCall(CLOUD, appChannel(), action, Object.assign({lang:langOf(p), langAt:p.langAt||(p.lang?1:0)}, payload||{}));
}

// ping: administrator zmienił język tego konta — przejmij go (zapisze się w profilu i zsynchronizuje)
export function applyAccountLang(j){
  if(!j || !j.lang || !S.profile || (+j.langAt||0)<=(S.profile.langAt||0)) return;
  S.profile.lang=j.lang==='en'?'en':'pl'; S.profile.langAt=+j.langAt; S._settingsM=Date.now(); save();
  const el=document.getElementById('pfLang') as HTMLSelectElement|null; if(el) el.value=S.profile.lang;
  if(S.profile.lang!==curLang()){ setTimeout(()=>location.reload(), 400); return; }   // cała aplikacja w nowym języku
  renderCoach();
}

export function cloudPush(){ return SYNC.push(); }

export async function cloudPull({silent=false}={}){
  const r=await SYNC.pull();
  if(silent) return;
  if(r.skipped==='url') alert(t('Najpierw wpisz URL skryptu.'));
  else if(r.skipped==='account') alert(t('Wpisz nazwę konta.'));
  else if(r.ok) showInAppReminder(t('✅ Zsynchronizowano'),t('Dane pobrane i scalone.'));
  else if(r.offline) alert(t('Brak internetu. Dane są zapisane na telefonie — zsynchronizuję je, gdy wróci zasięg.'));
  else alert(t('Błąd synchronizacji: ')+r.error);
}

export async function cloudTest(){
  if(!CLOUD.url){ alert(t('Wpisz URL skryptu.')); return; }
  refreshCloudUI('...test');
  try{
    const j=await cloudCall('ping', {});
    CLOUD.lastError=''; saveCloud(); refreshCloudUI(); setAdmin(!!j.admin); applyAccountLang(j);
    showInAppReminder(t('✅ Połączenie działa'), t('Skrypt odpowiada poprawnie.'));
  }catch(e){ CLOUD.lastError=e.message; saveCloud(); refreshCloudUI(); alert(t('Test nieudany: ')+e.message); }
}

export function isEditing(){
  const a=document.activeElement;
  if(!a) return false;
  const tag=a.tagName;
  return tag==='INPUT' || tag==='TEXTAREA' || tag==='SELECT' || a.isContentEditable;
}

export function refreshAllViews(){
  // nie przerysowuj, gdy użytkownik właśnie coś wpisuje — inaczej straci focus i wpisywany tekst
  if(isEditing()){ pendingRefresh=true; return; }
  renderToday(); renderWeight(); renderShop();
  if(document.getElementById('coachDialog').classList.contains('show')) renderCoach();   // nowe wiadomości z innego urządzenia
}

export function __init_2(){

/* ============================================================
   STAN / STORAGE
   ============================================================ */
LS = KEYS.STATE;
S = load();

/* ============================================================
   KONFIGURACJA CHMURY (Apps Script) — osobno od S, per urządzenie
   ============================================================ */
CLOUD_LS = KEYS.CLOUD;
CLOUD = loadCloud();

// synchronizacja (lib/sync.ts): wysyłka 2 s po ostatniej zmianie, nie w trakcie pisania
SYNC = createSync({
  cloud:()=>CLOUD, saveCloud, call:(a,p)=>cloudCall(a,p),
  getState:()=>S, setState:m=>{ S=m; writeJSON(LS, S); refreshAllViews(); },
  merge:(a,b)=>mergeState(a, normalizeIncoming(b)),
  status:t=>refreshCloudUI(t), editing:isEditing, isNetErr:netDown, afterPush:()=>updateNetPill(),
});
pendingRefresh = false;
// gdy użytkownik skończy edycję pola, dokończ odłożone przerysowanie
document.addEventListener('focusout', ()=>{
  setTimeout(()=>{ if(pendingRefresh && !isEditing()){ pendingRefresh=false; renderToday(); renderWeight(); renderShop(); } }, 150);
});
}
