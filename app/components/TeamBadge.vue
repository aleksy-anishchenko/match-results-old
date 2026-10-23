<script setup lang="ts">
// Эмблема команды через наш прокси. Нет эмблемы (соперник ещё не определён или API её не прислал) — серый кружок.
// Размер на экране задаёт класс снаружи, size — атрибуты картинки: место под неё есть и до загрузки
defineProps<{
  badge: string
  size: number
}>()
</script>

<template>
  <img
    v-if="badge"
    :src="getBadgeUrl(badge)"
    alt=""
    :width="size"
    :height="size"
    class="team-badge"
  >
  <span
    v-else
    class="team-badge team-badge--empty"
  />
</template>

<style scoped lang="scss">
.team-badge {
  flex-shrink: 0;
  object-fit: contain;

  &--empty {
    border-radius: 50%;
    background: $color-badge-bg;
    border: 1px solid $color-border;
  }
}
</style>
