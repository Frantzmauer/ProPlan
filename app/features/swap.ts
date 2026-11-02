// ŻELAZO — Zamień ćwiczenie na inne na te same mięśnie.
// Moduł zawiera tylko deklaracje; kod startowy jest w __init_N, wywoływanych przez main.js w stałej kolejności.
import { S, save } from '../core/state';
import { todayISO } from '../lib/dates';
import { workoutOn } from '../plan/data';
import { esc } from '../screens/accounts';
import { openCoach } from '../screens/coach';
import { prDD, prFmt, prSetsText } from '../screens/history';
import { effEx, log, prevSession, progStep, progressionFor, renderToday, roundLoad, scaledStart, setOk, timedSpec } from '../screens/train';
import { WO, woCurSet, woRender, woSave } from '../screens/workout';
import { ciRestPlus } from './cycle';
import { restFor } from './rest';

export let SWAP_GROUPS_C, SW, swToastT;

/* ---- Zamień: ćwiczenie na inne na te same mięśnie ----
   Grupy: [nazwa, przelicznik ciężaru względem wzorca grupy, sprzęt, ciężar na rękę, powtórzenia/czas, technika (dla spoza planu)].
   Zamiana trafia do S.adj.ex jak zmiana od Trenera (user:1); „tylko dziś” ma to=dzień, w trakcie ćwiczenia fromSet + was. */
