import { describe, it, expect } from 'vitest'
import { getTeamName } from '../../../server/utils/teamNames'

describe('getTeamName', () => {
  it('переводит команду по номеру в API-Football', () => {
    expect(getTeamName(157, 'Bayern München')).toBe('Бавария')
    expect(getTeamName(1088, 'Dynamo')).toBe('Динамо')
    expect(getTeamName(2, 'France')).toBe('Франция')
  })

  it('без перевода возвращает название из API', () => {
    expect(getTeamName(999_999, 'Unknown FC')).toBe('Unknown FC')
  })
})
