<script setup lang="ts">
import type { MatchesResponse } from '~/types'

const { competition } = useCompetition()

const today = getMoscowDate(new Date())
const dateRange = ref({ from: today, to: today })

const { data, pending, error } = await useFetch<MatchesResponse>('/api/matches', {
  query: computed(() => ({
    leagueId: competition.value.id,
    dateFrom: dateRange.value.from,
    dateTo: dateRange.value.to,
  })),
})

const groupedMatches = computed(() =>
  groupMatchesByDate(data.value?.matches ?? []),
)
</script>

<template>
  <div>
    <AppFilter @change="dateRange = $event" />
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
      Не удалось загрузить матчи. Попробуйте обновить страницу.
    </p>
    <p
      v-else-if="!Object.keys(groupedMatches).length"
      class="status"
    >
      Матчей нет
    </p>
    <MatchList
      v-else
      :matches="groupedMatches"
      show-date
    />
  </div>
</template>

<style scoped lang="scss">
.status {
  padding: 24px 0;
  font-size: 14px;
  color: $color-text-3;
}
</style>
