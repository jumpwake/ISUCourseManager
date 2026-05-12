# ISU Course Manager — Design Spec

**Date:** 2026-05-12
**Status:** Approved for planning
**Author:** Kevin (with Claude)

## 1. Goals

Build an interactive degree-flow planner that helps an ISU student stay on track when reality deviates from the printed major flowchart. Each row of the flowchart is a semester; lines between courses are prereqs and coreqs. When a student misses a class, fails a class, or has a scheduling conflict, downstream courses cascade and the entire plan must be re-shaped.

The product takes that mental gymnastics off the student and presents a guided, visual experience.

**POC target user:** one student (Kevin's son) following the **Cyber Security Engineering (CybE) 2025-26** flowchart. Architecture must extend cleanly to multiple students and multiple majors.

**Future direction:** mobile app reusing the same API; intelligent elective recommendations; more majors; multi-flow overlays for major-change planning.

## 2. Scope

### In scope (POC)

- Single major: CybE 2025-26 only (data seed for one `DegreeFlow`).
- Single student, no multi-tenant UI.
- Stubbed JWT auth — middleware injects a fixed `studentId` claim. Real auth is a later swap.
- Hand-curated JSON seed files: one for the universal class registrar, one per `DegreeFlow`.
- Interactive plan view (UI layout chosen during implementation iteration).
- Direct CRUD for routine adds/drags/grade entries.
- Guided wizard for cascade-triggering events: skipped class, failed grade, withdrawal, explicit "replan from here," what-if major switch.
- Server-computed validation issues returned alongside every plan read.
- Single-level undo via plan snapshot.
- TDD-first development, especially the cascade engine.

### Out of scope (deferred)

- Real auth implementation; full JWT issuance/refresh.
- Live ISU catalog scraper (seed JSON only for now; scraper later).
- Section/time-conflict detection (only semester-level placement).
- Term-offering data (assume every course is offered every term).
- Intelligent elective recommendation engine (placeholder slots only for POC).
- Multi-level undo / full audit trail.
- Print/PDF export, notifications, collaborative editing.
- Mobile client (API will be designed to support it; UI is web-only).
- Hosting/deployment hardening.

## 3. Architecture

### Stack

- **Frontend:** React + Vite + TypeScript SPA. Served separately during dev (Vite dev server, proxies `/api/*` to backend).
- **Backend:** ASP.NET Core Web API.
- **DB (POC):** SQLite, accessed via EF Core. Same EF code targets SQL Server in production (Azure or WinHost).
- **Auth:** JWT bearer middleware *stub* that injects a fixed `studentId` claim. Real JWT/claims implementation deferred.

### Backend project layout

Three projects with a clean dependency direction `Api → Services → Data`:

```
ISUCourseManager.sln
├── src/
│   ├── ISUCourseManager.Api/          ASP.NET Core entry, controllers, DI,
│   │                                  JWT-stub middleware, swagger, DTOs
│   ├── ISUCourseManager.Services/     business logic — PlanService,
│   │                                  CascadeEngine, PrereqEvaluator,
│   │                                  CatalogService, IPlanRepository, ...
│   └── ISUCourseManager.Data/
│       ├── Entity/                    POCO entities (Course, DegreeFlow,
│       │                              FlowchartSlot, Plan, PlanItem, Student)
│       ├── Configurations/            EF Fluent API configs
│       ├── Repositories/              EF implementations of I*Repository
│       ├── Migrations/
│       ├── Seed/
│       │   ├── isu-catalog.json
│       │   ├── flow-cybe-2025-26.json
│       │   └── JsonSeedLoader.cs
│       └── ApplicationDbContext.cs
├── tests/
│   ├── ISUCourseManager.Services.Tests/   xUnit + FluentAssertions
│   └── ISUCourseManager.Api.Tests/        WebApplicationFactory + SQLite-in-memory
└── web/                                   React + Vite + TS (own package.json)
```

### Component diagram

```
┌─────────────────────────┐         ┌──────────────────────────────────────┐
│   React + Vite + TS     │  HTTPS  │       ASP.NET Core Web API           │
│   (browser SPA)         │ ◄─────► │  Controllers (thin)                  │
│   - Plan view           │  REST   │       │                              │
│   - Wizard modals       │  JSON   │       ▼                              │
│   - Catalog browser     │         │  Services (PlanService, CascadeEngine,│
│   - Major switcher      │         │            PrereqEvaluator, ...)     │
└─────────────────────────┘         │       │                              │
                                    │       ▼                              │
                                    │  Repositories (EF Core)              │
                                    │       │                              │
                                    │       ▼                              │
                                    │  ApplicationDbContext → SQLite       │
                                    └──────────────────────────────────────┘
                                                ▲
                                                │ seeded once on startup
                                  ┌─────────────┴──────────────┐
                                  │  isu-catalog.json          │
                                  │  flow-cybe-2025-26.json    │
                                  └────────────────────────────┘
```

## 4. Domain Model

Three tiers, each with a different update cadence and authority.

### Tier 1: Class Registrar (universal facts)

The full ISU catalog of courses. Read-mostly. Same data regardless of major.

```csharp
class Course {                    // table: courses
  Guid Id;
  string Code;            // "Math 1650"
  string Name;
  decimal Credits;
  string Department;      // "Math", "CprE", ...
  PrereqExpression? Prereqs;     // tree, JSON column
  PrereqExpression? Coreqs;      // tree, JSON column
  bool IsActive;
}
```

**Prereq expression tree** handles AND/OR/grade gates:

```csharp
abstract class PrereqExpression { }
class PrereqAnd    : PrereqExpression { List<PrereqExpression> Children; }
class PrereqOr     : PrereqExpression { List<PrereqExpression> Children; }
class PrereqCourse : PrereqExpression {
  Guid CourseId;
  string? MinGrade;             // "C-" or null
  bool AcceptConcurrent;        // for "Cr or enrollment in X"
}
```

Stored as a JSON column on `Course`.

### Tier 2: DegreeFlow (per-flow recommended ordering)

A specific major+catalog year. Multiple `DegreeFlow`s can coexist; the same `Course` rows are referenced by all of them. Switching majors = rendering the same plan against a different `DegreeFlow`.

```csharp
class DegreeFlow {                // table: degree_flows
  Guid Id;
  string MajorCode;       // "CYBE"
  string MajorName;       // "Cyber Security Engineering"
  string CatalogYear;     // "2025-26"
  int TotalCreditsRequired;
}

class FlowchartSlot {             // table: flowchart_slots
  Guid Id;
  Guid DegreeFlowId;
  int Semester;                   // recommended placement (1..8)
  SlotKind Kind;                  // FixedClass | CategoryChoice
  Guid? CourseId;                 // when Kind = FixedClass
  string? Category;               // when Kind = CategoryChoice
                                  //   ("GenEd", "TechElective", "CybEElective",
                                  //    "MathElective", "CprEElective")
  decimal RequiredCredits;
  string? MinGrade;               // grade requirement specific to this flow
  int DisplayOrder;
}

enum SlotKind { FixedClass, CategoryChoice }
```

**Self-contained file format** (denormalized for human reading):

```jsonc
// flow-cybe-2025-26.json
{
  "code": "CYBE",
  "name": "Cyber Security Engineering",
  "catalogYear": "2025-26",
  "totalCreditsRequired": 125,
  "slots": [
    { "semester": 1, "classId": "MATH-1650", "requiredCredits": 4, "minGrade": "C-",
      "prereqs": [], "coreqs": [] },
    { "semester": 1, "classId": "CPRE-1850", "requiredCredits": 3,
      "prereqs": [], "coreqs": ["MATH-1650"] },
    { "semester": 1, "category": "GenEd", "requiredCredits": 3 },
    // ...
  ]
}
```

Importer normalizes on seed: ensures each `classId` exists in `courses`, validates the file's prereqs against `Course.Prereqs`, inserts `DegreeFlow` + `FlowchartSlot` rows.

### Tier 3: Student Plan (the user's xref)

```csharp
class Student { Guid Id; string DisplayName; }

class Plan {                      // table: plans
  Guid Id;
  Guid StudentId;
  Guid SelectedDegreeFlowId;      // the flow they're following
  string? PreviousSnapshotJson;   // for single-level undo
}

class PlanItem {                  // table: plan_items — the xref
  Guid Id;
  Guid PlanId;
  Guid CourseId;                  // always a real course from the registrar
  int Semester;                   // past, present, or future
  PlanItemStatus Status;          // Planned | InProgress | Completed | Failed | Withdrawn
  string? Grade;                  // populated for Completed/Failed
}

enum PlanItemStatus { Planned, InProgress, Completed, Failed, Withdrawn }
```

The `PlanItem` table holds the student's full academic record: prior semesters (`Status = Completed/Failed`), current semester (`Status = InProgress`), and future plans (`Status = Planned`).

### Why this tiering matters

- **Switching majors is just a different lens.** No data moves; only the rendered overlay changes.
- **Catalog-prereqs are canonical.** Cascade engine reads them from `Course`, never from a flow file. A flow file may include them (for self-containment) but they're validated on import.
- **A `PlanItem` doesn't know which flow slot it satisfies.** That mapping is computed fresh on render — keeps invariants simple, no stale bindings to invalidate.

## 5. Cascade Engine

Pure C# in `Services/`. No DB, no I/O, no clocks. Given `(Plan, DegreeFlow, Catalog, Trigger) → CascadeProposal`. Never persists; the controller calls the engine, then `PlanService.Apply()` does the writes.

### Inputs

```csharp
class CascadeRequest {
  Plan CurrentPlan;
  DegreeFlow ActiveFlow;
  IReadOnlyList<Course> Catalog;        // every course referenced
  CascadeTrigger Trigger;
  CascadeOptions Options;               // target/cap credits per semester
}

abstract class CascadeTrigger { }
class CourseFailed         : CascadeTrigger { Guid PlanItemId; string Grade; }
class CourseSkipped        : CascadeTrigger { Guid PlanItemId; int? RescheduledTo; }
class CourseAddedToSem     : CascadeTrigger { Guid CourseId; int Semester; }
class CourseRemovedFromSem : CascadeTrigger { Guid PlanItemId; }
class CourseSubstituted    : CascadeTrigger { Guid PlanItemId; Guid NewCourseId; }
class WhatIfMajorSwitched  : CascadeTrigger { Guid NewDegreeFlowId; }
```

### Algorithm

1. Apply the trigger event to a working copy of the plan.
2. Compute the **affected set** — walk the prereq DAG forward from the triggering course; any `PlanItem` with broken prereqs joins the set.
3. For each affected `PlanItem`, find `earliestValidSemester` — the first semester ≥ current where all prereqs are completed/scheduled-earlier and coreqs are scheduled same-or-earlier.
4. Topologically order moves so dependencies are placed before dependents.
5. Detect resulting per-semester state — emit `FillGapDecision` for under-credit semesters, `SemesterOverload` warning for over-credit semesters.
6. Return the `CascadeProposal` — never mutate persistent state.

### Outputs

```csharp
class CascadeProposal {
  Plan ProposedPlan;
  IReadOnlyList<CascadeMove> Moves;
  IReadOnlyList<DecisionPoint> Decisions;
  IReadOnlyList<Warning> Warnings;
  int ProjectedGraduationSemester;
}

class CascadeMove {
  Guid PlanItemId; string CourseCode;
  int FromSemester, ToSemester;
  string Reason;
}

abstract class DecisionPoint { Guid Id; int Semester; string Prompt; }
class FillGapDecision        : DecisionPoint {
  decimal CreditsToFill; List<SlotOption> SuggestedSlots;
}
class ChooseElectiveDecision : DecisionPoint {
  string Category; List<Course> Candidates;
}
class ConfirmOverloadDecision: DecisionPoint {
  decimal CurrentCredits; decimal SoftCap; List<MovableItem> CanDeferToLater;
}

class Warning { WarningKind Kind; string Message; List<Guid> RelatedPlanItemIds; }
enum WarningKind { SemesterOverload, GraduationPushed, GradeRequirementUnmet, NoValidSemester }

// Supporting types referenced by DecisionPoint subclasses:
class SlotOption {              // a generic flowchart-slot suggestion to fill a gap
  string Category;              // "GenEd", "TechElective", ...
  decimal Credits;
}
class MovableItem {             // a PlanItem the user could defer to alleviate overload
  Guid PlanItemId; string CourseCode; decimal Credits;
  int EarliestPossibleSemester; // engine-computed alternative placement
}
```

### Acceptance criteria (each becomes one or more cascade-engine tests)

**Skip a course:**
- **AC-1** Math 1650 skipped in Sem 1, no reschedule given → engine moves Math 1650 to next valid semester (Sem 2), pushes CprE 1850 (coreq) to Sem 2, pushes Math 1660 (prereq) to Sem 3, emits `FillGapDecision { Sem 1, ~7cr }`.
- **AC-2** Math 1650 skipped, user explicitly reschedules to Sem 3 (not 2) → all dependents push proportionally further; engine respects the user's chosen semester.
- **AC-3** A pure gen-ed slot skipped (no downstream prereqs) → emits `FillGapDecision` for that semester only; no moves elsewhere.

**Fail a course:**
- **AC-4** Math 1650 graded D (need C-) → engine flags `GradeRequirementUnmet`, schedules retake at next valid semester, cascades dependents identically to AC-1.
- **AC-5** CprE 2810 failed in Sem 3 → all CprE 28xx-dependents downstream re-plan; engine reports each move with reason.
- **AC-6** Course retaken successfully on second attempt → cascade unwinds; dependents may shift back to earlier semesters if now eligible.

**Substitute / swap:**
- **AC-7** Replace one Tech Elective with another with equivalent prereqs → no cascade moves; only the swap is recorded.
- **AC-8** Replace where new course has stricter prereqs that aren't satisfied → cascade triggered; downstream items re-evaluated.

**Add / remove:**
- **AC-9** User adds a fixed course earlier than its canonical semester (and prereqs allow it) → downstream dependent courses may shift earlier (good news case); engine reports the moves.
- **AC-10** User removes a backfill gen-ed → re-emits `FillGapDecision` for that semester.

**Overload / underload:**
- **AC-11** Cascade results in Sem 2 = 22 credits → `SemesterOverload` warning + `ConfirmOverloadDecision` listing courses that could defer.
- **AC-12** Cascade leaves Sem 1 with 6 credits (below soft minimum) → `FillGapDecision`.

**Boundary / failure cases:**
- **AC-13** Cascade pushes a course past Sem 8 → `GraduationPushed` warning, `ProjectedGraduationSemester = 9` (or appropriate).
- **AC-14** A required course's prereqs are not satisfiable in any future semester → `NoValidSemester` warning; no infinite loop.
- **AC-15** Circular prereq encountered (data error) → engine surfaces a clear error rather than spinning.

**Multi-major / overlay (forward-looking, tested now to keep the model honest):**
- **AC-16** `WhatIfMajorSwitched` to a different `DegreeFlow` → produces an overlay proposal: which `PlanItem`s map to which slots in the new flow, what's missing, what's surplus. No mutation of stored plan.
- **AC-17** Same `Plan` overlaid against two different `DegreeFlow`s → overlays computed independently, no shared state leakage.

**Validation entry point (used by every read):**
- **AC-18** `Engine.Validate(plan, flow)` returns the same set of issues that would be detected if every PlanItem were re-checked individually — exhaustive and consistent with cascade behavior.

## 6. API Surface

REST + JSON. Base path `/api/v1`. Behind JWT-stub middleware; `User.FindFirst("studentId")` is the active student.

```
GET    /api/v1/catalog/courses            → CourseDto[]
GET    /api/v1/catalog/courses/{id}       → CourseDetailDto
GET    /api/v1/catalog/courses?dept=CprE  (optional filter)

GET    /api/v1/flows                      → DegreeFlowSummaryDto[]
GET    /api/v1/flows/{id}                 → DegreeFlowDetailDto

GET    /api/v1/me                         → StudentDto
GET    /api/v1/me/plan                    → PlanDto (with PlanItems + ValidationIssues)
PUT    /api/v1/me/plan                    → PlanDto (e.g., switch SelectedDegreeFlowId)

GET    /api/v1/me/plan/items              → PlanItemDto[]
POST   /api/v1/me/plan/items              → PlanDto (with refreshed ValidationIssues)
PUT    /api/v1/me/plan/items/{id}         → PlanDto
DELETE /api/v1/me/plan/items/{id}         → 204

POST   /api/v1/cascade/preview            → CascadeProposalDto
POST   /api/v1/cascade/apply              → PlanDto (committed)
```

### Cascade preview/apply: stateless iteration

The wizard is client-orchestrated. The client carries the trigger and accumulating answers; each `/preview` call narrows the proposal until `decisions` is empty, then `/apply` commits.

```jsonc
// POST /api/v1/cascade/preview
{
  "trigger": { "type": "CourseSkipped", "planItemId": "...", "rescheduledTo": null },
  "decisionAnswers": [
    { "decisionId": "fillgap-sem1", "answer": { "kind": "UseSuggestedSlots" } }
  ]
}
```

```jsonc
// response
{
  "proposedPlan": { /* hypothetical Plan + items */ },
  "moves": [
    { "planItemId": "...", "courseCode": "CprE 1850", "from": 1, "to": 2,
      "reason": "Coreq Math 1650 moved to Sem 2" }
  ],
  "decisions": [],          // empty when ready to apply
  "warnings": [
    { "kind": "SemesterOverload", "message": "Sem 2 = 22 cr (cap 18)",
      "relatedPlanItemIds": [...] }
  ],
  "projectedGraduationSemester": 9
}
```

`/apply` accepts the same body shape, runs the engine once more for safety, persists in a transaction, and returns the new `PlanDto`. Returns 409 if server state has changed since the preview.

### Cross-cutting

- `ProblemDetails` (RFC 7807) for errors.
- `FluentValidation` for request DTOs; failures → 400 with field-level details.
- CORS allows the React dev server (`http://localhost:5173`).
- Swagger/OpenAPI at `/swagger`; future mobile client can codegen from it.

## 7. Wizard & Direct Interaction

### Mode A — direct manipulation (no wizard)

Routine actions hit raw REST endpoints. Each mutation response includes refreshed `ValidationIssues` so the UI can render badges immediately.

| User action | API call |
|---|---|
| Drag a course from catalog into a semester | `POST /me/plan/items` |
| Move a planned course between semesters | `PUT /me/plan/items/{id}` |
| Pick a specific elective for a placeholder slot | `PUT /me/plan/items/{id}` |
| Mark course InProgress / Completed (passing) | `PUT /me/plan/items/{id}` |
| Remove a course | `DELETE /me/plan/items/{id}` |

The frontend renders `ValidationIssues` from the server — **no duplicated rule logic in TypeScript**. Issues appear as red badges on affected tiles plus a "fix prereq issues" banner that opens the wizard if the user wants help.

### Mode B — wizard (cascade-triggering events)

The wizard fires only when the user takes an action that intentionally changes their reality:

| Action | Trigger sent |
|---|---|
| Mark a course **Failed** | `CourseFailed` |
| Mark a course **Withdrawn** mid-semester | `CourseRemovedFromSem` |
| Click **"Replan from this point"** | `CourseSkipped` |
| Click **"Switch major"** in the major picker | `WhatIfMajorSwitched` |
| Click **"Fix prereq issues"** banner | engine inspects current state |

### Walkthrough — Math 1650 case

1. User clicks Math 1650 tile in Sem 1 → "Couldn't take it — replan."
2. `POST /cascade/preview { trigger: CourseSkipped(Math 1650) }`
3. UI shows side-by-side current vs. proposed plan.
4. UI surfaces remaining `decisions` one at a time; user answers each.
5. After each answer, `/preview` is called again with accumulating `decisionAnswers`; eventually `decisions` is empty.
6. User reviews any final `warnings` (e.g., overload), accepts or modifies.
7. `POST /cascade/apply` commits inside a transaction; new `PlanDto` returned.
8. UI animates from current to proposed; toast confirms ("Graduation now Spring '29 — one semester later").

### Undo

Single-level undo via `Plan.PreviousSnapshotJson` — overwritten on each successful `/apply`. POC scope; multi-level history is later.

## 8. Validation (server-computed)

`Engine.Validate(plan, flow)` returns the active issues as `ValidationIssueDto[]`:

```csharp
class ValidationIssueDto {
  ValidationIssueKind Kind;     // BrokenPrereq | BrokenCoreq | GradeRequirementUnmet
                                // | SemesterOverload | InsufficientCredits
  Guid? PlanItemId;
  int Semester;
  string Message;               // "Math 1660 needs Math 1650 with C- (currently in Sem 4)"
}
```

Returned alongside every `PlanDto` (read or mutation response). Computed by reusing the same prereq evaluator the cascade engine uses — single source of truth, no duplication in TypeScript.

## 9. Testing Strategy (TDD-first)

```
                  ╱╲
                 ╱  ╲    ~5–10 E2E smoke (Playwright)
                ╱────╲
               ╱  API ╲   ~30–50 integration via WebApplicationFactory
              ╱        ╲                          + SQLite-in-memory
             ╱──────────╲
            ╱  Service   ╲ ~50–100 service tests, real repos against
           ╱   layer      ╲                       SQLite-in-memory
          ╱────────────────╲
         ╱  Cascade engine  ╲ 200+ pure unit tests; one per scenario above
        ╱  (pure C#, no DB)  ╲
       ╱──────────────────────╲
```

### Tooling

- **xUnit** + **FluentAssertions**.
- **Microsoft.EntityFrameworkCore.Sqlite** in-memory mode (`Filename=:memory:`) — preferred over the EF `InMemory` provider because real SQLite enforces FKs and constraints.
- **WebApplicationFactory** for API integration tests.
- **No mocking framework** — pure cascade tests use real C# objects; repository tests use real EF against in-memory SQLite.

### Test layout

```
tests/
├── ISUCourseManager.Services.Tests/
│   ├── Cascade/
│   │   ├── CascadeEngineTests.Skip.cs
│   │   ├── CascadeEngineTests.Fail.cs
│   │   ├── CascadeEngineTests.Substitute.cs
│   │   ├── CascadeEngineTests.AddRemove.cs
│   │   ├── CascadeEngineTests.Overload.cs
│   │   ├── CascadeEngineTests.Boundary.cs
│   │   ├── CascadeEngineTests.Overlay.cs
│   │   ├── CascadeEngineTests.Validate.cs
│   │   └── Fixtures/
│   │       └── CybEFixture.cs        builds a small in-memory CybE flow + catalog
│   ├── PlanServiceTests.cs           SqliteInMemoryRepositoryFactory
│   └── CatalogServiceTests.cs
└── ISUCourseManager.Api.Tests/
    ├── PlansControllerTests.cs       WebApplicationFactory + in-memory SQLite
    ├── CascadeControllerTests.cs
    └── TestServerFactory.cs
```

Each cascade test references its acceptance criterion in the test name: `Cascade_AC1_Math1650Skipped_PushesCprE1850AndEmitsFillGap()`.

### TDD discipline

- Every cascade scenario is implemented red-green-refactor.
- The engine grows scenario-by-scenario; we don't write speculative code.
- Frontend testing is intentionally *lighter* — integration tests on key flows (wizard happy path, plan render) but not snapshot tests on every component.

## 10. Decisions Log

Recording the journey for context in future sessions:

| # | Decision | Why |
|---|---|---|
| 1 | Web SPA + REST API | Future mobile reuses the same API |
| 2 | POC: CybE 2025-26 only, multi-major-ready data model | Keep scope tight without painting in a corner |
| 3 | Hand-curated JSON seeds (catalog + per-flow); scraper later | Fastest reliable path to working data |
| 4 | Guided wizard for cascade events; direct CRUD for routine adds | Match user's "guide as much as possible" goal without bloating routine flows |
| 5 | UI plan-view layout deferred | Decide during implementation iteration |
| 6 | React + Vite + TS / ASP.NET Core / EF Core / SQLite (POC) → SQL Server (prod) | Production architecture from day 1, scoped feature surface |
| 7 | 3 backend projects: Api / Services / Data; entities in Data/Entity | User's standard layout |
| 8 | JWT/claims auth — stubbed middleware for POC, real impl later | Defer auth complexity, keep the boundary in place |
| 9 | Three-tier domain model: Catalog (registrar) / DegreeFlow / Plan+PlanItem (xref) | Clean separation; enables overlay/major-switch |
| 10 | Prereqs canonical on `Course`; flow JSON denormalizes for self-containment | Single source of truth, human-readable files |
| 11 | Stateless `/cascade/preview` with accumulating answers | Simpler server; client orchestrates wizard |
| 12 | Direct mutations always succeed; warnings via server-computed ValidationIssues | Simple UI, no rule duplication |
| 13 | Single-level undo via plan snapshot column | Covers common case; multi-level deferred |
| 14 | TDD-first on cascade engine; numbered ACs in spec | Engine quality is the product's value |
| 15 | Frontend testing intentionally lighter than backend | Most logic is server-side |

## 11. Open items for the implementation plan

These are knowingly deferred to the writing-plans phase rather than left ambiguous in the spec:

- **UI plan-view layout** — three mockups exist (`.superpowers/brainstorm/.../plan-layout-v2.html`); decision to be made during frontend work.
- **CybE 2025-26 catalog seed contents** — extract course list, prereqs, coreqs, grade requirements from the printed flowchart + the technical-elective PDF in `Documentation/`.
- **CybE 2025-26 flow seed contents** — semester placement, slot kinds, and required credits for each cell.
- **Soft/hard credit caps per semester** — defaults to be picked (e.g., target 15, soft cap 18, hard cap 20 — confirm with the user during planning).
- **Test-data fixture builder** — design of `CybEFixture.cs` to give every cascade test a realistic baseline.
