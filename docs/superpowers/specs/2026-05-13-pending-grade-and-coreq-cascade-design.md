# Pending-Grade Semantics & Co-req Cascade — Design Spec

**Date:** 2026-05-13
**Status:** Approved for planning
**Author:** Kevin (with Claude)
**Companion to:**
- `docs/superpowers/specs/2026-05-12-isu-course-manager-design.md` (system spec — entities, validation, cascade)
- `docs/superpowers/specs/2026-05-13-ui-v1-design.md` (UI spec — tile primitive, banner, panel anatomy)

## 1. Goal

Two related additions, both surfaced by Luke's actual current state (Spring 2026 grades partially posted, Fall 2026 planned):

1. **Pending-grade state.** A course can be `Status = Completed` with `Grade = null` — finished but the registrar hasn't posted the grade yet. The system must:
   - persist this state without contortion
   - keep validation **optimistic** for downstream prereqs (don't block planning while awaiting a grade)
   - tell the student which planned courses are at risk if the grade lands below the requirement
   - re-evaluate cleanly when the grade posts

2. **Co-req transitive cascade.** When a course becomes invalid, every Planned course that has it as a hard co-req (catalog `acceptConcurrent: true` pairing) should also be flagged. Example: if PHYS 2310 is invalidated, PHYS 2310L (its lab co-req in the same term) is invalidated transitively.

Both interact at the same scenario: MATH 1650 grade pending → if it ultimately fails, MATH 1660 + PHYS 2310 break (direct prereq), and PHYS 2310L breaks via its co-req with PHYS 2310.

## 2. Scope

### In scope
- `StudentCourse` semantics: `Status = Completed, Grade = null` is a recognized state ("grade pending"). No new status enum value.
- New `ValidationIssueKind`: `PendingGradeDependency` (Severity = Warning).
- New tile visual state: a Completed course whose grade has fallen below a downstream prereq's minimum requirement renders distinctly from green Completed and from red Failed/Invalid.
- Cascade engine: transitive co-req invalidation (algorithm step 2a, see §5).
- Right-panel grouping: when multiple validation issues share a single root cause, the panel breadcrumbs them as "Issue X of N · root cause: [course]" and the suggested-fix card addresses the whole sibling group.
- Banner aggregation: warnings (pending grades) reported separately from errors (broken prereqs).

### Out of scope
- Soft `RecommendedPairing` cascade — pairings are advisory only and don't transitively invalidate. (Distinct from hard co-reqs.)
- Re-validating on a real-time grade-posting webhook from ISU. v1 re-validates on the next plan read or mutation; webhook ingestion is a future infra concern.
- A separate `GradePending` status enum value — using `Completed + Grade=null` keeps the lifecycle field clean.
- AI-driven prediction of grade likelihood — the system reports the dependency, not a forecast.

## 3. Pending-grade state

### 3.1 Semantics

| `Status` | `Grade` | Meaning |
|---|---|---|
| `Planned` | `null` | Future enrollment. Existing behavior. |
| `InProgress` | `null` | Currently enrolled. Existing behavior. |
| `Completed` | `"A"` … `"F"` (or `"T"`/`"S"`) | Course finished, grade posted. Existing behavior. |
| **`Completed`** | **`null` or `""`** | **Course finished, grade pending. NEW.** |
| `Failed` | `"F"` | Course failed (distinct from grade-below-requirement). Existing. |
| `Withdrawn` | `null` | Existing. |

The pending-grade state is the natural interpretation of nullable `Grade` on a `Completed` row. No schema change required; the spec change is purely behavioral.

### 3.2 Validation behavior — optimistic

For prereq evaluation, a `Completed` course with `Grade = null`:
- **Provisionally satisfies** any prereq that references its `CourseId`, regardless of the prereq's minimum-grade requirement (since the grade is unknown — assume it will meet).
- **Triggers** a `PendingGradeDependency` validation issue (Warning) on every Planned course that depends on it through a min-grade prereq edge.
- **Does not** trigger any issue when the dependent course's prereq has no min-grade requirement (no risk to surface).

This is the **optimistic** posture. Rationale: the student needs to plan future semesters now; blocking planning until grades post would freeze the tool exactly when it's most needed. The warning surfaces the risk without preventing forward motion.

### 3.3 When the grade later posts

Re-validation on the next plan read or any mutation:
- If posted grade ≥ requirement: `PendingGradeDependency` warnings clear.
- If posted grade < requirement: dependent issues escalate from `PendingGradeDependency` (Warning) to `GradeRequirementUnmet` (Error). The completed course's tile additionally enters the **completed-below-requirement** visual state (see §6).

No new event/trigger is needed; the standard re-validation pass handles both transitions.

### 3.4 New `ValidationIssueKind`

Add to the enum in system spec §8:

```csharp
PendingGradeDependency  // Severity = Warning
```

`ValidationIssueDto` for this kind populates:
- `kind = "PendingGradeDependency"`
- `severity = "Warning"`
- `subjectCourseId` = the Planned course at risk (the dependent)
- `relatedCourseId` = the Completed-pending course (the prereq with null grade)
- `message` = e.g., `"Depends on MATH 1650 — grade pending."`

## 4. Co-req transitive cascade

### 4.1 Background

The catalog already encodes hard co-reqs as a prereq node with `acceptConcurrent: true` (system spec §4 catalog model). Example: PHYS 2310 lists MATH 1650 with `acceptConcurrent: true` (a co-req that may be taken concurrently). The PHYS 2310/PHYS 2310L lecture/lab pairing is also a hard co-req: each references the other with `acceptConcurrent: true`, and they must be in the same term.

The existing cascade engine evaluates prereqs (including `acceptConcurrent` ones) when a course is moved or graded, but does not currently propagate invalidation **across co-req edges in the same term**.

### 4.2 New algorithm step (system spec §5)

Insert between current Step 2 (forward prereq walk) and Step 3 (issue computation):

> **Step 2a — Co-req transitive flagging.**
> For each course flagged invalid in Steps 1–2:
> - Look up its **same-term hard co-reqs** (other Planned courses in the same `AcademicTerm` that reference this course with `acceptConcurrent: true`, OR that are referenced by this course with `acceptConcurrent: true`).
> - Add them to the affected set.
> - Repeat until the affected set stabilizes (fixed-point — handles A↔B mutual co-reqs without infinite loop).

This makes PHYS 2310L automatically follow PHYS 2310 when PHYS 2310 breaks.

### 4.3 No new `ValidationIssueKind`

Reuse the existing `BrokenCoreq` kind. The `ValidationIssueDto` distinguishes the transitive case via:
- `relatedCourseId` = the co-req partner that broke
- `message` = e.g., `"Co-req PHYS 2310 is invalid (broken prereq on MATH 1650)."`

### 4.4 Soft `RecommendedPairing` is unaffected

Soft pairings (system spec §4 — recommendations, not requirements) **never** transitively invalidate. They surface as `RecommendedPairingBroken` warnings on the partner, but the partner remains valid for scheduling. Step 2a applies only to hard co-reqs (`acceptConcurrent: true`).

## 5. Right-panel grouping — "Issue X of N · root cause"

When the action menu opens on a Planned tile flagged with one or more validation issues, the right panel renders the issue header. If the issue has **sibling issues** (other affected courses sharing the same root-cause `relatedCourseId`), the breadcrumb format becomes:

```
⚠ Issue 1 of 3 · root cause: MATH 1650 grade · view all
```

- "Issue 1 of N" — the index in the sibling group + total count.
- "root cause: [course code + condition]" — the underlying course/state that caused the cascade.
- "view all" — clicking switches the panel to a sibling-group summary view (a list of the N affected courses with mini-tile previews).

### Sibling-group inference

The grouping is derived server-side: issues whose `relatedCourseId` matches and whose `kind` is in the same root-cause family (`GradeRequirementUnmet`, `PendingGradeDependency`, transitively-flagged `BrokenCoreq` whose own root upstream is the same `relatedCourseId`) are siblings.

### Suggested-fix card addresses the chain

When sibling issues exist, suggested-fix cards (system spec §5 cascade engine output) propose **chain-level** moves rather than single-tile fixes. Example for the MATH 1650 → {MATH 1660, PHYS 2310, PHYS 2310L} case:

```
★ Retake MATH 1650 in Sem 3 + defer MATH 1660, PHYS 2310, PHYS 2310L to Sem 4
```

Single-tile fixes (e.g., "Remove MATH 1660 only") remain available as alternatives.

## 6. UI — tile visuals

### 6.1 New: pending-grade Completed tile

A `Completed` course with `Grade = null`:
- Background: `#f1f8e9` (slightly desaturated green vs. the standard `#e8f5e9`).
- Border: `#aed581`, **dashed** (visually softer than the solid green `#66bb6a`).
- Subtitle: shows `"grade pending"` in italic, where the letter grade would be.
- Corner badge: small ⏳ icon, top-right, on amber `#ffb300`.
- Otherwise inherits all standard Completed tile rules.

### 6.2 New: completed-below-requirement tile

A `Completed` course whose posted grade is below a downstream prereq's minimum:
- Background: `#fce4ec` (light pink — clearly distinct from the `#e8f5e9` green of standard Completed).
- Border: `#ad1457`, solid, 1.5px (deeper magenta — distinct from the pure red `#c62828` used for `.failed` / `.invalid` Planned, to avoid suggesting the course itself failed).
- Subtitle grade text in `#b71c1c`.
- Top-right pill: `"below req"`, white text on `#c62828` background.
- The course is still semantically Completed; this is a UI overlay surfaced because at least one downstream `GradeRequirementUnmet` issue exists.

This state is **derived**, not stored — it's emitted by the UI when validation reports any `GradeRequirementUnmet` issue with `relatedCourseId` matching the tile.

### 6.3 New: pending-prereq Planned tile

A `Planned` course with at least one `PendingGradeDependency` warning:
- Existing tile color preserved (dashed amber `Planned` look).
- Adds a yellow ring: `box-shadow: 0 0 0 2px #ffd54f`.
- Adds a label above the tile: `"depends on pending grade"` in `#5a4500` on `#fff8e1` background, bordered `#ffd54f`.
- Distinct from `.cascade-affected` (drag-preview yellow) by using a **dashed** ring vs. the existing solid yellow ring on `.cascade-affected`. Both can coexist on the same tile if needed.

### 6.4 New: co-req-pending-prereq Planned tile

A `Planned` course whose hard co-req has a `PendingGradeDependency`:
- Same yellow-ring + label as 6.3, but the label text is `"co-req depends on pending grade"`.
- Surfaces the indirect risk so the student understands why a course they didn't directly enroll alongside MATH 1650 is at warning.

### 6.5 New: co-req-broken Planned tile

A `Planned` course flagged invalid via the Step 2a co-req cascade:
- Inherits the existing `.invalid` styling (red ring + `!` corner badge).
- Adds a label above: `"co-req broken"` in `#c62828` on `#ffebee` background, bordered `#ef9a9a`.
- Distinguishes the "I'm broken because my co-req partner broke" case from the "my own prereqs broke" case.

### 6.6 Color summary additions

Append to UI spec §4 palette:

| Use | Color | Hex |
|---|---|---|
| Pending-grade tile bg | desaturated green | `#f1f8e9` |
| Pending-grade tile border | softer green | `#aed581` |
| Completed-below-req tile bg | light pink | `#fce4ec` |
| Completed-below-req tile border | deep magenta | `#ad1457` |
| Pending-dep yellow ring | warning amber | `#ffd54f` |
| Pending-dep label bg | warning amber tint | `#fff8e1` |

## 7. Banner aggregation

The validation banner (UI spec §9) currently shows a single error count when issues exist. Update to count Errors and Warnings separately and prioritize Errors:

- **No issues:** banner hidden (existing behavior).
- **Warnings only (pending grades, etc.):** yellow banner, format `"⏳ N grade(s) pending — M future course(s) depend on them"`. Counts include direct + transitive co-req-dep dependents.
- **Errors present (broken prereqs, broken co-reqs, grade-req-unmet):** red banner, format `"! N prereq issue(s) from posted grade(s)"`. Counts include direct + transitive co-req-cascade dependents. Warnings (if any) suppressed in the banner — they're still visible on tiles.

## 8. API surface

No new endpoints. The existing plan-read endpoint (system spec §6) returns the new validation kinds in its `ValidationIssueDto[]` payload. Front-end consumes them.

`OverlayDto` (or the equivalent plan-read response) MAY include an aggregate counts block for banner rendering:

```json
{
  "validationCounts": {
    "errors": 3,
    "warnings": 1,
    "pendingGrades": 1
  }
}
```

This is an optimization — the front-end can derive the same counts from the issue list. Adding the block keeps banner rendering O(1).

## 9. Acceptance criteria

- **AC-PG-1** A `StudentCourse` with `Status = Completed, Grade = null` persists and reads back without coercion.
- **AC-PG-2** A Planned course whose prereq is `Completed + Grade = null` AND whose prereq edge has a min-grade requirement emits a `PendingGradeDependency` warning (not an error).
- **AC-PG-3** A Planned course whose prereq is `Completed + Grade = null` AND whose prereq edge has no min-grade requirement emits no issue (no risk to surface).
- **AC-PG-4** Posting a grade on a previously-pending course re-runs validation; if grade ≥ requirement, the warning clears; if grade < requirement, a `GradeRequirementUnmet` error replaces the warning.
- **AC-PG-5** A Completed course with grade < downstream-prereq min renders with the completed-below-requirement tile state (pink-magenta) and a "below req" badge.
- **AC-CR-1** When a Planned course is flagged invalid (any reason), all Planned courses in the same `AcademicTerm` that share a hard co-req edge with it are also flagged via the existing `BrokenCoreq` kind (with `relatedCourseId` pointing to the partner).
- **AC-CR-2** Co-req cascade is fixed-point: A↔B mutual co-reqs both flagged when either becomes invalid, with no infinite loop.
- **AC-CR-3** Soft `RecommendedPairing` partners are never invalidated transitively.
- **AC-RP-1** When the action menu opens on a tile with N>1 sibling issues sharing a `relatedCourseId`, the breadcrumb shows `"Issue 1 of N · root cause: [course]"` with a `view all` link.
- **AC-RP-2** Suggested-fix cards on a sibling-issue group propose chain-level moves (touching all affected dependents) as the recommended option; single-tile fixes remain selectable.
- **AC-BN-1** Banner shows yellow warning style (and warning text) when only `PendingGradeDependency` issues exist; switches to red error style when any Error-severity issue is present.

## 10. Implementation notes

- The pending-grade behavior is purely a property of the validation/prereq evaluator. No DB migration needed beyond the existing nullable `Grade` column.
- The co-req Step 2a addition lives in the `CascadeEngine`. Add unit tests for the fixed-point convergence (worst case: a chain of N mutually co-req'd courses all break together).
- The right-panel sibling-group view (§5 "view all") is a new sub-component of the right panel. Render server-grouped issues; no client-side grouping logic needed.
- The banner aggregation keeps Errors-suppress-Warnings behavior; reconsider if real users want both shown (e.g., "3 errors, 1 pending grade").

## 11. Decisions log

| # | Decision | Rationale |
|---|---|---|
| PG-1 | `Completed + Grade=null` means "grade pending" — no new status enum value | Simpler lifecycle; the field meanings are independent. |
| PG-2 | Optimistic prereq satisfaction for pending grades | Don't freeze planning while awaiting registrar; surface risk via warning. |
| PG-3 | New `PendingGradeDependency` kind at Severity=Warning | Makes the dependency machine-readable; warning vs. error matches the optimistic posture. |
| PG-4 | Completed-below-requirement is a UI-only derived state, not stored | The underlying entity is still Completed; the UI overlay is computed from validation output. |
| PG-5 | Magenta `#ad1457` (not pure red) for the completed-below-req border | Avoids visual confusion with `.failed` Planned tiles, which use `#c62828`. |
| CR-1 | Hard co-reqs cascade transitively (Step 2a); soft pairings don't | Hard co-reqs are scheduling requirements (lab + lecture); soft pairings are advice. |
| CR-2 | Reuse existing `BrokenCoreq` kind for transitive cascade | Adding a `BrokenCoReqViaCascade` kind would split a single concept; the transitive case is identifiable by `relatedCourseId`. |
| CR-3 | Fixed-point iteration in Step 2a | Handles mutual co-reqs (A↔B both reference each other) without infinite recursion. |
| RP-1 | Server groups sibling issues by `relatedCourseId` | Front-end stays presentation-only; consistent grouping across UI clients. |
| RP-2 | Recommended fix on a sibling group is chain-level by default | Mirrors the user's mental model — they want one move that resolves the chain. |
| BN-1 | Errors suppress Warnings in the banner | Avoids noisy dual-line banner; warnings remain visible on tiles. |
