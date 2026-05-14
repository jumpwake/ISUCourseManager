# UI v1 Step 2 (Layout Skeleton) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Materialize the locked v4 UI layout skeleton in `src/ISUCourseManager.Web/`: three-column CSS grid (240/1fr/380), real topbar, sidebar and main shells with section headers, and a collapsible right-panel placeholder controlled by a temporary debug toggle.

**Architecture:** React 19 + Vite 8 + TypeScript 6 SPA. Per-component CSS Modules with a small set of CSS custom properties in `src/index.css` for the palette. Local `useState` in `App.tsx` for panel-open state (no React context yet). A `<DesktopOnlyGate />` wraps the whole tree and replaces it with a "desktop only" message below 768px.

**Tech Stack:** React 19.2, TypeScript 6 (`verbatimModuleSyntax: true`, `noUnusedLocals: true`, `erasableSyntaxOnly: true` — see `tsconfig.app.json`), Vite 8, ESLint 10. No new dependencies. CSS Modules built into Vite.

**Spec:** `docs/superpowers/specs/2026-05-14-ui-v1-step-2-layout-skeleton-design.md`

**Branch:** Stack commits on the current `ui-v1/step-1-scaffold` branch per spec §6 / S2-D1.

---

## File Structure

**Create:**
- `src/ISUCourseManager.Web/src/App.module.css`
- `src/ISUCourseManager.Web/src/components/AiButton.tsx`
- `src/ISUCourseManager.Web/src/components/AiButton.module.css`
- `src/ISUCourseManager.Web/src/components/AiMark.tsx`
- `src/ISUCourseManager.Web/src/components/AiMark.module.css`
- `src/ISUCourseManager.Web/src/components/DesktopOnlyGate.tsx`
- `src/ISUCourseManager.Web/src/components/DesktopOnlyGate.module.css`
- `src/ISUCourseManager.Web/src/components/TopBar.tsx`
- `src/ISUCourseManager.Web/src/components/TopBar.module.css`
- `src/ISUCourseManager.Web/src/components/Sidebar.tsx`
- `src/ISUCourseManager.Web/src/components/Sidebar.module.css`
- `src/ISUCourseManager.Web/src/components/MainHeader.tsx`
- `src/ISUCourseManager.Web/src/components/MainHeader.module.css`
- `src/ISUCourseManager.Web/src/components/Main.tsx`
- `src/ISUCourseManager.Web/src/components/Main.module.css`
- `src/ISUCourseManager.Web/src/components/RightPanel.tsx`
- `src/ISUCourseManager.Web/src/components/RightPanel.module.css`

**Modify:**
- `src/ISUCourseManager.Web/src/index.css` — expand `:root` palette, drop `.placeholder` rules
- `src/ISUCourseManager.Web/src/App.tsx` — rewrite as grid container + state

**Delete:**
- `src/ISUCourseManager.Web/src/App.css` — superseded by `App.module.css`

---

## Notes for the executor

- **All `npm` commands run from the Web project dir.** Use `npm --prefix src/ISUCourseManager.Web run <script>` from the repo root, or `cd src/ISUCourseManager.Web` first. Examples below use `--prefix` for portability.
- **TypeScript strictness gotchas in this project (`tsconfig.app.json`):**
  - `verbatimModuleSyntax: true` — type-only imports must use `import type { ... }`.
  - `allowImportingTsExtensions: true` — keep file extensions on relative imports (`./TopBar.tsx`, not `./TopBar`). Existing `main.tsx:4` shows the convention.
  - `noUnusedLocals: true` and `noUnusedParameters: true` — no dead imports/params.
  - `erasableSyntaxOnly: true` — no enums, no namespaces, no parameter properties.
- **Existing palette tokens to replace:** `src/App.css` currently defines `--brand-navy` and `--brand-gold` in `:root`. The plan replaces them with `--navy` / `--gold` (matches the spec) and adds the rest. The `.placeholder` rules in `App.css` were Step 1 scratch content — they go away when `App.tsx` is rewritten.
- **Commit style:** existing repo uses Conventional Commits (`feat(ui): ...`, `docs(ui): ...`). Subject under 70 chars. Sign with the Co-Authored-By trailer.

