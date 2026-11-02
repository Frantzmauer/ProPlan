// ŻELAZO — Więcej: menu ustawień, profil, posiłek, kalorie.
// Moduł zawiera tylko deklaracje; kod startowy jest w __init_N, wywoływanych przez main.js w stałej kolejności.
import { __set_viewOffset, viewDateISO, viewOffset } from '../core/backup.js';
import { APP_VER } from '../core/shell.js';
import { CLOUD, S, save } from '../core/state.js';
import { CYC, CY_SIT, __set_CYC, cyGet, cyRenderBox, cyTracking, openCycle } from '../features/cycle.js';
import { exLibrary, renderExLib } from '../features/formcheck.js';
import { quotaCur, quotaLeft, quotaLoad, renderPlanQuota } from '../features/plan-limits.js';
import { openRestList } from '../features/rest.js';
import { parseISO, todayISO } from '../lib/dates';
import { DEFAULT_KCAL, macroGoalFor } from '../plan/data.js';
import { apLoad, loadUsage } from './admin.js';
import { loadCoach } from './coach.js';
import { renderPlan } from './plan-view.js';
import { kcalRecord, renderWeight } from './progress.js';
import { renderShop } from './shop.js';
import { updateStreak } from './streak.js';
import { renderToday } from './train.js';

export let MORE_TITLES, sd, kcalSlider, pf;

export function moreOpen(sec, fromHistory){
  const v=document.getElementById('v-set'); v.dataset.sec=sec||'';
  const t=MORE_TITLES[sec];
  document.getElementById('moreBack').style.display=t?'inline-flex':'none';
  document.getElementById('moreTitle').textContent=t?t[0]:'Ustawienia';
  document.getElementById('moreEyebrow').textContent=t?t[1]:'Konfiguracja';
  if(sec==='cw') renderExLib();
  if(sec==='plan'){ renderPlanQuota(); quotaLoad(); }
  if(sec==='adm') apLoad();
  if(!sec) moreStatus();
  // jeden wpis w historii na podsekcję: „wstecz” zawsze wraca do menu
  try{ if(sec && !fromHistory){ if(history.state&&history.state.more) history.replaceState({more:sec},''); else history.pushState({more:sec},''); }
       else if(!sec && !fromHistory && history.state&&history.state.more) history.replaceState(null,''); }catch(e){}
  window.scrollTo(0,0);
}

export function moreStatus(){
  const set=(id,t,warn)=>{ const e=document.getElementById(id); if(e){ e.textContent=t; e.classList.toggle('warn',!!warn); } };
  const p=S.profile||{}, st=parseISO(S.startDate);
  set('mmProf', `${p.name||'bez imienia'} · ${S.kcalGoal||DEFAULT_KCAL} kcal · start ${st.getDate()}.${String(st.getMonth()+1).padStart(2,'0')}`);
  set('mmSync', !CLOUD.on ? 'Wyłączona' : CLOUD.lastError ? '⚠ Ostatnia synchronizacja nieudana' : 'Włączona · konto '+(CLOUD.account||'—'), CLOUD.on&&CLOUD.lastError);
  set('mmRem', S.reminders&&S.reminders.on ? 'Włączone · trening '+S.reminders.workout : 'Wyłączone');
  set('mmVer', ({stable:'Stabilna · v1.2', early:'Early Access', users:'USERS'})[APP_VER] || 'Beta');
  { const q=quotaCur(); set('mmPlan', q ? `Zostało ${quotaLeft('coach')} z ${q.coach.max} pytań · ${quotaLeft('form')} z ${q.form.max} nagrań · ${quotaLeft('est')} z ${q.est.max} szacowań` : 'Limity Trenera AI', q&&quotaLeft('coach')===0); }
  { const c=cyGet(), on=cyTracking(), btn=document.getElementById('mmCycleBtn');
    if(btn) btn.style.display=(on || c.on || (S.profile&&S.profile.sex==='f')) ? '' : 'none';   // proponowane przy profilu kobiety albo gdy już włączone
    set('mmCycle', on ? (CY_SIT.find(x=>x[0]===c.sit)||['',''])[1]+(c.sync?' · synchronizowane':' · tylko na tym telefonie') : 'Wyłączone · dobrowolne'); }
  { const r=Object.values((S.adj&&S.adj.rest)||{}); set('mmRest', r.length ? 'Zmienione: '+r.length+(r.some(x=>x.by==='tr')?' (także od Trenera)':'') : 'Z planu · zmień przy ćwiczeniu'); }
  const n=exLibrary().reduce((a,g)=>a+g.ex.length,0), last=loadCoach().filter(m=>m.kind==='form').pop();
  const pl=n===1?'ćwiczenie':(n%10>=2&&n%10<=4&&(n%100<12||n%100>14))?'ćwiczenia':'ćwiczeń';
  set('mmCw', n+' '+pl+(last?' · ostatnio: '+(last.ex||'')+' — '+(last.grade||''):' · nagraj serię i dostań ocenę'));
}

