// ŻELAZO — Historia ćwiczeń, wykresy i rekordy.
// Moduł zawiera tylko deklaracje; kod startowy jest w __init_N, wywoływanych przez main.js w stałej kolejności.
import { dayIndexFor } from '../core/backup';
import { S } from '../core/state';
import { swapSplit } from '../features/swap';
import { addDays, parseISO, todayISO } from '../lib/dates';
import { prAnalyze, prBest } from '../lib/records';
import { workoutOn } from '../plan/data';
import { esc } from './accounts';
import { DOW_SHORT, effEx, setOk, timedSpec } from './train';
import { locale } from '../lib/i18n';

export let exIdxCache, IC_HIST, EH, recAll;
export function __set_exIdxCache(v){ exIdxCache=v; return v; }

export function exIndex(){
  if(exIdxCache) return exIdxCache;
  const idx={}, today=todayISO();
  Object.keys(S.log).sort().forEach(p=>{
    if(p>today || dayIndexFor(p)<1) return;
    const w=workoutOn(p), L=S.log[p];
    if(!w || w.type!=='lift' || !L || !L.ex) return;
    w.ex.forEach((e0,i)=>{
      const e=effEx(e0,p), r=L.ex[p+'_e'+i];
      if(!r || !r.sets || r.skip) return;
      const sp=swapSplit(e, p), cut=sp?sp.fromSet:1, before=[], sets=[];
      for(let s=1;s<=e.s;s++){ const kg=parseFloat(r.sets['w'+s]), rp=parseFloat(r.sets['r'+s]); if(rp>0 && setOk(r,s)) (s<cut?before:sets).push({kg:kg>0?kg:0, r:rp}); }
      const add=(name, list, full, timed)=>{ if(!list.length) return; const n=name.trim(), h=idx[n]||(idx[n]={n, timed:false, sess:[]});
        if(timed) h.timed=true; h.sess.push({iso:p, sets:list, full, phase3:!!w.phase3}); };
      if(sp) add(sp.was, before, false, false);   // zamiana w trakcie: wcześniejsze serie zostają przy poprzednim ćwiczeniu
      add(e.n, sets, sets.length>=e.s-cut+1, !!timedSpec(e,e0));
    });
  });
  Object.values(idx).forEach(h=>{ h.kind=h.timed?'time':(h.sess.some(s=>s.sets.some(x=>x.kg>0))?'kg':'reps'); });
  return exIdxCache=idx;
}

export function prFmt(x){ return String(Math.round(x*10)/10).replace('.',','); }

export function prE1(x){ return prFmt(Math.round(x*2)/2); }

export function prNum(x){ return Math.round(x).toLocaleString(locale()); }

export function prDD(iso){ return iso.slice(8,10)+'.'+iso.slice(5,7); }

export function prUnit(kind){ return kind==='kg'?'kg':kind==='time'?'s':'powt.'; }

export function prName(kind,t){ return t==='top'?(kind==='kg'?'Ciężar':kind==='time'?'Czas':'Powtórzenia'):t==='e1'?'1RM szac.':t==='vol'?'Objętość':'Powtórzenia'; }

export function prTopText(kind,s){
  if(kind!=='kg') return prFmt(s.m.top)+' '+prUnit(kind);
  return prFmt(s.m.top)+' kg × '+Math.max(...s.sets.filter(x=>x.kg===s.m.top).map(x=>x.r));
}

export function prSetsText(kind,sets){
  if(kind!=='kg') return sets.map(x=>x.r).join(', ')+' '+prUnit(kind);
  const kgs=[...new Set(sets.map(x=>x.kg))];
  return kgs.length===1 ? (kgs[0]?prFmt(kgs[0])+' kg × ':'')+sets.map(x=>x.r).join(', ') : sets.map(x=>prFmt(x.kg)+'×'+x.r).join(', ');
}

