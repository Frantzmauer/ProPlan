// ŻELAZO — Check-in przed treningiem.
// Moduł zawiera tylko deklaracje; kod startowy jest w __init_N, wywoływanych przez main.js w stałej kolejności.
import { __set_viewOffset, viewOffset } from '../core/backup';
import { S, save } from '../core/state';
import { checkinVerdict } from '../lib/checkin';
import { todayISO } from '../lib/dates';
import { touch } from '../lib/state';
import { workoutOn } from '../plan/data';
import { exAny, log, openMove, renderToday } from '../screens/train';
import { WO, hasSession, woBuild, woCurSet, woNext, woRender, woSave, woStart, woStep } from '../screens/workout';
import { CY_PH, CY_SYM, CY_SYM_MENO, cyGet, cyInfo, cyPhaseNote, cySave, cySetSym, cySym, cyTracking, openCycle } from './cycle';

export let CI_Q, CI;

export function ciLight(L){ const c=L && L.checkin; return !!(c && (c.plan==='light' || c.plan==='light2')); }

export function ciVerdict(a, iso, sym){
  const inf=cyInfo(iso||todayISO());
  return checkinVerdict(a, inf, sym||[], inf && inf.sit!=='preg' ? cyPhaseNote(inf.phase) : null);
}

export function ciIcons(c){ return CI_Q.map(q=>c[q.k]!=null?q.o[c[q.k]][0]:'').join(''); }

export function ciChip(L, iso){
  const c=L.checkin; if(!c || c.plan==='skip') return '';
  const what=(c.plan==='light2'?'lżejszy dzień (−10%, seria mniej)':c.plan==='light'?'lżejszy dzień (−10%)':c.plan==='moved'?'trening przesunięty':c.plan==='move'?'lekki ruch zamiast treningu':'wg planu')+(c.restPlus?', przerwy +30 s':'');
  return `<div class="ci-chip">Samopoczucie: <b>${ciIcons(c)}</b> · <span class="${ciLight(L)?'lt':''}">${what}</span>${iso===todayISO()?' <button data-ci-edit>zmień</button>':''}</div>`;
}

// START TRENINGU: przy pierwszym starcie dnia najpierw check-in; WZNÓW / DOKOŃCZ startuje od razu
export function ciStartOrAsk(iso){
  const L=log(iso), w=workoutOn(iso);
  const fresh=!L.checkin && !hasSession(L) && !(WO && WO.iso===iso) && !w.ex.some((e0,i)=>exAny(L.ex[iso+'_e'+i]));
  if(fresh) openCheckin(iso, 'start'); else woStart(iso);
}

export function openCheckin(iso, mode){
  const c=log(iso).checkin||{};
  CI={iso, mode, a:{sleep:c.sleep, sore:c.sore, energy:c.energy}, sym:new Set(cySym(iso))};
  renderCheckin(); document.getElementById('ciSheet').style.display='flex'; document.getElementById('ciPanel').scrollTop=0;
}

export function closeCheckin(){ document.getElementById('ciSheet').style.display='none'; }

export function renderCheckin(){
  const v=ciVerdict(CI.a, CI.iso, [...CI.sym]), hard=CI.a.sore===0, start=CI.mode==='start';
  const inf=cyInfo(CI.iso), symList=inf && inf.sit==='meno' ? CY_SYM_MENO : CY_SYM;
  const ask=!cyGet().on && !cyGet().asked && S.profile && S.profile.sex==='f';
  const go=t=>start?'▶ '+t:t;
  document.getElementById('ciPanel').innerHTML=`<div class="eh-grab"></div>
    <div class="eh-head"><div style="flex:1;min-width:0"><div class="eyebrow">${start?'Zanim zaczniesz · 3 stuknięcia':'Samopoczucie dziś'}</div><h2 id="ciTitle">Jak się dziś czujesz?</h2></div><button class="eh-x" data-ciclose aria-label="Zamknij">✕</button></div>
    ${inf && inf.day && (inf.sit==='natural' || inf.inPeriod) ? `<div class="ci-ctx">${inf.sit==='natural'?'Dzień '+inf.day+' cyklu · ':''}${CY_PH[inf.phase]||'okres'}</div>`:''}
    ${CI_Q.map(q=>`<div class="ci-q"><span class="l">${q.l}</span><div class="ci-seg">${q.o.map(([ic,l],j)=>`<button data-cia="${q.k}:${j}" class="${CI.a[q.k]===j?'on '+(j===0?'lo':j===2?'hi':''):''}" aria-pressed="${CI.a[q.k]===j}"><i>${ic}</i>${l}</button>`).join('')}</div></div>`).join('')}
    ${inf && inf.sit!=='preg' ? `<div class="ci-q"><span class="l">Coś jeszcze? <span style="color:var(--ink-faint);font-weight:500">(opcjonalnie)</span></span><div class="ci-sym">${symList.map(x=>`<button data-cisym="${x}" class="${CI.sym.has(x)?'on':''}" aria-pressed="${CI.sym.has(x)}">${x}</button>`).join('')}</div></div>`:''}
    ${v?`<div class="ci-verdict ${v.c}"><b>${v.t}</b><span>${v.d}</span>${hard?'<small>Mocne zakwasy: dłuższa rozgrzewka (5–8 min) i pierwsza seria lżej.</small>':''}${CI.sym.has('Obfite krwawienie')?'<small>Przy obfitym krwawieniu warto dziś zjeść coś z żelazem: wołowina, soczewica, szpinak z cytrusami.</small>':''}</div>`:''}
    ${!v?`<button class="wo-save" disabled style="opacity:.35">ODPOWIEDZ NA 3 PYTANIA</button>`
      : v.c==='ok'?`<button class="wo-save" data-ciplan="normal">${go('START TRENINGU').replace('START TRENINGU',start?'START TRENINGU':'ZAPISZ')}</button>`
      : `<button class="wo-save" data-ciplan="${v.plan}">${start?'▶ TRENUJ LŻEJ':'LŻEJSZY DZIEŃ'}</button>${v.move?'<button class="ci-alt" data-ciplan="move">Lekki ruch zamiast treningu</button>':''}<button class="ci-alt" data-ciplan="normal">${start?'Trenuj normalnie':'Według planu'}</button>${v.c==='low'&&!v.move?'<button class="ci-alt" data-cimove>Przesuń trening na inny dzień</button>':''}`}
    ${start?'<button class="sw-ask" data-ciplan="skip">Pomiń — od razu start</button>':''}
    ${ask?'<div class="ci-ask">Chcesz, żeby trening uwzględniał cykl? <button data-ciopency>Włącz śledzenie cyklu</button> · <button data-cinoask>Nie, dziękuję</button></div>':''}`;
}

