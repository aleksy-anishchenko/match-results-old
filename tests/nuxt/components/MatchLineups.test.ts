import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MatchLineups from '~/components/MatchLineups.vue'

describe('MatchLineups', () => {
  it('хозяева слева, гости справа: название по-русски, схема, линии, запасные, тренер', async () => {
    const wrapper = await mountSuspended(MatchLineups, {
      props: {
        homeTeam: 'Spartak Moscow',
        awayTeam: 'Rubin Kazan',
        lineups: {
          home: {
            formation: '4-1-4-1',
            lines: [[{ number: 1, name: 'I. Pomazun' }], [{ number: 47, name: 'R. Zobnin' }, { number: 68, name: 'R. Litvinov' }]],
            substitutes: [{ number: 19, name: 'M. Daku' }],
            coach: 'Carcedo',
          },
          away: {
            formation: null,
            lines: [[{ number: 38, name: 'E. Staver' }]],
            substitutes: [],
            coach: null,
          },
        },
      },
    })
    expect(wrapper.findAll('.lineup__team').map(team => [team.find('.lineup__name').text(), team.find('.lineup__formation').exists() ? team.find('.lineup__formation').text() : null])).toEqual([
      ['Спартак', '4-1-4-1'],
      ['Рубин', null],
    ])
    const [homeStart, awayStart] = wrapper.findAll('.lineup__start')
    expect(homeStart!.findAll('.lineup__players').map(line => line.findAll('.player__name').map(name => name.text()))).toEqual([
      ['I. Pomazun'],
      ['R. Zobnin', 'R. Litvinov'],
    ])
    expect(awayStart!.find('.player__number').text()).toBe('38')
    expect(wrapper.findAll('.player--sub .player__name').map(name => name.text())).toEqual(['M. Daku'])
    expect(wrapper.findAll('.lineup__coach').map(coach => coach.text())).toEqual(['Тренер: Carcedo', ''])
  })
})
