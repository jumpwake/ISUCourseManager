# Session state — handoff note

> **For Claude on a new machine:** read this top-to-bottom, then await user input.
> This file is a per-session aid and will be deleted/rewritten as work proceeds.

## Where we are right now

- **Branch:** `ui-v1/step-7-ai-chat` (Step 7 commits: spec + plan + 7 implementation commits)
- **HEAD:** `057f251` — `feat(ui): auto-scroll AI panel to newest message on send`
- **UI v1 Steps 1–6** merged to main (origin/main published through Step 6). Step 7 is on this branch awaiting PR/merge.
- **Plan #1 (seed validation + loader)** fully merged to main.

## Project shape

```
src/ISUCourseManager.Web/src/
  App.tsx                            grid + SelectedPanel state (actionMenu | slotPicker | aiPanel)
  App.module.css                     grid template + .noPanel modifier
  index.css                          palette tokens + body baseline
  data/
    types.ts                         all frontend types incl. AiMessage / AiSuggestion / AiScope
    catalog.ts / flow.ts / student.ts / academicTerm.ts / department.ts / overlay.ts / index.ts
    useAi.ts                         stubbed AI hook (Step 7)
    seed/  (three JSONs)
  components/                        15 components
    Step 2 chrome:  TopBar, Sidebar, MainHeader, Main, RightPanel, AiButton, AiMark, DesktopOnlyGate
    Step 3 plan:    CourseTile, SemRow, PlanView
    Step 4:         ActionMenu
    Step 5:         SlotPicker
    Step 7:         AiPanel
docs/
  superpowers/specs/   system + UI v1 + 2 addenda + Step 2–7 specs
  superpowers/plans/   Plan #1 done; Step 2–7 plans done; Plans #2/#3 not started
```

## UI v1 — Step 7 (AI Chat — Slot Scope, Stubbed) — what was just done

Landed the first AI-mediated UX surface. A stubbed AI chat panel opens from the slot picker to help fill an open slot.

**New `<AiPanel />`** — purple-chrome right-panel content (third mode alongside ActionMenu and SlotPicker):
- Header: `←` back arrow, `✦ AI` capsule, title, scope chip, close `×`.
- Body: initial AI message, 3 suggestion cards (purple gradient, no-op Add/Why buttons), then the growing conversation. Auto-scrolls smoothly to the newest message on send.
- Footer: text input + `Ask` button + 3 quick-ask chips.
- `**bold**` segments in AI messages render bold-purple via a tiny inline split-on-`**` parser.

**New stubbed `useAi(scope)` hook** (`src/data/useAi.ts`) — hardcoded initial message + suggestions + quick-asks; `send(text)` appends the user message + a canned reply to local state. No Anthropic calls.

**Entry point** — a compact purple `✦` icon button inline to the right of the catalog search input in the slot picker (revised down from a full-width button during review). Clicking opens the AI panel.

**App state** — `SelectedPanel` widened to a 3-branch discriminated union (`actionMenu | slotPicker | aiPanel`). `RightPanel`'s `accent` prop now exercises its `'ai'` (purple) branch, scaffolded back in Step 2.

**Two review refinements + one fix** folded into the branch:
- Compact `✦` icon instead of the full-width button (commit `0e7faa2`).
- Back arrow `←` in the AI panel header → returns to the slot picker for the same tile; the `×` still closes entirely (commit `0e7faa2`).
- Conversation body smooth-scrolls to the newest message on send (commit `057f251`).

The Step 7 spec has a `§12 Post-implementation amendments` section recording the two reversed decisions (S7-D3, S7-D4).

**Step 7 docs:**
- `docs/superpowers/specs/2026-05-14-ui-v1-step-7-ai-chat-design.md`
- `docs/superpowers/plans/2026-05-14-ui-v1-step-7-ai-chat.md`

## Known follow-ups (carry forward)

