// Общие запросы к расписанию TheSportsDB (API v2). Nitro авто-импортирует файлы из server/utils.

const API_V2 = 'https://www.thesportsdb.com/api/v2/json'

/**
 * Ответ эндпоинтов schedule/…. Если матчей нет, поля schedule в ответе нет совсем:
 * приходит { Message: 'No data found' }.
 */
type ScheduleResponse<T> = {
  schedule?: T[] | null
}

function fetchSchedule<T>(path: string): Promise<ScheduleResponse<T>> {
  return $fetch<ScheduleResponse<T>>(`${API_V2}/schedule/${path}`, {
    headers: { 'X-API-KEY': useRuntimeConfig().theSportsDbApiKey },
  })
}

/**
 * Текущий сезон лиги или турнира («2026-2027», «2026»). Берётся у ближайшего матча, а если
 * ближайших нет (турнир закончился, межсезонье без расписания), то у последнего сыгранного.
 * null, если нет ни тех, ни других.
 */
export async function getCurrentSeason(leagueId: string): Promise<string | null> {
  for (const direction of ['next', 'previous']) {
    const data = await fetchSchedule<{ strSeason: string }>(`${direction}/league/${leagueId}`)
    const season = data.schedule?.[0]?.strSeason
    if (season) return season
  }
  return null
}

/** Все матчи сезона. Тип матча задаёт вызывающий: каждому обработчику нужны свои поля. */
export async function getSeasonSchedule<T>(leagueId: string, season: string): Promise<T[]> {
  const data = await fetchSchedule<T>(`league/${leagueId}/${season}`)
  return data.schedule ?? []
}
