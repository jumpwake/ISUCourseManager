# Session state — handoff note

> **For Claude on a new machine:** read this top-to-bottom, then await user input.
> This file is a per-session aid and will be deleted/rewritten as work proceeds.

## Where we are right now

- **Branch:** `ui-v1/step-3-plan-view` (Step 3 commits stacked here; the spec + plan + 13 implementation commits)
- **HEAD:** `6e3976c` — `feat(ui): mount PlanView in Main, drop empty body placeholder`
- **UI v1 Steps 1+2** already merged to main via PR #4. **Step 3** is on this branch awaiting PR.
- **Plan #1 (seed validation + loader)** fully merged to main. 40 unit/integration tests pass; 1 intentional failure (the seed-data punch list) remains.

## Project shape

```
ISUCourseManager.sln          .NET solution
src/
  ISUCourseManager.Api/       ASP.NET Core (placeholder Program.cs)
  ISUCourseManager.Services/  Cascade engine + seed validator
  ISUCourseManager.Data/      Domain entities + JSON seed loader + PrereqExpression
  ISUCourseManager.Web/       React + Vite + TypeScript SPA   <-- Steps 1+2+3 done
    src/
      App.tsx                  composes the grid
      App.module.css           grid template + .noPanel modifier
      index.css                palette tokens + body baseline
      data/                    NEW in Step 3
        types.ts               type defs (Course, FlowSlot, StudentCourse, PlanTile, PlanRow, …)
        catalog.ts / flow.ts / student.ts   JSON loaders + normalizers
        academicTerm.ts        encode/decode helpers (YYYYSS)
        department.ts          dept→css-class with gened fallback
        overlay.ts             buildOverlay pure join function
        index.ts               exports `PLAN: ReadonlyArray<PlanRow>` (module-load constant)
        seed/                  duplicated copies of the three seed JSONs
      components/              12 components total
        Step 2 chrome:         TopBar, Sidebar, MainHeader, Main, RightPanel, AiButton, AiMark, DesktopOnlyGate
        Step 3 plan view:      CourseTile, SemRow, PlanView
tests/
  ISUCourseManager.Services.Tests/   xUnit + FluentAssertions
docs/
  superpowers/specs/           system + UI v1 + 2 addendum specs + Step 2 + Step 3 design specs
  superpowers/plans/           Plan #1 (done), Step 2 plan (done), Step 3 plan (done), Plans #2/#3 (not started)
  superpowers/mockups/ui-v1/   v4 = locked layout, interaction-direct-manipulation = locked interactions
Data/, Documentation/         seed JSON + catalog PDF
```

## UI v1 — Step 3 (Plan View Overlay) — what was just done

Replaced Step 2's empty body region with 8 sem-rows driven by the CYBE flow + Luke's seed data + ISU catalog. Built the tile + sem-row primitives and a pure overlay-join function.

**Components added:**
- `<CourseTile />` — discriminated render (electiveSlot / unfilledDegreeSlot / gradePending / default), 5 status states, 6 dept tints, hover lift.
- `<SemRow />` — 96px label column with credit-color thresholds (blue 12-18, orange <12, red >18, green allCompleted), tiles flowing right with wrap.
- `<PlanView />` — flex column of 8 SemRows; replaces Step 2's empty `.body` div in Main.

