import type { LiveScoresResponse } from '~/types'

/** Номеров в одном запросе — не больше двух запросов к API-Football: тур ЛЧ — 18 матчей */
const MAX_IDS = 40

/** Номера матчей из ?ids=1,2,3: только цифры, без повторов, по порядку — так ответ общий для всех с теми же матчами */
function parseIds(value: unknown): string[] {
  const ids = String(value ?? '').split(',').filter(id => /^\d+$/.test(id))
  return [...new Set(ids)].sort().slice(0, MAX_IDS)
}

// Счёт, статус и минута матчей, которые на странице идут или по времени уже должны идти (useLiveScores):
// главная и страница матча спрашивают их раз в минуту. По номерам, а не «все идущие»: закончившийся матч
// из списка идущих сразу пропадает, а по номеру приходит уже со статусом «Завершён».
// Ответ живёт 30 секунд и общий для всех, кто смотрит те же матчи; сбой — пустой ответ, страница покажет расписание
export default defineEventHandler(async (event): Promise<LiveScoresResponse> => {
  const ids = parseIds(getQuery(event).ids)
  if (!ids.length) return { scores: {} }

  const fixtures = await getFixturesByIds(ids).catch(() => [])
  return {
    scores: Object.fromEntries(fixtures
      .filter(fixture => getCompetition(String(fixture.league.id)))
      .map(fixture => [String(fixture.fixture.id), toLiveScore(fixture)])),
  }
})
