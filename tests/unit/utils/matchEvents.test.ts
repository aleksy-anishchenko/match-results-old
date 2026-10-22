import { describe, it, expect } from 'vitest'
import { getApiFootballEvents, goalsMatchScore, isGoalEvent } from '#shared/utils/matchEvents'
import type { MatchEvent } from '~/types'
// Настоящие ответы API-Football (fixtures?id=), только поля для страницы матча
import afSpartakRubin from '../../fixtures/api-football/spartak-rubin.json'
import afBragantinoCruzeiro from '../../fixtures/api-football/bragantino-cruzeiro.json'
import afChampionsLeagueFinal from '../../fixtures/api-football/psg-arsenal-final-2026.json'

const goals = (events: MatchEvent[]) => events.filter(isGoalEvent)

describe('getApiFootballEvents', () => {
  // РПЛ 2026/27, Спартак – Рубин 4:0
  it('голы с пасами, карточки и замены по минутам', () => {
    const events = getApiFootballEvents(afSpartakRubin)
    expect(goals(events)).toEqual([
      { minute: 18, extra: null, side: 'home', kind: 'goal', player: 'Pablo Solari', assist: null, playerOut: null },
      { minute: 43, extra: null, side: 'home', kind: 'goal', player: 'Manfred Ugalde', assist: 'Ruslan Litvinov', playerOut: null },
      { minute: 65, extra: null, side: 'home', kind: 'goal', player: 'Mirlind Daku', assist: 'Pablo Solari', playerOut: null },
      { minute: 90, extra: null, side: 'home', kind: 'goal', player: 'Mirlind Daku', assist: null, playerOut: null },
    ])
    expect(events[0]).toEqual({ minute: 4, extra: null, side: 'away', kind: 'yellow-card', player: 'Jakhongir Urozov', assist: null, playerOut: null })
    // Даку вышел на 64-й и забил на 65-й: на поле — тот, кто в ответе API записан автором паса
    expect(events.find(event => event.minute === 64)).toEqual(
      { minute: 64, extra: null, side: 'home', kind: 'substitution', player: 'Mirlind Daku', assist: null, playerOut: 'Manfred Ugalde' },
    )
    expect(events).toHaveLength(18)
  })

  // Финал ЛЧ 2026 ПСЖ – Арсенал 1:1, ПСЖ выиграл серию пенальти 4:3
  it('пенальти в игре — гол, у гола — автор паса; замены и карточки', () => {
    const events = getApiFootballEvents(afChampionsLeagueFinal)
    expect(goals(events)).toEqual([
      { minute: 6, extra: null, side: 'away', kind: 'goal', player: 'Kai Havertz', assist: 'Leandro Trossard', playerOut: null },
      { minute: 65, extra: null, side: 'home', kind: 'penalty', player: 'Ousmane Dembélé', assist: null, playerOut: null },
    ])
    expect(events.filter(event => event.kind === 'substitution')).toHaveLength(11)
    expect(events.filter(event => event.kind === 'yellow-card').map(event => event.player)).toEqual([
      'Cristhian Mosquera', 'Bukayo Saka', 'João Neves', 'Viktor Gyökeres', 'Declan Rice', 'Nuno Mendes',
    ])
  })

  // Брагантино – Крузейро 4:2: Кайо Жорже из Крузейро забил в свои ворота, на 88-й гол отменён VAR, последний гол на 90+1
  it('автогол — команде, которой засчитан; отменённый VAR гол не считается; добавленное время отдельно', () => {
    const events = goals(getApiFootballEvents(afBragantinoCruzeiro))
    expect(events.find(event => event.player === 'Kaio Jorge')).toEqual(
      { minute: 21, extra: null, side: 'home', kind: 'own-goal', player: 'Kaio Jorge', assist: null, playerOut: null },
    )
    expect(events.map(event => [event.minute, event.extra])).toEqual([[13, null], [21, null], [30, null], [44, null], [89, null], [90, 1]])
    expect(events.some(event => event.player === 'Fernando dos Santos Pedro')).toBe(false)
    expect(goalsMatchScore(events, '4', '2')).toBe(true)
  })

  it('событие в добавленное время идёт после 90-й минуты', () => {
    const event = (elapsed: number, extra: number | null, name: string) =>
      ({ time: { elapsed, extra }, team: { id: 85 }, player: { name }, assist: { name: null }, type: 'Card', detail: 'Yellow Card', comments: null })
    const events = getApiFootballEvents({ ...afChampionsLeagueFinal, events: [event(90, 4, 'C'), event(90, null, 'B'), event(90, 2, 'A')] })
    expect(events.map(item => item.player)).toEqual(['B', 'A', 'C'])
  })

  it('вторая жёлтая — удаление, показываем красной', () => {
    const secondYellow = { time: { elapsed: 80, extra: null }, team: { id: 42 }, player: { name: 'Bukayo Saka' }, assist: { name: null }, type: 'Card', detail: 'Second Yellow card', comments: 'Foul' }
    expect(getApiFootballEvents({ ...afChampionsLeagueFinal, events: [secondYellow] })).toEqual([
      { minute: 80, extra: null, side: 'away', kind: 'red-card', player: 'Bukayo Saka', assist: null, playerOut: null },
    ])
  })

  it('нет списка событий в ответе — пусто, а не ошибка', () => {
    const { events: _events, ...withoutEvents } = afSpartakRubin
    expect(getApiFootballEvents(withoutEvents)).toEqual([])
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
    expect(goalsMatchScore(getApiFootballEvents(afSpartakRubin), '4', '0')).toBe(true)
    expect(goalsMatchScore(getApiFootballEvents(afChampionsLeagueFinal), '1', '1')).toBe(true)
  })

  it('хроника отстала от счёта или её нет — не сходится', () => {
    expect(goalsMatchScore(getApiFootballEvents(afBragantinoCruzeiro), '5', '2')).toBe(false)
    expect(goalsMatchScore([], '3', '0')).toBe(false)
  })

  it('0:0 и не начавшийся матч — пустой список сходится', () => {
    expect(goalsMatchScore([], '0', '0')).toBe(true)
    expect(goalsMatchScore([], null, null)).toBe(true)
  })
})
