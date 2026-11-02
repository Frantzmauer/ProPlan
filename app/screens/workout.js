// ŻELAZO — Tryb treningu: pełny ekran serii i przerw, pauza, podsumowanie, reset dnia.
// Moduł zawiera tylko deklaracje; kod startowy jest w __init_N, wywoływanych przez main.js w stałej kolejności.
import { __set_viewOffset, viewOffset } from '../core/backup.js';
import { save } from '../core/state.js';
import { woLightBanner, woRefreshFromCard } from '../features/checkin.js';
import { ciRestPlus } from '../features/cycle.js';
import { openFormCheck } from '../features/formcheck.js';
import { openRestEdit, restFor, restSet, restTag, restToast, woRestLearnHtml } from '../features/rest.js';
import { openSwap, swapAlts, swapUndo, woSwapLine } from '../features/swap.js';
import { todayISO } from '../lib/dates';
import { e1rm, prAnalyze, prBest, prMetrics } from '../lib/records';
import { mark, touch } from '../lib/state';
import { workoutOn } from '../plan/data.js';
import { esc } from './accounts.js';
import { openGuide } from './guide.js';
import { IC_HIST, exIndex, openExHist, prDD, prE1, prFmt, prName, prNum, prSetsText, prTopText, prUnit } from './history.js';
import { moreOpen, showView } from './more.js';
import { __set_tmrAudio, dmy, dowOf, effEx, exAny, exRec, exTick, log, nextMoves, okCount, progStep, renderToday, setMoves, setOk, timedSpec, tmrAudio, tmrBeep, tmrBuzz } from './train.js';

export let fmtDur, WO_LS, WO, woTick, woWake, woCurSet, woDone, woTotal, prToastT, hasSession, woUndoSnap, woToastTimer;

// zaplanowana przerwa po serii: duże wielostawowe dłużej, akcesoria krócej, ćwiczenia na czas najkrócej
export function restSecs(e, ts){
  if(ts) return 45;
  if(/przysiad|martwy|RDL|ławce|ławka|żołnierskie|wyciskanie sztangi/i.test(e.n)) return 150;
  if(/wiosł|ściąg|podciąg|wykrok|suwnic|hip|pompk|dip|hack|wyciskanie/i.test(e.n)) return 105;
  return 75;
}

export function woSave(){ try{ if(WO) localStorage.setItem(WO_LS, JSON.stringify(WO)); else localStorage.removeItem(WO_LS); }catch(e){} }

// lista ćwiczeń dnia z wartościami z karty (podpowiedzi i progresja już w polach)
export function woBuild(iso){
  const w=workoutOn(iso);
  return w.ex.map((e0,i)=>{
    const e=effEx(e0,iso), key=iso+'_e'+i, ts=timedSpec(e,e0), sets=[];
    for(let s=1;s<=e.s;s++){
      const wIn=document.querySelector(`.set input[data-k="${key}"][data-s="w${s}"]`), rIn=document.querySelector(`.set input[data-k="${key}"][data-s="r${s}"]`);
      sets.push({kg: wIn ? (wIn.value===''?0:+wIn.value) : null, r: rIn&&rIn.value!=='' ? +rIn.value : (e.rp||0)});
    }
    return {key, n:e.n, s:e.s, timed:!!ts, secs:ts?ts.secs:0, sides:ts?ts.sides:1, up:ts?ts.up:false,
      step:progStep(e), rest:restFor(e, ts)+ciRestPlus(iso), sets};
  });
}

// statystyki sesji z listy serii (tryb treningu i odtworzenie z godzin odhaczenia)
export function woAgg(lg, exs){
  const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0, rests=lg.filter(l=>l.restBefore!=null);
  return {work:lg.reduce((a,l)=>a+(l.work||0),0), trans:lg.reduce((a,l)=>a+(l.trans||0),0),
    avgRest:Math.round(avg(rests.map(l=>l.restBefore))), avgRestPlan:Math.round(avg(rests.map(l=>l.restPlan||0))), done:lg.length,
    ex:exs.map(x=>{ const mine=lg.filter(l=>l.ex===x.n), rs=mine.filter(l=>l.restBefore!=null);
      return {n:x.n, sets:mine.length, of:x.s, avgRest:Math.round(avg(rs.map(l=>l.restBefore))), restPlan:x.rest, avgWork:Math.round(avg(mine.map(l=>l.work||0)))}; })};
}

export function woStartLabel(iso, w, L){
  if(WO && WO.iso===iso) return 'WZNÓW TRENING';
  if(hasSession(L)) return 'DOKOŃCZ TRENING · '+w.ex.filter((e0,i)=>{ const e=effEx(e0,iso); return okCount(L.ex[iso+'_e'+i], e.s)===e.s; }).length+'/'+w.ex.length;
  return w.ex.some((e0,i)=>exAny(L.ex[iso+'_e'+i])) ? 'WZNÓW TRENING' : 'START TRENINGU';
}

// „Dokończ trening”: ten sam pomiar co zakończona część — czas liczy się dalej, przerwa między częściami jak pauza
export function woContinue(iso){
  const L=log(iso); if(!hasSession(L)) return;
  let s=L.session;
  if(!s.log){ const rs=woRebuildSession(iso); if(rs){ s=L.session=rs; touch(L); save(); } }
  const now=Date.now(), last=s.last||s.end||now;
  WO.start=s.start||now;
  WO.pausedTotal=Math.max(0, now-WO.start-(s.dur||0)*1000);   // aktywny czas startuje od zapisanego
  WO.gap=(s.gap||0)+Math.max(0, Math.round((now-last)/1000));
  WO.parts=(s.parts||1)+1;
  WO.log=(s.log||[]).slice(); WO.prs=(s.prs||[]).slice(); WO.pauses=s.pauses||0; WO.skipped=s.skipped||0; WO.forms=(s.forms||[]).slice();
  WO.ex.forEach(x=>{ if(WO.prs.some(p=>p.n===x.n)) x.prPopped=true; });
  WO.setStart=now; WO.phaseAt=now;
}

