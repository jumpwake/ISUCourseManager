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
- **`category`** values for `CategoryChoice` slots — pick from a small fixed vocabulary so the wizard knows how to suggest fillers. Suggested set: `GenEd`, `MathElective`, `TechElective`, `CybEElective`, `CprEElective`. Add more if the chart calls for it (e.g., `Engl`, `Physics`).

## Things to double-check while transcribing

- **Grade requirements come in two flavors.** On a slot, `minGrade` is what you must *earn* in that course (e.g., the chart annotates CprE 1850 with "C- or better"). On a prereq tree node, `minGrade` is what you must have *earned previously* coming in. Easy to mix up.
- **`Engr 1010 (R cr)`** — the chart shows "R cr" for registration, no credit. Model as `credits: 0` in the catalog and `requiredCredits: 0` on the slot. The UI will display "R" as a label.
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
  "slots": [
    {
      "semester": 1,                   // 1..8
      "kind": "FixedClass",            // "FixedClass" or "CategoryChoice"
      "classId": "MATH-1650",          // present when kind = FixedClass
      "category": null,                // present when kind = CategoryChoice
      "requiredCredits": 4,
      "minGrade": "C-",                // grade required to earn in this slot, or null
      "displayOrder": 1,               // position within the row, for layout
      "prereqs": [],                   // optional self-contained mirror of catalog
      "coreqs": []                     // optional self-contained mirror of catalog
    }
  ]
}
```

**Slot kinds:**
- `"FixedClass"` — a specific course assigned to this semester (e.g., Math 1650 in Sem 1). Set `classId`.
- `"CategoryChoice"` — a placeholder slot like the chart's "Gen Ed Elective 3cr" cells. Set `category`.

The `prereqs`/`coreqs` arrays on a slot are **optional, denormalized mirrors of the catalog** — they make the flow file self-contained for human reading. The importer validates them against `Course.Prereqs`/`Course.Coreqs` and warns if they diverge.

### Realistic flow examples

```jsonc
// Fixed course slot in Sem 1
{
  "semester": 1,
  "kind": "FixedClass",
  "classId": "MATH-1650",
  "requiredCredits": 4,
  "minGrade": "C-",
  "displayOrder": 1
}

// Fixed course with a coreq (mirrored from catalog for self-containment)
{
  "semester": 1,
  "kind": "FixedClass",
  "classId": "CPRE-1850",
  "requiredCredits": 3,
  "minGrade": null,
  "displayOrder": 3,
  "prereqs": [],
  "coreqs": ["MATH-1650"]
}

// Engr 1010 — registration only, 0 credit
{
  "semester": 1,
  "kind": "FixedClass",
  "classId": "ENGR-1010",
  "requiredCredits": 0,
  "minGrade": null,
  "displayOrder": 2
}

// Category placeholder — "Gen Ed Elective 3cr" from the chart
{
  "semester": 1,
  "kind": "CategoryChoice",
  "category": "GenEd",
  "requiredCredits": 3,
  "displayOrder": 5
}

// Tech elective placeholder in Sem 7
{
  "semester": 7,
  "kind": "CategoryChoice",
  "category": "TechElective",
  "requiredCredits": 3,
  "displayOrder": 4
}
```

---

## Validation the importer will run

When the importer loads these files (described in design spec §10 open items), it will:

1. Ensure every `classId` referenced from a flow exists in the catalog.
2. Validate that any `prereqs`/`coreqs` written on a flow slot match the canonical entry in the catalog (warn if divergent — likely a stale flow file).
3. Verify that every prereq/coreq tree's leaf `classId`s exist in the catalog.
4. Reject duplicate `classId` entries in the catalog.
5. Reject duplicate `(semester, displayOrder)` pairs within a single flow.

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
