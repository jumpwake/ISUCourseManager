# UI v1 — Step 6 (Catalog Search) — Design Spec

**Date:** 2026-05-14
**Status:** Approved for planning
**Author:** Kevin (with Claude)
**Companion to:**
- `docs/superpowers/specs/2026-05-13-ui-v1-design.md` (UI v1 — source of truth; §10.2 slot picker mentions "Search input at top of body")
- `docs/superpowers/specs/2026-05-14-ui-v1-step-5-slot-picker-design.md` (preceding step — SlotPicker chrome + 3 visible sections)
- `docs/superpowers/mockups/ui-v1/interaction-fill-slot.html` (mockup shows `<input class="picker-search" placeholder="Search catalog…">` at line 270)

## 1. Goal

Add a single text-input search bar at the top of the SlotPicker body. As the user types, the "Add a new course from the catalog" section filters in real-time across the full 100-entry catalog (substring match on classId / display code / name / department). Empty query preserves the existing "first 8 entries" default. The section header gains a `(N matches)` count badge when the search is active.

This is the smaller half of the user's Step-5 sign-off feedback ("we need a way to search the catalog"); the bigger half — an AI conversation to help the user explore options — is deferred to a later step once MSW + AI mediation architecture lands.

## 2. Scope

### In scope
- **Search input** at the top of SlotPicker body:
  - `<input type="text" placeholder="Search catalog…">` rendered as the first child of `.body`, above the 3 existing sections.
  - 1px grey border (`var(--border)`), 4px radius, 4px 10px padding, 12px font.
  - Focus state: blue border (`#1976d2`) — uses the existing action-accent color.
  - Full width within the body padding.
- **Local search state**: `const [query, setQuery] = useState('')` inside `SlotPicker`. Trimmed only at lookup time; raw value stays in the input so trailing spaces don't snap-collapse.
- **Filter logic** on the "Add a new course from the catalog" section:
  - `query.trim()` is empty → render `Array.from(catalogById.values()).slice(0, 8)` (current Step 5 behavior preserved).
  - `query.trim()` is non-empty → lowercase substring match across `classId`, `code`, `name`, and `department`. Show **up to 20 matches** (cap to avoid scrolling overload).
  - No matches → render `<p class={styles.emptyMessage}>No courses match "{query}".</p>` inside the section (replaces the card list, not the section header).
- **Count badge on section header** when search is active:
  - Section title becomes `Add a new course from the catalog` followed by a small grey-pill badge reading `{matchCount} match{es}` (singular/plural).
  - Badge hidden when query is empty.
- **Other sections unaffected**: "Pull from a later semester" and "Leave this slot empty" continue to render as in Step 5.
- **Section helper extended**: the existing private `Section({ title, children })` helper in `SlotPicker.tsx` gains an optional `badge?: string` prop. When provided, the badge renders inline-flex next to the title.

### Out of scope
- AI suggestion cards / conversation (defer to Step 7+ with MSW + AI mediation).
- Filter applied to "Pull from a later semester" candidates.
- Highlighting matched substring in result cards.
- Recently-viewed / popular surfacing when query is empty.
- Sort by relevance (results stay in catalog declaration order).
- Keyboard navigation (Tab / arrow keys / Enter on focused card).
- Debouncing / memoization — catalog is 100 entries; per-keystroke filter is O(N) ≈ 0.1ms. Cheap enough to compute on every render.
- Clearing the input via an "×" button inside the input (defer; the input is short and clearable via select-all + backspace).

## 3. Component changes

### `SlotPicker.tsx`

