// ŻELAZO — Cykl i samopoczucie: zapis okresów, prognoza, wzorce, kontekst dla Trenera.
// Moduł zawiera tylko deklaracje; kod startowy jest w __init_N, wywoływanych przez main.js w stałej kolejności.
import { S, save } from '../core/state';
import { cycleDay, cycleForecast, cycleGaps, cycleLength, cyclePatterns, phaseNote } from '../lib/cycle';
import { addDays, daysBetween, parseISO, todayISO } from '../lib/dates';
import { esc } from '../screens/accounts';
import { prDD } from '../screens/history';
import { moreStatus } from '../screens/more';
import { renderWeight } from '../screens/progress';
import { renderToday } from '../screens/train';
import { restToast } from './rest';
import { swapToast } from './swap';
import { dec, plural, t } from '../lib/i18n';

export let CY_LS, CYC, CY_SIT, CY_SYM, CY_SYM_MENO, CY_PH, CYS, CY_PH_ORDER, CY_PH_SHORT, CY_PH_IN;
export function __set_CYC(v){ CYC=v; return v; }

export function cyGet(){
  if(CYC) return CYC;
  let l:any={}; try{ l=JSON.parse(localStorage.getItem(CY_LS)||'null')||{}; }catch(e){}
  const r=S.cyc;
  if(r && (r.at||0)>(l.at||0)){
    l = r.off ? Object.assign({}, l, {sync:false, at:r.at}) : (r.data||l);
    try{ localStorage.setItem(CY_LS, JSON.stringify(l)); }catch(e){}
  }
  return CYC=l;
}

export function cySave(c){
  c.at=Date.now(); CYC=c;
  try{ localStorage.setItem(CY_LS, JSON.stringify(c)); }catch(e){}
  if(c.sync){ S.cyc={at:c.at, data:c}; save(); }
  else if(S.cyc && !S.cyc.off){ S.cyc={at:c.at, off:true}; save(); }   // usuń kopię z serwera
}

export function cyTracking(){ const c=cyGet(); return !!(c.on && c.sit && c.sit!=='none'); }

export function cyDiff(a,b){ return daysBetween(a,b); }

export function cyPeriods(){ return ((cyGet().periods)||[]).slice().sort((a,b)=>a.s<b.s?-1:1); }

export function cyLen(){ return cycleLength(cyPeriods()); }

export function cyInfo(iso){
  if(!cyTracking()) return null;
  return cycleDay(cyPeriods(), cyGet().sit, iso);
}

export function cySym(iso){ return ((cyGet().sym||{})[iso])||[]; }

export function cySetSym(iso, list){ const c=Object.assign({}, cyGet()); c.sym=Object.assign({}, c.sym||{}); if(list.length) c.sym[iso]=list; else delete c.sym[iso]; cySave(c); }

export function cyPeriodStart(iso){ const c=Object.assign({}, cyGet()); c.periods=cyPeriods().filter(p=>p.s!==iso); c.periods.push({s:iso, e:null, flow:{}}); cySave(c); }

export function cyPeriodEnd(iso){ const c=Object.assign({}, cyGet()); const ps=cyPeriods(), p=ps.filter(q=>q.s<=iso).pop(); if(p){ p.e=iso; delete p.auto; c.periods=ps; cySave(c); } }

export function cyPatchPeriod(start, patch){ const c=Object.assign({}, cyGet()), ps=cyPeriods(); ps.forEach(p=>{ if(p.s===start) Object.assign(p, patch); }); c.periods=ps; cySave(c); }

// koniec bez odpowiedzi: 7. dzień albo ostatni dzień „Jeszcze trwa”; oznaczony jako automatyczny
export function cyAutoEnd(p){ const e=p.still && p.still>addDays(p.s,6) ? p.still : addDays(p.s,6); cyPatchPeriod(p.s, {e, auto:true}); }

export function cyPeriodLen(p){ return p.e ? cyDiff(p.s, p.e)+1 : null; }

export function cyFlow(iso, f){ const c=Object.assign({}, cyGet()); const ps=cyPeriods(), p=ps.filter(q=>q.s<=iso).pop(); if(p){ p.flow=Object.assign({}, p.flow||{}, {[iso]:f}); c.periods=ps; cySave(c); } }

