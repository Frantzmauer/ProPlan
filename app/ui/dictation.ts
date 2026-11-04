// ŻELAZO — Dyktowanie (rozpoznawanie mowy pl-PL) — opis posiłku i rozmowa z Trenerem.
// Moduł zawiera tylko deklaracje; kod startowy jest w __init_N, wywoływanych przez main.js w stałej kolejności.
import { S, save } from '../core/state';
import { mark } from '../lib/state';
import { DEFAULT_KCAL, macroGoalFor } from '../plan/data';
import { closeMealDialog } from '../screens/guide';
import { MT, mtAteNow } from '../screens/meals';
import { log, renderToday } from '../screens/train';

export let SpeechRec, mealVoice;

// wspólne dyktowanie (posiłek, Trener): jedna wypowiedź, kończy się sama po chwili ciszy
// (tryb ciągły na Androidzie powtarza tekst); o = {input, mic, msg, listening, onDone(heard), onSilence()}
export function makeDictation(o){
  let rec=null;
  const say=(t,cls?)=>{ o.msg.textContent=t; o.msg.className='md-voice'+(cls?' '+cls:''); o.msg.style.display=t?'block':'none'; };
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

export function voiceReset(){
  mealVoice.stop(); document.getElementById('mdEstimate').classList.remove('hi');
  mealVoice.say(SpeechRec ? '' : 'Możesz dyktować mikrofonem na klawiaturze telefonu.', 'info');
}

export function voiceStop(){ mealVoice.stop(); }

export function saveMealDialog(){
  const dlg=document.getElementById('mealDialog');
  const iso=dlg.dataset.iso;
  const txt=dlg.querySelector('#mdTxt').value.trim();
  const kcal=parseInt(dlg.querySelector('#mdKcal').value)||0;
  if(!txt && !kcal){ closeMealDialog(); return; }
  const L=log(iso);
  if(!L.custom)L.custom=[];
  const rep=MT.replace && MT.replace.iso===iso ? MT.replace.key : undefined;   // „Zamień” przy posiłku albo „Inaczej” w domknięciu dnia
  L.custom.push({
    txt:txt||'Własny posiłek', kcal,
    p:parseInt(dlg.querySelector('#mdP').value)||0,
    c:parseInt(dlg.querySelector('#mdC').value)||0,
    f:parseInt(dlg.querySelector('#mdF').value)||0,
    done:true, _t:Date.now(), ate:mtAteNow(iso), src:MT.src||undefined, rep
  });
  if(rep){ if(!L.ate) L.ate={}; L.ate[rep]=-1; mark(L,'ate:'+rep); }
  MT.replace=null; MT.src=null;
  mark(L,'custom');save();closeMealDialog();renderToday();
}

export function renderMacros(tot){
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

export function __init_6(){

/* ---- dyktowanie opisu posiłku: rozpoznawanie mowy przeglądarki (pl-PL), tekst pojawia się na bieżąco ----
   Chrome na Androidzie wysyła nagranie do Google; Safari używa rozpoznawania Apple.
   Bez obsługi w przeglądarce przycisk znika, a podpowiedź wskazuje mikrofon na klawiaturze. */
SpeechRec = window.SpeechRecognition||window.webkitSpeechRecognition;

// dyktowanie opisu posiłku
mealVoice = makeDictation({
  input:document.getElementById('mdTxt'), mic:document.getElementById('mdMic'), msg:document.getElementById('mdVoice'),
  listening:'● Słucham… powiedz, co zjadłeś. Skończę sam po chwili ciszy.',
  onDone:()=>{ mealVoice.say('✓ Gotowe — popraw tekst, jeśli trzeba, i oszacuj kalorie.','done'); document.getElementById('mdEstimate').classList.add('hi'); }
});
}
