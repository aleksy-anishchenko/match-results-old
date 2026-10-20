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
  /** Минута идущего матча («52») из livescore; null — время не идёт или минуты нет */
  progress: string | null
  timestamp: string
  date: string
  group: string | null
  season: string
  /** Тур матча — id из /api/rounds; null, если матч вне туров (квалификация ЛЧ/ЛЕ) */
  round: string | null
}

export type MatchesResponse = {
  matches: Match[]
}

/** Счёт и минута матча из livescore TheSportsDB: свежее расписания, где счёт отстаёт, а минуты нет */
export type LiveScore = {
  status: string
  /** Минута: «52»; null — нет */
  progress: string | null
  homeScore: string | null
  awayScore: string | null
}

export type LiveScoresResponse = {
  /** Ключ — idEvent. Только матчи лиги, которые сейчас в livescore: идущие и недавно закончившиеся */
  scores: Record<string, LiveScore>
}

/** Тур для навигации на главной: «5 тур», «1/8 финала», «Плей-офф» */
export type SeasonRound = {
  /** Для лиг и туров общего этапа — номер тура из API, для плей-офф турниров — playoff-<код раунда> */
  id: string
  name: string
  /** Первый и последний день тура по Москве (YYYY-MM-DD) без перенесённых матчей; null — дат нет в API */
  from: string | null
  to: string | null
}

export type RoundsResponse = {
  /** Сезон из API: «2026-2027» или «2026» */
  season: string | null
  rounds: SeasonRound[]
  /** Тур матча, ближайшего по времени к сейчас */
  current: string | null
  /** Дни сезона с матчами (YYYY-MM-DD по Москве): точки в календаре */
  matchDays: string[]
}

/** Дни на главной (YYYY-MM-DD по Москве), from и to включительно; один день — from === to */
export type DateRange = {
  from: string
  to: string
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
  /** Минута идущего матча, как у Match: сервер отдаёт null, на странице её подставляет useLiveScores */
  progress: string | null
  timestamp: string
  date: string
  leagueId: string
  league: string
  season: string
  round: string | null
  venue: string | null
  city: string | null
  /** Видеообзор — https-ссылка на YouTube; null — обзора нет */
  video: string | null
  /** Хроника по минутам из TheSportsDB или, если там её нет, из API-Football; пусто, если ни там, ни там голы не сходятся со счётом */
  events: MatchEvent[]
  /** Статистика из того же источника, что и хроника; пусто, если её нет */
  stats: MatchStat[]
}

/** Событие хроники матча: гол, карточка или замена */
export type MatchEvent = {
  minute: number
  /** Чьё событие. Автогол засчитан сопернику команды того, кто его забил */
  side: 'home' | 'away'
  kind: 'goal' | 'penalty' | 'own-goal' | 'yellow-card' | 'red-card' | 'substitution'
  /** Автор гола, игрок с карточкой или вышедший на замену. Латиницей, как в API */
  player: string
  /** Автор голевого паса; null — паса нет или это не гол */
  assist: string | null
  /** Кого заменили; null — это не замена */
  playerOut: string | null
}

/** Показатель статистики матча: «Удары», 22 у хозяев, 9 у гостей */
export type MatchStat = {
  label: string
  home: number
  away: number
  /** percent — владение («66%»), decimal — xG («3.39») */
  format: 'number' | 'percent' | 'decimal'
}

/**
 * Вид зоны в таблице. Уровни по силе клубного турнира:
 * tier1 — ЛЧ, Кубок Либертадорес, ЛЧ АФК, плей-офф МЛС, 1/8 финала из общего этапа ЛЧ/ЛЕ;
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

/** Команда в паре плей-офф: строка карточки сетки */
export type BracketTeam = {
  /** Название из API; пустая строка — соперник ещё не определён */
  name: string
  badge: string
  /** Голы в каждом матче пары по порядку; null — матч ещё не завершён */
  goals: Array<number | null>
  /** Счёт серии пенальти, если пара решилась пенальти и API его отдал */
  penalties: number | null
}

/** Пара плей-офф: один матч или два (дома и в гостях) */
export type BracketTie = {
  /** idEvent первого матча пары */
  id: string
  teams: [BracketTeam, BracketTeam]
  /** Кто прошёл дальше: индекс в teams */
  winner: 0 | 1 | null
}

export type BracketRound = {
  round: string
  name: string
  ties: BracketTie[]
  projected?: boolean
}

export type BracketResponse = {
  rounds: BracketRound[]
  /** Матч за 3-е место: не в сетке, а отдельной карточкой под финалом */
  thirdPlace: BracketTie | null
}
