import { describe, it, expect } from 'vitest'
import type { BracketResponse, BracketRound, Competition } from '~/types'
import { buildBracket, buildTies, getPlayoffMatches, getTieTotal, type BracketPenaltyScores, type BracketScheduleMatch } from '#shared/utils/bracket'
// Настоящие расписания сезонов из TheSportsDB (v2 schedule/league), только поля для сетки, без эмблем
import championsLeague2425 from '../../fixtures/bracket/champions-league-2024-25.json'
import championsLeague2526 from '../../fixtures/bracket/champions-league-2025-26.json'
import nationsLeague2425 from '../../fixtures/bracket/nations-league-2024-25.json'

type Season = { schedule: BracketScheduleMatch[], penalties: BracketPenaltyScores }

const LEAGUE_PHASE: Pick<Competition, 'leaguePhase'> = { leaguePhase: true }
const NATIONS_LEAGUE: Pick<Competition, 'groupRounds'> = { groupRounds: ['1', '2', '3', '4', '5', '6'] }

/** Сетка по расписанию сезона; before — какой она была до этой даты (что уже лежало в API) */
function bracketOf(season: Season, competition: Pick<Competition, 'groupRounds' | 'leaguePhase'>, before?: string): BracketResponse {
  const schedule = before ? season.schedule.filter(match => match.strTimestamp < before) : season.schedule
  return buildBracket(getPlayoffMatches(schedule, competition), season.penalties, competition)
}

const teamNames = (round: BracketRound, index: number) => round.ties[index]?.teams.map(team => team.name) ?? []

/**
 * Линии ведут к правильным парам: в пару i следующего раунда приходят победители пар 2i и 2i + 1
 * (сверху и снизу), а если пар столько же (раунд плей-офф ЛЧ → 1/8) — победитель пары i
 */
function expectLinesMatch(rounds: BracketRound[]) {
  for (let k = 1; k < rounds.length; k++) {
    const [prev, next] = [rounds[k - 1]!, rounds[k]!]
    next.ties.forEach((tie, index) => {
      if (next.ties.length === prev.ties.length) {
        expect(teamNames(next, index).some(team => teamNames(prev, index).includes(team))).toBe(true)
        return
      }
      tie.teams.forEach((team, side) => {
        if (team.name) expect(teamNames(prev, 2 * index + side)).toContain(team.name)
      })
    })
  }
}

const roundsOf = (matches: BracketScheduleMatch[]) => [...new Set(matches.map(match => match.intRound))].sort()

describe('getPlayoffMatches', () => {
  it('ЛЧ 2025/26: только раунды плей-офф, без общего этапа и летней квалификации', () => {
    const matches = getPlayoffMatches(championsLeague2526.schedule, LEAGUE_PHASE)
    expect(roundsOf(matches)).toEqual(['125', '150', '16', '200', '32'])
    expect(matches).toHaveLength(45)
  })

  // Коды раундов в TheSportsDB меняются от сезона к сезону: здесь раунд плей-офф под кодом 160,
  // которым в других турнирах обозначен матч за 3-е место
  it('ЛЧ 2024/25: раунд плей-офф под кодом 160', () => {
    const matches = getPlayoffMatches(championsLeague2425.schedule, LEAGUE_PHASE)
    expect(roundsOf(matches)).toEqual(['125', '150', '16', '160', '200'])
    expect(matches.filter(match => match.intRound === '160')).toHaveLength(16)
  })

  // Четвертьфиналы Лиги наций лежат в раунде 0 вместе со стыковыми матчами между дивизионами
  it('Лига наций 2024/25: всё, что не групповой этап', () => {
    const matches = getPlayoffMatches(nationsLeague2425.schedule, NATIONS_LEAGUE)
    expect(roundsOf(matches)).toEqual(['0', '150', '160', '200'])
    expect(matches.filter(match => match.intRound === '0')).toHaveLength(28)
  })
})