// przycisk pod ćwiczeniem na karcie dnia
export function exHistBtn(name, iso){
  const h=exIndex()[name.trim()]; if(!h) return '';
  const an=prAnalyze(h), b=prBest(h.kind,an), t=an.find(s=>s.iso===iso), pr=t && t.prs.length;
  return `<button class="hist-btn${pr?' new':''}" data-hist="${encodeURIComponent(h.n)}">${IC_HIST}<span>${pr?'🏆 Rekord dziś · ':''}Historia · rekord ${prTopText(h.kind,b.top)}</span></button>`;
}

export function openExHist(n){ if(!exIndex()[n]) return; EH={n, metric:'top', sel:null, all:false}; renderExHist(); document.getElementById('exHist').style.display='flex'; document.getElementById('ehPanel').scrollTop=0; }

export function closeExHist(){ document.getElementById('exHist').style.display='none'; }

export function ehMetrics(kind){
  return kind==='kg'?[['top','Ciężar'],['e1','1RM szac.'],['vol','Objętość']]
    : kind==='time'?[['top','Najdłużej'],['vol','Suma w treningu']] : [['top','Najlepsza seria'],['vol','Suma w treningu']];
}

export function ehChart(h,an){
  const W=340,H=196,L=38,R=12,T=18,B=26, k=EH.metric, today=todayISO();
  const all=an.map((s,i)=>({t:parseISO(s.iso).getTime()+432e5, y:k==='e1'?Math.round(s.m.e1*2)/2:s.m[k], pr:s.prs.includes(k), i, today:s.iso===today}));
  // 1RM: trening bez serii do 12 powtórzeń nie ma szacunku — pomijamy go, zamiast rysować 0
  const pts=k==='e1'?all.filter(p=>p.y>0):all, skipped=all.length-pts.length;
  if(pts.length<2) return {svg:null, sel:EH.sel==null?an.length-1:EH.sel, skipped};
  const lo=Math.min(...pts.map(p=>p.y)), hi=Math.max(...pts.map(p=>p.y));
  const pad=(hi-lo)*0.12||Math.max(1,hi*0.05), raw=(hi-lo+2*pad)/4, mag=Math.pow(10,Math.floor(Math.log10(raw)));
  const step=[1,2,2.5,5,10].find(m=>m*mag>=raw)*mag;
  const y0=Math.max(0,Math.floor((lo-pad)/step)*step), y1=Math.ceil((hi+pad)/step)*step;
  const t0=pts[0].t-2*864e5, t1=pts[pts.length-1].t+2*864e5;
  const X=t=>L+(t-t0)/(t1-t0)*(W-L-R), Y=y=>T+(1-(y-y0)/((y1-y0)||1))*(H-T-B);
  let g='';
  const p3=an.find((s,i)=>i>0 && s.phase3);
  if(p3){ const px=X(parseISO(p3.iso).getTime()-864e5); g+=`<rect x="${px}" y="${T}" width="${Math.max(0,W-R-px)}" height="${H-T-B}" fill="var(--amber-soft)" opacity=".45"/><text class="ph" x="${px+5}" y="${T+12}">FAZA 3</text>`; }
  for(let v=y0; v<=y1+1e-9; v+=step) g+=`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${L-6}" y="${Y(v)+3.5}" text-anchor="end">${k==='vol'&&v>=1000?prFmt(v/1000)+'k':prFmt(v)}</text>`;
  const MON=['sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','lis','gru'];
  for(let d=new Date(t0); d.getTime()<=t1; d=new Date(d.getFullYear(),d.getMonth()+1,1)){
    const f=new Date(d.getFullYear(),d.getMonth(),1).getTime(); if(f<t0) continue;
    g+=`<line x1="${X(f)}" x2="${X(f)}" y1="${T}" y2="${H-B}" stroke="var(--line)" stroke-dasharray="2 3"/><text x="${X(f)+4}" y="${H-8}">${MON[d.getMonth()]}</text>`;
  }
  g+=`<path d="${pts.map((p,i)=>(i?'L':'M')+X(p.t).toFixed(1)+','+Y(p.y).toFixed(1)).join(' ')}" fill="none" stroke="var(--amber)" stroke-width="2" stroke-linejoin="round"/>`;
  const sel=EH.sel==null?pts[pts.length-1].i:EH.sel, sp=pts.find(p=>p.i===sel);
  if(sp) g+=`<line x1="${X(sp.t)}" x2="${X(sp.t)}" y1="${T}" y2="${H-B}" stroke="var(--ink-dim)" stroke-dasharray="3 3"/>`;
  pts.forEach(p=>{
    const cx=X(p.t), cy=Y(p.y);
    g+=p.pr?`<circle cx="${cx}" cy="${cy}" r="5.5" fill="var(--gold)" stroke="var(--bg)" stroke-width="1.5"/>`:`<circle cx="${cx}" cy="${cy}" r="3.5" fill="var(--panel)" stroke="var(--amber)" stroke-width="1.5"/>`;
    if(p.i===sel) g+=`<circle cx="${cx}" cy="${cy}" r="9" fill="none" stroke="var(--ink)" stroke-width="1.5"/>`;
    if(p.today) g+=`<text x="${cx}" y="${cy-12}" text-anchor="end" style="fill:var(--gold);font-weight:600">dziś</text>`;
  });
  // pola dotyku szersze niż kropki
  const hw=Math.max(7,Math.min(20,(W-L-R)/pts.length/2));
  pts.forEach(p=>{ g+=`<rect data-ept="${p.i}" x="${X(p.t)-hw}" y="${T}" width="${hw*2}" height="${H-T-B}" fill="transparent" style="cursor:pointer"/>`; });
  return {svg:`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Wykres: ${esc(h.n)}">${g}</svg>`, sel, skipped};
}

