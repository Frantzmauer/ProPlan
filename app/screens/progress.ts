// ŻELAZO — Postęp: waga, wydatek z trendu wagi, obwody ciała.
// Moduł zawiera tylko deklaracje; kod startowy jest w __init_N, wywoływanych przez main.js w stałej kolejności.
import { dayIndexFor, weekOf } from '../core/backup';
import { S, save } from '../core/state';
import { cyChartBands, cyDiff, cyTracking, cyWeightNote } from '../features/cycle';
import { bodyRefresh } from '../features/body3d';
import { restToast } from '../features/rest';
import { addDays, parseISO, todayISO } from '../lib/dates';
import { TREND, estimateExpenditure, proposeGoal } from '../lib/trend';
import { DEFAULT_KCAL, DIET } from '../plan/data';
import { prDD, renderRecords } from './history';
import { estMaintenance, kcalSlider, updateKcalHint } from './more';
import { dayMeals, renderToday } from './train';
import { dec, t } from '../lib/i18n';

export let TD_WIN, TD_SPAN, TD_WN, TD_DAYS, TD_EVERY, tdFmt, MEASURES, msChartKey, msEdit;

/* ============================================================
   WEIGHT
   ============================================================ */
export function renderWeight(){
  renderRecords();
  const ws=S.weights.slice().sort((a,b)=>a.d<b.d?-1:1);
  const now=ws.length?ws[ws.length-1].w:null;
  const start=ws.length?ws[0].w:null;
  document.getElementById('wNow').textContent=now?now.toFixed(1):'—';
  document.getElementById('wStart').textContent=start?start.toFixed(1):'—';
  const dEl=document.getElementById('wDelta');
  if(now&&start){const dv=now-start;dEl.textContent=(dv>0?'+':'')+dv.toFixed(1);dEl.className='n '+(dv<=0?'down':'');}
  else{dEl.textContent='—';dEl.className='n'}
  drawChart(ws);
  cyWeightNote();
  renderTdee();
  document.getElementById('wEmpty').style.display=ws.length?'none':'block';
  renderMeasures();
}

export function kcalAdj(){ if(!S.adj) S.adj={}; if(!S.adj.kcal) S.adj.kcal={hist:[]}; if(!S.adj.kcal.hist) S.adj.kcal.hist=[]; return S.adj.kcal; }

// zmiana celu kalorii od dziś (suwak, Trener, trend wagi) — do liczenia starych dni
export function kcalRecord(kcal, prev){
  if(!kcal || kcal===prev) return;
  const A=kcalAdj(), d=todayISO(), ex=A.hist.find(h=>h.d===d);
  if(ex) ex.kcal=kcal; else A.hist.push({d, kcal, prev:prev||null});
  A.hist=A.hist.filter(h=>h.kcal!==h.prev).slice(-60);
}

export function goalOn(iso){
  const h=((S.adj&&S.adj.kcal&&S.adj.kcal.hist)||[]).slice().sort((a,b)=>a.d<b.d?-1:1);
  const e=h.filter(x=>x.d<=iso).pop();
  if(e) return e.kcal;
  return (h[0] && h[0].prev) || S.kcalGoal || DEFAULT_KCAL;
}

export function dayIntake(iso){
  const L=S.log[iso]; if(!L) return null;
  const goal=goalOn(iso), dow=parseISO(iso).getDay(), wk=weekOf(dayIndexFor(iso));
  let kcal=0, items=0;
  if(L.meals && DIET[dow]) dayMeals(iso, dow, L, wk, goal).forEach((x,i)=>{ if(L.meals['m'+i]){ kcal+=x.mc.kcal; items++; } });
  (L.custom||[]).forEach(c=>{ if(!c._del && c.done!==false){ kcal+=c.kcal||0; items++; } });
  const resolved=DIET[dow] ? DIET[dow].meals.every((_,i)=>(L.meals&&L.meals['m'+i]) || (L.ate&&L.ate['m'+i]===-1)) : false;
  return {kcal, items, full: items>=3 || kcal>=0.7*goal || (resolved && items>=1)};
}

export function tdeeEstimate(){
  const today=todayISO(), from=addDays(today,-TD_WIN), to=addDays(today,-1), days=[];
  for(let d=from; d<=to; d=addDays(d,1)){ const x=dayIntake(d); if(x && x.full) days.push(x.kcal); }
  const e=estimateExpenditure(S.weights||[], days, today);
  return e.ok ? Object.assign({formula:estMaintenance()}, e) : e;
}

