// ŻELAZO — Seria dni i oceny kategorii dnia.
// Moduł zawiera tylko deklaracje; kod startowy jest w __init_N, wywoływanych przez main.js w stałej kolejności.
import { dayIndexFor } from '../core/backup';
import { S } from '../core/state';
import { parseISO, todayISO } from '../lib/dates';
import { dietScore } from '../lib/dietday';
import { macroGoalFor, workoutOn } from '../plan/data';
import { goalOn } from './progress';
import { dayTotals, exAny } from './train';

export let STREAK_CATS, calMonth, calCat;

/* ============================================================
   STREAK
   ============================================================ */
/* ==== oceny kategorii dla danego dnia (ISO) ==== */
// czy dzień jest dniem treningowym w planie (sesja siłowa)?
export function isTrainingDay(iso){
  const di=dayIndexFor(iso); if(di<1||di>168) return false;
  const w=workoutOn(iso); return !!(w&&w.type==='lift');
}

// czy dieta danego dnia zaliczona? kcal 85–110% celu tego dnia i białko ≥ 80% (app/lib/dietday) — z planu czy własne, bez znaczenia
export function dietMet(iso){
  const L=S.log[iso]; if(!L) return false;
  if(dayIndexFor(iso)<1) return false;
  const goal=goalOn(iso);
  return dietScore(dayTotals(iso, goal), macroGoalFor(goal)).ok;
}

// czy trening danego dnia wykonany? (dzień treningowy + ≥1 seria odhaczona)
export function trainingDone(iso){
  if(!isTrainingDay(iso)) return false;
  const L=S.log[iso]; if(!L) return false;
  return Object.values(L.ex||{}).some(exAny);
}

// czy nawyk zaznaczony danego dnia?
export function habitOn(iso,key){ const L=S.log[iso]; return !!(L&&L.habits&&L.habits[key]); }

// ocena kategorii: zwraca 'yes' | 'no' | 'skip' (dzień neutralny, np. nietreningowy) dla danego ISO
export function evalCategory(cat, iso){
  if(dayIndexFor(iso)<1) return 'skip';   // przed startem planu nic się nie liczy
  if(cat==='diet')  return dietMet(iso)?'yes':'no';
  if(cat==='sleep') return habitOn(iso,'sleep')?'yes':'no';
  if(cat==='alco')  return habitOn(iso,'noalco')?'yes':'no';
  if(cat==='sugar') return habitOn(iso,'nosugar')?'yes':'no';
  if(cat==='train') return isTrainingDay(iso) ? (trainingDone(iso)?'yes':'no') : 'skip';
  return 'skip';
}

// aktualna seria wstecz od dziś (dni 'skip' są pomijane, nie zrywają)
export function currentStreak(cat){
  let streak=0, d=new Date();
  const todayIso=todayISO(new Date());
  for(let i=0;i<400;i++){
    const iso=todayISO(d);
    const v=evalCategory(cat, iso);
    if(v==='skip'){ d.setDate(d.getDate()-1); continue; }
    if(v==='yes') streak++;
    else {
      // dziś jeszcze niezaliczone — nie zrywaj, po prostu nie licz dzisiejszego; zacznij od wczoraj
      if(iso===todayIso){ d.setDate(d.getDate()-1); continue; }
      break;
    }
    d.setDate(d.getDate()-1);
  }
  return streak;
}

// rekord (najdłuższa seria w historii logu)
export function recordStreak(cat){
  const isos=Object.keys(S.log).sort();
  if(!isos.length) return 0;
  let best=0,cur=0;
  let d=parseISO(isos[0]); const end=new Date();
  while(d<=end){
    const iso=todayISO(d);
    const v=evalCategory(cat, iso);
    if(v==='yes'){ cur++; best=Math.max(best,cur); }
    else if(v==='no'){ cur=0; }
    // 'skip' nie rusza licznika
    d.setDate(d.getDate()+1);
  }
  return best;
}

export function dayIsActive(iso){ return dietMet(iso) || trainingDone(iso); }
 // do ogólnych statystyk

