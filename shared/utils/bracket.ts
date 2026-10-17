import type { BracketResponse, BracketRound, BracketTeam, BracketTie, Competition } from '~/types'
import { FINISHED_MATCH_STATUSES, getRoundCounts, isPowerOfTwo } from './matches'

/** Матч из расписания TheSportsDB: поля, нужные для сетки плей-офф */
export type BracketScheduleMatch = {
  idEvent: string
  strHomeTeam: string
  strAwayTeam: string
  strHomeTeamBadge: string
  strAwayTeamBadge: string
  intHomeScore: string | null
  intAwayScore: string | null
  strStatus: string
  strTimestamp: string
  intRound: string
}

/** Счёт серии пенальти по idEvent (его отдаёт только lookupevent) */
export type BracketPenaltyScores = Record<string, { home: number | null, away: number | null }>

/**
 * Матчи плей-офф из расписания сезона. У турниров с общим этапом (ЛЧ/ЛЕ) в расписании лежат
 * ещё и матчи квалификации — оставляем только раунды плей-офф (степени двойки: 16/8/4/2/1).
 * У турниров с группами плей-офф — всё, что не групповой этап.
 */
export function getPlayoffMatches<T extends BracketScheduleMatch>(
  schedule: T[],
  competition: Pick<Competition, 'groupRounds' | 'leaguePhase'>,
): T[] {
  if (competition.leaguePhase) {
    const knockoutRounds = new Set(
      [...getRoundCounts(schedule).entries()]
        .filter(([, count]) => isPowerOfTwo(count))
        .map(([round]) => round),
    )
    return schedule.filter(match => knockoutRounds.has(match.intRound))
  }

  const groupRounds = new Set(competition.groupRounds ?? [])
  return schedule.filter(match => !groupRounds.has(match.intRound))
}

/** Сумма голов команды за сыгранные матчи пары; null — ни один матч ещё не завершён */
export function getTieTotal(team: BracketTeam): number | null {
  const played = team.goals.filter(goals => goals != null)
  return played.length ? played.reduce((sum, goals) => sum + goals, 0) : null
}

const byTimestamp = (a: BracketScheduleMatch, b: BracketScheduleMatch) => a.strTimestamp.localeCompare(b.strTimestamp)

const playsIn = (match: BracketScheduleMatch, team: string) => match.strHomeTeam === team || match.strAwayTeam === team

function teamOfTie(legs: BracketScheduleMatch[], name: string, badge: string, penScoreMap: BracketPenaltyScores): BracketTeam {
  const goals = legs.map((leg) => {
    if (!FINISHED_MATCH_STATUSES.has(leg.strStatus)) return null
    const score = leg.strHomeTeam === name ? leg.intHomeScore : leg.intAwayScore
    return score == null ? null : Number(score)
  })
  // Серия пенальти бывает только в последнем матче пары
  const lastLeg = legs.at(-1)!
  const penalties = penScoreMap[lastLeg.idEvent]
  return {
    name,
    badge,
    goals,
    penalties: (lastLeg.strHomeTeam === name ? penalties?.home : penalties?.away) ?? null,
  }
}

/**
 * Кто прошёл дальше. Сначала смотрим, кто из двоих играл после пары: это надёжнее счёта,
 * потому что в ЛЧ 2024/25 у пар, решённых серией пенальти, статус FT и счёта серии нет.
 * Если после пары играли обе команды (полуфинал, потом финал и матч за 3-е место),
 * решает счёт: сумма, потом пенальти. Пока не все матчи пары завершены, победителя нет.
 */
function tieWinner(
  teams: [BracketTeam, BracketTeam],
  legs: BracketScheduleMatch[],
  playoffMatches: BracketScheduleMatch[],
): 0 | 1 | null {
  const [first, second] = teams
  const lastTimestamp = legs.at(-1)!.strTimestamp
  const playedLater = (team: BracketTeam) => team.name !== ''
    && playoffMatches.some(match => match.strTimestamp > lastTimestamp && playsIn(match, team.name))
  if (playedLater(first) !== playedLater(second)) return playedLater(first) ? 0 : 1

  if (teams.some(team => team.goals.includes(null))) return null
  const firstTotal = getTieTotal(first) ?? 0
  const secondTotal = getTieTotal(second) ?? 0
  if (firstTotal !== secondTotal) return firstTotal > secondTotal ? 0 : 1

  if (first.penalties == null || second.penalties == null || first.penalties === second.penalties) return null
  return first.penalties > second.penalties ? 0 : 1
}

