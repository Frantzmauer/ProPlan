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
