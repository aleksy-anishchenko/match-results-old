<script setup lang="ts">
import type { DateRange } from '~/types'

// Выбор живёт у страницы (в адресе): поле его только показывает и сообщает о выборе
const props = defineProps<{
  /** Выбранные дни; null — выбран тур, поле пустое */
  range: DateRange | null
  /** Дни сезона с матчами; пусто — сезона нет в API, тогда доступен любой день */
  matchDays: string[]
  /** Сегодня по Москве (YYYY-MM-DD) */
  today: string
}>()

const emit = defineEmits<{ select: [range: DateRange] }>()

const dropdown = ref()

// DatePicker работает с датами в поясе устройства, а дни у нас по Москве строками YYYY-MM-DD.
// Переводим «число в число»: 20 сентября по Москве — 20 сентября в календаре, в каком бы поясе ни был телефон
function toPickerDate(day: string): Date {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number]
  return new Date(year, month - 1, date)
}

function toDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const monthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1)

const matchDaySet = computed(() => new Set(props.matchDays))
const hasMatches = (day: string) => !props.matchDays.length || matchDaySet.value.has(day)

const description = computed(() => props.range ? describeDates(props.range, props.today) : null)

const label = computed(() => description.value
  ? `Дата: ${[description.value.label, description.value.hint].filter(Boolean).join(' ')}`
  : 'Выбрать дату')

const quickDays = computed(() => NEAR_DAYS.map(({ offset, label }) => {
  const day = shiftDate(props.today, offset)
  return {
    label,
    day,
    disabled: !hasMatches(day),
    selected: props.range?.from === day && props.range.to === day,
  }
}))

// Календарь — только месяцы сезона: от первого месяца с матчами до последнего
const season = computed(() => {
  const first = props.matchDays[0]
  const last = props.matchDays.at(-1)
  if (!first || !last) return null
  const lastDate = toPickerDate(last)
  return { min: monthStart(toPickerDate(first)), max: new Date(lastDate.getFullYear(), lastDate.getMonth() + 1, 0) }
})

// Дни сезона без матчей нажать нельзя
const disabledDates = computed(() => {
  if (!season.value) return undefined
  const dates: Date[] = []
  for (const date = new Date(season.value.min); date <= season.value.max; date.setDate(date.getDate() + 1)) {
    if (!matchDaySet.value.has(toDay(date))) dates.push(new Date(date))
  }
  return dates
})

// Без выбранных дней календарь открывается на сегодня, а между сезонами — на ближайшем краю сезона
const defaultDate = computed(() => {
  const today = toPickerDate(props.today)
  if (!season.value) return today
  if (today < season.value.min) return season.value.min
  if (today > season.value.max) return monthStart(season.value.max)
  return today
})

// Выбор в календаре. Диапазон — два нажатия: [начало, null], потом [начало, конец]
const rangeAsDates = (range: DateRange | null) => range ? [toPickerDate(range.from), toPickerDate(range.to)] : null
const picked = ref<Array<Date | null> | null>(rangeAsDates(props.range))

// Какой месяц открыт: на краях сезона стрелки неактивны. Календарь при каждом открытии
// показывает месяц выбранных дней или сегодняшний — с него и начинаем считать
const openingMonth = () => monthStart(picked.value?.[0] ?? defaultDate.value)
const viewMonth = ref(openingMonth())

watch(() => props.range, (range) => {
  picked.value = rangeAsDates(range)
  viewMonth.value = openingMonth()
})

const pendingStart = computed(() => {
  const [start, end] = picked.value ?? []
  return start && !end ? start : null
})

const calendarPt = computed(() => ({
  // Название месяца и год PrimeVue делает кнопками выбора месяца и года, в макете это просто заголовок
  selectMonth: { disabled: true },
  selectYear: { disabled: true },
  pcPrevButton: { root: { disabled: !!season.value && viewMonth.value <= season.value.min } },
  pcNextButton: { root: { disabled: !!season.value && viewMonth.value >= monthStart(season.value.max) } },
}))

function isToday(date: { day: number, month: number, year: number }) {
  return toDay(new Date(date.year, date.month, date.day)) === props.today
}

function dayHasMatches(date: { day: number, month: number, year: number }) {
  return props.matchDays.length > 0 && matchDaySet.value.has(toDay(new Date(date.year, date.month, date.day)))
}

function selectQuick(day: string) {
  picked.value = rangeAsDates({ from: day, to: day })
  emit('select', { from: day, to: day })
  dropdown.value.close()
}

function onPick(value: Date | Date[] | Array<Date | null> | null | undefined) {
  picked.value = Array.isArray(value) ? value : null
  const [start, end] = picked.value ?? []
  if (!start || !end) return
  emit('select', { from: toDay(start), to: toDay(end) })
  dropdown.value.close()
}

// Нажали один день и закрыли — смотрим этот день. Пролистанный месяц забываем:
// при следующем открытии календарь снова начнётся с месяца выбора
function onHide() {
  if (pendingStart.value) {
    const day = toDay(pendingStart.value)
    picked.value = rangeAsDates({ from: day, to: day })
    emit('select', { from: day, to: day })
  }
  viewMonth.value = openingMonth()
}
</script>

