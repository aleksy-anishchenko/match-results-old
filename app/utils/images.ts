/** Адрес эмблемы через наш прокси /api/image: он отдаёт картинку источника данных с кэшем браузера на сутки */
export function getBadgeUrl(badge: string): string {
  return `/api/image?url=${encodeURIComponent(badge)}`
}
