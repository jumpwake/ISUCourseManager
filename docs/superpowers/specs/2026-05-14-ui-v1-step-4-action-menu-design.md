# UI v1 — Step 4 (Action Menu) — Design Spec

**Date:** 2026-05-14
**Status:** Approved for planning
**Author:** Kevin (with Claude)
**Companion to:**
- `docs/superpowers/specs/2026-05-13-ui-v1-design.md` (UI v1 — source of truth; §10.1 action menu)
- `docs/superpowers/specs/2026-05-14-ui-v1-step-3-plan-view-overlay-design.md` (preceding step)
- `docs/superpowers/mockups/ui-v1/interaction-direct-manipulation.html` (locked interaction patterns)

## 1. Goal

Activate the right panel for the first time with real content: clicking a `studentCourse` tile opens the **Action menu** keyed to that tile. Build the `<ActionMenu />` component, convert `<RightPanel />` into a layout wrapper that can host multiple content types, and replace Step 2's debug `[panel]` toggle with real selection state. All action buttons are **no-op stubs** this step — Step 4 is about the interaction surface, not the mutations.

This is Step 4 of an iterative UI v1 build. Step 5 will add the slot picker (clicking unfilled-slot tiles + elective placeholders).

## 2. Scope

### In scope
- **Click triggers** on `<CourseTile />`:
  - `studentCourse` tile → right panel opens as Action menu keyed to that tile.
  - `unfilledDegreeSlot` and `electiveSlot` tiles → click is ignored this step (slot picker lands in Step 5).
  - Re-clicking the currently-selected tile closes the panel.
- **App-level state**: `selectedTile: StudentCoursePlanTile | null` (typed narrowly — the panel only handles studentCourse tiles for Step 4). Replaces Step 2's `isPanelOpen: boolean`.
- **`<RightPanel />` becomes a wrapper** with `accent: 'ai' | 'action'` prop (default `'ai'`) and `children`. The accent prop selects between two CSS classes that locally override `--panel-accent`. Drops the `hidden` prop — App decides whether to render `<RightPanel />` based on `selectedTile != null`.
- **New `<ActionMenu />` component** rendering the spec §10.1 / interaction-direct-manipulation chrome:
  - Header bg `#e3f2fd`, border-bottom `#90caf9`, blue left-border via the parent RightPanel's `accent="action"`.
  - Breadcrumb (`Sem N · {term label}`), H2 course code + name (e.g., `MATH-1650 · Calc I`), context line (department + credits), meta-pill row (`Status: X`, `Grade: Y` if Completed, omit otherwise).
  - Close `×` in the top-right corner of the header.
  - Body sections (each titled in uppercase 10px small-caps):
    - **Update status:** Mark Completed / Mark In Progress / Mark Failed-or-Cancelled (red danger-styled).
    - **Reschedule:** Move to future term / Move to earlier term.
    - **Replace:** Substitute another course.
    - **Remove:** Remove from plan (red danger-styled).
  - Footer: ghost `Close` button (same effect as `×`).
- **Action cards are no-op buttons** this step. Clicking does nothing (or shows a small "coming soon" toast — see open items).
- **Selected state**: the clicked tile gets `.selected` per UI spec §5 — `box-shadow: 0 0 0 3px #1976d2, 0 4px 12px rgba(25,118,210,.4)` + `transform: scale(1.04)`. Clicking another tile moves the ring; clicking close clears it.
- **Debug `[panel]` toggle in TopBar is removed**. Its props (`isPanelOpen`, `onTogglePanel`) come off.

### Out of scope
- Slot picker (Step 5).
- AI panel mode (still purple; defaults preserved).
- **Real mutations** — no actual move, mark-completed, remove, substitute.
- Inline destination picker (the green-highlighted recommended-sem buttons under "Move to future" in the mockup). The card itself renders, click does nothing.
- Grade picker dropdown on "Mark Completed". Same — card renders, no popup.
- Validation banner / suggested-fix card / sibling-issue grouping.
- Drag-and-drop tile moves.
- Keyboard accessibility (Esc-to-close, Tab focus management, arrow-key navigation). Locked behind a future accessibility-audit step.
- Tests / Storybook (still deferred).

