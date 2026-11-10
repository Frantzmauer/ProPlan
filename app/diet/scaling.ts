// ŻELAZO — Skalowanie posiłków do celu kalorii (z ochroną białka).
// Moduł zawiera tylko deklaracje; kod startowy jest w __init_N, wywoływanych przez main.js w stałej kolejności.
import { dayIndexFor } from '../core/backup';
import { S, save } from '../core/state';
import { mark } from '../lib/state';
import { dietScore, dietTip } from '../lib/dietday';
import { todayISO } from '../lib/dates';
import { DIET, autoVariant, macroGoalFor, variantBase } from '../plan/data';
import { goalOn } from '../screens/progress';
import { esc } from '../screens/accounts';
import { openMealDialog } from '../screens/guide';
import { MT, mtAskHtml, mtAteNow, mtBind, mtCloseHtml, mtOnCheck, mtStampCustom, mtStampHtml } from '../screens/meals';
import { dayMeals, renderToday } from '../screens/train';
import { renderMacros } from '../ui/dictation';
import { t } from '../lib/i18n';


/* ============================================================
   SKALOWANIE POSIŁKÓW DO CELU KALORYCZNEGO (z ochroną białka)
   ============================================================ */
// g białka — poniżej tego nie schodzimy skalując: ~2 g/kg masy ciała, maks. 180 g (plan pisany pod 100+ kg)
export function protFloor(){
  const w=S&&S.profile&&S.profile.weight;
  return (w>=35) ? Math.max(100, Math.min(180, Math.round(2*w/5)*5)) : 180;
}

// suma bazowych kalorii i białka dnia dla aktywnych wariantów (z gramatur składników)
export function dayBase(dow, L, wk){
  const diet=DIET[dow]; let kcal=0,p=0;
  diet.meals.forEach((slot,i)=>{
    let vi; if(L&&L.var&&L.var[i]!==undefined) vi=L.var[i]; else vi=(wk>=1?autoVariant(wk):0);
    const b=variantBase(slot.v[vi]); kcal+=b.kcal; p+=b.p;
  });
  return {kcal,p};
}

// współczynniki skalowania: białko chronione, węgle/tłuszcz absorbują różnicę
// floor: ile białka mają dać skalowane posiłki (domyślnie cały dzienny próg; mniej, gdy część dnia to posiłki od Trenera)
export function scaleFactors(goalKcal, base, floor){
  if(!base.kcal) return {fProt:1,fCF:1};
  const pf = (floor===undefined) ? protFloor() : floor;
  const targetProt = Math.max(Math.min(base.p, pf), goalKcal>=base.kcal ? base.p : Math.min(base.p, pf));
  const fProt = base.p ? targetProt/base.p : 1;
  const protKcal = base.p*4*fProt;
  const restBaseKcal = base.kcal - base.p*4;
  const restTargetKcal = Math.max(0, goalKcal - protKcal);
  const fCF = restBaseKcal>0 ? restTargetKcal/restBaseKcal : 1;
  return {fProt, fCF:Math.max(0.4, Math.min(1.8, fCF))};
}

