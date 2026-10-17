/**
 * ŻELAZO — backend synchronizacji (Google Apps Script)
 * =====================================================
 * Przechowuje dane każdego konta osobno we Właściwościach Skryptu
 * (Script Properties). Oba urządzenia używają tego samego URL i tokenu,
 * ale każde swojej nazwy konta (account) — dzięki temu dane się nie mieszają.
 *
 * KONFIGURACJA:
 *  1) Ustawienia projektu (koło zębate) → Właściwości skryptu → dodaj:
 *       SECRET          — własne hasło; to samo wpisujesz w aplikacji jako „Token dostępu".
 *       CLAUDE_API_KEY  — (opcjonalnie) klucz z Claude Platform do szacowania kalorii.
 *     Sekretów NIE wpisuj w kod — ten plik jest w repozytorium.
 *  2) Wdróż → Nowe wdrożenie → Aplikacja internetowa.
 *     Wykonaj jako: Ja.  Kto ma dostęp: Wszyscy.
 *  3) Skopiuj URL kończący się na /exec i wklej w aplikacji.
 */

var PROPS = PropertiesService.getScriptProperties();

// Odczyt właściwości odporny na literówki w nazwie (wielkość liter, spacje)
// i na spacje w wartości wklejonej z menedżera haseł.
function prop(name) {
  var all = PROPS.getProperties();
  for (var k in all) {
    if (k.trim().toUpperCase() === name) return String(all[k]).trim();
  }
  return '';
}

// JEDNORAZOWO: wybierz tę funkcję w edytorze i kliknij „Uruchom".
// Tworzy losowe, długie hasło SECRET i zapisuje je we Właściwościach skryptu.
// Hasło nie trafia do logów — skopiuj je z: Ustawienia projektu → Właściwości skryptu.
// Nie nadpisuje istniejącego SECRET (żeby nie rozłączyć działających urządzeń).
function ustawSecret() {
  if (prop('SECRET')) {
    Logger.log('SECRET już istnieje — nic nie zmieniam. Aby wygenerować nowy, najpierw usuń go w Ustawieniach projektu.');
    return;
  }
  var s = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').slice(0, 40);
  PROPS.setProperty('SECRET', s);
  Logger.log('Gotowe. SECRET zapisany (40 znaków). Skopiuj go z: Ustawienia projektu → Właściwości skryptu.');
}

// Hasło synchronizacji — z Właściwości skryptu. Bez niego każde żądanie jest odrzucane.
var SECRET = prop('SECRET');

// Klucz API z Claude Platform (do szacowania kalorii z opisu posiłku).
// Brak właściwości = funkcja wyłączona. Klucz NIE trafia do aplikacji ani przeglądarki.
var CLAUDE_API_KEY = prop('CLAUDE_API_KEY');
var CLAUDE_MODEL   = 'claude-sonnet-4-6';     // model do szacowania

// ---- wejście HTTP (aplikacja wywołuje POST z text/plain) ----
function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents || '{}');
    if (!SECRET) {
      // same nazwy (bez wartości, bez danych kont) — żeby było widać, co skrypt faktycznie ma
      var names = PROPS.getKeys().filter(function (k) { return k.indexOf('acct_') !== 0; });
      return out({ ok: false, error: 'Brak SECRET we Właściwościach skryptu. Widzę: ' +
        (names.length ? names.join(', ') : '(brak właściwości — sprawdź, czy to ten sam projekt)') });
    }
    if (req.token !== SECRET) return out({ ok: false, error: 'Zły token' });
    var account = (req.account || '').toString().trim().toLowerCase();
    if (!account && req.action !== 'ping') return out({ ok: false, error: 'Brak nazwy konta' });

    if (req.action === 'ping') {
      return out({ ok: true, pong: true });
    }
    if (req.action === 'estimate') {
      return out(estimateMeal(req.desc || ''));
    }
    if (req.action === 'pull') {
      return out({ ok: true, data: read(account) });
    }
    if (req.action === 'push') {
      // scal przychodzący stan z tym, co już mamy (ochrona przed wyścigiem 2 urządzeń)
      var current = read(account);
      var merged = current ? mergeState(current, req.data) : req.data;
      write(account, merged);
      return out({ ok: true, data: merged });
    }
    return out({ ok: false, error: 'Nieznana akcja' });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

