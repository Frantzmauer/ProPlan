// ŻELAZO — Stan aplikacji (S), konfiguracja serwera (CLOUD) i synchronizacja — połączenie lib/state, lib/api, lib/sync z ekranem.
// Moduł zawiera tylko deklaracje; kod startowy jest w __init_N, wywoływanych przez main.js w stałej kolejności.
import { showInAppReminder } from '../features/reminders.js';
import { EMPTY_CLOUD, apiCall, channelFromPath } from '../lib/api';
import { mergeState } from '../lib/merge.js';
import { defaultState, hasUserData, migrateState, normalizeIncoming } from '../lib/state';
import { KEYS, readJSON, writeJSON } from '../lib/storage';
import { createSync } from '../lib/sync';
import { DEFAULT_KCAL } from '../plan/data.js';
import { setAdmin } from '../screens/admin.js';
import { renderCoach } from '../screens/coach.js';
import { __set_exIdxCache, exIdxCache } from '../screens/history.js';
import { renderWeight } from '../screens/progress.js';
import { renderShop } from '../screens/shop.js';
import { refreshCloudUI } from '../screens/sync-ui.js';
import { renderToday } from '../screens/train.js';
import { fileHandle, scheduleFileWrite, upcomingMondayISO } from './backup.js';
import { netDown, updateNetPill } from './shell.js';

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

export function cloudCall(action, payload){ return apiCall(CLOUD, appChannel(), action, payload||{}); }

export function cloudPush(){ return SYNC.push(); }

export async function cloudPull({silent}={}){
  const r=await SYNC.pull();
  if(silent) return;
  if(r.skipped==='url') alert('Najpierw wpisz URL skryptu.');
  else if(r.skipped==='account') alert('Wpisz nazwę konta.');
  else if(r.ok) showInAppReminder('✅ Zsynchronizowano','Dane pobrane i scalone.');
  else if(r.offline) alert('Brak internetu. Dane są zapisane na telefonie — zsynchronizuję je, gdy wróci zasięg.');
  else alert('Błąd synchronizacji: '+r.error);
}

export async function cloudTest(){
  if(!CLOUD.url){ alert('Wpisz URL skryptu.'); return; }
  refreshCloudUI('...test');
  try{
    const j=await cloudCall('ping', {});
    CLOUD.lastError=''; saveCloud(); refreshCloudUI(); setAdmin(!!j.admin);
    showInAppReminder('✅ Połączenie działa', 'Skrypt odpowiada poprawnie.');
  }catch(e){ CLOUD.lastError=e.message; saveCloud(); refreshCloudUI(); alert('Test nieudany: '+e.message); }
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
