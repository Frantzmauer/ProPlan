// ŻELAZO — Trener AI: rozmowa, propozycje zmian, klatki z nagrania, głos.
// Moduł zawiera tylko deklaracje; kod startowy jest w __init_N, wywoływanych przez main.js w stałej kolejności.
import { dayIndexFor, weekOf } from '../core/backup';
import { netDown } from '../core/shell';
import { CLOUD, S, cloudCall, save } from '../core/state';
import { cyCoachContext } from '../features/cycle';
import { fcGet, fcIssues, fcRenderFrame } from '../features/formcheck';
import { EA_SHORT, featOn, planEnforced, quotaLeft, quotaLoad, quotaSet, quotaUi } from '../features/plan-limits';
import { showInAppReminder } from '../features/reminders';
import { restApplyLive, restCurrent, restOverride, restStats } from '../features/rest';
import { addDays, parseISO, todayISO } from '../lib/dates';
import { coachKeep } from '../lib/merge.js';
import { KCAL_HI, KCAL_LO, PROT_MIN, dietScore } from '../lib/dietday';
import { COACH_UI, langOf, speechLocale } from '../lib/lang';
import { hm } from '../lib/mealtime';
import { prAnalyze, prBest } from '../lib/records';
import { DEFAULT_KCAL, DIET, HOME, macroGoalFor, phaseInfo, planSrc, workoutOn } from '../plan/data';
import { makeDictation } from '../ui/dictation';
import { esc } from './accounts';
import { loadUsage } from './admin';
import { exIndex, prE1, prName, prTopText } from './history';
import { estMaintenance, kcalSlider, moreOpen, updateKcalHint } from './more';
import { MEASURES, goalOn, kcalRecord, renderMeasures, tdFmt, tdeeEstimate } from './progress';
import { DEFAULT_STEPS, stepsAdj, tysKrokow } from './steps';
import { dayMeals, dmy, dowOf, effEx, exAny, nextMoves, prevSession, renderToday, scaledStart, setOk, timedSpec, wIcon } from './train';
import { WO, fmtDur, hasSession } from './workout';

export let coachKey, coachId, coachDecided, coachBusy, fmtKg, DAY_SHORT, daysTxt, coachAtt, coachOpen, coachVoice, TTS, coachSpeakSeq;
export function __set_coachAtt(v){ coachAtt=v; return v; }

/* ============================================================
   TRENER AI — „Zapytaj Trenera”
   Rozmowa idzie przez Apps Script (klucz API i instrukcje Trenera są tylko na serwerze).
   Aplikacja dokłada zwięzłe podsumowanie danych WYŁĄCZNIE bieżącego użytkownika.
   ============================================================ */
export const COACH_CTX_MAX = 40000;   // serwer przycina do COACH_MAX_CONTEXT (Kod.js) — trzymaj tak samo
export const COACH_TURNS = 8, COACH_OLD_MAX = 500;   // historia rozmowy wysyłana do Trenera: ile wiadomości, skrót starszych odpowiedzi

// co jest w aplikacji: Trener podaje tylko te ścieżki zamiast zgadywać przyciski
export const COACH_APP_GUIDE = `Jak działa aplikacja SixMo (gdy mówisz, co kliknąć, podawaj tylko to, co jest tutaj; jeśli czegoś tu nie ma — powiedz, że nie wiesz, zamiast zgadywać):
- Dolny pasek zakładek: Dieta, Trening, Postęp, Zakupy, Więcej. Nad nim przełącznik dni „‹ DZIŚ ›” (albo przesunięcie palcem w bok); „↩ DZIŚ” wraca do dzisiaj.
- Trening: karta dnia z ćwiczeniami i seriami do odhaczenia (kg × powtórzenia). Przy ćwiczeniu: „Zamień ćwiczenie” (powód: zajęte stanowisko, ból, brak sprzętu; tylko ten dzień albo na stałe) i „Pomiń”; trening można „Przesuń” na inny dzień. Tryb treningu: start, pauza, przerwy z minutnikiem, podsumowanie i rekordy. Przed treningiem check-in (sen, zakwasy, energia). Ocena techniki z nagrania serii.
- Dieta → „Co dziś jesz”: posiłki z planu. Kwadrat po lewej odhacza zjedzony posiłek. Cyfry 1–3 zmieniają wariant posiłku. „od Trenera” = posiłek podmieniony Twoją propozycją. „Zamień” przy nieodhaczonym posiłku z planu: wpisuje się, co zjedzono zamiast niego — ten posiłek z planu przestaje się liczyć, liczy się wpisany. „＋ Dodaj posiłek”: opis, dyktowanie, zdjęcie (AI szacuje kalorie), skaner kodu kreskowego, „Oszacuj kalorie z opisu”, a w polu „Zastępuje” wybór: „Dodatkowy” albo posiłek z planu, który ten wpis zastępuje (jak „Zamień”); pole „kcal” + „Dodaj kalorie” dla samej liczby. Pod makrami karta „Dzień diety” (reguła niżej, z podpowiedzią, czego brakuje). Własny posiłek usuwa się krzyżykiem. Wieczorem karta „Domknij dzień”: Wg planu / Inaczej / Pominięty. Przy późnym odhaczeniu aplikacja pyta, o której był posiłek. Niżej: karta „Twoje nawyki · ostatnie 7 dni”, „Codzienne filary” (sen, kroki, dziennik, bez alkoholu, bez słodyczy) i woda.
- Dzień diety zaliczony (seria 🍽️, kalendarz, karta „Dzień diety”): kalorie ${Math.round(KCAL_LO*100)}–${Math.round(KCAL_HI*100)}% celu obowiązującego tego dnia ORAZ białko co najmniej ${Math.round(PROT_MIN*100)}% celu białka. Nie ma znaczenia, czy jedzenie pochodzi z planu, czy z własnych posiłków. Dzisiejszy dzień jest „w toku” do północy. Gdy dzień jest blisko progu, podpowiedz konkretny posiłek, który go domknie (zwykle białko).
- Postęp: gdzie jesteś w planie, rekordy, waga i trend (wydatek kalorii z trendu wagi i propozycja celu), obwody (zapis pomiaru, historia z przyciskiem „Edytuj”), konsekwencja, serie, kalendarz.
- Zakupy: lista na tydzień.
- Więcej: Ćwiczenia (nauka techniki), Cykl i samopoczucie, Przerwy między seriami, Profil i plan (profil, cel kalorii suwakiem, start planu), Pakiet i limity AI, Synchronizacja i konta, Przypomnienia, Kopia i eksport, Wersja aplikacji.
- Ty zmieniasz dane tylko kartą propozycji (narzędzie zaproponuj_zmiany) — zmiana wchodzi dopiero po kliknięciu „Zastosuj od dziś”, a „Cofnij” ją wycofuje. Wpisów treningów, wagi i posiłków nie edytujesz — wskaż, gdzie użytkownik zrobi to sam.`;

