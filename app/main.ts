// ŻELAZO — start aplikacji. Ekrany i funkcje są w modułach (app/screens, app/features, app/core, app/plan, app/diet, app/ui),
// obliczenia w app/lib. Moduły tylko deklarują; tu uruchamiamy ich kod startowy w pierwotnej kolejności.
import './fonts.css';
import './styles.css';
import { setLang, translateDom } from './lib/i18n';
import { EN } from './i18n/en';
import { KEYS } from './lib/storage';
import { __init_1 } from './plan/data';
import { S, __init_2 } from './core/state';
import { __init_3 } from './core/backup';
import { __init_4 } from './screens/train';
import { __init_5 } from './screens/guide';
import { __init_6 } from './ui/dictation';
import { __init_7 } from './screens/steps';
import { __init_8 } from './screens/streak';
import { __init_10 } from './screens/progress';
import { __init_9 } from './screens/meals';
import { __init_11 } from './screens/shop';
import { __init_12 } from './features/reminders';
import { __init_13 } from './screens/more';
import { __init_14 } from './features/scanner';
import { __init_15, __init_20 } from './screens/sync-ui';
import { __init_16 } from './screens/accounts';
import { __init_17 } from './screens/coach';
import { __init_18 } from './features/plan-limits';
import { __init_19 } from './screens/admin';
import { __init_21 } from './core/shell';
import { __init_22, __init_28 } from './screens/workout';
import { __init_23 } from './screens/history';
import { __init_24 } from './features/swap';
import { __init_25 } from './features/rest';
import { __init_26 } from './features/checkin';
import { __init_27 } from './features/cycle';
import { __init_29 } from './features/formcheck';
import { __init_30 } from './features/body3d';
import { __init_31 } from './screens/account';
import { initConsent } from './features/consent';

// język przed pierwszym ekranem: z profilu na tym urządzeniu, a na nowym urządzeniu z języka telefonu (polski → pl, inny → en)
const saved = (() => { try { return JSON.parse(localStorage.getItem(KEYS.STATE) || 'null'); } catch { return null; } })();
const bootLang = saved ? (saved.profile && saved.profile.lang === 'en' ? 'en' : 'pl')
  : ((navigator.language || 'pl').toLowerCase().startsWith('pl') ? 'pl' : 'en');
setLang(bootLang, EN);
document.documentElement.lang = bootLang;
translateDom(document.body);

__init_1();
__init_2();
if (!saved && S.profile && !S.profile.lang) S.profile.lang = bootLang;   // pierwszy start: zapisze się z pierwszym zapisem
__init_3();
__init_4();
__init_5();
__init_6();
__init_7();
__init_8();
__init_9();
__init_10();
__init_11();
__init_12();
__init_13();
__init_14();
__init_15();
__init_16();
__init_17();
__init_18();
__init_19();
__init_20();
__init_21();
__init_22();
__init_23();
__init_24();
__init_25();
__init_26();
__init_27();
__init_28();
__init_29();
__init_30();
__init_31();
initConsent();   // zgody na końcu — okno nad wszystkim, gdy brak akceptacji aktualnych dokumentów
