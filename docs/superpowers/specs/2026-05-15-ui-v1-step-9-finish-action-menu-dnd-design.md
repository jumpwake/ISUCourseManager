# UI v1 — Step 9 (Finish the Action Menu + Drag-and-Drop) — Design Spec

**Date:** 2026-05-15
**Status:** Approved for planning
**Author:** Kevin (with Claude)
**Companion to:**
- `docs/superpowers/specs/2026-05-13-ui-v1-design.md` (UI v1 — source of truth; §10.1 action menu, §12 direct manipulation)
- `docs/superpowers/specs/2026-05-15-ui-v1-step-8-action-menu-mutations-design.md` (Step 8 — the mutations this builds on)
- `docs/superpowers/specs/2026-05-14-ui-v1-step-4-action-menu-design.md` (the action menu itself)

## 1. Goal

Wire the last two no-op action-menu cards — **Move to future/earlier term** and **Substitute another course** — to real mutations, and add **drag-and-drop** as a direct-manipulation alternative to Move. After this step every action-menu card is functional and the plan can be reshaped by dragging a course between semesters on both desktop and mobile.

Step 8 made the plan mutable (status changes, removal, Add Course). Step 9 finishes the manipulation surface.

## 2. Scope

### In scope
- **Move to future/earlier term** — an inline destination-semester picker inside the action menu.
- **Substitute another course** — opens the slot picker in a new `substitute` mode; picking a catalog course replaces the current one.
- **Drag-and-drop move** — drag a non-Completed course tile onto another semester row to move it.
- Two new `App` mutations: `moveCourse` and `substituteCourse`.
- One new dependency: `@dnd-kit/core`.

### Out of scope
- Validity checks (prerequisite satisfaction, term conflicts, credit-load limits) — there is no validation engine yet; any move/substitute is permitted.
- Dragging catalog courses into the plan, reordering tiles within a row, drag-to-delete.
- Ask-AI from the substitute picker.
- Undo / redo.
- Persistence (local `useState` only — a refresh resets to seed).
- The slot picker's remaining stubs ("Pull from a later semester", "Apply selection") stay inert.

## 3. Move to future / earlier term

### 3.1 Interaction
The action menu's **Reschedule** section keeps its two cards: "Move to future term" and "Move to earlier term". Clicking one swaps the action-menu **body** to an inline destination view (the header and footer stay in place):

- A heading: "Move to a later semester" / "Move to an earlier semester".
- A `← Back` link → returns to the main action view.
- A list of destination cards, one per eligible semester, labelled `Sem N · <termLabel>`. "Future" lists semesters with `semIdx > tile.semIdx`; "earlier" lists `semIdx < tile.semIdx`.
- Clicking a destination card → `onMove(destinationAcademicTerm)` → `App.moveCourse` → the panel closes.

Edge handling: a course in Sem 1 has no earlier semesters, so the "Move to earlier term" card is rendered **disabled**; a course in Sem 8 has no later semesters, so "Move to future term" is **disabled**.

### 3.2 State
`ActionMenu` holds internal `moveMode: 'future' | 'earlier' | null` via `useState`. `null` = main view. A Move card sets it; `← Back` clears it. Every mutation closes the panel, so the action menu is freshly mounted (starting at `null`) next time it opens.

### 3.3 Props (added to `ActionMenu`)
- `semesters: { semIdx: number; academicTerm: number }[]` — the 8 plan semesters, passed by `App`.
- `onMove: (toAcademicTerm: number) => void`.
- `onSubstitute: () => void`.

### 3.4 Mutation
`App.moveCourse(classId: string, fromTerm: number, toTerm: number)`:

```ts
setStudentCourses((prev) =>
  prev.map((sc) =>
    sc.courseId === classId && sc.academicTerm === fromTerm
      ? { ...sc, academicTerm: toTerm }
      : sc,
  ),
);
setSelected(null);
```

Keyed on `courseId + academicTerm` (the Step 8 convention). The overlay recomputes: the course renders in the destination semester; its old semester shows an `unfilledDegreeSlot` placeholder if it was a flow `degreeClass` slot.

## 4. Substitute another course

### 4.1 Interaction
"Substitute another course" → `App` sets `selected = { kind: 'substitute', tile }`. The right panel renders `SlotPicker` with a `substitute` target. Picking a catalog course removes the old `StudentCourse` and adds the chosen course at the **same term** as `Planned`; the panel closes.

### 4.2 `SlotPickerTarget`
A third variant is added:

```ts
export type SlotPickerTarget =
  | { kind: 'slot'; tile: UnfilledTile }
  | { kind: 'addToSem'; semIdx: number; academicTerm: number }
  | { kind: 'substitute'; classId: string; semIdx: number; academicTerm: number };
```

### 4.3 `SlotPicker` behavior by target kind

