// ŻELAZO — Zużycie AI i panel administratora (konta, plany, ustawienia).
// Moduł zawiera tylko deklaracje; kod startowy jest w __init_N, wywoływanych przez main.js w stałej kolejności.
import { APP_VER, verVisible } from '../core/shell';
import { CLOUD, S, applyAccountLang, cloudCall, save, saveCloud } from '../core/state';
import { planEnforced, planSet, techUi } from '../features/plan-limits';
import { setupReminders, showInAppReminder } from '../features/reminders';
import { todayISO } from '../lib/dates';
import { COACH_KEEP_ADMIN } from '../lib/merge.js';
import { esc, inviteLink, slugAccount } from './accounts';
import { moreOpen } from './more';
import { cloudToken, refreshCloudUI } from './sync-ui';
import { locale } from '../lib/i18n';

export let fmtUsd, MONTHS_PL, monthName, fmtDate, AP_FEAT, AP_LIM, AP_CH, AP_COST, AP_PLN, AP, apClone, apPlural, apZl;

export function usageTxt(u){ if(!u) return '—'; return fmtUsd(u.usd)+' w tym mies. ('+u.n+' zapyt.)'; }

export async function loadUsage(){
  const sec=document.getElementById('usageSection');
  if(!CLOUD.on||!CLOUD.url||!CLOUD.token){ sec.style.display='none'; return; }
  try{
    const u=(await cloudCall('usage',{})).usage;
    sec.style.display='block';
    document.getElementById('usageBox').innerHTML=`
      <div class="wstat">
        <div class="b"><div class="n" style="color:var(--amber)">${fmtUsd(u.usd)}</div><div class="l">${esc(monthName(u.m))}</div></div>
        <div class="b"><div class="n">${u.coach}</div><div class="l">Pytania do Trenera</div></div>
        <div class="b"><div class="n">${u.est}</div><div class="l">Szacowania kalorii</div></div>
      </div>
      <div class="md-hint" style="margin-top:10px">${u.prev?'Poprzedni miesiąc ('+esc(monthName(u.prev.m))+'): '+fmtUsd(u.prev.usd)+' · ':''}Łącznie od początku: ${fmtUsd(u.all)}.
      ${u.tin?`Tokeny w tym miesiącu: wejście ${Math.round(u.tin/1000)} tys. (z pamięci podręcznej ${Math.round(100*(u.tcr||0)/u.tin)}% — czytane za 10% ceny), wyjście ${Math.round((u.tout||0)/1000)} tys. `:''}Szacunek z liczby tokenów i cennika Claude API — dokładny rachunek jest w panelu Anthropic. ${planEnforced()?'Limity Twojego planu: Więcej → Pakiet i limity AI.':'Limit: 30 pytań do Trenera i 40 szacowań dziennie.'}</div>`;
  }catch(e){ sec.style.display='none'; }
}

// ---- panel administratora (widoczny tylko z tokenem administratora) ----
export async function checkAdmin(){
  if(!CLOUD.url||!CLOUD.token) return;
  try{ const j=await cloudCall('ping',{}); setAdmin(!!j.admin); planSet(j); applyAccountLang(j); }catch(e){ setAdmin(false); }
}

export function setAdmin(on){
  // administrator trzyma dłuższą rozmowę z Trenerem (serwer przytnie do 40 każdemu innemu kontu)
  if(on && (!S.coach || S.coach.keep!==COACH_KEEP_ADMIN)){ S.coach=S.coach||{clearedAt:0, msgs:[]}; S.coach.keep=COACH_KEEP_ADMIN; save(); }
  document.getElementById('adminSection').style.display=on?'block':'none';
  techUi(!!on);
  verVisible(on);
  // USERS: konta, plany i limity w osobnym panelu (Więcej → Konta i plany); tu zostają zaproszenia i token
  const panel=on && APP_VER==='users';
  document.getElementById('mmAdmBtn').style.display=panel?'':'none';
  document.getElementById('admOldList').style.display=panel?'none':'';
  document.getElementById('admGoPanel').style.display=panel?'':'none';
  if(on) loadAdmin();
}

export function showInviteLink(code, account, expires, title){
  const link=inviteLink(code, account);
  const box=document.getElementById('admLink');
  box.style.display='block';
  box.innerHTML=`<div style="border:1px solid var(--amber);border-radius:12px;padding:12px">
    <div style="font-size:13px;color:var(--ink);margin-bottom:6px"><b>${esc(title)}</b>${account?' · konto „'+esc(account)+'”':''} · ważny do ${esc(fmtDate(expires))}</div>
    <input class="md-in" readonly value="${esc(link)}" style="font-size:12px" onclick="this.select()">
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn" id="admCopy" style="flex:1;font-size:13px;padding:10px">Kopiuj link</button>
      ${navigator.share?'<button class="btn ghost" id="admShare" style="flex:1;font-size:13px;padding:10px">Wyślij…</button>':''}
    </div>
    <div class="md-hint">Wyślij link tylko tej osobie (SMS / Messenger). Działa jeden raz.</div></div>`;
  document.getElementById('admCopy').onclick=async()=>{ try{ await navigator.clipboard.writeText(link); document.getElementById('admCopy').textContent='Skopiowano ✓'; }catch(e){ box.querySelector('input').select(); } };
  const sh=document.getElementById('admShare');
  if(sh) sh.onclick=()=>navigator.share({title:'SixMo — zaproszenie',text:'Dołącz do mnie w SixMo (dieta + trening):',url:link}).catch(()=>{});
}