export function swapGroupsData(){ return [
  {g:'klatka, triceps, przód barków', m:[
    ['Wyciskanie sztangi — ławka płaska',1,'sztanga'],
    ['Wyciskanie hantli — ławka płaska',.4,'hantle',1,'','Hantle nad klatką, łopatki ściągnięte. Opuszczasz do boków klatki, łokcie ~45°, wyciskasz do złączenia nad mostkiem.'],
    ['Wyciskanie hantli — ławka skośna',.35,'hantle',1],
    ['Wyciskanie na maszynie (chest press)',.9,'maszyna',0,'','Uchwyty na wysokości środka klatki, łopatki dociśnięte do oparcia. Wyciskasz bez blokowania łokci, wracasz powoli.'],
    ['Rozpiętki w bramie (wyciąg)',.15,'wyciąg',1],
    ['Pompki',0,'bez sprzętu',0,'max']]},
  {g:'barki, triceps', m:[
    ['Wyciskanie żołnierskie (stojąc)',1,'sztanga'],
    ['Wyciskanie hantli siedząc (barki)',.4,'hantle',1],
    ['Wyciskanie na maszynie barkowej',.85,'maszyna',0,'','Plecy przy oparciu, uchwyty na wysokości barków. Wyciskasz w górę bez wyginania lędźwi.'],
    ['Wznosy hantli bokiem (barki)',.15,'hantle',1]]},
  {g:'plecy (najszerszy), biceps', m:[
    ['Ściąganie drążka wyciągu z góry',1,'wyciąg'],
    ['Podciąganie na drążku (lub wyciąg)',0,'drążek',0,'max'],
    ['Ściąganie wąskim uchwytem (wyciąg)',1,'wyciąg',0,'','Uchwyt V, lekko odchylony tułów. Ciągniesz do górnej części klatki, łokcie wzdłuż tułowia, łopatki w dół.'],
    ['Wiosłowanie hantlem jednorącz',.5,'hantel',1]]},
  {g:'plecy (środek), tył barków, biceps', m:[
    ['Wiosłowanie sztangą w opadzie',1,'sztanga'],
    ['Wiosłowanie hantlem jednorącz',.45,'hantel',1],
    ['Wiosłowanie na wyciągu siedząc',.9,'wyciąg',0,'','Plecy proste, klatka do przodu. Ciągniesz do brzucha, ściągasz łopatki, wracasz bez garbienia.'],
    ['Wiosłowanie na maszynie',.9,'maszyna',0,'','Klatka oparta o podparcie. Ciągniesz łokciami w tył, ściągasz łopatki, kontrolowany powrót.']]},
  {g:'uda (przód), pośladki', m:[
    ['Przysiad ze sztangą na karku',1,'sztanga'],
    ['Przysiad z hantlami / Hack',.8,'hantle / maszyna'],
    ['Wyciskanie nóg na suwnicy',1.8,'maszyna'],
    ['Wypady chodzone z hantlami',.3,'hantle',1],
    ['Przysiad goblet (hantel)',.4,'hantel',0,'','Hantel pionowo przy klatce, łokcie w dół. Schodzisz między kolana, plecy proste, wstajesz napierając piętami.']]},
  {g:'tył uda, pośladki, dół pleców', m:[
    ['Martwy ciąg (klasyczny/rumuński)',1,'sztanga'],
    ['Rumuński martwy ciąg (RDL)',.85,'sztanga'],
    ['Hip thrust (sztanga)',1,'sztanga',0,'','Łopatki na ławce, sztanga na biodrach (z podkładką). Wypychasz biodra do linii tułowia, napinasz pośladki, broda lekko w dół.'],
    ['Uginanie nóg na maszynie',.35,'maszyna'],
    ['Swing kettlebell',.25,'kettlebell']]},
  {g:'biceps', m:[
    ['Uginanie ramion ze sztangą (biceps)',1,'sztanga'],
    ['Uginanie młotkowe (biceps)',.45,'hantle',1],
    ['Uginanie ramion na wyciągu',.9,'wyciąg',0,'','Łokcie przy tułowiu, bez bujania. Uginasz do pełnego napięcia, opuszczasz powoli.']]},
  {g:'triceps', m:[
    ['Wyciskanie francuskie hantli (triceps)',1,'hantel'],
    ['Prostowanie ramion na wyciągu (triceps)',1,'wyciąg'],
    ['Pompki na poręczach (dipy)',0,'poręcze',0,'max','Tułów pionowo, schodzisz do ok. 90° w łokciach, wypychasz się bez bujania. Za trudne — poręcze z gumą albo maszyna.']]},
  {g:'łydki', m:[
    ['Wspięcia na palce (łydki)',1,'maszyna / sztanga'],
    ['Wspięcia na palce siedząc',.6,'maszyna'],
    ['Wspięcia na palce jednonóż z hantlem',.3,'hantel',1,'','Stopa na krawędzi stopnia, druga ręka trzyma się ściany. Pełne opuszczenie pięty, wspięcie z pauzą na górze.']]},
  {g:'brzuch', m:[
    ['Allahy (brzuch z wyciągiem)',1,'wyciąg'],
    ['Brzuszki na ławce skośnej',0,'ławka'],
    ['Unoszenie nóg na ławce skośnej',0,'ławka'],
    ['Ab Wheel / brzuszki na piłce',0,'kółko / piłka'],
    ['Russian twist z hantlem',.3,'hantel']]},
  {g:'brzuch (izometria)', m:[
    ['Deska (plank)',0,'bez sprzętu',0,'45 s'],
    ['Deska boczna',0,'bez sprzętu',0,'30 s/stronę'],
    ['Ab Wheel / brzuszki na piłce',0,'kółko / piłka']]},
  {g:'chwyt, tułów', m:[
    ['Farmer walk z hantlami',1,'hantle',1],
    ['Swing kettlebell',.6,'kettlebell']]}
]; }

export function SG(){ return SWAP_GROUPS_C||(SWAP_GROUPS_C=swapGroupsData()); }

export function swapAlts(name){
  const n=(name||'').trim(), out=[], seen=new Set([n]);
  SG().forEach(g=>{ const me=g.m.find(m=>m[0]===n); if(!me) return;
    g.m.forEach(m=>{ if(seen.has(m[0])) return; seen.add(m[0]); out.push({n:m[0], k:m[1], eq:m[2], ph:!!m[3], r:m[4]||'', cue:m[5]||'', grp:g.g, base:me[1]}); }); });
  return out;
}

export function swapGroup(name){ const n=(name||'').trim(), g=SG().find(g=>g.m.some(m=>m[0]===n)); return g?g.g:''; }

// zamiana w trakcie ćwiczenia: serie przed fromSet należą do poprzedniego ćwiczenia (was)
export function swapSplit(e, iso){ const a=e&&e._adj; return a && a.swap && a.user && a.from===iso && a.fromSet>1 && a.was ? a : null; }

export function swapDoneCount(rec, n){ let d=0; while(d<n && setOk(rec,d+1)) d++; return d; }