export function tdeeProposal(e){ return proposeGoal(e, S.kcalGoal||DEFAULT_KCAL, e.formula); }

export function renderTdee(){
  const box=document.getElementById('tdeeCard'); if(!box) return;
  const e:any=tdeeEstimate(), A=(S.adj&&S.adj.kcal)||{}, today=todayISO(), goal=S.kcalGoal||DEFAULT_KCAL, last=A.last;
  const head=`<div class="td-h"><b>${t('Wydatek z Twoich danych')}</b><span class="md-hint" style="margin:0;white-space:nowrap">${t('28 dni')}</span></div>`;
  if(!e.ok){
    const n=e.need, row=(l,v,max,u)=>`<div class="r"><span>${l}</span><span class="bar"><i style="width:${Math.min(100,v/max*100)}%"></i></span><small>${Math.min(v,max)}/${max}${u}</small></div>`;
    box.innerHTML=head+(e.odd?`<div class="td-note">${t('Wynik wyszedł nierealny — zwykle przez niepełny zapis jedzenia albo pomyłkę przy wadze. Sprawdź ostatnie wpisy.')}</div>`:
      `<div class="md-hint" style="margin:0">${t('Po 2–3 tygodniach aplikacja porówna, co jesz, ze zmianą wagi i zaproponuje cel kalorii dopasowany do Ciebie.')}</div>
      <div class="td-prog">${row(t('Ważenia'),n.w,TD_WN,'')}${row(t('Okres ważeń'),n.span,TD_SPAN,t(' dni'))}${row(t('Dni z pełnym zapisem jedzenia'),n.days,TD_DAYS,'')}</div>
      <div class="td-note">${t('Dzień z pełnym zapisem: odhaczone co najmniej 3 posiłki albo 70% celu. Waż się rano, na czczo, kilka razy w tygodniu.')}</div>`);
    return;
  }
  const to=tdeeProposal(e), since=last ? cyDiff(last.d, today) : 99, snoozed=A.snooze && A.snooze>today;
  const show=Math.abs(to-goal)>=100 && since>=TD_EVERY && !snoozed;
  const pace=(e.formula-goal)*7/7700;
  box.innerHTML=head+`<div class="td-grid">
      <div><b>${e.tdee}</b><span>${t('kcal — Twój wydatek<br>(wzór: {f})', {f:e.formula})}</span></div>
      <div><b>${e.avg}</b><span>${t('kcal — jesz średnio<br>({n} dni)', {n:e.need.days})}</span></div>
      <div><b>${tdFmt(e.weekly)}</b><span>${t('kg/tydz. — trend wagi')}</span></div></div>`+
    (show?`<div class="td-prop"><span><b>${t('Proponuję cel {to} kcal zamiast {goal}.', {to, goal})}</b> ${to<goal?t('Twój wydatek jest niższy, niż zakładał wzór'):t('Twój wydatek jest wyższy, niż zakładał wzór')}${t(' — z nowym celem utrzymasz zamierzone tempo')}${pace>0?t(' (~{kg} kg tłuszczu/tydz.)', {kg:dec(pace,2)}):''}.</span>
      <div class="row"><button class="btn" type="button" id="tdApply">${t('Zastosuj od dziś')}</button><button class="btn ghost" type="button" id="tdLater">${t('Za tydzień')}</button></div></div>`
    : last && last.d===today ? `<div class="td-note">${t('Cel zmieniony dziś: {a} → {b} kcal (z trendu wagi).', {a:last.from, b:last.to})} <button class="btn ghost" type="button" id="tdUndo" style="font-size:12px;padding:5px 10px;margin-left:4px">${t('Cofnij')}</button></div>`
    : `<div class="td-note">${last?t('Ostatnia zmiana z trendu: {d} ({a} → {b} kcal). ', {d:prDD(last.d), a:last.from, b:last.to}):''}${Math.abs(to-goal)<100?t('Obecny cel {g} kcal pasuje do Twoich danych.', {g:goal}):snoozed?t('Następna propozycja od {d}.', {d:prDD(A.snooze)}):t('Następne sprawdzenie od {d}.', {d:prDD(addDays(last.d,TD_EVERY))})}</div>`)+
    `<div class="td-note">${cyTracking()?t('Liczone z odhaczonych posiłków i wag. Wahania wody (sól, trening, cykl) wygładza trend z 4 tygodni. Zmiana celu to zawsze Twoja decyzja.'):t('Liczone z odhaczonych posiłków i wag. Wahania wody (sól, trening) wygładza trend z 4 tygodni. Zmiana celu to zawsze Twoja decyzja.')}</div>`;
  const ap=document.getElementById('tdApply');
  if(ap) ap.onclick=()=>{ const Aa=kcalAdj(), from=goal; Aa.prevLast=Aa.last||null; Aa.last={at:Date.now(), d:today, from, to, tdee:e.tdee}; delete Aa.snooze;
    S.kcalGoal=to; kcalRecord(to, from); kcalSlider.value=to; updateKcalHint(); S._settingsM=Date.now(); save(); renderToday(); renderWeight(); restToast(t('Nowy cel: {n} kcal', {n:to})); };
  const lt=document.getElementById('tdLater');
  if(lt) lt.onclick=()=>{ kcalAdj().snooze=addDays(today,7); S._settingsM=Date.now(); save(); renderWeight(); };
  const un=document.getElementById('tdUndo');
  if(un) un.onclick=()=>{ const Aa=kcalAdj(), l=Aa.last; S.kcalGoal=l.from; kcalRecord(l.from, l.to); Aa.last=Aa.prevLast||null; delete Aa.prevLast;
    kcalSlider.value=S.kcalGoal; updateKcalHint(); S._settingsM=Date.now(); save(); renderToday(); renderWeight(); restToast(t('Cofnięto — cel {n} kcal', {n:S.kcalGoal})); };
}

