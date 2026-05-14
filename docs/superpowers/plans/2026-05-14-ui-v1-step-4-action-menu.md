# UI v1 Step 4 (Action Menu) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activate the right panel for the first time — clicking a `studentCourse` tile opens the Action menu keyed to that tile. Build `<ActionMenu />`, convert `<RightPanel />` into a layout wrapper with an `accent` prop, replace Step 2's debug `[panel]` toggle with real selection state. All action buttons are no-op stubs.

**Architecture:** App-level `selectedTile` state drives whether `<RightPanel />` mounts. `<RightPanel />` becomes a thin wrapper that takes an `accent: 'ai' | 'action'` prop (defaults `'ai'`) and `children`. `<ActionMenu />` renders the spec §10.1 chrome inside. Click handler lives in App; only `studentCourse` tiles open the menu (`unfilledDegreeSlot` / `electiveSlot` clicks are no-ops for Step 4).

**Tech Stack:** Same as Step 3 (React 19, Vite 8, TypeScript 6 with verbatim/noUnused/erasable strictness). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-14-ui-v1-step-4-action-menu-design.md`

**Branch:** `ui-v1/step-4-action-menu` (already cut from main; spec committed at `9dc45a7`).

---

## File Structure

**Create:**
- `src/ISUCourseManager.Web/src/components/ActionMenu.tsx`
- `src/ISUCourseManager.Web/src/components/ActionMenu.module.css`

**Modify:**
- `src/ISUCourseManager.Web/src/data/types.ts` — extend `studentCourse` PlanTile variant with 3 fields + export `StudentCoursePlanTile` helper type
- `src/ISUCourseManager.Web/src/data/overlay.ts` — populate the 3 new fields
- `src/ISUCourseManager.Web/src/components/CourseTile.tsx` — add `onClick` + `selected` props; studentCourse variant renders as `<button>`
- `src/ISUCourseManager.Web/src/components/CourseTile.module.css` — add `.selected` rule + `button.tile` cursor reset
- `src/ISUCourseManager.Web/src/components/SemRow.tsx` — thread `onTileClick` + `selectedClassId` props
- `src/ISUCourseManager.Web/src/components/PlanView.tsx` — same
- `src/ISUCourseManager.Web/src/components/Main.tsx` — same
- `src/ISUCourseManager.Web/src/components/RightPanel.tsx` — rewrite as wrapper (accent prop + children); drop `hidden` prop
- `src/ISUCourseManager.Web/src/components/RightPanel.module.css` — drop `.hidden` rule; add `.accentAi` + `.accentAction`
- `src/ISUCourseManager.Web/src/components/TopBar.tsx` — remove debug `[panel]` toggle + props
- `src/ISUCourseManager.Web/src/components/TopBar.module.css` — drop `.debugToggle` rules
- `src/ISUCourseManager.Web/src/App.tsx` — replace `isPanelOpen` with `selectedTile`; mount `<RightPanel accent="action"><ActionMenu ... /></RightPanel>` conditionally; pass click handler + selectedClassId down

---

## Notes for the executor

- **Run all commands from the repo root: `C:/Users/lukeb/source/repos/ISUCourseManager`**. Use `npm --prefix src/ISUCourseManager.Web run <script>`. Do NOT `cd` into the Web project — the Bash tool's cwd persists between calls.
- **`node_modules` is already installed.**
- **TypeScript strictness:** `verbatimModuleSyntax: true` (use `import type` for type-only imports), `noUnusedLocals: true`, `allowImportingTsExtensions: true` (keep `.ts`/`.tsx` on relative imports), `erasableSyntaxOnly: true`.
- **Commit style:** Conventional Commits with `feat(ui):` / `refactor(ui):` scopes. Append `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- **One small spec expansion:** the spec §5 lists 2 new fields on the `studentCourse` PlanTile variant (`academicTerm`, `deptDisplay`). The plan adds a third — `semIdx: number` — so the action menu breadcrumb can render `Sem N · Term Label`. The alternative (computing semIdx in ActionMenu via an inverse helper) requires passing `catalogStartYear` into ActionMenu, which is over-coupling.

