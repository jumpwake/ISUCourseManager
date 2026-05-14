# UI v1 Step 5 (Slot Picker + Completed-Tile Trim) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the right-panel slot picker for unfilled/elective tile clicks (4 sections per UI spec §10.2, all no-op stubs); widen App's panel state to discriminate `actionMenu` vs `slotPicker`; fold in the deferred Completed-tile action-menu trim.

**Architecture:** App state becomes a discriminated `SelectedPanel` union (actionMenu | slotPicker | null). Click handler dispatches by `tile.kind`. New `<SlotPicker />` mounts inside `<RightPanel accent="action">` parallel to `<ActionMenu />`. `<CourseTile />` allows unfilled/elective variants to render as `<button>` when an `onClick` is supplied; `<SemRow />` removes its studentCourse-only click gate.

**Tech Stack:** Same as Step 4. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-14-ui-v1-step-5-slot-picker-design.md`

**Branch:** `ui-v1/step-5-slot-picker` (cut from main; spec committed at `ce4952a`).

---

## File Structure

**Create:**
- `src/ISUCourseManager.Web/src/components/SlotPicker.tsx`
- `src/ISUCourseManager.Web/src/components/SlotPicker.module.css`

**Modify:**
- `src/ISUCourseManager.Web/src/data/types.ts` — extend `unfilledDegreeSlot` + `electiveSlot` PlanTile variants with `semIdx: number` + `academicTerm: number`; add `UnfilledTile` helper export.
- `src/ISUCourseManager.Web/src/data/overlay.ts` — populate the 2 new fields on both unfilled-DegreeClass and elective tiles.
- `src/ISUCourseManager.Web/src/components/ActionMenu.tsx` — add `Completed` status check; render empty message instead of body sections when Completed.
- `src/ISUCourseManager.Web/src/components/ActionMenu.module.css` — add `.emptyMessage` rule.
- `src/ISUCourseManager.Web/src/components/CourseTile.tsx` — render `<button>` for `unfilledDegreeSlot` and `electiveSlot` when `onClick` is provided (otherwise `<span>` — backwards-compatible).
- `src/ISUCourseManager.Web/src/components/SemRow.tsx` — remove the `tile.kind === 'studentCourse'` gate on `onClick`; pass `onClick={onTileClick ? () => onTileClick(tile) : undefined}` for ALL tile kinds. Keep `selected` gated on studentCourse only.
- `src/ISUCourseManager.Web/src/App.tsx` — widen state from `selectedTile: StudentCoursePlanTile | null` to `selected: SelectedPanel | null` (discriminated union). Rewrite `handleTileClick` to dispatch by kind. Conditionally render `<ActionMenu>` or `<SlotPicker>` inside `<RightPanel accent="action">`.

---

## Notes for the executor

- **Run all commands from the repo root: `C:/Users/lukeb/source/repos/ISUCourseManager`**. Use `npm --prefix src/ISUCourseManager.Web run <script>`. Do NOT `cd`.
- **TypeScript strictness:** `verbatimModuleSyntax: true` (use `import type`), `noUnusedLocals: true`, `allowImportingTsExtensions: true` (keep `.ts`/`.tsx`), `erasableSyntaxOnly: true`.
- **Commit style:** Conventional Commits, `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer.

---

## Pre-flight: confirm starting state

- [ ] **Step 1: Confirm branch + clean working tree**

```
git status
git rev-parse --abbrev-ref HEAD
```

Expected: branch `ui-v1/step-5-slot-picker`. Working tree clean (or only `.claude/` untracked).

- [ ] **Step 2: Confirm Step 4 build still passes**

```
npm --prefix src/ISUCourseManager.Web run build
npm --prefix src/ISUCourseManager.Web run lint
```

Expected: both exit 0.

---

## Task 1: Extend `PlanTile` and `buildOverlay`

**Files:**
- Modify: `src/ISUCourseManager.Web/src/data/types.ts`
- Modify: `src/ISUCourseManager.Web/src/data/overlay.ts`

- [ ] **Step 1: Update `types.ts`**

Edit `src/ISUCourseManager.Web/src/data/types.ts`. Replace the `PlanTile` export with:

```ts
export type PlanTile =
  | {
      kind: 'studentCourse';
      classId: string;
      code: string;
      name: string;
      credits: number;
      dept: string;
      deptDisplay: string;
      status: StudentCourseStatus;
      grade: string | null;
      academicTerm: number;
      semIdx: number;
    }
  | {
      kind: 'unfilledDegreeSlot';
      classId: string;
      code: string;
      name: string;
      credits: number;
      dept: string;
      academicTerm: number;
      semIdx: number;
    }
  | {
      kind: 'electiveSlot';
      slotType: ElectiveSlotType;
      requiredCredits: number;
      academicTerm: number;
      semIdx: number;
    };
```

Then, at the end of the file (after the existing `StudentCoursePlanTile` line), add:

```ts
export type UnfilledTile = Extract<PlanTile, { kind: 'unfilledDegreeSlot' | 'electiveSlot' }>;
```

- [ ] **Step 2: Update `overlay.ts` to populate the new fields**

Edit `src/ISUCourseManager.Web/src/data/overlay.ts`. Inside the inner `for (const slot of slotsThisSem)` loop, modify both `tiles.push(...)` calls:

Find the `unfilledDegreeSlot` push (inside `if (slot.kind === 'degreeClass')`) and update it to:

```ts
tiles.push({
  kind: 'unfilledDegreeSlot',
  classId: course.classId,
  code: course.code,
  name: course.name,
  credits: course.credits,
  dept: departmentToCssClass(course.department),
  academicTerm,
  semIdx,
});
```

Find the `electiveSlot` push (in the `else` branch) and update it to:

```ts
tiles.push({
  kind: 'electiveSlot',
  slotType: slot.slotType,
  requiredCredits: slot.requiredCredits,
  academicTerm,
  semIdx,
});
```

(`academicTerm` and `semIdx` are already in scope from the outer `for (let semIdx = 1; ...)` loop and the `flowSemToAcademicTerm` call.)

- [ ] **Step 3: Verify build**

```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0. CourseTile / SemRow don't reference the new fields yet — discriminated-union extension is non-breaking.

- [ ] **Step 4: Commit**

```
git add src/ISUCourseManager.Web/src/data/types.ts src/ISUCourseManager.Web/src/data/overlay.ts
git commit -m "$(cat <<'EOF'
feat(ui): extend PlanTile unfilled/elective variants with sem fields

Adds semIdx + academicTerm to unfilledDegreeSlot and electiveSlot
variants so the SlotPicker header can render a breadcrumb. Adds
UnfilledTile helper type for the picker's tile prop.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add `<SlotPicker />` component

**Files:**
- Create: `src/ISUCourseManager.Web/src/components/SlotPicker.tsx`
- Create: `src/ISUCourseManager.Web/src/components/SlotPicker.module.css`

- [ ] **Step 1: Create `SlotPicker.module.css`**

```css
.picker {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.header {
  background: #e3f2fd;
  padding: 12px 16px;
  border-bottom: 1px solid #90caf9;
}

.headerTop {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 4px;
  gap: 8px;
}

.breadcrumb {
  font-size: 11px;
  color: #1565c0;
}

.close {
  background: transparent;
  border: none;
  color: #1565c0;
  font-size: 18px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  font-weight: 400;
}

.close:hover {
  color: #0d47a1;
}

.title {
  font-size: 14px;
  margin: 0;
  color: #0d47a1;
}

.ctx {
  font-size: 11px;
  color: #455a64;
  margin-top: 6px;
}

.body {
  padding: 12px 16px;
  flex-grow: 1;
  overflow-y: auto;
}

.section {
  margin-bottom: 16px;
}

.sectionTitle {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-label);
  font-weight: 700;
  margin: 0 0 6px 0;
}

.card {
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 8px 10px;
  margin-bottom: 6px;
  cursor: pointer;
  background: #fff;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  text-align: left;
  font: inherit;
}

.card:hover {
  background: #f8f9fa;
  border-color: #1976d2;
}

.cardContent {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}

.cardName {
  font-weight: 700;
  font-size: 12px;
}

.cardMeta {
  font-size: 10px;
  color: var(--text-label);
  margin-top: 2px;
}

.muted {
  background: var(--bg-sidebar);
}

.emptyMessage {
  text-align: center;
  color: var(--text-label);
  font-size: 11px;
  font-style: italic;
  padding: 8px 0;
  margin: 0;
}

.footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border-soft);
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  background: var(--bg-sidebar);
}

.cancelBtn {
  padding: 6px 12px;
  font-size: 12px;
  border-radius: 4px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  color: var(--text-label);
  font: inherit;
}

.cancelBtn:hover {
  background: #f8f9fa;
  color: var(--text-default);
}

.applyBtn {
  padding: 6px 12px;
  font-size: 12px;
  border-radius: 4px;
  border: 1px solid #1565c0;
  background: #1976d2;
  color: white;
  cursor: pointer;
  font: inherit;
}

.applyBtn:disabled {
  background: #90caf9;
  border-color: #90caf9;
  cursor: default;
}
```

