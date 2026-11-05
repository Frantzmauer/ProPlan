// Język konta (Więcej → Profil i plan → Język · Language), zapisany w profilu, więc synchronizuje się między urządzeniami.
// Etap 1: po angielsku Trener (tekst i głos), ocena techniki i szacowanie AI; reszta aplikacji zostaje po polsku.

export type Lang = 'pl' | 'en';
export const LANGS: { id: Lang; label: string }[] = [{ id: 'pl', label: 'Polski' }, { id: 'en', label: 'English' }];

export function langOf(profile?: { lang?: string } | null): Lang { return profile && profile.lang === 'en' ? 'en' : 'pl'; }

/** Język rozpoznawania mowy i czytania odpowiedzi. */
export function speechLocale(l: Lang): string { return l === 'en' ? 'en-US' : 'pl-PL'; }

export interface CoachUi { hello: (name: string) => string; chips: string[]; placeholder: string; thinking: string; local: string[] }

export const COACH_UI: Record<Lang, CoachUi> = {
  pl: {
    hello: n => `Cześć${n ? ', ' + n : ''}! Jestem Twoim Trenerem. Widzę Twoje treningi, dietę, wagę i postępy — zapytaj, co poprawić, jak dobrać ciężary albo jakie suplementy mają sens.`,
    chips: ['Jak mi idzie? Oceń moje postępy', 'Co poprawić w diecie?', 'Jakie suplementy mają sens w moim przypadku?', 'Czy zmienić coś w planie treningowym?', 'Jak dobrać ciężary na następny trening?'],
    placeholder: 'Napisz albo powiedz pytanie…',
    thinking: 'Trener myśli…',
    local: ['Do usług 💪', 'Powodzenia na treningu!', 'Jasne — pisz, gdy coś będzie potrzebne.'],
  },
  en: {
    hello: n => `Hi${n ? ', ' + n : ''}! I'm your Coach. I can see your workouts, diet, weight and progress — ask me what to improve, how to pick your weights or which supplements make sense.`,
    chips: ['How am I doing? Review my progress', 'What should I improve in my diet?', 'Which supplements make sense for me?', 'Should I change anything in my training plan?', 'How should I pick weights for my next workout?'],
    placeholder: 'Type or say your question…',
    thinking: 'Coach is thinking…',
    local: ['Any time 💪', 'Have a great workout!', 'Sure — message me whenever you need.'],
  },
};
