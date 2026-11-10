// ŻELAZO — Dane planu: ćwiczenia i jadłospis 24 tygodni, fazy, silnik składników, przesunięte treningi.
// Moduł zawiera tylko deklaracje; kod startowy jest w __init_N, wywoływanych przez main.js w stałej kolejności.
import { dayIndexFor, weekOf } from '../core/backup';
import { S } from '../core/state';
import { protFloor } from '../diet/scaling';
import { parseISO } from '../lib/dates';
import { isEn, t } from '../lib/i18n';

export let DEFAULT_KCAL, MACRO_BASE, FOODS, DIET, SZT_FORMS, FBW_A, FBW_B, UPPER, LOWER, HOME, CARDIO_RUN_STRETCH, MOBILITY, CARDIO_RUN, CARDIO_RUN_LONG, CARDIO_HIIT, CARDIO_LONG, REST, ACTIVE, SHOP_DAY, COOK;

export function macroGoalFor(kcal){
  const r=kcal/MACRO_BASE.kcal;
  // białko trzymamy wysoko (nie tnijmy go proporcjonalnie tak mocno) — min 180 g
  return {kcal, p:Math.max(protFloor(),Math.round(MACRO_BASE.p*r/5)*5), c:Math.round(MACRO_BASE.c*r/5)*5, f:Math.round(MACRO_BASE.f*r/5)*5};
}

/* ==== SILNIK SKŁADNIKOWY: makra i opisy liczone z gramatur (jedno źródło prawdy) ==== */
export function foodMacro(key, qty){ // qty = sztuki (unit) lub gramy
  const f=FOODS[key]; if(!f) return [0,0,0,0];
  const fac = f.unit ? qty : qty/100;
  return [f.m[0]*fac, f.m[1]*fac, f.m[2]*fac, f.m[3]*fac];
}

// polska odmiana sztuk
export function plForm(n, f){
  const forms=SZT_FORMS[f]||null; if(!forms) return t(FOODS[f].n);
  n=Math.abs(n); if(n===1) return t(forms[0]);
  if(isEn()) return t(forms[2]);   // po angielsku liczba mnoga jedną formą
  const d=n%10,h=n%100; return (d>=2&&d<=4&&!(h>=12&&h<=14))?forms[1]:forms[2];
}

export function foodLabel(key, qty){
  const f=FOODS[key];
  if(f.unit==='szt') return qty+' '+plForm(qty,key);
  if(f.unit==='porcja') return t(f.n);
  return t(f.n)+' '+Math.round(qty)+' g';
}

// skalowanie ilości: białko chronione (fProt), reszta fCF; jajka i "porcje" zawsze całe/stałe
export function scaleQtyFor(key, qty, f){
  const food=FOODS[key];
  if(food.unit==='porcja') return qty;           // ¼ awokado itp. — stałe
  if(food.unit==='szt'){
    if(food.prot) return qty;                     // jaja — nie tniemy (białko)
    return Math.max(1, Math.round(qty*f.fCF));    // chleb/banan/pomidor — skaluj, całe sztuki
  }
  const factor = food.prot ? f.fProt : f.fCF;
  let v = qty*factor;
  return v>=40 ? Math.round(v/5)*5 : Math.round(v);
}

// makra i opis posiłku po przeskalowaniu do współczynników f
export function mealComputed(variant, f){
  let m=[0,0,0,0];
  const parts=[];
  variant.items.forEach(([k,q])=>{
    const sq=scaleQtyFor(k,q,f);
    const im=foodMacro(k,sq);
    for(let i=0;i<4;i++)m[i]+=im[i];
    parts.push(foodLabel(k,sq));
  });
  if(variant.extra) parts.push(t(variant.extra));
  let txt=parts.join(', '); txt=txt.charAt(0).toUpperCase()+txt.slice(1);
  return {kcal:Math.round(m[0]), p:Math.round(m[1]), c:Math.round(m[2]), f:Math.round(m[3]), txt};
}

// bazowe makra wariantu (bez skalowania) — do wyliczenia współczynników dnia
export function variantBase(variant){
  let m=[0,0,0,0];
  variant.items.forEach(([k,q])=>{const im=foodMacro(k,q);for(let i=0;i<4;i++)m[i]+=im[i];});
  return {kcal:m[0], p:m[1], c:m[2], f:m[3]};
}