- [ ] **Step 2: Create `SlotPicker.tsx`**

```tsx
import type { ReactNode } from 'react';
import type { ElectiveSlotType, UnfilledTile } from '../data/types.ts';
import { academicTermToLabel } from '../data/academicTerm.ts';
import { catalogById } from '../data/catalog.ts';
import styles from './SlotPicker.module.css';

type Props = {
  tile: UnfilledTile;
  onClose: () => void;
};

export function SlotPicker({ tile, onClose }: Props) {
  const ctx = contextLine(tile);
  const catalogPreview = Array.from(catalogById.values()).slice(0, 8);

  return (
    <div className={styles.picker}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.breadcrumb}>
            Sem {tile.semIdx} · {academicTermToLabel(tile.academicTerm)}
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close slot picker"
          >
            ×
          </button>
        </div>
        <h2 className={styles.title}>Fill this slot</h2>
        <div className={styles.ctx}>{ctx}</div>
      </div>

      <div className={styles.body}>
        <Section title="Pull from a later semester">
          <p className={styles.emptyMessage}>No pull-forward candidates yet.</p>
        </Section>

        <Section title="Add a new course from the catalog">
          {catalogPreview.map((course) => (
            <button key={course.classId} type="button" className={styles.card}>
              <span className={styles.cardContent}>
                <span className={styles.cardName}>{course.code}</span>
                <span className={styles.cardMeta}>
                  {course.name} · {course.credits}cr · {course.department}
                </span>
              </span>
            </button>
          ))}
        </Section>

        <Section title="Leave this slot empty">
          <button type="button" className={`${styles.card} ${styles.muted}`}>
            <span className={styles.cardContent}>
              <span className={styles.cardName}>Leave this slot empty</span>
              <span className={styles.cardMeta}>
                Sem {tile.semIdx} will fall short of its credit target.
              </span>
            </span>
          </button>
        </Section>
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.cancelBtn} onClick={onClose}>
          Cancel
        </button>
        <button type="button" className={styles.applyBtn} disabled>
          Apply selection
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {children}
    </div>
  );
}

function contextLine(tile: UnfilledTile): string {
  if (tile.kind === 'unfilledDegreeSlot') {
    return `Originally: ${tile.code} · ${tile.name}`;
  }
  return `Originally: ${electiveLabel(tile.slotType)} (${tile.requiredCredits}cr)`;
}

function electiveLabel(slotType: ElectiveSlotType): string {
  switch (slotType) {
    case 'ElectiveGenEd':
      return 'Gen Ed';
    case 'ElectiveMath':
      return 'Math Elec';
    case 'ElectiveTech':
      return 'Tech Elec';
    case 'ElectiveCybE':
      return 'CybE Elec';
    case 'ElectiveCprE':
      return 'CprE Elec';
  }
}
```

- [ ] **Step 3: Verify build**

```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0. SlotPicker is unused so far.

- [ ] **Step 4: Commit**

```
git add src/ISUCourseManager.Web/src/components/SlotPicker.tsx src/ISUCourseManager.Web/src/components/SlotPicker.module.css
git commit -m "$(cat <<'EOF'
feat(ui): add SlotPicker component with 4 sections + disabled Apply

