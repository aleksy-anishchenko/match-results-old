import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import { getMoscowDate } from '#shared/utils/matches'
import { shiftDate } from '~/utils/matches'
import IndexPage from '~/pages/index.vue'
import type { Match, RoundsResponse } from '~/types'
import { makeMatch } from '../../helpers/matches'

const today = getMoscowDate(new Date())
const yesterday = shiftDate(today, -1)

// Вчера и сегодня матчи есть, завтра — нет
const ROUNDS: RoundsResponse = {
  season: '2026-2027',
  rounds: [
    { id: '6', name: '6 тур', from: '2026-10-09', to: '2026-10-11' },
    { id: '7', name: '7 тур', from: '2026-10-16', to: '2026-10-18' },
    { id: '8', name: '8 тур', from: '2026-10-23', to: '2026-10-25' },
  ],
  current: '7',
  matchDays: [yesterday, today],
}

function match(id: string, homeTeam: string, awayTeam: string, round: string): Match {
  return makeMatch({ id, homeTeam, awayTeam, round, timestamp: '2026-10-17T14:00:00' })
}

// Сервер подменён: в 6 туре «Челси – Арсенал», в 7 «Эвертон – Ливерпуль», по датам — «Фулхэм – Брентфорд» из 7 тура.
// Без тура и дат сервер отдаёт текущий тур, как настоящий
// «Эвертон – Ливерпуль» начался полчаса назад: по расписанию идёт 1-й тайм
const halfHourAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString().slice(0, 19)
const MATCHES_BY_ROUND: Record<string, Match[]> = {
  6: [match('1', 'Челси', 'Арсенал', '6')],
  7: [{ ...match('2', 'Эвертон', 'Ливерпуль', '7'), status: '1H', timestamp: halfHourAgo }],
}

// Запросы матчей, которые сделала страница: по ним видно, нет ли лишних
const matchRequests: Array<Record<string, string>> = []

registerEndpoint('/api/rounds', () => ROUNDS)
// По живым данным «Эвертон – Ливерпуль» идёт: 52-я минута, 1:0. Счётчик — сколько раз страница спросила, и о каких матчах
let liveRequests = 0
const liveRequestIds: string[] = []
registerEndpoint('/api/live', (event) => {
  liveRequests++
  liveRequestIds.push(new URL(event.path, 'http://localhost').searchParams.get('ids') ?? '')
  return { scores: { 2: { status: '2H', progress: '52', homeScore: 1, awayScore: 0, homePenScore: null, awayPenScore: null } } }
})
registerEndpoint('/api/matches', (event) => {
  const query = new URL(event.path, 'http://localhost').searchParams
  matchRequests.push(Object.fromEntries(query))
  const round = query.get('round') ?? (query.get('dateFrom') ? null : ROUNDS.current)
  return { matches: round ? MATCHES_BY_ROUND[round] ?? [] : [match('3', 'Фулхэм', 'Брентфорд', '7')] }
})

// Страницы прошлых тестов сами не размонтируются и тоже ответили бы на смену лиги — убираем их после теста
const mountedPages: VueWrapper[] = []
async function mountPage(route: string) {
  const page = await mountSuspended(IndexPage, { route })
  mountedPages.push(page)
  return page
}

// Подписи полей «Тур» и «Дата» для экранного диктора: по ним видно, что выбрано
const fieldLabels = (page: VueWrapper) =>
  page.findAll('.filters .field__button').map(button => button.attributes('aria-label'))

// Панель открывается в конце body (teleport), поэтому ищем в документе, в последней открытой
function lastPanel(): HTMLElement {
  const panels = document.querySelectorAll<HTMLElement>('.field-popover')
  return panels[panels.length - 1]!
}

