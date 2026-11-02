// ŻELAZO — Lista zakupów z wariantów bieżącego tygodnia.
// Moduł zawiera tylko deklaracje; kod startowy jest w __init_N, wywoływanych przez main.js w stałej kolejności.
import { dayIndexFor, viewDateISO, weekOf } from '../core/backup.js';
import { S, save } from '../core/state.js';
import { parseISO, todayISO } from '../lib/dates';
import { DIET, FOODS, autoVariant } from '../plan/data.js';

export let FOOD_CAT, SHOP_CATS_ORDER;

// agreguj rzeczywiste gramatury/sztuki składników z aktywnych wariantów tygodnia
// który tydzień planu oglądać na liście zakupów (wg aktualnie oglądanego dnia; poza planem → 1)
export function currentShopWeek(){
  const di=dayIndexFor(viewDateISO());
  const wk=weekOf(di);
  return (wk>=1&&wk<=24)?wk:1;
}

export function buildWeekShop(wk){
  const acc={}; // key -> suma (g lub szt)
  const startDay=(wk-1)*7+1;
  for(let off=0;off<7;off++){
    const di=startDay+off;
    const dObj=parseISO(S.startDate); dObj.setDate(dObj.getDate()+(di-1));
    const dow=dObj.getDay(); const L=S.log[todayISO(dObj)];
    DIET[dow].meals.forEach((slot,i)=>{
      let vi; if(L&&L.var&&L.var[i]!==undefined) vi=L.var[i]; else vi=autoVariant(wk);
      slot.v[vi].items.forEach(([k,q])=>{ acc[k]=(acc[k]||0)+q; });
    });
  }
  // pogrupuj po kategoriach
  const found={}; SHOP_CATS_ORDER.forEach(c=>found[c]={});
  Object.keys(acc).forEach(k=>{
    const cat=FOOD_CAT[k]; if(!cat) return;
    const f=FOODS[k]; if(!f) return;
    let label=f.n.replace(" (such.)","").replace("(such.)","");
    label=label.charAt(0).toUpperCase()+label.slice(1);
    let qtyStr;
    if(f.unit==="szt"){ qtyStr=Math.round(acc[k])+" szt."; }
    else if(f.unit==="porcja"){ qtyStr=Math.round(acc[k])+"×"; }
    else { const g=Math.round(acc[k]); qtyStr = g>=1000 ? (g/1000).toFixed(1).replace(".",",")+" kg" : g+" g"; }
    found[cat][label]=qtyStr;
  });
  return found;
}

export function renderShop(){
  const box=document.getElementById('shopList');
  const wk=currentShopWeek();
  const found=buildWeekShop(wk);
  const hdr=document.getElementById('shopWeekLabel');
  if(hdr) hdr.textContent='Tydzień '+wk+' · warianty wybrane na ten tydzień';
  let html='';
  SHOP_CATS_ORDER.forEach(cat=>{
    const items=Object.keys(found[cat]).sort();
    if(!items.length) return;
    html+=`<div class="shop-cat"><div class="ch">${cat}</div>`;
    items.forEach(it=>{
      const qty=found[cat][it];
      const k='w'+wk+'_'+cat.slice(0,3)+'_'+it.slice(0,14);
      const on=!!S.shop[k];
      html+=`<div class="shop-item ${on?'on':''}" data-shop="${k}">
        <span class="mini ${on?'on':''}"><svg viewBox="0 0 24 24"><path d="M4 12l5 5L20 6"/></svg></span>
        <span class="nm">${it}</span>
        ${qty?`<span class="qty">${qty}</span>`:''}
      </div>`;
    });
    html+=`</div>`;
  });
  box.innerHTML=html || '<div class="empty">Brak pozycji — sprawdź warianty posiłków na ten tydzień.</div>';
  box.querySelectorAll('[data-shop]').forEach(el=>{
    el.onclick=()=>{const k=el.dataset.shop;S.shop[k]=!S.shop[k];if(!S.shopT)S.shopT={};S.shopT[k]=Date.now();save();renderShop()};
  });
}

export function __init_11(){

/* ============================================================
   LISTA ZAKUPÓW — generowana z wariantów AKTUALNEGO tygodnia
   ============================================================ */
// lista zakupów agregowana ze składników aktywnych wariantów tygodnia
// kategorie zakupowe dla składników (klucz FOODS -> kategoria)
FOOD_CAT = {
  kurczak:'Mięso i ryby', indyk:'Mięso i ryby', wolowina_chuda:'Mięso i ryby', wolowina_stir:'Mięso i ryby', rostbef:'Mięso i ryby', karkowka:'Mięso i ryby', poledwiczka:'Mięso i ryby', gulasz_wol:'Mięso i ryby', zeberka_drob:'Mięso i ryby', klopsiki_drob:'Mięso i ryby', kielbaski_drob:'Mięso i ryby', boczek_chudy:'Mięso i ryby', szynka_drob:'Mięso i ryby', wedlina_drob:'Mięso i ryby', losos:'Mięso i ryby', dorsz:'Mięso i ryby', makrela:'Mięso i ryby', tunczyk:'Mięso i ryby', tunczyk_stek:'Mięso i ryby', krewetki:'Mięso i ryby',
  jajko:'Nabiał i jaja', twarog:'Nabiał i jaja', twarozek:'Nabiał i jaja', serek_wiejski:'Nabiał i jaja', serek_light:'Nabiał i jaja', skyr:'Nabiał i jaja', jogurt:'Nabiał i jaja', mleko:'Nabiał i jaja', maslo:'Nabiał i jaja', mozzarella:'Nabiał i jaja', feta:'Nabiał i jaja', ser_zolty:'Nabiał i jaja',
  chleb_zytni:'Węglowodany', grzanka:'Węglowodany', pieczywo_chrup:'Węglowodany', wafle_ryz:'Węglowodany', platki_ows:'Węglowodany', platki_jagl:'Węglowodany', maka_ows:'Węglowodany', maka_psz:'Węglowodany', granola:'Węglowodany', ryz:'Węglowodany', kasza_gr:'Węglowodany', kasza_jag:'Węglowodany', bulgur:'Węglowodany', makaron_pz:'Węglowodany', ziemniaki:'Węglowodany', bataty:'Węglowodany',
  banan:'Warzywa i owoce', jablko:'Warzywa i owoce', awokado_p:'Warzywa i owoce', warzywa:'Warzywa i owoce', pomidor:'Warzywa i owoce', owoce_jagod:'Warzywa i owoce', kukurydza:'Warzywa i owoce', oliwki:'Warzywa i owoce', sok:'Warzywa i owoce',
  oliwa:'Tłuszcze i dodatki', orzechy:'Tłuszcze i dodatki', migdaly:'Tłuszcze i dodatki', pestki_dyni:'Tłuszcze i dodatki', maslo_orze:'Tłuszcze i dodatki', wpc:'Tłuszcze i dodatki', dzem:'Tłuszcze i dodatki', miod:'Tłuszcze i dodatki', hummus:'Tłuszcze i dodatki', siemie:'Tłuszcze i dodatki', kokos_light:'Tłuszcze i dodatki',
};
SHOP_CATS_ORDER = ["Mięso i ryby","Nabiał i jaja","Węglowodany","Warzywa i owoce","Tłuszcze i dodatki"];
}
