// ŻELAZO — Ekran dnia: trening, przesunięcia, zmiany od Trenera, progresja, serie, timery ćwiczeń na czas.
// Moduł zawiera tylko deklaracje; kod startowy jest w __init_N, wywoływanych przez main.js w stałej kolejności.
import { __set_viewOffset, dayIndexFor, viewDateISO, viewOffset, weekOf } from '../core/backup';
import { S, save } from '../core/state';
import { protFloor, renderMeals, scaleFactors } from '../diet/scaling';
import { ciChip, ciLight, ciStartOrAsk, openCheckin } from '../features/checkin';
import { CYC, __set_CYC, cyMoveHtml, cyRenderBox } from '../features/cycle';
import { openRestList } from '../features/rest';
import { openSwap, swapAlts, swapNote, swapSplit, swapUndo } from '../features/swap';
import { addDays, parseISO, todayISO } from '../lib/dates';
import { mark, touch } from '../lib/state';
import { COOK, DEFAULT_KCAL, DIET, REST, SHOP_DAY, autoVariant, mealComputed, phaseInfo, planSrc, variantBase, workoutOn } from '../plan/data';
import { esc } from './accounts';
import { openGuide } from './guide';
import { __set_exIdxCache, exHistBtn, exIdxCache, openExHist } from './history';
import { renderMealHabits } from './meals';
import { showView } from './more';
import { renderHabits, renderWater } from './steps';
import { updateStreak } from './streak';
import { WO, fmtDur, hasSession, startToday, woCanReset, woRebuildSession, woResetAsk, woStart, woStartLabel } from './workout';
import { dayNames, dayShort, dec, monthShort, plural, t } from '../lib/i18n';

export let DOW_PL, MON_PL, DOW_SHORT, dmy, dowOf, wIcon, mvUndoState, mvToastTimer, PLAN_REF_KG, isLowerEx, TMR, tmrTick, tmrAudio, tmrWake, TMR_PLAY, TMR_PAUSE, TMR_RESET;
export function __set_tmrAudio(v){ tmrAudio=v; return v; }

export function log(iso){ if(!S.log[iso]) S.log[iso]={meals:{},ex:{},habits:{},water:0}; return S.log[iso]; }

// postęp dnia do paska dnia i kropek na zakładkach
export function daySummary(iso){
  const di=dayIndexFor(iso), L=S.log[iso]||{meals:{},ex:{}};
  // posiłek z planu zastąpiony własnym („Zamień”) też jest zjedzony
  const rep=new Set((L.custom||[]).filter(c=>c.rep && !c._del && c.done!==false).map(c=>c.rep));
  const meals=Object.entries(L.meals||{}).filter(([k,v])=>v && !rep.has(k)).length+rep.size;
  let w = (di>=1&&di<=168) ? workoutOn(iso) : REST;
  if(di===0) w=COOK; else if(di===-1) w=SHOP_DAY;
  if(w.type==='cardio'){ const d=!!(L.ex&&L.ex[iso+'_cardio']); return {train:'cardio '+(d?'✓':'<b>0/1</b>'), trainDone:d?1:0, trainAll:1, meals}; }
  if(w.type!=='lift') return {train:di<1?t('przed startem'):t('odpoczynek'), trainDone:0, trainAll:0, meals};
  const done=w.ex.filter((e0,i)=>okCount(L.ex&&L.ex[iso+'_e'+i], effEx(e0,iso).s)===effEx(e0,iso).s).length;
  return {train:t('trening')+' <b>'+done+'/'+w.ex.length+'</b>', trainDone:done, trainAll:w.ex.length, meals};
}

// karta „Gdzie jesteś w planie” w Postępie — zawsze dla dzisiejszego dnia
export function renderPhaseCard(){
  const dayIdx=dayIndexFor(todayISO()), wk=weekOf(dayIdx);
  // kolor fazy na karcie (pasek z lewej i nazwa fazy); poza planem — akcent
  const card=document.querySelector('.phasebar .card') as HTMLElement|null;
  if(card){ if(dayIdx>=1&&dayIdx<=168) card.dataset.ph=String(phaseInfo(wk).n); else delete card.dataset.ph; }
  if(dayIdx<1){
    const stD=parseISO(S.startDate);
    document.getElementById('dayNum').textContent = dayIdx===0?'🍳':(dayIdx===-1?'🛒':'—');
    document.getElementById('phaseWeek').textContent = t(dayIdx===0?'jutro start':(dayIdx===-1?'pojutrze start':'przed startem'));
    document.getElementById('phaseName').textContent = dayIdx===0?t('Dziś gotujesz — przygotowanie'):(dayIdx===-1?t('Dziś zakupy — przygotowanie'):t('Plan startuje {d}', {d:stD.getDate()+' '+MON_PL[stD.getMonth()]}));
    document.getElementById('phaseBar').style.width='0%';
  } else if(dayIdx>168){
    document.getElementById('dayNum').textContent='✓';
    document.getElementById('phaseWeek').textContent=t('ukończono');
    document.getElementById('phaseName').textContent=t('6 miesięcy za Tobą — brawo!');
    document.getElementById('phaseBar').style.width='100%';
  } else {
    document.getElementById('dayNum').textContent=String(dayIdx);
    document.getElementById('phaseWeek').textContent=t('tydzień {n}/24', {n:wk});
    document.getElementById('phaseName').textContent=t(phaseInfo(wk).name);
    document.getElementById('phaseBar').style.width=(dayIdx/168*100)+'%';
  }
}

// czy w danym dniu coś już odhaczono (wtedy nie przesuwamy)
export function dayStarted(iso){ const L=S.log[iso]; return !!(L && Object.values(L.ex||{}).some(exAny)); }

export function canMove(iso, w, L){
  const di=dayIndexFor(iso);
  return di>=1 && di<=168 && iso>=todayISO() && (w.type==='lift'||w.type==='cardio') && !dayStarted(iso);
}

export function movedBar(iso){
  const from=planSrc(iso); if(from===iso) return '';
  return `<div class="moved-bar"><span>${t('↪ Z planu na {d}', {d:dowOf(from)+' '+dmy(from)})}</span><button data-restore="${iso}">${t('Przywróć')}</button></div>`;
}

// nowe przypisania: map[dzień] = dzień, którego OBECNY trening ma się tu odbyć
export function nextMoves(map){
  const cur=(S.adj&&S.adj.moves)||{}, next=Object.assign({}, cur);
  Object.entries(map).forEach(([day, from])=>{ next[day]=cur[from]||from; });
  Object.keys(next).forEach(k=>{ if(next[k]===k) delete next[k]; });
  return next;
}

