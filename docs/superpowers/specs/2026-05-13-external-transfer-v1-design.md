# External Transfer (v1) — Design Spec

**Date:** 2026-05-13
**Status:** Approved for planning
**Author:** Kevin (with Claude)
**Companion to:**
- `docs/superpowers/specs/2026-05-12-isu-course-manager-design.md` (system spec — entities, validation, cascade)
- `docs/superpowers/specs/2026-05-13-ui-v1-design.md` (UI spec — tile primitive, action menu, panel anatomy)

## 1. Goal

Let a student record that they have been **approved** to fulfill an ISU course requirement via external transfer credit (e.g., taking Calc I at Lincoln Land Community College over the summer instead of MATH 1650 at ISU). The system tracks the external enrollment, treats it as satisfying the ISU requirement for downstream prereqs, and visually distinguishes transfer-fulfilled tiles from internal ones.

The student is the source of truth: they have already obtained approval (from an ISU advisor or by following a known equivalency). v1 is a **tracker**, not a vetter.

## 2. Scope

### In scope (v1)
- New StudentCourse fields to record external enrollments (`EnrollmentSource` + transfer metadata).
- Per-tile action menu item: **"Mark as taking externally..."**.
- A small modal/sidepanel form for entering institution + external course code + expected term + optional note.
- Tile visual: a small purple institution-code badge top-left (e.g., "LLCC", "DMACC").
- Validation behavior: a Completed external enrollment satisfies the ISU prereq exactly as a Completed internal one would.
- Lifecycle reuses existing `StudentCourseStatus` (Planned → InProgress → Completed) and `Grade` fields. For transfers, `Grade` may be a letter (when the external transcript posts one) or `"T"` / blank for pass-credit-only.

### Out of scope (deferred — phase 2)
- AI-driven recommendations / discovery of external candidates.
- Curated `TransferEquivalency` catalog seeded from ISU's Transfer Equivalency Guide.
- Ranked recommendations panel with reviews / cost / format / ease ratings.
- Credit-application lifecycle (Awaiting → Applied → Denied) — v1 trusts that approval was already granted and doesn't track the registrar's processing state.
- Pre-approval workflow / advisor sign-off in-app.
- Importing transfer credits from a transcript file.

These are explicitly named so the placeholder "Explore transfer options" button in the cascade-recovery suggested-fix card (system spec mockup *State 2 — pending grade fails*) has a known landing place.

## 3. Data model — `StudentCourse` extension

Add to the existing `StudentCourse` entity (system spec §4 Tier 3) the following fields. All are nullable except `EnrollmentSource`, which has a default.

| Field | Type | Notes |
|---|---|---|
| `EnrollmentSource` | enum `EnrollmentSource` | Required. Default `Internal`. Values: `Internal`, `External`. Discriminator. |
| `TransferInstitution` | `string?` | Required when `EnrollmentSource = External`. Free text. e.g., `"Lincoln Land Community College"`. |
| `TransferExternalCourseCode` | `string?` | Required when `EnrollmentSource = External`. Free text. e.g., `"MATH 113"`. |
| `TransferNote` | `string?` | Optional. Free text. e.g., `"advisor approved 2026-04-30; transcript expected mid-August"`. |

`CourseId` continues to reference the ISU equivalent (`Course.ClassId`, e.g., `"MATH-1650"`) regardless of `EnrollmentSource`. This keeps validation, cascade, and DegreeFlow overlay queries uniform — they don't have to special-case transfers.

### Why this shape
- **Single-table simplicity.** No new entity, no joins. Transfer metadata travels with the enrollment row.
- **Uniform validation.** Prereq evaluation can ignore `EnrollmentSource` entirely — it only cares about `Status` and `Grade`.
- **Honest about reality.** A transfer enrollment isn't pretending to be an internal one — the source field and badge make the distinction visible to the user.
- **Migration-safe.** All new fields are additive: existing internal enrollments default to `EnrollmentSource = Internal` and leave the transfer fields null.

