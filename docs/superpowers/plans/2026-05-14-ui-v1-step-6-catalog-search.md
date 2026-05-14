# UI v1 Step 6 (Catalog Search) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a text search input at the top of `<SlotPicker />` that filters the "Add a new course from the catalog" section live as the user types. Empty query → first 8 entries (Step 5 default). Non-empty query → up to 20 substring matches across classId/code/name/department; section header gains a count badge.

**Architecture:** Self-contained change inside `SlotPicker.tsx`. Local `useState` for the query value. Inline filter function (`matchesQuery` + slice cap). The private `Section` helper gains an optional `badge` prop for the count display.

**Tech Stack:** Same as Steps 2-5. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-14-ui-v1-step-6-catalog-search-design.md`

**Branch:** `ui-v1/step-6-catalog-search` (already cut from main; spec committed at `fb90374`).

---

## File Structure

**Modify:**
- `src/ISUCourseManager.Web/src/components/SlotPicker.tsx` — add `useState` import, `query` state, search input, filter logic, badge on the catalog section.
- `src/ISUCourseManager.Web/src/components/SlotPicker.module.css` — add `.searchInput` (+ `:focus`) and `.sectionBadge` rules.

No other files touched. No type changes.

---

## Notes for the executor

- **Run all commands from the repo root: `C:/Users/lukeb/source/repos/ISUCourseManager`**. Use `npm --prefix src/ISUCourseManager.Web run <script>`. Do NOT `cd`.
- **TypeScript strictness:** `verbatimModuleSyntax: true` (use `import type`), `noUnusedLocals: true`, `allowImportingTsExtensions: true`, `erasableSyntaxOnly: true`.
- **Commit style:** Conventional Commits, `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer.

---

## Pre-flight: confirm starting state

- [ ] **Step 1: Confirm branch + clean working tree**

```
git status
git rev-parse --abbrev-ref HEAD
```

Expected: branch `ui-v1/step-6-catalog-search`. Working tree clean (or only `.claude/` untracked).

- [ ] **Step 2: Confirm Step 5 build still passes**

```
npm --prefix src/ISUCourseManager.Web run build
npm --prefix src/ISUCourseManager.Web run lint
```

Expected: both exit 0.

---

## Task 1: Add search input + filter + count badge to SlotPicker

**Files:**
- Modify: `src/ISUCourseManager.Web/src/components/SlotPicker.tsx`
- Modify: `src/ISUCourseManager.Web/src/components/SlotPicker.module.css`

- [ ] **Step 1: Append CSS rules to `SlotPicker.module.css`**

Add these three rules at the end of the file:

```css
.searchInput {
  width: 100%;
  padding: 6px 10px;
  margin-bottom: 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 12px;
  font: inherit;
  box-sizing: border-box;
}

.searchInput:focus {
  outline: none;
  border-color: #1976d2;
}

.sectionBadge {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 6px;
  background: #e0e0e0;
  color: var(--text-label);
  font-size: 9px;
  font-weight: 700;
  border-radius: 8px;
  text-transform: none;
  letter-spacing: 0;
  vertical-align: middle;
}
```

- [ ] **Step 2: Replace `SlotPicker.tsx` with**:

```tsx
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Course, ElectiveSlotType, UnfilledTile } from '../data/types.ts';
import { academicTermToLabel } from '../data/academicTerm.ts';
import { catalogById } from '../data/catalog.ts';
import styles from './SlotPicker.module.css';

type Props = {
  tile: UnfilledTile;
  onClose: () => void;
};

const CATALOG_RESULT_CAP = 20;
const CATALOG_DEFAULT_COUNT = 8;

export function SlotPicker({ tile, onClose }: Props) {
  const [query, setQuery] = useState('');

  const trimmed = query.trim().toLowerCase();
  const isSearching = trimmed.length > 0;

  const catalogResults: Course[] = isSearching
    ? filterCatalog(trimmed)
    : Array.from(catalogById.values()).slice(0, CATALOG_DEFAULT_COUNT);

  const catalogBadge = isSearching
    ? `${catalogResults.length} match${catalogResults.length === 1 ? '' : 'es'}`
    : undefined;

  const ctx = contextLine(tile);

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
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search catalog…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search catalog"
        />

        <Section title="Pull from a later semester">
          <p className={styles.emptyMessage}>No pull-forward candidates yet.</p>
        </Section>

        <Section title="Add a new course from the catalog" badge={catalogBadge}>
          {catalogResults.length > 0 ? (
            catalogResults.map((course) => (
              <button key={course.classId} type="button" className={styles.card}>
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

Key changes from Step 5:
- Added `import { useState } from 'react';` and `import type { Course, ... }` (new `Course` type).
- Added two module-level constants `CATALOG_RESULT_CAP = 20`, `CATALOG_DEFAULT_COUNT = 8`.
- `query` state + `trimmed` + `isSearching` derived flags.
- `catalogResults` branches on `isSearching` (helper `filterCatalog` with O(N) loop + early-exit at the cap).
- `catalogBadge` string built from match count (singular/plural) when searching.
- Search `<input>` rendered as the FIRST child of `.body` (above the 3 sections).
- Catalog section now renders empty-state message when `catalogResults.length === 0`.
- `Section` helper extended with optional `badge?: string` prop; renders inline `<span className={styles.sectionBadge}>` after the title.
- New helper functions `filterCatalog` + `matchesQuery` placed at module scope.

- [ ] **Step 3: Verify build**

```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0.

- [ ] **Step 4: Verify lint**

```
npm --prefix src/ISUCourseManager.Web run lint
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```
git add src/ISUCourseManager.Web/src/components/SlotPicker.tsx src/ISUCourseManager.Web/src/components/SlotPicker.module.css
git commit -m "$(cat <<'EOF'
feat(ui): add catalog search input to SlotPicker

Search bar at the top of the body filters the "Add from catalog"
section live as the user types. Empty query keeps Step 5's first-8
default. Non-empty query: substring match across classId/code/name/
department, up to 20 results. Section header gets a "{N} match(es)"
count badge when searching. Other sections unaffected.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Manual acceptance verification

No automated tests this step.

- [ ] **Step 1: Start dev server**

```
npm --prefix src/ISUCourseManager.Web run dev
```

Expected: Vite reports `Local: http://localhost:5173/` (or next free port). Leave running.

- [ ] **Step 2: Verify search input chrome (S6-1, S6-2)**

Open the dev URL in a desktop-width browser. Click one of the Sem 8 elective placeholders.

- [ ] **S6-1** The slot picker opens with a text input at the top of the body, above the 3 sections. Placeholder reads `Search catalog…`. 1px grey border, 4px radius.
- [ ] **S6-2** Click into the input. The border changes to blue `#1976d2`. Click elsewhere → border returns to grey.

- [ ] **Step 3: Verify empty-query default (S6-3)**

- [ ] **S6-3** With the input empty: the "Add a new course from the catalog" section shows exactly **8 catalog cards** (same as Step 5). The section header reads just `Add a new course from the catalog` — no badge.

- [ ] **Step 4: Verify search with matches (S6-4, S6-6)**

- [ ] **S6-4** Type `math` into the search input. Catalog section filters in real-time. You should see all courses with "math" appearing in classId / code / name / department — likely a handful (MATH-1430, MATH-1650, MATH-1660, MATH-2670, etc.). Section header now reads `Add a new course from the catalog` followed by a small grey pill like `4 matches` (or however many appear).
- [ ] **S6-6** Type a single letter (e.g., `m`) — many more matches appear. Backspace to clear → returns to the 8-default. Type a precise string (e.g., `calc`) — only courses with "calc" in name or code remain (MATH-1430 "Pre-Calc", MATH-1650 "Calc I", MATH-1660 "Calc II").

- [ ] **Step 5: Verify no-matches state (S6-5)**

