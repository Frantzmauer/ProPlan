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

// ============================================================
// KONTA I ZAPROSZENIA
// SECRET = token administratora (właściciel skryptu). Każdy zaproszony
// dostaje WŁASNY token; serwer trzyma tylko jego skrót SHA-256.
//   user_<konto> = {h, created, lastSeen, disabled}
//   inv_<kod>    = {account, created, expires, reset}
// Dane kont: pliki <konto>.json w folderze na Dysku właściciela.
// ============================================================
var ACCOUNT_RE = /^[a-z0-9][a-z0-9_-]{1,23}$/;
var ACCOUNT_RULE = 'Nazwa konta: 2–24 znaki — małe litery a–z, cyfry, „-” lub „_”.';
var INVITE_DAYS = 7;
var ESTIMATE_PER_DAY = 40;   // limit szacowań kalorii na konto dziennie (koszt idzie z Twojego klucza)

function sha(s) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8));
}
function randToken(n) {
  return (Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').slice(0, n);
}
function getJSON(k) { var v = PROPS.getProperty(k); return v ? JSON.parse(v) : null; }
function setJSON(k, o) { PROPS.setProperty(k, JSON.stringify(o)); }
// porównanie w stałym czasie — nie zdradza, ile znaków tokenu się zgadza
function sameStr(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  var r = 0;
  for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function cleanAccount(s) { return (s || '').toString().trim().toLowerCase(); }
function accountTaken(acc) { return !!(getJSON('user_' + acc) || dataFile(acc, false)); }

function auth(req) {
  var account = cleanAccount(req.account), token = (req.token || '').toString();
  if (!token) return null;
  if (sameStr(token, SECRET)) return { admin: true, account: account };
  if (!account) return null;
  var u = getJSON('user_' + account);
  if (!u || u.disabled || !u.h || !sameStr(sha(token), u.h)) return null;
  return { admin: false, account: account, user: u };
}
function touchUser(acc, u) {
  if (Date.now() - (u.lastSeen || 0) > 10 * 60 * 1000) { u.lastSeen = Date.now(); setJSON('user_' + acc, u); }
}
function rateLimit(acc) {
  var c = CacheService.getScriptCache();
  var k = 'rl_' + acc + '_' + Utilities.formatDate(new Date(), 'Europe/Warsaw', 'yyyyMMdd');
  var n = +(c.get(k) || 0);
  if (n >= ESTIMATE_PER_DAY) return { ok: false, error: 'Dzienny limit szacowań wyczerpany (' + ESTIMATE_PER_DAY + ')' };
  c.put(k, String(n + 1), 24 * 60 * 60);
  return null;
}
function withLock(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

// zaproszony otwiera link → wymienia jednorazowy kod na własny token
function redeem(req) {
  var code = (req.code || '').toString().trim();
  if (!/^[a-zA-Z0-9]{16,64}$/.test(code)) return { ok: false, error: 'Nieprawidłowy link zaproszenia' };
  return withLock(function () {
    var inv = getJSON('inv_' + code);
    if (!inv) return { ok: false, error: 'Zaproszenie nie istnieje albo zostało już użyte' };
    if (Date.now() > inv.expires) { PROPS.deleteProperty('inv_' + code); return { ok: false, error: 'Zaproszenie wygasło — poproś o nowe' }; }
    var acc = cleanAccount(inv.account || req.account);
    if (!ACCOUNT_RE.test(acc)) return { ok: false, error: ACCOUNT_RULE };
    var u = getJSON('user_' + acc);
    if (inv.reset) { if (!u) return { ok: false, error: 'To konto już nie istnieje' }; }
    else if (accountTaken(acc)) return { ok: false, error: 'Ta nazwa konta jest zajęta — wybierz inną' };
    var token = randToken(40);
    u = u || { created: Date.now() };
    u.h = sha(token); u.disabled = false; u.lastSeen = Date.now();
    setJSON('user_' + acc, u);
    PROPS.deleteProperty('inv_' + code);
    return { ok: true, account: acc, token: token };
  });
}

function adminAction(req) {
  var a = req.action, now = Date.now();
  if (a === 'adminList') {
    var users = [], invites = [], all = PROPS.getProperties();
    Object.keys(all).forEach(function (k) {
      if (k.indexOf('user_') === 0) {
        var u = JSON.parse(all[k]);
        users.push({ account: k.slice(5), created: u.created, lastSeen: u.lastSeen || 0, disabled: !!u.disabled, pending: !u.h });
      } else if (k.indexOf('inv_') === 0) {
        var i = JSON.parse(all[k]);
        if (now > i.expires) { PROPS.deleteProperty(k); return; }
        invites.push({ code: k.slice(4), account: i.account || '', expires: i.expires, reset: !!i.reset });
      }
    });
    users.forEach(function (u) { var f = dataFile(u.account, false); u.kb = f ? Math.round(f.size / 1024) : 0; });
    return { ok: true, users: users, invites: invites };
  }
  if (a === 'adminInvite') {
    var acc = cleanAccount(req.name);
    if (acc && !ACCOUNT_RE.test(acc)) return { ok: false, error: ACCOUNT_RULE };
    if (acc && accountTaken(acc)) return { ok: false, error: 'Ta nazwa konta jest zajęta' };
    var code = randToken(24), exp = now + INVITE_DAYS * 864e5;
    setJSON('inv_' + code, { account: acc, created: now, expires: exp });
    return { ok: true, code: code, account: acc, expires: exp };
  }
  if (a === 'adminRevokeInvite') {
    PROPS.deleteProperty('inv_' + (req.code || '').toString().replace(/[^a-zA-Z0-9]/g, ''));
    return { ok: true };
  }
  var target = cleanAccount(req.target), u = getJSON('user_' + target);
  if (!u) return { ok: false, error: 'Nie ma takiego konta' };
  if (a === 'adminDisable' || a === 'adminEnable') {
    u.disabled = (a === 'adminDisable'); setJSON('user_' + target, u);
    return { ok: true };
  }
  if (a === 'adminReset') {
    // stary token przestaje działać od razu; osoba dostaje nowy link na to samo konto (dane zostają)
    u.h = ''; setJSON('user_' + target, u);
    var rc = randToken(24), rexp = now + INVITE_DAYS * 864e5;
    setJSON('inv_' + rc, { account: target, created: now, expires: rexp, reset: true });
    return { ok: true, code: rc, account: target, expires: rexp };
  }
  if (a === 'adminDelete') {
    PROPS.deleteProperty('user_' + target);
    var f = dataFile(target, false);
    if (f) trashFile(f);   // kosz Dysku — da się odzyskać przez 30 dni
    return { ok: true };
  }
  return { ok: false, error: 'Nieznana akcja administratora' };
}

// ---- wejście HTTP (aplikacja wywołuje POST z text/plain) ----
function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents || '{}');
    if (!SECRET) {
      // same nazwy (bez wartości, bez danych kont) — żeby było widać, co skrypt faktycznie ma
      var names = PROPS.getKeys().filter(function (k) { return !/^(acct|user|inv)_/.test(k); });
      return out({ ok: false, error: 'Brak SECRET we Właściwościach skryptu. Widzę: ' +
        (names.length ? names.join(', ') : '(brak właściwości — sprawdź, czy to ten sam projekt)') });
    }
    if (req.action === 'redeem') return out(redeem(req));

    var me = auth(req);
    if (!me) return out({ ok: false, error: 'Zły token' });
    if (req.action === 'ping') return out({ ok: true, pong: true, admin: me.admin });
    if (String(req.action).indexOf('admin') === 0) {
      if (!me.admin) return out({ ok: false, error: 'Brak uprawnień' });
      return out(withLock(function () { return adminAction(req); }));
    }
    if (!me.account) return out({ ok: false, error: 'Brak nazwy konta' });
    if (me.user) touchUser(me.account, me.user);

    if (req.action === 'estimate') {
      var lim = rateLimit(me.account);
      return out(lim || estimateMeal(req.desc || ''));
    }
    if (req.action === 'pull') {
      return out({ ok: true, data: read(me.account) });
    }
    if (req.action === 'push') {
      // scal przychodzący stan z tym, co już mamy (ochrona przed wyścigiem 2 urządzeń)
      return out(withLock(function () {
        var current = read(me.account);
        var merged = current ? mergeState(current, req.data) : req.data;
        write(me.account, merged);
        return { ok: true, data: merged };
      }));
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

// ---- magazyn: pliki <konto>.json w folderze na Dysku właściciela ----
// (Właściwości skryptu mają limit 9 KB na wartość — dziennik z kilku tygodni już się nie mieści.)
// Skrypt ma zakres drive.file: widzi WYŁĄCZNIE pliki, które sam utworzył.
// Wbudowana usługa Dysku w Apps Script wymaga pełnego dostępu, dlatego rozmawiamy z Drive API v3 bezpośrednio.
var DRIVE = 'https://www.googleapis.com/drive/v3/files';
var DRIVE_UP = 'https://www.googleapis.com/upload/drive/v3/files';
function drive(method, url, payload, contentType) {
  var opt = { method: method, muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } };
  if (payload !== undefined) { opt.payload = payload; opt.contentType = contentType || 'application/json'; }
  var r = UrlFetchApp.fetch(url, opt), code = r.getResponseCode();
  if (code === 404) return null;
  if (code >= 300) throw new Error('Dysk ' + code + ': ' + r.getContentText().slice(0, 200));
  return r.getContentText();
}
function dataFolder() {
  var id = PROPS.getProperty('DATA_FOLDER_ID');
  if (id) {
    var meta = drive('get', DRIVE + '/' + id + '?fields=id,trashed');
    if (meta && !JSON.parse(meta).trashed) return id;
  }
  var created = JSON.parse(drive('post', DRIVE + '?fields=id',
    JSON.stringify({ name: 'ZELAZO — dane kont (nie usuwaj)', mimeType: 'application/vnd.google-apps.folder' })));
  PROPS.setProperty('DATA_FOLDER_ID', created.id);
  return created.id;
}
// {id, size} albo null
function dataFile(account, create) {
  var folder = dataFolder();
  var q = "name = '" + account + ".json' and '" + folder + "' in parents and trashed = false";
  var list = JSON.parse(drive('get', DRIVE + '?fields=files(id,size)&q=' + encodeURIComponent(q)));
  if (list.files && list.files.length) return { id: list.files[0].id, size: +list.files[0].size || 0 };
  if (!create) return null;
  var f = JSON.parse(drive('post', DRIVE + '?fields=id',
    JSON.stringify({ name: account + '.json', parents: [folder], mimeType: 'application/json' })));
  return { id: f.id, size: 0 };
}
function trashFile(f) { drive('patch', DRIVE + '/' + f.id, JSON.stringify({ trashed: true })); }
function read(account) {
  var f = dataFile(account, false);
  var data = null;
  if (f) { var txt = drive('get', DRIVE + '/' + f.id + '?alt=media'); data = (txt && txt !== 'null') ? JSON.parse(txt) : null; }
  // migracja: stary zapis we Właściwościach skryptu → plik
  var old = PROPS.getProperty('acct_' + account);
  if (old) {
    data = data ? mergeState(data, JSON.parse(old)) : JSON.parse(old);
    write(account, data);
    PROPS.deleteProperty('acct_' + account);
  }
  return data;
}
function write(account, data) {
  var f = dataFile(account, true);
  drive('patch', DRIVE_UP + '/' + f.id + '?uploadType=media', JSON.stringify(data), 'application/json');
}

// DIAGNOSTYKA: pokazuje, jakie uprawnienia Google faktycznie dał skryptowi (bez samego tokenu).
function sprawdzUprawnienia() {
  var r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' +
    encodeURIComponent(ScriptApp.getOAuthToken()), { muteHttpExceptions: true });
  var info = JSON.parse(r.getContentText());
  Logger.log('Przyznane uprawnienia:\n' + String(info.scope || info.error_description || '?').split(' ').join('\n'));
}

// JEDNORAZOWO po aktualizacji: wybierz w edytorze i kliknij „Uruchom".
// Google poprosi o zgodę na Dysk (tylko pliki tworzone przez ten skrypt),
// a funkcja przeniesie stare dane kont z Właściwości skryptu do plików.
function przygotujDane() {
  dataFolder();
  var moved = [];
  PROPS.getKeys().forEach(function (k) {
    if (k.indexOf('acct_') === 0) { read(k.slice(5)); moved.push(k.slice(5)); }
  });
  Logger.log('Gotowe. Folder danych: „ZELAZO — dane kont (nie usuwaj)” na Twoim Dysku. Przeniesione konta: ' +
    (moved.length ? moved.join(', ') : 'brak (nic do przeniesienia)'));
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

  // obwody (po dacie): nowszy zapis tej samej daty wygrywa
  var mmap={};
  (local.measures||[]).forEach(function(m){mmap[m.d]=m;});
  (inc.measures||[]).forEach(function(m){ var a=mmap[m.d]; if(!a || (m._t||0)>=(a._t||0)) mmap[m.d]=m; });
  out.measures=Object.keys(mmap).sort().map(function(d){return JSON.parse(JSON.stringify(mmap[d]));});

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