// legenda zwięzłego dziennika (jeden wiersz na dzień, posiłki tylko dla ostatnich dni) — mniej tokenów niż proza
export const FOOD_LEGEND = 'Dziennik jedzenia, ostatnie 14 dni (dni bez wpisów pominięte; „brak zapisu jedzenia” = dzień z innymi wpisami, ale bez posiłków — nie wiadomo, czy jedzenia nie było, czy nie zapisano). Wiersz dnia: data|kcal zjedzone/cel|B, W, T g zjedzone/cel|ocena dnia (ZAL = dzień diety zaliczony; inaczej w toku albo nie, z % celu kcal i białka i ✓/✗)|woda szkl.|nawyki. Sumy liczone jak w zakładce Dieta (posiłki z planu + własne) — są wiarygodne, nie licz dnia tylko z własnych. Posiłki pod wierszem dnia (tylko 4 ostatnie dni): ✓ zjedzony, → zastąpiony własnym, ✗ pominięty, · nie odhaczony; * = od Trenera; „ok.GG:MM” = kiedy zjedzono, „z GG:MM” = kiedy odhaczono; liczby = kcal/B/W/T; + = własny posiłek („→Obiad” = zamiast obiadu z planu).';
export const FOOD_DETAIL_DAYS = 4;

// dzień w Diecie dokładnie tak, jak liczy aplikacja: posiłki z planu (wariant / od Trenera), własne, suma kcal i makro
export function coachFoodDay(iso, today, detail=true){
  const L=S.log[iso]||(iso===today?{meals:{}}:null); if(!L) return '';
  const dow=parseISO(iso).getDay(), goal=goalOn(iso), g=macroGoalFor(goal), dd=x=>x.slice(8,10)+'.'+x.slice(5,7);
  const hhmm=t=>{ const d=new Date(t), k=todayISO(d); return (k!==iso?dd(k)+' ':'')+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); };
  const strip=x=>String(x).replace(/<[^>]+>/g,'').replace(/&amp;/g,'&');
  const tot={kcal:0,p:0,c:0,f:0}, add=x=>{ tot.kcal+=+x.kcal||0; tot.p+=+x.p||0; tot.c+=+x.c||0; tot.f+=+x.f||0; }, rows=[];
  const custom=(L.custom||[]).filter(c=>!c._del && c.done!==false);
  const tags={};
  if(DIET[dow]) dayMeals(iso, dow, L, weekOf(dayIndexFor(iso)), goal).forEach((x,i)=>{
    const k='m'+i, on=!!(L.meals&&L.meals[k]), a=L.ate&&L.ate[k], t=L._t&&L._t['meal:'+k], rep=custom.find(c=>c.rep===k);
    tags[k]=x.slot.tag;
    const nums=`${x.mc.kcal}/${x.mc.p}/${x.mc.c}/${x.mc.f}`;
    if(rep){ rows.push(`  →${x.slot.tag}`); return; }
    if(on){ add(x.mc); rows.push(`  ✓${x.slot.tag}${x.adj?'*':''}${a>=0?' ok.'+hm(a):''}${t?' z '+hhmm(t):''} ${nums} ${strip(x.mc.txt).slice(0,50)}`); return; }
    rows.push(`  ${a===-1?'✗':'·'}${x.slot.tag}${x.adj?'*':''} ${nums}`);
  });
  custom.forEach(c=>{ add(c);
    const when=c.ate>=0?' ok.'+hm(c.ate):(c._t?' z '+hhmm(c._t):'');
    rows.push(`  +${c.rep&&tags[c.rep]?'→'+tags[c.rep]:''}${when} ${c.kcal||0}/${c.p||0}/${c.c||0}/${c.f||0} ${String(c.txt||'').slice(0,50)}`); });
  const habName={sleep:'sen',sun:'kroki',notool:'dziennik',noalco:'bez alk.',nosugar:'bez słod.'};
  const hab=Object.entries(L.habits||{}).filter(([,v])=>v).map(([h])=>habName[h]||h);
  const r=v=>Math.round(v), sc=dietScore(tot, g);
  const verdict=sc.ok?'ZAL':(iso===today?'w toku':'nie')+` kcal ${sc.kcalPct}%${sc.kcalOk?'✓':'✗'} B ${sc.pPct}%${sc.pOk?'✓':'✗'}`;
  const day=`${dd(iso)} ${['Nd','Pn','Wt','Śr','Cz','Pt','Sb'][dow]}${iso===today?' DZIŚ':''}`;
  // dzień bez żadnego zjedzonego posiłku (np. tylko trening albo woda): jedna krótka informacja zamiast zer
  if(!tot.kcal) return `${day}|brak zapisu jedzenia`+(L.water?`|woda ${L.water}`:'')+(hab.length?'|'+hab.join(','):'');
  return `${day}|${r(tot.kcal)}/${g.kcal}|B${r(tot.p)}/${g.p}|W${r(tot.c)}/${g.c}|T${r(tot.f)}/${g.f}|${verdict}`
    +(L.water?`|woda ${L.water}`:'')+(hab.length?'|'+hab.join(','):'')+(detail&&rows.length?'\n'+rows.join('\n'):'');
}