- **Real AI integration** — `useAi()` is fully stubbed (hardcoded responses, canned reply ignores input). Real path per UI spec §11: server-mediated `/api/v1/ai/ask`, no direct browser→Anthropic. Needs MSW or a real backend first.
- **Real mutations** — every action card (ActionMenu, SlotPicker, AiPanel suggestion cards) is a no-op stub. Need local state first, then MSW/backend.
- **AI scope: global / flow / semester** — only `slot` scope is wired. The topbar `✦ Ask AI` and main-header `✦ Analyze flow` and sem-row `✦` are still no-op stubs. `useAi`'s `AiScope` union is ready to extend.
- **Seed data sweep** — `isu-catalog.json` missing HDFS-2390, PHIL-2010; CYBE flow has only Sems 1/2/8. Captured in memory (`project-seed-data-incomplete`). Filling this in unblocks live testing of the `unfilledDegreeSlot` tile branch.
- **DRY refactors** (reviewer-flagged across Steps 4–7):
  - `electiveLabel(slotType)` is now **triplicated** — `CourseTile.tsx`, `SlotPicker.tsx`, `AiPanel.tsx`. Extract to a shared helper (e.g., `src/data/electiveLabel.ts`).
  - `Section` sub-component duplicated in `ActionMenu.tsx` + `SlotPicker.tsx`.
- **Cosmetic nits** from earlier reviews — SlotPicker `cancelBtn` grey-vs-blue; `.muted` card still has interactive hover.

## Open Step 8 directions (user has not picked yet)

1. **MSW + real `useAi()` wiring** — swap the stubbed hook for `fetch('/api/v1/ai/ask')` against a mock service worker returning structured `AiResponseDto`s. Closer to the eventual architecture; still no Anthropic.
2. **Real Anthropic integration** — needs a server-side proxy/endpoint (bigger lift; touches the .NET API).
3. **Real mutations (local state first)** — make ActionMenu / SlotPicker / AiPanel action buttons actually change the plan.
4. **AI scope expansion** — wire the global / flow / semester `✦` entry points to `useAi`.
5. **Validation banner + tile flags** — surface cascade-engine output.
6. **Catalog / flow data sweep** — pure data-entry; fills seed gaps.
7. **Test framework** — Vitest + RTL.
8. **DRY refactors** — extract `electiveLabel` + `Section` helpers; cosmetic polish.
9. **Something else.**

## Key context flags

- **Seed JSONs are intentionally incomplete.** Memory: `project-seed-data-incomplete`.
- **Single dev server reused across verification cycles** — memory: `feedback-dev-server-reuse`. Don't spawn a new `npm run dev` each cycle; rely on Vite HMR + browser refresh. The session's dev server runs at `http://localhost:5173`.
- **CSS approach is CSS Modules** + palette tokens as CSS custom properties in `src/index.css`. `--panel-accent` switches the right-panel border per mode (`accentAction` blue / `accentAi` purple).
- **Stack-on-its-own-branch per step.** Each step gets its own branch from main, merged before the next starts.
- **AI must be server-mediated** (UI spec §11) — never call Anthropic directly from the browser.
- **`eslint.config.js`** has `argsIgnorePattern`/`varsIgnorePattern: '^_'` — underscore-prefixed unused params/vars are intentionally allowed.

## What NOT to do

- Don't start Plan #2 (EF persistence) or Plan #3 (cascade engine) — user is staying UI-first.
- Don't try to "fix" `ActualSeedFileTests.Catalog_passes_validation_with_no_errors` — intentional punch list.
- Don't auto-add missing courses/slots to the seed JSONs — deferred per project memory.
- Don't re-litigate the dept-tint-wins CSS cascade — locked v4 behavior.
- Don't call Anthropic directly from the browser.
- Don't spawn a second dev server — reuse the running one.

## How to confirm the user is ready

When you start, **don't re-explain everything above** — assume they read this with you. Just confirm: "Reading session-state.md. Step 7 complete on `ui-v1/step-7-ai-chat`. Which direction for Step 8?" and wait for their pick.
