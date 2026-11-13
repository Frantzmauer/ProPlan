// ŻELAZO — Skaner kodów kreskowych (Open Food Facts).
// Moduł zawiera tylko deklaracje; kod startowy jest w __init_N, wywoływanych przez main.js w stałej kolejności.
import { CLOUD, hasCred, cloudCall, vendorUrl } from '../core/state';
import { esc } from '../screens/accounts';
import { closeGuide, closeMealDialog } from '../screens/guide';
import { saveMealDialog } from '../ui/dictation';
import { bindOffer, limitOffer, quotaCur, quotaLeft, quotaReset, quotaSet } from './plan-limits';
import { isEn, t } from '../lib/i18n';

export let ZXING_URL, BC, bcNum;

export function bcCache(){ try{ return JSON.parse(localStorage.getItem('zelazo_bc')||'{}'); }catch(e){ return {}; } }

export function bcRemember(p){
  const c=bcCache(); c[p.code]=Object.assign({}, p, {t:Date.now()});
  Object.keys(c).sort((a,b)=>c[b].t-c[a].t).slice(40).forEach(k=>delete c[k]);
  try{ localStorage.setItem('zelazo_bc', JSON.stringify(c)); }catch(e){}
}

export function bcView(title, html){
  const pn=document.getElementById('bcPanel');
  pn.innerHTML=`<div class="eh-grab"></div>
    <div class="eh-head"><div style="flex:1;min-width:0"><div class="eyebrow">Kod kreskowy · Open Food Facts</div><h2 id="bcTitle">${title}</h2></div><button class="eh-x" data-bcclose aria-label="Zamknij">✕</button></div>`+html;
  pn.querySelectorAll('[data-bcclose]').forEach(b=>b.onclick=bcClose);
}

export function openScanner(){
  BC.busy=false;
  const recent=Object.values(bcCache()).sort((a,b)=>b.t-a.t).slice(0,5);
  bcView(t('Skanuj kod'), `<div class="bc-cam"><video id="bcVideo" playsinline muted autoplay></video><div class="bc-frame"></div></div>
    <div class="bc-st" id="bcSt">${t('Włączam aparat…')}</div>
    <div class="bc-man"><input class="md-in" id="bcCode" inputmode="numeric" autocomplete="off" placeholder="${t('albo wpisz cyfry spod kodu')}"><button class="btn" id="bcGo" type="button">${t('Szukaj')}</button></div>
    ${recent.length?`<div class="eyebrow" style="margin-bottom:-4px">${t('Ostatnio skanowane')}</div><div class="bc-recent">${recent.map(p=>`<button type="button" data-bcpick="${esc(p.code)}"><span>${esc(p.name)}</span><small>${Math.round(p.kcal)} kcal / 100 ${p.liquid?'ml':'g'}</small></button>`).join('')}</div>`:''}
    <div class="md-hint" style="margin:0">${t('Do bazy wysyłamy tylko numer kodu. Skanowanie nie używa AI i nie ma limitu.')}</div>`);
  document.getElementById('bcSheet').style.display='flex';
  document.getElementById('bcGo').onclick=()=>bcFound(document.getElementById('bcCode').value);
  document.getElementById('bcCode').addEventListener('keydown',e=>{ if(e.key==='Enter') bcFound(e.target.value); });
  document.querySelectorAll('[data-bcpick]').forEach(b=>b.onclick=()=>{ bcStop(); bcShow(bcCache()[b.dataset.bcpick]); });
  bcStart();
}

export function bcLoadZxing(){
  if(window.ZXing) return Promise.resolve();
  return new Promise((ok,no)=>{ const sc=document.createElement('script'); sc.src=ZXING_URL; sc.onload=ok; sc.onerror=()=>no(new Error('zxing')); document.head.appendChild(sc); });
}

