// ŻELAZO — Kopia danych: eksport/import JSON ze scalaniem i plik na dysku (File System Access).
// Moduł zawiera tylko deklaracje; kod startowy jest w __init_N, wywoływanych przez main.js w stałej kolejności.
import { parseISO, todayISO } from '../lib/dates';
import { mergeState } from '../lib/merge.js';
import { normalizeIncoming } from '../lib/state';
import { renderWeight } from '../screens/progress';
import { renderShop } from '../screens/shop';
import { refreshSyncUI } from '../screens/sync-ui';
import { renderToday } from '../screens/train';
import { S, __set_S, save } from './state';
import { t } from '../lib/i18n';

export let SCHEMA_VERSION, fileHandle, fileWriteTimer, FS_SUPPORTED, viewOffset;
export function __set_viewOffset(v){ viewOffset=v; return v; }
export function __set_fileHandle(v){ fileHandle=v; return v; }

// zbuduj obiekt eksportu
export function buildExport(){
  return {app:"ZELAZO", schema:SCHEMA_VERSION, exportedAt:new Date().toISOString(), data:S};
}

// pobierz JSON jako plik
export function exportJSON(){
  const blob=new Blob([JSON.stringify(buildExport(),null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download='zelazo-backup-'+todayISO()+'.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  S._lastExport=Date.now(); save(); refreshSyncUI();
}

// wczytaj plik i scal
export function importJSONFromObject(obj, {silent=false}={}){
  const inc = (obj && obj.data) ? obj.data : obj; // akceptuj format z eksportu lub surowy stan
  if(!inc || typeof inc!=='object'){ if(!silent) alert(t('To nie wygląda na poprawną kopię SixMo.')); return false; }
  const before={days:Object.keys(S.log||{}).length, w:(S.weights||[]).length};
  __set_S(mergeState(S,normalizeIncoming(inc)));
  save();
  const after={days:Object.keys(S.log||{}).length, w:(S.weights||[]).length};
  S._lastImport=Date.now(); save();
  // przerysuj wszystko (widok dnia zachowany przy cichym scalaniu)
  if(!silent) viewOffset=0;
  renderToday(); renderWeight(); renderShop(); refreshSyncUI();
  if(!silent){
    const newDays=after.days-before.days, newW=after.w-before.w;
    alert(t('Scalono ✅\nDni w planie: {d} (+{nd})\nPomiary wagi: {w} (+{nw})', {d:after.days, nd:newDays, w:after.w, nw:newW}));
  }
  return true;
}

export function importJSONFile(file){
  const r=new FileReader();
  r.onload=()=>{ try{ importJSONFromObject(JSON.parse(String(r.result))); }catch(e){ alert(t('Nie udało się odczytać pliku: ')+e.message); } };
  r.readAsText(file);
}

export async function linkNewFile(){
  try{
    fileHandle=await window.showSaveFilePicker({
      suggestedName:'zelazo-dane.json',
      types:[{description:t('SixMo dane'),accept:{'application/json':['.json']}}]
    });
    await writeFile(); await persistHandle(); refreshSyncUI();
    alert(t('Plik podłączony ✅\nOd teraz każda zmiana zapisuje się automatycznie do tego pliku. Zapisz go w folderze Google Drive, a Drive zsynchronizuje go z innymi urządzeniami.'));
  }catch(e){ if(e.name!=='AbortError') alert(t('Nie udało się: ')+e.message); }
}

export async function linkExistingFile(){
  try{
    const [h]=await window.showOpenFilePicker({types:[{description:t('SixMo dane'),accept:{'application/json':['.json']}}]});
    fileHandle=h;
    const f=await h.getFile(); const txt=await f.text();
    if(txt.trim()) importJSONFromObject(JSON.parse(txt),{silent:true});
    await writeFile(); await persistHandle(); refreshSyncUI();
    alert(t('Plik podłączony i scalony ✅\nZmiany będą się zapisywać automatycznie.'));
  }catch(e){ if(e.name!=='AbortError') alert(t('Nie udało się: ')+e.message); }
}

export async function writeFile(){
  if(!fileHandle) return;
  try{
    if(fileHandle.queryPermission){
      const p=await fileHandle.queryPermission({mode:'readwrite'});
      if(p!=='granted'){ const r=await fileHandle.requestPermission({mode:'readwrite'}); if(r!=='granted')return; }
    }
    const w=await fileHandle.createWritable();
    await w.write(JSON.stringify(buildExport(),null,2));
    await w.close();
    S._lastFileWrite=Date.now();
  }catch(e){ /* cicho — plik mógł zostać odłączony */ }
}

export function scheduleFileWrite(){ clearTimeout(fileWriteTimer); fileWriteTimer=setTimeout(writeFile,600); }

export function unlinkFile(){ fileHandle=null; delHandle(); refreshSyncUI(); }

// przechowanie uchwytu między sesjami (IndexedDB)
export function idb(){ return new Promise<IDBDatabase>((res,rej)=>{const r=indexedDB.open('zelazo_fs',1);r.onupgradeneeded=()=>r.result.createObjectStore('h');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);}); }

export async function persistHandle(){ try{const db=await idb();db.transaction('h','readwrite').objectStore('h').put(fileHandle,'file');}catch(e){} }

export async function delHandle(){ try{const db=await idb();db.transaction('h','readwrite').objectStore('h').delete('file');}catch(e){} }

export async function restoreHandle(){
  if(!FS_SUPPORTED) return;
  try{
    const db=await idb();
    const h=await new Promise(r=>{const q=db.transaction('h').objectStore('h').get('file');q.onsuccess=()=>r(q.result);q.onerror=()=>r(null);});
    if(h){ fileHandle=h; refreshSyncUI(); }
  }catch(e){}
}

// najbliższy poniedziałek (dziś jeśli poniedziałek), jako dzień 1 = start treningów
export function upcomingMondayISO(){
  const d=new Date();d.setHours(0,0,0,0);
  const day=d.getDay(); // 0=Nd..6=Sb
  const add=(day===1)?0:((8-day)%7||7); // dni do najbliższego poniedziałku
  d.setDate(d.getDate()+add);
  return todayISO(d);
}

// dzień planu (1-based) i tydzień dla danej daty
export function dayIndexFor(dateISO){
  const start=parseISO(S.startDate); start.setHours(0,0,0,0);
  const d=parseISO(dateISO); d.setHours(0,0,0,0);
  return Math.floor((+d - +start)/86400000)+1; // 1 = dzień startu
}

export function weekOf(dayIdx){return Math.floor((dayIdx-1)/7)+1}

export function viewDateISO(){const d=new Date();d.setDate(d.getDate()+viewOffset);return todayISO(d)}

export function dayKey(iso){return iso}

export function __init_3(){

/* ============================================================
   SYNCHRONIZACJA / JSON (eksport, import ze scalaniem, plik na Dysku)
   ============================================================ */
SCHEMA_VERSION = 1;
fileHandle = null;      // uchwyt do pliku JSON (File System Access API, desktop Chrome)
fileWriteTimer = null;

/* ---- File System Access API: „podłącz plik" (desktop Chrome/Edge) ---- */
FS_SUPPORTED = ('showSaveFilePicker' in window) && ('showOpenFilePicker' in window);

// aktualnie oglądany dzień (offset od dziś)
viewOffset = 0;
}