// domyślny wariant dla danego tygodnia planu (rotacja co tydzień): tydz1→0, tydz2→1, tydz3→2, tydz4→0…
export function autoVariant(weekIdx){ return ((weekIdx-1)%3+3)%3; }

// Zwraca plan treningu dla danego (faza, tydzień-w-planie, dzień-tygodnia 0=Nd..6=Sb)
export function workoutFor(week, dow){
  // week: 1..24 ; dow: 0=Nd,1=Pn,...6=Sb
  if(week<=8){ // FAZA 1
    // rotacja FBW: tydzień nieparzysty -> Pn A, Śr B, Pt A ; parzysty -> Pn B, Śr A, Pt B
    const odd = (week%2===1);
    const map={
      0:ACTIVE,
      1: odd?FBW_A:FBW_B,
      2:CARDIO_RUN,
      3: odd?FBW_B:FBW_A,
      4:REST,
      5: odd?FBW_A:FBW_B,
      6:CARDIO_RUN_LONG,
    };
    return map[dow];
  }
  // FAZA 2 i 3: siłownia 3× (pn/śr/pt), Upper/Lower na zmianę jak FBW w Fazie 1:
  // tydzień nieparzysty -> U,L,U ; parzysty -> L,U,L. Wt: dom, czw: odpoczynek, sb: jeden bieg, nd: mobilność.
  const odd = (week%2===1);
  let U=UPPER, L=LOWER, run=CARDIO_RUN_STRETCH;
  if(week>16){ // FAZA 3 rzeźba: ciężar −10%, więcej powtórzeń, dłuższy bieg
    U=Object.assign({},UPPER,{title:"UPPER · rzeźba",phase3:true});
    L=Object.assign({},LOWER,{title:"LOWER · rzeźba",phase3:true});
    run=CARDIO_LONG;
  }
  const map={0:MOBILITY,1:odd?U:L,2:HOME,3:odd?L:U,4:REST,5:odd?U:L,6:run};
  return map[dow];
}

/* ---- przesunięte treningi: S.adj.moves[dzień] = dzień z planu, którego trening odbywa się tego dnia ----
   To permutacja dni (przesunięcie na dzień wolny = zamiana z odpoczynkiem). Wersja stabilna jej nie zna. */
export function planSrc(iso){ const m=S.adj&&S.adj.moves; return (m&&m[iso])||iso; }

export function workoutOn(iso){
  const s=planSrc(iso), di=dayIndexFor(s);
  return (di>=1&&di<=168) ? workoutFor(weekOf(di), parseISO(s).getDay()) : REST;
}

export function phaseInfo(week){
  if(week<=8) return {n:1,name:"Faza 1 · Adaptacja i redukcja",range:[1,8]};
  if(week<=16) return {n:2,name:"Faza 2 · Hipertrofia",range:[9,16]};
  return {n:3,name:"Faza 3 · Rzeźba",range:[17,24]};
}

