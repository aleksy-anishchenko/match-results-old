<script setup lang="ts">
import type { MatchDetails } from '~/types'
import { getCompetition } from '#shared/utils/competitions'
import { formatPenaltyScore, getMatchStatusKind, getMatchWinnerSide, getMoscowDate } from '#shared/utils/matches'
import { getBadgeUrl } from '~/utils/images'
import { formatMatchStatus, formatMoscowTime, formatReadableDate } from '~/utils/matches'

const props = defineProps<{ match: MatchDetails }>()

const kind = computed(() => getMatchStatusKind(props.match.status))

// У идущего матча — минута вместо «2-й тайм»; в доп. время — с пометкой, как «ДВ» в списке матчей
const statusLabel = computed(() => {
  const { progress, status } = props.match
  if (progress == null) return formatMatchStatus(status)
  return status === 'ET' ? `${progress}′ · доп. время` : `${progress}′`
})
const winner = computed(() => getMatchWinnerSide(props.match))

const competition = computed(() => getCompetition(props.match.leagueId))

// «АПЛ · 6 тур». Тур показываем только у лиг: у турниров номер тура общего этапа без названия этапа не нужен
const context = computed(() => {
  const round = competition.value?.type === 'league' && props.match.round ? `${props.match.round} тур` : null
  return [competition.value?.name ?? props.match.league, round].filter(Boolean).join(' · ')
})

const teams = computed(() => (['home', 'away'] as const).map(side => ({
  side,
  name: side === 'home' ? props.match.homeTeam : props.match.awayTeam,
  badge: side === 'home' ? props.match.homeBadge : props.match.awayBadge,
  result: winner.value ? (winner.value === side ? 'win' : 'lose') : null,
  // Победитель серии пенальти в турнире точно проходит дальше. Победитель в доп. время — не всегда:
  // в ответном матче дальше может пройти соперник по сумме двух встреч. У лиг не пишем: в плей-офф МЛС
  // первый раунд — серии до двух побед, и пенальти решают только один матч серии
  advances: competition.value?.type === 'tournament' && props.match.status === 'PEN' && winner.value === side,
})))

const penalties = computed(() => {
  const score = formatPenaltyScore(props.match)
  return score ? `пенальти ${score}` : ''
})

const when = computed(() => {
  const { timestamp, status } = props.match
  const day = formatReadableDate(getMoscowDate(timestamp), 'short')
  // TBD: время не назначено, в timestamp заглушка 00:00 UTC
  return status === 'TBD' ? day : `${day} · ${formatMoscowTime(timestamp)} МСК`
})

const venue = computed(() => props.match.venue || props.match.city)
</script>

<template>
  <section
    class="header"
    :class="`header--${kind}`"
  >
    <p class="header__meta">
      <span
        v-if="kind === 'live'"
        class="header__dot"
        aria-hidden="true"
      />
      <span>{{ context }} · <span class="header__status">{{ statusLabel }}</span></span>
    </p>

    <div class="header__teams">
      <template
        v-for="team in teams"
        :key="team.side"
      >
        <div class="team">
          <img
            v-if="team.badge"
            :src="getBadgeUrl(team.badge)"
            alt=""
            width="72"
            height="72"
            class="team__badge"
          >
          <span
            v-else
            class="team__badge team__badge--empty"
          />
          <span
            class="team__name"
            :class="{ 'team__name--lose': team.result === 'lose' }"
          >{{ team.name }}</span>
          <span
            v-if="team.advances"
            class="team__advance"
          >проходит дальше</span>
        </div>

        <!-- Счёт сразу после хозяев: порядок «хозяева · счёт · гости» и в разметке, и на экране -->
        <div
          v-if="team.side === 'home'"
          class="score"
        >
          <span class="score__goals num">
            {{ match.homeScore ?? '–' }}<span class="score__colon">:</span>{{ match.awayScore ?? '–' }}
          </span>
          <span
            v-if="penalties"
            class="score__penalties num"
          >{{ penalties }}</span>
        </div>
      </template>
    </div>

    <p
      v-if="when || venue"
      class="header__when"
    >
      <span
        v-if="when"
        class="header__date"
      >{{ when }}</span>
      <span
        v-if="venue"
        class="header__venue"
      >{{ venue }}</span>
    </p>
  </section>
</template>

<style scoped lang="scss">
.header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 20px 12px;
  background: $color-surface;
  border: 1px solid $color-border;
  border-radius: $radius-card-lg;
}

.header__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: $color-text-3;
  text-align: center;
}

.header__dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
  background: $color-live;
  box-shadow: 0 0 0 3px $color-live-soft;
}

.header--live .header__meta {
  font-weight: 600;
  color: $color-live;
}

.header--inactive .header__status {
  color: $color-live;
}

// Колонки выровнены по верху: если название команды в две строки,
// эмблемы и счёт всё равно остаются на одном уровне
.header__teams {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: start;
  gap: 8px;
  width: 100%;
}

.team {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  min-width: 0;
  text-align: center;
}

.team__badge {
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  object-fit: contain;

  &--empty {
    border-radius: 50%;
    background: $color-badge-bg;
    border: 1px solid $color-border;
  }
}

.team__name {
  max-width: 100%;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.2;
  overflow-wrap: break-word;
  hyphens: auto;

  &--lose {
    font-weight: 500;
    color: $color-text-3;
  }
}

.team__advance {
  font-size: 12px;
  font-weight: 700;
  color: $color-accent;
}

.score {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.score__goals {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: $font-display;
  font-size: 40px;
  font-weight: 700;
  line-height: 1.2;
  color: $color-text-muted;
}

.score__colon {
  color: $color-border-strong;
}

.header--finished {
  .score__goals {
    color: $color-accent-dark;
  }

  .score__colon {
    color: $color-accent-pale;
  }
}

.header--live {
  .score__goals {
    color: $color-live;
  }

  .score__colon {
    color: $color-live-pale;
  }
}

.score__penalties {
  padding: 4px 10px;
  border-radius: $radius-pill;
  background: $color-accent-soft;
  color: $color-accent-dark;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

.header--live .score__penalties {
  background: $color-live-soft;
  color: $color-live;
}

// На телефоне стадион переносится на отдельную строку, на десктопе идёт через точку
.header__when {
  font-size: 14px;
  line-height: 1.5;
  color: $color-text-2;
  text-align: center;
}

.header__venue {
  display: block;
}

@media (min-width: $breakpoint-desktop) {
  .header {
    gap: 20px;
    padding: 32px;
  }

  .header__teams {
    gap: 24px;
  }

  .team__badge {
    width: 72px;
    height: 72px;
  }

  .team__name {
    font-size: 28px;
  }

  .score__goals {
    gap: 10px;
    font-size: 64px;
  }

  .header__venue {
    display: inline;
  }

  // Точка-разделитель только если перед стадионом есть дата
  .header__date + .header__venue::before {
    content: ' · ';
  }
}
</style>