<template>
  <FilterDropdown
    ref="dropdown"
    title="Дата"
    :label="label"
    :active="!!range"
    popup="dialog"
    :panel-width="282"
    @hide="onHide"
  >
    <template #value>
      <svg
        class="field-icon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        aria-hidden="true"
      >
        <rect
          x="3"
          y="5"
          width="18"
          height="16"
          rx="3"
        />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
      <template v-if="description">
        <span class="field-label">{{ description.label }}</span>
        <span
          v-if="description.hint"
          class="field-hint"
        >{{ description.hint }}</span>
      </template>
      <span
        v-else
        class="field-label"
      >Дата</span>
    </template>

    <div class="panel">
      <div
        class="quick"
        role="group"
        aria-label="Быстрый выбор"
      >
        <button
          v-for="quickDay in quickDays"
          :key="quickDay.day"
          type="button"
          class="quick__day"
          :class="{ 'quick__day--selected': quickDay.selected }"
          :disabled="quickDay.disabled"
          :aria-pressed="quickDay.selected"
          @click="selectQuick(quickDay.day)"
        >
          <span class="quick__label">{{ quickDay.label }}</span>
          <span class="quick__date">{{ quickDay.disabled ? 'нет матчей' : formatShortDate(quickDay.day) }}</span>
        </button>
      </div>

      <DatePicker
        :model-value="picked"
        inline
        selection-mode="range"
        :manual-input="false"
        :show-other-months="false"
        :default-date="defaultDate"
        :min-date="season?.min"
        :max-date="season?.max"
        :disabled-dates="disabledDates"
        :pt="calendarPt"
        class="calendar"
        @update:model-value="onPick"
        @month-change="viewMonth = new Date($event.year, $event.month - 1, 1)"
      >
        <template #date="{ date }">
          <span
            class="calendar__day"
            :class="{ 'calendar__day--today': isToday(date) }"
          >
            {{ date.day }}
            <span
              class="calendar__dot"
              :class="{ 'calendar__dot--on': dayHasMatches(date) }"
            />
          </span>
        </template>
      </DatePicker>

      <p
        v-if="pendingStart"
        class="panel__hint"
      >
        Начало — {{ formatShortDate(toDay(pendingStart)) }}. Нажмите последний день или закройте: покажем один день
      </p>
      <div
        v-else
        class="legend"
      >
        <span
          v-if="matchDays.length"
          class="legend__item"
        >
          <span class="legend__dot" />есть матчи
        </span>
        <span class="legend__item">
          <span class="legend__today" />сегодня
        </span>
      </div>
    </div>
  </FilterDropdown>
</template>

<style scoped lang="scss">
.panel {
  display: flex;
  flex-direction: column;
}

.quick {
  display: flex;
  gap: 6px;
  padding: 4px 4px 8px;
  margin-bottom: 6px;
  border-bottom: 1px solid $color-border;
}

.quick__day {
  flex: 1 1 0;
  min-width: 0;
  height: 56px;
  padding: 0 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border: 1px solid $color-border;
  border-radius: $radius-card-sm;
  background: $color-surface;
  color: $color-text;
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s;

  @media (hover: hover) {
    &:hover:not(:disabled) {
      border-color: $color-text-muted;
    }
  }

  &:disabled {
    background: $color-bg;
    border-color: $color-border-soft;
    color: $color-text-muted;
    cursor: default;
  }
}

.quick__day--selected,
.quick__day--selected:hover {
  background: $color-accent-soft;
  border-color: $color-accent;
  color: $color-accent-dark;
}

.quick__label {
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
}

.quick__date {
  font-size: 11px;
  font-weight: 500;
  color: $color-text-3;
  white-space: nowrap;

  .quick__day--selected & {
    color: $color-accent;
  }

  .quick__day:disabled & {
    color: $color-text-muted;
  }
}

// Календарь PrimeVue: цвета и размеры дней — в теме (nuxt.config.ts), здесь раскладка и подписи
.calendar {
  width: 100%;

  :deep(.p-datepicker-panel) {
    width: 100%;
  }

  :deep(.p-datepicker-title) {
    font-size: 15px;
  }

  :deep(.p-datepicker-select-month),
  :deep(.p-datepicker-select-year) {
    color: $color-text;
  }

  :deep(.p-datepicker-prev-button),
  :deep(.p-datepicker-next-button) {
    width: 36px;
    height: 36px;
    border-radius: $radius-card-sm;
    color: $color-text;

    &:disabled {
      color: $color-text-disabled;
    }
  }

  :deep(.p-datepicker-weekday) {
    font-size: 12px;
  }

  :deep(.p-datepicker-day) {
    font-size: 14px;
    font-weight: 600;
  }

  :deep(.p-datepicker-day.p-disabled) {
    opacity: 1;
    color: $color-text-disabled;
    font-weight: 500;
  }

  :deep(.p-datepicker-day-selected) {
    font-weight: 700;
  }
}

.calendar__day {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  border-radius: inherit;
}

// «Сегодня» рисуем сами: PrimeVue считает его по часам устройства, а нам нужен день по Москве
.calendar__day--today {
  box-shadow: inset 0 0 0 1.5px $color-accent;
}

.calendar__dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
}

.calendar__dot--on {
  background: $color-accent;
}

.calendar :deep(.p-datepicker-day-selected) .calendar__dot--on {
  background: #fff;
}

.legend,
.panel__hint {
  padding: 2px 4px 4px;
  font-size: 12px;
  color: $color-text-3;
}

.legend {
  display: flex;
  gap: 16px;
}

.legend__item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend__dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: $color-accent;
}

.legend__today {
  width: 12px;
  height: 12px;
  border-radius: 4px;
  box-shadow: inset 0 0 0 1.5px $color-accent;
}
</style>
