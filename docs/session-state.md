# Session state — handoff note

> **For Claude on a new machine:** read this top-to-bottom, then await user input.
> This file is a per-session aid and will be deleted/rewritten as work proceeds.

## Where we are right now

- **Branch:** `ui-v1/step-6-catalog-search` (Step 6 commits: spec + plan + 1 implementation commit)
- **HEAD:** `82ce36b` — `feat(ui): add catalog search input to SlotPicker`
- **UI v1 Steps 1+2 + Step 3 + Step 4 + Step 5** merged into local main (25+ commits ahead of origin/main since the last push). Step 6 is on this branch awaiting PR/merge.
- **Plan #1 (seed validation + loader)** fully merged to main.

## Project shape

```
src/ISUCourseManager.Web/src/
  App.tsx                            composes grid + SelectedPanel state (actionMenu | slotPicker)
  App.module.css                     grid template + .noPanel modifier
  index.css                          palette tokens + body baseline
  data/                              Step 3 module
    types.ts / catalog.ts / flow.ts / student.ts
    academicTerm.ts / department.ts / overlay.ts / index.ts
    seed/  (three JSONs)
  components/                        14 components
    Step 2 chrome:  TopBar, Sidebar, MainHeader, Main, RightPanel,
                    AiButton, AiMark, DesktopOnlyGate
    Step 3 plan:    CourseTile, SemRow, PlanView
    Step 4:         ActionMenu       (with Completed-trim from Step 5)
    Step 5:         SlotPicker       (with catalog search from Step 6)
docs/
  superpowers/specs/   system + UI v1 + 2 addenda + Step 2/3/4/5/6 specs
  superpowers/plans/   Plan #1 done; Step 2/3/4/5/6 plans done; Plans #2/#3 not started
```

## UI v1 — Step 6 (Catalog Search) — what was just done

Added a single text-input search bar at the top of the SlotPicker body. Filters the "Add a new course from the catalog" section live as the user types — substring match across `classId`, display `code`, `name`, and `department`. Empty query keeps Step 5's first-8 default. Non-empty query shows up to 20 matches; section header gains a `{N} match(es)` count badge.

The other half of the user's Step-5 sign-off feedback — an **AI chat to help fill the slot** — is still pending. Captured as a Step 7 candidate below.

**`<SlotPicker />` changes (single file):**
- `useState('')` for the query value, updated on every keystroke (no debounce — 100-entry catalog × O(N) filter is ~0.1ms).
- Search `<input>` at the top of `.body` (above the 3 existing sections). 1px grey border, blue `#1976d2` focus.
- Helper `filterCatalog` with early-exit at 20 matches; `matchesQuery` does case-insensitive substring on 4 fields.
- Catalog section renders the result list or an italic "No courses match {query}" message when empty.
- Section helper extended with an optional `badge?: string` prop. When the search is active, the badge reads `{N} match` (singular) or `{N} matches` (plural).
- Other sections ("Pull from a later semester", "Leave this slot empty") unaffected.

**Step 6 docs:**
- `docs/superpowers/specs/2026-05-14-ui-v1-step-6-catalog-search-design.md`
- `docs/superpowers/plans/2026-05-14-ui-v1-step-6-catalog-search.md`

## Known follow-ups (carry forward)

User-flagged + reviewer-flagged items, deferred:

- **AI chat to help fill a slot.** User repeated this at Step 6 sign-off: "we need to add an item for an AI chat when trying to fill a slot and you need help." Natural placement: an AI suggestion section / quick-ask chips above (or below) the catalog list, OR a Chat-with-AI button that opens the AI panel mode (purple accent) scoped to the slot. Per UI spec §10.2 + §10.3 + §11. Pairs naturally with MSW + the `/api/v1/ai/ask` endpoint scaffold. **Top candidate for Step 7.**
- **Real mutations** — every action card in ActionMenu + SlotPicker is still a no-op stub. Need either local state (next step backend-free) or MSW (mock backend) before "Mark Completed", "Move to future term", etc. actually do something.
- **Seed data sweep** — `isu-catalog.json` missing HDFS-2390, PHIL-2010; CYBE flow has only Sems 1/2/8. Captured in memory (`project-seed-data-incomplete`). Filling this in unblocks unfilledDegreeSlot tile rendering (currently no live test of that slot-picker branch).
- **DRY refactors** flagged by reviewers across steps 4–5:
  - `electiveLabel(slotType)` duplicated in `CourseTile.tsx` and `SlotPicker.tsx` — extract to a shared helper.
  - `Section` sub-component duplicated in `ActionMenu.tsx` and `SlotPicker.tsx` — same.