export async function bcStart(){
  const v=document.getElementById('bcVideo'), st=document.getElementById('bcSt');
  const say=t=>{ if(st && document.body.contains(st)) st.textContent=t; };
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ say(t('Ta przeglądarka nie daje dostępu do aparatu — wpisz cyfry spod kodu.')); return; }
  try{
    let fmts=[];
    if('BarcodeDetector' in window){ try{ fmts=await BarcodeDetector.getSupportedFormats(); }catch(e){} }
    if(fmts.includes('ean_13')){
      BC.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}, audio:false});
      if(!document.body.contains(v)){ bcStop(); return; }
      v.srcObject=BC.stream; await v.play();
      const det=new BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e'].filter(f=>fmts.includes(f))});
      say(t('Nakieruj aparat na kod kreskowy.'));
      const tick=async()=>{
        if(!BC.stream) return;
        try{ const r=await det.detect(v); if(r.length){ bcFound(r[0].rawValue); return; } }catch(e){}
        BC.timer=setTimeout(tick, 180);
      };
      tick();
    }else{
      say(t('Wczytuję skaner…'));
      await bcLoadZxing();
      if(!document.body.contains(v)) return;
      const hints=new Map();
      hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8, ZXing.BarcodeFormat.UPC_A, ZXing.BarcodeFormat.UPC_E]);
      BC.zx=new ZXing.BrowserMultiFormatReader(hints);
      say(t('Nakieruj aparat na kod kreskowy.'));
      await BC.zx.decodeFromConstraints({video:{facingMode:'environment'}, audio:false}, v, res=>{ if(res && BC.zx) bcFound(res.getText()); });
    }
  }catch(e){
    const cam=document.querySelector('.bc-cam'); if(cam) cam.style.display='none';   // bez aparatu zostaje wpisanie cyfr
    say(t(e.message==='zxing' ? 'Skaner potrzebuje internetu przy pierwszym użyciu. Możesz wpisać cyfry spod kodu.'
      : /NotAllowed|Permission|Security/i.test((e.name||'')+(e.message||'')) ? 'Brak zgody na aparat — zezwól na niego w ustawieniach przeglądarki albo wpisz cyfry spod kodu.'
      : 'Nie udało się włączyć aparatu — wpisz cyfry spod kodu.'));
  }
}

export function bcStop(){
  clearTimeout(BC.timer); BC.timer=null;
  if(BC.zx){ try{ BC.zx.reset(); }catch(e){} BC.zx=null; }
  if(BC.stream){ BC.stream.getTracks().forEach(t=>t.stop()); BC.stream=null; }
}

export function bcClose(){ bcStop(); const sh=document.getElementById('bcSheet'); if(sh) sh.style.display='none'; }

