import type { StandingZone, StandingZoneKind } from '~/types'

function zone(kind: StandingZoneKind, label: string): StandingZone {
  return { kind, label }
}

/**
 * Лиги, где API пишет зону без названия турнира: просто «Qualifying» или «Play-offs».
 * Что это значит, зависит от места в таблице и от того, сколько путёвок у страны,
 * поэтому расшифровка своя для каждой лиги. И Лига наций, у которой зоны свои. Составлено по правилам УЕФА на 2024–2027:
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
  // Лига наций 2026/27 — переходный сезон перед сокращением до трёх лиг. Лига A: 1–2 места — четвертьфинал,
  // судьбу 3–4 мест решает сравнение групп (две лучшие третьи остаются, две худшие четвёртые вылетают,
  // остальные — стыки). Лиги B и C: 1-е — повышение, 2-е — стыки за повышение, 4-е в B — стыки за место.
  // Лига D упраздняется — повышаются все. С 2028/29 формат другой: проверить
  5: {
    'play offs: quarter-finals': zone('tier1', 'Четвертьфинал'),
    'possible play-off': zone('qual', 'Возможны стыковые матчи'),
    'promotion': zone('tier2', 'Повышение'),
    'promotion play-offs': zone('tier2-qual', 'Стыковые матчи за повышение'),
  },
}

/**
 * Зона места в таблице по описанию места из API (description). Описания приходят
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
 * Зона места в таблице общего этапа ЛЧ, ЛЕ и ЛК (место считается с 1). Описание из API для неё не годится
 * («Promotion - Champions League (Play Offs: 1/8-finals)», у 25–36 мест его нет), поэтому границы свои,
 * по формату УЕФА с 2024/25 на 36 команд:
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

/** Название группы из API по-русски: «Group A» → «Группа A», «League A - Group B» → «Лига A, группа B», конференции МЛС */
export function formatGroupName(name: string): string {
  const nationsLeagueGroup = /^League ([A-Z]) - Group ([A-Z])$/.exec(name)
  if (nationsLeagueGroup) return `Лига ${nationsLeagueGroup[1]}, группа ${nationsLeagueGroup[2]}`
  return GROUP_NAMES[name] ?? name.replace(/^Group\b/, 'Группа')
}

/** Группы по названию. API отдаёт их вперемешку (A, H, B…); числа по значению: 2 раньше 10 */
export function sortGroups<T>(groups: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(groups).sort(([a], [b]) => a.localeCompare(b, 'ru', { numeric: true })),
  )
}
