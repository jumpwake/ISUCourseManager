# UI v1 — Step 7 (AI Chat — Slot Scope, Stubbed) — Design Spec

**Date:** 2026-05-14
**Status:** Approved for planning
**Author:** Kevin (with Claude)
**Companion to:**
- `docs/superpowers/specs/2026-05-13-ui-v1-design.md` (UI v1 — source of truth; §10.3 AI panel, §11 AI architecture, §15 `useAi(scope)` sketch)
- `docs/superpowers/specs/2026-05-14-ui-v1-step-6-catalog-search-design.md` (preceding step — SlotPicker search input)
- `docs/superpowers/mockups/ui-v1/tightened-desktop-v4.html` (locked AI panel chrome — lines 252–409)

## 1. Goal

Land the first AI-mediated UX surface in the app: a chat panel that opens from inside the slot picker to help the student decide what to put in an open slot. The implementation is **fully stubbed** — a `useAi(scope)` hook returns hardcoded sample messages, suggestions, and quick-ask chips. No Anthropic calls, no MSW, no real backend. The point is to land the visual chrome + interaction shape so the eventual real-AI integration is a hook-internal swap, not a UI rewrite.

Addresses the user's repeated sign-off feedback from Steps 5 and 6 ("we need a way to … have a conversation with the user about what they like and maybe want to take" + "an AI chat when trying to fill a slot and you need help").

## 2. Scope

### In scope
- **New `<AiPanel />` component** rendering the locked v4 AI panel chrome (mockup lines 252–409). Header with `[✦ AI]` capsule + title + scope chip + close `×`; flat-typography message blocks; purple-gradient suggestion cards; footer with text input + `Ask` send button + 3 quick-ask chips.
- **New stubbed `useAi(scope)` hook** at `src/data/useAi.ts`:
  - Signature: `useAi(scope: AiScope): { messages: AiMessage[]; suggestions: AiSuggestion[]; quickAsks: string[]; send: (userText: string) => void; }`.
  - `messages` initialized from a per-scope-kind seed (different copy for `unfilledDegreeSlot` vs. `electiveSlot`); held in local `useState` so `send` can append.
  - `suggestions` and `quickAsks` are static arrays (no state). Hardcoded sample data per scope kind.
  - `send(text)`: appends a `{ role: 'user' }` message + a canned `{ role: 'ai' }` reply. No real input parsing.
- **Entry point from SlotPicker**: a `✦ Ask AI for help` button styled like `<AiButton size="md">`, placed at the **very top** of the slot-picker body (above the search input from Step 6). Clicking calls a new `onAskAi` prop, which App resolves to a state transition.
- **App state widens**: `SelectedPanel` union gains a third branch `{ kind: 'aiPanel'; tile: UnfilledTile }`. New handler `handleAskAi(tile)` swaps `selected` from `slotPicker` → `aiPanel`. New mount branch in the right-panel JSX renders `<RightPanel accent="ai"><AiPanel tile={selected.tile} onClose={handleClose} /></RightPanel>`.
- **`<RightPanel accent="ai">`** finally gets exercised — Step 2 scaffolded the `'ai'` variant of the accent prop; Step 7 actually uses it. The left-border resolves to `var(--ai-start)` (purple `#7c3aed`) via the existing `.accentAi` CSS class.
- **Close from AI panel** = closes the panel entirely (clears `selected`). NOT "back to slot picker". User can re-click the elective tile to reopen slot picker.
- **Scope chip content**:
  - `electiveSlot`: `Sem {N} · {electiveLabel} · {requiredCredits}cr` (e.g., `Sem 8 · Tech Elec · 3cr`).
  - `unfilledDegreeSlot`: `Sem {N} · {code}` (e.g., `Sem 4 · CYB E 2310`).