// kontekst Trenera w dwóch częściach (osobne punkty pamięci podręcznej na serwerze):
// stat — opis aplikacji, profil, plan, waga, obwody, treningi i rekordy (w trakcie rozmowy zwykle się nie zmienia),
// live — data, realizacja tygodnia, dziennik jedzenia, check-in (zmienia się po każdym odhaczeniu posiłku czy wody)
export function buildCoachContext(){
  const p=S.profile||{}, today=todayISO(), wkNow=weekOf(dayIndexFor(today));
  const inPlan=wkNow>=1&&wkNow<=24, out=[COACH_APP_GUIDE], live=[];
  const dd=iso=>iso.slice(8,10)+'.'+iso.slice(5,7);
  live.push(`Dzisiaj: ${today}. Start planu: ${S.startDate}. ${inPlan?'Tydzień '+wkNow+'/24 — '+phaseInfo(wkNow).name:'Poza 24-tygodniowym planem'}.`);
  out.push(`Profil: ${p.name||'bez imienia'}, ${p.sex==='f'?'kobieta':'mężczyzna'}, ${p.age||'?'} lat, ${p.height||'?'} cm, waga w profilu ${p.weight||'?'} kg, aktywność ×${p.activity||'?'}.`);
  const g=macroGoalFor(S.kcalGoal||DEFAULT_KCAL);
  out.push(`Cel dzienny: ${g.kcal} kcal (szacowane utrzymanie ${estMaintenance()} kcal), białko ${g.p} g, węglowodany ${g.c} g, tłuszcz ${g.f} g. Jadłospis z aplikacji: 4 posiłki dziennie skalowane do celu.`);
  { const te=tdeeEstimate(); if(te.ok) out.push(`Wydatek z danych użytkownika (28 dni: ${te.need.days} dni z pełnym zapisem jedzenia, ${te.need.w} ważeń): ~${te.tdee} kcal/dzień; je średnio ${te.avg} kcal; trend wagi ${tdFmt(te.weekly)} kg/tydz. Przy radach o kaloriach opieraj się na tym, nie na wzorze.`); }
  const dn=['Nd','Pn','Wt','Śr','Cz','Pt','Sb'];
  if(inPlan){
    // plan od poniedziałku tego tygodnia do +7 dni od dziś, z przesunięciami; daty potrzebne do pola przesuniecia
    const t0=parseISO(today), mon=new Date(t0); mon.setDate(t0.getDate()-((t0.getDay()+6)%7));
    const last=todayISO(new Date(t0.getFullYear(),t0.getMonth(),t0.getDate()+7)), rows=[];
    for(let d=new Date(mon); todayISO(d)<=last; d.setDate(d.getDate()+1)){
      const k=todayISO(d), di2=dayIndexFor(k); if(di2<1||di2>168) continue;
      rows.push(k+' ('+dn[d.getDay()]+')'+(k===today?' DZIŚ':'')+': '+workoutOn(k).title+(planSrc(k)!==k?' [przesunięty z '+planSrc(k)+']':''));
    }
    out.push('Plan treningów (data: trening; „[przesunięty z …]” = użytkownik już zmienił ten dzień):\n'+rows.join('\n'));
  }
  const ws=(S.weights||[]).slice().sort((a,b)=>a.d<b.d?-1:1).slice(-45);
  out.push(ws.length?'Waga (dzień.miesiąc: kg): '+ws.map(w=>dd(w.d)+': '+w.w).join(', '):'Waga: brak pomiarów.');
  const ms=(S.measures||[]).filter(m=>MEASURES.some(x=>m[x.k]>0)).sort((a,b)=>a.d<b.d?-1:1).slice(-12);
  if(ms.length) out.push('Obwody (cm; data pomiaru RRRR-MM-DD — tej daty używaj w polu obwody): '+ms.map(m=>m.d+' '+MEASURES.filter(x=>m[x.k]).map(x=>x.l.split(' ')[0].toLowerCase()+' '+m[x.k]).join(', ')).join(' | '));
  // tygodniowa realizacja (ostatnie 8 tygodni planu)
  const weeks={}, exHist={};
  const d=parseISO(today); d.setDate(d.getDate()-70);
  for(let i=0;i<=70;i++,d.setDate(d.getDate()+1)){
    const iso=todayISO(d), di=dayIndexFor(iso); if(di<1) continue;
    const wk=weekOf(di), w=workoutOn(iso), Lg=S.log[iso]||{};
    const W=weeks[wk]=weeks[wk]||{gym:0,gymP:0,home:0,homeP:0,run:0,runP:0,meals:0,days:0,water:0,logged:0,hab:{}};
    if(iso>today) continue;
    W.days++;
    const exs=Lg.ex||{};
    if(Object.keys(Lg.meals||{}).length||Object.keys(exs).length||Object.keys(Lg.habits||{}).length) W.logged++;
    if(w.type==='lift'){
      const done=w.ex.filter((e,j)=>exAny(exs[iso+'_e'+j])).length;   // ćwiczenie z ≥1 odhaczoną serią
      const ok=done>=Math.ceil(w.ex.length/2);
      if(w===HOME){W.homeP++; if(ok)W.home++;} else {W.gymP++; if(ok)W.gym++;}
      w.ex.forEach((e0,j)=>{ const e=effEx(e0,iso), r=exs[iso+'_e'+j]; if(!r) return;
        if(r.skip){ (exHist[e.n]=exHist[e.n]||[]).push(dd(iso)+' pominięte'); return; }
        if(!r.sets) return;
        const u=timedSpec(e,e0)?' s':'';
        const sets=[]; for(let s=1;s<=e.s;s++){ const kg=r.sets['w'+s], rp=r.sets['r'+s]; if(rp && setOk(r,s)) sets.push((kg&&+kg?kg+'×':'')+rp+u); }
        if(sets.length) (exHist[e.n]=exHist[e.n]||[]).push(dd(iso)+(sets.length<e.s?` (${sets.length} z ${e.s} serii)`:'')+' '+sets.join(', ')); });
    }
    if(w.type==='cardio'){ W.runP++; if(exs[iso+'_cardio']) W.run++; }
    W.meals+=Object.values(Lg.meals||{}).filter(Boolean).length; W.water+=Lg.water||0;
    Object.entries(Lg.habits||{}).forEach(([h,v])=>{ if(v) W.hab[h]=(W.hab[h]||0)+1; });
  }
  const habName={sleep:'sen 7–8h',sun:'cel kroków',notool:'dziennik',noalco:'bez alkoholu',nosugar:'bez słodyczy'};
  const wkRows=Object.entries(weeks).filter(([,W])=>W.days).slice(-8).map(([wk,W])=>`tydz. ${wk}: siłownia ${W.gym}/${W.gymP}`+(W.homeP?`, dom ${W.home}/${W.homeP}`:'')+`, bieg ${W.run}/${W.runP}, posiłki z planu ${Math.round(100*W.meals/(4*W.days))}%, woda śr. ${(W.water/W.days).toFixed(1)} szkl., dni z wpisami ${W.logged}/${W.days}`+(Object.keys(W.hab).length?', nawyki: '+Object.entries(W.hab).map(([h,n])=>(habName[h]||h)+' '+n+'d').join(', '):''));
  live.push(wkRows.length?'Realizacja tygodniowa (zrobione/zaplanowane):\n'+wkRows.join('\n'):'Realizacja: brak wpisów.');
  const exRows=Object.entries(exHist).map(([n,a])=>'- '+n+': '+a.slice(-5).join(' | '));
  out.push(exRows.length?'Historia ćwiczeń (ostatnie sesje, kg×powtórzenia):\n'+exRows.join('\n'):'Historia ćwiczeń: brak zapisanych serii.');
  { const days=[]; for(let i=13;i>=0;i--){ const x=coachFoodDay(addDays(today,-i), today, i<FOOD_DETAIL_DAYS); if(x) days.push(x); }
    if(days.length) live.push(FOOD_LEGEND+'\n'+days.join('\n')); }
  // treningi zmierzone w trybie treningu (czas, przerwy vs plan) — ostatnie 8
  { const ss=Object.keys(S.log).sort().filter(k=>k<=today && hasSession(S.log[k])).slice(-8).map(k=>{ const x=S.log[k].session, f=t=>fmtDur(t);
      return '- '+dd(k)+' '+(x.title||'trening')+': '+f(x.dur)+' (praca '+f(x.work)+'), przerwy śr. '+f(x.avgRest)+(x.avgRestPlan?' przy planie '+f(x.avgRestPlan):'')+', serie '+x.done+'/'+x.total+(x.skipped?' (pominięte '+x.skipped+')':'')
        +(x.paused-(x.gap||0)>0?', pauzy '+f(x.paused-(x.gap||0))+' (nieliczone do czasu)':'')+(x.parts>1?', dokończony po przerwie '+f(x.gap):'')+(x.rebuilt?' [czasy odtworzone z godzin odhaczenia serii — przybliżone]':'')+(x.trans?', przejścia między ćwiczeniami '+f(x.trans):'')
        +((x.ex||[]).filter(e=>e.avgRest&&e.avgRest>e.restPlan*1.2).map(e=>'; '+e.n+' przerwa '+f(e.avgRest)+' vs '+f(e.restPlan)).join(''))
        +((x.prs||[]).length?'; rekordy: '+x.prs.map(r=>r.n+' '+prName(r.kind,r.t)+' '+r.now+' (było '+r.was+')').join(', '):''); });
    if(ss.length) out.push('Treningi z pomiarem czasu (tryb treningu):\n'+ss.join('\n')); }
  // przerwy: ustawione (plan / użytkownik / Trener) i średnia z 3 ostatnich treningów
  { const rows=Object.values(exIndex()).map(h=>{ const st=restStats(h.n), o=restOverride(h.n); if(!st && !o) return '';
      return '- '+h.n+': '+fmtDur(restCurrent(h.n, h.timed))+' ('+(o?(o.by==='tr'?'ustawił Trener':'ustawił użytkownik'):'z planu')+')'+(st?', średnio '+fmtDur(st.avg)+' z '+st.sessions+' tren.':''); }).filter(Boolean);
    if(rows.length) out.push('Przerwy między seriami (ustawione; średnio faktycznie):\n'+rows.join('\n')); }
  { const cc=cyCoachContext(today); if(cc) out.push(cc); }
  // samopoczucie przed treningiem (check-in) — ostatnie 14 dni
  { const since=addDays(today,-14), lv=['słabo','OK','dobrze'], sr=['mocne','lekkie','brak'], en=['niska','OK','wysoka'], pl={normal:'trening wg planu', light:'lżej (−10%)', light2:'lżej (−10%, seria mniej)', moved:'przesunięty', move:'lekki ruch zamiast treningu', skip:'pominięty check-in'};
    const rows=Object.keys(S.log).filter(k=>k>=since && k<=today && S.log[k].checkin && S.log[k].checkin.plan!=='skip').sort().map(k=>{ const c=S.log[k].checkin;
      return '- '+dd(k)+': sen '+lv[c.sleep]+', zakwasy '+sr[c.sore]+', energia '+en[c.energy]+' → '+(pl[c.plan]||c.plan); });
    if(rows.length) live.push('Samopoczucie przed treningiem (check-in):\n'+rows.join('\n')); }
  // zamiany ćwiczeń zrobione samodzielnie (przycisk Zamień) — ostatnie 14 dni
  { const since=addDays(today,-14), why={busy:'zajęte stanowisko',pain:'BÓL',gear:'brak sprzętu'}, sw=[];
    Object.values((S.adj&&S.adj.ex)||{}).forEach(l=>l.forEach(y=>{ if(y.user && y.swap && y.from>=since) sw.push('- '+dd(y.from)+': '+(y.was||'?')+' → '+y.swap.n+' ('+(why[y.reason]||'—')+', '+(y.to?'tylko ten dzień':'na stałe')+(y.fromSet?', od serii '+y.fromSet:'')+')'); }));
    if(sw.length) out.push('Zamiany ćwiczeń zrobione przez użytkownika:\n'+sw.sort().join('\n')); }
  // najlepsze wyniki (rekordy) każdego ćwiczenia — z odhaczonych serii
  { const rec=Object.values(exIndex()).map(h=>{ const an=prAnalyze(h), b=prBest(h.kind,an); return '- '+h.n+': '+prTopText(h.kind,b.top)+' ('+dd(b.top.iso)+')'+(h.kind==='kg'&&b.e1.m.e1?', 1RM szac. ≈ '+prE1(b.e1.m.e1)+' kg':''); });
    if(rec.length) out.push('Rekordy ćwiczeń (najlepsza seria):\n'+rec.join('\n')); }
  const am=((S.adj&&S.adj.meals)||[]);
  if(am.length) out.push('Posiłki zmienione wcześniej przez Trenera: '+am.map(m=>m.posilek+(m.dni.length?' ('+m.dni.map(d=>dn[d]).join(',')+')':' (codziennie)')+' od '+m.from+': '+m.opis).join(' | '));
  { const sa=stepsAdj(today); out.push(`Dzienny cel kroków: ${sa?sa.goal:DEFAULT_STEPS}`+(sa?` (ustawiony przez Trenera od ${sa.from})`:' (startowy)')+'. Nawyk „ruch/kroki” = osiągnięty cel. Możesz zaproponować nowy cel polem cel_krokow.'); }
  const tg=coachTargets();
  if(tg.length) out.push('Ćwiczenia w planie na najbliższe 2 tygodnie (aktualne cele; nazwy dokładnie takie do narzędzia zaproponuj_zmiany):\n'+tg.map(t=>'- '+t.n+': '+t.txt).join('\n'));
  // opis aplikacji jest na początku części stałej (zawsze w całości); przycinane są dane na końcu
  return {stat:out.join('\n').slice(0,COACH_CTX_MAX), live:live.join('\n').slice(0,COACH_CTX_MAX)};
}