export function renderExHist(){
  const h=exIndex()[EH.n]; if(!h){ closeExHist(); return; }
  const an=prAnalyze(h), b=prBest(h.kind,an), u=prUnit(h.kind), K=h.kind;
  const {svg,sel,skipped}=ehChart(h,an), s=an[sel], today=todayISO();
  const e1note=EH.metric!=='e1'||!skipped?'':svg
    ?`<div class="eh-note">Pominięte treningi (${skipped}): same serie powyżej 12 powtórzeń, z nich nie liczymy 1RM. Postęp przy wielu powtórzeniach widać w zakładkach Ciężar i Objętość.</div>`
    :`<div class="eh-note">Za mało serii do 12 powtórzeń, żeby pokazać trend 1RM. Przy wielu powtórzeniach postęp widać w zakładkach Ciężar i Objętość.</div>`;
  const val=k=>k==='e1'?(s.m.e1>0?'≈ '+prE1(s.m.e1)+' kg':'— (serie powyżej 12 powt.)'):k==='vol'?prNum(s.m.vol)+' '+(K==='kg'?'kg':u):prTopText(K,s);
  const tiles=K==='kg'
    ?[['Najcięższa seria',prTopText(K,b.top),b.top.iso],['1RM szacowany',b.e1.m.e1?'≈ '+prE1(b.e1.m.e1)+' kg':'—',b.e1.iso],['Objętość treningu',b.vol.full?prNum(b.vol.m.vol)+' kg':'—',b.vol.full?b.vol.iso:null]]
    :[[K==='time'?'Najdłużej':'Najlepsza seria',prTopText(K,b.top),b.top.iso],['Suma w treningu',b.vol.full?prNum(b.vol.m.vol)+' '+u:'—',b.vol.full?b.vol.iso:null],['Treningi',String(an.length),an[0].iso]];
  let reps='';
  if(K==='kg'){
    const by={}; an.forEach(x=>x.sets.forEach(y=>{ if(y.kg>0 && (!by[y.kg]||y.r>by[y.kg].r)) by[y.kg]={r:y.r,iso:x.iso}; }));
    const kgs=Object.keys(by).map(Number).sort((a,c)=>c-a).slice(0,5);
    if(kgs.length) reps=`<div class="eh-sec">Najwięcej powtórzeń przy ciężarze</div><table class="eh-reps">${kgs.map(kg=>`<tr><td>${prFmt(kg)} kg</td><td>${by[kg].r} powt.</td><td>${prDD(by[kg].iso)}</td></tr>`).join('')}</table>`;
  }
  const list=[...an].reverse(), shown=EH.all?list:list.slice(0,6), p3=an.find((x,i)=>i>0&&x.phase3);
  const chips=t=>t.map(p=>`<span class="prchip">🏆 ${prName(K,p)}</span>`).join('');
  document.getElementById('ehPanel').innerHTML=`<div class="eh-grab"></div>
    <div class="eh-head"><div style="flex:1;min-width:0"><div class="eyebrow">Historia · ${an.length} ${an.length===1?'trening':an.length%10>=2&&an.length%10<=4&&(an.length%100<10||an.length%100>=20)?'treningi':'treningów'}</div><h2 id="ehTitle">${esc(h.n)}</h2></div>
      <button class="eh-x" data-ehclose aria-label="Zamknij">✕</button></div>
    ${an.length>1?`<div class="eh-chips">${ehMetrics(K).map(([k,l])=>`<button data-emetric="${k}" class="${EH.metric===k?'on':''}">${l}</button>`).join('')}</div>${svg?`<div class="eh-chart">${svg}</div>`:''}${e1note}`:''}
    <div class="eh-sel"><div class="d">${s.iso===today?'Dziś · ':''}${DOW_SHORT[parseISO(s.iso).getDay()]} ${prDD(s.iso)}</div><div><b>${prSetsText(K,s.sets)}</b></div>
      <div class="m">${ehMetrics(K).filter(([k])=>k!==EH.metric).map(([k,l])=>l+': '+val(k)).join(' · ')}</div>
      ${s.prs.length?`<div class="b" style="display:flex;gap:4px;flex-wrap:wrap;margin-top:2px">${chips(s.prs)}</div>`:''}</div>
    <div class="eh-tiles">${tiles.map(([l,v,iso])=>`<div><span>${l}</span><b>${v}</b><small>${iso?(l==='Treningi'?'od '+prDD(iso):prDD(iso)):''}</small></div>`).join('')}</div>
    ${reps}
    <div class="eh-sec">Treningi</div>
    ${shown.map(x=>`<div class="eh-s"><div class="d">${prDD(x.iso)}</div><div class="t">${prSetsText(K,x.sets)}${p3&&x.iso===p3.iso?'<small>początek fazy 3 · −10%</small>':''}${x.full?'':'<small>niepełny trening</small>'}</div><div class="b">${chips(x.prs)}</div></div>`).join('')}
    ${list.length>6?`<button class="eh-more" data-eall>${EH.all?'Pokaż mniej':'Pokaż wszystkie ('+list.length+')'}</button>`:''}
    <details class="eh-how"><summary>Jak liczymy rekordy?</summary><ul>
      <li>Liczą się tylko odhaczone serie. Pominięte ćwiczenia nie wchodzą do historii.</li>
      <li>Pierwszy trening ćwiczenia to punkt startowy, a nie rekord.</li>
      <li>1RM to szacunek wzorem Epleya z serii do 12 powtórzeń. Nie musisz go nigdy dźwigać.</li>
      <li>Rekord objętości liczy się tylko wtedy, gdy zrobisz wszystkie serie z planu.</li>
      <li>Po wymianie ćwiczenia przez Trenera historia idzie pod nową nazwą, tak jak podpowiedzi „Ostatnio”.</li>
    </ul></details>`;
}