// pasek nad treningiem: dzień cyklu i jedno stuknięcie „okres się zaczął”
export function cyRenderBox(iso){
  const box=document.getElementById('cyBox'); if(!box) return;
  const inf=cyInfo(iso);
  if(!inf || inf.sit==='preg'){ box.innerHTML=''; return; }
  const today=iso===todayISO(), fl=inf.inPeriod && inf.p && inf.p.flow ? inf.p.flow[iso] : null;
  if(today && inf.p && !inf.p.e && !inf.inPeriod){ cyAutoEnd(inf.p); return cyRenderBox(iso); }   // brak odpowiedzi — koniec przyjęty automatycznie
  const askEnd=today && inf.inPeriod && inf.p && !inf.p.e && inf.day>=3 && inf.p.still!==iso;
  // jedna linia: dzień cyklu + przycisk (początek albo koniec okresu)
  const PH={period:'okres', foll:'folikularna', ov:'owulacja', lut:'lutealna'};
  let row='';
  const fc=today && !inf.inPeriod ? cyForecast() : null, soon=fc && !fc.late && fc.in>=1 && fc.in<=3 ? t(' · okres za ~{d}', {d:plural(fc.in,'{n} dzień','{n} dni','{n} dni','{n} day','{n} days')}) : fc && fc.late ? t(' · spóźnia się {d}', {d:plural(fc.late,'{n} dzień','{n} dni','{n} dni','{n} day','{n} days')}) : '';
  if(inf.day && (inf.sit==='natural' || inf.inPeriod)) row+=`<span class="cy-chip">● ${inf.sit==='natural'?t('dzień {n} · ', {n:inf.day}):''}${t(PH[inf.phase]||(inf.inPeriod?'okres':''))}${soon}</span>`;
  if(today && inf.inPeriod) row+= inf.p && inf.p.e ? `<span class="cy-endnote">${t('koniec:')} ${inf.p.e===iso?t('dziś'):prDD(inf.p.e)}</span>` : `<button class="cy-end" data-cyend>${t('Koniec okresu')}</button>`;
  else if(today && inf.sit!=='meno') row+=`<button class="cy-start" data-cystart>${t('＋ Okres się zaczął')}</button>`;
  let h=row?`<div class="cy-row1">${row}</div>`:'';
  if(today && inf.inPeriod) h+=`<div class="cy-flow"><span>${t('Krwawienie:')}</span>${[['light',t('Lekkie')],['medium',t('Średnie')],['heavy',t('Obfite')]].map(([k,l])=>`<button data-cyflow="${k}" class="${fl===k?'on':''}">${l}</button>`).join('')}</div>`;
  if(askEnd) h+=`<div class="cy-confirm"><b>${t('Okres już się skończył?')}</b><span>${t('Dzień {n} okresu. Zapisana długość pomoże lepiej dopasować trening w kolejnych cyklach.', {n:inf.day})}</span>
    <div class="row"><button class="yes" data-cyendt="0">${t('Tak, dziś')}</button><button class="yes" data-cyendt="1">${t('Tak, wczoraj')}</button><button data-cystill>${t('Jeszcze trwa')}</button></div></div>`;
  if(today && inf.inPeriod && inf.day>7 && !(inf.p.longNote)) h+=`<div class="cy-confirm"><b>${t('Krwawienie trwa już {n} dni.', {n:inf.day})}</b><span>${t('Okres dłuższy niż 7 dni warto skonsultować z lekarzem — zwłaszcza gdy jest obfity albo powtarza się co cykl.')}</span><div class="row"><button data-cylong>${t('Rozumiem')}</button></div></div>`;
  box.innerHTML=h;
  box.querySelectorAll('[data-cyflow]').forEach(b=>b.onclick=()=>{ cyFlow(iso, b.dataset.cyflow); cyRenderBox(iso); });
  const e=box.querySelector('[data-cyend]'); if(e) e.onclick=()=>{ cyPeriodEnd(iso); cyRenderBox(iso); restToast(t('Zapisano koniec okresu')); };
  box.querySelectorAll('[data-cyendt]').forEach(b=>b.onclick=()=>{ const d=addDays(iso, -(+b.dataset.cyendt)); cyPeriodEnd(d); renderToday(); restToast(t('Zapisano koniec okresu')+' · '+prDD(d)); });
  const sl=box.querySelector('[data-cystill]'); if(sl) sl.onclick=()=>{ cyPatchPeriod(inf.p.s, {still:iso}); cyRenderBox(iso); };
  const ln=box.querySelector('[data-cylong]'); if(ln) ln.onclick=()=>{ cyPatchPeriod(inf.p.s, {longNote:true}); cyRenderBox(iso); };
  const st=box.querySelector('[data-cystart]'); if(st) st.onclick=()=>cyAskStart(iso);
}

