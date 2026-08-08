# Анонимные сообщения

Полноценный full-stack сервис анонимных сообщений без регистрации. Сообщение проходит серверную валидацию и sanitization, сохраняется в PostgreSQL через Prisma, а затем отправляется владельцу через Telegram Bot API. В проект также входит защищённая административная панель. Production-конфигурация рассчитана на один бесплатный Web Service и бесплатный Render Postgres без persistent disk.

## Возможности

- премиальный dark/glassmorphism интерфейс, адаптированный под телефон, планшет и desktop;
- отправка без имени, email, телефона, пароля или аккаунта;
- серверный cooldown: одно сообщение каждые 10 секунд одновременно по хешу IP и HttpOnly device-ID;
- persistent burst-rate-limit в базе, защита от brute force и блокировка источников;
- подписанный form-token, honeypot, проверка Origin, ограничение body до 4 КБ;
- Cloudflare Turnstile только после подозрительной активности;
- plain-text sanitization, XSS-защита и лимит 1000 Unicode-символов;
- хранение только HMAC-хеша IP; исходный IP используется в момент отправки Telegram и в БД не записывается;
- Telegram-уведомление с устройством, конкретной моделью (когда браузер её раскрывает), браузером, ОС, временем и IP;
- админка с просмотром, удалением, статистикой и блокировкой источника;
- nonce-based CSP, secure headers, строгая admin-сессия в HttpOnly cookie;
- SEO metadata, Open Graph image, favicon, `robots.txt` и `sitemap.xml`;
- unit/integration-тесты полного API-пути и production build.

## Стек

- Next.js 16 App Router, React 19, TypeScript strict;
- Tailwind CSS 4, Framer Motion, Lucide;
- Prisma 6 + PostgreSQL локально и в production;
- Zod, sanitize-html;
- Cloudflare Turnstile и Telegram Bot API;
- Vitest.

## Быстрый запуск

Требуется Node.js 20.9+ и PostgreSQL. SQLite больше не поддерживается: на Render Free файловая система эфемерна, а persistent disk недоступен.

```bash
npm install
```

Создайте локальный `.env` на основе шаблона:

```bash
cp .env.example .env
```

На Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Обязательно замените `IP_HASH_SECRET`, `FORM_TOKEN_SECRET`, `ADMIN_SESSION_SECRET` на три независимые случайные строки длиной не менее 32 символов и задайте сильный `ADMIN_PASSWORD`.

Примените миграцию и запустите приложение:

```bash
npm run db:migrate
npm run dev
```