export function showView(v){
  document.querySelectorAll('.nav button').forEach(x=>x.classList.toggle('on', x.dataset.v===v));
  document.querySelectorAll('.view').forEach(x=>x.classList.toggle('on', x.id==='v-'+v));
  document.body.classList.toggle('daily', v==='train'||v==='diet');
  window.scrollTo(0,0);
  if(v==='progress'){ renderWeight(); renderPlan(); }
  if(v==='train'){ __set_CYC(null); cyRenderBox(viewDateISO()); }   // dane o cyklu mogły się zmienić w Więcej
  if(v==='set'){ loadUsage(); moreOpen(''); }   // „Więcej” zawsze startuje od menu; świeże zużycie AI
  if(v==='shop')renderShop();
}

// szacowane utrzymanie z profilu (Mifflin-St Jeor × aktywność)
export function estMaintenance(){
  const p=S.profile||{weight:104,height:186,age:45,sex:'m',activity:1.465};
  const s = (p.sex==='f') ? -161 : 5;
  const bmr = 10*p.weight + 6.25*p.height - 5*p.age + s;
  return Math.round(bmr*(p.activity||1.465));
}

export function updateKcalHint(){
  const k=+kcalSlider.value;
  document.getElementById('kcalVal').textContent=k;
  const maint=estMaintenance();
  const deficit=maint-k;
  const perWeek=(deficit*7/7700); // 7700 kcal ≈ 1 kg tłuszczu
  let msg;
  if(deficit<=0) msg=`To poziom utrzymania lub nadwyżka — waga nie spadnie. Zejdź poniżej ~${maint} kcal, by chudnąć.`;
  else msg=`Deficyt ~${deficit} kcal/dzień → ok. <b>${perWeek.toFixed(2).replace('.',',')} kg tłuszczu tygodniowo</b>. ${deficit>700?'Szybko — pilnuj białka i regeneracji.':deficit>400?'Solidne, realne tempo.':'Łagodnie i komfortowo.'}`;
  document.getElementById('kcalHint').innerHTML=msg;
  const g=macroGoalFor(k);
  document.getElementById('macroHint').textContent=`Cele makro: białko ${g.p} g · węgle ${g.c} g · tłuszcz ${g.f} g`;
}

export function loadProfileUI(){
  const p=S.profile;
  document.getElementById('pfName').value=p.name||'';
  document.getElementById('pfWeight').value=p.weight;
  document.getElementById('pfHeight').value=p.height;
  document.getElementById('pfAge').value=p.age;
  document.getElementById('pfSex').value=p.sex||'m';
  document.getElementById('pfAct').value=String(p.activity||1.465);
  updateTdee();
}

export function updateTdee(){
  document.getElementById('pfTdee').textContent=estMaintenance();
}

// zapis pojedynczego pola profilu — nie rusza pozostałych, nie wywołuje wrażenia zmiany kalorii
export function saveProfileField(key){
  if(key==='name'){ S.profile.name=document.getElementById('pfName').value.trim(); S._settingsM=Date.now(); save(); applyName(); return; }
  if(key==='weight') S.profile.weight=parseFloat(document.getElementById('pfWeight').value)||S.profile.weight;
  if(key==='height') S.profile.height=parseFloat(document.getElementById('pfHeight').value)||S.profile.height;
  if(key==='age')    S.profile.age=parseInt(document.getElementById('pfAge').value)||S.profile.age;
  if(key==='sex')    S.profile.sex=document.getElementById('pfSex').value;
  if(key==='activity')S.profile.activity=parseFloat(document.getElementById('pfAct').value)||1.465;
  S._settingsM=Date.now();
  save();
  updateTdee(); updateKcalHint(); // tylko pola liczbowe odświeżają zapotrzebowanie
}

export function applyName(){
  const nm=(S.profile&&S.profile.name)?S.profile.name.trim():'';
  let tag=document.getElementById('brandName');
  if(nm){
    if(!tag){tag=document.createElement('span');tag.id='brandName';tag.style.cssText='font-size:13px;color:var(--ink-dim);margin-left:8px;align-self:center';document.querySelector('.brand').appendChild(tag);}
    tag.textContent=nm;
  } else if(tag){ tag.remove(); }
}

