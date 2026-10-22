import type { GroupStanding, StandingZone, StandingZoneKind } from '~/types'
import { FINISHED_MATCH_STATUSES } from './matches'

function zone(kind: StandingZoneKind, label: string): StandingZone {
  return { kind, label }
}

/**
 * Лиги, где API пишет зону без названия турнира: просто «Qualifying» или «Play-offs».
 * Что это значит, зависит от места в таблице и от того, сколько путёвок у страны,
 * поэтому расшифровка своя для каждой лиги. Составлено по правилам УЕФА на 2024–2027:
 * когда правила или места стран поменяются, проверить. Ключ — описание в нижнем регистре.
 */
const LEAGUE_ZONE_OVERRIDES: Record<string, Record<string, StandingZone>> = {
  // Серия А: 6-е место
  135: {
    'play-offs': zone('tier3-qual', 'Квалификация Лиги конференций'),
  },
  // Бундеслига: 6-е место
  78: {
    qualifying: zone('tier3-qual', 'Квалификация Лиги конференций'),
  },
  // Лига 1: 4-е место — квалификация ЛЧ, 6-е — Лига конференций
  61: {
    'qualifying': zone('tier1-qual', 'Квалификация Лиги чемпионов'),
    'play-offs': zone('tier3-qual', 'Квалификация Лиги конференций'),
  },
}

/**
 * Зона места в таблице лиги по полю strDescription из TheSportsDB. Описания приходят
 * в разных форматах: «Promotion - Champions League (League phase)», «Champions
 * League league stage», «Relegation - Championship», «Relegation Playoffs».
 * Порядок проверок важен: «AFC Champions League 2» надо узнать раньше, чем
 * «AFC Champions League», а её — раньше, чем просто «Champions League».
 */
export function getStandingZone(description: string | null | undefined, leagueId?: string): StandingZone | null {
  const text = description?.trim().toLowerCase() ?? ''
  if (!text) return null

  const override = leagueId ? LEAGUE_ZONE_OVERRIDES[leagueId]?.[text] : undefined
  if (override) return override

  const isQualification = text.includes('qualif')
  const isPlayoff = /play[- ]?offs?/.test(text)

  // «Relegation Playoffs», «Relegation Play-offs», «Premier League (Relegation)»: стыки за место в лиге
  if (text.includes('relegation') && (isPlayoff || text.includes('(relegation)'))) {
    return zone('relegation-playoff', 'Стыковые матчи')
  }
  if (text.includes('relegation')) return zone('relegation', 'Вылет')

  // МЛС: 1/8 — сразу в плей-офф, 1/16 — раунд уайлд-кард перед ним
  if (text.includes('mls')) {
    return text.includes('1/16') ? zone('tier1-qual', 'Раунд уайлд-кард') : zone('tier1', 'Плей-офф')
  }

  if (text.includes('gulf')) return zone('tier3', 'Лига чемпионов Залива')
  // С 2024 года официально «AFC Champions League Two», в API пока «2»
  if (/afc champions league (2|two)\b/.test(text)) return zone('tier2', 'Лига чемпионов АФК 2')
  if (text.includes('afc champions league')) {
    return isQualification
      ? zone('tier1-qual', 'Квалификация Лиги чемпионов АФК')
      : zone('tier1', 'Лига чемпионов АФК')
  }
  if (text.includes('libertadores')) {
    return isQualification
      ? zone('tier1-qual', 'Квалификация Кубка Либертадорес')
      : zone('tier1', 'Кубок Либертадорес')
  }
  if (text.includes('sudamericana')) return zone('tier2', 'Южноамериканский кубок')

  if (text.includes('conference league')) {
    if (isQualification) return zone('tier3-qual', 'Квалификация Лиги конференций')
    // Эредивизи: внутренний плей-офф за путёвку в Лигу конференций
    if (isPlayoff) return zone('tier3-qual', 'Плей-офф за Лигу конференций')
    return zone('tier3', 'Лига конференций')
  }
  if (text.includes('europa league')) {
    return isQualification ? zone('tier2-qual', 'Квалификация Лиги Европы') : zone('tier2', 'Лига Европы')
  }
  if (text.includes('champions league')) {
    return isQualification ? zone('tier1-qual', 'Квалификация Лиги чемпионов') : zone('tier1', 'Лига чемпионов')
  }

  // Незнакомая лига с «Qualifying» / «Play-offs» без турнира: не угадываем, куда именно
  if (isQualification || isPlayoff) return zone('qual', 'Квалификация')

  return null
}

