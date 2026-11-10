// ŻELAZO — Więcej: menu ustawień, profil, posiłek, kalorie.
// Moduł zawiera tylko deklaracje; kod startowy jest w __init_N, wywoływanych przez main.js w stałej kolejności.
import { __set_viewOffset, viewDateISO, viewOffset } from '../core/backup';
import { APP_VER } from '../core/shell';
import { CLOUD, S, appChannel, save } from '../core/state';
import { CYC, CY_SIT, __set_CYC, cyGet, cyRenderBox, cyTracking, openCycle } from '../features/cycle';
import { exLibrary, renderExLib } from '../features/formcheck';
import { quotaCur, quotaLeft, quotaLoad, renderPlanQuota } from '../features/plan-limits';
import { openRestList } from '../features/rest';
import { parseISO, todayISO } from '../lib/dates';
import { DEFAULT_KCAL, macroGoalFor } from '../plan/data';
import { apLoad, loadUsage } from './admin';
import { loadCoach } from './coach';
import { renderPlan } from './plan-view';
import { kcalRecord, renderWeight } from './progress';
import { renderShop } from './shop';
import { updateStreak } from './streak';
import { renderToday } from './train';
import { bodyRefresh } from '../features/body3d';
import { dec, isEn, plural, t } from '../lib/i18n';
import { legalUrl, renderConsentStatus } from '../features/consent';

export let MORE_TITLES, sd, kcalSlider, pf;

export function moreOpen(sec, fromHistory?){
  const v=document.getElementById('v-set'); v.dataset.sec=sec||'';
  const ti=MORE_TITLES[sec];
  document.getElementById('moreBack').style.display=ti?'inline-flex':'none';
  document.getElementById('moreTitle').textContent=ti?ti[0]:t('Ustawienia');
  document.getElementById('moreEyebrow').textContent=ti?ti[1]:t('Konfiguracja');
  if(sec==='cw') renderExLib();
  if(sec==='plan'){ renderPlanQuota(); quotaLoad(); }
  if(sec==='adm') apLoad();
  if(sec==='legal') renderConsentStatus();
  if(!sec) moreStatus();
  // jeden wpis w historii na podsekcję: „wstecz” zawsze wraca do menu
  try{ if(sec && !fromHistory){ if(history.state&&history.state.more) history.replaceState({more:sec},''); else history.pushState({more:sec},''); }
       else if(!sec && !fromHistory && history.state&&history.state.more) history.replaceState(null,''); }catch(e){}
  window.scrollTo(0,0);
}

export function moreStatus(){
  const set=(id,t,warn?)=>{ const e=document.getElementById(id); if(e){ e.textContent=t; e.classList.toggle('warn',!!warn); } };
  const p=S.profile||{}, st=parseISO(S.startDate);
  set('mmProf', `${p.name||t('bez imienia')} · ${S.kcalGoal||DEFAULT_KCAL} kcal · ${t('start')} ${st.getDate()}.${String(st.getMonth()+1).padStart(2,'0')}`);
  set('mmSync', !CLOUD.on ? t('Wyłączona') : CLOUD.lastError ? t('⚠ Ostatnia synchronizacja nieudana') : t('Włączona · konto {a}', {a:CLOUD.account||'—'}), CLOUD.on&&CLOUD.lastError);
  set('mmRem', S.reminders&&S.reminders.on ? t('Włączone · trening {h}', {h:S.reminders.workout}) : t('Wyłączone'));
  set('mmVer', ({stable:t('Stabilna · v1.6'), early:'Early Access', users:'USERS'})[APP_VER] || 'Beta');
  { const q=quotaCur(); set('mmPlan', q ? t('Zostało {a} z {am} pytań · {b} z {bm} nagrań · {c} z {cm} szacowań', {a:quotaLeft('coach'), am:q.coach.max, b:quotaLeft('form'), bm:q.form.max, c:quotaLeft('est'), cm:q.est.max}) : t('Limity Trenera AI'), q&&quotaLeft('coach')===0); }
  { const c=cyGet(), on=cyTracking(), btn=document.getElementById('mmCycleBtn');
    if(btn) btn.style.display=(on || c.on || (S.profile&&S.profile.sex==='f')) ? '' : 'none';   // proponowane przy profilu kobiety albo gdy już włączone
    set('mmCycle', on ? t((CY_SIT.find(x=>x[0]===c.sit)||['',''])[1])+(c.sync?t(' · synchronizowane'):t(' · tylko na tym telefonie')) : t('Wyłączone · dobrowolne')); }
  { const r=Object.values((S.adj&&S.adj.rest)||{}); set('mmRest', r.length ? t('Zmienione: {n}', {n:r.length})+(r.some(x=>x.by==='tr')?t(' (także od Trenera)'):'') : t('Z planu · zmień przy ćwiczeniu')); }
  const n=exLibrary().reduce((a,g)=>a+g.ex.length,0), last=loadCoach().filter(m=>m.kind==='form').pop();
  set('mmCw', plural(n,'{n} ćwiczenie','{n} ćwiczenia','{n} ćwiczeń','{n} exercise','{n} exercises')+(last?t(' · ostatnio: ')+(last.ex||'')+' — '+(last.grade||''):t(' · nagraj serię i dostań ocenę')));
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
  document.getElementById('kcalVal').textContent=String(k);
  const maint=estMaintenance();
  const deficit=maint-k;
  const perWeek=(deficit*7/7700); // 7700 kcal ≈ 1 kg tłuszczu
  let msg;
  if(deficit<=0) msg=t('To poziom utrzymania lub nadwyżka — waga nie spadnie. Zejdź poniżej ~{m} kcal, by chudnąć.', {m:maint});
  else msg=t('Deficyt ~{d} kcal/dzień → ok. <b>{kg} kg tłuszczu tygodniowo</b>.', {d:deficit, kg:dec(perWeek,2)})+' '+(deficit>700?t('Szybko — pilnuj białka i regeneracji.'):deficit>400?t('Solidne, realne tempo.'):t('Łagodnie i komfortowo.'));
  document.getElementById('kcalHint').innerHTML=msg;
  const g=macroGoalFor(k);
  document.getElementById('macroHint').textContent=t('Cele makro: białko {p} g · węgle {c} g · tłuszcz {f} g', {p:g.p, c:g.c, f:g.f});
}