export function updateStreak(){
  const dietS=currentStreak('diet'), trainS=currentStreak('train');
  // górny chip: dieta + trening
  const chip=document.getElementById('streakChip');
  document.getElementById('streakN').innerHTML='🍽️ '+dietS+' · 🏋️ '+trainS;
  chip.classList.toggle('dead',dietS===0&&trainS===0);
  // statystyki ogólne
  let totWk=0,totDays=0;
  Object.keys(S.log).forEach(iso=>{
    if(dayIndexFor(iso)<1) return;   // tylko dni od startu planu
    const L=S.log[iso];
    const ex=Object.values(L.ex||{}).filter(exAny).length;
    if(ex>0)totWk++;
    if(dayIsActive(iso))totDays++;
  });
  const sw=document.getElementById('statWorkouts'); if(sw)sw.textContent=String(totWk);
  const sd=document.getElementById('statDays'); if(sd)sd.textContent=String(totDays);
  const ss=document.getElementById('statStreak'); if(ss)ss.textContent=String(dietS);
  renderStreakCards();
  renderStreakCalendar();
}

export function renderStreakCards(){
  const box=document.getElementById('streakCards'); if(!box) return;
  box.innerHTML=STREAK_CATS.map(c=>{
    const cur=currentStreak(c.k), rec=recordStreak(c.k);
    return `<div class="streak-card ${cur===0?'zero':''}">
      <span class="sc-ic">${c.ic}</span>
      <div class="sc-body">
        <div class="sc-n">${cur}</div>
        <div class="sc-lab">${c.lab}</div>
        <div class="sc-rec">rekord: ${rec} dni</div>
      </div>
    </div>`;
  }).join('');
}

// najdalszy miesiąc w kalendarzu: bieżący albo miesiąc startu planu, jeśli start jest później
export function calMaxMonth(){
  const now=new Date(), a=new Date(now.getFullYear(),now.getMonth(),1);
  const st=parseISO(S.startDate), b=new Date(st.getFullYear(),st.getMonth(),1);
  return b>a?b:a;
}

export function renderStreakCalendar(){
  const catsBox=document.getElementById('calCats'); if(!catsBox) return;
  catsBox.innerHTML=STREAK_CATS.map(c=>`<button class="cal-cat ${c.k===calCat?'on':''}" data-cal="${c.k}">${c.ic} ${c.lab}</button>`).join('');
  catsBox.querySelectorAll('[data-cal]').forEach(el=>el.onclick=()=>{calCat=el.dataset.cal;renderStreakCalendar();});
  const y=calMonth.getFullYear(), m=calMonth.getMonth();
  const MON=['styczeń','luty','marzec','kwiecień','maj','czerwiec','lipiec','sierpień','wrzesień','październik','listopad','grudzień'];
  document.getElementById('calMonth').textContent=MON[m]+' '+y;
  document.getElementById('calNext').disabled = new Date(y,m+1,1) > calMaxMonth();
  const first=new Date(y,m,1); const daysInMonth=new Date(y,m+1,0).getDate();
  let startDow=first.getDay(); startDow=(startDow===0)?6:startDow-1; // Pn=0
  const DOW=['Pn','Wt','Śr','Cz','Pt','So','Nd'];
  const grid=document.getElementById('calGrid');
  const todayStr=todayISO(new Date());
  let html=DOW.map(d=>`<div class="cal-cell dow">${d}</div>`).join('');
  for(let i=0;i<startDow;i++) html+=`<div class="cal-cell empty"></div>`;
  for(let day=1;day<=daysInMonth;day++){
    const dObj=new Date(y,m,day); const iso=todayISO(dObj);
    let cls='cal-cell'; let v='future';
    if(iso>todayStr){ cls+=' future'; }
    else { v=evalCategory(calCat, iso); cls+=' '+v; }
    const showNum = (v==='skip'&&iso<=todayStr) ? '' : day;
    html+=`<div class="${cls}">${showNum}</div>`;
  }
  grid.innerHTML=html;
}

export function __init_8(){

STREAK_CATS = [
  {k:'diet',ic:'🍽️',lab:'Dieta'},
  {k:'train',ic:'🏋️',lab:'Trening'},
  {k:'alco',ic:'🚫',lab:'Bez alkoholu'},
  {k:'sugar',ic:'🍬',lab:'Bez słodyczy'},
  {k:'sleep',ic:'😴',lab:'Sen'},
];

// 1. dzień miesiąca o północy — bez godziny, żeby porównanie z limitem było dokładne
calMonth = (()=>{ const d=new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })();
calCat = 'diet';
document.addEventListener('click',e=>{
  if(e.target&&e.target.id==='calPrev'){ calMonth=new Date(calMonth.getFullYear(), calMonth.getMonth()-1, 1); renderStreakCalendar(); }
  if(e.target&&e.target.id==='calNext'){ const n=new Date(calMonth.getFullYear(), calMonth.getMonth()+1, 1); if(n<=calMaxMonth()){ calMonth=n; renderStreakCalendar(); } }
});
}
