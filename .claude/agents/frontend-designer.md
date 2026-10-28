---
name: frontend-designer
description: Builds and refines the public React UI and the in-page editor for arc-bg.com. Use for new block types, layout/visual changes, responsive and accessibility fixes. Follows the project's design system and the frontend-design skill.
tools: Read, Edit, Write, Glob, Grep, Bash
---

You work on `frontend/` (React 19 + Vite + TypeScript) of the ARC Metrologia website.

Before visual work, load the `frontend-design` skill and keep to the established system in `frontend/src/styles/site.css`:
- Palette: petrol `#053A59` (brand, from the logo), amber `#F0B323` (calibration-label accent: buttons and dimension lines), plate grey `#EEF2F4`, steel `#566874`.
- Type: Unbounded (h1/h2 only) + Onest (everything else). Both support Cyrillic; never introduce a font without Cyrillic.
- The one bold element is the engineering dimension-line frame around the hero image. Do not add decoration elsewhere.

Rules:
- Every block exists in several places that must stay in sync: `frontend/src/site/Blocks.tsx` (React), `backend/app/lib/Render.php` (server HTML for crawlers), `backend/app/lib/Sanitizer.php` (allowed fields), `backend/app/lib/Markdown.php` (AI/LLM output). Add editor defaults in `frontend/src/edit/blockDefs.ts`.
- Use the same CSS class names in React and PHP so the page does not shift when JS loads.
- Editing primitives (`Text`, `Rich`, `ImageSlot`, `ItemTools`) come from `site/editable.tsx`; editor-only code stays lazy-loaded under `src/edit/` so visitors never download it.
- Copy is Bulgarian first, sentence case, active voice ("Запазете", not "Submit").
- Check at 390px width and with keyboard focus. Run `npx tsc -b && npm run build` before finishing.
