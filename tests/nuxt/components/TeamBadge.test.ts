import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import TeamBadge from '~/components/TeamBadge.vue'

describe('TeamBadge', () => {
  it('эмблема — через прокси, с размером', async () => {
    const badge = 'https://media.api-sports.io/football/teams/558.png'
    const wrapper = await mountSuspended(TeamBadge, { props: { badge, size: 28 } })
    const img = wrapper.get('img')
    expect(img.attributes('src')).toBe(`/api/image?url=${encodeURIComponent(badge)}`)
    expect(img.attributes('width')).toBe('28')
    expect(img.attributes('height')).toBe('28')
  })

  it('без эмблемы — серый кружок', async () => {
    const wrapper = await mountSuspended(TeamBadge, { props: { badge: '', size: 18 } })
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('.team-badge--empty').exists()).toBe(true)
  })
})
