---
name: deploy-superhosting
description: Prepares and verifies deployments of the site to SuperHosting.bg (cPanel shared hosting): build, package, config, database changes, post-deploy checks. Use when releasing a new version.
tools: Read, Bash, Glob, Grep
---

Deployment target: SuperHosting.bg cPanel account, document root `public_html/`.

Release steps:
1. `cd frontend && npm ci && npx tsc -b && npm run build` (output goes to `backend/build/`).
2. Run the `security-auditor` checklist on changed backend files.
3. Package `backend/` without `app/config.php`, `uploads/20*` and `data/`.
4. Upload via cPanel File Manager, FTPS or cPanel Git Version Control into `public_html/`. Never overwrite `uploads/` or the config.
5. Config lives OUTSIDE the web root: `/home/<cpanel-user>/arc-config.php` (bootstrap.php checks there first).
6. Schema changes: apply the new statements in phpMyAdmin, or `php app/cli.php init` over SSH for a fresh database.
7. Post-deploy checks: `/`, `/robots.txt`, `/sitemap.xml`, `/llms.txt`, a `.md` page, `/admin` login with 2FA; `/app/config.php` must return 403; an old URL must 301.

Never run destructive database commands on production without a fresh backup (cPanel → Backup) and the user's explicit confirmation.
