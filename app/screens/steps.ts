// ŻELAZO — Dzienny cel kroków (także od Trenera).
// Moduł zawiera tylko deklaracje; kod startowy jest w __init_N, wywoływanych przez main.js w stałej kolejności.
import { S, save } from '../core/state';
import { mark } from '../lib/state';
import { renderToday } from './train';

export let DEFAULT_STEPS, tysKrokow;

export function stepsAdj(iso){ let r=null; ((S.adj&&S.adj.steps)||[]).forEach(x=>{ if(x.from<=iso && (!r||x.from>=r.from)) r=x; }); return r; }

export function renderHabits(iso, dow, L){
  const box=document.getElementById('habitsBox');
  const sa=stepsAdj(iso);
  const habits=[
    {k:'sleep',ic:'😴',t:'Sen 7–8 h',s:'Regeneracja + testosteron'},
    {k:'sun',ic:'🚶',t:tysKrokow(sa?sa.goal:DEFAULT_STEPS),s:sa?'Cel od Trenera':'Cel startowy'},
    {k:'notool',ic:'📓',t:'Zapis w dzienniku',s:'Ciężary i powtórzenia'},
    {k:'noalco',ic:'🚫',t:'Bez alkoholu',s:'Trzymaj deficyt'},
    {k:'nosugar',ic:'🍬',t:'Bez słodyczy',s:'Trzymaj deficyt'},
  ];
  box.innerHTML=habits.map(h=>{
    const on=!!L.habits[h.k];
    return `<div class="habit ${on?'on':''}" data-habit="${h.k}">
      <span class="ic">${h.ic}</span>
      <div class="l"><div class="t">${h.t}</div><div class="s">${h.s}</div></div>
      <span class="mini ${on?'on':''}"><svg viewBox="0 0 24 24"><path d="M4 12l5 5L20 6"/></svg></span>
    </div>`;
  }).join('');
  box.querySelectorAll('[data-habit]').forEach(el=>{
    el.onclick=()=>{const k=el.dataset.habit;L.habits[k]=!L.habits[k];mark(L,'habit:'+k);save();renderToday()};
  });
}

export function renderWater(iso, L){
  const box=document.getElementById('waterBox');
  const target=6; // 6 × 0.5 L = 3 L
  let html='';
  for(let i=1;i<=target;i++){
    html+=`<div class="drop ${i<=L.water?'on':''}" data-w="${i}">½L</div>`;
  }
  box.innerHTML=html;
  document.getElementById('waterCount').textContent=`${L.water} / ${target}`;
  box.querySelectorAll('[data-w]').forEach(el=>{
    el.onclick=()=>{const n=+el.dataset.w; L.water=(L.water===n)?n-1:n; mark(L,'water'); save(); renderToday()};
  });
}

export function __init_7(){

/* ---- dzienny cel kroków: S.adj.steps=[{from, goal, id}] od Trenera; obowiązuje najnowszy wpis z from <= dzień ---- */
DEFAULT_STEPS = 8000;
tysKrokow = n=>String(Math.round(n/100)/10).replace('.',',')+' tys. kroków';
}