// cofnąć można zamianę zrobioną dziś, dopóki nie odhaczono serii nowego ćwiczenia
export function swapCanUndo(e, iso, rec){
  const a=e&&e._adj; if(!a || !a.user || !a.swap || a.from!==todayISO() || iso!==todayISO()) return false;
  for(let s=a.fromSet||1; s<=e.s; s++) if(setOk(rec,s)) return false;
  return true;
}

export function swapNote(e, iso, rec){
  const a=e._adj; if(!a || !a.user || !a.swap) return '';
  const sp=swapSplit(e, iso), bits=[];
  if(sp) bits.push(`Serie 1–${sp.fromSet-1}: ${esc(sp.was)}`);
  if(swapCanUndo(e, iso, rec)) bits.push(`<button class="link-btn" data-swap-undo="${iso===todayISO()?w0Index(e, iso):''}">↺ Cofnij zamianę</button>`);
  return bits.length?`<div class="ex-sub">${bits.join(' · ')}</div>`:'';
}

export function w0Index(e, iso){ const w=workoutOn(iso); return w.ex.findIndex(e0=>effEx(e0,iso).n===e.n); }

export function adjOrigOf(name){ const ex=(S.adj&&S.adj.ex)||{}; for(const k in ex) for(const y of ex[k]) if(y.swap&&y.swap.n===name) return k; return name; }

// zalecany ciężar ćwiczenia (jak na karcie): zmiana od Trenera/zamiana → historia → start z planu
export function swapRecKg(e, iso){
  let kg=(e._adj && e._adj.w>0) ? e._adj.w : scaledStart(e);
  const prog=progressionFor(e, iso, e.rp||0, false); if(prog && prog.kg>0) kg=prog.kg;
  return kg||0;
}

export function swapBaseKg(iso, i, e){
  if(WO && WO.iso===iso && WO.ex[i]){ const x=WO.ex[i], k=woCurSet(i), v=x.sets[k<0?0:k]; if(v && v.kg>0) return v.kg; }
  for(let s=1;s<=e.s;s++){ const inp=document.querySelector(`.set input[data-k="${iso}_e${i}"][data-s="w${s}"]`); if(inp && +inp.value>0) return +inp.value; }
  return swapRecKg(e, iso);
}

export function swapSuggest(o, base, reason, iso){
  const prev=prevSession(o.n, iso), ex={n:o.n, start:o.ph?'/rękę':''};
  let kg=0, src;
  if(prev){ kg=Math.max(...prev.sets.map(x=>x.kg)); src=`ostatnio ${prDD(prev.iso)}: ${prSetsText(o.r&&!/max/.test(o.r)?'time':(prev.sets.some(x=>x.kg>0)?'kg':'reps'), prev.sets.map(x=>({kg:x.kg, r:x.rp})))}`; }
  else if(o.k>0 && o.base>0 && base>0){ kg=roundLoad(ex, base*o.k/o.base); src=`przeliczone z ${prFmt(base)} kg — dopasuj po 1. serii`; }
  else if(o.k>0) src='dobierz ciężar (2 powtórzenia w zapasie)';
  else src=/\d+\s*s\b/.test(o.r)?'na czas':'ciężar ciała';
  if(reason==='pain' && kg>0){ kg=roundLoad(ex, kg*0.8); src+=' · −20%, bo boli'; }
  return {kg, src, hist:!!prev};
}

export function openSwap(iso, i){ SW={iso, i, reason:'busy', pick:0, scope:'today'}; renderSwap(); document.getElementById('swSheet').style.display='flex'; document.getElementById('swPanel').scrollTop=0; }

export function closeSwap(){ document.getElementById('swSheet').style.display='none'; }