// sesja zapisana przed listą serii, nadpisana przez „Wznów”: składamy cały trening z godzin odhaczenia serii.
// Przerwa > 20 min między seriami = przerwa w treningu (nie wlicza się). Czas serii: średnia z zapisanej części albo 45 s.
export function woRebuildSession(iso){
  const L=log(iso), s=L.session, w=workoutOn(iso);
  if(!hasSession(L) || s.log || !w || w.type!=='lift') return null;
  const ticks=[], exs=[];
  w.ex.forEach((e0,i)=>{ const e=effEx(e0,iso), k=iso+'_e'+i, r=L.ex[k], rest=restSecs(e,timedSpec(e,e0));
    exs.push({n:e.n, s:e.s, rest});
    for(let n=1;n<=e.s;n++){ const t=setOk(r,n) && L._t && L._t['ok:'+k+':'+n]; if(t) ticks.push({t, ex:e.n, set:n, rest}); } });
  if(!ticks.length || !ticks.some(x=>x.t<(s.start||0)-60e3)) return null;   // nic sprzed tej części — nie ma czego łączyć
  ticks.sort((a,b)=>a.t-b.t);
  const per=s.done?Math.max(20,Math.round((s.work||0)/s.done)):45, GAP=20*60, lg=[];
  let gap=0, prev=null;
  ticks.forEach(x=>{
    let restBefore=null, trans=null;
    if(prev){ const g=Math.round((x.t-prev.t)/1000);
      if(g>GAP) gap+=g-per; else if(prev.ex===x.ex) restBefore=Math.max(0,g-per); else trans=Math.max(0,g-per); }
    lg.push({ex:x.ex, set:x.set, work:per, restBefore, trans, restPlan:restBefore!=null?x.rest:null});
    prev=x;
  });
  const start=ticks[0].t-per*1000, last=Math.max(ticks[ticks.length-1].t, s.last||s.end||0);
  return Object.assign({start, end:Date.now(), last, dur:Math.max(0,Math.round((last-start)/1000)-gap-(s.paused||0)),
    paused:(s.paused||0)+gap, pauses:s.pauses||0, gap, parts:gap?2:1, prs:s.prs||[], total:exs.reduce((a,x)=>a+x.s,0),
    skipped:s.skipped||0, title:s.title||w.title, forms:s.forms||[], log:lg, rebuilt:true}, woAgg(lg, exs));
}

export function woStart(iso){
  try{ __set_tmrAudio(tmrAudio||new (window.AudioContext||window.webkitAudioContext)()); tmrAudio.resume&&tmrAudio.resume(); }catch(e){}
  if(WO && WO.iso===iso && WO.phase==='summary'){ WO=null; woSave(); }   // podsumowanie zostało otwarte — dokończenie startuje z zapisanej sesji
  if(!WO || WO.iso!==iso){
    const ex=woBuild(iso), L=log(iso);
    WO={iso, title:workoutOn(iso).title, start:Date.now(), ex, cur:0, phase:'work', setStart:Date.now(),
        restStart:0, restEnd:0, restPlan:0, beeped:false, log:[], skipped:0, tStart:0, tSide:1};
    // serie odhaczone wcześniej ręcznie liczą się jako zrobione
    WO.ex.forEach(x=>{ x.ok=x.sets.map((_,j)=>setOk(L.ex[x.key], j+1)); });
    WO.cur=woNext(0); if(WO.cur<0) WO.cur=0;
    woContinue(iso);
  }
  woSave(); document.getElementById('woFocus').style.display='flex';
  woWakeLock(true);
  clearInterval(woTick); woTick=setInterval(woStep,200); woRender();
}

export function woNext(from){ for(let k=0;k<WO.ex.length;k++){ const i=(from+k)%WO.ex.length; if(woCurSet(i)>=0) return i; } return -1; }

export function woWakeLock(on){
  if(on && !woWake && navigator.wakeLock) navigator.wakeLock.request('screen').then(w=>{ woWake=w; w.addEventListener('release',()=>{ woWake=null; }); }).catch(()=>{});
  if(!on && woWake){ woWake.release().catch(()=>{}); woWake=null; }
}

