import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MatchGoals from '~/components/MatchGoals.vue'

describe('MatchGoals', () => {
  it('голы хозяев слева, гостей справа, с минутой и пометкой пенальти и автогола', async () => {
    const wrapper = await mountSuspended(MatchGoals, {
      props: {
        goals: [
          { minute: 6, player: 'Kai Havertz', side: 'away', kind: 'goal' },
          { minute: 38, player: 'Stijn van Gassel', side: 'home', kind: 'own-goal' },
          { minute: 65, player: 'Ousmane Dembélé', side: 'home', kind: 'penalty' },
        ],
      },
    })
    const goals = wrapper.findAll('.goal')
    expect(goals.map(goal => goal.classes().find(name => name !== 'goal'))).toEqual(['goal--away', 'goal--home', 'goal--home'])
    expect(goals.map(goal => [goal.find('.goal__player').text(), goal.find('.goal__minute').text()])).toEqual([
      ['Kai Havertz', '6′'],
      ['Stijn van Gassel (авт.)', '38′'],
      ['Ousmane Dembélé (пен.)', '65′'],
    ])
  })
})
