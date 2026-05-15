# UI v1 — Step 8 (Action-Menu Mutations, Local State) — Design Spec

**Date:** 2026-05-15
**Status:** Approved for planning
**Author:** Kevin (with Claude)
**Companion to:**
- `docs/superpowers/specs/2026-05-13-ui-v1-design.md` (UI v1 — source of truth; §10.1 action menu, §12 direct manipulation)
- `docs/superpowers/specs/2026-05-14-ui-v1-step-4-action-menu-design.md` (the action menu itself)
- `docs/superpowers/specs/2026-05-14-ui-v1-step-3-plan-view-overlay-design.md` (the overlay / PlanRow model)

## 1. Goal

Make the action menu actually mutate the plan. Until now every action button in the app is a no-op stub. Step 8 wires the four "status & removal" action-menu cards to real mutations against a local, in-memory plan state: clicking **Mark Completed**, **Mark In Progress**, **Mark Failed / Cancelled**, or **Remove from plan** changes the student's plan and the plan view re-renders to reflect it.

This is the first time the app stops being a static rendering and becomes interactive. Scope is deliberately tight — only the four sub-UI-free action-menu cards. **Move to future/earlier term** (needs a destination picker) and **Substitute** (needs the slot picker as a course source) stay no-op stubs for a later step.

## 2. Scope

### In scope
- **Lift plan state into `App.tsx`.** Today the plan is the module-level `PLAN` constant (`data/index.ts`). Step 8 replaces it:
  - App imports the seed array **aliased** to avoid name-shadowing: `import { studentCourses as seedStudentCourses } from './data/student.ts'`.
  - App holds `const [studentCourses, setStudentCourses] = useState<StudentCourse[]>(seedStudentCourses)`.
  - App derives the overlay: `const rows = useMemo(() => buildOverlay(flow, studentCourses, catalogById), [studentCourses])`.
  - `flow`, `catalogById`, `buildOverlay` are imported directly from their `data/` modules.