---

## Pre-flight: confirm starting state

- [ ] **Step 1: Confirm branch and clean working tree**

Run:
```
git status
git rev-parse --abbrev-ref HEAD
```

Expected: branch `ui-v1/step-4-action-menu`. Working tree clean (or only `.claude/` untracked).

- [ ] **Step 2: Confirm Step 3 build still passes**

Run:
```
npm --prefix src/ISUCourseManager.Web run build
npm --prefix src/ISUCourseManager.Web run lint
```

Expected: both exit 0. Vite reports something like "✓ 49 modules transformed".

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
    }
  | {
      kind: 'electiveSlot';
      slotType: ElectiveSlotType;
      requiredCredits: number;
    };
```

Also append this helper type at the end of the file (after `PlanRow`):

```ts
export type StudentCoursePlanTile = Extract<PlanTile, { kind: 'studentCourse' }>;
```

- [ ] **Step 2: Update `overlay.ts` to populate the new fields**

Edit `src/ISUCourseManager.Web/src/data/overlay.ts`. Find the `tiles.push({ kind: 'studentCourse', ... })` block (inside the `for (const sc of studentTilesThisTerm)` loop) and replace it with:

```ts
tiles.push({
  kind: 'studentCourse',
  classId: course.classId,
  code: course.code,
  name: course.name,
  credits: course.credits,
  dept: departmentToCssClass(course.department),
  deptDisplay: course.department,
  status: sc.status,
  grade: sc.grade,
  academicTerm: sc.academicTerm,
  semIdx,
});
```

- [ ] **Step 3: Verify build**

Run:
```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0. Other consumers of `PlanTile` (`CourseTile.tsx`, `SemRow.tsx`) don't reference the new fields yet, so they remain compatible — adding optional discriminated-union fields is non-breaking for narrowed usages.

- [ ] **Step 4: Commit**

```
git add src/ISUCourseManager.Web/src/data/types.ts src/ISUCourseManager.Web/src/data/overlay.ts
git commit -m "$(cat <<'EOF'
feat(ui): extend PlanTile studentCourse variant with action-menu fields

Adds deptDisplay, academicTerm, semIdx + StudentCoursePlanTile helper
type for the upcoming ActionMenu breadcrumb / context lines.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add `<ActionMenu />` component

**Files:**
- Create: `src/ISUCourseManager.Web/src/components/ActionMenu.tsx`
- Create: `src/ISUCourseManager.Web/src/components/ActionMenu.module.css`

- [ ] **Step 1: Create `ActionMenu.module.css`**

```css
.menu {
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

.metaRow {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  font-size: 10px;
  flex-wrap: wrap;
}

.metaPill {
  background: white;
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid #b3e5fc;
  color: #455a64;
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

.icon {
  font-size: 16px;
  flex-shrink: 0;
  width: 22px;
  text-align: center;
}

.content {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}

.name {
  font-weight: 700;
  font-size: 12px;
}

.meta {
  font-size: 10px;
  color: var(--text-label);
  margin-top: 2px;
}

.danger .name {
  color: #c62828;
}

.danger:hover {
  background: #ffebee;
  border-color: #ef5350;
}

.footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border-soft);
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  background: var(--bg-sidebar);
}

.closeBtn {
  padding: 6px 12px;
  font-size: 12px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: #fff;
  cursor: pointer;
  color: var(--text-label);
}

.closeBtn:hover {
  background: #f8f9fa;
}
```

- [ ] **Step 2: Create `ActionMenu.tsx`**

```tsx
import type { ReactNode } from 'react';
import type { StudentCoursePlanTile } from '../data/types.ts';
import { academicTermToLabel } from '../data/academicTerm.ts';
import styles from './ActionMenu.module.css';

type Props = {
  tile: StudentCoursePlanTile;
  onClose: () => void;
};

