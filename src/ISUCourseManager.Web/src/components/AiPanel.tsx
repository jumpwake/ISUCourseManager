import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AiMessage, AiScope, AiSuggestion, ElectiveSlotType } from '../data/types.ts';
import { academicTermToLabel } from '../data/academicTerm.ts';
import { useAi } from '../data/useAi.ts';
import styles from './AiPanel.module.css';

type Props = {
  scope: AiScope;
  onClose: () => void;
  onBack: () => void;
};

export function AiPanel({ scope, onClose, onBack }: Props) {
  const { messages, suggestions, quickAsks, loading, error, send, retry } = useAi(scope);
  const panelTitle =
    scope.kind === 'semester' ? 'Help planning this semester' : 'Help filling this slot';
  const [inputValue, setInputValue] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (el && typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, loading, error]);

  const handleSend = () => {
    if (loading) return;
    const trimmed = inputValue.trim();
    if (trimmed.length === 0) return;
    send(trimmed);
    setInputValue('');
  };

  const [initialMessage, ...conversationTurns] = messages;
  const initialLoading = loading && messages.length === 0;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <button
            type="button"
            className={styles.back}
            onClick={onBack}
            aria-label="Back to slot options"
          >
            ←
          </button>
          <span className={styles.aiCapsule}>AI</span>
          <span className={styles.title}>{panelTitle}</span>
          <span className={styles.scopeChip}>{scopeLabel(scope)}</span>
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

      <div className={styles.body} ref={bodyRef}>
        {initialLoading && <div className={styles.loadingState}>Reading your plan…</div>}

        {initialMessage && <MessageBlock msg={initialMessage} />}

        {suggestions.length > 0 && (
          <div className={styles.suggestionList}>
            {suggestions.map((sg) => (
              <SuggestionCard key={sg.id} sg={sg} />
            ))}
          </div>
        )}

        {conversationTurns.map((msg, i) => (
          <MessageBlock key={i} msg={msg} />
        ))}

        {loading && messages.length > 0 && (
          <div className={styles.msg}>
            <div className={styles.lead}>AI</div>
            <div className={styles.thinking}>Thinking…</div>
          </div>
        )}

        {error && (
          <div className={styles.errorBlock}>
            <span>Something went wrong reaching the AI.</span>
            <button type="button" className={styles.retryBtn} onClick={retry}>
              Retry
            </button>
          </div>
        )}
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
            disabled={loading}
            aria-label="Ask AI about this slot"
          />
          <button
            type="button"
            className={styles.sendBtn}
            onClick={handleSend}
            disabled={loading}
          >
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
              disabled={loading}
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

function scopeLabel(scope: AiScope): string {
  if (scope.kind === 'semester') {
    return `Sem ${scope.semIdx} · ${academicTermToLabel(scope.academicTerm)}`;
  }
  const tile = scope.tile;
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
