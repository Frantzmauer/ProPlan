// ŻELAZO — Dieta: kiedy jesz i kiedy zapisujesz, domknięcie dnia, nawyki, zdjęcie posiłku.
// Moduł zawiera tylko deklaracje; kod startowy jest w __init_N, wywoływanych przez main.js w stałej kolejności.
import { dayIndexFor, weekOf } from '../core/backup';
import { netDown } from '../core/shell';
import { CLOUD, S, cloudCall, save } from '../core/state';
import { cyDiff } from '../features/cycle';
import { bindOffer, limitOffer, quotaCur, quotaLeft, quotaReset, quotaSet } from '../features/plan-limits';
import { fireReminder, notifTimers, setupReminders } from '../features/reminders';
import { addDays, minuteOfDay, parseISO, todayISO } from '../lib/dates';
import { EVENING, MEAL_LATE, hm, mealEntry, stampKind, usualTime } from '../lib/mealtime';
import { mark } from '../lib/state';
import { DIET } from '../plan/data';
import { esc } from './accounts';
import { openMealDialog } from './guide';
import { goalOn } from './progress';
import { dayMeals, renderToday } from './train';
import { dayShort, dec, plural, t } from '../lib/i18n';

export let MT_LATE, MT_EVE, MT, mtMin, mtHM, PH;

export function mtNowMin(){ return mtMin(Date.now()); }

export function mtAteNow(iso){ return iso===todayISO() ? mtNowMin() : null; }

export function mtUsual(tag){
  const today=todayISO();
  if(MT.usualDay!==today){ MT.usual={}; MT.usualDay=today; }
  if(MT.usual[tag]!=null) return MT.usual[tag];
  const vals=[];
  for(let i=1;i<=28;i++){ const iso=addDays(today,-i), L=S.log[iso]; if(!L||!L.meals) continue;
    const dow=parseISO(iso).getDay(); if(!DIET[dow]) continue;
    DIET[dow].meals.forEach((sl,k)=>{ if(sl.tag!==tag || !L.meals['m'+k]) return;
      const a=L.ate&&L.ate['m'+k]; if(a>=0){ vals.push(a); return; }
      const t=L._t&&L._t['meal:m'+k]; if(t && todayISO(new Date(t))===iso) vals.push(mtMin(t)); }); }
  return MT.usual[tag] = usualTime(vals, tag);
}

// jeden zapis posiłku: kiedy zjedzony, kiedy zapisany
export function mtEntry(iso, L, key, tag){
  const t=L._t&&L._t['meal:'+key]; if(!t) return null;
  return mealEntry(iso, t, L.ate&&L.ate[key], mtUsual(tag));
}

export function mtStampHtml(iso, L, key, on){
  if(L.ate && L.ate[key]===-1 && !on) return '<span class="mt-st skip">'+t('pominięty')+'</span>';
  if(!on) return '';
  const dow=parseISO(iso).getDay(), i=+key.slice(1), tag=DIET[dow]&&DIET[dow].meals[i]?DIET[dow].meals[i].tag:'';
  const e=mtEntry(iso, L, key, tag); if(!e) return '';
  return mtStamp(e);
}

export function mtStampCustom(iso, c){
  if(!c._t || todayISO(new Date(c._t))<iso) return '';
  return mtStamp(mealEntry(iso, c._t, c.ate, Infinity));   // własny posiłek: bez godziny = zjedzony przy zapisie
}

export function mtStamp(e){
  const k=stampKind(e);
  if(k==='now') return `<span class="mt-st now">✓ ${mtHM(e.logged)} · ${t('na bieżąco')}</span>`;
  if(k==='after') return `<span class="mt-st eve">${t('zjedzony {a} · uzupełniony później', {a:mtHM(e.ate)})}</span>`;
  if(k==='eve') return `<span class="mt-st eve">${t('zjedzony {a} · uzupełniony wieczorem', {a:mtHM(e.ate)})}</span>`;
  return `<span class="mt-st late">${t('zjedzony {a} · zapisany {b}', {a:mtHM(e.ate), b:mtHM(e.logged)})}</span>`;
}

