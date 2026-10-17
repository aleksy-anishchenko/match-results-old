<script setup lang="ts">
type DateRange = { from: string, to: string }

// Выбор живёт у страницы (в адресе), фильтр его только показывает и сообщает о нажатиях
const props = defineProps<{
  /** Выбранные даты (YYYY-MM-DD); null — выбран тур */
  range: DateRange | null
}>()

const emit = defineEmits<{
  round: []
  range: [DateRange]
}>()

const DAYS = [
  { label: 'Сегодня', offset: 0 },
  { label: 'Завтра', offset: 1 },
  { label: 'Вчера', offset: -1 },
] as const

const selectedRange = ref<Date[] | null>(null)
const popover = ref()

function getMoscowDateStr(offset: number): string {
  return getMoscowDate(new Date(Date.now() + offset * 24 * 60 * 60 * 1000))
}

function toDateStr(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Moscow today as a local Date object for the DatePicker defaultDate
const moscowTodayDate = computed(() => {
  const [year, month, day] = getMoscowDateStr(0).split('-').map(Number) as [number, number, number]
  return new Date(year, month - 1, day)
})

function isDay(offset: number): boolean {
  const date = getMoscowDateStr(offset)
  return props.range?.from === date && props.range.to === date
}

const isCustomRange = computed(() => props.range != null && !DAYS.some(day => isDay(day.offset)))

function selectDay(offset: number) {
  selectedRange.value = null
  const date = getMoscowDateStr(offset)
  emit('range', { from: date, to: date })
}

function selectRound() {
  selectedRange.value = null
  emit('round')
}

function toggleCalendar(event: Event) {
  popover.value.toggle(event)
}

watch(selectedRange, (range) => {
  if (!range || range.length < 2) return
  const [from, to] = range
  if (!from || !to) return
  const [start, end] = from.getTime() <= to.getTime() ? [from, to] : [to, from]
  popover.value.hide()
  emit('range', { from: toDateStr(start), to: toDateStr(end) })
})
</script>

<template>
  <div
    class="filter"
    role="group"
    aria-label="Тур или дни"
  >
    <button
      type="button"
      class="filter__pill"
      :class="{ 'filter__pill--active': !range }"
      :aria-pressed="!range"
      @click="selectRound"
    >
      Тур
    </button>
    <button
      v-for="day in DAYS"
      :key="day.offset"
      type="button"
      class="filter__pill"
      :class="{ 'filter__pill--active': isDay(day.offset) }"
      :aria-pressed="isDay(day.offset)"
      @click="selectDay(day.offset)"
    >
      {{ day.label }}
    </button>
    <button
      type="button"
      class="filter__pill filter__pill--icon"
      :class="{ 'filter__pill--active': isCustomRange }"
      :aria-pressed="isCustomRange"
      aria-label="Выбрать диапазон дат"
      @click="toggleCalendar($event)"
    >
      <i
        class="pi pi-calendar"
        aria-hidden="true"
      />
    </button>
    <Popover ref="popover">
      <DatePicker
        v-model="selectedRange"
        inline
        selection-mode="range"
        :default-date="moscowTodayDate"
      />
    </Popover>
  </div>
</template>

<style scoped lang="scss">
.filter {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;

  @media (min-width: $breakpoint-desktop) {
    gap: 8px;
  }
}

.filter__pill {
  @include pill-button;

  // На телефоне все пять кнопок должны уместиться в одну строку
  padding: 0 12px;

  @media (min-width: $breakpoint-desktop) {
    padding: 0 16px;
  }

  &--active {
    @include pill-button-active;
  }

  &--icon {
    width: 40px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
  }
}
</style>