// seria zrobiona: odhacz w dzienniku z wartościami z ekranu, potem przerwa
export function woSetDone(){
  const i=WO.cur, x=WO.ex[i], k=woCurSet(i); if(k<0) return;
  const t=Date.now(), v=x.sets[k], L=log(WO.iso), r=exRec(L, x.key, x.s);
  const prs=woPrCheck(x, v.kg||0, v.r);   // przed odhaczeniem: porównanie z wcześniejszymi seriami
  exTick(L, x.key, x.s, k+1, true, v.r);
  if(v.kg!==null) r.sets['w'+(k+1)]=String(v.kg);
  touch(L); save();
  x.ok[k]=true;
  // przejście z innego ćwiczenia nie jest przerwą między seriami — osobno, żeby nie psuło średniej przerw
  const rb=WO.lastRest!=null?Math.round(WO.lastRest):null;
  WO.log.push({ex:x.n, set:k+1, work:Math.round((t-WO.setStart)/1000), restBefore:WO.lastTrans?null:rb, trans:WO.lastTrans&&rb!=null?Math.max(0,rb):null, restPlan:WO.lastTrans?null:(WO.lastRestPlan||null)});
  WO.lastRest=null; WO.lastTrans=false; tmrBuzz(30);
  if(prs.length){ (x.prSet=x.prSet||[])[k]=true; prs.forEach(p=>woPrAdd(x, p)); }
  // ostatnia seria ćwiczenia: rekord objętości (tylko gdy wszystkie serie zrobione, bez pomijania)
  let vol=null;
  if(woCurSet(i)<0 && !x.skipped){
    const h=exIndex()[x.n.trim()], an=h?prAnalyze(h):[], last=an[an.length-1];
    if(last && last.iso===WO.iso && last.prs.includes('vol')){
      const prev=Math.max(0,...an.slice(0,-1).filter(q=>q.full).map(q=>q.m.vol)), u=h.kind==='kg'?'kg':prUnit(h.kind);
      vol={t:'vol', now:prNum(last.m.vol)+' '+u, was:prNum(prev)+' '+u, kind:h.kind}; woPrAdd(x, vol);
    }
  }
  if(woDone()===woTotal()) woFinish();
  else {
    if(woCurSet(i)<0) WO.cur=woNext(i);
    WO.trans=WO.cur!==i;
    WO.plusCount=0;
    WO.phase='rest'; WO.phaseAt=t; WO.restPlan=x.rest; WO.restStart=t; WO.restEnd=t+x.rest*1000; WO.beeped=false; WO.tStart=0; WO.tSide=1;
    woSave(); woRender();
  }
  if(prs.length) woPrShow(x, v, prs);
  if(vol) setTimeout(()=>woPrToast('🏆 Rekord objętości: '+vol.now+' ('+x.n+')'), prs.length?2600:0);
}

export function woStartSet(){ const t=Date.now(); WO.lastRest=(t-WO.restStart)/1000; WO.lastRestPlan=WO.restPlan; WO.lastTrans=!!WO.trans; WO.trans=false; WO.phase='work'; WO.phaseAt=t; WO.setStart=t; woSave(); woRender(); }

/* rekordy w trakcie treningu */
export function woKind(x, kg){ const h=exIndex()[x.n.trim()]; return x.timed?'time':(kg>0||(h&&h.kind==='kg'))?'kg':'reps'; }

export function woPrCheck(x, kg, r){
  const h=exIndex()[x.n.trim()]; if(!h || !(r>0)) return [];
  const before=h.sess.filter(q=>q.iso<WO.iso); if(!before.length) return [];   // pierwszy trening = punkt startowy
  const td=h.sess.find(q=>q.iso===WO.iso), prior=before.flatMap(q=>q.sets).concat(td?td.sets:[]);
  const mx=a=>a.length?Math.max(...a):0, kind=woKind(x,kg), out=[];
  if(kind!=='kg'){ const p=mx(prior.map(y=>y.r)); if(r>p) out.push({t:'top', now:r+' '+prUnit(kind), was:p+' '+prUnit(kind), kind}); return out; }
  if(!(kg>0)) return out;
  const pTop=mx(prior.map(y=>y.kg)), pE1=mx(prior.map(y=>e1rm(y.kg,y.r))), e=e1rm(kg,r);
  if(kg>pTop) out.push({t:'top', now:prFmt(kg)+' kg', was:prFmt(pTop)+' kg', kind});
  if(pE1>0 && e>pE1+0.01) out.push({t:'e1', now:'≈ '+prE1(e)+' kg', was:'≈ '+prE1(pE1)+' kg', kind});
  if(kg<=pTop){ const p=mx(prior.filter(y=>y.kg>=kg).map(y=>y.r)); if(r>p) out.push({t:'reps', now:r+' powt. przy '+prFmt(kg)+' kg', was:p+' powt.', kind}); }
  return out;
}

// ten sam rodzaj rekordu w jednym ćwiczeniu: zostaje pierwsze „poprzednio” i ostatnie „teraz”
export function woPrAdd(x, p){
  WO.prs=WO.prs||[];
  const o=WO.prs.find(q=>q.n===x.n && q.t===p.t);
  if(o) o.now=p.now; else WO.prs.push({n:x.n, t:p.t, now:p.now, was:p.was, kind:p.kind});
}

export function woRefHtml(x, v){
  const h=exIndex()[x.n.trim()]; if(!h) return '';
  const before=h.sess.filter(q=>q.iso<WO.iso); if(!before.length) return '';
  const last=before[before.length-1], an=prAnalyze(h).filter(q=>q.iso<=WO.iso), b=prBest(h.kind,an);
  const will=x.timed&&WO.tStart?[]:woPrCheck(x, v.kg||0, v.r);
  return `<div class="wo-ref"><div>Ostatnio (${prDD(last.iso)}): <b>${prSetsText(h.kind,last.sets)}</b></div>
    <div class="g">🏆 Rekord: <b>${prTopText(h.kind,b.top)}</b>${h.kind==='kg'&&b.e1.m.e1?' · 1RM ≈ '+prE1(b.e1.m.e1)+' kg':''}</div></div>
    ${will.length?`<div class="wo-willpr">🏆 To będzie rekord: ${will.map(p=>prName(p.kind,p.t)).join(' + ')}</div>`:''}`;
}

export function woPrShow(x, v, prs){
  try{ navigator.vibrate && navigator.vibrate([60,40,140]); }catch(e){}
  tmrBeep(988,.18); setTimeout(()=>tmrBeep(1319,.3),150);
  if(x.prPopped){ woPrToast('🏆 Kolejny rekord: '+prs.map(p=>prName(p.kind,p.t)+' '+p.now).join(', ')); return; }
  x.prPopped=true; woSave();
  document.getElementById('prSub').textContent=x.n+' · '+(v.kg?prFmt(v.kg)+' kg × ':'')+v.r+(x.timed?' s':'');
  document.getElementById('prLines').innerHTML=prs.map(p=>`<div class="ln"><span>${prName(p.kind,p.t)}</span><div><b>${esc(p.now)}</b><em>poprzednio ${esc(p.was)}</em></div></div>`).join('');
  document.getElementById('prOk').textContent=WO.phase==='rest'?'DALEJ · PRZERWA':'DALEJ';
  document.getElementById('prPop').style.display='flex';
}