export function __init_1(){

/* ============================================================
   DANE PLANU  (przeniesione 1:1 z planu + silnik faz)
   ============================================================ */

// Domyślny cel; nadpisywany przez ustawienie użytkownika (suwak). Makra skalują się do celu.
DEFAULT_KCAL = 2500;
// bazowy rozkład makro na 2600 kcal (z planu); przeskalujemy proporcjonalnie do wybranego celu
MACRO_BASE = {kcal:2600, p:190, c:250, f:90};

// 7-dniowy jadłospis. Każdy posiłek ma 3 warianty (v). m:[kcal, białko, węgle, tłuszcz].
// Wariant rotuje się automatycznie co tydzień (tydz1→A, tydz2→B, tydz3→C, tydz4→A…),
// można go zmienić ręcznie per-posiłek. Wszystkie dni celują ~2500–2600 kcal.
// baza składników: [kcal,białko,węgle,tłuszcz] na 100g lub na sztukę (unit)
FOODS = {
  kurczak:{n:"pierś z kurczaka",m:[110,23,0,2],prot:1},
  indyk:{n:"pierś z indyka",m:[105,24,0,1],prot:1},
  wolowina_chuda:{n:"mielona wołowina 5%",m:[137,21,0,5],prot:1},
  wolowina_stir:{n:"wołowina do stir-fry",m:[130,21,0,5],prot:1},
  rostbef:{n:"stek wołowy (rostbef)",m:[130,22,0,4],prot:1},
  karkowka:{n:"karkówka",m:[180,19,0,12],prot:1},
  poledwiczka:{n:"polędwiczka wieprzowa",m:[120,21,0,4],prot:1},
  gulasz_wol:{n:"gulasz wołowy",m:[150,20,0,8],prot:1},
  zeberka_drob:{n:"żeberka drobiowe",m:[170,20,0,10],prot:1},
  klopsiki_drob:{n:"klopsiki drobiowe",m:[150,18,3,7],prot:1},
  kielbaski_drob:{n:"kiełbaski drobiowe",m:[180,16,1,12],prot:1},
  boczek_chudy:{n:"boczek chudy",m:[220,20,0,15],prot:1},
  szynka_drob:{n:"szynka z indyka",m:[110,18,2,3],prot:1},
  wedlina_drob:{n:"wędlina drobiowa",m:[110,18,2,3],prot:1},
  losos:{n:"łosoś",m:[200,20,0,13],prot:1},
  dorsz:{n:"dorsz",m:[82,18,0,1],prot:1},
  makrela:{n:"makrela",m:[205,19,0,14],prot:1},
  tunczyk:{n:"tuńczyk w sosie własnym",m:[110,25,0,1],prot:1},
  tunczyk_stek:{n:"stek z tuńczyka",m:[130,26,0,3],prot:1},
  krewetki:{n:"krewetki",m:[85,18,1,1],prot:1},
  jajko:{n:"jajo",unit:"szt",m:[72,6,0.5,5],prot:1},
  twarog:{n:"twaróg chudy",m:[100,18,3,1],prot:1},
  twarozek:{n:"twarożek półtłusty",m:[130,15,4,6],prot:1},
  serek_wiejski:{n:"serek wiejski",m:[98,12,3,4],prot:1},
  serek_light:{n:"serek kanapkowy light",m:[130,10,4,8],prot:1},
  skyr:{n:"skyr",m:[63,11,4,0],prot:1},
  jogurt:{n:"jogurt naturalny",m:[60,5,7,2]},
  mleko:{n:"mleko 1.5%",m:[47,3.4,5,1.5]},
  maslo:{n:"masło",m:[735,1,1,81]},
  mozzarella:{n:"mozzarella light",m:[170,20,2,9],prot:1},
  feta:{n:"feta",m:[260,14,4,21]},
  ser_zolty:{n:"ser żółty",m:[350,25,1,27],prot:1},
  chleb_zytni:{n:"kromka chleba żytniego",unit:"szt",m:[70,2.5,13,0.8]},
  grzanka:{n:"grzanka żytnia",unit:"szt",m:[70,2.5,13,0.8]},
  pieczywo_chrup:{n:"pieczywo chrupkie",unit:"szt",m:[35,1,7,0.3]},
  wafle_ryz:{n:"wafel ryżowy",unit:"szt",m:[30,0.6,6,0.3]},
  platki_ows:{n:"płatki owsiane",m:[370,13,60,7]},
  platki_jagl:{n:"płatki jaglane",m:[350,10,66,4]},
  maka_ows:{n:"mąka owsiana",m:[370,13,60,7]},
  maka_psz:{n:"mąka pszenna",m:[340,10,72,1]},
  granola:{n:"granola",m:[440,9,64,15]},
  ryz:{n:"ryż (such.)",m:[350,7,78,1]},
  kasza_gr:{n:"kasza gryczana (such.)",m:[340,13,62,3]},
  kasza_jag:{n:"kasza jaglana (such.)",m:[350,10,66,4]},
  bulgur:{n:"bulgur (such.)",m:[340,12,68,1.5]},
  makaron_pz:{n:"makaron pełnoziarnisty (such.)",m:[350,13,64,2.5]},
  ziemniaki:{n:"ziemniaki",m:[80,2,17,0.1]},
  bataty:{n:"bataty",m:[86,1.6,20,0.1]},
  oliwa:{n:"oliwa",m:[884,0,0,100]},
  orzechy:{n:"orzechy",m:[650,15,14,60]},
  migdaly:{n:"migdały",m:[580,21,20,50]},
  pestki_dyni:{n:"pestki dyni",m:[560,30,10,49]},
  maslo_orze:{n:"masło orzechowe",m:[600,25,20,50]},
  wpc:{n:"odżywka WPC",m:[380,80,8,6],prot:1},
  dzem:{n:"dżem 100% owoców",m:[190,0.5,46,0]},
  miod:{n:"miód",m:[320,0,80,0]},
  hummus:{n:"hummus",m:[230,8,14,16]},
  siemie:{n:"siemię lniane",m:[530,18,29,42]},
  banan:{n:"banan",unit:"szt",m:[105,1.3,27,0.3]},
  jablko:{n:"jabłko",unit:"szt",m:[80,0.4,21,0.2]},
  awokado_p:{n:"awokado",unit:"porcja",m:[80,1,4,7]},
  warzywa:{n:"warzywa",m:[30,2,5,0.3]},
  pomidor:{n:"pomidor",unit:"szt",m:[22,1,5,0.2]},
  owoce_jagod:{n:"owoce jagodowe",m:[50,1,12,0.3]},
  kukurydza:{n:"kukurydza",m:[86,3,19,1]},
  oliwki:{n:"oliwki",m:[145,1,6,15]},
  sok:{n:"sok",unit:"porcja",m:[110,1,26,0]},
  kokos_light:{n:"mleczko kokosowe light",m:[73,1,2,7]},
};

DIET = {
0:{name:"Niedziela",meals:[
  {tag:"Śniadanie",v:[
    {items:[["platki_ows",130],["wpc",40],["jablko",1],["orzechy",15]],extra:"cynamon"},
    {items:[["jajko",5],["chleb_zytni",4],["awokado_p",1],["szynka_drob",40]],extra:""},
    {items:[["twarozek",300],["miod",20],["banan",1],["granola",50],["orzechy",15]],extra:""},
  ]},
  {tag:"Przekąska",v:[
    {items:[["skyr",300],["owoce_jagod",80],["migdaly",20]],extra:""},
    {items:[["jajko",3],["orzechy",25],["warzywa",100]],extra:"marchewki"},
    {items:[["serek_wiejski",250],["pomidor",1],["pieczywo_chrup",2]],extra:""},
  ]},
  {tag:"Obiad",v:[
    {items:[["rostbef",220],["ziemniaki",420],["warzywa",100],["oliwa",10]],extra:"sałata"},
    {items:[["kurczak",280],["ziemniaki",450],["warzywa",150]],extra:"surówka z kapusty"},
    {items:[["karkowka",200],["kasza_gr",80],["warzywa",150],["oliwa",5]],extra:"warzywa grillowane"},
  ]},
  {tag:"Kolacja",v:[
    {items:[["twarog",200],["jajko",1],["chleb_zytni",2],["awokado_p",1]],extra:""},
    {items:[["jajko",4],["ser_zolty",30],["szynka_drob",40],["chleb_zytni",1],["pomidor",1]],extra:""},
    {items:[["kurczak",150],["feta",40],["oliwa",10],["chleb_zytni",1],["warzywa",100]],extra:""},
  ]},
]},
1:{name:"Poniedziałek",meals:[
  {tag:"Śniadanie",v:[
    {items:[["jajko",5],["maslo",10],["chleb_zytni",2],["pomidor",1]],extra:""},
    {items:[["platki_ows",130],["wpc",40],["owoce_jagod",60],["mleko",200],["chleb_zytni",1]],extra:""},
    {items:[["chleb_zytni",7],["tunczyk",100],["jajko",2]],extra:"pasta z tuńczyka"},
  ]},
  {tag:"Przekąska",v:[
    {items:[["serek_wiejski",250],["orzechy",30],["jablko",1]],extra:""},
    {items:[["skyr",300],["banan",1],["migdaly",25]],extra:""},
    {items:[["wpc",60],["mleko",200],["maslo_orze",15]],extra:"szejk"},
  ]},
  {tag:"Obiad",v:[
    {items:[["kurczak",240],["ryz",130],["warzywa",200],["oliwa",10]],extra:"brokuły"},
    {items:[["indyk",240],["kasza_gr",130],["warzywa",150],["oliwa",5]],extra:"cukinia"},
    {items:[["wolowina_stir",220],["ryz",130],["warzywa",150]],extra:"sos sojowy"},
  ]},
  {tag:"Kolacja",v:[
    {items:[["twarog",200],["jogurt",100],["chleb_zytni",2]],extra:"rzodkiewka"},
    {items:[["feta",60],["tunczyk",80],["oliwki",20],["chleb_zytni",1]],extra:"sałatka grecka"},
    {items:[["jajko",3],["awokado_p",2],["grzanka",1],["pomidor",1]],extra:""},
  ]},
]},
2:{name:"Wtorek",meals:[
  {tag:"Śniadanie",v:[
    {items:[["platki_ows",130],["wpc",50],["owoce_jagod",60],["mleko",200],["chleb_zytni",2]],extra:""},
    {items:[["jajko",5],["boczek_chudy",40],["chleb_zytni",6]],extra:""},
    {items:[["maka_ows",110],["jajko",1],["twarog",150],["dzem",30],["chleb_zytni",2]],extra:"naleśniki"},
  ]},
  {tag:"Przekąska",v:[
    {items:[["chleb_zytni",2],["szynka_drob",120],["warzywa",80]],extra:""},
    {items:[["serek_wiejski",250],["orzechy",25],["warzywa",80]],extra:"papryka"},
    {items:[["skyr",300],["owoce_jagod",60],["migdaly",10],["wpc",20]],extra:""},
  ]},
  {tag:"Obiad",v:[
    {items:[["wolowina_chuda",220],["makaron_pz",130],["pomidor",2]],extra:"sos pomidorowy"},
    {items:[["kurczak",240],["ryz",130],["warzywa",150],["kokos_light",50]],extra:"curry"},
    {items:[["klopsiki_drob",240],["ziemniaki",450],["warzywa",100],["oliwa",5]],extra:"buraczki"},
  ]},
  {tag:"Kolacja",v:[
    {items:[["tunczyk",120],["kukurydza",60],["jajko",2],["oliwa",10]],extra:"sałatka"},
    {items:[["twarog",200],["chleb_zytni",2]],extra:"rzodkiewka"},
    {items:[["jajko",4],["ser_zolty",30],["szynka_drob",40],["warzywa",80]],extra:"omlet ze szpinakiem"},
  ]},
]},
3:{name:"Środa",meals:[
  {tag:"Śniadanie",v:[
    {items:[["jajko",4],["maka_ows",100],["dzem",30],["wpc",30]],extra:"omlet"},
    {items:[["platki_ows",120],["maslo_orze",20],["banan",1],["wpc",50],["mleko",150]],extra:""},
    {items:[["chleb_zytni",3],["ser_zolty",40],["szynka_drob",60],["jajko",2]],extra:""},
  ]},
  {tag:"Przekąska",v:[
    {items:[["skyr",300],["banan",1],["migdaly",25]],extra:""},
    {items:[["serek_wiejski",250],["pieczywo_chrup",2]],extra:"ogórek"},
    {items:[["wpc",50],["mleko",200],["orzechy",20],["jablko",1]],extra:"szejk"},
  ]},
  {tag:"Obiad",v:[
    {items:[["losos",180],["ziemniaki",300],["warzywa",100],["oliwa",10]],extra:"kiszona kapusta"},
    {items:[["dorsz",260],["ryz",120],["warzywa",150],["oliwa",10]],extra:"brokuły"},
    {items:[["makrela",200],["kasza_jag",90],["warzywa",150],["oliwa",5]],extra:"surówka"},
  ]},
  {tag:"Kolacja",v:[
    {items:[["twarog",200],["jogurt",100],["siemie",10],["wafle_ryz",3],["owoce_jagod",50]],extra:""},
    {items:[["chleb_zytni",3],["wedlina_drob",120],["serek_light",30]],extra:""},
    {items:[["jajko",3],["twarog",150],["awokado_p",1],["grzanka",1]],extra:""},
  ]},
]},
4:{name:"Czwartek",meals:[
  {tag:"Śniadanie",v:[
    {items:[["jajko",5],["maslo",10],["chleb_zytni",2],["warzywa",80]],extra:"papryka"},
    {items:[["platki_ows",130],["wpc",40],["jablko",1],["chleb_zytni",2]],extra:"cynamon"},
    {items:[["twarozek",300],["owoce_jagod",80],["granola",50],["orzechy",15]],extra:""},
  ]},
  {tag:"Przekąska",v:[
    {items:[["wpc",50],["platki_jagl",100],["maslo_orze",20]],extra:"szejk"},
    {items:[["serek_wiejski",250],["orzechy",30],["warzywa",80]],extra:"papryka"},
    {items:[["skyr",300],["banan",1],["platki_ows",50],["wpc",20]],extra:""},
  ]},
  {tag:"Obiad",v:[
    {items:[["poledwiczka",220],["kasza_gr",100],["warzywa",100]],extra:"buraczki"},
    {items:[["kurczak",240],["bataty",400],["warzywa",150],["oliwa",10]],extra:"fasolka szparagowa"},
    {items:[["gulasz_wol",240],["ziemniaki",300],["warzywa",80]],extra:"ogórek kiszony"},
  ]},
  {tag:"Kolacja",v:[
    {items:[["mozzarella",125],["tunczyk",80],["pomidor",2],["oliwa",10],["grzanka",1]],extra:""},
    {items:[["twarog",200],["chleb_zytni",2]],extra:"rzodkiewka i szczypiorek"},
    {items:[["jajko",3],["tunczyk",100],["kukurydza",60],["oliwa",10]],extra:"sałatka"},
  ]},
]},
5:{name:"Piątek",meals:[
  {tag:"Śniadanie",v:[
    {items:[["jajko",4],["feta",40],["pomidor",2],["chleb_zytni",5]],extra:"szakszuka"},
    {items:[["platki_ows",110],["wpc",50],["owoce_jagod",60],["orzechy",15],["mleko",150]],extra:""},
    {items:[["chleb_zytni",5],["jajko",4],["awokado_p",1],["wedlina_drob",40]],extra:"pasta jajeczna"},
  ]},
  {tag:"Przekąska",v:[
    {items:[["serek_wiejski",250],["pestki_dyni",20],["wpc",20]],extra:"rzodkiewki"},
    {items:[["skyr",300],["owoce_jagod",60],["migdaly",25]],extra:""},
    {items:[["jajko",3],["hummus",50],["warzywa",100]],extra:"marchewki"},
  ]},
  {tag:"Obiad",v:[
    {items:[["dorsz",240],["ryz",130],["warzywa",100],["oliwa",10]],extra:"mix sałat, winegret"},
    {items:[["losos",180],["bulgur",100],["warzywa",150],["oliwa",5]],extra:"szparagi"},
    {items:[["krewetki",230],["makaron_pz",130],["oliwa",10],["ser_zolty",15]],extra:"czosnek, parmezan"},
  ]},
  {tag:"Kolacja",v:[
    {items:[["twarog",200],["maslo_orze",15],["wafle_ryz",3],["owoce_jagod",50]],extra:""},
    {items:[["jajko",4],["ser_zolty",30],["szynka_drob",40],["pomidor",1]],extra:"omlet"},
    {items:[["feta",60],["kurczak",220],["oliwki",20],["chleb_zytni",1]],extra:"sałatka grecka"},
  ]},
]},
6:{name:"Sobota",meals:[
  {tag:"Śniadanie",v:[
    {items:[["maka_psz",120],["jajko",2],["twarog",200],["chleb_zytni",4]],extra:"naleśniki z farszem"},
    {items:[["jajko",5],["kielbaski_drob",80],["chleb_zytni",2]],extra:""},
    {items:[["platki_ows",90],["banan",1],["wpc",50],["maslo_orze",15]],extra:""},
  ]},
  {tag:"Po treningu",v:[
    {items:[["banan",1],["wpc",40],["orzechy",20]],extra:""},
    {items:[["skyr",300],["owoce_jagod",60],["platki_ows",100],["wpc",20]],extra:""},
    {items:[["chleb_zytni",2],["szynka_drob",100],["sok",1]],extra:""},
  ]},
  {tag:"Obiad",v:[
    {items:[["indyk",240],["bataty",400],["warzywa",150],["oliwa",5]],extra:"szparagi"},
    {items:[["tunczyk_stek",220],["ryz",90],["warzywa",100],["oliwa",10]],extra:"sałatka"},
    {items:[["zeberka_drob",260],["ziemniaki",250],["warzywa",100]],extra:"surówka"},
  ]},
  {tag:"Kolacja",v:[
    {items:[["feta",60],["tunczyk",100],["oliwki",20],["warzywa",100]],extra:"sałatka grecka"},
    {items:[["twarog",200],["jogurt",100],["wafle_ryz",3],["owoce_jagod",50]],extra:""},
    {items:[["jajko",3],["twarog",100],["awokado_p",2],["grzanka",1],["ser_zolty",30]],extra:""},
  ]},
]},
};
SZT_FORMS = {
  jajko:['jajo','jaja','jaj'], chleb_zytni:['kromka żytnia','kromki żytnie','kromek żytnich'],
  grzanka:['grzanka żytnia','grzanki żytnie','grzanek żytnich'],
  pieczywo_chrup:['pieczywo chrupkie','pieczywa chrupkie','pieczywa chrupkiego'],
  wafle_ryz:['wafel ryżowy','wafle ryżowe','wafli ryżowych'],
  banan:['banan','banany','bananów'], jablko:['jabłko','jabłka','jabłek'], pomidor:['pomidor','pomidory','pomidorów'],
};

/* --- Treningi wg faz --- */
// Faza 1 (tyg 1-8): FBW A/B, rotacja A,B,A / B,A,B — bieganie wt/sob
// każde ćwiczenie ma: w = zalecany ciężar startowy (kg, wpisywany do pola), rp = zalecane powtórzenia na serię
// (pola są wstępnie wypełnione tymi wartościami — użytkownik koryguje w górę/dół)
FBW_A = {title:"FBW A · całe ciało",type:"lift",ex:[
  {n:"Przysiad ze sztangą na karku",s:4,r:"8–10",start:"60 kg",w:60,rp:10},
  {n:"Wyciskanie sztangi — ławka płaska",s:4,r:"8–10",start:"60 kg",w:60,rp:10},
  {n:"Wiosłowanie sztangą w opadzie",s:4,r:"8–10",start:"50 kg",w:50,rp:10},
  {n:"Wyciskanie żołnierskie (stojąc)",s:3,r:"10–12",start:"30 kg",w:30,rp:12},
  {n:"Uginanie ramion ze sztangą (biceps)",s:3,r:"12–15",start:"25 kg",w:25,rp:15},
  {n:"Wyciskanie francuskie hantli (triceps)",s:3,r:"12–15",start:"10 kg/rękę",w:10,rp:15},
  {n:"Deska (plank)",s:3,r:"max czas",start:"masa ciała",w:0,rp:60},
]};
FBW_B = {title:"FBW B · całe ciało",type:"lift",ex:[
  {n:"Martwy ciąg (klasyczny/rumuński)",s:4,r:"6–8",start:"80 kg",w:80,rp:8},
  {n:"Wyciskanie hantli — ławka skośna",s:4,r:"10–12",start:"22.5 kg/rękę",w:22.5,rp:12},
  {n:"Ściąganie drążka wyciągu z góry",s:4,r:"10–12",start:"55 kg",w:55,rp:12},
  {n:"Wznosy hantli bokiem (barki)",s:4,r:"15–20",start:"8 kg/rękę",w:8,rp:18},
  {n:"Wspięcia na palce (łydki)",s:4,r:"15–20",start:"+20 kg hantle",w:20,rp:18},
  {n:"Uginanie nóg na maszynie",s:3,r:"12–15",start:"40 kg",w:40,rp:15},
  {n:"Allahy (brzuch z wyciągiem)",s:3,r:"15",start:"30 kg",w:30,rp:15},
]};
// Faza 2 (tyg 9-16): Upper/Lower — ciężary startowe spójne z Fazą 1 (po 8 tyg. progresji)
UPPER = {title:"UPPER · góra ciała",type:"lift",ex:[
  {n:"Wyciskanie sztangi — ławka płaska",s:4,r:"6–8",start:"70 kg",w:70,rp:8},
  {n:"Podciąganie na drążku (lub wyciąg)",s:4,r:"8–10",start:"masa ciała / 60 kg wyciąg",w:0,rp:10},
  {n:"Wyciskanie hantli siedząc (barki)",s:3,r:"10–12",start:"20 kg/rękę",w:20,rp:12},
  {n:"Wiosłowanie hantlem jednorącz",s:3,r:"10–12",start:"28 kg",w:28,rp:12},
  {n:"Rozpiętki w bramie (wyciąg)",s:3,r:"15",start:"12 kg/stronę",w:12,rp:15},
  {n:"Uginanie młotkowe (biceps)",s:3,r:"12",start:"14 kg/rękę",w:14,rp:12},
  {n:"Prostowanie ramion na wyciągu (triceps)",s:3,r:"12",start:"30 kg",w:30,rp:12},
]};
LOWER = {title:"LOWER · dół ciała",type:"lift",ex:[
  {n:"Przysiad z hantlami / Hack",s:4,r:"8–10",start:"80 kg (Hack)",w:80,rp:10},
  {n:"Wypady chodzone z hantlami",s:3,r:"12/nogę",start:"14 kg/rękę",w:14,rp:12},
  {n:"Rumuński martwy ciąg (RDL)",s:4,r:"10",start:"70 kg",w:70,rp:10},
  {n:"Wyciskanie nóg na suwnicy",s:3,r:"15",start:"120 kg",w:120,rp:15},
  {n:"Wspięcia na palce siedząc",s:4,r:"15–20",start:"40 kg",w:40,rp:18},
  {n:"Ab Wheel / brzuszki na piłce",s:3,r:"max",start:"masa ciała",w:0,rp:15},
]};
// Dom (Faza 2–3, dzień bez siłowni): kettlebell, hantle, masa ciała, ławka skośna.
// Umiarkowanie (RIR 3) — to dodatek, który ma nie zabrać siły na jutrzejszą siłownię.
// w:0 = bez podpowiedzi ciężaru: wpisz to, czym faktycznie ćwiczysz w domu.
HOME = {title:"DOM · kettlebell, kalistenika, brzuch",type:"lift",ex:[
  {n:"Swing kettlebell",s:4,r:"15",start:"kettlebell 12–16 kg",w:0,rp:15},
  {n:"Pompki",s:3,r:"max − 3",start:"masa ciała (za ciężko? dłonie na ławce)",w:0,rp:10},
  {n:"Farmer walk z hantlami",s:3,r:"40 s",start:"najcięższe hantle, jakie masz",w:0,rp:40},
  {n:"Brzuszki na ławce skośnej",s:3,r:"12–15",start:"masa ciała, potem hantel na klatce",w:0,rp:15},
  {n:"Unoszenie nóg na ławce skośnej",s:3,r:"10–12",start:"masa ciała",w:0,rp:12},
  {n:"Russian twist z hantlem",s:3,r:"20 (10/str.)",start:"hantel 6–10 kg",w:0,rp:20},
  {n:"Deska boczna",s:2,r:"30 s/stronę",start:"masa ciała",w:0,rp:30},
  {n:"Rozciąganie całego ciała",s:1,r:"10 min",start:"bez obciążenia — wpisz minuty",w:0,rp:10},
]};
CARDIO_RUN_STRETCH = {title:"Bieg spokojny + rozciąganie",type:"cardio",note:"30–40 min trucht, tętno 130–140 (masz móc mówić pełnymi zdaniami). Potem 15 min rozciągania: dwugłowe ud, biodra (wykrok), pośladki, klatka w drzwiach, łydki — każde 2×30 s."};
MOBILITY = {title:"Rozciąganie i mobilność",type:"rest",active:true,ico:"🧘",note:"20–30 min: koci grzbiet, rotacje odcinka piersiowego, biodra 90/90, wykrok z rotacją, wiszenie na drążku, rozciąganie dwugłowych i klatki. Do tego spacer 30 min."};
CARDIO_RUN = {title:"Bieganie",type:"cardio",note:"30–40 min trucht / szybki marsz, tętno 130–140."};
CARDIO_RUN_LONG = {title:"Bieg terenowy",type:"cardio",note:"40 min trucht w terenie."};
CARDIO_HIIT = {title:"Interwały biegowe",type:"cardio",note:"10 min rozgrzewki, 8×(30 s sprint / 1 min trucht), 10 min wyciszenia."};
CARDIO_LONG = {title:"Długi bieg terenowy",type:"cardio",note:"50–60 min w terenie."};
REST = {title:"Odpoczynek",type:"rest"};
ACTIVE = {title:"Aktywna regeneracja + Meal prep",type:"rest",active:true,note:"Spacer 45 min / stretching. Zrób zakupy i przygotuj jedzenie na tydzień."};
SHOP_DAY = {title:"Dzień zakupów",type:"rest",active:true,ico:"🛒",note:"Przejdź do zakładki „Zakupy” i skompletuj listę na cały tydzień. Jutro gotowanie."};
COOK = {title:"Meal prep — gotowanie",type:"rest",active:true,ico:"🍳",note:"Ugotuj bazę na tydzień (kurczak, ryż, kasze, warzywa). Lekki spacer 45 min. Od jutra startujesz!"};
}
