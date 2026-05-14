# UI v1 — Step 2 (Layout Skeleton) — Design Spec

**Date:** 2026-05-14
**Status:** Approved for planning
**Author:** Kevin (with Claude)
**Companion to:**
- `docs/superpowers/specs/2026-05-13-ui-v1-design.md` (UI v1 design — source of truth)
- `docs/superpowers/mockups/ui-v1/tightened-desktop-v4.html` (locked layout)
- `docs/superpowers/mockups/ui-v1/interaction-direct-manipulation.html` (locked interactions)

## 1. Goal

Lay the visual skeleton for UI v1 in `src/ISUCourseManager.Web/`: the three-column CSS grid, real topbar, sidebar/main shells with section headers, and a collapsible right-panel placeholder. No data, no behavior beyond a debug panel-toggle. Verifies that the locked v4 layout chrome materializes correctly before any subsequent step adds flow cards, tiles, banners, or AI content.

This is Step 2 of an iterative UI-v1 build (Step 1 was the Vite/React/TS scaffold at commit `5ff508f`). Subsequent steps add data flow (MSW mock), tile system, validation banner, AI panel, etc.

## 2. Scope

### In scope
- Desktop-only CSS grid: `grid-template-columns: 240px 1fr 380px`, `grid-template-rows: 56px auto 1fr`, areas `topbar`, `sidebar`, `banner`, `main`, `panel`. Banner row is `auto` and self-collapses to 0px when empty (no banner content in this step). Outer border, radius, overflow per v4 mockup.
- A `.noPanel` modifier on the grid container that switches cols to `240px 1fr`, drops the `panel` area, and `display:none`s the panel element. This is the collapse mechanism per v4 spec §3.
- **Topbar** (real, non-interactive): navy `#1f3b5d` bg, `📘 ISU` + gold `CourseManager` brand, `✦ Ask AI` purple-gradient pill, right-aligned `Hi, Luke` + `LB` gold-on-navy 28px circular avatar. Plus a temporary debug `[panel]` toggle button to verify the collapse mechanism.
- **Sidebar**: bg `#fafbfc`, right border, padding 12px, gap 12px. Two uppercase-small-caps section labels: "My degree flows" and "Insights" (with `✦ AI` capsule inline). Empty section bodies. **No "Progress stats" section** — locked v4 omits it from spec §8.
- **Banner area**: reserved by the grid (auto-row, sits between topbar and main, spans only the main column — sidebar and panel run full height). No banner component this step.
- **Main**: `<MainHeader />` with placeholder H1 "Plan view", non-interactive `✦ Analyze flow` purple-gradient pill, right-aligned `grad: —` meta. Below the header, empty body region.
- **Right panel**: collapsed by default. When toggled on, mounts an empty placeholder with `border-left: 2px solid var(--panel-accent)` (default `#7c3aed`). The mode-dependent accent color (purple in AI mode, blue `#1976d2` in action-menu / slot-picker, header bg shifts red-tint when validation issue) is captured as a CSS variable for later override; concrete modes land in later steps.
- **Palette tokens** as CSS custom properties in `src/index.css`: `--navy`, `--gold`, `--ai-start`, `--ai-end`, `--border`, `--border-soft`, `--bg-app`, `--bg-sidebar`, `--text-default`, `--text-muted`, `--text-label`, `--panel-accent`. Component styles via CSS Modules.
- Below 768px: centered "Desktop only — mobile coming soon" message; no responsive shell.

### Out of scope
- Data fetching, MSW, real flow cards, sem-rows, tiles, validation banner content, AI panel content, action menu, slot picker, progress-stats section.
- Mobile responsive layout (spec §3 mobile design).
- Test framework (Vitest / RTL / Storybook).
- Routing.
- Real "Hi, X" name / avatar derivation from `useStudent()`.
- The pending-grade/coreq-cascade and external-transfer addendum specs add tile states and a transfer modal — none of which Step 2 renders. Their palette additions land when tiles/forms get implemented.

## 3. Layout & styling

### CSS grid (`App.module.css`)

```css
.app {
  display: grid;
  grid-template-columns: 240px 1fr 380px;
  grid-template-rows: 56px auto 1fr;
  grid-template-areas:
    "topbar  topbar  topbar"
    "sidebar banner  panel"
    "sidebar main    panel";
  height: 100vh;
  border: 1px solid var(--border);
  overflow: hidden;
  background: var(--bg-app);
  font-family: -apple-system, "Segoe UI", system-ui, sans-serif;
  font-size: 13px;
  color: var(--text-default);
}

.app.noPanel {
  grid-template-columns: 240px 1fr;
  grid-template-areas:
    "topbar  topbar"
    "sidebar banner"
    "sidebar main";
}

.app.noPanel .panel { display: none; }
```

