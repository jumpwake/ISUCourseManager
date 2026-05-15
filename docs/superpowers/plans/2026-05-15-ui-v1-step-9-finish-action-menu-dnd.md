# UI v1 Step 9 (Finish the Action Menu + Drag-and-Drop) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the last two no-op action-menu cards (Move to future/earlier term, Substitute another course) to real mutations, and add basic drag-and-drop move via `@dnd-kit/core`.

**Architecture:** Move uses an inline destination-semester picker inside `ActionMenu` (internal `moveMode` state) and a new `App.moveCourse` mutation. Substitute opens `SlotPicker` in a new `substitute` target mode; `App.substituteCourse` removes the old course and adds the chosen one. Drag-and-drop wraps the app in a `@dnd-kit` `DndContext`: course tiles become draggable, semester rows become drop zones, and a drop fires the same `moveCourse` mutation. All mutations key on `courseId + academicTerm`.

**Tech Stack:** React 19, Vite 8, TypeScript 6, CSS Modules, `@dnd-kit/core` (new). No test framework — verification is build + lint + manual browser checks, consistent with Steps 2–8.

**Spec:** `docs/superpowers/specs/2026-05-15-ui-v1-step-9-finish-action-menu-dnd-design.md`

**Branch:** `ui-v1/step-9-action-menu-dnd` (already cut from main; spec committed at `e212b64`).

---

## File Structure

**Create:**
- `src/ISUCourseManager.Web/src/components/DraggableCourseTile.tsx` — `useDraggable` wrapper around `CourseTile`.

**Modify:**
- `src/ISUCourseManager.Web/src/data/types.ts` — add the `substitute` variant to `SlotPickerTarget`.
- `src/ISUCourseManager.Web/src/components/SlotPicker.tsx` — handle the `substitute` target.
- `src/ISUCourseManager.Web/src/components/ActionMenu.tsx` — Move destination view, Substitute wiring, `disabled` on `ActionCard`.
- `src/ISUCourseManager.Web/src/components/ActionMenu.module.css` — back-link + disabled-card styles.
- `src/ISUCourseManager.Web/src/components/CourseTile.tsx` — optional drag bindings on the studentCourse button.
- `src/ISUCourseManager.Web/src/components/CourseTile.module.css` — `.dragging` style.
- `src/ISUCourseManager.Web/src/components/SemRow.tsx` — droppable row; render `DraggableCourseTile` for draggable tiles.
- `src/ISUCourseManager.Web/src/components/SemRow.module.css` — `.dropTarget` style.
- `src/ISUCourseManager.Web/src/App.tsx` — Move/Substitute mutations + `DndContext`/sensors/`DragOverlay`.
- `src/ISUCourseManager.Web/package.json` (+ `package-lock.json`) — add `@dnd-kit/core`.

---

## Notes for the executor

- **Run all commands from the repo root: `C:/Users/lukeb/source/repos/ISUCourseManager`.** Use `npm --prefix src/ISUCourseManager.Web run <script>`. Do NOT `cd`.
- **TypeScript strictness:** `verbatimModuleSyntax: true` (use `import type`), `noUnusedLocals`/`noUnusedParameters: true`, `allowImportingTsExtensions: true` (keep `.ts`/`.tsx` on relative imports), `erasableSyntaxOnly: true`.
- **A dev server is already running** at `http://localhost:5173` — do NOT start a new one; verification is a browser refresh.
- **Commit style:** Conventional Commits, `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer. Stage only the named files — never `git add .` (there is a `.claude/` dir that must stay untracked).

---

## Pre-flight: confirm starting state

- [ ] **Step 1: Confirm branch + clean tree**

```
git status
git rev-parse --abbrev-ref HEAD
```

Expected: branch `ui-v1/step-9-action-menu-dnd`. Clean (or only `.claude/` untracked).

- [ ] **Step 2: Confirm the build passes**

```
npm --prefix src/ISUCourseManager.Web run build
npm --prefix src/ISUCourseManager.Web run lint
```

Expected: both exit 0.

---

## Task 1: Add the `substitute` variant to `SlotPickerTarget`

**Files:**
- Modify: `src/ISUCourseManager.Web/src/data/types.ts`

- [ ] **Step 1: Replace the `SlotPickerTarget` export** (currently the last export in the file) with:

```ts
export type SlotPickerTarget =
  | { kind: 'slot'; tile: UnfilledTile }
  | { kind: 'addToSem'; semIdx: number; academicTerm: number }
  | { kind: 'substitute'; classId: string; semIdx: number; academicTerm: number };
```

- [ ] **Step 2: Verify build** — `npm --prefix src/ISUCourseManager.Web run build` — exit 0.

- [ ] **Step 3: Commit**

```
git add src/ISUCourseManager.Web/src/data/types.ts
git commit -m "$(cat <<'EOF'
feat(ui): add substitute variant to SlotPickerTarget

Third slot-picker target: replace an existing course in a semester.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Handle the `substitute` target in `<SlotPicker />`

**Files:**
- Modify: `src/ISUCourseManager.Web/src/components/SlotPicker.tsx`

`SlotPicker` learns a third mode. In `substitute` mode the title reads "Substitute a course", the context line reads "Replacing: …" (looked up from the catalog), and the "Leave this slot empty" section + Ask AI icon are hidden (same as `addToSem`). This is non-breaking — `App` still passes only `slot`/`addToSem` targets until Task 3.

- [ ] **Step 1: Replace `src/ISUCourseManager.Web/src/components/SlotPicker.tsx` entirely with**:

```tsx
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Course, ElectiveSlotType, SlotPickerTarget, UnfilledTile } from '../data/types.ts';
import { academicTermToLabel } from '../data/academicTerm.ts';
import { catalogById } from '../data/catalog.ts';
import styles from './SlotPicker.module.css';

type Props = {
  target: SlotPickerTarget;
  onClose: () => void;
  onPickCourse: (classId: string) => void;
  onAskAi?: () => void;
};

const CATALOG_RESULT_CAP = 20;
const CATALOG_DEFAULT_COUNT = 8;

export function SlotPicker({ target, onClose, onPickCourse, onAskAi }: Props) {
  const [query, setQuery] = useState('');

  const isSlot = target.kind === 'slot';
  const semIdx = target.kind === 'slot' ? target.tile.semIdx : target.semIdx;
  const academicTerm =
    target.kind === 'slot' ? target.tile.academicTerm : target.academicTerm;
  const ctx = headerContext(target);
  const title =
    target.kind === 'addToSem'
      ? 'Add a course'
      : target.kind === 'substitute'
        ? 'Substitute a course'
        : 'Fill this slot';

  const trimmed = query.trim().toLowerCase();
  const isSearching = trimmed.length > 0;

  const catalogResults: Course[] = isSearching
    ? filterCatalog(trimmed)
    : Array.from(catalogById.values()).slice(0, CATALOG_DEFAULT_COUNT);

  const catalogBadge = isSearching
    ? `${catalogResults.length} match${catalogResults.length === 1 ? '' : 'es'}`
    : undefined;

  return (
    <div className={styles.picker}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.breadcrumb}>
            Sem {semIdx} · {academicTermToLabel(academicTerm)}
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
        <h2 className={styles.title}>{title}</h2>
        {ctx !== null && <div className={styles.ctx}>{ctx}</div>}
      </div>

      <div className={styles.body}>
        <div className={styles.searchRow}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search catalog…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search catalog"
          />
          {isSlot && onAskAi !== undefined && (
            <button
              type="button"
              className={styles.aiIconButton}
              onClick={onAskAi}
              aria-label="Ask AI for help"
              title="Ask AI for help"
            >
              ✦
            </button>
          )}
        </div>

        <Section title="Pull from a later semester">
          <p className={styles.emptyMessage}>No pull-forward candidates yet.</p>
        </Section>

        <Section title="Add a new course from the catalog" badge={catalogBadge}>
          {catalogResults.length > 0 ? (
            catalogResults.map((course) => (
              <button
                key={course.classId}
                type="button"
                className={styles.card}
                onClick={() => onPickCourse(course.classId)}
              >
                <span className={styles.cardContent}>
                  <span className={styles.cardName}>{course.code}</span>
                  <span className={styles.cardMeta}>
                    {course.name} · {course.credits}cr · {course.department}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <p className={styles.emptyMessage}>
              No courses match "{query.trim()}".
            </p>
          )}
        </Section>

        {target.kind === 'slot' && (
          <Section title="Leave this slot empty">
            <button type="button" className={`${styles.card} ${styles.muted}`}>
              <span className={styles.cardContent}>
                <span className={styles.cardName}>Leave this slot empty</span>
                <span className={styles.cardMeta}>
                  Sem {semIdx} will fall short of its credit target.
                </span>
              </span>
            </button>
          </Section>
        )}
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

function Section({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>
        {title}
        {badge !== undefined && <span className={styles.sectionBadge}>{badge}</span>}
      </h3>
      {children}
    </div>
  );
}

function filterCatalog(query: string): Course[] {
  const matches: Course[] = [];
  for (const course of catalogById.values()) {
    if (matchesQuery(course, query)) {
      matches.push(course);
      if (matches.length >= CATALOG_RESULT_CAP) break;
    }
  }
  return matches;
}

function matchesQuery(course: Course, q: string): boolean {
  return (
    course.classId.toLowerCase().includes(q) ||
    course.code.toLowerCase().includes(q) ||
    course.name.toLowerCase().includes(q) ||
    course.department.toLowerCase().includes(q)
  );
}

function headerContext(target: SlotPickerTarget): string | null {
  if (target.kind === 'slot') {
    return contextLine(target.tile);
  }
  if (target.kind === 'substitute') {
    const course = catalogById.get(target.classId);
    return course
      ? `Replacing: ${course.code} · ${course.name}`
      : `Replacing: ${target.classId}`;
  }
  return null;
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

The only changes from the current file: `isAddToSem` is replaced by `isSlot`; `title` + `ctx` are computed up front; the title JSX uses `{title}`; the context-line JSX uses `{ctx}`; the Ask AI guard uses `isSlot`; a new `headerContext` helper is added. The "Leave this slot empty" section was already keyed on `target.kind === 'slot'` and is unchanged.

- [ ] **Step 2: Verify build + lint** — `npm --prefix src/ISUCourseManager.Web run build` and `... run lint` — both exit 0.

- [ ] **Step 3: Commit**

```
git add src/ISUCourseManager.Web/src/components/SlotPicker.tsx
git commit -m "$(cat <<'EOF'
feat(ui): handle substitute target in SlotPicker

Substitute mode: title "Substitute a course", a "Replacing: ..."
context line from the catalog, no Leave-empty section, no Ask AI icon.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Wire Move + Substitute in `<ActionMenu />` and `App`

**Files:**
- Modify: `src/ISUCourseManager.Web/src/components/ActionMenu.tsx`
- Modify: `src/ISUCourseManager.Web/src/components/ActionMenu.module.css`
- Modify: `src/ISUCourseManager.Web/src/App.tsx`

Atomic task — `ActionMenu` gains required `semesters`/`onMove`/`onSubstitute` props, so `App` must supply them in the same commit. `App` also gains the `moveCourse`/`substituteCourse` mutations and the `substitute` panel branch.

- [ ] **Step 1: Replace `src/ISUCourseManager.Web/src/components/ActionMenu.tsx` entirely with**:

```tsx
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { CourseAction, StudentCoursePlanTile } from '../data/types.ts';
import { academicTermToLabel } from '../data/academicTerm.ts';
import styles from './ActionMenu.module.css';

type Semester = { semIdx: number; academicTerm: number };

type Props = {
  tile: StudentCoursePlanTile;
  semesters: Semester[];
  onClose: () => void;
  onAction: (action: CourseAction) => void;
  onMove: (toAcademicTerm: number) => void;
  onSubstitute: () => void;
};

export function ActionMenu({
  tile,
  semesters,
  onClose,
  onAction,
  onMove,
  onSubstitute,
}: Props) {
  const [moveMode, setMoveMode] = useState<'future' | 'earlier' | null>(null);

  const laterSemesters = semesters.filter((s) => s.semIdx > tile.semIdx);
  const earlierSemesters = semesters.filter((s) => s.semIdx < tile.semIdx);

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
        {tile.status === 'Completed' ? (
          <p className={styles.emptyMessage}>
            This course is complete — no actions available.
          </p>
        ) : moveMode !== null ? (
          <MoveView
            moveMode={moveMode}
            destinations={moveMode === 'future' ? laterSemesters : earlierSemesters}
            onBack={() => setMoveMode(null)}
            onMove={onMove}
          />
        ) : (
          <>
            <Section title="Update status">
              <ActionCard
                icon="✓"
                name="Mark Completed"
                meta="Set grade"
                onClick={() => onAction('markCompleted')}
              />
              <ActionCard
                icon="⏵"
                name="Mark In Progress"
                meta="Currently enrolled this term"
                onClick={() => onAction('markInProgress')}
              />
              <ActionCard
                icon="⚠"
                name="Mark Failed / Cancelled"
                meta="Will trigger cascade for downstream prereqs"
                danger
                onClick={() => onAction('markFailed')}
              />
            </Section>
            <Section title="Reschedule">
              <ActionCard
                icon="→"
                name="Move to future term"
                meta="Pre-req not met / scheduling conflict"
                disabled={laterSemesters.length === 0}
                onClick={() => setMoveMode('future')}
              />
              <ActionCard
                icon="←"
                name="Move to earlier term"
                meta="Take ahead of recommended schedule"
                disabled={earlierSemesters.length === 0}
                onClick={() => setMoveMode('earlier')}
              />
            </Section>
            <Section title="Replace">
              <ActionCard
                icon="⇄"
                name="Substitute another course"
                meta="Pick a course that satisfies this slot"
                onClick={onSubstitute}
              />
            </Section>
            <Section title="Remove">
              <ActionCard
                icon="×"
                name="Remove from plan"
                meta="Take the slot back to unfulfilled"
                danger
                onClick={() => onAction('remove')}
              />
            </Section>
          </>
        )}
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.closeBtn} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function MoveView({
  moveMode,
  destinations,
  onBack,
  onMove,
}: {
  moveMode: 'future' | 'earlier';
  destinations: Semester[];
  onBack: () => void;
  onMove: (toAcademicTerm: number) => void;
}) {
  return (
    <div className={styles.section}>
      <button type="button" className={styles.backLink} onClick={onBack}>
        ← Back
      </button>
      <h3 className={styles.sectionTitle}>
        {moveMode === 'future'
          ? 'Move to a later semester'
          : 'Move to an earlier semester'}
      </h3>
      {destinations.map((sem) => (
        <button
          key={sem.semIdx}
          type="button"
          className={styles.card}
          onClick={() => onMove(sem.academicTerm)}
        >
          <span className={styles.icon}>{moveMode === 'future' ? '→' : '←'}</span>
          <span className={styles.content}>
            <span className={styles.name}>Sem {sem.semIdx}</span>
            <span className={styles.meta}>{academicTermToLabel(sem.academicTerm)}</span>
          </span>
        </button>
      ))}
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
  disabled?: boolean;
  onClick?: () => void;
};

function ActionCard({
  icon,
  name,
  meta,
  danger = false,
  disabled = false,
  onClick,
}: ActionCardProps) {
  const className = danger ? `${styles.card} ${styles.danger}` : styles.card;
  return (
    <button type="button" className={className} onClick={onClick} disabled={disabled}>
      <span className={styles.icon}>{icon}</span>
      <span className={styles.content}>
        <span className={styles.name}>{name}</span>
        <span className={styles.meta}>{meta}</span>
      </span>
    </button>
  );
}
```

- [ ] **Step 2: Update `src/ISUCourseManager.Web/src/components/ActionMenu.module.css`**

