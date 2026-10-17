import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { getMoscowDate } from '#shared/utils/matches'
import IndexPage from '~/pages/index.vue'
import type { Match, RoundsResponse } from '~/types'

const ROUNDS: RoundsResponse = {
  season: '2026-2027',
  rounds: [
    { id: '6', name: '6 тур' },
    { id: '7', name: '7 тур' },
    { id: '8', name: '8 тур' },
  ],
  current: '7',
}

function match(idEvent: string, homeTeam: string, awayTeam: string): Match {
  return {
    idEvent,
    homeTeam,
    awayTeam,
    homeBadge: '',
    awayBadge: '',
    homeScore: null,
    awayScore: null,
    homePenScore: null,
    awayPenScore: null,
    status: 'NS',
    progress: null,
    timestamp: '2026-10-17T14:00:00',
    date: '2026-10-17',
    group: null,
    season: '2026-2027',
  }
}

// Сервер подменён: в 6 туре «Челси – Арсенал», в 7 «Эвертон – Ливерпуль», по датам — «Фулхэм – Брентфорд»
const MATCHES_BY_ROUND: Record<string, Match[]> = {
  6: [match('1', 'Chelsea', 'Arsenal')],
  7: [match('2', 'Everton', 'Liverpool')],
}

registerEndpoint('/api/rounds', () => ROUNDS)
registerEndpoint('/api/matches', (event) => {
  const query = new URL(event.path, 'http://localhost').searchParams
  const round = query.get('round')
  return { matches: round ? MATCHES_BY_ROUND[round] ?? [] : [match('3', 'Fulham', 'Brentford')] }
})

describe('главная', () => {
  beforeEach(async () => {
    await useRouter().replace('/')
  })

  it('по умолчанию — текущий тур, кнопка «Тур» выбрана', async () => {
    const page = await mountSuspended(IndexPage, { route: '/' })
    // Перед точкой неразрывный пробел (\u00a0), чтобы точка не переносилась на новую строку
    expect(page.find('h1').text().replace(/\u00a0/g, ' ')).toBe('АПЛ · сезон 2026/27 · 7 тур')
    expect(page.text()).toContain('Эвертон')
    expect(page.get('button[aria-pressed="true"]').text()).toBe('Тур')
  })

  it('стрелка «назад» открывает прошлый тур и запоминает его в адресе', async () => {
    const page = await mountSuspended(IndexPage, { route: '/' })
    await page.get('button[aria-label="Назад: 6 тур"]').trigger('click')
    await vi.waitFor(() => expect(page.find('.crumbs__item--current').text()).toBe('6 тур'))
    expect(useRoute().query).toEqual({ round: '6' })
    await vi.waitFor(() => expect(page.text()).toContain('Челси'))
  })

  it('у последнего тура стрелки «вперёд» нет', async () => {
    const page = await mountSuspended(IndexPage, { route: '/?round=8' })
    expect(page.get('button[aria-label="Вперёд"]').attributes('disabled')).toBeDefined()
  })

  it('кнопка «Сегодня» сбрасывает тур: даты в адресе, в крошках только турнир и сезон, стрелок нет', async () => {
    const page = await mountSuspended(IndexPage, { route: '/?round=6' })
    await page.findAll('button').find(button => button.text() === 'Сегодня')!.trigger('click')
    await vi.waitFor(() => expect(page.find('.crumbs__item--current').exists()).toBe(false))
    expect(page.find('h1').text().replace(/\u00a0/g, ' ')).toBe('АПЛ · сезон 2026/27')
    const today = getMoscowDate(new Date())
    expect(useRoute().query).toEqual({ from: today, to: today })
    expect(page.find('.page-head__arrows').exists()).toBe(false)
    await vi.waitFor(() => expect(page.text()).toContain('Фулхэм'))
  })

  // У календаря на кнопке только иконка: какие дни выбраны, видно по крошкам
  it('даты из календаря — в крошках', async () => {
    const page = await mountSuspended(IndexPage, { route: '/?from=2026-10-12&to=2026-10-15' })
    expect(page.find('.crumbs__item--current').text()).toBe('12–15 октября')
  })

  it('кнопка «Тур» возвращает к текущему туру', async () => {
    const today = getMoscowDate(new Date())
    const page = await mountSuspended(IndexPage, { route: `/?from=${today}&to=${today}` })
    await page.findAll('button').find(button => button.text() === 'Тур')!.trigger('click')
    await vi.waitFor(() => expect(page.find('.crumbs__item--current').text()).toBe('7 тур'))
    expect(useRoute().query).toEqual({})
  })
})
