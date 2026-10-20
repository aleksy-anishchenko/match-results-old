<script setup lang="ts">
// Поле над списком матчей: кнопка и панель с выбором. На десктопе панель всплывает под кнопкой
// (PrimeVue Popover), на телефоне выезжает шторкой снизу (PrimeVue Drawer). Содержимое одно и то же:
// его даёт слот по умолчанию, в слоте есть close() и sheet — открыто ли шторкой.
// Что показать в самой кнопке, даёт слот value (классы field-label, field-hint, field-icon).
withDefaults(defineProps<{
  /** Заголовок шторки */
  title: string
  /** Подпись кнопки для экранного диктора: «Тур: 5 тур, 18–20 сен» */
  label: string
  /** Выбрано значение — поле залито зелёным */
  active?: boolean
  /** Что откроется: список (listbox) или панель с календарём (dialog) */
  popup?: 'listbox' | 'dialog'
  /** Ширина панели на десктопе, px */
  panelWidth: number
}>(), { active: false, popup: 'listbox' })

const emit = defineEmits<{ hide: [] }>()

// Тот же брейкпоинт, что $breakpoint-desktop в _variables.scss
const DESKTOP_QUERY = '(min-width: 640px)'

const button = ref<HTMLButtonElement>()
const popover = ref()
const popoverBody = ref<HTMLElement>()
const sheetBody = ref<HTMLElement>()
const popoverOpen = ref(false)
const sheetOpen = ref(false)
const isOpen = computed(() => popoverOpen.value || sheetOpen.value)

// Телефон или десктоп, решаем в момент нажатия: при отрисовке на сервере размера экрана нет
function toggle(event: MouseEvent) {
  if (window.matchMedia(DESKTOP_QUERY).matches) popover.value.toggle(event)
  else sheetOpen.value = true
}

function close() {
  popover.value?.hide()
  sheetOpen.value = false
}

// Длинный список (туры) открываем на выбранном пункте: его помечает data-scroll-into-view.
// Прокручиваем только сам список: scrollIntoView сдвинул бы ещё и страницу под панелью
function scrollToMarked(body?: HTMLElement) {
  nextTick(() => {
    const target = body?.querySelector('[data-scroll-into-view]')
    const list = target?.closest('.p-listbox-list-container')
    if (!target || !list) return
    const item = target.getBoundingClientRect()
    const box = list.getBoundingClientRect()
    list.scrollTop += item.top - box.top - (box.height - item.height) / 2
  })
}

function onPopoverShow() {
  popoverOpen.value = true
  scrollToMarked(popoverBody.value)
}

// Фокус из закрывающейся панели возвращается на кнопку: иначе панель исчезнет вместе с ним
// и с клавиатуры придётся начинать с начала страницы. Если нажали на другую кнопку — фокус остаётся там
function onHide() {
  popoverOpen.value = false
  emit('hide')
  const active = document.activeElement
  if (!active || active === document.body || active.closest('.field-popover, .field-sheet')) button.value?.focus()
}

defineExpose({ close })
</script>

<template>
  <div
    class="field"
    :class="{ 'field--active': active, 'field--open': isOpen }"
  >
    <button
      ref="button"
      type="button"
      class="field__button"
      :aria-label="label"
      :aria-haspopup="popup"
      :aria-expanded="isOpen"
      @click="toggle"
    >
      <span class="field__value">
        <slot name="value" />
      </span>
      <svg
        class="field__chevron"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        aria-hidden="true"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>

    <Popover
      ref="popover"
      class="field-popover"
      :style="{ width: `${panelWidth}px` }"
      @show="onPopoverShow"
      @hide="onHide"
    >
      <div ref="popoverBody">
        <slot
          :close="close"
          :sheet="false"
        />
      </div>
    </Popover>

    <!-- block-scroll: пока шторка открыта, страница под ней не прокручивается -->
    <Drawer
      v-model:visible="sheetOpen"
      position="bottom"
      block-scroll
      class="field-sheet"
      :header="title"
      @show="scrollToMarked(sheetBody)"
      @hide="onHide"
    >
      <div ref="sheetBody">
        <slot
          :close="close"
          :sheet="true"
        />
      </div>
    </Drawer>
  </div>