export function setMoves(next, msg){
  S.adj=S.adj||{};
  mvUndoState=JSON.stringify(S.adj.moves||{});
  S.adj.moves=next; S._settingsM=Date.now(); save(); renderToday();
  const t=document.getElementById('mvToast'); document.getElementById('mvToastTxt').textContent=msg; t.style.display='flex';
  clearTimeout(mvToastTimer); mvToastTimer=setTimeout(()=>{ t.style.display='none'; }, 6000);
}

// „Przywróć”: wraca cała grupa dni, które wymieniły się treningami (para albo np. 3 dni od Trenera)
export function restoreGroup(iso){
  const next=Object.assign({}, (S.adj&&S.adj.moves)||{}); let k=iso, n=0;
  while(next[k] && n++<14){ const f=next[k]; delete next[k]; k=f; }
  setMoves(next, t('Przywrócono plan z kalendarza'));
}

export function openMove(src){
  const w=workoutOn(src), today=todayISO();
  document.getElementById('mvSub').innerHTML=t('<b>{w}</b> z dnia {d}. Wybierz dzień:', {w:esc(t(w.title)), d:dowOf(src)+' '+dmy(src)});
  let h='';
  for(let i=0;i<=7;i++){
    const k=addDays(today,i), di=dayIndexFor(k); if(k===src || di<1 || di>168) continue;
    const q=workoutOn(k), swap=q.type!=='rest', started=dayStarted(k);
    // podpowiedź: siłownia dzień obok
    const nb=[addDays(k,-1), addDays(k,1)].filter(x=>x!==src).some(x=>workoutOn(x).type==='lift');
    const warn= w.type==='lift' && nb ? '<span class="warn">'+t('⚠ Siłownia dzień obok — mniej regeneracji')+'</span>' : '';
    h+=`<button class="mv-opt" data-to="${k}" ${started?'disabled style="opacity:.45"':''}>
      <span class="when"><b>${dowOf(k)} ${dmy(k)}</b><small>${i===0?t('dziś'):i===1?t('jutro'):t('za {n} dni', {n:i})}</small></span>
      <span class="what">${wIcon(q)} ${esc(t(q.title))}${swap?`<small>${t('przejdzie na {d}', {d:dowOf(src)+' '+dmy(src)})}</small>`:''}${started?'<small>'+t('ten dzień jest już zaczęty')+'</small>':''}${warn}</span>
      <span class="act ${swap?'swap':'move'}">${swap?t('ZAMIEŃ'):t('PRZESUŃ')}</span></button>`;
  }
  const list=document.getElementById('mvList'); list.innerHTML=h||'<div class="md-hint">'+t('Brak dni, na które można przesunąć.')+'</div>';
  list.querySelectorAll('[data-to]').forEach(b=>b.onclick=()=>{
    const to=b.dataset.to, swap=workoutOn(to).type!=='rest';
    document.getElementById('moveDialog').classList.remove('show');
    setMoves(nextMoves({[to]:src, [src]:to}), (swap?t('Zamieniono'):t('Przesunięto'))+`: ${dowOf(src)} ${dmy(src)} → ${dowOf(to)} ${dmy(to)}`);
    __set_viewOffset(Math.round((+parseISO(to) - +parseISO(today))/864e5)); renderToday();
  });
  document.getElementById('moveDialog').classList.add('show');
}

export function bindMoveUi(card){
  card.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>openMove(b.dataset.move));
  card.querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>restoreGroup(b.dataset.restore));
}

// pasek tygodnia (pon–nd tygodnia oglądanego dnia)
export function renderWeekStrip(iso){
  const d=parseISO(iso), mon=addDays(iso, -((d.getDay()+6)%7)), today=todayISO();
  let h='';
  for(let i=0;i<7;i++){
    const k=addDays(mon,i), di=dayIndexFor(k), w=(di>=1&&di<=168)?workoutOn(k):null;
    const L=S.log[k], done=!!(L && Object.values(L.ex||{}).some(exAny));
    h+=`<button class="wd ${k===today?'today':''} ${k===iso?'sel':''} ${k<today?'past':''}" data-wd="${k}" aria-label="${DOW_PL[parseISO(k).getDay()]} ${dmy(k)}${w?': '+t(w.title):''}">
      ${planSrc(k)!==k?'<span class="mv">↪</span>':''}${done?'<span class="ok">✓</span>':''}
      <span class="n">${dowOf(k)}</span><span class="ic">${w?wIcon(w):'·'}</span><span class="dt">${parseISO(k).getDate()}</span></button>`;
  }
  const box=document.getElementById('weekStrip'); box.innerHTML=h;
  box.querySelectorAll('[data-wd]').forEach(b=>b.onclick=()=>{ __set_viewOffset(Math.round((+parseISO(b.dataset.wd) - +parseISO(today))/864e5)); renderToday(); });
}

export function renderToday(){
  __set_exIdxCache(null); __set_CYC(null);   // dane mogły przyjść z synchronizacji
  const iso=viewDateISO();
  const dObj=parseISO(iso);
  const dow=dObj.getDay();
  const dayIdx=dayIndexFor(iso);
  const wk=weekOf(dayIdx);
  const L=log(iso);

  // pasek dnia: dzień tygodnia + podsumowanie dnia (trening, posiłki)
  document.getElementById('dowName').innerHTML = DOW_PL[dow] + (viewOffset===0?' <span class="today-pill">'+t('DZIŚ')+'</span>':'');
  const ds=daySummary(iso);
  document.getElementById('dateLabel').innerHTML = dObj.getDate()+' '+MON_PL[dObj.getMonth()]+' · '+ds.train+' · '+t('posiłki')+' <b>'+ds.meals+'/4</b>';
  const mid=document.getElementById('dayMid');
  mid.textContent = viewOffset===0 ? t('DZIŚ') : t('↩ DZIŚ');
  mid.setAttribute('aria-label', viewOffset===0 ? t('Dzisiaj') : t('Wróć do dzisiaj'));
  mid.classList.toggle('away', viewOffset!==0);
  document.getElementById('dotTrain').className='nav-dot'+(ds.trainAll?(ds.trainDone>=ds.trainAll?' ok':' todo'):'');
  document.getElementById('dotDiet').className='nav-dot'+(ds.meals>=4?' ok':' todo');

  // faza: krótka linia w Treningu (oglądany dzień), karta w Postępie (dziś)
  document.getElementById('phaseLine').textContent = dayIdx<1 ? t('Przed startem planu') : dayIdx>168 ? t('Plan ukończony') : t(phaseInfo(wk).name)+' · '+t('tydzień {n}/24', {n:wk});
  renderPhaseCard();
  renderWeekStrip(iso);

  // ---- workout ----
  renderWorkout(iso, wk, dow, dayIdx, L);
  cyRenderBox(iso);
  // ---- meals ----
  renderMeals(iso, dow, L, wk);
  renderMealHabits();
  // ---- habits ----
  renderHabits(iso, dow, L);
  // ---- water ----
  renderWater(iso, L);

  updateStreak();
}

