import { describe, it, expect } from 'vitest'
import type { BracketRound, Competition } from '~/types'
import { buildBracket, getPlayoffMatches, type BracketPenaltyScores, type BracketScheduleMatch } from '#shared/utils/bracket'
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
      expect(playedRounds(bracketOf(season, LEAGUE_PHASE)).map(round => round.matches.length))
        .toEqual([8, 8, 4, 2, 1])
    })

    // Победители раунда плей-офф играют в 1/8 с командами с 1–8 мест: пара 1/8 под номером i
    // ждёт победителя пары раунда плей-офф под тем же номером. Дальше пара i собирается
    // из победителей пар 2i и 2i + 1
    it.fails('линии ведут к правильным парам', () => {
      const [playoff, ...knockout] = playedRounds(bracketOf(season, LEAGUE_PHASE))
      const teamsOf = (round: BracketRound, index: number) => {
        const match = round.matches[index]
        return match ? [match.homeTeam, match.awayTeam] : []
      }

      knockout[0]!.matches.forEach((_, index) => {
        expect(teamsOf(knockout[0]!, index).some(team => teamsOf(playoff!, index).includes(team))).toBe(true)
      })
      for (let k = 1; k < knockout.length; k++) {
        knockout[k]!.matches.forEach((_, index) => {
          const feeders = [...teamsOf(knockout[k - 1]!, 2 * index), ...teamsOf(knockout[k - 1]!, 2 * index + 1)]
          expect(feeders).toEqual(expect.arrayContaining(teamsOf(knockout[k]!, index)))
        })
      }
    })
  })

  it.fails('ЛЧ 2025/26: финал ПСЖ – Арсенал, ПСЖ выиграл по пенальти 4:3', () => {
    const final = playedRounds(bracketOf(championsLeague2526, LEAGUE_PHASE)).at(-1)!
    expect(final.name).toBe('Финал')
    expect(final.matches[0]).toMatchObject({
      homeTeam: 'Paris SG',
      awayTeam: 'Arsenal',
      homeScore: '1',
      awayScore: '1',
      homePenScore: 4,
      awayPenScore: 3,
    })
  })

  it.fails('Лига наций 2024/25: четвертьфиналы без стыковых матчей, потом полуфиналы и финал', () => {
    const rounds = playedRounds(bracketOf(nationsLeague2425, NATIONS_LEAGUE))
    expect(rounds.map(round => round.name)).toEqual(['Четвертьфинал', 'Полуфинал', 'Финал'])
    expect(rounds[0]!.matches.flatMap(match => [match.homeTeam, match.awayTeam]).sort()).toEqual([
      'Croatia', 'Denmark', 'France', 'Germany', 'Italy', 'Netherlands', 'Portugal', 'Spain',
    ])
  })
})