export function loadProfileUI(){
  const p=S.profile;
  document.getElementById('pfName').value=p.name||'';
  document.getElementById('pfWeight').value=p.weight;
  document.getElementById('pfHeight').value=p.height;
  document.getElementById('pfAge').value=p.age;
  document.getElementById('pfSex').value=p.sex||'m';
  document.getElementById('pfLang').value=p.lang==='en'?'en':'pl';
  document.getElementById('pfAct').value=String(p.activity||1.465);
  updateTdee();
}

export function updateTdee(){
  document.getElementById('pfTdee').textContent=String(estMaintenance());
}

// zapis pojedynczego pola profilu — nie rusza pozostałych, nie wywołuje wrażenia zmiany kalorii
export function saveProfileField(key){
  if(key==='name'){ S.profile.name=document.getElementById('pfName').value.trim(); S._settingsM=Date.now(); save(); applyName(); return; }
  if(key==='lang'){ S.profile.lang=document.getElementById('pfLang').value==='en'?'en':'pl'; S.profile.langAt=Date.now(); S._settingsM=Date.now(); save(); setTimeout(()=>location.reload(), 400); return; }   // cała aplikacja w nowym języku
  if(key==='weight') S.profile.weight=parseFloat(document.getElementById('pfWeight').value)||S.profile.weight;
  if(key==='height') S.profile.height=parseFloat(document.getElementById('pfHeight').value)||S.profile.height;
  if(key==='age')    S.profile.age=parseInt(document.getElementById('pfAge').value)||S.profile.age;
  if(key==='sex')    S.profile.sex=document.getElementById('pfSex').value;
  if(key==='activity')S.profile.activity=parseFloat(document.getElementById('pfAct').value)||1.465;
  S._settingsM=Date.now();
  save();
  updateTdee(); updateKcalHint(); // tylko pola liczbowe odświeżają zapotrzebowanie
  if(key==='height'||key==='sex') bodyRefresh();   // sylwetka 3D: wzrost i płeć z profilu
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
MORE_TITLES = {cw:[t('Ćwiczenia'),t('Nauka techniki')],prof:[t('Profil i plan'),t('Profil · kalorie · start')],sync:[t('Synchronizacja'),t('Chmura · zużycie AI · konta')],
  rem:[t('Przypomnienia'),t('Powiadomienia')],data:[t('Kopia i dane'),t('Eksport · import · plik')],ver:[t('Wersja aplikacji'),t('Stabilna, beta albo poprzednia')],
  plan:[t('Pakiet i limity'),t('Twój plan · Trener AI')], adm:[t('Konta i plany'),t('Administrator · USERS')],
  legal:[t('Regulamin i prywatność'),t('Dokumenty')]};
// dokumenty prawne w języku aplikacji (legal/ obok wersji stabilnej; w becie, Early Access i USERS piętro wyżej)
document.getElementById('lgTerms').setAttribute('href', legalUrl('terms'));
document.getElementById('lgPrivacy').setAttribute('href', legalUrl('privacy'));
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
pf = {name:'pfName',lang:'pfLang',weight:'pfWeight',height:'pfHeight',age:'pfAge',sex:'pfSex',activity:'pfAct'};
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
      document.getElementById('pfTdee').textContent=String(Math.round(bmr*(parseFloat(document.getElementById('pfAct').value)||1.465)));
    });
  }
});
loadProfileUI();
applyName();
}
