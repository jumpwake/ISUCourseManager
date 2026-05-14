# Seed File Templates

This folder contains the **schemas and example seed files** that the importer will eat. Use them as a reference while transcribing the printed CybE 2025-26 flowchart and the technical-elective PDF into machine-readable form.

The two files the system needs:

- **`isu-catalog.json`** — the universal class registrar. One entry per ISU course we care about. Same data regardless of major.
- **`flow-cybe-2025-26.json`** — one DegreeFlow: which courses go in which semester, plus credits/grade requirements, for the CybE 2025-26 path.

The example files in this folder (`*.example.json`) are valid starting points you can copy and extend.

---

## Naming conventions

- **`classId`** — uppercase department + dash + number. `MATH-1650`, `CPRE-1850`, `COMS-2270`. Stable across catalog years; used for cross-references inside prereq trees and from flow files.
- **`code`** (display string) — keep the original spacing as it appears on the chart: `"Math 1650"`, `"Com S 2270"`, `"CprE 1850"`. This is what the UI shows.
- **`slotType`** values — fixed enum vocabulary. Use one of: `DegreeClass` (specific required course; pair with `classId`), `ElectiveGenEd`, `ElectiveMath`, `ElectiveTech`, `ElectiveCybE`, `ElectiveCprE`. Adding a new elective category is a code change (new enum value), not a free-text string.

## Things to double-check while transcribing

