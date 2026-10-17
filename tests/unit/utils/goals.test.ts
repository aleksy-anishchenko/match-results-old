import { describe, it, expect } from 'vitest'
import { getMatchGoals, goalsMatchScore } from '#shared/utils/goals'
// Настоящие ленты событий из TheSportsDB (v1 lookuptimeline), только поля для голов
import championsLeagueFinal from '../../fixtures/timeline/champions-league-final-2026.json'
import bragantinoCruzeiro from '../../fixtures/timeline/bragantino-cruzeiro.json'
import excelsiorGroningen from '../../fixtures/timeline/excelsior-groningen.json'

describe('getMatchGoals', () => {
  // Финал ЛЧ 2026 ПСЖ – Арсенал 1:1, ПСЖ выиграл серию пенальти 4:3
  it('серия пенальти после матча — не голы, пенальти в игре — гол', () => {
    expect(getMatchGoals(championsLeagueFinal)).toEqual([
      { minute: 6, player: 'Kai Havertz', side: 'away', kind: 'goal' },
      { minute: 65, player: 'Ousmane Dembélé', side: 'home', kind: 'penalty' },
    ])
  })

  // Брагантино – Крузейро 4:2: Кайо Жорже из Крузейро забил в свои ворота, на 88-й гол отменён VAR
  it('автогол засчитан команде, которой забили в пользу; отменённый VAR гол не считается', () => {
    const goals = getMatchGoals(bragantinoCruzeiro)
    expect(goals.find(goal => goal.player === 'Kaio Jorge')).toEqual({ minute: 20, player: 'Kaio Jorge', side: 'home', kind: 'own-goal' })
    expect(goals.map(goal => goal.minute)).toEqual([13, 20, 30, 43, 89, 90])
    expect(goals.some(goal => goal.player === 'Fernando')).toBe(false)
  })

  it('голы по минутам, на обе стороны', () => {
    const goals = getMatchGoals(excelsiorGroningen)
    expect(goals.map(goal => `${goal.minute} ${goal.side} ${goal.kind}`)).toEqual([
      '7 away goal', '36 home penalty', '38 away own-goal', '64 away penalty', '67 away goal', '90 away goal',
    ])
  })

  it('пустая лента — голов нет', () => {
    expect(getMatchGoals([])).toEqual([])
  })
})

describe('goalsMatchScore', () => {
  it('голы сходятся со счётом', () => {
    expect(goalsMatchScore(getMatchGoals(bragantinoCruzeiro), '4', '2')).toBe(true)
    expect(goalsMatchScore(getMatchGoals(excelsiorGroningen), '1', '5')).toBe(true)
    expect(goalsMatchScore(getMatchGoals(championsLeagueFinal), '1', '1')).toBe(true)
  })

  it('лента отстала от счёта или её нет — не сходится', () => {
    expect(goalsMatchScore(getMatchGoals(bragantinoCruzeiro), '5', '2')).toBe(false)
    expect(goalsMatchScore([], '3', '0')).toBe(false)
  })

  it('0:0 и не начавшийся матч — пустой список сходится', () => {
    expect(goalsMatchScore([], '0', '0')).toBe(true)
    expect(goalsMatchScore([], null, null)).toBe(true)
  })
})
