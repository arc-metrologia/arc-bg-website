# ARC Metrologia website (www.arc-bg.com)

Company site for АРК Метрология ООД (metrology equipment: HEXAGON, TESA, Sylvac, TRIMOS; calibration, service, training). Bulgarian first, English second.

## Architecture
- `frontend/`: React 19 + Vite + TypeScript. `npm run build` writes to `backend/build/`.
- `backend/`: plain PHP 8.1+ (no Composer) + MySQL; deployed as-is into SuperHosting.bg `public_html/`.
  - `index.php`: single entry point. For each public URL it renders full HTML server-side (`app/lib/Render.php`) plus meta/JSON-LD (`app/lib/Seo.php`) into `build/index.html`, embeds the page data as `#__DATA__` JSON, and React takes over.
  - `app/api.php`: JSON API. `app/lib/Auth.php`: sessions, roles (admin/editor/author), mandatory TOTP 2FA.
  - Content = `pages` table rows with a `blocks` JSON array. Hierarchy is the path (`produkti/x` is a child of `produkti`). BG URLs `/path`, EN `/en/path`.
- Inline editing: logged-in editors get the lazy-loaded `frontend/src/edit/Editor.tsx` on top of the public page (`?edit` opens edit mode).

## Commands
- Local preview: `cd frontend && npm run build`, then `./dev/serve.sh` → http://localhost:8000 (needs PHP 8.3 from winget; uses SQLite at `data/dev.sqlite`).
- Frontend dev with HMR: run `./dev/serve.sh` and `cd frontend && npm run dev` (Vite proxies /api and /uploads to :8000).
- DB: `php app/cli.php init | seed | user <email> <name> <role> <password>` (run from `backend/`, with `-c ../dev/php.ini` locally).
- Checks: `cd frontend && npx tsc -b`; `php -l` on changed PHP files.

## Rules
- A block type lives in 5 places: `Blocks.tsx`, `Render.php`, `Sanitizer.php`, `Markdown.php`, `edit/blockDefs.ts`. Keep them in sync and use identical CSS classes in React and PHP.
- SQL must work on MySQL and SQLite. Schema changes go into both `app/database/schema.*.sql`.
- Never commit `backend/app/config.php`; production config lives at `/home/<user>/arc-config.php`.
- Use the project agents in `.claude/agents/` (frontend-designer, php-backend, seo-geo-specialist, security-auditor, content-migrator, deploy-superhosting) and the `frontend-design` skill for UI work.
