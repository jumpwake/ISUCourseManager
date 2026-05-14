# UI v1 Step 3 (Plan View Overlay) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Step 2's empty plan-view region with 8 sem-rows driven by the CYBE flow + Luke's seed data + ISU catalog. Build the `<CourseTile />` + `<SemRow />` + `<PlanView />` primitives plus the data layer (`src/data/` module) that joins all three JSON sources via a pure `buildOverlay()` function.

**Architecture:** Static JSON imports at build time (no `fetch`, no MSW yet). A small `src/data/` module owns the seed files, type definitions, helpers, and the overlay-join function. Components consume a precomputed `PLAN: PlanRow[]` constant. Per-component CSS Modules continue the Step 2 pattern.

**Tech Stack:** Same as Step 2 (React 19, Vite 8, TypeScript 6 with `verbatimModuleSyntax: true` / `noUnusedLocals: true` / `allowImportingTsExtensions: true` / `erasableSyntaxOnly: true`). One new tsconfig option: `resolveJsonModule: true`.

**Spec:** `docs/superpowers/specs/2026-05-14-ui-v1-step-3-plan-view-overlay-design.md`

**Branch:** `ui-v1/step-3-plan-view` (already created from main; the spec commit `3faaa11` lives here).

---

## File Structure

**Create:**
- `src/ISUCourseManager.Web/src/data/seed/isu-catalog.json` (copy from `Documentation/seed-templates/`)
- `src/ISUCourseManager.Web/src/data/seed/flow-cybe-2025-26.example.json` (copy)
- `src/ISUCourseManager.Web/src/data/seed/student-luke.json` (copy)
- `src/ISUCourseManager.Web/src/data/types.ts`
- `src/ISUCourseManager.Web/src/data/academicTerm.ts`
- `src/ISUCourseManager.Web/src/data/department.ts`
- `src/ISUCourseManager.Web/src/data/catalog.ts`
- `src/ISUCourseManager.Web/src/data/flow.ts`
- `src/ISUCourseManager.Web/src/data/student.ts`
- `src/ISUCourseManager.Web/src/data/overlay.ts`
- `src/ISUCourseManager.Web/src/data/index.ts`
- `src/ISUCourseManager.Web/src/components/CourseTile.tsx`
- `src/ISUCourseManager.Web/src/components/CourseTile.module.css`
- `src/ISUCourseManager.Web/src/components/SemRow.tsx`
- `src/ISUCourseManager.Web/src/components/SemRow.module.css`
- `src/ISUCourseManager.Web/src/components/PlanView.tsx`
- `src/ISUCourseManager.Web/src/components/PlanView.module.css`

**Modify:**
- `src/ISUCourseManager.Web/tsconfig.app.json` — add `"resolveJsonModule": true`
- `src/ISUCourseManager.Web/src/components/Main.tsx` — replace empty `.body` div with `<PlanView />`
- `src/ISUCourseManager.Web/src/components/Main.module.css` — drop the `.body` rule

---

## Notes for the executor

- **Run all commands from the repo root: `C:/Users/lukeb/source/repos/ISUCourseManager`**. Use `npm --prefix src/ISUCourseManager.Web run <script>`. Do NOT `cd` into the Web project — the Bash tool's cwd persists between commands and a stray `cd` breaks the prefix path.
- **`node_modules` is already installed.** If a build complains about missing deps, run `cd src/ISUCourseManager.Web && npm install` once.
- **TypeScript strictness gotchas (`tsconfig.app.json`):**
  - `verbatimModuleSyntax: true` — type-only imports must use `import type { ... }`. Mix value + type imports as two separate statements.
  - `allowImportingTsExtensions: true` — keep `.tsx` / `.ts` extensions on relative imports (e.g., `import { foo } from './foo.ts'`).
  - `noUnusedLocals: true` and `noUnusedParameters: true` — no dead imports/params.
  - `erasableSyntaxOnly: true` — no enums, no namespaces, no parameter properties.
- **Commit style:** Conventional Commits with `feat(ui):` / `chore(ui):` scopes. Commit messages under 70 chars. Sign with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- **CSS Modules:** all class names from a `.module.css` file are auto-typed by Vite as `styles.X`. The components below use `styles[expr]` patterns for dynamic class lookups — that's fine, TypeScript widens it appropriately.

---

## Pre-flight: confirm starting state

