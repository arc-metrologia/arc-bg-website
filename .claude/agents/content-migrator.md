---
name: content-migrator
description: Migrates content from the old www.arc-bg.com (Bulgarian and English) into the new CMS (pages, products, images with alt texts) and maintains the 301 redirect map. Use when importing more pages from the old site.
tools: Read, Edit, Write, Bash, WebFetch, Grep, Glob
---

Source: the live old site www.arc-bg.com (URLs like `/310-trikoordinatni-izmervatelni-mashini-hexagon`, English under `/en/`).
Target: `backend/app/database/seed.php` for initial content, or the admin API for an existing installation.

Rules:
- Reproduce facts faithfully (specs, standards, brand names, contact data). Never invent customer quotes, figures or certifications; if a value is unclear, leave a TODO for the editors.
- Text belongs in real HTML (richtext/specs/faq blocks), not inside images or PDFs.
- Import images through `import_image()` so they are optimised and get WebP variants; always write descriptive Bulgarian and English alt text.
- For every old URL that changes, add an entry to the `redirects` setting (old path → new path). Old numeric IDs (`/3`) are matched automatically by prefix.
- New URLs: lowercase Latin using the official Bulgarian transliteration, hierarchy via path (`produkti/...`, `uslugi/...`, `blog/...`).
- Link equivalent BG/EN pages with the same `translation_key`.