| | `slot` | `addToSem` | `substitute` |
|---|---|---|---|
| Title | "Fill this slot" | "Add a course" | "Substitute a course" |
| Context line | "Originally: …" | (none) | "Replacing: `<code>` · `<name>`" |
| "Leave this slot empty" section | shown | hidden | hidden |
| Ask AI icon | shown | hidden | hidden |
| Catalog cards → `onPickCourse` | yes | yes | yes |
| Breadcrumb / search / "Pull from a later semester" stub | yes | yes | yes |

The substitute context line is derived inside `SlotPicker` via `catalogById.get(classId)` — the target carries only `classId`.

### 4.4 App state + mutation
`SelectedPanel` gains `{ kind: 'substitute'; tile: StudentCoursePlanTile }`. `App` renders `SlotPicker` with `target={{ kind: 'substitute', classId: tile.classId, semIdx: tile.semIdx, academicTerm: tile.academicTerm }}`.

`App.substituteCourse(oldClassId: string, term: number, newClassId: string)`:

```ts
setStudentCourses((prev) => [
  ...prev.filter((sc) => !(sc.courseId === oldClassId && sc.academicTerm === term)),
  { courseId: newClassId, academicTerm: term, status: 'Planned', grade: null },
]);
setSelected(null);
```

`panelAccent` stays `'action'` for the substitute panel (only `aiPanel` is `'ai'`).

## 5. Drag-and-drop move

### 5.1 Library
`@dnd-kit/core` — a new dependency. It supports mouse, touch, and keyboard with activation constraints and is accessible. Native HTML5 drag-and-drop is rejected: it does not work on touch devices, and "helpful on web and mobile" is a requirement.

### 5.2 `DndContext`
Lives in `App` (which owns the plan state and `moveCourse`), wrapping the plan area. Sensors:
- `PointerSensor` with `activationConstraint: { distance: 8 }` — a drag begins only after 8 px of pointer movement.
- `TouchSensor` with `activationConstraint: { delay: 200, tolerance: 8 }` — a drag begins after a 200 ms press.

These constraints let a plain tap/click fall through to `CourseTile`'s `onClick` (so the action menu still opens on tap), and let normal vertical touch-scroll work.

`onDragStart(event)` stores the dragged tile in `activeDrag` state. `onDragEnd(event)`: if `event.over` exists and the dropped-onto semester's `academicTerm` differs from the drag source's term, call `moveCourse(classId, fromTerm, toTerm)`; then clear `activeDrag`.

### 5.3 Draggable tiles
`CourseTile` is split for drag-and-drop:
- **`CourseTile`** becomes purely presentational. Its `studentCourse` button branch accepts optional drag props — a node `ref`, dnd `listeners`, dnd `attributes`, and an `isDragging` flag — and spreads them onto the `<button>`. With no drag props it renders exactly as today.
- **`DraggableCourseTile`** (new) wraps `CourseTile`: it calls `useDraggable` and passes the results down.

`SemRow` renders `DraggableCourseTile` for tiles that are a `studentCourse` with `status !== 'Completed'`, and plain `CourseTile` for everything else (placeholders, Completed tiles). Draggable id = `${classId}-${academicTerm}`; data = `{ tile }` (the `StudentCoursePlanTile`).

Completed tiles, `unfilledDegreeSlot` / `electiveSlot` placeholders, and the `+ Add Course` tile are not draggable — matching the action menu, which offers Move only on non-Completed courses.

### 5.4 Droppable rows
`SemRow` calls `useDroppable` with id `sem-${academicTerm}` and data `{ academicTerm }`. While a draggable is over the row (`isOver`), the row gets a highlight class. All 8 semester rows are droppable, including completed ones (see S9-D4).

### 5.5 DragOverlay
`App` renders a `<DragOverlay>` containing a plain (non-draggable) `CourseTile` for `activeDrag`. Using `DragOverlay` (rather than transforming the original tile in place) avoids clipping by scroll containers. The original tile dims (`isDragging` → reduced opacity) while its overlay is dragged. Because the overlay uses a plain `CourseTile`, no duplicate `useDraggable` id is registered.

## 6. Component changes

