// ŻELAZO — główny moduł aplikacji (dzielony stopniowo na moduły w app/lib/).
import './styles.css';
import { todayISO, parseISO, addDays } from './lib/dates';
import { mergeState, COACH_KEEP } from './lib/merge.js';

/* ============================================================
   DANE PLANU  (przeniesione 1:1 z planu + silnik faz)
   ============================================================ */

// Domyślny cel; nadpisywany przez ustawienie użytkownika (suwak). Makra skalują się do celu.
const DEFAULT_KCAL = 2500;
// bazowy rozkład makro na 2600 kcal (z planu); przeskalujemy proporcjonalnie do wybranego celu
const MACRO_BASE = {kcal:2600, p:190, c:250, f:90};
function macroGoalFor(kcal){
  const r=kcal/MACRO_BASE.kcal;
  // białko trzymamy wysoko (nie tnijmy go proporcjonalnie tak mocno) — min 180 g
  return {kcal, p:Math.max(protFloor(),Math.round(MACRO_BASE.p*r/5)*5), c:Math.round(MACRO_BASE.c*r/5)*5, f:Math.round(MACRO_BASE.f*r/5)*5};
}

// 7-dniowy jadłospis. Każdy posiłek ma 3 warianty (v). m:[kcal, białko, węgle, tłuszcz].
// Wariant rotuje się automatycznie co tydzień (tydz1→A, tydz2→B, tydz3→C, tydz4→A…),
// można go zmienić ręcznie per-posiłek. Wszystkie dni celują ~2500–2600 kcal.
// baza składników: [kcal,białko,węgle,tłuszcz] na 100g lub na sztukę (unit)
const FOODS={
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

const DIET={
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

/* ==== SILNIK SKŁADNIKOWY: makra i opisy liczone z gramatur (jedno źródło prawdy) ==== */
function foodMacro(key, qty){ // qty = sztuki (unit) lub gramy
  const f=FOODS[key]; if(!f) return [0,0,0,0];
  const fac = f.unit ? qty : qty/100;
  return [f.m[0]*fac, f.m[1]*fac, f.m[2]*fac, f.m[3]*fac];
}
// polska odmiana sztuk
function plForm(n, f){
  const forms=SZT_FORMS[f]||null; if(!forms) return FOODS[f].n;
  n=Math.abs(n); if(n===1) return forms[0];
  const t=n%10,h=n%100; return (t>=2&&t<=4&&!(h>=12&&h<=14))?forms[1]:forms[2];
}
const SZT_FORMS={
  jajko:['jajo','jaja','jaj'], chleb_zytni:['kromka żytnia','kromki żytnie','kromek żytnich'],
  grzanka:['grzanka żytnia','grzanki żytnie','grzanek żytnich'],
  pieczywo_chrup:['pieczywo chrupkie','pieczywa chrupkie','pieczywa chrupkiego'],
  wafle_ryz:['wafel ryżowy','wafle ryżowe','wafli ryżowych'],
  banan:['banan','banany','bananów'], jablko:['jabłko','jabłka','jabłek'], pomidor:['pomidor','pomidory','pomidorów'],
};
function foodLabel(key, qty){
  const f=FOODS[key];
  if(f.unit==='szt') return qty+' '+plForm(qty,key);
  if(f.unit==='porcja') return f.n;
  return f.n+' '+Math.round(qty)+' g';
}
// skalowanie ilości: białko chronione (fProt), reszta fCF; jajka i "porcje" zawsze całe/stałe
function scaleQtyFor(key, qty, f){
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
function mealComputed(variant, f){
  let m=[0,0,0,0];
  const parts=[];
  variant.items.forEach(([k,q])=>{
    const sq=scaleQtyFor(k,q,f);
    const im=foodMacro(k,sq);
    for(let i=0;i<4;i++)m[i]+=im[i];
    parts.push(foodLabel(k,sq));
  });
  if(variant.extra) parts.push(variant.extra);
  let txt=parts.join(', '); txt=txt.charAt(0).toUpperCase()+txt.slice(1);
  return {kcal:Math.round(m[0]), p:Math.round(m[1]), c:Math.round(m[2]), f:Math.round(m[3]), txt};
}
// bazowe makra wariantu (bez skalowania) — do wyliczenia współczynników dnia
function variantBase(variant){
  let m=[0,0,0,0];
  variant.items.forEach(([k,q])=>{const im=foodMacro(k,q);for(let i=0;i<4;i++)m[i]+=im[i];});
  return {kcal:m[0], p:m[1], c:m[2], f:m[3]};
}


// domyślny wariant dla danego tygodnia planu (rotacja co tydzień): tydz1→0, tydz2→1, tydz3→2, tydz4→0…
function autoVariant(weekIdx){ return ((weekIdx-1)%3+3)%3; }

/* --- Treningi wg faz --- */
// Faza 1 (tyg 1-8): FBW A/B, rotacja A,B,A / B,A,B — bieganie wt/sob
// każde ćwiczenie ma: w = zalecany ciężar startowy (kg, wpisywany do pola), rp = zalecane powtórzenia na serię
// (pola są wstępnie wypełnione tymi wartościami — użytkownik koryguje w górę/dół)
const FBW_A={title:"FBW A · całe ciało",type:"lift",ex:[
  {n:"Przysiad ze sztangą na karku",s:4,r:"8–10",start:"60 kg",w:60,rp:10},
  {n:"Wyciskanie sztangi — ławka płaska",s:4,r:"8–10",start:"60 kg",w:60,rp:10},
  {n:"Wiosłowanie sztangą w opadzie",s:4,r:"8–10",start:"50 kg",w:50,rp:10},
  {n:"Wyciskanie żołnierskie (stojąc)",s:3,r:"10–12",start:"30 kg",w:30,rp:12},
  {n:"Uginanie ramion ze sztangą (biceps)",s:3,r:"12–15",start:"25 kg",w:25,rp:15},
  {n:"Wyciskanie francuskie hantli (triceps)",s:3,r:"12–15",start:"10 kg/rękę",w:10,rp:15},
  {n:"Deska (plank)",s:3,r:"max czas",start:"masa ciała",w:0,rp:60},
]};
const FBW_B={title:"FBW B · całe ciało",type:"lift",ex:[
  {n:"Martwy ciąg (klasyczny/rumuński)",s:4,r:"6–8",start:"80 kg",w:80,rp:8},
  {n:"Wyciskanie hantli — ławka skośna",s:4,r:"10–12",start:"22.5 kg/rękę",w:22.5,rp:12},
  {n:"Ściąganie drążka wyciągu z góry",s:4,r:"10–12",start:"55 kg",w:55,rp:12},
  {n:"Wznosy hantli bokiem (barki)",s:4,r:"15–20",start:"8 kg/rękę",w:8,rp:18},
  {n:"Wspięcia na palce (łydki)",s:4,r:"15–20",start:"+20 kg hantle",w:20,rp:18},
  {n:"Uginanie nóg na maszynie",s:3,r:"12–15",start:"40 kg",w:40,rp:15},
  {n:"Allahy (brzuch z wyciągiem)",s:3,r:"15",start:"30 kg",w:30,rp:15},
]};
// Faza 2 (tyg 9-16): Upper/Lower — ciężary startowe spójne z Fazą 1 (po 8 tyg. progresji)
const UPPER={title:"UPPER · góra ciała",type:"lift",ex:[
  {n:"Wyciskanie sztangi — ławka płaska",s:4,r:"6–8",start:"70 kg",w:70,rp:8},
  {n:"Podciąganie na drążku (lub wyciąg)",s:4,r:"8–10",start:"masa ciała / 60 kg wyciąg",w:0,rp:10},
  {n:"Wyciskanie hantli siedząc (barki)",s:3,r:"10–12",start:"20 kg/rękę",w:20,rp:12},
  {n:"Wiosłowanie hantlem jednorącz",s:3,r:"10–12",start:"28 kg",w:28,rp:12},
  {n:"Rozpiętki w bramie (wyciąg)",s:3,r:"15",start:"12 kg/stronę",w:12,rp:15},
  {n:"Uginanie młotkowe (biceps)",s:3,r:"12",start:"14 kg/rękę",w:14,rp:12},
  {n:"Prostowanie ramion na wyciągu (triceps)",s:3,r:"12",start:"30 kg",w:30,rp:12},
]};
const LOWER={title:"LOWER · dół ciała",type:"lift",ex:[
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
const HOME={title:"DOM · kettlebell, kalistenika, brzuch",type:"lift",ex:[
  {n:"Swing kettlebell",s:4,r:"15",start:"kettlebell 12–16 kg",w:0,rp:15},
  {n:"Pompki",s:3,r:"max − 3",start:"masa ciała (za ciężko? dłonie na ławce)",w:0,rp:10},
  {n:"Farmer walk z hantlami",s:3,r:"40 s",start:"najcięższe hantle, jakie masz",w:0,rp:40},
  {n:"Brzuszki na ławce skośnej",s:3,r:"12–15",start:"masa ciała, potem hantel na klatce",w:0,rp:15},
  {n:"Unoszenie nóg na ławce skośnej",s:3,r:"10–12",start:"masa ciała",w:0,rp:12},
  {n:"Russian twist z hantlem",s:3,r:"20 (10/str.)",start:"hantel 6–10 kg",w:0,rp:20},
  {n:"Deska boczna",s:2,r:"30 s/stronę",start:"masa ciała",w:0,rp:30},
  {n:"Rozciąganie całego ciała",s:1,r:"10 min",start:"bez obciążenia — wpisz minuty",w:0,rp:10},
]};
const CARDIO_RUN_STRETCH={title:"Bieg spokojny + rozciąganie",type:"cardio",note:"30–40 min trucht, tętno 130–140 (masz móc mówić pełnymi zdaniami). Potem 15 min rozciągania: dwugłowe ud, biodra (wykrok), pośladki, klatka w drzwiach, łydki — każde 2×30 s."};
const MOBILITY={title:"Rozciąganie i mobilność",type:"rest",active:true,ico:"🧘",note:"20–30 min: koci grzbiet, rotacje odcinka piersiowego, biodra 90/90, wykrok z rotacją, wiszenie na drążku, rozciąganie dwugłowych i klatki. Do tego spacer 30 min."};
const CARDIO_RUN={title:"Bieganie",type:"cardio",note:"30–40 min trucht / szybki marsz, tętno 130–140."};
const CARDIO_RUN_LONG={title:"Bieg terenowy",type:"cardio",note:"40 min trucht w terenie."};
const CARDIO_HIIT={title:"Interwały biegowe",type:"cardio",note:"10 min rozgrzewki, 8×(30 s sprint / 1 min trucht), 10 min wyciszenia."};
const CARDIO_LONG={title:"Długi bieg terenowy",type:"cardio",note:"50–60 min w terenie."};
const REST={title:"Odpoczynek",type:"rest"};
const ACTIVE={title:"Aktywna regeneracja + Meal prep",type:"rest",active:true,note:"Spacer 45 min / stretching. Zrób zakupy i przygotuj jedzenie na tydzień."};
const SHOP_DAY={title:"Dzień zakupów",type:"rest",active:true,ico:"🛒",note:"Przejdź do zakładki „Zakupy” i skompletuj listę na cały tydzień. Jutro gotowanie."};
const COOK={title:"Meal prep — gotowanie",type:"rest",active:true,ico:"🍳",note:"Ugotuj bazę na tydzień (kurczak, ryż, kasze, warzywa). Lekki spacer 45 min. Od jutra startujesz!"};

// Zwraca plan treningu dla danego (faza, tydzień-w-planie, dzień-tygodnia 0=Nd..6=Sb)
function workoutFor(week, dow){
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
function planSrc(iso){ const m=S.adj&&S.adj.moves; return (m&&m[iso])||iso; }
function workoutOn(iso){
  const s=planSrc(iso), di=dayIndexFor(s);
  return (di>=1&&di<=168) ? workoutFor(weekOf(di), parseISO(s).getDay()) : REST;
}

function phaseInfo(week){
  if(week<=8) return {n:1,name:"Faza 1 · Adaptacja i redukcja",range:[1,8]};
  if(week<=16) return {n:2,name:"Faza 2 · Hipertrofia",range:[9,16]};
  return {n:3,name:"Faza 3 · Rzeźba",range:[17,24]};
}

/* ============================================================
   STAN / STORAGE
   ============================================================ */
const LS='zelazo_v1';
let S = load();
function load(){
  let r=null;
  try{r=JSON.parse(localStorage.getItem(LS));}catch(e){}
  if(r){
    // migracja: dołóż pola, których mogło nie być we wcześniejszych wersjach
    if(!r.profile) r.profile={weight:104,height:186,age:45,sex:'m',activity:1.465,name:''};
    if(!r.custom) r.custom={};
    if(r.kcalGoal===undefined) r.kcalGoal=DEFAULT_KCAL;
    return r;
  }
  return {startDate:upcomingMondayISO(), kcalGoal:DEFAULT_KCAL, profile:{weight:104,height:186,age:45,sex:'m',activity:1.465,name:''}, log:{}, weights:[], custom:{}, shop:{}, shopT:{}, reminders:{on:false,workout:"17:30",meal:"12:00",water:"15:00",weight:"07:00"}, streak:0, lastStreakDay:null};
}
// czy na urządzeniu są czyjeś dane (dziennik, waga, obwody, posiłki, profil)
function deviceHasData(){
  return Object.keys(S.log||{}).length>0 || (S.weights||[]).length>0 || (S.measures||[]).length>0
    || Object.keys(S.custom||{}).length>0 || !!(S.profile && S.profile.name);
}
function save(){exIdxCache=null; localStorage.setItem(LS,JSON.stringify(S)); if(fileHandle) scheduleFileWrite(); scheduleCloudPush();}
function touch(L){ if(L) L._m=Date.now(); }
// znacznik czasu pojedynczego pola (dla scalania „nowsza zmiana wygrywa")
function mark(L, field){ if(!L)return; if(!L._t)L._t={}; L._t[field]=Date.now(); L._m=Date.now(); }
function fieldTime(L, field){ return (L&&L._t&&L._t[field])||L&&L._m||0; }

/* ============================================================
   KONFIGURACJA CHMURY (Apps Script) — osobno od S, per urządzenie
   ============================================================ */
const CLOUD_LS='zelazo_cloud';
let CLOUD = loadCloud();
function loadCloud(){
  try{const r=JSON.parse(localStorage.getItem(CLOUD_LS));if(r)return r;}catch(e){}
  return {url:'', token:'', account:'', on:false, lastSync:0, lastError:''};
}
function saveCloud(){ localStorage.setItem(CLOUD_LS, JSON.stringify(CLOUD)); }

let cloudPushTimer=null, cloudBusy=false;
function scheduleCloudPush(){
  if(!CLOUD.on || !CLOUD.url) return;
  clearTimeout(cloudPushTimer);
  cloudPushTimer=setTimeout(function run(){
    // nie synchronizuj w trakcie pisania — poczekaj, aż użytkownik skończy
    if(isEditing()){ cloudPushTimer=setTimeout(run, 1500); return; }
    cloudPush();
  }, 2000); // debounce 2 s po ostatniej zmianie
}

// wspólne wywołanie do Apps Script. Używamy text/plain, by uniknąć preflightu CORS.
// wersja aplikacji z adresu: stabilna w katalogu głównym, pozostałe w /beta/, /early/, /users/ (funkcja, bo potrzebna od startu)
function appChannel(){ return (location.pathname.match(/\/(beta|zeta|early|users)\/(index\.html)?$/)||[])[1]||'stable'; }
async function cloudCall(action, payload){
  const body=JSON.stringify(Object.assign({action, token:CLOUD.token, account:(CLOUD.account||'').trim().toLowerCase(), channel:appChannel()}, payload||{}));
  const res=await fetch(CLOUD.url, {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body});
  const txt=await res.text();
  let j; try{ j=JSON.parse(txt); }catch(e){ throw new Error('Zła odpowiedź serwera (sprawdź URL wdrożenia)'); }
  if(!j.ok){ const e=new Error(j.error||'Błąd serwera'); e.data=j; throw e; }
  return j;
}

// Zabezpieczenie: dane z serwera bez znaczników czasu (stary skrypt .gs) dostają
// bardzo stary znacznik (1), żeby świeże lokalne odznaczenia zawsze wygrywały.
function normalizeIncoming(inc){
  if(!inc || typeof inc!=='object') return inc;
  if(inc.shop){
    if(!inc.shopT) inc.shopT={};
    Object.keys(inc.shop).forEach(k=>{ if(inc.shopT[k]===undefined) inc.shopT[k]=1; });
  }
  return inc;
}
async function cloudPush(){
  if(!CLOUD.on || !CLOUD.url || cloudBusy) return;
  if(!CLOUD.account){ CLOUD.lastError='Brak nazwy konta'; saveCloud(); refreshCloudUI(); return; }
  cloudBusy=true; refreshCloudUI('...zapisywanie');
  const acc=CLOUD.account;
  try{
    // wyślij nasz stan; serwer scali z tym, co ma, i zwróci wynik scalenia
    const j=await cloudCall('push', {data:S, clientMerge:true});
    // w międzyczasie zmieniono konto (np. dołączenie nowej osoby) — nie wpuszczaj danych poprzedniego
    if(j.data && CLOUD.account===acc){ S=mergeState(S, normalizeIncoming(j.data)); localStorage.setItem(LS, JSON.stringify(S)); refreshAllViews(); }
    CLOUD.lastSync=Date.now(); CLOUD.lastError=''; CLOUD.pending=false;
  }catch(e){ if(netDown(e)){ CLOUD.pending=true; CLOUD.lastError=''; } else CLOUD.lastError=e.message; }
  cloudBusy=false; saveCloud(); refreshCloudUI(); updateNetPill();
}
async function cloudPull({silent}={}){
  if(!CLOUD.url){ if(!silent) alert('Najpierw wpisz URL skryptu.'); return; }
  if(!CLOUD.account){ if(!silent) alert('Wpisz nazwę konta.'); return; }
  cloudBusy=true; refreshCloudUI('...pobieranie');
  const acc=CLOUD.account;
  try{
    const j=await cloudCall('pull', {});
    if(j.data && CLOUD.account===acc){ S=mergeState(S, normalizeIncoming(j.data)); localStorage.setItem(LS, JSON.stringify(S)); refreshAllViews(); }
    CLOUD.lastSync=Date.now(); CLOUD.lastError='';
    if(!silent) showInAppReminder('✅ Zsynchronizowano','Dane pobrane i scalone.');
  }catch(e){ if(netDown(e)){ CLOUD.pending=true; if(!silent) alert('Brak internetu. Dane są zapisane na telefonie — zsynchronizuję je, gdy wróci zasięg.'); }
    else { CLOUD.lastError=e.message; if(!silent) alert('Błąd synchronizacji: '+e.message); } }
  cloudBusy=false; saveCloud(); refreshCloudUI();
}
async function cloudTest(){
  if(!CLOUD.url){ alert('Wpisz URL skryptu.'); return; }
  refreshCloudUI('...test');
  try{
    const j=await cloudCall('ping', {});
    CLOUD.lastError=''; saveCloud(); refreshCloudUI(); setAdmin(!!j.admin);
    showInAppReminder('✅ Połączenie działa', 'Skrypt odpowiada poprawnie.');
  }catch(e){ CLOUD.lastError=e.message; saveCloud(); refreshCloudUI(); alert('Test nieudany: '+e.message); }
}
function isEditing(){
  const a=document.activeElement;
  if(!a) return false;
  const tag=a.tagName;
  return tag==='INPUT' || tag==='TEXTAREA' || tag==='SELECT' || a.isContentEditable;
}
function refreshAllViews(){
  // nie przerysowuj, gdy użytkownik właśnie coś wpisuje — inaczej straci focus i wpisywany tekst
  if(isEditing()){ pendingRefresh=true; return; }
  renderToday(); renderWeight(); renderShop();
  if(document.getElementById('coachDialog').classList.contains('show')) renderCoach();   // nowe wiadomości z innego urządzenia
}
let pendingRefresh=false;
// gdy użytkownik skończy edycję pola, dokończ odłożone przerysowanie
document.addEventListener('focusout', ()=>{
  setTimeout(()=>{ if(pendingRefresh && !isEditing()){ pendingRefresh=false; renderToday(); renderWeight(); renderShop(); } }, 150);
});

/* ============================================================
   SYNCHRONIZACJA / JSON (eksport, import ze scalaniem, plik na Dysku)
   ============================================================ */
const SCHEMA_VERSION=1;
let fileHandle=null;      // uchwyt do pliku JSON (File System Access API, desktop Chrome)
let fileWriteTimer=null;

// zbuduj obiekt eksportu
function buildExport(){
  return {app:"ZELAZO", schema:SCHEMA_VERSION, exportedAt:new Date().toISOString(), data:S};
}
// pobierz JSON jako plik
function exportJSON(){
  const blob=new Blob([JSON.stringify(buildExport(),null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download='zelazo-backup-'+todayISO()+'.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  S._lastExport=Date.now(); save(); refreshSyncUI();
}


// wczytaj plik i scal
function importJSONFromObject(obj, {silent}={}){
  const inc = (obj && obj.data) ? obj.data : obj; // akceptuj format z eksportu lub surowy stan
  if(!inc || typeof inc!=='object'){ if(!silent) alert('To nie wygląda na poprawną kopię ŻELAZO.'); return false; }
  const before={days:Object.keys(S.log||{}).length, w:(S.weights||[]).length};
  S=mergeState(S,normalizeIncoming(inc));
  save();
  const after={days:Object.keys(S.log||{}).length, w:(S.weights||[]).length};
  S._lastImport=Date.now(); save();
  // przerysuj wszystko (widok dnia zachowany przy cichym scalaniu)
  if(!silent) viewOffset=0;
  renderToday(); renderWeight(); renderShop(); refreshSyncUI();
  if(!silent){
    const newDays=after.days-before.days, newW=after.w-before.w;
    alert('Scalono ✅\nDni w planie: '+after.days+' (+'+newDays+')\nPomiary wagi: '+after.w+' (+'+newW+')');
  }
  return true;
}
function importJSONFile(file){
  const r=new FileReader();
  r.onload=()=>{ try{ importJSONFromObject(JSON.parse(r.result)); }catch(e){ alert('Nie udało się odczytać pliku: '+e.message); } };
  r.readAsText(file);
}

/* ---- File System Access API: „podłącz plik" (desktop Chrome/Edge) ---- */
const FS_SUPPORTED = ('showSaveFilePicker' in window) && ('showOpenFilePicker' in window);
async function linkNewFile(){
  try{
    fileHandle=await window.showSaveFilePicker({
      suggestedName:'zelazo-dane.json',
      types:[{description:'ŻELAZO dane',accept:{'application/json':['.json']}}]
    });
    await writeFile(); await persistHandle(); refreshSyncUI();
    alert('Plik podłączony ✅\nOd teraz każda zmiana zapisuje się automatycznie do tego pliku. Zapisz go w folderze Google Drive, a Drive zsynchronizuje go z innymi urządzeniami.');
  }catch(e){ if(e.name!=='AbortError') alert('Nie udało się: '+e.message); }
}
async function linkExistingFile(){
  try{
    const [h]=await window.showOpenFilePicker({types:[{description:'ŻELAZO dane',accept:{'application/json':['.json']}}]});
    fileHandle=h;
    const f=await h.getFile(); const txt=await f.text();
    if(txt.trim()) importJSONFromObject(JSON.parse(txt),{silent:true});
    await writeFile(); await persistHandle(); refreshSyncUI();
    alert('Plik podłączony i scalony ✅\nZmiany będą się zapisywać automatycznie.');
  }catch(e){ if(e.name!=='AbortError') alert('Nie udało się: '+e.message); }
}
async function writeFile(){
  if(!fileHandle) return;
  try{
    if(fileHandle.queryPermission){
      const p=await fileHandle.queryPermission({mode:'readwrite'});
      if(p!=='granted'){ const r=await fileHandle.requestPermission({mode:'readwrite'}); if(r!=='granted')return; }
    }
    const w=await fileHandle.createWritable();
    await w.write(JSON.stringify(buildExport(),null,2));
    await w.close();
    S._lastFileWrite=Date.now();
  }catch(e){ /* cicho — plik mógł zostać odłączony */ }
}
function scheduleFileWrite(){ clearTimeout(fileWriteTimer); fileWriteTimer=setTimeout(writeFile,600); }
function unlinkFile(){ fileHandle=null; delHandle(); refreshSyncUI(); }

// przechowanie uchwytu między sesjami (IndexedDB)
function idb(){ return new Promise((res,rej)=>{const r=indexedDB.open('zelazo_fs',1);r.onupgradeneeded=()=>r.result.createObjectStore('h');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);}); }
async function persistHandle(){ try{const db=await idb();db.transaction('h','readwrite').objectStore('h').put(fileHandle,'file');}catch(e){} }
async function delHandle(){ try{const db=await idb();db.transaction('h','readwrite').objectStore('h').delete('file');}catch(e){} }
async function restoreHandle(){
  if(!FS_SUPPORTED) return;
  try{
    const db=await idb();
    const h=await new Promise(r=>{const q=db.transaction('h').objectStore('h').get('file');q.onsuccess=()=>r(q.result);q.onerror=()=>r(null);});
    if(h){ fileHandle=h; refreshSyncUI(); }
  }catch(e){}
}
// najbliższy poniedziałek (dziś jeśli poniedziałek), jako dzień 1 = start treningów
function upcomingMondayISO(){
  const d=new Date();d.setHours(0,0,0,0);
  const day=d.getDay(); // 0=Nd..6=Sb
  const add=(day===1)?0:((8-day)%7||7); // dni do najbliższego poniedziałku
  d.setDate(d.getDate()+add);
  return todayISO(d);
}

// dzień planu (1-based) i tydzień dla danej daty
function dayIndexFor(dateISO){
  const start=parseISO(S.startDate); start.setHours(0,0,0,0);
  const d=parseISO(dateISO); d.setHours(0,0,0,0);
  return Math.floor((d-start)/86400000)+1; // 1 = dzień startu
}
function weekOf(dayIdx){return Math.floor((dayIdx-1)/7)+1}

// aktualnie oglądany dzień (offset od dziś)
let viewOffset=0;
function viewDateISO(){const d=new Date();d.setDate(d.getDate()+viewOffset);return todayISO(d)}
function dayKey(iso){return iso}

/* ============================================================
   RENDER — DZIŚ
   ============================================================ */
const DOW_PL=["Niedziela","Poniedziałek","Wtorek","Środa","Czwartek","Piątek","Sobota"];
const MON_PL=["sty","lut","mar","kwi","maj","cze","lip","sie","wrz","paź","lis","gru"];

function log(iso){ if(!S.log[iso]) S.log[iso]={meals:{},ex:{},habits:{},water:0}; return S.log[iso]; }

// postęp dnia do paska dnia i kropek na zakładkach
function daySummary(iso){
  const di=dayIndexFor(iso), L=S.log[iso]||{meals:{},ex:{}};
  const meals=Object.values(L.meals||{}).filter(Boolean).length;
  let w = (di>=1&&di<=168) ? workoutOn(iso) : REST;
  if(di===0) w=COOK; else if(di===-1) w=SHOP_DAY;
  if(w.type==='cardio'){ const d=!!(L.ex&&L.ex[iso+'_cardio']); return {train:'cardio '+(d?'✓':'<b>0/1</b>'), trainDone:d?1:0, trainAll:1, meals}; }
  if(w.type!=='lift') return {train:di<1?'przed startem':'odpoczynek', trainDone:0, trainAll:0, meals};
  const done=w.ex.filter((e0,i)=>okCount(L.ex&&L.ex[iso+'_e'+i], effEx(e0,iso).s)===effEx(e0,iso).s).length;
  return {train:'trening <b>'+done+'/'+w.ex.length+'</b>', trainDone:done, trainAll:w.ex.length, meals};
}
// karta „Gdzie jesteś w planie” w Postępie — zawsze dla dzisiejszego dnia
function renderPhaseCard(){
  const dayIdx=dayIndexFor(todayISO()), wk=weekOf(dayIdx);
  if(dayIdx<1){
    const stD=parseISO(S.startDate);
    document.getElementById('dayNum').textContent = dayIdx===0?'🍳':(dayIdx===-1?'🛒':'—');
    document.getElementById('phaseWeek').textContent = dayIdx===0?'jutro start':(dayIdx===-1?'pojutrze start':'przed startem');
    document.getElementById('phaseName').textContent = dayIdx===0?'Dziś gotujesz — przygotowanie':(dayIdx===-1?'Dziś zakupy — przygotowanie':('Plan startuje '+stD.getDate()+' '+MON_PL[stD.getMonth()]));
    document.getElementById('phaseBar').style.width='0%';
  } else if(dayIdx>168){
    document.getElementById('dayNum').textContent='✓';
    document.getElementById('phaseWeek').textContent='ukończono';
    document.getElementById('phaseName').textContent='6 miesięcy za Tobą — brawo!';
    document.getElementById('phaseBar').style.width='100%';
  } else {
    document.getElementById('dayNum').textContent=dayIdx;
    document.getElementById('phaseWeek').textContent='tydzień '+wk+'/24';
    document.getElementById('phaseName').textContent=phaseInfo(wk).name;
    document.getElementById('phaseBar').style.width=(dayIdx/168*100)+'%';
  }
}
/* ---- przesuwanie treningów ---- */
const DOW_SHORT=['Nd','Pn','Wt','Śr','Cz','Pt','Sb'];
const dmy=iso=>iso.slice(8,10)+'.'+iso.slice(5,7);
const dowOf=iso=>DOW_SHORT[parseISO(iso).getDay()];
const wIcon=w=>w.type==='lift'?'🏋️':w.type==='cardio'?'🏃':(w.ico||(w.active?'🚶':'😴'));
// czy w danym dniu coś już odhaczono (wtedy nie przesuwamy)
function dayStarted(iso){ const L=S.log[iso]; return !!(L && Object.values(L.ex||{}).some(exAny)); }
function canMove(iso, w, L){
  const di=dayIndexFor(iso);
  return di>=1 && di<=168 && iso>=todayISO() && (w.type==='lift'||w.type==='cardio') && !dayStarted(iso);
}
function movedBar(iso){
  const from=planSrc(iso); if(from===iso) return '';
  return `<div class="moved-bar"><span>↪ Z planu na ${dowOf(from)} ${dmy(from)}</span><button data-restore="${iso}">Przywróć</button></div>`;
}
// nowe przypisania: map[dzień] = dzień, którego OBECNY trening ma się tu odbyć
function nextMoves(map){
  const cur=(S.adj&&S.adj.moves)||{}, next=Object.assign({}, cur);
  Object.entries(map).forEach(([day, from])=>{ next[day]=cur[from]||from; });
  Object.keys(next).forEach(k=>{ if(next[k]===k) delete next[k]; });
  return next;
}
let mvUndoState=null, mvToastTimer=null;
function setMoves(next, msg){
  S.adj=S.adj||{};
  mvUndoState=JSON.stringify(S.adj.moves||{});
  S.adj.moves=next; S._settingsM=Date.now(); save(); renderToday();
  const t=document.getElementById('mvToast'); document.getElementById('mvToastTxt').textContent=msg; t.style.display='flex';
  clearTimeout(mvToastTimer); mvToastTimer=setTimeout(()=>{ t.style.display='none'; }, 6000);
}
document.getElementById('mvUndo').onclick=()=>{
  if(mvUndoState===null) return;
  S.adj.moves=JSON.parse(mvUndoState); mvUndoState=null; S._settingsM=Date.now(); save(); renderToday();
  document.getElementById('mvToast').style.display='none';
};
// „Przywróć”: wraca cała grupa dni, które wymieniły się treningami (para albo np. 3 dni od Trenera)
function restoreGroup(iso){
  const next=Object.assign({}, (S.adj&&S.adj.moves)||{}); let k=iso, n=0;
  while(next[k] && n++<14){ const f=next[k]; delete next[k]; k=f; }
  setMoves(next, 'Przywrócono plan z kalendarza');
}
function openMove(src){
  const w=workoutOn(src), today=todayISO();
  document.getElementById('mvSub').innerHTML=`<b>${esc(w.title)}</b> z dnia ${dowOf(src)} ${dmy(src)}. Wybierz dzień:`;
  let h='';
  for(let i=0;i<=7;i++){
    const k=addDays(today,i), di=dayIndexFor(k); if(k===src || di<1 || di>168) continue;
    const q=workoutOn(k), swap=q.type!=='rest', started=dayStarted(k);
    // podpowiedź: siłownia dzień obok
    const nb=[addDays(k,-1), addDays(k,1)].filter(x=>x!==src).some(x=>workoutOn(x).type==='lift');
    const warn= w.type==='lift' && nb ? '<span class="warn">⚠ Siłownia dzień obok — mniej regeneracji</span>' : '';
    h+=`<button class="mv-opt" data-to="${k}" ${started?'disabled style="opacity:.45"':''}>
      <span class="when"><b>${dowOf(k)} ${dmy(k)}</b><small>${i===0?'dziś':i===1?'jutro':'za '+i+' dni'}</small></span>
      <span class="what">${wIcon(q)} ${esc(q.title)}${swap?`<small>przejdzie na ${dowOf(src)} ${dmy(src)}</small>`:''}${started?'<small>już zacząłeś ten dzień</small>':''}${warn}</span>
      <span class="act ${swap?'swap':'move'}">${swap?'ZAMIEŃ':'PRZESUŃ'}</span></button>`;
  }
  const list=document.getElementById('mvList'); list.innerHTML=h||'<div class="md-hint">Brak dni, na które można przesunąć.</div>';
  list.querySelectorAll('[data-to]').forEach(b=>b.onclick=()=>{
    const to=b.dataset.to, swap=workoutOn(to).type!=='rest';
    document.getElementById('moveDialog').classList.remove('show');
    setMoves(nextMoves({[to]:src, [src]:to}), (swap?'Zamieniono':'Przesunięto')+`: ${dowOf(src)} ${dmy(src)} → ${dowOf(to)} ${dmy(to)}`);
    viewOffset=Math.round((parseISO(to)-parseISO(today))/864e5); renderToday();
  });
  document.getElementById('moveDialog').classList.add('show');
}
document.getElementById('mvCancel').onclick=()=>document.getElementById('moveDialog').classList.remove('show');
document.getElementById('moveDialog').addEventListener('click',e=>{ if(e.target.id==='moveDialog') e.currentTarget.classList.remove('show'); });
function bindMoveUi(card){
  card.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>openMove(b.dataset.move));
  card.querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>restoreGroup(b.dataset.restore));
}
// pasek tygodnia (pon–nd tygodnia oglądanego dnia)
function renderWeekStrip(iso){
  const d=parseISO(iso), mon=addDays(iso, -((d.getDay()+6)%7)), today=todayISO();
  let h='';
  for(let i=0;i<7;i++){
    const k=addDays(mon,i), di=dayIndexFor(k), w=(di>=1&&di<=168)?workoutOn(k):null;
    const L=S.log[k], done=!!(L && Object.values(L.ex||{}).some(exAny));
    h+=`<button class="wd ${k===today?'today':''} ${k===iso?'sel':''} ${k<today?'past':''}" data-wd="${k}" aria-label="${DOW_PL[parseISO(k).getDay()]} ${dmy(k)}${w?': '+w.title:''}">
      ${planSrc(k)!==k?'<span class="mv">↪</span>':''}${done?'<span class="ok">✓</span>':''}
      <span class="n">${dowOf(k)}</span><span class="ic">${w?wIcon(w):'·'}</span><span class="dt">${parseISO(k).getDate()}</span></button>`;
  }
  const box=document.getElementById('weekStrip'); box.innerHTML=h;
  box.querySelectorAll('[data-wd]').forEach(b=>b.onclick=()=>{ viewOffset=Math.round((parseISO(b.dataset.wd)-parseISO(today))/864e5); renderToday(); });
}

function renderToday(){
  exIdxCache=null; CYC=null;   // dane mogły przyjść z synchronizacji
  const iso=viewDateISO();
  const dObj=parseISO(iso);
  const dow=dObj.getDay();
  const dayIdx=dayIndexFor(iso);
  const wk=weekOf(dayIdx);
  const L=log(iso);

  // pasek dnia: dzień tygodnia + podsumowanie dnia (trening, posiłki)
  document.getElementById('dowName').innerHTML = DOW_PL[dow] + (viewOffset===0?' <span class="today-pill">DZIŚ</span>':'');
  const ds=daySummary(iso);
  document.getElementById('dateLabel').innerHTML = dObj.getDate()+' '+MON_PL[dObj.getMonth()]+' · '+ds.train+' · posiłki <b>'+ds.meals+'/4</b>';
  const mid=document.getElementById('dayMid');
  mid.textContent = viewOffset===0 ? 'DZIŚ' : '↩ DZIŚ';
  mid.setAttribute('aria-label', viewOffset===0 ? 'Dzisiaj' : 'Wróć do dzisiaj');
  mid.classList.toggle('away', viewOffset!==0);
  document.getElementById('dotTrain').className='nav-dot'+(ds.trainAll?(ds.trainDone>=ds.trainAll?' ok':' todo'):'');
  document.getElementById('dotDiet').className='nav-dot'+(ds.meals>=4?' ok':' todo');

  // faza: krótka linia w Treningu (oglądany dzień), karta w Postępie (dziś)
  document.getElementById('phaseLine').textContent = dayIdx<1 ? 'Przed startem planu' : dayIdx>168 ? 'Plan ukończony' : phaseInfo(wk).name+' · tydzień '+wk+'/24';
  renderPhaseCard();
  renderWeekStrip(iso);

  // ---- workout ----
  renderWorkout(iso, wk, dow, dayIdx, L);
  cyRenderBox(iso);
  // ---- meals ----
  renderMeals(iso, dow, L, wk);
  renderMealHabits();
  // ---- habits ----
  renderHabits(iso, dow, L);
  // ---- water ----
  renderWater(iso, L);

  updateStreak();
}

/* ---- zmiany planu zaakceptowane od Trenera ----
   S.adj.ex[nazwa] = [{from, w, s, rp}] — obowiązuje najnowszy wpis z from <= dzień; starsze dni bez zmian.
   S.adj.log = [{at, from, summary, ex:[...], kcal, prevKcal}] — historia, do cofnięcia. */
function exAdj(name, iso){
  const list=S.adj&&S.adj.ex&&S.adj.ex[name]; if(!list) return null;
  let r=null; list.forEach(x=>{ if(x.from<=iso && (!x.to || x.to>=iso) && (!r || x.from>=r.from)) r=x; }); return r;   // to: zamiana tylko na jeden dzień
}
// wymiana (swap) zapisana pod starą nazwą; późniejsze korekty nowego ćwiczenia — pod nową nazwą
function effEx(e, iso){
  let cur=e, a=exAdj(e.n, iso), guard=0;
  while(a && guard++<3){
    if(a.swap){
      cur=Object.assign({}, cur, {n:a.swap.n, s:a.s, rp:a.rp, r:a.r||String(a.rp), w:a.w||0, start:a.w>0?a.w+' kg'+(a.ph?'/rękę':''):'dobierz (RIR 2)', _adj:a, _from:cur._from||cur.n});
      const b=exAdj(cur.n, iso); a=(b && b!==a && b.from>=a.from) ? b : null;
    } else {
      cur=Object.assign({}, cur, {s:a.s, rp:a.rp, r:String(a.rp), w:a.w>0?a.w:cur.w, _adj:a}); a=null;
    }
  }
  // check-in „mocne zmęczenie”: dziś jedna seria mniej (minimum 2)
  const ci=S.log && S.log[iso] && S.log[iso].checkin;
  if(ci && ci.plan==='light2' && cur.s>2) cur=Object.assign({}, cur, {s:cur.s-1, _light:true});
  return cur;
}
function swapCue(name){
  const ex=(S.adj&&S.adj.ex)||{};
  for(const k in ex) for(const x of ex[k]) if(x.swap && x.swap.n===name && x.swap.cue) return x.swap.cue;
  return '';
}
/* ---- posiłki od Trenera: S.adj.meals=[{from, posilek, dni, opis, kcal, b, w, t, id}] ---- */
function mealAdj(iso, dow, tag){
  let r=null;
  ((S.adj&&S.adj.meals)||[]).forEach(m=>{ if(m.from<=iso && m.posilek===tag && (!m.dni.length||m.dni.includes(dow)) && (!r||m.from>=r.from)) r=m; });
  return r;
}
// posiłki dnia: podmienione stoją z wartościami od Trenera, reszta skaluje się do (cel − podmienione)
function dayMeals(iso, dow, L, wk, goalOverride){
  const diet=DIET[dow], goal=goalOverride||S.kcalGoal||DEFAULT_KCAL;
  const slots=diet.meals.map((slot,i)=>({slot, i, vi:variantIndex(L,i,wk), adj:mealAdj(iso,dow,slot.tag)}));
  let bk=0, bp=0, fixed=0, fixedP=0;
  slots.forEach(x=>{ if(x.adj){ fixed+=x.adj.kcal; fixedP+=x.adj.b||0; return; } const b=variantBase(x.slot.v[x.vi]); bk+=b.kcal; bp+=b.p; });
  const f=scaleFactors(Math.max(0,goal-fixed), {kcal:bk, p:bp}, fixed?Math.max(0,protFloor()-fixedP):undefined);
  slots.forEach(x=>{ x.mc = x.adj ? {txt:esc(x.adj.opis), kcal:x.adj.kcal, p:x.adj.b, c:x.adj.w, f:x.adj.t} : mealComputed(x.slot.v[x.vi], f); });
  return slots;
}

/* ---- progresja: ostatnia sesja tego samego ćwiczenia (po nazwie, także z poprzedniej fazy) ---- */
function prevSession(exName, iso){
  const d=parseISO(iso);
  for(let back=1; back<=42; back++){
    d.setDate(d.getDate()-1);
    const p=todayISO(d), di=dayIndexFor(p);
    if(di<1) break;
    const w=workoutOn(p);
    if(!w || w.type!=='lift') continue;
    const exs=w.ex.map(x=>effEx(x,p));   // po wymianie ćwiczenia historia idzie pod nową nazwą
    const idx=exs.findIndex(x=>x.n.trim()===exName.trim());
    if(idx<0) continue;
    const r=S.log[p] && S.log[p].ex && S.log[p].ex[p+'_e'+idx];
    if(!r || !r.sets || r.skip) continue;   // pominięte nie liczy się do progresji
    const sets=[], sp=swapSplit(exs[idx], p);
    for(let s=1; s<=exs[idx].s; s++){
      if(sp && s<sp.fromSet) continue;
      const kg=parseFloat(r.sets['w'+s]), rp=parseFloat(r.sets['r'+s]);
      if(rp>0 && setOk(r,s)) sets.push({kg:kg>0?kg:0, rp});   // tylko serie odhaczone
    }
    if(sets.length) return {iso:p, sets, phase3:!!w.phase3};
  }
  return null;
}
function progStep(e){
  if(/kettlebell/i.test(e.n+e.start)) return 4;
  if(/\/rękę|\/stronę|hantl/i.test(e.start+e.n)) return 2;
  if(/przysiad|martwy|RDL|suwnic|nóg|łydk|wspięcia|wypady|hack/i.test(e.n)) return 5;
  return 2.5;
}
/* ---- ciężary startowe dopasowane do użytkownika ----
   Plan jest pisany pod mężczyznę ~100 kg. Siła rośnie wolniej niż masa (≈ masa^0,67),
   kobiety: ~55% góry i ~70% dołu ciała w porównaniu z mężczyzną tej samej wagi, 55+ lat: −10%.
   Działa tylko, dopóki nie ma historii — potem pola biorą ostatni prawdziwy ciężar. */
const PLAN_REF_KG=100;
const isLowerEx=e=>/przysiad|martwy|RDL|suwnic|nóg|łydk|wspięcia|wypady|hack/i.test(e.n);
function strengthFactor(e){
  const p=S.profile||{};
  if(!(p.weight>=35)) return 1;
  let f=Math.pow(p.weight/PLAN_REF_KG,0.67);
  if(p.sex==='f') f*=isLowerEx(e)?0.7:0.55;
  if(p.age>=55) f*=0.9;
  // ±7% od profilu, pod który pisano plan — zostaw liczby z planu
  return (f>0.93&&f<1.07)?1:f;
}
function roundLoad(e, kg){
  const t=e.n+' '+(e.start||'');
  let step=2.5, min=2.5;
  // kolejność ma znaczenie: „/rękę” w starcie > maszyna > „hantl” w nazwie (np. „Przysiad z hantlami / Hack” = Hack)
  if(/\/rękę|\/stronę/i.test(e.start||'')){ step=kg<10?1:2; min=1; }
  else if(/kettlebell/i.test(t)){ step=4; min=4; }
  else if(/suwnic|hack|maszyn|siedząc/i.test(t)){ step=5; min=5; }
  else if(/hantl/i.test(t)){ step=kg<10?1:2; min=1; }
  else if(/przysiad ze sztangą|ławka płaska|w opadzie|żołnierskie|martwy|RDL/i.test(t)){ min=20; }   // pusta sztanga
  else if(/sztang/i.test(t)){ min=10; }   // gryf łamany / lżejsza sztanga
  else if(/wyciąg|drążk|bramie|allahy/i.test(t)){ min=5; }
  return Math.max(min, Math.round(kg/step)*step);
}
function scaledStart(e){
  if(!(e.w>0)) return e.w||0;
  const f=strengthFactor(e);
  return f===1 ? e.w : roundLoad(e, e.w*f);
}
function startLabel(e){
  if(!e.start) return '';
  const f=strengthFactor(e);
  if(f===1 || !(e.w>0)) return e.start;
  const kg=scaledStart(e);
  // podmień liczbę planu na dopasowaną, zostaw dopiski typu „/rękę”, „(Hack)”
  return e.start.replace(/\d+(?:[.,]\d+)?(?=\s*kg)/, String(kg).replace('.',','))+' · dopasowane do Ciebie';
}

// zwraca {kg: ciężar do wpisania w pola, hint: tekst podpowiedzi}
function progressionFor(e, iso, targetR, phase3){
  const prev=prevSession(e.n, iso);
  if(!prev) return null;
  const fmt=x=>String(Math.round(x*2)/2).replace('.',',');
  const lastKg=Math.max(...prev.sets.map(s=>s.kg));
  const when=prev.iso.slice(8,10)+'.'+prev.iso.slice(5,7);
  const was=prev.sets.map(s=>(s.kg?fmt(s.kg)+'×':'')+s.rp).join(', ')+(prev.sets.length<e.s?` (${prev.sets.length} z ${e.s} serii)`:'');
  const allHit=prev.sets.length>=e.s && prev.sets.every(s=>s.rp>=targetR);
  if(phase3 && !prev.phase3 && lastKg>0){
    const kg=Math.round(lastKg*0.9*2)/2;
    return {kg, hint:`Ostatnio (${when}): ${was}. Faza 3: start od ${fmt(kg)} kg (−10%), celuj w ${targetR} powt.`};
  }
  if(!lastKg){
    return {kg:0, hint:`Ostatnio (${when}): ${was}.`+(allHit?' Pełny zakres — dodaj 1–2 powtórzenia albo obciążenie.':'')};
  }
  if(allHit){
    const next=lastKg+progStep(e);
    return {kg:lastKg, up:true, hint:`Ostatnio (${when}): ${was}. Pełny zakres ✅ — dziś spróbuj ${fmt(next)} kg (wpisz w pola).`};
  }
  return {kg:lastKg, hint:`Ostatnio (${when}): ${was}. Zostań przy ${fmt(lastKg)} kg i celuj w ${targetR} powt. w każdej serii.`};
}

/* ---- serie odhaczane pojedynczo: L.ex[k].ok = {1:true, 3:true}; done = wszystkie serie odhaczone ----
   stare wpisy bez „ok”: zaliczone ćwiczenie = wszystkie serie, inaczej liczą się zapisane serie (jak dotąd) */
function setOk(r, s){
  if(!r || typeof r!=='object') return false;
  if(r.done) return true;
  if(r.ok) return !!r.ok[s];
  return !!(r.sets && r.sets['r'+s]!==undefined && r.sets['r'+s]!=='');
}
function okCount(r, n){ let c=0; for(let s=1;s<=n;s++) if(setOk(r,s)) c++; return c; }
function exAny(v){ return v===true || !!(v && (v.done || (v.ok && Object.values(v.ok).some(Boolean)))); }
// wpis ćwiczenia z jawną mapą „ok” (stary wpis przepisany tak, jak był liczony)
function exRec(L, k, n){
  let r=L.ex[k];
  if(!r || typeof r!=='object') r=L.ex[k]={done:false,sets:{}};
  if(!r.sets) r.sets={};
  if(!r.ok){ r.ok={}; for(let s=1;s<=n;s++) if(setOk(r,s)) r.ok[s]=true; }
  return r;
}
// odhacz / cofnij serię s; przy odhaczeniu utrwal to, co widać w polach (rVal — czas z timera)
function exTick(L, k, n, s, on, rVal){
  const r=exRec(L,k,n);
  if(on){
    ['w','r'].forEach(f=>{ const inp=document.querySelector(`.set input[data-k="${k}"][data-s="${f}${s}"]`); if(inp && inp.value!=='') r.sets[f+s]=inp.value; });
    if(rVal!==undefined) r.sets['r'+s]=String(rVal);
    r.ok[s]=true;
    r.skip=false; mark(L,'skip:'+k);   // odhaczenie na innym urządzeniu wygrywa ze starszym „Pomiń”
  } else delete r.ok[s];
  r.done=false; r.done=okCount(r,n)===n;
  mark(L,'ok:'+k+':'+s); mark(L,'ex:'+k);
}

/* ---- timer ćwiczeń na czas: „40 s”, „30 s/stronę” (lewa + prawa), „max czas” (stoper w górę) ---- */
function timedSpec(e, e0){
  const txt=((e._adj && !e._adj.swap) ? e0.r : e.r)||'';   // korekta Trenera zapisuje r jako samą liczbę — rodzaj bierzemy z planu
  const m=/(\d+)\s*s\b/.exec(txt);
  if(m) return {secs:(e._adj&&e.rp>0)?e.rp:+m[1], sides:/stron/.test(txt)?2:1, up:false};
  if(/czas/.test(txt)) return {secs:0, sides:1, up:true};
  return null;
}
const TMR={};   // klucz ćwiczenia → stan timera; przeżywa ponowne renderowanie karty
let tmrTick=null, tmrAudio=null, tmrWake=null;
const TMR_PLAY='<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>';
const TMR_PAUSE='<svg viewBox="0 0 24 24"><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></svg>';
const TMR_RESET='<svg viewBox="0 0 24 24"><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3.5 4v5h5"/></svg>';
function fmtSec(t, up){ t=Math.max(0, up?Math.floor(t):Math.ceil(t)); return Math.floor(t/60)+':'+String(t%60).padStart(2,'0'); }
function tmrBeep(f, d){
  try{ const a=tmrAudio; if(!a) return; const o=a.createOscillator(), g=a.createGain();
    o.frequency.value=f; o.connect(g); g.connect(a.destination);
    g.gain.setValueAtTime(.25,a.currentTime); g.gain.exponentialRampToValueAtTime(.001,a.currentTime+d);
    o.start(); o.stop(a.currentTime+d); }catch(e){}
}
function tmrBuzz(p){ try{ navigator.vibrate && navigator.vibrate(p); }catch(e){} }
// stan dla ćwiczenia; bieżąca seria = pierwsza nieodhaczona
function tmrState(key, spec, n, r, iso){
  let first=1; while(first<=n && setOk(r,first)) first++;
  let t=TMR[key];
  if(!t || t.secs!==spec.secs || t.n!==n) t=TMR[key]=Object.assign({}, spec, {n, iso, set:first, side:1, left:spec.secs, el:0, run:false});
  else if(!t.run && t.set!==first){ t.set=first; t.side=1; t.left=t.secs; t.el=0; }
  return t;
}
function tmrBox(key){ return document.querySelector(`.tmr[data-tmr="${key}"]`); }
function tmrPaint(key){
  const t=TMR[key], box=tmrBox(key); if(!t||!box) return;
  const all=t.set>t.n;
  let lbl = all ? 'Wszystkie serie zrobione 💪' : `Seria ${t.set} z ${t.n}`;
  if(!all && t.sides>1) lbl+= t.side===1?' · lewa strona':' · prawa strona';
  if(!all && t.up) lbl+=' · trzymaj, ile dasz radę';
  box.querySelector('.time').textContent = t.up ? fmtSec(t.el, true) : fmtSec(t.left);
  box.querySelector('.lbl').textContent = lbl;
  box.querySelector('.bar').style.width = (t.up||!t.secs) ? '0' : ((1-t.left/t.secs)*100)+'%';
  const go=box.querySelector('.go'); go.innerHTML=t.run?TMR_PAUSE:TMR_PLAY; go.setAttribute('aria-label', t.run?'Pauza':'Start');
  box.classList.toggle('run', t.run);
}
// koniec odliczania = bieżąca seria odhaczona z tym czasem
function tmrFinish(key){
  const t=TMR[key]; t.run=false;
  tmrBeep(880,.35); setTimeout(()=>tmrBeep(1175,.5),180); tmrBuzz([200,100,200]);
  let secs=null;
  if(t.up){ secs=Math.round(t.el); t.el=0; }
  else if(t.sides>1 && t.side===1){ t.side=2; }
  else { secs=t.secs; t.side=1; }
  t.left=t.secs;
  if(secs!==null){ const L=log(t.iso); exTick(L, key, t.n, t.set, true, secs); touch(L); save(); renderToday(); }
  const box=tmrBox(key); if(box){ box.classList.remove('end'); void box.offsetWidth; box.classList.add('end'); }
  tmrPaint(key);
}
function tmrStep(){
  const now=Date.now();
  Object.keys(TMR).forEach(key=>{
    const t=TMR[key]; if(!t.run) return;
    if(t.up) t.el=(now-t.startAt)/1000;
    else{
      const prev=Math.ceil(t.left); t.left=(t.endAt-now)/1000;
      if(t.left<=0){ t.left=0; tmrFinish(key); return; }
      if(Math.ceil(t.left)!==prev && t.left<=3) tmrBeep(660,.12);   // 3-2-1
    }
    tmrPaint(key);
  });
  tmrSync();
}
// jeden zegar dla wszystkich timerów; ekran nie gaśnie, dopóki coś odlicza
function tmrSync(){
  const any=Object.values(TMR).some(t=>t.run);
  if(any && !tmrTick) tmrTick=setInterval(tmrStep,100);
  if(!any && tmrTick){ clearInterval(tmrTick); tmrTick=null; }
  if(any && !tmrWake && navigator.wakeLock){
    tmrWake=navigator.wakeLock.request('screen').then(w=>{ w.addEventListener('release',()=>{ tmrWake=null; }); return w; }).catch(()=>{ tmrWake=null; });
  }
  if(!any && tmrWake){ Promise.resolve(tmrWake).then(w=>w&&w.release()).catch(()=>{}); tmrWake=null; }
}
document.addEventListener('visibilitychange',()=>{ if(!document.hidden){ tmrStep(); } });
function tmrGo(key){
  const t=TMR[key]; if(!t) return;
  try{ tmrAudio=tmrAudio||new (window.AudioContext||window.webkitAudioContext)(); tmrAudio.resume&&tmrAudio.resume(); }catch(e){}
  if(t.set>t.n){ t.set=1; t.side=1; t.left=t.secs; t.el=0; }   // po wszystkich seriach: odliczaj od nowa
  if(t.run){
    t.run=false;
    if(t.up){ t.el=(Date.now()-t.startAt)/1000; if(t.el>=1) tmrFinish(key); else t.el=0; }   // stoper: pauza kończy serię i zapisuje czas
    else t.left=Math.max(0,(t.endAt-Date.now())/1000);
  } else {
    t.run=true; const box=tmrBox(key); if(box) box.classList.remove('end');
    t.endAt=Date.now()+t.left*1000; t.startAt=Date.now()-t.el*1000; tmrBuzz(30);
  }
  tmrPaint(key); tmrSync();
}
function tmrReset(key){
  const t=TMR[key]; if(!t) return;
  t.run=false; t.left=t.secs; t.el=0;
  const box=tmrBox(key); if(box) box.classList.remove('end');
  tmrPaint(key); tmrSync();
}
function tmrDrop(key){ if(TMR[key]){ delete TMR[key]; tmrSync(); } }
function timerHtml(key){
  return `<div class="tmr" data-tmr="${key}"><button class="go" aria-label="Start">${TMR_PLAY}</button>
    <div class="mid"><div class="time"></div><div class="lbl"></div></div>
    <button class="rst" aria-label="Reset">${TMR_RESET}</button><div class="bar"></div></div>`;
}

function renderWorkout(iso, wk, dow, dayIdx, L){
  const card=document.getElementById('workoutCard');
  let w = (dayIdx>=1 && dayIdx<=168) ? workoutOn(iso) : REST;
  // weekend TUŻ PRZED startem: sobota = zakupy, niedziela = gotowanie (dzień -1 i 0)
  if(dayIdx===0) w=COOK;        // niedziela przed startem
  else if(dayIdx===-1) w=SHOP_DAY; // sobota przed startem

  const mvBar=movedBar(iso), mvBtn=canMove(iso, w, L) ? `<button class="move-btn" data-move="${iso}" aria-label="Przesuń trening na inny dzień"><svg viewBox="0 0 24 24"><path d="M4 12h14M13 6l6 6-6 6"/></svg>Przesuń</button>` : '';
  if(w.type==='rest'){
    card.innerHTML=`<div class="restday">${mvBar}
      <div class="ico">${w.ico||(w.active?'🚶':'😴')}</div>
      <h3>${w.title}</h3>
      <p>${w.note||'Dziś regenerujesz się. Mięśnie rosną w odpoczynku — śpij 7–8 h i pij wodę.'}</p>
      <button class="go-diet" data-go-diet>Zobacz dietę na ten dzień →</button>
    </div>`;
    card.querySelector('[data-go-diet]').onclick=()=>showView('diet');
    bindMoveUi(card);
    return;
  }
  if(w.type==='cardio'){
    const done=!!L.ex[iso+'_cardio'];
    card.innerHTML=`${mvBar}
      <div class="wk-head"><span class="badge cardio">CARDIO</span><span class="t">${w.title}</span>${mvBtn}</div>
      <div class="ex ${done?'done':''}">
        <div class="ex-sub" style="margin-left:0;font-size:13px;color:var(--ink-dim)">${w.note}</div>
        <div class="ex-check" style="margin-left:0" data-cardio="1">
          <span class="mini ${done?'on':''}"><svg viewBox="0 0 24 24"><path d="M4 12l5 5L20 6"/></svg></span>
          <span>${done?'Zrobione — dobra robota':'Odznacz po sesji'}</span>
        </div>
      </div>`;
    card.querySelector('[data-cardio]').onclick=()=>{L.ex[iso+'_cardio']=!L.ex[iso+'_cardio'];mark(L,'ex:'+iso+'_cardio');touch(L);save();renderToday()};
    bindMoveUi(card);
    return;
  }

  // lifting
  let badge = w.title.split(' ')[0]; // FBW / UPPER / LOWER
  let html=`${mvBar}<div class="wk-head"><span class="badge">${badge}</span><span class="t">${w.title}</span>${mvBtn}</div>`;
  // tryb treningu: tylko dziś; po zapisanej sesji krótkie podsumowanie
  // stara sesja nadpisana przez „Wznów” (sprzed zapisywania listy serii): odtwórz cały trening z godzin odhaczenia
  if(hasSession(L) && !L.session.log && iso>=addDays(todayISO(),-7)){ const rs=woRebuildSession(iso); if(rs){ L.session=rs; touch(L); save(); } }
  if(L.checkin) html+=ciChip(L, iso);
  if(hasSession(L)) html+=`<div class="wo-saved">⏱ ${fmtDur(L.session.dur)} · praca ${fmtDur(L.session.work)} · przerwy śr. ${fmtDur(L.session.avgRest)}${L.session.avgRestPlan?' (plan '+fmtDur(L.session.avgRestPlan)+')':''} · serie ${L.session.done}/${L.session.total}${L.session.paused-(L.session.gap||0)>0?' · pauzy '+fmtDur(L.session.paused-(L.session.gap||0)):''}${L.session.parts>1?' · dokończony po przerwie '+fmtDur(L.session.gap):''}${(L.session.prs||[]).length?' · 🏆 rekordy: '+L.session.prs.length:''}</div>`;
  const allDone=w.ex.every((e0,i)=>okCount(L.ex[iso+'_e'+i], effEx(e0,iso).s)===effEx(e0,iso).s);
  // przyszły (do 7 dni) albo pominięty (ostatnie 7 dni, nic nieodhaczone) trening: zamień z dzisiejszym dniem i od razu zacznij
  const tdy=todayISO(), missed=iso<tdy;
  const nearby= missed ? iso>=addDays(tdy,-7) : (iso>tdy && iso<=addDays(tdy,7));
  if(nearby && dayIdx>=1 && !dayStarted(iso) && !dayStarted(tdy) && dayIndexFor(tdy)>=1){
    if(missed) html+=`<div class="wo-saved">Ten trening nie został zrobiony. Możesz go odrobić dziś zamiast dzisiejszego planu (${esc(workoutOn(tdy).title)}).</div>`;
    html+=`<button class="wo-start" data-wo-today><svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>ZACZNIJ DZIŚ</button>`;
  }
  if(iso===todayISO() && !allDone && L.checkin && L.checkin.plan==='move') html+=cyMoveHtml();
  else if(iso===todayISO() && !allDone) html+=`<div class="wo-row"><button class="wo-start" data-wo-start><svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>${woStartLabel(iso,w,L)}</button>${woCanReset(iso,w,L)?`<button class="wo-reset" data-wo-reset aria-label="Resetuj dzisiejszy trening"><svg viewBox="0 0 24 24"><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3.5 4v5h5"/></svg></button>`:''}</div>${hasSession(L)&&!(WO&&WO.iso===iso)?`<div class="wo-cont">Czas liczy się dalej od ${fmtDur(L.session.dur)} — przerwa do teraz się nie wlicza.</div>`:''}`;
  w.ex.forEach((e0,i)=>{
    const e=effEx(e0, iso);   // zmiany od Trenera (zaakceptowane) obowiązują od swojej daty
    const key=iso+'_e'+i;
    const rec=L.ex[key];
    const nOk=okCount(rec, e.s), exDone=nOk===e.s;
    const exSkip=!exDone && !!(rec && rec.skip);
    const sets=(rec&&rec.sets)||{};
    let first=1; while(first<=e.s && setOk(rec,first)) first++;
    const ts=timedSpec(e, e0);
    const bw=!!ts && /masa ciała/.test(e.start||'') && !(e._adj && e._adj.w>0);   // na czas bez obciążenia: same sekundy
    // zalecane wartości (prefill). Faza 3: ciężar −10%, powtórzenia +3 (czas zostaje jak w planie)
    // ciężar od Trenera jest już dopasowany do osoby — nie skaluj go ponownie
    let recW = (e._adj && e._adj.w>0) ? e._adj.w : scaledStart(e), recR = e.rp||0;
    if(w.phase3 && !e._adj){ recW = Math.round((recW*0.9)*2)/2; if(!ts) recR = recR+3; }
    // z historii: ostatni faktyczny ciężar zamiast sztywnego startu z planu
    let prog=progressionFor(e, iso, recR, !!w.phase3 && !e._adj);
    if(e._adj){
      // dopóki nie ma sesji od dnia zmiany, obowiązuje to, co zaakceptowałeś od Trenera
      const prev=prevSession(e.n, iso);
      if(!prev || prev.iso < e._adj.from){
        const fmt=x=>String(x).replace('.',',');
        const who=e._adj.user?(e._adj.to?'Zamiana na dziś':`Twoja zamiana (od ${e._adj.from.slice(8,10)}.${e._adj.from.slice(5,7)})`):`Trener (od ${e._adj.from.slice(8,10)}.${e._adj.from.slice(5,7)})`, was=e._adj.was||e._from;
        prog={kg:e._adj.w, up:true, hint:`${who}${was?' zamiast „'+was+'”':''}: ${e._adj.w>0?fmt(e._adj.w)+' kg'+(e._adj.ph?'/rękę':'')+' · ':''}${e.s}×${e.r==='max'?'max':e.rp}`};
      }
    }
    if(prog && prog.kg>0) recW=prog.kg;
    if(ciLight(L) && recW>0) recW=roundLoad(e, recW*0.9);   // lżejszy dzień z check-inu
    const recWtxt = recW>0 ? String(recW) : '';
    let setsHtml='';
    for(let s=1;s<=e.s;s++){
      // jeśli użytkownik coś zapisał — użyj tego; inaczej wstępnie wypełnij zaleceniem
      const savedW=sets['w'+s], savedR=sets['r'+s];
      const wv = (savedW!==undefined && savedW!=='') ? savedW : recWtxt;
      const rv = (savedR!==undefined && savedR!=='') ? savedR : (recR||'');
      const ok=setOk(rec,s), isCur=!exDone && s===first, st=ts?5:1;
      setsHtml+=`<div class="set-row ${ok?'ok':''} ${isCur?'cur':''}">
        <button class="set-chk" data-tick="${s}" aria-pressed="${ok}" aria-label="Seria ${s} ${ok?'zrobiona — cofnij':'zrobiona'}"><svg viewBox="0 0 24 24"><path d="M4 12l5 5L20 6"/></svg></button>
        <div class="set">
          <span class="si">${s}</span>
          ${bw?'':`<input type="number" inputmode="decimal" placeholder="kg" value="${wv}" data-k="${key}" data-s="w${s}" aria-label="Ciężar serii ${s}"><span class="u">kg</span>
          <span class="x">×</span>`}
          <input type="number" inputmode="numeric" placeholder="${ts?'s':'powt'}" value="${rv}" data-k="${key}" data-s="r${s}" aria-label="${ts?'Sekundy':'Powtórzenia'} serii ${s}"><span class="u">${ts?'s':'p'}</span>
        </div>
        ${isCur?`<div class="set-step"><button data-step="${-st}" data-s="${s}" aria-label="Mniej">−</button><button data-step="${st}" data-s="${s}" aria-label="Więcej">+</button></div>`:''}
      </div>`;
    }
    if(ts && !exSkip) tmrState(key, ts, e.s, rec, iso);
    html+=`<div class="ex ${exDone?'done':''} ${exSkip?'skipped':''}" data-k="${key}" data-n="${e.s}">
      <div class="ex-top">
        <span class="num">${i+1}</span>
        <span class="nm">${e.n}</span>
        ${!exDone && !exSkip && iso>=todayISO() && swapAlts(e.n).length?`<button class="show-btn sw-btn" data-swap="${i}" aria-label="Zamień ćwiczenie">⇄</button>`:''}
        <button class="show-btn" data-guide="${encodeURIComponent(e.n)}">Pokaż</button>
        <span class="scheme">${e.s}×${e.r}</span>
      </div>
      ${exSkip?'':`${prog?`<div class="ex-sub" style="color:${prog.up?'var(--amber)':'var(--ink-dim)'}">${prog.up?'⬆ ':''}${prog.hint}</div>`
            :(e.start?`<div class="ex-sub">Start: ${startLabel(e)}</div>`:'')}
      ${swapNote(e, iso, rec)}
      ${exHistBtn(e.n, iso)}
      ${ts && !exDone?timerHtml(key):''}
      <div class="sets per-set">${setsHtml}</div>`}
      <div class="ex-acts">
        ${exSkip?`<span class="ex-check">Pominięte dziś</span>
        <button class="skip-btn" data-skip="${key}">Cofnij</button>`
        :exDone?`<span class="ex-status">✓ Ćwiczenie zaliczone</span>
        <button class="link-btn" data-untick="${key}">Cofnij serie</button>`
        :`${nOk?`<span class="ex-count">${nOk} z ${e.s} serii</span>`:''}
        <button class="all-btn" data-all="${key}">✓ ${nOk?`Pozostałe ${e.s-nOk} wg planu`:'Wszystkie serie wg planu'}</button>
        ${nOk?'':`<button class="skip-btn" data-skip="${key}">Pomiń</button>`}`}
      </div>
    </div>`;
  });
  html+=`<button class="link-btn rest-link" data-rest-list>⏱ Przerwy między seriami — Twoje ustawienia</button>`;
  // tip per phase
  if(w.phase3){
    html+=`<div class="tip"><span>⚡</span><div><b>Faza 3.</b> Zmniejsz ciężar o 10%, dodaj 2–4 powtórzenia. Po sztandze 20 min rowerka/orbitreka.</div></div>`;
  } else {
    html+=`<div class="tip"><span>⚡</span><div><b>RIR 2.</b> Dobierz ciężar tak, by zostały Ci ~2 powtórzenia w zapasie. Pobiłeś górny zakres? Następnym razem +1–2.5 kg.</div></div>`;
  }
  card.innerHTML=html;
  bindMoveUi(card);
  const ws=card.querySelector('[data-wo-start]'); if(ws) ws.onclick=()=>ciStartOrAsk(iso);
  const cic=card.querySelector('[data-ci-edit]'); if(cic) cic.onclick=()=>openCheckin(iso, 'edit');
  const cyt=card.querySelector('[data-cytrain]'); if(cyt) cyt.onclick=()=>{ L.checkin=Object.assign({}, L.checkin, {plan:'normal', at:Date.now()}); touch(L); save(); renderToday(); woStart(iso); };
  const wr=card.querySelector('[data-wo-reset]'); if(wr) wr.onclick=()=>woResetAsk(iso);
  const wt=card.querySelector('[data-wo-today]'); if(wt) wt.onclick=()=>startToday(iso);
  card.querySelectorAll('[data-hist]').forEach(b=>b.onclick=()=>openExHist(decodeURIComponent(b.dataset.hist)));
  card.querySelectorAll('[data-swap]').forEach(b=>b.onclick=()=>openSwap(iso, +b.dataset.swap));
  card.querySelectorAll('[data-rest-list]').forEach(b=>b.onclick=()=>openRestList(iso));
  card.querySelectorAll('[data-swap-undo]').forEach(b=>b.onclick=()=>swapUndo(+b.dataset.swapUndo, iso));

  // bind inputs
  const exOf=el=>{ const x=el.closest('.ex'); return {k:x.dataset.k, n:+x.dataset.n}; };
  card.querySelectorAll('.set input').forEach(inp=>{
    inp.addEventListener('input',()=>{
      const {k,n}=exOf(inp), s=inp.dataset.s, r=exRec(L,k,n);
      r.sets[s]=inp.value;
      // ciężar przechodzi na nieodhaczone serie niżej
      if(s[0]==='w') for(let j=+s.slice(1)+1;j<=n;j++){
        if(r.ok[j]) continue;
        const el=card.querySelector(`.set input[data-k="${k}"][data-s="w${j}"]`);
        if(el){ el.value=inp.value; r.sets['w'+j]=inp.value; }
      }
      touch(L);save();
    });
  });
  card.querySelectorAll('[data-step]').forEach(b=>{
    b.onclick=()=>{
      const {k,n}=exOf(b), s=b.dataset.s, r=exRec(L,k,n);
      const inp=card.querySelector(`.set input[data-k="${k}"][data-s="r${s}"]`); if(!inp) return;
      inp.value=Math.max(0,(+inp.value||0)+(+b.dataset.step));
      r.sets['r'+s]=inp.value; touch(L);save();
    };
  });
  card.querySelectorAll('[data-tick]').forEach(b=>{
    b.onclick=()=>{
      const {k,n}=exOf(b), s=+b.dataset.tick, on=!setOk(L.ex[k],s);
      exTick(L,k,n,s,on); if(on) tmrBuzz(20);
      touch(L);save();renderToday();
    };
  });
  card.querySelectorAll('[data-all]').forEach(b=>{
    b.onclick=()=>{
      const {k,n}=exOf(b);
      for(let s=1;s<=n;s++) if(!setOk(L.ex[k],s)) exTick(L,k,n,s,true);
      tmrDrop(k); tmrBuzz(20);
      touch(L);save();renderToday();
    };
  });
  card.querySelectorAll('[data-untick]').forEach(b=>{
    b.onclick=()=>{
      const {k,n}=exOf(b);
      for(let s=1;s<=n;s++) exTick(L,k,n,s,false);
      touch(L);save();renderToday();
    };
  });
  card.querySelectorAll('.tmr').forEach(box=>{
    const k=box.dataset.tmr;
    box.querySelector('.go').onclick=()=>tmrGo(k);
    box.querySelector('.rst').onclick=()=>tmrReset(k);
    tmrPaint(k);
  });
  card.querySelectorAll('[data-skip]').forEach(el=>{
    el.onclick=()=>{
      const k=el.dataset.skip;
      if(!L.ex[k])L.ex[k]={done:false,sets:{}};
      L.ex[k].skip=!L.ex[k].skip;
      L.ex[k].done=false;
      tmrDrop(k);
      mark(L,'skip:'+k);mark(L,'ex:'+k);touch(L);save();renderToday();
    };
  });
  card.querySelectorAll('[data-guide]').forEach(el=>{
    el.onclick=(e)=>{e.stopPropagation();openGuide(decodeURIComponent(el.dataset.guide));};
  });
}

// który wariant posiłku jest aktywny danego dnia: override użytkownika albo auto wg tygodnia
function variantIndex(L, mealIdx, wk){
  if(L.var && L.var[mealIdx]!==undefined) return L.var[mealIdx];
  const w = (wk>=1) ? wk : 1;
  return autoVariant(w);
}

/* ============================================================
   SKALOWANIE POSIŁKÓW DO CELU KALORYCZNEGO (z ochroną białka)
   ============================================================ */
// g białka — poniżej tego nie schodzimy skalując: ~2 g/kg masy ciała, maks. 180 g (plan pisany pod 100+ kg)
function protFloor(){
  const w=S&&S.profile&&S.profile.weight;
  return (w>=35) ? Math.max(100, Math.min(180, Math.round(2*w/5)*5)) : 180;
}

// suma bazowych kalorii i białka dnia dla aktywnych wariantów (z gramatur składników)
function dayBase(dow, L, wk){
  const diet=DIET[dow]; let kcal=0,p=0;
  diet.meals.forEach((slot,i)=>{
    let vi; if(L&&L.var&&L.var[i]!==undefined) vi=L.var[i]; else vi=(wk>=1?autoVariant(wk):0);
    const b=variantBase(slot.v[vi]); kcal+=b.kcal; p+=b.p;
  });
  return {kcal,p};
}
// współczynniki skalowania: białko chronione, węgle/tłuszcz absorbują różnicę
// floor: ile białka mają dać skalowane posiłki (domyślnie cały dzienny próg; mniej, gdy część dnia to posiłki od Trenera)
function scaleFactors(goalKcal, base, floor){
  if(!base.kcal) return {fProt:1,fCF:1};
  const pf = (floor===undefined) ? protFloor() : floor;
  const targetProt = Math.max(Math.min(base.p, pf), goalKcal>=base.kcal ? base.p : Math.min(base.p, pf));
  const fProt = base.p ? targetProt/base.p : 1;
  const protKcal = base.p*4*fProt;
  const restBaseKcal = base.kcal - base.p*4;
  const restTargetKcal = Math.max(0, goalKcal - protKcal);
  const fCF = restBaseKcal>0 ? restTargetKcal/restBaseKcal : 1;
  return {fProt, fCF:Math.max(0.4, Math.min(1.8, fCF))};
}

function renderMeals(iso, dow, L, wk){
  const diet=DIET[dow];
  const card=document.getElementById('mealsCard');
  const goal=S.kcalGoal||DEFAULT_KCAL;
  const dm=dayMeals(iso, dow, L, wk);
  let done=0, tot={kcal:0,p:0,c:0,f:0};
  let html='';
  diet.meals.forEach((slot,i)=>{
    const vi=dm[i].vi, madj=dm[i].adj;
    const mc=dm[i].mc;               // kcal, makra i opis z tych samych (skalowanych) gramatur; posiłek od Trenera — jego wartości
    const key='m'+i, on=!!L.meals[key];
    if(on){done++;tot.kcal+=mc.kcal;tot.p+=mc.p;tot.c+=mc.c;tot.f+=mc.f;}
    const isAuto = !(L.var && L.var[i]!==undefined);
    const dots=madj?'<span class="vman">od Trenera</span>':slot.v.map((_,vx)=>`<button class="vdot ${vx===vi?'on':''}" data-vpick="${i}" data-vx="${vx}" title="Wariant ${vx+1}">${vx+1}</button>`).join('');
    html+=`<div class="meal ${on?'done':''}">
      <div class="check ${on?'on':''}" data-meal="${key}"><svg viewBox="0 0 24 24"><path d="M4 12l5 5L20 6"/></svg></div>
      <div class="body">
        <div class="meal-head">
          <span class="tag">${slot.tag}</span>
          <span class="vdots">${dots}</span>
        </div>
        <div class="txt" data-meal="${key}">${mc.txt}</div>
        <div class="kcal">${mc.kcal} kcal · B ${mc.p} / W ${mc.c} / T ${mc.f}${(isAuto||madj)?'':' · <span class="vman">ręczny wariant</span>'}</div>
        ${mtStampHtml(iso, L, key, on)}${mtAskHtml(iso, key, slot.tag)}
      </div>
    </div>`;
  });
  // --- własne posiłki (dodane ręcznie) ---
  const customs=(L.custom||[]);
  customs.forEach((cm,ci)=>{
    if(cm._del) return; // usunięty (tombstone) — nie pokazuj
    const on=cm.done!==false; // domyślnie policzony po dodaniu
    if(on){done++;tot.kcal+=cm.kcal||0;tot.p+=cm.p||0;tot.c+=cm.c||0;tot.f+=cm.f||0;}
    html+=`<div class="meal ${on?'done':''}">
      <div class="check ${on?'on':''}" data-custom="${ci}"><svg viewBox="0 0 24 24"><path d="M4 12l5 5L20 6"/></svg></div>
      <div class="body">
        <div class="meal-head">
          <span class="tag" style="color:var(--steel)">Własny</span>
          <button class="vdot" data-cdel="${ci}" title="Usuń" style="color:var(--red);border-color:rgba(226,84,58,.35)">✕</button>
        </div>
        <div class="txt" data-custom="${ci}">${cm.txt||'Posiłek'}</div>
        <div class="kcal">${cm.kcal||0} kcal${(cm.p||cm.c||cm.f)?` · B ${cm.p||0} / W ${cm.c||0} / T ${cm.f||0}`:''}</div>
        ${on?mtStampCustom(iso, cm):''}
      </div>
    </div>`;
  });
  // --- przycisk dodania ---
  html+=`<div class="add-row">
    <button class="add-btn" id="addMealBtn"><span>＋</span> Dodaj posiłek</button>
    <div class="add-kcal">
      <input type="number" inputmode="numeric" id="quickKcal" placeholder="kcal">
      <button class="add-btn alt" id="addKcalBtn">Dodaj kalorie</button>
    </div>
  </div>`;

  card.innerHTML=mtCloseHtml(iso, L, dow)+html;
  mtBind(card, iso, L, dow);
  card.querySelectorAll('[data-meal]').forEach(el=>{
    el.onclick=()=>{const k=el.dataset.meal;L.meals[k]=!L.meals[k];mark(L,'meal:'+k);mtOnCheck(iso, L, k, dow);save();renderToday()};
  });
  card.querySelectorAll('[data-vpick]').forEach(el=>{
    el.onclick=(e)=>{e.stopPropagation();const mi=+el.dataset.vpick, vx=+el.dataset.vx;if(!L.var)L.var={};L.var[mi]=vx;mark(L,'var:'+mi);save();renderToday();};
  });
  card.querySelectorAll('[data-custom]').forEach(el=>{
    el.onclick=()=>{const ci=+el.dataset.custom;L.custom[ci].done=(L.custom[ci].done===false);L.custom[ci]._t=Date.now();mark(L,'custom');save();renderToday();};
  });
  card.querySelectorAll('[data-cdel]').forEach(el=>{
    el.onclick=(e)=>{e.stopPropagation();const ci=+el.dataset.cdel;L.custom[ci]._del=Date.now();L.custom[ci].done=false;mark(L,'custom');save();renderToday();};
  });
  document.getElementById('addMealBtn').onclick=()=>openMealDialog(iso);
  const qk=document.getElementById('quickKcal');
  const addKcal=()=>{
    const v=parseInt(qk.value); if(!v||v<=0){qk.focus();return;}
    if(!L.custom)L.custom=[];
    L.custom.push({txt:v+' kcal', kcal:v, p:0,c:0,f:0, done:true, _t:Date.now(), ate:mtAteNow(iso)});
    mark(L,'custom'); save(); renderToday();
  };
  document.getElementById('addKcalBtn').onclick=addKcal;
  qk.addEventListener('keydown',e=>{if(e.key==='Enter')addKcal()});

  const totalMeals=diet.meals.length+customs.length;
  document.getElementById('mealsProgress').textContent=`${done}/${totalMeals} posiłków`;
  renderMacros(tot);
}

// --- okno dodawania własnego posiłku ---
/* ==== INSTRUKTAŻ ĆWICZEŃ (krótki cue + link do wideo) ==== */
const GUIDE = {
  "Przysiad ze sztangą na karku":"Sztanga na górnej części pleców. Stopy na szerokość barków, klatka wypchnięta. Schodzisz biodrami w tył i w dół, kolana w linii stóp, aż uda równolegle. Wstajesz napierając piętami.",
  "Wyciskanie sztangi — ławka płaska":"Łopatki ściągnięte, stopy na podłodze. Sztangę opuszczasz kontrolowanie do klatki (linia sutków), łokcie ~45°. Wyciskasz po lekkim łuku, nie odbijasz od klatki.",
  "Wiosłowanie sztangą w opadzie":"Tułów pochylony ~45°, plecy proste. Ciągniesz sztangę do dolnej części brzucha, ściągając łopatki. Kontrolowany powrót, bez szarpania.",
  "Wyciskanie żołnierskie (stojąc)":"Sztanga na wysokości obojczyków, brzuch napięty. Wyciskasz nad głowę bez odchylania pleców. Głowa lekko do przodu na górze ruchu.",
  "Uginanie ramion ze sztangą (biceps)":"Łokcie przy tułowiu, nieruchome. Unosisz sztangę samym zgięciem w łokciu. Bez bujania tułowiem.",
  "Wyciskanie francuskie hantli (triceps)":"Ramiona pionowo, łokcie blisko głowy. Zginasz w łokciach opuszczając ciężar za głowę, potem prostujesz. Łokcie nie uciekają na boki.",
  "Deska (plank)":"Przedramiona i palce stóp. Ciało w linii prostej, brzuch i pośladki napięte, biodra nie opadają. Trzymasz czas.",
  "Martwy ciąg (klasyczny/rumuński)":"Sztanga przy goleniach, plecy proste. Prostujesz biodra i kolana jednocześnie, sztanga blisko ciała. Rumuński: głównie zgięcie w biodrach, lekko ugięte kolana.",
  "Wyciskanie hantli — ławka skośna":"Ławka 30–45°. Hantle nad klatką, opuszczasz do linii górnej klatki, łokcie pod kątem. Wyciskasz łącząc hantle nad górną częścią klatki.",
  "Ściąganie drążka wyciągu z góry":"Chwyt szerszy od barków. Ściągasz drążek do górnej klatki, łokcie w dół, łopatki ściągnięte. Kontrolowany powrót.",
  "Wznosy hantli bokiem (barki)":"Lekko ugięte łokcie. Unosisz hantle bokiem do linii barków, jakbyś nalewał wodę (małe palce lekko wyżej). Bez zamachu.",
  "Wspięcia na palce (łydki)":"Stajesz na palcach maksymalnie wysoko, pauza na górze, powolny powrót poniżej poziomu dla pełnego zakresu.",
  "Uginanie nóg na maszynie":"Zginasz nogi w kolanach ściągając wałek do pośladków, pauza, kontrolowany powrót. Biodra przylegają do ławki.",
  "Allahy (brzuch z wyciągiem)":"Klęcząc, lina za głową. Spinasz brzuch zwijając tułów w dół, ruch z brzucha a nie z rąk. Powolny powrót.",
  "Wyciskanie sztangi — ławka płaska ":"Jak wyżej: łopatki ściągnięte, sztanga do linii sutków, łokcie ~45°.",
  "Podciąganie na drążku (lub wyciąg)":"Chwyt nachwytem. Podciągasz brodę nad drążek ściągając łopatki, bez bujania. Kontrolowany zjazd do pełnego wyprostu.",
  "Wyciskanie hantli siedząc (barki)":"Oparte plecy, hantle na wysokości uszu. Wyciskasz nad głowę bez blokowania łokci na siłę. Kontrolowany powrót.",
  "Wiosłowanie hantlem jednorącz":"Kolano i ręka na ławce, plecy proste. Ciągniesz hantel do biodra, łokieć blisko ciała, ściągasz łopatkę.",
  "Rozpiętki w bramie (wyciąg)":"Lekko ugięte łokcie, ruch po łuku. Zbliżasz uchwyty przed sobą spinając klatkę, kontrolowany powrót.",
  "Uginanie młotkowe (biceps)":"Chwyt neutralny (kciuki do góry). Uginasz jak młotkiem, łokcie nieruchome przy tułowiu.",
  "Prostowanie ramion na wyciągu (triceps)":"Łokcie przy tułowiu. Prostujesz ramiona w dół do pełnego wyprostu, kontrolowany powrót. Tułów nieruchomy.",
  "Przysiad z hantlami / Hack":"Hantle po bokach lub maszyna Hack. Schodzisz w dół kontrolowanie, kolana w linii stóp, uda równolegle. Napierasz piętami.",
  "Wypady chodzone z hantlami":"Krok w przód, kolano tylnej nogi w dół, przednie kolano nad stopą. Odpychasz się piętą przedniej nogi.",
  "Rumuński martwy ciąg (RDL)":"Lekko ugięte kolana, sztanga blisko nóg. Odprowadzasz biodra w tył czując rozciąganie dwugłowych, plecy proste. Prostujesz biodra.",
  "Wyciskanie nóg na suwnicy":"Stopy na szerokość bioder. Opuszczasz platformę aż kolana ~90°, nie odrywasz pleców. Wypychasz piętami bez blokowania kolan.",
  "Wspięcia na palce siedząc":"Ciężar na kolanach. Wspinasz się na palce maksymalnie, pauza, powolny powrót.",
  "Ab Wheel / brzuszki na piłce":"Ab wheel: wyjeżdżasz kółkiem w przód trzymając napięty brzuch (plecy nie opadają), wracasz spinając brzuch.",
  "Swing kettlebell":"Ruch z bioder, nie z rąk i nie przysiad. Kettlebell między nogi jak podanie w futbolu, plecy proste, potem dynamiczny wyprost bioder i spięcie pośladków — kettlebell leci do wysokości klatki. Ręce tylko prowadzą.",
  "Pompki":"Dłonie trochę szerzej niż barki, ciało w jednej linii, brzuch i pośladki napięte. Klatka prawie do podłogi, łokcie ~45° od tułowia. Kończ serię 3 powtórzenia przed upadkiem — jutro siłownia.",
  "Farmer walk z hantlami":"Ciężkie hantle w dłoniach, barki w dół i do tyłu, wyprostowana sylwetka. Chodzisz krótkimi, pewnymi krokami przez podany czas. Wzmacnia chwyt, core i postawę.",
  "Brzuszki na ławce skośnej":"Stopy zablokowane, ręce na klatce (z hantlem, gdy 15 powtórzeń to za mało). Zwijasz tułów kręg po kręgu, bez szarpania głową. Powolny powrót, nie kładź się całkowicie.",
  "Unoszenie nóg na ławce skośnej":"Głowa wyżej, trzymasz się ławki za głową. Unosisz proste lub lekko ugięte nogi, na górze podwijasz miednicę. Opuszczasz powoli, lędźwie przyklejone do ławki.",
  "Russian twist z hantlem":"Siad, tułów odchylony ~45°, plecy proste, stopy na ziemi (trudniej: w górze). Hantel przy klatce, obracasz tułów na boki — rotacja z tułowia, nie z samych rąk.",
  "Deska boczna":"Łokieć pod barkiem, ciało w linii prostej od głowy do stóp, biodra wysoko. Trzymasz czas na każdą stronę.",
  "Rozciąganie całego ciała":"Każda pozycja 2×30 s, spokojny oddech: dwugłowe ud, zginacze bioder (wykrok), pośladki (gołąb), klatka w drzwiach, najszerszy (wiszenie/skłon przy ścianie), łydki.",
};
function openGuide(name){
  const cue = GUIDE[name] || GUIDE[name.trim()] || swapCue(name) || 'Skup się na kontrolowanym ruchu w pełnym zakresie i napięciu docelowego mięśnia.';
  const yt='https://www.youtube.com/results?search_query='+encodeURIComponent(name+' technika');
  const dlg=document.getElementById('guideDialog');
  dlg.querySelector('#gdTitle').textContent=name;
  dlg.querySelector('#gdCue').textContent=cue;
  dlg.querySelector('#gdVideo').href=yt;
  dlg.classList.add('show');
}
function closeGuide(){ document.getElementById('guideDialog').classList.remove('show'); }

function openMealDialog(iso, keepReplace){
  if(!keepReplace) MT.replace=null;
  MT.src=null;
  const dlg=document.getElementById('mealDialog');
  dlg.querySelector('#mdTxt').placeholder='np. duży kebab z sosem czosnkowym';
  dlg.querySelector('#mdTxt').value='';
  dlg.querySelector('#mdKcal').value='';
  dlg.querySelector('#mdP').value='';
  dlg.querySelector('#mdC').value='';
  dlg.querySelector('#mdF').value='';
  dlg.dataset.iso=iso;
  dlg.querySelector('#mdEstMsg').style.display='none';
  voiceReset();
  dlg.classList.add('show');
  setTimeout(()=>dlg.querySelector('#mdTxt').focus(),50);
}
function closeMealDialog(){ voiceStop(); bcClose(); document.getElementById('mealDialog').classList.remove('show'); }

/* ---- dyktowanie opisu posiłku: rozpoznawanie mowy przeglądarki (pl-PL), tekst pojawia się na bieżąco ----
   Chrome na Androidzie wysyła nagranie do Google; Safari używa rozpoznawania Apple.
   Bez obsługi w przeglądarce przycisk znika, a podpowiedź wskazuje mikrofon na klawiaturze. */
const SpeechRec=window.SpeechRecognition||window.webkitSpeechRecognition;
// wspólne dyktowanie (posiłek, Trener): jedna wypowiedź, kończy się sama po chwili ciszy
// (tryb ciągły na Androidzie powtarza tekst); o = {input, mic, msg, listening, onDone(heard), onSilence()}
function makeDictation(o){
  let rec=null;
  const say=(t,cls)=>{ o.msg.textContent=t; o.msg.className='md-voice'+(cls?' '+cls:''); o.msg.style.display=t?'block':'none'; };
  const ui=on=>{ o.mic.classList.toggle('rec',on); o.mic.setAttribute('aria-pressed',on?'true':'false'); };
  function stop(){ if(rec){ const r=rec; rec=null; try{ r.stop(); }catch(e){} } ui(false); }
  function start(){
    if(rec) return;
    const base=o.input.value.trim();
    let r;
    try{ r=new SpeechRec(); }catch(e){ say('Dyktowanie nie działa w tej przeglądarce — użyj mikrofonu na klawiaturze.','info'); return; }
    r.lang='pl-PL'; r.interimResults=true; r.continuous=false;
    let heard='';
    r.onresult=e=>{
      // Chrome na Androidzie podaje kolejne przybliżenia jako osobne wyniki („porcja”, „porcja kurczaka”…):
      // wynik, który zaczyna się od poprzedniego (albo odwrotnie), zastępuje go zamiast doklejać
      const parts=[];
      for(let i=0;i<e.results.length;i++){
        const t=e.results[i][0].transcript.trim(); if(!t) continue;
        const last=parts[parts.length-1];
        if(last && (t.startsWith(last)||last.startsWith(t))) parts[parts.length-1]= t.length>=last.length ? t : last;
        else parts.push(t);
      }
      heard=parts.join(' '); o.input.value=(base?base+' ':'')+heard;
    };
    r.onerror=e=>{
      if(e.error==='not-allowed'||e.error==='service-not-allowed') say('Brak dostępu do mikrofonu. Zezwól na mikrofon dla tej strony w ustawieniach przeglądarki.');
      else if(e.error==='no-speech'){ if(o.onSilence) o.onSilence(); else say('Nic nie usłyszałem — stuknij mikrofon i spróbuj jeszcze raz.'); }
      else if(e.error!=='aborted') say('Dyktowanie przerwane ('+e.error+'). Możesz wpisać tekst ręcznie.');
    };
    r.onend=()=>{ if(rec===r) rec=null; ui(false); if(heard) o.onDone(heard); };
    rec=r; ui(true); say(o.listening);
    try{ r.start(); }catch(e){ rec=null; ui(false); say('Nie udało się włączyć mikrofonu — stuknij 🎤, by mówić.'); }
  }
  if(!SpeechRec) o.mic.style.display='none';
  o.mic.onclick=()=>{ if(rec) stop(); else start(); };
  return {start, stop, say, active:()=>!!rec};
}

// dyktowanie opisu posiłku
const mealVoice=makeDictation({
  input:document.getElementById('mdTxt'), mic:document.getElementById('mdMic'), msg:document.getElementById('mdVoice'),
  listening:'● Słucham… powiedz, co zjadłeś. Skończę sam po chwili ciszy.',
  onDone:()=>{ mealVoice.say('✓ Gotowe — popraw tekst, jeśli trzeba, i oszacuj kalorie.','done'); document.getElementById('mdEstimate').classList.add('hi'); }
});
function voiceReset(){
  mealVoice.stop(); document.getElementById('mdEstimate').classList.remove('hi');
  mealVoice.say(SpeechRec ? '' : 'Możesz dyktować mikrofonem na klawiaturze telefonu.', 'info');
}
function voiceStop(){ mealVoice.stop(); }
function saveMealDialog(){
  const dlg=document.getElementById('mealDialog');
  const iso=dlg.dataset.iso;
  const txt=dlg.querySelector('#mdTxt').value.trim();
  const kcal=parseInt(dlg.querySelector('#mdKcal').value)||0;
  if(!txt && !kcal){ closeMealDialog(); return; }
  const L=log(iso);
  if(!L.custom)L.custom=[];
  L.custom.push({
    txt:txt||'Własny posiłek', kcal,
    p:parseInt(dlg.querySelector('#mdP').value)||0,
    c:parseInt(dlg.querySelector('#mdC').value)||0,
    f:parseInt(dlg.querySelector('#mdF').value)||0,
    done:true, _t:Date.now(), ate:mtAteNow(iso), src:MT.src||undefined
  });
  if(MT.replace && MT.replace.iso===iso){ if(!L.ate) L.ate={}; L.ate[MT.replace.key]=-1; mark(L,'ate:'+MT.replace.key); }   // „Inaczej” w domknięciu dnia
  MT.replace=null; MT.src=null;
  mark(L,'custom');save();closeMealDialog();renderToday();
}

function renderMacros(tot){
  const box=document.getElementById('macrosBox');
  const goal=macroGoalFor(S.kcalGoal||DEFAULT_KCAL);
  const defs=[
    {lab:'kcal',cls:'kcal',v:tot.kcal,g:goal.kcal,u:''},
    {lab:'Białko',cls:'',v:tot.p,g:goal.p,u:'g'},
    {lab:'Węgle',cls:'',v:tot.c,g:goal.c,u:'g'},
    {lab:'Tłuszcz',cls:'',v:tot.f,g:goal.f,u:'g'},
  ];
  box.innerHTML=defs.map(d=>`
    <div class="macro ${d.cls}">
      <div class="lab">${d.lab}</div>
      <div class="num">${d.v}</div>
      <div class="goal">z ${d.g}${d.u}</div>
      <div class="bar"><span style="width:${Math.min(100,d.g?d.v/d.g*100:0)}%"></span></div>
    </div>`).join('');
}

/* ---- dzienny cel kroków: S.adj.steps=[{from, goal, id}] od Trenera; obowiązuje najnowszy wpis z from <= dzień ---- */
const DEFAULT_STEPS=8000;
function stepsAdj(iso){ let r=null; ((S.adj&&S.adj.steps)||[]).forEach(x=>{ if(x.from<=iso && (!r||x.from>=r.from)) r=x; }); return r; }
const tysKrokow=n=>String(Math.round(n/100)/10).replace('.',',')+' tys. kroków';
function renderHabits(iso, dow, L){
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

function renderWater(iso, L){
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

/* ============================================================
   STREAK
   ============================================================ */
/* ==== oceny kategorii dla danego dnia (ISO) ==== */
// czy dzień jest dniem treningowym w planie (sesja siłowa)?
function isTrainingDay(iso){
  const di=dayIndexFor(iso); if(di<1||di>168) return false;
  const w=workoutOn(iso); return !!(w&&w.type==='lift');
}
// czy dieta danego dnia zaliczona? ≥3 z 4 posiłków ORAZ kalorie ≤ cel
function dietMet(iso){
  const L=S.log[iso]; if(!L) return false;
  const di=dayIndexFor(iso); if(di<1) return false;
  const wk=weekOf(di); const dow=parseISO(iso).getDay();
  const diet=DIET[dow]; if(!diet) return false;
  const goal=S.kcalGoal||DEFAULT_KCAL;
  let checked=0, kcal=0;
  dayMeals(iso, dow, L, wk).forEach((x,i)=>{
    if(L.meals&&L.meals['m'+i]){ checked++; kcal+=x.mc.kcal; }
  });
  (L.custom||[]).forEach(c=>{ if(c.done!==false&&!c._del) kcal+=(c.kcal||0); });
  return checked>=3 && kcal<=goal;
}
// czy trening danego dnia wykonany? (dzień treningowy + ≥1 seria odhaczona)
function trainingDone(iso){
  if(!isTrainingDay(iso)) return false;
  const L=S.log[iso]; if(!L) return false;
  return Object.values(L.ex||{}).some(exAny);
}
// czy nawyk zaznaczony danego dnia?
function habitOn(iso,key){ const L=S.log[iso]; return !!(L&&L.habits&&L.habits[key]); }

// ocena kategorii: zwraca 'yes' | 'no' | 'skip' (dzień neutralny, np. nietreningowy) dla danego ISO
function evalCategory(cat, iso){
  if(dayIndexFor(iso)<1) return 'skip';   // przed startem planu nic się nie liczy
  if(cat==='diet')  return dietMet(iso)?'yes':'no';
  if(cat==='sleep') return habitOn(iso,'sleep')?'yes':'no';
  if(cat==='alco')  return habitOn(iso,'noalco')?'yes':'no';
  if(cat==='sugar') return habitOn(iso,'nosugar')?'yes':'no';
  if(cat==='train') return isTrainingDay(iso) ? (trainingDone(iso)?'yes':'no') : 'skip';
  return 'skip';
}

// aktualna seria wstecz od dziś (dni 'skip' są pomijane, nie zrywają)
function currentStreak(cat){
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
function recordStreak(cat){
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

function dayIsActive(iso){ return dietMet(iso) || trainingDone(iso); } // do ogólnych statystyk

function updateStreak(){
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
  const sw=document.getElementById('statWorkouts'); if(sw)sw.textContent=totWk;
  const sd=document.getElementById('statDays'); if(sd)sd.textContent=totDays;
  const ss=document.getElementById('statStreak'); if(ss)ss.textContent=dietS;
  renderStreakCards();
  renderStreakCalendar();
}

const STREAK_CATS=[
  {k:'diet',ic:'🍽️',lab:'Dieta'},
  {k:'train',ic:'🏋️',lab:'Trening'},
  {k:'alco',ic:'🚫',lab:'Bez alkoholu'},
  {k:'sugar',ic:'🍬',lab:'Bez słodyczy'},
  {k:'sleep',ic:'😴',lab:'Sen'},
];
function renderStreakCards(){
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

// 1. dzień miesiąca o północy — bez godziny, żeby porównanie z limitem było dokładne
let calMonth=(()=>{ const d=new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })();
let calCat='diet';
// najdalszy miesiąc w kalendarzu: bieżący albo miesiąc startu planu, jeśli start jest później
function calMaxMonth(){
  const now=new Date(), a=new Date(now.getFullYear(),now.getMonth(),1);
  const st=parseISO(S.startDate), b=new Date(st.getFullYear(),st.getMonth(),1);
  return b>a?b:a;
}
function renderStreakCalendar(){
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
document.addEventListener('click',e=>{
  if(e.target&&e.target.id==='calPrev'){ calMonth=new Date(calMonth.getFullYear(), calMonth.getMonth()-1, 1); renderStreakCalendar(); }
  if(e.target&&e.target.id==='calNext'){ const n=new Date(calMonth.getFullYear(), calMonth.getMonth()+1, 1); if(n<=calMaxMonth()){ calMonth=n; renderStreakCalendar(); } }
});

/* ============================================================
   PLAN VIEW
   ============================================================ */
function renderPlan(){
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
          <div style="font-family:var(--font-disp);font-size:14px;color:var(--amber);letter-spacing:.06em">${p.wk}</div>
          <p style="color:var(--ink-dim);font-size:13.5px;margin:6px 0 10px">${p.desc}</p>
          <div style="font-size:12.5px;color:var(--ink-faint);background:var(--panel2);border-radius:8px;padding:9px 11px">${p.split}</div>
        </div>
      </div>
    </div>`;
  }).join('') + `<div class="note">Faza 1 rotuje FBW A/B (tydzień nieparzysty: A/B/A, parzysty: B/A/B). Po 10–12 tygodniu, gdy waga stanie, utnij 50 g węgli w dni nietreningowe (−~200 kcal).</div>`;
}

/* ============================================================
   WEIGHT
   ============================================================ */
function renderWeight(){
  renderRecords();
  const ws=S.weights.slice().sort((a,b)=>a.d<b.d?-1:1);
  const now=ws.length?ws[ws.length-1].w:null;
  const start=ws.length?ws[0].w:null;
  document.getElementById('wNow').textContent=now?now.toFixed(1):'—';
  document.getElementById('wStart').textContent=start?start.toFixed(1):'—';
  const dEl=document.getElementById('wDelta');
  if(now&&start){const dv=now-start;dEl.textContent=(dv>0?'+':'')+dv.toFixed(1);dEl.className='n '+(dv<=0?'down':'');}
  else{dEl.textContent='—';dEl.className='n'}
  drawChart(ws);
  cyWeightNote();
  renderTdee();
  document.getElementById('wEmpty').style.display=ws.length?'none':'block';
  renderMeasures();
}

/* ---- kiedy jesz i kiedy zapisujesz ----
   Godzina zapisu: L._t['meal:mN'] (była zawsze) i c._t dla własnych posiłków.
   Godzina zjedzenia: L.ate = {mN: minuty od północy, -1 = pominięty / zastąpiony} (synchronizowane, pole _t 'ate:mN'),
   c.ate dla własnych. Gdy odhaczasz posiłek ponad 45 min po swojej zwykłej porze, aplikacja pyta, o której był.
   Zwykła pora = mediana z 28 dni (domyślne pory, gdy danych jest mniej niż 3). Bez godziny zjedzenia przy zapisie
   ponad 2 h po zwykłej porze przyjmujemy zwykłą porę — inaczej stare wieczorne wpisy wyglądałyby na „na bieżąco”. */
const MT_DEF={'Śniadanie':480,'Przekąska':660,'Obiad':840,'Po treningu':1080,'Kolacja':1170};
const MT_LATE=45, MT_EVE=20*60+30;
var MT={ask:null, replace:null, src:null, usual:null, usualDay:null};
const mtMin=t=>{ const d=new Date(t); return d.getHours()*60+d.getMinutes(); };
const mtHM=m=>String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
function mtNowMin(){ return mtMin(Date.now()); }
function mtAteNow(iso){ return iso===todayISO() ? mtNowMin() : null; }
function mtUsual(tag){
  const today=todayISO();
  if(MT.usualDay!==today){ MT.usual={}; MT.usualDay=today; }
  if(MT.usual[tag]!=null) return MT.usual[tag];
  const vals=[];
  for(let i=1;i<=28;i++){ const iso=addDays(today,-i), L=S.log[iso]; if(!L||!L.meals) continue;
    const dow=parseISO(iso).getDay(); if(!DIET[dow]) continue;
    DIET[dow].meals.forEach((sl,k)=>{ if(sl.tag!==tag || !L.meals['m'+k]) return;
      const a=L.ate&&L.ate['m'+k]; if(a>=0){ vals.push(a); return; }
      const t=L._t&&L._t['meal:m'+k]; if(t && todayISO(new Date(t))===iso) vals.push(mtMin(t)); }); }
  vals.sort((a,b)=>a-b);
  return MT.usual[tag] = vals.length>=3 ? vals[Math.floor(vals.length/2)] : (MT_DEF[tag]||720);
}
// jeden zapis posiłku: kiedy zjedzony, kiedy zapisany
function mtEntry(iso, L, key, tag){
  const t=L._t&&L._t['meal:'+key]; if(!t) return null;
  const a=L.ate&&L.ate[key], logDay=todayISO(new Date(t)), logMin=mtMin(t)+(logDay>iso?1440*cyDiff(iso,logDay):0);
  const usual=mtUsual(tag);
  const ate = a>=0 ? a : (logMin-usual>120 ? usual : logMin);
  return {ate, logged:logMin, lag:logMin-ate};
}
function mtStampHtml(iso, L, key, on){
  if(L.ate && L.ate[key]===-1 && !on) return '<span class="mt-st skip">pominięty</span>';
  if(!on) return '';
  const dow=parseISO(iso).getDay(), i=+key.slice(1), tag=DIET[dow]&&DIET[dow].meals[i]?DIET[dow].meals[i].tag:'';
  const e=mtEntry(iso, L, key, tag); if(!e) return '';
  return mtStamp(e);
}
function mtStampCustom(iso, c){
  if(!c._t) return '';
  const logDay=todayISO(new Date(c._t)), logged=mtMin(c._t)+(logDay>iso?1440*cyDiff(iso,logDay):0);
  if(logDay<iso) return '';
  return mtStamp({ate:c.ate>=0?c.ate:logged, logged, lag:logged-(c.ate>=0?c.ate:logged)});
}
function mtStamp(e){
  if(e.lag<=MT_LATE) return `<span class="mt-st now">✓ ${mtHM(e.logged)} · na bieżąco</span>`;
  if(e.logged>=1440) return `<span class="mt-st eve">zjedzony ${mtHM(e.ate)} · uzupełniony później</span>`;
  if(e.logged>=MT_EVE) return `<span class="mt-st eve">zjedzony ${mtHM(e.ate)} · uzupełniony wieczorem</span>`;
  return `<span class="mt-st late">zjedzony ${mtHM(e.ate)} · zapisany ${mtHM(e.logged)}</span>`;
}
// odhaczenie posiłku: dziś i późno → pytanie o godzinę; dawny dzień → zwykła pora
function mtOnCheck(iso, L, key, dow){
  if(!L.meals[key]){ if(MT.ask && MT.ask.key===key) MT.ask=null; return; }
  const i=+key.slice(1), tag=DIET[dow]&&DIET[dow].meals[i]?DIET[dow].meals[i].tag:'', usual=mtUsual(tag);
  if(!L.ate) L.ate={};
  if(iso===todayISO()){
    const now=mtNowMin();
    L.ate[key]=now; mark(L,'ate:'+key);
    MT.ask = now-usual>MT_LATE ? {iso, key} : null;
  } else if(iso<todayISO()){ L.ate[key]=usual; mark(L,'ate:'+key); }
}
function mtAskHtml(iso, key, tag){
  if(!MT.ask || MT.ask.iso!==iso || MT.ask.key!==key) return '';
  const now=mtNowMin(), usual=mtUsual(tag), opts=[[now,'teraz'],[now-30,mtHM(now-30)],[now-60,mtHM(now-60)]].filter(o=>o[0]>usual-60);
  return `<div class="mt-ask"><b>O której był ten posiłek?</b><div class="mt-chips">${opts.map(([m,l])=>`<button type="button" data-mtate="${key}" data-m="${m}">${l}</button>`).join('')}<button type="button" data-mtate="${key}" data-m="${usual}">jak zwykle (${mtHM(usual)})</button></div>
    <span>Pytam, gdy zapisujesz ponad 45 min po zwykłej porze — dzięki temu widać, kiedy naprawdę jesz.</span></div>`;
}
// domknięcie dnia: tylko dziś, od godziny z przypomnień (domyślnie 21:00), gdy posiłki z minioną porą nie są ani odhaczone, ani pominięte
function mtMissing(iso, L, dow){
  if(!DIET[dow]) return [];
  const now=mtNowMin();
  return DIET[dow].meals.map((sl,i)=>({key:'m'+i, tag:sl.tag, usual:mtUsual(sl.tag)}))
    .filter(x=>!(L.meals&&L.meals[x.key]) && !(L.ate&&L.ate[x.key]===-1) && x.usual+MT_LATE<now);
}
function mtCloseTime(){ const t=(S.reminders&&S.reminders.close)||'21:00', [h,m]=t.split(':').map(Number); return h*60+m; }
function mtCloseHtml(iso, L, dow){
  if(iso!==todayISO() || mtNowMin()<mtCloseTime()) return '';
  const miss=mtMissing(iso, L, dow); if(!miss.length) return '';
  return `<div class="mt-close"><div class="h"><b>Domknij dzień — brakuje ${miss.length} ${miss.length===1?'posiłku':'posiłków'}</b><span>Bez tego kalorie i trend wagi liczą się z luk. Każdy posiłek potwierdź osobno.</span></div>
    ${miss.map(x=>`<div class="mt-slot"><b>${esc(x.tag)} <span>· zwykle ${mtHM(x.usual)}</span></b><div class="mt-chips">
      <button type="button" data-mtc="plan" data-k="${x.key}">Wg planu</button><button type="button" data-mtc="other" data-k="${x.key}">Inaczej</button><button type="button" data-mtc="skip" data-k="${x.key}">Pominięty</button></div></div>`).join('')}
    <span style="font-size:12px;color:var(--ink-faint)">Uzupełnione wieczorem liczą się do kalorii, ale nie do zapisów „na bieżąco”.</span></div>`;
}
function mtBind(card, iso, L, dow){
  card.querySelectorAll('[data-mtate]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); const k=b.dataset.mtate; if(!L.ate) L.ate={}; L.ate[k]=+b.dataset.m; mark(L,'ate:'+k); MT.ask=null; save(); renderToday(); });
  card.querySelectorAll('[data-mtc]').forEach(b=>b.onclick=()=>{
    const k=b.dataset.k, i=+k.slice(1), tag=DIET[dow].meals[i].tag; if(!L.ate) L.ate={};
    if(b.dataset.mtc==='plan'){ L.meals[k]=true; mark(L,'meal:'+k); L.ate[k]=mtUsual(tag); mark(L,'ate:'+k); }
    else if(b.dataset.mtc==='skip'){ L.ate[k]=-1; mark(L,'ate:'+k); }
    else { MT.replace={iso, key:k}; openMealDialog(iso, true); document.getElementById('mdTxt').placeholder=tag+' — co było zamiast?'; return; }
    save(); renderToday();
  });
}
// przypomnienia o posiłkach: ok. 40 min po Twojej zwykłej porze, jeśli posiłek nie jest zapisany; domknięcie dnia, gdy są luki
function mtScheduleReminders(useSystem){
  const iso=todayISO(), dow=parseISO(iso).getDay(), now=Date.now(), base=new Date(); base.setHours(0,0,0,0);
  if(DIET[dow]) DIET[dow].meals.forEach((sl,i)=>{
    const at=base.getTime()+(mtUsual(sl.tag)+40)*60000; if(at<=now) return;
    notifTimers.push(setTimeout(()=>{ const L=S.log[iso]; if(todayISO()!==iso || (L&&L.meals&&L.meals['m'+i]) || (L&&L.ate&&L.ate['m'+i]===-1)) return;
      fireReminder({title:'🍽️ '+sl.tag+'?', body:'Zwykle jesz około '+mtHM(mtUsual(sl.tag))+'. Zapisz teraz — wg planu, zdjęciem albo wpisem.'}, useSystem); }, at-now));
  });
  const ct=base.getTime()+mtCloseTime()*60000;
  if(ct>now) notifTimers.push(setTimeout(()=>{ const L=S.log[iso]||{}; const n=mtMissing(iso, L, dow).length; if(n && todayISO()===iso)
    fireReminder({title:'🌙 Domknij dzień', body:'Brakuje '+n+' '+(n===1?'posiłku':'posiłków')+'. Uzupełnij je w Diecie — każdy osobno.'}, useSystem); }, ct-now));
  const mid=new Date(base); mid.setDate(mid.getDate()+1); mid.setMinutes(2);
  notifTimers.push(setTimeout(setupReminders, mid.getTime()-now));   // nowy dzień → nowe pory
}
/* ---- Twoje nawyki: 7 dni bez dzisiaj — kiedy jesz, kiedy zapisujesz ---- */
function mhCollect(){
  const today=todayISO(), days=[];
  for(let i=7;i>=1;i--){ const iso=addDays(today,-i), L=S.log[iso], dow=parseISO(iso).getDay(), list=[];
    if(L){ if(L.meals && DIET[dow]) DIET[dow].meals.forEach((sl,k)=>{ if(L.meals['m'+k]){ const e=mtEntry(iso, L, 'm'+k, sl.tag); if(e) list.push(Object.assign({tag:sl.tag}, e)); } });
      (L.custom||[]).forEach(c=>{ if(c._del || c.done===false || !c._t) return; const logDay=todayISO(new Date(c._t)); if(logDay<iso) return;
        const logged=mtMin(c._t)+(logDay>iso?1440*cyDiff(iso,logDay):0), ate=c.ate>=0?c.ate:logged; list.push({tag:'Własny', ate, logged, lag:logged-ate}); }); }
    days.push({iso, dow, list});
  }
  return days;
}
function renderMealHabits(){
  const sec=document.getElementById('mhSection'), box=document.getElementById('mhBox'); if(!sec) return;
  const days=mhCollect(), all=days.flatMap(d=>d.list);
  if(all.length<5){ sec.style.display='none'; return; }
  sec.style.display='';
  const onTime=all.filter(x=>x.lag<=MT_LATE).length, lag=all.reduce((a,x)=>a+Math.max(0,x.lag),0)/all.length/60, late=all.filter(x=>x.ate>=21*60).length;
  const W=340,H=210,L=26,R=8,T=12,B=22, y0=6, y1=24, Y=h=>T+(Math.min(y1,Math.max(y0,h))-y0)/(y1-y0)*(H-T-B), X=i=>L+(i+.5)*(W-L-R)/7;
  const DN=['Nd','Pn','Wt','Śr','Cz','Pt','Sb'];
  let g='';
  [6,9,12,15,18,21,24].forEach(h=>{ g+=`<line x1="${L}" x2="${W-R}" y1="${Y(h)}" y2="${Y(h)}" stroke="var(--line)"/><text x="${L-4}" y="${Y(h)+3.5}" text-anchor="end">${h}</text>`; });
  g+=`<rect x="${L}" y="${Y(21)}" width="${W-L-R}" height="${Y(24)-Y(21)}" fill="var(--red)" opacity=".07"/>`;
  days.forEach((d,i)=>{ g+=`<text x="${X(i)}" y="${H-6}" text-anchor="middle">${DN[d.dow]}</text>`;
    d.list.forEach(x=>{ const col=x.lag<=MT_LATE?'var(--green)':x.logged>=MT_EVE?'var(--red)':'var(--gold)', ya=Y(x.ate/60), yl=Y(x.logged/60);
      if(x.lag>MT_LATE) g+=`<line x1="${X(i)}" x2="${X(i)}" y1="${ya}" y2="${yl}" stroke="${col}" stroke-dasharray="2 3" opacity=".7"/><circle cx="${X(i)}" cy="${yl}" r="2.5" fill="${col}"/>`;
      g+=`<circle cx="${X(i)}" cy="${ya}" r="5" fill="${col}" stroke="var(--bg)" stroke-width="1.5"/>`; }); });
  // wnioski z reguł: dni zapisywane wieczorem, późne jedzenie, znikająca przekąska, dobre dni
  const ins=[], eveDays=days.filter(d=>d.list.length && d.list.filter(x=>x.lag>MT_LATE && x.logged>=MT_EVE).length>=2);
  if(eveDays.length) ins.push(`<b>${eveDays.map(d=>DN[d.dow]).join(', ')}: posiłki zapisane dopiero wieczorem.</b> Spróbuj zapisywać od razu — choćby zdjęciem albo „wg planu”.`);
  const lateDays=days.filter(d=>d.list.some(x=>x.ate>=21*60));
  if(lateDays.length>=2) ins.push(`<b>Jedzenie po 21:00: ${lateDays.map(d=>DN[d.dow]).join(', ')}.</b> Późny, duży posiłek często idzie w parze z długą przerwą po obiedzie.`);
  const snackMiss=days.filter(d=>DIET[d.dow] && DIET[d.dow].meals.some((sl,k)=>sl.tag==='Przekąska' && !(S.log[d.iso]&&S.log[d.iso].meals&&S.log[d.iso].meals['m'+k])));
  if(snackMiss.length>=3) ins.push(`<b>Przekąski brak w ${snackMiss.length} z 7 dni.</b> Zaplanowana przekąska zmniejsza głód wieczorem.`);
  const good=days.filter(d=>d.list.length>=3 && d.list.every(x=>x.lag<=MT_LATE)).length;
  ins.push(`<b>${good} z 7 dni zapisanych w całości na bieżąco.</b> ${good<7?'Cel na ten tydzień: '+Math.min(7,good+1)+'.':'Świetnie — tak trzymaj.'}`);
  box.innerHTML=`<div class="mh-kpi"><div><b>${Math.round(onTime/all.length*100)}%</b><span>posiłków zapisanych na bieżąco</span></div><div><b>${lag.toFixed(1).replace('.',',')} h</b><span>średnio od jedzenia do zapisu</span></div><div><b>${late}</b><span>posiłki po 21:00</span></div></div>
    <div class="mh-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Godziny posiłków i zapisów w ostatnich 7 dniach">${g}</svg></div>
    <div class="mh-leg"><span><i style="background:var(--green)"></i>na bieżąco</span><span><i style="background:var(--gold)"></i>później</span><span><i style="background:var(--red)"></i>wieczorem</span><span>kropka = posiłek, mała = zapis</span></div>
    ${ins.map(t=>`<div class="mh-ins">${t}</div>`).join('')}`;
}
/* ---- zdjęcie posiłku → AI (składniki, gramatury, kcal, makro); liczy się jako 1 szacowanie ----
   Zdjęcie zmniejszone na telefonie do 1024 px (JPEG) i wysłane raz; serwer go nie zapisuje. „Dodaj” dokłada do pól posiłku. */
var PH={img:null, items:null, res:null};
function phOpen(){
  if(!(CLOUD.on && CLOUD.url && CLOUD.token)){ const m=document.getElementById('mdEstMsg'); m.style.display='block'; m.style.color='var(--red)'; m.textContent='Szacowanie ze zdjęcia korzysta z serwera — włącz synchronizację (Więcej → Synchronizacja).'; return; }
  if(quotaLeft('est')===0){ const m=document.getElementById('mdEstMsg'); m.style.display='block'; m.style.color='var(--red)'; m.textContent='Limit '+quotaCur().est.max+' szacowań w tym miesiącu wykorzystany. Nowe od '+quotaReset()+'.'; return; }
  const f=document.getElementById('phFile'); f.value=''; f.click();
}
function phView(title, html){
  const pn=document.getElementById('phPanel');
  pn.innerHTML=`<div class="eh-grab"></div><div class="eh-head"><div style="flex:1;min-width:0"><div class="eyebrow">Zdjęcie posiłku · AI</div><h2 id="phTitle">${title}</h2></div><button class="eh-x" data-phclose aria-label="Zamknij">✕</button></div>`+html;
  pn.querySelectorAll('[data-phclose]').forEach(b=>b.onclick=phClose);
  document.getElementById('phSheet').style.display='flex';
}
function phClose(){ document.getElementById('phSheet').style.display='none'; }
document.querySelector('#phSheet .bd').onclick=phClose;
function phShrink(file){
  return new Promise((ok,no)=>{ const url=URL.createObjectURL(file), im=new Image();
    im.onload=()=>{ const k=Math.min(1, 1024/Math.max(im.width, im.height)), c=document.createElement('canvas'); c.width=Math.round(im.width*k); c.height=Math.round(im.height*k);
      c.getContext('2d').drawImage(im,0,0,c.width,c.height); URL.revokeObjectURL(url); ok(c.toDataURL('image/jpeg',0.8)); };
    im.onerror=()=>{ URL.revokeObjectURL(url); no(new Error('img')); }; im.src=url; });
}
document.getElementById('phFile').onchange=async e=>{
  const file=e.target.files&&e.target.files[0]; if(!file) return;
  let data; try{ data=await phShrink(file); }catch(err){ phView('Nie udało się', '<div class="md-hint">Nie mogę odczytać tego zdjęcia. Spróbuj zrobić je jeszcze raz.</div>'); return; }
  PH.img=data;
  phView('Szacuję…', `<div class="ph-img"><img src="${data}" alt="Zdjęcie posiłku"><div class="scan"></div></div><div class="md-hint" style="margin:0">AI rozpoznaje składniki i szacuje porcje — zwykle 5–15 s.</div>`);
  try{
    const j=await cloudCall('estimatePhoto', {image:data.split(',')[1], note:document.getElementById('mdTxt').value.trim().slice(0,200)});
    if(j.quota) quotaSet(j.quota);
    if(!j.items || !j.items.length){ phView('Nie rozpoznano', `<div class="ph-img" style="aspect-ratio:16/9"><img src="${data}" alt="Zdjęcie posiłku"></div><div class="md-hint" style="margin:0">${esc(j.note||'Nie widzę posiłku na zdjęciu.')} Zrób zdjęcie z góry, z całym talerzem w kadrze, albo opisz posiłek słowami.</div><button class="btn ghost" type="button" id="phAgain">Inne zdjęcie</button>`); document.getElementById('phAgain').onclick=()=>{ phClose(); phOpen(); }; return; }
    PH.res=j; PH.items=j.items.map(x=>Object.assign({g0:x.g||100}, x, {g:x.g||100}));
    phResult();
  }catch(err){
    if(err.data && err.data.quota) quotaSet(err.data.quota);
    phView('Nie udało się', `<div class="md-hint" style="margin:0">${esc(netDown(err)?'Brak internetu — szacowanie ze zdjęcia potrzebuje połączenia.':err.message)}</div><button class="btn ghost" type="button" id="phAgain">Spróbuj ponownie</button>`);
    document.getElementById('phAgain').onclick=()=>{ phClose(); phOpen(); };
  }
};
function phSum(){ return PH.items.reduce((a,x)=>{ const f=x.g0?x.g/x.g0:1; a.kcal+=x.kcal*f; a.p+=x.p*f; a.c+=x.c*f; a.f+=x.f*f; return a; },{kcal:0,p:0,c:0,f:0}); }
function phResult(){
  const j=PH.res, s=phSum(), CONF={wysoka:'wysoka', srednia:'średnia', niska:'niska'};
  phView(esc(j.name||'Twój posiłek'), `<div class="ph-img" style="aspect-ratio:16/9"><img src="${PH.img}" alt="Zdjęcie posiłku"></div>
    <div class="ph-conf">Pewność: <b>${CONF[j.conf]||'średnia'}</b>${j.note?' — '+esc(j.note):''} Popraw porcje suwakami, jeśli wiesz lepiej.</div>
    <div class="ph-items">${PH.items.map((x,i)=>`<div class="ph-item"><b>${esc(x.n)}</b><span class="kc">${Math.round(x.kcal*(x.g0?x.g/x.g0:1))}</span><span class="g">${x.g} g</span>
      <input type="range" min="${Math.max(1,Math.round(x.g0*.3))}" max="${Math.max(10,Math.round(x.g0*2))}" step="${x.g0>=50?5:1}" value="${x.g}" data-phi="${i}" aria-label="Porcja: ${esc(x.n)}"></div>`).join('')}</div>
    <div class="ph-sum" id="phSumBox"><div><b>${Math.round(s.kcal)}</b><span>kcal</span></div><div><b>${Math.round(s.p)}</b><span>białko</span></div><div><b>${Math.round(s.c)}</b><span>węgle</span></div><div><b>${Math.round(s.f)}</b><span>tłuszcz</span></div></div>
    <button class="btn" type="button" id="phUse">Dodaj do posiłku · ${Math.round(s.kcal)} kcal</button>
    <button class="btn ghost" type="button" id="phAgain">Inne zdjęcie</button>
    <div class="md-hint" style="margin:0">Szacunek z wyglądu — tłuszcz i sosy bywają niewidoczne. Liczy się jako 1 szacowanie.</div>`);
  document.querySelectorAll('[data-phi]').forEach(r=>r.oninput=()=>{ const x=PH.items[+r.dataset.phi]; x.g=+r.value;
    const it=r.closest('.ph-item'); it.querySelector('.kc').textContent=Math.round(x.kcal*(x.g0?x.g/x.g0:1)); it.querySelector('.g').textContent=x.g+' g';
    const t=phSum(); document.getElementById('phSumBox').innerHTML=`<div><b>${Math.round(t.kcal)}</b><span>kcal</span></div><div><b>${Math.round(t.p)}</b><span>białko</span></div><div><b>${Math.round(t.c)}</b><span>węgle</span></div><div><b>${Math.round(t.f)}</b><span>tłuszcz</span></div>`;
    document.getElementById('phUse').textContent='Dodaj do posiłku · '+Math.round(t.kcal)+' kcal'; });
  document.getElementById('phAgain').onclick=()=>{ phClose(); phOpen(); };
  document.getElementById('phUse').onclick=()=>{
    const t=phSum(), add=(id,v)=>{ const el=document.getElementById(id); el.value=(parseInt(el.value)||0)+Math.round(v); };
    const tx=document.getElementById('mdTxt'), name=j.name||PH.items.map(x=>x.n).slice(0,3).join(', ');
    tx.value=tx.value.trim() ? tx.value.trim()+' + '+name : name;
    add('mdKcal',t.kcal); add('mdP',t.p); add('mdC',t.c); add('mdF',t.f);
    MT.src='photo';
    const m=document.getElementById('mdEstMsg'); m.style.display='block'; m.style.color='var(--steel)'; m.textContent='Dodano ze zdjęcia: '+Math.round(t.kcal)+' kcal. Popraw liczby, jeśli trzeba, i stuknij „Dodaj”.';
    phClose();
  };
}
document.getElementById('mdPhoto').onclick=phOpen;

/* ---- kalorie z trendu wagi: rzeczywisty wydatek z Twoich danych (jak w MacroFactor) ----
   Wydatek = średnie kalorie z dni z pełnym zapisem − zmiana wagi (trend z regresji liniowej, 1 kg ≈ 7700 kcal).
   Okno: 28 dni przed dzisiaj. Potrzeba: ważenia z co najmniej 14 dni (min. 6), 10 dni z pełnym zapisem jedzenia.
   Dzień z pełnym zapisem: 3+ odhaczone posiłki albo 70% celu tego dnia (niepełny zapis zaniżałby wydatek).
   Jadłospis skaluje się do celu, więc stare dni liczymy z celem, który wtedy obowiązywał (S.adj.kcal.hist).
   Propozycja zachowuje zamierzony deficyt (wzór − cel), najwyżej ±300 kcal naraz i co najmniej 14 dni po poprzedniej
   zmianie z trendu; tempo spadku nie szybsze niż 1% masy ciała na tydzień.
   Stan w S.adj.kcal = {hist:[{d,kcal,prev}], last:{at,d,from,to,tdee}, snooze:'RRRR-MM-DD'} — synchronizowany z ustawieniami. */
const TD_WIN=28, TD_SPAN=14, TD_WN=6, TD_DAYS=10, TD_EVERY=14;
function kcalAdj(){ if(!S.adj) S.adj={}; if(!S.adj.kcal) S.adj.kcal={hist:[]}; if(!S.adj.kcal.hist) S.adj.kcal.hist=[]; return S.adj.kcal; }
// zmiana celu kalorii od dziś (suwak, Trener, trend wagi) — do liczenia starych dni
function kcalRecord(kcal, prev){
  if(!kcal || kcal===prev) return;
  const A=kcalAdj(), d=todayISO(), ex=A.hist.find(h=>h.d===d);
  if(ex) ex.kcal=kcal; else A.hist.push({d, kcal, prev:prev||null});
  A.hist=A.hist.filter(h=>h.kcal!==h.prev).slice(-60);
}
function goalOn(iso){
  const h=((S.adj&&S.adj.kcal&&S.adj.kcal.hist)||[]).slice().sort((a,b)=>a.d<b.d?-1:1);
  const e=h.filter(x=>x.d<=iso).pop();
  if(e) return e.kcal;
  return (h[0] && h[0].prev) || S.kcalGoal || DEFAULT_KCAL;
}
function dayIntake(iso){
  const L=S.log[iso]; if(!L) return null;
  const goal=goalOn(iso), dow=parseISO(iso).getDay(), wk=weekOf(dayIndexFor(iso));
  let kcal=0, items=0;
  if(L.meals && DIET[dow]) dayMeals(iso, dow, L, wk, goal).forEach((x,i)=>{ if(L.meals['m'+i]){ kcal+=x.mc.kcal; items++; } });
  (L.custom||[]).forEach(c=>{ if(!c._del && c.done!==false){ kcal+=c.kcal||0; items++; } });
  const resolved=DIET[dow] ? DIET[dow].meals.every((_,i)=>(L.meals&&L.meals['m'+i]) || (L.ate&&L.ate['m'+i]===-1)) : false;
  return {kcal, items, full: items>=3 || kcal>=0.7*goal || (resolved && items>=1)};
}
function tdeeEstimate(){
  const today=todayISO(), from=addDays(today,-TD_WIN), to=addDays(today,-1);
  const ws=(S.weights||[]).filter(w=>w.d>=from && w.d<=today && w.w>0).sort((a,b)=>a.d<b.d?-1:1);
  const span=ws.length>1 ? cyDiff(ws[0].d, ws[ws.length-1].d) : 0;
  const days=[]; for(let d=from; d<=to; d=addDays(d,1)){ const x=dayIntake(d); if(x && x.full) days.push(x.kcal); }
  const need={w:ws.length, span, days:days.length};
  if(ws.length<TD_WN || span<TD_SPAN || days.length<TD_DAYS) return {ok:false, need};
  // trend wagi: nachylenie prostej (kg na dzień) — mniej czułe na wodę niż różnica pierwszego i ostatniego ważenia
  const xs=ws.map(w=>cyDiff(ws[0].d, w.d)), mx=xs.reduce((a,b)=>a+b,0)/xs.length, my=ws.reduce((a,w)=>a+w.w,0)/ws.length;
  let num=0, den=0; ws.forEach((w,i)=>{ num+=(xs[i]-mx)*(w.w-my); den+=(xs[i]-mx)**2; });
  const slope=den ? num/den : 0, avg=days.reduce((a,b)=>a+b,0)/days.length, tdee=Math.round(avg - slope*7700);
  if(tdee<1200 || tdee>5500) return {ok:false, need, odd:true};
  return {ok:true, need, tdee, avg:Math.round(avg), weekly:slope*7, formula:estMaintenance(), weight:ws[ws.length-1].w};
}
function tdeeProposal(e){
  const goal=S.kcalGoal||DEFAULT_KCAL, deficit=e.formula-goal;   // zamierzony deficyt z obecnego celu
  let to=Math.round((e.tdee-deficit)/100)*100;
  to=Math.max(goal-300, Math.min(goal+300, to));
  const maxDef=e.weight*0.01*7700/7;                               // 1% masy ciała na tydzień
  if(e.tdee-to>maxDef) to=Math.ceil((e.tdee-maxDef)/100)*100;
  return Math.max(1500, Math.min(3200, to));
}
const tdFmt=v=>(v>0?'+':v<0?'−':'')+Math.abs(v).toFixed(2).replace('.',',');
function renderTdee(){
  const box=document.getElementById('tdeeCard'); if(!box) return;
  const e=tdeeEstimate(), A=(S.adj&&S.adj.kcal)||{}, today=todayISO(), goal=S.kcalGoal||DEFAULT_KCAL, last=A.last;
  const head=`<div class="td-h"><b>Wydatek z Twoich danych</b><span class="md-hint" style="margin:0;white-space:nowrap">28 dni</span></div>`;
  if(!e.ok){
    const n=e.need, row=(l,v,max,u)=>`<div class="r"><span>${l}</span><span class="bar"><i style="width:${Math.min(100,v/max*100)}%"></i></span><small>${Math.min(v,max)}/${max}${u}</small></div>`;
    box.innerHTML=head+(e.odd?`<div class="td-note">Wynik wyszedł nierealny — zwykle przez niepełny zapis jedzenia albo pomyłkę przy wadze. Sprawdź ostatnie wpisy.</div>`:
      `<div class="md-hint" style="margin:0">Po 2–3 tygodniach aplikacja porówna, co jesz, ze zmianą wagi i zaproponuje cel kalorii dopasowany do Ciebie.</div>
      <div class="td-prog">${row('Ważenia',n.w,TD_WN,'')}${row('Okres ważeń',n.span,TD_SPAN,' dni')}${row('Dni z pełnym zapisem jedzenia',n.days,TD_DAYS,'')}</div>
      <div class="td-note">Dzień z pełnym zapisem: odhaczone co najmniej 3 posiłki albo 70% celu. Waż się rano, na czczo, kilka razy w tygodniu.</div>`);
    return;
  }
  const to=tdeeProposal(e), since=last ? cyDiff(last.d, today) : 99, snoozed=A.snooze && A.snooze>today;
  const show=Math.abs(to-goal)>=100 && since>=TD_EVERY && !snoozed;
  const pace=(e.formula-goal)*7/7700;
  box.innerHTML=head+`<div class="td-grid">
      <div><b>${e.tdee}</b><span>kcal — Twój wydatek<br>(wzór: ${e.formula})</span></div>
      <div><b>${e.avg}</b><span>kcal — jesz średnio<br>(${e.need.days} dni)</span></div>
      <div><b>${tdFmt(e.weekly)}</b><span>kg/tydz. — trend wagi</span></div></div>`+
    (show?`<div class="td-prop"><span><b>Proponuję cel ${to} kcal zamiast ${goal}.</b> ${to<goal?'Twój wydatek jest niższy, niż zakładał wzór':'Twój wydatek jest wyższy, niż zakładał wzór'} — z nowym celem utrzymasz zamierzone tempo${pace>0?' (~'+pace.toFixed(2).replace('.',',')+' kg tłuszczu/tydz.)':''}.</span>
      <div class="row"><button class="btn" type="button" id="tdApply">Zastosuj od dziś</button><button class="btn ghost" type="button" id="tdLater">Za tydzień</button></div></div>`
    : last && last.d===today ? `<div class="td-note">Cel zmieniony dziś: ${last.from} → ${last.to} kcal (z trendu wagi). <button class="btn ghost" type="button" id="tdUndo" style="font-size:12px;padding:5px 10px;margin-left:4px">Cofnij</button></div>`
    : `<div class="td-note">${last?'Ostatnia zmiana z trendu: '+prDD(last.d)+' ('+last.from+' → '+last.to+' kcal). ':''}${Math.abs(to-goal)<100?'Obecny cel '+goal+' kcal pasuje do Twoich danych.':snoozed?'Następna propozycja od '+prDD(A.snooze)+'.':'Następne sprawdzenie od '+prDD(addDays(last.d,TD_EVERY))+'.'}</div>`)+
    `<div class="td-note">Liczone z odhaczonych posiłków i wag. Wahania wody (sól, trening${cyTracking()?', cykl':''}) wygładza trend z 4 tygodni. Zmiana celu to zawsze Twoja decyzja.</div>`;
  const ap=document.getElementById('tdApply');
  if(ap) ap.onclick=()=>{ const Aa=kcalAdj(), from=goal; Aa.prevLast=Aa.last||null; Aa.last={at:Date.now(), d:today, from, to, tdee:e.tdee}; delete Aa.snooze;
    S.kcalGoal=to; kcalRecord(to, from); kcalSlider.value=to; updateKcalHint(); S._settingsM=Date.now(); save(); renderToday(); renderWeight(); restToast('Nowy cel: '+to+' kcal'); };
  const lt=document.getElementById('tdLater');
  if(lt) lt.onclick=()=>{ kcalAdj().snooze=addDays(today,7); S._settingsM=Date.now(); save(); renderWeight(); };
  const un=document.getElementById('tdUndo');
  if(un) un.onclick=()=>{ const Aa=kcalAdj(), l=Aa.last; S.kcalGoal=l.from; kcalRecord(l.from, l.to); Aa.last=Aa.prevLast||null; delete Aa.prevLast;
    kcalSlider.value=S.kcalGoal; updateKcalHint(); S._settingsM=Date.now(); save(); renderToday(); renderWeight(); restToast('Cofnięto — cel '+S.kcalGoal+' kcal'); };
}

/* ---- obwody ciała: S.measures=[{d, waist, chest, arm, thigh, hips, _t}] ---- */
const MEASURES=[
  {k:'waist',l:'Pas (pępek)',down:true},
  {k:'chest',l:'Klatka',down:false},
  {k:'arm',l:'Ramię (napięte)',down:false},
  {k:'thigh',l:'Udo',down:false},
  {k:'hips',l:'Biodra',down:true},
];
let msChartKey='waist';
function renderMeasures(){
  const box=document.getElementById('msInputs'); if(!box) return;
  if(!box.childElementCount){
    box.innerHTML=MEASURES.map(m=>`<label style="font-size:12px;color:var(--ink-dim)">${m.l}
      <input type="number" step="0.5" inputmode="decimal" class="md-in" id="ms_${m.k}" placeholder="cm" style="margin-top:4px"></label>`).join('');
  }
  const ms=(S.measures||[]).slice().sort((a,b)=>a.d<b.d?-1:1);
  document.getElementById('msEmpty').style.display=ms.length?'none':'block';
  const first=k=>{const x=ms.find(m=>m[k]>0);return x?x[k]:null;};
  const last=k=>{for(let i=ms.length-1;i>=0;i--) if(ms[i][k]>0) return ms[i][k]; return null;};
  const fmt=v=>v.toFixed(1).replace('.',',');
  const half=S.profile&&S.profile.height?S.profile.height/2:null;
  document.getElementById('msTable').innerHTML=ms.length?MEASURES.map(m=>{
    const a=first(m.k), b=last(m.k); if(b===null) return '';
    const dv=b-a, good=m.down?dv<0:dv>0;
    const col=dv===0?'var(--ink-dim)':(good?'#5fbf7a':'var(--red)');
    const sel=m.k===msChartKey?'border-color:var(--amber)':'';
    return `<div data-ms="${m.k}" style="display:flex;justify-content:space-between;padding:8px 10px;border:1px solid var(--line);border-radius:10px;margin-bottom:6px;cursor:pointer;${sel}">
      <span>${m.l}${m.k==='waist'&&half?` <span style="color:var(--ink-faint);font-size:12px">cel &lt; ${fmt(half)}</span>`:''}</span>
      <span><b>${fmt(b)}</b> <span style="color:${col};font-size:13px">${dv>0?'+':''}${fmt(dv)}</span></span></div>`;
  }).join('')+'<div style="font-size:12px;color:var(--ink-faint)">Kliknij wiersz, żeby zobaczyć wykres. Zmiana liczona od pierwszego pomiaru.</div>':'';
  document.querySelectorAll('[data-ms]').forEach(el=>el.onclick=()=>{msChartKey=el.dataset.ms;renderMeasures();});
  const series=ms.filter(m=>m[msChartKey]>0).map(m=>({d:m.d,w:m[msChartKey]}));
  const c=document.getElementById('msChart'); c.style.display=series.length?'block':'none';
  if(series.length) drawChart(series,'msChart');
}
document.getElementById('msSave').onclick=()=>{
  const iso=todayISO(); const vals={}; let any=false;
  MEASURES.forEach(m=>{const v=parseFloat(document.getElementById('ms_'+m.k).value.replace(',','.')); if(v>=10&&v<=250){vals[m.k]=v;any=true;}});
  if(!any){document.getElementById('ms_waist').focus();return;}
  if(!S.measures) S.measures=[];
  let e=S.measures.find(x=>x.d===iso);
  if(!e){e={d:iso};S.measures.push(e);}
  Object.assign(e,vals); e._t=Date.now();
  MEASURES.forEach(m=>document.getElementById('ms_'+m.k).value='');
  save(); renderMeasures();
};

function drawChart(ws, canvasId){
  const c=document.getElementById(canvasId||'wChart');
  const dpr=window.devicePixelRatio||1;
  const W=c.clientWidth||600, H=180;
  c.width=W*dpr; c.height=H*dpr; c.getContext('2d').scale(dpr,dpr);
  const ctx=c.getContext('2d');
  ctx.clearRect(0,0,W,H);
  if(ws.length<1)return;
  if(ws.length===1){
    ctx.fillStyle='#ff7a1a';ctx.beginPath();ctx.arc(W/2,H/2,5,0,7);ctx.fill();
    ctx.fillStyle='#9aa3ab';ctx.font='13px Inter';ctx.textAlign='center';
    ctx.fillText(ws[0].w.toFixed(1)+(canvasId==='msChart'?' cm':' kg'),W/2,H/2-14);
    return;
  }
  const pad={l:36,r:12,t:16,b:22};
  // oś X = czas: kropki stoją w swoich dniach, przerwa 5 dni wygląda jak 5 dni
  const DAY=86400000;
  const ts=ws.map(p=>parseISO(p.d).getTime()), ys=ws.map(p=>p.w);
  const t0=ts[0], span=Math.max(ts[ts.length-1]-t0, DAY);
  const minY=Math.min(...ys)-0.5, maxY=Math.max(...ys)+0.5;
  const X=i=>pad.l+(W-pad.l-pad.r)*((ts[i]-t0)/span);
  const XT=t=>pad.l+(W-pad.l-pad.r)*((t-t0)/span);
  const Y=v=>pad.t+(H-pad.t-pad.b)*(1-(v-minY)/(maxY-minY));
  // grid
  ctx.strokeStyle='#2a3138';ctx.lineWidth=1;ctx.fillStyle='#5f6a72';ctx.font='10px Inter';ctx.textAlign='right';
  if(!canvasId) cyChartBands(ctx, XT, t0, span, pad, W, H);   // dni okresu i tydzień przed nim
  for(let g=0;g<=3;g++){const v=minY+(maxY-minY)*g/3;const y=Y(v);ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();ctx.fillText(v.toFixed(1),pad.l-6,y+3)}
  // daty pod osią: co 1/2/4… tygodnie, tak by zmieściło się ~5 etykiet
  const days=span/DAY, stepW=[1,2,4,8,13].find(s=>days/(7*s)<=5)||26;
  const lab=t=>{const d=new Date(t);return String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0');};
  ctx.textAlign='center';
  for(let t=t0; t<=t0+span+1; t+=stepW*7*DAY){
    const x=XT(t);
    ctx.strokeStyle='#22282e';ctx.beginPath();ctx.moveTo(x,pad.t);ctx.lineTo(x,H-pad.b);ctx.stroke();
    ctx.fillText(lab(t),Math.min(Math.max(x,pad.l+14),W-pad.r-14),H-6);
  }
  // wygładzony trend (EMA w czasie: dłuższa przerwa = nowy pomiar waży więcej)
  const ema=[];let prev=ys[0];const tau=4*DAY;
  ys.forEach((v,i)=>{const a=i?1-Math.exp(-(ts[i]-ts[i-1])/tau):1; prev=a*v+(1-a)*prev; ema.push(prev);});
  ctx.strokeStyle='#5fa8d3';ctx.lineWidth=2.5;ctx.beginPath();ema.forEach((v,i)=>{i?ctx.lineTo(X(i),Y(v)):ctx.moveTo(X(i),Y(v))});ctx.stroke();
  // raw dots
  ctx.fillStyle='#ff7a1a';ws.forEach((p,i)=>{ctx.beginPath();ctx.arc(X(i),Y(p.w),3,0,7);ctx.fill()});
  // last label
  const li=ws.length-1;ctx.fillStyle='#f2f0ea';ctx.font='bold 12px Inter';ctx.textAlign='left';
  ctx.fillText(ws[li].w.toFixed(1),X(li)-24,Y(ws[li].w)-9);
}

/* ============================================================
   LISTA ZAKUPÓW — generowana z wariantów AKTUALNEGO tygodnia
   ============================================================ */
// lista zakupów agregowana ze składników aktywnych wariantów tygodnia
// kategorie zakupowe dla składników (klucz FOODS -> kategoria)
const FOOD_CAT = {
  kurczak:'Mięso i ryby', indyk:'Mięso i ryby', wolowina_chuda:'Mięso i ryby', wolowina_stir:'Mięso i ryby', rostbef:'Mięso i ryby', karkowka:'Mięso i ryby', poledwiczka:'Mięso i ryby', gulasz_wol:'Mięso i ryby', zeberka_drob:'Mięso i ryby', klopsiki_drob:'Mięso i ryby', kielbaski_drob:'Mięso i ryby', boczek_chudy:'Mięso i ryby', szynka_drob:'Mięso i ryby', wedlina_drob:'Mięso i ryby', losos:'Mięso i ryby', dorsz:'Mięso i ryby', makrela:'Mięso i ryby', tunczyk:'Mięso i ryby', tunczyk_stek:'Mięso i ryby', krewetki:'Mięso i ryby',
  jajko:'Nabiał i jaja', twarog:'Nabiał i jaja', twarozek:'Nabiał i jaja', serek_wiejski:'Nabiał i jaja', serek_light:'Nabiał i jaja', skyr:'Nabiał i jaja', jogurt:'Nabiał i jaja', mleko:'Nabiał i jaja', maslo:'Nabiał i jaja', mozzarella:'Nabiał i jaja', feta:'Nabiał i jaja', ser_zolty:'Nabiał i jaja',
  chleb_zytni:'Węglowodany', grzanka:'Węglowodany', pieczywo_chrup:'Węglowodany', wafle_ryz:'Węglowodany', platki_ows:'Węglowodany', platki_jagl:'Węglowodany', maka_ows:'Węglowodany', maka_psz:'Węglowodany', granola:'Węglowodany', ryz:'Węglowodany', kasza_gr:'Węglowodany', kasza_jag:'Węglowodany', bulgur:'Węglowodany', makaron_pz:'Węglowodany', ziemniaki:'Węglowodany', bataty:'Węglowodany',
  banan:'Warzywa i owoce', jablko:'Warzywa i owoce', awokado_p:'Warzywa i owoce', warzywa:'Warzywa i owoce', pomidor:'Warzywa i owoce', owoce_jagod:'Warzywa i owoce', kukurydza:'Warzywa i owoce', oliwki:'Warzywa i owoce', sok:'Warzywa i owoce',
  oliwa:'Tłuszcze i dodatki', orzechy:'Tłuszcze i dodatki', migdaly:'Tłuszcze i dodatki', pestki_dyni:'Tłuszcze i dodatki', maslo_orze:'Tłuszcze i dodatki', wpc:'Tłuszcze i dodatki', dzem:'Tłuszcze i dodatki', miod:'Tłuszcze i dodatki', hummus:'Tłuszcze i dodatki', siemie:'Tłuszcze i dodatki', kokos_light:'Tłuszcze i dodatki',
};
const SHOP_CATS_ORDER=["Mięso i ryby","Nabiał i jaja","Węglowodany","Warzywa i owoce","Tłuszcze i dodatki"];
// agreguj rzeczywiste gramatury/sztuki składników z aktywnych wariantów tygodnia
// który tydzień planu oglądać na liście zakupów (wg aktualnie oglądanego dnia; poza planem → 1)
function currentShopWeek(){
  const di=dayIndexFor(viewDateISO());
  const wk=weekOf(di);
  return (wk>=1&&wk<=24)?wk:1;
}
function buildWeekShop(wk){
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
function renderShop(){
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

/* ============================================================
   REMINDERS (systemowe powiadomienia + baner w aplikacji jako fallback)
   ============================================================ */
let notifTimers=[];
const NOTIF_SUPPORTED = (typeof Notification !== 'undefined');
function notifPerm(){ return NOTIF_SUPPORTED ? Notification.permission : 'unsupported'; }

const REMINDER_ITEMS = ()=>[
  {key:'workout',t:S.reminders.workout,title:'🏋️ Czas na trening',body:'Sprawdź dzisiejszą sesję w ŻELAZO.'},
  {key:'water',t:S.reminders.water,title:'💧 Pij wodę',body:'Cel to 3 litry dziennie. Jak stoisz?'},
  {key:'weight',t:S.reminders.weight,title:'⚖️ Zważ się',body:'Rano, na czczo. Zapisz wagę i śledź trend.'},
];

function setupReminders(){
  notifTimers.forEach(t=>clearTimeout(t));notifTimers=[];
  if(!S.reminders.on) return;
  const useSystem = NOTIF_SUPPORTED && Notification.permission==='granted';
  mtScheduleReminders(useSystem);
  REMINDER_ITEMS().forEach(it=>{
    if(!it.t)return;
    const[h,m]=it.t.split(':').map(Number);
    const now=new Date();const next=new Date();next.setHours(h,m,0,0);
    if(next<=now)next.setDate(next.getDate()+1);
    const ms=next-now;
    if(ms<86400000*2){
      notifTimers.push(setTimeout(function fire(){
        fireReminder(it, useSystem);
        notifTimers.push(setTimeout(fire,86400000)); // codziennie o tej samej porze
      },ms));
    }
  });
}
function fireReminder(it, useSystem){
  // spróbuj systemowego powiadomienia; jeśli się nie uda — pokaż baner w aplikacji
  if(useSystem){
    try{ new Notification(it.title,{body:it.body}); return; }catch(e){}
  }
  showInAppReminder(it.title, it.body);
}
// baner w aplikacji — działa nawet z pliku lokalnego i na telefonie, gdy apka jest otwarta
function showInAppReminder(title, body){
  let bar=document.getElementById('reminderBar');
  if(!bar){
    bar=document.createElement('div');
    bar.id='reminderBar';
    bar.innerHTML='<div class="rb-in"><div class="rb-txt"><div class="rb-t"></div><div class="rb-b"></div></div><button class="rb-x">✕</button></div>';
    document.body.appendChild(bar);
    bar.querySelector('.rb-x').onclick=()=>bar.classList.remove('show');
  }
  bar.querySelector('.rb-t').textContent=title;
  bar.querySelector('.rb-b').textContent=body;
  bar.classList.add('show');
  clearTimeout(bar._hide);
  bar._hide=setTimeout(()=>bar.classList.remove('show'),8000);
}
function refreshNotifUI(){
  const tgl=document.getElementById('notifToggle');
  const perm=notifPerm();
  const on=S.reminders.on;
  tgl.classList.toggle('on',on);
  let msg;
  if(!on) msg='Wyłączone — stuknij, aby włączyć';
  else if(perm==='granted') msg='Włączone — powiadomienia systemowe';
  else if(perm==='denied') msg='Włączone — baner w aplikacji (powiadomienia zablokowane w przeglądarce)';
  else if(perm==='unsupported') msg='Włączone — baner w aplikacji (przeglądarka nie wspiera powiadomień)';
  else msg='Włączone — baner w aplikacji';
  document.getElementById('notifState').textContent=msg;
}
document.getElementById('notifToggle').onclick=async()=>{
  if(S.reminders.on){ // wyłącz
    S.reminders.on=false;S._settingsM=Date.now();save();setupReminders();refreshNotifUI();return;
  }
  // włącz
  S.reminders.on=true;S._settingsM=Date.now();save();setupReminders();refreshNotifUI();
  // spróbuj uzyskać zgodę na powiadomienia systemowe; jeśli się nie da — działa baner w apce
  if(NOTIF_SUPPORTED && Notification.permission==='default'){
    try{
      const p=await Notification.requestPermission();
      refreshNotifUI();
      if(p==='granted'){ try{new Notification('✅ Przypomnienia włączone',{body:'Będę Cię pilnować.'})}catch(e){} return; }
    }catch(e){ refreshNotifUI(); }
  }
  // potwierdzenie działania fallbacku
  showInAppReminder('✅ Przypomnienia włączone', NOTIF_SUPPORTED && Notification.permission==='granted' ? 'Powiadomienia systemowe aktywne.' : 'Będą pokazywać się jako baner, gdy aplikacja jest otwarta.');
};
// przycisk testowy
const btnTestNotif=document.getElementById('btnTestNotif');
if(btnTestNotif) btnTestNotif.onclick=()=>{
  if(NOTIF_SUPPORTED && Notification.permission==='granted'){ try{new Notification('🔔 Test',{body:'Tak wygląda przypomnienie ŻELAZO.'});return;}catch(e){} }
  showInAppReminder('🔔 Test przypomnienia','Tak wygląda baner w aplikacji.');
};

/* ============================================================
   NAV + INIT
   ============================================================ */
// Trening i Dieta pokazują ten sam dzień; pasek dnia i przełącznik tylko w nich
/* ---- menu Więcej: podsekcja zamiast długiego przewijania; „wstecz” w telefonie wraca do menu ---- */
const MORE_TITLES={cw:['Ćwiczenia','Nauka techniki'],prof:['Profil i plan','Profil · kalorie · start'],sync:['Synchronizacja','Chmura · zużycie AI · konta'],
  rem:['Przypomnienia','Powiadomienia'],data:['Kopia i dane','Eksport · import · plik'],ver:['Wersja aplikacji','Stabilna, beta albo poprzednia'],
  plan:['Pakiet i limity','Twój plan · Trener AI'], adm:['Konta i plany','Administrator · USERS']};
function moreOpen(sec, fromHistory){
  const v=document.getElementById('v-set'); v.dataset.sec=sec||'';
  const t=MORE_TITLES[sec];
  document.getElementById('moreBack').style.display=t?'inline-flex':'none';
  document.getElementById('moreTitle').textContent=t?t[0]:'Ustawienia';
  document.getElementById('moreEyebrow').textContent=t?t[1]:'Konfiguracja';
  if(sec==='cw') renderExLib();
  if(sec==='plan'){ renderPlanQuota(); quotaLoad(); }
  if(sec==='adm') apLoad();
  if(!sec) moreStatus();
  // jeden wpis w historii na podsekcję: „wstecz” zawsze wraca do menu
  try{ if(sec && !fromHistory){ if(history.state&&history.state.more) history.replaceState({more:sec},''); else history.pushState({more:sec},''); }
       else if(!sec && !fromHistory && history.state&&history.state.more) history.replaceState(null,''); }catch(e){}
  window.scrollTo(0,0);
}
function moreStatus(){
  const set=(id,t,warn)=>{ const e=document.getElementById(id); if(e){ e.textContent=t; e.classList.toggle('warn',!!warn); } };
  const p=S.profile||{}, st=parseISO(S.startDate);
  set('mmProf', `${p.name||'bez imienia'} · ${S.kcalGoal||DEFAULT_KCAL} kcal · start ${st.getDate()}.${String(st.getMonth()+1).padStart(2,'0')}`);
  set('mmSync', !CLOUD.on ? 'Wyłączona' : CLOUD.lastError ? '⚠ Ostatnia synchronizacja nieudana' : 'Włączona · konto '+(CLOUD.account||'—'), CLOUD.on&&CLOUD.lastError);
  set('mmRem', S.reminders&&S.reminders.on ? 'Włączone · trening '+S.reminders.workout : 'Wyłączone');
  set('mmVer', ({stable:'Stabilna · v1.2', early:'Early Access', users:'USERS'})[APP_VER] || 'Beta');
  { const q=quotaCur(); set('mmPlan', q ? `Zostało ${quotaLeft('coach')} z ${q.coach.max} pytań · ${quotaLeft('form')} z ${q.form.max} nagrań · ${quotaLeft('est')} z ${q.est.max} szacowań` : 'Limity Trenera AI', q&&quotaLeft('coach')===0); }
  { const c=cyGet(), on=cyTracking(), btn=document.getElementById('mmCycleBtn');
    if(btn) btn.style.display=(on || c.on || (S.profile&&S.profile.sex==='f')) ? '' : 'none';   // proponowane przy profilu kobiety albo gdy już włączone
    set('mmCycle', on ? (CY_SIT.find(x=>x[0]===c.sit)||['',''])[1]+(c.sync?' · synchronizowane':' · tylko na tym telefonie') : 'Wyłączone · dobrowolne'); }
  { const r=Object.values((S.adj&&S.adj.rest)||{}); set('mmRest', r.length ? 'Zmienione: '+r.length+(r.some(x=>x.by==='tr')?' (także od Trenera)':'') : 'Z planu · zmień przy ćwiczeniu'); }
  const n=exLibrary().reduce((a,g)=>a+g.ex.length,0), last=loadCoach().filter(m=>m.kind==='form').pop();
  const pl=n===1?'ćwiczenie':(n%10>=2&&n%10<=4&&(n%100<12||n%100>14))?'ćwiczenia':'ćwiczeń';
  set('mmCw', n+' '+pl+(last?' · ostatnio: '+(last.ex||'')+' — '+(last.grade||''):' · nagraj serię i dostań ocenę'));
}
document.getElementById('moreBack').onclick=()=>{ if(history.state&&history.state.more) history.back(); else moreOpen(''); };
document.querySelectorAll('[data-more]').forEach(b=>b.onclick=()=>moreOpen(b.dataset.more));
document.querySelectorAll('#moreMenu [data-rest-list]').forEach(b=>b.onclick=()=>openRestList(todayISO()));
document.querySelectorAll('#moreMenu [data-cycle]').forEach(b=>b.onclick=()=>openCycle());
window.addEventListener('popstate',()=>{ const v=document.getElementById('v-set'); if(v.dataset.sec) moreOpen('', true); });
function showView(v){
  document.querySelectorAll('.nav button').forEach(x=>x.classList.toggle('on', x.dataset.v===v));
  document.querySelectorAll('.view').forEach(x=>x.classList.toggle('on', x.id==='v-'+v));
  document.body.classList.toggle('daily', v==='train'||v==='diet');
  window.scrollTo(0,0);
  if(v==='progress'){ renderWeight(); renderPlan(); }
  if(v==='train'){ CYC=null; cyRenderBox(viewDateISO()); }   // dane o cyklu mogły się zmienić w Więcej
  if(v==='set'){ loadUsage(); moreOpen(''); }   // „Więcej” zawsze startuje od menu; świeże zużycie AI
  if(v==='shop')renderShop();
}
document.querySelectorAll('.nav button').forEach(b=>{ b.onclick=()=>showView(b.dataset.v); });
document.getElementById('prevDay').onclick=()=>{viewOffset--;renderToday()};
document.getElementById('nextDay').onclick=()=>{viewOffset++;renderToday()};
document.getElementById('dayMid').onclick=()=>{ if(viewOffset!==0){ viewOffset=0; renderToday(); } };
// przesunięcie palcem w bok na treści = poprzedni / następny dzień
(()=>{
  let sx=null, sy=null;
  const on=()=>document.body.classList.contains('daily');
  document.addEventListener('touchstart',e=>{
    // nie przechwytuj przesunięć w polach, oknach dialogowych i na pasku zakładek
    if(!on() || e.target.closest('input,textarea,.nav,.dayswitch,#mealDialog,#coachDialog,#guideDialog,#profileDialog,#joinDialog')){ sx=null; return; }
    const t=e.touches[0]; sx=t.clientX; sy=t.clientY;
  },{passive:true});
  document.addEventListener('touchend',e=>{
    if(sx===null || !on()) return;
    const t=e.changedTouches[0], dx=t.clientX-sx, dy=t.clientY-sy; sx=null;
    if(Math.abs(dx)>70 && Math.abs(dy)<45){ viewOffset+=dx<0?1:-1; renderToday(); }
  },{passive:true});
})();

// weight save
document.getElementById('weightSave').onclick=()=>{
  const v=parseFloat(document.getElementById('weightInput').value);
  if(!v||v<30||v>300){document.getElementById('weightInput').focus();return}
  const iso=todayISO();
  const ex=S.weights.find(x=>x.d===iso);
  if(ex)ex.w=v; else S.weights.push({d:iso,w:v});
  save();document.getElementById('weightInput').value='';renderWeight();updateStreak();
};
document.getElementById('weightInput').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('weightSave').click()});

// shop reset
document.getElementById('shopReset').onclick=()=>{const now=Date.now();if(!S.shopT)S.shopT={};Object.keys(S.shop||{}).forEach(k=>{if(S.shop[k]){S.shop[k]=false;S.shopT[k]=now;}});save();renderShop()};

// settings: start date
const sd=document.getElementById('startDate');
sd.value=S.startDate;
sd.onchange=()=>{S.startDate=sd.value;S._settingsM=Date.now();save();renderToday()};

// settings: cel kaloryczny (suwak)
const kcalSlider=document.getElementById('kcalSlider');
// szacowane utrzymanie z profilu (Mifflin-St Jeor × aktywność)
function estMaintenance(){
  const p=S.profile||{weight:104,height:186,age:45,sex:'m',activity:1.465};
  const s = (p.sex==='f') ? -161 : 5;
  const bmr = 10*p.weight + 6.25*p.height - 5*p.age + s;
  return Math.round(bmr*(p.activity||1.465));
}
function updateKcalHint(){
  const k=+kcalSlider.value;
  document.getElementById('kcalVal').textContent=k;
  const maint=estMaintenance();
  const deficit=maint-k;
  const perWeek=(deficit*7/7700); // 7700 kcal ≈ 1 kg tłuszczu
  let msg;
  if(deficit<=0) msg=`To poziom utrzymania lub nadwyżka — waga nie spadnie. Zejdź poniżej ~${maint} kcal, by chudnąć.`;
  else msg=`Deficyt ~${deficit} kcal/dzień → ok. <b>${perWeek.toFixed(2).replace('.',',')} kg tłuszczu tygodniowo</b>. ${deficit>700?'Szybko — pilnuj białka i regeneracji.':deficit>400?'Solidne, realne tempo.':'Łagodnie i komfortowo.'}`;
  document.getElementById('kcalHint').innerHTML=msg;
  const g=macroGoalFor(k);
  document.getElementById('macroHint').textContent=`Cele makro: białko ${g.p} g · węgle ${g.c} g · tłuszcz ${g.f} g`;
}
kcalSlider.value=S.kcalGoal||DEFAULT_KCAL;
updateKcalHint();
kcalSlider.addEventListener('input',updateKcalHint);
kcalSlider.addEventListener('change',()=>{const prev=S.kcalGoal||DEFAULT_KCAL;S.kcalGoal=+kcalSlider.value;kcalRecord(S.kcalGoal,prev);S._settingsM=Date.now();save();renderToday();if(document.getElementById('v-progress').classList.contains('on'))renderWeight()});

// settings: profil
const pf={name:'pfName',weight:'pfWeight',height:'pfHeight',age:'pfAge',sex:'pfSex',activity:'pfAct'};
function loadProfileUI(){
  const p=S.profile;
  document.getElementById('pfName').value=p.name||'';
  document.getElementById('pfWeight').value=p.weight;
  document.getElementById('pfHeight').value=p.height;
  document.getElementById('pfAge').value=p.age;
  document.getElementById('pfSex').value=p.sex||'m';
  document.getElementById('pfAct').value=String(p.activity||1.465);
  updateTdee();
}
function updateTdee(){
  document.getElementById('pfTdee').textContent=estMaintenance();
}
// zapis pojedynczego pola profilu — nie rusza pozostałych, nie wywołuje wrażenia zmiany kalorii
function saveProfileField(key){
  if(key==='name'){ S.profile.name=document.getElementById('pfName').value.trim(); S._settingsM=Date.now(); save(); applyName(); return; }
  if(key==='weight') S.profile.weight=parseFloat(document.getElementById('pfWeight').value)||S.profile.weight;
  if(key==='height') S.profile.height=parseFloat(document.getElementById('pfHeight').value)||S.profile.height;
  if(key==='age')    S.profile.age=parseInt(document.getElementById('pfAge').value)||S.profile.age;
  if(key==='sex')    S.profile.sex=document.getElementById('pfSex').value;
  if(key==='activity')S.profile.activity=parseFloat(document.getElementById('pfAct').value)||1.465;
  S._settingsM=Date.now();
  save();
  updateTdee(); updateKcalHint(); // tylko pola liczbowe odświeżają zapotrzebowanie
}
function applyName(){
  const nm=(S.profile&&S.profile.name)?S.profile.name.trim():'';
  let tag=document.getElementById('brandName');
  if(nm){
    if(!tag){tag=document.createElement('span');tag.id='brandName';tag.style.cssText='font-size:13px;color:var(--ink-dim);margin-left:8px;align-self:center';document.querySelector('.brand').appendChild(tag);}
    tag.textContent=nm;
  } else if(tag){ tag.remove(); }
}
Object.keys(pf).forEach(key=>{
  const el=document.getElementById(pf[key]);
  el.addEventListener('change',()=>saveProfileField(key));
  // podgląd TDEE na żywo tylko dla pól liczbowych i tylko lokalnie (bez zapisu)
  if(key==='weight'||key==='height'||key==='age'){
    el.addEventListener('input',()=>{
      const w=parseFloat(document.getElementById('pfWeight').value)||S.profile.weight;
      const h=parseFloat(document.getElementById('pfHeight').value)||S.profile.height;
      const a=parseInt(document.getElementById('pfAge').value)||S.profile.age;
      const s=(document.getElementById('pfSex').value==='f')?-161:5;
      const bmr=10*w+6.25*h-5*a+s;
      document.getElementById('pfTdee').textContent=Math.round(bmr*(parseFloat(document.getElementById('pfAct').value)||1.465));
    });
  }
});
loadProfileUI();
applyName();

// meal dialog buttons
/* ---- skaner kodów kreskowych ----
   Kod z opakowania → Open Food Facts (otwarta baza produktów; bez AI, więc bez limitów) → kcal i makro na 100 g × porcja.
   Aparat: BarcodeDetector (Android/Chrome); bez niego biblioteka ZXing z CDN, wczytywana dopiero przy pierwszym skanie.
   Znalezione produkty zostają na telefonie (zelazo_bc), więc drugi raz działają też bez internetu.
   „Wstaw” dodaje produkt do pól posiłku — kilka skanów składa się w jeden posiłek. */
/* global ZXing */   // biblioteka skanera wczytywana z CDN dopiero przy pierwszym skanie
const ZXING_URL='https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
var BC={stream:null, timer:null, zx:null, busy:false};
function bcCache(){ try{ return JSON.parse(localStorage.getItem('zelazo_bc')||'{}'); }catch(e){ return {}; } }
function bcRemember(p){
  const c=bcCache(); c[p.code]=Object.assign({}, p, {t:Date.now()});
  Object.keys(c).sort((a,b)=>c[b].t-c[a].t).slice(40).forEach(k=>delete c[k]);
  try{ localStorage.setItem('zelazo_bc', JSON.stringify(c)); }catch(e){}
}
const bcNum=x=>String(Math.round(x*10)/10).replace('.',',');
function bcView(title, html){
  const pn=document.getElementById('bcPanel');
  pn.innerHTML=`<div class="eh-grab"></div>
    <div class="eh-head"><div style="flex:1;min-width:0"><div class="eyebrow">Kod kreskowy · Open Food Facts</div><h2 id="bcTitle">${title}</h2></div><button class="eh-x" data-bcclose aria-label="Zamknij">✕</button></div>`+html;
  pn.querySelectorAll('[data-bcclose]').forEach(b=>b.onclick=bcClose);
}
function openScanner(){
  BC.busy=false;
  const recent=Object.values(bcCache()).sort((a,b)=>b.t-a.t).slice(0,5);
  bcView('Skanuj kod', `<div class="bc-cam"><video id="bcVideo" playsinline muted autoplay></video><div class="bc-frame"></div></div>
    <div class="bc-st" id="bcSt">Włączam aparat…</div>
    <div class="bc-man"><input class="md-in" id="bcCode" inputmode="numeric" autocomplete="off" placeholder="albo wpisz cyfry spod kodu"><button class="btn" id="bcGo" type="button">Szukaj</button></div>
    ${recent.length?`<div class="eyebrow" style="margin-bottom:-4px">Ostatnio skanowane</div><div class="bc-recent">${recent.map(p=>`<button type="button" data-bcpick="${esc(p.code)}"><span>${esc(p.name)}</span><small>${Math.round(p.kcal)} kcal / 100 ${p.liquid?'ml':'g'}</small></button>`).join('')}</div>`:''}
    <div class="md-hint" style="margin:0">Do bazy wysyłamy tylko numer kodu. Skanowanie nie używa AI i nie ma limitu.</div>`);
  document.getElementById('bcSheet').style.display='flex';
  document.getElementById('bcGo').onclick=()=>bcFound(document.getElementById('bcCode').value);
  document.getElementById('bcCode').addEventListener('keydown',e=>{ if(e.key==='Enter') bcFound(e.target.value); });
  document.querySelectorAll('[data-bcpick]').forEach(b=>b.onclick=()=>{ bcStop(); bcShow(bcCache()[b.dataset.bcpick]); });
  bcStart();
}
function bcLoadZxing(){
  if(window.ZXing) return Promise.resolve();
  return new Promise((ok,no)=>{ const sc=document.createElement('script'); sc.src=ZXING_URL; sc.onload=ok; sc.onerror=()=>no(new Error('zxing')); document.head.appendChild(sc); });
}
async function bcStart(){
  const v=document.getElementById('bcVideo'), st=document.getElementById('bcSt');
  const say=t=>{ if(st && document.body.contains(st)) st.textContent=t; };
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ say('Ta przeglądarka nie daje dostępu do aparatu — wpisz cyfry spod kodu.'); return; }
  try{
    let fmts=[];
    if('BarcodeDetector' in window){ try{ fmts=await BarcodeDetector.getSupportedFormats(); }catch(e){} }
    if(fmts.includes('ean_13')){
      BC.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}, audio:false});
      if(!document.body.contains(v)){ bcStop(); return; }
      v.srcObject=BC.stream; await v.play();
      const det=new BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e'].filter(f=>fmts.includes(f))});
      say('Nakieruj aparat na kod kreskowy.');
      const tick=async()=>{
        if(!BC.stream) return;
        try{ const r=await det.detect(v); if(r.length){ bcFound(r[0].rawValue); return; } }catch(e){}
        BC.timer=setTimeout(tick, 180);
      };
      tick();
    }else{
      say('Wczytuję skaner…');
      await bcLoadZxing();
      if(!document.body.contains(v)) return;
      const hints=new Map();
      hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8, ZXing.BarcodeFormat.UPC_A, ZXing.BarcodeFormat.UPC_E]);
      BC.zx=new ZXing.BrowserMultiFormatReader(hints);
      say('Nakieruj aparat na kod kreskowy.');
      await BC.zx.decodeFromConstraints({video:{facingMode:'environment'}, audio:false}, v, res=>{ if(res && BC.zx) bcFound(res.getText()); });
    }
  }catch(e){
    const cam=document.querySelector('.bc-cam'); if(cam) cam.style.display='none';   // bez aparatu zostaje wpisanie cyfr
    say(e.message==='zxing' ? 'Skaner potrzebuje internetu przy pierwszym użyciu. Możesz wpisać cyfry spod kodu.'
      : /NotAllowed|Permission|Security/i.test((e.name||'')+(e.message||'')) ? 'Brak zgody na aparat — zezwól na niego w ustawieniach przeglądarki albo wpisz cyfry spod kodu.'
      : 'Nie udało się włączyć aparatu — wpisz cyfry spod kodu.');
  }
}
function bcStop(){
  clearTimeout(BC.timer); BC.timer=null;
  if(BC.zx){ try{ BC.zx.reset(); }catch(e){} BC.zx=null; }
  if(BC.stream){ BC.stream.getTracks().forEach(t=>t.stop()); BC.stream=null; }
}
function bcClose(){ bcStop(); const sh=document.getElementById('bcSheet'); if(sh) sh.style.display='none'; }
async function bcFound(raw){
  const code=String(raw||'').replace(/\D/g,'');
  if(code.length<8 || BC.busy) return;
  BC.busy=true; bcStop();
  if(navigator.vibrate) navigator.vibrate(60);
  const hit=bcCache()[code];
  if(hit){ bcShow(hit); return; }
  bcView('Szukam…', `<div class="bc-st">Szukam produktu o kodzie ${code}…</div>`);
  if(!navigator.onLine){ bcMiss(code, 'Brak internetu, a tego produktu nie ma jeszcze na telefonie. Spróbuj, gdy wróci zasięg, albo wpisz kalorie z etykiety.'); return; }
  try{
    const ctl=new AbortController(), to=setTimeout(()=>ctl.abort(), 9000);
    const r=await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_pl,brands,nutriments,serving_quantity,quantity`, {signal:ctl.signal});
    clearTimeout(to);
    const j=await r.json(), p=j.product, n=(p&&p.nutriments)||{};
    let kcal=n['energy-kcal_100g'];
    if(kcal==null && n.energy_100g!=null) kcal=n.energy_100g/4.184;   // tylko kJ na etykiecie
    if(j.status!==1 || !p){ bcMiss(code, 'Nie ma tego produktu w bazie Open Food Facts.'); return; }
    if(kcal==null){ bcMiss(code, 'Produkt jest w bazie, ale bez wartości odżywczych.'); return; }
    const prod={code, name:String(p.product_name_pl||p.product_name||'Produkt '+code).trim(), brand:String(p.brands||'').split(',')[0].trim(),
      kcal:+kcal, p:+(n.proteins_100g||0), c:+(n.carbohydrates_100g||0), f:+(n.fat_100g||0),
      serv:+p.serving_quantity||0, liquid:/\d\s*(ml|cl|l)\b/i.test(p.quantity||'')};
    bcRemember(prod); bcShow(prod);
  }catch(e){ bcMiss(code, 'Nie udało się połączyć z bazą produktów. Spróbuj ponownie.'); }
}
function bcMiss(code, msg){
  bcView('Nie znaleziono', `<div class="bc-st">${esc(msg)}</div><div class="bc-st" style="font-size:13px">Kod: ${esc(code)}</div>
    <button class="btn" id="bcDescribe" type="button">Opisz posiłek słowami</button>
    <button class="btn ghost" id="bcAgain" type="button">Skanuj ponownie</button>`);
  document.getElementById('bcDescribe').onclick=()=>{ bcClose(); document.getElementById('mdTxt').focus(); };
  document.getElementById('bcAgain').onclick=openScanner;
}
function bcShow(p){
  const u=p.liquid?'ml':'g', serv=p.serv>0?Math.round(p.serv):0, g0=serv||100;
  const chips=[...new Set([serv,50,100,150,200].filter(x=>x>0))].slice(0,4);
  bcView('Produkt', `<div class="bc-prod"><b>${esc(p.name)}</b>${p.brand && p.brand.toLowerCase()!==p.name.toLowerCase()?`<small>${esc(p.brand)}</small>`:''}
      <div class="bc-100">Na 100 ${u}: <b>${Math.round(p.kcal)} kcal</b> · B ${bcNum(p.p)} / W ${bcNum(p.c)} / T ${bcNum(p.f)} g</div></div>
    <div><label class="md-lab" for="bcG" style="margin-top:0">Porcja (${u})</label>
      <input type="number" class="md-in" id="bcG" inputmode="decimal" min="1" value="${g0}">
      <div class="bc-chips">${chips.map(x=>`<button type="button" data-bcg="${x}">${x} ${u}${x===serv?' · porcja':''}</button>`).join('')}</div></div>
    <div class="bc-sum" id="bcSum"></div>
    <button class="btn" id="bcUse" type="button">Wstaw do posiłku</button>
    <button class="btn ghost" id="bcAgain" type="button">Skanuj inny produkt</button>
    <div class="md-hint" style="margin:0">Dane z Open Food Facts, wpisywane przez użytkowników — gdy coś nie pasuje do etykiety, popraw liczby w posiłku.</div>`);
  const inp=document.getElementById('bcG');
  const qty=()=>Math.max(0, parseFloat(String(inp.value).replace(',','.'))||0);
  const part=g=>({kcal:Math.round(p.kcal*g/100), p:Math.round(p.p*g/100), c:Math.round(p.c*g/100), f:Math.round(p.f*g/100)});
  const upd=()=>{ const x=part(qty()); document.getElementById('bcSum').innerHTML=`<b>${x.kcal} kcal</b> · B ${x.p} / W ${x.c} / T ${x.f} g`; document.getElementById('bcUse').disabled=!qty(); };
  inp.addEventListener('input', upd);
  document.querySelectorAll('[data-bcg]').forEach(b=>b.onclick=()=>{ inp.value=b.dataset.bcg; upd(); });
  document.getElementById('bcAgain').onclick=openScanner;
  document.getElementById('bcUse').onclick=()=>{
    const g=qty(); if(!g) return;
    const x=part(g), add=(id,v)=>{ const el=document.getElementById(id); el.value=(parseInt(el.value)||0)+v; };
    const t=document.getElementById('mdTxt'), item=`${p.name} ${bcNum(g)} ${u}`;
    t.value=t.value.trim() ? t.value.trim()+' + '+item : item;
    add('mdKcal', x.kcal); add('mdP', x.p); add('mdC', x.c); add('mdF', x.f);
    const msg=document.getElementById('mdEstMsg');
    msg.style.display='block'; msg.style.color='var(--steel)'; msg.textContent='Dodano z kodu: '+item+' · '+x.kcal+' kcal. Zeskanuj kolejny produkt, żeby dodać go do tego posiłku.';
    bcClose();
  };
  upd();
}
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
  if(!CLOUD.url||!CLOUD.token){ msg.style.display='block'; msg.style.color='var(--red)'; msg.textContent='Najpierw skonfiguruj synchronizację w chmurze (URL + token) w „Więcej".'; return; }
  if(quotaLeft('est')===0){   // plan z limitami: miesięczny limit szacowań
    msg.style.display='block'; msg.style.color='var(--red)';
    msg.textContent='Limit '+quotaCur().est.max+' szacowań w tym miesiącu wykorzystany. Nowe od '+quotaReset()+'. Kalorie i makro możesz wpisać ręcznie.'; return;
  }
  const btn=document.getElementById('mdEstimate');
  const old=btn.textContent; btn.textContent='⏳ Szacuję...'; btn.disabled=true;
  msg.style.display='block'; msg.style.color='var(--steel)'; msg.textContent='Pytam Claude o wartości odżywcze…';
  try{
    const j=await cloudCall('estimate',{desc});
    if(j.quota) quotaSet(j.quota);
    document.getElementById('mdKcal').value=j.kcal||'';
    document.getElementById('mdP').value=j.p||'';
    document.getElementById('mdC').value=j.c||'';
    document.getElementById('mdF').value=j.f||'';
    msg.textContent='Oszacowano: '+(j.kcal||0)+' kcal · B '+(j.p||0)+' / W '+(j.c||0)+' / T '+(j.f||0)+'. Możesz poprawić.'+(quotaCur()?' Zostało '+quotaLeft('est')+' z '+quotaCur().est.max+' szacowań w tym miesiącu.':'');
  }catch(e){ if(e.data && e.data.quota) quotaSet(e.data.quota); msg.style.color='var(--red)'; msg.textContent='Nie udało się oszacować: '+e.message+(e.data&&e.data.limit?' Kalorie i makro możesz wpisać ręcznie.':''); }
  btn.textContent=old; btn.disabled=false;
};

// ---- cloud sync UI ----
const cloudUrl=document.getElementById('cloudUrl');
const cloudToken=document.getElementById('cloudToken');
const cloudAccount=document.getElementById('cloudAccount');
cloudUrl.value=CLOUD.url||''; cloudToken.value=CLOUD.token||''; cloudAccount.value=CLOUD.account||'';
function readCloudInputs(){ CLOUD.url=cloudUrl.value.trim(); CLOUD.token=cloudToken.value.trim(); CLOUD.account=cloudAccount.value.trim(); saveCloud(); }
[cloudUrl,cloudToken,cloudAccount].forEach(el=>el.addEventListener('change',()=>{readCloudInputs();refreshCloudUI();}));
document.getElementById('cloudToggle').onclick=async()=>{
  readCloudInputs();
  if(CLOUD.on){ CLOUD.on=false; saveCloud(); refreshCloudUI(); return; }
  if(!CLOUD.url||!CLOUD.token||!CLOUD.account){ alert('Uzupełnij URL, token i nazwę konta.'); return; }
  CLOUD.on=true; saveCloud(); refreshCloudUI();
  await cloudPull({silent:true}); // przy włączeniu od razu pobierz i scal
  cloudPush();
};
document.getElementById('cloudTestBtn').onclick=()=>{readCloudInputs();cloudTest();};
document.getElementById('cloudSyncBtn').onclick=()=>{readCloudInputs();cloudPull();};

// ostrzeżenie w pasku dnia: synchronizacja włączona, ale ostatnia próba się nie udała
function updateSyncWarn(){ const b=document.getElementById('syncWarn'); if(b) b.style.display=(CLOUD.on && CLOUD.lastError)?'inline-flex':'none'; }
function refreshCloudUI(statusOverride){
  updateSyncWarn();
  const tgl=document.getElementById('cloudToggle');
  tgl.classList.toggle('on',!!CLOUD.on);
  const el=document.getElementById('cloudState');
  if(statusOverride){ el.textContent=statusOverride; return; }
  if(CLOUD.lastError){ el.textContent='Błąd: '+CLOUD.lastError; el.style.color='var(--red)'; return; }
  el.style.color='';
  if(!CLOUD.on){ el.textContent='Wyłączona'; return; }
  const t=CLOUD.lastSync?new Date(CLOUD.lastSync).toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'}):'—';
  el.textContent='Włączona · ostatnio '+t+' · konto: '+(CLOUD.account||'—');
}
refreshCloudUI();
// przy starcie: jeśli chmura włączona, pobierz najnowsze
if(CLOUD.on && CLOUD.url && CLOUD.account){ cloudPull({silent:true}).then(checkAdmin); }

/* ============================================================
   KONTA: link zaproszenia (#invite=KOD&s=URL_SKRYPTU&n=konto) + panel administratora
   ============================================================ */
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function slugAccount(s){
  return (s||'').toLowerCase().replace(/ł/g,'l').normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,24);
}
// link może wskazywać tylko na Google Apps Script — obca strona nie przejmie danych
const isScriptUrl=u=>/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u||'');
function inviteLink(code, account){
  // zaproszenie zawsze do wersji stabilnej, także gdy wysłane z bety
  return location.origin+location.pathname.replace(/(beta|zeta)\/(index\.html)?$/,'')+'#invite='+encodeURIComponent(code)+'&s='+encodeURIComponent(CLOUD.url)+(account?'&n='+encodeURIComponent(account):'');
}
const INVITE=(()=>{
  const h=new URLSearchParams(location.hash.slice(1));
  const code=h.get('invite'), url=h.get('s');
  return code ? {code, url, account:h.get('n')||''} : null;
})();
function closeJoin(){ document.getElementById('joinDialog').classList.remove('show'); history.replaceState(null,'',location.pathname); }
// link otwarty w już działającej karcie zmienia tylko #… — przeładuj, żeby go obsłużyć
window.addEventListener('hashchange',()=>{ if(/(^|[#&])invite=/.test(location.hash)) location.reload(); });
if(INVITE){
  const inp=document.getElementById('joinName'), msg=document.getElementById('joinMsg');
  inp.value=INVITE.account; inp.readOnly=!!INVITE.account;
  if(!isScriptUrl(INVITE.url)){ msg.style.display='block'; msg.style.color='var(--red)'; msg.textContent='Ten link jest uszkodzony albo nie pochodzi z ŻELAZO. Poproś o nowy.'; document.getElementById('joinOk').disabled=true; }
  document.getElementById('joinDialog').classList.add('show');
  document.getElementById('joinCancel').onclick=closeJoin;
  inp.addEventListener('blur',()=>{ if(!inp.readOnly) inp.value=slugAccount(inp.value); });
  // cudze dane na urządzeniu: wybór w okienku (domyślnie od zera), zanim zużyjemy zaproszenie
  let joinChoice=null;
  const choiceBox=document.getElementById('joinChoice'), moveBtn=document.getElementById('joinMove');
  document.getElementById('joinFresh').onclick=()=>{ joinChoice='fresh'; document.getElementById('joinOk').click(); };
  moveBtn.onclick=()=>{
    if(!moveBtn.dataset.armed){ moveBtn.dataset.armed='1'; moveBtn.textContent='Na pewno? Dane z tego urządzenia trafią na konto „'+slugAccount(inp.value)+'”'; return; }
    joinChoice='move'; document.getElementById('joinOk').click();
  };
  document.getElementById('joinOk').onclick=async()=>{
    const account=slugAccount(inp.value);
    if(account.length<2){ inp.focus(); return; }
    const sameAccount=(CLOUD.account||'').toLowerCase()===account;
    if(!sameAccount && deviceHasData() && !joinChoice){
      document.getElementById('joinWho').textContent=(S.profile&&S.profile.name)?' ('+S.profile.name+')':(CLOUD.account?' (konto „'+CLOUD.account+'”)':'');
      choiceBox.style.display='flex'; document.getElementById('joinOk').style.display='none'; inp.readOnly=true;
      return;
    }
    const btn=document.getElementById('joinOk'); btn.disabled=true; btn.textContent='⏳ Łączę…';
    [document.getElementById('joinFresh'), moveBtn].forEach(b=>b.disabled=true);
    msg.style.display='none';
    try{
      const res=await fetch(INVITE.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'redeem',code:INVITE.code,account})});
      const j=JSON.parse(await res.text());
      if(!j.ok) throw new Error(j.error||'Błąd serwera');
      const same=(CLOUD.account||'').toLowerCase()===j.account;
      clearTimeout(cloudPushTimer);   // nic nie może już trafić na poprzednie konto
      // nowa osoba: wszystko z poprzedniego konta znika z urządzenia (chyba że świadomie przenosi swoje dane)
      if(!same && joinChoice!=='move'){ localStorage.removeItem(LS); S=load(); if(fileHandle) unlinkFile(); }
      // nowe konto: żadnych cudzych domyślnych danych — profil wypełnia sam zaproszony
      if(!same){ S.profile={name:'',weight:0,height:0,age:0,sex:'m',activity:1.465,needsSetup:true}; S._settingsM=Date.now(); localStorage.setItem(LS,JSON.stringify(S)); }
      CLOUD={url:INVITE.url, token:j.token, account:j.account, on:true, lastSync:0, lastError:''};
      saveCloud();
      cloudUrl.value=CLOUD.url; cloudToken.value=CLOUD.token; cloudAccount.value=CLOUD.account;
      closeJoin();
      await cloudPull({silent:true}); cloudPush();
      refreshAllViews(); refreshCloudUI(); loadProfileUI();
      if(same) alert('✅ Połączono ponownie. Twoje dane są bezpieczne.');
      else openProfileSetup();
    }catch(e){
      msg.style.display='block'; msg.style.color='var(--red)'; msg.textContent='Nie udało się dołączyć: '+e.message;
    }
    btn.disabled=false; btn.textContent='Dołącz';
    [document.getElementById('joinFresh'), moveBtn].forEach(b=>b.disabled=false);
  };
}

// ---- pierwszy start nowego konta: profil jest obowiązkowy (nie da się go pominąć) ----
function obValues(){
  const g=id=>document.getElementById(id);
  return {name:g('obName').value.trim(), sex:g('obSex').value, age:parseInt(g('obAge').value),
    height:parseFloat(g('obHeight').value), weight:parseFloat(String(g('obWeight').value).replace(',','.')),
    activity:parseFloat(g('obAct').value)||1.465, goal:parseInt(g('obGoal').value)||0};
}
function obValid(v){ return v.age>=14&&v.age<=95 && v.height>=120&&v.height<=230 && v.weight>=35&&v.weight<=300; }
function obCalc(){
  const v=obValues(), el=document.getElementById('obCalc');
  if(!obValid(v)){ el.textContent='Uzupełnij wiek, wzrost i wagę, a policzymy kalorie.'; return null; }
  const maint=Math.round((10*v.weight+6.25*v.height-5*v.age+(v.sex==='f'?-161:5))*v.activity);
  const goal=Math.min(3200,Math.max(1500,Math.round((maint+v.goal)/100)*100));
  el.innerHTML=`Utrzymanie ok. <b>${maint} kcal</b> · Twój cel: <b style="color:var(--amber)">${goal} kcal/dzień</b> (zmienisz w Więcej → Cel kalorii).`;
  return {v,goal};
}
function openProfileSetup(){
  ['obName','obSex','obAge','obHeight','obWeight','obAct','obGoal'].forEach(id=>{
    const el=document.getElementById(id); el.oninput=obCalc; el.onchange=obCalc;
  });
  obCalc();
  document.getElementById('profileDialog').classList.add('show');
  setTimeout(()=>document.getElementById('obName').focus(),50);
}
document.getElementById('obSave').onclick=()=>{
  const r=obCalc();
  if(!r){ const v=obValues(); document.getElementById(!(v.age>=14&&v.age<=95)?'obAge':!(v.height>=120&&v.height<=230)?'obHeight':'obWeight').focus(); return; }
  const {v,goal}=r;
  S.profile={name:v.name, weight:v.weight, height:v.height, age:v.age, sex:v.sex, activity:v.activity};
  S.kcalGoal=goal;
  const today=todayISO();
  S.weights=(S.weights||[]).filter(w=>w.d!==today); S.weights.push({d:today,w:v.weight});
  S._settingsM=Date.now();
  save();
  document.getElementById('profileDialog').classList.remove('show');
  loadProfileUI(); applyName(); kcalSlider.value=goal; updateKcalHint();
  renderToday(); renderWeight();
  alert('✅ Gotowe'+(v.name?', '+v.name:'')+'! Twój plan startuje '+parseISO(S.startDate).toLocaleDateString('pl-PL')+'.\n\nNa drugim urządzeniu: Więcej → Synchronizacja → wpisz to samo konto i token (znajdziesz je tutaj, w tej samej sekcji).');
};
// profil niedokończony (np. zamknięta karta w trakcie) — wróć do niego przy następnym starcie
if(S.profile && S.profile.needsSetup && !INVITE) openProfileSetup();

/* ============================================================
   TRENER AI — „Zapytaj Trenera”
   Rozmowa idzie przez Apps Script (klucz API i instrukcje Trenera są tylko na serwerze).
   Aplikacja dokłada zwięzłe podsumowanie danych WYŁĄCZNIE bieżącego użytkownika.
   ============================================================ */
function buildCoachContext(){
  const p=S.profile||{}, today=todayISO(), wkNow=weekOf(dayIndexFor(today));
  const inPlan=wkNow>=1&&wkNow<=24, out=[];
  const dd=iso=>iso.slice(8,10)+'.'+iso.slice(5,7);
  out.push(`Dzisiaj: ${today}. Start planu: ${S.startDate}. ${inPlan?'Tydzień '+wkNow+'/24 — '+phaseInfo(wkNow).name:'Poza 24-tygodniowym planem'}.`);
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
  const ms=(S.measures||[]).slice().sort((a,b)=>a.d<b.d?-1:1).slice(-12);
  if(ms.length) out.push('Obwody (cm): '+ms.map(m=>dd(m.d)+' '+MEASURES.filter(x=>m[x.k]).map(x=>x.l.split(' ')[0].toLowerCase()+' '+m[x.k]).join(', ')).join(' | '));
  // tygodniowa realizacja (ostatnie 8 tygodni planu)
  const weeks={}, exHist={}, meals=[];
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
    (Lg.custom||[]).filter(c=>c.done&&!c._del).forEach(c=>meals.push(dd(iso)+' '+String(c.txt||'').slice(0,60)+' ('+(c.kcal||0)+' kcal, B'+(c.p||0)+')'));
  }
  const habName={sleep:'sen 7–8h',sun:'cel kroków',notool:'dziennik',noalco:'bez alkoholu',nosugar:'bez słodyczy'};
  const wkRows=Object.entries(weeks).filter(([,W])=>W.days).slice(-8).map(([wk,W])=>`tydz. ${wk}: siłownia ${W.gym}/${W.gymP}`+(W.homeP?`, dom ${W.home}/${W.homeP}`:'')+`, bieg ${W.run}/${W.runP}, posiłki z planu ${Math.round(100*W.meals/(4*W.days))}%, woda śr. ${(W.water/W.days).toFixed(1)} szkl., dni z wpisami ${W.logged}/${W.days}`+(Object.keys(W.hab).length?', nawyki: '+Object.entries(W.hab).map(([h,n])=>(habName[h]||h)+' '+n+'d').join(', '):''));
  out.push(wkRows.length?'Realizacja tygodniowa (zrobione/zaplanowane):\n'+wkRows.join('\n'):'Realizacja: brak wpisów.');
  const exRows=Object.entries(exHist).map(([n,a])=>'- '+n+': '+a.slice(-5).join(' | '));
  out.push(exRows.length?'Historia ćwiczeń (ostatnie sesje, kg×powtórzenia):\n'+exRows.join('\n'):'Historia ćwiczeń: brak zapisanych serii.');
  if(meals.length) out.push('Własne posiłki spoza planu (ostatnie):\n'+meals.slice(-12).join('\n'));
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
    if(rows.length) out.push('Samopoczucie przed treningiem (check-in):\n'+rows.join('\n')); }
  // zamiany ćwiczeń zrobione samodzielnie (przycisk Zamień) — ostatnie 14 dni
  { const since=addDays(today,-14), why={busy:'zajęte stanowisko',pain:'BÓL',gear:'brak sprzętu'}, sw=[];
    Object.values((S.adj&&S.adj.ex)||{}).forEach(l=>l.forEach(y=>{ if(y.user && y.swap && y.from>=since) sw.push('- '+dd(y.from)+': '+(y.was||'?')+' → '+y.swap.n+' ('+(why[y.reason]||'—')+', '+(y.to?'tylko ten dzień':'na stałe')+(y.fromSet?', od serii '+y.fromSet:'')+')'); }));
    if(sw.length) out.push('Zamiany ćwiczeń zrobione przez użytkownika:\n'+sw.sort().join('\n')); }
  // najlepsze wyniki (rekordy) każdego ćwiczenia — z odhaczonych serii
  { const rec=Object.values(exIndex()).map(h=>{ const an=prAnalyze(h), b=prBest(h.kind,an); return '- '+h.n+': '+prTopText(h.kind,b.top)+' ('+dd(b.top.iso)+')'+(h.kind==='kg'&&b.e1.m.e1?', 1RM szac. ≈ '+prE1(b.e1.m.e1)+' kg':''); });
    if(rec.length) out.push('Rekordy ćwiczeń (najlepsza seria):\n'+rec.join('\n')); }
  { const t=parseISO(today), Lt=S.log[today]||{meals:{}}, wkT=weekOf(dayIndexFor(today));
    if(wkT>=1){ const strip=x=>String(x).replace(/<[^>]+>/g,'').replace(/&amp;/g,'&');
      out.push('Jadłospis na dziś ('+dn[t.getDay()]+'):\n'+dayMeals(today,t.getDay(),Lt,wkT).map(x=>'- '+x.slot.tag+(x.adj?' [od Trenera]':'')+': '+strip(x.mc.txt)+' — '+x.mc.kcal+' kcal, B'+x.mc.p).join('\n')); } }
  const am=((S.adj&&S.adj.meals)||[]);
  if(am.length) out.push('Posiłki zmienione wcześniej przez Trenera: '+am.map(m=>m.posilek+(m.dni.length?' ('+m.dni.map(d=>dn[d]).join(',')+')':' (codziennie)')+' od '+m.from+': '+m.opis).join(' | '));
  { const sa=stepsAdj(today); out.push(`Dzienny cel kroków: ${sa?sa.goal:DEFAULT_STEPS}`+(sa?` (ustawiony przez Trenera od ${sa.from})`:' (startowy)')+'. Nawyk „ruch/kroki” = osiągnięty cel. Możesz zaproponować nowy cel polem cel_krokow.'); }
  const tg=coachTargets();
  if(tg.length) out.push('Ćwiczenia w planie na najbliższe 2 tygodnie (aktualne cele; nazwy dokładnie takie do narzędzia zaproponuj_zmiany):\n'+tg.map(t=>'- '+t.n+': '+t.txt).join('\n'));
  return out.join('\n').slice(0,15500);
}
// aktualne cele ćwiczeń z najbliższych 14 dni (z uwzględnieniem zmian od Trenera)
function coachTargets(){
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

/* ---- czat z Trenerem w danych konta (S.coach), więc synchronizuje się między urządzeniami ----
   S.coach = {clearedAt, msgs:[{id, t, st, role, content, proposal, applied, appliedFrom, dismissed}]}
   t = czas wiadomości (kolejność), st = czas ostatniej decyzji o propozycji (nowsza wygrywa przy scalaniu). */
const coachKey=()=>'zelazo_coach_'+((CLOUD.account||'lokalnie').toLowerCase());
const coachId=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
function coachStore(){ if(!S.coach) S.coach={clearedAt:0, msgs:[]}; if(!S.coach.msgs) S.coach.msgs=[]; return S.coach; }
// jednorazowo: przenieś czat zapisany dotąd tylko w tej przeglądarce do danych konta (stary zapis zostaje dla wersji stabilnej)
function migrateLocalCoach(){
  const flag=coachKey()+'_synced';
  try{
    if(localStorage.getItem(flag)) return;
    const old=JSON.parse(localStorage.getItem(coachKey())||'[]');
    if(Array.isArray(old) && old.length){
      const c=coachStore(), base=Date.now()-old.length*1000;
      old.forEach((m,i)=>c.msgs.push(Object.assign({}, m, {id:coachId(), t:base+i*1000, st:m.applied||m.dismissed?base+i*1000:0})));
      c.msgs.sort((x,y)=>x.t-y.t); c.msgs=c.msgs.slice(-COACH_KEEP);
      save();
    }
    localStorage.setItem(flag, '1');
  }catch(e){}
}
function loadCoach(){ const c=coachStore(); return c.msgs.filter(m=>(m.t||0)>(c.clearedAt||0)).sort((x,y)=>x.t-y.t); }
function saveCoach(h){
  const c=coachStore(), now=Date.now();
  h.forEach((m,i)=>{ if(!m.id) m.id=coachId(); if(!m.t) m.t=now+i; });
  c.msgs=h.slice(-COACH_KEEP);
  save();
}
// zmiana decyzji o propozycji (zastosuj / odrzuć / cofnij) dostaje własny znacznik czasu
const coachDecided=m=>{ m.st=Date.now(); };
function coachMd(t){
  return esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/(^|\s)_(.+?)_(?=\s|$)/g,'$1<i>$2</i>')
    .split('\n').map(l=>/^\s*[-•]\s+/.test(l)?'<div style="padding-left:14px;text-indent:-10px">• '+l.replace(/^\s*[-•]\s+/,'')+'</div>':(l.trim()?'<div>'+l+'</div>':'<div style="height:8px"></div>')).join('');
}
let coachBusy=false;
function renderCoach(){
  const box=document.getElementById('coachMsgs'), h=loadCoach();
  const ready=CLOUD.on&&CLOUD.url&&CLOUD.token;
  document.getElementById('coachSetup').style.display=ready?'none':'block';
  document.getElementById('coachChips').style.display=(ready&&!h.length)?'flex':'none';
  box.innerHTML=(h.length?'':`<div class="coach-b a">Cześć${S.profile&&S.profile.name?', '+esc(S.profile.name):''}! Jestem Twoim Trenerem. Widzę Twoje treningi, dietę, wagę i postępy — zapytaj, co poprawić, jak dobrać ciężary albo jakie suplementy mają sens.</div>`)+
    h.map((m,i)=>`<div class="coach-b ${m.role==='user'?'u':'a'}">${m.role==='user'?esc(m.content).replace(/\n/g,'<br>')+(m.att?`<span class="att">📎 ${m.att.n} klatek: ${esc(m.att.ex)}</span>`:''):coachMd(m.content)+(m.local?'<span class="ea-note">bez AI · nie liczy się do limitu</span>':'')}${m.kind==='form'?`<button class="coach-ask-vid" data-att="${esc(m.id)}">📎 Zapytaj o to nagranie</button>`:''}</div>`+(m.proposal?propCard(m,i):'')).join('')+
    (coachBusy?'<div class="coach-b a" style="color:var(--ink-dim)">Trener myśli…</div>':'');
  box.scrollTop=box.scrollHeight;
  box.querySelectorAll('[data-att]').forEach(b=>b.onclick=()=>{ const m=loadCoach().find(x=>x.id===b.dataset.att); if(m){ coachAtt={id:m.id, ex:m.ex||'nagranie', t:m.t}; renderCoachAtt(); document.getElementById('coachIn').focus(); } });
  renderCoachAtt();
  box.querySelectorAll('[data-prop-apply]').forEach(b=>b.onclick=()=>applyProposal(+b.dataset.propApply));
  box.querySelectorAll('[data-prop-undo]').forEach(b=>b.onclick=()=>undoProposal(+b.dataset.propUndo));
  box.querySelectorAll('[data-prop-dismiss]').forEach(b=>b.onclick=()=>{ const h=loadCoach(); const m=h[+b.dataset.propDismiss]; m.dismissed=true; coachDecided(m); saveCoach(h); renderCoach(); });
}
const fmtKg=x=>String(x).replace('.',',');
const DAY_SHORT=['Nd','Pn','Wt','Śr','Cz','Pt','Sb'];
const daysTxt=d=>(!d||!d.length)?'codziennie':d.slice().sort((a,b)=>((a+6)%7)-((b+6)%7)).map(x=>DAY_SHORT[x]).join(', ');
function propText(P){
  return [...(P.cwiczenia||[]).map(x=>x.nazwa+': '+(x.ciezar_kg>0?fmtKg(x.ciezar_kg)+' kg · ':'')+x.serie+'×'+x.powtorzenia),
    ...(P.zamiany_cwiczen||[]).map(x=>'zamiast '+x.z+' → '+x.na+' '+x.serie+'×'+x.powtorzenia),
    ...(P.posilki||[]).map(x=>x.posilek+' ('+daysTxt(x.dni)+') → '+x.opis+' '+x.kcal+' kcal'),
    ...(P.cel_kcal?['cel kalorii '+P.cel_kcal+' kcal/dzień']:[]),
    ...(P.cel_krokow?['cel kroków '+P.cel_krokow+' dziennie']:[]),
    ...(P.przesuniecia||[]).map(x=>x.dzien+': trening z '+x.trening_z),
    ...(P.przerwy||[]).map(x=>'przerwa '+x.cwiczenie+' '+fmtDur(x.sekundy))].join('; ');
}
function propCard(m,i){
  const P=m.proposal;
  const rows=(P.cwiczenia||[]).map(x=>`<div>• <b>${esc(x.nazwa)}</b>: ${x.ciezar_kg>0?fmtKg(x.ciezar_kg)+' kg · ':''}${x.serie}×${x.powtorzenia}</div>`).join('')+
    (P.zamiany_cwiczen||[]).map(x=>`<div>• <b>${esc(x.z)}</b> → <b>${esc(x.na)}</b>: ${x.ciezar_kg>0?fmtKg(x.ciezar_kg)+' kg · ':''}${x.serie}×${x.powtorzenia}${x.technika?'<div style="color:var(--ink-dim);font-size:13px;padding-left:12px">'+esc(x.technika)+'</div>':''}</div>`).join('')+
    (P.posilki||[]).map(x=>`<div>• <b>${esc(x.posilek)}</b> (${esc(daysTxt(x.dni))}): ${esc(x.opis)} <span style="color:var(--ink-dim)">— ${x.kcal} kcal · B ${x.bialko_g} / W ${x.wegle_g} / T ${x.tluszcz_g}</span></div>`).join('')+
    (P.cel_kcal?`<div>• <b>Cel kalorii</b>: ${P.cel_kcal} kcal/dzień</div>`:'')+
    (P.cel_krokow?`<div>• <b>Cel kroków</b>: ${tysKrokow(P.cel_krokow)} dziennie</div>`:'')+
    (P.przesuniecia||[]).map(x=>{ const now=workoutOn(x.dzien), nw=workoutOn(x.trening_z);
      return `<div>• <b>${dowOf(x.dzien)} ${dmy(x.dzien)}</b>: ${wIcon(nw)} ${esc(nw.title)} <span style="color:var(--ink-dim)">(było: ${esc(now.title)})</span></div>`; }).join('')+
    (P.przerwy||[]).map(x=>`<div>• <b>Przerwa · ${esc(x.cwiczenie)}</b>: ${fmtDur(restCurrent(x.cwiczenie))} → <b>${fmtDur(x.sekundy)}</b></div>`).join('');
  const act=m.applied
    ? `<div style="color:#5fbf7a;margin-top:8px">✅ Zastosowano od ${esc(m.appliedFrom||'')}</div><button class="btn ghost" data-prop-undo="${i}" style="font-size:12px;padding:7px 10px;margin-top:6px">Cofnij</button>`
    : m.dismissed ? `<div style="color:var(--ink-faint);margin-top:8px">Odrzucono</div>`
    : `<div style="display:flex;gap:6px;margin-top:10px"><button class="btn" data-prop-apply="${i}" style="flex:2;font-size:13px;padding:9px">Zastosuj od dziś</button><button class="btn ghost" data-prop-dismiss="${i}" style="flex:1;font-size:13px;padding:9px">Odrzuć</button></div>`;
  return `<div class="coach-b a" style="border-color:var(--amber)"><div style="font-size:12px;color:var(--amber);letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px">Propozycja zmian</div>${P.podsumowanie?'<div style="margin-bottom:6px">'+esc(P.podsumowanie)+'</div>':''}${rows}${act}</div>`;
}
function applyProposal(i){
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
  S.adj.log.push({id, at:id, from, summary:P.podsumowanie, ex:P.cwiczenia, swaps:P.zamiany_cwiczen||[], meals:P.posilki||[], kcal:P.cel_kcal?S.kcalGoal:0, prevKcal, prevMoves:(P.przesuniecia&&P.przesuniecia.length)?prevMoves:null, prevRest});
  S._settingsM=Date.now(); save(); renderToday();
  m.applied=id; m.appliedFrom=from.slice(8,10)+'.'+from.slice(5,7); coachDecided(m); saveCoach(h); renderCoach();
}
function undoProposal(i){
  const h=loadCoach(), m=h[i]; if(!m||!m.applied||!S.adj) return;
  const id=m.applied, entry=(S.adj.log||[]).find(x=>x.id===id);
  Object.keys(S.adj.ex||{}).forEach(n=>{ S.adj.ex[n]=S.adj.ex[n].filter(y=>y.id!==id); if(!S.adj.ex[n].length) delete S.adj.ex[n]; });
  if(entry && entry.kcal && S.kcalGoal===entry.kcal && entry.prevKcal){ S.kcalGoal=entry.prevKcal; kcalRecord(S.kcalGoal, entry.kcal); kcalSlider.value=S.kcalGoal; updateKcalHint(); }
  S.adj.meals=(S.adj.meals||[]).filter(x=>x.id!==id);
  if(S.adj.steps) S.adj.steps=S.adj.steps.filter(x=>x.id!==id);
  if(entry && entry.prevMoves!=null) S.adj.moves=JSON.parse(entry.prevMoves);   // przesunięcia sprzed tej propozycji
  if(entry && entry.prevRest && S.adj.rest) Object.keys(entry.prevRest).forEach(n=>{ if(S.adj.rest[n] && S.adj.rest[n].id===id){ if(entry.prevRest[n]) S.adj.rest[n]=entry.prevRest[n]; else delete S.adj.rest[n]; } if(WO) restApplyLive(n); });
  S.adj.log=(S.adj.log||[]).filter(x=>x.id!==id);
  S._settingsM=Date.now(); save(); renderToday();
  m.applied=false; coachDecided(m); saveCoach(h); renderCoach();
}
/* ---- klatki z nagrania techniki dołączone do pytania do Trenera ----
   Po analizie klatki dołączają się same do następnego pytania (chip „📎 Klatki …” z ✕), można też wybrać starsze nagranie
   przyciskiem przy ocenie. Wysyłane tylko z jednym pytaniem (do 8 klatek ze szkieletem i wzorcem); klatki są tylko na tym telefonie. */
let coachAtt=null;
function renderCoachAtt(){
  const el=document.getElementById('coachAtt'); if(!el) return;
  if(!coachAtt){ el.style.display='none'; return; }
  el.style.display='inline-flex';
  el.innerHTML=`<span>📎 Klatki: ${esc(coachAtt.ex)} · ${new Date(coachAtt.t).toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit'})}</span><button aria-label="Nie dołączaj klatek" id="coachAttX">✕</button>`;
  document.getElementById('coachAttX').onclick=()=>{ coachAtt=null; renderCoachAtt(); };
}
// do 8 klatek: najpierw te z odchyleniami od wzorca, potem równomiernie z całej serii
async function coachAttImages(att){
  const rec=await fcGet(att.id); if(!rec) return null;
  const issues=fcIssues(rec), n=rec.raw.length, pick=[];
  issues.forEach((a,i)=>{ if(a.length && pick.length<4) pick.push(i); });
  for(let k=0;k<n && pick.length<8;k++){ const i=Math.round(k*(n-1)/7); if(!pick.includes(i)) pick.push(i); }
  pick.sort((a,b)=>a-b);
  const imgs=[]; for(const i of pick.slice(0,8)){ const c=await fcRenderFrame(rec,i,issues); imgs.push(c.toDataURL('image/jpeg',0.72).split(',')[1]); }
  return imgs;
}
async function coachSend(text, {voice=false}={}){
  text=(text||'').trim(); if(!text||coachBusy) return;
  coachSpeakStop();
  // krótkie podziękowanie w trwającej rozmowie: odpowiedź bez AI, nie zjada limitu
  if(planEnforced() && EA_SHORT.test(text) && loadCoach().length){
    const h0=loadCoach(), a=EA_LOCAL[Math.floor(Math.random()*EA_LOCAL.length)];
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
    const msgs=h.filter(m=>!m.local).slice(-16).map(m=>({role:m.role, content:m.content+(m.proposal?'\n\n[Zaproponowane zmiany: '+propText(m.proposal)+' — decyzja użytkownika: '+(m.applied?'zastosował od '+todayISO():m.dismissed?'odrzucił':'jeszcze nie zdecydował')+']':'')}));
    // features: serwer pokaże Trenerowi pole cel_krokow tylko wersjom, które je obsługują
    const j=await cloudCall('coach',Object.assign({messages:msgs, context:buildCoachContext(), exercises:coachTargets().map(t=>t.n), features:['kroki','przesuniecia','przerwy']}, extra));
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
function openCoach(){
  if(!featOn('coach')){ showInAppReminder('Trener jest wyłączony', 'Rozmowa z Trenerem jest teraz niedostępna'+(planEnforced()?' w Twoim planie.':'.')); return; }
  document.getElementById('coachDialog').classList.add('show'); renderCoach(); coachSpeakUi(); quotaUi(); quotaLoad(); setTimeout(()=>document.getElementById('coachIn').focus(),60); }
const coachOpen=()=>document.getElementById('coachDialog').classList.contains('show');
document.getElementById('coachFab').onclick=openCoach;
document.getElementById('coachClose').onclick=()=>{ coachVoice.stop(); coachSpeakStop(); coachVoice.say(''); document.getElementById('coachDialog').classList.remove('show'); };

/* ---- rozmowa głosem z Trenerem ----
   🎤: pytanie dyktowane i wysyłane samo po chwili ciszy. Odpowiedź czytana na głos (pl-PL, syntezator telefonu),
   potem mikrofon włącza się ponownie — cisza kończy rozmowę. 🔊/🔇 wyłącza czytanie (zapamiętane na tym urządzeniu). */
const coachVoice=makeDictation({
  input:document.getElementById('coachIn'), mic:document.getElementById('coachMic'), msg:document.getElementById('coachVoice'),
  listening:'● Słucham… zadaj pytanie. Wyślę je sam po chwili ciszy.',
  onDone:heard=>{ coachVoice.say('Wysłano — Trener myśli…','info'); coachSend(document.getElementById('coachIn').value, {voice:true}); },
  onSilence:()=>coachVoice.say('Rozmowa wstrzymana. Stuknij 🎤, żeby mówić dalej.','info')
});
document.getElementById('coachMic').addEventListener('click',()=>coachSpeakStop(), true);   // mówisz → Trener milknie
const TTS=window.speechSynthesis||null;
function coachSpeakOn(){ try{ return localStorage.getItem('zelazo_coach_tts')!=='off'; }catch(e){ return true; } }
function coachSpeakUi(){
  const b=document.getElementById('coachSpeak');
  if(!TTS){ b.style.display='none'; return; }
  const on=coachSpeakOn(); b.textContent=on?'🔊':'🔇'; b.setAttribute('aria-pressed',on?'true':'false');
  b.setAttribute('aria-label', on?'Wyłącz czytanie odpowiedzi':'Włącz czytanie odpowiedzi');
}
document.getElementById('coachSpeak').onclick=()=>{
  const on=!coachSpeakOn();
  try{ localStorage.setItem('zelazo_coach_tts', on?'on':'off'); }catch(e){}
  if(!on) coachSpeakStop();
  coachSpeakUi();
};
let coachSpeakSeq=0;   // przerwane czytanie nie może włączyć mikrofonu
function coachSpeakStop(){ coachSpeakSeq++; if(TTS) TTS.cancel(); }
// tekst do czytania: bez znaczników, w kawałkach po zdaniach (Chrome ucina długie wypowiedzi)
function coachSpeak(text, onEnd){
  if(!TTS){ onEnd&&onEnd(); return; }
  coachSpeakStop(); const seq=coachSpeakSeq;
  const clean=String(text).replace(/\*\*|__|_|#+\s*/g,'').replace(/^\s*[-•]\s+/gm,'').replace(/\s+/g,' ').trim();
  const parts=clean.match(/[^.!?…]+[.!?…]*\s*/g)||[clean], chunks=[];
  parts.forEach(p=>{ const last=chunks[chunks.length-1]; if(last && (last+p).length<220) chunks[chunks.length-1]=last+p; else chunks.push(p); });
  const voice=(TTS.getVoices()||[]).find(v=>/^pl/i.test(v.lang));
  coachVoice.say('🔊 Trener mówi… stuknij 🎤, żeby przerwać i odpowiedzieć.','info');
  chunks.forEach((c,i)=>{
    const u=new SpeechSynthesisUtterance(c.trim()); u.lang='pl-PL'; if(voice) u.voice=voice;
    if(i===chunks.length-1){ u.onend=()=>{ if(seq===coachSpeakSeq && onEnd) onEnd(); }; u.onerror=()=>{ if(!coachVoice.active()) coachVoice.say(''); }; }
    TTS.speak(u);
  });
}
document.getElementById('coachClear').onclick=()=>{ if(confirm('Wyczyścić rozmowę z Trenerem? Zniknie na wszystkich Twoich urządzeniach.')){ S.coach={clearedAt:Date.now(), msgs:[]}; save(); renderCoach(); } };
document.getElementById('coachSend').onclick=()=>coachSend(document.getElementById('coachIn').value);
document.getElementById('coachIn').addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); coachSend(e.target.value); } });
document.querySelectorAll('#coachChips button').forEach(b=>b.onclick=()=>coachSend(b.textContent));
document.getElementById('coachGoSync').onclick=()=>{ document.getElementById('coachDialog').classList.remove('show'); document.querySelector('.nav button[data-v="set"]').click(); moreOpen('sync'); setTimeout(()=>document.getElementById('cloudState').scrollIntoView({block:'center'}),300); };

/* ---- plan konta, funkcje i miesięczne limity ----
   Serwer zwraca plan konta (np. Darmowy, Premium), włączone funkcje i to, czy w tej wersji obowiązują limity planu
   (cfg.enforce na serwerze — dziś USERS i Early Access). W pozostałych wersjach działa tylko wyłącznik awaryjny funkcji.
   Limity liczy serwer (tylko udane odpowiedzi AI); tutaj ostatni znany stan, żeby licznik był widoczny od razu i bez zasięgu.
   Krótkie „dzięki” / „ok” w trwającej rozmowie dostają odpowiedź bez AI. Szacowanie kalorii ma osobny limit dzienny. */
const EA_SHORT=/^\s*(dzięki|dziękuję|dziekuje|dzieki|thx|ok|okej|okay|super|spoko|jasne|git|👍|💪|🙏)[\s!.]*$/i;
const EA_LOCAL=['Do usług 💪','Powodzenia na treningu!','Jasne — pisz, gdy coś będzie potrzebne.'];
var PLAN=null;
try{ PLAN=JSON.parse(localStorage.getItem('zelazo_plan_'+appChannel())||'null'); }catch(e){}
function planEnforced(){ return PLAN ? !!PLAN.enforced : ['early','users'].includes(appChannel()); }
function featOn(k){ return !PLAN || !PLAN.features || PLAN.features[k]!==false; }
function planSet(j){
  if(!j || !j.features) return;   // stary serwer bez planów
  PLAN={plan:j.plan, planName:j.planName||j.plan, features:j.features, enforced:!!j.enforced};
  try{ localStorage.setItem('zelazo_plan_'+appChannel(), JSON.stringify(PLAN)); }catch(e){}
  if(j.quota) quotaSet(j.quota); else quotaUi();
  applyFeatures();
}
// pokaż albo ukryj elementy według planu i wyłącznika awaryjnego
function applyFeatures(){
  const show=(id,on)=>{ const el=document.getElementById(id); if(el) el.style.display=on?'':'none'; };
  show('coachFab', featOn('coach')); show('coachMic', featOn('voice'));
  show('mdEstimate', featOn('estimate')); show('mdScan', featOn('scanner')); show('mdPhoto', featOn('estimate') && featOn('photo'));
  show('mmPlanBtn', planEnforced());
  document.getElementById('eaGate').style.display=(appChannel()==='early' && PLAN && !featOn('early'))?'flex':'none';
}
var QUOTA=null;
try{ QUOTA=JSON.parse(localStorage.getItem('zelazo_quota')||'null'); }catch(e){}
// zapamiętany stan z poprzedniego miesiąca → licznik od zera
function quotaCur(){
  if(!planEnforced() || !QUOTA || !QUOTA.coach || !QUOTA.form) return null;
  if(typeof QUOTA.est!=='object' || !QUOTA.est) QUOTA.est={n:+QUOTA.est||0, max:300, day:20};   // zapis sprzed limitu szacowań
  const m=todayISO().slice(0,7);
  return QUOTA.m===m ? QUOTA : {m, coach:{n:0,max:QUOTA.coach.max}, form:{n:0,max:QUOTA.form.max}, est:{n:0,max:QUOTA.est.max,day:QUOTA.est.day}};
}
// funkcje (nie const): moreStatus pyta o licznik, zanim skrypt dojdzie do tego miejsca
function quotaLeft(k){ const q=quotaCur(); return q ? Math.max(0, q[k].max-q[k].n) : null; }
function quotaReset(){ return '1 '+['stycznia','lutego','marca','kwietnia','maja','czerwca','lipca','sierpnia','września','października','listopada','grudnia'][(new Date().getMonth()+1)%12]; }
function quotaSet(q){
  if(!q || !q.coach || !q.form) return;
  QUOTA=q; try{ localStorage.setItem('zelazo_quota', JSON.stringify(q)); }catch(e){}
  quotaUi();
}
async function quotaLoad(){
  if(!(CLOUD.on && CLOUD.url && CLOUD.token) || !navigator.onLine || !planEnforced()) return;
  try{ planSet(await cloudCall('usage', {})); }catch(e){}
}
function quotaUi(){
  const chip=document.getElementById('coachQuota'), lim=document.getElementById('coachLimit'), q=quotaCur();
  const sec=document.getElementById('v-set').dataset.sec;
  if(sec==='plan') renderPlanQuota();
  if(!q){ chip.style.display='none'; lim.style.display='none'; return; }
  const left=quotaLeft('coach'), out=left===0;
  chip.style.display='inline-flex'; chip.textContent='💬 '+left+' z '+q.coach.max;
  chip.classList.toggle('low', left>0 && left<=3); chip.classList.toggle('out', out);
  lim.style.display=out?'block':'none';
  if(out){
    lim.innerHTML=`<b>Limit ${q.coach.max} pytań na ${MONTHS_PL[+q.m.slice(5,7)-1]} wykorzystany.</b> Nowe pytania od ${quotaReset()}. Plan, tryb treningu, check-in i przerwy działają dalej bez limitu.<button class="btn" id="coachTopUp" type="button">Dokup 20 pytań · 4,99 zł</button>`;
    document.getElementById('coachTopUp').onclick=()=>showInAppReminder('Dokupienie pytań — wkrótce', 'Płatności jeszcze nie działają. Limit odnowi się '+quotaReset()+'.');
  }
  ['coachIn','coachSend','coachMic'].forEach(id=>{ document.getElementById(id).disabled=out; });
  document.getElementById('coachChips').style.opacity=out?'.4':'';
  document.getElementById('coachChips').style.pointerEvents=out?'none':'';
}
document.getElementById('coachQuota').onclick=()=>{
  document.getElementById('coachClose').click();
  document.querySelector('.nav button[data-v="set"]').click(); moreOpen('plan');
};
function renderPlanQuota(){
  const box=document.getElementById('planBox'); if(!box) return;
  if(!(CLOUD.on && CLOUD.url && CLOUD.token)){
    box.innerHTML='<div class="md-hint" style="margin:0">Limity Trenera liczy serwer — włącz synchronizację (Więcej → Synchronizacja i konta), żeby je zobaczyć.</div>'; return;
  }
  const q=quotaCur();
  if(!q){ box.innerHTML='<div class="md-hint" style="margin:0">Wczytuję limity…</div>'; return; }
  const meter=(label,n,max)=>`<div class="pq-m"><div class="t"><span>${label}</span><b>${n} / ${max}</b></div><div class="pq-bar"><span class="${n>=max?'full':''}" style="width:${Math.min(100,Math.round(n/max*100))}%"></span></div></div>`;
  box.innerHTML=`<div class="pq-top"><div><b>${esc((PLAN&&PLAN.planName)||'Twój plan')}</b><small>Limity odnawiają się ${quotaReset()}</small></div><span class="pq-badge">${MONTHS_PL[+q.m.slice(5,7)-1]}</span></div>
    ${meter('Pytania do Trenera', q.coach.n, q.coach.max)}
    ${meter('Oceny techniki z nagrania', q.form.n, q.form.max)}
    ${meter('Szacowanie kalorii posiłków', q.est.n, q.est.max)}
    <div class="md-hint" style="margin:-8px 0 0">Tekstem albo głosem — tak samo. Najwyżej ${q.est.day} dziennie. Nie zjada pytań do Trenera.</div>
    <div class="md-hint" style="margin:0">Bez limitu: plan treningu i diety, ręczne wpisywanie kalorii, tryb treningu, rekordy, przerwy, check-in, cykl, praca offline. Krótkie „dzięki” i „ok” do Trenera nie liczą się do limitu.</div>`;
}
// przed pierwszą rozmową głosową: każda wypowiedź to 1 pytanie
var vqOk=false;
function vqMuted(){ try{ return localStorage.getItem('zelazo_voice_note')==='off'; }catch(e){ return false; } }
document.getElementById('coachMic').addEventListener('click', e=>{
  if(!planEnforced() || vqOk || vqMuted() || coachVoice.active()) return;
  e.stopImmediatePropagation(); openVoiceQuota();
}, true);
function openVoiceQuota(){
  const q=quotaCur(), left=quotaLeft('coach');
  document.getElementById('vqPanel').innerHTML=`<div class="eh-grab"></div>
    <div class="eh-head"><div style="flex:1;min-width:0"><div class="eyebrow">Twój plan</div><h2 id="vqTitle">Rozmowa głosowa</h2></div><button class="eh-x" data-vqclose aria-label="Zamknij">✕</button></div>
    <p>Każda Twoja wypowiedź to <b>1 pytanie</b> z limitu.${q?` Zostało Ci <b>${left} z ${q.coach.max}</b>.`:''}</p>
    <p style="color:var(--ink-dim);font-size:14px">Wskazówka: powiedz całe pytanie naraz, np. „Bolą mnie kolana przy przysiadzie, co zmienić w treningu i ile ciężaru?”.</p>
    <button class="btn" id="vqGo" type="button">MÓW</button>
    <button class="btn ghost" data-vqclose type="button">Wolę napisać</button>
    <label><input type="checkbox" id="vqMute"> Nie pokazuj więcej</label>`;
  const sh=document.getElementById('vqSheet'); sh.style.display='flex';
  const close=()=>{
    if(document.getElementById('vqMute').checked){ try{ localStorage.setItem('zelazo_voice_note','off'); }catch(e){} }
    sh.style.display='none';
  };
  sh.querySelectorAll('[data-vqclose]').forEach(b=>b.onclick=()=>{ close(); document.getElementById('coachIn').focus(); });
  document.getElementById('vqGo').onclick=()=>{ close(); vqOk=true; document.getElementById('coachMic').click(); };
}

// ---- zużycie AI (koszt Trenera i szacowania kalorii, liczony na serwerze z tokenów × cennik) ----
const fmtUsd=v=>{ v=+v||0; return '$'+(v>0&&v<0.01?v.toFixed(3):v.toFixed(2)); };
const MONTHS_PL=['styczeń','luty','marzec','kwiecień','maj','czerwiec','lipiec','sierpień','wrzesień','październik','listopad','grudzień'];
const monthName=m=>m?MONTHS_PL[+m.slice(5,7)-1]+' '+m.slice(0,4):'';
function usageTxt(u){ if(!u) return '—'; return fmtUsd(u.usd)+' w tym mies. ('+u.n+' zapyt.)'; }
async function loadUsage(){
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
      Szacunek z liczby tokenów i cennika Claude API — dokładny rachunek jest w panelu Anthropic. ${planEnforced()?'Limity Twojego planu: Więcej → Pakiet i limity AI.':'Limit: 30 pytań do Trenera i 40 szacowań dziennie.'}</div>`;
  }catch(e){ sec.style.display='none'; }
}

// ---- panel administratora (widoczny tylko z tokenem administratora) ----
async function checkAdmin(){
  if(!CLOUD.url||!CLOUD.token) return;
  try{ const j=await cloudCall('ping',{}); setAdmin(!!j.admin); planSet(j); }catch(e){ setAdmin(false); }
}
function setAdmin(on){
  document.getElementById('adminSection').style.display=on?'block':'none';
  verVisible(on);
  // USERS: konta, plany i limity w osobnym panelu (Więcej → Konta i plany); tu zostają zaproszenia i token
  const panel=on && APP_VER==='users';
  document.getElementById('mmAdmBtn').style.display=panel?'':'none';
  document.getElementById('admOldList').style.display=panel?'none':'';
  document.getElementById('admGoPanel').style.display=panel?'':'none';
  if(on) loadAdmin();
}
const fmtDate=t=>t?new Date(t).toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit'})+' '+new Date(t).toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'}):'—';
function showInviteLink(code, account, expires, title){
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
  if(sh) sh.onclick=()=>navigator.share({title:'ŻELAZO — zaproszenie',text:'Dołącz do mnie w ŻELAZO (dieta + trening):',url:link}).catch(()=>{});
}
async function adminCall(action, payload){
  try{ return await cloudCall(action, payload||{}); }
  catch(e){ alert('Błąd: '+e.message); return null; }
}
async function loadAdmin(){
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
      </div></div>`).join(''):'<div class="md-hint">Nikogo jeszcze nie zaprosiłeś.</div>');
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
/* ---- panel administratora (USERS): konta z planami, plany (limity i funkcje), ustawienia ----
   Dane z adminList (konta, zużycie, plany, cfg). Plan konta zapisuje się od razu (adminSetPlan);
   plany i ustawienia zbierają zmiany i idą razem przez „Zapisz” (adminSavePlans, serwer je sprawdza). */
const AP_FEAT=[['coach','Trener (czat)'],['voice','Rozmowa głosowa'],['form','Ocena techniki z nagrania'],['estimate','Szacowanie kalorii'],['photo','Szacowanie ze zdjęcia'],['scanner','Skaner kodów'],['early','Early Access']];
const AP_LIM=[['coach','Pytania do Trenera','mies.'],['form','Oceny techniki','mies.'],['est','Szacowania kalorii','mies.'],['estDay','Szacowania kalorii','dziennie']];
const AP_CH=[['stable','Stabilna','/ — wszyscy'],['beta','Beta','/beta/ — testerzy'],['early','Early Access','/early/ — Premium'],['users','USERS','/users/ — wersja robocza']];
// koszt jednej odpowiedzi AI (rachunek z października): Trener ~0,07 $, ocena techniki ~0,09 $, szacowanie ~0,0015 $; 1 $ ≈ 4 zł
const AP_COST={coach:.07, form:.09, est:.0015}, AP_PLN=4;
var AP={tab:'acc', filter:'all', q:'', kill:null, stable:false, data:null, plans:null, cfg:null};
const apClone=o=>JSON.parse(JSON.stringify(o));
const apPlural=(n,a,b,c)=>n===1?a:(n%10>=2&&n%10<=4&&(n%100<10||n%100>=20))?b:c;
async function apLoad(){
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
function apEff(u){ return u.admin?AP.cfg.adminPlan:(u.plan||AP.cfg.defaultPlan); }
function apUse(u){ const x=u.usage||{}; return {coach:x.coach||0, form:x.form||0, est:x.est||0, usd:x.usd||0}; }
function apRatio(n,m){ return m?n/m:(n?1:0); }
function apBarCls(r){ return r>=1?'full':r>=.8?'hi':''; }
function apNear(u){ if(u.legacy) return false; const L=(AP.plans[apEff(u)]||{}).limits||{}, x=apUse(u); return ['coach','form','est'].some(k=>apRatio(x[k],L[k])>=.8); }
function apPill(p,u){ const P=AP.plans[p]; return `<span class="ap-pill ${u&&u.admin?'adm':p==='free'?'free':p==='tester'?'tester':''}">${u&&u.admin?'Admin · ':''}${esc(P?P.name:p)}</span>`; }
function apRender(){
  const box=document.getElementById('apBox'), d=AP.data; if(!d) return;
  const off=(d.cfg&&d.cfg.off)||[];   // pasek pokazuje stan zapisany na serwerze, nie niezapisane zmiany
  box.innerHTML=(off.length?`<div class="ap-kill" role="status"><b>Wyłączone dla wszystkich:</b> ${off.map(k=>(AP_FEAT.find(f=>f[0]===k)||[k,k])[1]).join(', ')}. Wyłącznik awaryjny działa w każdej wersji i każdym planie.</div>`:'')+
    `<div class="ap-tabs" role="tablist">${[['acc','Konta'],['plans','Plany'],['set','Ustawienia']].map(([k,l])=>`<button type="button" role="tab" data-aptab="${k}" class="${AP.tab===k?'on':''}" aria-selected="${AP.tab===k}">${l}</button>`).join('')}</div>`+
    (AP.tab==='acc'?apViewAcc():AP.tab==='plans'?apViewPlans():apViewSet())+apSaveBar();
  apBind();
}
function apViewAcc(){
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
      return `<button class="ap-acc" type="button" data-apacc="${esc(u.account)}"><span class="nm"><span>${esc(u.account)}</span>${apPill(p,u)}${!u.admin&&!u.plan?'<span class="md-hint" style="margin:0">domyślny</span>':''}${u.disabled?'<span class="ap-pill off">zablokowane</span>':''}</span><span class="md-hint" style="margin:0">${fmtUsd(x.usd)}</span>
        <span class="ap-bar"><span class="${apBarCls(r)}" style="width:${Math.min(100,r*100)}%"></span></span>
        <span class="meta"><span class="${r>=1?'ap-bad':r>=.8?'ap-warn':''}">Trener ${x.coach}/${L.coach}</span><span>Oceny ${x.form}/${L.form}</span><span>Szacowania ${x.est}/${L.est}</span><span>· ${u.admin?'Ty':esc(fmtDate(u.lastSeen))}</span></span></button>`; }).join(''):'<div class="ap-note">Brak kont dla tego filtra.</div>'}</div>`;
}
function apWorst(p){ const L=AP.plans[p].limits; return (L.coach*AP_COST.coach + L.form*AP_COST.form + L.est*AP_COST.est)*AP_PLN; }
const apZl=v=>(Math.round(v*10)/10).toString().replace('.',',')+' zł';
function apViewPlans(){
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
function apViewSet(){
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
function apChanges(){
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
function apSaveBar(){ const n=apChanges(); return n?`<div class="ap-save"><span>${n} ${apPlural(n,'zmiana','zmiany','zmian')} w planach i ustawieniach</span><button class="btn ghost" type="button" id="apDiscard">Odrzuć</button><button class="btn" type="button" id="apSaveBtn">Zapisz</button></div>`:''; }
function apSetLim(path,v){ const i=path.lastIndexOf('.'), p=path.slice(0,i), k=path.slice(i+1); AP.plans[p].limits[k]=Math.max(0,Math.min(100000,Math.round(+v||0))); }
function apBind(){
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
function apOpenAcc(name){
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
      <div class="md-hint" style="margin:0">Zmiana działa od następnego zapytania tej osoby. Zużycie w tym miesiącu zostaje i liczy się do nowych limitów.</div>`)+
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
function apCloseSheet(){ document.getElementById('apSheet').style.display='none'; }
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

// ---- sync: przyciski ----
document.getElementById('btnExport').onclick=exportJSON;
document.getElementById('btnImport').onclick=()=>document.getElementById('importFile').click();
document.getElementById('importFile').addEventListener('change',e=>{
  const f=e.target.files[0]; if(f) importJSONFile(f); e.target.value='';
});
if(FS_SUPPORTED){
  document.getElementById('btnLinkNew').onclick=linkNewFile;
  document.getElementById('btnLinkOpen').onclick=linkExistingFile;
  document.getElementById('btnUnlink').onclick=unlinkFile;
}

function refreshSyncUI(){
  const fmt=t=>{ if(!t)return '—'; const d=new Date(t); return d.toLocaleDateString('pl-PL')+' '+d.toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'}); };
  const setTxt=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  setTxt('lastExport','Ostatni eksport: '+fmt(S._lastExport));
  setTxt('lastImport','Ostatni import: '+fmt(S._lastImport));
  const fsBox=document.getElementById('fsBox'), fsUnsup=document.getElementById('fsUnsup');
  if(FS_SUPPORTED){
    fsBox.style.display=''; fsUnsup.style.display='none';
    const linked=!!fileHandle;
    document.getElementById('fsLinked').style.display=linked?'':'none';
    document.getElementById('fsUnlinked').style.display=linked?'none':'';
    if(linked) setTxt('fsName','Podłączony · zapis: '+fmt(S._lastFileWrite));
  } else {
    fsBox.style.display='none'; fsUnsup.style.display='';
  }
}

// wersja aplikacji: zaznacz tę, w której jesteś
/* ---- praca bez internetu ----
   Kopia aplikacji na telefonie (sw.js, tylko /beta/). Zmiany zapisują się lokalnie jak zawsze;
   bez sieci synchronizacja czeka (CLOUD.pending) i rusza sama po powrocie zasięgu. */
function netDown(e){ return !navigator.onLine || /failed to fetch|load failed|networkerror|network request failed/i.test((e&&e.message)||''); }
var netPillT=null;
function updateNetPill(flash){
  const p=document.getElementById('netPill'), t=document.getElementById('netTxt'); if(!p) return;
  clearTimeout(netPillT);
  const w=document.getElementById('woPTxt'); if(w && WO) w.textContent=w.textContent.replace(/ · offline$/,'')+(navigator.onLine?'':' · offline');
  if(!navigator.onLine){ p.classList.remove('ok'); t.textContent='Offline'; p.style.display='inline-flex'; return; }
  if(flash){ p.classList.add('ok'); t.textContent='Online'; p.style.display='inline-flex'; netPillT=setTimeout(()=>{ p.style.display='none'; }, 3000); return; }
  p.style.display='none';
}
document.getElementById('netPill').onclick=()=>showInAppReminder(navigator.onLine?'Znów online':'Brak internetu',
  navigator.onLine?'Wysyłam zmiany zapisane bez zasięgu.':'Aplikacja działa dalej: serie, posiłki i waga zapisują się na telefonie. Zsynchronizuję je, gdy wróci zasięg. Trener i ocena techniki potrzebują internetu.');
function netResync(){ if(navigator.onLine && CLOUD.on && CLOUD.url && CLOUD.account && CLOUD.pending) cloudPush(); }
window.addEventListener('online', ()=>{ updateNetPill(true); netResync(); });
window.addEventListener('offline', ()=>updateNetPill());
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) netResync(); });
setTimeout(updateNetPill, 0);   // po całym skrypcie — WO jest zadeklarowane niżej
if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost')) navigator.serviceWorker.register('sw.js', {scope:'./'}).catch(()=>{});

const APP_VER=appChannel();
document.getElementById(({stable:'verStable', early:'verEarly', users:'verUsers'})[APP_VER]||'verBeta').classList.add('on');
// wszystkie wersje budowane z jednego źródła (tools/build.py) — linki i znaczek zależą od adresu
{ const up=APP_VER==='stable'?'':'../';
  [['verStable',up||'./'],['verBeta',up+'beta/'],['verEarly',up+'early/'],['verUsers',up+'users/'],['verOld',up+'v1.0/']].forEach(([id,h])=>{ document.getElementById(id).href=h; }); }
if(APP_VER==='stable') document.querySelectorAll('.beta-tag').forEach(x=>x.remove());
// Early Access i USERS widać w wersji, w której jesteś, i u administratora
function verVisible(admin){
  document.getElementById('verEarly').style.display=(admin || APP_VER==='early' || APP_VER==='users')?'':'none';
  document.getElementById('verUsers').style.display=(admin || APP_VER==='users')?'':'none';
}
verVisible(false);
setTimeout(applyFeatures, 0);   // ostatni znany plan z telefonu; serwer potwierdzi przy starcie (checkAdmin)
// pierwsze otwarcie USERS: po co ta wersja
try{
  if(APP_VER==='users' && localStorage.getItem('zelazo_seen_users')!=='1'){
    setTimeout(()=>showInAppReminder('ŻELAZO USERS',
      'Wersja robocza kont i planów: tu powstają plany Darmowy i Premium, limity, panel administratora i płatności. Funkcje są takie jak w becie. Twój plan i limity: Więcej → Pakiet i limity AI.'), 1200);
    localStorage.setItem('zelazo_seen_users','1');
  }
}catch(e){}
// pierwsze otwarcie Early Access
try{
  if(APP_VER==='early' && localStorage.getItem('zelazo_seen_ea')!=='1'){
    setTimeout(()=>showInAppReminder('ŻELAZO Early Access',
      'Nowe funkcje przed wersją stabilną — dla Premium. Limity Twojego planu widzisz w rozmowie z Trenerem i w Więcej → Pakiet i limity AI. Krótkie „dzięki” i „ok” nie liczą się do limitu.'), 1200);
    localStorage.setItem('zelazo_seen_ea','1');
  }
}catch(e){}
// jednorazowo po aktualizacji do 1.2: co nowego (tylko w stabilnej i tylko u osób, które już korzystały)
const APP_REL='1.2';
try{
  if(APP_VER==="stable" && localStorage.getItem('zelazo_seen_rel')!==APP_REL){
    if(Object.keys(S.log||{}).length) setTimeout(()=>showInAppReminder('ŻELAZO 1.2 — co nowego',
      'Zamień ćwiczenie, gdy brakuje sprzętu albo coś boli. Własne przerwy dla każdego ćwiczenia (ustawia je też Trener). Check-in przed treningiem: sen, zakwasy i energia dopasowują trening. Cykl i samopoczucie — dobrowolnie, w Więcej. Wykres 1RM nie spada już do zera przy seriach powyżej 12 powtórzeń.'), 1200);
    localStorage.setItem('zelazo_seen_rel', APP_REL);
  }
}catch(e){}

// wipe
document.getElementById('wipe').onclick=()=>{
  if(confirm('Na pewno wyczyścić cały postęp? Tego nie da się cofnąć.')){
    localStorage.removeItem(LS);S=load();fileHandle=null;delHandle();
    viewOffset=0;renderToday();renderWeight();renderShop();refreshNotifUI();refreshSyncUI();
    alert('Wyczyszczono. Zaczynamy od zera 💪');
  }
};

/* ============================================================
   TRYB TRENINGU (beta): pełny ekran z bieżącą serią, odliczanie przerwy po każdej serii,
   pomiar czasu całego treningu, serii i przerw. Seria zrobiona tutaj odhacza się w karcie tak jak ręcznie.
   Po zakończeniu: S.log[dzień].session (synchronizowane, widzi je Trener).
   Trwający trening zapamiętany w tej przeglądarce (zelazo_workout), więc przeżyje zamknięcie karty.
   ============================================================ */
const fmtDur=s=>{ s=Math.max(0,Math.round(s||0)); const h=Math.floor(s/3600), m=Math.floor(s%3600/60), x=s%60; return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(x).padStart(2,'0'); };
// zaplanowana przerwa po serii: duże wielostawowe dłużej, akcesoria krócej, ćwiczenia na czas najkrócej
function restSecs(e, ts){
  if(ts) return 45;
  if(/przysiad|martwy|RDL|ławce|ławka|żołnierskie|wyciskanie sztangi/i.test(e.n)) return 150;
  if(/wiosł|ściąg|podciąg|wykrok|suwnic|hip|pompk|dip|hack|wyciskanie/i.test(e.n)) return 105;
  return 75;
}
/* ---- historia ćwiczeń i rekordy ----
   Liczą się tylko odhaczone serie (jak w „Ostatnio”), pod nazwą po wymianie od Trenera.
   Pierwszy trening ćwiczenia to punkt startowy, nie rekord. 1RM szacujemy wzorem Epleya z serii do 12 powtórzeń.
   Rekord objętości tylko przy wszystkich seriach z planu. Funkcje (nie const), bo karta renderuje się przed tą częścią skryptu. */
var exIdxCache=null;
function exIndex(){
  if(exIdxCache) return exIdxCache;
  const idx={}, today=todayISO();
  Object.keys(S.log).sort().forEach(p=>{
    if(p>today || dayIndexFor(p)<1) return;
    const w=workoutOn(p), L=S.log[p];
    if(!w || w.type!=='lift' || !L || !L.ex) return;
    w.ex.forEach((e0,i)=>{
      const e=effEx(e0,p), r=L.ex[p+'_e'+i];
      if(!r || !r.sets || r.skip) return;
      const sp=swapSplit(e, p), cut=sp?sp.fromSet:1, before=[], sets=[];
      for(let s=1;s<=e.s;s++){ const kg=parseFloat(r.sets['w'+s]), rp=parseFloat(r.sets['r'+s]); if(rp>0 && setOk(r,s)) (s<cut?before:sets).push({kg:kg>0?kg:0, r:rp}); }
      const add=(name, list, full, timed)=>{ if(!list.length) return; const n=name.trim(), h=idx[n]||(idx[n]={n, timed:false, sess:[]});
        if(timed) h.timed=true; h.sess.push({iso:p, sets:list, full, phase3:!!w.phase3}); };
      if(sp) add(sp.was, before, false, false);   // zamiana w trakcie: wcześniejsze serie zostają przy poprzednim ćwiczeniu
      add(e.n, sets, sets.length>=e.s-cut+1, !!timedSpec(e,e0));
    });
  });
  Object.values(idx).forEach(h=>{ h.kind=h.timed?'time':(h.sess.some(s=>s.sets.some(x=>x.kg>0))?'kg':'reps'); });
  return exIdxCache=idx;
}
function e1rm(kg,r){ return kg>0 && r>=1 && r<=12 ? kg*(1+r/30) : 0; }
function prMetrics(kind,s){
  if(kind==='kg') return {top:Math.max(...s.sets.map(x=>x.kg)), e1:Math.max(...s.sets.map(x=>e1rm(x.kg,x.r))), vol:s.sets.reduce((a,x)=>a+x.kg*x.r,0)};
  return {top:Math.max(...s.sets.map(x=>x.r)), e1:0, vol:s.sets.reduce((a,x)=>a+x.r,0)};
}
function prAnalyze(h){
  const best={top:0,e1:0,vol:0}, seen=[];
  return h.sess.map((s,i)=>{
    const m=prMetrics(h.kind,s), prs=[];
    if(i>0){
      if(m.top>best.top) prs.push('top');
      if(h.kind==='kg' && best.e1>0 && m.e1>best.e1+0.01) prs.push('e1');
      if(s.full && best.vol>0 && m.vol>best.vol) prs.push('vol');
      if(h.kind==='kg' && !prs.includes('top') && s.sets.some(x=>x.kg>0 && x.r>Math.max(0,...seen.filter(y=>y.kg>=x.kg).map(y=>y.r)))) prs.push('reps');
    }
    best.top=Math.max(best.top,m.top); best.e1=Math.max(best.e1,m.e1); if(s.full) best.vol=Math.max(best.vol,m.vol);
    seen.push(...s.sets);
    return Object.assign({},s,{m,prs});
  });
}
function prFmt(x){ return String(Math.round(x*10)/10).replace('.',','); }
function prE1(x){ return prFmt(Math.round(x*2)/2); }
function prNum(x){ return Math.round(x).toLocaleString('pl-PL'); }
function prDD(iso){ return iso.slice(8,10)+'.'+iso.slice(5,7); }
function prUnit(kind){ return kind==='kg'?'kg':kind==='time'?'s':'powt.'; }
function prName(kind,t){ return t==='top'?(kind==='kg'?'Ciężar':kind==='time'?'Czas':'Powtórzenia'):t==='e1'?'1RM szac.':t==='vol'?'Objętość':'Powtórzenia'; }
function prTopText(kind,s){
  if(kind!=='kg') return prFmt(s.m.top)+' '+prUnit(kind);
  return prFmt(s.m.top)+' kg × '+Math.max(...s.sets.filter(x=>x.kg===s.m.top).map(x=>x.r));
}
function prSetsText(kind,sets){
  if(kind!=='kg') return sets.map(x=>x.r).join(', ')+' '+prUnit(kind);
  const kgs=[...new Set(sets.map(x=>x.kg))];
  return kgs.length===1 ? (kgs[0]?prFmt(kgs[0])+' kg × ':'')+sets.map(x=>x.r).join(', ') : sets.map(x=>prFmt(x.kg)+'×'+x.r).join(', ');
}
function prBest(kind,an){
  const pick=f=>an.reduce((b,s)=>(!b||f(s)>f(b))?s:b,null);
  return {top:pick(s=>s.m.top*1000+(kind==='kg'?Math.max(...s.sets.filter(x=>x.kg===s.m.top).map(x=>x.r)):0)),
    e1:kind==='kg'?pick(s=>s.m.e1):null, vol:pick(s=>s.full?s.m.vol:-1)};
}
var IC_HIST='<svg viewBox="0 0 24 24"><path d="M4 19h16"/><path d="M5 15l4-4 3 3 6-7"/><path d="M15 7h3v3"/></svg>';
// przycisk pod ćwiczeniem na karcie dnia
function exHistBtn(name, iso){
  const h=exIndex()[name.trim()]; if(!h) return '';
  const an=prAnalyze(h), b=prBest(h.kind,an), t=an.find(s=>s.iso===iso), pr=t && t.prs.length;
  return `<button class="hist-btn${pr?' new':''}" data-hist="${encodeURIComponent(h.n)}">${IC_HIST}<span>${pr?'🏆 Rekord dziś · ':''}Historia · rekord ${prTopText(h.kind,b.top)}</span></button>`;
}

/* arkusz historii */
var EH={n:null, metric:'top', sel:null, all:false};
function openExHist(n){ if(!exIndex()[n]) return; EH={n, metric:'top', sel:null, all:false}; renderExHist(); document.getElementById('exHist').style.display='flex'; document.getElementById('ehPanel').scrollTop=0; }
function closeExHist(){ document.getElementById('exHist').style.display='none'; }
function ehMetrics(kind){
  return kind==='kg'?[['top','Ciężar'],['e1','1RM szac.'],['vol','Objętość']]
    : kind==='time'?[['top','Najdłużej'],['vol','Suma w treningu']] : [['top','Najlepsza seria'],['vol','Suma w treningu']];
}
function ehChart(h,an){
  const W=340,H=196,L=38,R=12,T=18,B=26, k=EH.metric, today=todayISO();
  const all=an.map((s,i)=>({t:parseISO(s.iso).getTime()+432e5, y:k==='e1'?Math.round(s.m.e1*2)/2:s.m[k], pr:s.prs.includes(k), i, today:s.iso===today}));
  // 1RM: trening bez serii do 12 powtórzeń nie ma szacunku — pomijamy go, zamiast rysować 0
  const pts=k==='e1'?all.filter(p=>p.y>0):all, skipped=all.length-pts.length;
  if(pts.length<2) return {svg:null, sel:EH.sel==null?an.length-1:EH.sel, skipped};
  const lo=Math.min(...pts.map(p=>p.y)), hi=Math.max(...pts.map(p=>p.y));
  const pad=(hi-lo)*0.12||Math.max(1,hi*0.05), raw=(hi-lo+2*pad)/4, mag=Math.pow(10,Math.floor(Math.log10(raw)));
  const step=[1,2,2.5,5,10].find(m=>m*mag>=raw)*mag;
  const y0=Math.max(0,Math.floor((lo-pad)/step)*step), y1=Math.ceil((hi+pad)/step)*step;
  const t0=pts[0].t-2*864e5, t1=pts[pts.length-1].t+2*864e5;
  const X=t=>L+(t-t0)/(t1-t0)*(W-L-R), Y=y=>T+(1-(y-y0)/((y1-y0)||1))*(H-T-B);
  let g='';
  const p3=an.find((s,i)=>i>0 && s.phase3);
  if(p3){ const px=X(parseISO(p3.iso).getTime()-864e5); g+=`<rect x="${px}" y="${T}" width="${Math.max(0,W-R-px)}" height="${H-T-B}" fill="var(--amber-soft)" opacity=".45"/><text class="ph" x="${px+5}" y="${T+12}">FAZA 3</text>`; }
  for(let v=y0; v<=y1+1e-9; v+=step) g+=`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${L-6}" y="${Y(v)+3.5}" text-anchor="end">${k==='vol'&&v>=1000?prFmt(v/1000)+'k':prFmt(v)}</text>`;
  const MON=['sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','lis','gru'];
  for(let d=new Date(t0); d.getTime()<=t1; d=new Date(d.getFullYear(),d.getMonth()+1,1)){
    const f=new Date(d.getFullYear(),d.getMonth(),1).getTime(); if(f<t0) continue;
    g+=`<line x1="${X(f)}" x2="${X(f)}" y1="${T}" y2="${H-B}" stroke="var(--line)" stroke-dasharray="2 3"/><text x="${X(f)+4}" y="${H-8}">${MON[d.getMonth()]}</text>`;
  }
  g+=`<path d="${pts.map((p,i)=>(i?'L':'M')+X(p.t).toFixed(1)+','+Y(p.y).toFixed(1)).join(' ')}" fill="none" stroke="var(--amber)" stroke-width="2" stroke-linejoin="round"/>`;
  const sel=EH.sel==null?pts[pts.length-1].i:EH.sel, sp=pts.find(p=>p.i===sel);
  if(sp) g+=`<line x1="${X(sp.t)}" x2="${X(sp.t)}" y1="${T}" y2="${H-B}" stroke="var(--ink-dim)" stroke-dasharray="3 3"/>`;
  pts.forEach(p=>{
    const cx=X(p.t), cy=Y(p.y);
    g+=p.pr?`<circle cx="${cx}" cy="${cy}" r="5.5" fill="var(--gold)" stroke="var(--bg)" stroke-width="1.5"/>`:`<circle cx="${cx}" cy="${cy}" r="3.5" fill="var(--panel)" stroke="var(--amber)" stroke-width="1.5"/>`;
    if(p.i===sel) g+=`<circle cx="${cx}" cy="${cy}" r="9" fill="none" stroke="var(--ink)" stroke-width="1.5"/>`;
    if(p.today) g+=`<text x="${cx}" y="${cy-12}" text-anchor="end" style="fill:var(--gold);font-weight:600">dziś</text>`;
  });
  // pola dotyku szersze niż kropki
  const hw=Math.max(7,Math.min(20,(W-L-R)/pts.length/2));
  pts.forEach(p=>{ g+=`<rect data-ept="${p.i}" x="${X(p.t)-hw}" y="${T}" width="${hw*2}" height="${H-T-B}" fill="transparent" style="cursor:pointer"/>`; });
  return {svg:`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Wykres: ${esc(h.n)}">${g}</svg>`, sel, skipped};
}
function renderExHist(){
  const h=exIndex()[EH.n]; if(!h){ closeExHist(); return; }
  const an=prAnalyze(h), b=prBest(h.kind,an), u=prUnit(h.kind), K=h.kind;
  const {svg,sel,skipped}=ehChart(h,an), s=an[sel], today=todayISO();
  const e1note=EH.metric!=='e1'||!skipped?'':svg
    ?`<div class="eh-note">Pominięte treningi (${skipped}): same serie powyżej 12 powtórzeń, z nich nie liczymy 1RM. Postęp przy wielu powtórzeniach widać w zakładkach Ciężar i Objętość.</div>`
    :`<div class="eh-note">Za mało serii do 12 powtórzeń, żeby pokazać trend 1RM. Przy wielu powtórzeniach postęp widać w zakładkach Ciężar i Objętość.</div>`;
  const val=k=>k==='e1'?(s.m.e1>0?'≈ '+prE1(s.m.e1)+' kg':'— (serie powyżej 12 powt.)'):k==='vol'?prNum(s.m.vol)+' '+(K==='kg'?'kg':u):prTopText(K,s);
  const tiles=K==='kg'
    ?[['Najcięższa seria',prTopText(K,b.top),b.top.iso],['1RM szacowany',b.e1.m.e1?'≈ '+prE1(b.e1.m.e1)+' kg':'—',b.e1.iso],['Objętość treningu',b.vol.full?prNum(b.vol.m.vol)+' kg':'—',b.vol.full?b.vol.iso:null]]
    :[[K==='time'?'Najdłużej':'Najlepsza seria',prTopText(K,b.top),b.top.iso],['Suma w treningu',b.vol.full?prNum(b.vol.m.vol)+' '+u:'—',b.vol.full?b.vol.iso:null],['Treningi',String(an.length),an[0].iso]];
  let reps='';
  if(K==='kg'){
    const by={}; an.forEach(x=>x.sets.forEach(y=>{ if(y.kg>0 && (!by[y.kg]||y.r>by[y.kg].r)) by[y.kg]={r:y.r,iso:x.iso}; }));
    const kgs=Object.keys(by).map(Number).sort((a,c)=>c-a).slice(0,5);
    if(kgs.length) reps=`<div class="eh-sec">Najwięcej powtórzeń przy ciężarze</div><table class="eh-reps">${kgs.map(kg=>`<tr><td>${prFmt(kg)} kg</td><td>${by[kg].r} powt.</td><td>${prDD(by[kg].iso)}</td></tr>`).join('')}</table>`;
  }
  const list=[...an].reverse(), shown=EH.all?list:list.slice(0,6), p3=an.find((x,i)=>i>0&&x.phase3);
  const chips=t=>t.map(p=>`<span class="prchip">🏆 ${prName(K,p)}</span>`).join('');
  document.getElementById('ehPanel').innerHTML=`<div class="eh-grab"></div>
    <div class="eh-head"><div style="flex:1;min-width:0"><div class="eyebrow">Historia · ${an.length} ${an.length===1?'trening':an.length%10>=2&&an.length%10<=4&&(an.length%100<10||an.length%100>=20)?'treningi':'treningów'}</div><h2 id="ehTitle">${esc(h.n)}</h2></div>
      <button class="eh-x" data-ehclose aria-label="Zamknij">✕</button></div>
    ${an.length>1?`<div class="eh-chips">${ehMetrics(K).map(([k,l])=>`<button data-emetric="${k}" class="${EH.metric===k?'on':''}">${l}</button>`).join('')}</div>${svg?`<div class="eh-chart">${svg}</div>`:''}${e1note}`:''}
    <div class="eh-sel"><div class="d">${s.iso===today?'Dziś · ':''}${DOW_SHORT[parseISO(s.iso).getDay()]} ${prDD(s.iso)}</div><div><b>${prSetsText(K,s.sets)}</b></div>
      <div class="m">${ehMetrics(K).filter(([k])=>k!==EH.metric).map(([k,l])=>l+': '+val(k)).join(' · ')}</div>
      ${s.prs.length?`<div class="b" style="display:flex;gap:4px;flex-wrap:wrap;margin-top:2px">${chips(s.prs)}</div>`:''}</div>
    <div class="eh-tiles">${tiles.map(([l,v,iso])=>`<div><span>${l}</span><b>${v}</b><small>${iso?(l==='Treningi'?'od '+prDD(iso):prDD(iso)):''}</small></div>`).join('')}</div>
    ${reps}
    <div class="eh-sec">Treningi</div>
    ${shown.map(x=>`<div class="eh-s"><div class="d">${prDD(x.iso)}</div><div class="t">${prSetsText(K,x.sets)}${p3&&x.iso===p3.iso?'<small>początek fazy 3 · −10%</small>':''}${x.full?'':'<small>niepełny trening</small>'}</div><div class="b">${chips(x.prs)}</div></div>`).join('')}
    ${list.length>6?`<button class="eh-more" data-eall>${EH.all?'Pokaż mniej':'Pokaż wszystkie ('+list.length+')'}</button>`:''}
    <details class="eh-how"><summary>Jak liczymy rekordy?</summary><ul>
      <li>Liczą się tylko odhaczone serie. Pominięte ćwiczenia nie wchodzą do historii.</li>
      <li>Pierwszy trening ćwiczenia to punkt startowy, a nie rekord.</li>
      <li>1RM to szacunek wzorem Epleya z serii do 12 powtórzeń. Nie musisz go nigdy dźwigać.</li>
      <li>Rekord objętości liczy się tylko wtedy, gdy zrobisz wszystkie serie z planu.</li>
      <li>Po wymianie ćwiczenia przez Trenera historia idzie pod nową nazwą, tak jak podpowiedzi „Ostatnio”.</li>
    </ul></details>`;
}
document.getElementById('exHist').addEventListener('click',e=>{
  const t=e.target.closest('[data-ehclose],[data-emetric],[data-ept],[data-eall]'); if(!t) return;
  if('ehclose' in t.dataset) closeExHist();
  else if(t.dataset.emetric){ EH.metric=t.dataset.emetric; renderExHist(); }
  else if(t.dataset.ept!=null){ EH.sel=+t.dataset.ept; renderExHist(); }
  else { EH.all=!EH.all; renderExHist(); }
});
document.addEventListener('keydown',e=>{ if(e.key==='Escape' && document.getElementById('exHist').style.display==='flex') closeExHist(); });

/* Postęp → Rekordy: najświeższe rekordy na górze */
var recAll=false;
function recSpark(h,an){
  const ys=an.map(s=>h.kind==='kg'?(s.m.e1||s.m.top):s.m.top), lo=Math.min(...ys), hi=Math.max(...ys), n=ys.length;
  if(n<2) return '<svg viewBox="0 0 92 36" aria-hidden="true"></svg>';
  const pts=ys.map((y,i)=>[(i/(n-1))*88+2, 32-((y-lo)/((hi-lo)||1))*28]), l=pts[n-1];
  return `<svg viewBox="0 0 92 36" aria-hidden="true"><polyline points="${pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')}" fill="none" stroke="var(--amber)" stroke-width="2" stroke-linejoin="round"/><circle cx="${l[0]}" cy="${l[1]}" r="3" fill="var(--amber)"/></svg>`;
}
function renderRecords(){
  const box=document.getElementById('recList'); if(!box) return;
  const wk=addDays(todayISO(),-7);
  const rows=Object.values(exIndex()).map(h=>{ const an=prAnalyze(h); return {h, an, b:prBest(h.kind,an), lp:[...an].reverse().find(s=>s.prs.length)}; })
    .sort((a,c)=>(c.lp?c.lp.iso:'').localeCompare(a.lp?a.lp.iso:'') || c.an.length-a.an.length);
  const fresh=rows.filter(r=>r.lp && r.lp.iso>wk).length;
  document.getElementById('recSide').textContent=fresh?fresh+' z nowym rekordem w tym tygodniu':'';
  if(!rows.length){ box.innerHTML='<div class="rec-empty">Tu pojawią się Twoje najlepsze wyniki. Odhaczaj serie na treningach — rekordy liczą się od drugiego treningu danego ćwiczenia.</div>'; return; }
  const shown=recAll?rows:rows.slice(0,6);
  box.innerHTML=shown.map(({h,an,b,lp})=>{
    const sub=h.kind==='kg'?(b.e1.m.e1?'1RM ≈ '+prE1(b.e1.m.e1)+' kg · ':'')+prDD(b.top.iso):(h.kind==='time'?'najdłużej · ':'najlepsza seria · ')+prDD(b.top.iso);
    return `<button class="reccard" data-hist="${encodeURIComponent(h.n)}"><div class="nm"><span>${esc(h.n)}</span>${lp&&lp.iso>wk?'<span class="rec-new">Nowy</span>':''}</div>
      <div class="v">${prTopText(h.kind,b.top)}</div>${recSpark(h,an)}<div class="s">${sub}</div></button>`;
  }).join('')+(rows.length>6?`<button class="eh-more" id="recMore">${recAll?'Pokaż mniej':'Pokaż wszystkie ('+rows.length+')'}</button>`:'');
  box.querySelectorAll('[data-hist]').forEach(x=>x.onclick=()=>openExHist(decodeURIComponent(x.dataset.hist)));
  const m=document.getElementById('recMore'); if(m) m.onclick=()=>{ recAll=!recAll; renderRecords(); };
}

/* ---- Zamień: ćwiczenie na inne na te same mięśnie ----
   Grupy: [nazwa, przelicznik ciężaru względem wzorca grupy, sprzęt, ciężar na rękę, powtórzenia/czas, technika (dla spoza planu)].
   Zamiana trafia do S.adj.ex jak zmiana od Trenera (user:1); „tylko dziś” ma to=dzień, w trakcie ćwiczenia fromSet + was. */
function swapGroupsData(){ return [
  {g:'klatka, triceps, przód barków', m:[
    ['Wyciskanie sztangi — ławka płaska',1,'sztanga'],
    ['Wyciskanie hantli — ławka płaska',.4,'hantle',1,'','Hantle nad klatką, łopatki ściągnięte. Opuszczasz do boków klatki, łokcie ~45°, wyciskasz do złączenia nad mostkiem.'],
    ['Wyciskanie hantli — ławka skośna',.35,'hantle',1],
    ['Wyciskanie na maszynie (chest press)',.9,'maszyna',0,'','Uchwyty na wysokości środka klatki, łopatki dociśnięte do oparcia. Wyciskasz bez blokowania łokci, wracasz powoli.'],
    ['Rozpiętki w bramie (wyciąg)',.15,'wyciąg',1],
    ['Pompki',0,'bez sprzętu',0,'max']]},
  {g:'barki, triceps', m:[
    ['Wyciskanie żołnierskie (stojąc)',1,'sztanga'],
    ['Wyciskanie hantli siedząc (barki)',.4,'hantle',1],
    ['Wyciskanie na maszynie barkowej',.85,'maszyna',0,'','Plecy przy oparciu, uchwyty na wysokości barków. Wyciskasz w górę bez wyginania lędźwi.'],
    ['Wznosy hantli bokiem (barki)',.15,'hantle',1]]},
  {g:'plecy (najszerszy), biceps', m:[
    ['Ściąganie drążka wyciągu z góry',1,'wyciąg'],
    ['Podciąganie na drążku (lub wyciąg)',0,'drążek',0,'max'],
    ['Ściąganie wąskim uchwytem (wyciąg)',1,'wyciąg',0,'','Uchwyt V, lekko odchylony tułów. Ciągniesz do górnej części klatki, łokcie wzdłuż tułowia, łopatki w dół.'],
    ['Wiosłowanie hantlem jednorącz',.5,'hantel',1]]},
  {g:'plecy (środek), tył barków, biceps', m:[
    ['Wiosłowanie sztangą w opadzie',1,'sztanga'],
    ['Wiosłowanie hantlem jednorącz',.45,'hantel',1],
    ['Wiosłowanie na wyciągu siedząc',.9,'wyciąg',0,'','Plecy proste, klatka do przodu. Ciągniesz do brzucha, ściągasz łopatki, wracasz bez garbienia.'],
    ['Wiosłowanie na maszynie',.9,'maszyna',0,'','Klatka oparta o podparcie. Ciągniesz łokciami w tył, ściągasz łopatki, kontrolowany powrót.']]},
  {g:'uda (przód), pośladki', m:[
    ['Przysiad ze sztangą na karku',1,'sztanga'],
    ['Przysiad z hantlami / Hack',.8,'hantle / maszyna'],
    ['Wyciskanie nóg na suwnicy',1.8,'maszyna'],
    ['Wypady chodzone z hantlami',.3,'hantle',1],
    ['Przysiad goblet (hantel)',.4,'hantel',0,'','Hantel pionowo przy klatce, łokcie w dół. Schodzisz między kolana, plecy proste, wstajesz napierając piętami.']]},
  {g:'tył uda, pośladki, dół pleców', m:[
    ['Martwy ciąg (klasyczny/rumuński)',1,'sztanga'],
    ['Rumuński martwy ciąg (RDL)',.85,'sztanga'],
    ['Hip thrust (sztanga)',1,'sztanga',0,'','Łopatki na ławce, sztanga na biodrach (z podkładką). Wypychasz biodra do linii tułowia, napinasz pośladki, broda lekko w dół.'],
    ['Uginanie nóg na maszynie',.35,'maszyna'],
    ['Swing kettlebell',.25,'kettlebell']]},
  {g:'biceps', m:[
    ['Uginanie ramion ze sztangą (biceps)',1,'sztanga'],
    ['Uginanie młotkowe (biceps)',.45,'hantle',1],
    ['Uginanie ramion na wyciągu',.9,'wyciąg',0,'','Łokcie przy tułowiu, bez bujania. Uginasz do pełnego napięcia, opuszczasz powoli.']]},
  {g:'triceps', m:[
    ['Wyciskanie francuskie hantli (triceps)',1,'hantel'],
    ['Prostowanie ramion na wyciągu (triceps)',1,'wyciąg'],
    ['Pompki na poręczach (dipy)',0,'poręcze',0,'max','Tułów pionowo, schodzisz do ok. 90° w łokciach, wypychasz się bez bujania. Za trudne — poręcze z gumą albo maszyna.']]},
  {g:'łydki', m:[
    ['Wspięcia na palce (łydki)',1,'maszyna / sztanga'],
    ['Wspięcia na palce siedząc',.6,'maszyna'],
    ['Wspięcia na palce jednonóż z hantlem',.3,'hantel',1,'','Stopa na krawędzi stopnia, druga ręka trzyma się ściany. Pełne opuszczenie pięty, wspięcie z pauzą na górze.']]},
  {g:'brzuch', m:[
    ['Allahy (brzuch z wyciągiem)',1,'wyciąg'],
    ['Brzuszki na ławce skośnej',0,'ławka'],
    ['Unoszenie nóg na ławce skośnej',0,'ławka'],
    ['Ab Wheel / brzuszki na piłce',0,'kółko / piłka'],
    ['Russian twist z hantlem',.3,'hantel']]},
  {g:'brzuch (izometria)', m:[
    ['Deska (plank)',0,'bez sprzętu',0,'45 s'],
    ['Deska boczna',0,'bez sprzętu',0,'30 s/stronę'],
    ['Ab Wheel / brzuszki na piłce',0,'kółko / piłka']]},
  {g:'chwyt, tułów', m:[
    ['Farmer walk z hantlami',1,'hantle',1],
    ['Swing kettlebell',.6,'kettlebell']]}
]; }
// leniwie: karta dnia renderuje się wcześniej w skrypcie niż ta część
var SWAP_GROUPS_C=null;
function SG(){ return SWAP_GROUPS_C||(SWAP_GROUPS_C=swapGroupsData()); }
function swapAlts(name){
  const n=(name||'').trim(), out=[], seen=new Set([n]);
  SG().forEach(g=>{ const me=g.m.find(m=>m[0]===n); if(!me) return;
    g.m.forEach(m=>{ if(seen.has(m[0])) return; seen.add(m[0]); out.push({n:m[0], k:m[1], eq:m[2], ph:!!m[3], r:m[4]||'', cue:m[5]||'', grp:g.g, base:me[1]}); }); });
  return out;
}
function swapGroup(name){ const n=(name||'').trim(), g=SG().find(g=>g.m.some(m=>m[0]===n)); return g?g.g:''; }
// zamiana w trakcie ćwiczenia: serie przed fromSet należą do poprzedniego ćwiczenia (was)
function swapSplit(e, iso){ const a=e&&e._adj; return a && a.swap && a.user && a.from===iso && a.fromSet>1 && a.was ? a : null; }
function swapDoneCount(rec, n){ let d=0; while(d<n && setOk(rec,d+1)) d++; return d; }
// cofnąć można zamianę zrobioną dziś, dopóki nie odhaczono serii nowego ćwiczenia
function swapCanUndo(e, iso, rec){
  const a=e&&e._adj; if(!a || !a.user || !a.swap || a.from!==todayISO() || iso!==todayISO()) return false;
  for(let s=a.fromSet||1; s<=e.s; s++) if(setOk(rec,s)) return false;
  return true;
}
function swapNote(e, iso, rec){
  const a=e._adj; if(!a || !a.user || !a.swap) return '';
  const sp=swapSplit(e, iso), bits=[];
  if(sp) bits.push(`Serie 1–${sp.fromSet-1}: ${esc(sp.was)}`);
  if(swapCanUndo(e, iso, rec)) bits.push(`<button class="link-btn" data-swap-undo="${iso===todayISO()?w0Index(e, iso):''}">↺ Cofnij zamianę</button>`);
  return bits.length?`<div class="ex-sub">${bits.join(' · ')}</div>`:'';
}
function w0Index(e, iso){ const w=workoutOn(iso); return w.ex.findIndex(e0=>effEx(e0,iso).n===e.n); }
function adjOrigOf(name){ const ex=(S.adj&&S.adj.ex)||{}; for(const k in ex) for(const y of ex[k]) if(y.swap&&y.swap.n===name) return k; return name; }
// zalecany ciężar ćwiczenia (jak na karcie): zmiana od Trenera/zamiana → historia → start z planu
function swapRecKg(e, iso){
  let kg=(e._adj && e._adj.w>0) ? e._adj.w : scaledStart(e);
  const prog=progressionFor(e, iso, e.rp||0, false); if(prog && prog.kg>0) kg=prog.kg;
  return kg||0;
}
function swapBaseKg(iso, i, e){
  if(WO && WO.iso===iso && WO.ex[i]){ const x=WO.ex[i], k=woCurSet(i), v=x.sets[k<0?0:k]; if(v && v.kg>0) return v.kg; }
  for(let s=1;s<=e.s;s++){ const inp=document.querySelector(`.set input[data-k="${iso}_e${i}"][data-s="w${s}"]`); if(inp && +inp.value>0) return +inp.value; }
  return swapRecKg(e, iso);
}
function swapSuggest(o, base, reason, iso){
  const prev=prevSession(o.n, iso), ex={n:o.n, start:o.ph?'/rękę':''};
  let kg=0, src;
  if(prev){ kg=Math.max(...prev.sets.map(x=>x.kg)); src=`ostatnio ${prDD(prev.iso)}: ${prSetsText(o.r&&!/max/.test(o.r)?'time':(prev.sets.some(x=>x.kg>0)?'kg':'reps'), prev.sets.map(x=>({kg:x.kg, r:x.rp})))}`; }
  else if(o.k>0 && o.base>0 && base>0){ kg=roundLoad(ex, base*o.k/o.base); src=`przeliczone z ${prFmt(base)} kg — dopasuj po 1. serii`; }
  else if(o.k>0) src='dobierz ciężar (2 powtórzenia w zapasie)';
  else src=/\d+\s*s\b/.test(o.r)?'na czas':'ciężar ciała';
  if(reason==='pain' && kg>0){ kg=roundLoad(ex, kg*0.8); src+=' · −20%, bo boli'; }
  return {kg, src, hist:!!prev};
}
var SW=null;
function openSwap(iso, i){ SW={iso, i, reason:'busy', pick:0, scope:'today'}; renderSwap(); document.getElementById('swSheet').style.display='flex'; document.getElementById('swPanel').scrollTop=0; }
function closeSwap(){ document.getElementById('swSheet').style.display='none'; }
function renderSwap(){
  const w=workoutOn(SW.iso), e0=w.ex[SW.i], e=effEx(e0,SW.iso), rec=log(SW.iso).ex[SW.iso+'_e'+SW.i];
  const done=swapDoneCount(rec, e.s), base=swapBaseKg(SW.iso, SW.i, e);
  const opts=swapAlts(e.n).map(o=>Object.assign({o}, swapSuggest(o, base, SW.reason, SW.iso)));
  // najpierw to, co już robiłeś (znany ciężar); przy braku sprzętu maszyny na koniec
  opts.sort((x,y)=>(SW.reason==='gear'?(/maszyna/.test(x.o.eq)-/maszyna/.test(y.o.eq)):0) || (y.hist-x.hist));
  Object.assign(SW, {opts, done, e, e0, ts:timedSpec(e,e0)});
  const p=opts[SW.pick]||opts[0], left=e.s-done;
  document.getElementById('swPanel').innerHTML=`<div class="eh-grab"></div>
    <div class="eh-head"><div style="flex:1;min-width:0"><div class="eyebrow">Zamień ćwiczenie</div><h2 id="swTitle">${esc(e.n)}</h2>
      <div class="sw-grp">Te same mięśnie: ${esc(swapGroup(e.n))}</div></div><button class="eh-x" data-swclose aria-label="Zamknij">✕</button></div>
    <div class="sw-lab">Dlaczego?</div>
    <div class="eh-chips">${[['busy','Zajęte stanowisko'],['pain','Coś boli'],['gear','Brak sprzętu']].map(([k,l])=>`<button data-swreason="${k}" class="${SW.reason===k?'on':''}">${l}</button>`).join('')}</div>
    ${SW.reason==='pain'?'<div class="sw-warn">Ostry albo kłujący ból — przerwij to ćwiczenie. Zamiennik dostaje ciężar o 20% niższy, a Trener zobaczy tę zamianę.</div>':''}
    <div class="sw-lab">Na co?</div>
    <div class="sw-opts">${opts.map((x,j)=>`<button class="sw-opt ${j===SW.pick?'on':''}" data-swpick="${j}">
      <span class="n"><span>${esc(x.o.n)}</span><span>${x.kg?prFmt(x.kg)+' kg'+(x.o.ph?' / rękę':''):(x.o.r==='max'?'MAX':x.o.r)}</span></span>
      <small>${x.hist?'<span class="sw-tag">ROBIŁEŚ</span>':''}${esc(x.o.eq)} · ${x.src}</small></button>`).join('')}</div>
    <div class="sw-lab">Na jak długo?</div>
    <div class="sw-seg">
      <button data-swscope="today" class="${SW.scope==='today'?'on':''}"><b>Tylko dziś</b><small>następnym razem wraca ćwiczenie z planu</small></button>
      <button data-swscope="perm" class="${SW.scope==='perm'?'on':''}"><b>Na stałe</b><small>w planie od dziś, jak zmiana od Trenera</small></button>
    </div>
    ${done?`<div class="sw-split">Zrobione <b>${done} ${done===1?'seria':done<5?'serie':'serii'}</b> zostają jako ${esc(e.n)}. Pozostałe <b>${left}</b> zrobisz jako ${esc(p.o.n)}. Historia i rekordy liczą się osobno.</div>`:''}
    <button class="wo-save" data-swapply>${done?'ZAMIEŃ POZOSTAŁE SERIE':'ZAMIEŃ'}</button>
    <button class="sw-ask" data-swask>Żadne nie pasuje? Zapytaj Trenera →</button>`;
}
function swapApply(){
  const {iso, i, e, done}=SW, x=SW.opts[SW.pick]; if(!x) return;
  S.adj=S.adj||{}; S.adj.ex=S.adj.ex||{};
  const k=adjOrigOf(e.n), old=S.adj.ex[k]||[], prevToday=old.find(y=>y.user && y.from===iso);
  let rp=e.rp||0, r;
  if(x.o.r){ r=x.o.r; const m=/(\d+)/.exec(x.o.r); rp=m?+m[1]:(rp||10); }
  else if(SW.ts || !rp) rp=SW.ts?12:10;   // z ćwiczenia na czas / „max” na zwykłe powtórzenia
  const a={from:iso, w:x.kg||0, ph:x.o.ph?1:0, s:e.s, rp, swap:{n:x.o.n, cue:x.o.cue}, user:1, reason:SW.reason,
    was:prevToday?prevToday.was:e.n, id:Date.now()};
  if(r) a.r=r;
  if(SW.scope==='today') a.to=iso;
  const fs=prevToday&&prevToday.fromSet ? prevToday.fromSet : (done>0 ? done+1 : 0); if(fs) a.fromSet=fs;
  // ponowna zamiana tego samego dnia zastępuje poprzednią
  S.adj.ex[k]=old.filter(y=>!(y.user && y.from===iso)).concat([a]);
  S._settingsM=Date.now(); save(); closeSwap(); renderToday();
  if(WO && WO.iso===iso) woSwapRebuild(i);
  swapToast('Zamieniono na: '+x.o.n, ()=>swapUndo(i, iso));
}
function swapUndo(i, iso){
  const w=workoutOn(iso), e=effEx(w.ex[i], iso), a=e._adj; if(!a || !a.user) return;
  const ex=S.adj.ex; for(const k in ex){ ex[k]=ex[k].filter(y=>y.id!==a.id); if(!ex[k].length) delete ex[k]; }
  S._settingsM=Date.now(); save(); renderToday();
  if(WO && WO.iso===iso) woSwapRebuild(i);
  document.getElementById('swToast').style.display='none';
}
// tryb treningu po zamianie: niezrobione serie dostają nowe ćwiczenie i ciężar, zrobione zostają
function woSwapRebuild(i){
  const w=workoutOn(WO.iso), e0=w.ex[i], e=effEx(e0,WO.iso), ts=timedSpec(e,e0), old=WO.ex[i];
  const kg=swapRecKg(e, WO.iso), noKg=!(kg>0) && (ts || swapAlts(e.n).length && (SG().some(g=>g.m.some(m=>m[0]===e.n.trim() && m[1]===0))));
  WO.ex[i]=Object.assign({}, old, {n:e.n, s:e.s, timed:!!ts, secs:ts?ts.secs:0, sides:ts?ts.sides:1, up:ts?ts.up:false, step:progStep(e), rest:restFor(e,ts)+ciRestPlus(WO.iso),
    sets:old.sets.map((v,j)=>old.ok[j]?v:{kg:noKg?null:kg, r:e.rp||0}), prPopped:false});
  WO.tStart=0; woSave(); woRender();
}
function woSwapLine(i){
  const e=effEx(workoutOn(WO.iso).ex[i], WO.iso), a=e._adj; if(!a || !a.user || !a.swap || a.from!==WO.iso) return '';
  const rec=log(WO.iso).ex[WO.ex[i].key];
  return `<div class="wo-from">zamiast <b>${esc(a.was||'')}</b> · ${a.to?'tylko dziś':'na stałe od dziś'}${swapCanUndo(e, WO.iso, rec)?' · <button id="woSwapUndo">↺ cofnij</button>':''}</div>`;
}
var swToastT=null;
function swapToast(msg, undo){
  const t=document.getElementById('swToast'); document.getElementById('swToastTxt').textContent=msg; t.style.display='flex';
  document.getElementById('swToastUndo').onclick=()=>{ t.style.display='none'; undo(); };
  clearTimeout(swToastT); swToastT=setTimeout(()=>{ t.style.display='none'; }, 6000);
}
document.getElementById('swSheet').addEventListener('click', ev=>{
  const t=ev.target.closest('[data-swclose],[data-swreason],[data-swpick],[data-swscope],[data-swapply],[data-swask]'); if(!t) return;
  const d=t.dataset;
  if('swclose' in d) closeSwap();
  else if(d.swreason){ SW.reason=d.swreason; SW.pick=0; renderSwap(); }
  else if(d.swpick!=null){ SW.pick=+d.swpick; renderSwap(); }
  else if(d.swscope){ SW.scope=d.swscope; renderSwap(); }
  else if('swapply' in d) swapApply();
  else {
    const why={busy:'zajęte stanowisko', pain:'coś boli', gear:'brak sprzętu'}[SW.reason], n=SW.e.n;
    closeSwap();
    document.getElementById('coachDialog').style.zIndex=document.getElementById('woFocus').style.display==='flex'?'455':'';   // nad trybem treningu
    openCoach(); document.getElementById('coachIn').value=`Nie mogę dziś zrobić: ${n} (${why}). Zaproponuj zamiennik na te same mięśnie, z ciężarem.`;
  }
});

/* ---- przerwy między seriami: z planu, Twoje albo od Trenera (ostatnia decyzja wygrywa) ----
   S.adj.rest = { nazwa ćwiczenia: {sec, by:'me'|'tr', id} } — synchronizowane razem z S.adj (po _settingsM). */
function restOverride(name){ return (S.adj && S.adj.rest && S.adj.rest[(name||'').trim()]) || null; }
function restFor(e, ts){ const o=restOverride(e.n); return o ? o.sec : restSecs(e, ts); }
function restPlanOf(name, timed){ return restSecs({n:name}, timed?{}:null); }
function restCurrent(name, timed){ const o=restOverride(name); return o ? o.sec : restPlanOf(name, timed); }
function restTag(name){ const o=restOverride(name); return o ? `<span class="rs-tag ${o.by}">${o.by==='tr'?'TRENER':'TWOJA'}</span>` : ''; }
// faktyczne przerwy z trybu treningu: średnia z 3 ostatnich treningów z tym ćwiczeniem (bez przejść między ćwiczeniami)
function restStats(name){
  const n=(name||'').trim(), today=todayISO(), vals=[]; let sessions=0;
  const keys=Object.keys(S.log).filter(k=>k<=today && hasSession(S.log[k])).sort().reverse();
  for(const k of keys){
    const s=S.log[k].session; let got=[];
    if(s.log) got=s.log.filter(l=>(l.ex||'').trim()===n && l.restBefore!=null).map(l=>l.restBefore);
    else { const e=(s.ex||[]).find(x=>(x.n||'').trim()===n); if(e && e.avgRest) got=[e.avgRest]; }
    if(got.length){ vals.push(...got); if(++sessions>=3) break; }
  }
  return vals.length ? {avg:Math.round(vals.reduce((a,b)=>a+b,0)/vals.length), sessions} : null;
}
function restSet(name, sec, by){
  const n=(name||'').trim(); S.adj=S.adj||{}; S.adj.rest=S.adj.rest||{};
  if(by==='me' && sec===restPlanOf(n, (exIndex()[n]||{}).timed)) delete S.adj.rest[n]; else S.adj.rest[n]={sec, by, id:Date.now()};
  S._settingsM=Date.now(); save(); restApplyLive(n);
  if(document.getElementById('v-train') && document.getElementById('v-train').classList.contains('on')) renderToday();
}
// trwający trening: nowa przerwa od razu (także w odliczanej przerwie po serii tego ćwiczenia)
function restApplyLive(name){
  if(!WO) return;
  WO.ex.forEach((x,i)=>{ if(x.n.trim()!==name) return;
    const nr=restCurrent(x.n, x.timed)+ciRestPlus(WO.iso);
    if(WO.phase==='rest' && !WO.trans && i===WO.cur && WO.restPlan!==nr){ WO.restEnd+=(nr-WO.restPlan)*1000; WO.restPlan=nr; WO.beeped=false; }
    x.rest=nr; });
  woSave(); if(document.getElementById('woFocus').style.display==='flex'){ woRender(); woStep(); }
}
// podpowiedź na ekranie przerwy: dwa razy +15 s albo średnia z 3 treningów wyraźnie inna niż ustawiona przerwa
function woRestLearnHtml(){
  if(WO.trans) return '';
  const x=WO.ex[WO.cur]; if(!x || x.learnNo) return '';
  const cur=x.rest, st=restStats(x.n);
  let tgt=0, txt='';
  if((WO.plusCount||0)>=2){ tgt=Math.round(WO.restPlan/15)*15; txt=`Dokładasz czas. <b>Ustawić ${fmtDur(tgt)}</b> przy tym ćwiczeniu na stałe?`; }
  else if(!restOverride(x.n) && st && st.sessions>=3 && Math.abs(st.avg-cur)>=25){ tgt=Math.round(st.avg/15)*15;
    txt=`Przy tym ćwiczeniu odpoczywasz średnio <b>${fmtDur(st.avg)}</b> (3 ostatnie treningi), ustawione ${fmtDur(cur)}. <b>Ustawić ${fmtDur(tgt)}</b>?`; }
  if(!tgt || tgt===cur) return '';
  return `<div class="wo-learn"><div>${txt}</div><div class="row"><button id="woLearnNo">Nie teraz</button><button class="yes" id="woLearnYes" data-sec="${tgt}">Ustaw ${fmtDur(tgt)}</button></div></div>`;
}
var RS=null;
function openRestEdit(name, timed, fromList){
  const n=(name||'').trim(), o=restOverride(n), plan=restPlanOf(n, timed);
  RS={n, timed, plan, sec:o?o.sec:plan, fromList:fromList||null};
  renderRestEdit(); document.getElementById('rsSheet').style.display='flex'; document.getElementById('rsPanel').scrollTop=0;
}
function renderRestEdit(){
  const o=restOverride(RS.n), st=restStats(RS.n);
  document.getElementById('rsPanel').innerHTML=`<div class="eh-grab"></div>
    <div class="eh-head"><div style="flex:1;min-width:0"><div class="eyebrow">${RS.fromList?'<button class="rs-back" data-rsback>‹ Lista</button> · ':''}Przerwa między seriami</div><h2 id="rsTitle">${esc(RS.n)}</h2></div><button class="eh-x" data-rsclose aria-label="Zamknij">✕</button></div>
    <div class="rs-step"><button data-rsstep="-15" aria-label="Krócej o 15 sekund">−15 s</button><b>${fmtDur(RS.sec)}</b><button data-rsstep="15" aria-label="Dłużej o 15 sekund">+15 s</button></div>
    <div class="eh-chips">${[45,60,90,120,150,180,240].map(v=>`<button data-rsset="${v}" class="${RS.sec===v?'on':''}">${fmtDur(v)}</button>`).join('')}</div>
    <div class="wo-rows">
      <div><span>Plan</span><span>${fmtDur(RS.plan)}</span></div>
      <div><span>Twoja średnia${st?' ('+st.sessions+' '+(st.sessions===1?'trening':'treningi')+')':''}</span><span>${st?fmtDur(st.avg):'—'}</span></div>
      ${o?`<div><span>Teraz ustawione przez ${o.by==='tr'?'Trenera':'Ciebie'}</span><span>${fmtDur(o.sec)}</span></div>`:''}
    </div>
    <div class="rs-hint">Ciężkie wielostawowe (przysiad, martwy ciąg, wyciskanie): 2–3 min. Izolowane (barki, biceps, łydki): 1–1:30. Zapamiętam przy tym ćwiczeniu na kolejne treningi — Trener też to zobaczy.</div>
    <button class="wo-save" data-rssave>ZAPISZ ${fmtDur(RS.sec)}</button>
    ${o?'<button class="sw-ask" data-rsplan>↺ Wróć do planu ('+fmtDur(RS.plan)+')</button>':''}`;
}
function openRestList(iso){
  const w=workoutOn(iso), idx=exIndex(), names=new Map();
  if(w && w.ex) w.ex.forEach(e0=>{ const e=effEx(e0,iso); names.set(e.n.trim(), !!timedSpec(e,e0)); });
  Object.values(idx).forEach(h=>{ if(!names.has(h.n)) names.set(h.n, h.timed); });
  Object.keys((S.adj&&S.adj.rest)||{}).forEach(n=>{ if(!names.has(n)) names.set(n, false); });
  const today=new Set(w&&w.ex?w.ex.map(e0=>effEx(e0,iso).n.trim()):[]);
  const rows=[...names].map(([n,t])=>({n, t, o:restOverride(n), st:restStats(n), today:today.has(n)}))
    .sort((a,b)=>(b.today-a.today) || (!!b.o-!!a.o) || a.n.localeCompare(b.n,'pl'));
  RS={list:iso};
  document.getElementById('rsPanel').innerHTML=`<div class="eh-grab"></div>
    <div class="eh-head"><div style="flex:1;min-width:0"><div class="eyebrow">Twoje ustawienia</div><h2 id="rsTitle">Przerwy między seriami</h2></div><button class="eh-x" data-rsclose aria-label="Zamknij">✕</button></div>
    <div class="rs-hint" style="margin-top:-4px">Stuknij ćwiczenie, żeby zmienić przerwę. Znaczek pokazuje, kto ją ustawił.</div>
    <div class="rs-list">${rows.map(r=>`<button data-rsedit="${encodeURIComponent(r.n)}" data-rst="${r.t?1:0}"><span class="nm">${esc(r.n)}<small>${r.today?'dziś · ':''}plan ${fmtDur(restPlanOf(r.n,r.t))}${r.st?' · średnio '+fmtDur(r.st.avg):''}</small></span><span class="v">${fmtDur(restCurrent(r.n,r.t))}${restTag(r.n)}</span></button>`).join('')}</div>`;
  document.getElementById('rsSheet').style.display='flex'; document.getElementById('rsPanel').scrollTop=0;
}
function closeRest(){ document.getElementById('rsSheet').style.display='none'; }
var rsToastT=null;
function restToast(msg){ const t=document.getElementById('rsToast'); t.textContent=msg; t.style.display='block'; clearTimeout(rsToastT); rsToastT=setTimeout(()=>{ t.style.display='none'; }, 3000); }
document.getElementById('rsSheet').addEventListener('click', ev=>{
  const t=ev.target.closest('[data-rsclose],[data-rsstep],[data-rsset],[data-rssave],[data-rsplan],[data-rsedit],[data-rsback]'); if(!t) return;
  const d=t.dataset;
  if('rsclose' in d) closeRest();
  else if(d.rsstep){ RS.sec=Math.max(30, Math.min(300, RS.sec + +d.rsstep)); renderRestEdit(); }
  else if(d.rsset){ RS.sec=+d.rsset; renderRestEdit(); }
  else if(d.rsedit) openRestEdit(decodeURIComponent(d.rsedit), d.rst==='1', RS.list);
  else if('rsback' in d) openRestList(RS.fromList);
  else {
    const sec='rsplan' in d ? RS.plan : RS.sec, back=RS.fromList;
    restSet(RS.n, sec, 'me'); restToast('rsplan' in d ? 'Wrócono do przerwy z planu' : 'Przerwa '+fmtDur(sec)+' zapamiętana przy tym ćwiczeniu');
    if(back) openRestList(back); else closeRest();
    if(typeof moreStatus==='function' && document.getElementById('v-set').classList.contains('on')) moreStatus();
  }
});

/* ---- check-in przed treningiem: sen, zakwasy, energia → lżejszy dzień ----
   L.checkin = {sleep, sore, energy: 0 słabo … 2 dobrze, plan:'normal'|'light'|'light2'|'skip', at}
   light: ciężar −10% (zaokrąglenie jak w planie), light2: do tego jedna seria mniej (effEx). Synchronizowane (nowsze at). */
var CI_Q=[
  {k:'sleep', l:'Jak spałeś?', o:[['😴','Słabo'],['🙂','OK'],['😌','Dobrze']]},
  {k:'sore', l:'Zakwasy, ból mięśni?', o:[['🔥','Mocne'],['〰️','Lekkie'],['✅','Brak']]},
  {k:'energy', l:'Energia teraz?', o:[['🪫','Niska'],['⚡','OK'],['🚀','Wysoka']]}
];
function ciLight(L){ const c=L && L.checkin; return !!(c && (c.plan==='light' || c.plan==='light2')); }
function ciVerdict(a, iso, sym){
  if(['sleep','sore','energy'].some(k=>a[k]==null)) return null;
  const s=a.sleep+a.sore+a.energy, inf=cyInfo(iso||todayISO()), sy=new Set(sym||[]);
  // cykl: decydują objawy; faza to tylko kontekst
  if(inf && inf.sit!=='preg'){
    if(inf.inPeriod && (sy.has('Skurcze')||sy.has('Obfite krwawienie')) && s<=3) return {c:'low', plan:'light', move:true, rest:true, t:'Okres z objawami', d:'Do wyboru: lżejszy trening (−10%, przerwy +30 s, bez mocnego obciążania brzucha) albo lekki ruch — 20–30 min spaceru i mobilności często łagodzi skurcze.'};
    if(inf.phase==='lut' && (sy.size>=2 || s<=3)) return {c:'mid', plan:'light', rest:true, t:'Gorsze dni przed okresem', d:'Proponuję lżej: ciężar −10% i przerwy dłuższe o 30 s. Ten tydzień bywa trudniejszy — to normalne i przejściowe.'};
    // Twoje wzorce: w fazie, w której energia jest u Ciebie zwykle niższa, przy granicznym samopoczuciu proponujemy lżej
    const pn=cyPhaseNote(inf.phase);
    if(pn && pn.low && s===4) return {c:'mid', plan:'light', rest:true, t:'Twoja słabsza faza', d:'Z Twoich check-inów: w tej fazie energia jest u Ciebie zwykle niższa. Proponuję lżej (−10%, przerwy +30 s) — jeśli w trakcie poczujesz moc, wróć do planu.'};
    if(pn && pn.high && s>=5) return {c:'ok', plan:'normal', t:'Twoja mocna faza', d:'Z Twoich check-inów: to zwykle Twoje najlepsze dni. Trenujesz według planu — dobry moment na rekord.'};
    if(pn && pn.low && s>=5) return {c:'ok', plan:'normal', t:'Dobra forma', d:'Ta faza bywa u Ciebie słabsza, ale dziś czujesz się dobrze — trenujesz według planu.'};
  }
  if(s>=4) return {c:'ok', plan:'normal', t:'Dobra forma', d:inf && inf.phase==='foll' ? 'Trenujesz według planu. U wielu kobiet to dobry moment na mocniejszy trening — jeśli czujesz moc, spróbuj rekordu.' : 'Trenujesz według planu.'};
  if(s>=2) return {c:'mid', plan:'light', t:'Gorszy dzień', d:'Proponuję lżej: ciężar −10%, serie bez zmian. Technika i ruch są dziś ważniejsze niż rekordy.'};
  return {c:'low', plan:'light2', t:'Mocne zmęczenie', d:'Proponuję lżej: ciężar −10% i jedna seria mniej w każdym ćwiczeniu — albo przesuń trening na inny dzień.'};
}
function ciIcons(c){ return CI_Q.map(q=>c[q.k]!=null?q.o[c[q.k]][0]:'').join(''); }
function ciChip(L, iso){
  const c=L.checkin; if(!c || c.plan==='skip') return '';
  const what=(c.plan==='light2'?'lżejszy dzień (−10%, seria mniej)':c.plan==='light'?'lżejszy dzień (−10%)':c.plan==='moved'?'trening przesunięty':c.plan==='move'?'lekki ruch zamiast treningu':'wg planu')+(c.restPlus?', przerwy +30 s':'');
  return `<div class="ci-chip">Samopoczucie: <b>${ciIcons(c)}</b> · <span class="${ciLight(L)?'lt':''}">${what}</span>${iso===todayISO()?' <button data-ci-edit>zmień</button>':''}</div>`;
}
// START TRENINGU: przy pierwszym starcie dnia najpierw check-in; WZNÓW / DOKOŃCZ startuje od razu
function ciStartOrAsk(iso){
  const L=log(iso), w=workoutOn(iso);
  const fresh=!L.checkin && !hasSession(L) && !(WO && WO.iso===iso) && !w.ex.some((e0,i)=>exAny(L.ex[iso+'_e'+i]));
  if(fresh) openCheckin(iso, 'start'); else woStart(iso);
}
var CI=null;
function openCheckin(iso, mode){
  const c=log(iso).checkin||{};
  CI={iso, mode, a:{sleep:c.sleep, sore:c.sore, energy:c.energy}, sym:new Set(cySym(iso))};
  renderCheckin(); document.getElementById('ciSheet').style.display='flex'; document.getElementById('ciPanel').scrollTop=0;
}
function closeCheckin(){ document.getElementById('ciSheet').style.display='none'; }
function renderCheckin(){
  const v=ciVerdict(CI.a, CI.iso, [...CI.sym]), hard=CI.a.sore===0, start=CI.mode==='start';
  const inf=cyInfo(CI.iso), symList=inf && inf.sit==='meno' ? CY_SYM_MENO : CY_SYM;
  const ask=!cyGet().on && !cyGet().asked && S.profile && S.profile.sex==='f';
  const go=t=>start?'▶ '+t:t;
  document.getElementById('ciPanel').innerHTML=`<div class="eh-grab"></div>
    <div class="eh-head"><div style="flex:1;min-width:0"><div class="eyebrow">${start?'Zanim zaczniesz · 3 stuknięcia':'Samopoczucie dziś'}</div><h2 id="ciTitle">Jak się dziś czujesz?</h2></div><button class="eh-x" data-ciclose aria-label="Zamknij">✕</button></div>
    ${inf && inf.day && (inf.sit==='natural' || inf.inPeriod) ? `<div class="ci-ctx">${inf.sit==='natural'?'Dzień '+inf.day+' cyklu · ':''}${CY_PH[inf.phase]||'okres'}</div>`:''}
    ${CI_Q.map(q=>`<div class="ci-q"><span class="l">${q.l}</span><div class="ci-seg">${q.o.map(([ic,l],j)=>`<button data-cia="${q.k}:${j}" class="${CI.a[q.k]===j?'on '+(j===0?'lo':j===2?'hi':''):''}" aria-pressed="${CI.a[q.k]===j}"><i>${ic}</i>${l}</button>`).join('')}</div></div>`).join('')}
    ${inf && inf.sit!=='preg' ? `<div class="ci-q"><span class="l">Coś jeszcze? <span style="color:var(--ink-faint);font-weight:500">(opcjonalnie)</span></span><div class="ci-sym">${symList.map(x=>`<button data-cisym="${x}" class="${CI.sym.has(x)?'on':''}" aria-pressed="${CI.sym.has(x)}">${x}</button>`).join('')}</div></div>`:''}
    ${v?`<div class="ci-verdict ${v.c}"><b>${v.t}</b><span>${v.d}</span>${hard?'<small>Mocne zakwasy: dłuższa rozgrzewka (5–8 min) i pierwsza seria lżej.</small>':''}${CI.sym.has('Obfite krwawienie')?'<small>Przy obfitym krwawieniu warto dziś zjeść coś z żelazem: wołowina, soczewica, szpinak z cytrusami.</small>':''}</div>`:''}
    ${!v?`<button class="wo-save" disabled style="opacity:.35">ODPOWIEDZ NA 3 PYTANIA</button>`
      : v.c==='ok'?`<button class="wo-save" data-ciplan="normal">${go('START TRENINGU').replace('START TRENINGU',start?'START TRENINGU':'ZAPISZ')}</button>`
      : `<button class="wo-save" data-ciplan="${v.plan}">${start?'▶ TRENUJ LŻEJ':'LŻEJSZY DZIEŃ'}</button>${v.move?'<button class="ci-alt" data-ciplan="move">Lekki ruch zamiast treningu</button>':''}<button class="ci-alt" data-ciplan="normal">${start?'Trenuj normalnie':'Według planu'}</button>${v.c==='low'&&!v.move?'<button class="ci-alt" data-cimove>Przesuń trening na inny dzień</button>':''}`}
    ${start?'<button class="sw-ask" data-ciplan="skip">Pomiń — od razu start</button>':''}
    ${ask?'<div class="ci-ask">Chcesz, żeby trening uwzględniał cykl? <button data-ciopency>Włącz śledzenie cyklu</button> · <button data-cinoask>Nie, dziękuję</button></div>':''}`;
}
function ciSave(plan){
  const iso=CI.iso, L=log(iso);
  const v=ciVerdict(CI.a, iso, [...CI.sym]);
  L.checkin=Object.assign(plan==='skip'?{}:{sleep:CI.a.sleep, sore:CI.a.sore, energy:CI.a.energy}, {plan, at:Date.now()});
  if(v && v.rest && (plan==='light'||plan==='light2')) L.checkin.restPlus=30;
  touch(L); save(); closeCheckin();
  if(cyTracking() && plan!=='skip') cySetSym(iso, [...CI.sym]);   // objawy tylko w danych o cyklu (prywatność)
  if(iso===todayISO()) viewOffset=0;   // karta dzisiejszego dnia musi mieć nowe ciężary, zanim tryb treningu je odczyta
  renderToday();
  if(CI.mode==='start' && plan!=='move') woStart(iso);
  else if(WO && WO.iso===iso) woRefreshFromCard();
}
// tryb treningu po zmianie check-inu (albo „Wróć do planu”): niezrobione serie dostają ciężary i liczbę serii z karty
function woRefreshFromCard(){
  viewOffset=0; renderToday();
  const nb=woBuild(WO.iso);
  WO.ex=WO.ex.map((x,i)=>{ const n=nb[i]; if(!n) return x;
    const ok=n.sets.map((_,j)=>!!x.ok[j]);
    return Object.assign({}, x, {s:n.s, sets:n.sets.map((v,j)=>ok[j] && x.sets[j] ? x.sets[j] : v), ok}); });
  if(woCurSet(WO.cur)<0){ const nx=woNext(WO.cur); if(nx>=0) WO.cur=nx; }
  woSave(); woRender(); woStep();
}
function woLightBanner(){
  const L=log(WO.iso); if(!ciLight(L)) return '';
  return `<div class="wo-light"><span><b>Lżejszy dzień</b> · ciężar −10%${L.checkin.plan==='light2'?', seria mniej':''}</span><button id="woLightOff">Wróć do planu</button></div>`;
}
document.getElementById('ciSheet').addEventListener('click', ev=>{
  const t=ev.target.closest('[data-ciclose],[data-cia],[data-cisym],[data-ciplan],[data-cimove],[data-ciopency],[data-cinoask]'); if(!t) return;
  const d=t.dataset;
  if('ciclose' in d) closeCheckin();
  else if(d.cia){ const [k,v]=d.cia.split(':'); CI.a[k]=+v; renderCheckin(); }
  else if(d.cisym){ CI.sym.has(d.cisym)?CI.sym.delete(d.cisym):CI.sym.add(d.cisym); renderCheckin(); }
  else if('ciopency' in d){ closeCheckin(); openCycle(); }
  else if('cinoask' in d){ const c=Object.assign({}, cyGet(), {asked:true}); cySave(c); renderCheckin(); }
  else if(d.ciplan) ciSave(d.ciplan);
  else { const iso=CI.iso, L=log(iso); L.checkin={sleep:CI.a.sleep, sore:CI.a.sore, energy:CI.a.energy, plan:'moved', at:Date.now()}; touch(L); save(); closeCheckin(); openMove(iso); }
});

/* ---- cykl i samopoczucie (dobrowolne) ----
   Dane o cyklu są wrażliwe: domyślnie tylko w localStorage (zelazo_cycle). Po włączeniu synchronizacji
   kopia w S.cyc = {at, data} (nowsza wygrywa; wyłączenie zostawia {at, off:true}, żeby zniknęły z serwera).
   Dopasowanie treningu wynika z objawów, dzień cyklu jest kontekstem (badania: różnice indywidualne są duże). */
var CY_LS='zelazo_cycle', CYC=null;
var CY_SIT=[
  ['natural','Naturalny cykl','dzień i faza cyklu, prognoza okresu'],
  ['hormonal','Antykoncepcja hormonalna','bez faz — tylko krwawienie i objawy'],
  ['irregular','Nieregularny cykl / PCOS','bez prognoz — zapisane okresy i objawy'],
  ['meno','Okołomenopauza / menopauza','objawy: uderzenia gorąca, sen, nastrój'],
  ['preg','Ciąża / po porodzie','trening tylko za zgodą lekarza; aplikacja nie dopasowuje planu']
];
var CY_SYM=['Skurcze','Ból głowy','Wzdęcia','Obniżony nastrój','Ból piersi','Obfite krwawienie','Plamienie','Trawienie'];
var CY_SYM_MENO=['Uderzenia gorąca','Gorszy sen','Obniżony nastrój','Ból stawów','Ból głowy'];
function cyGet(){
  if(CYC) return CYC;
  let l={}; try{ l=JSON.parse(localStorage.getItem(CY_LS)||'null')||{}; }catch(e){}
  const r=S.cyc;
  if(r && (r.at||0)>(l.at||0)){
    l = r.off ? Object.assign({}, l, {sync:false, at:r.at}) : (r.data||l);
    try{ localStorage.setItem(CY_LS, JSON.stringify(l)); }catch(e){}
  }
  return CYC=l;
}
function cySave(c){
  c.at=Date.now(); CYC=c;
  try{ localStorage.setItem(CY_LS, JSON.stringify(c)); }catch(e){}
  if(c.sync){ S.cyc={at:c.at, data:c}; save(); }
  else if(S.cyc && !S.cyc.off){ S.cyc={at:c.at, off:true}; save(); }   // usuń kopię z serwera
}
function cyTracking(){ const c=cyGet(); return !!(c.on && c.sit && c.sit!=='none'); }
function cyDiff(a,b){ return Math.round((parseISO(b)-parseISO(a))/864e5); }
function cyPeriods(){ return ((cyGet().periods)||[]).slice().sort((a,b)=>a.s<b.s?-1:1); }
function cyLen(){
  const s=cyPeriods().map(p=>p.s), d=[];
  for(let i=1;i<s.length;i++){ const x=cyDiff(s[i-1],s[i]); if(x>=15 && x<=60) d.push(x); }
  const last=d.slice(-6); return last.length ? Math.round(last.reduce((a,b)=>a+b,0)/last.length) : 28;
}
var CY_PH={period:'okres', foll:'faza folikularna', ov:'okolice owulacji', lut:'faza lutealna'};
function cyInfo(iso){
  if(!cyTracking()) return null;
  const c=cyGet(), ps=cyPeriods().filter(p=>p.s<=iso), p=ps[ps.length-1];
  if(!p) return {day:null, phase:null, inPeriod:false, sit:c.sit};
  const day=cyDiff(p.s, iso)+1, inPeriod=p.e ? iso<=p.e : (day<=7 || !!(p.still && iso<=addDays(p.still,1))), L=cyLen();
  let phase=null;
  if(c.sit==='natural' && day<=L+10) phase = inPeriod ? 'period' : day<=L-16 ? 'foll' : day<=L-12 ? 'ov' : 'lut';
  else if(inPeriod) phase='period';
  return {day, phase, inPeriod, p, len:L, sit:c.sit};
}
function cySym(iso){ return ((cyGet().sym||{})[iso])||[]; }
function cySetSym(iso, list){ const c=Object.assign({}, cyGet()); c.sym=Object.assign({}, c.sym||{}); if(list.length) c.sym[iso]=list; else delete c.sym[iso]; cySave(c); }
function cyPeriodStart(iso){ const c=Object.assign({}, cyGet()); c.periods=cyPeriods().filter(p=>p.s!==iso); c.periods.push({s:iso, e:null, flow:{}}); cySave(c); }
function cyPeriodEnd(iso){ const c=Object.assign({}, cyGet()); const ps=cyPeriods(), p=ps.filter(q=>q.s<=iso).pop(); if(p){ p.e=iso; delete p.auto; c.periods=ps; cySave(c); } }
function cyPatchPeriod(start, patch){ const c=Object.assign({}, cyGet()), ps=cyPeriods(); ps.forEach(p=>{ if(p.s===start) Object.assign(p, patch); }); c.periods=ps; cySave(c); }
// koniec bez odpowiedzi: 7. dzień albo ostatni dzień „Jeszcze trwa”; oznaczony jako automatyczny
function cyAutoEnd(p){ const e=p.still && p.still>addDays(p.s,6) ? p.still : addDays(p.s,6); cyPatchPeriod(p.s, {e, auto:true}); }
function cyPeriodLen(p){ return p.e ? cyDiff(p.s, p.e)+1 : null; }
function cyFlow(iso, f){ const c=Object.assign({}, cyGet()); const ps=cyPeriods(), p=ps.filter(q=>q.s<=iso).pop(); if(p){ p.flow=Object.assign({}, p.flow||{}, {[iso]:f}); c.periods=ps; cySave(c); } }
// pasek nad treningiem: dzień cyklu i jedno stuknięcie „okres się zaczął”
function cyRenderBox(iso){
  const box=document.getElementById('cyBox'); if(!box) return;
  const inf=cyInfo(iso);
  if(!inf || inf.sit==='preg'){ box.innerHTML=''; return; }
  const today=iso===todayISO(), fl=inf.inPeriod && inf.p && inf.p.flow ? inf.p.flow[iso] : null;
  if(today && inf.p && !inf.p.e && !inf.inPeriod){ cyAutoEnd(inf.p); return cyRenderBox(iso); }   // brak odpowiedzi — koniec przyjęty automatycznie
  const askEnd=today && inf.inPeriod && inf.p && !inf.p.e && inf.day>=3 && inf.p.still!==iso;
  // jedna linia: dzień cyklu + przycisk (początek albo koniec okresu)
  const PH={period:'okres', foll:'folikularna', ov:'owulacja', lut:'lutealna'};
  let row='';
  const fc=today && !inf.inPeriod ? cyForecast() : null, soon=fc && !fc.late && fc.in>=1 && fc.in<=3 ? ' · okres za ~'+fc.in+' '+(fc.in===1?'dzień':'dni') : fc && fc.late ? ' · spóźnia się '+fc.late+' '+(fc.late===1?'dzień':'dni') : '';
  if(inf.day && (inf.sit==='natural' || inf.inPeriod)) row+=`<span class="cy-chip">● ${inf.sit==='natural'?'dzień '+inf.day+' · ':''}${PH[inf.phase]||(inf.inPeriod?'okres':'')}${soon}</span>`;
  if(today && inf.inPeriod) row+= inf.p && inf.p.e ? `<span class="cy-endnote">koniec: ${inf.p.e===iso?'dziś':prDD(inf.p.e)}</span>` : `<button class="cy-end" data-cyend>Koniec okresu</button>`;
  else if(today && inf.sit!=='meno') row+=`<button class="cy-start" data-cystart>＋ Okres się zaczął</button>`;
  let h=row?`<div class="cy-row1">${row}</div>`:'';
  if(today && inf.inPeriod) h+=`<div class="cy-flow"><span>Krwawienie:</span>${[['light','Lekkie'],['medium','Średnie'],['heavy','Obfite']].map(([k,t])=>`<button data-cyflow="${k}" class="${fl===k?'on':''}">${t}</button>`).join('')}</div>`;
  if(askEnd) h+=`<div class="cy-confirm"><b>Okres już się skończył?</b><span>Dzień ${inf.day} okresu. Zapisana długość pomoże lepiej dopasować trening w kolejnych cyklach.</span>
    <div class="row"><button class="yes" data-cyendt="0">Tak, dziś</button><button class="yes" data-cyendt="1">Tak, wczoraj</button><button data-cystill>Jeszcze trwa</button></div></div>`;
  if(today && inf.inPeriod && inf.day>7 && !(inf.p.longNote)) h+=`<div class="cy-confirm"><b>Krwawienie trwa już ${inf.day} dni.</b><span>Okres dłuższy niż 7 dni warto skonsultować z lekarzem — zwłaszcza gdy jest obfity albo powtarza się co cykl.</span><div class="row"><button data-cylong>Rozumiem</button></div></div>`;
  box.innerHTML=h;
  box.querySelectorAll('[data-cyflow]').forEach(b=>b.onclick=()=>{ cyFlow(iso, b.dataset.cyflow); cyRenderBox(iso); });
  const e=box.querySelector('[data-cyend]'); if(e) e.onclick=()=>{ cyPeriodEnd(iso); cyRenderBox(iso); restToast('Zapisano koniec okresu'); };
  box.querySelectorAll('[data-cyendt]').forEach(b=>b.onclick=()=>{ const d=addDays(iso, -(+b.dataset.cyendt)); cyPeriodEnd(d); renderToday(); restToast('Zapisano koniec okresu · '+prDD(d)); });
  const sl=box.querySelector('[data-cystill]'); if(sl) sl.onclick=()=>{ cyPatchPeriod(inf.p.s, {still:iso}); cyRenderBox(iso); };
  const ln=box.querySelector('[data-cylong]'); if(ln) ln.onclick=()=>{ cyPatchPeriod(inf.p.s, {longNote:true}); cyRenderBox(iso); };
  const st=box.querySelector('[data-cystart]'); if(st) st.onclick=()=>cyAskStart(iso);
}
// „Okres się zaczął”: mniej niż 15 dni od poprzedniego to prawie zawsze pomyłka albo plamienie — najpierw pytamy
function cyAskStart(iso){
  const prev=cyPeriods().filter(p=>p.s<iso).pop(), gap=prev?cyDiff(prev.s, iso):99;
  if(gap>=15){ cyDoStart(iso); return; }
  const box=document.getElementById('cyBox');
  box.innerHTML=`<div class="cy-confirm"><b>Poprzedni okres zaczął się ${prDD(prev.s)} — ${gap} ${gap===1?'dzień':'dni'} temu.</b>
    <span>To nowy okres? Plamienie między miesiączkami możesz zaznaczyć w check-inie jako objaw.</span>
    <div class="row"><button class="yes" data-cyyes>Tak, nowy okres</button><button data-cyno>Anuluj</button></div></div>`;
  box.querySelector('[data-cyyes]').onclick=()=>cyDoStart(iso);
  box.querySelector('[data-cyno]').onclick=()=>cyRenderBox(iso);
}
function cyDoStart(iso){
  cyPeriodStart(iso); cyRenderBox(iso);
  swapToast('Zapisano: dzień 1 cyklu', ()=>{ const c=Object.assign({}, cyGet()); c.periods=cyPeriods().filter(p=>p.s!==iso); cySave(c); renderToday(); });
}
function cyMoveHtml(){
  return `<div class="cy-move"><b>Lekki ruch · ok. 25 min</b><span>Spacer 15 min · krążenia bioder i koci grzbiet 5 min · rozciąganie dolnej części pleców 5 min. Ruch często łagodzi skurcze.</span><button data-cytrain>Jednak trenuję</button></div>`;
}
// dodatkowe 30 s przerwy w dni z objawami (check-in)
function ciRestPlus(iso){ const c=S.log[iso] && S.log[iso].checkin; return (c && c.restPlus) || 0; }
// Więcej → Cykl i samopoczucie
var CYS=null;
function openCycle(){ CYS={del:false}; renderCycle(); document.getElementById('cySheet').style.display='flex'; document.getElementById('cyPanel').scrollTop=0; }
function closeCycle(){ document.getElementById('cySheet').style.display='none'; }
function renderCycle(){
  const c=cyGet();
  const sw=(k,on,label)=>`<button class="cy-sw ${on?'on':''}" data-cyt="${k}" aria-pressed="${on}" aria-label="${label}"></button>`;
  document.getElementById('cyPanel').innerHTML=`<div class="eh-grab"></div>
    <div class="eh-head"><div style="flex:1;min-width:0"><div class="eyebrow">Dobrowolne</div><h2 id="cyTitle">Cykl i samopoczucie</h2></div><button class="eh-x" data-cyclose aria-label="Zamknij">✕</button></div>
    <div class="cy-row"><div><b>Śledzenie cyklu</b><small>Dopasuje trening, check-in i komentarze do wagi do Twojego cyklu i samopoczucia.</small></div>${sw('on', !!c.on, 'Śledzenie cyklu')}</div>
    ${c.on?`<div class="sw-lab">Twoja sytuacja</div>
      <div class="cy-opts">${CY_SIT.map(([k,t,d])=>`<button class="${c.sit===k?'on':''}" data-cysit="${k}"><b>${t}</b><small>${d}</small></button>`).join('')}<button class="${c.sit==='none'?'on':''}" data-cysit="none"><b>Wolę nie śledzić</b><small>zwykły check-in, nic się nie zmienia</small></button></div>
      ${cyStage2Html()}
      ${c.sit && c.sit!=='none' && c.sit!=='meno' && c.sit!=='preg'?`<div class="sw-lab">Zapisane okresy</div>
        <div class="cy-list">${cyPeriods().slice().reverse().map(p=>{ const pv=cyPeriods().filter(q=>q.s<p.s).pop(), g=pv?cyDiff(pv.s,p.s):null;
          // uwaga stoi przy podejrzanym (późniejszym) wpisie — to on jest zwykle pomyłką
          // początek i koniec do poprawienia; koniec może być pusty, póki okres trwa
          return `<div class="cy-pr2 ${g!=null&&g<15?'warn':''}">
            <label>Początek<input type="date" class="md-in" data-cyedit="${p.s}" value="${p.s}" max="${todayISO()}"></label>
            <label>Koniec<input type="date" class="md-in" data-cyend2="${p.s}" value="${p.e||''}" min="${p.s}" max="${todayISO()}"></label>
            <button data-cyrm="${p.s}" aria-label="Usuń okres z ${prDD(p.s)}">✕</button>
            <span class="g">${g==null?'pierwszy zapisany':g<15?'<b>tylko '+g+' dni po poprzednim?</b>':g+' dni po poprzednim'}${cyPeriodLen(p)?' · trwał '+cyPeriodLen(p)+' '+(cyPeriodLen(p)===1?'dzień':'dni')+(p.auto?' (przyjęte automatycznie — popraw, jeśli trzeba)':''):' · koniec niezapisany'}</span></div>`; }).join('')||'<div class="rs-hint">Brak zapisanych okresów.</div>'}</div>
        <div class="cy-pr add"><input type="date" class="md-in" id="cyAdd" max="${todayISO()}" aria-label="Dodaj początek okresu"><span class="g">dodaj wcześniejszy okres</span></div>
        <div class="rs-hint">Najnowszy okres jest na górze. ✕ usuwa tylko ten jeden wpis.</div>`:''}
      <div class="sw-lab">Prywatność</div>
      <div class="cy-row"><div><b>Tylko na tym telefonie</b><small>${c.sync?'Synchronizacja włączona — dane o cyklu trafiają na serwer aplikacji razem z resztą. Administrator aplikacji technicznie ma do nich dostęp.':'Dane o cyklu nie są wysyłane na serwer ani na inne urządzenia.'}</small></div>${sw('local', !c.sync, 'Tylko na tym telefonie')}</div>
      <div class="cy-row"><div><b>Trener może z tego korzystać</b><small>Dzień cyklu i objawy idą do Trenera tylko razem z Twoim pytaniem.</small></div>${sw('coach', c.coach!==false, 'Trener może korzystać z danych o cyklu')}</div>
      <button class="ci-alt" data-cydel style="color:var(--red)">${CYS.del?'Na pewno? Stuknij jeszcze raz, żeby usunąć':'Usuń historię cyklu'}</button>`:''}
    <div class="rs-hint">Nigdy nie włącza się sama. Dopasowanie treningu zawsze jest propozycją — decyzja należy do Ciebie. Aplikacja nie stawia diagnoz.</div>`;
  const panel=document.getElementById('cyPanel');
  panel.querySelectorAll('[data-cyedit]').forEach(inp=>inp.onchange=()=>{ const old=inp.dataset.cyedit, v=inp.value; if(!v || v===old) return;
    const c2=Object.assign({}, cyGet()), ps=cyPeriods();
    if(ps.some(p=>p.s===v)){ renderCycle(); return; }   // taki wpis już jest
    ps.forEach(p=>{ if(p.s===old){ p.s=v; if(p.e && p.e<v) p.e=null; p.flow={}; } }); c2.periods=ps; cySave(c2); renderToday(); renderCycle(); });
  panel.querySelectorAll('[data-cyend2]').forEach(inp=>inp.onchange=()=>{ const st=inp.dataset.cyend2, v=inp.value;
    if(v && (v<st || v>todayISO())){ renderCycle(); return; }   // koniec nie przed początkiem i nie w przyszłości
    const c2=Object.assign({}, cyGet()), ps=cyPeriods();
    ps.forEach(p=>{ if(p.s===st){ p.e=v||null; delete p.auto; delete p.still; } }); c2.periods=ps; cySave(c2); renderToday(); renderCycle(); restToast(v?'Zapisano koniec okresu · '+prDD(v):'Usunięto datę końca'); });
  panel.querySelectorAll('[data-cyrm]').forEach(b=>b.onclick=()=>{ const c2=Object.assign({}, cyGet()); c2.periods=cyPeriods().filter(p=>p.s!==b.dataset.cyrm); cySave(c2); renderToday(); renderCycle(); restToast('Usunięto wpis'); });
  const ad=document.getElementById('cyAdd');
  if(ad) ad.onchange=()=>{ if(!ad.value) return; const c2=Object.assign({}, cyGet()), ps=cyPeriods(); if(!ps.some(p=>p.s===ad.value)){ ps.push({s:ad.value, e:addDays(ad.value,4), flow:{}}); c2.periods=ps; cySave(c2); } renderToday(); renderCycle(); };
}
document.getElementById('cySheet').addEventListener('click', ev=>{
  const t=ev.target.closest('[data-cyclose],[data-cyt],[data-cysit],[data-cydel]'); if(!t) return;
  const d=t.dataset, c=Object.assign({}, cyGet());
  if('cyclose' in d){ closeCycle(); return; }
  if(d.cyt==='on'){ c.on=!c.on; if(c.on && !c.sit) c.sit='natural'; if(c.coach==null) c.coach=true; }
  else if(d.cyt==='local') c.sync=!c.sync;
  else if(d.cyt==='coach') c.coach=c.coach===false;
  else if(d.cysit) c.sit=d.cysit;
  else if('cydel' in d){ if(!CYS.del){ CYS.del=true; renderCycle(); return; } c.periods=[]; c.sym={}; CYS.del=false; restToast('Usunięto historię cyklu'); }
  cySave(c); renderCycle(); renderToday(); if(document.getElementById('v-progress').classList.contains('on')) renderWeight(); moreStatus();
});
// wykres wagi: dni okresu i tydzień przed nim (tylko naturalny cykl)
function cyChartBands(ctx, XT, t0, span, pad, W, H){
  const inf=cyTracking() && cyGet().sit==='natural'; if(!inf) return;
  const DAY=864e5, L=cyLen(), starts=cyPeriods().map(p=>p.s), now=todayISO();
  const next=starts.length ? addDays(starts[starts.length-1], L) : null;
  const band=(a,b,alpha)=>{ const ta=parseISO(a).getTime(), tb=parseISO(b).getTime()+DAY; if(tb<t0 || ta>t0+span) return;
    const x1=Math.max(pad.l, XT(ta)), x2=Math.min(W-pad.r, XT(tb)); if(x2<=x1) return;
    ctx.fillStyle=`rgba(197,139,214,${alpha})`; ctx.fillRect(x1, pad.t, x2-x1, H-pad.t-pad.b); };
  cyPeriods().forEach(p=>band(p.s, p.e||addDays(p.s,4), .22));
  starts.concat(next && next<=addDays(now,7) ? [next] : []).forEach(s=>band(addDays(s,-7), addDays(s,-1), .09));
}
function cyWeightNote(){
  const el=document.getElementById('wCycleNote'); if(!el) return;
  const inf=cyInfo(todayISO()), ws=S.weights.slice().sort((a,b)=>a.d<b.d?-1:1);
  el.style.display='none';
  if(!inf || inf.sit!=='natural' || ws.length<2) return;
  const lastW=ws[ws.length-1], wk=ws.filter(w=>w.d<=addDays(lastW.d,-6)).pop(); if(!wk) return;
  const dv=lastW.w-wk.w, late=inf.phase==='lut' || (inf.inPeriod && inf.day<=3);
  if(dv>=0.5 && late){ el.innerHTML=`<b>+${dv.toFixed(1).replace('.',',')} kg w ostatnim tygodniu?</b> ${inf.inPeriod?'To początek okresu':'To dni przed okresem'} — zwykle woda, nie tłuszcz. Patrz na trend (niebieska linia); cel kalorii się nie zmienia.`; el.style.display='block'; }
}
/* ---- cykl, etap 2: prognoza, Twoje wzorce i dopasowanie z Twoich danych ----
   Prognoza: ostatni okres + średnia długość cyklu, rozrzut z odchylenia (min. 2 dni, przy nieregularnym 4, max 7).
   Wzorce: check-iny (sen, zakwasy, energia 0–2) i objawy pogrupowane po fazach — tylko naturalny cykl,
   co najmniej 3 check-iny w dwóch fazach. Wszystko liczone na telefonie z danych, które już są. */
function cyGaps(){ const s=cyPeriods().map(p=>p.s), d=[]; for(let i=1;i<s.length;i++){ const x=cyDiff(s[i-1],s[i]); if(x>=15 && x<=60) d.push(x); } return d.slice(-6); }
function cyForecast(){
  if(!cyTracking()) return null;
  const c=cyGet(); if(c.sit!=='natural' && c.sit!=='irregular') return null;
  const ps=cyPeriods(); if(!ps.length) return null;
  const g=cyGaps(), L=cyLen(), today=todayISO();
  const sd=g.length>=3 ? Math.sqrt(g.reduce((a,x)=>a+(x-L)**2,0)/g.length) : null;
  const spread=Math.min(7, Math.max(c.sit==='irregular'?4:2, sd!=null?Math.round(sd):3));
  const next=addDays(ps[ps.length-1].s, L), to=addDays(next,spread);
  return {next, from:addDays(next,-spread), to, in:cyDiff(today,next), L, n:g.length, min:g.length?Math.min(...g):null, max:g.length?Math.max(...g):null,
    pre:addDays(next,-7), late: today>to ? cyDiff(to,today) : 0, sit:c.sit};
}
const CY_PH_ORDER=['period','foll','ov','lut'];
const CY_PH_SHORT={period:'Okres', foll:'Folikularna', ov:'Owulacja', lut:'Lutealna'};
const CY_PH_IN={period:'w czasie okresu', foll:'w fazie folikularnej', ov:'w okolicach owulacji', lut:'w fazie lutealnej'};
function cyPatterns(){
  if(!cyTracking() || cyGet().sit!=='natural') return null;
  const by={}, tot={n:0,e:0};
  Object.keys(S.log||{}).forEach(iso=>{
    const ci=S.log[iso].checkin; if(!ci || ci.energy==null || ci.plan==='skip') return;
    const inf=cyInfo(iso); if(!inf || !inf.phase) return;
    const b=by[inf.phase]||(by[inf.phase]={n:0,energy:0,sleep:0,sore:0});
    b.n++; b.energy+=ci.energy; b.sleep+=ci.sleep||0; b.sore+=ci.sore||0; tot.n++; tot.e+=ci.energy;
  });
  Object.values(by).forEach(b=>{ b.energy/=b.n; b.sleep/=b.n; b.sore/=b.n; });
  const sym={}, raw=cyGet().sym||{};
  Object.keys(raw).forEach(iso=>{ const inf=cyInfo(iso); if(!inf || !inf.phase) return; raw[iso].forEach(x=>{ const o=sym[x]||(sym[x]={n:0}); o.n++; o[inf.phase]=(o[inf.phase]||0)+1; }); });
  const ready=Object.values(by).filter(b=>b.n>=3).length>=2;
  return {by, sym, ready, n:tot.n, overall:tot.n?tot.e/tot.n:0};
}
// czy ta faza jest u Ciebie zwykle słabsza / mocniejsza niż średnio (energia w check-inie)
function cyPhaseNote(phase){
  const P=cyPatterns(); if(!P || !P.ready || !phase) return null;
  const b=P.by[phase]; if(!b || b.n<3) return null;
  const d=b.energy-P.overall;
  return d<=-0.35 ? {low:true, b} : d>=0.35 ? {high:true, b} : null;
}
function cyInsights(P){
  const out=[], ok=Object.entries(P.by).filter(([,b])=>b.n>=3).sort((a,b)=>a[1].energy-b[1].energy);
  if(ok.length>=2){ const lo=ok[0], hi=ok[ok.length-1];
    if(hi[1].energy-lo[1].energy>=0.4) out.push(`Energia jest u Ciebie najniższa <b>${CY_PH_IN[lo[0]]}</b>, a najwyższa <b>${CY_PH_IN[hi[0]]}</b>. Check-in uwzględnia to przy propozycji treningu.`);
    else out.push('Twoja energia jest podobna we wszystkich fazach — trening idzie według planu i samopoczucia z danego dnia.'); }
  const sl=ok.slice().sort((a,b)=>a[1].sleep-b[1].sleep); if(sl.length>=2 && sl[sl.length-1][1].sleep-sl[0][1].sleep>=0.5) out.push(`Najgorzej śpisz <b>${CY_PH_IN[sl[0][0]]}</b>.`);
  Object.entries(P.sym).filter(([,o])=>o.n>=3).forEach(([k,o])=>{ const top=CY_PH_ORDER.filter(ph=>o[ph]).sort((a,b)=>o[b]-o[a])[0];
    if(top && o[top]/o.n>=0.6) out.push(`${esc(k)}: głównie <b>${CY_PH_IN[top]}</b> (${o[top]} z ${o.n} razy).`); });
  return out;
}
function cyStage2Html(){
  const f=cyForecast(); if(!f) return '';
  const d=x=>prDD(x);
  let h=`<div class="sw-lab">Prognoza</div><div class="cy-fc">`;
  if(f.late) h+=`<b class="late">Okres spóźnia się o ${f.late} ${f.late===1?'dzień':'dni'}</b><span>Prognoza: ${d(f.from)}–${d(f.to)}. Kilka dni spóźnienia zdarza się przy stresie, chorobie czy dużym deficycie kalorii. Zaznacz „Okres się zaczął”, gdy przyjdzie.</span>`;
  else if(f.in<=0) h+=`<b>Następny okres: ok. ${d(addDays(f.next, f.L))}</b>`;
  else h+=`<b>Następny okres: ok. ${d(f.next)}</b><span>między ${d(f.from)} a ${d(f.to)} · za ${f.in} ${f.in===1?'dzień':'dni'}</span>`;
  h+=`<span>${f.n?`Średni cykl ${f.L} dni (z ${f.n} ${f.n===1?'cyklu':'cykli'}${f.n>=2?': '+f.min+'–'+f.max+' dni':''}).`:'Prognoza z jednego zapisanego okresu — przyjęto 28 dni. Z każdym kolejnym okresem będzie dokładniejsza.'}${f.sit==='natural'&&!f.late&&f.in>7?' Dni przed okresem od ok. '+d(f.pre)+'.':''}</span>
    <span style="font-size:12px;color:var(--ink-faint)">To szacunek do planowania treningu — nie nadaje się do antykoncepcji ani planowania ciąży.</span></div>`;
  const P=cyPatterns();
  if(P){
    h+=`<div class="sw-lab">Twoje wzorce</div><div class="cy-pat">`;
    if(!P.ready) h+=`<p>Wzorce pojawią się po kilku check-inach przed treningiem w różnych fazach cyklu (co najmniej 3 w dwóch fazach). Na razie: ${P.n} ${P.n===1?'check-in':P.n>=2&&P.n<=4?'check-iny':'check-inów'} w fazach cyklu.</p>`;
    else {
      h+=`<p style="color:var(--ink-faint);font-size:12px">Energia z check-inu (0–2), średnio w fazie</p>`+CY_PH_ORDER.filter(ph=>P.by[ph]).map(ph=>{ const b=P.by[ph];
        return `<div class="r"><span>${CY_PH_SHORT[ph]}</span><span class="bar"><i style="width:${Math.round(b.energy/2*100)}%"></i></span><small>${b.energy.toFixed(1).replace('.',',')} · ${b.n} ${b.n===1?'dzień':'dni'}</small></div>`; }).join('');
      h+=cyInsights(P).map(t=>`<p>${t}</p>`).join('');
    }
    h+=`</div>`;
  }
  return h;
}
// kontekst dla Trenera — tylko za zgodą
function cyCoachContext(today){
  const c=cyGet(); if(!cyTracking() || c.coach===false) return '';
  const inf=cyInfo(today), sitName=(CY_SIT.find(x=>x[0]===c.sit)||[])[1]||c.sit, ps=cyPeriods(), out=[];
  out.push('Cykl (dane od użytkowniczki, za zgodą): '+sitName+(inf&&inf.day?', dziś dzień '+inf.day+(inf.phase?' ('+CY_PH[inf.phase]+')':''):'')+(c.sit==='natural'&&ps.length>=2?', średnia długość cyklu '+cyLen()+' dni':''));
  if(ps.length) out.push('Ostatnie okresy: '+ps.slice(-4).map(p=>{ const f=Object.values(p.flow||{}); return prDD(p.s)+(p.e?'–'+prDD(p.e)+' ('+cyPeriodLen(p)+' dni'+(p.auto?', koniec szacowany':'')+')':'')+(f.includes('heavy')?' (obfity)':''); }).join(', '));
  { const lg=ps.slice(-3).filter(p=>(cyPeriodLen(p)||0)>7 && !p.auto); if(lg.length) out.push('UWAGA: krwawienie dłuższe niż 7 dni ('+lg.map(p=>prDD(p.s)+': '+cyPeriodLen(p)+' dni').join(', ')+') — delikatnie zasugeruj konsultację z lekarzem, zwłaszcza przy obfitym krwawieniu.'); }
  const since=addDays(today,-14), sy=Object.keys(c.sym||{}).filter(k=>k>=since).sort().map(k=>prDD(k)+': '+c.sym[k].join(', ').toLowerCase());
  if(sy.length) out.push('Objawy (14 dni): '+sy.join('; '));
  { const f=cyForecast(); if(f) out.push(f.late?'Okres spóźnia się o '+f.late+' dni (prognoza '+prDD(f.from)+'–'+prDD(f.to)+').':'Prognoza następnego okresu: ok. '+prDD(f.next)+' ('+prDD(f.from)+'–'+prDD(f.to)+').');
    const P=cyPatterns(); if(P && P.ready) out.push('Wzorce z check-inów: '+CY_PH_ORDER.filter(ph=>P.by[ph]&&P.by[ph].n>=3).map(ph=>CY_PH_SHORT[ph].toLowerCase()+' — energia '+P.by[ph].energy.toFixed(1)+'/2 ('+P.by[ph].n+' dni)').join(', ')+'.'); }
  out.push('Zasady: empatycznie i rzeczowo, bez diagnoz; dopasowanie do objawów, nie do kalendarza (różnice między kobietami są duże); decyzja należy do niej. Wzrost wagi przed okresem to zwykle woda — nie obcinaj z tego powodu kalorii. Przy obfitych krwawieniach podpowiadaj produkty z żelazem.');
  // sygnały ostrzegawcze
  const lastS=ps.length?ps[ps.length-1].s:null;
  if(lastS && (c.sit==='natural'||c.sit==='irregular')){
    const gap=cyDiff(lastS, today);
    if(gap>90) out.push('UWAGA: brak okresu od '+gap+' dni (bez ciąży/menopauzy/antykoncepcji w ustawieniach). Nie obniżaj kalorii, przy deficycie zaproponuj powrót do zapotrzebowania i kontakt z lekarzem (możliwy niski dostęp energii).');
  }
  if(c.sit==='natural' && ps.length>=4){ const d=[]; for(let i=1;i<ps.length;i++) d.push(cyDiff(ps[i-1].s, ps[i].s)); const r=d.slice(-3);
    if(r.every(x=>x<21) || r.every(x=>x>35)) out.push('UWAGA: ostatnie cykle stale '+(r[0]<21?'krótsze niż 21':'dłuższe niż 35')+' dni — delikatnie zasugeruj konsultację z lekarzem.'); }
  return out.join('\n');
}

const WO_LS='zelazo_workout';
let WO=null, woTick=null, woWake=null;
function woSave(){ try{ if(WO) localStorage.setItem(WO_LS, JSON.stringify(WO)); else localStorage.removeItem(WO_LS); }catch(e){} }
// lista ćwiczeń dnia z wartościami z karty (podpowiedzi i progresja już w polach)
function woBuild(iso){
  const w=workoutOn(iso);
  return w.ex.map((e0,i)=>{
    const e=effEx(e0,iso), key=iso+'_e'+i, ts=timedSpec(e,e0), sets=[];
    for(let s=1;s<=e.s;s++){
      const wIn=document.querySelector(`.set input[data-k="${key}"][data-s="w${s}"]`), rIn=document.querySelector(`.set input[data-k="${key}"][data-s="r${s}"]`);
      sets.push({kg: wIn ? (wIn.value===''?0:+wIn.value) : null, r: rIn&&rIn.value!=='' ? +rIn.value : (e.rp||0)});
    }
    return {key, n:e.n, s:e.s, timed:!!ts, secs:ts?ts.secs:0, sides:ts?ts.sides:1, up:ts?ts.up:false,
      step:progStep(e), rest:restFor(e, ts)+ciRestPlus(iso), sets};
  });
}
// statystyki sesji z listy serii (tryb treningu i odtworzenie z godzin odhaczenia)
function woAgg(lg, exs){
  const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0, rests=lg.filter(l=>l.restBefore!=null);
  return {work:lg.reduce((a,l)=>a+(l.work||0),0), trans:lg.reduce((a,l)=>a+(l.trans||0),0),
    avgRest:Math.round(avg(rests.map(l=>l.restBefore))), avgRestPlan:Math.round(avg(rests.map(l=>l.restPlan||0))), done:lg.length,
    ex:exs.map(x=>{ const mine=lg.filter(l=>l.ex===x.n), rs=mine.filter(l=>l.restBefore!=null);
      return {n:x.n, sets:mine.length, of:x.s, avgRest:Math.round(avg(rs.map(l=>l.restBefore))), restPlan:x.rest, avgWork:Math.round(avg(mine.map(l=>l.work||0)))}; })};
}
function woStartLabel(iso, w, L){
  if(WO && WO.iso===iso) return 'WZNÓW TRENING';
  if(hasSession(L)) return 'DOKOŃCZ TRENING · '+w.ex.filter((e0,i)=>{ const e=effEx(e0,iso); return okCount(L.ex[iso+'_e'+i], e.s)===e.s; }).length+'/'+w.ex.length;
  return w.ex.some((e0,i)=>exAny(L.ex[iso+'_e'+i])) ? 'WZNÓW TRENING' : 'START TRENINGU';
}
// „Dokończ trening”: ten sam pomiar co zakończona część — czas liczy się dalej, przerwa między częściami jak pauza
function woContinue(iso){
  const L=log(iso); if(!hasSession(L)) return;
  let s=L.session;
  if(!s.log){ const rs=woRebuildSession(iso); if(rs){ s=L.session=rs; touch(L); save(); } }
  const now=Date.now(), last=s.last||s.end||now;
  WO.start=s.start||now;
  WO.pausedTotal=Math.max(0, now-WO.start-(s.dur||0)*1000);   // aktywny czas startuje od zapisanego
  WO.gap=(s.gap||0)+Math.max(0, Math.round((now-last)/1000));
  WO.parts=(s.parts||1)+1;
  WO.log=(s.log||[]).slice(); WO.prs=(s.prs||[]).slice(); WO.pauses=s.pauses||0; WO.skipped=s.skipped||0; WO.forms=(s.forms||[]).slice();
  WO.ex.forEach(x=>{ if(WO.prs.some(p=>p.n===x.n)) x.prPopped=true; });
  WO.setStart=now; WO.phaseAt=now;
}
// sesja zapisana przed listą serii, nadpisana przez „Wznów”: składamy cały trening z godzin odhaczenia serii.
// Przerwa > 20 min między seriami = przerwa w treningu (nie wlicza się). Czas serii: średnia z zapisanej części albo 45 s.
function woRebuildSession(iso){
  const L=log(iso), s=L.session, w=workoutOn(iso);
  if(!hasSession(L) || s.log || !w || w.type!=='lift') return null;
  const ticks=[], exs=[];
  w.ex.forEach((e0,i)=>{ const e=effEx(e0,iso), k=iso+'_e'+i, r=L.ex[k], rest=restSecs(e,timedSpec(e,e0));
    exs.push({n:e.n, s:e.s, rest});
    for(let n=1;n<=e.s;n++){ const t=setOk(r,n) && L._t && L._t['ok:'+k+':'+n]; if(t) ticks.push({t, ex:e.n, set:n, rest}); } });
  if(!ticks.length || !ticks.some(x=>x.t<(s.start||0)-60e3)) return null;   // nic sprzed tej części — nie ma czego łączyć
  ticks.sort((a,b)=>a.t-b.t);
  const per=s.done?Math.max(20,Math.round((s.work||0)/s.done)):45, GAP=20*60, lg=[];
  let gap=0, prev=null;
  ticks.forEach(x=>{
    let restBefore=null, trans=null;
    if(prev){ const g=Math.round((x.t-prev.t)/1000);
      if(g>GAP) gap+=g-per; else if(prev.ex===x.ex) restBefore=Math.max(0,g-per); else trans=Math.max(0,g-per); }
    lg.push({ex:x.ex, set:x.set, work:per, restBefore, trans, restPlan:restBefore!=null?x.rest:null});
    prev=x;
  });
  const start=ticks[0].t-per*1000, last=Math.max(ticks[ticks.length-1].t, s.last||s.end||0);
  return Object.assign({start, end:Date.now(), last, dur:Math.max(0,Math.round((last-start)/1000)-gap-(s.paused||0)),
    paused:(s.paused||0)+gap, pauses:s.pauses||0, gap, parts:gap?2:1, prs:s.prs||[], total:exs.reduce((a,x)=>a+x.s,0),
    skipped:s.skipped||0, title:s.title||w.title, forms:s.forms||[], log:lg, rebuilt:true}, woAgg(lg, exs));
}
function woStart(iso){
  try{ tmrAudio=tmrAudio||new (window.AudioContext||window.webkitAudioContext)(); tmrAudio.resume&&tmrAudio.resume(); }catch(e){}
  if(WO && WO.iso===iso && WO.phase==='summary'){ WO=null; woSave(); }   // podsumowanie zostało otwarte — dokończenie startuje z zapisanej sesji
  if(!WO || WO.iso!==iso){
    const ex=woBuild(iso), L=log(iso);
    WO={iso, title:workoutOn(iso).title, start:Date.now(), ex, cur:0, phase:'work', setStart:Date.now(),
        restStart:0, restEnd:0, restPlan:0, beeped:false, log:[], skipped:0, tStart:0, tSide:1};
    // serie odhaczone wcześniej ręcznie liczą się jako zrobione
    WO.ex.forEach(x=>{ x.ok=x.sets.map((_,j)=>setOk(L.ex[x.key], j+1)); });
    WO.cur=woNext(0); if(WO.cur<0) WO.cur=0;
    woContinue(iso);
  }
  woSave(); document.getElementById('woFocus').style.display='flex';
  woWakeLock(true);
  clearInterval(woTick); woTick=setInterval(woStep,200); woRender();
}
const woCurSet=i=>WO.ex[i].ok.indexOf(false);
const woDone=()=>WO.ex.reduce((a,x)=>a+x.ok.filter(Boolean).length,0), woTotal=()=>WO.ex.reduce((a,x)=>a+x.s,0);
function woNext(from){ for(let k=0;k<WO.ex.length;k++){ const i=(from+k)%WO.ex.length; if(woCurSet(i)>=0) return i; } return -1; }
function woWakeLock(on){
  if(on && !woWake && navigator.wakeLock) navigator.wakeLock.request('screen').then(w=>{ woWake=w; w.addEventListener('release',()=>{ woWake=null; }); }).catch(()=>{});
  if(!on && woWake){ woWake.release().catch(()=>{}); woWake=null; }
}
document.addEventListener('visibilitychange',()=>{ if(!document.hidden && WO && WO.phase!=='summary') woWakeLock(true); });
// seria zrobiona: odhacz w dzienniku z wartościami z ekranu, potem przerwa
function woSetDone(){
  const i=WO.cur, x=WO.ex[i], k=woCurSet(i); if(k<0) return;
  const t=Date.now(), v=x.sets[k], L=log(WO.iso), r=exRec(L, x.key, x.s);
  const prs=woPrCheck(x, v.kg||0, v.r);   // przed odhaczeniem: porównanie z wcześniejszymi seriami
  exTick(L, x.key, x.s, k+1, true, v.r);
  if(v.kg!==null) r.sets['w'+(k+1)]=String(v.kg);
  touch(L); save();
  x.ok[k]=true;
  // przejście z innego ćwiczenia nie jest przerwą między seriami — osobno, żeby nie psuło średniej przerw
  const rb=WO.lastRest!=null?Math.round(WO.lastRest):null;
  WO.log.push({ex:x.n, set:k+1, work:Math.round((t-WO.setStart)/1000), restBefore:WO.lastTrans?null:rb, trans:WO.lastTrans&&rb!=null?Math.max(0,rb):null, restPlan:WO.lastTrans?null:(WO.lastRestPlan||null)});
  WO.lastRest=null; WO.lastTrans=false; tmrBuzz(30);
  if(prs.length){ (x.prSet=x.prSet||[])[k]=true; prs.forEach(p=>woPrAdd(x, p)); }
  // ostatnia seria ćwiczenia: rekord objętości (tylko gdy wszystkie serie zrobione, bez pomijania)
  let vol=null;
  if(woCurSet(i)<0 && !x.skipped){
    const h=exIndex()[x.n.trim()], an=h?prAnalyze(h):[], last=an[an.length-1];
    if(last && last.iso===WO.iso && last.prs.includes('vol')){
      const prev=Math.max(0,...an.slice(0,-1).filter(q=>q.full).map(q=>q.m.vol)), u=h.kind==='kg'?'kg':prUnit(h.kind);
      vol={t:'vol', now:prNum(last.m.vol)+' '+u, was:prNum(prev)+' '+u, kind:h.kind}; woPrAdd(x, vol);
    }
  }
  if(woDone()===woTotal()) woFinish();
  else {
    if(woCurSet(i)<0) WO.cur=woNext(i);
    WO.trans=WO.cur!==i;
    WO.plusCount=0;
    WO.phase='rest'; WO.phaseAt=t; WO.restPlan=x.rest; WO.restStart=t; WO.restEnd=t+x.rest*1000; WO.beeped=false; WO.tStart=0; WO.tSide=1;
    woSave(); woRender();
  }
  if(prs.length) woPrShow(x, v, prs);
  if(vol) setTimeout(()=>woPrToast('🏆 Rekord objętości: '+vol.now+' ('+x.n+')'), prs.length?2600:0);
}
function woStartSet(){ const t=Date.now(); WO.lastRest=(t-WO.restStart)/1000; WO.lastRestPlan=WO.restPlan; WO.lastTrans=!!WO.trans; WO.trans=false; WO.phase='work'; WO.phaseAt=t; WO.setStart=t; woSave(); woRender(); }

/* rekordy w trakcie treningu */
function woKind(x, kg){ const h=exIndex()[x.n.trim()]; return x.timed?'time':(kg>0||(h&&h.kind==='kg'))?'kg':'reps'; }
function woPrCheck(x, kg, r){
  const h=exIndex()[x.n.trim()]; if(!h || !(r>0)) return [];
  const before=h.sess.filter(q=>q.iso<WO.iso); if(!before.length) return [];   // pierwszy trening = punkt startowy
  const td=h.sess.find(q=>q.iso===WO.iso), prior=before.flatMap(q=>q.sets).concat(td?td.sets:[]);
  const mx=a=>a.length?Math.max(...a):0, kind=woKind(x,kg), out=[];
  if(kind!=='kg'){ const p=mx(prior.map(y=>y.r)); if(r>p) out.push({t:'top', now:r+' '+prUnit(kind), was:p+' '+prUnit(kind), kind}); return out; }
  if(!(kg>0)) return out;
  const pTop=mx(prior.map(y=>y.kg)), pE1=mx(prior.map(y=>e1rm(y.kg,y.r))), e=e1rm(kg,r);
  if(kg>pTop) out.push({t:'top', now:prFmt(kg)+' kg', was:prFmt(pTop)+' kg', kind});
  if(pE1>0 && e>pE1+0.01) out.push({t:'e1', now:'≈ '+prE1(e)+' kg', was:'≈ '+prE1(pE1)+' kg', kind});
  if(kg<=pTop){ const p=mx(prior.filter(y=>y.kg>=kg).map(y=>y.r)); if(r>p) out.push({t:'reps', now:r+' powt. przy '+prFmt(kg)+' kg', was:p+' powt.', kind}); }
  return out;
}
// ten sam rodzaj rekordu w jednym ćwiczeniu: zostaje pierwsze „poprzednio” i ostatnie „teraz”
function woPrAdd(x, p){
  WO.prs=WO.prs||[];
  const o=WO.prs.find(q=>q.n===x.n && q.t===p.t);
  if(o) o.now=p.now; else WO.prs.push({n:x.n, t:p.t, now:p.now, was:p.was, kind:p.kind});
}
function woRefHtml(x, v){
  const h=exIndex()[x.n.trim()]; if(!h) return '';
  const before=h.sess.filter(q=>q.iso<WO.iso); if(!before.length) return '';
  const last=before[before.length-1], an=prAnalyze(h).filter(q=>q.iso<=WO.iso), b=prBest(h.kind,an);
  const will=x.timed&&WO.tStart?[]:woPrCheck(x, v.kg||0, v.r);
  return `<div class="wo-ref"><div>Ostatnio (${prDD(last.iso)}): <b>${prSetsText(h.kind,last.sets)}</b></div>
    <div class="g">🏆 Rekord: <b>${prTopText(h.kind,b.top)}</b>${h.kind==='kg'&&b.e1.m.e1?' · 1RM ≈ '+prE1(b.e1.m.e1)+' kg':''}</div></div>
    ${will.length?`<div class="wo-willpr">🏆 To będzie rekord: ${will.map(p=>prName(p.kind,p.t)).join(' + ')}</div>`:''}`;
}
function woPrShow(x, v, prs){
  try{ navigator.vibrate && navigator.vibrate([60,40,140]); }catch(e){}
  tmrBeep(988,.18); setTimeout(()=>tmrBeep(1319,.3),150);
  if(x.prPopped){ woPrToast('🏆 Kolejny rekord: '+prs.map(p=>prName(p.kind,p.t)+' '+p.now).join(', ')); return; }
  x.prPopped=true; woSave();
  document.getElementById('prSub').textContent=x.n+' · '+(v.kg?prFmt(v.kg)+' kg × ':'')+v.r+(x.timed?' s':'');
  document.getElementById('prLines').innerHTML=prs.map(p=>`<div class="ln"><span>${prName(p.kind,p.t)}</span><div><b>${esc(p.now)}</b><em>poprzednio ${esc(p.was)}</em></div></div>`).join('');
  document.getElementById('prOk').textContent=WO.phase==='rest'?'DALEJ · PRZERWA':'DALEJ';
  document.getElementById('prPop').style.display='flex';
}
var prToastT=null;
function woPrToast(msg){
  const t=document.getElementById('prToast'); t.textContent=msg; t.style.display='block';
  clearTimeout(prToastT); prToastT=setTimeout(()=>{ t.style.display='none'; }, 3800);
}
document.getElementById('prOk').onclick=()=>{ document.getElementById('prPop').style.display='none'; };
document.getElementById('prPop').onclick=e=>{ if(e.target.id==='prPop') e.target.style.display='none'; };

/* wstrzymanie: stoją wszystkie zegary — trening, przerwa, seria i odliczanie ćwiczenia na czas */
function woActive(t){ return t-WO.start-(WO.pausedTotal||0); }
function woPause(){
  if(!WO || WO.pausedAt || WO.phase==='summary') return;
  if(WO.phase==='confirm') WO.phase=WO.prevPhase||'work';
  WO.pausedAt=Date.now(); woSave(); woRender(); woStep();
}
function woUnpause(){
  if(!WO || !WO.pausedAt) return;
  const d=Date.now()-WO.pausedAt;
  WO.pausedTotal=(WO.pausedTotal||0)+d; WO.pauses=(WO.pauses||0)+1;
  ['setStart','restStart','restEnd','tStart'].forEach(k=>{ if(WO[k]) WO[k]+=d; });
  WO.pausedAt=0; WO.phaseAt=Date.now(); woSave(); woRender(); woStep();
}
function woStep(){
  if(!WO) return;
  const now=Date.now();
  if(WO.pausedAt){
    if(WO.phase!=='summary') document.getElementById('woTotal').textContent=fmtDur(woActive(WO.pausedAt)/1000);
    const p=document.getElementById('woPaused'); if(p) p.textContent=fmtDur((now-WO.pausedAt)/1000);
    const lg=document.getElementById('woPauseLong'); if(lg) lg.style.display=now-WO.pausedAt>30*60e3?'block':'none';
    return;
  }
  if(WO.phase!=='summary') document.getElementById('woTotal').textContent=fmtDur(woActive(now)/1000);
  if(WO.phase==='rest'){
    const left=(WO.restEnd-now)/1000, el=document.getElementById('woLeft'); if(!el) return;
    const over=left<0, box=document.getElementById('woRestBox'), C=2*Math.PI*90;
    el.textContent=(over?'+':'')+fmtDur(Math.abs(over?Math.floor(left):Math.ceil(left)));
    box.classList.toggle('over', over && !WO.trans); box.classList.toggle('ready', over && !!WO.trans);
    document.getElementById('woRLab').textContent=WO.trans?(over?'Przejście · zaczynaj, kiedy będziesz gotowy':'Przejście do kolejnego ćwiczenia'):over?'Przerwa za długa — zaczynaj!':'Przerwa';
    document.getElementById('woFg').style.strokeDashoffset = over ? 0 : C*(1-left/WO.restPlan);
    if(left<=3 && left>0 && Math.ceil(left)!==WO.lastSec){ WO.lastSec=Math.ceil(left); tmrBeep(660,.12); }
    // koniec przerwy: sygnał, po chwili ekran sam przechodzi do serii — ale nie przy zmianie ćwiczenia
    // (np. czekasz na maszynę); tam seria startuje dopiero po „ZACZYNAM”
    if(over && !WO.beeped){ WO.beeped=true; tmrBeep(880,.35); setTimeout(()=>tmrBeep(1175,.5),180); tmrBuzz([200,100,200]);
      if(!WO.trans) setTimeout(()=>{ if(WO&&WO.phase==='rest'&&!WO.pausedAt&&!WO.trans) woStartSet(); }, 1500); }
  } else if(WO.phase==='work'){
    const w=document.getElementById('woWork'); if(w) w.textContent=fmtDur((now-WO.setStart)/1000);
    // ćwiczenie na czas: odliczanie (albo stoper przy „max czas”)
    const x=WO.ex[WO.cur];
    if(x && x.timed && WO.tStart){
      const el=document.getElementById('woTimed'); const gone=(now-WO.tStart)/1000;
      if(x.up){ if(el) el.textContent=fmtDur(gone); }
      else {
        const left=x.sets[woCurSet(WO.cur)].r-gone;
        if(el) el.textContent=fmtDur(Math.max(0,Math.ceil(left)));
        if(left<=3 && left>0 && Math.ceil(left)!==WO.lastSec){ WO.lastSec=Math.ceil(left); tmrBeep(660,.12); }
        if(left<=0){ tmrBeep(880,.35); setTimeout(()=>tmrBeep(1175,.5),180); tmrBuzz([200,100,200]);
          if(x.sides>1 && WO.tSide===1){ WO.tSide=2; WO.tStart=0; woRender(); } else { WO.tStart=0; woSetDone(); } }
      }
    }
  }
}
function woRender(){
  const b=document.getElementById('woBody');
  document.getElementById('woPBar').style.width=(woDone()/woTotal()*100)+'%';
  document.getElementById('woPTxt').textContent=`${woDone()} z ${woTotal()} serii · ${WO.title}${navigator.onLine?'':' · offline'}`;
  const eb=document.getElementById('woEnd');
  eb.textContent=WO.phase==='summary'?'Zamknij':WO.pausedAt?'▶ Wznów':'⏸ Wstrzymaj'; eb.classList.toggle('paused', !!WO.pausedAt);
  if(WO.phase==='summary'){ b.innerHTML=woSummaryHtml(); document.getElementById('woSave').onclick=woClose; return; }
  if(WO.pausedAt && WO.phase!=='confirm'){
    b.innerHTML=`<div class="wo-pause"><span class="lab">Trening wstrzymany</span><b id="woPaused">0:00</b>
      <small>Stoją wszystkie zegary: czas treningu, przerwa i seria. Wznów, kiedy będziesz gotowy.</small>
      <div class="wo-note" id="woPauseLong" style="display:none"><b>Wstrzymane od ponad 30 min.</b> Jeśli to już koniec, zakończ trening — zapiszemy czas bez pauzy.</div>
      <button class="wo-save" id="woUnpause">▶ WZNÓW</button>
      <button class="wo-endnow" id="woEndNow">Zakończ trening</button></div>`;
    document.getElementById('woUnpause').onclick=woUnpause;
    document.getElementById('woEndNow').onclick=()=>{ WO.prevPhase=WO.phase; WO.phase='confirm'; woRender(); };
    woStep(); return;
  }
  if(WO.phase==='confirm'){
    b.innerHTML=`<div class="wo-sum"><h2>Zakończyć trening?</h2></div><p class="wo-next">Zrobione ${woDone()} z ${woTotal()} serii. Niezrobione serie zostaną nieodhaczone.</p>
      <div class="wo-confirm"><button id="woBack">Wróć do treningu</button><button class="yes" id="woYes">Zakończ</button></div>`;
    document.getElementById('woBack').onclick=()=>{ WO.phase=WO.prevPhase||'work'; woRender(); };
    document.getElementById('woYes').onclick=woFinish; return;
  }
  const i=WO.cur, x=WO.ex[i], k=woCurSet(i)<0?x.s-1:woCurSet(i), v=x.sets[k];
  let h=`${woLightBanner()}<div class="wo-name"><span class="t">${esc(x.n)}</span><div class="nv"><button id="woPrev" aria-label="Poprzednie ćwiczenie" ${i===0?'disabled':''}>‹</button><button id="woNx" aria-label="Następne ćwiczenie" ${i===WO.ex.length-1?'disabled':''}>›</button></div></div>
    <div class="wo-setno"><span style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">Seria <b>${k+1}</b> z ${x.s} <button class="wo-restchip" id="woRestEdit">⏱ przerwa ${fmtDur(x.rest)}${restTag(x.n)}<i>zmień</i></button></span><span style="display:flex;gap:6px">${exIndex()[x.n.trim()]?`<button class="wo-hist" id="woHist" aria-label="Historia ćwiczenia">${IC_HIST}</button>`:''}${woCurSet(i)>=0 && swapAlts(x.n).length?'<button class="wo-show sw" id="woSwap">⇄ Zamień</button>':''}<button class="wo-show" id="woShow">Pokaż technikę</button></span></div>${woSwapLine(i)}
    <div class="wo-dots">${x.ok.map((d,j)=>`<i class="${d?((x.prSet||[])[j]?'pr':'ok'):j===k?'cur':''}"></i>`).join('')}</div>`;
  if(WO.phase==='rest'){
    const nx=WO.ex[WO.cur], nk=woCurSet(WO.cur), nv=nx.sets[nk], C=2*Math.PI*90;
    h+=`<div class="wo-rest" id="woRestBox"><span class="lab" id="woRLab">Przerwa</span>
      <div class="wo-ring"><svg viewBox="0 0 200 200"><circle class="bg" cx="100" cy="100" r="90"/><circle class="fg" id="woFg" cx="100" cy="100" r="90" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg>
        <div class="c"><b id="woLeft">${fmtDur(WO.restPlan)}</b><small>z ${fmtDur(WO.restPlan)}</small></div></div>
      <div class="wo-rbtns"><button id="woPlus">+15 s</button><button class="go" id="woGo">▶ ZACZYNAM</button></div>${woRestLearnHtml()}</div>
      <div class="wo-next">Następnie: <b>${esc(nx.n)}</b> · seria ${nk+1} · ${nv.kg?String(nv.kg).replace('.',',')+' kg × ':''}${nv.r}${nx.timed?' s':''}</div>
      ${WO.trans?'<div class="wo-hint">Maszyna zajęta? Stuknij ⏸ Wstrzymaj u góry albo wybierz inne ćwiczenie z listy niżej.</div>':''}`;
  } else {
    const unit=x.timed?'sekund':'powtórzeń';
    h+=`<div class="wo-big"><div class="wo-vals">
      ${v.kg!==null?`<div class="wo-val"><span class="n">${String(v.kg).replace('.',',')}</span><span class="u">kg</span><div class="pm"><button data-wd="kg:-1" aria-label="Mniej kg">−</button><button data-wd="kg:1" aria-label="Więcej kg">+</button></div></div><span class="x">×</span>`:''}
      <div class="wo-val"><span class="n">${x.timed&&WO.tStart?`<span id="woTimed">${fmtDur(x.up?0:v.r)}</span>`:v.r}</span><span class="u">${x.timed&&x.sides>1?(WO.tSide===1?'s · lewa strona':'s · prawa strona'):unit}</span>${x.timed&&WO.tStart?'':`<div class="pm"><button data-wd="r:-1" aria-label="Mniej">−</button><button data-wd="r:1" aria-label="Więcej">+</button></div>`}</div>
    </div><span class="wo-work">Seria trwa <b id="woWork">0:00</b></span></div>${woRefHtml(x, v)}`;
    if(x.timed && !WO.tStart) h+=`<button class="wo-done timer" id="woTimer"><svg viewBox="0 0 24 24" style="fill:#0e1114;stroke:none"><path d="M7 4.5v15l13-7.5z"/></svg>${x.up?'START STOPERA':'START ODLICZANIA'}</button>`;
    else if(x.timed && x.up) h+=`<button class="wo-done" id="woStopUp"><svg viewBox="0 0 24 24"><path d="M4 12l5 5L20 6"/></svg>KONIEC SERII</button>`;
    else if(!x.timed) h+=`<button class="wo-done" id="woDone"><svg viewBox="0 0 24 24"><path d="M4 12l5 5L20 6"/></svg>SERIA ZROBIONA</button>`;
    h+=`<button class="wo-cam" id="woCam">📹 Sprawdź technikę tej serii</button>`;
    h+=`<button class="wo-skip" id="woSkip">Pomiń tę serię</button>`;
  }
  h+=`<div class="wo-list"><h4>Ćwiczenia</h4>`+WO.ex.map((y,j)=>{ const d=y.ok.filter(Boolean).length; return `<button class="${d===y.s?'ok':''} ${j===i?'cur':''}" data-wgo="${j}"><span>${esc(y.n)}</span><span>${d}/${y.s}</span></button>`; }).join('')+`</div>`;
  b.innerHTML=h;
  const on=(id,f)=>{ const el=document.getElementById(id); if(el) el.onclick=f; };
  // po zmianie ekranu (seria ↔ przerwa) przez 0,6 s ignoruj przyciski zmieniające etap — podwójne stuknięcie nie pominie przerwy
  const g=f=>()=>{ if(Date.now()-(WO.phaseAt||0)<600) return; f(); };
  on('woDone', g(woSetDone)); on('woGo', g(woStartSet));
  on('woTimer', g(()=>{ WO.tStart=Date.now(); WO.lastSec=null; woRender(); }));
  on('woStopUp', g(()=>{ const k2=woCurSet(WO.cur); WO.ex[WO.cur].sets[k2].r=Math.round((Date.now()-WO.tStart)/1000); WO.tStart=0; woSetDone(); }));
  on('woShow', ()=>openGuide(x.n));
  on('woHist', ()=>openExHist(x.n.trim()));
  on('woSwap', ()=>openSwap(WO.iso, WO.cur));
  on('woSwapUndo', ()=>swapUndo(WO.cur, WO.iso));   // opis techniki nad ekranem treningu
  on('woCam', ()=>openFormCheck(x.n, (v.kg?String(v.kg).replace('.',',')+' kg × ':'')+v.r+(x.timed?' s':' powt.')));
  on('woPlus', ()=>{ WO.restEnd+=15000; WO.restPlan+=15; WO.beeped=false; WO.plusCount=(WO.plusCount||0)+1; woSave(); if(WO.plusCount===2) woRender(); woStep(); });
  on('woRestEdit', ()=>openRestEdit(x.n, x.timed));
  on('woLightOff', ()=>{ const L=log(WO.iso); L.checkin=Object.assign({}, L.checkin, {plan:'normal', at:Date.now()}); touch(L); save(); woRefreshFromCard(); });
  on('woLearnNo', ()=>{ WO.ex[WO.cur].learnNo=true; woSave(); woRender(); woStep(); });
  { const ly=document.getElementById('woLearnYes'); if(ly) ly.onclick=()=>{ restSet(WO.ex[WO.cur].n, +ly.dataset.sec, 'me'); restToast('Przerwa '+fmtDur(+ly.dataset.sec)+' zapamiętana przy tym ćwiczeniu'); }; }
  on('woSkip', g(()=>{ const k2=woCurSet(WO.cur); WO.ex[WO.cur].ok[k2]=true; WO.ex[WO.cur].skipped=(WO.ex[WO.cur].skipped||0)+1; WO.skipped++; WO.tStart=0;
    if(woDone()===woTotal()) return woFinish(); if(woCurSet(WO.cur)<0) WO.cur=woNext(WO.cur); WO.setStart=Date.now(); woSave(); woRender(); }));
  on('woPrev', ()=>{ if(WO.cur>0){ WO.cur--; WO.tStart=0; woRender(); } }); on('woNx', ()=>{ if(WO.cur<WO.ex.length-1){ WO.cur++; WO.tStart=0; woRender(); } });
  b.querySelectorAll('[data-wgo]').forEach(y=>y.onclick=()=>{ WO.cur=+y.dataset.wgo; WO.tStart=0; woRender(); });
  b.querySelectorAll('[data-wd]').forEach(y=>y.onclick=()=>{
    const [f,d]=y.dataset.wd.split(':'), cx=WO.ex[WO.cur], k2=woCurSet(WO.cur); if(k2<0) return;
    const sv=cx.sets[k2], st= f==='kg' ? cx.step : (cx.timed?5:1);
    sv[f]=Math.max(0, Math.round((sv[f]+(+d)*st)*10)/10);
    // zmiana ciężaru przechodzi na kolejne niezrobione serie tego ćwiczenia
    if(f==='kg') cx.sets.forEach((q,j)=>{ if(j>k2 && !cx.ok[j]) q.kg=sv.kg; });
    woSave(); woRender();
  });
}
function woFinish(){
  if(WO.pausedAt){ WO.pausedTotal=(WO.pausedTotal||0)+(Date.now()-WO.pausedAt); WO.pausedAt=0; }
  const t=Date.now();
  // dur = aktywny czas (bez pauz); pauzy i przejścia osobno. log — żeby „Dokończ trening” dołączył kolejne serie, a nie nadpisał
  const sess=Object.assign({start:WO.start, end:t, last:t, dur:Math.max(0,Math.round(woActive(t)/1000)),
    paused:Math.round((WO.pausedTotal||0)/1000), pauses:WO.pauses||0, gap:WO.gap||0, parts:WO.parts||1, prs:WO.prs||[],
    total:woTotal(), skipped:WO.skipped, title:WO.title, forms:WO.forms||[], log:WO.log},
    woAgg(WO.log, WO.ex.map(x=>({n:x.n, s:x.s, rest:x.rest}))));
  const L=log(WO.iso); L.session=sess; touch(L); save();
  WO.phase='summary'; WO.sess=sess; clearInterval(woTick); woTick=null; woSave();
  document.getElementById('woTotal').textContent=fmtDur(sess.dur);
  tmrBeep(988,.25); setTimeout(()=>tmrBeep(1319,.45),200);
  woRender();
}
function woSummaryHtml(){
  const s=WO.sess, slowAvg=s.avgRestPlan && s.avgRest>s.avgRestPlan*1.2, idx=exIndex();
  // porównanie z poprzednim razem każdego ćwiczenia
  let vNow=0, vPrev=0;
  const cmp=s.ex.map(e=>{ const h=idx[e.n.trim()]; if(!h) return '';
    const cur=h.sess.find(q=>q.iso===WO.iso), prev=h.sess.filter(q=>q.iso<WO.iso).pop(); if(!cur||!prev) return '';
    if(h.kind==='kg' && cur.full){ vNow+=prMetrics('kg',cur).vol; vPrev+=prMetrics('kg',prev).vol; }   // tylko ćwiczenia zrobione w całości
    return `<div><span>${esc(e.n)}<br><small style="color:var(--ink-faint)">${prDD(prev.iso)}: ${prSetsText(h.kind,prev.sets)}</small></span><span>${prSetsText(h.kind,cur.sets)}</span></div>`; }).join('');
  const dv=vPrev?Math.round((vNow/vPrev-1)*100):null;
  return `<div class="wo-sum"><h2>Trening zakończony 💪</h2></div>
    <div class="wo-tiles">
      <div class="wo-tile"><b>${fmtDur(s.dur)}</b><small>CAŁY TRENING${s.paused-(s.gap||0)>0?' · PAUZY '+fmtDur(s.paused-(s.gap||0)):''}</small></div>
      <div class="wo-tile"><b>${s.done}/${s.total}</b><small>SERIE ZROBIONE</small></div>
      <div class="wo-tile"><b>${fmtDur(s.work)}</b><small>PRACA (SERIE)</small></div>
      <div class="wo-tile ${slowAvg?'warn':''}"><b>${fmtDur(s.avgRest)}</b><small>ŚREDNIA PRZERWA${s.avgRestPlan?' · PLAN '+fmtDur(s.avgRestPlan):''}</small></div>
    </div>
    ${s.parts>1?`<div class="wo-note"><b>Trening dokończony po przerwie ${fmtDur(s.gap)}.</b> Ta przerwa nie wlicza się do czasu treningu.${s.rebuilt?' Czasy pierwszej części odtworzone z godzin odhaczenia serii (przybliżone).':''}</div>`:''}
    ${(s.prs||[]).length?`<div class="wo-prs"><h4>🏆 Rekordy dziś · ${s.prs.length}</h4>${s.prs.map(p=>`<div><b>${esc(p.n)}</b><span>${prName(p.kind,p.t)}: ${esc(p.now)} <small>(poprzednio ${esc(p.was)})</small></span></div>`).join('')}</div>`:''}
    ${cmp?`<div class="wo-list"><h4>W porównaniu z poprzednim razem${dv!=null?' · objętość '+(dv>=0?'+':'')+dv+'%':''}</h4></div><div class="wo-rows">${cmp}</div>`:''}
    <div class="wo-rows">${s.ex.map(e=>`<div><span>${esc(e.n)} · ${e.sets}/${e.of}</span><span class="${e.avgRest>e.restPlan*1.2?'slow':''}">${e.avgRest?'przerwa '+fmtDur(e.avgRest)+' / plan '+fmtDur(e.restPlan):'—'}</span></div>`).join('')}</div>
    <div class="wo-note"><b>Trener widzi te dane.</b> Zapytaj np.: „Jak mi poszedł dzisiejszy trening?” albo „Czy moje przerwy są OK?”.</div>
    <button class="wo-save" id="woSave">ZAPISZ I ZAMKNIJ</button>`;
}
// „Zacznij dziś”: ten trening zamienia się z dzisiejszym dniem (jak „Przesuń”), potem tryb treningu
function startToday(iso){
  const t=todayISO();
  setMoves(nextMoves({[t]:iso, [iso]:t}), `${iso<t?'Odrabiasz':'Zamieniono'}: ${dowOf(iso)} ${dmy(iso)} → dziś`);
  viewOffset=0; showView('train'); renderToday();
  woStart(t);
}
/* ---- reset dzisiejszego treningu: odhaczone serie, „Pomiń”, zmierzony czas i trwający tryb treningu ----
   Ciężary i powtórzenia w polach zostają. Sesja dostaje znacznik {cleared, end}, żeby starszy zapis z innego urządzenia nie wrócił. */
const hasSession=L=>!!(L && L.session && !L.session.cleared);
function woCanReset(iso, w, L){
  return hasSession(L) || (WO && WO.iso===iso) || w.ex.some((e0,i)=>{ const r=L.ex[iso+'_e'+i]; return exAny(r) || (r&&r.skip); });
}
function woResetAsk(iso){
  const w=workoutOn(iso), L=log(iso);
  const n=w.ex.reduce((a,e0,i)=>a+okCount(L.ex[iso+'_e'+i], effEx(e0,iso).s),0);
  const bits=[]; if(n) bits.push(n+' odhaczon'+(n===1?'ą serię':(n%10>=2&&n%10<=4&&(n%100<12||n%100>14))?'e serie':'ych serii'));
  if(hasSession(L)) bits.push('zmierzony czas ('+fmtDur(L.session.dur)+')');
  if(WO && WO.iso===iso) bits.push('trwający tryb treningu');
  document.getElementById('wrText').textContent=(bits.length?'Usunę '+bits.join(', ')+'. ':'')+'Ciężary i powtórzenia wpisane w pola zostają.';
  document.getElementById('woResetDialog').style.display='flex';
  document.getElementById('wrYes').onclick=()=>{ document.getElementById('woResetDialog').style.display='none'; woReset(iso); };
}
document.getElementById('wrNo').onclick=()=>{ document.getElementById('woResetDialog').style.display='none'; };
document.getElementById('woResetDialog').addEventListener('click',e=>{ if(e.target.id==='woResetDialog') e.currentTarget.style.display='none'; });
let woUndoSnap=null, woToastTimer=null;
function woReset(iso){
  const w=workoutOn(iso), L=log(iso), keys=w.ex.map((e0,i)=>iso+'_e'+i);
  woUndoSnap={iso, ex:JSON.parse(JSON.stringify(keys.map(k=>[k,L.ex[k]]))), session:L.session?JSON.parse(JSON.stringify(L.session)):null, wo:WO&&WO.iso===iso?JSON.parse(JSON.stringify(WO)):null};
  w.ex.forEach((e0,i)=>{ const k=keys[i], n=effEx(e0,iso).s, r=L.ex[k]; if(!r) return;
    for(let s=1;s<=n;s++) if(setOk(r,s)) exTick(L,k,n,s,false);
    if(L.ex[k].skip){ L.ex[k].skip=false; mark(L,'skip:'+k); } });
  if(L.session) L.session={cleared:true, end:Date.now()};
  if(WO && WO.iso===iso){ clearInterval(woTick); woTick=null; WO=null; woSave(); woWakeLock(false); document.getElementById('woFocus').style.display='none'; }
  touch(L); save(); renderToday();
  const t=document.getElementById('woToast'); document.getElementById('woToastTxt').textContent='Trening zresetowany'; t.style.display='flex';
  clearTimeout(woToastTimer); woToastTimer=setTimeout(()=>{ t.style.display='none'; woUndoSnap=null; }, 6000);
}
// „Cofnij”: przywróć serie i pomiar; nowe znaczniki czasu, żeby wygrały przy synchronizacji
document.getElementById('woUndo').onclick=()=>{
  const u=woUndoSnap; if(!u) return; woUndoSnap=null;
  const L=log(u.iso);
  u.ex.forEach(([k,r])=>{ if(r===undefined) return; L.ex[k]=r; mark(L,'ex:'+k); mark(L,'skip:'+k); if(r&&r.ok) Object.keys(r.ok).forEach(s=>mark(L,'ok:'+k+':'+s)); });
  if(u.session){ L.session=Object.assign({}, u.session, {end:Date.now()}); }
  if(u.wo){ WO=u.wo; woSave(); }
  touch(L); save(); renderToday();
  document.getElementById('woToast').style.display='none';
};
function woClose(){ WO=null; woSave(); clearInterval(woTick); woTick=null; woWakeLock(false); document.getElementById('woFocus').style.display='none'; renderToday(); }
// w pasku: Wstrzymaj / Wznów (zakończenie jest na ekranie pauzy); po treningu — Zamknij
document.getElementById('woEnd').onclick=()=>{ if(!WO) return; if(WO.phase==='summary'){ woClose(); return; } if(WO.pausedAt) woUnpause(); else woPause(); };
// trwający trening po ponownym otwarciu aplikacji (do 5 h, ten sam dzień)
function woResume(){
  try{ const w=JSON.parse(localStorage.getItem(WO_LS)||'null');
    if(w && w.iso===todayISO() && Date.now()-w.start<5*3600e3){ WO=w; if(WO.phase==='summary'){ document.getElementById('woFocus').style.display='flex'; woRender(); } else woStart(w.iso); }
    else if(w) localStorage.removeItem(WO_LS);
  }catch(e){}
}

document.getElementById('syncWarn').onclick=()=>{ showView('set'); moreOpen('sync'); setTimeout(()=>document.getElementById('cloudState').scrollIntoView({block:'center'}),200); };

/* ============================================================
   ANALIZA TECHNIKI Z NAGRANIA (beta)
   1) film z kamery telefonu albo z galerii — zostaje na telefonie
   2) wycięcie klatek (canvas), 3) rozpoznanie sylwetki MediaPipe Pose (ładowane przy pierwszym użyciu),
   4) pomiary: powtórzenia, kąty, głębokość, pochylenie, tempo, 5) do Trenera: pomiary + do 10 klatek ze szkieletem,
   6) wynik w oknie, w rozmowie z Trenerem (synchronizowanej) i w sesji treningu.
   ============================================================ */
const FC={ex:'', set:'', busy:false};
const POSE_VER='0.10.14';
const POSE_MODEL='https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
let posePromise=null;
// ustawienie kamery: ćwiczenia z ruchem biodra/kolana najlepiej z boku, wznosy i łydki z przodu
function camView(name){ return /wznos|unoszenie.*bok|łydk|wspięcia|biceps|triceps|uginanie ramion/i.test(name) ? 'z przodu' : 'z boku'; }
function fcShow(html){ document.getElementById('fcBody').innerHTML=html; document.getElementById('formDialog').style.display='flex'; }
function fcClose(){ if(FC.busy) return; document.getElementById('formDialog').style.display='none'; }
// historia ocen techniki danego ćwiczenia (z rozmowy z Trenerem — synchronizowana)
function formHistory(name){ return loadCoach().filter(m=>m.kind==='form' && m.ex===name).reverse(); }
// opts.lib: wejście z biblioteki ćwiczeń — dodatkowo opis techniki, link do filmów i historia ocen
function openFormCheck(name, setInfo, opts){
  FC.ex=name; FC.set=setInfo||'';
  const lib=!!(opts&&opts.lib);
  const cue=GUIDE[name]||GUIDE[name.trim()]||swapCue(name)||'';
  const yt='https://www.youtube.com/results?search_query='+encodeURIComponent(name+' technika');
  const head=lib ? `${cue?`<div class="fc-cue">${esc(cue)}</div>`:''}<a class="fc-yt" href="${yt}" target="_blank" rel="noopener">▶ Filmy z techniką (YouTube)</a>` : '';
  const hist=formHistory(name);
  const histHtml= lib && hist.length ? `<div class="fc-sec"><h4>Twoje oceny (${hist.length})</h4><div class="fc-hist">`+hist.slice(0,8).map(m=>`<button data-fh="${esc(m.id)}"><span>${new Date(m.t).toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit'})}</span><b class="g${FC_GRADE[m.grade]??3}">${esc(m.grade||'')}</b><span class="fx">${esc((m.fix||'').slice(0,60))}</span><span class="go">›</span></button>`).join('')+`</div></div>` : '';
  if(!(CLOUD.on && CLOUD.url && CLOUD.token)){
    fcShow(`${lib?`<p class="fc-sub"><b>${esc(name)}</b></p>`+head:''}<p class="fc-sub">Ocena techniki z nagrania korzysta z Trenera, więc potrzebuje włączonej synchronizacji (Więcej → Synchronizacja).</p><div class="fc-btns"><button class="fc-btn ghost" data-fc-close>Zamknij</button></div>`);
    document.querySelector('[data-fc-close]').onclick=fcClose; return;
  }
  if(!featOn('form')){
    fcShow(`${lib?`<p class="fc-sub"><b>${esc(name)}</b></p>`+head:''}<p class="fc-sub">Ocena techniki z nagrania jest teraz niedostępna${planEnforced()?' w Twoim planie':''}. Wskazówki i filmy z techniką działają dalej.</p><div class="fc-btns"><button class="fc-btn ghost" data-fc-close>Zamknij</button></div>`);
    document.querySelector('[data-fc-close]').onclick=fcClose; return;
  }
  if(quotaLeft('form')===0){   // plan z limitami: nie każ nagrywać, gdy limit ocen wykorzystany
    fcShow(`${lib?`<p class="fc-sub"><b>${esc(name)}</b></p>`+head:''}<p class="fc-sub">Limit ${quotaCur().form.max} ocen techniki w tym miesiącu wykorzystany. Nowe od ${quotaReset()}. Wskazówki i filmy z techniką działają dalej.</p><div class="fc-btns"><button class="fc-btn ghost" data-fc-close>Zamknij</button></div>`);
    document.querySelector('[data-fc-close]').onclick=fcClose; return;
  }
  const view=camView(name);
  fcShow(`<p class="fc-sub"><b>${esc(name)}</b>${FC.set?' · '+esc(FC.set):''}</p>${head}
    <ul class="fc-tips">
      <li>Postaw telefon <b>${view}</b>, 2–3 m od siebie, na wysokości bioder (np. oparty o ławkę).</li>
      <li>Całe ciało i sztanga/hantle w kadrze przez całą serię; dobre światło.</li>
      <li>Nagraj całą serię (5–40 s). Film zostaje na telefonie — do Trenera trafi kilka klatek i pomiary.</li>
      ${quotaCur()?`<li>Ocena zużywa 1 z ${quotaCur().form.max} ocen w tym miesiącu — zostało <b>${quotaLeft('form')}</b>.</li>`:''}
    </ul>
    <div class="fc-btns">
      <button class="fc-btn main" id="fcRecBtn">📹 NAGRAJ SERIĘ</button>
      <button class="fc-btn" id="fcPickBtn">Wybierz film z galerii</button>
      <button class="fc-btn ghost" data-fc-close>${lib?'Zamknij':'Anuluj'}</button>
    </div>${histHtml}`);
  document.querySelectorAll('[data-fh]').forEach(b=>b.onclick=()=>fcOpenSaved(b.dataset.fh));
  document.getElementById('fcRecBtn').onclick=()=>{ const i=document.getElementById('fcRec'); i.value=''; i.click(); };
  document.getElementById('fcPickBtn').onclick=()=>{ const i=document.getElementById('fcPick'); i.value=''; i.click(); };
  document.querySelector('[data-fc-close]').onclick=fcClose;
}
['fcRec','fcPick'].forEach(id=>document.getElementById(id).addEventListener('change',e=>{ const f=e.target.files&&e.target.files[0]; if(f) fcRun(f); }));
document.getElementById('formDialog').addEventListener('click',e=>{ if(e.target.id==='formDialog') fcClose(); });

const FC_STEPS=['Wycinam klatki z nagrania','Rozpoznaję sylwetkę i mierzę ruch','Trener ocenia technikę'];
function fcProgress(cur, note){
  fcShow(`<p class="fc-sub"><b>${esc(FC.ex)}</b>${FC.set?' · '+esc(FC.set):''}</p><div class="fc-prog">`+
    FC_STEPS.map((t,i)=>`<div class="fc-step ${i<cur?'ok':i===cur?'on':''}"><i>${i<cur?'✓':i===cur?'●':'○'}</i>${t}${i===cur&&note?' — '+esc(note):''}</div>`).join('')+`</div>`);
}
const fcWait=(el,ev,ms)=>new Promise((res,rej)=>{ const t=setTimeout(()=>{ el.removeEventListener(ev,h); rej(new Error('timeout')); }, ms); const h=()=>{ clearTimeout(t); el.removeEventListener(ev,h); res(); }; el.addEventListener(ev,h); });
// klatki z filmu: n równych momentów (5–95% czasu), dłuższy bok maks. 640 px
async function fcFrames(file, n){
  const url=URL.createObjectURL(file), v=document.createElement('video');
  v.muted=true; v.playsInline=true; v.preload='auto'; v.src=url;
  try{
    await fcWait(v,'loadeddata',15000);
    let d=v.duration;
    if(!isFinite(d)||!d){ v.currentTime=1e7; await fcWait(v,'seeked',8000); d=v.currentTime; }   // część Androidów nie podaje długości od razu
    if(!(d>0.5)) throw new Error('Nagranie jest za krótkie albo nieczytelne.');
    const sc=Math.min(1, 640/Math.max(v.videoWidth,v.videoHeight)), w=Math.round(v.videoWidth*sc), h=Math.round(v.videoHeight*sc), out=[];
    for(let i=0;i<n;i++){
      const t=d*(0.05+0.9*i/(n-1)); v.currentTime=t; await fcWait(v,'seeked',8000);
      const c=document.createElement('canvas'); c.width=w; c.height=h; c.getContext('2d').drawImage(v,0,0,w,h);
      out.push({t, c});
    }
    return {frames:out, dur:d, w, h};
  } finally { URL.revokeObjectURL(url); }
}
function loadPose(){
  if(!posePromise) posePromise=(async()=>{
    const m=await import(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${POSE_VER}/vision_bundle.mjs`);
    const fs=await m.FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${POSE_VER}/wasm`);
    const opts=d=>({baseOptions:{modelAssetPath:POSE_MODEL, delegate:d}, runningMode:'IMAGE', numPoses:1});
    try{ return await m.PoseLandmarker.createFromOptions(fs, opts('GPU')); }catch(e){ return await m.PoseLandmarker.createFromOptions(fs, opts('CPU')); }
  })().catch(e=>{ posePromise=null; throw e; });
  return posePromise;
}
// kąt w stawie b (stopnie), punkty w pikselach
function fcAngle(a,b,c){ const v1=[a.x-b.x,a.y-b.y], v2=[c.x-b.x,c.y-b.y]; const cos=(v1[0]*v2[0]+v1[1]*v2[1])/(Math.hypot(...v1)*Math.hypot(...v2)||1); return Math.round(Math.acos(Math.max(-1,Math.min(1,cos)))*180/Math.PI); }
// pomiary z punktów sylwetki (MediaPipe: 11/12 barki, 13/14 łokcie, 15/16 nadgarstki, 23/24 biodra, 25/26 kolana, 27/28 kostki)
function fcMetrics(series, w, h, dur){
  const ok=series.filter(f=>f.lm);
  if(ok.length<Math.max(4, series.length*0.4)) return {sylwetka:'słabo widoczna ('+ok.length+'/'+series.length+' klatek)'};
  const vis=(lm,ids)=>ids.reduce((a,i)=>a+(lm[i].visibility||0),0);
  const left=ok.reduce((a,f)=>a+vis(f.lm,[11,13,23,25,27]),0)>=ok.reduce((a,f)=>a+vis(f.lm,[12,14,24,26,28]),0);
  const I=left?{sh:11,el:13,wr:15,hip:23,kn:25,an:27}:{sh:12,el:14,wr:16,hip:24,kn:26,an:28};
  const P=(lm,i)=>({x:lm[i].x*w, y:lm[i].y*h});
  const rows=ok.map(f=>{ const lm=f.lm, sh=P(lm,I.sh), hip=P(lm,I.hip), kn=P(lm,I.kn), an=P(lm,I.an), el=P(lm,I.el), wr=P(lm,I.wr);
    return {t:f.t, knee:fcAngle(hip,kn,an), hipA:fcAngle(sh,hip,kn), elbow:fcAngle(sh,el,wr),
      lean:Math.round(Math.abs(Math.atan2(sh.x-hip.x, hip.y-sh.y))*180/Math.PI), hipY:lm[I.hip].y, kneeY:lm[I.kn].y, wrY:lm[I.wr].y,
      shW:Math.abs(lm[11].x-lm[12].x), knW:Math.abs(lm[25].x-lm[26].x), anW:Math.abs(lm[27].x-lm[28].x)}; });
  // powtórzenia: ruch biodra, a gdy biodro prawie stoi — ruch nadgarstka (ćwiczenia na górę ciała)
  const rng=a=>Math.max(...a)-Math.min(...a);
  let key=rows.map(r=>r.hipY), what='biodro';
  if(rng(key)<0.05){ key=rows.map(r=>r.wrY); what='nadgarstek'; }
  const lo=Math.min(...key), R=rng(key); let reps=0, down=false, bottoms=[];
  if(R>=0.04) key.forEach((y,i)=>{ if(!down && y>lo+0.65*R){ down=true; reps++; bottoms.push(i); } else if(down && y<lo+0.35*R) down=false; });
  const deep=rows.reduce((a,r)=>r.knee<a.knee?r:a, rows[0]);
  const front=rows.reduce((a,r)=>a+r.shW,0)/rows.length > 0.12;   // barki szeroko w kadrze = widok z przodu
  const m={widok_wg_sylwetki: front?'z przodu':'z boku', strona: front?'—':(left?'lewa':'prawa'), klatki_z_sylwetka: ok.length+'/'+series.length,
    ruch_mierzony_na: what, powtorzenia_wykryte: reps, czas_nagrania_s: Math.round(dur),
    kolano_min_kat: deep.knee, biodro_min_kat: Math.min(...rows.map(r=>r.hipA)), lokiec_min_kat: Math.min(...rows.map(r=>r.elbow)),
    tulow_max_pochylenie_od_pionu: Math.max(...rows.map(r=>r.lean)),
    glebokosc: deep.hipY>deep.kneeY+0.01 ? 'biodro poniżej kolana' : Math.abs(deep.hipY-deep.kneeY)<=0.01 ? 'biodro na wysokości kolana' : 'biodro powyżej kolana'};
  if(reps>0) m.czas_na_powtorzenie_s=Math.round(dur/reps*10)/10;
  if(front){ const r=Math.min(...rows.filter(x=>x.anW>0.02).map(x=>x.knW/x.anW)); if(isFinite(r)) m.kolana_do_kostek_min=Math.round(r*100)/100; }
  return {m, bottoms:bottoms.map(i=>ok[i].t)};
}
const FC_BONES=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[27,31],[28,32]];
function fcDraw(c, lm){
  if(!lm) return;
  const g=c.getContext('2d'), w=c.width, h=c.height;
  g.lineWidth=Math.max(2, w/160); g.strokeStyle='#ff7a1a'; g.fillStyle='#ffffff';
  FC_BONES.forEach(([a,b])=>{ if((lm[a].visibility||0)<0.3||(lm[b].visibility||0)<0.3) return; g.beginPath(); g.moveTo(lm[a].x*w,lm[a].y*h); g.lineTo(lm[b].x*w,lm[b].y*h); g.stroke(); });
  [11,12,13,14,15,16,23,24,25,26,27,28].forEach(i=>{ if((lm[i].visibility||0)<0.3) return; g.beginPath(); g.arc(lm[i].x*w,lm[i].y*h,Math.max(3,w/110),0,7); g.fill(); });
}
async function fcRun(file){
  if(FC.busy) return;
  FC.busy=true;
  try{
    if(file.size>400*1024*1024) throw new Error('Film jest bardzo duży — nagraj samą serię (do ok. 40 s).');
    fcProgress(0);
    const {frames, dur, w, h}=await fcFrames(file, 24);
    fcProgress(1);
    let metrics={rozpoznanie_sylwetki:'niedostępne'}, bottoms=[];
    try{
      const pose=await Promise.race([loadPose(), new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),30000))]);
      frames.forEach(f=>{ const r=pose.detect(f.c); f.lm=(r&&r.landmarks&&r.landmarks[0])||null; });
      const res=fcMetrics(frames, w, h, dur); metrics=res.m||res; bottoms=res.bottoms||[];
    }catch(e){ metrics={rozpoznanie_sylwetki:'nie udało się załadować — ocena tylko z klatek'}; }
    // do Trenera: dolne położenia z każdego powtórzenia (maks. 4) + równomiernie z całej serii, razem do 10
    const pick=new Set(bottoms.slice(0,4).map(t=>frames.findIndex(f=>f.t===t)).filter(i=>i>=0));
    for(let i=0;pick.size<10 && i<frames.length;i+=Math.max(1,Math.floor(frames.length/10))) pick.add(i);
    const chosen=[...pick].sort((a,b)=>a-b).slice(0,10).map(i=>frames[i]);
    // surowe klatki + punkty sylwetki zostają na telefonie (do powiększania i rysowania wzorca)
    const rec={ex:FC.ex, raw:chosen.map(f=>f.c.toDataURL('image/jpeg',0.72)), lms:chosen.map(f=>f.lm||null), w, h};
    const flat=fcIssues(rec).flat();
    if(flat.length && metrics && typeof metrics==='object'){
      const worst={}; flat.forEach(x=>{ if(!worst[x.joint]||x.delta>worst[x.joint].delta) worst[x.joint]=x; });
      metrics.odchylenia_od_wzorca=Object.values(worst).map(x=>x.label+' ('+x.hint+')');
    }
    chosen.forEach(f=>fcDraw(f.c, f.lm));
    const jpg=chosen.map(f=>f.c.toDataURL('image/jpeg',0.72));
    fcProgress(2, 'zwykle 10–30 s');
    const j=await cloudCall('form', {exercise:FC.ex, set:FC.set, view:camView(FC.ex), metrics, frames:jpg.map(d=>d.split(',')[1])});
    if(j.quota) quotaSet(j.quota);
    FC.busy=false;
    fcSaveAndShow(j.result, metrics, rec);
  }catch(e){
    if(e.data && e.data.quota) quotaSet(e.data.quota);
    FC.busy=false;
    const msg=/Failed to fetch|NetworkError|Load failed/i.test(e.message)?'Brak połączenia — spróbuj ponownie, gdy złapiesz zasięg.':e.message==='timeout'?'Nie udało się odczytać nagrania. Spróbuj krótszego filmu albo nagraj ponownie.':e.message;
    fcShow(`<p class="fc-sub">${esc(msg)}</p><div class="fc-btns"><button class="fc-btn" id="fcRetry">Spróbuj ponownie</button><button class="fc-btn ghost" data-fc-close>Zamknij</button></div>`);
    document.getElementById('fcRetry').onclick=()=>openFormCheck(FC.ex, FC.set);
    document.querySelector('[data-fc-close]').onclick=fcClose;
  }
}
const FC_GRADE={'dobrze':0,'drobne poprawki':1,'do poprawy':2,'nie da się ocenić':3};
function fcMeasLine(m){
  if(!m || m.rozpoznanie_sylwetki || m.sylwetka) return m&&(m.rozpoznanie_sylwetki||('Sylwetka '+m.sylwetka))||'';
  const a=[]; if(m.powtorzenia_wykryte) a.push(m.powtorzenia_wykryte+' powt.');
  // tylko pola, które są (niepełne pomiary nie mogą dawać „undefined”)
  if(m.ruch_mierzony_na==='biodro' && m.glebokosc) a.push(m.glebokosc);
  if(m.tulow_max_pochylenie_od_pionu!=null) a.push('pochylenie tułowia do '+m.tulow_max_pochylenie_od_pionu+'°');
  if(m.czas_na_powtorzenie_s) a.push(String(m.czas_na_powtorzenie_s).replace('.',',')+' s/powt.');
  if(m.widok_wg_sylwetki) a.push('widok '+m.widok_wg_sylwetki);
  return a.length ? 'Pomiary: '+a.join(' · ') : '';
}
/* ---- biblioteka ćwiczeń: wszystkie ćwiczenia z 24 tygodni planu (z wymianami od Trenera), według rodzaju treningu ---- */
function exLibrary(){
  const groups=[['Całe ciało (FBW)',/^FBW/],['Góra ciała',/^UPPER/],['Dół ciała',/^LOWER/],['Dom',/^DOM/]], out=groups.map(g=>({name:g[0], ex:[]})), seen=new Set();
  for(let wk=1;wk<=24;wk++) for(let d=0;d<7;d++){
    const w=workoutFor(wk,d); if(!w||w.type!=='lift') continue;
    const gi=Math.max(0, groups.findIndex(g=>g[1].test(w.title)));
    w.ex.forEach(e=>{ if(!seen.has(e.n)){ seen.add(e.n); out[gi].ex.push(e.n); } });
  }
  // ćwiczenia wprowadzone przez Trenera (wymiany) — w grupie „Od Trenera”
  const sw=[]; Object.values((S.adj&&S.adj.ex)||{}).forEach(l=>l.forEach(y=>{ if(y.swap&&y.swap.n&&!seen.has(y.swap.n)){ seen.add(y.swap.n); sw.push(y.swap.n); } }));
  if(sw.length) out.push({name:'Od Trenera', ex:sw});
  return out.filter(g=>g.ex.length);
}
function renderExLib(){
  const box=document.getElementById('exLib'); if(!box) return;
  const q=(document.getElementById('libSearch').value||'').trim().toLowerCase();
  const groups=exLibrary().map(g=>({name:g.name, ex:g.ex.filter(n=>!q||n.toLowerCase().includes(q))})).filter(g=>g.ex.length);
  box.innerHTML= groups.length ? groups.map(g=>`<details class="lib-grp" ${q?'open':''}><summary>${esc(g.name)}<span>${g.ex.length} ćw.</span></summary>`+
    g.ex.map(n=>{ const h=formHistory(n)[0], gc=h?FC_GRADE[h.grade]:null;
      return `<button class="lib-ex" data-lib="${esc(n)}"><span class="nm">${esc(n)}</span>${h?`<span class="last g${gc}">${esc(h.grade)}</span>`:''}<span class="go">›</span></button>`; }).join('')+`</details>`).join('')
    : '<p class="lib-hint">Nic nie znaleziono.</p>';
  box.querySelectorAll('[data-lib]').forEach(b=>b.onclick=()=>openFormCheck(b.dataset.lib,'',{lib:true}));
}
document.getElementById('libSearch').addEventListener('input', renderExLib);
/* ---- wzorzec ruchu: docelowe kąty dla typu ćwiczenia (widok z boku; z przodu nie oceniamy kątów) ---- */
function formKind(n){
  if(/suwnic/i.test(n)) return 'legpress';
  if(/przysiad/i.test(n)) return 'squat';
  if(/wypad|wykrok/i.test(n)) return 'lunge';
  if(/martwy|RDL|swing/i.test(n)) return 'hinge';
  if(/wiosł/i.test(n)) return 'row';
  if(/żołnierskie|siedząc \(barki\)/i.test(n)) return 'overhead';
  if(/brzusz|unoszenie nóg/i.test(n)) return 'other';
  if(/wyciskanie (sztangi|hantli) —|pompk/i.test(n)) return 'bench';
  return 'other';
}
const fcLeft=lm=>[11,13,23,25,27].reduce((a,i)=>a+(lm[i].visibility||0),0)>=[12,14,24,26,28].reduce((a,i)=>a+(lm[i].visibility||0),0);
function fcPts(lm,w,h){ const I=fcLeft(lm)?{sh:11,el:13,wr:15,hip:23,kn:25,an:27}:{sh:12,el:14,wr:16,hip:24,kn:26,an:28}; const P=i=>({x:lm[i].x*w,y:lm[i].y*h}); return {sh:P(I.sh),el:P(I.el),wr:P(I.wr),hip:P(I.hip),kn:P(I.kn),an:P(I.an)}; }
const fcLean=(sh,hip)=>Math.round(Math.abs(Math.atan2(sh.x-hip.x, hip.y-sh.y))*180/Math.PI);
// obróć odcinek pivot→end tak, by kąt (fn) osiągnął wartość docelową; zwraca położenie końca „jak powinno być”
function fcRotTo(pivot, end, fn, target){
  const dx=end.x-pivot.x, dy=end.y-pivot.y, L=Math.hypot(dx,dy), a0=Math.atan2(dy,dx); let best=null;
  for(let d=-180; d<=180; d++){ const a=a0+d*Math.PI/180, q={x:pivot.x+L*Math.cos(a), y:pivot.y+L*Math.sin(a)}, err=Math.abs(fn(q)-target)+Math.abs(d)*0.01; if(!best||err<best.err) best={q,err}; }
  return best.q;
}
// odchylenia od wzorca dla każdej klatki: {joint, delta, label, hint, pivot, to}
function fcIssues(rec){
  const kind=formKind(rec.ex||''), out=rec.lms.map(()=>[]);
  const fr=rec.lms.map((lm,i)=>{ if(!lm) return null; const p=fcPts(lm,rec.w,rec.h);
    return {i,p, knee:fcAngle(p.hip,p.kn,p.an), hipA:fcAngle(p.sh,p.hip,p.kn), elbow:fcAngle(p.sh,p.el,p.wr), lean:fcLean(p.sh,p.hip), front:Math.min(lm[11].visibility||0,lm[12].visibility||0)>0.5 && Math.abs(lm[11].x-lm[12].x)>0.12}; })   // z przodu tylko, gdy oba barki dobrze widoczne i rozstawione
    .filter(f=>f && !f.front);
  if(!fr.length) return out;
  const ext=(k,dir)=>fr.reduce((a,f)=>(dir<0?f[k]<a[k]:f[k]>a[k])?f:a, fr[0]);
  const add=(f,joint,val,target,cmp,name,hint,pivot,end,fn)=>{
    const off = cmp==='max' ? val-target : target-val; if(off<=3) return;
    out[f.i].push({joint, delta:off, label:`${name} ${val}° → cel ${cmp==='max'?'≤':'≥'}${target}°`, hint:`${hint} o ${off}°`, pivot, to:fcRotTo(pivot,end,fn,target)});
  };
  const knee=(f,t,h)=>add(f,'kolano',f.knee,t,'max','Kolano',h,f.p.kn,f.p.hip,q=>fcAngle(q,f.p.kn,f.p.an));
  const leanMax=(f,t,h)=>add(f,'tułów',f.lean,t,'max','Tułów (od pionu)',h,f.p.hip,f.p.sh,q=>fcLean(q,f.p.hip));
  const leanMin=(f,t,h)=>add(f,'tułów',f.lean,t,'min','Tułów (od pionu)',h,f.p.hip,f.p.sh,q=>fcLean(q,f.p.hip));
  const elbowMax=(f,t,h)=>add(f,'łokieć',f.elbow,t,'max','Łokieć',h,f.p.el,f.p.wr,q=>fcAngle(f.p.sh,f.p.el,q));
  const elbowMin=(f,t,h)=>add(f,'łokieć',f.elbow,t,'min','Łokieć',h,f.p.el,f.p.wr,q=>fcAngle(f.p.sh,f.p.el,q));
  const hipMin=(f,t,h)=>add(f,'biodro',f.hipA,t,'min','Biodro',h,f.p.hip,f.p.sh,q=>fcAngle(q,f.p.hip,f.p.kn));
  if(kind==='squat'){ knee(ext('knee',-1),95,'zejdź niżej'); fr.filter(f=>f.knee<130).forEach(f=>leanMax(f,45,'wyprostuj tułów')); }
  else if(kind==='legpress') knee(ext('knee',-1),95,'opuść platformę niżej');
  else if(kind==='lunge'){ knee(ext('knee',-1),100,'zejdź niżej'); fr.filter(f=>f.knee<130).forEach(f=>leanMax(f,20,'wyprostuj tułów')); }
  else if(kind==='hinge'){ if(/swing/i.test(rec.ex)) hipMin(ext('hipA',1),165,'dopchnij biodra na górze'); else fr.forEach(f=>leanMax(f,80,'nie schodź tułowiem poniżej poziomu')); }
  else if(kind==='row') fr.forEach(f=>leanMin(f,30,'pochyl tułów bardziej'));
  else if(kind==='bench') elbowMax(ext('elbow',-1),95,'opuść ciężar niżej');
  else if(kind==='overhead'){ elbowMin(ext('elbow',1),165,'wyprostuj ręce do końca'); fr.forEach(f=>leanMax(f,12,'nie odchylaj się do tyłu')); }
  return out;
}
// wzorzec na klatce: zielony przerywany odcinek „jak powinno być” + etykieta z kątem i kierunkiem poprawki
function fcDrawGuides(c, issues){
  const g=c.getContext('2d'), s=c.width/360, placed=[];
  issues.forEach((it,k)=>{
    g.save(); g.setLineDash([8*s,6*s]); g.lineWidth=Math.max(3,4*s); g.strokeStyle='#4ec97e';
    g.beginPath(); g.moveTo(it.pivot.x,it.pivot.y); g.lineTo(it.to.x,it.to.y); g.stroke(); g.setLineDash([]);
    g.fillStyle='#4ec97e'; g.beginPath(); g.arc(it.to.x,it.to.y,5*s,0,7); g.fill();
    const fs=Math.max(10,Math.round(12*s)), pad=6*s, lines=[it.label, '→ '+it.hint];
    g.font=`600 ${fs}px Inter, system-ui, sans-serif`; const tw=Math.max(...lines.map(l=>g.measureText(l).width)), bh=fs*2.5+pad;
    const bw=tw+pad*2, x=Math.min(Math.max(it.pivot.x+12*s, pad), c.width-bw-pad);
    // etykiety nie mogą na siebie nachodzić: przesuwaj w dół (a gdy brak miejsca — w górę) aż do wolnego miejsca
    const hit=yy=>placed.some(r=>x<r.x+r.w && x+bw>r.x && yy<r.y+r.h+4*s && yy+bh+4*s>r.y);
    let y=Math.max(pad, Math.min(it.pivot.y-bh/2, c.height-bh-pad));
    for(let n=0; hit(y) && n<20; n++){ y+=bh/2; if(y>c.height-bh-pad){ y=pad; } }
    placed.push({x,y,w:bw,h:bh});
    g.fillStyle='rgba(14,17,20,.85)'; g.fillRect(x,y,bw,bh);
    g.fillStyle='#ff9a4a'; g.fillText(lines[0], x+pad, y+pad/2+fs);
    g.fillStyle='#4ec97e'; g.fillText(lines[1], x+pad, y+pad/2+fs*2.15);
    g.restore();
  });
}
const fcImg=src=>new Promise((res,rej)=>{ const im=new Image(); im.onload=()=>res(im); im.onerror=rej; im.src=src; });
async function fcRenderFrame(rec, i, issues){
  const im=await fcImg(rec.raw[i]), c=document.createElement('canvas'); c.width=rec.w; c.height=rec.h;
  c.getContext('2d').drawImage(im,0,0,rec.w,rec.h); fcDraw(c, rec.lms[i]); fcDrawGuides(c, (issues&&issues[i])||[]); return c;
}
/* ---- klatki tylko na tym telefonie (IndexedDB), wynik oceny w rozmowie z Trenerem (synchronizowany) ---- */
function fcDB(){ return new Promise((res,rej)=>{ const r=indexedDB.open('zelazo_forms',1); r.onupgradeneeded=()=>r.result.createObjectStore('f'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
async function fcPut(id, rec){
  try{ const db=await fcDB();
    await new Promise((res,rej)=>{ const tx=db.transaction('f','readwrite'), st=tx.objectStore('f'); st.put(rec,id);
      // trzymaj 30 ostatnich nagrań (id rosną z czasem)
      const q=st.getAllKeys(); q.onsuccess=()=>{ const ks=q.result.map(String).sort(); ks.slice(0,Math.max(0,ks.length-30)).forEach(k=>st.delete(k)); };
      tx.oncomplete=res; tx.onerror=()=>rej(tx.error); });
  }catch(e){}
}
async function fcGet(id){ try{ const db=await fcDB(); return await new Promise(res=>{ const q=db.transaction('f').objectStore('f').get(id); q.onsuccess=()=>res(q.result||null); q.onerror=()=>res(null); }); }catch(e){ return null; } }
function fcSaveAndShow(r, metrics, rec){
  const hh=loadCoach(), t=Date.now(), rid=coachId();
  const txt=`**Ocena techniki: ${r.ocena}.** ${r.podsumowanie}`+(r.bezpieczenstwo?`\n⚠ ${r.bezpieczenstwo}`:'')+
    r.poprawki.map(p=>`\n- ${p.problem} → ${p.jak_poprawic}`).join('')+(r.mocne_strony.length?`\n- Dobrze: ${r.mocne_strony.join('; ')}`:'')+`\n_${fcMeasLine(metrics)}_`;
  hh.push({role:'user', content:`📹 Sprawdź technikę: ${FC.ex}${FC.set?' ('+FC.set+')':''}`, id:coachId(), t});
  hh.push({role:'assistant', content:txt, id:rid, t:t+1, kind:'form', ex:FC.ex, set:FC.set, grade:r.ocena, fix:(r.poprawki[0]&&r.poprawki[0].problem)||'', res:r, metrics});
  saveCoach(hh); fcPut(rid, rec); renderExLib();
  coachAtt={id:rid, ex:FC.ex, t};   // następne pytanie do Trenera dostanie te klatki (chip z ✕)
  if(WO){ WO.forms=WO.forms||[]; WO.forms.push({ex:FC.ex, ocena:r.ocena, at:t}); woSave(); }
  fcResultView(r, metrics, rec, null, rid);
}
// wynik (świeży albo z historii): ocena, poprawki, pomiary i klatki ze szkieletem i wzorcem — stuknij, by powiększyć
function fcResultView(r, metrics, rec, savedAt, id){
  const g=FC_GRADE[r.ocena]??3, issues=rec?fcIssues(rec):[], nIss=issues.flat().length;
  fcShow(`<p class="fc-sub"><b>${esc(FC.ex)}</b>${FC.set?' · '+esc(FC.set):''}${savedAt?' · '+new Date(savedAt).toLocaleString('pl-PL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):''}</p>
    <span class="fc-grade g${g}">${esc(r.ocena)}</span>
    <p class="fc-sub" style="color:var(--ink)">${esc(r.podsumowanie)}</p>
    ${r.bezpieczenstwo?`<div class="fc-warn">⚠ ${esc(r.bezpieczenstwo)}</div>`:''}
    ${r.poprawki.length?`<div class="fc-sec"><h4>Do poprawy w następnej serii</h4>${r.poprawki.map(p=>`<div class="fc-fix ${p.waga}"><b>${esc(p.problem)}</b><span>${esc(p.jak_poprawic)}</span></div>`).join('')}</div>`:''}
    ${r.mocne_strony.length?`<div class="fc-sec"><h4>Dobrze</h4><ul class="fc-tips">${r.mocne_strony.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}
    ${r.nagranie?`<p class="fc-meas">📹 ${esc(r.nagranie)}</p>`:''}
    <p class="fc-meas">${esc(fcMeasLine(metrics))}</p>
    <div class="fc-sec"><h4>Klatki${rec?` · stuknij, by powiększyć${nIss?' · zielony = jak powinno być':''}`:''}</h4>
      ${rec?'<div class="fc-thumbs" id="fcThumbs"></div>':'<p class="fc-meas">Klatki z tego nagrania są na telefonie, na którym je nagrano.</p>'}</div>
    <div class="fc-btns">${id&&rec?'<button class="fc-btn" id="fcAsk">💬 Zapytaj Trenera o to nagranie</button>':''}${TTS?'<button class="fc-btn" id="fcRead">🔊 Przeczytaj</button>':''}
      ${savedAt?'<button class="fc-btn" id="fcBack">← Wróć do ćwiczenia</button>':''}<button class="fc-btn main" data-fc-close>OK</button></div>`);
  document.querySelector('[data-fc-close]').onclick=()=>{ if(TTS) TTS.cancel(); fcClose(); };
  const bk=document.getElementById('fcBack'); if(bk) bk.onclick=()=>openFormCheck(FC.ex,'',{lib:true});
  // Trener z pełnym kontekstem: otwórz czat z dołączonymi klatkami tego nagrania
  const ak=document.getElementById('fcAsk'); if(ak) ak.onclick=()=>{ if(TTS) TTS.cancel(); coachAtt={id, ex:FC.ex, t:savedAt||Date.now()}; fcClose(); openCoach();
    const inp=document.getElementById('coachIn'); if(!inp.value) inp.value='Oceń ponownie to nagranie, biorąc pod uwagę mój plan, historię i ograniczenia.'; };
  const rd=document.getElementById('fcRead'); if(rd) rd.onclick=()=>coachSpeak(r.podsumowanie+' '+r.poprawki.map(p=>p.problem+'. '+p.jak_poprawic).join(' ')+(r.bezpieczenstwo?' Uwaga: '+r.bezpieczenstwo:''));
  if(rec){ const box=document.getElementById('fcThumbs');
    rec.raw.forEach((_,i)=>fcRenderFrame(rec,i,issues).then(c=>{ c.className='fc-th'+((issues[i]||[]).length?' bad':''); c.setAttribute('role','button'); c.setAttribute('aria-label','Klatka '+(i+1)); c.onclick=()=>fcZoom(rec,issues,i); c.style.order=i; box.appendChild(c); }).catch(()=>{})); }
}
// powiększenie klatki: pełny ekran, ‹ › między klatkami, lista odchyleń pod spodem
async function fcZoom(rec, issues, i){
  const z=document.getElementById('fcZoom'); z.style.display='flex';
  const n=rec.raw.length; i=(i+n)%n;
  document.getElementById('fzCap').textContent=`Klatka ${i+1} z ${n}`;
  const c=await fcRenderFrame(rec,i,issues), box=document.getElementById('fzImg'); box.innerHTML=''; box.appendChild(c);
  const it=issues[i]||[];
  document.getElementById('fzNotes').innerHTML= !rec.lms[i] ? 'Na tej klatce nie rozpoznano sylwetki.'
    : it.length ? it.map(x=>`<div><b>${esc(x.label)}</b><span>→ ${esc(x.hint)}</span></div>`).join('') : '<div class="ok">Na tej klatce kąty mieszczą się we wzorcu.</div>';
  document.getElementById('fzPrev').onclick=()=>fcZoom(rec,issues,i-1);
  document.getElementById('fzNext').onclick=()=>fcZoom(rec,issues,i+1);
}
document.getElementById('fzClose').onclick=()=>{ document.getElementById('fcZoom').style.display='none'; };
// ocena z historii ćwiczenia
async function fcOpenSaved(id){
  const m=loadCoach().find(x=>x.id===id); if(!m) return;
  FC.ex=m.ex||FC.ex; FC.set=m.set||'';
  if(!m.res){ fcShow(`<div class="fc-cue">${coachMd(m.content)}</div><div class="fc-btns"><button class="fc-btn" id="fcBack">← Wróć do ćwiczenia</button></div>`); document.getElementById('fcBack').onclick=()=>openFormCheck(FC.ex,'',{lib:true}); return; }
  fcResultView(m.res, m.metrics||{}, await fcGet(id), m.t, id);
}

// init
renderToday();
migrateLocalCoach();
woResume();
// start: dzień treningowy z niedokończonym treningiem → Trening, inaczej Dieta
{ const ds=daySummary(todayISO()); showView(ds.trainAll && ds.trainDone<ds.trainAll ? 'train' : 'diet'); }
refreshNotifUI();
refreshSyncUI();
restoreHandle();
setupReminders();
window.addEventListener('resize',()=>{if(document.getElementById('v-progress').classList.contains('on'))renderWeight()});
