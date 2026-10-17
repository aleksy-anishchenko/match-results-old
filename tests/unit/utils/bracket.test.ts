import { describe, it, expect } from 'vitest'
import type { BracketRound, Competition } from '~/types'
import { buildBracket, buildTies, getPlayoffMatches, getTieTotal, type BracketPenaltyScores, type BracketScheduleMatch } from '#shared/utils/bracket'
// Настоящие расписания сезонов из TheSportsDB (v2 schedule/league), только поля для сетки, без эмблем
import championsLeague2425 from '../../fixtures/bracket/champions-league-2024-25.json'
import championsLeague2526 from '../../fixtures/bracket/champions-league-2025-26.json'
import nationsLeague2425 from '../../fixtures/bracket/nations-league-2024-25.json'

type Season = { schedule: BracketScheduleMatch[], penalties: BracketPenaltyScores }

const LEAGUE_PHASE: Pick<Competition, 'leaguePhase'> = { leaguePhase: true }
const NATIONS_LEAGUE: Pick<Competition, 'groupRounds'> = { groupRounds: ['1', '2', '3', '4', '5', '6'] }

function bracketOf(season: Season, competition: Pick<Competition, 'groupRounds' | 'leaguePhase'>): BracketRound[] {
  return buildBracket(getPlayoffMatches(season.schedule, competition), season.penalties)
}

const playedRounds = (rounds: BracketRound[]) => rounds.filter(round => !round.projected)
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
    expect(buildBracket([], {})).toEqual([])
  })

  // Ниже — как сетка должна выглядеть на настоящих данных. Сейчас это известные ошибки (it.fails:
  // тест проходит, пока проверка падает). Когда ошибку починят, убрать .fails
  describe.each([
    ['ЛЧ 2024/25', championsLeague2425],
    ['ЛЧ 2025/26', championsLeague2526],
  ])('%s', (_, season) => {
    it.fails('раунды по порядку, финал не теряется', () => {
      expect(playedRounds(bracketOf(season, LEAGUE_PHASE)).map(round => round.name))
        .toEqual(['Раунд плей-офф', '1/8 финала', 'Четвертьфинал', 'Полуфинал', 'Финал'])
    })

    it.fails('пара из двух матчей — одна карточка', () => {
      expect(playedRounds(bracketOf(season, LEAGUE_PHASE)).map(round => round.ties.length))
        .toEqual([8, 8, 4, 2, 1])
    })

    // Победители раунда плей-офф играют в 1/8 с командами с 1–8 мест: пара 1/8 под номером i
    // ждёт победителя пары раунда плей-офф под тем же номером. Дальше пара i собирается
    // из победителей пар 2i и 2i + 1
    it.fails('линии ведут к правильным парам', () => {
      const [playoff, ...knockout] = playedRounds(bracketOf(season, LEAGUE_PHASE))
      const teamsOf = (round: BracketRound, index: number) => round.ties[index]?.teams.map(team => team.name) ?? []

      knockout[0]!.ties.forEach((_, index) => {
        expect(teamsOf(knockout[0]!, index).some(team => teamsOf(playoff!, index).includes(team))).toBe(true)
      })
      for (let k = 1; k < knockout.length; k++) {
        knockout[k]!.ties.forEach((_, index) => {
          const feeders = [...teamsOf(knockout[k - 1]!, 2 * index), ...teamsOf(knockout[k - 1]!, 2 * index + 1)]
          expect(feeders).toEqual(expect.arrayContaining(teamsOf(knockout[k]!, index)))
        })
      }
    })
  })

  it('ЛЧ 2025/26: финал ПСЖ – Арсенал, ПСЖ выиграл по пенальти 4:3', () => {
    const final = playedRounds(bracketOf(championsLeague2526, LEAGUE_PHASE)).at(-1)!
    expect(final.name).toBe('Финал')
    expect(final.ties[0]).toMatchObject({
      teams: [{ name: 'Paris SG', goals: [1], penalties: 4 }, { name: 'Arsenal', goals: [1], penalties: 3 }],
      winner: 0,
    })
  })

  it.fails('Лига наций 2024/25: четвертьфиналы без стыковых матчей, потом полуфиналы и финал', () => {
    const rounds = playedRounds(bracketOf(nationsLeague2425, NATIONS_LEAGUE))
    expect(rounds.map(round => round.name)).toEqual(['Четвертьфинал', 'Полуфинал', 'Финал'])
    expect(rounds[0]!.ties.flatMap(tie => tie.teams.map(team => team.name)).sort()).toEqual([
      'Croatia', 'Denmark', 'France', 'Germany', 'Italy', 'Netherlands', 'Portugal', 'Spain',
    ])
  })
})