### Out of scope
- Real Anthropic / API calls. The hook is 100% stubbed.
- Other AI scope levels (global from topbar `Ask AI`, flow from main-header `Analyze flow`, semester from sem-row `✦`). Those buttons stay no-op stubs until a later step adds those scopes.
- AI suggestion section INSIDE the slot picker (per spec §10.2). The user explicitly asked for "chat", so we go straight to the panel mode. The inline section is deferred.
- Streaming / loading states / 3-dot pulsing indicator / error block with retry.
- Token usage / latency display.
- Persisting conversation across panel close/reopen (intentional — fresh start each session per spec §10.3).
- Markdown rendering in messages (plain text + JSX bold via a small heuristic — see §5.2).
- Auto-focus on the text input when the panel mounts (defer; user can click in).
- Keyboard nav (Esc to close, Enter to send is the only keyboard behavior in scope).

## 3. Frontend types

Add to `src/data/types.ts`:

```ts
export type AiMessage =
  | { role: 'ai'; lead?: string; content: string }
  | { role: 'user'; content: string };

export type AiSuggestion = {
  id: string;                 // unique key for React; e.g., 'psych-2300'
  name: string;               // e.g., 'PSYCH 2300 · Intro to Psychology'
  meta: string;               // e.g., '3 cr · F/S/Su · no prereq'
  rationale: string;          // e.g., 'Most-picked Gen Ed among CybE majors (89% of cohort).'
  isRecommended?: boolean;    // true ⇒ purple wash + ✦ prefix
  primaryActionLabel: string; // e.g., 'Add to slot'  (no-op in Step 7)
};

export type AiScope =
  | { kind: 'slot'; tile: UnfilledTile };
// Future: { kind: 'global' } | { kind: 'flow'; flowCode: string } | { kind: 'semester'; semIdx: number }
```

Extend `SelectedPanel` (currently inline in `App.tsx`):

```ts
type SelectedPanel =
  | { kind: 'actionMenu'; tile: StudentCoursePlanTile }
  | { kind: 'slotPicker'; tile: UnfilledTile }
  | { kind: 'aiPanel'; tile: UnfilledTile };
```

(`tile: UnfilledTile` matches the `slotPicker` branch — AI panel currently only opens from slot picker, so the tile carries the slot context.)

## 4. `useAi(scope)` hook contract + stub responses

`src/data/useAi.ts`:

```ts
import { useState } from 'react';
import type { AiMessage, AiScope, AiSuggestion, UnfilledTile } from './types.ts';

export function useAi(scope: AiScope): {
  messages: AiMessage[];
  suggestions: AiSuggestion[];
  quickAsks: string[];
  send: (userText: string) => void;
} {
  const [messages, setMessages] = useState<AiMessage[]>(() => initialMessages(scope));

  const send = (userText: string) => {
    const trimmed = userText.trim();
    if (trimmed.length === 0) return;
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: trimmed },
      { role: 'ai', content: cannedReply(trimmed) },
    ]);
  };

  return {
    messages,
    suggestions: suggestionsForScope(scope),
    quickAsks: quickAsksForScope(scope),
    send,
  };
}

function initialMessages(scope: AiScope): AiMessage[] {
  const tile = scope.tile;
  if (tile.kind === 'electiveSlot') {
    return [{
      role: 'ai',
      lead: 'Reading your plan',
      content: `Looking at your plan, this **${electiveLabelLong(tile.slotType)}** slot in Sem ${tile.semIdx} is open. Below are a few candidates that fit your major and term workload. I can also pull alternatives — ask me anything.`,
    }];
  }
  return [{
    role: 'ai',
    lead: 'Reading your plan',
    content: `This is your **${tile.code} · ${tile.name}** slot. I can suggest alternatives, help you decide whether to defer it, or compare what other CybE students did. Ask me anything.`,
  }];
}

function suggestionsForScope(_scope: AiScope): AiSuggestion[] {
  return [
    {
      id: 'psych-2300',
      name: 'PSYCH 2300 · Intro to Psychology',
      meta: '3 cr · F/S/Su · no prereq',
      rationale: 'Most-picked Gen Ed among CybE majors (89% of cohort). Cognitive-bias coverage is useful for security work; light reading load.',
      isRecommended: true,
      primaryActionLabel: 'Add to slot',
    },
    {
      id: 'phil-2300',
      name: 'PHIL 2300 · Moral Theory & Practice',
      meta: '3 cr · F/S · no prereq',
      rationale: 'Pairs well with CYBE 2340 (Ethics in Security) — gives you philosophical grounding ahead of time. Discussion-heavy, no exams.',
      primaryActionLabel: 'Add to slot',
    },
    {
      id: 'hist-2010',
      name: 'HIST 2010 · Western Civ I',
      meta: '3 cr · F/S · no prereq',
      rationale: 'Counts toward both Gen Ed and U.S. Cultures. Lecture-based; manageable workload.',
      primaryActionLabel: 'Add to slot',
    },
  ];
}

function quickAsksForScope(_scope: AiScope): string[] {
  return [
    'What pairs with this term?',
    'Lighter workload options',
    'Compare alternatives',
  ];
}

function cannedReply(_userText: string): string {
  return 'Got it — let me pull a few angles for you. (Real AI replies land in a later step; this is a stubbed response so you can exercise the conversation surface.)';
}

function electiveLabelLong(slotType: ElectiveSlotType): string {
  switch (slotType) {
    case 'ElectiveGenEd': return 'Gen Ed Elective';
    case 'ElectiveMath': return 'Math Elective';
    case 'ElectiveTech': return 'Tech Elective';
    case 'ElectiveCybE': return 'CybE Elective';
    case 'ElectiveCprE': return 'CprE Elective';
  }
}
```