// aktualne cele ćwiczeń z najbliższych 14 dni (z uwzględnieniem zmian od Trenera)
export function coachTargets(){
  const res={}, d=parseISO(todayISO());
  for(let i=0;i<14;i++,d.setDate(d.getDate()+1)){
    const iso=todayISO(d), di=dayIndexFor(iso); if(di<1||di>168) continue;
    const w=workoutOn(iso); if(!w||w.type!=='lift') continue;
    w.ex.forEach(e0=>{ if(res[e0.n]) return; const e=effEx(e0,iso), prev=prevSession(e.n,iso);
      const kg=e._adj&&e._adj.w>0?e._adj.w:(prev?Math.max(...prev.sets.map(x=>x.kg)):scaledStart(e));
      res[e.n]={n:e.n, txt:`${e.s}×${e.r}${kg>0?', ciężar '+kg+' kg':', masa ciała'}`+(e._adj?` (zmienione przez Trenera od ${e._adj.from})`:'')}; });
  }
  return Object.values(res);
}

export function coachStore(){ if(!S.coach) S.coach={clearedAt:0, msgs:[]}; if(!S.coach.msgs) S.coach.msgs=[]; return S.coach; }

// jednorazowo: przenieś czat zapisany dotąd tylko w tej przeglądarce do danych konta (stary zapis zostaje dla wersji stabilnej)
export function migrateLocalCoach(){
  const flag=coachKey()+'_synced';
  try{
    if(localStorage.getItem(flag)) return;
    const old=JSON.parse(localStorage.getItem(coachKey())||'[]');
    if(Array.isArray(old) && old.length){
      const c=coachStore(), base=Date.now()-old.length*1000;
      old.forEach((m,i)=>c.msgs.push(Object.assign({}, m, {id:coachId(), t:base+i*1000, st:m.applied||m.dismissed?base+i*1000:0})));
      c.msgs.sort((x,y)=>x.t-y.t); c.msgs=c.msgs.slice(-coachKeep(c));
      save();
    }
    localStorage.setItem(flag, '1');
  }catch(e){}
}

export function loadCoach(){ const c=coachStore(); return c.msgs.filter(m=>(m.t||0)>(c.clearedAt||0)).sort((x,y)=>x.t-y.t); }