First, **read the file**. Find the rule `.card:hover` and change its selector to `.card:not(:disabled):hover` (so disabled cards don't show the hover effect). Then **append** this to the end of the file:

```css
.backLink {
  background: transparent;
  border: none;
  color: var(--text-label);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  padding: 0;
  margin-bottom: 8px;
}

.backLink:hover {
  color: var(--text-default);
}

.card:disabled {
  opacity: 0.45;
  cursor: default;
}
```

- [ ] **Step 3: Replace `src/ISUCourseManager.Web/src/App.tsx` entirely with**:

```tsx
import { useMemo, useState } from 'react';
import type {
  CourseAction,
  PlanTile,
  StudentCourse,
  StudentCoursePlanTile,
  StudentCourseStatus,
  UnfilledTile,
} from './data/types.ts';
import { studentCourses as seedStudentCourses } from './data/student.ts';
import { flow } from './data/flow.ts';
import { catalogById } from './data/catalog.ts';
import { buildOverlay } from './data/overlay.ts';
import { DesktopOnlyGate } from './components/DesktopOnlyGate.tsx';
import { TopBar } from './components/TopBar.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { Main } from './components/Main.tsx';
import { RightPanel } from './components/RightPanel.tsx';
import { ActionMenu } from './components/ActionMenu.tsx';
import { SlotPicker } from './components/SlotPicker.tsx';
import { AiPanel } from './components/AiPanel.tsx';
import styles from './App.module.css';

type SelectedPanel =
  | { kind: 'actionMenu'; tile: StudentCoursePlanTile }
  | { kind: 'slotPicker'; tile: UnfilledTile }
  | { kind: 'aiPanel'; tile: UnfilledTile }
  | { kind: 'addClass'; semIdx: number; academicTerm: number }
  | { kind: 'substitute'; tile: StudentCoursePlanTile };

function App() {
  const [studentCourses, setStudentCourses] = useState<StudentCourse[]>(seedStudentCourses);
  const [selected, setSelected] = useState<SelectedPanel | null>(null);

  const rows = useMemo(
    () => buildOverlay(flow, studentCourses, catalogById),
    [studentCourses],
  );

  const semesters = rows.map((r) => ({ semIdx: r.semIdx, academicTerm: r.academicTerm }));

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

  const handleAskAi = (tile: UnfilledTile) => {
    setSelected({ kind: 'aiPanel', tile });
  };

  const handleAddClass = (semIdx: number, academicTerm: number) => {
    setSelected({ kind: 'addClass', semIdx, academicTerm });
  };

  const handleClose = () => setSelected(null);

  const applyAction = (action: CourseAction, classId: string, academicTerm: number) => {
    const isTarget = (sc: StudentCourse) =>
      sc.courseId === classId && sc.academicTerm === academicTerm;
    if (action === 'remove') {
      setStudentCourses((prev) => prev.filter((sc) => !isTarget(sc)));
    } else {
      const status: StudentCourseStatus =
        action === 'markCompleted'
          ? 'Completed'
          : action === 'markInProgress'
            ? 'InProgress'
            : 'Failed';
      setStudentCourses((prev) =>
        prev.map((sc) => (isTarget(sc) ? { ...sc, status } : sc)),
      );
    }
    setSelected(null);
  };

  const addCourse = (classId: string, academicTerm: number) => {
    setStudentCourses((prev) => [
      ...prev,
      { courseId: classId, academicTerm, status: 'Planned', grade: null },
    ]);
    setSelected(null);
  };

  const moveCourse = (classId: string, fromTerm: number, toTerm: number) => {
    setStudentCourses((prev) =>
      prev.map((sc) =>
        sc.courseId === classId && sc.academicTerm === fromTerm
          ? { ...sc, academicTerm: toTerm }
          : sc,
      ),
    );
    setSelected(null);
  };

  const substituteCourse = (oldClassId: string, term: number, newClassId: string) => {
    setStudentCourses((prev) => [
      ...prev.filter((sc) => !(sc.courseId === oldClassId && sc.academicTerm === term)),
      { courseId: newClassId, academicTerm: term, status: 'Planned', grade: null },
    ]);
    setSelected(null);
  };

  const selectedClassId =
    selected?.kind === 'actionMenu' ? selected.tile.classId : null;

  const panelAccent = selected?.kind === 'aiPanel' ? 'ai' : 'action';

  return (
    <DesktopOnlyGate>
      <div className={appClassName}>
        <TopBar />
        <Sidebar />
        <Main
          rows={rows}
          onTileClick={handleTileClick}
          selectedClassId={selectedClassId}
          onAddClass={handleAddClass}
        />
        {selected && (
          <RightPanel accent={panelAccent}>
            {selected.kind === 'actionMenu' && (
              <ActionMenu
                tile={selected.tile}
                semesters={semesters}
                onClose={handleClose}
                onAction={(action) =>
                  applyAction(action, selected.tile.classId, selected.tile.academicTerm)
                }
                onMove={(toTerm) =>
                  moveCourse(selected.tile.classId, selected.tile.academicTerm, toTerm)
                }
                onSubstitute={() => setSelected({ kind: 'substitute', tile: selected.tile })}
              />
            )}
            {selected.kind === 'slotPicker' && (
              <SlotPicker
                target={{ kind: 'slot', tile: selected.tile }}
                onClose={handleClose}
                onPickCourse={(classId) => addCourse(classId, selected.tile.academicTerm)}
                onAskAi={() => handleAskAi(selected.tile)}
              />
            )}
            {selected.kind === 'addClass' && (
              <SlotPicker
                target={{
                  kind: 'addToSem',
                  semIdx: selected.semIdx,
                  academicTerm: selected.academicTerm,
                }}
                onClose={handleClose}
                onPickCourse={(classId) => addCourse(classId, selected.academicTerm)}
              />
            )}
            {selected.kind === 'substitute' && (
              <SlotPicker
                target={{
                  kind: 'substitute',
                  classId: selected.tile.classId,
                  semIdx: selected.tile.semIdx,
                  academicTerm: selected.tile.academicTerm,
                }}
                onClose={handleClose}
                onPickCourse={(newClassId) =>
                  substituteCourse(
                    selected.tile.classId,
                    selected.tile.academicTerm,
                    newClassId,
                  )
                }
              />
            )}
            {selected.kind === 'aiPanel' && (
              <AiPanel
                tile={selected.tile}
                onClose={handleClose}
                onBack={() => setSelected({ kind: 'slotPicker', tile: selected.tile })}
              />
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

- [ ] **Step 4: Verify build + lint** — `npm --prefix src/ISUCourseManager.Web run build` and `... run lint` — both exit 0.

- [ ] **Step 5: Commit**

```
git add src/ISUCourseManager.Web/src/components/ActionMenu.tsx src/ISUCourseManager.Web/src/components/ActionMenu.module.css src/ISUCourseManager.Web/src/App.tsx
git commit -m "$(cat <<'EOF'
feat(ui): wire Move and Substitute action-menu cards

Move opens an inline destination-semester list in the action menu
(internal moveMode state); picking a semester fires App.moveCourse.
Substitute opens SlotPicker in substitute mode; picking a course fires
App.substituteCourse (remove old + add new at same term). Both mutations
key on courseId + academicTerm. ActionCard gains a disabled prop; the
two Move cards disable at the Sem 1 / Sem 8 edges.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Install `@dnd-kit/core`

**Files:**
- Modify: `src/ISUCourseManager.Web/package.json`, `src/ISUCourseManager.Web/package-lock.json`

- [ ] **Step 1: Install the dependency**

```
npm --prefix src/ISUCourseManager.Web install @dnd-kit/core
```

Expected: `@dnd-kit/core` added to `dependencies` in `package.json`; `package-lock.json` updated; exit 0.

- [ ] **Step 2: Verify the build still passes** — `npm --prefix src/ISUCourseManager.Web run build` — exit 0.

- [ ] **Step 3: Commit**

```
git add src/ISUCourseManager.Web/package.json src/ISUCourseManager.Web/package-lock.json
git commit -m "$(cat <<'EOF'
build(ui): add @dnd-kit/core for drag-and-drop

Touch- and mouse-capable drag-and-drop library for the Step 9
drag-to-move feature.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Make course tiles draggable

**Files:**
- Modify: `src/ISUCourseManager.Web/src/components/CourseTile.tsx`
- Modify: `src/ISUCourseManager.Web/src/components/CourseTile.module.css`
- Create: `src/ISUCourseManager.Web/src/components/DraggableCourseTile.tsx`

`CourseTile` becomes presentational with an optional `draggable` prop (a bag of `useDraggable` bindings) spread onto the studentCourse `<button>`. `DraggableCourseTile` is a thin wrapper that calls `useDraggable` and supplies that bag. `CourseTile` itself never calls the hook — so it can also be rendered in the `DragOverlay` (Task 6) without registering a duplicate draggable id. After this task `DraggableCourseTile` exists but is not yet rendered anywhere; the build still passes.

- [ ] **Step 1: Replace `src/ISUCourseManager.Web/src/components/CourseTile.tsx` entirely with**:

```tsx
import type { ElectiveSlotType, PlanTile, StudentCourseStatus } from '../data/types.ts';
import type { useDraggable } from '@dnd-kit/core';
import styles from './CourseTile.module.css';

type DraggableBindings = Pick<
  ReturnType<typeof useDraggable>,
  'setNodeRef' | 'attributes' | 'listeners' | 'isDragging'
>;

type Props = {
  tile: PlanTile;
  onClick?: () => void;
  selected?: boolean;
  draggable?: DraggableBindings;
};

export function CourseTile({ tile, onClick, selected = false, draggable }: Props) {
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
  // Department tint applies only to Planned tiles (scanning future courses by
  // dept aids planning). Completed / InProgress / Failed show their status
  // color so a status change is visible.
  const deptClass = tile.status === 'Planned' ? ` ${styles[tile.dept]}` : '';
  const subtitle =
    tile.status === 'Completed' ? `${tile.grade} · ${tile.credits}cr` : `${tile.credits}cr`;
  const draggingClass = draggable?.isDragging ? ` ${styles.dragging}` : '';
  return (
    <button
      type="button"
      ref={draggable?.setNodeRef}
      className={`${styles.tile} ${styles[statusClass]}${deptClass}${selectedClass}${draggingClass}`}
      onClick={onClick}
      {...draggable?.attributes}
      {...draggable?.listeners}
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

The only changes from the current file: the `import type { useDraggable }` line, the `DraggableBindings` type, the `draggable?` prop, and the studentCourse default `<button>` gaining `ref`, the `draggingClass`, and the `{...draggable?.attributes}` / `{...draggable?.listeners}` spreads. The `electiveSlot`, `unfilledDegreeSlot`, and gradePending branches are unchanged.

- [ ] **Step 2: Append `.dragging` to the end of `src/ISUCourseManager.Web/src/components/CourseTile.module.css`**:

```css
.dragging {
  opacity: 0.4;
}
```

- [ ] **Step 3: Create `src/ISUCourseManager.Web/src/components/DraggableCourseTile.tsx`**:

```tsx
import { useDraggable } from '@dnd-kit/core';
import type { StudentCoursePlanTile } from '../data/types.ts';
import { CourseTile } from './CourseTile.tsx';

type Props = {
  tile: StudentCoursePlanTile;
  onClick?: () => void;
  selected?: boolean;
};

export function DraggableCourseTile({ tile, onClick, selected }: Props) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: `${tile.classId}-${tile.academicTerm}`,
    data: { tile },
  });
  return (
    <CourseTile
      tile={tile}
      onClick={onClick}
      selected={selected}
      draggable={{ setNodeRef, attributes, listeners, isDragging }}
    />
  );
}
```

- [ ] **Step 4: Verify build + lint** — `npm --prefix src/ISUCourseManager.Web run build` and `... run lint` — both exit 0. (`DraggableCourseTile` is not imported by anything yet — that is expected; an unused exported component is not a lint error.)

- [ ] **Step 5: Commit**

```
git add src/ISUCourseManager.Web/src/components/CourseTile.tsx src/ISUCourseManager.Web/src/components/CourseTile.module.css src/ISUCourseManager.Web/src/components/DraggableCourseTile.tsx
git commit -m "$(cat <<'EOF'
feat(ui): make course tiles draggable

CourseTile gains an optional draggable prop (a bag of useDraggable
bindings) spread onto the studentCourse button; it never calls the hook
itself, so it stays safe to render in a DragOverlay. New
DraggableCourseTile wrapper supplies the bindings via useDraggable.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Droppable rows + DndContext wiring

**Files:**
- Modify: `src/ISUCourseManager.Web/src/components/SemRow.tsx`
- Modify: `src/ISUCourseManager.Web/src/components/SemRow.module.css`
- Modify: `src/ISUCourseManager.Web/src/App.tsx`

Atomic task — `SemRow`'s `useDroppable` and the `DraggableCourseTile`s it renders must be inside the `DndContext` that `App` provides; the three files land together.

Sensor note: the spec (§5.2) names "PointerSensor + TouchSensor"; this plan uses **`MouseSensor` + `TouchSensor`** instead — `PointerSensor` would capture touch events too and double up with `TouchSensor`. `MouseSensor` (mouse only, 8 px distance) + `TouchSensor` (touch only, 200 ms delay) gives the intended behavior with no overlap.

- [ ] **Step 1: Replace `src/ISUCourseManager.Web/src/components/SemRow.tsx` entirely with**:

```tsx
import { useDroppable } from '@dnd-kit/core';
import type { PlanRow, PlanTile } from '../data/types.ts';
import { academicTermToLabel } from '../data/academicTerm.ts';
import { CourseTile } from './CourseTile.tsx';
import { DraggableCourseTile } from './DraggableCourseTile.tsx';
import styles from './SemRow.module.css';

type Props = {
  row: PlanRow;
  onTileClick?: (tile: PlanTile) => void;
  selectedClassId?: string | null;
  onAddClass?: (semIdx: number, academicTerm: number) => void;
};

export function SemRow({ row, onTileClick, selectedClassId, onAddClass }: Props) {
  const creditClass = creditColorClass(row);
  const { setNodeRef, isOver } = useDroppable({
    id: `sem-${row.academicTerm}`,
    data: { academicTerm: row.academicTerm },
  });
  const rowClassName = isOver ? `${styles.row} ${styles.dropTarget}` : styles.row;
  return (
    <div className={rowClassName} ref={setNodeRef}>
      <div className={styles.label}>
        <span>Sem {row.semIdx}</span>
        <small>{academicTermToLabel(row.academicTerm)}</small>
        <span className={`${styles.credits} ${styles[creditClass]}`}>
          {row.totalCredits} cr
        </span>
      </div>
      {row.tiles.map((tile, i) =>
        tile.kind === 'studentCourse' && tile.status !== 'Completed' ? (
          <DraggableCourseTile
            key={tileKey(tile, i)}
            tile={tile}
            onClick={onTileClick ? () => onTileClick(tile) : undefined}
            selected={selectedClassId === tile.classId}
          />
        ) : (
          <CourseTile
            key={tileKey(tile, i)}
            tile={tile}
            onClick={onTileClick ? () => onTileClick(tile) : undefined}
            selected={tile.kind === 'studentCourse' && selectedClassId === tile.classId}
          />
        ),
      )}
      {onAddClass && !row.allCompleted && (
        <button
          type="button"
          className={styles.addClassTile}
          onClick={() => onAddClass(row.semIdx, row.academicTerm)}
        >
          + Add Course
        </button>
      )}
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

- [ ] **Step 2: Append `.dropTarget` to the end of `src/ISUCourseManager.Web/src/components/SemRow.module.css`**:

```css
.dropTarget {
  background: #e3f2fd;
  outline: 2px dashed #1976d2;
  outline-offset: -2px;
}
```

- [ ] **Step 3: Replace `src/ISUCourseManager.Web/src/App.tsx` entirely with**:

```tsx
import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import type {
  CourseAction,
  PlanTile,
  StudentCourse,
  StudentCoursePlanTile,
  StudentCourseStatus,
  UnfilledTile,
} from './data/types.ts';
import { studentCourses as seedStudentCourses } from './data/student.ts';
import { flow } from './data/flow.ts';
import { catalogById } from './data/catalog.ts';
import { buildOverlay } from './data/overlay.ts';
import { DesktopOnlyGate } from './components/DesktopOnlyGate.tsx';
import { TopBar } from './components/TopBar.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { Main } from './components/Main.tsx';
import { RightPanel } from './components/RightPanel.tsx';
import { ActionMenu } from './components/ActionMenu.tsx';
import { SlotPicker } from './components/SlotPicker.tsx';
import { AiPanel } from './components/AiPanel.tsx';
import { CourseTile } from './components/CourseTile.tsx';
import styles from './App.module.css';

type SelectedPanel =
  | { kind: 'actionMenu'; tile: StudentCoursePlanTile }
  | { kind: 'slotPicker'; tile: UnfilledTile }
  | { kind: 'aiPanel'; tile: UnfilledTile }
  | { kind: 'addClass'; semIdx: number; academicTerm: number }
  | { kind: 'substitute'; tile: StudentCoursePlanTile };

function App() {
  const [studentCourses, setStudentCourses] = useState<StudentCourse[]>(seedStudentCourses);
  const [selected, setSelected] = useState<SelectedPanel | null>(null);
  const [activeDrag, setActiveDrag] = useState<StudentCoursePlanTile | null>(null);

  const rows = useMemo(
    () => buildOverlay(flow, studentCourses, catalogById),
    [studentCourses],
  );

  const semesters = rows.map((r) => ({ semIdx: r.semIdx, academicTerm: r.academicTerm }));

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

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

  const handleAskAi = (tile: UnfilledTile) => {
    setSelected({ kind: 'aiPanel', tile });
  };

  const handleAddClass = (semIdx: number, academicTerm: number) => {
    setSelected({ kind: 'addClass', semIdx, academicTerm });
  };

  const handleClose = () => setSelected(null);

  const applyAction = (action: CourseAction, classId: string, academicTerm: number) => {
    const isTarget = (sc: StudentCourse) =>
      sc.courseId === classId && sc.academicTerm === academicTerm;
    if (action === 'remove') {
      setStudentCourses((prev) => prev.filter((sc) => !isTarget(sc)));
    } else {
      const status: StudentCourseStatus =
        action === 'markCompleted'
          ? 'Completed'
          : action === 'markInProgress'
            ? 'InProgress'
            : 'Failed';
      setStudentCourses((prev) =>
        prev.map((sc) => (isTarget(sc) ? { ...sc, status } : sc)),
      );
    }
    setSelected(null);
  };

  const addCourse = (classId: string, academicTerm: number) => {
    setStudentCourses((prev) => [
      ...prev,
      { courseId: classId, academicTerm, status: 'Planned', grade: null },
    ]);
    setSelected(null);
  };

  const moveCourse = (classId: string, fromTerm: number, toTerm: number) => {
    setStudentCourses((prev) =>
      prev.map((sc) =>
        sc.courseId === classId && sc.academicTerm === fromTerm
          ? { ...sc, academicTerm: toTerm }
          : sc,
      ),
    );
    setSelected(null);
  };

  const substituteCourse = (oldClassId: string, term: number, newClassId: string) => {
    setStudentCourses((prev) => [
      ...prev.filter((sc) => !(sc.courseId === oldClassId && sc.academicTerm === term)),
      { courseId: newClassId, academicTerm: term, status: 'Planned', grade: null },
    ]);
    setSelected(null);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const tile: StudentCoursePlanTile | undefined = event.active.data.current?.tile;
    setActiveDrag(tile ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    const tile: StudentCoursePlanTile | undefined = event.active.data.current?.tile;
    const toTerm: number | undefined = event.over?.data.current?.academicTerm;
    if (tile && toTerm !== undefined && toTerm !== tile.academicTerm) {
      moveCourse(tile.classId, tile.academicTerm, toTerm);
    }
  };

  const selectedClassId =
    selected?.kind === 'actionMenu' ? selected.tile.classId : null;

  const panelAccent = selected?.kind === 'aiPanel' ? 'ai' : 'action';

  return (
    <DesktopOnlyGate>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className={appClassName}>
          <TopBar />
          <Sidebar />
          <Main
            rows={rows}
            onTileClick={handleTileClick}
            selectedClassId={selectedClassId}
            onAddClass={handleAddClass}
          />
          {selected && (
            <RightPanel accent={panelAccent}>
              {selected.kind === 'actionMenu' && (
                <ActionMenu
                  tile={selected.tile}
                  semesters={semesters}
                  onClose={handleClose}
                  onAction={(action) =>
                    applyAction(action, selected.tile.classId, selected.tile.academicTerm)
                  }
                  onMove={(toTerm) =>
                    moveCourse(selected.tile.classId, selected.tile.academicTerm, toTerm)
                  }
                  onSubstitute={() => setSelected({ kind: 'substitute', tile: selected.tile })}
                />
              )}
              {selected.kind === 'slotPicker' && (
                <SlotPicker
                  target={{ kind: 'slot', tile: selected.tile }}
                  onClose={handleClose}
                  onPickCourse={(classId) => addCourse(classId, selected.tile.academicTerm)}
                  onAskAi={() => handleAskAi(selected.tile)}
                />
              )}
              {selected.kind === 'addClass' && (
                <SlotPicker
                  target={{
                    kind: 'addToSem',
                    semIdx: selected.semIdx,
                    academicTerm: selected.academicTerm,
                  }}
                  onClose={handleClose}
                  onPickCourse={(classId) => addCourse(classId, selected.academicTerm)}
                />
              )}
              {selected.kind === 'substitute' && (
                <SlotPicker
                  target={{
                    kind: 'substitute',
                    classId: selected.tile.classId,
                    semIdx: selected.tile.semIdx,
                    academicTerm: selected.tile.academicTerm,
                  }}
                  onClose={handleClose}
                  onPickCourse={(newClassId) =>
                    substituteCourse(
                      selected.tile.classId,
                      selected.tile.academicTerm,
                      newClassId,
                    )
                  }
                />
              )}
              {selected.kind === 'aiPanel' && (
                <AiPanel
                  tile={selected.tile}
                  onClose={handleClose}
                  onBack={() => setSelected({ kind: 'slotPicker', tile: selected.tile })}
                />
              )}
            </RightPanel>
          )}
        </div>
        <DragOverlay>
          {activeDrag ? <CourseTile tile={activeDrag} /> : null}
        </DragOverlay>
      </DndContext>
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

- [ ] **Step 4: Verify build + lint** — `npm --prefix src/ISUCourseManager.Web run build` and `... run lint` — both exit 0.

- [ ] **Step 5: Commit**

```
git add src/ISUCourseManager.Web/src/components/SemRow.tsx src/ISUCourseManager.Web/src/components/SemRow.module.css src/ISUCourseManager.Web/src/App.tsx
git commit -m "$(cat <<'EOF'
feat(ui): drag-and-drop move between semesters

App wraps the app in a DndContext (MouseSensor 8px / TouchSensor 200ms
so a tap still opens the action menu). SemRow is a droppable; it renders
DraggableCourseTile for non-Completed student tiles. Dropping a tile on
another semester row fires moveCourse; a DragOverlay shows the dragged
tile and the row under the pointer highlights.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Manual acceptance verification

No automated tests. A dev server is already running at `http://localhost:5173` — do NOT start a new one; refresh the browser.

- [ ] **Step 1: Refresh the browser** at `http://localhost:5173`.

- [ ] **Step 2: Move — future / earlier (S9-1, S9-2, S9-3)**
  - Click a non-Completed course tile (e.g. a Sem 3 Planned tile). Click **Move to future term** → the body shows a list of later semesters.
  - Click `← Back` → the main action view returns.
  - Click **Move to earlier term** → earlier semesters listed. Click a destination → the course moves to that semester (overlay re-renders) and the panel closes.

- [ ] **Step 3: Move — edges (S9-4)** — Open the action menu on a Sem 1 course: "Move to earlier term" is disabled (greyed). On a Sem 8 course: "Move to future term" is disabled.

- [ ] **Step 4: Move — source placeholder (S9-5)** — After moving a course that was a flow `degreeClass` slot, its original semester shows an `unfilledDegreeSlot` placeholder tile.

- [ ] **Step 5: Substitute (S9-6, S9-7)** — On a non-Completed tile, click **Substitute another course**. The slot picker opens titled "Substitute a course" with a "Replacing: …" line, no "Leave this slot empty" section, no `✦` icon. Pick a catalog course → the old course is gone, the chosen course appears at the same semester as a Planned tile, panel closes.

- [ ] **Step 6: SlotPicker regression (S9-8)** — Click an unfilled slot tile → slot picker is titled "Fill this slot" with "Originally: …" and the Leave-empty section + `✦` icon. Click `+ Add Course` → "Add a course" mode. Both still add a course on a catalog click.

- [ ] **Step 7: Drag-and-drop (S9-9..S9-14)**
  - Drag a non-Completed course tile onto a different semester row and release → the course moves there (same as Move).
  - Confirm a Completed tile, a placeholder tile, and the `+ Add Course` tile cannot be dragged.
  - While dragging, the row under the pointer highlights; an overlay tile follows the pointer.
  - Drop on the course's own row, or release outside any row → nothing changes.
  - A plain click on a course tile still opens the action menu.
  - Repeat one drag with touch (browser device-emulation touch mode or a touch device).

- [ ] **Step 8: Refresh resets (regression)** — After several moves/substitutes/drags, refresh → the plan resets to the seed (local state, no persistence).

- [ ] **Step 9: Final build + lint (S9-15)**

```
npm --prefix src/ISUCourseManager.Web run build
npm --prefix src/ISUCourseManager.Web run lint
```

Expected: both exit 0.

- [ ] **Step 10: Report** — Tasks 1–6 cover all code; no further commits. Report pass/fail per criterion; the controller runs the final whole-branch review and finishing flow.

---

## Self-review (writer's checklist)

**Spec coverage:**

| Spec criterion | Implemented in |
|---|---|
| S9-1 (Move cards open future/earlier lists) | Task 3 (`ActionMenu` `moveMode` + `MoveView`); verified Task 7 step 2 |
| S9-2 (picking a destination moves the course) | Task 3 (`onMove` → `App.moveCourse`); verified Task 7 step 2 |
| S9-3 (`← Back` returns to the main view) | Task 3 (`MoveView` back link → `setMoveMode(null)`); verified Task 7 step 2 |
| S9-4 (Move cards disabled at Sem 1 / Sem 8) | Task 3 (`disabled={laterSemesters.length === 0}` / earlier); verified Task 7 step 3 |
| S9-5 (source shows a placeholder after a move) | Task 3 (`moveCourse` → overlay recompute); verified Task 7 step 4 |
| S9-6 (substitute picker chrome) | Tasks 1+2 (`substitute` target + SlotPicker handling); verified Task 7 step 5 |
| S9-7 (substitute removes old + adds new) | Task 3 (`App.substituteCourse`); verified Task 7 step 5 |
| S9-8 (slot/addToSem modes regression) | Task 2 (other modes untouched); verified Task 7 step 6 |
| S9-9 (only non-Completed tiles draggable) | Tasks 5+6 (`DraggableCourseTile` rendered only for `status !== 'Completed'`); verified Task 7 step 7 |
| S9-10 (drop on another row moves the course) | Task 6 (`handleDragEnd` → `moveCourse`); verified Task 7 step 7 |
| S9-11 (drop on own row / outside = no-op) | Task 6 (`toTerm !== tile.academicTerm` guard; `event.over` null check); verified Task 7 step 7 |
| S9-12 (tap still opens the action menu) | Task 6 (`MouseSensor` 8px / `TouchSensor` 200ms activation constraints); verified Task 7 step 7 |
| S9-13 (row highlight + drag overlay) | Task 6 (`isOver` → `.dropTarget`; `DragOverlay`); verified Task 7 step 7 |
| S9-14 (mouse + touch) | Task 6 (`MouseSensor` + `TouchSensor`); verified Task 7 step 7 |
| S9-15 (build + lint clean) | Every task; final Task 7 step 9 |
| S9-16 (every action-menu card functional) | Tasks 3 covers Move + Substitute; status/remove wired in Step 8 |

All 16 criteria covered.

**Placeholder scan:** no "TBD" / "TODO" / "implement later". Every step has complete code or a verifiable command. The one judgement instruction — Task 3 Step 2's "change `.card:hover` to `.card:not(:disabled):hover`" — is a precise, single-token edit, not a placeholder.

**Type / name consistency:**
- `SlotPickerTarget` `substitute` variant (Task 1) — `{ kind: 'substitute'; classId; semIdx; academicTerm }` — consumed by `SlotPicker.headerContext` (Task 2) and constructed in `App` (Task 3).
- `ActionMenu` props `semesters: { semIdx; academicTerm }[]`, `onMove: (toAcademicTerm: number) => void`, `onSubstitute: () => void` (Task 3) — `App` passes exactly these (Task 3 / Task 6 `App`).
- `moveCourse(classId, fromTerm, toTerm)` and `substituteCourse(oldClassId, term, newClassId)` — identical signatures in Task 3 `App` and Task 6 `App`.
- `DraggableBindings = Pick<ReturnType<typeof useDraggable>, 'setNodeRef' | 'attributes' | 'listeners' | 'isDragging'>` (Task 5 `CourseTile`) — `DraggableCourseTile` (Task 5) passes exactly those four keys.
- Draggable id `${classId}-${academicTerm}`; droppable id `sem-${academicTerm}`; droppable data `{ academicTerm }`; draggable data `{ tile }` — `handleDragEnd` reads `event.active.data.current?.tile` and `event.over?.data.current?.academicTerm` (Task 6), matching.
- `SelectedPanel` `substitute` member carries `tile: StudentCoursePlanTile` — consistent across Task 3 and Task 6 `App`.

No drift found.