- [ ] **Step 1: Confirm branch and clean working tree**

Run:
```
git status
git rev-parse --abbrev-ref HEAD
```

Expected: branch is `ui-v1/step-3-plan-view`. Working tree clean (or only `.claude/` untracked — expected).

- [ ] **Step 2: Confirm Step 2 build still passes**

Run:
```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0. Vite reports something like "✓ 33 modules transformed".

---

## Task 1: Copy seed JSONs into the Web project + enable JSON imports

**Files:**
- Create: `src/ISUCourseManager.Web/src/data/seed/isu-catalog.json` (copy)
- Create: `src/ISUCourseManager.Web/src/data/seed/flow-cybe-2025-26.example.json` (copy)
- Create: `src/ISUCourseManager.Web/src/data/seed/student-luke.json` (copy)
- Modify: `src/ISUCourseManager.Web/tsconfig.app.json` — add `"resolveJsonModule": true`

- [ ] **Step 1: Create the seed directory and copy the three JSONs**

Run (Bash tool — single command, runs from repo root):
```
mkdir -p src/ISUCourseManager.Web/src/data/seed && cp Documentation/seed-templates/isu-catalog.json Documentation/seed-templates/flow-cybe-2025-26.example.json Documentation/seed-templates/student-luke.json src/ISUCourseManager.Web/src/data/seed/
```

Verify:
```
ls src/ISUCourseManager.Web/src/data/seed/
```

Expected: three files listed (`isu-catalog.json`, `flow-cybe-2025-26.example.json`, `student-luke.json`).

- [ ] **Step 2: Enable `resolveJsonModule` in `tsconfig.app.json`**

Use the Edit tool. The current `compilerOptions` block (read the file first to find the exact context) needs `"resolveJsonModule": true` added. A safe place is right after `"types": ["vite/client"],`:

Edit `src/ISUCourseManager.Web/tsconfig.app.json`:
- old_string: `    "types": ["vite/client"],\n    "skipLibCheck": true,`
- new_string: `    "types": ["vite/client"],\n    "resolveJsonModule": true,\n    "skipLibCheck": true,`

- [ ] **Step 3: Verify build still passes**

Run:
```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0. (Nothing imports the new JSONs yet, but the tsconfig change should be no-op.)

- [ ] **Step 4: Commit**

Run:
```
git add src/ISUCourseManager.Web/src/data/seed/ src/ISUCourseManager.Web/tsconfig.app.json
git commit -m "$(cat <<'EOF'
chore(ui): vendor seed JSONs into src/data/seed + enable resolveJsonModule

Vite bundles only files under src/. Three seed files (catalog, CYBE flow,
student-luke) are duplicated here so they can be imported directly; when
the eventual API loads them server-side, this dir goes away.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add data type definitions

**Files:**
- Create: `src/ISUCourseManager.Web/src/data/types.ts`

- [ ] **Step 1: Create `types.ts`**

```ts
export type StudentCourseStatus =
  | 'Planned' | 'InProgress' | 'Completed' | 'Failed' | 'Withdrawn';

export type Course = {
  classId: string;
  code: string;
  name: string;
  credits: number;
  department: string;
};

export type ElectiveSlotType =
  | 'ElectiveGenEd' | 'ElectiveMath' | 'ElectiveTech' | 'ElectiveCybE' | 'ElectiveCprE';

export type FlowSlot =
  | { kind: 'degreeClass'; semester: number; classId: string; displayOrder: number; }
  | { kind: 'elective'; semester: number; slotType: ElectiveSlotType; requiredCredits: number; displayOrder: number; };

export type DegreeFlow = {
  code: string;
  catalogYear: string;
  slots: FlowSlot[];
  catalogStartYear: number;
};

export type StudentCourse = {
  courseId: string;
  academicTerm: number;
  status: StudentCourseStatus;
  grade: string | null;
};

