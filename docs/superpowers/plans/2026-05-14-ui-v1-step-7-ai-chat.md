# UI v1 Step 7 (AI Chat — Slot Scope, Stubbed) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the first AI-mediated UX surface — a stubbed AI chat panel opens from inside the slot picker. Add a `useAi(scope)` hook with hardcoded responses, a new `<AiPanel />` component (purple chrome), and an `Ask AI for help` button entry point in the slot picker. App state widens to a third panel mode (`aiPanel`).

**Architecture:** `<AiPanel />` is a third sibling content type next to `<ActionMenu />` and `<SlotPicker />`, all rendered inside `<RightPanel>`. The `accent` prop on RightPanel finally exercises its `'ai'` branch (purple `--panel-accent`). The `useAi(scope: AiScope)` hook holds local conversation state and returns canned messages + suggestions + quick-asks.

**Tech Stack:** Same as Steps 2–6 (React 19, Vite 8, TypeScript 6, CSS Modules). No new dependencies. The `**...**` → bold parser is a one-function inline helper, no markdown library.

**Spec:** `docs/superpowers/specs/2026-05-14-ui-v1-step-7-ai-chat-design.md`

**Branch:** `ui-v1/step-7-ai-chat` (already cut from main; spec committed at `51d9e18` + cleanup `4d440ab`).

---

## File Structure

**Create:**
- `src/ISUCourseManager.Web/src/data/useAi.ts` — stubbed hook + canned response helpers.
- `src/ISUCourseManager.Web/src/components/AiPanel.tsx` — the AI chat content component.
- `src/ISUCourseManager.Web/src/components/AiPanel.module.css` — chrome + body + suggestion-card + footer styles.

**Modify:**
- `src/ISUCourseManager.Web/src/data/types.ts` — add `AiMessage`, `AiSuggestion`, `AiScope` exports. Extend `SelectedPanel` documentation (the runtime type stays inline in App.tsx).
- `src/ISUCourseManager.Web/src/components/SlotPicker.tsx` — add `onAskAi?: () => void` prop, render the `Ask AI for help` button at the very top of `.body` when the prop is provided.
- `src/ISUCourseManager.Web/src/components/SlotPicker.module.css` — add `.askAiButton` rule.
- `src/ISUCourseManager.Web/src/App.tsx` — widen `SelectedPanel` to include `aiPanel`. Add `handleAskAi`. Pass `onAskAi` to `<SlotPicker>`. Mount `<AiPanel>` when `selected.kind === 'aiPanel'`. Compute `RightPanel`'s `accent` from `selected.kind`.

---

## Notes for the executor

- **Run all commands from the repo root: `C:/Users/lukeb/source/repos/ISUCourseManager`**. Use `npm --prefix src/ISUCourseManager.Web run <script>`. Do NOT `cd`.
- **TypeScript strictness:** `verbatimModuleSyntax: true` (use `import type`), `noUnusedLocals: true`, `allowImportingTsExtensions: true`, `erasableSyntaxOnly: true`.
- **Commit style:** Conventional Commits, `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer.
- **`React.KeyboardEvent<HTMLInputElement>` typing**: don't import the type explicitly. TypeScript infers the event type from the `onKeyDown` prop on `<input>`, so an inline arrow handler like `onKeyDown={(e) => { if (e.key === 'Enter') ... }}` typechecks without explicit annotation. This keeps verbatimModuleSyntax happy.

---

## Pre-flight: confirm starting state

- [ ] **Step 1: Confirm branch + clean working tree**

```
git status
git rev-parse --abbrev-ref HEAD
```

Expected: branch `ui-v1/step-7-ai-chat`. Clean (or only `.claude/` untracked).

- [ ] **Step 2: Confirm Step 6 build still passes**

```
npm --prefix src/ISUCourseManager.Web run build
npm --prefix src/ISUCourseManager.Web run lint
```

Expected: both exit 0.

---

## Task 1: Extend `types.ts` with AI types

**Files:**
- Modify: `src/ISUCourseManager.Web/src/data/types.ts`

- [ ] **Step 1: Append AI type exports to the end of `types.ts`**

Add these exports after the existing `UnfilledTile` line:

```ts
export type AiMessage =
  | { role: 'ai'; lead?: string; content: string }
  | { role: 'user'; content: string };