export function woPrToast(msg){
  const t=document.getElementById('prToast'); t.textContent=msg; t.style.display='block';
  clearTimeout(prToastT); prToastT=setTimeout(()=>{ t.style.display='none'; }, 3800);
}

/* wstrzymanie: stoją wszystkie zegary — trening, przerwa, seria i odliczanie ćwiczenia na czas */
export function woActive(t){ return t-WO.start-(WO.pausedTotal||0); }

export function woPause(){
  if(!WO || WO.pausedAt || WO.phase==='summary') return;
  if(WO.phase==='confirm') WO.phase=WO.prevPhase||'work';
  WO.pausedAt=Date.now(); woSave(); woRender(); woStep();
}

export function woUnpause(){
  if(!WO || !WO.pausedAt) return;
  const d=Date.now()-WO.pausedAt;
  WO.pausedTotal=(WO.pausedTotal||0)+d; WO.pauses=(WO.pauses||0)+1;
  ['setStart','restStart','restEnd','tStart'].forEach(k=>{ if(WO[k]) WO[k]+=d; });
  WO.pausedAt=0; WO.phaseAt=Date.now(); woSave(); woRender(); woStep();
}

export function woStep(){
  if(!WO) return;
  const now=Date.now();
  if(WO.pausedAt){
    if(WO.phase!=='summary') document.getElementById('woTotal').textContent=fmtDur(woActive(WO.pausedAt)/1000);
    const p=document.getElementById('woPaused'); if(p) p.textContent=fmtDur((now-WO.pausedAt)/1000);
    const lg=document.getElementById('woPauseLong'); if(lg) lg.style.display=now-WO.pausedAt>30*60e3?'block':'none';
    return;
  }
  if(WO.phase!=='summary') document.getElementById('woTotal').textContent=fmtDur(woActive(now)/1000);
  if(WO.phase==='rest'){
    const left=(WO.restEnd-now)/1000, el=document.getElementById('woLeft'); if(!el) return;
    const over=left<0, box=document.getElementById('woRestBox'), C=2*Math.PI*90;
    el.textContent=(over?'+':'')+fmtDur(Math.abs(over?Math.floor(left):Math.ceil(left)));
    box.classList.toggle('over', over && !WO.trans); box.classList.toggle('ready', over && !!WO.trans);
    document.getElementById('woRLab').textContent=WO.trans?(over?'Przejście · zaczynaj, kiedy będziesz gotowy':'Przejście do kolejnego ćwiczenia'):over?'Przerwa za długa — zaczynaj!':'Przerwa';
    document.getElementById('woFg').style.strokeDashoffset = over ? 0 : C*(1-left/WO.restPlan);
    if(left<=3 && left>0 && Math.ceil(left)!==WO.lastSec){ WO.lastSec=Math.ceil(left); tmrBeep(660,.12); }
    // koniec przerwy: sygnał, po chwili ekran sam przechodzi do serii — ale nie przy zmianie ćwiczenia
    // (np. czekasz na maszynę); tam seria startuje dopiero po „ZACZYNAM”
    if(over && !WO.beeped){ WO.beeped=true; tmrBeep(880,.35); setTimeout(()=>tmrBeep(1175,.5),180); tmrBuzz([200,100,200]);
      if(!WO.trans) setTimeout(()=>{ if(WO&&WO.phase==='rest'&&!WO.pausedAt&&!WO.trans) woStartSet(); }, 1500); }
  } else if(WO.phase==='work'){
    const w=document.getElementById('woWork'); if(w) w.textContent=fmtDur((now-WO.setStart)/1000);
    // ćwiczenie na czas: odliczanie (albo stoper przy „max czas”)
    const x=WO.ex[WO.cur];
    if(x && x.timed && WO.tStart){
      const el=document.getElementById('woTimed'); const gone=(now-WO.tStart)/1000;
      if(x.up){ if(el) el.textContent=fmtDur(gone); }
      else {
        const left=x.sets[woCurSet(WO.cur)].r-gone;
        if(el) el.textContent=fmtDur(Math.max(0,Math.ceil(left)));
        if(left<=3 && left>0 && Math.ceil(left)!==WO.lastSec){ WO.lastSec=Math.ceil(left); tmrBeep(660,.12); }
        if(left<=0){ tmrBeep(880,.35); setTimeout(()=>tmrBeep(1175,.5),180); tmrBuzz([200,100,200]);
          if(x.sides>1 && WO.tSide===1){ WO.tSide=2; WO.tStart=0; woRender(); } else { WO.tStart=0; woSetDone(); } }
      }
    }
  }
}

