# Session state — handoff note

> **For Claude on a new machine:** read this top-to-bottom, then await user input.
> This file is a per-session aid and will be deleted/rewritten as work proceeds.

## Where we are right now

- **Branch:** `ui-v1/step-4-action-menu` (Step 4 commits stacked here; spec + plan + 6 implementation commits)
- **HEAD:** `a683971` — `feat(ui): wire ActionMenu — tile clicks open right panel`
- **UI v1 Steps 1+2 + Step 3** already merged to main (Step 3 was merged locally; origin/main may lag if not pushed). **Step 4** is on this branch awaiting PR/merge.
- **Plan #1 (seed validation + loader)** fully merged to main.

## Project shape

```
src/ISUCourseManager.Web/src/
  App.tsx                            composes grid + selectedTile state
  App.module.css                     grid template + .noPanel modifier
  index.css                          palette tokens + body baseline
  data/                              Step 3
    types.ts / catalog.ts / flow.ts / student.ts
    academicTerm.ts / department.ts / overlay.ts / index.ts
    seed/  (three JSONs)
  components/                        13 components
    Step 2 chrome:  TopBar, Sidebar, MainHeader, Main, RightPanel,
                    AiButton, AiMark, DesktopOnlyGate
    Step 3 plan:    CourseTile, SemRow, PlanView
    Step 4:         ActionMenu  (NEW)
docs/
  superpowers/specs/   system + UI v1 + 2 addenda + Step 2 + Step 3 + Step 4 specs
  superpowers/plans/   Plan #1 (done), Step 2 plan (done), Step 3 plan (done),
                       Step 4 plan (done), Plans #2/#3 (not started)
```

## UI v1 — Step 4 (Action Menu) — what was just done

Activated the right panel for the first time with real content. Clicking a `studentCourse` tile opens the Action menu keyed to that tile. The temporary debug `[panel]` toggle from Step 2 is replaced with real selection-driven mounting.

**State plumbing:**
- App holds `selectedTile: StudentCoursePlanTile | null` — a typed-narrow state that can only contain studentCourse tiles. Click handler ignores unfilled/elective tiles, toggles closed if re-clicking the active tile.
- `<RightPanel />` was rewritten as a layout wrapper with `accent: 'ai' | 'action'` prop (default `'ai'`) and `children`. The `--panel-accent` CSS variable switches per accent: purple in AI mode, blue `#1976d2` in action mode. The old `hidden` prop and `.hidden` CSS rule are gone — App decides whether to render the panel at all.

**`<ActionMenu />` (new):**
- Header: breadcrumb (`Sem N · Term`), H2 (`{classId} · {name}`), context line (department + credits), meta pills (Status, plus Grade when non-null).
- Body: 4 sections (Update status / Reschedule / Replace / Remove) with 7 stub action cards (2 styled as danger). All buttons are no-op for Step 4.
- Footer: outlined Close button.
- Close also via `×` in the header.

**Tile changes:**
- `studentCourse` `<CourseTile />` variants now render as `<button>` (accessible, cursor: pointer). Other variants stay `<span>`.
- `PlanTile.studentCourse` gained 3 fields: `deptDisplay` (catalog department string), `academicTerm` (YYYYSS), `semIdx` (1..8). Used by ActionMenu's header.
- `.selected` ring (blue box-shadow + scale per UI spec §5) applies when the tile's classId matches `selectedClassId`.

**Step 4 docs:**
- `docs/superpowers/specs/2026-05-14-ui-v1-step-4-action-menu-design.md`
- `docs/superpowers/plans/2026-05-14-ui-v1-step-4-action-menu.md`

## Known follow-ups (carry to Step 5)

User-flagged + reviewer-flagged items, deferred:

- **Completed-status tiles should not show action cards.** When a user clicks a tile whose `status === 'Completed'` (including the gradePending sub-case), the action menu body should render an info message like "This course is complete — no actions available." instead of the 4 sections. Header stays as-is. Rationale: a completed course is immutable; showing stub action cards is misleading. Action: small conditional in `ActionMenu.tsx` + `.emptyMessage` CSS rule.
- **Slot picker (the other half of the right panel).** Clicking `unfilledDegreeSlot` or `electiveSlot` tiles currently does nothing. Step 5 wires the slot picker per UI spec §10.2 / `interaction-fill-slot.html`.
- **`selected` prop semantic looseness.** `SemRow.tsx` passes `selected={false}` to non-studentCourse tiles (instead of `undefined`). Harmless today since CourseTile's span branches don't read it. Tighten to `selected={tile.kind === 'studentCourse' ? ... : undefined}` when convenient.
- **Action menu footer button styling.** Reviewer noted the `.closeBtn` uses outlined style (`border: 1px solid var(--border)`) rather than a true "ghost" style (borderless). Cosmetic; revisit when a shared button-system is needed.
- **The action menu's buttons are no-op stubs.** Real mutations (move, mark completed, remove, substitute) land in a later step. Local state first, MSW-mediated later.

## Open Step 5 directions (user has not picked yet)

1. **Slot picker** (clicking unfilled slots + electives opens the 4-section picker per UI spec §10.2). Closes the click no-op for non-studentCourse tiles.
2. **Completed-tile UX trim** (the deferred follow-up above). Small change.
3. **MSW + data hook refactor** — swap `PLAN` constant for a `usePlan()` hook backed by MSW responses. Lays the groundwork for real mutations.
4. **Real mutations (local state first)** — e.g., "Mark Completed" actually sets status to Completed in component state. No MSW yet.
5. **Validation banner + tile flags** (cascade engine output rendering).
6. **Catalog / flow data sweep** — fill the missing entries (HDFS-2390, PHIL-2010 in catalog; CYBE Sems 3-8 in flow).
7. **Test framework** — Vitest + RTL.
8. **Something else.**

## Key context flags

- **Seed JSONs are intentionally incomplete.** Captured in memory (`project-seed-data-incomplete`). HDFS-2390, PHIL-2010 missing from catalog; flow has Sems 1/2/8 only.
- **CSS approach is CSS Modules** + palette tokens as CSS custom properties in `src/index.css`. The `--panel-accent` variable is the canonical pattern for mode-dependent accents (now exercised by `accentAi` and `accentAction` in RightPanel.module.css).
- **Stack-on-its-own-branch pattern for UI v1 work.** Each step gets its own branch from main; the Step N branch is merged into main before Step N+1 starts.
- **Seed file `"Complete"` → spec `"Completed"`** adapter in `src/data/student.ts:normalizeStatus`.

## What NOT to do

- Don't start Plan #2 (EF persistence) or Plan #3 (cascade engine) — user is staying UI-first.
- Don't try to "fix" `ActualSeedFileTests.Catalog_passes_validation_with_no_errors` — intentional punch list.
- Don't auto-add missing courses/slots to the seed JSONs — deferred per project memory.
- Don't re-litigate the dept-tint-wins CSS cascade — that's the locked v4 behavior.

## How to confirm the user is ready

When you start, **don't re-explain everything above** — assume they read this with you. Just confirm: "Reading session-state.md. Step 4 complete on `ui-v1/step-4-action-menu`. Which direction for Step 5?" and wait for their pick.