**Note on the `cannedReply`**: it intentionally returns the same string regardless of input. Real branching on user text is a real-AI concern, not a stub one. The visible behavior the user gets: typing anything + clicking `Ask` adds their message to the conversation and shows a canned acknowledgement reply below. That proves the conversation surface works end-to-end.

## 5. Visual / chrome details

### 5.1 Header

Per v4 mockup lines 252–292:

```
┌───────────────────────────────────────────────┐
│ [✦ AI]  Help filling this slot   [scope] ×    │
│ Sem 8 · Tech Elec · 3cr                       │
└───────────────────────────────────────────────┘
```

- Background: `linear-gradient(135deg, #faf5ff 0%, #f5f3ff 100%)`.
- Border-bottom: `1px solid #c4b5fd`.
- `[✦ AI]` capsule: purple-gradient (`#7c3aed → #4f46e5`), white text, `✦` prefix via `::before`.
- Title text: `Help filling this slot` (font 13, weight 700, color `#1f2328`).
- Scope chip (right of title, before close): white bg, purple border `#c4b5fd`, color `#5b21b6`, font 10, padding `2px 8px`, radius 10.
- Close `×`: color `#5b21b6` (purple), font 16, transparent bg.

### 5.2 Body — message blocks

Per v4 mockup lines 299–306. Flat typography, NO chat bubbles. Each message is a vertical stack with a thin bottom border separating turns.

- **AI messages**: optional `lead` line in muted grey small caps (10px) above the main content; main content uses purple `#5b21b6` for words wrapped in `**...**`. Render `**X**` as `<strong>X</strong>` via a tiny inline parser (no library — split on `**`, render alternating spans bold).
- **User messages**: same flat layout but with a small `You` label as the lead, and main content in default `#1f2328`. No emphasis parsing for user input (treat as plain text).

```css
.msg {
  padding: 10px 0;
  font-size: 12px;
  line-height: 1.55;
  color: #1f2328;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 12px;
}
.msg .lead {
  font-size: 11px;
  color: #5a6573;
  margin-bottom: 6px;
}
.msg .userLead { color: #5b21b6; }  /* distinguish "You" leads */
.msg strong { color: #5b21b6; font-weight: 700; }  /* AI emphasis */
```

### 5.3 Body — suggestion cards

Per v4 mockup lines 309–350. After the initial AI message, render `suggestions` as a stacked list:

```
┌───────────────────────────────────────────────┐
│ ✦ PSYCH 2300 · Intro to Psychology   3cr · …  │   ← recommended (purple wash)
│   Most-picked Gen Ed among CybE majors…       │
│   [Add to slot]  Why?                         │
├───────────────────────────────────────────────┤
│ PHIL 2300 · Moral Theory & Practice           │
│   Pairs well with CYBE 2340 (Ethics)…         │
│   [Add to slot]  Why?                         │
├───────────────────────────────────────────────┤
│ HIST 2010 · Western Civ I                     │
│   Counts toward Gen Ed and U.S. Cultures…     │
│   [Add to slot]  Why?                         │
└───────────────────────────────────────────────┘
```

- Card: 1px grey border, 3px left border `transparent` by default. Hover or `.recommended` ⇒ left border purple `#7c3aed` + bg `#faf5ff`.
- `.recommended` cards have a `✦ ` prefix on the name (purple).
- Primary action button (`Add to slot`): purple-gradient pill (same style as `<AiButton size="sm">`). **No-op stub** in Step 7.
- Ghost action button (`Why?`): transparent bg, color `#5b21b6`, hover bg `#faf5ff`. No-op.

### 5.4 Body layout order

The body renders top-to-bottom in this fixed order:
1. Initial AI message (from `messages[0]` — always present).
2. Suggestion cards block (from `suggestions` — static).
3. Subsequent conversation turns (from `messages[1..]` — appended by `send`).

Suggestions stay pinned to their position after the first AI message; user turns + canned AI replies grow below them. The whole body has `overflow-y: auto` so older content scrolls.

### 5.5 Footer — text input + quick-asks

Per v4 mockup lines 376–403:

```
┌───────────────────────────────────────────────┐
│ [Ask about this slot…              ] [ Ask ]  │
│ [What pairs with this term?] [Lighter…] […]   │
└───────────────────────────────────────────────┘
```

- Input row: 1px grey border, focuses to purple `#7c3aed`. Padding `4px 6px 4px 10px`. Input is borderless inside the row.
- `Ask` send button: purple gradient pill, font 11, weight 600.
- Quick-ask chips below: small grey-bordered pills (`<button>`), font 10, hover bg `#faf5ff` + border `#c4b5fd` + color `#5b21b6`.

### 5.6 Send behavior

`Ask` button is enabled when the input has any non-whitespace content. Click (or Enter keypress in the input):
1. Calls `useAi`'s `send(inputValue)`.
2. Hook trims, appends user message + canned AI reply to `messages`.
3. AiPanel re-renders, both new messages appear.
4. Input clears (via `setInputValue('')` after `send`).

Quick-ask chip click:
1. Treats the chip's text as the user message.
2. Calls `send(chipText)`.
3. Same flow as above. Input stays empty.

The conversation can grow arbitrarily long; the body has `overflow-y: auto` so older messages scroll up.

## 6. App-level wiring

```tsx
type SelectedPanel =
  | { kind: 'actionMenu'; tile: StudentCoursePlanTile }
  | { kind: 'slotPicker'; tile: UnfilledTile }
  | { kind: 'aiPanel'; tile: UnfilledTile };

// in App component:
const handleAskAi = (tile: UnfilledTile) => {
  setSelected({ kind: 'aiPanel', tile });
};

// in the right-panel JSX:
{selected && (
  <RightPanel accent={selected.kind === 'aiPanel' ? 'ai' : 'action'}>
    {selected.kind === 'actionMenu' && <ActionMenu tile={selected.tile} onClose={handleClose} />}
    {selected.kind === 'slotPicker' && (
      <SlotPicker
        tile={selected.tile}
        onClose={handleClose}
        onAskAi={() => handleAskAi(selected.tile)}
      />
    )}
    {selected.kind === 'aiPanel' && <AiPanel tile={selected.tile} onClose={handleClose} />}
  </RightPanel>
)}
```

`RightPanel`'s `accent` prop is derived from `selected.kind` (`'ai'` for the AI panel branch, `'action'` for the other two). Already supports both via `accentAi` and `accentAction` CSS classes from Step 4.