// „Okres się zaczął”: mniej niż 15 dni od poprzedniego to prawie zawsze pomyłka albo plamienie — najpierw pytamy
export function cyAskStart(iso){
  const prev=cyPeriods().filter(p=>p.s<iso).pop(), gap=prev?cyDiff(prev.s, iso):99;
  if(gap>=15){ cyDoStart(iso); return; }
  const box=document.getElementById('cyBox');
  box.innerHTML=`<div class="cy-confirm"><b>${t('Poprzedni okres zaczął się {d} — {g} temu.', {d:prDD(prev.s), g:plural(gap,'{n} dzień','{n} dni','{n} dni','{n} day','{n} days')})}</b>
    <span>${t('To nowy okres? Plamienie między miesiączkami możesz zaznaczyć w check-inie jako objaw.')}</span>
    <div class="row"><button class="yes" data-cyyes>${t('Tak, nowy okres')}</button><button data-cyno>${t('Anuluj')}</button></div></div>`;
  box.querySelector('[data-cyyes]').onclick=()=>cyDoStart(iso);
  box.querySelector('[data-cyno]').onclick=()=>cyRenderBox(iso);
}

export function cyDoStart(iso){
  cyPeriodStart(iso); cyRenderBox(iso);
  swapToast(t('Zapisano: dzień 1 cyklu'), ()=>{ const c=Object.assign({}, cyGet()); c.periods=cyPeriods().filter(p=>p.s!==iso); cySave(c); renderToday(); });
}

export function cyMoveHtml(){
  return `<div class="cy-move"><b>${t('Lekki ruch · ok. 25 min')}</b><span>${t('Spacer 15 min · krążenia bioder i koci grzbiet 5 min · rozciąganie dolnej części pleców 5 min. Ruch często łagodzi skurcze.')}</span><button data-cytrain>${t('Jednak trenuję')}</button></div>`;
}

// dodatkowe 30 s przerwy w dni z objawami (check-in)
export function ciRestPlus(iso){ const c=S.log[iso] && S.log[iso].checkin; return (c && c.restPlus) || 0; }

export function openCycle(){ CYS={del:false}; renderCycle(); document.getElementById('cySheet').style.display='flex'; document.getElementById('cyPanel').scrollTop=0; }

export function closeCycle(){ document.getElementById('cySheet').style.display='none'; }