export function recSpark(h,an){
  const ys=an.map(s=>h.kind==='kg'?(s.m.e1||s.m.top):s.m.top), lo=Math.min(...ys), hi=Math.max(...ys), n=ys.length;
  if(n<2) return '<svg viewBox="0 0 92 36" aria-hidden="true"></svg>';
  const pts=ys.map((y,i)=>[(i/(n-1))*88+2, 32-((y-lo)/((hi-lo)||1))*28]), l=pts[n-1];
  return `<svg viewBox="0 0 92 36" aria-hidden="true"><polyline points="${pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')}" fill="none" stroke="var(--amber)" stroke-width="2" stroke-linejoin="round"/><circle cx="${l[0]}" cy="${l[1]}" r="3" fill="var(--amber)"/></svg>`;
}

export function renderRecords(){
  const box=document.getElementById('recList'); if(!box) return;
  const wk=addDays(todayISO(),-7);
  const rows=Object.values(exIndex()).map(h=>{ const an=prAnalyze(h); return {h, an, b:prBest(h.kind,an), lp:[...an].reverse().find(s=>s.prs.length)}; })
    .sort((a,c)=>(c.lp?c.lp.iso:'').localeCompare(a.lp?a.lp.iso:'') || c.an.length-a.an.length);
  const fresh=rows.filter(r=>r.lp && r.lp.iso>wk).length;
  document.getElementById('recSide').textContent=fresh?fresh+' z nowym rekordem w tym tygodniu':'';
  if(!rows.length){ box.innerHTML='<div class="rec-empty">Tu pojawią się Twoje najlepsze wyniki. Odhaczaj serie na treningach — rekordy liczą się od drugiego treningu danego ćwiczenia.</div>'; return; }
  const shown=recAll?rows:rows.slice(0,6);
  box.innerHTML=shown.map(({h,an,b,lp})=>{
    const sub=h.kind==='kg'?(b.e1.m.e1?'1RM ≈ '+prE1(b.e1.m.e1)+' kg · ':'')+prDD(b.top.iso):(h.kind==='time'?'najdłużej · ':'najlepsza seria · ')+prDD(b.top.iso);
    return `<button class="reccard" data-hist="${encodeURIComponent(h.n)}"><div class="nm"><span>${esc(h.n)}</span>${lp&&lp.iso>wk?'<span class="rec-new">Nowy</span>':''}</div>
      <div class="v">${prTopText(h.kind,b.top)}</div>${recSpark(h,an)}<div class="s">${sub}</div></button>`;
  }).join('')+(rows.length>6?`<button class="eh-more" id="recMore">${recAll?'Pokaż mniej':'Pokaż wszystkie ('+rows.length+')'}</button>`:'');
  box.querySelectorAll('[data-hist]').forEach(x=>x.onclick=()=>openExHist(decodeURIComponent(x.dataset.hist)));
  const m=document.getElementById('recMore'); if(m) m.onclick=()=>{ recAll=!recAll; renderRecords(); };
}