- сайт: [http://localhost:3000](http://localhost:3000);
- вход в админку: [http://localhost:3000/admin/login](http://localhost:3000/admin/login).

`.env`, дампы и локальные файлы БД исключены из Git. В репозитории должен находиться только безопасный `.env.example`. Создайте локальную БД `anonymous_messages`, укажите её PostgreSQL URL в `DATABASE_URL`, затем выполните `npm run db:migrate`.

## Настройка Telegram

1. Откройте `@BotFather` в Telegram и создайте бота командой `/newbot`.
2. Скопируйте выданный Bot Token в `TELEGRAM_BOT_TOKEN`.
3. Напишите боту хотя бы одно сообщение или добавьте его в нужную группу.
4. Откройте в браузере `https://api.telegram.org/bot<ТОКЕН>/getUpdates` и найдите `message.chat.id` (для групп ID обычно отрицательный).
5. Запишите значение в `TELEGRAM_CHAT_ID`.
6. Для production установите `TELEGRAM_REQUIRED="true"`.

```env
TELEGRAM_BOT_TOKEN="123456789:AA..."
TELEGRAM_CHAT_ID="123456789"
TELEGRAM_REQUIRED="true"
```

Token и Chat ID читаются только серверным модулем `src/lib/telegram.ts`. Они не имеют префикса `NEXT_PUBLIC_`, не передаются React-компонентам и не попадают в browser bundle.

При временной ошибке Telegram сервер делает до трёх попыток. Статус доставки и безопасное описание ошибки сохраняются в БД и видны администратору. Если `TELEGRAM_REQUIRED=true`, API не сообщает об обычном успехе при недоступном Telegram, но уже сохранённое сообщение не теряется.

### Проверка Telegram без реального токена

`npm test` проверяет формат сообщения, HTML-экранирование и серверный путь до Telegram-модуля. Реальную доставку можно проверить только после добавления собственных `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID`: отправьте тестовое сообщение через главную страницу и убедитесь, что в админке его `telegramStatus` равен `delivered`.

## Конкретная модель телефона

Сервер запрашивает безопасные User-Agent Client Hints заголовком `Accept-CH` и определяет модель в таком порядке:

1. `Sec-CH-UA-Model` — наиболее точное значение в Chromium на Android;
2. модель из Android User-Agent, например `Pixel 9 Pro` или `SM-S938B`;
3. `Не раскрыта браузером`, если достоверных данных нет.

Apple Safari/iOS обычно не раскрывает конкретный номер модели iPhone. Сайт намеренно не применяет агрессивный fingerprinting и не выдумывает модель. На первом посещении Client Hints могут появиться только со следующего запроса; API-запрос формы обычно уже содержит их.

## Cloudflare Turnstile

Turnstile показывается не каждому посетителю, а только после подозрительного количества запросов. Создайте widget в Cloudflare Turnstile и заполните:

```env
NEXT_PUBLIC_TURNSTILE_SITE_KEY="0x4AAAA..."
TURNSTILE_SECRET_KEY="0x4AAAA..."
```

Site Key по устройству Turnstile публичный и может находиться во frontend. Secret Key используется только в `src/lib/turnstile.ts`. Если ключи не настроены, подозрительные запросы блокируются rate limiter вместо показа неработающей CAPTCHA.

## Переменные окружения

| Переменная | Назначение |
| --- | --- |
| `DATABASE_URL` | **обязательная** PostgreSQL connection string; в Render подключается из БД автоматически |
| `IP_HASH_SECRET` | **обязательная**, HMAC-соль; Blueprint генерирует |
| `FORM_TOKEN_SECRET` | **обязательная**, подпись form-token; Blueprint генерирует |
| `ADMIN_SESSION_SECRET` | **обязательная**, подпись admin-сессии; Blueprint генерирует |
| `ADMIN_PASSWORD` | **обязательная**, придумайте пароль админки (12+ символов) |
| `TELEGRAM_BOT_TOKEN` | **обязательная для уведомлений**, токен от BotFather |
| `TELEGRAM_CHAT_ID` | **обязательная для уведомлений**, ID получателя |
| `TELEGRAM_REQUIRED` | production `true`; локально можно `false` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | опциональная, публичный site key; задаётся парой с secret |
| `TURNSTILE_SECRET_KEY` | опциональная, серверный secret key |
| `NEXT_PUBLIC_SITE_URL` | опциональная; canonical URL, иначе используется `RENDER_EXTERNAL_URL` |
| `APP_TIMEZONE` | опциональная, по умолчанию `Europe/Moscow` |
| `TRUSTED_PROXY_COUNT` | для Render `1` |

## API

### `GET /api/form-token`

Устанавливает случайный HttpOnly device-ID и возвращает подписанный краткоживущий form-token:

```json
{
  "token": "...",
  "turnstileSiteKey": null
}
```

### `POST /api/messages`

```json
{
  "message": "Текст сообщения",
  "formToken": "...",
  "website": "",
  "turnstileToken": null
}
```

Успех:

```json
{
  "ok": true,
  "retryAfter": 10
}
```

Cooldown и burst-limit дополнительно возвращают HTTP `429` и заголовок `Retry-After`. Внутренние ошибки и stack trace клиенту не выдаются.

## Админка

URL админки отсутствует в публичной навигации. Доступ защищён:

- `ADMIN_PASSWORD`, сравниваемым constant-time;
- лимитом 5 неудачных попыток за 15 минут и блокировкой на 30 минут;
- подписанной сессией на 8 часов в `HttpOnly`, `Secure` (production), `SameSite=Strict` cookie;
- повторной авторизацией в DAL и каждом mutation API;
- Origin/CSRF-проверкой.

Блокировка источника охватывает связанные записи по IP hash и device hash. Сам исходный IP в админке не хранится и не показывается.

## Безопасность и приватность

- В БД сохраняются сообщение, время, HMAC-хеш IP, HMAC-хеш device-ID, User-Agent и разобранные технические данные.
- Исходный IP нужен для rate limit/Telegram, но не сохраняется.
- Device-ID — случайный серверный UUID, а не скрытый сбор аппаратных идентификаторов.
- React выводит сообщения как текст; перед БД HTML полностью удаляется.
- Все mutation endpoints требуют same-origin запрос.
- CSP использует уникальный nonce; Turnstile разрешён только в `script-src`, `connect-src` и `frame-src`.
- Request body ограничен до чтения и после фактического UTF-8 измерения.
- Секреты импортируются только модулями с `server-only`.

Rate limit хранится транзакционно в PostgreSQL и переживает перезапуск/засыпание Web Service. Для серьёзной публичной нагрузки дополнительно включите сетевую защиту: прикладной лимит не заменяет DDoS-защиту.

## Деплой на Render Free — пошагово

Проект содержит `render.yaml`: он создаёт один бесплатный Node Web Service и одну бесплатную PostgreSQL, связывает `DATABASE_URL`, выполняет `prisma migrate deploy` во время build и проверяет `/api/health`.

1. Загрузите проект в закрытый Git-репозиторий. Убедитесь, что `.env` не попал в Git.
2. В Render выберите **New → Blueprint**, подключите репозиторий и примените найденный `render.yaml`.
3. Blueprint создаст PostgreSQL `anonymous-messages-db` с планом Free. Если создаёте БД вручную: **New → PostgreSQL → Free**, затем откройте БД → **Connect** → скопируйте **Internal Database URL**. В Web Service добавьте его как `DATABASE_URL`. Internal URL работает внутри Render и предпочтительнее внешнего.
4. Перед созданием сервисов Render попросит значения с `sync: false`:
   - `ADMIN_PASSWORD` — придумайте уникальный пароль минимум из 12 символов;
   - `TELEGRAM_BOT_TOKEN` — токен от `@BotFather`;
   - `TELEGRAM_CHAT_ID` — ID личного чата или группы.
5. `IP_HASH_SECRET`, `FORM_TOKEN_SECRET`, `ADMIN_SESSION_SECRET` генерируются Blueprint автоматически (`generateValue`). Не копируйте их между переменными и не меняйте после запуска без необходимости.
6. `TELEGRAM_REQUIRED=true`, `APP_TIMEZONE=Europe/Moscow`, `TRUSTED_PROXY_COUNT=1` уже заданы Blueprint. Turnstile опционален: при необходимости добавьте обе переменные `NEXT_PUBLIC_TURNSTILE_SITE_KEY` и `TURNSTILE_SECRET_KEY`.
7. `PORT`, `NODE_ENV` и `RENDER_EXTERNAL_URL` задаёт Render. Не создавайте `PORT` вручную. Next.js `npm start` автоматически слушает `PORT`; `RENDER_EXTERNAL_URL` используется как fallback canonical URL.
8. После deploy откройте URL сервиса и `/api/health`. Для своего домена можно добавить `NEXT_PUBLIC_SITE_URL=https://ваш-домен` и redeploy.

### Как узнать Telegram Chat ID

Напишите боту сообщение, затем откройте в браузере `https://api.telegram.org/bot<ВАШ_ТОКЕН>/getUpdates`. Найдите `message.chat.id`; у группы ID обычно отрицательный. Не публикуйте токен и не вставляйте его в Git.

### Ограничения бесплатного тарифа

- файловая система Web Service эфемерна, persistent disk отсутствует — поэтому production использует только PostgreSQL;
- Web Service засыпает после 15 минут без запросов, первый запрос после сна будет медленнее;
- бесплатные сервисы делят 750 часов в месяц на workspace;
- бесплатная PostgreSQL: 1 ГБ, без резервных копий и истекает через 30 дней. До истечения создайте новую БД/перенесите нужные данные или перейдите на подходящий план;
- health check проверяет и приложение, и доступность БД, но не используется для искусственного предотвращения сна.

Production-команды из Blueprint:

```bash
npm ci && npm run build:render
npm start
```

## Проверки

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm audit
```

Тесты покрывают:

- удаление HTML/script и Unicode-лимит;
- подпись, device binding и возраст form-token;
- точную Android-модель из Client Hints и UA fallback;
- безопасный Telegram HTML с моделью устройства;
- интеграционный `POST /api/messages`, запись в тестовую PostgreSQL и серверный `429` на повторную отправку.

## Структура

```text
src/app/api/messages/route.ts       основной API
src/lib/rate-limit.ts               persistent rate limit и cooldown
src/lib/telegram.ts                 Telegram Bot API
src/lib/device.ts                   устройство, модель, браузер и ОС
src/lib/auth.ts                     admin auth и brute-force limit
src/lib/admin-data.ts               защищённый DAL админки
prisma/schema.prisma                модели данных
prisma/migrations/                  SQL-миграции
```
