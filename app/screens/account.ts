// SixMo — Konto: logowanie przez Supabase (Google albo kod z e-maila), połączenie konta z zaproszenia, wylogowanie.
// Moduł zawiera tylko deklaracje; kod startowy jest w __init_31, wywoływanym przez main.ts.
// Konto z zaproszenia (token + nazwa) po zalogowaniu zostaje połączone z logowaniem — dane zostają na tym samym koncie,
// a na innym urządzeniu wystarczy się zalogować. Nowe konta bez zaproszenia ruszą z otwarciem rejestracji (etap 4).
import { CLOUD, LS, S, SYNC, __set_CLOUD, __set_S, appChannel, cloudPull, cloudPush, load, refreshAllViews, saveCloud, wipeKeys } from '../core/state';
import { KV_LS, sbSession } from '../core/sb';
import { netDown } from '../core/shell';
import { DEFAULT_SERVER, apiCall } from '../lib/api';
import { t } from '../lib/i18n';
import { exchangeCode, googleUrl, isValidEmail, saveSession, sendEmailCode, signOut, verifyEmailCode, type SbSession } from '../lib/sbauth';
import { legalUrl } from '../features/consent';
import { setAdmin } from './admin';
import { openProfileSetup } from './accounts';
import { loadProfileUI, moreStatus } from './more';
import { cloudAccount, cloudToken, cloudUrl, refreshCloudUI } from './sync-ui';

let sbEmailAddr = '', resendAt = 0, resendTimer = 0;

const el = (id: string) => document.getElementById(id) as HTMLElement;

function msg(id: string, text: string, ok = false){
  const m = el(id);
  m.style.display = text ? 'block' : 'none';
  m.style.color = ok ? 'var(--green)' : 'var(--red)';
  m.textContent = text;
}

// stare konto z zaproszenia na tym urządzeniu, jeszcze bez logowania
const legacyAccount = () => !CLOUD.sb && CLOUD.token && CLOUD.account ? CLOUD.account : '';

export function accountStatus(){
  const s = sbSession();
  if (s && CLOUD.sb) return s.user.email || t('Zalogowano');
  if (legacyAccount()) return t('Połącz konto z Google albo e-mailem');
  return t('Zaloguj się · Google albo e-mail');
}

export function renderAccount(){
  const s = sbSession(), on = !!(s && CLOUD.sb);
  el('accOut').style.display = on ? 'none' : '';
  el('accIn').style.display = on ? '' : 'none';
  const acc = legacyAccount();
  el('accOutH').textContent = acc ? t('Zabezpiecz konto „{a}”', {a: acc}) : t('Zaloguj się');
  el('accOutTxt').textContent = acc
    ? t('Połącz je z Google albo adresem e-mail. Dane zostają na tym samym koncie, a na innym telefonie wystarczy się zalogować — bez tokenu i linku.')
    : t('Bez hasła: przez Google albo jednorazowym kodem z e-maila. Na innym telefonie wystarczy się zalogować — dane przyjdą same.');
  if (on && s) {
    el('accEmail').textContent = s.user.email || '—';
    el('accMethod').textContent = s.user.provider === 'google' ? 'Google' : t('Kod z e-maila');
    el('accName').textContent = CLOUD.account || '—';
  }
}

