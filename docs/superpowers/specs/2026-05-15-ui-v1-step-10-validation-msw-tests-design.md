# UI v1 — Step 10 (Plan Validation + MSW AI Layer + Test Framework) — Design Spec

**Date:** 2026-05-15
**Status:** Approved for planning
**Author:** Kevin (with Claude)
**Companion to:**
- `docs/superpowers/specs/2026-05-13-ui-v1-design.md` (UI v1 — source of truth)
- `docs/superpowers/specs/2026-05-14-ui-v1-step-7-ai-chat-design.md` (the stubbed AI panel this reworks)
- `docs/superpowers/specs/2026-05-14-ui-v1-step-3-plan-view-overlay-design.md` (the overlay / PlanRow model)

## 1. Goal

Three bundled, independent parts:

- **Part A — Plan validation:** a lightweight client-side check that surfaces plan problems (credit load, unfilled requirements, term availability) in a banner and as per-tile flags.
- **Part B — MSW AI layer:** replace the stubbed `useAi()` hook with a real `fetch('/api/v1/ai/ask')` call, intercepted by a Mock Service Worker that returns structured responses — in the dev browser and in tests.
- **Part C — Test framework:** introduce Vitest + React Testing Library and cover the new validation logic and the reworked AI panel.

The three parts share no code and can be reviewed independently. The test framework (C) is the connective tissue: it covers A's pure validation functions and exercises B's MSW layer.

## 2. Scope

### In scope
- A pure `validatePlan` function + a `<ValidationBanner>` + per-tile `⚠` flags.
- Surfacing two seed fields the frontend currently drops: `Course.typicallyOffered` and `DegreeFlow.totalCreditsRequired`.
- A real async `useAi()` over `fetch('/api/v1/ai/ask')`; MSW mock backend for dev + tests.
- Vitest + RTL + jsdom; unit tests for `validatePlan`, an MSW-driven integration test for `AiPanel`.
- New dependencies: `msw`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`.

### Out of scope
- **Prerequisite validation.** The catalog seed has `prereqs` as expression trees + `{_unparsed}` strings; evaluating them against a plan is the deferred cascade-engine work. Not attempted.
- A real Anthropic backend — MSW returns canned responses; no LLM call.
- Co-requisite checks, grade/GPA validation, `minGrade` enforcement.
- Surfacing AI scopes beyond `slot` (topbar / flow / semester `✦` stay no-op).
- Persistence; the .NET API.
- Exhaustive test coverage — tests target the new logic, not the whole app.

## 3. Part A — Plan validation

### 3.1 Data surfacing
The frontend types drop two seed fields that validation needs:
- `Course` gains `typicallyOffered: string[]` (e.g. `["Fall", "Spring"]`). `data/catalog.ts`'s `RawCatalogCourse` + the mapper carry it through.
- `DegreeFlow` gains `totalCreditsRequired: number`. `data/flow.ts` reads `flowRaw.totalCreditsRequired` (the CYBE seed has `125`).

`data/academicTerm.ts` gains `academicTermToSeason(term: number): 'Fall' | 'Spring'` — `term % 100 === 2 ? 'Fall' : 'Spring'` (the term encoding already used by `academicTermToLabel`).

### 3.2 `data/validation.ts` (new)

```ts
export type PlanIssue =
  | { kind: 'creditOverload'; semIdx: number; credits: number }
  | { kind: 'creditUnderload'; semIdx: number; credits: number }
  | {
      kind: 'termUnavailable';
      classId: string;
      code: string;
      semIdx: number;
      academicTerm: number;
      season: string;
      offered: string[];
    };

export type PlanValidation = {
  issues: PlanIssue[];
  unfilledCount: number;
  plannedCredits: number;
  requiredCredits: number;
};

