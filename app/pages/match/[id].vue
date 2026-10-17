<script setup lang="ts">
import type { MatchDetails } from '~/types'

const route = useRoute()

const { data: match, pending, error } = await useFetch<MatchDetails>(`/api/match/${route.params.id}`)

useHead({
  title: computed(() => match.value
    ? `${getTeamName(match.value.homeTeam)} – ${getTeamName(match.value.awayTeam)}`
    : 'Матч'),
})
</script>

<template>
  <div class="match-page">
    <NuxtLink
      to="/"
      class="back"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <path d="M15 6l-6 6 6 6" />
      </svg>
      Результаты
    </NuxtLink>

    <p
      v-if="pending"
      class="status"
    >
      Загрузка...
    </p>

    <p
      v-else-if="error"
      class="status"
    >
      {{ error.statusCode === 404 ? 'Матч не найден' : 'Не удалось загрузить матч. Попробуйте обновить страницу.' }}
    </p>

    <template v-else-if="match">
      <MatchHeader :match="match" />
      <MatchGoals
        v-if="match.goals.length"
        :goals="match.goals"
      />
    </template>
  </div>
</template>

<style scoped lang="scss">
.match-page {
  display: flex;
  flex-direction: column;
  gap: 16px;

  @media (min-width: $breakpoint-desktop) {
    gap: 24px;
  }
}

.back {
  display: flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  height: 40px;
  font-size: 15px;
  font-weight: 600;
  color: $color-text-2;
  transition: color 0.15s;

  &:hover {
    color: $color-accent;
  }
}

.status {
  padding: 24px 0;
  font-size: 14px;
  color: $color-text-3;
}
</style>
