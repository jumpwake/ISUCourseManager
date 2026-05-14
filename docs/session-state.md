# Session state — handoff note

> **For Claude on a new machine:** read this top-to-bottom, then await user input.
> This file is a per-session aid and will be deleted/rewritten as work proceeds.

## Where we are right now

- **Branch:** `ui-v1/step-1-scaffold` (pushed to origin)
- **HEAD:** `5ff508f` — `feat(ui): scaffold React+Vite+TS frontend at src/ISUCourseManager.Web/`
- **Plan #1 (seed validation + loader) is fully merged to main** (PR #2 + fix PR #3). 40 unit/integration tests pass; 1 intentional failure (`ActualSeedFileTests.Catalog_passes_validation_with_no_errors`) surfaces the 41-item seed-data punch list for later refinement.
- We are now mid-stream on **UI v1**, doing it **iteratively** rather than via a heavyweight plan.

## Project shape

```
ISUCourseManager.sln          .NET solution
src/
  ISUCourseManager.Api/       ASP.NET Core (placeholder Program.cs from `dotnet new web`)
  ISUCourseManager.Services/  Cascade engine + seed validator
  ISUCourseManager.Data/      Domain entities + JSON seed loader + PrereqExpression hierarchy
  ISUCourseManager.Web/       React + Vite + TypeScript SPA   <-- new in this branch
tests/
  ISUCourseManager.Services.Tests/   xUnit + FluentAssertions
docs/
  superpowers/specs/          system + UI v1 + 2 addendum specs (authoritative)
  superpowers/plans/          Plan #1 (done), Plan #2 (EF persistence — not started),
                              Plan #3 (cascade engine — not started)
  superpowers/mockups/ui-v1/  HTML mockups; tightened-desktop-v4.html is the locked layout
Data/, Documentation/         seed JSON + catalog PDF
```

## UI v1 — what was decided

- **Stack:** React + Vite + TypeScript (matches spec §3). Confirmed by user.
- **Location:** `src/ISUCourseManager.Web/` (Option B from a directory-naming discussion — naming convention matches the .NET projects, but it's a pure npm project; no `.csproj`, not in `.sln`).
- **Approach:** API-mocked frontend first. Build UI screens against mock data; the real backend (EF persistence + cascade engine) gets built later to match the API contract that the UI naturally requires.
- **Process:** Iterative small steps, user redirects after each. Not a heavily-planned subagent dispatch like Plan #1 was.

## What was just done (Step 1)

Scaffolded `src/ISUCourseManager.Web/` with Vite 8 + React 19 + TypeScript 6. Replaced the Vite boilerplate landing page with a brand-navy "ISU Course Manager" placeholder. Verified `npm run build` is clean (17 modules, ~60 KB gzipped). No tests, no API mock, no router yet — all deferred to later steps.

To verify locally:
```
cd src/ISUCourseManager.Web
npm install          # one-time
npm run dev          # http://localhost:5173
```

## Open Step 2 directions (user has not picked yet)

These were on the table at handoff:
1. **Wire up a mock API endpoint** — add MSW (Mock Service Worker), mock `GET /api/v1/me/flows`, render the response. Proves the data flow end-to-end without ASP.NET.
2. **Build the layout skeleton from spec §3** — three-column grid (sidebar / main / right panel), topbar, brand colors. No data yet; matches `tightened-desktop-v4.html`.
3. **Add a test framework** — Vitest + React Testing Library + one render test for `App`. Cheap insurance before things get complex.
4. **Something else.**

## Key context flags

- **FluentAssertions 8.10.0 is non-OSS-licensed.** Flagged twice in Plan #1 reviews; user has not decided whether to pin to 7.x. Not relevant to UI work but will be when the next backend plan starts.
- **PrereqExpressionConverter exception contract was hardened** in the merged `fix/prereq-converter-exception-contract` branch — all malformed JSON now throws `JsonException` (previously leaked `KeyNotFoundException` / `ArgumentException` / `InvalidOperationException`).
- **`StudentCourse` deliberately mixes `init` (identity props) with `set` (4 transfer fields).** This is intentional per the external-transfer addendum spec — don't normalize it. (Captured in user's prior-machine memory, not in git, so flagging here.)

## What NOT to do

- Don't start Plan #2 (EF persistence) or Plan #3 (cascade engine) — user explicitly chose UI-first.
- Don't try to "fix" the failing `ActualSeedFileTests.Catalog_passes_validation_with_no_errors` — it's the intentional Task-14 punch list.
- Don't add features to the UI scaffold beyond what the user asks for. Iterative means small steps.

## How to confirm the user is ready

When you start, **don't re-explain everything above** — assume they read this with you. Just confirm: "Reading session-state.md. Step 1 complete on this branch. Which direction for Step 2?" and wait for their pick.