// odhaczenie posiłku: dziś i późno → pytanie o godzinę; dawny dzień → zwykła pora
export function mtOnCheck(iso, L, key, dow){
  if(!L.meals[key]){ if(MT.ask && MT.ask.key===key) MT.ask=null; return; }
  const i=+key.slice(1), tag=DIET[dow]&&DIET[dow].meals[i]?DIET[dow].meals[i].tag:'', usual=mtUsual(tag);
  if(!L.ate) L.ate={};
  if(iso===todayISO()){
    const now=mtNowMin();
    L.ate[key]=now; mark(L,'ate:'+key);
    MT.ask = now-usual>MT_LATE ? {iso, key} : null;
  } else if(iso<todayISO()){ L.ate[key]=usual; mark(L,'ate:'+key); }
}

export function mtAskHtml(iso, key, tag){
  if(!MT.ask || MT.ask.iso!==iso || MT.ask.key!==key) return '';
  const now=mtNowMin(), usual=mtUsual(tag), opts=[[now,t('teraz')],[now-30,mtHM(now-30)],[now-60,mtHM(now-60)]].filter(o=>o[0]>usual-60);
  return `<div class="mt-ask"><b>${t('O której był ten posiłek?')}</b><div class="mt-chips">${opts.map(([m,l])=>`<button type="button" data-mtate="${key}" data-m="${m}">${l}</button>`).join('')}<button type="button" data-mtate="${key}" data-m="${usual}">${t('jak zwykle ({h})', {h:mtHM(usual)})}</button></div>
    <span>${t('Pytam, gdy zapisujesz ponad 45 min po zwykłej porze — dzięki temu widać, kiedy naprawdę jesz.')}</span></div>`;
}

// domknięcie dnia: tylko dziś, od godziny z przypomnień (domyślnie 21:00), gdy posiłki z minioną porą nie są ani odhaczone, ani pominięte
export function mtMissing(iso, L, dow){
  if(!DIET[dow]) return [];
  const now=mtNowMin();
  return DIET[dow].meals.map((sl,i)=>({key:'m'+i, tag:sl.tag, usual:mtUsual(sl.tag)}))
    .filter(x=>!(L.meals&&L.meals[x.key]) && !(L.ate&&L.ate[x.key]===-1) && x.usual+MT_LATE<now);
}

export function mtCloseTime(){ const t=(S.reminders&&S.reminders.close)||'21:00', [h,m]=t.split(':').map(Number); return h*60+m; }

export function mtCloseHtml(iso, L, dow){
  if(iso!==todayISO() || mtNowMin()<mtCloseTime()) return '';
  const miss=mtMissing(iso, L, dow); if(!miss.length) return '';
  return `<div class="mt-close"><div class="h"><b>${plural(miss.length,'Domknij dzień — brakuje {n} posiłku','Domknij dzień — brakuje {n} posiłków','Domknij dzień — brakuje {n} posiłków','Close the day — {n} meal missing','Close the day — {n} meals missing')}</b><span>${t('Bez tego kalorie i trend wagi liczą się z luk. Każdy posiłek potwierdź osobno.')}</span></div>
    ${miss.map(x=>`<div class="mt-slot"><b>${esc(t(x.tag))} <span>· ${t('zwykle {h}', {h:mtHM(x.usual)})}</span></b><div class="mt-chips">
      <button type="button" data-mtc="plan" data-k="${x.key}">${t('Wg planu')}</button><button type="button" data-mtc="other" data-k="${x.key}">${t('Inaczej')}</button><button type="button" data-mtc="skip" data-k="${x.key}">${t('Pominięty')}</button></div></div>`).join('')}
    <span style="font-size:12px;color:var(--ink-faint)">${t('Uzupełnione wieczorem liczą się do kalorii, ale nie do zapisów „na bieżąco”.')}</span></div>`;
}