export function saveCoach(h){
  const c=coachStore(), now=Date.now();
  h.forEach((m,i)=>{ if(!m.id) m.id=coachId(); if(!m.t) m.t=now+i; });
  c.msgs=h.slice(-coachKeep(c));
  save();
}

export function coachMd(t){
  return esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/(^|\s)_(.+?)_(?=\s|$)/g,'$1<i>$2</i>')
    .split('\n').map(l=>/^\s*[-•]\s+/.test(l)?'<div style="padding-left:14px;text-indent:-10px">• '+l.replace(/^\s*[-•]\s+/,'')+'</div>':(l.trim()?'<div>'+l+'</div>':'<div style="height:8px"></div>')).join('');
}

export function renderCoach(){
  const box=document.getElementById('coachMsgs'), h=loadCoach();
  const ready=CLOUD.on&&CLOUD.url&&CLOUD.token;
  document.getElementById('coachSetup').style.display=ready?'none':'block';
  const ui=COACH_UI[langOf(S.profile)], chips=document.getElementById('coachChips');
  chips.style.display=(ready&&!h.length)?'flex':'none';
  if(chips.dataset.lang!==langOf(S.profile)){ chips.dataset.lang=langOf(S.profile); chips.innerHTML=ui.chips.map(c=>`<button>${esc(c)}</button>`).join('');
    chips.querySelectorAll('button').forEach(b=>b.onclick=()=>coachSend(b.textContent)); }
  document.getElementById('coachIn').placeholder=ui.placeholder;
  box.innerHTML=(h.length?'':`<div class="coach-b a">${esc(ui.hello(S.profile&&S.profile.name?S.profile.name:''))}</div>`)+
    h.map((m,i)=>`<div class="coach-b ${m.role==='user'?'u':'a'}">${m.role==='user'?esc(m.content).replace(/\n/g,'<br>')+(m.att?`<span class="att">📎 ${m.att.n} klatek: ${esc(m.att.ex)}</span>`:''):coachMd(m.content)+(m.local?'<span class="ea-note">bez AI · nie liczy się do limitu</span>':'')}${m.kind==='form'?`<button class="coach-ask-vid" data-att="${esc(m.id)}">📎 Zapytaj o to nagranie</button>`:''}</div>`+(m.proposal?propCard(m,i):'')).join('')+
    (coachBusy?`<div class="coach-b a" style="color:var(--ink-dim)">${ui.thinking}</div>`:'');
  box.scrollTop=box.scrollHeight;
  box.querySelectorAll('[data-att]').forEach(b=>b.onclick=()=>{ const m=loadCoach().find(x=>x.id===b.dataset.att); if(m){ coachAtt={id:m.id, ex:m.ex||'nagranie', t:m.t}; renderCoachAtt(); document.getElementById('coachIn').focus(); } });
  renderCoachAtt();
  box.querySelectorAll('[data-prop-apply]').forEach(b=>b.onclick=()=>applyProposal(+b.dataset.propApply));
  box.querySelectorAll('[data-prop-undo]').forEach(b=>b.onclick=()=>undoProposal(+b.dataset.propUndo));
  box.querySelectorAll('[data-prop-dismiss]').forEach(b=>b.onclick=()=>{ const h=loadCoach(); const m=h[+b.dataset.propDismiss]; m.dismissed=true; coachDecided(m); saveCoach(h); renderCoach(); });
}

// obwody od Trenera: nazwa w narzędziu → klucz pomiaru w S.measures
export const OBW_KEY = {pas:'waist', klatka:'chest', ramie:'arm', udo:'thigh', biodra:'hips'};
export function obwLabel(x){ const m=MEASURES.find(y=>y.k===OBW_KEY[x.pomiar]); return m?m.l:x.pomiar; }
export function obwPrev(x){ const e=(S.measures||[]).find(m=>m.d===x.data); return e&&e[OBW_KEY[x.pomiar]]; }

export function propText(P){
  return [...(P.cwiczenia||[]).map(x=>x.nazwa+': '+(x.ciezar_kg>0?fmtKg(x.ciezar_kg)+' kg · ':'')+x.serie+'×'+x.powtorzenia),
    ...(P.zamiany_cwiczen||[]).map(x=>'zamiast '+x.z+' → '+x.na+' '+x.serie+'×'+x.powtorzenia),
    ...(P.posilki||[]).map(x=>x.posilek+' ('+daysTxt(x.dni)+') → '+x.opis+' '+x.kcal+' kcal'),
    ...(P.cel_kcal?['cel kalorii '+P.cel_kcal+' kcal/dzień']:[]),
    ...(P.cel_krokow?['cel kroków '+P.cel_krokow+' dziennie']:[]),
    ...(P.przesuniecia||[]).map(x=>x.dzien+': trening z '+x.trening_z),
    ...(P.przerwy||[]).map(x=>'przerwa '+x.cwiczenie+' '+fmtDur(x.sekundy)),
    ...(P.obwody||[]).map(x=>'obwód '+obwLabel(x)+' z '+x.data+': '+fmtKg(x.cm)+' cm')].join('; ');
}

export function propCard(m,i){
  const P=m.proposal;
  const rows=(P.cwiczenia||[]).map(x=>`<div>• <b>${esc(x.nazwa)}</b>: ${x.ciezar_kg>0?fmtKg(x.ciezar_kg)+' kg · ':''}${x.serie}×${x.powtorzenia}</div>`).join('')+
    (P.zamiany_cwiczen||[]).map(x=>`<div>• <b>${esc(x.z)}</b> → <b>${esc(x.na)}</b>: ${x.ciezar_kg>0?fmtKg(x.ciezar_kg)+' kg · ':''}${x.serie}×${x.powtorzenia}${x.technika?'<div style="color:var(--ink-dim);font-size:13px;padding-left:12px">'+esc(x.technika)+'</div>':''}</div>`).join('')+
    (P.posilki||[]).map(x=>`<div>• <b>${esc(x.posilek)}</b> (${esc(daysTxt(x.dni))}): ${esc(x.opis)} <span style="color:var(--ink-dim)">— ${x.kcal} kcal · B ${x.bialko_g} / W ${x.wegle_g} / T ${x.tluszcz_g}</span></div>`).join('')+
    (P.cel_kcal?`<div>• <b>Cel kalorii</b>: ${P.cel_kcal} kcal/dzień</div>`:'')+
    (P.cel_krokow?`<div>• <b>Cel kroków</b>: ${tysKrokow(P.cel_krokow)} dziennie</div>`:'')+
    (P.przesuniecia||[]).map(x=>{ const now=workoutOn(x.dzien), nw=workoutOn(x.trening_z);
      return `<div>• <b>${dowOf(x.dzien)} ${dmy(x.dzien)}</b>: ${wIcon(nw)} ${esc(nw.title)} <span style="color:var(--ink-dim)">(było: ${esc(now.title)})</span></div>`; }).join('')+
    (P.przerwy||[]).map(x=>`<div>• <b>Przerwa · ${esc(x.cwiczenie)}</b>: ${fmtDur(restCurrent(x.cwiczenie))} → <b>${fmtDur(x.sekundy)}</b></div>`).join('')+
    (P.obwody||[]).map(x=>{ const was=m.applied?null:obwPrev(x);
      return `<div>• <b>Obwód · ${esc(obwLabel(x))}</b> (${dmy(x.data)}): ${was?fmtKg(was)+' → ':''}<b>${fmtKg(x.cm)} cm</b></div>`; }).join('');
  const act=m.applied
    ? `<div style="color:#5fbf7a;margin-top:8px">✅ Zastosowano od ${esc(m.appliedFrom||'')}</div><button class="btn ghost" data-prop-undo="${i}" style="font-size:12px;padding:7px 10px;margin-top:6px">Cofnij</button>`
    : m.dismissed ? `<div style="color:var(--ink-faint);margin-top:8px">Odrzucono</div>`
    : `<div style="display:flex;gap:6px;margin-top:10px"><button class="btn" data-prop-apply="${i}" style="flex:2;font-size:13px;padding:9px">Zastosuj od dziś</button><button class="btn ghost" data-prop-dismiss="${i}" style="flex:1;font-size:13px;padding:9px">Odrzuć</button></div>`;
  return `<div class="coach-b a" style="border-color:var(--amber)"><div style="font-size:12px;color:var(--amber);letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px">Propozycja zmian</div>${P.podsumowanie?'<div style="margin-bottom:6px">'+esc(P.podsumowanie)+'</div>':''}${rows}${act}</div>`;
}