export function renderCycle(){
  const c=cyGet();
  const sw=(k,on,label)=>`<button class="cy-sw ${on?'on':''}" data-cyt="${k}" aria-pressed="${on}" aria-label="${label}"></button>`;
  document.getElementById('cyPanel').innerHTML=`<div class="eh-grab"></div>
    <div class="eh-head"><div style="flex:1;min-width:0"><div class="eyebrow">${t('Dobrowolne')}</div><h2 id="cyTitle">${t('Cykl i samopoczucie')}</h2></div><button class="eh-x" data-cyclose aria-label="${t('Zamknij')}">✕</button></div>
    <div class="cy-row"><div><b>${t('Śledzenie cyklu')}</b><small>${t('Dopasuje trening, check-in i komentarze do wagi do Twojego cyklu i samopoczucia.')}</small></div>${sw('on', !!c.on, t('Śledzenie cyklu'))}</div>
    ${c.on?`<div class="sw-lab">${t('Twoja sytuacja')}</div>
      <div class="cy-opts">${CY_SIT.map(([k,n,d])=>`<button class="${c.sit===k?'on':''}" data-cysit="${k}"><b>${t(n)}</b><small>${t(d)}</small></button>`).join('')}<button class="${c.sit==='none'?'on':''}" data-cysit="none"><b>${t('Wolę nie śledzić')}</b><small>${t('zwykły check-in, nic się nie zmienia')}</small></button></div>
      ${cyStage2Html()}
      ${c.sit && c.sit!=='none' && c.sit!=='meno' && c.sit!=='preg'?`<div class="sw-lab">${t('Zapisane okresy')}</div>
        <div class="cy-list">${cyPeriods().slice().reverse().map(p=>{ const pv=cyPeriods().filter(q=>q.s<p.s).pop(), g=pv?cyDiff(pv.s,p.s):null;
          // uwaga stoi przy podejrzanym (późniejszym) wpisie — to on jest zwykle pomyłką
          // początek i koniec do poprawienia; koniec może być pusty, póki okres trwa
          return `<div class="cy-pr2 ${g!=null&&g<15?'warn':''}">
            <label>${t('Początek')}<input type="date" class="md-in" data-cyedit="${p.s}" value="${p.s}" max="${todayISO()}"></label>
            <label>${t('Koniec')}<input type="date" class="md-in" data-cyend2="${p.s}" value="${p.e||''}" min="${p.s}" max="${todayISO()}"></label>
            <button data-cyrm="${p.s}" aria-label="${t('Usuń okres z {d}', {d:prDD(p.s)})}">✕</button>
            <span class="g">${g==null?t('pierwszy zapisany'):g<15?'<b>'+t('tylko {n} dni po poprzednim?', {n:g})+'</b>':t('{n} dni po poprzednim', {n:g})}${cyPeriodLen(p)?t(' · trwał {d}', {d:plural(cyPeriodLen(p),'{n} dzień','{n} dni','{n} dni','{n} day','{n} days')})+(p.auto?t(' (przyjęte automatycznie — popraw, jeśli trzeba)'):''):t(' · koniec niezapisany')}</span></div>`; }).join('')||'<div class="rs-hint">'+t('Brak zapisanych okresów.')+'</div>'}</div>
        <div class="cy-pr add"><input type="date" class="md-in" id="cyAdd" max="${todayISO()}" aria-label="${t('Dodaj początek okresu')}"><span class="g">${t('dodaj wcześniejszy okres')}</span></div>
        <div class="rs-hint">${t('Najnowszy okres jest na górze. ✕ usuwa tylko ten jeden wpis.')}</div>`:''}
      <div class="sw-lab">${t('Prywatność')}</div>
      <div class="cy-row"><div><b>${t('Tylko na tym telefonie')}</b><small>${c.sync?t('Synchronizacja włączona — dane o cyklu trafiają na serwer aplikacji razem z resztą. Administrator aplikacji technicznie ma do nich dostęp.'):t('Dane o cyklu nie są wysyłane na serwer ani na inne urządzenia.')}</small></div>${sw('local', !c.sync, t('Tylko na tym telefonie'))}</div>
      <div class="cy-row"><div><b>${t('Trener może z tego korzystać')}</b><small>${t('Dzień cyklu i objawy idą do Trenera tylko razem z Twoim pytaniem.')}</small></div>${sw('coach', c.coach!==false, t('Trener może korzystać z danych o cyklu'))}</div>
      <button class="ci-alt" data-cydel style="color:var(--red)">${CYS.del?t('Na pewno? Stuknij jeszcze raz, żeby usunąć'):t('Usuń historię cyklu')}</button>`:''}
    <div class="rs-hint">${t('Nigdy nie włącza się sama. Dopasowanie treningu zawsze jest propozycją — decyzja należy do Ciebie. Aplikacja nie stawia diagnoz.')}</div>`;
  const panel=document.getElementById('cyPanel');
  panel.querySelectorAll('[data-cyedit]').forEach(inp=>inp.onchange=()=>{ const old=inp.dataset.cyedit, v=inp.value; if(!v || v===old) return;
    const c2=Object.assign({}, cyGet()), ps=cyPeriods();
    if(ps.some(p=>p.s===v)){ renderCycle(); return; }   // taki wpis już jest
    ps.forEach(p=>{ if(p.s===old){ p.s=v; if(p.e && p.e<v) p.e=null; p.flow={}; } }); c2.periods=ps; cySave(c2); renderToday(); renderCycle(); });
  panel.querySelectorAll('[data-cyend2]').forEach(inp=>inp.onchange=()=>{ const st=inp.dataset.cyend2, v=inp.value;
    if(v && (v<st || v>todayISO())){ renderCycle(); return; }   // koniec nie przed początkiem i nie w przyszłości
    const c2=Object.assign({}, cyGet()), ps=cyPeriods();
    ps.forEach(p=>{ if(p.s===st){ p.e=v||null; delete p.auto; delete p.still; } }); c2.periods=ps; cySave(c2); renderToday(); renderCycle(); restToast(v?t('Zapisano koniec okresu')+' · '+prDD(v):t('Usunięto datę końca')); });
  panel.querySelectorAll('[data-cyrm]').forEach(b=>b.onclick=()=>{ const c2=Object.assign({}, cyGet()); c2.periods=cyPeriods().filter(p=>p.s!==b.dataset.cyrm); cySave(c2); renderToday(); renderCycle(); restToast(t('Usunięto wpis')); });
  const ad=document.getElementById('cyAdd');
  if(ad) ad.onchange=()=>{ if(!ad.value) return; const c2=Object.assign({}, cyGet()), ps=cyPeriods(); if(!ps.some(p=>p.s===ad.value)){ ps.push({s:ad.value, e:addDays(ad.value,4), flow:{}}); c2.periods=ps; cySave(c2); } renderToday(); renderCycle(); };
}

