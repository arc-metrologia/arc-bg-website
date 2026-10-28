# www.arc-bg.com — нов сайт на АРК Метрология

React фронтенд с вграден редактор и PHP/MySQL бекенд, предвиден за споделен хостинг SuperHosting.bg.

## Какво има

- **Редакция директно на страницата.** Влезлите редактори виждат лента „Редактирайте страницата“: текстовете се пишат на място, секциите се добавят, местят и трият, снимките се избират от медийната библиотека. Има чернови, публикуване и история на версиите с възстановяване.
- **Роли.** Администратор (всичко, вкл. потребители и дневник), редактор (цялото съдържание, медия, меню, публикуване), автор (статии в блога като чернови).
- **Задължителен двуфакторен вход (TOTP).** Google/Microsoft Authenticator, 1Password и др. При първия вход потребителят сканира QR код и получава 10 еднократни резервни кода. Опитите за вход са ограничени, сесиите изтичат след 2 часа неактивност, всяко действие се записва в дневник.
- **Блог** с форматиран текст, таблици, снимки, видео и връзки към свързани продукти и услуги.
- **Изображения**: качване с drag & drop, автоматично преоразмеряване и WebP варианти (480/960/1600 px), премахване на EXIF/GPS метаданни, alt текст на BG и EN с напомняне, когато липсва.
- **Видео**: YouTube/Vimeo (зарежда се чак при клик, страницата остава бърза) или качен MP4/WebM.
- **SEO и AI асистенти**:
  - пълен HTML от сървъра за всяка страница, без зависимост от JavaScript;
  - структурирани данни schema.org: фирма, продукт с техническите данни, услуга, статия, ЧЗВ, видео, навигационна пътека;
  - hreflang BG/EN, sitemap.xml със снимки, robots.txt, който изрично допуска AI търсачките;
  - `/llms.txt` и `/llms-full.txt`, Markdown версия на всяка страница (`/uslugi/kalibrirane.md`);
  - 301 пренасочвания от старите адреси на arc-bg.com.
- **Сравнител на машини** в админ панела. Адресът му се задава като `comparator_url` в конфигурацията на сървъра, не в кода.

## Локален преглед

Нужни: Node.js 20+ и PHP 8.3 (`winget install PHP.PHP.NTS.8.3`).

```bash
cd frontend && npm install && npm run build && cd ..
cp backend/app/config.sample.php backend/app/config.php   # попълнете app_key и SQLite пътя (виж коментарите)
cd backend
php -c ../dev/php.ini app/cli.php init
php -c ../dev/php.ini app/cli.php seed
php -c ../dev/php.ini app/cli.php user you@example.com "Вашето име" admin "дълга-парола-12+"
cd .. && ./dev/serve.sh            # http://localhost:8000, админ: /admin
```

За разработка с моментално презареждане: `./dev/serve.sh` в един терминал и `cd frontend && npm run dev` в друг (http://localhost:5173).

## Публикуване в SuperHosting.bg

1. **База данни.** cPanel → MySQL Databases: създайте база и потребител с всички права. В phpMyAdmin импортирайте `backend/app/database/schema.mysql.sql`.
2. **PHP.** cPanel → PHP Manager by SuperHosting: PHP 8.2 или по-нова, включени `gd`, `mbstring`, `pdo_mysql`, `openssl`, `fileinfo`. Лимитите за качване са в `backend/.user.ini`.
3. **Конфигурация.** Копирайте `backend/app/config.sample.php` като `/home/<cpanel-потребител>/arc-config.php` (извън `public_html`). Попълнете базата, `app_key` (`php -r "echo base64_encode(random_bytes(32));"`) и `setup_token` (поне 16 случайни знака).
4. **Файлове.** Изпълнете `npm run build` във `frontend/` и качете съдържанието на `backend/` в `public_html/` (File Manager, FTPS или cPanel → Git Version Control).
5. **Първи администратор.** Отворете `https://www.arc-bg.com/admin`, въведете setup токена и създайте акаунт. Веднага след това ще настроите 2FA. След като потребител вече съществува, setup формата спира да работи.
6. **Съдържание.** По SSH: `php app/cli.php seed` за началното съдържание. Без SSH: създайте страниците от админ панела.
7. **SSL.** cPanel → SSL/TLS (Let's Encrypt). `.htaccess` пренасочва към HTTPS и www.
8. **Проверка.** `/robots.txt`, `/sitemap.xml`, `/llms.txt`, вход с 2FA. `/app/config.php` трябва да върне 403, а стар адрес като `/3-kalibrirane-na-izmervatelni-mashini` трябва да пренасочи с 301.

## Структура

```
frontend/            React + Vite (билдът отива в backend/build)
  src/site/          публичен сайт и блокове
  src/edit/          редактор на място (зарежда се само за редактори)
  src/admin/         админ панел: вход, 2FA, съдържание, медия, потребители
backend/             това се качва в public_html
  index.php          входна точка: сървърен HTML, SEO, API, sitemap, llms.txt
  app/               PHP логика (недостъпна отвън)
  uploads/           качени файлове (без изпълнение на скриптове)
.claude/agents/      специализирани агенти за Claude Code
.claude/skills/      frontend-design и webapp-testing от anthropics/skills
```

## Агенти за Claude Code

`frontend-designer`, `php-backend`, `seo-geo-specialist`, `security-auditor`, `content-migrator`, `deploy-superhosting`. Описанията им са в `.claude/agents/`.
