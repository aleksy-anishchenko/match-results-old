import { describe, it, expect } from 'vitest'
import { describeDates, formatReadableDate, formatShortDates, groupMatchesByDate, shiftDate } from '~/utils/matches'
import {
  applyLiveScore,
  getMatchStatusKind,
  getMatchWinnerSide,
  getMoscowDate,
  formatMatchProgress,
  formatPenaltyScore,
  getDueMatchIds,
} from '#shared/utils/matches'
import type { Match } from '~/types'
import { makeMatch } from '../../helpers/matches'

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
      makeMatch({ id: '1', timestamp: '2026-06-22T12:00:00' }),
      makeMatch({ id: '2', timestamp: '2026-06-23T12:00:00' }),
      makeMatch({ id: '3', timestamp: '2026-06-23T15:00:00' }),
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
    // Коды API-Football: P — серия пенальти идёт, PEN — матч завершён по пенальти
    expect(getMatchStatusKind('P')).toBe('live')
    expect(getMatchStatusKind('FT')).toBe('finished')
    expect(getMatchStatusKind('AET')).toBe('finished')
    expect(getMatchStatusKind('PEN')).toBe('finished')
    expect(getMatchStatusKind('PST')).toBe('inactive')
    expect(getMatchStatusKind('CANC')).toBe('inactive')
  })

  it('неизвестный код считает запланированным', () => {
    expect(getMatchStatusKind('???')).toBe('scheduled')
  })
})

describe('formatMatchProgress', () => {
  it('минута идущего матча, с добавленным временем', () => {
    expect(formatMatchProgress('1H', 24, null)).toBe('24')
    expect(formatMatchProgress('1H', 45, 2)).toBe('45+2')
    expect(formatMatchProgress('ET', 105, null)).toBe('105')
  })

  it('время не идёт — минуты нет', () => {
    expect(formatMatchProgress('HT', 45, null)).toBeNull()
    expect(formatMatchProgress('P', 120, null)).toBeNull()
    expect(formatMatchProgress('FT', 90, 6)).toBeNull()
    expect(formatMatchProgress('1H', null, null)).toBeNull()
  })
})

describe('applyLiveScore', () => {
  const live = { status: '2H', progress: '52', homeScore: 1, awayScore: 0, homePenScore: null, awayPenScore: null }

  it('идущий матч: счёт, статус и минута из живых данных', () => {
    const match = makeMatch({ status: '1H', homeScore: 0, awayScore: 0 })
    expect(applyLiveScore(match, live)).toEqual({ ...match, status: '2H', homeScore: 1, awayScore: 0, progress: '52' })
  })

  it('матч начался, а расписание ещё пишет «не начался»', () => {
    expect(applyLiveScore(makeMatch({ status: 'NS' }), { ...live, status: '1H', progress: '3', homeScore: 0 })).toMatchObject({ status: '1H', progress: '3' })
  })

  it('в перерыве и серии пенальти минуты нет — подпись статуса', () => {
    expect(applyLiveScore(makeMatch({ status: '1H' }), { ...live, status: 'HT', progress: '45' }).progress).toBeNull()
    expect(applyLiveScore(makeMatch({ status: 'ET' }), { ...live, status: 'P', progress: '120' }).progress).toBeNull()
    expect(applyLiveScore(makeMatch({ status: '2H' }), { ...live, status: 'ET', progress: '97' }).progress).toBe('97')
  })

  // Расписание хранится несколько минут: матч там ещё идёт, а по живым данным уже решён по пенальти
  it('матч закончился по пенальти — статус и счёт серии из живых данных', () => {
    const shootout = { ...live, status: 'PEN', progress: null, homeScore: 1, awayScore: 1, homePenScore: 4, awayPenScore: 3 }
    expect(applyLiveScore(makeMatch({ status: 'P' }), shootout)).toMatchObject({ status: 'PEN', homePenScore: 4, awayPenScore: 3, progress: null })
  })

  it('по расписанию матч закончен или перенесён — верим расписанию', () => {
    const finished = makeMatch({ status: 'FT', homeScore: 2, awayScore: 0 })
    expect(applyLiveScore(finished, live)).toBe(finished)
    const postponed = makeMatch({ status: 'PST' })
    expect(applyLiveScore(postponed, live)).toBe(postponed)
  })

  it('о матче живых данных нет — без изменений', () => {
    const match = makeMatch({ status: '2H' })
    expect(applyLiveScore(match, undefined)).toBe(match)
  })
})

