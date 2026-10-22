import type { Match } from '~/types'

const toScore = (goals: number | null) => goals == null ? null : String(goals)

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const leagueId = String(query.leagueId ?? DEFAULT_COMPETITION_ID)
  const competition = getCompetition(leagueId)
  // Тур (?round=5) или диапазон дат (?dateFrom=…&dateTo=…): на главной выбирают что-то одно.
  // Ни того, ни другого — текущий тур: так главной не нужно ждать /api/rounds, чтобы его узнать
  const requestedRound = typeof query.round === 'string' && query.round ? query.round : null
  const hasDates = typeof query.dateFrom === 'string' && !!query.dateFrom

  const today = getMoscowDate(new Date())
  const dateFrom = String(query.dateFrom ?? today)
  const dateTo = String(query.dateTo ?? today)

  // Турниры не из списка не спрашиваем: каждый запрос к API-Football — из дневного лимита
  const season = competition ? await getLeagueSeason(leagueId) : null
  if (!competition || season == null) return { matches: [] }

  const schedule = await getSeasonMatches(leagueId, season)

  // Тур нужен и при выборе по датам: в заголовке дня на главной пишем «· 5 тур»
  const { roundByMatch } = getSeasonRounds(schedule, competition)
  const round = requestedRound ?? (hasDates ? null : getCurrentRound(schedule, roundByMatch, new Date()))

  // Расписание уже по времени начала
  const filtered = schedule.filter((match) => {
    if (round) return roundByMatch.get(match.id) === round
    const moscowDate = getMoscowDate(match.timestamp)
    return moscowDate >= dateFrom && moscowDate <= dateTo
  })

  const matches: Match[] = filtered.map(match => ({
    idEvent: match.id,
    homeTeam: match.home.name,
    awayTeam: match.away.name,
    homeBadge: match.home.badge,
    awayBadge: match.away.badge,
    homeScore: toScore(match.homeScore),
    awayScore: toScore(match.awayScore),
    homePenScore: match.homePenalties,
    awayPenScore: match.awayPenalties,
    status: match.status,
    // Минуту и свежий счёт идущего матча подставляет страница из /api/live (useLiveScores)
    progress: null,
    timestamp: match.timestamp,
    date: match.timestamp.slice(0, 10),
    season: String(season),
    round: roundByMatch.get(match.id) ?? null,
  }))

  return { matches }
})