export function ActionMenu({ tile, onClose }: Props) {
  return (
    <div className={styles.menu}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.breadcrumb}>
            Sem {tile.semIdx} · {academicTermToLabel(tile.academicTerm)}
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close action menu"
          >
            ×
          </button>
        </div>
        <h2 className={styles.title}>
          {tile.classId} · {tile.name}
        </h2>
        <div className={styles.ctx}>
          Department: {tile.deptDisplay} · {tile.credits} credits
        </div>
        <div className={styles.metaRow}>
          <span className={styles.metaPill}>Status: {tile.status}</span>
          {tile.grade != null && (
            <span className={styles.metaPill}>Grade: {tile.grade}</span>
          )}
        </div>
      </div>

      <div className={styles.body}>
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
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.closeBtn} onClick={onClose}>
          Close
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

type ActionCardProps = {
  icon: string;
  name: string;
  meta: string;
  danger?: boolean;
};

function ActionCard({ icon, name, meta, danger = false }: ActionCardProps) {
  const className = danger ? `${styles.card} ${styles.danger}` : styles.card;
  return (
    <button type="button" className={className}>
      <span className={styles.icon}>{icon}</span>
      <span className={styles.content}>
        <span className={styles.name}>{name}</span>
        <span className={styles.meta}>{meta}</span>
      </span>
    </button>
  );
}
```

- [ ] **Step 3: Verify build**

Run:
```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0. ActionMenu is created but not yet imported anywhere.

- [ ] **Step 4: Commit**

```
git add src/ISUCourseManager.Web/src/components/ActionMenu.tsx src/ISUCourseManager.Web/src/components/ActionMenu.module.css
git commit -m "$(cat <<'EOF'
feat(ui): add ActionMenu component with header + 4 sections + close

Renders the spec §10.1 / interaction-direct-manipulation chrome: blue-
tinted header (breadcrumb, course code+name, ctx, meta pills), 4 sections
of stub action cards (Update status / Reschedule / Replace / Remove),
and a footer Close button. All buttons are no-op stubs for Step 4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Make `<CourseTile />` clickable + selectable

**Files:**
- Modify: `src/ISUCourseManager.Web/src/components/CourseTile.tsx`
- Modify: `src/ISUCourseManager.Web/src/components/CourseTile.module.css`

The studentCourse variant becomes a `<button>` (accessible + cursor:pointer). Other variants stay as `<span>`. Add `onClick` and `selected` props; selected applies the `.selected` ring.

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
    return (
      <span className={`${styles.tile} ${styles.electiveEmpty}`}>
        {electiveLabel(tile.slotType)}
        <small>{tile.requiredCredits}cr</small>
      </span>
    );
  }
  if (tile.kind === 'unfilledDegreeSlot') {
    return (
      <span className={`${styles.tile} ${styles.planned} ${styles[tile.dept]}`}>
        {tile.code}
        <small>{tile.credits}cr</small>
      </span>
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

- [ ] **Step 2: Append rules to `CourseTile.module.css`**

Add these rules **at the end** of `CourseTile.module.css` (AFTER the dept-tint rules, so `.selected` wins on cascade):

```css
button.tile {
  cursor: pointer;
  font: inherit;
}

.selected {
  box-shadow: 0 0 0 3px #1976d2, 0 4px 12px rgba(25, 118, 210, 0.4);
  transform: scale(1.04);
  z-index: 1;
}
```

(The existing `.tile:hover { transform: translateY(-1px); }` rule will be overridden by `.selected` when both apply because `.selected` sets `transform: scale(1.04)` later in the cascade.)

- [ ] **Step 3: Verify build**

Run:
```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0. CourseTile's new props are optional; existing call sites (`SemRow` passing only `{ tile }`) still type-check.

- [ ] **Step 4: Commit**