export function woRender(){
  const b=document.getElementById('woBody');
  document.getElementById('woPBar').style.width=(woDone()/woTotal()*100)+'%';
  document.getElementById('woPTxt').textContent=`${woDone()} z ${woTotal()} serii · ${WO.title}${navigator.onLine?'':' · offline'}`;
  const eb=document.getElementById('woEnd');
  eb.textContent=WO.phase==='summary'?'Zamknij':WO.pausedAt?'▶ Wznów':'⏸ Wstrzymaj'; eb.classList.toggle('paused', !!WO.pausedAt);
  if(WO.phase==='summary'){ b.innerHTML=woSummaryHtml(); document.getElementById('woSave').onclick=woClose; return; }
  if(WO.pausedAt && WO.phase!=='confirm'){
    b.innerHTML=`<div class="wo-pause"><span class="lab">Trening wstrzymany</span><b id="woPaused">0:00</b>
      <small>Stoją wszystkie zegary: czas treningu, przerwa i seria. Wznów, kiedy będziesz gotowy.</small>
      <div class="wo-note" id="woPauseLong" style="display:none"><b>Wstrzymane od ponad 30 min.</b> Jeśli to już koniec, zakończ trening — zapiszemy czas bez pauzy.</div>
      <button class="wo-save" id="woUnpause">▶ WZNÓW</button>
      <button class="wo-endnow" id="woEndNow">Zakończ trening</button></div>`;
    document.getElementById('woUnpause').onclick=woUnpause;
    document.getElementById('woEndNow').onclick=()=>{ WO.prevPhase=WO.phase; WO.phase='confirm'; woRender(); };
    woStep(); return;
  }
  if(WO.phase==='confirm'){
    b.innerHTML=`<div class="wo-sum"><h2>Zakończyć trening?</h2></div><p class="wo-next">Zrobione ${woDone()} z ${woTotal()} serii. Niezrobione serie zostaną nieodhaczone.</p>
      <div class="wo-confirm"><button id="woBack">Wróć do treningu</button><button class="yes" id="woYes">Zakończ</button></div>`;
    document.getElementById('woBack').onclick=()=>{ WO.phase=WO.prevPhase||'work'; woRender(); };
    document.getElementById('woYes').onclick=woFinish; return;
  }
  const i=WO.cur, x=WO.ex[i], k=woCurSet(i)<0?x.s-1:woCurSet(i), v=x.sets[k];
  let h=`${woLightBanner()}<div class="wo-name"><span class="t">${esc(x.n)}</span><div class="nv"><button id="woPrev" aria-label="Poprzednie ćwiczenie" ${i===0?'disabled':''}>‹</button><button id="woNx" aria-label="Następne ćwiczenie" ${i===WO.ex.length-1?'disabled':''}>›</button></div></div>
    <div class="wo-setno"><span style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">Seria <b>${k+1}</b> z ${x.s} <button class="wo-restchip" id="woRestEdit">⏱ przerwa ${fmtDur(x.rest)}${restTag(x.n)}<i>zmień</i></button></span><span style="display:flex;gap:6px">${exIndex()[x.n.trim()]?`<button class="wo-hist" id="woHist" aria-label="Historia ćwiczenia">${IC_HIST}</button>`:''}${woCurSet(i)>=0 && swapAlts(x.n).length?'<button class="wo-show sw" id="woSwap">⇄ Zamień</button>':''}<button class="wo-show" id="woShow">Pokaż technikę</button></span></div>${woSwapLine(i)}
    <div class="wo-dots">${x.ok.map((d,j)=>`<i class="${d?((x.prSet||[])[j]?'pr':'ok'):j===k?'cur':''}"></i>`).join('')}</div>`;
  if(WO.phase==='rest'){
    const nx=WO.ex[WO.cur], nk=woCurSet(WO.cur), nv=nx.sets[nk], C=2*Math.PI*90;
    h+=`<div class="wo-rest" id="woRestBox"><span class="lab" id="woRLab">Przerwa</span>
      <div class="wo-ring"><svg viewBox="0 0 200 200"><circle class="bg" cx="100" cy="100" r="90"/><circle class="fg" id="woFg" cx="100" cy="100" r="90" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg>
        <div class="c"><b id="woLeft">${fmtDur(WO.restPlan)}</b><small>z ${fmtDur(WO.restPlan)}</small></div></div>
      <div class="wo-rbtns"><button id="woPlus">+15 s</button><button class="go" id="woGo">▶ ZACZYNAM</button></div>${woRestLearnHtml()}</div>
      <div class="wo-next">Następnie: <b>${esc(nx.n)}</b> · seria ${nk+1} · ${nv.kg?String(nv.kg).replace('.',',')+' kg × ':''}${nv.r}${nx.timed?' s':''}</div>
      ${WO.trans?'<div class="wo-hint">Maszyna zajęta? Stuknij ⏸ Wstrzymaj u góry albo wybierz inne ćwiczenie z listy niżej.</div>':''}`;
  } else {
    const unit=x.timed?'sekund':'powtórzeń';
    h+=`<div class="wo-big"><div class="wo-vals">
      ${v.kg!==null?`<div class="wo-val"><span class="n">${String(v.kg).replace('.',',')}</span><span class="u">kg</span><div class="pm"><button data-wd="kg:-1" aria-label="Mniej kg">−</button><button data-wd="kg:1" aria-label="Więcej kg">+</button></div></div><span class="x">×</span>`:''}
      <div class="wo-val"><span class="n">${x.timed&&WO.tStart?`<span id="woTimed">${fmtDur(x.up?0:v.r)}</span>`:v.r}</span><span class="u">${x.timed&&x.sides>1?(WO.tSide===1?'s · lewa strona':'s · prawa strona'):unit}</span>${x.timed&&WO.tStart?'':`<div class="pm"><button data-wd="r:-1" aria-label="Mniej">−</button><button data-wd="r:1" aria-label="Więcej">+</button></div>`}</div>
    </div><span class="wo-work">Seria trwa <b id="woWork">0:00</b></span></div>${woRefHtml(x, v)}`;
    if(x.timed && !WO.tStart) h+=`<button class="wo-done timer" id="woTimer"><svg viewBox="0 0 24 24" style="fill:#0e1114;stroke:none"><path d="M7 4.5v15l13-7.5z"/></svg>${x.up?'START STOPERA':'START ODLICZANIA'}</button>`;
    else if(x.timed && x.up) h+=`<button class="wo-done" id="woStopUp"><svg viewBox="0 0 24 24"><path d="M4 12l5 5L20 6"/></svg>KONIEC SERII</button>`;
    else if(!x.timed) h+=`<button class="wo-done" id="woDone"><svg viewBox="0 0 24 24"><path d="M4 12l5 5L20 6"/></svg>SERIA ZROBIONA</button>`;
    h+=`<button class="wo-cam" id="woCam">📹 Sprawdź technikę tej serii</button>`;
    h+=`<button class="wo-skip" id="woSkip">Pomiń tę serię</button>`;
  }
  h+=`<div class="wo-list"><h4>Ćwiczenia</h4>`+WO.ex.map((y,j)=>{ const d=y.ok.filter(Boolean).length; return `<button class="${d===y.s?'ok':''} ${j===i?'cur':''}" data-wgo="${j}"><span>${esc(y.n)}</span><span>${d}/${y.s}</span></button>`; }).join('')+`</div>`;
  b.innerHTML=h;
  const on=(id,f)=>{ const el=document.getElementById(id); if(el) el.onclick=f; };
  // po zmianie ekranu (seria ↔ przerwa) przez 0,6 s ignoruj przyciski zmieniające etap — podwójne stuknięcie nie pominie przerwy
  const g=f=>()=>{ if(Date.now()-(WO.phaseAt||0)<600) return; f(); };
  on('woDone', g(woSetDone)); on('woGo', g(woStartSet));
  on('woTimer', g(()=>{ WO.tStart=Date.now(); WO.lastSec=null; woRender(); }));
  on('woStopUp', g(()=>{ const k2=woCurSet(WO.cur); WO.ex[WO.cur].sets[k2].r=Math.round((Date.now()-WO.tStart)/1000); WO.tStart=0; woSetDone(); }));
  on('woShow', ()=>openGuide(x.n));
  on('woHist', ()=>openExHist(x.n.trim()));
  on('woSwap', ()=>openSwap(WO.iso, WO.cur));
  on('woSwapUndo', ()=>swapUndo(WO.cur, WO.iso));   // opis techniki nad ekranem treningu
  on('woCam', ()=>openFormCheck(x.n, (v.kg?String(v.kg).replace('.',',')+' kg × ':'')+v.r+(x.timed?' s':' powt.')));
  on('woPlus', ()=>{ WO.restEnd+=15000; WO.restPlan+=15; WO.beeped=false; WO.plusCount=(WO.plusCount||0)+1; woSave(); if(WO.plusCount===2) woRender(); woStep(); });
  on('woRestEdit', ()=>openRestEdit(x.n, x.timed));
  on('woLightOff', ()=>{ const L=log(WO.iso); L.checkin=Object.assign({}, L.checkin, {plan:'normal', at:Date.now()}); touch(L); save(); woRefreshFromCard(); });
  on('woLearnNo', ()=>{ WO.ex[WO.cur].learnNo=true; woSave(); woRender(); woStep(); });
  { const ly=document.getElementById('woLearnYes'); if(ly) ly.onclick=()=>{ restSet(WO.ex[WO.cur].n, +ly.dataset.sec, 'me'); restToast('Przerwa '+fmtDur(+ly.dataset.sec)+' zapamiętana przy tym ćwiczeniu'); }; }
  on('woSkip', g(()=>{ const k2=woCurSet(WO.cur); WO.ex[WO.cur].ok[k2]=true; WO.ex[WO.cur].skipped=(WO.ex[WO.cur].skipped||0)+1; WO.skipped++; WO.tStart=0;
    if(woDone()===woTotal()) return woFinish(); if(woCurSet(WO.cur)<0) WO.cur=woNext(WO.cur); WO.setStart=Date.now(); woSave(); woRender(); }));
  on('woPrev', ()=>{ if(WO.cur>0){ WO.cur--; WO.tStart=0; woRender(); } }); on('woNx', ()=>{ if(WO.cur<WO.ex.length-1){ WO.cur++; WO.tStart=0; woRender(); } });
  b.querySelectorAll('[data-wgo]').forEach(y=>y.onclick=()=>{ WO.cur=+y.dataset.wgo; WO.tStart=0; woRender(); });
  b.querySelectorAll('[data-wd]').forEach(y=>y.onclick=()=>{
    const [f,d]=y.dataset.wd.split(':'), cx=WO.ex[WO.cur], k2=woCurSet(WO.cur); if(k2<0) return;
    const sv=cx.sets[k2], st= f==='kg' ? cx.step : (cx.timed?5:1);
    sv[f]=Math.max(0, Math.round((sv[f]+(+d)*st)*10)/10);
    // zmiana ciężaru przechodzi na kolejne niezrobione serie tego ćwiczenia
    if(f==='kg') cx.sets.forEach((q,j)=>{ if(j>k2 && !cx.ok[j]) q.kg=sv.kg; });
    woSave(); woRender();
  });
}