export function __init_23(){
/* ---- historia ćwiczeń i rekordy ----
   Liczą się tylko odhaczone serie (jak w „Ostatnio”), pod nazwą po wymianie od Trenera.
   Pierwszy trening ćwiczenia to punkt startowy, nie rekord. 1RM szacujemy wzorem Epleya z serii do 12 powtórzeń.
   Rekord objętości tylko przy wszystkich seriach z planu. Funkcje (nie const), bo karta renderuje się przed tą częścią skryptu. */
exIdxCache = null;
IC_HIST = '<svg viewBox="0 0 24 24"><path d="M4 19h16"/><path d="M5 15l4-4 3 3 6-7"/><path d="M15 7h3v3"/></svg>';

/* arkusz historii */
EH = {n:null, metric:'top', sel:null, all:false};
document.getElementById('exHist').addEventListener('click',e=>{
  const t=e.target.closest('[data-ehclose],[data-emetric],[data-ept],[data-eall]'); if(!t) return;
  if('ehclose' in t.dataset) closeExHist();
  else if(t.dataset.emetric){ EH.metric=t.dataset.emetric; renderExHist(); }
  else if(t.dataset.ept!=null){ EH.sel=+t.dataset.ept; renderExHist(); }
  else { EH.all=!EH.all; renderExHist(); }
});
document.addEventListener('keydown',e=>{ if(e.key==='Escape' && document.getElementById('exHist').style.display==='flex') closeExHist(); });

/* Postęp → Rekordy: najświeższe rekordy na górze */
recAll = false;
}
