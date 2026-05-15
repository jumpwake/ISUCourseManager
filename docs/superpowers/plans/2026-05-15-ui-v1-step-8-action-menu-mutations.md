# UI v1 Step 8 (Action-Menu Mutations) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the four sub-UI-free action-menu cards (Mark Completed / Mark In Progress / Mark Failed / Remove from plan) to real mutations against local plan state. Lift the plan from a module-level `PLAN` constant into App `useState`; the overlay becomes a `useMemo` derivation.

**Architecture:** Source of truth is `studentCourses: StudentCourse[]` held in App `useState`, seeded from `data/student.ts`. The plan rows are derived: `useMemo(() => buildOverlay(flow, studentCourses, catalogById), [studentCourses])`. Mutations call `setStudentCourses`; the overlay recomputes; the tree re-renders. `rows` threads App → Main → PlanView (replacing the deleted `PLAN` constant). ActionMenu gets an `onAction(CourseAction)` callback; each mutation closes the panel.

**Tech Stack:** Same as Steps 2–7 (React 19, Vite 8, TypeScript 6, CSS Modules). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-15-ui-v1-step-8-action-menu-mutations-design.md`

**Branch:** `ui-v1/step-8-action-menu-mutations` (already cut from main; spec committed at `8a84df3`).

---

## File Structure

**Create:** none.

**Modify:**
- `src/ISUCourseManager.Web/src/data/types.ts` — add `CourseAction` type.
- `src/ISUCourseManager.Web/src/components/ActionMenu.tsx` — add `onAction` prop, wire the 4 cards, give `ActionCard` an `onClick` prop.
- `src/ISUCourseManager.Web/src/App.tsx` — lift `studentCourses` into `useState`, derive `rows` via `useMemo`, add `applyAction`, pass `rows` + `onAction` down.
- `src/ISUCourseManager.Web/src/components/Main.tsx` — add `rows` prop, thread to `PlanView`.
- `src/ISUCourseManager.Web/src/components/PlanView.tsx` — take `rows` prop instead of importing `PLAN`.

**Delete:**
- `src/ISUCourseManager.Web/src/data/index.ts` — only existed to export the `PLAN` constant, now superseded by App's `useMemo`.

---

## Notes for the executor

- **Run all commands from the repo root: `C:/Users/lukeb/source/repos/ISUCourseManager`**. Use `npm --prefix src/ISUCourseManager.Web run <script>`. Do NOT `cd`.
- **TypeScript strictness:** `verbatimModuleSyntax: true` (use `import type`), `noUnusedLocals: true`, `allowImportingTsExtensions: true`, `erasableSyntaxOnly: true`.
- **Name-shadowing:** App imports the seed array **aliased** — `import { studentCourses as seedStudentCourses } from './data/student.ts'` — so the `useState` variable can be named `studentCourses` without a temporal-dead-zone error.
- **A dev server is already running** at `http://localhost:5173` (reused across the session — do NOT start a new one). Verification is a browser refresh.
- **Commit style:** Conventional Commits, `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer.

---

## Pre-flight: confirm starting state

- [ ] **Step 1: Confirm branch + clean working tree**

```
git status
git rev-parse --abbrev-ref HEAD
```

Expected: branch `ui-v1/step-8-action-menu-mutations`. Clean (or only `.claude/` untracked).

- [ ] **Step 2: Confirm Step 7 build still passes**

```
npm --prefix src/ISUCourseManager.Web run build
npm --prefix src/ISUCourseManager.Web run lint
```

Expected: both exit 0.

---

## Task 1: Add the `CourseAction` type

**Files:**
- Modify: `src/ISUCourseManager.Web/src/data/types.ts`

- [ ] **Step 1: Append the `CourseAction` export to the end of `types.ts`**

Add this line at the end of the file (after the existing `AiScope` export from Step 7):

```ts
export type CourseAction = 'markCompleted' | 'markInProgress' | 'markFailed' | 'remove';
```

- [ ] **Step 2: Verify build**

```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```
git add src/ISUCourseManager.Web/src/data/types.ts
git commit -m "$(cat <<'EOF'
feat(ui): add CourseAction type for action-menu mutations

Discriminated string union for the four wired action-menu cards:
markCompleted | markInProgress | markFailed | remove.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Wire `onAction` into `<ActionMenu />`

**Files:**
- Modify: `src/ISUCourseManager.Web/src/components/ActionMenu.tsx`

`ActionMenu` gets an optional `onAction` prop. The four status/removal cards call it; `ActionCard` gains an optional `onClick`. Move/Substitute cards pass no `onClick` (stay inert). `onAction` is optional so App (which doesn't pass it until Task 3) still compiles.

- [ ] **Step 1: Replace `ActionMenu.tsx` with**:

```tsx
import type { ReactNode } from 'react';
import type { CourseAction, StudentCoursePlanTile } from '../data/types.ts';
import { academicTermToLabel } from '../data/academicTerm.ts';
import styles from './ActionMenu.module.css';