// GET tylko po to, by dało się otworzyć URL w przeglądarce i sprawdzić, że żyje
function doGet() {
  return out({ ok: true, hello: 'ZELAZO sync dziala' });
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---- szacowanie kalorii i makro z opisu posiłku (Claude API) ----
function estimateMeal(desc) {
  if (!CLAUDE_API_KEY) return { ok: false, error: 'Brak klucza API w skrypcie' };
  if (!desc) return { ok: false, error: 'Pusty opis' };
  var prompt =
    'Oszacuj wartości odżywcze posiłku opisanego przez użytkownika. ' +
    'Zwróć WYŁĄCZNIE obiekt JSON bez komentarzy, w formacie: ' +
    '{"kcal":liczba,"p":liczba,"c":liczba,"f":liczba} ' +
    'gdzie kcal to kalorie, p=białko(g), c=węglowodany(g), f=tłuszcz(g), wszystko jako liczby całkowite. ' +
    'Jeśli podano ilości/gramatury, użyj ich; jeśli nie, przyjmij typową porcję. ' +
    'Opis posiłku: "' + desc + '"';
  var payload = {
    model: CLAUDE_MODEL,
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }]
  };
  var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': CLAUDE_API_KEY, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  if (code !== 200) return { ok: false, error: 'API ' + code + ': ' + res.getContentText().slice(0, 200) };
  var data = JSON.parse(res.getContentText());
  var text = '';
  (data.content || []).forEach(function (b) { if (b.type === 'text') text += b.text; });
  var m = text.match(/\{[\s\S]*\}/);
  if (!m) return { ok: false, error: 'Model nie zwrócił JSON' };
  var vals = JSON.parse(m[0]);
  return {
    ok: true,
    kcal: Math.round(vals.kcal || 0),
    p: Math.round(vals.p || 0),
    c: Math.round(vals.c || 0),
    f: Math.round(vals.f || 0)
  };
}

// ---- magazyn: Script Properties, klucz per konto ----
function read(account) {
  var raw = PropertiesService.getScriptProperties().getProperty('acct_' + account);
  return raw ? JSON.parse(raw) : null;
}
function write(account, data) {
  PropertiesService.getScriptProperties().setProperty('acct_' + account, JSON.stringify(data));
}

