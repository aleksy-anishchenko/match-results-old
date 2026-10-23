import { describe, it, expect } from 'vitest'
import type { Competition, SeasonMatch } from '~/types'
import { getCompetition } from '#shared/utils/competitions'
import { getCurrentRound, getMatchDays, getRoundNumber, getSeasonRounds, LEAGUE_PLAYOFF_ROUND } from '#shared/utils/rounds'
import { toSeasonMatch } from '../../../server/utils/seasonMatch'
// Настоящие расписания сезонов из API-Football (fixtures?league&season), только нужные поля
import bundesliga2526Fixtures from '../../fixtures/api-football/seasons/bundesliga-2025-26.json'
import championsLeague2425Fixtures from '../../fixtures/api-football/seasons/champions-league-2024-25.json'
import championsLeague2526Fixtures from '../../fixtures/api-football/seasons/champions-league-2025-26.json'
import conferenceLeague2526Fixtures from '../../fixtures/api-football/seasons/conference-league-2025-26.json'
import nationsLeague2425Fixtures from '../../fixtures/api-football/seasons/nations-league-2024-25.json'

const bundesliga2526 = bundesliga2526Fixtures.map(toSeasonMatch)
const championsLeague2425 = championsLeague2425Fixtures.map(toSeasonMatch)
const championsLeague2526 = championsLeague2526Fixtures.map(toSeasonMatch)
const conferenceLeague2526 = conferenceLeague2526Fixtures.map(toSeasonMatch)
const nationsLeague2425 = nationsLeague2425Fixtures.map(toSeasonMatch)

type RoundsCompetition = Pick<Competition, 'type' | 'leaguePhase'>

const LEAGUE: RoundsCompetition = { type: 'league' }
const LEAGUE_PHASE: RoundsCompetition = { type: 'tournament', leaguePhase: true }
const NATIONS_LEAGUE: RoundsCompetition = { type: 'tournament' }

const namesOf = (schedule: SeasonMatch[], competition: RoundsCompetition) =>
  getSeasonRounds(schedule, competition).rounds.map(round => round.name)

function matchesOf(schedule: SeasonMatch[], competition: RoundsCompetition, round: string) {
  const { roundByMatch } = getSeasonRounds(schedule, competition)
  return schedule.filter(match => roundByMatch.get(match.id) === round)
}

const teamOf = (name: string) => ({ id: name.length, name, badge: '' })

/** Матч расписания для тестов, где настоящих данных не нужно */
const scheduleMatch = (id: string, round: string, timestamp: string): SeasonMatch => ({
  id,
  round,
  timestamp,
  status: 'NS',
  home: teamOf('Home'),
  away: teamOf('Away team'),
  homeScore: null,
  awayScore: null,
  homePenalties: null,
  awayPenalties: null,
})

describe('getRoundNumber', () => {
  it('номер тура из названия раунда', () => {
    expect(getRoundNumber('Regular Season - 5')).toBe('5')
    expect(getRoundNumber('League Stage - 3')).toBe('3')
    expect(getRoundNumber('League A - 2')).toBe('2')
    expect(getRoundNumber('Championship Group - 31')).toBe('31')
  })

  it('у квалификации, плей-офф и стыков номера нет', () => {
    for (const round of ['1st Qualifying Round', 'Play-offs', 'Play-offs A/B', 'Round of 16', 'Final', 'Conference League Play-offs - Final']) {
      expect(getRoundNumber(round)).toBeNull()
    }
  })
})

describe('getSeasonRounds: лига', () => {
  it('туры по номерам, стыки в конце сезона — одной страницей «Плей-офф»', () => {
    const names = namesOf(bundesliga2526, LEAGUE)
    expect(names).toHaveLength(35)
    expect(names.slice(0, 2)).toEqual(['1 тур', '2 тур'])
    expect(names.slice(-2)).toEqual(['34 тур', 'Плей-офф'])
  })

  // Стыки Вольфсбург – Падерборн у API-Football — раунд «Final»
  it('в «Плей-офф» оба стыковых матча, в туре — его матчи', () => {
    expect(matchesOf(bundesliga2526, LEAGUE, LEAGUE_PLAYOFF_ROUND).map(match => match.round)).toEqual(['Final', 'Final'])
    expect(matchesOf(bundesliga2526, LEAGUE, '5')).toHaveLength(9)
  })

  // Бельгия: после 30 туров — группы за чемпионство, Лигу конференций и выживание с общими номерами туров
  it('группы после основного сезона с одним номером — один тур', () => {
    const schedule = [
      scheduleMatch('1', 'Regular Season - 30', '2026-03-15T15:00:00'),
      scheduleMatch('2', 'Championship Group - 31', '2026-04-04T15:00:00'),
      scheduleMatch('3', 'Relegation Group - 31', '2026-04-05T15:00:00'),
      scheduleMatch('4', 'Quarter-finals', '2026-04-23T15:00:00'),
    ]
    expect(namesOf(schedule, LEAGUE)).toEqual(['30 тур', '31 тур', 'Плей-офф'])
    expect(matchesOf(schedule, LEAGUE, '31').map(match => match.id)).toEqual(['2', '3'])
  })
})