type Props = {
  tile: StudentCoursePlanTile;
  onClose: () => void;
  onAction?: (action: CourseAction) => void;
};

export function ActionMenu({ tile, onClose, onAction }: Props) {
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
        ) : (
          <>
            <Section title="Update status">
              <ActionCard
                icon="✓"
                name="Mark Completed"
                meta="Set grade"
                onClick={() => onAction?.('markCompleted')}
              />
              <ActionCard
                icon="⏵"
                name="Mark In Progress"
                meta="Currently enrolled this term"
                onClick={() => onAction?.('markInProgress')}
              />
              <ActionCard
                icon="⚠"
                name="Mark Failed / Cancelled"
                meta="Will trigger cascade for downstream prereqs"
                danger
                onClick={() => onAction?.('markFailed')}
              />
            </Section>
            <Section title="Reschedule">
              <ActionCard icon="→" name="Move to future term" meta="Pre-req not met / scheduling conflict" />
              <ActionCard icon="←" name="Move to earlier term" meta="Take ahead of recommended schedule" />
            </Section>
            <Section title="Replace">
              <ActionCard icon="⇄" name="Substitute another course" meta="Pick a course that satisfies this slot" />
            </Section>
            <Section title="Remove">
              <ActionCard
                icon="×"
                name="Remove from plan"
                meta="Take the slot back to unfulfilled"
                danger
                onClick={() => onAction?.('remove')}
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
  onClick?: () => void;
};

function ActionCard({ icon, name, meta, danger = false, onClick }: ActionCardProps) {
  const className = danger ? `${styles.card} ${styles.danger}` : styles.card;
  return (
    <button type="button" className={className} onClick={onClick}>
      <span className={styles.icon}>{icon}</span>
      <span className={styles.content}>
        <span className={styles.name}>{name}</span>
        <span className={styles.meta}>{meta}</span>
      </span>
    </button>
  );
}
```

Before writing, **read the current `ActionMenu.tsx`** and confirm this rewrite preserves everything except the Step 8 additions (the `CourseAction` import, the `onAction` prop, the four `onClick={() => onAction?.(...)}` wirings, and `ActionCard`'s `onClick` prop). The header, footer, `Section` helper, the Completed-trim conditional, and the 7 cards' icons/names/meta text must be byte-identical to the current file. If anything else differs from the current file, STOP and report — do not silently change unrelated content.

- [ ] **Step 2: Verify build**

```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0. App still calls `<ActionMenu tile={...} onClose={...} />` without `onAction` — compiles because `onAction` is optional. The 4 wired cards' `onClick` resolves to `onAction?.(...)` which is `undefined` → no-op until Task 3.

- [ ] **Step 3: Commit**

