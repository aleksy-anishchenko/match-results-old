import type { BracketTie, Competition, SeasonRound } from '~/types'
import { buildBracket, getPlayoffMatches, type BracketScheduleMatch } from './bracket'
import { getLeaguePhaseMatches } from './matches'

/** У лиг стыки и плей-офф в конце сезона — одна страница после последнего тура */
export const LEAGUE_PLAYOFF_ROUND = 'playoff'

/** Туры сезона по порядку и тур каждого матча (idEvent → id тура) */
export type SeasonRounds = {
  rounds: SeasonRound[]
  roundByMatch: Map<string, string>
}

const byNumber = (a: string, b: string) => Number(a) - Number(b)

const isTieMatch = (tie: BracketTie, match: BracketScheduleMatch) =>
  [match.strHomeTeam, match.strAwayTeam].every(team => team && tie.teams.some(side => side.name === team))

/**
 * Туры лиги. Обычные туры в API под номерами 1–99 («5 тур»). В конце сезона бывают стыки
 * и плей-офф под кодами 0, 125, 160, 170, 180…: что они значат, зависит от лиги и сезона,
 * поэтому все они — одна страница «Плей-офф».
 */
function getLeagueRounds(schedule: BracketScheduleMatch[]): SeasonRounds {
  const roundByMatch = new Map<string, string>()
  for (const match of schedule) {
    const number = Number(match.intRound)
    roundByMatch.set(match.idEvent, number >= 1 && number < 100 ? String(number) : LEAGUE_PLAYOFF_ROUND)
  }
  const ids = [...new Set(roundByMatch.values())]
  const regular = ids.filter(id => id !== LEAGUE_PLAYOFF_ROUND).sort(byNumber)
  const rounds = regular.map(id => ({ id, name: `${id} тур` }))
  if (ids.includes(LEAGUE_PLAYOFF_ROUND)) rounds.push({ id: LEAGUE_PLAYOFF_ROUND, name: 'Плей-офф' })
  return { rounds, roundByMatch }
}

/**
 * Туры турнира: туры общего или группового этапа («3 тур»), потом раунды плей-офф с названиями
 * из сетки («Раунд плей-офф», «1/8 финала»…) и матч за 3-е место перед финалом. Матчи вне них —
 * квалификация ЛЧ/ЛЕ, стыковые матчи Лиги наций — ни в один тур не попадают, их видно по датам.
 */
function getTournamentRounds(
  schedule: BracketScheduleMatch[],
  competition: Pick<Competition, 'groupRounds' | 'leaguePhase'>,
): SeasonRounds {
  const roundByMatch = new Map<string, string>()

  const groupRounds = new Set(competition.groupRounds ?? [])
  const stageMatches = competition.leaguePhase
    ? getLeaguePhaseMatches(schedule)
    : schedule.filter(match => groupRounds.has(match.intRound))
  for (const match of stageMatches) roundByMatch.set(match.idEvent, match.intRound)
  const rounds: SeasonRound[] = [...new Set(stageMatches.map(match => match.intRound))]
    .sort(byNumber)
    .map(id => ({ id, name: `${id} тур` }))

  const playoffMatches = getPlayoffMatches(schedule, competition)
  const { rounds: bracketRounds, thirdPlace } = buildBracket(playoffMatches, {}, competition)
  const knockout = bracketRounds
    .filter(round => !round.projected)
    .map(round => ({ round: round.round, name: round.name, ties: round.ties }))
  if (thirdPlace) {
    const code = playoffMatches.find(match => match.idEvent === thirdPlace.id)?.intRound
    if (code) knockout.splice(-1, 0, { round: code, name: 'Матч за 3-е место', ties: [thirdPlace] })
  }

  for (const { round, name, ties } of knockout) {
    const id = `playoff-${round}`
    // В одном раунде API бывают и чужие матчи (стыковые в Лиге наций): в тур только матчи пар сетки
    for (const match of playoffMatches) {
      if (match.intRound === round && ties.some(tie => isTieMatch(tie, match))) roundByMatch.set(match.idEvent, id)
    }
    rounds.push({ id, name })
  }

  return { rounds, roundByMatch }
}

/** Туры сезона для навигации на главной */
export function getSeasonRounds(
  schedule: BracketScheduleMatch[],
  competition: Pick<Competition, 'type' | 'groupRounds' | 'leaguePhase'>,
): SeasonRounds {
  return competition.type === 'league' ? getLeagueRounds(schedule) : getTournamentRounds(schedule, competition)
}

/**
 * Текущий тур — тур матча, ближайшего по времени к now, прошедшего или будущего. Так во вторник
 * после тура видны его результаты, а в четверг перед следующим — уже расписание следующего.
 */
export function getCurrentRound(schedule: BracketScheduleMatch[], roundByMatch: Map<string, string>, now: Date): string | null {
  let current: string | null = null
  let nearest = Infinity
  for (const match of schedule) {
    const round = roundByMatch.get(match.idEvent)
    if (!round || !match.strTimestamp) continue
    const distance = Math.abs(new Date(match.strTimestamp + 'Z').getTime() - now.getTime())
    if (distance < nearest) {
      nearest = distance
      current = round
    }
  }
  return current
}
