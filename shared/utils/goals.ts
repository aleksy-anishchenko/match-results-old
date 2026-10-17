import type { MatchGoal } from '~/types'

/** Событие из lookuptimeline TheSportsDB: поля, нужные для голов */
export type TimelineEvent = {
  intTime: string | null
  strTimeline: string
  strTimelineDetail: string | null
  strPlayer: string | null
  /** «Yes» — гол засчитан хозяевам. Автогол API приписывает команде, которой он засчитан */
  strHome: string | null
  strComment: string | null
}

const GOAL_KINDS: Record<string, MatchGoal['kind']> = {
  'Normal Goal': 'goal',
  'Penalty': 'penalty',
  'Own Goal': 'own-goal',
}

/**
 * Голы матча из ленты событий, по минутам. Серия пенальти после матча (комментарий
 * «Penalty Shootout») и незабитые пенальти — не голы. Отменённый VAR гол в ленте —
 * отдельное событие Var, в голы он не попадает.
 */
export function getMatchGoals(timeline: TimelineEvent[]): MatchGoal[] {
  return timeline
    .filter(event => event.strTimeline === 'Goal' && event.strComment !== 'Penalty Shootout')
    .flatMap((event): MatchGoal[] => {
      const kind = GOAL_KINDS[event.strTimelineDetail ?? '']
      if (!kind) return []
      return [{
        minute: Number(event.intTime ?? 0),
        player: event.strPlayer ?? '',
        side: event.strHome === 'Yes' ? 'home' : 'away',
        kind,
      }]
    })
    .sort((a, b) => a.minute - b.minute)
}

/**
 * Голы сходятся со счётом. Лента есть не у всех лиг (у РПЛ и Саудовской лиги пустая) и во время
 * матча может отставать от счёта — тогда голы не показываем: неполный список выглядит как ошибка.
 */
export function goalsMatchScore(goals: MatchGoal[], homeScore: string | null, awayScore: string | null): boolean {
  const count = (side: MatchGoal['side']) => goals.filter(goal => goal.side === side).length
  return count('home') === Number(homeScore ?? 0) && count('away') === Number(awayScore ?? 0)
}
