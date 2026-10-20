<script setup lang="ts">
import type { CompetitionWithBadge } from '~/types'

const { selectedId, competition } = useCompetition()

const { data: competitionsData } = await useFetch<{ competitions: CompetitionWithBadge[] }>('/api/competitions')

const badgeById = computed(() => {
  const map: Record<string, string> = {}
  for (const item of competitionsData.value?.competitions ?? []) {
    if (item.badge) map[item.id] = getBadgeUrl(item.badge)
  }
  return map
})

const groups = COMPETITION_CATEGORIES
  .map(category => ({ label: category, items: COMPETITIONS.filter(item => item.category === category) }))
  .filter(group => group.items.length)

// Пока ищут, группы не нужны: всё найденное — одним списком «Найдено»
const search = ref('')
const options = computed(() => search.value ? [{ label: 'Найдено', items: COMPETITIONS }] : groups)

const dropdown = ref()

// Повторное нажатие на выбранную лигу Listbox считает снятием выбора (null): тогда просто закрываем
function select(id: string | null) {
  if (id) selectedId.value = id
  dropdown.value.close()
}

// Белые логотипы (ЛЧ, ЛЕ) на белом не видны, подкладываем самый тёмный цвет палитры
const isWhiteBadge = (id: string) => getCompetition(id)?.whiteBadge ?? false
</script>

<template>
  <FilterDropdown
    ref="dropdown"
    class="league"
    title="Лига"
    :label="`Лига: ${competition.name}`"
    :panel-width="320"
    @hide="search = ''"
  >
    <template #value>
      <img
        v-if="badgeById[competition.id]"
        :src="badgeById[competition.id]"
        class="field-icon badge"
        :class="{ 'badge--bg': isWhiteBadge(competition.id) }"
        alt=""
      >
      <span class="field-label league__name">{{ competition.name }}</span>
    </template>

    <template #default="{ sheet }">
      <!-- На телефоне поиск сам не получает фокус: иначе сразу выскочит клавиатура и закроет список -->
      <Listbox
        :model-value="selectedId"
        :options="options"
        option-label="name"
        option-value="id"
        option-group-label="label"
        option-group-children="items"
        filter
        :filter-fields="['name', 'country']"
        filter-locale="ru"
        filter-placeholder="Найти лигу или страну"
        empty-filter-message="Ничего не нашли"
        :scroll-height="sheet ? '60dvh' : '440px'"
        :pt="sheet ? undefined : { pcFilter: { root: { autofocus: true } } }"
        class="field-list"
        aria-label="Лиги"
        @filter="search = $event.value"
        @update:model-value="select"
      >
        <template #option="{ option }">
          <img
            v-if="badgeById[option.id]"
            :src="badgeById[option.id]"
            class="badge badge--option"
            :class="{ 'badge--bg': isWhiteBadge(option.id) }"
            alt=""
          >
          <span
            v-else
            class="badge badge--option"
          />
          <span
            class="option__name"
            :class="{ 'option__name--selected': option.id === selectedId }"
          >{{ option.name }}</span>
          <span class="option__country">{{ option.country }}</span>
          <svg
            v-if="option.id === selectedId"
            class="option__check"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.4"
            aria-hidden="true"
          >
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </template>
        <template #footer>
          <p
            v-if="search"
            class="field-list__hint"
          >
            Ищем по названию лиги и стране
          </p>
        </template>
      </Listbox>
    </template>
  </FilterDropdown>
</template>

<style scoped lang="scss">
// Длинное название («Саудовская Про-лига») сжимается и обрезается многоточием
.league {
  flex: 0 1 auto;
}

.league :deep(.field__button) {
  padding-left: 10px;
}

.badge {
  width: 22px;
  height: 22px;
  object-fit: contain;
  flex-shrink: 0;
}

.badge--option {
  width: 24px;
  height: 24px;
}

.badge--bg {
  padding: 2px;
  border-radius: 6px;
  background: $color-text;
}

.league__name {
  font-weight: 700;
}

.option__name {
  font-size: 15px;
  font-weight: 500;
}

.option__name--selected {
  font-weight: 700;
}

.option__country {
  font-size: 13px;
  color: $color-text-3;
}

.option__check {
  flex-shrink: 0;
  margin-left: auto;
  color: $color-accent;
}
</style>
