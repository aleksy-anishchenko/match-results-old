import { describe, it, expect } from 'vitest'
import { decodeEntities } from '../../../server/utils/text'

describe('decodeEntities', () => {
  // Так API-Football прислал игрока Брагантино и стадионы Болоньи и Интер Майами
  it('расшифровывает HTML-коды', () => {
    expect(decodeEntities('Sant&apos;Anna')).toBe('Sant\'Anna')
    expect(decodeEntities('Inter&amp;Co Stadium')).toBe('Inter&Co Stadium')
    expect(decodeEntities('Stadio Renato Dall&#39;Ara')).toBe('Stadio Renato Dall\'Ara')
    expect(decodeEntities('M&#xFC;ller')).toBe('Müller')
  })

  it('обычный текст и незнакомые коды не трогает', () => {
    expect(decodeEntities('Vinícius Júnior')).toBe('Vinícius Júnior')
    expect(decodeEntities('A & B')).toBe('A & B')
    expect(decodeEntities('&nbsp;')).toBe('&nbsp;')
  })
})
