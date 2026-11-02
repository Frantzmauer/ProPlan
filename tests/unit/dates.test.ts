import { describe, expect, it } from 'vitest';
import { addDays, parseISO, todayISO } from '../../app/lib/dates';

describe('daty', () => {
  it('formatuje datę z zerami wiodącymi', () => {
    expect(todayISO(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
  it('parseISO i todayISO są odwrotne', () => {
    expect(todayISO(parseISO('2026-11-02'))).toBe('2026-11-02');
  });
  it('addDays przechodzi przez miesiąc, rok i zmianę czasu', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');   // zmiana na czas letni 29.03
    expect(addDays('2026-10-24', 7)).toBe('2026-10-31');   // zmiana na czas zimowy 25.10
  });
});
