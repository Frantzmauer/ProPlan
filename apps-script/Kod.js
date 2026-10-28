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
    // „Claude API key”, „claude-api-key ” itp. też pasują do CLAUDE_API_KEY
    if (k.toUpperCase().replace(/[^A-Z0-9]/g, '') === name.replace(/[^A-Z0-9]/g, '')) return String(all[k]).trim().replace(/^['"]+|['"]+$/g, '');
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

// Hasło administratora (SECRET) czytamy przy każdym żądaniu — patrz auth(); bez niego każde żądanie jest odrzucane.

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
var COACH_PER_DAY = 30;      // limit wiadomości do Trenera AI na konto dziennie

// same NAZWY właściwości (bez wartości, bez danych kont i zaproszeń) — do diagnozy literówek
function propNames() {
  var n = PROPS.getKeys().filter(function (k) { return !/^(acct|user|inv|use)_/.test(k) && k !== 'DATA_FOLDER_ID'; });
  return 'Skrypt widzi właściwości: ' + (n.length ? n.join(', ') : '(żadnych)') + '.';
}
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
  if (sameStr(token, prop('SECRET'))) return { admin: true, account: account };
  if (!account) return null;
  var u = getJSON('user_' + account);
  if (!u || u.disabled || !u.h || !sameStr(sha(token), u.h)) return null;
  return { admin: false, account: account, user: u };
}
function touchUser(acc, u) {
  if (Date.now() - (u.lastSeen || 0) > 10 * 60 * 1000) { u.lastSeen = Date.now(); setJSON('user_' + acc, u); }
}
function rateLimit(acc, kind, max, label) {
  var c = CacheService.getScriptCache();
  var k = 'rl_' + kind + '_' + acc + '_' + Utilities.formatDate(new Date(), 'Europe/Warsaw', 'yyyyMMdd');
  var n = +(c.get(k) || 0);
  if (n >= max) return { ok: false, error: 'Dzienny limit ' + label + ' wyczerpany (' + max + '). Wróć jutro.' };
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
    if (inv.reset) { if (!u && !dataFile(acc, false)) return { ok: false, error: 'To konto już nie istnieje' }; }
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
    users.forEach(function (u) { var f = dataFile(u.account, false); u.kb = f ? Math.round(f.size / 1024) : 0; u.usage = usageView(u.account); });
    // konta sprzed zaproszeń: mają plik z danymi, ale nie mają własnego tokenu (używały SECRET)
    var known = {}; users.forEach(function (u) { known[u.account] = 1; });
    var me = cleanAccount(req.account);
    listDataFiles().forEach(function (f) {
      var acc = f.name.replace(/\.json$/, '');
      if (!known[acc] && acc !== me) users.push({ account: acc, created: 0, lastSeen: 0, disabled: false, legacy: true, kb: Math.round(f.size / 1024) });
    });
    users.forEach(function (u) { if (!u.usage) u.usage = usageView(u.account); });
    var mine = usageView(me), total = mine.usd, totalAll = mine.all;
    users.forEach(function (u) { total += u.usage.usd; totalAll += u.usage.all; });
    return { ok: true, users: users, invites: invites, myUsage: mine, totalUsd: total, totalAllUsd: totalAll };
  }
  if (a === 'adminInvite') {
    var acc = cleanAccount(req.name);
    if (acc && !ACCOUNT_RE.test(acc)) return { ok: false, error: ACCOUNT_RULE };
    if (acc && accountTaken(acc)) return { ok: false, error: 'Ta nazwa konta jest zajęta' };
    var code = randToken(24), exp = now + INVITE_DAYS * 864e5;
    setJSON('inv_' + code, { account: acc, created: now, expires: exp });
    return { ok: true, code: code, account: acc, expires: exp };
  }
  if (a === 'adminRotateSecret') {
    // nowy token administratora; stary przestaje działać od razu (wszystkie urządzenia admina muszą dostać nowy)
    var ns = randToken(40);
    PROPS.setProperty('SECRET', ns);
    return { ok: true, token: ns };
  }
  if (a === 'adminRevokeInvite') {
    PROPS.deleteProperty('inv_' + (req.code || '').toString().replace(/[^a-zA-Z0-9]/g, ''));
    return { ok: true };
  }
  var target = cleanAccount(req.target), u = getJSON('user_' + target);
  // stare konto (tylko plik danych) — wolno mu wysłać link, który nada własny token
  if (!u && a === 'adminReset' && ACCOUNT_RE.test(target) && dataFile(target, false)) u = { created: Date.now() };
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
    PROPS.deleteProperty('use_' + target);
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
    if (!prop('SECRET')) {
      // same nazwy (bez wartości, bez danych kont) — żeby było widać, co skrypt faktycznie ma
      var names = PROPS.getKeys().filter(function (k) { return !/^(acct|user|inv|use)_/.test(k); });
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
      var lim = rateLimit(me.account, 'est', ESTIMATE_PER_DAY, 'szacowań');
      return out(lim || estimateMeal(req.desc || '', me.account));
    }
    if (req.action === 'usage') {
      return out({ ok: true, usage: usageView(me.account) });
    }
    if (req.action === 'coach') {
      var limc = rateLimit(me.account, 'coach', COACH_PER_DAY, 'pytań do Trenera');
      return out(limc || coachReply(req, me.account));
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

// ============================================================
// ZUŻYCIE API per konto (szacunek z liczby tokenów × cennik; faktyczny rachunek: console.anthropic.com)
//   use_<konto> = {m:'RRRR-MM', usd, n, coach, est, tin, tout, all, prev:{m, usd, n}}
// ============================================================
var PRICES = {   // $ za 1 mln tokenów: [wejście, wyjście]
  'claude-opus-5': [5, 25], 'claude-opus-5-5': [4, 20], 'claude-opus-4-8': [5, 25], 'claude-opus-4-7': [5, 25],
  'claude-sonnet-5': [2, 10], 'claude-sonnet-4-6': [3, 15], 'claude-haiku-4-5': [1, 5]
};
function costUSD(model, u) {
  var p = PRICES[String(model || '').replace(/-\d{8}$/, '')] || [5, 25];   // nieznany model → stawka Opus (ostrożnie)
  return ((u.input_tokens || 0) * p[0] + (u.cache_creation_input_tokens || 0) * p[0] * 1.25 +
          (u.cache_read_input_tokens || 0) * p[0] * 0.1 + (u.output_tokens || 0) * p[1]) / 1e6;
}
function recordUsage(acc, kind, model, u) {
  if (!acc || !u) return;
  try {
    withLock(function () {
      var k = 'use_' + acc, r = getJSON(k) || {};
      var m = Utilities.formatDate(new Date(), 'Europe/Warsaw', 'yyyy-MM');
      if (r.m !== m) {   // nowy miesiąc: poprzedni zostaje jako „prev”
        if (r.m) r.prev = { m: r.m, usd: r.usd || 0, n: r.n || 0 };
        r.m = m; r.usd = 0; r.n = 0; r.coach = 0; r.est = 0; r.tin = 0; r.tout = 0;
      }
      var c = costUSD(model, u);
      r.usd += c; r.all = (r.all || 0) + c; r.n += 1; r[kind] = (r[kind] || 0) + 1;
      r.tin += (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
      r.tout += (u.output_tokens || 0);
      setJSON(k, r);
    });
  } catch (e) { /* licznik nie może zablokować odpowiedzi */ }
}
function usageView(acc) {
  var r = getJSON('use_' + acc);
  var m = Utilities.formatDate(new Date(), 'Europe/Warsaw', 'yyyy-MM');
  if (!r) return { m: m, usd: 0, n: 0, coach: 0, est: 0, all: 0, prev: null };
  if (r.m !== m) return { m: m, usd: 0, n: 0, coach: 0, est: 0, all: r.all || 0, prev: { m: r.m, usd: r.usd || 0, n: r.n || 0 } };
  return { m: r.m, usd: r.usd || 0, n: r.n || 0, coach: r.coach || 0, est: r.est || 0, all: r.all || 0, prev: r.prev || null };
}

// ============================================================
// TRENER AI („Zapytaj Trenera”) — Claude przez ten serwer; klucz nigdy nie trafia do przeglądarki.
// Aplikacja wysyła zwięzłe podsumowanie danych użytkownika (tylko jego własnych) + historię rozmowy.
// ============================================================
var COACH_MODEL = 'claude-opus-5';
var COACH_SYSTEM = [
  'Jesteś Trenerem w aplikacji ŻELAZO — doświadczonym trenerem personalnym i dietetykiem sportowym.',
  'Rozmawiasz po polsku, bezpośrednio, ciepło i konkretnie, jak dobry trener na siłowni. Mów do użytkownika po imieniu, jeśli je znasz.',
  '',
  'Masz poniżej DANE UŻYTKOWNIKA z aplikacji: profil, cel kalorii i makro, plan treningowy, zapis treningów (ciężary × powtórzenia), wagę, obwody, realizację diety, wodę i nawyki. Opieraj rady na tych danych i cytuj konkretne liczby (daty, ciężary, kg). Nie wymyślaj danych, których nie ma. Jeśli czegoś brakuje albo zapis ma luki (np. dni bez wpisów), powiedz to wprost i zapytaj — luka w zapisie nie zawsze oznacza brak treningu.',
  '',
  'Jak odpowiadać:',
  '- Najpierw krótka odpowiedź na pytanie, potem 2–5 konkretnych kroków. Zwykle do ~200 słów; dłużej tylko, gdy użytkownik prosi o plan lub szczegóły.',
  '- Zmiany w treningu podawaj tak, by dało się je od razu zastosować: ćwiczenie, serie × powtórzenia, ciężar lub sposób doboru (RIR).',
  '- Formatowanie: krótkie akapity, listy z „- ”, pogrubienia **tak**. Bez tabel i nagłówków.',
  '',
  'Bezpieczeństwo:',
  '- Nie jesteś lekarzem. Ból w klatce piersiowej, duszność, omdlenia, ostry ból stawu, objawy kontuzji → przerwij trening i skontaktuj się z lekarzem lub fizjoterapeutą (przy ostrych objawach: 112).',
  '- Suplementy: tylko te z mocnymi dowodami (kreatyna monohydrat, witamina D przy niedoborze, białko w proszku, omega-3, kofeina), z dawkami i zastrzeżeniem, by przy chorobach przewlekłych, lekach lub ciąży skonsultować je z lekarzem. Nie doradzaj sterydów, SARM-ów, „spalaczy” ani leków na odchudzanie — wyjaśnij krótko ryzyko i wróć do podstaw.',
  '- Redukcja: bezpieczne tempo to ok. 0,5–1% masy ciała tygodniowo; nie schodź z kaloriami poniżej podstawowej przemiany materii bez nadzoru specjalisty. Zauważasz sygnały zaburzeń odżywiania → odpowiedz z troską i zasugeruj wsparcie specjalisty.',
  '- Dane osobowe: widzisz tylko dane tego jednego użytkownika — nie pytaj o dane innych osób.',
  '',
  'Zmiany w planie:',
  '- Gdy proponujesz KONKRETNE zmiany ciężaru, liczby serii lub powtórzeń w ćwiczeniach z planu albo zmianę dziennego celu kalorii, wywołaj dodatkowo narzędzie zaproponuj_zmiany. Użytkownik zobaczy je jako kartę z przyciskiem „Zastosuj od dziś” — nic nie zmienia się bez jego zgody.',
  '- Używaj dokładnych nazw ćwiczeń z planu. Podawaj realne ciężary (sztanga co 2,5 kg, hantle co 1–2 kg, maszyny co 5 kg). Zmiany kalorii trzymaj w bezpiecznym zakresie (nie niżej niż szacowana podstawowa przemiana materii).',
  '- Wymiana ćwiczenia (zamiany_cwiczen): gdy coś boli, brakuje sprzętu albo ćwiczenie nie służy celowi. Podaj nazwę nowego ćwiczenia po polsku, serie, powtórzenia, ciężar startowy (0 = dobierz) i 1–2 zdania techniki. Przy bólu wybieraj warianty odciążające staw, a ból ostry lub narastający kieruj do fizjoterapeuty.',
  '- Zmiana posiłku (posilki): zastępuje posiłek z jadłospisu w wybrane dni tygodnia (pusta lista dni = codziennie). Podaj konkretny skład z gramaturami i realne kcal oraz makro; reszta dnia przeskaluje się tak, by dzień nadal trzymał cel kalorii. Szanuj to, co użytkownik lubi i je.',
  '- Nie wywołuj narzędzia przy ogólnych radach ani gdy użytkownik tylko pyta o opinię — wtedy wystarczy tekst. W tekście krótko wyjaśnij, co proponujesz i dlaczego.'
].join('\n');
var MEAL_SLOTS = ['Śniadanie', 'Przekąska', 'Obiad', 'Po treningu', 'Kolacja'];
var COACH_MAX_CONTEXT = 16000, COACH_MAX_TURNS = 16, COACH_MAX_MSG = 4000;

function coachReply(req, acc) {
  if (!CLAUDE_API_KEY) return { ok: false, error: 'Trener niedostępny: brak klucza CLAUDE_API_KEY w skrypcie. ' + propNames() };
  var ctx = String(req.context || '').slice(0, COACH_MAX_CONTEXT);
  var hist = Array.isArray(req.messages) ? req.messages.slice(-COACH_MAX_TURNS) : [];
  var messages = [];
  hist.forEach(function (m) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) return;
    var t = String(m.content || '').slice(0, COACH_MAX_MSG).trim();
    if (!t) return;
    // API wymaga naprzemienności ról — sklej kolejne wiadomości tej samej roli
    var last = messages[messages.length - 1];
    if (last && last.role === m.role) last.content += '\n\n' + t; else messages.push({ role: m.role, content: t });
  });
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== 'user') return { ok: false, error: 'Brak pytania' };

  // nazwy ćwiczeń z planu (z aplikacji) — narzędzie może zmieniać tylko istniejące ćwiczenia
  var names = (Array.isArray(req.exercises) ? req.exercises : []).map(function (n) { return String(n).slice(0, 80); })
    .filter(function (n, i, a) { return n && a.indexOf(n) === i; }).slice(0, 60);
  var exItem = { type: 'object', additionalProperties: false, required: ['nazwa', 'ciezar_kg', 'serie', 'powtorzenia'],
    properties: {
      nazwa: names.length ? { type: 'string', enum: names } : { type: 'string' },
      ciezar_kg: { type: 'number', description: 'Ciężar na serię w kg (na rękę przy hantlach); 0 = masa ciała / bez zmiany ciężaru' },
      serie: { type: 'integer', description: 'Liczba serii (1–8)' },
      powtorzenia: { type: 'integer', description: 'Docelowe powtórzenia na serię (przy ćwiczeniach na czas: sekundy)' }
    } };
  var swapItem = { type: 'object', additionalProperties: false, required: ['z', 'na', 'serie', 'powtorzenia', 'ciezar_kg', 'technika'],
    properties: {
      z: names.length ? { type: 'string', enum: names } : { type: 'string' },
      na: { type: 'string', description: 'Nazwa nowego ćwiczenia po polsku, np. „Przysiad bułgarski z hantlami”' },
      serie: { type: 'integer' }, powtorzenia: { type: 'integer' },
      ciezar_kg: { type: 'number', description: 'Ciężar startowy w kg (na rękę przy hantlach); 0 = dobierz na pierwszym treningu' },
      technika: { type: 'string', description: '1–2 zdania: jak wykonać i na co uważać' }
    } };
  var mealItem = { type: 'object', additionalProperties: false, required: ['posilek', 'dni', 'opis', 'kcal', 'bialko_g', 'wegle_g', 'tluszcz_g'],
    properties: {
      posilek: { type: 'string', enum: MEAL_SLOTS },
      dni: { type: 'array', items: { type: 'integer' }, description: 'Dni tygodnia 0=niedziela…6=sobota; pusta lista = codziennie' },
      opis: { type: 'string', description: 'Skład z gramaturami, np. „Owsianka: 80 g płatków, 30 g WPC, banan, 15 g orzechów”' },
      kcal: { type: 'integer' }, bialko_g: { type: 'integer' }, wegle_g: { type: 'integer' }, tluszcz_g: { type: 'integer' }
    } };
  var tool = {
    name: 'zaproponuj_zmiany',
    description: 'Proponuje użytkownikowi konkretne zmiany w planie: ciężary/serie/powtórzenia ćwiczeń z planu, wymianę ćwiczenia na inne, zamianę posiłku z jadłospisu oraz opcjonalnie nowy dzienny cel kalorii. Użytkownik akceptuje je przyciskiem w aplikacji; obowiązują od dnia akceptacji. Nieużywane listy zostaw puste.',
    strict: true,
    input_schema: { type: 'object', additionalProperties: false, required: ['podsumowanie', 'cwiczenia', 'zamiany_cwiczen', 'posilki', 'cel_kcal'],
      properties: {
        podsumowanie: { type: 'string', description: 'Jedno zdanie: co się zmienia i po co' },
        cwiczenia: { type: 'array', items: exItem, description: 'Zmienione ciężary/serie/powtórzenia; pusta lista, jeśli bez zmian' },
        zamiany_cwiczen: { type: 'array', items: swapItem, description: 'Ćwiczenia zastąpione innymi; pusta lista, jeśli bez zmian' },
        posilki: { type: 'array', items: mealItem, description: 'Posiłki zastąpione innymi; pusta lista, jeśli bez zmian' },
        cel_kcal: { type: 'integer', description: 'Nowy dzienny cel kcal albo 0, jeśli bez zmiany' }
      } }
  };

  var payload = {
    model: COACH_MODEL,
    tools: [tool],
    max_tokens: 8000,
    output_config: { effort: 'low' },   // rozmowa: niski effort = szybciej i taniej, jakość wystarcza
    fallbacks: 'default',               // odmowa klasyfikatora → serwer sam ponawia na zalecanym modelu
    system: [
      { type: 'text', text: COACH_SYSTEM },
      // dane użytkownika w cache: kolejne pytania w tej samej rozmowie czytają je taniej
      { type: 'text', text: 'DANE UŻYTKOWNIKA (z aplikacji, stan na dziś):\n' + ctx, cache_control: { type: 'ephemeral' } }
    ],
    messages: messages
  };
  var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-api-key': CLAUDE_API_KEY, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'server-side-fallback-2026-07-01' },
    payload: JSON.stringify(payload)
  });
  var code = res.getResponseCode();
  if (code === 429 || code === 529) return { ok: false, error: 'Trener jest teraz przeciążony — spróbuj za chwilę' };
  if (code !== 200) return { ok: false, error: 'API ' + code + ': ' + res.getContentText().slice(0, 200) };
  var data = JSON.parse(res.getContentText());
  recordUsage(acc, 'coach', data.model || COACH_MODEL, data.usage);
  if (data.stop_reason === 'refusal') return { ok: false, error: 'Trener nie może odpowiedzieć na to pytanie. Spróbuj sformułować je inaczej.' };
  var text = '', proposal = null;
  (data.content || []).forEach(function (b) {
    if (b.type === 'text') text += b.text;
    if (b.type === 'tool_use' && b.name === 'zaproponuj_zmiany' && b.input) proposal = cleanProposal(b.input, names);
  });
  if (!text.trim() && proposal) text = proposal.podsumowanie;
  if (!text.trim()) return { ok: false, error: 'Trener nie zwrócił odpowiedzi — spróbuj ponownie' };
  if (data.stop_reason === 'max_tokens') text += '\n\n_(odpowiedź ucięta — dopytaj o resztę)_';
  return { ok: true, text: text.trim(), proposal: proposal };
}
// granice bezpieczeństwa niezależnie od modelu: tylko ćwiczenia z planu, realne liczby
function cleanProposal(p, names) {
  var ex = (Array.isArray(p.cwiczenia) ? p.cwiczenia : []).filter(function (e) {
    return e && (!names.length || names.indexOf(e.nazwa) >= 0);
  }).map(function (e) {
    return { nazwa: String(e.nazwa), ciezar_kg: Math.max(0, Math.min(400, Math.round((+e.ciezar_kg || 0) * 2) / 2)),
      serie: Math.max(1, Math.min(8, Math.round(+e.serie || 1))), powtorzenia: Math.max(1, Math.min(120, Math.round(+e.powtorzenia || 1))) };
  }).slice(0, 20);
  var clampI = function (v, lo, hi) { return Math.max(lo, Math.min(hi, Math.round(+v || 0))); };
  var swaps = (Array.isArray(p.zamiany_cwiczen) ? p.zamiany_cwiczen : []).filter(function (z) {
    return z && (!names.length || names.indexOf(z.z) >= 0) && String(z.na || '').trim();
  }).map(function (z) {
    return { z: String(z.z), na: String(z.na).trim().slice(0, 60), serie: clampI(z.serie, 1, 8), powtorzenia: clampI(z.powtorzenia, 1, 120),
      ciezar_kg: Math.max(0, Math.min(400, Math.round((+z.ciezar_kg || 0) * 2) / 2)), technika: String(z.technika || '').slice(0, 300) };
  }).slice(0, 10);
  var meals = (Array.isArray(p.posilki) ? p.posilki : []).filter(function (m) {
    return m && MEAL_SLOTS.indexOf(m.posilek) >= 0 && String(m.opis || '').trim();
  }).map(function (m) {
    var dni = (Array.isArray(m.dni) ? m.dni : []).map(Number).filter(function (d, i, a) { return d >= 0 && d <= 6 && a.indexOf(d) === i; });
    return { posilek: m.posilek, dni: dni.length === 7 ? [] : dni, opis: String(m.opis).trim().slice(0, 240),
      kcal: clampI(m.kcal, 50, 1500), bialko_g: clampI(m.bialko_g, 0, 200), wegle_g: clampI(m.wegle_g, 0, 300), tluszcz_g: clampI(m.tluszcz_g, 0, 150) };
  }).slice(0, 10);
  var kcal = Math.round(+p.cel_kcal || 0);
  kcal = kcal ? Math.max(1200, Math.min(4500, kcal)) : 0;
  if (!ex.length && !swaps.length && !meals.length && !kcal) return null;
  return { podsumowanie: String(p.podsumowanie || '').slice(0, 300), cwiczenia: ex, zamiany_cwiczen: swaps, posilki: meals, cel_kcal: kcal };
}

