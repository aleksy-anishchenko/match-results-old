export type CompetitionType = 'league' | 'tournament'

/** Обобщённое состояние матча: ещё не начался, идёт, завершён, не состоится (перенесён/отменён) */
export type MatchStatusKind = 'scheduled' | 'live' | 'finished' | 'inactive'

export type Competition = {
  id: string
  name: string
  country: string
  type: CompetitionType
  category: string
  /** Для турниров: номера раундов группового этапа (всё остальное — плей-офф) */
  groupRounds?: string[]
  /**
   * Турнир с «общим этапом» (Лига чемпионов / Лига Европы): одна общая таблица
   * вместо групп. Раунды общего этапа определяются динамически по расписанию.
   */
  leaguePhase?: boolean
  /** Логотип преимущественно белый — показывать на тёмной подложке */
  whiteBadge?: boolean
}

export type CompetitionWithBadge = Competition & { badge: string | null }

export type Match = {
  idEvent: string
  homeTeam: string
  awayTeam: string
  homeBadge: string
  awayBadge: string
  homeScore: string | null
  awayScore: string | null
  homePenScore: number | null
  awayPenScore: number | null
  status: string
  progress: string | null
  timestamp: string
  date: string
  group: string | null
  season: string
}

export type MatchesResponse = {
  matches: Match[]
}

export type MatchDetails = {
  idEvent: string
  homeTeam: string
  awayTeam: string
  homeBadge: string
  awayBadge: string
  homeScore: string | null
  awayScore: string | null
  homePenScore: number | null
  awayPenScore: number | null
  status: string
  timestamp: string
  date: string
  leagueId: string
  league: string
  season: string
  round: string | null
  venue: string | null
  city: string | null
}

/**
 * Вид зоны в таблице. Уровни по силе клубного турнира:
 * tier1 — ЛЧ, Кубок Либертадорес, ЛЧ АФК, плей-офф МЛС;
 * tier2 — ЛЕ, Южноамериканский кубок, ЛЧ АФК 2;
 * tier3 — Лига конференций, Лига чемпионов Залива.
 * Суффикс -qual — квалификация или плей-офф за этот турнир. qual — квалификация,
 * когда API не уточняет, в какой турнир.
 */
export type StandingZoneKind
  = | 'tier1'
    | 'tier1-qual'
    | 'tier2'
    | 'tier2-qual'
    | 'tier3'
    | 'tier3-qual'
    | 'qual'
    | 'relegation-playoff'
    | 'relegation'

/** Куда попадает команда с этого места по итогам сезона */
export type StandingZone = {
  kind: StandingZoneKind
  label: string
}

export type GroupStanding = {
  team: string
  badge: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDiff: number
  points: number
  zone: StandingZone | null
}

export type StandingsResponse = {
  groups: Record<string, GroupStanding[]>
  /** Сезон из API: «2026-2027» или «2026» */
  season: string | null
}

export type BracketMatch = {
  idEvent: string
  homeTeam: string
  awayTeam: string
  homeBadge: string
  awayBadge: string
  homeScore: string | null
  awayScore: string | null
  homePenScore: number | null
  awayPenScore: number | null
  status: string
  timestamp: string
}

export type BracketRound = {
  round: string
  name: string
  matches: BracketMatch[]
  projected?: boolean
}

export type BracketResponse = {
  rounds: BracketRound[]
}
