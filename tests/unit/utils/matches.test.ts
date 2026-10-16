import { describe, it, expect } from 'vitest'
import { groupMatchesByDate, formatReadableDate } from '~/utils/matches'
import { getMatchStatusKind, getMoscowDate } from '#shared/utils/matches'
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