export function ciSave(plan){
  const iso=CI.iso, L=log(iso);
  const v=ciVerdict(CI.a, iso, [...CI.sym]);
  L.checkin=Object.assign(plan==='skip'?{}:{sleep:CI.a.sleep, sore:CI.a.sore, energy:CI.a.energy}, {plan, at:Date.now()});
  if(v && v.rest && (plan==='light'||plan==='light2')) L.checkin.restPlus=30;
  touch(L); save(); closeCheckin();
  if(cyTracking() && plan!=='skip') cySetSym(iso, [...CI.sym]);   // objawy tylko w danych o cyklu (prywatność)
  if(iso===todayISO()) __set_viewOffset(0);   // karta dzisiejszego dnia musi mieć nowe ciężary, zanim tryb treningu je odczyta
  renderToday();
  if(CI.mode==='start' && plan!=='move') woStart(iso);
  else if(WO && WO.iso===iso) woRefreshFromCard();
}

// tryb treningu po zmianie check-inu (albo „Wróć do planu”): niezrobione serie dostają ciężary i liczbę serii z karty
export function woRefreshFromCard(){
  __set_viewOffset(0); renderToday();
  const nb=woBuild(WO.iso);
  WO.ex=WO.ex.map((x,i)=>{ const n=nb[i]; if(!n) return x;
    const ok=n.sets.map((_,j)=>!!x.ok[j]);
    return Object.assign({}, x, {s:n.s, sets:n.sets.map((v,j)=>ok[j] && x.sets[j] ? x.sets[j] : v), ok}); });
  if(woCurSet(WO.cur)<0){ const nx=woNext(WO.cur); if(nx>=0) WO.cur=nx; }
  woSave(); woRender(); woStep();
}

export function woLightBanner(){
  const L=log(WO.iso); if(!ciLight(L)) return '';
  return `<div class="wo-light"><span><b>Lżejszy dzień</b> · ciężar −10%${L.checkin.plan==='light2'?', seria mniej':''}</span><button id="woLightOff">Wróć do planu</button></div>`;
}

export function __init_26(){

/* ---- check-in przed treningiem: sen, zakwasy, energia → lżejszy dzień ----
   L.checkin = {sleep, sore, energy: 0 słabo … 2 dobrze, plan:'normal'|'light'|'light2'|'skip', at}
   light: ciężar −10% (zaokrąglenie jak w planie), light2: do tego jedna seria mniej (effEx). Synchronizowane (nowsze at). */
CI_Q = [
  {k:'sleep', l:'Jak spałeś?', o:[['😴','Słabo'],['🙂','OK'],['😌','Dobrze']]},
  {k:'sore', l:'Zakwasy, ból mięśni?', o:[['🔥','Mocne'],['〰️','Lekkie'],['✅','Brak']]},
  {k:'energy', l:'Energia teraz?', o:[['🪫','Niska'],['⚡','OK'],['🚀','Wysoka']]}
];
CI = null;
document.getElementById('ciSheet').addEventListener('click', ev=>{
  const t=ev.target.closest('[data-ciclose],[data-cia],[data-cisym],[data-ciplan],[data-cimove],[data-ciopency],[data-cinoask]'); if(!t) return;
  const d=t.dataset;
  if('ciclose' in d) closeCheckin();
  else if(d.cia){ const [k,v]=d.cia.split(':'); CI.a[k]=+v; renderCheckin(); }
  else if(d.cisym){ CI.sym.has(d.cisym)?CI.sym.delete(d.cisym):CI.sym.add(d.cisym); renderCheckin(); }
  else if('ciopency' in d){ closeCheckin(); openCycle(); }
  else if('cinoask' in d){ const c=Object.assign({}, cyGet(), {asked:true}); cySave(c); renderCheckin(); }
  else if(d.ciplan) ciSave(d.ciplan);
  else { const iso=CI.iso, L=log(iso); L.checkin={sleep:CI.a.sleep, sore:CI.a.sore, energy:CI.a.energy, plan:'moved', at:Date.now()}; touch(L); save(); closeCheckin(); openMove(iso); }
});
}
