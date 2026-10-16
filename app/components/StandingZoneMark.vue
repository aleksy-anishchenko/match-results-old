<script setup lang="ts">
import type { StandingZoneKind } from '~/types'

defineProps<{
  kind: StandingZoneKind | null
  /** bar — полоска у места в таблице, square — квадрат в легенде */
  variant: 'bar' | 'square'
}>()
</script>

<template>
  <span
    class="mark"
    :class="[`mark--${variant}`, kind && `mark--${kind}`]"
    aria-hidden="true"
  />
</template>

<style scoped lang="scss">
$zone-colors: (
  'tier1': $color-zone-tier1,
  'tier1-qual': $color-zone-tier1-qual,
  'tier2': $color-zone-tier2,
  'tier2-qual': $color-zone-tier2-qual,
  'tier3': $color-zone-tier3,
  'tier3-qual': $color-zone-tier3-qual,
  'qual': $color-zone-qual,
  'relegation-playoff': $color-zone-relegation-playoff,
  'relegation': $color-zone-relegation,
);

.mark {
  display: block;
  flex-shrink: 0;

  &--bar {
    width: 3px;
    height: 20px;
    border-radius: 2px;
  }

  &--square {
    width: 10px;
    height: 10px;
    border-radius: 3px;
  }
}

@each $kind, $color in $zone-colors {
  .mark--#{$kind} {
    background: $color;
  }
}
</style>
