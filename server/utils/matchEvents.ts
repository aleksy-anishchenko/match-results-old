import type { MatchEvent } from '~/types'
import { isGoalEvent, type GoalEventKind } from '#shared/utils/matches'
import type { ApiFootballFixture } from './matchDetails'
import { decodeEntities } from './text'

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

const GOAL_KINDS: Record<string, GoalEventKind> = {
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