/**
 * Пары раунда: матчи одних и тех же двух команд — одна пара, один матч или два. Порядок пар —
 * по первому матчу, команды — как в первом матче (хозяин сверху). Матчи, где соперник ещё
 * не определён, не склеиваем: таких в раунде может быть несколько.
 */
export function buildTies(
  roundMatches: BracketScheduleMatch[],
  playoffMatches: BracketScheduleMatch[],
  penScoreMap: BracketPenaltyScores,
): BracketTie[] {
  const legsByTie = new Map<string, BracketScheduleMatch[]>()
  for (const match of [...roundMatches].sort(byTimestamp)) {
    const key = match.strHomeTeam && match.strAwayTeam
      ? [match.strHomeTeam, match.strAwayTeam].sort().join('\n')
      : match.idEvent
    legsByTie.set(key, [...(legsByTie.get(key) ?? []), match])
  }

  return [...legsByTie.values()].map((legs) => {
    const first = legs[0]!
    const teams: [BracketTeam, BracketTeam] = [
      teamOfTie(legs, first.strHomeTeam, first.strHomeTeamBadge, penScoreMap),
      teamOfTie(legs, first.strAwayTeam, first.strAwayTeamBadge, penScoreMap),
    ]
    return { id: first.idEvent, teams, winner: tieWinner(teams, legs, playoffMatches) }
  })
}

const ROUND_NAMES: Record<number, string> = {
  1: 'Финал',
  2: 'Полуфинал',
  4: 'Четвертьфинал',
  8: '1/8 финала',
  16: '1/16 финала',
}

/** Название раунда по числу пар. Раунд плей-офф ЛЧ/ЛЕ — пар столько же, сколько в 1/8 */
function getRoundName(tieCount: number, isPreRound: boolean): string {
  return isPreRound ? 'Раунд плей-офф' : ROUND_NAMES[tieCount] ?? 'Раунд'
}

const EMPTY_TEAM: BracketTeam = { name: '', badge: '', goals: [], penalties: null }

/** Команда будущей пары: победитель пары прошлого раунда или пустое место, пока он не известен */
function winnerOf(tie: BracketTie): BracketTeam {
  const winner = tie.winner == null ? null : tie.teams[tie.winner]
  return winner ? { ...EMPTY_TEAM, name: winner.name, badge: winner.badge } : EMPTY_TEAM
}

const hasTeam = (tie: BracketTie, name: string) => name !== '' && tie.teams.some(team => team.name === name)

/**
 * Выстраивает пары раунда под следующий раунд, чтобы линии сетки вели куда надо.
 * Обычно в пару i следующего раунда приходят победители пар 2i (сверху) и 2i + 1 (снизу).
 * После раунда плей-офф ЛЧ/ЛЕ (oneToOne) пар столько же: победитель пары i играет в паре i 1/8
 * против команды с 1–8 места. Пары, чьих победителей ещё нет в следующем раунде, — на свободные места по дате.
 */
function alignToNextRound(ties: BracketTie[], nextTies: BracketTie[], oneToOne: boolean): BracketTie[] {
  const slots: Array<BracketTie | undefined> = new Array(ties.length)
  nextTies.forEach((next, nextIndex) => {
    next.teams.forEach((team, side) => {
      const feeder = ties.find(tie => hasTeam(tie, team.name))
      const slot = oneToOne ? nextIndex : 2 * nextIndex + side
      if (feeder && slot < slots.length && !slots.includes(feeder)) slots[slot] = feeder
    })
  })
  const rest = ties.filter(tie => !slots.includes(tie))
  return [...slots].map(slot => slot ?? rest.shift()!)
}

type DataRound = { round: string, start: string, ties: BracketTie[] }

/**
 * Раунды сетки по порядку. Коды раундов в TheSportsDB меняются от сезона к сезону, поэтому
 * цепочка строится по датам и числу пар: от последнего раунда назад каждый предыдущий — тот,
 * где пар вдвое больше. Один раз, в самом начале, пар может быть столько же: это раунд плей-офф
 * ЛЧ/ЛЕ перед 1/8. Раунды, которые в цепочку не встают (стыковые матчи Лиги наций), отбрасываются.
 */