- **Grade requirements come in two flavors.** On a slot, `minGrade` is what you must *earn* in that course (e.g., the chart annotates CprE 1850 with "C- or better"). On a prereq tree node, `minGrade` is what you must have *earned previously* coming in. Easy to mix up.
- **`Engr 1010 (R cr)`** — the chart shows "R cr" for registration, no credit. Model as `credits: 0` in the catalog (with `creditNote: "R cr"`). The slot itself does NOT carry `requiredCredits` for `DegreeClass` slots (it's read from `Course.Credits`), so this is purely a catalog-level setting.
- **Coreqs vs prereqs.** Per the chart legend: solid red = co-req, dashed red = pre-req. CprE 1850's relationship with Math 1650 is a coreq.
- **OR-prereqs from the elective PDF.** Many tech electives have alternatives like "CprE 308 or ComS 252 or 352" — those are `Or` nodes in the prereq tree.

---

## `isu-catalog.json` — schema

```jsonc
{
  "courses": [
    {
      "classId": "MATH-1650",          // stable, hyphenated
      "code": "Math 1650",             // display string
      "name": "Calc I",
      "credits": 4,                    // 0 for "R" credits
      "department": "Math",            // "Math", "CprE", "ComS", "Engl", ...
      "prereqs": null,                 // null OR a PrereqExpression tree
      "coreqs": null,                  // same shape as prereqs
      "isActive": true
    }
  ]
}
```

### PrereqExpression tree shapes

Trees nest arbitrarily deep. Use `null` if the course has no prereqs.

| Shape | JSON |
|---|---|
| Single course | `{ "type": "Course", "classId": "MATH-1650" }` |
| With grade gate | `{ "type": "Course", "classId": "MATH-1650", "minGrade": "C-" }` |
| Concurrent enrollment OK | `{ "type": "Course", "classId": "MATH-2010", "acceptConcurrent": true }` |
| AND (all required) | `{ "type": "And", "children": [ ... ] }` |
| OR (any one required) | `{ "type": "Or", "children": [ ... ] }` |
| None | `null` |

### Realistic catalog examples

```jsonc
// Plain course, no prereqs
{
  "classId": "MATH-1650",
  "code": "Math 1650",
  "name": "Calc I",
  "credits": 4,
  "department": "Math",
  "prereqs": null,
  "coreqs": null,
  "isActive": true
}

// Course with a coreq
{
  "classId": "CPRE-1850",
  "code": "CprE 1850",
  "name": "CprE Prob Solv",
  "credits": 3,
  "department": "CprE",
  "prereqs": null,
  "coreqs": { "type": "Course", "classId": "MATH-1650" },
  "isActive": true
}

// Course with a grade-gated prereq
{
  "classId": "MATH-1660",
  "code": "Math 1660",
  "name": "Calc II",
  "credits": 4,
  "department": "Math",
  "prereqs": { "type": "Course", "classId": "MATH-1650", "minGrade": "C-" },
  "coreqs": null,
  "isActive": true
}

// Course with an OR-prereq (from the elective PDF)
{
  "classId": "CPRE-4300",
  "code": "CprE 430",
  "name": "Network Protocols and Security",
  "credits": 3,
  "department": "CprE",
  "prereqs": {
    "type": "Or",
    "children": [
      { "type": "Course", "classId": "CPRE-3080" },
      { "type": "Course", "classId": "COMS-2520" },
      { "type": "Course", "classId": "COMS-3520" }
    ]
  },
  "coreqs": null,
  "isActive": true
}

// Course with concurrent-enrollment allowance
{
  "classId": "MATH-3170",
  "code": "Math 317",
  "name": "Theory of Linear Algebra",
  "credits": 4,
  "department": "Math",
  "prereqs": { "type": "Course", "classId": "MATH-2010", "acceptConcurrent": true },
  "isActive": true
}

// Engr 1010 — "R cr" (registration only, no credit)
{
  "classId": "ENGR-1010",
  "code": "Engr 1010",
  "name": "Engineering Orientation",
  "credits": 0,
  "department": "Engr",
  "prereqs": null,
  "coreqs": null,
  "isActive": true
}
```

---

## `flow-cybe-2025-26.json` — schema

```jsonc
{
  "code": "CYBE",
  "name": "Cyber Security Engineering",
  "catalogYear": "2025-26",
  "totalCreditsRequired": 125,
  "notes": [
    "This flowchart is only a guide. ..."
  ],
  "slots": [
    {
      "semester": 1,                   // 1..8
      "slotType": "DegreeClass",       // see "Slot types" below
      "classId": "MATH-1650",          // required when slotType = DegreeClass
      "name": "Calc I",                // chart's short name (for UI tiles)
      // requiredCredits is OMITTED for DegreeClass slots — pulled from Course.Credits
      "creditNote": null,              // "R cr", "3/4cr" — chart-specific display nuance
      "minGrade": "C-",                // grade required to earn in this slot, or null
      "classNote": null,               // "Soph Class", "Junior Class", "29 Core Cr" annotations
      "displayOrder": 1,               // position within the row, for layout
      "recommendedPairing": ["MATH-1650"]  // optional: chart's red-solid lines
                                       // (curriculum's "take together" hint, not enforced)
    }
  ]
}
```

**Slot types:**
- `"DegreeClass"` — a specific required course. Set `classId`. Do NOT set `requiredCredits` (it comes from `Course.Credits`).
- `"ElectiveGenEd"` / `"ElectiveMath"` / `"ElectiveTech"` / `"ElectiveCybE"` / `"ElectiveCprE"` — placeholder slots the user fills with a course of their choice from that category. Set `requiredCredits` to declare the credit budget the user must satisfy. Do NOT set `classId`.

**No `prereqs` or `coreqs` on slots** — those are universal facts about a course, so they live in the catalog (`Course.Prereqs`). Hard coreqs from the catalog are encoded as `acceptConcurrent: true` flags within prereq trees (ISU's "credit or concurrent enrollment in X" phrasing).

**`recommendedPairing`** captures the chart's **red-solid lines** — courses the curriculum recommends taking together (e.g., CprE 1850 + Math 1650). These are *soft hints*: the catalog allows you to take CprE 1850 without Math 1650 (placement satisfies the prereq), but the flow recommends pairing them. The cascade engine treats a broken pairing as a warning, not a blocker — offering to keep the pair together when one moves.

### Realistic flow examples

```jsonc
// DegreeClass slot in Sem 1 (required class — credits come from Course.Credits)
{
  "semester": 1,
  "slotType": "DegreeClass",
  "classId": "MATH-1650",
  "name": "Calc I",
  "minGrade": "C-",
  "displayOrder": 1
}

// DegreeClass with chart-recommended pairing
{
  "semester": 1,
  "slotType": "DegreeClass",
  "classId": "CPRE-1850",
  "name": "CprE Prob Solv",
  "displayOrder": 3,
  "recommendedPairing": ["MATH-1650"]   // chart's red-solid line; soft hint
}

// Engr 1010 — registration only (R cr lives on Course; slot just references it)
{
  "semester": 1,
  "slotType": "DegreeClass",
  "classId": "ENGR-1010",
  "name": "Orientation",
  "creditNote": "R cr",
  "displayOrder": 2
}

// Gen-Ed elective placeholder — "Gen Ed Elective 3cr" from the chart
{
  "semester": 1,
  "slotType": "ElectiveGenEd",
  "requiredCredits": 3,                 // user fills this slot with any 3-cr GenEd
  "displayOrder": 5
}

// Tech elective placeholder in Sem 7
{
  "semester": 7,
  "slotType": "ElectiveTech",
  "requiredCredits": 3,
  "displayOrder": 4
}
```

---

## Validation the importer will run

When the importer loads these files (described in design spec §10 open items), it will:

1. Ensure every `classId` referenced from a flow exists in the catalog.
2. Verify that every prereq tree's leaf `classId` references a course that exists in the catalog.
3. Verify every `recommendedPairing` entry references a course that exists in the catalog and is also referenced by another slot in the same flow.
4. Reject duplicate `classId` entries in the catalog.
5. Reject duplicate `(semester, displayOrder)` pairs within a single flow.
6. Compute the flow's total credits as `sum(Course.Credits for DegreeClass slots) + sum(slot.requiredCredits for Elective* slots)` and warn if it doesn't match `totalCreditsRequired`.
7. Verify every `Elective*` slot has `requiredCredits` set (non-null). Verify every `DegreeClass` slot has `classId` set (non-null). Reject violations.

If you want to test data partway through, you can submit a partial catalog + partial flow — the importer will tell you what's missing.

---

## Where these files end up

When the backend project structure is scaffolded (per design spec §3), these will be moved/copied into:

```
src/ISUCourseManager.Data/Seed/
├── isu-catalog.json
├── flow-cybe-2025-26.json
└── JsonSeedLoader.cs
```

For now, drafting them lives in `Documentation/seed-templates/` so they're easy to find and edit.