- Add `useState` import (currently no state in this component).
- Add `query` state and `searchInput` JSX.
- Compute `catalogResults` derived value:
  ```ts
  const trimmed = query.trim().toLowerCase();
  const catalogResults = trimmed === ''
    ? Array.from(catalogById.values()).slice(0, 8)
    : filterCatalog(trimmed, catalogById);
  ```
  Helper `filterCatalog`:
  ```ts
  function filterCatalog(query: string, catalog: ReadonlyMap<string, Course>): Course[] {
    const matches: Course[] = [];
    for (const course of catalog.values()) {
      if (matchesQuery(course, query)) {
        matches.push(course);
        if (matches.length >= 20) break;
      }
    }
    return matches;
  }
  function matchesQuery(course: Course, q: string): boolean {
    return (
      course.classId.toLowerCase().includes(q) ||
      course.code.toLowerCase().includes(q) ||
      course.name.toLowerCase().includes(q) ||
      course.department.toLowerCase().includes(q)
    );
  }
  ```
  (Type imports gain `Course` alongside `ElectiveSlotType` + `UnfilledTile`.)
- Compute `matchCount = catalogResults.length` when query is non-empty (for the badge).
- Catalog section rendering:
  ```tsx
  <Section
    title="Add a new course from the catalog"
    badge={trimmed === '' ? undefined : `${matchCount} match${matchCount === 1 ? '' : 'es'}`}
  >
    {catalogResults.length > 0 ? (
      catalogResults.map((course) => (
        <button key={course.classId} type="button" className={styles.card}>
          {/* unchanged */}
        </button>
      ))
    ) : (
      <p className={styles.emptyMessage}>No courses match "{query.trim()}".</p>
    )}
  </Section>
  ```

### `Section` helper (in `SlotPicker.tsx`)

Extend to accept an optional badge:

```ts
function Section({ title, badge, children }: { title: string; badge?: string; children: ReactNode }) {
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>
        {title}
        {badge !== undefined && <span className={styles.sectionBadge}>{badge}</span>}
      </h3>
      {children}
    </div>
  );
}
```

### `SlotPicker.module.css`

Add 3 new rules:

```css
.searchInput {
  width: 100%;
  padding: 6px 10px;
  margin-bottom: 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 12px;
  font: inherit;
  box-sizing: border-box;
}

.searchInput:focus {
  outline: none;
  border-color: #1976d2;
}

.sectionBadge {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 6px;
  background: #e0e0e0;
  color: var(--text-label);
  font-size: 9px;
  font-weight: 700;
  border-radius: 8px;
  text-transform: none;
  letter-spacing: 0;
  vertical-align: middle;
}
```

Existing `.sectionTitle` rule unchanged.

## 4. Acceptance criteria

Manual verification only.

| # | Criterion |
|---|---|
| S6-1 | The SlotPicker body has a text input at the top with placeholder `Search catalog…`, 1px grey border. Visible immediately when an elective tile is clicked. |
| S6-2 | Input focus state: border turns blue `#1976d2`. |
| S6-3 | When the input is empty (or whitespace-only): the "Add a new course from the catalog" section shows the same 8 catalog cards as Step 5. Section header is just the title (no badge). |
| S6-4 | When the input has text (e.g., `math`): the catalog section filters in real-time. Matches found across classId / display code / name / department, case-insensitive. Up to 20 matches shown. Section header gains a small grey pill badge reading `{N} match` or `{N} matches` (singular/plural). |
| S6-5 | Typing a query with zero matches (e.g., `xyz`): the catalog section shows a centered italic message `No courses match "{trimmed query}".` Badge reads `0 matches`. |
| S6-6 | Typing a single letter narrows broadly (`m` matches all Math, ComS courses with M in name, etc.). Typing a more specific string (`calc`) narrows further. |
| S6-7 | Search is contained to the catalog section. The "Pull from a later semester" and "Leave this slot empty" sections render unchanged regardless of query. |
| S6-8 | Closing and reopening the SlotPicker (click `×`, click an elective tile) resets the query to empty — local state is fresh per mount. |
| S6-9 | Switching between elective tiles (click one elective, then another) ALSO resets the query — the component remounts when the `tile` prop changes (or at least, the visible state resets because each open is a fresh mount). |
| S6-10 | Step 4 + Step 5 + ActionMenu behaviors all preserved. Student-course clicks still open ActionMenu (with Completed-trim). Studentcourse `.selected` ring still works. |
| S6-11 | `npm run build` exits 0. |
| S6-12 | `npm run lint` exits 0. |
| S6-13 | Visual match in browser — verified by user. |

