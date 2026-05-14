# UI v1 — Step 3 (Plan View Overlay) — Design Spec

**Date:** 2026-05-14
**Status:** Approved for planning
**Author:** Kevin (with Claude)
**Companion to:**
- `docs/superpowers/specs/2026-05-13-ui-v1-design.md` (UI v1 design — source of truth)
- `docs/superpowers/specs/2026-05-14-ui-v1-step-2-layout-skeleton-design.md` (preceding step — layout chrome)
- `docs/superpowers/mockups/ui-v1/tightened-desktop-v4.html` (locked layout)
- `docs/superpowers/specs/2026-05-13-pending-grade-and-coreq-cascade-design.md` (pending-grade tile state)

## 1. Goal

Fill the empty plan-view region from Step 2 with **real sem-rows and course tiles**. Drive the rendering from the actual CYBE 2025-26 flow + Luke's enrollment data + the ISU catalog, all imported as JSON at build time. No API yet, no interactivity beyond hover — this step builds the tile + sem-row primitive and proves the overlay-join logic against a real dataset, on top of the locked v4 visual system.

This is Step 3 of an iterative UI v1 build (Step 1 = scaffold, Step 2 = layout skeleton). Subsequent steps add MSW data flow, action menu, validation, AI panel.

## 2. Scope

### In scope
- **Data sources:** three JSON imports at build time (no `fetch`, no MSW):
  - `isu-catalog.json` → `Map<classId, Course>`
  - `flow-cybe-2025-26.example.json` → `DegreeFlow` with `slots[]`
  - `student-luke.json` → student + `StudentCourse[]`
- **Overlay logic** (pure function `buildOverlay(flow, studentCourses, catalogById)`):
  1. For each of 8 sems (derived from flow), walk the slots
  2. For `DegreeClass` slots: if a `StudentCourse` exists with matching `classId` (at any term), do NOT emit a placeholder; that StudentCourse renders at its own term elsewhere
  3. For `DegreeClass` slots without a matching `StudentCourse`: emit a `Planned` placeholder tile at the slot's canonical sem, enriched from the catalog
  4. For `Elective*` slots: always emit an `.electiveEmpty` placeholder at the slot's canonical sem
  5. For `StudentCourse`s that don't match any flow slot (Luke's MATH-1430, HDFS-2390, PHIL-2010): render as orphan tiles at their actual term
- **`<CourseTile />` primitive** rendering the v4 status states from UI spec §5 plus the pending-grade state from the addendum spec:
  - `.completed` / `.inprogress` / `.planned` / `.failed`
  - `.gradePending` (addendum: Completed + null grade)
  - `.electiveEmpty` (slot placeholder)
  - Dept tint classes: `.math`, `.cpre`, `.cybe`, `.coms`, `.engl`, `.gened`; everything else falls back to `.gened`
  - Hover state (1px lift via `translateY`)
- **`<SemRow />` primitive** with the 96px label column ("Sem N / Term YYYY / total-cr pill") and tiles flowing right with wrap; row hover bg.
- **`<PlanView />`** replaces Step 2's empty body region inside `<Main />`, renders 8 sem-rows.
- **Helpers** in `src/data/`:
  - `academicTermToLabel(202602) → "Fall 2025"` (UI spec §1 wire conventions)
  - `flowSemToAcademicTerm(semIdx, catalogStartYear)` for placeholder tile term assignment
  - `departmentToCssClass(dept)` — known 6 + `.gened` fallback
  - `normalizeSeedStudentCourse` — maps seed's `"Complete"` → `"Completed"` and `""` grade → `null`
- **Credit-color thresholds** per UI spec §4 / S2-D credit rules: blue (12-18), orange (<12), red (>18), green (all-completed).

