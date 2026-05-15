# Session state — handoff note

> **For Claude on a new machine:** read this top-to-bottom, then await user input.
> This file is a per-session aid and will be deleted/rewritten as work proceeds.

## Where we are right now

- **Branch:** `ui-v1/step-8-action-menu-mutations` (Step 8 commits: spec + plan + amendment + implementation + review fixes)
- **HEAD:** `53d21be` — `fix(ui): label the tile "+ Add Course" to match the picker title`
- **UI v1 Steps 1–7** merged to main (origin/main published through Step 7). Step 8 is on this branch, about to merge.
- **Plan #1 (seed validation + loader)** fully merged to main.

## Project shape

```
src/ISUCourseManager.Web/src/
  App.tsx                            grid + plan state; SelectedPanel (actionMenu | slotPicker | aiPanel | addClass)
  App.module.css                     grid template + .noPanel modifier
  index.css                          palette tokens + body baseline
  data/
    types.ts                         all frontend types incl. CourseAction, SlotPickerTarget
    catalog.ts / flow.ts / student.ts / academicTerm.ts / department.ts / overlay.ts
    useAi.ts                         stubbed AI hook (Step 7)
    seed/  (three JSONs)
  components/                        15 components
    Step 2 chrome:  TopBar, Sidebar, MainHeader, Main, RightPanel, AiButton, AiMark, DesktopOnlyGate
    Step 3 plan:    CourseTile, SemRow, PlanView
    Step 4:         ActionMenu
    Step 5:         SlotPicker
    Step 7:         AiPanel
docs/
  superpowers/specs/   system + UI v1 + 2 addenda + Step 2–8 specs
  superpowers/plans/   Plan #1 done; Step 2–8 plans done; Plans #2/#3 not started
```

`data/index.ts` was **deleted** in Step 8 — the old module-level `PLAN` constant is gone.

## UI v1 — Step 8 (Action-Menu Mutations + Add Course) — what was just done

The app stopped being a static rendering and became interactive.

**Plan state lifted into `App.tsx`** — `studentCourses: StudentCourse[]` is now `useState` (seeded from `data/student.ts`); the plan rows are derived via `useMemo(() => buildOverlay(flow, studentCourses, catalogById), [studentCourses])`. Every mutation is a `setStudentCourses` call; the overlay recomputes; the tree re-renders. No persistence — a browser refresh resets to the seed.

**Action-menu mutations** — the 4 sub-UI-free `ActionMenu` cards now fire `onAction(CourseAction)`; `App.applyAction` mutates and closes the panel. Mark Completed / In Progress / Failed change `StudentCourse.status`; Remove drops the entry. Mutations key on **`courseId + academicTerm`** (a course can appear in two terms — retake or duplicate add). Move-to-term and Substitute cards stay intentionally inert.

**Status-color fix** — `CourseTile.tsx`: the department tint now applies only to `Planned` tiles, so a status change (green / yellow / red) is actually visible. Completed Sem 1 tiles now render green.

**Add Course** (folded into Step 8 during review) — a `+ Add Course` tile in every non-all-completed sem-row (`SemRow`). Clicking it opens `SlotPicker` in an "add to semester" mode. `SlotPicker` was generalized from a `tile: UnfilledTile` prop to a discriminated `target: SlotPickerTarget` (`slot` | `addToSem`). Its catalog course cards became a real mutation: `onPickCourse` → `App.addCourse` inserts a `StudentCourse { status: 'Planned', grade: null }` at the target term — this works in both the slot-fill and add-to-sem modes (the cards were no-op stubs through Steps 5–7).

The Step 8 spec has a `§10` amendment section documenting the Add Course feature and the color fix.

**Step 8 docs:**
- `docs/superpowers/specs/2026-05-15-ui-v1-step-8-action-menu-mutations-design.md`
- `docs/superpowers/plans/2026-05-15-ui-v1-step-8-action-menu-mutations.md`

## Known follow-ups (carry forward)

- **Move to future/earlier term + Substitute** — still no-op `ActionMenu` cards. Move needs a destination-semester picker; Substitute needs the slot picker as a course source.
- **SlotPicker stubs** — "Pull from a later semester" and "Apply selection" are still inert.
- **Duplicate-add** — adding a course already in the plan appends a second Planned tile (by design, no guard). Mutations are term-scoped, so a true same-term exact duplicate is the one residual ambiguity.
- **Real AI integration** — `useAi()` is fully stubbed. Real path per UI spec §11: server-mediated `/api/v1/ai/ask`. AI scope: only `slot` is wired; topbar / main-header / sem-row `✦` entry points are no-op.
- **Seed data sweep** — `isu-catalog.json` missing HDFS-2390, PHIL-2010; CYBE flow has only Sems 1/2/8. Memory: `project-seed-data-incomplete`.
- **DRY refactors** — `electiveLabel(slotType)` is duplicated in `CourseTile.tsx` + `SlotPicker.tsx` (was triplicated; AiPanel still has its own). `Section` sub-component duplicated in `ActionMenu.tsx` + `SlotPicker.tsx`.

## Open Step 9 directions (user has not picked yet)

1. **Move / Substitute mutations** — wire the remaining `ActionMenu` cards (Move needs a destination picker, Substitute reuses the slot picker).
2. **MSW + real `useAi()` wiring** — swap the stubbed hook for `fetch('/api/v1/ai/ask')` against a mock service worker.
3. **Real Anthropic integration** — server-side proxy; touches the .NET API.
4. **AI scope expansion** — wire the global / flow / semester `✦` entry points.
5. **Validation banner + tile flags** — surface cascade-engine output.
6. **Catalog / flow data sweep** — fills seed gaps.
7. **Test framework** — Vitest + RTL.
8. **DRY refactors** — extract `electiveLabel` + `Section` helpers.
9. **Something else.**

## Key context flags

- **Seed JSONs are intentionally incomplete.** Memory: `project-seed-data-incomplete`.
- **Single dev server reused across verification cycles** — memory: `feedback-dev-server-reuse`. Don't spawn a new `npm run dev`; rely on Vite HMR + browser refresh. Dev server runs at `http://localhost:5173`.
- **CSS approach is CSS Modules** + palette tokens as CSS custom properties in `src/index.css`.
- **Status color wins over dept tint for non-Planned tiles** (Step 8 decision S8-D12) — a status mutation must be visible.
- **Stack-on-its-own-branch per step.** Each step gets its own branch from main, merged before the next starts.
- **AI must be server-mediated** (UI spec §11) — never call Anthropic directly from the browser.
- **`eslint.config.js`** allows underscore-prefixed unused params/vars (`^_`).

## What NOT to do

- Don't start Plan #2 (EF persistence) or Plan #3 (cascade engine) — user is staying UI-first.
- Don't try to "fix" `ActualSeedFileTests.Catalog_passes_validation_with_no_errors` — intentional punch list.
- Don't auto-add missing courses/slots to the seed JSONs — deferred per project memory.
- Don't call Anthropic directly from the browser.
- Don't spawn a second dev server — reuse the running one.

## How to confirm the user is ready

When you start, **don't re-explain everything above** — assume they read this with you. Just confirm: "Reading session-state.md. Step 8 complete and merged. Which direction for Step 9?" and wait for their pick.
