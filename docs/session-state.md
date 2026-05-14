# Session state — handoff note

> **For Claude on a new machine:** read this top-to-bottom, then await user input.
> This file is a per-session aid and will be deleted/rewritten as work proceeds.

## Where we are right now

- **Branch:** `ui-v1/step-1-scaffold` (Step 2 commits are stacked here; the branch name is no longer accurate but kept for PR-stacking simplicity per S2-D1)
- **HEAD:** `393d6f2` — `feat(ui): wire App grid with TopBar, Sidebar, Main, RightPanel`
- **UI v1 Step 1 (Vite/React/TS scaffold) + Step 2 (layout skeleton)** are both done on this branch — pushed if `git status` reports up-to-date with origin; otherwise the local branch is ahead.
- **Plan #1 (seed validation + loader) is fully merged to main** (PR #2 + fix PR #3). 40 unit/integration tests pass; 1 intentional failure (`ActualSeedFileTests.Catalog_passes_validation_with_no_errors`) surfaces the 41-item seed-data punch list.

## Project shape

```
ISUCourseManager.sln          .NET solution
src/
  ISUCourseManager.Api/       ASP.NET Core (placeholder Program.cs)
  ISUCourseManager.Services/  Cascade engine + seed validator
  ISUCourseManager.Data/      Domain entities + JSON seed loader + PrereqExpression hierarchy
  ISUCourseManager.Web/       React + Vite + TypeScript SPA   <-- Step 1 + Step 2 done
    src/
      App.tsx                  composes the grid
      App.module.css           grid template + .noPanel modifier
      index.css                palette tokens (12 CSS custom properties) + body baseline
      components/              9 components — TopBar, Sidebar, Main, MainHeader,
                               RightPanel, AiButton, AiMark, DesktopOnlyGate
tests/
  ISUCourseManager.Services.Tests/   xUnit + FluentAssertions
docs/
  superpowers/specs/           system + UI v1 + 2 addendum specs + Step 2 design spec
  superpowers/plans/           Plan #1 (done), Step 2 plan (done), Plans #2/#3 (not started)
  superpowers/mockups/ui-v1/   v4 = locked layout, interaction-direct-manipulation = locked interactions
Data/, Documentation/         seed JSON + catalog PDF
```

## UI v1 — Step 2 (Layout Skeleton) — what was just done

Materialized the locked v4 layout chrome:
- 3-col CSS grid (`240px 1fr 380px`) with `.noPanel` modifier collapsing to 2-col
- Real topbar: navy bg, brand, `✦ Ask AI` purple-gradient pill, debug `[panel]` toggle, gold-on-navy avatar
- Sidebar shell with two section labels (My degree flows, Insights + `✦ AI` capsule). No "Progress stats" — locked v4 omits it from UI spec §8.
- Main column with placeholder header (H1 "Plan view", `✦ Analyze flow` pill, `grad: —` meta)
- Right-panel placeholder with mode-overridable `var(--panel-accent)` (default purple); collapsed by default, expanded via debug toggle
- `<DesktopOnlyGate>` shows "Desktop only — mobile coming soon" below 768px

11 implementation commits on top of Step 1, each a feat(ui) commit covering one component or one wiring step. Build clean, lint clean, all 11 acceptance criteria (S2-1..S2-11 in the Step 2 design spec) verified manually in the browser.

**Step 2 docs:**
- `docs/superpowers/specs/2026-05-14-ui-v1-step-2-layout-skeleton-design.md`
- `docs/superpowers/plans/2026-05-14-ui-v1-step-2-layout-skeleton.md`

To run locally:
```
cd src/ISUCourseManager.Web
npm install          # one-time
npm run dev          # http://localhost:5173
```

## Known follow-ups (from the final code review)

Non-blocking but worth fixing or addressing in a later step:
- **`.noPanel`/`hidden` split:** the spec called for `.app.noPanel .panel { display: none }` (parent-only authority over visibility), but CSS Modules can't cross-reference cleanly, so the implementation uses `<RightPanel hidden={!isPanelOpen} />` plus a `.hidden` class inside RightPanel.module.css. Functionally correct; the contract is split across two modules. Worth revisiting when the debug toggle is removed in Step 3+.
- **`App.module.css` has no `border-radius`:** the v4 mockup has `border-radius: 0 0 8px 8px` on the app frame, but that was for the embedded sub-mockup view. For a full-page app it's deliberately omitted; revisit if visual polish wants rounded outer corners (will look odd against viewport edges anyway).
- The **debug `[panel]` toggle** in the topbar is temporary — remove when real panel-mount triggers exist (clicking a tile → action menu, clicking AI entry → AI panel, etc.).

## Open Step 3 directions (user has not picked yet)

These were on the table at handoff:
1. **Wire up a mock API endpoint** — add MSW (Mock Service Worker), mock `GET /api/v1/me/flows` and `GET /api/v1/me/courses`, render the response (e.g., the first FlowCard in the sidebar). Proves the data flow end-to-end without ASP.NET.
2. **Build the sem-row + tile primitive** — start filling the empty `<PlanView>` region with static sem-rows and `<CourseTile>` instances from the v4 mockup. No data yet; tile state machine from UI spec §5.
3. **Add a test framework** — Vitest + React Testing Library + a few render tests for the new components. Cheap insurance before things get complex.
4. **Something else.**

## Key context flags

- **FluentAssertions 8.10.0 is non-OSS-licensed.** Flagged twice in Plan #1 reviews; user has not decided whether to pin to 7.x. Not relevant to UI work but will be when the next backend plan starts.
- **PrereqExpressionConverter exception contract was hardened** in the merged `fix/prereq-converter-exception-contract` branch — all malformed JSON now throws `JsonException`.
- **`StudentCourse` deliberately mixes `init` (identity props) with `set` (4 transfer fields).** Intentional per the external-transfer addendum spec — don't normalize it.
- **CSS approach is CSS Modules** (S2-D2), styling tokens are CSS custom properties in `src/index.css` (S2-8). Stick with these for subsequent UI steps.
- **Stack-on-current-branch convention** for UI v1 (S2-D1): all Step N commits land on `ui-v1/step-1-scaffold`. One bigger PR at the end vs. PR-per-step. User preference; revisit if the branch grows unwieldy.

## What NOT to do

- Don't start Plan #2 (EF persistence) or Plan #3 (cascade engine) — user explicitly chose UI-first.
- Don't try to "fix" the failing `ActualSeedFileTests.Catalog_passes_validation_with_no_errors` — it's the intentional Task-14 punch list.
- Don't add features to the UI scaffold beyond what the user asks for. Iterative means small steps.
- Don't remove the debug `[panel]` toggle yet — it stays until Step 3+ adds real panel-mount triggers.

## How to confirm the user is ready

When you start, **don't re-explain everything above** — assume they read this with you. Just confirm: "Reading session-state.md. Step 2 complete on this branch. Which direction for Step 3?" and wait for their pick.
