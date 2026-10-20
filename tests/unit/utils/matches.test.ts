import { describe, it, expect } from 'vitest'
import { describeDates, formatReadableDate, formatShortDates, groupMatchesByDate, shiftDate } from '~/utils/matches'
import {
  applyLiveScore,
  getLeaguePhaseMatches,
  getLeaguePhaseRoundCount,
  getMatchStatusKind,
  getMatchWinnerSide,
  getMoscowDate,
  getRoundCounts,
  needsLiveScores,
} from '#shared/utils/matches'
import type { Match } from '~/types'

const makeMatch = (overrides: Partial<Match>): Match => ({
  idEvent: '1',
  homeTeam: 'Brazil',
  awayTeam: 'Germany',
  homeBadge: '',
  awayBadge: '',
  homeScore: null,
  awayScore: null,
  homePenScore: null,
  awayPenScore: null,
  status: 'NS',
  progress: null,
  timestamp: '2026-06-23T10:00:00',
  date: '2026-06-23',
  group: null,
  season: '2026',
  round: null,
  ...overrides,
})

describe('groupMatchesByDate', () => {
  it('группирует матчи по московской дате', () => {
    const match = makeMatch({ timestamp: '2026-06-23T10:00:00' }) // 13:00 МСК
    const result = groupMatchesByDate([match])
    expect(Object.keys(result)).toEqual(['2026-06-23'])
  })

  it('матч в 21:00 UTC попадает в следующий день по МСК (00:00 МСК)', () => {
    // Это был реальный баг: API возвращал dateEvent=2026-06-22,
    // но в Москве матч начинался уже 23 июня в 00:00
    const match = makeMatch({ timestamp: '2026-06-22T21:00:00' })
    const result = groupMatchesByDate([match])
    expect(Object.keys(result)).toContain('2026-06-23')
    expect(Object.keys(result)).not.toContain('2026-06-22')
  })

  it('матч в 20:59 UTC остаётся в том же дне по МСК (23:59 МСК)', () => {
    const match = makeMatch({ timestamp: '2026-06-22T20:59:00' })
    const result = groupMatchesByDate([match])
    expect(Object.keys(result)).toContain('2026-06-22')
    expect(Object.keys(result)).not.toContain('2026-06-23')
  })

  it('матчи разных дней группируются отдельно', () => {
    const matches = [
      makeMatch({ idEvent: '1', timestamp: '2026-06-22T12:00:00' }),
      makeMatch({ idEvent: '2', timestamp: '2026-06-23T12:00:00' }),
      makeMatch({ idEvent: '3', timestamp: '2026-06-23T15:00:00' }),
    ]
    const result = groupMatchesByDate(matches)
    expect(Object.keys(result)).toHaveLength(2)
    expect(result['2026-06-22']).toHaveLength(1)
    expect(result['2026-06-23']).toHaveLength(2)
  })

  it('возвращает пустой объект для пустого массива', () => {
    expect(groupMatchesByDate([])).toEqual({})
  })
})

describe('formatReadableDate', () => {
  it('форматирует дату на русском языке без года', () => {
    expect(formatReadableDate('2026-06-23')).toBe('Вторник, 23 июня')
  })

  it('первая буква заглавная', () => {
    const result = formatReadableDate('2026-06-23')
    expect(result[0]).toMatch(/[А-ЯЁ]/)
  })

  it('с коротким днём недели', () => {
    expect(formatReadableDate('2026-06-23', 'short')).toBe('Вт, 23 июня')
  })
})

describe('getMoscowDate', () => {
  it('переводит UTC-время из API в московскую дату', () => {
    expect(getMoscowDate('2026-06-23T15:00:00')).toBe('2026-06-23')
    // 22:30 UTC — это уже 01:30 следующего дня по Москве
    expect(getMoscowDate('2026-06-23T22:30:00')).toBe('2026-06-24')
  })

  it('принимает и объект Date', () => {
    expect(getMoscowDate(new Date('2026-06-23T22:30:00Z'))).toBe('2026-06-24')
  })
})

describe('getMatchStatusKind', () => {
  it('различает запланированный, идущий, завершённый и несостоявшийся матч', () => {
    expect(getMatchStatusKind('NS')).toBe('scheduled')
    expect(getMatchStatusKind('1H')).toBe('live')
    expect(getMatchStatusKind('HT')).toBe('live')
    expect(getMatchStatusKind('PEN')).toBe('live')
    expect(getMatchStatusKind('FT')).toBe('finished')
    expect(getMatchStatusKind('AET')).toBe('finished')
    expect(getMatchStatusKind('AP')).toBe('finished')
    expect(getMatchStatusKind('PST')).toBe('inactive')
    expect(getMatchStatusKind('CANC')).toBe('inactive')
  })

  it('неизвестный код считает запланированным', () => {
    expect(getMatchStatusKind('???')).toBe('scheduled')
  })
})

