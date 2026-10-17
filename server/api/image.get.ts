// Сколько ждать ответа TheSportsDB: зависший запрос не должен держать картинку в браузере бесконечно
const UPSTREAM_TIMEOUT_MS = 10_000

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const url = String(query.url ?? '')

  if (!url.startsWith('https://www.thesportsdb.com/') && !url.startsWith('https://r2.thesportsdb.com/')) {
    throw createError({ statusCode: 400, message: 'Invalid image URL' })
  }

  const response = await fetch(url, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) }).catch((error: unknown) => {
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError'
    throw createError({ statusCode: timedOut ? 504 : 502, statusMessage: timedOut ? 'TheSportsDB не ответил' : 'TheSportsDB недоступен' })
  })

  // Ошибку отдаём ошибкой и без кэша. Раньше она уходила как картинка с кодом 200,
  // и браузер сутки показывал битую эмблему даже после того, как источник починился.
  if (!response.ok) {
    throw createError({
      statusCode: response.status === 404 ? 404 : 502,
      statusMessage: response.status === 404 ? 'Картинка не найдена' : 'TheSportsDB недоступен',
    })
  }

  const arrayBuffer = await response.arrayBuffer()

  return new Response(arrayBuffer, {
    headers: {
      'Content-Type': response.headers.get('Content-Type') ?? 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  })
})
