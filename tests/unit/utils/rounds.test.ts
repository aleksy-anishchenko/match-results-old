import { describe, it, expect } from 'vitest'
import type { Competition } from '~/types'
import type { BracketScheduleMatch } from '#shared/utils/bracket'
import { getCurrentRound, getSeasonRounds, LEAGUE_PLAYOFF_ROUND } from '#shared/utils/rounds'
// Настоящие расписания сезонов из TheSportsDB (v2 schedule/league), только нужные поля
import bundesliga2526 from '../../fixtures/rounds/bundesliga-2025-26.json'
import championsLeague2425 from '../../fixtures/bracket/champions-league-2024-25.json'
import championsLeague2526 from '../../fixtures/bracket/champions-league-2025-26.json'
import nationsLeague2425 from '../../fixtures/bracket/nations-league-2024-25.json'

type RoundsCompetition = Pick<Competition, 'type' | 'groupRounds' | 'leaguePhase'>

const LEAGUE: RoundsCompetition = { type: 'league' }
const LEAGUE_PHASE: RoundsCompetition = { type: 'tournament', leaguePhase: true }
const NATIONS_LEAGUE: RoundsCompetition = { type: 'tournament', groupRounds: ['1', '2', '3', '4', '5', '6'] }

const namesOf = (schedule: BracketScheduleMatch[], competition: RoundsCompetition) =>
  getSeasonRounds(schedule, competition).rounds.map(round => round.name)

function matchesOf(schedule: BracketScheduleMatch[], competition: RoundsCompetition, round: string) {
  const { roundByMatch } = getSeasonRounds(schedule, competition)
  return schedule.filter(match => roundByMatch.get(match.idEvent) === round)
}

describe('getSeasonRounds: лига', () => {
  it('туры по номерам, стыки в конце сезона — одной страницей «Плей-офф»', () => {
    const names = namesOf(bundesliga2526, LEAGUE)
    expect(names).toHaveLength(35)
    expect(names.slice(0, 2)).toEqual(['1 тур', '2 тур'])
    expect(names.slice(-2)).toEqual(['34 тур', 'Плей-офф'])
  })

  // Стыки Вольфсбург – Падерборн под кодами 160 и 180
  it('в «Плей-офф» оба стыковых матча, в туре — его матчи', () => {
    expect(matchesOf(bundesliga2526, LEAGUE, LEAGUE_PLAYOFF_ROUND).map(match => match.intRound)).toEqual(['160', '180'])
    expect(matchesOf(bundesliga2526, LEAGUE, '5')).toHaveLength(9)
  })
})

describe('getSeasonRounds: турнир', () => {
  it('ЛЧ 2025/26: восемь туров общего этапа, потом раунды плей-офф из сетки', () => {
    expect(namesOf(championsLeague2526.schedule, LEAGUE_PHASE)).toEqual([
      '1 тур', '2 тур', '3 тур', '4 тур', '5 тур', '6 тур', '7 тур', '8 тур',
      'Раунд плей-офф', '1/8 финала', 'Четвертьфинал', 'Полуфинал', 'Финал',
    ])
  })

  it('ЛЧ 2025/26: в туре все матчи раунда, летняя квалификация — ни в одном туре', () => {
    const { roundByMatch } = getSeasonRounds(championsLeague2526.schedule, LEAGUE_PHASE)
    expect(matchesOf(championsLeague2526.schedule, LEAGUE_PHASE, '1')).toHaveLength(18)
    expect(matchesOf(championsLeague2526.schedule, LEAGUE_PHASE, 'playoff-32')).toHaveLength(16)
    expect(championsLeague2526.schedule.filter(match => match.intRound === '400').some(match => roundByMatch.has(match.idEvent))).toBe(false)
  })

  // В 2024/25 раунд плей-офф под кодом 160 — названия всё равно из сетки
  it('ЛЧ 2024/25: раунд плей-офф под другим кодом назван так же', () => {
    const { rounds } = getSeasonRounds(championsLeague2425.schedule, LEAGUE_PHASE)
    expect(rounds.find(round => round.name === 'Раунд плей-офф')?.id).toBe('playoff-160')
  })

  it('Лига наций 2024/25: четвертьфиналы без стыковых матчей, матч за 3-е место перед финалом', () => {
    expect(namesOf(nationsLeague2425.schedule, NATIONS_LEAGUE)).toEqual([
      '1 тур', '2 тур', '3 тур', '4 тур', '5 тур', '6 тур',
      'Четвертьфинал', 'Полуфинал', 'Матч за 3-е место', 'Финал',
    ])
    const quarterFinals = matchesOf(nationsLeague2425.schedule, NATIONS_LEAGUE, 'playoff-0')
    expect(quarterFinals).toHaveLength(8)
    expect(quarterFinals.some(match => match.strHomeTeam === 'Turkey')).toBe(false)
  })
})

describe('getCurrentRound', () => {
  const { roundByMatch } = getSeasonRounds(bundesliga2526, LEAGUE)
  const currentAt = (moment: string) => getCurrentRound(bundesliga2526, roundByMatch, new Date(moment))

  // 5 тур: пятница 26 – воскресенье 28 сентября 2025, 6 тур: с пятницы 3 октября
  it('во время тура — этот тур', () => {
    expect(currentAt('2025-09-27T12:00:00Z')).toBe('5')
  })

  it('во вторник после тура — его результаты, в четверг — уже следующий', () => {
    expect(currentAt('2025-09-30T12:00:00Z')).toBe('5')
    expect(currentAt('2025-10-02T12:00:00Z')).toBe('6')
  })

  it('после конца сезона — последний сыгранный: стыки', () => {
    expect(currentAt('2026-07-01T12:00:00Z')).toBe(LEAGUE_PLAYOFF_ROUND)
  })

  it('без матчей тура нет', () => {
    expect(getCurrentRound([], new Map(), new Date())).toBeNull()
  })
})