- **Cosmetic nits** from Step 5 reviewer:
  - SlotPicker `cancelBtn` color is grey (`var(--text-label)`); the AC text says "blue". Visual pass confirmed, but worth a polish pass.
  - SlotPicker `.muted` card still has interactive hover styles (brightens bg, blue border) — could be made truly static.
- **AI panel mode (purple accent)** — the existing `--panel-accent` CSS variable system supports adding a third accent (`accentAi`) when the AI panel lands. The `RightPanel.tsx` already takes `accent: 'ai' | 'action'`; the `'ai'` branch was scaffolded in Step 4 but not yet exercised.

## Open Step 7 directions (user has not picked yet)

1. **AI chat in slot picker** (top candidate) — addresses the deferred half of Step 5 + Step 6 user feedback. Introduces AI integration architecture (UI spec §11 — server-mediated `/api/v1/ai/ask` endpoint). Likely requires landing MSW first OR using a faked `useAi()` hook with hardcoded sample responses. Could be split: Step 7a = MSW + faked AI responses; Step 7b = real Anthropic integration.
2. **Real mutations (local state first)** — make existing ActionMenu / SlotPicker buttons actually do something. Required before MSW because mutations need a target.
3. **MSW + `usePlan()` hook refactor** — swap the static `PLAN` constant for a hook backed by MSW. Lays groundwork for both AI integration and real mutations.
4. **Validation banner + tile flags** — surface cascade-engine output. Needs backend (or faked validation source).
5. **Catalog / flow data sweep** — pure data-entry. Fills the seed gaps so all branches of the overlay + slot picker get real data.
6. **Test framework** — Vitest + RTL + first render tests.
7. **DRY refactors** — extract `electiveLabel` + `Section` helpers; polish cosmetic nits.
8. **Something else.**

## Key context flags

- **Seed JSONs are intentionally incomplete.** Captured in memory (`project-seed-data-incomplete`).
- **CSS approach is CSS Modules** + palette tokens as CSS custom properties in `src/index.css`. `--panel-accent` is the canonical pattern for mode-dependent panel accents.
- **Stack-on-its-own-branch per step.** Each step gets its own branch from main and is merged before the next starts.
- **Seed file `"Complete"` → spec `"Completed"`** adapter in `src/data/student.ts:normalizeStatus`.
- **The right panel uses a layout wrapper pattern**: `<RightPanel accent="action">` (or `accent="ai"` for future AI mode) provides the chrome; content components (`<ActionMenu>` / `<SlotPicker>` / future `<AiPanel>`) render inside as children.
- **No AI integration yet.** Per UI spec §11, AI calls must be server-mediated — Anthropic API never called directly from the browser. Step 7+ has to introduce either MSW or a real backend endpoint.

## What NOT to do

- Don't start Plan #2 (EF persistence) or Plan #3 (cascade engine) — user is staying UI-first.
- Don't try to "fix" `ActualSeedFileTests.Catalog_passes_validation_with_no_errors` — intentional punch list.
- Don't auto-add missing courses/slots to the seed JSONs — deferred per project memory.
- Don't re-litigate the dept-tint-wins CSS cascade — that's the locked v4 behavior.
- Don't call Anthropic API directly from the browser — UI spec §11 requires server-mediation.

## How to confirm the user is ready

When you start, **don't re-explain everything above** — assume they read this with you. Just confirm: "Reading session-state.md. Step 6 complete on `ui-v1/step-6-catalog-search`. Which direction for Step 7?" and wait for their pick.
