import type { Competition } from '~/types'

export const COMPETITION_CATEGORIES = [
  'Популярное',
  'Еврокубки',
  'Остальной мир',
  'Сборные',
] as const

export const COMPETITIONS: Competition[] = [
  {
    id: '39',
    name: 'АПЛ',
    country: 'Англия',
    type: 'league',
    category: 'Популярное',
  },
  {
    id: '140',
    name: 'Ла Лига',
    country: 'Испания',
    type: 'league',
    category: 'Популярное',
  },
  {
    id: '135',
    name: 'Серия А',
    country: 'Италия',
    type: 'league',
    category: 'Популярное',
  },
  {
    id: '78',
    name: 'Бундеслига',
    country: 'Германия',
    type: 'league',
    category: 'Популярное',
  },
  {
    id: '61',
    name: 'Лига 1',
    country: 'Франция',
    type: 'league',
    category: 'Популярное',
  },
  {
    id: '235',
    name: 'РПЛ',
    country: 'Россия',
    type: 'league',
    category: 'Популярное',
  },
  {
    id: '2',
    name: 'Лига чемпионов',
    country: 'Европа',
    type: 'tournament',
    category: 'Еврокубки',
    leaguePhase: true,
    whiteBadge: true,
  },
  {
    id: '3',
    name: 'Лига Европы',
    country: 'Европа',
    type: 'tournament',
    category: 'Еврокубки',
    leaguePhase: true,
    whiteBadge: true,
  },
  {
    id: '88',
    name: 'Эредивизи',
    country: 'Нидерланды',
    type: 'league',
    category: 'Остальной мир',
    whiteBadge: true,
  },
  {
    id: '94',
    name: 'Примейра-лига',
    country: 'Португалия',
    type: 'league',
    category: 'Остальной мир',
    whiteBadge: true,
  },
  {
    id: '144',
    name: 'Про-лига',
    country: 'Бельгия',
    type: 'league',
    category: 'Остальной мир',
    whiteBadge: true,
  },
  {
    id: '203',
    name: 'Суперлига',
    country: 'Турция',
    type: 'league',
    category: 'Остальной мир',
  },
  {
    id: '253',
    name: 'МЛС',
    country: 'США',
    type: 'league',
    category: 'Остальной мир',
  },
  {
    id: '307',
    name: 'Саудовская Про-лига',
    country: 'Саудовская Аравия',
    type: 'league',
    category: 'Остальной мир',
  },
  {
    id: '71',
    name: 'Бразилия Серия A',
    country: 'Бразилия',
    type: 'league',
    category: 'Остальной мир',
  },
  {
    id: '5',
    name: 'Лига наций',
    country: 'Европа',
    type: 'tournament',
    category: 'Сборные',
  },
]

export const DEFAULT_COMPETITION_ID = '39'

/**
 * Номера турниров в TheSportsDB, на данных которого сайт работал до перехода на API-Football: под ними лежит
 * выбор лиги в cookie у тех, кто заходил раньше. Cookie живёт год — потом этот список можно убрать
 */
export const THE_SPORTS_DB_COMPETITION_IDS: Record<string, string> = {
  4328: '39',
  4335: '140',
  4332: '135',
  4331: '78',
  4334: '61',
  4355: '235',
  4480: '2',
  4481: '3',
  4337: '88',
  4344: '94',
  4338: '144',
  4339: '203',
  4346: '253',
  4668: '307',
  4351: '71',
  4490: '5',
}

export function getCompetition(id: string | number | null | undefined): Competition | undefined {
  return COMPETITIONS.find(competition => competition.id === String(id))
}