- [ ] **S6-5** Type `xyz` (a string that won't match anything). The catalog section shows the centered italic message `No courses match "xyz".` Badge reads `0 matches`.

- [ ] **Step 6: Verify other sections unaffected (S6-7)**

- [ ] **S6-7** With any query in the search input, the "Pull from a later semester" section still shows `No pull-forward candidates yet.` and the "Leave this slot empty" section still shows its single muted card. Neither responds to the search query.

- [ ] **Step 7: Verify query reset on remount (S6-8)**

- [ ] **S6-8** Type something into the search. Click the panel `×` to close. Reopen the same elective tile. The search input should be empty (fresh state on remount).

- [ ] **Step 8: Verify query persists when switching elective tiles (S6-9)**

- [ ] **S6-9** Type something into the search. Without closing the panel, click the OTHER elective tile in Sem 8. The slot picker content updates to the new tile's context (breadcrumb / ctx may change), but the search query and filtered results PERSIST (this is the documented S6-D11 decision — the SlotPicker is not unmounted when the `tile` prop changes, so React reuses the existing instance and state). Acceptable per the spec.

- [ ] **Step 9: Verify Step 4 + Step 5 behaviors preserved (S6-10)**

- [ ] **S6-10** Click any studentCourse tile (e.g., a Sem 3 Planned tile). ActionMenu opens with the full 4-section action set. Blue `.selected` ring on the tile. Click a Completed tile (Sem 1) → trimmed empty-message body. All Step 4 + Step 5 ACs still pass.

- [ ] **Step 10: Final build + lint clean (S6-11, S6-12)**

Stop the dev server (Ctrl-C in its terminal). Then run:

```
npm --prefix src/ISUCourseManager.Web run build
npm --prefix src/ISUCourseManager.Web run lint
```

Expected: both exit 0.

- [ ] **Step 11: Report**

If all S6-1..S6-10 ACs pass plus the final build/lint check (S6-11/S6-12) and user-confirmed visual (S6-13), no further commits needed — Task 1's commit covers all code changes. Report success to the controller; final whole-branch review and finishing-branch flow handle the rest.

---

## Self-review (writer's checklist)

**Spec coverage:**

| Spec criterion | Implemented in |
|---|---|
| S6-1 (search input chrome) | Task 1 (Step 1 CSS + Step 2 TSX); verified Task 2 step 2 |
| S6-2 (focus state) | Task 1 (`.searchInput:focus` rule); verified Task 2 step 2 |
| S6-3 (empty query default = 8) | Task 1 (`isSearching ? ... : slice(0, CATALOG_DEFAULT_COUNT)`); verified Task 2 step 3 |
| S6-4 (filter + badge) | Task 1 (filterCatalog + matchesQuery + catalogBadge); verified Task 2 step 4 |
| S6-5 (no-matches message) | Task 1 (`catalogResults.length > 0 ? cards : emptyMessage`); verified Task 2 step 5 |
| S6-6 (narrow / broad queries) | Task 1 (substring across 4 fields); verified Task 2 step 4 |
| S6-7 (other sections unaffected) | Task 1 (Pull and Leave-empty sections unchanged); verified Task 2 step 6 |
| S6-8 (query resets on remount) | Task 1 (local `useState('')` on mount); verified Task 2 step 7 |
| S6-9 (query persists on tile switch) | Documented spec decision S6-D11; verified Task 2 step 8 (acceptable per spec) |
| S6-10 (Step 4 + 5 preserved) | No changes to ActionMenu / CourseTile / SemRow / App; verified Task 2 step 9 |
| S6-11 (build clean) | Task 1 step 3; final Task 2 step 10 |
| S6-12 (lint clean) | Task 1 step 4; final Task 2 step 10 |
| S6-13 (visual match) | Task 2 steps 2-9, user-verified |

All 13 criteria covered.

**Placeholder scan:** no "TBD" / "TODO" / "implement later". Every step has complete code or a verifiable command.

**Type / name consistency:**
- `Course` type imported and used as the return type of `filterCatalog`, the element type of `catalogResults`, and the param type of `matchesQuery`. Already exported from `data/types.ts` from Step 3 — no new type definitions needed.
- `CATALOG_RESULT_CAP = 20` and `CATALOG_DEFAULT_COUNT = 8` are module-level constants — no magic numbers in the function bodies.
- `Section` helper signature `{ title: string; badge?: string; children: ReactNode }` matches the call site `<Section title="..." badge={catalogBadge}>` (where `catalogBadge: string | undefined`).
- `isSearching` derived from `trimmed.length > 0` — consistent across the `catalogResults` and `catalogBadge` computations.
- CSS class names match between TSX and CSS module: `.searchInput`, `.sectionBadge`. New rules added at end of file.
- The `.emptyMessage` class is already defined (Step 5); reused here for the no-matches message.
- File extensions on imports: every relative import keeps `.ts`/`.tsx`.

No drift found.