### Palette tokens (`src/index.css`)

```css
:root {
  --navy: #1f3b5d;
  --gold: #ffc555;
  --ai-start: #7c3aed;
  --ai-end: #4f46e5;
  --border: #d0d7de;
  --border-soft: #e0e0e0;
  --bg-app: #fff;
  --bg-sidebar: #fafbfc;
  --text-default: #1f2328;
  --text-muted: #8895a4;
  --text-label: #5a6573;
  --panel-accent: var(--ai-start);  /* mode-overridable later */
}
```

### Desktop-only gate

A small `<DesktopOnlyGate />` wraps the entire app. Below 768px it renders a centered message and suppresses the grid. Above 768px it renders children unchanged. Implementation: `window.matchMedia('(min-width: 768px)')` with a listener; SSR not a concern (Vite SPA).

## 4. Component structure

```
src/ISUCourseManager.Web/src/
├── main.tsx                       (unchanged)
├── App.tsx                        (rewritten: grid container + isPanelOpen state + DesktopOnlyGate wrapper)
├── App.module.css                 (grid template + .noPanel modifier; replaces App.css)
├── index.css                      (palette tokens added)
└── components/
    ├── TopBar.tsx                 brand · AiButton "Ask AI" · debug panel-toggle · "Hi, X" + avatar
    ├── TopBar.module.css
    ├── Sidebar.tsx                two empty section labels: "My degree flows", "Insights" + <AiMark/>
    ├── Sidebar.module.css
    ├── Main.tsx                   wraps <MainHeader/> + empty plan-view region
    ├── Main.module.css
    ├── MainHeader.tsx             placeholder H1 "Plan view" · AiButton "Analyze flow" · "grad: —" meta
    ├── MainHeader.module.css
    ├── RightPanel.tsx             empty placeholder body; var(--panel-accent) border-left
    ├── RightPanel.module.css
    ├── AiButton.tsx               shared: ✦ <label> purple-gradient pill (used by topbar + main-header)
    ├── AiButton.module.css
    ├── AiMark.tsx                 shared: tiny "✦ AI" purple capsule (used in sidebar label)
    ├── AiMark.module.css
    ├── DesktopOnlyGate.tsx        renders children at ≥768px, else "Desktop only — mobile coming soon"
    └── DesktopOnlyGate.module.css
```

Names follow spec §14 (`<TopBar />`, `<Sidebar />`, `<Main>`, `<MainHeader />`, `<RightPanel>`). Children of those (FlowCard, Insight, PlanView, SemRow, etc.) are not implemented this step.

**State (App.tsx, local only — no React context yet):**
- `const [isPanelOpen, setIsPanelOpen] = useState(false)`
- App's outer `<div>` className: `isPanelOpen ? styles.app : `${styles.app} ${styles.noPanel}``
- `setIsPanelOpen` passed to TopBar for the debug toggle button (removed once real panel triggers exist in later steps).

**Deletions:** Step 1's `App.css` and the placeholder JSX in `App.tsx`.

**Hard-coded placeholders:** `"Hi, Luke"` + `"LB"` avatar; `grad: —` meta. Real values land when `useStudent()` is wired.

## 5. Acceptance criteria

Manual verification only — no automated tests this step.

