// ŻELAZO — Ekran synchronizacji i jego przyciski.
// Moduł zawiera tylko deklaracje; kod startowy jest w __init_N, wywoływanych przez main.js w stałej kolejności.
import { FS_SUPPORTED, exportJSON, fileHandle, importJSONFile, linkExistingFile, linkNewFile, unlinkFile } from '../core/backup';
import { CLOUD, S, cloudPull, cloudPush, cloudTest, saveCloud } from '../core/state';
import { checkAdmin } from './admin';
import { locale, t as tt } from '../lib/i18n';

export let cloudUrl, cloudToken, cloudAccount;

export function readCloudInputs(){ CLOUD.url=cloudUrl.value.trim(); CLOUD.token=cloudToken.value.trim(); CLOUD.account=cloudAccount.value.trim(); saveCloud(); }

// ostrzeżenie w pasku dnia: synchronizacja włączona, ale ostatnia próba się nie udała
export function updateSyncWarn(){ const b=document.getElementById('syncWarn'); if(b) b.style.display=(CLOUD.on && CLOUD.lastError)?'inline-flex':'none'; }

export function refreshCloudUI(statusOverride?){
  updateSyncWarn();
  const tgl=document.getElementById('cloudToggle');
  tgl.classList.toggle('on',!!CLOUD.on);
  const el=document.getElementById('cloudState');
  if(statusOverride){ el.textContent=statusOverride; return; }
  if(CLOUD.lastError){ el.textContent=tt('Błąd: ')+CLOUD.lastError; el.style.color='var(--red)'; return; }
  el.style.color='';
  if(!CLOUD.on){ el.textContent=tt('Wyłączona'); return; }
  const t=CLOUD.lastSync?new Date(CLOUD.lastSync).toLocaleTimeString(locale(),{hour:'2-digit',minute:'2-digit'}):'—';
  el.textContent=tt('Włączona · ostatnio {t} · konto: {a}', {t, a:CLOUD.account||'—'});
}

export function refreshSyncUI(){
  const fmt=t=>{ if(!t)return '—'; const d=new Date(t); return d.toLocaleDateString(locale())+' '+d.toLocaleTimeString(locale(),{hour:'2-digit',minute:'2-digit'}); };
  const setTxt=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  setTxt('lastExport',tt('Ostatni eksport: {d}', {d:fmt(S._lastExport)}));
  setTxt('lastImport',tt('Ostatni import: {d}', {d:fmt(S._lastImport)}));
  const fsBox=document.getElementById('fsBox'), fsUnsup=document.getElementById('fsUnsup');
  if(FS_SUPPORTED){
    fsBox.style.display=''; fsUnsup.style.display='none';
    const linked=!!fileHandle;
    document.getElementById('fsLinked').style.display=linked?'':'none';
    document.getElementById('fsUnlinked').style.display=linked?'none':'';
    if(linked) setTxt('fsName',tt('Podłączony · zapis: {d}', {d:fmt(S._lastFileWrite)}));
  } else {
    fsBox.style.display='none'; fsUnsup.style.display='';
  }
}

export function __init_15(){

// ---- cloud sync UI ----
cloudUrl = document.getElementById('cloudUrl');
cloudToken = document.getElementById('cloudToken');
cloudAccount = document.getElementById('cloudAccount');
cloudUrl.value=CLOUD.url||''; cloudToken.value=CLOUD.token||''; cloudAccount.value=CLOUD.account||'';
[cloudUrl,cloudToken,cloudAccount].forEach(el=>el.addEventListener('change',()=>{readCloudInputs();refreshCloudUI();}));
document.getElementById('cloudToggle').onclick=async()=>{
  readCloudInputs();
  if(CLOUD.on){ CLOUD.on=false; saveCloud(); refreshCloudUI(); return; }
  if(!CLOUD.url||!CLOUD.token||!CLOUD.account){ alert(tt('Uzupełnij URL, token i nazwę konta.')); return; }
  CLOUD.on=true; saveCloud(); refreshCloudUI();
  await cloudPull({silent:true}); // przy włączeniu od razu pobierz i scal
  cloudPush();
};
document.getElementById('cloudTestBtn').onclick=()=>{readCloudInputs();cloudTest();};
document.getElementById('cloudSyncBtn').onclick=()=>{readCloudInputs();cloudPull();};
refreshCloudUI();
// przy starcie: jeśli chmura włączona, pobierz najnowsze
if(CLOUD.on && CLOUD.url && CLOUD.account){ cloudPull({silent:true}).then(checkAdmin); }
}

export function __init_20(){

// ---- sync: przyciski ----
document.getElementById('btnExport').onclick=exportJSON;
document.getElementById('btnImport').onclick=()=>document.getElementById('importFile').click();
document.getElementById('importFile').addEventListener('change',e=>{
  const f=e.target.files[0]; if(f) importJSONFile(f); e.target.value='';
});
if(FS_SUPPORTED){
  document.getElementById('btnLinkNew').onclick=linkNewFile;
  document.getElementById('btnLinkOpen').onclick=linkExistingFile;
  document.getElementById('btnUnlink').onclick=unlinkFile;
}
}
