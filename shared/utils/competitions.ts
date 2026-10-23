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
  },
  {
    id: '3',
    name: 'Лига Европы',
    country: 'Европа',
    type: 'tournament',
    category: 'Еврокубки',
    leaguePhase: true,
  },
  {
    id: '88',
    name: 'Эредивизи',
    country: 'Нидерланды',
    type: 'league',
    category: 'Остальной мир',
  },
  {
    id: '94',
    name: 'Примейра-лига',
    country: 'Португалия',
    type: 'league',
    category: 'Остальной мир',
  },
  {
    id: '144',
    name: 'Про-лига',
    country: 'Бельгия',
    type: 'league',
    category: 'Остальной мир',
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

/** Эмблема турнира у API-Football: адрес известен по номеру, спрашивать его не нужно. Тёмная на прозрачном фоне */
export const getCompetitionBadge = (id: string) => `https://media.api-sports.io/football/leagues/${id}.png`

export function getCompetition(id: string | number | null | undefined): Competition | undefined {
  return COMPETITIONS.find(competition => competition.id === String(id))
}