/* ---- zmiany planu zaakceptowane od Trenera ----
   S.adj.ex[nazwa] = [{from, w, s, rp}] — obowiązuje najnowszy wpis z from <= dzień; starsze dni bez zmian.
   S.adj.log = [{at, from, summary, ex:[...], kcal, prevKcal}] — historia, do cofnięcia. */
export function exAdj(name, iso){
  const list=S.adj&&S.adj.ex&&S.adj.ex[name]; if(!list) return null;
  let r=null; list.forEach(x=>{ if(x.from<=iso && (!x.to || x.to>=iso) && (!r || x.from>=r.from)) r=x; }); return r;   // to: zamiana tylko na jeden dzień
}

// wymiana (swap) zapisana pod starą nazwą; późniejsze korekty nowego ćwiczenia — pod nową nazwą
export function effEx(e, iso){
  let cur=e, a=exAdj(e.n, iso), guard=0;
  while(a && guard++<3){
    if(a.swap){
      cur=Object.assign({}, cur, {n:a.swap.n, s:a.s, rp:a.rp, r:a.r||String(a.rp), w:a.w||0, start:a.w>0?a.w+' kg'+(a.ph?'/rękę':''):'dobierz (RIR 2)', _adj:a, _from:cur._from||cur.n});
      const b=exAdj(cur.n, iso); a=(b && b!==a && b.from>=a.from) ? b : null;
    } else {
      cur=Object.assign({}, cur, {s:a.s, rp:a.rp, r:String(a.rp), w:a.w>0?a.w:cur.w, _adj:a}); a=null;
    }
  }
  // check-in „mocne zmęczenie”: dziś jedna seria mniej (minimum 2)
  const ci=S.log && S.log[iso] && S.log[iso].checkin;
  if(ci && ci.plan==='light2' && cur.s>2) cur=Object.assign({}, cur, {s:cur.s-1, _light:true});
  return cur;
}

export function swapCue(name){
  const ex=(S.adj&&S.adj.ex)||{};
  for(const k in ex) for(const x of ex[k]) if(x.swap && x.swap.n===name && x.swap.cue) return x.swap.cue;
  return '';
}

/* ---- posiłki od Trenera: S.adj.meals=[{from, posilek, dni, opis, kcal, b, w, t, id}] ---- */
export function mealAdj(iso, dow, tag){
  let r=null;
  ((S.adj&&S.adj.meals)||[]).forEach(m=>{ if(m.from<=iso && m.posilek===tag && (!m.dni.length||m.dni.includes(dow)) && (!r||m.from>=r.from)) r=m; });
  return r;
}

// posiłki dnia: podmienione stoją z wartościami od Trenera, reszta skaluje się do (cel − podmienione)
export function dayMeals(iso, dow, L, wk, goalOverride?){
  const diet=DIET[dow], goal=goalOverride||S.kcalGoal||DEFAULT_KCAL;
  const slots=diet.meals.map((slot,i)=>({slot, i, vi:variantIndex(L,i,wk), adj:mealAdj(iso,dow,slot.tag)}));
  let bk=0, bp=0, fixed=0, fixedP=0;
  slots.forEach(x=>{ if(x.adj){ fixed+=x.adj.kcal; fixedP+=x.adj.b||0; return; } const b=variantBase(x.slot.v[x.vi]); bk+=b.kcal; bp+=b.p; });
  const f=scaleFactors(Math.max(0,goal-fixed), {kcal:bk, p:bp}, fixed?Math.max(0,protFloor()-fixedP):undefined);
  slots.forEach(x=>{ x.mc = x.adj ? {txt:esc(x.adj.opis), kcal:x.adj.kcal, p:x.adj.b, c:x.adj.w, f:x.adj.t} : mealComputed(x.slot.v[x.vi], f); });
  return slots;
}

// suma dnia jak w Diecie: odhaczone posiłki z planu (bez zastąpionych) + własne; goal = cel kalorii tego dnia
export function dayTotals(iso, goal){
  const L=S.log[iso], tot={kcal:0,p:0,c:0,f:0}; if(!L) return tot;
  const add=x=>{ tot.kcal+=+x.kcal||0; tot.p+=+x.p||0; tot.c+=+x.c||0; tot.f+=+x.f||0; };
  const own=(L.custom||[]).filter(c=>!c._del && c.done!==false), rep=new Set(own.map(c=>c.rep).filter(Boolean));
  const dow=parseISO(iso).getDay();
  if(DIET[dow]) dayMeals(iso, dow, L, weekOf(dayIndexFor(iso)), goal).forEach((x,i)=>{ if(L.meals&&L.meals['m'+i]&&!rep.has('m'+i)) add(x.mc); });
  own.forEach(add);
  return tot;
}

/* ---- progresja: ostatnia sesja tego samego ćwiczenia (po nazwie, także z poprzedniej fazy) ---- */
export function prevSession(exName, iso){
  const d=parseISO(iso);
  for(let back=1; back<=42; back++){
    d.setDate(d.getDate()-1);
    const p=todayISO(d), di=dayIndexFor(p);
    if(di<1) break;
    const w=workoutOn(p);
    if(!w || w.type!=='lift') continue;
    const exs=w.ex.map(x=>effEx(x,p));   // po wymianie ćwiczenia historia idzie pod nową nazwą
    const idx=exs.findIndex(x=>x.n.trim()===exName.trim());
    if(idx<0) continue;
    const r=S.log[p] && S.log[p].ex && S.log[p].ex[p+'_e'+idx];
    if(!r || !r.sets || r.skip) continue;   // pominięte nie liczy się do progresji
    const sets=[], sp=swapSplit(exs[idx], p);
    for(let s=1; s<=exs[idx].s; s++){
      if(sp && s<sp.fromSet) continue;
      const kg=parseFloat(r.sets['w'+s]), rp=parseFloat(r.sets['r'+s]);
      if(rp>0 && setOk(r,s)) sets.push({kg:kg>0?kg:0, rp});   // tylko serie odhaczone
    }
    if(sets.length) return {iso:p, sets, phase3:!!w.phase3};
  }
  return null;
}

export function progStep(e){
  if(/kettlebell/i.test(e.n+e.start)) return 4;
  if(/\/rękę|\/stronę|hantl/i.test(e.start+e.n)) return 2;
  if(/przysiad|martwy|RDL|suwnic|nóg|łydk|wspięcia|wypady|hack/i.test(e.n)) return 5;
  return 2.5;
}

