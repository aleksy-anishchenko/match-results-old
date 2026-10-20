import type { LineupPlayer, MatchLineups, TeamLineup } from '~/types'
import type { ApiFootballFixture, ApiFootballLineupPlayer } from './matchEvents'

/** Порядок линий, если у игроков нет grid: вратарь, защитники, полузащитники, нападающие */
const POSITION_ORDER = ['G', 'D', 'M', 'F']

const toPlayer = ({ player }: ApiFootballLineupPlayer): LineupPlayer => ({ number: player.number, name: player.name })

/** Линия по позиции; неизвестная позиция — последней, после нападающих */
function positionLine(pos: string | null): number {
  const index = POSITION_ORDER.indexOf(pos ?? '')
  return index === -1 ? POSITION_ORDER.length : index
}

/**
 * Стартовые по линиям. Линию даёт grid («2:4» — вторая линия, защитники); схема 4-1-4-1 — это пять линий
 * с опорным отдельно. Без grid делим по позиции. Внутри линии — порядок API
 */
function toLines(startXI: ApiFootballLineupPlayer[]): LineupPlayer[][] {
  const hasGrid = startXI.every(({ player }) => player.grid)
  const lineOf = ({ player }: ApiFootballLineupPlayer) => hasGrid
    ? Number(player.grid!.split(':')[0])
    : positionLine(player.pos)
  const lines = new Map<number, LineupPlayer[]>()
  for (const item of startXI) {
    const line = lineOf(item)
    lines.set(line, [...lines.get(line) ?? [], toPlayer(item)])
  }
  return [...lines.entries()].sort(([a], [b]) => a - b).map(([, players]) => players)
}

/** Составы обеих команд из ответа API-Football; null — составов нет или не у обеих команд */
export function getApiFootballLineups(fixture: ApiFootballFixture): MatchLineups | null {
  const lineup = (teamId: number): TeamLineup | null => {
    const team = fixture.lineups?.find(item => item.team.id === teamId)
    if (!team?.startXI.length) return null
    return {
      formation: team.formation || null,
      lines: toLines(team.startXI),
      substitutes: team.substitutes.map(toPlayer),
      coach: team.coach?.name || null,
    }
  }
  const home = lineup(fixture.teams.home.id)
  const away = lineup(fixture.teams.away.id)
  return home && away ? { home, away } : null
}
