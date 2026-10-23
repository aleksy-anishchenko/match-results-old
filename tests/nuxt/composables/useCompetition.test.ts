import { describe, it, expect, beforeEach } from 'vitest'

// Выбор лиги общий на приложение (useState) и читается из cookie один раз: каждый тест начинает с чистого
beforeEach(() => {
  clearNuxtState('competition')
})

// Так cookie записывает useCookie: строка в JSON, «"235"»
const cookieOf = (id: string) => `competition=${encodeURIComponent(JSON.stringify(id))}`

describe('useCompetition', () => {
  it('берёт турнир из cookie', () => {
    document.cookie = `${cookieOf('235')}; path=/`

    const { selectedId, competition } = useCompetition()
    expect(selectedId.value).toBe('235')
    expect(competition.value.name).toBe('РПЛ')
  })

  // 4355 — РПЛ под номером TheSportsDB, на данных которого сайт работал до перехода на API-Football
  it('турнира нет в списке — турнир по умолчанию, и он же в cookie', async () => {
    document.cookie = `${cookieOf('4355')}; path=/`

    expect(useCompetition().selectedId.value).toBe(DEFAULT_COMPETITION_ID)
    await nextTick()
    expect(document.cookie).toContain(cookieOf(DEFAULT_COMPETITION_ID))
  })
})
