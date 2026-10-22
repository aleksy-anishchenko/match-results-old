import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MatchHeader from '~/components/MatchHeader.vue'
import type { MatchDetails } from '~/types'

function makeMatch(overrides: Partial<MatchDetails> = {}): MatchDetails {
  return {
    idEvent: '1',
    homeTeam: 'Liverpool',
    awayTeam: 'Manchester City',
    homeBadge: '',
    awayBadge: '',
    homeScore: '2',
    awayScore: '1',
    homePenScore: null,
    awayPenScore: null,
    status: 'FT',
    progress: null,
    timestamp: '2026-10-11T15:30:00',
    date: '2026-10-11',
    leagueId: '39',
    league: 'English Premier League',
    season: '2026-2027',
    round: '6',
    venue: 'Anfield',
    city: null,
    lineups: null,
    events: [],
    stats: [],
    ...overrides,
  }
}

describe('MatchHeader', () => {
  it('показывает лигу по-русски, тур и статус', async () => {
    const wrapper = await mountSuspended(MatchHeader, { props: { match: makeMatch() } })
    expect(wrapper.find('.header__meta').text()).toBe('АПЛ · 6 тур · Завершён')
    expect(wrapper.find('.header').classes()).toContain('header--finished')
  })

  it('у турнира не показывает номер тура', async () => {
    const wrapper = await mountSuspended(MatchHeader, {
      props: { match: makeMatch({ leagueId: '2', round: '125' }) },
    })
    expect(wrapper.find('.header__meta').text()).toBe('Лига чемпионов · Завершён')
  })

  it('для неизвестной лиги берёт название из API', async () => {
    const wrapper = await mountSuspended(MatchHeader, {
      props: { match: makeMatch({ leagueId: '9999', league: 'Some League' }) },
    })
    expect(wrapper.find('.header__meta').text()).toBe('Some League · Завершён')
  })

  it('время и дата по Москве, стадион', async () => {
    const wrapper = await mountSuspended(MatchHeader, { props: { match: makeMatch() } })
    // 15:30 UTC — это 18:30 МСК
    expect(wrapper.find('.header__when').text()).toContain('Вс, 11 октября · 18:30 МСК')
    expect(wrapper.find('.header__venue').text()).toBe('Anfield')
  })

  it('проигравший приглушён', async () => {
    const wrapper = await mountSuspended(MatchHeader, { props: { match: makeMatch() } })
    const names = wrapper.findAll('.team__name')
    expect(names[0]!.text()).toBe('Ливерпуль')
    expect(names[0]!.classes()).not.toContain('team__name--lose')
    expect(names[1]!.classes()).toContain('team__name--lose')
  })

  it('счёт стоит между командами', async () => {
    const wrapper = await mountSuspended(MatchHeader, { props: { match: makeMatch() } })
    const text = wrapper.find('.header__teams').text().replace(/\s+/g, '')
    expect(text).toBe('Ливерпуль2:1МанчестерСити')
  })

  it('после серии пенальти показывает счёт серии и кто проходит дальше', async () => {
    const wrapper = await mountSuspended(MatchHeader, {
      props: {
        match: makeMatch({ homeScore: '1', awayScore: '1', homePenScore: 3, awayPenScore: 4, status: 'PEN' }),
      },
    })
    expect(wrapper.find('.score__penalties').text()).toBe('пенальти 3:4')
    const teams = wrapper.findAll('.team')
    expect(teams[0]!.find('.team__advance').exists()).toBe(false)
    expect(teams[1]!.find('.team__advance').text()).toBe('проходит дальше')
  })

  it('у обычного матча нули в полях пенальти не показываются', async () => {
    const wrapper = await mountSuspended(MatchHeader, {
      props: { match: makeMatch({ homePenScore: 0, awayPenScore: 0, status: 'FT' }) },
    })
    expect(wrapper.find('.score__penalties').exists()).toBe(false)
  })

  it('время не назначено (TBD): только дата', async () => {
    const wrapper = await mountSuspended(MatchHeader, {
      props: { match: makeMatch({ status: 'TBD', homeScore: null, awayScore: null, timestamp: '2026-10-11T00:00:00' }) },
    })
    const when = wrapper.find('.header__when').text()
    expect(when).toContain('Вс, 11 октября')
    expect(when).not.toContain('МСК')
  })

  it('без timestamp берёт дату из date, время не показывает', async () => {
    const wrapper = await mountSuspended(MatchHeader, { props: { match: makeMatch({ timestamp: '', date: '2026-10-11' }) } })
    const when = wrapper.find('.header__when').text()
    expect(when).toContain('Вс, 11 октября')
    expect(when).not.toContain('МСК')
    expect(when).not.toContain('Invalid')
  })

  it('без даты и стадиона строки нет', async () => {
    const wrapper = await mountSuspended(MatchHeader, {
      props: { match: makeMatch({ timestamp: '', date: '', venue: null }) },
    })
    expect(wrapper.find('.header__when').exists()).toBe(false)
  })

  it('без пенальти пометки «проходит дальше» нет', async () => {
    const wrapper = await mountSuspended(MatchHeader, { props: { match: makeMatch({ status: 'AET' }) } })
    expect(wrapper.find('.team__advance').exists()).toBe(false)
  })

  it('идущий матч: красная точка и период', async () => {
    const wrapper = await mountSuspended(MatchHeader, { props: { match: makeMatch({ status: '2H' }) } })
    expect(wrapper.find('.header').classes()).toContain('header--live')
    expect(wrapper.find('.header__dot').exists()).toBe(true)
    expect(wrapper.find('.header__meta').text()).toContain('2-й тайм')
    expect(wrapper.findAll('.team__name--lose')).toHaveLength(0)
  })

  it('не начавшийся матч: прочерки вместо счёта', async () => {
    const wrapper = await mountSuspended(MatchHeader, {
      props: { match: makeMatch({ homeScore: null, awayScore: null, status: 'NS' }) },
    })
    expect(wrapper.find('.score__goals').text().replace(/\s+/g, '')).toBe('–:–')
    expect(wrapper.find('.header').classes()).toContain('header--scheduled')
  })

  it('идущий матч с минутой: минута вместо тайма, в доп. время — с пометкой', async () => {
    const live = await mountSuspended(MatchHeader, { props: { match: makeMatch({ status: '2H', progress: '52' }) } })
    expect(live.get('.header__status').text()).toBe('52′')
    const extraTime = await mountSuspended(MatchHeader, { props: { match: makeMatch({ status: 'ET', progress: '97' }) } })
    expect(extraTime.get('.header__status').text()).toBe('97′ · доп. время')
  })
})