function chainRounds(rounds: DataRound[]): DataRound[] {
  const byDate = [...rounds].sort((a, b) => a.start.localeCompare(b.start))
  const chain = byDate.splice(-1)
  let hasPreRound = false
  for (const round of byDate.reverse()) {
    const first = chain[0]!
    if (hasPreRound) break
    if (round.ties.length === first.ties.length * 2) {
      chain.unshift(round)
    }
    else if (round.ties.length === first.ties.length && first.ties.length > 1) {
      chain.unshift(round)
      hasPreRound = true
    }
  }
  return chain
}

/**
 * Будущие раунды после последнего известного, до финала. Соперников в них не угадываем: кто с кем
 * сыграет, известно только по жеребьёвке, а её в API нет, пока не появятся сами матчи. Соседние
 * по дате пары в следующем раунде обычно не встречаются (в ЛЧ 2025/26 вышло бы «Ливерпуль – Барселона»
 * вместо «ПСЖ – Ливерпуль»). Исключение — 1/8 после раунда плей-офф: победитель пары точно в ней сыграет.
 */
function buildProjectedRounds(lastTies: BracketTie[], afterPreRound: boolean): BracketRound[] {
  const result: BracketRound[] = []
  let count = lastTies.length
  if (afterPreRound) {
    const ties = lastTies.map((tie, index): BracketTie => ({ id: `proj-0-${index}`, teams: [winnerOf(tie), EMPTY_TEAM], winner: null }))
    result.push({ round: 'proj-0', name: getRoundName(count, false), ties, projected: true })
  }
  while (count > 1) {
    count /= 2
    const ties = Array.from({ length: count }, (_, index): BracketTie => ({
      id: `proj-${result.length}-${index}`,
      teams: [EMPTY_TEAM, EMPTY_TEAM],
      winner: null,
    }))
    result.push({ round: `proj-${result.length}`, name: getRoundName(count, false), ties, projected: true })
  }
  return result
}

/**
 * Сетка плей-офф: известные раунды по порядку, после них — будущие раунды из победителей.
 * Матч за 3-е место отдельно: в нём играют проигравшие в полуфиналах.
 * У турниров с общим этапом (ЛЧ/ЛЕ) первый раунд — раунд плей-офф: пока 1/8 нет в расписании,
 * это известно только по настройке турнира.
 */
export function buildBracket(
  playoffMatches: BracketScheduleMatch[],
  penScoreMap: BracketPenaltyScores,
  competition: Pick<Competition, 'leaguePhase'>,
): BracketResponse {
  const byRound = new Map<string, BracketScheduleMatch[]>()
  for (const match of playoffMatches) {
    byRound.set(match.intRound, [...(byRound.get(match.intRound) ?? []), match])
  }
  const dataRounds: DataRound[] = [...byRound].map(([round, matches]) => ({
    round,
    start: matches.map(match => match.strTimestamp).sort()[0]!,
    ties: buildTies(matches, playoffMatches, penScoreMap),
  })).filter(round => isPowerOfTwo(round.ties.length))

  // Финал и матч за 3-е место — по одной паре; финал играют последним (бывает, в тот же день)
  const singles = dataRounds.filter(round => round.ties.length === 1).sort((a, b) => a.start.localeCompare(b.start))
  const semiFinalTeams = dataRounds.find(round => round.ties.length === 2)?.ties.flatMap(tie => tie.teams.map(team => team.name)) ?? []
  const thirdPlaceRound = singles.length > 1
    ? singles.slice(0, -1).find(round => round.ties[0]!.teams.every(team => team.name && semiFinalTeams.includes(team.name)))
    : undefined

  const chain = chainRounds(dataRounds.filter(round => round !== thirdPlaceRound))
  if (!chain.length) return { rounds: [], thirdPlace: null }

  const hasPreRound = chain.length > 1
    ? chain[0]!.ties.length === chain[1]!.ties.length
    : Boolean(competition.leaguePhase) && chain[0]!.ties.length > 1

  // Порядок пар: последний известный раунд — как в расписании, каждый предыдущий — под следующий
  for (let index = chain.length - 2; index >= 0; index--) {
    chain[index]!.ties = alignToNextRound(chain[index]!.ties, chain[index + 1]!.ties, hasPreRound && index === 0)
  }

  const rounds: BracketRound[] = chain.map((round, index) => ({
    round: round.round,
    name: getRoundName(round.ties.length, hasPreRound && index === 0),
    ties: round.ties,
    projected: false,
  }))
  rounds.push(...buildProjectedRounds(chain.at(-1)!.ties, hasPreRound && chain.length === 1))

  return { rounds, thirdPlace: thirdPlaceRound?.ties[0] ?? null }
}
