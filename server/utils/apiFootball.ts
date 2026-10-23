import type { Competition, SeasonMatch } from '~/types'
import { DEFAULT_COMPETITION_ID, getCompetition } from '#shared/utils/competitions'
import { FINISHED_MATCH_STATUSES, goalsMatchScore } from '#shared/utils/matches'
import { toSeasonMatch, type ApiFootballSeasonFixture } from './seasonMatch'
import type { ApiFootballStandingRow } from './leagueTable'
import type { ApiFootballLiveFixture } from './liveScores'
import type { ApiFootballFixture } from './matchDetails'
import { getApiFootballEvents } from './matchEvents'

// API-Football (api-sports.io) — источник всех данных сайта. Тариф Pro: 7 500 запросов в день,
// счётчик обнуляется в 00:00 UTC. Ответы кэшируются здесь, в функциях, а маршруты /api/… без кэша: у кэша
// маршрута без swr Nitro шлёт браузеру Cache-Control: max-age, и браузер сам держал бы ответ — страница
// идущего матча через раз получала бы свою же минутную копию. Кэш без swr: старый ответ, пока считается
// новый, не отдаём. На сайт заходят редко, и первый посетитель увидел бы данные многочасовой давности —
// матч, сыгранный вечером, утром был бы «не начался»

const API = 'https://v3.football.api-sports.io'
const TIMEOUT_MS = 10_000

type ApiFootballResponse<T> = {
  response?: T[]
  /** [] — всё хорошо. Объект — ошибка: { requests: … } — кончился дневной лимит, { plan: … } — нет доступа */
  errors?: unknown[] | Record<string, string>
}

/** Кончился дневной лимит: до полуночи UTC не спрашиваем, ответ всё равно будет ошибкой */
let limitReachedUntil = 0

/**
 * Сколько запросов осталось до конца дня (UTC), по заголовку последнего ответа. Когда меньше SPARE_RESERVE,
 * запросы, без которых сайт обойдётся (матч по номеру, живой счёт), не отправляем: иначе перебор номеров
 * матчей извне съел бы лимит, и до полуночи остались бы без расписаний и таблиц все
 */
let remaining = { count: Number.POSITIVE_INFINITY, day: '' }
const SPARE_RESERVE = 1000

const utcDay = (now: number) => new Date(now).toISOString().slice(0, 10)

function nextUtcMidnight(now: number): number {
  const date = new Date(now)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1)
}

type FetchOptions = {
  timeout?: number
  /** Запрос, без которого сайт обойдётся: когда лимит на исходе, его не отправляем */
  spare?: boolean
}

/**
 * Запрос к API-Football: список из поля response. Ошибка API (кончился лимит, нет доступа), нет ключа,
 * сбой сети — исключение: показать ошибку или обойтись без этих данных, решает вызывающий
 */
export async function fetchApiFootball<T>(
  path: string,
  query: Record<string, string | number>,
  { timeout = TIMEOUT_MS, spare = false }: FetchOptions = {},
): Promise<T[]> {
  const apiKey = useRuntimeConfig().apiFootballKey
  if (!apiKey) throw new Error('Нет ключа API-Football')
  const now = Date.now()
  if (now < limitReachedUntil) throw new Error('Кончился дневной лимит API-Football')
  if (spare && remaining.day === utcDay(now) && remaining.count < SPARE_RESERVE) {
    throw new Error('Лимит API-Football на исходе: бережём его для расписаний и таблиц')
  }

  const data = await $fetch<ApiFootballResponse<T>>(`${API}/${path}`, {
    query,
    headers: { 'x-apisports-key': apiKey },
    timeout,
    onResponse({ response }) {
      const count = Number(response.headers.get('x-ratelimit-requests-remaining'))
      if (response.headers.has('x-ratelimit-requests-remaining') && Number.isFinite(count)) {
        remaining = { count, day: utcDay(Date.now()) }
      }
    },
  })
  const { errors } = data
  const messages = Array.isArray(errors) ? errors : Object.values(errors ?? {})
  if (messages.length) {
    if (errors && !Array.isArray(errors) && 'requests' in errors) limitReachedUntil = nextUtcMidnight(Date.now())
    throw new Error(`API-Football: ${messages.join('; ')}`)
  }
  return data.response ?? []
}

/**
 * Текущий сезон турнира — год его начала: 2026/27 — 2026, сезон МЛС 2026 — тоже 2026. null — текущего сезона нет.
 * Меняется раз в год, поэтому ответ хранится сутки
 */
export const getLeagueSeason = defineCachedFunction(async (leagueId: string): Promise<number | null> => {
  const [league] = await fetchApiFootball<{ seasons: Array<{ year: number, current: boolean }> }>(
    'leagues',
    { id: leagueId, current: 'true' },
  )
  return league?.seasons.find(season => season.current)?.year ?? null
}, {
  name: 'api-football-season',
  maxAge: 24 * 60 * 60,
  swr: false,
  // Пустой ответ (сбой или смена сезона) на сутки не запоминаем: спросим снова при следующем заходе
  validate: entry => entry.value != null,
  getKey: (leagueId: string) => leagueId,
})

/** Турнир сайта и его текущий сезон */
export type CompetitionSeason = { competition: Competition, season: number }

/** Турнир по номеру из адреса (?leagueId=; без него — турнир по умолчанию). undefined — турнира нет в списке сайта */
export const getRequestedCompetition = (leagueId: unknown): Competition | undefined =>
  getCompetition(String(leagueId ?? DEFAULT_COMPETITION_ID))

