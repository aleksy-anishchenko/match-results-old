# match-results-old

Старая версия сайта с результатами футбольных матчей на Nuxt 4, данные из API-Football. Поддерживается в рабочем состоянии, пока пишется новая версия на React в отдельном проекте `match-results`.

## Требования

- Node 24.15 или новее. `nvm use` подхватит версию из `.nvmrc`.
- Ключ API-Football на платном тарифе: на бесплатном текущий сезон закрыт, и сайт будет пустым.

## Запуск

```bash
cp .env.example .env   # вписать ключ в NUXT_API_FOOTBALL_KEY
npm ci
npm run dev            # http://localhost:3000
```

## Проверки и сборка

```bash
npm run check    # lint + typecheck + тесты, то же запускает pre-commit хук и CI
npm run build    # production-сборка в .output
npm run preview  # локальный просмотр сборки
```

## Деплой

Push в `main` запускает GitHub Actions: проверки, сборка и выкладка `.output` на VPS через rsync с перезапуском через pm2.