## 7. SlotPicker changes

Add `onAskAi?: () => void` prop. Render a new button at the **very top** of `.body` (above the search input):

```tsx
{onAskAi !== undefined && (
  <button
    type="button"
    className={styles.askAiButton}
    onClick={onAskAi}
  >
    <span className={styles.askAiSparkle}>✦</span>
    Ask AI for help
  </button>
)}
```

CSS:
```css
.askAiButton {
  width: 100%;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  font: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-shadow: 0 2px 8px rgba(124, 58, 237, 0.3);
}
.askAiButton:hover {
  transform: translateY(-1px);
}
.askAiSparkle {
  font-size: 14px;
}
```

(Could reuse `<AiButton label="Ask AI for help" />` from Step 2 — but `<AiButton>` is `display: inline-flex` whereas this needs `width: 100%`. Use a local button styled similarly to keep the slot-picker layout clean.)

## 8. Acceptance criteria

| # | Criterion |
|---|---|
| S7-1 | Click an elective placeholder in Sem 8. Slot picker opens. The FIRST element inside the body (above the Step 6 search input) is a **full-width purple-gradient button** reading `✦ Ask AI for help`. Hover lifts it 1px. |
| S7-2 | Clicking `✦ Ask AI for help` transitions the panel content to the AI panel mode. The panel's left border changes from blue `#1976d2` (action accent) to purple `#7c3aed` (AI accent). |
| S7-3 | AI panel header shows: purple-tinted gradient bg, `[✦ AI]` capsule, title `Help filling this slot`, scope chip (e.g., `Sem 8 · Tech Elec · 3cr` for elective; `Sem 4 · CYB E 2310` for unfilledDegreeSlot), close `×`. |
| S7-4 | AI panel body shows an initial AI message with a muted `Reading your plan` lead and a content paragraph using the elective label + sem (e.g., `Looking at your plan, this **Tech Elective** slot in Sem 8 is open. …`). The word in `**…**` renders bold purple. |
| S7-5 | Below the initial message, 3 suggestion cards render: `PSYCH 2300 · Intro to Psychology` (recommended — `✦` prefix + purple wash), `PHIL 2300 · Moral Theory & Practice`, `HIST 2010 · Western Civ I`. Each card has a rationale paragraph, `Add to slot` purple-gradient primary button (no-op), and ghost `Why?` button (no-op). |
| S7-6 | Footer shows a text input row (`Ask about this slot…` placeholder) + `Ask` purple-gradient send button. Below the input row, 3 quick-ask chips: `What pairs with this term?`, `Lighter workload options`, `Compare alternatives`. |
| S7-7 | Typing text and clicking `Ask` (or pressing Enter): the user's message appears in the conversation with a small `You` lead, then a canned AI reply appears below. Input clears. Subsequent sends keep appending. |
| S7-8 | Clicking any quick-ask chip fires the chip's text as a user message (same flow as S7-7). The chip itself does not get a highlighted/selected state — it's a fire-and-forget. |
| S7-9 | Clicking `×` (header) closes the panel entirely. Re-clicking the elective tile reopens **the slot picker** (NOT the AI panel — that fresh state is gone). |
| S7-10 | Step 4/5/6 behaviors all preserved: studentCourse → ActionMenu (with Completed-trim); unfilled/elective → SlotPicker by default (with search). Only the new `Ask AI for help` button reaches the AI panel. |
| S7-11 | An empty / whitespace-only input doesn't send. `Ask` button click while input is empty is a no-op. (Optional: button can be visually disabled too, but no-op behavior is sufficient.) |
| S7-12 | The right panel's left border is purple `#7c3aed` when in AI mode (devtools: `.panel` computed `border-left-color` resolves to `rgb(124, 58, 237)`). Other modes (action menu / slot picker) keep the blue. |
| S7-13 | `npm run build` exits 0. |
| S7-14 | `npm run lint` exits 0. |
| S7-15 | Visual match in browser — verified by user. |

