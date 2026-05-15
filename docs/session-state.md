# Session state — handoff note

> **For Claude on a new machine:** read this top-to-bottom, then await user input.
> This file is a per-session aid and will be deleted/rewritten as work proceeds.

## Where we are right now

- **Branch:** `ui-v1/step-10-validation-ai-tests` (Step 10 commits: spec + plan + 9 implementation commits + 1 follow-up-fix commit)
- **HEAD:** `8b919a3` — `fix(ui): guard same-semester duplicates; add AI to the Add Course picker`
- **UI v1 Steps 1–9** merged to main (origin/main published through Step 9). Step 10 is on this branch, about to merge.
- **Plan #1 (seed validation + loader)** fully merged to main.

## Project shape

```
src/ISUCourseManager.Web/src/
  App.tsx                            grid + plan state; SelectedPanel (actionMenu | slotPicker | aiPanel | addClass | substitute); DndContext; validation memos
  data/
    types.ts                         all frontend types incl. PlanIssue is in validation.ts; AiScope (slot | semester); AiAskRequest/Response
    catalog.ts / flow.ts / student.ts / academicTerm.ts / department.ts / overlay.ts
    validation.ts (+ .test.ts)        pure validatePlan
    useAi.ts                          real async hook over fetch('/api/v1/ai/ask')
    seed/  (three JSONs)
  components/                        18 components
    Step 2 chrome:  TopBar, Sidebar, MainHeader, Main, RightPanel, AiButton, AiMark, DesktopOnlyGate
    Step 3 plan:    CourseTile, SemRow, PlanView
    Step 4:         ActionMenu
    Step 5:         SlotPicker
    Step 7:         AiPanel (+ .test.tsx, Step 10)
    Step 9:         DraggableCourseTile
    Step 10:        ValidationBanner
  mocks/                             MSW: handlers.ts, browser.ts, server.ts
  test/setup.ts                      Vitest setup (jest-dom + MSW server + RTL cleanup)
docs/
  superpowers/specs/   system + UI v1 + 2 addenda + Step 2–10 specs
  superpowers/plans/   Plan #1 done; Step 2–10 plans done; Plans #2/#3 not started
```

## UI v1 — Step 10 (Plan Validation + MSW AI Layer + Test Framework) — what was just done

Three bundled, independent parts.