export function renderMeasures(){
  const box=document.getElementById('msInputs'); if(!box) return;
  if(!box.childElementCount){
    box.innerHTML=MEASURES.map(m=>`<label style="font-size:12px;color:var(--ink-dim)">${m.l}
      <input type="number" step="0.5" inputmode="decimal" class="md-in" id="ms_${m.k}" placeholder="cm" style="margin-top:4px"></label>`).join('');
  }
  // pomiar bez żadnej wartości (np. po cofnięciu zmiany od Trenera) nie liczy się jako pomiar
  const ms=(S.measures||[]).filter(m=>MEASURES.some(x=>m[x.k]>0)).sort((a,b)=>a.d<b.d?-1:1);
  document.getElementById('msEmpty').style.display=ms.length?'none':'block';
  const first=k=>{const x=ms.find(m=>m[k]>0);return x?x[k]:null;};
  const last=k=>{for(let i=ms.length-1;i>=0;i--) if(ms[i][k]>0) return ms[i][k]; return null;};
  const fmt=v=>dec(v,1);
  const half=S.profile&&S.profile.height?S.profile.height/2:null;
  document.getElementById('msTable').innerHTML=ms.length?MEASURES.map(m=>{
    const a=first(m.k), b=last(m.k); if(b===null) return '';
    const dv=b-a, good=m.down?dv<0:dv>0;
    const col=dv===0?'var(--ink-dim)':(good?'#5fbf7a':'var(--red)');
    const sel=m.k===msChartKey?'border-color:var(--amber)':'';
    return `<div data-ms="${m.k}" style="display:flex;justify-content:space-between;padding:8px 10px;border:1px solid var(--line);border-radius:10px;margin-bottom:6px;cursor:pointer;${sel}">
      <span>${m.l}${m.k==='waist'&&half?` <span style="color:var(--ink-faint);font-size:12px">${t('cel')} &lt; ${fmt(half)}</span>`:''}</span>
      <span><b>${fmt(b)}</b> <span style="color:${col};font-size:13px">${dv>0?'+':''}${fmt(dv)}</span></span></div>`;
  }).join('')+'<div style="font-size:12px;color:var(--ink-faint)">'+t('Kliknij wiersz, żeby zobaczyć wykres. Zmiana liczona od pierwszego pomiaru.')+'</div>':'';
  document.querySelectorAll('[data-ms]').forEach(el=>el.onclick=()=>{msChartKey=el.dataset.ms;renderMeasures();});
  const series=ms.filter(m=>m[msChartKey]>0).map(m=>({d:m.d,w:m[msChartKey]}));
  const c=document.getElementById('msChart'); c.style.display=series.length?'block':'none';
  if(series.length) drawChart(series,'msChart');
  // historia pomiarów: każdy zapis można poprawić
  const fmtD=d=>d.slice(8,10)+'.'+d.slice(5,7)+'.'+d.slice(0,4);
  document.getElementById('msHist').innerHTML=ms.length?`<div class="eyebrow" style="margin-top:14px">${t('Historia pomiarów')}</div>`+ms.slice().reverse().map(m=>
    `<div class="ms-hist"><div><b>${fmtD(m.d)}</b><span>${MEASURES.filter(x=>m[x.k]>0).map(x=>x.l.split(' ')[0]+' '+fmt(m[x.k])).join(' · ')}</span></div>
      <button class="btn ghost" data-msedit="${m.d}" aria-label="${t('Edytuj pomiar z {d}', {d:fmtD(m.d)})}">${t('Edytuj')}</button></div>`).join(''):'';
  document.querySelectorAll('[data-msedit]').forEach(b=>b.onclick=()=>msStartEdit(b.dataset.msedit));
  msEditUi();
  bodyRefresh();   // sylwetka 3D z nowych obwodów (jeśli otwarta)
}