export async function adminCall(action, payload?){
  try{ return await cloudCall(action, payload||{}); }
  catch(e){ alert('Błąd: '+e.message); return null; }
}

export async function loadAdmin(){
  const j=await adminCall('adminList'); if(!j) return;
  const users=j.users.sort((a,b)=>a.account<b.account?-1:1);
  document.getElementById('admTotal').innerHTML=`Koszt AI wszystkich kont w tym miesiącu: <b style="color:var(--ink)">${fmtUsd(j.totalUsd||0)}</b> · łącznie od początku: ${fmtUsd(j.totalAllUsd||0)}`;
  const me=(CLOUD.account||'').toLowerCase();
  document.getElementById('admUsers').innerHTML=
    `<div class="settings-row" style="padding:10px 0"><div class="l"><div class="t">${esc(me||'—')} <span style="color:var(--amber);font-size:12px">administrator (Ty)</span></div><div class="s">Twój token = SECRET ze skryptu · AI: ${usageTxt(j.myUsage)}</div></div></div>`+
    (users.length?users.map(u=>u.legacy?`<div class="settings-row" style="padding:10px 0;flex-wrap:wrap;gap:8px">
      <div class="l" style="min-width:150px"><div class="t">${esc(u.account)} <span style="color:var(--amber);font-size:12px">stare konto</span></div>
        <div class="s">używa Twojego tokenu administratora · dane: ${u.kb} KB · AI: ${usageTxt(u.usage)}</div></div>
      <button class="btn" data-adm="adminReset" data-t="${esc(u.account)}" style="font-size:12px;padding:7px 10px">Wyślij własny link</button></div>`
    :`<div class="settings-row" style="padding:10px 0;flex-wrap:wrap;gap:8px">
      <div class="l" style="min-width:150px"><div class="t">${esc(u.account)} ${u.disabled?'<span style="color:var(--red);font-size:12px">zablokowane</span>':u.pending?'<span style="color:var(--ink-faint);font-size:12px">czeka na nowy link</span>':''}</div>
        <div class="s">ostatnio: ${esc(fmtDate(u.lastSeen))} · dane: ${u.kb} KB · AI: ${usageTxt(u.usage)}</div></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn ghost" data-adm="${u.disabled?'adminEnable':'adminDisable'}" data-t="${esc(u.account)}" style="font-size:12px;padding:7px 10px">${u.disabled?'Odblokuj':'Zablokuj'}</button>
        <button class="btn ghost" data-adm="adminReset" data-t="${esc(u.account)}" style="font-size:12px;padding:7px 10px">Nowy link</button>
        <button class="btn ghost" data-adm="adminDelete" data-t="${esc(u.account)}" style="font-size:12px;padding:7px 10px;color:var(--red)">Usuń</button>
      </div></div>`).join(''):'<div class="md-hint">Brak zaproszeń.</div>');
  document.getElementById('admInvites').innerHTML=j.invites.length?j.invites.map(i=>`<div class="settings-row" style="padding:8px 0">
      <div class="l"><div class="t" style="font-size:14px">${i.account?esc(i.account):'<i>dowolna nazwa</i>'}${i.reset?' · nowy token':''}</div><div class="s">ważne do ${esc(fmtDate(i.expires))}</div></div>
      <div style="display:flex;gap:6px"><button class="btn ghost" data-inv-show="${esc(i.code)}" data-a="${esc(i.account)}" data-e="${i.expires}" style="font-size:12px;padding:7px 10px">Link</button>
      <button class="btn ghost" data-inv-del="${esc(i.code)}" style="font-size:12px;padding:7px 10px">Anuluj</button></div></div>`).join('')
    :'<div class="md-hint">Brak.</div>';
  document.querySelectorAll('[data-adm]').forEach(b=>b.onclick=async()=>{
    const a=b.dataset.adm, t=b.dataset.t;
    if(a==='adminDelete' && prompt('Usunąć konto „'+t+'” razem z danymi? Plik trafi do kosza Dysku (30 dni na odzyskanie).\nWpisz nazwę konta, aby potwierdzić:')!==t) return;
    if(a==='adminReset' && !confirm('Wygenerować link dla „'+t+'”? Dostanie własny token; jego dotychczasowy token przestanie działać (dane zostają).')) return;
    const r=await adminCall(a,{target:t}); if(!r) return;
    if(a==='adminReset') showInviteLink(r.code, r.account, r.expires, 'Nowy link logowania');
    loadAdmin();
  });
  document.querySelectorAll('[data-inv-show]').forEach(b=>b.onclick=()=>showInviteLink(b.dataset.invShow, b.dataset.a, +b.dataset.e, 'Zaproszenie'));
  document.querySelectorAll('[data-inv-del]').forEach(b=>b.onclick=async()=>{ if(await adminCall('adminRevokeInvite',{code:b.dataset.invDel})){ document.getElementById('admLink').style.display='none'; loadAdmin(); } });
}