describe('getDueMatchIds', () => {
  // Матч начинается 23 июня в 10:00 UTC
  const timestamp = '2026-06-23T10:00:00'
  const kickoff = Date.parse(`${timestamp}Z`)
  const minutes = (n: number) => n * 60 * 1000
  const due = (match: Partial<Match>, now: number) => getDueMatchIds([makeMatch({ timestamp, ...match })], now).length > 0

  it('идущий по расписанию матч — обновляем, но не дольше 3 часов от начала', () => {
    expect(due({ status: '2H' }, kickoff + minutes(60))).toBe(true)
    expect(due({ status: 'HT' }, kickoff + minutes(50))).toBe(true)
    // Расписание на открытой странице не обновляется и может навсегда остаться на «2-й тайм»
    expect(due({ status: '2H' }, kickoff + minutes(180))).toBe(false)
  })

  it('идущий матч без времени начала — обновляем', () => {
    expect(due({ status: '2H', timestamp: '' }, kickoff)).toBe(true)
  })

  it('матч по времени уже должен идти, а расписание пишет «не начался» — обновляем, но не дольше 3 часов', () => {
    expect(due({ status: 'NS' }, kickoff - minutes(1))).toBe(false)
    expect(due({ status: 'NS' }, kickoff)).toBe(true)
    expect(due({ status: 'NS' }, kickoff + minutes(179))).toBe(true)
    expect(due({ status: 'NS' }, kickoff + minutes(180))).toBe(false)
  })

  it('из списка — номера только тех, кого пора обновлять', () => {
    const now = kickoff + minutes(30)
    const matches = [
      makeMatch({ id: '1', status: '1H', timestamp }),
      makeMatch({ id: '2', status: 'FT', timestamp }),
      makeMatch({ id: '3', status: 'PST', timestamp }),
      makeMatch({ id: '4', status: 'NS', timestamp: '2026-06-24T10:00:00' }),
      makeMatch({ id: '5', status: 'NS', timestamp }),
    ]
    expect(getDueMatchIds(matches, now)).toEqual(['1', '5'])
    expect(getDueMatchIds([], now)).toEqual([])
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
    expect(getMatchWinnerSide(matchResult({ homeScore: 2, awayScore: 1 }))).toBe('home')
    expect(getMatchWinnerSide(matchResult({ homeScore: 0, awayScore: 1, status: 'AET' }))).toBe('away')
  })

  it('ничья без пенальти — победителя нет', () => {
    expect(getMatchWinnerSide(matchResult({ homeScore: 1, awayScore: 1 }))).toBeNull()
  })

  it('после пенальти (PEN) победитель по серии', () => {
    expect(getMatchWinnerSide(matchResult({ homeScore: 1, awayScore: 1, status: 'PEN', homePenScore: 3, awayPenScore: 4 }))).toBe('away')
  })

  it('PEN без счёта серии — победителя не угадываем', () => {
    expect(getMatchWinnerSide(matchResult({ homeScore: 1, awayScore: 1, status: 'PEN' }))).toBeNull()
  })

  it('незавершённый матч — победителя нет, даже если кто-то ведёт', () => {
    expect(getMatchWinnerSide(matchResult({ homeScore: 2, awayScore: 0, status: '2H' }))).toBeNull()
    expect(getMatchWinnerSide(matchResult({ status: 'NS' }))).toBeNull()
  })
})

describe('formatPenaltyScore', () => {
  it('счёт серии — «4:3»; без счёта серии — ничего', () => {
    expect(formatPenaltyScore({ homePenScore: 4, awayPenScore: 3 })).toBe('4:3')
    expect(formatPenaltyScore({ homePenScore: 0, awayPenScore: 1 })).toBe('0:1')
    expect(formatPenaltyScore({ homePenScore: null, awayPenScore: null })).toBeNull()
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
