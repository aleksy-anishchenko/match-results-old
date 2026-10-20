import { describe, it, expect } from 'vitest'
import { describeHomeSelection, parseHomeQuery } from '~/utils/homeQuery'
import type { RoundsResponse } from '~/types'

const ROUNDS: RoundsResponse = {
  season: '2026-2027',
  rounds: [
    { id: '5', name: '5 тур', from: '2026-09-18', to: '2026-09-20' },
    { id: 'playoff', name: 'Плей-офф', from: '2027-05-26', to: '2027-05-30' },
  ],
  current: '5',
  matchDays: [],
}

const today = '2026-09-20'

describe('parseHomeQuery', () => {
  it('тур, дни или ничего', () => {
    expect(parseHomeQuery({ round: '7' })).toEqual({ round: '7', range: null })
    expect(parseHomeQuery({ from: '2026-10-12', to: '2026-10-15' })).toEqual({ round: null, range: { from: '2026-10-12', to: '2026-10-15' } })
    expect(parseHomeQuery({})).toEqual({ round: null, range: null })
  })

  it('без to — один день', () => {
    expect(parseHomeQuery({ from: '2026-10-12' }).range).toEqual({ from: '2026-10-12', to: '2026-10-12' })
  })
})

describe('describeHomeSelection', () => {
  const labelOf = (query: Record<string, string>) => describeHomeSelection(parseHomeQuery(query), ROUNDS, today)

  it('тур — его название', () => {
    expect(labelOf({ round: 'playoff' })).toBe('Плей-офф')
  })

  it('без параметров главная открывает текущий тур', () => {
    expect(labelOf({})).toBe('5 тур')
  })

  // Тура 99 нет в сезоне: главная откроет текущий, так и подписываем
  it('неверный тур — текущий', () => {
    expect(labelOf({ round: '99' })).toBe('5 тур')
  })

  it('дни — как в поле «Дата»', () => {
    expect(labelOf({ from: today, to: today })).toBe('Сегодня')
    expect(labelOf({ from: '2026-10-12', to: '2026-10-15' })).toBe('12–15 окт')
  })

  it('туров нет — просто «Матчи»', () => {
    expect(describeHomeSelection(parseHomeQuery({}), null, today)).toBe('Матчи')
  })
})