describe('главная', () => {
  beforeEach(async () => {
    await useRouter().replace('/')
  })

  // Выбор лиги общий на приложение и хранится в cookie: тест со сменой лиги не должен оставить её другим
  afterEach(() => {
    mountedPages.splice(0).forEach(page => page.unmount())
    useCompetition().selectedId.value = '39'
  })

  it('по умолчанию — текущий тур с датами, поле «Дата» пустое', async () => {
    const page = await mountPage('/')
    expect(fieldLabels(page)).toEqual(['Тур: 7 тур, 16–18 окт', 'Выбрать дату'])
    expect(page.text()).toContain('Эвертон')
    expect(page.find('h1').text()).toBe('Матчи: АПЛ')
  })

  it('тур из списка — в адресе и в поле', async () => {
    const page = await mountPage('/')
    await page.get('button[aria-label^="Тур"]').trigger('click')
    await vi.waitFor(() => expect(lastPanel().querySelector('[aria-label="6 тур"]')).not.toBeNull())
    lastPanel().querySelector<HTMLElement>('[aria-label="6 тур"]')!.click()
    await vi.waitFor(() => expect(useRoute().query).toEqual({ round: '6' }))
    await vi.waitFor(() => expect(page.text()).toContain('Челси'))
    expect(fieldLabels(page)[0]).toBe('Тур: 6 тур, 9–11 окт')
  })

  it('«Вчера» сбрасывает тур: даты в адресе, тур — в заголовке дня', async () => {
    const page = await mountPage('/?round=6')
    await page.get('button[aria-haspopup="dialog"]').trigger('click')
    await vi.waitFor(() => expect(lastPanel().querySelector('.quick__day')).not.toBeNull())
    const quick = [...lastPanel().querySelectorAll<HTMLButtonElement>('.quick__day')]
    expect(quick.map(button => button.disabled)).toEqual([false, false, true])
    quick[0]!.click()
    await vi.waitFor(() => expect(useRoute().query).toEqual({ from: yesterday, to: yesterday }))
    await vi.waitFor(() => expect(page.text()).toContain('Фулхэм'))
    expect(fieldLabels(page)[0]).toBe('Выбрать тур')
    expect(fieldLabels(page)[1]).toMatch(/^Дата: Вчера /)
    expect(page.find('.day__title').text().replace(/\s+/g, ' ')).toBe('Суббота, 17 октября · 7 тур')
  })

  it('несколько дней из адреса — диапазоном в поле «Дата»', async () => {
    const page = await mountPage('/?from=2026-10-12&to=2026-10-15')
    expect(fieldLabels(page)).toEqual(['Выбрать тур', 'Дата: 12–15 окт'])
  })

  it('неверный тур в адресе — текущий тур', async () => {
    const page = await mountPage('/?round=99')
    expect(fieldLabels(page)[0]).toBe('Тур: 7 тур, 16–18 окт')
    expect(page.text()).toContain('Эвертон')
  })

  // Раньше уходил ещё запрос «новая лига + тур прошлой лиги», пока сбрасывался адрес и грузились туры
  it('смена лиги — один запрос матчей новой лиги, без тура прошлой', async () => {
    const page = await mountPage('/?round=6')
    matchRequests.length = 0
    await page.get('button[aria-label^="Лига"]').trigger('click')
    await vi.waitFor(() => expect(lastPanel().querySelector('[aria-label="Ла Лига"]')).not.toBeNull())
    lastPanel().querySelector<HTMLElement>('[aria-label="Ла Лига"]')!.click()
    await vi.waitFor(() => expect(useRoute().query).toEqual({}))
    await vi.waitFor(() => expect(page.text()).toContain('Эвертон'))
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(matchRequests).toEqual([{ leagueId: '140' }])
    expect(page.find('h1').text()).toBe('Матчи: Ла Лига')
  })

  it('идущих матчей нет — живые данные не спрашиваем', async () => {
    const before = liveRequests
    const page = await mountPage('/?round=6')
    expect(page.text()).toContain('Челси')
    expect(liveRequests).toBe(before)
  })

  it('идущий матч — минута и счёт из живых данных, раз в минуту спрашиваем о нём заново', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    try {
      const page = await mountPage('/')
      const match = page.get('a.match')
      expect(match.classes()).toContain('match--live')
      expect(match.get('.match__state').text()).toBe('52′')
      expect(match.findAll('.score__goals').map(goals => goals.text())).toEqual(['1', '0'])
      // Спрашиваем только об идущем матче, а не обо всей лиге
      expect(liveRequestIds.at(-1)).toBe('2')
      const before = liveRequests
      vi.advanceTimersByTime(60_000)
      await vi.waitFor(() => expect(liveRequests).toBe(before + 1))
    }
    finally {
      vi.useRealTimers()
    }
  })
})