// wykres wagi: dni okresu i tydzień przed nim (tylko naturalny cykl)
export function cyChartBands(ctx, XT, t0, span, pad, W, H){
  const inf=cyTracking() && cyGet().sit==='natural'; if(!inf) return;
  const DAY=864e5, L=cyLen(), starts=cyPeriods().map(p=>p.s), now=todayISO();
  const next=starts.length ? addDays(starts[starts.length-1], L) : null;
  const band=(a,b,alpha)=>{ const ta=parseISO(a).getTime(), tb=parseISO(b).getTime()+DAY; if(tb<t0 || ta>t0+span) return;
    const x1=Math.max(pad.l, XT(ta)), x2=Math.min(W-pad.r, XT(tb)); if(x2<=x1) return;
    ctx.fillStyle=`rgba(197,139,214,${alpha})`; ctx.fillRect(x1, pad.t, x2-x1, H-pad.t-pad.b); };
  cyPeriods().forEach(p=>band(p.s, p.e||addDays(p.s,4), .22));
  starts.concat(next && next<=addDays(now,7) ? [next] : []).forEach(s=>band(addDays(s,-7), addDays(s,-1), .09));
}

export function cyWeightNote(){
  const el=document.getElementById('wCycleNote'); if(!el) return;
  const inf=cyInfo(todayISO()), ws=S.weights.slice().sort((a,b)=>a.d<b.d?-1:1);
  el.style.display='none';
  if(!inf || inf.sit!=='natural' || ws.length<2) return;
  const lastW=ws[ws.length-1], wk=ws.filter(w=>w.d<=addDays(lastW.d,-6)).pop(); if(!wk) return;
  const dv=lastW.w-wk.w, late=inf.phase==='lut' || (inf.inPeriod && inf.day<=3);
  if(dv>=0.5 && late){ el.innerHTML=t('<b>+{kg} kg w ostatnim tygodniu?</b>', {kg:dec(dv,1)})+' '+(inf.inPeriod?t('To początek okresu'):t('To dni przed okresem'))+t(' — zwykle woda, nie tłuszcz. Patrz na trend (niebieska linia); cel kalorii się nie zmienia.'); el.style.display='block'; }
}

/* ---- cykl, etap 2: prognoza, Twoje wzorce i dopasowanie z Twoich danych ----
   Prognoza: ostatni okres + średnia długość cyklu, rozrzut z odchylenia (min. 2 dni, przy nieregularnym 4, max 7).
   Wzorce: check-iny (sen, zakwasy, energia 0–2) i objawy pogrupowane po fazach — tylko naturalny cykl,
   co najmniej 3 check-iny w dwóch fazach. Wszystko liczone na telefonie z danych, które już są. */
export function cyGaps(){ return cycleGaps(cyPeriods()); }

