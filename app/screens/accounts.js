// ŻELAZO — Konta: link zaproszenia, dołączenie, pierwszy start (profil).
// Moduł zawiera tylko deklaracje; kod startowy jest w __init_N, wywoływanych przez main.js w stałej kolejności.
import { fileHandle, unlinkFile } from '../core/backup.js';
import { CLOUD, LS, S, SYNC, __set_CLOUD, __set_S, cloudPull, cloudPush, deviceHasData, load, refreshAllViews, save, saveCloud } from '../core/state.js';
import { parseISO, todayISO } from '../lib/dates';
import { applyName, kcalSlider, loadProfileUI, updateKcalHint } from './more.js';
import { renderWeight } from './progress.js';
import { cloudAccount, cloudToken, cloudUrl, refreshCloudUI } from './sync-ui.js';
import { renderToday } from './train.js';

export let esc, isScriptUrl, INVITE;

export function slugAccount(s){
  return (s||'').toLowerCase().replace(/ł/g,'l').normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,24);
}

export function inviteLink(code, account){
  // zaproszenie zawsze do wersji stabilnej, także gdy wysłane z bety
  return location.origin+location.pathname.replace(/(beta|zeta)\/(index\.html)?$/,'')+'#invite='+encodeURIComponent(code)+'&s='+encodeURIComponent(CLOUD.url)+(account?'&n='+encodeURIComponent(account):'');
}

export function closeJoin(){ document.getElementById('joinDialog').classList.remove('show'); history.replaceState(null,'',location.pathname); }

// ---- pierwszy start nowego konta: profil jest obowiązkowy (nie da się go pominąć) ----
export function obValues(){
  const g=id=>document.getElementById(id);
  return {name:g('obName').value.trim(), sex:g('obSex').value, age:parseInt(g('obAge').value),
    height:parseFloat(g('obHeight').value), weight:parseFloat(String(g('obWeight').value).replace(',','.')),
    activity:parseFloat(g('obAct').value)||1.465, goal:parseInt(g('obGoal').value)||0};
}

export function obValid(v){ return v.age>=14&&v.age<=95 && v.height>=120&&v.height<=230 && v.weight>=35&&v.weight<=300; }

export function obCalc(){
  const v=obValues(), el=document.getElementById('obCalc');
  if(!obValid(v)){ el.textContent='Uzupełnij wiek, wzrost i wagę, a policzymy kalorie.'; return null; }
  const maint=Math.round((10*v.weight+6.25*v.height-5*v.age+(v.sex==='f'?-161:5))*v.activity);
  const goal=Math.min(3200,Math.max(1500,Math.round((maint+v.goal)/100)*100));
  el.innerHTML=`Utrzymanie ok. <b>${maint} kcal</b> · Twój cel: <b style="color:var(--amber)">${goal} kcal/dzień</b> (zmienisz w Więcej → Cel kalorii).`;
  return {v,goal};
}

export function openProfileSetup(){
  ['obName','obSex','obAge','obHeight','obWeight','obAct','obGoal'].forEach(id=>{
    const el=document.getElementById(id); el.oninput=obCalc; el.onchange=obCalc;
  });
  obCalc();
  document.getElementById('profileDialog').classList.add('show');
  setTimeout(()=>document.getElementById('obName').focus(),50);
}

