import { isEn } from './i18n';
// Plan konta, funkcje i miesięczne limity — tak, jak je opisuje serwer (planView w Apps Script).
// Limity planu obowiązują tylko w wersjach z cfg.enforce; w pozostałych działa wyłącznie wyłącznik awaryjny.

export interface PlanInfo { plan: string; planName: string; features: Record<string, boolean>; enforced: boolean }
export interface Counter { n: number; max: number }
export interface Quota { m: string; plan?: string; coach: Counter; form: Counter; est: Counter & { day: number } }
export type QuotaKind = 'coach' | 'form' | 'est';

/** Odpowiedź serwera → plan (stary serwer bez planów zwraca null). */
export function planFromServer(j: { plan?: string; planName?: string; features?: Record<string, boolean>; enforced?: boolean } | null): PlanInfo | null {
  if (!j || !j.features) return null;
  return { plan: j.plan || '', planName: j.planName || j.plan || '', features: j.features, enforced: !!j.enforced };
}

/** Przed odpowiedzią serwera: limity zakładamy w USERS i Early Access. */
export function planEnforcedFor(plan: PlanInfo | null, channel: string): boolean {
  return plan ? !!plan.enforced : channel === 'early' || channel === 'users';
}

/** Funkcja włączona, dopóki serwer wprost jej nie wyłączył. */
export function featureOn(plan: PlanInfo | null, k: string): boolean {
  return !plan || !plan.features || plan.features[k] !== false;
}

/** Licznik na ten miesiąc: zapis z poprzedniego miesiąca liczy od zera; stary zapis bez limitu szacowań dostaje domyślny. */
export function currentQuota(q: any, enforced: boolean, month: string): Quota | null {
  if (!enforced || !q || !q.coach || !q.form) return null;
  if (typeof q.est !== 'object' || !q.est) q.est = { n: +q.est || 0, max: 300, day: 20 };
  if (q.m === month) return q as Quota;
  return { m: month, coach: { n: 0, max: q.coach.max }, form: { n: 0, max: q.form.max }, est: { n: 0, max: q.est.max, day: q.est.day } };
}

export function quotaLeftOf(q: Quota | null, k: QuotaKind): number | null {
  return q ? Math.max(0, q[k].max - q[k].n) : null;
}

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_GEN = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
/** „1 grudnia” — kiedy limity się odnowią (pierwszy dzień następnego miesiąca). */
export function resetLabel(now: Date = new Date()): string {
  return isEn() ? '1 ' + MONTHS_EN[(now.getMonth() + 1) % 12] : '1 ' + MONTHS_GEN[(now.getMonth() + 1) % 12];
}
