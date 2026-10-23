import type { Match, MatchDetails } from '~/types'

/** Матч для тестов: ещё не начался, счёта нет. Всё, от чего зависит проверка, тест передаёт сам */
export function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    idEvent: '1',
    homeTeam: 'Спартак',
    awayTeam: 'Рубин',
    homeBadge: '',
    awayBadge: '',
    homeScore: null,
    awayScore: null,
    homePenScore: null,
    awayPenScore: null,
    status: 'NS',
    progress: null,
    timestamp: '2026-10-18T15:45:00',
    round: null,
    ...overrides,
  }
}

/** Страница матча для тестов: как makeMatch, матч РПЛ без стадиона, хроники, статистики и составов */
export function makeMatchDetails(overrides: Partial<MatchDetails> = {}): MatchDetails {
  return {
    ...makeMatch(),
    leagueId: '235',
    league: 'Premier League',
    venue: null,
    city: null,
    events: [],
    stats: [],
    lineups: null,
    ...overrides,
  }
}