export async function apLoad(){
  const box=document.getElementById('apBox');
  if(!AP.data) box.innerHTML='<div class="md-hint">Ładowanie…</div>';
  const j=await adminCall('adminList'); if(!j){ if(!AP.data) box.innerHTML='<div class="md-hint">Nie udało się wczytać kont.</div>'; return; }
  const me=(CLOUD.account||'').toLowerCase();
  j.users=j.users.filter(u=>u.account!==me).sort((a,b)=>a.account<b.account?-1:1);
  j.users.unshift({account:me||'administrator', admin:true, lastSeen:Date.now(), usage:j.myUsage||{}});
  AP.data=j;
  if(!AP.plans || !apChanges()){ AP.plans=apClone(j.plans); AP.cfg=apClone(j.cfg); }
  apRender();
}

export function apEff(u){ return u.admin?AP.cfg.adminPlan:(u.plan||AP.cfg.defaultPlan); }

export function apUse(u){ const x=u.usage||{}; return {coach:x.coach||0, form:x.form||0, est:x.est||0, usd:x.usd||0}; }

export function apRatio(n,m){ return m?n/m:(n?1:0); }

export function apBarCls(r){ return r>=1?'full':r>=.8?'hi':''; }

export function apNear(u){ if(u.legacy) return false; const L=(AP.plans[apEff(u)]||{}).limits||{}, x=apUse(u); return ['coach','form','est'].some(k=>apRatio(x[k],L[k])>=.8); }

export function apPill(p,u){ const P=AP.plans[p]; return `<span class="ap-pill ${u&&u.admin?'adm':p==='free'?'free':p==='tester'?'tester':''}">${u&&u.admin?'Admin · ':''}${esc(P?P.name:p)}</span>`; }

export function apRender(){
  const box=document.getElementById('apBox'), d=AP.data; if(!d) return;
  const off=(d.cfg&&d.cfg.off)||[];   // pasek pokazuje stan zapisany na serwerze, nie niezapisane zmiany
  box.innerHTML=(off.length?`<div class="ap-kill" role="status"><b>Wyłączone dla wszystkich:</b> ${off.map(k=>(AP_FEAT.find(f=>f[0]===k)||[k,k])[1]).join(', ')}. Wyłącznik awaryjny działa w każdej wersji i każdym planie.</div>`:'')+
    `<div class="ap-tabs" role="tablist">${[['acc','Konta'],['plans','Plany'],['set','Ustawienia']].map(([k,l])=>`<button type="button" role="tab" data-aptab="${k}" class="${AP.tab===k?'on':''}" aria-selected="${AP.tab===k}">${l}</button>`).join('')}</div>`+
    (AP.tab==='acc'?apViewAcc():AP.tab==='plans'?apViewPlans():apViewSet())+apSaveBar();
  apBind();
}

export function apViewAcc(){
  const d=AP.data, by={};
  d.users.forEach(u=>{ if(!u.legacy){ const p=apEff(u); by[p]=(by[p]||0)+1; } });
  const near=d.users.filter(apNear).length, q=AP.q.toLowerCase();
  const list=d.users.filter(u=>(!q||u.account.includes(q)) && (AP.filter==='all'||(AP.filter==='near'?apNear(u):!u.legacy&&apEff(u)===AP.filter)));
  return `<div class="ap-sum"><div><b>${d.users.length}</b><span>${apPlural(d.users.length,'konto','konta','kont')}</span></div><div><b>${fmtUsd(d.totalUsd||0)}</b><span>AI w tym miesiącu</span></div><div><b>${near}</b><span>blisko limitu</span></div></div>
    <div class="md-hint" style="margin:0">${Object.keys(AP.plans).map(p=>`${esc(AP.plans[p].name)}: ${by[p]||0}`).join(' · ')} · bez przypisanego planu → ${esc((AP.plans[AP.cfg.defaultPlan]||{}).name||AP.cfg.defaultPlan)}</div>
    <input class="md-in" id="apQ" type="search" placeholder="Szukaj konta…" value="${esc(AP.q)}" autocomplete="off">
    <div class="ap-chips">${[['all','Wszystkie'],...Object.keys(AP.plans).map(p=>[p,AP.plans[p].name]),['near','Blisko limitu']].map(([k,l])=>`<button type="button" data-apf="${esc(k)}" class="${AP.filter===k?'on':''}">${esc(l)}</button>`).join('')}</div>
    <div class="ap-list">${list.length?list.map(u=>{
      const x=apUse(u);
      if(u.legacy) return `<button class="ap-acc" type="button" data-apacc="${esc(u.account)}"><span class="nm"><span>${esc(u.account)}</span><span class="ap-pill adm">stare konto</span></span><span class="md-hint" style="margin:0">${fmtUsd(x.usd)}</span><span class="meta">używa tokenu administratora · wyślij własny link</span></button>`;
      const p=apEff(u), L=(AP.plans[p]||{}).limits||{}, r=apRatio(x.coach,L.coach);
      return `<button class="ap-acc" type="button" data-apacc="${esc(u.account)}"><span class="nm"><span>${esc(u.account)}</span>${apPill(p,u)}${u.admin?'':apLang(u)}${!u.admin&&!u.plan?'<span class="md-hint" style="margin:0">domyślny</span>':''}${u.disabled?'<span class="ap-pill off">zablokowane</span>':''}</span><span class="md-hint" style="margin:0">${fmtUsd(x.usd)}</span>
        <span class="ap-bar"><span class="${apBarCls(r)}" style="width:${Math.min(100,r*100)}%"></span></span>
        <span class="meta"><span class="${r>=1?'ap-bad':r>=.8?'ap-warn':''}">Trener ${x.coach}/${L.coach}</span><span>Oceny ${x.form}/${L.form}</span><span>Szacowania ${x.est}/${L.est}</span><span>· ${u.admin?'Ty':esc(fmtDate(u.lastSeen))}</span></span></button>`; }).join(''):'<div class="ap-note">Brak kont dla tego filtra.</div>'}</div>`;
}