export function __init_16(){

/* ============================================================
   KONTA: link zaproszenia (#invite=KOD&s=URL_SKRYPTU&n=konto) + panel administratora
   ============================================================ */
esc = s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// link może wskazywać tylko na Google Apps Script — obca strona nie przejmie danych
isScriptUrl = u=>/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u||'');
INVITE = (()=>{
  const h=new URLSearchParams(location.hash.slice(1));
  const code=h.get('invite'), url=h.get('s');
  return code ? {code, url, account:h.get('n')||''} : null;
})();
// link otwarty w już działającej karcie zmienia tylko #… — przeładuj, żeby go obsłużyć
window.addEventListener('hashchange',()=>{ if(/(^|[#&])invite=/.test(location.hash)) location.reload(); });
if(INVITE){
  const inp=document.getElementById('joinName'), msg=document.getElementById('joinMsg');
  inp.value=INVITE.account; inp.readOnly=!!INVITE.account;
  if(!isScriptUrl(INVITE.url)){ msg.style.display='block'; msg.style.color='var(--red)'; msg.textContent='Ten link jest uszkodzony albo nie pochodzi z ŻELAZO. Poproś o nowy.'; document.getElementById('joinOk').disabled=true; }
  document.getElementById('joinDialog').classList.add('show');
  document.getElementById('joinCancel').onclick=closeJoin;
  inp.addEventListener('blur',()=>{ if(!inp.readOnly) inp.value=slugAccount(inp.value); });
  // cudze dane na urządzeniu: wybór w okienku (domyślnie od zera), zanim zużyjemy zaproszenie
  let joinChoice=null;
  const choiceBox=document.getElementById('joinChoice'), moveBtn=document.getElementById('joinMove');
  document.getElementById('joinFresh').onclick=()=>{ joinChoice='fresh'; document.getElementById('joinOk').click(); };
  moveBtn.onclick=()=>{
    if(!moveBtn.dataset.armed){ moveBtn.dataset.armed='1'; moveBtn.textContent='Na pewno? Dane z tego urządzenia trafią na konto „'+slugAccount(inp.value)+'”'; return; }
    joinChoice='move'; document.getElementById('joinOk').click();
  };
  document.getElementById('joinOk').onclick=async()=>{
    const account=slugAccount(inp.value);
    if(account.length<2){ inp.focus(); return; }
    const sameAccount=(CLOUD.account||'').toLowerCase()===account;
    if(!sameAccount && deviceHasData() && !joinChoice){
      document.getElementById('joinWho').textContent=(S.profile&&S.profile.name)?' ('+S.profile.name+')':(CLOUD.account?' (konto „'+CLOUD.account+'”)':'');
      choiceBox.style.display='flex'; document.getElementById('joinOk').style.display='none'; inp.readOnly=true;
      return;
    }
    const btn=document.getElementById('joinOk'); btn.disabled=true; btn.textContent='⏳ Łączę…';
    [document.getElementById('joinFresh'), moveBtn].forEach(b=>b.disabled=true);
    msg.style.display='none';
    try{
      const res=await fetch(INVITE.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'redeem',code:INVITE.code,account})});
      const j=JSON.parse(await res.text());
      if(!j.ok) throw new Error(j.error||'Błąd serwera');
      const same=(CLOUD.account||'').toLowerCase()===j.account;
      SYNC.cancel();   // nic nie może już trafić na poprzednie konto
      // nowa osoba: wszystko z poprzedniego konta znika z urządzenia (chyba że świadomie przenosi swoje dane)
      if(!same && joinChoice!=='move'){ localStorage.removeItem(LS); __set_S(load()); if(fileHandle) unlinkFile(); }
      // nowe konto: żadnych cudzych domyślnych danych — profil wypełnia sam zaproszony
      if(!same){ S.profile={name:'',weight:0,height:0,age:0,sex:'m',activity:1.465,needsSetup:true}; S._settingsM=Date.now(); localStorage.setItem(LS,JSON.stringify(S)); }
      __set_CLOUD({url:INVITE.url, token:j.token, account:j.account, on:true, lastSync:0, lastError:''});
      saveCloud();
      cloudUrl.value=CLOUD.url; cloudToken.value=CLOUD.token; cloudAccount.value=CLOUD.account;
      closeJoin();
      await cloudPull({silent:true}); cloudPush();
      refreshAllViews(); refreshCloudUI(); loadProfileUI();
      if(same) alert('✅ Połączono ponownie. Twoje dane są bezpieczne.');
      else openProfileSetup();
    }catch(e){
      msg.style.display='block'; msg.style.color='var(--red)'; msg.textContent='Nie udało się dołączyć: '+e.message;
    }
    btn.disabled=false; btn.textContent='Dołącz';
    [document.getElementById('joinFresh'), moveBtn].forEach(b=>b.disabled=false);
  };
}
document.getElementById('obSave').onclick=()=>{
  const r=obCalc();
  if(!r){ const v=obValues(); document.getElementById(!(v.age>=14&&v.age<=95)?'obAge':!(v.height>=120&&v.height<=230)?'obHeight':'obWeight').focus(); return; }
  const {v,goal}=r;
  S.profile={name:v.name, weight:v.weight, height:v.height, age:v.age, sex:v.sex, activity:v.activity};
  S.kcalGoal=goal;
  const today=todayISO();
  S.weights=(S.weights||[]).filter(w=>w.d!==today); S.weights.push({d:today,w:v.weight});
  S._settingsM=Date.now();
  save();
  document.getElementById('profileDialog').classList.remove('show');
  loadProfileUI(); applyName(); kcalSlider.value=goal; updateKcalHint();
  renderToday(); renderWeight();
  alert('✅ Gotowe'+(v.name?', '+v.name:'')+'! Twój plan startuje '+parseISO(S.startDate).toLocaleDateString('pl-PL')+'.\n\nNa drugim urządzeniu: Więcej → Synchronizacja → wpisz to samo konto i token (znajdziesz je tutaj, w tej samej sekcji).');
};
// profil niedokończony (np. zamknięta karta w trakcie) — wróć do niego przy następnym starcie
if(S.profile && S.profile.needsSetup && !INVITE) openProfileSetup();
}
