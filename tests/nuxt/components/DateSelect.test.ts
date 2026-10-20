import { describe, it, expect, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import DateSelect from '~/components/DateSelect.vue'

// Сезон с августа по октябрь 2026; сегодня вторник 20 октября, матчей сегодня и завтра нет
const PROPS = {
  range: null,
  matchDays: ['2026-08-15', '2026-09-12', '2026-10-17', '2026-10-18', '2026-10-19'],
  today: '2026-10-20',
}

// Панель открывается в конце body (teleport): ищем в документе, в последней открытой
function lastPanel(): HTMLElement {
  const panels = document.querySelectorAll<HTMLElement>('.field-popover')
  return panels[panels.length - 1]!
}

// Test Utils по умолчанию подменяет <transition> заглушкой, а PrimeVue Popover сообщает об открытии
// и закрытии и ловит Esc в хуках анимации: без настоящего <transition> панель «не открывается»
const mountSelect = () => mountSuspended(DateSelect, { props: PROPS, global: { stubs: { transition: false } } })

async function open(wrapper: VueWrapper) {
  await wrapper.get('button[aria-haspopup="dialog"]').trigger('click')
  await vi.waitFor(() => expect(wrapper.find('.field--open').exists()).toBe(true))
}

function clickDay(day: number) {
  const cell = [...lastPanel().querySelectorAll<HTMLElement>('.p-datepicker-day:not(.p-disabled)')]
    .find(element => element.textContent?.trim() === String(day))
  cell!.click()
}

// Esc закрывает панель (PrimeVue Popover слушает документ); ждём, пока она уйдёт из документа
async function closeWithEscape(wrapper: VueWrapper) {
  const panel = lastPanel()
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' }))
  await vi.waitFor(() => expect(panel.isConnected).toBe(false))
  expect(wrapper.find('.field--open').exists()).toBe(false)
}

// Текст из соседних элементов без пробелов между ними («Октябрь» + «2026», «Вчера» + «19 окт»)
const textOf = (element: Element) =>
  [...element.children].map(child => child.textContent?.trim()).filter(Boolean).join(' ')

const monthTitle = () => textOf(lastPanel().querySelector('.p-datepicker-title')!)
const prevButton = () => lastPanel().querySelector<HTMLButtonElement>('.p-datepicker-prev-button')!

describe('DateSelect', () => {
  it('быстрые кнопки: без матчей — неактивны, «Вчера» выбирает вчерашний день', async () => {
    const wrapper = await mountSelect()
    await open(wrapper)
    const quick = [...lastPanel().querySelectorAll<HTMLButtonElement>('.quick__day')]
    expect(quick.map(textOf))
      .toEqual(['Вчера 19 окт', 'Сегодня нет матчей', 'Завтра нет матчей'])
    expect(quick.map(button => button.disabled)).toEqual([false, true, true])
    quick[0]!.click()
    expect(wrapper.emitted('select')).toEqual([[{ from: '2026-10-19', to: '2026-10-19' }]])
  })

  it('два нажатия в календаре — диапазон', async () => {
    const wrapper = await mountSelect()
    await open(wrapper)
    clickDay(17)
    await nextTick()
    expect(wrapper.emitted('select')).toBeUndefined()
    clickDay(19)
    expect(wrapper.emitted('select')).toEqual([[{ from: '2026-10-17', to: '2026-10-19' }]])
  })

  it('одно нажатие и закрыть — этот день', async () => {
    const wrapper = await mountSelect()
    await open(wrapper)
    clickDay(18)
    await nextTick()
    await closeWithEscape(wrapper)
    expect(wrapper.emitted('select')).toEqual([[{ from: '2026-10-18', to: '2026-10-18' }]])
  })

  // Пролистали до начала сезона и закрыли: при новом открытии календарь снова на октябре и листается назад
  it('стрелки считаются от месяца, с которого календарь открылся', async () => {
    const wrapper = await mountSelect()
    await open(wrapper)
    expect(monthTitle()).toBe('Октябрь 2026')
    prevButton().click()
    await nextTick()
    prevButton().click()
    await vi.waitFor(() => expect(prevButton().disabled).toBe(true))
    expect(monthTitle()).toBe('Август 2026')
    await closeWithEscape(wrapper)

    await open(wrapper)
    expect(monthTitle()).toBe('Октябрь 2026')
    expect(prevButton().disabled).toBe(false)
  })
})