// edycja zapisanego pomiaru: wartości do pól, „Zapisz zmiany” nadpisuje ten dzień (puste pole usuwa wartość)
export function msStartEdit(d){
  const e=(S.measures||[]).find(m=>m.d===d); if(!e) return;
  msEdit=d;
  // pole type=number przyjmuje tylko kropkę (przecinek = puste pole); przeglądarka sama pokaże ją po polsku
  MEASURES.forEach(m=>{ document.getElementById('ms_'+m.k).value=e[m.k]>0?String(e[m.k]):''; });
  msEditUi();
  document.getElementById('msInputs').scrollIntoView({block:'center', behavior:'smooth'});
}

export function msEditUi(){
  const note=document.getElementById('msEditNote'), on=!!msEdit;
  note.style.display=on?'block':'none';
  if(on) note.textContent=t('Edytujesz pomiar z {d}. Puste pole usuwa wartość.', {d:msEdit.slice(8,10)+'.'+msEdit.slice(5,7)+'.'+msEdit.slice(0,4)});
  document.getElementById('msCancel').style.display=on?'':'none';
  document.getElementById('msSave').textContent=on?t('Zapisz zmiany'):t('Zapisz pomiar');
}

export function msStopEdit(){ msEdit=null; MEASURES.forEach(m=>document.getElementById('ms_'+m.k).value=''); msEditUi(); }

