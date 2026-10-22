import type { LiveScore } from '~/types'
import { formatMatchProgress } from '#shared/utils/matches'
import { toScoreText } from './seasonMatch'

/** Матч из ответа fixtures?ids=: поля для живого счёта */
export type ApiFootballLiveFixture = {
  fixture: { id: number, status: { short: string, elapsed: number | null, extra: number | null } }
  league: { id: number }
  goals: { home: number | null, away: number | null }
  score: { penalty: { home: number | null, away: number | null } }
}

/** Счёт, статус и минута матча («45+2») для страницы */
export function toLiveScore({ fixture, goals, score }: ApiFootballLiveFixture): LiveScore {
  return {
    status: fixture.status.short,
    progress: formatMatchProgress(fixture.status.short, fixture.status.elapsed, fixture.status.extra),
    homeScore: toScoreText(goals.home),
    awayScore: toScoreText(goals.away),
    homePenScore: score.penalty.home,
    awayPenScore: score.penalty.away,
  }
}
