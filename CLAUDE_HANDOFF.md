# MedExplain Build Handoff (for Claude)

## Context
I just implemented the MedExplain MVP homepage based on `MedExplain_System_Design.md` in this repo.

## What was completed
- Scaffolded a fresh Next.js app in `medexplain-hackathon/medexplain` using:
  - `npx create-next-app@latest medexplain --typescript --tailwind --app`
- Initialized `shadcn/ui` and added UI components:
  - `button`, `card`, `input`, `label`, `select`
- Built homepage MVP in `medexplain/app/page.tsx` with:
  - Hero section + positioning copy
  - File upload input (PDF/image support)
  - Language selector (English, Spanish, Hindi)
  - Selected file/language preview
  - Validation messages
  - Disabled CTA state when no file
  - Stubbed upload action state (`Uploading...`)
- Did a second UI polish pass:
  - Better typography and spacing
  - Gradient background and elevated card styling
  - Custom upload box (instead of default browser-looking form row)
  - Improved CTA styling and overall demo readiness

## Current behavior (verified)
- `npm run lint` passes
- `npm run build` passes
- `npm run dev` runs on `http://localhost:3000`
- Homepage interactions work (file select, language toggle, button states, validation)

## Known notes
- Next.js shows a non-blocking warning about multiple lockfiles (repo root + nested app lockfile).
- Backend/API integration is not wired yet (intentionally MVP frontend-only for this phase).

## File structure snapshot
```text
medexplain-hackathon/
?? .cursor/
?? .env
?? .git/
?? .gitignore
?? README.md
?? package.json
?? package-lock.json
?? test.js
?? node_modules/
?? medexplain/
   ?? app/
   ?  ?? favicon.ico
   ?  ?? globals.css
   ?  ?? layout.tsx
   ?  ?? page.tsx
   ?? components/
   ?  ?? ui/
   ?     ?? button.tsx
   ?     ?? card.tsx
   ?     ?? input.tsx
   ?     ?? label.tsx
   ?     ?? select.tsx
   ?? lib/
   ?  ?? utils.ts
   ?? public/
   ?  ?? file.svg
   ?  ?? globe.svg
   ?  ?? next.svg
   ?  ?? vercel.svg
   ?  ?? window.svg
   ?? components.json
   ?? next.config.ts
   ?? package.json
   ?? package-lock.json
   ?? postcss.config.mjs
   ?? tsconfig.json
   ?? eslint.config.mjs
```

## Ask Claude for next steps
Please propose the highest-impact next implementation steps for a hackathon demo, with specific file-level actions and order of execution.

Constraints:
- Keep current homepage UI and behavior intact.
- Build on top of Next.js App Router stack in `medexplain/`.
- Prioritize demo value and speed.

Please return:
1. A prioritized implementation plan (next 3-5 steps).
2. Exact APIs/routes to add first (request/response shapes).
3. Suggested data flow for:
   - upload bill -> parse text -> analyze with Claude -> render issues
4. A minimal but production-looking UI extension plan for:
   - analysis result cards
   - multilingual Q&A section
   - appeal letter generator section
5. Any critical risks and the fastest mitigation for each.
