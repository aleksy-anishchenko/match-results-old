<script setup lang="ts">
import type { BracketTie } from '~/types'

defineProps<{
  tie: BracketTie
  /** Будущая пара: соперники ещё не определены */
  projected?: boolean
}>()
</script>

<template>
  <div
    class="tie-card"
    :class="{ 'tie-card--projected': projected }"
  >
    <div
      v-for="(team, side) in tie.teams"
      :key="side"
      class="tie-card__team"
      :class="{
        'tie-card__team--win': tie.winner === side,
        'tie-card__team--lose': tie.winner != null && tie.winner !== side,
        'tie-card__team--tbd': !team.name,
      }"
    >
      <img
        v-if="team.badge"
        :src="getBadgeUrl(team.badge)"
        alt=""
        width="18"
        height="18"
        class="tie-card__badge"
      >
      <span
        v-else
        class="tie-card__badge tie-card__badge--empty"
      />
      <span class="tie-card__name">{{ team.name || 'Не определен' }}</span>
      <!-- В паре из двух матчей: мелко голы в каждом сыгранном матче, крупно сумма -->
      <span
        v-if="team.goals.length > 1"
        class="tie-card__legs"
      >
        <span
          v-for="(goals, leg) in team.goals"
          v-show="goals != null"
          :key="leg"
          class="tie-card__leg"
        >{{ goals }}</span>
      </span>
      <span
        v-if="getTieTotal(team) != null"
        class="tie-card__score"
      >
        {{ getTieTotal(team) }}<sup
          v-if="team.penalties != null"
          class="tie-card__pen"
        >{{ team.penalties }}</sup>
      </span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.tie-card {
  display: flex;
  flex-direction: column;
  background: $color-surface;
  border: 1px solid $color-border;
  border-radius: $radius-card-sm;
  overflow: hidden;
}

// Будущая пара, соперников ещё нет
.tie-card--projected {
  background: transparent;
  border-style: dashed;
  border-color: $color-border-strong;
}

.tie-card__team {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 0 10px;
  font-size: 13px;
  font-weight: 500;
  color: $color-text;

  & + & {
    border-top: 1px solid $color-border-soft;
  }

  &--win {
    font-weight: 700;
  }

  &--lose {
    color: $color-text-3;
  }

  &--tbd {
    color: $color-text-muted;
  }
}

.tie-card--projected .tie-card__team + .tie-card__team {
  border-top-style: dashed;
  border-top-color: $color-border;
}

.tie-card__badge {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  object-fit: contain;

  &--empty {
    border-radius: 50%;
    background: $color-badge-bg;
    border: 1px solid $color-border;
  }
}

.tie-card__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tie-card__legs {
  display: flex;
  flex-shrink: 0;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  color: $color-text-3;
  font-variant-numeric: tabular-nums;
}

.tie-card__leg {
  min-width: 7px;
  text-align: center;
}

.tie-card__score {
  flex-shrink: 0;
  font-family: $font-display;
  font-size: 13px;
  font-weight: 700;
  color: $color-accent-dark;
  font-variant-numeric: tabular-nums;
}

.tie-card__pen {
  margin-left: 1px;
  font-family: $font-text;
  font-size: 10px;
  font-weight: 600;
  color: $color-text-3;
}
</style>