export function strengthFactor(e){
  const p=S.profile||{};
  if(!(p.weight>=35)) return 1;
  let f=Math.pow(p.weight/PLAN_REF_KG,0.67);
  if(p.sex==='f') f*=isLowerEx(e)?0.7:0.55;
  if(p.age>=55) f*=0.9;
  // ±7% od profilu, pod który pisano plan — zostaw liczby z planu
  return (f>0.93&&f<1.07)?1:f;
}

export function roundLoad(e, kg){
  const t=e.n+' '+(e.start||'');
  let step=2.5, min=2.5;
  // kolejność ma znaczenie: „/rękę” w starcie > maszyna > „hantl” w nazwie (np. „Przysiad z hantlami / Hack” = Hack)
  if(/\/rękę|\/stronę/i.test(e.start||'')){ step=kg<10?1:2; min=1; }
  else if(/kettlebell/i.test(t)){ step=4; min=4; }
  else if(/suwnic|hack|maszyn|siedząc/i.test(t)){ step=5; min=5; }
  else if(/hantl/i.test(t)){ step=kg<10?1:2; min=1; }
  else if(/przysiad ze sztangą|ławka płaska|w opadzie|żołnierskie|martwy|RDL/i.test(t)){ min=20; }   // pusta sztanga
  else if(/sztang/i.test(t)){ min=10; }   // gryf łamany / lżejsza sztanga
  else if(/wyciąg|drążk|bramie|allahy/i.test(t)){ min=5; }
  return Math.max(min, Math.round(kg/step)*step);
}

export function scaledStart(e){
  if(!(e.w>0)) return e.w||0;
  const f=strengthFactor(e);
  return f===1 ? e.w : roundLoad(e, e.w*f);
}

export function startLabel(e){
  if(!e.start) return '';
  const f=strengthFactor(e);
  if(f===1 || !(e.w>0)) return t(e.start);
  const kg=scaledStart(e);
  // podmień liczbę planu na dopasowaną, zostaw dopiski typu „/rękę”, „(Hack)”
  return t(e.start).replace(/\d+(?:[.,]\d+)?(?=\s*kg)/, dec(kg))+t(' · dopasowane do Ciebie');
}

// zwraca {kg: ciężar do wpisania w pola, hint: tekst podpowiedzi}
export function progressionFor(e, iso, targetR, phase3){
  const prev=prevSession(e.n, iso);
  if(!prev) return null;
  const fmt=x=>dec(Math.round(x*2)/2);
  const lastKg=Math.max(...prev.sets.map(s=>s.kg));
  const when=prev.iso.slice(8,10)+'.'+prev.iso.slice(5,7);
  const was=prev.sets.map(s=>(s.kg?fmt(s.kg)+'×':'')+s.rp).join(', ')+(prev.sets.length<e.s?' '+t('({a} z {b} serii)', {a:prev.sets.length, b:e.s}):'');
  const allHit=prev.sets.length>=e.s && prev.sets.every(s=>s.rp>=targetR);
  if(phase3 && !prev.phase3 && lastKg>0){
    const kg=Math.round(lastKg*0.9*2)/2;
    return {kg, hint:t('Ostatnio ({d}): {was}. Faza 3: start od {kg} kg (−10%), celuj w {r} powt.', {d:when, was, kg:fmt(kg), r:targetR})};
  }
  if(!lastKg){
    return {kg:0, hint:t('Ostatnio ({d}): {was}.', {d:when, was})+(allHit?t(' Pełny zakres — dodaj 1–2 powtórzenia albo obciążenie.'):'')};
  }
  if(allHit){
    const next=lastKg+progStep(e);
    return {kg:lastKg, up:true, hint:t('Ostatnio ({d}): {was}. Pełny zakres ✅ — dziś spróbuj {kg} kg (wpisz w pola).', {d:when, was, kg:fmt(next)})};
  }
  return {kg:lastKg, hint:t('Ostatnio ({d}): {was}. Zostań przy {kg} kg i celuj w {r} powt. w każdej serii.', {d:when, was, kg:fmt(lastKg), r:targetR})};
}

/* ---- serie odhaczane pojedynczo: L.ex[k].ok = {1:true, 3:true}; done = wszystkie serie odhaczone ----
   stare wpisy bez „ok”: zaliczone ćwiczenie = wszystkie serie, inaczej liczą się zapisane serie (jak dotąd) */
export function setOk(r, s){
  if(!r || typeof r!=='object') return false;
  if(r.done) return true;
  if(r.ok) return !!r.ok[s];
  return !!(r.sets && r.sets['r'+s]!==undefined && r.sets['r'+s]!=='');
}

export function okCount(r, n){ let c=0; for(let s=1;s<=n;s++) if(setOk(r,s)) c++; return c; }

export function exAny(v){ return v===true || !!(v && (v.done || (v.ok && Object.values(v.ok).some(Boolean)))); }

// wpis ćwiczenia z jawną mapą „ok” (stary wpis przepisany tak, jak był liczony)
export function exRec(L, k, n){
  let r=L.ex[k];
  if(!r || typeof r!=='object') r=L.ex[k]={done:false,sets:{}};
  if(!r.sets) r.sets={};
  if(!r.ok){ r.ok={}; for(let s=1;s<=n;s++) if(setOk(r,s)) r.ok[s]=true; }
  return r;
}

// odhacz / cofnij serię s; przy odhaczeniu utrwal to, co widać w polach (rVal — czas z timera)
export function exTick(L, k, n, s, on, rVal?){
  const r=exRec(L,k,n);
  if(on){
    ['w','r'].forEach(f=>{ const inp=document.querySelector(`.set input[data-k="${k}"][data-s="${f}${s}"]`); if(inp && inp.value!=='') r.sets[f+s]=inp.value; });
    if(rVal!==undefined) r.sets['r'+s]=String(rVal);
    r.ok[s]=true;
    r.skip=false; mark(L,'skip:'+k);   // odhaczenie na innym urządzeniu wygrywa ze starszym „Pomiń”
  } else delete r.ok[s];
  r.done=false; r.done=okCount(r,n)===n;
  mark(L,'ok:'+k+':'+s); mark(L,'ex:'+k);
}

/* ---- timer ćwiczeń na czas: „40 s”, „30 s/stronę” (lewa + prawa), „max czas” (stoper w górę) ---- */
export function timedSpec(e, e0){
  const txt=((e._adj && !e._adj.swap) ? e0.r : e.r)||'';   // korekta Trenera zapisuje r jako samą liczbę — rodzaj bierzemy z planu
  const m=/(\d+)\s*s\b/.exec(txt);
  if(m) return {secs:(e._adj&&e.rp>0)?e.rp:+m[1], sides:/stron/.test(txt)?2:1, up:false};
  if(/czas/.test(txt)) return {secs:0, sides:1, up:true};
  return null;
}

