import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MatchItem from '~/components/MatchItem.vue'
import type { Match } from '~/types'
import { makeMatch } from '../../helpers/matches'

// Идущий матч 1:2, начался в 22:00 по Москве
const liveMatch = (overrides: Partial<Match>) => makeMatch({ status: '2H', homeScore: 1, awayScore: 2, timestamp: '2026-10-20T19:00:00', ...overrides })

// Левая колонка строки: [верхняя строка, мелкая подпись под ней]
async function stateColumn(match: Match) {
  const wrapper = await mountSuspended(MatchItem, { props: { match } })
  const sub = wrapper.find('.match__sub')
  return [wrapper.get('.match__state').text(), sub.exists() ? sub.text() : null]
}

describe('MatchItem: левая колонка', () => {
  it('идущий матч — точка и минута, в доп. время с пометкой', async () => {
    expect(await stateColumn(liveMatch({ progress: '52' }))).toEqual(['52′', null])
    expect(await stateColumn(liveMatch({ progress: '45+2' }))).toEqual(['45+2′', null])
    expect(await stateColumn(liveMatch({ status: 'ET', progress: '97' }))).toEqual(['97′', 'ДВ'])
  })

  // Рядом с точкой «Перерыв» на телефоне не помещается в колонку
  it('идущий матч без минуты — точка, период под ней', async () => {
    expect(await stateColumn(liveMatch({ status: 'HT' }))).toEqual(['', 'Перерыв'])
    expect(await stateColumn(liveMatch({ status: '2H' }))).toEqual(['', '2-й тайм'])
  })

  it('остальные — время начала по Москве', async () => {
    expect(await stateColumn(liveMatch({ status: 'FT' }))).toEqual(['22:00', 'Завершён'])
    expect(await stateColumn(liveMatch({ status: 'NS', homeScore: null, awayScore: null }))).toEqual(['22:00', null])
  })
})