/**
 * Турнир по номеру из адреса и его текущий сезон. null — турнира нет в списке сайта или текущего сезона нет в API.
 * Турниры не из списка не спрашиваем: каждый запрос — из лимита
 */
export async function getCompetitionSeason(leagueId: unknown): Promise<CompetitionSeason | null> {
  const competition = getRequestedCompetition(leagueId)
  if (!competition) return null
  const season = await getLeagueSeason(competition.id)
  return season == null ? null : { competition, season }
}

/**
 * Все матчи сезона по времени начала. Счёт идущих матчей и минуту страницы берут из живых данных,
 * поэтому расписание хранится 5 минут
 */
export const getSeasonMatches = defineCachedFunction(async (leagueId: string, season: number): Promise<SeasonMatch[]> => {
  const fixtures = await fetchApiFootball<ApiFootballSeasonFixture>('fixtures', { league: leagueId, season })
  return fixtures.map(toSeasonMatch).sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}, {
  name: 'api-football-season-matches',
  maxAge: 5 * 60,
  swr: false,
  getKey: (leagueId: string, season: number) => `${leagueId}-${season}`,
})

/** Таблица турнира — группы строк. Меняется только после матчей, поэтому хранится 10 минут */
export const getLeagueStandings = defineCachedFunction(async (leagueId: string, season: number): Promise<ApiFootballStandingRow[][]> => {
  const [response] = await fetchApiFootball<{ league: { standings: ApiFootballStandingRow[][] } }>(
    'standings',
    { league: leagueId, season },
  )
  return response?.league.standings ?? []
}, {
  name: 'api-football-standings',
  maxAge: 10 * 60,
  swr: false,
  getKey: (leagueId: string, season: number) => `${leagueId}-${season}`,
})

/** Через сколько после начала сыгранный матч сохраняем навсегда: к этому времени API-Football дописывает статистику */
const SETTLED_AFTER_MS = 4 * 60 * 60 * 1000

const fixtureKey = (id: string) => `api-football:fixture:${id}`

/** Матч по номеру из API: идущий и будущий меняются, поэтому ответ живёт минуту. null — такого номера нет */
const loadFixture = defineCachedFunction(async (id: string): Promise<ApiFootballFixture | null> => {
  const [fixture] = await fetchApiFootball<ApiFootballFixture>('fixtures', { id }, { spare: true })
  return fixture ?? null
}, {
  name: 'api-football-fixture',
  maxAge: 60,
  swr: false,
  getKey: (id: string) => id,
})

/**
 * Сыгранный матч больше не меняется: через 4 часа после начала, если голы хроники сходятся со счётом,
 * он хранится всегда. Неполную хронику не храним — API может её дописать
 */
function isSettled({ fixture, goals, ...rest }: ApiFootballFixture, now: number): boolean {
  if (!FINISHED_MATCH_STATUSES.has(fixture.status.short) || now - fixture.timestamp * 1000 < SETTLED_AFTER_MS) return false
  const events = getApiFootballEvents({ fixture, goals, ...rest })
  return events.length > 0 && goalsMatchScore(events, goals.home, goals.away)
}

/**
 * Матч по номеру — с хроникой, статистикой и составами, всё одним запросом (fixtures?id=). null — матча нет
 * или он не из турниров сайта. Сыгранный матч хранится всегда (хранилище data, на проде — файлы .data/kv рядом
 * с сервером, деплой их не трогает), и за ним больше не ходим
 */
export async function getMatchFixture(id: string): Promise<ApiFootballFixture | null> {
  const storage = useStorage('data')
  const saved = await storage.getItem<ApiFootballFixture>(fixtureKey(id)).catch(() => null)
  if (saved) return saved

  const fixture = await loadFixture(id)
  if (!fixture || !getCompetition(String(fixture.league.id))) return null

  if (isSettled(fixture, Date.now())) {
    // Без оценок и статистики игроков (players): они большие, а сайту не нужны. Не записалось — запросим снова
    const { fixture: info, league, teams, goals, score, events, statistics, lineups } = fixture
    await storage.setItem(fixtureKey(id), { fixture: info, league, teams, goals, score, events, statistics, lineups }).catch(() => {})
  }
  return fixture
}

/** Сколько номеров матчей API-Football принимает в одном запросе fixtures?ids= */
const IDS_PER_REQUEST = 20
/** Главная и страница матча ждут живой счёт, прежде чем показаться: долго ждать нельзя */
const LIVE_TIMEOUT_MS = 5_000

/**
 * Свежие счёт, статус и минута матчей по номерам — по 20 номеров в запросе. Ответ живёт 30 секунд
 * и общий для всех, кто смотрит те же матчи
 */
export const getFixturesByIds = defineCachedFunction(async (ids: string[]): Promise<ApiFootballLiveFixture[]> => {
  const chunks = Array.from({ length: Math.ceil(ids.length / IDS_PER_REQUEST) }, (_, index) =>
    ids.slice(index * IDS_PER_REQUEST, (index + 1) * IDS_PER_REQUEST))
  const responses = await Promise.all(chunks.map(chunk =>
    fetchApiFootball<ApiFootballLiveFixture>('fixtures', { ids: chunk.join('-') }, { timeout: LIVE_TIMEOUT_MS, spare: true })))
  return responses.flat()
}, {
  name: 'api-football-live',
  maxAge: 30,
  swr: false,
  getKey: (ids: string[]) => ids.join('-'),
})