| # | Criterion |
|---|---|
| S2-1 | At viewport ≥ 768px, the app renders a CSS grid with cols `240px 1fr 380px` and a 56px topbar across the top. Full-height (no body scrollbar; only inner columns scroll). Maps to **UI-AC-2** (desktop half only). |
| S2-2 | At viewport < 768px, the entire UI is replaced by a centered "Desktop only — mobile coming soon" message. |
| S2-3 | Topbar renders, in order (no spaces between brand fragments): `📘 ISU` rendered in white, immediately followed by `CourseManager` rendered in gold `#ffc555` — together they read as one word `📘 ISUCourseManager` with the second half color-accented (matches v4 line 422). Then `✦ Ask AI` purple-gradient pill (`#7c3aed→#4f46e5`, radius 16px, shadow `0 2px 8px rgba(124,58,237,.3)`); then right-aligned `Hi, Luke` + `LB` 28px gold-on-navy circular avatar. Ask AI button and avatar are visible but non-interactive. |
| S2-4 | Sidebar shows bg `#fafbfc`, `border-right: 1px solid #e0e0e0`, padding 12px, with two uppercase-small-caps section labels ("My degree flows", "Insights") `#8895a4`. The "Insights" label has the small `✦ AI` purple capsule inline. Both section bodies are empty. No "Progress stats" section. |
| S2-5 | Main column shows main-header bar (10px 16px padding, `border-bottom: 1px solid #e0e0e0`) with H1 "Plan view", non-interactive `✦ Analyze flow` purple-gradient pill, right-aligned `grad: —` meta. Body below the header is empty. |
| S2-6 | Default state: right-panel column is collapsed. Grid renders as 2-column `240px 1fr`; the `.panel` element has `display: none`. |
| S2-7 | A debug `[panel]` button in the topbar toggles the panel: clicking expands the grid to `240px 1fr 380px` and mounts an empty right-panel placeholder with `border-left: 2px solid var(--panel-accent)` (defaults to `#7c3aed`). Clicking again collapses back. Body of the placeholder is empty in both states. |
| S2-8 | CSS palette tokens defined in `src/index.css` and referenced (not re-hardcoded) by component module CSS: `--navy`, `--gold`, `--ai-start`, `--ai-end`, `--border`, `--border-soft`, `--bg-app`, `--bg-sidebar`, `--text-default`, `--text-muted`, `--text-label`, `--panel-accent`. |
| S2-9 | `npm run build` exits 0 (tsc clean + vite build clean). |
| S2-10 | `npm run lint` exits 0 (ESLint clean). |
| S2-11 | `npm run dev` serves at `http://localhost:5173` and the rendered DOM visually matches S2-1 through S2-7 on a desktop browser (≥ 768px). Verified by user. |

## 6. Out-of-band notes

- **Branch strategy:** stack Step 2 commits on the current `ui-v1/step-1-scaffold` branch (no new branch). One bigger PR at the end covering multiple steps.
- **No tests:** Vitest / RTL / Storybook deferred. Manual verification only.
- **No router:** single-page render; routing added when the catalog browser screen lands (out of v1).
- **Debug toggle is temporary:** the topbar `[panel]` button exists only to verify S2-7. It gets removed once real panel-mount triggers exist (clicking a tile → action menu, clicking AI entry → AI panel, etc.).

## 7. Decisions log

| # | Decision | Rationale |
|---|---|---|
| S2-D1 | Stack on `ui-v1/step-1-scaffold` instead of branching from main | User preference: one bigger PR at the end vs. PR-per-step. Confirmed during Step 2 brainstorming. |
| S2-D2 | CSS Modules over Tailwind / styled-components / plain global CSS | Built into Vite, no extra dependency, scopes class names per component, matches the spec's per-component structure (tiles, sem-rows, panel) cleanly. |
| S2-D3 | Defer mobile responsive layout | Doubles the CSS work (hamburger drawer, swipeable column-per-semester, bottom-sheet panel). Lock-out gate is cheap; full mobile layout becomes a later step once desktop screens are real. |
| S2-D4 | Two sidebar sections, not three (drop "Progress stats") | Locked v4 mockup omits Progress stats from spec §8's three-section design. Following the locked mockup as source of truth. |
| S2-D5 | `--panel-accent` CSS variable with default `#7c3aed`, mode-overridable | v4 shows AI-mode purple; interaction-direct-manipulation shows action-menu blue `#1976d2`. Variable lets later steps override per panel mode without re-hardcoding. |
| S2-D6 | Banner row reserved in grid template (auto-height) but no banner component | Auto-row collapses to 0 when empty. Pre-laying the row avoids a grid refactor when validation banner lands in a later step. |
| S2-D7 | `isPanelOpen` as local `useState` in App, not React context | Pre-mature to introduce context for one boolean. Context (`useRightPanel`, `useStudent`, etc.) lands when there's more than one consumer or the prop-drilling hurts. |
| S2-D8 | Temporary debug `[panel]` toggle in topbar | Verifies the `.noPanel` collapse mechanism is wired. Removed once real panel triggers exist. |

## 8. Open items / next step

- None blocking Step 2. After implementation lands and S2-1..S2-11 pass, Step 3 picks up from the open Step 2 directions list in `docs/session-state.md` (MSW mock, test framework, real plan-view content, etc.).