export function cyForecast(){
  if(!cyTracking()) return null;
  return cycleForecast(cyPeriods(), cyGet().sit, todayISO());
}

export function cyPatterns(){
  if(!cyTracking() || cyGet().sit!=='natural') return null;
  const points=Object.keys(S.log||{}).map(iso=>({iso, ci:S.log[iso].checkin}))
    .filter(x=>x.ci && x.ci.energy!=null && x.ci.plan!=='skip').map(x=>({iso:x.iso, energy:x.ci.energy, sleep:x.ci.sleep, sore:x.ci.sore}));
  return cyclePatterns(points, cyGet().sym||{}, iso=>{ const inf=cyInfo(iso); return (inf && inf.phase) || null; });
}

// czy ta faza jest u Ciebie zwykle słabsza / mocniejsza niż średnio (energia w check-inie)
export function cyPhaseNote(phase){ return phaseNote(cyPatterns(), phase); }

export function cyInsights(P){
  const out=[], ok=Object.entries(P.by).filter(([,b])=>b.n>=3).sort((a,b)=>a[1].energy-b[1].energy);
  if(ok.length>=2){ const lo=ok[0], hi=ok[ok.length-1];
    if(hi[1].energy-lo[1].energy>=0.4) out.push(t('Energia jest u Ciebie najniższa <b>{a}</b>, a najwyższa <b>{b}</b>. Check-in uwzględnia to przy propozycji treningu.', {a:t(CY_PH_IN[lo[0]]), b:t(CY_PH_IN[hi[0]])}));
    else out.push(t('Twoja energia jest podobna we wszystkich fazach — trening idzie według planu i samopoczucia z danego dnia.')); }
  const sl=ok.slice().sort((a,b)=>a[1].sleep-b[1].sleep); if(sl.length>=2 && sl[sl.length-1][1].sleep-sl[0][1].sleep>=0.5) out.push(t('Najgorzej śpisz <b>{a}</b>.', {a:t(CY_PH_IN[sl[0][0]])}));
  Object.entries(P.sym).filter(([,o])=>o.n>=3).forEach(([k,o])=>{ const top=CY_PH_ORDER.filter(ph=>o[ph]).sort((a,b)=>o[b]-o[a])[0];
    if(top && o[top]/o.n>=0.6) out.push(t('{s}: głównie <b>{a}</b> ({x} z {n} razy).', {s:esc(t(k)), a:t(CY_PH_IN[top]), x:o[top], n:o.n})); });
  return out;
}

export function cyStage2Html(){
  const f=cyForecast(); if(!f) return '';
  const d=x=>prDD(x);
  let h=`<div class="sw-lab">${t('Prognoza')}</div><div class="cy-fc">`;
  if(f.late) h+=`<b class="late">${t('Okres spóźnia się o {d}', {d:plural(f.late,'{n} dzień','{n} dni','{n} dni','{n} day','{n} days')})}</b><span>${t('Prognoza: {a}–{b}. Kilka dni spóźnienia zdarza się przy stresie, chorobie czy dużym deficycie kalorii. Zaznacz „Okres się zaczął”, gdy przyjdzie.', {a:d(f.from), b:d(f.to)})}</span>`;
  else if(f.in<=0) h+=`<b>${t('Następny okres: ok. {d}', {d:d(addDays(f.next, f.L))})}</b>`;
  else h+=`<b>${t('Następny okres: ok. {d}', {d:d(f.next)})}</b><span>${t('między {a} a {b} · za {d}', {a:d(f.from), b:d(f.to), d:plural(f.in,'{n} dzień','{n} dni','{n} dni','{n} day','{n} days')})}</span>`;
  h+=`<span>${f.n?t('Średni cykl {L} dni (z {n}{r}).', {L:f.L, n:plural(f.n,'{n} cyklu','{n} cykli','{n} cykli','{n} cycle','{n} cycles'), r:f.n>=2?': '+f.min+'–'+f.max+' '+t('dni'):''}):t('Prognoza z jednego zapisanego okresu — przyjęto 28 dni. Z każdym kolejnym okresem będzie dokładniejsza.')}${f.sit==='natural'&&!f.late&&f.in>7?' '+t('Dni przed okresem od ok. {d}.', {d:d(f.pre)}):''}</span>
    <span style="font-size:12px;color:var(--ink-faint)">${t('To szacunek do planowania treningu — nie nadaje się do antykoncepcji ani planowania ciąży.')}</span></div>`;
  const P=cyPatterns();
  if(P){
    h+=`<div class="sw-lab">${t('Twoje wzorce')}</div><div class="cy-pat">`;
    if(!P.ready) h+=`<p>${t('Wzorce pojawią się po kilku check-inach przed treningiem w różnych fazach cyklu (co najmniej 3 w dwóch fazach). Na razie: {n} w fazach cyklu.', {n:plural(P.n,'{n} check-in','{n} check-iny','{n} check-inów','{n} check-in','{n} check-ins')})}</p>`;
    else {
      h+=`<p style="color:var(--ink-faint);font-size:12px">${t('Energia z check-inu (0–2), średnio w fazie')}</p>`+CY_PH_ORDER.filter(ph=>P.by[ph]).map(ph=>{ const b=P.by[ph];
        return `<div class="r"><span>${t(CY_PH_SHORT[ph])}</span><span class="bar"><i style="width:${Math.round(b.energy/2*100)}%"></i></span><small>${dec(b.energy,1)} · plural(b.n,'{n} dzień','{n} dni','{n} dni','{n} day','{n} days')</small></div>`; }).join('');
      h+=cyInsights(P).map(x=>`<p>${x}</p>`).join('');
    }
    h+=`</div>`;
  }
  return h;
}