### Out of scope
- Validation, banner content, **Marker states** (`.invalid`, `.cascade-affected`, `.ext-badge`, `.ai-context`, `.selected`, `.dragging`, etc.) — they need state that doesn't exist yet
- **"Moved" rendering** (`.unfulfilled-degree` "moved to Sem N") — defers to validation step
- **Click handlers** / action menu / slot picker / drag-and-drop
- AI sem-row `✦` scope chip
- MSW / async data loading
- Student name binding (TopBar's "Hi, Luke" stays hardcoded from Step 2)
- Tests / Storybook / routing

## 3. Frontend types

```ts
// src/data/types.ts

export type StudentCourseStatus =
  | 'Planned' | 'InProgress' | 'Completed' | 'Failed' | 'Withdrawn';

export type Course = {
  classId: string;         // "MATH-1650"
  code: string;            // "Math 1650"  (display)
  name: string;            // "Calc I"
  credits: number;
  department: string;      // free-text from catalog
};

export type ElectiveSlotType =
  | 'ElectiveGenEd' | 'ElectiveMath' | 'ElectiveTech' | 'ElectiveCybE' | 'ElectiveCprE';

export type FlowSlot =
  | { kind: 'degreeClass'; semester: number; classId: string; displayOrder: number; }
  | { kind: 'elective';    semester: number; slotType: ElectiveSlotType; requiredCredits: number; displayOrder: number; };

export type DegreeFlow = {
  code: string;            // "CYBE"
  catalogYear: string;     // "2025-26"
  slots: FlowSlot[];
};

export type StudentCourse = {
  courseId: string;
  academicTerm: number;    // YYYYSS
  status: StudentCourseStatus;
  grade: string | null;
};

// Discriminated tile union consumed by <CourseTile />
export type PlanTile =
  | { kind: 'studentCourse'; classId: string; code: string; name: string; credits: number; dept: string;
      status: StudentCourseStatus; grade: string | null; }
  | { kind: 'unfilledDegreeSlot'; classId: string; code: string; name: string; credits: number; dept: string; }
  | { kind: 'electiveSlot'; slotType: ElectiveSlotType; requiredCredits: number; };

export type PlanRow = {
  semIdx: number;          // 1..8
  academicTerm: number;
  tiles: PlanTile[];
  totalCredits: number;
  allCompleted: boolean;   // for credit-color: green when every tile is Completed
};
```

These match the eventual API DTO shape per UI spec §1 wire conventions — the seed-loader's `"Complete"` is converted to the spec's `"Completed"` by `normalizeSeedStudentCourse`.

## 4. File structure

```
src/ISUCourseManager.Web/src/
├── data/                                 NEW
│   ├── types.ts                          type definitions (§3)
│   ├── catalog.ts                        imports isu-catalog.json, builds Map<classId, Course>
│   ├── flow.ts                           imports flow JSON, parses catalogStartYear, normalizes slots
│   ├── student.ts                        imports student JSON, runs normalizeSeedStudentCourse
│   ├── academicTerm.ts                   encode/decode helpers
│   ├── department.ts                     departmentToCssClass with fallback
│   ├── overlay.ts                        buildOverlay pure function
│   ├── index.ts                          exports `PLAN: PlanRow[]` (computed at module load)
│   └── seed/                             copies of the three seed JSON files
│       ├── isu-catalog.json
│       ├── flow-cybe-2025-26.example.json
│       └── student-luke.json
└── components/
    ├── (Step 2 files unchanged)
    ├── CourseTile.tsx                    NEW
    ├── CourseTile.module.css             NEW
    ├── SemRow.tsx                        NEW
    ├── SemRow.module.css                 NEW
    ├── PlanView.tsx                      NEW
    └── PlanView.module.css               NEW
```

**Modified files:**
- `Main.tsx` — replace `<div className={styles.body} />` with `<PlanView />`; remove `.body` import
- `Main.module.css` — drop the `.body` rule

**Seed-file decision:** the JSONs are committed copies under `src/data/seed/` rather than reached across the repo with `../../../Documentation/...`. Vite needs them inside `src/` to bundle. Two copies of the data is the standard interim approach until the API loads them server-side.

## 5. Dept-tint cascade (follows v4 verbatim)

The v4 mockup's tile CSS has status classes declared BEFORE dept classes. With equal CSS-selector specificity, the later rule wins on conflicting properties:
- `.completed` / `.planned` / `.inprogress` set `background` + `border-color` (+ `border-style: dashed` for `.planned`)
- `.math` / `.cpre` / `.cybe` / `.coms` / `.engl` / `.gened` set `background-color` + `border-color`, but NOT `border-style`

**Net rendering:**
- For Completed / InProgress / Planned + dept: bg = dept color, border-color = dept color, border-style = preserved from status (dashed for Planned, solid otherwise).
- Status indication is therefore via **subtitle text** (grade + cr for Completed; just cr otherwise) and **border-style** (dashed for Planned only).
- Dept tint visually dominates — UI spec §4 text says "status takes visual priority" but the locked v4 CSS implements dept-tint priority. **We follow v4 verbatim** and document the divergence here.

**Special cases — no dept tint applied:**
- `.gradePending` (Completed + null grade): desaturated green bg, dashed green border, italic "grade pending" subtitle. Dept tint suppressed so the pending-grade signal isn't washed out.
- `.electiveEmpty`: striped diagonal grey bg, dashed grey border, "Gen Ed" / "Tech Elec" / etc. label. No dept (slot placeholders aren't department-bound).

**Dept fallback:** `departmentToCssClass()` maps `Math`/`CprE`/`CybE`/`ComS`/`Engl`/`GenEd` literally; everything else (Chem, Engr, HDFS, Phil, Lib, Phys, …) → `gened` slate. Palette extension is a later step's call.

## 6. Acceptance criteria

Manual verification only.

| # | Criterion |
|---|---|
| S3-1 | Plan view renders **8 sem-rows** in order. Right-panel collapsed state from Step 2 preserved. |
| S3-2 | Each sem-row's label column shows `Sem N` + `Fall YYYY` or `Spring YYYY` + total-credit pill, then tiles flowing right with wrap. |
| S3-3 | Luke's 16 enrolled courses each render at their actual term: **Sem 1 (Fall 2025)** contains his `MATH-1430`, `ENGR-1010`, `LIB-1600`, `ENGL-1500`, `HDFS-2390`, `PHIL-2010` (6 student tiles, all Completed); **Sem 2 (Spring 2026)** contains his `MATH-1650` (pending grade), `CPRE-1850`, `CHEM-1670`, `CPRE-1660`, `ENGL-2500` (5 student tiles); **Sem 3 (Fall 2026)** contains his `CPRE-2810`, `PHYS-2310`, `MATH-1660`, `COMS-2270`, `PHYS-2310L` (5 student tiles, all Planned). Each row may also contain additional Planned placeholders (per S3-4) and elective placeholders (per S3-5) from unmatched flow slots — those tile counts are not constrained by this criterion. |
| S3-4 | DegreeClass slots in the CYBE flow whose `classId` has no matching `StudentCourse` render as Planned placeholders at their canonical sem (e.g., sems 4-8 fill out with planned CYBE tiles). Tile content comes from the catalog. |
| S3-5 | Every `Elective*` slot in the flow renders as an `.electiveEmpty` placeholder (striped, dashed grey border, dimmed text) at its canonical sem, labeled per type ("Gen Ed", "Tech Elec", "CybE Elec", etc.). |
| S3-6 | Completed tile with non-empty grade renders `{grade} · {credits}cr` in the subtitle (e.g., `ENGR-1010` → `A · 0cr`; `CPRE-1850` → `C · 3cr`). |
| S3-7 | Completed tile with null/empty grade renders the **`.gradePending` state**: desaturated green bg `#f1f8e9`, dashed border `#aed581`, italic `grade pending` subtitle, no dept tint. Verified specifically on Luke's `MATH-1650`. |
| S3-8 | Planned tiles (both student-planned and unfilled-slot placeholders) render with a **dashed border in the dept tint color** (e.g., dashed peach for math, dashed lavender for ComS). `border-style: dashed` from `.planned` persists through the dept-tint cascade override. |
| S3-9 | Dept tint dominates bg + border-color for Completed / InProgress / Planned tiles. Status is communicated by subtitle text and border-style (dashed for Planned, solid otherwise). |
| S3-10 | Credit total color: blue when 12 ≤ total ≤ 18, orange when < 12, red when > 18, green when every tile in the row is `Completed`. Verified on Luke's rows (Sem 1 → green if all-completed; sems 4-8 → blue if 12-18). |
| S3-11 | Hovering a tile lifts it 1px (`translateY`); hovering a sem-row gives it bg `#f8f9fa`. No click handler fires. |
| S3-12 | `academicTermToLabel`: `202602 → "Fall 2025"`, `202604 → "Spring 2026"`, `202702 → "Fall 2026"`. Year is academic-cycle-ending; season `02`=Fall maps to calendar year − 1, `04`=Spring maps to calendar year. |
| S3-13 | `npm run build` exits 0. |
| S3-14 | `npm run lint` exits 0. |
| S3-15 | `npm run dev` serves at `http://localhost:5173` and the rendered DOM visually matches S3-1..S3-11. **User-verified.** |

## 7. Out-of-band notes

- **Branch strategy:** stack Step 3 commits on a NEW branch `ui-v1/step-3-plan-view` cut from current `main` (Step 1+2 already merged via PR #4). Single PR at the end.
- **No tests:** Vitest / RTL / Storybook still deferred. Same call as Step 2.
- **Seed-file copies:** the three JSONs under `src/data/seed/` duplicate the originals in `Documentation/seed-templates/`. When the API eventually loads them server-side, this dir goes away. Worth noting in the next session-state update so the duplication doesn't get lost.
- **Pending-grade addendum:** `2026-05-13-pending-grade-and-coreq-cascade-design.md` defines more states than this step uses (`.completed.failed-req`, `.pending-dep`, `.pending-coreq-dep`, `.invalid.via-coreq`). Those need validation output that doesn't exist yet; deferred to whatever step introduces validation.

## 8. Decisions log

| # | Decision | Rationale |
|---|---|---|
| S3-D1 | Overlay flow slots + student data (vs. course-only or slots-only) | Matches v4 mockup; tests the join logic against a real dataset; makes the layout look complete across all 8 sems even when Luke's data is sparse. |
| S3-D2 | Hover only — no click handlers in Step 3 | Action menu / slot picker need state and panel-mount infrastructure that haven't been built. Premature plumbing risks rework. |
| S3-D3 | Static module-load `PLAN: PlanRow[]` constant (no `usePlan()` hook yet) | Data is synchronous from JSON imports. A hook would just wrap the constant with no benefit until MSW arrives. |
| S3-D4 | Follow v4 CSS verbatim: dept tint wins bg/border-color | The locked mockup is the source of truth; spec §4 text disagrees but the mockup is the locked artifact. Documented as a divergence so the next reviewer doesn't re-litigate. |
| S3-D5 | Suppress dept tint on `.gradePending` and `.electiveEmpty` | These states need their visual signal preserved (pending = dashed green; elective = striped grey). Dept tint would wash them out. |
| S3-D6 | Dept fallback to `.gened` for unknown depts (Chem, Engr, HDFS, Phil, Lib, Phys, …) | Pragmatic. Palette extension can wait until visual feedback says it matters. |
| S3-D7 | Seed JSONs copied into `src/data/seed/` rather than relative-imported from `Documentation/seed-templates/` | Vite bundles only files under `src/`. Two copies until API ships; acceptable interim cost. |
| S3-D8 | New branch `ui-v1/step-3-plan-view` (vs. stacking on Step 2's branch) | Step 1+2 already merged to main. Fresh branch is the natural choice; reverses the S2-D1 stacking decision now that the prior work has shipped. |
| S3-D9 | Discriminated `PlanTile` union (vs. nullable fields) | Each tile variant has different required fields; a union lets TypeScript guard the rendering branches. |

## 9. Open items / next step

- None blocking Step 3. After implementation lands and S3-1..S3-15 pass, Step 4 picks up from `docs/session-state.md` (MSW mock, action menu, validation, etc.).