export function apWorst(p){ const L=AP.plans[p].limits; return (L.coach*AP_COST.coach + L.form*AP_COST.form + L.est*AP_COST.est)*AP_PLN; }

export function apViewPlans(){
  const saved=AP.data.plans;
  return Object.keys(AP.plans).map(p=>{
    const P=AP.plans[p], O=saved[p], users=AP.data.users.filter(u=>!u.legacy&&apEff(u)===p), n=users.length;
    const over=users.filter(u=>{ const x=apUse(u); return ['coach','form','est'].some(k=>x[k]>P.limits[k]); });
    return `<div class="ap-card">
      <div class="ap-card-h"><input aria-label="Nazwa planu ${esc(p)}" data-apname="${esc(p)}" value="${esc(P.name)}" maxlength="30"><span class="md-hint" style="margin:0;white-space:nowrap">${n} ${apPlural(n,'konto','konta','kont')}</span></div>
      <div class="ap-sec">Limity</div>
      ${AP_LIM.map(([k,l,per])=>`<div class="ap-row"><label for="apl-${esc(p)}-${k}">${l} <span class="md-hint" style="margin:0;display:inline">/ ${per}</span></label><div class="ap-step"><button type="button" data-apd="-1" data-apl="${esc(p)}.${k}" aria-label="Mniej">−</button><input id="apl-${esc(p)}-${k}" inputmode="numeric" data-aplim="${esc(p)}.${k}" value="${P.limits[k]}" class="${!O||O.limits[k]!==P.limits[k]?'chg':''}"><button type="button" data-apd="1" data-apl="${esc(p)}.${k}" aria-label="Więcej">+</button></div></div>`).join('')}
      <div class="ap-note">Najgorszy przypadek (wszystkie limity wykorzystane): <b>≈ ${apZl(apWorst(p))}</b> kosztu AI na konto miesięcznie.</div>
      ${over.length?`<div class="ap-note w">${over.map(u=>esc(u.account)).join(', ')} ${over.length===1?'ma':'mają'} już w tym miesiącu więcej, niż pozwala ten limit — do 1. dnia następnego miesiąca nie wykorzystają tej funkcji.</div>`:''}
      <div class="ap-sec">Funkcje</div>
      ${AP_FEAT.map(([k,l])=>`<div class="ap-row"><label for="apf-${esc(p)}-${k}">${l}${(AP.cfg.off||[]).includes(k)?' <span class="ap-bad" style="font-size:12px">· wyłączone dla wszystkich</span>':''}</label><span class="ap-sw"><input type="checkbox" id="apf-${esc(p)}-${k}" data-apfeat="${esc(p)}.${k}" ${P.features[k]!==false?'checked':''}><i></i></span></div>`).join('')}
      ${!O?`<button class="btn ghost" type="button" data-apdel="${esc(p)}" style="color:var(--red)">Usuń ten nowy plan</button>`:''}
    </div>`; }).join('')+
    (Object.keys(AP.plans).length<10?`<button class="btn ghost" type="button" id="apAddPlan">＋ Nowy plan (kopia Premium)</button>`:'')+
    `<div class="ap-note">Limity i funkcje planu działają w wersjach zaznaczonych w Ustawieniach (dziś: ${AP.cfg.enforce.map(c=>(AP_CH.find(x=>x[0]===c)||[c,c])[1]).join(', ')||'żadnej'}).</div>`;
}

