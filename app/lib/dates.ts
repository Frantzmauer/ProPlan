// Daty w aplikacji to tekst 'RRRR-MM-DD' w czasie lokalnym telefonu (bez stref czasowych i godzin).

/** Dzisiejsza (albo podana) data jako 'RRRR-MM-DD'. */
export function todayISO(d?: Date | null): string {
  const x = d || new Date();
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
}

/** 'RRRR-MM-DD' → Date o północy czasu lokalnego. */
export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Data przesunięta o n dni (n może być ujemne); zmiana czasu letni/zimowy nie przesuwa dnia. */
export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return todayISO(d);
}

/** Liczba dni od a do b (b później → wynik dodatni); zaokrąglenie zjada godzinę zmiany czasu. */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 864e5);
}

/** Minuta doby (0–1439) chwili t w czasie lokalnym. */
export function minuteOfDay(t: number): number {
  const d = new Date(t);
  return d.getHours() * 60 + d.getMinutes();
}