- **`rows` becomes a prop.** `PlanView` no longer imports `PLAN`; it receives `rows: PlanRow[]` from App, threaded through `Main`. `data/index.ts` (whose only purpose was exporting `PLAN`) is **deleted**.
- **Four action-menu mutations** wired through a new `onAction` callback on `<ActionMenu />`:
  - **Mark Completed** → set the matching `StudentCourse.status` to `'Completed'`. `grade` is left unchanged. (A `Planned` course has `grade: null`; after this it is `Completed + grade: null` = the gradePending visual state — correct: the course is done, the grade hasn't been entered.)
  - **Mark In Progress** → set `status` to `'InProgress'`.
  - **Mark Failed / Cancelled** → set `status` to `'Failed'`.
  - **Remove from plan** → remove the `StudentCourse` from the array entirely.
- **Panel closes after every mutation.** The mutation handler calls `setSelected(null)` alongside the state change. This avoids a stale `selectedTile` (the overlay recomputes into fresh `PlanTile` objects; the old reference would be stale). The plan view shows the change immediately; to act again the user re-clicks the tile.
- **Mutation identity** keys off `classId`: the `selectedTile` is a `StudentCoursePlanTile` carrying `classId`; the matching `StudentCourse` has `courseId === classId`.

### Out of scope
- **Move to future / earlier term** — requires an inline destination (semester) picker sub-UI. Cards stay no-op stubs.
- **Substitute another course** — requires the slot picker as a course source; slot-picker mutations are not built. Stays a no-op stub.
- **Grade picker on Mark Completed.** Planned → Completed yields the gradePending state. Entering an explicit letter grade is deferred.
- Slot-picker mutations (Add from catalog, Pull forward, Leave empty), AI-panel suggestion-card mutations — all still no-op.
- Undo / redo.
- MSW, real backend, persistence. Local `useState` only — a browser refresh resets to the seed data.
- Cascade / validation re-evaluation after a mutation (no validation engine exists yet; the overlay just re-renders).

## 3. Architecture

### Plan state ownership

```
                 data/student.ts  ──exports──▶  studentCourses (seed array)
                                                      │
App.tsx:  import { studentCourses as seedStudentCourses } from './data/student.ts'
          const [studentCourses, setStudentCourses] = useState(seedStudentCourses)
                                                      │
          const rows = useMemo(
            () => buildOverlay(flow, studentCourses, catalogById),
            [studentCourses])
                                                      │
                       rows ──prop──▶ Main ──prop──▶ PlanView ──▶ SemRow[] ──▶ CourseTile[]
```

Source of truth = `studentCourses`. The overlay (`PlanRow[]`) is purely derived. Every mutation is a `setStudentCourses` call; `useMemo` recomputes `rows`; the tree re-renders.

### Mutation handlers (in `App.tsx`)

```ts
type CourseAction = 'markCompleted' | 'markInProgress' | 'markFailed' | 'remove';

function applyAction(action: CourseAction, classId: string) {
  if (action === 'remove') {
    setStudentCourses((prev) => prev.filter((sc) => sc.courseId !== classId));
  } else {
    const status: StudentCourseStatus =
      action === 'markCompleted' ? 'Completed'
      : action === 'markInProgress' ? 'InProgress'
      : 'Failed';
    setStudentCourses((prev) =>
      prev.map((sc) => (sc.courseId === classId ? { ...sc, status } : sc)),
    );
  }
  setSelected(null);
}
```

`ActionMenu`'s `onAction(action)` is wired to `applyAction(action, selected.tile.classId)`.

### Why panel-close-on-mutation

After `setStudentCourses`, `buildOverlay` produces a brand-new `PlanRow[]` with brand-new `PlanTile` objects. The App-level `selected` state holds a `PlanTile` snapshot from *before* the mutation — it would be stale (e.g., still showing `status: 'Planned'` after a Mark Completed, or pointing at a now-deleted course). Rather than re-resolving the selected tile from the new overlay each mutation, Step 8 simply closes the panel. The plan view is the feedback surface. (Re-resolving + keeping the panel open is a possible later refinement.)

## 4. Component changes

| Component | Change |
|---|---|
| `App.tsx` | Import the seed array aliased (`studentCourses as seedStudentCourses`) from `data/student.ts`, plus `flow`, `catalogById`, `buildOverlay`. Hold `studentCourses` in `useState(seedStudentCourses)`. Derive `rows` via `useMemo`. Add `applyAction(action, classId)`. Pass `rows` to `<Main>`. Pass `onAction` to `<ActionMenu>` (resolves to `applyAction(action, selected.tile.classId)`). |
| `Main.tsx` | Add `rows: PlanRow[]` prop; thread to `<PlanView>`. (Keeps existing `onTileClick` / `selectedClassId` props.) |
| `PlanView.tsx` | Remove `import { PLAN } from '../data/index.ts'`. Add `rows: PlanRow[]` prop; map over `rows` instead of `PLAN`. |
| `ActionMenu.tsx` | Add `onAction: (action: CourseAction) => void` prop. Wire the four cards — Mark Completed → `onAction('markCompleted')`, Mark In Progress → `onAction('markInProgress')`, Mark Failed/Cancelled → `onAction('markFailed')`, Remove from plan → `onAction('remove')`. The `ActionCard` helper gains an optional `onClick` prop. Move/Substitute cards pass no `onClick` (stay inert). |
| `data/index.ts` | **Deleted.** Its only export, `PLAN`, is replaced by App's `useMemo`. |
| `data/types.ts` | Add `export type CourseAction = 'markCompleted' | 'markInProgress' | 'markFailed' | 'remove';` |

`data/student.ts`, `data/flow.ts`, `data/catalog.ts`, `data/overlay.ts` are unchanged — App imports their existing exports.

## 5. `ActionCard` wiring detail

`ActionMenu.tsx`'s `ActionCard` helper currently renders `<button type="button" className=...>` with no handler. Add an optional `onClick`:

```tsx
type ActionCardProps = {
  icon: string;
  name: string;
  meta: string;
  danger?: boolean;
  onClick?: () => void;
};

function ActionCard({ icon, name, meta, danger = false, onClick }: ActionCardProps) {
  const className = danger ? `${styles.card} ${styles.danger}` : styles.card;
  return (
    <button type="button" className={className} onClick={onClick}>
      {/* icon + content unchanged */}
    </button>
  );
}
```

The four wired cards pass `onClick`; Move-future, Move-earlier, and Substitute pass nothing (remain no-op). The Completed-status trim from Step 5 is unchanged — the whole section block is still hidden for Completed tiles, so mutations are only reachable on non-Completed tiles.

## 6. Acceptance criteria

| # | Criterion |
|---|---|
| S8-1 | Click a Planned `studentCourse` tile (e.g., Luke's Sem 3 `CprE 2810`). Action menu opens with the full 4 sections. |
| S8-2 | Click **Mark In Progress**. The panel closes. The tile in the plan view re-renders with the in-progress style (yellow tint). Its sem-row credit total is unaffected (same credits). |
| S8-3 | Click a Planned tile, click **Mark Completed**. Panel closes. The tile re-renders as **gradePending** (desaturated green, dashed border, "grade pending" italic) — because Planned tiles have no grade, and Completed + no grade = gradePending. |
| S8-4 | Click a Planned tile, click **Mark Failed / Cancelled**. Panel closes. The tile re-renders with the failed style (red tint). |
| S8-5 | Click a Planned tile, click **Remove from plan**. Panel closes. The tile is removed from its sem-row. If the removed course filled a CYBE flow `DegreeClass` slot, an `unfilledDegreeSlot` placeholder appears at that slot's canonical semester (the overlay recomputes). |
| S8-6 | After any mutation, re-clicking the SAME tile (if it still exists) reflects the new state — e.g., a now-Completed tile opens the action menu showing the Completed-trim ("This course is complete — no actions available."). |
| S8-7 | **Move to future term**, **Move to earlier term**, and **Substitute another course** cards still render but do nothing on click (no-op stubs — out of scope this step). No console error. |
| S8-8 | Mutations are isolated to the clicked course — other tiles in the same sem-row and other rows are unchanged. |
| S8-9 | A browser refresh resets the plan to the original seed data (local state, no persistence). |
| S8-10 | The sem-row credit-total color updates correctly after a mutation that changes the row's completion state — e.g., if marking the last non-Completed tile in a row Completed makes the row all-Completed, the credit total turns green. |
| S8-11 | Steps 3–7 behaviors preserved: plan view renders 8 sem-rows; SlotPicker (with search + Ask AI icon) opens on elective tiles; AiPanel opens from the slot picker; Completed-trim still applies. |
| S8-12 | `npm run build` exits 0. |
| S8-13 | `npm run lint` exits 0. |
| S8-14 | Visual match in browser — verified by user. |

## 7. Out-of-band notes

- **Branch:** `ui-v1/step-8-action-menu-mutations` cut from main.
- **No tests** — same as Steps 2–7.
- **`data/index.ts` deletion**: confirm nothing else imports it. As of Step 7, only `PlanView.tsx` imports `PLAN`. After Step 8's `PlanView` change, `index.ts` has no importers — safe to delete. `git grep "data/index"` should come back empty afterward.
- **`useMemo` dependency**: `[studentCourses]` only. `flow` and `catalogById` are module constants (stable references) — they don't belong in the dep array, and including them would be harmless but noisy. `studentCourses` is the only thing that changes.
- **gradePending after Mark Completed** is intentional, not a bug — see S8-3. When the grade picker lands (later step), Mark Completed will optionally capture a grade and skip the pending state.
- **Single dev server** stays running at `http://localhost:5173`; verification is a browser refresh (per the `feedback-dev-server-reuse` memory).

## 8. Decisions log

| # | Decision | Rationale |
|---|---|---|
| S8-D1 | Scope to the 4 sub-UI-free action-menu cards; defer Move + Substitute | User-requested tight step. Move needs a destination picker; Substitute needs the slot picker as a source. Both are their own steps. |
| S8-D2 | Source of truth is `studentCourses`; overlay is derived via `useMemo` | The overlay is a pure function of student data + flow + catalog. Holding the derived `PlanRow[]` in state would risk it drifting from the source. Derive, don't store. |
| S8-D3 | Close the panel after every mutation | Avoids a stale `selectedTile` (overlay recomputes into fresh objects). The plan view is the feedback surface. Re-resolving the selected tile to keep the panel open is a possible later refinement. |
| S8-D4 | Mark Completed leaves `grade` untouched (Planned → gradePending) | A grade picker is a separate sub-UI. gradePending is the honest state for "done, grade not entered." |
| S8-D5 | `data/index.ts` deleted, plan state owned by App | `index.ts` only existed to export the `PLAN` constant. With plan state lifted to App, the constant is gone; the file has no reason to exist. |
| S8-D6 | `onAction(action)` single callback (vs. four separate `onMarkX` props) | One prop, one discriminated `CourseAction` arg — less prop surface on `ActionMenu`, and App's `applyAction` switch is the single place mutation logic lives. |
| S8-D7 | `CourseAction` type lives in `data/types.ts` | Shared between `ActionMenu.tsx` (prop type) and `App.tsx` (handler). Co-located with the other domain types. |
| S8-D8 | No persistence — refresh resets | Local state only; MSW/backend persistence is a later step. Acceptable and expected for an in-progress UI build. |

## 9. Open items

- None blocking Step 8. After this step the action menu's status & removal cards are live. Next steps: Move/Substitute (with destination picker + slot-picker-as-source), slot-picker mutations, then MSW/backend persistence so changes survive a refresh.

## 10. Amendment — Add Class (folded into Step 8 during review)

During Step 8 review the user flagged a real gap: there is no way to add a brand-new course to a semester. The slot picker only opens from an existing placeholder tile, and its catalog cards were no-op stubs through Steps 5–7. This amendment adds the **Add Class** flow. Also folded in: a status-color fix (see §10.6).

### 10.1 Scope (added)
- A `+ Add Class` tile is appended to every sem-row that is **not** all-completed (`!row.allCompleted`). Completed/past semesters (Luke's Sem 1–2) don't get it; planned/upcoming ones (Sem 3–8) do — including a row emptied by removing courses.
- Clicking it opens the slot picker in a new **"add to semester"** mode.
- The slot picker's "Add a new course from the catalog" cards become a real mutation in **both** modes (fill-slot and add-to-sem): clicking a course inserts a `StudentCourse` and closes the panel.

### 10.2 SlotPicker generalization
`SlotPicker`'s `tile: UnfilledTile` prop is replaced by a discriminated `target`:

```ts
export type SlotPickerTarget =
  | { kind: 'slot'; tile: UnfilledTile }
  | { kind: 'addToSem'; semIdx: number; academicTerm: number };
```

Exported from `data/types.ts`. SlotPicker derives `semIdx` / `academicTerm` from either variant. Behavior by mode:
- **`slot`** — unchanged: title "Fill this slot", `Originally: …` context line, "Leave this slot empty" section shown, Ask AI icon shown.
- **`addToSem`** — title "Add a course", no context line, "Leave this slot empty" section HIDDEN (you're adding, not leaving empty), Ask AI icon HIDDEN.
- Both modes show: breadcrumb (`Sem N · Term`), search input, "Pull from a later semester" (stub), "Add a new course from the catalog".

### 10.3 `onPickCourse` mutation
SlotPicker gains a required `onPickCourse: (classId: string) => void`. Each catalog course card calls it. App resolves it to:

```ts
const addCourse = (classId: string, academicTerm: number) => {
  setStudentCourses((prev) => [
    ...prev,
    { courseId: classId, academicTerm, status: 'Planned', grade: null },
  ]);
  setSelected(null);
};
```

Target term: the slot's `academicTerm` (slot mode) or the row's `academicTerm` (add-to-sem mode). Duplicates are allowed (adding a course already in the plan yields a second Planned tile — removable via the action menu); a duplicate-guard is deferred.

### 10.4 App state
`SelectedPanel` gains `{ kind: 'addClass'; semIdx: number; academicTerm: number }`. The existing `slotPicker`/`tile` branch and `handleTileClick` / `isSameUnfilledTile` are UNCHANGED — the `addClass` branch is purely additive. App renders `<SlotPicker>` for both the `slotPicker` and `addClass` selected kinds, constructing the `target` prop at each render site. `+ Add Class` clicks thread App → Main → PlanView → SemRow via an `onAddClass(semIdx, academicTerm)` callback.

### 10.5 Acceptance criteria (added)
| # | Criterion |
|---|---|
| S8-15 | Every non-all-completed sem-row (Sem 3–8 for Luke) shows a trailing dashed `+ Add Class` tile. Sem 1–2 (all completed) do NOT. |
| S8-16 | Clicking `+ Add Class` opens the slot picker titled "Add a course", with NO "Originally:" line, NO "Leave this slot empty" section, NO Ask AI icon. Breadcrumb + search input + catalog list present. |
| S8-17 | In the add-to-sem picker, typing in the search filters the catalog (Step 6 behavior intact). Clicking a catalog course card adds it to that semester as a Planned tile and closes the panel. |
| S8-18 | Clicking a catalog card in the normal slot-fill picker (opened from an unfilled/elective tile) also adds the course — at the slot's term — and closes the panel. Catalog cards are no longer no-op. |
| S8-19 | After an add, the new Planned tile appears in the target semester and is itself clickable (opens the action menu) like any other student tile. |
| S8-20 | Emptying a semester (removing all its courses) still leaves the `+ Add Class` tile — the semester is never a dead end. |

### 10.6 Status-color fix
Also folded in: Mark In Progress / Mark Failed appeared inert because Step 3's dept-tint-wins cascade (S3-D4) made the department tint override the status background. Fixed in `CourseTile.tsx` — the department tint is now applied **only to Planned tiles**; Completed / InProgress / Failed render in their status color (green / yellow / red). Reverses the non-Planned half of S3-D4. Side effect (intended): Luke's all-completed Sem 1 tiles now render green.

### 10.7 Amended decisions

| # | Decision | Rationale |
|---|---|---|
| S8-D9 | `SlotPicker` takes a discriminated `target` (`slot` \| `addToSem`) rather than two optional context props | A discriminated union avoids non-null assertions and models the real intent: the picker places a course for a destination, which is either a specific slot or a whole semester. |
| S8-D10 | Add Class reuses `SlotPicker` rather than a new component | The catalog-search + result-card UI is exactly what's needed; a separate component would duplicate it. The two modes differ only in framing. |
| S8-D11 | Duplicate-add allowed (no guard) | Minimal scope. A second Planned tile is removable via the action menu. A duplicate-guard can land later. |
| S8-D12 | Status color wins over dept tint for non-Planned tiles | A status mutation must be visible. Dept tint stays on Planned tiles where dept-coding aids planning. |
