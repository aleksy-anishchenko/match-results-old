import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MatchTimeline from '~/components/MatchTimeline.vue'

describe('MatchTimeline', () => {
  it('события хозяев слева, гостей справа, с минутой (и добавленным временем), значком и пометками', async () => {
    const wrapper = await mountSuspended(MatchTimeline, {
      props: {
        events: [
          { minute: 6, extra: null, side: 'away', kind: 'goal', player: 'Kai Havertz', assist: 'Leandro Trossard', playerOut: null },
          { minute: 38, extra: null, side: 'home', kind: 'own-goal', player: 'Stijn van Gassel', assist: null, playerOut: null },
          { minute: 54, extra: null, side: 'away', kind: 'yellow-card', player: 'Bukayo Saka', assist: null, playerOut: null },
          { minute: 65, extra: null, side: 'home', kind: 'penalty', player: 'Ousmane Dembélé', assist: null, playerOut: null },
          { minute: 66, extra: null, side: 'away', kind: 'substitution', player: 'Jurriën Timber', assist: null, playerOut: 'Cristhian Mosquera' },
          { minute: 90, extra: 3, side: 'home', kind: 'red-card', player: 'Kevin Danso', assist: null, playerOut: null },
        ],
      },
    })
    const events = wrapper.findAll('.event')
    expect(events.map(event => event.classes().find(name => name === 'event--home' || name === 'event--away'))).toEqual([
      'event--away', 'event--home', 'event--away', 'event--home', 'event--away', 'event--home',
    ])
    expect(events.map(event => [event.find('.event__player').text(), event.find('.event__minute').text()])).toEqual([
      ['Kai Havertz', '6′'],
      ['Stijn van Gassel (авт.)', '38′'],
      ['Bukayo Saka', '54′'],
      ['Ousmane Dembélé (пен.)', '65′'],
      ['Jurriën Timber', '66′'],
      ['Kevin Danso', '90+3′'],
    ])
    expect(events.map(event => event.find('.event__icon').attributes('aria-label'))).toEqual([
      'Гол', 'Гол', 'Жёлтая карточка', 'Гол', 'Замена', 'Красная карточка',
    ])
    // Голы выделены, у гола — пас, у замены — кого заменили
    expect(events.map(event => event.classes('event--goal'))).toEqual([true, true, false, true, false, false])
    expect(events.map(event => event.find('.event__extra').exists() ? event.find('.event__extra').text() : null)).toEqual([
      'пас: Leandro Trossard', null, null, null, 'вместо Cristhian Mosquera', null,
    ])
  })
})
