import type { MatchDetails } from '~/types'

type ApiEvent = {
  idEvent: string
  /** Номер этого матча в API-Football: оттуда берём хронику и статистику, если у TheSportsDB их нет */
  idAPIfootball: string | null
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
  /** Видеообзор на YouTube; есть в основном у АПЛ, Ла Лиги, Серии А, МЛС */
  strVideo: string | null
}

type V1Response = {
  events: ApiEvent[] | null
}

type TimelineResponse = {
  timeline: TimelineEvent[] | null
}

type StatsResponse = {
  eventstats: TheSportsDbStat[] | null
}

export default cachedEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const id = getRouterParam(event, 'id')
  const base = `https://www.thesportsdb.com/api/v1/json/${config.theSportsDbApiKey}`

  const [data, timelineData, statsData] = await Promise.all([
    // Сбой TheSportsDB (лимит запросов, 5xx, таймаут) — это 502, а не «матч не найден»
    $fetch<V1Response>(`${base}/lookupevent.php?id=${id}`).catch(() => {
      throw createError({ statusCode: 502, statusMessage: 'TheSportsDB недоступен' })
    }),
    // Без ленты событий и статистики страница матча открывается, просто без этих блоков
    $fetch<TimelineResponse>(`${base}/lookuptimeline.php?id=${id}`).catch(() => null),
    $fetch<StatsResponse>(`${base}/lookupeventstats.php?id=${id}`).catch(() => null),
  ])
  const ev = data.events?.[0]
  if (!ev) {
    throw createError({ statusCode: 404, statusMessage: 'Матч не найден' })
  }

  // Хроника и статистика из TheSportsDB. Если ленты нет или её голы не сходятся со счётом (РПЛ, Саудовская лига,
  // Бразилия), у сыгранного матча — из API-Football. Пустая лента — тоже «нет данных», даже при 0:0:
  // без замен и карточек матчей не бывает
  const timelineEvents = getTimelineEvents(timelineData?.timeline ?? [])
  let events = timelineEvents.length && goalsMatchScore(timelineEvents, ev.intHomeScore, ev.intAwayScore) ? timelineEvents : []
  let stats = getTheSportsDbStats(statsData?.eventstats ?? [])
  if (!events.length && FINISHED_MATCH_STATUSES.has(ev.strStatus)) {
    const fallback = await getFallbackMatchData(ev.idAPIfootball)
    if (fallback && goalsMatchScore(fallback.events, ev.intHomeScore, ev.intAwayScore)) {
      events = fallback.events
      if (!stats.length) stats = fallback.stats
    }
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
    // Минуту отдаёт только livescore: её подставляет страница (useLiveScores)
    progress: null,
    // У старых матчей timestamp бывает пустым, тогда страница покажет только дату
    timestamp: ev.strTimestamp ?? '',
    date: ev.dateEvent ?? '',
    leagueId: ev.idLeague,
    league: ev.strLeague,
    season: ev.strSeason,
    round: ev.intRound,
    venue: ev.strVenue,
    city: ev.strCity,
    video: getVideoUrl(ev.strVideo),
    events,
    stats,
  }

  return details
}, {
  maxAge: 60,
  getKey: event => `match-${getRouterParam(event, 'id')}`,
})