export function fmtSec(t, up?){ t=Math.max(0, up?Math.floor(t):Math.ceil(t)); return Math.floor(t/60)+':'+String(t%60).padStart(2,'0'); }

export function tmrBeep(f, d){
  try{ const a=tmrAudio; if(!a) return; const o=a.createOscillator(), g=a.createGain();
    o.frequency.value=f; o.connect(g); g.connect(a.destination);
    g.gain.setValueAtTime(.25,a.currentTime); g.gain.exponentialRampToValueAtTime(.001,a.currentTime+d);
    o.start(); o.stop(a.currentTime+d); }catch(e){}
}

export function tmrBuzz(p){ try{ navigator.vibrate && navigator.vibrate(p); }catch(e){} }

// stan dla ćwiczenia; bieżąca seria = pierwsza nieodhaczona
export function tmrState(key, spec, n, r, iso){
  let first=1; while(first<=n && setOk(r,first)) first++;
  let t=TMR[key];
  if(!t || t.secs!==spec.secs || t.n!==n) t=TMR[key]=Object.assign({}, spec, {n, iso, set:first, side:1, left:spec.secs, el:0, run:false});
  else if(!t.run && t.set!==first){ t.set=first; t.side=1; t.left=t.secs; t.el=0; }
  return t;
}

export function tmrBox(key){ return document.querySelector(`.tmr[data-tmr="${key}"]`); }

export function tmrPaint(key){
  const tm=TMR[key], box=tmrBox(key); if(!tm||!box) return;
  const all=tm.set>tm.n;
  let lbl = all ? t('Wszystkie serie zrobione 💪') : t('Seria {a} z {b}', {a:tm.set, b:tm.n});
  if(!all && tm.sides>1) lbl+= tm.side===1?t(' · lewa strona'):t(' · prawa strona');
  if(!all && tm.up) lbl+=t(' · trzymaj, ile dasz radę');
  box.querySelector('.time').textContent = tm.up ? fmtSec(tm.el, true) : fmtSec(tm.left);
  box.querySelector('.lbl').textContent = lbl;
  box.querySelector('.bar').style.width = (tm.up||!tm.secs) ? '0' : ((1-tm.left/tm.secs)*100)+'%';
  const go=box.querySelector('.go'); go.innerHTML=tm.run?TMR_PAUSE:TMR_PLAY; go.setAttribute('aria-label', tm.run?t('Pauza'):t('Start'));
  box.classList.toggle('run', tm.run);
}

// koniec odliczania = bieżąca seria odhaczona z tym czasem
export function tmrFinish(key){
  const t=TMR[key]; t.run=false;
  tmrBeep(880,.35); setTimeout(()=>tmrBeep(1175,.5),180); tmrBuzz([200,100,200]);
  let secs=null;
  if(t.up){ secs=Math.round(t.el); t.el=0; }
  else if(t.sides>1 && t.side===1){ t.side=2; }
  else { secs=t.secs; t.side=1; }
  t.left=t.secs;
  if(secs!==null){ const L=log(t.iso); exTick(L, key, t.n, t.set, true, secs); touch(L); save(); renderToday(); }
  const box=tmrBox(key); if(box){ box.classList.remove('end'); void box.offsetWidth; box.classList.add('end'); }
  tmrPaint(key);
}

export function tmrStep(){
  const now=Date.now();
  Object.keys(TMR).forEach(key=>{
    const t=TMR[key]; if(!t.run) return;
    if(t.up) t.el=(now-t.startAt)/1000;
    else{
      const prev=Math.ceil(t.left); t.left=(t.endAt-now)/1000;
      if(t.left<=0){ t.left=0; tmrFinish(key); return; }
      if(Math.ceil(t.left)!==prev && t.left<=3) tmrBeep(660,.12);   // 3-2-1
    }
    tmrPaint(key);
  });
  tmrSync();
}

// jeden zegar dla wszystkich timerów; ekran nie gaśnie, dopóki coś odlicza
export function tmrSync(){
  const any=Object.values(TMR).some(t=>t.run);
  if(any && !tmrTick) tmrTick=setInterval(tmrStep,100);
  if(!any && tmrTick){ clearInterval(tmrTick); tmrTick=null; }
  if(any && !tmrWake && navigator.wakeLock){
    tmrWake=navigator.wakeLock.request('screen').then(w=>{ w.addEventListener('release',()=>{ tmrWake=null; }); return w; }).catch(()=>{ tmrWake=null; });
  }
  if(!any && tmrWake){ Promise.resolve(tmrWake).then(w=>w&&w.release()).catch(()=>{}); tmrWake=null; }
}

export function tmrGo(key){
  const t=TMR[key]; if(!t) return;
  try{ tmrAudio=tmrAudio||new (window.AudioContext||window.webkitAudioContext)(); tmrAudio.resume&&tmrAudio.resume(); }catch(e){}
  if(t.set>t.n){ t.set=1; t.side=1; t.left=t.secs; t.el=0; }   // po wszystkich seriach: odliczaj od nowa
  if(t.run){
    t.run=false;
    if(t.up){ t.el=(Date.now()-t.startAt)/1000; if(t.el>=1) tmrFinish(key); else t.el=0; }   // stoper: pauza kończy serię i zapisuje czas
    else t.left=Math.max(0,(t.endAt-Date.now())/1000);
  } else {
    t.run=true; const box=tmrBox(key); if(box) box.classList.remove('end');
    t.endAt=Date.now()+t.left*1000; t.startAt=Date.now()-t.el*1000; tmrBuzz(30);
  }
  tmrPaint(key); tmrSync();
}

export function tmrReset(key){
  const t=TMR[key]; if(!t) return;
  t.run=false; t.left=t.secs; t.el=0;
  const box=tmrBox(key); if(box) box.classList.remove('end');
  tmrPaint(key); tmrSync();
}

export function tmrDrop(key){ if(TMR[key]){ delete TMR[key]; tmrSync(); } }

export function timerHtml(key){
  return `<div class="tmr" data-tmr="${key}"><button class="go" aria-label="Start">${TMR_PLAY}</button>
    <div class="mid"><div class="time"></div><div class="lbl"></div></div>
    <button class="rst" aria-label="Reset">${TMR_RESET}</button><div class="bar"></div></div>`;
}