export function renderMeals(iso, dow, L, wk){
  const diet=DIET[dow];
  const card=document.getElementById('mealsCard');
  const goal=goalOn(iso);   // cel kalorii obowiązujący tego dnia (dziś = obecny)
  const dm=dayMeals(iso, dow, L, wk, goal);
  let done=0, tot={kcal:0,p:0,c:0,f:0};
  let html='';
  diet.meals.forEach((slot,i)=>{
    const vi=dm[i].vi, madj=dm[i].adj;
    const mc=dm[i].mc;               // kcal, makra i opis z tych samych (skalowanych) gramatur; posiłek od Trenera — jego wartości
    const key='m'+i, on=!!L.meals[key];
    if(on){done++;tot.kcal+=mc.kcal;tot.p+=mc.p;tot.c+=mc.c;tot.f+=mc.f;}
    const isAuto = !(L.var && L.var[i]!==undefined);
    // zastąpiony własnym posiłkiem („Zamień” albo „Inaczej” w domknięciu dnia)
    const rep=!on && (L.custom||[]).find(c=>c.rep===key && !c._del);
    const dots=madj?'<span class="vman">'+t('od Trenera')+'</span>':slot.v.map((_,vx)=>`<button class="vdot ${vx===vi?'on':''}" data-vpick="${i}" data-vx="${vx}" title="${t('Wariant {n}', {n:vx+1})}">${vx+1}</button>`).join('');
    const swap=(on||rep)?'':`<button class="mrep" data-mrep="${key}" aria-label="${t('Zamień: {m} — wpisz, co było zamiast', {m:t(slot.tag)})}">${t('Zamień')}</button>`;
    html+=`<div class="meal ${on?'done':''}">
      <div class="check ${on?'on':''}" data-meal="${key}"><svg viewBox="0 0 24 24"><path d="M4 12l5 5L20 6"/></svg></div>
      <div class="body">
        <div class="meal-head">
          <span class="tag">${t(slot.tag)}</span>
          <span class="vdots">${swap}${dots}</span>
        </div>
        <div class="txt" data-meal="${key}">${mc.txt}</div>
        <div class="kcal">${mc.kcal} kcal · ${t('B {p} / W {c} / T {f}', {p:mc.p, c:mc.c, f:mc.f})}${(isAuto||madj)?'':' · <span class="vman">'+t('ręczny wariant')+'</span>'}</div>
        ${rep?`<span class="mt-st skip">${t('zastąpiony:')} ${esc(rep.txt||t('własny posiłek'))}</span>`:mtStampHtml(iso, L, key, on)}${mtAskHtml(iso, key, slot.tag)}
      </div>
    </div>`;
  });
  // --- własne posiłki (dodane ręcznie) ---
  const customs=(L.custom||[]);
  customs.forEach((cm,ci)=>{
    if(cm._del) return; // usunięty (tombstone) — nie pokazuj
    const on=cm.done!==false; // domyślnie policzony po dodaniu
    if(on){done++;tot.kcal+=cm.kcal||0;tot.p+=cm.p||0;tot.c+=cm.c||0;tot.f+=cm.f||0;}
    html+=`<div class="meal ${on?'done':''}">
      <div class="check ${on?'on':''}" data-custom="${ci}"><svg viewBox="0 0 24 24"><path d="M4 12l5 5L20 6"/></svg></div>
      <div class="body">
        <div class="meal-head">
          <span class="tag" style="color:var(--steel)">${cm.rep&&diet.meals[+cm.rep.slice(1)]?t('Zamiast: ')+t(diet.meals[+cm.rep.slice(1)].tag):t('Własny')}</span>
          <button class="vdot" data-cdel="${ci}" title="${t('Usuń')}" style="color:var(--red);border-color:rgba(226,84,58,.35)">✕</button>
        </div>
        <div class="txt" data-custom="${ci}">${cm.txt||t('Posiłek')}</div>
        <div class="kcal">${cm.kcal||0} kcal${(cm.p||cm.c||cm.f)?' · '+t('B {p} / W {c} / T {f}', {p:cm.p||0, c:cm.c||0, f:cm.f||0}):''}</div>
        ${on?mtStampCustom(iso, cm):''}
      </div>
    </div>`;
  });
  // --- przycisk dodania ---
  html+=`<div class="add-row">
    <button class="add-btn" id="addMealBtn"><span>＋</span> ${t('Dodaj posiłek')}</button>
    <div class="add-kcal">
      <input type="number" inputmode="numeric" id="quickKcal" placeholder="kcal">
      <button class="add-btn alt" id="addKcalBtn">${t('Dodaj kalorie')}</button>
    </div>
  </div>`;

  card.innerHTML=mtCloseHtml(iso, L, dow)+html;
  mtBind(card, iso, L, dow);
  card.querySelectorAll('[data-meal]').forEach(el=>{
    el.onclick=()=>{const k=el.dataset.meal;
      if(!L.meals[k] && (L.custom||[]).some(c=>c.rep===k && !c._del)) return;   // zastąpiony — liczy się zamiennik
      L.meals[k]=!L.meals[k];mark(L,'meal:'+k);mtOnCheck(iso, L, k, dow);save();renderToday()};
  });
  card.querySelectorAll('[data-vpick]').forEach(el=>{
    el.onclick=(e)=>{e.stopPropagation();const mi=+el.dataset.vpick, vx=+el.dataset.vx;if(!L.var)L.var={};L.var[mi]=vx;mark(L,'var:'+mi);save();renderToday();};
  });
  card.querySelectorAll('[data-custom]').forEach(el=>{
    el.onclick=()=>{const ci=+el.dataset.custom;L.custom[ci].done=(L.custom[ci].done===false);L.custom[ci]._t=Date.now();mark(L,'custom');save();renderToday();};
  });
  card.querySelectorAll('[data-cdel]').forEach(el=>{
    el.onclick=(e)=>{e.stopPropagation();const ci=+el.dataset.cdel, c=L.custom[ci];c._del=Date.now();c.done=false;
      // usunięty zamiennik: posiłek z planu wraca jako nieodhaczony
      if(c.rep && L.ate && L.ate[c.rep]===-1){ delete L.ate[c.rep]; mark(L,'ate:'+c.rep); }
      mark(L,'custom');save();renderToday();};
  });
  card.querySelectorAll('[data-mrep]').forEach(el=>{
    el.onclick=(e)=>{ e.stopPropagation(); MT.replace={iso, key:el.dataset.mrep}; openMealDialog(iso, true); };
  });
  document.getElementById('addMealBtn').onclick=()=>openMealDialog(iso);
  const qk=document.getElementById('quickKcal');
  const addKcal=()=>{
    const v=parseInt(qk.value); if(!v||v<=0){qk.focus();return;}
    if(!L.custom)L.custom=[];
    L.custom.push({txt:v+' kcal', kcal:v, p:0,c:0,f:0, done:true, _t:Date.now(), ate:mtAteNow(iso)});
    mark(L,'custom'); save(); renderToday();
  };
  document.getElementById('addKcalBtn').onclick=addKcal;
  qk.addEventListener('keydown',e=>{if(e.key==='Enter')addKcal()});

  const totalMeals=diet.meals.length+customs.length;
  document.getElementById('mealsProgress').textContent=t('{a}/{b} posiłków', {a:done, b:totalMeals});
  renderMacros(tot, goal);
  renderDietScore(iso, tot, goal);
}

