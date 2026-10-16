import type { MatchDetails } from '~/types'

type ApiEvent = {
  idEvent: string
  strHomeTeam: string
  strAwayTeam: string
  strHomeTeamBadge: string
  strAwayTeamBadge: string
  intHomeScore: string | null
  intAwayScore: string | null
  intHomeScoreExtra: string | null
  intAwayScoreExtra: string | null
  strStatus: string
  strTimestamp: string | null
  dateEvent: string | null
  idLeague: string
  strLeague: string
  strSeason: string
  intRound: string | null
  strVenue: string | null
  strCity: string | null
}

type V1Response = {
  events: ApiEvent[] | null
}

export default cachedEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const id = getRouterParam(event, 'id')
  const base = `https://www.thesportsdb.com/api/v1/json/${config.theSportsDbApiKey}`

  // Сбой TheSportsDB (лимит запросов, 5xx, таймаут) — это 502, а не «матч не найден»
  const data = await $fetch<V1Response>(`${base}/lookupevent.php?id=${id}`).catch(() => {
    throw createError({ statusCode: 502, statusMessage: 'TheSportsDB недоступен' })
  })
  const ev = data.events?.[0]
  if (!ev) {
    throw createError({ statusCode: 404, statusMessage: 'Матч не найден' })
  }

  const details: MatchDetails = {
    idEvent: ev.idEvent,
    homeTeam: ev.strHomeTeam,
    awayTeam: ev.strAwayTeam,
    homeBadge: ev.strHomeTeamBadge,
    awayBadge: ev.strAwayTeamBadge,
    homeScore: ev.intHomeScore,
    awayScore: ev.intAwayScore,
    // Пустая строка — это «нет данных», а не 0 (Number('') === 0)
    homePenScore: ev.intHomeScoreExtra ? Number(ev.intHomeScoreExtra) : null,
    awayPenScore: ev.intAwayScoreExtra ? Number(ev.intAwayScoreExtra) : null,
    status: ev.strStatus,
    // У старых матчей timestamp бывает пустым, тогда страница покажет только дату
    timestamp: ev.strTimestamp ?? '',
    date: ev.dateEvent ?? '',
    leagueId: ev.idLeague,
    league: ev.strLeague,
    season: ev.strSeason,
    round: ev.intRound,
    venue: ev.strVenue,
    city: ev.strCity,
  }

  return details
}, {
  maxAge: 60,
  getKey: event => `match-${getRouterParam(event, 'id')}`,
})