---

## Pre-flight: confirm starting state

- [ ] **Step 1: Confirm branch and clean working tree**

Run:
```
git status
git rev-parse --abbrev-ref HEAD
```

Expected: branch is `ui-v1/step-1-scaffold`. Working tree clean (or only `.claude/` untracked, which is expected and intentionally not committed).

- [ ] **Step 2: Confirm Step 1 scaffold still builds**

Run:
```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0. `vite build` reports something like "✓ 17 modules transformed" with no TypeScript errors.

---

## Task 1: Expand palette tokens in `index.css`

**Files:**
- Modify: `src/ISUCourseManager.Web/src/index.css`

- [ ] **Step 1: Rewrite `src/ISUCourseManager.Web/src/index.css`**

Replace the entire file with:

```css
*, *::before, *::after {
  box-sizing: border-box;
}

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
  --panel-accent: var(--ai-start);
}

body {
  margin: 0;
  font-family: -apple-system, "Segoe UI", system-ui, sans-serif;
  color: var(--text-default);
  background: var(--bg-app);
  font-size: 13px;
}
```

- [ ] **Step 2: Verify build still passes**

Run:
```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0 (Step 1's `App.tsx` still imports `App.css` which still exists; build remains green).

- [ ] **Step 3: Commit**

```
git add src/ISUCourseManager.Web/src/index.css
git commit -m "feat(ui): add palette tokens to index.css"
```

---

## Task 2: Create the shared `<AiButton />` component

The purple-gradient `✦ <label>` pill is used in two places: TopBar ("Ask AI", size `md`) and MainHeader ("Analyze flow", size `sm`). One component with a `size` prop.

**Files:**
- Create: `src/ISUCourseManager.Web/src/components/AiButton.tsx`
- Create: `src/ISUCourseManager.Web/src/components/AiButton.module.css`

- [ ] **Step 1: Create `AiButton.module.css`**

```css
.btn {
  background: linear-gradient(135deg, var(--ai-start) 0%, var(--ai-end) 100%);
  color: white;
  border: none;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btn:hover {
  transform: translateY(-1px);
}

.md {
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 12px;
  box-shadow: 0 2px 8px rgba(124, 58, 237, 0.3);
}

.sm {
  padding: 5px 12px;
  border-radius: 14px;
  font-size: 11px;
  box-shadow: 0 2px 6px rgba(124, 58, 237, 0.25);
}

.sparkle {
  font-size: 1.08em;
}
```

- [ ] **Step 2: Create `AiButton.tsx`**

```tsx
import styles from './AiButton.module.css';

type Props = {
  label: string;
  size?: 'sm' | 'md';
};

export function AiButton({ label, size = 'md' }: Props) {
  return (
    <button type="button" className={`${styles.btn} ${styles[size]}`}>
      <span className={styles.sparkle}>✦</span>
      {label}
    </button>
  );
}
```

- [ ] **Step 3: Verify build (the new file is not imported anywhere yet, but TypeScript still checks it)**

Run:
```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0. No type errors in `AiButton.tsx`.

- [ ] **Step 4: Commit**

```
git add src/ISUCourseManager.Web/src/components/AiButton.tsx src/ISUCourseManager.Web/src/components/AiButton.module.css
git commit -m "feat(ui): add shared AiButton purple-gradient pill"
```

---

## Task 3: Create the shared `<AiMark />` capsule

Tiny "✦ AI" label used in the sidebar Insights heading.

**Files:**
- Create: `src/ISUCourseManager.Web/src/components/AiMark.tsx`
- Create: `src/ISUCourseManager.Web/src/components/AiMark.module.css`

- [ ] **Step 1: Create `AiMark.module.css`**

```css
.mark {
  background: linear-gradient(135deg, var(--ai-start) 0%, var(--ai-end) 100%);
  color: white;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.3px;
  padding: 1px 6px;
  border-radius: 8px;
  text-transform: none;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.mark::before {
  content: "✦";
  font-size: 10px;
}
```

- [ ] **Step 2: Create `AiMark.tsx`**

```tsx
import styles from './AiMark.module.css';

export function AiMark() {
  return <span className={styles.mark}>AI</span>;
}
```

- [ ] **Step 3: Verify build**

Run:
```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```
git add src/ISUCourseManager.Web/src/components/AiMark.tsx src/ISUCourseManager.Web/src/components/AiMark.module.css
git commit -m "feat(ui): add shared AiMark capsule"
```

---

## Task 4: Create the `<DesktopOnlyGate />` wrapper

Renders children when viewport ≥ 768px, otherwise renders a centered "Desktop only — mobile coming soon" message. Uses `window.matchMedia` with a `change` listener to react to viewport resizes without a re-render glitch.

**Files:**
- Create: `src/ISUCourseManager.Web/src/components/DesktopOnlyGate.tsx`
- Create: `src/ISUCourseManager.Web/src/components/DesktopOnlyGate.module.css`

- [ ] **Step 1: Create `DesktopOnlyGate.module.css`**

```css
.gate {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: var(--bg-app);
}

.message {
  text-align: center;
}

.message h1 {
  color: var(--navy);
  font-size: 1.5rem;
  margin: 0 0 0.5rem;
}

.message p {
  color: var(--text-label);
  font-size: 1rem;
  margin: 0;
}
```

- [ ] **Step 2: Create `DesktopOnlyGate.tsx`**

Note: this project has `verbatimModuleSyntax: true`, so `ReactNode` must be imported as `import type`.

```tsx
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import styles from './DesktopOnlyGate.module.css';

type Props = {
  children: ReactNode;
};

const QUERY = '(min-width: 768px)';

export function DesktopOnlyGate({ children }: Props) {
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia(QUERY).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  if (!isDesktop) {
    return (
      <div className={styles.gate}>
        <div className={styles.message}>
          <h1>Desktop only</h1>
          <p>Mobile coming soon.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
```

- [ ] **Step 3: Verify build**

Run:
```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```
git add src/ISUCourseManager.Web/src/components/DesktopOnlyGate.tsx src/ISUCourseManager.Web/src/components/DesktopOnlyGate.module.css
git commit -m "feat(ui): add DesktopOnlyGate wrapper for sub-768px viewports"
```

---

## Task 5: Create the `<TopBar />` component

The 56px navy header: brand, `Ask AI` button, debug panel-toggle, right-aligned student greeting + avatar. Receives `isPanelOpen` + `onTogglePanel` from `App.tsx`.

**Files:**
- Create: `src/ISUCourseManager.Web/src/components/TopBar.tsx`
- Create: `src/ISUCourseManager.Web/src/components/TopBar.module.css`

- [ ] **Step 1: Create `TopBar.module.css`**

```css
.topbar {
  grid-area: topbar;
  background: var(--navy);
  color: #f0f4f8;
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 16px;
}

.brand {
  font-weight: 700;
  font-size: 14px;
}

.accent {
  color: var(--gold);
}

.debugToggle {
  background: transparent;
  color: #cfd8dc;
  border: 1px solid #5a6573;
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 11px;
  cursor: pointer;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.debugToggle:hover {
  background: rgba(255, 255, 255, 0.08);
}

.student {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #cfd8dc;
}

.avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--gold);
  color: var(--navy);
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
}
```

- [ ] **Step 2: Create `TopBar.tsx`**

```tsx
import { AiButton } from './AiButton.tsx';
import styles from './TopBar.module.css';

type Props = {
  isPanelOpen: boolean;
  onTogglePanel: () => void;
};

export function TopBar({ isPanelOpen, onTogglePanel }: Props) {
  return (
    <header className={styles.topbar}>
      <div className={styles.brand}>
        📘 ISU<span className={styles.accent}>CourseManager</span>
      </div>
      <AiButton label="Ask AI" />
      <button
        type="button"
        className={styles.debugToggle}
        onClick={onTogglePanel}
        aria-label="Toggle right panel (debug)"
      >
        {isPanelOpen ? '[panel ✓]' : '[panel]'}
      </button>
      <div className={styles.student}>
        <span>Hi, Luke</span>
        <div className={styles.avatar}>LB</div>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Verify build**

Run:
```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```
git add src/ISUCourseManager.Web/src/components/TopBar.tsx src/ISUCourseManager.Web/src/components/TopBar.module.css
git commit -m "feat(ui): add TopBar with brand, Ask AI, debug toggle, avatar"
```

---

## Task 6: Create the `<Sidebar />` component

Two empty section labels: "My degree flows" and "Insights" (with `<AiMark />` inline). No flow cards, no insights this step.

**Files:**
- Create: `src/ISUCourseManager.Web/src/components/Sidebar.tsx`
- Create: `src/ISUCourseManager.Web/src/components/Sidebar.module.css`

- [ ] **Step 1: Create `Sidebar.module.css`**

```css
.sidebar {
  grid-area: sidebar;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-soft);
  padding: 12px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section {
  font-size: 11px;
}

.label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  font-weight: 700;
  margin-bottom: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
```

- [ ] **Step 2: Create `Sidebar.tsx`**

```tsx
import { AiMark } from './AiMark.tsx';
import styles from './Sidebar.module.css';

export function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <section className={styles.section}>
        <div className={styles.label}>My degree flows</div>
      </section>
      <section className={styles.section}>
        <div className={styles.label}>
          <span>Insights</span>
          <AiMark />
        </div>
      </section>
    </aside>
  );
}
```

- [ ] **Step 3: Verify build**

Run:
```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```
git add src/ISUCourseManager.Web/src/components/Sidebar.tsx src/ISUCourseManager.Web/src/components/Sidebar.module.css
git commit -m "feat(ui): add Sidebar with empty My-flows and Insights sections"
```

---

## Task 7: Create the `<MainHeader />` component

The bar at the top of the main column: H1 "Plan view", `Analyze flow` AI button (size `sm`), and right-aligned `grad: —` meta.

**Files:**
- Create: `src/ISUCourseManager.Web/src/components/MainHeader.tsx`
- Create: `src/ISUCourseManager.Web/src/components/MainHeader.module.css`

- [ ] **Step 1: Create `MainHeader.module.css`**

```css
.header {
  background: var(--bg-app);
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-soft);
  display: flex;
  align-items: center;
  gap: 12px;
}

.title {
  font-size: 14px;
  margin: 0;
  flex-grow: 1;
}

.meta {
  font-size: 11px;
  color: var(--text-muted);
}
```

- [ ] **Step 2: Create `MainHeader.tsx`**

```tsx
import { AiButton } from './AiButton.tsx';
import styles from './MainHeader.module.css';

export function MainHeader() {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>Plan view</h1>
      <AiButton label="Analyze flow" size="sm" />
      <div className={styles.meta}>grad: —</div>
    </header>
  );
}
```

- [ ] **Step 3: Verify build**

Run:
```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```
git add src/ISUCourseManager.Web/src/components/MainHeader.tsx src/ISUCourseManager.Web/src/components/MainHeader.module.css
git commit -m "feat(ui): add MainHeader with title, Analyze-flow button, grad meta"
```

---

## Task 8: Create the `<Main />` column

Wraps `<MainHeader />` and an empty body region. Lives in the `main` grid area.

**Files:**
- Create: `src/ISUCourseManager.Web/src/components/Main.tsx`
- Create: `src/ISUCourseManager.Web/src/components/Main.module.css`

- [ ] **Step 1: Create `Main.module.css`**

```css
.main {
  grid-area: main;
  overflow-y: auto;
  background: var(--bg-app);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.body {
  flex-grow: 1;
}
```

- [ ] **Step 2: Create `Main.tsx`**

```tsx
import { MainHeader } from './MainHeader.tsx';
import styles from './Main.module.css';

export function Main() {
  return (
    <main className={styles.main}>
      <MainHeader />
      <div className={styles.body} />
    </main>
  );
}
```

- [ ] **Step 3: Verify build**

Run:
```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```
git add src/ISUCourseManager.Web/src/components/Main.tsx src/ISUCourseManager.Web/src/components/Main.module.css
git commit -m "feat(ui): add Main column wrapping MainHeader and empty body"
```

---

## Task 9: Create the `<RightPanel />` component

Empty placeholder body with the mode-overridable purple `border-left`. Accepts a `hidden` prop so `App.tsx` can satisfy spec criterion S2-6 (`display: none` when collapsed) without unmounting.

**Files:**
- Create: `src/ISUCourseManager.Web/src/components/RightPanel.tsx`
- Create: `src/ISUCourseManager.Web/src/components/RightPanel.module.css`

- [ ] **Step 1: Create `RightPanel.module.css`**

```css
.panel {
  grid-area: panel;
  background: var(--bg-app);
  border-left: 2px solid var(--panel-accent);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.hidden {
  display: none;
}
```

- [ ] **Step 2: Create `RightPanel.tsx`**

```tsx
import styles from './RightPanel.module.css';

type Props = {
  hidden?: boolean;
};

export function RightPanel({ hidden = false }: Props) {
  const className = hidden ? `${styles.panel} ${styles.hidden}` : styles.panel;
  return <aside className={className} />;
}
```

- [ ] **Step 3: Verify build**

Run:
```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```
git add src/ISUCourseManager.Web/src/components/RightPanel.tsx src/ISUCourseManager.Web/src/components/RightPanel.module.css
git commit -m "feat(ui): add RightPanel placeholder with mode-overridable accent"
```

---

## Task 10: Create `App.module.css` (grid template + `.noPanel` modifier)

The grid container styles. Note: the `.noPanel` modifier hides the panel via the panel's own `.hidden` class (Task 9) — not via cross-module `:global` selectors — so this module only owns the grid template.

**Files:**
- Create: `src/ISUCourseManager.Web/src/App.module.css`

- [ ] **Step 1: Create `App.module.css`**

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

.noPanel {
  grid-template-columns: 240px 1fr;
  grid-template-areas:
    "topbar  topbar"
    "sidebar banner"
    "sidebar main";
}
```

- [ ] **Step 2: Verify build (the file is not imported yet but TypeScript / Vite should not error on it)**

Run:
```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0. (Vite ignores unimported CSS modules.)

- [ ] **Step 3: Commit**

```
git add src/ISUCourseManager.Web/src/App.module.css
git commit -m "feat(ui): add App grid template with noPanel modifier"
```

---

## Task 11: Rewrite `App.tsx`, delete `App.css`

Replace the Step 1 placeholder with the full grid composition: `<DesktopOnlyGate>` wraps the grid; `<TopBar />`, `<Sidebar />`, `<Main />`, and `<RightPanel />` fill their grid areas; `isPanelOpen` state drives the `.noPanel` modifier on the grid and the `hidden` prop on `<RightPanel />`.

**Files:**
- Modify: `src/ISUCourseManager.Web/src/App.tsx`
- Delete: `src/ISUCourseManager.Web/src/App.css`

- [ ] **Step 1: Rewrite `App.tsx`**

```tsx
import { useState } from 'react';
import { DesktopOnlyGate } from './components/DesktopOnlyGate.tsx';
import { TopBar } from './components/TopBar.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { Main } from './components/Main.tsx';
import { RightPanel } from './components/RightPanel.tsx';
import styles from './App.module.css';

function App() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const appClassName = isPanelOpen
    ? styles.app
    : `${styles.app} ${styles.noPanel}`;

  return (
    <DesktopOnlyGate>
      <div className={appClassName}>
        <TopBar
          isPanelOpen={isPanelOpen}
          onTogglePanel={() => setIsPanelOpen((open) => !open)}
        />
        <Sidebar />
        <Main />
        <RightPanel hidden={!isPanelOpen} />
      </div>
    </DesktopOnlyGate>
  );
}

export default App;
```

- [ ] **Step 2: Delete `App.css`**

Run:
```
git rm src/ISUCourseManager.Web/src/App.css
```

Expected: file removed and staged for deletion.

- [ ] **Step 3: Verify build**

Run:
```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0. No "App.css not found" errors (the old `import './App.css'` line is gone from `App.tsx`).

- [ ] **Step 4: Verify lint**

Run:
```
npm --prefix src/ISUCourseManager.Web run lint
```

Expected: exit 0. No ESLint errors or warnings.

- [ ] **Step 5: Commit**

```
git add src/ISUCourseManager.Web/src/App.tsx
git commit -m "feat(ui): wire App grid with TopBar, Sidebar, Main, RightPanel"
```

---

## Task 12: Manual verification (acceptance criteria S2-1..S2-11)

No automated tests this step — verify in the browser.

- [ ] **Step 1: Start dev server**

Run:
```
npm --prefix src/ISUCourseManager.Web run dev
```

Expected: Vite reports `Local: http://localhost:5173/`. Leave running.

- [ ] **Step 2: Verify desktop layout (≥ 768px)**

Open `http://localhost:5173` in a browser at a desktop window width.

Check each criterion:
- [ ] **S2-1** App is a 2-column grid by default: `240px | 1fr`, with a 56px topbar across the top. Full viewport height; no outer scrollbar.
- [ ] **S2-3** Topbar shows `📘 ISUCourseManager` (with `CourseManager` in gold, no space between fragments), then `✦ Ask AI` purple-gradient pill, then a `[panel]` debug button, then right-aligned `Hi, Luke` + gold-on-navy `LB` avatar.
- [ ] **S2-4** Sidebar bg is light grey `#fafbfc`, has right border, shows two uppercase small-caps labels: "MY DEGREE FLOWS" and "INSIGHTS" with the small purple "✦ AI" capsule beside Insights. Both section bodies are empty.
- [ ] **S2-5** Main column shows a header row with H1 "Plan view", `✦ Analyze flow` purple pill, and right-aligned `grad: —`. Body is empty below.
- [ ] **S2-6** Right-panel column is NOT visible by default (grid is 2-column).

- [ ] **Step 3: Verify panel toggle (S2-7)**

Click the `[panel]` button in the topbar.

Expected:
- Grid becomes 3-column: a 380px right column appears containing an empty white area with a 2px purple `#7c3aed` left border.
- The toggle's text changes to `[panel ✓]`.
- Click again — the panel disappears and the grid reverts to 2-column.

- [ ] **Step 4: Verify palette tokens (S2-8)**

Open browser devtools → Elements → inspect `:root`. Confirm all of these CSS custom properties exist with the documented values:
- `--navy`, `--gold`, `--ai-start`, `--ai-end`, `--border`, `--border-soft`, `--bg-app`, `--bg-sidebar`, `--text-default`, `--text-muted`, `--text-label`, `--panel-accent`.

Spot-check the topbar's computed `background` — should resolve to `rgb(31, 59, 93)` (which is `#1f3b5d`, i.e., `--navy`).

- [ ] **Step 5: Verify mobile gate (S2-2)**

Resize the browser to < 768px (or use devtools device toolbar).

Expected: the entire UI is replaced by a centered "Desktop only" heading + "Mobile coming soon." subtext on a white background.

Resize back above 768px → desktop layout returns.

- [ ] **Step 6: Verify build + lint clean (S2-9, S2-10)**

Stop the dev server (Ctrl-C in the terminal where it's running). Then run:
```
npm --prefix src/ISUCourseManager.Web run build
npm --prefix src/ISUCourseManager.Web run lint
```

Expected: both exit 0. `build` reports something like "✓ N modules transformed".

- [ ] **Step 7: Final commit (Step 2 boundary)**

If steps 1–6 all pass, no further code changes are needed — every component already landed in its own task commit. Push the branch to make Step 2 visible:

```
git status
git log --oneline ui-v1/step-1-scaffold ^main
git push origin ui-v1/step-1-scaffold
```

Expected `git status`: clean working tree. `git log` shows the 11 new commits (Tasks 1–11) on top of the Step 1 commit. `git push` succeeds.

Then update `docs/session-state.md` to reflect Step 2 completion — but only after the user confirms the manual verification passed. (Editing `session-state.md` is a non-code change; do it as a single small commit on top.)

---

## Self-review (writer's checklist)

**Spec coverage:**

| Spec criterion | Implemented in |
|---|---|
| S2-1 (3-col grid, 56px topbar, full-height) | Tasks 10, 11; verified in Task 12 step 2 |
| S2-2 (<768px desktop-only message) | Task 4 (`DesktopOnlyGate`), Task 11 (App wraps); verified in Task 12 step 5 |
| S2-3 (topbar brand + Ask AI + avatar) | Tasks 2 (`AiButton`), 5 (`TopBar`); verified in Task 12 step 2 |
| S2-4 (sidebar two-section labels + AiMark) | Tasks 3 (`AiMark`), 6 (`Sidebar`); verified in Task 12 step 2 |
| S2-5 (main-header H1 + Analyze flow + grad meta) | Tasks 7 (`MainHeader`), 8 (`Main`); verified in Task 12 step 2 |
| S2-6 (panel collapsed by default) | Tasks 9 (`RightPanel.hidden`), 11 (`App` passes `hidden={!isPanelOpen}` + applies `.noPanel`); verified in Task 12 step 2 |
| S2-7 (debug toggle expands/collapses panel) | Tasks 5 (`TopBar` debug button), 11 (`App` state); verified in Task 12 step 3 |
| S2-8 (palette tokens in `index.css`) | Task 1; verified in Task 12 step 4 |
| S2-9 (`npm run build` clean) | Run after every task; final in Task 12 step 6 |
| S2-10 (`npm run lint` clean) | Task 11 step 4; final in Task 12 step 6 |
| S2-11 (`npm run dev` and visual match) | Task 12 steps 1–5 |

All 11 criteria are covered by at least one task and one verification step.

**Placeholder scan:** no "TBD", "TODO", or "implement later" entries. Every step has either complete code, a complete command, or a verification check with expected output.

**Type / name consistency:**
- `AiButton` props: `{ label: string; size?: 'sm' | 'md' }` — used in `TopBar` (`<AiButton label="Ask AI" />` defaults to `md`) and `MainHeader` (`<AiButton label="Analyze flow" size="sm" />`). Consistent.
- `RightPanel` prop: `hidden?: boolean` — used in `App.tsx` as `hidden={!isPanelOpen}`. Consistent.
- `TopBar` props: `{ isPanelOpen: boolean; onTogglePanel: () => void }` — used in `App.tsx`. Consistent.
- `DesktopOnlyGate` prop: `{ children: ReactNode }` — used in `App.tsx`. Consistent.
- CSS variable names: `--navy`, `--gold`, `--ai-start`, `--ai-end`, `--border`, `--border-soft`, `--bg-app`, `--bg-sidebar`, `--text-default`, `--text-muted`, `--text-label`, `--panel-accent` — defined in Task 1, referenced throughout. Consistent.
- File extensions on imports: every relative import uses `.tsx` (per `allowImportingTsExtensions: true`). Consistent.
- Import styles: `ReactNode` imported via `import type` in `DesktopOnlyGate.tsx` (required by `verbatimModuleSyntax: true`). Consistent with project tsconfig.

No drift found.
