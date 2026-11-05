import { describe, expect, it } from 'vitest';
import { COACH_UI, langOf, speechLocale } from '../../app/lib/lang';

describe('język konta', () => {
  it('domyślnie polski; angielski tylko gdy wybrany', () => {
    expect(langOf(null)).toBe('pl');
    expect(langOf({})).toBe('pl');
    expect(langOf({ lang: 'de' })).toBe('pl');
    expect(langOf({ lang: 'en' })).toBe('en');
  });

  it('mowa: pl-PL albo en-US', () => {
    expect(speechLocale('pl')).toBe('pl-PL');
    expect(speechLocale('en')).toBe('en-US');
  });

  it('teksty Trenera w obu językach mają ten sam kształt', () => {
    expect(COACH_UI.en.chips).toHaveLength(COACH_UI.pl.chips.length);
    expect(COACH_UI.en.local).toHaveLength(COACH_UI.pl.local.length);
    expect(COACH_UI.en.hello('Sam')).toMatch(/^Hi, Sam!/);
    expect(COACH_UI.pl.hello('')).toMatch(/^Cześć!/);
  });
});