// kontekst dla Trenera — tylko za zgodą
export function cyCoachContext(today){
  const c=cyGet(); if(!cyTracking() || c.coach===false) return '';
  const inf=cyInfo(today), sitName=(CY_SIT.find(x=>x[0]===c.sit)||[])[1]||c.sit, ps=cyPeriods(), out=[];
  out.push('Cykl (dane od użytkowniczki, za zgodą): '+sitName+(inf&&inf.day?', dziś dzień '+inf.day+(inf.phase?' ('+CY_PH[inf.phase]+')':''):'')+(c.sit==='natural'&&ps.length>=2?', średnia długość cyklu '+cyLen()+' dni':''));
  if(ps.length) out.push('Ostatnie okresy: '+ps.slice(-4).map(p=>{ const f=Object.values(p.flow||{}); return prDD(p.s)+(p.e?'–'+prDD(p.e)+' ('+cyPeriodLen(p)+' dni'+(p.auto?', koniec szacowany':'')+')':'')+(f.includes('heavy')?' (obfity)':''); }).join(', '));
  { const lg=ps.slice(-3).filter(p=>(cyPeriodLen(p)||0)>7 && !p.auto); if(lg.length) out.push('UWAGA: krwawienie dłuższe niż 7 dni ('+lg.map(p=>prDD(p.s)+': '+cyPeriodLen(p)+' dni').join(', ')+') — delikatnie zasugeruj konsultację z lekarzem, zwłaszcza przy obfitym krwawieniu.'); }
  const since=addDays(today,-14), sy=Object.keys(c.sym||{}).filter(k=>k>=since).sort().map(k=>prDD(k)+': '+c.sym[k].join(', ').toLowerCase());
  if(sy.length) out.push('Objawy (14 dni): '+sy.join('; '));
  { const f=cyForecast(); if(f) out.push(f.late?'Okres spóźnia się o '+f.late+' dni (prognoza '+prDD(f.from)+'–'+prDD(f.to)+').':'Prognoza następnego okresu: ok. '+prDD(f.next)+' ('+prDD(f.from)+'–'+prDD(f.to)+').');
    const P=cyPatterns(); if(P && P.ready) out.push('Wzorce z check-inów: '+CY_PH_ORDER.filter(ph=>P.by[ph]&&P.by[ph].n>=3).map(ph=>CY_PH_SHORT[ph].toLowerCase()+' — energia '+P.by[ph].energy.toFixed(1)+'/2 ('+P.by[ph].n+' dni)').join(', ')+'.'); }
  out.push('Zasady: empatycznie i rzeczowo, bez diagnoz; dopasowanie do objawów, nie do kalendarza (różnice między kobietami są duże); decyzja należy do niej. Wzrost wagi przed okresem to zwykle woda — nie obcinaj z tego powodu kalorii. Przy obfitych krwawieniach podpowiadaj produkty z żelazem.');
  // sygnały ostrzegawcze
  const lastS=ps.length?ps[ps.length-1].s:null;
  if(lastS && (c.sit==='natural'||c.sit==='irregular')){
    const gap=cyDiff(lastS, today);
    if(gap>90) out.push('UWAGA: brak okresu od '+gap+' dni (bez ciąży/menopauzy/antykoncepcji w ustawieniach). Nie obniżaj kalorii, przy deficycie zaproponuj powrót do zapotrzebowania i kontakt z lekarzem (możliwy niski dostęp energii).');
  }
  if(c.sit==='natural' && ps.length>=4){ const d=[]; for(let i=1;i<ps.length;i++) d.push(cyDiff(ps[i-1].s, ps[i].s)); const r=d.slice(-3);
    if(r.every(x=>x<21) || r.every(x=>x>35)) out.push('UWAGA: ostatnie cykle stale '+(r[0]<21?'krótsze niż 21':'dłuższe niż 35')+' dni — delikatnie zasugeruj konsultację z lekarzem.'); }
  return out.join('\n');
}