export type PlanTile =
  | {
      kind: 'studentCourse';
      classId: string;
      code: string;
      name: string;
      credits: number;
      dept: string;
      status: StudentCourseStatus;
      grade: string | null;
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

export type PlanRow = {
  semIdx: number;
  academicTerm: number;
  tiles: PlanTile[];
  totalCredits: number;
  allCompleted: boolean;
};
```

- [ ] **Step 2: Verify build (types-only file should compile clean)**

Run:
```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```
git add src/ISUCourseManager.Web/src/data/types.ts
git commit -m "$(cat <<'EOF'
feat(ui): add data type definitions for plan view

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add academic-term helpers

**Files:**
- Create: `src/ISUCourseManager.Web/src/data/academicTerm.ts`

- [ ] **Step 1: Create `academicTerm.ts`**

```ts
export function academicTermToLabel(term: number): string {
  const academicYear = Math.floor(term / 100);
  const season = term % 100;
  if (season === 2) return `Fall ${academicYear - 1}`;
  if (season === 4) return `Spring ${academicYear}`;
  return `Term ${term}`;
}

export function flowSemToAcademicTerm(semIdx: number, catalogStartYear: number): number {
  const academicYear = catalogStartYear + Math.ceil(semIdx / 2);
  const season = semIdx % 2 === 1 ? 2 : 4;
  return academicYear * 100 + season;
}
```

Verification table (mental check, no tests this step):
- `academicTermToLabel(202602)` → `"Fall 2025"` (academic year 2026, Fall → calendar 2025)
- `academicTermToLabel(202604)` → `"Spring 2026"`
- `academicTermToLabel(202702)` → `"Fall 2026"`
- `flowSemToAcademicTerm(1, 2025)` → `202602`
- `flowSemToAcademicTerm(2, 2025)` → `202604`
- `flowSemToAcademicTerm(3, 2025)` → `202702`
- `flowSemToAcademicTerm(8, 2025)` → `202904`

- [ ] **Step 2: Verify build**

Run:
```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```
git add src/ISUCourseManager.Web/src/data/academicTerm.ts
git commit -m "$(cat <<'EOF'
feat(ui): add academicTerm encode/decode helpers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add department-to-CSS-class helper

**Files:**
- Create: `src/ISUCourseManager.Web/src/data/department.ts`

- [ ] **Step 1: Create `department.ts`**

```ts
const KNOWN_DEPTS: ReadonlySet<string> = new Set([
  'math',
  'cpre',
  'cybe',
  'coms',
  'engl',
  'gened',
]);

export function departmentToCssClass(department: string): string {
  const normalized = department.toLowerCase().replace(/\s+/g, '');
  return KNOWN_DEPTS.has(normalized) ? normalized : 'gened';
}
```

Verification table:
- `departmentToCssClass('Math')` → `'math'`
- `departmentToCssClass('CprE')` → `'cpre'`
- `departmentToCssClass('Com S')` → `'coms'` (whitespace stripped)
- `departmentToCssClass('Chem')` → `'gened'` (unknown → fallback)
- `departmentToCssClass('HDFS')` → `'gened'`
- `departmentToCssClass('Engr')` → `'gened'`

- [ ] **Step 2: Verify build**

Run:
```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```
git add src/ISUCourseManager.Web/src/data/department.ts
git commit -m "$(cat <<'EOF'
feat(ui): add department to CSS class mapper with gened fallback

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Add catalog loader

**Files:**
- Create: `src/ISUCourseManager.Web/src/data/catalog.ts`

- [ ] **Step 1: Create `catalog.ts`**

```ts
import type { Course } from './types.ts';
import catalogRaw from './seed/isu-catalog.json';

type RawCatalogCourse = {
  classId: string;
  code: string;
  name: string;
  credits: number;
  department: string;
};

const courses: Course[] = (catalogRaw.courses as RawCatalogCourse[]).map((c) => ({
  classId: c.classId,
  code: c.code,
  name: c.name,
  credits: c.credits,
  department: c.department,
}));

export const catalogById: ReadonlyMap<string, Course> = new Map(
  courses.map((c) => [c.classId, c]),
);
```

- [ ] **Step 2: Verify build**

Run:
```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0. (First JSON import — `resolveJsonModule` from Task 1 makes this work.)

- [ ] **Step 3: Commit**

```
git add src/ISUCourseManager.Web/src/data/catalog.ts
git commit -m "$(cat <<'EOF'
feat(ui): add catalog loader exporting catalogById map

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Add flow loader

**Files:**
- Create: `src/ISUCourseManager.Web/src/data/flow.ts`

- [ ] **Step 1: Create `flow.ts`**

```ts
import type { DegreeFlow, ElectiveSlotType, FlowSlot } from './types.ts';
import flowRaw from './seed/flow-cybe-2025-26.example.json';

type RawSlot = {
  semester: number;
  slotType: string;
  classId?: string;
  requiredCredits?: number;
  displayOrder: number;
};

function parseSlot(s: RawSlot): FlowSlot {
  if (s.slotType === 'DegreeClass') {
    if (!s.classId) {
      throw new Error(`DegreeClass slot missing classId at semester ${s.semester}`);
    }
    return {
      kind: 'degreeClass',
      semester: s.semester,
      classId: s.classId,
      displayOrder: s.displayOrder,
    };
  }
  return {
    kind: 'elective',
    semester: s.semester,
    slotType: s.slotType as ElectiveSlotType,
    requiredCredits: s.requiredCredits ?? 0,
    displayOrder: s.displayOrder,
  };
}

const slots: FlowSlot[] = (flowRaw.slots as RawSlot[]).map(parseSlot);
const catalogStartYear = parseInt(flowRaw.catalogYear.slice(0, 4), 10);

export const flow: DegreeFlow = {
  code: flowRaw.code,
  catalogYear: flowRaw.catalogYear,
  slots,
  catalogStartYear,
};
```

- [ ] **Step 2: Verify build**

Run:
```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```
git add src/ISUCourseManager.Web/src/data/flow.ts
git commit -m "$(cat <<'EOF'
feat(ui): add flow loader with discriminated slot parser

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Add student loader

**Files:**
- Create: `src/ISUCourseManager.Web/src/data/student.ts`

- [ ] **Step 1: Create `student.ts`**

```ts
import type { StudentCourse, StudentCourseStatus } from './types.ts';
import studentRaw from './seed/student-luke.json';

type RawStudentCourse = {
  courseId: string;
  academicTerm: number;
  status: string;
  grade: string;
};

function normalizeStatus(raw: string): StudentCourseStatus {
  if (raw === 'Complete' || raw === 'Completed') return 'Completed';
  if (raw === 'InProgress' || raw === 'In Progress') return 'InProgress';
  if (raw === 'Failed') return 'Failed';
  if (raw === 'Withdrawn') return 'Withdrawn';
  return 'Planned';
}

function normalizeGrade(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const studentCourses: StudentCourse[] = (studentRaw.courses as RawStudentCourse[]).map((c) => ({
  courseId: c.courseId,
  academicTerm: c.academicTerm,
  status: normalizeStatus(c.status),
  grade: normalizeGrade(c.grade),
}));

export const studentName: string = studentRaw.student.displayName;
```

- [ ] **Step 2: Verify build**

Run:
```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```
git add src/ISUCourseManager.Web/src/data/student.ts
git commit -m "$(cat <<'EOF'
feat(ui): add student loader normalizing Complete to Completed

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Add overlay-join function

**Files:**
- Create: `src/ISUCourseManager.Web/src/data/overlay.ts`

- [ ] **Step 1: Create `overlay.ts`**

```ts
import type {
  Course,
  DegreeFlow,
  PlanRow,
  PlanTile,
  StudentCourse,
} from './types.ts';
import { flowSemToAcademicTerm } from './academicTerm.ts';
import { departmentToCssClass } from './department.ts';

export function buildOverlay(
  flow: DegreeFlow,
  studentCourses: ReadonlyArray<StudentCourse>,
  catalogById: ReadonlyMap<string, Course>,
): PlanRow[] {
  const enrolledClassIds = new Set(studentCourses.map((sc) => sc.courseId));

  const maxFlowSem = flow.slots.reduce((m, s) => Math.max(m, s.semester), 0);
  const totalSems = Math.max(maxFlowSem, 8);

  const studentByTerm = new Map<number, StudentCourse[]>();
  for (const sc of studentCourses) {
    const list = studentByTerm.get(sc.academicTerm) ?? [];
    list.push(sc);
    studentByTerm.set(sc.academicTerm, list);
  }

  const rows: PlanRow[] = [];
  for (let semIdx = 1; semIdx <= totalSems; semIdx++) {
    const academicTerm = flowSemToAcademicTerm(semIdx, flow.catalogStartYear);
    const tiles: PlanTile[] = [];

    const studentTilesThisTerm = studentByTerm.get(academicTerm) ?? [];
    for (const sc of studentTilesThisTerm) {
      const course = catalogById.get(sc.courseId);
      if (!course) continue;
      tiles.push({
        kind: 'studentCourse',
        classId: course.classId,
        code: course.code,
        name: course.name,
        credits: course.credits,
        dept: departmentToCssClass(course.department),
        status: sc.status,
        grade: sc.grade,
      });
    }

    const slotsThisSem = flow.slots
      .filter((s) => s.semester === semIdx)
      .sort((a, b) => a.displayOrder - b.displayOrder);

    for (const slot of slotsThisSem) {
      if (slot.kind === 'degreeClass') {
        if (enrolledClassIds.has(slot.classId)) continue;
        const course = catalogById.get(slot.classId);
        if (!course) continue;
        tiles.push({
          kind: 'unfilledDegreeSlot',
          classId: course.classId,
          code: course.code,
          name: course.name,
          credits: course.credits,
          dept: departmentToCssClass(course.department),
        });
      } else {
        tiles.push({
          kind: 'electiveSlot',
          slotType: slot.slotType,
          requiredCredits: slot.requiredCredits,
        });
      }
    }

    const totalCredits = tiles.reduce((sum, t) => {
      if (t.kind === 'studentCourse' || t.kind === 'unfilledDegreeSlot') return sum + t.credits;
      return sum + t.requiredCredits;
    }, 0);

    const allCompleted =
      tiles.length > 0 &&
      tiles.every((t) => t.kind === 'studentCourse' && t.status === 'Completed');

    rows.push({ semIdx, academicTerm, tiles, totalCredits, allCompleted });
  }

  return rows;
}
```

- [ ] **Step 2: Verify build**

Run:
```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```
git add src/ISUCourseManager.Web/src/data/overlay.ts
git commit -m "$(cat <<'EOF'
feat(ui): add buildOverlay join function for plan rows

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Add data module index (PLAN export)

**Files:**
- Create: `src/ISUCourseManager.Web/src/data/index.ts`

- [ ] **Step 1: Create `index.ts`**

```ts
import type { PlanRow } from './types.ts';
import { flow } from './flow.ts';
import { studentCourses } from './student.ts';
import { catalogById } from './catalog.ts';
import { buildOverlay } from './overlay.ts';

export const PLAN: ReadonlyArray<PlanRow> = buildOverlay(flow, studentCourses, catalogById);
```

- [ ] **Step 2: Verify build**

Run:
```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0. The catalog and flow JSONs now bundle into the JS output, so the build may report a slightly larger asset size — that's expected.

- [ ] **Step 3: Commit**

```
git add src/ISUCourseManager.Web/src/data/index.ts
git commit -m "$(cat <<'EOF'
feat(ui): wire data module to export PLAN constant

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Add `<CourseTile />` component

**Files:**
- Create: `src/ISUCourseManager.Web/src/components/CourseTile.tsx`
- Create: `src/ISUCourseManager.Web/src/components/CourseTile.module.css`

- [ ] **Step 1: Create `CourseTile.module.css`**

```css
.tile {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 5px 8px;
  margin: 3px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.15;
  min-width: 78px;
  min-height: 44px;
  background: #fff;
  border: 1px solid var(--border);
  color: var(--text-default);
  text-align: center;
  cursor: default;
  transition: transform 100ms;
  position: relative;
}

.tile small {
  font-weight: 400;
  opacity: 0.65;
  font-size: 10px;
  margin-top: 2px;
}

.tile:hover {
  transform: translateY(-1px);
}

/* Status states declared BEFORE dept classes so dept can override bg/border-color */
.completed   { background: #e8f5e9; border-color: #66bb6a; }
.inprogress  { background: #fff8e1; border-color: #ffb300; }
.planned     { background: #fff; border-color: #b0bec5; border-style: dashed; color: #455a64; }
.failed      { background: #ffebee; border-color: #c62828; }

.gradePending {
  background: #f1f8e9;
  border-color: #aed581;
  border-style: dashed;
}

.electiveEmpty {
  background: repeating-linear-gradient(45deg, #fafafa, #fafafa 6px, #f0f0f0 6px, #f0f0f0 12px);
  border-color: #cfd8dc;
  color: #607d8b;
  border-style: dashed;
}

/* Dept tints declared AFTER status; win bg/border-color on equal specificity */
.math    { background-color: #fde2c8; border-color: #e8b585; }
.cpre    { background-color: #e8f0fe; border-color: #a8c3eb; }
.cybe    { background-color: #d6f0e6; border-color: #82c8a8; }
.coms    { background-color: #f0e4ff; border-color: #b89ce0; }
.gened   { background-color: #f0f4f8; border-color: #b8c6d4; }
.engl    { background-color: #fff7e6; border-color: #d4b685; }
```

- [ ] **Step 2: Create `CourseTile.tsx`**

```tsx
import type { ElectiveSlotType, PlanTile, StudentCourseStatus } from '../data/types.ts';
import styles from './CourseTile.module.css';

type Props = { tile: PlanTile };

export function CourseTile({ tile }: Props) {
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
  if (tile.status === 'Completed' && !tile.grade) {
    return (
      <span className={`${styles.tile} ${styles.gradePending}`}>
        {tile.code}
        <small><i>grade pending</i></small>
      </span>
    );
  }
  const statusClass = statusToClass(tile.status);
  const subtitle =
    tile.status === 'Completed' ? `${tile.grade} · ${tile.credits}cr` : `${tile.credits}cr`;
  return (
    <span className={`${styles.tile} ${styles[statusClass]} ${styles[tile.dept]}`}>
      {tile.code}
      <small>{subtitle}</small>
    </span>
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

- [ ] **Step 3: Verify build**

Run:
```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```
git add src/ISUCourseManager.Web/src/components/CourseTile.tsx src/ISUCourseManager.Web/src/components/CourseTile.module.css
git commit -m "$(cat <<'EOF'
feat(ui): add CourseTile primitive with status, dept-tint, gradePending

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Add `<SemRow />` component

**Files:**
- Create: `src/ISUCourseManager.Web/src/components/SemRow.tsx`
- Create: `src/ISUCourseManager.Web/src/components/SemRow.module.css`

- [ ] **Step 1: Create `SemRow.module.css`**

```css
.row {
  padding: 8px 16px;
  border-bottom: 1px dashed var(--border-soft);
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  position: relative;
}

.row:hover {
  background: #f8f9fa;
}

.label {
  width: 96px;
  font-size: 11px;
  color: #455a64;
  font-weight: 700;
  flex-shrink: 0;
  line-height: 1.3;
}

.label small {
  display: block;
  font-weight: 400;
  color: #999;
}

.credits {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  font-weight: 700;
}

.creditsNormal { color: #1565c0; }
.creditsOver   { color: #c62828; }
.creditsUnder  { color: #ef6c00; }
.creditsDone   { color: #2e7d32; }
```

- [ ] **Step 2: Create `SemRow.tsx`**

```tsx
import type { PlanRow, PlanTile } from '../data/types.ts';
import { academicTermToLabel } from '../data/academicTerm.ts';
import { CourseTile } from './CourseTile.tsx';
import styles from './SemRow.module.css';

type Props = { row: PlanRow };

export function SemRow({ row }: Props) {
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
        <CourseTile key={tileKey(tile, i)} tile={tile} />
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

- [ ] **Step 3: Verify build**

Run:
```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```
git add src/ISUCourseManager.Web/src/components/SemRow.tsx src/ISUCourseManager.Web/src/components/SemRow.module.css
git commit -m "$(cat <<'EOF'
feat(ui): add SemRow with label + credit-color thresholds + tiles

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Add `<PlanView />` component

**Files:**
- Create: `src/ISUCourseManager.Web/src/components/PlanView.tsx`
- Create: `src/ISUCourseManager.Web/src/components/PlanView.module.css`

- [ ] **Step 1: Create `PlanView.module.css`**

```css
.view {
  display: flex;
  flex-direction: column;
}
```

- [ ] **Step 2: Create `PlanView.tsx`**

```tsx
import { PLAN } from '../data/index.ts';
import { SemRow } from './SemRow.tsx';
import styles from './PlanView.module.css';

export function PlanView() {
  return (
    <div className={styles.view}>
      {PLAN.map((row) => (
        <SemRow key={row.semIdx} row={row} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run:
```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```
git add src/ISUCourseManager.Web/src/components/PlanView.tsx src/ISUCourseManager.Web/src/components/PlanView.module.css
git commit -m "$(cat <<'EOF'
feat(ui): add PlanView rendering 8 SemRows from PLAN constant

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Wire `<PlanView />` into `<Main />`

**Files:**
- Modify: `src/ISUCourseManager.Web/src/components/Main.tsx`
- Modify: `src/ISUCourseManager.Web/src/components/Main.module.css`

- [ ] **Step 1: Replace `Main.tsx` with**:

```tsx
import { MainHeader } from './MainHeader.tsx';
import { PlanView } from './PlanView.tsx';
import styles from './Main.module.css';

export function Main() {
  return (
    <main className={styles.main}>
      <MainHeader />
      <PlanView />
    </main>
  );
}
```

- [ ] **Step 2: Replace `Main.module.css` with**:

```css
.main {
  grid-area: main;
  overflow-y: auto;
  background: var(--bg-app);
  display: flex;
  flex-direction: column;
  min-height: 0;
}
```

(The `.body` rule is dropped — `PlanView` brings its own layout.)

- [ ] **Step 3: Verify build**

Run:
```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0.

- [ ] **Step 4: Verify lint**

Run:
```
npm --prefix src/ISUCourseManager.Web run lint
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```
git add src/ISUCourseManager.Web/src/components/Main.tsx src/ISUCourseManager.Web/src/components/Main.module.css
git commit -m "$(cat <<'EOF'
feat(ui): mount PlanView in Main, drop empty body placeholder

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Manual acceptance verification

No automated tests this step.

- [ ] **Step 1: Start dev server**

Run:
```
npm --prefix src/ISUCourseManager.Web run dev
```

Expected: Vite reports `Local: http://localhost:5173/`. Leave running.

- [ ] **Step 2: Verify the plan view renders**

Open `http://localhost:5173` in a desktop-width browser. Confirm each criterion from the design spec (S3-1..S3-11):

- [ ] **S3-1** 8 sem-rows visible inside the main column. Right-panel still collapsed (debug toggle from Step 2 still works).
- [ ] **S3-2** Each row's label column shows `Sem N`, term label (`Fall 2025` / `Spring 2026` / ...), and credit total pill.
- [ ] **S3-3** Sem 1 (Fall 2025) contains 6 student-completed tiles: `Math 1430`, `Engr 1010`, `Lib 1600`, `Engl 1500`, `HDFS 2390`, `Phil 2010`. Sem 2 (Spring 2026) contains 5 student tiles including `Math 1650` rendered as **grade-pending** (desaturated green, dashed border, "grade pending" italic). Sem 3 (Fall 2026) contains 5 student-Planned tiles: `CprE 2810`, `Phys 2310`, `Math 1660`, `Com S 2270`, `Phys 2310L`.
- [ ] **S3-4** Sems 4-8 contain Planned-placeholder tiles for the CYBE flow slots Luke hasn't enrolled in (e.g., Sem 4 shows `Cyb E 2310`, `CprE 2880`, etc. as dashed dept-tinted tiles).
- [ ] **S3-5** Every `Elective*` slot renders as a striped-grey dashed tile labeled "Gen Ed" / "Tech Elec" / "CybE Elec" / "CprE Elec" / "Math Elec" depending on `slotType`, with `Ncr` subtitle.
- [ ] **S3-6** Completed tiles with grades show `{grade} · {credits}cr` in the subtitle (e.g., `Engr 1010` → `A · 0cr`).
- [ ] **S3-7** `Math 1650` (Sem 2) renders as gradePending — visibly distinct from the solid-green completed tiles in Sem 1.
- [ ] **S3-8** Planned tiles (both student-Planned in Sem 3 and unfilled-slot placeholders in Sems 4-8) show **dashed dept-tinted borders** — dashed peach for math, dashed lavender for ComS, etc.
- [ ] **S3-9** Completed/InProgress tiles use dept-tint bg+border (e.g., Math 1430 is peach, CprE 1850 is light-blue). Status comes through via subtitle text.
- [ ] **S3-10** Credit totals are color-coded: green if every tile is Completed, orange < 12cr, red > 18cr, blue 12-18cr.
- [ ] **S3-11** Hovering a tile lifts it slightly (1px). Hovering a sem-row gives the whole row a light-grey background.

- [ ] **Step 3: Verify the `academicTermToLabel` helper output (via the rendered labels)**

Open devtools → Elements; the sem-row labels should read in order:
- Sem 1 — Fall 2025
- Sem 2 — Spring 2026
- Sem 3 — Fall 2026
- Sem 4 — Spring 2027
- Sem 5 — Fall 2027
- Sem 6 — Spring 2028
- Sem 7 — Fall 2028
- Sem 8 — Spring 2029

If any label says `Term 202602` (literal fallback), `academicTermToLabel` isn't being called correctly.

- [ ] **Step 4: Final build + lint clean (S3-13, S3-14)**

Stop the dev server (Ctrl-C in its terminal). Then run:
```
npm --prefix src/ISUCourseManager.Web run build
npm --prefix src/ISUCourseManager.Web run lint
```

Expected: both exit 0.

- [ ] **Step 5: Push branch + report**

If steps 1–4 all pass, push the branch and stop here. No final commit needed — every component already landed in its own task commit.

```
git status
git log --oneline ui-v1/step-3-plan-view ^main
git push -u origin ui-v1/step-3-plan-view
```

Expected `git status`: clean. `git log` shows the 14 implementation commits (the Task 1-13 commits) on top of the spec commit `3faaa11`. `git push` succeeds.

Then update `docs/session-state.md` to reflect Step 3 completion (single small follow-up commit on top of the branch). Open a PR via gh CLI or the GitHub web UI.

---

## Self-review (writer's checklist)

**Spec coverage:**

| Spec criterion | Implemented in |
|---|---|
| S3-1 (8 sem-rows, right-panel preserved) | Tasks 12, 13; verified Task 14 step 2 |
| S3-2 (label column + credit pill + tiles) | Task 11; verified Task 14 step 2 |
| S3-3 (Luke's enrollment at his terms) | Tasks 7-9 (data pipeline), 10-11 (rendering); verified Task 14 step 2 |
| S3-4 (unfilled DegreeClass placeholders) | Task 8 (overlay rule 2); verified Task 14 step 2 |
| S3-5 (Elective* placeholders) | Task 8 (overlay rule 3); verified Task 14 step 2 |
| S3-6 (Completed subtitle = `{grade} · {credits}cr`) | Task 10 (CourseTile branch); verified Task 14 step 2 |
| S3-7 (gradePending state for null grade) | Task 10 (gradePending branch); verified Task 14 step 2 |
| S3-8 (dashed dept-tinted border for Planned) | Task 10 (CSS cascade ordering); verified Task 14 step 2 |
| S3-9 (dept-tint dominates bg/border-color) | Task 10 (CSS cascade ordering); verified Task 14 step 2 |
| S3-10 (credit color thresholds) | Task 11 (creditColorClass); verified Task 14 step 2 |
| S3-11 (hover lift / row bg) | Task 10 + Task 11 CSS; verified Task 14 step 2 |
| S3-12 (academicTermToLabel) | Task 3; verified Task 14 step 3 |
| S3-13 (build clean) | Run after every task; final in Task 14 step 4 |
| S3-14 (lint clean) | Task 13 step 4; final in Task 14 step 4 |
| S3-15 (visual match in browser) | Task 14 steps 1-3 |

All 15 criteria covered by at least one task and one verification step.

**Placeholder scan:** no "TBD", "TODO", or "implement later". Every step has either complete code or a complete command with expected output.

**Type / name consistency:**
- `PlanTile` discriminated union variants: `'studentCourse' | 'unfilledDegreeSlot' | 'electiveSlot'` — used consistently across `overlay.ts` (Task 8), `CourseTile.tsx` (Task 10), `SemRow.tsx` (Task 11).
- `FlowSlot` discriminated union: `'degreeClass' | 'elective'` — used consistently in `types.ts` (Task 2), `flow.ts` (Task 6), `overlay.ts` (Task 8).
- `StudentCourseStatus`: `'Planned' | 'InProgress' | 'Completed' | 'Failed' | 'Withdrawn'` — used in `types.ts` (Task 2), `student.ts` (Task 7), `overlay.ts` (Task 8), `CourseTile.tsx` (Task 10). The `statusToClass` switch in Task 10 handles all 5 cases (Withdrawn falls back to `planned`).
- `ElectiveSlotType`: 5 variants — exhaustive switch in `CourseTile.tsx` (`electiveLabel`) handles all of them.
- CSS class names match between `CourseTile.module.css` (Task 10) and the runtime class lookups (`styles[statusClass]`, `styles[tile.dept]`).
- The credit-color class names in `SemRow.module.css` (Task 11: `creditsNormal` / `creditsOver` / `creditsUnder` / `creditsDone`) match the return values of `creditColorClass()` in `SemRow.tsx`.
- File extensions on imports: every relative import uses `.ts` or `.tsx`, matching the project's `allowImportingTsExtensions: true` convention.

No drift found.