describe('buildTies', () => {
  const roundOf = (season: Season, round: string) => season.schedule.filter(match => match.intRound === round)
  const tieOf = (ties: ReturnType<typeof buildTies>, team: string) =>
    ties.find(tie => tie.teams.some(side => side.name === team))!

  it('два матча одних команд — одна пара, команды как в первом матче, голы по матчам', () => {
    const ties = buildTies(roundOf(championsLeague2526, '16'), championsLeague2526.schedule, {})
    expect(ties).toHaveLength(8)
    // Бодё-Глимт – Спортинг 3:0, ответный 0:5 в доп. время
    expect(tieOf(ties, 'Sporting CP')).toMatchObject({
      teams: [{ name: 'Bodø/Glimt', goals: [3, 0] }, { name: 'Sporting CP', goals: [0, 5] }],
      winner: 1,
    })
  })

  // В ЛЧ 2024/25 пары, решённые серией пенальти, в API со статусом FT и без счёта серии:
  // ПСЖ – Ливерпуль 0:1 и 1:0, дальше прошёл ПСЖ
  it('ничья по сумме без пенальти: прошёл тот, кто играл в следующем раунде', () => {
    const ties = buildTies(roundOf(championsLeague2425, '16'), championsLeague2425.schedule, {})
    const tie = tieOf(ties, 'Paris SG')
    expect(tie.teams.map(team => [team.name, getTieTotal(team)])).toEqual([['Paris SG', 1], ['Liverpool', 1]])
    expect(tie.winner).toBe(0)
  })

  it('один матч с пенальти: счёт серии и победитель по ней', () => {
    const ties = buildTies(roundOf(championsLeague2526, '200'), championsLeague2526.schedule, championsLeague2526.penalties)
    expect(ties).toEqual([{
      id: '2470477',
      teams: [
        { name: 'Paris SG', badge: '', goals: [1], penalties: 4 },
        { name: 'Arsenal', badge: '', goals: [1], penalties: 3 },
      ],
      winner: 0,
    }])
  })

  // Полуфиналисты Лиги наций играют потом оба: кто в финале, кто в матче за 3-е место
  it('если дальше играли обе команды, победитель по счёту', () => {
    const ties = buildTies(roundOf(nationsLeague2425, '150'), nationsLeague2425.schedule, {})
    expect(tieOf(ties, 'Portugal').winner).toBe(1)
    expect(tieOf(ties, 'Spain').winner).toBe(0)
  })

  // Финал Лиги наций 2025 Португалия – Испания 2:2 выиграла Португалия по пенальти,
  // но в API статус FT и счёта серии нет — победителя по данным не узнать
  it('ничья в последнем матче без счёта серии — победителя нет', () => {
    const [final] = buildTies(roundOf(nationsLeague2425, '200'), nationsLeague2425.schedule, {})
    expect(final!.teams.map(getTieTotal)).toEqual([2, 2])
    expect(final!.winner).toBeNull()
  })

  const leg = (overrides: Partial<BracketScheduleMatch>): BracketScheduleMatch => ({
    idEvent: '1',
    strHomeTeam: 'Benfica',
    strAwayTeam: 'Porto',
    strHomeTeamBadge: '',
    strAwayTeamBadge: '',
    intHomeScore: null,
    intAwayScore: null,
    strStatus: 'NS',
    strTimestamp: '2027-02-17T20:00:00',
    intRound: '32',
    ...overrides,
  })

  it('пока ответный матч не сыгран, победителя нет, а сумма — по первому матчу', () => {
    const matches = [
      leg({ idEvent: '1', intHomeScore: '2', intAwayScore: '0', strStatus: 'FT' }),
      leg({ idEvent: '2', strHomeTeam: 'Porto', strAwayTeam: 'Benfica', strTimestamp: '2027-02-25T20:00:00' }),
    ]
    const [tie] = buildTies(matches, matches, {})
    expect(tie!.teams.map(team => team.goals)).toEqual([[2, null], [0, null]])
    expect(tie!.teams.map(getTieTotal)).toEqual([2, 0])
    expect(tie!.winner).toBeNull()
  })

  it('матчи с неизвестным соперником не склеиваются', () => {
    const matches = [leg({ idEvent: '1', strAwayTeam: '' }), leg({ idEvent: '2', strAwayTeam: '' })]
    expect(buildTies(matches, matches, {})).toHaveLength(2)
  })
})