Renders the spec §10.2 / interaction-fill-slot chrome: blue header
(breadcrumb, "Fill this slot", kind-specific ctx, close ×),
3 body sections (Pull from later — empty message; Add from catalog
— first 8 entries; Leave empty — single card), footer (Cancel ghost,
Apply selection disabled). All cards no-op stubs.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Trim the action menu when status is Completed

**Files:**
- Modify: `src/ISUCourseManager.Web/src/components/ActionMenu.tsx`
- Modify: `src/ISUCourseManager.Web/src/components/ActionMenu.module.css`

- [ ] **Step 1: Replace `ActionMenu.tsx` body section**

In `ActionMenu.tsx`, find the body block (the `<div className={styles.body}>` containing the 4 `<Section>` calls). Replace it with:

```tsx
      <div className={styles.body}>
        {tile.status === 'Completed' ? (
          <p className={styles.emptyMessage}>
            This course is complete — no actions available.
          </p>
        ) : (
          <>
            <Section title="Update status">
              <ActionCard icon="✓" name="Mark Completed" meta="Set grade" />
              <ActionCard icon="⏵" name="Mark In Progress" meta="Currently enrolled this term" />
              <ActionCard icon="⚠" name="Mark Failed / Cancelled" meta="Will trigger cascade for downstream prereqs" danger />
            </Section>
            <Section title="Reschedule">
              <ActionCard icon="→" name="Move to future term" meta="Pre-req not met / scheduling conflict" />
              <ActionCard icon="←" name="Move to earlier term" meta="Take ahead of recommended schedule" />
            </Section>
            <Section title="Replace">
              <ActionCard icon="⇄" name="Substitute another course" meta="Pick a course that satisfies this slot" />
            </Section>
            <Section title="Remove">
              <ActionCard icon="×" name="Remove from plan" meta="Take the slot back to unfulfilled" danger />
            </Section>
          </>
        )}
      </div>
```

Everything outside the body div (header, footer, helpers) stays the same.

- [ ] **Step 2: Append `.emptyMessage` rule to `ActionMenu.module.css`**

Add this rule at the end of `ActionMenu.module.css`:

```css
.emptyMessage {
  text-align: center;
  color: var(--text-label);
  font-size: 12px;
  font-style: italic;
  margin: 24px 0;
}
```

- [ ] **Step 3: Verify build**

```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```
git add src/ISUCourseManager.Web/src/components/ActionMenu.tsx src/ISUCourseManager.Web/src/components/ActionMenu.module.css
git commit -m "$(cat <<'EOF'
feat(ui): trim ActionMenu body to info message for Completed tiles

Completed (including gradePending) student-course tiles no longer
show stub Update-status/Reschedule/Replace/Remove sections — the
course is finished, no actions apply. Header and footer still
render.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Allow `<CourseTile />` to render unfilled/elective as `<button>` when `onClick` is provided

**Files:**
- Modify: `src/ISUCourseManager.Web/src/components/CourseTile.tsx`

The studentCourse branches stay as-is (always `<button>`). The unfilled/elective branches now render `<button>` when `onClick` is provided, else `<span>` (backwards-compatible).

- [ ] **Step 1: Replace `CourseTile.tsx` with**:

```tsx
import type { ElectiveSlotType, PlanTile, StudentCourseStatus } from '../data/types.ts';
import styles from './CourseTile.module.css';

type Props = {
  tile: PlanTile;
  onClick?: () => void;
  selected?: boolean;
};

export function CourseTile({ tile, onClick, selected = false }: Props) {
  if (tile.kind === 'electiveSlot') {
    const className = `${styles.tile} ${styles.electiveEmpty}`;
    const inner = (
      <>
        {electiveLabel(tile.slotType)}
        <small>{tile.requiredCredits}cr</small>
      </>
    );
    return onClick ? (
      <button type="button" className={className} onClick={onClick}>{inner}</button>
    ) : (
      <span className={className}>{inner}</span>
    );
  }

  if (tile.kind === 'unfilledDegreeSlot') {
    const className = `${styles.tile} ${styles.planned} ${styles[tile.dept]}`;
    const inner = (
      <>
        {tile.code}
        <small>{tile.credits}cr</small>
      </>
    );
    return onClick ? (
      <button type="button" className={className} onClick={onClick}>{inner}</button>
    ) : (
      <span className={className}>{inner}</span>
    );
  }

  // studentCourse — always render as <button>
  const selectedClass = selected ? ` ${styles.selected}` : '';

  if (tile.status === 'Completed' && !tile.grade) {
    return (
      <button
        type="button"
        className={`${styles.tile} ${styles.gradePending}${selectedClass}`}
        onClick={onClick}
      >
        {tile.code}
        <small><i>grade pending</i></small>
      </button>
    );
  }

  const statusClass = statusToClass(tile.status);
  const subtitle =
    tile.status === 'Completed' ? `${tile.grade} · ${tile.credits}cr` : `${tile.credits}cr`;
  return (
    <button
      type="button"
      className={`${styles.tile} ${styles[statusClass]} ${styles[tile.dept]}${selectedClass}`}
      onClick={onClick}
    >
      {tile.code}
      <small>{subtitle}</small>
    </button>
  );
}

function statusToClass(status: StudentCourseStatus): string {
  switch (status) {
    case 'Completed':
      return 'completed';
    case 'InProgress':
      return 'inprogress';
    case 'Planned':
      return 'planned';
    case 'Failed':
      return 'failed';
    case 'Withdrawn':
      return 'planned';
  }
}

function electiveLabel(slotType: ElectiveSlotType): string {
  switch (slotType) {
    case 'ElectiveGenEd':
      return 'Gen Ed';
    case 'ElectiveMath':
      return 'Math Elec';
    case 'ElectiveTech':
      return 'Tech Elec';
    case 'ElectiveCybE':
      return 'CybE Elec';
    case 'ElectiveCprE':
      return 'CprE Elec';
  }
}
```

CSS rule `button.tile { cursor: pointer; font: inherit; }` (added in Step 4) applies to all button.tile variants — unfilled/elective buttons inherit pointer cursor automatically.

- [ ] **Step 2: Verify build**

```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0. SemRow currently passes `onClick=undefined` for non-studentCourse (Step 4 gating) so unfilled/elective still render as `<span>`. Task 5 changes SemRow.

- [ ] **Step 3: Commit**

```
git add src/ISUCourseManager.Web/src/components/CourseTile.tsx
git commit -m "$(cat <<'EOF'
feat(ui): allow unfilled/elective tiles to render as button when clickable

Three render paths now branch on onClick: with handler -> <button>
(cursor:pointer via button.tile rule), without -> <span>. studentCourse
keeps its existing always-button behavior.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Route SemRow clicks to all tile kinds

**Files:**
- Modify: `src/ISUCourseManager.Web/src/components/SemRow.tsx`

- [ ] **Step 1: Replace `SemRow.tsx` with**:

```tsx
import type { PlanRow, PlanTile } from '../data/types.ts';
import { academicTermToLabel } from '../data/academicTerm.ts';
import { CourseTile } from './CourseTile.tsx';
import styles from './SemRow.module.css';

type Props = {
  row: PlanRow;
  onTileClick?: (tile: PlanTile) => void;
  selectedClassId?: string | null;
};

export function SemRow({ row, onTileClick, selectedClassId }: Props) {
  const creditClass = creditColorClass(row);
  return (
    <div className={styles.row}>
      <div className={styles.label}>
        <span>Sem {row.semIdx}</span>
        <small>{academicTermToLabel(row.academicTerm)}</small>
        <span className={`${styles.credits} ${styles[creditClass]}`}>
          {row.totalCredits} cr
        </span>
      </div>
      {row.tiles.map((tile, i) => (
        <CourseTile
          key={tileKey(tile, i)}
          tile={tile}
          onClick={onTileClick ? () => onTileClick(tile) : undefined}
          selected={tile.kind === 'studentCourse' && selectedClassId === tile.classId}
        />
      ))}
    </div>
  );
}

function creditColorClass(row: PlanRow): string {
  if (row.allCompleted) return 'creditsDone';
  if (row.totalCredits > 18) return 'creditsOver';
  if (row.totalCredits < 12) return 'creditsUnder';
  return 'creditsNormal';
}

function tileKey(tile: PlanTile, index: number): string {
  if (tile.kind === 'electiveSlot') return `elec-${tile.slotType}-${index}`;
  return tile.classId;
}
```