```
git add src/ISUCourseManager.Web/src/components/CourseTile.tsx src/ISUCourseManager.Web/src/components/CourseTile.module.css
git commit -m "$(cat <<'EOF'
feat(ui): make studentCourse tiles clickable buttons with selected state

Adds optional onClick + selected props to CourseTile. studentCourse
variants now render as <button> (cursor:pointer via button.tile rule);
unfilled-slot and elective tiles stay as <span>. .selected ring per
UI spec §5.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Thread click props through Main → PlanView → SemRow

**Files:**
- Modify: `src/ISUCourseManager.Web/src/components/SemRow.tsx`
- Modify: `src/ISUCourseManager.Web/src/components/PlanView.tsx`
- Modify: `src/ISUCourseManager.Web/src/components/Main.tsx`

All props are optional — call sites without the props still compile.

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
          onClick={
            tile.kind === 'studentCourse' && onTileClick ? () => onTileClick(tile) : undefined
          }
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

- [ ] **Step 2: Replace `PlanView.tsx` with**:

```tsx
import type { PlanTile } from '../data/types.ts';
import { PLAN } from '../data/index.ts';
import { SemRow } from './SemRow.tsx';
import styles from './PlanView.module.css';

type Props = {
  onTileClick?: (tile: PlanTile) => void;
  selectedClassId?: string | null;
};

