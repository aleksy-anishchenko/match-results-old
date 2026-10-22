import { describe, it, expect } from 'vitest'
import type { BracketResponse, BracketRound, Competition, SeasonMatch } from '~/types'
import { buildBracket, buildTies, getPlayoffMatches, getRoundSlug, getTieTotal } from '#shared/utils/bracket'
import { toSeasonMatch } from '../../../server/utils/seasonMatch'
// Настоящие расписания сезонов из API-Football (fixtures?league&season), только поля для сетки, без эмблем
import championsLeague2425Fixtures from '../../fixtures/api-football/seasons/champions-league-2024-25.json'
import championsLeague2526Fixtures from '../../fixtures/api-football/seasons/champions-league-2025-26.json'
import nationsLeague2425Fixtures from '../../fixtures/api-football/seasons/nations-league-2024-25.json'

const championsLeague2425 = championsLeague2425Fixtures.map(toSeasonMatch)
const championsLeague2526 = championsLeague2526Fixtures.map(toSeasonMatch)
const nationsLeague2425 = nationsLeague2425Fixtures.map(toSeasonMatch)

const LEAGUE_PHASE: Pick<Competition, 'leaguePhase'> = { leaguePhase: true }
const NATIONS_LEAGUE: Pick<Competition, 'leaguePhase'> = {}

