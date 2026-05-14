# Session state — handoff note

> **For Claude on a new machine:** read this top-to-bottom, then await user input.
> This file is a per-session aid and will be deleted/rewritten as work proceeds.

## Where we are right now

- **Branch:** `ui-v1/step-5-slot-picker` (Step 5 commits stacked here; spec + plan + 6 implementation commits)
- **HEAD:** `9a66c8f` — `feat(ui): wire SlotPicker — unfilled/elective clicks open right panel`
- **UI v1 Steps 1+2 + Step 3** merged into local main. Step 4 also merged locally (origin/main lags by ~16 commits since the last push). Step 5 is on this branch awaiting PR/merge.
- **Plan #1 (seed validation + loader)** fully merged to main.

## Project shape

```
src/ISUCourseManager.Web/src/
  App.tsx                            composes grid + SelectedPanel state (actionMenu | slotPicker)
  App.module.css                     grid template + .noPanel modifier
  index.css                          palette tokens + body baseline
  data/                              Step 3 module
    types.ts / catalog.ts / flow.ts / student.ts
    academicTerm.ts / department.ts / overlay.ts / index.ts
    seed/  (three JSONs)
  components/                        14 components
    Step 2 chrome:  TopBar, Sidebar, MainHeader, Main, RightPanel,
                    AiButton, AiMark, DesktopOnlyGate
    Step 3 plan:    CourseTile, SemRow, PlanView
    Step 4:         ActionMenu       (with Completed-trim from Step 5)
    Step 5:         SlotPicker       (NEW)
docs/
  superpowers/specs/   system + UI v1 + 2 addenda + Step 2/3/4/5 specs
  superpowers/plans/   Plan #1 done; Step 2/3/4/5 plans done; Plans #2/#3 not started
```

## UI v1 — Step 5 (Slot Picker + Completed-Tile Trim) — what was just done

The right-panel content matrix is now complete for all three tile kinds. Clicking a `studentCourse` opens the ActionMenu (Step 4 behavior preserved); clicking an `unfilledDegreeSlot` or `electiveSlot` opens the new **SlotPicker**. The Completed-tile UX trim (deferred from Step 4) now applies — Completed and gradePending tiles show only an info message, not the 4 stub action sections.