export function mtBind(card, iso, L, dow){
  card.querySelectorAll('[data-mtate]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); const k=b.dataset.mtate; if(!L.ate) L.ate={}; L.ate[k]=+b.dataset.m; mark(L,'ate:'+k); MT.ask=null; save(); renderToday(); });
  card.querySelectorAll('[data-mtc]').forEach(b=>b.onclick=()=>{
    const k=b.dataset.k, i=+k.slice(1), tag=DIET[dow].meals[i].tag; if(!L.ate) L.ate={};
    if(b.dataset.mtc==='plan'){ L.meals[k]=true; mark(L,'meal:'+k); L.ate[k]=mtUsual(tag); mark(L,'ate:'+k); }
    else if(b.dataset.mtc==='skip'){ L.ate[k]=-1; mark(L,'ate:'+k); }
    else { MT.replace={iso, key:k}; openMealDialog(iso, true); return; }
    save(); renderToday();
  });
}

// okno posiłku → „Zastępuje”: dodatkowy albo zamiast posiłku z planu, który nie jest odhaczony ani już zastąpiony (MT.replace)
export function mdRepRender(iso){
  const box=document.getElementById('mdRepBox'), L=S.log[iso]||{}, dow=parseISO(iso).getDay();
  const free=DIET[dow] ? dayMeals(iso, dow, L, weekOf(dayIndexFor(iso)), goalOn(iso)).map((x,i)=>({key:'m'+i, tag:x.slot.tag, kcal:x.mc.kcal}))
    .filter(x=>!(L.meals&&L.meals[x.key]) && !(L.custom||[]).some(c=>c.rep===x.key && !c._del)) : [];
  if(MT.replace && (MT.replace.iso!==iso || !free.some(x=>x.key===MT.replace.key))) MT.replace=null;
  const cur=MT.replace?MT.replace.key:'', sel=free.find(x=>x.key===cur);
  box.style.display=free.length?'':'none';
  document.getElementById('mdRep').innerHTML=[{key:'', tag:'Dodatkowy', kcal:0}, ...free].map(x=>
    `<button type="button" role="radio" aria-checked="${x.key===cur}" data-mdrep="${x.key}">${esc(t(x.tag))}${x.kcal?`<small>${x.kcal}</small>`:''}</button>`).join('');
  document.getElementById('mdRepHint').textContent=sel ? t('{m} z planu przestanie się liczyć — w jego miejsce wejdzie to, co wpiszesz.', {m:t(sel.tag)})
    : t('Doliczy się do dnia obok posiłków z planu (np. przekąska poza planem).');
  document.getElementById('mdTxt').placeholder=sel ? t('{m} — co było zamiast?', {m:t(sel.tag)}) : t('np. duży kebab z sosem czosnkowym');
  document.querySelectorAll('[data-mdrep]').forEach(b=>b.onclick=()=>{ MT.replace=b.dataset.mdrep?{iso, key:b.dataset.mdrep}:null; mdRepRender(iso); });
}

// przypomnienia o posiłkach: ok. 40 min po Twojej zwykłej porze, jeśli posiłek nie jest zapisany; domknięcie dnia, gdy są luki
export function mtScheduleReminders(useSystem){
  const iso=todayISO(), dow=parseISO(iso).getDay(), now=Date.now(), base=new Date(); base.setHours(0,0,0,0);
  if(DIET[dow]) DIET[dow].meals.forEach((sl,i)=>{
    const at=base.getTime()+(mtUsual(sl.tag)+40)*60000; if(at<=now) return;
    notifTimers.push(setTimeout(()=>{ const L=S.log[iso]; if(todayISO()!==iso || (L&&L.meals&&L.meals['m'+i]) || (L&&L.ate&&L.ate['m'+i]===-1)) return;
      fireReminder({title:'🍽️ '+t(sl.tag)+'?', body:t('Zwykle jesz około {h}. Zapisz teraz — wg planu, zdjęciem albo wpisem.', {h:mtHM(mtUsual(sl.tag))})}, useSystem); }, at-now));
  });
  const ct=base.getTime()+mtCloseTime()*60000;
  if(ct>now) notifTimers.push(setTimeout(()=>{ const L=S.log[iso]||{}; const n=mtMissing(iso, L, dow).length; if(n && todayISO()===iso)
    fireReminder({title:t('🌙 Domknij dzień'), body:plural(n,'Brakuje {n} posiłku. Uzupełnij je w Diecie — każdy osobno.','Brakuje {n} posiłków. Uzupełnij je w Diecie — każdy osobno.','Brakuje {n} posiłków. Uzupełnij je w Diecie — każdy osobno.','{n} meal missing. Fill it in under Diet.','{n} meals missing. Fill them in under Diet — one by one.')}, useSystem); }, ct-now));
  const mid=new Date(base); mid.setDate(mid.getDate()+1); mid.setMinutes(2);
  notifTimers.push(setTimeout(setupReminders, mid.getTime()-now));   // nowy dzień → nowe pory
}

/* ---- Twoje nawyki: 7 dni bez dzisiaj — kiedy jesz, kiedy zapisujesz ---- */
export function mhCollect(){
  const today=todayISO(), days=[];
  for(let i=7;i>=1;i--){ const iso=addDays(today,-i), L=S.log[iso], dow=parseISO(iso).getDay(), list=[];
    if(L){ if(L.meals && DIET[dow]) DIET[dow].meals.forEach((sl,k)=>{ if(L.meals['m'+k]){ const e=mtEntry(iso, L, 'm'+k, sl.tag); if(e) list.push(Object.assign({tag:sl.tag}, e)); } });
      (L.custom||[]).forEach(c=>{ if(c._del || c.done===false || !c._t) return; const logDay=todayISO(new Date(c._t)); if(logDay<iso) return;
        const logged=mtMin(c._t)+(logDay>iso?1440*cyDiff(iso,logDay):0), ate=c.ate>=0?c.ate:logged; list.push({tag:'Własny', ate, logged, lag:logged-ate}); }); }
    days.push({iso, dow, list});
  }
  return days;
}

export function renderMealHabits(){
  const sec=document.getElementById('mhSection'), box=document.getElementById('mhBox'); if(!sec) return;
  const days=mhCollect(), all=days.flatMap(d=>d.list);
  if(all.length<5){ sec.style.display='none'; return; }
  sec.style.display='';
  const onTime=all.filter(x=>x.lag<=MT_LATE).length, lag=all.reduce((a,x)=>a+Math.max(0,x.lag),0)/all.length/60, late=all.filter(x=>x.ate>=21*60).length;
  const W=340,H=210,L=26,R=8,T=12,B=22, y0=6, y1=24, Y=h=>T+(Math.min(y1,Math.max(y0,h))-y0)/(y1-y0)*(H-T-B), X=i=>L+(i+.5)*(W-L-R)/7;
  const DN=dayShort();
  let g='';
  [6,9,12,15,18,21,24].forEach(h=>{ g+=`<line x1="${L}" x2="${W-R}" y1="${Y(h)}" y2="${Y(h)}" stroke="var(--line)"/><text x="${L-4}" y="${Y(h)+3.5}" text-anchor="end">${h}</text>`; });
  g+=`<rect x="${L}" y="${Y(21)}" width="${W-L-R}" height="${Y(24)-Y(21)}" fill="var(--red)" opacity=".07"/>`;
  days.forEach((d,i)=>{ g+=`<text x="${X(i)}" y="${H-6}" text-anchor="middle">${DN[d.dow]}</text>`;
    d.list.forEach(x=>{ const col=x.lag<=MT_LATE?'var(--green)':x.logged>=MT_EVE?'var(--red)':'var(--gold)', ya=Y(x.ate/60), yl=Y(x.logged/60);
      if(x.lag>MT_LATE) g+=`<line x1="${X(i)}" x2="${X(i)}" y1="${ya}" y2="${yl}" stroke="${col}" stroke-dasharray="2 3" opacity=".7"/><circle cx="${X(i)}" cy="${yl}" r="2.5" fill="${col}"/>`;
      g+=`<circle cx="${X(i)}" cy="${ya}" r="5" fill="${col}" stroke="var(--bg)" stroke-width="1.5"/>`; }); });
  // wnioski z reguł: dni zapisywane wieczorem, późne jedzenie, znikająca przekąska, dobre dni
  const ins=[], eveDays=days.filter(d=>d.list.length && d.list.filter(x=>x.lag>MT_LATE && x.logged>=MT_EVE).length>=2);
  if(eveDays.length) ins.push(t('<b>{d}: posiłki zapisane dopiero wieczorem.</b> Spróbuj zapisywać od razu — choćby zdjęciem albo „wg planu”.', {d:eveDays.map(d=>DN[d.dow]).join(', ')}));
  const lateDays=days.filter(d=>d.list.some(x=>x.ate>=21*60));
  if(lateDays.length>=2) ins.push(t('<b>Jedzenie po 21:00: {d}.</b> Późny, duży posiłek często idzie w parze z długą przerwą po obiedzie.', {d:lateDays.map(d=>DN[d.dow]).join(', ')}));
  const snackMiss=days.filter(d=>DIET[d.dow] && DIET[d.dow].meals.some((sl,k)=>sl.tag==='Przekąska' && !(S.log[d.iso]&&S.log[d.iso].meals&&S.log[d.iso].meals['m'+k])));
  if(snackMiss.length>=3) ins.push(t('<b>Przekąski brak w {n} z 7 dni.</b> Zaplanowana przekąska zmniejsza głód wieczorem.', {n:snackMiss.length}));
  const good=days.filter(d=>d.list.length>=3 && d.list.every(x=>x.lag<=MT_LATE)).length;
  ins.push(t('<b>{n} z 7 dni zapisanych w całości na bieżąco.</b>', {n:good})+' '+(good<7?t('Cel na ten tydzień: {n}.', {n:Math.min(7,good+1)}):t('Świetnie — tak trzymaj.')));
  box.innerHTML=`<div class="mh-kpi"><div><b>${Math.round(onTime/all.length*100)}%</b><span>${t('posiłków zapisanych na bieżąco')}</span></div><div><b>${dec(lag,1)} h</b><span>${t('średnio od jedzenia do zapisu')}</span></div><div><b>${late}</b><span>${t('posiłki po 21:00')}</span></div></div>
    <div class="mh-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${t('Godziny posiłków i zapisów w ostatnich 7 dniach')}">${g}</svg></div>
    <div class="mh-leg"><span><i style="background:var(--green)"></i>${t('na bieżąco')}</span><span><i style="background:var(--gold)"></i>${t('później')}</span><span><i style="background:var(--red)"></i>${t('wieczorem')}</span><span>${t('kropka = posiłek, mała = zapis')}</span></div>
    ${ins.map(x=>`<div class="mh-ins">${x}</div>`).join('')}`;
}

export function phOpen(){
  if(!(CLOUD.on && CLOUD.url && CLOUD.token)){ const m=document.getElementById('mdEstMsg'); m.style.display='block'; m.style.color='var(--red)'; m.textContent=t('Szacowanie ze zdjęcia korzysta z serwera — włącz synchronizację (Więcej → Synchronizacja).'); return; }
  if(quotaLeft('est')===0){ const m=document.getElementById('mdEstMsg'); m.style.display='block'; m.style.color='var(--red)'; m.innerHTML=t('Limit {n} szacowań w tym miesiącu wykorzystany. Nowe od {d}.', {n:quotaCur().est.max, d:quotaReset()})+limitOffer('est'); bindOffer(m); return; }
  const f=document.getElementById('phFile'); f.value=''; f.click();
}

export function phView(title, html){
  const pn=document.getElementById('phPanel');
  pn.innerHTML=`<div class="eh-grab"></div><div class="eh-head"><div style="flex:1;min-width:0"><div class="eyebrow">${t('Zdjęcie posiłku · AI')}</div><h2 id="phTitle">${title}</h2></div><button class="eh-x" data-phclose aria-label="${t('Zamknij')}">✕</button></div>`+html;
  pn.querySelectorAll('[data-phclose]').forEach(b=>b.onclick=phClose);
  document.getElementById('phSheet').style.display='flex';
}

export function phClose(){ document.getElementById('phSheet').style.display='none'; }

export function phShrink(file){
  return new Promise((ok,no)=>{ const url=URL.createObjectURL(file), im=new Image();
    im.onload=()=>{ const k=Math.min(1, 1024/Math.max(im.width, im.height)), c=document.createElement('canvas'); c.width=Math.round(im.width*k); c.height=Math.round(im.height*k);
      c.getContext('2d').drawImage(im,0,0,c.width,c.height); URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg',0.8)); };
    im.onerror=()=>{ URL.revokeObjectURL(url); no(new Error('img')); }; im.src=url; });
}

export function phSum(){ return PH.items.reduce((a,x)=>{ const f=x.g0?x.g/x.g0:1; a.kcal+=x.kcal*f; a.p+=x.p*f; a.c+=x.c*f; a.f+=x.f*f; return a; },{kcal:0,p:0,c:0,f:0}); }

export function phResult(){
  const j=PH.res, s=phSum(), CONF={wysoka:t('wysoka'), srednia:t('średnia'), niska:t('niska')};
  phView(esc(j.name||t('Twój posiłek')), `<div class="ph-img" style="aspect-ratio:16/9"><img src="${PH.img}" alt="${t('Zdjęcie posiłku')}"></div>
    <div class="ph-conf">${t('Pewność:')} <b>${CONF[j.conf]||t('średnia')}</b>${j.note?' — '+esc(j.note):''} ${t('Popraw porcje suwakami, jeśli wiesz lepiej.')}</div>
    <div class="ph-items">${PH.items.map((x,i)=>`<div class="ph-item"><b>${esc(x.n)}</b><span class="kc">${Math.round(x.kcal*(x.g0?x.g/x.g0:1))}</span><span class="g">${x.g} g</span>
      <input type="range" min="${Math.max(1,Math.round(x.g0*.3))}" max="${Math.max(10,Math.round(x.g0*2))}" step="${x.g0>=50?5:1}" value="${x.g}" data-phi="${i}" aria-label="${t('Porcja: {x}', {x:esc(x.n)})}"></div>`).join('')}</div>
    <div class="ph-sum" id="phSumBox"><div><b>${Math.round(s.kcal)}</b><span>kcal</span></div><div><b>${Math.round(s.p)}</b><span>${t('białko')}</span></div><div><b>${Math.round(s.c)}</b><span>${t('węgle')}</span></div><div><b>${Math.round(s.f)}</b><span>${t('tłuszcz')}</span></div></div>
    <button class="btn" type="button" id="phUse">${t('Dodaj do posiłku · {n} kcal', {n:Math.round(s.kcal)})}</button>
    <button class="btn ghost" type="button" id="phAgain">${t('Inne zdjęcie')}</button>
    <div class="md-hint" style="margin:0">${t('Szacunek z wyglądu — tłuszcz i sosy bywają niewidoczne. Liczy się jako 1 szacowanie.')}</div>`);
  document.querySelectorAll('[data-phi]').forEach(r=>r.oninput=()=>{ const x=PH.items[+r.dataset.phi]; x.g=+r.value;
    const it=r.closest('.ph-item'); it.querySelector('.kc').textContent=String(Math.round(x.kcal*(x.g0?x.g/x.g0:1))); it.querySelector('.g').textContent=x.g+' g';
    const su=phSum(); document.getElementById('phSumBox').innerHTML=`<div><b>${Math.round(su.kcal)}</b><span>kcal</span></div><div><b>${Math.round(su.p)}</b><span>${t('białko')}</span></div><div><b>${Math.round(su.c)}</b><span>${t('węgle')}</span></div><div><b>${Math.round(su.f)}</b><span>${t('tłuszcz')}</span></div>`;
    document.getElementById('phUse').textContent=t('Dodaj do posiłku · {n} kcal', {n:Math.round(su.kcal)}); });
  document.getElementById('phAgain').onclick=()=>{ phClose(); phOpen(); };
  document.getElementById('phUse').onclick=()=>{
    const su=phSum(), add=(id,v)=>{ const el=document.getElementById(id); el.value=(parseInt(el.value)||0)+Math.round(v); };
    const tx=document.getElementById('mdTxt'), name=j.name||PH.items.map(x=>x.n).slice(0,3).join(', ');
    tx.value=tx.value.trim() ? tx.value.trim()+' + '+name : name;
    add('mdKcal',su.kcal); add('mdP',su.p); add('mdC',su.c); add('mdF',su.f);
    MT.src='photo';
    const m=document.getElementById('mdEstMsg'); m.style.display='block'; m.style.color='var(--steel)'; m.textContent=t('Dodano ze zdjęcia: {n} kcal. Popraw liczby, jeśli trzeba, i stuknij „Dodaj”.', {n:Math.round(su.kcal)});
    phClose();
  };
}

export function __init_9(){

/* ---- kiedy jesz i kiedy zapisujesz ----
   Godzina zapisu: L._t['meal:mN'] (była zawsze) i c._t dla własnych posiłków.
   Godzina zjedzenia: L.ate = {mN: minuty od północy, -1 = pominięty / zastąpiony} (synchronizowane, pole _t 'ate:mN'),
   c.ate dla własnych. Gdy odhaczasz posiłek ponad 45 min po swojej zwykłej porze, aplikacja pyta, o której był.
   Zwykła pora = mediana z 28 dni (domyślne pory, gdy danych jest mniej niż 3). Bez godziny zjedzenia przy zapisie
   ponad 2 h po zwykłej porze przyjmujemy zwykłą porę — inaczej stare wieczorne wpisy wyglądałyby na „na bieżąco”. */
MT_LATE = MEAL_LATE;
MT_EVE = EVENING;
MT = {ask:null, replace:null, src:null, usual:null, usualDay:null};
mtMin = minuteOfDay;
mtHM = hm;
/* ---- zdjęcie posiłku → AI (składniki, gramatury, kcal, makro); liczy się jako 1 szacowanie ----
   Zdjęcie zmniejszone na telefonie do 1024 px (JPEG) i wysłane raz; serwer go nie zapisuje. „Dodaj” dokłada do pól posiłku. */
PH = {img:null, items:null, res:null};
document.querySelector('#phSheet .bd').onclick=phClose;
document.getElementById('phFile').onchange=async e=>{
  const file=e.target.files&&e.target.files[0]; if(!file) return;
  let data; try{ data=await phShrink(file); }catch(err){ phView(t('Nie udało się'), '<div class="md-hint">'+t('Nie mogę odczytać tego zdjęcia. Spróbuj zrobić je jeszcze raz.')+'</div>'); return; }
  PH.img=data;
  phView(t('Szacuję…'), `<div class="ph-img"><img src="${data}" alt="${t('Zdjęcie posiłku')}"><div class="scan"></div></div><div class="md-hint" style="margin:0">${t('AI rozpoznaje składniki i szacuje porcje — zwykle 5–15 s.')}</div>`);
  try{
    const j=await cloudCall('estimatePhoto', {image:data.split(',')[1], note:document.getElementById('mdTxt').value.trim().slice(0,200)});
    if(j.quota) quotaSet(j.quota);
    if(!j.items || !j.items.length){ phView(t('Nie rozpoznano'), `<div class="ph-img" style="aspect-ratio:16/9"><img src="${data}" alt="${t('Zdjęcie posiłku')}"></div><div class="md-hint" style="margin:0">${esc(j.note||t('Nie widzę posiłku na zdjęciu.'))} ${t('Zrób zdjęcie z góry, z całym talerzem w kadrze, albo opisz posiłek słowami.')}</div><button class="btn ghost" type="button" id="phAgain">${t('Inne zdjęcie')}</button>`); document.getElementById('phAgain').onclick=()=>{ phClose(); phOpen(); }; return; }
    PH.res=j; PH.items=j.items.map(x=>Object.assign({g0:x.g||100}, x, {g:x.g||100}));
    phResult();
  }catch(err){
    if(err.data && err.data.quota) quotaSet(err.data.quota);
    phView(t('Nie udało się'), `<div class="md-hint" style="margin:0">${esc(netDown(err)?t('Brak internetu — szacowanie ze zdjęcia potrzebuje połączenia.'):err.message)}</div><button class="btn ghost" type="button" id="phAgain">${t('Spróbuj ponownie')}</button>`);
    document.getElementById('phAgain').onclick=()=>{ phClose(); phOpen(); };
  }
};
document.getElementById('mdPhoto').onclick=phOpen;
}
