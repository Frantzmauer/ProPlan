// ŻELAZO — Plan konta, funkcje i miesięczne limity na ekranie (licznik, okno głosowe, pakiet).
// Moduł zawiera tylko deklaracje; kod startowy jest w __init_N, wywoływanych przez main.js w stałej kolejności.
import { CLOUD, appChannel, cloudCall } from '../core/state';
import { todayISO } from '../lib/dates';
import { currentQuota, featureOn, planEnforcedFor, planFromServer, quotaLeftOf, resetLabel } from '../lib/plan';
import { KEYS, readJSON, writeJSON } from '../lib/storage';
import { esc } from '../screens/accounts';
import { coachVoice } from '../screens/coach';
import { moreOpen } from '../screens/more';
import { showInAppReminder } from './reminders';
import { COACH_UI } from '../lib/lang';
import { monthNames, t } from '../lib/i18n';

export let EA_SHORT, EA_LOCAL, PLAN, QUOTA, vqOk;

export function planEnforced(){ return planEnforcedFor(PLAN, appChannel()); }

export function featOn(k){ return featureOn(PLAN, k); }

export function planSet(j){
  const p=planFromServer(j); if(!p) return;   // stary serwer bez planów
  PLAN=p; writeJSON(KEYS.plan(appChannel()), PLAN);
  if(j.quota) quotaSet(j.quota); else quotaUi();
  applyFeatures();
}

// pokaż albo ukryj elementy według planu i wyłącznika awaryjnego
export function applyFeatures(){
  const show=(id,on)=>{ const el=document.getElementById(id); if(el) el.style.display=on?'':'none'; };
  show('coachFab', featOn('coach')); show('coachMic', featOn('voice'));
  show('mdEstimate', featOn('estimate')); show('mdScan', featOn('scanner')); show('mdPhoto', featOn('estimate') && featOn('photo'));
  show('mmPlanBtn', planEnforced());
  document.getElementById('eaGate').style.display=(appChannel()==='early' && PLAN && !featOn('early'))?'flex':'none';
}

// zapamiętany stan z poprzedniego miesiąca → licznik od zera (lib/plan.ts)
export function quotaCur(){ return currentQuota(QUOTA, planEnforced(), todayISO().slice(0,7)); }

// funkcje (nie const): moreStatus pyta o licznik, zanim skrypt dojdzie do tego miejsca
export function quotaLeft(k){ return quotaLeftOf(quotaCur(), k); }

export function quotaReset(){ return resetLabel(); }

export function quotaSet(q){
  if(!q || !q.coach || !q.form) return;
  QUOTA=q; writeJSON(KEYS.QUOTA, q);
  quotaUi();
}

export async function quotaLoad(){
  if(!(CLOUD.on && CLOUD.url && CLOUD.token) || !navigator.onLine || !planEnforced()) return;
  try{ planSet(await cloudCall('usage', {})); }catch(e){}
}

export function quotaUi(){
  const chip=document.getElementById('coachQuota'), lim=document.getElementById('coachLimit'), q=quotaCur();
  const sec=document.getElementById('v-set').dataset.sec;
  if(sec==='plan') renderPlanQuota();
  if(!q){ chip.style.display='none'; lim.style.display='none'; return; }
  const left=quotaLeft('coach'), out=left===0;
  chip.style.display='inline-flex'; chip.textContent='💬 '+t('{a} z {b}', {a:left, b:q.coach.max});
  chip.classList.toggle('low', left>0 && left<=3); chip.classList.toggle('out', out);
  lim.style.display=out?'block':'none';
  if(out){
    lim.innerHTML=t('<b>Limit {n} pytań na {m} wykorzystany.</b> Nowe pytania od {d}. Plan, tryb treningu, check-in i przerwy działają dalej bez limitu.', {n:q.coach.max, m:monthNames()[+q.m.slice(5,7)-1], d:quotaReset()})+limitOffer('coach');
    bindOffer(lim);
  }
  ['coachIn','coachSend','coachMic'].forEach(id=>{ document.getElementById(id).disabled=out; });
  document.getElementById('coachChips').style.opacity=out?'.4':'';
  document.getElementById('coachChips').style.pointerEvents=out?'none':'';
}