## 9. Out-of-band notes

- **Branch:** `ui-v1/step-7-ai-chat` cut from main.
- **No tests** (still deferred).
- **Stubbed responses are intentionally generic.** The point of Step 7 is the conversation surface, not the AI quality. Real responses ship when MSW + a backend `/api/v1/ai/ask` lands.
- **`useAi` is generic on `AiScope`** but Step 7 only implements the `slot` kind. Future scopes (global / flow / semester) can extend the union and the `initialMessages` / `suggestionsForScope` / `quickAsksForScope` branches without re-shaping the hook.
- **The `**...**` markdown-like parser** in AI messages is intentionally minimal — split on `**`, render alternating spans bold. No nested patterns, no escape sequences. Bigger markdown is a later step (or never, if we keep AI replies plain).
- **Conversation reset on panel close**: matches spec §10.3 — each panel open is a fresh conversation. Persisting threads is a future infra concern.
- **`<AiPanel />` is independent of `<SlotPicker />`** — they live as sibling content components inside `<RightPanel>`. The transition flows through App state, not parent-child composition.

## 10. Decisions log

| # | Decision | Rationale |
|---|---|---|
| S7-D1 | Stubbed `useAi()` (no MSW, no real API) | User-approved scope cut. Lets the conversation surface land without committing to backend architecture. MSW + real AI integration are separate later steps. |
| S7-D2 | AI panel is a separate `SelectedPanel.kind`, not embedded in SlotPicker | Matches UI spec §10.3 (AI panel is one of three mutually-exclusive right-panel contents). Lets `<AiPanel />` own its full chrome without compromising slot-picker layout. |
| S7-D3 | "Ask AI for help" button at the TOP of slot-picker body | Top-of-body = primary affordance. Search input is the secondary tool ("if you know what you want"); AI is the easy path ("help me decide"). |
| S7-D4 | Close from AI panel = clears panel entirely (NOT "back to slot picker") | Simpler state model. The user can re-click the elective tile to get slot picker back. A back-button-style return would need extra state and isn't a spec requirement. |
| S7-D5 | `useAi` is parameterized by `AiScope` discriminated union | Future scopes (global/flow/semester) extend the union without re-shaping the hook. Step 7 only implements the `slot` branch. |
| S7-D6 | Suggestion `primaryActionLabel` is just a string (not an executable payload) | Per UI spec §11 the real API returns action payloads with `execute: { endpoint, body }` for mutation. Step 7 buttons are no-op stubs — a string label is sufficient. The shape will widen when real mutations land. |
| S7-D7 | Canned reply is the same regardless of input | Real branching is a real-AI concern. The point is the conversation flow works end-to-end (user msg appended → reply appears), not that the bot is smart. |
| S7-D8 | `**word**` → bold purple via inline split-on-`**` parser | Minimal markdown to support the spec's "bold purple emphasis on key facts" pattern (mockup line 305). No library, ~5 lines of JSX. |
| S7-D9 | Empty/whitespace-only `Ask` is a no-op (button stays clickable) | Disabling the button has UX edge cases (focus management, ARIA); a silent no-op is fine for Step 7. |
| S7-D10 | Conversation does NOT persist across panel close | Per spec §10.3 each open is a fresh chat. Future state lifting (e.g., to a context) when global AI persistence becomes a feature. |

## 11. Open items

- None blocking Step 7. After this step the AI conversation surface is live for slot scope. Step 8+ choices:
  - **MSW + real `useAi()` calls** (still without Anthropic — call a mock `/api/v1/ai/ask` that returns canned but structured DTOs). Closer to the eventual architecture.
  - **Real Anthropic integration** (needs server-side proxy; bigger lift).
  - **AI scope: global / flow / semester** — wire up the existing no-op `✦ Ask AI` / `✦ Analyze flow` / `✦` sem-row buttons.
  - **Real mutations** — make ActionMenu and SlotPicker action cards actually do something (local state first).