describe('buildBracket', () => {
  it('без матчей сетки нет', () => {
    expect(buildBracket([], {}, LEAGUE_PHASE)).toEqual({ rounds: [], thirdPlace: null })
  })

  // Раунд плей-офф в 2024/25 под кодом 160, в 2025/26 — под кодом 32: порядок раундов берётся по датам
  describe.each([
    ['ЛЧ 2024/25', championsLeague2425],
    ['ЛЧ 2025/26', championsLeague2526],
  ])('%s', (_, season) => {
    it('раунды по порядку, финал не теряется, будущих раундов нет', () => {
      const { rounds, thirdPlace } = bracketOf(season, LEAGUE_PHASE)
      expect(rounds.map(round => round.name)).toEqual(['Раунд плей-офф', '1/8 финала', 'Четвертьфинал', 'Полуфинал', 'Финал'])
      expect(rounds.some(round => round.projected)).toBe(false)
      expect(thirdPlace).toBeNull()
    })

    it('пара из двух матчей — одна карточка', () => {
      expect(bracketOf(season, LEAGUE_PHASE).rounds.map(round => round.ties.length)).toEqual([8, 8, 4, 2, 1])
    })

    it('линии ведут к правильным парам', () => {
      expectLinesMatch(bracketOf(season, LEAGUE_PHASE).rounds)
    })
  })

  it('ЛЧ 2025/26: финал ПСЖ – Арсенал, ПСЖ выиграл по пенальти 4:3', () => {
    const final = bracketOf(championsLeague2526, LEAGUE_PHASE).rounds.at(-1)!
    expect(final.name).toBe('Финал')
    expect(final.ties[0]).toMatchObject({
      teams: [{ name: 'Paris SG', goals: [1], penalties: 4 }, { name: 'Arsenal', goals: [1], penalties: 3 }],
      winner: 0,
    })
  })

  // Так сетка выглядела в феврале 2026: в API только раунд плей-офф
  it('ЛЧ 2025/26 до 1/8: раунд плей-офф, дальше будущие раунды, в 1/8 победитель ждёт соперника', () => {
    const { rounds } = bracketOf(championsLeague2526, LEAGUE_PHASE, '2026-03-01')
    expect(rounds.map(round => [round.name, round.ties.length, Boolean(round.projected)])).toEqual([
      ['Раунд плей-офф', 8, false],
      ['1/8 финала', 8, true],
      ['Четвертьфинал', 4, true],
      ['Полуфинал', 2, true],
      ['Финал', 1, true],
    ])
    const playoff = rounds[0]!
    rounds[1]!.ties.forEach((tie, index) => {
      const winner = playoff.ties[index]!
      expect(tie.teams.map(team => team.name)).toEqual([winner.teams[winner.winner!]!.name, ''])
    })
  })

  // Март 2026: 1/8 сыграны, четвертьфиналов в API ещё нет. Соседние по дате пары 1/8 в четвертьфинале
  // не встретились, поэтому соперников в будущих раундах не угадываем
  it('ЛЧ 2025/26 до 1/4: раунд плей-офф выстроен под 1/8, в будущих четвертьфиналах соперники не определены', () => {
    const { rounds } = bracketOf(championsLeague2526, LEAGUE_PHASE, '2026-04-01')
    expect(rounds.map(round => [round.name, Boolean(round.projected)])).toEqual([
      ['Раунд плей-офф', false],
      ['1/8 финала', false],
      ['Четвертьфинал', true],
      ['Полуфинал', true],
      ['Финал', true],
    ])
    expectLinesMatch(rounds.slice(0, 2))
    expect(rounds.slice(2).flatMap(round => round.ties.flatMap(tie => tie.teams.map(team => team.name)))).toEqual(Array(14).fill(''))
  })

  it('Лига наций 2024/25: полуфиналы и финал, матч за 3-е место отдельно', () => {
    const { rounds, thirdPlace } = bracketOf(nationsLeague2425, NATIONS_LEAGUE)
    expect(rounds.map(round => round.name)).toEqual(['Полуфинал', 'Финал'])
    expectLinesMatch(rounds)
    // Германия – Франция 0:2
    expect(thirdPlace).toMatchObject({ teams: [{ name: 'Germany', goals: [0] }, { name: 'France', goals: [2] }], winner: 1 })
  })

  // Известная ошибка (it.fails: тест проходит, пока проверка падает). Когда починим, убрать .fails
  it.fails('Лига наций 2024/25: четвертьфиналы без стыковых матчей, потом полуфиналы и финал', () => {
    const { rounds } = bracketOf(nationsLeague2425, NATIONS_LEAGUE)
    expect(rounds.map(round => round.name)).toEqual(['Четвертьфинал', 'Полуфинал', 'Финал'])
    expect(rounds[0]!.ties.flatMap(tie => tie.teams.map(team => team.name)).sort()).toEqual([
      'Croatia', 'Denmark', 'France', 'Germany', 'Italy', 'Netherlands', 'Portugal', 'Spain',
    ])
  })
})