| Component | Change |
|---|---|
| `data/types.ts` | Add the `substitute` variant to `SlotPickerTarget`. |
| `App.tsx` | `SelectedPanel` gains `{ kind: 'substitute'; tile: StudentCoursePlanTile }`. Add `moveCourse`, `substituteCourse`. Derive the `semesters` list from `rows`. Add `DndContext` + sensors + `activeDrag` state + `onDragStart`/`onDragEnd` + `DragOverlay`. Pass `semesters` / `onMove` / `onSubstitute` to `ActionMenu`; render `SlotPicker` for the `substitute` panel. |
| `components/ActionMenu.tsx` | Add `semesters` / `onMove` / `onSubstitute` props. Add internal `moveMode` state and the inline destination view. Wire the two Move cards (→ set `moveMode`) and the Substitute card (→ `onSubstitute`). `ActionCard` gains an optional `disabled` prop. |
| `components/ActionMenu.module.css` | Styles for the destination view (back link, destination cards). |
| `components/SlotPicker.tsx` | Handle the `substitute` target — title, "Replacing: …" context line, mode flags (no Leave-empty, no Ask AI). |
| `components/CourseTile.tsx` | The `studentCourse` button branch accepts optional drag props (`ref`, `listeners`, `attributes`, `isDragging`) and spreads them onto the `<button>`. |
| `components/DraggableCourseTile.tsx` | **New.** `useDraggable` wrapper that renders `CourseTile` with drag props. |
| `components/CourseTile.module.css` | `isDragging` dim style. |
| `components/SemRow.tsx` | `useDroppable` on the row; `isOver` highlight; render `DraggableCourseTile` vs `CourseTile` per tile. |
| `components/SemRow.module.css` | Drop-target highlight style. |
| `package.json` | Add `@dnd-kit/core`. |

## 7. Acceptance criteria

| # | Criterion |
|---|---|
| S9-1 | On a non-Completed course tile, the action menu's "Move to future term" swaps the body to a list of later semesters; "Move to earlier term" lists earlier semesters. |
| S9-2 | Clicking a destination card moves the course to that semester (the overlay re-renders it there) and closes the panel. |
| S9-3 | The `← Back` link in the destination view returns to the main action view. |
| S9-4 | A course in Sem 1 has the "Move to earlier term" card disabled; a course in Sem 8 has "Move to future term" disabled. |
| S9-5 | After a move, the source semester shows an `unfilledDegreeSlot` placeholder if the moved course was a flow `degreeClass` slot. |
| S9-6 | "Substitute another course" opens the slot picker titled "Substitute a course" with a "Replacing: …" context line, no "Leave this slot empty" section, and no Ask AI icon. |
| S9-7 | Picking a catalog course in the substitute picker removes the old course and adds the chosen one at the same term as a Planned tile; the panel closes. |
| S9-8 | The slot-fill and add-to-sem slot picker modes (Step 8) still behave correctly — regression check. |
| S9-9 | Non-Completed course tiles are draggable; Completed tiles, placeholders, and the `+ Add Course` tile are not. |
| S9-10 | Dragging a course tile onto a different semester row and releasing moves the course there — the same result as the action-menu Move. |
| S9-11 | Releasing a drag on the course's own row, or outside any row, changes nothing. |
| S9-12 | A plain tap / click on a course tile still opens the action menu — the drag interaction does not swallow the click. |
| S9-13 | The semester row under the pointer highlights while dragging; a drag overlay renders the tile being dragged. |
| S9-14 | Drag-and-drop works with both a mouse and touch input. |
| S9-15 | `npm run build` and `npm run lint` both exit 0. |
| S9-16 | Every action-menu card is now functional — no remaining no-ops in the action menu. |

## 8. Decisions

| # | Decision | Rationale |
|---|---|---|
| S9-D1 | The Move destination picker is inline in the action menu, not a separate right-panel mode | User choice. Keeps the course context visible and adds no new panel scaffolding; the destination list (≤7 items) is small enough to sit in the menu body. |
| S9-D2 | Drag-and-drop uses `@dnd-kit/core` | Touch support is required ("web and mobile"); native HTML5 DnD is mouse-only. `@dnd-kit` is the modern, accessible, touch-capable React choice. |
| S9-D3 | DnD move reuses `moveCourse` | Drag-and-drop is a second entry point to the existing Move mutation, not a separate code path — one mutation, two affordances. |
| S9-D4 | All 8 semester rows are droppable, including completed ones | Consistency with the action-menu Move, which lists every earlier/later semester. With no validation engine, restricting drop targets would be arbitrary; moving a Planned course into a past semester is a permitted stub-level concession. |
| S9-D5 | `CourseTile` is split into a presentational tile + a `DraggableCourseTile` wrapper | Rendering the same `useDraggable`-hooked component in both the row and the `DragOverlay` would register a duplicate draggable id. A presentational `CourseTile` (used in the overlay) plus a thin wrapper (used in the row) avoids this cleanly. |
| S9-D6 | Substitute reuses `SlotPicker` via a third `target` variant | The catalog browser is exactly the course-source UI substitute needs; a new component would duplicate it. The variants differ only in framing. |
| S9-D7 | `moveCourse` / `substituteCourse` key on `courseId + academicTerm` | The Step 8 convention — the same course can occupy two terms (a retake, a duplicate add), so a mutation must target only the selected term's entry. |
| S9-D8 | Tap-vs-drag is resolved by dnd-kit activation constraints (8 px distance / 200 ms touch delay) | A course tile must remain both clickable (open action menu) and draggable (move). Activation constraints are dnd-kit's built-in mechanism for exactly this. |