Key change: `onClick={onTileClick ? () => onTileClick(tile) : undefined}` — the studentCourse-only gate is gone. App's handler will branch on `tile.kind` itself. `selected` stays studentCourse-gated.

- [ ] **Step 2: Verify build**

```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0. Unfilled/elective tiles now wire `onClick`, so CourseTile renders them as `<button>` (from Task 4). But App's handler still has the early-return on non-studentCourse from Step 4 — clicks are still no-ops until Task 6.

- [ ] **Step 3: Commit**

```
git add src/ISUCourseManager.Web/src/components/SemRow.tsx
git commit -m "$(cat <<'EOF'
feat(ui): wire onClick on all tile kinds in SemRow

Unfilled-DegreeClass and elective tiles now receive an onClick handler
(routed through PlanView from App). The kind branch moves to App's
handleTileClick. selected prop stays studentCourse-gated.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Widen App state + wire SlotPicker mount

**Files:**
- Modify: `src/ISUCourseManager.Web/src/App.tsx`

This is the big integration commit: state becomes a discriminated `SelectedPanel`, click handler dispatches by kind, panel JSX branches.

- [ ] **Step 1: Replace `App.tsx` with**:

```tsx
import { useState } from 'react';
import type { PlanTile, StudentCoursePlanTile, UnfilledTile } from './data/types.ts';
import { DesktopOnlyGate } from './components/DesktopOnlyGate.tsx';
import { TopBar } from './components/TopBar.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { Main } from './components/Main.tsx';
import { RightPanel } from './components/RightPanel.tsx';
import { ActionMenu } from './components/ActionMenu.tsx';
import { SlotPicker } from './components/SlotPicker.tsx';
import styles from './App.module.css';

type SelectedPanel =
  | { kind: 'actionMenu'; tile: StudentCoursePlanTile }
  | { kind: 'slotPicker'; tile: UnfilledTile };

function App() {
  const [selected, setSelected] = useState<SelectedPanel | null>(null);

  const isPanelOpen = selected !== null;
  const appClassName = isPanelOpen
    ? styles.app
    : `${styles.app} ${styles.noPanel}`;

  const handleTileClick = (tile: PlanTile) => {
    if (tile.kind === 'studentCourse') {
      if (selected?.kind === 'actionMenu' && selected.tile.classId === tile.classId) {
        setSelected(null);
      } else {
        setSelected({ kind: 'actionMenu', tile });
      }
      return;
    }
    if (selected?.kind === 'slotPicker' && isSameUnfilledTile(selected.tile, tile)) {
      setSelected(null);
    } else {
      setSelected({ kind: 'slotPicker', tile });
    }
  };

  const handleClose = () => setSelected(null);

  const selectedClassId =
    selected?.kind === 'actionMenu' ? selected.tile.classId : null;

  return (
    <DesktopOnlyGate>
      <div className={appClassName}>
        <TopBar />
        <Sidebar />
        <Main onTileClick={handleTileClick} selectedClassId={selectedClassId} />
        {selected && (
          <RightPanel accent="action">
            {selected.kind === 'actionMenu' ? (
              <ActionMenu tile={selected.tile} onClose={handleClose} />
            ) : (
              <SlotPicker tile={selected.tile} onClose={handleClose} />
            )}
          </RightPanel>
        )}
      </div>
    </DesktopOnlyGate>
  );
}

function isSameUnfilledTile(a: UnfilledTile, b: UnfilledTile): boolean {
  if (a.kind === 'unfilledDegreeSlot' && b.kind === 'unfilledDegreeSlot') {
    return a.classId === b.classId && a.semIdx === b.semIdx;
  }
  if (a.kind === 'electiveSlot' && b.kind === 'electiveSlot') {
    return a.slotType === b.slotType && a.semIdx === b.semIdx;
  }
  return false;
}

export default App;
```

