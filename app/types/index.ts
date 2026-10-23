export type CompetitionType = 'league' | 'tournament'

/** Обобщённое состояние матча: ещё не начался, идёт, завершён, не состоится (перенесён/отменён) */
export type MatchStatusKind = 'scheduled' | 'live' | 'finished' | 'inactive'

export type Competition = {
  id: string
  name: string
  country: string
  type: CompetitionType
  category: string
  /**
   * Турнир с «общим этапом» (Лига чемпионов / Лига Европы): одна общая таблица вместо групп,
   * зоны в ней по месту, первый раунд плей-офф — раунд плей-офф перед 1/8
   */
  leaguePhase?: boolean
}

export type Match = {
  /** Номер матча в API-Football: по нему адрес страницы матча и живой счёт */
  id: string
  homeTeam: string
  awayTeam: string
  homeBadge: string
  awayBadge: string
  homeScore: string | null
  awayScore: string | null
  homePenScore: number | null
  awayPenScore: number | null
  status: string
  /** Минута идущего матча («52», «45+2») из /api/live; null — время не идёт или минуты нет */
  progress: string | null
  timestamp: string
  /** Тур матча — id из /api/rounds; null, если матч вне туров (квалификация ЛЧ/ЛЕ) */
  round: string | null
}

/** Команда в матче API-Football: номер, название (по-русски, если есть перевод) и эмблема */
export type SeasonTeam = {
  /** null — в ответе нет номера: такую команду не склеиваем в пару сетки */
  id: number | null
  name: string
  badge: string
}

/** Матч из расписания сезона API-Football — общий вид для туров, сетки и списков матчей */
export type SeasonMatch = {
  id: string
  /** Раунд, как в API: «Regular Season - 5», «League Stage - 3», «Quarter-finals» */
  round: string
  /** Начало матча в UTC без смещения: «2026-10-25T16:30:00» — такое время ждут getMoscowDate и formatMoscowTime */
  timestamp: string
  status: string
  home: SeasonTeam
  away: SeasonTeam
  /** Голы с дополнительным временем, без серии пенальти; null — матч не начался */
  homeScore: number | null
  awayScore: number | null
  /** Счёт серии пенальти; null — серии не было */
  homePenalties: number | null
  awayPenalties: number | null
}

export type MatchesResponse = {
  matches: Match[]
}

/** Счёт и минута идущего матча из API-Football: свежее расписания, которое хранится несколько минут */
export type LiveScore = {
  status: string
  /** Минута: «52», «45+2»; null — время не идёт (перерыв, пенальти, матч закончен) */
  progress: string | null
  homeScore: string | null
  awayScore: string | null
  /** Счёт серии пенальти; null — серии нет */
  homePenScore: number | null
  awayPenScore: number | null
}

export type LiveScoresResponse = {
  /** Ключ — номер матча. Только матчи, о которых спросила страница, и только из турниров сайта */
  scores: Record<string, LiveScore>
}

/** Тур для навигации на главной: «5 тур», «1/8 финала», «Плей-офф» */
export type SeasonRound = {
  /** Номер тура («5»), «playoff» — стыки и плей-офф лиги, у турнира раунд плей-офф — playoff-<раунд API> («playoff-round-of-16») */
  id: string
  name: string
  /** Первый и последний день тура по Москве (YYYY-MM-DD) без перенесённых матчей; null — дат нет в API */
  from: string | null
  to: string | null
}

export type RoundsResponse = {
  /** Сезон — год его начала: «2026» и у сезона 2026/27, и у МЛС 2026 */
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
  /** Номер матча в API-Football */
  id: string
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
  leagueId: string
  league: string
  round: string | null
  venue: string | null
  city: string | null
  /** Хроника по минутам; у сыгранного матча пусто, если голы хроники не сходятся со счётом */
  events: MatchEvent[]
  /** Статистика матча; пусто, если её нет */
  stats: MatchStat[]
  /** Составы: у будущего матча появляются примерно за 20–40 минут до начала; null — нет */
  lineups: MatchLineups | null
}

/** Игрок в составе. Имя латиницей и часто сокращённое, как в API-Football: «P. Solari» */
export type LineupPlayer = {
  number: number | null
  name: string
}

export type TeamLineup = {
  /** Схема: «4-1-4-1»; null — API не прислал */
  formation: string | null
  /** Стартовые по линиям, от вратаря к нападающим */
  lines: LineupPlayer[][]
  substitutes: LineupPlayer[]
  coach: string | null
}

export type MatchLineups = {
  home: TeamLineup
  away: TeamLineup
}

/** Событие хроники матча: гол, карточка или замена */
export type MatchEvent = {
  minute: number
  /** Добавленное время: у гола на 90+3 minute 90, extra 3; null — не добавленное */
  extra: number | null
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
  /** Сезон — год его начала: «2026» */
  season: string | null
}

/** Команда в паре плей-офф: строка карточки сетки */
export type BracketTeam = {
  /** Номер команды в API-Football; null — соперник ещё не определён */
  id: number | null
  /** Название (по-русски, если есть перевод); пустая строка — соперник ещё не определён */
  name: string
  badge: string
  /** Голы в каждом матче пары по порядку; null — матч ещё не завершён */
  goals: Array<number | null>
  /** Счёт серии пенальти, если пара решилась пенальти и API его отдал */
  penalties: number | null
}

/** Пара плей-офф: один матч или два (дома и в гостях) */
export type BracketTie = {
  /** Номер первого матча пары */
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