export function applyProposal(i){
  const h=loadCoach(), m=h[i]; if(!m||!m.proposal||m.applied) return;
  const P=m.proposal, from=todayISO(), id=Date.now();
  S.adj=S.adj||{}; S.adj.ex=S.adj.ex||{}; S.adj.log=S.adj.log||[];
  // wymiana zapisana pod nazwą, którą widzi użytkownik (po wcześniejszej wymianie — pod nazwą pierwotną z planu)
  const origOf=name=>{ const ex=S.adj.ex; for(const k in ex) for(const y of ex[k]) if(y.swap&&y.swap.n===name) return k; return name; };
  (P.cwiczenia||[]).forEach(x=>{
    const list=(S.adj.ex[x.nazwa]||[]).filter(y=>y.from!==from||y.swap);   // nowsza decyzja z tego samego dnia zastępuje starszą
    list.push({from, w:x.ciezar_kg, s:x.serie, rp:x.powtorzenia, id}); S.adj.ex[x.nazwa]=list;
  });
  (P.zamiany_cwiczen||[]).forEach(x=>{
    const k=origOf(x.z), list=(S.adj.ex[k]||[]).filter(y=>y.from!==from);
    list.push({from, w:x.ciezar_kg, s:x.serie, rp:x.powtorzenia, swap:{n:x.na, cue:x.technika}, id}); S.adj.ex[k]=list;
  });
  S.adj.meals=(S.adj.meals||[]);
  (P.posilki||[]).forEach(x=>{
    S.adj.meals=S.adj.meals.filter(y=>!(y.from===from && y.posilek===x.posilek && JSON.stringify(y.dni)===JSON.stringify(x.dni)));
    S.adj.meals.push({from, posilek:x.posilek, dni:x.dni||[], opis:x.opis, kcal:x.kcal, b:x.bialko_g, w:x.wegle_g, t:x.tluszcz_g, id});
  });
  const prevKcal=S.kcalGoal;
  if(P.cel_kcal){ S.kcalGoal=Math.min(3200,Math.max(1500,Math.round(P.cel_kcal/100)*100)); kcalRecord(S.kcalGoal, prevKcal); kcalSlider.value=S.kcalGoal; updateKcalHint(); }
  const prevMoves=JSON.stringify((S.adj&&S.adj.moves)||{});
  if(P.przesuniecia&&P.przesuniecia.length){
    // tylko pełna wymiana dni od dziś (każdy dzień oddaje i dostaje jeden trening, żaden nie znika)
    const t=todayISO(), days=P.przesuniecia.map(x=>x.dzien).sort().join(), froms=P.przesuniecia.map(x=>x.trening_z).sort().join();
    if(days===froms && P.przesuniecia.every(x=>x.dzien>=t && x.trening_z>=t)){
      const map={}; P.przesuniecia.forEach(x=>{ map[x.dzien]=x.trening_z; });
      S.adj.moves=nextMoves(map);
    }
  }
  if(P.cel_krokow){
    // nowsza decyzja z tego samego dnia zastępuje starszą
    S.adj.steps=(S.adj.steps||[]).filter(y=>y.from!==from);
    S.adj.steps.push({from, goal:Math.max(3000,Math.min(30000,Math.round(P.cel_krokow/500)*500)), id});
  }
  // przerwy od Trenera: zapamiętaj poprzednie ustawienia, żeby „Cofnij” je przywróciło
  let prevRest=null;
  if(P.przerwy&&P.przerwy.length){ S.adj.rest=S.adj.rest||{}; prevRest={};
    P.przerwy.forEach(x=>{ const n=x.cwiczenie.trim(); prevRest[n]=S.adj.rest[n]||null; S.adj.rest[n]={sec:Math.max(30,Math.min(300,Math.round(x.sekundy/15)*15)), by:'tr', id}; });
    if(WO) P.przerwy.forEach(x=>restApplyLive(x.cwiczenie.trim())); }
  // obwody: poprawka albo dopisanie pomiaru z danej daty; poprzednie wartości do „Cofnij”
  let prevMeas=null;
  if(P.obwody&&P.obwody.length){ S.measures=S.measures||[]; prevMeas=[];
    P.obwody.forEach(x=>{ const k=OBW_KEY[x.pomiar]; if(!k) return;
      let e=S.measures.find(y=>y.d===x.data); if(!e){ e={d:x.data}; S.measures.push(e); }
      prevMeas.push({d:x.data, k, v:e[k]??null}); e[k]=x.cm; e._t=Date.now(); });
    renderMeasures(); }
  S.adj.log.push({id, at:id, from, summary:P.podsumowanie, ex:P.cwiczenia, swaps:P.zamiany_cwiczen||[], meals:P.posilki||[], kcal:P.cel_kcal?S.kcalGoal:0, prevKcal, prevMoves:(P.przesuniecia&&P.przesuniecia.length)?prevMoves:null, prevRest, prevMeas});
  S._settingsM=Date.now(); save(); renderToday();
  m.applied=id; m.appliedFrom=from.slice(8,10)+'.'+from.slice(5,7); coachDecided(m); saveCoach(h); renderCoach();
}

