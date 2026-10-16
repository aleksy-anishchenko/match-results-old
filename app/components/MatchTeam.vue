<script setup lang="ts">
const props = defineProps<{
  name: string
  badge: string
  side: 'home' | 'away'
  /** Итог для этой команды в завершённом матче */
  result?: 'win' | 'lose' | null
  /** Матч не состоится: название приглушено */
  muted?: boolean
}>()

const badgeUrl = computed(() =>
  props.badge ? getBadgeUrl(props.badge) : '',
)

const localName = computed(() => getTeamName(props.name))
</script>

<template>
  <div
    class="team"
    :class="`team--${side}`"
  >
    <img
      v-if="badgeUrl"
      :src="badgeUrl"
      alt=""
      width="28"
      height="28"
      class="team__badge"
    >
    <span
      v-else
      class="team__badge team__badge--empty"
    />
    <span
      class="team__name"
      :class="{
        'team__name--win': result === 'win',
        'team__name--lose': result === 'lose',
        'team__name--muted': muted,
      }"
    >{{ localName }}</span>
  </div>
</template>

<style scoped lang="scss">
// На телефоне обёртка растворяется (display: contents), эмблема и название
// занимают свои ячейки в сетке строки матча. На десктопе это обычный flex.
.team {
  display: contents;
}

.team__badge {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  object-fit: contain;

  &--empty {
    border-radius: 50%;
    background: $color-badge-bg;
    border: 1px solid $color-border;
  }
}

.team__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 500;

  &--win {
    font-weight: 700;
  }

  &--lose {
    color: $color-text-3;
  }

  &--muted {
    color: $color-text-muted;
  }
}

.team--home {
  .team__badge {
    grid-area: hbadge;
  }

  .team__name {
    grid-area: hname;
  }
}

.team--away {
  .team__badge {
    grid-area: abadge;
  }

  .team__name {
    grid-area: aname;
  }
}

@media (min-width: $breakpoint-desktop) {
  .team {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .team--home {
    grid-area: home;
    flex-direction: row-reverse;
  }

  .team--away {
    grid-area: away;
  }

  .team__badge {
    width: 28px;
    height: 28px;
  }

  .team__name {
    font-size: 16px;
  }
}
</style>
