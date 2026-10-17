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
})

export default defineNuxtConfig({
  modules: ['@primevue/nuxt-module', '@nuxt/eslint'],
  devtools: { enabled: true },
  css: ['~/assets/css/fonts.css', '~/assets/css/global.scss', 'primeicons/primeicons.css'],
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
        fileSizeTypes: ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
      },
    },
  },
})
