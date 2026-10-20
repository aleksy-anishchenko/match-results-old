import type { MatchEvent } from '~/types'

/** Событие из lookuptimeline TheSportsDB: поля, нужные для хроники */
export type TimelineEvent = {
  intTime: string | null
  strTimeline: string
  strTimelineDetail: string | null
  /** У замены — ушедший с поля */
  strPlayer: string | null
  /** У гола — автор паса, у замены — вышедший на поле; пустая строка — нет */
  strAssist: string | null
  /** «Yes» — событие хозяев. Автогол API приписывает команде, которой он засчитан */
  strHome: string | null
  strComment: string | null
}

/** Матч из API-Football (fixtures?id=…): поля, нужные для хроники и статистики */
export type ApiFootballFixture = {
  fixture: { status: { short: string } }
  teams: { home: { id: number }, away: { id: number } }
  goals: { home: number | null, away: number | null }
  events: Array<{
    time: { elapsed: number | null, extra: number | null }
    team: { id: number }
    /** У замены — ушедший с поля */
    player: { name: string | null }
    /** У гола — автор паса, у замены — вышедший на поле */
    assist: { name: string | null }
    type: string
    detail: string
    comments: string | null
  }>
  /** По команде на каждую; пусто, если статистики у матча нет */
  statistics: Array<{
    team: { id: number }
    statistics: Array<{ type: string, value: number | string | null }>
  }>
}

/** Событие любого из двух API: устроены они одинаково, разные только названия полей */
type RawEvent = {
  minute: number
  side: MatchEvent['side']
  type: string
  detail: string
  comment: string | null
  player: string | null
  assist: string | null
}

const GOAL_KINDS: Record<string, MatchEvent['kind']> = {
  'Normal Goal': 'goal',
  'Penalty': 'penalty',
  'Own Goal': 'own-goal',
}

const CARD_KINDS: Record<string, MatchEvent['kind']> = {
  'Yellow Card': 'yellow-card',
  'Red Card': 'red-card',
}

const GOAL_EVENT_KINDS = new Set<MatchEvent['kind']>(Object.values(GOAL_KINDS))

/**
 * Голы, карточки и замены по минутам. Серия пенальти после матча (комментарий «Penalty Shootout»),
 * незабитые пенальти и решения VAR в хронику не попадают: отменённый гол в ленте — отдельное событие Var,
 * в голах его нет. Замену без вышедшего игрока пропускаем — показать «вместо …» не про кого.
 */
function toMatchEvents(events: RawEvent[]): MatchEvent[] {
  return events
    .filter(event => event.comment !== 'Penalty Shootout')
    .flatMap((event): MatchEvent[] => {
      const base = { minute: event.minute, side: event.side }
      if (event.type === 'subst') {
        return event.assist
          ? [{ ...base, kind: 'substitution', player: event.assist, assist: null, playerOut: event.player || null }]
          : []
      }
      const kind = event.type === 'Goal' ? GOAL_KINDS[event.detail] : event.type === 'Card' ? CARD_KINDS[event.detail] : undefined
      if (!kind) return []
      const assist = GOAL_EVENT_KINDS.has(kind) ? event.assist || null : null
      return [{ ...base, kind, player: event.player ?? '', assist, playerOut: null }]
    })
    .sort((a, b) => a.minute - b.minute)
}

/** Хроника матча из ленты событий TheSportsDB */
export function getTimelineEvents(timeline: TimelineEvent[]): MatchEvent[] {
  return toMatchEvents(timeline.map(event => ({
    minute: Number(event.intTime ?? 0),
    side: event.strHome === 'Yes' ? 'home' : 'away',
    type: event.strTimeline,
    detail: event.strTimelineDetail ?? '',
    comment: event.strComment,
    player: event.strPlayer,
    assist: event.strAssist,
  })))
}

/**
 * Хроника матча из событий API-Football. Как и у TheSportsDB, автогол записан на команду,
 * которой он засчитан, поэтому сторону берём по команде события
 */
export function getApiFootballEvents(fixture: ApiFootballFixture): MatchEvent[] {
  const homeId = fixture.teams.home.id
  return toMatchEvents(fixture.events.map(event => ({
    minute: event.time.elapsed ?? 0,
    side: event.team.id === homeId ? 'home' : 'away',
    type: event.type,
    detail: event.detail,
    comment: event.comments,
    player: event.player.name,
    assist: event.assist.name,
  })))
}

/**
 * Голы хроники сходятся со счётом. Лента есть не у всех лиг (у РПЛ и Саудовской лиги пустая) и во время
 * матча может отставать от счёта — тогда хронику не показываем: неполный список голов выглядит как ошибка.
 */
export function goalsMatchScore(events: MatchEvent[], homeScore: string | null, awayScore: string | null): boolean {
  const count = (side: MatchEvent['side']) => events.filter(event => event.side === side && GOAL_EVENT_KINDS.has(event.kind)).length
  return count('home') === Number(homeScore ?? 0) && count('away') === Number(awayScore ?? 0)
}