## 3. State and component changes

### App-level state

```ts
// App.tsx
const [selectedTile, setSelectedTile] = useState<StudentCoursePlanTile | null>(null);

// Type alias for clarity (add to data/types.ts if useful):
type StudentCoursePlanTile = Extract<PlanTile, { kind: 'studentCourse' }>;
```

Setting `selectedTile` mounts the panel. The grid's `.noPanel` modifier is active when `selectedTile === null`.

### Component changes

| Component | Change |
|---|---|
| `App.tsx` | Replace `isPanelOpen` with `selectedTile`. Build `appClassName` from `selectedTile !== null`. Pass `onTileClick` down to `<PlanView />`. Conditionally render `<RightPanel accent="action"><ActionMenu tile={selectedTile} onClose={...} /></RightPanel>` when `selectedTile != null`. |
| `TopBar.tsx` | Remove debug `[panel]` button + `isPanelOpen` / `onTogglePanel` props. Drop the `.debugToggle` CSS rule from TopBar.module.css. |
| `RightPanel.tsx` | Rewrite. Take `accent: 'ai' \| 'action'` (default `'ai'`) and `children`. Render `<aside class="panel accent-X">{children}</aside>`. Drop the `hidden` prop. |
| `RightPanel.module.css` | Drop `.hidden` rule. Add `.accentAi { --panel-accent: var(--ai-start); }` and `.accentAction { --panel-accent: #1976d2; }` modifier classes. Existing `border-left: 2px solid var(--panel-accent)` rule unchanged. |
| `PlanView.tsx` | Add `onTileClick: (tile: PlanTile) => void` and `selectedClassId: string \| null` props. Thread through `SemRow`. |
| `SemRow.tsx` | Same props as PlanView; thread to `CourseTile`. |
| `CourseTile.tsx` | Add `onClick?: () => void` and `selected?: boolean` props. Wire click handler on the `<span>`. Apply `.selected` class when `selected` is true. Only `studentCourse` tiles get clickable behavior — others render with `onClick` undefined. Add `cursor: pointer` to clickable tiles. |
| `CourseTile.module.css` | Add `.selected` rule with the spec §5 box-shadow + scale. |
| `ActionMenu.tsx` | New. Renders the action menu chrome (header, body sections, footer). Props: `{ tile: StudentCoursePlanTile; onClose: () => void }`. Buttons are `<button type="button">` no-ops. |
| `ActionMenu.module.css` | New. Header bg `#e3f2fd`, border-bottom `#90caf9`, blue h2 color `#0d47a1`, meta pills white-bg `#b3e5fc` border. Action cards `1px solid var(--border)`, hover bg `#f8f9fa`, danger variant `color: #c62828`. |

### Click resolution rule

The `onTileClick` handler in App:
```ts
const onTileClick = (tile: PlanTile) => {
  if (tile.kind !== 'studentCourse') return;            // Step 4: only studentCourse opens panel
  if (selectedTile?.classId === tile.classId) {
    setSelectedTile(null);                              // toggle close
  } else {
    setSelectedTile(tile);
  }
};
```

`selectedClassId` (passed to PlanView/SemRow/CourseTile) is `selectedTile?.classId ?? null`. CourseTile applies `.selected` when `tile.kind === 'studentCourse' && tile.classId === selectedClassId`.

## 4. Visual / chrome details

### Action menu header

Per interaction-direct-manipulation.html lines 150–161 and UI spec §10.1:

```
┌──────────────────────────────────────────┐
│ Sem 2 · Spring 2026                    × │   ← .breadcrumb, .close
│ MATH-1650 · Calc I                       │   ← h2
│ Department: Math · 4 credits             │   ← .ctx
│ ┌──────┐ ┌──────┐                        │
│ │Status│ │Grade │                        │   ← .meta-row meta pills (white bg, b3e5fc border)
│ │Plan-│ │ A    │                        │
│ │ned   │ │      │                        │
│ └──────┘ └──────┘                        │
└──────────────────────────────────────────┘
```

