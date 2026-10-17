import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    projects: [
      // Чистые функции (shared/utils, server/utils): Nuxt не нужен, импорты явные из #shared/...
      {
        resolve: {
          alias: {
            '~': resolve(import.meta.dirname, 'app'),
            '#shared': resolve(import.meta.dirname, 'shared'),
          },
        },
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
          globals: true,
          typecheck: {
            tsconfig: './tsconfig.test.json',
          },
        },
      },
      // Компоненты и страницы: окружение Nuxt, работают авто-импорты, useFetch, роутер
      await defineVitestProject({
        test: {
          name: 'nuxt',
          include: ['tests/nuxt/**/*.test.ts'],
          environment: 'nuxt',
        },
      }),
    ],
  },
})