export function undoProposal(i){
  const h=loadCoach(), m=h[i]; if(!m||!m.applied||!S.adj) return;
  const id=m.applied, entry=(S.adj.log||[]).find(x=>x.id===id);
  Object.keys(S.adj.ex||{}).forEach(n=>{ S.adj.ex[n]=S.adj.ex[n].filter(y=>y.id!==id); if(!S.adj.ex[n].length) delete S.adj.ex[n]; });
  if(entry && entry.kcal && S.kcalGoal===entry.kcal && entry.prevKcal){ S.kcalGoal=entry.prevKcal; kcalRecord(S.kcalGoal, entry.kcal); kcalSlider.value=S.kcalGoal; updateKcalHint(); }
  S.adj.meals=(S.adj.meals||[]).filter(x=>x.id!==id);
  if(S.adj.steps) S.adj.steps=S.adj.steps.filter(x=>x.id!==id);
  if(entry && entry.prevMoves!=null) S.adj.moves=JSON.parse(entry.prevMoves);   // przesunięcia sprzed tej propozycji
  if(entry && entry.prevRest && S.adj.rest) Object.keys(entry.prevRest).forEach(n=>{ if(S.adj.rest[n] && S.adj.rest[n].id===id){ if(entry.prevRest[n]) S.adj.rest[n]=entry.prevRest[n]; else delete S.adj.rest[n]; } if(WO) restApplyLive(n); });
  if(entry && entry.prevMeas){ entry.prevMeas.forEach(p=>{ const e=(S.measures||[]).find(y=>y.d===p.d); if(!e) return; if(p.v==null) delete e[p.k]; else e[p.k]=p.v; e._t=Date.now(); }); renderMeasures(); }
  S.adj.log=(S.adj.log||[]).filter(x=>x.id!==id);
  S._settingsM=Date.now(); save(); renderToday();
  m.applied=false; coachDecided(m); saveCoach(h); renderCoach();
}

export function renderCoachAtt(){
  const el=document.getElementById('coachAtt'); if(!el) return;
  if(!coachAtt){ el.style.display='none'; return; }
  el.style.display='inline-flex';
  el.innerHTML=`<span>📎 Klatki: ${esc(coachAtt.ex)} · ${new Date(coachAtt.t).toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit'})}</span><button aria-label="Nie dołączaj klatek" id="coachAttX">✕</button>`;
  document.getElementById('coachAttX').onclick=()=>{ coachAtt=null; renderCoachAtt(); };
}

// do 8 klatek: najpierw te z odchyleniami od wzorca, potem równomiernie z całej serii
export async function coachAttImages(att){
  const rec:any=await fcGet(att.id); if(!rec) return null;
  const issues=fcIssues(rec), n=rec.raw.length, pick=[];
  issues.forEach((a,i)=>{ if(a.length && pick.length<4) pick.push(i); });
  for(let k=0;k<n && pick.length<8;k++){ const i=Math.round(k*(n-1)/7); if(!pick.includes(i)) pick.push(i); }
  pick.sort((a,b)=>a-b);
  const imgs=[]; for(const i of pick.slice(0,8)){ const c=await fcRenderFrame(rec,i,issues); imgs.push(c.toDataURL('image/jpeg',0.72).split(',')[1]); }
  return imgs;
}

export async function coachSend(text, {voice=false}={}){
  text=(text||'').trim(); if(!text||coachBusy) return;
  coachSpeakStop();
  // krótkie podziękowanie w trwającej rozmowie: odpowiedź bez AI, nie zjada limitu
  if(planEnforced() && EA_SHORT.test(text) && loadCoach().length){
    const loc=COACH_UI[langOf(S.profile)].local, h0=loadCoach(), a=loc[Math.floor(Math.random()*loc.length)];
    h0.push({role:'user',content:text, id:coachId(), t:Date.now(), local:1});
    h0.push({role:'assistant',content:a, id:coachId(), t:Date.now(), local:1}); saveCoach(h0);
    document.getElementById('coachIn').value=''; renderCoach();
    if(voice && coachSpeakOn()) coachSpeak(a, ()=>coachVoice.say('')); else if(voice) coachVoice.say('');
    return;
  }
  if(quotaLeft('coach')===0){ quotaUi(); if(voice) coachVoice.say(''); return; }
  if(!navigator.onLine){ coachVoice.say('Brak internetu — Trener odpowie, gdy wróci zasięg. Wiadomość czeka w polu.','info'); return; }
  const att=coachAtt; coachAtt=null;
  const um={role:'user',content:text, id:coachId(), t:Date.now()};
  const h=loadCoach(); h.push(um); saveCoach(h);
  coachBusy=true; document.getElementById('coachIn').value=''; renderCoach();
  let reply='', extra={};
  try{
    if(att){
      const imgs=await coachAttImages(att), fm=loadCoach().find(x=>x.id===att.id)||{};
      if(imgs && imgs.length){
        const r=fm.res||{};
        extra={images:imgs, imagesNote:`Ćwiczenie: ${att.ex}${fm.set?' ('+fm.set+')':''}, nagranie z ${new Date(att.t).toLocaleString('pl-PL')}. Wstępna automatyczna ocena: ${r.ocena||fm.grade||'—'} — ${r.podsumowanie||''} Poprawki: ${(r.poprawki||[]).map(p=>p.problem+' → '+p.jak_poprawic).join('; ')||'brak'}. Pomiary: ${JSON.stringify(fm.metrics||{})}`};
        const hh=loadCoach(), me=hh.find(x=>x.id===um.id); if(me){ me.att={ex:att.ex, n:imgs.length}; saveCoach(hh); renderCoach(); }
      }
    }
    // historia dla Trenera: 8 ostatnich wiadomości (nie korzystają z pamięci podręcznej — to największa zmienna część wejścia);
    // starsze odpowiedzi Trenera skrócone, 2 ostatnie wiadomości w całości
    const hist=h.filter(m=>!m.local).slice(-COACH_TURNS);
    const msgs=hist.map((m,i)=>{ const old=i<hist.length-2 && m.role==='assistant' && m.content.length>COACH_OLD_MAX;
      return {role:m.role, content:(old?m.content.slice(0,COACH_OLD_MAX)+'… [skrócone]':m.content)+(m.proposal?'\n\n[Zaproponowane zmiany: '+propText(m.proposal)+' — decyzja użytkownika: '+(m.applied?'zastosował od '+todayISO():m.dismissed?'odrzucił':'jeszcze nie zdecydował')+']':'')}; });
    // features: serwer pokaże Trenerowi pole cel_krokow tylko wersjom, które je obsługują
    const ctx=buildCoachContext();
    const j=await cloudCall('coach',Object.assign({messages:msgs, context:ctx.stat, contextLive:ctx.live, exercises:coachTargets().map(t=>t.n), features:['kroki','przesuniecia','przerwy','obwody']}, extra));
    if(j.quota) quotaSet(j.quota);
    const h2=loadCoach(); h2.push({role:'assistant',content:j.text, proposal:j.proposal||null, id:coachId(), t:Date.now()}); saveCoach(h2);
    reply=j.text+(j.proposal?' Mam też propozycję zmian — sprawdź ją na ekranie.':'');
  }catch(e){
    if(e.data && e.data.quota) quotaSet(e.data.quota);
    const h2=loadCoach(); h2.push({role:'assistant',content:'⚠️ '+(netDown(e)?'Brak połączenia z internetem. Spróbuj ponownie, gdy wróci zasięg.':e.message), id:coachId(), t:Date.now()}); saveCoach(h2);
  }
  coachBusy=false; renderCoach();
  if(document.getElementById('usageSection').style.display==='block') loadUsage();
  // pytanie głosem → odpowiedź na głos, potem Trener znów słucha (rozmowa na żywo)
  if(voice && reply && coachSpeakOn() && coachOpen()) coachSpeak(reply, ()=>{ if(coachOpen()) coachVoice.start(); });
  else if(voice) coachVoice.say('');
}

