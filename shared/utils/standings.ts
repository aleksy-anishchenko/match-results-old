import type { StandingZone, StandingZoneKind } from '~/types'

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
  4332: {
    'play-offs': zone('tier3-qual', 'Квалификация Лиги конференций'),
  },
  // Бундеслига: 6-е место
  4331: {
    qualifying: zone('tier3-qual', 'Квалификация Лиги конференций'),
  },
  // Лига 1: 4-е место — квалификация ЛЧ, 6-е — Лига конференций
  4334: {
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

type GroupStageRules = {
  /** Команды, которые уже попали в сетку плей-офф; null — сетки ещё нет */
  advancedTeams: Set<string> | null
  /** Сколько команд из группы выходят в плей-офф */
  groupAdvance?: number
  /** Проходят ли ещё лучшие команды с 3-х мест */
  bestThirdsAdvance?: boolean
}

/**
 * Зона в группе турнира. Когда сетка плей-офф уже есть, отмечаем тех, кто в неё попал.
 * Пока сетки нет — первые места по правилам турнира, а 3-е место как «может выйти»,
 * если в турнире проходят лучшие третьи.
 */
export function getGroupStageZone(team: string, index: number, rules: GroupStageRules): StandingZone | null {
  if (rules.advancedTeams) {
    return rules.advancedTeams.has(team) ? zone('tier1', 'Выход в плей-офф') : null
  }
  if (rules.groupAdvance != null && index < rules.groupAdvance) return zone('tier1', 'Выход в плей-офф')
  if (rules.bestThirdsAdvance && index === 2) return zone('tier1-qual', 'Может выйти в плей-офф')
  return null
}

/** Легенда под таблицей: все зоны в порядке сверху вниз, без повторов */
export function collectLegend(rows: Array<{ zone: StandingZone | null }>): StandingZone[] {
  const zones = new Map<string, StandingZone>()
  for (const row of rows) {
    if (row.zone && !zones.has(row.zone.label)) zones.set(row.zone.label, row.zone)
  }
  return [...zones.values()]
}

/** «2026-2027» → «2026/27», сезон в один год («2026») остаётся как есть */
export function formatSeason(season: string): string {
  const match = season.match(/^(\d{4})-\d{2}(\d{2})$/)
  return match ? `${match[1]}/${match[2]}` : season
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