Notes:
- `selected: SelectedPanel | null` replaces Step 4's `selectedTile: StudentCoursePlanTile | null`.
- `handleTileClick` dispatches on `tile.kind`. No early return — all 3 kinds get routed.
- `isSameUnfilledTile` helper handles toggle-close for unfilled/elective tiles (different identity than studentCourse).
- TypeScript narrows: inside `tile.kind === 'studentCourse'`, `tile` is `StudentCoursePlanTile`. The `else` branch type-narrows `tile` to `UnfilledTile` (the union of the other 2 kinds). Both `setSelected` call sites compile cleanly.
- The conditional render `{selected && (...)}` narrows `selected` to non-null inside the block. Inside, ternary on `selected.kind === 'actionMenu'` narrows further to either `StudentCoursePlanTile` or `UnfilledTile` for the tile prop.

- [ ] **Step 2: Verify build**

```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0.

- [ ] **Step 3: Verify lint**

```
npm --prefix src/ISUCourseManager.Web run lint
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```
git add src/ISUCourseManager.Web/src/App.tsx
git commit -m "$(cat <<'EOF'
feat(ui): wire SlotPicker — unfilled/elective clicks open right panel

App state widens to SelectedPanel union (actionMenu | slotPicker).
handleTileClick dispatches by tile.kind. The right panel JSX
mounts ActionMenu or SlotPicker based on selected.kind. Toggle-close
works for all three tile kinds.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Manual acceptance verification

No automated tests this step.

- [ ] **Step 1: Start dev server**

```
npm --prefix src/ISUCourseManager.Web run dev
```

Expected: Vite reports `Local: http://localhost:5173/` (or next free port). Leave running.

- [ ] **Step 2: Verify slot picker (S5-1..S5-5)**

Open the dev URL in a desktop-width browser.

- [ ] **S5-1** Click one of the two **elective placeholder tiles** in Sem 8 (striped grey, labeled "Gen Ed" / "Tech Elec" depending on flow data). Right panel opens. The tile does NOT get a `.selected` blue ring (only studentCourse tiles do).
- [ ] **S5-2** Header shows: breadcrumb `Sem 8 · Spring 2029`, title `Fill this slot`, ctx `Originally: {label} ({requiredCredits}cr)` (e.g., `Originally: Tech Elec (3cr)` or `Originally: Gen Ed (3cr)` depending on which one you clicked).
- [ ] **S5-3** Body shows:
  - NO "Recommended" section visible.
  - "Pull from a later semester" section with italic muted text `No pull-forward candidates yet.`
  - "Add a new course from the catalog" section with **8 catalog cards** (each: course code, name, credits, dept). Hover should change card bg. Clicking does nothing.
  - "Leave this slot empty" section with one muted card.
- [ ] **S5-4** Footer has `Cancel` (ghost grey) and `Apply selection` (blue, but disabled — lighter color, no pointer cursor). Click `Cancel` → panel closes. Click `Apply selection` → nothing happens (disabled).
- [ ] **S5-5** Re-open the same elective. Click the `×` in the header → closes. Open it again; click the OTHER elective tile → content updates to the new tile's context.

- [ ] **Step 3: Verify Step 4 behavior preserved (S5-6)**

- [ ] **S5-6** Click any of Luke's Sem 3 Planned student-course tiles (`CPRE-2810`, `PHYS-2310`, `MATH-1660`, `COMS-2270`, `PHYS-2310L`). The action menu opens with the **full 4 sections + 7 cards**. Blue `.selected` ring appears. Re-click to close. All Step 4 ACs still pass.

- [ ] **Step 4: Verify Completed-trim (S5-8, S5-9, S5-10)**

- [ ] **S5-8** Click any Sem 1 Completed tile (e.g., `MATH-1430`, `ENGR-1010`). Action menu opens. Header renders normally (breadcrumb, h2 with classId · name, ctx, Status + Grade pills). Body shows ONLY a centered italic message: `This course is complete — no actions available.` — NO Update-status / Reschedule / Replace / Remove sections.
- [ ] **S5-9** Click the gradePending `MATH-1650` tile (Sem 2). Same as S5-8 — empty message body, no action sections. Header shows the Status pill (`Status: Completed`) but no Grade pill (grade is null).
- [ ] **S5-10** Click any Sem 3 Planned student-course tile. The FULL 4-section action menu still appears (confirming the trim ONLY affects Completed tiles).

