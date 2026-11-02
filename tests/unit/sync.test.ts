import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSync, EDIT_RETRY, PUSH_DELAY, type SyncDeps } from '../../app/lib/sync';
import { mergeState } from '../../app/lib/merge.js';
import type { CloudConfig } from '../../app/lib/api';

type S = Record<string, unknown>;
function setup(over: Partial<SyncDeps> = {}) {
  const cloud: CloudConfig = { url: 'https://s', token: 't', account: 'ola', on: true, lastSync: 0, lastError: '' };
  let state: S = { log: { d: { meals: { m0: true }, _m: 1 } }, weights: [], measures: [], shop: {} };
  const calls: string[] = [];
  const views = { n: 0 };
  const deps: SyncDeps = {
    cloud: () => cloud, saveCloud: () => {},
    call: async (action) => { calls.push(action); return { ok: true, data: { log: { d: { meals: { m1: true }, _m: 2 } }, weights: [], measures: [], shop: {} } }; },
    getState: () => state, setState: m => { state = m; views.n++; },
    merge: (a, b) => mergeState(a, b), status: () => {}, editing: () => false,
    isNetErr: e => /fetch/i.test(String((e as Error).message)), ...over,
  };
  return { sync: createSync(deps), cloud, calls, views, get state() { return state; } };
}

describe('synchronizacja', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('wysyłka scala odpowiedź serwera z danymi telefonu', async () => {
    const t = setup();
    expect(await t.sync.push()).toEqual({ ok: true });
    expect(t.calls).toEqual(['push']);
    expect((t.state.log as S).d).toMatchObject({ meals: { m0: true, m1: true } });
    expect(t.cloud.lastSync).toBeGreaterThan(0);
  });

  it('zmiana konta w trakcie wysyłki: dane poprzedniego konta nie trafiają do telefonu', async () => {
    let t!: ReturnType<typeof setup>;
    t = setup({ call: async () => { t.cloud.account = 'kuba'; return { ok: true, data: { log: { x: {} } } }; } });
    await t.sync.push();
    expect(t.views.n).toBe(0);
    expect((t.state.log as S).x).toBeUndefined();
  });

  it('bez internetu: czeka z wysyłką, bez komunikatu o błędzie', async () => {
    const t = setup({ call: async () => { throw new TypeError('Failed to fetch'); } });
    expect(await t.sync.push()).toEqual({ ok: false, offline: true });
    expect(t.cloud.pending).toBe(true);
    expect(t.cloud.lastError).toBe('');
  });

  it('błąd serwera zapisuje się jako ostatni błąd', async () => {
    const t = setup({ call: async () => { throw new Error('Zły token'); } });
    expect(await t.sync.push()).toEqual({ ok: false, error: 'Zły token' });
    expect(t.cloud.lastError).toBe('Zły token');
  });

  it('bez nazwy konta nie wysyła', async () => {
    const t = setup(); t.cloud.account = '';
    expect((await t.sync.push()).ok).toBe(false);
    expect(t.calls).toEqual([]);
  });

  it('wysyłka 2 s po ostatniej zmianie, a w trakcie pisania później', async () => {
    let editing = true;
    const t = setup({ editing: () => editing });
    t.sync.schedule(); t.sync.schedule();             // dwie zmiany szybko po sobie = jedna wysyłka
    await vi.advanceTimersByTimeAsync(PUSH_DELAY);
    expect(t.calls).toEqual([]);                      // użytkownik pisze — czekamy
    editing = false;
    await vi.advanceTimersByTimeAsync(EDIT_RETRY);
    expect(t.calls).toEqual(['push']);
  });

  it('anulowanie (np. przy zmianie konta) nie wysyła zaplanowanych zmian', async () => {
    const t = setup();
    t.sync.schedule(); t.sync.cancel();
    await vi.advanceTimersByTimeAsync(PUSH_DELAY * 2);
    expect(t.calls).toEqual([]);
  });

  it('pobieranie: brak adresu albo konta → nic nie robi', async () => {
    const t = setup(); t.cloud.url = '';
    expect(await t.sync.pull()).toEqual({ ok: false, skipped: 'url' });
    t.cloud.url = 'u'; t.cloud.account = '';
    expect(await t.sync.pull()).toEqual({ ok: false, skipped: 'account' });
    expect(t.calls).toEqual([]);
  });
});
