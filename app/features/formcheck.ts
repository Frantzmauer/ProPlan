// ŻELAZO — Ocena techniki z nagrania, biblioteka ćwiczeń, wzorce ruchu.
// Moduł zawiera tylko deklaracje; kod startowy jest w __init_N, wywoływanych przez main.js w stałej kolejności.
import { restoreHandle } from '../core/backup';
import { CLOUD, S, cloudCall } from '../core/state';
import { todayISO } from '../lib/dates';
import { workoutFor } from '../plan/data';
import { esc } from '../screens/accounts';
import { TTS, __set_coachAtt, coachAtt, coachId, coachMd, coachSpeak, loadCoach, migrateLocalCoach, openCoach, saveCoach } from '../screens/coach';
import { GUIDE } from '../screens/guide';
import { showView } from '../screens/more';
import { renderWeight } from '../screens/progress';
import { refreshSyncUI } from '../screens/sync-ui';
import { daySummary, renderToday, swapCue } from '../screens/train';
import { WO, woResume, woSave } from '../screens/workout';
import { bindOffer, featOn, limitOffer, planEnforced, quotaCur, quotaLeft, quotaReset, quotaSet } from './plan-limits';
import { refreshNotifUI, setupReminders } from './reminders';

export let FC, POSE_VER, POSE_MODEL, posePromise, FC_STEPS, fcWait, FC_BONES, FC_GRADE, fcLeft, fcLean, fcImg;

// ustawienie kamery: ćwiczenia z ruchem biodra/kolana najlepiej z boku, wznosy i łydki z przodu
export function camView(name){ return /wznos|unoszenie.*bok|łydk|wspięcia|biceps|triceps|uginanie ramion/i.test(name) ? 'z przodu' : 'z boku'; }

export function fcShow(html){ document.getElementById('fcBody').innerHTML=html; document.getElementById('formDialog').style.display='flex'; }

export function fcClose(){ if(FC.busy) return; document.getElementById('formDialog').style.display='none'; }

// historia ocen techniki danego ćwiczenia (z rozmowy z Trenerem — synchronizowana)
export function formHistory(name){ return loadCoach().filter(m=>m.kind==='form' && m.ex===name).reverse(); }