export type AiSuggestion = {
  id: string;
  name: string;
  meta: string;
  rationale: string;
  isRecommended?: boolean;
  primaryActionLabel: string;
};

export type AiScope =
  | { kind: 'slot'; tile: UnfilledTile };
```

(`SelectedPanel` is NOT exported from types.ts — it stays inline in App.tsx, where it gains a new branch in Task 5.)

- [ ] **Step 2: Verify build**

```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0. No consumers reference the new types yet — additions are non-breaking.

- [ ] **Step 3: Commit**

```
git add src/ISUCourseManager.Web/src/data/types.ts
git commit -m "$(cat <<'EOF'
feat(ui): add AI message/suggestion/scope types for Step 7

Three new exports: AiMessage (discriminated union over ai/user roles
with optional lead line on AI messages), AiSuggestion (cards for the
AI panel body), AiScope (union over panel scopes — Step 7 only has
'slot').

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add stubbed `useAi()` hook

**Files:**
- Create: `src/ISUCourseManager.Web/src/data/useAi.ts`

- [ ] **Step 1: Create `useAi.ts`**

```ts
import { useState } from 'react';
import type {
  AiMessage,
  AiScope,
  AiSuggestion,
  ElectiveSlotType,
} from './types.ts';

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
      { role: 'ai', content: cannedReply() },
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
    return [
      {
        role: 'ai',
        lead: 'Reading your plan',
        content: `Looking at your plan, this **${electiveLabelLong(tile.slotType)}** slot in Sem ${tile.semIdx} is open. Below are a few candidates that fit your major and term workload. I can also pull alternatives — ask me anything.`,
      },
    ];
  }
  return [
    {
      role: 'ai',
      lead: 'Reading your plan',
      content: `This is your **${tile.code} · ${tile.name}** slot. I can suggest alternatives, help you decide whether to defer it, or compare what other CybE students did. Ask me anything.`,
    },
  ];
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

function cannedReply(): string {
  return 'Got it — let me pull a few angles for you. (Real AI replies land in a later step; this is a stubbed response so you can exercise the conversation surface.)';
}

function electiveLabelLong(slotType: ElectiveSlotType): string {
  switch (slotType) {
    case 'ElectiveGenEd':
      return 'Gen Ed Elective';
    case 'ElectiveMath':
      return 'Math Elective';
    case 'ElectiveTech':
      return 'Tech Elective';
    case 'ElectiveCybE':
      return 'CybE Elective';
    case 'ElectiveCprE':
      return 'CprE Elective';
  }
}
```

Notes:
- `useState` is the only React hook; `import { useState }` (value).
- All AI types use `import type`.
- Unused params on `suggestionsForScope` and `quickAsksForScope` are prefixed with `_` — TypeScript's `noUnusedParameters` ignores underscore-prefixed names.
- `cannedReply` takes no input — for Step 7 the reply doesn't depend on user text. Spec §10 (S7-D7).

- [ ] **Step 2: Verify build**

```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0. `useAi` is exported but unused — TypeScript doesn't flag unused exports.

- [ ] **Step 3: Commit**