export function renderSwap(){
  const w=workoutOn(SW.iso), e0=w.ex[SW.i], e=effEx(e0,SW.iso), rec=log(SW.iso).ex[SW.iso+'_e'+SW.i];
  const done=swapDoneCount(rec, e.s), base=swapBaseKg(SW.iso, SW.i, e);
  const opts=swapAlts(e.n).map(o=>Object.assign({o}, swapSuggest(o, base, SW.reason, SW.iso)));
  // najpierw to, co już robiłeś (znany ciężar); przy braku sprzętu maszyny na koniec
  opts.sort((x,y)=>(SW.reason==='gear'?(+/maszyna/.test(x.o.eq) - +/maszyna/.test(y.o.eq)):0) || (+y.hist - +x.hist));
  Object.assign(SW, {opts, done, e, e0, ts:timedSpec(e,e0)});
  const p=opts[SW.pick]||opts[0], left=e.s-done;
  document.getElementById('swPanel').innerHTML=`<div class="eh-grab"></div>
    <div class="eh-head"><div style="flex:1;min-width:0"><div class="eyebrow">Zamień ćwiczenie</div><h2 id="swTitle">${esc(e.n)}</h2>
      <div class="sw-grp">Te same mięśnie: ${esc(swapGroup(e.n))}</div></div><button class="eh-x" data-swclose aria-label="Zamknij">✕</button></div>
    <div class="sw-lab">Dlaczego?</div>
    <div class="eh-chips">${[['busy','Zajęte stanowisko'],['pain','Coś boli'],['gear','Brak sprzętu']].map(([k,l])=>`<button data-swreason="${k}" class="${SW.reason===k?'on':''}">${l}</button>`).join('')}</div>
    ${SW.reason==='pain'?'<div class="sw-warn">Ostry albo kłujący ból — przerwij to ćwiczenie. Zamiennik dostaje ciężar o 20% niższy, a Trener zobaczy tę zamianę.</div>':''}
    <div class="sw-lab">Na co?</div>
    <div class="sw-opts">${opts.map((x,j)=>`<button class="sw-opt ${j===SW.pick?'on':''}" data-swpick="${j}">
      <span class="n"><span>${esc(x.o.n)}</span><span>${x.kg?prFmt(x.kg)+' kg'+(x.o.ph?' / rękę':''):(x.o.r==='max'?'MAX':x.o.r)}</span></span>
      <small>${x.hist?'<span class="sw-tag">ROBIŁEŚ</span>':''}${esc(x.o.eq)} · ${x.src}</small></button>`).join('')}</div>
    <div class="sw-lab">Na jak długo?</div>
    <div class="sw-seg">
      <button data-swscope="today" class="${SW.scope==='today'?'on':''}"><b>Tylko dziś</b><small>następnym razem wraca ćwiczenie z planu</small></button>
      <button data-swscope="perm" class="${SW.scope==='perm'?'on':''}"><b>Na stałe</b><small>w planie od dziś, jak zmiana od Trenera</small></button>
    </div>
    ${done?`<div class="sw-split">Zrobione <b>${done} ${done===1?'seria':done<5?'serie':'serii'}</b> zostają jako ${esc(e.n)}. Pozostałe <b>${left}</b> zrobisz jako ${esc(p.o.n)}. Historia i rekordy liczą się osobno.</div>`:''}
    <button class="wo-save" data-swapply>${done?'ZAMIEŃ POZOSTAŁE SERIE':'ZAMIEŃ'}</button>
    <button class="sw-ask" data-swask>Żadne nie pasuje? Zapytaj Trenera →</button>`;
}

export function swapApply(){
  const {iso, i, e, done}=SW, x=SW.opts[SW.pick]; if(!x) return;
  S.adj=S.adj||{}; S.adj.ex=S.adj.ex||{};
  const k=adjOrigOf(e.n), old=S.adj.ex[k]||[], prevToday=old.find(y=>y.user && y.from===iso);
  let rp=e.rp||0, r;
  if(x.o.r){ r=x.o.r; const m=/(\d+)/.exec(x.o.r); rp=m?+m[1]:(rp||10); }
  else if(SW.ts || !rp) rp=SW.ts?12:10;   // z ćwiczenia na czas / „max” na zwykłe powtórzenia
  const a:any={from:iso, w:x.kg||0, ph:x.o.ph?1:0, s:e.s, rp, swap:{n:x.o.n, cue:x.o.cue}, user:1, reason:SW.reason,
    was:prevToday?prevToday.was:e.n, id:Date.now()};
  if(r) a.r=r;
  if(SW.scope==='today') a.to=iso;
  const fs=prevToday&&prevToday.fromSet ? prevToday.fromSet : (done>0 ? done+1 : 0); if(fs) a.fromSet=fs;
  // ponowna zamiana tego samego dnia zastępuje poprzednią
  S.adj.ex[k]=old.filter(y=>!(y.user && y.from===iso)).concat([a]);
  S._settingsM=Date.now(); save(); closeSwap(); renderToday();
  if(WO && WO.iso===iso) woSwapRebuild(i);
  swapToast('Zamieniono na: '+x.o.n, ()=>swapUndo(i, iso));
}

