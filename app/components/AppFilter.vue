<script setup lang="ts">
type Mode = 'yesterday' | 'today' | 'tomorrow' | 'custom'

const emit = defineEmits<{
  change: [{ from: string, to: string }]
}>()

const activeMode = ref<Mode>('today')
const selectedRange = ref<Date[] | null>(null)
const popover = ref()

const modeLabels: Record<Exclude<Mode, 'custom'>, string> = {
  today: 'Сегодня',
  tomorrow: 'Завтра',
  yesterday: 'Вчера',
}

const offsets: Record<Exclude<Mode, 'custom'>, number> = {
  yesterday: -1,
  today: 0,
  tomorrow: 1,
}

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

function selectDay(mode: Exclude<Mode, 'custom'>) {
  activeMode.value = mode
  selectedRange.value = null
  const dateStr = getMoscowDateStr(offsets[mode])
  emit('change', { from: dateStr, to: dateStr })
}

function toggleCalendar(event: Event) {
  popover.value.toggle(event)
}

watch(selectedRange, (range) => {
  if (!range || range.length < 2) return
  const [from, to] = range
  if (!from || !to) return
  const [start, end] = from.getTime() <= to.getTime() ? [from, to] : [to, from]
  activeMode.value = 'custom'
  popover.value.hide()
  emit('change', { from: toDateStr(start), to: toDateStr(end) })
})
</script>

<template>
  <div
    class="filter"
    role="group"
    aria-label="Выбор дня"
  >
    <button
      v-for="mode in (['today', 'tomorrow', 'yesterday'] as const)"
      :key="mode"
      type="button"
      class="filter__pill"
      :class="{ 'filter__pill--active': activeMode === mode }"
      @click="selectDay(mode)"
    >
      {{ modeLabels[mode] }}
    </button>
    <button
      type="button"
      class="filter__pill filter__pill--icon"
      :class="{ 'filter__pill--active': activeMode === 'custom' }"
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
  gap: 8px;
  align-items: center;
  margin-bottom: 16px;
}

.filter__pill {
  @include pill-button;

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

@media (min-width: $breakpoint-desktop) {
  .filter {
    margin-bottom: 24px;
  }
}
</style>