```
git add src/ISUCourseManager.Web/src/data/useAi.ts
git commit -m "$(cat <<'EOF'
feat(ui): add stubbed useAi(scope) hook for Step 7

Returns hardcoded initial message + 3 suggestion cards + 3 quick-asks
for slot scope. send(text) appends a user message + canned AI reply
to local conversation state. No Anthropic calls — UX surface only.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add `<AiPanel />` component

**Files:**
- Create: `src/ISUCourseManager.Web/src/components/AiPanel.tsx`
- Create: `src/ISUCourseManager.Web/src/components/AiPanel.module.css`

- [ ] **Step 1: Create `AiPanel.module.css`**

```css
.panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.header {
  background: linear-gradient(135deg, #faf5ff 0%, #f5f3ff 100%);
  padding: 14px 16px 10px;
  border-bottom: 1px solid #c4b5fd;
}

.headerTop {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.aiCapsule {
  background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
  color: white;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.3px;
  padding: 2px 7px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.aiCapsule::before {
  content: "✦";
  font-size: 10px;
}

.title {
  font-size: 13px;
  font-weight: 700;
  color: #1f2328;
}

.scopeChip {
  margin-left: auto;
  font-size: 10px;
  color: #5b21b6;
  background: white;
  border: 1px solid #c4b5fd;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
}

.close {
  color: #5b21b6;
  cursor: pointer;
  font-size: 16px;
  font-weight: 400;
  background: transparent;
  border: none;
  padding: 0;
  line-height: 1;
  margin-left: 4px;
}

.close:hover {
  color: #4c1d95;
}

.body {
  padding: 12px 16px;
  flex-grow: 1;
  overflow-y: auto;
  background: #fff;
}

.msg {
  padding: 10px 0;
  font-size: 12px;
  line-height: 1.55;
  color: #1f2328;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 12px;
}

.lead {
  font-size: 11px;
  color: #5a6573;
  margin-bottom: 6px;
}

.userLead {
  color: #5b21b6;
}

.msg strong {
  color: #5b21b6;
  font-weight: 700;
}

.suggestionList {
  margin-bottom: 12px;
}

.suggestion {
  border: 1px solid #e0e0e0;
  border-left: 3px solid transparent;
  border-radius: 4px;
  padding: 10px 12px;
  margin-bottom: 8px;
  background: #fff;
  cursor: default;
  transition: all 0.12s;
}

.suggestion:hover {
  border-left-color: #7c3aed;
  background: #faf5ff;
}

.suggestion.recommended {
  border-left-color: #7c3aed;
  background: #faf5ff;
}

.sgHead {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 4px;
}

.sgName {
  font-weight: 700;
  font-size: 12.5px;
  color: #1f2328;
}

.sgMeta {
  font-size: 10px;
  color: #8895a4;
  margin-left: auto;
}

.sgRationale {
  font-size: 11px;
  color: #455a64;
  line-height: 1.45;
  margin: 4px 0 8px;
}

.sgActions {
  display: flex;
  gap: 6px;
  align-items: center;
}

.sgPrimary {
  background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
  color: white;
  border: none;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  font: inherit;
  letter-spacing: 0.1px;
}

.sgPrimary:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(124, 58, 237, 0.3);
}

.sgGhost {
  background: transparent;
  color: #5b21b6;
  border: none;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  font: inherit;
}

.sgGhost:hover {
  background: #faf5ff;
}

.footer {
  padding: 10px 12px;
  border-top: 1px solid #e0e0e0;
  background: #fff;
}

.inputRow {
  display: flex;
  gap: 6px;
  align-items: center;
  border: 1px solid #d0d7de;
  border-radius: 4px;
  padding: 4px 6px 4px 10px;
  background: #fff;
}

.inputRow:focus-within {
  border-color: #7c3aed;
}

.input {
  flex-grow: 1;
  padding: 4px 0;
  border: none;
  font-size: 12px;
  outline: none;
  background: transparent;
  font: inherit;
}

.sendBtn {
  background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
  color: white;
  border: none;
  padding: 4px 10px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  font: inherit;
}

.quickAsks {
  margin-top: 8px;
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.quickAsk {
  background: #fff;
  border: 1px solid #e0e0e0;
  padding: 3px 8px;
  border-radius: 3px;
  font-size: 10px;
  color: #5a6573;
  cursor: pointer;
  font: inherit;
}

.quickAsk:hover {
  background: #faf5ff;
  border-color: #c4b5fd;
  color: #5b21b6;
}
```

- [ ] **Step 2: Create `AiPanel.tsx`**

```tsx
import { useState } from 'react';
import type { ReactNode } from 'react';
import type {
  AiMessage,
  AiSuggestion,
  ElectiveSlotType,
  UnfilledTile,
} from '../data/types.ts';
import { useAi } from '../data/useAi.ts';
import styles from './AiPanel.module.css';

type Props = {
  tile: UnfilledTile;
  onClose: () => void;
};

export function AiPanel({ tile, onClose }: Props) {
  const { messages, suggestions, quickAsks, send } = useAi({ kind: 'slot', tile });
  const [inputValue, setInputValue] = useState('');

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (trimmed.length === 0) return;
    send(trimmed);
    setInputValue('');
  };

  const [initialMessage, ...conversationTurns] = messages;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <span className={styles.aiCapsule}>AI</span>
          <span className={styles.title}>Help filling this slot</span>
          <span className={styles.scopeChip}>{scopeLabel(tile)}</span>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close AI panel"
          >
            ×
          </button>
        </div>
      </div>

      <div className={styles.body}>
        {initialMessage && <MessageBlock msg={initialMessage} />}

        <div className={styles.suggestionList}>
          {suggestions.map((sg) => (
            <SuggestionCard key={sg.id} sg={sg} />
          ))}
        </div>

        {conversationTurns.map((msg, i) => (
          <MessageBlock key={i} msg={msg} />
        ))}
      </div>

      <div className={styles.footer}>
        <div className={styles.inputRow}>
          <input
            type="text"
            className={styles.input}
            placeholder="Ask about this slot…"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSend();
              }
            }}
            aria-label="Ask AI about this slot"
          />
          <button type="button" className={styles.sendBtn} onClick={handleSend}>
            Ask
          </button>
        </div>
        <div className={styles.quickAsks}>
          {quickAsks.map((qa) => (
            <button
              key={qa}
              type="button"
              className={styles.quickAsk}
              onClick={() => send(qa)}
            >
              {qa}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageBlock({ msg }: { msg: AiMessage }) {
  if (msg.role === 'ai') {
    return (
      <div className={styles.msg}>
        {msg.lead !== undefined && <div className={styles.lead}>{msg.lead}</div>}
        <div>{renderMessageContent(msg.content)}</div>
      </div>
    );
  }
  return (
    <div className={styles.msg}>
      <div className={`${styles.lead} ${styles.userLead}`}>You</div>
      <div>{msg.content}</div>
    </div>
  );
}

function SuggestionCard({ sg }: { sg: AiSuggestion }) {
  const className = sg.isRecommended
    ? `${styles.suggestion} ${styles.recommended}`
    : styles.suggestion;
  return (
    <div className={className}>
      <div className={styles.sgHead}>
        <span className={styles.sgName}>
          {sg.isRecommended ? `✦ ${sg.name}` : sg.name}
        </span>
        <span className={styles.sgMeta}>{sg.meta}</span>
      </div>
      <div className={styles.sgRationale}>{sg.rationale}</div>
      <div className={styles.sgActions}>
        <button type="button" className={styles.sgPrimary}>
          {sg.primaryActionLabel}
        </button>
        <button type="button" className={styles.sgGhost}>
          Why?
        </button>
      </div>
    </div>
  );
}

function renderMessageContent(text: string): ReactNode {
  const parts = text.split('**');
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>,
  );
}

function scopeLabel(tile: UnfilledTile): string {
  if (tile.kind === 'electiveSlot') {
    return `Sem ${tile.semIdx} · ${electiveLabel(tile.slotType)} · ${tile.requiredCredits}cr`;
  }
  return `Sem ${tile.semIdx} · ${tile.code}`;
}

function electiveLabel(slotType: ElectiveSlotType): string {
  switch (slotType) {
    case 'ElectiveGenEd':
      return 'Gen Ed';
    case 'ElectiveMath':
      return 'Math Elec';
    case 'ElectiveTech':
      return 'Tech Elec';
    case 'ElectiveCybE':
      return 'CybE Elec';
    case 'ElectiveCprE':
      return 'CprE Elec';
  }
}
```

Notes:
- `useState` is the only value hook (for `inputValue`); `useAi` is the call to the hook from Task 2.
- All type imports use `import type`.
- `MessageBlock`, `SuggestionCard`, `renderMessageContent`, `scopeLabel`, `electiveLabel` are file-local helpers.
- `renderMessageContent` splits on `**` and renders alternating spans bold — minimal parser per spec §10 (S7-D8). Even indices = plain, odd indices = bold.
- Keys: `messages` use index (stable per render); `suggestions` use `sg.id`; `quickAsks` use the string itself.
- TypeScript infers the `onChange` and `onKeyDown` event types from the `<input>` element prop signatures.

- [ ] **Step 3: Verify build**

```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0. AiPanel is created but unused — TypeScript / Vite don't flag unused exports.

- [ ] **Step 4: Commit**

```
git add src/ISUCourseManager.Web/src/components/AiPanel.tsx src/ISUCourseManager.Web/src/components/AiPanel.module.css
git commit -m "$(cat <<'EOF'
feat(ui): add AiPanel component for Step 7 chat surface

New right-panel content component: purple header (AI capsule, title,
scope chip, close ×), initial AI message, 3 suggestion cards, growing
conversation via send(), footer with text input + Ask button + 3
quick-ask chips. Wired to the stubbed useAi hook from the previous
commit. All action buttons (suggestion Add/Why?, quick-asks) are
either no-op stubs or fire send(text).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add `Ask AI for help` button to SlotPicker

**Files:**
- Modify: `src/ISUCourseManager.Web/src/components/SlotPicker.tsx`
- Modify: `src/ISUCourseManager.Web/src/components/SlotPicker.module.css`

The button renders at the VERY TOP of the slot-picker body (above the Step 6 search input) when `onAskAi` is provided. Without `onAskAi`, button is omitted (backwards-compat — App in current state doesn't pass it; Task 5 wires it).

- [ ] **Step 1: Append CSS rule to `SlotPicker.module.css`**

Add this rule at the end of `SlotPicker.module.css`:

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

- [ ] **Step 2: Edit `SlotPicker.tsx`**

Read the current file first. Then make two changes:

**Change A — extend the Props type** to include `onAskAi`:

```ts
type Props = {
  tile: UnfilledTile;
  onClose: () => void;
  onAskAi?: () => void;
};
```

And the component signature:

```ts
export function SlotPicker({ tile, onClose, onAskAi }: Props) {
```

**Change B — render the Ask AI button at the top of `.body`**, immediately before the `<input className={styles.searchInput}>` line. Insert this block:

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

The full updated `<div className={styles.body}>` JSX should look like:

```tsx
<div className={styles.body}>
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

  <input
    type="text"
    className={styles.searchInput}
    placeholder="Search catalog…"
    value={query}
    onChange={(e) => setQuery(e.target.value)}
    aria-label="Search catalog"
  />

  <Section title="Pull from a later semester">
    {/* ... unchanged ... */}
  </Section>

  {/* ... rest unchanged ... */}
</div>
```

- [ ] **Step 3: Verify build**

```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0. App still calls `<SlotPicker tile={...} onClose={...} />` without `onAskAi`, so the button doesn't render yet — no visible change. Task 5 wires it.

- [ ] **Step 4: Commit**

```
git add src/ISUCourseManager.Web/src/components/SlotPicker.tsx src/ISUCourseManager.Web/src/components/SlotPicker.module.css
git commit -m "$(cat <<'EOF'
feat(ui): add Ask AI for help button to SlotPicker

New full-width purple-gradient button at the very top of the slot-
picker body (above the search input). Renders only when onAskAi prop
is provided — kept optional for backwards-compat through Task 5's
App integration.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Wire AiPanel in App.tsx

**Files:**
- Modify: `src/ISUCourseManager.Web/src/App.tsx`

This task widens `SelectedPanel` to include the new `aiPanel` branch, adds the click handler, conditionally mounts `<AiPanel>`, and derives `RightPanel`'s `accent` from `selected.kind`.

- [ ] **Step 1: Replace `App.tsx` with**:

```tsx
import { useState } from 'react';
import type {
  PlanTile,
  StudentCoursePlanTile,
  UnfilledTile,
} from './data/types.ts';
import { DesktopOnlyGate } from './components/DesktopOnlyGate.tsx';
import { TopBar } from './components/TopBar.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { Main } from './components/Main.tsx';
import { RightPanel } from './components/RightPanel.tsx';
import { ActionMenu } from './components/ActionMenu.tsx';
import { SlotPicker } from './components/SlotPicker.tsx';
import { AiPanel } from './components/AiPanel.tsx';
import styles from './App.module.css';

type SelectedPanel =
  | { kind: 'actionMenu'; tile: StudentCoursePlanTile }
  | { kind: 'slotPicker'; tile: UnfilledTile }
  | { kind: 'aiPanel'; tile: UnfilledTile };

function App() {
  const [selected, setSelected] = useState<SelectedPanel | null>(null);

  const isPanelOpen = selected !== null;
  const appClassName = isPanelOpen
    ? styles.app
    : `${styles.app} ${styles.noPanel}`;

  const handleTileClick = (tile: PlanTile) => {
    if (tile.kind === 'studentCourse') {
      if (selected?.kind === 'actionMenu' && selected.tile.classId === tile.classId) {
        setSelected(null);
      } else {
        setSelected({ kind: 'actionMenu', tile });
      }
      return;
    }
    if (selected?.kind === 'slotPicker' && isSameUnfilledTile(selected.tile, tile)) {
      setSelected(null);
    } else {
      setSelected({ kind: 'slotPicker', tile });
    }
  };

  const handleAskAi = (tile: UnfilledTile) => {
    setSelected({ kind: 'aiPanel', tile });
  };

  const handleClose = () => setSelected(null);

  const selectedClassId =
    selected?.kind === 'actionMenu' ? selected.tile.classId : null;

  const panelAccent = selected?.kind === 'aiPanel' ? 'ai' : 'action';

  return (
    <DesktopOnlyGate>
      <div className={appClassName}>
        <TopBar />
        <Sidebar />
        <Main onTileClick={handleTileClick} selectedClassId={selectedClassId} />
        {selected && (
          <RightPanel accent={panelAccent}>
            {selected.kind === 'actionMenu' && (
              <ActionMenu tile={selected.tile} onClose={handleClose} />
            )}
            {selected.kind === 'slotPicker' && (
              <SlotPicker
                tile={selected.tile}
                onClose={handleClose}
                onAskAi={() => handleAskAi(selected.tile)}
              />
            )}
            {selected.kind === 'aiPanel' && (
              <AiPanel tile={selected.tile} onClose={handleClose} />
            )}
          </RightPanel>
        )}
      </div>
    </DesktopOnlyGate>
  );
}

function isSameUnfilledTile(a: UnfilledTile, b: UnfilledTile): boolean {
  if (a.kind === 'unfilledDegreeSlot' && b.kind === 'unfilledDegreeSlot') {
    return a.classId === b.classId && a.semIdx === b.semIdx;
  }
  if (a.kind === 'electiveSlot' && b.kind === 'electiveSlot') {
    return a.slotType === b.slotType && a.semIdx === b.semIdx;
  }
  return false;
}

export default App;
```

Changes vs. Step 6 App.tsx:
- Added `import { AiPanel } ...`.
- `SelectedPanel` union gains the `aiPanel` branch.
- New `handleAskAi(tile)` swaps `selected` to `{ kind: 'aiPanel', tile }`.
- New `panelAccent` derived from `selected.kind` (passed to `RightPanel`).
- `<SlotPicker>` now receives `onAskAi={() => handleAskAi(selected.tile)}`.
- New conditional renders `<AiPanel>` when `selected.kind === 'aiPanel'`.
- `RightPanel accent={panelAccent}` uses the derived accent (`'ai'` when in AI mode, `'action'` otherwise).

- [ ] **Step 2: Verify build**

```
npm --prefix src/ISUCourseManager.Web run build
```

Expected: exit 0.

- [ ] **Step 3: Verify lint**

```
npm --prefix src/ISUCourseManager.Web run lint
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```
git add src/ISUCourseManager.Web/src/App.tsx
git commit -m "$(cat <<'EOF'
feat(ui): wire AiPanel — Ask AI button opens AI chat mode

App state widens to include 'aiPanel' as a third SelectedPanel branch.
handleAskAi flips selected from slotPicker to aiPanel. RightPanel's
accent derives from selected.kind (purple 'ai' for the new mode, blue
'action' for everything else). The Step 4-scaffolded accent='ai'
finally gets exercised.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Manual acceptance verification

No automated tests this step.

- [ ] **Step 1: Start dev server**

```
npm --prefix src/ISUCourseManager.Web run dev
```

Expected: Vite reports `Local: http://localhost:5173/` (or next free port). Leave running.

- [ ] **Step 2: Verify Ask AI entry point (S7-1, S7-2)**

Open the dev URL in a desktop-width browser.

- [ ] **S7-1** Click one of the Sem 8 elective placeholder tiles. The slot picker opens. The FIRST element inside the body is a full-width purple-gradient button reading `✦ Ask AI for help`. Hover lifts it 1px.
- [ ] **S7-2** Click the `✦ Ask AI for help` button. Panel content swaps to the AI panel mode. Left border changes from blue `#1976d2` to purple `#7c3aed`. Header chrome changes from blue-tinted to purple-tinted gradient.

- [ ] **Step 3: Verify AI panel header (S7-3, S7-12)**

- [ ] **S7-3** Header shows: purple-gradient bg, `[✦ AI]` capsule, title `Help filling this slot`, scope chip on right (e.g., `Sem 8 · Tech Elec · 3cr` or similar based on which elective you clicked), close `×`. Capsule has the sparkle `✦` prefix.
- [ ] **S7-12** Devtools → Elements → inspect the `.panel` element. Computed `border-left-color` resolves to `rgb(124, 58, 237)` (purple).

- [ ] **Step 4: Verify initial AI message + suggestions (S7-4, S7-5)**

- [ ] **S7-4** Body shows an initial AI message: muted small-caps `Reading your plan` lead, then a paragraph mentioning the slot type and Sem number. The phrase like `**Tech Elective**` (whatever the elective is) renders **bold purple**.
- [ ] **S7-5** Below the initial message, 3 suggestion cards appear in this order: `PSYCH 2300 · Intro to Psychology` (with `✦ ` prefix + light purple wash background — this is the recommended one), `PHIL 2300 · Moral Theory & Practice`, `HIST 2010 · Western Civ I`. Each card has a rationale paragraph + `Add to slot` purple-gradient button (no-op) + ghost `Why?` button (no-op). Hovering a card lifts the left border to purple.

- [ ] **Step 5: Verify footer + conversation (S7-6, S7-7, S7-8)**

- [ ] **S7-6** Footer has: text input row with placeholder `Ask about this slot…` and purple `Ask` send button. Below the input row, 3 quick-ask chips: `What pairs with this term?`, `Lighter workload options`, `Compare alternatives`.
- [ ] **S7-7** Type "what about something with no homework" into the input. Click `Ask`. A new entry appears in the body BELOW the suggestion cards: a `You` lead in purple + your text. Then a canned AI reply appears below it ("Got it — let me pull a few angles for you. (Real AI replies land in a later step…)"). The input clears. Type more text and press Enter — same flow, appends another exchange.
- [ ] **S7-8** Click the `What pairs with this term?` chip. The chip's text gets added as a user message + canned reply (same flow as S7-7). The chip itself doesn't change appearance.

- [ ] **Step 6: Verify close behavior (S7-9, S7-11)**

- [ ] **S7-9** Click the `×` in the AI panel header. Panel closes. Re-click the same elective tile in Sem 8. The **slot picker** reopens (NOT the AI panel — the previous AI conversation state is gone).
- [ ] **S7-11** Open the AI panel again. Clear the input. Click `Ask` with an empty input. Nothing happens (no message appears, no error). Type only whitespace (spaces). Click `Ask`. Still no message.

- [ ] **Step 7: Verify earlier-step behaviors preserved (S7-10)**

- [ ] **S7-10** Click a studentCourse Sem 3 tile (e.g., CPRE-2810). Action menu opens with the full 4-section action set + blue left border. Click a Sem 1 Completed tile (e.g., MATH-1430). Action menu opens with empty-message body trim (Step 5 behavior). Click an elective without using Ask AI — slot picker opens with the search input and 3 sections (Step 6 behavior). All preserved.

- [ ] **Step 8: Final build + lint clean (S7-13, S7-14)**

Stop the dev server (Ctrl-C in its terminal). Then run:

```
npm --prefix src/ISUCourseManager.Web run build
npm --prefix src/ISUCourseManager.Web run lint
```

Expected: both exit 0.

- [ ] **Step 9: Report**

If all S7-1..S7-12 ACs pass plus the final build/lint check (S7-13/S7-14) and user-confirmed visual (S7-15), no further commits — Task 1-5 commits cover all code. Report success; final whole-branch review and finishing-branch flow handle the rest.

---

## Self-review (writer's checklist)

**Spec coverage:**

| Spec criterion | Implemented in |
|---|---|
| S7-1 (Ask AI button at top of slot-picker body) | Task 4 (CSS + JSX); verified Task 6 step 2 |
| S7-2 (button click swaps panel to AI mode, purple border) | Tasks 4 (button onClick) + 5 (handleAskAi + panelAccent); verified Task 6 step 2 |
| S7-3 (AI header content: capsule, title, scope chip, close) | Task 3 (AiPanel header JSX + scopeLabel helper); verified Task 6 step 3 |
| S7-4 (initial AI message with bold purple parser) | Tasks 2 (initialMessages) + 3 (MessageBlock + renderMessageContent); verified Task 6 step 4 |
| S7-5 (3 suggestion cards, recommended styling) | Tasks 2 (suggestionsForScope) + 3 (SuggestionCard + recommended CSS); verified Task 6 step 4 |
| S7-6 (footer input + Ask button + 3 quick-asks) | Tasks 2 (quickAsksForScope) + 3 (footer JSX); verified Task 6 step 5 |
| S7-7 (send appends user msg + canned reply) | Tasks 2 (send + cannedReply) + 3 (handleSend + Enter key); verified Task 6 step 5 |
| S7-8 (quick-ask click fires send) | Task 3 (chip onClick calls send(qa)); verified Task 6 step 5 |
| S7-9 (close clears panel; reopen slot picker fresh) | Task 5 (handleClose clears selected); verified Task 6 step 6 |
| S7-10 (Step 4/5/6 behaviors preserved) | All earlier code paths preserved in Task 5 App.tsx; verified Task 6 step 7 |
| S7-11 (empty/whitespace input is no-op) | Tasks 2 (send trims and returns early on empty) + 3 (handleSend also trims); verified Task 6 step 6 |
| S7-12 (purple border in AI mode) | Task 5 (panelAccent='ai' triggers .accentAi CSS class); verified Task 6 step 3 |
| S7-13 (build clean) | Every task; final Task 6 step 8 |
| S7-14 (lint clean) | Task 5 step 3; final Task 6 step 8 |
| S7-15 (visual match) | Task 6 steps 2-7 |

All 15 criteria covered.

**Placeholder scan:** no "TBD" / "TODO" / "implement later". Every step has complete code or a verifiable command.

**Type / name consistency:**
- `AiMessage`, `AiSuggestion`, `AiScope`, `UnfilledTile`, `StudentCoursePlanTile`, `PlanTile`, `ElectiveSlotType` — all referenced consistently across types.ts (Task 1), useAi.ts (Task 2), AiPanel.tsx (Task 3), App.tsx (Task 5).
- `useAi` hook signature: `useAi(scope: AiScope): { messages; suggestions; quickAsks; send }` — matches between Task 2's definition and Task 3's call.
- `SelectedPanel` discriminated union: 3 branches (`actionMenu` / `slotPicker` / `aiPanel`) — defined inline in App.tsx (Task 5), narrows correctly through the click handler and JSX.
- CSS class names match between TSX (Tasks 3, 4) and CSS modules: `.askAiButton`, `.askAiSparkle` in SlotPicker; `.panel`, `.header`, `.aiCapsule`, `.title`, `.scopeChip`, `.close`, `.body`, `.msg`, `.lead`, `.userLead`, `.suggestion`, `.recommended`, `.sgHead`, `.sgName`, `.sgMeta`, `.sgRationale`, `.sgActions`, `.sgPrimary`, `.sgGhost`, `.footer`, `.inputRow`, `.input`, `.sendBtn`, `.quickAsks`, `.quickAsk` in AiPanel.
- `RightPanel` `accent` prop: `'ai' | 'action'` matches its existing Step 4 contract.
- All relative imports use `.ts` / `.tsx` extensions.
- Type-only imports use `import type` per `verbatimModuleSyntax: true`.

No drift found.