export function validatePlan(
  rows: PlanRow[],
  requiredCredits: number,
  catalogById: ReadonlyMap<string, Course>,
): PlanValidation;
```

Rules:
- **`creditOverload`** — any row with `totalCredits > 18`, excluding `allCompleted` rows.
- **`creditUnderload`** — any row with `0 < totalCredits < 12`, excluding `allCompleted` rows. (A 0-credit row is "not planned yet", not underloaded.)
- **`termUnavailable`** — for each non-Completed `studentCourse` tile, look up `catalogById.get(classId)`. If the course exists, has a non-empty `typicallyOffered`, and `typicallyOffered` does **not** include `academicTermToSeason(tile.academicTerm)`, emit an issue. (Missing course or empty `typicallyOffered` → no flag.)
- **`unfilledCount`** — count of `unfilledDegreeSlot` + `electiveSlot` tiles across all rows.
- **`plannedCredits`** — sum of `credits` over `studentCourse` tiles whose status is `Completed`, `InProgress`, or `Planned` (Failed/Withdrawn excluded).
- **`requiredCredits`** — passed through from `flow.totalCreditsRequired`.

`validatePlan` is pure — no React, no side effects. It is the primary unit-test target.

### 3.3 UI

**`<ValidationBanner>` (new component)** — a compact strip rendered in `Main`, between `<MainHeader>` and `<PlanView>`. It shows:
- Credit progress: `{plannedCredits} / {requiredCredits} credits planned`.
- `{unfilledCount} requirement(s) unfilled`.
- An issue summary: when `issues.length > 0`, a grouped line (e.g. "2 semesters over 18 cr · 1 course in an unavailable term"); when `issues.length === 0`, a positive/clean state ("Plan looks good").

The banner is informational and always visible — not dismissible, no blocking.

**Per-tile flags** — `CourseTile` gains an optional `flagged?: boolean` prop. When true, the studentCourse tile renders a small `⚠` corner badge. `App` builds a `Set<string>` of flagged tile keys (`${classId}-${academicTerm}`) from the `termUnavailable` issues and threads it down: `App → Main → PlanView → SemRow → CourseTile`, the same path as `selectedClassId`. `SemRow` passes `flagged={flaggedKeys.has(key)}` per studentCourse tile. (Credit over/under load is already conveyed by the `SemRow` credit-pill color from Step 3 — the banner counts those; no new per-tile flag for credit load.)

### 3.4 App wiring
`App` computes `const validation = useMemo(() => validatePlan(rows, flow.totalCreditsRequired, catalogById), [rows])` and `const flaggedKeys = useMemo(...)` derived from `validation.issues`. Both flow into `<Main>`.

## 4. Part B — MSW AI layer

### 4.1 DTOs (`data/types.ts`)

```ts
export type AiAskRequest = {
  scope: AiScope;
  message: string | null; // null = initial scoped load
};