export function woFinish(){
  if(WO.pausedAt){ WO.pausedTotal=(WO.pausedTotal||0)+(Date.now()-WO.pausedAt); WO.pausedAt=0; }
  const t=Date.now();
  // dur = aktywny czas (bez pauz); pauzy i przejścia osobno. log — żeby „Dokończ trening” dołączył kolejne serie, a nie nadpisał
  const sess=Object.assign({start:WO.start, end:t, last:t, dur:Math.max(0,Math.round(woActive(t)/1000)),
    paused:Math.round((WO.pausedTotal||0)/1000), pauses:WO.pauses||0, gap:WO.gap||0, parts:WO.parts||1, prs:WO.prs||[],
    total:woTotal(), skipped:WO.skipped, title:WO.title, forms:WO.forms||[], log:WO.log},
    woAgg(WO.log, WO.ex.map(x=>({n:x.n, s:x.s, rest:x.rest}))));
  const L=log(WO.iso); L.session=sess; touch(L); save();
  WO.phase='summary'; WO.sess=sess; clearInterval(woTick); woTick=null; woSave();
  document.getElementById('woTotal').textContent=fmtDur(sess.dur);
  tmrBeep(988,.25); setTimeout(()=>tmrBeep(1319,.45),200);
  woRender();
}

export function woSummaryHtml(){
  const s=WO.sess, slowAvg=s.avgRestPlan && s.avgRest>s.avgRestPlan*1.2, idx=exIndex();
  // porównanie z poprzednim razem każdego ćwiczenia
  let vNow=0, vPrev=0;
  const cmp=s.ex.map(e=>{ const h=idx[e.n.trim()]; if(!h) return '';
    const cur=h.sess.find(q=>q.iso===WO.iso), prev=h.sess.filter(q=>q.iso<WO.iso).pop(); if(!cur||!prev) return '';
    if(h.kind==='kg' && cur.full){ vNow+=prMetrics('kg',cur).vol; vPrev+=prMetrics('kg',prev).vol; }   // tylko ćwiczenia zrobione w całości
    return `<div><span>${esc(e.n)}<br><small style="color:var(--ink-faint)">${prDD(prev.iso)}: ${prSetsText(h.kind,prev.sets)}</small></span><span>${prSetsText(h.kind,cur.sets)}</span></div>`; }).join('');
  const dv=vPrev?Math.round((vNow/vPrev-1)*100):null;
  return `<div class="wo-sum"><h2>Trening zakończony 💪</h2></div>
    <div class="wo-tiles">
      <div class="wo-tile"><b>${fmtDur(s.dur)}</b><small>CAŁY TRENING${s.paused-(s.gap||0)>0?' · PAUZY '+fmtDur(s.paused-(s.gap||0)):''}</small></div>
      <div class="wo-tile"><b>${s.done}/${s.total}</b><small>SERIE ZROBIONE</small></div>
      <div class="wo-tile"><b>${fmtDur(s.work)}</b><small>PRACA (SERIE)</small></div>
      <div class="wo-tile ${slowAvg?'warn':''}"><b>${fmtDur(s.avgRest)}</b><small>ŚREDNIA PRZERWA${s.avgRestPlan?' · PLAN '+fmtDur(s.avgRestPlan):''}</small></div>
    </div>
    ${s.parts>1?`<div class="wo-note"><b>Trening dokończony po przerwie ${fmtDur(s.gap)}.</b> Ta przerwa nie wlicza się do czasu treningu.${s.rebuilt?' Czasy pierwszej części odtworzone z godzin odhaczenia serii (przybliżone).':''}</div>`:''}
    ${(s.prs||[]).length?`<div class="wo-prs"><h4>🏆 Rekordy dziś · ${s.prs.length}</h4>${s.prs.map(p=>`<div><b>${esc(p.n)}</b><span>${prName(p.kind,p.t)}: ${esc(p.now)} <small>(poprzednio ${esc(p.was)})</small></span></div>`).join('')}</div>`:''}
    ${cmp?`<div class="wo-list"><h4>W porównaniu z poprzednim razem${dv!=null?' · objętość '+(dv>=0?'+':'')+dv+'%':''}</h4></div><div class="wo-rows">${cmp}</div>`:''}
    <div class="wo-rows">${s.ex.map(e=>`<div><span>${esc(e.n)} · ${e.sets}/${e.of}</span><span class="${e.avgRest>e.restPlan*1.2?'slow':''}">${e.avgRest?'przerwa '+fmtDur(e.avgRest)+' / plan '+fmtDur(e.restPlan):'—'}</span></div>`).join('')}</div>
    <div class="wo-note"><b>Trener widzi te dane.</b> Zapytaj np.: „Jak mi poszedł dzisiejszy trening?” albo „Czy moje przerwy są OK?”.</div>
    <button class="wo-save" id="woSave">ZAPISZ I ZAMKNIJ</button>`;
}

