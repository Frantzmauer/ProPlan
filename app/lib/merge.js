// Scalanie stanu aplikacji z dwóch źródeł (telefon + serwer / inne urządzenie).
// Ta sama logika działa na serwerze (apps-script/Kod.js → mergeState) — zmiany wprowadzaj w obu miejscach.
export const COACH_KEEP=40;      // tyle ostatnich wiadomości czatu z Trenerem trzymamy i synchronizujemy

// SCALANIE dwóch stanów (lokalny + wczytany). Zasada: nic nie gubimy.
// - odznaczone posiłki/nawyki/ćwiczenia: suma (jeśli gdziekolwiek odhaczone → odhaczone)
// - woda: większa wartość
// - serie (kg/powt): niepuste wygrywa; przy konflikcie decyduje nowszy _m dnia
// - waga: po dacie, przy konflikcie nowszy wpis (ostatni zapis danej daty)
// - zakupy: suma; ustawienia/startDate: nowsze (po _settingsM)
export function mergeState(local, inc){
  const out=JSON.parse(JSON.stringify(local));
  if(!inc) return out;

  // --- logi dzienne ---
  out.log=out.log||{};
  const days=new Set([...Object.keys(local.log||{}),...Object.keys(inc.log||{})]);
  days.forEach(iso=>{
    const a=(local.log&&local.log[iso])||null;
    const b=(inc.log&&inc.log[iso])||null;
    if(a&&!b){out.log[iso]=a;return;}
    if(b&&!a){out.log[iso]=b;return;}
    // oba istnieją → scal pole po polu wg znaczników czasu (nowsza zmiana wygrywa)
    const am=a._m||0, bm=b._m||0, bNewer=bm>am;
    const ta=a._t||{}, tb=b._t||{};
    // scalony rejestr znaczników: dla każdego pola bierzemy nowszy czas
    const tAll={};
    new Set([...Object.keys(ta),...Object.keys(tb)]).forEach(f=>{ tAll[f]=Math.max(ta[f]||0, tb[f]||0); });
    const m={meals:{},ex:{},habits:{},water:0,_m:Math.max(am,bm),_t:tAll};
    // pomocnik: która strona wygrywa dla danego pola.
    // Jeśli tylko jedna strona faktycznie ruszała pole (ma znacznik) — ta strona wygrywa.
    // Gdy żadna strona nie ma znacznika (stare dane sprzed aktualizacji) i orFallback=true,
    // stosujemy dawną zasadę „zaznaczone wygrywa", by nie zgubić historycznych odznaczeń.
    const pick=(field, va, vb, orFallback)=>{
      const hasA=ta[field]!==undefined, hasB=tb[field]!==undefined;
      if(hasA&&!hasB) return va;
      if(hasB&&!hasA) return vb;
      if(hasA&&hasB){ return (tb[field]>ta[field]) ? vb : (ta[field]>tb[field] ? va : (bNewer?vb:va)); }
      if(orFallback) return va||vb; // brak znaczników po obu stronach → OR (bezpieczne dla starych danych)
      return bNewer?vb:va;
    };
    // meals / habits: wg znacznika pola (dla starych danych bez znaczników — OR)
    ['meals','habits'].forEach(sec=>{
      const keys=new Set([...Object.keys(a[sec]||{}),...Object.keys(b[sec]||{})]);
      keys.forEach(k=>{
        const field=(sec==='meals'?'meal:':'habit:')+k;
        const va=!!(a[sec]&&a[sec][k]), vb=!!(b[sec]&&b[sec][k]);
        m[sec][k]= (va===vb) ? va : pick(field, va, vb, true);
      });
    });
    // water: nowsza zmiana wygrywa; dla starych danych bez znaczników — max (bezpiecznie)
    (function(){
      const hasA=ta['water']!==undefined, hasB=tb['water']!==undefined;
      if(hasA||hasB) m.water=pick('water', a.water||0, b.water||0, false);
      else m.water=Math.max(a.water||0, b.water||0);
    })();
    // warianty posiłków: wg znacznika pola
    if(a.var||b.var){
      m.var={};
      const vk=new Set([...Object.keys(a.var||{}),...Object.keys(b.var||{})]);
      vk.forEach(k=>{
        const va=a.var&&a.var[k], vb=b.var&&b.var[k];
        if(va!==undefined&&vb!==undefined) m.var[k]=pick('var:'+k, va, vb);
        else m.var[k]=(va!==undefined?va:vb);
      });
    }
    // własne posiłki: scal po podpisie; done i usunięcie (_del) wg nowszego znacznika wpisu
    if((a.custom&&a.custom.length)||(b.custom&&b.custom.length)){
      const sig=x=>((x.txt||'')+'|'+(x.kcal||0)+'|'+(x.p||0)+'|'+(x.c||0)+'|'+(x.f||0));
      const map=new Map();
      (a.custom||[]).forEach(x=>map.set(sig(x),Object.assign({},x)));
      (b.custom||[]).forEach(x=>{
        const k=sig(x);
        if(map.has(k)){
          const e=map.get(k);
          const et=Math.max(e._t||0,e._del||0), xt=Math.max(x._t||0,x._del||0);
          // nowszy wpis decyduje o done/_del
          if(xt>=et){ e.done=x.done; if(x._del)e._del=x._del; else delete e._del; e._t=x._t||e._t; }
        } else map.set(k,Object.assign({},x));
      });
      m.custom=[...map.values()];
    }
    // ex: done wg znacznika pola; sets scalane; cardio (boolean) wg znacznika
    const exKeys=new Set([...Object.keys(a.ex||{}),...Object.keys(b.ex||{})]);
    exKeys.forEach(k=>{
      const ea=(a.ex&&a.ex[k]), eb=(b.ex&&b.ex[k]);
      if(typeof ea==='boolean'||typeof eb==='boolean'){ m.ex[k]=pick('ex:'+k, !!ea, !!eb, true); return; }
      const da=!!(ea&&ea.done), db=!!(eb&&eb.done);
      const done = (da===db) ? da : pick('ex:'+k, da, db, true);
      const sets={};
      const sa=(ea&&ea.sets)||{}, sb=(eb&&eb.sets)||{};
      const sKeys=new Set([...Object.keys(sa),...Object.keys(sb)]);
      sKeys.forEach(sk=>{
        const va=sa[sk], vb=sb[sk];
        if(va!==undefined&&va!==''&&(vb===undefined||vb===''))sets[sk]=va;
        else if(vb!==undefined&&vb!==''&&(va===undefined||va===''))sets[sk]=vb;
        else if(va!==undefined&&vb!==undefined)sets[sk]= bNewer?vb:va;
        else sets[sk]=va!==undefined?va:vb;
      });
      // „Pomiń” wg własnego znacznika; zaliczone ćwiczenie nigdy nie jest pominięte
      const ka=!!(ea&&ea.skip), kb=!!(eb&&eb.skip);
      const skip = (ka===kb) ? ka : pick('skip:'+k, ka, kb, true);
      m.ex[k]={done,sets};
      if(skip && !done) m.ex[k].skip=true;
      // odhaczone serie: każda wg własnego znacznika („ok:<klucz>:<seria>”)
      if((ea&&ea.ok)||(eb&&eb.ok)){
        const oa=(ea&&ea.ok)||{}, ob=(eb&&eb.ok)||{}, ok={};
        new Set([...Object.keys(oa),...Object.keys(ob)]).forEach(s=>{
          const va=!!oa[s], vb=!!ob[s];
          if((va===vb) ? va : pick('ok:'+k+':'+s, va, vb, true)) ok[s]=true;
        });
        m.ex[k].ok=ok;
      }
    });
    // pomiar treningu (tryb treningu): zostaje sesja, która skończyła się później
    if(a.session||b.session) m.session = (!b.session || (a.session && (a.session.end||0)>=(b.session.end||0))) ? a.session : b.session;
    // samopoczucie przed treningiem: nowsza odpowiedź wygrywa
    if(a.checkin||b.checkin) m.checkin = (!b.checkin || (a.checkin && (a.checkin.at||0)>=(b.checkin.at||0))) ? a.checkin : b.checkin;
    // godzina zjedzenia posiłku z planu (-1 = pominięty): nowsza zmiana wygrywa
    if(a.ate||b.ate){ m.ate={}; const ak=new Set([...Object.keys(a.ate||{}),...Object.keys(b.ate||{})]);
      ak.forEach(k=>{ const va=a.ate&&a.ate[k], vb=b.ate&&b.ate[k]; m.ate[k]=(va!==undefined&&vb!==undefined)?pick('ate:'+k, va, vb, false):(va!==undefined?va:vb); }); }
    out.log[iso]=m;
  });

  // --- waga (po dacie) ---
  const wmap={};
  (local.weights||[]).forEach(w=>wmap[w.d]=w.w);
  (inc.weights||[]).forEach(w=>{ wmap[w.d]=w.w; }); // wczytany nadpisuje tę samą datę
  out.weights=Object.keys(wmap).sort().map(d=>({d,w:wmap[d]}));

  // --- obwody (po dacie): nowszy zapis tej samej daty wygrywa ---
  const mmap={};
  (local.measures||[]).forEach(m=>mmap[m.d]=m);
  (inc.measures||[]).forEach(m=>{ const a=mmap[m.d]; if(!a || (m._t||0)>=(a._t||0)) mmap[m.d]=m; });
  out.measures=Object.keys(mmap).sort().map(d=>Object.assign({},mmap[d]));

  // --- zakupy: OR ---
  // --- zakupy: nowsza zmiana wygrywa (per pozycja); stare dane bez znaczników → OR ---
  out.shop=Object.assign({},local.shop||{});
  out.shopT=Object.assign({},local.shopT||{});
  const lt=local.shopT||{}, it=inc.shopT||{};
  const shopKeys=new Set([...Object.keys(local.shop||{}),...Object.keys(inc.shop||{})]);
  shopKeys.forEach(k=>{
    const la=!!(local.shop&&local.shop[k]), ib=!!(inc.shop&&inc.shop[k]);
    const hasLa=lt[k]!==undefined, hasIb=it[k]!==undefined;
    let val;
    if(hasLa&&hasIb) val = it[k]>lt[k] ? ib : (lt[k]>it[k] ? la : (la||ib));
    else if(hasIb&&!hasLa) val=ib;
    else if(hasLa&&!hasIb) val=la;
    else val = la||ib; // brak znaczników → OR (bezpiecznie dla starych danych)
    out.shop[k]=val;
    out.shopT[k]=Math.max(lt[k]||0, it[k]||0);
  });

  // --- cykl (tylko gdy użytkowniczka włączyła synchronizację): nowsza kopia wygrywa, {off:true} usuwa ---
  if(inc.cyc && (!local.cyc || (inc.cyc.at||0)>(local.cyc.at||0))) out.cyc=inc.cyc;
  // --- ustawienia / startDate: nowsze wg _settingsM ---
  const ls=local._settingsM||0, is=inc._settingsM||0;
  if(is>ls){
    out.startDate=inc.startDate||out.startDate;
    out.reminders=inc.reminders||out.reminders;
    if(inc.kcalGoal) out.kcalGoal=inc.kcalGoal;
    if(inc.profile) out.profile=inc.profile;
    if(inc.adj) out.adj=inc.adj;   // zmiany planu zaakceptowane od Trenera
    out._settingsM=is;
  }
  // czat z Trenerem: wiadomości po id (bez duplikatów, po kolei), status propozycji wg znacznika st,
  // „Wyczyść” wg clearedAt — starsze wiadomości z innych urządzeń nie wracają
  if(local.coach||inc.coach){
    const a=local.coach||{}, b=inc.coach||{}, cl=Math.max(a.clearedAt||0, b.clearedAt||0), map={};
    [...(a.msgs||[]), ...(b.msgs||[])].forEach(m=>{
      if(!m || !m.id || (m.t||0)<=cl) return;
      const x=map[m.id];
      if(!x || (m.st||0)>(x.st||0)) map[m.id]=m;
    });
    out.coach={clearedAt:cl, msgs:Object.values(map).sort((x,y)=>(x.t||0)-(y.t||0)).slice(-COACH_KEEP)};
  }
  return out;
}
