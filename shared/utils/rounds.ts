import type { BracketTie, Competition, SeasonRound } from '~/types'
import { buildBracket, getPlayoffMatches, type BracketScheduleMatch } from './bracket'
import { getLeaguePhaseMatches, getMoscowDate } from './matches'

/** У лиг стыки и плей-офф в конце сезона — одна страница после последнего тура */
export const LEAGUE_PLAYOFF_ROUND = 'playoff'

/** Туры сезона по порядку и тур каждого матча (idEvent → id тура) */
export type SeasonRounds = {
  rounds: SeasonRound[]
  roundByMatch: Map<string, string>
}

/** Тур без дат: их считает getSeasonRounds, когда все матчи уже разложены по турам */
type NamedRound = Pick<SeasonRound, 'id' | 'name'>

type NamedRounds = {
  rounds: NamedRound[]
  roundByMatch: Map<string, string>
}

/**
 * Пауза длиннее недели — это уже не тот же тур, а перенесённый матч: его в даты тура не берём,
 * иначе тур растянется на месяцы. Ответные матчи плей-офф идут через 6–7 дней и остаются в туре.
 */
const MAX_ROUND_GAP_DAYS = 7

const DAY_MS = 86_400_000

const byNumber = (a: string, b: string) => Number(a) - Number(b)

const isTieMatch = (tie: BracketTie, match: BracketScheduleMatch) =>
  [match.strHomeTeam, match.strAwayTeam].every(team => team && tie.teams.some(side => side.name === team))

/**
 * Туры лиги. Обычные туры в API под номерами 1–99 («5 тур»). В конце сезона бывают стыки
 * и плей-офф под кодами 0, 125, 160, 170, 180…: что они значат, зависит от лиги и сезона,
 * поэтому все они — одна страница «Плей-офф».
 */
function getLeagueRounds(schedule: BracketScheduleMatch[]): NamedRounds {
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
): NamedRounds {
  const roundByMatch = new Map<string, string>()

  const groupRounds = new Set(competition.groupRounds ?? [])
  const stageMatches = competition.leaguePhase
    ? getLeaguePhaseMatches(schedule)
    : schedule.filter(match => groupRounds.has(match.intRound))
  for (const match of stageMatches) roundByMatch.set(match.idEvent, match.intRound)
  const rounds: NamedRound[] = [...new Set(stageMatches.map(match => match.intRound))]
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

/**
 * Даты тура по Москве. Дни матчей (YYYY-MM-DD, по порядку, повторяются) делим на куски там,
 * где пауза длиннее недели, и берём кусок, где больше всего матчей.
 */
function getRoundDates(id: string, days: string[]): Pick<SeasonRound, 'from' | 'to'> {
  // «Плей-офф» лиги — несколько раундов на одной странице (у МЛС с перерывом на матчи сборных):
  // паузы между раундами — не переносы, даты берём целиком
  if (id === LEAGUE_PLAYOFF_ROUND) return { from: days[0] ?? null, to: days.at(-1) ?? null }

  let best: string[] = []
  let current: string[] = []
  for (const day of days) {
    const last = current.at(-1)
    if (last && Date.parse(day) - Date.parse(last) > MAX_ROUND_GAP_DAYS * DAY_MS) current = []
    current.push(day)
    if (current.length > best.length) best = current
  }
  return { from: best[0] ?? null, to: best.at(-1) ?? null }
}

function withDates(schedule: BracketScheduleMatch[], { rounds, roundByMatch }: NamedRounds): SeasonRounds {
  const daysByRound = new Map<string, string[]>()
  for (const match of schedule) {
    const round = roundByMatch.get(match.idEvent)
    if (!round || !match.strTimestamp) continue
    const days = daysByRound.get(round) ?? []
    days.push(getMoscowDate(match.strTimestamp))
    daysByRound.set(round, days)
  }
  return {
    rounds: rounds.map(round => ({ ...round, ...getRoundDates(round.id, (daysByRound.get(round.id) ?? []).sort()) })),
    roundByMatch,
  }
}

/** Туры сезона для навигации на главной */
export function getSeasonRounds(
  schedule: BracketScheduleMatch[],
  competition: Pick<Competition, 'type' | 'groupRounds' | 'leaguePhase'>,
): SeasonRounds {
  const named = competition.type === 'league' ? getLeagueRounds(schedule) : getTournamentRounds(schedule, competition)
  return withDates(schedule, named)
}

/** Дни сезона с матчами (YYYY-MM-DD по Москве, по порядку): точки в календаре на главной */
export function getMatchDays(schedule: Array<{ strTimestamp: string }>): string[] {
  const days = new Set(schedule.filter(match => match.strTimestamp).map(match => getMoscowDate(match.strTimestamp)))
  return [...days].sort()
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