// ============================================================
// Ta sama logika scalania co w aplikacji (nic nie ginie przy
// równoczesnym zapisie z dwóch urządzeń).
// ============================================================
function mergeState(local, inc){
  var out=JSON.parse(JSON.stringify(local));
  if(!inc) return out;

  out.log=out.log||{};
  var days={};
  Object.keys(local.log||{}).forEach(function(k){days[k]=1;});
  Object.keys(inc.log||{}).forEach(function(k){days[k]=1;});
  Object.keys(days).forEach(function(iso){
    var a=(local.log&&local.log[iso])||null;
    var b=(inc.log&&inc.log[iso])||null;
    if(a&&!b){out.log[iso]=a;return;}
    if(b&&!a){out.log[iso]=b;return;}
    var am=a._m||0, bm=b._m||0, bNewer=bm>am;
    var ta=a._t||{}, tb=b._t||{};
    var tAll={};
    var tk={}; Object.keys(ta).forEach(function(f){tk[f]=1;}); Object.keys(tb).forEach(function(f){tk[f]=1;});
    Object.keys(tk).forEach(function(f){ tAll[f]=Math.max(ta[f]||0, tb[f]||0); });
    var m={meals:{},ex:{},habits:{},water:0,_m:Math.max(am,bm),_t:tAll};
    var pick=function(field, va, vb, orFallback){
      var hasA=ta[field]!==undefined, hasB=tb[field]!==undefined;
      if(hasA&&!hasB) return va;
      if(hasB&&!hasA) return vb;
      if(hasA&&hasB){ return (tb[field]>ta[field]) ? vb : (ta[field]>tb[field] ? va : (bNewer?vb:va)); }
      if(orFallback) return va||vb;
      return bNewer?vb:va;
    };
    ['meals','habits'].forEach(function(sec){
      var keys={};
      Object.keys(a[sec]||{}).forEach(function(k){keys[k]=1;});
      Object.keys(b[sec]||{}).forEach(function(k){keys[k]=1;});
      Object.keys(keys).forEach(function(k){
        var field=(sec==='meals'?'meal:':'habit:')+k;
        var va=!!(a[sec]&&a[sec][k]), vb=!!(b[sec]&&b[sec][k]);
        m[sec][k]= (va===vb) ? va : pick(field, va, vb, true);
      });
    });
    (function(){
      var hasA=ta['water']!==undefined, hasB=tb['water']!==undefined;
      if(hasA||hasB) m.water=pick('water', a.water||0, b.water||0, false);
      else m.water=Math.max(a.water||0, b.water||0);
    })();
    if(a.var||b.var){
      m.var={};
      var vk={};
      Object.keys(a.var||{}).forEach(function(k){vk[k]=1;});
      Object.keys(b.var||{}).forEach(function(k){vk[k]=1;});
      Object.keys(vk).forEach(function(k){
        var va=a.var&&a.var[k], vb=b.var&&b.var[k];
        if(va!==undefined&&vb!==undefined) m.var[k]=pick('var:'+k, va, vb, false);
        else m.var[k]=(va!==undefined?va:vb);
      });
    }
    if((a.custom&&a.custom.length)||(b.custom&&b.custom.length)){
      var sig=function(x){return (x.txt||'')+'|'+(x.kcal||0)+'|'+(x.p||0)+'|'+(x.c||0)+'|'+(x.f||0);};
      var map={};
      (a.custom||[]).forEach(function(x){map[sig(x)]=JSON.parse(JSON.stringify(x));});
      (b.custom||[]).forEach(function(x){
        var k=sig(x);
        if(map[k]){
          var e=map[k];
          var et=Math.max(e._t||0,e._del||0), xt=Math.max(x._t||0,x._del||0);
          if(xt>=et){ e.done=x.done; if(x._del)e._del=x._del; else delete e._del; e._t=x._t||e._t; }
        } else map[k]=JSON.parse(JSON.stringify(x));
      });
      m.custom=Object.keys(map).map(function(k){return map[k];});
    }
    var exKeys={};
    Object.keys(a.ex||{}).forEach(function(k){exKeys[k]=1;});
    Object.keys(b.ex||{}).forEach(function(k){exKeys[k]=1;});
    Object.keys(exKeys).forEach(function(k){
      var ea=(a.ex&&a.ex[k]), eb=(b.ex&&b.ex[k]);
      if(typeof ea==='boolean'||typeof eb==='boolean'){ m.ex[k]=pick('ex:'+k, !!ea, !!eb, true); return; }
      var da=!!(ea&&ea.done), db=!!(eb&&eb.done);
      var done = (da===db) ? da : pick('ex:'+k, da, db, true);
      var sets={};
      var sa=(ea&&ea.sets)||{}, sb=(eb&&eb.sets)||{};
      var sKeys={};
      Object.keys(sa).forEach(function(k){sKeys[k]=1;});
      Object.keys(sb).forEach(function(k){sKeys[k]=1;});
      Object.keys(sKeys).forEach(function(sk){
        var va=sa[sk], vb=sb[sk];
        if(va!==undefined&&va!==''&&(vb===undefined||vb===''))sets[sk]=va;
        else if(vb!==undefined&&vb!==''&&(va===undefined||va===''))sets[sk]=vb;
        else if(va!==undefined&&vb!==undefined)sets[sk]= bNewer?vb:va;
        else sets[sk]=va!==undefined?va:vb;
      });
      m.ex[k]={done:done,sets:sets};
    });
    out.log[iso]=m;
  });

  var wmap={};
  (local.weights||[]).forEach(function(w){wmap[w.d]=w.w;});
  (inc.weights||[]).forEach(function(w){wmap[w.d]=w.w;});
  out.weights=Object.keys(wmap).sort().map(function(d){return {d:d,w:wmap[d]};});

  out.shop=JSON.parse(JSON.stringify(local.shop||{}));
  Object.keys(inc.shop||{}).forEach(function(k){ if(inc.shop[k]) out.shop[k]=true; });

  var ls=local._settingsM||0, is=inc._settingsM||0;
  if(is>ls){
    out.startDate=inc.startDate||out.startDate;
    out.reminders=inc.reminders||out.reminders;
    if(inc.kcalGoal) out.kcalGoal=inc.kcalGoal;
    if(inc.profile) out.profile=inc.profile;
    out._settingsM=is;
  }
  return out;
}