### EnrollmentSource enum

```csharp
public enum EnrollmentSource
{
    Internal = 1,  // taken at ISU (default)
    External = 2,  // taken at an external institution, transferred back
}
```

JSON wire form: PascalCase string, per UI spec wire conventions (`"Internal"`, `"External"`).

## 4. Validation behavior

A `StudentCourse` with `EnrollmentSource = External` is treated **identically** to one with `EnrollmentSource = Internal` for the purposes of:
- Prereq satisfaction (a Completed external enrollment with grade ≥ requirement satisfies prereqs that reference its `CourseId`).
- DegreeFlow slot fulfillment (an external enrollment fulfills the `FlowchartSlot` whose `CourseId` it references, same as internal).
- Credit counting toward degree progress.
- Cascade triggers (skipping/failing/withdrawing an external enrollment cascades like an internal one).

**No new ValidationIssueKind is introduced for transfers in v1.** The system trusts that the student's recorded transfer reflects a valid approval. (Phase 2 may add an `UnapprovedTransfer` warning when paired with the curated catalog.)

## 5. UI — action menu addition

The per-tile action menu (UI spec §11 — direct-manipulation interactions) gains a new item between the existing schedule-management items and the AI item:

```
[📅 Move to another semester...]
[🔄 Substitute course...]
[✕ Remove from plan]
─────────────────────────────────
[🎓 Mark as taking externally...]   ← NEW (purple text — transfer family color)
─────────────────────────────────
[✦ Ask AI about this course]
```

- **Availability:** present on every tile regardless of `Status` (Planned, InProgress, Completed). For Completed internal enrollments, selecting it re-tags the existing enrollment as External and opens the form pre-filled with current Status/Grade where applicable. (Edge case — keep simple; if more nuance needed, defer.)
- **Color:** purple (`#6a1b9a`) — distinct from the navy/gold/AI-purple-gradient family. Signals the "transfer family" of features.
- **Keyboard:** Enter activates; same Tab/Esc behavior as other menu items.

## 6. UI — "Mark as taking externally" form

Modal (desktop) or bottom-sheet (mobile). Purple-themed border to telegraph transfer-family.

### Fields (top to bottom)

1. **Fulfilling ISU course** (read-only context row): course code + name + credits + canonical Sem badge. Confirms what's being fulfilled.
2. **External institution \*** — text input. Free text. e.g., `"Lincoln Land Community College"`.
3. **External course code \*** — text input. Free text. e.g., `"MATH 113"`.
4. **Expected term \*** — dropdown. Options: each future term known to the system + an `"Already completed"` option that exposes a grade field + completion-term picker.
5. **Note** (optional) — multi-line text, ~2 rows. e.g., `"advisor approved 2026-04-30"`.

### Submit behavior

- **Save** on a Planned tile: writes the new fields to the existing `StudentCourse` row. `Status` stays Planned. Tile re-renders with the institution badge.
- **Save** on a Completed internal tile: re-tags the row as External, populates transfer fields. Status/Grade unchanged. Tile re-renders.
- **Save** on the "Already completed" path: also writes Status=Completed and the entered Grade.
- **Cancel:** dismiss form, no changes.

### Footnote

The form includes a small footer line: `"✦ Future: ranked recommendations from a curated transfer catalog + AI-discovered alternatives. v1 records what you've been approved for."` — sets expectations and points to the deferred phase-2 capabilities.

## 7. UI — tile visual

A `StudentCourse` with `EnrollmentSource = External` renders with one addition to the standard tile:

- **Institution-code badge** in the top-left corner: small (8px font, 1px×6px padding), purple background (`#6a1b9a`), white text, rounded pill. Shows a short code derived from `TransferInstitution` — typically the institution's common abbreviation. v1 derives this client-side via a small lookup map (`"Lincoln Land Community College"` → `"LLCC"`); when no mapping exists, falls back to the first 4–5 chars uppercased.

All other tile rules (color by Status, grade rendering, canonical-Sem badge bottom-center, prereq/co-req cascade flags) are inherited from the UI spec unchanged.

