import type { BracketResponse, BracketRound, BracketTeam, BracketTie, Competition, SeasonMatch, SeasonTeam } from '~/types'
import { FINISHED_MATCH_STATUSES } from './matches'

/**
 * Раунды плей-офф турнира в API-Football. Названия тоже меняются от сезона к сезону: раунд плей-офф ЛЧ/ЛЕ
 * перед 1/8 — «Knockout Round Play-offs» в 2024/25 и «Round of 32» в 2025/26, хотя пар в нём 8. Поэтому
 * по названию только узнаём, что это плей-офф, а называем раунд по числу пар (getRoundName).
 * Квалификация («1st Qualifying Round», «Play-offs»), общий и групповой этап, стыковые матчи между
 * дивизионами Лиги наций («Play-offs A/B») сюда не входят
 */
const KNOCKOUT_ROUND = /^(Knockout Round Play-offs|Round of \d+|Quarter-finals|Semi-finals|3rd Place Final|Final)$/
const THIRD_PLACE_ROUND = '3rd Place Final'

/** Матчи плей-офф турнира из расписания сезона */
export function getPlayoffMatches(schedule: SeasonMatch[]): SeasonMatch[] {
  return schedule.filter(match => KNOCKOUT_ROUND.test(match.round))
}

/** Раунд API для адреса и ключей: «Round of 16» → «round-of-16» */
export const getRoundSlug = (round: string) => round.toLowerCase().replace(/[^a-z0-9]+/g, '-')

/** Сумма голов команды за сыгранные матчи пары; null — ни один матч ещё не завершён */
export function getTieTotal(team: BracketTeam): number | null {
  const played = team.goals.filter(goals => goals != null)
  return played.length ? played.reduce((sum, goals) => sum + goals, 0) : null
}

const byTimestamp = (a: SeasonMatch, b: SeasonMatch) => a.timestamp.localeCompare(b.timestamp)

function teamOfTie(legs: SeasonMatch[], team: SeasonTeam): BracketTeam {
  const isHome = (leg: SeasonMatch) => leg.home.id === team.id
  const goals = legs.map(leg => FINISHED_MATCH_STATUSES.has(leg.status) ? (isHome(leg) ? leg.homeScore : leg.awayScore) : null)
  // Серия пенальти бывает только в последнем матче пары
  const lastLeg = legs.at(-1)!
  return {
    id: team.id,
    name: team.name,
    badge: team.badge,
    goals,
    penalties: isHome(lastLeg) ? lastLeg.homePenalties : lastLeg.awayPenalties,
  }
}

/** Кто прошёл дальше: по сумме голов, потом по серии пенальти. Пока не все матчи пары завершены, победителя нет */
function tieWinner([first, second]: [BracketTeam, BracketTeam]): 0 | 1 | null {
  if ([first, second].some(team => team.goals.includes(null))) return null
  const firstTotal = getTieTotal(first) ?? 0
  const secondTotal = getTieTotal(second) ?? 0
  if (firstTotal !== secondTotal) return firstTotal > secondTotal ? 0 : 1

  if (first.penalties == null || second.penalties == null || first.penalties === second.penalties) return null
  return first.penalties > second.penalties ? 0 : 1
}

/**
 * Пары раунда: матчи одних и тех же двух команд — одна пара, один матч или два. Порядок пар —
 * по первому матчу, команды — как в первом матче (хозяин сверху)
 */
export function buildTies(roundMatches: SeasonMatch[]): BracketTie[] {
  const legsByTie = new Map<string, SeasonMatch[]>()
  for (const match of [...roundMatches].sort(byTimestamp)) {
    // Без номера команды пару не узнать: такой матч — отдельной карточкой
    const key = match.home.id != null && match.away.id != null
      ? [match.home.id, match.away.id].sort((a, b) => a - b).join('-')
      : match.id
    legsByTie.set(key, [...(legsByTie.get(key) ?? []), match])
  }

  return [...legsByTie.values()].map((legs) => {
    const first = legs[0]!
    const teams: [BracketTeam, BracketTeam] = [teamOfTie(legs, first.home), teamOfTie(legs, first.away)]
    return { id: first.id, teams, winner: tieWinner(teams) }
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

const EMPTY_TEAM: BracketTeam = { id: null, name: '', badge: '', goals: [], penalties: null }

/** Команда будущей пары: победитель пары прошлого раунда или пустое место, пока он не известен */
function winnerOf(tie: BracketTie): BracketTeam {
  const winner = tie.winner == null ? null : tie.teams[tie.winner]
  return winner ? { ...EMPTY_TEAM, id: winner.id, name: winner.name, badge: winner.badge } : EMPTY_TEAM
}

const hasTeam = (tie: BracketTie, id: number | null) => id != null && tie.teams.some(team => team.id === id)

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
      const feeder = ties.find(tie => hasTeam(tie, team.id))
      const slot = oneToOne ? nextIndex : 2 * nextIndex + side
      if (feeder && slot < slots.length && !slots.includes(feeder)) slots[slot] = feeder
    })
  })
  const rest = ties.filter(tie => !slots.includes(tie))
  return [...slots].map(slot => slot ?? rest.shift()!)
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
 * Сетка плей-офф: известные раунды по датам, после них — будущие раунды из победителей.
 * Матч за 3-е место отдельно: в нём играют проигравшие в полуфиналах.
 * У турниров с общим этапом (ЛЧ/ЛЕ) первый раунд — раунд плей-офф: пока 1/8 нет в расписании,
 * это известно только по настройке турнира.
 */
export function buildBracket(playoffMatches: SeasonMatch[], competition: Pick<Competition, 'leaguePhase'>): BracketResponse {
  const byRound = new Map<string, SeasonMatch[]>()
  for (const match of playoffMatches) {
    byRound.set(match.round, [...(byRound.get(match.round) ?? []), match])
  }

  const thirdPlace = byRound.get(THIRD_PLACE_ROUND)
  const chain = [...byRound]
    .filter(([round]) => round !== THIRD_PLACE_ROUND)
    .map(([round, matches]) => ({
      round: getRoundSlug(round),
      start: matches.map(match => match.timestamp).sort()[0]!,
      ties: buildTies(matches),
    }))
    .sort((a, b) => a.start.localeCompare(b.start))
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

  return { rounds, thirdPlace: thirdPlace ? buildTies(thirdPlace)[0]! : null }
}