/* ---- po wyczerpaniu limitu: oferta Premium (gdy plan jej nie ma) i pakietu pytań do Trenera ----
   Płatności jeszcze nie działają — przyciski mówią, kiedy będą. Ceny w jednym miejscu (zgodne ze stroną startową). */
export const OFFER = { premium: '29 zł / mies.', pack: { n: 50, price: '24,99 zł' } };   // na ekranie przez t()
export function isPremium(){ return !!PLAN && (PLAN.plan==='premium' || PLAN.plan==='tester'); }
export function limitOffer(kind){
  const btn=(id,main,sub,cls='')=>`<button class="btn lim-offer ${cls}" type="button" data-offer="${id}"><b>${main}</b>${sub?`<small>${sub}</small>`:''}</button>`;
  return (isPremium()?'':btn('premium',t('Przejdź na Premium · {p}', {p:t(OFFER.premium)}),t('30 rozmów z Trenerem (też głosem), posiłki ze zdjęcia i kodu kreskowego, 300 szacowań kalorii')))
    +(kind==='coach'?btn('pack',t('Dokup pakiet {n} pytań · {p}', {n:OFFER.pack.n, p:t(OFFER.pack.price)}),t('pytania z pakietu nie wygasają z końcem miesiąca'), isPremium()?'':'ghost'):'');
}
export function bindOffer(root){
  (root||document).querySelectorAll('[data-offer]').forEach(b=>b.onclick=()=>showInAppReminder(
    b.dataset.offer==='pack'?t('Pakiet pytań — wkrótce'):t('Premium — wkrótce'),
    t('Płatności uruchomimy razem z nowymi kontami. Do tego czasu limit odnowi się {d}.', {d:quotaReset()})));
}

export function renderPlanQuota(){
  const box=document.getElementById('planBox'); if(!box) return;
  if(!(CLOUD.on && CLOUD.url && CLOUD.token)){
    box.innerHTML='<div class="md-hint" style="margin:0">'+t('Limity Trenera liczy serwer — włącz synchronizację (Więcej → Synchronizacja i konta), żeby je zobaczyć.')+'</div>'; return;
  }
  const q=quotaCur();
  if(!q){ box.innerHTML='<div class="md-hint" style="margin:0">'+t('Wczytuję limity…')+'</div>'; return; }
  const meter=(label,n,max)=>!max?`<div class="pq-m"><div class="t"><span>${label}</span><b>${t('w Premium')}</b></div></div>`:`<div class="pq-m"><div class="t"><span>${label}</span><b>${n} / ${max}</b></div><div class="pq-bar"><span class="${n>=max?'full':''}" style="width:${Math.min(100,Math.round(n/max*100))}%"></span></div></div>`;
  box.innerHTML=`<div class="pq-top"><div><b>${esc(PLAN&&PLAN.planName?t(PLAN.planName):t('Twój plan'))}</b><small>${t('Limity odnawiają się {d}', {d:quotaReset()})}</small></div><span class="pq-badge">${monthNames()[+q.m.slice(5,7)-1]}</span></div>
    ${meter(t('Pytania do Trenera'), q.coach.n, q.coach.max)}
    ${meter(t('Oceny techniki z nagrania'), q.form.n, q.form.max)}
    ${meter(t('Szacowanie kalorii posiłków'), q.est.n, q.est.max)}
    <div class="md-hint" style="margin:-8px 0 0">${t('Tekstem albo głosem — tak samo. Najwyżej {n} dziennie. Nie zjada pytań do Trenera.', {n:q.est.day})}</div>
    <div class="md-hint" style="margin:0">${t('Bez limitu: plan treningu i diety, ręczne wpisywanie kalorii, tryb treningu, rekordy, przerwy, check-in, cykl, praca offline. Krótkie „dzięki” i „ok” do Trenera nie liczą się do limitu.')}</div>`;
}