**Plan validation** — new pure `data/validation.ts` `validatePlan(rows, requiredCredits, catalogById)` returns a `PlanValidation`: per-semester credit overload (>18) / underload (<12, excluding all-completed & 0-credit rows), term-availability issues (a non-Completed course whose `typicallyOffered` season excludes its semester's season), an unfilled-requirement count, a planned-credit total. `App` derives `validation` + a `flaggedKeys` set; `<ValidationBanner>` (between MainHeader and PlanView) renders the summary; `CourseTile` shows a `⚠` badge on flagged tiles. `Course` gained `typicallyOffered` and `DegreeFlow` gained `totalCreditsRequired` (newly surfaced from the seed JSON).

**MSW AI layer** — `useAi()` is now async over `POST /api/v1/ai/ask`, exposing `loading`/`error`/`retry`. `src/mocks/` is a Mock Service Worker backend returning canned `AiAskResponse`s; the worker starts in `main.tsx` in DEV. `AiPanel` shows loading / a "thinking" bubble / a retryable error.

**Test framework** — Vitest + RTL + jsdom. `validation.test.ts` (7 cases) and `AiPanel.test.tsx` (3 MSW-driven cases). `npm run test` runs them. 10 tests pass.

**Two follow-up fixes (commit `8b919a3`, found during verification):**
- **Same-semester duplicate guard** — `addCourse`/`moveCourse`/`substituteCourse` refuse to place a course into a semester that already holds it (cross-semester retakes still allowed). Fixes a duplicate-React-key bug that orphaned a ghost tile. Tile selection now keys on `courseId + academicTerm` (clicking one tile highlights only it). This reverses the Step 8 "duplicates allowed, no guard" decision for the same-semester case.
- **AI on the Add Course picker** — `AiScope` gained a `semester` variant; `AiPanel` takes a `scope` (slot or semester); the `✦` icon now shows in the "+ Add Course" picker and opens a semester-scoped AI panel. Substitute picker still has no AI.

**Step 10 docs:**
- `docs/superpowers/specs/2026-05-15-ui-v1-step-10-validation-msw-tests-design.md`
- `docs/superpowers/plans/2026-05-15-ui-v1-step-10-validation-msw-tests.md`

## Known follow-ups (carry forward)

- **AI is still MSW-mocked** — `/api/v1/ai/ask` returns canned content; no real Anthropic call. Real path per UI spec §11: a server-side proxy (touches the .NET API).
- **AI scope** — `slot` and `semester` are wired (slot picker + Add Course picker). The topbar / main-header / sem-row `✦` entry points are still no-op. Substitute picker has no AI.
- **SlotPicker stubs** — "Pull from a later semester" and "Apply selection" are still inert.
- **Prereq validation** — out of scope (the seed has `prereqs` trees but evaluating them is cascade-engine work).
- **Seed data sweep** — `isu-catalog.json` missing HDFS-2390, PHIL-2010; CYBE flow has only Sems 1/2/8. Memory: `project-seed-data-incomplete`.
- **DRY refactors** — `electiveLabel(slotType)` duplicated in `CourseTile.tsx` / `SlotPicker.tsx` / `AiPanel.tsx`. `Section` sub-component duplicated in `ActionMenu.tsx` + `SlotPicker.tsx`.
- **DnD scope** — only course-tile → semester-row move; no catalog-drag, no reordering.
- **`public/mockServiceWorker.js`** triggers one eslint warning (vendored generated file) — harmless; could add an eslint ignore for `public/`.

## Open Step 11 directions (user has not picked yet)

1. **Real Anthropic integration** — server-side proxy for `/api/v1/ai/ask`; touches the .NET API.
2. **AI scope expansion** — wire the topbar / flow / sem-row `✦` entry points.
3. **Validation depth** — prereq checking (needs the catalog prereq trees + evaluation), co-reqs, `minGrade`.
4. **DnD expansion** — drag catalog courses into the plan; reorder within a row.
5. **Catalog / flow data sweep** — fills seed gaps.
6. **More test coverage** — the framework exists; cover overlay, mutations, components.
7. **DRY refactors** — extract `electiveLabel` + `Section` helpers.
8. **Something else.**

## Key context flags

- **Seed JSONs are intentionally incomplete.** Memory: `project-seed-data-incomplete`.
- **Single dev server reused across verification cycles** — memory: `feedback-dev-server-reuse`. Don't spawn a new `npm run dev`. Dev server runs at `http://localhost:5173`.
- **CSS approach is CSS Modules** + palette tokens as CSS custom properties in `src/index.css`.
- **Status color wins over dept tint for non-Planned tiles** (Step 8 decision S8-D12).
- **Same-semester duplicates are now guarded** (Step 10); cross-semester duplicates (retakes) remain allowed; mutations key on `courseId + academicTerm`.
- **Stack-on-its-own-branch per step.** Each step gets its own branch from main, merged before the next starts.
- **Tests:** `npm --prefix src/ISUCourseManager.Web run test` (Vitest). `globals: false` — tests use explicit `vitest` imports; `test/setup.ts` calls RTL `cleanup()` explicitly.
- **AI must be server-mediated** (UI spec §11) — never call Anthropic directly from the browser.
- **`eslint.config.js`** allows underscore-prefixed unused params/vars (`^_`).

## What NOT to do

- Don't start Plan #2 (EF persistence) or Plan #3 (cascade engine) — user is staying UI-first.
- Don't try to "fix" `ActualSeedFileTests.Catalog_passes_validation_with_no_errors` — intentional punch list.
- Don't auto-add missing courses/slots to the seed JSONs — deferred per project memory.
- Don't call Anthropic directly from the browser.
- Don't spawn a second dev server — reuse the running one.

## How to confirm the user is ready

When you start, **don't re-explain everything above** — assume they read this with you. Just confirm: "Reading session-state.md. Step 10 complete and merged. Which direction for Step 11?" and wait for their pick.