// ---- po zalogowaniu (Google albo kod): połącz konto z zaproszenia albo wejdź na konto połączone wcześniej ----
async function afterSignIn(s: SbSession){
  saveSession(KV_LS, s);
  const url = CLOUD.url || DEFAULT_SERVER, ch = appChannel(), lang = { lang: (S.profile && S.profile.lang) === 'en' ? 'en' : 'pl' };
  try {
    let account = '', admin = false;
    if (legacyAccount()) {
      const r = await apiCall({ url, token: CLOUD.token, account: CLOUD.account }, ch, 'sbLink', Object.assign({ sb: s.access_token }, lang));
      account = r.account; admin = !!r.admin;
    } else {
      const r = await apiCall({ url, token: '', account: '' }, ch, 'ping', Object.assign({ sb: s.access_token }, lang));
      account = r.account; admin = !!r.admin;
      // inne konto niż ostatnio na tym urządzeniu — cudze dane nie mogą trafić na to konto
      if (CLOUD.account && CLOUD.account !== account) { localStorage.removeItem(LS); __set_S(load()); }
    }
    SYNC.cancel();
    __set_CLOUD({ url, token: '', account, on: true, sb: true, lastSync: 0, lastError: '' });
    saveCloud();
    cloudUrl.value = url; cloudToken.value = ''; cloudAccount.value = account;
    await cloudPull({ silent: true }); cloudPush();
    refreshAllViews(); refreshCloudUI(); loadProfileUI(); setAdmin(admin);
    renderAccount(); moreStatus();
    msg('accMsg', t('✅ Zalogowano. Konto „{a}” jest połączone z {e}.', { a: account, e: s.user.email }), true);
    if (S.profile && S.profile.needsSetup) openProfileSetup();
  } catch (e) {
    // bez konta SixMo albo konflikt — nie zostawiamy półzalogowanego stanu
    await signOut(KV_LS, 'local');
    renderAccount();
    msg('accMsg', netDown(e) ? t('Brak internetu — spróbuj ponownie, gdy wróci zasięg.') : (e as Error).message);
  }
}

// ---- okno: e-mail → kod ----
function sbView(v: 'email' | 'code'){
  document.querySelectorAll<HTMLElement>('#sbDialog [data-sbv]').forEach(x => { x.hidden = x.dataset.sbv !== v; });
  msg('sbMsg', '');
  setTimeout(() => (el(v === 'email' ? 'sbEmail' : 'sbCode') as HTMLInputElement).focus(), 50);
}
function openEmail(){ el('sbDialog').classList.add('show'); sbView('email'); }
function closeEmail(){ el('sbDialog').classList.remove('show'); clearInterval(resendTimer); }

function tickResend(){
  const b = el('sbResend') as HTMLButtonElement, left = Math.ceil((resendAt - Date.now()) / 1000);
  b.disabled = left > 0;
  b.textContent = left > 0 ? t('Wyślij ponownie za {s} s', { s: left }) : t('Wyślij ponownie');
  if (left <= 0) clearInterval(resendTimer);
}

async function sendCode(){
  const inp = el('sbEmail') as HTMLInputElement, email = inp.value.trim().toLowerCase();
  if (!isValidEmail(email)) { msg('sbMsg', t('Wpisz poprawny adres e-mail.')); inp.focus(); return; }
  const b = el('sbSend') as HTMLButtonElement; b.disabled = true;
  try {
    await sendEmailCode(email);
    sbEmailAddr = email; el('sbEmailShow').textContent = email;
    (el('sbCode') as HTMLInputElement).value = ''; (el('sbVerify') as HTMLButtonElement).disabled = true;
    sbView('code');
    resendAt = Date.now() + 60000; clearInterval(resendTimer); resendTimer = window.setInterval(tickResend, 1000); tickResend();
  } catch (e) {
    msg('sbMsg', netDown(e) ? t('Brak internetu.') : /rate|seconds/i.test((e as Error).message) ? t('Za dużo prób — odczekaj chwilę i spróbuj ponownie.') : t('Nie udało się wysłać kodu: ') + (e as Error).message);
  }
  b.disabled = false;
}

async function verifyCode(){
  const code = (el('sbCode') as HTMLInputElement).value.replace(/\D/g, '');
  if (code.length !== 6) return;
  const b = el('sbVerify') as HTMLButtonElement; b.disabled = true; b.textContent = t('⏳ Sprawdzam…');
  try {
    const s = await verifyEmailCode(sbEmailAddr, code);
    closeEmail();
    await afterSignIn(s);
  } catch (e) {
    msg('sbMsg', netDown(e) ? t('Brak internetu.') : t('Kod jest nieprawidłowy albo wygasł. Sprawdź go albo wyślij nowy.'));
  }
  b.disabled = false; b.textContent = t('Zaloguj');
}

async function google(){
  try { location.href = await googleUrl(location.origin + location.pathname, KV_LS); }
  catch (e) { msg('accMsg', (e as Error).message); }
}