describe('applyLiveScore', () => {
  const live = { status: '2H', progress: '52', homeScore: '1', awayScore: '0' }

  it('идущий матч: счёт, статус и минута из livescore', () => {
    const match = makeMatch({ status: '1H', homeScore: '0', awayScore: '0' })
    expect(applyLiveScore(match, live)).toEqual({ ...match, status: '2H', homeScore: '1', awayScore: '0', progress: '52' })
  })

  it('матч начался, а расписание ещё пишет «не начался»', () => {
    expect(applyLiveScore(makeMatch({ status: 'NS' }), { ...live, status: '1H', progress: '3', homeScore: '0' })).toMatchObject({ status: '1H', progress: '3' })
  })

  it('в перерыве и серии пенальти минуты нет — подпись статуса', () => {
    expect(applyLiveScore(makeMatch({ status: '1H' }), { ...live, status: 'HT', progress: '45' }).progress).toBeNull()
    expect(applyLiveScore(makeMatch({ status: 'ET' }), { ...live, status: 'PEN', progress: '120' }).progress).toBeNull()
    expect(applyLiveScore(makeMatch({ status: '2H' }), { ...live, status: 'ET', progress: '97' }).progress).toBe('97')
  })

  it('по расписанию матч закончен или перенесён — верим расписанию', () => {
    const finished = makeMatch({ status: 'FT', homeScore: '2', awayScore: '0' })
    expect(applyLiveScore(finished, live)).toBe(finished)
    const postponed = makeMatch({ status: 'PST' })
    expect(applyLiveScore(postponed, live)).toBe(postponed)
  })

  it('матча нет в livescore — без изменений', () => {
    const match = makeMatch({ status: '2H' })
    expect(applyLiveScore(match, undefined)).toBe(match)
  })
})

describe('needsLiveScores', () => {
  // Матч начинается 23 июня в 10:00 UTC
  const kickoff = Date.parse('2026-06-23T10:00:00Z')
  const minutes = (n: number) => n * 60 * 1000

  it('идущий матч — обновляем', () => {
    expect(needsLiveScores([makeMatch({ status: '2H' })], kickoff + minutes(60))).toBe(true)
    expect(needsLiveScores([makeMatch({ status: 'HT' })], kickoff + minutes(50))).toBe(true)
  })

  it('матч по времени уже должен идти, а расписание пишет «не начался» — обновляем, но не дольше 3 часов', () => {
    expect(needsLiveScores([makeMatch({ status: 'NS' })], kickoff - minutes(1))).toBe(false)
    expect(needsLiveScores([makeMatch({ status: 'NS' })], kickoff)).toBe(true)
    expect(needsLiveScores([makeMatch({ status: 'NS' })], kickoff + minutes(179))).toBe(true)
    expect(needsLiveScores([makeMatch({ status: 'NS' })], kickoff + minutes(180))).toBe(false)
  })

  it('сыгранные, перенесённые и будущие матчи — не обновляем', () => {
    const now = kickoff + minutes(30)
    expect(needsLiveScores([makeMatch({ status: 'FT' }), makeMatch({ status: 'PST' })], now)).toBe(false)
    expect(needsLiveScores([makeMatch({ status: 'NS', timestamp: '2026-06-24T10:00:00' })], now)).toBe(false)
    expect(needsLiveScores([], now)).toBe(false)
  })
})

describe('getLeaguePhaseRoundCount', () => {
  const counts = (entries: Record<string, number>) => new Map(Object.entries(entries))

  it('число матчей, которое повторяется в трёх и больше раундах', () => {
    expect(getLeaguePhaseRoundCount(counts({ 0: 14, 1: 46, 2: 46, 3: 38, 4: 18, 5: 18, 6: 18 }))).toBe(18)
  })

  it('раунды плей-офф (степени двойки) не считаются', () => {
    expect(getLeaguePhaseRoundCount(counts({ 16: 16, 32: 16, 125: 8, 150: 4, 200: 1, 4: 18, 5: 18, 6: 18 }))).toBe(18)
  })

  it('меньше трёх одинаковых раундов — общего этапа нет', () => {
    expect(getLeaguePhaseRoundCount(counts({ 1: 18, 2: 18, 3: 30 }))).toBeNull()
  })
})

