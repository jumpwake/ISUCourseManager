# Session state — handoff note

> **For Claude on a new machine:** read this top-to-bottom, then await user input.
> This file is a per-session aid and will be deleted/rewritten as work proceeds.

## Where we are right now

- **Branch:** `ui-v1/step-9-action-menu-dnd` (Step 9 commits: spec + plan + 6 implementation commits + review fix)
- **HEAD:** `5fee184` — `perf(ui): memoize the semesters list passed to ActionMenu`
- **UI v1 Steps 1–8** merged to main (origin/main published through Step 8). Step 9 is on this branch, about to merge.
- **Plan #1 (seed validation + loader)** fully merged to main.

## Project shape

```
src/ISUCourseManager.Web/src/
  App.tsx                            grid + plan state; SelectedPanel (actionMenu | slotPicker | aiPanel | addClass | substitute); DndContext
  App.module.css                     grid template + .noPanel modifier
  index.css                          palette tokens + body baseline
  data/
    types.ts                         all frontend types incl. CourseAction, SlotPickerTarget (slot | addToSem | substitute)
    catalog.ts / flow.ts / student.ts / academicTerm.ts / department.ts / overlay.ts
    useAi.ts                         stubbed AI hook (Step 7)
    seed/  (three JSONs)
  components/                        16 components
    Step 2 chrome:  TopBar, Sidebar, MainHeader, Main, RightPanel, AiButton, AiMark, DesktopOnlyGate
    Step 3 plan:    CourseTile, SemRow, PlanView
    Step 4:         ActionMenu
    Step 5:         SlotPicker
    Step 7:         AiPanel
    Step 9:         DraggableCourseTile
docs/
  superpowers/specs/   system + UI v1 + 2 addenda + Step 2–9 specs
  superpowers/plans/   Plan #1 done; Step 2–9 plans done; Plans #2/#3 not started
```

## UI v1 — Step 9 (Finish the Action Menu + Drag-and-Drop) — what was just done

Every action-menu card is now functional, and the plan can be reshaped by dragging.

**Move to future/earlier term** — the two `ActionMenu` "Reschedule" cards. Clicking one swaps the action-menu body to an inline destination-semester list (internal `moveMode` state, `MoveView`); picking a semester fires `App.moveCourse`, which changes the course's `academicTerm`. The cards are disabled at the Sem 1 / Sem 8 edges (no valid destinations). `ActionCard` gained a `disabled` prop.

**Substitute another course** — opens `SlotPicker` in a new `substitute` target mode. `SlotPickerTarget` gained a third variant `{ kind: 'substitute'; classId; semIdx; academicTerm }`; the picker shows "Substitute a course" + a "Replacing: …" context line, no Leave-empty section, no Ask AI icon. Picking a catalog course fires `App.substituteCourse` (remove old + add new at the same term, `Planned`).

**Drag-and-drop move** — new dependency `@dnd-kit/core` (v6.3.1). `App` wraps the app in a `DndContext` with `MouseSensor` (8 px distance) + `TouchSensor` (200 ms delay) so a plain tap still opens the action menu. `CourseTile` is presentational with an optional `draggable` prop; new `DraggableCourseTile` wraps it with `useDraggable`. `SemRow` is a `useDroppable` drop zone (highlights on `isOver`). Dropping a non-Completed course tile on another semester row fires the same `moveCourse`. A `DragOverlay` renders the dragged tile. Completed tiles / placeholders / the `+ Add Course` tile are not draggable.

`moveCourse` and `substituteCourse` key on `courseId + academicTerm` (Step 8 convention).

**Step 9 docs:**
- `docs/superpowers/specs/2026-05-15-ui-v1-step-9-finish-action-menu-dnd-design.md`
- `docs/superpowers/plans/2026-05-15-ui-v1-step-9-finish-action-menu-dnd.md`

> **Verification note:** Step 9 was merged on build + lint + a final whole-branch code review. The manual browser pass (drag-and-drop, especially touch; Move/Substitute flows) was deferred — worth running.

## Known follow-ups (carry forward)

- **SlotPicker stubs** — "Pull from a later semester" and "Apply selection" are still inert.
- **Duplicate-add** — adding a course already in the plan appends a second Planned tile (by design, no guard); mutations are term-scoped, so a true same-term exact duplicate is the one residual ambiguity.
- **Real AI integration** — `useAi()` is fully stubbed. Real path per UI spec §11: server-mediated `/api/v1/ai/ask`. AI scope: only `slot` is wired; topbar / main-header / sem-row `✦` entry points are no-op.
- **Seed data sweep** — `isu-catalog.json` missing HDFS-2390, PHIL-2010; CYBE flow has only Sems 1/2/8. Memory: `project-seed-data-incomplete`.
- **DRY refactors** — `electiveLabel(slotType)` is duplicated in `CourseTile.tsx` + `SlotPicker.tsx` + `AiPanel.tsx`. `Section` sub-component duplicated in `ActionMenu.tsx` + `SlotPicker.tsx`.
- **DnD scope** — only course-tile → semester-row move is wired. Dragging catalog courses into the plan, reordering within a row, and drag-to-delete are not built.

## Open Step 10 directions (user has not picked yet)

1. **MSW + real `useAi()` wiring** — swap the stubbed hook for `fetch('/api/v1/ai/ask')` against a mock service worker.
2. **Real Anthropic integration** — server-side proxy; touches the .NET API.
3. **AI scope expansion** — wire the global / flow / semester `✦` entry points.
4. **Validation banner + tile flags** — surface cascade-engine output.
5. **Catalog / flow data sweep** — fills seed gaps.
6. **Test framework** — Vitest + RTL.
7. **DnD expansion** — drag catalog courses into the plan; reorder within a row.
8. **DRY refactors** — extract `electiveLabel` + `Section` helpers.
9. **Something else.**

## Key context flags

- **Seed JSONs are intentionally incomplete.** Memory: `project-seed-data-incomplete`.
- **Single dev server reused across verification cycles** — memory: `feedback-dev-server-reuse`. Don't spawn a new `npm run dev`; rely on Vite HMR + browser refresh. Dev server runs at `http://localhost:5173`.
- **CSS approach is CSS Modules** + palette tokens as CSS custom properties in `src/index.css`.
- **Status color wins over dept tint for non-Planned tiles** (Step 8 decision S8-D12).
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

When you start, **don't re-explain everything above** — assume they read this with you. Just confirm: "Reading session-state.md. Step 9 complete and merged. Which direction for Step 10?" and wait for their pick.