## 5. Out-of-band notes

- **Result cap = 20**: catalog has 100 entries; an unconstrained list would scroll past the panel for short queries. 20 is enough to show meaningful breadth (e.g., `math` matches ~10) without overflowing.
- **Empty-query default of 8**: unchanged from Step 5. The Step 5 cap (8) was arbitrary "enough to fill the body visually without scrolling"; Step 6 preserves it for query-less browsing.
- **No catalog category filter**: per slot type. Real category-aware filtering ("show only Math electives" for a `ElectiveMath` slot) needs catalog metadata we don't have yet — Step 7+ once the catalog data sweep lands.
- **Section helper's optional badge prop**: changes the local function signature in `SlotPicker.tsx`. Does NOT propagate to ActionMenu's `Section` helper, which is a separate file-local function (duplication noted in Step 5 follow-ups; not consolidated here).
- **Query state is component-local**: a fresh `useState('')` per mount. When the user closes + reopens the picker on the same tile, query resets. Re-mounting the component via a different tile prop (without unmounting first) wouldn't reset state — but in practice the SlotPicker is mounted conditionally via `{selected && <SlotPicker .../>}` in App.tsx, so switching between two elective tiles doesn't unmount: React reuses the instance and state persists across tile changes. **Decision**: this is fine — Step 6 doesn't try to reset query on tile switch. If it becomes annoying in practice, add `key={tile.semIdx + '-' + tileIdentity(tile)}` on the SlotPicker mount to force remount.
- **Branch**: `ui-v1/step-6-catalog-search` cut from main.
- **No tests** (still deferred).

## 6. Decisions log

| # | Decision | Rationale |
|---|---|---|
| S6-D1 | Single search input at top of body (vs. inside the catalog section header) | Matches UI spec §10.2 + the locked mockup. Visually clearer that search is a top-level affordance of the picker. |
| S6-D2 | Substring match across 4 fields (classId / code / name / department) | Covers the obvious search vectors. Users may search by code ("MATH-1650"), display name ("Calc I"), or department ("Math"). |
| S6-D3 | Result cap = 20 | Enough breadth, avoids panel overflow. Adjustable later. |
| S6-D4 | Empty query → first 8 (preserve Step 5) | Default browsing behavior unchanged. |
| S6-D5 | Count badge on section header when query is active | User-requested. Clear signal of how many matches the query produced. |
| S6-D6 | Badge text: `{N} match` / `{N} matches` (singular/plural) | English plural. Doesn't internationalize Step 6 (i18n is a separate future concern). |
| S6-D7 | Query state local to SlotPicker (vs. lifted to App) | YAGNI — only SlotPicker reads it. Local state has fewer moving parts. |
| S6-D8 | No debouncing | 100-entry catalog × per-keystroke = trivial cost. Adding debounce just adds latency for no perceptible benefit. |
| S6-D9 | Search input doesn't auto-focus on panel mount | Avoids stealing focus when user just wants to browse. Click-to-focus is fine. (Revisit if user feedback says auto-focus is desired.) |
| S6-D10 | No clear-input button | Step 6 is minimal. Select-all + backspace is fine. Easy add later. |
| S6-D11 | Don't reset query when switching between elective tiles | YAGNI. If two elective tiles are clicked in sequence, keeping the query is usually what the user wants ("I was searching for math, now show me math options for this other slot too"). Easy to flip via `key` prop later. |

## 7. Open items

- None blocking Step 6. After this step the user can search the catalog when filling a slot. Step 7+ adds the AI conversation half of the user's Step-5 feedback, which natively pairs with MSW + the `/api/v1/ai/ask` endpoint scaffold.
