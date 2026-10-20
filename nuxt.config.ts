import Aura from '@primeuix/themes/aura'
import { definePreset } from '@primeuix/themes'
import { resolve } from 'path'

// Тема PrimeVue с зелёным акцентом проекта вместо изумрудного по умолчанию.
// Шкала 50–950: от самого светлого оттенка к самому тёмному, 500 — основной цвет.
const MatchResultsPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#EEF6F1',
      100: '#DDF0E4',
      200: '#BFE0CC',
      300: '#9FC0B0',
      400: '#5E8C75',
      500: '#1F7A4D',
      600: '#1A6A43',
      700: '#155A39',
      800: '#13402D',
      900: '#0E3022',
      950: '#08201A',
    },
    // Нейтральные цвета (текст, рамки, фоны списков и календаря). У Aura они сине-серые (slate),
    // меняем на зеленовато-серые из макета: 0–700 совпадают с токенами в _variables.scss
    // (surface, surface-hover, border-soft, border, border-strong, text-muted, text-3, text-2, text).
    colorScheme: {
      light: {
        surface: {
          0: '#FFFFFF',
          50: '#F7FAF8',
          100: '#EDF2EF',
          200: '#DDE5E0',
          300: '#C9D4CE',
          400: '#8A948F',
          500: '#5B6660',
          600: '#47524C',
          700: '#1B2621',
          800: '#141C18',
          900: '#0E1411',
          950: '#080B09',
        },
      },
    },
  },
  // Панель, шторка, список и календарь живут только в полях над матчами (FilterDropdown): размеры
  // и цвета из макета. #F3F6F4 — фон страницы ($color-bg), наведение на строку в макете такое же
  components: {
    popover: {
      root: {
        borderColor: '{surface.200}',
        borderRadius: '16px',
        shadow: '0 12px 32px rgba(19, 64, 45, 0.14)',
        gutter: '6px',
      },
      content: { padding: '6px' },
    },
    drawer: {
      root: {
        borderColor: '{surface.200}',
        shadow: '0 -6px 20px rgba(19, 33, 27, 0.1)',
      },
      header: { padding: '4px 6px 6px 16px' },
      title: { fontSize: '17px', fontWeight: '700' },
      content: { padding: '0 10px 20px' },
    },
    listbox: {
      root: { background: 'transparent', borderColor: 'transparent', shadow: 'none', borderRadius: '0' },
      list: { padding: '0', gap: '0', header: { padding: '4px 4px 6px' } },
      option: {
        padding: '0 12px',
        borderRadius: '8px',
        color: '{surface.700}',
        focusColor: '{surface.700}',
        focusBackground: '#F3F6F4',
        selectedColor: '{surface.700}',
        selectedBackground: '{primary.100}',
        selectedFocusColor: '{surface.700}',
        selectedFocusBackground: '{primary.100}',
      },
      optionGroup: { padding: '10px 12px 4px', background: 'transparent', color: '{surface.500}', fontWeight: '700' },
      emptyMessage: { padding: '10px 12px' },
    },
    datepicker: {
      panel: { padding: '0', borderColor: 'transparent', shadow: 'none' },
      header: { padding: '4px 0', borderColor: 'transparent' },
      title: { fontWeight: '700' },
      selectMonth: { padding: '0' },
      dayView: { margin: '4px 0 0 0' },
      weekDay: { padding: '0 0 4px 0', fontWeight: '400', color: '{surface.500}' },
      date: {
        width: '100%',
        height: '36px',
        padding: '2px',
        borderRadius: '10px',
        color: '{surface.700}',
        hoverBackground: '#F3F6F4',
        selectedBackground: '{primary.500}',
        selectedColor: '#FFFFFF',
        rangeSelectedBackground: '{primary.100}',
        rangeSelectedColor: '{primary.800}',
      },
      // «Сегодня» по Москве рисует DateSelect, своя подсветка PrimeVue (по часам устройства) не нужна
      colorScheme: {
        light: {
          today: { background: 'transparent', color: '{surface.700}' },
        },
      },
    },
  },
})

export default defineNuxtConfig({
  modules: ['@primevue/nuxt-module', '@nuxt/eslint'],
  devtools: { enabled: true },
  css: ['~/assets/css/fonts.css', '~/assets/css/global.scss'],
  runtimeConfig: {
    theSportsDbApiKey: '',
  },
  compatibilityDate: '2025-07-15',
  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: (content: string, filepath: string) => {
            if (filepath.includes('_variables')) return content
            return `@use "${resolve('./app/assets/css/_variables')}" as *;\n${content}`
          },
        },
      },
    },
  },
  eslint: {
    config: {
      stylistic: true,
    },
  },
  primevue: {
    options: {
      theme: {
        preset: MatchResultsPreset,
        options: { darkModeSelector: false },
      },
      locale: {
        firstDayOfWeek: 1,
        dayNames: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
        dayNamesShort: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
        dayNamesMin: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
        monthNames: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
        monthNamesShort: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
        today: 'Сегодня',
        clear: 'Очистить',
        prevMonth: 'Предыдущий месяц',
        nextMonth: 'Следующий месяц',
        searchMessage: 'Найдено: {0}',
        emptySearchMessage: 'Ничего не нашли',
        selectionMessage: 'Выбрано: {0}',
        emptySelectionMessage: 'Ничего не выбрано',
        aria: { close: 'Закрыть' },
        fileSizeTypes: ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
      },
    },
  },
})
