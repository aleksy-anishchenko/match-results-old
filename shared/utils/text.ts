const NAMED_ENTITIES: Record<string, string> = { amp: '&', apos: '\'', quot: '"', lt: '<', gt: '>' }

/**
 * Текст из API-Football без HTML-кодов: имена и стадионы иногда приходят как «Sant&apos;Anna»,
 * «Inter&amp;Co Stadium». Vue выводит текст как есть, поэтому коды расшифровываем сами
 */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code[0] !== '#') return NAMED_ENTITIES[code.toLowerCase()] ?? entity
    const point = code[1] === 'x' || code[1] === 'X' ? Number.parseInt(code.slice(2), 16) : Number(code.slice(1))
    return Number.isFinite(point) && point > 0 && point <= 0x10FFFF ? String.fromCodePoint(point) : entity
  })
}