export async function bcFound(raw){
  const code=String(raw||'').replace(/\D/g,'');
  if(code.length<8 || BC.busy) return;
  BC.busy=true; bcStop();
  if(navigator.vibrate) navigator.vibrate(60);
  const hit=bcCache()[code];
  if(hit){ bcShow(hit); return; }
  bcView(t('Szukam…'), `<div class="bc-st">${t('Szukam produktu o kodzie {c}…', {c:code})}</div>`);
  if(!navigator.onLine){ bcMiss(code, t('Brak internetu, a tego produktu nie ma jeszcze na telefonie. Spróbuj, gdy wróci zasięg, albo wpisz kalorie z etykiety.')); return; }
  try{
    const ctl=new AbortController(), to=setTimeout(()=>ctl.abort(), 9000);
    const r=await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_pl,product_name_en,brands,nutriments,serving_quantity,quantity`, {signal:ctl.signal});
    clearTimeout(to);
    const j=await r.json(), p=j.product, n=(p&&p.nutriments)||{};
    let kcal=n['energy-kcal_100g'];
    if(kcal==null && n.energy_100g!=null) kcal=n.energy_100g/4.184;   // tylko kJ na etykiecie
    if(j.status!==1 || !p){ bcMiss(code, t('Nie ma tego produktu w bazie Open Food Facts.')); return; }
    if(kcal==null){ bcMiss(code, t('Produkt jest w bazie, ale bez wartości odżywczych.')); return; }
    const prod={code, name:String((isEn()?p.product_name_en:p.product_name_pl)||p.product_name||t('Produkt')+' '+code).trim(), brand:String(p.brands||'').split(',')[0].trim(),
      kcal:+kcal, p:+(n.proteins_100g||0), c:+(n.carbohydrates_100g||0), f:+(n.fat_100g||0),
      serv:+p.serving_quantity||0, liquid:/\d\s*(ml|cl|l)\b/i.test(p.quantity||'')};
    bcRemember(prod); bcShow(prod);
  }catch(e){ bcMiss(code, t('Nie udało się połączyć z bazą produktów. Spróbuj ponownie.')); }
}

export function bcMiss(code, msg){
  bcView(t('Nie znaleziono'), `<div class="bc-st">${esc(msg)}</div><div class="bc-st" style="font-size:13px">${t('Kod:')} ${esc(code)}</div>
    <button class="btn" id="bcDescribe" type="button">${t('Opisz posiłek słowami')}</button>
    <button class="btn ghost" id="bcAgain" type="button">${t('Skanuj ponownie')}</button>`);
  document.getElementById('bcDescribe').onclick=()=>{ bcClose(); document.getElementById('mdTxt').focus(); };
  document.getElementById('bcAgain').onclick=openScanner;
}

export function bcShow(p){
  const u=p.liquid?'ml':'g', serv=p.serv>0?Math.round(p.serv):0, g0=serv||100;
  const chips=[...new Set([serv,50,100,150,200].filter(x=>x>0))].slice(0,4);
  bcView(t('Produkt'), `<div class="bc-prod"><b>${esc(p.name)}</b>${p.brand && p.brand.toLowerCase()!==p.name.toLowerCase()?`<small>${esc(p.brand)}</small>`:''}
      <div class="bc-100">${t('Na 100 {u}:', {u})} <b>${Math.round(p.kcal)} kcal</b> · ${t('B {p} / W {c} / T {f}', {p:bcNum(p.p), c:bcNum(p.c), f:bcNum(p.f)})} g</div></div>
    <div><label class="md-lab" for="bcG" style="margin-top:0">${t('Porcja ({u})', {u})}</label>
      <input type="number" class="md-in" id="bcG" inputmode="decimal" min="1" value="${g0}">
      <div class="bc-chips">${chips.map(x=>`<button type="button" data-bcg="${x}">${x} ${u}${x===serv?t(' · porcja'):''}</button>`).join('')}</div></div>
    <div class="bc-sum" id="bcSum"></div>
    <button class="btn" id="bcUse" type="button">${t('Wstaw do posiłku')}</button>
    <button class="btn ghost" id="bcAgain" type="button">${t('Skanuj inny produkt')}</button>
    <div class="md-hint" style="margin:0">${t('Dane z Open Food Facts, wpisywane przez użytkowników — gdy coś nie pasuje do etykiety, popraw liczby w posiłku.')}</div>`);
  const inp=document.getElementById('bcG');
  const qty=()=>Math.max(0, parseFloat(String(inp.value).replace(',','.'))||0);
  const part=g=>({kcal:Math.round(p.kcal*g/100), p:Math.round(p.p*g/100), c:Math.round(p.c*g/100), f:Math.round(p.f*g/100)});
  const upd=()=>{ const x=part(qty()); document.getElementById('bcSum').innerHTML=`<b>${x.kcal} kcal</b> · ${t('B {p} / W {c} / T {f}', {p:x.p, c:x.c, f:x.f})} g`; document.getElementById('bcUse').disabled=!qty(); };
  inp.addEventListener('input', upd);
  document.querySelectorAll('[data-bcg]').forEach(b=>b.onclick=()=>{ inp.value=b.dataset.bcg; upd(); });
  document.getElementById('bcAgain').onclick=openScanner;
  document.getElementById('bcUse').onclick=()=>{
    const g=qty(); if(!g) return;
    const x=part(g), add=(id,v)=>{ const el=document.getElementById(id); el.value=(parseInt(el.value)||0)+v; };
    const tx=document.getElementById('mdTxt'), item=`${p.name} ${bcNum(g)} ${u}`;
    tx.value=tx.value.trim() ? tx.value.trim()+' + '+item : item;
    add('mdKcal', x.kcal); add('mdP', x.p); add('mdC', x.c); add('mdF', x.f);
    const msg=document.getElementById('mdEstMsg');
    msg.style.display='block'; msg.style.color='var(--steel)'; msg.textContent=t('Dodano z kodu: {x} · {n} kcal. Zeskanuj kolejny produkt, żeby dodać go do tego posiłku.', {x:item, n:x.kcal});
    bcClose();
  };
  upd();
}

export function __init_14(){

// meal dialog buttons
/* ---- skaner kodów kreskowych ----
   Kod z opakowania → Open Food Facts (otwarta baza produktów; bez AI, więc bez limitów) → kcal i makro na 100 g × porcja.
   Aparat: BarcodeDetector (Android/Chrome); bez niego biblioteka ZXing z CDN, wczytywana dopiero przy pierwszym skanie.
   Znalezione produkty zostają na telefonie (zelazo_bc), więc drugi raz działają też bez internetu.
   „Wstaw” dodaje produkt do pól posiłku — kilka skanów składa się w jeden posiłek. */
/* global ZXing */   // biblioteka skanera wczytywana z CDN dopiero przy pierwszym skanie
ZXING_URL = vendorUrl('zxing/index.min.js');   // @zxing/library 0.21.3 (MIT) w paczce aplikacji
BC = {stream:null, timer:null, zx:null, busy:false};
bcNum = x=>String(Math.round(x*10)/10).replace('.',',');
document.getElementById('mdScan').onclick=openScanner;

document.getElementById('mdCancel').onclick=closeMealDialog;
document.getElementById('mdSave').onclick=saveMealDialog;
document.getElementById('mealDialog').addEventListener('click',e=>{ if(e.target.id==='mealDialog') closeMealDialog(); });
document.getElementById('mdKcal').addEventListener('keydown',e=>{if(e.key==='Enter')saveMealDialog()});
document.getElementById('gdClose').onclick=closeGuide;
document.getElementById('guideDialog').addEventListener('click',e=>{ if(e.target.id==='guideDialog') closeGuide(); });
document.getElementById('mdEstimate').onclick=async()=>{
  const desc=document.getElementById('mdTxt').value.trim();
  const msg=document.getElementById('mdEstMsg');
  if(!desc){ document.getElementById('mdTxt').focus(); return; }
  if(!CLOUD.url||!hasCred()){ msg.style.display='block'; msg.style.color='var(--red)'; msg.textContent=t('Najpierw włącz synchronizację w chmurze (Więcej → Synchronizacja).'); return; }
  if(quotaLeft('est')===0){   // plan z limitami: miesięczny limit szacowań
    msg.style.display='block'; msg.style.color='var(--red)';
    msg.innerHTML=t('Limit {n} szacowań w tym miesiącu wykorzystany. Nowe od {d}.', {n:quotaCur().est.max, d:quotaReset()})+' '+t('Kalorie i makro możesz wpisać ręcznie.')+limitOffer('est'); bindOffer(msg); return;
  }
  const btn=document.getElementById('mdEstimate');
  const old=btn.textContent; btn.textContent=t('⏳ Szacuję...'); btn.disabled=true;
  msg.style.display='block'; msg.style.color='var(--steel)'; msg.textContent=t('Pytam Claude o wartości odżywcze…');
  try{
    const j=await cloudCall('estimate',{desc});
    if(j.quota) quotaSet(j.quota);
    document.getElementById('mdKcal').value=j.kcal||'';
    document.getElementById('mdP').value=j.p||'';
    document.getElementById('mdC').value=j.c||'';
    document.getElementById('mdF').value=j.f||'';
    msg.textContent=t('Oszacowano: {k} kcal · {m}. Możesz poprawić.', {k:j.kcal||0, m:t('B {p} / W {c} / T {f}', {p:j.p||0, c:j.c||0, f:j.f||0})})+(quotaCur()?' '+t('Zostało {a} z {b} szacowań w tym miesiącu.', {a:quotaLeft('est'), b:quotaCur().est.max}):'');
  }catch(e){ if(e.data && e.data.quota) quotaSet(e.data.quota); msg.style.color='var(--red)'; msg.textContent=t('Nie udało się oszacować: ')+e.message+(e.data&&e.data.limit?' '+t('Kalorie i makro możesz wpisać ręcznie.'):''); }
  btn.textContent=old; btn.disabled=false;
};
}