// ---- szacowanie kalorii i makro z opisu posiłku (Claude API) ----
function estimateMeal(desc, acc) {
  if (!CLAUDE_API_KEY) return { ok: false, error: 'Brak klucza CLAUDE_API_KEY w skrypcie. ' + propNames() };
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
  recordUsage(acc, 'est', data.model || CLAUDE_MODEL, data.usage);
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
function listDataFiles() {
  var q = "'" + dataFolder() + "' in parents and trashed = false";
  var r = JSON.parse(drive('get', DRIVE + '?pageSize=1000&fields=files(name,size)&q=' + encodeURIComponent(q)));
  return (r.files || []).map(function (f) { return { name: f.name, size: +f.size || 0 }; });
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
      // „Pomiń” wg własnego znacznika; zaliczone ćwiczenie nigdy nie jest pominięte
      var ka=!!(ea&&ea.skip), kb=!!(eb&&eb.skip);
      var skip = (ka===kb) ? ka : pick('skip:'+k, ka, kb, true);
      m.ex[k]={done:done,sets:sets};
      if(skip && !done) m.ex[k].skip=true;
      // odhaczone serie: każda wg własnego znacznika („ok:<klucz>:<seria>”)
      if((ea&&ea.ok)||(eb&&eb.ok)){
        var oa=(ea&&ea.ok)||{}, ob=(eb&&eb.ok)||{}, ok={}, oKeys={};
        Object.keys(oa).forEach(function(s){oKeys[s]=1;});
        Object.keys(ob).forEach(function(s){oKeys[s]=1;});
        Object.keys(oKeys).forEach(function(s){
          var va=!!oa[s], vb=!!ob[s];
          if((va===vb) ? va : pick('ok:'+k+':'+s, va, vb, true)) ok[s]=true;
        });
        m.ex[k].ok=ok;
      }
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
    if(inc.adj) out.adj=inc.adj;   // zmiany planu zaakceptowane od Trenera
    out._settingsM=is;
  }
  return out;
}