// opts.lib: wejście z biblioteki ćwiczeń — dodatkowo opis techniki, link do filmów i historia ocen
export function openFormCheck(name, setInfo, opts?){
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
    fcShow(`${lib?`<p class="fc-sub"><b>${esc(name)}</b></p>`+head:''}<p class="fc-sub">Ocena techniki z nagrania jest teraz niedostępna${planEnforced()?' w Twoim planie':''}. Wskazówki i filmy z techniką działają dalej.</p>${planEnforced()?limitOffer('form'):''}<div class="fc-btns"><button class="fc-btn ghost" data-fc-close>Zamknij</button></div>`);
    document.querySelector('[data-fc-close]').onclick=fcClose; bindOffer(document.getElementById('fcBody')); return;
  }
  if(quotaLeft('form')===0){   // plan z limitami: nie każ nagrywać, gdy limit ocen wykorzystany
    fcShow(`${lib?`<p class="fc-sub"><b>${esc(name)}</b></p>`+head:''}<p class="fc-sub">Limit ${quotaCur().form.max} ocen techniki w tym miesiącu wykorzystany. Nowe od ${quotaReset()}. Wskazówki i filmy z techniką działają dalej.</p>${limitOffer('form')}<div class="fc-btns"><button class="fc-btn ghost" data-fc-close>Zamknij</button></div>`);
    document.querySelector('[data-fc-close]').onclick=fcClose; bindOffer(document.getElementById('fcBody')); return;
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

export function fcProgress(cur, note?){
  fcShow(`<p class="fc-sub"><b>${esc(FC.ex)}</b>${FC.set?' · '+esc(FC.set):''}</p><div class="fc-prog">`+
    FC_STEPS.map((t,i)=>`<div class="fc-step ${i<cur?'ok':i===cur?'on':''}"><i>${i<cur?'✓':i===cur?'●':'○'}</i>${t}${i===cur&&note?' — '+esc(note):''}</div>`).join('')+`</div>`);
}

// klatki z filmu: n równych momentów (5–95% czasu), dłuższy bok maks. 640 px
export async function fcFrames(file, n){
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

export function loadPose(){
  if(!posePromise) posePromise=(async()=>{
    const m=await import(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${POSE_VER}/vision_bundle.mjs`);
    const fs=await m.FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${POSE_VER}/wasm`);
    const opts=d=>({baseOptions:{modelAssetPath:POSE_MODEL, delegate:d}, runningMode:'IMAGE', numPoses:1});
    try{ return await m.PoseLandmarker.createFromOptions(fs, opts('GPU')); }catch(e){ return await m.PoseLandmarker.createFromOptions(fs, opts('CPU')); }
  })().catch(e=>{ posePromise=null; throw e; });
  return posePromise;
}

// kąt w stawie b (stopnie), punkty w pikselach
export function fcAngle(a,b,c){ const v1=[a.x-b.x,a.y-b.y], v2=[c.x-b.x,c.y-b.y]; const cos=(v1[0]*v2[0]+v1[1]*v2[1])/(Math.hypot(...v1)*Math.hypot(...v2)||1); return Math.round(Math.acos(Math.max(-1,Math.min(1,cos)))*180/Math.PI); }

// pomiary z punktów sylwetki (MediaPipe: 11/12 barki, 13/14 łokcie, 15/16 nadgarstki, 23/24 biodra, 25/26 kolana, 27/28 kostki)
export function fcMetrics(series, w, h, dur): any {
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
  const m:any={widok_wg_sylwetki: front?'z przodu':'z boku', strona: front?'—':(left?'lewa':'prawa'), klatki_z_sylwetka: ok.length+'/'+series.length,
    ruch_mierzony_na: what, powtorzenia_wykryte: reps, czas_nagrania_s: Math.round(dur),
    kolano_min_kat: deep.knee, biodro_min_kat: Math.min(...rows.map(r=>r.hipA)), lokiec_min_kat: Math.min(...rows.map(r=>r.elbow)),
    tulow_max_pochylenie_od_pionu: Math.max(...rows.map(r=>r.lean)),
    glebokosc: deep.hipY>deep.kneeY+0.01 ? 'biodro poniżej kolana' : Math.abs(deep.hipY-deep.kneeY)<=0.01 ? 'biodro na wysokości kolana' : 'biodro powyżej kolana'};
  if(reps>0) m.czas_na_powtorzenie_s=Math.round(dur/reps*10)/10;
  if(front){ const r=Math.min(...rows.filter(x=>x.anW>0.02).map(x=>x.knW/x.anW)); if(isFinite(r)) m.kolana_do_kostek_min=Math.round(r*100)/100; }
  return {m, bottoms:bottoms.map(i=>ok[i].t)};
}

export function fcDraw(c, lm){
  if(!lm) return;
  const g=c.getContext('2d'), w=c.width, h=c.height;
  g.lineWidth=Math.max(2, w/160); g.strokeStyle='#ff7a1a'; g.fillStyle='#ffffff';
  FC_BONES.forEach(([a,b])=>{ if((lm[a].visibility||0)<0.3||(lm[b].visibility||0)<0.3) return; g.beginPath(); g.moveTo(lm[a].x*w,lm[a].y*h); g.lineTo(lm[b].x*w,lm[b].y*h); g.stroke(); });
  [11,12,13,14,15,16,23,24,25,26,27,28].forEach(i=>{ if((lm[i].visibility||0)<0.3) return; g.beginPath(); g.arc(lm[i].x*w,lm[i].y*h,Math.max(3,w/110),0,7); g.fill(); });
}

export async function fcRun(file){
  if(FC.busy) return;
  FC.busy=true;
  try{
    if(file.size>400*1024*1024) throw new Error('Film jest bardzo duży — nagraj samą serię (do ok. 40 s).');
    fcProgress(0);
    const {frames, dur, w, h}=await fcFrames(file, 24);
    fcProgress(1);
    let metrics:any={rozpoznanie_sylwetki:'niedostępne'}, bottoms=[];
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

export function fcMeasLine(m){
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
export function exLibrary(){
  const groups=[['Całe ciało (FBW)',/^FBW/],['Góra ciała',/^UPPER/],['Dół ciała',/^LOWER/],['Dom',/^DOM/]], out=groups.map(g=>({name:g[0], ex:[]})), seen=new Set();
  for(let wk=1;wk<=24;wk++) for(let d=0;d<7;d++){
    const w=workoutFor(wk,d); if(!w||w.type!=='lift') continue;
    const gi=Math.max(0, groups.findIndex(g=>(g[1] as RegExp).test(w.title)));
    w.ex.forEach(e=>{ if(!seen.has(e.n)){ seen.add(e.n); out[gi].ex.push(e.n); } });
  }
  // ćwiczenia wprowadzone przez Trenera (wymiany) — w grupie „Od Trenera”
  const sw=[]; Object.values((S.adj&&S.adj.ex)||{}).forEach(l=>l.forEach(y=>{ if(y.swap&&y.swap.n&&!seen.has(y.swap.n)){ seen.add(y.swap.n); sw.push(y.swap.n); } }));
  if(sw.length) out.push({name:'Od Trenera', ex:sw});
  return out.filter(g=>g.ex.length);
}

export function renderExLib(){
  const box=document.getElementById('exLib'); if(!box) return;
  const q=(document.getElementById('libSearch').value||'').trim().toLowerCase();
  const groups=exLibrary().map(g=>({name:g.name, ex:g.ex.filter(n=>!q||n.toLowerCase().includes(q))})).filter(g=>g.ex.length);
  box.innerHTML= groups.length ? groups.map(g=>`<details class="lib-grp" ${q?'open':''}><summary>${esc(g.name)}<span>${g.ex.length} ćw.</span></summary>`+
    g.ex.map(n=>{ const h=formHistory(n)[0], gc=h?FC_GRADE[h.grade]:null;
      return `<button class="lib-ex" data-lib="${esc(n)}"><span class="nm">${esc(n)}</span>${h?`<span class="last g${gc}">${esc(h.grade)}</span>`:''}<span class="go">›</span></button>`; }).join('')+`</details>`).join('')
    : '<p class="lib-hint">Nic nie znaleziono.</p>';
  box.querySelectorAll('[data-lib]').forEach(b=>b.onclick=()=>openFormCheck(b.dataset.lib,'',{lib:true}));
}

/* ---- wzorzec ruchu: docelowe kąty dla typu ćwiczenia (widok z boku; z przodu nie oceniamy kątów) ---- */
export function formKind(n){
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

export function fcPts(lm,w,h){ const I=fcLeft(lm)?{sh:11,el:13,wr:15,hip:23,kn:25,an:27}:{sh:12,el:14,wr:16,hip:24,kn:26,an:28}; const P=i=>({x:lm[i].x*w,y:lm[i].y*h}); return {sh:P(I.sh),el:P(I.el),wr:P(I.wr),hip:P(I.hip),kn:P(I.kn),an:P(I.an)}; }

// obróć odcinek pivot→end tak, by kąt (fn) osiągnął wartość docelową; zwraca położenie końca „jak powinno być”
export function fcRotTo(pivot, end, fn, target){
  const dx=end.x-pivot.x, dy=end.y-pivot.y, L=Math.hypot(dx,dy), a0=Math.atan2(dy,dx); let best=null;
  for(let d=-180; d<=180; d++){ const a=a0+d*Math.PI/180, q={x:pivot.x+L*Math.cos(a), y:pivot.y+L*Math.sin(a)}, err=Math.abs(fn(q)-target)+Math.abs(d)*0.01; if(!best||err<best.err) best={q,err}; }
  return best.q;
}

// odchylenia od wzorca dla każdej klatki: {joint, delta, label, hint, pivot, to}
export function fcIssues(rec){
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
export function fcDrawGuides(c, issues){
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

export async function fcRenderFrame(rec, i, issues){
  const im=await fcImg(rec.raw[i]), c=document.createElement('canvas'); c.width=rec.w; c.height=rec.h;
  c.getContext('2d').drawImage(im,0,0,rec.w,rec.h); fcDraw(c, rec.lms[i]); fcDrawGuides(c, (issues&&issues[i])||[]); return c;
}

/* ---- klatki tylko na tym telefonie (IndexedDB), wynik oceny w rozmowie z Trenerem (synchronizowany) ---- */
export function fcDB(){ return new Promise<IDBDatabase>((res,rej)=>{ const r=indexedDB.open('zelazo_forms',1); r.onupgradeneeded=()=>r.result.createObjectStore('f'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }

export async function fcPut(id, rec){
  try{ const db=await fcDB();
    await new Promise((res,rej)=>{ const tx=db.transaction('f','readwrite'), st=tx.objectStore('f'); st.put(rec,id);
      // trzymaj 30 ostatnich nagrań (id rosną z czasem)
      const q=st.getAllKeys(); q.onsuccess=()=>{ const ks=q.result.map(String).sort(); ks.slice(0,Math.max(0,ks.length-30)).forEach(k=>st.delete(k)); };
      tx.oncomplete=res; tx.onerror=()=>rej(tx.error); });
  }catch(e){}
}

export async function fcGet(id){ try{ const db=await fcDB(); return await new Promise(res=>{ const q=db.transaction('f').objectStore('f').get(id); q.onsuccess=()=>res(q.result||null); q.onerror=()=>res(null); }); }catch(e){ return null; } }

export function fcSaveAndShow(r, metrics, rec){
  const hh=loadCoach(), t=Date.now(), rid=coachId();
  const txt=`**Ocena techniki: ${r.ocena}.** ${r.podsumowanie}`+(r.bezpieczenstwo?`\n⚠ ${r.bezpieczenstwo}`:'')+
    r.poprawki.map(p=>`\n- ${p.problem} → ${p.jak_poprawic}`).join('')+(r.mocne_strony.length?`\n- Dobrze: ${r.mocne_strony.join('; ')}`:'')+`\n_${fcMeasLine(metrics)}_`;
  hh.push({role:'user', content:`📹 Sprawdź technikę: ${FC.ex}${FC.set?' ('+FC.set+')':''}`, id:coachId(), t});
  hh.push({role:'assistant', content:txt, id:rid, t:t+1, kind:'form', ex:FC.ex, set:FC.set, grade:r.ocena, fix:(r.poprawki[0]&&r.poprawki[0].problem)||'', res:r, metrics});
  saveCoach(hh); fcPut(rid, rec); renderExLib();
  __set_coachAtt({id:rid, ex:FC.ex, t});   // następne pytanie do Trenera dostanie te klatki (chip z ✕)
  if(WO){ WO.forms=WO.forms||[]; WO.forms.push({ex:FC.ex, ocena:r.ocena, at:t}); woSave(); }
  fcResultView(r, metrics, rec, null, rid);
}

// wynik (świeży albo z historii): ocena, poprawki, pomiary i klatki ze szkieletem i wzorcem — stuknij, by powiększyć
export function fcResultView(r, metrics, rec, savedAt, id){
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
  const ak=document.getElementById('fcAsk'); if(ak) ak.onclick=()=>{ if(TTS) TTS.cancel(); __set_coachAtt({id, ex:FC.ex, t:savedAt||Date.now()}); fcClose(); openCoach();
    const inp=document.getElementById('coachIn'); if(!inp.value) inp.value='Oceń ponownie to nagranie, biorąc pod uwagę mój plan, historię i ograniczenia.'; };
  const rd=document.getElementById('fcRead'); if(rd) rd.onclick=()=>coachSpeak(r.podsumowanie+' '+r.poprawki.map(p=>p.problem+'. '+p.jak_poprawic).join(' ')+(r.bezpieczenstwo?' Uwaga: '+r.bezpieczenstwo:''));
  if(rec){ const box=document.getElementById('fcThumbs');
    rec.raw.forEach((_,i)=>fcRenderFrame(rec,i,issues).then(c=>{ c.className='fc-th'+((issues[i]||[]).length?' bad':''); c.setAttribute('role','button'); c.setAttribute('aria-label','Klatka '+(i+1)); c.onclick=()=>fcZoom(rec,issues,i); c.style.order=i; box.appendChild(c); }).catch(()=>{})); }
}

// powiększenie klatki: pełny ekran, ‹ › między klatkami, lista odchyleń pod spodem
export async function fcZoom(rec, issues, i){
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

// ocena z historii ćwiczenia
export async function fcOpenSaved(id){
  const m=loadCoach().find(x=>x.id===id); if(!m) return;
  FC.ex=m.ex||FC.ex; FC.set=m.set||'';
  if(!m.res){ fcShow(`<div class="fc-cue">${coachMd(m.content)}</div><div class="fc-btns"><button class="fc-btn" id="fcBack">← Wróć do ćwiczenia</button></div>`); document.getElementById('fcBack').onclick=()=>openFormCheck(FC.ex,'',{lib:true}); return; }
  fcResultView(m.res, m.metrics||{}, await fcGet(id), m.t, id);
}

export function __init_29(){

/* ============================================================
   ANALIZA TECHNIKI Z NAGRANIA (beta)
   1) film z kamery telefonu albo z galerii — zostaje na telefonie
   2) wycięcie klatek (canvas), 3) rozpoznanie sylwetki MediaPipe Pose (ładowane przy pierwszym użyciu),
   4) pomiary: powtórzenia, kąty, głębokość, pochylenie, tempo, 5) do Trenera: pomiary + do 10 klatek ze szkieletem,
   6) wynik w oknie, w rozmowie z Trenerem (synchronizowanej) i w sesji treningu.
   ============================================================ */
FC = {ex:'', set:'', busy:false};
POSE_VER = '0.10.14';
POSE_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
posePromise = null;
['fcRec','fcPick'].forEach(id=>document.getElementById(id).addEventListener('change',e=>{ const f=e.target.files&&e.target.files[0]; if(f) fcRun(f); }));
document.getElementById('formDialog').addEventListener('click',e=>{ if(e.target.id==='formDialog') fcClose(); });

FC_STEPS = ['Wycinam klatki z nagrania','Rozpoznaję sylwetkę i mierzę ruch','Trener ocenia technikę'];
fcWait = (el,ev,ms)=>new Promise<void>((res,rej)=>{ const t=setTimeout(()=>{ el.removeEventListener(ev,h); rej(new Error('timeout')); }, ms); const h=()=>{ clearTimeout(t); el.removeEventListener(ev,h); res(); }; el.addEventListener(ev,h); });
FC_BONES = [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[27,31],[28,32]];
FC_GRADE = {'dobrze':0,'drobne poprawki':1,'do poprawy':2,'nie da się ocenić':3};
document.getElementById('libSearch').addEventListener('input', renderExLib);
fcLeft = lm=>[11,13,23,25,27].reduce((a,i)=>a+(lm[i].visibility||0),0)>=[12,14,24,26,28].reduce((a,i)=>a+(lm[i].visibility||0),0);
fcLean = (sh,hip)=>Math.round(Math.abs(Math.atan2(sh.x-hip.x, hip.y-sh.y))*180/Math.PI);
fcImg = src=>new Promise((res,rej)=>{ const im=new Image(); im.onload=()=>res(im); im.onerror=rej; im.src=src; });
document.getElementById('fzClose').onclick=()=>{ document.getElementById('fcZoom').style.display='none'; };

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
}