export function swapUndo(i, iso){
  const w=workoutOn(iso), e=effEx(w.ex[i], iso), a=e._adj; if(!a || !a.user) return;
  const ex=S.adj.ex; for(const k in ex){ ex[k]=ex[k].filter(y=>y.id!==a.id); if(!ex[k].length) delete ex[k]; }
  S._settingsM=Date.now(); save(); renderToday();
  if(WO && WO.iso===iso) woSwapRebuild(i);
  document.getElementById('swToast').style.display='none';
}

// tryb treningu po zamianie: niezrobione serie dostają nowe ćwiczenie i ciężar, zrobione zostają
export function woSwapRebuild(i){
  const w=workoutOn(WO.iso), e0=w.ex[i], e=effEx(e0,WO.iso), ts=timedSpec(e,e0), old=WO.ex[i];
  const kg=swapRecKg(e, WO.iso), noKg=!(kg>0) && (ts || swapAlts(e.n).length && (SG().some(g=>g.m.some(m=>m[0]===e.n.trim() && m[1]===0))));
  WO.ex[i]=Object.assign({}, old, {n:e.n, s:e.s, timed:!!ts, secs:ts?ts.secs:0, sides:ts?ts.sides:1, up:ts?ts.up:false, step:progStep(e), rest:restFor(e,ts)+ciRestPlus(WO.iso),
    sets:old.sets.map((v,j)=>old.ok[j]?v:{kg:noKg?null:kg, r:e.rp||0}), prPopped:false});
  WO.tStart=0; woSave(); woRender();
}

export function woSwapLine(i){
  const e=effEx(workoutOn(WO.iso).ex[i], WO.iso), a=e._adj; if(!a || !a.user || !a.swap || a.from!==WO.iso) return '';
  const rec=log(WO.iso).ex[WO.ex[i].key];
  return `<div class="wo-from">zamiast <b>${esc(a.was||'')}</b> · ${a.to?'tylko dziś':'na stałe od dziś'}${swapCanUndo(e, WO.iso, rec)?' · <button id="woSwapUndo">↺ cofnij</button>':''}</div>`;
}

export function swapToast(msg, undo){
  const t=document.getElementById('swToast'); document.getElementById('swToastTxt').textContent=msg; t.style.display='flex';
  document.getElementById('swToastUndo').onclick=()=>{ t.style.display='none'; undo(); };
  clearTimeout(swToastT); swToastT=setTimeout(()=>{ t.style.display='none'; }, 6000);
}

export function __init_24(){
// leniwie: karta dnia renderuje się wcześniej w skrypcie niż ta część
SWAP_GROUPS_C = null;
SW = null;
swToastT = null;
document.getElementById('swSheet').addEventListener('click', ev=>{
  const t=ev.target.closest('[data-swclose],[data-swreason],[data-swpick],[data-swscope],[data-swapply],[data-swask]'); if(!t) return;
  const d=t.dataset;
  if('swclose' in d) closeSwap();
  else if(d.swreason){ SW.reason=d.swreason; SW.pick=0; renderSwap(); }
  else if(d.swpick!=null){ SW.pick=+d.swpick; renderSwap(); }
  else if(d.swscope){ SW.scope=d.swscope; renderSwap(); }
  else if('swapply' in d) swapApply();
  else {
    const why={busy:'zajęte stanowisko', pain:'coś boli', gear:'brak sprzętu'}[SW.reason], n=SW.e.n;
    closeSwap();
    document.getElementById('coachDialog').style.zIndex=document.getElementById('woFocus').style.display==='flex'?'455':'';   // nad trybem treningu
    openCoach(); document.getElementById('coachIn').value=`Nie mogę dziś zrobić: ${n} (${why}). Zaproponuj zamiennik na te same mięśnie, z ciężarem.`;
  }
});
}