export function renderWorkout(iso, wk, dow, dayIdx, L){
  const card=document.getElementById('workoutCard');
  let w = (dayIdx>=1 && dayIdx<=168) ? workoutOn(iso) : REST;
  // weekend TUŻ PRZED startem: sobota = zakupy, niedziela = gotowanie (dzień -1 i 0)
  if(dayIdx===0) w=COOK;        // niedziela przed startem
  else if(dayIdx===-1) w=SHOP_DAY; // sobota przed startem

  const mvBar=movedBar(iso), mvBtn=canMove(iso, w, L) ? `<button class="move-btn" data-move="${iso}" aria-label="${t('Przesuń trening na inny dzień')}"><svg viewBox="0 0 24 24"><path d="M4 12h14M13 6l6 6-6 6"/></svg>${t('Przesuń')}</button>` : '';
  if(w.type==='rest'){
    card.innerHTML=`<div class="restday">${mvBar}
      <div class="ico">${w.ico||(w.active?'🚶':'😴')}</div>
      <h3>${t(w.title)}</h3>
      <p>${w.note?t(w.note):t('Dziś regenerujesz się. Mięśnie rosną w odpoczynku — śpij 7–8 h i pij wodę.')}</p>
      <button class="go-diet" data-go-diet>${t('Zobacz dietę na ten dzień →')}</button>
    </div>`;
    card.querySelector('[data-go-diet]').onclick=()=>showView('diet');
    bindMoveUi(card);
    return;
  }
  if(w.type==='cardio'){
    const done=!!L.ex[iso+'_cardio'];
    card.innerHTML=`${mvBar}
      <div class="wk-head"><span class="badge cardio">CARDIO</span><span class="t">${t(w.title)}</span>${mvBtn}</div>
      <div class="ex ${done?'done':''}">
        <div class="ex-sub" style="margin-left:0;font-size:13px;color:var(--ink-dim)">${t(w.note)}</div>
        <div class="ex-check" style="margin-left:0" data-cardio="1">
          <span class="mini ${done?'on':''}"><svg viewBox="0 0 24 24"><path d="M4 12l5 5L20 6"/></svg></span>
          <span>${done?t('Zrobione — dobra robota'):t('Odznacz po sesji')}</span>
        </div>
      </div>`;
    card.querySelector('[data-cardio]').onclick=()=>{L.ex[iso+'_cardio']=!L.ex[iso+'_cardio'];mark(L,'ex:'+iso+'_cardio');touch(L);save();renderToday()};
    bindMoveUi(card);
    return;
  }

  // lifting
  let badge = w.title.split(' ')[0]; // FBW / UPPER / LOWER
  let html=`${mvBar}<div class="wk-head"><span class="badge">${badge}</span><span class="t">${t(w.title)}</span>${mvBtn}</div>`;
  // tryb treningu: tylko dziś; po zapisanej sesji krótkie podsumowanie
  // stara sesja nadpisana przez „Wznów” (sprzed zapisywania listy serii): odtwórz cały trening z godzin odhaczenia
  if(hasSession(L) && !L.session.log && iso>=addDays(todayISO(),-7)){ const rs=woRebuildSession(iso); if(rs){ L.session=rs; touch(L); save(); } }
  if(L.checkin) html+=ciChip(L, iso);
  if(hasSession(L)) html+=`<div class="wo-saved">⏱ ${fmtDur(L.session.dur)} · ${t('praca')} ${fmtDur(L.session.work)} · ${t('przerwy śr.')} ${fmtDur(L.session.avgRest)}${L.session.avgRestPlan?' ('+t('plan')+' '+fmtDur(L.session.avgRestPlan)+')':''} · ${t('serie')} ${L.session.done}/${L.session.total}${L.session.paused-(L.session.gap||0)>0?' · '+t('pauzy')+' '+fmtDur(L.session.paused-(L.session.gap||0)):''}${L.session.parts>1?' · '+t('dokończony po przerwie')+' '+fmtDur(L.session.gap):''}${(L.session.prs||[]).length?' · 🏆 '+t('rekordy:')+' '+L.session.prs.length:''}</div>`;
  const allDone=w.ex.every((e0,i)=>okCount(L.ex[iso+'_e'+i], effEx(e0,iso).s)===effEx(e0,iso).s);
  // przyszły (do 7 dni) albo pominięty (ostatnie 7 dni, nic nieodhaczone) trening: zamień z dzisiejszym dniem i od razu zacznij
  const tdy=todayISO(), missed=iso<tdy;
  const nearby= missed ? iso>=addDays(tdy,-7) : (iso>tdy && iso<=addDays(tdy,7));
  if(nearby && dayIdx>=1 && !dayStarted(iso) && !dayStarted(tdy) && dayIndexFor(tdy)>=1){
    if(missed) html+=`<div class="wo-saved">${t('Ten trening nie został zrobiony. Możesz go odrobić dziś zamiast dzisiejszego planu ({w}).', {w:esc(t(workoutOn(tdy).title))})}</div>`;
    html+=`<button class="wo-start" data-wo-today><svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>${t('ZACZNIJ DZIŚ')}</button>`;
  }
  if(iso===todayISO() && !allDone && L.checkin && L.checkin.plan==='move') html+=cyMoveHtml();
  else if(iso===todayISO() && !allDone) html+=`<div class="wo-row"><button class="wo-start" data-wo-start><svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>${woStartLabel(iso,w,L)}</button>${woCanReset(iso,w,L)?`<button class="wo-reset" data-wo-reset aria-label="${t('Resetuj dzisiejszy trening')}"><svg viewBox="0 0 24 24"><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3.5 4v5h5"/></svg></button>`:''}</div>${hasSession(L)&&!(WO&&WO.iso===iso)?`<div class="wo-cont">${t('Czas liczy się dalej od {d} — przerwa do teraz się nie wlicza.', {d:fmtDur(L.session.dur)})}</div>`:''}`;
  w.ex.forEach((e0,i)=>{
    const e=effEx(e0, iso);   // zmiany od Trenera (zaakceptowane) obowiązują od swojej daty
    const key=iso+'_e'+i;
    const rec=L.ex[key];
    const nOk=okCount(rec, e.s), exDone=nOk===e.s;
    const exSkip=!exDone && !!(rec && rec.skip);
    const sets=(rec&&rec.sets)||{};
    let first=1; while(first<=e.s && setOk(rec,first)) first++;
    const ts=timedSpec(e, e0);
    const bw=!!ts && /masa ciała/.test(e.start||'') && !(e._adj && e._adj.w>0);   // na czas bez obciążenia: same sekundy
    // zalecane wartości (prefill). Faza 3: ciężar −10%, powtórzenia +3 (czas zostaje jak w planie)
    // ciężar od Trenera jest już dopasowany do osoby — nie skaluj go ponownie
    let recW = (e._adj && e._adj.w>0) ? e._adj.w : scaledStart(e), recR = e.rp||0;
    if(w.phase3 && !e._adj){ recW = Math.round((recW*0.9)*2)/2; if(!ts) recR = recR+3; }
    // z historii: ostatni faktyczny ciężar zamiast sztywnego startu z planu
    let prog=progressionFor(e, iso, recR, !!w.phase3 && !e._adj);
    if(e._adj){
      // dopóki nie ma sesji od dnia zmiany, obowiązuje to, co zaakceptowałeś od Trenera
      const prev=prevSession(e.n, iso);
      if(!prev || prev.iso < e._adj.from){
        const fmt=x=>dec(x), fd=e._adj.from.slice(8,10)+'.'+e._adj.from.slice(5,7);
        const who=e._adj.user?(e._adj.to?t('Zamiana na dziś'):t('Twoja zamiana (od {d})', {d:fd})):t('Trener (od {d})', {d:fd}), was=e._adj.was||e._from;
        prog={kg:e._adj.w, up:true, hint:`${who}${was?t(' zamiast „{x}”', {x:t(was)}):''}: ${e._adj.w>0?fmt(e._adj.w)+' kg'+(e._adj.ph?t('/rękę'):'')+' · ':''}${e.s}×${e.r==='max'?'max':e.rp}`};
      }
    }
    if(prog && prog.kg>0) recW=prog.kg;
    if(ciLight(L) && recW>0) recW=roundLoad(e, recW*0.9);   // lżejszy dzień z check-inu
    const recWtxt = recW>0 ? String(recW) : '';
    let setsHtml='';
    for(let s=1;s<=e.s;s++){
      // jeśli użytkownik coś zapisał — użyj tego; inaczej wstępnie wypełnij zaleceniem
      const savedW=sets['w'+s], savedR=sets['r'+s];
      const wv = (savedW!==undefined && savedW!=='') ? savedW : recWtxt;
      const rv = (savedR!==undefined && savedR!=='') ? savedR : (recR||'');
      const ok=setOk(rec,s), isCur=!exDone && s===first, st=ts?5:1;
      setsHtml+=`<div class="set-row ${ok?'ok':''} ${isCur?'cur':''}">
        <button class="set-chk" data-tick="${s}" aria-pressed="${ok}" aria-label="${ok?t('Seria {n} zrobiona — cofnij', {n:s}):t('Seria {n} zrobiona', {n:s})}"><svg viewBox="0 0 24 24"><path d="M4 12l5 5L20 6"/></svg></button>
        <div class="set">
          <span class="si">${s}</span>
          ${bw?'':`<input type="number" inputmode="decimal" placeholder="kg" value="${wv}" data-k="${key}" data-s="w${s}" aria-label="${t('Ciężar serii {n}', {n:s})}"><span class="u">kg</span>
          <span class="x">×</span>`}
          <input type="number" inputmode="numeric" placeholder="${ts?'s':t('powt')}" value="${rv}" data-k="${key}" data-s="r${s}" aria-label="${ts?t('Sekundy serii {n}', {n:s}):t('Powtórzenia serii {n}', {n:s})}"><span class="u">${ts?'s':t('p')}</span>
        </div>
        ${isCur?`<div class="set-step"><button data-step="${-st}" data-s="${s}" aria-label="${t('Mniej')}">−</button><button data-step="${st}" data-s="${s}" aria-label="${t('Więcej')}">+</button></div>`:''}
      </div>`;
    }
    if(ts && !exSkip) tmrState(key, ts, e.s, rec, iso);
    html+=`<div class="ex ${exDone?'done':''} ${exSkip?'skipped':''}" data-k="${key}" data-n="${e.s}">
      <div class="ex-top">
        <span class="num">${i+1}</span>
        <span class="nm">${t(e.n)}</span>
        ${!exDone && !exSkip && iso>=todayISO() && swapAlts(e.n).length?`<button class="show-btn sw-btn" data-swap="${i}" aria-label="${t('Zamień ćwiczenie')}">⇄</button>`:''}
        <button class="show-btn" data-guide="${encodeURIComponent(e.n)}">${t('Pokaż')}</button>
        <span class="scheme">${e.s}×${t(e.r)}</span>
      </div>
      ${exSkip?'':`${prog?`<div class="ex-sub" style="color:${prog.up?'var(--amber)':'var(--ink-dim)'}">${prog.up?'⬆ ':''}${prog.hint}</div>`
            :(e.start?`<div class="ex-sub">${t('Start:')} ${startLabel(e)}</div>`:'')}
      ${swapNote(e, iso, rec)}
      ${exHistBtn(e.n, iso)}
      ${ts && !exDone?timerHtml(key):''}
      <div class="sets per-set">${setsHtml}</div>`}
      <div class="ex-acts">
        ${exSkip?`<span class="ex-check">${t('Pominięte dziś')}</span>
        <button class="skip-btn" data-skip="${key}">${t('Cofnij')}</button>`
        :exDone?`<span class="ex-status">${t('✓ Ćwiczenie zaliczone')}</span>
        <button class="link-btn" data-untick="${key}">${t('Cofnij serie')}</button>`
        :`${nOk?`<span class="ex-count">${t('{a} z {b} serii', {a:nOk, b:e.s})}</span>`:''}
        <button class="all-btn" data-all="${key}">✓ ${nOk?t('Pozostałe {n} wg planu', {n:e.s-nOk}):t('Wszystkie serie wg planu')}</button>
        ${nOk?'':`<button class="skip-btn" data-skip="${key}">${t('Pomiń')}</button>`}`}
      </div>
    </div>`;
  });
  html+=`<button class="link-btn rest-link" data-rest-list>${t('⏱ Przerwy między seriami — Twoje ustawienia')}</button>`;
  // tip per phase
  if(w.phase3){
    html+=`<div class="tip"><span>⚡</span><div>${t('<b>Faza 3.</b> Zmniejsz ciężar o 10%, dodaj 2–4 powtórzenia. Po sztandze 20 min rowerka/orbitreka.')}</div></div>`;
  } else {
    html+=`<div class="tip"><span>⚡</span><div>${t('<b>RIR 2.</b> Dobierz ciężar tak, by zostały Ci ~2 powtórzenia w zapasie. Górny zakres pobity? Następnym razem +1–2.5 kg.')}</div></div>`;
  }
  card.innerHTML=html;
  bindMoveUi(card);
  const ws=card.querySelector('[data-wo-start]'); if(ws) ws.onclick=()=>ciStartOrAsk(iso);
  const cic=card.querySelector('[data-ci-edit]'); if(cic) cic.onclick=()=>openCheckin(iso, 'edit');
  const cyt=card.querySelector('[data-cytrain]'); if(cyt) cyt.onclick=()=>{ L.checkin=Object.assign({}, L.checkin, {plan:'normal', at:Date.now()}); touch(L); save(); renderToday(); woStart(iso); };
  const wr=card.querySelector('[data-wo-reset]'); if(wr) wr.onclick=()=>woResetAsk(iso);
  const wt=card.querySelector('[data-wo-today]'); if(wt) wt.onclick=()=>startToday(iso);
  card.querySelectorAll('[data-hist]').forEach(b=>b.onclick=()=>openExHist(decodeURIComponent(b.dataset.hist)));
  card.querySelectorAll('[data-swap]').forEach(b=>b.onclick=()=>openSwap(iso, +b.dataset.swap));
  card.querySelectorAll('[data-rest-list]').forEach(b=>b.onclick=()=>openRestList(iso));
  card.querySelectorAll('[data-swap-undo]').forEach(b=>b.onclick=()=>swapUndo(+b.dataset.swapUndo, iso));

  // bind inputs
  const exOf=el=>{ const x=el.closest('.ex'); return {k:x.dataset.k, n:+x.dataset.n}; };
  card.querySelectorAll('.set input').forEach(inp=>{
    inp.addEventListener('input',()=>{
      const {k,n}=exOf(inp), s=inp.dataset.s, r=exRec(L,k,n);
      r.sets[s]=inp.value;
      // ciężar przechodzi na nieodhaczone serie niżej
      if(s[0]==='w') for(let j=+s.slice(1)+1;j<=n;j++){
        if(r.ok[j]) continue;
        const el=card.querySelector(`.set input[data-k="${k}"][data-s="w${j}"]`);
        if(el){ el.value=inp.value; r.sets['w'+j]=inp.value; }
      }
      touch(L);save();
    });
  });
  card.querySelectorAll('[data-step]').forEach(b=>{
    b.onclick=()=>{
      const {k,n}=exOf(b), s=b.dataset.s, r=exRec(L,k,n);
      const inp=card.querySelector(`.set input[data-k="${k}"][data-s="r${s}"]`); if(!inp) return;
      inp.value=Math.max(0,(+inp.value||0)+(+b.dataset.step));
      r.sets['r'+s]=inp.value; touch(L);save();
    };
  });
  card.querySelectorAll('[data-tick]').forEach(b=>{
    b.onclick=()=>{
      const {k,n}=exOf(b), s=+b.dataset.tick, on=!setOk(L.ex[k],s);
      exTick(L,k,n,s,on); if(on) tmrBuzz(20);
      touch(L);save();renderToday();
    };
  });
  card.querySelectorAll('[data-all]').forEach(b=>{
    b.onclick=()=>{
      const {k,n}=exOf(b);
      for(let s=1;s<=n;s++) if(!setOk(L.ex[k],s)) exTick(L,k,n,s,true);
      tmrDrop(k); tmrBuzz(20);
      touch(L);save();renderToday();
    };
  });
  card.querySelectorAll('[data-untick]').forEach(b=>{
    b.onclick=()=>{
      const {k,n}=exOf(b);
      for(let s=1;s<=n;s++) exTick(L,k,n,s,false);
      touch(L);save();renderToday();
    };
  });
  card.querySelectorAll('.tmr').forEach(box=>{
    const k=box.dataset.tmr;
    box.querySelector('.go').onclick=()=>tmrGo(k);
    box.querySelector('.rst').onclick=()=>tmrReset(k);
    tmrPaint(k);
  });
  card.querySelectorAll('[data-skip]').forEach(el=>{
    el.onclick=()=>{
      const k=el.dataset.skip;
      if(!L.ex[k])L.ex[k]={done:false,sets:{}};
      L.ex[k].skip=!L.ex[k].skip;
      L.ex[k].done=false;
      tmrDrop(k);
      mark(L,'skip:'+k);mark(L,'ex:'+k);touch(L);save();renderToday();
    };
  });
  card.querySelectorAll('[data-guide]').forEach(el=>{
    el.onclick=(e)=>{e.stopPropagation();openGuide(decodeURIComponent(el.dataset.guide));};
  });
}