**New component `<SlotPicker />`:**
- Header (blue chrome): breadcrumb (`Sem N · Term`), title `Fill this slot`, kind-specific context line, close `×`.
- Body sections per UI spec §10.2:
  - **Recommended** — hidden (overlay rule means Luke's current data has no Recommended candidates).
  - **Pull from a later semester** — italic muted "No pull-forward candidates yet." message.
  - **Add a new course from the catalog** — first 8 catalog entries as `<button>` cards (no filter, no search).
  - **Leave this slot empty** — single muted card with credit-consequence text.
- Footer: ghost `Cancel` (closes panel) + primary `Apply selection` (visible but `disabled`).

**State plumbing changes (App.tsx):**
- `selected: SelectedPanel | null` — discriminated union over `actionMenu` and `slotPicker`. Replaces Step 4's `selectedTile: StudentCoursePlanTile | null`.
- `handleTileClick` branches on `tile.kind`: studentCourse → toggle actionMenu; unfilled/elective → toggle slotPicker (via `isSameUnfilledTile`).
- `selectedClassId` derived: only non-null when an action menu is open, so the `.selected` blue ring stays scoped to studentCourse tiles only.

**Tile / row changes:**
- `unfilledDegreeSlot` and `electiveSlot` PlanTile variants gained `semIdx` + `academicTerm` (for the slot-picker breadcrumb).
- `CourseTile`'s non-studentCourse branches now render `<button>` when `onClick` is provided (else `<span>` for backwards-compat).
- `SemRow` removed the `tile.kind === 'studentCourse'` gate on its `onClick` wiring — all three kinds get routed to App's handler.

**ActionMenu Completed-trim:**
- Body conditional: when `tile.status === 'Completed'` (which includes the gradePending case, `status='Completed' + grade=null`), the 4 sections collapse to a single centered italic message `This course is complete — no actions available.`
- New `.emptyMessage` CSS rule.

**Step 5 docs:**
- `docs/superpowers/specs/2026-05-14-ui-v1-step-5-slot-picker-design.md`
- `docs/superpowers/plans/2026-05-14-ui-v1-step-5-slot-picker.md`

## Known follow-ups (carry forward)

User-flagged + reviewer-flagged items, deferred:

- **Catalog search + AI conversation in the slot picker.** User suggestion at Step 5 sign-off: "Under Add a New Course From the Catalog. We need a way to search the catalog. Maybe open a chat and have a conversation with the user about what they like and maybe want to take." Maps to UI spec §10.2 ("Search input at top of body") + §10.3 (AI panel scoped to a slot). Natural Step 6+ direction. Would introduce the first AI-mediated UX in the app.
- **Real mutations** — every action card (ActionMenu + SlotPicker) is still a no-op stub. Backend-free path: real local state mutations (e.g., "Mark Completed" actually flips the StudentCourse status). Backend path: MSW + real `/api/v1/me/courses` calls.
- **Seed data sweep** — `isu-catalog.json` missing HDFS-2390, PHIL-2010; CYBE flow has only Sems 1/2/8. Captured in memory (`project-seed-data-incomplete`). Filling this in unblocks unfilledDegreeSlot tile rendering (currently no live test of that slot-picker branch).
- **DRY refactors** flagged by reviewers:
  - `electiveLabel(slotType)` duplicated in `CourseTile.tsx` and `SlotPicker.tsx` — extract to a shared helper.
  - `Section` sub-component duplicated in `ActionMenu.tsx` and `SlotPicker.tsx` — same.
- **Cosmetic nits:**
  - SlotPicker `cancelBtn` color is grey (`var(--text-label)`); the AC text says "blue". Visual pass confirmed, but the spec wording vs. impl could be tightened on a polish pass.
  - SlotPicker `.muted` card still has interactive hover styles (brightens bg, blue border) — could be made truly static.
  - `selected` prop semantic looseness on non-studentCourse tiles (Step 4 reviewer note) — partially addressed in Step 5 (gate kept) but consider tightening to `undefined`.
- **AI panel mode (purple accent)** — the existing `--panel-accent` CSS variable system supports adding a third accent (`accentAi`) when the AI panel lands.

## Open Step 6 directions (user has not picked yet)

1. **Catalog search + AI conversation in slot picker** — directly addresses the user's Step-5 sign-off feedback. Introduces AI integration architecture (UI spec §11).
2. **Real mutations (local state first)** — make the ActionMenu / SlotPicker buttons actually do something. Required before MSW because mutations need a target.
3. **MSW + `usePlan()` hook refactor** — swap the static `PLAN` constant for a hook backed by MSW. Lays groundwork for cascade-engine validation responses too.
4. **Validation banner + tile flags** — start surfacing cascade-engine output. Needs backend (or faked validation source).
5. **Catalog / flow data sweep** — pure data-entry. Fills the seed gaps so all branches of the overlay + slot picker get real data.
6. **Test framework** — Vitest + RTL + first render tests.
7. **DRY refactors** — extract `electiveLabel` + `Section` helpers; minor cosmetic fixes.
8. **Something else.**

## Key context flags

- **Seed JSONs are intentionally incomplete.** Captured in memory (`project-seed-data-incomplete`).
- **CSS approach is CSS Modules** + palette tokens as CSS custom properties in `src/index.css`. `--panel-accent` is the canonical pattern for mode-dependent panel accents.
- **Stack-on-its-own-branch per step.** Each step gets its own branch from main and is merged before the next starts.
- **Seed file `"Complete"` → spec `"Completed"`** adapter in `src/data/student.ts:normalizeStatus`.
- **The right panel uses a layout wrapper pattern**: `<RightPanel accent="action">` (or `accent="ai"` for future AI mode) provides the chrome; content components (`<ActionMenu>` / `<SlotPicker>` / future `<AiPanel>`) render inside as children.

## What NOT to do

- Don't start Plan #2 (EF persistence) or Plan #3 (cascade engine) — user is staying UI-first.
- Don't try to "fix" `ActualSeedFileTests.Catalog_passes_validation_with_no_errors` — intentional punch list.
- Don't auto-add missing courses/slots to the seed JSONs — deferred per project memory.
- Don't re-litigate the dept-tint-wins CSS cascade — that's the locked v4 behavior.

## How to confirm the user is ready

When you start, **don't re-explain everything above** — assume they read this with you. Just confirm: "Reading session-state.md. Step 5 complete on `ui-v1/step-5-slot-picker`. Which direction for Step 6?" and wait for their pick.
