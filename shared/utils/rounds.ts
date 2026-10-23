import type { Competition, SeasonMatch, SeasonRound } from '~/types'
import { buildBracket, getPlayoffMatches, getRoundSlug } from './bracket'
import { getMoscowDate } from './matches'

/** У лиг стыки и плей-офф в конце сезона — одна страница после последнего тура */
export const LEAGUE_PLAYOFF_ROUND = 'playoff'

/** Туры сезона по порядку и тур каждого матча (номер матча → id тура) */
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

/**
 * Номер тура из названия раунда: «Regular Season - 5», «League Stage - 3», «League A - 2» → 5, 3, 2.
 * У Бельгии после основного сезона группы «Championship Group - 31», «Relegation Group - 31»… — один тур 31.
 * null — раунд без номера: квалификация, плей-офф, стыки
 */
export function getRoundNumber(round: string): string | null {
  return /\s-\s(\d+)$/.exec(round)?.[1] ?? null
}

/** Туры лиги по номерам («5 тур»). Стыки и плей-офф в конце сезона — одна страница «Плей-офф» */
function getLeagueRounds(schedule: SeasonMatch[]): NamedRounds {
  const roundByMatch = new Map<string, string>()
  for (const match of schedule) {
    roundByMatch.set(match.id, getRoundNumber(match.round) ?? LEAGUE_PLAYOFF_ROUND)
  }
  const ids = [...new Set(roundByMatch.values())]
  const regular = ids.filter(id => id !== LEAGUE_PLAYOFF_ROUND).sort(byNumber)
  const rounds = regular.map(id => ({ id, name: `${id} тур` }))
  if (ids.includes(LEAGUE_PLAYOFF_ROUND)) rounds.push({ id: LEAGUE_PLAYOFF_ROUND, name: 'Плей-офф' })
  return { rounds, roundByMatch }
}

/**
 * Туры турнира: туры общего или группового этапа («3 тур»), потом раунды плей-офф с названиями
 * из сетки («Раунд плей-офф», «1/8 финала»…) и матч за 3-е место перед финалом. Квалификация ЛЧ/ЛЕ/ЛК
 * и стыковые матчи Лиги наций ни в один тур не попадают, их видно по датам.
 */
function getTournamentRounds(schedule: SeasonMatch[], competition: Pick<Competition, 'leaguePhase'>): NamedRounds {
  const roundByMatch = new Map<string, string>()
  const numbers = new Set<string>()
  for (const match of schedule) {
    const number = getRoundNumber(match.round)
    if (!number) continue
    roundByMatch.set(match.id, number)
    numbers.add(number)
  }
  const rounds: NamedRound[] = [...numbers].sort(byNumber).map(id => ({ id, name: `${id} тур` }))

  const playoffMatches = getPlayoffMatches(schedule)
  const { rounds: bracketRounds, thirdPlace } = buildBracket(playoffMatches, competition)
  const knockout = bracketRounds
    .filter(round => !round.projected)
    .map(round => ({ round: round.round, name: round.name }))
  const thirdPlaceMatch = thirdPlace && playoffMatches.find(match => match.id === thirdPlace.id)
  if (thirdPlaceMatch) knockout.splice(-1, 0, { round: getRoundSlug(thirdPlaceMatch.round), name: 'Матч за 3-е место' })

  for (const { round, name } of knockout) {
    const id = `playoff-${round}`
    for (const match of playoffMatches) {
      if (getRoundSlug(match.round) === round) roundByMatch.set(match.id, id)
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

function withDates(schedule: SeasonMatch[], { rounds, roundByMatch }: NamedRounds): SeasonRounds {
  const daysByRound = new Map<string, string[]>()
  for (const match of schedule) {
    const round = roundByMatch.get(match.id)
    if (!round) continue
    const days = daysByRound.get(round) ?? []
    days.push(getMoscowDate(match.timestamp))
    daysByRound.set(round, days)
  }
  return {
    rounds: rounds.map(round => ({ ...round, ...getRoundDates(round.id, (daysByRound.get(round.id) ?? []).sort()) })),
    roundByMatch,
  }
}

/** Туры сезона для навигации на главной */
export function getSeasonRounds(
  schedule: SeasonMatch[],
  competition: Pick<Competition, 'type' | 'leaguePhase'>,
): SeasonRounds {
  const named = competition.type === 'league' ? getLeagueRounds(schedule) : getTournamentRounds(schedule, competition)
  return withDates(schedule, named)
}

/** Дни сезона с матчами (YYYY-MM-DD по Москве, по порядку): точки в календаре на главной */
export function getMatchDays(schedule: Array<Pick<SeasonMatch, 'timestamp'>>): string[] {
  const days = new Set(schedule.map(match => getMoscowDate(match.timestamp)))
  return [...days].sort()
}

/**
 * Текущий тур — тур матча, ближайшего по времени к now, прошедшего или будущего. Так во вторник
 * после тура видны его результаты, а в четверг перед следующим — уже расписание следующего.
 */
export function getCurrentRound(schedule: SeasonMatch[], roundByMatch: Map<string, string>, now: Date): string | null {
  let current: string | null = null
  let nearest = Infinity
  for (const match of schedule) {
    const round = roundByMatch.get(match.id)
    if (!round) continue
    const distance = Math.abs(new Date(match.timestamp + 'Z').getTime() - now.getTime())
    if (distance < nearest) {
      nearest = distance
      current = round
    }
  }
  return current
}
