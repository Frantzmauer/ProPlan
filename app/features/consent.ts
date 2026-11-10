// SixMo — Zgody: akceptacja Regulaminu i Polityki prywatności oraz wyraźna zgoda na dane o zdrowiu (RODO art. 9).
// Okno przy pierwszym uruchomieniu i po każdej zmianie wersji dokumentów (LEGAL_V). Zapis w profilu (S.profile.consent),
// więc synchronizuje się z serwerem jako dowód zgody: {v: wersja dokumentów, terms: kiedy, health: kiedy}.
// Wycofanie zgody na dane o zdrowiu: Więcej → Regulamin i polityka prywatności — aplikacja wraca do okna zgód.
import { S, appChannel, save } from '../core/state';
import { isEn, locale, t } from '../lib/i18n';

export const LEGAL_V = '2026-11-10';   // podnieś przy zmianie Regulaminu lub Polityki prywatności (wymaga ponownej akceptacji)

export function legalUrl(doc: 'terms'|'privacy'){
  const base=appChannel()==='stable'?'legal/':'../legal/';
  return base+(doc==='terms' ? (isEn()?'terms.html':'regulamin.html') : (isEn()?'privacy.html':'polityka-prywatnosci.html'));
}

export function consentOk(){
  const c=S.profile && S.profile.consent;
  return !!(c && c.v===LEGAL_V && c.terms && c.health);
}

function setConsent(c){ S.profile=S.profile||{}; S.profile.consent=c; S._settingsM=Date.now(); save(); }

export function consentCheck(){
  const dlg=document.getElementById('consentDialog'); if(!dlg) return;
  dlg.classList.toggle('show', !consentOk());
  if(consentOk()) return;
  (document.getElementById('csTermsLink') as HTMLAnchorElement).href=legalUrl('terms');
  (document.getElementById('csPrivacyLink') as HTMLAnchorElement).href=legalUrl('privacy');
  const a=document.getElementById('csTerms') as HTMLInputElement, h=document.getElementById('csHealth') as HTMLInputElement, ok=document.getElementById('csOk') as HTMLButtonElement;
  const upd=()=>{ ok.disabled=!(a.checked && h.checked); };
  a.onchange=upd; h.onchange=upd; upd();
  ok.onclick=()=>{ if(ok.disabled) return; const now=Date.now(); setConsent({v:LEGAL_V, terms:now, health:now}); dlg.classList.remove('show'); renderConsentStatus(); };
}

// Więcej → Regulamin i polityka prywatności: stan zgody i wycofanie (dwa stuknięcia)
export function renderConsentStatus(){
  const el=document.getElementById('csStatus'), btn=document.getElementById('csWithdraw') as HTMLButtonElement; if(!el||!btn) return;
  const c=S.profile && S.profile.consent;
  el.textContent=c && c.health ? t('Udzielona {d} · dokumenty z {v}', {d:new Date(c.health).toLocaleDateString(locale()), v:LEGAL_V}) : t('Nie udzielono');
  let armed=0;
  btn.textContent=t('Wycofaj zgodę');
  btn.onclick=()=>{
    if(Date.now()-armed>5000){ armed=Date.now(); btn.textContent=t('Na pewno? Stuknij jeszcze raz'); return; }
    setConsent(Object.assign({}, c||{}, {health:null, withdrawn:Date.now()}));
    renderConsentStatus(); consentCheck();
  };
}

export function initConsent(){ consentCheck(); renderConsentStatus(); }
