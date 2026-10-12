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