```
git add src/ISUCourseManager.Web/src/components/ActionMenu.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add onAction callback to ActionMenu, wire 4 status cards

ActionMenu gains an optional onAction(CourseAction) prop. Mark
Completed / In Progress / Failed / Remove cards now fire it; ActionCard
gains an optional onClick. Move and Substitute cards stay inert
(no onClick) — deferred. App wires onAction in the next commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Lift plan state into App + thread `rows` + delete `data/index.ts`

**Files:**
- Modify: `src/ISUCourseManager.Web/src/App.tsx`
- Modify: `src/ISUCourseManager.Web/src/components/Main.tsx`
- Modify: `src/ISUCourseManager.Web/src/components/PlanView.tsx`
- Delete: `src/ISUCourseManager.Web/src/data/index.ts`

This is the atomic integration task — the four file changes must land together (App provides `rows`; Main + PlanView consume it; `data/index.ts`'s `PLAN` is no longer imported by anything once PlanView changes).

- [ ] **Step 1: Replace `App.tsx` with**:

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
  | { kind: 'aiPanel'; tile: UnfilledTile };

function App() {
  const [studentCourses, setStudentCourses] = useState<StudentCourse[]>(seedStudentCourses);
  const [selected, setSelected] = useState<SelectedPanel | null>(null);

  const rows = useMemo(
    () => buildOverlay(flow, studentCourses, catalogById),
    [studentCourses],
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

  const handleClose = () => setSelected(null);

  const applyAction = (action: CourseAction, classId: string) => {
    if (action === 'remove') {
      setStudentCourses((prev) => prev.filter((sc) => sc.courseId !== classId));
    } else {
      const status: StudentCourseStatus =
        action === 'markCompleted'
          ? 'Completed'
          : action === 'markInProgress'
            ? 'InProgress'
            : 'Failed';
      setStudentCourses((prev) =>
        prev.map((sc) => (sc.courseId === classId ? { ...sc, status } : sc)),
      );
    }
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
        <Main rows={rows} onTileClick={handleTileClick} selectedClassId={selectedClassId} />
        {selected && (
          <RightPanel accent={panelAccent}>
            {selected.kind === 'actionMenu' && (
              <ActionMenu
                tile={selected.tile}
                onClose={handleClose}
                onAction={(action) => applyAction(action, selected.tile.classId)}
              />
            )}
            {selected.kind === 'slotPicker' && (
              <SlotPicker
                tile={selected.tile}
                onClose={handleClose}
                onAskAi={() => handleAskAi(selected.tile)}
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

- [ ] **Step 2: Replace `Main.tsx` with**:

```tsx
import type { PlanRow, PlanTile } from '../data/types.ts';
import { MainHeader } from './MainHeader.tsx';
import { PlanView } from './PlanView.tsx';
import styles from './Main.module.css';

type Props = {
  rows: PlanRow[];
  onTileClick?: (tile: PlanTile) => void;
  selectedClassId?: string | null;
};

export function Main({ rows, onTileClick, selectedClassId }: Props) {
  return (
    <main className={styles.main}>
      <MainHeader />
      <PlanView rows={rows} onTileClick={onTileClick} selectedClassId={selectedClassId} />
    </main>
  );
}
```

- [ ] **Step 3: Replace `PlanView.tsx` with**:

```tsx
import type { PlanRow, PlanTile } from '../data/types.ts';
import { SemRow } from './SemRow.tsx';
import styles from './PlanView.module.css';

type Props = {
  rows: PlanRow[];
  onTileClick?: (tile: PlanTile) => void;
  selectedClassId?: string | null;
};

