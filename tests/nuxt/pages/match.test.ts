import { describe, it, expect, afterEach, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import MatchPage from '~/pages/match/[id].vue'
import type { MatchDetails, RoundsResponse } from '~/types'

// Туры выбранной лиги (АПЛ): по ним подписана ссылка назад, когда пришли с главной
const ROUNDS: RoundsResponse = {
  season: '2026-2027',
  rounds: [
    { id: '6', name: '6 тур', from: '2026-10-09', to: '2026-10-11' },
    { id: '7', name: '7 тур', from: '2026-10-16', to: '2026-10-18' },
  ],
  current: '7',
  matchDays: [],
}

// Матч РПЛ, хотя выбрана АПЛ
const MATCH: MatchDetails = {
  idEvent: '1',
  homeTeam: 'Spartak Moscow',
  awayTeam: 'Rubin Kazan',
  homeBadge: '',
  awayBadge: '',
  homeScore: '4',
  awayScore: '0',
  homePenScore: null,
  awayPenScore: null,
  status: 'FT',
  timestamp: '2026-10-18T15:45:00',
  date: '2026-10-18',
  leagueId: '4355',
  league: 'Russian Football Premier League',
  season: '2026-2027',
  round: '12',
  venue: null,
  city: null,
  goals: [],
}

registerEndpoint('/api/rounds', () => ROUNDS)
registerEndpoint('/api/match/1', () => MATCH)

const mountedPages: VueWrapper[] = []
async function mountPage() {
  const page = await mountSuspended(MatchPage, { route: '/match/1' })
  mountedPages.push(page)
  return page
}

describe('страница матча: ссылка назад', () => {
  // Выбор лиги общий на приложение и хранится в cookie: тест со сменой лиги не должен оставить её другим
  afterEach(() => {
    mountedPages.splice(0).forEach(page => page.unmount())
    useCompetition().selectedId.value = '4328'
  })

  it('пришли с главной — тур, выбранный там', async () => {
    await useRouter().push('/?round=6')
    await useRouter().push('/match/1')
    const page = await mountPage()
    await vi.waitFor(() => expect(page.get('a.back').text()).toBe('6 тур'))
    expect(page.get('a.back').attributes('href')).toBe('/?round=6')
  })

  it('открыли по ссылке — лига матча, и она выбирается на главной', async () => {
    // Как после перехода по ссылке извне: в истории нет страницы, с которой пришли
    await useRouter().replace('/match/1')
    useRouter().options.history.replace('/match/1', { back: null })
    const page = await mountPage()
    expect(page.get('a.back').text()).toBe('РПЛ')
    expect(page.get('a.back').attributes('href')).toBe('/')
    await page.get('a.back').trigger('click')
    expect(useCompetition().selectedId.value).toBe('4355')
  })
})
