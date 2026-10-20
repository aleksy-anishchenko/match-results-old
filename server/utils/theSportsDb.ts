// Общие запросы к TheSportsDB. Nitro авто-импортирует файлы из server/utils.

const API_V1 = 'https://www.thesportsdb.com/api/v1/json'
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

export type PenaltyScore = { home: number | null, away: number | null }

type LookupEventResponse = {
  events: Array<{
    intHomeScoreExtra: string | null
    intAwayScoreExtra: string | null
  }> | null
}

const toScore = (value: string | null | undefined) => value != null ? Number(value) : null

/**
 * Счёт серии пенальти для матчей, завершённых по пенальти (статус AP). Расписание его не отдаёт,
 * поэтому за каждым таким матчем ходим в v1 lookupevent. Ключ — idEvent. Если запрос не удался,
 * счёт null: матч всё равно покажется, просто без «пен. 4:3».
 */
export async function getPenaltyScores(
  matches: Array<{ idEvent: string, strStatus: string }>,
): Promise<Record<string, PenaltyScore>> {
  const scores: Record<string, PenaltyScore> = {}
  const apiKey = useRuntimeConfig().theSportsDbApiKey
  await Promise.all(matches.filter(match => match.strStatus === 'AP').map(async ({ idEvent }) => {
    const data = await $fetch<LookupEventResponse>(`${API_V1}/${apiKey}/lookupevent.php?id=${idEvent}`).catch(() => null)
    const details = data?.events?.[0]
    scores[idEvent] = { home: toScore(details?.intHomeScoreExtra), away: toScore(details?.intAwayScoreExtra) }
  }))
  return scores
}

/** Матч из v2 livescore/soccer: поля для счёта и минуты */
export type LivescoreMatch = {
  idEvent: string
  idLeague: string
  intHomeScore: string | null
  intAwayScore: string | null
  strStatus: string
  /** Минута: «24» */
  strProgress: string | null
}

const LIVESCORE_MAX_AGE_MS = 30_000

let livescore: { at: number, matches: LivescoreMatch[] } | null = null
let livescoreRequest: Promise<LivescoreMatch[]> | null = null

/**
 * Матчи, которые сейчас идут или недавно закончились, — все лиги разом (во вторник вечером около 80).
 * Расписание отдаёт счёт с задержкой и без минуты, livescore — свежие. Один запрос на всех посетителей:
 * ответ живёт 30 секунд. Сбой — пустой список на те же 30 секунд: страница покажет счёт из расписания.
 */
export async function getLiveMatches(): Promise<LivescoreMatch[]> {
  if (livescore && Date.now() - livescore.at < LIVESCORE_MAX_AGE_MS) return livescore.matches
  livescoreRequest ??= $fetch<{ livescore?: LivescoreMatch[] | null }>(`${API_V2}/livescore/soccer`, {
    headers: { 'X-API-KEY': useRuntimeConfig().theSportsDbApiKey },
  })
    .then(data => data.livescore ?? [])
    .catch(() => [])
    .then((matches) => {
      livescore = { at: Date.now(), matches }
      return matches
    })
    .finally(() => {
      livescoreRequest = null
    })
  return livescoreRequest
}
