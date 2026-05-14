# UI v1 — Step 5 (Slot Picker + Completed-Tile Trim) — Design Spec

**Date:** 2026-05-14
**Status:** Approved for planning
**Author:** Kevin (with Claude)
**Companion to:**
- `docs/superpowers/specs/2026-05-13-ui-v1-design.md` (UI v1 — source of truth; §10.2 slot picker)
- `docs/superpowers/specs/2026-05-14-ui-v1-step-4-action-menu-design.md` (preceding step)
- `docs/superpowers/mockups/ui-v1/interaction-fill-slot.html` (locked slot-picker patterns — older 360px panel but content shapes are correct)

## 1. Goal

Activate the right panel for the other half of the click matrix: clicking an `unfilledDegreeSlot` or `electiveSlot` tile opens the **Slot picker**. Build `<SlotPicker />` next to `<ActionMenu />` as a sibling content type, widen App's panel state to handle both, and fold in the Step 4 follow-up that hides action cards on Completed tiles.

This is Step 5 of an iterative UI v1 build. After this step the right-panel content matrix is complete for the three tile kinds — Step 6+ adds real mutations.

## 2. Scope

### In scope
- **New `<SlotPicker />` component** rendering the spec §10.2 / interaction-fill-slot chrome:
  - Header (blue chrome — same `accent="action"` as ActionMenu): breadcrumb `Sem N · {term label}`, title `Fill this slot`, kind-specific context line, close `×` button top-right.
  - Body sections (4 per UI spec §10.2):
    - **Recommended** — hidden when no recommendation exists (always the case for Luke's current data; revisit when moved-tile rendering lands in a later step).
    - **Pull from a later semester** — shows "No pull-forward candidates yet." info message in both branches.
    - **Add a new course from the catalog** — renders the first 8 entries from `catalogById` (insertion order) as clickable cards. No filter, no search input.
    - **Leave this slot empty** — single card with credit-consequence text ("Sem N will run N credits short" or similar).
  - Footer: ghost `Cancel` + primary `Apply selection` buttons. Both no-op stubs.
- **Click dispatch** in App: `studentCourse` tile → action menu (Step 4 behavior preserved); `unfilledDegreeSlot` and `electiveSlot` tiles → slot picker. Re-clicking the same tile toggles closed regardless of kind.
- **Widened App state**: `selected: SelectedPanel | null` where `SelectedPanel` is the discriminated union of `{ kind: 'actionMenu'; tile: StudentCoursePlanTile }` and `{ kind: 'slotPicker'; tile: UnfilledTile }`. The right-panel JSX branches on `selected.kind`.
- **PlanTile extensions** (`types.ts`): `unfilledDegreeSlot` and `electiveSlot` variants gain `semIdx: number` + `academicTerm: number` fields. `overlay.ts` populates them. Also add a `UnfilledTile = Extract<PlanTile, { kind: 'unfilledDegreeSlot' | 'electiveSlot' }>` helper.
- **CourseTile + SemRow** route clicks to all three tile kinds (not just studentCourse). The `<button>`-vs-`<span>` rendering decision: now ALL three kinds render as `<button>` when `onClick` is provided. CSS continues to gate `cursor: pointer` on `button.tile`.
- **`.selected` ring stays scoped to studentCourse tiles only** — unfilled/elective tiles don't get a ring on click. The open panel is the visual cue.
- **Completed-tile action menu trim** (folded in): when `<ActionMenu />` opens for a tile with `status === 'Completed'` (including the gradePending case), the body shows a single info message `"This course is complete — no actions available."` instead of the 4 sections. Header still renders. `.emptyMessage` CSS rule added.

### Out of scope
- Real "Recommended" computation (would surface "move {classId} back here" — needs moved-tile rendering which is deferred).
- Catalog category filtering on `Add from catalog` (would filter by department / slot category — needs more catalog metadata).
- Catalog search input.
- AI suggestion cards.
- Real mutations (Apply, Cancel, individual cards all no-op).
- `.selected` ring on unfilled/elective tiles.
- "Pull from later" computation (just shows a static message).
- Slot-category-specific empty-state copy in "Leave empty" (Step 5 uses generic copy).

## 3. State and component changes

### App-level state

```ts
// App.tsx
type SelectedPanel =
  | { kind: 'actionMenu'; tile: StudentCoursePlanTile }
  | { kind: 'slotPicker'; tile: UnfilledTile };

const [selected, setSelected] = useState<SelectedPanel | null>(null);
```

`isPanelOpen = selected !== null`. The grid's `.noPanel` modifier is active when `selected === null`.

### Click dispatch

```ts
const handleTileClick = (tile: PlanTile) => {
  if (tile.kind === 'studentCourse') {
    if (selected?.kind === 'actionMenu' && selected.tile.classId === tile.classId) {
      setSelected(null);
    } else {
      setSelected({ kind: 'actionMenu', tile });
    }
    return;
  }
  // unfilledDegreeSlot OR electiveSlot
  if (isSameUnfilledTile(selected, tile)) {
    setSelected(null);
  } else {
    setSelected({ kind: 'slotPicker', tile });
  }
};
```

`isSameUnfilledTile` compares by content:
- For two `unfilledDegreeSlot`: same `classId` AND same `semIdx`.
- For two `electiveSlot`: same `slotType` AND same `semIdx`. (displayOrder not currently exposed on the tile; semIdx + slotType is unique enough for Luke's current data where each sem has at most one slot of each elective kind.)
- Mixed-kind comparison: false.

If displayOrder collisions appear in future flow data (two `ElectiveGenEd` in the same sem), the identity comparison can be tightened then.

### Selected-class threading

`selectedClassId` passed down to SemRow/CourseTile is `selected?.kind === 'actionMenu' ? selected.tile.classId : null`. Only studentCourse tiles render `.selected`.

### Component changes

| Component | Change |
|---|---|
| `types.ts` | Extend `unfilledDegreeSlot` + `electiveSlot` variants with `semIdx: number` and `academicTerm: number`. Add `UnfilledTile` helper export. Add `SelectedPanel` helper export (or inline in App). |
| `overlay.ts` | Populate `semIdx` and `academicTerm` when emitting unfilled-DegreeClass and elective tiles (use loop variables `semIdx` and the just-computed `academicTerm`). |
| `App.tsx` | Replace `selectedTile: StudentCoursePlanTile \| null` with `selected: SelectedPanel \| null`. Click handler dispatches on tile.kind. JSX branches `selected.kind === 'actionMenu' ? <ActionMenu .../> : <SlotPicker .../>` inside the conditional `<RightPanel accent="action">`. |
| `SemRow.tsx` | Remove the `tile.kind === 'studentCourse'` gate on `onClick` — all three kinds now wire `onClick={onTileClick ? () => onTileClick(tile) : undefined}`. Keep the gate on `selected` (still studentCourse-only). |
| `CourseTile.tsx` | Render `<button>` for unfilledDegreeSlot and electiveSlot variants when `onClick` is provided (otherwise `<span>` — for backwards compat with consumers that don't pass onClick). studentCourse always button. |
| `ActionMenu.tsx` | Add Completed-trim: if `tile.status === 'Completed'`, body renders `<p className={styles.emptyMessage}>This course is complete — no actions available.</p>` instead of the 4 sections. |
| `ActionMenu.module.css` | Add `.emptyMessage` rule (centered, muted text). |
| `SlotPicker.tsx` | NEW. Props: `{ tile: UnfilledTile; onClose: () => void }`. Renders chrome + 4 body sections + footer per §10.2. |
| `SlotPicker.module.css` | NEW. Mirrors ActionMenu.module.css for header/section/card structure with two additions: `.section.empty` for muted empty-message sections, `.catalogCard` for the catalog-entry list, `.applyBtn` for the footer primary action. |

## 4. Visual / chrome details

### Slot picker header

Per interaction-fill-slot.html lines 119–137 and UI spec §10.2:

```
┌──────────────────────────────────────────────┐
│ Sem 8 · Spring 2029                        × │
│ Fill this slot                               │
│ Originally: Tech Elective (3 cr)             │
└──────────────────────────────────────────────┘
```

- Header bg `#e3f2fd`, border-bottom `#90caf9`, same as ActionMenu.
- Breadcrumb `Sem {tile.semIdx} · {academicTermToLabel(tile.academicTerm)}` — color `#1565c0`, font-size 11px.
- Title `Fill this slot` — color `#0d47a1`, font-size 14px.
- Context line per `tile.kind`:
  - `unfilledDegreeSlot`: `Originally: {tile.code} · {tile.name}` (e.g., `Originally: MATH-2670 · Calculus III`).
  - `electiveSlot`: `Originally: {electiveLabel(tile.slotType)} ({tile.requiredCredits} cr)` (e.g., `Originally: Tech Elec (3 cr)`).
- Close `×` button top-right — same `aria-label`/style as ActionMenu close.

### Body sections

Each section header: 10px uppercase small-caps, `var(--text-label)`, with optional badge.

**Recommended** — rendered only when a recommendation exists. For Step 5, the helper `getRecommendation(tile)` always returns `null` — section is omitted.

```tsx
{rec && (
  <Section title="Recommended" badge="Best fit">
    <CatalogCard recommended ... />
  </Section>
)}
```

**Pull from a later semester** — always rendered with a count badge. For Step 5, helper `getPullForwardCandidates(tile)` returns `[]` — section shows `<p className={styles.emptyMessage}>No pull-forward candidates yet.</p>`.

**Add a new course from the catalog** — always rendered. Body is `Array.from(catalogById.values()).slice(0, 8).map(...)` — first 8 catalog entries shown as `<button>` cards. Each card: course code (bold) · name · `{credits}cr · {department}` meta line. Clicking does nothing.

**Leave this slot empty** — always rendered as a single muted card. Generic copy: `Leave this slot empty — Sem N will fall short of its credit target.`

### Footer

Two buttons:
- `Cancel` — ghost-styled, calls `onClose`.
- `Apply selection` — primary blue `#1976d2`, **disabled** in Step 5 (no selection state tracked). `disabled` attribute set; cursor changes to default.

```tsx
<div className={styles.footer}>
  <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
  <button type="button" className={styles.applyBtn} disabled>Apply selection</button>
</div>
```

The `disabled` state communicates that the picker is incomplete; once selection tracking lands in a later step, the button becomes enabled when a card is highlighted.

### Catalog card structure

Reused for both the (deferred) Recommended card and the Add-from-catalog list:

```tsx
<button type="button" className={`${styles.card} ${styles.catalogCard}`}>
  <div className={styles.cardContent}>
    <div className={styles.cardName}>{course.code}</div>
    <div className={styles.cardMeta}>{course.name} · {course.credits}cr · {course.department}</div>
  </div>
</button>
```

## 5. Completed-tile action menu trim

When `<ActionMenu />` opens for a tile with `status === 'Completed'`, the body section block is replaced with a single info message:

```tsx
<div className={styles.body}>
  {tile.status === 'Completed' ? (
    <p className={styles.emptyMessage}>This course is complete — no actions available.</p>
  ) : (
    <>
      <Section title="Update status">...</Section>
      <Section title="Reschedule">...</Section>
      <Section title="Replace">...</Section>
      <Section title="Remove">...</Section>
    </>
  )}
</div>
```

`.emptyMessage` CSS:
```css
.emptyMessage {
  text-align: center;
  color: var(--text-label);
  font-size: 12px;
  font-style: italic;
  margin: 24px 0;
}
```

Header (breadcrumb, h2, ctx, meta pills) and footer (Close button) still render normally.

The gradePending case (`status === 'Completed' && grade == null`) ALSO triggers the empty-message branch — it's still semantically Completed.

## 6. Acceptance criteria

| # | Criterion |
|---|---|
| S5-1 | Clicking an `electiveSlot` tile (e.g., one of Luke's two Sem 8 elective placeholders) opens the right panel as the Slot picker. No `.selected` ring appears on the tile. |
| S5-2 | Slot picker header for an `electiveSlot` shows breadcrumb `Sem 8 · Spring 2029`, title `Fill this slot`, context `Originally: {label} ({requiredCredits} cr)` matching the slot's type. |
| S5-3 | Slot picker body shows: NO "Recommended" section (hidden), "Pull from a later semester" section with `No pull-forward candidates yet.` message, "Add a new course from the catalog" section with **8 catalog cards** (clickable, no-op), "Leave this slot empty" section with one muted card. |
| S5-4 | Slot picker footer has `Cancel` (ghost, blue text) and `Apply selection` (primary blue, disabled). Cancel closes the panel; Apply selection does nothing (disabled). |
| S5-5 | Clicking the `×` in the slot-picker header closes the panel. Clicking the same elective tile a second time also closes. Clicking the OTHER elective tile transitions content to the new tile. |
| S5-6 | Clicking a `studentCourse` tile preserves Step 4 behavior — action menu opens, blue ring on tile, all S4 acceptance criteria continue to pass. |
| S5-7 | If an `unfilledDegreeSlot` tile exists (none in current data, but the slot-picker component supports it defensively), clicking it opens the slot picker with the unfilled-DegreeClass-flavored context line `Originally: {code} · {name}`. (Verify visually by reading the code path; runtime verification requires future flow-data changes.) |
| S5-8 | Clicking a `Completed` `studentCourse` tile (e.g., any of Luke's Sem 1 tiles) opens ActionMenu but the body shows ONLY the centered italic message `This course is complete — no actions available.` — no Update status / Reschedule / Replace / Remove sections. Header (breadcrumb, h2, ctx, Status/Grade pills) still renders. Close `×` and footer `Close` still work. |
| S5-9 | Clicking the gradePending `MATH-1650` tile (Sem 2, Completed + grade null) also shows the empty-message branch (NOT the 4 sections). |
| S5-10 | Clicking a Planned `studentCourse` tile (Luke's Sem 3 — `CPRE-2810`, `PHYS-2310`, etc.) shows the FULL action menu with 4 sections + 7 cards (Step 4 behavior preserved). |
| S5-11 | Right panel border-left is blue `#1976d2` in both action-menu and slot-picker modes (both use `<RightPanel accent="action">`). |
| S5-12 | `npm run build` exits 0. |
| S5-13 | `npm run lint` exits 0. |
| S5-14 | Visual match in browser — verified by user. |

## 7. Out-of-band notes

- **Branch:** `ui-v1/step-5-slot-picker` cut from main.
- **No tests** — same as Steps 2-4.
- **Catalog ordering**: `catalogById` is `Map<string, Course>` built from `catalogRaw.courses` in declaration order. The first 8 entries shown in "Add from catalog" are whatever appears first in the JSON. For Luke's catalog those happen to be Chem 1670, COMS 2270, COMS 2280, COMS 3090, etc. — a reasonable mix. If the ordering changes later (e.g., the data sweep reorganizes), Step 5's static catalog-section content shifts accordingly. Not a bug; documented for future reviewers.
- **`disabled` Apply button**: keeping the button visible but disabled (rather than hidden) telegraphs the intent — once selection tracking lands, the same button enables. Better than rebuilding the footer.
- **`tile.kind` discrimination cleanup**: SemRow currently has `tile.kind === 'studentCourse' && onTileClick ? ...` — Step 5 widens to `onTileClick ? ...` (route all kinds). The `selected` prop stays gated on studentCourse since only those get the ring. This also incidentally addresses the Step 4 reviewer's note about `selected={false}` semantic looseness — non-studentCourse tiles now correctly receive `selected={undefined}` via the explicit-check pattern.

## 8. Decisions log

| # | Decision | Rationale |
|---|---|---|
| S5-D1 | Slot picker uses the same `<RightPanel accent="action">` wrapper as ActionMenu | Both modes share blue chrome per the locked mockups. Reuses the existing accent infrastructure. |
| S5-D2 | `selected` state becomes a discriminated union (`actionMenu \| slotPicker`) | The two panel modes need different tile types — a union keeps each branch type-safe without a sentinel. |
| S5-D3 | `.selected` ring stays scoped to studentCourse tiles only | The open panel itself is the visual cue for unfilled/elective; the ring would muddy the visual hierarchy. |
| S5-D4 | "Recommended" section hidden when empty (vs. shown with placeholder) | A "no recommendation" message in a section called "Recommended" is contradictory. Hide cleanly. |
| S5-D5 | "Pull from later" + "Add from catalog" always rendered, even when empty/static | Sections always-visible communicate that the affordances exist; the body content adapts. |
| S5-D6 | "Add from catalog" shows first 8 entries (no filter) | Real category-aware filtering needs catalog metadata we don't have yet. 8 is enough to fill the body visually; arbitrary cap kept small to avoid scrolling. |
| S5-D7 | Apply button is `disabled` (not hidden) | Telegraphs the affordance exists but isn't ready. Selection state lands in a later step. |
| S5-D8 | Folded Completed-trim into Step 5 | User explicitly deferred from Step 4 review. Small change (~10 lines + 1 CSS rule) that thematically fits with right-panel content work. |
| S5-D9 | gradePending tiles get the same Completed-trim treatment | Semantically Completed; the action set would be identical. |
| S5-D10 | unfilled/elective tile identity uses content fields (classId+semIdx for unfilled; slotType+semIdx for elective) | Object identity isn't stable across PLAN rebuilds; content comparison is robust. |

## 9. Open items

- None blocking Step 5. Real recommended/pull-forward logic, catalog filtering, AI cards, and mutations all land in later steps. After this step the right-panel content matrix is complete for the three current tile kinds; the next natural focus is making the action surfaces do something (Step 6+).
