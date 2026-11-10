// ŻELAZO — Widok planu: fazy i tygodnie.
// Moduł zawiera tylko deklaracje; kod startowy jest w __init_N, wywoływanych przez main.js w stałej kolejności.
import { dayIndexFor, weekOf } from '../core/backup';
import { todayISO } from '../lib/dates';
import { FBW_A, FBW_B, HOME, LOWER, UPPER } from '../plan/data';


/* ============================================================
   PLAN VIEW
   ============================================================ */
export function renderPlan(){
  const box=document.getElementById('planPhases');
  const phases=[
    {n:1,name:"Faza 1 · Adaptacja i redukcja",wk:"Tygodnie 1–8",desc:"Budowa siły bazowej na wolnych ciężarach. FBW A/B trzy razy w tygodniu, bieganie dwa razy.",split:"Pn FBW · Wt bieg · Śr FBW · Cz rest · Pt FBW · Sb bieg · Nd regeneracja",days:[FBW_A,FBW_B]},
    {n:2,name:"Faza 2 · Hipertrofia",wk:"Tygodnie 9–16",desc:"Układ nerwowy zaadaptowany. Siłownia 3× w tygodniu w podziale Góra/Dół (na zmianę U-L-U / L-U-L), sesja domowa z kettlem i brzuchem, jeden bieg.",split:"Pn siłownia · Wt dom · Śr siłownia · Cz rest · Pt siłownia · Sb bieg + rozciąganie · Nd mobilność",days:[UPPER,LOWER,HOME]},
    {n:3,name:"Faza 3 · Rzeźba",wk:"Tygodnie 17–24",desc:"Ciężar −10%, +2–4 powtórzenia, cardio 20 min po każdej sesji siłowej. Ten sam rytm tygodnia, bieg dłuższy.",split:"Pn siłownia · Wt dom · Śr siłownia · Cz rest · Pt siłownia · Sb długi bieg 50–60 min · Nd mobilność",days:[UPPER,LOWER,HOME]},
  ];
  const curWk=(()=>{const di=dayIndexFor(todayISO());return di>=1&&di<=168?weekOf(di):0})();
  box.innerHTML=phases.map(p=>{
    const active=curWk>=(p.n===1?1:p.n===2?9:17)&&curWk<=(p.n===1?8:p.n===2?16:24);
    return `<div class="section">
      <div class="panel">
        <div class="wk-head" style="border-bottom:1px solid var(--line)">
          <span class="badge ${active?'':'rest'}">${active?'TERAZ':'FAZA '+p.n}</span>
          <span class="t">${p.name}</span>
        </div>
        <div class="panel-pad">
          <div style="font-family:var(--font-disp);font-size:14px;color:var(--ph${p.n});letter-spacing:.06em">${p.wk}</div>
          <p style="color:var(--ink-dim);font-size:13.5px;margin:6px 0 10px">${p.desc}</p>
          <div style="font-size:12.5px;color:var(--ink-faint);background:var(--panel2);border-radius:8px;padding:9px 11px">${p.split}</div>
        </div>
      </div>
    </div>`;
  }).join('') + `<div class="note">Faza 1 rotuje FBW A/B (tydzień nieparzysty: A/B/A, parzysty: B/A/B). Po 10–12 tygodniu, gdy waga stanie, utnij 50 g węgli w dni nietreningowe (−~200 kcal).</div>`;
}


