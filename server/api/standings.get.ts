import type { GroupStanding, StandingsResponse } from '~/types'

type ApiMatch = {
  strHomeTeam: string
  strAwayTeam: string
  strHomeTeamBadge: string
  strAwayTeamBadge: string
  intHomeScore: string | null
  intAwayScore: string | null
  strStatus: string
  intRound: string
  strSeason: string
}

type TableRow = {
  strTeam: string
  strBadge: string | null
  strGroup: string | null
  strDescription: string | null
  strSeason: string | null
  intPlayed: string
  intWin: string
  intDraw: string
  intLoss: string
  intGoalsFor: string
  intGoalsAgainst: string
  intGoalDifference: string
  intPoints: string
}

type TableResponse = {
  table: TableRow[] | null
}

export default cachedEventHandler(async (event): Promise<StandingsResponse> => {
  const config = useRuntimeConfig()
  const query = getQuery(event)
  const leagueId = String(query.leagueId ?? DEFAULT_COMPETITION_ID)
  const competition = getCompetition(leagueId)

  // Готовую таблицу (в т.ч. с группами для сборных) отдаёт lookuptable
  const tableData = await $fetch<TableResponse>(
    `https://www.thesportsdb.com/api/v1/json/${config.theSportsDbApiKey}/lookuptable.php?l=${leagueId}`,
  ).catch(() => null)

  const rows = tableData?.table
  if (rows && rows.length) {
    const groups: Record<string, GroupStanding[]> = {}
    for (const row of rows) {
      const group = row.strGroup ? formatGroupName(row.strGroup) : 'Таблица'
      if (!groups[group]) groups[group] = []
      groups[group]!.push({
        team: row.strTeam,
        badge: row.strBadge ?? '',
        played: parseInt(row.intPlayed ?? '0'),
        won: parseInt(row.intWin ?? '0'),
        drawn: parseInt(row.intDraw ?? '0'),
        lost: parseInt(row.intLoss ?? '0'),
        goalsFor: parseInt(row.intGoalsFor ?? '0'),
        goalsAgainst: parseInt(row.intGoalsAgainst ?? '0'),
        goalDiff: parseInt(row.intGoalDifference ?? '0'),
        points: parseInt(row.intPoints ?? '0'),
        // Зоны из API только у лиг: в турнирах описания про сетку («Round of 32»),
        // а выход из группы считает страница по правилам турнира
        zone: competition?.type === 'league' ? getStandingZone(row.strDescription, leagueId) : null,
      })
    }
    return { groups: sortGroups(groups), season: rows[0]?.strSeason ?? null }
  }

  // Фолбэк: для турниров без таблицы (например, общий этап ЛЧ) считаем сами
  const season = await getCurrentSeason(leagueId)
  if (!season) return { groups: {}, season: null }

  const schedule = await getSeasonSchedule<ApiMatch>(leagueId, season)

  // Общий этап (ЛЧ/ЛЕ) отбираем без квалификации, групповой этап — по номерам раундов из конфига (Лига наций)
  const groupRounds = new Set(competition?.groupRounds ?? [])
  const groupMatches = competition?.leaguePhase
    ? getLeaguePhaseMatches(schedule)
    : schedule.filter(match => groupRounds.has(match.intRound))

  if (!groupMatches.length) return { groups: {}, season }

  // Зоны по месту только у общего этапа ЛЧ/ЛЕ: у Лиги наций все группы в одной таблице
  const standings = calculateStandings(groupMatches)
  const table = competition?.leaguePhase
    ? standings.map((row, index) => ({ ...row, zone: getLeaguePhaseZone(index + 1) }))
    : standings

  return { groups: { [competition?.name ?? 'Таблица']: table }, season }
}, {
  maxAge: 60,
  getKey: event => `standings-${getQuery(event).leagueId ?? DEFAULT_COMPETITION_ID}`,
})
