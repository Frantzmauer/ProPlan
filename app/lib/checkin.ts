// Check-in przed treningiem: sen, zakwasy, energia (0 słabo … 2 dobrze) → propozycja dnia.
// Przy śledzeniu cyklu decydują objawy i Twoje wzorce; sama faza to tylko kontekst.
import type { CycleDay, PhaseNote } from './cycle';

export interface Answers { sleep?: number | null; sore?: number | null; energy?: number | null }
export interface Verdict {
  c: 'ok' | 'mid' | 'low';
  plan: 'normal' | 'light' | 'light2';
  t: string; d: string;
  move?: boolean;   // do wyboru lekki ruch zamiast treningu
  rest?: boolean;   // przerwy +30 s
}

export function checkinVerdict(a: Answers, inf: CycleDay | null, sym: string[], note: PhaseNote): Verdict | null {
  if (a.sleep == null || a.sore == null || a.energy == null) return null;
  const s = a.sleep + a.sore + a.energy, sy = new Set(sym);
  if (inf && inf.sit !== 'preg') {
    if (inf.inPeriod && (sy.has('Skurcze') || sy.has('Obfite krwawienie')) && s <= 3)
      return { c: 'low', plan: 'light', move: true, rest: true, t: 'Okres z objawami', d: 'Do wyboru: lżejszy trening (−10%, przerwy +30 s, bez mocnego obciążania brzucha) albo lekki ruch — 20–30 min spaceru i mobilności często łagodzi skurcze.' };
    if (inf.phase === 'lut' && (sy.size >= 2 || s <= 3))
      return { c: 'mid', plan: 'light', rest: true, t: 'Gorsze dni przed okresem', d: 'Proponuję lżej: ciężar −10% i przerwy dłuższe o 30 s. Ten tydzień bywa trudniejszy — to normalne i przejściowe.' };
    // Twoje wzorce: w fazie, w której energia jest zwykle niższa, przy granicznym samopoczuciu lżej
    if (note && 'low' in note && s === 4)
      return { c: 'mid', plan: 'light', rest: true, t: 'Twoja słabsza faza', d: 'Z Twoich check-inów: w tej fazie energia jest u Ciebie zwykle niższa. Proponuję lżej (−10%, przerwy +30 s) — jeśli w trakcie poczujesz moc, wróć do planu.' };
    if (note && 'high' in note && s >= 5)
      return { c: 'ok', plan: 'normal', t: 'Twoja mocna faza', d: 'Z Twoich check-inów: to zwykle Twoje najlepsze dni. Trenujesz według planu — dobry moment na rekord.' };
    if (note && 'low' in note && s >= 5)
      return { c: 'ok', plan: 'normal', t: 'Dobra forma', d: 'Ta faza bywa u Ciebie słabsza, ale dziś czujesz się dobrze — trenujesz według planu.' };
  }
  if (s >= 4) return { c: 'ok', plan: 'normal', t: 'Dobra forma', d: inf && inf.phase === 'foll' ? 'Trenujesz według planu. U wielu kobiet to dobry moment na mocniejszy trening — jeśli czujesz moc, spróbuj rekordu.' : 'Trenujesz według planu.' };
  if (s >= 2) return { c: 'mid', plan: 'light', t: 'Gorszy dzień', d: 'Proponuję lżej: ciężar −10%, serie bez zmian. Technika i ruch są dziś ważniejsze niż rekordy.' };
  return { c: 'low', plan: 'light2', t: 'Mocne zmęczenie', d: 'Proponuję lżej: ciężar −10% i jedna seria mniej w każdym ćwiczeniu — albo przesuń trening na inny dzień.' };
}