</template>

<style scoped lang="scss">
.field {
  min-width: 0;
}

.field__button {
  width: 100%;
  height: $field-height;
  padding: 0 12px 0 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border: 1px solid $color-border-strong;
  border-radius: $radius-field;
  background: $color-surface;
  color: $color-text;
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s, box-shadow 0.15s;

  // Наведение только там, где есть мышь: на телефоне «зависшая» рамка после нажатия выглядит как ошибка
  @media (hover: hover) {
    &:hover {
      border-color: $color-text-muted;
    }
  }

  &:focus-visible {
    outline: 2px solid $color-accent;
    outline-offset: 2px;
  }
}

.field__value {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.field__chevron {
  flex-shrink: 0;
  color: $color-text-3;
  transition: transform 0.15s;
}

.field--active {
  .field__button {
    background: $color-accent-soft;
    border-color: $color-accent-border;
    color: $color-accent-dark;

    @media (hover: hover) {
      &:hover {
        border-color: $color-accent;
      }
    }
  }

  .field__chevron {
    color: $color-accent;
  }
}

// Открыто: зелёная рамка и светлое кольцо вокруг, стрелка смотрит вверх
.field--open {
  .field__button,
  .field__button:hover {
    border-color: $color-accent;
    box-shadow: 0 0 0 3px $color-accent-soft;
  }

  .field__chevron {
    color: $color-accent;
    transform: rotate(180deg);
  }
}

// Содержимое кнопки приходит из слота: стили для него через :slotted
:slotted(.field-label) {
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.field--active :slotted(.field-label) {
  font-weight: 700;
}

// На узком экране сжимаются даты («18–2…»), а название рядом с ними («10 тур») — нет.
// Слишком длинное название всё же обрежется: шире поля оно не станет
:slotted(.field-label:not(:last-child)) {
  flex-shrink: 0;
  max-width: 100%;
}

:slotted(.field-hint) {
  min-width: 0;
  font-size: 13px;
  color: $color-accent;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:slotted(.field-icon) {
  flex-shrink: 0;
  align-self: center;
  color: $color-text-3;
}

.field--active :slotted(.field-icon) {
  color: $color-accent;
}
</style>

<style lang="scss">
// Панель и шторка рендерятся в конец body (teleport): scoped-стили до них не дотягиваются.
// Цвета и отступы — в теме PrimeVue (nuxt.config.ts), здесь то, чего токенами не задать.

// Уголок-стрелку к кнопке PrimeVue рисует псевдоэлементами, в макете его нет
.field-popover::before,
.field-popover::after {
  display: none;
}

.field-sheet.p-drawer {
  height: auto;
  max-height: 85dvh;
  border-radius: 20px 20px 0 0;

  // Ручка сверху — только рисунок: смахивать шторку вниз PrimeVue не умеет
  &::before {
    content: '';
    flex-shrink: 0;
    align-self: center;
    width: 40px;
    height: 4px;
    margin-top: 8px;
    border-radius: 2px;
    background: $color-border-strong;
  }

  .p-drawer-close-button {
    width: 44px;
    height: 44px;
    color: $color-text-3;
  }

  .p-drawer-content {
    padding-bottom: calc(20px + env(safe-area-inset-bottom));
  }
}

// Список внутри панели (PrimeVue Listbox): строки по 44px, поиск с лупой слева, как в макете
.field-list {
  .p-listbox-option {
    min-height: 44px;
    gap: 10px;
  }

  .p-listbox-option-group {
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .p-listbox-empty-message,
  .field-list__hint {
    padding: 10px 12px 6px;
    font-size: 13px;
    color: $color-text-3;
  }

  .p-iconfield .p-inputicon {
    left: 12px;
    right: auto;
    color: $color-text-3;
  }

  .p-listbox-filter {
    height: 40px;
    padding-left: 36px;
    border-radius: $radius-card-sm;
    font-size: 14px;
  }
}
</style>