Header values come from the tile:
- Breadcrumb term label: `academicTermToLabel(tile_term)` — but Step 4 tile data only has `status`/`grade`/`credits`/etc., not the term. The closest source is the StudentCourse the tile was built from. **Decision:** pass `tile_term` into the `studentCourse` variant of `PlanTile` (add `academicTerm: number` field). The overlay function already has it from the StudentCourse, just doesn't propagate it. One-line change.
- H2: `{tile.classId} · {tile.name}` (e.g., `MATH-1650 · Calc I`).
- Ctx: `Department: {tile.dept} · {tile.credits} credits` (note: `tile.dept` is the CSS class, e.g., `"math"`. Spec text reuses the original department name from the catalog — propagate the catalog's `department` string too. Add `deptDisplay: string` to the `studentCourse` variant so we have both the CSS class and the display string).
- Meta pills: `Status: {tile.status}`, and `Grade: {tile.grade}` if `tile.grade != null` (omit pill otherwise; grade-pending tiles still get rendered but no Grade pill).

### Action card sections

Each section: H3 (10px uppercase small-caps `#5a6573`) followed by stacked action cards. Card structure per interaction-direct-manipulation lines 165–179:

```
<button class="action-card">
  <span class="icon">→</span>
  <div class="ac-content">
    <div class="ac-name">Move to future term</div>
    <div class="ac-meta">Pre-req not met / scheduling conflict</div>
  </div>
</button>
```

Hover: bg `#f8f9fa`, border `#1976d2`. Danger variant: name color `#c62828`, hover bg `#ffebee`, hover border `#ef5350`.

Icons (single chars): `✓` Mark Completed, `⏵` Mark In Progress, `⚠` Mark Failed, `→` Move to future, `←` Move to earlier, `⇄` Substitute, `×` Remove.

Meta lines (each card's `.ac-meta`) — flavor text from the mockup:
- Mark Completed: `"Set grade"`
- Mark In Progress: `"Currently enrolled this term"`
- Mark Failed/Cancelled: `"Will trigger cascade for downstream prereqs"`
- Move to future: `"Pre-req not met / scheduling conflict"`
- Move to earlier: `"Take ahead of recommended schedule"`
- Substitute: `"Pick a course that satisfies this slot"`
- Remove: `"Take the slot back to unfulfilled"`

### Selected tile ring

Per UI spec §5 / interaction-direct-manipulation `.tile.selected`:
```css
.selected {
  box-shadow: 0 0 0 3px #1976d2, 0 4px 12px rgba(25, 118, 210, 0.4);
  transform: scale(1.04);
  z-index: 1;
}
```

Add to `CourseTile.module.css` AFTER the dept tints (so it wins on equal-specificity over the dept border-color if needed — actually `box-shadow` doesn't conflict, but ordering for safety).

## 5. PlanTile type extension

Add to `src/data/types.ts`:

```ts
export type PlanTile =
  | {
      kind: 'studentCourse';
      classId: string;
      code: string;
      name: string;
      credits: number;
      dept: string;            // CSS class (lowercase, normalized)
      deptDisplay: string;     // original catalog department string ("Math", "Com S", "HDFS")  ← NEW
      status: StudentCourseStatus;
      grade: string | null;
      academicTerm: number;    // ← NEW (YYYYSS — for breadcrumb term label)
    }
  | { kind: 'unfilledDegreeSlot'; classId: string; code: string; name: string; credits: number; dept: string; }
  | { kind: 'electiveSlot'; slotType: ElectiveSlotType; requiredCredits: number; };
```

Update `overlay.ts` to populate the new fields when building studentCourse tiles:
```ts
tiles.push({
  kind: 'studentCourse',
  ...
  deptDisplay: course.department,
  academicTerm: sc.academicTerm,
});
```

## 6. Acceptance criteria

| # | Criterion |
|---|---|
| S4-1 | The debug `[panel]` toggle is removed from the TopBar. |
| S4-2 | Default state (no selection): right-panel column collapsed exactly as in Step 3. |
| S4-3 | Clicking a `studentCourse` tile opens the right panel with the Action menu. The clicked tile gains the `.selected` blue ring and 1.04 scale. |
| S4-4 | Clicking a different `studentCourse` tile moves the selection: ring transfers, panel content updates with the new tile's metadata. |
| S4-5 | Clicking the currently-selected tile closes the panel and clears the ring. |
| S4-6 | Clicking the panel's `×` (top-right of header) or the footer `Close` button closes the panel and clears the ring. |
| S4-7 | Clicking an `unfilledDegreeSlot` or `electiveSlot` tile does NOTHING (no panel opens, no ring). Hover state still works. |
| S4-8 | Action menu header shows the correct breadcrumb (`Sem N · Fall YYYY`), H2 (`{classId} · {name}`), context (`Department: {deptDisplay} · {credits} credits`), and meta pills (`Status: X`, plus `Grade: Y` only when grade is non-null). |
| S4-9 | Action menu body has the 4 documented sections (Update status, Reschedule, Replace, Remove) in that order, with the 7 action cards in the specified order. |
| S4-10 | Each action card is a `<button type="button">` with the documented icon + name + meta line. Clicking does nothing (no console error, no panel close, no state change). Danger-styled cards (Mark Failed, Remove) use red text. |
| S4-11 | The right panel's left border is blue `#1976d2` when in action-menu mode (not the default purple). Implemented via `<RightPanel accent="action">` setting a local `--panel-accent` override. |
| S4-12 | `npm run build` exits 0. |
| S4-13 | `npm run lint` exits 0. |
| S4-14 | Visual match in browser verified by user. |

## 7. Out-of-band notes

- **Branch:** `ui-v1/step-4-action-menu` cut from main (Step 3 already merged).
- **No tests** — same as Steps 2/3.
- **Coming-soon toast** (for clicks on no-op buttons) is explicitly OUT of scope. Buttons are visually live but functionally inert; the next mutation step will replace each no-op with a real handler. If user feedback later asks for "show me something happened when I click", a 1-line toast can be added then.
- **Click resolution rule** (§3) is the only place tile.kind branches. Keeping it in App.tsx keeps CourseTile click-handler-agnostic (it just calls `onClick` if provided).

## 8. Decisions log

| # | Decision | Rationale |
|---|---|---|
| S4-D1 | Trim to action-menu-only (defer slot picker to Step 5) | User preference; slot picker is the bigger half (4 sections, list computations). |
| S4-D2 | Remove the debug `[panel]` toggle this step | Real triggers (tile clicks) replace it. The toggle was always temporary. |
| S4-D3 | `selectedTile` is the panel-state primitive (vs. `isPanelOpen` bool) | The panel content is tile-keyed; tracking the tile directly is simpler than maintaining two state fields. |
| S4-D4 | `<RightPanel />` becomes a wrapper with `accent` prop | Forward-compatible with Step 5 (slot picker also blue) and the eventual AI panel mode (purple). Centralizes the panel chrome (grid-area, border) in one place. |
| S4-D5 | Action cards are no-op stubs | Mutations need either local state (and a refactor when MSW lands) or MSW (which isn't here yet). No-op stubs let the visual surface land without committing. |
| S4-D6 | Only `studentCourse` tiles fire clicks (not unfilled/elective) | Slot picker handles those in Step 5. Defer to keep Step 4 tight. |
| S4-D7 | Add `academicTerm` + `deptDisplay` to the `studentCourse` PlanTile variant | The action menu's breadcrumb and ctx line need them; cleaner than re-querying the source `StudentCourse` from the tile. |
| S4-D8 | Click handler lives in App (single click resolution function) | One place to branch on `tile.kind`. CourseTile stays kind-agnostic. |

## 9. Open items

- None blocking Step 4. Step 5 picks up the slot picker; Step 6+ adds real mutations (local state first, then MSW-mediated).
