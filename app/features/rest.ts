// ŻELAZO — Przerwy między seriami: z planu, Twoje albo od Trenera.
// Moduł zawiera tylko deklaracje; kod startowy jest w __init_N, wywoływanych przez main.js w stałej kolejności.
import { S, save } from '../core/state';
import { todayISO } from '../lib/dates';
import { workoutOn } from '../plan/data';
import { esc } from '../screens/accounts';
import { exIndex } from '../screens/history';
import { moreStatus } from '../screens/more';
import { effEx, renderToday, timedSpec } from '../screens/train';
import { WO, fmtDur, hasSession, restSecs, woRender, woSave, woStep } from '../screens/workout';
import { ciRestPlus } from './cycle';
import { locale, plural, t } from '../lib/i18n';

export let RS, rsToastT;

/* ---- przerwy między seriami: z planu, Twoje albo od Trenera (ostatnia decyzja wygrywa) ----
   S.adj.rest = { nazwa ćwiczenia: {sec, by:'me'|'tr', id} } — synchronizowane razem z S.adj (po _settingsM). */
export function restOverride(name){ return (S.adj && S.adj.rest && S.adj.rest[(name||'').trim()]) || null; }

export function restFor(e, ts){ const o=restOverride(e.n); return o ? o.sec : restSecs(e, ts); }

export function restPlanOf(name, timed){ return restSecs({n:name}, timed?{}:null); }

export function restCurrent(name, timed?){ const o=restOverride(name); return o ? o.sec : restPlanOf(name, timed); }

export function restTag(name){ const o=restOverride(name); return o ? `<span class="rs-tag ${o.by}">${o.by==='tr'?'TRENER':'TWOJA'}</span>` : ''; }

// faktyczne przerwy z trybu treningu: średnia z 3 ostatnich treningów z tym ćwiczeniem (bez przejść między ćwiczeniami)
export function restStats(name){
  const n=(name||'').trim(), today=todayISO(), vals=[]; let sessions=0;
  const keys=Object.keys(S.log).filter(k=>k<=today && hasSession(S.log[k])).sort().reverse();
  for(const k of keys){
    const s=S.log[k].session; let got=[];
    if(s.log) got=s.log.filter(l=>(l.ex||'').trim()===n && l.restBefore!=null).map(l=>l.restBefore);
    else { const e=(s.ex||[]).find(x=>(x.n||'').trim()===n); if(e && e.avgRest) got=[e.avgRest]; }
    if(got.length){ vals.push(...got); if(++sessions>=3) break; }
  }
  return vals.length ? {avg:Math.round(vals.reduce((a,b)=>a+b,0)/vals.length), sessions} : null;
}

export function restSet(name, sec, by){
  const n=(name||'').trim(); S.adj=S.adj||{}; S.adj.rest=S.adj.rest||{};
  if(by==='me' && sec===restPlanOf(n, (exIndex()[n]||{}).timed)) delete S.adj.rest[n]; else S.adj.rest[n]={sec, by, id:Date.now()};
  S._settingsM=Date.now(); save(); restApplyLive(n);
  if(document.getElementById('v-train') && document.getElementById('v-train').classList.contains('on')) renderToday();
}

// trwający trening: nowa przerwa od razu (także w odliczanej przerwie po serii tego ćwiczenia)
export function restApplyLive(name){
  if(!WO) return;
  WO.ex.forEach((x,i)=>{ if(x.n.trim()!==name) return;
    const nr=restCurrent(x.n, x.timed)+ciRestPlus(WO.iso);
    if(WO.phase==='rest' && !WO.trans && i===WO.cur && WO.restPlan!==nr){ WO.restEnd+=(nr-WO.restPlan)*1000; WO.restPlan=nr; WO.beeped=false; }
    x.rest=nr; });
  woSave(); if(document.getElementById('woFocus').style.display==='flex'){ woRender(); woStep(); }
}

