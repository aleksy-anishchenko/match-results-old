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
  time: string
  league: string
  season: string
  round: string | null
  venue: string | null
  city: string | null
  country: string | null
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
}

export type StandingsResponse = {
  groups: Record<string, GroupStanding[]>
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