export function drawChart(ws, canvasId?){
  const c=document.getElementById(canvasId||'wChart');
  const dpr=window.devicePixelRatio||1;
  const W=c.clientWidth||600, H=180;
  c.width=W*dpr; c.height=H*dpr; c.getContext('2d').scale(dpr,dpr);
  const ctx=c.getContext('2d');
  ctx.clearRect(0,0,W,H);
  if(ws.length<1)return;
  if(ws.length===1){
    ctx.fillStyle='#ff7a1a';ctx.beginPath();ctx.arc(W/2,H/2,5,0,7);ctx.fill();
    ctx.fillStyle='#9aa3ab';ctx.font='13px Inter';ctx.textAlign='center';
    ctx.fillText(ws[0].w.toFixed(1)+(canvasId==='msChart'?' cm':' kg'),W/2,H/2-14);
    return;
  }
  const pad={l:36,r:12,t:16,b:22};
  // oś X = czas: kropki stoją w swoich dniach, przerwa 5 dni wygląda jak 5 dni
  const DAY=86400000;
  const ts=ws.map(p=>parseISO(p.d).getTime()), ys=ws.map(p=>p.w);
  const t0=ts[0], span=Math.max(ts[ts.length-1]-t0, DAY);
  const minY=Math.min(...ys)-0.5, maxY=Math.max(...ys)+0.5;
  const X=i=>pad.l+(W-pad.l-pad.r)*((ts[i]-t0)/span);
  const XT=t=>pad.l+(W-pad.l-pad.r)*((t-t0)/span);
  const Y=v=>pad.t+(H-pad.t-pad.b)*(1-(v-minY)/(maxY-minY));
  // grid
  ctx.strokeStyle='#2a3138';ctx.lineWidth=1;ctx.fillStyle='#5f6a72';ctx.font='10px Inter';ctx.textAlign='right';
  if(!canvasId) cyChartBands(ctx, XT, t0, span, pad, W, H);   // dni okresu i tydzień przed nim
  for(let g=0;g<=3;g++){const v=minY+(maxY-minY)*g/3;const y=Y(v);ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();ctx.fillText(v.toFixed(1),pad.l-6,y+3)}
  // daty pod osią: co 1/2/4… tygodnie, tak by zmieściło się ~5 etykiet
  const days=span/DAY, stepW=[1,2,4,8,13].find(s=>days/(7*s)<=5)||26;
  const lab=t=>{const d=new Date(t);return String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0');};
  ctx.textAlign='center';
  for(let t=t0; t<=t0+span+1; t+=stepW*7*DAY){
    const x=XT(t);
    ctx.strokeStyle='#22282e';ctx.beginPath();ctx.moveTo(x,pad.t);ctx.lineTo(x,H-pad.b);ctx.stroke();
    ctx.fillText(lab(t),Math.min(Math.max(x,pad.l+14),W-pad.r-14),H-6);
  }
  // wygładzony trend (EMA w czasie: dłuższa przerwa = nowy pomiar waży więcej)
  const ema=[];let prev=ys[0];const tau=4*DAY;
  ys.forEach((v,i)=>{const a=i?1-Math.exp(-(ts[i]-ts[i-1])/tau):1; prev=a*v+(1-a)*prev; ema.push(prev);});
  ctx.strokeStyle='#5fa8d3';ctx.lineWidth=2.5;ctx.beginPath();ema.forEach((v,i)=>{i?ctx.lineTo(X(i),Y(v)):ctx.moveTo(X(i),Y(v))});ctx.stroke();
  // raw dots
  ctx.fillStyle='#ff7a1a';ws.forEach((p,i)=>{ctx.beginPath();ctx.arc(X(i),Y(p.w),3,0,7);ctx.fill()});
  // last label
  const li=ws.length-1;ctx.fillStyle='#f2f0ea';ctx.font='bold 12px Inter';ctx.textAlign='left';
  ctx.fillText(ws[li].w.toFixed(1),X(li)-24,Y(ws[li].w)-9);
}

export function __init_10(){

/* ---- kalorie z trendu wagi: rzeczywisty wydatek z Twoich danych (jak w MacroFactor) ----
   Wydatek = średnie kalorie z dni z pełnym zapisem − zmiana wagi (trend z regresji liniowej, 1 kg ≈ 7700 kcal).
   Okno: 28 dni przed dzisiaj. Potrzeba: ważenia z co najmniej 14 dni (min. 6), 10 dni z pełnym zapisem jedzenia.
   Dzień z pełnym zapisem: 3+ odhaczone posiłki albo 70% celu tego dnia (niepełny zapis zaniżałby wydatek).
   Jadłospis skaluje się do celu, więc stare dni liczymy z celem, który wtedy obowiązywał (S.adj.kcal.hist).
   Propozycja zachowuje zamierzony deficyt (wzór − cel), najwyżej ±300 kcal naraz i co najmniej 14 dni po poprzedniej
   zmianie z trendu; tempo spadku nie szybsze niż 1% masy ciała na tydzień.
   Stan w S.adj.kcal = {hist:[{d,kcal,prev}], last:{at,d,from,to,tdee}, snooze:'RRRR-MM-DD'} — synchronizowany z ustawieniami. */
TD_WIN = TREND.WINDOW;
TD_SPAN = TREND.MIN_SPAN;
TD_WN = TREND.MIN_WEIGHINGS;
TD_DAYS = TREND.MIN_DAYS;
TD_EVERY = TREND.EVERY;
tdFmt = v=>(v>0?'+':v<0?'−':'')+dec(Math.abs(v),2);

/* ---- obwody ciała: S.measures=[{d, waist, chest, arm, thigh, hips, _t}] ---- */
MEASURES = [
  {k:'waist',l:t('Pas (pępek)'),down:true},
  {k:'chest',l:t('Klatka'),down:false},
  {k:'arm',l:t('Ramię (napięte)'),down:false},
  {k:'thigh',l:t('Udo'),down:false},
  {k:'hips',l:t('Biodra'),down:true},
];
msChartKey = 'waist';
msEdit = null;
document.getElementById('msSave').onclick=()=>{
  const iso=msEdit||todayISO(); const vals={}; let any=false;
  MEASURES.forEach(m=>{const v=parseFloat(document.getElementById('ms_'+m.k).value.replace(',','.')); if(v>=10&&v<=250){vals[m.k]=v;any=true;}});
  if(!any && !msEdit){document.getElementById('ms_waist').focus();return;}
  if(!S.measures) S.measures=[];
  let e=S.measures.find(x=>x.d===iso);
  if(!e){e={d:iso};S.measures.push(e);}
  if(msEdit) MEASURES.forEach(m=>{ delete e[m.k]; });   // edycja: dzień dokładnie taki, jak w polach
  Object.assign(e,vals); e._t=Date.now();
  if(msEdit) restToast('Zapisano zmiany pomiaru');
  msStopEdit();
  save(); renderMeasures();
};
document.getElementById('msCancel').onclick=()=>msStopEdit();
}
