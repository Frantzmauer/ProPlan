// ŻELAZO — Instruktaż ćwiczeń: krótka wskazówka i filmy.
// Moduł zawiera tylko deklaracje; kod startowy jest w __init_N, wywoływanych przez main.js w stałej kolejności.
import { bcClose } from '../features/scanner.js';
import { voiceReset, voiceStop } from '../ui/dictation.js';
import { MT } from './meals.js';
import { swapCue } from './train.js';

export let GUIDE;

export function openGuide(name){
  const cue = GUIDE[name] || GUIDE[name.trim()] || swapCue(name) || 'Skup się na kontrolowanym ruchu w pełnym zakresie i napięciu docelowego mięśnia.';
  const yt='https://www.youtube.com/results?search_query='+encodeURIComponent(name+' technika');
  const dlg=document.getElementById('guideDialog');
  dlg.querySelector('#gdTitle').textContent=name;
  dlg.querySelector('#gdCue').textContent=cue;
  dlg.querySelector('#gdVideo').href=yt;
  dlg.classList.add('show');
}

export function closeGuide(){ document.getElementById('guideDialog').classList.remove('show'); }

export function openMealDialog(iso, keepReplace){
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

export function closeMealDialog(){ voiceStop(); bcClose(); document.getElementById('mealDialog').classList.remove('show'); }

export function __init_5(){

// --- okno dodawania własnego posiłku ---
/* ==== INSTRUKTAŻ ĆWICZEŃ (krótki cue + link do wideo) ==== */
GUIDE = {
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
}