/**
 * Зона места в таблице общего этапа ЛЧ и ЛЕ (место считается с 1). Готовой таблицы
 * у этих турниров в API нет, поэтому границы свои, по формату УЕФА с 2024/25 на 36 команд:
 * 1–8 сразу в 1/8 финала, 9–24 в раунд плей-офф, 25–36 выбывают (в другой еврокубок
 * не переходят). Когда формат поменяется, проверить.
 */
export function getLeaguePhaseZone(position: number): StandingZone {
  if (position <= 8) return zone('tier1', '1/8 финала')
  if (position <= 24) return zone('tier1-qual', 'Раунд плей-офф')
  return zone('relegation', 'Выбывание')
}

/** Легенда под таблицей: все зоны в порядке сверху вниз, без повторов */
export function collectLegend(rows: Array<{ zone: StandingZone | null }>): StandingZone[] {
  const zones = new Map<string, StandingZone>()
  for (const row of rows) {
    if (row.zone && !zones.has(row.zone.label)) zones.set(row.zone.label, row.zone)
  }
  return [...zones.values()]
}

const GROUP_NAMES: Record<string, string> = {
  'Western Conference': 'Западная конференция',
  'Eastern Conference': 'Восточная конференция',
}

/** Название группы из API по-русски: «Group A» → «Группа A», конференции МЛС */
export function formatGroupName(name: string): string {
  return GROUP_NAMES[name] ?? name.replace(/^Group\b/, 'Группа')
}

/** Группы по названию. API отдаёт их вперемешку (A, H, B…); числа по значению: 2 раньше 10 */
export function sortGroups<T>(groups: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(groups).sort(([a], [b]) => a.localeCompare(b, 'ru', { numeric: true })),
  )
}

/** Матч из расписания TheSportsDB: поля, нужные для подсчёта таблицы */
export type ScheduleMatch = {
  strHomeTeam: string
  strAwayTeam: string
  strHomeTeamBadge: string
  strAwayTeamBadge: string
  intHomeScore: string | null
  intAwayScore: string | null
  strStatus: string
}

/**
 * Таблица по матчам, для турниров без готовой таблицы в API (общий этап ЛЧ и ЛЕ, Лига наций).
 * В неё попадают все команды из расписания, очки — только за завершённые матчи (FT, AET, AP;
 * матч, решённый пенальти, по счёту ничейный).
 * Порядок: очки, потом разница мячей, потом забитые.
 */
export function calculateStandings(matches: ScheduleMatch[]): GroupStanding[] {
  const stats = new Map<string, GroupStanding>()
  const standingOf = (team: string, badge: string): GroupStanding => {
    let standing = stats.get(team)
    if (!standing) {
      standing = {
        team,
        badge,
        played: 0, won: 0, drawn: 0, lost: 0,
        goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0,
        zone: null,
      }
      stats.set(team, standing)
    }
    return standing
  }

  for (const match of matches) {
    const home = standingOf(match.strHomeTeam, match.strHomeTeamBadge)
    const away = standingOf(match.strAwayTeam, match.strAwayTeamBadge)
    if (!FINISHED_MATCH_STATUSES.has(match.strStatus)) continue

    const homeGoals = parseInt(match.intHomeScore ?? '0')
    const awayGoals = parseInt(match.intAwayScore ?? '0')

    home.played++
    home.goalsFor += homeGoals
    home.goalsAgainst += awayGoals

    away.played++
    away.goalsFor += awayGoals
    away.goalsAgainst += homeGoals

    if (homeGoals > awayGoals) {
      home.won++
      home.points += 3
      away.lost++
    }
    else if (homeGoals === awayGoals) {
      home.drawn++
      home.points++
      away.drawn++
      away.points++
    }
    else {
      away.won++
      away.points += 3
      home.lost++
    }
  }

  return [...stats.values()]
    .map(standing => ({ ...standing, goalDiff: standing.goalsFor - standing.goalsAgainst }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff
      return b.goalsFor - a.goalsFor
    })
}
