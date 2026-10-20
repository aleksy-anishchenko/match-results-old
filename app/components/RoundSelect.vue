<script setup lang="ts">
import type { SeasonRound } from '~/types'

// Выбор живёт у страницы (в адресе): поле его только показывает и сообщает о выборе
const props = defineProps<{
  rounds: SeasonRound[]
  /** Выбранный тур; null — выбраны даты, поле пустое */
  selected: string | null
  /** Тур ближайшего матча: к нему список прокручен, когда выбраны даты */
  current: string | null
  /** Сегодня по Москве (YYYY-MM-DD) */
  today: string
}>()

const emit = defineEmits<{ select: [id: string] }>()

const dropdown = ref()

const selectedRound = computed(() => props.rounds.find(round => round.id === props.selected))

const datesOf = (round: SeasonRound) => round.from && round.to ? formatShortDates(round.from, round.to) : ''

// «Идёт» — только пока сегодня в днях тура: текущим тур бывает и во вторник, когда уже сыгран
const isLive = (round: SeasonRound) => !!round.from && !!round.to && round.from <= props.today && props.today <= round.to

const label = computed(() => selectedRound.value
  ? `Тур: ${[selectedRound.value.name, datesOf(selectedRound.value)].filter(Boolean).join(', ')}`
  : 'Выбрать тур')

// Повторное нажатие на выбранный тур Listbox считает снятием выбора (null): тогда просто закрываем
function select(id: string | null) {
  if (id) emit('select', id)
  dropdown.value.close()
}
</script>

<template>
  <FilterDropdown
    ref="dropdown"
    title="Тур"
    :label="label"
    :active="!!selectedRound"
    :panel-width="300"
  >
    <template #value>
      <template v-if="selectedRound">
        <span class="field-label">{{ selectedRound.name }}</span>
        <span
          v-if="datesOf(selectedRound)"
          class="field-hint"
        >{{ datesOf(selectedRound) }}</span>
      </template>
      <span
        v-else
        class="field-label"
      >Тур</span>
    </template>

    <template #default="{ sheet }">
      <Listbox
        :model-value="selected"
        :options="rounds"
        option-label="name"
        option-value="id"
        :scroll-height="sheet ? '60dvh' : '360px'"
        :pt="{ list: { autofocus: !sheet } }"
        class="field-list"
        aria-label="Туры"
        @update:model-value="select"
      >
        <template #option="{ option }">
          <span
            class="option__name"
            :class="{ 'option__name--selected': option.id === selected }"
            :data-scroll-into-view="option.id === (selected ?? current) || undefined"
          >{{ option.name }}</span>
          <span class="option__dates">{{ datesOf(option) }}</span>
          <span
            v-if="isLive(option)"
            class="option__live"
          >идёт</span>
          <svg
            v-if="option.id === selected"
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
      </Listbox>
    </template>
  </FilterDropdown>
</template>

<style scoped lang="scss">
// Ширина как у «10 тур»: даты встают ровным столбцом. Длинные названия плей-офф просто шире
.option__name {
  min-width: 58px;
  font-size: 15px;
  font-weight: 500;
}

.option__name--selected {
  font-weight: 700;
}

.option__dates {
  font-size: 13px;
  color: $color-text-3;
  white-space: nowrap;
}

.option__live {
  padding: 2px 8px;
  border-radius: $radius-pill;
  background: $color-live-soft;
  color: $color-live;
  font-size: 11px;
  font-weight: 700;
}

.option__check {
  flex-shrink: 0;
  margin-left: auto;
  color: $color-accent;
}
</style>
