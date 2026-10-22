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

  it('выбор, сохранённый под номером TheSportsDB, переводит в номер API-Football', async () => {
    document.cookie = `${cookieOf('4355')}; path=/`

    const { selectedId, competition } = useCompetition()
    expect(selectedId.value).toBe('235')
    expect(competition.value.name).toBe('РПЛ')
    await nextTick()
    expect(document.cookie).toContain(cookieOf('235'))
  })

  it('турнира нет в списке — турнир по умолчанию', () => {
    document.cookie = `${cookieOf('4429')}; path=/`

    expect(useCompetition().selectedId.value).toBe(DEFAULT_COMPETITION_ID)
  })
})
