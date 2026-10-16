import type { Match } from '~/types'

type ApiMatch = {
  idEvent: string
  strHomeTeam: string
  strAwayTeam: string
  strHomeTeamBadge: string
  strAwayTeamBadge: string
  intHomeScore: string | null
  intAwayScore: string | null
  strStatus: string
  strTimestamp: string
  dateEvent: string
  strGroup: string | null
  strSeason: string
}

type ScheduleResponse = {
  schedule: ApiMatch[]
}

type V1Response = {
  events: Array<{
    intHomeScoreExtra: string | null
    intAwayScoreExtra: string | null
  }> | null
}

export default cachedEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const query = getQuery(event)
  const leagueId = String(query.leagueId ?? DEFAULT_COMPETITION_ID)

  const today = getMoscowDate(new Date())
  const dateFrom = String(query.dateFrom ?? today)
  const dateTo = String(query.dateTo ?? today)

  const apiBase = 'https://www.thesportsdb.com/api/v2/json'
  const headers = { 'X-API-KEY': config.theSportsDbApiKey }

  const nextData = await $fetch<ScheduleResponse>(
    `${apiBase}/schedule/next/league/${leagueId}`,
    { headers },
  )

  const season = nextData.schedule[0]?.strSeason
  if (!season) return { matches: [] }

  const data = await $fetch<ScheduleResponse>(
    `${apiBase}/schedule/league/${leagueId}/${season}`,
    { headers },
  )

  const filtered = data.schedule
    .filter((match) => {
      const moscowDate = getMoscowDate(match.strTimestamp)
      return moscowDate >= dateFrom && moscowDate <= dateTo
    })
    .sort((a, b) => a.strTimestamp.localeCompare(b.strTimestamp))

  // For AP (after penalties) matches, look up penalty scores from v1 API
  const v1Base = 'https://www.thesportsdb.com/api/v1/json'
  const apMatchIds = filtered.filter(match => match.strStatus === 'AP').map(match => match.idEvent)
  const penScoreMap: Record<string, { home: number | null, away: number | null }> = {}

  if (apMatchIds.length) {
    await Promise.all(apMatchIds.map(async (id) => {
      const v1 = await $fetch<V1Response>(
        `${v1Base}/${config.theSportsDbApiKey}/lookupevent.php?id=${id}`,
      ).catch(() => null)
      const eventDetails = v1?.events?.[0]
      penScoreMap[id] = {
        home: eventDetails?.intHomeScoreExtra != null ? Number(eventDetails.intHomeScoreExtra) : null,
        away: eventDetails?.intAwayScoreExtra != null ? Number(eventDetails.intAwayScoreExtra) : null,
      }
    }))
  }

  const matches: Match[] = filtered.map(match => ({
    idEvent: match.idEvent,
    homeTeam: match.strHomeTeam,
    awayTeam: match.strAwayTeam,
    homeBadge: match.strHomeTeamBadge,
    awayBadge: match.strAwayTeamBadge,
    homeScore: match.intHomeScore,
    awayScore: match.intAwayScore,
    homePenScore: penScoreMap[match.idEvent]?.home ?? null,
    awayPenScore: penScoreMap[match.idEvent]?.away ?? null,
    status: match.strStatus,
    progress: null, // schedule endpoint doesn't return live-match progress
    timestamp: match.strTimestamp,
    date: match.dateEvent,
    group: match.strGroup,
    season: match.strSeason,
  }))

  return { matches }
}, {
  maxAge: 60,
  getKey: (event) => {
    const query = getQuery(event)
    return `matches-${query.leagueId}-${query.dateFrom}-${query.dateTo}`
  },
})