// podpowiedź na ekranie przerwy: dwa razy +15 s albo średnia z 3 treningów wyraźnie inna niż ustawiona przerwa
export function woRestLearnHtml(){
  if(WO.trans) return '';
  const x=WO.ex[WO.cur]; if(!x || x.learnNo) return '';
  const cur=x.rest, st=restStats(x.n);
  let tgt=0, txt='';
  if((WO.plusCount||0)>=2){ tgt=Math.round(WO.restPlan/15)*15; txt=t('Dokładasz czas. <b>Ustawić {d}</b> przy tym ćwiczeniu na stałe?', {d:fmtDur(tgt)}); }
  else if(!restOverride(x.n) && st && st.sessions>=3 && Math.abs(st.avg-cur)>=25){ tgt=Math.round(st.avg/15)*15;
    txt=t('Przy tym ćwiczeniu odpoczywasz średnio <b>{a}</b> (3 ostatnie treningi), ustawione {c}. <b>Ustawić {d}</b>?', {a:fmtDur(st.avg), c:fmtDur(cur), d:fmtDur(tgt)}); }
  if(!tgt || tgt===cur) return '';
  return `<div class="wo-learn"><div>${txt}</div><div class="row"><button id="woLearnNo">${t('Nie teraz')}</button><button class="yes" id="woLearnYes" data-sec="${tgt}">${t('Ustaw {d}', {d:fmtDur(tgt)})}</button></div></div>`;
}

export function openRestEdit(name, timed, fromList?){
  const n=(name||'').trim(), o=restOverride(n), plan=restPlanOf(n, timed);
  RS={n, timed, plan, sec:o?o.sec:plan, fromList:fromList||null};
  renderRestEdit(); document.getElementById('rsSheet').style.display='flex'; document.getElementById('rsPanel').scrollTop=0;
}

export function renderRestEdit(){
  const o=restOverride(RS.n), st=restStats(RS.n);
  document.getElementById('rsPanel').innerHTML=`<div class="eh-grab"></div>
    <div class="eh-head"><div style="flex:1;min-width:0"><div class="eyebrow">${RS.fromList?'<button class="rs-back" data-rsback>'+t('‹ Lista')+'</button> · ':''}${t('Przerwa między seriami')}</div><h2 id="rsTitle">${esc(t(RS.n))}</h2></div><button class="eh-x" data-rsclose aria-label="${t('Zamknij')}">✕</button></div>
    <div class="rs-step"><button data-rsstep="-15" aria-label="${t('Krócej o 15 sekund')}">−15 s</button><b>${fmtDur(RS.sec)}</b><button data-rsstep="15" aria-label="${t('Dłużej o 15 sekund')}">+15 s</button></div>
    <div class="eh-chips">${[45,60,90,120,150,180,240].map(v=>`<button data-rsset="${v}" class="${RS.sec===v?'on':''}">${fmtDur(v)}</button>`).join('')}</div>
    <div class="wo-rows">
      <div><span>${t('Plan')}</span><span>${fmtDur(RS.plan)}</span></div>
      <div><span>${t('Twoja średnia')}${st?' ('+plural(st.sessions,'{n} trening','{n} treningi','{n} treningi','{n} workout','{n} workouts')+')':''}</span><span>${st?fmtDur(st.avg):'—'}</span></div>
      ${o?`<div><span>${o.by==='tr'?t('Teraz ustawione przez Trenera'):t('Teraz ustawione przez Ciebie')}</span><span>${fmtDur(o.sec)}</span></div>`:''}
    </div>
    <div class="rs-hint">${t('Ciężkie wielostawowe (przysiad, martwy ciąg, wyciskanie): 2–3 min. Izolowane (barki, biceps, łydki): 1–1:30. Zapamiętam przy tym ćwiczeniu na kolejne treningi — Trener też to zobaczy.')}</div>
    <button class="wo-save" data-rssave>${t('ZAPISZ {d}', {d:fmtDur(RS.sec)})}</button>
    ${o?'<button class="sw-ask" data-rsplan>'+t('↺ Wróć do planu ({d})', {d:fmtDur(RS.plan)})+'</button>':''}`;
}

