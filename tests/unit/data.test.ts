import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KEYS, readJSON, writeJSON } from '../../app/lib/storage';
import { defaultState, fieldTime, hasUserData, mark, migrateState, normalizeIncoming } from '../../app/lib/state';
import { ApiError, apiCall, channelFromPath, isNetworkError } from '../../app/lib/api';
import { currentQuota, featureOn, planEnforcedFor, planFromServer, quotaLeftOf, resetLabel } from '../../app/lib/plan';

// pamięć telefonu w testach
function fakeStorage(fail = false) {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { if (fail) throw new Error('QuotaExceeded'); m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
  };
}

describe('pamięć telefonu', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  it('zapis i odczyt JSON', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    expect(writeJSON(KEYS.CLOUD, { url: 'x' })).toBe(true);
    expect(readJSON(KEYS.CLOUD, null)).toEqual({ url: 'x' });
    expect(readJSON('brak', 5)).toBe(5);
  });
  it('uszkodzony zapis albo pełna pamięć nie przerywa aplikacji', () => {
    const st = fakeStorage(); st.setItem('zly', '{nie json'); vi.stubGlobal('localStorage', st);
    expect(readJSON('zly', 'domyślne')).toBe('domyślne');
    vi.stubGlobal('localStorage', fakeStorage(true));
    expect(writeJSON('x', 1)).toBe(false);
  });
  it('plan zapisany osobno dla każdej wersji', () => {
    expect(KEYS.plan('users')).toBe('zelazo_plan_users');
  });
});

describe('stan aplikacji', () => {
  it('nowy stan i migracja starego zapisu', () => {
    const s = defaultState('2026-11-02', 2500);
    expect(s).toMatchObject({ startDate: '2026-11-02', kcalGoal: 2500, log: {}, weights: [] });
    expect(migrateState({ log: {} }, 2500)).toMatchObject({ kcalGoal: 2500, custom: {}, profile: { weight: 104 } });
    expect(migrateState({ kcalGoal: 1800 }, 2500).kcalGoal).toBe(1800);
  });
  it('czy na urządzeniu są czyjeś dane', () => {
    expect(hasUserData(defaultState('2026-11-02', 2500))).toBe(false);
    expect(hasUserData({ log: {}, weights: [{ d: '2026-11-01', w: 80 }] })).toBe(true);
    expect(hasUserData({ profile: { name: 'Ola' } })).toBe(true);
  });
  it('znacznik czasu pola', () => {
    const L: Record<string, unknown> = {};
    mark(L, 'meal:m0', 123);
    expect(fieldTime(L, 'meal:m0')).toBe(123);
    expect(fieldTime(L, 'inne')).toBe(123);   // bez własnego znacznika: czas ostatniej zmiany dnia
  });
  it('stare dane z serwera bez znaczników zakupów dostają znacznik 1', () => {
    expect(normalizeIncoming({ shop: { a: true } })).toEqual({ shop: { a: true }, shopT: { a: 1 } });
  });
});

describe('serwer', () => {
  it('wersja z adresu', () => {
    expect(channelFromPath('/ProPlan/')).toBe('stable');
    expect(channelFromPath('/ProPlan/beta/')).toBe('beta');
    expect(channelFromPath('/ProPlan/users/index.html')).toBe('users');
    expect(channelFromPath('/ProPlan/v1.0/')).toBe('stable');
  });
  it('zapytanie: konto małymi literami, wersja, text/plain', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ ok: true, pong: true })));
    const j = await apiCall({ url: 'https://s', token: 't', account: ' Ola ' }, 'beta', 'ping', {}, f as unknown as typeof fetch);
    expect(j.pong).toBe(true);
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ action: 'ping', token: 't', account: 'ola', channel: 'beta' });
    expect((init.headers as Record<string, string>)['Content-Type']).toContain('text/plain');
  });
  it('błąd serwera niesie odpowiedź (np. limit)', async () => {
    const f = async () => new Response(JSON.stringify({ ok: false, error: 'Limit', limit: 'coach' }));
    await expect(apiCall({ url: 'u', token: '', account: '' }, 'users', 'coach', {}, f as unknown as typeof fetch))
      .rejects.toMatchObject({ message: 'Limit', data: { limit: 'coach' } });
    const e = new ApiError('x', { a: 1 }); expect(e).toBeInstanceOf(Error);
  });
  it('zła odpowiedź (np. strona logowania Google zamiast JSON)', async () => {
    const f = async () => new Response('<html>');
    await expect(apiCall({ url: 'u', token: '', account: '' }, 'beta', 'pull', {}, f as unknown as typeof fetch)).rejects.toThrow('Zła odpowiedź serwera');
  });
  it('brak sieci vs błąd serwera', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'), true)).toBe(true);
    expect(isNetworkError(new Error('Zły token'), true)).toBe(false);
    expect(isNetworkError(new Error('Zły token'), false)).toBe(true);
  });
});

describe('plan i limity', () => {
  const quota = { m: '2026-11', coach: { n: 28, max: 30 }, form: { n: 1, max: 10 }, est: { n: 5, max: 300, day: 20 } };
  it('plan z odpowiedzi serwera; stary serwer bez planów → brak', () => {
    expect(planFromServer({ plan: 'free', planName: 'Darmowy', features: { voice: false }, enforced: true })).toMatchObject({ planName: 'Darmowy', enforced: true });
    expect(planFromServer({ ok: true } as never)).toBeNull();
  });
  it('limity przed odpowiedzią serwera: tylko USERS i Early Access', () => {
    expect(planEnforcedFor(null, 'users')).toBe(true);
    expect(planEnforcedFor(null, 'beta')).toBe(false);
    expect(planEnforcedFor({ plan: 'p', planName: 'P', features: {}, enforced: false }, 'users')).toBe(false);
  });
  it('funkcja włączona, dopóki serwer jej nie wyłączy', () => {
    expect(featureOn(null, 'voice')).toBe(true);
    expect(featureOn({ plan: 'free', planName: '', features: { voice: false }, enforced: true }, 'voice')).toBe(false);
  });
  it('licznik: ten miesiąc, nowy miesiąc od zera, poza wersją z limitami brak', () => {
    expect(quotaLeftOf(currentQuota({ ...quota }, true, '2026-11'), 'coach')).toBe(2);
    expect(quotaLeftOf(currentQuota({ ...quota }, true, '2026-12'), 'coach')).toBe(30);
    expect(currentQuota({ ...quota }, false, '2026-11')).toBeNull();
    expect(currentQuota({ m: '2026-11', coach: { n: 1, max: 30 }, form: { n: 0, max: 10 }, est: 7 }, true, '2026-11')?.est).toEqual({ n: 7, max: 300, day: 20 });
  });
  it('data odnowienia limitów', () => {
    expect(resetLabel(new Date(2026, 10, 15))).toBe('1 grudnia');
    expect(resetLabel(new Date(2026, 11, 3))).toBe('1 stycznia');
  });
});

beforeEach(() => { vi.useRealTimers(); });