export function __init_27(){

/* ---- cykl i samopoczucie (dobrowolne) ----
   Dane o cyklu są wrażliwe: domyślnie tylko w localStorage (zelazo_cycle). Po włączeniu synchronizacji
   kopia w S.cyc = {at, data} (nowsza wygrywa; wyłączenie zostawia {at, off:true}, żeby zniknęły z serwera).
   Dopasowanie treningu wynika z objawów, dzień cyklu jest kontekstem (badania: różnice indywidualne są duże). */
CY_LS = 'zelazo_cycle';
CYC = null;
CY_SIT = [
  ['natural','Naturalny cykl','dzień i faza cyklu, prognoza okresu'],
  ['hormonal','Antykoncepcja hormonalna','bez faz — tylko krwawienie i objawy'],
  ['irregular','Nieregularny cykl / PCOS','bez prognoz — zapisane okresy i objawy'],
  ['meno','Okołomenopauza / menopauza','objawy: uderzenia gorąca, sen, nastrój'],
  ['preg','Ciąża / po porodzie','trening tylko za zgodą lekarza; aplikacja nie dopasowuje planu']
];
CY_SYM = ['Skurcze','Ból głowy','Wzdęcia','Obniżony nastrój','Ból piersi','Obfite krwawienie','Plamienie','Trawienie'];
CY_SYM_MENO = ['Uderzenia gorąca','Gorszy sen','Obniżony nastrój','Ból stawów','Ból głowy'];
CY_PH = {period:'okres', foll:'faza folikularna', ov:'okolice owulacji', lut:'faza lutealna'};
// Więcej → Cykl i samopoczucie
CYS = null;
document.getElementById('cySheet').addEventListener('click', ev=>{
  const tg=ev.target.closest('[data-cyclose],[data-cyt],[data-cysit],[data-cydel]'); if(!tg) return;
  const d=tg.dataset, c=Object.assign({}, cyGet());
  if('cyclose' in d){ closeCycle(); return; }
  if(d.cyt==='on'){ c.on=!c.on; if(c.on && !c.sit) c.sit='natural'; if(c.coach==null) c.coach=true; }
  else if(d.cyt==='local') c.sync=!c.sync;
  else if(d.cyt==='coach') c.coach=c.coach===false;
  else if(d.cysit) c.sit=d.cysit;
  else if('cydel' in d){ if(!CYS.del){ CYS.del=true; renderCycle(); return; } c.periods=[]; c.sym={}; CYS.del=false; restToast(t('Usunięto historię cyklu')); }
  cySave(c); renderCycle(); renderToday(); if(document.getElementById('v-progress').classList.contains('on')) renderWeight(); moreStatus();
});
CY_PH_ORDER = ['period','foll','ov','lut'];
CY_PH_SHORT = {period:'Okres', foll:'Folikularna', ov:'Owulacja', lut:'Lutealna'};
CY_PH_IN = {period:'w czasie okresu', foll:'w fazie folikularnej', ov:'w okolicach owulacji', lut:'w fazie lutealnej'};
}