```
┌───────────────────┐
│ [LLCC]            │  ← purple ext-badge, top-left
│   MATH 1650       │
│   B · 4cr         │
│   [canonical Sem 1]  ← existing blue badge, bottom-center
└───────────────────┘
```

## 8. API surface

No new endpoints. The existing `StudentCourse` create/update endpoints (system spec §6) accept the new fields in their request DTOs. Plan-read responses include the new fields in the StudentCourse DTO.

Request DTO additions (camelCase JSON):
- `enrollmentSource`: `"Internal"` | `"External"` (default `"Internal"` if omitted)
- `transferInstitution`: string | null
- `transferExternalCourseCode`: string | null
- `transferNote`: string | null

Server-side validation:
- If `enrollmentSource = "External"`: `transferInstitution` and `transferExternalCourseCode` are both required (400 if missing).
- If `enrollmentSource = "Internal"`: transfer fields must be null (400 if any populated).

## 9. Acceptance criteria

- **AC-XT-1** Persisting a `StudentCourse` with `EnrollmentSource = External` and the required transfer fields succeeds; reading it back returns all fields intact.
- **AC-XT-2** Saving a `StudentCourse` with `EnrollmentSource = External` and missing `TransferInstitution` returns 400.
- **AC-XT-3** A Completed external enrollment satisfies a downstream prereq exactly like a Completed internal enrollment with the same grade.
- **AC-XT-4** A Planned external enrollment is treated as a future enrollment for cascade/scheduling purposes (counts toward earliestValidSemester satisfaction the same as internal Planned).
- **AC-XT-5** The action menu shows "Mark as taking externally" on every course tile regardless of Status.
- **AC-XT-6** The form requires institution and external course code; submission with either blank is blocked client-side.
- **AC-XT-7** Saving the form on a Planned internal tile re-tags it as External; the tile re-renders with an institution badge top-left.
- **AC-XT-8** The institution-badge text is derived from a client-side lookup map for known institutions (LLCC, DMACC, KCC, etc.) and falls back to a 4–5 char abbreviation otherwise.
- **AC-XT-9** All transfer fields are excluded (null/empty) from internal-source enrollments; the API rejects requests that violate this.

## 10. Phase-2 forward-compatibility notes

The v1 schema is forward-compatible with the deferred phase-2 capabilities:
- A `TransferEquivalencyId` FK can be added later without breaking v1 records (nullable).
- A `TransferCreditStatus` enum (Awaiting / Applied / Denied) can be added later as nullable; v1 records will default to null (interpreted as "trust the student's claim").
- The "Mark as taking externally" form can be progressively enhanced to surface curated equivalencies + AI recommendations above the manual-entry fields without changing the data model.

## 11. Decisions log

| # | Decision | Rationale |
|---|---|---|
| XT-1 | Single-table extension on StudentCourse (not a sibling entity) | Simpler queries, fits existing flat schema; transfer metadata travels with the enrollment. |
| XT-2 | CourseId still references the ISU equivalent (not the external course) | Validation/cascade work uniformly without `EnrollmentSource` checks. |
| XT-3 | No TransferEquivalency catalog in v1 | Defer to phase 2. v1 trusts the student's approval. |
| XT-4 | No AI involvement in v1 | Defer to phase 2. v1 is a recording tool, not a discovery tool. |
| XT-5 | Reuse existing StudentCourseStatus enum (no new transfer-specific states) | Lifecycle is the same shape; transfer subtleties handled by metadata fields, not status values. |
| XT-6 | No new ValidationIssueKind for transfers in v1 | Trust the approval; warning kinds added in phase 2 alongside the curated catalog. |
| XT-7 | Institution badge derived client-side from a small lookup map | No new server data needed; map can grow as more institutions appear. |
| XT-8 | Form footer explicitly names phase-2 capabilities | Sets expectations and gives the State-2 cascade-fix mockup a known landing place for "Explore transfer options". |