// który wariant posiłku jest aktywny danego dnia: override użytkownika albo auto wg tygodnia
export function variantIndex(L, mealIdx, wk){
  if(L.var && L.var[mealIdx]!==undefined) return L.var[mealIdx];
  const w = (wk>=1) ? wk : 1;
  return autoVariant(w);
}

export function __init_4(){

/* ============================================================
   RENDER — DZIŚ
   ============================================================ */
DOW_PL = dayNames();   // nazwy w języku aplikacji (zmienne mają historyczne nazwy)
MON_PL = monthShort();
/* ---- przesuwanie treningów ---- */
DOW_SHORT = dayShort();
dmy = iso=>iso.slice(8,10)+'.'+iso.slice(5,7);
dowOf = iso=>DOW_SHORT[parseISO(iso).getDay()];
wIcon = w=>w.type==='lift'?'🏋️':w.type==='cardio'?'🏃':(w.ico||(w.active?'🚶':'😴'));
mvUndoState = null;
mvToastTimer = null;
document.getElementById('mvUndo').onclick=()=>{
  if(mvUndoState===null) return;
  S.adj.moves=JSON.parse(mvUndoState); mvUndoState=null; S._settingsM=Date.now(); save(); renderToday();
  document.getElementById('mvToast').style.display='none';
};
document.getElementById('mvCancel').onclick=()=>document.getElementById('moveDialog').classList.remove('show');
document.getElementById('moveDialog').addEventListener('click',e=>{ if(e.target.id==='moveDialog') e.currentTarget.classList.remove('show'); });
/* ---- ciężary startowe dopasowane do użytkownika ----
   Plan jest pisany pod mężczyznę ~100 kg. Siła rośnie wolniej niż masa (≈ masa^0,67),
   kobiety: ~55% góry i ~70% dołu ciała w porównaniu z mężczyzną tej samej wagi, 55+ lat: −10%.
   Działa tylko, dopóki nie ma historii — potem pola biorą ostatni prawdziwy ciężar. */
PLAN_REF_KG = 100;
isLowerEx = e=>/przysiad|martwy|RDL|suwnic|nóg|łydk|wspięcia|wypady|hack/i.test(e.n);
TMR = {};   // klucz ćwiczenia → stan timera; przeżywa ponowne renderowanie karty
tmrTick = null;
tmrAudio = null;
tmrWake = null;
TMR_PLAY = '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>';
TMR_PAUSE = '<svg viewBox="0 0 24 24"><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></svg>';
TMR_RESET = '<svg viewBox="0 0 24 24"><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3.5 4v5h5"/></svg>';
document.addEventListener('visibilitychange',()=>{ if(!document.hidden){ tmrStep(); } });
}