export function apViewSet(){
  const segP=(id,val)=>`<div class="ap-seg" id="${id}">${Object.keys(AP.plans).map(k=>`<button type="button" data-app="${esc(k)}" class="${val===k?'on':''}">${esc(AP.plans[k].name)}</button>`).join('')}</div>`;
  return `<div class="ap-card"><div class="ap-sec">Plan dla kont bez przypisanego planu</div>${segP('apDef',AP.cfg.defaultPlan)}
      <div class="md-hint" style="margin:0">Dotyczy nowych osób z zaproszenia i kont oznaczonych „domyślny”.</div></div>
    <div class="ap-card"><div class="ap-sec">Twój plan (administrator)</div>${segP('apAdm',AP.cfg.adminPlan)}
      <div class="md-hint" style="margin:0">Przełącz na Darmowy, żeby zobaczyć aplikację oczami osoby bez subskrypcji.</div></div>
    <div class="ap-card"><div class="ap-sec">Limity planów obowiązują w wersjach</div>
      ${AP_CH.map(([k,l,d])=>`<label class="ap-chk"><input type="checkbox" data-apch="${k}" ${AP.cfg.enforce.includes(k)?'checked':''}><span><b>${l}</b><br><span class="md-hint" style="margin:0">${d}</span></span></label>`).join('')}
      ${AP.stable?`<div class="ap-confirm"><span><b>Włączyć plany w wersji stabilnej?</b> Po zapisaniu każde konto dostanie limity swojego planu — to start subskrypcji dla wszystkich.</span><div class="r"><button class="btn" type="button" id="apStYes" style="background:var(--red)">Włącz</button><button class="btn ghost" type="button" id="apStNo">Anuluj</button></div></div>`:''}
      <div class="md-hint" style="margin:0">W wersjach bez zaznaczenia działają stare limity dzienne i tylko wyłącznik awaryjny.</div></div>
    <div class="ap-card"><div class="ap-sec">Wyłącznik awaryjny</div>
      <div class="md-hint" style="margin:0">Po zapisaniu wyłącza funkcję we wszystkich wersjach i planach — gdy coś się psuje albo koszty rosną.</div>
      ${AP_FEAT.filter(f=>f[0]!=='early').map(([k,l])=>`<div class="ap-row"><label for="apk-${k}">${l}</label><span class="ap-sw"><input type="checkbox" id="apk-${k}" data-apkill="${k}" ${(AP.cfg.off||[]).includes(k)?'':'checked'}><i></i></span></div>
        ${AP.kill===k?`<div class="ap-confirm"><span><b>Wyłączyć: ${l.toLowerCase()}?</b> Wszyscy zobaczą, że funkcja jest teraz niedostępna.</span><div class="r"><button class="btn" type="button" data-apkillyes="${k}" style="background:var(--red)">Wyłącz</button><button class="btn ghost" type="button" data-apkillno>Anuluj</button></div></div>`:''}`).join('')}
    </div>`;
}

export function apChanges(){
  if(!AP.data || !AP.plans) return 0;
  const A=AP.data.plans, B=AP.plans, a=AP.data.cfg, b=AP.cfg; let n=0;
  Object.keys(B).forEach(p=>{ const O=A[p], P=B[p]; if(!O){ n++; return; }
    if(O.name!==P.name) n++; AP_LIM.forEach(([k])=>{ if(O.limits[k]!==P.limits[k]) n++; }); AP_FEAT.forEach(([k])=>{ if((O.features[k]!==false)!==(P.features[k]!==false)) n++; }); });
  Object.keys(A).forEach(p=>{ if(!B[p]) n++; });
  ['defaultPlan','adminPlan'].forEach(k=>{ if(a[k]!==b[k]) n++; });
  if(a.enforce.slice().sort().join()!==b.enforce.slice().sort().join()) n++;
  if((a.off||[]).slice().sort().join()!==(b.off||[]).slice().sort().join()) n++;
  return n;
}

export function apSaveBar(){ const n=apChanges(); return n?`<div class="ap-save"><span>${n} ${apPlural(n,'zmiana','zmiany','zmian')} w planach i ustawieniach</span><button class="btn ghost" type="button" id="apDiscard">Odrzuć</button><button class="btn" type="button" id="apSaveBtn">Zapisz</button></div>`:''; }

export function apSetLim(path,v){ const i=path.lastIndexOf('.'), p=path.slice(0,i), k=path.slice(i+1); AP.plans[p].limits[k]=Math.max(0,Math.min(100000,Math.round(+v||0))); }