// „Zacznij dziś”: ten trening zamienia się z dzisiejszym dniem (jak „Przesuń”), potem tryb treningu
export function startToday(iso){
  const t=todayISO();
  setMoves(nextMoves({[t]:iso, [iso]:t}), `${iso<t?'Odrabiasz':'Zamieniono'}: ${dowOf(iso)} ${dmy(iso)} → dziś`);
  __set_viewOffset(0); showView('train'); renderToday();
  woStart(t);
}

export function woCanReset(iso, w, L){
  return hasSession(L) || (WO && WO.iso===iso) || w.ex.some((e0,i)=>{ const r=L.ex[iso+'_e'+i]; return exAny(r) || (r&&r.skip); });
}

export function woResetAsk(iso){
  const w=workoutOn(iso), L=log(iso);
  const n=w.ex.reduce((a,e0,i)=>a+okCount(L.ex[iso+'_e'+i], effEx(e0,iso).s),0);
  const bits=[]; if(n) bits.push(n+' odhaczon'+(n===1?'ą serię':(n%10>=2&&n%10<=4&&(n%100<12||n%100>14))?'e serie':'ych serii'));
  if(hasSession(L)) bits.push('zmierzony czas ('+fmtDur(L.session.dur)+')');
  if(WO && WO.iso===iso) bits.push('trwający tryb treningu');
  document.getElementById('wrText').textContent=(bits.length?'Usunę '+bits.join(', ')+'. ':'')+'Ciężary i powtórzenia wpisane w pola zostają.';
  document.getElementById('woResetDialog').style.display='flex';
  document.getElementById('wrYes').onclick=()=>{ document.getElementById('woResetDialog').style.display='none'; woReset(iso); };
}