export function PlanView({ rows, onTileClick, selectedClassId }: Props) {
  return (
    <div className={styles.view}>
      {rows.map((row) => (
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

- [ ] **Step 4: Delete `data/index.ts`**

```
git rm src/ISUCourseManager.Web/src/data/index.ts
```

Expected: file removed and staged for deletion. (Its only export, `PLAN`, was imported only by `PlanView.tsx` — which no longer imports it after Step 3.)

- [ ] **Step 5: Verify build**

```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0. No "Cannot find module './data/index.ts'" error — confirm nothing still imports it with `git grep "data/index" -- src/` (should return nothing).

- [ ] **Step 6: Verify lint**

```
npm --prefix src/ISUCourseManager.Web run lint
```

Expected: exit 0.

- [ ] **Step 7: Commit**

```
git add src/ISUCourseManager.Web/src/App.tsx src/ISUCourseManager.Web/src/components/Main.tsx src/ISUCourseManager.Web/src/components/PlanView.tsx
git commit -m "$(cat <<'EOF'
feat(ui): lift plan state into App, wire action-menu mutations

studentCourses moves into App useState (seeded from data/student.ts);
the overlay is derived via useMemo. applyAction handles the 4 wired
action-menu cards — markCompleted/InProgress/Failed mutate status,
remove drops the StudentCourse; each closes the panel. rows now
threads App -> Main -> PlanView. data/index.ts (the old PLAN
constant) is deleted.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

(The `git rm` from Step 4 already staged the `data/index.ts` deletion; it rides along in this commit.)

---

## Task 4: Manual acceptance verification

No automated tests this step. A dev server is already running at `http://localhost:5173` — do NOT start a new one; just refresh the browser.

- [ ] **Step 1: Refresh the browser**

Open / refresh `http://localhost:5173`. Vite HMR has the latest build.

- [ ] **Step 2: Verify Mark In Progress (S8-1, S8-2)**

- [ ] **S8-1** Click Luke's Sem 3 `CprE 2810` tile (Planned). The action menu opens with all 4 sections.
- [ ] **S8-2** Click **Mark In Progress**. The panel closes. `CprE 2810` in Sem 3 re-renders with the in-progress style (yellow tint). The sem-row credit total is unchanged.

- [ ] **Step 3: Verify Mark Completed → gradePending (S8-3)**

- [ ] **S8-3** Click another Sem 3 Planned tile (e.g., `Math 1660`). Click **Mark Completed**. Panel closes. `Math 1660` re-renders as **gradePending** — desaturated green, dashed border, "grade pending" italic subtitle (Planned tiles have no grade, so Completed + no grade = gradePending).

- [ ] **Step 4: Verify Mark Failed (S8-4)**

- [ ] **S8-4** Click a Sem 3 Planned tile (e.g., `Com S 2270`). Click **Mark Failed / Cancelled**. Panel closes. `Com S 2270` re-renders with the failed style (red tint).

- [ ] **Step 5: Verify Remove (S8-5, S8-8)**

- [ ] **S8-5** Click a Sem 3 Planned tile (e.g., `Phys 2310`). Click **Remove from plan**. Panel closes. `Phys 2310` is removed from Sem 3's row. (Phys 2310 is a CYBE flow `DegreeClass` slot for an earlier sem; the overlay recomputes and a Planned `unfilledDegreeSlot` placeholder for `PHYS-2310` may appear at its canonical sem — confirm the plan view re-rendered coherently.)
- [ ] **S8-8** Confirm the other Sem 3 tiles and other rows are unchanged after that removal — only `Phys 2310` moved.

- [ ] **Step 6: Verify re-open reflects new state (S8-6)**

- [ ] **S8-6** Click the now-Completed tile from S8-3 (`Math 1660`, gradePending). The action menu opens showing ONLY the Completed-trim message "This course is complete — no actions available." — no action sections (Step 5 trim still applies to the freshly-Completed tile).

- [ ] **Step 7: Verify deferred cards are still no-op (S8-7)**

- [ ] **S8-7** Click a Planned tile. Click **Move to future term**, **Move to earlier term**, and **Substitute another course** in turn. Each does nothing — no panel close, no console error, no state change.

- [ ] **Step 8: Verify credit-color update (S8-10)**

- [ ] **S8-10** Pick a sem-row and mark its tiles until every tile in the row is Completed (or use an existing all-Completed row as the reference). When a row becomes all-Completed, its credit-total pill turns green. (Luke's Sem 1 is already all-Completed → green — use it as the visual reference for the green state.)

- [ ] **Step 9: Verify refresh resets (S8-9)**

- [ ] **S8-9** After making several mutations, refresh the browser. The plan resets to the original seed (CprE 2810 Planned again, Phys 2310 back, etc.) — local state, no persistence.

- [ ] **Step 10: Verify Steps 3–7 preserved (S8-11)**

- [ ] **S8-11** Plan view still renders 8 sem-rows. Click an elective tile → SlotPicker opens with the search input + `✦` AI icon. Click the `✦` icon → AiPanel opens; its `←` back arrow returns to the slot picker. Completed tiles still show the trim. All preserved.

- [ ] **Step 11: Final build + lint (S8-12, S8-13)**

```
npm --prefix src/ISUCourseManager.Web run build
npm --prefix src/ISUCourseManager.Web run lint
```

Expected: both exit 0.

- [ ] **Step 12: Report**

If all S8-1..S8-11 pass plus the build/lint check (S8-12/S8-13) and user-confirmed visual (S8-14), no further commits — Tasks 1–3 cover all code. Report success; the controller runs the final whole-branch review and finishing flow.

---

## Self-review (writer's checklist)

**Spec coverage:**

| Spec criterion | Implemented in |
|---|---|
| S8-1 (action menu opens on Planned tile) | Pre-existing (Step 4); unaffected. Verified Task 4 step 2 |
| S8-2 (Mark In Progress) | Tasks 2 (card wiring) + 3 (applyAction `markInProgress`); verified Task 4 step 2 |
| S8-3 (Mark Completed → gradePending) | Tasks 2 + 3 (`markCompleted` sets status, grade untouched); verified Task 4 step 3 |
| S8-4 (Mark Failed) | Tasks 2 + 3 (`markFailed`); verified Task 4 step 4 |
| S8-5 (Remove + overlay recompute) | Tasks 2 + 3 (`remove` filters the array; `buildOverlay` re-emits placeholder); verified Task 4 step 5 |
| S8-6 (re-open reflects new state) | Task 3 (overlay recompute) + Step 5 Completed-trim; verified Task 4 step 6 |
| S8-7 (Move/Substitute still no-op) | Task 2 (those cards pass no `onClick`); verified Task 4 step 7 |
| S8-8 (mutation isolated to the course) | Task 3 (`applyAction` keys on `courseId === classId`); verified Task 4 step 5 |
| S8-9 (refresh resets) | Task 3 (local `useState`, no persistence); verified Task 4 step 9 |
| S8-10 (credit color updates) | Task 3 (overlay recompute → `allCompleted` re-derived → SemRow credit class); verified Task 4 step 8 |
| S8-11 (Steps 3–7 preserved) | Tasks 2–3 preserve all other code paths; verified Task 4 step 10 |
| S8-12 (build clean) | Each task; final Task 4 step 11 |
| S8-13 (lint clean) | Task 3 step 6; final Task 4 step 11 |
| S8-14 (visual match) | Task 4 steps 2–10, user-verified |

All 14 criteria covered.

**Placeholder scan:** no "TBD" / "TODO" / "implement later". Every step has complete code or a verifiable command.

**Type / name consistency:**
- `CourseAction` defined in Task 1 (`types.ts`), consumed by Task 2 (`ActionMenu` prop) and Task 3 (`App.applyAction`). Same four members throughout: `markCompleted | markInProgress | markFailed | remove`.
- `StudentCourse`, `StudentCourseStatus`, `StudentCoursePlanTile`, `PlanTile`, `PlanRow`, `UnfilledTile` — all pre-existing exports of `types.ts`, imported via `import type` in App / Main / PlanView.
- `applyAction(action: CourseAction, classId: string)` in App matches `ActionMenu`'s `onAction={(action) => applyAction(action, selected.tile.classId)}` — `action` is `CourseAction`, `classId` is `string`.
- The seed import is aliased: `import { studentCourses as seedStudentCourses }` — avoids shadowing the `useState` variable `studentCourses` (a TDZ error otherwise).
- `rows: PlanRow[]` prop name is identical across App (passes), Main (receives + passes), PlanView (receives).
- `data/index.ts` deletion: nothing imports it after PlanView's Task 3 change — verified by the `git grep` in Task 3 step 5.
- `buildOverlay(flow, studentCourses, catalogById)` argument order matches the Step 3 definition (`flow, studentCourses, catalogById`).
- `useMemo` dependency array is `[studentCourses]` only — `flow` and `catalogById` are module constants.

No drift found.

---

# Add Class — additional tasks (amendment)

> Folded into Step 8 per user request during review. Spec amendment: §10 of the design doc. Tasks 5-7 below implement the Add Class feature; **Task 8 supersedes Task 4** (it re-runs Task 4's verification plus the Add Class criteria S8-15..S8-20). Tasks 1-3 + the color fix (`df93e57`) are already committed.

## Add Class — file structure

**Modify:**
- `src/ISUCourseManager.Web/src/data/types.ts` — add `SlotPickerTarget` type.
- `src/ISUCourseManager.Web/src/components/SemRow.tsx` — render a trailing `+ Add Class` tile; add `onAddClass` prop.
- `src/ISUCourseManager.Web/src/components/SemRow.module.css` — add `.addClassTile` style.
- `src/ISUCourseManager.Web/src/components/SlotPicker.tsx` — replace `tile` prop with discriminated `target`; add `onPickCourse`; adapt header/sections for add-to-sem mode.
- `src/ISUCourseManager.Web/src/App.tsx` — add `addClass` panel kind, `handleAddClass`, `addCourse`; wire `onAddClass` + `onPickCourse` + `target`.
- `src/ISUCourseManager.Web/src/components/Main.tsx` — thread `onAddClass`.
- `src/ISUCourseManager.Web/src/components/PlanView.tsx` — thread `onAddClass`.

---

## Task 5: Add the `SlotPickerTarget` type

**Files:**
- Modify: `src/ISUCourseManager.Web/src/data/types.ts`

- [ ] **Step 1: Append the `SlotPickerTarget` export to the end of `types.ts`** (after `CourseAction`):

```ts
export type SlotPickerTarget =
  | { kind: 'slot'; tile: UnfilledTile }
  | { kind: 'addToSem'; semIdx: number; academicTerm: number };
```

- [ ] **Step 2: Verify build** — `npm --prefix src/ISUCourseManager.Web run build` — exit 0.

- [ ] **Step 3: Commit** — `feat(ui): add SlotPickerTarget type for Add Class`, staging only `types.ts`, with the standard `Co-Authored-By` trailer.

---

## Task 6: Render the `+ Add Class` tile in `<SemRow />`

**Files:**
- Modify: `src/ISUCourseManager.Web/src/components/SemRow.tsx`
- Modify: `src/ISUCourseManager.Web/src/components/SemRow.module.css`

`SemRow` gets an optional `onAddClass` prop. When provided AND the row is not all-completed, a trailing dashed `+ Add Class` tile renders after the course tiles. `onAddClass` is optional so PlanView (which doesn't pass it until Task 7) still compiles — until then the tile does not render.

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
  onAddClass?: (semIdx: number, academicTerm: number) => void;
};

export function SemRow({ row, onTileClick, selectedClassId, onAddClass }: Props) {
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
      {onAddClass && !row.allCompleted && (
        <button
          type="button"
          className={styles.addClassTile}
          onClick={() => onAddClass(row.semIdx, row.academicTerm)}
        >
          + Add Class
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

- [ ] **Step 2: Append `.addClassTile` to the end of `SemRow.module.css`**:

```css
.addClassTile {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 5px 8px;
  margin: 3px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 600;
  min-width: 78px;
  min-height: 44px;
  background: transparent;
  border: 1px dashed var(--border);
  color: var(--text-label);
  cursor: pointer;
  font: inherit;
  transition: transform 100ms, border-color 100ms, color 100ms;
}

.addClassTile:hover {
  border-color: #1976d2;
  color: #1976d2;
  transform: translateY(-1px);
}
```

- [ ] **Step 3: Verify build** — `npm --prefix src/ISUCourseManager.Web run build` — exit 0. The `+ Add Class` tile does NOT render yet (PlanView doesn't pass `onAddClass` until Task 7).

- [ ] **Step 4: Commit** — `feat(ui): render + Add Class tile in non-completed sem-rows`, staging `SemRow.tsx` + `SemRow.module.css`, standard trailer.

---

## Task 7: Generalize `<SlotPicker />` + wire Add Class in App

**Files:**
- Modify: `src/ISUCourseManager.Web/src/components/SlotPicker.tsx`
- Modify: `src/ISUCourseManager.Web/src/App.tsx`
- Modify: `src/ISUCourseManager.Web/src/components/Main.tsx`
- Modify: `src/ISUCourseManager.Web/src/components/PlanView.tsx`

Atomic integration task — `SlotPicker`'s prop changes from `tile` to `target`, which breaks App's call site until App is updated; the four files land together. `Main`/`PlanView` thread the new `onAddClass` callback through to `SemRow`.

- [ ] **Step 1: Replace `SlotPicker.tsx` with**:

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

  const isAddToSem = target.kind === 'addToSem';
  const semIdx = target.kind === 'slot' ? target.tile.semIdx : target.semIdx;
  const academicTerm =
    target.kind === 'slot' ? target.tile.academicTerm : target.academicTerm;

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
        <h2 className={styles.title}>{isAddToSem ? 'Add a course' : 'Fill this slot'}</h2>
        {target.kind === 'slot' && (
          <div className={styles.ctx}>{contextLine(target.tile)}</div>
        )}
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
          {!isAddToSem && onAskAi !== undefined && (
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

- [ ] **Step 2: Replace `App.tsx` with**:

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
  | { kind: 'addClass'; semIdx: number; academicTerm: number };

function App() {
  const [studentCourses, setStudentCourses] = useState<StudentCourse[]>(seedStudentCourses);
  const [selected, setSelected] = useState<SelectedPanel | null>(null);

  const rows = useMemo(
    () => buildOverlay(flow, studentCourses, catalogById),
    [studentCourses],
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

  const applyAction = (action: CourseAction, classId: string) => {
    if (action === 'remove') {
      setStudentCourses((prev) => prev.filter((sc) => sc.courseId !== classId));
    } else {
      const status: StudentCourseStatus =
        action === 'markCompleted'
          ? 'Completed'
          : action === 'markInProgress'
            ? 'InProgress'
            : 'Failed';
      setStudentCourses((prev) =>
        prev.map((sc) => (sc.courseId === classId ? { ...sc, status } : sc)),
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
                onClose={handleClose}
                onAction={(action) => applyAction(action, selected.tile.classId)}
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

- [ ] **Step 3: Replace `Main.tsx` with**:

```tsx
import type { PlanRow, PlanTile } from '../data/types.ts';
import { MainHeader } from './MainHeader.tsx';
import { PlanView } from './PlanView.tsx';
import styles from './Main.module.css';

type Props = {
  rows: PlanRow[];
  onTileClick?: (tile: PlanTile) => void;
  selectedClassId?: string | null;
  onAddClass?: (semIdx: number, academicTerm: number) => void;
};

export function Main({ rows, onTileClick, selectedClassId, onAddClass }: Props) {
  return (
    <main className={styles.main}>
      <MainHeader />
      <PlanView
        rows={rows}
        onTileClick={onTileClick}
        selectedClassId={selectedClassId}
        onAddClass={onAddClass}
      />
    </main>
  );
}
```

- [ ] **Step 4: Replace `PlanView.tsx` with**:

```tsx
import type { PlanRow, PlanTile } from '../data/types.ts';
import { SemRow } from './SemRow.tsx';
import styles from './PlanView.module.css';

type Props = {
  rows: PlanRow[];
  onTileClick?: (tile: PlanTile) => void;
  selectedClassId?: string | null;
  onAddClass?: (semIdx: number, academicTerm: number) => void;
};

export function PlanView({ rows, onTileClick, selectedClassId, onAddClass }: Props) {
  return (
    <div className={styles.view}>
      {rows.map((row) => (
        <SemRow
          key={row.semIdx}
          row={row}
          onTileClick={onTileClick}
          selectedClassId={selectedClassId}
          onAddClass={onAddClass}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Verify build + lint** — `npm --prefix src/ISUCourseManager.Web run build` and `npm --prefix src/ISUCourseManager.Web run lint` — both exit 0.

- [ ] **Step 6: Commit** — `feat(ui): wire Add Class — slot picker add-to-semester mode`, staging `SlotPicker.tsx`, `App.tsx`, `Main.tsx`, `PlanView.tsx`, standard trailer.

---

## Task 8: Full manual acceptance verification (supersedes Task 4)

Re-run Task 4's checks plus the Add Class criteria. Dev server already running at `http://localhost:5173` — refresh, don't restart.

- [ ] **Step 1: Refresh the browser** at `http://localhost:5173`.
- [ ] **Step 2: Action-menu mutations (S8-1..S8-10)** — Mark In Progress recolors yellow, Mark Completed → gradePending, Mark Failed recolors red, Remove drops the tile, re-open shows Completed-trim, Move/Substitute still no-op, credit pill turns green on an all-completed row.
- [ ] **Step 3: Status color fix (S8-D12)** — Sem 1 (all completed) tiles render green; a freshly Marked-In-Progress tile is yellow, a Marked-Failed tile is red; Planned tiles still show their dept tint.
- [ ] **Step 4: Add Class tile presence (S8-15)** — Sem 3-8 show a trailing dashed `+ Add Class` tile; Sem 1-2 (all completed) do NOT.
- [ ] **Step 5: Add Class panel (S8-16)** — click `+ Add Class` on Sem 4: picker titled "Add a course", breadcrumb "Sem 4 · …", search input present, NO "Originally:" line, NO "Leave this slot empty" section, NO `✦` Ask AI icon, 8 default catalog cards.
- [ ] **Step 6: Add via search (S8-17, S8-19)** — type to filter the catalog; click a card; panel closes; the course appears as a Planned tile in Sem 4; click the new tile → action menu opens for it.
- [ ] **Step 7: Catalog card adds in slot-fill mode (S8-18)** — open the normal slot picker from an unfilled/elective tile; click a catalog card; the course is added at that slot's semester and the panel closes.
- [ ] **Step 8: Emptied semester keeps Add Class (S8-20)** — remove every course from a planned semester; the row still shows `+ Add Class`.
- [ ] **Step 9: Steps 3-7 preserved (S8-11)** — 8 sem-rows; elective tile → slot picker with `✦`; `✦` → AiPanel with working `←`; Completed tiles show the trim.
- [ ] **Step 10: Refresh resets (S8-9)** — after mutations + adds, refresh resets to seed.
- [ ] **Step 11: Final build + lint (S8-12, S8-13)** — both exit 0.
- [ ] **Step 12: Report** — Tasks 5-7 cover all Add Class code; no further commits. Report pass/fail per criterion; the controller runs the final whole-branch review and finishing flow.

---

## Add Class — self-review (writer's checklist)

**Spec coverage (§10 amendment):**

| Spec criterion | Implemented in |
|---|---|
| S8-15 (`+ Add Class` tile, non-completed rows only) | Task 6 (`onAddClass && !row.allCompleted`); verified Task 8 step 4 |
| S8-16 (add-to-sem picker chrome) | Task 7 (SlotPicker `addToSem` branch — title, no ctx, no Leave-empty, no Ask AI); verified Task 8 step 5 |
| S8-17 (search + add in add-to-sem mode) | Task 7 (`onPickCourse` → `addCourse`); verified Task 8 step 6 |
| S8-18 (catalog card adds in slot-fill mode) | Task 7 (`onPickCourse` wired in the `slotPicker` render); verified Task 8 step 7 |
| S8-19 (new tile is a clickable student tile) | Task 7 (`addCourse` inserts `status: 'Planned'` → overlay emits a `studentCourse` tile); verified Task 8 step 6 |
| S8-20 (emptied sem keeps Add Class) | Task 6 (empty row → `allCompleted` false → tile shown); verified Task 8 step 8 |
| S8-D12 (status color fix) | Already committed `df93e57`; verified Task 8 step 3 |

**Type / name consistency:**
- `SlotPickerTarget` defined Task 5, consumed by `SlotPicker` (Task 7 prop) and constructed inline in App (Task 7).
- `onAddClass: (semIdx: number, academicTerm: number) => void` — identical signature in SemRow (Task 6), Main, PlanView, App's `handleAddClass`.
- `onPickCourse: (classId: string) => void` — SlotPicker prop; App passes `(classId) => addCourse(classId, <term>)`.
- `addCourse` inserts `{ courseId, academicTerm, status: 'Planned', grade: null }` — matches the `StudentCourse` type.
- `SelectedPanel.addClass` carries `semIdx` + `academicTerm` (numbers) — matches `handleAddClass` args and the `addToSem` target.

**Placeholder scan:** none. Every step has complete code or a verifiable command.