/** Сетка по расписанию сезона; before — какой она была до этой даты (что уже лежало в API) */
function bracketOf(schedule: SeasonMatch[], competition: Pick<Competition, 'leaguePhase'>, before?: string): BracketResponse {
  const known = before ? schedule.filter(match => match.timestamp < before) : schedule
  return buildBracket(getPlayoffMatches(known), competition)
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

const roundsOf = (matches: SeasonMatch[]) => [...new Set(matches.map(match => match.round))]

describe('getPlayoffMatches', () => {
  it('ЛЧ 2025/26: только раунды плей-офф, без общего этапа и летней квалификации', () => {
    const matches = getPlayoffMatches(championsLeague2526)
    expect(roundsOf(matches)).toEqual(['Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', 'Final'])
    expect(matches).toHaveLength(45)
  })

  // Тот же раунд плей-офф перед 1/8 в 2024/25 назывался иначе
  it('ЛЧ 2024/25: раунд плей-офф — «Knockout Round Play-offs»', () => {
    const matches = getPlayoffMatches(championsLeague2425)
    expect(matches.filter(match => match.round === 'Knockout Round Play-offs')).toHaveLength(16)
  })

  it('Лига наций 2024/25: без группового этапа и стыковых матчей между дивизионами', () => {
    const matches = getPlayoffMatches(nationsLeague2425)
    expect(roundsOf(matches)).toEqual(['Quarter-finals', 'Semi-finals', '3rd Place Final', 'Final'])
    expect(matches.filter(match => match.round === 'Quarter-finals')).toHaveLength(8)
  })
})

describe('getRoundSlug', () => {
  it('раунд API для адреса', () => {
    expect(getRoundSlug('Round of 16')).toBe('round-of-16')
    expect(getRoundSlug('3rd Place Final')).toBe('3rd-place-final')
  })
})

describe('buildTies', () => {
  const roundOf = (schedule: SeasonMatch[], round: string) => schedule.filter(match => match.round === round)
  const tieOf = (ties: ReturnType<typeof buildTies>, team: string) =>
    ties.find(tie => tie.teams.some(side => side.name === team))!

  it('два матча одних команд — одна пара, команды как в первом матче, голы по матчам', () => {
    const ties = buildTies(roundOf(championsLeague2526, 'Round of 16'))
    expect(ties).toHaveLength(8)
    // Будё-Глимт – Спортинг 3:0, ответный 0:5 в доп. время
    expect(tieOf(ties, 'Спортинг')).toMatchObject({
      teams: [{ name: 'Будё-Глимт', goals: [3, 0] }, { name: 'Спортинг', goals: [0, 5] }],
      winner: 1,
    })
  })

  // ПСЖ – Ливерпуль 0:1, ответный 1:0, серия пенальти в ответном 4:1 (в TheSportsDB её не было)
  it('ничья по сумме — победитель по серии пенальти в ответном матче', () => {
    const tie = tieOf(buildTies(roundOf(championsLeague2425, 'Round of 16')), 'ПСЖ')
    expect(tie.teams.map(team => [team.name, getTieTotal(team), team.penalties])).toEqual([['ПСЖ', 1, 4], ['Ливерпуль', 1, 1]])
    expect(tie.winner).toBe(0)
  })

  it('один матч с пенальти: счёт серии и победитель по ней', () => {
    expect(buildTies(roundOf(championsLeague2526, 'Final'))).toEqual([{
      id: '1544371',
      teams: [
        { id: 85, name: 'ПСЖ', badge: '', goals: [1], penalties: 4 },
        { id: 42, name: 'Арсенал', badge: '', goals: [1], penalties: 3 },
      ],
      winner: 0,
    }])
  })

  // Финал Лиги наций 2025: Португалия – Испания 2:2, Португалия по пенальти 5:3
  it('Лига наций 2024/25: финал решён по пенальти', () => {
    const [final] = buildTies(roundOf(nationsLeague2425, 'Final'))
    expect(final!.teams.map(team => [team.name, getTieTotal(team), team.penalties])).toEqual([['Португалия', 2, 5], ['Испания', 2, 3]])
    expect(final!.winner).toBe(0)
  })

  const team = (id: number) => ({ id, name: `Команда ${id}`, badge: '' })
  const leg = (overrides: Partial<SeasonMatch>): SeasonMatch => ({
    id: '1',
    round: 'Round of 32',
    timestamp: '2027-02-17T20:00:00',
    status: 'NS',
    home: team(1),
    away: team(2),
    homeScore: null,
    awayScore: null,
    homePenalties: null,
    awayPenalties: null,
    ...overrides,
  })

  it('пока ответный матч не сыгран, победителя нет, а сумма — по первому матчу', () => {
    const [tie] = buildTies([
      leg({ id: '1', homeScore: 2, awayScore: 0, status: 'FT' }),
      leg({ id: '2', home: team(2), away: team(1), timestamp: '2027-02-25T20:00:00' }),
    ])
    expect(tie!.teams.map(item => item.goals)).toEqual([[2, null], [0, null]])
    expect(tie!.teams.map(getTieTotal)).toEqual([2, 0])
    expect(tie!.winner).toBeNull()
  })

  it('матчи, где у команды нет номера, не склеиваются', () => {
    const unknown = { id: null, name: '', badge: '' }
    expect(buildTies([leg({ id: '1', away: unknown }), leg({ id: '2', away: unknown })])).toHaveLength(2)
  })
})

describe('buildBracket', () => {
  it('без матчей сетки нет', () => {
    expect(buildBracket([], LEAGUE_PHASE)).toEqual({ rounds: [], thirdPlace: null })
  })

  describe.each([
    ['ЛЧ 2024/25', championsLeague2425],
    ['ЛЧ 2025/26', championsLeague2526],
  ])('%s', (_, schedule) => {
    it('раунды по порядку, финал не теряется, будущих раундов нет', () => {
      const { rounds, thirdPlace } = bracketOf(schedule, LEAGUE_PHASE)
      expect(rounds.map(round => round.name)).toEqual(['Раунд плей-офф', '1/8 финала', 'Четвертьфинал', 'Полуфинал', 'Финал'])
      expect(rounds.some(round => round.projected)).toBe(false)
      expect(thirdPlace).toBeNull()
    })

    it('пара из двух матчей — одна карточка', () => {
      expect(bracketOf(schedule, LEAGUE_PHASE).rounds.map(round => round.ties.length)).toEqual([8, 8, 4, 2, 1])
    })

    it('линии ведут к правильным парам', () => {
      expectLinesMatch(bracketOf(schedule, LEAGUE_PHASE).rounds)
    })
  })

  it('ЛЧ 2025/26: финал ПСЖ – Арсенал, ПСЖ выиграл по пенальти 4:3', () => {
    const final = bracketOf(championsLeague2526, LEAGUE_PHASE).rounds.at(-1)!
    expect(final.name).toBe('Финал')
    expect(final.ties[0]).toMatchObject({
      teams: [{ name: 'ПСЖ', goals: [1], penalties: 4 }, { name: 'Арсенал', goals: [1], penalties: 3 }],
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
      expect(tie.teams.map(item => item.name)).toEqual([winner.teams[winner.winner!]!.name, ''])
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
    expect(rounds.slice(2).flatMap(round => round.ties.flatMap(tie => tie.teams.map(item => item.name)))).toEqual(Array(14).fill(''))
  })

  it('Лига наций 2024/25: четвертьфиналы без стыковых матчей, потом полуфиналы и финал', () => {
    const { rounds } = bracketOf(nationsLeague2425, NATIONS_LEAGUE)
    expect(rounds.map(round => round.name)).toEqual(['Четвертьфинал', 'Полуфинал', 'Финал'])
    expect(rounds[0]!.ties.flatMap(tie => tie.teams.map(item => item.name)).sort()).toEqual([
      'Германия', 'Дания', 'Испания', 'Италия', 'Нидерланды', 'Португалия', 'Франция', 'Хорватия',
    ])
    expectLinesMatch(rounds)
  })

  it('Лига наций 2024/25: четвертьфинал из двух матчей, ничья по сумме — Испания по пенальти', () => {
    const [quarterFinals] = bracketOf(nationsLeague2425, NATIONS_LEAGUE).rounds
    const tie = quarterFinals!.ties.find(item => item.teams.some(side => side.name === 'Испания'))!
    // Нидерланды – Испания 2:2 и 3:3, пенальти 4:5
    expect(tie).toMatchObject({
      teams: [{ name: 'Нидерланды', goals: [2, 3], penalties: 4 }, { name: 'Испания', goals: [2, 3], penalties: 5 }],
      winner: 1,
    })
  })

  it('Лига наций 2024/25: матч за 3-е место отдельно', () => {
    // Германия – Франция 0:2
    expect(bracketOf(nationsLeague2425, NATIONS_LEAGUE).thirdPlace)
      .toMatchObject({ teams: [{ name: 'Германия', goals: [0] }, { name: 'Франция', goals: [2] }], winner: 1 })
  })

  // Март 2025: четвертьфиналы сыграны, полуфиналов в API ещё нет. У TheSportsDB четвертьфиналы было
  // не отличить от стыковых матчей, и сетки до полуфиналов не было; у API-Football раунд назван прямо
  it('Лига наций 2024/25 до полуфиналов: четвертьфиналы, дальше будущие раунды', () => {
    const { rounds } = bracketOf(nationsLeague2425, NATIONS_LEAGUE, '2025-04-01')
    expect(rounds.map(round => [round.name, round.ties.length, Boolean(round.projected)])).toEqual([
      ['Четвертьфинал', 4, false],
      ['Полуфинал', 2, true],
      ['Финал', 1, true],
    ])
  })
})