export function apBind(){
  const box=document.getElementById('apBox'), on=(sel,ev,fn)=>box.querySelectorAll(sel).forEach(el=>el[ev]=()=>fn(el));
  on('[data-aptab]','onclick',b=>{ AP.tab=b.dataset.aptab; AP.kill=null; AP.stable=false; apRender(); });
  const qi=document.getElementById('apQ'); if(qi) qi.oninput=e=>{ AP.q=e.target.value; const pos=e.target.selectionStart; apRender(); const n=document.getElementById('apQ'); n.focus(); n.setSelectionRange(pos,pos); };
  on('[data-apf]','onclick',b=>{ AP.filter=b.dataset.apf; apRender(); });
  on('[data-apacc]','onclick',b=>apOpenAcc(b.dataset.apacc));
  on('[data-apname]','onchange',i=>{ AP.plans[i.dataset.apname].name=i.value.trim().slice(0,30)||i.dataset.apname; apRender(); });
  on('[data-apd]','onclick',b=>{ const path=b.dataset.apl, i=path.lastIndexOf('.'), cur=AP.plans[path.slice(0,i)].limits[path.slice(i+1)], st=cur>=100?10:cur>=20?5:1; apSetLim(path, cur+(+b.dataset.apd)*st); apRender(); });
  on('[data-aplim]','onchange',i=>{ apSetLim(i.dataset.aplim,i.value); apRender(); });
  on('[data-apfeat]','onchange',i=>{ const path=i.dataset.apfeat, k=path.lastIndexOf('.'); AP.plans[path.slice(0,k)].features[path.slice(k+1)]=i.checked; apRender(); });
  on('[data-apdel]','onclick',b=>{ delete AP.plans[b.dataset.apdel]; apRender(); });
  const add=document.getElementById('apAddPlan'); if(add) add.onclick=()=>{ let i=1; while(AP.plans['plan'+i]) i++; const base=AP.plans.premium||AP.plans[Object.keys(AP.plans)[0]]; AP.plans['plan'+i]=Object.assign(apClone(base),{name:'Nowy plan '+i}); apRender(); };
  on('#apDef [data-app]','onclick',b=>{ AP.cfg.defaultPlan=b.dataset.app; apRender(); });
  on('#apAdm [data-app]','onclick',b=>{ AP.cfg.adminPlan=b.dataset.app; apRender(); });
  on('[data-apch]','onchange',i=>{ const k=i.dataset.apch;
    if(k==='stable' && i.checked){ i.checked=false; AP.stable=true; apRender(); return; }
    AP.cfg.enforce=i.checked?[...AP.cfg.enforce,k]:AP.cfg.enforce.filter(x=>x!==k); apRender(); });
  const sy=document.getElementById('apStYes'); if(sy){ sy.onclick=()=>{ AP.cfg.enforce=[...AP.cfg.enforce,'stable']; AP.stable=false; apRender(); }; document.getElementById('apStNo').onclick=()=>{ AP.stable=false; apRender(); }; }
  on('[data-apkill]','onchange',i=>{ const k=i.dataset.apkill;
    if(!i.checked){ i.checked=true; AP.kill=k; apRender(); return; }
    AP.cfg.off=(AP.cfg.off||[]).filter(x=>x!==k); apRender(); });
  on('[data-apkillyes]','onclick',b=>{ AP.cfg.off=[...(AP.cfg.off||[]),b.dataset.apkillyes]; AP.kill=null; apRender(); });
  on('[data-apkillno]','onclick',()=>{ AP.kill=null; apRender(); });
  const dis=document.getElementById('apDiscard'); if(dis) dis.onclick=()=>{ AP.plans=apClone(AP.data.plans); AP.cfg=apClone(AP.data.cfg); AP.kill=null; AP.stable=false; apRender(); };
  const sv=document.getElementById('apSaveBtn'); if(sv) sv.onclick=async()=>{
    sv.disabled=true; sv.textContent='Zapisuję…';
    const r=await adminCall('adminSavePlans',{plans:AP.plans, cfg:AP.cfg});
    if(r){ AP.data.plans=apClone(r.plans); AP.data.cfg=apClone(r.cfg); AP.plans=apClone(r.plans); AP.cfg=apClone(r.cfg); apRender();
      showInAppReminder('Zapisano', 'Plany i ustawienia działają od następnego zapytania każdej osoby.'); checkAdmin(); }
    else apRender();
  };
}