export function vqMuted(){ try{ return localStorage.getItem('zelazo_voice_note')==='off'; }catch(e){ return false; } }

export function openVoiceQuota(){
  const q=quotaCur(), left=quotaLeft('coach');
  document.getElementById('vqPanel').innerHTML=`<div class="eh-grab"></div>
    <div class="eh-head"><div style="flex:1;min-width:0"><div class="eyebrow">${t('Twój plan')}</div><h2 id="vqTitle">${t('Rozmowa głosowa')}</h2></div><button class="eh-x" data-vqclose aria-label="${t('Zamknij')}">✕</button></div>
    <p>${t('Każda Twoja wypowiedź to <b>1 pytanie</b> z limitu.')}${q?' '+t('Zostało Ci <b>{a} z {b}</b>.', {a:left, b:q.coach.max}):''}</p>
    <p style="color:var(--ink-dim);font-size:14px">${t('Wskazówka: powiedz całe pytanie naraz, np. „Bolą mnie kolana przy przysiadzie, co zmienić w treningu i ile ciężaru?”.')}</p>
    <button class="btn" id="vqGo" type="button">${t('MÓW')}</button>
    <button class="btn ghost" data-vqclose type="button">${t('Wolę napisać')}</button>
    <label><input type="checkbox" id="vqMute"> ${t('Nie pokazuj więcej')}</label>`;
  const sh=document.getElementById('vqSheet'); sh.style.display='flex';
  const close=()=>{
    if(document.getElementById('vqMute').checked){ try{ localStorage.setItem('zelazo_voice_note','off'); }catch(e){} }
    sh.style.display='none';
  };
  sh.querySelectorAll('[data-vqclose]').forEach(b=>b.onclick=()=>{ close(); document.getElementById('coachIn').focus(); });
  document.getElementById('vqGo').onclick=()=>{ close(); vqOk=true; document.getElementById('coachMic').click(); };
}

export function __init_18(){

/* ---- plan konta, funkcje i miesięczne limity ----
   Serwer zwraca plan konta (np. Darmowy, Premium), włączone funkcje i to, czy w tej wersji obowiązują limity planu
   (cfg.enforce na serwerze — dziś USERS i Early Access). W pozostałych wersjach działa tylko wyłącznik awaryjny funkcji.
   Limity liczy serwer (tylko udane odpowiedzi AI); tutaj ostatni znany stan, żeby licznik był widoczny od razu i bez zasięgu.
   Krótkie „dzięki” / „ok” w trwającej rozmowie dostają odpowiedź bez AI. Szacowanie kalorii ma osobny limit dzienny. */
EA_SHORT = /^\s*(dzięki|dziękuję|dziekuje|dzieki|thx|thanks|thank you|ty|ok|okej|okay|super|spoko|jasne|git|cool|great|👍|💪|🙏)[\s!.]*$/i;
EA_LOCAL = COACH_UI.pl.local;   // odpowiedź w języku konta wybiera Trener (coach.ts)
PLAN = readJSON(KEYS.plan(appChannel()), null);
QUOTA = readJSON(KEYS.QUOTA, null);
document.getElementById('coachQuota').onclick=()=>{
  document.getElementById('coachClose').click();
  document.querySelector('.nav button[data-v="set"]').click(); moreOpen('plan');
};
// przed pierwszą rozmową głosową: każda wypowiedź to 1 pytanie
vqOk = false;
document.getElementById('coachMic').addEventListener('click', e=>{
  if(!planEnforced() || vqOk || vqMuted() || coachVoice.active()) return;
  e.stopImmediatePropagation(); openVoiceQuota();
}, true);
}
