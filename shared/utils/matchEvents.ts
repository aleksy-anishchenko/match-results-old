import type { MatchEvent } from '~/types'
import { decodeEntities } from './text'

/**
 * Матч из API-Football (fixtures?id=…): поля, нужные странице матча — шапке, хронике, статистике и составам.
 * Списки обычно приходят и пустыми, но если какого-то нет, разбор не должен падать — поэтому они необязательные
 */
export type ApiFootballFixture = {
  fixture: {
    id: number
    /** Начало матча, секунды Unix */
    timestamp: number
    venue: { name: string | null, city: string | null }
    status: { short: string }
  }
  /** round — как в расписании: «Regular Season - 11», «Final» */
  league: { id: number, name: string, season: number, round: string }
  teams: { home: { id: number, name: string, logo: string }, away: { id: number, name: string, logo: string } }
  goals: { home: number | null, away: number | null }
  score: { penalty: { home: number | null, away: number | null } }
  events?: Array<{
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
  statistics?: Array<{
    team: { id: number }
    statistics: Array<{ type: string, value: number | string | null }>
  }>
  /** По команде на каждую; пусто, если составов нет */
  lineups?: Array<{
    team: { id: number }
    formation: string | null
    startXI: ApiFootballLineupPlayer[]
    substitutes: ApiFootballLineupPlayer[]
    coach: { name: string | null } | null
  }>
}

/** Игрок в составе API-Football. grid — «линия:место», линия 1 — вратарь; pos — G, D, M, F */
export type ApiFootballLineupPlayer = {
  player: { name: string, number: number | null, pos: string | null, grid: string | null }
}

/** Событие из ответа в общем виде: сторона уже по номеру команды */
type RawEvent = {
  minute: number
  extra: number | null
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

// Вторая жёлтая — это удаление: показываем красной
const CARD_KINDS: Record<string, MatchEvent['kind']> = {
  'Yellow Card': 'yellow-card',
  'Second Yellow card': 'red-card',
  'Red Card': 'red-card',
}

const GOAL_EVENT_KINDS = new Set<MatchEvent['kind']>(Object.values(GOAL_KINDS))

/** Гол: обычный, с пенальти или автогол */
export const isGoalEvent = (event: Pick<MatchEvent, 'kind'>) => GOAL_EVENT_KINDS.has(event.kind)

/**
 * Голы, карточки и замены по минутам. Серия пенальти после матча (комментарий «Penalty Shootout»),
 * незабитые пенальти и решения VAR в хронику не попадают: отменённый гол в ленте — отдельное событие Var,
 * в голах его нет. Замену без вышедшего игрока пропускаем — показать «вместо …» не про кого.
 */
function toMatchEvents(events: RawEvent[]): MatchEvent[] {
  return events
    .filter(event => event.comment !== 'Penalty Shootout')
    .flatMap((event): MatchEvent[] => {
      const base = { minute: event.minute, extra: event.extra, side: event.side }
      if (event.type === 'subst') {
        return event.assist
          ? [{ ...base, kind: 'substitution', player: event.assist, assist: null, playerOut: event.player || null }]
          : []
      }
      const kind = event.type === 'Goal' ? GOAL_KINDS[event.detail] : event.type === 'Card' ? CARD_KINDS[event.detail] : undefined
      if (!kind) return []
      const assist = isGoalEvent({ kind }) ? event.assist || null : null
      return [{ ...base, kind, player: event.player ?? '', assist, playerOut: null }]
    })
    .sort((a, b) => a.minute - b.minute || (a.extra ?? 0) - (b.extra ?? 0))
}

/**
 * Хроника матча из событий API-Football. Автогол записан на команду, которой он засчитан,
 * поэтому сторону берём по команде события
 */
export function getApiFootballEvents(fixture: ApiFootballFixture): MatchEvent[] {
  const homeId = fixture.teams.home.id
  return toMatchEvents((fixture.events ?? []).map(event => ({
    minute: event.time.elapsed ?? 0,
    extra: event.time.extra,
    side: event.team.id === homeId ? 'home' : 'away',
    type: event.type,
    detail: event.detail,
    comment: event.comments,
    player: event.player.name && decodeEntities(event.player.name),
    assist: event.assist.name && decodeEntities(event.assist.name),
  })))
}

/**
 * Голы хроники сходятся со счётом. Хроника бывает неполной, а во время матча может отставать
 * от счёта — тогда её не показываем: неполный список голов выглядит как ошибка.
 */
export function goalsMatchScore(events: MatchEvent[], homeScore: string | null, awayScore: string | null): boolean {
  const count = (side: MatchEvent['side']) => events.filter(event => event.side === side && isGoalEvent(event)).length
  return count('home') === Number(homeScore ?? 0) && count('away') === Number(awayScore ?? 0)
}
