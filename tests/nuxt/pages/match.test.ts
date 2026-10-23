import { describe, it, expect, afterEach, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import MatchPage from '~/pages/match/[id].vue'
import type { MatchDetails, RoundsResponse } from '~/types'
import { makeMatchDetails } from '../../helpers/matches'

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
const MATCH = makeMatchDetails({
  homeTeam: 'Спартак',
  awayTeam: 'Рубин',
  homeScore: '1',
  awayScore: '0',
  status: 'FT',
  timestamp: '2026-10-18T15:45:00',
  leagueId: '235',
  round: '12',
  lineups: {
    home: { formation: '4-1-4-1', lines: [[{ number: 1, name: 'I. Pomazun' }]], substitutes: [], coach: null },
    away: { formation: '5-4-1', lines: [[{ number: 38, name: 'E. Staver' }]], substitutes: [], coach: null },
  },
  events: [
    { minute: 18, extra: null, side: 'home', kind: 'goal', player: 'Pablo Solari', assist: null, playerOut: null },
  ],
  stats: [
    { label: 'Владение мячом', home: 66, away: 34, format: 'percent' },
  ],
})

registerEndpoint('/api/rounds', () => ROUNDS)
registerEndpoint('/api/match/1', () => MATCH)
// Матч без ленты событий, статистики и составов
registerEndpoint('/api/match/2', () => ({ ...MATCH, idEvent: '2', events: [], stats: [], lineups: null }))
// Идущие матчи начались полчаса назад: livescore спрашиваем не дольше 3 часов от начала
const halfHourAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString().slice(0, 19)
// Идущий матч: по расписанию 1-й тайм 0:0, по livescore — 2-й тайм, 52-я минута, 1:0
const matchRequests: Record<string, number> = {}
function liveMatch(id: string, details: Partial<MatchDetails>) {
  registerEndpoint(`/api/match/${id}`, () => {
    matchRequests[id] = (matchRequests[id] ?? 0) + 1
    return { ...MATCH, idEvent: id, timestamp: halfHourAgo, events: [], stats: [], lineups: null, ...details }
  })
}
liveMatch('3', { status: '1H', homeScore: '0', awayScore: '0' })
// По живым данным матч уже закончен, а по странице матча ещё идёт: итоговую хронику и составы ещё ждём
liveMatch('5', { status: '2H', homeScore: '1', awayScore: '0' })
// Ещё один идущий матч: в ленте один гол, а по livescore уже 2:0 — второго гола в ленте пока нет
liveMatch('4', {
  status: '2H',
  homeScore: '1',
  awayScore: '0',
  events: [{ minute: 18, extra: null, side: 'home', kind: 'goal', player: 'Pablo Solari', assist: null, playerOut: null }],
})
const noPenalties = { homePenScore: null, awayPenScore: null }
let liveRequests = 0
registerEndpoint('/api/live', () => (liveRequests++, {
  scores: {
    3: { status: '2H', progress: '52', homeScore: '1', awayScore: '0', ...noPenalties },
    4: { status: '2H', progress: '70', homeScore: '2', awayScore: '0', ...noPenalties },
    5: { status: 'FT', progress: null, homeScore: '1', awayScore: '0', ...noPenalties },
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
    useCompetition().selectedId.value = '39'
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
    expect(useCompetition().selectedId.value).toBe('235')
  })
})

describe('страница матча: хроника, статистика, составы', () => {
  afterEach(() => {
    mountedPages.splice(0).forEach(page => page.unmount())
  })

  it('есть данные — все три блока', async () => {
    const page = await mountPage()
    expect(page.find('.event__player').text()).toBe('Pablo Solari')
    expect(page.find('.stat__label').text()).toBe('Владение мячом')
    expect(page.find('.lineups .player__name').text()).toBe('I. Pomazun')
  })

  it('нет данных — блоков нет', async () => {
    const page = await mountPage('/match/2')
    expect(page.find('.header').exists()).toBe(true)
    expect(page.find('.timeline').exists()).toBe(false)
    expect(page.find('.stats').exists()).toBe(false)
    expect(page.find('.lineups').exists()).toBe(false)
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
    const before = matchRequests['3']!
    vi.advanceTimersByTime(60_000)
    await vi.waitFor(() => expect(matchRequests['3']).toBe(before + 1))
    // Обновление тихое: «Загрузка...» не появляется, счёт остаётся из livescore
    expect(page.find('.page-status').exists()).toBe(false)
    expect(page.get('.header__status').text()).toBe('52′')
  })

  it('по живым данным матч закончился — живой счёт больше не спрашиваем, а матч обновляем, пока он не догонит', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const page = await mountPage('/match/5')
    expect(page.get('.header__status').text()).toBe('Завершён')
    const before = matchRequests['5']!
    const liveBefore = liveRequests
    vi.advanceTimersByTime(60_000)
    await vi.waitFor(() => expect(matchRequests['5']).toBe(before + 1))
    expect(liveRequests).toBe(liveBefore)
  })

  it('хроника отстала от свежего счёта — прячем её, пока не догонит', async () => {
    const page = await mountPage('/match/4')
    expect(page.get('.score__goals').text().replace(/\s+/g, '')).toBe('2:0')
    expect(page.find('.timeline').exists()).toBe(false)
  })
})