// karta „Dzień diety”: kcal 85–110% celu i białko ≥ 80% — dziś na bieżąco, wcześniejsze dni z wynikiem
export function renderDietScore(iso, tot, goal){
  const box=document.getElementById('dietScore'), today=todayISO();
  if(!box) return;
  if(iso>today || dayIndexFor(iso)<1){ box.style.display='none'; return; }   // przyszłość i dni przed startem planu się nie liczą
  const s=dietScore(tot, macroGoalFor(goal)), tip=iso===today?dietTip(tot, s):'';
  const pill=s.ok?'<span class="ds-pill ok">'+t('✓ zaliczony')+'</span>':iso===today?'<span class="ds-pill wip">'+t('w toku · do północy')+'</span>':'<span class="ds-pill no">'+t('niezaliczony')+'</span>';
  box.style.display='';
  box.innerHTML=`<div class="ds-h"><b>${t('Dzień diety')}</b>${pill}</div>
    <div class="ds-crit"><span><b class="${s.kcalOk?'ok':'no'}">${s.kcalOk?'✓':'✗'}</b> kcal ${s.kcalPct}% <small>(${s.lo}–${s.hi})</small></span>
    <span><b class="${s.pOk?'ok':'no'}">${s.pOk?'✓':'✗'}</b> ${t('białko')} ${s.pPct}% <small>(${t('min. {g} g', {g:s.pMin})})</small></span></div>
    ${tip?`<div class="ds-tip">${tip}</div>`:''}`;
}