describe('getLeaguePhaseMatches', () => {
  const match = (intRound: string, strHomeTeam: string, strAwayTeam: string) => ({ intRound, strHomeTeam, strAwayTeam })

  // Мини-турнир по образцу ЛЧ 2026/27: шесть команд A–F, туры по 3 матча, а в раунды 1 и 2
  // TheSportsDB подмешал квалификацию (Q — команды, которые в общий этап не попали)
  const leaguePhase = [
    match('1', 'A', 'B'), match('1', 'C', 'D'), match('1', 'E', 'F'),
    match('2', 'A', 'C'), match('2', 'B', 'E'), match('2', 'D', 'F'),
    match('3', 'A', 'D'), match('3', 'B', 'F'), match('3', 'C', 'E'),
    match('4', 'A', 'E'), match('4', 'B', 'D'), match('4', 'C', 'F'),
    match('5', 'A', 'F'), match('5', 'B', 'C'), match('5', 'D', 'E'),
  ]
  const qualifying = [
    match('0', 'Q3', 'C'),
    match('1', 'Q1', 'A'), match('1', 'Q2', 'Q3'),
    match('2', 'A', 'Q1'),
  ]
  const playoff = [match('125', 'A', 'B'), match('125', 'B', 'A')]
  const schedule = [...qualifying, ...leaguePhase, ...playoff]

  it('оставляет все туры общего этапа, даже смешанные с квалификацией', () => {
    expect(getRoundCounts(schedule).get('1')).toBe(5) // раунд 1 «грязный»: 3 тура + 2 квалификации

    const result = getLeaguePhaseMatches(schedule)

    expect(result).toHaveLength(leaguePhase.length)
    expect(result).toEqual(expect.arrayContaining(leaguePhase))
  })

  it('без квалификации и плей-офф', () => {
    const result = getLeaguePhaseMatches(schedule)

    for (const excluded of [...qualifying, ...playoff]) {
      expect(result).not.toContainEqual(excluded)
    }
  })

  it('пока туров общего этапа нет в расписании — пусто', () => {
    expect(getLeaguePhaseMatches(qualifying)).toEqual([])
  })
})

describe('getMatchWinnerSide', () => {
  const matchResult = (overrides: Partial<Match>) => ({
    homeScore: null,
    awayScore: null,
    homePenScore: null,
    awayPenScore: null,
    status: 'FT',
    ...overrides,
  })

  it('победитель по счёту', () => {
    expect(getMatchWinnerSide(matchResult({ homeScore: '2', awayScore: '1' }))).toBe('home')
    expect(getMatchWinnerSide(matchResult({ homeScore: '0', awayScore: '1', status: 'AET' }))).toBe('away')
  })

  it('ничья без пенальти — победителя нет', () => {
    expect(getMatchWinnerSide(matchResult({ homeScore: '1', awayScore: '1' }))).toBeNull()
  })

  it('после пенальти (AP) победитель по серии', () => {
    expect(getMatchWinnerSide(matchResult({ homeScore: '1', awayScore: '1', status: 'AP', homePenScore: 3, awayPenScore: 4 }))).toBe('away')
  })

  it('AP без счёта серии — победителя не угадываем', () => {
    expect(getMatchWinnerSide(matchResult({ homeScore: '1', awayScore: '1', status: 'AP' }))).toBeNull()
  })

  it('незавершённый матч — победителя нет, даже если кто-то ведёт', () => {
    expect(getMatchWinnerSide(matchResult({ homeScore: '2', awayScore: '0', status: '2H' }))).toBeNull()
    expect(getMatchWinnerSide(matchResult({ status: 'NS' }))).toBeNull()
  })
})

describe('shiftDate', () => {
  it('сдвигает день вперёд и назад, в том числе через границу месяца и года', () => {
    expect(shiftDate('2026-10-31', 1)).toBe('2026-11-01')
    expect(shiftDate('2027-01-01', -1)).toBe('2026-12-31')
  })
})

describe('formatShortDates', () => {
  it('один день, диапазон в одном месяце и через границу месяцев', () => {
    expect(formatShortDates('2026-09-20', '2026-09-20')).toBe('20 сен')
    expect(formatShortDates('2026-09-18', '2026-09-20')).toBe('18–20 сен')
    expect(formatShortDates('2026-09-28', '2026-10-03')).toBe('28 сен – 3 окт')
  })

  // Месяц в родительном падеже, как в «20 мая»
  it('май — «мая»', () => {
    expect(formatShortDates('2027-05-23', '2027-05-23')).toBe('23 мая')
  })
})

describe('describeDates', () => {
  const today = '2026-09-20'

  it('вчера, сегодня и завтра — словом, дата отдельно', () => {
    expect(describeDates({ from: '2026-09-19', to: '2026-09-19' }, today)).toEqual({ label: 'Вчера', hint: '19 сен' })
    expect(describeDates({ from: '2026-09-20', to: '2026-09-20' }, today)).toEqual({ label: 'Сегодня', hint: '20 сен' })
    expect(describeDates({ from: '2026-09-21', to: '2026-09-21' }, today)).toEqual({ label: 'Завтра', hint: '21 сен' })
  })

  it('другой день — с коротким днём недели', () => {
    expect(describeDates({ from: '2026-09-12', to: '2026-09-12' }, today)).toEqual({ label: 'Сб, 12 сен', hint: null })
  })

  it('несколько дней — диапазоном, даже если среди них сегодня', () => {
    expect(describeDates({ from: '2026-09-19', to: '2026-09-21' }, today)).toEqual({ label: '19–21 сен', hint: null })
  })
})
