import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MatchScore from '~/components/MatchScore.vue'

describe('MatchScore', () => {
  it('отображает счёт когда голы есть', () => {
    const wrapper = mount(MatchScore, {
      props: { homeScore: '2', awayScore: '1', status: 'FT' },
    })
    expect(wrapper.text()).toContain('2')
    expect(wrapper.text()).toContain('1')
    expect(wrapper.find('.score').classes()).toContain('score--finished')
  })

  it('показывает прочерк когда матч не начался', () => {
    const wrapper = mount(MatchScore, {
      props: { homeScore: null, awayScore: null },
    })
    expect(wrapper.text()).toContain('–')
    expect(wrapper.find('.score').classes()).toContain('score--scheduled')
  })

  it('показывает прочерк только для незаполненной команды', () => {
    const wrapper = mount(MatchScore, {
      props: { homeScore: '1', awayScore: null },
    })
    expect(wrapper.text()).toContain('1')
    expect(wrapper.text()).toContain('–')
  })

  it('помечает идущий матч', () => {
    const wrapper = mount(MatchScore, {
      props: { homeScore: '0', awayScore: '0', status: '2H' },
    })
    expect(wrapper.find('.score').classes()).toContain('score--live')
  })

  it('показывает пенальти под счётом', () => {
    const wrapper = mount(MatchScore, {
      props: { homeScore: '1', awayScore: '1', homePenScore: 4, awayPenScore: 3, status: 'AP' },
    })
    expect(wrapper.find('.score__note').text()).toBe('пен. 4:3')
  })

  it('помечает победу в дополнительное время', () => {
    const wrapper = mount(MatchScore, {
      props: { homeScore: '2', awayScore: '1', status: 'AET' },
    })
    expect(wrapper.find('.score__note').text()).toBe('после ДВ')
  })
})