export function __init_13(){

/* ============================================================
   NAV + INIT
   ============================================================ */
// Trening i Dieta pokazują ten sam dzień; pasek dnia i przełącznik tylko w nich
/* ---- menu Więcej: podsekcja zamiast długiego przewijania; „wstecz” w telefonie wraca do menu ---- */
MORE_TITLES = {cw:['Ćwiczenia','Nauka techniki'],prof:['Profil i plan','Profil · kalorie · start'],sync:['Synchronizacja','Chmura · zużycie AI · konta'],
  rem:['Przypomnienia','Powiadomienia'],data:['Kopia i dane','Eksport · import · plik'],ver:['Wersja aplikacji','Stabilna, beta albo poprzednia'],
  plan:['Pakiet i limity','Twój plan · Trener AI'], adm:['Konta i plany','Administrator · USERS']};
document.getElementById('moreBack').onclick=()=>{ if(history.state&&history.state.more) history.back(); else moreOpen(''); };
document.querySelectorAll('[data-more]').forEach(b=>b.onclick=()=>moreOpen(b.dataset.more));
document.querySelectorAll('#moreMenu [data-rest-list]').forEach(b=>b.onclick=()=>openRestList(todayISO()));
document.querySelectorAll('#moreMenu [data-cycle]').forEach(b=>b.onclick=()=>openCycle());
window.addEventListener('popstate',()=>{ const v=document.getElementById('v-set'); if(v.dataset.sec) moreOpen('', true); });
document.querySelectorAll('.nav button').forEach(b=>{ b.onclick=()=>showView(b.dataset.v); });
document.getElementById('prevDay').onclick=()=>{__set_viewOffset(viewOffset - 1);renderToday()};
document.getElementById('nextDay').onclick=()=>{__set_viewOffset(viewOffset + 1);renderToday()};
document.getElementById('dayMid').onclick=()=>{ if(viewOffset!==0){ __set_viewOffset(0); renderToday(); } };
// przesunięcie palcem w bok na treści = poprzedni / następny dzień
(()=>{
  let sx=null, sy=null;
  const on=()=>document.body.classList.contains('daily');
  document.addEventListener('touchstart',e=>{
    // nie przechwytuj przesunięć w polach, oknach dialogowych i na pasku zakładek
    if(!on() || e.target.closest('input,textarea,.nav,.dayswitch,#mealDialog,#coachDialog,#guideDialog,#profileDialog,#joinDialog')){ sx=null; return; }
    const t=e.touches[0]; sx=t.clientX; sy=t.clientY;
  },{passive:true});
  document.addEventListener('touchend',e=>{
    if(sx===null || !on()) return;
    const t=e.changedTouches[0], dx=t.clientX-sx, dy=t.clientY-sy; sx=null;
    if(Math.abs(dx)>70 && Math.abs(dy)<45){ __set_viewOffset(viewOffset + (dx<0?1:-1)); renderToday(); }
  },{passive:true});
})();

// weight save
document.getElementById('weightSave').onclick=()=>{
  const v=parseFloat(document.getElementById('weightInput').value);
  if(!v||v<30||v>300){document.getElementById('weightInput').focus();return}
  const iso=todayISO();
  const ex=S.weights.find(x=>x.d===iso);
  if(ex)ex.w=v; else S.weights.push({d:iso,w:v});
  save();document.getElementById('weightInput').value='';renderWeight();updateStreak();
};
document.getElementById('weightInput').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('weightSave').click()});

// shop reset
document.getElementById('shopReset').onclick=()=>{const now=Date.now();if(!S.shopT)S.shopT={};Object.keys(S.shop||{}).forEach(k=>{if(S.shop[k]){S.shop[k]=false;S.shopT[k]=now;}});save();renderShop()};

// settings: start date
sd = document.getElementById('startDate');
sd.value=S.startDate;
sd.onchange=()=>{S.startDate=sd.value;S._settingsM=Date.now();save();renderToday()};

// settings: cel kaloryczny (suwak)
kcalSlider = document.getElementById('kcalSlider');
kcalSlider.value=S.kcalGoal||DEFAULT_KCAL;
updateKcalHint();
kcalSlider.addEventListener('input',updateKcalHint);
kcalSlider.addEventListener('change',()=>{const prev=S.kcalGoal||DEFAULT_KCAL;S.kcalGoal=+kcalSlider.value;kcalRecord(S.kcalGoal,prev);S._settingsM=Date.now();save();renderToday();if(document.getElementById('v-progress').classList.contains('on'))renderWeight()});

// settings: profil
pf = {name:'pfName',weight:'pfWeight',height:'pfHeight',age:'pfAge',sex:'pfSex',activity:'pfAct'};
Object.keys(pf).forEach(key=>{
  const el=document.getElementById(pf[key]);
  el.addEventListener('change',()=>saveProfileField(key));
  // podgląd TDEE na żywo tylko dla pól liczbowych i tylko lokalnie (bez zapisu)
  if(key==='weight'||key==='height'||key==='age'){
    el.addEventListener('input',()=>{
      const w=parseFloat(document.getElementById('pfWeight').value)||S.profile.weight;
      const h=parseFloat(document.getElementById('pfHeight').value)||S.profile.height;
      const a=parseInt(document.getElementById('pfAge').value)||S.profile.age;
      const s=(document.getElementById('pfSex').value==='f')?-161:5;
      const bmr=10*w+6.25*h-5*a+s;
      document.getElementById('pfTdee').textContent=Math.round(bmr*(parseFloat(document.getElementById('pfAct').value)||1.465));
    });
  }
});
loadProfileUI();
applyName();
}