- [ ] **Step 5: Verify panel accent (S5-11)**

- [ ] **S5-11** Open both an ActionMenu and a SlotPicker (one at a time). In each case, the right-panel left border is blue `#1976d2`. Devtools → Elements → inspect the `.panel` element; computed `border-left-color` should resolve to `rgb(25, 118, 210)`.

- [ ] **Step 6: Build + lint clean (S5-12, S5-13)**

Stop the dev server (Ctrl-C in its terminal). Then run:

```
npm --prefix src/ISUCourseManager.Web run build
npm --prefix src/ISUCourseManager.Web run lint
```

Expected: both exit 0.

- [ ] **Step 7: Report**

If all ACs pass (S5-1..S5-11, plus S5-12/S5-13 from the build/lint check, plus S5-14 once user confirms), no further commits needed — every change already landed in its own task commit. Report success to the controller; final whole-branch review and push/PR handled by finishing-branch flow.

---

## Self-review (writer's checklist)

**Spec coverage:**

| Spec criterion | Implemented in |
|---|---|
| S5-1 (electiveSlot click opens slot picker, no ring) | Tasks 1 (semIdx), 2 (SlotPicker), 4 (button rendering), 5 (SemRow routing), 6 (App dispatch) |
| S5-2 (header content) | Task 2 (SlotPicker header + `contextLine`) |
| S5-3 (body sections) | Task 2 (4 sections — Recommended hidden, 3 visible) |
| S5-4 (footer Cancel/Apply with disabled) | Task 2 (footer JSX + `applyBtn:disabled` CSS) |
| S5-5 (× close, toggle, switch tile) | Task 6 (`isSameUnfilledTile` + dispatch logic) |
| S5-6 (Step 4 preserved for Planned studentCourse) | Tasks 3-6 preserve studentCourse paths |
| S5-7 (unfilledDegreeSlot branch defensive) | Task 2 (`contextLine` handles both kinds) |
| S5-8 (Completed action-menu trim) | Task 3 (`tile.status === 'Completed'` conditional + emptyMessage) |
| S5-9 (gradePending also trimmed) | Task 3 (`status === 'Completed'` covers gradePending since gradePending IS Completed) |
| S5-10 (Planned tiles still get full menu) | Task 3 (only Completed triggers trim) |
| S5-11 (blue accent for both modes) | Task 6 (`<RightPanel accent="action">` wraps both ActionMenu and SlotPicker) |
| S5-12 (build clean) | Each task; final Task 7 |
| S5-13 (lint clean) | Tasks 6-7 |
| S5-14 (visual match) | Task 7 |

All 14 criteria covered.

**Placeholder scan:** no "TBD" / "TODO" / "implement later". Every step has complete code or a verifiable command.

**Type / name consistency:**
- `UnfilledTile` defined in Task 1 (types.ts), used in Task 2 (SlotPicker `Props.tile`), Task 6 (`SelectedPanel`, `isSameUnfilledTile`).
- `StudentCoursePlanTile` (from Step 4) reused in Task 6 (`SelectedPanel.actionMenu.tile`).
- `SelectedPanel` defined inline in Task 6 — single consumer.
- `semIdx` + `academicTerm` field names match between types.ts (Task 1), overlay.ts (Task 1), SlotPicker.tsx (Task 2).
- `.emptyMessage` class name consistent between ActionMenu (Task 3) and SlotPicker (Task 2 — separate CSS module, same name for the same semantic role).
- `isSameUnfilledTile` discriminator pattern matches the PlanTile union — `unfilledDegreeSlot` compares `classId + semIdx`, `electiveSlot` compares `slotType + semIdx`. Mixed-kind returns false.
- The `onClick={onTileClick ? () => onTileClick(tile) : undefined}` pattern in Task 5 SemRow is consistent with Step 4's previous narrower pattern; no naming drift.
- App's `handleTileClick(tile: PlanTile)` accepts the union; type narrowing handles dispatch.

No drift found.