export function PlanView({ onTileClick, selectedClassId }: Props) {
  return (
    <div className={styles.view}>
      {PLAN.map((row) => (
        <SemRow
          key={row.semIdx}
          row={row}
          onTileClick={onTileClick}
          selectedClassId={selectedClassId}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Replace `Main.tsx` with**:

```tsx
import type { PlanTile } from '../data/types.ts';
import { MainHeader } from './MainHeader.tsx';
import { PlanView } from './PlanView.tsx';
import styles from './Main.module.css';

type Props = {
  onTileClick?: (tile: PlanTile) => void;
  selectedClassId?: string | null;
};

export function Main({ onTileClick, selectedClassId }: Props) {
  return (
    <main className={styles.main}>
      <MainHeader />
      <PlanView onTileClick={onTileClick} selectedClassId={selectedClassId} />
    </main>
  );
}
```

- [ ] **Step 4: Verify build**

Run:
```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0. `App.tsx` still calls `<Main />` (no props) — works because the new props are optional.

- [ ] **Step 5: Commit**

```
git add src/ISUCourseManager.Web/src/components/SemRow.tsx src/ISUCourseManager.Web/src/components/PlanView.tsx src/ISUCourseManager.Web/src/components/Main.tsx
git commit -m "$(cat <<'EOF'
feat(ui): thread tile click + selected props through Main/PlanView/SemRow

Adds optional onTileClick + selectedClassId props so App can wire tile
clicks. SemRow gates the click on tile.kind === 'studentCourse'.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Remove debug `[panel]` toggle from TopBar

**Files:**
- Modify: `src/ISUCourseManager.Web/src/components/TopBar.tsx`
- Modify: `src/ISUCourseManager.Web/src/components/TopBar.module.css`
- Modify: `src/ISUCourseManager.Web/src/App.tsx`

After this task: the panel will not be visible (no trigger exists yet). Task 6 wires the real trigger.

- [ ] **Step 1: Replace `TopBar.tsx` with**:

```tsx
import { AiButton } from './AiButton.tsx';
import styles from './TopBar.module.css';

export function TopBar() {
  return (
    <header className={styles.topbar}>
      <div className={styles.brand}>
        📘 ISU<span className={styles.accent}>CourseManager</span>
      </div>
      <AiButton label="Ask AI" />
      <div className={styles.student}>
        <span>Hi, Luke</span>
        <div className={styles.avatar}>LB</div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Edit `TopBar.module.css`**

Delete the `.debugToggle` and `.debugToggle:hover` rules. Use the Edit tool to remove this block (the exact text to delete):

```css
.debugToggle {
  background: transparent;
  color: #cfd8dc;
  border: 1px solid #5a6573;
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 11px;
  cursor: pointer;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.debugToggle:hover {
  background: rgba(255, 255, 255, 0.08);
}
```

Read the file first to find the exact whitespace (leading/trailing blank lines).

- [ ] **Step 3: Edit `App.tsx` to drop the props passed to TopBar**

Read `App.tsx` first. Find the `<TopBar ... />` element. Replace with `<TopBar />` (no props). Also delete the `useState` for `isPanelOpen` if it becomes orphaned, OR for this intermediate task replace it with a constant:

```tsx
const isPanelOpen = false;
const appClassName = isPanelOpen ? styles.app : `${styles.app} ${styles.noPanel}`;
```

(`isPanelOpen` is still read by the grid class composition, so it isn't truly unused — Task 6 replaces it with `selectedTile` state.)

Remove the `useState` import line if it becomes unused:

```tsx
import { useState } from 'react';
```

→ delete this line.

Also remove the `setIsPanelOpen` destructure and any `onTogglePanel` references — there are none after the TopBar props go away, but verify.

**Final intermediate `App.tsx`** (target shape after this task):

```tsx
import { DesktopOnlyGate } from './components/DesktopOnlyGate.tsx';
import { TopBar } from './components/TopBar.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { Main } from './components/Main.tsx';
import { RightPanel } from './components/RightPanel.tsx';
import styles from './App.module.css';

function App() {
  const isPanelOpen = false;
  const appClassName = isPanelOpen
    ? styles.app
    : `${styles.app} ${styles.noPanel}`;

  return (
    <DesktopOnlyGate>
      <div className={appClassName}>
        <TopBar />
        <Sidebar />
        <Main />
        <RightPanel hidden={!isPanelOpen} />
      </div>
    </DesktopOnlyGate>
  );
}

export default App;
```

- [ ] **Step 4: Verify build**

Run:
```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0.

- [ ] **Step 5: Verify lint**

Run:
```
npm --prefix src/ISUCourseManager.Web run lint
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```
git add src/ISUCourseManager.Web/src/components/TopBar.tsx src/ISUCourseManager.Web/src/components/TopBar.module.css src/ISUCourseManager.Web/src/App.tsx
git commit -m "$(cat <<'EOF'
refactor(ui): remove debug panel toggle from TopBar

Real panel trigger (tile click) lands in next commit. Intermediate state:
right panel is permanently hidden until selectedTile state is wired.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Rewrite `RightPanel` + wire `App.tsx` integration

This is the big integration commit. App swaps `isPanelOpen` constant for `selectedTile` state, the click handler routes to `setSelectedTile`, `RightPanel` becomes a wrapper, and `ActionMenu` mounts inside when a tile is selected.

**Files:**
- Modify: `src/ISUCourseManager.Web/src/components/RightPanel.tsx`
- Modify: `src/ISUCourseManager.Web/src/components/RightPanel.module.css`
- Modify: `src/ISUCourseManager.Web/src/App.tsx`

- [ ] **Step 1: Replace `RightPanel.tsx` with**:

```tsx
import type { ReactNode } from 'react';
import styles from './RightPanel.module.css';

type Props = {
  accent?: 'ai' | 'action';
  children?: ReactNode;
};

export function RightPanel({ accent = 'ai', children }: Props) {
  const accentClass = accent === 'action' ? styles.accentAction : styles.accentAi;
  return <aside className={`${styles.panel} ${accentClass}`}>{children}</aside>;
}
```

- [ ] **Step 2: Replace `RightPanel.module.css` with**:

```css
.panel {
  grid-area: panel;
  background: var(--bg-app);
  border-left: 2px solid var(--panel-accent);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.accentAi {
  --panel-accent: var(--ai-start);
}

.accentAction {
  --panel-accent: #1976d2;
}
```

(The `.hidden` rule is dropped — App now decides whether to render `<RightPanel />` at all.)

- [ ] **Step 3: Replace `App.tsx` with**:

```tsx
import { useState } from 'react';
import type { PlanTile, StudentCoursePlanTile } from './data/types.ts';
import { DesktopOnlyGate } from './components/DesktopOnlyGate.tsx';
import { TopBar } from './components/TopBar.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { Main } from './components/Main.tsx';
import { RightPanel } from './components/RightPanel.tsx';
import { ActionMenu } from './components/ActionMenu.tsx';
import styles from './App.module.css';

function App() {
  const [selectedTile, setSelectedTile] = useState<StudentCoursePlanTile | null>(null);

  const isPanelOpen = selectedTile !== null;
  const appClassName = isPanelOpen
    ? styles.app
    : `${styles.app} ${styles.noPanel}`;

  const handleTileClick = (tile: PlanTile) => {
    if (tile.kind !== 'studentCourse') return;
    if (selectedTile?.classId === tile.classId) {
      setSelectedTile(null);
    } else {
      setSelectedTile(tile);
    }
  };

  const handleClose = () => setSelectedTile(null);

  return (
    <DesktopOnlyGate>
      <div className={appClassName}>
        <TopBar />
        <Sidebar />
        <Main
          onTileClick={handleTileClick}
          selectedClassId={selectedTile?.classId ?? null}
        />
        {selectedTile && (
          <RightPanel accent="action">
            <ActionMenu tile={selectedTile} onClose={handleClose} />
          </RightPanel>
        )}
      </div>
    </DesktopOnlyGate>
  );
}

export default App;
```

- [ ] **Step 4: Verify build**

Run:
```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0.

- [ ] **Step 5: Verify lint**

Run:
```
npm --prefix src/ISUCourseManager.Web run lint
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```
git add src/ISUCourseManager.Web/src/components/RightPanel.tsx src/ISUCourseManager.Web/src/components/RightPanel.module.css src/ISUCourseManager.Web/src/App.tsx
git commit -m "$(cat <<'EOF'
feat(ui): wire ActionMenu — tile clicks open right panel

App holds selectedTile state. Clicking a studentCourse tile sets it
(or toggles closed if re-clicking the selected tile); the grid expands
to 3-col and RightPanel mounts in 'action' accent (blue left-border)
containing ActionMenu keyed to the tile.

RightPanel is now a thin layout wrapper (accent prop + children); the
.hidden mechanism is gone — App decides whether to render at all.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Manual acceptance verification

No automated tests this step.

- [ ] **Step 1: Start dev server**

Run:
```
npm --prefix src/ISUCourseManager.Web run dev
```

Expected: Vite reports `Local: http://localhost:5173/` (or 5174 if 5173 is busy). Leave running.

- [ ] **Step 2: Verify panel default + tile click (S4-1, S4-2, S4-3)**

Open the dev URL in a desktop-width browser.

- [ ] **S4-1** — No `[panel]` button in the topbar. Topbar shows only brand, Ask AI, Hi/avatar.
- [ ] **S4-2** — Default state: 2-column grid, no right panel visible.
- [ ] **S4-3** — Click any `studentCourse` tile (e.g., Math 1430 in Sem 1, or CprE 2810 in Sem 3). The right panel appears (3-column grid). The clicked tile gets a blue ring + slight scale-up.

- [ ] **Step 3: Verify selection transitions (S4-4, S4-5, S4-6)**

- [ ] **S4-4** — Click a different studentCourse tile. The ring transfers to the new tile; panel content updates (header shows new tile's data).
- [ ] **S4-5** — Click the currently-selected tile again. Panel closes; ring disappears; grid returns to 2-column.
- [ ] **S4-6** — Open a tile, then click the `×` in the panel header. Panel closes. Open another, click the `Close` footer button. Same effect.

- [ ] **Step 4: Verify non-clickable tiles (S4-7)**

- [ ] **S4-7** — Click a `unfilledDegreeSlot` tile (planned dashed dept-tint in Sems 1, 2, 8) → nothing happens (no panel opens, no console error). Click an `electiveSlot` tile (striped grey, e.g., one of the Sem 8 elective placeholders) → nothing happens.

- [ ] **Step 5: Verify panel content (S4-8, S4-9, S4-10, S4-11)**

Click a tile that has a clear status. For Luke's MATH-1650 (gradePending) and CPRE-1850 (Completed with grade C):

- [ ] **S4-8** — Header for MATH-1650 shows: breadcrumb `Sem 2 · Spring 2026`, h2 `MATH-1650 · Calc I`, ctx `Department: Math · 4 credits`, status pill `Status: Completed`, **no Grade pill** (grade is null/pending).
- [ ] **S4-8** — Header for CPRE-1850 shows breadcrumb `Sem 2 · Spring 2026`, h2 `CPRE-1850 · CprE Prob Solv`, ctx `Department: CprE · 3 credits`, status pill `Status: Completed`, **Grade pill** `Grade: C` present.
- [ ] **S4-9** — Body has 4 sections in order: Update status (3 cards), Reschedule (2 cards), Replace (1 card), Remove (1 card) — 7 action cards total.
- [ ] **S4-10** — Click any action card → nothing happens (no panel close, no console errors, no state changes — visual hover effects still work). Mark Failed and Remove cards show their name in red.
- [ ] **S4-11** — The panel's left border is **blue `#1976d2`**, not purple. Devtools → Elements → inspect the `.panel` element; computed `border-left-color` should resolve to `rgb(25, 118, 210)`.

- [ ] **Step 6: Final build + lint clean (S4-12, S4-13)**

Stop the dev server (Ctrl-C in its terminal). Then run:
```
npm --prefix src/ISUCourseManager.Web run build
npm --prefix src/ISUCourseManager.Web run lint
```

Expected: both exit 0.

- [ ] **Step 7: Report**

If all 14 ACs pass (S4-1..S4-14), no further commits in this plan — every change already landed in its own task commit. Report success to the controller; the controller will run the final whole-branch review and handle push / PR.

---

## Self-review (writer's checklist)

**Spec coverage:**

| Spec criterion | Implemented in |
|---|---|
| S4-1 (debug toggle removed) | Task 5; verified Task 7 step 2 |
| S4-2 (collapsed default state preserved) | Task 6 (App.tsx state logic); verified Task 7 step 2 |
| S4-3 (click opens panel + ring) | Tasks 3 (CourseTile button), 4 (props threading), 6 (App click handler); verified Task 7 step 2 |
| S4-4 (different tile click transfers selection) | Task 6 (App handler); verified Task 7 step 3 |
| S4-5 (re-click toggles closed) | Task 6 (toggle logic); verified Task 7 step 3 |
| S4-6 (× and Close button close) | Tasks 2 (close buttons), 6 (onClose wired); verified Task 7 step 3 |
| S4-7 (non-studentCourse clicks no-op) | Tasks 4 (SemRow gates onClick on kind), 6 (App handler early return); verified Task 7 step 4 |
| S4-8 (header content) | Tasks 1 (PlanTile fields), 2 (ActionMenu renders); verified Task 7 step 5 |
| S4-9 (4 sections in order with 7 cards) | Task 2 (ActionMenu body); verified Task 7 step 5 |
| S4-10 (no-op cards + danger style) | Task 2 (button stubs + .danger class); verified Task 7 step 5 |
| S4-11 (blue accent in action mode) | Task 6 (RightPanel.accentAction + var override); verified Task 7 step 5 |
| S4-12 (build clean) | Each task; final Task 7 step 6 |
| S4-13 (lint clean) | Task 5 step 5, Task 6 step 5; final Task 7 step 6 |
| S4-14 (visual match in browser) | Task 7 steps 2-5 |

All 14 criteria covered.

**Placeholder scan:** no "TBD", "TODO", "implement later". Every step has complete code or a verifiable command.

**Type / name consistency:**
- `PlanTile.studentCourse` variant fields (`deptDisplay`, `academicTerm`, `semIdx`) are defined in Task 1 (types.ts), populated in Task 1 (overlay.ts), and consumed in Task 2 (ActionMenu.tsx). Names match across all three.
- `StudentCoursePlanTile` helper type defined in Task 1, used in Task 2 (ActionMenu's `tile` prop) and Task 6 (App's `selectedTile` state).
- `onTileClick` / `selectedClassId` props are spelled consistently across Tasks 4 (SemRow, PlanView, Main) and Task 6 (App passes them to `<Main />`).
- CourseTile's new props (`onClick`, `selected`) are used by SemRow in Task 4.
- `RightPanel.accent` prop accepts `'ai' | 'action'` in Task 6; App passes `accent="action"` (matches one of the union values).
- CSS class names match between TSX and CSS Modules in every component (CourseTile `.selected`, ActionMenu `.card`/`.danger`, RightPanel `.accentAction`).
- Both spelling and case of the spec §4 action card meta lines match the spec verbatim.

No drift found.