export function woReset(iso){
  const w=workoutOn(iso), L=log(iso), keys=w.ex.map((e0,i)=>iso+'_e'+i);
  woUndoSnap={iso, ex:JSON.parse(JSON.stringify(keys.map(k=>[k,L.ex[k]]))), session:L.session?JSON.parse(JSON.stringify(L.session)):null, wo:WO&&WO.iso===iso?JSON.parse(JSON.stringify(WO)):null};
  w.ex.forEach((e0,i)=>{ const k=keys[i], n=effEx(e0,iso).s, r=L.ex[k]; if(!r) return;
    for(let s=1;s<=n;s++) if(setOk(r,s)) exTick(L,k,n,s,false);
    if(L.ex[k].skip){ L.ex[k].skip=false; mark(L,'skip:'+k); } });
  if(L.session) L.session={cleared:true, end:Date.now()};
  if(WO && WO.iso===iso){ clearInterval(woTick); woTick=null; WO=null; woSave(); woWakeLock(false); document.getElementById('woFocus').style.display='none'; }
  touch(L); save(); renderToday();
  const t=document.getElementById('woToast'); document.getElementById('woToastTxt').textContent='Trening zresetowany'; t.style.display='flex';
  clearTimeout(woToastTimer); woToastTimer=setTimeout(()=>{ t.style.display='none'; woUndoSnap=null; }, 6000);
}

export function woClose(){ WO=null; woSave(); clearInterval(woTick); woTick=null; woWakeLock(false); document.getElementById('woFocus').style.display='none'; renderToday(); }

// trwający trening po ponownym otwarciu aplikacji (do 5 h, ten sam dzień)
export function woResume(){
  try{ const w=JSON.parse(localStorage.getItem(WO_LS)||'null');
    if(w && w.iso===todayISO() && Date.now()-w.start<5*3600e3){ WO=w; if(WO.phase==='summary'){ document.getElementById('woFocus').style.display='flex'; woRender(); } else woStart(w.iso); }
    else if(w) localStorage.removeItem(WO_LS);
  }catch(e){}
}

export function __init_22(){

/* ============================================================
   TRYB TRENINGU (beta): pełny ekran z bieżącą serią, odliczanie przerwy po każdej serii,
   pomiar czasu całego treningu, serii i przerw. Seria zrobiona tutaj odhacza się w karcie tak jak ręcznie.
   Po zakończeniu: S.log[dzień].session (synchronizowane, widzi je Trener).
   Trwający trening zapamiętany w tej przeglądarce (zelazo_workout), więc przeżyje zamknięcie karty.
   ============================================================ */
fmtDur = s=>{ s=Math.max(0,Math.round(s||0)); const h=Math.floor(s/3600), m=Math.floor(s%3600/60), x=s%60; return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(x).padStart(2,'0'); };
}

export function __init_28(){

WO_LS = 'zelazo_workout';
WO = null;
woTick = null;
woWake = null;
woCurSet = i=>WO.ex[i].ok.indexOf(false);
woDone = ()=>WO.ex.reduce((a,x)=>a+x.ok.filter(Boolean).length,0);
woTotal = ()=>WO.ex.reduce((a,x)=>a+x.s,0);
document.addEventListener('visibilitychange',()=>{ if(!document.hidden && WO && WO.phase!=='summary') woWakeLock(true); });
prToastT = null;
document.getElementById('prOk').onclick=()=>{ document.getElementById('prPop').style.display='none'; };
document.getElementById('prPop').onclick=e=>{ if(e.target.id==='prPop') e.target.style.display='none'; };
/* ---- reset dzisiejszego treningu: odhaczone serie, „Pomiń”, zmierzony czas i trwający tryb treningu ----
   Ciężary i powtórzenia w polach zostają. Sesja dostaje znacznik {cleared, end}, żeby starszy zapis z innego urządzenia nie wrócił. */
hasSession = L=>!!(L && L.session && !L.session.cleared);
document.getElementById('wrNo').onclick=()=>{ document.getElementById('woResetDialog').style.display='none'; };
document.getElementById('woResetDialog').addEventListener('click',e=>{ if(e.target.id==='woResetDialog') e.currentTarget.style.display='none'; });
woUndoSnap = null;
woToastTimer = null;
// „Cofnij”: przywróć serie i pomiar; nowe znaczniki czasu, żeby wygrały przy synchronizacji
document.getElementById('woUndo').onclick=()=>{
  const u=woUndoSnap; if(!u) return; woUndoSnap=null;
  const L=log(u.iso);
  u.ex.forEach(([k,r])=>{ if(r===undefined) return; L.ex[k]=r; mark(L,'ex:'+k); mark(L,'skip:'+k); if(r&&r.ok) Object.keys(r.ok).forEach(s=>mark(L,'ok:'+k+':'+s)); });
  if(u.session){ L.session=Object.assign({}, u.session, {end:Date.now()}); }
  if(u.wo){ WO=u.wo; woSave(); }
  touch(L); save(); renderToday();
  document.getElementById('woToast').style.display='none';
};
// w pasku: Wstrzymaj / Wznów (zakończenie jest na ekranie pauzy); po treningu — Zamknij
document.getElementById('woEnd').onclick=()=>{ if(!WO) return; if(WO.phase==='summary'){ woClose(); return; } if(WO.pausedAt) woUnpause(); else woPause(); };

document.getElementById('syncWarn').onclick=()=>{ showView('set'); moreOpen('sync'); setTimeout(()=>document.getElementById('cloudState').scrollIntoView({block:'center'}),200); };
}