export function apOpenAcc(name){
  const u=AP.data.users.find(x=>x.account===name); if(!u) return;
  const x=apUse(u), pn=document.getElementById('apPanel');
  const m=(l,n,max)=>`<div class="ap-m"><div class="t"><span>${l}</span><b>${n} / ${max}</b></div><div class="ap-bar"><span class="${apBarCls(apRatio(n,max))}" style="width:${Math.min(100,apRatio(n,max)*100)}%"></span></div></div>`;
  const head=`<div class="eh-grab"></div><div class="eh-head"><div style="flex:1;min-width:0"><div class="eyebrow">Konto · ${u.admin?'Ty':'ostatnio '+esc(fmtDate(u.lastSeen))}</div><h2 id="apTitle">${esc(u.account)}</h2></div><button class="eh-x" data-apclose aria-label="Zamknij">✕</button></div>`;
  if(u.legacy){
    pn.innerHTML=head+`<div class="ap-note">Stare konto: używa Twojego tokenu administratora i nie ma planu. Wyślij mu własny link — dostanie własny token i plan domyślny.</div>
      <div class="ap-note">Koszt AI w tym miesiącu: <b>${fmtUsd(x.usd)}</b></div>
      <button class="btn" type="button" data-apact="adminReset">Wyślij własny link</button>`;
  }else{
    const p=apEff(u), L=(AP.plans[p]||{}).limits||{};
    pn.innerHTML=head+(u.admin?`<div class="ap-note">To Twoje konto administratora — jego plan ustawiasz w zakładce Ustawienia.</div>`:`
      <div class="ap-sec">Plan</div>
      <div class="ap-seg" id="apAccPlan">${['',...Object.keys(AP.data.plans)].map(k=>`<button type="button" data-app="${esc(k)}" class="${(u.plan||'')===k?'on':''}">${k?esc(AP.data.plans[k].name):'Domyślny ('+esc((AP.data.plans[AP.data.cfg.defaultPlan]||{}).name||'')+')'}</button>`).join('')}</div>
      <div class="md-hint" style="margin:0">Zmiana działa od następnego zapytania tej osoby. Zużycie w tym miesiącu zostaje i liczy się do nowych limitów.</div>
      <div class="ap-sec">Język · Language</div>
      <div class="ap-seg" id="apAccLang">${[['pl','🇵🇱 Polski'],['en','🇬🇧 English']].map(([k,l])=>`<button type="button" data-aplang="${k}" class="${(u.lang||'pl')===k?'on':''}">${l}</button>`).join('')}</div>
      <div class="md-hint" style="margin:0">${u.langPending?'Czeka na urządzenie — aplikacja tej osoby przełączy się przy najbliższym połączeniu. ':''}Trener i AI odpowiadają w tym języku od razu; reszta aplikacji jest na razie po polsku. Osoba może go potem zmienić sama w Profilu.</div>`)+
      `<div class="ap-sec">${esc(monthName((u.usage||{}).m||todayISO().slice(0,7)))}</div>
      ${m('Pytania do Trenera',x.coach,L.coach)}${m('Oceny techniki',x.form,L.form)}${m('Szacowania kalorii',x.est,L.est)}
      <div class="ap-note">Koszt AI w tym miesiącu: <b>${fmtUsd(x.usd)}</b> (≈ ${apZl(x.usd*AP_PLN)})</div>`+
      (u.admin?'':`<div class="ap-row" style="gap:8px;flex-wrap:wrap">
        <button class="btn ghost" type="button" style="flex:1" data-apact="adminReset">Nowy link</button>
        <button class="btn ghost" type="button" style="flex:1" data-apact="${u.disabled?'adminEnable':'adminDisable'}">${u.disabled?'Odblokuj':'Zablokuj'}</button>
        <button class="btn ghost" type="button" style="flex:1;color:var(--red)" data-apact="adminDelete">Usuń</button></div>`);
  }
  document.getElementById('apSheet').style.display='flex';
  pn.querySelectorAll('[data-apclose]').forEach(b=>b.onclick=apCloseSheet);
  pn.querySelectorAll('#apAccPlan [data-app]').forEach(b=>b.onclick=async()=>{
    const r=await adminCall('adminSetPlan',{target:u.account, plan:b.dataset.app}); if(!r) return;
    u.plan=r.plan||''; apRender(); apOpenAcc(name);
  });
  pn.querySelectorAll('#apAccLang [data-aplang]').forEach(b=>b.onclick=async()=>{
    if((u.lang||'pl')===b.dataset.aplang && !u.langPending) return;
    const r=await adminCall('adminSetLang',{target:u.account, lang:b.dataset.aplang}); if(!r) return;
    u.lang=r.lang; u.langPending=r.langPending; apRender(); apOpenAcc(name);
  });
  pn.querySelectorAll('[data-apact]').forEach(b=>b.onclick=async()=>{
    const a=b.dataset.apact, t=u.account;
    if(a==='adminDelete' && prompt('Usunąć konto „'+t+'” razem z danymi? Plik trafi do kosza Dysku (30 dni na odzyskanie).\nWpisz nazwę konta, aby potwierdzić:')!==t) return;
    if(a==='adminReset' && !confirm('Wygenerować link dla „'+t+'”? Dostanie własny token; jego dotychczasowy token przestanie działać (dane zostają).')) return;
    const r=await adminCall(a,{target:t}); if(!r) return;
    apCloseSheet();
    if(a==='adminReset'){ document.querySelector('.nav button[data-v="set"]').click(); moreOpen('sync'); showInviteLink(r.code, r.account, r.expires, 'Nowy link logowania'); setTimeout(()=>document.getElementById('admLink').scrollIntoView({block:'center'}),300); }
    AP.data=null; apLoad(); loadAdmin();
  });
}

// znaczek języka przy koncie na liście (szczegóły i zmiana w arkuszu konta)
export function apLang(u){ const en=u.lang==='en';
  return `<span class="ap-lang${en?' en':''}${u.langPending?' wait':''}" title="${en?'English':'Polski'}${u.langPending?' · czeka na urządzenie':''}">${en?'EN':'PL'}${u.langPending?'…':''}</span>`; }

export function apCloseSheet(){ document.getElementById('apSheet').style.display='none'; }