// powrót z Google: ?code=… (albo błąd) w adresie
async function handleRedirect(){
  const q = new URLSearchParams(location.search), h = new URLSearchParams(location.hash.slice(1));
  const code = q.get('code'), err = q.get('error_description') || h.get('error_description');
  if (!code && !err) return;
  history.replaceState(null, '', location.pathname);
  openAccount();
  if (err) { msg('accMsg', t('Logowanie przerwane: ') + err); return; }
  try { await afterSignIn(await exchangeCode(code as string, KV_LS)); }
  catch (e) { msg('accMsg', netDown(e) ? t('Brak internetu — spróbuj ponownie.') : t('Logowanie nie powiodło się: ') + (e as Error).message); }
}

function openAccount(){
  document.querySelector<HTMLElement>('.nav button[data-v="set"]')?.click();
  document.querySelector<HTMLElement>('[data-more="acc"]')?.click();
}

// ---- wylogowanie: najpierw zapis na koncie, potem dane znikają z tego urządzenia ----
async function logout(){
  if (!confirm(t('Wylogować? Dane zapiszą się na koncie, a z tego urządzenia zostaną usunięte (także te zapisane tylko na telefonie, np. cykl bez synchronizacji).'))) return;
  const b = el('accLogout') as HTMLButtonElement; b.disabled = true;
  let r = await cloudPush();
  for (let i = 0; i < 5 && !r.ok && r.skipped === 'off' && CLOUD.on; i++) { await new Promise(res => setTimeout(res, 800)); r = await cloudPush(); }   // trwa inna wysyłka
  if (!r.ok && !r.skipped) {
    b.disabled = false;
    msg('accMsg', r.offline ? t('Brak internetu — wyloguj się, gdy wróci zasięg, żeby nie stracić ostatnich zmian.') : t('Nie udało się zapisać danych na koncie: ') + (r.error || ''));
    return;
  }
  await signOut(KV_LS, 'local');
  wipeKeys();
  location.reload();
}

async function logoutOthers(){
  const b = el('accLogoutAll') as HTMLButtonElement; b.disabled = true;
  try { await signOut(KV_LS, 'others'); msg('accMsg', t('✅ Wylogowano z pozostałych urządzeń. Mogą działać jeszcze do godziny.'), true); }
  catch (e) { msg('accMsg', netDown(e) ? t('Brak internetu.') : (e as Error).message); }
  b.disabled = false;
}

export function __init_31(){
  document.querySelectorAll<HTMLAnchorElement>('#accOut [data-legal]').forEach(a => { a.href = legalUrl(a.dataset.legal as 'terms' | 'privacy'); });
  el('accGoogle').onclick = google;
  el('accEmailBtn').onclick = openEmail;
  el('accLogout').onclick = logout;
  el('accLogoutAll').onclick = logoutOthers;
  el('sbSend').onclick = sendCode;
  el('sbVerify').onclick = verifyCode;
  el('sbResend').onclick = () => { sbView('email'); sendCode(); };
  el('sbBack').onclick = () => sbView('email');
  document.querySelectorAll<HTMLElement>('#sbDialog [data-sb-close]').forEach(b => { b.onclick = closeEmail; });
  (el('sbEmail') as HTMLInputElement).addEventListener('keydown', e => { if (e.key === 'Enter') sendCode(); });
  const ci = el('sbCode') as HTMLInputElement;
  ci.addEventListener('input', () => {
    ci.value = ci.value.replace(/\D/g, '').slice(0, 6);
    (el('sbVerify') as HTMLButtonElement).disabled = ci.value.length !== 6;
    if (ci.value.length === 6) verifyCode();
  });
  renderAccount();
  handleRedirect();
  // konto z logowaniem, ale sesja skończona (np. „Wyloguj ze wszystkich urządzeń” na innym telefonie) — poproś o logowanie
  if (CLOUD.sb && !sbSession()) msg('accMsg', t('Sesja wygasła — zaloguj się ponownie, żeby synchronizować dane.'));
}