export function openCoach(){
  if(!featOn('coach')){ showInAppReminder('Trener jest wyłączony', 'Rozmowa z Trenerem jest teraz niedostępna'+(planEnforced()?' w Twoim planie.':'.')); return; }
  document.getElementById('coachDialog').classList.add('show'); renderCoach(); coachSpeakUi(); quotaUi(); quotaLoad(); setTimeout(()=>document.getElementById('coachIn').focus(),60); }

export function coachSpeakOn(){ try{ return localStorage.getItem('zelazo_coach_tts')!=='off'; }catch(e){ return true; } }

export function coachSpeakUi(){
  const b=document.getElementById('coachSpeak');
  if(!TTS){ b.style.display='none'; return; }
  const on=coachSpeakOn(); b.textContent=on?'🔊':'🔇'; b.setAttribute('aria-pressed',on?'true':'false');
  b.setAttribute('aria-label', on?'Wyłącz czytanie odpowiedzi':'Włącz czytanie odpowiedzi');
}
   // przerwane czytanie nie może włączyć mikrofonu
export function coachSpeakStop(){ coachSpeakSeq++; if(TTS) TTS.cancel(); }

// tekst do czytania: bez znaczników, w kawałkach po zdaniach (Chrome ucina długie wypowiedzi)
export function coachSpeak(text, onEnd?){
  if(!TTS){ onEnd&&onEnd(); return; }
  coachSpeakStop(); const seq=coachSpeakSeq;
  const clean=String(text).replace(/\*\*|__|_|#+\s*/g,'').replace(/^\s*[-•]\s+/gm,'').replace(/\s+/g,' ').trim();
  const parts=clean.match(/[^.!?…]+[.!?…]*\s*/g)||[clean], chunks=[];
  parts.forEach(p=>{ const last=chunks[chunks.length-1]; if(last && (last+p).length<220) chunks[chunks.length-1]=last+p; else chunks.push(p); });
  const loc=speechLocale(langOf(S.profile)), voice=(TTS.getVoices()||[]).find(v=>v.lang.toLowerCase().startsWith(loc.slice(0,2)));
  coachVoice.say('🔊 Trener mówi… stuknij 🎤, żeby przerwać i odpowiedzieć.','info');
  chunks.forEach((c,i)=>{
    const u=new SpeechSynthesisUtterance(c.trim()); u.lang=loc; if(voice) u.voice=voice;
    if(i===chunks.length-1){ u.onend=()=>{ if(seq===coachSpeakSeq && onEnd) onEnd(); }; u.onerror=()=>{ if(!coachVoice.active()) coachVoice.say(''); }; }
    TTS.speak(u);
  });
}

export function __init_17(){

/* ---- czat z Trenerem w danych konta (S.coach), więc synchronizuje się między urządzeniami ----
   S.coach = {clearedAt, msgs:[{id, t, st, role, content, proposal, applied, appliedFrom, dismissed}]}
   t = czas wiadomości (kolejność), st = czas ostatniej decyzji o propozycji (nowsza wygrywa przy scalaniu). */
coachKey = ()=>'zelazo_coach_'+((CLOUD.account||'lokalnie').toLowerCase());
coachId = ()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
// zmiana decyzji o propozycji (zastosuj / odrzuć / cofnij) dostaje własny znacznik czasu
coachDecided = m=>{ m.st=Date.now(); };
coachBusy = false;
fmtKg = x=>String(x).replace('.',',');
DAY_SHORT = ['Nd','Pn','Wt','Śr','Cz','Pt','Sb'];
daysTxt = d=>(!d||!d.length)?'codziennie':d.slice().sort((a,b)=>((a+6)%7)-((b+6)%7)).map(x=>DAY_SHORT[x]).join(', ');
/* ---- klatki z nagrania techniki dołączone do pytania do Trenera ----
   Po analizie klatki dołączają się same do następnego pytania (chip „📎 Klatki …” z ✕), można też wybrać starsze nagranie
   przyciskiem przy ocenie. Wysyłane tylko z jednym pytaniem (do 8 klatek ze szkieletem i wzorcem); klatki są tylko na tym telefonie. */
coachAtt = null;
coachOpen = ()=>document.getElementById('coachDialog').classList.contains('show');
document.getElementById('coachFab').onclick=openCoach;
document.getElementById('coachClose').onclick=()=>{ coachVoice.stop(); coachSpeakStop(); coachVoice.say(''); document.getElementById('coachDialog').classList.remove('show'); };

/* ---- rozmowa głosem z Trenerem ----
   🎤: pytanie dyktowane i wysyłane samo po chwili ciszy. Odpowiedź czytana na głos (pl-PL, syntezator telefonu),
   potem mikrofon włącza się ponownie — cisza kończy rozmowę. 🔊/🔇 wyłącza czytanie (zapamiętane na tym urządzeniu). */
coachVoice = makeDictation({
  input:document.getElementById('coachIn'), mic:document.getElementById('coachMic'), msg:document.getElementById('coachVoice'),
  listening:'● Słucham… zadaj pytanie. Wyślę je sam po chwili ciszy.',
  onDone:heard=>{ coachVoice.say('Wysłano — Trener myśli…','info'); coachSend(document.getElementById('coachIn').value, {voice:true}); },
  onSilence:()=>coachVoice.say('Rozmowa wstrzymana. Stuknij 🎤, żeby mówić dalej.','info')
});
document.getElementById('coachMic').addEventListener('click',()=>coachSpeakStop(), true);   // mówisz → Trener milknie
TTS = window.speechSynthesis||null;
document.getElementById('coachSpeak').onclick=()=>{
  const on=!coachSpeakOn();
  try{ localStorage.setItem('zelazo_coach_tts', on?'on':'off'); }catch(e){}
  if(!on) coachSpeakStop();
  coachSpeakUi();
};
coachSpeakSeq = 0;
document.getElementById('coachClear').onclick=()=>{ if(confirm('Wyczyścić rozmowę z Trenerem? Zniknie na wszystkich Twoich urządzeniach.')){ S.coach={clearedAt:Date.now(), msgs:[]}; save(); renderCoach(); } };
document.getElementById('coachSend').onclick=()=>coachSend(document.getElementById('coachIn').value);
document.getElementById('coachIn').addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); coachSend(e.target.value); } });
// podpowiedzi (#coachChips) buduje renderCoach w języku konta
document.getElementById('coachGoSync').onclick=()=>{ document.getElementById('coachDialog').classList.remove('show'); document.querySelector('.nav button[data-v="set"]').click(); moreOpen('sync'); setTimeout(()=>document.getElementById('cloudState').scrollIntoView({block:'center'}),300); };
}
