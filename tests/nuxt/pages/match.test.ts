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
  homeScore: '1',
  awayScore: '0',
  homePenScore: null,
  awayPenScore: null,
  status: 'FT',
  progress: null,
  timestamp: '2026-10-18T15:45:00',
  date: '2026-10-18',
  leagueId: '4355',
  league: 'Russian Football Premier League',
  season: '2026-2027',
  round: '12',
  venue: null,
  city: null,
  video: null,
  events: [
    { minute: 18, side: 'home', kind: 'goal', player: 'Pablo Solari', assist: null, playerOut: null },
  ],
  stats: [
    { label: 'Владение мячом', home: 66, away: 34, format: 'percent' },
  ],
}

registerEndpoint('/api/rounds', () => ROUNDS)
registerEndpoint('/api/match/1', () => MATCH)
// Матч без ленты событий и статистики
registerEndpoint('/api/match/2', () => ({ ...MATCH, idEvent: '2', events: [], stats: [] }))
// Идущий матч: по расписанию 1-й тайм 0:0, по livescore — 2-й тайм, 52-я минута, 1:0
let matchRequests = 0
registerEndpoint('/api/match/3', () => {
  matchRequests++
  return { ...MATCH, idEvent: '3', status: '1H', homeScore: '0', awayScore: '0', events: [], stats: [] }
})
// Ещё один идущий матч: в ленте один гол, а по livescore уже 2:0 — второго гола в ленте пока нет
registerEndpoint('/api/match/4', () => ({
  ...MATCH,
  idEvent: '4',
  status: '2H',
  homeScore: '1',
  awayScore: '0',
  events: [{ minute: 18, side: 'home', kind: 'goal', player: 'Pablo Solari', assist: null, playerOut: null }],
  stats: [],
}))
registerEndpoint('/api/live', () => ({
  scores: {
    3: { status: '2H', progress: '52', homeScore: '1', awayScore: '0' },
    4: { status: '2H', progress: '70', homeScore: '2', awayScore: '0' },
  },
}))

const mountedPages: VueWrapper[] = []
async function mountPage(route = '/match/1') {
  const page = await mountSuspended(MatchPage, { route })
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

describe('страница матча: хроника и статистика', () => {
  afterEach(() => {
    mountedPages.splice(0).forEach(page => page.unmount())
  })

  it('есть данные — оба блока', async () => {
    const page = await mountPage()
    expect(page.find('.event__player').text()).toBe('Pablo Solari')
    expect(page.find('.stat__label').text()).toBe('Владение мячом')
  })

  it('нет данных — блоков нет', async () => {
    const page = await mountPage('/match/2')
    expect(page.find('.header').exists()).toBe(true)
    expect(page.find('.timeline').exists()).toBe(false)
    expect(page.find('.stats').exists()).toBe(false)
  })
})

describe('страница матча: идущий матч', () => {
  afterEach(() => {
    mountedPages.splice(0).forEach(page => page.unmount())
    vi.useRealTimers()
  })

  it('минута вместо тайма и счёт из livescore; раз в минуту матч обновляется', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const page = await mountPage('/match/3')
    expect(page.get('.header__status').text()).toBe('52′')
    expect(page.get('.score__goals').text().replace(/\s+/g, '')).toBe('1:0')
    const before = matchRequests
    vi.advanceTimersByTime(60_000)
    await vi.waitFor(() => expect(matchRequests).toBe(before + 1))
    // Обновление тихое: «Загрузка...» не появляется, счёт остаётся из livescore
    expect(page.find('.status').exists()).toBe(false)
    expect(page.get('.header__status').text()).toBe('52′')
  })

  it('хроника отстала от свежего счёта — прячем её, пока не догонит', async () => {
    const page = await mountPage('/match/4')
    expect(page.get('.score__goals').text().replace(/\s+/g, '')).toBe('2:0')
    expect(page.find('.timeline').exists()).toBe(false)
  })
})
