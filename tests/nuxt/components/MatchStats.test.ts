import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MatchStats from '~/components/MatchStats.vue'

describe('MatchStats', () => {
  it('числа хозяев слева, гостей справа; кто впереди — выделен, поровну — никто', async () => {
    const wrapper = await mountSuspended(MatchStats, {
      props: {
        stats: [
          { label: 'Владение мячом', home: 66, away: 34, format: 'percent' },
          { label: 'Ожидаемые голы (xG)', home: 0.3, away: 1.25, format: 'decimal' },
          { label: 'Офсайды', home: 0, away: 0, format: 'number' },
          { label: 'Сейвы', home: 0, away: 3, format: 'number' },
        ],
      },
    })
    const rows = wrapper.findAll('.stat')
    expect(rows.map(row => [
      row.find('.stat__value--home').text(),
      row.find('.stat__label').text(),
      row.find('.stat__value--away').text(),
    ])).toEqual([
      ['66%', 'Владение мячом', '34%'],
      ['0.30', 'Ожидаемые голы (xG)', '1.25'],
      ['0', 'Офсайды', '0'],
      ['0', 'Сейвы', '3'],
    ])
    expect(rows.map(row => row.findAll('.stat__value--lead').map(value => value.text()))).toEqual([['66%'], ['1.25'], [], ['3']])
    // Полоска делится по долям; у 0:0 — пополам. Просвет между частями — только если видны обе
    expect(rows.map(row => row.findAll('.stat__part').map(part => part.attributes('style')))).toEqual([
      ['flex-grow: 66;', 'flex-grow: 34;'],
      ['flex-grow: 0.3;', 'flex-grow: 1.25;'],
      ['flex-grow: 1;', 'flex-grow: 1;'],
      ['flex-grow: 0;', 'flex-grow: 3;'],
    ])
    expect(rows.map(row => row.find('.stat__bar').classes('stat__bar--split'))).toEqual([true, true, true, false])
  })
})