**Data layer (new `src/data/` module):**
- `types.ts` — frontend types matching eventual API DTO shape (camelCase + spec's enum strings).
- `catalog.ts` / `flow.ts` / `student.ts` — JSON loaders. `student.ts` normalizes seed's `"Complete"` → spec's `"Completed"`, and empty grade strings → `null`.
- `overlay.ts` — pure join function: student tiles render at their actual term; unfilled DegreeClass slots render Planned placeholders at their canonical sem; Elective* slots always render as `electiveEmpty` placeholders.
- `index.ts` — exports `PLAN: ReadonlyArray<PlanRow>` computed once at module load.

**Tile state coverage:**
- v4 status states: `completed`, `inprogress`, `planned`, `failed`.
- Pending-grade addendum: `gradePending` (Luke's MATH-1650 exercises this — Completed with null grade).
- `electiveEmpty` placeholder (striped diagonal grey, dashed border).

**CSS cascade decision** (per Step 3 spec §5, D4): status classes declared before dept classes so dept wins bg/border-color on equal-specificity conflicts. Net effect: Planned tiles get dashed dept-tinted borders (e.g., dashed peach for Math), Completed/InProgress tiles show dept tint as bg with status communicated via the subtitle text. Matches v4 mockup verbatim. Spec text says "status takes visual priority" but the locked v4 implements dept-wins; we followed v4.

**Step 3 docs:**
- `docs/superpowers/specs/2026-05-14-ui-v1-step-3-plan-view-overlay-design.md`
- `docs/superpowers/plans/2026-05-14-ui-v1-step-3-plan-view-overlay.md`

## Known follow-ups (from final code review + user clarifications)

These are acknowledged limitations, NOT bugs:

- **Seed data is intentionally incomplete.** Captured in memory (`project-seed-data-incomplete`).
  - `isu-catalog.json` is missing some courses Luke has actually taken (`HDFS-2390`, `PHIL-2010`). Overlay's catalog-miss `continue` silently drops them — Sem 1 shows 4 student tiles instead of the 6 named in S3-3.
  - `flow-cybe-2025-26.example.json` has slots only for Sems 1, 2, 8. Sems 3-7 have no flow data → no Planned-placeholder fill-out for those sems. Matches Luke's actual planning state (he's completed Sem 1+2, registered for Sem 3, hasn't planned beyond).
  - The catalog + CYBE flow sweep is a deferred data-entry task; not blocking UI iteration.
- **`studentName` is exported from `student.ts` but unused** — placeholder for later TopBar binding.
- **The debug `[panel]` toggle in the TopBar** is still temporary — removed once action menu / AI panel triggers exist (later step).

## Open Step 4 directions (user has not picked yet)

These were on the table from Step 2's session-state:
1. **Wire up a mock API endpoint** — add MSW, mock `GET /api/v1/me/flows` and `GET /api/v1/me/courses`, fetch data through the lifecycle instead of importing JSON. Future-shapes the `usePlan()` hook contract.
2. **Action menu / right-panel content** — clicking a tile opens the action menu (UI spec §10.1). First real use of the right panel beyond the debug toggle.
3. **Validation banner + tile flag markers** — start surfacing the cascade engine's output (when backend lands) on tiles. Requires backend or a faked validation source.
4. **Test framework** — Vitest + React Testing Library + first render tests. Cheap insurance.
5. **Catalog / flow data sweep** — hand-transcribe missing CYBE Sem 3-8 slots and the gen-ed courses Luke took (HDFS-2390, PHIL-2010). Pure data-entry. Closes the S3-3/S3-4 gaps.
6. **Something else.**

## Key context flags

- **FluentAssertions 8.10.0 is non-OSS-licensed.** Flagged twice in Plan #1; user hasn't decided whether to pin to 7.x. Not relevant to UI work but will be when the next backend plan starts.
- **`StudentCourse` deliberately mixes `init` (identity props) with `set` (4 transfer fields).** Intentional per the external-transfer addendum spec.
- **CSS approach is CSS Modules** + palette tokens as CSS custom properties in `src/index.css`. Stick with these for subsequent UI steps.
- **Seed file convention:** seed JSONs (catalog, flow, student) use `"Complete"` past-tense status; the UI DTO + frontend types use spec's `"Completed"`. `src/data/student.ts:normalizeStatus` is the adapter at the boundary.

## What NOT to do

- Don't start Plan #2 (EF persistence) or Plan #3 (cascade engine) — user is staying UI-first.
- Don't try to "fix" the failing `ActualSeedFileTests.Catalog_passes_validation_with_no_errors` — it's the intentional Task-14 punch list.
- Don't auto-add missing courses to the catalog or auto-fill missing flow slots — the seed data sweep is a deferred task per project memory.
- Don't remove the debug `[panel]` toggle until a real panel trigger exists.

## How to confirm the user is ready

When you start, **don't re-explain everything above** — assume they read this with you. Just confirm: "Reading session-state.md. Step 3 complete on `ui-v1/step-3-plan-view`. Which direction for Step 4?" and wait for their pick.