export function openRestList(iso){
  const w=workoutOn(iso), idx=exIndex(), names=new Map();
  if(w && w.ex) w.ex.forEach(e0=>{ const e=effEx(e0,iso); names.set(e.n.trim(), !!timedSpec(e,e0)); });
  Object.values(idx).forEach(h=>{ if(!names.has(h.n)) names.set(h.n, h.timed); });
  Object.keys((S.adj&&S.adj.rest)||{}).forEach(n=>{ if(!names.has(n)) names.set(n, false); });
  const today=new Set(w&&w.ex?w.ex.map(e0=>effEx(e0,iso).n.trim()):[]);
  const rows=[...names].map(([n,t])=>({n, t, o:restOverride(n), st:restStats(n), today:today.has(n)}))
    .sort((a,b)=>(+b.today - +a.today) || (+!!b.o - +!!a.o) || t(a.n).localeCompare(t(b.n),locale()));
  RS={list:iso};
  document.getElementById('rsPanel').innerHTML=`<div class="eh-grab"></div>
    <div class="eh-head"><div style="flex:1;min-width:0"><div class="eyebrow">${t('Twoje ustawienia')}</div><h2 id="rsTitle">${t('Przerwy między seriami')}</h2></div><button class="eh-x" data-rsclose aria-label="${t('Zamknij')}">✕</button></div>
    <div class="rs-hint" style="margin-top:-4px">${t('Stuknij ćwiczenie, żeby zmienić przerwę. Znaczek pokazuje, kto ją ustawił.')}</div>
    <div class="rs-list">${rows.map(r=>`<button data-rsedit="${encodeURIComponent(r.n)}" data-rst="${r.t?1:0}"><span class="nm">${esc(t(r.n))}<small>${r.today?t('dziś · '):''}${t('plan {d}', {d:fmtDur(restPlanOf(r.n,r.t))})}${r.st?t(' · średnio {d}', {d:fmtDur(r.st.avg)}):''}</small></span><span class="v">${fmtDur(restCurrent(r.n,r.t))}${restTag(r.n)}</span></button>`).join('')}</div>`;
  document.getElementById('rsSheet').style.display='flex'; document.getElementById('rsPanel').scrollTop=0;
}

export function closeRest(){ document.getElementById('rsSheet').style.display='none'; }

export function restToast(msg){ const t=document.getElementById('rsToast'); t.textContent=msg; t.style.display='block'; clearTimeout(rsToastT); rsToastT=setTimeout(()=>{ t.style.display='none'; }, 3000); }

export function __init_25(){
RS = null;
rsToastT = null;
document.getElementById('rsSheet').addEventListener('click', ev=>{
  const tg=ev.target.closest('[data-rsclose],[data-rsstep],[data-rsset],[data-rssave],[data-rsplan],[data-rsedit],[data-rsback]'); if(!tg) return;
  const d=tg.dataset;
  if('rsclose' in d) closeRest();
  else if(d.rsstep){ RS.sec=Math.max(30, Math.min(300, RS.sec + +d.rsstep)); renderRestEdit(); }
  else if(d.rsset){ RS.sec=+d.rsset; renderRestEdit(); }
  else if(d.rsedit) openRestEdit(decodeURIComponent(d.rsedit), d.rst==='1', RS.list);
  else if('rsback' in d) openRestList(RS.fromList);
  else {
    const sec='rsplan' in d ? RS.plan : RS.sec, back=RS.fromList;
    restSet(RS.n, sec, 'me'); restToast('rsplan' in d ? t('Wrócono do przerwy z planu') : t('Przerwa {d} zapamiętana przy tym ćwiczeniu', {d:fmtDur(sec)}));
    if(back) openRestList(back); else closeRest();
    if(typeof moreStatus==='function' && document.getElementById('v-set').classList.contains('on')) moreStatus();
  }
});
}