export function __init_19(){

// ---- zużycie AI (koszt Trenera i szacowania kalorii, liczony na serwerze z tokenów × cennik) ----
fmtUsd = v=>{ v=+v||0; return '$'+(v>0&&v<0.01?v.toFixed(3):v.toFixed(2)); };
MONTHS_PL = ['styczeń','luty','marzec','kwiecień','maj','czerwiec','lipiec','sierpień','wrzesień','październik','listopad','grudzień'];
monthName = m=>m?MONTHS_PL[+m.slice(5,7)-1]+' '+m.slice(0,4):'';
fmtDate = t=>t?new Date(t).toLocaleDateString(locale(),{day:'2-digit',month:'2-digit'})+' '+new Date(t).toLocaleTimeString(locale(),{hour:'2-digit',minute:'2-digit'}):'—';
/* ---- panel administratora (USERS): konta z planami, plany (limity i funkcje), ustawienia ----
   Dane z adminList (konta, zużycie, plany, cfg). Plan konta zapisuje się od razu (adminSetPlan);
   plany i ustawienia zbierają zmiany i idą razem przez „Zapisz” (adminSavePlans, serwer je sprawdza). */
AP_FEAT = [['coach','Trener (czat)'],['voice','Rozmowa głosowa'],['form','Ocena techniki z nagrania'],['estimate','Szacowanie kalorii'],['photo','Szacowanie ze zdjęcia'],['scanner','Skaner kodów'],['early','Early Access']];
AP_LIM = [['coach','Pytania do Trenera','mies.'],['form','Oceny techniki','mies.'],['est','Szacowania kalorii','mies.'],['estDay','Szacowania kalorii','dziennie']];
AP_CH = [['stable','Stabilna','/ — wszyscy'],['beta','Beta','/beta/ — testerzy'],['early','Early Access','/early/ — Premium'],['users','USERS','/users/ — wersja robocza']];
// koszt jednej odpowiedzi AI (rachunek z października): Trener ~0,07 $, ocena techniki ~0,09 $, szacowanie ~0,0015 $; 1 $ ≈ 4 zł
AP_COST = {coach:.07, form:.09, est:.0015};
AP_PLN = 4;
AP = {tab:'acc', filter:'all', q:'', kill:null, stable:false, data:null, plans:null, cfg:null};
apClone = o=>JSON.parse(JSON.stringify(o));
apPlural = (n,a,b,c)=>n===1?a:(n%10>=2&&n%10<=4&&(n%100<10||n%100>=20))?b:c;
apZl = v=>(Math.round(v*10)/10).toString().replace('.',',')+' zł';
document.querySelector('#apSheet .bd').onclick=apCloseSheet;
document.getElementById('admGoPanel').onclick=()=>moreOpen('adm');

document.getElementById('admInviteBtn').onclick=async()=>{
  const el=document.getElementById('admName'); const name=slugAccount(el.value); el.value=name;
  const r=await adminCall('adminInvite',{name}); if(!r) return;
  el.value=''; showInviteLink(r.code, r.account, r.expires, 'Zaproszenie gotowe'); loadAdmin();
};
document.getElementById('admRefresh').onclick=loadAdmin;
document.getElementById('admRotate').onclick=async()=>{
  if(!confirm('Wygenerować nowy token administratora?\n\nStary przestanie działać od razu — także dla każdego, kto go znał. To urządzenie przełączy się samo; na pozostałych swoich urządzeniach wkleisz nowy token.')) return;
  const r=await adminCall('adminRotateSecret'); if(!r) return;
  CLOUD.token=r.token; saveCloud(); cloudToken.value=r.token; refreshCloudUI();
  const box=document.getElementById('admRotateOut'); box.style.display='block';
  box.innerHTML=`<div style="border:1px solid var(--amber);border-radius:12px;padding:12px">
    <div style="font-size:13px;margin-bottom:6px"><b>Nowy token administratora</b> — to urządzenie już go używa. Skopiuj na swoje pozostałe urządzenia (Więcej → Synchronizacja → Token) i zapisz w menedżerze haseł. Nie wysyłaj go nikomu.</div>
    <input class="md-in" readonly value="${esc(r.token)}" style="font-size:12px" onclick="this.select()">
    <button class="btn" id="admRotCopy" style="width:100%;margin-top:8px;font-size:13px;padding:10px">Kopiuj token</button></div>`;
  document.getElementById('admRotCopy').onclick=async()=>{ try{ await navigator.clipboard.writeText(r.token); document.getElementById('admRotCopy').textContent='Skopiowano ✓'; }catch(e){ box.querySelector('input').select(); } };
};

// reminders UI
if(!S.reminders.close) S.reminders.close='21:00';
['workout','close','water','weight'].forEach(k=>{
  const el=document.getElementById('rm'+k.charAt(0).toUpperCase()+k.slice(1));
  el.value=S.reminders[k];
  el.onchange=()=>{S.reminders[k]=el.value;S._settingsM=Date.now();save();setupReminders()};
});
}
