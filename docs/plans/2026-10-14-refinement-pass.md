# Refinement Pass Plan

> **For Claude:** REQUIRED SUB-SKILL: Use godmode:task-runner to implement this plan task-by-task.

**Goal:** Every screen of CubePalm polished, consistent and checked at every size, with no behaviour regressions.

**Architecture:** Five agents work in parallel, each owning a disjoint set of files so no two edit the same file. A shared dev server on port 5173 serves all their browser checks. The coordinator integrates, fixes what the auditor reports, runs every suite, commits and pushes.

**Tech Stack:** React 19, Tailwind v4, three.js via react-three-fiber, Vitest, Playwright.

---

## Identity to keep (not up for redesign)

Dark background `#16171B`, panels `#1B1D22`/`#202227`; the six cube colours as the accent system (orange `#FF8A00`, green `#2FB36B`, blue `#5B8DEF`, white `#F4F5F8`, red `#F0566B`, yellow `#FFD500`); yellow is the primary action; right hand yellow, left hand blue `#4CC9F0`; Bricolage Grotesque for display, Atkinson Hyperlegible for text; rounded pills and tiles. Plain, direct English copy.

## Ownership

| Agent | Owns (may edit) | Scope |
|---|---|---|
| Home | `Home.tsx`, `CssCube.tsx`, `SignPlayground.tsx`, `SiteNav.tsx`, `Logo.tsx`, `index.css`, `index.html` | Landing page, nav, footer, global CSS and keyframes |
| Academy | `Academy.tsx`, `LessonPanel.tsx`, `core/academy/lessons.ts` (copy only) | Lesson list, lesson side panel, lesson flow |
| Pages | `Settings.tsx`, `Stats.tsx`, `Recorder.tsx`, `ErrorBoundary.tsx`, `App.tsx` (routes and the not-found page only) | Settings, stats, recorder, errors, unknown addresses |
| Play | `FreePlay.tsx`, everything in `screens/play/`, `HandsGuide.tsx`, `SolutionPlayer.tsx`, `MoveArrow.tsx`, `PuzzleCanvas.tsx` (visual parts only) | The play screen, guide, solution player, dialogs, touch pad |
| Auditor | new files under `tests/e2e/audit-*.spec.ts` only | Checks every page and flow at four sizes; reports, does not fix |

## Rules for every agent

- No change to behaviour that existing tests pin down unless the test is updated with a stated reason. `npx tsc -b`, `npm run lint` and the unit tests touching your files must pass.
- Quality floor: touch targets at least 44 px on touch screens, text contrast 4.5:1, visible keyboard focus, `prefers-reduced-motion` respected, no sideways scroll at 320, 390, 768 and 1280 px.
- Motion only where it shows what changed or answers an action; no decorative scroll reveals on every section.
- No git commits, pushes or deploys. No new dependencies.
- Screenshots go under `scratchpad/agents/<agent>/`.

## Integration (coordinator)

1. Review each agent's diff; reject anything off-identity or risky.
2. Fix every confirmed auditor finding.
3. `npx tsc -b`, `npm run lint`, `npx vitest run`, `npx playwright test` (all, including the layout test), Lighthouse on home and play.
4. Look at every page at four sizes.
5. Commit by area and push.
