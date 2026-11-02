// Synchronizacja z serwerem: wysyłka zmian (z opóźnieniem po ostatniej zmianie) i pobieranie.
// Serwer scala przysłany stan z tym, co ma, i odsyła wynik; aplikacja scala go jeszcze raz u siebie.
// Ekran, alerty i zapis do pamięci telefonu podaje main.js (deps) — tu tylko kolejność i zasady.
import type { CloudConfig } from './api';

export interface SyncDeps {
  cloud(): CloudConfig;                 // bieżąca konfiguracja (ten sam obiekt, który zapisuje saveCloud)
  saveCloud(): void;
  call(action: string, payload?: Record<string, unknown>): Promise<any>;
  getState(): any;
  setState(merged: any): void;          // zapisz scalony stan i przerysuj widoki
  merge(local: any, incoming: any): any;
  status(text?: string): void;          // pasek stanu synchronizacji
  editing(): boolean;                   // użytkownik właśnie coś wpisuje
  isNetErr(e: unknown): boolean;
  afterPush?(): void;
}
export type SyncResult = { ok: true } | { ok: false; offline?: boolean; error?: string; skipped?: string };

export const PUSH_DELAY = 2000;   // wysyłka 2 s po ostatniej zmianie
export const EDIT_RETRY = 1500;   // w trakcie pisania — sprawdź ponownie po 1,5 s

export function createSync(d: SyncDeps) {
  let timer: ReturnType<typeof setTimeout> | null = null, busy = false;

  // wysłany stan i odpowiedź serwera należą do tego samego konta — inaczej (zmiana konta w trakcie) odrzucamy dane
  function accept(j: any, acc: string) {
    if (j && j.data && d.cloud().account === acc) d.setState(d.merge(d.getState(), j.data));
  }

  async function push(): Promise<SyncResult> {
    const c = d.cloud();
    if (!c.on || !c.url || busy) return { ok: false, skipped: 'off' };
    if (!c.account) { c.lastError = 'Brak nazwy konta'; d.saveCloud(); d.status(); return { ok: false, error: c.lastError }; }
    busy = true; d.status('...zapisywanie');
    const acc = c.account;
    let r: SyncResult = { ok: true };
    try {
      accept(await d.call('push', { data: d.getState(), clientMerge: true }), acc);
      c.lastSync = Date.now(); c.lastError = ''; c.pending = false;
    } catch (e) {
      if (d.isNetErr(e)) { c.pending = true; c.lastError = ''; r = { ok: false, offline: true }; }
      else { c.lastError = (e as Error).message; r = { ok: false, error: c.lastError }; }
    }
    busy = false; d.saveCloud(); d.status(); if (d.afterPush) d.afterPush();
    return r;
  }

  async function pull(): Promise<SyncResult> {
    const c = d.cloud();
    if (!c.url) return { ok: false, skipped: 'url' };
    if (!c.account) return { ok: false, skipped: 'account' };
    busy = true; d.status('...pobieranie');
    const acc = c.account;
    let r: SyncResult = { ok: true };
    try {
      accept(await d.call('pull', {}), acc);
      c.lastSync = Date.now(); c.lastError = '';
    } catch (e) {
      if (d.isNetErr(e)) { c.pending = true; r = { ok: false, offline: true }; }
      else { c.lastError = (e as Error).message; r = { ok: false, error: c.lastError }; }
    }
    busy = false; d.saveCloud(); d.status();
    return r;
  }

  /** Wyślij po chwili od ostatniej zmiany; nie w trakcie pisania. */
  function schedule() {
    const c = d.cloud();
    if (!c.on || !c.url) return;
    if (timer) clearTimeout(timer);
    const run = () => {
      if (d.editing()) { timer = setTimeout(run, EDIT_RETRY); return; }
      timer = null; void push();
    };
    timer = setTimeout(run, PUSH_DELAY);
  }

  function cancel() { if (timer) { clearTimeout(timer); timer = null; } }

  return { push, pull, schedule, cancel, busy: () => busy };
}
