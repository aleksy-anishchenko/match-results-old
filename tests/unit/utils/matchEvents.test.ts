import { describe, it, expect } from 'vitest'
import { getApiFootballEvents, getTimelineEvents, goalsMatchScore } from '#shared/utils/matchEvents'
import type { MatchEvent } from '~/types'
// Настоящие ленты событий из TheSportsDB (v1 lookuptimeline), только поля для хроники
import championsLeagueFinal from '../../fixtures/timeline/champions-league-final-2026.json'
import bragantinoCruzeiro from '../../fixtures/timeline/bragantino-cruzeiro.json'
import excelsiorGroningen from '../../fixtures/timeline/excelsior-groningen.json'
// Настоящие ответы API-Football (fixtures?id=), только поля для хроники и статистики
import afSpartakRubin from '../../fixtures/api-football/spartak-rubin.json'
import afBragantinoCruzeiro from '../../fixtures/api-football/bragantino-cruzeiro.json'
import afChampionsLeagueFinal from '../../fixtures/api-football/psg-arsenal-final-2026.json'

const goals = (events: MatchEvent[]) => events.filter(event => ['goal', 'penalty', 'own-goal'].includes(event.kind))

describe('getTimelineEvents', () => {
  // Финал ЛЧ 2026 ПСЖ – Арсенал 1:1, ПСЖ выиграл серию пенальти 4:3
  it('серия пенальти после матча — не голы, пенальти в игре — гол; у гола — автор паса', () => {
    expect(goals(getTimelineEvents(championsLeagueFinal))).toEqual([
      { minute: 6, side: 'away', kind: 'goal', player: 'Kai Havertz', assist: 'Leandro Trossard', playerOut: null },
      { minute: 65, side: 'home', kind: 'penalty', player: 'Ousmane Dembélé', assist: null, playerOut: null },
    ])
  })

  it('замена: на поле — вышедший, «вместо» — ушедший', () => {
    const events = getTimelineEvents(championsLeagueFinal)
    expect(events.find(event => event.kind === 'substitution')).toEqual(
      { minute: 66, side: 'away', kind: 'substitution', player: 'Jurriën Timber', assist: null, playerOut: 'Cristhian Mosquera' },
    )
    expect(events.filter(event => event.kind === 'substitution')).toHaveLength(11)
    expect(events.filter(event => event.kind === 'yellow-card').map(event => event.player)).toEqual([
      'Cristhian Mosquera', 'Bukayo Saka', 'João Neves', 'Viktor Gyökeres', 'Declan Rice', 'Mikel Arteta', 'Nuno Mendes',
    ])
    expect(events).toHaveLength(20)
  })

  // Брагантино – Крузейро 4:2: Кайо Жорже из Крузейро забил в свои ворота, на 88-й гол отменён VAR
  it('автогол засчитан команде, которой забили в пользу; отменённый VAR гол не считается', () => {
    const events = goals(getTimelineEvents(bragantinoCruzeiro))
    expect(events.find(event => event.player === 'Kaio Jorge')).toEqual(
      { minute: 20, side: 'home', kind: 'own-goal', player: 'Kaio Jorge', assist: null, playerOut: null },
    )
    expect(events.map(event => event.minute)).toEqual([13, 20, 30, 43, 89, 90])
    expect(events.some(event => event.player === 'Fernando')).toBe(false)
  })

  it('голы по минутам, на обе стороны; замена без вышедшего игрока пропущена', () => {
    const events = getTimelineEvents(excelsiorGroningen)
    expect(goals(events).map(event => `${event.minute} ${event.side} ${event.kind}`)).toEqual([
      '7 away goal', '36 home penalty', '38 away own-goal', '64 away penalty', '67 away goal', '90 away goal',
    ])
    expect(events.some(event => event.playerOut === 'Thom van Bergen')).toBe(false)
  })

  it('пустая лента — событий нет', () => {
    expect(getTimelineEvents([])).toEqual([])
  })
})

describe('getApiFootballEvents', () => {
  // РПЛ 2026/27, Спартак – Рубин 4:0: у TheSportsDB ленты этого матча нет
  it('голы с пасами, карточки и замены по минутам', () => {
    const events = getApiFootballEvents(afSpartakRubin)
    expect(goals(events)).toEqual([
      { minute: 18, side: 'home', kind: 'goal', player: 'Pablo Solari', assist: null, playerOut: null },
      { minute: 43, side: 'home', kind: 'goal', player: 'Manfred Ugalde', assist: 'Ruslan Litvinov', playerOut: null },
      { minute: 65, side: 'home', kind: 'goal', player: 'Mirlind Daku', assist: 'Pablo Solari', playerOut: null },
      { minute: 90, side: 'home', kind: 'goal', player: 'Mirlind Daku', assist: null, playerOut: null },
    ])
    expect(events[0]).toEqual({ minute: 4, side: 'away', kind: 'yellow-card', player: 'Jakhongir Urozov', assist: null, playerOut: null })
    // Даку вышел на 64-й и забил на 65-й: на поле — тот, кто в ответе API записан автором паса
    expect(events.find(event => event.minute === 64)).toEqual(
      { minute: 64, side: 'home', kind: 'substitution', player: 'Mirlind Daku', assist: null, playerOut: 'Manfred Ugalde' },
    )
    expect(events).toHaveLength(18)
  })

  // Тот же матч, что в ленте TheSportsDB: автогол Кайо Жорже из Крузейро записан на Брагантино
  it('автогол — команде, которой засчитан', () => {
    const events = getApiFootballEvents(afBragantinoCruzeiro)
    expect(events.find(event => event.player === 'Kaio Jorge' && event.kind === 'own-goal')?.side).toBe('home')
    expect(goalsMatchScore(events, '4', '2')).toBe(true)
  })

  it('серия пенальти и незабитый пенальти — не голы', () => {
    const shootout = { time: { elapsed: 120, extra: null }, team: { id: 85 }, player: { name: 'Vitinha' }, assist: { name: null }, type: 'Goal', detail: 'Penalty', comments: 'Penalty Shootout' }
    const missed = { time: { elapsed: 70, extra: null }, team: { id: 42 }, player: { name: 'Bukayo Saka' }, assist: { name: null }, type: 'Goal', detail: 'Missed Penalty', comments: null }
    const events = getApiFootballEvents({ ...afChampionsLeagueFinal, events: [...afChampionsLeagueFinal.events, shootout, missed] })
    expect(goals(events).map(event => `${event.minute} ${event.player}`)).toEqual(['6 Kai Havertz', '65 Ousmane Dembélé'])
  })
})

describe('goalsMatchScore', () => {
  it('голы сходятся со счётом, карточки и замены не считаются', () => {
    expect(goalsMatchScore(getTimelineEvents(bragantinoCruzeiro), '4', '2')).toBe(true)
    expect(goalsMatchScore(getTimelineEvents(excelsiorGroningen), '1', '5')).toBe(true)
    expect(goalsMatchScore(getTimelineEvents(championsLeagueFinal), '1', '1')).toBe(true)
  })

  it('лента отстала от счёта или её нет — не сходится', () => {
    expect(goalsMatchScore(getTimelineEvents(bragantinoCruzeiro), '5', '2')).toBe(false)
    expect(goalsMatchScore([], '3', '0')).toBe(false)
  })

  it('0:0 и не начавшийся матч — пустой список сходится', () => {
    expect(goalsMatchScore([], '0', '0')).toBe(true)
    expect(goalsMatchScore([], null, null)).toBe(true)
  })
})