export type AiAskResponse = {
  messages: AiMessage[];
  suggestions: AiSuggestion[];
  quickAsks: string[];
};
```

### 4.2 `useAi()` rewrite
`useAi(scope)` becomes a real async hook returning:

```ts
{
  messages: AiMessage[];
  suggestions: AiSuggestion[];
  quickAsks: string[];
  loading: boolean;
  error: boolean;
  send: (userText: string) => void;
  retry: () => void;
}
```

Behavior:
- On mount, `useEffect` issues `POST /api/v1/ai/ask` with `{ scope, message: null }`. While in flight, `loading` is true; on success the response populates `messages` / `suggestions` / `quickAsks`; on failure `error` is true.
- `send(text)` appends the user message immediately, sets `loading`, then `POST`s `{ scope, message: text }`; the response's `messages` are appended. On failure, `error` is true and the user message stays.
- `retry()` re-issues the last failed request.

### 4.3 `AiPanel` changes
- While `loading`, a pending "thinking…" AI bubble is shown at the end of the conversation; the input + Ask button are disabled.
- On `error`, an error notice with a **Retry** button (calls `retry()`).
- The initial-load case (`loading` with no messages yet) shows a loading state in the body.
- Suggestion cards + quick-asks render once the first response arrives.

### 4.4 MSW
- `src/mocks/handlers.ts` — a handler for `POST /api/v1/ai/ask` that reads `AiAskRequest` and returns an `AiAskResponse`. The canned content is the Step 7 stub logic (scoped initial message, the three suggestion cards, quick-asks, the canned reply) moved server-side.
- `src/mocks/browser.ts` — `setupWorker(...handlers)` for the dev browser.
- `src/mocks/server.ts` — `setupServer(...handlers)` for Vitest.
- `src/main.tsx` — in dev (`import.meta.env.DEV`), `await worker.start()` before `createRoot(...).render(...)`.
- `public/mockServiceWorker.js` — generated by `npx msw init public/` and committed.

New dependency: `msw`.

## 5. Part C — Vitest + React Testing Library

### 5.1 Setup
- Dependencies (dev): `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`.
- `vite.config.ts` gains a `test` block: `environment: 'jsdom'`, `setupFiles: './src/test/setup.ts'`, `globals: false` (tests use explicit `import { describe, it, expect } from 'vitest'` — avoids a tsconfig `types` change under `verbatimModuleSyntax`).
- `src/test/setup.ts` — imports `@testing-library/jest-dom`; starts the MSW `server` (`beforeAll`), resets handlers (`afterEach`), closes it (`afterAll`).
- `package.json` — `"test": "vitest run"`.

### 5.2 Tests written
- `src/data/validation.test.ts` — thorough unit coverage of `validatePlan`: each issue kind (overload, underload, term-unavailable), the `allCompleted`/0-credit exclusions, `unfilledCount`, `plannedCredits` (Failed excluded), and a clean-plan case.
- `src/components/AiPanel.test.tsx` — an MSW-driven integration test: render `AiPanel`, assert the initial scoped message arrives, type a question, assert the user message + AI reply render.

Coverage targets the new logic — not the whole app.

## 6. Component / file changes

| File | Change |
|---|---|
| `data/types.ts` | `Course` += `typicallyOffered`; `DegreeFlow` += `totalCreditsRequired`; add `AiAskRequest`, `AiAskResponse`. |
| `data/catalog.ts` | `RawCatalogCourse` + mapper carry `typicallyOffered`. |
| `data/flow.ts` | Read `flowRaw.totalCreditsRequired` into the `DegreeFlow`. |
| `data/academicTerm.ts` | Add `academicTermToSeason`. |
| `data/validation.ts` | **New.** `PlanIssue`, `PlanValidation`, `validatePlan`. |
| `data/validation.test.ts` | **New.** Unit tests for `validatePlan`. |
| `data/useAi.ts` | Rewritten async over `fetch('/api/v1/ai/ask')`; `loading`/`error`/`retry`. |
| `components/ValidationBanner.tsx` (+`.module.css`) | **New.** The plan-validation summary strip. |
| `components/Main.tsx` | Render `<ValidationBanner>`; thread `flaggedKeys`. |
| `components/PlanView.tsx` | Thread `flaggedKeys`. |
| `components/SemRow.tsx` | Thread `flagged` per tile. |
| `components/CourseTile.tsx` (+`.module.css`) | Optional `flagged` prop → `⚠` corner badge. |
| `components/AiPanel.tsx` | Handle `loading` / `error` / `retry`. |
| `components/AiPanel.test.tsx` | **New.** MSW-driven integration test. |
| `App.tsx` | `validatePlan` + `flaggedKeys` memos; pass to `<Main>`. |
| `mocks/handlers.ts`, `mocks/browser.ts`, `mocks/server.ts` | **New.** MSW. |
| `test/setup.ts` | **New.** Vitest setup (jest-dom + MSW server). |
| `main.tsx` | Start the MSW worker in dev before render. |
| `vite.config.ts` | Add the `test` block. |
| `package.json` | New deps; `test` script. |
| `public/mockServiceWorker.js` | **New.** Generated by `msw init`. |

## 7. Acceptance criteria

| # | Criterion |
|---|---|
| S10-1 | A semester with `> 18` credits produces a `creditOverload` issue; one with `0 < credits < 12` produces `creditUnderload`; all-completed and 0-credit rows produce neither. |
| S10-2 | A non-Completed course whose `typicallyOffered` excludes its semester's season produces a `termUnavailable` issue; a course not in the catalog or with empty `typicallyOffered` produces none. |
| S10-3 | `validatePlan` reports `unfilledCount` (placeholder tiles) and `plannedCredits` (Completed/InProgress/Planned credits, Failed excluded). |
| S10-4 | The `<ValidationBanner>` renders between the main header and the plan, showing credit progress, unfilled count, and an issue summary — or a clean/positive state when there are no issues. |
| S10-5 | A course tile with a `termUnavailable` issue shows a `⚠` corner badge; unflagged tiles do not. |
| S10-6 | Mutating the plan (move a course to a wrong-season term, overload a semester) updates the banner and tile flags reactively. |
| S10-7 | `useAi()` issues `POST /api/v1/ai/ask` on mount; the AI panel shows a loading state, then the scoped initial message + suggestions + quick-asks from the response. |
| S10-8 | Typing a question and pressing Ask issues a `POST`, shows a "thinking…" state, then appends the AI reply. |
| S10-9 | A failed `/api/v1/ai/ask` request shows an error notice with a working Retry. |
| S10-10 | In the dev browser, MSW intercepts `/api/v1/ai/ask` — the Network tab shows the request and the app behaves as in S10-7/S10-8. |
| S10-11 | `npm run test` runs Vitest; `validation.test.ts` and `AiPanel.test.tsx` pass. |
| S10-12 | `npm run build` and `npm run lint` both exit 0. |

## 8. Decisions

| # | Decision | Rationale |
|---|---|---|
| S10-D1 | Prerequisite validation is excluded | The seed's `prereqs` are expression trees / `{_unparsed}` strings; evaluating them against a plan is the deferred cascade-engine work. Out of scope by the project's UI-first stance. |
| S10-D2 | `validatePlan` is a pure function taking `rows` + `requiredCredits` + `catalogById` | Purity makes it the natural unit-test target and keeps validation out of React. |
| S10-D3 | Credit-load issues exclude all-completed and 0-credit rows | Flagging a finished semester's load, or an empty future semester as "underloaded", is noise. |
| S10-D4 | MSW runs in the dev browser, not only in tests | The point of the rework is that the dev app makes real `fetch` calls; MSW intercepting them is the closest thing to the eventual server without a backend. |
| S10-D5 | All AI content (initial message + replies) comes from `/api/v1/ai/ask` | A real server would own this content; keeping any of it client-side would be a fake seam. |
| S10-D6 | Vitest `globals: false` — tests use explicit imports | Avoids adding `vitest/globals` to `tsconfig` `types`, which is friction under `verbatimModuleSyntax`. |
| S10-D7 | The three parts share one spec/branch but no code | The user bundled them into one step; keeping them as separate sections keeps each reviewable (and revertable) on its own. |
