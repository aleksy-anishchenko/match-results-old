import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MatchScore from '~/components/MatchScore.vue'

describe('MatchScore', () => {
  it('отображает счёт когда голы есть', async () => {
    const wrapper = await mountSuspended(MatchScore, {
      props: { homeScore: '2', awayScore: '1', status: 'FT' },
    })
    expect(wrapper.text()).toContain('2')
    expect(wrapper.text()).toContain('1')
    expect(wrapper.find('.score').classes()).toContain('score--finished')
  })

  it('показывает прочерк когда матч не начался', async () => {
    const wrapper = await mountSuspended(MatchScore, {
      props: { homeScore: null, awayScore: null },
    })
    expect(wrapper.text()).toContain('–')
    expect(wrapper.find('.score').classes()).toContain('score--scheduled')
  })

  it('показывает прочерк только для незаполненной команды', async () => {
    const wrapper = await mountSuspended(MatchScore, {
      props: { homeScore: '1', awayScore: null },
    })
    expect(wrapper.text()).toContain('1')
    expect(wrapper.text()).toContain('–')
  })

  it('помечает идущий матч', async () => {
    const wrapper = await mountSuspended(MatchScore, {
      props: { homeScore: '0', awayScore: '0', status: '2H' },
    })
    expect(wrapper.find('.score').classes()).toContain('score--live')
  })

  it('показывает пенальти под счётом', async () => {
    const wrapper = await mountSuspended(MatchScore, {
      props: { homeScore: '1', awayScore: '1', homePenScore: 4, awayPenScore: 3, status: 'PEN' },
    })
    expect(wrapper.find('.score__note').text()).toBe('пен. 4:3')
  })

  it('у обычного матча нули в полях пенальти не показываются', async () => {
    const wrapper = await mountSuspended(MatchScore, {
      props: { homeScore: '2', awayScore: '1', homePenScore: 0, awayPenScore: 0, status: 'FT' },
    })
    expect(wrapper.find('.score__note').exists()).toBe(false)
  })

  it('помечает победу в дополнительное время', async () => {
    const wrapper = await mountSuspended(MatchScore, {
      props: { homeScore: '2', awayScore: '1', status: 'AET' },
    })
    expect(wrapper.find('.score__note').text()).toBe('после ДВ')
  })
})