describe('getSeasonRounds: турнир', () => {
  it('ЛЧ 2025/26: восемь туров общего этапа, потом раунды плей-офф из сетки', () => {
    expect(namesOf(championsLeague2526, LEAGUE_PHASE)).toEqual([
      '1 тур', '2 тур', '3 тур', '4 тур', '5 тур', '6 тур', '7 тур', '8 тур',
      'Раунд плей-офф', '1/8 финала', 'Четвертьфинал', 'Полуфинал', 'Финал',
    ])
  })

  it('ЛЧ 2025/26: в туре все матчи раунда, летняя квалификация — ни в одном туре', () => {
    const { roundByMatch } = getSeasonRounds(championsLeague2526, LEAGUE_PHASE)
    expect(matchesOf(championsLeague2526, LEAGUE_PHASE, '1')).toHaveLength(18)
    expect(matchesOf(championsLeague2526, LEAGUE_PHASE, 'playoff-round-of-32')).toHaveLength(16)
    const qualifying = championsLeague2526.filter(match => /Qualifying|^Play-offs$/.test(match.round))
    expect(qualifying).toHaveLength(92)
    expect(qualifying.some(match => roundByMatch.has(match.id))).toBe(false)
  })

  // У ЛК туров общего этапа шесть, а квалификационный раунд плей-офф называется «Playoff round», не «Play-offs»
  it('ЛК 2025/26: шесть туров общего этапа, потом раунды плей-офф; квалификация — ни в одном туре', () => {
    const conferenceLeague = getCompetition('848')!
    expect(namesOf(conferenceLeague2526, conferenceLeague)).toEqual([
      '1 тур', '2 тур', '3 тур', '4 тур', '5 тур', '6 тур',
      'Раунд плей-офф', '1/8 финала', 'Четвертьфинал', 'Полуфинал', 'Финал',
    ])
    const { roundByMatch } = getSeasonRounds(conferenceLeague2526, conferenceLeague)
    const qualifying = conferenceLeague2526.filter(match => /Qualifying|^Playoff round$/.test(match.round))
    expect(qualifying).toHaveLength(256)
    expect(qualifying.some(match => roundByMatch.has(match.id))).toBe(false)
  })

  // В 2024/25 раунд плей-офф называется по-другому — по-русски всё равно из сетки
  it('ЛЧ 2024/25: раунд плей-офф под другим названием назван так же', () => {
    const { rounds } = getSeasonRounds(championsLeague2425, LEAGUE_PHASE)
    expect(rounds.find(round => round.name === 'Раунд плей-офф')?.id).toBe('playoff-knockout-round-play-offs')
  })

  it('Лига наций 2024/25: четвертьфиналы без стыковых матчей, матч за 3-е место перед финалом', () => {
    expect(namesOf(nationsLeague2425, NATIONS_LEAGUE)).toEqual([
      '1 тур', '2 тур', '3 тур', '4 тур', '5 тур', '6 тур',
      'Четвертьфинал', 'Полуфинал', 'Матч за 3-е место', 'Финал',
    ])
    const quarterFinals = matchesOf(nationsLeague2425, NATIONS_LEAGUE, 'playoff-quarter-finals')
    expect(quarterFinals).toHaveLength(8)
    expect(quarterFinals.some(match => match.home.name === 'Турция')).toBe(false)
  })
})

describe('getSeasonRounds: даты туров', () => {
  const datesOf = (schedule: SeasonMatch[], competition: RoundsCompetition, id: string) => {
    const round = getSeasonRounds(schedule, competition).rounds.find(item => item.id === id)
    return [round?.from, round?.to]
  }

  it('первый и последний день тура по Москве', () => {
    expect(datesOf(bundesliga2526, LEAGUE, '5')).toEqual(['2025-09-26', '2025-09-28'])
  })

  // В 16 туре два матча перенесли на 27 января, в 17 — один на 4 марта: тур от этого не растягивается
  it('перенесённые матчи в даты тура не входят', () => {
    expect(datesOf(bundesliga2526, LEAGUE, '16')).toEqual(['2026-01-09', '2026-01-11'])
    expect(datesOf(bundesliga2526, LEAGUE, '17')).toEqual(['2026-01-13', '2026-01-15'])
  })

  it('у плей-офф турнира в датах и первые, и ответные матчи', () => {
    expect(datesOf(championsLeague2526, LEAGUE_PHASE, 'playoff-round-of-16')).toEqual(['2026-03-10', '2026-03-18'])
  })

  // Как у МЛС: первый раунд, перерыв на матчи сборных, полуфиналы конференций, финал
  it('у «Плей-офф» лиги даты целиком, даже с перерывами между раундами', () => {
    const schedule = [
      scheduleMatch('1', 'Round of 16', '2025-10-25T20:00:00'),
      scheduleMatch('2', 'Quarter-finals', '2025-11-08T20:00:00'),
      scheduleMatch('3', 'Semi-finals', '2025-11-22T20:00:00'),
      scheduleMatch('4', 'Final', '2025-12-06T20:00:00'),
    ]
    expect(datesOf(schedule, LEAGUE, LEAGUE_PLAYOFF_ROUND)).toEqual(['2025-10-25', '2025-12-06'])
  })
})

describe('getMatchDays', () => {
  it('все дни сезона с матчами по порядку, и дни перенесённых матчей тоже', () => {
    const days = getMatchDays(bundesliga2526)
    expect(days).toHaveLength(102)
    expect([days[0], days.at(-1)]).toEqual(['2025-08-22', '2026-05-25'])
    expect(days).toContain('2026-01-27')
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
